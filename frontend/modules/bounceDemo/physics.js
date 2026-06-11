/**
 * Bounce Demo `step` — continuous platformer physics, the source of
 * truth for the DJ-Metroidvania substrate
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md, build
 * order step 1).
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
    // Structural behavior fields — data, not mode strings: `step`
    // branches on the specific field, never on a profile name, so any
    // future profile is pure data and serializes into the payload
    // stamp. 'accel' = vx state + drag (the classic model above);
    // 'flat' = Doodle Jump's hero._x += MOVE_FLAT per held tick, no
    // momentum. (PLATFORM_BEHAVIORS — blue movement, brown breaking —
    // lands here the same way once the dj probe data is in.)
    AIR_CONTROL: 'accel',
    MOVE_FLAT: 0,          // px/frame under 'flat' air control
});

/**
 * Physics profiles. Constants are LOGIC-AFFECTING — access rules are
 * derived from `step` — so a world must be played under the profile it
 * was generated with:
 *
 * - 'classic' is the current model, FROZEN: all committed presets,
 *   fixtures, ground-truth tests and AP round-trip artifacts are
 *   generated under it, and an ABSENT payload stamp means classic.
 * - 'dj' will match real Doodle Jump as the SWFRecomp-CC probe data
 *   supports (measurement spec:
 *   NewDocs/plans/procedural-generation/dj-physics-measurement-spec.md).
 *   Until calibration lands it is a PROVISIONAL placeholder: classic
 *   constants plus the one structural fact already known (flat ±10
 *   air control, clip_action_29) — the number is DJ-native px/tick,
 *   unconverted.
 *
 * Generated worlds stamp `playable_payload.params.physics =
 * { profile, constants }` (see physicsStampFor); the runtime trusts
 * the EMBEDDED constants, so retuning a profile here never silently
 * changes physics under already-generated worlds.
 */
export const PROFILES = Object.freeze({
    classic: Object.freeze({
        id: 'classic',
        label: 'Classic',
        constants: DEFAULTS,
    }),
    dj: Object.freeze({
        id: 'dj',
        label: 'Doodle Jump (provisional)',
        provisional: true,
        constants: Object.freeze({
            ...DEFAULTS,
            AIR_CONTROL: 'flat',
            MOVE_FLAT: 10,
        }),
    }),
});

/**
 * Build the payload stamp for a profile id. Classic returns null —
 * the stamp is OMITTED so classic worlds stay byte-identical to
 * pre-profile payloads (absent stamp = classic).
 */
export function physicsStampFor(profileId) {
    if (!profileId || profileId === 'classic') return null;
    const profile = PROFILES[profileId];
    if (!profile) throw new Error(`physicsStampFor: unknown physics profile '${profileId}'`);
    return { profile: profile.id, constants: profile.constants };
}

/**
 * Resolve a payload physics stamp to runtime constants. Embedded
 * constants win (merged over DEFAULTS so fields added after a world
 * was generated fall back to classic behavior); a bare profile id
 * resolves via the registry; absent stamp = classic DEFAULTS.
 */
export function resolvePhysicsStamp(stamp) {
    if (stamp?.constants) return Object.freeze({ ...DEFAULTS, ...stamp.constants });
    if (stamp?.profile || typeof stamp === 'string') {
        const id = typeof stamp === 'string' ? stamp : stamp.profile;
        const profile = PROFILES[id];
        if (profile) return profile.constants;
        console.warn(`resolvePhysicsStamp: unknown profile '${id}', using classic`);
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

/** The entrance state: bottom-center, at rest, about to fall. */
export function spawnState(level, C = DEFAULTS) {
    return {
        x: level.size.width / 2,
        y: level.size.height - C.SPAWN_HEIGHT,
        vx: 0,
        vy: 0,
        fallen: false,
        landedOn: null,
        launch: null,
    };
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
 *
 * @param {object} state     {x, y, vx, vy, fallen, landedOn, launch}
 * @param {object|null} input {left, right} booleans (gated by abilities)
 * @param {object} level     level data (see fixtures/bounceStack.js)
 * @param {object} abilities ability set (see suppression.js)
 * @param {object} C         physics constants (DEFAULTS)
 */
export function step(state, input, level, abilities, C = DEFAULTS) {
    if (state.fallen) return state;

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
    };
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
