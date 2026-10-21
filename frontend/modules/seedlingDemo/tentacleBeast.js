/**
 * seedlingDemo/tentacleBeast — THE TENTACLED BEAST (`Enemies/TentacleBeast.as`, L57), transcribed.
 *
 * ⛓⛓⛓ seedling-fidelity-bosskills D3 (wave 20), behind `CONTACT_FIDELITY.tentacleBeastFight` (OFF). The AS3 is
 * PeerInfinity/Seedling @ccdf189776 (`vendor/seedling/src`).
 *
 * ── THE RNG, AND WHY THIS FIGHT CAN BE MODELLED AT ALL ──────────────────────────────────────────────────────────
 * The spawns draw `Math.random()` (`:138-139`, `:167-168`). D1 measured it on p4g: three runs at one declared
 * `rng.seed` put every tentacle in the same place, and other seeds put them elsewhere. The build's `Math.random()` is
 * the runtime's fixed LFSR (`rng.js`), `Bot.botStart` writes the tape's `rng.seed` into it, and with `rng.split` the
 * cosmetic draws (`Rng.cos()`: the Tiles, the sound picks, the whirlpool's angle, an Explosion's) take a second
 * generator — so the stream this room reads is exactly:
 *
 *   · the BUILD: one draw, `Enemy.coins` in the `TentacleBeast` ctor (`Enemy.as:30`), measured (the state after
 *     the build is one step from the seed);
 *   · each active update of the beast, in its own order: the whirlpool loop's `x, y` per try while it owes one, then
 *     the tentacle's `x, y` while it owes one, then a placed tentacle's own `coins` draw (its ctor runs inside the
 *     beast's update).
 *
 * So the model's draws are the game's draws, and the solver knows which state it is in (⚖ the user's standard) by
 * reading the run, never by asking the page. The premises are refused by name, the Owl's (`finalBossRng.js`): a
 * declared seed, `split: true`, and the room built FIRST after the reseed (a boot in L57, no re-entry).
 *
 * ⚠ THE WHIRLPOOL LOOP'S `cont` IS NEVER RESET INSIDE THE LOOP (`:134-163`): once one try lands within 48 px of a
 * tentacle or a whirlpool, every later try of that update fails too — up to 101 tries, 202 draws. Transcribed.
 *
 * ── THE FIGHT ───────────────────────────────────────────────────────────────────────────────────────────────────
 *   · the body is a pixelmask Solid at `(x + 24, y + 24)`, never hit; it wakes when the player (not falling) comes
 *     within 48 px (`:82-88`): "rise" (12 frames at 8), then the spawning;
 *   · a tentacle rises (5 at 10), SITS (6 at 5 — the only window `canHit` is true), winds up (5 at 10), HITS (1 at
 *     10: `collideRect("Player", hitRect)` → `Player.hit(this, 2, …)` on every one of its updates), sinks (4 at 10)
 *     and is removed; one hit kills it (`hitsMax = 1`), and its "cut" fades 0.01 a tick, after which it takes one off
 *     `maxTentacles` and adds one to `maxWhirlpools` (`Tentacle.as:76-90`);
 *   · a whirlpool (`Puzzlements/Whirlpool.as`) grows 150, lives 60, dies 30; alive, it writes a player within its
 *     16 px disc 1 px inward and 20° round per update, ABSOLUTELY, and `drown()`s one at r ≤ 1;
 *   · `maxTentacles` 0 is the death: "dying" (4 at 2), the report `setPersistence(tag, false)` — the (57,0) location
 *     — and at its end `createMouthEntrance()`: a Teleporter at `(x - 8, y - 8)` to `tentacle_beast_mouth`.
 *
 * ── WHAT IS REFUSED BY NAME ─────────────────────────────────────────────────────────────────────────────────────
 *   · the drown at a whirlpool's centre (`Player.drown()` from outside the player): a death the solver keeps out of;
 *   · a swing whose line of sight could cross the body's pixelmask (`collideLine("Solid", …)` samples the mask; the
 *     model's line walks boxes): the tentacles stand below the body, so a line that reaches its box is refused.
 */

import { FP_ELAPSED } from './chasers.js';
import { SeedlingRng } from './rng.js';

export class TentacleBeastError extends Error {
    constructor(message) { super(message); this.name = 'TentacleBeastError'; }
}
const fail = (m) => { throw new TentacleBeastError(m); };

/** `Enemies/TentacleBeast.as`, in its own numbers. */
export const TENTACLE_BEAST = Object.freeze({
    as3: 'Enemies/TentacleBeast.as',
    ctorDx: 24,
    ctorDy: 24,
    /** `spawnRect = new Rectangle(16, 96, 176, 96)` (`:23`). */
    spawnRect: Object.freeze({ x: 16, y: 96, width: 176, height: 96 }),
    /** `distActivate = 48` (`:24`). */
    distActivate: 48,
    /** `tentacleMargin = (8, 0, 8, 4)` and `whirlpoolMargin = (Tile.w, Tile.h, Tile.w, Tile.h)` (`:26-27`). */
    tentacleMargin: Object.freeze({ x: 8, y: 0, width: 8, height: 4 }),
    whirlpoolMargin: Object.freeze({ x: 16, y: 16, width: 16, height: 16 }),
    maxTentacles: 8,
    maxWhirlpools: 1,
    /** `whirlpoolDist = 16 + Tile.w * 2` and `tentacleDistance = 32` (`:126`, `:130`). */
    whirlpoolDist: 48,
    tentacleDistance: 32,
    /** `while (… && tries <= 100)` (`:136`). */
    maxTries: 100,
    /**
     * `xpos < FP.width / 2` decides a tentacle's side (`:188`). `FP.width` is the LEVEL's width, not the 160-wide
     * screen: `Game.loadlevel` writes `FP.width = xml.width` (`Game.as:2065`), so the caller passes `ctx.levelWidth`
     * (measured D3: seed 3's tentacle at x 81 in L57 swipes RIGHT on the game, which a 160 screen gets wrong).
     */
    /** `Game.shake = 5` on every update of "rise" (`:89-92`). */
    riseShake: 5,
    /** The mouth: `new Teleporter(x - Tile.w / 2, y - Tile.h / 2, …)` (`:211-214`). */
    mouthDx: -8,
    mouthDy: -8,
});

/** The beast's animations (`:39-42`): `[frames, rate]`. "under" is one frame at rate 0. */
export const TENTACLE_BEAST_ANIMS = Object.freeze({
    rise: Object.freeze([12, 8]),
    dying: Object.freeze([4, 2]),
    under: Object.freeze([1, 0]),
});

/** `Enemies/Tentacle.as`, in its own numbers. */
export const TENTACLE = Object.freeze({
    as3: 'Enemies/Tentacle.as',
    /** `setHitbox(16, 4, 8, 2)` (`:47`). */
    hitbox: Object.freeze({ w: 16, h: 4, originX: 8, originY: 2 }),
    /** `hitRect = new Rectangle(66 * int(!right), 6, 66, 8)` (`:45`). */
    hitRect: Object.freeze({ w: 66, dy: 6, h: 8 }),
    force: 2,
    damage: 1,
    hitsMax: 1,
    hitsTimerMax: 30,
    /** The cut's fade, 0.01 an update (`:80`), clamped at 0 by `Image.alpha`'s setter. */
    cutAlphaStep: 0.01,
});

/** The tentacle's animations (`:37-42`). Every one loops (`add`'s default), so each end calls `animEnd`. */
export const TENTACLE_ANIMS = Object.freeze({
    rise: Object.freeze([5, 10]),
    sit: Object.freeze([6, 5]),
    hit: Object.freeze([5, 10]),
    hitting: Object.freeze([1, 10]),
    sink: Object.freeze([4, 10]),
    cut: Object.freeze([4, 10]),
});

/** `Puzzlements/Whirlpool.as` (`:23-27`, `:39`, `:56-84`). */
export const WHIRLPOOL = Object.freeze({
    as3: 'Puzzlements/Whirlpool.as',
    grow: 150,
    live: 60,
    dies: 30,
    /** The sprite is 32x32, centred: the hitbox, and the pull's radius `(width - originX) * scale` = 16 alive. */
    size: 32,
    radius: 16,
    /** `spinRate = 20` degrees an update. */
    spinRate: 20,
});

/**
 * The room's draw stream: `SeedlingRng` booked per site, as `finalBossRng.OwlDrawStream` books the Owl's.
 * `seed` is the window's declared `rng.seed`; the build's one draw is taken here, before tick 0.
 */
export class TentacleDrawStream {
    constructor(seed) {
        if (!Number.isInteger(seed) || seed <= 0) fail(`TentacleDrawStream: needs a declared seed in 1..2147483647, got ${seed}`);
        this.rng = new SeedlingRng(seed);
        this.counts = { build: 0, whirlX: 0, whirlY: 0, tentacleX: 0, tentacleY: 0, coins: 0 };
        this.n = 0;
        this.draw('build');
    }
    draw(site) {
        this.counts[site] += 1;
        this.n += 1;
        return this.rng.next();
    }
    get state() { return this.rng.state; }
}

/** The run's premises for the stream (`finalBossRng.assertOwlStreamPremises`'s, one room over). */
export function tentacleStreamRefusal(rngBlock, { bootLevel, level, worldEntries, onlyThisRoom = false }) {
    if (!rngBlock || rngBlock.split !== true) {
        return 'needs `rng: { split: true }` — unsplit, the build\'s three `Rng.cos()` per Tile and every indexed sound '
            + 'pick land on the gameplay stream, which this schedule does not carry';
    }
    if (!Number.isInteger(rngBlock.seed) || rngBlock.seed <= 0) {
        return `needs a declared \`rng.seed\` in 1..2147483647 (got ${JSON.stringify(rngBlock.seed)}): 0 inherits the `
            + 'page\'s stream, whose position is its whole history';
    }
    // A re-entry is the stream carried on only when every room built since the reseed was this one (a death's
    // rebuild: the caller pays the rebuild's `coins` draw on the carried stream).
    if (level !== bootLevel || (worldEntries > 0 && !onlyThisRoom)) {
        return `would open in level ${level} ${level !== bootLevel ? `after a boot in level ${bootLevel}` : 'on a re-entry from another room'}; `
            + 'the stream is the seeded one only while this room is the only one built since `botStart`\'s reseed';
    }
    return null;
}

function anim(table, name) {
    const a = table[name];
    if (!a) fail(`anim: "${name}" is not in the table`);
    return { name, frames: a[0], rate: a[1], timer: 0, index: 0 };
}

/** One graphic update of a LOOPING FlashPunk animation; returns true on each wrap (the `animEnd` call). */
function advance(spr) {
    if (spr === null || spr.rate <= 0) return false;
    spr.timer += spr.rate * FP_ELAPSED;
    let ended = false;
    while (spr.timer >= 1) {
        spr.timer -= 1;
        spr.index += 1;
        if (spr.index === spr.frames) {
            spr.index = 0;
            ended = true;
            break;
        }
    }
    return ended;
}

export function tentacleRect(t) {
    const { w, h, originX, originY } = TENTACLE.hitbox;
    return { x: t.x - originX, y: t.y - originY, w, h, right: t.x - originX + w, bottom: t.y - originY + h };
}

/** The swipe's rect (`collideRect("Player", x - hitRect.x, y - hitRect.y, 66, 8)`). */
export function tentacleSwipeRect(t) {
    const hx = t.right ? 0 : TENTACLE.hitRect.w;
    const x = t.x - hx;
    const y = t.y - TENTACLE.hitRect.dy;
    return { x, y, w: TENTACLE.hitRect.w, h: TENTACLE.hitRect.h, right: x + TENTACLE.hitRect.w, bottom: y + TENTACLE.hitRect.h };
}

export function whirlpoolRect(w) {
    const half = WHIRLPOOL.size / 2;
    return { x: w.x - half, y: w.y - half, w: WHIRLPOOL.size, h: WHIRLPOOL.size, right: w.x + half, bottom: w.y + half };
}

/** The fight's per-visit state, from the `.oel` placement (`tentaclebeast x=80 y=48 tag=0`). */
export function createTentacleBeastFight(e, { seed }) {
    return {
        id: `tentaclebeast@${e.x},${e.y}`,
        tag: Number.isInteger(e.tag) ? e.tag : -1,
        beast: {
            x: e.x + TENTACLE_BEAST.ctorDx,
            y: e.y + TENTACLE_BEAST.ctorDy,
            spr: anim(TENTACLE_BEAST_ANIMS, 'under'),
            activated: false,
            dead: false,
            maxTentacles: TENTACLE_BEAST.maxTentacles,
            maxWhirlpools: TENTACLE_BEAST.maxWhirlpools,
        },
        stream: seed === null ? null : new TentacleDrawStream(seed),
        tentacles: [],
        whirlpools: [],
        /** The run-side records (the arena's runtime teleporter, …) levelRun keeps beside the fight. */
        runtime: [],
        /** This frame's adds, in add order; they join at `updateLists()`, newest first. */
        spawned: [],
        seq: 0,
        mouth: null,
        report: null,
        reportBanked: false,
        events: [],
    };
}

/**
 * ONE update of the beast, entity half then graphic half. `ctx`: `tick`, `frozen`, `levelWidth`, `player` `{x, y,
 * fallFromCeiling}`, `setShake(v)`, `streamRefusal()` (a string when the stream's premises fail, asked only when a
 * draw is owed). Returns nothing; spawns go to `fight.spawned`.
 */
export function stepTentacleBeast(fight, ctx) {
    if (!Number.isFinite(ctx.levelWidth)) throw new Error('stepTentacleBeast: ctx.levelWidth (`FP.width`, the level\'s own width) is required');
    const b = fight.beast;
    if (ctx.frozen) return;
    const p = ctx.player;
    if (p && !b.activated && Math.hypot(b.x - p.x, b.y - p.y) <= TENTACLE_BEAST.distActivate && !p.fallFromCeiling) {
        b.spr = anim(TENTACLE_BEAST_ANIMS, 'rise');
        b.activated = true;
        fight.events.push({ t: ctx.tick, kind: 'wake' });
    }
    if (b.spr?.name === 'rise') ctx.setShake(TENTACLE_BEAST.riseShake);
    if (!b.dead && b.maxTentacles <= 0) {
        b.spr = anim(TENTACLE_BEAST_ANIMS, 'dying');
        b.dead = true;
        if (fight.report === null) fight.report = { tag: fight.tag };
        fight.events.push({ t: ctx.tick, kind: 'dying' });
    }
    if (b.activated && !b.dead && b.spr === null) spawn(fight, ctx);
    // the graphic half: `animEnd`
    if (advance(b.spr)) {
        if (b.spr.name === 'rise') {
            b.spr = null;
        } else if (b.spr.name === 'dying') {
            b.spr = null;
            fight.mouth = { x: b.x + TENTACLE_BEAST.mouthDx, y: b.y + TENTACLE_BEAST.mouthDy };
            fight.events.push({ t: ctx.tick, kind: 'mouth', at: { ...fight.mouth } });
        }
    }
}

function spawn(fight, ctx) {
    const why = ctx.streamRefusal();
    if (why) fail(`the Tentacled Beast spawns at tick ${ctx.tick}, and the draw stream ${why}`);
    const S = fight.stream;
    const B = TENTACLE_BEAST;
    // `getClass` / `classCount` read the class lists, which a `FP.world.remove` made THIS frame has not drained yet
    // (`updateLists()` runs after the whole update): a body removed earlier in this frame still counts.
    const vT = fight.tentacles;
    const vW = fight.whirlpools;
    const near = (x, y, list, d) => list.some((o) => Math.hypot(x - o.x, y - o.y) <= d);
    let cont = true;
    let tries = 0;
    let created = 0;
    while (vW.length + created < fight.beast.maxWhirlpools && tries <= B.maxTries) {
        const wm = B.whirlpoolMargin;
        const xpos = Math.trunc(S.draw('whirlX') * (B.spawnRect.width - wm.x - wm.width) + B.spawnRect.x + wm.x);
        const ypos = Math.trunc(S.draw('whirlY') * (B.spawnRect.height - wm.y - wm.height) + B.spawnRect.y + wm.y);
        if (near(xpos, ypos, vT, B.whirlpoolDist)) cont = false;
        if (cont && near(xpos, ypos, vW, B.whirlpoolDist)) cont = false;
        if (cont) {
            // `new Whirlpool(xpos - Tile.w, ypos - Tile.h, true)`: its ctor adds the tile back and runs `update()` once.
            const w = { id: `whirlpool#${++fight.seq}`, x: xpos, y: ypos, timer: WHIRLPOOL.grow + WHIRLPOOL.live + WHIRLPOOL.dies };
            stepWhirlpoolTimer(w);
            fight.spawned.push({ kind: 'whirlpool', body: w });
            fight.events.push({ t: ctx.tick, kind: 'whirlpool', id: w.id, x: xpos, y: ypos });
            created += 1;
        }
        tries += 1;
    }
    cont = true;
    if (vT.length < fight.beast.maxTentacles) {
        const tm = B.tentacleMargin;
        const xpos = Math.trunc(S.draw('tentacleX') * (B.spawnRect.width - tm.x - tm.width) + B.spawnRect.x + tm.x);
        const ypos = Math.trunc(S.draw('tentacleY') * (B.spawnRect.height - tm.y - tm.height) + B.spawnRect.y + tm.y);
        if (near(xpos, ypos, vT, B.tentacleDistance)) cont = false;
        if (cont && near(xpos, ypos, vW, B.whirlpoolDist)) cont = false;
        if (cont) {
            S.draw('coins');   // the Tentacle ctor's `Enemy.coins` (`Enemy.as:30`)
            const t = { id: `tentacle#${++fight.seq}`, x: xpos, y: ypos, right: xpos < ctx.levelWidth / 2,
                spr: anim(TENTACLE_ANIMS, 'rise'), hits: 0, hitsTimer: 0, canHit: false, destroy: false, alpha: 1 };
            fight.spawned.push({ kind: 'tentacle', body: t });
            fight.events.push({ t: ctx.tick, kind: 'tentacle', id: t.id, x: xpos, y: ypos });
        }
    }
}

/** The whirlpool's own timer step (`:43-47`, the decrement only). */
function stepWhirlpoolTimer(w) {
    if (w.timer > 0) w.timer -= 1;
}

/**
 * ONE update of a whirlpool (`:41-96`). `ctx.player` `{x, y, box}`; returns `{pull: {x, y} | null, drown, removed}`.
 * The pull is the ABSOLUTE write the game makes to the player's position.
 */
export function stepWhirlpool(w, ctx) {
    stepWhirlpoolTimer(w);
    const { live, dies } = WHIRLPOOL;
    if (w.timer >= live + dies) return { pull: null, drown: false, removed: false };    // growing
    if (w.timer >= dies) {
        const p = ctx.player;
        const box = whirlpoolRect(w);
        const overlaps = p.box.x < box.right && p.box.right > box.x && p.box.y < box.bottom && p.box.bottom > box.y;
        const d = Math.hypot(w.x - p.x, w.y - p.y);
        if (overlaps && d < WHIRLPOOL.radius) {
            let a = Math.atan2(p.y - w.y, p.x - w.x);
            let r = Math.trunc(d);                      // `var r:int`
            let x = p.x - r * Math.cos(a);
            let y = p.y - r * Math.sin(a);
            r = Math.trunc(r * 0.999);
            a -= WHIRLPOOL.spinRate / 180 * Math.PI;
            x += r * Math.cos(a);
            y += r * Math.sin(a);
            return { pull: { x, y }, drown: r <= 1, removed: false };
        }
        return { pull: null, drown: false, removed: false };
    }
    if (w.timer > 0) return { pull: null, drown: false, removed: false };               // dying
    w.pendingRemove = true;
    return { pull: null, drown: false, removed: true };
}

/**
 * ONE update of a tentacle, entity half then graphic half (`:57-114`). `ctx`: `frozen`, `playerBox`. Returns
 * `{swipe: boolean, removed: boolean, gone: boolean}` — `swipe` when "hitting" met the player (the caller bills
 * `Player.hit(this, 2, (x, y), 1)`), `gone` when the cut's fade took it (the beast's counters move).
 */
export function stepTentacle(t, ctx) {
    const out = { swipe: false, removed: false, gone: false };
    if (ctx.frozen) return out;
    const canHit = t.spr.name === 'sit';
    t.canHit = canHit;
    if (t.spr.name === 'hitting' && ctx.playerBox) {
        const r = tentacleSwipeRect(t);
        const p = ctx.playerBox;
        // `World.collideRect` — inclusive edges.
        if (p.right >= r.x && p.bottom >= r.y && p.x <= r.right && p.y <= r.bottom) out.swipe = true;
    }
    if (t.hitsTimer > 0) t.hitsTimer -= 1;
    if (t.destroy) {
        if (t.spr.name !== 'cut') t.spr = anim(TENTACLE_ANIMS, 'cut');
        t.alpha = Math.max(0, t.alpha - TENTACLE.cutAlphaStep);
        if (t.alpha <= 0) {
            t.pendingRemove = true;
            out.removed = true;
            out.gone = true;
            return out;
        }
    }
    if (advance(t.spr)) {
        switch (t.spr.name) {
            case 'rise': t.spr = anim(TENTACLE_ANIMS, 'sit'); break;
            case 'sit': t.spr = anim(TENTACLE_ANIMS, 'hit'); break;
            case 'hit': t.spr = anim(TENTACLE_ANIMS, 'hitting'); break;
            case 'hitting': t.spr = anim(TENTACLE_ANIMS, 'sink'); break;
            case 'sink': t.pendingRemove = true; out.removed = true; break;
            // `play("cut")` while "cut" plays is a no-op (`Spritemap.play`, `reset` false): the loop keeps its
            // timer's fraction (measured D3: a fresh anim here ran the second loop one update slow).
            default: if (t.spr.name !== 'cut') t.spr = anim(TENTACLE_ANIMS, 'cut');
        }
    }
    return out;
}

/** `Enemy.hit(f, p, d, t)` on a tentacle (`Enemy.as:141-181`; `knockback` is an empty override). */
export function hitTentacle(t, { d = 1, t: type = '', frozen = false } = {}) {
    // `canHit` is the field the tentacle's own update latched (`canHit = currentAnim == "sit"`), earlier in the frame
    // than the player's swing — so a "sit" that wrapped into "hit" in that update's graphic half is still hittable.
    if (!((t.hitsTimer <= 0) && !frozen && t.canHit === true)) {
        return { landed: false, killed: false, why: t.canHit !== true ? 'not sitting (`canHit` false)' : 'i-frames' };
    }
    if (type === 'Fire') return { landed: false, killed: false, why: 'Fire: hitByFire is false' };
    if (t.hits >= TENTACLE.hitsMax) return { landed: false, killed: false, why: 'spent' };
    t.hits += d;
    t.hitsTimer = TENTACLE.hitsTimerMax;
    if (t.hits >= TENTACLE.hitsMax) {
        t.destroy = true;          // `startDeath`: `destroy = true` (the SlashHit is cosmetic)
        return { landed: true, killed: true, why: null };
    }
    return { landed: true, killed: false, why: null };
}

/** The fight's read (a copy). */
export function tentacleBeastView(fight) {
    const b = fight.beast;
    return {
        id: fight.id,
        beast: { x: b.x, y: b.y, anim: b.spr ? b.spr.name : '', activated: b.activated, dead: b.dead,
            maxTentacles: b.maxTentacles, maxWhirlpools: b.maxWhirlpools },
        tentacles: fight.tentacles.map((t) => ({ id: t.id, x: t.x, y: t.y, right: t.right,
            anim: t.spr.name, index: t.spr.index, destroy: t.destroy, alpha: t.alpha, hitsTimer: t.hitsTimer })),
        whirlpools: fight.whirlpools.map((w) => ({ id: w.id, x: w.x, y: w.y, timer: w.timer })),
        mouth: fight.mouth ? { ...fight.mouth } : null,
        report: fight.report ? { ...fight.report } : null,
        draws: fight.stream ? fight.stream.n : null,
        rngState: fight.stream ? fight.stream.state : null,
    };
}
