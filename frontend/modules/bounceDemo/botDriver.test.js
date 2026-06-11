import { describe, it, expect } from 'vitest';
import { createBotDriver, shortestPath } from './botDriver.js';
import { step as physicsStep, spawnState } from './physics.js';
import { noAbilities } from './suppression.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { fork } from './fixtures/fork.js';

const abilitiesWith = (...names) => {
    const a = noAbilities();
    for (const n of names) a[n] = true;
    return a;
};

/**
 * Drive the real physics with the driver's per-frame inputs — the same
 * call order game/main.js uses (nextInput sees the PREVIOUS tick's
 * state, so a landing is observed exactly once, the frame after it
 * happened). Falls respawn at the entrance, mirroring gameCore.
 */
function runDriver(level, abilities, driver, {
    maxFrames = 5000,
    isPortalOpen,
    until = () => false,
    startState = null,
} = {}) {
    let state = startState ?? spawnState(level);
    const pickupsTouched = new Set();
    const portalsTouched = new Set();
    const inputs = [];
    for (let f = 0; f < maxFrames; f++) {
        const input = driver.nextInput(state, level, abilities, { isPortalOpen });
        inputs.push(input);
        state = physicsStep(state, input, level, abilities);
        if (state.fallen) {
            driver.notifyFell();
            state = spawnState(level);
            continue;
        }
        if (state.landedOn) {
            for (const pk of level.pickups ?? []) {
                if (pk.on === state.landedOn) pickupsTouched.add(pk.id);
            }
            for (const pt of level.portals ?? []) {
                if (pt.on === state.landedOn) portalsTouched.add(pt.id);
            }
        }
        if (until({ state, pickupsTouched, portalsTouched })) {
            return { state, pickupsTouched, portalsTouched, inputs, frames: f + 1 };
        }
    }
    return { state, pickupsTouched, portalsTouched, inputs, frames: maxFrames };
}

describe('shortestPath', () => {
    const graph = {
        edges: new Map([
            ['a', new Set(['b', 'c'])],
            ['b', new Set(['d'])],
            ['c', new Set(['d'])],
            ['d', new Set()],
        ]),
    };

    it('finds a shortest path including both endpoints', () => {
        const path = shortestPath(graph, 'a', 'd');
        expect(path).toHaveLength(3);
        expect(path[0]).toBe('a');
        expect(path[2]).toBe('d');
    });

    it('routes around blocked intermediate nodes', () => {
        expect(shortestPath(graph, 'a', 'd', new Set(['b']))).toEqual(['a', 'c', 'd']);
    });

    it('still reaches a goal that is itself in the blocked set', () => {
        expect(shortestPath(graph, 'a', 'd', new Set(['d']))).not.toBeNull();
    });

    it('returns null when every route is blocked', () => {
        expect(shortestPath(graph, 'a', 'd', new Set(['b', 'c']))).toBeNull();
    });

    it('returns [from] for from === to', () => {
        expect(shortestPath(graph, 'a', 'a')).toEqual(['a']);
    });
});

describe('botDriver — on-column targets (bounceStack, no abilities)', () => {
    it('reaches a pickup with zero input (auto-play is the degenerate plan)', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'loc_arrow' });
        const r = runDriver(bounceStack, noAbilities(), driver, {
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_arrow'),
        });
        expect(r.pickupsTouched.has('loc_arrow')).toBe(true);
        // No arrows, no steering possible — every synthesized input is null.
        expect(r.inputs.every((i) => i === null)).toBe(true);
    });

    it('reaches the top portal', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_up' });
        const r = runDriver(bounceStack, noAbilities(), driver, {
            until: ({ portalsTouched }) => portalsTouched.has('exit_up'),
        });
        expect(r.portalsTouched.has('exit_up')).toBe(true);
    });

    it('parks on a locked target portal\'s host platform', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_up' });
        const reachTop = runDriver(bounceStack, noAbilities(), driver, {
            isPortalOpen: () => false,
            until: () => driver.getStatus().lastPlatform === 'p9',
        });
        expect(driver.getStatus().lastPlatform).toBe('p9');
        // Keep running: the driver must stay parked (every later landing
        // re-plans to "arrived", no input, re-land on p9).
        runDriver(bounceStack, noAbilities(), driver, {
            isPortalOpen: () => false,
            maxFrames: 600,
            // continue from wherever reachTop left off is not possible with
            // this harness (fresh spawn), so just assert it climbs back up
            // and stays.
            until: () => false,
        });
        expect(driver.getStatus().lastPlatform).toBe('p9');
        expect(reachTop.frames).toBeGreaterThan(0);
    });
});

describe('botDriver — steered targets (fork)', () => {
    it('drifts right to the right-branch pickup with {right}', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'loc_right' });
        const r = runDriver(fork, abilitiesWith('right'), driver, {
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_right'),
        });
        expect(r.pickupsTouched.has('loc_right')).toBe(true);
        // Steering actually happened.
        expect(r.inputs.some((i) => i?.right)).toBe(true);
    });

    it('reaches the right-branch portal with {right}', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'portal', id: 'exit_up' });
        const r = runDriver(fork, abilitiesWith('right'), driver, {
            until: ({ portalsTouched }) => portalsTouched.has('exit_up'),
        });
        expect(r.portalsTouched.has('exit_up')).toBe(true);
    });

    it('drifts left to the blue-platform pickup with {left, blue}', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'loc_left' });
        const r = runDriver(fork, abilitiesWith('left', 'blue'), driver, {
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_left'),
        });
        expect(r.pickupsTouched.has('loc_left')).toBe(true);
        expect(r.inputs.some((i) => i?.left)).toBe(true);
    });

    it('re-plans to the other branch when the target switches mid-run', () => {
        const driver = createBotDriver();
        const abilities = abilitiesWith('left', 'right', 'blue');
        driver.setTarget({ kind: 'pickup', id: 'loc_right' });
        const first = runDriver(fork, abilities, driver, {
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_right'),
        });
        expect(first.pickupsTouched.has('loc_right')).toBe(true);
        driver.setTarget({ kind: 'pickup', id: 'loc_left' });
        const second = runDriver(fork, abilities, driver, {
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_left'),
        });
        expect(second.pickupsTouched.has('loc_left')).toBe(true);
    });
});

describe('botDriver — descend fallback (target below an overshot climb)', () => {
    // Real geometry from the committed bounce_sphere_worldgen preset's
    // start region (region_3_3), where the first in-browser run got
    // stuck: branch tips p12/p13 hang off the LOWER column (p13 is the
    // target portal's host) while the no-input auto-climb parks the
    // player high on p6 — and bounce physics cannot descend a column.
    // The driver must deliberately fall off the level, respawn at the
    // entrance, and take the verified low route (p0 → p1 → p13).
    const overshootLevel = {
        id: 'region_3_3_like',
        size: { width: 600, height: 1794 },
        platforms: [
            ...[0, 1, 2, 3, 4, 5, 6].map((i) => (
                { id: `p${i}`, x: 300, y: 1694 - 120 * i, type: 'green' })),
            // Upper column across an unjumpable 434px gap (later-wave
            // content) — the climb dead-ends on p6.
            { id: 'p7', x: 300, y: 540, type: 'green' },
            { id: 'p8', x: 300, y: 420, type: 'green' },
            { id: 'p11', x: 300, y: 60, type: 'green' },
            // Branch tips off the lower column.
            { id: 'p12', x: 440, y: 1214, type: 'green' },
            { id: 'p13', x: 440, y: 1454, type: 'green' },
        ],
        springs: [],
        jetpacks: [],
        pickups: [{ id: 'loc_0', x: 300, y: 1194, on: 'p4' }],
        portals: [
            { id: 'side_exit_E', x: 440, y: 1194, on: 'p12' },
            { id: 'side_exit_N', x: 440, y: 1434, on: 'p13' },
        ],
    };

    it('falls out, respawns, and reaches a branch tip below the overshoot', () => {
        const abilities = abilitiesWith('right');
        const driver = createBotDriver();
        // Phase 1: no target — the auto-climb overshoots to p6.
        const climb = runDriver(overshootLevel, abilities, driver, {
            maxFrames: 4000,
            until: () => driver.getStatus().lastPlatform === 'p6',
        });
        expect(driver.getStatus().lastPlatform).toBe('p6');
        // Phase 2: target the low branch-tip portal, CONTINUING from
        // the overshot state. No jump path exists from p6; the driver
        // must descend (fall out, respawn) and take the low route.
        driver.setTarget({ kind: 'portal', id: 'side_exit_N' });
        const r = runDriver(overshootLevel, abilities, driver, {
            maxFrames: 8000,
            startState: climb.state,
            until: ({ portalsTouched }) => portalsTouched.has('side_exit_N'),
        });
        expect(r.portalsTouched.has('side_exit_N')).toBe(true);
    });
});

describe('botDriver — edge cases', () => {
    it('emits no input for a goal that is not in this level', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'not_here' });
        const r = runDriver(bounceStack, noAbilities(), driver, { maxFrames: 300 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
        expect(driver.getStatus().nextPlatform).toBeNull();
    });

    it('is idle with no target and reports inactive status', () => {
        const driver = createBotDriver();
        const r = runDriver(bounceStack, noAbilities(), driver, { maxFrames: 60 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
        expect(driver.getStatus().active).toBe(false);
    });

    it('clearTarget stops planning', () => {
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'loc_arrow' });
        driver.clearTarget();
        expect(driver.getStatus().active).toBe(false);
        const r = runDriver(bounceStack, noAbilities(), driver, { maxFrames: 60 });
        expect(r.inputs.every((i) => i === null)).toBe(true);
    });

    it('falls back through an open non-target portal when no avoiding route exists', () => {
        // A mid-column open portal cannot be avoided on a pure column —
        // the driver must take the unfiltered path rather than park.
        const level = {
            ...bounceStack,
            portals: [
                ...bounceStack.portals,
                { id: 'mid_portal', x: 200, y: 480, on: 'p5', target_region: null, direction: 'up' },
            ],
        };
        const driver = createBotDriver();
        driver.setTarget({ kind: 'pickup', id: 'loc_arrow' });
        const r = runDriver(level, noAbilities(), driver, {
            isPortalOpen: () => true,
            until: ({ pickupsTouched }) => pickupsTouched.has('loc_arrow'),
        });
        expect(r.pickupsTouched.has('loc_arrow')).toBe(true);
    });
});
