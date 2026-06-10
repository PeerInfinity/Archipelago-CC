/**
 * Bounce Demo level data model — build-order step 3
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * A level is authored/generated GEOMETRY; access rules are derived
 * from it by the solver, never stored in it. Model notes from the
 * step-3 review pass (the plan doc's "Level data model" section is the
 * authoritative description):
 *
 * - All positions (platforms, springs, jetpacks, pickups, portals) are
 *   CENTERS in level-local space; y increases downward; the entrance
 *   is implicitly bottom-center (see physics.spawnState).
 * - Platform width is the global PLATFORM_WIDTH constant — no
 *   per-platform width in v1.
 * - `springs[].on` / `jetpacks[].on` are LOAD-BEARING: they decide
 *   which platform's launch is boosted and tie the item's existence to
 *   its host (suppression.js).
 * - `pickups[].on` and `portals[].on` are LOAD-BEARING too: both are
 *   triggered by LANDING on the host platform, so goal accessibility
 *   is exactly host reachability. Their x/y is for rendering.
 * - `portals[].target_region` stays null in fixtures; the procgen
 *   pipeline fills it when stitching regions.
 */

const PLATFORM_TYPES = new Set(['green', 'blue', 'brown']);

function checkEntities(errors, level, key, { requireOn } = {}) {
    const seen = new Set();
    const platformIds = new Set(level.platforms?.map((p) => p.id) ?? []);
    for (const e of level[key] ?? []) {
        if (!e.id) errors.push(`${key}: entry without id`);
        else if (seen.has(e.id)) errors.push(`${key}: duplicate id '${e.id}'`);
        else seen.add(e.id);
        if (typeof e.x !== 'number' || typeof e.y !== 'number') {
            errors.push(`${key} '${e.id}': x/y must be numbers`);
        } else if (e.x < 0 || e.x > level.size.width || e.y < 0 || e.y > level.size.height) {
            errors.push(`${key} '${e.id}': position (${e.x},${e.y}) outside level bounds`);
        }
        if (e.on !== undefined && !platformIds.has(e.on)) {
            errors.push(`${key} '${e.id}': on='${e.on}' references no platform`);
        }
        if (requireOn && e.on === undefined) {
            errors.push(`${key} '${e.id}': missing 'on' (host platform)`);
        }
    }
    return seen;
}

/**
 * Validate a level's shape. Returns an array of error strings — empty
 * means valid. Geometry *quality* (reachability, spacing) is the
 * solver's and the generator's business, not the validator's.
 */
export function validateLevel(level) {
    const errors = [];
    if (!level || typeof level !== 'object') return ['level must be an object'];
    if (!level.id) errors.push('missing level id');
    if (!level.size || !(level.size.width > 0) || !(level.size.height > 0)) {
        errors.push('size.{width,height} must be positive numbers');
        return errors; // bounds checks below need a valid size
    }

    if (!Array.isArray(level.platforms) || level.platforms.length === 0) {
        errors.push('platforms must be a non-empty array');
        return errors;
    }
    const platformIds = new Set();
    for (const p of level.platforms) {
        if (!p.id) errors.push('platforms: entry without id');
        else if (platformIds.has(p.id)) errors.push(`platforms: duplicate id '${p.id}'`);
        else platformIds.add(p.id);
        if (!PLATFORM_TYPES.has(p.type)) {
            errors.push(`platform '${p.id}': unknown type '${p.type}'`);
        }
        if (typeof p.x !== 'number' || typeof p.y !== 'number') {
            errors.push(`platform '${p.id}': x/y must be numbers`);
        } else if (p.x < 0 || p.x > level.size.width || p.y < 0 || p.y > level.size.height) {
            errors.push(`platform '${p.id}': position (${p.x},${p.y}) outside level bounds`);
        }
    }

    checkEntities(errors, level, 'springs', { requireOn: true });
    checkEntities(errors, level, 'jetpacks', { requireOn: true });
    // pickups and portals are landing-triggered, so hosts are semantic
    checkEntities(errors, level, 'pickups', { requireOn: true });
    const portalIds = checkEntities(errors, level, 'portals', { requireOn: true });
    for (const pt of level.portals ?? []) {
        if (pt.direction !== undefined
            && !['up', 'down', 'left', 'right'].includes(pt.direction)) {
            errors.push(`portal '${pt.id}': bad direction '${pt.direction}'`);
        }
    }
    if (portalIds.size === 0) errors.push('level has no portals (regions need exits)');

    return errors;
}
