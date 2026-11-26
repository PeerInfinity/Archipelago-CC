#!/usr/bin/env node
// wave 65 (RESPONDERORDER): wave 64's `replay-arms.mjs`, re-keyed to `responderStepAfterReaders`.
//   ARM=off   the shipped defaults (= wave 64's arm i)
//   ARM=on    `responderStepAfterReaders` ON. Its step runs INSIDE the next advance, so the game's L at tick t is the
//             model's L in row t (the same row as the positions); OFF it is row t-1 (the step at the end of advance t-1).
//   OVER='{"k":true,…}' adds keys to either arm (the composition rows).
// Original header (wave 64):
// D4 (wave 64): replay the model against each witnessed shape's GAME stream (`d3/witness-p4g.json`, the whole tape's
// per-tick `botMobiles` samples) under one ARM, and name the first divergent tick, its px, and the end state.
//   ARM=i     the shipped defaults
//   ARM=ii    the readers read `openActivatorIdsBeforeStep` (needs `scratch.py apply`; sets `globalThis.__RO`)
//   ARM=iii   `spinnerLockLag` OFF (the (B) control: which half the lag already covers)
//   ARM=iv    the responders' presses read the previous step's player box (needs the scratch: E5)
//   ARM=ii+iv both
// Compared per tick t: the Player and every reader at game tick t vs model row t (row t = after t ticks); L's type at
// game tick t vs the model's L after step t-1 (the step at the end of tick t-1 is the game's frame-t responder update,
// measured on a1-open: the game shows L open first at tick 102, the model after step 101).
// usage: ARM=i node replay-arms.mjs [--only=a,b] [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs';
const HERE = new URL('../../seedling-fidelity-readerorder-evidence/tools/', import.meta.url).pathname;
const ROOT = new URL('../../../../../', import.meta.url).pathname;
// STAGE=order: this wave's D1 shapes (`stage-order.mjs`, `--witness=` its `d2/witness-order.json`); L is compared only
// for a tag-20 lock (a Cover's type is not on the page; its shapes are compared on positions).
const ORDER = process.env.STAGE === 'order';
const S = ORDER ? await import(new URL('./stage-order.mjs', import.meta.url).pathname) : await import(`${HERE}stage.mjs`);
const { atlasLevelSource } = await import(`${ROOT}frontend/modules/seedlingDemo/levelSource.js`);
const { withContactFidelity } = await import(`${ROOT}frontend/modules/seedlingDemo/contactFidelity.js`);
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const ARM = process.env.ARM ?? 'off';
const ONLY = arg('only', null)?.split(',') ?? null;
const W = { shapes: arg('witness', ORDER ? new URL('../d2/witness-order.json', import.meta.url).pathname : `${HERE}../d3/witness-p4g.json,${HERE}../d3/witness-p4g-b1r124.json`).split(',')
    .flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).shapes) };
const atlas = atlasLevelSource();
const over = { ...(ARM === 'on' ? { responderStepAfterReaders: true } : {}), ...JSON.parse(process.env.OVER ?? '{}') };
// ARM=iv: `__RO.pressLag` (the responders press from the previous step's box); ARM=ii+iv: both. Each needs the scratch.
if (ARM === 'ii') globalThis.__RO = { arm: 'before', hits: [] };
if (ARM === 'iv') globalThis.__RO = { pressLag: true, hits: [] };
if (ARM === 'ii+iv') globalThis.__RO = { arm: 'before', pressLag: true, hits: [] };
// ARM=v: (ii) + (iv) + `__RO.occ` (Enemy occupancy for the Lock family, and the responders' occupancy judged where THIS
// frame's readers left them); ARM=ii+v: (ii) + occ, no press lag.
if (ARM === 'v') globalThis.__RO = { arm: 'before', pressLag: true, occ: true, hits: [] };
if (ARM === 'ii+occ') globalThis.__RO = { arm: 'before', occ: true, hits: [] };

const out = [];
for (const w of W.shapes) {
    if (ONLY && !ONLY.includes(w.shape)) continue;
    const s = S.shape(w.shape);
    const tape = S.shapeTape(s, w.params);
    if (JSON.stringify(tape) !== JSON.stringify(w.tape)) throw new Error(`${w.shape}: the rebuilt tape is not the witnessed one`);
    const src = (n) => S.stagedRecord(atlas(n), s);
    const lockId = ORDER ? S.RESP_ID(s) : S.L_ID(s.base);
    const lockSeen = !ORDER || lockId === `lock@${s.base.resp.x},${s.base.resp.y}`;
    const m = withContactFidelity(over, () => S.replay(tape, src, { lockId }));
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    const READ = /PushableBlock|Spinner|WallFlyer/;
    let first = null;
    let worst = 0;
    let lockFirst = null;
    let compared = 0;
    let lastT = null;
    const perTick = [];
    // From t1: a t0 `botMobiles` sample can be read before the boot's world swap (a1-ctl, b1-r124: no readers yet).
    for (let t = 1; t < m.rows.length; t++) {
        const g = game.get(t);
        const r = m.rows[t];
        if (!g || !r || r.level !== S.LEVEL) continue;
        // The PLAYER from the drained stream (authoritative, one observation per tick); a sample's own Player row can be
        // a pre-boot read at t0 (a1-ctl's t0 sample is the page's previous world).
        const gp = w.whole.stream[t] ?? null;
        const gr = g.rows.filter((x) => READ.test(x.cls));
        const mr = [...r.push.map((p) => ({ x: p.x, y: p.y })), ...r.spin, ...r.fly];
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : Infinity;
        let dr = 0;
        if (gr.length !== mr.length) dr = Infinity;
        else for (let i = 0; i < gr.length; i++) dr = Math.max(dr, Math.abs(gr[i].x - mr[i].x), Math.abs(gr[i].y - mr[i].y));
        d = Math.max(d, dr);
        const ml = t > 0 ? m.rows[ARM === 'on' ? t : t - 1]?.lock?.open ?? null : null;
        const lockMismatch = lockSeen && t > 0 && ml !== null && ml !== g.lockOpen;
        if (d > 1e-9 && first === null) first = { t, px: +d.toFixed(4), game: { player: gp && [gp.x, gp.y], readers: gr.map((x) => [x.cls, x.x, x.y]) }, model: { player: [r.x, r.y], readers: mr.map((x) => [x.x, x.y]) } };
        if (lockMismatch && lockFirst === null) lockFirst = { t, game: g.lockOpen, model: ml };
        if (d > worst) worst = d;
        compared += 1;
        lastT = t;
        perTick.push({ t, d: +d.toFixed(4), gameLock: g.lockOpen, modelLockPrev: ml, gameReaders: gr.map((x) => [x.x, x.y]), modelReaders: mr.map((x) => [+x.x.toFixed(4), +x.y.toFixed(4)]), gamePlayer: gp && [gp.x, gp.y], modelPlayer: [r.x, r.y] });
    }
    const gEnd = game.get(lastT);
    const mEnd = m.rows[lastT];
    const row = { shape: w.shape, arm: ARM, compared, first, worstPx: worst === Infinity ? 'Infinity' : +worst.toFixed(4), lockFirst,
        end: { t: lastT, game: { readers: gEnd?.rows.filter((x) => READ.test(x.cls)).map((x) => [x.x, x.y]), lock: gEnd?.lockOpen },
            model: { readers: [...mEnd.push.map((p) => [p.x, p.y]), ...mEnd.spin.map((p) => [+p.x.toFixed(3), +p.y.toFixed(3)]), ...mEnd.fly.map((p) => [p.x, p.y])], lock: mEnd.lock?.open } },
        error: m.error, perTick };
    out.push(row);
    console.log(`${w.shape} ARM ${ARM}: ${compared} ticks; ${first ? `FIRST DIVERGENCE t${first.t} (${first.px} px): game ${JSON.stringify(first.game)} model ${JSON.stringify(first.model)}` : '0 px over the stream'}; worst ${row.worstPx} px; L ${lockFirst ? `first differs t${lockFirst.t} (game ${lockFirst.game ? 'open' : 'shut'}, model ${lockFirst.model ? 'open' : 'shut'})` : 'agrees every tick'}; end t${lastT} game ${JSON.stringify(row.end.game)} model ${JSON.stringify(row.end.model)}${m.error ? ` ERROR ${m.error.message}` : ''}`);
}
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify(out, null, 1)}\n`);
