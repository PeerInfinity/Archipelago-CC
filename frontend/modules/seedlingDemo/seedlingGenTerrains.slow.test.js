/**
 * ⛓ seedling-gen-terrains (C3) — THE HEAVY ROWS (slow tier: each room is a generator
 * run, 0.4–2 s apiece on the dev box, and the REQUIRED grade is ten more solves).
 *
 * 1. **THE KNOB IS ABSENT BY DEFAULT.** `terrains: ''` builds the same room as no
 *    knob at all, with no `terrains` key in `generation`; the 15 old-biome digests are
 *    `seedlingGenBiomes.slow.test.js`'s and stay green there.
 * 2. **EVERY TERRAIN-BIOME CERTIFIES — THE BOUND IS 3 SEEDS EACH** (1, 2, 3, at 10×10
 *    with one exit and the biome's default elements): ice in post-swim, stairs and
 *    ghost step in post-feather (each alone and both), and the D7 presets' defaults.
 *    The room builds at re-roll 0 and `certifyGenRoom` passes. Measured 21/21 on the
 *    dev box before this row was written; the terrain is painted on ≥ 1 seed of 3.
 * 3. **A LAVA CUT GRADES THE DARK SUIT REQUIRED.** post-dark-suit, seed 10, `empty`,
 *    eight obstacles: three `lava-pool`s and a `melt-patch` close every ground route
 *    (the floods walk lava with the suit), and the differential's without-suit arm is
 *    REFUSED by the solver — STRONG.
 */
import { describe, it, expect } from 'vitest';

import { floodTerrainsFor, terrainAt } from './procgenLevel.js';
import { POST_DARK_SUIT_PALETTE } from './procgenPalette.js';
import { generateSeedlingLevel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { requirementsFor } from './procgenRequirements.js';
import { certifyGenRoom, generateGenRoom, serializeGenRoom } from './seedlingGenRoom.js';
import { connected } from '../procgenCore/gridFlood.js';

const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const payloadOf = (seedlingGen, seed) => serializeGenRoom(generateGenRoom({
    region_id: 'r', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(seed), params: { seedlingGen },
}).world, null, null, null, {});
const paintedTerrains = (record) => new Set(record.layers[0].tiles.map(([x, y]) => terrainAt(record, x, y)));

describe('C3 — the `terrains` knob is absent by default', () => {
    it('post-swim: `terrains: \'\'` is the room with no knob, and `generation` gains no key', () => {
        const bare = payloadOf({ biome: 'post-swim' }, 1);
        const empty = payloadOf({ biome: 'post-swim', terrains: '' }, 1);
        expect(JSON.stringify(empty)).toBe(JSON.stringify(bare));
        expect('terrains' in bare.generation).toBe(false);
        expect(payloadOf({ biome: 'post-swim', terrains: 'ice' }, 1).generation.terrains).toBe('ice');
    }, 180_000);

    it('an unoffered terrain is a `badKnob` refusal BY NAME', () => {
        expect(() => payloadOf({ biome: 'post-sword', terrains: 'ice' }, 1))
            .toThrow(/terrains.*does not offer the terrain "ice"/s);
    }, 60_000);
});

const SEEDS = [1, 2, 3];
const COMBOS = [
    ['post-swim', 'ice', ['ice']],
    ['post-feather', 'stairs', ['stairs']],
    ['post-feather', 'ghoststep', ['ghoststep']],
    ['post-feather', 'ghoststep,stairs', ['ghoststep', 'stairs']],
    ['post-spear', '', ['melt']],
    ['post-dark-suit', '', ['lava', 'melt']],
    ['endgame', '', ['lava', 'melt']],
];
describe('C3 — every terrain-biome builds and CERTIFIES (3 seeds each)', () => {
    it.each(COMBOS)('%s terrains=%j', (biome, terrains, expectPainted) => {
        const seen = new Set();
        for (const seed of SEEDS) {
            const p = payloadOf({ biome, ...(terrains ? { terrains } : {}) }, seed);
            expect(p.generation).toMatchObject({ biome, rerolls: 0 });
            expect(p.generation.terrains).toBe(terrains || undefined);
            expect(certifyGenRoom(p, 'r'), `${biome} seed ${seed}`).toEqual({ certified: true, failures: [] });
            for (const t of paintedTerrains(p.record)) seen.add(t);
        }
        for (const t of expectPainted) expect([...seen], `${biome}: some seed paints ${t}`).toContain(t);
    }, 300_000);
});

describe('C3 — a lava cut grades the dark suit REQUIRED', () => {
    it('post-dark-suit seed 10 (`empty`, 8 obstacles): the cut is lava, and `hasDarkSuit` is REQUIRED, STRONG', () => {
        const out = generateSeedlingLevel({ seed: 10, palette: POST_DARK_SUIT_PALETTE,
            bounds: { obstacleTarget: 8, triesPerStep: 4, saturationK: 4 }, skeleton: seedlingSkeletonSpec('empty') });
        expect(out.summary.stop).toBe('TARGET_REACHED');
        /** ⛓ The cut: with the dark suit the start reaches the goal; on the pre-suit floods it does not. */
        const reach = (walks) => connected(out.record.width, out.record.height,
            (x, y) => walks.includes(terrainAt(out.record, x, y)),
            { x: out.model.defaults.start.tx, y: out.model.defaults.start.ty },
            { x: out.summary.goalCell.tx, y: out.summary.goalCell.ty });
        expect(reach(floodTerrainsFor(POST_DARK_SUIT_PALETTE.items))).toBe(true);
        expect(reach(floodTerrainsFor(null))).toBe(false);
        expect(out.summary.pins).toContain('sound');
        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_DARK_SUIT_PALETTE,
            summary: out.summary, seed: 10, biome: 'post-dark-suit',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks });
        const row = rep.rows.find((r) => r.flag === 'hasDarkSuit');
        expect(row.verdict).toBe('REQUIRED');
        expect(row.withoutVerdict).toBe('REFUSED');
        expect(row.evidence).toBe('STRONG (solver refusal)');
    }, 300_000);
});
