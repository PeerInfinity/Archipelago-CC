#!/usr/bin/env node
// SCRATCH (seedling-hammer-g1): one solveSegment (dashMode all) from either a survey boot view (`--view`, P1/D's
// view-solve staging) or a divergence leg's arrival (`--leg=id`, D's d1-leg path), with (`--ghost=1`) or without the
// ghost sword. Reports the verdict, the ticks, every spinner landing (weapon, hits, killed, reach) and each body's
// removal tick from the run — on a refusal too (the run is advanced in place). `--tape=<json>` writes perTick (the
// prefix on a refusal) and the staging. Measure-only.
//   node g1-solve.mjs --view=<boot.json> --goal=collect:880,816 --ghost=1 [--json=out.json] [--tape=out.json]
//   node g1-solve.mjs --leg=414 --legs=legs.jsonl --dump=dump.json --ghost=1
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const md5 = (s) => createHash('md5').update(s).digest('hex');
const GHOST = arg('ghost', '0') === '1';
const { solveSegment } = await M('seedlingDemo/solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('seedlingDemo/tapeRunner.js');
const { GHOST_SPINNER_PRESS, GHOST_KILL_RUNG } = await M('seedlingDemo/ghostSpinnerPress.js');
let staging; let goals; let src; const out = { ghost: GHOST, ghostSpinnerPress: GHOST_SPINNER_PRESS.enabled,
    ghostKillRung: GHOST_KILL_RUNG?.enabled ?? 'absent' };
if (arg('crusher', '')) {
    const { crusherStaging } = await import(join(REPO, 'scripts/procgen/plan-seedling-crusher-witness.mjs'));
    const { atlasLevelSource } = await M('seedlingDemo/levelSource.js');
    const [level, x, y] = arg('crusher').split(',').map(Number);
    staging = await crusherStaging({ boot: { level, x, y }, keys: arg('keys', '').split(',').filter(Boolean).map(Number),
        items: arg('items').split(',').concat(GHOST ? ['hasGhostSword'] : []) });
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(arg('goal'));
    const p = { x: +m[2], y: +m[3] };
    goals = [m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p }];
    src = atlasLevelSource();
    out.crusher = arg('crusher'); out.keys = arg('keys', ''); out.items = staging.seam.items;
} else if (arg('view', '')) {
    const { parseTape } = await M('seedlingDemo/tapeFormat.js');
    const { atlasLevelSource } = await M('seedlingDemo/levelSource.js');
    staging = solveStaging(stagingFromTape(parseTape(readFileSync(arg('view'), 'utf8'))));
    if (GHOST) staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(arg('goal'));
    const p = { x: +m[2], y: +m[3] };
    goals = [m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p }];
    src = atlasLevelSource();
    out.view = arg('view').split('/').pop();
} else {
    const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
    const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
    const { mountedRecordsOf } = await M('seedlingDemo/wasmWalkTape.js');
    const { levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
    const legs = new Map(readFileSync(arg('legs'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((l) => [l.id, l]));
    const dump = JSON.parse(readFileSync(arg('dump'), 'utf8'));
    const RECS = mountedRecordsOf(dump.deliveredSet);
    src = levelSourceFromAtlas(RECS);
    const leg = legs.get(Number(arg('leg')));
    out.leg = leg.id; out.key = leg.key;
    let goal;
    if (leg.goal.kind === 'exit') goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
    else {
        const e = dump.entries.find((x) => x.location === leg.goal.name);
        goal = { kind: 'location', level: e.level, tag: e.tag, entityType: e.entityType ?? null, name: leg.goal.name };
    }
    const FLAG = { 'Progressive Sword': 'hasSword', 'Progressive Shield': 'hasShield', Fire: 'hasFire', Light: 'hasTorch' };
    const ORDER = ['hasTorch', 'hasFire', 'hasShield', 'hasSword'];
    const have = new Set((leg.sphere?.inventory ?? []).map((n) => FLAG[n]).filter(Boolean));
    const flags = ORDER.filter((f) => have.has(f));
    if (GHOST) flags.push('hasGhostSword');
    out.items = flags;
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([...flags.map((property) => ({ class: 'Main', property, value: true })),
        { invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
    rt.tick(); rt.tick();
    const mapped = arrivalSolverGoal(goal, { staging: rt.session.staging, levelSource: src, record: RECS.get(leg.level) });
    staging = arrivalSolveRequest({ staging: rt.session.staging, solverGoal: mapped.goal, levelSource: src, records: RECS,
        scratchPersistence: true }).staging;
    goals = [mapped.goal];
}
const run = createRunForStaging(staging, src);
out.primary = run.progress?.('primaryWeapon') ?? null;
// body removal ticks: watch the roster after each advance
const removed = {};
const adv = run.advance.bind(run);
let prev = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
run.advance = (k) => { const r = adv(k); const now = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
    for (const id of prev) if (!now.has(id)) removed[id] = run.ticksCompleted; prev = now;
    trail.push([run.ticksCompleted, run.state.x, run.state.y]); return r; };
const trail = [];
const t0 = Date.now();
let perTick = null;
try {
    const res = solveSegment({ run, goals, name: 'g1', boot: staging.boot, dashMode: arg('dash', 'all') });
    out.verdict = 'SOLVED'; out.ticks = res.perTick.length; perTick = res.perTick;
    out.strategies = [...new Set((res.records ?? []).map((r) => r.strategy))];
} catch (e) {
    out.verdict = 'REFUSED'; out.refusalTicks = e.perTick?.length ?? null; perTick = e.perTick ?? null;
    const msg = String(e.message); out.msgMd5 = md5(msg); out.obstacle = e.obstacle ? { kind: e.obstacle.kind, id: e.obstacle.id } : null;
    out.head = msg.slice(0, 400);
    const i = msg.indexOf('\n  kill:'); out.killLine = i >= 0 ? msg.slice(i + 3, i + 500).split('\n')[0] : null;
}
out.keysMd5 = perTick ? md5(JSON.stringify(perTick.map((k) => [...k].sort()))) : null;
out.hits = run.ledger('playerHits').length;
out.landings = (run.spinnerPressHits ?? []).filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, weapon: h.weapon, hits: h.hits,
    killed: h.killed, reach: Number(h.reach.toFixed(3)) }));
out.removed = removed;
out.weapons = [...new Set((run.presses ?? []).map((p) => p.weapon))];
out.s = (Date.now() - t0) / 1000;
out.end = { t: run.ticksCompleted, x: run.state.x, y: run.state.y };
if (arg('trail', '')) writeFileSync(arg('trail'), JSON.stringify(trail));
if (arg('tape', '') && perTick) writeFileSync(arg('tape'), JSON.stringify({ staging, perTick: perTick.map((s) => [...s]) },
    (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)));
const s = JSON.stringify(out);
if (arg('json', '')) writeFileSync(arg('json'), s);
console.log(s);
process.exit(0);
