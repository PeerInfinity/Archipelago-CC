/**
 * ciExpectedRed — **THE EXPECTED-RED JUDGE, ASKED WITHOUT A RUNNER** (Seedling
 * fidelity, slice GATESUBJ — D4).
 *
 * Every input is a battery log's text, a table and a set of CI keys — no
 * network, no box. The log lines are the exact shape `ci-gates.mjs` prints,
 * with the Actions timestamp prefix a downloaded job log carries.
 */

import { describe, expect, it } from 'vitest';

import { CI_GATE_EXPECTED_RED, formatJudgement, judgeExpectedRed } from './ciExpectedRed.js';
import { ciGateArms } from './ciGatePlan.js';

const line = (key, value, exit, total = '(no total)') =>
    `2026-10-21T03:48:58.0903547Z ## CI-GATE | ${key} | ${value} | exit=${exit} | ${total}`;
const TABLE = Object.freeze({
    'gate: owed': { owner: 'arc-x', why: 'owed', since: 'abc' },
    'gate: elsewhere': { owner: 'arc-y', why: 'sibling', since: 'abc' },
});
const KNOWN = ['gate: owed', 'gate: elsewhere', 'gate: fine', 'gate: broken'];
const verdicts = (j) => Object.fromEntries(j.rows.map((r) => [r.key, r.verdict]));

describe('judgeExpectedRed', () => {
    it('a red arm the table does not name is UNEXPECTED-RED, and the judge is red', () => {
        const j = judgeExpectedRed([line('gate: fine', '3/0', 0), line('gate: broken', '2/1', 1)]
            .join('\n'), TABLE, KNOWN);
        expect(verdicts(j)['gate: broken']).toBe('UNEXPECTED-RED');
        expect(j.red).toBe(1);
        expect(formatJudgement(j)).toContain('## EXPECTED-RED | UNEXPECTED-RED | gate: broken |');
    });

    it('a red arm the table names passes, with its owner on the line', () => {
        const j = judgeExpectedRed(line('gate: owed', '0/0', 1), TABLE, KNOWN);
        expect(verdicts(j)['gate: owed']).toBe('EXPECTED-RED');
        expect(j.red).toBe(0);
        expect(formatJudgement(j)).toContain('owner arc-x');
    });

    it('a listed arm that is now GREEN is red — drop its entry', () => {
        const j = judgeExpectedRed(line('gate: owed', '4/0', 0), TABLE, KNOWN);
        expect(verdicts(j)['gate: owed']).toBe('NOW-GREEN');
        expect(j.red).toBe(1);
    });

    it('a listed arm this log does not carry is a sibling shard\'s, not a verdict', () => {
        const j = judgeExpectedRed(line('gate: fine', '3/0', 0), TABLE, KNOWN);
        expect(verdicts(j)['gate: elsewhere']).toBe('ELSEWHERE');
        expect(j.red).toBe(0);
    });

    it('a listed key no CI arm carries is STALE', () => {
        const j = judgeExpectedRed(line('gate: fine', '3/0', 0),
            { ...TABLE, 'gate: renamed-away': { owner: 'z', why: 'w', since: 's' } }, KNOWN);
        expect(verdicts(j)['gate: renamed-away']).toBe('STALE');
        expect(j.red).toBe(1);
    });

    it('a log with no gate line at all read nothing, and is red', () => {
        const j = judgeExpectedRed('## CI-PLANNED | 3 arm(s)\n', TABLE, KNOWN);
        expect(verdicts(j)['(battery)']).toBe('NO-GATE-LINES');
        expect(j.red).toBeGreaterThan(0);
    });

    it('an exit that does not parse is a red, never a green', () => {
        const j = judgeExpectedRed(line('gate: broken', '?', 'killed'), TABLE, KNOWN);
        expect(verdicts(j)['gate: broken']).toBe('UNEXPECTED-RED');
    });
});

describe('CI_GATE_EXPECTED_RED — the committed table', () => {
    it('every row names an owner, a why and a since', () => {
        for (const [key, e] of Object.entries(CI_GATE_EXPECTED_RED)) {
            expect(e.owner, key).toMatch(/\S/);
            expect(e.why, key).toMatch(/\S/);
            expect(e.since, key).toMatch(/\S/);
        }
    });

    it('every row is the key of a real CI arm (no stale licence)', () => {
        const keys = new Set(ciGateArms({ set: 'all' }).map((a) => a.key));
        for (const key of Object.keys(CI_GATE_EXPECTED_RED)) expect(keys.has(key), key).toBe(true);
    });
});
