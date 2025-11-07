// runner.js
import { spawn } from 'node:child_process';
import { filterSuppressed, incSuppression, clearSuppression, getSuppressionMap } from './suppress.js';
import { callVerify } from './fetcher.js';
import { EXECUTOR_PATH, EXECUTOR_ADDR, EXECUTOR_RPC, CALL_DELAY_MS } from './config.js';
import { VERIFY_BASE } from './config.js'; // ✅ ajouté

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ✅ ajout : petite fonction fire-and-forget */
function pingVerify(ids) {
  try {
    if (!ids?.length) return;
    const url = `${VERIFY_BASE}/verify/${ids.join(',')}`;
    fetch(url).catch(() => {}); // on n’attend pas la réponse, on ignore les erreurs
  } catch {}
}

/**
 * Call executor.js (node) with args and proof, parse stdout for simulate.* lines.
 * Returns { execFailed: bool, skippedSim: number, out: string }
 */
async function callExecutorProcess(mode, group, pk, assetId, proofHex) {
  const argIds = JSON.stringify(group);
  const args = [
    EXECUTOR_PATH,
    mode,
    argIds,
    pk,
    `--asset=${assetId}`,
    `--addr=${EXECUTOR_ADDR}`,
    `--rpc=${EXECUTOR_RPC}`,
    `--proof=${proofHex}`
  ];

  let out = '';
  let execFailed = false;

  await new Promise((resolve, reject) => {
    const p = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (buf) => { const s = buf.toString(); out += s; process.stdout.write(s); });
    p.stderr.on('data', (buf) => { const s = buf.toString(); process.stderr.write(s); });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${mode} exit ${code}`))));
    p.on('error', reject);
  }).catch((e) => {
    execFailed = true;
    log(`[executor] process error:`, e?.message || String(e));
  });

  // parse simulate lines
  let skippedSim = 0;
  try {
    const m1 = out.match(/simulate\.execLimits\s*→\s*executed=(\d+)\s*\|\s*skipped=(\d+)/);
    const m2 = out.match(/simulate\.closeBatch\(\d+\)\s*→\s*closed=(\d+)\s*\|\s*skipped=(\d+)/);
    if (m1) skippedSim = Number(m1[2] || 0);
    if (m2) skippedSim = Number(m2[2] || 0);
  } catch (e) { /* noop */ }

  return { execFailed, skippedSim, out };
}

/**
 * High-level runner: batching + suppression + verify
 */
export async function runExecutor(mode, { assetId, ids, pk, slot, proofHex }) {
  if (!ids?.length) return;
  if (!pk) { log(`[runner] no PK for asset ${assetId}, skip`); return; }
  if (!proofHex || typeof proofHex !== 'string' || !proofHex.startsWith('0x')) {
    log(`[runner] invalid proof for asset ${assetId}, skip batch`);
    return;
  }

  const filtered = filterSuppressed(assetId, slot, ids);
  if (!filtered.length) {
    log(`[runner] all IDs clean-skipped on slot=${slot}`);
    return;
  }

  for (let i = 0; i < filtered.length; i += 200) {
    const group = filtered.slice(i, i + 200);

    const { execFailed, skippedSim } = await callExecutorProcess(mode, group, pk, assetId, proofHex);

    /* ✅ ajout : ping l’API après chaque exécution réussie */
    if (!execFailed) {
      pingVerify(group);
    }

    if (execFailed) {
      const ver = await callVerify(group);
      if (ver && ver.updated === 0) {
        incSuppression(assetId, slot, group);
      } else if (ver && (ver.updated > 0 || (Array.isArray(ver.mismatches) && ver.mismatches.length))) {
        clearSuppression(assetId, slot, group);
      }
    } else if (skippedSim > 0) {
      const ver = await callVerify(group);
      if (ver && ver.updated === 0) {
        incSuppression(assetId, slot, group);
        const m = getSuppressionMap().get(`${assetId}:${slot}`);
        const reached = group.filter(id => (m?.get(id) || 0) >= 3);
        if (reached.length) log(`[runner] frozen IDs on slot=${slot}: ${reached.join(',')}`);
      } else if (ver && (ver.updated > 0 || (Array.isArray(ver.mismatches) && ver.mismatches.length))) {
        clearSuppression(assetId, slot, group);
      }
    }

    await new Promise(r => setTimeout(r, CALL_DELAY_MS));
  }
}
