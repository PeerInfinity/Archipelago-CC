/**
 * Fixture: the spring gap — a single-requirement level.
 *
 * A plain bounce apexes ~169px; the p1→p2 gap is 420px, bridgeable
 * only by the spring on p1 (~484px apex). p3 sits ABOVE the spring's
 * apex (496 from p1), so the spring cannot overshoot p2 onto p3 — the
 * route is forced p0→p1→(spring)→p2→p3. Everything stays on the
 * vertical center line, so no arrows are needed. (The first draft had
 * a 320px gap; the ground-truth tests caught the spring sailing past
 * p2 and landing on p3 — per-jump semantics make overshoot real.)
 *
 * Ground truth (encoded in fixtures.test.js, later re-derived by the
 * verifier): p0 and p1 require {}; p2, p3, the pickup and the portal
 * require exactly {springs}.
 */
export const springGap = {
    id: 'spring_gap',
    size: { width: 400, height: 1200 },
    platforms: [
        { id: 'p0', x: 200, y: 1100, type: 'green' },
        { id: 'p1', x: 200, y: 980, type: 'green' },
        { id: 'p2', x: 200, y: 560, type: 'green' }, // 420 above p1: spring only
        { id: 'p3', x: 200, y: 440, type: 'green' },
        { id: 'p4', x: 200, y: 340, type: 'green' }, // exit platform
    ],
    springs: [
        { id: 's0', x: 200, y: 975, on: 'p1' },
    ],
    jetpacks: [],
    pickups: [
        { id: 'loc_spring', x: 200, y: 420, on: 'p3' },
    ],
    portals: [
        { id: 'exit_up', x: 200, y: 320, on: 'p4', target_region: null, direction: 'up' },
    ],
};

export default springGap;
