// scratch (SPIN, copied from L40C`s tools/arms.mjs; L40C from LWEIGH's radius.mjs): replay EVERY captured request of --requests=<jsonl> at its own seam, in this
// process, under the env's switches. One jsonl row per request: the verdict, the ticks, the refusal's head and its first
// named body/tick, and for a SOLVED plan the 30(c) check — the plan's keys replayed on a FRESH run from the request's
// staging must reproduce the plan's own expected rows (level, x, y, deaths) tick for tick, with no new hit or death.
// Decides nothing. Usage: node arms.mjs --requests=<jsonl> --out=<jsonl> [--shard=i/n] [--ids=a,b] [--i=K]
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
const { CONTACT_FIDELITY } = await import(ROOT + '/frontend/modules/seedlingDemo/contactFidelity.js');
const PK = await import(ROOT + '/frontend/modules/seedlingDemo/pressKillCost.js');
const [shard, nshard] = (args.shard ?? '0/1').split('/').map(Number);
const ids = args.ids ? new Set(args.ids.split(',')) : null;
const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 12);
const arm = { cpair: SB.CHOOSER_PAIR?.enabled ? SB.CHOOSER_PAIR.size : 0, icest: !!SB.ICETURRET_STATIC_KILL?.enabled,
    opp: !!PK.OPPORTUNISTIC_STRIKE?.enabled, lwf: !!SB.LATCH_WEIGH_FIRST?.enabled,
    ofa: !!CONTACT_FIDELITY.orbitFreeAim, sbd: !!CONTACT_FIDELITY.strategyBoundDistinct };
console.log('ARM', JSON.stringify(arm));
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
const same = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;

/** 30(c): the plan's keys on a fresh run from the request's staging, row by row against the plan's expected. */
function modelled(tape, levelSource, plan) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const hits0 = run.playerHits.length;
    const deaths0 = run.playerDeaths.length;
    if (!same(rowOf(run), plan.expected[0])) return { gm: false, at: -1, why: 'prefix row differs' };
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected[k + 1];
        if (want && !same(rowOf(run), want)) return { gm: false, at: k, why: `row ${JSON.stringify(rowOf(run))} != ${JSON.stringify(want)}` };
    }
    const hits = run.playerHits.slice(hits0).map((h) => ({ t: h.t, source: h.source, id: h.id }));
    return { gm: run.playerDeaths.length === deaths0, hits, deaths: run.playerDeaths.length - deaths0 };
}

let rowN = -1;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    rowN += 1;
    if (rowN % nshard !== shard) continue;
    if (ids && !ids.has(String(row.id))) continue;
    for (const c of row.requests ?? []) {
        if (args.i !== undefined && String(c.i) !== String(args.i)) continue;
        const req = restoreRequest(c.request);
        const { passes = ANYTIME_PASSES, source, ...tape } = req;
        // SCRATCH: L40C_BUDGET_WORK=<units> raises the request's anytime budget (the deadline arm); unset = as captured.
        if (process.env.L40C_BUDGET_WORK) tape.budgetWork = Number(process.env.L40C_BUDGET_WORK);
        // SCRATCH (SPIN): SPIN_SEAM=<Game.time> re-stamps the request's seam clock (the hammer phase a capture lands on is
        // the page's wall clock, so L40C's 5950 and this capture's 5102 are different phases of one leg); unset = as captured.
        if (process.env.SPIN_SEAM) tape.staging = { ...tape.staging, seam: { ...tape.staging.seam, time: Number(process.env.SPIN_SEAM) } };
        SB.resetIceTurretStaticKillCounts?.();
        SB.resetLatchWeighFirstCounts?.();
        SB.resetChooserPairCounts?.();
        const levelSource = levelSourceFromAtlas(source.records);
        const t0 = Date.now();
        let answer;
        try {
            answer = solveAnytime({ ...tape, source, levelSource }, { passes });
        } catch (e) { answer = { ok: false, kind: 'THREW', message: String(e?.message ?? e) }; }
        const ms = Date.now() - t0;
        const msg = answer.ok ? null : String(answer.message ?? '');
        const plan = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : null;
        let gm = null;
        if (answer.ok) {
            try { gm = modelled(tape, levelSourceFromAtlas(source.records), answer.plan); } catch (e) { gm = { gm: false, why: `THREW ${e?.message ?? e}` }; }
        }
        const out = { id: row.id, key: row.key, i: c.i, seam: tape.staging?.seam?.time, arm, ok: answer.ok,
            kind: answer.kind ?? null, work: answer.work ?? null, ticks: answer.ok ? answer.plan.solution.length : null,
            digest: md5(answer.ok ? plan : msg), ms, head: msg ? msg.slice(0, 6000) : null, gm,
            verbs: answer.ok ? answer.plan.verbs : null,
            obstacle: answer.obstacle ?? null,
            danger: msg ? (/passes through danger at \(([^)]*)\) — ([a-z]+:[A-Za-z0-9@,]+)/.exec(msg)?.slice(1).join(' ') ?? null) : null,
            icest: SB.ICETURRET_STATIC_KILL_COUNTS ? JSON.parse(JSON.stringify(SB.ICETURRET_STATIC_KILL_COUNTS)) : null,
            lwf: SB.LATCH_WEIGH_FIRST_COUNTS ? JSON.parse(JSON.stringify(SB.LATCH_WEIGH_FIRST_COUNTS.asked)) : null,
            cpair: SB.CHOOSER_PAIR_COUNTS ? { admitted: SB.CHOOSER_PAIR_COUNTS.admitted } : null };
        appendFileSync(args.out, JSON.stringify(out) + '\n');
        console.log(`${row.id}/${c.i} ${out.ok ? `SOLVED ${out.ticks} gm=${gm?.gm}` : `REFUSED ${out.kind}`} ${out.digest} ${ms}ms`);
    }
}
