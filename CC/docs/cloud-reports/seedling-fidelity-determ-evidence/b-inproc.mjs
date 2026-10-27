// in-process replay: N solves of each captured L82 request in ONE process; answer sha + plan keys.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { restoreRequest } from '/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/atlasSource.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { solveAnytime, ANYTIME_PASSES } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const N = Number(process.argv[3] ?? 8);
const useAtlas = process.argv[4] === 'atlas';
for (const line of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
    const leg = JSON.parse(line);
    for (const cap of leg.requests) {
        const req = restoreRequest(cap.request);
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        const levelSource = useAtlas ? atlasLevelSource() : levelSourceFromAtlas(source.records);
        const seen = new Map();
        for (let i = 0; i < N; i += 1) {
            const a = solveAnytime({ ...tape, source, levelSource }, { passes });
            const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message);
            const k = `${sha(text)} work=${a.work} ticks=${a.ok ? a.plan.solution.length : '-'}`;
            seen.set(k, (seen.get(k) ?? 0) + 1);
            if (i === 0 && process.env.KEYS) console.log(Object.keys(a), a.plan && Object.keys(a.plan));
        }
        console.log(`INPROC leg ${leg.id} i=${cap.i} seam=${req.staging.seam.time}: ${[...seen].map(([k, n]) => `${k} ×${n}`).join(' | ')}`);
    }
}
