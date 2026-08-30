// omsi-stats: drive the FORK's own Advanced Automation planner headlessly
// from a fresh save and record loops/ticks/milestones (jta-stats
// conventions: committed SUMMARY.md, raw data local-only in results/).
//
// The primary acceptance metric (substrate plan §3.3): loops to Forest Path
// (town 1) must stay <= the frozen reference. The session-28 calibration
// re-baseline (2026-07-16) deliberately re-froze it to 461 loops /
// 5,195,188 ticks / sha256-16 9d9952e68bc8373c (seed 12345, default
// weights): DEFAULT_WEIGHTS bank 30->45 / bankPot 15->8, the sweep winner
// under BOTH metrics on the Part-A capacity model. Prior references, both
// retired deliberately: Part A §11.9 535 / 5,965,890 / e23f020400162f9a
// (A1 un-gated the town-0 capacity probe); pre-Part-A v0 500 / 5,432,753 /
// 54506b48ec1758af. With
// --seed 12345 and seeding OFF, this harness additionally checks BYTE-EXACT
// reproduction of that reference: any planner change must reproduce it or
// be a deliberate re-freeze.
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
//   node CC/scripts/omsi-stats/run-planner.mjs --target-action "Continue On"
//       # §11.10 targeted mode (T1): goal-directed regression toward one action
//       # goal (make NAME executable this loop), falling back to the heuristic
//       # scorer when unachievable. Absent ⇒ heuristic (byte-exact default).
//   node CC/scripts/omsi-stats/run-planner.mjs --target-value skill:Magic:50
//       # §11.10 targeted mode (T2): a kind-b target-value goal — fill the loop
//       # with the max-ΔR providers toward a PERSISTENT target (skill/progress
//       # level, buff, soulstones, goldInvested; ruling 6). TYPE:NAME:VALUE
//       # (NAME omitted for soulstones/goldInvested).
//   node CC/scripts/omsi-stats/run-planner.mjs --targets '[{"kind":"a","action":"Continue On"},{"kind":"b","target":{"type":"skill","name":"Magic"},"value":50,"budget":0.3}]'
//       # §11.10 targeted mode (T3): the full priority list — goals fitted in
//       # order, kind-b budgets (fraction of the fill) make the list concurrent,
//       # leftover budget goes to the heuristic grind tail.
//   node CC/scripts/omsi-stats/run-planner.mjs --auto-rank
//       # targeted mode with the travel-frontier auto-ranker (ignores the list).
//   node CC/scripts/omsi-stats/run-planner.mjs --anti-fixation --weights '{"bank":20}'
//       # §6 stagnation trigger: the HEURISTIC auto-enters a targeted escalation
//       # round when it fixates (streak≥256 / drought≥256; end-anchored retune). Off = byte-exact.
//   node CC/scripts/omsi-stats/run-planner.mjs --pool 8
//       # parallel eval pool (§11.7 Design A): fan the per-round candidate
//       # confirms out across N worker_threads, each with its own sim
//       # context. Results are bit-identical to serial (every job carries a
//       # full save+rng snapshot; results merge in candidate order) — a
//       # default-seed pool run still asserts V0 EXACT REPRODUCTION, which
//       # is the determinism gate. Speedup bounded by Amdahl: measurement/
//       # probing/screening stay serial in the main context.
//   node CC/scripts/omsi-stats/run-planner.mjs --out results/foo.json

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const submoduleDir = path.join(repoRoot, "frontend/modules/omsi-loops");
const forkDir = path.join(here, "fork");
const resultsDir = path.join(here, "results");

// V0_LEGACY (pre-Part-A queue-planner v0, superseded by the §11.9 re-freeze
// 2026-07-13): { loops: 500, ticks: 5_432_753, hash: "54506b48ec1758af" }.
const V0_REFERENCE = { seed: 12345, loops: 461, ticks: 5_195_188, hash: "9d9952e68bc8373c" };

// ---- worldConfig (cross-game P2-B: headless schedule + priority policy) ----
//
// A worldConfig installs the P2 award schedule and the lootable priority prefs
// into every sim context this run builds, so headless sweeps can plan the
// world that actually exists (the same payload automation.js/predictor.js ride
// into the live workers). See NewDocs/plans/cross-game-p2-automation-transport
// -opus-kickoff.md §3.1.
//
// A run WITH a worldConfig is a DIFFERENT WORLD and therefore never asserts the
// frozen V0 reference — knobsAtDefaults excludes it.

/** actionListXml.js lootCategoryOf, mirrored host-side (keep the two in sync). */
function lootCategoryOf(entry) {
    if (entry === null || entry === undefined) return "vanilla";
    if (entry.dummy === true) return "dummy";
    if (entry.substrate !== undefined) return `foreign:${entry.substrate}/${entry.type}`;
    return `local:${entry.name}`;
}

/**
 * Synthesize lootPrefs from the schedule's own categories. These two policies
 * are the bounds the shuffle-scope curves sweep between:
 *   vanilla-first — vanilla ahead of everything (≈ the engine's default order;
 *     the OPTIMISTIC bound: the player always takes their own loot first);
 *   vanilla-last  — vanilla behind every other category (the PESSIMAL bound).
 * Categories are ordered by first appearance in the pool, matching the engine's
 * default tiebreak.
 */
function synthesizeLootPrefs(schedule, policy) {
    const prefs = {};
    for (const varName in schedule?.lootables ?? {}) {
        const contents = schedule.lootables[varName].contents ?? [];
        const seen = [];
        // "vanilla" always participates: contents shorter than the pool leaves
        // the tail vanilla, and a null entry is vanilla by definition
        for (const cat of ["vanilla", ...contents.map(lootCategoryOf)]) {
            if (!seen.includes(cat)) seen.push(cat);
        }
        const others = seen.filter((c) => c !== "vanilla");
        prefs[varName] = {
            order: policy === "vanilla-last" ? [...others, "vanilla"] : ["vanilla", ...others],
            disabled: [],
        };
    }
    return prefs;
}

/** Stable stringify (sorted keys) so the provenance hash is order-independent. */
function canonical(v) {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") {
        return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v ?? null);
}

/**
 * Resolve --world-config / --loot-policy into the payload installed everywhere.
 * An explicit lootPrefs block in the file WINS over the policy flag (the file
 * is the authored world; the policy is a convenience synthesizer).
 * @returns {{cfg: object, provenance: {hash: string, policy: string|null}} | null}
 */
function loadWorldConfig(filePath, policy) {
    if (!filePath) {
        if (policy) throw new Error("--loot-policy requires --world-config");
        return null;
    }
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(here, filePath);
    const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    // accept either the bare payload or a bare schedule
    const awardSchedule = raw.awardSchedule ?? raw;
    if (awardSchedule == null) throw new Error(`--world-config ${filePath}: no awardSchedule`);
    const lootPrefs = raw.lootPrefs ?? (policy ? synthesizeLootPrefs(awardSchedule, policy) : {});
    const cfg = { awardSchedule, lootPrefs };
    return {
        cfg,
        provenance: {
            hash: crypto.createHash("sha256").update(canonical(cfg)).digest("hex").slice(0, 16),
            policy: raw.lootPrefs ? (policy ? `${policy} (overridden by file lootPrefs)` : null) : (policy ?? null),
        },
    };
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();

// §W4 — vocabulary coverage report. Maps the ACTION-CENSUS.md blind-spot
// classes to the measured channels + metadata that now cover them, with sample
// values probed on representative states. This is the handshake artifact for
// item-5 calibration: it says which channels exist and roughly how big they
// are, without committing any scoring. Uses fresh sim contexts per scenario
// (the same setups as the vocabulary tests) so samples are deterministic.
async function runCoverage(makeContext, seed, resultsDir, outArg) {
    const mk = () => {
        const c = makeContext(seed, ["planner-metadata.js", "planner.js"]);
        c.sandbox.__rngGet = c.getRng; c.sandbox.__rngSet = c.setRng;
        c.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
        return c;
    };
    const meta = JSON.parse(mk().ev(
        "JSON.stringify(typeof PLANNER_METADATA!=='undefined'?PLANNER_METADATA:{gates:{},dimEffects:{},context:{}})"));
    const de = meta.dimEffects || {}, cx = meta.context || {}, gates = meta.gates || {};
    const dims = (pref) => Object.keys(de).filter(k => k.startsWith(pref));
    const ctxWith = (flag) => Object.keys(cx).filter(n => cx[n][flag]);

    // --- live channel samples (fresh, deterministic context per scenario) ---
    const samples = {};

    // Class 4 skill web — edgeRates (Practical Magic cheapens Smash Pots manaCost,
    // raises Pick Locks goldYield; census 2.2c row 1).
    try {
        const c = mk(); const IP = c.ev("IdlePlanner"); const sess = c.ev("new IdlePlanner.Session()");
        c.ev(`actions.clearActions();actions.addAction("Wander",1);restart();townsUnlocked=[0,1];`);
        for (const r of (sess.probe()["Start Journey"]?.requires ?? []))
            c.ev(`skills[${JSON.stringify(r.v)}].levelExp.level=Math.max(${r.need},skills[${JSON.stringify(r.v)}].levelExp.level)`);
        c.ev(`towns[0].expWander=getExpOfLevel(30);towns[1].expHermit=getExpOfLevel(30);
              skills.Magic.levelExp.level=Math.max(50,skills.Magic.levelExp.level);
              towns[0].totalLocks=100;towns[0].checkedLocks=0;towns[0].goodLocks=100;towns[0].goodTempLocks=100;
              skills.Practical.levelExp.level=0;adjustAll();`);
        const snap = sess.save(); sess.restore(snap); const state = sess.read();
        const A = state.actions.find(a => a.name === "Practical Magic");
        const sp = state.actions.find(a => a.name === "Smash Pots");
        const pl = state.actions.find(a => a.name === "Pick Locks");
        samples.edgeRates = {
            "Practical Magic -> Smash Pots.manaCost": IP.measureEdge(sess, snap, state, new Map(), A, sp, "manaCost"),
            "Practical Magic -> Pick Locks.goldYield": IP.measureEdge(sess, snap, state, new Map(), A, pl, "goldYield"),
        };
    } catch (e) { samples.edgeRates = { error: e.message }; }

    // Class 2/6 persistentDelta — per-stat soulstones + dungeon floors (cycle
    // mode makes the RNG reward deterministic; Small Dungeon).
    try {
        const c = mk(); const IP = c.ev("IdlePlanner"); const sess = c.ev("new IdlePlanner.Session()");
        c.ev(`options.rngMode="cycle";actions.clearActions();actions.addAction("Wander",1);restart();
              skills.Combat.levelExp.level=400;skills.Magic.levelExp.level=400;adjustAll();`);
        const snap = sess.save(); sess.restore(snap); const state = sess.read();
        const sd = state.actions.find(a => a.name === "Small Dungeon");
        const p = IP.measureAction(sess, snap, state, new Map(), sd, sess.needs("Small Dungeon"));
        samples.persistentDelta = {
            "Small Dungeon.soulstonesPerStat": p.persistentDelta?.soulstonesPerStat ?? null,
            "Small Dungeon.dungeons": p.persistentDelta?.dungeons ?? null,
        };
    } catch (e) { samples.persistentDelta = { error: e.message }; }

    // Class 7 consumes — Learn Alchemy consumes herbs 10/exec.
    try {
        const c = mk(); const IP = c.ev("IdlePlanner"); const sess = c.ev("new IdlePlanner.Session()");
        c.ev(`actions.clearActions();actions.addAction("Wander",1);restart();townsUnlocked=[0,1];`);
        for (const r of (sess.probe()["Start Journey"]?.requires ?? []))
            c.ev(`skills[${JSON.stringify(r.v)}].levelExp.level=${r.need}`);
        c.ev(`towns[1].expHermit=100*40*41/2;skills.Magic.levelExp.level=60;adjustAll();`);
        const snap = sess.save(); sess.restore(snap); const state = sess.read();
        const la = state.actions.find(a => a.name === "Learn Alchemy");
        const p = la ? IP.measureAction(sess, snap, state, new Map(), la, sess.needs("Learn Alchemy"), { baselineCache: new Map() }) : null;
        samples.consumes = { "Learn Alchemy": p?.consumes ?? null };
    } catch (e) { samples.consumes = { error: e.message }; }

    const report = {
        date: new Date().toISOString(),
        note: "vocabulary coverage (plan §W4). declared = metadata (dimEffects/context/gates); "
            + "measured = an empirical measureAction channel; samples probed on representative states.",
        classes: {
            "1 buffs": {
                declared: dims("buff:"),
                channels: ["persistentDelta.buffs (measured)",
                    "downstream: speed / trainingLimits / startingStats / expMult / segmentRate (dimEffects)"],
            },
            "2 soulstones": {
                declared: ["skill:Divine (soulstoneCount)"],
                channels: ["persistentDelta.soulstones + soulstonesPerStat (measured)",
                    "context.rng — needs rngMode cycle"],
                sample: samples.persistentDelta?.["Small Dungeon.soulstonesPerStat"],
            },
            "3 capability stacks": {
                declared: dims("skill:").filter(k => de[k].some(e => e.channel === "segmentRate")),
                channels: ["segmentRate (dimEffects; live multipart RATE = v2, census 2.4)",
                    "consumes{} for armor/team/blood/hide"],
            },
            "4 skill-efficiency web": {
                declared: dims("skill:"),
                channels: ["edgeRates[T][channel] — measured, informed mode (generalized travelRelief)"],
                sample: samples.edgeRates,
            },
            "5 gates": { declared: Object.keys(gates) },
            "6 persistent ledgers": {
                channels: ["persistentDelta.goldInvested / dungeons / trials / mult / stonesUsed / trainingLimits (measured)"],
                sample: samples.persistentDelta?.["Small Dungeon.dungeons"],
            },
            "7 cross-town / context": {
                declared: { crossTown: ctxWith("crossTown"), temporal: ctxWith("temporal"),
                    dynamic: ctxWith("dynamic"), rng: ctxWith("rng") },
                channels: ["crossTown{} (measured; deep-game live sample = v2)", "consumes{}"],
                sample: samples.consumes,
            },
        },
    };

    fs.mkdirSync(resultsDir, { recursive: true });
    const outPath = outArg
        ? (path.isAbsolute(outArg) ? outArg : path.join(resultsDir, path.basename(outArg)))
        : path.join(resultsDir, "vocabulary-coverage.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log("VOCABULARY COVERAGE (census class -> measured/declared channels):\n");
    for (const [cls, info] of Object.entries(report.classes)) {
        const decl = Array.isArray(info.declared) ? `${info.declared.length} declared`
            : info.declared ? Object.entries(info.declared).map(([k, v]) => `${k}:${v.length}`).join(" ") : "";
        console.log(`  ${cls.padEnd(24)} ${decl}`);
        for (const ch of info.channels ?? []) console.log(`      · ${ch}`);
        if (info.sample !== undefined) console.log(`      sample: ${JSON.stringify(info.sample)}`);
    }
    console.log(`\ncoverage report written to ${outPath}`);
}

// §11.6 ladder — Buy Mana / zone-1 economy optimiser readout (--balance).
// Restores a saved run's loop-start state and optimises its last committed
// queue (or a --queue override), printing the proposed order + waste deltas.
function runBalance(ctx, IP, { fromStatePath, queueArg }) {
    const sess = ctx.ev("new IdlePlanner.Session()");
    let queue = queueArg ? JSON.parse(queueArg) : null;
    if (fromStatePath) {
        const p = path.isAbsolute(fromStatePath) ? fromStatePath : path.join(here, fromStatePath);
        const blob = JSON.parse(fs.readFileSync(p, "utf8"));
        sess.restore({ save: blob.save, rng: blob.rng });
        if (!queue) queue = blob.planning?.lastCommitted ?? null;
    }
    if (!queue || !queue.length) throw new Error("--balance needs --from-state (with a committed queue) or --queue '[[name,loops],...]'");
    sess.setQueue(queue);
    sess.restart();
    const snap = sess.save();
    const res = IP.optimizeEconomy(sess, snap, queue);
    const fmt = (q) => q.map(([n, l]) => `${n} x${l}`).join(" | ");
    const wfmt = (w) => `failed=${w.failed} buyMana=${w.convExecs} gold=${w.unconvGold} econ=${Math.round(w.econ)}`;
    console.log(`\nBUY MANA / economy optimiser (converter=${res.report.converter}, rate=${res.report.rate})\n`);
    console.log(`  queue in:  ${fmt(queue)}`);
    console.log(`             ${wfmt(res.report.before)}`);
    console.log(`  proposed:  ${fmt(res.queue)}`);
    console.log(`             ${wfmt(res.report.after)}   (${res.report.moves} moves, ${res.report.evals} rollouts)`);
    const changed = JSON.stringify(res.queue) !== JSON.stringify(queue.map(([n, l]) => [n, l]));
    console.log(`\n  ${changed ? "SUGGESTS a reorder/rebalance" : "already optimal — no change"}`);
}

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
    const screenMode = val("--screen-mode", "predictor");   // predictor | engine | none
    const probeEvery = Number(val("--probe-every", 1));
    // §11.7 reuse: replay each winning queue this many loops before re-planning
    // (running is far cheaper than planning). 1 = re-plan every loop = byte-exact
    // reference. >1 trades loop-count optimality for wall-clock.
    const replanEvery = Number(val("--replan-every", 1));
    // "basic automation during reuse" (user idea): re-tune reused queues (rep
    // top-up to current pools) between full replans. Tactical only; off = plain
    // reuse. No effect at replanEvery=1 (no reuse loop) ⇒ byte-gate unaffected.
    const basicReuse = has("--basic-reuse");
    // --dump-detail: stream a per-loop diagnostic JSONL (each loop's full
    // candidate evals + a compact economy/frontier state snapshot) to
    // results/<label>-detail.jsonl for post-run analysis of WHY a run gets
    // stuck. Written incrementally so a killed/DNF run still leaves the file.
    const dumpDetail = has("--dump-detail");
    const targetTown = Number(val("--target-town", 1));
    const multiTown = val("--multi-town", "on") !== "off";
    const vocabulary = val("--vocabulary", "empirical");   // empirical | informed
    // deterministic RNG cycling (fork option; W0). "random" (default) keeps the
    // frozen reference; "cycle" makes RNG-channel measurement/candidates + Layer-P
    // probing of RNG targets available (plan §6). Serial only for now — pool
    // workers boot their own context without it.
    const rngMode = val("--rng-mode", "random");           // random | cycle
    // §11.10 targeted mode: --target-action NAME drives the goal-directed
    // regression toward a single action goal (T1 headless driver; T3 adds the
    // priority list). Absent ⇒ heuristic strategy = today's byte-exact behavior.
    const targetAction = val("--target-action", null);
    // --target-value TYPE:NAME:VALUE (T2): a kind-b target-value goal. TYPE ∈
    // skill|progress|buff|soulstones|goldInvested; NAME omitted for
    // soulstones/goldInvested (e.g. "goldInvested::1000000", "skill:Magic:50").
    const targetValueArg = val("--target-value", null);
    // --targets '<json array>' (T3): the full priority list, e.g.
    // '[{"kind":"a","action":"Continue On"},{"kind":"b","target":{"type":"skill","name":"Magic"},"value":50,"budget":0.3}]'
    const targetsArg = val("--targets", null);
    const autoRankTargets = has("--auto-rank");
    // abandon-audit knob: stall rounds before a goal branch abandons (default 20; huge value = abandon disabled)
    const goalStallK = Number(val("--goal-stall-k", 20));
    // §U locked-branch abandon threshold (armed unlock-dim clock; default 64 — measured
    // healthy armed-window max flat stretch is 25 rounds at replanEvery=1)
    const unlockStallK = Number(val("--unlock-stall-k", 64));
    // §6 stagnation trigger: auto-enter a targeted escalation round when the
    // heuristic fixates (streak≥256 / drought≥256; end-anchored retune). Off = today's behavior.
    const antiFixation = has("--anti-fixation");
    // §W4 vocabulary coverage report: census class -> measured channel -> sample
    // values on representative states. The item-5 calibration handshake artifact
    // (which data channels exist + sample magnitudes). Boots the sim, samples
    // each channel, writes JSON + a summary, and exits before the normal run.
    const coverage = has("--coverage");
    let targets = [];
    if (targetsArg) targets = JSON.parse(targetsArg);
    else if (targetValueArg) {
        const [type, name, value] = targetValueArg.split(":");
        targets = [{ kind: "b", target: { type, name: name || undefined }, value: Number(value) }];
    }
    const strategy = (targetAction || targets.length || autoRankTargets) ? "targeted" : "heuristic";
    const gainMult = Number(val("--gain-mult", 1));
    const metric = val("--metric", "loops");
    const metricWeights = JSON.parse(val("--metric-weights", '{"loops":1,"ticks":0,"wall":0}'));
    const saveStatePath = val("--save-state", null);
    const fromStatePath = val("--from-state", null);
    const wanderUntil = Number(val("--wander-until", 0));
    const wanderCap = Number(val("--wander-cap", 20000));
    if (wanderUntil > 0 && fromStatePath) throw new Error("--wander-until and --from-state are mutually exclusive");
    // cross-game P2-B: --world-config <file> installs the §3.1 payload into
    // every sim context (main, eval pool, planner thread). --loot-policy
    // synthesizes the priority prefs from the schedule's own categories; the
    // two policies are the bounds the shuffle-scope curves sweep between.
    const worldConfigPath = val("--world-config", null);
    const lootPolicy = val("--loot-policy", null);
    if (lootPolicy && !["vanilla-first", "vanilla-last"].includes(lootPolicy)) {
        throw new Error(`--loot-policy must be vanilla-first|vanilla-last (got ${lootPolicy})`);
    }
    const world = loadWorldConfig(worldConfigPath, lootPolicy);

    const knobsAtDefaults = !world && screenK === 8 && probeEvery === 1 && targetTown === 1 && multiTown
        && gainMult === 1 && !fromStatePath && !wanderUntil && screenMode === "predictor"
        && vocabulary === "empirical" && strategy === "heuristic" && !antiFixation
        && rngMode === "random" && replanEvery === 1;

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
    const ctx = makeContext(seed, ["planner-metadata.js", "planner.js"], { worldConfig: world?.cfg ?? null });
    ctx.sandbox.__rngGet = ctx.getRng;
    ctx.sandbox.__rngSet = ctx.setRng;
    ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
    if (gainMult !== 1) ctx.ev(`options.expGainMultiplier = ${gainMult}`);
    if (world) console.log(`worldConfig: ${worldConfigPath}  hash: ${world.provenance.hash}  policy: ${world.provenance.policy ?? "(none)"}`);
    if (rngMode !== "random") ctx.ev(`options.rngMode = ${JSON.stringify(rngMode)}`);
    const IP = ctx.ev("IdlePlanner");

    if (coverage) { await runCoverage(makeContext, seed, resultsDir, val("--out", null)); return; }

    // §11.6 ladder — Buy Mana / zone-1 economy optimiser (IdlePlanner.optimizeEconomy).
    // --balance restores a saved run (--from-state) and optimises its last committed
    // queue (or a --queue '<json>' override) against that loop-start state, printing
    // the proposed order + waste deltas. Byte-inert: the optimiser never runs in the
    // reference path, this is a manual dev readout. Early-return before the normal run.
    if (has("--balance")) { runBalance(ctx, IP, { fromStatePath, queueArg: val("--queue", null) }); return; }

    // Parallel eval pool (--pool N): N worker_threads, each with its own sim
    // context, serving confirmCandidate jobs. Order preserved by Promise.all
    // over per-job promises; a free-worker queue keeps every thread busy.
    const poolSize = Number(val("--pool", 0));
    let poolWorkers = [];
    if (poolSize > 0) {
        const workerPath = path.join(here, "eval-worker.mjs");
        poolWorkers = Array.from({ length: poolSize }, () =>
            new Worker(workerPath, { workerData: { srcDir, seed, gainMult, worldConfig: world?.cfg ?? null } }));
        await Promise.all(poolWorkers.map(w => new Promise((res, rej) => {
            w.once("message", res);
            w.once("error", rej);
        })));
        const idle = [...poolWorkers], waiters = [];
        const acquire = () => idle.length ? Promise.resolve(idle.pop()) : new Promise(r => waiters.push(r));
        const release = (w) => { const n = waiters.shift(); if (n) n(w); else idle.push(w); };
        let nextId = 1;
        const runBatch = async (batch) => {
            const w = await acquire();
            try {
                return await new Promise((resolve, reject) => {
                    const id = nextId++;
                    const onMsg = (m) => {
                        if (m.id !== id) return;
                        w.off("message", onMsg);
                        if (m.ok) resolve(m.res); else reject(new Error(m.error));
                    };
                    w.on("message", onMsg);
                    w.postMessage({ id, batch });
                });
            } finally { release(w); }
        };
        // One message per worker per round (latency amortization): jobs are
        // dealt round-robin into <= poolSize slices, results reassembled by
        // original index.
        IP.setEvalPool(async (jobs) => {
            const n = Math.max(1, Math.min(poolSize, jobs.length));
            const slices = Array.from({ length: n }, () => []);
            jobs.forEach((job, idx) => slices[idx % n].push({ idx, job }));
            const results = new Array(jobs.length);
            await Promise.all(slices.map(async (slice) => {
                if (!slice.length) return;
                const rs = await runBatch(slice.map(x => x.job));
                slice.forEach((x, k) => { results[x.idx] = rs[k]; });
            }));
            return results;
        });
        console.log(`eval pool: ${poolSize} workers (batched)`);
    }

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
    // --dump-detail: a per-loop JSONL beside the progress log. Each line is the
    // full trace entry (queue + candidate evals + compact state) for that loop.
    const detailPath = dumpDetail ? progressPath.replace(/\.log$/, "-detail.jsonl") : null;
    if (detailPath) fs.writeFileSync(detailPath, "");
    const onLoop = (t) => {
        fs.appendFileSync(progressPath,
            `L${t.loop} ${t.label} ticks=${t.ticks} cum=${t.cumTicks} mana=${t.mana} score=${t.score}\n`);
        if (detailPath) fs.appendFileSync(detailPath, JSON.stringify(t) + "\n");
    };
    console.log(`progress log: ${progressPath}`);
    if (detailPath) console.log(`detail log:   ${detailPath}`);

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
    const r = await IP.runStandalone({ maxLoops, weights, seedFromPredictor, verbose: true, screenK, screenMode, probeEvery, replanEvery, basicReuse, dumpDetail, targetTown, multiTown, vocabulary, strategy, targetAction, targets, autoRankTargets, antiFixation, goalStallK, unlockStallK, resume, onLoop });
    for (const w of poolWorkers) w.terminate();
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
        weightsOverride, screenK, screenMode, probeEvery, replanEvery, targetTown, multiTown, vocabulary, gainMult,
        strategy, targetAction, targets, autoRankTargets, antiFixation, goalStallK, unlockStallK,
        metric, metricValue,
        wanderUntil, wanderLoops, wanderTicks, wanderExplored,
        totalLoops, totalTicks,
        loopsRun: r.loopsRun, cumTicks: r.cumTicks,
        finished: r.finished, finalHash: hash,
        divergenceCount: r.divergences.length, divergences: r.divergences,
        rngConsumed: ctx.rngCount(),
        // cross-game P2-B provenance: which world this run planned (null = the
        // vanilla world, the only one that asserts the frozen reference)
        worldConfig: world ? world.provenance : null,
        // keep the main results JSON lean: the heavy per-loop evals/state live
        // in the -detail.jsonl (when --dump-detail); strip them here.
        milestones: r.milestones,
        trace: dumpDetail ? r.trace.map(({ evals, state, ...t }) => t) : r.trace,
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
    if (r.perf) {
        const total = Object.entries(r.perf).filter(([k]) => k !== "rounds").reduce((s, [, v]) => s + v, 0);
        console.log(`planRound phases (${r.perf.rounds} rounds, ${(total / 1000).toFixed(0)}s):`,
            Object.entries(r.perf).filter(([k]) => k !== "rounds")
                .map(([k, v]) => `${k} ${(100 * v / Math.max(1, total)).toFixed(0)}%`).join("  "));
    }
    console.log(`divergences (predictor-vs-engine): ${r.divergences.length}`);
    console.log(`milestones (loop, total-indexed${wanderUntil > 0 ? "; ticks incl. wander phase" : ""}):`);
    const highlights = Object.entries(r.milestones).filter(([k]) =>
        k.startsWith("town") || ["Pick Locks:unlocked", "Buy Glasses:unlocked", "Short Quests:unlocked",
            "Investigate:unlocked", "Lessons:unlocked", "Start Journey:unlocked"].includes(k));
    for (const [k, v] of highlights) console.log(`  ${k.padEnd(30)} L${v.loop}  (${v.cumTicks + wanderTicks} ticks)`);
    console.log(`results written to ${outPath}`);

    // Acceptance gates (the <=V0_REFERENCE.loops criterion is the acceptance
    // test — not applicable to wander-first experiment arms, which only gate
    // on reaching the target town)
    const gate = r.finished && (targetTown !== 1 || wanderUntil > 0 || r.loopsRun <= V0_REFERENCE.loops);
    console.log(`\nACCEPTANCE (${targetTown === 1 && !wanderUntil ? `<=${V0_REFERENCE.loops} loops to town 1` : `reached town ${targetTown}`}): ${gate ? "PASS" : "FAIL"} (${totalLoops} loops)`);
    if (seed === V0_REFERENCE.seed && !seedFromPredictor && !Object.keys(weightsOverride).length && knobsAtDefaults) {
        const exact = r.loopsRun === V0_REFERENCE.loops && r.cumTicks === V0_REFERENCE.ticks && hash === V0_REFERENCE.hash;
        console.log(`V0 EXACT REPRODUCTION (${V0_REFERENCE.loops} / ${V0_REFERENCE.ticks} / ${V0_REFERENCE.hash}): ${exact ? "PASS" : "MISMATCH"}`);
        if (!exact) console.log(`  got ${r.loopsRun} / ${r.cumTicks} / ${hash} — investigate the port before trusting other numbers`);
        process.exit(gate && exact ? 0 : 1);
    }
    process.exit(gate ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
