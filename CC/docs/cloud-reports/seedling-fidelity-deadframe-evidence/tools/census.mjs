#!/usr/bin/env node
// DEADFRAME (wave 66) D1 census (needs `census-scratch.py apply`): every committed tape under the shipped defaults
// (or `--over=` keys), and per tape: the dead frames by kind (the model's `clock.spend` spans), the frames among them on
// which a responder of the level would change if it stepped (a clone stepped `frames` times), and the enemy-on-presser
// overlaps (spinner / wallflyer on a Button or ButtonRoom; on one whose group holds an unlanded FallRock).
// usage: node census.mjs [--json=out.json] [--over='{"k":true}']
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const OVER = JSON.parse(arg('over', '{}'));
const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const kindOf = (k, w) => {
    const why = String(w ?? '');
    if (k === 'ceremony' && why.startsWith('pickup phase A')) return 'pickup-lump';
    if (k === 'ceremony') return `ceremony:${why.split(' ')[0]}`;
    if (k === 'freeze' && (why === 'fallrock' || why === 'fallrocks-together')) return `span:${why}`;
    return `${k}:${why.split(' ')[0]}`;
};
export const censusOf = () => ({ spans: {}, tick: {} });
const add = (o, k, f) => { o[k] = o[k] ?? { spans: 0, frames: 0, withResponders: 0, changedFrames: 0, flips: 0, spansChanged: 0, details: [] }; return o[k]; };
const total = { spans: {}, overlaps: {} };
const rows = [];
let n = 0;
for (const p of files) {
    let tape;
    try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
    if (!tape?.inputs || !tape?.boot) continue;
    n += 1;
    const c = { spans: {}, overlaps: {} };
    globalThis.__DF = {
        onSpend(f, k, w, sim, level) {
            const key = kindOf(k, w);
            for (const o of [c.spans, total.spans]) {
                const e = add(o, key);
                e.spans += 1; e.frames += f;
                if (sim?.responders > 0) e.withResponders += 1;
                if (sim?.changed > 0) { e.changedFrames += sim.changed; e.flips += sim.flips; e.spansChanged += 1;
                    if (o === c.spans) e.details.push({ level, why: w, frames: f, changed: sim.changed, flips: sim.flips, first: sim.first, ids: sim.ids }); }
                if (sim?.error) e.errors = (e.errors ?? 0) + 1;
            }
        },
        onTick(o) {
            const key = `${o.kind}-on-${o.presser.split('@')[0]}${o.rockGroup ? '-rockgroup' : ''}`;
            for (const m of [c.overlaps, total.overlaps]) m[key] = (m[key] ?? 0) + 1;
            c.where = c.where ?? {};
            const wk = `${key} L${o.level} ${o.presser}`;
            c.where[wk] = (c.where[wk] ?? 0) + 1;
        },
    };
    let threw = null;
    try { withContactFidelity(OVER, () => runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { threw = String(e?.message ?? e).slice(0, 100); }
    if (globalThis.__DF.tickErr) c.tickErr = globalThis.__DF.tickErr;
    const interesting = Object.values(c.spans).some((e) => e.spansChanged > 0) || Object.keys(c.overlaps).length > 0;
    rows.push({ tape: relative(ROOT, p), threw, ...c });
    if (interesting) {
        const ch = Object.entries(c.spans).filter(([, e]) => e.spansChanged > 0).map(([k, e]) => `${k}: ${e.spansChanged}/${e.spans} spans, ${e.changedFrames} changed frames, ${e.flips} flips ${JSON.stringify(e.details.map((d) => [d.level, d.why, d.frames, d.changed, d.flips, d.first, d.ids]))}`);
        console.log(`${relative(ROOT, p)}${threw ? ' (threw)' : ''}\n    ${[...ch, c.where ? `overlaps ${JSON.stringify(c.where)}` : ''].filter(Boolean).join('\n    ')}`);
    }
}
delete globalThis.__DF;
console.log(`\ntapes ${n}`);
for (const [k, e] of Object.entries(total.spans).sort()) console.log(`  ${k.padEnd(34)} spans ${e.spans}, frames ${e.frames}, in a level with responders ${e.withResponders}, spans a responder would change ${e.spansChanged} (${e.changedFrames} frames, ${e.flips} open flips)${e.errors ? `, sim errors ${e.errors}` : ''}`);
console.log(`  overlaps (live ticks): ${JSON.stringify(total.overlaps)}`);
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify({ tapes: n, over: OVER, total: { spans: Object.fromEntries(Object.entries(total.spans).map(([k, e]) => [k, { ...e, details: undefined }])), overlaps: total.overlaps }, rows: rows.filter((r) => Object.values(r.spans).some((e) => e.spansChanged > 0 || e.withResponders > 0) || Object.keys(r.overlaps).length || r.threw).map((r) => ({ ...r, spans: Object.fromEntries(Object.entries(r.spans).map(([k, e]) => [k, { ...e, details: e.details.length ? e.details : undefined }])) })) }, null, 1)}\n`);
