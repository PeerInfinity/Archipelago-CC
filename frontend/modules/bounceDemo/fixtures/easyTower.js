/**
 * Fixture: the easy tower — a second zero-requirement level, so the
 * zone set has more than one level open from the start (multiple item
 * orders = something for AP's fill to randomize). Center-column climb
 * like the bounce stack, plus one decorative off-column platform that
 * normal play simply skips (deliberate: skipping platforms is normal,
 * and this keeps a living example in the fixture set).
 *
 * Ground truth: both pickups and the exit reachable with {}. Two
 * pickups so the zone can grant two items — needed because filler
 * zones grant none and the spiral chain consumes items fast.
 */
export const easyTower = {
    id: 'easy_tower',
    size: { width: 400, height: 1000 },
    platforms: [
        { id: 'p0', x: 200, y: 900, type: 'green' },
        { id: 'p1', x: 200, y: 780, type: 'green' },
        { id: 'p2', x: 200, y: 660, type: 'green' },
        { id: 'p3', x: 200, y: 540, type: 'green' },
        { id: 'p4', x: 200, y: 420, type: 'green' },
        { id: 'p5', x: 200, y: 300, type: 'green' },
        { id: 'deco', x: 80, y: 600, type: 'green' }, // decorative, skipped
        { id: 'p6', x: 200, y: 200, type: 'green' },  // exit platform
    ],
    springs: [],
    jetpacks: [],
    pickups: [
        { id: 'loc_easy', x: 200, y: 280, on: 'p5' },
        { id: 'loc_easy2', x: 200, y: 520, on: 'p3' },
    ],
    portals: [
        { id: 'exit_up', x: 200, y: 180, on: 'p6', target_region: null, direction: 'up' },
    ],
};

export default easyTower;
