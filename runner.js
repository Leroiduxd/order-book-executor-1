// ======== EXECUTOR LOG LISTENER → hits VERIFY on executed/skipped/closed ========
import fs from 'node:fs';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const EXECUTOR_LOG_PATH = process.env.EXECUTOR_LOG_PATH || ''; // optional
const EXECUTOR_TAIL = process.env.EXECUTOR_TAIL || '';         // optional command to run, e.g. "pm2 logs brokex-executor --raw"

// Reuse existing verifier
function verifyNow(ids) {
  const uniq = Array.from(new Set(ids.map(Number))).filter(Number.isFinite);
  if (!uniq.length) return;
  const url = `${VERIFY_BASE}/verify/${uniq.join(',')}`;
  fetch(url).catch(() => {});
  log(`[executor->verify] ping ${uniq.length} id(s): ${uniq.join(',')}`);
}

// Try to extract IDs from a log line
function extractIdsFromText(text) {
  // Priority: explicit ids=...
  const idsField = [...text.matchAll(/\bids?\s*=\s*([0-9,\s]+)/gi)]
    .map(m => m[1])
    .join(',');
  if (idsField) {
    return idsField
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n >= 0);
  }
  // Fallback: (rare) bracketed arrays like [8667, 8813]
  const bracket = text.match(/\[([\d,\s]+)\]/);
  if (bracket) {
    return bracket[1]
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n >= 0);
  }
  return [];
}

// Recognize the two signals
const RE_CLOSE  = /simulate\.closeBatch\(\d+\)\s*→\s*closed=\d+\s*\|\s*skipped=\d+/i;
const RE_EXEC   = /simulate\.execLimits\b.*?→\s*executed=\d+\s*\|\s*skipped=\d+/i;

// Stream a readable (stdin or file) line-by-line
function bindLogReadable(readable, label = 'stdin') {
  const rl = readline.createInterface({ input: readable });
  rl.on('line', (line) => {
    try {
      if (!line) return;
      if (RE_CLOSE.test(line) || RE_EXEC.test(line)) {
        const ids = extractIdsFromText(line);
        if (ids.length) verifyNow(ids);
        else log(`[executor->verify] matched but found no ids in line (${label})`);
      }
    } catch (e) {
      log('[executor->verify] parse error:', e?.message || String(e));
    }
  });
  rl.on('close', () => log(`[executor->verify] reader closed (${label})`));
}

// Start listening:
// 1) If EXECUTOR_TAIL is provided, we spawn that command and parse its stdout.
// 2) Else if EXECUTOR_LOG_PATH is provided, we tail-append the file.
// 3) Else, we listen to process.stdin (so you can pipe pm2 logs into this script).
(function startExecutorLogListener() {
  try {
    if (EXECUTOR_TAIL) {
      const [bin, ...args] = EXECUTOR_TAIL.split(/\s+/);
      const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      log(`[executor->verify] tailing via spawn: ${EXECUTOR_TAIL}`);
      bindLogReadable(child.stdout, 'spawn');
      child.stderr.on('data', d => log('[executor->verify][stderr]', String(d).trim()));
      return;
    }

    if (EXECUTOR_LOG_PATH) {
      log(`[executor->verify] tailing file: ${EXECUTOR_LOG_PATH}`);
      // naive tail - follow appends
      let position = 0;
      const readChunk = () => {
        fs.stat(EXECUTOR_LOG_PATH, (err, st) => {
          if (err || !st) return;
          if (st.size > position) {
            const stream = fs.createReadStream(EXECUTOR_LOG_PATH, { start: position, end: st.size - 1, encoding: 'utf8' });
            bindLogReadable(stream, 'file');
            position = st.size;
          }
        });
      };
      readChunk();
      fs.watch(EXECUTOR_LOG_PATH, { persistent: true }, readChunk);
      return;
    }

    // default: stdin
    if (!process.stdin.isTTY) {
      log('[executor->verify] reading from stdin (pipe your executor logs here)');
      bindLogReadable(process.stdin, 'stdin');
    } else {
      log('[executor->verify] no EXECUTOR_TAIL/EXECUTOR_LOG_PATH and stdin is TTY — executor log listener idle');
    }
  } catch (e) {
    log('[executor->verify] init error:', e?.message || String(e));
  }
})();

