#!/usr/bin/env node
/**
 * Measure-only (the divergence sweep, planner `seedling-js-planning-2`) — THE BARE PASS, in node: every leg of
 * `--legs=<jsonl>` (`seedling-divergence-legs.mjs`) asked of the solver with NO inventory, from a JS-runtime
 * arrival staged in the rooms the game plays (the vanilla arm's DELIVERED set, `--dump` of
 * `probe-seedling-divergence-sweep.mjs`, through the wasm engine's own request path:
 * `wasmGoalRefusal` → `arrivalSolverGoal` → `arrivalSolveRequest` → the in-place produce service (the worker's
 * dispatch, one process). One jsonl row per leg: solved (producer, ticks, verbs) | refused (kind + message) |
 * wasm-refused | no-solver-goal | boot-failed | unresolved. No browser; nothing tracked changes.
 *
 * ⚠ The solve runs the passes the worker runs (`ANYTIME_PASSES`) with NO budget: a leg the live engine cuts at its
 * budget is SOLVED here. `ms` says what it cost.
 *
 * A leg the list marks `stagedEvents` (an event-gated arrival) is solved with those flags in the arrival staging's
 * `persistence` (the obstacle already broken — ⚖ a test-harness staging choice, as the live sweep's; `--no-stage-events`
 * drops it, the mutant). A leg the list marks `skip` (a gate with no flag, or a goal that IS its gating event) is a
 * `skipped` row, never solved.
 *
 * Run: node scripts/procgen/seedling-divergence-bare.mjs --legs=<jsonl> --dump=<json> --out=<jsonl> [--ids=a,b|--keys=k1|k2] [--jobs=N] [--no-stage-events]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { legSelectors, pickLegs } from './seedling-divergence-legs.mjs';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const ONE = arg('one', '');
    if (ONE) { console.log(JSON.stringify(await oneLeg(JSON.parse(ONE), arg('dump', '')))); process.exit(0); }
    const legs = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const pick = pickLegs(legs, legSelectors(arg));
    const jobs = Number(arg('jobs', '3'));
    const timeoutS = Number(arg('timeout', '120'));
    const out = [];
    let next = 0;
    const self = fileURLToPath(import.meta.url);
    async function worker() {
        while (next < pick.length) {
            const leg = pick[next++];
            // ⛔ an arrival needing a game_state event (the list's `skip`): named, never solved
            if (leg.skip) {
                const row = { id: leg.id, key: leg.key ?? null, outcome: 'skipped', err: leg.skip };
                out.push(row);
                console.log(`ROW ${JSON.stringify(row).slice(0, 300)}`);
                continue;
            }
            // eslint-disable-next-line no-await-in-loop
            const row = await new Promise((resolve) => {
                const p = spawn(process.execPath, [self, `--one=${JSON.stringify(leg)}`, `--dump=${arg('dump', '')}`,
                    ...(process.argv.includes('--no-stage-events') ? ['--no-stage-events'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
                let so = '';
                let se = '';
                p.stdout.on('data', (d) => { so += d; });
                p.stderr.on('data', (d) => { se += d; });
                const t = setTimeout(() => { p.kill('SIGKILL'); }, timeoutS * 1000);
                p.on('close', (code, sig) => {
                    clearTimeout(t);
                    const line = so.split('\n').filter((l) => l.startsWith('{')).at(-1);
                    if (line) resolve(JSON.parse(line));
                    else resolve({ id: leg.id, outcome: sig ? 'timeout' : 'crash', err: se.slice(-300), ms: timeoutS * 1000 });
                });
            });
            out.push(row);
            console.log(`ROW ${JSON.stringify(row).slice(0, 300)}`);
        }
    }
    await Promise.all(Array.from({ length: jobs }, worker));
    out.sort((a, b) => a.id - b.id);
    writeFileSync(arg('out', '/dev/stdout'), out.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const tally = out.reduce((m, r) => { m[r.outcome] = (m[r.outcome] ?? 0) + 1; return m; }, {});
    console.log(`INFO: ${out.length} legs`, JSON.stringify(tally));
}

/** The staging with `flags` (`{level, tag}`) added to its `persistence` (sorted, no duplicates; nothing else changes). */
export function withStagedFlags(staging, flags) {
    const all = [...(staging.persistence ?? []), ...flags.map(({ level, tag }) => ({ level, tag }))];
    const uniq = [...new Map(all.map((c) => [`${c.level}:${c.tag}`, { level: c.level, tag: c.tag }])).values()]
        .sort((a, b) => a.level - b.level || a.tag - b.tag);
    return { ...staging, persistence: uniq };
}

async function oneLeg(leg, dumpPath) {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
    const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
    const { wasmGoalRefusal } = await M('seedlingDemo/wasmPlayback.js');
    const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
    const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
    const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
    // the engine's own records: `loadWasmPlaybackEngine` stages a delivered set through `mountedRecordsOf` alone
    const RECS = dump.deliveredSet ? mountedRecordsOf(dump.deliveredSet) : new Map(indexLevels(MAP));
    const SRC = levelSourceFromAtlas(RECS);
    const out = { id: leg.id, key: leg.key ?? null, level: leg.level, arrive: [leg.arrive.x, leg.arrive.y], goal: leg.goal.name, kind: leg.goal.kind };
    const t0 = Date.now();
    try {
        let goal;
        if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
        else {
            const e = dump.entries.find((x) => x.location === leg.goal.name);
            if (!e) {
                out.outcome = 'unresolved';
                out.err = dump.refused.find((r) => r.location === leg.goal.name)?.why ?? 'not a bound location';
                out.ms = Date.now() - t0;
                return out;
            }
            goal = { kind: 'location', level: e.level, tag: e.tag, entityType: e.entityType ?? null, name: leg.goal.name };
        }
        const ref = wasmGoalRefusal(goal, RECS.get(leg.level) ?? null);
        if (ref) { out.outcome = 'wasm-refused'; out.err = ref; return out; }
        const rt = createJsRuntime();
        rt.setVanilla(RECS);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
        rt.tick();
        if (rt.run?.level !== leg.level) {
            out.outcome = 'boot-failed';
            out.err = `run level ${rt.run?.level}; halted ${JSON.stringify(JSON.parse(rt.game.botStatus()).halted)}`;
            return out;
        }
        let staging = rt.session.staging;
        if (leg.stagedEvents?.length && !process.argv.includes('--no-stage-events')) {
            staging = withStagedFlags(staging, leg.stagedEvents);
            out.stagedEvents = leg.stagedEvents.map((e) => e.eventId);
        }
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
        if (!mapped.goal) { out.outcome = 'no-solver-goal'; out.err = mapped.walker; return out; }
        const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
            scratchPersistence: true }), passes: ANYTIME_PASSES };
        out.mapped = mapped.goal.kind;
        const res = createInPlaceProduceService().start(req).result;
        if (!res.ok) {
            out.outcome = 'refused';
            out.refusalKind = res.kind;
            out.err = String(res.message).split('\n')[0].slice(0, 400);
        } else {
            const plan = res.plan;
            out.outcome = 'solved';
            out.producer = plan.producer ?? 'solver';
            out.ticks = plan.solution.length;
            out.verbs = plan.verbs;
            out.end = plan.expected.at(-1);
        }
    } catch (e) {
        out.outcome = 'refused';
        out.refusalKind = e.name;
        out.err = `${e.name}: ${String(e.message).split('\n')[0].slice(0, 400)}`;
    }
    out.ms = Date.now() - t0;
    return out;
}
