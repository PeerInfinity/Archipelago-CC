// Region-atlas placement in SPHERE growth (region-atlas Phase 6, slice 1).
//
// An `atlas:<game>` quota is a content source whose entries are pieces of a real
// game map, projected into the maze substrate by Phase 5b. The engine places one
// per node BESIDE the gated skeleton — synthetic gate in front, the map's own
// rules kept underneath — which is plan decision 9's safe default.
//
// Covers: placement + naming, the leaf fence (an atlas region hosts no
// children), AND-composition of the driver's gate onto an authored rule, the
// back-exit landing on a walkable tile, at-most-once placement, byte-inertness
// with no atlas quota, and every loud decline. Grows real sphere worlds → *.slow.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import '../mazeRoom/mazeRoomLibrary.js';
import {
    growSpheres, buildRulesJson, resolveSphereAtlasSources,
    getRegionExits, getRegionEntrance,
} from './procgenPipelineEngine.js';
import { planSpheres, computeItemSpheres, compareSpheresToPlan } from './spherePlanner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const POOL = JSON.parse(
    readFileSync(path.join(REPO, 'frontend/atlas-pools/seedling-atlas-pool.json'), 'utf8'));

const ITEM_POOL = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };
const plan = () => planSpheres({
    itemPool: ITEM_POOL, sphereCount: 3, victoryItem: 'victory', seed: 1,
});

function grow({ seed = 1, quotas, config = {}, fillers = 2 } = {}) {
    return growSpheres({
        regionSize: { width: 8, height: 6 },
        seed,
        growthParams: {
            spherePlan: plan(),
            substrateQuotas: quotas,
            startSubstrate: 'maze',
            maxItemsPerRegion: 2,
            fillerCount: fillers,
            ...config,
        },
    });
}

const ATLAS_CONFIG = { substrateConfig: { seedling: { atlasDoc: POOL } } };

// Serialize a grid deterministically (mirrors dump-sphere-byteidentity).
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const exitMap = getRegionExits(region);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            payload: {
                ...region.playable_payload,
                exits: exitMap instanceof Map ? [...exitMap.values()] : exitMap,
                entrance: getRegionEntrance(region) ?? null,
            },
        };
    }
    return JSON.stringify(out);
}

describe('sphere growth places real map regions', () => {
    const grown = grow({
        seed: 1,
        quotas: { maze: 4, 'atlas:seedling': 3 },
        config: ATLAS_CONFIG,
    });

    it('places atlas nodes and names them after the map, not the cell', () => {
        const atlasNodes = grown.tree.nodes.filter((n) => n.substrate === 'atlas:seedling');
        expect(atlasNodes.length).toBeGreaterThan(0);
        for (const n of atlasNodes) {
            expect(POOL.entries.some((e) => e.entry_id === n.region_id)).toBe(true);
            expect(n.region_id).not.toMatch(/^region_\d+_\d+$/);
        }
    });

    it('the placed region renders as its own substrate (maze), not as the source id', () => {
        for (const n of grown.tree.nodes.filter((x) => x.substrate === 'atlas:seedling')) {
            expect(grown.grid.getRegion(n.cell).substrate).toBe('maze');
        }
    });

    it('an atlas region hosts NO children (the v1 leaf fence)', () => {
        const atlasIdx = new Set(grown.tree.nodes
            .filter((n) => n.substrate === 'atlas:seedling').map((n) => n.index));
        expect(atlasIdx.size).toBeGreaterThan(0);
        for (const n of grown.tree.nodes) {
            if (n.parent != null) expect(atlasIdx.has(n.parent)).toBe(false);
        }
    });

    it('places each entry AT MOST ONCE — an atlas region is a specific place', () => {
        const ids = grown.tree.nodes
            .filter((n) => n.substrate === 'atlas:seedling').map((n) => n.region_id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('the driver back-exit lands on a WALKABLE tile of the real map', () => {
        // The grid-mirror tile a generated region would use is very likely a wall
        // in a real map (and may not even be in an atlas region, which is sized
        // to its own bounds), so the arrival is retargeted to the projection's
        // own entrance. An arrival into a wall is the failure this rules out.
        for (const n of grown.tree.nodes.filter((x) => x.substrate === 'atlas:seedling')) {
            const region = grown.grid.getRegion(n.cell);
            const back = [...getRegionExits(region).values()].find((e) => e.isBackExit);
            expect(back).toBeTruthy();
            const w = region.playable_payload;
            expect(w.tiles[back.y * w.width + back.x]).toBe(0);
        }
    });

    it('keeps the sphere oracle exact', () => {
        const rules = buildRulesJson(grown.grid, {
            startCell: grown.startCell, seed: 1, completionConditionItem: 'victory',
            procgenMetadata: { driver: 'sphere-growth', stop_reason: 'plan_complete' },
        });
        expect(compareSpheresToPlan(computeItemSpheres(rules), plan())).toEqual([]);
    });

    it('carries the map\'s own rule gates into the compiled world', () => {
        const rules = buildRulesJson(grown.grid, {
            startCell: grown.startCell, seed: 1, completionConditionItem: 'victory',
        });
        const sidecars = rules.preset_sidecars['1'];
        const atlasIds = grown.tree.nodes
            .filter((n) => n.substrate === 'atlas:seedling').map((n) => n.region_id);
        const gated = atlasIds
            .map((id) => sidecars[id].playable_payload)
            .filter((p) => Object.values(p.obstacleLib ?? {})
                .some((o) => o.clear_set_type === 'rule'));
        expect(gated.length).toBeGreaterThan(0);
    });

    it('leaves no atlas residency in the compiled world', () => {
        const rules = buildRulesJson(grown.grid, {
            startCell: grown.startCell, seed: 1, completionConditionItem: 'victory',
        });
        const text = JSON.stringify(rules);
        expect(text).not.toContain('atlasDoc');
        expect(text).not.toContain(POOL.pool_id);
    });
});

describe('byte-inertness', () => {
    it('a world with no atlas quota is identical whether or not the doc rides along', () => {
        const without = grow({ seed: 2, quotas: { maze: 9 } });
        const withDoc = grow({ seed: 2, quotas: { maze: 9 }, config: ATLAS_CONFIG });
        expect(dumpGrid(withDoc.grid)).toBe(dumpGrid(without.grid));
    });

    it('a zero atlas quota takes no atlas code path', () => {
        const zero = grow({
            seed: 2, quotas: { maze: 9, 'atlas:seedling': 0 }, config: ATLAS_CONFIG,
        });
        expect(dumpGrid(zero.grid)).toBe(dumpGrid(grow({ seed: 2, quotas: { maze: 9 } }).grid));
    });

    it('growing twice reproduces the same world (selection draws no rng)', () => {
        const a = grow({ seed: 5, quotas: { maze: 4, 'atlas:seedling': 3 }, config: ATLAS_CONFIG });
        const b = grow({ seed: 5, quotas: { maze: 4, 'atlas:seedling': 3 }, config: ATLAS_CONFIG });
        expect(dumpGrid(a.grid)).toBe(dumpGrid(b.grid));
    });
});

describe('loud declines', () => {
    it('an atlas quota with no document', () => {
        expect(() => grow({ quotas: { maze: 4, 'atlas:seedling': 2 } }))
            .toThrow(/no atlasDoc in growthParams.substrateConfig\['seedling'\]/);
    });

    it('a quota larger than the pool — entries are places, not palette chips', () => {
        expect(() => grow({
            quotas: { maze: 4, 'atlas:seedling': 99 }, config: ATLAS_CONFIG,
        })).toThrow(/placed at most once per world/);
    });

    it('a node needing more locations than the real map was marked with', () => {
        // Every atlas quota, no fillers, two items per region: sooner or later a
        // node lands on a sub-region the map put no chest in.
        expect(() => grow({
            seed: 3, fillers: 0,
            quotas: { maze: 2, 'atlas:seedling': 8 }, config: ATLAS_CONFIG,
        })).toThrow(/no unplaced atlas region fits this slot/);
    });

    it('an atlas-only world has nothing to hang the tree on, and says so', () => {
        expect(() => grow({
            quotas: { 'atlas:seedling': 9 }, config: ATLAS_CONFIG,
        })).toThrow(/hosts no children/);
    });
});

describe('the driver gate composes ONTO the atlas rule, never over it', () => {
    // The leaf fence means growth never hands an atlas node a child today, so
    // drive the source directly: this is the behaviour that must already be
    // right on the day the fence lifts.
    const source = resolveSphereAtlasSources({ 'atlas:seedling': 1 }, {
        growthParams: ATLAS_CONFIG,
    })['atlas:seedling'];

    it('ANDs the sphere gate with the crossing\'s own rule', () => {
        const entry = POOL.entries.find((e) => e.entry_id === 'overworld_start__r2c13');
        const gatedExit = entry.exits.find((e) => e.access_rule);
        const { region } = source.instantiate({
            region_id: 'x',
            regionSize: { width: 20, height: 20 },
            entranceSide: 'S',
            exitPlans: [{ side: 'N', gate: ['key_red'], gateCounts: {} }],
            locations: [],
            regionParams: {},
            atlasEntryId: entry.entry_id,
        });
        // The first payload exit takes the child side; assert against whichever
        // that is rather than assuming an order.
        const placed = region.exits_placed.find((e) => e.side === 'N');
        const compiled = region.extracted_rules.exits.find((e) => e.id === placed.exit_id);
        const authored = entry.exits.find((e) => e.exit_id === placed.exit_id).access_rule;
        expect(authored).toBeTruthy();
        expect(compiled.access_rule.rule).toBe('And');
        expect(compiled.access_rule.children).toContainEqual(authored);
        expect(JSON.stringify(compiled.access_rule)).toContain('key_red');
        expect(gatedExit).toBeTruthy();
    });

    it('uses the sphere gate alone where the map charges nothing', () => {
        const entry = POOL.entries.find((e) => e.entry_id === 'overworld_start__r8c0');
        const { region } = source.instantiate({
            region_id: 'y',
            regionSize: { width: 20, height: 20 },
            entranceSide: 'S',
            exitPlans: [{ side: 'N', gate: ['key_red'], gateCounts: {} }],
            locations: [],
            regionParams: {},
            atlasEntryId: entry.entry_id,
        });
        const placed = region.exits_placed.find((e) => e.side === 'N');
        const compiled = region.extracted_rules.exits.find((e) => e.id === placed.exit_id);
        expect(entry.exits.find((e) => e.exit_id === placed.exit_id).access_rule).toBeNull();
        // A one-term gate collapses to the bare Has (makeAndRule's own rule) —
        // composing with "no constraint" is the identity, not an And of one.
        expect(compiled.access_rule).toEqual({ rule: 'Has', args: { item_name: 'key_red' } });
    });
});
