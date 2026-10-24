/**
 * Side-exit transform.
 *
 * The procgen grid hands each region a set of exit sides (N/E/S/W,
 * wherever a neighbor exists). This transform attaches one exit
 * platform + landing-entered portal per requested side to a base
 * level, so each side gets its own DERIVED access rule (decision
 * 2026-06-09: per-side portals, not one completion rule).
 *
 * Two placement modes (opts.placement, decision 2026-06-09 — the
 * original design never required portal position to match direction):
 *
 * 'directional' (default — as first implemented):
 * - N reuses the level's existing 'up' portal/platform when present
 *   (fixtures author their climb to end at it); otherwise a platform
 *   is added near the top center.
 * - E/W platforms sit at the side edges at low height — reachable by
 *   drifting from the bottom of the climb, so their derived rules are
 *   typically the matching arrow.
 * - S sits low and right-of-center (never in the spawn column — a
 *   platform there would intercept the spawn fall and instantly exit).
 *
 * 'arbitrary':
 * - Every side (including N) gets an interior spot from a candidate
 *   list — position carries no directional meaning; the portal's
 *   `direction` arrow alone shows where it leads. Any authored portals
 *   are DROPPED (their host platforms stay as plain geometry) so the
 *   level's only portals are the side portals. Candidates avoid the
 *   spawn column and skip spots vertically near existing platforms
 *   they horizontally overlap (landing interception). Pass opts.rng
 *   (createRng-shaped) to shuffle candidate order per level.
 *
 * All added platforms are green (always active), so the transform can
 * never introduce non-monotone interception; it CAN change base rules,
 * which is why the verifier runs on the TRANSFORMED level.
 *
 * Pure: returns { level, sidePortals } without mutating the input.
 * sidePortals maps side -> portal id (for the renderer's arrows and
 * the sidecar payload).
 */

/** side → the `direction` arrow a portal on that side points along. */
export const SIDE_DIRECTIONS = Object.freeze({ N: 'up', S: 'down', E: 'right', W: 'left' });
/** …and the inverse: the arrow that NAMES a side. */
export const DIRECTION_SIDES = Object.freeze({ up: 'N', down: 'S', right: 'E', left: 'W' });
const DIRECTIONS = SIDE_DIRECTIONS;

const SIDE_EXIT_ID = /^side_exit_([NSEW])$/;

/**
 * ⛓⛓ **THE ONE ANSWER TO "WHICH GRID SIDE IS THIS LEVEL PORTAL ON"** (H6b).
 * Two readers had their own regex for this — the assembler's minted-name
 * convention and `bounceRegionEditorUI._specsFromLevelPortals` — and they are
 * the same question, so it is one function.
 *
 * ⛔ **THE ARROW IS READ FIRST, AND THAT IS A MEASUREMENT, NOT A STYLE PICK.**
 * `side_exit_<side>` is a MINTED name, and one producer OUTLIVES it:
 * `bounceLibraryEntry.instantiateLibraryEntryForSpecs` relabels a captured
 * portal onto a different side — it re-keys `sidePortals` and re-points the
 * portal's `direction`, and deliberately leaves the id alone (the id is what
 * `ap_locations` and the carried rules key on). After that relabel the id says
 * `side_exit_N` while the portal really sits on E, and only the arrow is
 * current. Measured over every committed bounce level (25 sidecar regions) and
 * every generated one in the sphere + top-down byte-identity dumps (36
 * portals): 0 carry no `direction`, and 0 disagree with their id — so the two
 * orders differ ONLY on a relabelled entry, where the arrow is the right answer.
 *
 * @returns {'N'|'S'|'E'|'W'|null} null when the portal names no side at all.
 */
export function portalSide(portal) {
    const byArrow = DIRECTION_SIDES[portal?.direction];
    if (byArrow) return byArrow;
    const m = SIDE_EXIT_ID.exec(portal?.id ?? '');
    return m ? m[1] : null;
}

/**
 * ⛓ side → the id of the LEVEL'S OWN portal on that side. First portal wins,
 * in the level's own order — a hand-edited level can carry two portals on one
 * side, and a re-assembly has to be deterministic about which one it names.
 * A side with no portal is absent, and the caller mints (see
 * `assembleBounceRegionFromLevel`).
 */
export function portalIdsBySide(level) {
    const bySide = new Map();
    for (const p of level?.portals ?? []) {
        const side = portalSide(p);
        if (side && p?.id && !bySide.has(side)) bySide.set(side, p.id);
    }
    return bySide;
}

function sideSpot(side, size) {
    switch (side) {
        case 'N': return { x: size.width / 2, y: 70 };
        case 'S': return { x: size.width / 2 + 90, y: size.height - 70 };
        case 'E': return { x: size.width - 50, y: size.height - 220 };
        case 'W': return { x: 50, y: size.height - 220 };
        default: throw new Error(`attachSideExits: unknown side '${side}'`);
    }
}

// Interior candidate spots for 'arbitrary' placement, as fractions of
// level size. None in the spawn column (player half-width + platform
// span keeps |x - width/2| > 0.18*width clear for typical sizes).
const ARBITRARY_SPOTS = [
    { fx: 0.25, fy: 0.30 }, { fx: 0.75, fy: 0.45 },
    { fx: 0.30, fy: 0.62 }, { fx: 0.70, fy: 0.78 },
    { fx: 0.20, fy: 0.50 }, { fx: 0.80, fy: 0.30 },
    { fx: 0.35, fy: 0.40 }, { fx: 0.65, fy: 0.60 },
];

/** A spot is bad if an existing platform overlaps it horizontally and
 *  sits within 60px vertically (landing interception territory). */
function clearOfPlatforms(x, y, platforms) {
    return !platforms.some((p) => Math.abs(p.x - x) < 102 && Math.abs(p.y - y) < 60);
}

export function attachSideExits(level, sides, opts = {}) {
    const placement = opts.placement ?? 'directional';
    const platforms = [...level.platforms];
    const portals = [];
    const sidePortals = {};

    let arbitrarySpots = null;
    if (placement === 'arbitrary') {
        arbitrarySpots = [...ARBITRARY_SPOTS];
        if (opts.rng) opts.rng.shuffle(arbitrarySpots);
    } else if (placement !== 'directional') {
        throw new Error(`attachSideExits: unknown placement '${placement}'`);
    }

    const upPortal = (level.portals ?? []).find((p) => p.direction === 'up');
    for (const side of sides) {
        if (placement === 'directional' && side === 'N' && upPortal) {
            portals.push(upPortal);
            sidePortals.N = upPortal.id;
            continue;
        }
        let spot;
        if (placement === 'arbitrary') {
            const idx = arbitrarySpots.findIndex((s) => clearOfPlatforms(
                s.fx * level.size.width, s.fy * level.size.height, level.platforms));
            const f = idx >= 0 ? arbitrarySpots.splice(idx, 1)[0] : arbitrarySpots.shift();
            spot = { x: f.fx * level.size.width, y: f.fy * level.size.height };
        } else {
            spot = sideSpot(side, level.size);
        }
        const platformId = `side_pf_${side}`;
        const portalId = `side_exit_${side}`;
        platforms.push({ id: platformId, x: spot.x, y: spot.y, type: 'green' });
        portals.push({
            id: portalId,
            x: spot.x,
            y: spot.y - 20,
            on: platformId,
            target_region: null,
            direction: DIRECTIONS[side],
        });
        sidePortals[side] = portalId;
    }

    return {
        level: { ...level, platforms, portals },
        sidePortals,
    };
}
