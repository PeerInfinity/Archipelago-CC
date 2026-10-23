// Replay captured L57 solve requests in node; report the plan's hits and the tentaclebeast record.
// usage: SEEDLING_TENTACLE_HITLESS_FIRST=0|1 node replayhits.mjs <requests.jsonl> [--seam=<from>..<to>] [--i=0]
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { CONTACT_FIDELITY } = await import(R + 'frontend/modules/seedlingDemo/contactFidelity.js');
const file = process.argv[2];
const seamArg = process.argv.find((a) => a.startsWith('--seam='))?.slice(7);
const onlyI = Number(process.argv.find((a) => a.startsWith('--i='))?.slice(4) ?? 0);
const onlyIds = process.argv.find((a) => a.startsWith('--ids='))?.slice(6)?.split(',').map(Number);
const find = (o, pred, seen = new Set()) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return null;
    seen.add(o);
    if (pred(o)) return o;
    for (const v of Object.values(o)) { const r = find(v, pred, seen); if (r) return r; }
    return null;
};
for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const leg = JSON.parse(line);
    if (onlyIds && !onlyIds.includes(leg.id)) continue;
    const c = leg.requests[onlyI];
    if (!c) continue;
    const base = c.request?.staging?.seam?.time ?? restoreRequest(c.request).staging?.seam?.time;
    const times = seamArg ? (() => { const [a, b] = seamArg.split('..').map(Number); return Array.from({ length: b - a + 1 }, (_, k) => a + k); })() : [0];
    for (const d of times) {
        const captured = seamArg ? atSeamTime(c.request, base + d) : c.request;
        const req = restoreRequest(captured);
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        const levelSource = levelSourceFromAtlas(source.records);
        const t0 = Date.now();
        let answer;
        try { answer = solveAnytime({ ...tape, source, levelSource }, { passes }); } catch (e) { answer = { ok: false, message: 'THROW ' + e.message }; }
        const rec = find(answer, (o) => o.verb === 'tentaclebeast' && Array.isArray(o.tried));
        let hitsRow = null;
        if (answer.ok) {
            const run = createRunForStaging(tape.staging, levelSource);
            for (const k of answer.plan.solution) run.advance(k);
            hitsRow = { playerHits: run.ledger('playerHits') ?? [] };
        }
        console.log(JSON.stringify({ id: leg.id, key: leg.key, i: onlyI, seam: base + d, hitless: CONTACT_FIDELITY.tentacleHitlessFirst,
            ok: answer.ok, kind: answer.kind ?? null, ticks: answer.plan?.solution?.length ?? null,
            msg: answer.ok ? null : String(answer.message).slice(0, 200),
            params: rec?.params ?? null, choice: rec?.choice ?? null,
            tried: rec?.tried?.map((t) => `${t.ok ? 'ok' : 'X'}:${t.spent}${t.hits !== undefined ? `/h${t.hits}` : ''}`) ?? null,
            verbs: answer.plan?.verbs ?? null,
            hits: hitsRow ? hitsRow.playerHits.map((h) => `${h.t}:${h.source}`) : null, ms: Date.now() - t0 }));
    }
}
