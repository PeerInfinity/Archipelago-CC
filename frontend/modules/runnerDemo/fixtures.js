/**
 * Hand-built fixture levels for the runner substrate — the standalone
 * game page's dev-harness catalogue and the unit/Playwright test
 * corpus (plan §4.2/§4.7). All must pass validateLevel under the
 * default profile (fixtures.test.js asserts it).
 *
 * Geometry is sized for the celeste-seeded default profile
 * (jumpHeight 2.25, maxSpeed ~9, full-hold running jump ~4.9 units,
 * tap jump ~2.1 units — see physics.test.js apex goldens).
 */

/** Flat two-segment run: traversable with zero input (auto-run only).
 *  Pickup at segment A's right end, portal at the strip's right end.
 *  Also the tap-vs-hold touch-test arena (jump in place at the wall). */
export const flatRun = {
    id: 'flatRun',
    size: { width: 30, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 14, h: 1, type: 'ground' },
        { id: 'floorB', x: 14, y: 0, w: 16, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_flat', on: 'floorA', x: 13.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** One gap sized so a FULL-HOLD running jump clears it and a tap jump
 *  does not (~3.2 units vs ~4.9 full / ~2.1 tap) — the keyboard
 *  input-tape traversal fixture. Falling in the gap hits the kill
 *  floor and respawns; retry. */
export const gapJump = {
    id: 'gapJump',
    size: { width: 40, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'floorB', x: 19.2, y: 0, w: 20.8, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 39.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A gated one-way (blue) shelf over a solid floor: without Blue
 *  Platforms the spawn ledge run falls straight to the floor; with
 *  the item the shelf carries the run — and holding drop falls
 *  through it (the touch drop-button fixture). */
export const oneWay = {
    id: 'oneWay',
    size: { width: 40, height: 16 },
    platforms: [
        { id: 'floor', x: 0, y: 0, w: 40, h: 1, type: 'ground' },
        { id: 'ledge', x: 0, y: 5, w: 4, h: 1, type: 'ground' },
        { id: 'blue1', x: 4, y: 5.5, w: 22, h: 0.5, type: 'blue' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_shelf', on: 'blue1', x: 25.8, y: 6.6 }],
    portals: [{ id: 'exit_main', on: 'floor', x: 39.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 6 },
};

/** Static hazard on the corridor floor mid-strip: jump it or die
 *  (respawn) — exercises hazard death + retry in one fixture. The
 *  spiked segment hosts no goal (the goal-wake invariant forbids
 *  hazards on goal hosts — their whole corridor must be survivable). */
export const spikeRun = {
    id: 'spikeRun',
    size: { width: 30, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 20, h: 1, type: 'ground' },
        { id: 'floorB', x: 20, y: 0, w: 10, h: 1, type: 'ground' },
    ],
    hazards: [{ id: 'spikes', type: 'spikes', x: 14, y: 1, w: 1.5, h: 0.8 }],
    pickups: [],
    portals: [{ id: 'exit_main', on: 'floorB', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A gap wider than the max single running jump (~6.0 with coyote)
 *  but inside double-jump reach (~9.8): the Double Jump gate fixture
 *  (the solver's second-press-at-apex policies carry it). */
export const doubleGap = {
    id: 'doubleGap',
    size: { width: 40, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'floorB', x: 24, y: 0, w: 16, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 39.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A gap wider than even double-jump reach, with a gated one-way
 *  (blue) stepping stone mid-gap: without Blue Platforms the gap is
 *  uncrossable under EVERY movement ability; with it, two plain full
 *  jumps chain across (the gated-platform gate fixture — plan §4.5's
 *  gate-segment geometry in fixture form). */
export const stepStone = {
    id: 'stepStone',
    size: { width: 44, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'stone', x: 19.5, y: 0.5, w: 5, h: 0.5, type: 'blue' },
        { id: 'floorB', x: 28, y: 0, w: 16, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_stone', on: 'stone', x: 24.1, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 43.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A gap wider than even double-jump reach, with a gated SPRING
 *  mid-gap slightly below floor level: without Springs the gap is
 *  uncrossable under every movement ability; with it, a full jump
 *  lands on the spring and the bounce (SPRING_RISE, deterministic)
 *  carries the far half — the spring-gate fixture (plan §8.3). The
 *  spring hosts no goal (springs have no standing wake). */
export const springGap = {
    id: 'springGap',
    size: { width: 44, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'spring1', x: 20.5, y: 0, w: 4, h: 0.5, type: 'spring' },
        { id: 'floorB', x: 28.5, y: 0, w: 15.5, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 43.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

export const FIXTURES = [flatRun, gapJump, oneWay, spikeRun, doubleGap, stepStone, springGap];
