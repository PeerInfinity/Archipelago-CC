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
        // ⛓ swim U14: 177 with `u14-moonrock-beam` and `u14-moonrock-set`.
        // ⛓ swim U14: 177 with `u14-moonrock-beam` and `u14-moonrock-set`; 181 with
        // the four campaign segments (route steps 23–26).
        // ⛓ swim R3 + U14 (merged): 185 — R3's four death witnesses + U14's two moonrock witnesses and four segments.
        // ⛓ swim U15: 187 with `u15-turret-spit` and `u15-turret-shield`.
        // ⛓ swim U15: 191 with route steps 27–30 (`r9-solve-29`, `-31`, `-30`, `-32`).
        // ⛓ swim R2: 189 — D1's two wallflyer witnesses, D3's two-teleporter and terrain-kill-lock witnesses.
        // ⛓ swim U15 + R2 (merged): 195 — U15's 2 witnesses + 4 segments, R2's 4 witnesses.
        // ⛓ swim R4: 196 — D2's `r4-iceturret-bobs`.
        // ⛓ fidelity F1: 198 — D1c's `f1-l5-lock-removal` and D2's `f1-l5-open-lock-bait`.
        // ⛓ fidelity F1c: 200 — D1's `f1c-l18-phase42` and D2's `f1c-l18-lock-removal`.
        // ⛓ Seedling fidelity F4: 201 — D1's `f4-l8-sandtraps`.
        // ⛓ fidelity F6: 204 — `f6-l17-reentry`, `f6-l2-reentry`, `f6-l20-reentry`.
        // ⛓ fidelity F7: 206 — `f7-l16-reentry`, `f7-l16-walkin`.
        // ⛓ fidelity BURN: 208 — `burn-l24-reach-exit`, `burn-l44-reach-exit`.
        // ⛓ fidelity L14: 209 — `l14-swordless-detour`.
        // ⛓ fidelity CANCROSS: 210 — `cancross-l16-sword-none`.
        // ⛓ fidelity DASH: 211 — `dash-l16-sword-all`.
        // ⛓ fidelity RETURN: 215 — `return-l15-reentry`, `return-l15-walkin`, `return-l15-reentry-unclear`, `return-l15-conch`.
        // ⛓ fidelity ROBUST: 217 — `robust-l16-sword-idle1`, `robust-l16-l18-sword-conch`.
        // ⛓ fidelity WATCHER: 221 — `watcher-l37-reach-l38`, `watcher-l37-reach-l44`, `watcher-l37-silent-lean`, `watcher-l114-silent`.
        // ⛓ fidelity WATCHER: 222 — `watcher-l114-talk`.
        // ⛓ fidelity SLOTS: 227 — `slots-l24-fire-first`, `slots-l24-burn-fire-first`, `slots-l24-burn-cut-80`, `slots-l24-burn-cut-110`, `slots-l24-burn-fencepost`.
        // ⛓ fidelity AXE: 231 — `axe-l48-reach-l49`, `axe-l61-reach-l62`, `axe-l61-reach-l63`, `axe-l71-reach-l76`.
        // ⛓ fidelity PROXIMITY: +5 (236 with AXE's four) — `prox-l38-chest`, `prox-l38-reach-l39`, `prox-l29-key-return`, `prox-l40-turret-volley`, `prox-l40-turret-contact`.
        // ⛓ fidelity FRONTIER3: +2 (238 with AXE + PROXIMITY) — `frontier3-l62-door-niche`, `frontier3-l87-pocket`.
        // ⛓ fidelity STANCE: +5 (243) — `stance-l46-chest`, `stance-l48-chest`, `stance-l48-keylock-open`, `stance-l48-keylock-south`, `stance-l48-keylock-north`.
        // ⛓ fidelity LADDER2: +2 (245) — `ladder2-l59-grenade`, `ladder2-l104-beam`.
        // ⛓ fidelity BOBSOLDIER: +3 (248) — `bobsoldier-sword`, `bobsoldier-kill`, `bobsoldier-corpse`.
        // ⛓ hammer-phase A: +2 (250) — `hammer-a-l18-escape21`, `hammer-a-l18-escape15`.
        expect(names.length).toBe(250);
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
        // ⛓ fidelity AXE: 231 — every recording carries a transition to swap, the four axe witnesses included.
        // ⛓ fidelity STANCE: 243 — the five `stance-*` witnesses swap too.
        // ⛓ fidelity LADDER2: 245 — both witnesses carry a transition to swap.
        // ⛓ fidelity BOBSOLDIER: 248 with `bobsoldier-sword`, `bobsoldier-kill`, `bobsoldier-corpse`.
        // ⛓ hammer-phase A: 250 — both escape witnesses cross to L19, a transition to swap.
        expect(tally.swapped).toBe(250);
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
