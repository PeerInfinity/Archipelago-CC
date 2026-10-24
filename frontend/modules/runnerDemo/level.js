/**
 * Runner level data model + structural validator (plan §4.2).
 *
 * A level is authored/generated GEOMETRY; access rules are derived
 * from it by the solver, never stored in it. Model notes (units and
 * axes follow physics.js — toolkit Unity units, +y UP, NOT bounce's
 * y-down px):
 *
 * - `platforms[].x/y` is the BOTTOM-LEFT corner, `w/h` the extent.
 *   `type` is 'ground' (solid, always exists) or a gated ONE-WAY type
 *   (suppression.js owns the vocabulary).
 * - `hazards[]` are static kill AABBs (x/y bottom-left like
 *   platforms) — non-solid, never suppressed, never collision
 *   geometry (plan §3).
 * - `pickups[].x/y` and `portals[].x/y` are CENTERS of touch boxes
 *   (GOAL_HALF half-extent). `on` is LOAD-BEARING: the goal-wake
 *   invariant ties goal reachability to HOST reachability, so the
 *   verifier needs no trajectory-level goal checks. `portals[].arrow`
 *   is the exit direction glyph; `exitName` stays null in fixtures
 *   (the procgen pipeline fills it when stitching regions).
 * - `spawn` is the standard entrance (bottom-left of the strip): the
 *   player starts every region visit here (plan §1).
 *
 * The validator is a STRUCTURAL backstop, not the authority on
 * playability — reachability is the solver's business (phase 3) and
 * calibrated spacing is the generator's (phase 5). It enforces the
 * invariants those layers assume:
 *
 * 1. GOAL WAKE (plan §4.2): every pickup/portal touch box intersects
 *    the player's standing box at the RIGHTMOST stand on its host
 *    platform — so any landing on the host followed by default
 *    auto-run (no input) crosses the goal — and the host's run
 *    corridor is clear of solid platforms and hazards, so that run
 *    can neither be blocked nor killed. Together: goal-reachable ⇔
 *    host-reachable.
 * 2. STUCK-FREE (plan §1/§3): no wall pockets — a solid wall rising
 *    from a solid floor higher than any ability set could ever jump
 *    would pin the auto-runner (reset-only escape); the generator
 *    forbids them outright and this check catches the certain cases.
 *    The rise threshold deliberately OVER-estimates jump reach
 *    (legit climbable ledges must pass; borderline geometry is the
 *    solver's to judge).
 * 3. HAZARDS CLEAR OF WALK SURFACES: no hazard embedded inside a
 *    platform body, and no platform whose ENTIRE walk surface is
 *    lethal (partial floor spikes are legitimate — a verified route
 *    jumps them; a fully-lethal surface can't host any landing).
 * 4. SPAWN CLEAR: the spawn standing box overlaps no solid platform
 *    and no hazard, and solid ground exists below the spawn footprint
 *    (the spawn drop must land somewhere under EVERY ability set).
 */

import { DEFAULTS } from './physics.js';
import { KNOWN_PLATFORM_TYPES } from './suppression.js';

const ARROWS = ['up', 'down', 'left', 'right'];

/** Foot-probe inset from physics.js groundUnder (0.05): the rightmost
 *  stand on a platform has the leading foot probe at the right edge. */
const FOOT_INSET = 0.05;

/** How much higher than a single full jump a wall may rise before it
 *  is certainly unclimbable: double jump roughly doubles the rise
 *  (each launch re-derives jumpSpeed from jumpHeight), plus margin so
 *  the backstop never rejects geometry the solver could still prove. */
const RISE_FACTOR = 2 * 1.15;

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** A goal's touch box (x/y are centers; w/h optional) — mirrors
 *  physics.js goalBox. */
export function goalBox(g, C = DEFAULTS) {
    const hw = (g.w ?? C.GOAL_HALF * 2) / 2;
    const hh = (g.h ?? C.GOAL_HALF * 2) / 2;
    return { x: g.x - hw, y: g.y - hh, w: hw * 2, h: hh * 2 };
}

const isSolid = (p) => p.type === 'ground';
const topOf = (p) => p.y + p.h;

/** The player standing box at the rightmost REACHABLE stand on
 *  `host` — clamped by the level's right side wall (SIDE_WALLS pins
 *  the auto-runner at width - PLAYER_W when the host meets it). */
function rightmostStandBox(host, level, C) {
    return {
        x: Math.min(host.x + host.w - FOOT_INSET, level.size.width - C.PLAYER_W),
        y: topOf(host),
        w: C.PLAYER_W,
        h: C.PLAYER_H,
    };
}

/** The auto-run corridor over a host's top: the space the player body
 *  sweeps running the platform end to end (plus the overhang at the
 *  right edge before flying off), clamped to the level. */
function runCorridor(host, level, C) {
    const right = Math.min(host.x + host.w + C.PLAYER_W, level.size.width);
    return {
        x: host.x,
        y: topOf(host) + 1e-6, // exclude the host surface itself
        w: right - host.x,
        h: C.PLAYER_H,
    };
}

function checkGoals(errors, level, key, C) {
    const seen = new Set();
    const byId = new Map(level.platforms.map((p) => [p.id, p]));
    for (const g of level[key] ?? []) {
        if (!g.id) errors.push(`${key}: entry without id`);
        else if (seen.has(g.id)) errors.push(`${key}: duplicate id '${g.id}'`);
        else seen.add(g.id);
        if (typeof g.x !== 'number' || typeof g.y !== 'number') {
            errors.push(`${key} '${g.id}': x/y must be numbers`);
            continue;
        }
        if (g.x < 0 || g.x > level.size.width || g.y < 0 || g.y > level.size.height) {
            errors.push(`${key} '${g.id}': position (${g.x},${g.y}) outside level bounds`);
        }
        const host = byId.get(g.on);
        if (!host) {
            errors.push(`${key} '${g.id}': on='${g.on}' references no platform`);
            continue;
        }
        // Springs can't host goals: the goal-wake invariant is defined
        // by STANDING at the host's right end, and a spring converts
        // every landing into a launch — no stand exists.
        if (host.type === 'spring') {
            errors.push(`${key} '${g.id}': hosted on spring '${g.on}' `
                + '(springs cannot host goals — no standing wake)');
            continue;
        }
        // Goal-wake invariant: touched while standing at the host's
        // right end ⇒ touched by every landing's default auto-run.
        if (!rectsOverlap(goalBox(g, C), rightmostStandBox(host, level, C))) {
            errors.push(`${key} '${g.id}': outside the auto-run wake of host `
                + `'${g.on}' (must overlap the standing box at the host's right end)`);
        }
    }
    return seen;
}

/**
 * Validate a level. Returns an array of error strings — empty means
 * valid. `constants` must be the resolved physics profile the level
 * will play under (the wake/pocket checks are body- and jump-sized).
 */
export function validateLevel(level, constants = DEFAULTS) {
    const C = constants;
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

    // ── platforms: ids, types, bounds ──
    const ids = new Set();
    for (const p of level.platforms) {
        if (!p.id) errors.push('platforms: entry without id');
        else if (ids.has(p.id)) errors.push(`platforms: duplicate id '${p.id}'`);
        else ids.add(p.id);
        if (!KNOWN_PLATFORM_TYPES.includes(p.type)) {
            errors.push(`platform '${p.id}': unknown type '${p.type}'`);
        }
        if (![p.x, p.y, p.w, p.h].every((v) => typeof v === 'number')) {
            errors.push(`platform '${p.id}': x/y/w/h must be numbers`);
        } else if (p.w <= 0 || p.h <= 0) {
            errors.push(`platform '${p.id}': w/h must be positive`);
        } else if (p.x < 0 || p.x + p.w > level.size.width
                || p.y < 0 || topOf(p) > level.size.height) {
            errors.push(`platform '${p.id}': rect outside level bounds`);
        }
    }

    // ── hazards: shape, not embedded in platforms, surfaces stay usable ──
    const hazardIds = new Set();
    for (const hz of level.hazards ?? []) {
        if (!hz.id) errors.push('hazards: entry without id');
        else if (hazardIds.has(hz.id)) errors.push(`hazards: duplicate id '${hz.id}'`);
        else hazardIds.add(hz.id);
        if (![hz.x, hz.y, hz.w, hz.h].every((v) => typeof v === 'number')
                || hz.w <= 0 || hz.h <= 0) {
            errors.push(`hazard '${hz.id}': x/y/w/h must be positive-extent numbers`);
            continue;
        }
        for (const p of level.platforms) {
            if (rectsOverlap(hz, p)) {
                errors.push(`hazard '${hz.id}': embedded in platform '${p.id}'`);
            }
        }
    }
    // Fully-lethal walk surface: no platform may have its entire top
    // span covered by hazards at standing height (no safe landing).
    for (const p of level.platforms) {
        const band = { x: p.x, y: topOf(p), w: p.w, h: C.PLAYER_H };
        const cover = (level.hazards ?? [])
            .filter((hz) => rectsOverlap(hz, band))
            .map((hz) => [Math.max(hz.x, band.x), Math.min(hz.x + hz.w, band.x + band.w)])
            .sort((a, b) => a[0] - b[0]);
        let reach = band.x;
        for (const [lo, hi] of cover) {
            if (lo > reach) break; // gap in coverage — safe spot exists
            reach = Math.max(reach, hi);
        }
        if (cover.length && reach >= band.x + band.w) {
            errors.push(`platform '${p.id}': entire walk surface is covered by hazards`);
        }
    }

    // ── goals (wake invariant) + portal shape ──
    checkGoals(errors, level, 'pickups', C);
    const portalIds = checkGoals(errors, level, 'portals', C);
    for (const pt of level.portals ?? []) {
        if (pt.arrow !== undefined && pt.arrow !== null && !ARROWS.includes(pt.arrow)) {
            errors.push(`portal '${pt.id}': bad arrow '${pt.arrow}'`);
        }
    }
    if (portalIds.size === 0) errors.push('level has no portals (regions need exits)');

    // Goal hosts must have BLOCK-free and HAZARD-free run corridors:
    // a solid mid-host wall or a wake hazard would break goal-reach ⇔
    // host-reach (some landings reach the host but not the goal).
    const goalHostIds = new Set(
        [...(level.pickups ?? []), ...(level.portals ?? [])].map((g) => g.on));
    const byId = new Map(level.platforms.map((p) => [p.id, p]));
    for (const hostId of goalHostIds) {
        const host = byId.get(hostId);
        if (!host) continue; // already reported by checkGoals
        const corridor = runCorridor(host, level, C);
        for (const p of level.platforms) {
            if (p.id !== hostId && isSolid(p) && rectsOverlap(p, corridor)) {
                errors.push(`goal host '${hostId}': run corridor blocked by `
                    + `solid platform '${p.id}'`);
            }
        }
        for (const hz of level.hazards ?? []) {
            if (rectsOverlap(hz, corridor)) {
                errors.push(`goal host '${hostId}': hazard '${hz.id}' in the run corridor`);
            }
        }
    }

    // ── stuck-free geometry: no unclimbable wall pockets ──
    // A solid wall rising from a solid floor's top span pins the
    // auto-runner; if the rise exceeds what ANY ability set could
    // jump (double jump + margin) it is a certain pocket. One-way
    // platforms never wall (no horizontal collision) and never floor
    // a pocket (drop-through escapes).
    const maxRise = C.jumpHeight * RISE_FACTOR;
    for (const wall of level.platforms) {
        if (!isSolid(wall)) continue;
        for (const floor of level.platforms) {
            if (floor === wall || !isSolid(floor)) continue;
            const floorTop = topOf(floor);
            const rise = topOf(wall) - floorTop;
            if (rise <= maxRise) continue;
            // wall's left face inside the floor's walkable span…
            if (wall.x <= floor.x || wall.x > floor.x + floor.w + C.PLAYER_W) continue;
            // …and actually blocking the standing band (not an
            // overhang the player runs under)
            if (wall.y >= floorTop + C.PLAYER_H || topOf(wall) <= floorTop) continue;
            errors.push(`wall pocket: solid '${wall.id}' rises ${rise.toFixed(2)} `
                + `above floor '${floor.id}' (max climbable ~${maxRise.toFixed(2)})`);
        }
    }

    // ── spawn clear ──
    if (!level.spawn || typeof level.spawn.x !== 'number' || typeof level.spawn.y !== 'number') {
        errors.push('spawn.{x,y} must be numbers');
    } else {
        const box = { x: level.spawn.x, y: level.spawn.y, w: C.PLAYER_W, h: C.PLAYER_H };
        if (box.x < 0 || box.x + box.w > level.size.width
                || box.y < 0 || box.y + box.h > level.size.height) {
            errors.push('spawn: standing box outside level bounds');
        }
        for (const p of level.platforms) {
            if (isSolid(p) && rectsOverlap(box, p)) {
                errors.push(`spawn: standing box overlaps solid platform '${p.id}'`);
            }
        }
        for (const hz of level.hazards ?? []) {
            if (rectsOverlap(box, hz)) {
                errors.push(`spawn: standing box overlaps hazard '${hz.id}'`);
            }
        }
        // solid ground somewhere below the spawn footprint — the drop
        // must land under the EMPTY ability set too
        const underFoot = level.platforms.some((p) => isSolid(p)
            && topOf(p) <= box.y
            && p.x < box.x + box.w - FOOT_INSET && p.x + p.w > box.x + FOOT_INSET);
        if (!underFoot) {
            errors.push('spawn: no solid ground below the spawn footprint');
        }
    }

    return errors;
}
