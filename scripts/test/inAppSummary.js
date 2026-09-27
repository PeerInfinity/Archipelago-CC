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
 * @returns {string[]}
 */
export function formatInAppSummary(results, {
  resultsFile = null, saveError = null, consoleErrors = 0, pageErrors = [],
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
