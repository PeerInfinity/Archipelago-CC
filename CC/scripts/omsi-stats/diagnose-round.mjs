// diagnose-round.mjs — one-round candidate-eval dump from a resumed
// planning state (the tool behind the Round-13 bank:20 diagnosis).
//
// Usage:
//   node CC/scripts/omsi-stats/diagnose-round.mjs <state.json> [rounds] [--weights '{"bank":20}']
//
// <state.json> is a resume blob from `run-planner.mjs --save-state` (shape
// {save, rng, planning}). Weights must MATCH the donor run's weights or the
// round you inspect is not the round the donor would have played. For each
// round: prints every confirmed candidate's label/score/parts (planRound's
// `evals`), then re-confirms the push candidates serially to show whether
// their eval loop reached the target town, plus the exec ledger (which
// entry starved — the Round-13 smoking gun was `Buy Supplies 0/1`).
// Commits the winner exactly like runStandalone, so [rounds] > 1 walks the
// same deterministic trajectory the runner would.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flagIdx = args.indexOf("--weights");
const weightsOverride = flagIdx >= 0 ? JSON.parse(args.splice(flagIdx, 2)[1]) : {};
const stateFile = args[0];
const rounds = Number(args[1] ?? 1);
if (!stateFile) {
    console.error("usage: node diagnose-round.mjs <state.json> [rounds] [--weights '{...}']");
    process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../../frontend/modules/omsi-loops");

const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(12345, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");

const resume = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const weights = { ...IP.DEFAULT_WEIGHTS, ...weightsOverride };

// Mirror runStandalone's resume boot (§10a.8 normalization), then drive
// planRound ourselves so we can inspect the full evals array.
const sess = ctx.ev("new IdlePlanner.Session()");
const P = IP.newPlanningState({ weights, screenK: 8, screenMode: "predictor", probeEvery: 1, seedFromPredictor: false, multiTown: true });
ctx.sandbox.__resumeBlob = resume;
ctx.ev("IdlePlanner._internals.plRestoreSave(__resumeBlob.save)");
ctx.setRng(resume.rng ?? null);
IP.restorePlanningState(P, resume.planning ?? {});
ctx.ev("if (actions.next.length) restart()");
P.pre = P.pre ?? sess.read();

for (let round = 0; round < rounds; round++) {
    const { best, evals, pre } = await IP.planRound(sess, P);
    console.log(`\n===== round ${round + 1} (loop ${P.loop}) — ${evals.length} confirmed candidates =====`);
    const sorted = [...evals].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    for (const e of sorted) {
        const line = e.score == null
            ? `  ${e.label}: DEGENERATE`
            : `  ${e.label}: score=${e.score} capacity=${e.capacity} probeTicks=${e.probeTicks} parts=${JSON.stringify(e.parts)}`;
        console.log(line);
    }
    // dig into the push candidates: did their eval loop reach the target?
    // re-confirm them serially so we can inspect post-state + exec ledger
    const snap = sess.save();
    const cands = IP.generateCandidates(P.pre ?? pre, P.know, P.thresholds, sess, P.lastCommitted, { multiTown: true, capacityHint: P.prevTimeNeeded });
    sess.restore(snap);
    for (const c of cands.filter(c => c.label.startsWith("push"))) {
        const conf = IP.confirmCandidate(sess, snap, c.q, P.know, true);
        if (conf.degenerate) { console.log(`  [push detail] ${c.label}: DEGENERATE`); continue; }
        const towns = conf.post.townsUnlocked.join(",");
        const exec = (conf.r.lastExec ?? []).map(e => `${e.name}:${e.loops - e.loopsLeft}/${e.loops}`).join(" ");
        const res = conf.r.lastResources ?? {};
        console.log(`  [push detail] ${c.label}: towns=[${towns}] mana=${conf.r.lastTimeNeeded} gold=${res.gold} supplies=${res.supplies}`);
        console.log(`      queue: ${c.q.map(([n, l]) => `${n} x${l}`).join(", ")}`);
        console.log(`      exec:  ${exec}`);
    }
    // commit the winner exactly like runStandalone
    sess.restore(best.postSnap);
    P.prevTimeNeeded = best.capacity;
    P.prevProbeTicks = best.probeTicks;
    P.lastCommitted = best.c.q;
    P.pre = best.post;
    console.log(`  >>> committed: ${best.c.label} (score ${Math.round(best.score)})`);
}
