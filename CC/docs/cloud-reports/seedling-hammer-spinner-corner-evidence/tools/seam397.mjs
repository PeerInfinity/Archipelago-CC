// SPINNER-CORNER — leg (key) `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` (BOBIFRAME's 397): its
// captured request re-stamped to one arrival clock, solved by the worker's dispatch (`solveAnytime`) at the shipped
// defaults with `HAMMER_BODY_GATE` OFF and ON; each plan replayed on a fresh run and its player hits counted.
// Usage: node seam397.mjs --seam=5241   → one JSON line {seam, off: {...}, on: {...}}
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const REQ = new URL('../../seedling-fidelity-bobiframe-evidence/captured-request-397-seam5247.jsonl.gz', import.meta.url);
const SB = await import(M + 'solverBot.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const seam = Number(process.argv.find((a) => a.startsWith('--seam='))?.slice(7) ?? 5241);
const row = JSON.parse(gunzipSync(readFileSync(REQ)).toString('utf8').trim().split('\n')[0]);
const c0 = row.requests[0].request;
const out = { key: row.key, seam };
for (const on of [false, true]) {
    const { passes = JR.ANYTIME_PASSES, source, ...tape } = restoreRequest({ ...c0,
        staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
    const levelSource = levelSourceFromAtlas(source.records);
    for (const k of Object.keys(SB.HAMMER_BODY_GATE_COUNTS)) SB.HAMMER_BODY_GATE_COUNTS[k] = 0;
    const t0 = Date.now();
    const ans = SB.withHammerBodyGate(on, () => JR.solveAnytime({ ...tape, levelSource }, { passes }));
    const r = { ok: ans.ok, ms: Date.now() - t0, work: ans.work ?? null,
        counts: { ...SB.HAMMER_BODY_GATE_COUNTS },
        passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}`) };
    if (ans.ok) {
        const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const h0 = run.playerHits.length;
        for (let k = 0; k < ans.plan.solution.length; k += 1) {
            const slot = ans.plan.equipsAt?.get?.(k);
            if (slot !== undefined) run.equipNow(slot);
            run.advance(ans.plan.solution[k]);
        }
        Object.assign(r, { ticks: ans.plan.solution.length, verbs: ans.plan.verbs,
            sha: createHash('sha256').update(JSON.stringify(ans.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
            hits: run.playerHits.slice(h0).map((h) => `${h.t}:${h.id}`), deaths: run.playerDeaths.length });
    } else {
        r.message = String(ans.message ?? '').split('\n')[0].slice(0, 400);
    }
    out[on ? 'on' : 'off'] = r;
}
console.log(JSON.stringify(out));
