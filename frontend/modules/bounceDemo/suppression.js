/**
 * Single shared suppression function for the Bounce Demo substrate.
 *
 * Both the build-time solver (`canJump` sampling `step`) and the
 * runtime renderer MUST decide "does this platform/spring/jetpack
 * exist under this ability set" through these functions and nothing
 * else — divergence here is exactly the consistency bug the plan
 * warns about (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md,
 * "Design principles").
 *
 * Ability set shape: { left, right, springs, jetpacks, blue, brown }
 * booleans; a missing key means locked. Pickups and portals are never
 * suppressed — their accessibility is derived from reachability, not
 * authored.
 */

const PLATFORM_GATES = {
    green: null,
    blue: 'blue',
    brown: 'brown',
};

export function isPlatformActive(platform, abilities) {
    const gate = PLATFORM_GATES[platform.type];
    if (gate === undefined) {
        throw new Error(`bounceDemo: unknown platform type '${platform.type}'`);
    }
    return gate === null || !!abilities[gate];
}

export function activePlatforms(level, abilities) {
    return level.platforms.filter((p) => isPlatformActive(p, abilities));
}

/** Springs exist only when unlocked AND their host platform exists. */
export function activeSprings(level, abilities) {
    if (!abilities.springs) return [];
    const hosts = new Set(activePlatforms(level, abilities).map((p) => p.id));
    return (level.springs ?? []).filter((s) => hosts.has(s.on));
}

/** Jetpacks follow the same rule as springs. */
export function activeJetpacks(level, abilities) {
    if (!abilities.jetpacks) return [];
    const hosts = new Set(activePlatforms(level, abilities).map((p) => p.id));
    return (level.jetpacks ?? []).filter((j) => hosts.has(j.on));
}

export function noAbilities() {
    return {
        left: false,
        right: false,
        springs: false,
        jetpacks: false,
        blue: false,
        brown: false,
    };
}

export function allAbilities() {
    return {
        left: true,
        right: true,
        springs: true,
        jetpacks: true,
        blue: true,
        brown: true,
    };
}
