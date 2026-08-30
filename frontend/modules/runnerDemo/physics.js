/**
 * Runner `step` — continuous run-and-jump platformer physics, the
 * source of truth for the runner substrate
 * (NewDocs/plans/procedural-platformer/platformer-substrate-v1.md §4.1).
 *
 * Port of the GMTK Platformer Toolkit character controller (MIT, GMTK
 * 2022) via its vanilla-JS port (vendored verbatim at
 * `vendor/toolkit-physics-original.js` — the parity test pins this
 * module to it per-tick). Faithful to the original's order of
 * operations, including its commented quirks (e.g. the gravityScale
 * recompute in doAJump) — faithfulness to the measured presets
 * outranks cleanliness.
 *
 * Dependency-free and context-neutral by design: the same module is
 * imported by the main-window solver (`canRun` samples `step`), the
 * iframe game page, and the bot driver. No RNG, no clock, no DOM —
 * one step() call = one logical tick at `TICK_HZ` (50).
 *
 * Conventions (DIFFERENT from bounceDemo/physics.js — see the plan):
 * - Toolkit-native units: Unity units (not px), +y is UP, gravity is
 *   negative. Presets were measured in these units; the renderer
 *   scales by UNIT at draw time only.
 * - `platform.x/y` is the BOTTOM-LEFT corner, `w/h` the extent
 *   (toolkit convention). Pickup/portal `x/y` are CENTERS.
 * - `state.x/y` is the player's bottom-left corner.
 * - AUTO-RUN: the player permanently holds right (a structural
 *   constant, not an input) — v1's core mechanic. The jump button,
 *   drop-through, and reset are the only live inputs. Brake/Left
 *   arrive later as ability-gated input pass-through.
 *
 * Input contract (all booleans, sampled per tick, held-state):
 *   { left, right, jump, drop, reset }
 * `left`/`right` are ignored while AUTO_RUN is on (v1); the jump
 * press EDGE is derived internally from held-state transitions.
 *
 * `step(state, input, level, abilities, constants)` returns a NEW
 * state object (callers branch freely). Landing/goal/respawn
 * bookkeeping rides on the state:
 * - `landedOn`: platform id, set ONLY on landing ticks (airborne →
 *   grounded transition) — the solver's and bot's re-plan trigger.
 * - `standingOn`: the supporting platform id EVERY grounded tick
 *   (null while airborne, and while holding drop on a one-way — the
 *   engine's own ground probe, so consumers never re-derive support
 *   geometrically). Auto-run can carry the player across a flush
 *   platform boundary with no airborne phase — no `landedOn` fires,
 *   but `standingOn` switches; the solver's leg detector (canRun.js)
 *   and the goal-wake reasoning need that transition.
 * - `sprungOn`: spring platform id, set ONLY on the bounce tick (a
 *   spring catch converts the landing into a launch — the player
 *   never grounds on a spring, so no landedOn/standingOn fires).
 * - `touchedPickups` / `touchedPortals`: ids overlapping this tick.
 * - `respawned`: 'fell' | 'hazard' | 'reset' | null — set on the
 *   tick the player is returned to the spawn; per-attempt state
 *   (hits, future broken platforms) resets with it.
 * - `hits`: hazard hits this attempt. `hits > constants.MAX_HITS`
 *   respawns — MAX_HITS is 0 at base (any hit kills) and the Shield
 *   ability overlays it to the collected count (plan §4.10 — the hit
 *   budget; suppression.js effectiveParams). Charging is CONTACT-EDGE:
 *   `hazardContacts` records the hazard ids overlapped each tick, and
 *   a hit is charged only when a hazard enters that set (per-tick
 *   charging would spend the whole budget crossing ONE spike bed).
 *   With MAX_HITS 0 the first contact tick still kills — behavior-
 *   identical to the per-tick rule. The budget refills with the rest
 *   of the per-attempt state (respawn / region entry), §8.0.
 */

import { activePlatforms, effectiveParams } from './suppression.js';

// ── Toolkit parameters (verbatim names, verbatim defaults) ─────────
// Mirrors the vendored original's `params` block; field names are kept
// exactly (including `variablejumpHeight`'s lowercase j) so presets
// apply verbatim and the parity harness compares like for like.
const TOOLKIT_PARAMS = Object.freeze({
    // characterMovement
    maxSpeed: 10,
    maxAcceleration: 52,
    maxDecceleration: 52,
    maxTurnSpeed: 80,
    maxAirAcceleration: 30,
    maxAirDeceleration: 30,
    maxAirTurnSpeed: 80,
    friction: 0,
    useAcceleration: true,
    // characterJump
    jumpHeight: 5,
    timeToJumpApex: 0.4,
    upwardMovementMultiplier: 1,
    downwardMovementMultiplier: 6.17,
    maxAirJumps: 0,
    variablejumpHeight: true,
    jumpCutOff: 3,
    speedLimit: 30,
    coyoteTime: 0.15,
    jumpBuffer: 0.15,
});

// Presets pulled verbatim from the toolkit's .asset YAMLs (same values
// as the vendored original). Fields absent from a preset keep the
// toolkit defaults — same behaviour as CharacterMovementDataController.
const PRESET_OVERRIDES = Object.freeze({
    celeste: Object.freeze({
        maxAcceleration: 79, maxSpeed: 9.01, maxDecceleration: 76, maxTurnSpeed: 76,
        jumpHeight: 2.25, timeToJumpApex: 0.38, downwardMovementMultiplier: 5.23,
        maxAirAcceleration: 80, maxAirTurnSpeed: 80, maxAirDeceleration: 80,
        variablejumpHeight: true, jumpCutOff: 5.23, maxAirJumps: 0,
    }),
    nsmbu: Object.freeze({
        maxAcceleration: 13.3, maxSpeed: 6.6, maxDecceleration: 13.3, maxTurnSpeed: 13.3,
        jumpHeight: 2.88, timeToJumpApex: 0.46, downwardMovementMultiplier: 1.37,
        maxAirAcceleration: 13.3, maxAirTurnSpeed: 13.3, maxAirDeceleration: 3,
        variablejumpHeight: true, jumpCutOff: 1.37, maxAirJumps: 0,
    }),
    sonic: Object.freeze({
        maxAcceleration: 7.4, maxSpeed: 16.9, maxDecceleration: 26.1, maxTurnSpeed: 26.1,
        jumpHeight: 3.4, timeToJumpApex: 0.46, downwardMovementMultiplier: 1,
        maxAirAcceleration: 11.79, maxAirTurnSpeed: 11.79, maxAirDeceleration: 24.1,
        variablejumpHeight: true, jumpCutOff: 1, maxAirJumps: 0,
    }),
    meatboy: Object.freeze({
        maxAcceleration: 30.5, maxSpeed: 17, maxDecceleration: 80, maxTurnSpeed: 80,
        jumpHeight: 5.5, timeToJumpApex: 0.65, downwardMovementMultiplier: 2.9,
        maxAirAcceleration: 43.6, maxAirTurnSpeed: 43.6, maxAirDeceleration: 9.6,
        variablejumpHeight: true, jumpCutOff: 2.9, maxAirJumps: 0,
    }),
});

// ── Structural constants (runner-owned; UPPERCASE to separate them
//    from the toolkit params). Data, not mode strings — `step`
//    branches on the specific field, never on a profile name, so any
//    profile serializes into the payload stamp (bounce doctrine). ──
const STRUCTURAL = Object.freeze({
    TICK_HZ: 50,          // the toolkit's Unity FixedUpdate tick
    GRAVITY: -9.81,       // Unity's default Physics2D.gravity.y
    PLAYER_W: 0.75,       // player AABB, toolkit values
    PLAYER_H: 1.125,
    AUTO_RUN: true,       // v1 core mechanic: directionX is forced +1.
    //                       false = input-driven (the parity harness,
    //                       and the future Brake/Left pass-through).
    SIDE_WALLS: true,     // level.size.width bounds collide as walls
    //                       (the original toolkit page has none).
    FALL_MARGIN: 5,       // y < -FALL_MARGIN ⇒ fell (original: y < -5)
    MAX_HITS: 0,          // hit-budget hook (plan §4.10): hits beyond
    //                       this respawn the player. 0 = any hit kills.
    GOAL_HALF: 0.375,     // pickup/portal default half-extent (touch box)
    GLIDE_FALL_CAP: 2,    // glide fall-speed cap (units/s) while the
    //                       jump button is HELD during a NON-JUMP fall
    //                       launched from a `glider` pad (plan §8.5 —
    //                       the Glide item gates the PAD's existence,
    //                       so the behavior is unreachable without the
    //                       item and baseline physics never changes)
    SPRING_RISE: 10,      // spring bounce rise (units), profile-
    //                       independent: the launch speed is derived
    //                       against the CUT rise gravity, so the rise
    //                       is deterministic regardless of jump-hold
    //                       state (see springLaunchSpeed).
});

function makeConstants(overrides) {
    return Object.freeze({ ...TOOLKIT_PARAMS, ...STRUCTURAL, ...overrides });
}

/**
 * Physics profiles. Constants are LOGIC-AFFECTING — access rules are
 * derived from `step` — so a world must be played under the profile
 * it was generated with. Generated worlds stamp
 * `playable_payload.params.physics = { profile, constants }`
 * (physicsStampFor); the runtime trusts the EMBEDDED constants, so
 * retuning a profile here never silently changes physics under
 * already-generated worlds (bounce's stamp contract).
 */
export const PROFILES = Object.freeze({
    toolkit: Object.freeze({ id: 'toolkit', label: 'Toolkit defaults', constants: makeConstants({}) }),
    celeste: Object.freeze({ id: 'celeste', label: 'Celeste-like', constants: makeConstants(PRESET_OVERRIDES.celeste) }),
    nsmbu: Object.freeze({ id: 'nsmbu', label: 'NSMBU-like', constants: makeConstants(PRESET_OVERRIDES.nsmbu) }),
    sonic: Object.freeze({ id: 'sonic', label: 'Sonic-like', constants: makeConstants(PRESET_OVERRIDES.sonic) }),
    meatboy: Object.freeze({ id: 'meatboy', label: 'Meat Boy-like', constants: makeConstants(PRESET_OVERRIDES.meatboy) }),
});

/** The profile new worlds generate under (may change; see plan §1). */
export const DEFAULT_PROFILE_ID = 'celeste';

export const DEFAULTS = PROFILES[DEFAULT_PROFILE_ID].constants;

/** Payload stamp for a profile id — always embedded (no legacy-absent
 *  baseline; this substrate has no pre-stamp worlds to stay byte-
 *  identical with, unlike bounce's `experimental`). */
export function physicsStampFor(profileId) {
    const profile = PROFILES[profileId];
    if (!profile) throw new Error(`runnerDemo: unknown physics profile '${profileId}'`);
    return { profile: profile.id, constants: profile.constants };
}

/** Resolve a payload stamp to runtime constants (embedded wins). */
export function resolvePhysicsStamp(stamp) {
    if (!stamp) return DEFAULTS;
    if (stamp.constants) return { ...TOOLKIT_PARAMS, ...STRUCTURAL, ...stamp.constants };
    const profile = PROFILES[stamp.profile];
    if (!profile) throw new Error(`runnerDemo: unknown physics stamp profile '${stamp.profile}'`);
    return profile.constants;
}

// ── Helpers (mirrors of the original's Mathf ports) ────────────────
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function moveTowards(current, target, maxDelta) {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** A goal's touch box (x/y are centers; w/h optional). */
function goalBox(g, C) {
    const hw = (g.w ?? C.GOAL_HALF * 2) / 2;
    const hh = (g.h ?? C.GOAL_HALF * 2) / 2;
    return { x: g.x - hw, y: g.y - hh, w: hw * 2, h: hh * 2 };
}

/** Is this platform solid (collides from every side)? One-way gated
 *  platforms collide only from above and never block (plan §3 — the
 *  monotonicity-by-construction requirement). */
function isSolid(p) {
    return p.type === 'ground';
}

/**
 * Spring launch speed for a profile (plan §8.3 — gated springs).
 * Sized so the bounce rises SPRING_RISE units under the rise gravity
 * the engine actually applies after a bounce: the bounce clears
 * `currentlyJumping`, so calculateGravity's rising branch always
 * takes the jump-CUT multiplier (or the plain upward multiplier when
 * variable jump height is off) — the rise is therefore the same
 * whether or not the jump button is held. Deterministic bounce =
 * solver, bot, and player all get identical spring arcs.
 */
export function springLaunchSpeed(C) {
    const gUp = (2 * C.jumpHeight) / (C.timeToJumpApex * C.timeToJumpApex);
    const m = C.variablejumpHeight ? C.jumpCutOff : C.upwardMovementMultiplier;
    return Math.sqrt(2 * gUp * m * C.SPRING_RISE);
}

// ── Spawn / respawn ────────────────────────────────────────────────

/** The standard-entrance spawn state (bottom-left of the level). */
export function spawnState(level, C = DEFAULTS) {
    return {
        x: level.spawn.x,
        y: level.spawn.y,
        vx: 0,
        vy: 0,
        facing: 1,
        // characterJump state (original field names)
        desiredJump: false,
        pressingJump: false,
        jumpBufferCounter: 0,
        coyoteTimeCounter: 0,
        currentlyJumping: false,
        canJumpAgain: false,
        gravityScale: 1,
        gravMultiplier: 1,
        onGround: false,
        // runner bookkeeping
        t: 0,
        landedOn: null,
        standingOn: null,
        sprungOn: null,
        springFlight: false,
        lastSupportType: null,
        touchedPickups: [],
        touchedPortals: [],
        hits: 0,
        hazardContacts: [],
        respawned: null,
        C, // convenience echo for renderers; step never reads it
    };
}

/** Original resetCharacter(), plus per-attempt bookkeeping reset.
 *  facing survives (the original keeps it too); `t` keeps counting
 *  (session time, the future phased-hazard clock — respawn is a fresh
 *  ATTEMPT, not a fresh session). */
function respawn(state, level, cause) {
    return {
        ...state,
        x: level.spawn.x,
        y: level.spawn.y,
        vx: 0,
        vy: 0,
        desiredJump: false,
        // pressingJump is NOT reset: a jump held across a respawn must
        // not re-trigger (no rising edge) — matches the original, where
        // no new keydown fires while the key stays physically held.
        pressingJump: state.pressingJump,
        jumpBufferCounter: 0,
        coyoteTimeCounter: 0,
        currentlyJumping: false,
        canJumpAgain: false,
        gravMultiplier: 1,
        onGround: false,
        landedOn: null,
        standingOn: null,
        sprungOn: null,
        springFlight: false,
        lastSupportType: null,
        touchedPickups: [],
        touchedPortals: [],
        hits: 0,
        hazardContacts: [],
        respawned: cause,
    };
}

// ── The step ───────────────────────────────────────────────────────

/**
 * Advance one logical tick. Pure: reads `state`, returns a fresh one.
 * `abilities` gates platform existence (suppression.js) and, via
 * effectiveParams (suppression.js), the physics params; `constants`
 * is the resolved profile (structural fields included).
 */
export function step(state, input, level, abilities, constants) {
    // Ability overlays apply HERE, not at call sites — a caller cannot
    // forget them (the one-shared-answer rule, suppression.js header).
    const C = effectiveParams(constants ?? DEFAULTS, abilities ?? {});
    const dt = 1 / C.TICK_HZ;
    const inp = input ?? {};

    // Reset key: instant respawn, before any physics (plan §1 — always
    // available; the bot's recovery route and the stuck-pocket escape).
    if (inp.reset) {
        return { ...respawn(state, level, 'reset'), t: state.t + 1 };
    }

    const platforms = activePlatforms(level, abilities);
    const dropping = !!inp.drop;

    // A platform collides from above unless it is one-way AND the
    // player is holding drop (drop-through — one-way platforms never
    // trap: plan §3).
    const landableOn = (p) => isSolid(p) || !dropping;

    // characterGround.cs — pair of downward probes from the feet.
    // Returns the supporting platform (for landedOn) or null.
    const groundUnder = (x, y) => {
        const probeDepth = 0.08;
        for (const dx of [0.05, C.PLAYER_W - 0.05]) {
            const fx = x + dx;
            for (const p of platforms) {
                // Springs are never support: a catch converts to a
                // launch the same tick, so the player never stands on
                // one (standingOn/onGround must not flicker there —
                // canRun's leg detector and the jump logic rely on it).
                if (p.type === 'spring') continue;
                if (!landableOn(p)) continue;
                const top = p.y + p.h;
                if (fx >= p.x && fx <= p.x + p.w
                        && y <= top + 0.001 && y >= top - probeDepth) {
                    return p;
                }
            }
        }
        return null;
    };

    const s = { ...state, t: state.t + 1, respawned: null, landedOn: null, sprungOn: null };

    // OnMovement equivalent. AUTO_RUN forces directionX = +1 — the v1
    // mechanic; with AUTO_RUN off (parity harness; future Brake/Left)
    // it resolves from held keys exactly like the original.
    const directionX = C.AUTO_RUN ? 1 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let pressingKey;
    if (directionX !== 0) {
        s.facing = directionX > 0 ? 1 : -1;
        pressingKey = true;
    } else {
        pressingKey = false;
    }

    // OnJump equivalent — the press EDGE is a held-state transition.
    if (inp.jump && !state.pressingJump) s.desiredJump = true;
    s.pressingJump = !!inp.jump;

    s.onGround = groundUnder(s.x, s.y) !== null;

    // characterJump.cs Update() — buffer + coyote bookkeeping.
    if (C.jumpBuffer > 0 && s.desiredJump) {
        s.jumpBufferCounter += dt;
        if (s.jumpBufferCounter > C.jumpBuffer) {
            s.desiredJump = false;
            s.jumpBufferCounter = 0;
        }
    }
    if (!s.currentlyJumping && !s.onGround) {
        s.coyoteTimeCounter += dt;
    } else {
        s.coyoteTimeCounter = 0;
    }

    // characterJump.cs setPhysics().
    const setPhysics = () => {
        const newGravityY = (-2 * C.jumpHeight) / (C.timeToJumpApex * C.timeToJumpApex);
        s.gravityScale = (newGravityY / C.GRAVITY) * s.gravMultiplier;
    };
    setPhysics();

    // Unity integrates gravity before FixedUpdate; the original mirrors
    // that here, and so do we.
    s.vy += C.GRAVITY * s.gravityScale * dt;

    if (s.desiredJump) {
        // characterJump.cs DoAJump(). calculateGravity is SKIPPED this
        // tick (mirrors the original's early return path) so
        // currentlyJumping survives the launch frame.
        const canCoyote = s.coyoteTimeCounter > 0.03 && s.coyoteTimeCounter < C.coyoteTime;
        if (s.onGround || canCoyote || s.canJumpAgain) {
            s.desiredJump = false;
            s.jumpBufferCounter = 0;
            s.coyoteTimeCounter = 0;
            s.canJumpAgain = (C.maxAirJumps === 1 && !s.canJumpAgain);

            // Recompute gravityScale against gravMultiplier = 1 before
            // sizing the launch. Inherited quirk from the C# original —
            // kept verbatim (see module header).
            s.gravMultiplier = 1;
            setPhysics();

            let jumpSpeed = Math.sqrt(-2 * C.GRAVITY * s.gravityScale * C.jumpHeight);
            if (s.vy > 0) jumpSpeed = Math.max(jumpSpeed - s.vy, 0);
            else if (s.vy < 0) jumpSpeed += Math.abs(s.vy);
            s.vy += jumpSpeed;
            s.currentlyJumping = true;
        }
        if (C.jumpBuffer === 0) s.desiredJump = false;
    } else {
        // characterJump.cs calculateGravity().
        if (s.vy > 0.01) {
            if (s.onGround) {
                s.gravMultiplier = 1;
            } else if (C.variablejumpHeight) {
                s.gravMultiplier = (s.pressingJump && s.currentlyJumping)
                    ? C.upwardMovementMultiplier
                    : C.jumpCutOff;
            } else {
                s.gravMultiplier = C.upwardMovementMultiplier;
            }
        } else if (s.vy < -0.01) {
            s.gravMultiplier = s.onGround ? 1 : C.downwardMovementMultiplier;
        } else {
            if (s.onGround) s.currentlyJumping = false;
            s.gravMultiplier = 1;
        }
        s.vy = clamp(s.vy, -C.speedLimit, 100);
    }

    // GLIDE (plan §8.5, the third gated element): while the jump
    // button is HELD during a NON-JUMP fall whose flight launched from
    // a `glider` pad (walked/dropped off it — never a jump descent or
    // a spring flight: those arcs own their physics), fall speed is
    // capped at GLIDE_FALL_CAP. Pads are existence-gated on the Glide
    // item (suppression.js), so the behavior is unreachable without
    // the item — baseline physics is bit-identical with no params
    // overlay at all, and not holding reproduces the old trajectory
    // exactly (voluntary — the monotonicity-by-construction pattern).
    // A mid-fall press is inert under every ability set (a run-off
    // banks no air jump and coyote closes 0.15s past the lip), so the
    // same glide tape works under every superset. Applied OUTSIDE
    // calculateGravity: a buffered airborne press keeps desiredJump
    // true for the whole jumpBuffer window, which skips
    // calculateGravity — the glide must engage there too.
    if (s.lastSupportType === 'glider' && s.pressingJump && !s.onGround
            && s.vy < -C.GLIDE_FALL_CAP && !s.springFlight
            && !s.currentlyJumping) {
        s.vy = -C.GLIDE_FALL_CAP;
    }

    // characterMovement.cs runWithAcceleration() / direct set.
    const runWithAcceleration = () => {
        const accel = s.onGround ? C.maxAcceleration : C.maxAirAcceleration;
        const decel = s.onGround ? C.maxDecceleration : C.maxAirDeceleration;
        const turn = s.onGround ? C.maxTurnSpeed : C.maxAirTurnSpeed;
        const desiredVx = directionX * Math.max(C.maxSpeed - C.friction, 0);
        let maxSpeedChange;
        if (pressingKey) {
            maxSpeedChange = (sign(directionX) !== sign(s.vx) ? turn : accel) * dt;
        } else {
            maxSpeedChange = decel * dt;
        }
        s.vx = moveTowards(s.vx, desiredVx, maxSpeedChange);
    };
    if (C.useAcceleration) {
        runWithAcceleration();
    } else if (s.onGround) {
        s.vx = directionX * Math.max(C.maxSpeed - C.friction, 0);
    } else {
        runWithAcceleration();
    }

    if (s.onGround && s.vy <= 0) s.canJumpAgain = false;

    const startedAirborne = !s.onGround;

    // moveAndCollide — resolve X then Y (original order). Solid
    // platforms collide on every axis; one-way platforms only catch a
    // FALL that started at/above their top (and never while dropping).
    s.x += s.vx * dt;
    for (const p of platforms) {
        if (!isSolid(p)) continue; // one-way: never blocks horizontally
        if (aabb(s.x, s.y, C.PLAYER_W, C.PLAYER_H, p.x, p.y, p.w, p.h)) {
            if (s.vx > 0) s.x = p.x - C.PLAYER_W;
            else if (s.vx < 0) s.x = p.x + p.w;
            s.vx = 0;
        }
    }
    if (C.SIDE_WALLS && level.size) {
        if (s.x < 0) { s.x = 0; if (s.vx < 0) s.vx = 0; }
        const maxX = level.size.width - C.PLAYER_W;
        if (s.x > maxX) { s.x = maxX; if (s.vx > 0) s.vx = 0; }
    }
    const yBefore = s.y;
    s.y += s.vy * dt;
    let landedPlatform = null;
    for (const p of platforms) {
        if (!aabb(s.x, s.y, C.PLAYER_W, C.PLAYER_H, p.x, p.y, p.w, p.h)) continue;
        const top = p.y + p.h;
        if (isSolid(p)) {
            if (s.vy < 0) {
                s.y = top;
                s.vy = 0;
                landedPlatform = p;
            } else if (s.vy > 0) {
                s.y = p.y - C.PLAYER_H;
                s.vy = 0;
            }
        } else if (p.type === 'spring') {
            if (!dropping && s.vy < 0 && yBefore >= top - 1e-9) {
                // spring catch (plan §8.3): the landing converts into
                // an immediate vertical launch — the player never
                // grounds. Refusable like any one-way catch (holding
                // drop passes through), so a newly-active spring can
                // never trap an unwanted fall (monotonicity, plan §3).
                // Bounce = fresh surface contact: the jump is over
                // (fresh coyote semantics don't apply — never grounded)
                // and the air jump is spent-and-not-restored, so the
                // arc is identical whatever the player did before.
                s.y = top;
                s.vy = springLaunchSpeed(C);
                s.sprungOn = p.id;
                s.currentlyJumping = false;
                s.canJumpAgain = false;
                // Close the coyote window for the whole flight: the
                // counter restarts at 0 when currentlyJumping clears,
                // and a press inside the (0.03, coyoteTime) window
                // would fire a REAL mid-air jump — zero added speed
                // (vy is huge) but currentlyJumping would flip the
                // rise gravity to the held-jump multiplier: a floaty
                // super-bounce far beyond SPRING_RISE. Pinning the
                // counter at coyoteTime keeps the arc deterministic
                // (presses during the flight only feed the jump
                // buffer, exactly like any other airborne press).
                s.coyoteTimeCounter = C.coyoteTime;
                // The bounce owns its whole arc (deterministic — see
                // above): glide is refused for the rest of this
                // flight, like the air jump. Cleared on landing.
                s.springFlight = true;
                s.gravMultiplier = C.variablejumpHeight
                    ? C.jumpCutOff : C.upwardMovementMultiplier;
            }
        } else if (!dropping && s.vy < 0 && yBefore >= top - 1e-9) {
            // one-way catch: falling, started at/above the top
            s.y = top;
            s.vy = 0;
            landedPlatform = p;
        }
    }

    const support = groundUnder(s.x, s.y);
    s.onGround = support !== null;
    s.standingOn = support?.id ?? null;
    // The launch-support memory for the glide branch above: what the
    // player last STOOD on, held across the whole airborne phase (a
    // flight "launched from" that platform). Spring catches don't
    // ground, so a bounce never overwrites it — springFlight excludes
    // those arcs separately.
    if (support) s.lastSupportType = support.type;

    // Landing tick: airborne at move start, grounded after — the
    // re-plan trigger (set only on this tick, bounce's contract).
    if (startedAirborne && s.onGround) {
        s.landedOn = (landedPlatform ?? support).id;
        // The jump is over — clear currentlyJumping so the NEXT lip
        // gets a fresh coyote window. In the Unity original this reset
        // lives in calculateGravity's vy≈0 branch, which works there
        // because C# reads body.velocity.y AFTER the physics solve
        // (resting ground contact ≈ 0). Our transcription integrates
        // gravity into vy BEFORE that branch and zeroes it in collision
        // AFTER, so a grounded runner always shows vy ≈ -1.25 there and
        // that branch never fires — leaving the flag stuck and coyote
        // dead after the first jump of a life. Resetting on the landing
        // edge is observably equivalent to the C#'s grounded-tick reset
        // (while grounded, the only currentlyJumping readers are the
        // coyote accumulator, zeroed anyway, and the rising-gravity
        // branch, which checks onGround first). The solver's arrivedState
        // already models fresh coyote per landing, so this makes the
        // engine match the verified model — solver verdicts, calibration
        // and derived rules are unchanged.
        s.currentlyJumping = false;
        s.springFlight = false;
    }

    // Hazards: non-solid kill AABBs (plan §3 — never collision
    // geometry). Charging is CONTACT-EDGE (see the header): one hit
    // per contact episode per hazard, so a budgeted arc through a
    // spike bed spends exactly one hit however many ticks the crossing
    // overlaps it. Leaving a hazard's box and re-entering charges
    // again (a hop inside a wide patch is two episodes — the sims see
    // exactly that). A hit beyond the budget respawns; MAX_HITS is 0
    // at base and the Shield ability raises it (plan §4.10).
    const prevContacts = state.hazardContacts ?? [];
    const contacts = [];
    for (const hz of level.hazards ?? []) {
        if (aabb(s.x, s.y, C.PLAYER_W, C.PLAYER_H, hz.x, hz.y, hz.w, hz.h)) {
            contacts.push(hz.id);
            if (!prevContacts.includes(hz.id)) {
                s.hits += 1;
                if (s.hits > C.MAX_HITS) {
                    return respawn(s, level, 'hazard');
                }
            }
        }
    }
    s.hazardContacts = contacts;

    // Goal touches (touch-triggered, unlike bounce's landing-triggered
    // goals; the goal-wake placement invariant lives in level.js).
    s.touchedPickups = [];
    s.touchedPortals = [];
    for (const pk of level.pickups ?? []) {
        const b = goalBox(pk, C);
        if (aabb(s.x, s.y, C.PLAYER_W, C.PLAYER_H, b.x, b.y, b.w, b.h)) {
            s.touchedPickups.push(pk.id);
        }
    }
    for (const pt of level.portals ?? []) {
        const b = goalBox(pt, C);
        if (aabb(s.x, s.y, C.PLAYER_W, C.PLAYER_H, b.x, b.y, b.w, b.h)) {
            s.touchedPortals.push(pt.id);
        }
    }

    // Fell off the world (original: y < -5 → resetCharacter, same tick).
    if (s.y < -C.FALL_MARGIN) {
        return respawn(s, level, 'fell');
    }

    return s;
}
