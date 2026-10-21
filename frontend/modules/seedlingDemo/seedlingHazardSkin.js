/**
 * seedlingDemo/seedlingHazardSkin — **THE PUZZLEMENTS AND THE LAST ROOM
 * BODIES, IN THE ORIGINAL GRAPHICS** (Seedling JS graphics G3c): the spinning
 * axes, the crushers, the lava chains, the Boss Totem and its shots, the bomb
 * pusher and its bombs, and the placed grenades. G3b's three pieces again
 * (`seedlingRoomBodySkin.js`), in a SIBLING module so G3/G3b's goldens are
 * unchanged by construction (G3b's L40 tape holds the bomb pusher):
 *
 *   · `hazardSkinView(run)` — THE ONE ADAPTER from the run to what these
 *     pictures need. It copies; it writes nothing.
 *   · `stepHazardSkin(prev, view, tick)` — the renderer's own FlashPunk state
 *     per body, one GAME tick at a time.
 *   · `hazardOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the
 *     room by each body's own `layer`.
 *
 * ⛔⛔ THE GETTERS ARE LAZY, AND THE ADAPTER READS ONLY WHAT THE SIM BUILT.
 * `run.crushers` (`crusherStateFor`), `run.bossesWoken` (`bossStateFor`) and
 * `run.bombPushers` (`bombPusherStateFor`) each build their room's per-visit
 * state on first ask; `run.bombs`, `run.bossShots` and `run.placedGrenades`
 * read a list and build nothing that matters (`bombsFor` / `bossShotsFor`
 * seed `[]`; `placedGrenades` reads `placedGrenadeStates.get(level) ?? []`).
 * Three facts keep a renderer read from moving the sim:
 *   1. The adapter runs AFTER `tick()`, and each builder is called by that
 *      tick in the same room whenever its stepper runs: `stepCrushersNow`'s
 *      first line (under `!noclip`, every live tick — and `collidesSolid`'s
 *      crusher arm, every move); the boss loop (`bossStateFor(level).values()`,
 *      under `!noclip`); `stepBombPushersNow`'s first line (under `!noclip &&
 *      bombPusherLive`).
 *   2. Where a getter lacks its stepper's gate, the getter has the gate
 *      itself: `crushers` and `bossesWoken` return early under `noclip`, and
 *      `bombPushers` under `!bombPusherLive`. Only `bombPushers` under noclip
 *      can build first, and —
 *   3. every builder is a pure function of the room build (`createBombPusher`
 *      from the `.oel` row, `createBossTotem` from the world's row, the
 *      crusher from `world.crushers`): no RNG, no clock.
 * The axes and the chains have NO run state to read: theirs is in
 * `levelRun`'s closures (`spinningAxeStates`, `lavaChainStates`). Their rows
 * come from `run.world.combat.hazards` — built with the room, plain data — and
 * their clocks are the renderer's own (below).
 * `seedlingHazardSkin.test.js` holds each family's tape's stream, end state,
 * ledgers and `stateLog` byte-identical with all of this running every tick
 * and without it.
 *
 * ⛔ THE RENDERER ONLY READS. Where a class's picture reads state the run does
 * not carry, it is a CLOCK the renderer keeps per visit, exact by
 * transcription, never a second model of the motion:
 *   · the axe's `Image.angle` — `spinRate` per `update()` since the ctor; the
 *     count is the visit's updates, which a frozen tick is one of (the axe has
 *     no freeze test and `World.update` runs) — so the renderer counts every
 *     tick, where the model's own counter refuses on the first frozen one;
 *   · the chain's Spritemap — `lavaChain.stepLavaChain` (the SIM's
 *     transcription) at `Game.time`, once per tick, frozen ticks included;
 *   · the crusher's spin — `v.length > 0` at `render()`, recovered from the
 *     position and the grid snap (`crusherMoving`);
 *   · the Boss Totem's `currentFrame` (the arms' accumulator,
 *     `totemFrameStep`), `activationStage` and `rumblingTime` (pure functions
 *     of `sinceActivation`), its laser colour (of `laserWidth`) and its limbs'
 *     one-frame hit flash;
 *   · a grenade's Spritemap and a shot's, from the model's `anim`/`animAge`
 *     and from the tick the shot was first seen.
 * The bomb pusher's Spritemap, the bombs' `t` and every position are the
 * run's, read back.
 *
 * ⛔ NOT YET (`HAZARD_COVERAGE.remaining`): the 0.25-alpha `nightBmp` copies
 * and everything drawn ONLY to `nightBmp` — the totem's laser, the crusher's
 * detection rects, the totem's SCREEN-blend glow (G5); the explosions, the
 * grenade's light and the totem's white-out cover (G4); the Owl's grenades
 * (the run keeps them in a closure, `owlGrenades`, with only an event
 * ledger); the cosmetic draws (`Rng.cos()`, the totem's rumble — a named band,
 * drawn with `cosmeticRand`).
 */
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { ANIMS, ENEMY_COLOUR, ENEMY_HIT_TINT, freshSprite, hashId, play, rectOp, spriteOp, updateSprite } from './seedlingEnemySkin.js';
import { createLavaChainState, LAVA_CHAIN, stepLavaChain } from './lavaChain.js';
import { BOSS_TOTEM_FIGHT, HEAD_POS_Y } from './bossTotemFight.js';
import { BOMB } from './bombPusher.js';

export const KEYS = Object.freeze({
    axe: (red) => (red ? 'seedling:puzzlement/spinningaxeRed' : 'seedling:puzzlement/spinningaxe'),
    crusher: 'seedling:puzzlement/crusher',
    chain: 'seedling:puzzlement/lavachain',
    totem: 'seedling:enemy/bosstotem',
    totemShot: 'seedling:projectile/bosstotemshot',
    bombPusher: 'seedling:enemy/bombpusher',
    bomb: 'seedling:projectile/bomb',
    grenade: 'seedling:enemy/grenade',
});

/**
 * WHAT G3c DRAWS, by AS3 class. With G3's and G3b's `drawn` this is the
 * skinned paint's whole roster.
 */
export const HAZARD_COVERAGE = Object.freeze({
    drawn: Object.freeze(['SpinningAxe', 'Crusher', 'LavaChain', 'BossTotem', 'BossTotemShot', 'BombPusher', 'Bomb', 'Grenade']),
    remaining: Object.freeze(['the Owl\'s grenades (no run state)', 'nightBmp-only draws: the totem laser, crusher rects, glow (G5)',
        'explosions, the grenade light, the white-out cover (G4)']),
});

/** The world tags these families are, for `roomOps`' `drawnObjects` (their static solid is not drawn again). */
export const HAZARD_OBJECT_TAGS = Object.freeze(new Set(['spinningaxe', 'crusher', 'lavachain', 'bosstotem', 'bombpusher']));

/** `Crusher.as:25` `spinRate`; `Tile.w` (the snap). */
const CRUSHER_SPIN = 8;
const TILE = 16;
/** `Bomb.as:89-91,121`: the scale's bounds and the turn per update; `-FP.height` (`Main.as:36`, 160). */
const BOMB_SCALE_MIN = 0.5;
const BOMB_SCALE_MAX = 1.5;
const BOMB_SPIN = 15;
const BOMB_LAYER = -160;

// ── THE BOSS TOTEM'S POSE TABLES (`BossTotem.as:22-196`), verbatim. Arms then legs; `[x, y]` per frame. ──
const P = (...xy) => Object.freeze(xy.map(([x, y]) => Object.freeze({ x, y })));
const yOnly = (ys) => P(...ys.map((y) => [0, y]));
export const TOTEM_POSE = Object.freeze({
    head: Object.freeze({
        rest: { pos: yOnly(HEAD_POS_Y.rest), ang: Object.freeze(Array(8).fill(0)) },
        walk: { pos: yOnly(HEAD_POS_Y.walk), ang: Object.freeze(Array(8).fill(0)) },
        jump: { pos: yOnly(HEAD_POS_Y.jump), ang: Object.freeze(Array(8).fill(0)) },
        attack: { pos: yOnly(HEAD_POS_Y.attack), ang: Object.freeze(Array(14).fill(0)) },
    }),
    arms: Object.freeze({
        rest: { ang: [0, 2, 4, 8, 9, 8, 4, 2], pos: P([0, 0], [0, 1], [0, 2], [0, 4], [0, 5], [0, 4], [0, 2], [0, 1]) },
        walk: { ang: [0, 2, 4, 8, 9, 8, 4, 2], pos: P([0, 0], [1, 1], [1, 2], [2, 4], [2, 5], [1, 4], [1, 2], [0, 1]) },
        jump: { ang: [0, 3, 6, 9, 12, 15, 18, 21, 24], pos: P([0, 0], [-2, -1], [-6, -2], [-10, -4], [-13, -5], [-16, -6], [-18, -7], [-18, -8]) },
        attack: { ang: [0, 5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 5],
            pos: P([0, 0], [-1, 4], [-1, 9], [-1, 13], [-1, 17], [-1, 30], [-1, 40], [-1, 44], [-1, 40], [-1, 30], [-1, 20], [-1, 13], [-1, 9], [-1, 4]) },
    }),
    legs: Object.freeze({
        rest: { ang: Array(8).fill(0), pos: P([0, 0], [0, 0], [1, 0], [1, 0], [1, 0], [1, 0], [0, 0], [0, 0]) },
        walk: { ang: [0, -5, -10, -5, 0, -5, -10, -5], pos: P([0, 0], [0, 2], [1, 4], [1, 2], [1, 0], [1, -2], [1, -4], [0, -2]) },
        jump: { ang: [0, -1, -2, -3, -4, -5, -6, -7, -8], pos: P([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0]) },
        attack: { ang: Array(14).fill(0), pos: P([0, 0], [1, 0], [1, 0], [1, 0], [2, 0], [2, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]) },
    }),
    armsBase: { x: 23, y: 0 },
    legsBase: { x: 6, y: 16 },
    headOrigin: { x: 16, y: 47 },
    /** `render()`'s `defXxxPos`/`defXxxAng` (:516-521): the pose at `activationStage` 0. */
    def: { legs: { x: 12, y: -8, ang: 45 }, arms: { x: -20, y: 4, ang: -45 }, head: { x: 0, y: 36, ang: 0 } },
    bodyAngMax: 10,
    rumbleDistMax: 3,
    rumbleAngleMax: 20,
    rumblingTimeMax: 240,
    activationRate: 0.02,
    easingN: 8,
    laserWidthDef: 6,
    hitsTimerMax: 20,
    src: 'Enemies/BossTotem.as:22-196 (tables), :226-240 (constants), :505-655 (render), :672-700 (renderPart)',
});
/** `BossTotem.as:201-202` laserColDef / laserColHit / laserColMax. */
const LASER_HIT_RGB = [0xff, 0x00, 0x00];
const LASER_MAX = '#ffff00';
/** `Enemy.as:25` `hitsTimerInt`. */
const HITS_TIMER_INT = 10;

const hex2 = (n) => n.toString(16).padStart(2, '0');
/** `FP.getColorRGB` / `colorLerp` results as the renderer's tint string; white is no tint. */
const rgbTint = (r, g, b) => (r === 255 && g === 255 && b === 255 ? null : `#${hex2(r)}${hex2(g)}${hex2(b)}`);
/** AS3 `int` (a Number assigned to an `int` variable): toward zero. */
const toInt = (n) => Math.trunc(n);

// ── the adapter ─────────────────────────────────────────────────────────

/** A getter's value, or `fallback` when the run has no such member (a stub run in a test). */
const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/**
 * THE ADAPTER. Everything these bodies' pictures read, from the run, as plain
 * objects (null when there is no run). The visit identity is G3's.
 */
export function hazardSkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const hazards = world?.combat?.hazards ?? [];
    const crushers = read(run, 'crushers', null);
    const woken = read(run, 'bossesWoken', []) ?? [];
    // ⚠ `bossesWoken` carries no id; the game's one totem (L43) pairs with the world's one row. A room of two would
    // be drawn asleep — a finding, not a guess.
    const totemRows = world?.bossTotems ?? [];
    const totems = totemRows.map((t) => {
        const w = totemRows.length === 1 ? woken[0] : null;
        if (!w) return { id: t.id, x: t.ex, y: t.ey, activated: false };
        return {
            id: t.id, x: w.x, y: w.y, activated: true, sinceActivation: w.sinceActivation, fullyActivated: !!w.fullyActivated,
            activationRestTime: w.activationRestTime, waitAtTopTime: w.waitAtTopTime, state: w.state, anim: w.anim, rate: w.rate,
            hitsTimer: w.hitsTimer ?? 0, laserWidth: w.laserWidth, destroy: !!w.destroy, whiteOutRenders: w.whiteOutRenders ?? 0,
            removed: !!w.removed,
        };
    }).filter((t) => !t.removed);
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        axes: hazards.filter((h) => h.tag === 'spinningaxe').map((h) => ({
            id: `${h.tag}@${h.x},${h.y}`, x: h.cx, y: h.cy, rate: Number(h.attrs?.rate ?? 0), red: Number(h.attrs?.colortype ?? 0) === 1,
        })),
        chains: hazards.filter((h) => h.tag === 'lavachain').map((h) => ({
            id: `${h.tag}@${h.x},${h.y}`, x: h.cx, y: h.cy, dir: Number(h.attrs?.dir ?? 0),
        })),
        crushers: crushers ? [...crushers.values()].map((c) => ({ id: c.id, x: c.x, y: c.y })) : [],
        totems,
        totemShots: (read(run, 'bossShots', []) ?? []).filter((s) => !s.removed).map((s) => ({ id: s.id, x: s.x, y: s.y })),
        bombPushers: (read(run, 'bombPushers', []) ?? []).map((b) => ({ id: b.id, x: b.x, y: b.y, anim: b.anim, index: b.animIndex })),
        bombs: (read(run, 'bombs', []) ?? []).filter((s) => !s.removed).map((s) => ({ id: s.id, x: s.x, y: s.y, t: s.t })),
        grenades: (read(run, 'placedGrenades', []) ?? []).filter((g) => !g.removed).map((g) => ({
            id: g.id, x: g.x, y: g.y, endY: g.endY, anim: g.anim, age: g.animAge, updates: g.updates,
        })),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the clocks ──────────────────────────────────────────────────────────

/**
 * `Crusher.update` (`Crusher.as:43-85`) leaves `v` non-zero exactly when it
 * moved this update: at rest it snaps to the grid (`Math.round`) and a scan
 * may set `v`, then `moveX`/`moveY` step 1 px or zero `v` on the first Solid.
 * So `v.length > 0` at `render()` ⇔ the body is neither where it was nor
 * where the snap put it. ⚠ One band, named: a body parked 1 px off the grid
 * that charges straight back over its old pixel reads as still.
 */
function crusherMoving(prev, c) {
    if (!prev) return false;
    const sx = prev.moving ? prev.x : Math.round(prev.x / TILE) * TILE;
    const sy = prev.moving ? prev.y : Math.round(prev.y / TILE) * TILE;
    return (c.x !== prev.x || c.y !== prev.y) && (c.x !== sx || c.y !== sy);
}

/** `activationStage` after the update with `sinceActivation` k (`BossTotem.as:300-311`) — a cached run of the ramp. */
const STAGES = [];
export function totemActivationStage(k) {
    const T = TOTEM_POSE;
    if (k < 0) return 0;
    let stage = STAGES.length ? STAGES[STAGES.length - 1] : 0;
    for (let i = STAGES.length; i <= k; i += 1) {
        // `rumblingTime--` from `rumblingTimeMax` on every activated update, then the ramp once it is ≤ max / 2.
        const rumbling = Math.max(0, T.rumblingTimeMax - 1 - i);
        if (rumbling <= T.rumblingTimeMax / 2 && stage < 1) {
            const n = T.easingN;
            stage += T.activationRate * (n - 1) / n * Math.sin(stage * Math.PI) + T.activationRate / n;
            if (stage >= 1) stage = 1;
        }
        STAGES.push(stage);
    }
    return STAGES[k];
}

/**
 * The arms' accumulator (`BossTotem.as:316-410`): `currentFrame` advances by
 * `animateRate[anim] · rate` on an update whose machine ran; a state change
 * (`changeAnimation`, :710-717) zeroes it; the jump clamps to its last frame
 * and stops it until the walk or the attack arm turns `animate` back on.
 * The machine ran ⇔ the boss is fully activated, not dying, the top wait and
 * the rest timer were both spent BEFORE the update, and it was a live update
 * (one `sinceActivation` step — a frozen span is many in one tick).
 */
function totemFrameStep(st, prevT, t) {
    const F = BOSS_TOTEM_FIGHT;
    const ran = !!prevT?.activated && t.fullyActivated && !t.destroy && prevT.waitAtTopTime === 0
        && prevT.activationRestTime === 0 && t.sinceActivation - prevT.sinceActivation === 1;
    if (ran) {
        const from = st.anim;
        if (from === 'jump' && st.frame + F.animateRate.jump * t.rate >= F.animateFrames.jump) {
            st.frame = F.animateFrames.jump - 1;
            st.animate = false;
        } else if (from !== 'jump') {
            st.animate = true;
        }
        if (t.anim !== from) st.frame = 0;
        if (st.animate) st.frame = (st.frame + F.animateRate[t.anim] * t.rate) % F.animateFrames[t.anim];
    }
    st.anim = t.anim;
}

/** `laserCol` from `laserWidth` (`laserStep`, :420-433): the default at 6, `laserColMax` once fired (18), else the lerp. */
export function totemLaserTint(w) {
    const T = TOTEM_POSE;
    if (w === undefined || w <= T.laserWidthDef) return null;
    if (w >= T.laserWidthDef * 3) return LASER_MAX;
    const k = (w - T.laserWidthDef) / T.laserWidthDef / 2 + 0.5;
    if (k >= 1) return rgbTint(...LASER_HIT_RGB);
    // `FP.colorLerp`: each channel a `uint += int · t` — truncated.
    const [r, g, b] = [255, 255, 255].map((c, i) => Math.trunc(c + (LASER_HIT_RGB[i] - c) * k));
    return rgbTint(r, g, b);
}

/** `SpinningAxe.update` (:52): `angle += spinRate` on every update since the ctor (FlashPunk degrees, CCW). */
const axeAngle = (rate, updates) => rate * updates;

/** The bomb pusher's frame from the MODEL's Spritemap (`bombPusher.js`): "" (never played) is frame 0. */
function pusherFrame(anim, index) {
    const frames = ANIMS[KEYS.bombPusher][anim]?.frames;
    return frames ? frames[index] ?? frames[0] : 0;
}

/**
 * `Bomb.update` (:108-122): `t--`, the scale from the new `t`, then
 * `angle += 15`. Before its first update (t 30, the spawn tick) the Image is
 * unscaled and unturned (`scale` is written only in `update`).
 */
function bombPose(t) {
    if (t === BOMB.tMax) return { scale: 1, angle: 0 };
    return { scale: (BOMB_SCALE_MAX - BOMB_SCALE_MIN) * (Math.sin((t / BOMB.tMax) * Math.PI) + 1) / 2 + BOMB_SCALE_MIN, angle: BOMB_SPIN * (BOMB.tMax - t) };
}

/** The reducer's and the ops' rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const HAZARD_RULES = Object.freeze({
    axeAngle, updateSprite, crusherMoving, totemFrameStep, totemActivationStage, totemLaserTint, stepLavaChain, pusherFrame, bombPose,
});

/**
 * One GAME tick of every body's picture (call it after every `tick()`).
 * Pure: returns a new object; `prev` null (or another visit) starts afresh.
 *
 * ⛓ THE VISIT'S FIRST TICK. A door, a death or an ending swaps the world at
 * the END of a tick (`levelRun`'s `firstTickInWorld = true`), so the first
 * view of a swapped visit has updated none of its bodies yet; a run's first
 * view (the boot room, built before tick 1) has updated them once.
 */
export function stepHazardSkin(prev, view, tick, { rules = HAZARD_RULES } = {}) {
    if (!view) return prev;
    const R = rules === HAZARD_RULES ? rules : { ...HAZARD_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const boot = !prev || prev.epoch.run !== view.epoch.run;
    const updatesNow = same ? 1 : (boot ? 1 : 0);
    const updates = (same ? prev.updates : 0) + updatesNow;
    // `Game.time` of this tick's update: the clock after it, less the one `time += timeRate` it advanced.
    const time = view.gameTime === null ? null : view.gameTime - 1;
    const old = (k) => (same ? prev.bodies.get(k) : null);
    const bodies = new Map();
    // the axes: `angle += spinRate` per update since the ctor (`SpinningAxe.as:52`)
    for (const a of view.axes) bodies.set(`a:${a.id}`, { angle: R.axeAngle(a.rate, updates) });
    // the chains: the sim's own Spritemap transcription at `Game.time`, once per update; the angle from `direction`
    for (const c of view.chains) {
        const o = old(`c:${c.id}`);
        const st = o ? { ...o, anim: { ...o.anim } } : { anim: createLavaChainState(), unknown: false };
        if (updatesNow) {
            if (time === null) st.unknown = true;
            else R.stepLavaChain(st.anim, time);
        }
        bodies.set(`c:${c.id}`, st);
    }
    // the crushers: `render()`'s `angle += 8` while v ≠ 0, else 0 (`Crusher.as:107-113`)
    for (const c of view.crushers) {
        const o = old(`k:${c.id}`);
        const moving = R.crusherMoving(o, c);
        bodies.set(`k:${c.id}`, { x: c.x, y: c.y, moving, angle: moving ? (o?.angle ?? 0) + CRUSHER_SPIN : 0 });
    }
    for (const t of view.totems) {
        const o = old(`t:${t.id}`);
        const st = o ? { ...o } : { anim: t.anim ?? 'rest', frame: 0, animate: true, prev: null };
        if (t.activated) R.totemFrameStep(st, st.prev, t);
        st.prev = t;
        bodies.set(`t:${t.id}`, st);
    }
    // the shots: "fly" from the ctor; the first sight is the spawn tick (the shot updates from the next one)
    for (const s of view.totemShots) {
        const o = old(`s:${s.id}`);
        const st = o ? { sprite: { ...o.sprite } } : { sprite: freshSprite() };
        if (!o) play(st.sprite, ANIMS[KEYS.totemShot], 'fly');
        else R.updateSprite(st.sprite, ANIMS[KEYS.totemShot], () => {});
        bodies.set(`s:${s.id}`, st);
    }
    // the grenades: the model's anim and its age (`placedGrenade.animAge`), "sit" from the ctor (`updates`)
    for (const g of view.grenades) {
        const o = old(`g:${g.id}`);
        const anim = g.anim ?? 'sit';
        const age = g.anim === 'sit' || g.anim === null ? g.updates : g.age;
        const anims = ANIMS[KEYS.grenade];
        let sp;
        if (o && o.anim === anim && o.age === age) {
            sp = { ...o.sprite };
        } else if (o && o.anim === anim && o.age + 1 === age) {
            sp = { ...o.sprite };
            R.updateSprite(sp, anims, () => {});
        } else {
            sp = freshSprite();
            play(sp, anims, anim);
            for (let k = 0; k < age; k += 1) R.updateSprite(sp, anims, () => {});
        }
        bodies.set(`g:${g.id}`, { anim, age, sprite: sp });
    }
    return { epoch: view.epoch, gameTime: view.gameTime, updates, bodies };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAt = (x, y, w, h, ox, oy) => ({ x: x - ox, y: y - oy, w, h, right: x - ox + w, bottom: y - oy + h });

/** A sprite op whose pivot is `origin` instead of the sheet's (a part that sets its own, `BossTotem.setOrigin`). */
function partOp(art, key, frame, at, origin, extra) {
    const op = spriteOp(art, key, frame, at, extra);
    if (!op) return null;
    return { ...op, dx: at.x - origin.x, dy: at.y - origin.y, pivotX: origin.x, pivotY: origin.y };
}

/**
 * `BossTotem.render()` (`:505-655`): the blended pose, the activation blend
 * toward the default pose, then the two legs, the two arms and (once
 * activated) the head, each at its own origin. AS3 `int` angles truncate.
 * ⚠ The rumble's two `Rng.cos()` draws are the cosmetic stream (⚖ never
 * modelled): `cosmeticRand` stands in for them, a named band.
 */
export function totemParts(view, t, st, R = HAZARD_RULES) {
    const T = TOTEM_POSE;
    const anim = st.anim ?? 'rest';
    const frames = BOSS_TOTEM_FIGHT.animateFrames[anim];
    const f = Math.floor(st.frame);
    const fu = Math.ceil(st.frame) % frames;
    const blend = (tab) => ({
        x: (tab.pos[fu].x + tab.pos[f].x) / 2,
        y: (tab.pos[fu].y + tab.pos[f].y) / 2,
        ang: toInt((tab.ang[fu] + tab.ang[f]) / 2),
    });
    const legs = blend(T.legs[anim]);
    const arms = blend(T.arms[anim]);
    const head = blend(T.head[anim]);
    const val = t.activated ? R.totemActivationStage(t.sinceActivation) : 0;
    const since = t.activated ? t.sinceActivation : -1;
    const rumbling = (since >= 0 ? Math.max(0, T.rumblingTimeMax - 1 - since) : T.rumblingTimeMax) + (t.destroy ? t.whiteOutRenders : 0);
    const rumble = (1 - Math.cos((rumbling / T.rumblingTimeMax) * 2 * Math.PI)) / 2;
    const h = hashId(t.id);
    const ra = rumble ? cosmeticRand(view.level, h, view.gameTime ?? 0, 0) * rumble * T.rumbleAngleMax : 0;
    const rd = rumble ? (cosmeticRand(view.level, h, view.gameTime ?? 0, 1) - 0.5) * T.rumbleDistMax * rumble : 0;
    const toward = (p, d) => ({
        x: (p.x - d.x) * val + d.x + rd, y: (p.y - d.y) * val + d.y + rd, ang: toInt((p.ang - d.ang) * val + d.ang + ra),
    });
    const L = toward(legs, T.def.legs);
    const A = toward(arms, T.def.arms);
    const H = toward(head, T.def.head);
    const body = toInt(T.bodyAngMax * (1 - val));
    const parts = [
        { part: 'leg', frame: 2, at: { x: t.x - L.x + T.legsBase.x, y: t.y + L.y + T.legsBase.y }, origin: { x: 0, y: 0 }, angle: L.ang + body, scaleX: 1 },
        { part: 'leg', frame: 2, at: { x: t.x + L.x - T.legsBase.x, y: t.y - L.y + T.legsBase.y }, origin: { x: 0, y: 0 }, angle: -L.ang + body, scaleX: -1 },
        { part: 'arm', frame: 1, at: { x: t.x - A.x - T.armsBase.x, y: t.y + A.y + T.armsBase.y }, origin: { x: T.armsBase.x, y: 0 }, angle: A.ang + body, scaleX: 1 },
        { part: 'arm', frame: 1, at: { x: t.x + A.x + T.armsBase.x, y: t.y + A.y + T.armsBase.y }, origin: { x: T.armsBase.x, y: 0 }, angle: -A.ang + body, scaleX: -1 },
    ];
    if (t.activated) {
        parts.push({ part: 'head', frame: 0, at: { x: t.x + H.x, y: t.y + H.y }, origin: T.headOrigin, angle: H.ang, scaleX: 1,
            alpha: val < 1 ? val : 1, tint: R.totemLaserTint(t.laserWidth) });
    }
    return parts;
}

/**
 * The limbs' hit flash (`Enemy.hitUpdate`, `Enemy.as:223-243`): `render()` sets
 * the colour back to white at its end (`BossTotem.as:642`), so the flash is ONE
 * frame — the update whose `hitsTimer` (before its decrement) is a positive
 * multiple of `hitsTimerInt` and not the last. The run carries the timer
 * AFTER the decrement: 19 and 9. A 20 is a hit that landed after the update.
 */
const totemFlash = (h) => h > 0 && h < TOTEM_POSE.hitsTimerMax && (h + 1) % HITS_TIMER_INT === 0;

/**
 * THE DRAW OPS at the tick `skin` was stepped to. Every op carries the body's
 * box as its fallback rectangle; a body whose key the stack lacks is that
 * rectangle. FlashPunk turns counter-clockwise, so an AS3 `angle` is the
 * canvas's `-angle`.
 */
export function hazardOps(view, art, { skin, rules = HAZARD_RULES } = {}) {
    if (!view || !art || !skin) return [];
    const R = rules === HAZARD_RULES ? rules : { ...HAZARD_RULES, ...rules };
    const ops = [];
    const push = (key, frame, at, box, alpha, extra) => {
        const layer = extra.layer ?? -box.bottom;
        const fallback = rectOp(box, ENEMY_COLOUR, 0.9 * alpha, layer);
        if (!art.has(key)) { ops.push(fallback); return; }
        ops.push(spriteOp(art, key, frame, at, { alpha, layer, fallback, ...extra }));
    };
    for (const a of view.axes) {
        const st = skin.bodies.get(`a:${a.id}`);
        // `layer = -(y + length)` (`SpinningAxe.as:62`).
        if (st) push(KEYS.axe(a.red), 0, a, boxAt(a.x, a.y, 8, 8, 4, 4), 1, { rot: -st.angle, layer: -(a.y + 32) });
    }
    for (const c of view.chains) {
        const st = skin.bodies.get(`c:${c.id}`);
        // `angle = 90 · direction` (:52); `layer = -(y - originY + height)` (:46); the anim's frame, 0 before the first trigger.
        if (st) push(KEYS.chain, st.unknown ? 0 : st.anim.frame, c, boxAt(c.x, c.y, 16, 16, 8, 8), 1, { rot: -90 * c.dir, layer: -(c.y + 8) });
    }
    for (const c of view.crushers) {
        const st = skin.bodies.get(`k:${c.id}`);
        // `Crusher` writes no `layer`: 0, under every Y-sorted body.
        if (st) push(KEYS.crusher, 0, c, boxAt(c.x, c.y, 32, 32, 16, 16), 1, { rot: -st.angle, layer: 0 });
    }
    for (const t of view.totems) {
        const st = skin.bodies.get(`t:${t.id}`);
        if (!st) continue;
        // `Mobile.layering` once `super.update()` runs (activated): `-(y - originY + height)`, originY −12, height 32.
        const layer = t.activated ? -(t.y + 12 + 32) : 0;
        const box = boxAt(t.x, t.y, 80, 32, 40, -12);
        const fallback = rectOp(box, ENEMY_COLOUR, 0.9, layer);
        if (!art.has(KEYS.totem)) { ops.push(fallback); continue; }
        const flash = t.activated && totemFlash(t.hitsTimer) ? ENEMY_HIT_TINT : null;
        for (const p of totemParts(view, t, st, R)) {
            ops.push(partOp(art, KEYS.totem, p.frame, p.at, p.origin, {
                rot: -p.angle, ...(p.scaleX !== 1 ? { scaleX: p.scaleX } : {}), alpha: p.alpha ?? 1,
                tint: p.part === 'head' ? p.tint : flash, layer, fallback: p.part === 'head' ? null : fallback,
            }));
        }
    }
    for (const s of view.totemShots) {
        const st = skin.bodies.get(`s:${s.id}`);
        // `Mobile.layering`: −(y − 8 + 16); `v.x` is 0, so `imageAngle` never turns it (`spinRate · FP.sign(v.x)`).
        if (st) push(KEYS.totemShot, st.sprite.frame, s, boxAt(s.x, s.y, 16, 16, 8, 8), 1, { layer: -(s.y + 8) });
    }
    for (const b of view.bombPushers) {
        // `Mobile.layering`: −(y − 24 + 48).
        push(KEYS.bombPusher, R.pusherFrame(b.anim, b.index), b, boxAt(b.x, b.y, 48, 48, 24, 24), 1, { layer: -(b.y + 24) });
    }
    for (const s of view.bombs) {
        // `layering()` is overridden to `-FP.height` (:124-127).
        const { scale, angle } = R.bombPose(s.t);
        push(KEYS.bomb, 0, s, boxAt(s.x, s.y, 16, 16, 8, 8), 1, { rot: -angle, scaleX: scale, scaleY: scale, layer: BOMB_LAYER });
    }
    for (const g of view.grenades) {
        const st = skin.bodies.get(`g:${g.id}`);
        // `render()` (:115-118): alpha = (y − startY) / (endY − startY); a dormant grenade (alpha 0) draws nothing.
        const alpha = (g.y - (g.endY - 48)) / 48;
        if (!st || alpha <= 0) continue;
        push(KEYS.grenade, st.sprite.frame, g, boxAt(g.x, g.y, 6, 6, 3, 3), alpha, { layer: -(g.y + 3) });
    }
    return ops.filter(Boolean);
}
