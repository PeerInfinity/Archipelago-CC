/**
 * Step-7 generator: generate-and-test. The verify half is the same
 * derive-rules verifier the pipeline runs, so a passing generateLevel
 * IS a machine-checked level: every pickup and the top exit require
 * exactly the requested ability set.
 */
import { describe, it, expect } from 'vitest';
import {
    generateLevel, generateZoneSet,
    EXPERIMENTAL_GEOMETRY, deriveGeometry, validateGeometry, resolveGenPhysics,
} from './generator.js';
import { DEFAULTS, PROFILES } from './physics.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { createBounceSubstrateEntry } from './bounceDemoLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    arrangeShuffledSpiral,
    buildRulesJson,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { VICTORY_ITEM_NAME } from './apRules.js';

const expectRequires = (level, requirement) => {
    expect(validateLevel(level)).toEqual([]);
    const derived = deriveAccessRules(level);
    expect(derived.defects).toEqual([]);
    const want = [...requirement].sort();
    for (const pk of level.pickups) {
        expect(derived.pickups[pk.id].minimalSets).toEqual([want]);
    }
    expect(derived.exits.exit_up.minimalSets).toEqual([want]);
};

describe('generateLevel', () => {
    it('generates verified levels for every single-ability requirement', () => {
        for (const ability of ['springs', 'jetpacks', 'blue', 'brown', 'left', 'right']) {
            const level = generateLevel({ id: `t_${ability}`, requirement: [ability], seed: 1 });
            expectRequires(level, [ability]);
        }
    });

    it('generates multi-ability and empty requirements across seeds', () => {
        for (const seed of [1, 2, 3]) {
            expectRequires(
                generateLevel({ id: 's', requirement: [], pickupCount: 2, seed }), []);
            expectRequires(
                generateLevel({ id: 'sr', requirement: ['springs', 'right'], seed }),
                ['springs', 'right']);
            expectRequires(
                generateLevel({ id: 'bl', requirement: ['blue', 'left'], seed }),
                ['blue', 'left']);
        }
    });

    it('jitter verifies only when BOTH arrows are required', () => {
        // arrowless: even ±1px breaks the span-edge launch position;
        // one arrow corrects only one direction. Both arrows: seek can
        // correct either way, so jittered proposals verify.
        expect(() => generateLevel({ id: 'j0', requirement: [], jitter: 1, seed: 3 }))
            .toThrow(/no valid proposal/);
        expect(() => generateLevel({ id: 'j1', requirement: ['left'], jitter: 25, seed: 3 }))
            .toThrow(/no valid proposal/);
        const level = generateLevel({
            id: 'j2', requirement: ['left', 'right'], jitter: 25, seed: 3,
        });
        expectRequires(level, ['left', 'right']);
        // and the jitter actually moved something off-column
        expect(level.platforms.some((p) => p.x !== 200 && p.x !== 340 && p.x !== 60))
            .toBe(true);
    });

    it('is deterministic for a given seed', () => {
        const a = generateLevel({ id: 'd', requirement: ['springs'], seed: 7 });
        const b = generateLevel({ id: 'd', requirement: ['springs'], seed: 7 });
        expect(a).toEqual(b);
    });
});

describe('generateZoneSet', () => {
    it('builds a structurally sound zone table', () => {
        const zones = generateZoneSet({ count: 7, seed: 1 });
        expect(zones).toHaveLength(7);
        // starter grants both arrows with no requirement
        expect(Object.values(zones[0].items).sort())
            .toEqual(['Left arrow', 'Right arrow']);
        // exactly one Victory, on the last zone
        const victoryZones = zones.filter((z) =>
            Object.values(z.items).includes(VICTORY_ITEM_NAME));
        expect(victoryZones).toEqual([zones[zones.length - 1]]);
        // exactly one filler (count 7 = 6 structural + 1)
        expect(zones.filter((z) => z.level.pickups.length === 0)).toHaveLength(1);
    });
});

// ── end-to-end: generated zones through the spiral, winnable ──────────

function evalRule(rule, items) {
    switch (rule.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'Has': return items.has(rule.args.item_name);
        case 'And': return rule.children.every((c) => evalRule(c, items));
        case 'Or': return rule.children.some((c) => evalRule(c, items));
        default: throw new Error(`evalRule: unhandled rule '${rule.rule}'`);
    }
}

function sweep(regions) {
    const items = new Set();
    const reachable = new Set(['Menu']);
    const checked = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        for (const name of [...reachable]) {
            for (const exit of regions[name].exits ?? []) {
                if (!exit.connected_region || reachable.has(exit.connected_region)) continue;
                if (evalRule(exit.access_rule ?? { rule: 'True_' }, items)) {
                    reachable.add(exit.connected_region);
                    changed = true;
                }
            }
            for (const loc of regions[name].locations ?? []) {
                if (checked.has(loc.name)) continue;
                if (evalRule(loc.access_rule ?? { rule: 'True_' }, items)) {
                    checked.add(loc.name);
                    if (loc.item?.name) items.add(loc.item.name);
                    changed = true;
                }
            }
        }
    }
    return { items, reachable, checked };
}

describe('generated zone set through the spiral (e2e)', () => {
    it.each([
        ['directional', 11, 0],
        ['arbitrary', 12, 0],
        ['directional', 13, 25], // jittered set (non-starters gain both arrows)
    ])('%s placement, seed %i, jitter %i: rules.json is winnable', (placement, seed, jitter) => {
        const id = `bounce_gen_${placement}_j${jitter}`;
        if (!substrateRegistry.has(id)) {
            substrateRegistry.register(createBounceSubstrateEntry({
                id,
                zones: generateZoneSet({ count: 7, seed, jitter }),
                portalPlacement: placement,
            }));
        }
        const { grid, startCell } = arrangeShuffledSpiral({
            regionSize: { width: 8, height: 6 },
            seed,
            growthParams: { substrateQuotas: { [id]: 7 } },
        });
        const rulesJson = buildRulesJson(grid, { startCell, seed, embedSphereLog: false });
        const regions = rulesJson.regions['1'];
        expect(Object.keys(regions)).toHaveLength(8); // Menu + 7 zones

        const result = sweep(regions);
        expect(result.reachable.size).toBe(8);
        expect(result.items).toContain(VICTORY_ITEM_NAME);
    }, 60000);
});

describe('profile geometry (EXPERIMENTAL_GEOMETRY / deriveGeometry / resolveGenPhysics)', () => {
    it('pinned experimental geometry satisfies its own structural constraints', () => {
        expect(validateGeometry(EXPERIMENTAL_GEOMETRY, DEFAULTS)).toEqual([]);
    });

    it('deriveGeometry(experimental constants) reproduces the apex-derived experimental values', () => {
        const G = deriveGeometry(DEFAULTS);
        expect(G.PLAIN_DY).toBe(EXPERIMENTAL_GEOMETRY.PLAIN_DY); // 120 = round10(0.7 * 169)
        expect(G.SPRING_GAP.min).toBe(EXPERIMENTAL_GEOMETRY.SPRING_GAP.min); // 380
        expect(validateGeometry(G, DEFAULTS)).toEqual([]);
        // sweep-calibrated values are copied, not derived
        expect(G.BRANCH_DX).toBe(EXPERIMENTAL_GEOMETRY.BRANCH_DX);
        expect(G.ARROW_HALF_WIDTH_FLOOR).toBe(EXPERIMENTAL_GEOMETRY.ARROW_HALF_WIDTH_FLOOR);
    });

    it('derived geometry stays valid when launch impulses are retuned', () => {
        // a softer-gravity, weaker-spring profile (dj-shaped numbers)
        const C = { ...DEFAULTS, GRAVITY: 0.35, BOUNCE_VY: -11, SPRING_VY: -19, JETPACK_VY: -30 };
        expect(validateGeometry(deriveGeometry(C), C)).toEqual([]);
    });

    it('validateGeometry flags an interceptable gate window', () => {
        const G = {
            ...EXPERIMENTAL_GEOMETRY,
            SPRING_GAP: { min: 300, span: 60 }, // overshoot 184 >= PLAIN_DY
        };
        expect(validateGeometry(G, DEFAULTS).join(' ')).toMatch(/overshoot/);
    });

    it('resolveGenPhysics: experimental default; dj derives geometry; unknown throws', () => {
        const experimental = resolveGenPhysics(undefined);
        expect(experimental.C).toBe(DEFAULTS);
        expect(experimental.G).toBe(EXPERIMENTAL_GEOMETRY);
        const dj = resolveGenPhysics('dj');
        expect(dj.C).toBe(PROFILES.dj.constants);
        expect(validateGeometry(dj.G, dj.C)).toEqual([]);
        expect(() => resolveGenPhysics('moon')).toThrow(/moon/);
    });

    it('generateLevel under the provisional dj profile still verifies (gateless column)', () => {
        const level = generateLevel({ id: 'dj_smoke', requirement: [], physics: 'dj' });
        const derived = deriveAccessRules(level, { constants: PROFILES.dj.constants });
        expect(derived.defects).toEqual([]);
        expect(derived.exits.exit_up.minimalSets).toEqual([[]]);
    });

    it('experimental generation is byte-identical with and without the physics opt', () => {
        const a = generateLevel({ id: 'pin', requirement: ['springs'], seed: 5 });
        const b = generateLevel({ id: 'pin', requirement: ['springs'], seed: 5, physics: 'experimental' });
        expect(b).toEqual(a);
    });
});
