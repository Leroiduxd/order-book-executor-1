// fetcher.js
import 'dotenv/config';
import { API_BASE, VERIFY_BASE, RANGE_RATE } from './config.js';

export async function fetchRangeForPrice(assetId, priceHuman) {
  const from = priceHuman * (1 - RANGE_RATE);
  const to = priceHuman * (1 + RANGE_RATE);
  const url = `${API_BASE}/bucket/range?asset=${assetId}&from=${from}&to=${to}&types=orders,stops&side=all&sort=lots&order=desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Range API HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  const ORDERS = Array.isArray(data.items_orders) ? data.items_orders : [];
  const STOPS  = Array.isArray(data.items_stops)  ? data.items_stops  : [];

  const orderIds = uniqSortedIds(ORDERS.map(o => o.id));
  const stopsSL  = uniqSortedIds(STOPS.filter(s => String(s.type).toUpperCase()==='SL').map(s => s.id));
  const stopsTP  = uniqSortedIds(STOPS.filter(s => String(s.type).toUpperCase()==='TP').map(s => s.id));
  const stopsLIQ = uniqSortedIds(STOPS.filter(s => String(s.type).toUpperCase()==='LIQ').map(s => s.id));

  return { orderIds, stopsSL, stopsTP, stopsLIQ, raw: data };
}

export async function callVerify(ids) {
  if (!ids?.length) return null;
  const url = `${VERIFY_BASE}/verify/${ids.join(',')}`;
  try {
    const res = await fetch(url);
    const txt = await res.text().catch(()=> '');
    if (!res.ok) {
      console.warn(`[verify] HTTP ${res.status} ${res.statusText} :: ${txt}`);
      return null;
    }
    const json = JSON.parse(txt || '{}');
    return json; // {ok, checked, updated, mismatches}
  } catch (e) {
    console.warn(`[verify] error: ${e?.message || String(e)}`);
    return null;
  }
}

// helpers
function uniqSortedIds(arr) {
  return Array.from(new Set((arr||[]).map(Number))).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
}
