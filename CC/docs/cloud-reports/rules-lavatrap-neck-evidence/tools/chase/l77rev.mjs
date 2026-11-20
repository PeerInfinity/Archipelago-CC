#!/usr/bin/env node
// rules-chaser-arrival-killarm: open question 4a — L77 IN REVERSE (L76 landing (16,32) -> the L78 door (96,304)), hand
// waypoint scripts on the JS model (the model only CHOOSES keys; the game decides: play.mjs).
//   node l77rev.mjs [--case=a,b] [--trace] --build=<dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { author, tapeOf } from './author.mjs';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BOOT = { level: 77, x: 16, y: 32 };
// north floor (c0-5 r2) -> c5 r3 -> c6 r4 -> c7 r5..r9 (the crumbling bridge c7 r7-r9) -> r10 west -> c4 r11 -> c4 r12
// (inside the trap's 32 px with a clear line) -> c5 r13 -> c6 r14 -> the corridor south -> the L78 door
const WAY = [['to', 88, 36], ['to', 104, 52], ['to', 120, 72], ['to', 120, 90], ['to', 120, 160], ['to', 72, 168], ['to', 72, 184],
    ['to', 72, 200], ['to', 88, 216], ['to', 104, 232], ['to', 104, 300], ['keys', 'down', 40]];
// the same with the Sword swinging at the runners once in the corridor
// the Sword: kill the bulb from the r2 floor as it climbs to the player (facing down), then the same walk
const WAY_SWORD = [['to', 88, 36], ['keys', 'down', 1], ['fireEvery', 6, 8], ...WAY.slice(1, 9), ['to', 104, 232], ['keys', 'down', 1],
    ['fireEvery', 6, 10], ['to', 104, 300], ['keys', 'down', 40]];
const CASES = {
    'l77rev-none': { boot: BOOT, items: [], script: WAY },
    'l77rev-sword': { boot: BOOT, items: ['hasSword'], script: WAY_SWORD },
    'l77rev-suit': { boot: BOOT, items: ['hasDarkSuit'], script: WAY },
    'l77rev-swordsuit': { boot: BOOT, items: ['hasSword', 'hasDarkSuit'], script: WAY_SWORD },
};
const dir = arg('build');
if (dir) mkdirSync(dir, { recursive: true });
for (const n of arg('case') ? arg('case').split(',') : Object.keys(CASES)) {
    const a = author(CASES[n], { trace: process.argv.includes('--trace') });
    console.log('MODEL', n, JSON.stringify(a.model));
    if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % Number(arg('every', '10')) === 0) console.error(JSON.stringify(s));
    if (dir) writeFileSync(join(dir, `${n}.tape.json`), JSON.stringify(tapeOf(a, n, 'L77 reverse, waypoints')));
}
