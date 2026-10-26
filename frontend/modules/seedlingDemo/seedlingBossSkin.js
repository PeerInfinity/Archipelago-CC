/**
 * seedlingDemo/seedlingBossSkin — **THE BOSSES, IN THE ORIGINAL GRAPHICS**
 * (Seedling JS graphics G10). G7's three pieces again (`seedlingPuzzleSkin.js`):
 *
 *   · `bossSkinView(run)` — THE ONE ADAPTER. It copies; it writes nothing. Every
 *     read is a getter the fights already expose for the solver (`shieldBosses`,
 *     …); G10 adds no `levelRun` getter.
 *   · `stepBossSkin(prev, view, tick)` — the renderer's own state, one GAME tick at
 *     a time (the hit tint, which `Enemy.hitUpdate` toggles in the body's update).
 *   · `bossOps(view, art, { skin })` — PURE. The draw ops, Y-sorted with the room.
 *
 * ── What AS3 does, transcribed (`vendor/seedling/src`) ─────────────────
 *
 *   · SHIELD BOSS (`Enemies/ShieldBoss.as`, L19) — a 56 × 80 Spritemap centred
 *     (`centerOO`) at the entity point (oel + (24, 32)); `layer = -(y − 40 + 80)`.
 *     The animation is the MODEL's (`shieldBossFight.js` steps the class's own
 *     Spritemap: "sit" [0], "moveShield" [0,1], "movedShield" [2], "stab" [3..8],
 *     "die" [9..19]), read back as `frame`. `render()`: nothing once `destroy`
 *     (so `Mobile.death`'s alpha fade is never seen), HARDLIGHT while "die".
 *     The hit tint: `Enemy.hitUpdate` (the default `hitsColor` 0xFF0000) runs
 *     inside `Enemy.update`, which `ShieldBoss.update` calls only while the
 *     animation is not "die" — so the reducer toggles only on a tick whose
 *     `hitsTimer` stepped down by one (the update ran), never on the kill.
 *   · FINAL BOSS, the Owl (`Enemies/FinalBoss.as`, L112) — a 16 × 16 Spritemap
 *     centred at oel + (8, 8); `layer = -(y − originY + height)` with the HITBOX's
 *     origin 6 and height 12. Its update, as far as it touches the picture: the
 *     intro freezes it (`!started`: frame 0, `play("")`); the lava hit RETURNS
 *     before the rest; `rockfallTime > 0` plays ""; the WALK branch (`v.length ≤
 *     moveSpeed`) plays "walk"; then `if (currentAnim == "") frame =
 *     sitFrames[worldFrame(4)]`; "walk"'s `endAnim` plays "". ⚠ The model does not
 *     age the walk (it has no consumer), so the reducer RE-DERIVES the branch from
 *     what the run carries: the walk branch is the one that leaves `|v| = 1`
 *     exactly (`to.normalize(moveSpeed)`), a lava return is a `hits` step, and
 *     `rockfallTime` is the run's. The death ("die" [4..11] → "dead" [11,11] →
 *     "deadframe" [11]) is the run's own anim and age. `death()` is empty: no
 *     fade, the corpse stays. The hit tint as the ShieldBoss's (`super.update()`
 *     runs every tick, `hitUpdate` while `!destroy`).
 *   · LAVA BOSS, the King of Fire (`Enemies/LavaBoss.as`, L82) — a 160 × 82
 *     Spritemap centred at oel + (48, 40); `layering()` is empty, so `layer =
 *     -(y − 41 + 82)` for ever. Its anim and index are the run's
 *     (`run.lavaBossFight`, game-witnessed at 0 px with its alpha). `render()`
 *     draws the MAIN buffer first, at the alpha and scale the previous render
 *     reset (1, 1); THEN it sets scale `1 + Rng.cos()·0.2 − 0.2` on "armsup" /
 *     "sweep" (cosmetic: `cosmeticRand`, a band), alpha 0.8 while alive, or —
 *     on "dead" — alpha −= 0.01 (the run's alpha IS that value), and draws the
 *     same onto `solidBmp` and `nightBmp`. So the main picture on "dead" is the
 *     PREVIOUS tick's alpha, and the copies this tick's. The tint as the others
 *     (`super.update()` only once attacking and alive); `startDeath` sets white.
 *     Its LavaBalls (`Projectiles/LavaBall.as`): 48 × 32 at scale 0.5, the pivot
 *     (32, 16) on the body, `angle = atan2(−vy, vx)`, "fly" at 10 fps from its
 *     spawn, and again onto nightBmp. Its LavaRunners are chasers (G3's).
 *   · FROZEN BOSS (`Scenery/FrozenBoss.as`, L111) — an Image at the placement
 *     (origin 0), `layer = -(y − originY + height·2/3)` with the hitbox's
 *     origin −128 and height 32; `render()` draws it again onto nightBmp.
 *
 * ⛔ The renderer only reads. `seedlingBossSkin.test.js` holds each tape's
 * stream, ledgers, stateLog and `stateDigest` identical with it on and off.
 * NOT YET: `BOSS_PENDING` (per class, why) and the census's `remaining` rows.
 */
import { ANIMS, ENEMY_HIT_TINT, freshSprite, hitTint, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { animIndex } from './seedlingMachineSkin.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';

export const KEYS = Object.freeze({
    shieldBoss: 'seedling:boss/shieldboss',
    frozenBoss: 'seedling:boss/frozenboss',
    finalBoss: 'seedling:boss/finalboss',
    lavaBoss: 'seedling:boss/lavaboss',
    lavaBall: 'seedling:boss/lavaball',
});
/** `LavaBoss.as:23-32` — each anim's frame list (the run carries the anim and its index). */
const LAVA_FRAMES = Object.freeze({
    sit: [0, 1, 2, 3, 4], smash: [5, 6, 7, 8, 9], smashback: [10, 11, 12, 6, 5], armsup: [6, 7, 13, 14, 14, 14, 14],
    sweep: [13, 15, 16], sweepback: [17, 16, 15, 6, 5], hit: [18, 19], hitplayer: [20], die: [21, 22, 23, 24, 25, 26, 27], dead: [27],
});
/** `LavaBoss.as:41` `setHitbox(64, 58, 32, 29)`; the frame's half height (`centerOO`) and height. */
const LAVA_BOX = Object.freeze({ w: 64, h: 58 });
const LAVA_OY = 41;
const LAVA_H = 82;
/** `LavaBall.as:21` `sc`; `:33` hitbox 24·sc (12, origin 6: `Mobile.layering` puts it at −(y + 6)). */
const LAVA_BALL_SCALE = 0.5;
/** `FinalBoss.as:27-28` `sitFrames`, `sitLoops`; `:24` `moveSpeed`. */
const OWL_SIT = Object.freeze([0, 1, 2, 3]);
const OWL_MOVE_SPEED = 1;
/** `FinalBoss.as:46` `setHitbox(12, 12, 6, 6)`: the stand-in, and the layer's origin and height. */
const OWL_BOX = 12;
const OWL_DEATH = new Set(['die', 'dead', 'deadframe']);
/** `ShieldBoss.as:15` Spritemap(56, 80), `centerOO`: the frame's height (the layer). */
const SHIELD_H = 80;
/** `ShieldBoss.as:45` `setHitbox(48, 48, 24, 24)`: the stand-in. */
const SHIELD_BOX = 48;
/** `FrozenBoss.as:18-20`: Image 160 × 160 at the placement; hitbox (80, 32, −32, −128). */
const FROZEN_SIZE = 160;
const FROZEN_LAYER_DY = 128 + (32 * 2) / 3;
const BOSS_COLOUR = '#e04848';

/** WHAT G10 DRAWS, by AS3 class. */
export const BOSS_COVERAGE = Object.freeze({
    drawn: Object.freeze(['ShieldBoss', 'FrozenBoss', 'FinalBoss', 'LavaBoss']),
});
/** What G10 does not draw yet, and why (the census's `remaining` rows say which classes). */
export const BOSS_PENDING = Object.freeze({
    ShieldBoss: 'HARDLIGHT is the canvas `hard-light` composite (an approximation of BlendMode.HARDLIGHT, as G9c\'s INVERT)',
    LavaBoss: 'BAND: the copies\' scale on "armsup"/"sweep" is `Rng.cos()` (cosmetic: `cosmeticRand`); a LavaBall\'s Explosion on '
        + 'impact (the run carries the ball\'s removal, not the blast); a ball\'s "fly" phase counts from the tick the view first sees it',
    FinalBoss: 'its RockFall rocks and Grenades in flight (the run keeps them in the Owl\'s closure; a read is a new getter = a '
        + 'design check); BAND: the layer during the intro (AS3 sets it only past the freeze) and a Game.freezeObjects other than '
        + 'the intro (a dialogue), which the reducer does not see',
});
/** The placed tags whose build-time rectangle a boss's sprite replaces (`roomOps`' `drawnObjects`). */
export const BOSS_OBJECT_TAGS = new Set(['shieldboss', 'frozenboss', 'finalboss', 'lavaboss']);

// ── the adapter ─────────────────────────────────────────────────────────

const read = (run, name, fallback) => (name in run ? run[name] ?? fallback : fallback);

/** THE ADAPTER. Everything these pictures read, as plain objects (null when there is no run). */
export function bossSkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    const objects = world?.objectSolids ?? [];
    return {
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        shieldBosses: (read(run, 'shieldBosses', []) ?? []).map((b) => ({
            id: b.id, x: b.x, y: b.y, anim: b.anim, frame: b.frame, hitsTimer: b.hitsTimer ?? 0,
            destroy: !!b.destroy, removed: !!b.removed,
        })),
        finalBosses: (read(run, 'finalBosses', []) ?? []).map((b) => ({
            id: b.id, x: b.x, y: b.y, vx: b.vx ?? 0, vy: b.vy ?? 0, started: !!b.started, rockfallTime: b.rockfallTime ?? -1,
            hits: b.hits ?? 0, hitsTimer: b.hitsTimer ?? 0, destroy: !!b.destroy, anim: b.anim ?? '', animAge: b.animAge ?? null,
        })),
        lavaBosses: (() => {
            const f = read(run, 'lavaBossFight', null);
            if (!f?.boss) return [];
            const b = f.boss;
            return [{ id: f.id ?? 'lavaboss', x: b.x, y: b.y, anim: b.anim, index: b.index ?? 0, hitsTimer: b.hitsTimer ?? 0,
                startAttacking: !!b.startAttacking, destroy: !!b.destroy, alpha: b.alpha ?? 1, removed: !!b.removed,
                balls: (f.balls ?? []).map((s) => ({ id: s.id, x: s.x, y: s.y, vx: s.vx, vy: s.vy })) }];
        })(),
        frozenBosses: objects.filter((o) => o.tag === 'frozenboss').map((o) => ({ id: `frozenboss@${o.x},${o.y}`, x: o.x, y: o.y })),
    };
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/**
 * `Enemy.hitUpdate` (Enemy.as:223-245) for a boss whose update the model ran: it
 * ran this tick iff `hitsTimer` stepped from `h` to `h − 1` (a hit sets it to 30
 * AFTER the update, in the player's; the "die" path and an off-camera body skip it).
 */
function bossTint(st, h, now) {
    return h > 0 && now === h - 1 ? hitTint(st.tint, h, ENEMY_HIT_TINT) : st.tint;
}

/** `FinalBoss.update`'s walk branch ran iff it left `v` at `moveSpeed` exactly (`to.normalize(moveSpeed)`). */
const owlWalked = (b) => Math.abs(Math.hypot(b.vx, b.vy) - OWL_MOVE_SPEED) < 1e-9;

/**
 * ONE `FinalBoss.update()` + its graphic's, as far as they touch the picture (`FinalBoss.as:83-150`), from `prev`
 * (the body at the top of the update) to `b` (after it). `time` is `Game.time` at the update.
 */
function owlUpdate(sp, prev, b, time, R) {
    const ran = b.started && !(prev?.destroy);
    const lavaReturn = !!prev && b.hits > prev.hits;
    if (ran && !lavaReturn && !b.destroy) {
        const rf = prev ? prev.rockfallTime : -1;
        if (rf > 0) play(sp, ANIMS[KEYS.finalBoss], '');
        else if (rf < 0 && R.owlWalked(b)) play(sp, ANIMS[KEYS.finalBoss], 'walk');
        if (sp.anim === '') sp.frame = OWL_SIT[R.worldFrame(time, OWL_SIT.length, 1)];
    }
    updateSprite(sp, ANIMS[KEYS.finalBoss], () => { if (sp.anim === 'walk') play(sp, ANIMS[KEYS.finalBoss], ''); });
}

/** The Owl's death frame from the run's own anim and its age in graphic updates. */
function owlDeathFrame(b) {
    const a = ANIMS[KEYS.finalBoss][b.anim];
    if (!a || b.animAge === null) return a ? a.frames.at(-1) : 11;
    return a.frames[animIndex(a.fps, b.animAge, a.frames.length)];
}

/** `LavaBoss.render`: the copies' scale on "armsup"/"sweep" (`1 + Rng.cos()·n − n`, n 0.2): cosmetic, keyed by the tick. */
const lavaScale = (anim, level, tick) => (anim === 'armsup' || anim === 'sweep' ? 1 + cosmeticRand(level, tick, 82, 10) * 0.2 - 0.2 : 1);

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const BOSS_RULES = Object.freeze({
    bossTint, dieBlend: (anim) => (anim === 'die' ? 'hard-light' : null), owlWalked, owlUpdate, owlDeathFrame, worldFrame,
    lavaFrame: (b) => (LAVA_FRAMES[b.anim] ?? LAVA_FRAMES.sit)[b.index] ?? 0,
    lavaCopyAlpha: (b) => (b.destroy ? b.alpha : 0.8),
    lavaScale,
    ballAngle: (s) => (s.vx !== 0 || s.vy !== 0 ? (Math.atan2(-s.vy, s.vx) * 180) / Math.PI : 0),
});

/** One GAME tick of these pictures (call it after every `tick()`). Pure: returns a new object. */
export function stepBossSkin(prev, view, tick, { rules = BOSS_RULES } = {}) {
    if (!view) return prev;
    const R = rules === BOSS_RULES ? rules : { ...BOSS_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    const bodies = new Map();
    for (const b of view.shieldBosses) {
        const old = same ? prev.bodies.get(b.id) : null;
        const st = old ? { ...old } : { tint: null, prevHits: b.hitsTimer };
        st.tint = R.bossTint(st, st.prevHits, b.hitsTimer);
        st.prevHits = b.hitsTimer;
        bodies.set(b.id, st);
    }
    // What the Owl SAW this tick: the clock at the top of the frame (the enemy skin's convention).
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    for (const b of view.finalBosses) {
        const old = same ? prev.bodies.get(b.id) : null;
        const st = old ? { ...old, sprite: { ...old.sprite } } : { tint: null, prevHits: b.hitsTimer, sprite: freshSprite(), body: null };
        st.tint = R.bossTint(st, st.prevHits, b.hitsTimer);
        st.prevHits = b.hitsTimer;
        R.owlUpdate(st.sprite, old ? st.body : null, b, time, R);
        st.body = b;
        bodies.set(b.id, st);
    }
    for (const b of view.lavaBosses) {
        const old = same ? prev.bodies.get(b.id) : null;
        const st = old ? { ...old } : { tint: null, prevHits: b.hitsTimer, prevAlpha: b.alpha };
        st.tint = b.destroy ? null : R.bossTint(st, st.prevHits, b.hitsTimer);
        st.prevHits = b.hitsTimer;
        // the main buffer's alpha this tick: what the previous render left (`LavaBoss.render` decrements AFTER drawing it)
        st.mainAlpha = b.destroy && b.anim === 'dead' ? (old ? old.prevAlpha : b.alpha) : 1;
        st.prevAlpha = b.alpha;
        for (const s of b.balls) {
            const o = same ? prev.bodies.get(`ball:${s.id}`) : null;
            const sp = o ? { ...o } : { ...freshSprite() };
            // added in the boss's `endAnim`, it joins the world at `updateLists` and is RENDERED before its first update
            if (!o) play(sp, ANIMS[KEYS.lavaBall], 'fly');
            else updateSprite(sp, ANIMS[KEYS.lavaBall], () => {});
            bodies.set(`ball:${s.id}`, sp);
        }
        bodies.set(b.id, st);
    }
    return { epoch: view.epoch, gameTime: view.gameTime, tick, bodies, rules: R };
}

// ── the ops ─────────────────────────────────────────────────────────────

const boxAround = (x, y, w, h) => ({ x: x - w / 2, y: y - h / 2, w, h, right: x + w / 2, bottom: y + h / 2 });

/** THE DRAW OPS at the tick `skin` was stepped to; a body whose key the stack lacks is its rectangle. */
export function bossOps(view, art, { skin } = {}) {
    if (!view || !art || !skin) return [];
    const R = skin.rules ?? BOSS_RULES;
    const ops = [];
    const push = (key, frame, at, box, extra) => {
        const fallback = rectOp(box, BOSS_COLOUR, 0.85, extra.layer);
        if (!art.has(key)) { ops.push(fallback); return; }
        const op = spriteOp(art, key, frame, at, { ...extra, fallback });
        if (op && extra.blend) op.blend = extra.blend;
        if (op && extra.nightCopy) op.nightCopy = true;
        ops.push(op);
    };
    for (const b of view.shieldBosses) {
        // `ShieldBoss.render`: `if (destroy) return;` — the corpse's alpha fade is never drawn
        if (b.destroy || b.removed) continue;
        const st = skin.bodies.get(b.id);
        push(KEYS.shieldBoss, b.frame, b, boxAround(b.x, b.y, SHIELD_BOX, SHIELD_BOX), {
            layer: -(b.y - SHIELD_H / 2 + SHIELD_H), tint: st?.tint ?? null, blend: R.dieBlend(b.anim),
        });
    }
    for (const b of view.finalBosses) {
        const st = skin.bodies.get(b.id);
        const frame = OWL_DEATH.has(b.anim) ? R.owlDeathFrame(b) : (st?.sprite.frame ?? 0);
        push(KEYS.finalBoss, frame, b, boxAround(b.x, b.y, OWL_BOX, OWL_BOX), { layer: -(b.y - OWL_BOX / 2 + OWL_BOX), tint: st?.tint ?? null });
    }
    for (const b of view.lavaBosses) {
        if (b.removed) continue;
        const st = skin.bodies.get(b.id);
        const box = { x: b.x - LAVA_BOX.w / 2, y: b.y - LAVA_BOX.h / 2, w: LAVA_BOX.w, h: LAVA_BOX.h, right: b.x + LAVA_BOX.w / 2, bottom: b.y + LAVA_BOX.h / 2 };
        const layer = -(b.y - LAVA_OY + LAVA_H);
        const tint = st?.tint ?? null;
        push(KEYS.lavaBoss, R.lavaFrame(b), b, box, { layer, tint, alpha: st?.mainAlpha ?? 1 });
        const op = ops.at(-1);
        if (op?.sheetRef) {
            const sc = R.lavaScale(b.anim, view.level, skin.tick ?? 0);
            const copy = spriteOp(art, KEYS.lavaBoss, R.lavaFrame(b), b, { layer, tint, alpha: R.lavaCopyAlpha(b),
                ...(sc !== 1 ? { scaleX: sc, scaleY: sc } : {}) });
            op.nightExtra = [copy];
            op.solidExtra = [copy];
        }
        for (const s of b.balls) {
            const sp = skin.bodies.get(`ball:${s.id}`);
            push(KEYS.lavaBall, sp?.frame ?? 0, s, boxAround(s.x, s.y, 12, 12), { layer: -(s.y + 6), rot: R.ballAngle(s),
                scaleX: LAVA_BALL_SCALE, scaleY: LAVA_BALL_SCALE, nightCopy: true });
        }
    }
    for (const f of view.frozenBosses) {
        push(KEYS.frozenBoss, 0, f, { x: f.x, y: f.y, w: FROZEN_SIZE, h: FROZEN_SIZE, right: f.x + FROZEN_SIZE, bottom: f.y + FROZEN_SIZE },
            { layer: -(f.y + FROZEN_LAYER_DY), nightCopy: true });
    }
    return ops.filter(Boolean);
}
