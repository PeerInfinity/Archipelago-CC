/**
 * Don't retry an attempt that ran out of the in-app budget.
 *
 * On CI Playwright retries a failed test twice (playwright.config.js
 * `retries`). The whole in-app roster is ONE Playwright test, so a retry
 * re-runs every row against the same wall-clock budget
 * (testLogic.js AUTO_START_TIMEOUT_MS) — an attempt that ran out of budget
 * runs out again. Three 10-minute attempts exceeded the 30-minute job cap on
 * every full-roster substrates run from 2026-09-11 to 2026-09-27, and the
 * cancelled job read as a 17-minute hang because `gh run view --log` cuts that
 * step's log off inside the first attempt's results dump. (The full job log
 * — `gh api repos/<o>/<r>/actions/jobs/<id>/logs` — shows all three attempts.)
 *
 * An attempt that ran out of budget leaves a marker; a retry in the SAME
 * Playwright run that finds it fails at once, naming why, instead of running
 * the roster again. Every other failure still retries as before.
 *
 * "The same Playwright run" is the runner process: every worker (a retry
 * always gets a fresh one) is its child, so the key is the worker's ppid.
 */
import * as fs from 'fs';
import * as path from 'path';

export const MARKER_FILE = '.budget-expired.json';

export function markerPath(dir) {
  return path.join(dir, MARKER_FILE);
}

/** True when these in-app results say the runner stopped on its budget. */
export function ranOutOfBudget(results) {
  return results?.summary?.timedOut === true;
}

/** Record an attempt that ran out of budget. */
export function recordBudgetExpiry({ dir, runnerPid, testTitle, retry, summary }) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    markerPath(dir),
    JSON.stringify({
      runnerPid,
      testTitle,
      retry,
      timeoutMs: summary?.timeoutMs ?? null,
      totalRun: summary?.totalRun ?? null,
      enabledCount: summary?.enabledCount ?? null,
      at: new Date().toISOString(),
    }, null, 2)
  );
}

/** Forget any marker — a first attempt starts clean. */
export function clearBudgetExpiry(dir) {
  fs.rmSync(markerPath(dir), { force: true });
}

/**
 * The marker left by an earlier attempt of this test in this Playwright run,
 * or null. A marker from another run (a different runner pid) or another test
 * does not count: it is stale, not evidence.
 */
export function earlierBudgetExpiry({ dir, runnerPid, testTitle }) {
  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath(dir), 'utf8'));
  } catch {
    return null;
  }
  if (marker?.runnerPid !== runnerPid || marker?.testTitle !== testTitle) return null;
  return marker;
}

/** The message a refused retry fails with. */
export function refusedRetryMessage(marker, retry) {
  const budget = marker.timeoutMs != null ? `${marker.timeoutMs / 1000}s` : 'its';
  const roster = marker.totalRun != null && marker.enabledCount != null
    ? ` after ${marker.totalRun}/${marker.enabledCount} tests`
    : '';
  const attempt = marker.retry === 0 ? 'the first attempt' : `retry #${marker.retry}`;
  return (
    `NOT RETRIED (retry #${retry}): ${attempt} ran out of the in-app budget (${budget})${roster} — `
    + 'a retry runs the same roster against the same budget and cannot finish either. '
    + 'See "IN-APP RUN DID NOT FINISH ITS ROSTER" above; split the roster (--batch) instead.'
  );
}
