// Reserved-thread headless experiment (user idea #2, §11.7 Design B).
//
// The question: in HEADLESS runs the plan's committed loop is normally FREE (it
// IS one of the eval confirms), so the doc claimed "overlap execution with
// planning can't speed headless." replanEvery already refuted that by planning
// LESS OFTEN. This experiment tests the other half of the user's idea: run a
// DEDICATED executor that advances committed loops continuously on the main
// thread while a PLANNER worker_thread computes the next plan concurrently, and
// swap in each fresh plan when it lands. The executor never waits on planning; it
// just reuses the current plan until a newer one arrives (adaptive, self-selected
// reuse). We measure loops + wall to town 1 and the effective reuse factor.
//
//   node CC/scripts/omsi-stats/reserved-thread-exp.mjs [--seed N] [--max-loops N]
//        [--screen-k K] [--dispatch-every T] [--target-town N]
//
// --dispatch-every T (default 0 = "as soon as the planner is idle", the purest
// form of the idea) throttles: dispatch a new plan only every T committed loops,
// trading wall for less staleness. Compare against run-planner.mjs --replan-every.
import { Worker } from "node:worker_threads";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const srcDir = path.join(repoRoot, "frontend/modules/omsi-loops");

const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const seed = Number(val("--seed", 12345));
const maxLoops = Number(val("--max-loops", 3000));
const screenK = Number(val("--screen-k", 8));
const targetTown = Number(val("--target-town", 1));
const dispatchEvery = Number(val("--dispatch-every", 0));   // 0 = dispatch whenever idle
// --max-stale L: bound staleness — if the current plan is >= L committed loops
// old and no fresh plan is pending, the executor WAITS for the next plan before
// running the loop. 0 = never wait (pure overlap, self-selected K).
const maxStale = Number(val("--max-stale", 0));
// --anti-fixation: enable the planner's stagnation guard (streak/drought ->
// targeted escalation), which is what escapes the economy-fixation hole that
// extreme staleness (K~143) lands in.
const antiFixation = args.includes("--anti-fixation");

// --- executor sim on the main thread ---------------------------------------
const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(seed, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");
const exec = new IP.Session();

// --- planner worker_thread --------------------------------------------------
const worker = new Worker(path.join(here, "planner-thread-worker.mjs"), {
    workerData: { srcDir, seed, params: { screenK, screenMode: "predictor", multiTown: true, seedFromPredictor: false, antiFixation } },
});
let plannerReady = null;
const readyP = new Promise((res) => { plannerReady = res; });
let plannerBusy = false;
let pendingPlan = null;          // freshest plan not yet adopted
let firstPlanResolve = null;
const firstPlanP = new Promise((res) => { firstPlanResolve = res; });
let planId = 0, plansDispatched = 0, plansReturned = 0, planMsTotal = 0, waitMs = 0;
const dispatchLoopById = new Map();
let planWaiter = null;           // resolves when a fresh plan lands (max-stale wait)

worker.on("message", (m) => {
    if (m.type === "ready") { plannerReady(); return; }
    if (m.type === "plan") {
        plannerBusy = false; plansReturned++; planMsTotal += m.planMs ?? 0;
        pendingPlan = { queue: m.queue, label: m.label, fromHash: m.fromHash,
                        fromLoop: dispatchLoopById.get(m.id) ?? 0 };
        dispatchLoopById.delete(m.id);
        if (firstPlanResolve) { firstPlanResolve(pendingPlan); firstPlanResolve = null; }
        if (planWaiter) { planWaiter(); planWaiter = null; }
    } else if (m.type === "error") {
        console.error("planner error:", m.error); process.exit(1);
    }
});
worker.on("error", (e) => { console.error("worker crashed:", e); process.exit(1); });

function dispatchPlan(atLoop) {
    const snap = exec.save();
    plannerBusy = true; plansDispatched++;
    dispatchLoopById.set(planId + 1, atLoop);
    worker.postMessage({ type: "plan", id: ++planId, save: snap.save, rng: snap.rng });
}

await readyP;

// bootstrap: get the first plan from the fresh boot state before the executor runs
dispatchPlan(0);
let current = await firstPlanP;
let currentFromLoop = current.fromLoop;
pendingPlan = null;   // consumed by the bootstrap await; don't re-adopt at loop 0

// --- executor loop ----------------------------------------------------------
const t0 = process.hrtime.bigint();
let loop = 0, cumTicks = 0, adoptions = 0, staleAdopts = 0, execMs = 0, sinceDispatch = 0, waits = 0;
let finished = false;
const milestones = {};
let pre = exec.read();

while (loop < maxLoops) {
    // adopt the freshest delivered plan at this boundary
    if (pendingPlan) {
        if (pendingPlan.fromHash !== IP.boundaryHash()) staleAdopts++;
        current = pendingPlan; currentFromLoop = pendingPlan.fromLoop; pendingPlan = null; adoptions++;
    }
    // bounded staleness: if the current plan is too old and none is pending, WAIT
    // for the planner to deliver a fresher one before running another loop.
    if (maxStale > 0 && (loop - currentFromLoop) >= maxStale && !pendingPlan && plannerBusy) {
        const tw = process.hrtime.bigint();
        await new Promise((res) => { planWaiter = res; });
        waitMs += Number(process.hrtime.bigint() - tw) / 1e6; waits++;
        current = pendingPlan; currentFromLoop = pendingPlan.fromLoop; pendingPlan = null; adoptions++;
    }
    // dispatch the next plan (as soon as idle, or every dispatchEvery loops)
    sinceDispatch++;
    if (!plannerBusy && (dispatchEvery === 0 || sinceDispatch >= dispatchEvery)) {
        dispatchPlan(loop); sinceDispatch = 0;
    }
    // run one committed loop with the current (possibly reused) plan
    const te = process.hrtime.bigint();
    exec.setQueue(current.queue); exec.restart();
    const r = exec.runLoop();
    execMs += Number(process.hrtime.bigint() - te) / 1e6;
    loop++; cumTicks += r.ticks;
    const post = exec.read();
    // milestones: newly unlocked/visible actions + towns
    const preAvail = new Map(pre.actions.map(a => [a.name, a.visible ? (a.unlocked ? 2 : 1) : 0]));
    for (const a of post.actions) {
        const now = a.visible ? (a.unlocked ? 2 : 1) : 0;
        if (now > (preAvail.get(a.name) ?? 0)) {
            const key = `${a.name}:${now === 2 ? "unlocked" : "visible"}`;
            if (!(key in milestones)) milestones[key] = { loop, cumTicks };
        }
    }
    for (const t of post.townsUnlocked) if (!pre.townsUnlocked.includes(t)) milestones[`town${t}`] = { loop, cumTicks };
    pre = post;
    if (post.townsUnlocked.includes(targetTown)) { finished = true; break; }
    // yield so the planner's messages get processed between loops
    await new Promise((res) => setImmediate(res));
}
const wall = Number(process.hrtime.bigint() - t0) / 1e9;
worker.terminate();

const effK = adoptions ? (loop / adoptions) : loop;
const avgPlanMs = plansReturned ? planMsTotal / plansReturned : 0;
console.log(`\nRESERVED-THREAD (seed ${seed}, screenK ${screenK}, dispatchEvery ${dispatchEvery}, maxStale ${maxStale}, antiFix ${antiFixation})`);
console.log(`  town${targetTown}: ${finished ? "REACHED" : "DNF"}  loops: ${loop}  ticks: ${cumTicks}  wall: ${wall.toFixed(1)}s`);
console.log(`  plans: ${plansReturned} returned / ${plansDispatched} dispatched  effective reuse K=${effK.toFixed(1)}  avg planRound ${avgPlanMs.toFixed(0)}ms`);
console.log(`  executor loop time total ${execMs.toFixed(0)}ms (${(execMs / loop).toFixed(1)}ms/loop)  stale adoptions: ${staleAdopts}/${adoptions}`);
console.log(`  executor waits for a fresh plan: ${waits} (${waitMs.toFixed(0)}ms = ${(100 * waitMs / (wall * 1000)).toFixed(0)}% of wall)`);
const ms = Object.entries(milestones).filter(([k]) => k.startsWith("town") || /Start Journey|Continue On|Buy Supplies/.test(k));
for (const [k, v] of ms) console.log(`    ${k.padEnd(28)} L${v.loop} (${v.cumTicks} ticks)`);
process.exit(0);
