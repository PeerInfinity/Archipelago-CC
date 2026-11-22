#!/usr/bin/env node
// rules-l112-owl-executor — A WITNESS-SIDE OWL FIGHT EXECUTOR (L112, `Enemies/FinalBoss.as`).
//
// A planner over the fidelity model, imported READ-ONLY: `levelRun` (which steps `finalBossFight.js` and
// `finalBossRng.js` for L112) is driven by a CLOSED-LOOP controller in node; what comes out is an OPEN-LOOP tape for
// ONE rng seed (the controller's per-tick key sets, spanned), which the GAME then judges on a fresh page (`judge.mjs`).
// Nothing here edits the solver, levelRun, the fight model or any fixture.
//
// The route: boot at the L111 arrival (`new Game(112, 32, 208)` — L111's teleporter `to=112 playerx=32 playery=208`,
// the same constructor a tape boot calls), press `primary` once to end the Owl's intro, walk to a dodge orbit, then
// THREE shoves (each: walk to a stance, FACE ticks holding the one key toward him so the press rect faces him, press,
// stand), each one followed by his own lava self-hit; then the death chain (109 ticks to `{112,0}`/`{112,1}`), the
// rocklock's 100-tick fade (`RockLock.as:56-66`, alpha -= 0.01), and the walk north through it into the L113 teleporter.
//
// The search per shove k (k = 0, 1, 2): candidate press ticks every STEP ticks over the boss's walk ticks in which the
// (k+1)-th lava hit is still available (`hitThisSequence` false), stances on a polar grid around his model position at
// that tick, the lethal `t in {16,17}` cells and the pod cells FORBIDDEN, the push ray required to point at the lava
// centre. A candidate is a full replay from tick 0; it is kept only with the (k+1)-th lava hit and ZERO player hits
// up to its horizon. Ranked: earliest lava hit. Backtracks to the next candidate when a later stage or the exit fails.
//
//   node owl-executor.mjs --weapon=sword|spear --seed=N [--orbit=nw|ne|sw|se] [--out=<tape.json>] [--report=<json>]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const R = process.cwd();
const M = (f) => import(join(R, 'frontend/modules/seedlingDemo', f));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

const { createLevelRun } = await M('levelRun.js');
const { atlasLevelSource } = await M('levelSource.js');
const { ROLES, buildLevelWorld } = await M('levelWorld.js');
const { serializeTape, parseTape, heldKeysAt } = await M('tapeFormat.js');
const { keysToSpans } = await M('mover.js');
const { FINAL_BOSS } = await M('finalBossFight.js');

const WEAPON = arg('weapon', 'sword');
const SEED = Number(arg('seed', '101'));
const ORBIT_NAME = arg('orbit', 'nw');
const STEP = Number(arg('step', '3'));
const MAX_CANDIDATES = Number(arg('max-candidates', '6'));

/** L111's teleporter to 112 (`playerx 32, playery 208`): the boot block IS the arrival. */
const BOOT = { level: 112, x: 32, y: 208 };
/** `--weapon` names the GRANT: sword | spear | wand | none | shield | shield2 (Progressive Shield x2) | darksuit. */
const ITEMS = { sword: ['sword'], spear: ['spear'], wand: ['wand'], none: [], shield: ['shield'],
    shield2: ['shield', 'darkshield'], darksuit: ['darksuit'] }[WEAPON];
const GRANTS = ITEMS.length ? [{ level: 112, items: ITEMS }] : [];
const EQUIPS = ['sword', 'spear', 'wand'].includes(WEAPON) ? [{ t: 0, slot: 0 }] : [];
const PINS = ['sound', 'dead_frames'];
const RNG = { seed: SEED, split: true };
const INTRO_PRESS = 2;
const ORBITS = {
    // a diamond: corners (cx+s,cy) (cx,cy+s) (cx-s,cy) (cx,cy-s), one per `period` ticks — too far apart to reach in a
    // period, so the player is never at rest (a resting player is aimed at directly: `stepsAhead` -15 x v = 0).
    nw: { cx: 56, cy: 72, s: 32, period: 30 },
    nw2: { cx: 60, cy: 68, s: 36, period: 34 },
    ne: { cx: 184, cy: 72, s: 32, period: 30 },
    sw: { cx: 60, cy: 180, s: 32, period: 30 },
    se: { cx: 184, cy: 180, s: 32, period: 30 },
    n: { cx: 64, cy: 48, s: 0, period: 30, rect: [[40, 40], [100, 40], [100, 92], [40, 92]] },
};
const ORBIT = ORBITS[ORBIT_NAME];
/** From the arrival (40,216) to the orbit: up the west wall at x=24, clear of pod@40,120's 16x16 box. */
const HOME = [];
const APPROACH = 60;
const FACE = 8;
const STAND = 6;
/** Exit: past pod@112,48 on its west side, then up col 7 (x 112..128) through `rocklock@112,16` into `teleporter@112,0`. */
const EXIT = [{ x: 120, y: 6 }];
const ROCKLOCK_FADE = 100;

const world = buildLevelWorld(atlasLevelSource()(112), { roles: ROLES });
const LAVA_CENTRE = { x: 120, y: 128 };
const RADII = WEAPON === 'spear' ? [10, 14, 18, 22, 26] : [10, 12, 14, 16, 18];
const DIRS = 24;

// ── THE NAVIGATOR: a BFS distance field per target over the model's OWN `collidesSolid` (the player's 4x5 box,
// `Player.as:295` normalHitbox), with the lethal `t in {16,17}` cells and the four pod boxes forbidden. The rocklock
// is a live Solid in `collidesSolid`'s static answer, so its cell (x 112..128, y 16..32) is admitted for the EXIT
// field only (the run itself refuses to walk through it while it stands).
const G = 2;
const N = 240 / G;
const pbox = (x, y) => ({ x: x - 2, y: y - 2, right: x + 2, bottom: y + 3, w: 4, h: 5 });
const overl = (a, r) => a.right > r.x && a.bottom > r.y && a.x < r.right && a.y < r.bottom;
const lethalRects = world.tiles.filter((t) => t.t === 16 || t.t === 17).map((t) => t.rect);
const podRects = FINAL_BOSS.podPositions.map((p) => ({ x: p.x - 10, y: p.y - 10, right: p.x + 10, bottom: p.y + 10 }));
const ROCKLOCK_RECT = { x: 112, y: 16, right: 128, bottom: 32 };
const passBase = new Uint8Array(N * N);
const passExit = new Uint8Array(N * N);
for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
    const x = i * G; const y = j * G; const b = pbox(x, y);
    const bad = lethalRects.some((r) => overl(b, r)) || podRects.some((r) => overl(b, r));
    const solid = !!world.collidesSolid(b);
    passBase[j * N + i] = (!bad && !solid) ? 1 : 0;
    const inLock = overl(b, ROCKLOCK_RECT) && b.x >= 112 && b.right <= 128;
    passExit[j * N + i] = (!bad && (!solid || inLock || y < 16)) ? 1 : 0;
}
const fields = new Map();
function fieldFor(tx, ty, exit = false) {
    const key = `${Math.round(tx)},${Math.round(ty)},${exit ? 1 : 0}`;
    if (fields.has(key)) return fields.get(key);
    const pass = exit ? passExit : passBase;
    const d = new Int32Array(N * N).fill(-1);
    const gi = Math.max(0, Math.min(N - 1, Math.round(tx / G)));
    const gj = Math.max(0, Math.min(N - 1, Math.round(ty / G)));
    const q = [gj * N + gi]; d[gj * N + gi] = 0;
    for (let h = 0; h < q.length; h += 1) {
        const c = q[h]; const ci = c % N; const cj = (c - ci) / N;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const ni = ci + di; const nj = cj + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const n = nj * N + ni;
            if (d[n] >= 0 || !pass[n]) continue;
            if (di && dj && (!pass[cj * N + ni] || !pass[nj * N + ci])) continue;
            d[n] = d[c] + 1; q.push(n);
        }
    }
    fields.set(key, d);
    return d;
}
/** One tick of walking toward (tx,ty) along the field; true when within 1.5 px. */
function steer(out, run, tx, ty, exit = false) {
    const px = run.state.x; const py = run.state.y;
    if (Math.abs(tx - px) <= 1.5 && Math.abs(ty - py) <= 1.5) return true;
    const d = fieldFor(tx, ty, exit);
    let ci = Math.round(px / G); let cj = Math.round(py / G);
    let aimX = tx; let aimY = ty;
    const here = d[cj * N + ci];
    if (here > 6 || here < 0) {
        // follow the gradient 6 nodes ahead
        let best = cj * N + ci;
        if (here < 0) {
            // off-field (box clipped): nearest field node in a 3-node ring
            let bd = Infinity;
            for (let dj = -3; dj <= 3; dj += 1) for (let di = -3; di <= 3; di += 1) {
                const n = (cj + dj) * N + (ci + di); if (d[n] >= 0 && d[n] < bd) { bd = d[n]; best = n; }
            }
        }
        for (let s = 0; s < 6; s += 1) {
            const bi = best % N; const bj = (best - bi) / N; let nb = best;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const n = (bj + dj) * N + (bi + di);
                if (d[n] >= 0 && d[n] < d[nb]) nb = n;
            }
            best = nb;
        }
        aimX = (best % N) * G; aimY = Math.floor(best / N) * G;
    }
    const dx = aimX - px; const dy = aimY - py;
    if (dx > 0.8) out.add('right'); else if (dx < -0.8) out.add('left');
    if (dy > 0.8) out.add('down'); else if (dy < -0.8) out.add('up');
    return false;
}

/**
 * The controller. `shoves` = [{t, x, y}], `presses` = the press ticks actually pressed (a control drops one).
 * `exitFrom` = the tick the exit walk may begin (null: never). Closed-loop: reads the run each tick.
 */
function controller(shoves, presses, exitFrom) {
    let home = 0;
    let exitI = 0;
    return (t, run) => {
        const out = new Set();
        if (t === INTRO_PRESS || presses.includes(t)) out.add('primary');
        if (exitFrom !== null && t >= exitFrom) {
            while (exitI < EXIT.length && steer(new Set(), run, EXIT[exitI].x, EXIT[exitI].y, true)) exitI += 1;
            if (exitI < EXIT.length) steer(out, run, EXIT[exitI].x, EXIT[exitI].y, true);
            return out;
        }
        const own = shoves.find((k) => t >= k.t - APPROACH && t <= k.t + STAND);
        if (own && t >= own.t - FACE && t <= own.t) {
            const b = run.finalBosses[0];
            if (!b) return out;
            const dx = b.x - run.state.x;
            const dy = b.y - run.state.y;
            if (Math.abs(dx) >= Math.abs(dy)) out.add(dx > 0 ? 'right' : 'left');
            else out.add(dy > 0 ? 'down' : 'up');
            return out;
        }
        if (own && t > own.t) return out;
        if (own) { steer(out, run, own.x, own.y); home = HOME.length; return out; }
        if (home < HOME.length) {
            if (steer(out, run, HOME[home].x, HOME[home].y)) home += 1;
            return out;
        }
        const i = Math.floor(t / ORBIT.period) % 4;
        const [tx, ty] = ORBIT.rect ? ORBIT.rect[i] : [[ORBIT.cx + ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy + ORBIT.s],
            [ORBIT.cx - ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy - ORBIT.s]][i];
        steer(out, run, tx, ty);
        return out;
    };
}

/**
 * ⚠ THE PLANNING RUN STAGES `{112,1}` CLEARED, AND THE TAPE DOES NOT. `levelRun` records the Owl's two writes as
 * next-visit clears (`pendingEarnedClears`), so inside the visit its `rocklock@112,16` stays a wall and no exit can
 * be planned. The game fades it (`Button.activateAll` at the tag tick, then 100 ticks of `alpha -= 0.01`,
 * `RockLock.as:56-66`). Staged `{112,1}` the lock removes itself at `check()` (`RockLock.as:34-37`) and nothing else
 * in the room reads tag 1, so the fight is unchanged; the EXIT starts only after the game's fade (`ROCKLOCK_FADE`).
 * `--plan-persist=none` turns the staging off (the model then cannot leave the room).
 */
const PLAN_PERSIST = arg('plan-persist', '112:1') === 'none' ? [] : [{ level: 112, tag: 1 }];
const freshRun = () => createLevelRun({
    levelSource: atlasLevelSource(), boot: BOOT, noclip: false, noHazards: [], noDamage: false,
    grants: GRANTS, persistence: PLAN_PERSIST, equips: EQUIPS, pins: PINS,
    save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, roles: ROLES,
});

let drives = 0;
function drive(shoves, presses, ticks, exitFrom = null, stopAtLevelChange = false) {
    drives += 1;
    const run = freshRun();
    const ctrl = controller(shoves, presses, exitFrom);
    const keys = [];
    let error = null;
    for (let t = 0; t < ticks; t += 1) {
        const k = ctrl(t, run);
        keys.push([...k]);
        try { run.advance(new Set(k)); } catch (e) { error = `t${t}: ${e.message.split('\n')[0].slice(0, 240)}`; break; }
        if (stopAtLevelChange && run.level !== 112) break;
    }
    return { run, keys, error };
}

function track(shoves, horizon) {
    const { run } = drive(shoves, shoves.map((s) => s.t), horizon);
    const lavaAt = new Set(run.finalBossLava.map((l) => l.t));
    let armed = true;
    return run.owlTicks.map((o) => {
        if (o.phase === 'podTick') armed = true;
        const row = { t: o.t, x: o.bossX, y: o.bossY, phase: o.phase, hits: o.hits, armed };
        if (lavaAt.has(o.t)) armed = false;
        return row;
    });
}
function blocksFor(rows, k, after) {
    const out = [];
    for (const o of rows) {
        if (o.t <= after || !(o.armed && o.hits === k && (o.phase === 'walk' || o.phase === 'walkGrenade'))) continue;
        const last = out[out.length - 1];
        if (last && o.t === last[last.length - 1] + 1) last.push(o.t); else out.push([o.t]);
    }
    return out;
}
function stances(rows, T) {
    const b = rows.find((o) => o.t === T);
    const out = [];
    if (!b) return out;
    for (const r of RADII) {
        for (let i = 0; i < DIRS; i += 1) {
            const ang = (i / DIRS) * Math.PI * 2;
            const x = Math.round(b.x + r * Math.cos(ang));
            const y = Math.round(b.y + r * Math.sin(ang));
            if (x < 0 || y < 0 || x >= 240 || y >= 240) continue;
            // the stance node and its 2-px ring must all be walkable (no lethal cell, no solid, no pod box)
            if ([[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, c]) => !passBase[Math.round((y + c) / G) * N + Math.round((x + a) / G)])) continue;
            if (Math.abs(x - b.x) < 9 && Math.abs(y - b.y) < 9) continue;
            if (FINAL_BOSS.podPositions.some((p) => Math.abs(x - p.x) < 12 && Math.abs(y - p.y) < 12)) continue;
            if ((b.x - x) * (LAVA_CENTRE.x - b.x) + (b.y - y) * (LAVA_CENTRE.y - b.y) <= 0) continue;
            // the spear's rect is 5 px thick: keep only stances on an axis line through him (±2 px)
            if (WEAPON === 'spear' && Math.abs(x - b.x) > 2 && Math.abs(y - b.y) > 2) continue;
            out.push({ t: T, x, y, r, dir: i });
        }
    }
    return out;
}

/** All valid k-th shove candidates after `chosen`, ranked (earliest lava hit first). */
function candidates(chosen, k) {
    const after = chosen.length ? chosen[chosen.length - 1].t + STAND : INTRO_PRESS;
    const rows = track(chosen, 2000);
    const blocks = blocksFor(rows, k, after);
    const found = [];
    for (const block of blocks) {
        for (let i = 0; i < block.length; i += STEP) {
            for (const s of stances(rows, block[i])) {
                const list = [...chosen, { t: s.t, x: s.x, y: s.y }];
                const { run, error } = drive(list, list.map((q) => q.t), Math.min(2400, s.t + 150));
                if (error || run.finalBossLava.length < k + 1 || run.playerHits.length > 0) continue;
                found.push({ s: { t: s.t, x: s.x, y: s.y }, at: run.finalBossLava[k].t });
                if (found.length >= MAX_CANDIDATES) break;
            }
            if (found.length >= MAX_CANDIDATES) break;
        }
        if (found.length >= MAX_CANDIDATES) break;
        if (found.length && k < 2) break; // the first block that has any: keep its candidates for backtracking
    }
    found.sort((a, b) => a.at - b.at);
    if (k === 2) for (const c of found.slice(0, 3)) {
        const f = finish([...chosen, c.s]);
        console.error(`    finish ${JSON.stringify(c.s)}: ${f.ok ? 'OK' : f.why}`);
    }
    console.error(`  candidates k=${k} after ${JSON.stringify(chosen)}: ${found.length} (drives so far ${drives})`);
    return found.slice(0, MAX_CANDIDATES);
}

/** The full run for a triple: kill, tags, rocklock fade, exit into L113, zero hits. */
function finish(triple) {
    const presses = triple.map((s) => s.t);
    const probe = drive(triple, presses, triple[2].t + 400);
    const tag = probe.run.finalBossKills.find((k) => k.what === 'tagsWritten');
    if (!tag || probe.run.playerHits.length) return { ok: false, why: tag ? 'hit before exit' : 'no tags' };
    const exitFrom = tag.t + ROCKLOCK_FADE + 4;
    const d = drive(triple, presses, exitFrom + 400, exitFrom, true);
    const reached = d.run.level === 113;
    if (d.error || !reached || d.run.playerHits.length) {
        return { ok: false, why: d.error ?? (!reached ? `exit: still in ${d.run.level} at (${d.run.state.x.toFixed(1)},${d.run.state.y.toFixed(1)})` : 'hit'), d };
    }
    // a few ticks inside L113 so the arrival is observed
    const ticks = d.keys.length + 6;
    const full = drive(triple, presses, ticks, exitFrom);
    return { ok: !full.error && full.run.playerHits.length === 0, why: full.error, d: full, tag: tag.t, exitFrom, ticks };
}

function search() {
    const c0 = candidates([], 0);
    for (const a of c0) {
        const c1 = candidates([a.s], 1);
        for (const b of c1) {
            const c2 = candidates([a.s, b.s], 2);
            for (const c of c2) {
                const f = finish([a.s, b.s, c.s]);
                if (f.ok) return { triple: [a.s, b.s, c.s], f, tried: { c0: c0.length, c1: c1.length, c2: c2.length } };
            }
        }
    }
    return { triple: null, tried: { c0: c0.length } };
}


// ── Q3: THE NON-RULE ITEMS. The model steps NO Shield bump and NO WandShot against the Owl, so these are authored
// tapes: the model drives the player (and an unshoved Owl) up to the contact, the shove itself is the GAME's, and the
// game judges (`judge.mjs`, the boss's census `hits`). Candidates: on the boss's walk ticks with his first lava hit
// still available, each axis direction d, the stance is `boss(T) - lead*d`; `finalBossCoast` (the model's own coast,
// one knockback of the item's force from the contact point) must carry him across a cell whose FIRST tile is lava.
if (arg('q3')) {
    const { finalBossCoast, finalBossLavaVerdict } = await M('finalBossFight.js');
    const horizon = Number(arg('ticks', '1600'));
    const rows = track([], horizon);
    const DIRS4 = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    const force = WEAPON === 'wand' ? 3 : 5;
    const contact = WEAPON === 'wand' ? 8 : 10; // centre distance at the push (shot edge / shield edge vs his 12x12)
    const lead = WEAPON === 'wand' ? 30 : 22;
    const solidAt = (x, y) => !!world.collidesSolid({ x: x - 6, y: y - 6, right: x + 6, bottom: y + 6 });
    const cands = [];
    for (const o of rows) {
        if (!(o.armed && o.hits === 0 && o.phase === 'walk' && o.t >= Number(arg('from', '150')))) continue;
        for (const [key, [ux, uy]] of Object.entries(DIRS4)) {
            const px = o.x - contact * ux; const py = o.y - contact * uy;
            const c = finalBossCoast({ x: o.x, y: o.y, px, py, force, hits: 1, solidAt });
            const lavaStep = c.steps.find((st) => finalBossLavaVerdict(world.tiles, st.x, st.y).hit);
            if (!lavaStep) continue;
            const sx = Math.round(o.x - lead * ux); const sy = Math.round(o.y - lead * uy);
            if (!passBase[Math.round(sy / G) * N + Math.round(sx / G)]) continue;
            cands.push({ t: o.t, key, sx, sy, bx: o.x, by: o.y, lavaAfter: lavaStep.t });
        }
    }
    console.log(`Q3 ${WEAPON}: ${cands.length} (tick, direction) pairs whose one-knockback coast crosses lava`);
    // spread: up to `--n` candidates, at least 12 ticks apart
    const pick = [];
    for (const c of cands) if (!pick.some((p) => Math.abs(p.t - c.t) < 12)) pick.push(c);
    const n = Number(arg('n', '8'));
    const chosen = pick.slice(0, n);
    const outDir = arg('outdir');
    for (const c of chosen) {
        // walk to the stance by T - hold, then hold the one key toward him (`hold` ticks), then back to the orbit
        const hold = WEAPON === 'wand' ? 0 : Number(arg('hold', '14'));
        const pressAt = WEAPON === 'wand' ? c.t - Number(arg('wlead', '6')) : null;
        const T = c.t;
        const ctrl = (t, run) => {
            const out = new Set();
            if (t === INTRO_PRESS) out.add('primary');
            if (pressAt !== null && t === pressAt) { out.add('primary'); return out; }
            if (t >= T - APPROACH && t < T - hold - (WEAPON === 'wand' ? 8 : 0)) { steer(out, run, c.sx, c.sy); return out; }
            if (WEAPON === 'wand' && t >= T - 14 && t < pressAt) { out.add(c.key); return out; } // face him
            if (WEAPON === 'wand' && t > pressAt && t <= T + 4) return out;
            if (t >= T - hold && t <= T + 4) { out.add(c.key); return out; }
            const i = Math.floor(t / ORBIT.period) % 4;
            const [tx, ty] = ORBIT.rect ? ORBIT.rect[i] : [[ORBIT.cx + ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy + ORBIT.s],
                [ORBIT.cx - ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy - ORBIT.s]][i];
            steer(out, run, tx, ty);
            return out;
        };
        const run = freshRun();
        const keys = [];
        const ticks = T + Number(arg('after', '120'));
        let err = null;
        for (let t = 0; t < ticks; t += 1) {
            const k = ctrl(t, run); keys.push([...k]);
            try { run.advance(new Set(k)); } catch (e) { err = `t${t}: ${e.message.split('\n')[0].slice(0, 160)}`; break; }
        }
        // the model cannot see the shove; after a model error the remaining ticks are the orbit keys open-loop
        const prim = [INTRO_PRESS, ...(pressAt !== null ? [pressAt] : [])];
        const spanKeys = keys.map((k) => k.filter((x) => x !== 'primary'));
        while (spanKeys.length < ticks) spanKeys.push([]);
        const inputs = [...keysToSpans(spanKeys), ...prim.map((t) => ({ key: 'primary', from: t, to: t + 1 }))];
        const name = `q3-${WEAPON}-s${SEED}-t${T}-${c.key}`;
        const tape = parseTape({
            tape_version: 7, game: 'seedling', name,
            description: `rules-l112-owl-executor Q3: ${WEAPON} only (${JSON.stringify(ITEMS)}), seed ${SEED}; at t${T} the `
                + `unshoved Owl is at (${c.bx.toFixed(1)},${c.by.toFixed(1)}); the player stands at (${c.sx},${c.sy}) and `
                + (WEAPON === 'wand' ? `fires one WandShot (${c.key}) at t${pressAt}` : `walks ${c.key} into him for ${hold} ticks (shield bump)`)
                + `; the model's one-knockback coast crosses lava ${c.lavaAfter} ticks after the push. Model note: ${err ?? 'no error'}.`,
            boot: BOOT, noclip: false, noDamage: false, noHazards: [], grants: GRANTS, persistence: [], equips: EQUIPS,
            pins: PINS, save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, tick_count: ticks, inputs,
        });
        if (outDir) writeFileSync(join(outDir, `${name}.json`), `${serializeTape(tape)}\n`);
        console.log('Q3TAPE', name, JSON.stringify(c), err ?? '');
    }
    process.exit(0);
}


// ── STAGE: GAME-IN-THE-LOOP for an item the model does not shove with (Shield, Wand).
// The Owl's walk does not read the player (only the barrage aim and the contact do), so an OBSERVATION tape (the pushes
// so far + the orbit) shows the game's own path for his next armed leg, and the next push is placed on THAT path.
// The player's keys come from a KINEMATIC model run (noDamage, `{112,1}` staged so the rocklock is not a wall): the
// player's walk is the same there as on the game as long as he takes no hit, which is the claim being tested anyway.
//   --stage=<spec.json>  {pushes:[{T,sx,sy,key,hold}], ticks, exitFrom|null}   writes --out
//   --stage=<spec.json> --track=<judge.json> --tape-name=<name>  picks the next push from that run's dense track and
//                        writes --n tapes (spec + candidate) into --outdir, each spec beside it
if (arg('stage')) {
    const { readFileSync } = await import('node:fs');
    const { finalBossCoast, finalBossLavaVerdict } = await M('finalBossFight.js');
    const spec = JSON.parse(readFileSync(arg('stage'), 'utf8'));
    const kin = () => createLevelRun({
        levelSource: atlasLevelSource(), boot: BOOT, noclip: false, noHazards: [], noDamage: true,
        grants: GRANTS, persistence: [{ level: 112, tag: 1 }], equips: EQUIPS, pins: PINS,
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, roles: ROLES,
    });
    const orbitAt = (t) => {
        const i = Math.floor(t / ORBIT.period) % 4;
        return ORBIT.rect ? ORBIT.rect[i] : [[ORBIT.cx + ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy + ORBIT.s],
            [ORBIT.cx - ORBIT.s, ORBIT.cy], [ORBIT.cx, ORBIT.cy - ORBIT.s]][i];
    };
    const writeStage = (sp, path, name) => {
        let exitI = 0;
        const ctrl = (t, run) => {
            const out = new Set();
            if (t === INTRO_PRESS) out.add('primary');
            if (sp.exitFrom != null && t >= sp.exitFrom) {
                while (exitI < EXIT.length && steer(new Set(), run, EXIT[exitI].x, EXIT[exitI].y, true)) exitI += 1;
                if (exitI < EXIT.length) steer(out, run, EXIT[exitI].x, EXIT[exitI].y, true);
                return out;
            }
            for (const q of sp.pushes) {
                if (q.wand) {
                    // the q3 wand timing: approach, face for 2 ticks, press at T - wlead, stand
                    const P = q.T - q.wlead;
                    if (t >= q.T - APPROACH && t < q.T - 8) { steer(out, run, q.sx, q.sy); return out; }
                    if (t >= q.T - 8 && t < P) { out.add(q.key); return out; }
                    if (t === P) { out.add('primary'); return out; }
                    if (t > P && t <= q.T + 4) return out;
                    continue;
                }
                if (t >= q.T - APPROACH && t < q.T - q.hold) { steer(out, run, q.sx, q.sy); return out; }
                if (t >= q.T - q.hold && t <= q.T + 4) { out.add(q.key); return out; }
            }
            const [tx, ty] = orbitAt(t);
            steer(out, run, tx, ty);
            return out;
        };
        const run = kin();
        const keys = [];
        let err = null;
        for (let t = 0; t < sp.ticks; t += 1) {
            const k = ctrl(t, run); keys.push([...k]);
            try { run.advance(new Set(k)); } catch (e) { err = `t${t}: ${e.message.split('\n')[0].slice(0, 160)}`; break; }
            if (run.level !== 112) { keys.push([], [], [], [], [], []); break; }
        }
        const ticks = keys.length;
        const prim = keys.map((k, t) => (k.includes('primary') ? t : -1)).filter((t) => t >= 0);
        const inputs = [...keysToSpans(keys.map((k) => k.filter((x) => x !== 'primary'))),
            ...prim.map((t) => ({ key: 'primary', from: t, to: t + 1 }))];
        writeFileSync(path, `${serializeTape(parseTape({
            tape_version: 7, game: 'seedling', name,
            description: `rules-l112-owl-executor Q3 stage tape: ${WEAPON} only (${JSON.stringify(ITEMS)}), seed ${SEED}, `
                + `boot at the L111 arrival; pushes ${sp.pushes.map((q) => `t${q.T} ${q.key} from (${q.sx},${q.sy}) hold ${q.hold}`).join('; ')}`
                + `${sp.exitFrom != null ? `; exit from t${sp.exitFrom} through rocklock@112,16` : ''}; each push placed on the GAME's `
                + `observed path of the Owl (game-in-the-loop: the model steps no ${WEAPON} shove). Kinematic model: ${err ?? 'ok'}, `
                + `end level ${run.level}.`,
            boot: BOOT, noclip: false, noDamage: false, noHazards: [], grants: GRANTS, persistence: [], equips: EQUIPS,
            pins: PINS, save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, tick_count: ticks, inputs,
        }))}\n`);
        return { err, ticks, level: run.level };
    };
    if (!arg('track')) {
        const r = writeStage(spec, arg('out'), arg('name', 'stage'));
        console.log('STAGE', arg('out'), JSON.stringify(r));
        process.exit(0);
    }
    const rows = JSON.parse(readFileSync(arg('track'), 'utf8'));
    const row = rows.find((q) => q.name === arg('tape-name') || q.tape === arg('tape-name'));
    const tr = row.bossTrack; // [tick, x, y, hits, anim, vx, vy]
    const k = spec.pushes.length;
    const tHit = (tr.find((q) => q[3] >= k) ?? [0])[0];
    // the barrage after hit k: >= 200 ticks parked; the armed leg is the walk after it
    let parkFrom = null; let armedFrom = null;
    for (let i = 1; i < tr.length; i += 1) {
        if (tr[i][0] <= tHit) continue;
        const still = Math.abs(tr[i][1] - tr[i - 1][1]) < 1e-6 && Math.abs(tr[i][2] - tr[i - 1][2]) < 1e-6;
        if (still && parkFrom === null) parkFrom = tr[i - 1][0];
        if (!still && parkFrom !== null) {
            if (tr[i][0] - parkFrom >= 200) { armedFrom = tr[i][0]; break; }
            parkFrom = null;
        }
    }
    console.log(`k=${k}: hit k at <= t${tHit}; armed walk from t${armedFrom}`);
    const DIRS4 = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    const solidAt = (x, y) => !!world.collidesSolid({ x: x - 6, y: y - 6, right: x + 6, bottom: y + 6 });
    const cands = [];
    for (let i = 1; i < tr.length; i += 1) {
        const [t, x, y, h] = tr[i];
        if (armedFrom === null || t < armedFrom + 10 || h !== k) continue;
        if (Math.abs(x - tr[i - 1][1]) < 1e-6 && Math.abs(y - tr[i - 1][2]) < 1e-6) break; // parked again
        for (const [key, [ux, uy]] of Object.entries(DIRS4)) {
            const wand = WEAPON === 'wand';
            // after the first lava hit `maxForce` is 2, and both items' shoves are clamped by it except the
            // Shield x1's direct `knockback(5)` (`Player.as:1705`, no `hit()`, so no clamp)
            const f = wand ? (k > 0 ? 2 : 3) : (WEAPON === 'shield2' && k > 0 ? 2 : 5);
            const c = finalBossCoast({ x, y, px: x - (wand ? 8 : 10) * ux, py: y - (wand ? 8 : 10) * uy, force: f, hits: 1, solidAt });
            const lavaStep = c.steps.find((st) => finalBossLavaVerdict(world.tiles, st.x, st.y).hit);
            if (!lavaStep) continue;
            const lead = wand ? 30 : 22;
            const sx = Math.round(x - lead * ux); const sy = Math.round(y - lead * uy);
            if (!passBase[Math.round(sy / G) * N + Math.round(sx / G)]) continue;
            cands.push(wand ? { T: t, sx, sy, key, wand: true, wlead: 6, bx: x, by: y }
                : { T: t, sx, sy, key, hold: Number(arg('hold', '14')), bx: x, by: y });
        }
    }
    const pick = [];
    for (const c of cands) if (!pick.some((p) => Math.abs(p.T - c.T) < 10)) pick.push(c);
    console.log(`${cands.length} candidates; picking ${Math.min(pick.length, Number(arg('n', '4')))}`);
    for (const c of pick.slice(0, Number(arg('n', '4')))) {
        const { bx, by, ...q } = c;
        const sp = { pushes: [...spec.pushes, q], ticks: c.T + Number(arg('after', '420')), exitFrom: null };
        const name = `q3-${WEAPON}-s${SEED}-k${k + 1}-t${c.T}-${c.key}`;
        writeFileSync(join(arg('outdir'), `${name}.spec.json`), `${JSON.stringify(sp)}\n`);
        const r = writeStage(sp, join(arg('outdir'), `${name}.json`), name);
        console.log('STAGETAPE', name, `boss(${bx},${by})`, JSON.stringify(r));
    }
    process.exit(0);
}

if (arg('orbit-tape')) {
    // the control: the intro press and the orbit only — no shove of any kind, for `--ticks`
    const ticks = Number(arg('ticks', '1500'));
    const { run, keys, error } = drive([], [], ticks);
    const inputs = [...keysToSpans(keys), { key: 'primary', from: INTRO_PRESS, to: INTRO_PRESS + 1 }];
    const name = `q3-${WEAPON}-orbit-s${SEED}`;
    writeFileSync(arg('orbit-tape'), `${serializeTape(parseTape({
        tape_version: 7, game: 'seedling', name,
        description: `rules-l112-owl-executor Q3 control: ${WEAPON} (${JSON.stringify(ITEMS)}), seed ${SEED}, boot at the L111 `
            + `arrival, intro press t${INTRO_PRESS}, then the ${ORBIT_NAME} dodge orbit for ${ticks} ticks and nothing else `
            + `(one full pod cycle and more). Model: hits ${JSON.stringify(run.playerHits.map((h) => `t${h.t} ${h.source}`))}, `
            + `lava ${run.finalBossLava.length}, error ${error ?? 'none'}.`,
        boot: BOOT, noclip: false, noDamage: false, noHazards: [], grants: GRANTS, persistence: [], equips: EQUIPS,
        pins: PINS, save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, tick_count: ticks, inputs,
    }))}\n`);
    console.log('ORBITTAPE', name, 'hits', run.playerHits.map((h) => `t${h.t} ${h.source}`), 'lava', run.finalBossLava.length, error);
    process.exit(0);
}
if (process.argv.includes('--trace')) {
    const { run, keys, error } = drive([], [], Number(arg('ticks', '700')));
    const ot = run.owlTicks;
    for (let t = 0; t < keys.length; t += 10) {
        const o = ot[t];
        console.log(t, keys[t].join('+'), o ? `boss(${o.bossX.toFixed(1)},${o.bossY.toFixed(1)}) ${o.phase}` : '');
    }
    console.log('error', error, 'hits', run.playerHits.map((h) => `t${h.t} ${h.source}`), 'end', run.state.x, run.state.y);
    process.exit(0);
}
const t0 = Date.now();
const res = search();
const report = { weapon: WEAPON, seed: SEED, orbit: ORBIT_NAME, boot: BOOT, drives, wallSec: 0 };
if (!res.triple) {
    report.ok = false;
    report.tried = res.tried;
    report.wallSec = Math.round((Date.now() - t0) / 1000);
    console.log('NOPLAN', JSON.stringify(report));
    if (arg('report')) writeFileSync(arg('report'), `${JSON.stringify(report, null, 1)}\n`);
    process.exit(2);
}
const { triple, f } = res;
const presses = triple.map((s) => s.t);
const pressSpans = (ts) => ts.map((t) => ({ key: 'primary', from: t, to: t + 1 }));
const inputs = [...keysToSpans(f.d.keys), ...pressSpans([INTRO_PRESS, ...presses])];
const name = `owl-${WEAPON}-s${SEED}`;
const tape = parseTape({
    tape_version: 7, game: 'seedling', name,
    description: `rules-l112-owl-executor: ${WEAPON} only, rng seed ${SEED} (split), boot at the L111 arrival `
        + `(112, 32, 208); intro press t${INTRO_PRESS}; shoves ${triple.map((s) => `t${s.t}@(${s.x},${s.y})`).join(' ')}; `
        + `orbit ${ORBIT_NAME}; tags t${f.tag}; exit from t${f.exitFrom} through rocklock@112,16 into L113. `
        + 'Authored by owl-executor.mjs (closed-loop over levelRun, emitted open-loop).',
    boot: BOOT, noclip: false, noDamage: false, noHazards: [], grants: GRANTS, persistence: [], equips: EQUIPS,
    pins: PINS, save: { totem_parts: [], keys: [], seal_parts: [] }, rng: RNG, tick_count: f.ticks, inputs,
});
// the replay of the SPANS (what the game reads) must reproduce the drive
const rr = freshRun();
for (let t = 0; t < tape.tick_count; t += 1) rr.advance(heldKeysAt(tape, t));
Object.assign(report, {
    ok: rr.level === 113 && rr.playerHits.length === 0 && rr.finalBossFlags.length === 2,
    shoves: triple, introPress: INTRO_PRESS, ticks: tape.tick_count, tagTick: f.tag, exitFrom: f.exitFrom,
    model: {
        level: rr.level, end: { x: rr.state.x, y: rr.state.y }, hits: rr.playerHits.map((h) => `t${h.t} ${h.source}`),
        lava: rr.finalBossLava.map((l) => l.t), flags: rr.finalBossFlags.map((q) => `${q.level}:${q.tag}`),
        shovesLanded: rr.finalBossShoves.filter((h) => h.landed).length, shoveTests: rr.finalBossShoves.length,
        rocks: rr.owlRockLandings.length, rocksOnPlayer: rr.owlRockLandings.filter((r) => r.hitPlayer).length,
        grenades: rr.owlGrenadeEvents.filter((g) => g.what === 'spawned').length,
    },
    tried: res.tried, drives, wallSec: Math.round((Date.now() - t0) / 1000),
});
console.log('PLAN', JSON.stringify(report));
if (arg('out')) writeFileSync(arg('out'), `${serializeTape(tape)}\n`);
if (arg('report')) writeFileSync(arg('report'), `${JSON.stringify(report, null, 1)}\n`);
