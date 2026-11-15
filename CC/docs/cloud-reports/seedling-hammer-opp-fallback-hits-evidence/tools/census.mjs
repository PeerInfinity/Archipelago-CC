// Census: every captured request of the given requests-*.jsonl files replayed in node (the worker's dispatch, the
// request's own budgets), OPP_FALLBACK_HITS.census = true (audits, adopts as today) unless argv mode 'on'.
// argv: <out.jsonl> <mode off|on> <file...>   [env ONLY_KEYS=json array of leg keys]
import { appendFileSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC/';
const [out, mode, ...files] = process.argv.slice(2);
const only = process.env.ONLY_KEYS ? new Set(JSON.parse(process.env.ONLY_KEYS)) : null;
const onlyReq = process.env.ONLY_REQ ?? null; // 'id:i'
const uncapped = process.env.UNCAPPED === '1';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const OPF = await import(R + 'frontend/modules/seedlingDemo/oppPressFallback.js');
const OFH = await import(R + 'frontend/modules/seedlingDemo/oppFallbackHits.js');
OFH.OPP_FALLBACK_HITS.census = mode !== 'on';
OFH.OPP_FALLBACK_HITS.enabled = mode === 'on';
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
for (const file of files) {
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
        if (!line.trim()) continue;
        const leg = JSON.parse(line);
        if (only && !only.has(leg.key)) continue;
        for (const q of leg.requests) {
            if (onlyReq !== null && `${leg.id}:${q.i}` !== onlyReq) continue;
            OPF.resetOppPressFallbackCounts(); OFH.resetOppFallbackHitsCounts();
            const t0 = Date.now();
            let row;
            try {
                const { passes = ANYTIME_PASSES, source, ...tape0 } = restoreRequest(q.request);
                const tape = { ...tape0 };
                if (uncapped) { delete tape.budgetWork; delete tape.upgradeWindowWork; }
                const levelSource = levelSourceFromAtlas(source.records);
                const a = solveAnytime({ ...tape, source, levelSource }, { passes });
                let planHits = null;
                if (a.ok && OFH.OPP_FALLBACK_HITS_COUNTS.hit > 0) {
                    // the answer's own plan replayed from the request's tape: does the SOLVE carry hits?
                    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
                        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
                    const h0 = run.playerHits.length;
                    for (let k = 0; k < a.plan.solution.length; k += 1) { const slot = a.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot); run.advance(a.plan.solution[k]); }
                    planHits = run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]);
                }
                const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
                row = { id: leg.id, key: leg.key, i: q.i, uncapped, ok: a.ok, kind: a.kind ?? null, work: a.work ?? null,
                    ticks: a.ok ? a.plan.solution.length : null, answer: sha(text), msg: a.ok ? null : text.slice(0, 200),
                    opf: { ...OPF.OPP_PRESS_FALLBACK_COUNTS },
                    ofh: { audited: OFH.OPP_FALLBACK_HITS_COUNTS.audited, hit: OFH.OPP_FALLBACK_HITS_COUNTS.hit, refused: OFH.OPP_FALLBACK_HITS_COUNTS.refused },
                    rows: OFH.OPP_FALLBACK_HITS_COUNTS.rows, planHits,
                    page: { ok: q.result?.ok ?? null, kind: q.result?.kind ?? null, work: q.result?.work ?? null } };
            } catch (e) {
                row = { id: leg.id, key: leg.key, i: q.i, ok: false, kind: 'THREW', msg: String(e?.message ?? e).slice(0, 300),
                    opf: { ...OPF.OPP_PRESS_FALLBACK_COUNTS }, rows: OFH.OPP_FALLBACK_HITS_COUNTS.rows };
            }
            row.ms = Date.now() - t0;
            appendFileSync(out, JSON.stringify(row) + '\n');
        }
    }
}
console.log('DONE', out);
