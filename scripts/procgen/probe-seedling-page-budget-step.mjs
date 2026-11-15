#!/usr/bin/env node
/**
 * Measure-only — SOLVE A COMMITTED BOOT FIXTURE UNDER THE PAGE'S WORK BUDGET, in node: the page's own `solveAnytime`
 * request at `SOLVER_BUDGET_WORK` (640) with the upgrade window, then — when the answer is a refusal cut at its budget
 * with a pass left unanswered (`wasmPlayback.expiryAction` = 'retry') — the ONE held retry at
 * `SOLVE_RETRY_BUDGET_FACTOR`× (2560), resuming the unanswered passes (`passesAfter`), as the page does. The plan, if
 * any, is re-driven on a fresh run of the staging: ticks, hits, deaths, the level it ends in, the arm's counts.
 *
 * `--dump-plan=<json>` writes the plan's keys (`+`-joined per tick) and equips, for a row to replay.
 * `--work-sites` also prints where the units went: the site names the work clock was asked at, per attempt.
 *
 * Run: node scripts/procgen/probe-seedling-page-budget-step.mjs --fixture=<boot.json> --exit=X,Y [--budget=640] [--work-sites] [--dump-plan=<json>] [--json]
 */
import { readFileSync } from 'node:fs';
import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const arg = (name, dflt = null) => {
    const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
    if (!a) return dflt;
    return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

const M = '../../frontend/modules/seedlingDemo/';
const { levelSourceFromAtlas } = await import(`${M}atlasSource.js`);
const { patchedMapDocument } = await import(`${M}seedlingSetPatches.js`);
const { parseTape } = await import(`${M}tapeFormat.js`);
const { solveStaging, stagingFromTape } = await import(`${M}tapeRunner.js`);
const J = await import(`${M}jsRuntimeSolver.js`);
const { expiryAction, SOLVE_RETRY_BUDGET_FACTOR } = await import(`${M}wasmPlayback.js`);
const SB = await import(`${M}solverBot.js`);
const { withSolveProgress } = await import(`${M}solveProgress.js`);

const fixture = arg('fixture');
const [ex, ey] = String(arg('exit')).split(',').map(Number);
const budget = Number(arg('budget', J.SOLVER_BUDGET_WORK));
const sites = arg('work-sites') === true;
const source = levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync(
    new URL('../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url), 'utf8'))));
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(fixture, 'utf8'))));
const shadow = J.replayTape({ staging, perTick: [], levelSource: source });
const tape = { staging, perTick: [], live: J.liveOf(shadow), levelSource: source, name: 'page-budget-step',
    solverGoal: { kind: 'reach-exit', exit: { x: ex, y: ey } }, scratchPersistence: shadow.scratchPersistence === true };

let tick = 0;
const clock = () => tick++;
const attempt = (b, passes) => {
    const counts = new Map();
    const said = [];
    const onPass = (one) => said.push({ pass: one.pass, ok: one.ok, ticks: one.ok ? one.plan.solution.length : null,
        message: one.ok ? null : String(one.message ?? '').split('\n')[0].slice(0, 600) });
    const solve = () => J.solveAnytime({ ...tape, budgetWork: b, upgradeWindowWork: J.SOLVER_UPGRADE_WINDOW_WORK },
        { passes, clock, onPass });
    const answer = sites ? withSolveProgress((site) => counts.set(site, (counts.get(site) ?? 0) + 1), solve) : solve();
    return { answer, counts, said };
};
SB.resetBodyFamilyKillCounts();
const t0 = Date.now();
const rows = [];
let { answer, counts, said } = attempt(budget, J.ANYTIME_PASSES);
rows.push({ budget, passes: answer.passes, work: answer.work, ok: answer.ok, counts, said });
let retries = 0;
for (;;) {
    const cut = J.budgetCut(answer);
    const act = !cut ? 'answered' : expiryAction({ provisional: answer.ok ? answer : null, retries, unanswered: !answer.ok });
    if (act !== 'retry') break;
    retries += 1;
    const answered = (answer.passes ?? []).filter((r) => r.limit !== 'budget').length;
    ({ answer, counts, said } = attempt(budget * SOLVE_RETRY_BUDGET_FACTOR ** retries, J.passesAfter(J.ANYTIME_PASSES, answered)));
    rows.push({ budget: budget * SOLVE_RETRY_BUDGET_FACTOR ** retries, passes: answer.passes, work: answer.work, ok: answer.ok, counts, said });
}
const out = { fixture, exit: [ex, ey], ms: Date.now() - t0, attempts: rows.map((r) => ({ budget: r.budget, ok: r.ok, work: r.work,
    passes: r.passes, said: r.said, ...(sites ? { sites: Object.fromEntries([...r.counts].sort((a, b) => b[1] - a[1]).slice(0, 25)) } : {}) })),
    arm: { asked: SB.BODY_FAMILY_KILL_COUNTS.asked, kills: SB.BODY_FAMILY_KILL_COUNTS.kills,
        refused: SB.BODY_FAMILY_KILL_COUNTS.refused.map((r) => ({ t: r.t, why: r.why.slice(0, 400) })) } };
if (answer.ok) {
    const p = answer.plan;
    const run = J.replayTape({ staging, perTick: [], levelSource: source });
    const h0 = run.playerHits.length;
    for (let k = 0; k < p.solution.length; k += 1) {
        const slot = p.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(p.solution[k]);
    }
    if (arg('dump-plan')) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(arg('dump-plan'), JSON.stringify({ exit: [ex, ey], pass: p.pass,
            keys: p.solution.map((k) => [...k].sort().join('+')), equips: [...(p.equipsAt ?? new Map())] }));
    }
    out.plan = { ticks: p.solution.length, pass: p.pass, verbs: p.verbs, hits: run.playerHits.length - h0,
        deaths: run.playerDeaths.length, level: run.level };
} else {
    out.refusal = { kind: answer.kind, message: String(answer.message ?? '').slice(0, 1500) };
}
console.log(arg('json') ? JSON.stringify(out) : JSON.stringify(out, null, 1));
