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

export const KEYS = Object.freeze({
    shieldBoss: 'seedling:boss/shieldboss',
    frozenBoss: 'seedling:boss/frozenboss',
    finalBoss: 'seedling:boss/finalboss',
});
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
    drawn: Object.freeze(['ShieldBoss', 'FrozenBoss', 'FinalBoss']),
});
/** What G10 does not draw yet, and why (the census's `remaining` rows say which classes). */
export const BOSS_PENDING = Object.freeze({
    ShieldBoss: 'HARDLIGHT is the canvas `hard-light` composite (an approximation of BlendMode.HARDLIGHT, as G9c\'s INVERT)',
    FinalBoss: 'its RockFall rocks and Grenades in flight (the run keeps them in the Owl\'s closure; a read is a new getter = a '
        + 'design check); BAND: the layer during the intro (AS3 sets it only past the freeze) and a Game.freezeObjects other than '
        + 'the intro (a dialogue), which the reducer does not see',
});
/** The placed tags whose build-time rectangle a boss's sprite replaces (`roomOps`' `drawnObjects`). */
export const BOSS_OBJECT_TAGS = new Set(['shieldboss', 'frozenboss', 'finalboss']);

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

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const BOSS_RULES = Object.freeze({
    bossTint, dieBlend: (anim) => (anim === 'die' ? 'hard-light' : null), owlWalked, owlUpdate, owlDeathFrame, worldFrame,
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
    return { epoch: view.epoch, gameTime: view.gameTime, bodies, rules: R };
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
    for (const f of view.frozenBosses) {
        push(KEYS.frozenBoss, 0, f, { x: f.x, y: f.y, w: FROZEN_SIZE, h: FROZEN_SIZE, right: f.x + FROZEN_SIZE, bottom: f.y + FROZEN_SIZE },
            { layer: -(f.y + FROZEN_LAYER_DY), nightCopy: true });
    }
    return ops.filter(Boolean);
}
