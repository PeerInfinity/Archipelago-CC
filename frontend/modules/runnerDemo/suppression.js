/**
 * Single shared suppression + effective-params module for the runner
 * substrate (plan §4.2; the pattern and the reason it exists come
 * from bounceDemo/suppression.js — both the build-time solver and the
 * runtime renderer MUST answer "does this platform exist / what are
 * the physics params under this ability set" through these functions
 * and nothing else, so they cannot diverge).
 *
 * Ability set shape (booleans; a missing key means locked):
 *   { doubleJump, blue, spring, glide, shield }   — the v1.1 universe
 *   (+ future: highJump, brake, left — plan §6/§7)
 *
 * Two gating mechanisms, both monotone by construction (plan §3):
 * - EXISTENCE: gated platform types are one-way with drop-through, so
 *   their appearance never removes a route. Springs additionally
 *   launch instead of landing (physics.js) — but stay refusable via
 *   the same drop-through, so a newly-active spring can never trap a
 *   fall the player didn't want. Pickups, portals, and hazards are
 *   never suppressed.
 * - EFFECTIVE PARAMS: movement abilities overlay physics params
 *   (doubleJump → maxAirJumps 1). Using them is voluntary, so any
 *   trajectory possible without the ability survives gaining it.
 *   The Shield (plan §4.10) is the same mechanism on the DEATH
 *   THRESHOLD instead of movement: shield → MAX_HITS 1 (the hit
 *   budget = the collected count, NOT 1+count — zero shields keep
 *   any hit lethal, byte-identical to v1). Trajectories are
 *   untouched (a hit is a knockback-free counter tick), so gaining
 *   it only ever ADDS survivable outcomes — monotone by construction.
 */

const PLATFORM_GATES = {
    ground: null,
    // UNGATED one-way (drop-through) — the reward-shelf platform
    // (plan §8.2/§8.6: upper-lane platforms are ALWAYS drop-through,
    // independent of gating). Existence-wise it behaves like ground;
    // collision-wise like blue with the item held.
    oneway: null,
    blue: 'blue',
    spring: 'spring',
    // Glide pad (plan §8.5/§8.7 step 4): a one-way platform whose
    // NON-JUMP fall-offs glide (hold jump → fall speed capped, see
    // physics.js). The Glide item gates the PAD's existence — the
    // glide behavior itself needs no params overlay, because a flight
    // can only launch from a pad that exists.
    glider: 'glide',
};

/** The platform-type vocabulary (level.js validates against it). */
export const KNOWN_PLATFORM_TYPES = Object.freeze(Object.keys(PLATFORM_GATES));

/**
 * The ability gating a platform's existence (null = always exists).
 * A per-platform `gate` field overrides the type's gate. Production
 * levels NEVER set it — every production gated type is one-way by
 * design (plan §3) — it exists so deriveRules.test.js can plant the
 * non-monotone level the verifier's tripwire must catch (a SOLID
 * `ground` platform gated on an ability, blocking a corridor).
 */
export function platformGate(platform) {
    if (platform.gate !== undefined) return platform.gate;
    const gate = PLATFORM_GATES[platform.type];
    if (gate === undefined) {
        throw new Error(`runnerDemo: unknown platform type '${platform.type}'`);
    }
    return gate;
}

export function isPlatformActive(platform, abilities) {
    const gate = platformGate(platform);
    return gate === null || !!abilities[gate];
}

export function activePlatforms(level, abilities) {
    return level.platforms.filter((p) => isPlatformActive(p, abilities));
}

/**
 * Physics params under an ability set. Overlay-only: base constants
 * come in, a (possibly identical) constants object comes out. The
 * solver keys its reachability-table signatures on both the active
 * geometry AND this overlay (deriveRules signature dedup).
 */
export function effectiveParams(constants, abilities) {
    const dj = !!abilities?.doubleJump;
    const shield = !!abilities?.shield;
    if (!dj && !shield) return constants;
    const out = { ...constants };
    if (dj) out.maxAirJumps = 1;
    if (shield) out.MAX_HITS = 1; // the hit budget = the collected count (v1: 0 or 1)
    return out;
}

export function noAbilities() {
    return { doubleJump: false, blue: false, spring: false, glide: false, shield: false };
}

export function allAbilities() {
    return { doubleJump: true, blue: true, spring: true, glide: true, shield: true };
}
