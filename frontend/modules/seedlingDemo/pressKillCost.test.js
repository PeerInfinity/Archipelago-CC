/**
 * seedlingDemo/pressKillCost.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE P1: THE PRESS KILL'S FOUR CACHES ANSWER WHAT THE
 * COMPUTATION ANSWERED.
 *
 * `PRESS_KILL_COST` (ON) memoises `walkableCells`, bounds `clearOfHammersAt`'s line test, shifts the spinner forecast
 * one row a tick and asks each strike line once per derivation. None of them may move a plan, so every row here is a
 * differential: ON against the switch OFF (the computation as it was), with a count proving the cache was exercised.
 * The mutants each row catches are the report's (`CC/docs/cloud-reports/seedling-hammer-p1.md` § D2).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    PRESS_KILL_COST, PRESS_KILL_COST_COUNTS, PRESS_KILL_COST_DEFAULT, UNCACHEABLE, resetPressKillCostCounts,
    sameValue, snapshotValue, withPressKillCost,
} from './pressKillCost.js';
import { clearOfHammersAt, deriveStrike, walkableCells } from './solverBot.js';
import { SPINNER, spinnerRect } from './spinner.js';
import { contactKey } from './botDriverV2.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { loadTape } from './fixtures/index.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { twoPassSolve } from './twoPassSolve.js';

/** A tape's keys, walked by the tape stepper (`hammerGhostSpinner.test.js`'s `walk`). */
function tapeKeys(name) {
    const tape = loadTape(name);
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    return { staging: stagingFromTape(tape), keys: held.filter(Boolean) };
}

describe('pressKillCost — the switch and the key', () => {
    it('ships ON (a cost change, not a behaviour change: no flip)', () => {
        expect(PRESS_KILL_COST_DEFAULT).toBe(true);
        if (globalThis.process?.env?.SEEDLING_PRESS_KILL_COST === undefined) expect(PRESS_KILL_COST.enabled).toBe(true);
        expect(withPressKillCost(false, () => PRESS_KILL_COST.enabled)).toBe(false);
    });

    it('a stored key is a COPY: an in-place change to what it was taken from is a miss', () => {
        const live = { ropes: new Map([['rope@1,2', { pulled: false }]]), [Symbol('brand')]: true };
        const key = snapshotValue(live);
        expect(sameValue(live, key)).toBe(true);
        live.ropes.get('rope@1,2').pulled = true;
        expect(sameValue(live, key)).toBe(false);
        // order is part of the value, a getter or a class instance cannot be copied
        expect(sameValue(new Set([1, 2]), new Set([2, 1]))).toBe(false);
        expect(snapshotValue({ get x() { return 1; } })).toBe(UNCACHEABLE);
        expect(snapshotValue({ at: new Date(0) })).toBe(UNCACHEABLE);
        expect(snapshotValue({ f: () => 1 })).toBe(UNCACHEABLE);
    });
});

describe('pressKillCost — walkableCells', () => {
    const { staging } = tapeKeys('r9-solve-18');

    it('a contact set changed IN PLACE re-derives the cells (the memo keys a copy)', () => {
        const run = createRunForStaging(staging, atlasLevelSource());
        const tp = run.world.teleporters[0];
        const key = contactKey({ kind: 'teleporter', blocker: tp });
        const contacts = new Set();
        resetPressKillCostCounts();
        const before = walkableCells(run, contacts).map((c) => `${c.x},${c.y}`);
        expect(walkableCells(run, contacts).map((c) => `${c.x},${c.y}`)).toEqual(before);
        expect(PRESS_KILL_COST_COUNTS.cellsHit).toBe(1);
        contacts.add(key);
        const after = walkableCells(run, contacts).map((c) => `${c.x},${c.y}`);
        const fresh = withPressKillCost(false, () => walkableCells(run, new Set([key]))).map((c) => `${c.x},${c.y}`);
        expect(after).toEqual(fresh);
        expect(after.length).toBeGreaterThan(before.length);
    });

    it('a different world under the same run and the same opts re-derives the cells (the world is keyed by identity)', () => {
        const a = createRunForStaging(staging, atlasLevelSource());
        const b = createRunForStaging(tapeKeys('r5-press-glide').staging, atlasLevelSource());
        // every opts read goes to `a`, only `world` moves: the opts are equal, so only the world can make a miss
        let world = a.world;
        const run = new Proxy({}, { get: (_, k) => (k === 'world' ? world
            : (typeof a[k] === 'function' ? a[k].bind(a) : a[k])) });
        const cell = (c) => `${c.x},${c.y}`;
        const first = walkableCells(run, new Set()).map(cell);
        world = b.world;
        const second = walkableCells(run, new Set()).map(cell);
        expect(second).toEqual(withPressKillCost(false, () => walkableCells(run, new Set())).map(cell));
        expect(second).not.toEqual(first);
    });
});

describe('pressKillCost — the hammer line bound', () => {
    it('answers what hammerHitsPlayer answers, every phase, boxes on and off the line', () => {
        let hits = 0;
        let skipped = 0;
        let mismatches = 0;
        for (const frac of [0, 0.25, 0.5, 0.9999]) {
            const sp = { x: 120 + frac, y: 96 + frac };
            const rect = spinnerRect(sp);
            for (let phase = 0; phase < SPINNER.hammerPeriod; phase += 1) {
                const run = { gameTimeAt: () => 9000 + phase };
                for (let dx = -26; dx <= 26; dx += 0.5) {
                    for (let dy = -26; dy <= 26; dy += 0.5) {
                        const box = playerBoxAt(sp.x + dx, sp.y + dy);
                        resetPressKillCostCounts();
                        const on = withPressKillCost(true, () => clearOfHammersAt(run, box, [[rect]], 0));
                        skipped += PRESS_KILL_COST_COUNTS.hammerSkipped;
                        const off = withPressKillCost(false, () => clearOfHammersAt(run, box, [[rect]], 0));
                        if (on !== off) mismatches += 1;
                        if (!off) hits += 1;
                    }
                }
            }
        }
        expect(mismatches).toBe(0);
        expect(hits).toBeGreaterThan(10000);
        expect(skipped).toBeGreaterThan(100000);
    });
});

describe('pressKillCost — the forecast shift', () => {
    /** Every tick of the walk, the forecast ON (shifted) against a twin run's forecast cut fresh OFF. */
    function differential(name, horizon) {
        const { staging, keys } = tapeKeys(name);
        const on = createRunForStaging(staging, atlasLevelSource());
        const off = createRunForStaging(staging, atlasLevelSource());
        resetPressKillCostCounts();
        const diverged = [];
        for (let t = 0; t < keys.length; t += 1) {
            const a = withPressKillCost(true, () => on.spinnerForecast(horizon));
            const b = withPressKillCost(false, () => off.spinnerForecast(horizon));
            if (JSON.stringify(a) !== JSON.stringify(b)) diverged.push(t);
            withPressKillCost(true, () => on.advance(keys[t]));
            withPressKillCost(false, () => off.advance(keys[t]));
        }
        return { diverged, counts: { ...PRESS_KILL_COST_COUNTS } };
    }

    it('r9-solve-18 (presses land, bodies die): every row equal, and the shift is taken', () => {
        const { diverged, counts } = differential('r9-solve-18', 256);
        expect(diverged).toEqual([]);
        expect(counts.forecastShifted).toBeGreaterThan(400);
        expect(counts.forecastCut).toBeGreaterThan(0);
    });

    it('r5-press-glide (a block glides while the bodies move): every row equal', () => {
        const { diverged, counts } = differential('r5-press-glide', 256);
        expect(diverged).toEqual([]);
        expect(counts.forecastShifted).toBeGreaterThan(200);
        expect(counts.forecastCut).toBeGreaterThan(50);
    });
});

describe('pressKillCost — one strike derivation on L40 (C1\'s staging A)', () => {
    it('the kill-start derivation on spinner@880,848, continuation and all: the same strike ON and OFF', () => {
        // the survey's step-78 boot (C1's step 61): r8-solve-11's block at L40's south door, the press kill's first tick
        const view = readFileSync(new URL('./fixtures/hammer-p1-l40-south-boot.json', import.meta.url), 'utf8');
        const staging = solveStaging(stagingFromTape(parseTape(view)));
        const once = (on) => withPressKillCost(on, () => deriveStrike(
            createRunForStaging(staging, atlasLevelSource()), 'spinner@880,848', new Set(), 0, { continuation: true }));
        resetPressKillCostCounts();
        const on = once(true);
        const counts = { ...PRESS_KILL_COST_COUNTS };
        const off = once(false);
        expect(JSON.stringify(on)).toBe(JSON.stringify(off));
        expect(on.cell).toEqual({ x: 728, y: 680 });
        expect(counts.lineHit).toBeGreaterThan(100);
        expect(counts.hammerSkipped).toBeGreaterThan(1000);
    }, 60_000);
});

describe('pressKillCost — a press kill solved both ways', () => {
    it('r9-solve-18 at residue 5: the same keys, records and trace ON and OFF, every cache exercised', async () => {
        const NAME = 'r9-solve-18';
        const STAGING = stagingFromTape(loadTape(NAME));
        const P = SPINNER.hammerPeriod;
        const shift = ((((5 - (STAGING.seam.time % P)) % P) + P) % P) - P;
        const seam = { ...STAGING.seam, time: STAGING.seam.time + shift };
        const solve = () => twoPassSolve({
            makeRun: (persistence) => createRunForStaging({ ...STAGING, seam, persistence, equips: [] },
                atlasLevelSource()),
            goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }],
            name: NAME,
            boot: STAGING.boot,
            persistence: STAGING.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle here'); },
        });
        const digest = (res) => createHash('md5').update(JSON.stringify(res.out, (k, v) => (v instanceof Set
            ? [...v].sort() : (k === 'ms' || /Ms$/.test(k) ? undefined : v)))).digest('hex');
        resetPressKillCostCounts();
        const on = await withPressKillCost(true, solve);
        const counts = { ...PRESS_KILL_COST_COUNTS };
        const off = await withPressKillCost(false, solve);
        expect(on.out.perTick.length).toBe(off.out.perTick.length);
        expect(digest(on)).toBe(digest(off));
        expect(counts.cellsHit).toBeGreaterThan(0);
        expect(counts.forecastShifted).toBeGreaterThan(0);
        expect(counts.hammerSkipped).toBeGreaterThan(0);
        expect(counts.lineHit).toBeGreaterThan(0);
    }, 120_000);
});
