#!/usr/bin/env node
/**
 * census-seedling-bosslocks — **THE ONE-SIDED LOCK CENSUS.** For every placed
 * `bosslock` in `seedling-map.json`, it reports whether the playthrough atlas's
 * rule agrees with the game's south-only probe.
 *
 * SEEDLING SWIM T4, D2 (plan R-j). T3 measured step 29 of the survey refusing
 * with the Green Key staged: `BossLock.update` probes the row BELOW the lock,
 * and the route arrives from the NORTH. The AP rules still gate
 * `level_30__r0c4 <-> r2c10` both ways. This census asks the same question of
 * every lock.
 *
 * Each row carries:
 * - the level, the tile and the `keyType`;
 * - the analyzer's component on each side;
 * - the atlas rule between the probe side and the far side, and its directions;
 * - whether the far side has its own way in.
 *
 * A two-way rule is too PERMISSIVE. It is LIVE when the far side has another
 * way in, because then AP can use the direction the game refuses. It is INERT
 * when the only way to the far side is through the lock, from the probe side.
 * `shieldlock` / `shieldlocknorm` (a WEST probe, `ShieldLock.as:32`) are listed
 * under `--shield` for the record only: they are T3/S1's rows.
 *
 * ── ⛔ IT IS A MEASUREMENT, NOT A GATE (the house sweep law) ───────────
 *
 * Report-only; exit 0 whatever it finds. The pure half is
 * `seedlingBossLockCensus.js`, and `seedlingBossLockCensus.test.js` pins the
 * verdict counts against the committed atlas.
 *
 * Run:
 *   node scripts/procgen/census-seedling-bosslocks.mjs
 *   node scripts/procgen/census-seedling-bosslocks.mjs --shield
 *   node scripts/procgen/census-seedling-bosslocks.mjs --json=/tmp/bosslocks.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const jsonOut = process.argv.find((a) => a.startsWith('--json='))?.slice('--json='.length) ?? null;
const shield = process.argv.includes('--shield');

const { censusLocks, censusCounts } = await import('./seedlingBossLockCensus.js');
const { playthroughGridFor } = await import('./make-seedling-playthrough-rules.mjs');
const { findComponents } = await import('../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');

const MAP = readJson(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const ATLAS = readJson(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'));

const tags = shield ? ['shieldlock', 'shieldlocknorm'] : ['bosslock'];
const rows = censusLocks({ levels: MAP.levels, atlas: ATLAS, gridFor: playthroughGridFor, findComponents, tags });

console.log(`## ${tags.join(' + ')} census — ${ATLAS.atlas_id} (${rows.length} placements)`);
console.log('probe side: bosslock S (BossLock.as:61, the row below), shieldlock W (ShieldLock.as:32, x - 1)\n');
console.log('| level | lock | tile | keyType | tag | N | S | E | W | rule (probe side / far side) | directions | far side\'s other ways in | verdict |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const ruleText = (r) => (r.rule ? `${r.rule.access_rule?.args?.item_name ?? JSON.stringify(r.rule.access_rule)}` : '—');
for (const r of rows) {
    const other = [...r.farEntrances, ...r.farOther].join(', ') || '—';
    console.log(`| L${r.level} | ${r.tag}@${r.at} | ${r.tile.join(',')} | ${r.keyType ?? '—'} | ${r.persistTag ?? '—'} | `
        + `${r.sides.N} | ${r.sides.S} | ${r.sides.E} | ${r.sides.W} | ${ruleText(r)} (${r.probeSide} / ${r.farSide}) | `
        + `${r.ruleDirections ?? '—'} | ${other} | ${r.verdict} |`);
}
const counts = censusCounts(rows);
console.log(`\n## COUNTS: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
if (jsonOut) {
    writeFileSync(jsonOut, `${JSON.stringify({ atlas_id: ATLAS.atlas_id, tags, counts, rows }, null, 2)}\n`);
    console.log(`wrote ${jsonOut}`);
}
