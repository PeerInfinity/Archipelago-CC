// rules-k-chaser-narrowing — CANDIDATE narrowings of rule K (seedlingArrivalGuards.js), as pure functions over K's own grid
// inputs (grid, tileTypes, body, spawn centre, exempt). EVIDENCE ONLY: nothing in the producer imports this file unless
// the throwaway hook (`producer-hook.patch`) is applied and K_NARROW is set.
//
// K as built is the base: its terms, its leash zone and its cut (`AG.chaserGuardCells`). Each narrowing only REMOVES a body
// or a cut cell; none adds one.
//
//  (b) PURSUIT SPEED. A body is charged only if its pursuit speed beats the player's on some terrain of its own flood.
//      Both speeds are MEASURED off the repo's AS3 ports, never typed: the player's `playerPhysicsV1.step` (Player.as:73
//      dMS, 1515-1555 input, Mobile.as:73-84 friction; lava/water: Player.as:544-548 moveSpeeds[17] + WATER_FRICTION),
//      a chaser's `chasers.chaserStep` (Bob.as:57-75 / Puncher.as:62-73 + Mobile.friction), a teleport-hopper's
//      `drill.stepDrill` + `stepDrillGraphic` (Drill.as:85-110: one tile per axis per drill+undrill cycle). Per axis:
//      the escape that matters is the player walking AWAY along an axis.
//  (c) STEP-RULE FOLLOW. A cut cell counts only if the body, from its spawn, steering at a player STANDING in that cell,
//      reaches contact under its own step rule (the same ports) with axis-separated moves against the cells its
//      `solids` stop (Mobile.as:86-118; walls, sinks, entity-gated cells; `bodyRegion`'s own predicate) and dying on
//      its lethal tiles (Enemy.as:68-91, the tile under its centre). Contact = `Enemy.hitPlayer`'s box overlap
//      (Enemy.as:211-221) for a chaser, the drill's contact (`stepDrill`), and the punch box at `endAnim` for a puncher
//      (Puncher.as:111-117,127-143; `chasers.puncherPunchRect`). The standing point is sampled at 9 points of the cell
//      (inset 3 px, the player's box kept clear of blocking cells); ANY reached point keeps the cell (strict side).
//  RACE. A cut cell counts only where the body, waking at its spawn when the player first comes within `runRange`
//      (Bob.as:58), closes to contact before the player has crossed the cell and left `runRange` of the body. The player
//      walks a straight line through the cell's centre along each crossing axis (the cut's own outside neighbour), both
//      ways, from up to `runRange + 2T` behind, at the engine's walk for the terrain under it; where its line is blocked
//      it stands. Lost in either direction → charged.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const imp = (p) => import(pathToFileURL(path.join(repo, p)));
const AG = await imp('scripts/procgen/seedlingArrivalGuards.js');
const FCG = await imp('scripts/procgen/seedlingFireChaserGuard.js');
const HP = await imp('scripts/procgen/seedlingHolderParking.js');
const CH = await imp('frontend/modules/seedlingDemo/chasers.js');
const DR = await imp('frontend/modules/seedlingDemo/drill.js');
const PP = await imp('frontend/modules/seedlingDemo/playerPhysicsV1.js');
const { ENEMY_CLASSES } = await imp('frontend/modules/seedlingDemo/combat.js');
const { TERRAIN_TILE } = HP;
const T = HP.T;
const { BLOCKING } = HP;

// ── the player's box (Player.as normalHitbox 4×5, origin 2,2) and terrain ─────────────────────────────────────────────
const PB = PP.HITBOX;
const playerBox = (x, y) => ({ x: x - PB.originX, y: y - PB.originY, right: x - PB.originX + PB.width, bottom: y - PB.originY + PB.height });
const overlap = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
const SWIM_TILES = new Set([TERRAIN_TILE.water, TERRAIN_TILE.lava].filter((t) => t !== undefined));
const playerTerrain = (t) => (SWIM_TILES.has(t)
    ? { moveSpeed: PP.MOVE_SPEEDS[t], friction: PP.WATER_FRICTION }
    : { moveSpeed: PP.WALK_SPEED, friction: PP.DEFAULT_FRICTION });

// ── (b) speeds, measured ─────────────────────────────────────────────────────────────────────────────────────────────
const N = 600, WARM = 60;
function measurePlayer({ moveSpeed, friction }) {
    let s = { x: 5e4, y: 5e4, vx: 0, vy: 0 };
    let x0 = 0;
    for (let t = 0; t < N; t += 1) {
        if (t === WARM) x0 = s.x;
        s = { ...s, ...PP.step(s, new Set(['right']), { world: { width: 1e5, height: 1e5 }, moveSpeed, friction }) };
    }
    return (s.x - x0) / (N - WARM);
}
function measureChaser(tag, moveSpeed) {
    let e = { x: 0, y: 0, v: { x: 0, y: 0 }, moveSpeed, runRange: 1e9 };
    let x0 = 0;
    for (let t = 0; t < N; t += 1) {
        if (t === WARM) x0 = e.x;
        const r = CH.chaserStep(tag, e, { x: 1e7, y: 0 }, { onScreen: true });
        e = { ...e, x: r.x, y: r.y, v: r.v };
    }
    return (e.x - x0) / (N - WARM);
}
function measureHopper() {
    let d = DR.newDrill({ id: 0, x: 0, y: 0 });
    let x0 = 0;
    for (let t = 0; t < N; t += 1) {
        if (t === WARM) x0 = d.x;
        const r = DR.stepDrill(d, { frozen: false, onScreen: () => true, playerBox: null, player: { x: d.x + 30, y: d.y }, lineBlocked: () => false, collides: () => false, hitPlayer: (x) => x });
        d = DR.stepDrillGraphic(r.d);
    }
    return (d.x - x0) / (N - WARM);
}
const speedCache = new Map();
export function playerSpeedOn(tileType) {
    const k = `p${SWIM_TILES.has(tileType) ? 'swim' : 'walk'}`;
    if (!speedCache.has(k)) speedCache.set(k, measurePlayer(playerTerrain(tileType)));
    return speedCache.get(k);
}
export function bodySpeedOn(tag, tileType) {
    const row = ENEMY_CLASSES[tag];
    const byT = CH.CHASERS[tag]?.speedByTerrain;
    const swim = byT && byT.swimTiles.includes(tileType);
    const k = `${tag}:${swim ? 'swim' : 'walk'}`;
    if (!speedCache.has(k)) {
        let v;
        if (row?.aggro?.kind === 'teleport-hop') v = measureHopper();
        else if (CH.CHASERS[tag]) v = measureChaser(tag, byT ? (swim ? byT.swim : byT.walk) : row.speed);
        else v = row?.speed ?? 0; // no port: the census's nominal speed (never smaller, the strict side)
        speedCache.set(k, v);
    }
    return speedCache.get(k);
}
/** (b): the terrains of the body's flood on which it out-runs the player. */
export function pursuitFaster(tag, terrainTypes) {
    return terrainTypes.filter((t) => bodySpeedOn(tag, t) > playerSpeedOn(t));
}

// ── the grid as the body's and the player's solids ────────────────────────────────────────────────────────────────────
// STATICS (K_NARROW_STATICS=1): a mover whose `solids` holds "Enemy" (Bob.as:39, LavaRunner.as:43, Puncher.as:48,
// Drill.as:35; `chasers.chaserSolids`) is stopped by every other body; the ones that never move (census speed 0, no
// homing aggro) are taken at their resting hitbox (`ENEMY_CLASSES[tag].ctor` + `hitbox`). Moving bodies are left out.
export function staticBoxes(self, bodies, centreOf) {
    if (process.env.K_NARROW_STATICS !== '1') return [];
    const out = [];
    for (const b of bodies ?? []) {
        if (b === self) continue;
        const row = ENEMY_CLASSES[b.tag];
        if (!row?.hitbox || !(row.speed === 0) || FCG.HOMING_AGGRO[row.aggro?.kind]) continue;
        const [cx, cy] = centreOf(b);
        const { w, h, ox, oy } = row.hitbox;
        out.push({ x: cx - ox, y: cy - oy, right: cx - ox + w, bottom: cy - oy + h, tag: b.tag });
    }
    return out;
}
const blocksEnemy = (tag) => (ENEMY_CLASSES[tag]?.aggro?.kind === 'teleport-hop' ? true : CH.chaserSolids(tag).includes('Enemy'));
// The player's walk for a cut cell: the cells it can stand in holding exactly what that cell asks (its conditions, e.g.
// the Dark Suit on lava; none on floor) — a cell asking anything else is a wall to it. The cheapest player who stands in
// the cut cell is the one K's charge prices.
const condKeys = (cell) => new Set((cell.conditions ?? []).map((c) => JSON.stringify(c)));
export function solidsOf(body, cls, grid, tileTypes, statics = [], standIn = null) {
    const { width, height, cells } = grid;
    const TERRAIN_IDS = new Set(Object.values(TERRAIN_TILE));
    const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < width && cy < height;
    const lethal = (i) => cls.lethalTiles.has(tileTypes.get(i));
    const bodyBlocked = (cx, cy) => {
        if (!inside(cx, cy)) return true;
        const i = cy * width + cx;
        if (lethal(i) || cls.passesWalls) return false;
        if (BLOCKING.has(cells[i].kind)) return true;
        return !((cells[i].conditions ?? []).length === 0 || TERRAIN_IDS.has(tileTypes.get(i)));
    };
    const wallLine = (cx, cy) => !inside(cx, cy) || cells[cy * width + cx].kind === 'wall';
    const held = standIn === null ? null : condKeys(cells[standIn]);
    const playerBlocked = (cx, cy) => {
        if (!inside(cx, cy)) return true;
        const cell = cells[cy * width + cx];
        if (BLOCKING.has(cell.kind)) return true;
        return held !== null && [...condKeys(cell)].some((k) => !held.has(k));
    };
    const boxHits = (r, blocked) => {
        for (let cy = Math.floor(r.y / T); cy <= Math.floor((r.bottom - 1e-9) / T); cy += 1) {
            for (let cx = Math.floor(r.x / T); cx <= Math.floor((r.right - 1e-9) / T); cx += 1) if (blocked(cx, cy)) return true;
        }
        return false;
    };
    const tileAt = (x, y) => tileTypes.get(Math.floor(y / T) * width + Math.floor(x / T));
    const lethalAt = (x, y) => inside(Math.floor(x / T), Math.floor(y / T)) && cls.lethalTiles.has(tileAt(x, y));
    const lineBlocked = (x0, y0, x1, y1) => {
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let s = 0; s <= n; s += 1) {
            const px = x0 + ((x1 - x0) * s) / Math.max(n, 1), py = y0 + ((y1 - y0) * s) / Math.max(n, 1);
            if (wallLine(Math.floor(px / T), Math.floor(py / T))) return true;
        }
        return false;
    };
    const st = blocksEnemy(body.tag) ? statics : [];
    const bodyBoxHits = (r) => boxHits(r, bodyBlocked) || st.some((b) => overlap(r, b));
    return { bodyBlocked, playerBlocked, boxHits, bodyBoxHits, tileAt, lethalAt, lineBlocked };
}

// Mobile.moveX / moveY: unit steps, the fractional rest last, stopped by the first blocked step.
function sweep(x, y, dx, dy, boxAt, hit) {
    for (const [axis, rel] of [['x', dx], ['y', dy]]) {
        const n = Math.abs(rel);
        for (let i = 0; i < n; i += 1) {
            const step = Math.min(1, n - i) * Math.sign(rel);
            const nx = axis === 'x' ? x + step : x, ny = axis === 'y' ? y + step : y;
            if (hit(boxAt(nx, ny))) break;
            x = nx; y = ny;
        }
    }
    return { x, y };
}

/**
 * One body against a player trajectory `playerAt(t)` (→ {x, y}, or null once the race is over). Returns the first contact
 * tick or null. `wakeAt(t, p)` gates the body's start (the race); (c) wakes at t = 0.
 */
/**
 * One mover's per-tick step (the ports, against S's solids). `others()` = the other movers' current boxes, which stop this
 * one when its `solids` hold "Enemy". `step(t, p)` returns true on contact this tick.
 */
function makeMover(body, centre, cls, S, { leash = true } = {}) {
    const tag = body.tag;
    const row = ENEMY_CLASSES[tag];
    const isHop = row.aggro.kind === 'teleport-hop';
    const attack = CH.CHASERS[tag]?.attack ?? null;
    const byT = CH.CHASERS[tag]?.speedByTerrain;
    const { w, h, ox, oy } = row.hitbox;
    const boxAt = (x, y) => ({ x: x - ox, y: y - oy, right: x - ox + w, bottom: y - oy + h });
    const enemySolid = blocksEnemy(tag);
    let e = { x: centre[0], y: centre[1], v: { x: 0, y: 0 }, moveSpeed: byT ? byT.walk : undefined, attack: null, ...(leash ? {} : { runRange: 1e9 }) };
    let d = isHop ? DR.newDrill({ id: 0, x: centre[0] - DR.DRILL.dx, y: centre[1] - DR.DRILL.dy }) : null;
    const m = { body, awake: false, dead: false, windup: 0, others: () => [] };
    m.pos = () => (isHop ? [d.x, d.y] : [e.x, e.y]);
    m.box = () => (isHop ? DR.drillRect(d) : boxAt(e.x, e.y));
    const blockedBy = (rr) => S.bodyBoxHits(rr) || (enemySolid && m.others().some((b) => overlap(rr, b)));
    m.step = (t, p) => {
        if (m.dead) return false;
        const pb = playerBox(p.x, p.y);
        if (isHop) {
            // (c) has no leash: the hop's direction reads only the signs of |dx|, |dy| > Tile/2 (Drill.as:90-97), so a
            // point clamped to 30 px per axis hops the same way inside runRange; the line test stays on the real segment.
            const cl = (v) => Math.sign(v) * Math.min(Math.abs(v), 30);
            const pp = leash ? p : { x: d.x + cl(p.x - d.x), y: d.y + cl(p.y - d.y) };
            const r = DR.stepDrill(d, {
                frozen: false, onScreen: () => true, playerBox: pb, player: pp, lineBlocked: () => S.lineBlocked(d.x, d.y, p.x, p.y),
                collides: blockedBy, hitPlayer: (x) => x,
            });
            d = DR.stepDrillGraphic(r.d);
            if (S.lethalAt(d.x, d.y)) m.dead = true;
            return r.contact;
        }
        const hitsPlayer = tag === 'puncher' ? (rr) => overlap(rr, pb) : () => false; // Puncher.as:48 solids += "Player"
        const move = (x, y, dx, dy) => sweep(x, y, dx, dy, boxAt, (rr) => blockedBy(rr) || hitsPlayer(rr));
        const r = CH.chaserStep(tag, { ...e, attack: m.windup > 0 ? {} : null }, p, { onScreen: true, move });
        e = { ...e, x: r.x, y: r.y, v: r.v };
        if (S.lethalAt(e.x, e.y)) { m.dead = true; return false; } // Enemy.as:68-91
        if (byT) e.moveSpeed = byT.swimTiles.includes(S.tileAt(e.x, e.y)) ? byT.swim : byT.walk; // LavaRunner.as:84-93
        if (attack) {
            if (m.windup > 0) {
                m.windup -= 1;
                if (m.windup === 0 && overlap(CH.puncherPunchRect(tag, e, p).rect, pb)) return true; // endAnim → attackPlayer
            } else if (CH.chaserAttackDecision(tag, { ...e, attack: null }, p)) {
                m.windup = CH.animTicks(attack.anim.frames, attack.anim.rate);
            }
            return false;
        }
        return CH.chaserContactHits(tag) !== false && overlap(boxAt(e.x, e.y), pb); // Enemy.hitPlayer
    };
    return m;
}

/**
 * Step one body (index 0 of `movers` is the one asked about; the rest are its room-mates, stepped with it in room order
 * when K_NARROW_JOINT=1, each a solid to the others). Returns the first tick body 0 makes contact, or null.
 * `peers` = [{body, centre, cls, S}] for the room-mates.
 */
export function chase(body, centre, cls, S, playerAt, { maxTicks = 600, wake = () => true, leash = true, onPos = null, peers = [] } = {}) {
    const self = makeMover(body, centre, cls, S, { leash });
    const all = [self, ...peers.map((q) => makeMover(q.body, q.centre, q.cls, q.S, { leash }))];
    // FlashPunk `World.addUpdate` PREPENDS (World.as:937-951): the entity added last updates first.
    const order = [...all].sort((a, b) => (b.body.order ?? 0) - (a.body.order ?? 0));
    for (const m of all) m.others = () => all.filter((o) => o !== m && !o.dead).map((o) => o.box());
    const wakeOf = new Map(all.map((m, k) => [m, k === 0 ? wake : (t, p) => Math.hypot(p.x - (peers[k - 1].centre[0]), p.y - peers[k - 1].centre[1]) <= peers[k - 1].cls.runRange]));
    for (let t = 0; t < maxTicks; t += 1) {
        const p = playerAt(t);
        if (!p) return null;
        let contact = false;
        for (const m of order) {
            if (!m.awake) m.awake = wakeOf.get(m)(t, p);
            if (!m.awake) continue;
            const c = m.step(t, p);
            if (m === self && c) contact = true;
        }
        if (onPos && self.awake) onPos(...self.pos(), t);
        if (contact) return t;
        if (self.dead) return null;
    }
    return null;
}

const cellXY = (i, width) => [i % width, Math.floor(i / width)];

/** (c): does the body reach a player standing anywhere (9 samples) in cell i? */
export function followReaches(body, centre, cls, grid, tileTypes, i, { maxTicks = 600, statics = [] } = {}) {
    const S = solidsOf(body, cls, grid, tileTypes, statics, i);
    const [cx, cy] = cellXY(i, grid.width);
    const pts = [];
    for (const fx of [3, 8, 13]) for (const fy of [3, 8, 13]) pts.push([cx * T + fx, cy * T + fy]);
    for (const [px, py] of pts) {
        if (S.boxHits(playerBox(px, py), S.playerBlocked)) continue;
        if (chase(body, centre, cls, S, () => ({ x: px, y: py }), { maxTicks, leash: false }) !== null) return { reached: true, at: [px, py] };
    }
    return { reached: false };
}

/** RACE: does the body catch a player walking straight through cell i across to `n` (and back)? */
export function raceLost(body, centre, cls, grid, tileTypes, i, n, { maxTicks = 600, statics = [], peers = [] } = {}) {
    const S = solidsOf(body, cls, grid, tileTypes, statics, i);
    const { width } = grid;
    const [cx, cy] = cellXY(i, width);
    const [nx, ny] = cellXY(n, width);
    const runRange = cls.runRange;
    const out = [];
    for (const sgn of [1, -1]) {
        const dir = [(nx - cx) * sgn, (ny - cy) * sgn];
        const key = dir[0] > 0 ? 'right' : dir[0] < 0 ? 'left' : dir[1] > 0 ? 'down' : 'up';
        const mid = [cx * T + T / 2, cy * T + T / 2];
        // back up along -dir while the player's box stays clear, up to runRange + 2T
        let back = 0;
        while (back < runRange + 2 * T) {
            const bx = mid[0] - dir[0] * (back + 1), by = mid[1] - dir[1] * (back + 1);
            if (S.boxHits(playerBox(bx, by), S.playerBlocked)) break;
            back += 1;
        }
        let s = { x: mid[0] - dir[0] * back, y: mid[1] - dir[1] * back, vx: 0, vy: 0 };
        const traj = [];
        let crossed = false;
        let still = 0;
        for (let t = 0; t < maxTicks; t += 1) {
            traj.push({ x: s.x, y: s.y });
            const along = (s.x - mid[0]) * dir[0] + (s.y - mid[1]) * dir[1];
            if (along > T) crossed = true;
            const prev = traj[t - 1];
            still = prev && Math.hypot(s.x - prev.x, s.y - prev.y) < 1e-6 ? still + 1 : 0;
            if (still >= 2) { traj.stalled = t; traj.pop(); break; } // the straight walk ended (a wall)
            const terr = playerTerrain(S.tileAt(s.x, s.y));
            const collides = (x, y) => (S.boxHits(playerBox(x, y), S.playerBlocked) ? {} : null);
            s = { ...s, ...PP.step(s, new Set([key]), { world: { width: grid.width * T, height: grid.height * T }, collides, ...terr }) };
        }
        let bodyPos = null;
        const setPos = (x, y) => { bodyPos = [x, y]; };
        const result = { dir: key, start: [traj[0].x, traj[0].y], lost: false, tick: null, stalled: null, crossed };
        // the race ends once the player is past the cell and out of runRange of the spawn-woken body
        const tick = chase(body, centre, cls, S, (t) => {
            const p = traj[t];
            if (!p) return null;
            const along = (p.x - mid[0]) * dir[0] + (p.y - mid[1]) * dir[1];
            if (along > T && bodyPos && Math.hypot(p.x - bodyPos[0], p.y - bodyPos[1]) > runRange) return null;
            return p;
        }, {
            maxTicks,
            wake: (t, p) => Math.hypot(p.x - centre[0], p.y - centre[1]) <= runRange,
            onPos: setPos,
            peers,
        });
        result.lost = tick !== null;
        result.tick = tick;
        // a line that never got past the cell is no crossing in that direction; one that stalled inside the leash is
        // recorded (the player would have to turn: not modelled) and not charged
        if (!crossed) result.lost = false;
        if (!result.lost && traj.stalled !== undefined) result.stalled = traj.stalled;
        out.push(result);
    }
    return { lost: out.some((r) => r.lost), dirs: out };
}

/**
 * RACE FROM AN ARRIVAL: the player enters the room at `start` (a landing or door cell, `exempt` minus the trap tiles) and
 * walks the shortest 4-connected cell path (its own walkable cells for cut cell i) to i, on to `n`, and on along i→n as far as
 * it can. The body wakes when the player is within runRange of it (Bob.as:58), so a landing inside the leash wakes it at
 * once. Lost = contact before the player has passed i and is beyond runRange of the body.
 */
export function arrivalRaceLost(body, centre, cls, grid, tileTypes, i, n, start, { maxTicks = 900, statics = [], debug = null, peers = [] } = {}) {
    const S = solidsOf(body, cls, grid, tileTypes, statics, i);
    const { width, height } = grid;
    const walk = (k) => { const [x, y] = cellXY(k, width); return !S.playerBlocked(x, y); };
    const bfs = (a, b) => {
        const prev = new Map([[a, -1]]); const q = [a];
        while (q.length) {
            const u = q.shift();
            if (u === b) break;
            const [x, y] = cellXY(u, width);
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const v = ny * width + nx;
                if (prev.has(v) || !walk(v)) continue;
                prev.set(v, u); q.push(v);
            }
        }
        if (!prev.has(b)) return null;
        const out = []; for (let u = b; u !== -1; u = prev.get(u)) out.unshift(u);
        return out;
    };
    if (!walk(start) || !walk(i) || !walk(n)) return { lost: false, why: 'unwalkable' };
    const p1 = bfs(start, i);
    if (!p1) return { lost: false, why: 'no path' };
    const [ix, iy] = cellXY(i, width), [nx0, ny0] = cellXY(n, width);
    const dir = [nx0 - ix, ny0 - iy];
    const cellsPath = [...p1, n];
    for (let k = 1; k < 40; k += 1) {
        const x = nx0 + dir[0] * k, y = ny0 + dir[1] * k;
        if (x < 0 || y < 0 || x >= width || y >= height || !walk(y * width + x)) break;
        cellsPath.push(y * width + x);
    }
    const targets = cellsPath.map((k) => { const [x, y] = cellXY(k, width); return [x * T + T / 2, y * T + T / 2]; });
    const mid = [ix * T + T / 2, iy * T + T / 2];
    let s = { x: targets[0][0], y: targets[0][1], vx: 0, vy: 0 };
    let ti = 1;
    const traj = [];
    let passedAt = null;
    let still = 0;
    for (let t = 0; t < maxTicks && ti < targets.length; t += 1) {
        traj.push({ x: s.x, y: s.y });
        const [tx, ty] = targets[ti];
        if (Math.abs(tx - s.x) <= 2 && Math.abs(ty - s.y) <= 2) ti += 1;
        if (passedAt === null && ti > p1.length) passedAt = t; // reached n: the cell is crossed
        const held = new Set();
        const [gx, gy] = targets[Math.min(ti, targets.length - 1)];
        if (gx - s.x > 1) held.add('right'); else if (s.x - gx > 1) held.add('left');
        if (gy - s.y > 1) held.add('down'); else if (s.y - gy > 1) held.add('up');
        const terr = playerTerrain(S.tileAt(s.x, s.y));
        const collides = (x, y) => (S.boxHits(playerBox(x, y), S.playerBlocked) ? {} : null);
        const prev = traj[t - 1];
        s = { ...s, ...PP.step(s, held, { world: { width: width * T, height: height * T }, collides, ...terr }) };
        still = prev && Math.hypot(s.x - prev.x, s.y - prev.y) < 1e-6 ? still + 1 : 0;
        if (still >= 30) break;
    }
    let bodyAt = null;
    const tick = chase(body, centre, cls, S, (t) => {
        const p = traj[t];
        if (!p) return null;
        if (passedAt !== null && t >= passedAt && bodyAt && Math.hypot(p.x - bodyAt[0], p.y - bodyAt[1]) > cls.runRange) return null;
        return p;
    }, { maxTicks, wake: (t, p) => Math.hypot(p.x - centre[0], p.y - centre[1]) <= cls.runRange, onPos: (x, y, t) => { bodyAt = [x, y]; if (debug) debug.body[t] = [x, y]; }, peers });
    void mid;
    if (debug) { debug.traj = traj; debug.path = cellsPath.map((k) => cellXY(k, width)); }
    return { lost: tick !== null && (passedAt === null || tick <= traj.length), tick, passedAt, from: cellXY(start, width), steps: traj.length };
}

/** Every variant's cut for one body: K, b, c, bc, bcr. */
export function narrowBody(body, { grid, tileTypes, centre, exempt, statics = [], starts = [], peers = [] }) {
    const v = AG.chaserGuardCells(body, { grid, tileTypes, centre, exempt });
    if (!v.guards || v.cut.size === 0) return null;
    const cls = FCG.guardClassOf(body.tag);
    const { region } = FCG.bodyRegion(body, cls, { tiles: [] }, grid, tileTypes);
    const terrainTypes = [...new Set([...region].map((i) => tileTypes.get(i) ?? null))];
    const faster = pursuitFaster(body.tag, terrainTypes);
    const b = faster.length > 0;
    const { width, height, cells } = grid;
    const playerCell = (i) => !BLOCKING.has(cells[i].kind);
    const followed = (i) => region.has(i) || [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
        const [x, y] = cellXY(i, width);
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < width && ny < height && region.has(ny * width + nx);
    });
    const perCell = [];
    for (const i of [...v.cut].sort((a, z) => a - z)) {
        const fr = followReaches(body, centre, cls, grid, tileTypes, i, { statics });
        const [x, y] = cellXY(i, width);
        const outs = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy])
            .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height)
            .map(([nx, ny]) => ny * width + nx)
            .filter((n) => !v.zone.has(n) && playerCell(n) && followed(n));
        const races = outs.map((n) => raceLost(body, centre, cls, grid, tileTypes, i, n, { statics, peers }));
        const arrivals = [];
        for (const st of starts) for (const n of outs) {
            const a = arrivalRaceLost(body, centre, cls, grid, tileTypes, i, n, st, { statics, peers });
            arrivals.push({ n: cellXY(n, width), ...a });
        }
        perCell.push({ cell: [x, y], c: fr.reached, cAt: fr.at ?? null, race: races.some((r) => r.lost), arrival: arrivals.some((a) => a.lost), races, arrivals });
    }
    const cells_ = (pred) => perCell.filter(pred).map((r) => r.cell);
    return {
        body: v.body, tag: body.tag, speedNominal: v.speed, faster, b,
        speeds: Object.fromEntries(terrainTypes.map((t) => [String(t), { body: bodySpeedOn(body.tag, t), player: playerSpeedOn(t) }])),
        cut: {
            K: cells_(() => true),
            b: b ? cells_(() => true) : [],
            c: cells_((r) => r.c),
            bc: b ? cells_((r) => r.c) : [],
            bcr: b ? cells_((r) => r.c && r.race) : [],
            r: cells_((r) => r.race),
            // RACE with arrivals: the straight crossings OR a walk in from a landing/door
            bcR: b ? cells_((r) => r.c && (r.race || r.arrival)) : [],
            bR: b ? cells_((r) => r.race || r.arrival) : [],
            R: cells_((r) => r.race || r.arrival),
        },
        perCell,
    };
}

/**
 * JOINT (K_NARROW_JOINT=1): the body's room-mates that move after the player (homers the ports step), each with its own
 * solids, stepped with it in room order. Every mover whose `solids` hold "Enemy" is stopped by the others' boxes
 * (Bob.as:39, LavaRunner.as:43, Puncher.as:48, Drill.as:35).
 */
export function peersOf(body, { grid, tileTypes, bodies, centreOf }) {
    if (process.env.K_NARROW_JOINT !== '1') return [];
    bodies.forEach((b, k) => { b.order = k; });
    return bodies.filter((b) => b !== body && FCG.guardClassOf(b.tag).homing && (CH.CHASERS[b.tag] || ENEMY_CLASSES[b.tag]?.aggro?.kind === 'teleport-hop'))
        .map((b) => {
            const cls = FCG.guardClassOf(b.tag);
            return { body: b, centre: centreOf(b), cls, S: solidsOf(b, cls, grid, tileTypes, staticBoxes(b, bodies, centreOf), null) };
        });
}

/** The producer-shaped stamp for one variant (K_NARROW = K | b | c | bc | bcr | r). */
export function stampArrivalGuards(room, opts = {}) {
    const variant = opts.variant ?? process.env.K_NARROW ?? 'K';
    const { grid, tileTypes, bodies, centreOf, exempt = new Set(), pulls = [] } = room;
    const { width } = grid;
    if (process.env.K_NARROW_REPORT) globalThis.__kRooms = [...(globalThis.__kRooms ?? []), room];
    const guards = [];
    const refused = [];
    const armCells = new Map();
    const report = [];
    for (const body of bodies) {
        const trapTiles = new Set(pulls.map((p) => p.tile[1] * width + p.tile[0]));
        const starts = [...exempt].filter((k) => !trapTiles.has(k) && !BLOCKING.has(grid.cells[k]?.kind ?? 'wall'));
        const nb = narrowBody(body, { grid, tileTypes, centre: centreOf(body), exempt, statics: staticBoxes(body, bodies, centreOf), starts, peers: peersOf(body, room) });
        if (!nb) continue;
        report.push(nb);
        const cut = nb.cut[variant];
        if (!cut || cut.length === 0) continue;
        const arm = AG.killArmOf(body.tag);
        if (arm.refuse) { refused.push(`${nb.body}: ${arm.refuse}`); continue; }
        if (arm.free) continue;
        const k = JSON.stringify(arm.arm);
        if (!armCells.has(k)) armCells.set(k, { arm: arm.arm, cells: new Set() });
        for (const [x, y] of cut) armCells.get(k).cells.add(y * width + x);
        guards.push({ body: nb.body, speed: nb.speedNominal, runRange: FCG.guardClassOf(body.tag).runRange, zone: 0, cut });
    }
    let out = grid;
    for (const { arm, cells } of armCells.values()) out = AG.stampOccupancy(out, cells, arm);
    // T is left exactly as K's slice built it (this slice measures K only): reuse its own pass with no bodies.
    // K_NARROW_NO_T=1 leaves T off (the K-only matrix, as the prior slice's `Konly` runs).
    const t = process.env.K_NARROW_NO_T === '1' ? { grid: out, traps: [] }
        : AG.stampArrivalGuards({ grid: out, tileTypes, bodies: [], centreOf, exempt, pulls });
    if (process.env.K_NARROW_REPORT) globalThis.__kNarrowReport = [...(globalThis.__kNarrowReport ?? []), ...report];
    return { grid: t.grid, guards, traps: t.traps, refused };
}
