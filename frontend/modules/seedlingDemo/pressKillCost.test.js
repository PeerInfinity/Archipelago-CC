/**
 * seedlingDemo/pressKillCost.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE P1: THE PRESS KILL'S FOUR CACHES ANSWER WHAT THE
 * COMPUTATION ANSWERED.
 *
 * `PRESS_KILL_COST` (ON) memoises `walkableCells`, bounds `clearOfHammersAt`'s line test, shifts the spinner forecast
 * one row a tick and asks each strike line once per derivation. None of them may move a plan, so every row here is a
 * differential: ON against the switch OFF (the computation as it was), with a count proving the cache was exercised.
 * The mutants each row catches are the report's (`CC/docs/cloud-reports/seedling-hammer-p1.md` § D2).
 *
 * ⛓⛓⛓ HAMMER-PHASE P2 — `STRIKE_SCAN_COST` (ON), the sibling switch: the strike line carried across derivations and
 * the scan's reach box. The same law: each row is ON against OFF (with P1 held ON), with a count proving the lever
 * fired. Its mutants are `CC/docs/cloud-reports/seedling-hammer-p2.md` § D2's.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    PRESS_KILL_COST, PRESS_KILL_COST_COUNTS, PRESS_KILL_COST_DEFAULT, UNCACHEABLE, resetPressKillCostCounts,
    sameValue, snapshotValue, withPressKillCost,
    STRIKE_SCAN_COST, STRIKE_SCAN_COST_COUNTS, STRIKE_SCAN_COST_DEFAULT, cellRowsOf, cellsInBox,
    resetStrikeScanCostCounts, withStrikeScanCost,
} from './pressKillCost.js';
import { clearOfHammersAt, deriveStrike, lineOnce, walkableCells } from './solverBot.js';
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
        const cellsOn = () => withPressKillCost(true, () => walkableCells(run, contacts)).map((c) => `${c.x},${c.y}`);
        const before = cellsOn();
        expect(cellsOn()).toEqual(before);
        expect(PRESS_KILL_COST_COUNTS.cellsHit).toBe(1);
        contacts.add(key);
        const after = cellsOn();
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
        const first = withPressKillCost(true, () => walkableCells(run, new Set())).map(cell);
        world = b.world;
        const second = withPressKillCost(true, () => walkableCells(run, new Set())).map(cell);
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

describe('strikeScanCost (P2) — the switch', () => {
    it('ships ON (a cost change, not a behaviour change: no flip), and OFF is one call away', () => {
        expect(STRIKE_SCAN_COST_DEFAULT).toBe(true);
        if (globalThis.process?.env?.SEEDLING_STRIKE_SCAN_COST === undefined) expect(STRIKE_SCAN_COST.enabled).toBe(true);
        expect(withStrikeScanCost(false, () => STRIKE_SCAN_COST.enabled)).toBe(false);
    });
});

describe('strikeScanCost (P2) — the row index answers what a filter over the whole list answers', () => {
    /** A lattice list with holes, row-major like `walkableCells` builds it. */
    function lattice(seed, w, h, pitch) {
        let x = seed;
        const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
        const out = [];
        for (let ty = 0; ty < h; ty += 1) {
            for (let tx = 0; tx < w; tx += 1) if (rnd() < 0.6) out.push({ x: tx * pitch + pitch / 2, y: ty * pitch + pitch / 2 });
        }
        return out;
    }

    it('every box, in the list order, over random lattices (edges inclusive)', () => {
        let boxes = 0;
        for (let seed = 1; seed <= 6; seed += 1) {
            const cells = lattice(seed, 23, 17, 16);
            const rows = cellRowsOf(cells);
            expect(rows).not.toBe(null);
            for (let k = 0; k < 400; k += 1) {
                const x0 = (k * 37) % 400 - 40 + (k % 3) * 0.5;
                const y0 = (k * 53) % 300 - 40;
                const x1 = x0 + (k % 7) * 24;
                const y1 = y0 + (k % 5) * 16;
                const want = cells.filter((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1);
                expect(cellsInBox(rows, x0, y0, x1, y1)).toEqual(want);
                boxes += 1;
            }
            // a box edge exactly on a cell centre is inside it
            const c = cells[Math.floor(cells.length / 2)];
            expect(cellsInBox(rows, c.x, c.y, c.x, c.y)).toEqual([c]);
        }
        expect(boxes).toBe(2400);
    });

    it('a list that is not row-major, or holds a non-finite coordinate, gets no index (the scan reads the whole list)', () => {
        expect(cellRowsOf([{ x: 8, y: 8 }, { x: 24, y: 8 }, { x: 8, y: 24 }])).not.toBe(null);
        expect(cellRowsOf([{ x: 24, y: 8 }, { x: 8, y: 8 }])).toBe(null);
        expect(cellRowsOf([{ x: 8, y: 24 }, { x: 8, y: 8 }])).toBe(null);
        expect(cellRowsOf([{ x: 8, y: 8 }, { x: 8, y: 8 }])).toBe(null);
        expect(cellRowsOf([{ x: Number.NaN, y: 8 }])).toBe(null);
        expect(cellsInBox(cellRowsOf([]), 0, 0, 100, 100)).toEqual([]);
    });
});

describe('strikeScanCost (P2) — the carried line book', () => {
    /** A run reduced to what `lineOnce` reads: a world, a bag, and a line query that counts what it is asked. */
    function fakeRun() {
        const asked = [];
        const run = {
            world: { id: 'w1' },
            bag: { openActivators: new Set(['a']), pulledRopes: new Map([['rope@1,2', { pulled: false }]]) },
            liveGeometryOpts() { return this.bag; },
            collideLineSolid(fx, fy, tx, ty) {
                asked.push([fx, fy, tx, ty]);
                return this.bag.pulledRopes.get('rope@1,2').pulled ? null : { tag: 'rope', at: { x: fx, y: fy } };
            },
        };
        return { run, asked };
    }
    const from = { x: 40.75, y: 40.25 };
    const rect = { x: 60.5, y: 33.5 };
    /** One derivation's ask, with its own per-derivation map and its own carried handle (as `deriveStrike` builds). */
    const derive = (run) => withStrikeScanCost(true, () => lineOnce(new Map(), run, from, rect, { run, book: undefined }));

    it('a line an earlier derivation asked is carried, and answers what the query answers', () => {
        const { run, asked } = fakeRun();
        resetStrikeScanCostCounts();
        const first = derive(run);
        const second = derive(run);
        expect(asked.length).toBe(1);
        expect(second).toEqual(first);
        expect(STRIKE_SCAN_COST_COUNTS.lineCarried).toBe(1);
        // the key is the TRUNCATED line: another fraction of the same pixels is the same question
        withStrikeScanCost(true, () => lineOnce(null, run, { x: 40.1, y: 40.9 }, { x: 60.9, y: 33.1 }, { run, book: undefined }));
        expect(asked.length).toBe(1);
    });

    it('a bag changed IN PLACE is a new book (the key is a copy): the line is asked again', () => {
        const { run, asked } = fakeRun();
        expect(derive(run)).not.toBe(null);
        run.bag.pulledRopes.get('rope@1,2').pulled = true;
        expect(derive(run)).toBe(null);
        expect(asked.length).toBe(2);
    });

    it('a new bag value, or a new world, is a new book', () => {
        const { run, asked } = fakeRun();
        derive(run);
        run.bag = { ...run.bag, openActivators: new Set(['a', 'b']) };
        derive(run);
        expect(asked.length).toBe(2);
        run.world = { id: 'w2' };
        derive(run);
        expect(asked.length).toBe(3);
        derive(run);
        expect(asked.length).toBe(3);
    });

    it('a bag that cannot be copied, or a run that refuses one, gets no book: every line is asked, nothing thrown', () => {
        const { run, asked } = fakeRun();
        run.bag = { ...run.bag, at: new Date(0) };
        derive(run);
        derive(run);
        expect(asked.length).toBe(2);
        run.liveGeometryOpts = () => { throw new Error('noclip'); };
        derive(run);
        expect(asked.length).toBe(3);
        // OFF: no book is opened at all
        resetStrikeScanCostCounts();
        const { run: off, asked: offAsked } = fakeRun();
        withStrikeScanCost(false, () => deriveStrikeLineOff(off));
        withStrikeScanCost(false, () => deriveStrikeLineOff(off));
        expect(offAsked.length).toBe(2);
        expect(STRIKE_SCAN_COST_COUNTS.booksOpened).toBe(0);
    });
    /** OFF, `deriveStrike` hands `lineOnce` no carried handle. */
    const deriveStrikeLineOff = (run) => lineOnce(new Map(), run, from, rect, STRIKE_SCAN_COST.enabled ? { run, book: undefined } : null);
});

describe('strikeScanCost (P2) — derivations on L40 (C1\'s staging A), P2 ON against OFF', () => {
    const view = () => solveStaging(stagingFromTape(parseTape(readFileSync(
        new URL('./fixtures/hammer-p1-l40-south-boot.json', import.meta.url), 'utf8'))));

    it('the kill-start derivation, then two refused ones on the same run (lines carried): the same answers', () => {
        const staging = view();
        const derivations = (on) => withPressKillCost(true, () => withStrikeScanCost(on, () => {
            const run = createRunForStaging(staging, atlasLevelSource());
            const first = deriveStrike(run, 'spinner@880,848', new Set(), 0, { continuation: true });
            // the bounded pass alone refuses here, and its refusal prints `unreachable` (every cell's floor skips)
            const again = deriveStrike(run, 'spinner@880,848', new Set(), 0);
            // a body across the level: the floor drops most of the room for hundreds of ticks
            const far = deriveStrike(run, 'spinner@192,144', new Set(), 0);
            return { first, again, far };
        }));
        resetStrikeScanCostCounts();
        const on = derivations(true);
        const counts = { ...STRIKE_SCAN_COST_COUNTS };
        const off = derivations(false);
        expect(JSON.stringify(on)).toBe(JSON.stringify(off));
        expect(on.first.cell).toEqual({ x: 728, y: 680 });
        expect(on.again.cell).toBe(null);
        expect(on.again.unreachable).toBeGreaterThan(100000);
        expect(on.far.unreachable).toBeGreaterThan(on.again.unreachable);
        expect(counts.lineCarried).toBeGreaterThan(50);
        expect(counts.cellsSkipped).toBeGreaterThan(100 * counts.cellsBoxed);
    }, 90_000);
});

describe('strikeScanCost (P2) — a press kill solved both ways', () => {
    it('r9-solve-18 at residue 5: the same keys, records and trace with P2 ON and OFF (P1 ON both), the levers exercised', async () => {
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
        resetStrikeScanCostCounts();
        const on = await withPressKillCost(true, () => withStrikeScanCost(true, solve));
        const counts = { ...STRIKE_SCAN_COST_COUNTS };
        const off = await withPressKillCost(true, () => withStrikeScanCost(false, solve));
        expect(on.out.perTick.length).toBe(off.out.perTick.length);
        expect(digest(on)).toBe(digest(off));
        expect(counts.lineCarried).toBeGreaterThan(0);
        expect(counts.cellsSkipped).toBeGreaterThan(0);
    }, 180_000);
});
