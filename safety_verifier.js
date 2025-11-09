// safety_verifier.js
import WebSocket from 'ws';
import 'dotenv/config';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  META,
  TRADING_PAIRS,
  WS_URL,
  DEFAULT_SUPRA_API_KEY,
  RESOLUTION,
  API_BASE,
  VERIFY_BASE,
  DELAY_BETWEEN_REQUESTS_MS
} from './config.js';

const API_KEY = process.env.SUPRA_WS_API_KEY || DEFAULT_SUPRA_API_KEY;
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ±0.1%
const SAFETY_RANGE_RATE = 0.001;

// Anti-spam par ID
const THROTTLE_MS = 60_000;      // 1 minute par ID
const PRUNE_AGE_MS = 10 * 60_000; // on garde au plus 10 minutes d’entrées
const lastPingById = new Map();   // id -> timestamp(ms)

// même payload que le listener principal
const subscriptionMessage = {
  action: 'subscribe',
  channels: [{ name: 'ohlc_datafeed', resolution: RESOLUTION, tradingPairs: TRADING_PAIRS }]
};

const runningByAsset = new Set();
const lastProcessedSlot = new Map();

// slot un peu moins fin pour éviter le spam (1e3 ~ 0.001 pas)
function priceSlot(price) { return Math.round(Number(price) * 1e3); }

function uniqSortedIds(arr) {
  return Array.from(new Set((arr || []).map(Number)))
    .filter(n => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
}

async function fetchRangeAround(assetId, priceHuman, rate = SAFETY_RANGE_RATE) {
  const from = priceHuman * (1 - rate);
  const to   = priceHuman * (1 + rate);
  const url  = `${API_BASE}/bucket/range?asset=${assetId}&from=${from}&to=${to}&types=orders,stops&side=all&sort=lots&order=desc`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Range API HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();

  const ORDERS = Array.isArray(data.items_orders) ? data.items_orders : [];
  const STOPS  = Array.isArray(data.items_stops)  ? data.items_stops  : [];

  const orderIds = uniqSortedIds(ORDERS.map(o => o.id));
  const stopIds  = uniqSortedIds(STOPS.map(s => s.id));

  // Tous les IDs (orders + stops), unique & trié
  const allIds = uniqSortedIds(orderIds.concat(stopIds));
  return { allIds, raw: data };
}

function pingVerify(ids) {
  if (!ids?.length) return;
  const url = `${VERIFY_BASE}/verify/${ids.join(',')}`;
  // fire-and-forget
  fetch(url).catch(() => {});
}

// Filtre anti-spam: enlève les IDs pingés récemment (< THROTTLE_MS)
function filterThrottled(ids) {
  const now = Date.now();
  return ids.filter(id => {
    const last = lastPingById.get(id) || 0;
    return (now - last) >= THROTTLE_MS;
  });
}

// Marque les IDs comme pingés maintenant
function markPinged(ids) {
  const now = Date.now();
  for (const id of ids) lastPingById.set(id, now);
}

// Nettoie la map des entrées trop anciennes
function pruneThrottleMap() {
  const now = Date.now();
  for (const [id, ts] of lastPingById.entries()) {
    if ((now - ts) > PRUNE_AGE_MS) lastPingById.delete(id);
  }
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
    if (lastProcessedSlot.get(assetId) === slot) return;
    lastProcessedSlot.set(assetId, slot);

    if (runningByAsset.has(assetId)) return;
    runningByAsset.add(assetId);

    // petite pause pour lisser
    await sleep(DELAY_BETWEEN_REQUESTS_MS);

    let range;
    try {
      range = await fetchRangeAround(assetId, priceHuman, SAFETY_RANGE_RATE);
    } catch (e) {
      log(`[safety-range] error asset=${assetId}:`, e?.message || String(e));
      return;
    }

    pruneThrottleMap();

    const { allIds } = range;
    const idsToPing = filterThrottled(allIds);

    if (idsToPing.length) {
      log(`[safety] asset=${assetId} price=${priceHuman} ids=${idsToPing.length} (±0.1%) → verify`);
      markPinged(idsToPing);
      pingVerify(idsToPing);
    }
  } catch (e) {
    log('[safety handleUpdate] error:', e?.message || String(e));
  } finally {
    if (typeof update?.tradingPair === 'string') {
      const id = META[String(update.tradingPair).toLowerCase()]?.id;
      if (id !== undefined) runningByAsset.delete(id);
    }
  }
}

/* ======== AUTO-RECONNECT + KEEPALIVE minimal ======== */
let reconnectDelay = 5000; // 5s -> 60s
let reconnectTimer = null;
let pingTimer = null;
let pongTimeout = null;
let wsRef = null;
const PING_INTERVAL = 20000;
const PONG_GRACE = 15000;

function clearTimers() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const d = reconnectDelay;
  log(`⏳ Reconnecting WSS (safety) in ${Math.round(d/1000)}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(Math.round(reconnectDelay * 1.5), 60000);
    startWSS();
  }, d);
}
/* ==================================================== */

function startWSS() {
  try {
    if (wsRef && wsRef.readyState === WebSocket.OPEN) {
      try { wsRef.close(); } catch {}
    }
  } catch {}

  const ws = new WebSocket(WS_URL, { headers: { 'x-api-key': API_KEY } });
  wsRef = ws;

  ws.on('open', () => {
    log('[safety] WSS connected, subscribing...');
    reconnectDelay = 5000;
    clearTimers();
    ws.send(JSON.stringify(subscriptionMessage));

    // keepalive
    pingTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.ping();
        if (pongTimeout) clearTimeout(pongTimeout);
        pongTimeout = setTimeout(() => {
          log('[safety] no pong — forcing reconnect');
          try { ws.terminate(); } catch {}
        }, PONG_GRACE);
      } catch {}
    }, PING_INTERVAL);
  });

  ws.on('pong', () => {
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'subscribed') { log('[safety] subscribed'); return; }
      if (msg.event === 'ohlc_datafeed' && Array.isArray(msg.payload) && msg.payload.length) {
        for (const update of msg.payload) {
          handleUpdate(update).catch(err => log('[safety] handleUpdate uncaught:', err?.message || String(err)));
        }
      }
    } catch (e) {
      log('[safety] WSS parse error:', e?.message || String(e));
    }
  });

  ws.on('close', () => {
    log('[safety] ⚠️ WSS closed');
    clearTimers();
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    log('[safety] ❌ WSS error:', err?.message || String(err));
    try { ws.close(); } catch {}
  });
}

startWSS();
