/**
 * Level validator — fixture acceptance plus targeted rejection of
 * each invariant the later layers rely on: goal wake, blocked/deadly
 * goal corridors, wall pockets, embedded/full-span hazards, spawn.
 */

import { describe, it, expect } from 'vitest';
import { validateLevel, goalBox } from './level.js';
import { FIXTURES, flatRun, gapJump } from './fixtures.js';
import { DEFAULTS } from './physics.js';

/** A minimal valid level to perturb. */
function base(over = {}) {
    return {
        id: 'base',
        size: { width: 30, height: 16 },
        platforms: [
            { id: 'floorA', x: 0, y: 0, w: 14, h: 1, type: 'ground' },
            { id: 'floorB', x: 14, y: 0, w: 16, h: 1, type: 'ground' },
        ],
        hazards: [],
        pickups: [],
        portals: [{ id: 'exit', on: 'floorB', x: 29.4, y: 1.6, arrow: 'right', exitName: null }],
        spawn: { x: 1, y: 1 },
        ...over,
    };
}

describe('fixtures', () => {
    for (const fixture of FIXTURES) {
        it(`${fixture.id} validates clean`, () => {
            expect(validateLevel(fixture)).toEqual([]);
        });
    }
});

describe('shape checks', () => {
    it('rejects non-object / missing id / bad size', () => {
        expect(validateLevel(null)).toEqual(['level must be an object']);
        expect(validateLevel(base({ id: '' }))).toContainEqual(
            expect.stringContaining('missing level id'));
        expect(validateLevel(base({ size: { width: 0, height: 16 } }))[0])
            .toMatch(/size/);
    });

    it('rejects duplicate ids, unknown types, out-of-bounds rects', () => {
        const dup = base();
        dup.platforms = [...dup.platforms, { ...dup.platforms[0] }];
        expect(validateLevel(dup)).toContainEqual(expect.stringContaining("duplicate id 'floorA'"));

        const weird = base();
        weird.platforms[0] = { ...weird.platforms[0], type: 'lava' };
        expect(validateLevel(weird)).toContainEqual(expect.stringContaining("unknown type 'lava'"));

        const oob = base();
        oob.platforms[1] = { ...oob.platforms[1], w: 100 };
        expect(validateLevel(oob)).toContainEqual(expect.stringContaining('outside level bounds'));
    });

    it('requires at least one portal', () => {
        expect(validateLevel(base({ portals: [] })))
            .toContainEqual(expect.stringContaining('no portals'));
    });

    it('rejects a bad portal arrow', () => {
        const lvl = base();
        lvl.portals[0] = { ...lvl.portals[0], arrow: 'sideways' };
        expect(validateLevel(lvl)).toContainEqual(expect.stringContaining("bad arrow 'sideways'"));
    });
});

describe('goal-wake invariant', () => {
    it('rejects a goal not hosted by any platform', () => {
        const lvl = base({ pickups: [{ id: 'pk', on: 'ghost', x: 13.8, y: 1.6 }] });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("on='ghost' references no platform"));
    });

    it('rejects a goal away from its host right end (mid-platform)', () => {
        const lvl = base({ pickups: [{ id: 'pk', on: 'floorA', x: 7, y: 1.6 }] });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("outside the auto-run wake of host 'floorA'"));
    });

    it('rejects a goal above standing height at the right end', () => {
        const lvl = base({ pickups: [{ id: 'pk', on: 'floorA', x: 13.8, y: 5 }] });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("outside the auto-run wake of host 'floorA'"));
    });

    it('accepts a right-end goal on a host pinned by the side wall', () => {
        // flatRun's exit_main host ends AT the level's right wall; the
        // wake check must clamp to the pinned stand, not the edge
        expect(validateLevel(flatRun)).toEqual([]);
    });

    it('rejects a solid platform blocking a goal host run corridor', () => {
        const lvl = base();
        lvl.platforms.push({ id: 'wall', x: 20, y: 1, w: 0.5, h: 1, type: 'ground' });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("goal host 'floorB': run corridor blocked by solid platform 'wall'"));
    });

    it('rejects a hazard in a goal host run corridor', () => {
        const lvl = base({ hazards: [{ id: 'hz', type: 'spikes', x: 20, y: 1, w: 1, h: 0.6 }] });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("goal host 'floorB': hazard 'hz' in the run corridor"));
    });

    it('allows a hazard on a non-goal-hosting platform (jump it)', () => {
        const lvl = base({ hazards: [{ id: 'hz', type: 'spikes', x: 7, y: 1, w: 1, h: 0.6 }] });
        expect(validateLevel(lvl)).toEqual([]);
    });
});

describe('stuck-free geometry (wall pockets)', () => {
    it('rejects an unclimbable solid wall rising from a solid floor', () => {
        const lvl = base();
        // taller than 2 * jumpHeight * 1.15 (~5.2 units for celeste)
        lvl.platforms.push({ id: 'wall', x: 7, y: 1, w: 0.5, h: 8, type: 'ground' });
        expect(validateLevel(lvl)).toContainEqual(expect.stringContaining('wall pocket'));
    });

    it('accepts a climbable ledge step (normal geometry)', () => {
        const lvl = base();
        lvl.platforms.push({ id: 'step', x: 7, y: 1, w: 3, h: 1.5, type: 'ground' });
        // the step blocks floorA's goal-free run but is jumpable — and
        // it hosts no goal, so no corridor complaint either
        expect(validateLevel(lvl)).toEqual([]);
    });

    it('does not treat a gated one-way platform as a wall or a pocket floor', () => {
        const lvl = base();
        lvl.platforms.push({ id: 'shelf', x: 7, y: 1, w: 0.5, h: 8, type: 'blue' });
        expect(validateLevel(lvl)).toEqual([]);
    });
});

describe('hazards vs surfaces', () => {
    it('rejects a hazard embedded in a platform body', () => {
        const lvl = base({ hazards: [{ id: 'hz', type: 'spikes', x: 5, y: 0.5, w: 1, h: 1 }] });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("hazard 'hz': embedded in platform 'floorA'"));
    });

    it('rejects a platform whose entire walk surface is lethal', () => {
        const lvl = base();
        lvl.platforms.push({ id: 'trap', x: 5, y: 6, w: 3, h: 0.5, type: 'ground' });
        lvl.hazards = [{ id: 'hz', type: 'spikes', x: 4.5, y: 6.5, w: 4, h: 0.8 }];
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("platform 'trap': entire walk surface is covered by hazards"));
    });

    it('accepts partial hazard coverage (safe landing spots remain)', () => {
        const lvl = base();
        lvl.platforms.push({ id: 'deco', x: 5, y: 6, w: 6, h: 0.5, type: 'ground' });
        lvl.hazards = [{ id: 'hz', type: 'spikes', x: 5, y: 6.5, w: 2, h: 0.8 }];
        expect(validateLevel(lvl)).toEqual([]);
    });
});

describe('spawn clear', () => {
    it('rejects a spawn box inside a solid platform', () => {
        const lvl = base({ spawn: { x: 1, y: 0.5 } });
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining("spawn: standing box overlaps solid platform 'floorA'"));
    });

    it('rejects a spawn box overlapping a hazard', () => {
        const lvl = base({ hazards: [{ id: 'hz', type: 'spikes', x: 0.5, y: 1, w: 2, h: 0.8 }] });
        const errs = validateLevel(lvl);
        expect(errs).toContainEqual(
            expect.stringContaining("spawn: standing box overlaps hazard 'hz'"));
    });

    it('rejects a spawn with no solid ground below (kill-floor loop)', () => {
        const lvl = base();
        lvl.platforms = [{ id: 'far', x: 20, y: 0, w: 10, h: 1, type: 'ground' }];
        lvl.portals = [{ id: 'exit', on: 'far', x: 29.4, y: 1.6, arrow: 'right', exitName: null }];
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining('spawn: no solid ground below the spawn footprint'));
    });

    it('a gated platform below the spawn does not count as ground', () => {
        const lvl = base();
        lvl.platforms = [
            { id: 'shelf', x: 0, y: 0, w: 14, h: 1, type: 'blue' },
            { id: 'far', x: 20, y: 0, w: 10, h: 1, type: 'ground' },
        ];
        lvl.portals = [{ id: 'exit', on: 'far', x: 29.4, y: 1.6, arrow: 'right', exitName: null }];
        expect(validateLevel(lvl)).toContainEqual(
            expect.stringContaining('spawn: no solid ground below the spawn footprint'));
    });
});

describe('goalBox', () => {
    it('defaults to GOAL_HALF and honors explicit extents', () => {
        expect(goalBox({ x: 10, y: 2 })).toEqual({
            x: 10 - DEFAULTS.GOAL_HALF, y: 2 - DEFAULTS.GOAL_HALF,
            w: DEFAULTS.GOAL_HALF * 2, h: DEFAULTS.GOAL_HALF * 2,
        });
        expect(goalBox({ x: 10, y: 2, w: 2, h: 1 })).toEqual({ x: 9, y: 1.5, w: 2, h: 1 });
    });
});

describe('gapJump sizing sanity', () => {
    it('keeps the gap wider than a tap jump and narrower than a full hold', () => {
        const gap = gapJump.platforms[1].x
            - (gapJump.platforms[0].x + gapJump.platforms[0].w);
        expect(gap).toBeGreaterThan(2.4);  // tap jump (~2.1) must fail
        expect(gap).toBeLessThan(4.2);     // full hold (~4.9) must clear
    });
});
