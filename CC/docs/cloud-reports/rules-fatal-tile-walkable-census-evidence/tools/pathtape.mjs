// Author a HAND tape that walks a tile path centre to centre (the derivation's own witness, q1-L78-witness.json),
// one axis at a time, suit-less, with each item set in the seam. Open-loop: each leg holds its key for
// ceil(distance / speed) ticks (speed measured on the game, ~1.125 px/tick on igneous stone: q1 trace t0→t8).
//   node pathtape.mjs --path=16,1:16,4:15,4:15,5:13,5:13,6:11,6 --boot=78:256:16 --speed=1.125 --hold=40 --out=<dir> [--attack=<key>:<from>-<to>,...]
// --hold: idle ticks after the last leg (the goal must be STOOD on, then the tape keeps watching for a late hit).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const path = arg('path').split(':').map((p) => p.split(',').map(Number));
const [level, bx, by] = arg('boot').split(':').map(Number);
const speed = Number(arg('speed', '1.125'));
const hold = Number(arg('hold', '40'));
const lead = Number(arg('lead', '0'));
// --slide: px the player keeps moving after a key is released (measured on the game: 6.5 px, q2-try walk t43→t50);
// each leg releases that much early. --gap: idle ticks after each leg so the slide ends before the next axis starts.
const slide = Number(arg('slide', '0'));
const gap = Number(arg('gap', '0'));
// --pause=<leg>:<ticks>[,...]: idle ticks inserted AFTER leg <leg> (1-based), e.g. to stand and attack facing the last move.
const pauses = new Map((arg('pause') ? arg('pause').split(',') : []).map((s) => s.split(':').map(Number)));
const out = arg('out');
mkdirSync(out, { recursive: true });
const SETS = {
    spear: { hasSpear: true },
    sword: { hasSword: true },
    wand: { hasWand: true },
    shield2: { hasShield: true, hasDarkShield: true },
};
const FLAGS = ['hasSword', 'hasDarkSword', 'hasGhostSword', 'hasShield', 'hasDarkShield', 'hasFire', 'hasWand', 'hasFireWand', 'canSwim',
    'hasFeather', 'hasSpear', 'hasDarkSuit', 'hasTorch'];
const inputs = [];
let t = lead;
for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1], [x1, y1] = path[i];
    const key = x1 > x0 ? 'right' : x1 < x0 ? 'left' : y1 > y0 ? 'down' : 'up';
    const n = Math.max(1, Math.round(((Math.abs(x1 - x0) + Math.abs(y1 - y0)) * 16 - slide) / speed));
    inputs.push({ key, from: t, to: t + n });
    t += n + gap + (pauses.get(i) ?? 0);
}
for (const spec of (arg('attack') ? arg('attack').split(',') : [])) {
    const [key, span] = spec.split(':');
    const [from, to] = span.split('-').map(Number);
    inputs.push({ key, from, to });
}
const tag = arg('tag', 'walk');
for (const [name, on] of Object.entries(SETS)) {
    const items = Object.fromEntries(FLAGS.map((f) => [f, Boolean(on[f])]));
    const tape = {
        game: 'seedling', name: `L78-r0c16tor6c11-${tag}-${name}`, boot: { level, x: bx, y: by }, noclip: false, noDamage: false, noHazards: [],
        grants: [], persistence: [], equips: [], pins: ['dead_frames', 'sound'], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false, cosmetic: 0, fp: 987286273 }, seam: { items, time: 4800 }, tick_count: t + hold, inputs,
        tape_version: 8,
        description: `rules-fatal-tile-walkable-census: HAND tape, the derivation's witness path ${arg('path')} centre to centre at ${speed} px/tick (slide ${slide}, gap ${gap}), suit-less, set ${name}`,
    };
    writeFileSync(join(out, `${tape.name}.tape.json`), JSON.stringify(tape));
}
console.log(JSON.stringify({ inputs, ticks: t + hold }));
