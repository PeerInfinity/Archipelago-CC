#!/usr/bin/env node
/**
 * Measure-only — DOES A HARD REFUSAL AT THE PAGE'S WORK BUDGET SOLVE AT THE HELD RETRY'S BUDGET? (slice
 * `seedling-hammer-retry-rate`). For each survey step it asks the page's own budgeted solve (`solveAnytime` at
 * `SOLVER_BUDGET_WORK`, the upgrade window, the anytime passes) one goal at a time, from the survey's own boot
 * (`views/step-N-boot.json`, written by `survey-seedling-route.mjs`) and the route's own goals (`route.json`), and
 * classifies the answer the way the page's `expiryAction` wiring does (`flashPanel/seedlingWasmPlayback.js`):
 *   SOLVED      a plan (possibly a provisional one, an earlier pass's, with a later pass cut);
 *   CUT         a refusal cut at its budget with a pass left unanswered → the ONE held retry at
 *               `SOLVE_RETRY_BUDGET_FACTOR`× (passesAfter the answered ones), as the page does;
 *   HARD        a refusal with no pass cut at its budget → no retry today.
 * Every goal that did not SOLVE at the budget is ALSO asked straight at budget × factor (all passes, a fresh
 * attempt), so a HARD verdict's budget-dependence is measured, not reasoned. A goal the page path solves is
 * played onto the prefix (its keys and equips) and the next goal of the step is asked from there, as the page asks
 * the next goal from the live state; the step stops at its first unsolved goal.
 *
 * Each step runs in its OWN process (`--step=N`); `--steps=a,b,c --jobs=4` spawns them. One JSON line per goal on
 * stdout (`##ROW##` prefix in a child), and `--dump-requests=<dir>` writes each asked request
 * (`seedlingSolveRequestCodec.captureRequest`, no levelSource) as `step-N-goal-K.json` for a later replay
 * (`--request=<file>` re-asks one at `--budget`).
 *
 * The world model is the survey's: the patched atlas, delivered as the default preset delivers it, with the AP
 * chests as `apitem`s when `CONTACT_FIDELITY.apChestItem` is on.
 *
 * `--idle=K` plays K empty key sets at the boot before the first goal (a wait, then the same ask).
 * `--steps=66@-20,66@-19,…` asks step 66 with its arrival game clock moved (`staging.seam.time` + d); `--goal=K`
 * stops after goal K (the goals before it still solve, to build its prefix).
 *
 * Run: node scripts/procgen/measure-seedling-hard-refusal-retry.mjs --route=<route.json> --views=<dir> --steps=66,96 [--jobs=4] [--budget=640] [--dump-requests=<dir>] [--out=<jsonl>]
 *      node scripts/procgen/measure-seedling-hard-refusal-retry.mjs --request=<step-N-goal-K.json> [--budget=640] [--work-sites]
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const arg = (name, dflt = null) => {
    const a = process.argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
    if (!a) return dflt;
    return a.includes('=') ? a.slice(a.indexOf('=') + 1) : true;
};

const M = '../../frontend/modules/seedlingDemo/';

/** The survey's world model (`survey-seedling-route.mjs` MODEL_ATLAS, default preset). */
async function modelLevelSource() {
    const { levelSourceFromAtlas } = await import(`${M}atlasSource.js`);
    const { patchedMapDocument } = await import(`${M}seedlingSetPatches.js`);
    const { CONTACT_FIDELITY } = await import(`${M}contactFidelity.js`);
    const { deliveredMapDocument, presetRulesPath, DEFAULT_SURVEY_PRESET } = await import('./surveyPreset.js');
    const repo = fileURLToPath(new URL('../../', import.meta.url));
    const rules = JSON.parse(readFileSync(presetRulesPath(repo, DEFAULT_SURVEY_PRESET), 'utf8'));
    const { doc } = deliveredMapDocument(patchedMapDocument(JSON.parse(readFileSync(
        join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'))), rules);
    const atlas = CONTACT_FIDELITY.apChestItem ? (await import(`${M}apChestDelivery.js`)).deliveredChestDocument(doc) : doc;
    return levelSourceFromAtlas(atlas);
}

/** The survey's goal → solver goal mapping (`survey-seedling-route.mjs`, the `goals` it hands `twoPassSolve`). */
function solverGoalOf(g) {
    if (g.kind === 'reach-pit') return { kind: 'reach-pit', pit: { ...g.pit } };
    if (g.kind === 'encounter') return { kind: 'encounter', at: { ...g.at }, drop: { ...g.drop }, then: g.then };
    if (g.kind === 'reach-exit') return { kind: 'reach-exit', exit: { ...g.exit } };
    if (g.kind === 'clear-tag') {
        return { kind: 'clear-tag', tag: { ...g.tag }, at: { ...g.at },
            ...(g.obstacle ? { obstacle: g.obstacle } : {}), ...(g.presser ? { presser: { ...g.presser } } : {}) };
    }
    return { kind: 'collect-placement', placement: { ...g.placement } };
}

/** Leading passes that gave a final word (`jsRuntimeSolveService`: a refusal cut by its deadline is not answered). */
const answeredOf = (rows) => {
    let n = 0;
    for (const r of rows ?? []) {
        if (r.ok === false && r.deadline) break;
        n += 1;
    }
    return n;
};

const head = (s, n = 400) => String(s ?? '').split('\n')[0].slice(0, n);

async function solveOne(J, request, budget, passes, sites) {
    const { withSolveProgress } = await import(`${M}solveProgress.js`);
    const counts = new Map();
    let tick = 0;
    const solve = () => J.solveAnytime({ ...request, budgetWork: budget, upgradeWindowWork: J.SOLVER_UPGRADE_WINDOW_WORK },
        { passes, clock: () => tick++ });
    const t0 = Date.now();
    const answer = sites ? withSolveProgress((s) => counts.set(s, (counts.get(s) ?? 0) + 1), solve) : solve();
    return { answer, ms: Date.now() - t0, sites: sites ? Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]).slice(0, 15)) : undefined };
}

/** Model hits/deaths a plan adds when replayed on the request's prefix. */
function planHits(J, request, plan) {
    const run = J.replayTape(request);
    const h0 = run.playerHits.length;
    const d0 = run.playerDeaths.length;
    plan.solution.forEach((k, i) => {
        const slot = plan.equipsAt?.get?.(i);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(k);
    });
    return { hits: run.playerHits.length - h0, deaths: run.playerDeaths.length - d0 };
}

const summary = (J, request, { answer, ms, sites }) => ({
    ok: answer.ok === true, kind: answer.kind ?? null, work: answer.work ?? null, ms,
    cut: J.budgetCut(answer), answered: answeredOf(answer.passes),
    passes: (answer.passes ?? []).map(({ ms: _ms, ...r }) => r),
    ...(answer.ok ? { ticks: answer.plan.solution.length, pass: answer.plan.pass, ...planHits(J, request, answer.plan) }
        : { refusal: head(answer.message, 600) }),
    ...(sites ? { sites } : {}),
});

/** The page's path on one request: 640, then the held retry when `expiryAction` says 'retry'. */
async function pagePath(J, request, budget, sites) {
    const { expiryAction, SOLVE_RETRY_BUDGET_FACTOR } = await import(`${M}wasmPlayback.js`);
    const first = await solveOne(J, request, budget, J.ANYTIME_PASSES, sites);
    const a = first.answer;
    const cut = J.budgetCut(a);
    const answered = answeredOf(a.passes);
    const unanswered = answered < J.ANYTIME_PASSES.length;
    const act = !cut ? (a.ok ? 'answered' : 'declined') : expiryAction({ provisional: a, retries: 0, unanswered });
    const verdict = a.ok ? 'SOLVED' : !cut ? 'HARD' : act === 'retry' ? 'CUT' : 'CUT-GIVE-UP';
    let retry = null;
    let final = a;
    if (act === 'retry') {
        const r = await solveOne(J, request, budget * SOLVE_RETRY_BUDGET_FACTOR, J.passesAfter(J.ANYTIME_PASSES, answered), sites);
        retry = summary(J, request, r);
        final = J.betterAnswer(a, r.answer) ? r.answer : a;
    }
    return { verdict, first: summary(J, request, first), retry, final };
}

async function runStep(spec) {
    // `N` or `N@d`: step N, its boot's arrival game clock moved by d (`staging.seam.time` only — the census's
    // `atSeamTime`: the model derives every mobile's phase from that clock), so one goal is asked at many arrivals.
    const [stepId, dRaw] = String(spec).split('@');
    const seamOffset = dRaw === undefined ? 0 : Number(dRaw);
    const J = await import(`${M}jsRuntimeSolver.js`);
    const { parseTape } = await import(`${M}tapeFormat.js`);
    const { solveStaging, stagingFromTape } = await import(`${M}tapeRunner.js`);
    const { SOLVE_RETRY_BUDGET_FACTOR } = await import(`${M}wasmPlayback.js`);
    const { captureRequest } = await import('./seedlingSolveRequestCodec.js');
    const SB = await import(`${M}solverBot.js`);
    const budget = Number(arg('budget', J.SOLVER_BUDGET_WORK));
    const sites = arg('work-sites') === true;
    const route = JSON.parse(readFileSync(arg('route'), 'utf8'));
    const step = route.steps.find((s) => String(s.step) === String(stepId));
    if (!step) throw new Error(`step ${stepId} is not in ${arg('route')}`);
    const levelSource = await modelLevelSource();
    const booted = solveStaging(stagingFromTape(parseTape(readFileSync(join(arg('views'), `step-${stepId}-boot.json`), 'utf8'))));
    const staging = seamOffset === 0 ? booted : { ...booted, seam: { ...booted.seam, time: booted.seam.time + seamOffset } };
    const onlyGoal = arg('goal') === null ? null : Number(arg('goal'));
    const goals = step.goals.filter((g) => g.kind !== 'skip');
    const perTick = [];
    const equips = new Map();
    // `--idle=K`: K empty key sets played at the boot before the first goal is asked (the player stands still while
    // the room's clock and mobiles move) — a WAIT-then-re-ask, measured beside the budget retry.
    const idle = Number(arg('idle', 0));
    for (let i = 0; i < idle; i += 1) perTick.push(new Set());
    const idleHits = idle > 0 ? (() => {
        const r = J.replayTape({ staging, perTick, levelSource });
        return { hits: r.playerHits.length, deaths: r.playerDeaths.length };
    })() : null;
    const dump = arg('dump-requests');
    const scratchPersistence = J.replayTape({ staging, perTick: [], levelSource }).scratchPersistence === true;
    for (let k = 0; k < goals.length; k += 1) {
        const g = goals[k];
        if (onlyGoal !== null && k > onlyGoal) break;
        const shadow = J.replayTape({ staging, perTick, levelSource, scratchPersistence, equips });
        const request = { staging, perTick: [...perTick], equips: new Map(equips), live: J.liveOf(shadow), levelSource,
            scratchPersistence, solverGoal: solverGoalOf(g), name: `retry-rate-step-${stepId}` };
        if (dump) {
            mkdirSync(dump, { recursive: true });
            writeFileSync(join(dump, `step-${stepId}${seamOffset ? `@${seamOffset}` : ''}-goal-${k}.json`), JSON.stringify({ step: stepId, seamOffset, goal: k,
                location: g.location ?? g.why ?? null, request: captureRequest(request) }));
        }
        SB.resetBodyFamilyKillCounts?.();
        const page = await pagePath(J, request, budget, sites);
        const straight = page.verdict === 'SOLVED' ? null
            : summary(J, request, await solveOne(J, request, budget * SOLVE_RETRY_BUDGET_FACTOR, J.ANYTIME_PASSES, sites));
        const row = { step: Number(stepId), seamOffset, seamTime: staging.seam?.time ?? null, level: step.level, goal: k, of: goals.length, location: g.location ?? g.why ?? null,
            kind: g.kind, prefixTicks: perTick.length, ...(idle ? { idle, idleHits } : {}), budget, verdict: page.verdict, at640: page.first, retry: page.retry,
            straight, hitAware: J.HIT_AWARE_ANSWER.enabled };
        console.log(`##ROW##${JSON.stringify(row)}`);
        if (!page.final.ok) break;
        const plan = page.final.plan;
        plan.solution.forEach((keys, i) => {
            const slot = plan.equipsAt?.get?.(i);
            if (slot !== undefined) equips.set(perTick.length, slot);
            perTick.push(new Set(keys));
        });
    }
}

async function runRequest(file) {
    const J = await import(`${M}jsRuntimeSolver.js`);
    const { restoreRequest } = await import('./seedlingSolveRequestCodec.js');
    const { request } = JSON.parse(readFileSync(file, 'utf8'));
    const req = { ...restoreRequest(request), levelSource: await modelLevelSource() };
    const budget = Number(arg('budget', J.SOLVER_BUDGET_WORK));
    const page = await pagePath(J, req, budget, arg('work-sites') === true);
    console.log(JSON.stringify({ file, budget, verdict: page.verdict, at: page.first, retry: page.retry }));
}

async function spawnSteps(steps, jobs) {
    const out = arg('out');
    const self = fileURLToPath(import.meta.url);
    const pass = process.argv.slice(2).filter((a) => !/^--(steps|jobs|out)=/.test(a));
    let next = 0;
    const one = () => new Promise((done) => {
        if (next >= steps.length) return done();
        const s = steps[next++];
        const child = spawn(process.execPath, [self, `--step=${s}`, ...pass], { stdio: ['ignore', 'pipe', 'pipe'] });
        let buf = '';
        let err = '';
        child.stdout.on('data', (d) => { buf += d; });
        child.stderr.on('data', (d) => { err += d; });
        child.on('close', (code) => {
            const rows = buf.split('\n').filter((l) => l.startsWith('##ROW##')).map((l) => l.slice(7));
            if (rows.length === 0) rows.push(JSON.stringify({ step: Number(s), verdict: 'CRASHED', code, stderr: err.trim().split('\n').slice(-5).join('\n') }));
            for (const r of rows) {
                console.log(r);
                if (out) appendFileSync(out, `${r}\n`);
            }
            one().then(done);
        });
    });
    await Promise.all(Array.from({ length: jobs }, one));
}

async function main() {
    if (arg('request')) return runRequest(arg('request'));
    if (arg('step')) return runStep(arg('step'));
    const steps = String(arg('steps') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!steps.length || !arg('route') || !arg('views')) {
        console.error('needs --route=<route.json> --views=<dir> --steps=a,b,… (or --step=N, or --request=<file>)');
        process.exit(2);
    }
    return spawnSteps(steps, Number(arg('jobs', 1)));
}

if (isEntryPoint(import.meta.url)) await main();
