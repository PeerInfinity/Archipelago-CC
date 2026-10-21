/**
 * seedlingDemo/seedlingPlayerSkin — **THE PLAYER IN THE ORIGINAL GRAPHICS**
 * (Seedling JS graphics G2). Three pieces, so the renderer never reads the
 * run directly and node can pin every frame choice without a canvas:
 *
 *   · `skinView(run)` — THE ONE ADAPTER from the sim's run to what the
 *     player's picture needs: position, velocity, facing, terrain (the swim
 *     row), damage (the hit flash), the freeze tint, the suit and sword, the
 *     sword swing, the pit fall and the ceiling descent. A plain object. The
 *     fidelity waves keep renaming run state; when they do, this function is
 *     the only reader to move. It reads the run's stable queries
 *     (`run.state`, `run.damage`, `run.progress(…)`) and copies; it writes
 *     nothing.
 *   · `stepPlayerSkin(prev, view, tick)` — the RENDERER'S OWN copy of the
 *     FlashPunk state the picture keeps between ticks and the sim does not:
 *     which animation is playing and since when (`Spritemap.play` restarts a
 *     clock only on a NEW name), the mirror (`scaleX` keeps its sign while
 *     `v.x` is 0), the tint (`Image.color`, toggled rather than derived), and
 *     when the swing and the descent began. A pure reducer, run once per
 *     GAME tick, never per paint (a frame can hold up to five ticks, and the
 *     toggles and restarts are per tick).
 *   · `playerOps(view, art, { tick, skin })` — PURE. The player's draw ops
 *     (`seedlingSkinRenderer`'s op shape), appended to the room's list and
 *     Y-sorted with the scenery. `[]` when the stack lacks the suit's key, so
 *     the room keeps its white hitbox.
 *
 * ⛔ THE RENDERER ONLY READS. Nothing here steps the sim or draws from its
 * RNG: the pit spin's sign (`fallSpinSpeed = 8 * FP.choose(-1, 1)`,
 * `Player.as:344`, on the GAMEPLAY stream) comes from `cosmeticRand` keyed by
 * the fall's pit, so it is stable per pit and need not match the wasm
 * (⚖ never model the cosmetic RNG). `seedlingPlayerSkin.test.js` holds a real
 * walk's state, reports and `stateLog` byte-identical with all three running.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src/Player.as`) ──────
 *
 *   · THE SUIT — `getSuit()` (:604-614): `ShrumDark` with the dark suit, else
 *     `ShrumBlue`; 16×16 frames `centerOO`d on (x, y) (:383-384).
 *   · THE ANIMATION — `sprites()` (:1665-1688), after `super.update()`:
 *     side-walk if `v.x ≠ 0` (and not faced up/down) or faced sideways; else
 *     up-walk if `v.y < 0` or faced up; else down-walk if `v.y > 0` or faced
 *     down; then a STAND by `direction` if `v` is zero. The name carries the
 *     `states[state]` prefix of the sticky terrain (:83-86: "swim-" on water
 *     1, lava 17 and waterfall 25), so stepping into water restarts the
 *     cycle. `addAnimations` (:635-660) gives walk fps 15 (swim 5), stand 1.
 *   · THE CLOCK — `Spritemap.update` (`Spritemap.as:70-99`) adds
 *     `fps · FP.elapsed` per update and `play` (`Spritemap.as:124-139`) zeroes
 *     it on a new name. The World updates the graphic AFTER the entity
 *     (`World.as:56-58`), so a cycle played at tick P shows index
 *     `floor((t − P + 1) · fps · 0.0333)` after tick t. The sword overlay is
 *     not the entity's graphic; `sprites()` updates it by hand (:1619), below
 *     the press, so it follows the same rule.
 *   · THE MIRROR — `render()` (:1149-1171): faced (`directionFace ≥ 0`) →
 *     mirrored iff `direction == 2`; else mirrored on `v.x < 0`, unmirrored on
 *     `v.x > 0`, and left as it was on `v.x == 0`.
 *   · THE TINT — `freezeStep()` (:591-600) paints `0x0000FF` while
 *     `frozenTimer > 0` and resets at 0; `hitUpdate()` (:1403-1426), later in
 *     the same update, TOGGLES red/white whenever the pre-decrement
 *     `hitsTimer % 10 == 0` and resets at 0. `Image.color` multiplies.
 *   · THE SWORD — `getSword()` (:616-632): ghost, else dark, else plain.
 *     Drawn after the body (:1215 then :1277) at angle `90 · slashDirection`
 *     about the player's position; the dash ("slashnarrow") scales 1.5 × 0.65
 *     unless it is the ghost sword (:1260-1268); the ghost sword sweeps
 *     `+90 − 180 · index / (n − 1)`, and −45 more on a dash (:1271-1276). A
 *     dash also draws four trailing copies of the body, `i·v` behind it at
 *     alpha `(4 − i − 1) / 4 + 0.5`, BEFORE the body (:1197-1213).
 *   · THE PIT — `checkFallingInPit()` (:745-770): faced down, `angle +=
 *     fallSpinSpeed` (±8) and `alpha −= 0.05` per tick until 0.
 *   · THE DESCENT — `fallFromCeiling` (:500-525): `sprites()` does not run, so
 *     the constructor's "down-stand" (:388) keeps playing; `angle += 10` per
 *     tick and `layer = −yStart` until it lands.
 *   · THE LAYER — `Mobile.layering()` (`Mobile.as:52-58`): `−(hitbox bottom)`.
 *   · DEATH — `die()` is `restartLevel()` (:1487-1491, `Game.as:2031-2034`):
 *     a new world at once, so the body has no death frame (the fade is G4).
 *     ShrumDark's "die" row (:661-666) belongs to the final bad-ending scene.
 *
 * ⛔ NOT YET: the shield (:1181-1256), the spear, wands, fire and death ray,
 * the 0.25-alpha lighting copies (`nightBmp`, G5), the torch light, the
 * `Game.freezeObjects` stand, and a suit change's separate Spritemap clock.
 */
import { FP_ELAPSED_PER_TICK } from '../artLibrary/artLibrary.js';
import { FALL_ALPHA_SPEED, FALL_ALPHA_START, INITIAL_DIRECTION, playerBoxAt } from './playerPhysicsV2.js';
import { PLAYER_COLOUR, cosmeticRand } from './seedlingSkinRenderer.js';

/** `Player.as:83-86` — the `states` rows that read "swim-": water, lava, waterfall. */
export const SWIM_STATES = Object.freeze(new Set([1, 17, 25]));
/** `Player.as:338-340`. */
export const HIT_TINT = '#ff0000';
export const FROZEN_TINT = '#0000ff';
/** `Player.as:336-337` `hitsTimerMax`, `hitsTimerInt`. */
const HITS_TIMER_MAX = 20;
const HITS_TIMER_INT = 10;
/** `Player.as:505` — the descent's spin per tick. */
const DESCENT_SPIN = 10;
/** `Player.as:344` — `8 * FP.choose(-1, 1)`; the sign is the renderer's own. */
const PIT_SPIN = 8;
/** `Player.as:1199`. */
const DASH_BLURS = 4;
/** `Player.as:408` `ghostSwordAnimFrames`: the dash entry is `length * 2`. */
const GHOST_SWEEP_FRAMES = Object.freeze({ slash: 7, slashnarrow: 8 });

export const SUIT_KEYS = Object.freeze({ blue: 'seedling:player/shrum', dark: 'seedling:player/shrumDark' });
export const SWORD_KEYS = Object.freeze({
    plain: 'seedling:player/slash', dark: 'seedling:player/slashDark', ghost: 'seedling:player/ghostSword',
});

/**
 * THE ADAPTER. Everything the player's picture reads, from the run, as a plain
 * object (null when there is no run). `epoch` is the VISIT — the run, the
 * level and how many crossings and deaths it has made (G3's identity) — an
 * identity only, compared by `stepPlayerSkin`: a new visit is a new `Player`,
 * whose Spritemap starts afresh. ⛔ Not `run.world`: that is the level's
 * MEMOISED build, the same object after a death's restart in the same level,
 * and re-wrapped by a tile write mid-visit (G3's finding).
 */
export function skinView(run) {
    if (!run?.state) return null;
    const s = run.state;
    const damage = run.damage ?? {};
    const inventory = run.progress?.('inventory') ?? {};
    const slashInfo = run.progress?.('slashInfo') ?? null;
    const frozenTimer = run.progress?.('frozenTimer') ?? 0;
    const fall = s.fall?.phase === 'out'
        ? { kind: 'pit', alpha: s.fall.alpha, target: { ...s.fall.target } }
        : (s.fall?.phase === 'descent' ? { kind: 'ceiling', yStart: s.fall.yStart } : null);
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        x: s.x,
        y: s.y,
        vx: s.vx ?? 0,
        vy: s.vy ?? 0,
        direction: s.direction ?? INITIAL_DIRECTION,
        // `checkFallingInPit` parks the facing down for the whole fall (`Player.as:749`).
        directionFace: fall?.kind === 'pit' ? 3 : (damage.directionFace ?? -1),
        terrain: s.terrain ?? 0,
        hitsTimer: damage.hitsTimer ?? 0,
        frozenTimer: frozenTimer ?? 0,
        suit: inventory.hasDarkSuit ? 'dark' : 'blue',
        sword: inventory.hasGhostSword ? 'ghost' : (inventory.hasDarkSword ? 'dark' : 'plain'),
        slash: slashInfo?.state?.slashing
            ? { anim: slashInfo.state.anim ?? 'slash', endsAt: slashInfo.endsAt ?? null }
            : null,
        fall,
    };
}

/** `sprites()`'s choice (`Player.as:1665-1688`): the animation name for this tick. */
export function playerAnimName(view, swimStates = SWIM_STATES) {
    const prefix = swimStates.has(view.terrain) ? 'swim-' : '';
    const { vx, vy, directionFace: df } = view;
    let name = null;
    if ((vx !== 0 && df !== 1 && df !== 3) || df === 0 || df === 2) name = 'side-walk';
    else if ((vy < 0 && df !== 3) || df === 1) name = 'up-walk';
    else if (vy > 0 || df === 3) name = 'down-walk';
    if (vx === 0 && vy === 0) name = view.direction === 1 ? 'up-stand' : (view.direction === 3 ? 'down-stand' : 'side-stand');
    return name === null ? null : `${prefix}${name}`;
}

/** A fresh `Player`'s picture (`Player.as:388`: "down-stand", unmirrored, white). */
/** One visit or another: the adapter's `{run, key}`, or (a synthetic view) the same object. */
const sameEpoch = (a, b) => a === b || (!!a && !!b && a.run !== undefined && a.run === b.run && a.key === b.key);
const freshSkin = (epoch, tick) => ({
    epoch, born: tick, anim: 'down-stand', since: tick, mirrored: false, tint: null,
    slash: null, prevHits: 0, prevFrozen: 0,
});

/** The tint after this tick, in update order: `freezeStep` (:591-600), then `hitUpdate` (:1403-1426). */
function tintStep(skin, view) {
    let tint = skin.tint;
    if (view.frozenTimer > 0) tint = FROZEN_TINT;
    else if (skin.prevFrozen > 0) tint = null;
    const h = view.hitsTimer;
    if ((h > 0 && h < HITS_TIMER_MAX) || (h === 0 && skin.prevHits > 0)) {
        // `hitUpdate` tests BEFORE it decrements; a hit landing after it this tick (h still 20) toggles next tick.
        if ((h + 1) % HITS_TIMER_INT === 0) tint = tint === HIT_TINT ? null : HIT_TINT;
        if (h === 0) tint = null;
    }
    return tint;
}

/** `render()`'s mirror (:1149-1171). */
function mirror(prevMirrored, view) {
    if (view.directionFace >= 0) return view.direction === 2;
    if (view.vx < 0) return true;
    if (view.vx > 0) return false;
    return prevMirrored;
}

/** The ticks a Spritemap played at `since` has advanced after tick `tick` (see THE CLOCK). */
const played = (tick, since) => tick - since + 1;

/** The FlashPunk angle of the sword (`Player.as:1260-1276`) and its scale. */
function swordPose(sword, swing, index) {
    let angle = 90 * swing.direction;
    let scale = [1, 1];
    if (sword === 'ghost') {
        angle += 90 - 180 * index / (GHOST_SWEEP_FRAMES[swing.anim] - 1);
        if (swing.anim === 'slashnarrow') angle -= 45;
    } else if (swing.anim === 'slashnarrow') {
        scale = [1.5, 0.65];
    }
    return { angle, scale };
}

/**
 * The body's turn and alpha: the pit's ±8° and −0.05 a tick (:745-770), read
 * off the fall's own alpha; the descent's 10° a tick since the `Player` was
 * built (:505).
 */
function fallPose(view, tick, skin) {
    if (view.fall?.kind === 'pit') {
        const k = Math.round((FALL_ALPHA_START - view.fall.alpha) / FALL_ALPHA_SPEED);
        const sign = cosmeticRand(view.level, view.fall.target.x, view.fall.target.y, 344) < 0.5 ? -1 : 1;
        return { angle: PIT_SPIN * sign * k, alpha: Math.max(0, view.fall.alpha) };
    }
    if (view.fall?.kind === 'ceiling') return { angle: DESCENT_SPIN * played(tick, skin.born), alpha: 1 };
    return { angle: 0, alpha: 1 };
}

/**
 * EVERY FRAME RULE, by name, so a test can swap ONE for a mutant (`opts.rules`)
 * and watch the goldens go red — G1's `mask` hook, generalised.
 */
export const PLAYER_RULES = Object.freeze({ animName: playerAnimName, played, mirror, tintStep, swordPose, fallPose, swimStates: SWIM_STATES });

/**
 * One GAME tick of the picture's own state (call it after every `tick()`).
 * Pure: returns a new object; `prev` null starts a fresh `Player`.
 */
export function stepPlayerSkin(prev, view, tick, { rules = PLAYER_RULES } = {}) {
    if (!view) return prev;
    const R = rules === PLAYER_RULES ? rules : { ...PLAYER_RULES, ...rules };
    const skin = prev && sameEpoch(prev.epoch, view.epoch) ? { ...prev } : freshSkin(view.epoch, tick);
    skin.tint = R.tintStep(skin, view);
    skin.prevHits = view.hitsTimer;
    skin.prevFrozen = view.frozenTimer;
    // ── the body's animation: `sprites()` does not run during the descent ──
    if (view.fall?.kind !== 'ceiling') {
        const name = R.animName(view, R.swimStates);
        if (name !== null && name !== skin.anim) { skin.anim = name; skin.since = tick; }
    }
    skin.mirrored = R.mirror(skin.mirrored, view);
    // ── the swing: `play(…, true)` restarts it on every press, a dash included ──
    if (!view.slash) skin.slash = null;
    else if (!skin.slash || skin.slash.anim !== view.slash.anim || skin.slash.endsAt !== view.slash.endsAt) {
        skin.slash = { anim: view.slash.anim, endsAt: view.slash.endsAt, since: tick, direction: view.direction };
    }
    return skin;
}

/** The anim INDEX (not the frame) of `anim` after `ticks` updates — `Spritemap.update`'s count, looping. */
function animIndex(art, key, anim, ticks) {
    const a = art.resolve(key)?.sprite.anims?.[anim];
    if (!a) return 0;
    const raw = Math.floor(Math.max(0, ticks) * a.fps * FP_ELAPSED_PER_TICK);
    return a.loop === false ? Math.min(raw, a.frames.length - 1) : raw % a.frames.length;
}

function spriteOp(art, key, frame, at, { rot = 0, flipX = false, scaleX = 1, scaleY = 1, alpha = 1, tint = null, layer, fallback = null }) {
    const fr = art.frameRect(key, frame);
    if (!fr) return null;
    return {
        key, frame: fr.frame, sheetRef: fr.sheetRef, sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh,
        dx: at.x - fr.ox, dy: at.y - fr.oy, rot, flipX, flipY: false, layer, fallback,
        // FlashPunk turns and scales about the ORIGIN (`Image.as:109-116`), which is also the anchor here.
        pivotX: fr.ox, pivotY: fr.oy,
        ...(scaleX !== 1 || scaleY !== 1 ? { scaleX, scaleY } : {}),
        ...(alpha !== 1 ? { alpha } : {}),
        ...(tint ? { tint } : {}),
    };
}

/**
 * THE PLAYER'S DRAW OPS at game tick `tick`, given the skin state `skin`
 * (`stepPlayerSkin`'s, for this same tick). `[]` when the stack has no suit.
 * Each op carries the player's hitbox rectangle as its fallback, so an
 * undecoded sheet still shows today's white box.
 */
export function playerOps(view, art, { tick, skin, rules = PLAYER_RULES }) {
    if (!view || !art) return [];
    const R = rules === PLAYER_RULES ? rules : { ...PLAYER_RULES, ...rules };
    const suitKey = SUIT_KEYS[view.suit];
    if (!art.has(suitKey)) return [];
    const box = playerBoxAt(view.x, view.y);
    const layer = view.fall?.kind === 'ceiling' ? -view.fall.yStart : -box.bottom;
    const fallback = { rect: box, colour: PLAYER_COLOUR, alpha: 0.95, layer };
    const s = skin ?? freshSkin(view.epoch, tick);
    const at = { x: view.x, y: view.y };

    const pose = R.fallPose(view, tick, s);
    // FlashPunk turns COUNTER-clockwise (`FP.RAD` = π / −180, `FP.as:749`); an op's `rot` is the canvas's clockwise.
    const rot = pose.angle ? -pose.angle : 0;
    const alpha = pose.alpha;
    const frame = art.frameAt(suitKey, s.anim, R.played(tick, s.since)) ?? 0;
    const body = { rot, flipX: s.mirrored, alpha, tint: s.tint, layer, fallback };
    const ops = [];

    const swing = view.slash && s.slash ? s.slash : null;
    if (swing && swing.anim === 'slashnarrow') {
        for (let i = DASH_BLURS; i > 0; i -= 1) {
            ops.push(spriteOp(art, suitKey, frame, { x: view.x - i * view.vx, y: view.y - i * view.vy },
                { ...body, alpha: alpha * ((DASH_BLURS - i - 1) / DASH_BLURS + 0.5), fallback: null }));
        }
    }
    ops.push(spriteOp(art, suitKey, frame, at, body));

    const swordKey = SWORD_KEYS[view.sword];
    if (swing && art.has(swordKey)) {
        const ticks = R.played(tick, swing.since);
        const { angle, scale } = R.swordPose(view.sword, swing, animIndex(art, swordKey, swing.anim, ticks));
        const swordFrame = art.frameAt(swordKey, swing.anim, ticks) ?? 0;
        ops.push(spriteOp(art, swordKey, swordFrame, at, { rot: angle ? -angle : 0, scaleX: scale[0], scaleY: scale[1], layer }));
    }
    return ops.filter(Boolean);
}

/**
 * A player op as a golden line: the art key and frame, then `formatOp`'s draw
 * call with the destination rounded to 1/1000 px (the sim's positions are
 * fractional; the line pins the choice, not the float's last bit).
 */
export function formatPlayerOp(op, formatOp) {
    if (!op.sheetRef) return formatOp(op);
    const r = (n) => Math.round(n * 1000) / 1000;
    return `${op.key}#${op.frame} ${formatOp({ ...op, dx: r(op.dx), dy: r(op.dy) })}`;
}
