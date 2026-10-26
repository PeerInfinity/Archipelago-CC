#!/usr/bin/env node
/**
 * Measure-only (slice FF). Re-runs ONE anytime pass of a captured request the way `solveFromTape` does (the same
 * shadow, the same recording Proxy, the same `forkRunFor`, the same `passShouldStop` budget), but keeps the solve's
 * own `perTick` and `liveRun` instead of throwing the ShadowDivergence. Then it answers M1:
 *   - the recorder's per-advance `stateDigest()` (the run the Proxy wraps — the one `expected` is read off);
 *   - every fork's per-advance `stateDigest()` (the rewind's fresh run is a fork);
 *   - an independent `replayTape` of the solve's returned `perTick`, digested per tick;
 * and reports where each pair first parts, which run the segment ended on, and whether the plan replays.
 * Switches by env only. Nothing here writes to a runtime module.
 *
 * Run: node ff-replay.mjs --requests=<jsonl> [--id=371] [--i=0] [--seam=<t>] [--pass=dashless|full]
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const R = 'file:///home/user/Archipelago-CC/';
const rel = (p) => new URL(p, R).href;

const { restoreRequest } = await import(rel('scripts/procgen/seedlingSolveRequestCodec.js'));
const { atSeamTime } = await import(rel('scripts/procgen/replay-seedling-solve-request.mjs'));
const { levelSourceFromAtlas } = await import(rel('frontend/modules/seedlingDemo/atlasSource.js'));
const J = await import(rel('frontend/modules/seedlingDemo/jsRuntimeSolver.js'));
const sb = await import(rel('frontend/modules/seedlingDemo/solverBot.js'));

const id = Number(arg('id', '371'));
const ii = Number(arg('i', '0'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((d) => d.id === id);
let captured = line.requests.find((q) => q.i === ii).request;
if (arg('seam') !== null) captured = atSeamTime(captured, Number(arg('seam')));
const req = restoreRequest(captured);
const { passes = J.ANYTIME_PASSES, source, budgetWork = null, upgradeWindowWork = null, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const p = passes.find((x) => x.pass === arg('pass', 'dashless'));
const { staging, perTick, live, solverGoal, scratchPersistence = false, equips = null, holds = null } = tape;

const ffRows = [];
sb.HAMMER_FIGHT_FALLBACK_TRACE.sink = (row) => ffRows.push({ ...row, ms: undefined });

// --- the shadow + recorder, exactly as solveFromTape builds them, plus a digest per advance
const shadow = J.replayTape({ staging, perTick, levelSource, scratchPersistence, equips, holds });
if (J.runDigest(shadow) !== live.digest) throw new Error('the shadow does not reproduce the live digest');
const recDigests = [shadow.stateDigest({ parts: true })];
const run = new Proxy(shadow, {
    get(target, prop) {
        const v = Reflect.get(target, prop);
        if (prop === 'advance') return (...a) => { const o = v.apply(target, a); recDigests.push(target.stateDigest({ parts: true })); return o; };
        return typeof v === 'function' ? v.bind(target) : v;
    },
});
// --- every fork, digested per advance (the rewind's fresh run is one of these)
const forks = [];
const baseFork = J.forkRunFor({ staging, levelSource, scratchPersistence, equips, prefixLength: perTick.length, holds });
const forkRun = () => {
    const f = baseFork();
    const rec = { digests: [f.stateDigest({ parts: true })], obj: f };
    forks.push(rec);
    return new Proxy(f, {
        get(target, prop) {
            const v = Reflect.get(target, prop);
            if (prop === 'advance') return (...a) => { const o = v.apply(target, a); rec.digests.push(target.stateDigest({ parts: true })); return o; };
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
};
const work = J.createWorkClock();
const shouldStop = J.passShouldStop(p, { budgetWork, windowWork: upgradeWindowWork, planInHand: false, work, limit: {} });
let out = null; let err = null;
try {
    out = sb.solveSegment({ run, goals: J.solverGoalsOf(solverGoal), name: 'js-runtime-solve', boot: staging.boot, prefix: perTick,
        dashMode: p.dashMode, shouldStop, forkRun, ...(shouldStop ? { fineCheckpoints: J.FINE_CHECKPOINTS } : {}) });
} catch (e) { err = e; }
const res = { seam: req.staging.seam.time, pass: p.pass, work: work.units, ff: ffRows, forks: forks.length };
if (err) {
    res.threw = String(err.message).slice(0, 300);
    console.log(`RESULT ${JSON.stringify(res)}`);
    process.exit(0);
}
const solution = out.perTick.slice(perTick.length);
res.solution = solution.length;
res.recorderAdvanced = recDigests.length - 1;
res.wouldDiverge = solution.length !== recDigests.length - 1;
res.endedOnLiveRun = Object.prototype.hasOwnProperty.call(out, 'liveRun');
res.fightFallbacks = out.fightFallbacks ?? null;
// --- an independent replay of the plan the solve returned
const { createRunForStaging } = await import(rel('frontend/modules/seedlingDemo/tapeRunner.js'));
const rp = createRunForStaging(staging, levelSource, { scratchPersistence });
const repDigests = perTick.length === 0 ? [rp.stateDigest({ parts: true })] : [];
out.perTick.forEach((h, i) => {
    if (holds?.get(i)) rp.stepHeldFrames(holds.get(i));
    const slot = equips?.get(i);
    if (slot !== undefined) rp.equipNow(slot);
    rp.advance(h);
    if (i + 1 >= perTick.length) repDigests.push(rp.stateDigest({ parts: true }));
});
// repDigests[k] = state after prefix + k ticks (k=0 is the solve's start)
const partsDiff = (x, y) => Object.keys(x.parts).filter((k) => x.parts[k] !== y.parts[k]);
const firstPart = (a, b) => { const n = Math.min(a.length, b.length); for (let k = 0; k < n; k += 1) if (a[k].digest !== b[k].digest) return k; return n === a.length && n === b.length ? -1 : n; };
res.recorderVsReplay = { firstPartAtSegTick: firstPart(recDigests, repDigests), recLen: recDigests.length, repLen: repDigests.length };
// the fork the segment ended on (liveRun's) — find it
const endFork = res.endedOnLiveRun ? forks.find((f) => f.obj === out.liveRun || f.obj === Object.getPrototypeOf(out.liveRun)) ?? null : null;
if (res.endedOnLiveRun) {
    const lr = out.liveRun;
    res.liveRunDigest = sha(lr.stateDigest());
    res.liveRunRunDigestEqReplay = J.runDigest(lr) === J.runDigest(rp);
    res.liveRunStateDigestParts = partsDiff(lr.stateDigest({ parts: true }), rp.stateDigest({ parts: true }));
    res.liveRunTicks = lr.ticksCompleted;
    // forks digest from boot (index 0 = boot); align with replay from boot: build a full-boot replay digest list
    const rp2 = createRunForStaging(staging, levelSource, { scratchPersistence });
    const full = [rp2.stateDigest({ parts: true })];
    out.perTick.forEach((h, i) => { if (holds?.get(i)) rp2.stepHeldFrames(holds.get(i)); const s = equips?.get(i); if (s !== undefined) rp2.equipNow(s); rp2.advance(h); full.push(rp2.stateDigest({ parts: true })); });
    const ef = endFork ?? forks.at(-1);
    res.endForkFound = endFork !== null;
    const fk = firstPart(ef.digests, full);
    res.endForkVsReplay = { firstPartAtTick: fk, forkLen: ef.digests.length, repLen: full.length, parts: fk >= 0 && fk < full.length ? partsDiff(ef.digests[fk], full[fk]) : null };
}
res.recPartParts = (() => { const k = res.recorderVsReplay.firstPartAtSegTick; return k >= 0 && k < Math.min(recDigests.length, repDigests.length) ? { parts: partsDiff(recDigests[k], repDigests[k]) } : null; })();
res.apItemsTaken = out.apItemsTaken ?? out.takes ?? null;
res.recorderEndEqReplayEnd = J.runDigest(shadow) === J.runDigest(rp);
res.recorderEnd = { level: shadow.level, x: shadow.state.x, y: shadow.state.y, t: shadow.ticksCompleted };
res.replayEnd = { level: rp.level, x: rp.state.x, y: rp.state.y, t: rp.ticksCompleted };
res.planSha = sha(JSON.stringify(solution.map((k) => [...k])));
console.log(`RESULT ${JSON.stringify(res)}`);
