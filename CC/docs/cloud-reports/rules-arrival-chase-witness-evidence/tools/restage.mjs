#!/usr/bin/env node
// rules-arrival-chase-witness: re-stage a tape's first N ticks of held keys on the game's arrival staging with a
// different item set, then append held keys (open loop).
//   node restage.mjs <in.tape.json> <out.tape.json> --items=hasSword,hasDarkSuit --keep=<N> [<key+key>:<ticks> …]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { arrivalStaging } = await M('fidelityArrival.js');
const { buildStagedTape } = await M('botDriverV1.js');
const [, , inp, out, ...rest] = process.argv;
const src = JSON.parse(readFileSync(inp, 'utf8'));
const keep = Number(arg('keep', String(src.tick_count)));
const perTick = Array.from({ length: keep }, () => new Set());
for (const i of src.inputs) for (let t = i.from; t < Math.min(i.to, keep); t++) perTick[t].add(i.key);
for (const s of rest.filter((a) => !a.startsWith('--'))) { const [keys, n] = s.split(':'); for (let i = 0; i < Number(n); i++) perTick.push(new Set(keys.split('+').filter((k) => k && k !== 'idle'))); }
const items = arg('items', '').split(',').filter(Boolean);
const st = arrivalStaging(src.boot, { items });
const name = out.split('/').pop().replace(/\.tape\.json$/, '');
const tape = buildStagedTape({ staging: st, perTick: [...perTick, ...Array.from({ length: 8 }, () => new Set())], name });
writeFileSync(out, JSON.stringify({ ...tape, description: `rules-arrival-chase-witness: ${inp.split('/').pop()} first ${keep} ticks on items [${items}], then ${rest.filter((a) => !a.startsWith('--')).join(' ')}` }));
console.log(name, tape.tick_count, JSON.stringify(st.boot));
