#!/usr/bin/env node
// rules-lavatrap-neck: L78 REVERSE (L79 -> L77) with the Ghost Spear alone, from the L79 door's landing (32,16). The kill-lock
// lock@32,32 (tset -1, tag 0) is PRE-CLEARED at boot (`cleared: [0]`): from the 1-wide L79 pocket the lock is the encounter
// lock's own question (a pre-existing row), so this run measures rule T's part of the crossing: the three lavatraps.
// Rule T's derivation (trapKillArms) from this landing: kill (6,5) [centre 104,88] from its W spot (x in [67,71], y 88,
// facing right), then (9,6) [centre 152,104] from its W spot (x in [115,119], y 104, facing right); (9,3) [centre 152,56]
// stays alive and the walk east keeps >= 33 px from it (y ~ 95 under it). Hand waypoints on the JS model (the model does
// not model the tongue: it only CHOOSES keys); the game decides (play.mjs).
//   node l78rev.mjs [--case=a,b] [--trace] [--every=10] --build=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from './l77trap.mjs';
import { tapeOf } from './author.mjs';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const n = (k, d) => Number(arg(k, d));
const L79 = { level: 78, x: 32, y: 16 };
const presses = (k, gap) => [['fireEvery', k, gap]];
export const CASES = {};
// a beam prefix (tapes/beam/<name>.tape.json), replayed as per-tick key sets
import { readFileSync, existsSync } from 'node:fs';
const BEAMS = join(new URL('../../', import.meta.url).pathname, 'tapes/beam');
const tapeKeys = (f) => { const t = JSON.parse(readFileSync(f, 'utf8')); const nn = Math.max(t.tick_count ?? 0, t.inputs.reduce((m, i) => Math.max(m, i.to), 0));
    const k = Array.from({ length: nn }, () => []); for (const i of t.inputs) for (let x = i.from; x < i.to; x++) k[x].push(i.key); return k; };
const K = (name) => (existsSync(join(BEAMS, `${name}.tape.json`)) ? tapeKeys(join(BEAMS, `${name}.tape.json`)) : []);
// CHAINED: the beam to (6,5)'s W spot (it killed the near runners with the Spear), then (6,5) from x in [67.5, 70.5)
// facing right (spear rect [x, x+32] meets the hitbox 99..109 iff x >= 67; outside the reach iff x <= 71; y 88 inside
// the rect's y-0.5..y+4.5 band against the hitbox 83..93), then over the dead trap's tile to (9,6)'s W spot x in [115.5,
// 118.5) at y ~ 104 (hitbox 147..157 x 99..109 → x >= 115; outside iff x <= 119; 59 px from (9,3) there)
CASES['l78r-kill65'] = { boot: L79, items: ['hasSpear'], cleared: [0], script: [['replay', K('L78r-spear-to-W65')], ['wait', 8],
    ['to', 66, 88], ['wait', 8], ['keys', 'right', 1], ['wait', 6], ['nudge', 'right', 'x', 67.5, 70.5], ...presses(3, 40), ['wait', 30]] };
// try 2: after (6,5) dies, stand at (80,86) facing right and thrust every 10 ticks: lavarunner@144,72 (centre 152,80) wakes
// at 72 px and comes in along y ~ 80-90 (the game's own approach in try 1), into the thrust's 32 px. (80,86) is 74 / 78 px
// from (9,6) / (9,3).
CASES['l78r-kill65r'] = { boot: L79, items: ['hasSpear'], cleared: [0], script: [...CASES['l78r-kill65'].script,
    ['to', 80, 86], ['wait', 4], ['keys', 'right', 1], ['fireEvery', n('volleys', '14'), 10], ['wait', 20]] };
// then the beam to (9,6)'s W spot tile (7,6) (it kills the runner the walk wakes), and (9,6) from x in [115.5, 118.5) at y ~ 104
// (hitbox 147..157 x 99..109: x >= 115 hits; outside the reach iff x <= 119; 59 px from (9,3) there). The model refuses a
// player inside a LavaTrap's tile, dead or alive (levelRun cannot place one), so the walk keeps off (6,5)'s tile.
CASES['l78r-kill96'] = { boot: L79, items: ['hasSpear'], cleared: [0], script: [['replay', K('L78r-spear-to-W96')], ['wait', 8],
    ['keys', 'right', 1], ['wait', 6], ['nudge', 'right', 'x', 115.5, 118.5], ...presses(3, 40), ['wait', 30]] };
// down the pocket through the (open) lock, kill any runner that comes, then the W spot of (6,5)
const DOWN = [['to', 32, 40], ['to', 32, 60], ['to', 40, 76]];
const SPOT65 = [['to', 56, 88], ['to', 64, 88], ['nudge', 'right', 'x', n('w65lo', '67.5'), n('w65hi', '70.5')]];
const SPOT96 = [['to', 104, 96], ['to', 110, 104], ['nudge', 'right', 'x', n('w96lo', '115.5'), n('w96hi', '118.5')]];
const EAST = [['to', 140, 96], ['to', 170, 96], ['to', 184, 80], ['to', 216, 72], ['to', 248, 56], ['to', 256, 24], ['keys', 'up', 40]];
CASES['l78r-spear'] = { boot: L79, items: ['hasSpear'], cleared: [0], script: [...DOWN, ['keys', 'down', 1], ...presses(n('pre', '4'), 32),
    ...SPOT65, ...presses(3, 40), ['wait', 30], ...SPOT96, ...presses(3, 40), ['wait', 30], ...EAST] };
// segments, for the trace
CASES['l78r-spear-65'] = { boot: L79, items: ['hasSpear'], cleared: [0], script: [...DOWN, ['keys', 'down', 1], ...presses(n('pre', '4'), 32), ...SPOT65, ...presses(3, 40), ['wait', 30]] };
if (import.meta.url === `file://${process.argv[1]}`) {
    const dir = arg('build');
    if (dir) mkdirSync(dir, { recursive: true });
    for (const name of arg('case') ? arg('case').split(',') : Object.keys(CASES)) {
        const a = build(CASES[name], { trace: process.argv.includes('--trace') });
        console.log('MODEL', name, JSON.stringify(a.model));
        if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % n('every', '10') === 0) console.error(JSON.stringify(s));
        if (dir) writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify(tapeOf(a, name, 'L78 reverse, rule T traps, kill-lock tag 0 pre-cleared')));
    }
}
