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

/** A reward shelf over the SPRING gate (plan §8.2/§8.7 step 2): the
 *  springGap geometry with an UNGATED one-way shelf hung in the
 *  bounce's descent corridor. Without Springs the gap is uncrossable
 *  and the shelf (rise 7 > dj landable rise ~4.7) is unreachable by
 *  every movement ability; with Springs the crossing bounce is caught
 *  by the shelf, its wake collects the pickup, and running off the
 *  right end drops back onto the far floor — refusable by holding
 *  drop (always-drop-through, §8.6). The saw hangs under the shelf's
 *  right half: off every mandatory trajectory (bounce arcs are caught
 *  above it; the fall-off starts right of it), lethal only to a
 *  voluntary drop-refusal — the lanes' signature hazard flavor. */
export const springShelf = {
    id: 'springShelf',
    size: { width: 44, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'spring1', x: 19.8, y: 0, w: 4, h: 0.5, type: 'spring' },
        { id: 'shelf1', x: 22.9, y: 7.5, w: 5.6, h: 0.5, type: 'oneway' },
        { id: 'floorB', x: 28.5, y: 0, w: 15.5, h: 1, type: 'ground' },
    ],
    hazards: [{ id: 'saw1', type: 'saw', x: 26.2, y: 6.45, w: 1.1, h: 1 }],
    pickups: [{ id: 'pk_shelfTop', on: 'shelf1', x: 28.3, y: 8.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 43.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A reward shelf over the DOUBLE-JUMP gate: the doubleGap geometry
 *  (gap 8) with a one-way shelf at rise 3.6 — above the single-jump
 *  landable rise (~2.45) but inside dj arcs' descent corridor. High
 *  dj arcs catch it (collecting the pickup), low arcs slip under it
 *  onto the far floor; without Double Jump neither the gap nor the
 *  shelf is reachable. The saw under the shelf's right half (§8.7
 *  step 3 — deferred from step 2 pending clearance calibration) stays
 *  off every mandatory trajectory: catching arcs ride the shelf ABOVE
 *  it, slip-under arcs are grounded before its x-span (celeste's
 *  steep descent), the fall-off starts right of it, and its underside
 *  (2.05 above the floor) clears the run corridor (PLAYER_H + 0.3). */
export const djShelf = {
    id: 'djShelf',
    size: { width: 44, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'shelf1', x: 22.3, y: 4.1, w: 5.6, h: 0.5, type: 'oneway' },
        { id: 'floorB', x: 24, y: 0, w: 20, h: 1, type: 'ground' },
    ],
    hazards: [{ id: 'saw1', type: 'saw', x: 25.9, y: 3.05, w: 1.1, h: 1 }],
    pickups: [{ id: 'pk_shelfTop', on: 'shelf1', x: 27.7, y: 5.2 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 43.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A split segment (placement steps 2+3): a ramp climbs to a split
 *  floor; jumping there catches the one-way TOP lane (hosting a
 *  pickup in its wake), while running off — or dropping — falls onto
 *  the base-height bottom floor, which also catches the lane's
 *  fall-off merge. Both lanes are plain geometry, so every goal
 *  derives [] — route choice, not logic. Deliberately COMPACT (two
 *  ramp hops, narrow floors): this fixture is the oracle corpus's
 *  most expensive case (the two-lane area × the Double-Jump aerial
 *  fan drive the state count), and the width scales it linearly —
 *  the structure, not the acreage, is what the corpus needs. */
export const laneSplit = {
    id: 'laneSplit',
    size: { width: 47.5, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 8, h: 1, type: 'ground' },
        { id: 'ramp0', x: 10.6, y: 1.35, w: 4, h: 1, type: 'ground' },
        { id: 'ramp1', x: 17.2, y: 2.7, w: 4, h: 1, type: 'ground' },
        { id: 'lane1', x: 23.2, y: 4.4, w: 8, h: 0.5, type: 'oneway' },
        { id: 'floorB', x: 21.2, y: 0, w: 15, h: 1, type: 'ground' },
        { id: 'floorC', x: 39, y: 0, w: 8.5, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_top', on: 'lane1', x: 31, y: 5.5 }],
    portals: [{ id: 'exit_main', on: 'floorC', x: 46.9, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** A ceiling hazard over a plain run gap (plan §8.7 step 3): a static
 *  kill slab hung with its bottom 2.6 above the floors' top — above
 *  the robust swept crossing minimum (~1.6 for gaps ≤ 2.8: coyote-tap
 *  arcs stay that low) and below the full-hold player top (~3.5) — so
 *  a naive full-height jump clips it and dies while a tap (grounded
 *  or coyote) crosses underneath. Jump MODULATION as difficulty
 *  (§8.4): no item gates it, and the slab is thick enough (4.5) that
 *  even double-jump arcs cannot overfly it. Gap 2.8 matters: at 3.0
 *  the only surviving arcs are tick-lattice-critical (the swept
 *  minimum jumps to ~2.8) — the generator's CEIL_GAP window ends at
 *  2.8 for exactly this reason. */
export const ceilingRun = {
    id: 'ceilingRun',
    size: { width: 42, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'floorB', x: 18.8, y: 0, w: 23.2, h: 1, type: 'ground' },
    ],
    hazards: [{ id: 'ceil1', type: 'ceiling', x: 14.5, y: 3.6, w: 5.8, h: 4.5 }],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 41.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** The FORGIVING ceiling regime (applyCeilingMargin at margin 1, the
 *  generator default): the gap (1.2) is within grounded-tap range
 *  (~1.6) and the slab bottom (2.6) clears the grounded-tap apex top
 *  (~1.87) — a plain short hop pressed BEFORE the lip crosses, with
 *  coyote time as spare forgiveness for late presses rather than a
 *  requirement (ceilingRun above is the expert regime, where the
 *  wider gap admits only run-off coyote taps). Mid and full holds
 *  still clip the slab and die: punishment intact at every margin. */
export const ceilingHop = {
    id: 'ceilingHop',
    size: { width: 42, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'floorB', x: 17.2, y: 0, w: 24.8, h: 1, type: 'ground' },
    ],
    hazards: [{ id: 'ceil1', type: 'ceiling', x: 14.5, y: 3.6, w: 4.2, h: 4.5 }],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 41.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** The Glide gate (plan §8.5/§8.7 step 4): a ramp climbs to a `glider`
 *  pad — existence-gated on the Glide item — over an extra-wide DROP
 *  gap (the widest gap in the game). Holding jump during a non-jump
 *  fall off the pad caps fall speed (GLIDE_FALL_CAP), so running off
 *  the pad while holding sails the chasm; without the item the pad is
 *  absent and the gap is dj-proof from the (lower, further-left) ramp
 *  top: 16.2 units vs ~12.7 double-jump reach at that drop. The
 *  natural play tape is "jump onto the pad holding, keep holding, run
 *  off"; the solver's hop-and-hold policy synthesizes the same held
 *  state with an early tap hop. */
export const glideDrop = {
    id: 'glideDrop',
    size: { width: 54, height: 20 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 8, h: 1, type: 'ground' },
        { id: 'ramp0', x: 10.6, y: 1.35, w: 4, h: 1, type: 'ground' },
        { id: 'ramp1', x: 17.2, y: 2.7, w: 4, h: 1, type: 'ground' },
        { id: 'ramp2', x: 23.8, y: 4.05, w: 4, h: 1, type: 'ground' },
        { id: 'pad1', x: 29.3, y: 5.75, w: 6, h: 0.5, type: 'glider' },
        { id: 'floorB', x: 44, y: 0, w: 10, h: 1, type: 'ground' },
    ],
    hazards: [],
    pickups: [{ id: 'pk_pad', on: 'pad1', x: 35, y: 6.85 }],
    portals: [{ id: 'exit_main', on: 'floorB', x: 53.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

/** The Shield gate (plan §4.10 — the hit budget): a plain-jump-width
 *  gap whose whole airspace is one `bed` hazard — a kill volume from
 *  below the floor line up past the double-jump overfly bound
 *  (2.1×jumpHeight + 0.9 above floor top), so EVERY crossing arc
 *  passes through it: unavoidable by construction, never proven
 *  unavoidable by the solver. Without a Shield the pre-bed floor is a
 *  doomed pre-gate floor (its edge pickup still derives [] via the
 *  touch grade — item-before-the-gate); with one the crossing charges
 *  exactly one contact-edge hit and lands live. The bed is inset 0.85
 *  from both lips (PLAYER_W overhang + margin) so a grounded stand at
 *  either edge never touches it. The spike patch AFTER the bed (with
 *  its flush partner floor, the spikeRun pattern) pins the spent-
 *  budget dimension: post-bed legs run at hits 1, where the hop over
 *  the spikes must be flown, never eaten. */
export const shieldBed = {
    id: 'shieldBed',
    size: { width: 42, height: 16 },
    platforms: [
        { id: 'floorA', x: 0, y: 0, w: 16, h: 1, type: 'ground' },
        { id: 'floorB', x: 19, y: 0, w: 14, h: 1, type: 'ground' },
        { id: 'floorC', x: 33, y: 0, w: 9, h: 1, type: 'ground' },
    ],
    hazards: [
        { id: 'bed1', type: 'bed', x: 16.85, y: -1, w: 1.3, h: 7.63 },
        { id: 'spikes', type: 'spikes', x: 25, y: 1, w: 1.2, h: 0.8 },
    ],
    pickups: [{ id: 'pk_edge', on: 'floorA', x: 15.8, y: 1.6 }],
    portals: [{ id: 'exit_main', on: 'floorC', x: 41.4, y: 1.6, arrow: 'right', exitName: null }],
    spawn: { x: 1, y: 1 },
};

export const FIXTURES = [flatRun, gapJump, oneWay, spikeRun, doubleGap, stepStone, springGap,
    springShelf, djShelf, laneSplit, ceilingRun, ceilingHop, glideDrop, shieldBed];
