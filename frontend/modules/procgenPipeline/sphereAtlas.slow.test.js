// Region-atlas placement in SPHERE growth (region-atlas Phase 6, slice 1).
//
// An `atlas:<game>` quota is a content source whose entries are pieces of a real
// game map, projected into the maze substrate by Phase 5b. The engine places one
// per node BESIDE the gated skeleton — synthetic gate in front, the map's own
// rules kept underneath — which is plan decision 9's safe default.
//
// Slice 2 replaces the synthetic gate with the map's OWN entry requirement: the
// sorter schedules that requirement into an earlier sphere and places the region
// in the wave that sphere gates, so the gate is both honest and a proper
// sphere-k gate and the oracle stays exact.
//
// Covers: placement + naming, the leaf fence (an atlas region hosts no
// children), AND-composition of the driver's gate onto an authored rule, the
// back-exit landing on a walkable tile, at-most-once placement, byte-inertness
// with no atlas quota, every loud decline, and the whole sorter route.
// Grows real sphere worlds → *.slow.
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
import { sortAtlasRegionsIntoSpheres } from './sphereAtlasSorter.js';
import { requirementDnf } from './regionAtlasPool.js';

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

    it('a QUOTA-route atlas region still hosts NO children', () => {
        // Child hosting reads the pinned entry's exit envelope. The quota route
        // pins no entry (the fit-selector picks one at realisation time), so it
        // keeps the v1 leaf behaviour — the tree-build-vs-realise gap the fence
        // existed for is still open on this route, and only on this route.
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

    it('an atlas-only QUOTA world has nothing to hang the tree on, and says so', () => {
        expect(() => grow({
            quotas: { 'atlas:seedling': 9 }, config: ATLAS_CONFIG,
        })).toThrow(/hosts children only on the real map's own exits/);
    });
});

describe('the SORTER route (slice 2): the map\'s own requirement IS the gate', () => {
    // The plan is mutated by the sorter (it schedules the required items), and
    // the plan is also the oracle — so the same object has to be used for both.
    function sortedGrow(seed = 1) {
        const p = plan();
        const sorted = sortAtlasRegionsIntoSpheres(p, POOL);
        const grown = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed,
            growthParams: {
                spherePlan: p,
                substrateQuotas: { maze: 6, 'atlas:seedling': 8 },
                ...ATLAS_CONFIG,
                atlasAssignments: sorted.assignments,
                startSubstrate: 'maze',
                maxItemsPerRegion: 2,
            },
        });
        return { plan: p, sorted, ...grown };
    }

    const { plan: sortedPlan, sorted, grid, startCell, tree } = sortedGrow();

    it('places exactly the regions the sorter accepted, at the wave it chose', () => {
        const placed = tree.nodes.filter((n) => n.substrate === 'atlas:seedling');
        expect(placed.map((n) => n.region_id).sort())
            .toEqual(sorted.assignments.map((a) => a.entry_id).sort());
        for (const a of sorted.assignments) {
            const node = placed.find((n) => n.region_id === a.entry_id);
            expect(node.wave).toBe(a.wave);
            expect(node.gate).toEqual(a.gate);
        }
    });

    // A scheduled item is a plain sphere item once it is in the plan, so the
    // grower may draw it for a GENERATED region's gate too. These are claims
    // about the map's regions, so they filter to the atlas nodes.
    const atlasNodes = () => tree.nodes.filter((n) => n.substrate === 'atlas:seedling');

    it('gates the water-locked regions on the swim the REAL game charges', () => {
        const wet = atlasNodes().filter((n) => n.gate.includes('Progressive Swim'));
        expect(wet.map((n) => n.region_id).sort()).toEqual([
            'overworld_start__r14c0', 'overworld_start__r4c16',
        ]);
    });

    it('gates the sword-or-spear regions on the OR ITSELF, not on one branch', () => {
        // The lifted fence. The grower's item-level gate is the scheduled
        // disjunct (Ghost Spear), but the rule the WORLD carries is the map's
        // whole OR — so the Progressive Sword route it also allows stays open.
        const armed = atlasNodes().filter((n) => n.gate.includes('Ghost Spear'));
        expect(armed.map((n) => n.region_id).sort()).toEqual([
            'dungeon1_room1__r8c6', 'overworld_start__r11c19',
            'overworld_start__r1c6', 'overworld_start__r2c13',
        ]);
        for (const n of armed) {
            expect(n.gateRule.rule).toBe('Or');
            expect(JSON.stringify(n.gateRule)).toContain('Progressive Sword');
        }
        // ...and it really is the rule the parent's exit into it compiles to.
        const rules = buildRulesJson(grid, {
            startCell, seed: 1, completionConditionItem: 'victory',
        });
        const byName = Object.fromEntries(Object.values(rules.regions)
            .flatMap((m) => Object.entries(m)));
        for (const n of armed) {
            const parent = tree.nodes[n.parent];
            const exit = (byName[parent.region_id].exits ?? [])
                .find((e) => e.connected_region === n.region_id);
            expect(exit.access_rule).toEqual(n.gateRule);
        }
    });

    it('scheduled every requirement into a STRICTLY EARLIER sphere', () => {
        expect(sorted.injected).toEqual([
            { item: 'Ghost Spear', sphere: 1 }, { item: 'Progressive Swim', sphere: 2 },
        ]);
        expect(sortedPlan.spheres[0].items).toContain('Ghost Spear');
        expect(sortedPlan.spheres[1].items).toContain('Progressive Swim');
        for (const n of atlasNodes().filter((x) => x.gate.includes('Ghost Spear'))) {
            expect(n.wave).toBe(1); // gated by sphere-1 items ⇒ a wave-1 node
        }
        for (const n of atlasNodes().filter((x) => x.gate.includes('Progressive Swim'))) {
            expect(n.wave).toBe(2);
        }
    });

    it('keeps the sphere oracle exact with the injected item counted', () => {
        const rules = buildRulesJson(grid, {
            startCell, seed: 1, completionConditionItem: 'victory',
            procgenMetadata: { driver: 'sphere-growth', stop_reason: 'plan_complete' },
        });
        expect(compareSpheresToPlan(computeItemSpheres(rules), sortedPlan)).toEqual([]);
    });

    it('the scheduled item is really placed in the world, in its sphere', () => {
        const rules = buildRulesJson(grid, {
            startCell, seed: 1, completionConditionItem: 'victory',
        });
        const placedItems = Object.values(rules.regions).flatMap((byName) =>
            Object.values(byName).flatMap((r) => (r.locations ?? []).map((l) => l.item?.name)));
        expect(placedItems).toContain('Progressive Swim');
    });

    it('does NOT also draw atlas regions from the quota (no double placement)', () => {
        const ids = tree.nodes.filter((n) => n.substrate === 'atlas:seedling')
            .map((n) => n.region_id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(sorted.assignments.length);
    });

    it('places the WHOLE map — nothing in the starter atlas is out of vocabulary', () => {
        expect(sorted.declined).toEqual([]);
        expect(sorted.assignments).toHaveLength(POOL.entries.length);
        const placed = tree.nodes.map((n) => n.region_id);
        for (const e of POOL.entries) expect(placed).toContain(e.entry_id);
    });

    // --- child hosting, through GROWTH (Phase-6 fence 2, lifted) -------------

    it('hangs children off the real map\'s own doors', () => {
        const atlasIdx = new Set(atlasNodes().map((n) => n.index));
        const hosted = tree.nodes.filter((n) => n.parent != null && atlasIdx.has(n.parent));
        expect(hosted.length).toBeGreaterThan(0);
        // Never more children than the pinned entry has doors — `reserve()`
        // THROWS past that, so the tree-time envelope has to be a hard bound.
        for (const host of atlasNodes()) {
            const entry = POOL.entries.find((e) => e.entry_id === host.region_id);
            const kids = tree.nodes.filter((n) => n.parent === host.index);
            expect(kids.length).toBeLessThanOrEqual(entry.exits.length);
        }
    });

    it('keeps the real map\'s charge for a door, and opens it in the RIGHT sphere', () => {
        // The claim that makes hosting safe: whatever the door already charged
        // survives into the compiled world, and the COMPOSITION of door rule and
        // child gate becomes satisfiable in exactly the child's own gate sphere.
        // Earlier and the child's contents move a sphere forward; later and they
        // move back — both are oracle breaks, and this is the local reason the
        // oracle above stays exact.
        const rules = buildRulesJson(grid, {
            startCell, seed: 1, completionConditionItem: 'victory',
        });
        const byName = Object.fromEntries(Object.values(rules.regions)
            .flatMap((m) => Object.entries(m)));
        // The sphere in which a rule first becomes satisfiable, read off the
        // plan the growth used — min over disjuncts of max over items.
        const opensIn = (rule) => {
            const dnf = requirementDnf(rule);
            expect(dnf).not.toBeNull();
            return Math.min(...dnf.map((conj) => Math.max(0, ...conj.map((t) => {
                let seen = 0;
                for (let i = 0; i < sortedPlan.spheres.length; i += 1) {
                    seen += sortedPlan.spheres[i].items.filter((x) => x === t.item).length;
                    if (seen >= t.count) return i + 1;
                }
                return Infinity;
            }))));
        };
        let gatedDoors = 0;
        let freeDoors = 0;
        for (const host of atlasNodes()) {
            const entry = POOL.entries.find((e) => e.entry_id === host.region_id);
            const kids = tree.nodes.filter((n) => n.parent === host.index);
            kids.forEach((kid, i) => {
                const door = entry.exits[i];           // payload order == child order
                const exit = (byName[host.region_id].exits ?? [])
                    .find((e) => e.connected_region === kid.region_id);
                if (door.access_rule) {
                    gatedDoors += 1;
                    // The map's charge is still in there — never overwritten.
                    const compiled = JSON.stringify(exit.access_rule);
                    expect(compiled).toContain(JSON.stringify(door.access_rule).slice(1, -1));
                } else {
                    freeDoors += 1;
                }
                // Which sphere supplies this child's gate. An ordinary wave-0
                // FILLER gates on sphere 1 (it carries no items, so that costs
                // the plan nothing); an atlas node is flagged a filler too but
                // gates on its own wave, because its gate is the map's.
                const gateWave = kid.wave > 0 ? kid.wave
                    : ((kid.isFiller && !kid.atlasEntry) ? 1 : 0);
                expect(opensIn(exit.access_rule)).toBe(gateWave);
                expect(host.wave).toBeLessThanOrEqual(kid.wave);
            });
        }
        // Both halves are really exercised — a suite where every door happened
        // to be free would prove nothing about the gated one.
        expect(gatedDoors).toBeGreaterThan(0);
        expect(freeDoors).toBeGreaterThan(0);
    });

    it('still routes every hosting region BACK to its parent', () => {
        // The defect hosting exposed: `stitchGrid` identified an exit by its
        // TILE, and an atlas region's back-exit is retargeted onto the
        // projection's own entrance — regularly the same cell as one of its
        // doors. The back-exit then matched that door's row, lost its
        // driver-managed exemption, and was re-stitched to the door's
        // neighbour: two exits into the CHILD, none back to the parent, and a
        // shortcut the plan never made. Compile-clean and oracle-red.
        for (const n of tree.nodes) {
            if (n.parent == null) continue;
            const region = grid.getRegion(n.cell);
            const backs = [...getRegionExits(region).values()].filter((e) => e.isBackExit);
            expect(backs).toHaveLength(1);
            expect(backs[0].targetRegion).toBe(tree.nodes[n.parent].region_id);
        }
    });

    it('is byte-inert for a world with no assignments and no atlas quota', () => {
        const p = plan();
        const withEmpty = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 2,
            growthParams: {
                spherePlan: p,
                substrateQuotas: { maze: 9 },
                startSubstrate: 'maze',
                maxItemsPerRegion: 2,
                fillerCount: 2,
                atlasAssignments: null,
            },
        });
        expect(dumpGrid(withEmpty.grid)).toBe(dumpGrid(grow({ seed: 2, quotas: { maze: 9 } }).grid));
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
