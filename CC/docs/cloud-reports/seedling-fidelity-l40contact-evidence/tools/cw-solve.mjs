#!/usr/bin/env node
// SCRATCH (seedling-hammer-cw W0/D1): one solveSegment (dashMode all) on the L40 chest-side workloads, reporting the
// refusal by name with what the CW brief asks for: the obstacle (+ sources), the tick, the player's and the chasers'
// positions, every ladder row (rung, arm, target), the press kill's own span, and the player's hits. G1's g1-solve.mjs
// with three additions: `--atlas=1` maps a leg's page staging onto the tape schema and boots the ATLAS (G1's rt.mjs),
// a per-tick trail of the player and the named bodies, and the refusal's ladder rows. Measure-only.
//   node cw-solve.mjs --view=<boot.json> --goal=collect:880,816 --ghost=1 [--json=out.json] [--tape=out.json]
//   node cw-solve.mjs --leg=397 --legs=legs.jsonl --dump=dump.json --ghost=1 [--atlas=1]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules', p));
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const md5 = (s) => createHash('md5').update(s).digest('hex');
const GHOST = arg('ghost', '0') === '1';
const WATCH = arg('watch', 'bob@736,752,bob@736,800,bobsoldier@880,832').split(/,(?=[a-z])/);
const { solveSegment } = await M('seedlingDemo/solverBot.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('seedlingDemo/tapeRunner.js');
const { atlasLevelSource } = await M('seedlingDemo/levelSource.js');
const { parseTape } = await M('seedlingDemo/tapeFormat.js');
const { GHOST_KILL_RUNG } = await M('seedlingDemo/ghostSpinnerPress.js');
const { CONTACT_FIDELITY } = await M('seedlingDemo/contactFidelity.js');
const { PRESS_KILL_BOMBS, PRESS_KILL_BOMBS_COUNTS } = await M('seedlingDemo/pressKillCost.js');
const out = { ghost: GHOST, ghostKillRung: GHOST_KILL_RUNG.enabled, lapse: CONTACT_FIDELITY.strikeIframeLapse === true,
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_'))) };
let staging; let goals; let src;
const goalOf = (spec) => {
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(spec);
    const p = { x: +m[2], y: +m[3] };
    return m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p };
};
if (arg('view', '')) {
    staging = solveStaging(stagingFromTape(parseTape(readFileSync(arg('view'), 'utf8'))));
    if (GHOST) staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    goals = [goalOf(arg('goal'))];
    src = atlasLevelSource();
    out.staging = `view:${arg('view').split('/').pop()}`;
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
    out.staging = `page:${leg.id}`;
    if (arg('atlas', '0') === '1') {
        // G1's rt.mjs: the page staging → a boot view (no keys) on the tape schema → the atlas
        const { buildStagedTape } = await M('seedlingDemo/botDriverV1.js');
        const plain = JSON.parse(JSON.stringify(staging, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)));
        const { hitsMax, ...items } = plain.seam.items;
        const tapeStaging = { ...plain, seam: { ...plain.seam, items, hits_max: hitsMax } };
        if (Array.isArray(tapeStaging.inventory_slots) && tapeStaging.inventory_slots.length === 0) delete tapeStaging.inventory_slots;
        const built = buildStagedTape({ staging: tapeStaging, perTick: [], name: `cw-l40-${leg.id}-boot` });
        if (arg('bootout', '')) { writeFileSync(arg('bootout'), JSON.stringify(built)); console.log('boot written'); process.exit(0); }
        staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(built))));
        src = atlasLevelSource();
        out.staging = `atlas:${leg.id}`;
        const g = goals[0];
        out.goal = g;
    }
}
const run = createRunForStaging(staging, src);
out.primary = run.progress?.('primaryWeapon') ?? null;
const removed = {};
const trail = [];
const bombSeen = { lobbers: (run.entities('bombPushers') ?? []).map((b) => b.id ?? `${b.x},${b.y}`), ticks: 0, nearest: null };
const adv = run.advance.bind(run);
let prev = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
const snap = () => {
    const ch = new Map((run.entities('chasers') ?? []).map((c) => [c.id, c]));
    return [run.ticksCompleted, +run.state.x.toFixed(2), +run.state.y.toFixed(2),
        ...WATCH.map((id) => { const c = ch.get(id); return c ? [+c.x.toFixed(2), +c.y.toFixed(2)] : null; })];
};
const keyLog = [];
run.advance = (k) => {
    keyLog[run.ticksCompleted] = [...k]; keyLog.length = run.ticksCompleted + 1;
    const r = adv(k);
    const now = new Set((run.entities('spinnerBodies') ?? []).map((b) => b.id));
    for (const id of prev) if (!now.has(id)) removed[id] = run.ticksCompleted;
    prev = now;
    trail.push(snap());
    if (PT) {
        const T = run.ticksCompleted;
        const c = (run.entities('chasers') ?? []).find((x) => x.id === PT);
        const inSB = (run.entities('strikeBodies') ?? []).some((x) => x.id === PT);
        const pr = run.presses ?? [];
        const newP = pr.slice(pLen).filter((q) => (q.hits ?? []).some((h) => h.id === PT))
            .map((q) => ({ t: q.t, fired: q.fired, level: q.level, weapon: q.weapon, hit: q.hits.find((h) => h.id === PT) }));
        if (pr.length < pLen) ptrace.push({ T, ledgerShrank: [pLen, pr.length] });
        pLen = pr.length;
        if ((T >= PTW[0] && T <= PTW[1]) || newP.length) ptrace.push({ T, level: run.level, p: [+run.state.x.toFixed(2), +run.state.y.toFixed(2)],
            c: c ? { x: +c.x.toFixed(2), y: +c.y.toFixed(2), hits: c.hits, ht: c.hitsTimer, dying: c.dying, destroy: c.destroy, alpha: c.alpha } : null, inSB, newP });
    }
    const bombs = (run.entities('bombs') ?? []).filter((b) => !b.removed);
    if (bombs.length) { bombSeen.ticks += 1; for (const b of bombs) {
        const d = Math.hypot(b.x - run.state.x, b.y - run.state.y); if (bombSeen.nearest === null || d < bombSeen.nearest.d)
            bombSeen.nearest = { t: run.ticksCompleted, d: +d.toFixed(1), bomb: [+b.x.toFixed(1), +b.y.toFixed(1)] }; } }
    return r;
};
const PT = arg('ptrace', ''); const PTW = arg('ptw', '95-175').split('-').map(Number); const ptrace = []; let pLen = (run.presses ?? []).length;
const t0 = Date.now();
let perTick = null;
let rows = [];
try {
    const res = solveSegment({ run, goals, name: 'cw', boot: staging.boot, dashMode: arg('dash', 'all') });
    out.verdict = 'SOLVED'; out.ticks = res.perTick.length; perTick = res.perTick;
    rows = res.rows ?? res.trace?.rows ?? [];
    out.records = (res.records ?? []).map((r) => ({ strategy: r.strategy, arm: r.arm ?? null, target: r.target ?? null,
        from: r.from ?? null, ticks: r.ticks ?? null }));
} catch (e) {
    if (e?.name !== 'SolverRefusal' && !e?.perTick) { out.verdict = 'THREW'; out.err = String(e?.stack ?? e).slice(0, 1500); }
    else {
        out.verdict = 'REFUSED'; out.refusalTicks = e.perTick?.length ?? null; perTick = e.perTick ?? null;
        out.message = String(e.message); out.msgMd5 = md5(out.message);
        out.obstacle = e.obstacle ?? null;
        out.considered = (e.considered ?? []).map((c) => ({ option: c.option, why: String(c.why).slice(0, 220) }));
        rows = e.rows ?? [];
    }
}
out.keysMd5 = perTick ? md5(JSON.stringify(perTick.map((k) => [...k].sort()))) : null;
out.at = snap();
out.watch = WATCH;
out.hits = run.ledger('playerHits').map((h) => `${h.t}:${h.source}:${h.id}`);
out.deaths = run.ledger('playerDeaths').map((d) => d.t ?? d.tick ?? d);
out.landings = (run.spinnerPressHits ?? []).filter((h) => h.landed).map((h) => ({ t: h.t, id: h.id, weapon: h.weapon,
    hits: h.hits, killed: h.killed, reach: Number(h.reach.toFixed(3)) }));
out.removed = removed;
out.weapons = [...new Set((run.presses ?? []).map((p) => p.weapon))];
// the ladder's rows (rung / arm / target / obstacle), compacted
out.ladder = rows.filter((r) => r.strategy && (r.strategy.rung || ['kill', 'bait', 'detour', 'walk', 'time', 'forced-hit']
    .includes(r.strategy.verb))).map((r) => ({ tick: r.tick, rung: r.strategy.rung ?? r.strategy.verb,
    arm: r.strategy.arm ?? null, target: r.strategy.target ?? null, climb: r.strategy.climb ?? null,
    obstacle: r.obstacle ? `${r.obstacle.kind}:${r.obstacle.id}${r.obstacle.sources ? ` [${r.obstacle.sources.join(' ')}]` : ''}` : null,
    rejected: (r.rejected ?? []).map((x) => x.option).join('>') }));
// nearest approach of each watched body to the player, and the tick
out.nearest = Object.fromEntries(WATCH.map((id, i) => {
    let best = null;
    for (const s of trail) {
        const c = s[3 + i]; if (!c) continue;
        const d = Math.hypot(c[0] - s[1], c[1] - s[2]);
        if (!best || d < best.d) best = { t: s[0], d: +d.toFixed(2), player: [s[1], s[2]], body: c };
    }
    return [id, best];
}));
out.bombs = { pressKillBombs: PRESS_KILL_BOMBS.enabled, counts: { ...PRESS_KILL_BOMBS_COUNTS }, ...bombSeen };
out.s = (Date.now() - t0) / 1000;
if (PT) writeFileSync(arg('ptout'), ptrace.map((r) => JSON.stringify(r)).join('\n') + '\n');
if (arg('keylog', '')) writeFileSync(arg('keylog'), JSON.stringify({ staging, goals, perTick: keyLog }, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)));
if (arg('trail', '')) writeFileSync(arg('trail'), JSON.stringify(trail));
if (arg('tape', '') && perTick) writeFileSync(arg('tape'), JSON.stringify({ staging, goals, perTick: perTick.map((s) => [...s]) },
    (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)));
const s = JSON.stringify(out);
if (arg('json', '')) writeFileSync(arg('json'), s);
console.log(s.slice(0, 600));
process.exit(0);
