// scratch (DRILL-EXIT-PASS; measure only, decides nothing): every captured page request of `--requests` (the divergence
// sweep's `--capture-requests` jsonl) solved in node by `solveAnytime` exactly as the page's worker asks it (the
// request's own budget, passes and window), under whatever `SEEDLING_*` env this process was started with. A SOLVED
// plan is then played on a FRESH run of the request's staging (30(c): the walk certified is the walk driven), row by
// row against the plan's expected rows, and its hits/deaths counted.
// Usage: [SEEDLING_…=1] node replay.mjs --requests=<jsonl> [--ids=1,2] [--root=<tree>] [--out=<jsonl>] [--arm=<label>]
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JR = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const ids = args.ids ? new Set(args.ids.split(',')) : null;

const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
const same = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;
function fresh(tape, source, plan) {
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length;
    const d0 = run.playerDeaths.length;
    if (plan.expected && !same(rowOf(run), plan.expected[0])) return { same: false, at: -1 };
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected?.[k + 1];
        if (want && !same(rowOf(run), want)) return { same: false, at: k, row: rowOf(run), want };
    }
    return { same: true, hits: run.playerHits.length - h0, deaths: run.playerDeaths.length - d0, level: run.level };
}

for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (ids && !ids.has(String(row.id))) continue;
    for (const c of row.requests) {
        const req = restoreRequest(c.request);
        const { source } = req;
        const t0 = Date.now();
        const answer = JR.solveAnytime({ ...req, levelSource: levelSourceFromAtlas(source.records) });
        const { source: _s, passes: _p, budgetWork: _b, upgradeWindowWork: _w, ...tape } = req;
        let fr = null;
        if (answer.ok) { try { fr = fresh(tape, source, answer.plan); } catch (e) { fr = { threw: String(e?.message ?? e) }; } }
        const msg = answer.ok ? null : String(answer.message ?? '');
        const drillRecs = answer.ok ? JSON.stringify(answer.plan.records ?? answer.plan.trace ?? []).match(/drill-pass[-a-z]*/g) : null;
        const out = {
            id: row.id, i: c.i, key: row.key, arm: args.arm ?? 'D0', ok: answer.ok, kind: answer.kind ?? null,
            ticks: answer.ok ? answer.plan.solution.length : null, work: answer.work ?? null, ms: Date.now() - t0,
            passes: answer.passes, fresh: fr, drillRecs: drillRecs ? [...new Set(drillRecs)] : null,
            digest: createHash('md5').update(answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : msg)
                .digest('hex').slice(0, 12),
            head: msg ? msg.slice(0, 1500) : null,
        };
        if (args.out) appendFileSync(args.out, `${JSON.stringify(out)}\n`);
        console.log(`${row.id}/${c.i} ${out.arm} ${out.ok ? `SOLVED ${out.ticks}t fresh=${JSON.stringify(fr)} drill=${out.drillRecs}`
            : `REFUSED`} work=${out.work} digest=${out.digest} ${msg ? msg.slice(0, 600).replace(/\n/g, ' ') : ''}`);
    }
}
