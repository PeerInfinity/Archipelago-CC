/**
 * Side-exit transform — build-order step 5
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * The procgen grid hands each region a set of exit sides (N/E/S/W,
 * wherever a neighbor exists). This transform attaches one exit
 * platform + landing-entered portal per requested side to a base
 * level, so each side gets its own DERIVED access rule (decision
 * 2026-06-09: per-side portals, not one completion rule).
 *
 * Conventions (v1):
 * - N reuses the level's existing 'up' portal/platform when present
 *   (fixtures author their climb to end at it); otherwise a platform
 *   is added near the top center.
 * - E/W platforms sit at the side edges at low height — reachable by
 *   drifting from the bottom of the climb, so their derived rules are
 *   typically the matching arrow.
 * - S sits low and right-of-center (never in the spawn column — a
 *   platform there would intercept the spawn fall and instantly exit).
 * - All added platforms are green (always active), so the transform
 *   can never introduce non-monotone interception; it CAN change base
 *   rules, which is why the verifier runs on the TRANSFORMED level.
 *
 * Pure: returns { level, sidePortals } without mutating the input.
 * sidePortals maps side -> portal id (for the renderer's arrows and
 * the sidecar payload).
 */

const DIRECTIONS = { N: 'up', S: 'down', E: 'right', W: 'left' };

function sideSpot(side, size) {
    switch (side) {
        case 'N': return { x: size.width / 2, y: 70 };
        case 'S': return { x: size.width / 2 + 90, y: size.height - 70 };
        case 'E': return { x: size.width - 50, y: size.height - 220 };
        case 'W': return { x: 50, y: size.height - 220 };
        default: throw new Error(`attachSideExits: unknown side '${side}'`);
    }
}

export function attachSideExits(level, sides) {
    const platforms = [...level.platforms];
    const portals = [];
    const sidePortals = {};

    const upPortal = (level.portals ?? []).find((p) => p.direction === 'up');
    for (const side of sides) {
        if (side === 'N' && upPortal) {
            portals.push(upPortal);
            sidePortals.N = upPortal.id;
            continue;
        }
        const spot = sideSpot(side, level.size);
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
