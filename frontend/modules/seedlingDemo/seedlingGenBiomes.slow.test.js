/**
 * ⛓ seedling-gen-biomes-1 (C1 + C2) — THE HEAVY ROWS (slow tier: each room is a
 * generator run, 4–40 s apiece on the dev box).
 *
 * 1. **BYTE IDENTITY AT THE DEFAULT.** The five old biomes' gen rooms (seeds 1, 2)
 *    and lab ladder records (seed 1, step 2) are pinned by digest. Every digest was
 *    measured on the BASE commit (9c0f904549, before this slice) and again on the
 *    slice's tree, and the two lists were equal.
 * 2. **EVERY NEW PRESET CERTIFIES — THE BOUND IS 3 SEEDS PER PRESET** (1, 2, 3, at
 *    10×10 with one exit, the biome's default elements, drawn in the preset's own
 *    look): the room builds at re-roll 0 and `certifyGenRoom` passes. Measured
 *    12/12 on the dev box before this row was written.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { GEN_LOOKS } from './procgenLook.js';
import { certifyGenRoom, generateGenRoom, serializeGenRoom } from './seedlingGenRoom.js';
import { generateStep } from './watchGenerate.js';

const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const payloadOf = (seedlingGen, seed) => serializeGenRoom(generateGenRoom({
    region_id: 'r', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(seed), params: { seedlingGen },
}).world, null, null, null, {});

/** Measured at base 9c0f904549 and on this slice: identical. */
const BASE_DIGESTS = Object.freeze({
    'room pre-sword 1': '057aba413bd143dd',
    'room pre-sword 2': '840a937f37415e18',
    'lab pre-sword': '78bb246b30d371eb',
    'room post-sword 1': 'aad591ec0d02b88d',
    'room post-sword 2': '373fb0d888a8cffd',
    'lab post-sword': 'f2eec8d91bdca36c',
    'room post-shield 1': 'deb69255c988dd85',
    'room post-shield 2': '5713789c2e3b093b',
    'lab post-shield': 'f2eec8d91bdca36c',
    'room post-swim 1': '626d3b038577faa3',
    'room post-swim 2': '91b15d28f1d8ebc2',
    'lab post-swim': 'aeac6fa85ba6fe43',
    'room post-feather 1': '93888643fa2b52de',
    'room post-feather 2': '29327f906a5b0ada',
    'lab post-feather': 'aeac6fa85ba6fe43',
});

describe('C1 — the five old biomes are byte-identical at the default (no look)', () => {
    it.each(Object.keys(BASE_DIGESTS))('%s', (key) => {
        const [kind, biome, seed] = key.split(' ');
        const got = kind === 'room' ? payloadOf({ biome }, Number(seed))
            : generateStep({ seed: 1, biome, step: 2 }).record;
        expect(sha(got)).toBe(BASE_DIGESTS[key]);
    }, 180_000);
});

const PRESET_SEEDS = [1, 2, 3];
describe('C2 — every new preset builds and CERTIFIES (3 seeds each, its own look)', () => {
    const rows = ['post-fire', 'post-spear', 'post-dark-suit', 'endgame']
        .flatMap((biome) => PRESET_SEEDS.map((seed) => [biome, seed]));
    it.each(rows)('%s seed %i', (biome, seed) => {
        const p = payloadOf({ biome, look: biome }, seed);
        expect(p.generation).toMatchObject({ biome, look: biome, rerolls: 0 });
        const floorColumn = GEN_LOOKS[biome].floor * 16;
        expect(p.record.layers[0].tiles.some((t) => t[2] === floorColumn)).toBe(true);
        expect(certifyGenRoom(p, 'r')).toEqual({ certified: true, failures: [] });
    }, 180_000);
});
