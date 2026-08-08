/**
 * seedlingDemo/finalBossFight — the Owl (`Enemies/FinalBoss.as`), his
 * barrage, his grenades, his pods and the three self-inflicted lava hits
 * that kill him.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 6e. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §8.5, §8.6, §14.4, §16.5,
 * §16.8. The draw schedule this module consumes is `finalBossRng.js`.
 *
 * ── THE SHAPE OF THE FIGHT ────────────────────────────────────────────
 *
 * `onlyHitBy = "Lava"`, `hitsMax = 3`, `justKnock = true`. So a sword press
 * cannot damage him at all — it takes `Enemy.hit`'s LAST arm and only shoves
 * — and the only thing that can is `FinalBoss.update`'s own
 * `hit(lavaForce, …, "Lava")`, fired when his 12x12 box's first overlapping
 * `Tile` is lava. **All three kills are self-inflicted and the player's whole
 * contribution is geometry.**
 *
 * Two gates decide when a shove is even possible:
 *
 *   · `canHit = rockfallTime < 0` (`:131`) is FALSE for all 240 ticks of a
 *     barrage, so he is untouchable while rocks are falling;
 *   · the self-hit sets `hitsTimer = hitsTimerMax = 30`, and `Enemy.hit`'s
 *     first gate is `hitsTimer <= 0` — so the next shove is refused for 30
 *     ticks after each lava hit.
 *
 * and `hitThisSequence` allows ONE lava hit per pod cycle (it is cleared only
 * on the single tick `rockfallTime == 0`). ⇒ three kills is three cycles, and
 * a cycle is a walk plus 240 ticks of barrage.
 *
 * ── ⛔⛔⛔ THE AIM, RE-DERIVED — AND IT IS A BALLISTIC LAUNCH ─────────
 *
 * §8.5 measured the clearance from his walk lines to the lava octagon at
 * 3.00 px on all five legs and concluded "one knockback of force 2 clears
 * it; the hard part is being adjacent at the closest-approach point".
 * §14.4 refuted that: `justKnock` sets NO `hitsTimer`, so **all five of a
 * press's hit tests land** (§13.2 / trap 93) and each adds `swordForce = 5`
 * along the player->boss ray. `maxForce` is the `Enemy` default **-1** until
 * the first self-hit and `2` from the line after it, so:
 *
 *   press 1 (before any lava hit)  5 tests x force 5
 *   press 2, 3                     5 tests x force min(5, 2) = 2
 *
 * and the cap `if (v.length > 4) v.normalize(4)` sits in `update()`, which
 * runs BEFORE the player's `slash()` — so it never sees the post-shove value
 * and never binds within a press. `finalBossCoast` below derives the whole
 * trajectory on the real loop rather than quoting a total: friction 0.25,
 * then `moveX`/`moveY` a pixel at a time, then the cap.
 *
 * ⇒ **the problem is not reaching 3.00 px, it is not overshooting by 68.**
 *
 * ── ⛔⛔ AND TRAP 95 IS WHY THE ENDPOINT IS PLANNED, NOT SCORED ───────
 *
 * The self-hit is `collide("Tile", x, y)` and then `tile.t == 17` on the ONE
 * entity that returned — `Entity.collide` walks `FP._world._typeFirst["Tile"]`
 * and returns the FIRST overlap, and `World.addType` PREPENDS, so the walk
 * order is the reverse of `Game.loadlevel`'s add order, which is the reverse
 * of the `.oel`'s own tile order. A 12x12 box straddling a lava tile and a
 * floor tile therefore hits or does not hit depending on a file's line order.
 *
 * This module transcribes that selection exactly (`firstTileUnder`), and
 * `finalBossLavaVerdict` additionally reports whether the box is WHOLLY
 * inside lava — the sufficient condition a plan should aim for, because it
 * is true whatever the ordering is. A plan that lands him half on the edge is
 * relying on a line number.
 *
 * ── ⛔ THE CORPSE IS A PERMANENT WALL ─────────────────────────────────
 *
 * `startDeath` sets `type = "Solid"`, plays "die" and sets `destroy`;
 * `death()` is overridden EMPTY, so `Mobile.death`'s fade never runs and
 * `FP.world.remove` is never called. The body stays, solid, exactly where the
 * third shove left it, for the rest of the visit — so **the third shove's
 * endpoint is load-bearing for the exit route** and a plan that kills him in
 * the doorway has sealed the room.
 *
 * ⛓ And the two persistence writes are in `endAnim`'s "dead" arm, not in
 * `removed()` (§8.6) — reached through the GRAPHIC, which `World.update`
 * advances whether or not the entity is active and whether or not the world
 * is frozen. `finalBossDeathSchedule` derives the two fenceposts.
 */

import {
    OwlDrawStream, ROCK_FREQUENCY, GRENADE_FREQUENCY, as3Int,
} from './finalBossRng.js';

/** Thrown by everything in this module. */
export class FinalBossError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FinalBossError';
    }
}

/** `Main.as:36` — `super(160, 160, FPS)`, and `FP.elapsed` clamped (§8.2). */
export const FP_ELAPSED_CLAMPED = 0.0333;

/**
 * The update on which a Spritemap's callback fires, counting the `play()`
 * frame as update 1 when the play happens inside `update()`.
 *
 * ⛔ THE FENCEPOST IS TRAP 104's AND IT IS LIVE HERE IN BOTH DIRECTIONS.
 * `World.update` runs `e.update()` and `e._graphic.update()` in ONE pass, so
 * a `play()` from inside `update()` is advanced the same tick — the callback
 * lands `n - 1` ticks later. A `play()` from a CONSTRUCTOR (which
 * `Game.loadlevel` calls outside any update pass) is not, and lands `n`
 * ticks later. Every anim in this room is played from inside `update()` or
 * from inside another anim's callback, which is also inside the same pass.
 */
export function animCallbackUpdates(frameRate, frameCount) {
    if (frameRate <= 0) return Infinity;
    const stepPerUpdate = frameRate * FP_ELAPSED_CLAMPED;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 100000; update += 1) {
        timer += stepPerUpdate;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === frameCount) return update;
        }
    }
    throw new FinalBossError(
        `animCallbackUpdates: ${frameCount} frames at ${frameRate}/s did not wrap`);
}

/** The Owl's own `add()` calls, verbatim (`FinalBoss.as:47-50`). */
export const FINAL_BOSS_ANIMS = Object.freeze({
    walk: Object.freeze({ frames: 4, frameRate: 15 }),
    die: Object.freeze({ frames: 8, frameRate: 5 }),
    dead: Object.freeze({ frames: 2, frameRate: 1 }),
    /** `add("deadframe", [11])` takes the default frameRate 0 — a terminal. */
    deadframe: Object.freeze({ frames: 1, frameRate: 0 }),
});

export const FINAL_BOSS_ANIM_UPDATES = Object.freeze(
    Object.fromEntries(Object.entries(FINAL_BOSS_ANIMS)
        .map(([k, a]) => [k, animCallbackUpdates(a.frameRate, a.frames)])));

/** `Scenery/RockFall.as` and `Scenery/Pod.as` and `Enemies/Grenade.as`. */
export const ROCKFALL_BREAK_UPDATES = animCallbackUpdates(15, 8);
export const POD_OPEN_UPDATES = animCallbackUpdates(10, 7);
export const GRENADE_EXPLODE_UPDATES = animCallbackUpdates(12, 8);
export const GRENADE_HIT_UPDATES = animCallbackUpdates(12, 3);

/** The Owl, transcription-grade. */
export const FINAL_BOSS = Object.freeze({
    as3: 'Enemies/FinalBoss.as',
    /** `super(_x + Tile.w/2, _y + Tile.h/2, …)` — `finalboss@64,96` is (72,104). */
    dx: 8,
    dy: 8,
    /** `setHitbox(12, 12, 6, 6)`. */
    box: Object.freeze({ w: 12, h: 12, ox: 6, oy: 6 }),
    moveSpeed: 1,
    /** `const lavaForce:int = 6` — and it is never clamped (see `maxForce`). */
    lavaForce: 6,
    rockfallTimeMax: 240,
    hitsMax: 3,
    hitsTimerMax: 30,
    /**
     * ⛔ `Enemy`'s default, and the ctor never assigns it — so the FIRST
     * shove is unclamped and every later one is capped at 2. The self-hit
     * sets it to -1 immediately before and 2 immediately after, so a lava
     * hit is ALWAYS force 6 (§16.8's own correction to §8.5).
     */
    maxForceInitial: -1,
    maxForceAfterFirstLavaHit: 2,
    /** `const podPositions` — ENTITY points, already `+Tile/2` in `Pod`'s ctor. */
    podPositions: Object.freeze([
        Object.freeze({ x: 120, y: 56 }),
        Object.freeze({ x: 48, y: 128 }),
        Object.freeze({ x: 120, y: 200 }),
        Object.freeze({ x: 192, y: 128 }),
    ]),
    /**
     * `hit(lavaForce, new Point(FP.width / 2, (FP.height - Tile.h) / 2), …)`
     * with `FP.width`/`FP.height` the LEVEL's 240 (`Game.as:1855`), NOT the
     * 160x160 screen — the same trap `camera.js` documents. ⇒ (120, 112).
     */
    lavaKnockFrom: Object.freeze({ x: 120, y: 112 }),
    /** `Mobile.DEFAULT_FRICTION`; the class never overrides `f`. */
    friction: 0.25,
    /** `if (v.length > 4) v.normalize(4)`, AFTER the lava arm, BEFORE the phases. */
    velocityCap: 4,
    /** `Player.as:116` — the force each of a press's five tests adds. */
    swordForce: 5,
    /** `Scenery/Tile.as` — lava's `t`. */
    lavaT: 17,
});

/** `Mobile.solids` — the list the Owl inherits and never changes. */
export const FINAL_BOSS_SOLIDS = Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']);

// ── THE TILE SELECTION ────────────────────────────────────────────────

/**
 * `Entity.collide("Tile", x, y)` — the FIRST overlapping tile in WORLD order.
 *
 * ⛔⛔ WORLD ORDER IS THE REVERSE OF THE `.oel`'s. `World.addType` prepends
 * (`net/flashpunk/World.as:1016-1031`), `Game.loadlevel` adds tiles in file
 * order, and the extract keeps that order in `world.tiles` — so the walk is
 * `tiles` from the END. Transcribed rather than approximated because the
 * WEAKER question ("does the box overlap any lava cell") is an upper bound
 * on how often the game's test fires, which is what §8.5 measured. → trap 95
 *
 * @param {object[]} tiles `buildLevelWorld(...).tiles`, in `.oel` order
 * @param {{x,y,right,bottom}} box the mover's box in world pixels
 */
export function firstTileUnder(tiles, box) {
    for (let i = tiles.length - 1; i >= 0; i -= 1) {
        const t = tiles[i];
        const r = t.rect;
        if (box.right > r.x && box.bottom > r.y && box.x < r.right && box.y < r.bottom) {
            return t;
        }
    }
    return null;
}

/** The Owl's 12x12 box at an entity point. */
export function finalBossBox(x, y) {
    const { w, h, ox, oy } = FINAL_BOSS.box;
    return { x: x - ox, y: y - oy, right: x - ox + w, bottom: y - oy + h };
}

/**
 * Is the Owl on lava at `(x, y)` — and is the answer ORDER-INDEPENDENT?
 *
 * `hit` is the game's own predicate. `wholly` is the stronger one a plan
 * should aim for: every tile the box overlaps is lava, so the verdict does
 * not depend on `.oel` line order at all. `touching` is §8.5's weaker
 * geometric question, kept so the three can be compared rather than
 * conflated.
 */
export function finalBossLavaVerdict(tiles, x, y) {
    const box = finalBossBox(x, y);
    const overlapped = tiles.filter((t) => {
        const r = t.rect;
        return box.right > r.x && box.bottom > r.y && box.x < r.right && box.y < r.bottom;
    });
    const first = firstTileUnder(tiles, box);
    return {
        hit: !!first && first.t === FINAL_BOSS.lavaT,
        wholly: overlapped.length > 0 && overlapped.every((t) => t.t === FINAL_BOSS.lavaT),
        touching: overlapped.some((t) => t.t === FINAL_BOSS.lavaT),
        firstT: first ? first.t : null,
        overlapped: overlapped.length,
    };
}

// ── THE BOSS ──────────────────────────────────────────────────────────

/**
 * One Owl, at his constructed entity point.
 *
 * `rockfallTime` starts at -1 (the walk arm), `cpod` at 0, `hitThisSequence`
 * false, `started` false — the intro owns the room until an X release.
 */
export function createFinalBoss({ id = 'finalboss', x, y, tag = -1 } = {}) {
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new FinalBossError('createFinalBoss needs the entity point (x, y)');
    }
    return {
        id,
        tag,
        x,
        y,
        vx: 0,
        vy: 0,
        started: false,
        rockfallTime: -1,
        cpod: 0,
        hitThisSequence: false,
        hits: 0,
        hitsTimer: 0,
        maxForce: FINAL_BOSS.maxForceInitial,
        /** `canHit` is assigned LATE in `update()`, so the lava arm reads LAST tick's. */
        canHit: true,
        destroy: false,
        solid: false,
        anim: '',
        /** Ticks since the current anim's first update, or null when there is none. */
        animAge: null,
        /** Set once `endAnim`'s "dead" arm has run: the tags are written. */
        tagsWritten: false,
        lavaHits: [],
    };
}

/** `|v|`. */
const speed = (b) => Math.hypot(b.vx, b.vy);

/** `Point.normalize(l)` — a no-op on a zero vector, as AS3's is. */
function normalize(b, l) {
    const s = speed(b);
    if (s === 0) return;
    b.vx = (b.vx / s) * l;
    b.vy = (b.vy / s) * l;
}

/**
 * `Enemy.knockback(f, p)` — away from `p`, along the ray through the body.
 *
 * ⛓ VECTOR ADDITION, not assignment, and the angle is recomputed per hit:
 * five tests against a STANDING player are collinear (he recedes along the
 * ray), which is what makes one press worth ~5f and not something between
 * f and 5f.
 */
export function finalBossKnockback(b, f, px, py) {
    const a = Math.atan2(b.y - py, b.x - px);
    b.vx += f * Math.cos(a);
    b.vy += f * Math.sin(a);
}

/**
 * `Mobile.moveX`/`moveY` — a pixel at a time, stopping at the first solid.
 *
 * @param {(x:number,y:number)=>boolean} solidAt does the box at (x,y) hit a solid?
 */
function moveAxis(b, axis, rel, solidAt) {
    const n = Math.abs(rel);
    const sign = Math.sign(rel);
    if (sign === 0) return;
    for (let i = 0; i < n; i += 1) {
        const d = Math.min(1, n - i) * sign;
        const nx = axis === 'x' ? b.x + d : b.x;
        const ny = axis === 'y' ? b.y + d : b.y;
        if (solidAt(nx, ny)) return;
        b.x = nx;
        b.y = ny;
    }
}

/**
 * `Enemy.hit(f, p, d, t)` for the Owl, both arms.
 *
 * `t === 'Lava'` matches `onlyHitBy` and takes the DAMAGE arm (which is also
 * the only path to `startDeath`); anything else falls to `justKnock` and only
 * shoves. Returns what happened, so a ledger can record a refusal as a
 * refusal rather than as a missing event.
 */
export function finalBossHit(b, { force, fromX, fromY, type }) {
    const clamped = b.maxForce >= 0 ? Math.min(force, b.maxForce) : force;
    if (!(b.hitsTimer <= 0) || !b.canHit) {
        return { landed: false, why: !b.canHit ? 'canHit is false — a barrage is running'
            : `hitsTimer is ${b.hitsTimer}`, force: clamped };
    }
    if (type === 'Lava') {
        b.hits += 1;
        b.hitsTimer = FINAL_BOSS.hitsTimerMax;
        if (b.hits >= FINAL_BOSS.hitsMax) {
            return { landed: true, damaged: true, killed: true, force: clamped };
        }
        finalBossKnockback(b, clamped, fromX, fromY);
        return { landed: true, damaged: true, killed: false, force: clamped };
    }
    // `justKnock` — no timer, no cap of its own, so all five tests compound.
    finalBossKnockback(b, clamped, fromX, fromY);
    return { landed: true, damaged: false, killed: false, force: clamped };
}

/** `startDeath`: the corpse becomes a Solid and the die anim starts. */
function startDeath(b) {
    b.solid = true;
    b.anim = 'die';
    b.animAge = 0;
    b.destroy = true;
}

/**
 * One `FinalBoss.update()`, in the game's own order.
 *
 * ⚠ THE PLAYER UPDATES AFTER HIM. `Game.loadlevel` adds the Player at
 * `:2101` and the boss at `:2135`, and `addUpdate` PREPENDS, so the boss is
 * earlier in the update list — every position this reads is the player's from
 * the END OF THE PREVIOUS TICK, and every sword hit the player deals lands
 * AFTER this returns.
 *
 * @param {object} b the boss
 * @param {object} ctx
 * @param {boolean} ctx.frozen `Game.freezeObjects` as of this point in the frame
 * @param {{x,y,vx,vy}} ctx.player the player as the boss sees them
 * @param {(x:number,y:number)=>boolean} ctx.solidAt
 * @param {(x:number,y:number)=>object|null} ctx.firstTileAt
 * @param {OwlDrawStream} ctx.stream
 * @param {(argX:number, argY:number, scale:number)=>void} ctx.spawnRock
 * @param {(x:number, y:number)=>void} ctx.spawnGrenade
 * @param {object[]} ctx.pods the four `Pod` states, in `podPositions` order
 * @param {boolean} ctx.introRelease did the boss see `Input.released(keys[6])`?
 *
 * ⛔⛔ AND THE TICK THAT IS TRUE ON IS **THE SPAN'S `from`**, MEASURED.
 * A length-1 `primary` span is documented as a press edge on `from` and a
 * release edge on `to`, so the intro was expected to end on `to`. The game
 * says otherwise, twice and unambiguously — the boss's POSITION is a
 * lattice of 0.5303 px steps and it reports one step MORE than a release on
 * `to` allows, at both a span at tick 2 and a span at tick 10
 * (`probe-seedling-r6-owl-rng.mjs`). Position carries no poll-latency drift,
 * so this is not a counting artefact.
 * ⇒ this model's callers pass `t === span.from`, as MEASURED, and the
 * mechanism is a ⚠ open question for `R6_AS3_DECISION`: either `Bot`
 * delivers a length-1 span's release inside its own tick, or the recompiled
 * runtime's `Input.released` is true on the frame of the down edge. No
 * committed fixture can tell the two apart, because every other release on
 * the ladder is inside a dialogue where only the COUNT is observable.
 */
export function stepFinalBoss(b, ctx) {
    const {
        frozen, player, solidAt, firstTileAt, stream, spawnRock, spawnGrenade, pods,
        introRelease = false,
    } = ctx;
    const events = [];
    let introFreeze = false;
    /**
     * ⛓⛓⛓ R6 SLICE 6f: WHICH ROW OF `OWL_PHASE_SITES` THIS TICK TOOK.
     *
     * Reported rather than re-derived by the caller, because the caller cannot
     * see the arm: the walk/coast split is `v.length <= moveSpeed` measured
     * AFTER friction, the move and the cap, and a consumer that tested the
     * boss's speed before or after the step would get the other answer part
     * of the time. `levelRun` asserts `owlTickDraws(phase, shaking)` against
     * the stream's own delta on every tick, which is the
     * one-table-two-computations law applied to a draw schedule.
     */
    let phase = 'frozen';

    // ── `if (!started)` — the intro (§16.5's `entry:` disposition) ──────
    //
    // ⛓ IT IS A `Game.talking` FREEZE, so its frames are TAPE TICKS and not
    // dead frames: `canInventory()` is `… && !talking && …`, and the
    // else-arm `inventory.open = false` IS `Game.freezeObjects = false`
    // (trap 102/106). The freeze is re-raised here at the top of every frame,
    // above the player's own update, so the player cannot move — and the
    // tick counter advances anyway.
    if (!b.started) {
        introFreeze = true;
        phase = 'intro';
        if (introRelease) {
            b.started = true;
            introFreeze = false;
            events.push({ what: 'introEnded' });
        }
    }

    // ── `super.update()` — Enemy.update -> Mobile.mobileUpdate ─────────
    //
    // `activeOffScreen = true`, so the camera gate never fires; `dieInWater`,
    // `dieInLava` and `canFallInPit` are all false, so the terrain switch is
    // inert for him. What is left is friction, the two moves, and the timer.
    const worldFrozen = frozen || introFreeze;
    if (!b.destroy) {
        if (!worldFrozen) {
            normalize(b, Math.max(speed(b) - FINAL_BOSS.friction, 0));
            if (Math.abs(b.vx) < 0.05) b.vx = 0;
            if (Math.abs(b.vy) < 0.05) b.vy = 0;
            moveAxis(b, 'x', b.vx, solidAt);
            moveAxis(b, 'y', b.vy, solidAt);
        }
        // `hitUpdate()` — the i-frame drain, below the move and inside the
        // `!destroy` arm. ⚠ NOT freeze-gated: `Enemy.update` calls it after
        // `mobileUpdate`, which is where the freeze test lives.
        if (b.hitsTimer > 0) b.hitsTimer -= 1;
    }

    if (worldFrozen || b.destroy) {
        return { events, introFreeze, phase: introFreeze ? 'intro' : 'frozen' };
    }

    // ── the lava self-hit, ABOVE the cap and ABOVE `canHit`'s assignment ──
    const tile = firstTileAt(b.x, b.y);
    if (tile && tile.t === FINAL_BOSS.lavaT && !b.hitThisSequence) {
        b.maxForce = FINAL_BOSS.maxForceInitial;
        const r = finalBossHit(b, {
            force: FINAL_BOSS.lavaForce,
            fromX: FINAL_BOSS.lavaKnockFrom.x,
            fromY: FINAL_BOSS.lavaKnockFrom.y,
            type: 'Lava',
        });
        b.maxForce = FINAL_BOSS.maxForceAfterFirstLavaHit;
        b.hitThisSequence = true;
        if (r.killed) startDeath(b);
        b.lavaHits.push({ x: b.x, y: b.y, hits: b.hits, landed: r.landed, why: r.why ?? null });
        events.push({ what: 'lava', landed: r.landed, hits: b.hits, killed: !!r.killed,
            why: r.why ?? null, x: b.x, y: b.y });
        // ⛔ THE ARM RETURNS. No cap, no `canHit`, no phase — the tick costs
        // the draw stream nothing at all.
        return { events, introFreeze, phase: 'lavaHit' };
    }

    if (speed(b) > FINAL_BOSS.velocityCap) normalize(b, FINAL_BOSS.velocityCap);

    b.canHit = b.rockfallTime < 0;

    if (b.rockfallTime > 0) {
        phase = 'barrage';
        b.rockfallTime -= 1;
        // `sprFinalBoss.play("")` — an unknown anim name, so `_anim` is null
        // and `complete` is true: no updates, no callbacks, no draws.
        b.anim = '';
        b.animAge = null;
        if (stream.barrageRoll()) {
            phase = 'barrageSpawn';
            const argX = stream.spawnX(player.x, player.vx);
            const argY = stream.spawnY(player.y, player.vy);
            const scale = stream.rockScale();
            spawnRock(argX, argY, scale);
            events.push({ what: 'rock', argX, argY, scale });
        }
    } else if (b.rockfallTime === 0) {
        phase = 'podTick';
        pods[b.cpod].open = true;
        b.cpod = (b.cpod + 1 + pods.length) % pods.length;
        b.hitThisSequence = false;
        b.rockfallTime -= 1;
        events.push({ what: 'barrageEnded', nextPod: b.cpod });
    } else if (speed(b) <= FINAL_BOSS.moveSpeed) {
        phase = 'walk';
        if (stream.grenadeRoll()) {
            // `new Grenade(x - 8, y - 8, true, 30)` — and `Enemy`'s field
            // initializer draws once more inside the constructor.
            phase = 'walkGrenade';
            stream.enemyCoins();
            spawnGrenade(b.x - 8, b.y - 8);
            events.push({ what: 'grenade', x: b.x - 8, y: b.y - 8 });
        }
        const target = FINAL_BOSS.podPositions[b.cpod];
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const l = Math.hypot(dx, dy);
        if (l !== 0) {
            b.vx = (dx / l) * FINAL_BOSS.moveSpeed;
            b.vy = (dy / l) * FINAL_BOSS.moveSpeed;
        }
        b.anim = 'walk';
        // `collide("Pod", x, y)` then `pod == pods[cpod]` — the pods are
        // 16x16 about their entity points, so this is a box test.
        const pod = pods.find((p) => {
            const box = finalBossBox(b.x, b.y);
            return box.right > p.x - 8 && box.bottom > p.y - 8
                && box.x < p.x + 8 && box.y < p.y + 8;
        });
        if (pod && pod === pods[b.cpod]) {
            if (!pod.open) pod.open = true;
            if (Math.hypot(b.x - pod.x, b.y - pod.y) <= speed(b) * 2) {
                b.x = pod.x;
                b.y = pod.y + 1;
                b.rockfallTime = FINAL_BOSS.rockfallTimeMax;
                pod.open = false;
                events.push({ what: 'barrageBegan', pod: b.cpod });
            }
        }
    } else {
        // ⛓ THE COAST ROW: `v.length > moveSpeed` while shoved takes NO arm at
        // all, so an 18-tick coast costs the stream nothing from him. That is
        // what makes the shove window modellable. It is an explicit `else`
        // rather than a fall-through so the PHASE can be named: "no arm ran"
        // and "the walk arm ran and rolled no grenade" both cost one draw
        // less than the other, and a schedule that could not tell them apart
        // would be exactly one draw wrong for eighteen ticks after every
        // press.
        phase = 'coast';
    }

    return { events, introFreeze, phase };
}

/**
 * ⛓⛓ The graphic, which is NOT the entity and NOT freeze-gated.
 *
 * `World.update`'s `if (e._graphic && e._graphic.active) e._graphic.update()`
 * runs for every entity in the list regardless of `e.active`, and
 * `Game.update` gates only `super.update()` on `blackCover`. So the die/dead
 * chain advances on ticks the boss himself returns early from — which is
 * every tick after `startDeath`, since `destroy` is set.
 *
 * Returns the events the callbacks fire.
 */
export function advanceFinalBossGraphic(b) {
    const events = [];
    if (b.animAge === null || !FINAL_BOSS_ANIMS[b.anim]) return events;
    b.animAge += 1;
    const need = FINAL_BOSS_ANIM_UPDATES[b.anim];
    if (!Number.isFinite(need) || b.animAge < need) return events;
    // `endAnim()` — the switch, arm by arm.
    if (b.anim === 'walk') {
        b.anim = '';
        b.animAge = null;
    } else if (b.anim === 'die') {
        b.anim = 'dead';
        b.animAge = 0;
        events.push({ what: 'dieAnimEnded' });
    } else if (b.anim === 'dead') {
        b.anim = 'deadframe';
        b.animAge = null;
        b.tagsWritten = true;
        events.push({ what: 'deadAnimEnded' });
    }
    return events;
}

/**
 * The two fenceposts between the third lava hit and `{112,0}`/`{112,1}`.
 *
 * ⛔ §8.6 prices it "49 + 61 = 110 updates after the third lava hit". Both
 * halves are off by one in the SAME direction and for the SAME reason
 * (trap 104): `play("die")` happens inside `update()`, so the die anim's
 * first advance is that very tick and its callback lands on `49 - 1 = 48`
 * ticks later; `play("dead")` happens inside the die callback, which is
 * inside the graphic's own update, so the dead anim's `_timer` is reset to 0
 * AFTER this tick's advance and its first advance is the NEXT tick — its
 * callback lands `61` ticks after that, i.e. `48 + 1 + 60`.
 *
 * ⇒ **109, not 110** — derived, and left for the recording to arbitrate,
 * which is what §17.4 did to the door.
 */
export function finalBossDeathSchedule(killTick) {
    const die = FINAL_BOSS_ANIM_UPDATES.die;
    const dead = FINAL_BOSS_ANIM_UPDATES.dead;
    const dieEndsAt = killTick + (die - 1);
    const deadEndsAt = dieEndsAt + dead;
    return {
        killTick,
        dieUpdates: die,
        deadUpdates: dead,
        dieEndsAt,
        /** The tick `endAnim`'s "dead" arm runs: five rocks and BOTH tags. */
        tagTick: deadEndsAt,
        ticksFromKill: deadEndsAt - killTick,
    };
}

// ── THE ROCKS ─────────────────────────────────────────────────────────

/** `Scenery/RockFall.as` constants. */
export const ROCK_FALL = Object.freeze({
    fallHeight: 96,
    gravity: 0.05,
    startingSpeed: 6,
    /** `p.hit(null, force, new Point(x, y), damage)` on the landing tick. */
    force: 3,
    damage: 1,
});

/**
 * `new RockFall(_x:int, _y:int)` — and BOTH parameters truncate (trap 108).
 *
 * ⛔ THE HITBOX IS A DRAW, AND IT IS TRUNCATED TWICE. `setHitbox` takes ints,
 * so `32 * scale` with scale in [0.25, 0.75) gives a WIDTH of 8..23 and a
 * height of 4..11; then the second `setHitbox(width, height, width / 2,
 * -scale * 32 / 2 + height)` re-derives the origins from the already-truncated
 * width and height. Both calls are transcribed, in order, because the second
 * reads what the first wrote.
 */
export function createRockFall(argX, argY, scale, { id = null } = {}) {
    const x = as3Int(argX);
    const goto = as3Int(argY);
    const width = as3Int(32 * scale);
    const height = as3Int(16 * scale);
    // `sprRockFall.height` is the FRAME height, 32 — not the hitbox's.
    const originX = as3Int(width / 2);
    const originY = as3Int(-scale * 32 / 2 + height);
    return {
        id,
        x,
        y: goto - ROCK_FALL.fallHeight,
        goto,
        vy: ROCK_FALL.startingSpeed,
        g: ROCK_FALL.gravity,
        scale,
        width,
        height,
        originX,
        originY,
        landed: false,
        landedAt: null,
        anim: null,
        animAge: null,
        removeRequested: false,
    };
}

/** The rock's collision box once it has landed (and while it falls). */
export function rockFallBox(r) {
    return {
        x: r.x - r.originX,
        y: r.y - r.originY,
        right: r.x - r.originX + r.width,
        bottom: r.y - r.originY + r.height,
    };
}

/**
 * One `RockFall.update()`.
 *
 * ⛓ `added()` sets `solids = []` BEFORE and AFTER its own test, so the fall
 * collides with nothing and the landing tick is a pure function of the
 * constants: `y` advances by `v.y` each tick and `v.y` grows by 0.05, so
 * `6n + 0.025n(n-1) > 96` first holds at **n = 16** for every rock ever
 * spawned, whatever its scale or where it was aimed.
 *
 * @returns {{landed: boolean, shake: number}} `shake` is `scale + 1` on the
 *   landing tick and 0 otherwise — the feedback term §16.8 names.
 */
export function stepRockFall(r) {
    if (r.removeRequested) return { landed: false, shake: 0 };
    if (!r.landed) {
        r.vy += r.g;
        r.y += r.vy;
        if (r.y > r.goto) {
            r.vy = 0;
            r.g = 0;
            r.y = r.goto;
            r.landed = true;
            r.anim = 'break';
            r.animAge = 0;
            return { landed: true, shake: r.scale + 1 };
        }
        return { landed: false, shake: 0 };
    }
    return { landed: false, shake: 0 };
}

/** The break animation, on the graphic side; its callback removes the rock. */
export function advanceRockFallGraphic(r) {
    if (r.anim !== 'break' || r.animAge === null) return false;
    r.animAge += 1;
    if (r.animAge < ROCKFALL_BREAK_UPDATES) return false;
    r.removeRequested = true;
    r.anim = null;
    r.animAge = null;
    return true;
}

/**
 * How many ticks after its spawn tick does a rock land?
 *
 * Derived rather than written down: the rock is added through
 * `FP.world.add`, which QUEUES — so its first update is the tick AFTER the
 * boss created it, and the landing is 16 updates after that.
 */
export function rockFallUpdatesToLand() {
    let y = -ROCK_FALL.fallHeight;
    let vy = ROCK_FALL.startingSpeed;
    for (let n = 1; n <= 1000; n += 1) {
        vy += ROCK_FALL.gravity;
        y += vy;
        if (y > 0) return n;
    }
    throw new FinalBossError('rockFallUpdatesToLand: the rock never landed');
}

// ── THE GRENADES ──────────────────────────────────────────────────────

/**
 * `Enemies/Grenade.as`, as the Owl builds it: `new Grenade(x - 8, y - 8,
 * true, 30)`.
 *
 * ⛓ THE TWO HALF-TILES CANCEL AND THE `fallHeight` DOES NOT.
 * `super(_x + Tile.w/2, _y + Tile.h/2 - fallHeight)` with `_x = bossX - 8`
 * puts the entity at `bossX`, and `endY = _y + Tile.h/2` is `bossY` — so a
 * grenade is born at the Owl's exact entity point. `_active = true` then
 * assigns `y = endY` in the constructor, so it never falls at all and the
 * whole `y < endY` half of `update()` is dead for this call site.
 *
 * ⛔⛔ AND `Grenade.update` DOES NOT CALL `super.update()`. It calls
 * `mobileUpdate()` directly, so `Enemy.update`'s tail — `hitUpdate()` and
 * **`hitPlayer()`** — never runs: a grenade has NO contact damage at all.
 * Its only damage is `animEnd`'s radius test, once, at the end of the
 * explode animation. A model that inherited the base class's contact would
 * charge the player for standing on one.
 *
 * ⛓ `hit()` is an empty override and `knockback()` is too, so a sword press
 * that reaches one is a real no-op (`PRESS_UNKILLABLE.Grenade`).
 */
export const GRENADE = Object.freeze({
    as3: 'Enemies/Grenade.as',
    /** `_exTime` — the Owl passes 30, not the class default 60. */
    explodeTime: 30,
    /** `const hitRadius:int = 20` — entity-point to entity-point. */
    hitRadius: 20,
    /** `const force:int = 2`, `damage = 1`. */
    force: 2,
    damage: 1,
    /** `setHitbox(6, 6, 3, 3)`. Never used for damage; it is what a slash collects. */
    box: Object.freeze({ w: 6, h: 6, ox: 3, oy: 3 }),
});

/** One grenade at the Owl's entity point, already on the ground. */
export function createOwlGrenade(x, y, { id = null } = {}) {
    return {
        id,
        x,
        // `endY`, which `_active` has already assigned to `y`.
        y,
        explodeTime: GRENADE.explodeTime,
        anim: 'sit',
        animAge: 0,
        exploded: false,
        removeRequested: false,
    };
}

/** The grenade's 6x6 box — what `Player.slash`'s `"Enemy"` sweep collects. */
export function owlGrenadeBox(g) {
    const { w, h, ox, oy } = GRENADE.box;
    return { x: g.x - ox, y: g.y - oy, right: g.x - ox + w, bottom: g.y - oy + h };
}

/**
 * One `Grenade.update()` — the countdown, and the `play("explode")` that
 * ends it.
 *
 * ⚠ NOT FREEZE-GATED IN THE PLACE YOU WOULD LOOK. The countdown sits above
 * `mobileUpdate()`, which is where the freeze test lives — so
 * `explodeTime` drains through a frozen frame and the explosion keeps its
 * schedule. (In L112 the only freeze is the intro, which is over before any
 * grenade exists, so this is a bounded vacuity with its bound named.)
 */
export function stepOwlGrenade(g) {
    if (g.removeRequested) return { played: false };
    if (g.explodeTime > 0) {
        g.explodeTime -= 1;
        return { played: false };
    }
    if (g.explodeTime === 0) {
        g.explodeTime = -1;
        g.anim = 'explode';
        g.animAge = 0;
        return { played: true };
    }
    return { played: false };
}

/**
 * The grenade's graphic, and BOTH of trap 104's directions in one entity.
 *
 * `play("explode")` happens inside `update()`, so its first advance is that
 * same tick and the callback lands `21 - 1 = 20` ticks later.
 * `play("hit")` happens inside that CALLBACK — i.e. inside the graphic's own
 * update — so `_timer` is reset after this tick's advance and the `hit`
 * anim's first advance is the NEXT tick: its callback is a full 8 later.
 *
 * @returns {?'exploded'|'removed'} the callback that fired, if any
 */
export function advanceOwlGrenadeGraphic(g) {
    if (g.animAge === null) return null;
    g.animAge += 1;
    if (g.anim === 'explode' && g.animAge >= GRENADE_EXPLODE_UPDATES) {
        g.anim = 'hit';
        g.animAge = 0;
        g.exploded = true;
        return 'exploded';
    }
    if (g.anim === 'hit' && g.animAge >= GRENADE_HIT_UPDATES) {
        g.anim = null;
        g.animAge = null;
        g.removeRequested = true;
        return 'removed';
    }
    return null;
}

/** `FP.distance(x, endY, p.x, p.y) <= hitRadius` — entity point to entity point. */
export function owlGrenadeReaches(g, px, py) {
    return Math.hypot(g.x - px, g.y - py) <= GRENADE.hitRadius;
}

// ── THE PODS ──────────────────────────────────────────────────────────

/**
 * A `Pod`'s animation state — which is what the PIN gates on.
 *
 * ⛔ `Pod.update`'s teleport arm is `sprPod.currentAnim == "closed"`, and
 * "closed" is 22 updates after `open = false` plays "close". A plan that
 * treats a closing pod as already lethal over-avoids by 22 ticks; one that
 * treats it as safe is 22 ticks late. Both directions matter (`R6_ANIM_CLOCKS`
 * carries both rows for exactly this reason).
 */
export function createPod({ id = null, x, y } = {}) {
    return { id, x, y, anim: 'open', animAge: 0, _open: true };
}

/** The `open` setter — it PLAYS an animation, it does not set a state. */
export function setPodOpen(p, value) {
    const name = value ? 'open' : 'close';
    if (p.anim === name) return;
    p.anim = name;
    p.animAge = 0;
}

/** `Pod.animEnd` — "open" -> "opened", "close" -> "closed". */
export function advancePodGraphic(p) {
    if (p.animAge === null) return null;
    p.animAge += 1;
    const need = (p.anim === 'open' || p.anim === 'close')
        ? POD_OPEN_UPDATES : animCallbackUpdates(10, 1);
    if (p.animAge < need) return null;
    p.animAge = 0;
    if (p.anim === 'open') { p.anim = 'opened'; return 'opened'; }
    if (p.anim === 'close') { p.anim = 'closed'; return 'closed'; }
    return null;
}

/** `Pod.open` (the GETTER) — "open" or "opened", nothing else. */
export const podIsOpen = (p) => p.anim === 'open' || p.anim === 'opened';
/** The pin is live only on "closed" — the terminal, not the transition. */
export const podIsLethal = (p) => p.anim === 'closed';

// ── THE SHOVE ─────────────────────────────────────────────────────────

/**
 * The whole trajectory of one sword press, on the real loop.
 *
 * ⛔ DERIVED, NOT QUOTED. §14.4's table gives 71.25 px over 18 ticks; this
 * steps `friction -> move -> cap` with the five hit tests landing at the END
 * of ticks `pressTick .. pressTick + 4` (the player updates LAST), against a
 * STANDING player at `(px, py)`. The five tests are collinear because the
 * body recedes along the ray it is pushed down, so the press is worth ~5f —
 * but the arithmetic is done rather than assumed, because a MOVING player
 * breaks the collinearity and the same function answers that case too.
 *
 * @returns {{steps: {t,x,y,speed,step}[], total: number, ticks: number}}
 */
export function finalBossCoast({
    x, y, px, py, force = FINAL_BOSS.swordForce, maxForce = FINAL_BOSS.maxForceInitial,
    hits = 5, solidAt = () => false, maxTicks = 200,
} = {}) {
    const b = { x, y, vx: 0, vy: 0 };
    const steps = [];
    let total = 0;
    for (let t = 0; t < maxTicks; t += 1) {
        const before = { x: b.x, y: b.y };
        normalize(b, Math.max(speed(b) - FINAL_BOSS.friction, 0));
        if (Math.abs(b.vx) < 0.05) b.vx = 0;
        if (Math.abs(b.vy) < 0.05) b.vy = 0;
        moveAxis(b, 'x', b.vx, solidAt);
        moveAxis(b, 'y', b.vy, solidAt);
        const stepped = Math.hypot(b.x - before.x, b.y - before.y);
        total += stepped;
        if (speed(b) > FINAL_BOSS.velocityCap) normalize(b, FINAL_BOSS.velocityCap);
        const post = speed(b);
        steps.push({ t, x: b.x, y: b.y, speed: post, step: stepped });
        // The player's own update, at the end of the tick.
        if (t < hits) {
            const f = maxForce >= 0 ? Math.min(force, maxForce) : force;
            finalBossKnockback(b, f, px, py);
        } else if (post <= FINAL_BOSS.moveSpeed) {
            // `v.length <= moveSpeed` — he re-aims and the coast is over.
            return { steps, total, ticks: t + 1 };
        }
    }
    throw new FinalBossError('finalBossCoast: the Owl never came back to rest');
}

// ── THE ROOM ──────────────────────────────────────────────────────────

/**
 * The whole of L112's stateful side, as one object, so the draw ORDER is in
 * one place instead of spread across a caller.
 *
 * ⛓⛓ THE ORDER IS THE CLAIM, and it is `Main.update`'s:
 *
 *   1. `World.update` walks `_updateFirst` forward. `addUpdate` PREPENDS, so
 *      newest first: the runtime rocks and grenades, then the pods, the
 *      teleporters, the orb, the rocklock, **the FinalBoss**, and the Player
 *      LAST. Each entity's `update()` is immediately followed by its own
 *      `_graphic.update()` in the same pass — which is trap 104's whole
 *      mechanism and why the death arm's five rocks draw in the boss's slot.
 *   2. `view()` — the jiggle, 2 draws whenever `shake > 0`, then the
 *      one-per-FRAME decay.
 *   3. `updateLists()` — the queued adds and removes land, which is why a
 *      rock's first update is the tick AFTER the boss made it.
 *
 * ⇒ every tick's draws are `[the boss's, if any] ++ [the jiggle's, if any]`,
 * and nothing else in this room can get between them.
 */
export function createOwlRoom({ tiles, seed, bossX = 72, bossY = 104, tag = 0,
    solidAt = null, shake = 0 } = {}) {
    if (!Array.isArray(tiles)) {
        throw new FinalBossError('createOwlRoom needs the level\'s `tiles`, in .oel order');
    }
    const solid = solidAt ?? ((x, y) => {
        const box = finalBossBox(x, y);
        for (let i = tiles.length - 1; i >= 0; i -= 1) {
            const t = tiles[i];
            if (t.entityType !== 'Solid') continue;
            const r = t.rect;
            if (box.right > r.x && box.bottom > r.y && box.x < r.right && box.y < r.bottom) {
                return true;
            }
        }
        return false;
    });
    const stream = new OwlDrawStream(seed);
    // ⛔ THE ROOM'S OWN CONSTRUCTION IS ON THE SEEDED STREAM. `Game.begin()`
    // is where `loadlevel` lives and it runs AFTER `Bot.botStart` reseeded,
    // so the two gameplay ctor draws L112 makes come first, in add order.
    // See `finalBossRng.OWL_LEVEL_BUILD_DRAWS` for the derivation and for
    // the shipped comment it corrects.
    stream.levelBuild();
    return {
        tiles,
        stream,
        boss: createFinalBoss({ x: bossX, y: bossY, tag }),
        pods: FINAL_BOSS.podPositions.map((p, i) => createPod({ id: `pod${i}`, x: p.x, y: p.y })),
        rocks: [],
        grenades: [],
        pendingRocks: [],
        pendingGrenades: [],
        /**
         * ⚠ A `public static` THAT SURVIVES A WORLD SWAP (`Game.as:538`).
         * A fresh page starts it at 0 and nothing in the title screen writes
         * it, which is the standing precondition `r6Acceptance`'s RNG-posture
         * note names and this field makes explicit rather than assumed.
         */
        shake,
        solidAt: solid,
        ticks: 0,
        events: [],
    };
}

/**
 * One frame of L112, in the order above.
 *
 * @param {object} room from `createOwlRoom`
 * @param {object} ctx
 * @param {{x,y,vx,vy}} ctx.player where the player was at the END of last tick
 * @param {boolean} ctx.introRelease was `primary` released this frame?
 * @param {boolean} ctx.frozen a freeze from something other than the intro
 * @param {number} ctx.playerShake what the player's own `hit` added this frame
 *   (`Game.shake += 5`, suppressed entirely by `Bot.noDamage`)
 */
export function stepOwlRoom(room, ctx = {}) {
    const { player = { x: 40, y: 216, vx: 0, vy: 0 }, introRelease = false,
        frozen = false, playerShake = 0 } = ctx;
    const t = room.ticks;
    const out = { t, events: [], drawsBefore: room.stream.count, landings: [] };

    // 1a. the rocks (newest first — the order is irrelevant to the stream,
    //     since a rock draws nothing, and is kept because the SHAKE it adds
    //     is read by `view()` at the end of this same frame).
    if (!frozen) {
        for (const r of room.rocks) {
            const res = stepRockFall(r);
            if (res.landed) {
                room.shake += res.shake;
                out.landings.push({ id: r.id, x: r.x, y: r.y, box: rockFallBox(r) });
            }
            advanceRockFallGraphic(r);
        }
    } else {
        // `Mobile.mobileUpdate` skips friction/input/move while frozen, but
        // the GRAPHIC is never freeze-gated — the break anim keeps running.
        for (const r of room.rocks) advanceRockFallGraphic(r);
    }

    // 1b. the pods' graphics (`Pod.update`'s own body is a pin, priced by
    //     `hazards.js`; what the boss reads is the ANIMATION).
    for (const p of room.pods) advancePodGraphic(p);

    // 1c. the boss, then his graphic — one pass, both calls.
    const step = stepFinalBoss(room.boss, {
        frozen,
        player,
        solidAt: room.solidAt,
        firstTileAt: (x, y) => firstTileUnder(room.tiles, finalBossBox(x, y)),
        stream: room.stream,
        spawnRock: (argX, argY, scale) => room.pendingRocks.push(
            createRockFall(argX, argY, scale, { id: `rock@${t}` })),
        spawnGrenade: (x, y) => room.pendingGrenades.push({ id: `grenade@${t}`, x, y }),
        pods: room.pods.map((p, i) => ({
            get open() { return podIsOpen(p); },
            set open(v) { setPodOpen(p, v); },
            x: FINAL_BOSS.podPositions[i].x,
            y: FINAL_BOSS.podPositions[i].y,
            _pod: p,
        })),
        introRelease,
    });
    out.events.push(...step.events);
    out.introFreeze = step.introFreeze;
    for (const e of advanceFinalBossGraphic(room.boss)) {
        out.events.push(e);
        if (e.what === 'deadAnimEnded') {
            // `endAnim`'s "dead" arm: five rocks, then `Button.activateAll`,
            // then BOTH persistence writes. The rocks are the draws.
            for (let i = 0; i < 5; i += 1) {
                const argX = room.stream.deathRockX();
                const scale = room.stream.rockScale();
                room.pendingRocks.push(createRockFall(argX, (i / 5) * 32, scale,
                    { id: `deathrock${i}@${t}` }));
            }
            out.events.push({ what: 'tagsWritten', tags: [room.boss.tag, room.boss.tag + 1] });
        }
    }

    // 1d. the Player would update here. The caller owns it; what this model
    //     needs from it is `playerShake`.
    room.shake += playerShake;

    // 2. `view()` — the jiggle, then the decay, once per FRAME.
    let jiggle = null;
    if (room.shake > 0) {
        jiggle = room.stream.jiggle(room.shake);
        room.shake = Math.max(room.shake - 1, 0);
    }
    out.jiggle = jiggle;

    // 3. `updateLists()` — the queued adds land, the removes drain.
    room.rocks = room.rocks.filter((r) => !r.removeRequested);
    room.rocks.unshift(...room.pendingRocks.splice(0));
    room.grenades.unshift(...room.pendingGrenades.splice(0));

    out.draws = room.stream.count - out.drawsBefore;
    room.ticks += 1;
    return out;
}

/**
 * ⛔ THE FIGHT'S OWN REFUSAL. A window that asks this model for an exact
 * Owl fight must have declared the split and a seed; without them the
 * schedule in `finalBossRng.js` is short by one draw per rock landing.
 */
export { assertOwlStreamPremises } from './finalBossRng.js';

/** Re-exported so a caller needs one import for the room. */
export { OwlDrawStream, ROCK_FREQUENCY, GRENADE_FREQUENCY };
