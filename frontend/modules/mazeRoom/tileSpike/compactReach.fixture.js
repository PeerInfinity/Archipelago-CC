/**
 * The compact reach cache's equality check (session tile-l12-one-world), shared by `compactReach.test.js` (default tier) and
 * `learnLattice.train.test.js` (L12 as one level world). Test-only.
 */
import { expect } from 'vitest';
import { nativeReachUnder, compactReach, enteredAt } from './deriveLevelWorldLogic.js';
import { regionItems, regionLevels, latticeAxis, latticePoints, fullPoint } from './deriveTileLogic.js';

/** Every arrival of a world (each member's entrance, or the world's own), with a deterministic sample of lattice points. */
export function samples(world, perArrival) {
    const axis = latticeAxis(regionItems(world), regionLevels(world));
    const all = [...latticePoints(axis)];
    const step = Math.max(1, Math.floor(all.length / perArrival));
    const pts = [fullPoint(axis), ...all.filter((_, i) => i % step === 0)];
    const arrivals = world.sharedWorld ? world.sharedWorld.regions.map((r) => enteredAt(world, r)) : [world];
    return arrivals.flatMap((w) => pts.map((p) => [w, p]));
}

/** Compact ≡ full at every sampled (arrival, point); returns how many plans were compared. Throws on the first difference. */
export function check(world, perArrival) {
    let plans = 0;
    for (const [w, set] of samples(world, perArrival)) {
        const full = nativeReachUnder(w, set);
        const c = compactReach(full, (mutant) => nativeReachUnder(w, mutant ? mutant(set) : set));
        expect(c.states).toBe(full.states);
        expect([...c.cells.keys()]).toEqual([...full.cells.keys()]);
        for (let y = -1; y <= (w.height ?? 64); y++) for (let x = -1; x <= (w.width ?? 64); x++) {
            if (c.cells.has(`${x},${y}`) !== full.cells.has(`${x},${y}`)) throw new Error(`has(${x},${y}) differs at [${set}]`);
        }
        expect([...c.cuts.keys()]).toEqual([...full.cuts.keys()]);
        // A sample of cells (first, middle, last) and every cut: the lazy plan ≡ the original plan (one re-search each).
        const keys = [...full.cells.keys()];
        for (const cell of new Set([keys[0], keys[keys.length >> 1], keys[keys.length - 1]])) {
            expect(c.planTo(cell)).toEqual(full.planTo(cell));
            plans += 1;
        }
        for (const k of full.cuts.keys()) { expect(c.planToCut(k)).toEqual(full.planToCut(k)); plans += 1; }
    }
    return plans;
}

