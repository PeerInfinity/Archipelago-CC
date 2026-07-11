// Idle Loops differential parity harness: the fork submodule's COMMITTED HEAD
// (branch `substrate`) vs the upstream FORK-POINT commit, driven in lockstep
// through identical deterministic scenarios and compared as an EXACT
// full-state snapshot after every step.
//
// Clones the CC/scripts/jta-parity/ conventions:
//   - fork side = committed HEAD via `git archive` (never the working tree);
//   - upstream side = the fork point (every difference found is
//     fork-introduced), extracted from the submodule's own object store —
//     fe4a349 is content-addressed, so the submodule's copy IS upstream's;
//   - policies are deterministic and applied per-engine with no cross-engine
//     reads;
//   - every PASS carries an activity floor (minSteps/minLoops) — an
//     under-running scenario is VACUOUS, not a pass;
//   - a perturbation canary (--selftest-perturb) proves the comparator can
//     never pass vacuously.
//
// Unlike jta-parity, scenarios run in ONE process: each engine lives in its
// own Node vm context (fully isolated module state), so process-freshness is
// free. Both sims are seeded with the same mulberry32 RNG and the snapshot
// carries the RNG consumption counter, so RNG-parity is asserted too.
//
// Usage:
//   node CC/scripts/omsi-parity/run-parity.mjs                # all scenarios
//   node CC/scripts/omsi-parity/run-parity.mjs --scenario loops
//   node CC/scripts/omsi-parity/run-parity.mjs --list
//   # comparator canary: perturb the FORK engine by 1e-9 at step N; MUST
//   # report a divergence at exactly that step and exit 1
//   node CC/scripts/omsi-parity/run-parity.mjs --scenario ticks --selftest-perturb 500

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeContext, SIM_FILES } from "./sim-context.mjs";

export const FORK_POINT = "fe4a349efb799a56ab548018caca1a1a1aea0c8f";
const SEED = 12345;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(repoRoot, "frontend/modules/omsi-loops");
const upstreamDir = path.join(here, "upstream");
const forkDir = path.join(here, "fork-head");
const resultsDir = path.join(here, "results");

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();

// ---------------------------------------------------------------------------
// Scenario table.
// ---------------------------------------------------------------------------
// `cap` is the per-step mana bound: the lockstep comparison granularity.
// Policies rebuild the queue at every loop boundary from THAT engine's own
// state readout.

// Generic scripted policy: for every unlocked limited action, harvest the
// whole bank AND check up to 10 unchecked items (engine semantics: each exec
// consumes the goodTemp bank first, then checks — so `good + k` execs both
// harvests and grows the bank for future loops); take the two known cheap
// town-0 purchases when they appear (Buy Glasses boosts Wander; Buy Mana Z1
// converts lock gold into loop budget), then grind Wander as the backstop.
// Exercises progress grind, limited harvests/checks, unlock crossings,
// purchases, converters, and per-loop resource evaporation.
function scriptedPolicy(st) {
    const acts = st.actions.filter(a => a.visible && a.unlocked && a.travelNum === 0);
    const q = [];
    const banks = acts.filter(a => a.type === "limited"
            && ((a.lim?.good ?? 0) > 0 || (a.lim?.total ?? 0) > (a.lim?.checked ?? 0)))
        .sort((x, y) => (x.name < y.name ? -1 : 1));
    for (const b of banks) {
        const checks = Math.min(10, b.lim.total - b.lim.checked);
        q.push([b.name, b.lim.good + checks]);
    }
    for (const nm of ["Buy Glasses", "Buy Mana Z1"])
        if (acts.some(a => a.name === nm)) q.push([nm, 1]);
    q.push(["Wander", 99]);
    return q;
}

const SCENARIOS = {
    ticks: {
        description: "fixed early queue, 1-mana lockstep granularity — snapshot compared after every single mana tick",
        cap: 1,
        maxSteps: 4000,
        minSteps: 4000,
        minLoops: 8,
        policy: () => [["Smash Pots", 6], ["Wander", 3]],
        stopLoops: Infinity,
    },
    loops: {
        description: "600 loops of a generic scripted policy (bank harvests + item checks, purchases, converter, Wander grind), 50-mana lockstep granularity",
        cap: 50,
        maxSteps: 500_000,
        minSteps: 3_000,     // actual, deterministic: 3,851
        minLoops: 600,
        minTicks: 150_000,   // actual, deterministic: 190,100
        // some loop's budget must have grown well past base 250 — proves the
        // scenario actually engaged banks/converters, not just Wander
        minPeakMana: 400,
        policy: scriptedPolicy,
        stopLoops: 600,
    },
};

// ---------------------------------------------------------------------------
// Extraction.
// ---------------------------------------------------------------------------
function extract(commit, dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    run("bash", ["-c",
        `git -C ${JSON.stringify(submoduleDir)} archive --format=tar ${commit} -- ${SIM_FILES.join(" ")} | tar -x -C ${JSON.stringify(dir)}`]);
}

// ---------------------------------------------------------------------------
// Snapshot diffing (first divergence -> field paths).
// ---------------------------------------------------------------------------
function diffFields(aStr, bStr) {
    let a, b;
    try { a = JSON.parse(aStr.split("|rng:")[0]); b = JSON.parse(bStr.split("|rng:")[0]); }
    catch { return [{ path: "(unparseable)", a: aStr.slice(0, 120), b: bStr.slice(0, 120) }]; }
    const out = [];
    const walk = (pa, pb, p) => {
        if (out.length >= 12) return;
        if (typeof pa !== typeof pb || pa === null || pb === null || typeof pa !== "object") {
            if (JSON.stringify(pa) !== JSON.stringify(pb)) out.push({ path: p, a: pa, b: pb });
            return;
        }
        for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) walk(pa[k], pb[k], p ? `${p}.${k}` : k);
    };
    walk(a, b, "");
    const [ra, rb] = [aStr, bStr].map(s => s.split("|rng:")[1]);
    if (ra !== rb) out.push({ path: "rngState", a: ra, b: rb });
    return out;
}

// ---------------------------------------------------------------------------
// Lockstep driver.
// ---------------------------------------------------------------------------
function runScenario(name, sc, { perturbStep = null } = {}) {
    const upstream = makeContext(upstreamDir, SEED);
    const fork = makeContext(forkDir, SEED);
    const engines = [upstream, fork];

    const result = {
        scenario: name, description: sc.description,
        forkCommit: run("git", ["-C", submoduleDir, "rev-parse", "HEAD"]),
        forkPoint: FORK_POINT,
        seed: SEED, cap: sc.cap,
        steps: 0, loops: 0, ticksSpent: 0,
        perturbStep,
        verdict: null, firstDivergence: null,
    };

    const installQueues = () => {
        // Each engine's policy sees ONLY that engine's own state.
        const queues = engines.map(e => sc.policy(e.policyState()));
        for (const [i, e] of engines.entries()) { e.setQueue(queues[i]); e.restart(); }
        // Compare both the policy's intent and the engine-ordered queue
        // (addAction tail-pinning may reorder — must reorder identically).
        if (JSON.stringify(queues[0]) !== JSON.stringify(queues[1]))
            return { where: "policy queue", fields: [{ path: "queue", a: queues[0], b: queues[1] }] };
        if (upstream.getQueue() !== fork.getQueue())
            return { where: "engine-ordered queue", fields: [{ path: "actions.next", a: upstream.getQueue(), b: fork.getQueue() }] };
        return null;
    };

    const compare = (where) => {
        const a = upstream.snapshot(), b = fork.snapshot();
        if (a === b) return null;
        return { where, fields: diffFields(a, b) };
    };

    let div = installQueues() ?? compare("after setup");
    let loopSpent = 0;
    let watch = null;   // post-divergence classification window

    while (!div && result.steps < sc.maxSteps && result.loops < sc.stopLoops) {
        if (perturbStep !== null && result.steps === perturbStep)
            fork.ev("towns[0].expWander = (towns[0].expWander ?? 0) + 1e-9");
        const ra = upstream.step(sc.cap);
        const rb = fork.step(sc.cap);
        result.steps++;
        result.ticksSpent += ra.spent;
        loopSpent += ra.spent;
        if (ra.ended !== rb.ended || ra.spent !== rb.spent)
            { div = { where: `step ${result.steps} driver`, fields: [{ path: "step", a: ra, b: rb }] }; break; }
        div = compare(`step ${result.steps} (loop ${result.loops + 1})`);
        if (div) break;
        if (ra.ended) {
            if (loopSpent === 0) { result.verdict = "DEGENERATE"; break; }
            result.peakMana = Math.max(result.peakMana ?? 0, ra.endTimeNeeded ?? 0);
            loopSpent = 0;
            result.loops++;
            if (result.loops >= sc.stopLoops) break;
            div = installQueues();
        }
    }

    if (div) {
        result.verdict = "DIVERGED";
        result.firstDivergence = { step: result.steps, loop: result.loops + 1, ...div };
        // classify: transient (re-converges) vs persistent over a short window
        let reconverged = false;
        try {
            for (let i = 0; i < 200; i++) {
                const ra = upstream.step(sc.cap), rb = fork.step(sc.cap);
                if (ra.ended !== rb.ended) break;
                if (ra.ended) { const d = installQueues(); if (d) break; }
                if (upstream.snapshot() === fork.snapshot()) { reconverged = true; watch = i + 1; break; }
            }
        } catch { /* post-divergence engines may be unrecoverable; classification is best-effort */ }
        result.firstDivergence.classification = reconverged ? `transient (re-converged after ${watch} steps)` : "persistent";
    } else if (!result.verdict) {
        const vacuous = result.steps < sc.minSteps || result.loops < sc.minLoops
            || result.ticksSpent < (sc.minTicks ?? 0)
            || (result.peakMana ?? 0) < (sc.minPeakMana ?? 0);
        result.verdict = vacuous ? "VACUOUS" : "PASS";
        if (vacuous) result.floors = { minSteps: sc.minSteps, minLoops: sc.minLoops, minTicks: sc.minTicks ?? 0, minPeakMana: sc.minPeakMana ?? 0 };
    }
    return result;
}

// ---------------------------------------------------------------------------
async function main() {
    const args = process.argv.slice(2);
    const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

    if (args.includes("--list")) {
        for (const [k, v] of Object.entries(SCENARIOS)) console.log(`${k.padEnd(10)} ${v.description}`);
        return;
    }

    const only = val("--scenario");
    const perturbStep = val("--selftest-perturb") !== null ? Number(val("--selftest-perturb")) : null;
    if (perturbStep !== null && !only) { console.error("--selftest-perturb requires --scenario"); process.exit(2); }

    const forkCommit = run("git", ["-C", submoduleDir, "rev-parse", "HEAD"]);
    console.log(`fork HEAD:  ${forkCommit}`);
    console.log(`fork point: ${FORK_POINT}`);
    extract(FORK_POINT, upstreamDir);
    extract(forkCommit, forkDir);
    fs.mkdirSync(resultsDir, { recursive: true });

    const names = only ? [only] : Object.keys(SCENARIOS);
    const results = [];
    for (const name of names) {
        const sc = SCENARIOS[name];
        if (!sc) { console.error(`unknown scenario: ${name}`); process.exit(2); }
        process.stdout.write(`scenario ${name} ... `);
        const t0 = Date.now();
        const r = runScenario(name, sc, { perturbStep });
        r.wallSeconds = (Date.now() - t0) / 1000;
        results.push(r);
        console.log(`${r.verdict}  (${r.steps} steps, ${r.loops} loops, ${r.ticksSpent} ticks, ${r.wallSeconds.toFixed(1)}s)`);
        if (r.firstDivergence) {
            console.log(`  first divergence at ${r.firstDivergence.where} [${r.firstDivergence.classification}]`);
            for (const f of r.firstDivergence.fields.slice(0, 8))
                console.log(`    ${f.path}: upstream=${JSON.stringify(f.a)?.slice(0, 100)} fork=${JSON.stringify(f.b)?.slice(0, 100)}`);
        }
        fs.writeFileSync(path.join(resultsDir, `${name}${perturbStep !== null ? "-perturb" : ""}.json`), JSON.stringify(r, null, 2));
    }

    if (perturbStep !== null) {
        const r = results[0];
        const atStep = r.firstDivergence?.step === perturbStep + 1 || r.firstDivergence?.step === perturbStep;
        if (r.verdict === "DIVERGED" && atStep) {
            console.log(`CANARY OK: perturbation at step ${perturbStep} was caught at step ${r.firstDivergence.step} (${r.firstDivergence.fields[0]?.path})`);
            process.exit(1);   // divergence is still a divergence — same contract as jta-parity
        }
        console.log(`CANARY FAILED: expected divergence at step ~${perturbStep}, got ${r.verdict} at ${r.firstDivergence?.step ?? "none"}`);
        process.exit(2);
    }

    const verdict = results.every(r => r.verdict === "PASS") ? "PASS" : "FAIL";
    fs.writeFileSync(path.join(resultsDir, "parity-report.json"),
        JSON.stringify({ date: new Date().toISOString(), forkCommit, forkPoint: FORK_POINT, verdict, results }, null, 2));
    console.log(`\nverdict: ${verdict}  (report: results/parity-report.json)`);
    process.exit(verdict === "PASS" ? 0 : 1);
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main().catch(e => { console.error(e); process.exit(1); });
