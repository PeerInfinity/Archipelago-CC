#!/usr/bin/env node
// rules-arrival-chase-witness: hand (open-loop) scripts from a door landing, authored on the JS model of the
// DELIVERED room (author.mjs's ops), written as tapes for play.mjs to decide on the game.
//   node witness.mjs --case=<name>[,…] [--trace] [--every=5] [--build=<dir>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { author, tapeOf } = await import('./author.mjs');
const { CASES } = await import('./cases.mjs');
const dir = arg('build');
if (dir) mkdirSync(dir, { recursive: true });
for (const n of (arg('case') ?? Object.keys(CASES).join(',')).split(',')) {
    const c = CASES[n];
    if (!c) { console.log('NO CASE', n); continue; }
    const a = author(c, { trace: process.argv.includes('--trace') });
    console.log('MODEL', n, JSON.stringify(a.model));
    if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % Number(arg('every', '5')) === 0) console.error(JSON.stringify(s));
    if (dir) writeFileSync(join(dir, `${n}.tape.json`), JSON.stringify(tapeOf(a, n, c.note)));
}
