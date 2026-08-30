/**
 * Bounce Demo `step` — continuous platformer physics, the source of
 * truth for the DJ-Metroidvania substrate
 * (docs/json/developer/procgen/bounce.md).
 *
 * Doodle-Jump-style: there is no jump button — landing on a platform
 * from above bounces the player automatically; a spring or jetpack on
 * the landing platform boosts the launch. Collision is one-way (rising
 * passes through platforms). Dependency-free and context-neutral by
 * design: the same module is imported by the main-window solver
 * (`canJump` samples `step`) and by the iframe renderer.
 *
 * Conventions:
 * - y increases DOWNWARD (screen-style); gravity is +vy, launches are
 *   negative vy. The level entrance is bottom-center.
 * - `platform.x`, pickup and portal positions are CENTERS.
 * - SCREEN WRAP (like Doodle Jump): moving off one side re-enters the
 *   other; x is modular in [0, level.size.width) and landing spans are
 *   wrap-aware. There are no side walls.
 * - Frame-based: one step() call = one logical 60fps frame. No RNG, no
 *   Date — determinism is a design principle (no algorithm may rely on
 *   RNG determinism, so there is none to begin with).
 */

import {
    activePlatforms,
    activeSprings,
    activeJetpacks,
} from './suppression.js';

export const DEFAULTS = Object.freeze({
    TICK_HZ: 60,           // logical ticks per second (the game loop reads this)
    GRAVITY: 0.5,          // px/frame^2
    MAX_FALL: 16,          // terminal fall speed, px/frame
    BOUNCE_VY: -13,        // plain bounce  -> apex ~169px above platform
    SPRING_VY: -22,        // spring launch -> apex ~484px
    JETPACK_VY: -36,       // jetpack       -> apex ~1296px
    MOVE_ACCEL: 0.8,       // px/frame^2 while holding a direction
    AIR_DRAG: 0.92,        // vx decay per frame with no input
    MAX_VX: 6,             // px/frame
    PLATFORM_WIDTH: 60,    // px; platforms collide as segments at p.y
    PLAYER_HALF_WIDTH: 12, // px
    SPAWN_HEIGHT: 120,     // spawn this many px above the level bottom
    FALL_MARGIN: 60,       // px below level bottom before "fallen"
    // ── Structural behavior fields ──────────────────────────────────
    // Data, not mode strings: `step` branches on the specific field,
    // never on a profile name, so any future profile is pure data and
    // serializes into the payload stamp.
    //
    // AIR_CONTROL 'accel' = vx state + drag (the classic model above);
    // 'flat' = Doodle Jump's hero._x += MOVE_FLAT per held tick, no
    // momentum, both keys cancel, instant stop on release.
    AIR_CONTROL: 'accel',
    MOVE_FLAT: 0,          // px/frame under 'flat' air control
    // LANDING 'immediate' = classic: the landing frame snaps y to the
    // platform line and sets the launch vy directly. 'latched' = DJ
    // (measured 2026-06-11): the catch is a one-tick LOOKAHEAD test
    // that zeroes vy IN PLACE (no snap — the player rests where the
    // test fired, up to ~MAX_FALL px above the platform line) and the
    // impulse applies on the NEXT tick (vy -= *_IMPULSE, then gravity).
    LANDING: 'immediate',
    BOUNCE_IMPULSE: 0,     // latched-mode plain impulse (vy was zeroed on hit)
    SPRING_IMPULSE: 0,     // latched-mode spring impulse (vy zeroed on hit)
    BROWN_IMPULSE: 0,      // latched-mode brown impulse — vy NOT zeroed on hit
    JETPACK_THRUST: 0,     // latched-mode sustained thrust, px/tick^2 ...
    JETPACK_TICKS: 0,      // ... for this many ticks after a jetpack landing
    CATCH_BAND: 0,         // latched-mode catch volume below the platform line
    // WRAP 'modular' = classic screen wrap (x modular in [0, width),
    // wrap-aware catch spans). 'edge' = DJ: teleport to the bare far
    // edge only once ENTIRELY offscreen (x - R > W -> 0; x < -R -> W,
    // R = PLAYER_HALF_WIDTH); catch spans do NOT wrap.
    WRAP: 'modular',
    // PLATFORM_BEHAVIORS: ability items still gate EXISTENCE
    // (suppression.js); these fields give present platforms their
    // native dj behavior. blue 'moving' = deterministic horizontal
    // triangle-wave sweep (platform.sweep {min,max,phase0?} bounds,
    // BLUE_SPEED px/tick, phase = state tick count — no RNG); brown
    // 'breaking' = one landing gives the weakened brown bounce and
    // breaks the platform (state.broken; debris NOT modeled). Breaks
    // reset on respawn — DJ's fall is death, our respawn is a fresh
    // attempt — which keeps within-attempt reachability monotone.
    PLATFORM_BEHAVIORS: Object.freeze({ blue: 'static', brown: 'static' }),
    BLUE_SPEED: 0,         // px/tick under blue 'moving'
    // POSITION_QUANTUM: positions truncate to this grid after every
    // move (DJ: Flash twips, 0.05px). 0 = off (classic).
    POSITION_QUANTUM: 0,
});

/**
 * Physics profiles. Constants are LOGIC-AFFECTING — access rules are
 * derived from `step` — so a world must be played under the profile it
 * was generated with:
 *
 * - 'experimental' is the FIRST model we built (before measuring real DJ
 *   constants — the name 'classic' was misleading, so it was renamed). It is
 *   FROZEN: all committed presets, fixtures, ground-truth tests and AP
 *   round-trip artifacts are generated under it, and an ABSENT payload stamp
 *   means experimental (the backward-compat baseline — see resolvePhysicsStamp).
 * - 'dj' matches real Doodle Jump per the SWFRecomp-CC measurements
 *   (2026-06-11). Constants are DJ-NATIVE: px and
 *   ticks at the SWF's 20Hz tick rate, used verbatim with
 *   TICK_HZ: 20 — discrete-physics effects are large (measured plain
 *   apex 114 vs 100 continuous), so rescaling to 60Hz cannot
 *   reproduce the measured trajectories and the solver must predict
 *   the eventual real-DJ renderer exactly.
 *
 * Generated worlds stamp `playable_payload.params.physics =
 * { profile, constants }` (see physicsStampFor); the runtime trusts
 * the EMBEDDED constants, so retuning a profile here never silently
 * changes physics under already-generated worlds.
 */
export const PROFILES = Object.freeze({
    experimental: Object.freeze({
        id: 'experimental',
        label: 'Experimental',
        constants: DEFAULTS,
    }),
    dj: Object.freeze({
        id: 'dj',
        label: 'Doodle Jump',
        constants: Object.freeze({
            ...DEFAULTS,
            TICK_HZ: 20,
            GRAVITY: 4,            // px/tick^2, constant, same rising/falling
            MAX_FALL: 22,          // maxjump clamp; NO rising cap (jetpack hit -95.3)
            LANDING: 'latched',
            // jumpspeed * jumpspeed_factor from the decompiled hero:
            // plain/brown 17*1.9 (net -28.3 after gravity), spring 17*4
            // (net -64, apex 544 — exact in our integrator).
            BOUNCE_IMPULSE: 17 * 1.89999997615814,
            SPRING_IMPULSE: 17 * 4,
            BROWN_IMPULSE: 17 * 1.89999997615814, // applied to UN-zeroed vy
            JETPACK_THRUST: 5,     // 10 * 0.5 re-latched per tick ...
            JETPACK_TICKS: 100,    // ... net -1 px/tick^2 for exactly 100 ticks
            CATCH_BAND: 40.15,     // block bbox height (point tests vs band)
            WRAP: 'edge',
            AIR_CONTROL: 'flat',
            MOVE_FLAT: 10,
            PLAYER_HALF_WIDTH: 23, // hero xradius; catch half-span 30+23 = 53
            PLATFORM_BEHAVIORS: Object.freeze({ blue: 'moving', brown: 'breaking' }),
            BLUE_SPEED: 5,         // uniform, reverses at sweep bounds, period 72 @180px span
            POSITION_QUANTUM: 0.05, // Flash twip truncation on every position write
        }),
    }),
});

/**
 * Build the payload stamp for a profile id. Experimental returns null —
 * the stamp is OMITTED so experimental worlds stay byte-identical to
 * pre-profile payloads (absent stamp = experimental).
 */
export function physicsStampFor(profileId) {
    if (!profileId || profileId === 'experimental') return null;
    const profile = PROFILES[profileId];
    if (!profile) throw new Error(`physicsStampFor: unknown physics profile '${profileId}'`);
    return { profile: profile.id, constants: profile.constants };
}

/**
 * Resolve a payload physics stamp to runtime constants. Embedded
 * constants win (merged over DEFAULTS so fields added after a world
 * was generated fall back to experimental behavior); a bare profile id
 * resolves via the registry; absent stamp = experimental DEFAULTS.
 */
export function resolvePhysicsStamp(stamp) {
    if (stamp?.constants) return Object.freeze({ ...DEFAULTS, ...stamp.constants });
    if (stamp?.profile || typeof stamp === 'string') {
        const id = typeof stamp === 'string' ? stamp : stamp.profile;
        const profile = PROFILES[id];
        if (profile) return profile.constants;
        console.warn(`resolvePhysicsStamp: unknown profile '${id}', using experimental`);
    }
    return DEFAULTS;
}

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

/** Normalize an x coordinate into [0, width) under screen wrap. */
export function wrapX(x, width) {
    return ((x % width) + width) % width;
}

/** Horizontal distance between two x coordinates under screen wrap. */
export function wrapDistance(a, b, width) {
    const d = Math.abs(wrapX(a, width) - wrapX(b, width));
    return Math.min(d, width - d);
}

/**
 * The entrance state: bottom-center, at rest, about to fall.
 *
 * `t` is the session tick counter — moving platforms (blue under dj
 * behaviors) are a deterministic function of it, so platform motion is
 * part of the state with no RNG. `broken` is the set of brown
 * platforms broken this attempt (latched landing semantics); a respawn
 * is a FRESH spawnState, so breaks reset on every fall — DJ's fall is
 * death, our respawn is a new attempt (and blue phases restart with
 * t = 0, keeping every attempt deterministic).
 */
export function spawnState(level, C = DEFAULTS) {
    return {
        x: level.size.width / 2,
        y: level.size.height - C.SPAWN_HEIGHT,
        vx: 0,
        vy: 0,
        fallen: false,
        landedOn: null,
        launch: null,
        t: 0,
        broken: [],        // brown platform ids broken this attempt
        latched: null,     // launch type latched on the hit tick (dj LANDING)
        jetpackTicks: 0,   // remaining sustained-thrust ticks (dj jetpack)
    };
}

/**
 * Truncate a coordinate to C.POSITION_QUANTUM (DJ: Flash twips).
 * Flash stores coordinates as exact twip integers, so values our
 * float math leaves infinitesimally below a twip boundary (203.2 + 16
 * = 219.19999…) are really ON it — snap within epsilon before
 * truncating toward zero.
 */
function quantize(v, C) {
    const q = C.POSITION_QUANTUM;
    if (!(q > 0)) return v;
    const n = v / q;
    const r = Math.round(n);
    return (Math.abs(n - r) < 1e-6 ? r : Math.trunc(n)) * q;
}

/**
 * A platform's x center at tick `t`. Static platforms sit at p.x;
 * a moving blue (PLATFORM_BEHAVIORS.blue === 'moving' + a `sweep`
 * {min, max, phase0?} on the platform) sweeps a uniform triangle wave
 * at BLUE_SPEED px/tick between the bounds — deterministic in t, the
 * measured DJ mover semantics (±5 px/tick, reverses at the bounds,
 * no velocity inheritance).
 */
export function platformXAt(platform, t, C) {
    if (platform.type !== 'blue'
            || C.PLATFORM_BEHAVIORS?.blue !== 'moving'
            || !platform.sweep) {
        return platform.x;
    }
    const { min, max, phase0 = 0 } = platform.sweep;
    const span = max - min;
    if (span <= 0) return min;
    const cycle = 2 * span;
    const ph = ((C.BLUE_SPEED * (t + phase0)) % cycle + cycle) % cycle;
    return min + (ph <= span ? ph : cycle - ph);
}

/** Launch type granted by landing on `platformId` under `abilities`. */
function launchFor(platformId, level, abilities) {
    if (activeJetpacks(level, abilities).some((j) => j.on === platformId)) {
        return 'jetpack';
    }
    if (activeSprings(level, abilities).some((s) => s.on === platformId)) {
        return 'spring';
    }
    return 'bounce';
}

function launchVy(launch, C) {
    return launch === 'jetpack' ? C.JETPACK_VY
        : launch === 'spring' ? C.SPRING_VY
        : C.BOUNCE_VY;
}

/**
 * Advance one frame. Pure: returns a new state, never mutates.
 * Dispatches on C.LANDING: 'immediate' is the classic model,
 * 'latched' is the measured DJ model (stepLatched below).
 *
 * @param {object} state     {x, y, vx, vy, fallen, landedOn, launch,
 *                            t, broken, latched, jetpackTicks}
 * @param {object|null} input {left, right} booleans (gated by abilities)
 * @param {object} level     level data (see fixtures/bounceStack.js)
 * @param {object} abilities ability set (see suppression.js)
 * @param {object} C         physics constants (DEFAULTS)
 */
export function step(state, input, level, abilities, C = DEFAULTS) {
    if (state.fallen) return state;
    if (C.LANDING === 'latched') return stepLatched(state, input, level, abilities, C);

    const dir = ((input?.right && abilities.right) ? 1 : 0)
        - ((input?.left && abilities.left) ? 1 : 0);
    let vx;
    if (C.AIR_CONTROL === 'flat') {
        // Doodle Jump: flat per-tick displacement while a key is held,
        // no momentum (release = instant stop).
        vx = dir * C.MOVE_FLAT;
    } else {
        vx = dir !== 0
            ? state.vx + dir * C.MOVE_ACCEL
            : state.vx * C.AIR_DRAG;
        vx = clamp(vx, -C.MAX_VX, C.MAX_VX);
    }

    let vy = Math.min(state.vy + C.GRAVITY, C.MAX_FALL);

    // Screen wrap: x is modular; there are no side walls.
    const x = wrapX(state.x + vx, level.size.width);
    let y = state.y + vy;

    // One-way landing: only while falling, only when the player's feet
    // cross the platform's top line this frame. If the sweep crosses
    // several platforms, land on the highest one (smallest y) — that is
    // the first hit along the fall. The span check is wrap-aware so
    // platforms by the seam catch a wrapping player.
    let landedOn = null;
    let launch = null;
    if (vy > 0) {
        const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
        for (const p of activePlatforms(level, abilities)) {
            if (state.y <= p.y && y >= p.y
                    && wrapDistance(x, p.x, level.size.width) <= halfSpan) {
                if (!landedOn || p.y < landedOn.y) landedOn = p;
            }
        }
    }
    if (landedOn) {
        y = landedOn.y;
        launch = launchFor(landedOn.id, level, abilities);
        vy = launchVy(launch, C);
    }

    const fallen = y > level.size.height + C.FALL_MARGIN;
    return {
        x,
        y,
        vx,
        vy,
        fallen,
        landedOn: landedOn ? landedOn.id : null,
        launch,
        t: (state.t ?? 0) + 1,
        broken: state.broken ?? [],
        latched: null,
        jetpackTicks: 0,
    };
}

/**
 * The measured Doodle Jump tick (LANDING: 'latched'), matching the
 * decompiled hero enterFrame order and the 2026-06-11 traces:
 *
 *   1. flat key moves (both keys cancel; instant stop)
 *   2. edge wrap (teleport only once ENTIRELY offscreen)
 *   3. consume the latched landing -> impulse (vy -= *_IMPULSE;
 *      plain/spring launched from the vy=0 set on the hit tick, brown
 *      from the UN-zeroed impact vy) or start the jetpack's sustained
 *      thrust; thrust ticks apply vy -= JETPACK_THRUST
 *   4. gravity (vy += GRAVITY, clamp to MAX_FALL; no rising cap)
 *   5. move (position twip-truncated per POSITION_QUANTUM)
 *   6. falling catch, one-tick LOOKAHEAD vs the platform band:
 *      (y + vy) within [p.y, p.y + CATCH_BAND] at the platform's
 *      CURRENT swept x — vy zeroes IN PLACE (no snap; the player
 *      rests up to ~MAX_FALL px above the line) and the launch is
 *      latched for the next tick. Brown platforms keep vy (weakened
 *      bounce: vy_hit - BROWN_IMPULSE + GRAVITY next tick) and break.
 *
 * NOTE one knowing divergence from the real SWF: DJ scrolls the
 * container (truncating each scroll DELTA to twips) when the hero
 * rises above screen y 185; our levels use absolute world coordinates
 * with a free camera, so rising ticks truncate the POSITION instead —
 * ≤0.05px/tick difference during scrolled rises (≈0.3px per bounce
 * apex). Hero-move ticks match the traces exactly. Falling debris
 * from broken browns is deliberately NOT modeled (it cannot aid
 * upward progression; the marginal debris-hover exploit stays out of
 * derived rules).
 */
function stepLatched(state, input, level, abilities, C) {
    const broken = state.broken ?? [];
    const isBroken = broken.length > 0 ? new Set(broken) : null;
    const t = (state.t ?? 0) + 1;

    // 1. flat horizontal control (dj profiles use 'flat'; honor accel
    //    for hybrid custom profiles)
    const dir = ((input?.right && abilities.right) ? 1 : 0)
        - ((input?.left && abilities.left) ? 1 : 0);
    let vx;
    if (C.AIR_CONTROL === 'flat') {
        vx = dir * C.MOVE_FLAT;
    } else {
        vx = dir !== 0
            ? state.vx + dir * C.MOVE_ACCEL
            : state.vx * C.AIR_DRAG;
        vx = clamp(vx, -C.MAX_VX, C.MAX_VX);
    }
    let x = quantize(state.x + vx, C);

    // 2. edge wrap: teleport to the bare far edge only once the player
    //    is entirely offscreen (center past edge by a half-width)
    const W = level.size.width;
    const R = C.PLAYER_HALF_WIDTH;
    if (C.WRAP === 'edge') {
        if (x - R > W) x = 0;
        else if (x < -R) x = W;
    } else {
        x = wrapX(x, W);
    }

    // 3. consume the latched landing
    let vy = state.vy;
    let jetpackTicks = state.jetpackTicks ?? 0;
    if (state.latched) {
        if (state.latched === 'jetpack') {
            jetpackTicks = C.JETPACK_TICKS;
        } else if (state.latched === 'spring') {
            vy -= C.SPRING_IMPULSE;
        } else if (state.latched === 'brown') {
            vy -= C.BROWN_IMPULSE;
        } else {
            vy -= C.BOUNCE_IMPULSE;
        }
    }
    if (jetpackTicks > 0) {
        vy -= C.JETPACK_THRUST;
        jetpackTicks -= 1;
    }

    // 4. gravity, terminal clamp (falling only — no rising cap)
    vy += C.GRAVITY;
    if (vy > C.MAX_FALL) vy = C.MAX_FALL;

    // 5. move
    const y = quantize(state.y + vy, C);

    // 6. falling catch: lookahead band test at the platform's CURRENT
    //    (possibly swept) x; land on the highest hit. Catch spans do
    //    not wrap in edge mode (DJ's point tests don't).
    let landedOn = null;
    let landedX = 0;
    if (vy > 0) {
        const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
        const ahead = y + vy;
        for (const p of activePlatforms(level, abilities)) {
            if (isBroken?.has(p.id)) continue;
            if (ahead < p.y || ahead > p.y + C.CATCH_BAND) continue;
            const px = platformXAt(p, t, C);
            const dx = C.WRAP === 'edge'
                ? Math.abs(x - px)
                : wrapDistance(x, px, W);
            if (dx > halfSpan) continue;
            if (!landedOn || p.y < landedOn.y) {
                landedOn = p;
                landedX = px;
            }
        }
    }

    let latched = null;
    let newBroken = broken;
    if (landedOn) {
        const breaking = landedOn.type === 'brown'
            && C.PLATFORM_BEHAVIORS?.brown === 'breaking';
        latched = breaking ? 'brown' : launchFor(landedOn.id, level, abilities);
        if (latched !== 'brown') vy = 0; // brown keeps the impact vy
        if (breaking) newBroken = [...broken, landedOn.id];
    }
    void landedX; // (current x of the catch host; kept for future debris/ride work)

    const fallen = y > level.size.height + C.FALL_MARGIN;
    return {
        x,
        y,
        vx,
        vy,
        fallen,
        landedOn: landedOn ? landedOn.id : null,
        launch: latched,
        t,
        broken: newBroken,
        latched,
        jetpackTicks,
    };
}

/**
 * The true discrete rise of a launch type above the launch point,
 * measured by running `step` itself on an empty level — correct for
 * both landing models (closed-form vy^2/2g misses discrete effects:
 * classic plain is 162.5 not 169; dj-latched plain is 114.4). Under
 * 'latched' the launch point is the HOVER point; the player can rest
 * up to MAX_FALL above the platform line, so a platform-relative
 * upper bound is launchRise + MAX_FALL (see generator/canJump
 * callers). Memoized per (constants, type).
 */
const _riseCache = new WeakMap();
export function launchRise(type, C = DEFAULTS) {
    let byType = _riseCache.get(C);
    if (byType?.[type] !== undefined) return byType[type];
    const level = {
        id: '_rise', size: { width: 1000, height: 200000 },
        platforms: [], springs: [], jetpacks: [], pickups: [], portals: [],
    };
    let s = {
        x: 500, y: 100000, vx: 0, vy: 0, fallen: false,
        landedOn: null, launch: null, t: 0, broken: [],
        latched: null, jetpackTicks: 0,
    };
    if (C.LANDING === 'latched') {
        s.latched = type;
    } else {
        s.vy = type === 'jetpack' ? C.JETPACK_VY
            : type === 'spring' ? C.SPRING_VY
            : C.BOUNCE_VY;
    }
    let minY = s.y;
    for (let i = 0; i < 100000; i++) {
        s = step(s, null, level, {}, C);
        if (s.y < minY) minY = s.y;
        if (s.vy >= 0 && s.jetpackTicks <= 0 && i > 1) break;
    }
    const rise = 100000 - minY;
    if (!byType) {
        byType = {};
        _riseCache.set(C, byType);
    }
    byType[type] = rise;
    return rise;
}

/**
 * Run `step` for up to `maxFrames`, collecting the trajectory and the
 * events the solver and tests care about. `policy(state, frame)`
 * returns the frame's input (or null for none).
 *
 * Collection semantics: PICKUPS and PORTALS are both LANDING-triggered
 * — landing on the host platform (`.on`) collects the pickup / enters
 * the portal. So goal accessibility is exactly host reachability, with
 * no dependence on where along the platform the player arrives, and no
 * accidental mid-flight portal entries. (A goal on a suppressed
 * platform is naturally inaccessible: there is no landing.) Goal x/y
 * positions are for rendering only.
 */
export function simulate(level, abilities, policy = () => null, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const maxFrames = opts.maxFrames ?? 1200;
    let state = opts.start ?? spawnState(level, C);
    const trajectory = [state];
    const landings = [];
    const pickupsTouched = new Set();
    const portalsTouched = new Set();
    let fellAtFrame = null;

    const touch = (s) => {
        if (!s.landedOn) return;
        for (const pk of level.pickups ?? []) {
            if (pk.on === s.landedOn) pickupsTouched.add(pk.id);
        }
        for (const pt of level.portals ?? []) {
            if (pt.on === s.landedOn) portalsTouched.add(pt.id);
        }
    };

    touch(state);
    for (let frame = 1; frame <= maxFrames && !state.fallen; frame++) {
        state = step(state, policy(state, frame), level, abilities, C);
        trajectory.push(state);
        if (state.landedOn) {
            landings.push({ frame, platformId: state.landedOn, launch: state.launch });
        }
        touch(state);
        if (state.fallen) fellAtFrame = frame;
    }

    return {
        trajectory,
        landings,
        pickupsTouched: [...pickupsTouched],
        portalsTouched: [...portalsTouched],
        fellAtFrame,
    };
}
