#!/usr/bin/env node
/**
 * census-skeleton-kinds — **THE FIRST MEASUREMENT OF THE CONSTRUCTIVE MODE AS
 * BUILT.**
 *
 * CONSTRUCTIVE-MODE arc, slice 5. ⛔ IT IS NOT THE YIELD TABLE (slice 6, §3.6):
 * it never runs pass 2. It asks the one question slice 5 owes — **does the
 * SKELETON of kind K at seed s solve?** — because the loop refuses to start on
 * a skeleton that does not (`levelGenerator`: *"THE SKELETON DID NOT SOLVE"*),
 * so a kind whose rooms do not solve is a kind pass 2 can never reach.
 *
 * Per binding, per kind, over seeds 1..N:
 *   · solved / refused-at-step-0, with the refusal's own class
 *   · the median cost of the solve — SEEDLING ticks, MAZE plan length
 *   · the median FLOOR fraction, which is what pass 2 has to work with
 *
 * ⛔ IT CALLS THE MODEL AND THE ORACLE DIRECTLY, not `generateLevel`: the loop
 * refuses `obstacleTarget: 0` by name (every bound is positive), and running it
 * at target 1 would be measuring pass 2 by accident.
 *
 * Run: node scripts/procgen/census-skeleton-kinds.mjs [--seeds=24] [--maze-only]
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules', p));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);
const SEEDS = Number(arg('seeds', 24));

const say = (line) => process.stdout.write(`${line}\n`);
const median = (xs) => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
};

const {
    SEEDLING_SKELETON_KINDS, seedlingModel, seedlingOracle,
} = await M('seedlingDemo/procgenSeedling.js');
const { PRE_SWORD_PALETTE } = await M('seedlingDemo/procgenPalette.js');
const { terrainAt } = await M('seedlingDemo/procgenLevel.js');
const { interiorCells } = await M('seedlingDemo/procgenSeedling.js');
const {
    MAZE_SKELETON_KINDS, MAZE_PALETTE, mazeModel, mazeOracle,
} = await M('mazeRoom/procgenMaze.js');
const { TILE_FLOOR } = await M('mazeRoom/mazeRoomEngine.js');

const rows = [];

if (!has('seedling-only')) {
    for (const kind of MAZE_SKELETON_KINDS) {
        const cost = [];
        const floor = [];
        let solved = 0;
        const refusals = new Map();
        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const model = mazeModel({ seed, skeleton: { kind } });
            const record = model.skeleton();
            const out = mazeOracle({ model, items: MAZE_PALETTE.items ?? null }).solve(record);
            const open = [...record.tiles].filter((t) => t === TILE_FLOOR).length;
            floor.push(Math.round((100 * open) / record.tiles.length));
            if (out.verdict === 'SOLVED') { solved += 1; cost.push(out.ticks); } else {
                refusals.set(out.verdict, (refusals.get(out.verdict) ?? 0) + 1);
            }
        }
        rows.push({
            binding: 'maze', kind, solved, refused: SEEDS - solved,
            why: [...refusals].map(([k, n]) => `${k}x${n}`).join(' ') || '-',
            cost: median(cost), floor: median(floor),
        });
    }
}

if (!has('maze-only')) {
    for (const kind of SEEDLING_SKELETON_KINDS) {
        const cost = [];
        const floor = [];
        let solved = 0;
        const refusals = new Map();
        for (let seed = 1; seed <= SEEDS; seed += 1) {
            const model = seedlingModel({ seed, skeleton: { kind } });
            const record = model.skeleton();
            const oracle = seedlingOracle({ model, items: PRE_SWORD_PALETTE.items ?? null });
            const cells = interiorCells(record);
            floor.push(Math.round((100 * cells.filter(
                (c) => terrainAt(record, c.tx, c.ty) === 'ground',
            ).length) / cells.length));
            let out;
            try {
                out = oracle.solve(record, { templates: [] });
            } catch (e) {
                refusals.set(`THREW(${e.name})`, (refusals.get(`THREW(${e.name})`) ?? 0) + 1);
                continue;
            }
            if (out.verdict === 'SOLVED') { solved += 1; cost.push(out.ticks); } else {
                refusals.set(out.verdict, (refusals.get(out.verdict) ?? 0) + 1);
            }
        }
        rows.push({
            binding: 'seedling', kind, solved, refused: SEEDS - solved,
            why: [...refusals].map(([k, n]) => `${k}x${n}`).join(' ') || '-',
            cost: median(cost), floor: median(floor),
        });
    }
}

say(`# skeleton solvability census — seeds 1..${SEEDS}, DEFAULT room per binding`);
say('');
say('| binding | kind | solved | refused at step 0 | why | median cost | median floor % |');
say('|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.binding} | ${r.kind} | ${r.solved}/${SEEDS} | ${r.refused} | ${r.why} `
        + `| ${r.cost ?? '-'} | ${r.floor}% |`);
}
say('');
say('⛓ MAZE cost = BFS plan length in steps; SEEDLING cost = solver ticks.');
say('⛔ This is NOT the yield table — pass 2 never ran here.');
