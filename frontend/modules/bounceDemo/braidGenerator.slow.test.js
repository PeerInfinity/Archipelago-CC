/**
 * The 2-wide braid proposer (Regime 1: arrows free) — generateLevelFromSpecs
 * with mode:'braid'. Unlike the fixed-column proposer, the braid lives on the
 * [0,width) wrap ring, so it fits NARROW widths (240) the column model can't,
 * and it verifies by pure REACHABILITY (every goal reachable with {left,right})
 * rather than per-goal minimal-set matching.
 *
 * Slow because each attempt runs the real deriveAccessRules verifier.
 */
import { describe, it, expect } from 'vitest';
import { generateLevelFromSpecs } from './generator.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const WIDTH = 240;

// Adventure-Overworld-ish: several portals + pickups, no abilities (Regime 1).
const exitSpecs = ['toN', 'toE', 'toW', 'toS'].map((id) => ({ id, requirement: [] }));
const pickupSpecs = Array.from({ length: 6 }, (_, i) => ({ id: `loc_${i}`, requirement: [] }));

function braid(seed, jitter = 40) {
    return generateLevelFromSpecs({
        id: `R${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj', mode: 'braid', braidWidth: WIDTH, jitter,
    });
}

// Group platforms into rows by y; return rows ordered top→bottom.
function rows(level) {
    const byY = new Map();
    for (const p of level.platforms) {
        if (!byY.has(p.y)) byY.set(p.y, []);
        byY.get(p.y).push(p);
    }
    return [...byY.keys()].sort((a, b) => a - b).map((y) => byY.get(y));
}

describe('braid generator (Regime 1, width 240)', () => {
    it('produces a fixed-240-wide, fully reachable level the column model cannot fit', () => {
        for (let seed = 1; seed <= 8; seed++) {
            const level = braid(seed);
            expect(level.size.width, `seed ${seed} width`).toBe(WIDTH);
            expect(validateLevel(level), `seed ${seed} validate`).toEqual([]);

            const derived = deriveAccessRules(level, { constants: C });
            expect(derived.defects, `seed ${seed} defects`).toEqual([]);
            // Every goal reachable using only the free arrows.
            const free = (d) => d?.minimalSets?.length > 0
                && d.minimalSets.some((set) => set.every((a) => a === 'left' || a === 'right'));
            for (const e of exitSpecs) expect(free(derived.exits[e.id]), `seed ${seed} exit ${e.id}`).toBe(true);
            for (const pk of pickupSpecs) expect(free(derived.pickups[pk.id]), `seed ${seed} pickup ${pk.id}`).toBe(true);
        }
    });

    it('never exceeds two active lanes per row', () => {
        for (let seed = 1; seed <= 8; seed++) {
            for (const row of rows(braid(seed))) {
                expect(row.length, `seed ${seed} lane count`).toBeLessThanOrEqual(2);
            }
        }
    });

    it('places every portal on a fork branch or the single-lane top capstone', () => {
        for (let seed = 1; seed <= 8; seed++) {
            const level = braid(seed);
            const r = rows(level);
            const top = r[0]; // smallest y = top of the climb
            const laneCountByY = new Map(r.map((row) => [row[0].y, row.length]));
            const platformY = new Map(level.platforms.map((p) => [p.id, p.y]));
            const topIds = new Set(top.map((p) => p.id));

            // The capstone row is a single lane and hosts a portal.
            expect(top.length, `seed ${seed} capstone lane count`).toBe(1);
            expect(level.portals.some((p) => topIds.has(p.on)), `seed ${seed} capstone portal`).toBe(true);

            // Every portal is on a 2-lane (fork-branch) row OR the top capstone.
            for (const portal of level.portals) {
                const y = platformY.get(portal.on);
                const onFork = laneCountByY.get(y) === 2;
                const onCapstone = topIds.has(portal.on);
                expect(onFork || onCapstone, `seed ${seed} portal ${portal.id} placement`).toBe(true);
            }
        }
    });

    it('routes different portals to different steering choices (meaningful forks)', () => {
        // Across seeds, at least some level must require both a left-only and a
        // right-only portal — proof the forks are real choices, not decoration.
        let sawLeft = false, sawRight = false;
        for (let seed = 1; seed <= 8; seed++) {
            const level = braid(seed);
            const derived = deriveAccessRules(level, { constants: C });
            for (const e of exitSpecs) {
                const sets = derived.exits[e.id].minimalSets;
                if (sets.some((s) => s.length === 1 && s[0] === 'left')) sawLeft = true;
                if (sets.some((s) => s.length === 1 && s[0] === 'right')) sawRight = true;
            }
        }
        expect(sawLeft && sawRight).toBe(true);
    });
});
