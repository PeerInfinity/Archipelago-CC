#!/usr/bin/env node
// rules-arrival-chase-witness: print a game run's polled ticks (play.mjs's .game.json.gz).  node trace.mjs <file> [from] [to] [every]
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const [, , f, from = 0, to = 1e9, every = 4] = process.argv;
const g = JSON.parse(gunzipSync(readFileSync(f)).toString());
const seen = new Set();
for (const r of g.reads) { if (seen.has(r.tick)) continue; seen.add(r.tick);
    if (r.tick >= +from && r.tick <= +to && (r.tick % +every === 0)) console.log(r.tick, r.level, r.x.toFixed(1), r.y.toFixed(1), 'hits', r.hits, 'dead', r.dead_frames, r.mob.join(' ')); }
console.log('ROW', JSON.stringify(g.row).slice(0, 300));
