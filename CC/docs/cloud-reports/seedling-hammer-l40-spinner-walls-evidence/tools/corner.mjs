// SPINNER-CORNER step 1 — leg (key) `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12:
// wandlock@480,560 cleared` (the hammerClearTagChain.train row's set, dashless, uncapped). solveSegment is driven on an
// OBSERVED run; OPP_PRESS_FALLBACK rewinds onto a fresh run at the first branch's refusal, so the observed run is left
// exactly where the first branch's press kill refused (`HAMMER_SAFETY`, "no step out"). Prints, per tick over a window
// before that refusal: the keys, the player box and velocity, every spinner body (rect, hits, i-frame), the hammer line
// at that tick's phase, the chasers near, the landings and every pressEscape / OPP decision the branch took; then every
// key set at the corner with what it lands on.
// Usage: node corner.mjs [--walls=0|1] [--from=<tick>] [--window=<n>] [--seam=<clock> [--dash=none|…]]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const SB = await import(M + 'solverBot.js');
const { withChaserStagedHunt, withClearTagChain, withStanceBurn, solveSegment, HAMMER_ESCAPE_TRACE, clearOfHammersAt,
    previewOrDeath } = SB;
const { withOpportunisticStrike, OPPORTUNISTIC_STRIKE_TRACE } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, forkRunFor, solverGoalsOf } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const { SPINNER, hammerLine, hammerHitsPlayer } = await import(M + 'spinner.js');
const { playerBoxAt } = await import(M + 'playerPhysicsV2.js');

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const name = arg('fixture', 'leg871-l39-l40-request.json.gz');
const wallsArg = arg('walls', null);
const WINDOW = Number(arg('window', 14));
// --seam=<clock> loads BOBIFRAME's captured 397 request instead (`level_40__r23c29 <- in_L39_144_0 -> location:Level
// 040 - Chest`) re-stamped to that arrival clock, solved at the SHIPPED defaults (no train-row set)
const seamArg = arg('seam', null);
// L40-SPINNER-WALLS: --req=<capture.jsonl> --key=<substring> [--n=<request>] loads this slice's own capture (shipped defaults)
const reqLines = readFileSync(arg('req'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((o) => o.key.includes(arg('key')));
const reqs = reqLines[0].requests;
const r0 = reqs[arg('n', null) === null ? reqs.length - 1 : Number(arg('n'))].request;
const c0 = seamArg === null ? r0 : { ...r0, staging: { ...r0.staging, seam: { ...r0.staging.seam, time: Number(seamArg) } } };
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(c0);
const levelSource = levelSourceFromAtlas(source.records);
const fid = { forecastShieldBump: true, ...(wallsArg === null ? {} : { chaserSpinnerWalls: wallsArg === '1' }) };
const withSet = true ? (fn) => fn() : (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true, () => withContactFidelity(fid, fn))))));
const f1 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : v);
const rectS = (r) => `[${f1(r.x)},${f1(r.y)}..${f1(r.right)},${f1(r.bottom)}]`;

((fn) => fn())(() => withSet(() => {
    const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true,
        equips: tape.equips ?? null, holds: tape.holds ?? null };
    const run = replayTape({ ...args, perTick: tape.perTick });
    const rows = [];
    const snap = (keys) => {
        const pl = run.state;
        const box = playerBoxAt(pl.x, pl.y);
        const gt = run.gameTimeAt(0);
        const spin = (run.entities('spinnerBodies') ?? []).map((b) => {
            const c = { x: b.rect.x + SPINNER.originX, y: b.rect.y + SPINNER.originY };
            const ln = hammerLine(c, gt);
            return { id: b.id, rect: rectS(b.rect), hits: b.hits, hitsTimer: b.hitsTimer, destroy: b.destroy ?? null, vx: f1(b.vx), vy: f1(b.vy),
                kb: b.knockback ?? b.kb ?? null, line: `(${f1(ln.x0)},${f1(ln.y0)})->(${f1(ln.x1)},${f1(ln.y1)})`,
                d: f1(Math.hypot(c.x - (pl.x), c.y - (pl.y))), lineHitsBox: Boolean(hammerHitsPlayer(c, gt, box)) };
        }).filter((s) => s.d < 80);
        const ch = (run.entities('chasers') ?? []).map((c) => ({ id: c.id, x: f1(c.x), y: f1(c.y), hits: c.hits,
            dying: c.dying ?? false, d: f1(Math.hypot(c.x - pl.x, c.y - pl.y)) })).filter((c) => c.d < 60);
        return { t: run.ticksCompleted, keys: keys ? [...keys].join('+') || '-' : null, x: f1(pl.x), y: f1(pl.y),
            vx: f1(pl.vx), vy: f1(pl.vy), dir: pl.direction, box: rectS(box), gt, spin, ch,
            hits: run.playerHits.length };
    };
    const adv = run.advance.bind(run);
    // L40-SPINNER-WALLS --depth=H: before each tick from --probe-from, per FIRST key set, the deepest a layered (deduped)
    // survival search reaches against the run's own forecast (clearOfHammersAt, safeStep's predicate), up to H ticks
    const H = Number(arg('depth', 0));
    const probeFrom = Number(arg('probe-from', 1e9));
    const OPTS = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
    const depthRows = [];
    const CAP = Number(arg('cap', 400));
    const probeTo = Number(arg('probe-to', 1e9));
    // per FIRST key set: the deepest a layered survival search reaches (layers deduped at 0.5 px / 0.1 px-tick and capped
    // at --cap states, so a depth is a LOWER bound); first sets that cannot reach depth 1 read 0
    const deep = () => {
        const fc = run.spinnerForecast(H + 2);
        const step = previewOrDeath(run.previewStepper());
        const q = (n) => [Math.round(n.x * 2), Math.round(n.y * 2), Math.round(n.vx * 10), Math.round(n.vy * 10)].join(',');
        const firsts = OPTS.map((o) => step({ ...run.state }, new Set(o)));
        const out = firsts.map(() => 0);
        let layer = [];
        firsts.forEach((n, i) => { if (n && clearOfHammersAt(run, playerBoxAt(n.x, n.y), fc, 1)) { out[i] = 1; layer.push([n, i]); } });
        for (let d = 1; d < H && layer.length; d += 1) {
            const nx = new Map();
            for (const [st, i] of layer) for (const o2 of OPTS) {
                const m = step({ ...st }, new Set(o2));
                if (!m || !clearOfHammersAt(run, playerBoxAt(m.x, m.y), fc, d + 1)) continue;
                const k = q(m) + '|' + i;
                if (!nx.has(k)) nx.set(k, [m, i]);
            }
            const byFirst = new Map();
            for (const v of nx.values()) { const l = byFirst.get(v[1]) ?? []; if (l.length < CAP / 9) l.push(v); byFirst.set(v[1], l); }
            layer = [...byFirst.values()].flat();
            for (const [, i] of layer) out[i] = d + 1;
        }
        return out;
    };
    run.advance = (k) => {
        if (H > 0 && run.ticksCompleted >= probeFrom && run.ticksCompleted <= probeTo) depthRows.push({ t: run.ticksCompleted, keys: [...k].join('+') || '-', f: deep() });
        const r = adv(k); rows.push(snap(k)); return r; };
    const esc = [];
    const opp = [];
    HAMMER_ESCAPE_TRACE.sink = (r) => { if (r.run === run) esc.push({ caller: r.caller, t: r.t, pressAt: r.pressAt,
        id: r.id, ok: r.ok, claim: r.claim, bound: r.bound, why: r.why?.slice(0, 200) ?? null, exp: r.expansions }); };
    OPPORTUNISTIC_STRIKE_TRACE.sink = (r) => { opp.push({ t: run.ticksCompleted, ...r, previewStrikes: undefined }); };
    const shv = [];
    if (SB.SHOVED_BODY_LOOKAHEAD_TRACE) SB.SHOVED_BODY_LOOKAHEAD_TRACE.sink = (r) => { if (r.t >= probeFrom && r.t <= probeTo) shv.push(r); };
    let err = null;
    try {
        solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'corner', boot: tape.staging.boot,
            prefix: tape.perTick, dashMode: arg('dash', 'none'), forkRun: forkRunFor({ ...args, prefixLength: tape.perTick.length }),
            shouldStop: () => false, fineCheckpoints: true });
    } catch (e) { err = e; }
    HAMMER_ESCAPE_TRACE.sink = null;
    OPPORTUNISTIC_STRIKE_TRACE.sink = null;
    console.log('HAMMER_BODY_GATE', SB.HAMMER_BODY_GATE?.enabled ?? '(absent)', JSON.stringify(SB.HAMMER_BODY_GATE_COUNTS ?? null));
    const end = run.ticksCompleted;
    console.log(`walls=${wallsArg ?? 'default'} observed run left at t${end}; outcome ${err ? 'REFUSED' : 'SOLVED'} `
        + `(${String(err?.message ?? '').split('\n')[0].slice(0, 160)})`);
    const landed = (run.ledger('spinnerPressHits') ?? []).map((h) => ({ t: h.t, id: h.id, landed: h.landed, hits: h.hits,
        ...(h.knockback ? { kb: h.knockback } : {}) }));
    console.log('spinnerPressHits on the branch:', JSON.stringify(landed));
    console.log('player hits on the branch:', JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])));
    const from = Number(arg('from', end - WINDOW));
    console.log(`pressEscape calls from t${from - 40}:`);
    for (const e of esc.filter((x) => x.t >= from - 40)) console.log('  ', JSON.stringify(e));
    console.log(`OPP decisions from t${from - 40}:`, JSON.stringify(opp.filter((x) => x.t >= from - 40)));
    console.log(`per-tick rows t${from}..t${end} (the state AFTER the tick's keys):`);
    for (const r of rows.filter((x) => x.t >= from)) console.log('  ', JSON.stringify(r));
    for (const r of shv) console.log('  SHOVED', JSON.stringify(r));
    for (const d of depthRows) console.log('  DEPTH', d.t, 'keys', d.keys, OPTS.map((o, i) => `${o.join('+') || 'stand'}:${d.f[i]}`).join(' '));
    // the corner: every key set the controller can produce, stepped once, against forecast row 1 (safeStep's test)
    const step = previewOrDeath(run.previewStepper());
    const f = run.spinnerForecast(2);
    const sets = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'],
        ['down', 'right']];
    console.log(`at the corner t${end}: player (${f1(run.state.x)},${f1(run.state.y)}) v (${f1(run.state.vx)},${f1(run.state.vy)}); forecast row 1 gameTime ${run.gameTimeAt(1)}:`,
        JSON.stringify((f[1] ?? []).map((r) => ({ id: r.id, rect: rectS(r) }))));
    for (const s of sets) {
        const next = step({ ...run.state }, new Set(s));
        if (!next) { console.log('   ', s.join('+') || 'stand', 'DIES'); continue; }
        const box = playerBoxAt(next.x, next.y);
        const ok = clearOfHammersAt(run, box, f, 1);
        const why = (f[1] ?? []).map((r) => {
            const c = { x: r.x + SPINNER.originX, y: r.y + SPINNER.originY };
            const body = box.right > r.x && box.x < r.right && box.bottom > r.y && box.y < r.bottom;
            const line = hammerHitsPlayer(c, run.gameTimeAt(1), box);
            return body || line ? `${r.id ?? '?'}:${body ? 'body' : ''}${line ? 'line' : ''}` : null;
        }).filter(Boolean);
        console.log('   ', (s.join('+') || 'stand').padEnd(10), `-> (${f1(next.x)},${f1(next.y)}) box ${rectS(box)}`,
            ok ? 'CLEAR' : `blocked ${why.join(' ')}`);
    }
}));
