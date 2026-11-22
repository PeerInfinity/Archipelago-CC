#!/usr/bin/env node
// rules-wand-chaser-killarm-census Q1: the Wand / Fire Wand vs a homing chaser on an OPEN PLANE, on the repo's ports only
// (no typed speed): the runner is `chasers.chaserStep` (Bob.as:49-75, LavaRunner.as:84-118 moveSpeed by terrain), the
// player `playerPhysicsV1.step`, the shot `wandShot.createWandShot`/`stepWandShot` (WandShot.as:36-110), the press→shot
// map `wandVerb.WAND_WINDOW` (fireTick 7) and `WAND_PRESS_CADENCE` (8). `Enemy.hit` (Enemy.as:141-181): a hit lands only
// at hitsTimer <= 0, adds d, arms hitsTimer = 30, knocks back (v += f·unit away from the shot) unless it kills;
// `Enemy.hitPlayer` (Enemy.as:211-221) needs hitsTimer <= 0 and no "die" anim. Contact = the player's box (4×5 at -2,-2,
// Player.as:295,432) overlapping the body's (combat.ENEMY_CLASSES hitbox).
//   node duel.mjs            → the table (stand line, and retreat-and-turn lines) for walk / swim, Wand / Fire Wand
import { join } from 'node:path';
const R = new URL('../../../../../../', import.meta.url).pathname;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { chaserStep, CHASERS } = await M('chasers.js');
const { ENEMY_CLASSES } = await M('combat.js');
const PP = await M('playerPhysicsV1.js');
const { createWandShot, stepWandShot, WAND_SHOT } = await M('wandShot.js');
const { WAND_WINDOW, WAND_PRESS_CADENCE } = await M('wandVerb.js');
const G = await import(join(R, 'scripts/procgen/seedlingChaserPursuitGuard.js'));
const HITS_TIMER_MAX = 30;           // Enemy.as:24
const RUN_RANGE = ENEMY_CLASSES.lavarunner.aggro.range;     // Bob.as:21 runRange 80
const SPR = { wand: 16, firewand: 17 }; // Player.as:49,51 Spritemap widths: spawn offset (Player.as:999)
const WAND_SPEED = 3;                // Player.as:167
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const pbox = (p) => ({ x: p.x - PP.HITBOX.originX, y: p.y - PP.HITBOX.originY, w: PP.HITBOX.width, h: PP.HITBOX.height });
const ebox = (tag, e) => { const h = ENEMY_CLASSES[tag].hitbox; return { x: e.x - h.ox, y: e.y - h.oy, w: h.w, h: h.h }; };

/** One duel. `line(t, p, e)` returns the held key set for tick t (the press is added at cadence ticks). */
export function duel({ tag = 'lavarunner', terrain = 'walk', fire = false, start = RUN_RANGE, line = () => [], pressFrom = 0,
    cadence = WAND_PRESS_CADENCE, ticks = 400 } = {}) {
    const byT = CHASERS[tag].speedByTerrain;
    const ms = byT ? (terrain === 'swim' ? byT.swim : byT.walk) : ENEMY_CLASSES[tag].speed;
    const pTerr = G.playerTerrain(terrain === 'swim' && false ? 17 : 0); // the player stands on FLOOR in every line
    const hitsMax = ENEMY_CLASSES[tag].kill.hits;
    const dmg = fire ? WAND_SHOT.firewand.damage : WAND_SHOT.wand.damage;
    let p = { x: 0, y: 0, vx: 0, vy: 0 }; let dir = 0;
    let e = { x: start, y: 0, v: { x: 0, y: 0 }, moveSpeed: ms, runRange: RUN_RANGE, hits: 0, hitsTimer: 0, dead: null };
    const shots = []; const pend = []; const log = { hits: [], contact: null, kill: null, shotsFired: 0, minGap: Infinity, wake: null };
    for (let t = 0; t < ticks; t += 1) {
        // the player: input + move (playerPhysicsV1), then sprites(): direction from v (Player.as:1625-1646), wandEnd
        const keys = new Set(line(t, p, e));
        const press = t >= pressFrom && (t - pressFrom) % cadence === 0;
        p = { ...p, ...PP.step(p, keys, { world: { width: 1e5, height: 1e5 }, moveSpeed: pTerr.moveSpeed, friction: pTerr.friction }) };
        if (p.vx < 0) dir = 2; else if (p.vx > 0) dir = 0;
        if (press) pend.push(t + WAND_WINDOW.fireTick);
        if (pend[0] === t) {
            pend.shift(); log.shotsFired += 1;
            const a = dir * Math.PI / 2;
            const w = fire ? SPR.firewand : SPR.wand;
            shots.push(createWandShot(t, p.x + w * Math.cos(a), p.y - w * Math.sin(a), { vx: WAND_SPEED * Math.cos(a), vy: -WAND_SPEED * Math.sin(a) }, { fire }));
        }
        // the body: chaserStep (friction, move, chase impulse) with Enemy.update's hitUpdate + hitPlayer
        if (e.dead === null) {
            if (log.wake === null && Math.hypot(p.x - e.x, p.y - e.y) <= RUN_RANGE) log.wake = t;
            const r = chaserStep(tag, e, p, { onScreen: true, hitPlayer: ({ x, y, v }) => {
                if (e.hitsTimer > 0) e.hitsTimer -= 1;
                if (e.hitsTimer <= 0 && log.contact === null && overlap(pbox(p), ebox(tag, { x, y }))) log.contact = t;
                return { v };
            } });
            e = { ...e, x: r.x, y: r.y, v: r.v };
            log.minGap = Math.min(log.minGap, Math.abs(e.x - p.x));
        }
        // the shots (added after the body, so stepped after it)
        for (const s of shots) {
            if (s.removed || s.anim === 'die') continue;
            const ev = stepWandShot(s, { tick: t, hitAt: (nx, ny, st) => {
                const box = { x: nx - (fire ? 2 : 2), y: ny - 2, w: fire ? 5 : 3, h: fire ? 5 : 3 };
                return e.dead === null && overlap(box, ebox(tag, e)) ? { kind: 'enemy', id: tag } : null;
            } });
            if (ev.event && e.dead === null) {
                if (e.hitsTimer <= 0 && e.hits < hitsMax) {
                    e.hits += dmg; e.hitsTimer = HITS_TIMER_MAX; log.hits.push({ t, gap: +(e.x - p.x).toFixed(1) });
                    if (e.hits >= hitsMax) { e.dead = t; log.kill = t; }
                    else { const a = Math.atan2(e.y - s.y, e.x - s.x); e.v = { x: e.v.x + WAND_SHOT.force * Math.cos(a), y: e.v.y + WAND_SHOT.force * Math.sin(a) }; }
                }
            }
        }
        if (log.contact !== null || log.kill !== null) break;
    }
    return { ms, hitsMax, dmg, shotsToKill: Math.ceil(hitsMax / dmg), ...log };
}

const STAND = () => [];
// retreat-and-turn: hold away (left) except the two ticks before each shot's fire tick, when the player taps toward
// the body (right) so `direction` is 0 at wandEnd (the v-sign rule); one press every `cyc` ticks.
const retreat = (cyc) => (t) => { const k = t % cyc; return (k >= WAND_WINDOW.fireTick - 1 && k <= WAND_WINDOW.fireTick) ? ['right'] : ['left']; };
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(`player walk ${G.playerSpeedOn(0).toFixed(4)} px/tick; lavarunner walk ${G.bodySpeedOn('lavarunner', 0).toFixed(4)}, swim ${G.bodySpeedOn('lavarunner', 17).toFixed(4)}; puncher ${G.bodySpeedOn('puncher', 0).toFixed(4)}`);
    console.log(`WAND_WINDOW.fireTick ${WAND_WINDOW.fireTick}, cadence ${WAND_PRESS_CADENCE}; runRange ${RUN_RANGE}; hitsTimerMax ${HITS_TIMER_MAX}`);
    const rows = [];
    for (const terrain of ['walk', 'swim']) for (const fire of [false, true]) for (const [ln, f, cyc] of [['stand', STAND, 8], ['retreat/16', retreat(16), 16], ['retreat/24', retreat(24), 24], ['retreat/32', retreat(32), 32]]) {
        const r = duel({ terrain, fire, line: f, cadence: cyc });
        rows.push({ body: `lavarunner ${terrain} (${r.ms})`, arm: fire ? 'Fire Wand' : 'Wand', line: ln, shotsToKill: r.shotsToKill, wake: r.wake,
            hits: r.hits.map((h) => `t${h.t}@${h.gap}px`).join(' '), kill: r.kill, contact: r.contact, verdict: r.kill !== null ? 'KILL first' : r.contact !== null ? 'CONTACT first' : 'neither' });
    }
    for (const r of rows) console.log(JSON.stringify(r));
}
