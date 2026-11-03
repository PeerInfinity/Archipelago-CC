#!/usr/bin/env node
/**
 * SCRATCH MEASUREMENT (session tile-l40-latch-slowness; scratch branch only, never landed): is the LATCH SANDWICH /
 * LATCH SUBSUMPTION prune (deriveLevelWorldLogic.js, prototype flags `LATCH_SANDWICH` / `LATCH_SUBSUMPTION`)
 * ANSWER-PRESERVING? L40's three in-level latches (t0 (17,13), t1 (10,8), t3 (55,48)) and their six wandlocks are laid by
 * hand onto the committed `level_40__r0c53` payload (m4-latch W0's groups), then the certifier is run with the prune OFF
 * and ON and its output compared byte for byte:
 *   A. native, EVERY region of the committed preset, L40 laid (the slow tier's pass, with the lay);
 *   B. native, every region, NOT laid (the prune must be a no-op: no world lays a latch);
 *   C. scripted, L40's five regions, laid, off vs on — and scripted ≡ native on the same.
 * Plus L40's derive pass (deriveLevelWorldLogic) native + scripted, off vs on. Prints searches / states / wall per arm.
 *   gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f probes=probe-seedling-l40-latch-prune.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const T = (p) => resolve(REPO, p);
const E = await import(T('frontend/modules/mazeRoom/mazeRoomEngine.js'));
const N = await import(T('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js'));
const C = await import(T('frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js'));
const { playthroughPermissiveLocations } = await import(T('scripts/procgen/make-seedling-playthrough-maze.mjs'));
const HELPERS = JSON.parse(readFileSync(T('frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));
const ATLAS = JSON.parse(readFileSync(T('frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(T('frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const PERM = playthroughPermissiveLocations();
const L40 = ['level_40__r0c53', 'level_40__r23c29', 'level_40__r32c36', 'level_40__r36c35', 'level_40__r48c54'];
const GROUPS = {
    t0: { button: [17, 13], locks: [[13, 8], [13, 9], [13, 10]] },
    t1: { button: [10, 8], locks: [[11, 5], [11, 13]] },
    t3: { button: [55, 48], locks: [[30, 35]] },
};
function laidRules() {
    const r = structuredClone(RULES);
    const lay = r.preset_sidecars['1'].level_40__r0c53.playable_payload;
    lay.buttons = [...(lay.buttons ?? [])];
    lay.buttonLib = { ...(lay.buttonLib ?? {}) };
    lay.obstacleLib = { ...(lay.obstacleLib ?? {}) };
    for (const [g, { button: [bx, by], locks }] of Object.entries(GROUPS)) {
        lay.buttons.push({ x: bx, y: by, id: `latch_${g}` });
        lay.buttonLib[`latch_${g}`] = { kind: 'button', holds: `sw_l${g}`, latch: { event: `L40 latch ${g}` } };
        lay.obstacleLib[`wl_${g}`] = { id: `wl_${g}`, name: `wandlock ${g}`, kind: 'door', clear_set: [[`sw_l${g}`]] };
        for (const [x, y] of locks) {
            lay.obstacles = lay.obstacles.filter((o) => !(o.x === x && o.y === y));
            lay.tiles[y * lay.width + x] = 0;
            lay.obstacles.push({ x, y, id: `wl_${g}` });
        }
    }
    return r;
}
const LAID = laidRules();
let fails = 0;
const check = (ok, msg) => { if (!ok) fails += 1; console.log(`${ok ? 'PASS' : 'FAIL'}: ${msg}`); };
function arm(prune, fn) {
    N.LATCH_SANDWICH.on = prune.includes('w'); N.LATCH_SUBSUMPTION.on = prune.includes('s');
    N.LATCH_SANDWICH.skips = 0; N.LATCH_SUBSUMPTION.hits = 0; N.LATCH_SUBSUMPTION.misses = 0;
    globalThis.__reachLog = [];
    const t0 = performance.now();
    const out = fn();
    const wall = (performance.now() - t0) / 1000;
    const log = globalThis.__reachLog;
    globalThis.__reachLog = null;
    return { out, wall, searches: log.length, states: log.reduce((a, e) => a + e.states, 0), skips: N.LATCH_SANDWICH.skips, sub: N.LATCH_SUBSUMPTION.hits };
}
const stat = (label, a) => console.log(`MEASURED: ${label}: ${a.searches} searches, ${a.states} states, ${a.wall.toFixed(1)} s (sandwich skips ${a.skips}, subsumed ${a.sub})`);
const certOut = (r) => JSON.stringify({ problems: r.problems, lines: r.lines, accepted: r.accepted, skipped: r.skipped, rows: r.rows });
const cert = (rules, native, regions) => () => C.certifyPlaythroughMaze(rules, HELPERS, { native, regions, atlas: ATLAS, permissive: PERM, rows: true });
const deriveOut = (r) => JSON.stringify({ items: r.items, levels: [...r.levels], pairs: r.pairs });
const derive = (rules, native) => () => N.deriveLevelWorldLogic(E.deserializeMazeWorld(rules.preset_sidecars['1'].level_40__r0c53.playable_payload), HELPERS, { native });

console.log('CHANNEL: headless logic-only');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '--only=A,B,C,D').slice(7).split(',');
const prunes = ['w', 's', 'sw'];
if (only.includes('D')) {
    for (const native of [true, false]) {
        const eng = native ? 'native' : 'scripted';
        const off = arm('', derive(LAID, native)); stat(`L40 derive laid ${eng} prune off`, off);
        for (const p of prunes) {
            const on = arm(p, derive(LAID, native)); stat(`L40 derive laid ${eng} prune ${p}`, on);
            check(deriveOut(off.out) === deriveOut(on.out), `L40 derive pass, laid, ${eng}: prune ${p} output byte-identical to prune off (${deriveOut(off.out).length} B)`);
        }
        const base = arm('', derive(RULES, native)); stat(`L40 derive base ${eng}`, base);
    }
}
if (only.includes('C')) {
    const nat = arm('', cert(LAID, true, L40));
    for (const p of ['', 'w', 'sw']) {
        const a = arm(p, cert(LAID, false, L40)); stat(`L40 certifier laid scripted prune ${p || 'off'}`, a);
        check(JSON.stringify(a.out.lines) === JSON.stringify(nat.out.lines) && JSON.stringify(a.out.problems) === JSON.stringify(nat.out.problems),
            `L40 certifier laid: scripted (prune ${p || 'off'}) lines + problems ≡ native (prune off)`);
        check(certOut(a.out) === certOut(nat.out), `L40 certifier laid: scripted (prune ${p || 'off'}) full output (rows incl.) ≡ native prune off`);
    }
    const base = arm('', cert(RULES, false, L40)); stat('L40 certifier base scripted', base);
}
for (const [id, rules, label] of [['A', LAID, 'L40 laid'], ['B', RULES, 'committed (no latch)']]) {
    if (!only.includes(id)) continue;
    const off = arm('', cert(rules, true, undefined)); stat(`every region, ${label}, native, prune off`, off);
    console.log(`MEASURED: every region, ${label}: ${off.out.problems.length} problems, ${off.out.accepted.length} accepted, ${off.out.lines.length} lines, ${Object.keys(off.out.rows ?? {}).length} rows`);
    for (const p of prunes) {
        const on = arm(p, cert(rules, true, undefined)); stat(`every region, ${label}, native, prune ${p}`, on);
        check(certOut(off.out) === certOut(on.out), `every region, ${label}, native: prune ${p} full output (problems, lines, accepted, skipped, every row) byte-identical to prune off (${certOut(off.out).length} B)`);
    }
    if (id === 'A') for (const pr of off.out.problems) console.log(`  problem: ${pr}`);
}
console.log(fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
