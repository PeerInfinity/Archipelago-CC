/**
 * What app.spec.js prints about an in-app run — a SUMMARY, not the results.
 *
 * The spec used to print the whole `window.__playwrightTestResults__` (every
 * row's conditions and logs) into the log: 1–3 MB per run on CI, where the
 * GitHub log viewer cuts a step off mid-dump and loses its verdict (trap
 * 1439). Everything in that payload is in the results file the spec writes
 * (test-results/in-app-tests/test-results-*.json, the payload plus the
 * mode/batch/testIds/flavour stamps and, from run-tests.js, frozen/treeMoved),
 * so the log carries one line per row, the totals, the page's errors and the
 * path of that file.
 *
 * Pure: results in, lines out. The spec does the printing.
 */

import { HANDLER_ERROR_PHRASE } from '../../frontend/app/core/eventBusMessages.js';

export { HANDLER_ERROR_PHRASE };

function seconds(ms) {
  return ms != null ? `${(ms / 1000).toFixed(1)}s` : '-';
}

/** Log entries a row recorded at error/warn level (its `logs[].type`). */
function flaggedLogCounts(row) {
  let errors = 0;
  let warnings = 0;
  for (const entry of row.logs || []) {
    if (entry?.type === 'error') errors += 1;
    else if (entry?.type === 'warn') warnings += 1;
  }
  return { errors, warnings };
}

/**
 * One line per row (`STATUS id duration`), the totals, the page's errors and
 * where the full results are.
 *
 * @param {object} results - `__playwrightTestResults__` ({ summary, testDetails })
 * @param {object} [opts]
 * @param {string|null} [opts.resultsFile] - where the spec saved the full results
 * @param {string|null} [opts.saveError] - why saving them failed, if it did
 * @param {number} [opts.consoleErrors] - `console.error` messages the page logged
 * @param {string[]} [opts.pageErrors] - uncaught exceptions the page threw
 * @param {object|null} [opts.handlerErrors] - `handlerErrorVerdict(...)`, when counted
 * @returns {string[]}
 */
export function formatInAppSummary(results, {
  resultsFile = null, saveError = null, consoleErrors = 0, pageErrors = [], handlerErrors = null,
} = {}) {
  const rows = results?.testDetails || [];
  const s = results?.summary || {};
  const width = Math.max(0, ...rows.map((r) => String(r.status || '?').length));
  const lines = [`PW DEBUG: ===== IN-APP RESULTS: ${rows.length} row(s) =====`];

  for (const row of rows) {
    const status = String(row.status || '?').toUpperCase().padEnd(width);
    const { errors, warnings } = flaggedLogCounts(row);
    const flags = [
      errors ? `${errors} error log(s)` : null,
      warnings ? `${warnings} warn log(s)` : null,
    ].filter(Boolean);
    lines.push(`  ${status} ${row.id ?? row.name} ${seconds(row.durationMs)}`
      + (flags.length ? `  [${flags.join(', ')}]` : ''));
  }

  const totals = [
    `${s.totalRun ?? '?'} run`,
    `${s.passedCount ?? '?'} passed`,
    `${s.failedCount ?? '?'} failed`,
  ];
  if (s.skippedCount != null) totals.push(`${s.skippedCount} skipped`);
  if (s.enabledCount != null) totals.push(`${s.enabledCount} enabled`);
  if (s.notRunCount != null) totals.push(`${s.notRunCount} not run`);
  if (s.failedConditionsCount) totals.push(`${s.failedConditionsCount} failed condition(s)`);
  lines.push(`  totals: ${totals.join(' · ')}`);
  if (s.error) lines.push(`  runner error: ${s.error}`);
  // Absent only in payloads from before the field existed (or the spec's own
  // synthetic page-load failure); a count of 0 is printed, so it is checkable.
  if (Array.isArray(results?.importFailures)) {
    lines.push(`  test files: ${results.importFailures.length} failed to import`
      + (results.importFailures.length ? ' (their rows are MISSING from the roster above)' : ''));
  }

  lines.push(`  page: ${consoleErrors} console error(s) (each printed as a BROWSER LOG line),`
    + ` ${pageErrors.length} uncaught exception(s)`);
  for (const message of pageErrors) lines.push(`    UNCAUGHT: ${message}`);
  if (handlerErrors) {
    // Never quotes the phrase itself: a `grep -c` for it over the log must
    // count only the page's lines, as with the BROWSER LOG prefix above.
    lines.push(`  handler errors (subscribers that threw inside the event bus): ${handlerErrors.logged} in the log`
      + `, ${handlerErrors.pageCount ?? '?'} counted by the page's event bus`
      + (handlerErrors.failed ? ' — GATED, see "IN-APP HANDLER ERRORS" below' : ''));
  }

  if (resultsFile) {
    lines.push(`  full results (every row's conditions, logs, timestamps): ${resultsFile}`);
  } else {
    lines.push(`  full results NOT SAVED${saveError ? ` (${saveError})` : ''} — the rows above are all this run left`);
  }
  lines.push('PW DEBUG: =========================================');
  return lines;
}

/**
 * The failed rows and the conditions each died on — printed before the spec's
 * assertions throw, so a red run names its row without opening the file.
 *
 * @param {object} results - `__playwrightTestResults__`
 * @param {string} machine - the load snapshot at failure
 * @returns {string[]} empty when nothing failed
 */
export function formatFailedTests(results, machine) {
  const failedTests = (results?.testDetails || []).filter((t) => t.status === 'failed');
  if (failedTests.length === 0) return [];
  const lines = [`\nPW DEBUG: ===== ${failedTests.length} IN-APP TEST(S) FAILED =====`];
  lines.push(`  machine at failure: ${machine}`);
  for (const t of failedTests) {
    const secs = t.durationMs != null ? ` after ${(t.durationMs / 1000).toFixed(1)}s` : '';
    lines.push(`  FAILED: ${t.id ?? t.name}${secs}`);
    const failedConditions = (t.conditions || []).filter((c) => c.status === 'failed');
    for (const c of failedConditions) {
      lines.push(`    condition: ${c.description}`);
    }
    if (failedConditions.length === 0) {
      lines.push('    (no failed condition recorded — the test died before asserting)');
    }
  }
  lines.push('PW DEBUG: =========================================\n');
  return lines;
}

/**
 * Test files that threw on import — their rows never registered, so no row
 * above can show them. Printed before the spec's assertions throw.
 *
 * @param {object} results - `__playwrightTestResults__`
 * @returns {string[]} empty when every test file imported
 */
export function formatImportFailures(results) {
  const failures = results?.importFailures || [];
  if (failures.length === 0) return [];
  const lines = [`\nPW DEBUG: ===== ${failures.length} TEST FILE(S) FAILED TO IMPORT =====`];
  for (const f of failures) {
    lines.push(`  FAILED TO IMPORT: ${f.file}`);
    lines.push(`    error: ${f.error}`);
  }
  lines.push('  NOTE: every row these files define is absent from the roster — a green roster is not a pass.');
  lines.push('PW DEBUG: =========================================\n');
  return lines;
}

/**
 * Attributes the event bus's "a subscriber threw" lines to the in-app rows
 * that produced them, from the browser log alone.
 *
 * The runner is sequential and prints `[PROGRESS i/n] <id> <STATUS>` when a
 * row FINISHES (testLogic.js logTestProgress), so every line between two
 * markers belongs to the row the second one names. A line with no marker
 * after it came from outside any finished row — the boot before the first
 * row, the runner's teardown, or a row cut off mid-flight.
 *
 * Feed it every browser console line's text and type, in order. Only
 * `error`-type lines count: the bus logs through `console.error`, and a row
 * that merely MENTIONS the phrase (a condition naming what it guards) must
 * not trip the gate. The page's own tally (`handlerErrorVerdict`) catches a
 * line that never reached the log at all.
 */
export function createHandlerErrorLedger() {
  const rows = new Map(); // row id -> { count, first }
  let pending = [];
  let sawProgress = false;
  return {
    observe(text, type = 'error') {
      if (typeof text !== 'string') return;
      const progress = /^\[PROGRESS \d+\/\d+\] (\S+)/.exec(text);
      if (progress) {
        sawProgress = true;
        if (pending.length > 0) {
          const row = rows.get(progress[1]) || { count: 0, first: pending[0] };
          row.count += pending.length;
          rows.set(progress[1], row);
          pending = [];
        }
        return;
      }
      if (type === 'error' && text.includes(HANDLER_ERROR_PHRASE)) pending.push(text);
    },
    /** [{ row, count, first }] — `row` null for lines no finished row claims. */
    entries() {
      const out = [...rows].map(([row, v]) => ({ row, count: v.count, first: v.first }));
      if (pending.length > 0) {
        out.push({ row: null, count: pending.length, first: pending[0], afterProgress: sawProgress });
      }
      return out;
    },
  };
}

/**
 * The gate's verdict: zero tolerance. `pageCount` is the page's own tally
 * (`eventBus.handlerErrorCount`); a page that counted MORE than the log
 * carried means the logger swallowed the line, which must not read as zero.
 *
 * @param {Array} entries - `ledger.entries()`
 * @param {number|null} pageCount - null when the page could not be asked
 */
export function handlerErrorVerdict(entries, pageCount = null) {
  const logged = entries.reduce((n, e) => n + e.count, 0);
  const unlogged = pageCount != null && pageCount > logged ? pageCount - logged : 0;
  return { logged, pageCount, unlogged, entries, failed: logged > 0 || unlogged > 0 };
}

/**
 * The block a red gate prints: which rows threw inside an event handler.
 * Empty when the verdict passed.
 *
 * @param {object} verdict - `handlerErrorVerdict(...)`
 * @returns {string[]}
 */
export function formatHandlerErrors(verdict) {
  if (!verdict?.failed) return [];
  // Like the summary line, this block never repeats the phrase — `first:`
  // drops it — so a grep over the log still counts only the page's lines.
  const threw = Math.max(verdict.logged, verdict.pageCount ?? 0);
  const lines = [`\nPW DEBUG: ===== IN-APP HANDLER ERRORS: ${threw} subscriber(s) threw inside the event bus`
    + ` (${verdict.logged} in the log) =====`];
  for (const e of verdict.entries) {
    const where = e.row != null
      ? `ROW: ${e.row}`
      : (e.afterProgress
        ? 'NO ROW (after the last finished row — the runner\'s end, or a row cut off mid-flight)'
        : 'NO ROW (before any row finished — the boot, or the first row cut off)');
    lines.push(`  ${where} — ${e.count}`);
    lines.push(`    first: ${String(e.first).split(HANDLER_ERROR_PHRASE).join('…')}`);
  }
  if (verdict.unlogged > 0) {
    lines.push(`  the page's event bus counted ${verdict.pageCount}, the log carried ${verdict.logged}:`
      + ` ${verdict.unlogged} line(s) never reached the log (a logger level or filter swallowed them)`);
  }
  lines.push('  NOTE: a subscriber threw and the bus caught it — the rows can be green; the run is not.');
  lines.push('PW DEBUG: =========================================\n');
  return lines;
}
