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

export function isPlatformActive(platform, abilities) {
    const gate = PLATFORM_GATES[platform.type];
    if (gate === undefined) {
        throw new Error(`runnerDemo: unknown platform type '${platform.type}'`);
    }
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
