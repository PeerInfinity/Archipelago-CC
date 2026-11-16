#!/usr/bin/env node
// rules-arrival-chase-witness: append held keys to a tape (open loop).  node append.mjs <in> <out> <key>[+key]:<ticks> …
import { readFileSync, writeFileSync } from 'node:fs';
const [, , inp, out, ...specs] = process.argv;
const t = JSON.parse(readFileSync(inp, 'utf8'));
let at = t.tick_count;
// the source tape ends with idle ticks (beam.mjs pads 8); start the appended keys after the last held input
const lastHeld = Math.max(0, ...t.inputs.map((i) => i.to));
at = lastHeld;
for (const s of specs) { const [keys, n] = s.split(':'); for (const k of keys.split('+')) if (k) t.inputs.push({ key: k, from: at, to: at + Number(n) }); at += Number(n); }
t.tick_count = at + 8;
t.name = out.split('/').pop().replace(/\.tape\.json$/, '');
t.description = `${t.description ?? ''} + appended ${specs.join(' ')} from t${lastHeld}`;
writeFileSync(out, JSON.stringify(t));
console.log(t.name, 'ticks', t.tick_count);
