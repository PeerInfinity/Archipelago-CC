// FEWER-HITS scratch instrument (measure only): replay one captured request, then the same request with k idle ticks
// appended to its tape (the player stands still k ticks first) for k in --ks, and print each pass's plan with the
// model's hits/deaths on the plan's own ticks AND on the k idle ticks.
// Usage: node phase.mjs --requests=<jsonl> --id=N --i=K [--ks=0..40] [--root=<repo>]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? process.cwd();
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JR = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const row = readFileSync(args.requests, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === String(args.id));
const cap = row.requests.find((c) => String(c.i) === String(args.i ?? 0));
const req = restoreRequest(cap.request);
const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const [a, b] = (args.ks ?? '0..20').split('..').map(Number);
const rp = (perTick) => JR.replayTape({ staging: tape.staging, perTick, levelSource, scratchPersistence: tape.scratchPersistence, equips: tape.equips, holds: tape.holds });
const base = rp(tape.perTick);
const h0 = base.ledger('playerHits').length;
for (let k = a; k <= b; k += 1) {
    const perTick = [...tape.perTick, ...Array.from({ length: k }, () => new Set())];
    const sh = rp(perTick);
    const idleHits = sh.ledger('playerHits').length - h0;
    const t0 = Date.now();
    const res = JR.withHitAwareAnswer(true, () => JR.solveAnytime({ ...tape, perTick, live: JR.liveOf(sh), source, levelSource }, { passes }));
    console.log(JSON.stringify({ id: row.id, i: cap.i, k, idleHits, ms: Date.now() - t0, ok: res.ok,
        shipped: res.ok ? { pass: res.plan.pass, ticks: res.plan.solution.length + k, modelHits: res.plan.modelHits } : String(res.message).slice(0, 120),
        passes: res.passes.map((p) => [p.pass, p.ok, p.ticks, p.work, p.modelHits ? `${p.modelHits.hits}h${p.modelHits.deaths}d` : null]) }));
}
