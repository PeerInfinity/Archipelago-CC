#!/usr/bin/env node
// MEASURE ONLY (branches tile-fire-breaks-rocks-calib / -calib-control, never land): kill-arms' / R-A5's P3 calib method — the calib
// scripted pass at the test's own 1,200 s limit, then ONE scripted L12 compile-and-certify as the runner's yardstick (this slice moves
// no L12 rock), and L0 (the slice's heaviest moved level) timed the same way for information.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
if (process.env.FBR_CHILD) {
    const M = await import(pathToFileURL(T('scripts/procgen/make-seedling-playthrough-maze.mjs')).href);
    const { certifyPlaythroughMaze } = await import(pathToFileURL(T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js')).href);
    const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
    const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
    const rules = JSON.parse(M.buildPlaythroughMaze({ levels: [process.env.FBR_CHILD], derivedTable: { rows: [], excluded: [], inputs: null } }).text);
    const t0 = Date.now();
    const out = certifyPlaythroughMaze(rules, HELPERS, { native: false, regions: Object.keys(rules.preset_sidecars['1']), atlas: ATLAS, permissive: M.playthroughPermissiveLocations() });
    console.log(`TIMING ${process.env.FBR_CHILD} scripted ms=${Date.now() - t0} problems=${out.problems.length}`);
    process.exit(0);
}
console.log('CHANNEL: headless logic-only (measure: calib scripted pass + L12 scripted yardstick)');
const t0 = Date.now();
const calib = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.calib.config.js', 'frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.calib.test.js'], { cwd: REPO, stdio: 'inherit' });
const wall = Math.round((Date.now() - t0) / 1000);
console.log(`${calib.status === 0 ? 'PASS' : 'FAIL'}: P3 calib scripted pass rc=${calib.status} wall ${wall} s`);
const child = (lv) => {
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', fileURLToPath(import.meta.url)], { cwd: REPO, env: { ...process.env, FBR_CHILD: lv }, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 1500000 });
    const line = (r.stdout ?? '').split('\n').find((l) => l.startsWith('TIMING')) ?? `TIMING ${lv} NO OUTPUT rc=${r.status} signal=${r.signal}`;
    console.log(line);
    console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}: the ${lv} timing finished`);
    return { ok: r.status === 0, ms: Number(line.match(/ms=(\d+)/)?.[1]) };
};
const y = child('level_12');
const l40 = child('level_0');
if (y.ms) console.log(`MEASURED: calib wall ${wall} s / L12 scripted ${(y.ms / 1000).toFixed(1)} s = ratio ${(wall / (y.ms / 1000)).toFixed(2)}; L0 scripted ${(l40.ms / 1000).toFixed(1)} s`);
if (calib.status === 0 && y.ok && l40.ok) console.log('ALL CHECKS PASSED');
process.exit(calib.status === 0 && y.ok && l40.ok ? 0 : 1);
