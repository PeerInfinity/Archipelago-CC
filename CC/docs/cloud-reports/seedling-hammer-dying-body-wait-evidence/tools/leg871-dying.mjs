// The first branch's state: solveSegment driven on an observed run (the wallsflip leg871c harness). ⚠ The observed run is
// the one the solver LEFT at a rewind (OPP_PRESS_FALLBACK, t724) — not the refusal state; then the same run stood still.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const { withChaserStagedHunt, withClearTagChain, withStanceBurn, solveSegment, planPacedWait } = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, forkRunFor, solverGoalsOf } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const name = process.argv[2] ?? 'leg871-l39-l40-request.json.gz';
const walls = (process.argv[3] ?? '1') === '1';
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + name)).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const withSet = (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, fn))))));
const IDS = ['bob@736,752', 'bob@736,800', 'bobsoldier@880,832'];
withL40Flip(false, () => withSet(() => {
    const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true,
        equips: tape.equips ?? null, holds: tape.holds ?? null };
    const run = replayTape({ ...args, perTick: tape.perTick });
    const life = new Map(IDS.map((id) => [id, { id }]));
    const note = () => {
        const cs = run.entities('chasers') ?? [];
        for (const id of IDS) {
            const c = cs.find((q) => q.id === id); const e = life.get(id);
            if (c && c.hits !== e.hits) { (e.hitAt ??= []).push([run.ticksCompleted, c.hits]); e.hits = c.hits; }
            if (c?.dying && e.dying === undefined) e.dying = run.ticksCompleted;
            if (!c && e.dying !== undefined && e.gone === undefined) e.gone = run.ticksCompleted;
        }
    };
    const adv = run.advance.bind(run);
    run.advance = (k) => { const r = adv(k); note(); return r; };
    const forkOf = forkRunFor({ ...args, prefixLength: tape.perTick.length });
    let work = 0; let err = null;
    try {
        solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'd', boot: tape.staging.boot, prefix: tape.perTick,
            dashMode: 'none', forkRun: () => forkOf(), shouldStop: () => { work += 1; return false; }, fineCheckpoints: true });
    } catch (e) { err = e; }
    console.log(`walls=${walls} ${err ? 'REFUSED' : 'SOLVED'} work=${work} observed run left at clock ${run.ticksCompleted} `
        + `segment keys=${err?.perTick?.length ?? '-'} hits=${JSON.stringify(run.playerHits.map((h) => [h.t, h.id]))}`);
    if (!err) return;
    const pl = run.state;
    console.log(`player where the observed run was left (${pl.x.toFixed(1)},${pl.y.toFixed(1)})`);
    for (const c of run.entities('chasers') ?? []) if (IDS.includes(c.id)) {
        console.log('  ', JSON.stringify({ id: c.id, x: +c.x.toFixed(1), y: +c.y.toFixed(1), hits: c.hits,
            hitsTimer: c.hitsTimer, dying: c.dying ?? false, d: +Math.hypot(c.x - pl.x, c.y - pl.y).toFixed(1) }));
    }
    { const c = (run.entities('chasers') ?? []).find((q) => q.id === 'bob@736,752');
      console.log('live dying body fields:', JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k, v]) => typeof v !== 'object' || v === null || k === 'anim')))); }
    console.log(`player v (${pl.vx},${pl.vy}) fall ${pl.fall ?? false} direction ${pl.direction}`);
    // the run's own FORECAST: stand still, step the chaser forecast, read the tick the dying body leaves it
    const f = run.chaserForecast();
    const st = { ...run.state };
    for (let k = 1; k <= 120; k += 1) {
        const proj = f.step(st, { slashing: false });
        const c = proj.find((q) => q.id === 'bob@736,752');
        if (!c) { console.log(`forecast: bob@736,752 leaves the forecast at forecast tick ${k} (run clock ${run.ticksCompleted + k})`); break; }
    }
    const pw = planPacedWait(run, { ticks: 12, keep: null });
    console.log('paced wait 12:', pw.plan ? `${pw.plan.out}/${pw.plan.back} x${pw.plan.span} gap ${pw.plan.gap}` : 'none', pw.tried.slice(0, 3));
    // the model's own answer: stand still from the refusal state and read the ledger and the roster
    const h0 = run.playerHits.length;
    for (let k = 1; k <= 60 && life.get('bob@736,752').gone === undefined; k += 1) {
        adv(new Set()); note();
        const c = (run.entities('chasers') ?? []).find((q) => q.id === 'bob@736,752');
        if (c) console.log(`  still t${run.ticksCompleted}: dying ${c.dying} destroy ${c.destroy} alpha ${c.alpha} hitsTimer ${c.hitsTimer}`);
    }
    console.log('still from there: hits', JSON.stringify(run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id])), 'run clock', run.ticksCompleted, 'player', run.state.x.toFixed(1), run.state.y.toFixed(1));
    console.log('life (run clock):', JSON.stringify([...life.values()]));
}));
