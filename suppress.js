// suppress.js
import { CLEAN_SKIP_LIMIT } from './config.js';

const suppressMap = new Map(); // key -> Map<id,count>
const supKey = (assetId, slot) => `${assetId}:${slot}`;

export function filterSuppressed(assetId, slot, ids) {
  const key = supKey(assetId, slot);
  const m = suppressMap.get(key);
  if (!m) return ids;
  return ids.filter(id => (m.get(id) || 0) < CLEAN_SKIP_LIMIT);
}

export function incSuppression(assetId, slot, ids) {
  const key = supKey(assetId, slot);
  let m = suppressMap.get(key);
  if (!m) { m = new Map(); suppressMap.set(key, m); }
  for (const id of ids) m.set(id, (m.get(id)||0) + 1);
}

export function clearSuppression(assetId, slot, ids) {
  const key = supKey(assetId, slot);
  const m = suppressMap.get(key);
  if (!m) return;
  for (const id of ids) m.delete(id);
}

export function getSuppressionMap() { return suppressMap; }
