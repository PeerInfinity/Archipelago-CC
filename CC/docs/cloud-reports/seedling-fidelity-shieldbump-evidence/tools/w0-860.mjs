// scratch (SHIELDBUMP W0 on leg 860): solve under the env's arm with the scratch __sbW0 hook counting, per pressEscape
// `first` forecast, the bumps the forecast stepped (key ON) or WOULD step: every state the escape supplies (approach +
// train) tested with shieldBumpTouches against the bump-blind rows (key OFF: the row of the state's tick). Then the kill's
// keys replayed on a fresh run: its own spinner shield bumps.
import { readFileSync } from 'node:fs';
const R = '/tmp/claude-0/sbwt/'; const D = R + 'frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(D + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(D + 'jsRuntimeSolver.js');
const PG = await import(D + 'pressKillGuards.js');
const { shieldBumpTouches } = await import(D + 'bobBossFight.js');
const row = JSON.parse(readFileSync('/tmp/claude-0/sb/leg860-request.json', 'utf8'));
const { passes = ANYTIME_PASSES, source, ...tape } = restoreRequest(row.request);
tape.budgetWork = Number(process.env.L40C_BUDGET_WORK ?? 10240);
tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: Number(process.env.SPIN_SEAM ?? 5950) } };
const calls = { first: 0, withShield: 0, wouldBump: 0, wouldBumpTicks: 0, stepped: 0, steppedTicks: 0, certs: 0 };
const examples = [];
globalThis.__sbW0 = (phase, o) => {
    if (phase === 'cert') { calls.certs += 1; return; }
    calls.first += 1;
    const { first, states, n } = o;
    if (!o.run.inventory?.hasShield) return;
    calls.withShield += 1;
    if (first.shieldBump) { const k = first.shieldBump.bumps.length; if (k) { calls.stepped += 1; calls.steppedTicks += k; } }
    let would = 0;
    for (const [t, q] of states) {
        const rowsAt = first.rows[t - n];
        if (!rowsAt) continue;
        if (rowsAt.some((r) => shieldBumpTouches(q, false, r, q) || shieldBumpTouches(q, true, r, q))) would += 1;
    }
    if (would) { calls.wouldBump += 1; calls.wouldBumpTicks += would; if (examples.length < 8) examples.push({ t: n, pressAt: o.pressAt, would }); }
};
const kills = [];
PG.PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
PG.PRESS_KILL_DONE_TRACE.sink = null; globalThis.__sbW0 = undefined;
console.log('ARM', JSON.stringify({ key: process.env.SEEDLING_FORECAST_SHIELD_BUMP ?? '0', spin: PG.PRESS_ESCAPE_SHIELD_CLAIM.enabled }));
console.log('ANSWER', answer.ok ? 'SOLVED' : `REFUSED work ${answer.work}`);
console.log('ESCAPE FORECASTS', JSON.stringify(calls), JSON.stringify(examples));
for (const k of kills) {
    const run = replayTape({ staging: tape.staging, perTick: [], levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const b0 = run.shieldBumps.length;
    const fired = (t) => (run.equipsFired ?? []).some((e) => e.t === t);
    for (let i = 0; i < k.perTick.length; i += 1) { for (const e of (k.equips ?? []).filter((q) => q.t === i)) if (!fired(i)) run.equipNow(e.slot); run.advance(k.perTick[i]); }
    console.log('KILL', JSON.stringify({ bodies: k.bodies, t: k.t, shield: run.inventory?.hasShield, spinnerBumps: run.shieldBumps.slice(b0).filter((b) => b.family === 'spinner').map((b) => [b.t, b.id, b.shoved]) }));
}
