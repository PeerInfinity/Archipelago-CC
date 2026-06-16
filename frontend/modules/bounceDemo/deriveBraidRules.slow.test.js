/**
 * Step 1 of braid Regime 2 (NewDocs/plans/procedural-generation/braid-regime2.md),
 * the thorough regression guard: across many RANDOMISED fork-free chains and
 * EVERY ability subset, the row-aware deriveBraidAccessRules must produce the
 * SAME per-goal minimal sets (and defects) as the full-graph deriveAccessRules.
 *
 * Fork-free = one climbable platform per row (Regime-2 geometry), so down /
 * within-row-wrap edges are redundant and the adjacent-row flood is
 * verdict-identical to the full solver under partial abilities too. Chains mix
 * arrow gates (dx ±40), straights (dx 0) and pass-through moving blues — the
 * case that needs the flood's transparent-blue-row skip handling.
 *
 * Slow because each chain runs both derivers over 2^|universe| subsets.
 */
import { describe, it, expect } from 'vitest';
import { deriveAccessRules, deriveBraidAccessRules } from './deriveRules.js';
import { createRng } from '../shared/rng.js';
import { PROFILES } from './physics.js';

const C = PROFILES.dj.constants;
const W = 240;
const PLAIN_DY = 90;

// A random fork-free chain laid out like proposeBraidLevel (row 0 at the
// bottom, rungs stacked upward, uniform y-shift), with pickups sprinkled along
// it and a portal on top.
function randomChain(rng) {
    const n = 3 + Math.floor(rng.next() * 3);
    const plats = [{ id: 'b0', x: W / 2, y: 0, type: 'green' }];
    const pickups = [];
    let x = W / 2;
    let y = 0;
    for (let i = 1; i <= n; i++) {
        y -= PLAIN_DY;
        const roll = rng.next();
        let type = 'green';
        let dx = 0;
        if (roll < 0.5) dx = [-40, 0, 40][Math.floor(rng.next() * 3)]; // arrow gate / straight
        else if (roll < 0.65) type = 'blue';                            // pass-through blue (dx 0)
        x = (((x + dx) % W) + W) % W;
        plats.push({ id: `b${i}`, x, y, type });
        if (rng.next() < 0.4) pickups.push({ id: `pk${i}`, x, y: y - 20, on: `b${i}` });
    }
    const top = plats[plats.length - 1];
    const portals = [{ id: 'goal', x: top.x, y: top.y - 20, on: top.id, target_region: null, direction: 'up' }];
    let minY = 0;
    for (const p of plats) minY = Math.min(minY, p.y);
    const shiftY = 60 - minY;
    for (const p of plats) p.y += shiftY;
    for (const pk of pickups) pk.y += shiftY;
    for (const pt of portals) pt.y += shiftY;
    for (const p of plats) if (p.type === 'blue') p.sweep = { min: 10, max: W - 10 };
    return { id: 'c', size: { width: W, height: shiftY + 100 }, platforms: plats, springs: [], jetpacks: [], pickups, portals };
}

describe('deriveBraidAccessRules — fork-free fuzz vs full solver (all subsets)', () => {
    it('matches the full deriveAccessRules on random fork-free chains', () => {
        const rng = createRng(12345);
        let goalsChecked = 0;
        for (let t = 0; t < 24; t++) {
            const level = randomChain(rng);
            const full = deriveAccessRules(level, { constants: C });
            const braid = deriveBraidAccessRules(level, { constants: C });
            expect(braid.defects, `chain ${t} defects`).toEqual(full.defects);
            for (const kind of ['exits', 'pickups']) {
                for (const id of Object.keys(full[kind])) {
                    expect(braid[kind][id].minimalSets, `chain ${t} ${kind} ${id}`)
                        .toEqual(full[kind][id].minimalSets);
                    goalsChecked++;
                }
            }
        }
        expect(goalsChecked).toBeGreaterThanOrEqual(24); // sanity: ≥1 goal/chain exercised
    });
});
