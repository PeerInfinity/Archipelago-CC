// omsi-stats eval-pool worker: boots its own headless sim context and serves
// confirmCandidate jobs (the planner.js setEvalPool contract — see §11.7
// Design A in the multitown plan). One job at a time per worker; every job
// carries a full (save, rng) snapshot, so results are bit-identical to
// running the same confirm in the main context.
import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { srcDir, seed, gainMult } = workerData;
const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(seed, ["planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
if (gainMult !== 1) ctx.ev(`options.expGainMultiplier = ${gainMult}`);
const IP = ctx.ev("IdlePlanner");
const sess = new IP.Session();

parentPort.on("message", ({ id, job }) => {
    try {
        const res = IP.confirmCandidate(
            sess, { save: job.save, rng: job.rng }, job.q, new Map(job.know), job.multiTown);
        parentPort.postMessage({ id, ok: true, res });
    } catch (e) {
        parentPort.postMessage({ id, ok: false, error: String(e?.stack ?? e) });
    }
});
parentPort.postMessage({ ready: true });
