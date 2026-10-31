/**
 * ⛓ seedling-gen-new-biomes (C4) — THE HEAVY ROWS (slow tier: each room is a generator
 * run, 1–18 s apiece on the dev box).
 *
 * 1. **EVERY NEW BIOME CERTIFIES — THE BOUND IS 3 SEEDS PER BIOME** (1, 2, 3, at 10×10
 *    with one exit, the biome's default elements, drawn in its own look): the room
 *    builds at re-roll 0 and `certifyGenRoom` passes. Measured 9/9 on the dev box
 *    before this row was written; caldera paints melt and frozen-forge lava on ≥ 1 seed.
 * 2. **CALDERA'S MELT CUTS BEFORE THE DARK SUIT.** caldera, seed 1, `empty`, eight
 *    obstacles: the start reaches the goal on caldera's flood and NOT on post-sword's,
 *    so a crust is on every route — and the level certified (no lava death).
 * 3. **THE EXISTING OUTPUTS DO NOT MOVE.** The flood and the oracle's no-lava-death
 *    rule are the two shared edits. The 15 old-biome digests are
 *    `seedlingGenBiomes.slow.test.js`'s; these 28 are the four presets' and the
 *    terrains' rooms and lab records, measured at BASE 2ce525e323 (before this slice)
 *    and again on the slice's tree: identical.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { floodTerrainsFor, terrainAt } from './procgenLevel.js';
import { CALDERA_PALETTE, POST_SWORD_ITEMS } from './procgenPalette.js';
import { generateSeedlingLevel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { GEN_LOOKS } from './procgenLook.js';
import { certifyGenRoom, generateGenRoom, serializeGenRoom } from './seedlingGenRoom.js';
import { generateStep } from './watchGenerate.js';
import { connected } from '../procgenCore/gridFlood.js';

const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const payloadOf = (seedlingGen, seed) => serializeGenRoom(generateGenRoom({
    region_id: 'r', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(seed), params: { seedlingGen },
}).world, null, null, null, {});
const paintedTerrains = (record) => new Set(record.layers[0].tiles.map(([x, y]) => terrainAt(record, x, y)));

const SEEDS = [1, 2, 3];
describe('C4 — every new biome builds and CERTIFIES (3 seeds each, its own look)', () => {
    it.each([['caldera', ['melt']], ['frozen-forge', ['lava']], ['flooded-ruins', ['water']]])('%s', (biome, painted) => {
        const seen = new Set();
        for (const seed of SEEDS) {
            const p = payloadOf({ biome, look: biome }, seed);
            expect(p.generation).toMatchObject({ biome, look: biome, rerolls: 0 });
            expect(p.record.layers[0].tiles.some((t) => t[2] === GEN_LOOKS[biome].floor * 16)).toBe(true);
            expect(certifyGenRoom(p, 'r'), `${biome} seed ${seed}`).toEqual({ certified: true, failures: [] });
            for (const t of paintedTerrains(p.record)) seen.add(t);
        }
        for (const t of painted) expect([...seen], `${biome}: some seed paints ${t}`).toContain(t);
    }, 300_000);
});

describe('C4 — caldera\'s melt cuts before the dark suit', () => {
    it('caldera seed 1 (`empty`, 8 obstacles): reachable on caldera\'s flood, not on post-sword\'s; certified', () => {
        const out = generateSeedlingLevel({ seed: 1, palette: CALDERA_PALETTE,
            bounds: { obstacleTarget: 8, triesPerStep: 4, saturationK: 4 }, skeleton: seedlingSkeletonSpec('empty') });
        expect(out.summary.stop).toBe('TARGET_REACHED');
        const reach = (walks) => connected(out.record.width, out.record.height,
            (x, y) => walks.includes(terrainAt(out.record, x, y)),
            { x: out.model.defaults.start.tx, y: out.model.defaults.start.ty },
            { x: out.summary.goalCell.tx, y: out.summary.goalCell.ty });
        expect(reach(floodTerrainsFor(CALDERA_PALETTE.items, CALDERA_PALETTE.floodWalks))).toBe(true);
        expect(reach(floodTerrainsFor(POST_SWORD_ITEMS))).toBe(false);
        expect(out.summary.items).toEqual(POST_SWORD_ITEMS);
        expect(out.summary.pins).toContain('sound');
    }, 300_000);
});

/** Measured at base 2ce525e323 and on this slice: identical. */
const BASE_DIGESTS = Object.freeze({
    'room post-fire 1': '65523314d6d79f42',
    'room post-fire 2': 'df39b8c15f541bff',
    'room post-fire 3': 'ed93a0cd9941084b',
    'room post-spear 1': 'e2cade35ac2448c8',
    'room post-spear 2': 'da1f6522d08ddf01',
    'room post-spear 3': 'c553d494f1abcfab',
    'room post-dark-suit 1': '030cd727c9837fea',
    'room post-dark-suit 2': '88252a2f0196e99e',
    'room post-dark-suit 3': '5359aa69f6eaa93b',
    'room endgame 1': 'c341ef82a7f4fe2d',
    'room endgame 2': 'abd253820cd8adc2',
    'room endgame 3': '064ae17d9f7253ec',
    'room post-swim+ice 1': '6fb3d7adba32d01e',
    'room post-swim+ice 2': 'da370593922a0ef4',
    'room post-swim+ice 3': 'c72ebbfabe0fbfc7',
    'room post-feather+stairs 1': 'f35531fd1f033045',
    'room post-feather+stairs 2': 'da58cfe9d4b70e7e',
    'room post-feather+stairs 3': 'c9d1180f800531ec',
    'room post-feather+ghoststep 1': '5cca5b3891d69d9e',
    'room post-feather+ghoststep 2': '034a471b90ff0db2',
    'room post-feather+ghoststep 3': '7b459e95685d05ac',
    'room post-feather+ghoststep,stairs 1': '945d3e15b709ff01',
    'room post-feather+ghoststep,stairs 2': 'fb163d1a85a7e318',
    'room post-feather+ghoststep,stairs 3': 'b581a6d13ab53a4b',
    'lab post-fire': 'f2eec8d91bdca36c',
    'lab post-spear': '3b5a718835db0dd6',
    'lab post-dark-suit': '3b5a718835db0dd6',
    'lab endgame': '3b5a718835db0dd6',
});

describe('C4 — the presets\' and terrains\' outputs are byte-identical', () => {
    it.each(Object.keys(BASE_DIGESTS))('%s', (key) => {
        const [kind, name, seed] = key.split(' ');
        const [biome, terrains] = name.split('+');
        const got = kind === 'room' ? payloadOf({ biome, ...(terrains ? { terrains } : {}) }, Number(seed))
            : generateStep({ seed: 1, biome, step: 2 }).record;
        expect(sha(got)).toBe(BASE_DIGESTS[key]);
    }, 180_000);
});
