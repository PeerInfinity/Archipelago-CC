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
import { buildPlatformGraph, reachablePlatforms } from './canJump.js';
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

    it('always leaves a portal-free branch — never two portals on one row, top included', () => {
        for (let seed = 1; seed <= 8; seed++) {
            const level = braid(seed);
            const r = rows(level);
            const top = r[0]; // smallest y = top of the climb
            const platformY = new Map(level.platforms.map((p) => [p.id, p.y]));
            const portalsByY = new Map();
            for (const portal of level.portals) {
                const y = platformY.get(portal.on);
                portalsByY.set(y, (portalsByY.get(y) ?? 0) + 1);
            }

            // Every portal rides a 2-lane (fork) row, and NO row carries two
            // portals — so each fork always has a portal-free branch to climb.
            for (const row of r) {
                const y = row[0].y;
                if (portalsByY.has(y)) {
                    expect(row.length, `seed ${seed} portal row lane count`).toBe(2);
                    expect(portalsByY.get(y), `seed ${seed} portals on row y=${y}`).toBe(1);
                }
            }

            // The TOP row is itself a fork with a portal-free branch: two
            // platforms, exactly one portal.
            expect(top.length, `seed ${seed} top is a fork`).toBe(2);
            const topPortals = level.portals.filter((p) => top.some((pl) => pl.id === p.on));
            expect(topPortals.length, `seed ${seed} top has one portal + one free branch`).toBe(1);
        }
    });

    it('colored platforms follow the rules and keep every goal reachable', () => {
        const ALL = { left: true, right: true, springs: true, jetpacks: true, blue: true, brown: true };
        let blueTotal = 0, brownTotal = 0;
        for (let seed = 1; seed <= 8; seed++) {
            const level = generateLevelFromSpecs({
                id: `R${seed}`, exitSpecs, pickupSpecs, seed, physics: 'dj',
                mode: 'braid', braidWidth: WIDTH, jitter: 40, colorChance: 0.4,
            });
            const laneCountByY = new Map(rows(level).map((row) => [row[0].y, row.length]));
            for (const p of level.platforms) {
                // Blue (moving, full-width sweep) only on 1-lane rows; brown
                // (breaking, terminal) only on 2-lane rows (a pre-merge branch
                // or the top fork).
                if (p.type === 'blue') {
                    blueTotal++;
                    expect(laneCountByY.get(p.y), `seed ${seed} blue lane count`).toBe(1);
                }
                if (p.type === 'brown') {
                    brownTotal++;
                    expect(laneCountByY.get(p.y), `seed ${seed} brown lane count`).toBe(2);
                }
            }
            // Colored platforms must not strand any goal: every portal/pickup
            // host stays reachable with the full free ability set.
            const reach = reachablePlatforms(buildPlatformGraph(level, ALL, { constants: C }));
            for (const pt of level.portals) expect(reach.has(pt.on), `seed ${seed} portal ${pt.id}`).toBe(true);
            for (const pk of level.pickups) expect(reach.has(pk.on), `seed ${seed} pickup ${pk.id}`).toBe(true);
        }
        // The feature actually produces colored platforms at this chance.
        expect(blueTotal, 'blue platforms appear').toBeGreaterThan(0);
        expect(brownTotal, 'brown platforms appear').toBeGreaterThan(0);
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
