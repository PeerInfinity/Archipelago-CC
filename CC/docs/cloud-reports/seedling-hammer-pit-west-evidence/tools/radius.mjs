// scratch (PIT-WEST): each captured request of a sweep (--requests, `--capture-requests` jsonl) solved as the page asks
// it (its passes, its captured budget), under one arm (--arm=OFF|CUT|DVB|BOTH); one JSON line per request: verdict, work,
// plan digest, ticks, the switches' instruments (CHOOSER_CUT asked/admitted, DETOUR_VIA_BOUND bounded). Measure only.
// Usage: node radius.mjs --requests=<jsonl> --arm=<arm> [--ids=a,b] [--shard=i/n] --out=<jsonl>
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const SB = await import(M + 'solverBot.js');
const arm = args.arm ?? 'OFF';
const ids = args.ids ? new Set(args.ids.split(',')) : null;
const [si, sn] = (args.shard ?? '0/1').split('/').map(Number);
let n = 0;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (ids && !ids.has(String(row.id))) continue;
    if ((n++ % sn) !== si) continue;
    for (const c of row.requests) {
        const { passes = JR.ANYTIME_PASSES, source, ...tape } = restoreRequest(c.request);
        SB.resetChooserCutCounts();
        const b0 = SB.DETOUR_VIA_BOUND.counts.bounded;
        const t0 = Date.now();
        const a = SB.withChooserCut(arm === 'CUT' || arm === 'BOTH', () => SB.withDetourViaBound(arm === 'DVB' || arm === 'BOTH',
            () => JR.solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes })));
        const out = { id: row.id, i: c.i, key: row.key, arm, budget: tape.budgetWork ?? null, ok: a.ok, work: a.work ?? null,
            ticks: a.ok ? a.plan.solution.length : null, verbs: a.ok ? a.plan.verbs : null,
            digest: createHash('md5').update(a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message)).digest('hex').slice(0, 12),
            deadline: !a.ok && /anytime deadline/.test(String(a.message)),
            cut: { asked: SB.CHOOSER_CUT_COUNTS.asked, admitted: SB.CHOOSER_CUT_COUNTS.admitted, cuts: SB.CHOOSER_CUT_COUNTS.cuts.map((x) => x.set.join('+')).slice(0, 3), refused: SB.CHOOSER_CUT_COUNTS.refused.map((x) => x.why).slice(0, 3) },
            bounded: SB.DETOUR_VIA_BOUND.counts.bounded - b0, ms: Date.now() - t0,
            head: a.ok ? null : String(a.message).slice(0, 300) };
        appendFileSync(args.out, JSON.stringify(out) + '\n');
        console.log(row.id, c.i, arm, out.ok, out.work, out.digest, out.cut.asked, out.bounded, out.ms);
    }
}
