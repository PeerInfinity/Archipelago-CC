/**
 * seedlingDemo/seedlingRoomBodySkin — **THE ROOM BODIES THAT ARE NOT CHASERS,
 * IN THE ORIGINAL GRAPHICS** (Seedling JS graphics G3b): the wallflyers, the
 * drills, the ice turrets and their blasts, the turrets and their spits, and
 * the Bob Boss with its blades. G3's three pieces again (`seedlingEnemySkin.js`,
 * whose Spritemap transcription, hit tint and op shape this module reuses):
 *
 *   · `roomBodySkinView(run)` — THE ONE ADAPTER from the run to what these
 *     pictures need. It copies; it writes nothing.
 *   · `stepRoomBodySkin(prev, view, tick)` — the renderer's own FlashPunk state
 *     per body, one GAME tick at a time.
 *   · `roomBodyOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with
 *     the room by each body's own `layer`.
 *
 * ⛔⛔ THE GETTERS ARE LAZY, AND THE ADAPTER READS ONLY WHAT THE SIM BUILT.
 * `run.drills`, `run.wallFlyers`, `run.turrets`/`turretDamage`, `run.shooters`
 * and `run.bobBoss` each build their room's per-visit state on first ask
 * (`levelRun` `drillStateFor` / `wallFlyerStateFor` / `turretStateFor` /
 * `shooterStateFor` / `bobArenaNow`). Three facts keep a renderer read from
 * moving the sim:
 *   1. The adapter runs AFTER `tick()`, and every one of those builders is
 *      called by the tick's own stepper in the same room whenever that stepper
 *      runs (`stepWallFlyersNow` / `stepDrillsNow` / `stepIceTurretsNow` /
 *      `stepShootersNow` / `stepBobBossArenaNow`, all under `!noclip`).
 *   2. Where a stepper has a gate the getter lacks — the wallflyers' and the
 *      drills' `if (noclip || noDamage) return` above their builder — the
 *      adapter applies the SAME gate (`run.noDamage`; the getters already
 *      return empty under noclip), so it never asks first.
 *   3. Every builder is a pure function of the room's build (`newWallFlyer`,
 *      `newDrill`, `createIceTurret`, `createTurret`, the arena from the rock),
 *      with no RNG and no clock, so even an early ask would build what the
 *      sim builds.
 * `seedlingRoomBodySkin.test.js` holds each family's tape's state, ledgers
 * and `stateLog` byte-identical with all of this running every tick and
 * without it (a `noDamage` tape included).
 *
 * ⛔ THE RENDERER ONLY READS. Where a class's picture reads state the run does
 * not carry, it is RE-DERIVED here from what the run does carry — a cosmetic
 * copy of the decision, never a second model of the motion:
 *   · the wallflyer's `vTriggered` (`decideMotion(moveSpeed)` at the body,
 *     the static solids) and its ray test against the player as it SAW him;
 *   · the drill's `visible` latch;
 *   · the ice turret corpse's turn toward 90° (`IceTurret.input`);
 *   · the Bob Boss's walk (the aggro at `runRange`), its forming fade and its
 *     death squash.
 * The motion, the anims the MODEL carries (the drill's, the turrets', the
 * wallflyer's "die") and every timer are the run's, read back.
 *
 * ⛔ NOT YET (`ROOM_BODY_COVERAGE.remaining`): the 0.25-alpha `nightBmp`
 * copies (G5), the explosion / slash-hit / coin effects (G4), the BobBossNPC
 * portrait (`BobBossNPC.as:21`, the dialogue box), the boss death's tint and
 * fade of the PLAYER (`BobBoss.as:202-225`, the player skin's), the turret's
 * "die" (its damage is not modelled — `turret.js`), and the corpse turn's
 * off-screen and frozen pauses (`IceTurret.input` runs inside `Enemy.update`'s
 * on-screen gate and `mobileUpdate`'s freeze gate; the renderer turns the
 * corpse every tick).
 */
import { normalizeLiveOpts } from './levelWorld.js';
import { decideMotion, WALLFLYER } from './wallFlyer.js';
import { collideLineSolid } from './crusher.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';
import {
    ANIMS, ENEMY_COLOUR, ENEMY_HIT_TINT, freshSprite, hashId, hitTint, play, rectOp, setFrame, spriteOp, updateSprite, worldFrame,
} from './seedlingEnemySkin.js';

export const KEYS = Object.freeze({
    wallFlyer: 'seedling:enemy/wallflyer',
    drill: 'seedling:enemy/drill',
    iceTurret: 'seedling:enemy/iceturret',
    iceBlast: 'seedling:projectile/iceblast',
    turret: 'seedling:enemy/turret',
    spit: 'seedling:projectile/turretspit',
    bobBoss: (form) => `seedling:enemy/bobboss${form}`,
    bobBossWeapons: 'seedling:enemy/bobbossWeapons',
});

/** `Enemy.as:34-35` — the pit spin per tick and the fade it is counted by. */
const PIT_SPIN = 8;
const PIT_ALPHA_SPEED = 0.05;
/** `BobBoss.as:38` `formingTimerMax`. */
const FORMING_MAX = 60;
/** `BobBoss.as:66,72` — the Spritemap `rate` per form (form 2 keeps 1). */
export const BOB_BOSS_RATE = Object.freeze([1 / 4, 1 / 2, 1]);
/** `BobSoldier.as:32-33` — `walkFrames` and `runRange`. */
const BOB_WALK_FRAMES = Object.freeze([0, 1, 2, 1]);
const BOB_RUN_RANGE = 80;
/** The frames a rate-0 anim shows (FlashPunk never advances it): `Drill.as:26` "sit", `IceTurret.as:42` "dead". */
const DRILL_SIT_FRAME = 0;
const ICE_TURRET_DEAD_FRAME = 6;
/** `Spritemap.frameCount - 1` — the frame `endAnim` leaves a finished "die" on. */
const WALLFLYER_LAST_FRAME = 8;
const DRILL_LAST_FRAME = 10;
const WALLFLYER_DIE = Object.freeze([5, 6, 7, 8]);

/**
 * WHAT G3b DRAWS, by AS3 class. With G3's `ENEMY_COVERAGE.drawn` this is the
 * skinned paint's whole roster; `modelled` is on the run and not drawn yet.
 */
export const ROOM_BODY_COVERAGE = Object.freeze({
    drawn: Object.freeze(['WallFlyer', 'Drill', 'IceTurret', 'IceTurretBlast', 'Turret', 'TurretSpit', 'BobBoss']),
    modelled: Object.freeze(['SpinningAxe', 'Crusher', 'LavaChain', 'BossTotem', 'BombPusher', 'Grenade']),
    remaining: Object.freeze(['the Turret "die" (damage not modelled)', 'BobBossNPC portrait', 'the boss death\'s player tint/fade', 'nightBmp copies (G5)', 'effects (G4)']),
});

/** `FP.angle_difference` — ONE wrap, not a modulo (`iceTurret.js` `angleDifference`, the same transcription). */
function angleDifference(a0, a1) {
    let d = a0 - a1;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d > Math.PI) d -= 2 * Math.PI;
    return d;
}

const hex2 = (n) => n.toString(16).padStart(2, '0');
/** `FP.getColorRGB(r, g, b)` as the renderer's tint string; white is no tint. */
const rgbTint = (r, g, b) => (r === 255 && g === 255 && b === 255 ? null : `#${hex2(r)}${hex2(g)}${hex2(b)}`);

const LIVE0 = normalizeLiveOpts({});

// ── the adapter ─────────────────────────────────────────────────────────

/** A getter's value, or `fallback` when the run has no such member (a stub run in a test). */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/**
 * THE ADAPTER. Everything these bodies' pictures read, from the run, as plain
 * objects (null when there is no run). The visit identity is G3's.
 */
export function roomBodySkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    // ⛔ the wallflyer and drill steppers' own gate (`stepWallFlyersNow` / `stepDrillsNow`): never ask first.
    const stepped = !run.noDamage;
    const wf = stepped ? read(run, 'wallFlyers', null) : null;
    const dr = stepped ? read(run, 'drills', null) : null;
    const turrets = read(run, 'turrets', null);
    const damage = new Map((read(run, 'turretDamage', []) ?? []).map((d) => [d.id, d]));
    const boss = read(run, 'bobBoss', null);
    const b = boss?.get?.('boss') ?? null;
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        player: { x: run.state.x, y: run.state.y },
        wallFlyers: (wf?.bodies ?? []).filter((w) => !w.removed).map((w) => ({
            id: w.id, x: w.x, y: w.y, vx: w.vx ?? 0, vy: w.vy ?? 0, hitsTimer: w.hitsTimer ?? 0, alpha: w.alpha ?? 1,
            destroy: !!w.destroy, fallInPit: !!w.fallInPit, die: w.dieAnim ? { index: w.dieAnim.index } : null,
        })),
        drills: (dr?.bodies ?? []).filter((d) => !d.removed).map((d) => ({
            id: d.id, x: d.x, y: d.y, hitsTimer: d.hitsTimer ?? 0, alpha: d.alpha ?? 1, destroy: !!d.destroy,
            anim: d.anim, index: d.sprite?.index ?? 0,
        })),
        iceTurrets: [...(turrets?.values?.() ?? [])].filter((t) => !t.removed).map((t) => {
            const d = damage.get(t.id) ?? {};
            return { id: t.id, x: t.x, y: t.y, dead: !!t.dead, dying: !!d.dying, hitsTimer: d.hitsTimer ?? 0,
                anim: d.anim ?? '', angle: d.angle ?? 0 };
        }),
        blasts: (read(run, 'blastsInFlight', []) ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y, vx: s.vx, vy: s.vy })),
        shooters: (read(run, 'shooters', []) ?? []).map((t) => ({
            id: t.id, x: t.x, y: t.y, angle: t.angle ?? 0, anim: t.anim ?? '', index: t.animIndex ?? 0, hitsTimer: t.hitsTimer ?? 0,
        })),
        spits: (read(run, 'shooters', []) ?? []).flatMap((t) => (t.spits ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y, vx: s.v.x, vy: s.v.y }))),
        bobBoss: b ? {
            id: b.id, form: b.form, x: b.x, y: b.y, hitsTimer: b.hitsTimer ?? 0, formingTimer: b.formingTimer ?? 0,
            destroy: !!b.destroy, nextBossTimer: b.nextBossTimer, swords: b.swords ?? 0, swordSpin: [...(b.swordSpin ?? [])],
        } : null,
        // `decideMotion`'s probe (`["Solid","Tree"]`): the room's static solids — `levelRun` refuses a wallflyer room
        // where that list and `Mobile.solids` differ, and no live solid (bridge, block, rock) stands in one.
        probe: world?.collidesSolid ? (rect) => !!world.collidesSolid(rect, LIVE0) : () => false,
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const ROOM_BODY_RULES = Object.freeze({ updateSprite, hitTint, worldFrame, decideMotion, angleDifference });

/**
 * `WallFlyer.update`'s tail (`WallFlyer.as:53-77`) for the picture, then the
 * graphic update, then `render` (:79-97). `seen` is the player where the
 * previous tick left him; `time` the clock at the top of the frame, `now` at
 * the render (`Game.as:890` advances it after the world updated).
 */
function stepWallFlyer(st, b, ctx, R) {
    const anims = ANIMS[KEYS.wallFlyer];
    const live = !b.destroy && !b.die;
    // `if (destroy || currentAnim == "die") return;` — then vTriggered and the ray (:59-68).
    if (live) {
        const vt = R.decideMotion(b, WALLFLYER.moveSpeed, ctx.probe);
        st.vt = { x: vt.x, y: vt.y };
        const l = Math.hypot(vt.x, vt.y);
        if (l > 0 && ctx.playerBox && collideLineSolid([ctx.playerBox], b.x, b.y,
            b.x + WALLFLYER.attackRange * (vt.x / l), b.y + WALLFLYER.attackRange * (vt.y / l))) {
            play(st.sprite, anims, 'jump');
        }
    }
    R.updateSprite(st.sprite, anims, () => { if (st.sprite.anim === 'jump') play(st.sprite, anims, 'jumping'); });
    // The "die" anim is the MODEL's clock (`wallFlyer.stepWallFlyerGraphic`); `endAnim` leaves `frameCount - 1`.
    if (b.die) {
        st.sprite.anim = 'die';
        st.sprite.frame = b.destroy ? WALLFLYER_LAST_FRAME : WALLFLYER_DIE[Math.min(b.die.index, WALLFLYER_DIE.length - 1)];
    }
    // `render()` (:79-97): the angle from vTriggered, else from v; at rest the world clock's 2 frames.
    if (live) {
        const moving = b.vx !== 0 || b.vy !== 0;
        if (st.vt && (st.vt.x !== 0 || st.vt.y !== 0)) st.angle = (-Math.atan2(st.vt.y, st.vt.x) * 180) / Math.PI;
        else if (moving) st.angle = (-Math.atan2(b.vy, b.vx) * 180) / Math.PI;
        if (!moving) setFrame(st.sprite, R.worldFrame(ctx.now, 2));
    }
}

/**
 * `Drill.update` (`Drill.as:52-113`) for the `visible` latch: it is written
 * only on an update that reaches the `else` arm (not frozen, not destroyed,
 * not dying, `hitsTimer <= 0` after `hitUpdate`), as `currentAnim != "sit"`
 * BEFORE the hop — i.e. the previous tick's anim ("hit" becomes "undrill",
 * which is not "sit" either). The frame is the MODEL's Spritemap
 * (`drill.stepDrillGraphic`).
 */
function stepDrill(st, b) {
    const h = st.prevHits > 0 ? st.prevHits - 1 : 0;
    if (!st.prevDestroy && st.prevAnim !== 'die' && h <= 0) st.visible = st.prevAnim !== 'sit';
    st.prevAnim = b.anim;
    const frames = ANIMS[KEYS.drill][b.anim]?.frames;
    st.frame = b.destroy ? DRILL_LAST_FRAME : (frames ? frames[Math.min(b.index, frames.length - 1)] : DRILL_SIT_FRAME);
}

/**
 * The ice turret (`IceTurret.as`): the frame from the MODEL's anim; the angle
 * is the model's while alive. A corpse turns toward FlashPunk −90° (`-angle`
 * toward `atan2(1, 0)`, its sprite pointing down the screen) by a tenth of the
 * difference on each `input()`
 * (:205-210) from the tick AFTER the "dead" anim started (`input` runs above
 * `death()` in `Mobile.mobileUpdate`). ⚠ `input()` is skipped under
 * `Game.freezeObjects` and off screen; the renderer turns it every tick.
 */
function stepIceTurret(st, t, ctx, R) {
    if (!t.dead) {
        st.angle = t.angle;
    } else {
        if (st.angle === undefined) st.angle = t.angle;
        if (st.wasDead) st.angle -= (R.angleDifference(Math.atan2(1, 0), (-st.angle / 180) * Math.PI) * 180) / Math.PI / 10;
    }
    st.wasDead = t.dead;
    // The run carries the anim's NAME, not its index (`turretDamage`), so the renderer keeps the Spritemap's
    // clock: the names only ever go "" → startshot → finishshot → "", and each is a `play` from index 0 — the
    // finishshot one inside the startshot callback, with its timer zeroed (`iceTurret.iceTurretAnimStep`).
    const anims = ANIMS[KEYS.iceTurret];
    if (t.anim !== st.sprite.anim) {
        st.sprite = freshSprite();
        play(st.sprite, anims, t.anim);
    } else {
        R.updateSprite(st.sprite, anims, () => {});
    }
    st.frame = t.dead ? ICE_TURRET_DEAD_FRAME : (anims[t.anim] ? st.sprite.frame : 0);
}

/**
 * `BobBoss.update` (`BobBoss.as:98-115`) for the picture: the forming fade,
 * scale and green (:102-109); then BobSoldier's walk on aggro
 * (`BobSoldier.as:89-108`) and `standingAnimation` (:174-180); the graphic
 * update at the form's `rate`; and `death()`'s squash (:205-209), one step per
 * `nextBossTimer` the run spent. ⛓ The boss is first in the update list, so it
 * reads the freeze the previous frame LOWERED and runs whole on a page frame
 * (`levelRun` steps it `frozen: false`): its forming runs under the NPC's
 * dialogue, and so does this.
 */
function stepBobBoss(st, b, ctx, R) {
    const anims = ANIMS[KEYS.bobBoss(b.form)];
    if (st.prevForming > 0) {
        const ft = b.formingTimer;
        st.alpha = 1 - ft / FORMING_MAX;
        st.scale = 1 + ft / FORMING_MAX;
        const v = Math.trunc(255 * (1 - ft / FORMING_MAX));
        st.tint = rgbTint(v, 255, v);
    } else {
        if (!st.prevDestroy) st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        const p = ctx.player;
        if (p && Math.hypot(b.x - p.x, b.y - p.y) <= BOB_RUN_RANGE && st.sprite.anim !== 'walk') play(st.sprite, anims, 'walk');
    }
    if (st.sprite.anim === '') setFrame(st.sprite, BOB_WALK_FRAMES[R.worldFrame(ctx.time, BOB_WALK_FRAMES.length)]);
    R.updateSprite(st.sprite, anims, () => play(st.sprite, anims, ''), BOB_BOSS_RATE[b.form] ?? 1);
    for (let k = st.prevNext - b.nextBossTimer; k > 0; k -= 1) {
        st.scaleX /= 1.1;
        st.scaleY += 0.1;
    }
    st.prevForming = b.formingTimer;
    st.prevNext = b.nextBossTimer;
    st.prevDestroy = b.destroy;
}

/**
 * One GAME tick of every room body's picture (call it after every `tick()`).
 * Pure: returns a new object; `prev` null (or another visit) starts afresh.
 */
export function stepRoomBodySkin(prev, view, tick, { rules = ROOM_BODY_RULES } = {}) {
    if (!view) return prev;
    const R = rules === ROOM_BODY_RULES ? rules : { ...ROOM_BODY_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    const now = view.gameTime ?? tick;
    const seen = same ? prev.player : view.player;
    const ctx = { time, now, player: seen, playerBox: seen ? playerBoxAt(seen.x, seen.y) : null, probe: view.probe };
    const old = (k) => (same ? prev.bodies.get(k) : null);
    const bodies = new Map();
    for (const b of view.wallFlyers) {
        const o = old(`w:${b.id}`);
        const st = o ? { ...o, sprite: { ...o.sprite } } : { sprite: freshSprite(), tint: null, prevHits: 0, prevDestroy: false, angle: 0, vt: null };
        // `Enemy.update` (Enemy.as:62-118): the pit spin, else `hitUpdate` while not destroyed (at the top of the update).
        if (!st.prevDestroy && b.fallInPit) st.angle += PIT_SPIN * (cosmeticRand(view.level, hashId(b.id), 0, 34) < 0.5 ? -1 : 1);
        else if (!st.prevDestroy) st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        stepWallFlyer(st, b, ctx, R);
        st.prevHits = b.hitsTimer;
        st.prevDestroy = b.destroy;
        bodies.set(`w:${b.id}`, st);
    }
    for (const b of view.drills) {
        const o = old(`d:${b.id}`);
        const st = o ? { ...o } : { tint: null, prevHits: 0, prevDestroy: false, prevAnim: 'sit', visible: false, frame: DRILL_SIT_FRAME };
        if (!st.prevDestroy) st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        stepDrill(st, b);
        st.prevHits = b.hitsTimer;
        st.prevDestroy = b.destroy;
        bodies.set(`d:${b.id}`, st);
    }
    for (const t of view.iceTurrets) {
        const o = old(`i:${t.id}`);
        const st = o ? { ...o, sprite: { ...o.sprite } } : { tint: null, prevHits: 0, prevDestroy: false, wasDead: false, sprite: freshSprite() };
        if (!st.prevDestroy) st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        stepIceTurret(st, t, ctx, R);
        st.prevHits = t.hitsTimer;
        // `Enemy.startDeath`'s destroy, which the next `death()` consumes into the corpse (`iceTurret.killIceTurret`).
        st.prevDestroy = t.dying && !t.dead;
        bodies.set(`i:${t.id}`, st);
    }
    for (const t of view.shooters) {
        const o = old(`t:${t.id}`);
        const st = o ? { ...o } : { tint: null, prevHits: 0 };
        st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        const frames = ANIMS[KEYS.turret][t.anim]?.frames;
        st.frame = frames ? frames[Math.min(t.index, frames.length - 1)] : 0;
        st.prevHits = t.hitsTimer;
        bodies.set(`t:${t.id}`, st);
    }
    if (view.bobBoss) {
        const b = view.bobBoss;
        const o = old(`b:${b.id}`);
        // `BobBoss.as:83` alpha 0 and the ctor's white; `formingTimerMax` before the first update.
        const st = o ? { ...o, sprite: { ...o.sprite } }
            // The timer at the top of its first update: one more than the view's while forming (the model adds every
            // body at `formingTimerMax` and decrements on its first update), 0 for a body seen already formed.
            : { sprite: freshSprite(), tint: null, prevHits: 0, prevDestroy: false, prevForming: b.formingTimer > 0 ? b.formingTimer + 1 : 0, prevNext: b.nextBossTimer,
                alpha: 0, scale: 1, scaleX: 1, scaleY: 1 };
        stepBobBoss(st, b, ctx, R);
        st.prevHits = b.hitsTimer;
        bodies.set(`b:${b.id}`, st);
    }
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAt = (x, y, w, h, ox, oy) => ({ x: x - ox, y: y - oy, w, h, right: x - ox + w, bottom: y - oy + h });
const deg = (vx, vy) => (Math.atan2(-vy, vx) * 180) / Math.PI;

/**
 * THE ROOM BODIES' DRAW OPS at the tick `skin` was stepped to. Every op
 * carries the body's hitbox as its fallback rectangle; a body whose key the
 * stack lacks is that rectangle. FlashPunk turns counter-clockwise, so an
 * AS3 `angle` is the canvas's `-angle`.
 */
export function roomBodyOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const ops = [];
    const push = (key, frame, at, box, alpha, extra) => {
        const layer = extra.layer ?? -box.bottom;
        const fallback = rectOp(box, ENEMY_COLOUR, 0.9 * alpha, layer);
        if (!art.has(key)) { ops.push(fallback); return; }
        ops.push(spriteOp(art, key, frame, at, { alpha, layer, fallback, ...extra }));
    };
    for (const b of view.wallFlyers) {
        const st = skin.bodies.get(`w:${b.id}`);
        if (!st) continue;
        push(KEYS.wallFlyer, st.sprite.frame, b, boxAt(b.x, b.y, 14, 14, 7, 7), b.alpha, { rot: -st.angle, tint: st.tint });
    }
    for (const b of view.drills) {
        const st = skin.bodies.get(`d:${b.id}`);
        // `sprDrill.visible = false` while it sits: FlashPunk renders nothing.
        if (!st || !st.visible) continue;
        push(KEYS.drill, st.frame, b, boxAt(b.x, b.y, 10, 10, 5, 5), b.alpha, { tint: st.tint });
    }
    for (const t of view.iceTurrets) {
        const st = skin.bodies.get(`i:${t.id}`);
        if (!st) continue;
        // `render()` draws at the ROUNDED point (:99-107); `layer = -(y - originY + height)` (:96), 32x32 alive, 16x16 dead.
        const at = { x: Math.round(t.x), y: Math.round(t.y) };
        const box = t.dead ? boxAt(t.x, t.y, 16, 16, 8, 8) : boxAt(t.x, t.y, 32, 32, 16, 16);
        push(KEYS.iceTurret, st.frame, at, box, 1, { rot: -st.angle, tint: st.tint });
    }
    for (const s of view.blasts) {
        push(KEYS.iceBlast, 0, s, boxAt(s.x, s.y, 4, 4, 2, 2), 1, { rot: s.vx !== 0 || s.vy !== 0 ? -deg(s.vx, s.vy) : 0 });
    }
    for (const t of view.shooters) {
        const st = skin.bodies.get(`t:${t.id}`);
        if (!st) continue;
        // `Turret.as:37` `layer = -(y - originY + height * 4 / 5)`.
        push(KEYS.turret, st.frame, t, boxAt(t.x, t.y, 16, 16, 8, 8), 1, { rot: -t.angle, tint: st.tint, layer: -(t.y - 8 + (16 * 4) / 5) });
    }
    for (const s of view.spits) {
        push(KEYS.spit, 0, s, boxAt(s.x, s.y, 4, 4, 2, 2), 1, { rot: s.vx !== 0 || s.vy !== 0 ? -deg(s.vx, s.vy) : 0 });
    }
    if (view.bobBoss) {
        const b = view.bobBoss;
        const st = skin.bodies.get(`b:${b.id}`);
        if (st) {
            const box = boxAt(b.x, b.y, 14, 14, 7, 7);
            push(KEYS.bobBoss(b.form), st.sprite.frame, b, box, st.alpha,
                { scaleX: st.scale * st.scaleX, scaleY: st.scale * st.scaleY, tint: st.tint });
            // `BobSoldier.render` (:187-198): each blade at `swordSpin[i]` deg, the body's alpha, unscaled.
            if (art.has(KEYS.bobBossWeapons)) {
                for (let i = 0; i < b.swords; i += 1) {
                    ops.push(spriteOp(art, KEYS.bobBossWeapons, b.form, b,
                        { rot: -(b.swordSpin[i] * 180) / Math.PI, alpha: st.alpha, layer: -box.bottom }));
                }
            }
        }
    }
    return ops.filter(Boolean);
}
