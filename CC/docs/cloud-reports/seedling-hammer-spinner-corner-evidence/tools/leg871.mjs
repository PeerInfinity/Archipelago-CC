// Leg (key) `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`
// (sweep id 871 before R-A5, 878 at fe98f37f22) — the hammerClearTagChain.train row's harness, uncapped dashless pass.
// Usage: node leg871.mjs [--trace]   (env SEEDLING_DYING_BODY_WAIT=1 turns the slice's arm on)
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { withChaserStagedHunt, withClearTagChain, withStanceBurn } from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
import * as SB from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
import { withOpportunisticStrike } from '../../../../../frontend/modules/seedlingDemo/pressKillCost.js';
import { withPressEscapeExact } from '../../../../../frontend/modules/seedlingDemo/pressEscapeExact.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { replayTape, settleSolve, solveFromTape } from '../../../../../frontend/modules/seedlingDemo/jsRuntimeSolver.js';
import { withL40Flip } from '../../../../../frontend/modules/seedlingDemo/l40FlipSet.js';

const FIXDIR = new URL('../../../../../frontend/modules/seedlingDemo/fixtures/hammer-cleartag-chain/', import.meta.url);
const name = process.argv.find((a) => a.endsWith('.json.gz')) ?? 'leg871-l39-l40-request.json.gz';
const FIX = JSON.parse(gunzipSync(readFileSync(new URL(name, FIXDIR))).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const wallsArg = process.argv.find((a) => a.startsWith('--walls='));
const fid = { forecastShieldBump: true, ...(wallsArg ? { chaserSpinnerWalls: wallsArg === '--walls=1' } : {}) };
const withSet = (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true, () => withContactFidelity(fid, fn))))));

const freshRun = () => replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });

withL40Flip(false, () => withSet(() => {
    let work = 0;
    if (SB.DYING_BODY_WAIT_COUNTS) { SB.DYING_BODY_WAIT_COUNTS.asked = 0; SB.DYING_BODY_WAIT_COUNTS.kept.length = 0; SB.DYING_BODY_WAIT_COUNTS.refused.length = 0; }
    let caught = null;
    const answer = settleSolve(() => { try { return solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return false; } }); } catch (e) { caught = e; throw e; } });
    console.log('switch DYING_BODY_WAIT', SB.DYING_BODY_WAIT?.enabled ?? '(absent)');
    if (SB.DYING_BODY_WAIT_COUNTS) console.log('arm counts', JSON.stringify(SB.DYING_BODY_WAIT_COUNTS));
    if (!answer.ok) {
        console.log('REFUSED work', work);
        console.log(answer.message);
        const keys = caught?.perTick ?? null;
        console.log('refusal keys (segment)', keys?.length ?? '(none)', 'prefix', tape.perTick.length);
        if (keys) {
            // the refused segment's keys on a fresh run, then STILL ticks: the model's own dying -> removed
            const run = freshRun();
            const eq = new Map((caught.equips ?? []).map((q) => [q.t, q.slot]));
            const seen = new Map();
            const note = (k) => { for (const c of run.entities('chasers') ?? []) {
                const e = seen.get(c.id) ?? { id: c.id }; if (c.dying && e.dyingFrom === undefined) e.dyingFrom = k;
                e.lastSeen = k; e.hits = c.hits; seen.set(c.id, e); } };
            const t0 = run.ticksCompleted;
            for (let k = 0; k < keys.length; k += 1) { run.advance(keys[k]); note(k + 1); }
            const at = keys.length;
            const pl = run.state;
            console.log(`at the refusal: segment tick ${at} (model clock ${run.ticksCompleted}, start ${t0}), player (${pl.x.toFixed(1)},${pl.y.toFixed(1)}), hits so far ${run.playerHits.length}`);
            console.log('  player hits on the replay:', JSON.stringify(run.playerHits.map((h) => [h.t, h.source, h.id])), 'equips on the refusal:', JSON.stringify(caught.equips ?? null));
            for (const c of run.entities('chasers') ?? []) if (['bob@736,752', 'bob@736,800', 'bobsoldier@880,832'].includes(c.id)) console.log('  chaser', JSON.stringify({ id: c.id, x: +c.x.toFixed(1), y: +c.y.toFixed(1), hits: c.hits, hitsTimer: c.hitsTimer, dying: c.dying, d: +Math.hypot(c.x - pl.x, c.y - pl.y).toFixed(1) }));
            const h0 = run.playerHits.length;
            for (let k = 1; k <= 60; k += 1) { run.advance(new Set()); note(at + k); }
            console.log('after 60 still ticks: hits', run.playerHits.length - h0, run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]));
            console.log('chaser ticks (segment):', JSON.stringify([...seen.values()]));
        }
        return;
    }
    const { plan } = answer;
    const run = freshRun();
    const hits0 = run.playerHits.length;
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    let bad = 0;
    if (JSON.stringify(row()) !== JSON.stringify(plan.expected[0])) bad += 1;
    const chaserLog = new Map();
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        if (plan.expected[k + 1] && JSON.stringify(row()) !== JSON.stringify(plan.expected[k + 1])) bad += 1;
        for (const c of run.entities('chasers') ?? []) {
            const e = chaserLog.get(c.id) ?? { first: k + 1 };
            if (c.dying && e.dying === undefined) e.dying = k + 1;
            e.last = k + 1;
            chaserLog.set(c.id, e);
        }
    }
    console.log(JSON.stringify({ ok: true, work, ticks: plan.solution.length,
        sha: createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        rowMismatches: bad, hits: run.playerHits.slice(hits0).map((h) => [h.t, h.source, h.id]),
        deaths: run.playerDeaths.length, burned: [...(run.entities('burnedTrees') ?? [])],
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() }));
    console.log('chasers (first seen / first dying / last seen, plan ticks):', JSON.stringify([...chaserLog]));
    const strat = (plan.trace?.rows ?? plan.rows ?? []).map((r) => r.strategy?.verb).filter(Boolean);
    if (strat.length) console.log('verbs', strat.join(','));
}));
