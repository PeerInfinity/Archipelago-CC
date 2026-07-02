/**
 * Single shared suppression + effective-params module for the runner
 * substrate (plan §4.2; the pattern and the reason it exists come
 * from bounceDemo/suppression.js — both the build-time solver and the
 * runtime renderer MUST answer "does this platform exist / what are
 * the physics params under this ability set" through these functions
 * and nothing else, so they cannot diverge).
 *
 * Ability set shape (booleans; a missing key means locked):
 *   { doubleJump, blue }                          — the v1 universe
 *   (+ future: highJump, brake, left, shield — plan §6/§7)
 *
 * Two gating mechanisms, both monotone by construction (plan §3):
 * - EXISTENCE: gated platform types are one-way with drop-through, so
 *   their appearance never removes a route. Pickups, portals, and
 *   hazards are never suppressed.
 * - EFFECTIVE PARAMS: movement abilities overlay physics params
 *   (doubleJump → maxAirJumps 1). Using them is voluntary, so any
 *   trajectory possible without the ability survives gaining it.
 */

const PLATFORM_GATES = {
    ground: null,
    blue: 'blue',
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
    if (!abilities?.doubleJump) return constants;
    return { ...constants, maxAirJumps: 1 };
}

export function noAbilities() {
    return { doubleJump: false, blue: false };
}

export function allAbilities() {
    return { doubleJump: true, blue: true };
}
