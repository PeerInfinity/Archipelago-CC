// rules-engine-nit-b § What 6: the whole-game certifier's real engine searches, the table run's engine work. Certifies the
// committed maze preset (native, every region, one thread) and reads `COMPACT_REACH.misses` (every real search the
// certifier's reach cache stores) and `.replans` (lazy plan re-searches), with wall ms. The derived-rules probe certifies a
// freshly built maze with echo sentinels planted, but the searches are the same worlds'; this tool is for base ↔ tip deltas.
// usage: node table-run-counters.mjs <worktree> [--levels=level_77,level_78]
import path from 'node:path';
import fs from 'node:fs';
const wt = path.resolve(process.argv[2]);
const only = process.argv.find((a) => a.startsWith('--levels='))?.slice(9).split(',');
const R = (p) => path.join(wt, p);
const { certifyPlaythroughMaze } = await import(R('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js'));
const { COMPACT_REACH } = await import(R('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js'));
const HELPERS = JSON.parse(fs.readFileSync(R('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
const ATLAS = JSON.parse(fs.readFileSync(R('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
const RULES = JSON.parse(fs.readFileSync(R('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const all = Object.keys(RULES.preset_sidecars['1']);
const regions = only ? all.filter((n) => only.some((l) => n === l || n.startsWith(`${l}__`))) : all;
const t0 = performance.now();
const out = certifyPlaythroughMaze(RULES, HELPERS, { native: true, regions, atlas: ATLAS });
const ms = performance.now() - t0;
console.log(`${only ? only.join(',') : 'whole game'}: ${regions.length} regions; problems ${out.problems.length}, accepted ${out.accepted.length}, lines ${out.lines.length}; `
    + `engine searches (cache misses) ${COMPACT_REACH.misses}, replans ${COMPACT_REACH.replans}; wall ${ms.toFixed(0)} ms`);
