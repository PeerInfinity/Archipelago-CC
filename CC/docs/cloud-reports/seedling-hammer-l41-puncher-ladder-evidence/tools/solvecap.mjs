// scratch: solve a captured request exactly as the page did (solveAnytime, its passes and budget), print the answer.
import { readFileSync } from 'node:fs';
const R = process.cwd();
const { restoreRequest } = await import(`${R}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${R}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, replayTape } = await import(`${R}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const SB = await import(`${R}/frontend/modules/seedlingDemo/solverBot.js`);
const [file, idArg, timeArg] = process.argv.slice(2);
for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
    const o = JSON.parse(line);
    if (idArg && idArg !== 'all' && String(o.id) !== idArg) continue;
    if (!o.requests?.length) { console.log("SOLVE", JSON.stringify({ id: o.id, key: o.key, ok: null, msg: "no captured request (the leg ended before a solve)", retargets: [] })); continue; }
    const req = restoreRequest(o.requests[0].request);
    const { passes, source, ...tape } = req;
    if (timeArg) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: Number(timeArg) } };
    SB.KILL_HIT_BODY.retargets.length = 0;
    const t0 = Date.now();
    let a;
    try { a = solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(source.records) }, { passes }); }
    catch (e) { a = { ok: false, message: `THREW ${e.message}` }; }
    let drive = null;
    if (a.ok) {
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const h0 = run.playerHits.length;
        a.plan.solution.forEach((k, i) => { const s = a.plan.equipsAt?.get?.(i); if (s !== undefined) run.equipNow(s); run.advance(k); });
        drive = { hits: run.playerHits.length - h0, deaths: run.playerDeaths.length, end: [run.level, +run.state.x.toFixed(1), +run.state.y.toFixed(1)] };
    }
    console.log('SOLVE', JSON.stringify({ id: o.id, key: o.key, on: SB.KILL_HIT_BODY.enabled, time: tape.staging.seam?.time, ok: a.ok,
        ticks: a.plan?.solution?.length ?? null, digest: a.ok ? (await import("node:crypto")).createHash("sha1").update(JSON.stringify(a.plan.solution.map((k) => [...k]))).digest("hex").slice(0, 12) : null, ms: Date.now() - t0, drive, retargets: SB.KILL_HIT_BODY.retargets,
        msg: a.ok ? null : String(a.message).split('\n')[0].slice(0, 330) }));
}
