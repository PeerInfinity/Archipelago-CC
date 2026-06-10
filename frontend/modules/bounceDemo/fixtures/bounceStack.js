/**
 * Fixture: the no-input bounce stack — the v2 plan's start level
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md). All
 * platforms sit on the vertical center line; the player bounces to the
 * top with ZERO input and ZERO abilities (arrow keys are themselves
 * unlockable items, so the start level must be playable without them).
 *
 * Ground truth (encoded as assertions in physics.test.js, and later
 * against the derive-rules verifier): the pickup and the portal are
 * reachable with the empty ability set.
 *
 * Platform spacing is 120px; a plain bounce apexes ~169px above the
 * launch platform, so each cycle gains exactly one platform.
 */
export const bounceStack = {
    id: 'bounce_stack',
    size: { width: 400, height: 1200 },
    platforms: [
        { id: 'p0', x: 200, y: 1100, type: 'green' },
        { id: 'p1', x: 200, y: 980, type: 'green' },
        { id: 'p2', x: 200, y: 860, type: 'green' },
        { id: 'p3', x: 200, y: 740, type: 'green' },
        { id: 'p4', x: 200, y: 620, type: 'green' },
        { id: 'p5', x: 200, y: 500, type: 'green' },
        { id: 'p6', x: 200, y: 380, type: 'green' },
        { id: 'p7', x: 200, y: 260, type: 'green' },
        { id: 'p8', x: 200, y: 140, type: 'green' },
        { id: 'p9', x: 200, y: 60, type: 'green' }, // exit platform
    ],
    springs: [],
    jetpacks: [],
    pickups: [
        { id: 'loc_arrow', x: 200, y: 120, on: 'p8' },
    ],
    portals: [
        { id: 'exit_up', x: 200, y: 40, on: 'p9', target_region: null, direction: 'up' },
    ],
};

export default bounceStack;
