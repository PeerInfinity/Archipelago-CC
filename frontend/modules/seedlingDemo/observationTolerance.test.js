/**
 * observationTolerance — the diagnostic comparator (engine prep B1 D4).
 *
 * Three claims:
 *  1. At `epsilon 0` and `slack 0` its verdict IS `diffObservationStreams(...)
 *     === null` — over every committed recording against the JS model's own
 *     stream (the diverging fixtures included, so both verdicts are exercised),
 *     and over three perturbed copies of each: x + 1e-9 at one tick, a
 *     transition one tick late, a room swapped at one tick.
 *  2. Under a tolerance it excuses exactly what it says it does and no more.
 *  3. ⛔ The gates stay exact: nothing a gate runs imports this module.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixtureNames, loadExpectation, loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { diffObservationStreams, parseObservationStream } from './tapeFormat.js';
import { runTapeToStream } from './tapeRunner.js';
import { compareObservationStreams } from './observationTolerance.js';

const ROOT = new URL('../../../', import.meta.url).pathname;
const EXACT = { epsilon: { x: 0, y: 0 }, transitionSlack: 0 };
const clone = (s) => parseObservationStream(JSON.parse(JSON.stringify(s)));

/** x + 1e-9 at the middle tick. */
function nudgeX(stream) {
    const s = clone(stream);
    const i = Math.floor(s.ticks.length / 2);
    s.ticks[i].x += 1e-9;
    return { stream: s, at: i };
}

/**
 * The first transition one tick LATE: the tick that was the arrival now still
 * reads the old room (and the old room's last position), and the record moves
 * with it. `null` when the stream has no transition or the late tick would
 * collide with the next record or run off the end.
 */
function lateTransition(stream) {
    const s = clone(stream);
    const tr = s.transitions[0];
    if (!tr) return null;
    const next = s.transitions[1];
    if (tr.t + 1 >= s.ticks.length || (next && next.t <= tr.t + 1)) return null;
    s.ticks[tr.t] = { t: tr.t, x: s.ticks[tr.t - 1].x, y: s.ticks[tr.t - 1].y,
        level: tr.from_level };
    tr.t += 1;
    return s;
}

/** A room swapped at one tick, chosen OUTSIDE every slack-1 window. */
function swapRoom(stream) {
    const s = clone(stream);
    const near = (t) => s.transitions.some((tr) => t >= tr.t - 1 && t < tr.t + 1);
    let i = Math.floor(s.ticks.length / 2);
    while (i < s.ticks.length && near(i)) i++;
    if (i >= s.ticks.length) return null;
    s.ticks[i].level += 1000;
    return { stream: s, at: i };
}

describe('exact mode IS diffObservationStreams', () => {
    const names = fixtureNames();
    const levelSource = atlasLevelSource();
    const verdictsAgree = (e, a) => {
        const diffNull = diffObservationStreams(e, a) === null;
        const report = compareObservationStreams(e, a, EXACT);
        return { diffNull, agrees: report.agrees, report };
    };

    it(`agrees with it on all ${names.length} committed recordings vs the model, and on 3 perturbations of each`, () => {
        // ⛓ swim U5/U7: 157 recordings (+ the BobBoss encounter and the two puncher witnesses).
        // ⛓ swim U9 + U10: 162 (+ the three shield-bump witnesses and the two dwell witnesses).
        // ⛓ swim U11: 166 (+ the two `u11-facing-*` and the two `u11-dark-shield-*` witnesses).
        // ⛓ swim U12: 168 (+ `u12-pull-carry` and `u12-pull-cross`).
        // ⛓ swim R1: 169 (+ `r1-dark-suit-bob`), 171 (+ the two `r1-dark-*-kill`),
        // 174 (+ the two `r1-dark-*-spinner` and `r1-dark-shield-bobboss`).
        // ⛓ swim U13: 169 (+ the campaign segment `r9-solve-13-v2`).
        // ⛓ swim R1 + U13 (merged): 175.
        // ⛓ swim R3: 176 (+ `r3-pit-death`, inert).
        // ⛓ swim R3: 178 (+ `r3-drown` and `r3-lava`, inert).
        // ⛓ swim R3: 179 (+ `r3-bobboss-death`, inert).
        expect(names.length).toBe(179);
        const tally = { recorded: 0, pass: 0, fail: 0, nudged: 0, late: 0, swapped: 0 };
        for (const name of names) {
            const { stream: recorded } = loadExpectation(name);
            const model = runTapeToStream(loadTape(name), { levelSource });

            const base = verdictsAgree(recorded, model);
            expect(base.agrees, `${name}: diff ${base.diffNull ? 'null' : 'non-null'}`)
                .toBe(base.diffNull);
            expect(base.report.mode).toBe('exact');
            tally.recorded++;
            tally[base.agrees ? 'pass' : 'fail']++;

            // Perturbations are made from the RECORDING and compared against it,
            // so each is a known, single change.
            const { stream: nudged } = nudgeX(recorded);
            const n = verdictsAgree(recorded, nudged);
            expect(n.agrees, `${name} nudged`).toBe(n.diffNull);
            expect(n.agrees, `${name} nudged`).toBe(false);
            tally.nudged++;

            const late = lateTransition(recorded);
            if (late) {
                const l = verdictsAgree(recorded, late);
                expect(l.agrees, `${name} late`).toBe(l.diffNull);
                expect(l.agrees, `${name} late`).toBe(false);
                tally.late++;
            }

            const swapped = swapRoom(recorded);
            if (swapped) {
                const r = verdictsAgree(recorded, swapped.stream);
                expect(r.agrees, `${name} swapped`).toBe(r.diffNull);
                expect(r.agrees, `${name} swapped`).toBe(false);
                tally.swapped++;
            }
        }
        // eslint-disable-next-line no-console
        console.log(`exact-mode equivalence: ${JSON.stringify(tally)}`);
        // Both verdicts were exercised on the real roster, and the transition
        // perturbation was not vacuous.
        expect(tally.pass).toBeGreaterThan(0);
        expect(tally.fail).toBeGreaterThan(0);
        expect(tally.late).toBeGreaterThan(0);
        expect(tally.swapped).toBe(179);
    }, 600_000);
});

describe('tolerance mode excuses what it says, and no more', () => {
    const { stream } = loadExpectation('transition-west-return');

    it('the fixture this block leans on has a transition', () => {
        expect(stream.transitions.length).toBeGreaterThan(0);
    });

    it('x + 1e-9 agrees under epsilon 1e-6, and reports the delta', () => {
        const { stream: nudged, at } = nudgeX(stream);
        const r = compareObservationStreams(stream, nudged, { epsilon: { x: 1e-6, y: 0 } });
        expect(r.agrees).toBe(true);
        expect(r.mode).toBe('tolerance');
        expect(r.maxDelta.x).toBeGreaterThan(0);
        expect(r.maxDelta.x).toBeLessThan(1e-6);
        const exact = compareObservationStreams(stream, nudged);
        expect(exact.agrees).toBe(false);
        expect(exact.firstDivergence).toMatchObject({ t: at, kind: 'x' });
        expect(exact.divergentTicks).toBe(1);
    });

    it('a transition one tick late agrees under slack 1, not under slack 0', () => {
        const late = lateTransition(stream);
        const r1 = compareObservationStreams(stream, late, { transitionSlack: 1 });
        expect(r1.agrees).toBe(true);
        expect(r1.roomSequenceAgrees).toBe(true);
        expect(r1.maxDelta.t).toBe(1);
        expect(r1.transitions[0]).toMatchObject({ dt: 1, agrees: true });
        const r0 = compareObservationStreams(stream, late);
        expect(r0.agrees).toBe(false);
        expect(r0.transitions[0]).toMatchObject({ dt: 1, agrees: false });
    });

    it('⛔ a room swapped outside every window never agrees, whatever the slack', () => {
        const { stream: swapped, at } = swapRoom(stream);
        for (const transitionSlack of [0, 1]) {
            const r = compareObservationStreams(stream, swapped,
                { epsilon: { x: 1e9, y: 1e9 }, transitionSlack });
            expect(r.agrees).toBe(false);
            expect(r.roomSequenceAgrees).toBe(false);
            expect(r.firstDivergence.kind).toBe('room-sequence');
            expect(r.divergentTicks).toBe(1);
            expect(r.transitions.every((t) => t.agrees)).toBe(true);
            expect(at).toBeGreaterThan(0);
        }
    });

    it('a length difference is reported, and tolerated only up to the slack', () => {
        const short = clone(stream);
        short.ticks.pop();
        const r0 = compareObservationStreams(stream, short);
        expect(r0.agrees).toBe(false);
        expect(r0.length).toEqual({ expected: stream.ticks.length,
            actual: stream.ticks.length - 1, delta: -1, tolerated: false });
        expect(r0.firstDivergence.kind).toBe('length');
        const r1 = compareObservationStreams(stream, short, { transitionSlack: 1 });
        expect(r1.length.tolerated).toBe(true);
        expect(r1.agrees).toBe(true);
        short.ticks.pop();
        expect(compareObservationStreams(stream, short, { transitionSlack: 1 }).agrees).toBe(false);
    });

    it('refuses nonsense options by name', () => {
        expect(() => compareObservationStreams(stream, stream, { epsilon: { x: -1, y: 0 } }))
            .toThrow(/epsilon.x must be a finite number >= 0/);
        expect(() => compareObservationStreams(stream, stream, { transitionSlack: 0.5 }))
            .toThrow(/transitionSlack must be an integer >= 0/);
    });
});

/**
 * ⛔⛔ THE GATES STAY EXACT. No file a gate runs may name this module in a
 * string literal (an import, a dynamic import, a require). The roster is read
 * off disk at run time, so a NEW `check-*.mjs` is covered the day it lands.
 */
const NAMES_TOLERANCE = /['"`][^'"`\n]*observationTolerance(\.js)?['"`]/;

function gateFiles() {
    const checks = readdirSync(join(ROOT, 'scripts/procgen'))
        .filter((f) => /^check-.*\.mjs$/.test(f))
        .map((f) => `scripts/procgen/${f}`);
    return [
        ...checks,
        'frontend/modules/seedlingDemo/tapeRunner.test.js',
        'frontend/modules/seedlingDemo/fixtures/index.js',
        'frontend/modules/seedlingDemo/watchWasm.js',
    ];
}

describe('⛔ no gate imports the tolerance comparator', () => {
    it('the pattern catches the spellings it has to', () => {
        for (const line of [
            "import { compareObservationStreams } from '../../frontend/modules/seedlingDemo/observationTolerance.js';",
            "const m = await import(\"./observationTolerance.js\");",
            'const m = require(`./observationTolerance`);',
        ]) expect(line).toMatch(NAMES_TOLERANCE);
        expect('// observationTolerance is a diagnostic').not.toMatch(NAMES_TOLERANCE);
    });

    const files = gateFiles();
    it(`the roster is real: ${files.length} files, every one on disk`, () => {
        expect(files.filter((f) => f.startsWith('scripts/procgen/check-')).length)
            .toBeGreaterThan(10);
        for (const f of files) expect(() => readFileSync(join(ROOT, f))).not.toThrow();
    });

    it.each(files)('%s does not import observationTolerance', (f) => {
        // latin1: some tracked sources carry stray NUL bytes; a byte-faithful
        // read keeps them from hiding a match (CLAUDE.md's grep -a lesson).
        const text = readFileSync(join(ROOT, f), 'latin1');
        expect(text).not.toMatch(NAMES_TOLERANCE);
    });
});
