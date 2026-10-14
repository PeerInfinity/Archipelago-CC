#!/usr/bin/env node
// SCRATCH (seedling-hammer-cw D1.2): a cw-solve --tape JSON ({staging, perTick}) → a staged tape the game can play
// (`buildStagedTape`, G1's plan script's shape; a page staging's `items.hitsMax` mapped to `seam.hits_max` as G1's
// rt.mjs did). `--upto=N` keeps the first N keys. Measure-only.
//   node cw-tape.mjs <in.tape.json> <out.json> [--upto=N] [--name=…]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { buildStagedTape } = await import(join(REPO, 'frontend/modules/seedlingDemo/botDriverV1.js'));
const [, , IN, OUT] = process.argv;
const { staging, perTick } = JSON.parse(readFileSync(IN, 'utf8'));
const upto = Number(arg('upto', perTick.length));
let st = staging;
if (st.seam?.items && 'hitsMax' in st.seam.items) {
    const { hitsMax, ...items } = st.seam.items;
    st = { ...st, seam: { ...st.seam, items, hits_max: hitsMax } };
}
if (Array.isArray(st.inventory_slots) && st.inventory_slots.length === 0) { st = { ...st }; delete st.inventory_slots; }
const built = buildStagedTape({ staging: st, perTick: perTick.slice(0, upto).map((k) => new Set(k)), name: arg('name', 'cw-l40-prefix') });
writeFileSync(OUT, `${JSON.stringify(built, null, 1)}\n`);
console.log(`wrote ${OUT}: ${upto} keys`);
