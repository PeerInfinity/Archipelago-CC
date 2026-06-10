/**
 * Fixture: the filler climb — a level with NO pickups, pure traversal
 * (the plan's "filler" level type: lengthens the region graph for a
 * more maze-like feel). Exits only.
 *
 * Ground truth: exit reachable with {}; no locations.
 */
export const fillerClimb = {
    id: 'filler_climb',
    size: { width: 400, height: 800 },
    platforms: [
        { id: 'p0', x: 200, y: 700, type: 'green' },
        { id: 'p1', x: 200, y: 580, type: 'green' },
        { id: 'p2', x: 200, y: 460, type: 'green' },
        { id: 'p3', x: 200, y: 340, type: 'green' },
        { id: 'p4', x: 200, y: 240, type: 'green' }, // exit platform
    ],
    springs: [],
    jetpacks: [],
    pickups: [],
    portals: [
        { id: 'exit_up', x: 200, y: 220, on: 'p4', target_region: null, direction: 'up' },
    ],
};

export default fillerClimb;
