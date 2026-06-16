import { describe, it, expect } from 'vitest';
import {
    ENTRANCE,
    jumpQuery,
    canJump,
    canJumpDetailed,
    buildPlatformGraph,
    findJumpPath,
    reachablePlatforms,
    reachableBraidPlatforms,
    isTeleportHost,
} from './canJump.js';
import { noAbilities, allAbilities } from './suppression.js';
import { PROFILES } from './physics.js';
import { bounceStack } from './fixtures/bounceStack.js';

const makeLevel = (over = {}) => ({
    id: 'test',
    size: { width: 400, height: 1200 },
    platforms: [],
    springs: [],
    jetpacks: [],
    pickups: [],
    portals: [],
    ...over,
});

describe('jumpQuery', () => {
    it('lands on the next platform up from a plain bounce', () => {
        const r = jumpQuery(bounceStack, 'p0', noAbilities());
        expect(r.landedOn).toBe('p1');
    });

    it('falls when there is nothing to land on', () => {
        const level = makeLevel({
            platforms: [{ id: 'a', x: 200, y: 1100, type: 'green' }],
        });
        const r = jumpQuery(level, 'a', noAbilities());
        // bounces on 'a' forever — re-landing doesn't end the jump
        expect(r.landedOn).toBeNull();
        expect(r.timedOut).toBe(true);
    });

    it('reports pickups and portals touched along the trajectory', () => {
        const r = jumpQuery(bounceStack, 'p8', noAbilities());
        expect(r.pickupsTouched).toContain('loc_arrow');
        expect(r.portalsTouched).toContain('exit_up');
    });
});

describe('canJump: vertical reach', () => {
    it('reaches the adjacent platform but not two up', () => {
        expect(canJump(bounceStack, 'p0', 'p1', noAbilities())).toBe(true);
        expect(canJump(bounceStack, 'p0', 'p2', noAbilities())).toBe(false);
    });

    it('cannot jump back down through its own platform without arrows', () => {
        expect(canJump(bounceStack, 'p1', 'p0', noAbilities())).toBe(false);
    });

    it('entrance reaches the bottom platform', () => {
        expect(canJump(bounceStack, ENTRANCE, 'p0', noAbilities())).toBe(true);
    });

    it('provides one witness per sampled launch position', () => {
        const r = canJumpDetailed(bounceStack, 'p0', 'p1', noAbilities());
        expect(r.ok).toBe(true);
        expect(r.witnesses.length).toBeGreaterThanOrEqual(5);
        for (const w of r.witnesses) expect(w.policy).toBe('none');
    });
});

describe('canJump: ability gating (the metroidvania signal)', () => {
    it('suppressed platforms are not valid endpoints', () => {
        const level = makeLevel({
            platforms: [
                { id: 'g0', x: 200, y: 1100, type: 'green' },
                { id: 'b1', x: 200, y: 980, type: 'blue' },
            ],
        });
        expect(canJump(level, 'g0', 'b1', noAbilities())).toBe(false);
        expect(canJump(level, 'g0', 'b1', { blue: true })).toBe(true);
    });

    it('a spring bridges a gap a plain bounce cannot', () => {
        const level = makeLevel({
            platforms: [
                { id: 'a', x: 200, y: 1100, type: 'green' },
                { id: 'b', x: 200, y: 800, type: 'green' }, // 300px up
            ],
            springs: [{ id: 's', x: 200, y: 1095, on: 'a' }],
        });
        expect(canJump(level, 'a', 'b', noAbilities())).toBe(false);
        expect(canJump(level, 'a', 'b', { springs: true })).toBe(true);
    });

    it('a jetpack bridges a gap a spring cannot', () => {
        const level = makeLevel({
            platforms: [
                { id: 'a', x: 200, y: 1100, type: 'green' },
                { id: 'b', x: 200, y: 400, type: 'green' }, // 700px up
            ],
            springs: [{ id: 's', x: 200, y: 1095, on: 'a' }],
            jetpacks: [{ id: 'j', x: 200, y: 1095, on: 'a' }],
        });
        expect(canJump(level, 'a', 'b', { springs: true })).toBe(false);
        expect(canJump(level, 'a', 'b', { jetpacks: true })).toBe(true);
    });

    it('a horizontal offset requires the matching arrow key', () => {
        const level = makeLevel({
            platforms: [
                { id: 'a', x: 100, y: 500, type: 'green' },
                { id: 'b', x: 260, y: 800, type: 'green' }, // below, to the right
            ],
        });
        expect(canJump(level, 'a', 'b', noAbilities())).toBe(false);
        expect(canJump(level, 'a', 'b', { left: true })).toBe(false);
        expect(canJump(level, 'a', 'b', { right: true })).toBe(true);
    });
});

describe('platform graph + simulatorCore integration', () => {
    it('the bounce stack is fully reachable with no abilities', () => {
        const graph = buildPlatformGraph(bounceStack, noAbilities());
        const reachable = reachablePlatforms(graph);
        for (const p of bounceStack.platforms) expect(reachable).toContain(p.id);
    });

    it('findJumpPath returns the ordered platform sequence', () => {
        const graph = buildPlatformGraph(bounceStack, noAbilities());
        const r = findJumpPath(graph, 'p8');
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    });

    it('derives a blue-platform requirement: goal reachable iff blue is unlocked', () => {
        const level = makeLevel({
            platforms: [
                { id: 'g0', x: 200, y: 1100, type: 'green' },
                { id: 'b1', x: 200, y: 980, type: 'blue' },
                { id: 'g2', x: 200, y: 860, type: 'green' }, // 240 above g0: needs b1
            ],
        });
        const locked = buildPlatformGraph(level, noAbilities());
        expect(findJumpPath(locked, 'g2').ok).toBe(false);
        expect(reachablePlatforms(locked)).toEqual(new Set(['g0']));

        const unlocked = buildPlatformGraph(level, { blue: true });
        const r = findJumpPath(unlocked, 'g2');
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual(['g0', 'b1', 'g2']);
    });

    it('graph nodes exclude suppressed platforms entirely', () => {
        const level = makeLevel({
            platforms: [
                { id: 'g0', x: 200, y: 1100, type: 'green' },
                { id: 'b1', x: 200, y: 980, type: 'blue' },
            ],
        });
        const graph = buildPlatformGraph(level, noAbilities());
        expect(graph.nodes).toEqual([ENTRANCE, 'g0']);
    });
});

describe('teleport-to-start hosts (terminal + entrance edge)', () => {
    // A column where the middle platform hosts a teleport-to-start.
    const tpLevel = () => makeLevel({
        platforms: [
            { id: 'g0', x: 200, y: 1100, type: 'green' },
            { id: 't1', x: 200, y: 980, type: 'green' }, // one step above g0
            { id: 'g2', x: 200, y: 860, type: 'green' }, // one step above t1
        ],
        teleports: [{ id: 'tp', x: 200, y: 960, on: 't1' }],
    });

    it('isTeleportHost flags only the host platform', () => {
        const level = tpLevel();
        expect(isTeleportHost(level, 't1')).toBe(true);
        expect(isTeleportHost(level, 'g0')).toBe(false);
        expect(isTeleportHost(makeLevel({ platforms: [{ id: 'g0', x: 200, y: 1100, type: 'green' }] }), 'g0')).toBe(false);
    });

    it('is landable; terminal-ness is enforced by the graph, not raw canJump', () => {
        const level = tpLevel();
        // canJump reports raw PHYSICS — you can land on the host (g0→t1) and
        // a launch off it is physically possible (t1→g2). The terminal-ness
        // (no climb edges) is applied by the reachability builders, not here —
        // keeping the N²-per-graph canJump hot path free of a teleport probe.
        expect(canJump(level, 'g0', 't1', noAbilities())).toBe(true);
        expect(canJump(level, 't1', 'g2', noAbilities())).toBe(true);
    });

    it('graph: teleport host edges ONLY to ENTRANCE; the goal above is walled off', () => {
        const level = tpLevel();
        const graph = buildPlatformGraph(level, noAbilities());
        expect([...graph.edges.get('t1')]).toEqual([ENTRANCE]); // terminal: no climb edges
        // g2 sits only above the terminal teleport host → unreachable.
        expect(reachablePlatforms(graph)).toEqual(new Set(['g0', 't1']));
    });

    it('reachableBraidPlatforms also treats the host as a launch terminal', () => {
        const level = tpLevel();
        // g0 and t1 are reached (landable); g2 above the terminal host is not.
        const reached = reachableBraidPlatforms(level, noAbilities());
        expect(reached).toEqual(new Set(['g0', 't1']));
    });
});

// ── dj phase-aware edges (moving blues, breaking browns) ────────────
describe('dj phase-aware edges', () => {
    const DJ = PROFILES.dj.constants;
    const djOpts = { constants: DJ };
    const djLevel = (over = {}) => ({
        id: 'dj_solver_test',
        size: { width: 240, height: 600 },
        platforms: [],
        springs: [],
        jetpacks: [],
        pickups: [],
        portals: [],
        ...over,
    });

    it('plain dj column edges work (90px rungs under latched landings)', () => {
        const level = djLevel({
            platforms: [
                { id: 'g0', x: 120, y: 500, type: 'green' },
                { id: 'g1', x: 120, y: 410, type: 'green' },
            ],
        });
        expect(canJump(level, 'g0', 'g1', noAbilities(), djOpts)).toBe(true);
        // and the upward pre-filter holds: too far is out
        const far = djLevel({
            platforms: [
                { id: 'g0', x: 120, y: 500, type: 'green' },
                { id: 'g1', x: 120, y: 340, type: 'green' }, // 160 > 114.4 + 22
            ],
        });
        expect(canJump(far, 'g0', 'g1', noAbilities(), djOpts)).toBe(false);
    });

    it('green→blue: ∃-reachable-phase — waiting on the green catches the sweep', () => {
        // the blue sweeps across the column; with NO arrows the player
        // can only bounce in place, so the edge exists iff SOME
        // waiting-reachable phase puts the blue overhead
        const level = djLevel({
            platforms: [
                { id: 'g0', x: 120, y: 500, type: 'green' },
                { id: 'bl', x: 120, y: 410, type: 'blue', sweep: { min: 60, max: 180 } },
            ],
        });
        expect(canJump(level, 'g0', 'bl', { blue: true }, djOpts)).toBe(true);
        // suppressed without the item, exactly like a static blue
        expect(canJump(level, 'g0', 'bl', noAbilities(), djOpts)).toBe(false);
    });

    it('blue→up: ∀-arrival-phase — fails arrowless (the sweep+offset envelope misses)', () => {
        // the player cannot choose the arrival phase or offset on the
        // blue; with no steering, launches from the sweep edges miss
        // the static target above, so the edge must NOT exist
        const level = djLevel({
            platforms: [
                { id: 'bl', x: 120, y: 410, type: 'blue', sweep: { min: 60, max: 180 } },
                { id: 'g1', x: 120, y: 320, type: 'green' },
            ],
        });
        expect(canJump(level, 'bl', 'g1', { blue: true }, djOpts)).toBe(false);
        // arrows restore it: seek corrects from every phase/offset
        expect(canJump(level, 'bl', 'g1',
            { blue: true, left: true, right: true }, djOpts)).toBe(true);
    });

    it('brown is a goal host, never a launch step (no outgoing edges under dj)', () => {
        const level = djLevel({
            platforms: [
                { id: 'g0', x: 120, y: 500, type: 'green' },
                { id: 'br', x: 120, y: 410, type: 'brown' },
                { id: 'g1', x: 120, y: 320, type: 'green' },
            ],
        });
        const ab = { brown: true };
        expect(canJump(level, 'g0', 'br', ab, djOpts)).toBe(true);   // INTO brown ok
        expect(canJump(level, 'br', 'g1', ab, djOpts)).toBe(false);  // FROM brown never
        // classic browns keep their step role (static, full bounce)
        expect(canJump(level, 'br', 'g1', { brown: true })).toBe(true);
    });

    it('dj branch tips: ±115 drift needs the matching arrow (flat control, no momentum)', () => {
        // the dj sweep result: flat ±10 control covers ~120px of drift
        // within a plain-bounce flight, so classic's ±140 tips are
        // infeasible from the worst landing offset — dj geometry pins
        // BRANCH_DX 115 (the first value past the 113px interception
        // clearance; see DJ_GEOMETRY)
        const level = djLevel({
            size: { width: 400, height: 600 },
            platforms: [
                { id: 'g0', x: 200, y: 500, type: 'green' },
                { id: 'tip', x: 315, y: 410, type: 'green' },
            ],
        });
        expect(canJump(level, 'g0', 'tip', { right: true }, djOpts)).toBe(true);
        expect(canJump(level, 'g0', 'tip', { left: true }, djOpts)).toBe(false);
        expect(canJump(level, 'g0', 'tip', noAbilities(), djOpts)).toBe(false);
    });

    it('dj: classic\'s ±140 tip is OUT of flat-control range from the worst offset', () => {
        const level = djLevel({
            size: { width: 400, height: 600 },
            platforms: [
                { id: 'g0', x: 200, y: 500, type: 'green' },
                { id: 'tip', x: 340, y: 410, type: 'green' },
            ],
        });
        expect(canJump(level, 'g0', 'tip', { right: true }, djOpts)).toBe(false);
    });
});

describe('dj pass-through movers (composite wait-land-bounce-off)', () => {
    const DJ = PROFILES.dj.constants;
    const level = {
        id: 'dj_through',
        size: { width: 600, height: 700 },
        platforms: [
            { id: 'g0', x: 300, y: 500, type: 'green' },
            { id: 'bl', x: 300, y: 410, type: 'blue', sweep: { min: 15, max: 585 } },
            { id: 'g1', x: 300, y: 320, type: 'green' },
        ],
        springs: [], jetpacks: [], pickups: [], portals: [],
    };
    const o = { constants: DJ };

    it('green→green THROUGH a full-width mover, arrowless: the player waits on the green,'
        + ' lands on the stone when aligned, and bounces straight off (x preserved)', () => {
        expect(canJump(level, 'g0', 'g1', { blue: true }, o)).toBe(true);
    });

    it('without the blue item the stone does not exist and the gap is unclearable', () => {
        expect(canJump(level, 'g0', 'g1', {}, o)).toBe(false);
    });

    it('an edge INTO the mover still terminates on it', () => {
        expect(canJump(level, 'g0', 'bl', { blue: true }, o)).toBe(true);
    });
});

describe('dj aligned-stride fast path ≡ exhaustive phase enumeration', () => {
    const DJ = PROFILES.dj.constants;
    // full-width mover (fast path applies: BLUE_SPEED * cycle ≈ 75-80
    // ≤ catch window 106) — compare every edge/ability combination
    // against the exhaustive residue enumeration
    const level = {
        id: 'dj_equiv',
        size: { width: 600, height: 700 },
        platforms: [
            { id: 'g0', x: 300, y: 500, type: 'green' },
            { id: 'bl', x: 300, y: 410, type: 'blue', sweep: { min: 15, max: 585 } },
            { id: 'g1', x: 300, y: 320, type: 'green' },
            { id: 'tip', x: 415, y: 410, type: 'green' },
        ],
        springs: [], jetpacks: [], pickups: [], portals: [],
    };

    it('agrees with the exhaustive path on every edge', () => {
        const abilitySets = [
            { blue: true },
            { blue: true, right: true },
            { blue: true, left: true, right: true },
            { right: true },
        ];
        const ids = ['g0', 'bl', 'g1', 'tip'];
        for (const ab of abilitySets) {
            for (const from of ids) {
                for (const to of ids) {
                    if (from === to) continue;
                    const fast = canJump(level, from, to, ab, { constants: DJ });
                    const exhaustive = canJump(level, from, to, ab, {
                        constants: DJ, exhaustivePhases: true,
                    });
                    expect(fast, `${from}->${to} ${JSON.stringify(ab)}`).toBe(exhaustive);
                }
            }
        }
    }, 300000);
});
