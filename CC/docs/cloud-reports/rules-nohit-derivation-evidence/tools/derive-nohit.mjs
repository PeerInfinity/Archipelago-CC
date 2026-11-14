#!/usr/bin/env node
/**
 * derive-nohit.mjs — slice rules-nohit-derivation (a REPORT tool, read by nothing).
 *
 * A GENERAL derivation of the wallflyer no-hit gates: for every level that holds a wallflyer, every pair of door
 * sides the flyers' flights separate, and every crossing direction, decide whether a NO-HIT line exists with no item,
 * and which arms give one. Inputs: the level record (atlas), the room's own solids (`levelWorld.buildLevelWorld`),
 * the transcribed `Enemies/WallFlyer.as` step (`seedlingDemo/wallFlyer.js`) and the transcribed player tick
 * (`seedlingDemo/playerPhysicsV1.js`), plus the arms' source constants quoted below. No level number, door or tile is
 * named anywhere in this file.
 *
 * ── THE RULE (the hint "a waiting spot off the flyer's ray at the far end of every flight", made exact) ──────────
 *   A WAITING SPOT, for a flyer configuration C (every flyer at rest somewhere), is a player position whose box is
 *   free of solids, touches no resting flyer's ray (`WallFlyer.as:62`: collideLine from the body along
 *   `decideMotion(moveSpeed)` for `attackRange` = 160 px) and overlaps no resting body. Standing or walking among
 *   waiting spots triggers nothing and is never hit. W(C) splits into components (4-connected pixels).
 *   A LANE is the player leaving a component of W(C) on a key hold of at most two straight segments (k1 for n1
 *   ticks, then k2 or nothing), simulated tick by tick against every flyer of the room, and ending — with no contact
 *   on any tick — at a waiting spot of the configuration the flyers have come to rest in (every flyer at rest).
 *   A crossing X -> Y exists iff a chain of lanes leads from the component holding X's landing to one holding Y's.
 *   (Without a flyer moving, the player walks freely inside a component, so only lanes need simulating.)
 *
 * ── THE ARMS (each from its source lines; a criterion, then the same crossing search) ──────────────────────────
 *   DISARM-AT-REST (Sword, Ghost Spear, Dark Shield, Wand): the arm calls `Enemy.hit` on the body (`Enemy.as:141`:
 *   a wallflyer has `onlyHitBy == ""`, so any `t` but "Fire" lands). `hitsMax` 3 / damage per strike = strikes to
 *   kill. The arm gives a line if, from waiting spots reachable from the entry side, its strike box reaches every
 *   body of the band AT REST (so nothing launches), after which the crossing is searched again with those bodies
 *   removed. Strike boxes: Sword `getSlashRect` (`Player.as:931-952`, Slash.png 16x32, scale 1) within
 *   `distanceRectPoint <= 16` and no Solid on the centre line (`Player.as:914-918`); Ghost Spear the 32x5 stab
 *   (`Player.as:966-982`, `spearX/Y` `:1341-1348`), damage 2; Wand a 3x3 shot spawned 16 px ahead (`Player.as:996-
 *   1001`, sprWand 16 wide), 3 px/tick for `tilesMove*16/3` = 16 ticks (`WandShot.as`), damage 0.5, and the kill's
 *   Explosion (`Enemy.as:205`, radius int(14)*0.65 -> 9) must miss the player; Dark Shield `shieldBump`
 *   (`Player.as:1693-1709`, damage 0.5, the 7x7 front box or 3x7 side box placed in `render`, `:1184-1250`) while
 *   the player moves.
 *   DEFLECT-IN-FLIGHT (Shield): `shieldBump` without the dark shield is `knockback` only (`:1705`), which on a
 *   wallflyer is `v = -v` (`WallFlyer.as:172-176`): nothing at rest, a reversal in flight. So the plain Shield is
 *   searched with the lane race itself, the shield box reversing a body it touches while the player moves.
 *   Fire: `hitByFire` false -> knockback only, like the plain Shield, but a fire cast is a projectile; not derived.
 *
 * ⚠ What this rule leaves out, by design: every other body in the room (Bobs, chasers), the camera's on-screen gate
 * (`Enemy.update`'s return; the trigger sits below it), and pushable blocks moving. A lane that a Bob would spoil is
 * still a lane here: the question is the wallflyer's.
 *
 * Run: node derive-nohit.mjs [--levels=22,25,27] [--arms=none,sword,spear,shield,darkshield,wand] [--json=out.json]
 *      [--quick] (coarser lanes) [--lane-dump=N] (print the found chain's lanes)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const SD = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { buildLevelWorld } = await import(join(SD, 'levelWorld.js'));
const WF = await import(join(SD, 'wallFlyer.js'));
const PP = await import(join(SD, 'playerPhysicsV1.js'));
const { collideLineSolid } = await import(join(SD, 'crusher.js'));

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const QUICK = process.argv.includes('--quick');
const TILE = 16;
const DIRS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], 'up+left': [-1, -1], 'up+right': [1, -1], 'down+left': [-1, 1], 'down+right': [1, 1] });
const KEYSETS = Object.fromEntries(Object.keys(DIRS).map((k) => [k, new Set(k.split('+'))]));
/** A RUNNING START: the velocity and displacement after holding `k` for `n` ticks from rest in open floor. */
const RUNWAY = new Map();
function runway(k, n) {
    const key = `${k}|${n}`;
    if (!RUNWAY.has(key)) {
        let s = { x: 0, y: 0, vx: 0, vy: 0 };
        for (let i = 0; i < n; i += 1) s = PP.step(s, KEYSETS[k], { world: { width: 1e6, height: 1e6 } });
        RUNWAY.set(key, s);
    }
    return RUNWAY.get(key);
}
const RUNWAY_TICKS = QUICK ? [5] : [2, 5];

// ── source constants (each quoted from its line above) ─────────────────────────────────────────────────────────
const HITS_MAX = 3;            // Enemy.as:22
const HITS_TIMER_MAX = 30;     // Enemy.as:24
const ARM = Object.freeze({
    sword: { damage: 1, kind: 'disarm' },           // Player.as:115
    spear: { damage: 2, kind: 'disarm' },           // Player.as:144
    darkshield: { damage: 0.5, kind: 'disarm' },    // Player.as:211
    wand: { damage: 0.5, kind: 'disarm' },          // WandShot.as damage
    shield: { kind: 'deflect' },                    // Player.as:1705
});

export function readMap() { return JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8')); }

/** A level's doors from its own links: `{to, rect, spawn}`, `spawn` the player's centre on the far room's link back. */
export function doorsOf(map, level) {
    return (level.entities ?? []).filter((e) => Number.isInteger(Number(e.attrs?.to)) && e.attrs.playerx !== undefined).map((e) => {
        const to = Number(e.attrs.to);
        const back = (map.levels.find((l) => l.level === to)?.entities ?? []).find((b) => Number(b.attrs?.to) === level.level && b.attrs.playerx !== undefined);
        if (!back) throw new Error(`L${level.level}'s door to L${to} has no link back`);
        return { to, x: e.x, y: e.y, spawn: { x: Number(back.attrs.playerx) + TILE / 2, y: Number(back.attrs.playery) + TILE / 2 } };
    });
}

function rect(x, y, w, h) { return { x, y, w, h, right: x + w, bottom: y + h }; }
const overlap = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
const pbox = (x, y) => { const b = PP.HITBOX; return rect(x - b.originX, y - b.originY, b.width, b.height); };

/**
 * The room's physics. `solid(rect)` answers `world.collidesSolid` through a 1-px solid bitmap and its summed-area
 * table: exact for solids whose edges sit on whole pixels (every tile, entity rect and pixel mask), which `--verify`
 * re-checks against `collidesSolid` on random rects. Outside the room is solid.
 */
function roomOf(level) {
    const world = buildLevelWorld(level);
    const W = level.width * TILE;
    const H = level.height * TILE;
    const sat = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y += 1) {
        let row = 0;
        for (let x = 0; x < W; x += 1) {
            row += world.collidesSolid(rect(x, y, 1, 1)) ? 1 : 0;
            sat[(y + 1) * (W + 1) + (x + 1)] = sat[y * (W + 1) + (x + 1)] + row;
        }
    }
    const solid = (r) => {
        const x0 = Math.floor(r.x); const y0 = Math.floor(r.y);
        const x1 = Math.ceil(r.right); const y1 = Math.ceil(r.bottom);
        if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) return true;
        if (x1 <= x0 || y1 <= y0) return false;
        return sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0] > 0;
    };
    const playerFree = (x, y) => !solid(pbox(x, y));
    const collidesXY = (x, y) => !playerFree(x, y);
    const fctx = (playerBox) => ({ collides: solid, probe: solid, tileTypeAt: () => 0, onScreen: () => true, playerBox, hitPlayer: (w) => w });
    return { level, world, solid, playerFree, collidesXY, box: { width: W, height: H }, W, H, fctx };
}

/** Every flyer settled to rest (its `check()`), as the room starts. */
function settledFlyers(room) {
    return (room.level.entities ?? []).filter((e) => e.type === 'wallflyer').map((e) => {
        let w = WF.newWallFlyer({ id: `wallflyer@${e.x},${e.y}`, x: e.x, y: e.y });
        for (let n = 0; n < 200; n += 1) { w = WF.stepWallFlyer(w, room.fctx(null)).w; if (!w.vx && !w.vy && n > 0) break; }
        return w;
    });
}
const atRest = (w) => w.removed || w.destroy || (w.vx === 0 && w.vy === 0);
const live = (w) => !w.removed && !w.destroy;
const configKey = (fl) => fl.map((w) => (live(w) ? `${w.x},${w.y}` : 'x')).join(';');

/** Would a player box here trigger a resting flyer (`WallFlyer.as:59-67`)? */
function triggers(w, box, room) {
    if (!live(w)) return false;
    const vt = WF.decideMotion(w, WF.WALLFLYER.moveSpeed, room.solid);
    const l = Math.hypot(vt.x, vt.y);
    if (!(l > 0)) return false;
    return !!collideLineSolid([box], w.x, w.y, w.x + WF.WALLFLYER.attackRange * (vt.x / l), w.y + WF.WALLFLYER.attackRange * (vt.y / l));
}

/** W(C) as a bitmap over integer pixels, and its components. */
function waitingMap(room, flyers) {
    const { W, H } = room;
    const ok = new Uint8Array(W * H);
    const rests = flyers.filter(live).map((w) => WF.wallFlyerRect(w));
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
            if (!room.playerFree(x, y)) continue;
            const b = pbox(x, y);
            if (rests.some((r) => overlap(r, b))) continue;
            if (flyers.some((w) => triggers(w, b, room))) continue;
            ok[y * W + x] = 1;
        }
    }
    const comp = new Int32Array(W * H).fill(-1);
    let n = 0;
    for (let i = 0; i < W * H; i += 1) {
        if (!ok[i] || comp[i] >= 0) continue;
        const q = [i];
        comp[i] = n;
        while (q.length) {
            const j = q.pop();
            const x = j % W;
            const y = (j - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                const k = ny * W + nx;
                if (ok[k] && comp[k] < 0) { comp[k] = n; q.push(k); }
            }
        }
        n += 1;
    }
    return { ok, comp, n };
}

/** The shield box `render` places (`Player.as:1184-1250`), from the player's position, velocity and facing. */
function shieldBox(p) {
    const SO = { x: 2, y: 3 };       // shieldOffset, Player.as:240
    const SS = { x: 4, y: 0 };       // shieldSideOffset, Player.as:241
    if (p.dir === 1 && p.vx === 0) return rect(p.x - SO.x - 3.5, p.y - SO.y - 3.5, 7, 7);
    if (p.dir === 3 && p.vx === 0) return rect(p.x + SO.x - 3.5, p.y + SO.y - 3.5, 7, 7);
    if (p.vx < 0 || (p.vx === 0 && p.dir === 2)) return rect(p.x - SS.x - 2, p.y + SS.y - 3.5, 3, 7);
    return rect(p.x + SS.x - 2, p.y + SS.y - 3.5, 3, 7);
}
/** Facing from the held keys (the last axis pressed wins in the game; a hold here is one key set, so: vertical first). */
function facing(keys, prev) {
    if (keys.has('up')) return 1;
    if (keys.has('down')) return 3;
    if (keys.has('left')) return 2;
    if (keys.has('right')) return 0;
    return prev;
}

/**
 * One tick of the lane world. Update order: flyers first (their contact and trigger tests read the box the player's
 * previous tick left: `stepWallFlyer`'s note, "the Player updates last"), then the player (`playerPhysicsV1.step` on
 * the room's solids), the shield bump first (`Player.update` -> `shieldBump`, the box the last `render` placed).
 */
function tick(room, st, keys, shield) {
    const box = pbox(st.p.x, st.p.y);
    let contact = false;
    let triggered = st.triggered;
    let fl = st.fl.map((w) => {
        if (!live(w)) return w;
        const r = WF.stepWallFlyer(w, room.fctx(box));
        if (r.contact) contact = true;
        if (r.launched) triggered = true;
        return r.w;
    });
    if (contact) return null;
    // `Player.update` calls `shieldBump()` (Player.as:530) BEFORE `super.update()` moves it (:575): the shield box is
    // the one the previous `render` placed, at the position and velocity the previous tick left.
    if (shield && Math.hypot(st.p.vx, st.p.vy) > 0) {
        const sb = shieldBox(st.p);
        fl = fl.map((w) => (live(w) && overlap(WF.wallFlyerRect(w), sb) ? { ...w, vx: -w.vx, vy: -w.vy } : w));
    }
    const s = PP.step({ x: st.p.x, y: st.p.y, vx: st.p.vx, vy: st.p.vy }, keys, { collides: room.collidesXY, world: room.box });
    const p = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, dir: facing(keys, st.p.dir) };
    return { p, fl, triggered, t: st.t + 1 };
}

/** One straight-hold lane, for the debug tools: hold k1 n1 ticks then k2 (or nothing) n2 ticks. */
function runLane(room, flyers0, start, k1, n1, k2, n2, { shield = false } = {}, onTick) {
    let st = { p: { x: start.x, y: start.y, vx: start.vx ?? 0, vy: start.vy ?? 0, dir: start.dir ?? facing(KEYSETS[k1], 3) }, fl: flyers0.map((w) => ({ ...w })), triggered: false, t: 0 };
    for (let t = 0; t < n1 + n2; t += 1) {
        const keys = t < n1 ? KEYSETS[k1] : (k2 ? KEYSETS[k2] : new Set());
        const nx = tick(room, st, keys, shield);
        if (!nx) return { contact: true, t };
        st = nx;
        if (onTick && onTick(t, st.p, st.fl, st.triggered, keys) === 'stop') return { contact: false, t };
    }
    return { contact: false };
}

/**
 * The crossing search: BFS over (component, configuration). Returns the reached components per configuration and,
 * for each, the lane chain that reached it.
 */
function searchCrossing(room, flyersInit, from, goals, { shield = false, budget = Infinity, log = () => {} } = {}) {
    const maps = new Map();
    const mapOf = (fl) => { const k = configKey(fl); if (!maps.has(k)) maps.set(k, waitingMap(room, fl)); return maps.get(k); };
    const W = room.W;
    const at = (m, x, y) => {
        const xi = Math.round(x);
        const yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= W || yi >= room.H) return -1;
        return m.ok[yi * W + xi] ? m.comp[yi * W + xi] : -1;
    };
    const m0 = mapOf(flyersInit);
    const c0 = at(m0, from.x, from.y);
    if (c0 < 0) return { error: `the entry spawn (${from.x},${from.y}) is not a waiting spot` };
    const seen = new Set([`${configKey(flyersInit)}|${c0}`]);
    const queue = [{ fl: flyersInit, comp: c0, chain: [] }];
    let lanes = 0;
    const reached = [];
    const holds = Object.keys(DIRS);
    const N1MAX = 40;          // the k1 hold, ticks
    const WINDOW = QUICK ? 10 : 16; // branch to k2 within this many ticks after the first launch
    const N2 = 40;
    while (queue.length) {
        const node = queue.shift();
        const m = mapOf(node.fl);
        // goal?
        for (const g of goals) if (at(m, g.x, g.y) === node.comp && !reached.some((r) => r.goal === g.name)) reached.push({ goal: g.name, chain: node.chain, config: configKey(node.fl) });
        if (reached.length === goals.length) break;
        // lane starts: component pixels within 3 px (Chebyshev) of a free, non-waiting pixel, every 2nd pixel.
        const starts = [];
        const STRIDE = QUICK ? 3 : 2;
        for (let y = 0; y < room.H; y += 1) {
            for (let x = (y % STRIDE); x < W; x += STRIDE) {
                if (m.comp[y * W + x] !== node.comp) continue;
                let edge = false;
                for (let dy = -3; dy <= 3 && !edge; dy += 1) {
                    for (let dx = -3; dx <= 3 && !edge; dx += 1) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= W || ny >= room.H) continue;
                        const k = ny * W + nx;
                        if (!m.ok[k] && room.playerFree(nx, ny)) edge = true;
                    }
                }
                if (edge) starts.push({ x, y });
            }
        }
        const NONE = new Set();
        // A lane ends where every flyer is at rest and the player, RELEASING the keys, coasts to a stop inside one
        // waiting component (every coast tick's position, with 1 px of margin): from there nothing can launch.
        const endAt = (st) => {
            if (!st.triggered || !st.fl.every(atRest)) return null;
            const mm = mapOf(st.fl);
            const c = at(mm, st.p.x, st.p.y);
            if (c < 0) return null;
            let q = { x: st.p.x, y: st.p.y, vx: st.p.vx, vy: st.p.vy };
            for (let i = 0; i < 12; i += 1) {
                for (const [ex, ey] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(mm, q.x + ex, q.y + ey) !== c) return null;
                if (Math.hypot(q.vx, q.vy) === 0) break;
                q = PP.step(q, NONE, { collides: room.collidesXY, world: room.box });
            }
            return c;
        };
        const record = (st, lane) => {
            const key = `${configKey(st.fl)}|${lane.c}`;
            if (seen.has(key)) return;
            seen.add(key);
            const L = { ...lane, end: { x: +st.p.x.toFixed(2), y: +st.p.y.toFixed(2) }, config: configKey(st.fl) };
            delete L.c;
            log(`  lane ${JSON.stringify(L)}`);
            queue.push({ fl: st.fl, comp: lane.c, chain: [...node.chain, L] });
        };
        for (const s of starts) {
            for (const k1 of holds) {
                // k1 heads out of the component within 4 px (else the lane is a walk inside it)
                const [dx, dy] = DIRS[k1];
                let out = false;
                for (let d = 1; d <= 4; d += 1) if (at(m, s.x + dx * d, s.y + dy * d) !== node.comp) out = true;
                if (!out) continue;
                for (const rd of [null, ...holds]) {
                    for (const ph of rd ? RUNWAY_TICKS : [0]) {
                        const rw = rd ? runway(rd, ph) : { x: 0, y: 0, vx: 0, vy: 0 };
                        // a running start: the walk that gave it lies in the component (its start and middle)
                        if (rd && (at(m, s.x - rw.x, s.y - rw.y) !== node.comp || at(m, s.x - rw.x / 2, s.y - rw.y / 2) !== node.comp)) continue;
                        let st = { p: { x: s.x, y: s.y, vx: rw.vx, vy: rw.vy, dir: facing(KEYSETS[rd ?? k1], 3) }, fl: node.fl, triggered: false, t: 0 };
                        let trigAt = null;
                        // the k1 prefix, branching to k2 at every other tick of the decisive window after the trigger
                        for (let n1 = 1; n1 <= N1MAX; n1 += 1) {
                            st = tick(room, st, KEYSETS[k1], shield);
                            lanes += 1;
                            if (!st) break;
                            if (st.triggered && trigAt === null) trigAt = n1;
                            const c = endAt(st);
                            if (c !== null) { record(st, { from: { x: s.x, y: s.y }, runway: rd ? `${rd}x${ph}` : null, k1, n1, k2: '-', n2: 0, c }); break; }
                            const branch = trigAt === null ? n1 % 6 === 0 : (n1 - trigAt) <= WINDOW && (n1 - trigAt) % 2 === 0;
                            if (!branch) continue;
                            for (const k2 of [null, ...holds]) {
                                if (k2 === k1) continue;
                                let b = st;
                                const keys = k2 ? KEYSETS[k2] : NONE;
                                for (let n2 = 1; n2 <= N2; n2 += 1) {
                                    b = tick(room, b, keys, shield);
                                    lanes += 1;
                                    if (!b) break;
                                    const c2 = endAt(b);
                                    if (c2 !== null) { record(b, { from: { x: s.x, y: s.y }, runway: rd ? `${rd}x${ph}` : null, k1, n1, k2: k2 ?? 'release', n2, c: c2 }); break; }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return { reached, lanes, maps: maps.size };
}

/**
 * The door sides: components of W(initial config) holding a door's spawn, then merged by lanes that cross no flyer
 * (none: a lane is only a lane if it triggers). Doors whose spawns share a component are one side with no crossing.
 */
function sidesOf(room, flyers, doors) {
    const m = waitingMap(room, flyers);
    // the flyer-free floor: door groups that are not connected without any flyer are not a wallflyer question
    const free = waitingMap(room, []);
    const freeComp = (s) => free.comp[Math.round(s.y) * room.W + Math.round(s.x)];
    const at = (s) => { const k = Math.round(s.y) * room.W + Math.round(s.x); return m.ok[k] ? m.comp[k] : -1; };
    const by = new Map();
    for (const d of doors) {
        const c = at(d.spawn);
        if (!by.has(c)) by.set(c, []);
        by.get(c).push(d);
    }
    return [...by.values()].map((g) => Object.assign(g, { floor: freeComp(g[0].spawn) }));
}

/** Strike boxes for the disarm arms, from a player at (x, y) facing `dir` (0 right, 1 up, 2 left, 3 down). */
function strikeBoxes(arm, x, y, dir) {
    if (arm === 'sword') {
        const sw = 16; const h = 32;  // Slash.png 16x32 (Player.as:41), scale 1
        return [[rect(x, y - h / 2, sw, h), rect(x - h / 2, y - sw, h, sw), rect(x - sw, y - h / 2, sw, h), rect(x - h / 2, y, h, sw)][dir]];
    }
    if (arm === 'spear') {
        const sx = x + -1 * (dir % 2) * (dir - 2);
        const sy = y + 2 * (dir % 2) + (1 - (dir % 2)) + (dir === 2 ? 1 : 0);
        const L = 32; const T = 5;
        return [[rect(sx, sy - T / 2 + 1, L, T), rect(sx - T / 2 + 1, sy - L, T, L), rect(sx - L, sy - T / 2, L, T), rect(sx - T / 2, sy, T, L)][dir]];
    }
    if (arm === 'darkshield') {
        const p = { x, y, vx: dir === 0 ? 1 : dir === 2 ? -1 : 0, vy: 0, dir };
        return [shieldBox(p)];
    }
    if (arm === 'wand') {
        // 16 ticks at 3 px/tick from 16 px ahead: the swept 3x3 box, one per tick (WandShot origin 2,2)
        const a = (dir * Math.PI) / 2;
        const ux = Math.round(Math.cos(a));
        const uy = -Math.round(Math.sin(a));
        const out = [];
        for (let t = 0; t <= 16; t += 1) out.push(rect(x + ux * (16 + 3 * t) - 2, y + uy * (16 + 3 * t) - 2, 3, 3));
        return out;
    }
    throw new Error(arm);
}

/**
 * Can `arm` strike flyer `w` at rest from a waiting spot of component `comp` (map `m`)? Returns the spot or null.
 * Sword: `distanceRectPoint <= 16` and no solid on the centre line. Wand: the shot's path must stay off solids up to
 * the body, and the kill's Explosion (radius 9) must miss the player. Dark shield: the spot and the next pixel toward
 * the body are both waiting spots (it bumps only while the player moves).
 */
function strikeSpot(room, m, comp, w, arm) {
    const fr = WF.wallFlyerRect(w);
    const W = room.W;
    for (let y = Math.max(0, Math.floor(fr.y - 70)); y < Math.min(room.H, fr.bottom + 70); y += 1) {
        for (let x = Math.max(0, Math.floor(fr.x - 70)); x < Math.min(W, fr.right + 70); x += 1) {
            if (m.comp[y * W + x] !== comp) continue;
            for (let dir = 0; dir < 4; dir += 1) {
                const boxes = strikeBoxes(arm, x, y, dir);
                if (arm === 'wand') {
                    let hit = false;
                    for (const b of boxes) { if (room.solid(b)) break; if (overlap(b, fr)) { hit = true; break; } }
                    if (!hit || Math.hypot(w.x - x, w.y - y) <= 9) continue;
                    return { x, y, dir };
                }
                if (!boxes.some((b) => overlap(b, fr))) continue;
                if (arm === 'sword') {
                    const dx = Math.max(fr.x - x, 0, x - fr.right);
                    const dy = Math.max(fr.y - y, 0, y - fr.bottom);
                    if (Math.hypot(dx, dy) > 16) continue;
                    let blocked = false;
                    const n = Math.ceil(Math.hypot(w.x - x, w.y - y));
                    for (let i = 1; i < n && !blocked; i += 1) { const px = x + ((w.x - x) * i) / n; const py = y + ((w.y - y) * i) / n; if (room.solid(rect(Math.floor(px), Math.floor(py), 1, 1))) blocked = true; }
                    if (blocked) continue;
                }
                if (arm === 'darkshield') {
                    const ux = dir === 0 ? 1 : dir === 2 ? -1 : 0;
                    const uy = dir === 3 ? 1 : dir === 1 ? -1 : 0;
                    const nx = x + ux; const ny = y + uy;
                    if (m.comp[ny * W + nx] !== comp) continue;
                }
                return { x, y, dir };
            }
        }
    }
    return null;
}

async function main() {
    const map = readMap();
    if (process.argv.includes('--verify')) {
        // the bitmap solid against collidesSolid on random fractional rects, every wallflyer room
        let bad = 0; let n = 0;
        for (const level of map.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'wallflyer'))) {
            const room = roomOf(level);
            for (let i = 0; i < 20000; i += 1) {
                const r = rect(Math.random() * (room.W - 16), Math.random() * (room.H - 16), 1 + Math.random() * 14, 1 + Math.random() * 14);
                n += 1;
                if (room.solid(r) !== !!room.world.collidesSolid(r)) bad += 1;
            }
        }
        console.log(`VERIFY solid bitmap vs collidesSolid: ${n} rects, ${bad} disagree`);
        return;
    }
    const want = arg('levels', null)?.split(',').map(Number);
    const arms = arg('arms', 'none,sword,spear,darkshield,wand,shield').split(',');
    const levels = map.levels.filter((l) => (l.entities ?? []).some((e) => e.type === 'wallflyer') && (!want || want.includes(l.level)));
    const out = { levels: levels.map((l) => l.level), rows: [] };
    console.log(`WALLFLYER LEVELS ${JSON.stringify(out.levels)}`);
    for (const level of levels) {
        const room = roomOf(level);
        const flyers = settledFlyers(room);
        const doors = doorsOf(map, level);
        const sides = sidesOf(room, flyers, doors);
        console.log(`L${level.level}: flyers ${flyers.map((w) => `${w.id}@(${w.x},${w.y})`).join(' ')}; sides ${JSON.stringify(sides.map((s) => s.map((d) => d.to)))}`);
        if (sides.length === 1) { out.rows.push({ level: level.level, sides: sides.map((s) => s.map((d) => d.to)), verdict: 'one side: no crossing to gate' }); console.log(`ROW ${JSON.stringify(out.rows.at(-1))}`); continue; }
        for (const X of sides) {
            for (const Y of sides) {
                if (X === Y) continue;
                if (X.floor !== Y.floor) { console.log(`  L${level.level} ${JSON.stringify(X.map((d) => d.to))} -> ${JSON.stringify(Y.map((d) => d.to))}: not connected even with no flyer (another solid separates them): no wallflyer question`); continue; }
                const from = X[0];
                const goals = Y.map((d) => ({ name: `L${d.to}`, ...d.spawn }));
                const row = { level: level.level, from: X.map((d) => d.to), to: Y.map((d) => d.to), arms: {} };
                for (const arm of arms) {
                    const t0 = Date.now();
                    let r;
                    if (arm === 'none' || ARM[arm]?.kind === 'deflect') {
                        r = searchCrossing(room, flyers, from.spawn, goals, { shield: arm === 'shield' });
                    } else {
                        // disarm at rest: strike every body reachable from the entry side, iteratively, then search
                        let fl = flyers.map((w) => ({ ...w }));
                        const kills = [];
                        for (let changed = true; changed;) {
                            changed = false;
                            const m = waitingMap(room, fl);
                            const c = m.comp[Math.round(from.spawn.y) * room.W + Math.round(from.spawn.x)];
                            for (let i = 0; i < fl.length; i += 1) {
                                if (!live(fl[i])) continue;
                                const spot = strikeSpot(room, m, c, fl[i], arm);
                                if (spot) { kills.push({ id: fl[i].id, at: spot, strikes: Math.ceil(HITS_MAX / ARM[arm].damage), minTicks: (Math.ceil(HITS_MAX / ARM[arm].damage) - 1) * (HITS_TIMER_MAX + 1) }); fl = fl.map((w, j) => (j === i ? { ...w, removed: true, destroy: true } : w)); changed = true; }
                            }
                        }
                        r = searchCrossing(room, fl, from.spawn, goals, {});
                        r.kills = kills;
                    }
                    const ok = (r.reached ?? []).length > 0;
                    row.arms[arm] = { line: ok, reached: (r.reached ?? []).map((x) => x.goal), lanes: r.lanes, configs: r.maps, ...(r.kills ? { kills: r.kills } : {}), ...(r.error ? { error: r.error } : {}), ms: Date.now() - t0,
                        chain: ok ? r.reached[0].chain : undefined };
                    console.log(`  ${arm.padEnd(10)} L${level.level} ${JSON.stringify(row.from)} -> ${JSON.stringify(row.to)}: ${ok ? 'LINE' : 'NO LINE'} (${r.lanes} lanes, ${r.maps} configs, ${Date.now() - t0} ms)${r.kills ? ` kills ${r.kills.map((k) => `${k.id}@${k.at.x},${k.at.y}d${k.at.dir}`).join(' ')}` : ''}`);
                    if (ok && process.argv.includes('--lane-dump')) for (const l of r.reached[0].chain) console.log(`     lane ${JSON.stringify(l)}`);
                }
                out.rows.push(row);
                console.log(`ROW ${JSON.stringify({ ...row, arms: Object.fromEntries(Object.entries(row.arms).map(([k, v]) => [k, v.line])) })}`);
            }
        }
    }
    const jf = arg('json', null);
    if (jf) writeFileSync(jf, `${JSON.stringify(out, null, 1)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
export { tick, runway, roomOf, settledFlyers, waitingMap, searchCrossing, runLane, sidesOf, strikeSpot, triggers, pbox };
