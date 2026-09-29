/**
 * inAppSummary.js — what app.spec.js prints in place of the full results dump,
 * and analyze-test-results.js, which used to parse that dump out of
 * playwright-report.json and now reads the results file the spec names.
 *
 * Fixtures: a green run, a run with a failed row (conditions, a row that died
 * before asserting, error logs), and a run that ran out of its budget (a row
 * cut off mid-test, rows never started).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createHandlerErrorLedger, formatFailedTests, formatHandlerErrors, formatImportFailures,
  formatInAppSummary, HANDLER_ERROR_PHRASE, handlerErrorVerdict,
} from './inAppSummary.js';
import { handlerErrorMessage } from '../../frontend/app/core/eventBusMessages.js';
import { EventBus } from '../../frontend/app/core/eventBus.js';
import { extractInAppTestResults } from './analyze-test-results.js';

const row = (id, status, durationMs, extra = {}) => ({
  id, name: id, status, category: 'Core', durationMs, conditions: [], logs: [], ...extra,
});

const GREEN = {
  summary: { totalRun: 2, passedCount: 2, failedCount: 0, failedConditionsCount: 0, enabledCount: 2, notRunCount: 0, notRunIds: [] },
  testDetails: [row('row-a', 'passed', 1500), row('row-b', 'passed', 3)],
};

const RED = {
  summary: { totalRun: 3, passedCount: 1, failedCount: 2, failedConditionsCount: 1, enabledCount: 3, notRunCount: 0, notRunIds: [] },
  testDetails: [
    row('row-a', 'passed', 1500),
    row('row-bad', 'failed', 12345, {
      conditions: [
        { description: 'panel opened', status: 'passed' },
        { description: 'readout says 7 (got 6)', status: 'failed' },
      ],
      logs: [
        { message: 'boom', type: 'error' },
        { message: 'hmm', type: 'warn' },
        { message: 'data, not a level', type: ['publish'] },
      ],
    }),
    row('row-died', 'failed', null),
  ],
};

const TIMED_OUT = {
  summary: {
    totalRun: 2, passedCount: 1, failedCount: 0, failedConditionsCount: 0,
    error: 'Auto-start timeout after 60 seconds', timedOut: true, timeoutMs: 60000,
    enabledCount: 4, notRunCount: 3, notRunIds: ['row-mid', 'row-x', 'row-y'],
  },
  testDetails: [row('row-a', 'passed', 900), row('row-mid', 'running', 4200)],
};

describe('formatInAppSummary', () => {
  it('prints one STATUS id duration line per row, the totals and the results path', () => {
    const lines = formatInAppSummary(GREEN, { resultsFile: '/r/test-results-X.json' });
    expect(lines).toEqual([
      'PW DEBUG: ===== IN-APP RESULTS: 2 row(s) =====',
      '  PASSED row-a 1.5s',
      '  PASSED row-b 0.0s',
      '  totals: 2 run · 2 passed · 0 failed · 2 enabled · 0 not run',
      '  page: 0 console error(s) (each printed as a BROWSER LOG line), 0 uncaught exception(s)',
      "  full results (every row's conditions, logs, timestamps): /r/test-results-X.json",
      'PW DEBUG: =========================================',
    ]);
  });

  it('flags a row\'s error/warn logs and pads the status column', () => {
    const lines = formatInAppSummary(RED, { resultsFile: 'f.json' });
    expect(lines.slice(1, 4)).toEqual([
      '  PASSED row-a 1.5s',
      '  FAILED row-bad 12.3s  [1 error log(s), 1 warn log(s)]',
      '  FAILED row-died -',
    ]);
    expect(lines).toContain('  totals: 3 run · 1 passed · 2 failed · 3 enabled · 0 not run · 1 failed condition(s)');
  });

  it('shows a budget-expired run: the row cut off, the not-run count, the runner error', () => {
    const lines = formatInAppSummary(TIMED_OUT, { resultsFile: 'f.json' });
    expect(lines).toContain('  RUNNING row-mid 4.2s');
    expect(lines).toContain('  PASSED  row-a 0.9s');
    expect(lines).toContain('  totals: 2 run · 1 passed · 0 failed · 4 enabled · 3 not run');
    expect(lines).toContain('  runner error: Auto-start timeout after 60 seconds');
  });

  it('surfaces page errors even when every row passed', () => {
    const lines = formatInAppSummary(GREEN, {
      resultsFile: 'f.json', consoleErrors: 2, pageErrors: ['TypeError: x is undefined'],
    });
    expect(lines).toContain('  page: 2 console error(s) (each printed as a BROWSER LOG line), 1 uncaught exception(s)');
    expect(lines).toContain('    UNCAUGHT: TypeError: x is undefined');
  });

  it('never quotes the BROWSER LOG (error) prefix — a grep -c for it must count only the page\'s lines', () => {
    const lines = formatInAppSummary(RED, { resultsFile: 'f.json', consoleErrors: 3, pageErrors: ['x'] });
    expect(lines.filter((l) => l.includes('BROWSER LOG (error)'))).toEqual([]);
  });

  it('says so when the results file was not saved — the summary is then all there is', () => {
    const lines = formatInAppSummary(GREEN, { saveError: 'EACCES' });
    expect(lines).toContain('  full results NOT SAVED (EACCES) — the rows above are all this run left');
  });

  it('stays small: a 200-row run is well under 20 KB (the dump was 1–3 MB)', () => {
    const big = {
      summary: { totalRun: 200, passedCount: 200, failedCount: 0 },
      testDetails: Array.from({ length: 200 }, (_, i) => row(`apworld-some-long-row-name-number-${i}`, 'passed', 1234, {
        logs: Array.from({ length: 50 }, () => ({ message: 'x'.repeat(200), type: 'info' })),
      })),
    };
    const bytes = Buffer.byteLength(formatInAppSummary(big, { resultsFile: 'f.json' }).join('\n'));
    expect(bytes).toBeLessThan(20000);
  });
});

describe('formatFailedTests', () => {
  it('is empty for a green run', () => {
    expect(formatFailedTests(GREEN, 'load 1')).toEqual([]);
  });

  it('names each failed row with its failed conditions, or says it died before asserting', () => {
    expect(formatFailedTests(RED, 'load 3.00 across 8 cpus')).toEqual([
      '\nPW DEBUG: ===== 2 IN-APP TEST(S) FAILED =====',
      '  machine at failure: load 3.00 across 8 cpus',
      '  FAILED: row-bad after 12.3s',
      '    condition: readout says 7 (got 6)',
      '  FAILED: row-died',
      '    (no failed condition recorded — the test died before asserting)',
      'PW DEBUG: =========================================\n',
    ]);
  });

  it('names a row by its name when it has no id (the spec\'s synthetic "Page Load" row)', () => {
    const noStart = { summary: { failedCount: 1 }, testDetails: [{ name: 'Page Load', status: 'failed', message: 'x' }] };
    expect(formatFailedTests(noStart, 'load 1')).toContain('  FAILED: Page Load');
    expect(formatInAppSummary(noStart)).toContain('  FAILED Page Load -');
  });
});

// Every row green, one test file that never imported (slice C6).
const IMPORT_FAILED = {
  ...GREEN,
  summary: { ...GREEN.summary, importFailureCount: 1 },
  importFailures: [{ file: './testCases/brokenTests.js', error: "SyntaxError: Unexpected token ';'" }],
};

describe('formatImportFailures (test files that failed to import)', () => {
  it('is empty when every file imported, or the payload predates the field', () => {
    expect(formatImportFailures({ ...GREEN, importFailures: [] })).toEqual([]);
    expect(formatImportFailures(GREEN)).toEqual([]);
  });

  it('names each file and its error, and says a green roster is not a pass', () => {
    expect(formatImportFailures(IMPORT_FAILED)).toEqual([
      '\nPW DEBUG: ===== 1 TEST FILE(S) FAILED TO IMPORT =====',
      '  FAILED TO IMPORT: ./testCases/brokenTests.js',
      "    error: SyntaxError: Unexpected token ';'",
      '  NOTE: every row these files define is absent from the roster — a green roster is not a pass.',
      'PW DEBUG: =========================================\n',
    ]);
  });

  it('the summary counts them — 0 printed too, and no line for a payload without the field', () => {
    expect(formatInAppSummary(IMPORT_FAILED)).toContain(
      '  test files: 1 failed to import (their rows are MISSING from the roster above)');
    expect(formatInAppSummary({ ...GREEN, importFailures: [] })).toContain('  test files: 0 failed to import');
    expect(formatInAppSummary(GREEN).some((l) => l.includes('test files:'))).toBe(false);
  });
});

describe('analyze-test-results.js reads the results file the spec names', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'in-app-summary-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const report = (texts) => ({
    suites: [{ suites: [{ specs: [{ tests: [{ results: [{ stdout: texts.map((text) => ({ text })) }] }] }] }] }],
  });

  it('follows "Test results saved to:" to the file', () => {
    const file = path.join(dir, 'test-results-X.json');
    writeFileSync(file, JSON.stringify({ mode: 'test-spoilers', ...RED }));
    const got = extractInAppTestResults(report(['noise\n', `PW DEBUG: Test results saved to: ${file}\n`]));
    expect(got.summary.failedCount).toBe(2);
    expect(got.testDetails[1].conditions[1].description).toBe('readout says 7 (got 6)');
  });

  it('still reads an older report that carries the payload inline', () => {
    const got = extractInAppTestResults(report([`PW DEBUG: Full in-app test results: ${JSON.stringify(GREEN, null, 2)}\n`]));
    expect(got.summary.passedCount).toBe(2);
  });

  it('returns null when the report names neither', () => {
    expect(extractInAppTestResults(report(['PW DEBUG: nothing here\n']))).toBeNull();
  });
});

describe('the handler-error gate (plan §48: zero tolerance for a subscriber that threw)', () => {
  // The bus's own line, built by the bus's own function — never typed here.
  const busLine = (event, mod) => `[ERROR] [eventBus] ${handlerErrorMessage(event, mod)} Error: boom`;
  const feed = (lines) => {
    const ledger = createHandlerErrorLedger();
    for (const [text, type] of lines) ledger.observe(text, type);
    return ledger;
  };

  it('the phrase is the bus\'s: a subscriber that throws logs a line carrying it, and the bus counts it', () => {
    const bus = new EventBus();
    const seen = [];
    const orig = console.error;
    console.error = (...args) => { seen.push(String(args[0])); };
    try {
      bus.registerPublisher('ev', 'pub');
      bus.subscribe('ev', () => { throw new Error('boom'); }, 'sub');
      bus.publish('ev', {}, 'pub');
    } finally {
      console.error = orig;
    }
    expect(bus.handlerErrorCount).toBe(1);
    expect(seen.filter((l) => l.includes(HANDLER_ERROR_PHRASE))).toHaveLength(1);
  });

  it('attributes each line to the row whose [PROGRESS marker follows it', () => {
    const ledger = feed([
      ['boot line', 'log'],
      [busLine('a:x', 'm1'), 'error'],
      ['[PROGRESS 1/3] row-one PASSED 1.0s', 'log'],
      ['[PROGRESS 2/3] row-two PASSED 1.0s', 'log'],
      [busLine('b:y', 'm2'), 'error'],
      [busLine('b:y', 'm3'), 'error'],
      ['[PROGRESS 3/3] row-three FAILED 2.0s', 'log'],
    ]);
    expect(ledger.entries().map((e) => [e.row, e.count])).toEqual([['row-one', 1], ['row-three', 2]]);
    const v = handlerErrorVerdict(ledger.entries(), 3);
    expect(v).toMatchObject({ logged: 3, unlogged: 0, failed: true });
    const block = formatHandlerErrors(v);
    expect(block).toContain('  ROW: row-one — 1');
    expect(block).toContain('  ROW: row-three — 2');
    expect(block.join('\n')).not.toContain('row-two');
  });

  it('a clean run: no block, the verdict passes, and the summary prints the 0 so it is checkable', () => {
    const ledger = feed([['[PROGRESS 1/1] row-one PASSED 1.0s', 'log']]);
    const v = handlerErrorVerdict(ledger.entries(), 0);
    expect(v.failed).toBe(false);
    expect(formatHandlerErrors(v)).toEqual([]);
    const lines = formatInAppSummary(GREEN, { resultsFile: 'f.json', handlerErrors: v });
    expect(lines).toContain('  handler errors (subscribers that threw inside the event bus): 0 in the log, 0 counted by the page\'s event bus');
  });

  it('a line no finished row claims is still counted — before the first row, or after the last', () => {
    const boot = feed([[busLine('e', 'm'), 'error'], ['[PROGRESS 1/1] r PASSED 1s', 'log']]);
    expect(boot.entries()[0].row).toBe('r');
    const cut = feed([['[PROGRESS 1/2] r PASSED 1s', 'log'], [busLine('e', 'm'), 'error']]);
    expect(cut.entries()).toEqual([expect.objectContaining({ row: null, count: 1, afterProgress: true })]);
    expect(formatHandlerErrors(handlerErrorVerdict(cut.entries())).join('\n')).toContain('after the last finished row');
    const none = feed([[busLine('e', 'm'), 'error']]);
    expect(formatHandlerErrors(handlerErrorVerdict(none.entries())).join('\n')).toContain('before any row finished');
  });

  it('counts only error-type lines: a row that MENTIONS the phrase at log level does not trip it', () => {
    const ledger = feed([[`condition: no ${HANDLER_ERROR_PHRASE} seen`, 'log'], ['[PROGRESS 1/1] r PASSED 1s', 'log']]);
    expect(handlerErrorVerdict(ledger.entries(), 0).failed).toBe(false);
  });

  it('the page counted more than the log carried: a swallowed line fails the gate, never reads as zero', () => {
    const v = handlerErrorVerdict([], 2);
    expect(v).toMatchObject({ logged: 0, unlogged: 2, failed: true });
    expect(formatHandlerErrors(v).join('\n')).toContain('2 line(s) never reached the log');
    // The header counts what the BUS saw, not only what the log carried.
    expect(formatHandlerErrors(v)[0]).toContain('IN-APP HANDLER ERRORS: 2 subscriber(s) threw inside the event bus (0 in the log)');
    // An unknown page count (the bus was never built) is not a failure by itself.
    expect(handlerErrorVerdict([], null).failed).toBe(false);
  });

  it('never repeats the phrase in the summary or the block — a grep -c over the log counts only the page\'s lines', () => {
    const ledger = feed([[busLine('a', 'm'), 'error'], ['[PROGRESS 1/1] r PASSED 1s', 'log']]);
    const v = handlerErrorVerdict(ledger.entries(), 1);
    const printed = [...formatInAppSummary(RED, { resultsFile: 'f.json', handlerErrors: v }), ...formatHandlerErrors(v)];
    expect(printed.filter((l) => l.includes(HANDLER_ERROR_PHRASE))).toEqual([]);
    expect(printed.join('\n')).toContain('first: [ERROR] [eventBus] … a (module: m): Error: boom');
  });
});
