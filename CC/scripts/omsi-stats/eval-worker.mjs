// omsi-stats eval-pool worker: boots its own headless sim context and serves
// setEvalPool jobs (planner.js contract — §11.7 Design A in the multitown
// plan). Jobs arrive in per-round batches; every job carries a full
// (save, rng) snapshot, so results are bit-identical to running the same
// work in the main context.
import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { srcDir, seed, gainMult } = workerData;
const { makeContext } = await import(pathToFileURL(path.join(srcDir, "test/harness.mjs")).href);
const ctx = makeContext(seed, ["planner-metadata.js", "planner.js"]);
ctx.sandbox.__rngGet = ctx.getRng;
ctx.sandbox.__rngSet = ctx.setRng;
ctx.ev("IdlePlanner.setRngHooks({ get: __rngGet, set: __rngSet })");
if (gainMult !== 1) ctx.ev(`options.expGainMultiplier = ${gainMult}`);
const IP = ctx.ev("IdlePlanner");
const sess = new IP.Session();

// Screen jobs from one planning round all share a snapshot; skip redundant
// restores (string identity on save+rng). Safe because prediction is
// state-pure — the serial reference path itself predicts N queues off ONE
// restore. Confirm jobs run sims, so they always restore (and invalidate
// the cache).
let lastSnapKey = null;

async function runOne(job) {
    if (job.kind === "escreen") {
        // engine-screen: one loop, uniform cost, degenerate-on-failure
        lastSnapKey = null;
        return IP.evalLoopOnly(sess, { save: job.save, rng: job.rng }, job.q);
    }
    if (job.kind === "screen") {
        // failures resolve as {ok:false} — the serial path's catch shape
        try {
            const key = job.save + " " + JSON.stringify(job.rng ?? null);
            if (key !== lastSnapKey) {
                sess.restore({ save: job.save, rng: job.rng });
                lastSnapKey = key;
            }
            return await sess.predict(job.q);
        } catch (e) {
            lastSnapKey = null;
            return { ok: false, error: String(e?.message ?? e) };
        }
    }
    lastSnapKey = null;
    return IP.confirmCandidate(
        sess, { save: job.save, rng: job.rng }, job.q, new Map(job.know), job.multiTown);
}

// Batched: one message carries a slice of one round's jobs (per-job round
// trips cost ~as much as the predictions themselves). Results return in
// slice order; a confirm error rejects the whole batch (planRound throws in
// the serial path too).
parentPort.on("message", async ({ id, batch }) => {
    try {
        const res = [];
        for (const job of batch) res.push(await runOne(job));
        parentPort.postMessage({ id, ok: true, res });
    } catch (e) {
        parentPort.postMessage({ id, ok: false, error: String(e?.stack ?? e) });
    }
});
parentPort.postMessage({ ready: true });
