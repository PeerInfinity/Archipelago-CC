// Reserved-thread experiment (user idea #2, §11.7): a dedicated PLANNER
// worker_thread. Boots its own headless sim + IdlePlanner and, on each {save,rng}
// snapshot the executor hands it, runs one planRound and returns the winning
// queue. It keeps its planning state P across rounds (knowledge/thresholds) —
// exactly like the live planner-worker.js — so successive plans reuse measured
// knowledge. The EXECUTOR (main thread) advances committed loops concurrently and
// swaps in whatever plan is freshest; this thread just plans as fast as it can.
import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";

// worldConfig (cross-game P2-B): plan in the same world the executor runs.
const { srcDir, seed, params, worldConfig } = workerData;
const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(seed, ["planner-metadata.js", "planner.js"], { worldConfig: worldConfig ?? null });
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
const IP = ctx.ev("IdlePlanner");
const sess = new IP.Session();
const P = IP.newPlanningState(params ?? {});

parentPort.on("message", async (msg) => {
    if (msg.type !== "plan") return;
    const t0 = Date.now();
    try {
        sess.restore({ save: msg.save, rng: msg.rng });
        P.pre = null;                       // plan from the handed snapshot
        const { best } = await IP.planRound(sess, P);
        P.prevTimeNeeded = best.capacity;
        P.prevProbeTicks = best.probeTicks;
        P.lastCommitted = best.c.q;
        // hash of the state we planned FROM (staleness diagnostics on the executor)
        const fromHash = IP.boundaryHash();  // planRound leaves sess at the snapshot
        parentPort.postMessage({ type: "plan", id: msg.id, queue: best.c.q, label: best.c.label,
                                 fromHash, planMs: Date.now() - t0 });
    } catch (e) {
        parentPort.postMessage({ type: "error", id: msg.id, error: String(e?.stack ?? e) });
    }
});
parentPort.postMessage({ type: "ready" });
