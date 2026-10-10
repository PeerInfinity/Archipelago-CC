#!/usr/bin/env node
/**
 * dump-seedling-gen-capacity — ⛓ SEEDLING HAMMER-PHASE B2: `seedlingGenCapacity.slow`'s census AS A DUMP (the draws
 * and their seating, one row per drawn seed), so the capacity rows' certify solves can be captured and re-solved by
 * `check-seedling-hammer-monotonicity` (a vitest file runs under its own module loader, which that capture cannot
 * hook) and its rows compared between two runs. It prints; the caller compares.
 *
 * Per (biome, seed): the room `generateGenRoom` draws at the census's knobs (10×10, two doors, the biome default),
 * then `placeGenItems` of 30 — its re-rolls, a growth, and an md5 of the seated tags — or the refusal's head. The
 * killgate row (`--killgate`) is `seedlingGenCapacity.test.js`'s: post-sword, ONE door, `elements: 'killgate'`.
 *
 * Run:
 *   node scripts/procgen/dump-seedling-gen-capacity.mjs                              # both biomes, seeds 1..60
 *   node scripts/procgen/dump-seedling-gen-capacity.mjs --biomes=post-sword --seeds=1-60
 *   node scripts/procgen/dump-seedling-gen-capacity.mjs --killgate --seeds=53,57
 */

import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

const seedList = (arg) => arg.split(',').flatMap((part) => {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`--seeds: cannot read "${part}"`);
    const lo = Number(m[1]);
    const hi = m[2] === undefined ? lo : Number(m[2]);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const argv = process.argv.slice(2);
    const valueOf = (flag) => {
        const a = argv.find((x) => x.startsWith(`${flag}=`));
        return a ? a.slice(flag.length + 1) : null;
    };
    const KILLGATE = argv.includes('--killgate');
    const biomes = (valueOf('--biomes') ?? (KILLGATE ? 'post-sword' : 'pre-sword,post-sword')).split(',');
    const seeds = seedList(valueOf('--seeds') ?? '1-60');
    const room = await import(join(MODULE, 'seedlingGenRoom.js'));
    const CEILING = 30;
    const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
    const genRoom = (seed, biome) => room.generateGenRoom({
        region_id: 'census', exits: (KILLGATE ? ['e0'] : ['e0', 'e1']).map((exit_id) => ({ exit_id })),
        size: { width: 10, height: 10 }, rng: seededRng(seed),
        params: { seedlingGen: { biome, ...(KILLGATE ? { elements: 'killgate' } : {}) } },
    }).world;
    const items = { items_to_place: Array.from({ length: CEILING }, (_, i) => `i${i}`) };
    console.log(`# dump-seedling-gen-capacity biomes=${biomes.join(',')} seeds=${seeds[0]}..${seeds[seeds.length - 1]}`
        + `${KILLGATE ? ' killgate (one door)' : ''} ceiling=${CEILING}`);
    for (const biome of biomes) {
        for (const seed of seeds) {
            const t0 = process.hrtime.bigint();
            let row;
            try {
                const w = genRoom(seed, biome);
                const r0 = w.generation.rerolls;
                room.placeGenItems(w, items);
                const tags = w.locations.map((l) => l.tag).join(',');
                row = `rerolls=${r0}+${w.generation.rerolls - r0}${w.generation.grownFrom ? ' grown' : ''} `
                    + `seed=${w.seed} tags=${createHash('md5').update(tags).digest('hex').slice(0, 12)}`;
            } catch (e) {
                row = `THREW ${e.name}: ${String(e.message).split('\n')[0].slice(0, 120)}`;
            }
            console.error(`# ${biome} ${seed}: ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1)} s`);
            console.log(`${biome} seed=${String(seed).padStart(3)} ${row}`);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
