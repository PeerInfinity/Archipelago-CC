#!/usr/bin/env node
// SCRATCH (seedling-hammer-p2 D2, from D's d1-leg.mjs): one divergence-sweep leg solved in node through C1/P1's arrival path,
// with the whole plan's md5 (every `ms`/`*Ms` key stripped) and the whole refusal's md5, and P1's + P2's counts.
// (was seedling-hammer-d D1's) one divergence-sweep leg solved in node through C1/P1's arrival path
// (`inv-leg.mjs`), the inventory derived from the leg's own sphere, with (`--ghost=1`) or without the ghost sword.
// The ghost sword is granted as the FLAG (`Main.hasGhostSword`), the sword kept: `levelRun.weaponForPress` then fires
// `ghostsword` from the sword slot (the run's `primaryWeapon`), as C2's staging did. Measure-only; nothing tracked.
//   node d1-leg.mjs --legs=legs.jsonl --dump=dump.json --ids=374 --ghost=1 [--save=prefix]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const md5 = (s) => createHash('md5').update(s).digest('hex');
const legs = new Map(readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .map((l) => [l.id, l]));
const ids = arg('ids').split(',').map(Number);
const GHOST = arg('ghost', '0') === '1';
const SAVE = arg('save', '');
const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
const { wasmGoalRefusal } = await M('seedlingDemo/wasmPlayback.js');
const { createInPlaceProduceService, mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
const { ANYTIME_PASSES } = await M('seedlingDemo/jsRuntimeSolver.js');
const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
const { createRunForStaging } = await M('seedlingDemo/tapeRunner.js');
const { GHOST_SPINNER_PRESS } = await M('seedlingDemo/ghostSpinnerPress.js');
const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
const RECS = mountedRecordsOf(dump.deliveredSet);
const SRC = levelSourceFromAtlas(RECS);
// The sweep rows' flags for the AP items (C1/P1's rows: L39/L40 hold torch, fire, shield, sword; L92 r4c2 also swims).
const FLAG = { 'Progressive Sword': 'hasSword', 'Progressive Shield': 'hasShield', Fire: 'hasFire', Light: 'hasTorch',
    'Progressive Swim': 'canSwim' };
const ORDER = ['hasTorch', 'canSwim', 'hasFire', 'hasShield', 'hasSword'];
for (const id of ids) {
    const leg = legs.get(id);
    const out = { id, key: leg.key, ghost: GHOST, ghostSpinnerPress: GHOST_SPINNER_PRESS.enabled };
    const t0 = Date.now();
    try {
        let goal;
        if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
        else {
            const e = dump.entries.find((x) => x.location === leg.goal.name);
            goal = { kind: 'location', level: e.level, tag: e.tag, entityType: e.entityType ?? null, name: leg.goal.name };
        }
        const ref = wasmGoalRefusal(goal, RECS.get(leg.level) ?? null);
        if (ref) throw new Error(`wasm-refused ${ref}`);
        const have = new Set((leg.sphere?.inventory ?? []).map((n) => FLAG[n]).filter(Boolean));
        // the sweep rows never carried canSwim on L39/L40 (C1's rows); kept to the rows' convention
        if (leg.level !== 92) have.delete('canSwim');
        const flags = ORDER.filter((f) => have.has(f));
        if (GHOST) flags.push('hasGhostSword');
        out.items = flags;
        const rt = createJsRuntime();
        rt.setVanilla(RECS);
        rt.queueItems([...flags.map((property) => ({ class: 'Main', property, value: true })),
            { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
        rt.tick();
        rt.tick();
        const staging = rt.session.staging;
        out.stagedGhost = staging?.seam?.items?.hasGhostSword ?? null;
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(leg.level) });
        if (!mapped.goal) throw new Error(`no-solver-goal ${mapped.walker}`);
        const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
            scratchPersistence: true }), passes: ANYTIME_PASSES };
        const res = createInPlaceProduceService().start(req).result;
        if (!res.ok) {
            out.outcome = 'refused';
            out.err = process.argv.includes('--full') ? String(res.message) : String(res.message).slice(0, 1200);
            out.errMd5 = md5(String(res.message));
            out.resMd5 = md5(JSON.stringify(res, (k, v) => (v instanceof Set ? [...v] : (k === 'ms' || /Ms$/.test(k) ? undefined : v))));
            out.obstacle = res.trace?.obstacle ?? res.obstacle ?? null;
            out.refusalTicks = res.trace?.ticks ?? res.ticks ?? null;
        } else {
            out.outcome = 'solved';
            out.ticks = res.plan.solution.length;
            out.keysMd5 = md5(JSON.stringify(res.plan.solution.map((k) => [...k].sort())));
            out.planMd5 = md5(JSON.stringify(res.plan, (k, v) => (v instanceof Set ? [...v] : (k === 'ms' || /Ms$/.test(k) ? undefined : v))));
            out.verbs = res.plan.verbs;
            out.pass = res.plan.pass;
            const run = createRunForStaging(req.staging, SRC);
            res.plan.solution.forEach((keys) => { run.advance(new Set(keys)); });
            out.primary = run.progress?.('primaryWeapon') ?? null;
            out.hits = run.ledger('playerHits').length;
            out.deaths = run.ledger('playerDeaths').length;
            out.end = { level: run.level, x: run.state.x, y: run.state.y };
            const presses = run.presses ?? [];
            out.presses = presses.length;
            out.weapons = [...new Set(presses.map((p) => p.weapon))];
            out.spinnerLandings = (run.ledger('spinnerPressHits') ?? []).filter((h) => h.landed)
                .map((h) => ({ t: h.t ?? h.tick, id: h.id, hits: h.hits, killed: h.killed ?? h.destroy ?? undefined }));
            out.spinnerKills = run.spinnerKills ?? null;
            if (SAVE) writeFileSync(`${SAVE}-${id}-${GHOST ? 'ghost' : 'sword'}.json`,
                JSON.stringify({ staging: req.staging, plan: res.plan }, (k, v) => (v instanceof Set ? [...v] : v)));
        }
    } catch (e) {
        out.outcome = 'threw';
        out.err = `${e.name}: ${String(e.message).slice(0, 1200)}`;
    }
    out.ms = Date.now() - t0;
    const pk = await M('seedlingDemo/pressKillCost.js');
    out.pkc = { ...pk.PRESS_KILL_COST_COUNTS };
    out.ssc = pk.STRIKE_SCAN_COST_COUNTS ? { ...pk.STRIKE_SCAN_COST_COUNTS } : null;
    out.env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_')));
    console.log(JSON.stringify(out));
}
process.exit(0);
