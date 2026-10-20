/**
 * seedlingDemo/seedlingEnemySkin — **ENEMIES, PROJECTILES AND AP ITEMS IN THE
 * ORIGINAL GRAPHICS** (Seedling JS graphics G3). G2's three pieces again, for
 * every body that is not the player:
 *
 *   · `enemySkinView(run)` — THE ONE ADAPTER from the run to what the bodies'
 *     pictures need: each chaser (`run.chasers`), each spinner
 *     (`run.spinnerBodies`), each arrow in flight (`run.arrowFlights`), the
 *     clock (`run.gameTime`), the player's position and the tile under a body
 *     (the world's grid + `run.tileWrites`). The same getters the watch tools'
 *     `sampleMovers` reads — `sampleMovers` itself is not touched, so its
 *     readers (the `drawn` readout `check-seedling-editor-*` pins) see the
 *     same samples. It copies; it writes nothing.
 *   · `stepEnemySkin(prev, view, tick)` — the RENDERER'S OWN FlashPunk state
 *     per body, one GAME tick at a time: each body's `Spritemap` (which
 *     animation, which index, its timer, the end-of-animation callback), its
 *     mirror, its hit tint (a toggle), and the clocks a class keeps in its
 *     own fields (Puncher's facing, a spinner's death scale, an arrow's last
 *     angle). AS3 decides those from what the body SAW at its own update —
 *     the player where the previous tick left it, `Game.time` at the top of
 *     the frame — so the reducer remembers both from the previous step.
 *   · `enemyOps(view, art, { skin })` — PURE. The draw ops, in
 *     `seedlingSkinRenderer`'s shape, Y-sorted with the room by each body's
 *     own `layer`. A body whose class has no art in the stack is its hitbox
 *     as a rectangle (`ENEMY_COLOUR`), so a reskin that lacks a key still
 *     shows where the body is.
 *   · `apItemOps(apItems, art)` — PURE. An AP item drawn as its `look`
 *     (`APItem.as` `graphicFor`): frame 0 of the look's own sheet, or one of
 *     the five boss keys, or the Archipelago logo for `ap` and any unknown
 *     look (AS3 traces and draws `ap`; it never throws).
 *
 * ⛓ ONE ADAPTER PER FAMILY, REGISTERED BY AS3 CLASS (`ENEMY_FAMILIES`). A
 * family is its anim table (each anim citing its AS3 line), its `update`
 * (the class's own `update()` as far as it touches the graphic, transcribed in
 * AS3's order), its `endAnim` (the Spritemap callback) and its draw. The run's
 * tag → class join is `chasers.CHASERS[tag].as3`, so a class added to the
 * model is drawn by adding ONE row here; a class with no row is a rectangle.
 *
 * ⛔ THE RENDERER ONLY READS. Nothing here steps the sim or draws from its RNG:
 * a pit spin's sign (`fallSpinSpeed = 8 * FP.choose(-1, 1)`, `Enemy.as:34`, on
 * the GAMEPLAY stream) comes from `cosmeticRand` keyed by the body (⚖ never
 * model the cosmetic RNG). Where the class's decision reads state the run does
 * not carry (Bob's "walk" restart reads the distance to the player; Puncher's
 * punch reads `attackRange`), it is RE-DERIVED here from what the run does
 * carry — a cosmetic copy of the decision, never a second model of the
 * motion: the motion is the run's, read back. `seedlingEnemySkin.test.js`
 * holds each family's tape's state, reports and `stateLog` byte-identical with
 * all of this running every tick and without it.
 *
 * ── The FlashPunk clockwork, transcribed (`net/flashpunk/graphics/Spritemap.as`) ──
 *
 *   · `play(name, reset)` (:124-139): a no-op when `name` is already playing
 *     (unless `reset`); an unknown name (`""`) stops the animation and shows
 *     frame 0.
 *   · `update()` (:70-99): `timer += fps · FP.elapsed`; on each whole step the
 *     index advances; at the end a LOOPING anim wraps to 0 and calls the
 *     callback, a one-shot holds its last index and calls it — so every
 *     class's `endAnim` runs at the end of EVERY cycle, looping or not.
 *   · `set frame` stops the animation (`_anim = null`).
 *   · The World updates an entity, then its graphic (`World.as:56-58`), in
 *     add order; every enemy updates BEFORE the Player
 *     (`spinner.MODELLED_ENEMY_CLASSES.Bob.stepped`), so a body sees the
 *     player where the PREVIOUS tick left it, and a kill (the player's swing)
 *     lands after the body's graphic has advanced this tick.
 *   · The hit tint (`Enemy.hitUpdate`, `Enemy.as:223-245`): with the timer
 *     `h` at the top of the update, toggles `hitsColor`/white when
 *     `h % 10 == 0`, decrements, and resets to white at 0. It runs only while
 *     the body is neither destroyed nor falling (`Enemy.as:89-112`).
 *   · Death: `Mobile.death` (`Mobile.as:60-71`) fades a destroyed body's alpha
 *     0.1 a tick — the run carries that alpha; a "die" anim's `endAnim` sets
 *     `destroy` and shows the sheet's LAST frame (`frameCount - 1`).
 *   · The pit (`Enemy.as:89-104`): `angle += fallSpinSpeed`, `alpha -= 0.05`.
 *
 * ⛔ NOT YET (the coverage table, `ENEMY_COVERAGE`): LavaRunner's jump arc
 * (`inAir`, not on the run), the 0.25-alpha `nightBmp` copies (G5), the
 * explosion / slash-hit / coin effects (G4), `Game.freezeObjects` (a dialogue
 * freezes the clocks; the run steps no body then, so the picture holds), and
 * every modelled class without a family here (the crushers and axes, the
 * totems, the lava chains). WallFlyer, Drill, the turrets and the Bob Boss
 * are G3b's (`seedlingRoomBodySkin.js`).
 */
import { FP_ELAPSED_PER_TICK } from '../artLibrary/artLibrary.js';
import { CHASERS, chaserBoxAt } from './chasers.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { cosmeticRand } from './seedlingSkinRenderer.js';
import { ENEMY_ART } from './seedlingEnemyArt.js';

export { ENEMY_ART };

/** A body drawn without art: its hitbox in this colour. */
export const ENEMY_COLOUR = '#e04848';
export const ARROW_COLOUR = '#d8d0b0';
/** `Enemy.as:26-27` — the default `hitsColor` / `normalColor`. */
export const ENEMY_HIT_TINT = '#ff0000';
/** `Enemy.as:25` `hitsTimerInt`. */
const HITS_TIMER_INT = 10;
/** `Enemy.as:34-35` — `8 * FP.choose(-1, 1)` per tick, `fallAlphaSpeed`. */
const PIT_SPIN = 8;
const PIT_ALPHA_SPEED = 0.05;
/** `Game.as:488` `timePerFrame`; `Game.as:1962-1965` `worldFrame(n, loops)`. */
const TIME_PER_FRAME = 45;
export const worldFrame = (time, n, loops = 1) => Math.floor((((time % (TIME_PER_FRAME * loops)) + TIME_PER_FRAME * loops) % (TIME_PER_FRAME * loops))
    / (TIME_PER_FRAME * loops / Math.max(n, 1)));

/** Each art row's anims, by key (`ENEMY_ART`). */
export const ANIMS = Object.fromEntries(ENEMY_ART.filter((r) => r.anims).map((r) => [r.key, r.anims]));

// ── the Spritemap, transcribed ──────────────────────────────────────────

export const freshSprite = () => ({ anim: '', index: 0, timer: 0, complete: true, frame: 0 });

/** `Spritemap.play` (:124-139). */
export function play(sp, anims, name, reset = false) {
    if (!reset && sp.anim !== '' && sp.anim === name) return;
    const a = anims[name];
    if (!a) {
        sp.anim = '';
        sp.frame = 0;
        sp.index = 0;
        sp.complete = true;
        return;
    }
    sp.anim = name;
    sp.index = 0;
    sp.timer = 0;
    sp.frame = a.frames[0];
    sp.complete = false;
}

/** `set frame` — stops the animation. A negative frame is FlashPunk's wrap (`-1` = the sheet's last frame). */
export const setFrame = (sp, f) => { sp.anim = ''; sp.frame = f; };

/** `Spritemap.update` (:70-99): `_timer += _frameRate * FP.elapsed * rate`, `FP.elapsed` the sim's clamped 0.0333. */
export function updateSprite(sp, anims, onEnd, rate = 1) {
    const a = anims[sp.anim];
    if (!a || sp.complete) return;
    sp.timer += a.fps * FP_ELAPSED_PER_TICK * rate;
    if (sp.timer < 1) return;
    while (sp.timer >= 1) {
        sp.timer -= 1;
        sp.index += 1;
        const cur = anims[sp.anim];
        if (!cur) break;
        if (sp.index === cur.frames.length) {
            if (cur.loop !== false) {
                sp.index = 0;
                onEnd();
            } else {
                sp.index = cur.frames.length - 1;
                sp.complete = true;
                onEnd();
                break;
            }
        }
    }
    const now = anims[sp.anim];
    if (now) sp.frame = now.frames[sp.index];
}

const distance = (ax, ay, bx, by) => Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));

// ── the families ────────────────────────────────────────────────────────

/**
 * `Bob.update` (Bob.as:49-82) and its `endAnim` (:90-102). `cls` carries what
 * a subclass changes: `runRange`, `targetOffset`, `sitFrames`, `sitLoops`,
 * `animateNormally`.
 */
function bobUpdate(st, b, ctx, cls, anims) {
    if (b.destroy || st.sprite.anim === 'die') return;
    const p = ctx.player;
    if (p) {
        const d = distance(b.x, b.y, p.x + cls.targetOffset[0], p.y + cls.targetOffset[1]);
        if (d <= cls.runRange && st.animateNormally !== false && st.sprite.anim !== 'walk') play(st.sprite, anims, 'walk');
    }
    if (st.sprite.anim === '') {
        const sit = st.sitFrames ?? cls.sitFrames;
        setFrame(st.sprite, sit[ctx.worldFrame(ctx.time, sit.length, cls.sitLoops)]);
    }
}
function bobEndAnim(st, b, anims) {
    if (st.sprite.anim === 'die') {
        play(st.sprite, anims, '');
        setFrame(st.sprite, -1);
    } else {
        play(st.sprite, anims, '');
    }
}

const BOB = { runRange: 80, targetOffset: [0, 0], sitFrames: [0, 1, 2, 1], sitLoops: 1 };

/**
 * THE REGISTRY, by AS3 class. Each family: `key` (the art), `anims` (from
 * `ENEMY_ART`), `hitsTint` (`hitsColor`, null when it equals `normalColor`),
 * `update(st, b, ctx)` before the graphic's update, `endAnim(st, b)`, and
 * optional `init`, `mirror`, `layer`, `extraOps`.
 */
export const ENEMY_FAMILIES = Object.freeze({
    // ── Bob (Bob.as) ──
    Bob: {
        key: 'seedling:enemy/bob',
        hitsTint: ENEMY_HIT_TINT,
        update: (st, b, ctx) => bobUpdate(st, b, ctx, BOB, ANIMS['seedling:enemy/bob']),
        endAnim: (st, b) => bobEndAnim(st, b, ANIMS['seedling:enemy/bob']),
    },
    // ── LavaRunner (LavaRunner.as:46-119): Bob's chase, then the mirror (:75-82, on `moveSpeed` / 2 of the
    //    PREVIOUS tick's swim()/walk()), then swim() on water/lava (:84-94) or walk(). The jump (`inAir`) is not on
    //    the run, so it is not drawn. ──
    LavaRunner: {
        key: 'seedling:enemy/lavarunner',
        hitsTint: ENEMY_HIT_TINT,
        init: (st) => Object.assign(st, { moveSpeed: 1.5, animateNormally: true, sitFrames: [0, 1] }),
        update(st, b, ctx) {
            const anims = ANIMS['seedling:enemy/lavarunner'];
            if (b.destroy || st.sprite.anim === 'die') return;
            bobUpdate(st, b, ctx, BOB, anims);
            if (b.vx > st.moveSpeed / 2) st.mirrored = false;
            else if (b.vx < -st.moveSpeed / 2) st.mirrored = true;
            const t = ctx.terrainAt(b.x, b.y);
            if (t === 1 || t === 17) {
                play(st.sprite, anims, 'swim');
                Object.assign(st, { sitFrames: [5, 6], moveSpeed: 1, animateNormally: false });
            } else {
                Object.assign(st, { sitFrames: [0, 1], moveSpeed: 1.5, animateNormally: true });
            }
        },
        endAnim: (st, b) => bobEndAnim(st, b, ANIMS['seedling:enemy/lavarunner']),
    },
    // ── Jellyfish (Jellyfish.as:45-95): "walk" whenever the player is within 160 (no restart while it plays),
    //    else the walk frames on the world clock. ──
    Jellyfish: {
        key: 'seedling:enemy/jellyfish',
        hitsTint: ENEMY_HIT_TINT,
        update(st, b, ctx) {
            const anims = ANIMS['seedling:enemy/jellyfish'];
            if (b.destroy || st.sprite.anim === 'die') return;
            const p = ctx.player;
            if (p && distance(b.x, b.y, p.x, p.y) <= 160) play(st.sprite, anims, 'walk');
            if (st.sprite.anim === '') {
                const walk = [0, 1, 2, 3, 2, 1];
                setFrame(st.sprite, walk[ctx.worldFrame(ctx.time, walk.length)]);
            }
        },
        endAnim: (st, b) => bobEndAnim(st, b, ANIMS['seedling:enemy/jellyfish']),
    },
    // ── Bulb (Bulb.as:35-88): Bob's update unless dropping/dying, the mirror at ≥ ±moveSpeed/2 (:48-55), the
    //    one-hit "drop" (:58-62), then "die" (:74-81) and removal. Its `endAnim` has NO default arm, so "walk"
    //    loops; `hitsColor = normalColor` (:32), so a hit shows no tint. ──
    Bulb: {
        key: 'seedling:enemy/bulb',
        hitsTint: null,
        update(st, b, ctx) {
            const anims = ANIMS['seedling:enemy/bulb'];
            const a = st.sprite.anim;
            if (a !== 'drop' && a !== 'die') {
                bobUpdate(st, b, ctx, { ...BOB, sitFrames: [0, 3] }, anims);
                if (b.vx >= 0.65 / 2) st.mirrored = false;
                else if (b.vx <= -0.65 / 2) st.mirrored = true;
            }
            if (b.hits >= 1 && st.sprite.anim !== 'drop' && st.sprite.anim !== 'die') play(st.sprite, anims, 'drop');
        },
        endAnim(st) {
            if (st.sprite.anim === 'drop') play(st.sprite, ANIMS['seedling:enemy/bulb'], 'die');
        },
        skipsTint: (st) => st.sprite.anim === 'drop' || st.sprite.anim === 'die',
        // `startDeath` is overridden EMPTY (:65-68): a kill is the "drop" above, never a "die" at the kill.
        dieOnKill: false,
    },
    // ── Flyer (Flyer.as:48-81): "fall" when the point 10 px BELOW it is in the player's box; else Bob's update
    //    with `targetOffset` (0, -10) and `sitLoops` 0.5; `layering()` is `-(y + 10)` (:78-81). ──
    Flyer: {
        key: 'seedling:enemy/flyer',
        hitsTint: ENEMY_HIT_TINT,
        update(st, b, ctx) {
            const anims = ANIMS['seedling:enemy/flyer'];
            if (b.destroy || st.sprite.anim === 'die') return;
            const box = ctx.playerBox;
            if (box && b.x >= box.x && b.x < box.right && b.y + 10 >= box.y && b.y + 10 < box.bottom) play(st.sprite, anims, 'fall');
            if (st.sprite.anim !== 'fall') bobUpdate(st, b, ctx, { runRange: 80, targetOffset: [0, -10], sitFrames: [0, 1, 2, 3], sitLoops: 0.5 }, anims);
        },
        endAnim: (st, b) => bobEndAnim(st, b, ANIMS['seedling:enemy/flyer']),
        layer: (b) => -(b.y + 10),
    },
    // ── Puncher (Puncher.as:53-165): within 80 it faces by its velocity and walks, else stands; within 10 it
    //    punches; the mirror is set from the facing BEFORE this tick re-aims it (:75-82); `endAnim` turns an
    //    attack back into a stand (:136-141). ──
    Puncher: {
        key: 'seedling:enemy/puncher',
        hitsTint: ENEMY_HIT_TINT,
        init: (st) => Object.assign(st, { direction: 3 }),
        update(st, b, ctx) {
            if (b.destroy || st.sprite.anim === 'die') return;
            const p = ctx.player;
            if (!p || st.sprite.anim.startsWith('attack')) return;
            const d = distance(b.x, b.y, p.x, p.y);
            if (d <= 80) {
                st.mirrored = st.direction === 2;
                if (Math.abs(b.vx) > Math.abs(b.vy)) {
                    if (b.vx > 0) st.direction = 0;
                    else if (b.vx < 0) st.direction = 2;
                } else {
                    st.direction = b.vy >= 0 ? 3 : 1;
                }
                puncherSprite(st, 'walk');
            } else {
                puncherSprite(st, 'stand');
            }
            if (d <= 10) puncherSprite(st, 'attack');
        },
        endAnim(st) {
            if (st.sprite.anim === 'die') {
                play(st.sprite, ANIMS['seedling:enemy/puncher'], '');
                setFrame(st.sprite, -1);
            } else {
                puncherSprite(st, 'stand');
            }
        },
    },
    // ── BobSoldier (BobSoldier.as:73-198): "walk" within 80, the walk frames on the world clock while idle; the
    //    sword drawn over the body at `swordSpin` (the run's own angle), at the body's alpha. No "die" anim: a kill
    //    is `Enemy.startDeath`, the fade. ──
    BobSoldier: {
        key: 'seedling:enemy/bobsoldier',
        hitsTint: ENEMY_HIT_TINT,
        update(st, b, ctx) {
            const anims = ANIMS['seedling:enemy/bobsoldier'];
            const p = ctx.player;
            if (p && distance(b.x, b.y, p.x, p.y) <= 80 && st.sprite.anim !== 'walk') play(st.sprite, anims, 'walk');
            if (st.sprite.anim === '') {
                const walk = [0, 1, 2, 1];
                setFrame(st.sprite, walk[ctx.worldFrame(ctx.time, walk.length)]);
            }
        },
        endAnim: (st) => play(st.sprite, ANIMS['seedling:enemy/bobsoldier'], ''),
        extraOps(st, b, art, op) {
            if (b.swordSpin === undefined || !art.has('seedling:enemy/lameSword')) return [];
            return [op('seedling:enemy/lameSword', 0, { rot: -(b.swordSpin * 180) / Math.PI })];
        },
    },
});

const PUNCHER_FACING = ['side', 'up', 'side', 'down'];
/** `Puncher.setSprite` (:151-165). */
function puncherSprite(st, prefix) {
    play(st.sprite, ANIMS['seedling:enemy/puncher'], `${prefix}-${PUNCHER_FACING[st.direction]}`);
}

/** The family of a chaser tag (`CHASERS[tag].as3`), or null. */
export const familyOf = (tag) => ENEMY_FAMILIES[CHASERS[tag]?.as3] ?? null;

/**
 * WHAT THIS SLICE DRAWS, by AS3 class: `drawn` (a family above), `modelled`
 * (on the run, drawn as a rectangle or not at all), `remaining` (not modelled).
 */
export const ENEMY_COVERAGE = Object.freeze({
    drawn: Object.freeze(['Bob', 'LavaRunner', 'Jellyfish', 'Bulb', 'Flyer', 'Puncher', 'BobSoldier', 'Spinner', 'Arrow', 'APItem']),
    // ⛓ G3b drew WallFlyer, Drill, IceTurret (+ IceTurretBlast), Turret (+ TurretSpit) and BobBoss:
    //    `seedlingRoomBodySkin.ROOM_BODY_COVERAGE`.
    modelled: Object.freeze(['BossTotem', 'Crusher', 'SpinningAxe', 'LavaChain']),
    remaining: Object.freeze(['Cactus', 'Squishle', 'Tentacle', 'TentacleBeast', 'LavaBoss', 'LightBoss', 'ShieldBoss',
        'FinalBoss', 'Grenade', 'BombPusher', 'traps (Lava/Ice/Dark/Sand)', 'Coin', 'HealthPickup', 'Explosion', 'WandShot', 'LavaBall', 'RayShot']),
});

// ── the adapter ─────────────────────────────────────────────────────────

/**
 * THE ADAPTER. Everything the bodies' pictures read, from the run, as plain
 * objects (null when there is no run). `epoch` is the room's world OBJECT (an
 * identity only): a new world is new entities with fresh Spritemaps.
 */
export function enemySkinView(run) {
    if (!run?.state) return null;
    const world = run.world ?? null;
    return {
        // A VISIT: the run, the level, and how many crossings and deaths it has made — `run.world` is the level's
        // memoised build (the same object on a re-visit and after a death's restart) and is re-wrapped by a tile
        // write mid-visit, so it is not a visit's identity.
        epoch: { run, key: `${run.level}|${run.transitions?.length ?? 0}|${run.playerDeaths?.length ?? 0}` },
        level: run.level,
        gameTime: run.gameTime ?? null,
        player: { x: run.state.x, y: run.state.y },
        chasers: (run.chasers ?? []).map((c) => ({
            id: c.id, tag: c.tag, x: c.x, y: c.y, vx: c.vx ?? 0, vy: c.vy ?? 0, hits: c.hits ?? 0, hitsTimer: c.hitsTimer ?? 0,
            dying: !!c.dying, destroy: !!c.destroy, alpha: c.alpha ?? 1,
            ...(c.swordSpin !== undefined ? { swordSpin: c.swordSpin } : {}),
        })),
        spinners: (run.spinnerBodies ?? []).map((s) => ({
            id: s.id, x: s.x, y: s.y, hits: s.hits ?? 0, hitsTimer: s.hitsTimer ?? 0, destroy: !!s.destroy, alpha: s.alpha ?? 1,
        })),
        arrows: (run.arrowFlights ?? []).filter((a) => !a.removed).map((a) => ({
            id: a.id, x: a.x, y: a.y, vx: a.v?.x ?? 0, vy: a.v?.y ?? 0, die: !!a.die, alpha: a.alpha ?? 1,
        })),
        // The tile type under a point: `Enemy.getState` (`Enemy.as:131-139`, the nearest Tile — the one the point
        // is in). `run.world` carries the visit's own tile writes (a Bulb's lava, `levelWorld.withTileWrites`).
        terrain: terrainLookup(world),
    };
}

const grids = new WeakMap();
function terrainLookup(world) {
    if (!world?.tiles) return () => 0;
    let grid = grids.get(world);
    if (!grid) grids.set(world, grid = new Map(world.tiles.map((t) => [`${t.tx},${t.ty}`, t.t])));
    return (x, y) => grid.get(`${Math.floor(x / 16)},${Math.floor(y / 16)}`) ?? 0;
}

const sameVisit = (a, b) => !!a && !!b && a.run === b.run && a.key === b.key;

// ── the reducer ─────────────────────────────────────────────────────────

/** The tint after this tick's `hitUpdate` (Enemy.as:223-245), `h` = the timer at the top of the update. */
export function hitTint(tint, h, colour) {
    if (h <= 0) return tint;
    let next = tint;
    if (h % HITS_TIMER_INT === 0) next = next === null ? colour : null;
    if (h - 1 <= 0) next = null;
    return next;
}

/** The reducer's rules, by name, so a test can swap ONE for a mutant (`opts.rules`). */
export const ENEMY_RULES = Object.freeze({ updateSprite, hitTint, worldFrame });

/**
 * One GAME tick of every body's picture (call it after every `tick()`).
 * Pure: returns a new object; `prev` null (or another world) starts afresh.
 */
export function stepEnemySkin(prev, view, tick, { rules = ENEMY_RULES, families = ENEMY_FAMILIES } = {}) {
    if (!view) return prev;
    const R = rules === ENEMY_RULES ? rules : { ...ENEMY_RULES, ...rules };
    const same = !!prev && sameVisit(prev.epoch, view.epoch);
    // What the bodies SAW this tick: the clock at the top of the frame and the player where last tick left it.
    const time = same && prev.gameTime !== null ? prev.gameTime : (view.gameTime !== null ? view.gameTime - 1 : tick);
    const seen = same ? prev.player : view.player;
    const ctx = { time, player: seen, playerBox: seen ? playerBoxAt(seen.x, seen.y) : null, terrainAt: view.terrain, worldFrame: R.worldFrame };
    const bodies = new Map();
    for (const b of view.chasers) {
        const fam = families[CHASERS[b.tag]?.as3];
        if (!fam) continue;
        const old = same ? prev.bodies.get(`c:${b.id}`) : null;
        const st = old ? { ...old, sprite: { ...old.sprite } } : { sprite: freshSprite(), tint: null, mirrored: false, prevHits: 0 };
        if (!old && fam.init) fam.init(st);
        const anims = ANIMS[fam.key];
        const pit = !b.destroy && !b.dying && b.alpha < 1;
        if (!b.destroy && !pit && !(fam.skipsTint?.(st))) st.tint = fam.hitsTint ? R.hitTint(st.tint, st.prevHits, fam.hitsTint) : null;
        fam.update(st, b, ctx);
        R.updateSprite(st.sprite, anims, () => fam.endAnim(st, b));
        // The kill lands in the PLAYER's update, after this body's graphic advanced: "die" starts next tick.
        if (b.dying && !b.destroy && anims.die && fam.dieOnKill !== false && st.sprite.anim !== 'die' && !st.died) { play(st.sprite, anims, 'die'); st.died = true; }
        if (b.destroy && st.sprite.anim === 'die') { play(st.sprite, anims, ''); setFrame(st.sprite, -1); }
        if (pit) st.pitK = Math.round((1 - b.alpha) / PIT_ALPHA_SPEED);
        st.prevHits = b.hitsTimer;
        bodies.set(`c:${b.id}`, st);
    }
    // Spinner (Spinner.as:66-121): the hammer's angle from `Game.time` at the update; a killed spinner's hammer
    // grows 0.1 a RENDER (one render per tick) and fades as `2 - scale`.
    for (const s of view.spinners) {
        const old = same ? prev.bodies.get(`s:${s.id}`) : null;
        const st = old ? { ...old } : { tint: null, prevHits: 0, deathScale: 1 };
        if (!s.destroy) st.tint = R.hitTint(st.tint, st.prevHits, ENEMY_HIT_TINT);
        st.hammer = ((time % TIME_PER_FRAME) / TIME_PER_FRAME) * 360;
        if (s.hits >= 3) st.deathScale = (old?.deathScale ?? 1) + 0.1;
        st.prevHits = s.hitsTimer;
        bodies.set(`s:${s.id}`, st);
    }
    // Arrow (Arrow.as:21-70): the angle follows `v` while it moves and keeps the last one after a hit.
    for (const a of view.arrows) {
        const old = same ? prev.bodies.get(`a:${a.id}`) : null;
        const moving = a.vx !== 0 || a.vy !== 0;
        bodies.set(`a:${a.id}`, { angle: moving ? (Math.atan2(-a.vy, a.vx) * 180) / Math.PI : (old?.angle ?? 0) });
    }
    return { epoch: view.epoch, gameTime: view.gameTime, player: view.player, bodies };
}

// ── the ops ─────────────────────────────────────────────────────────────

/** A sprite op in `seedlingSkinRenderer`'s shape (G2's, with its pivot). */
export function spriteOp(art, key, frame, at, { rot = 0, flipX = false, scaleX = 1, scaleY = 1, alpha = 1, tint = null, layer, fallback = null }) {
    const fr = art.frameRect(key, frame);
    if (!fr) return null;
    const { ox, oy } = fr;
    return {
        key, frame: fr.frame, sheetRef: fr.sheetRef, sx: fr.sx, sy: fr.sy, sw: fr.sw, sh: fr.sh,
        dx: at.x - ox, dy: at.y - oy, rot, flipX, flipY: false, layer, fallback,
        pivotX: ox, pivotY: oy,
        ...(scaleX !== 1 || scaleY !== 1 ? { scaleX, scaleY } : {}),
        ...(alpha !== 1 ? { alpha } : {}),
        ...(tint ? { tint } : {}),
    };
}


export const rectOp = (rect, colour, alpha, layer) => ({ rect, colour, alpha, layer });

/**
 * THE BODIES' DRAW OPS at the tick `skin` was stepped to. Every op carries the
 * body's hitbox rectangle as its fallback (an undecoded sheet); a body whose
 * class has no family or no art is that rectangle.
 */
export function enemyOps(view, art, { skin, families = ENEMY_FAMILIES } = {}) {
    if (!view || !art || !skin) return [];
    const ops = [];
    for (const b of view.chasers) {
        const fam = families[CHASERS[b.tag]?.as3];
        const box = chaserBoxAt(b.tag, b.x, b.y);
        const layer = fam?.layer ? fam.layer(b) : -box.bottom;
        const fallback = rectOp(box, ENEMY_COLOUR, 0.9 * b.alpha, layer);
        const st = skin.bodies.get(`c:${b.id}`);
        if (!fam || !st || !art.has(fam.key)) { ops.push(fallback); continue; }
        const pit = st.pitK && !b.destroy && !b.dying && b.alpha < 1;
        const rot = pit ? -PIT_SPIN * st.pitK * (cosmeticRand(view.level, hashId(b.id), 0, 34) < 0.5 ? -1 : 1) : 0;
        const at = { x: b.x, y: b.y };
        const body = { rot, flipX: !!st.mirrored, alpha: b.alpha, tint: st.tint, layer, fallback };
        ops.push(spriteOp(art, fam.key, st.sprite.frame, at, body));
        if (fam.extraOps) {
            const op = (key, frame, extra) => spriteOp(art, key, frame, at, { alpha: b.alpha, layer, ...extra });
            ops.push(...fam.extraOps(st, b, art, op));
        }
    }
    for (const s of view.spinners) {
        const st = skin.bodies.get(`s:${s.id}`);
        const box = { x: s.x - 4, y: s.y - 4, w: 7, h: 7, right: s.x + 3, bottom: s.y + 3 };
        const layer = -box.bottom;
        const fallback = rectOp(box, ENEMY_COLOUR, 0.9 * s.alpha, layer);
        if (!st || !art.has('seedling:enemy/spinner')) { ops.push(fallback); continue; }
        const at = { x: s.x, y: s.y };
        const scale = s.hits >= 3 ? st.deathScale : 1;
        const hammerAlpha = s.hits >= 3 ? Math.max(0, 2 - scale) * s.alpha : s.alpha;
        // FlashPunk turns counter-clockwise; `angle = -hammerAngle` is therefore the canvas's +hammerAngle.
        ops.push(spriteOp(art, 'seedling:enemy/spinner', 1, at, { rot: st.hammer, scaleX: scale, scaleY: scale, alpha: hammerAlpha, tint: st.tint, layer }));
        ops.push(spriteOp(art, 'seedling:enemy/spinner', 0, at, { alpha: s.alpha, tint: st.tint, layer, fallback }));
    }
    for (const a of view.arrows) {
        const st = skin.bodies.get(`a:${a.id}`);
        const layer = -(a.y + 2);
        const fallback = rectOp({ x: a.x - 2, y: a.y - 2, w: 4, h: 4, right: a.x + 2, bottom: a.y + 2 }, ARROW_COLOUR, a.alpha, layer);
        if (!st || !art.has('seedling:projectile/arrow')) { ops.push(fallback); continue; }
        ops.push(spriteOp(art, 'seedling:projectile/arrow', 0, a, { rot: st.angle ? -st.angle : 0, alpha: a.alpha, layer, fallback }));
    }
    return ops.filter(Boolean);
}

export const hashId = (id) => {
    let h = 0;
    for (const ch of String(id)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    return h;
};

/** An AP item's art key from its `look` (`APItem.graphicFor`, :150-172); null = draw the logo. */
export function apLookKey(look) {
    const m = /^bosskey(\d+)$/.exec(look ?? '');
    if (m) return Number(m[1]) < 5 ? `seedling:pickup/bosskey${m[1]}` : null;
    if (!look || look === 'ap') return null;
    return `seedling:pickup/${look}`;
}

export const AP_LOGO_KEY = 'archipelago:pickup/item';

/**
 * THE AP ITEMS' DRAW OPS: each as its look, frame 0, `centerOO`'d on the
 * rect's centre (`APItem(x + 8, y + 8)`), at the Pickup's `layer`. An unknown
 * look — or a look the stack lacks — is the Archipelago logo; no logo either
 * is G1's rectangle.
 */
export function apItemOps(apItems, art, colour) {
    return apItems.map((a) => {
        const layer = -a.rect.bottom;
        const fallback = rectOp(a.rect, colour, 1, layer);
        if (!art) return fallback;
        const want = apLookKey(a.look);
        const key = want && art.has(want) ? want : AP_LOGO_KEY;
        if (!art.has(key)) return fallback;
        const centre = { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 };
        return spriteOp(art, key, 0, centre, { layer, fallback });
    }).filter(Boolean);
}
