// KILL880: the space-time search's mid-line arm. A line's keys (--keys=<json>, e.g. the refused pass's own line that
// `line.mjs --grab` wrote) cut at tick --at=T, then W idle ticks (no keys; --waits=a,b,c), then the segment solved again
// from there (solveFromTape, --dash, a never-true deadline hook with fine checkpoints). Each solve's plan is replayed on a
// fresh run from boot and its hits counted (the prefix's included). One JSON line per (T, W).
//   node mid.mjs --req=<file.json.gz> --keys=<json> --at=527,630 --waits=0,50,100 [--seam=<clock>] [--dash=none]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { source, budgetWork, upgradeWindowWork, passes, ...tape } = restoreRequest({ ...c0,
    staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const levelSource = levelSourceFromAtlas(source.records);
const base = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null };
const line = JSON.parse(readFileSync(arg('keys'), 'utf8')).map((k) => new Set(k));
const dash = arg('dash', 'none');
for (const T of arg('at').split(',').map(Number)) {
    for (const W of arg('waits', '0').split(',').map(Number)) {
        const perTick = [...line.slice(0, T), ...Array.from({ length: W }, () => new Set())];
        const pre = JR.replayTape({ ...base, perTick });
        const r = { at: T, wait: W, seam, dash, preHits: (pre.ledger('playerHits') ?? []).length, prePos: [+pre.state.x.toFixed(1), +pre.state.y.toFixed(1)] };
        if (r.preHits > 0) { console.log(JSON.stringify({ ...r, ok: false, why: 'the prefix + idle is hit' })); continue; }
        const t0 = Date.now();
        try {
            const plan = JR.solveFromTape({ ...tape, perTick, live: JR.liveOf(pre), levelSource, dashMode: dash, shouldStop: () => false, fineCheckpoints: true });
            const run = JR.replayTape({ ...base, perTick });
            for (let k = 0; k < plan.solution.length; k += 1) {
                const slot = plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
                run.advance(plan.solution[k]);
            }
            const all = [...perTick, ...plan.solution].map((s) => [...s]);
            Object.assign(r, { ok: true, ms: Date.now() - t0, ticks: plan.solution.length, total: all.length, verbs: plan.verbs,
                hits: (run.ledger('playerHits') ?? []).map((h) => `${h.t}:${h.id}`), deaths: (run.ledger('playerDeaths') ?? []).length,
                end: [run.level, +run.state.x.toFixed(2), +run.state.y.toFixed(2)],
                sha: createHash('sha256').update(JSON.stringify(all)).digest('hex').slice(0, 12) });
        } catch (e) {
            Object.assign(r, { ok: false, ms: Date.now() - t0, why: String(e?.message ?? e).slice(0, Number(arg("whylen", 400))) });
        }
        console.log(JSON.stringify(r));
    }
}
