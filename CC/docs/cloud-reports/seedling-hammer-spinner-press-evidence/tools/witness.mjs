// scratch (SPIN): solve one captured request (env: the arm, SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM, SPIN_SEAM, L40C_BUDGET_WORK),
// keep the keys of every press kill that completed (PRESS_KILL_DONE_TRACE) and replay the one that killed --body on a FRESH
// run from the request's staging (⚖ 30(c): the walk certified is the walk driven): the body is gone at the kill's last
// tick, and every hit and death on the way is printed. Usage: node witness.mjs --request=<json {request}> --body=<id>
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const R = args.root ?? '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const PG = await import(R + 'frontend/modules/seedlingDemo/pressKillGuards.js');
const row = JSON.parse(readFileSync(args.request, 'utf8'));
const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(row.request);
if (process.env.L40C_BUDGET_WORK) tape.budgetWork = Number(process.env.L40C_BUDGET_WORK);
if (process.env.SPIN_SEAM) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: Number(process.env.SPIN_SEAM) } };
const kills = [];
PG.PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
PG.PRESS_KILL_DONE_TRACE.sink = null;
console.log('SWITCH', PG.PRESS_ESCAPE_SHIELD_CLAIM.enabled, 'COUNTS', JSON.stringify(PG.PRESS_ESCAPE_SHIELD_CLAIM_COUNTS));
console.log('ANSWER', answer.ok ? `SOLVED ${answer.plan.solution.length}` : `REFUSED work ${answer.work}: ${String(answer.message).slice(0, 300)}`);
const mine = kills.filter((k) => k.bodies.includes(args.body));
console.log('KILLS', kills.length, 'of', args.body, mine.length, JSON.stringify(mine.map((k) => ({ from: k.from, t: k.t, landings: k.landings.map((l) => l.t) }))));
for (const k of mine) {
    const run = replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const hits0 = run.playerHits.length;
    let goneAt = null;
    const fired = (t) => (run.equipsFired ?? []).some((e) => e.t === t);
    for (let i = 0; i < k.perTick.length; i += 1) {
        for (const e of (k.equips ?? []).filter((q) => q.t === i)) if (!fired(i)) run.equipNow(e.slot);
        run.advance(k.perTick[i]);
        if (goneAt === null && !(run.entities('spinnerBodies') ?? []).some((b) => b.id === args.body)) goneAt = run.ticksCompleted;
    }
    console.log('REPLAY', JSON.stringify({ ticks: k.perTick.length, level: run.level, goneAt, gone: goneAt !== null,
        hits: run.playerHits.slice(hits0).map((h) => ({ t: h.t, source: h.source, id: h.id })),
        deaths: run.playerDeaths.length, landings: (run.ledger('spinnerPressHits') ?? []).filter((h) => h.landed && h.id === args.body).map((h) => h.t) }));
}
