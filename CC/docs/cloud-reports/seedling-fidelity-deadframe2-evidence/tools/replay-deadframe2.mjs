#!/usr/bin/env node
// wave 69 (DEADFRAME2): the model on each `stage-deadframe2.mjs` shape, row t = after t completed advances: the player,
// the blocks, L (open), the rock (fallen), the dead frames charged so far (the clock's spends), and the ledgers.
// With `--witness=f.json` it compares the game's per-tick samples: the player (the drained stream), every block, L
// (row t-1 OFF / row t with `responderStepAfterReaders` ON, wave 65's alignment), the rock's fall and `dead_frames`.
// usage: OVER='{"k":true}' node replay-deadframe2.mjs [--only=a,b] [--witness=f.json] [--json=out.json] [--quiet]
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const S = await import(new URL('./stage-deadframe2.mjs', import.meta.url).pathname);
const M = (p) => import(`${ROOT}frontend/modules/seedlingDemo/${p}`);
const { atlasLevelSource } = await M('levelSource.js');
const { withContactFidelity, CONTACT_FIDELITY } = await M('contactFidelity.js');
const { heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const ONLY = arg('only', null)?.split(',') ?? null;
const WIT = arg('witness', null);
const W = WIT ? WIT.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).shapes).filter((w) => w.shape) : null;
const over = JSON.parse(process.env.OVER ?? '{}');
const atlas = atlasLevelSource();
export function model(s, params, o = over) {
    const tape = S.shapeTape(s, params);
    const lockId = S.RESP_ID(s);
    const rows = [];
    let error = null;
    let after = false;
    let run;
    withContactFidelity(o, () => {
        after = CONTACT_FIDELITY.responderStepAfterReaders;
        const snap = () => {
            const L = lockId ? (run.activatorsNow?.responders ?? []).find((a) => a.id === lockId) : null;
            const push = run.pushables ? [...run.pushables].filter(([, r]) => !r.removed).map(([id, r]) => [id, r.rect.x, r.rect.y]) : [];
            return { level: run.level, x: run.state.x, y: run.state.y, lock: L ? L.open : null,
                rock: run.rockFalls.some((r) => r.flag?.tag === S.ROCK_TAG), push,
                pulses: (run.pulserHits ?? []).length, pushes: (run.pulsePushes ?? []).length };
        };
        try {
            run = createRunForStaging(stagingFromTape(tape), (n) => S.stagedRecord(atlas(n), s), { scratchPersistence: true });
            rows.push(snap());
            for (let t = 0; t < tape.tick_count; t++) {
                run.advance(heldKeysAt(tape, t));
                rows.push(snap());
                if (run.level !== S.LEVEL) break;
            }
        } catch (e) { error = String(e?.message ?? e).slice(0, 300); }
    });
    return { tape, rows, error, after, rockFalls: run?.rockFalls ?? [], pulserHits: run?.pulserHits ?? [], pulsePushes: run?.pulsePushes ?? [],
        deadResponderFrames: run?.deadResponderFrames ?? [], deadPulserFrames: run?.deadPulserFrames ?? [], ceremonyStarts: run?.ceremonyStarts ?? [] };
}
const firstPush = (rows) => { for (let t = 1; t < rows.length; t++) if (rows[t].pushes > rows[t - 1].pushes) return t; return null; };
export function compare(w, m) {
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    let worst = 0; let first = null; let lockFirst = null; let rockFirst = null; let blockFirst = null; let compared = 0;
    for (let t = 1; t < m.rows.length; t++) {
        const g = game.get(t); const r = m.rows[t];
        if (!g || !r || r.level !== S.LEVEL) continue;
        compared += 1;
        const gp = w.whole.stream[t] ?? null;
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : 0;
        // blocks: the game's PushableBlock* rows (the entity point is the rect corner: origin 0) against the model's rects, in x order
        const gb = g.rows.filter((x) => /PushableBlock/.test(x.cls)).map((x) => [x.x, x.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const mb = r.push.map(([, x, y]) => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let bd = gb.length === mb.length ? 0 : Infinity;
        for (let i = 0; bd !== Infinity && i < gb.length; i++) bd = Math.max(bd, Math.abs(gb[i][0] - mb[i][0]), Math.abs(gb[i][1] - mb[i][1]));
        if (bd > 0 && blockFirst === null) blockFirst = { t, game: gb, model: mb };
        d = Math.max(d, bd);
        if (d > worst) worst = d;
        if (d > 0 && first === null) first = t;
        const ml = m.after ? r.lock : (m.rows[t - 1]?.lock ?? null);
        if (ml !== null && ml !== g.lockOpen && lockFirst === null) lockFirst = { t, game: g.lockOpen, model: ml };
        if (r.rock !== g.rockFell && rockFirst === null) rockFirst = { t, game: g.rockFell, model: r.rock };
    }
    const gOpen = w.whole.samples.find((g) => g.lockOpen)?.tick ?? null;
    const mOpen = (() => { for (let t = 1; t < m.rows.length; t++) { const l = m.after ? m.rows[t].lock : m.rows[t - 1].lock; if (l) return t; } return null; })();
    const gRock = w.whole.samples.find((g) => g.rockFell)?.tick ?? null;
    const mRock = (() => { for (let t = 1; t < m.rows.length; t++) if (m.rows[t].rock) return t; return null; })();
    const gMove = (() => { const s = w.whole.samples; for (let i = 1; i < s.length; i++) { const a = JSON.stringify(s[i - 1].rows.filter((x) => /PushableBlockFire/.test(x.cls)).map((x) => [x.x])); const b = JSON.stringify(s[i].rows.filter((x) => /PushableBlockFire/.test(x.cls)).map((x) => [x.x])); if (a !== b) return null; } return null; })();
    return { shape: w.shape, compared, worst, first, lockFirst, rockFirst, blockFirst, gOpen, mOpen, gRock, mRock, mFirstPush: firstPush(m.rows), error: m.error,
        deadGame: [...new Set(w.whole.samples.map((g) => g.dead))], gMove };
}
if (process.argv[1]?.endsWith('replay-deadframe2.mjs')) {
    const out = [];
    for (const s of S.SHAPES) {
        if (ONLY && !ONLY.includes(s.name)) continue;
        const ws = W ? W.filter((w) => w.shape === s.name) : [null];
        for (const w of ws) {
            const m = model(s, w?.params ?? {});
            if (w && JSON.stringify(m.tape) !== JSON.stringify(w.tape)) throw new Error(`${s.name}: the rebuilt tape is not the witnessed one`);
            if (!w) {
                const r = m.rows;
                const pushT = []; for (let t = 1; t < r.length; t++) if (r[t].pushes > r[t - 1].pushes) pushT.push(t);
                const moves = []; for (let t = 1; t < r.length; t++) if (JSON.stringify(r[t].push) !== JSON.stringify(r[t - 1].push)) moves.push([t, ...r[t].push.map((p) => `${p[1]},${p[2]}`)]);
                const lockT = (() => { for (let t = 1; t < r.length; t++) { const l = m.after ? r[t].lock : r[t - 1].lock; if (l) return t; } return null; })();
                const rockT = (() => { for (let t = 1; t < r.length; t++) if (r[t].rock) return t; return null; })();
                console.log(`${s.name}: ${r.length - 1} rows${m.error ? ` ERROR ${m.error}` : ''}; L open ${lockT}; rock ${rockT} ${JSON.stringify(m.rockFalls.map((f) => [f.t, f.frames ?? f.deadFrames ?? null]))}; ceremonies ${JSON.stringify(m.ceremonyStarts.map((c) => [c.t, c.tag]))}; pulse pushes at ${JSON.stringify(pushT)}; block moves ${JSON.stringify(moves.slice(0, 12))}; first pulse hits ${JSON.stringify(m.pulserHits.slice(0, 3).map((h) => h.t))} (${m.pulserHits.length}); dead pulser ${JSON.stringify(m.deadPulserFrames.filter((d) => d.frames > 1))}; player end ${r.at(-1).x},${r.at(-1).y}`);
                out.push({ shape: s.name, over, error: m.error, lockT, rockT, pushT, moves });
            } else {
                const c = compare(w, m);
                console.log(`${s.name}: ${c.compared} ticks compared, worst ${c.worst} px (first ${c.first}); L game ${c.gOpen} model ${c.mOpen}; rock game ${c.gRock} model ${c.mRock}; first block diff ${JSON.stringify(c.blockFirst)}; game dead ${JSON.stringify(c.deadGame)}${c.error ? ` ERROR ${c.error}` : ''}`);
                out.push({ ...c, over });
            }
        }
    }
    const jo = arg('json', null);
    if (jo) writeFileSync(jo, `${JSON.stringify(out, null, 1)}\n`);
}
