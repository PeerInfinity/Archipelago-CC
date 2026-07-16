// DNF-aware weight/knob sweep driver over run-planner.mjs (calibration
// tooling, handoff item 6). The Round-9 lesson is the contract here: DNFs are
// FIRST-CLASS results — bank:20 DNF'd at the cap between healthy neighbors
// (15→531, 30→500) — so every arm that fails to reach the target town is
// flagged AND auto-classified fixation-vs-economy from its own trace, never
// silently dropped and never averaged into a mean.
//
// Usage:
//   node CC/scripts/omsi-stats/sweep-planner.mjs --name bank-axis \
//       --arms '[{"label":"bank5","weights":{"bank":5}},{"label":"bank10","weights":{"bank":10}}]'
//   node CC/scripts/omsi-stats/sweep-planner.mjs --name big --arms-file arms.json \
//       --base "--worktree --pool 8 --screen-mode engine --max-loops 1200"
//
// Arm spec: { label, weights?: {..merged over DEFAULT_WEIGHTS by run-planner},
//             flags?: "extra CLI flags for this arm" }.
// Arms run SEQUENTIALLY (each already parallelizes via --pool). Defaults:
//   --base "--worktree --pool 8 --screen-mode engine"   (the Round-11 ~5x
//   iteration regime; final-check winners under predictor before concluding)
//   --max-loops 1200 (the Round-9 DNF cap) unless the base/arm flags set one.
//
// Outputs (results/sweep-<name>/):
//   <label>.json            — each arm's full run-planner result
//   progress.log            — sweep-level sidecar (one line per arm, flushed
//                             live; child runs write their own per-loop logs)
//   SUMMARY.json + printed table — every arm: loops/ticks/wall (track BOTH
//   metrics, standing ruling), DNF flag, fixation-vs-economy classification,
//   §11.9 Part-B streak/drought counters. Finishers rank by loops (primary);
//   DNFs pin to the bottom, labeled.
//
// Classification (from the arm's OWN trace — trace entries keep the committed
// queue string and milestones carry loop indices even without --dump-detail):
// the discriminator is the counter still OPEN AT THE CAP, not the run max —
// the §11.9 "healthy ≤16 streak" separation was measured on PRE-Part-A traces;
// post-A1 healthy runs legitimately carry maxStreak ~104 through the early
// repeat phase and then CLOSE it (endStreak ≤50, endDrought ≤149 on every
// stored healthy/economy trace), while every known hole is an absorbing state
// with the streak open at the cap (endStreak 311–635 / endDrought 260–738:
// sweep-m-bank20, t1/t4-bank20, a2only-bank20, k4-fixation, phase0-k4-*).
//   FIXATION — identical-committed-queue streak OPEN at the cap ≥ 256 OR
//              loops since the last milestone ≥ 256 (0 RNG makes these exact
//              facts, not samples).
//   ECONOMY  — still varying queues / hitting milestones when the cap arrived
//              (undersized cap or genuinely slow config).
// For a deeper look at a flagged arm, re-run it byte-identically (0 RNG) with
// --dump-detail via:  node run-planner.mjs <base+arm flags> --dump-detail

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const val = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : dflt;
};

const name = val("--name", null);
if (!name) { console.error("--name <sweep-name> is required"); process.exit(1); }
const armsJson = val("--arms", null);
const armsFile = val("--arms-file", null);
if (!armsJson && !armsFile) { console.error("--arms '<json>' or --arms-file <path> is required"); process.exit(1); }
const arms = JSON.parse(armsJson ?? fs.readFileSync(armsFile, "utf8"));
if (!Array.isArray(arms) || !arms.length) { console.error("arms must be a non-empty array"); process.exit(1); }
const base = val("--base", "--worktree --pool 8 --screen-mode engine");

// End-anchored fixation thresholds (see header — grounded on all stored
// hole/healthy traces, post-Part-A capacity model)
const STREAK_K = 256, DROUGHT_D = 256;

const sweepDir = path.join(here, "results", `sweep-${name}`);
fs.mkdirSync(sweepDir, { recursive: true });
const progressPath = path.join(sweepDir, "progress.log");
const logLine = (s) => {
    fs.appendFileSync(progressPath, `${new Date().toISOString()} ${s}\n`);
    console.log(s);
};
fs.writeFileSync(progressPath, "");

// §11.9 Part-B counters over a result's trace + milestones (end-anchored —
// see header). max* recorded as data; end* drive the classification.
function classify(out) {
    const trace = out.trace ?? [];
    let maxStreak = 0, streak = 0, prevQ = null;
    for (const t of trace) {
        streak = (prevQ != null && t.queue === prevQ) ? streak + 1 : 0;
        prevQ = t.queue;
        if (streak > maxStreak) maxStreak = streak;
    }
    const endStreak = streak;
    const msLoops = Object.values(out.milestones ?? {}).map(m => m.loop).sort((a, b) => a - b);
    let maxDrought = 0, last = 0;
    for (const l of msLoops) { if (l - last > maxDrought) maxDrought = l - last; last = l; }
    const end = out.totalLoops ?? trace.length;
    const endDrought = Math.max(0, end - last);   // resume runs can index past the partial trace
    if (endDrought > maxDrought) maxDrought = endDrought;
    const dnf = !out.finished;
    const fixated = endStreak >= STREAK_K || endDrought >= DROUGHT_D;
    return { maxStreak, endStreak, maxDrought, endDrought, dnf,
             classification: dnf ? (fixated ? "FIXATION" : "ECONOMY") : (fixated ? "finished-but-fixated" : "healthy") };
}

const rows = [];
logLine(`sweep '${name}': ${arms.length} arms, base: ${base}`);
for (const [i, arm] of arms.entries()) {
    const label = arm.label ?? `arm${i}`;
    const outFile = path.join(sweepDir, `${label}.json`);
    const argv = ["run-planner.mjs", ...base.split(/\s+/).filter(Boolean)];
    if (!argv.includes("--max-loops") && !(arm.flags ?? "").includes("--max-loops")) argv.push("--max-loops", "1200");
    if (arm.weights && Object.keys(arm.weights).length) argv.push("--weights", JSON.stringify(arm.weights));
    if (arm.flags) argv.push(...arm.flags.split(/\s+/).filter(Boolean));
    argv.push("--out", outFile);
    logLine(`[${i + 1}/${arms.length}] ${label}: node ${argv.join(" ")}`);
    fs.rmSync(outFile, { force: true });   // stale results must not mask a crash
    const t0 = Date.now();
    // NOTE: run-planner exits 1 whenever the acceptance bar isn't met — normal
    // for sweep arms — so the crash signal is a MISSING result JSON, not the
    // exit code.
    const res = spawnSync(process.execPath, argv, { cwd: here, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    const wall = (Date.now() - t0) / 1000;
    if (!fs.existsSync(outFile)) {
        // a crashed arm is ALSO a first-class result — record it, keep going
        logLine(`[${i + 1}/${arms.length}] ${label}: CRASH (exit ${res.status}) after ${wall.toFixed(0)}s — ${
            (res.stderr ?? "").split("\n").filter(Boolean).slice(-3).join(" | ")}`);
        rows.push({ label, weights: arm.weights ?? {}, flags: arm.flags ?? "", crash: true, wall });
        continue;
    }
    const out = JSON.parse(fs.readFileSync(outFile, "utf8"));
    const cls = classify(out);
    const row = {
        label, weights: arm.weights ?? {}, flags: arm.flags ?? "",
        loops: out.totalLoops, ticks: out.totalTicks, wall: out.wallSeconds,
        finished: out.finished, hash: out.finalHash, rng: out.rngConsumed,
        ...cls,
    };
    rows.push(row);
    logLine(`[${i + 1}/${arms.length}] ${label}: ${cls.dnf ? `DNF@${out.totalLoops} [${cls.classification}]`
        : `${out.totalLoops} loops`} ticks=${out.totalTicks} wall=${Math.round(out.wallSeconds)}s `
        + `endStreak=${cls.endStreak} endDrought=${cls.endDrought}`);
}

// ranking: finishers by loops (primary metric, standing ruling), ticks shown
// beside; DNFs/crashes pinned last and NEVER enter any aggregate
const finishers = rows.filter(r => !r.crash && !r.dnf).sort((a, b) => a.loops - b.loops);
const dnfs = rows.filter(r => !r.crash && r.dnf);
const crashes = rows.filter(r => r.crash);

const pad = (s, n) => String(s).padStart(n);
console.log(`\n== sweep '${name}' ==`);
console.log(`${"label".padEnd(24)}${pad("loops", 9)}${pad("ticks", 12)}${pad("wall", 7)}${pad("endStrk", 9)}${pad("endDrt", 8)}  class`);
for (const r of [...finishers, ...dnfs]) {
    console.log(`${r.label.padEnd(24)}${pad(r.dnf ? `DNF@${r.loops}` : r.loops, 9)}${pad(r.ticks, 12)}`
        + `${pad(Math.round(r.wall) + "s", 7)}${pad(r.endStreak, 9)}${pad(r.endDrought, 8)}  ${r.classification}`);
}
for (const r of crashes) console.log(`${r.label.padEnd(24)}  CRASH`);
if (dnfs.length) console.log(`\n⚠ ${dnfs.length} DNF arm(s) — first-class results, excluded from ranking, diagnose before trusting neighbors.`);

const summary = { date: new Date().toISOString(), name, base, thresholds: { STREAK_K, DROUGHT_D }, rows };
fs.writeFileSync(path.join(sweepDir, "SUMMARY.json"), JSON.stringify(summary, null, 2));
logLine(`SUMMARY.json written (${finishers.length} finished, ${dnfs.length} DNF, ${crashes.length} crashed)`);
