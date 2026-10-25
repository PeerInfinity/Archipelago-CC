// scratch (L40BK2 D2): a captured request at seam times -> the solver's plan -> the model's replay hits (env picks the arm)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const REPO = '/home/user/Archipelago-CC';
const P = REPO + '/scripts/procgen/';
const M = REPO + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(P + 'seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(P + 'replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(M + 'jsRuntimeSolver.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { runTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [file, id, times] = process.argv.slice(2);
const line = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === +id);
const c = line.requests[0];
for (const at of times.split(',').map(Number)) {
    const t0 = Date.now();
    const req = restoreRequest(atSeamTime(c.request, at));
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
    if (!answer.ok) {
        console.log(`SEAM ${at} REFUSED ${createHash('sha1').update(answer.message ?? '').digest('hex').slice(0, 12)} ${(answer.message ?? '').slice(0, Number(process.env.MSGLEN ?? 200))} (${Date.now() - t0} ms)`);
        continue;
    }
    const sol = answer.plan.solution.map((k) => [...k]);
    const h = createHash('sha1').update(JSON.stringify(sol)).digest('hex').slice(0, 12);
    const st = buildStagedTape({ staging: { ...tape.staging, inventory_slots: undefined }, perTick: sol.map((k) => new Set(k)), name: 's' });
    const res = runTape(parseTape(st), { levelSource: atlasLevelSource() });
    const hits = (res.playerHits ?? []).map((h) => `t${h.t ?? h.tick}(${JSON.stringify(h).slice(0, 160)})`);
    console.log(`SEAM ${at} SOLVED ${sol.length} t plan ${h} model hits ${hits.length} [${hits.join(' ')}] (${Date.now() - t0} ms)`);
}
