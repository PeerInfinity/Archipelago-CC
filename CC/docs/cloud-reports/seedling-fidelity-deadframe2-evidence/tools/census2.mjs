#!/usr/bin/env node
// DEADFRAME2 (wave 69) D1 census (needs `census2-scratch.py apply`): wave 66's `census.mjs`, widened. Every committed
// tape under the shipped defaults (or `--over=` keys), and per dead-frame kind (the model's `clock.spend` spans): the
// spans, the frames, the spans in a level with responders / with Pulsers, the spans on which a responder would change
// (wave 66's clone) and on which a Pulser would (the clone of every Pulser stepped `frames` times: state moves, hit
// frames, hit frames with a target in the ring). The live-tick overlaps (an enemy on a presser; a BLOCK on a FallRock's
// Button) and the lumps by texted / text-less.
// usage: node census2.mjs [--json=out.json] [--over='{"k":true}'] [--batch] (--batch: import as a preload instead)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const kindOf = (k, w) => {
    const why = String(w ?? '');
    if (k === 'ceremony' && why.startsWith('pickup phase A')) return 'pickup-lump';
    if (k === 'ceremony') return `ceremony:${why.split(' ')[0]}`;
    if (k === 'freeze' && (why === 'fallrock' || why === 'fallrocks-together')) return `span:${why}`;
    return `${k}:${why.split(' ')[0]}`;
};
const add = (o, k) => { o[k] = o[k] ?? { spans: 0, frames: 0, withResponders: 0, changedFrames: 0, flips: 0, spansChanged: 0,
    withPulsers: 0, withActivePulser: 0, spansPulserChanged: 0, pulserHitFrames: 0, pulserReachFrames: 0, spansPulserReach: 0, reached: [], details: [] }; return o[k]; };
export function makeHooks(c, total) {
    return {
        onSpend(f, k, w, sim, level, pulse) {
            const key = kindOf(k, w);
            for (const o of [c.spans, total.spans]) {
                const e = add(o, key);
                e.spans += 1; e.frames += f;
                if (sim?.responders > 0) e.withResponders += 1;
                if (sim?.changed > 0) { e.changedFrames += sim.changed; e.flips += sim.flips; e.spansChanged += 1;
                    if (o === c.spans) e.details.push({ level, why: w, frames: f, changed: sim.changed, flips: sim.flips, first: sim.first, ids: sim.ids }); }
                if (pulse?.pulsers > 0) e.withPulsers += 1;
                if (pulse?.active > 0) e.withActivePulser += 1;
                if (pulse?.changed > 0) e.spansPulserChanged += 1;
                if (pulse?.hits) e.pulserHitFrames += pulse.hits;
                if (pulse?.reachHits) { e.pulserReachFrames += pulse.reachHits; e.spansPulserReach += 1;
                    for (const r of pulse.reached) if (!e.reached.includes(r)) e.reached.push(r);
                    if (o === c.spans) e.details.push({ level, why: w, frames: f, pulse }); }
                if (sim?.error || pulse?.error) e.errors = (e.errors ?? 0) + 1;
            }
        },
        onTick(o) {
            const key = `${o.kind}-on-${o.presser.split('@')[0]}${o.rockGroup ? '-rockgroup' : ''}`;
            for (const m of [c.overlaps, total.overlaps]) m[key] = (m[key] ?? 0) + 1;
            c.where = c.where ?? {};
            const wk = `${key} L${o.level} ${o.presser}${o.ids ? ` ${o.ids.join('+')}` : ''}`;
            c.where[wk] = (c.where[wk] ?? 0) + 1;
        },
        onLump(texted, tag, level) {
            const key = texted ? 'texted' : 'textless';
            for (const m of [c.lumps, total.lumps]) m[key] = (m[key] ?? 0) + 1;
            if (texted) { c.textedAt = c.textedAt ?? []; c.textedAt.push(`L${level} ${tag}`); }
        },
    };
}
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
if (process.argv[1] && process.argv[1].endsWith('census2.mjs')) {
    const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
    const { runTape } = await import(`${ROOT}frontend/modules/seedlingDemo/tapeRunner.js`);
    const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
    const OVER = JSON.parse(arg('over', '{}'));
    const FIX = join(ROOT, 'frontend/modules/seedlingDemo/fixtures');
    const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const files = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
        ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
    const total = { spans: {}, overlaps: {}, lumps: {} };
    const rows = [];
    let n = 0;
    for (const p of files) {
        let tape;
        try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
        if (!tape?.inputs || !tape?.boot) continue;
        n += 1;
        const c = { spans: {}, overlaps: {}, lumps: {} };
        globalThis.__DF = makeHooks(c, total);
        let threw = null;
        try { withContactFidelity(OVER, () => runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { threw = String(e?.message ?? e).slice(0, 100); }
        if (globalThis.__DF.tickErr) c.tickErr = globalThis.__DF.tickErr;
        const interesting = Object.values(c.spans).some((e) => e.spansChanged > 0 || e.spansPulserReach > 0 || e.spansPulserChanged > 0) || Object.keys(c.overlaps).length > 0;
        rows.push({ tape: relative(ROOT, p), threw, ...c });
        if (interesting) {
            const ch = Object.entries(c.spans).filter(([, e]) => e.spansChanged > 0 || e.spansPulserChanged > 0)
                .map(([k, e]) => `${k}: responders ${e.spansChanged}/${e.spans} spans (${e.changedFrames} frames, ${e.flips} flips); pulser state ${e.spansPulserChanged}, hit frames ${e.pulserHitFrames}, reach frames ${e.pulserReachFrames} ${JSON.stringify(e.reached)} ${JSON.stringify(e.details.map((d) => [d.level, d.why, d.frames, d.changed ?? null, d.pulse ? [d.pulse.active, d.pulse.hits, d.pulse.reachHits, d.pulse.reached] : null]))}`);
            console.log(`${relative(ROOT, p)}${threw ? ' (threw)' : ''}${c.tickErr ? ` tickErr ${c.tickErr}` : ''}\n    ${[...ch, c.where ? `overlaps ${JSON.stringify(c.where)}` : ''].filter(Boolean).join('\n    ')}`);
        }
    }
    delete globalThis.__DF;
    console.log(`\ntapes ${n}`);
    for (const [k, e] of Object.entries(total.spans).sort()) console.log(`  ${k.padEnd(28)} spans ${e.spans}, frames ${e.frames}, w/ responders ${e.withResponders}, responder-changed ${e.spansChanged} (${e.changedFrames} fr, ${e.flips} flips); w/ pulsers ${e.withPulsers}, active pulser ${e.withActivePulser}, pulser-changed ${e.spansPulserChanged}, pulser hit frames ${e.pulserHitFrames}, reach frames ${e.pulserReachFrames} in ${e.spansPulserReach} spans ${JSON.stringify(e.reached)}${e.errors ? `, sim errors ${e.errors}` : ''}`);
    console.log(`  overlaps (live ticks): ${JSON.stringify(total.overlaps)}`);
    console.log(`  lumps: ${JSON.stringify(total.lumps)} (placed pickups; a runtime darksword/fire is texted: see pickup-lump spans)`);
    const jo = arg('json', null);
    if (jo) writeFileSync(jo, `${JSON.stringify({ tapes: n, over: OVER, total: { spans: Object.fromEntries(Object.entries(total.spans).map(([k, e]) => [k, { ...e, details: undefined }])), overlaps: total.overlaps, lumps: total.lumps },
        rows: rows.filter((r) => Object.values(r.spans).some((e) => e.spansChanged > 0 || e.withResponders > 0 || e.withPulsers > 0) || Object.keys(r.overlaps).length || r.threw || r.textedAt)
            .map((r) => ({ ...r, spans: Object.fromEntries(Object.entries(r.spans).map(([k, e]) => [k, { ...e, details: e.details.length ? e.details : undefined }])) })) }, null, 1)}\n`);
}
