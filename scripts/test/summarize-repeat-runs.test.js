/**
 * summarize-repeat-runs.js — the repeat job's table: the RATE first, one line
 * per run with why it was not green and what the row logged about its target.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describeRun, formatRepeatSummary, loadRuns } from './summarize-repeat-runs.js';

const ROW = 'apworld-a-region-form-reads-back-the-initialise-bag';
const log = (message, type = 'info') => ({ message, type });

function results({ status = 'passed', durationMs = 5600, target = 'bounce', failedCondition = null, handler = 0, extraRows = [] } = {}) {
  const conditions = [{ description: `⛓ premise: a hooked target with a payload read-back (${target})`, status: 'passed' }];
  if (failedCondition) conditions.push({ description: failedCondition, status: 'failed' });
  const testDetails = [
    {
      id: ROW, status, durationMs, conditions,
      logs: [log(`Condition: "⛓ premise: a hooked target with a payload read-back (${target})" - PASSED`), log('unrelated line')],
    },
    ...extraRows,
  ];
  return {
    mode: 'test-substrates', flavour: 'unbundled', frozen: { head: '0123456789abcdef' },
    pageDiagnostics: { consoleErrors: 3, pageErrors: 0, handlerErrors: { logged: handler, pageCount: handler, rows: handler ? [{ row: ROW, count: handler }] : [] } },
    summary: { totalRun: testDetails.length, failedCount: testDetails.filter((r) => r.status === 'failed').length, notRunCount: 0 },
    testDetails,
  };
}

describe('describeRun', () => {
  it('a green solo: PASS, the row time, 0 handler errors, the target line', () => {
    const r = describeRun({ run: 1, exit: 0, seconds: 41 }, results());
    expect(r).toMatchObject({ pass: true, soloDurationMs: 5600, handlerErrors: 0, why: null });
    expect(r.targets).toEqual(['Condition: "⛓ premise: a hooked target with a payload read-back (bounce)" - PASSED']);
  });

  it('a red solo names the failing condition and still carries the target it drew', () => {
    const r = describeRun({ run: 2, exit: 1, seconds: 70 },
      results({ status: 'failed', durationMs: 30400, target: 'runner', failedCondition: 'the build succeeded' }));
    expect(r.pass).toBe(false);
    expect(r.why).toBe(`${ROW}: the build succeeded`);
    expect(r.targets[0]).toContain('(runner)');
  });

  it('a run red on handler errors alone says so — every row green, exit 1', () => {
    const r = describeRun({ run: 3, exit: 1, seconds: 40 }, results({ handler: 2 }));
    expect(r).toMatchObject({ pass: false, handlerErrors: 2 });
    expect(r.why).toBe(`handler errors: 2 logged (first: ${ROW})`);
  });

  it('a run that died before saving results is a FAIL that says so, not a skipped line', () => {
    const r = describeRun({ run: 4, exit: 1, seconds: 12 }, null);
    expect(r).toMatchObject({ pass: false, handlerErrors: null, rows: 0 });
    expect(r.why).toContain('no results file');
  });

  it('exit 0 with no results file is not a PASS — nothing says what ran', () => {
    const r = describeRun({ run: 6, exit: 0, seconds: 12 }, null);
    expect(r.pass).toBe(false);
    expect(r.why).toContain('no results file');
  });

  it('the verdict is the exit code: a clean-looking file with exit≠0 is not a PASS', () => {
    const r = describeRun({ run: 5, exit: 1, seconds: 40 }, results());
    expect(r).toMatchObject({ pass: false, why: 'exit 1' });
  });
});

describe('formatRepeatSummary', () => {
  const runs = [
    describeRun({ run: 1, exit: 0, seconds: 41 }, results()),
    describeRun({ run: 2, exit: 1, seconds: 70 }, results({ status: 'failed', target: 'runner', failedCondition: 'the build succeeded' })),
    describeRun({ run: 3, exit: 0, seconds: 39 }, results()),
  ];

  it('the FIRST line is the rate — a green job must never read as k = N', () => {
    const md = formatRepeatSummary(runs, { title: `test ${ROW}` });
    expect(md.split('\n')[0]).toBe(`**Rate: 2/3 passed** — test ${ROW}`);
  });

  it('one table line per run, in order, with verdict, wall, row time, handler errors, why and target', () => {
    const md = formatRepeatSummary(runs);
    const table = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    expect(table).toHaveLength(3);
    expect(table[0]).toMatch(/^\| 1 \| PASS \| 41s \| 5\.6s \| 0 \| {2}\| Condition: .*\(bounce\).* \|$/);
    expect(table[1]).toContain('| **FAIL** |');
    expect(table[1]).toContain('the build succeeded');
    expect(table[1]).toContain('(runner)');
  });

  it('names the rows that failed in any run, with their count — the flake table for a batch × N', () => {
    const md = formatRepeatSummary(runs);
    expect(md).toContain(`| ${ROW} | 1/3 | 2 |`);
  });

  it('a batch run shows rows passed/total instead of one row\'s time', () => {
    const other = { id: 'other-row', status: 'passed', durationMs: 10, conditions: [], logs: [] };
    const md = formatRepeatSummary([describeRun({ run: 1, exit: 0, seconds: 150 }, results({ extraRows: [other] }))]);
    expect(md).toContain('| run | verdict | wall | rows passed |');
    expect(md).toMatch(/\| 1 \| PASS \| 150s \| 2\/2 \|/);
  });

  it('in a batch, the target column carries only the FAILED rows\' lines', () => {
    const green = { id: 'green-row', status: 'passed', durationMs: 10, conditions: [], logs: [log('target: noise')] };
    const r = describeRun({ run: 1, exit: 1, seconds: 150 },
      results({ status: 'failed', target: 'runner', failedCondition: 'the build succeeded', extraRows: [green] }));
    expect(r.targets).toHaveLength(1);
    expect(r.targets[0]).toMatch(new RegExp(`^${ROW}: .*\\(runner\\)`));
    const allGreen = describeRun({ run: 2, exit: 0, seconds: 150 }, results({ extraRows: [green] }));
    expect(allGreen.targets).toEqual([]);
  });

  it('escapes a pipe in a condition so the table keeps its columns', () => {
    const md = formatRepeatSummary([describeRun({ run: 1, exit: 1, seconds: 1 },
      results({ status: 'failed', failedCondition: 'a | b' }))]);
    expect(md).toContain('a \\| b');
  });

  it('no runs at all is a 0/0 that says the loop never ran', () => {
    const md = formatRepeatSummary([]);
    expect(md.split('\n')[0]).toBe('**Rate: 0/0 passed**');
    expect(md).toContain('did not reach its loop');
  });
});

describe('loadRuns reads the directory the workflow fills', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'repeat-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('orders by run index numerically (10 after 9), and a missing or broken results file is a FAIL', () => {
    for (const i of [1, 2, 9, 10]) writeFileSync(path.join(dir, `run-${i}.meta.json`), JSON.stringify({ exit: i === 2 ? 1 : 0, seconds: i }));
    for (const i of [1, 9, 10]) writeFileSync(path.join(dir, `run-${i}.json`), JSON.stringify(results()));
    writeFileSync(path.join(dir, 'run-2.json'), '{ truncated');
    const runs = loadRuns(dir);
    expect(runs.map((r) => r.run)).toEqual([1, 2, 9, 10]);
    expect(runs.map((r) => r.pass)).toEqual([true, false, true, true]);
    expect(runs[1].why).toContain('no results file');
  });
});
