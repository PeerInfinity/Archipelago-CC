#!/usr/bin/env node
/**
 * census-seedling-arrival-solid — **EVERY GAME LANDING WHOSE BOX IS INSIDE A
 * SOLID A SAVED FLAG DECIDES** (Seedling fidelity ARRIVAL, D1(c)/D2/D4).
 *
 * For every door in the map (both directions of every link: each side has its
 * own door) the landing `(to, playerx, playery)` is booted fresh
 * (`fidelityArrival.arrivalStaging`) with NO clears and again with the
 * overlapping solid's own tag cleared, and one row per (landing, solid) says:
 *
 *   flag held     the box is inside the solid; the MODEL's stuck test
 *                 (`arrivalSolid.modelStuck`: every cardinal hold, 30 ticks)
 *   flag cleared  the box is outside it, and the model walks
 *   action        what writes the flag (`FLAG_ACTIONS`, read at the class's
 *                 own `setPersistence(tag, false)`) and the item it needs
 *   solver        `solveSegment`'s answer from the landing, flag held: the
 *                 refusal's `obstacle.kind` (`arrival-inside-solid`) and the
 *                 other arrivals its `wayOut` names
 *   other ways    the doors that land in the SOURCE level from anywhere else —
 *                 an arrival through this edge with the flag held needs one of
 *                 them first (the in-order route crosses this edge only from
 *                 the obstacle's room side, after the obstacle is gone)
 *
 * `--json=<path>` writes the rows plus the D4 edge table (the rules arc's
 * input: every edge whose passability depends on a saved obstacle state) as
 * JSON. ⛔ A MEASUREMENT, NOT A GATE: exit 0 whatever it finds. Node only; it
 * takes no box (no browser, no wasm). `fidelityArrival.test.js` pins the rows.
 *
 * Run:
 *   node scripts/procgen/census-seedling-arrival-solid.mjs [--json=<path>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const M = (p) => import(join(REPO, p));
    const { atlasLevelSource } = await M('frontend/modules/seedlingDemo/levelSource.js');
    const { arrivalSolidCensus, arrivalEdgeTable } = await M('frontend/modules/seedlingDemo/fidelityArrival.js');

    const JSON_OUT = process.argv.find((a) => a.startsWith('--json='))?.slice('--json='.length) ?? '';
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const rows = arrivalSolidCensus(MAP, atlasLevelSource(), { solve: true });
    const edges = arrivalEdgeTable(MAP, rows);

    const landings = new Set(rows.map((r) => `${r.landing.level}|${r.landing.x}|${r.landing.y}`));
    console.log(`census-seedling-arrival-solid — ${rows.length} (landing, solid) rows over ${landings.size} `
        + 'game landings whose box overlaps a solid a saved flag decides');
    for (const r of rows) {
        const L = r.landing;
        console.log(`L${String(L.from).padEnd(3)} ${L.door.padEnd(20)} -> L${String(L.level).padEnd(3)} `
            + `(${L.x},${L.y})  ${r.solid.padEnd(24)} flag ${r.flag ? `{${r.flag.level},${r.flag.tag}}` : '-'} `
            + `held: ${r.flagHolds.inside ? 'INSIDE' : 'out'}${r.flagHolds.stuck ? ' STUCK' : ''}  `
            + `cleared: ${r.flagCleared ? `${r.flagCleared.inside ? 'INSIDE' : 'out'}${r.flagCleared.stuck ? ' STUCK' : ''}` : '-'}`
            + `${r.allCleared ? `  all {${r.allCleared.tags.join(',')}} cleared: ${r.allCleared.stuck ? 'STUCK' : 'free'}` : ''}`
            + `  solver: ${r.solver?.kind ?? '-'}  [${r.action ?? '?'}]`);
    }
    console.log(`D4 — ${edges.length} edge(s) whose passability depends on a saved obstacle state`);
    if (JSON_OUT) {
        writeFileSync(JSON_OUT, `${JSON.stringify({
            source: 'census-seedling-arrival-solid.mjs --json (seedling fidelity ARRIVAL)',
            rows, edges,
        }, null, 1)}\n`);
        console.log(`WROTE: ${JSON_OUT}`);
    }
}
