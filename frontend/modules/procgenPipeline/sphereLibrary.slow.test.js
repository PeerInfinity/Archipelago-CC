// Region-library sphere-growth placement (region-library F6a). A `library:<id>`
// quota is a content source whose (bounce) entries fill sphere-growth slots:
// the entry's re-keyable portals are relabelled onto the node's specific sides
// and each exit/entrance GATE rides as an access_rule OVERLAY (logic-looser-
// than-physics — the captured level is reused as pure geometry). Covers:
// placement + gate overlay, portal relabel, rng-free determinism, byte-inert at
// quota 0, and loud no-fit. Grows real bounce sphere worlds → *.slow.
import { describe, it, expect, beforeAll } from 'vitest';
import '../mazeRoom/mazeRoomLibrary.js';
import {
    GATEABLE_ITEMS, extractZoneRules as bounceExtractZoneRules,
} from '../bounceDemo/bounceDemoLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { OPPOSITE_SIDE } from '../shared/procgen/spatialPrimitives.js';
import {
    growSpheres, buildRulesJson, assembleZoneRegion, getRegionExits, getRegionEntrance,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';

const bounce = substrateRegistry.get('bounce');

// Capture a bounce entry with 4 portals + 2 slots (zone `zoneIdx`) so any node
// (≤3 sides, ≤2 items) fits. Captured items are ignored at placement (the engine
// reassigns each node's items onto the slots), so capturing any zone is fine.
function capture(zoneIdx, id, sides = ['N', 'E', 'S', 'W']) {
    const zr = bounceExtractZoneRules(zoneIdx, { region_id: 'orig', exitSides: sides });
    const original = assembleZoneRegion({
        substrate: 'bounce', region_id: 'orig', regionSize: { width: 8, height: 6 },
        exitSides: sides, zoneRules: zr, zonePayload: {},
    });
    return bounce.captureLibraryEntry(original, { entry_id: id });
}

const POOL = {
    'Right arrow': 1, 'Left arrow': 1, Springs: 1, Jetpacks: 1, 'Blue platforms': 1, Victory: 1,
};
function makePlan() {
    return planSpheres({
        itemPool: POOL, sphereCount: 3, exclusiveSpheres: { 1: ['Right arrow'] },
        victoryItem: 'Victory', gateableItems: GATEABLE_ITEMS, seed: 1,
    });
}

// Serialize a grid's regions deterministically (mirrors dump-sphere-byteidentity).
function dumpGrid(grid) {
    const out = {};
    for (const region of grid.allRegions()) {
        const exitMap = getRegionExits(region);
        const exits = exitMap instanceof Map ? [...exitMap.values()] : (exitMap ?? []);
        out[region.region_id] = {
            substrate: region.substrate,
            extracted_rules: region.extracted_rules,
            exits_placed: region.exits_placed,
            payload: { ...(region.playable_payload ?? {}), exits, entrance: getRegionEntrance(region) ?? null },
        };
    }
    return out;
}

function growMixed(quotas, substrateConfig = {}, seed = 7) {
    return growSpheres({
        regionSize: { width: 8, height: 6 }, seed,
        regionParams: { fallBehavior: 'current' },
        growthParams: {
            spherePlan: makePlan(), substrateQuotas: quotas, startSubstrate: 'bounce',
            maxItemsPerRegion: 2, substrateConfig,
        },
    });
}

describe('sphere-growth library placement (F6a, bounce, overlay gates)', () => {
    let doc;
    let result;
    let libNodes;
    beforeAll(() => {
        doc = {
            schema_version: 1, library_id: 'sph', name: 'Sphere Pack',
            entries: [capture(1, 'bn_tower'), capture(4, 'bn_fork')],
        };
        result = growMixed(
            { bounce: 3, 'library:sph': 5 },
            { 'library:sph': { libraryDoc: doc } });
        libNodes = result.tree.nodes.filter((n) => n.substrate === 'library:sph');
    });

    it('places library nodes and mixes them with generated bounce regions', () => {
        expect(libNodes.length).toBeGreaterThan(0);
        expect(result.stats.substrateCounts.bounce).toBeGreaterThan(0);
        // A library-placed region IS a bounce region at runtime (entry substrate).
        for (const n of libNodes) {
            expect(result.grid.getRegion(n.cell).substrate).toBe('bounce');
        }
    });

    it('relabels portals onto the node\'s needed sides + routes the back portal', () => {
        for (const n of libNodes) {
            const region = result.grid.getRegion(n.cell);
            const entranceSide = OPPOSITE_SIDE[n.side];
            // The forward/back-portal exits land on the node's sides (entrance +
            // any children), NOT the captured N/E/S/W — proof of the relabel.
            const childSides = result.tree.nodes.filter((c) => c.parent === n.index).map((c) => c.side);
            const allowed = new Set([entranceSide, ...childSides]);
            for (const ex of region.extracted_rules.exits) {
                // The reciprocal back-exit is keyed by the parent region id (not a
                // side portal); every synthetic exit_<side> must be an allowed side.
                if (ex.id.startsWith('exit_')) expect(allowed.has(ex.id.slice(5))).toBe(true);
            }
            // Back-portal routing param set (parity with generated zone regions).
            expect(region.playable_payload.params.backExitSide).toBe(entranceSide);
            // sidePortals re-keyed to the needed sides.
            for (const s of Object.keys(region.playable_payload.params.sidePortals)) {
                expect(allowed.has(s)).toBe(true);
            }
        }
    });

    it('overlays each entry gate as an access_rule on the entrance exit', () => {
        // At least one library node carries a non-empty entry gate; its entrance
        // exit must carry a Has-rule referencing that gate item (the overlay).
        const gatedNodes = libNodes.filter((n) => (n.gate?.length ?? 0) > 0);
        expect(gatedNodes.length).toBeGreaterThan(0);
        for (const n of gatedNodes) {
            const region = result.grid.getRegion(n.cell);
            const entranceSide = OPPOSITE_SIDE[n.side];
            const entExit = region.extracted_rules.exits.find((e) => e.id === `exit_${entranceSide}`);
            expect(entExit?.access_rule).toBeTruthy();
            const ruleStr = JSON.stringify(entExit.access_rule);
            for (const item of n.gate) expect(ruleStr).toContain(item);
        }
    });

    it('maps node items onto the entry slots + fills the surplus', () => {
        for (const n of libNodes) {
            const region = result.grid.getRegion(n.cell);
            // 2-slot entries: every node ≤2 items, so locations == 2 (items + filler).
            expect(region.extracted_rules.locations).toHaveLength(2);
            const nodeItems = n.items.map((it) => it.item);
            const locItems = region.extracted_rules.locations.map((l) => l.item);
            for (const it of nodeItems) expect(locItems).toContain(it);
        }
    });

    it('compiles the mixed world to a rules.json', () => {
        const rulesJson = buildRulesJson(result.grid, { startCell: result.startCell, worldName: 'SphLib' });
        expect(Object.keys(rulesJson.regions?.['1'] ?? {}).length).toBeGreaterThan(0);
    });

    it('is rng-free / deterministic (two identical grows match byte-for-byte)', () => {
        const a = growMixed({ bounce: 3, 'library:sph': 5 }, { 'library:sph': { libraryDoc: doc } });
        const b = growMixed({ bounce: 3, 'library:sph': 5 }, { 'library:sph': { libraryDoc: doc } });
        expect(dumpGrid(a.grid)).toEqual(dumpGrid(b.grid));
    });

    it('is byte-inert at quota 0 (a selected-but-unused library changes nothing)', () => {
        const withoutKey = growMixed({ bounce: 8 });
        const withZeroQuota = growMixed({ bounce: 8, 'library:sph': 0 }, { 'library:sph': { libraryDoc: doc } });
        expect(dumpGrid(withZeroQuota.grid)).toEqual(dumpGrid(withoutKey.grid));
    });

    it('fails loudly when no entry fits a slot', () => {
        const tiny = {
            library_id: 'tiny', name: 'Tiny',
            entries: [capture(0, 'bn_one', ['E'])], // zone 0: 1 slot, 1 portal
        };
        expect(() => growMixed(
            { bounce: 2, 'library:tiny': 6 }, { 'library:tiny': { libraryDoc: tiny } }))
            .toThrow(/no entry fits sphere slot/);
    });

    it('rejects a library quota with no libraryDoc in substrateConfig', () => {
        expect(() => growMixed({ bounce: 2, 'library:missing': 4 }))
            .toThrow(/no libraryDoc/);
    });
});
