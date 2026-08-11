import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    TRACE_VERSION, TRACE_ROW_REQUIRED, TRACE_ROW_OPTIONAL, TRACE_REQUIRED, SAW_REQUIRED,
    KNOWN_GOAL_KINDS, KNOWN_STRATEGY_VERBS,
    parseDecisionTrace, assertTraceRow, createTraceBuilder, summarizeTrace,
    formatTraceRow, traceTapeAgreementFindings, assertTraceMatchesTape,
    deathJumpFindings, assertTraceIsSidecarOnly, traceSidecarName, DecisionTraceError,
} from './decisionTrace.js';
import { loadTape } from './fixtures/index.js';
import { GAME_VISIBLE_DROPS } from './tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'traces', 'diagonal-run.trace.json');

const loadFixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));

describe('the decision trace — the schema as a data contract (R8 slice 0 track C)', () => {
    it('parses the committed synthetic fixture', () => {
        const t = parseDecisionTrace(loadFixture(), 'fixture');
        expect(t.trace_version).toBe(TRACE_VERSION);
        expect(t.tape).toBe('diagonal-run');
        expect(t.rows.length).toBe(3);
    });

    /**
     * ⛔⛔ THE MUTATION LIST, WALKED MECHANICALLY OVER THE CONTRACT'S OWN
     * LISTS — not one hand-written case per field.
     *
     * "Every required field dropped in turn goes red BY NAME" is the charge;
     * a hand roster of cases beside `TRACE_ROW_REQUIRED` would be trap 89
     * exactly, and would silently stop covering a field added tomorrow. This
     * loops over the list itself, so the coverage is total by construction.
     */
    it('reddens BY NAME when any required ROW field is dropped', () => {
        const base = loadFixture().rows[0];
        for (const k of TRACE_ROW_REQUIRED) {
            const mutated = { ...base };
            delete mutated[k];
            expect(() => assertTraceRow(mutated, 0, 'mut'), `dropping ${k}`)
                .toThrow(new RegExp(`missing required field "${k}"`));
        }
    });

    it('reddens BY NAME when any required ENVELOPE field is dropped', () => {
        for (const k of TRACE_REQUIRED) {
            const mutated = loadFixture();
            delete mutated[k];
            expect(() => parseDecisionTrace(mutated, 'mut'), `dropping ${k}`)
                .toThrow(new RegExp(`missing required field "${k}"`));
        }
    });

    it('reddens BY NAME when any required `saw` field is dropped', () => {
        for (const k of SAW_REQUIRED) {
            const mutated = loadFixture();
            delete mutated.rows[0].saw[k];
            expect(() => parseDecisionTrace(mutated, 'mut'), `dropping saw.${k}`)
                .toThrow(new RegExp(`saw is missing "${k}"`));
        }
    });

    /**
     * ⛔ AN UNLISTED KEY IS A SILENCE, NOT AN ERROR — the lesson
     * `LIVE_GEOMETRY_KEYS` was written for, applied to a record instead of an
     * options bag. A field nobody reads would be written by a producer, read
     * by nothing, and reported by nothing.
     */
    it('refuses an unknown row field rather than ignoring it', () => {
        const mutated = loadFixture();
        mutated.rows[0].reasoning = 'a field nobody reads';
        expect(() => parseDecisionTrace(mutated, 'mut')).toThrow(/unknown field\(s\) reasoning/);
        expect(() => parseDecisionTrace(mutated, 'mut')).toThrow(/SILENCE/);
    });

    it('accepts every OPTIONAL field and requires none of them', () => {
        const base = loadFixture().rows[0];
        const bare = { ...base };
        for (const k of TRACE_ROW_OPTIONAL) delete bare[k];
        expect(() => assertTraceRow(bare, 0, 'bare')).not.toThrow();
        for (const k of TRACE_ROW_OPTIONAL) {
            const withIt = { ...bare, [k]: k === 'path' ? [{ x: 1, y: 2 }]
                : k === 'obstacle' ? { kind: 'pushable', id: 'b@1,2' } : 'a note' };
            expect(() => assertTraceRow(withIt, 0, 'opt'), k).not.toThrow();
        }
    });

    it('requires `rejected` to be present and lets it be EMPTY', () => {
        const base = loadFixture().rows[1];
        expect(base.rejected).toEqual([]);
        const without = { ...base };
        delete without.rejected;
        expect(() => assertTraceRow(without, 0, 'mut')).toThrow(/missing required field "rejected"/);
    });

    it('refuses a rejection with no reason — the one thing a trace exists to carry', () => {
        const mutated = loadFixture();
        mutated.rows[0].rejected[0] = { option: 'shove', why: '' };
        expect(() => parseDecisionTrace(mutated, 'mut')).toThrow(/must be \{option, why\}/);
    });

    it('refuses a key name the tape format does not know', () => {
        const mutated = loadFixture();
        mutated.rows[0].keys = ['right', 'jump'];
        expect(() => parseDecisionTrace(mutated, 'mut')).toThrow(/names "jump"/);
    });

    it('refuses out-of-order and out-of-range ticks — a trace is sparse but ordered', () => {
        const back = loadFixture();
        back.rows[1].tick = 0;
        expect(() => parseDecisionTrace(back, 'mut')).toThrow(/STRICTLY INCREASING/);
        const past = loadFixture();
        past.rows[2].tick = past.tick_count;
        expect(() => parseDecisionTrace(past, 'mut')).toThrow(/outside the trace's own/);
    });

    it('refuses a version it cannot read rather than half-reading it', () => {
        const mutated = loadFixture();
        mutated.trace_version = TRACE_VERSION + 1;
        expect(() => parseDecisionTrace(mutated, 'mut')).toThrow(/trace_version is/);
    });
});

describe('the trace is checked AGAINST its tape — what makes it a measurement', () => {
    it('agrees with the tape it names, key for key', () => {
        const trace = parseDecisionTrace(loadFixture(), 'fixture');
        const tape = loadTape('diagonal-run');
        const rows = traceTapeAgreementFindings(trace, tape);
        expect(rows.every((r) => r.ok), JSON.stringify(rows.filter((r) => !r.ok))).toBe(true);
        expect(() => assertTraceMatchesTape(trace, tape)).not.toThrow();
    });

    /**
     * ⛓ THE NON-VACUITY WITNESS. A key-agreement row that has never seen a
     * disagreement is a row that might be comparing nothing — R5's own lesson
     * about a readout that cannot see its channel. So the disagreement is
     * constructed and the row is watched going red.
     */
    it('goes RED when a row claims keys the tape did not hold on that tick', () => {
        const trace = parseDecisionTrace(loadFixture(), 'fixture');
        const tape = loadTape('diagonal-run');
        trace.rows[0].keys = ['left'];
        const rows = traceTapeAgreementFindings(trace, tape);
        const keyRow = rows.find((r) => r.name.includes("every row's keys"));
        expect(keyRow.ok).toBe(false);
        expect(keyRow.detail).toMatch(/tick 0: trace holds \[left\], the tape holds \[right up\]/);
        expect(() => assertTraceMatchesTape(trace, tape)).toThrow(/explaining a different run/);
    });

    it('goes RED when the trace names a different tape or a different length', () => {
        const tape = loadTape('diagonal-run');
        const wrongName = parseDecisionTrace(loadFixture(), 'f');
        wrongName.tape = 'straight-run';
        expect(traceTapeAgreementFindings(wrongName, tape)[0].ok).toBe(false);
        const wrongLen = parseDecisionTrace(loadFixture(), 'f');
        wrongLen.tick_count = 41;
        expect(traceTapeAgreementFindings(wrongLen, tape)[1].ok).toBe(false);
    });
});

describe('trap 142 graduates from the probes into the trace', () => {
    it('REPORTS the absence rather than staying silent', () => {
        const trace = parseDecisionTrace(loadFixture(), 'fixture');
        const [row] = deathJumpFindings(trace);
        expect(row.ok).toBe(true);
        expect(row.detail).toMatch(/REPORTED rather than silent/);
    });

    it('names a jump to the boot position with NO level change', () => {
        const trace = parseDecisionTrace(loadFixture(), 'fixture');
        // The tell: the run is at (98,110) and the next decision sees it back
        // at the boot tile, same level. `hits` would read 0 — the counter is
        // looking at the NEW Player.
        trace.rows[2].saw = { ...trace.rows[2].saw, x: 80, y: 128 };
        const [row] = deathJumpFindings(trace);
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/tick 30 \(from 98,110\)/);
        expect(row.detail).toMatch(/trap 142/);
    });
});

describe('the sidecar law, and the producer seam', () => {
    it('asserts the tape format never grew a trace field', () => {
        const tape = loadTape('diagonal-run');
        expect(assertTraceIsSidecarOnly(tape).sidecar).toBe(true);
        // ⛓ And GAME_VISIBLE_DROPS stays what it was: a classification list
        // for TAPE fields. A trace has no side of that line to be on.
        expect(GAME_VISIBLE_DROPS).toEqual(['persistence[].at', 'despawn']);
    });

    it('refuses a tape that carries a trace field', () => {
        expect(() => assertTraceIsSidecarOnly({ name: 'x', decisions: [] }))
            .toThrow(/is a SIDECAR/);
    });

    it('names the sidecar file one way, in one place', () => {
        expect(traceSidecarName('r8-solver-l4')).toBe('r8-solver-l4.trace.json');
        expect(() => traceSidecarName('')).toThrow(DecisionTraceError);
    });

    /**
     * The seam slice 2's solver consumes. `finish` runs the whole validator,
     * so a malformed trace is caught where it was PRODUCED rather than where
     * it is read.
     */
    it('builds a trace through the producer seam and validates at finish', () => {
        const b = createTraceBuilder({ tape: 't', boot: { level: 3, x: 16, y: 32 } });
        b.record({
            tick: 0,
            saw: { level: 3, x: 16, y: 32 },
            goal: { kind: 'reach-exit' },
            strategy: { verb: 'walk' },
            rejected: [],
            keys: ['right'],
        });
        expect(b.length).toBe(1);
        expect(() => b.record({
            tick: 0,
            saw: { level: 3, x: 17, y: 32 },
            goal: { kind: 'reach-exit' },
            strategy: { verb: 'walk' },
            rejected: [],
            keys: [],
        })).toThrow(/not after the previous row's 0/);
        const t = b.finish(10);
        expect(t.rows.length).toBe(1);
        expect(t.boot).toEqual({ level: 3, x: 16, y: 32 });
    });

    it('refuses a malformed row at RECORD time, not at read time', () => {
        const b = createTraceBuilder({ tape: 't', boot: { level: 0, x: 0, y: 0 } });
        expect(() => b.record({ tick: 0, saw: { level: 0, x: 0, y: 0 } }))
            .toThrow(/missing required field "goal"/);
    });
});

describe('the renderer — dump and summarize', () => {
    it('summarizes by goal, verb and obstacle, and counts rejections', () => {
        const s = summarizeTrace(parseDecisionTrace(loadFixture(), 'f'));
        expect(s.tape).toBe('diagonal-run');
        expect(s.rows).toBe(3);
        expect(s.goals).toEqual({ 'reach-cell': 3 });
        expect(s.verbs).toEqual({ walk: 2, wait: 1 });
        expect(s.obstacles).toEqual({ none: 1 });
        expect(s.rejections).toBe(3);
        expect(s.rowsWithPath).toBe(1);
        expect(s.firstTick).toBe(0);
        expect(s.lastTick).toBe(30);
    });

    /**
     * ⛔ ASSUMPTION 3, WITNESSED IN BOTH DIRECTIONS. An unknown goal kind or
     * strategy verb is REPORTED, never refused and never swallowed: refusing
     * would block slice 2 on a vocabulary written before its policy exists,
     * and swallowing would hide a typo forever.
     */
    it('REPORTS an unknown goal kind or strategy verb rather than refusing it', () => {
        const t = parseDecisionTrace(loadFixture(), 'f');
        t.rows[0].goal.kind = 'escort-the-block';
        t.rows[0].strategy.verb = 'pirouette';
        const s = summarizeTrace(t);
        expect(s.unknownGoalKinds).toEqual(['escort-the-block']);
        expect(s.unknownStrategyVerbs).toEqual(['pirouette']);
        // And the KNOWN vocabulary is empty of them, which is the other half.
        expect(KNOWN_GOAL_KINDS).not.toContain('escort-the-block');
        expect(KNOWN_STRATEGY_VERBS).not.toContain('pirouette');
    });

    it('reports EMPTY unknown lists for the committed fixture', () => {
        const s = summarizeTrace(parseDecisionTrace(loadFixture(), 'f'));
        expect(s.unknownGoalKinds).toEqual([]);
        expect(s.unknownStrategyVerbs).toEqual([]);
    });

    it('formats a row with its rejections', () => {
        const t = parseDecisionTrace(loadFixture(), 'f');
        const line = formatTraceRow(t.rows[0]);
        expect(line).toMatch(/L0 \(80,128\) goal=reach-cell -> walk keys=\[right\+up\]/);
        expect(line).toMatch(/rejected: shove \(no pushable on the path\)/);
        // A row with no rejections prints no rejection block.
        expect(formatTraceRow(t.rows[1])).not.toMatch(/rejected/);
    });
});

/**
 * ── THE MUTATION LIST FOR THIS STRATUM ────────────────────────────────
 *
 * Rows 1–3 are walked MECHANICALLY over `TRACE_ROW_REQUIRED`,
 * `TRACE_REQUIRED` and `SAW_REQUIRED`, so they cover a field added tomorrow
 * without anyone remembering to add a case.
 *
 *  1. drop any of `tick saw goal strategy rejected keys` from a row
 *       → `reddens BY NAME when any required ROW field is dropped`
 *  2. drop any of `trace_version tape tick_count boot rows`
 *       → `reddens BY NAME when any required ENVELOPE field is dropped`
 *  3. drop any of `level x y` from `saw`
 *       → `reddens BY NAME when any required `saw` field is dropped`
 *  4. add a field to a row that no list names
 *       → `refuses an unknown row field rather than ignoring it`
 *  5. make `rejected` optional, or accept a rejection with an empty `why`
 *       → `requires \`rejected\` …` / `refuses a rejection with no reason`
 *  6. accept a key name outside `KEY_NAMES`
 *       → `refuses a key name the tape format does not know`
 *  7. drop the strictly-increasing or in-range tick law
 *       → `refuses out-of-order and out-of-range ticks`
 *  8. make `traceTapeAgreementFindings` compare nothing (return ok always)
 *       → `goes RED when a row claims keys the tape did not hold` — the row
 *         that stops the whole stratum being decoration
 *  9. drop the `deathJumpFindings` level-equality term
 *       → `names a jump to the boot position with NO level change` still
 *         passes, but `REPORTS the absence` would go red on any trace with a
 *         level change. ⚠ PARTIAL BITER, recorded as such.
 * 10. move the trace into the tape format
 *       → `asserts the tape format never grew a trace field` reds, and so
 *         does `tapeFormat`'s own pinning test (a v11 field fails until
 *         someone classifies it)
 * 11. make `summarizeTrace` REFUSE an unknown verb instead of reporting it
 *       → `REPORTS an unknown goal kind or strategy verb` reds
 *
 * ⚠ WHAT THIS STRATUM CANNOT CHECK, and slice 2 must: that the decisions are
 * GOOD ones. A trace is a record of reasoning, and no schema can tell a
 * correct plan from a plausible one — the differential is still the oracle.
 */
