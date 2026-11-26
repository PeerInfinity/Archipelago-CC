#!/usr/bin/env node
// wave 66 (DEADFRAME): replay the model against each `stage-deadframe.mjs` shape's GAME stream (`d2/witness-*.json`,
// the whole tape's per-tick samples), wave 65's `replay-order.mjs` comparison re-keyed:
//   per tick t: the Player (the drained stream) and every reader (spinner, wallflyer) at game tick t vs model row t;
//   L's type (`lock` tag 20: (38,20) cleared) and the FallRock's fall ((38,22) cleared) at game tick t vs the model's
//   row t ON-ordering (`responderStepAfterReaders` ON: the step runs inside advance t) or row t−1 OFF (the step at the
//   end of advance t−1 is the game's frame-t responder update). The rock's fall is the model's `rockFalls` (a fall
//   charged at advance t is the game's frame-t `fall()`: row t both ways).
// usage: OVER='{"k":true}' node replay-deadframe.mjs [--only=a,b] [--witness=f.json] [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const S = await import(new URL('./stage-deadframe.mjs', import.meta.url).pathname);
const M = (p) => import(`${ROOT}frontend/modules/seedlingDemo/${p}`);
const { atlasLevelSource } = await M('levelSource.js');
const { withContactFidelity, CONTACT_FIDELITY } = await M('contactFidelity.js');
const { heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const ONLY = arg('only', null)?.split(',') ?? null;
const W = arg('witness', new URL('../d2/witness-all.json', import.meta.url).pathname).split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).shapes);
const over = JSON.parse(process.env.OVER ?? '{}');
const atlas = atlasLevelSource();
const out = [];
for (const w of W) {
    if (ONLY && !ONLY.includes(w.shape)) continue;
    const s = S.shape(w.shape);
    const tape = S.shapeTape(s, w.params);
    if (JSON.stringify(tape) !== JSON.stringify(w.tape)) throw new Error(`${w.shape}: the rebuilt tape is not the witnessed one`);
    const lockId = S.RESP_ID(s);
    const rows = [];
    let error = null;
    let after = false;
    withContactFidelity(over, () => {
        after = CONTACT_FIDELITY.responderStepAfterReaders;
        let run;
        const snap = () => {
            const L = (run.activatorsNow?.responders ?? []).find((a) => a.id === lockId);
            return { level: run.level, x: run.state.x, y: run.state.y, lock: L ? L.open : null,
                rock: run.rockFalls.some((r) => r.flag?.tag === S.ROCK_TAG),
                readers: [...(run.spinnerBodies ?? []).map((b) => [b.x, b.y]), ...(run.wallFlyerBodies ?? []).map((b) => [b.x, b.y])] };
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
    const game = new Map(w.whole.samples.map((g) => [g.tick, g]));
    let first = null; let worst = 0; let lockFirst = null; let rockFirst = null; let compared = 0;
    const lockDiff = [];
    for (let t = 1; t < rows.length; t++) {
        const g = game.get(t); const r = rows[t];
        if (!g || !r || r.level !== S.LEVEL) continue;
        const gp = w.whole.stream[t] ?? null;
        const gr = g.rows.filter((x) => /Spinner|WallFlyer/.test(x.cls)).map((x) => [x.x, x.y]);
        let d = gp ? Math.max(Math.abs(gp.x - r.x), Math.abs(gp.y - r.y)) : Infinity;
        if (gr.length !== r.readers.length) d = Infinity;
        else for (let i = 0; i < gr.length; i++) d = Math.max(d, Math.abs(gr[i][0] - r.readers[i][0]), Math.abs(gr[i][1] - r.readers[i][1]));
        const ml = rows[after ? t : t - 1]?.lock ?? null;
        if (ml !== null && ml !== g.lockOpen) { lockDiff.push(t); if (lockFirst === null) lockFirst = { t, game: g.lockOpen, model: ml }; }
        if (r.rock !== g.rockFell && rockFirst === null) rockFirst = { t, game: g.rockFell, model: r.rock };
        if (d > 1e-9 && first === null) first = { t, px: +d.toFixed(4), game: { player: gp && [gp.x, gp.y], readers: gr }, model: { player: [r.x, r.y], readers: r.readers } };
        if (d > worst) worst = d;
        compared += 1;
    }
    const gameOpen = w.whole.samples.find((g) => g.lockOpen)?.tick ?? null;
    const gameRock = w.whole.samples.find((g) => g.rockFell)?.tick ?? null;
    const modelOpen = (() => { const i = rows.findIndex((r) => r.lock); return i < 0 ? null : (after ? i : i + 1); })();
    const modelRock = (() => { const i = rows.findIndex((r) => r.rock); return i < 0 ? null : i; })();
    const row = { shape: w.shape, over, compared, first, worstPx: worst === Infinity ? 'Infinity' : +worst.toFixed(4), lockFirst, lockDiffs: lockDiff.length, rockFirst,
        gameOpen, modelOpen, gameRock, modelRock, error };
    out.push(row);
    console.log(`${w.shape} ${JSON.stringify(over)}: ${compared} ticks; ${first ? `FIRST DIVERGENCE t${first.t} (${first.px} px) game ${JSON.stringify(first.game)} model ${JSON.stringify(first.model)}` : '0 px'}; worst ${row.worstPx}; L ${lockFirst ? `differs from t${lockFirst.t} (${lockDiff.length} ticks; game opens ${gameOpen}, model ${modelOpen})` : `agrees every tick (opens ${gameOpen})`}; rock ${rockFirst ? `differs at t${rockFirst.t} (game ${gameRock}, model ${modelRock})` : `agrees (${gameRock})`}${error ? ` ERROR ${error}` : ''}`);
}
const jo = arg('json', null);
if (jo) writeFileSync(jo, `${JSON.stringify(out, null, 1)}\n`);
