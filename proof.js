// proof.js — ESM, REST Supra DORA-2
import axios from 'axios';

const PROOF_ENDPOINT = process.env.SUPRA_PROOF_URL || 'https://rpc-testnet-dora-2.supra.com/get_proof';
const chainType = 'evm';

/** Un seul appel, sans retry */
export async function fetchProof(pairIndexes) {
  if (!Array.isArray(pairIndexes) || pairIndexes.length === 0) {
    throw new Error('❌ ERREUR: Aucun indice de paire valide fourni.');
  }
  const payload = { pair_indexes: pairIndexes, chain_type: chainType };
  const res = await axios.post(PROOF_ENDPOINT, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  });
  const proofBytes = res?.data?.proof_bytes;
  if (!proofBytes) throw new Error("Réponse API invalide : 'proof_bytes' est manquant.");
  return proofBytes.startsWith('0x') ? proofBytes : '0x' + proofBytes;
}

/**
 * Retry infini avec backoff + jitter.
 * - delayInitMs: 200ms, multiplié par 1.8 à chaque échec, plafonné à 15s
 * - jitter ±30% pour éviter la synchro
 */
export async function fetchProofForever(pairIndex, {
  delayInitMs = 200,
  backoff = 1.8,
  maxDelayMs = 15000,
  jitter = 0.3
} = {}) {
  let delay = delayInitMs;
  for (;;) {
    try {
      return await fetchProof([pairIndex]);
    } catch (e) {
      const msg = e?.message || String(e);
      // 503/ECONNREFUSED/timeout → on retry
      const j = 1 + (Math.random() * 2 * jitter - jitter); // 0.7..1.3 si jitter=0.3
      const sleepMs = Math.min(maxDelayMs, Math.round(delay * j));
      console.warn(`[proof] ${pairIndex} fail: ${msg} → retry in ${sleepMs}ms`);
      await new Promise(r => setTimeout(r, sleepMs));
      delay = Math.min(maxDelayMs, Math.round(delay * backoff));
    }
  }
}

export default { fetchProof, fetchProofForever };
