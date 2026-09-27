import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clearBudgetExpiry, earlierBudgetExpiry, markerPath, ranOutOfBudget,
  recordBudgetExpiry, refusedRetryMessage,
} from './budgetRetryGuard.js';

const TITLE = 'run in-app tests and check results';
const SUMMARY = { timedOut: true, timeoutMs: 600000, totalRun: 90, enabledCount: 197 };

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-guard-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('ranOutOfBudget', () => {
  it('is true only for the budget case', () => {
    expect(ranOutOfBudget({ summary: { timedOut: true } })).toBe(true);
    expect(ranOutOfBudget({ summary: { timedOut: false, error: 'boom' } })).toBe(false);
    expect(ranOutOfBudget({ summary: { failedCount: 3 } })).toBe(false);
    expect(ranOutOfBudget(undefined)).toBe(false);
  });
});

describe('the marker', () => {
  it('a retry in the same run finds what the attempt recorded', () => {
    recordBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE, retry: 0, summary: SUMMARY });
    const m = earlierBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE });
    expect(m).toMatchObject({ runnerPid: 111, retry: 0, timeoutMs: 600000, totalRun: 90, enabledCount: 197 });
  });

  it('a marker from ANOTHER Playwright run is stale, not evidence', () => {
    recordBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE, retry: 0, summary: SUMMARY });
    expect(earlierBudgetExpiry({ dir, runnerPid: 222, testTitle: TITLE })).toBeNull();
  });

  it('a marker from another test does not refuse this one', () => {
    recordBudgetExpiry({ dir, runnerPid: 111, testTitle: 'other', retry: 0, summary: SUMMARY });
    expect(earlierBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE })).toBeNull();
  });

  it('no marker, or an unreadable one, means retry as usual', () => {
    expect(earlierBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE })).toBeNull();
    fs.writeFileSync(markerPath(dir), '{not json');
    expect(earlierBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE })).toBeNull();
  });

  it('clear removes it, and clearing nothing is fine', () => {
    recordBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE, retry: 0, summary: SUMMARY });
    clearBudgetExpiry(dir);
    expect(fs.existsSync(markerPath(dir))).toBe(false);
    expect(() => clearBudgetExpiry(dir)).not.toThrow();
  });
});

describe('refusedRetryMessage', () => {
  it('names the retry, the attempt, the budget and the roster', () => {
    recordBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE, retry: 0, summary: SUMMARY });
    const msg = refusedRetryMessage(earlierBudgetExpiry({ dir, runnerPid: 111, testTitle: TITLE }), 1);
    expect(msg).toBe(
      'NOT RETRIED (retry #1): the first attempt ran out of the in-app budget (600s) after 90/197 tests — '
      + 'a retry runs the same roster against the same budget and cannot finish either. '
      + 'See "IN-APP RUN DID NOT FINISH ITS ROSTER" above; split the roster (--batch) instead.'
    );
  });
});
