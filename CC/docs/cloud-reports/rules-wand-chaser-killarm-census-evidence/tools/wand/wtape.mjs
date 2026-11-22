#!/usr/bin/env node
// rules-wand-chaser-killarm-census: build tapes from case specs (JSON file or inline), on the arrival staging of the
// row's landing. The JS model is used ONLY to walk (`to`/`go`) with every chaser/trap HIDDEN from it (MODEL_DROP):
// `levelRun` throws when a wand shot reaches a chaser (only the boss totem is modelled), so the GAME alone judges
// every Wand tape (wplay.mjs). Ops (author.mjs's, plus):
//   ['fireHold', 'left+up'|'', k, gap]  k presses `gap` ticks apart, holding those keys on EVERY tick
//   ['face', dir]                        one tick of `dir` then 6 idle ticks (sets `direction` without moving far)
//   node wtape.mjs --cases=<file.json> [--case=a,b] --build=<dir>
process.env.MODEL_DROP ??= 'lavarunner,bulb,lavatrap,grenade,puncher,drill,bob,spinningaxe';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { author, tapeOf } = await import('../chase/author.mjs');
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
export function expand(script) {
    const out = [];
    for (const op of script) {
        if (op[0] === 'fireHold') {
            const keys = op[1] ? op[1].split('+') : [];
            const t = [];
            for (let i = 0; i < op[2]; i++) { t.push([...keys, 'primary']); for (let j = 1; j < op[3]; j++) t.push([...keys]); }
            out.push(['replay', t]);
        } else if (op[0] === 'face') { out.push(['keys', op[1], 1], ['wait', 6]); }
        else out.push(op);
    }
    return out;
}
export function buildCase(c) {
    const a = author({ ...c, script: expand(c.script) });
    return a;
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const CASES = JSON.parse(readFileSync(arg('cases'), 'utf8'));
    const dir = arg('build'); mkdirSync(dir, { recursive: true });
    for (const n of arg('case') ? arg('case').split(',') : Object.keys(CASES)) {
        const a = buildCase(CASES[n]);
        console.log('MODEL', n, JSON.stringify({ ticks: a.model.ticks, end: a.model.end, refusal: a.model.refusal }));
        writeFileSync(join(dir, `${n}.tape.json`), JSON.stringify(tapeOf(a, n, `rules-wand-chaser-killarm-census hand script; items ${c_items(CASES[n])}`)));
    }
}
function c_items(c) { return (c.items ?? []).join('+') || 'none'; }
