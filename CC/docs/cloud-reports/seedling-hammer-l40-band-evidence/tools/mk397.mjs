// LB D1 — a REBUILT 397 request (no page capture exists): 414's captured request (same page sweep, same delivered
// set, same items and save) re-staged at 397's arrival, boot (40,480,896) from L39 (its row's `arrive`), at seam time
// --seam (default 5129, the seam fidelity's census captured for 397), with the `live` digest the model computes for
// that staging. Both of 414's requests (i 0: 640 units, i 1: 2560) are rebuilt. ⚠ 397's own page capture would carry
// its own rng seed and seam; this rebuild keeps 414's (`rng.seed` drives only the cosmetic stream here).
//   node mk397.mjs [--seam=5129] > requests-397-rebuilt.jsonl
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (n, f = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { restoreRequest } = await import(join(REPO, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await import(join(M, 'atlasSource.js'));
const { replayTape, liveOf } = await import(join(M, 'jsRuntimeSolver.js'));
const src = join(REPO, 'CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/input/requests-414.jsonl');
const line = JSON.parse(readFileSync(src, 'utf8').split('\n')[0]);
const seam = Number(arg('seam', '5129'));
const requests = line.requests.map((r) => {
    const staging = { ...r.request.staging, boot: { level: 40, x: 480, y: 896 },
        seam: { ...r.request.staging.seam, time: seam } };
    const req = restoreRequest({ ...r.request, staging });
    const shadow = replayTape({ staging: req.staging, perTick: [], levelSource: levelSourceFromAtlas(req.source.records),
        scratchPersistence: req.scratchPersistence, equips: req.equips });
    return { i: r.i, request: { ...r.request, staging, live: liveOf(shadow) }, passes: null, result: null };
});
console.log(JSON.stringify({ id: 397, key: 'level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest',
    rebuiltFrom: 414, requests }));
