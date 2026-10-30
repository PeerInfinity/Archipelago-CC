// scratch (LWEIGH, from ICEST's radius.mjs; adds the weigh/hold trace and a shard): replay EVERY captured request of --requests=<jsonl> (each at its own seam, or at seam+d with
// --d=), in this process, under the env's switches; one jsonl row per request: the answer's digest and the ICEST/CPAIR
// instruments. Usage: node radius.mjs --root=<tree> --requests=<jsonl> --out=<jsonl> [--ids=853,854] [--d=-3..3] [--passes=N]
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(ROOT + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
let LW = [];
const _log = console.log;
console.log = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('LWTRACE')) { LW.push(a.join(' ')); return; } _log(...a); };
const [shard, nshard] = (args.shard ?? '0/1').split('/').map(Number);
let rowN = -1;
const ids = args.ids ? new Set(args.ids.split(',')) : null;
const [d0, d1] = (args.d ?? '0..0').split('..').map(Number);
const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 12);
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    rowN += 1;
    if (rowN % nshard !== shard) continue;
    if (ids && !ids.has(String(row.id))) continue;
    for (const c of row.requests ?? []) {
        if (args.i !== undefined && String(c.i) !== String(args.i)) continue;
        for (let d = d0; d <= d1; d += 1) {
            const captured = d ? atSeamTime(c.request, c.request.staging.seam.time + d) : c.request;
            const req = restoreRequest(captured);
            const { passes = ANYTIME_PASSES, source, ...tape } = req;
            SB.resetIceTurretStaticKillCounts?.();
            SB.resetLatchWeighFirstCounts?.();
            LW = [];
            SB.resetChooserPairCounts?.();
            const t0 = Date.now();
            let answer;
            try {
                answer = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) },
                    { passes: args.passes ? passes.slice(0, Number(args.passes)) : passes });
            } catch (e) { answer = { ok: false, kind: 'THREW', message: String(e?.message ?? e) }; }
            const msg = answer.ok ? null : String(answer.message ?? '');
            const plan = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : null;
            const out = { id: row.id, key: row.key, i: c.i, d, seam: captured.staging?.seam?.time, ok: answer.ok,
                kind: answer.kind ?? null, work: answer.work ?? null, ticks: answer.ok ? answer.plan.solution.length : null,
                digest: md5(answer.ok ? plan : msg), ms: Date.now() - t0,
                head: msg ? msg.slice(0, 300) : null,
                obstacle: msg ? (/passes through danger at \(([^)]*)\) — ([a-z]+:[A-Za-z0-9@,]+)/.exec(msg)?.slice(1).join(' ') ?? null) : null,
                icest: SB.ICETURRET_STATIC_KILL_COUNTS ? JSON.parse(JSON.stringify(SB.ICETURRET_STATIC_KILL_COUNTS)) : null,
                lwf: SB.LATCH_WEIGH_FIRST_COUNTS ? JSON.parse(JSON.stringify(SB.LATCH_WEIGH_FIRST_COUNTS.asked)) : null,
                trace: [...new Set(LW.filter((l) => /448,432/.test(l)).map((l) => l.replace(/"t":\d+,/, '').replace(/"at":\[[^\]]*\],/, '')))],
                holdChain: msg ? /hold stance \(wandlock@448,432\)/.test(msg) : (answer.plan?.records ?? []).some((r) => r.strategy === 'hold' && r.presser?.x === 480 && r.presser?.y === 384),
                weighChain: msg ? /weigh stance \(wandlock@448,432\)|weigh \(wandlock@448,432\)/.test(msg) : null,
                cpair: SB.CHOOSER_PAIR_COUNTS ? { admitted: SB.CHOOSER_PAIR_COUNTS.admitted, last: SB.CHOOSER_PAIR_COUNTS.last } : null };
            appendFileSync(args.out, JSON.stringify(out) + '\n');
            _log(`${row.id}/${c.i} d${d} ${out.ok ? `SOLVED ${out.ticks}` : `REFUSED ${out.obstacle ?? out.kind}`} ${out.digest} ${out.ms}ms icest=${JSON.stringify(out.icest?.handed ?? [])}`);
        }
    }
}
