/**
 * Fixture: the fork — a two-branch level with arrow-key and
 * platform-type gating, plus one helpful-but-not-required jetpack.
 *
 * From p0 (bottom-center) the right branch needs rightward drift; the
 * left branch needs leftward drift AND blue platforms (b1l is blue).
 * The jetpack on p2r is texture: the portal is already reachable from
 * p2r by a plain bounce, so jetpacks gate nothing here.
 *
 * Ground truth (encoded in fixtures.test.js, later re-derived by the
 * verifier):
 *   {}            -> p0 only
 *   {right}       -> p0, p1r, p2r; pickup loc_right; portal exit_up
 *   {left}        -> p0 only (b1l suppressed without blue)
 *   {blue}        -> p0 only (cannot drift left without the arrow)
 *   {left, blue}  -> p0, b1l; pickup loc_left
 */
export const fork = {
    id: 'fork',
    size: { width: 600, height: 900 },
    platforms: [
        { id: 'p0', x: 300, y: 800, type: 'green' },
        // right branch
        { id: 'p1r', x: 430, y: 680, type: 'green' },
        { id: 'p2r', x: 430, y: 560, type: 'green' },
        { id: 'p3r', x: 430, y: 460, type: 'green' }, // exit platform
        // left branch
        { id: 'b1l', x: 170, y: 680, type: 'blue' },
    ],
    springs: [],
    jetpacks: [
        { id: 'j0', x: 430, y: 555, on: 'p2r' }, // helpful, not required
    ],
    pickups: [
        { id: 'loc_right', x: 430, y: 660, on: 'p1r' },
        { id: 'loc_left', x: 170, y: 660, on: 'b1l' },
    ],
    portals: [
        { id: 'exit_up', x: 430, y: 440, on: 'p3r', target_region: null, direction: 'up' },
    ],
};

export default fork;
