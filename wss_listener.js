// wss_listener.js
import WebSocket from 'ws';
import 'dotenv/config';
import { fetchProofForever } from './proof.js';
import { fetchProof } from './proof.js';
import { fetchRangeForPrice } from './fetcher.js';
import { runExecutor } from './runner.js';
import { ASSET_PKS, META, TRADING_PAIRS, WS_URL, DEFAULT_SUPRA_API_KEY, RESOLUTION, DELAY_BETWEEN_REQUESTS_MS } from './config.js';
import { setTimeout as sleep } from 'node:timers/promises';

const API_KEY = process.env.SUPRA_WS_API_KEY || DEFAULT_SUPRA_API_KEY;
const log = (...a) => console.log(new Date().toISOString(), ...a);

const subscriptionMessage = {
  action: 'subscribe',
  channels: [{ name: 'ohlc_datafeed', resolution: RESOLUTION, tradingPairs: TRADING_PAIRS }]
};

const runningByAsset = new Set();
const lastProcessedSlot = new Map();

function priceSlot(price) { return Math.round(Number(price) * 1e4); }
function getPkForAsset(assetId) {
  return ASSET_PKS[assetId] || process.env[`PK_${assetId}`] || process.env.PRIVATE_KEY || null;
}

async function handleUpdate(update) {
  try {
    const pairName = String(update.tradingPair || '').toLowerCase();
    const meta = META[pairName];
    if (!meta) return;

    const assetId = meta.id;
    const priceHuman = Number(update.currentPrice);
    if (!Number.isFinite(priceHuman) || priceHuman <= 0) return;

    const slot = priceSlot(priceHuman);
    const lastSlot = lastProcessedSlot.get(assetId);
    if (lastSlot === slot) return;
    lastProcessedSlot.set(assetId, slot);

    if (runningByAsset.has(assetId)) return;
    runningByAsset.add(assetId);

    log(`update asset=${assetId} ${pairName} price=${priceHuman} slot=${slot}`);

    // 1) fetch proof
    let proofHex;
    try {
      proofHex = await fetchProofWithRetry(assetId);
    } catch (e) {
      log(`[proof] error for ${assetId}:`, e?.message || String(e));
      runningByAsset.delete(assetId);
      return;
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);

    // 2) range
    let range;
    try {
      range = await fetchRangeForPrice(assetId, priceHuman);
    } catch (e) {
      log(`[range] error ${assetId}:`, e?.message || String(e));
      runningByAsset.delete(assetId);
      return;
    }

    const { orderIds, stopsSL, stopsTP, stopsLIQ } = range;
    log(`[range] asset=${assetId} orders=${orderIds.length} SL=${stopsSL.length} TP=${stopsTP.length} LIQ=${stopsLIQ.length}`);

    const pk = getPkForAsset(assetId);
    if (orderIds.length) await runExecutor('limit', { assetId, ids: orderIds, pk, slot, proofHex });
    if (stopsSL.length)  await runExecutor('sl',    { assetId, ids: stopsSL,  pk, slot, proofHex });
    if (stopsTP.length)  await runExecutor('tp',    { assetId, ids: stopsTP,  pk, slot, proofHex });
    if (stopsLIQ.length) await runExecutor('liq',   { assetId, ids: stopsLIQ, pk, slot, proofHex });

  } catch (e) {
    log('[handleUpdate] error:', e?.message || String(e));
  } finally {
    if (typeof update?.tradingPair === 'string') {
      const id = META[String(update.tradingPair).toLowerCase()]?.id;
      if (id !== undefined) runningByAsset.delete(id);
    }
  }
}

async function fetchProofWithRetry(pairIndex) {
  let delay = 200;               // premier délai = 200 ms
  const backoff = 1.8;           // facteur d’augmentation
  const maxDelay = 15000;        // max 15 secondes
  const jitter = 0.3;            // ±30% d’aléa pour éviter les collisions

  while (true) {
    try {
      const proof = await fetchProof([pairIndex]);
      return proof; // ✅ succès, on sort
    } catch (e) {
      const msg = e?.message || String(e);

      // Calcul du délai avec backoff + jitter
      const randomFactor = 1 + (Math.random() * 2 * jitter - jitter); // entre 0.7 et 1.3
      const sleepMs = Math.min(maxDelay, Math.round(delay * randomFactor));

      console.warn(`[proof] asset=${pairIndex} → ${msg} | retry in ${sleepMs}ms`);
      await sleep(sleepMs);

      // augmente le délai pour le prochain essai
      delay = Math.min(maxDelay, Math.round(delay * backoff));
    }
  }
}

/* ======== AUTO-RECONNECT (ajout minimal) ======== */
let reconnectDelay = 5000; // 5s au début, max 60s
async function scheduleReconnect() {
  const d = reconnectDelay;
  log(`⏳ Reconnecting WSS in ${Math.round(d/1000)}s...`);
  await sleep(d);
  reconnectDelay = Math.min(Math.round(reconnectDelay * 1.5), 60000);
  startWSS();
}
/* =============================================== */

function startWSS() {
  const ws = new WebSocket(WS_URL, { headers: { 'x-api-key': API_KEY } });
  ws.on('open', () => {
    log('WSS connected, subscribing...');
    reconnectDelay = 5000; // reset du backoff sur succès
    ws.send(JSON.stringify(subscriptionMessage));
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'subscribed') { log('subscribed'); return; }
      if (msg.event === 'ohlc_datafeed' && Array.isArray(msg.payload) && msg.payload.length) {
        for (const update of msg.payload) {
          // we don't await each handleUpdate in sequence here to allow concurrency control inside handleUpdate
          handleUpdate(update).catch(err => log('handleUpdate uncaught:', err?.message || String(err)));
        }
      }
    } catch (e) {
      log('WSS parse error:', e?.message || String(e));
    }
  });

  // ⬇️ modifs minimales : reconnexion
  ws.on('close', () => {
    log('⚠️ WSS closed');
    scheduleReconnect();
  });
  ws.on('error', (err) => {
    log('❌ WSS error:', err?.message || String(err));
    try { ws.close(); } catch {}
  });
}

startWSS();
