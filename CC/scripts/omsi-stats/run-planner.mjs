// omsi-stats: drive the FORK's own Advanced Automation planner headlessly
// from a fresh save and record loops/ticks/milestones (jta-stats
// conventions: committed SUMMARY.md, raw data local-only in results/).
//
// The primary acceptance metric (substrate plan §3.3): loops to Forest Path
// (town 1) must stay <= 500 — the queue-planner v0 experiment's result
// (500 loops / 5,432,753 ticks / final-state sha256-16 54506b48ec1758af,
// seed 12345, default weights). With --seed 12345 and seeding OFF, this
// harness additionally checks BYTE-EXACT reproduction of that run: the fork
// port must not have changed planner behavior.
//
// The sim boot reuses the fork's OWN test/harness.mjs from the extraction,
// so the stats run exercises exactly what the fork ships.
//
// Usage:
//   node CC/scripts/omsi-stats/run-planner.mjs                # committed HEAD of the submodule
//   node CC/scripts/omsi-stats/run-planner.mjs --worktree     # submodule working tree (dev)
//   node CC/scripts/omsi-stats/run-planner.mjs --seed N --max-loops N
//   node CC/scripts/omsi-stats/run-planner.mjs --seed-predictor   # predictor cross-check on
//   node CC/scripts/omsi-stats/run-planner.mjs --weights '{"frontier":1000}'
//   node CC/scripts/omsi-stats/run-planner.mjs --screen-k 4 --probe-every 5
//   node CC/scripts/omsi-stats/run-planner.mjs --target-town 2   # stretch: past town 1
//   node CC/scripts/omsi-stats/run-planner.mjs --multi-town off  # v0 town-0-only planner (A/B)
//   node CC/scripts/omsi-stats/run-planner.mjs --gain-mult 100   # boosted testing runs (exp only)
//   node CC/scripts/omsi-stats/run-planner.mjs --save-state results/state.json   # dump end-of-run resume blob
//   node CC/scripts/omsi-stats/run-planner.mjs --from-state results/state.json --max-loops 550
//       # snapshot-start: continue a saved run (max-loops is TOTAL loops incl. the donor's).
//       # Iteration scaffolding only — the acceptance gate stays full-from-fresh.
//       # The blob carries save+rng+planning state (knowledge table incl.), so scorer/weight
//       # changes can be A/B'd from the same wall state without replaying 500 loops.
//   node CC/scripts/omsi-stats/run-planner.mjs --metric ticks
//       # success metric for run comparison: loops | ticks | wall | weighted (default loops —
//       # user ruling 2026-07-11). Reported and stored as metricValue; gates are unchanged.
//   node CC/scripts/omsi-stats/run-planner.mjs --metric weighted --metric-weights '{"loops":1,"ticks":0.0001,"wall":0.5}'
//   node CC/scripts/omsi-stats/run-planner.mjs --wander-until 50 [--wander-cap 20000]
//       # human-strategy arm (success-metric experiment, plan §11.5 open item 1):
//       # run single-Wander-only queues ([Wander x99], no planning) until town 0's
//       # Explored level reaches N%, then hand the planner a resume blob at the
//       # switch point (same snapshot-start machinery as --from-state; zero fork
//       # changes). Loops/ticks are reported split by phase AND as totals; the
//       # metric uses totals. Mutually exclusive with --from-state. --max-loops
//       # stays TOTAL (wander phase included).
//   node CC/scripts/omsi-stats/run-planner.mjs --out results/foo.json

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(repoRoot, "frontend/modules/omsi-loops");
const forkDir = path.join(here, "fork");
const resultsDir = path.join(here, "results");

const V0_REFERENCE = { seed: 12345, loops: 500, ticks: 5_432_753, hash: "54506b48ec1758af" };

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();

async function main() {
    const args = process.argv.slice(2);
    const has = (f) => args.includes(f);
    const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

    const seed = Number(val("--seed", 12345));
    const maxLoops = Number(val("--max-loops", 1200));
    const seedFromPredictor = has("--seed-predictor");
    const weightsOverride = JSON.parse(val("--weights", "{}"));
    const useWorktree = has("--worktree");
    const screenK = Number(val("--screen-k", 8));
    const probeEvery = Number(val("--probe-every", 1));
    const targetTown = Number(val("--target-town", 1));
    const multiTown = val("--multi-town", "on") !== "off";
    const gainMult = Number(val("--gain-mult", 1));
    const metric = val("--metric", "loops");
    const metricWeights = JSON.parse(val("--metric-weights", '{"loops":1,"ticks":0,"wall":0}'));
    const saveStatePath = val("--save-state", null);
    const fromStatePath = val("--from-state", null);
    const wanderUntil = Number(val("--wander-until", 0));
    const wanderCap = Number(val("--wander-cap", 20000));
    if (wanderUntil > 0 && fromStatePath) throw new Error("--wander-until and --from-state are mutually exclusive");
    const knobsAtDefaults = screenK === 8 && probeEvery === 1 && targetTown === 1 && multiTown
        && gainMult === 1 && !fromStatePath && !wanderUntil;

    let srcDir, forkCommit;
    if (useWorktree) {
        srcDir = submoduleDir;
        forkCommit = run("git", ["-C", submoduleDir, "rev-parse", "HEAD"]) + "+worktree";
    } else {
        forkCommit = run("git", ["-C", submoduleDir, "rev-parse", "HEAD"]);
        fs.rmSync(forkDir, { recursive: true, force: true });
        fs.mkdirSync(forkDir, { recursive: true });
        run("bash", ["-c", `git -C ${JSON.stringify(submoduleDir)} archive --format=tar HEAD | tar -x -C ${JSON.stringify(forkDir)}`]);
        srcDir = forkDir;
    }
    console.log(`fork: ${forkCommit}  seed: ${seed}  seedFromPredictor: ${seedFromPredictor}`);

    const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
    const ctx = makeContext(seed, ["planner.js"]);
    ctx.sandbox.__rngGet = ctx.getRng;
    ctx.sandbox.__rngSet = ctx.setRng;
    ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
    if (gainMult !== 1) ctx.ev(`options.expGainMultiplier = ${gainMult}`);
    const IP = ctx.ev("IdlePlanner");

    const weights = { ...IP.DEFAULT_WEIGHTS, ...weightsOverride };
    const resumePath = fromStatePath && !path.isAbsolute(fromStatePath) ? path.join(here, fromStatePath) : fromStatePath;
    let resume = resumePath ? JSON.parse(fs.readFileSync(resumePath, "utf8")) : null;
    if (resume) console.log(`resuming from ${fromStatePath} (donor loop ${resume.planning?.loop}, gain-mult must match the donor run)`);
    // Sidecar progress log: one line per loop, flushed as it happens, next to
    // the results file. Launch pipes (`| tail`) swallow the verbose progress,
    // so mid-run visibility must not depend on how the command was invoked.
    const outArg = val("--out", null);
    const progressPath = path.join(resultsDir,
        (outArg ? path.basename(outArg).replace(/\.json$/, "") : `planner-progress-${process.pid}`) + ".log");
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(progressPath, "");
    const onLoop = (t) => fs.appendFileSync(progressPath,
        `L${t.loop} ${t.label} ticks=${t.ticks} cum=${t.cumTicks} mana=${t.mana} score=${t.score}\n`);
    console.log(`progress log: ${progressPath}`);

    // Wander-first phase (--wander-until): the human opening — commit
    // [Wander x1] every loop with NO planning until Explored reaches the
    // threshold, then hand the planner a resume blob at the switch point.
    // x1, not x99 (user ruling): the loop ends the moment the single Wander
    // completes, so no ticks are burned on a partial Wander that would run
    // out of mana before finishing.
    // Loops run live (no rollback); the blob's planning state is FRESH
    // except loop counter, so the planner starts probing/measuring from the
    // wander end state exactly as it would at loop 0. runStandalone's resume
    // path restart()s once against the restored queue (the §10a.8
    // normalization), matching continuous-run semantics.
    let wanderLoops = 0, wanderTicks = 0, wanderExplored = 0, wanderWallSeconds = 0;
    if (wanderUntil > 0) {
        const tw = Date.now();
        const sess = new IP.Session();
        const explored = () => sess.read().towns[0].progress.Wander.level;
        wanderExplored = explored();
        while (wanderExplored < wanderUntil && wanderLoops < wanderCap) {
            sess.setQueue([["Wander", 1]]);
            sess.restart();
            const lr = sess.runLoop();
            if (lr.degenerate) throw new Error(`wander loop ${wanderLoops} degenerate (0 mana spent)`);
            wanderTicks += lr.ticks;
            wanderLoops++;
            wanderExplored = explored();
            if (wanderLoops % 100 === 0)
                fs.appendFileSync(progressPath, `W${wanderLoops} explored=${wanderExplored} cum=${wanderTicks}\n`);
        }
        wanderWallSeconds = (Date.now() - tw) / 1000;
        const capped = wanderExplored < wanderUntil;
        fs.appendFileSync(progressPath,
            `WANDER ${capped ? "CAPPED" : "DONE"} loops=${wanderLoops} explored=${wanderExplored} cum=${wanderTicks}\n`);
        console.log(`wander phase: ${wanderLoops} loops, ${wanderTicks} ticks -> Explored ${wanderExplored}%`
            + ` (${wanderWallSeconds.toFixed(1)}s)${capped ? " — CAP HIT before threshold" : ""}`);
        if (capped) throw new Error(`--wander-cap ${wanderCap} hit at Explored ${wanderExplored}% < ${wanderUntil}%`);
        const P0 = IP.newPlanningState({});
        P0.loop = wanderLoops;
        resume = { save: IP._internals.plSaveClone(), rng: ctx.getRng(), planning: IP.serializePlanningState(P0) };
    }

    const t0 = Date.now();
    const r = await IP.runStandalone({ maxLoops, weights, seedFromPredictor, verbose: true, screenK, probeEvery, targetTown, multiTown, resume, onLoop });
    const hash = crypto.createHash("sha256").update(r.finalSnapshot).digest("hex").slice(0, 16);
    if (saveStatePath) {
        const p = path.isAbsolute(saveStatePath) ? saveStatePath : path.join(here, saveStatePath);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(r.resume));
        console.log(`resume state written to ${p}`);
    }

    const wallSeconds = (Date.now() - t0) / 1000;
    // Totals include the wander phase (zero when --wander-until is off).
    // NOTE: r.loopsRun counts PLANNER loops only, but milestone .loop values
    // are total-indexed (P.loop resumes at wanderLoops); milestone .cumTicks
    // are planner-phase only — add wanderTicks for totals.
    const totalLoops = wanderLoops + r.loopsRun;
    const totalTicks = wanderTicks + r.cumTicks;
    const totalWall = wanderWallSeconds + wallSeconds;
    const metricValue =
        metric === "loops" ? totalLoops :
        metric === "ticks" ? totalTicks :
        metric === "wall" ? totalWall :
        metricWeights.loops * totalLoops + (metricWeights.ticks ?? 0) * totalTicks + (metricWeights.wall ?? 0) * totalWall;
    const out = {
        date: new Date().toISOString(), forkCommit, seed, seedFromPredictor,
        weightsOverride, screenK, probeEvery, targetTown, multiTown, gainMult,
        metric, metricValue,
        wanderUntil, wanderLoops, wanderTicks, wanderExplored,
        totalLoops, totalTicks,
        loopsRun: r.loopsRun, cumTicks: r.cumTicks,
        finished: r.finished, finalHash: hash,
        divergenceCount: r.divergences.length, divergences: r.divergences,
        rngConsumed: ctx.rngCount(),
        milestones: r.milestones, trace: r.trace,
        wallSeconds, wanderWallSeconds,
    };
    fs.mkdirSync(resultsDir, { recursive: true });
    const slug = val("--out", `planner-seed${seed}${seedFromPredictor ? "-seeded" : ""}${gainMult !== 1 ? `-gm${gainMult}` : ""}${Object.keys(weightsOverride).length ? "-" + Object.entries(weightsOverride).map(([k, v]) => k + v).join("_") : ""}.json`);
    const outPath = path.isAbsolute(slug) ? slug : path.join(here, slug.startsWith("results/") ? slug : `results/${slug}`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

    const phaseNote = wanderUntil > 0
        ? `  [wander ${wanderLoops}L/${wanderTicks}t + planner ${r.loopsRun}L/${r.cumTicks}t]` : "";
    console.log(`\nloops: ${totalLoops}  ticks: ${totalTicks}  town1: ${r.finished}  hash: ${hash}  rng: ${ctx.rngCount()}  (${totalWall.toFixed(0)}s)${phaseNote}`);
    console.log(`metric (${metric}): ${Math.round(metricValue * 100) / 100}`);
    console.log(`divergences (predictor-vs-engine): ${r.divergences.length}`);
    console.log(`milestones (loop, total-indexed${wanderUntil > 0 ? "; ticks incl. wander phase" : ""}):`);
    const highlights = Object.entries(r.milestones).filter(([k]) =>
        k.startsWith("town") || ["Pick Locks:unlocked", "Buy Glasses:unlocked", "Short Quests:unlocked",
            "Investigate:unlocked", "Lessons:unlocked", "Start Journey:unlocked"].includes(k));
    for (const [k, v] of highlights) console.log(`  ${k.padEnd(30)} L${v.loop}  (${v.cumTicks + wanderTicks} ticks)`);
    console.log(`results written to ${outPath}`);

    // Acceptance gates (the <=500 criterion is the v0 acceptance test —
    // not applicable to wander-first experiment arms, which only gate on
    // reaching the target town)
    const gate = r.finished && (targetTown !== 1 || wanderUntil > 0 || r.loopsRun <= 500);
    console.log(`\nACCEPTANCE (${targetTown === 1 && !wanderUntil ? "<=500 loops to town 1" : `reached town ${targetTown}`}): ${gate ? "PASS" : "FAIL"} (${totalLoops} loops)`);
    if (seed === V0_REFERENCE.seed && !seedFromPredictor && !Object.keys(weightsOverride).length && knobsAtDefaults) {
        const exact = r.loopsRun === V0_REFERENCE.loops && r.cumTicks === V0_REFERENCE.ticks && hash === V0_REFERENCE.hash;
        console.log(`V0 EXACT REPRODUCTION (500 / 5,432,753 / ${V0_REFERENCE.hash}): ${exact ? "PASS" : "MISMATCH"}`);
        if (!exact) console.log(`  got ${r.loopsRun} / ${r.cumTicks} / ${hash} — investigate the port before trusting other numbers`);
        process.exit(gate && exact ? 0 : 1);
    }
    process.exit(gate ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
