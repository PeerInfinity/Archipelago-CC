/**
 * ⛓⛓ NIT (B), FIXED (rules-engine-nit-b, ⚖ Robert 2026-11-21 "Engine nit (B) fix"): the up-set guard (`learnLattice.pullUpSet`,
 * `deriveLevelWorldLogic`'s `upSetJudge`). A pull whose gate clears on an axis item makes reach NON-MONOTONE: holding the gate
 * (Seedling: the Dark Suit, never shed — `learnLattice.js` cites the AS3), a step into its disc from outside is reeled onto the
 * trap. AP rules are upward-closed, so a set may be granted only when EVERY superset reaches; the walks' `covered` skip used to
 * grant the supersets of a minimal set unsearched.
 *
 * The world is SYNTHETIC (a test fixture, no level data): one row, a pull disc WIDER THAN ITS TONGUE.
 *
 *     x:   0      1      2              3                4
 *          A      A      L              L                T
 *          start  floor  LANDING+chest  Ghost Spear gate  trap (pull_4_0: Dark Suit)
 *                        └──────── the disc of (4,0) ────────┘
 *
 * (2,0) is the landing region's ARRIVAL inside the disc, never charged — the shape of rule T's `exempt` cells (arrival landings,
 * `make-seedling-playthrough-rules.mjs`), the one hole designer tile-primitives-design-8 found. From A:
 *   ∅            walks onto (2,0) (no suit, no reel)                         → reaches the landing
 *   {Dark Suit}  the step (1,0)→(2,0) is reeled onto (4,0); (3,0) is shut  → LOSES it
 *   {Ghost Spear}                                                           → reaches it
 *   {both}       reeled onto (4,0), then back through (3,0)                 → reaches it
 * The upward-closed answer is [[Ghost Spear]]; the unguarded walk said [[]] (free), which the Dark Suit alone refutes.
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic, deriveEntryLogic, distinctArrivals, enteredAt, nativeReachUnder } from './deriveLevelWorldLogic.js';
import { pullUpSet, assertMonotoneWorld } from './learnLattice.js';
import { regionItems, regionLevels, latticeAxis, latticePoints, pointCovers, regionTargets, reachedTarget } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const SUIT = 'Dark Suit';
const SPEAR = 'Ghost Spear';
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const SYN = Object.freeze({
    // row 1 is wall (the engine's smallest grid is 2 x 2)
    width: 5, height: 2, tiles: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], entrance: { x: 0, y: 0 }, exits: [],
    obstacles: [{ x: 3, y: 0, id: 'spear_gate' }],
    items: [{ x: 2, y: 0, id: 'Seal', locationName: 'Synthetic - Landing Chest' }],
    obstacleLib: {
        spear_gate: { id: 'spear_gate', name: 'spear gate', clear_set_type: 'rule', clear_rule: has(SPEAR) },
        pull_4_0: { id: 'pull_4_0', name: 'lavatrap@64,0', kind: 'pull', clear_set_type: 'rule', clear_rule: has(SUIT) },
    },
    pulls: [{ x: 4, y: 0, from: [{ x: 2, y: 0 }, { x: 3, y: 0 }], gate: 'pull_4_0' }],
    shared_world: {
        key: 'syn', regions: ['syn__a', 'syn__landing', 'syn__trap'], rows: ['AABBC', '.....'],
        entrances: { syn__a: { x: 0, y: 0 }, syn__landing: { x: 2, y: 0 }, syn__trap: { x: 4, y: 0 } },
    },
});
const world = (payload = SYN) => deserializeMazeWorld(structuredClone(payload));
const pairOf = (out, from, to) => out.pairs.find((p) => p.from === from && p.to === to);
const chestOf = (out) => out.targets.find((t) => t.locationName === 'Synthetic - Landing Chest');
const LANDING = ['syn__a', 'syn__landing'];

/** Ground truth by brute force (the D0 tool's): the minimal S such that EVERY lattice point ⊇ S reaches `ok`. */
function upwardMinimal(w, ok) {
    const axis = latticeAxis(regionItems(w), regionLevels(w));
    const points = [...latticePoints(axis)];
    const good = points.filter((s) => points.every((t) => !pointCovers(t, s) || ok(t)));
    return good.filter((s) => !good.some((m) => m !== s && pointCovers(s, m) && m.length < s.length));
}

describe('the synthetic world: a pull disc wider than its tongue, with a landing inside it', () => {
    it('reach really is non-monotone there (the native engine, every lattice point)', () => {
        const w = world();
        const from = enteredAt(w, 'syn__a');
        const at = (inv) => nativeReachUnder(from, inv).cells.has('2,0');
        expect([at([]), at([SUIT]), at([SPEAR]), at([SUIT, SPEAR])]).toEqual([true, false, true, true]);
    });

    it('the census ROUTES the pull by name: its gate, its sub-axis item, and the class-minimal raises of a point', () => {
        const w = world();
        const axis = latticeAxis(regionItems(w), regionLevels(w));
        expect(axis.map((a) => a.item)).toEqual([SUIT, SPEAR]);
        expect(() => assertMonotoneWorld(w, regionItems(w))).not.toThrow(); // the old census does not see it
        const guard = pullUpSet(w, axis);
        expect(guard.pulls).toEqual([{ x: 4, y: 0, gate: 'pull_4_0', items: [SUIT] }]);
        expect(guard.probes([])).toEqual([[], [SUIT]]);
        expect(guard.probes([SPEAR])).toEqual([[SPEAR], [SUIT, SPEAR]]);
        expect(guard.probes([SUIT, SPEAR])).toEqual([[SUIT, SPEAR]]); // the top class: nothing above to raise to
        expect(guard.probes([], SUIT)).toEqual([[]]); // an excluded (own-event) item is never raised
    });

    it('the census REFUSES by name a gate that clears on an item off the axis', () => {
        const w = world();
        expect(() => pullUpSet(w, latticeAxis([SPEAR]))).toThrow(/pull at \(4,0\) clears its gate pull_4_0 on Dark Suit, off the item axis/);
    });

    it('no axis-gated pull → no guard (every other world walks byte-identically)', () => {
        const plain = structuredClone(SYN);
        delete plain.pulls;
        delete plain.obstacleLib.pull_4_0;
        const w = world(plain);
        expect(pullUpSet(w, latticeAxis(regionItems(w), regionLevels(w)))).toBeNull();
        const open = structuredClone(SYN);
        open.obstacleLib.pull_4_0.clear_rule = { rule: 'True_' }; // always armed: one class, monotone
        const wo = world(open);
        expect(pullUpSet(wo, latticeAxis(regionItems(wo), regionLevels(wo)))).toBeNull();
    });
});

describe('the derives grant the UPWARD-CLOSED rule (pairs, targets, both walks)', () => {
    const truth = (to) => {
        const w = world();
        const from = enteredAt(w, 'syn__a');
        return upwardMinimal(w, (s) => [...nativeReachUnder(from, s).cells.keys()].some((c) => {
            const [x, y] = c.split(',').map(Number);
            return w.sharedWorld.rows[y][x] === { syn__a: 'A', syn__landing: 'B', syn__trap: 'C' }[to];
        }));
    };

    it('pair A → landing: [[Ghost Spear]] (the brute-force truth), with its witness', () => {
        const out = deriveLevelWorldLogic(world(), HELPERS, { native: true });
        const p = pairOf(out, ...LANDING);
        expect(truth('syn__landing')).toEqual([[SPEAR]]);
        expect(p.unreachable).toBe(false);
        expect(p.minimal).toEqual([[SPEAR]]);
        expect(p.witnesses.map((x) => x.inventory)).toEqual([[SPEAR]]);
        expect(out.engine.upSet).toBe(1); // ∅ took it, and its superset {Dark Suit} refuted it
    });

    it('every pair equals the brute-force truth, on the rank walk AND the learning walk', () => {
        for (const walk of ['rank', 'learn']) {
            const out = deriveLevelWorldLogic(world(), HELPERS, { native: true, walk });
            for (const p of out.pairs.filter((q) => q.from === 'syn__a')) {
                expect(p.unreachable ? [] : p.minimal, `${walk}: ${p.from} → ${p.to}`).toEqual(truth(p.to));
            }
        }
    });

    it('the scripted step agrees with the native one', () => {
        const native = deriveLevelWorldLogic(world(), HELPERS, { native: true });
        const scripted = deriveLevelWorldLogic(world(), HELPERS, { native: false });
        expect(scripted.pairs.map((p) => [p.from, p.to, p.unreachable, p.minimal])).toEqual(native.pairs.map((p) => [p.from, p.to, p.unreachable, p.minimal]));
    });

    it('the landing\'s chest priced from A (deriveEntryLogic): [[Ghost Spear]] on both walks', () => {
        const w = world();
        const from = enteredAt(w, 'syn__a');
        const chest = regionTargets(w).find((t) => t.x === 2 && t.y === 0);
        expect(upwardMinimal(w, (s) => reachedTarget(nativeReachUnder(from, s), chest, s, from))).toEqual([[SPEAR]]);
        for (const walk of ['rank', 'learn']) {
            const t = chestOf(deriveEntryLogic(w, 'syn__landing', HELPERS, { native: true, arriveFrom: 'syn__a', walk }));
            expect(t.unreachable, walk).toBe(false);
            expect(t.minimal, walk).toEqual([[SPEAR]]);
        }
    });

    it('MUTANT (the fix reverted, `upSetGuard: false`): the pair and the chest read FREE — the loose grant, red', () => {
        const w = world();
        expect(pairOf(deriveLevelWorldLogic(w, HELPERS, { native: true, upSetGuard: false }), ...LANDING).minimal).toEqual([[]]);
        expect(pairOf(deriveLevelWorldLogic(w, HELPERS, { native: true, upSetGuard: false, walk: 'learn' }), ...LANDING).minimal).toEqual([[]]);
        expect(chestOf(deriveEntryLogic(w, 'syn__landing', HELPERS, { native: true, arriveFrom: 'syn__a', upSetGuard: false })).minimal).toEqual([[]]);
    });

    it('the FULL-point prune stays (sound under upward closure): a pair the top point misses is unreachable at every S', () => {
        const shut = structuredClone(SYN);
        shut.tiles[3] = 1; // (3,0) a wall: holding the suit the landing is never reached again, so no S has every superset reach
        const w = world(shut);
        const p = pairOf(deriveLevelWorldLogic(w, HELPERS, { native: true }), ...LANDING);
        expect(nativeReachUnder(enteredAt(w, 'syn__a'), []).cells.has('2,0')).toBe(true); // ∅ alone does reach it
        expect(p.unreachable).toBe(true);
        expect(p.minimal).toEqual([]);
    });

    it('distinctArrivals never dedupes in an axis-gated pull world (two arrivals that meet holding nothing)', () => {
        const w = world();
        const arrivals = [null, { x: 1, y: 0 }];
        expect(distinctArrivals(enteredAt(w, 'syn__a'), arrivals)).toEqual(arrivals);
        const plain = structuredClone(SYN);
        delete plain.pulls;
        delete plain.obstacleLib.pull_4_0;
        expect(distinctArrivals(enteredAt(world(plain), 'syn__a'), arrivals)).toEqual([null]);
    });
});
