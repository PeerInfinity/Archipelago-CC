// scratch (L40BK2 D2): drive a captured plan in the model; from tick T0 compare spinnerFightForecast's rows (advanced with
// the driven player's pre-move point and its presses) against the live spinner rects after each advance.
import { readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const P = REPO + '/scripts/procgen/';
const M = REPO + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(P + 'seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(P + 'replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(M + 'jsRuntimeSolver.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { buildStagedTape } = await import(M + 'botDriverV1.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const [file, id, at, t0s, t1s] = process.argv.slice(2);
const line = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((l) => l.id === +id);
const req = restoreRequest(atSeamTime(line.requests[0].request, +at));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const sol = answer.plan.solution.map((k) => new Set(k));
const st = buildStagedTape({ staging: { ...tape.staging, inventory_slots: undefined }, perTick: sol, name: 's' });
const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(st))));
const run = createRunForStaging(staging, atlasLevelSource());
const T0 = +t0s, T1 = +t1s;
let cur = null; let worst = 0; let worstAt = null;
for (let t = 0; t < Math.min(sol.length, T1); t += 1) {
    if (t === T0) cur = run.spinnerFightForecast();
    const held = sol[t];
    const pressed = held.has('primary') && !(t > 0 && sol[t - 1].has('primary'));
    const pt = { x: run.state.x, y: run.state.y };
    const dir = run.state.direction ?? 0;
    if (cur) cur.advance(pt, pressed ? { direction: dir } : null);
    run.advance(held);
    if (cur) {
        const i = cur.rows.length - 1;
        const live = run.entities('spinnerBodies') ?? [];
        const ids = cur.bodies[i].map((b) => b.id);
        let d = 0;
        for (const b of live) {
            const j = ids.indexOf(b.id); if (j < 0) continue;
            const r = cur.rows[i][j];
            const lx = b.x - 3.5, ly = b.y - 3.5; // rect = entity point - origin? compare via centres below
            d = Math.max(d, Math.hypot((r.x + (r.right - r.x) / 2) - b.x, (r.y + (r.bottom - r.y) / 2) - b.y));
        }
        if (t < T0 + 3 || pressed || d > worst + 1e-9) console.log(`t${t} pressed=${pressed} dir=${dir} worst-body-dist ${d.toFixed(3)} hits ${run.playerHits.length}`);
        if (d > worst) { worst = d; worstAt = t; }
    }
}
console.log('worst', worst, 'at', worstAt);
