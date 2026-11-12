// A WITNESS for the arm: the abandoned first branch of the leg (`kill spinner@880,848` with OPP on, refused HAMMER_SAFETY
// at t724), its keys and equips recorded on the observed run, become a tape; the same goal is then solved FROM that
// state (bob@736,752 dying since t700) — OFF and ON. Writes the tape to stdout's last line as JSON when --emit is given.
// Usage: node witness724.mjs [--emit=<path>]
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SB = await import(M + 'solverBot.js');
const { withChaserStagedHunt, withClearTagChain, withStanceBurn, solveSegment, withDyingBodyWait, DYING_BODY_WAIT_COUNTS } = SB;
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, forkRunFor, solverGoalsOf, settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz')).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const withSet = (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, fn))))));
const emit = process.argv.find((a) => a.startsWith('--emit='))?.slice(7) ?? null;
withL40Flip(false, () => withSet(() => {
    // 1. the first branch, recorded on the observed run
    const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true,
        equips: tape.equips ?? null, holds: tape.holds ?? null };
    const run = replayTape({ ...args, perTick: tape.perTick });
    const keys = []; const equips = new Map();
    const adv = run.advance.bind(run); const eq = run.equipNow.bind(run);
    run.advance = (k) => { keys.push(new Set(k)); return adv(k); };
    run.equipNow = (slot) => { equips.set(keys.length, slot); return eq(slot); };
    try {
        solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'd', boot: tape.staging.boot, prefix: tape.perTick,
            dashMode: 'none', forkRun: forkRunFor({ ...args, prefixLength: tape.perTick.length }), shouldStop: () => false,
            fineCheckpoints: true });
    } catch { /* the segment refuses; the observed run is the branch the fallback left */ }
    const bob = (r) => (r.entities('chasers') ?? []).find((c) => c.id === 'bob@736,752');
    console.log(`branch recorded: ${keys.length} keys, ${equips.size} equip(s), clock ${run.ticksCompleted}, `
        + `player (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}), bob@736,752 ${JSON.stringify((({ hits, dying, destroy }) => ({ hits, dying, destroy }))(bob(run)))}`);
    // 2. the tape: that branch as the play's prefix; the same goal solved from there, OFF and ON
    const branch = { ...tape, perTick: keys, equips };
    const check = replayTape({ ...args, perTick: keys, equips });
    console.log(`tape replays: clock ${check.ticksCompleted} player (${check.state.x.toFixed(1)},${check.state.y.toFixed(1)}) `
        + `bob dying ${bob(check)?.dying} hits ${check.playerHits.length}`);
    if (emit) writeFileSync(emit, gzipSync(JSON.stringify({ keys: keys.map((k) => [...k]), equips: [...equips] })));
    for (const on of [false, true]) {
        DYING_BODY_WAIT_COUNTS.asked = 0; DYING_BODY_WAIT_COUNTS.kept.length = 0; DYING_BODY_WAIT_COUNTS.refused.length = 0;
        let work = 0;
        const live = replayTape({ ...args, perTick: keys, equips });
        let res = null; let err = null;
        try {
            res = withDyingBodyWait(on, () => solveSegment({ run: live, goals: solverGoalsOf(tape.solverGoal), name: 'w724',
                boot: tape.staging.boot, prefix: keys, dashMode: 'none',
                forkRun: forkRunFor({ ...args, equips, prefixLength: keys.length }),
                shouldStop: () => { work += 1; return false; }, fineCheckpoints: true }));
        } catch (e) { err = e; }
        if (err) {
            console.log(`${on ? 'ON ' : 'OFF'} REFUSED work ${work}: ${String(err.message).split('\n')[0].slice(0, 500)}`);
        } else {
            const seg = res.perTick ?? res.solution ?? res.keys;
            const segEq = res.equipsAt ?? new Map((res.equips ?? []).map((q) => [q.t - keys.length, q.slot]));
            const r = replayTape({ ...args, perTick: keys, equips });
            const h0 = r.playerHits.length;
            for (let k = 0; k < seg.length; k += 1) {
                const slot = segEq?.get?.(k); if (slot !== undefined) r.equipNow(slot);
                r.advance(seg[k]);
            }
            console.log(`${on ? 'ON ' : 'OFF'} SOLVED work ${work}: ${JSON.stringify({ resultKeys: Object.keys(res).slice(0, 30), ticks: seg.length,
                sha: createHash('sha256').update(JSON.stringify(seg.map((s) => [...s]))).digest('hex').slice(0, 12),
                hits: r.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]), deaths: r.playerDeaths.length,
                burned: [...(r.entities('burnedTrees') ?? [])], clears: (r.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() })}`);
            console.log('    verbs:', (res.trace?.rows ?? res.rows ?? []).map((x) => `${x.tick}:${x.strategy?.verb}${x.strategy?.arm ? '/' + x.strategy.arm : ''}`).join(' ').slice(0, 600));
        }
        console.log(`    arm: ${JSON.stringify(DYING_BODY_WAIT_COUNTS)}`.slice(0, 900));
    }
}));
