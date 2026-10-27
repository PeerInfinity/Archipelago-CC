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
 *   · TENTACLE BEAST (`Enemies/TentacleBeast.as`, L57) — a 46 × 44 Spritemap
 *     centred at oel + (24, 24), `layer = -(y − 22 + 46)`. "under" [12] until it
 *     wakes, "rise" (12 frames at 8 fps), then "" — the sitting frames
 *     `[0,1,2,1][worldFrame(4)]` set in its update — and, once its tentacles are
 *     spent, "dying" (2 fps) and the dead sitting frames `[17,18,19,18]
 *     [worldFrame(4, 2)]`. The run carries the anim's NAME (`tentacleBeastFight`);
 *     its index is counted here from the tick the name appears (an anim the view
 *     saw start: exact; a stack switched on mid-anim: from then — a band).
 *     Its Tentacles (`Enemies/Tentacle.as`): 80 × 49 on the pivot (8, 47),
 *     mirrored when not `right`, `layer = -(y − 2 + 4)`; anim, index and alpha
 *     (the cut's fade) are the run's; the tint as the others (`hitUpdate()` every
 *     update). Its timed Whirlpools (`Whirlpool(…, true)`): grow over 150, live
 *     60, die over 30 — scale and alpha from the run's `timer` — the frame
 *     `whirlFrames[worldFrame(16)]` and 20° more each render from a cosmetic
 *     start (G9b's rule).
 *   · THE LIGHTS (`Enemies/LightBossController.as`, L69; no body of its own) —
 *     everything from `run.lightsFight`. Its six LightBoss fliers
 *     (`Enemies/LightBoss.as`): 17 × 16 centred (FlashPunk's int origin, 8),
 *     turned to `angleFace` (the run's), "sit" [0], then "die" [1..9] at 20 fps
 *     and scale 1.1 (the run's `dieAnim`); removed at its end. Their tint is
 *     `Enemy.hitUpdate`'s toggle between red and a NORMAL colour the flier
 *     darkens itself (`normalColor = 0xFFFFFF · (1 − hits/3)`, set at the END of
 *     its update, so a toggle reads the previous update's): transcribed in the
 *     reducer. Their shots (`Projectiles/LightBossShot.as`): 8 × 8 centred,
 *     10° more each update from 0 (the ctor's angle went to TurretSpit's own
 *     sprite), copied onto nightBmp at 0.1 (`TurretSpit.render`). The
 *     LightBossTotem (`Scenery/LightBossTotem.as`): an Image at the controller's
 *     point on the pivot (0, 8), `layer = -(y + 8)`, copied onto nightBmp at 0.5;
 *     once `die` (the run's `totemDie`), each render scales it (x · 0.9, y + 0.1),
 *     reddens it (`colorLerp(white, red, min(1, scaleY/2))`) and lifts it 10 px.
 *   · THE OWL'S ROCKS (`Scenery/RockFall.as`, G11) — `run.owlProjectilesNow` (⚖ fidelity-15
 *     2026-10-27): the drawable set (the pending spawns join at the next frame's
 *     `updateLists`, so a rock is first drawn after its first update). A 64 × 32
 *     Spritemap centred, at the rock's `scale`; `layer = -goto`. `render()`: two
 *     `Draw.rect` shadows at `goto` (int args, black 0.5) under the sprite, then —
 *     unless `Game.freezeObjects` — on "break" alpha 1 and angle 0, else angle +=
 *     `angleRate` and alpha `min(1, 1 − (goto − y) / 96)`. The break frames are the
 *     run's anim and age (15 fps). A frozen frame is one the rock did not move (the
 *     model steps it only unfrozen), so the angle counts the ticks it fell.
 *     BAND (cosmetic, ⚖ fidelity-15: FlashPunk's `FP.choose`, never modelled): the
 *     sign of `angleRate` (±5) and of `scaleX` (the mirror), `cosmeticRand` by id.
 *   · THE OWL'S GRENADES (`Enemies/Grenade.as`, `new Grenade(…, true, 30)`) — the
 *     same getter: 16 × 16 centred, `layer = -(y + 3)`, alpha 1 (`_active` puts it
 *     at `endY`), "sit"/"explode"/"hit" from the run's anim and age, copied onto
 *     nightBmp at half (G5's `grenade` rule); its Light while "hit" as G5's
 *     placed grenade (`bossNightOps`).
 *   · THE LIGHTS' LIGHTS (G11, `bossNightOps`; nightBmp only, G5's `lightCircles`):
 *     each living flier's `Light(x, y, 100, 1, yellow, smooth)` (28–32, 0.2), moved
 *     by its update to 4 px along `angleFace` and coloured `colorLerp(yellow,
 *     green, hits / 3)` with the hits that update saw; removed at `startDeath`.
 *     Each dying totem render k adds a Light that is never removed: (x + 8, y_k +
 *     8), 6–10, alpha y_k / FP.height (160), y_k = y − 10(k − 1) — drawn from the
 *     NEXT frame (`FP.world.add` queues), and nothing once y_k ≤ 0.
 *   · FROZEN BOSS (`Scenery/FrozenBoss.as`, L111) — an Image at the placement
 *     (origin 0), `layer = -(y − originY + height·2/3)` with the hitbox's
 *     origin −128 and height 32; `render()` draws it again onto nightBmp.
 *
 * ⛔ The renderer only reads. `seedlingBossSkin.test.js` holds each tape's
 * stream, ledgers, stateLog and `stateDigest` identical with it on and off.
 * NOT YET: `BOSS_PENDING` (per class, why) and the census's `remaining` rows.
 */
import { ANIMS, ENEMY_HIT_TINT, freshSprite, hashId, hitTint, play, rectOp, spriteOp, updateSprite, worldFrame } from './seedlingEnemySkin.js';
import { animIndex } from './seedlingMachineSkin.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { colorLerp, lightCircles, lightLayer } from './seedlingNightSkin.js';

export const KEYS = Object.freeze({
    shieldBoss: 'seedling:boss/shieldboss',
    frozenBoss: 'seedling:boss/frozenboss',
    finalBoss: 'seedling:boss/finalboss',
    lavaBoss: 'seedling:boss/lavaboss',
    lavaBall: 'seedling:boss/lavaball',
    tentacleBeast: 'seedling:boss/tentaclebeast',
    tentacle: 'seedling:boss/tentacle',
    whirlpool: 'seedling:machine/whirlpool',
    lightBoss: 'seedling:boss/lightboss',
    lightShot: 'seedling:boss/lightbossshot',
    lightTotem: 'seedling:boss/lightbosstotem',
    rockFall: 'seedling:boss/rockfall',
    owlGrenade: 'seedling:enemy/grenade',
});
/** `RockFall.as:17-21` `fallHeight`, `angleRate`. */
const ROCK_FALL_HEIGHT = 96;
const ROCK_ANGLE_RATE = 5;
const SHADOW = '#000000';
/** `LightBoss.as:19, 49, 78`: `lightLength`, the flier's Light, its colour ramp; `LightBossTotem.as:33` the totem's. */
const FLIER_LIGHT = Object.freeze({ length: 4, frames: 100, loops: 1, smooth: true, rmin: 28, rmax: 32, alpha: 0.2 });
const TOTEM_LIGHT = Object.freeze({ frames: 100, loops: 1, smooth: true, rmin: 6, rmax: 10 });
const YELLOW = '#ffff00';
const GREEN = '#00ff00';
/** `Main.as:36` `super(160, 160, …)`: `FP.height`, the totem lights' alpha divisor. */
const FP_HEIGHT = 160;
/** `LightBoss.as:39` "die" frames, `:76` the death scale; `LightBossShot.as:15` `angleSpinRate`. */
const LIGHT_DIE = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const LIGHT_DIE_SCALE = 1.1;
const LIGHT_SHOT_SPIN = 10;
const LIGHT_HITS_MAX = 3;
/** `TentacleBeast.as:20-21, 40-43`: frames and fps (`[]` → its update's own frame). */
const BEAST_ANIMS = Object.freeze({
    sink: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fps: 8 }, rise: { frames: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0], fps: 8 },
    under: { frames: [12], fps: 0 }, dying: { frames: [13, 14, 15, 16], fps: 2 },
});
const BEAST_SIT = Object.freeze([0, 1, 2, 1]);
const BEAST_SIT_DEAD = Object.freeze([17, 18, 19, 18]);
/** `Tentacle.as:32-37`. */
const TENTACLE_FRAMES = Object.freeze({
    rise: [0, 1, 2, 3, 4], sit: [5, 6, 5, 6, 5, 6], hit: [7, 8, 9, 10, 11], hitting: [12], sink: [13, 14, 15, 16], cut: [17, 18, 19, 20],
});
/** `Whirlpool.as:15-25`: `whirlFrames`, `spinRate`, `maxAlpha`, the three timer spans. */
const WHIRL = Object.freeze({ frames: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1], spin: 20, alpha: 0.5, grow: 150, live: 60, dies: 30 });
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
    drawn: Object.freeze(['ShieldBoss', 'FrozenBoss', 'FinalBoss', 'LavaBoss', 'TentacleBeast', 'LightBossController', 'RockFall',
        'Grenade (the Owl\'s)', 'Light (the fliers\' and the dying totem\'s)']),
});
/** What G10 does not draw yet, and why (the census's `remaining` rows say which classes). */
export const BOSS_PENDING = Object.freeze({
    ShieldBoss: 'HARDLIGHT is the canvas `hard-light` composite (an approximation of BlendMode.HARDLIGHT, as G9c\'s INVERT)',
    LavaBoss: 'BAND: the copies\' scale on "armsup"/"sweep" is `Rng.cos()` (cosmetic: `cosmeticRand`); a LavaBall\'s Explosion on '
        + 'impact (the run carries the ball\'s removal, not the blast); a ball\'s "fly" phase counts from the tick the view first sees it',
    TentacleBeast: 'BAND: the beast\'s anim index is counted from the tick the view first shows the anim (the run carries its name); '
        + 'a timed whirlpool\'s start angle is `Rng.cos()` (cosmetic); a Tentacle\'s cut `dieEffects` (G4\'s effects, not drawn here)',
    LightBossController: 'BAND: a flier\'s tint whose hit landed while it was frozen; a flier\'s Light before its first update '
        + '(drawn at the body) and through a freeze (the Light keeps its last place; the view moves it with the body)',
    FinalBoss: 'BAND: the layer during the intro (AS3 sets it only past the freeze) and a Game.freezeObjects other than '
        + 'the intro (a dialogue), which the reducer does not see',
    RockFall: 'BAND (cosmetic, ⚖ fidelity-15 2026-10-27 — FlashPunk\'s `FP.choose`, never modelled): the sign of `angleRate` and of '
        + '`scaleX`, `cosmeticRand` by the rock\'s id',
    Grenade: 'its Light as G5\'s placed grenade: from the tick "hit" plays, alpha 1 − index / 2 (the game adds it at `animEnd`)',
});
/** The placed tags whose build-time rectangle a boss's sprite replaces (`roomOps`' `drawnObjects`). */
export const BOSS_OBJECT_TAGS = new Set(['shieldboss', 'frozenboss', 'finalboss', 'lavaboss', 'tentaclebeast']);

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
        tentacleBeasts: (() => {
            const f = read(run, 'tentacleBeastFight', null);
            if (!f?.beast) return [];
            const b = f.beast;
            return [{ id: f.id ?? 'tentaclebeast', x: b.x, y: b.y, anim: b.anim ?? '', activated: !!b.activated, dead: !!b.dead,
                tentacles: (f.tentacles ?? []).map((t) => ({ id: t.id, x: t.x, y: t.y, right: !!t.right, anim: t.anim, index: t.index ?? 0,
                    destroy: !!t.destroy, alpha: t.alpha ?? 1, hitsTimer: t.hitsTimer ?? 0 })),
                whirlpools: (f.whirlpools ?? []).map((w) => ({ id: w.id, x: w.x, y: w.y, timer: w.timer })) }];
        })(),
        lights: (read(run, 'lightsFight', []) ?? []).map((f) => ({
            id: f.id, x: f.x, y: f.y, totemDie: !!f.totemDie,
            fliers: (f.bodies ?? []).filter((b) => !b.removed).map((b) => ({ id: b.id, x: b.x, y: b.y, hits: b.hits ?? 0,
                hitsTimer: b.hitsTimer ?? 0, angleFace: b.angleFace ?? null, dying: !!b.dieAnim, dieIndex: b.dieAnim?.index ?? 0 })),
            shots: (f.shots ?? []).filter((x) => !x.removed).map((x) => ({ id: x.id, x: x.x, y: x.y })),
        })),
        ...(() => {
            // ⛓ G11 (⚖ fidelity-15): the drawable rocks and grenades, copies of copies
            const p = read(run, 'owlProjectilesNow', null);
            return {
                owlRocks: (p?.rocks ?? []).map((r) => ({ id: r.id, x: r.x, y: r.y, goto: r.goto, scale: r.scale, width: r.width,
                    height: r.height, originX: r.originX, originY: r.originY, landed: !!r.landed, anim: r.anim ?? null, animAge: r.animAge ?? null })),
                owlGrenades: (p?.grenades ?? []).map((g) => ({ id: g.id, x: g.x, y: g.y, anim: g.anim ?? null, animAge: g.animAge ?? null })),
            };
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
    beastFrame,
    flierTint,
    totemLook,
    tentacleFrame: (t) => (TENTACLE_FRAMES[t.anim] ?? TENTACLE_FRAMES.sit)[t.index] ?? 0,
    whirlLook,
    rockLook,
    rockShadows,
    replayFrame,
    flierLight,
    totemLights,
});

/** A Spritemap's frame after `play(anim)` and `age` graphic updates (the run carries both). */
function replayFrame(key, anim, age) {
    const sp = freshSprite();
    play(sp, ANIMS[key], anim);
    for (let k = 0; k < (age ?? 0); k += 1) updateSprite(sp, ANIMS[key], () => {});
    return sp;
}

/** `RockFall.render`'s pose after `falls` unfrozen renders while falling (`sign` the cosmetic `FP.choose`). */
function rockLook(r, falls, sign) {
    if (r.anim === 'break') return { alpha: 1, angle: 0 };
    return { alpha: Math.min(1, 1 - (r.goto - r.y) / ROCK_FALL_HEIGHT), angle: sign * ROCK_ANGLE_RATE * falls };
}

/** `RockFall.render`'s two `Draw.rect` shadows (int arguments, toward zero). */
function rockShadows(r) {
    const m = 4;
    const t = Math.trunc;
    const rect = (x, y, w, h) => ({ x: t(x), y: t(y), w: t(w), h: t(h), right: t(x) + t(w), bottom: t(y) + t(h) });
    return [
        rect(r.x - r.originX + m, r.goto - 1 - m / 2 + (r.height * 2) / 3, r.width - m * 2, r.height / 2 + m),
        rect(r.x - r.originX, r.goto - 1 + (r.height * 2) / 3, r.width, r.height / 2),
    ];
}

/** `LightBoss.update`'s Light: 4 px along `angleFace`, `colorLerp(yellow, green, hits / 3)` (null before its first update). */
function flierLight(b, hits) {
    // before its first update `angleFace` is AS3's Number default, NaN (the run says so); the Light is where the ctor put it
    if (!Number.isFinite(b.angleFace)) return { ...FLIER_LIGHT, x: b.x, y: b.y, colour: YELLOW };
    return { ...FLIER_LIGHT, x: b.x + FLIER_LIGHT.length * Math.cos(b.angleFace), y: b.y + FLIER_LIGHT.length * Math.sin(b.angleFace),
        colour: colorLerp(YELLOW, GREEN, hits / LIGHT_HITS_MAX) };
}

/** The Lights the dying totem's renders 1..k−1 added (render k's joins next frame); those with alpha ≤ 0 draw nothing. */
function totemLights(f, k) {
    const out = [];
    for (let i = 1; i < k; i += 1) {
        const y = f.y - 10 * (i - 1);
        const alpha = y / FP_HEIGHT;
        if (alpha <= 0) break;
        out.push({ ...TOTEM_LIGHT, x: f.x + 8, y: y + 8, colour: YELLOW, alpha });
    }
    return out;
}

/** `TentacleBeast.update` + its graphic: the run's anim name, aged here; "" = the (dead) sitting frames at `time`. */
function beastFrame(st, b, time) {
    if (b.anim === '') return (b.dead ? BEAST_SIT_DEAD[worldFrame(time, 4, 2)] : BEAST_SIT[worldFrame(time, 4)]);
    const a = BEAST_ANIMS[b.anim];
    if (!a) return 0;
    return a.frames[a.fps > 0 ? animIndex(a.fps, st.age, a.frames.length) : 0];
}

/** `normalColor = 0xFFFFFF · (1 − hits/hitsMax)` as a uint (`LightBoss.as:63`); white is no tint. */
const flierNormal = (hits) => {
    const c = Math.trunc(0xFFFFFF * (1 - hits / LIGHT_HITS_MAX)) >>> 0;
    return c === 0xFFFFFF ? null : `#${c.toString(16).padStart(6, '0')}`;
};

/**
 * `Enemy.hitUpdate` with the flier's own NORMAL colour (`Enemy.as:223-245`): `h` the timer at the top of the update,
 * `normal` the colour its previous update left. Returns the image's colour after it (null = white).
 */
function flierTint(colour, h, now, normal) {
    if (!(h > 0 && now === h - 1)) return colour;
    let c = colour;
    if (h % 10 === 0) c = c === normal ? ENEMY_HIT_TINT : normal;
    if (h - 1 <= 0) c = normal;
    return c;
}

/** `LightBossTotem.render` after `k` dying renders: scale, tint (`colorLerp(white, red, min(1, scaleY / 2))`) and lift. */
function totemLook(k) {
    if (k <= 0) return { scaleX: 1, scaleY: 1, tint: null, dy: 0 };
    const scaleY = 1 + 0.1 * k;
    const t = Math.min(1, scaleY / 2);
    const g = Math.trunc(255 - 255 * t).toString(16).padStart(2, '0'); // `uint +=` truncates
    return { scaleX: 0.9 ** k, scaleY, tint: `#ff${g}${g}`, dy: -10 * k };
}

/** `Whirlpool.update`: scale and alpha from the timer after it (grow, live, die). */
function whirlLook(timer) {
    if (timer >= WHIRL.live + WHIRL.dies) {
        const k = 1 - (timer - WHIRL.live - WHIRL.dies) / WHIRL.grow;
        return { scale: k, alpha: WHIRL.alpha * k };
    }
    if (timer >= WHIRL.dies) return { scale: 1, alpha: WHIRL.alpha };
    return { scale: timer / WHIRL.dies, alpha: (WHIRL.alpha * timer) / WHIRL.dies };
}

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
    for (const r of view.owlRocks) {
        const o = same ? prev.bodies.get(`rock:${r.id}`) : null;
        // a render while falling and unfrozen turns it: the model moves a falling rock only unfrozen
        const fell = !r.landed && (!o || r.y !== o.y);
        bodies.set(`rock:${r.id}`, { y: r.y, falls: (o?.falls ?? 0) + (fell ? 1 : 0),
            sprite: r.anim === 'break' ? R.replayFrame(KEYS.rockFall, 'break', r.animAge) : null });
    }
    for (const g of view.owlGrenades) {
        bodies.set(`grenade:${g.id}`, { anim: g.anim, sprite: R.replayFrame(KEYS.owlGrenade, g.anim, g.animAge) });
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
    for (const b of view.tentacleBeasts) {
        const old = same ? prev.bodies.get(b.id) : null;
        // the anim's age in graphic updates: 1 on the tick it is played (the update plays it, then the graphic steps)
        const st = { anim: b.anim, age: old && old.anim === b.anim ? old.age + 1 : 1 };
        st.frame = R.beastFrame(st, b, time);
        bodies.set(b.id, st);
        for (const t of b.tentacles) {
            const o = same ? prev.bodies.get(`tentacle:${t.id}`) : null;
            const ts = o ? { ...o } : { tint: null, prevHits: t.hitsTimer };
            ts.tint = R.bossTint(ts, ts.prevHits, t.hitsTimer);
            ts.prevHits = t.hitsTimer;
            bodies.set(`tentacle:${t.id}`, ts);
        }
        for (const w of b.whirlpools) {
            const o = same ? prev.bodies.get(`whirl:${w.id}`) : null;
            bodies.set(`whirl:${w.id}`, { renders: (o?.renders ?? 0) + 1 });
        }
    }
    for (const f of view.lights) {
        for (const b of f.fliers) {
            const o = same ? prev.bodies.get(`flier:${b.id}`) : null;
            const st = o ? { ...o } : { colour: null, normal: null, prevHits: b.hitsTimer, hitsAtUpdate: b.hits };
            st.colour = R.flierTint(st.colour, st.prevHits, b.hitsTimer, st.normal);
            // the END of its update: the colour from the hits it had then (a sword lands later, in the player's update)
            st.normal = flierNormal(st.hitsAtUpdate);
            st.lightHits = st.hitsAtUpdate;
            st.prevHits = b.hitsTimer;
            st.hitsAtUpdate = b.hits;
            bodies.set(`flier:${b.id}`, st);
        }
        for (const x of f.shots) {
            const o = same ? prev.bodies.get(`shot:${x.id}`) : null;
            bodies.set(`shot:${x.id}`, { updates: o ? o.updates + 1 : 0 });
        }
        const o = same ? prev.bodies.get(`totem:${f.id}`) : null;
        bodies.set(`totem:${f.id}`, { dyingRenders: f.totemDie ? (o?.dyingRenders ?? 0) + 1 : 0 });
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
    for (const r of view.owlRocks) {
        const st = skin.bodies.get(`rock:${r.id}`);
        const layer = -r.goto;
        for (const rect of R.rockShadows(r)) ops.push(rectOp(rect, SHADOW, 0.5, layer));
        const sign = cosmeticRand(view.level, hashId(r.id), 0, 113) < 0.5 ? 1 : -1;
        const mirror = cosmeticRand(view.level, hashId(r.id), 1, 113) < 0.5;
        const look = R.rockLook(r, st?.falls ?? 0, sign);
        const box = { x: r.x - r.originX, y: r.y - r.originY, w: r.width, h: r.height, right: r.x - r.originX + r.width, bottom: r.y - r.originY + r.height };
        push(KEYS.rockFall, st?.sprite?.frame ?? 0, r, box, { layer, alpha: look.alpha, rot: -look.angle, flipX: mirror, scaleX: r.scale, scaleY: r.scale });
    }
    for (const g of view.owlGrenades) {
        const st = skin.bodies.get(`grenade:${g.id}`);
        push(KEYS.owlGrenade, st?.sprite.frame ?? 0, g, boxAround(g.x, g.y, 6, 6), { layer: -(g.y + 3) });
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
    for (const b of view.tentacleBeasts) {
        const st = skin.bodies.get(b.id);
        push(KEYS.tentacleBeast, st?.frame ?? 12, b, boxAround(b.x, b.y, 46, 44), { layer: -(b.y - 22 + 46) });
        for (const t of b.tentacles) {
            const ts = skin.bodies.get(`tentacle:${t.id}`);
            push(KEYS.tentacle, R.tentacleFrame(t), t, boxAround(t.x, t.y, 16, 4), { layer: -(t.y - 2 + 4), flipX: !t.right,
                tint: ts?.tint ?? null, alpha: t.alpha });
        }
        for (const w of b.whirlpools) {
            const look = R.whirlLook(w.timer);
            const renders = skin.bodies.get(`whirl:${w.id}`)?.renders ?? 1;
            const rot = (cosmeticRand(view.level, w.x, w.y, 61) * 360 + WHIRL.spin * renders) % 360;
            push(KEYS.whirlpool, WHIRL.frames[R.worldFrame(view.gameTime ?? 0, WHIRL.frames.length)], w, boxAround(w.x, w.y, 32, 32),
                { layer: 0, alpha: look.alpha, rot: -rot, ...(look.scale !== 1 ? { scaleX: look.scale, scaleY: look.scale } : {}) });
        }
    }
    for (const f of view.lights) {
        // the totem keeps rendering after `type = ""` (`totemGone`): it lifts away 10 px a render
        const look = R.totemLook(skin.bodies.get(`totem:${f.id}`)?.dyingRenders ?? 0);
        const at = { x: f.x, y: f.y + look.dy };
        push(KEYS.lightTotem, 0, at, { x: at.x, y: at.y - 8, w: 16, h: 24, right: at.x + 16, bottom: at.y + 16 }, {
            layer: -(f.y + 8), tint: look.tint, nightCopy: true,
            ...(look.scaleX !== 1 || look.scaleY !== 1 ? { scaleX: look.scaleX, scaleY: look.scaleY } : {}) });
        for (const b of f.fliers) {
            const st = skin.bodies.get(`flier:${b.id}`);
            const rot = Number.isFinite(b.angleFace) ? -(b.angleFace * 180) / Math.PI : 0; // NaN before its first update
            push(KEYS.lightBoss, b.dying ? LIGHT_DIE[Math.min(b.dieIndex, LIGHT_DIE.length - 1)] : 0, b, boxAround(b.x, b.y, 12, 12), {
                layer: -(b.y + 6), rot, tint: st?.colour ?? null, ...(b.dying ? { scaleX: LIGHT_DIE_SCALE, scaleY: LIGHT_DIE_SCALE } : {}) });
        }
        for (const x of f.shots) {
            const n = skin.bodies.get(`shot:${x.id}`)?.updates ?? 0;
            push(KEYS.lightShot, 0, x, boxAround(x.x, x.y, 4, 4), { layer: -(x.y + 2), rot: -((LIGHT_SHOT_SPIN * n) % 360), nightCopy: true });
        }
    }
    for (const f of view.frozenBosses) {
        push(KEYS.frozenBoss, 0, f, { x: f.x, y: f.y, w: FROZEN_SIZE, h: FROZEN_SIZE, right: f.x + FROZEN_SIZE, bottom: f.y + FROZEN_SIZE },
            { layer: -(f.y + FROZEN_LAYER_DY), nightCopy: true });
    }
    return ops.filter(Boolean);
}

/**
 * ⛓ G11 — what the bosses draw onto nightBmp ONLY (no main-buffer body to copy): the fliers' Lights, the dying
 * totem's Lights and the Owl's grenade Lights. `nightOps` takes them as `extra`; `roomHeight` sets the Light layer.
 */
export function bossNightOps(view, { skin = null, roomHeight = 160 } = {}) {
    if (!view || !skin) return [];
    const R = skin.rules ?? BOSS_RULES;
    const time = view.gameTime ?? 0;
    const L = lightLayer(roomHeight);
    const out = [];
    for (const f of view.lights) {
        for (const b of f.fliers) {
            if (b.dying) continue; // `startDeath` removes it
            const st = skin.bodies.get(`flier:${b.id}`);
            out.push(...lightCircles(R.flierLight(b, st?.lightHits ?? b.hits), time, L));
        }
        for (const l of R.totemLights(f, skin.bodies.get(`totem:${f.id}`)?.dyingRenders ?? 0)) out.push(...lightCircles(l, time, L));
    }
    for (const g of view.owlGrenades) {
        // `Grenade.as:93-99, 136`: Light(x, endY, 2, 1, yellow, false, 20, 20, 1), alpha 1 − index / 2 while "hit" (G5's rule)
        const st = skin.bodies.get(`grenade:${g.id}`);
        if (st?.anim !== 'hit') continue;
        const k = 1 - st.sprite.index / 2;
        if (k > 0) out.push(...lightCircles({ x: g.x, y: g.y, frames: 2, loops: 1, colour: YELLOW, smooth: false, rmin: 20, rmax: 20, alpha: k }, time, L));
    }
    return out;
}
