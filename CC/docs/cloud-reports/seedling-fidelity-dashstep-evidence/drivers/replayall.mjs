// usage: node replayall.mjs <repoRoot> <requests.jsonl> <out.jsonl> — every captured request, this process's switches
import { readFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [root, file, out] = process.argv.slice(2);
const { restoreRequest } = await import(`${root}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${root}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${root}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const leg = JSON.parse(line);
    for (const cap of leg.requests) {
        const req = restoreRequest(cap.request);
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        let row;
        try {
            const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
            const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
            row = { id: leg.id, key: leg.key, i: cap.i, ok: a.ok, kind: a.kind ?? null, ticks: a.ok ? a.plan.solution.length : null,
                answer: createHash('sha1').update(text).digest('hex').slice(0, 12), msg: a.ok ? null : text.slice(0, 160) };
        } catch (e) { row = { id: leg.id, key: leg.key, i: cap.i, error: String(e.message).slice(0, 200) }; }
        appendFileSync(out, `${JSON.stringify(row)}\n`);
    }
}
