import { describe, it, expect } from 'vitest';
import {
    ENTRANCE,
    jumpQuery,
    canJump,
    canJumpDetailed,
    buildPlatformGraph,
    findJumpPath,
    reachablePlatforms,
} from './canJump.js';
import { noAbilities, allAbilities } from './suppression.js';
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
