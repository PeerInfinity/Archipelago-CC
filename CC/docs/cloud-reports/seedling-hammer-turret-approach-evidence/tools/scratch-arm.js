/** APPROACH: the staging point stands this far past the turret's attack range, px (outside it no volley starts). */
const TURRET_APPROACH_STAGE_CLEAR = 8;
/** APPROACH: the longest delay a try takes, ticks — past one volley cycle (`shootTimerMax` 25 + both anims). */
const TURRET_APPROACH_DELAY_MAX = 48;
/** APPROACH: a via point stands this far outside the snapped live box, on the kill stance's line, px. */
const TURRET_APPROACH_VIA = 6;

function approachKillForCorpse(run, perTick, resolved, ctx) {
    const c = resolved.corpse;
    const id = c.turret;
    const t = run.entities('turrets')?.get?.(id) ?? null;
    if (!t || t.dead) return null;
    const refuse = (msg) => {
        throw new SolverRefusal(`${ctx.what}: ${msg}`, { goal: ctx.goal, obstacle: { kind: 'danger', id },
            perTick: [...perTick] });
    };
    if (typeof ctx.fork !== 'function') refuse(`the approach to ${id} is certified on a fork, and this solve has none`);
    const slots = run.progress('inventorySlots') ?? [];
    const blade = slots.includes(INVENTORY_ITEM_IDS.ghostsword) ? INVENTORY_ITEM_IDS.ghostsword
        : (slots.includes(INVENTORY_ITEM_IDS.sword) ? INVENTORY_ITEM_IDS.sword : null);
    if (blade === null) refuse(`the inventory has no Sword or Ghost Sword slot to kill ${id} with`);
    const exempt = new Set([...(resolved.exempt ?? []), `proximity-hazard:${id}`]);
    const r = iceTurretSnappedRect(t);
    const at = { x: (r.x + r.right) / 2, y: (r.y + r.bottom) / 2 };
    const clear = ICE_TURRET.attackRange + 1 + TURRET_APPROACH_STAGE_CLEAR;
    const opts = solverPlanOpts(run, exempt);
    const DIRS = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    const push = corpseKillSide(r, c.dir);
    const sides = [push, ...DIRS.map((d) => corpseKillSide(r, d)).filter((s) => s.key !== push.key)
        .sort((a, b) => Math.hypot(a.x - run.state.x, a.y - run.state.y) - Math.hypot(b.x - run.state.x, b.y - run.state.y))]
        .filter((s) => plannerObstacleAt(run.world, s.x, s.y, null, opts) === null);
    if (sides.length === 0) refuse(`no side of ${id}'s snapped box is plannable floor`);
    // 1. the staging point, on the push side's outward normal past the range: the first open floor there (the live
    //    walk's own ladder opens what stands between); a player already inside the range is its own staging point
    const NORMAL = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] };
    const [nx, ny] = NORMAL[push.key];
    let stage = Math.hypot(run.state.x - at.x, run.state.y - at.y) < clear ? { x: run.state.x, y: run.state.y } : null;
    for (let k = 0; k <= 240 && stage === null; k += 2) {
        const p = { x: push.x + nx * k, y: push.y + ny * k };
        if (Math.hypot(p.x - at.x, p.y - at.y) < clear) continue;
        if (plannerObstacleAt(run.world, p.x, p.y, null, opts) === null) stage = p;
    }
    if (stage === null) refuse(`no open floor past ${id}'s range on its ${push.key} side's normal`);
    const hitsBefore = run.ledger('playerHits').length;
    if (!hasArrived(run.state, stage, DEFAULT_TOLERANCE)) {
        ctx.walkTo(ctx.goal, stage, { what: `${ctx.what} -> ${id} approach staging (${stage.x},${stage.y})`,
            contactsOverride: new Set(resolved.exempt ?? []) });
    }
    if (run.ledger('playerHits').length !== hitsBefore) refuse(`the player was HIT on the staging walk to ${id}`);
    if (run.progress('primary') !== slots.indexOf(blade)) ctx.equip(slots.indexOf(blade));
    const noWalk = () => { throw new SolverRefusal('a fork does not walk'); };
    const snapped = (f) => { const u = f.entities('turrets')?.get?.(id); return !u || u.dead || u.y === Math.floor(u.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2; };
    const tally = {};
    const whys = [];
    let forks = 0;
    for (const side of sides) {
        const V = TURRET_APPROACH_VIA;
        const vias = side.key === 'up' || side.key === 'down'
            ? [{ x: r.x - V, y: side.y }, { x: r.right + V, y: side.y }]
            : [{ x: side.x, y: r.y - V }, { x: side.x, y: r.bottom + V }];
        vias.sort((a, b) => Math.hypot(a.x - stage.x, a.y - stage.y) - Math.hypot(b.x - stage.x, b.y - stage.y));
        for (const via of [null, ...vias]) {
            if (via && plannerObstacleAt(run.world, via.x, via.y, null, opts) !== null) continue;
            for (let d = 0; d <= TURRET_APPROACH_DELAY_MAX; d += 1) {
                for (const when of ['pre', 'mid', 'post']) {
                    if (d === 0 && when !== 'pre') continue;
                    const what = `${side.key} ${via ? `via(${via.x},${via.y})` : 'direct'} ${when} ${d}`;
                    const count = (k, why = null) => {
                        tally[k] = (tally[k] ?? 0) + 1;
                        if (why && whys.length < 4) whys.push(`${what}: ${why}`);
                        if (globalThis.process?.env?.TA_LOG2) console.log('TRY', what, k, why ?? '');
                    };
                    const f = fineDeadlineReached('crusher-fork') ? null : ctx.fork();
                    if (f === null) refuse(`deadline at the \`crusher-fork\` site after ${forks} approach tr(ies)`);
                    forks += 1;
                    const hits = f.ledger('playerHits').length;
                    const keys = [];
                    const step = (held) => {
                        keys.push(held);
                        return !f.advance(held).transition && f.ledger('playerHits').length === hits;
                    };
                    const hitWhy = () => { const h = f.ledger('playerHits').at(-1); return h ? `t${h.t} ${h.source}:${h.id} at (${f.state.x.toFixed(1)},${f.state.y.toFixed(1)})` : 'a door'; };
                    const walk = (aim) => {
                        const wps = planWaypointsOrNull(f.world, f.state, aim, null, solverPlanOpts(f, exempt));
                        if (wps === null) return null;
                        let ok = true;
                        for (const sm of previewWalk(f, wps, DEFAULT_TOLERANCE).samples) if (ok && sm.held) ok = step(sm.held);
                        return ok;
                    };
                    let ok = true;
                    if (when === 'pre') for (let i = 0; i < d && ok; i += 1) ok = step(NONE_KEYS);
                    if (!ok) { count('delay-hit', hitWhy()); continue; }
                    // the first leg: to the via point (or the stance), the mid delay at its first waypoint
                    const aim = via ?? { x: side.x, y: side.y };
                    if (when === 'mid') {
                        const wps = planWaypointsOrNull(f.world, f.state, aim, null, solverPlanOpts(f, exempt));
                        if (wps === null) { count('no-plan'); continue; }
                        for (const sm of previewWalk(f, wps.slice(0, 1), DEFAULT_TOLERANCE).samples) if (ok && sm.held) ok = step(sm.held);
                        for (let i = 0; i < d && ok; i += 1) ok = step(NONE_KEYS);
                        if (!ok) { count('mid-hit', hitWhy()); continue; }
                    }
                    const leg1 = walk(aim);
                    if (leg1 === null) { count('no-plan'); continue; }
                    if (!leg1) { count('approach-hit', hitWhy()); continue; }
                    if (via) {
                        for (const sm of previewWalk(f, [{ x: side.x, y: side.y }], DEFAULT_TOLERANCE).samples) if (ok && sm.held) ok = step(sm.held);
                        if (!ok) { count('approach-hit', hitWhy()); continue; }
                    }
                    for (let w = 0; ok && !snapped(f) && w < CORPSE_SNAP_WAIT; w += 1) ok = step(NONE_KEYS);
                    if (ok && when === 'post') for (let i = 0; i < d && ok; i += 1) ok = step(NONE_KEYS);
                    if (!ok) { count('stand-hit', hitWhy()); continue; }
                    // ⛓ the kill derives its side off the LIVE rect (its 0.5 px cycle): settle on that one
                    const live = corpseKillSide(f.entities('turrets').get(id).rect, DIRS.find((q) => corpseKillSide(r, q).key === side.key));
                    if (!hasArrived(f.state, live, DEFAULT_TOLERANCE)) {
                        for (const sm of previewWalk(f, [{ x: live.x, y: live.y }], 0.5).samples) if (ok && sm.held) ok = step(sm.held);
                    }
                    if (!ok) { count('stand-hit', hitWhy()); continue; }
                    if (!hasArrived(f.state, live, DEFAULT_TOLERANCE)) { count('approach-stalled', `at (${f.state.x.toFixed(1)},${f.state.y.toFixed(1)})`); continue; }
                    let rec;
                    try {
                        rec = killIceTurretInPlace(f, keys, id, { contacts: exempt, corpseOnly: true },
                            { ...ctx, walkTo: noWalk, what: `${ctx.what} (fork, approach ${what})` });
                    } catch (e) {
                        if (!(e instanceof SolverRefusal) && !/^levelRun: /.test(e?.message ?? '')) throw e;
                        count(/HIT/.test(e.message) ? 'kill-hit' : 'kill-other', e.message.split('\n')[0].split(ctx.what).join('').slice(0, 200));
                        continue;
                    }
                    for (let w = 0; (f.blastsInFlight.length > 0 || w < CORPSE_POST_KILL_STAND) && w < CORPSE_BLAST_WAIT && ok; w += 1) {
                        ok = step(NONE_KEYS);
                    }
                    if (!ok || f.blastsInFlight.length > 0 || !f.entities('turrets').get(id)?.dead) { count('after-kill', ok ? 'blasts in flight' : hitWhy()); continue; }
                    for (const held of keys) {
                        perTick.push(held);
                        if (run.advance(held).transition) refuse(`the approach and kill of ${id} crossed a door on the live run`);
                    }
                    if (!run.entities('turrets').get(id)?.dead || run.ledger('playerHits').length !== hitsBefore) {
                        refuse(`the fork's approach and kill of ${id} (${what}) did not replay on the live run`);
                    }
                    return { ...rec, side: side.key, stance: { x: side.x, y: side.y }, staging: stage, via, when, delay: d, forks };
                }
            }
        }
    }
    return refuse(`no approach to ${id} from the staging point (${stage.x},${stage.y}) is hitless (${forks} fork(s); `
        + `${JSON.stringify(tally)}) — ${whys.join(' | ')}`);
}

/** The live box of an ice turret on its stationary-axis snap (`floor(v/16)*16 + 8`): the box its first on-screen update gives a body still at its ctor point. */
function iceTurretSnappedRect(t) {
    const snap = (v) => Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const sx = !t.dead && Math.abs(snap(t.x) - t.x) >= 1 ? snap(t.x) - t.x : 0;
    const sy = !t.dead && Math.abs(snap(t.y) - t.y) >= 1 ? snap(t.y) - t.y : 0;
    return { ...t.rect, x: t.rect.x + sx, right: t.rect.right + sx, y: t.rect.y + sy, bottom: t.rect.bottom + sy };
}
