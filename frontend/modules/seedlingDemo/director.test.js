import { describe, it, expect } from 'vitest';
import {
    windowsFrom, boundaryFindings, streamBoundaryFindings, traceFindings, traceTicks,
    assertWindowEndsAtRest, DirectorError,
} from './director.js';

/**
 * The director's own stratum: pure functions over the GAME's reports, with
 * every input mutated in turn and the corresponding check asserted red.
 *
 * ⚠ THIS SHARES ITS GENERATOR'S ASSUMPTIONS AND SAYS SO. The statuses below
 * are hand-built, so this file can only prove that the checks fire on the
 * shapes it imagines — it cannot prove the shapes are the ones the game
 * produces. The independent stratum is `run-seedling-director.mjs --bridge`,
 * whose expectations are six recordings made before the director existed
 * (R4's §14 lesson, applied to this rung's first new machinery).
 */

const status = (over = {}) => ({
    level: 59,
    x: 296.5,
    y: 136.5,
    items: {
        hasSword: true, hasDarkSword: false, hasGhostSword: false, hasShield: false,
        hasDarkShield: false, hasFire: false, hasWand: false, hasFireWand: false,
        canSwim: false, hasFeather: true, hasSpear: true, hasDarkSuit: false,
        hasTorch: true, hitsMax: 3,
    },
    grants: [],
    persistence_cleared: [{ level: 12, tag: 0 }, { level: 30, tag: 0 }],
    dead_frames: 87,
    ...over,
});

const stream = (over = {}) => ({
    ticks: [{ t: 0, level: 59, x: 296.5, y: 136.5 }],
    transitions: [],
    ...over,
});

const tape = (name, over = {}) => ({
    tape_version: 4, game: 'seedling', name,
    boot: { level: 0, x: 80, y: 128 },
    noclip: false, noDamage: true, noHazards: ['water', 'waterfall'],
    grants: [], persistence: [], equips: [], tick_count: 10, inputs: [],
    ...over,
});

describe('windowsFrom: the two things a window after the first may not declare', () => {
    it('leaves the FIRST window exactly as authored', () => {
        const first = tape('w0', {
            grants: [{ level: 0, items: ['sword'] }],
            persistence: [{ level: 12, tag: 0, note: 'x' }],
        });
        const out = windowsFrom([first, tape('w1')]);
        expect(out[0]).toBe(first);
    });

    it('REFUSES a later window that declares persistence clears, by name', () => {
        // The load-bearing one: `botStart` resets EVERY tag in EVERY level to
        // true before applying a declared list, so this would erase what the
        // earlier windows earned rather than adding to it.
        expect(() => windowsFrom([
            tape('w0'),
            tape('w1', { persistence: [{ level: 12, tag: 0, note: 'x' }] }),
        ])).toThrow(/window 1 \("w1"\) declares 1 persistence clear/);
        expect(() => windowsFrom([tape('w0'), tape('w1', { persistence: [] })]))
            .not.toThrow();
    });

    it('REFUSES a later window that declares grants, by name', () => {
        expect(() => windowsFrom([
            tape('w0'),
            tape('w1', { grants: [{ level: 0, items: ['sword'] }] }),
        ])).toThrow(/window 1 \("w1"\) declares 1 grant/);
    });

    it('strips instead of refusing ONLY when the caller says it is authoring', () => {
        const out = windowsFrom([
            tape('w0'),
            tape('w1', {
                grants: [{ level: 0, items: ['sword'] }],
                persistence: [{ level: 12, tag: 0, note: 'x' }],
            }),
        ], { strip: true });
        expect(out[1].grants).toEqual([]);
        expect(out[1].persistence).toEqual([]);
        // ...and it does not mutate the caller's tape.
        expect(out[1]).not.toBe(out[0]);
    });

    it('refuses an empty list rather than returning one', () => {
        expect(() => windowsFrom([])).toThrow(DirectorError);
    });
});

describe('boundaryFindings: both sides are the GAME, one instant apart', () => {
    it('finds nothing when the boundary held', () => {
        expect(boundaryFindings(status(), status(), stream())).toEqual([]);
    });

    it('catches a RE-BOOT, which is what a bad boundary looks like', () => {
        // `botStart` re-boots when the tape's boot block does not name the
        // current world's construction args — and then the window chain is N
        // unrelated walks rather than one.
        const f = boundaryFindings(status(), status({ x: 88, y: 136 }), stream());
        expect(f).toHaveLength(1);
        expect(f[0].detail).toMatch(/botStart RE-BOOTED/);
    });

    it('catches a level change across the boundary', () => {
        const f = boundaryFindings(status(), status({ level: 60 }), stream());
        expect(f.map((x) => x.what)).toContain('the level changed across the boundary');
    });

    it('catches the drained STREAM disagreeing with the status beside it', () => {
        const f = boundaryFindings(
            status(), status(), stream({ ticks: [{ t: 0, level: 59, x: 1, y: 2 }] }),
        );
        expect(f.map((x) => x.what))
            .toContain('the drained stream disagrees with the status it was drained beside');
    });

    it('catches an item LOST across a boundary', () => {
        const before = status();
        const after = status({ items: { ...before.items, hasTorch: false } });
        const f = boundaryFindings(before, after, stream());
        expect(f.map((x) => x.what)).toContain('the item set changed across the boundary');
    });

    it('catches an item GAINED across a boundary — a grant nobody declared', () => {
        const before = status();
        const after = status({ items: { ...before.items, hasWand: true } });
        const f = boundaryFindings(before, after, stream());
        expect(f.map((x) => x.what)).toContain('the item set changed across the boundary');
    });

    it('checks hitsMax ON ITS OWN, because health has no boolean', () => {
        // R4's rule: folded into the item set, a run that lost `hasSword` and
        // gained health would be green. `hitsMax` is an int and `health` ADDS.
        const before = status();
        const after = status({ items: { ...before.items, hitsMax: 4 } });
        const f = boundaryFindings(before, after, stream());
        expect(f).toHaveLength(1);
        expect(f[0].what).toBe('hitsMax changed across the boundary');
    });

    it('catches cleared flags COMING BACK — the reset-everything backstop', () => {
        const before = status();
        const after = status({ persistence_cleared: [{ level: 12, tag: 0 }] });
        const f = boundaryFindings(before, after, stream());
        expect(f).toHaveLength(1);
        expect(f[0].detail).toMatch(/reset every tag in every level/);
        // ...and a flag ADDED is fine: the ledger is monotone, not frozen.
        expect(boundaryFindings(before, status({
            persistence_cleared: [...before.persistence_cleared, { level: 59, tag: 3 }],
        }), stream())).toEqual([]);
    });

    it('catches a window that fired a grant', () => {
        const f = boundaryFindings(
            status(), status({ grants: [{ t: 0, level: 59, items: ['sword'] }] }), stream(),
        );
        expect(f.map((x) => x.what)).toContain('the window fired grants');
    });

    it('refuses to pass when a status is MISSING rather than reading undefined', () => {
        expect(boundaryFindings(null, status(), stream())).toHaveLength(1);
        expect(boundaryFindings(status(), undefined, stream())).toHaveLength(1);
    });
});

describe('traceFindings: the partition claim', () => {
    const win = (label, over = {}) => ({
        label, stream: stream(), status: status(),
        boundary_before: status(), boundary_after_start: status(), ...over,
    });

    it('holds for a clean three-window trace', () => {
        expect(traceFindings([win('a'), win('b'), win('c')])).toEqual([]);
    });

    it('reports a trace with no windows rather than passing vacuously', () => {
        expect(traceFindings([])).toHaveLength(1);
        expect(traceFindings(null)).toHaveLength(1);
    });

    it('names the window a broken boundary belongs to', () => {
        // ⚠ `boundary_after_start`, not `status`: the boundary is the instant
        // between two windows, and a window's END state is a different
        // question (it is where the walk got to, which is the point).
        const bad = win('c', { boundary_after_start: status({ level: 60 }) });
        const f = traceFindings([win('a'), win('b'), bad]);
        expect(f).toHaveLength(1);
        expect(f[0].where).toBe('boundary 1 → 2 (c)');
    });

    it('counts live ticks as stream length MINUS ONE, per RECORD-THEN-ACT', () => {
        // An N-tick tape yields N+1 observations, so three windows of one
        // observation each are three windows of ZERO live ticks.
        expect(traceTicks([win('a'), win('b')])).toBe(0);
        expect(traceTicks([win('a', {
            stream: { ticks: new Array(642).fill({ t: 0 }), transitions: [] },
        })])).toBe(641);
        expect(traceTicks([])).toBe(0);
    });
});

describe('streamBoundaryFindings: the comparison that can be believed', () => {
    // The status pair is sampled the instant `botStart` returns, and a
    // re-boot's `FP.world = new Game(...)` only records a `_goto` — the swap
    // lands at END OF TICK. So the status still shows the old world's player.
    // An OBSERVATION is recorded by the bot's hook at the top of a live
    // frame and is never mid-swap.
    const s = (t, x, y, level = 0) => ({ ticks: [{ t, x, y, level }], transitions: [] });

    it('holds when the last observation and the first agree', () => {
        expect(streamBoundaryFindings(s(9, 264, 264), s(0, 264, 264))).toEqual([]);
    });

    it('names the field that is not continuous', () => {
        const f = streamBoundaryFindings(s(9, 264, 264), s(0, 263.2, 264));
        expect(f).toHaveLength(1);
        expect(f[0].what).toBe('x is not continuous across the boundary');
        expect(f[0].detail).toBe('264 → 263.2');
    });

    it('catches a level discontinuity', () => {
        expect(streamBoundaryFindings(s(9, 264, 264, 0), s(0, 264, 264, 12))
            .map((x) => x.what)).toContain('level is not continuous across the boundary');
    });

    it('refuses an empty stream rather than passing vacuously', () => {
        expect(streamBoundaryFindings({ ticks: [] }, s(0, 1, 1))).toHaveLength(1);
        expect(streamBoundaryFindings(null, s(0, 1, 1))).toHaveLength(1);
    });
});

describe('assertWindowEndsAtRest: the authoring rule the R4 bridge discovered', () => {
    const t = (inputs, tick_count = 100) => ({ tick_count, inputs });

    it('finds nothing when every span closes with room to coast', () => {
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 80 }]))).toEqual([]);
    });

    it('names a span that runs to tick_count — the key is still HELD', () => {
        // `r4-walk-1-sword` really is `{up 591..641}` with `tick_count` 641,
        // and the release edge fires at `to`, which the tick loop never
        // reaches. Every fixture before R5 got a fresh page, which released
        // the keys implicitly; a window does not, and the player walks off
        // the boundary while the game keeps ticking.
        const f = assertWindowEndsAtRest(t([{ key: 'up', from: 591, to: 641 }], 641));
        expect(f).toHaveLength(1);
        expect(f[0]).toMatch(/runs to tick_count \(641\).*still HELD/);
    });

    it('names a span that closes too late to coast to a stop', () => {
        const f = assertWindowEndsAtRest(t([{ key: 'primary', from: 90, to: 99 }]));
        expect(f).toHaveLength(1);
        expect(f[0]).toMatch(/releases only 1 tick\(s\) before the end/);
    });

    it('takes the coast length from the caller, since it is a physics number', () => {
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 95 }], 100),
            { coast: 3 })).toEqual([]);
        expect(assertWindowEndsAtRest(t([{ key: 'up', from: 10, to: 95 }], 100),
            { coast: 20 })).toHaveLength(1);
    });
});
