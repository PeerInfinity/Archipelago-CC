/**
 * AP-V1 unlock pool emission (unlock-discretization plan §7).
 *
 * Covers the library side of the randomized world: per-town emission
 * counts, the town-major ordering, the town-scoped HasFromList ordinal
 * rules, victory placement in the LAST included town, id sanitization,
 * the item library, and — the byte-inertness gate — that the default
 * (emission-off) payload is exactly what it was before the knobs
 * existed.
 *
 * The last describe block runs one leg through the REAL shared rule
 * evaluator rather than asserting on rule shape. Rationale: the
 * evaluator's HasFromList case falls back to PRESENCE counting when its
 * context has no `countItem` (ruleBuilderEvaluator.js). Under that
 * fallback every count silently caps at 14 (the number of distinct
 * supply-step names), which would strand every deep location as
 * unreachable-in-logic while every shape assertion above still passed.
 * That failure has to be caught by test, not in play.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { substrateRegistryEntry as omsi } from './omsiSubstrateWrapperLibrary.js';
import {
    ensureUnlockTable,
    buildUnlockPool,
    sanitizeRowId,
    supplyStepItemName,
    OMSI_FILLER_ITEM_NAME,
} from './unlockPool.js';
import { evaluateRule } from '../shared/ruleEngine/core.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

// Per-town discovery-pool sizes, from the fork's unlockTable.json.
const TOWN_LOCATION_COUNTS = [90, 320, 30, 60, 100, 20, 0, 0, 0];

const emitZone = (zoneIdx, region_id = 'R') => omsi.extractZoneRules(zoneIdx, { region_id });
const supplyLocs = (zone) => zone.locations.filter((l) => l.id !== 'travel_onward');
const ruleCount = (loc) => loc.access_rule?.args?.count ?? 0;

beforeAll(async () => {
    await ensureUnlockTable();
});

beforeEach(() => {
    // Module state must not leak between cases (the panel path
    // re-arranges without reloading modules).
    omsi.applyPipelineConfig(null);
});

describe('defaults are byte-inert', () => {
    it('reproduces the v0 payload exactly with no config', () => {
        expect(omsi.zoneCount).toBe(1);
        expect(emitZone(0)).toEqual({
            locations: [{ id: 'start_journey', item: 'Victory', position: null }],
            payload: { omsiTown: 0, ap_locations: { start_journey: 'R__start_journey' } },
        });
        expect(omsi.libraryItems).toEqual({
            Victory: { classification: 'progression', is_victory: true },
        });
    });

    it('stays on the v0 path when towns rise but emission is off', () => {
        omsi.applyPipelineConfig({ towns: 3 });
        expect(omsi.zoneCount).toBe(3);
        expect(emitZone(0).locations).toHaveLength(1);
        expect(emitZone(0).locations[0].id).toBe('start_journey');
        expect(emitZone(1).locations).toHaveLength(0);
        expect(omsi.libraryItems).toEqual({
            Victory: { classification: 'progression', is_victory: true },
        });
    });
});

describe('towns knob', () => {
    it('drives zoneCount through the frozen entry getter', () => {
        expect(Object.isFrozen(omsi)).toBe(true);
        omsi.applyPipelineConfig({ towns: 5 });
        expect(omsi.zoneCount).toBe(5);
        omsi.applyPipelineConfig({ towns: 1 });
        expect(omsi.zoneCount).toBe(1);
    });

    it('clamps out-of-range values to 1..9', () => {
        omsi.applyPipelineConfig({ towns: 0 });
        expect(omsi.zoneCount).toBe(1);
        omsi.applyPipelineConfig({ towns: 99 });
        expect(omsi.zoneCount).toBe(9);
        omsi.applyPipelineConfig({ towns: 'nonsense' });
        expect(omsi.zoneCount).toBe(1);
    });
});

describe('emission counts', () => {
    it('emits each town\'s discovery pool, towns 6-8 contributing none', () => {
        omsi.applyPipelineConfig({ towns: 9, emitUnlockLocations: true });
        for (let t = 0; t < 9; t++) {
            expect(supplyLocs(emitZone(t))).toHaveLength(TOWN_LOCATION_COUNTS[t]);
        }
    });

    it('emits 90 town-0 locations plus travel_onward for a 1-town world', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const zone = emitZone(0);
        expect(zone.locations).toHaveLength(91);
        expect(zone.locations.at(-1).id).toBe('travel_onward');
        expect(zone.payload.victoryTown).toBe(1);
    });
});

describe('ids and the ap_locations map', () => {
    beforeEach(() => omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true }));

    it('sanitizes row ids for AP names but keys ap_locations by the RAW id', () => {
        expect(sanitizeRowId('q:0:Pots:1')).toBe('q_0_Pots_1');
        const zone = emitZone(0, 'region_1_1');
        expect(zone.locations[0].id).toBe('q_0_Pots_1');
        // The fork speaks raw row ids (seedReportedLocations /
        // onUnlockAchieved), so those stay the map's keys.
        expect(zone.payload.ap_locations['q:0:Pots:1']).toBe('region_1_1__q_0_Pots_1');
        for (const id of Object.keys(zone.payload.ap_locations)) {
            if (id === 'travel_onward') continue;
            expect(id).toMatch(/^q:\d+:[A-Za-z]+:\d+$/);
        }
        for (const name of Object.values(zone.payload.ap_locations)) {
            expect(name).not.toMatch(/:/);
        }
    });

    it('retires the legacy start_journey key on the emission-ON path', () => {
        expect(emitZone(0).payload.ap_locations.start_journey).toBeUndefined();
        expect(emitZone(0).payload.ap_locations.travel_onward).toBe('R__travel_onward');
    });

    it('carries an explicit item->var map so the bridge never parses names', () => {
        const meta = emitZone(0).payload.unlockMeta;   // world-scoped
        expect(meta.itemToVar['Pots Supply Step']).toBe('Pots');
        expect(meta.vars.Pots).toEqual({ town: 0, rowCount: 50 });
        expect(Object.keys(meta.vars).sort()).toEqual(['LQuests', 'Locks', 'Pots', 'SQuests']);
    });

    it('scopes unlockMeta to the WORLD, not the zone, on every zone payload', () => {
        // The overlay is global engine state and an unlisted var runs
        // NATIVE capacity, so the bridge must be able to name every
        // included town's vars while standing in any one region.
        omsi.applyPipelineConfig({ towns: 3, emitUnlockLocations: true });
        const expected = ['Gamble', 'Herbs', 'Hunt', 'LQuests', 'Locks',
            'Pots', 'SQuests', 'WildMana'];
        for (const zoneIdx of [0, 1, 2]) {
            const meta = emitZone(zoneIdx).payload.unlockMeta;
            expect(Object.keys(meta.vars).sort()).toEqual(expected);
        }
        // Each var still carries its own town, so nothing is lost.
        const meta = emitZone(0).payload.unlockMeta;
        expect(meta.vars.Gamble.town).toBe(2);
        expect(meta.vars.Herbs).toEqual({ town: 1, rowCount: 200 });
    });
});

describe('access rules', () => {
    it('uses HasFromList (never HasFromListUnique) and omits the count-0 rule', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const locs = supplyLocs(emitZone(0));
        expect(locs[0].access_rule).toBeUndefined();   // count 0 -> engine True_
        for (const loc of locs.slice(1)) {
            expect(loc.access_rule.rule).toBe('HasFromList');
        }
    });

    it('numbers the counts 0..K-1 in town-major order', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const counts = supplyLocs(emitZone(0)).map(ruleCount);
        expect(counts).toEqual([...Array(90).keys()]);
    });

    it('continues the global ordinal across towns', () => {
        omsi.applyPipelineConfig({ towns: 3, emitUnlockLocations: true });
        expect(supplyLocs(emitZone(0)).map(ruleCount).at(-1)).toBe(89);
        expect(supplyLocs(emitZone(1)).map(ruleCount)[0]).toBe(90);
        expect(supplyLocs(emitZone(1)).map(ruleCount).at(-1)).toBe(409);
        expect(supplyLocs(emitZone(2)).map(ruleCount)[0]).toBe(410);
        expect(supplyLocs(emitZone(2)).map(ruleCount).at(-1)).toBe(439);
    });

    it('scopes the item list to towns <= T, in town order', () => {
        omsi.applyPipelineConfig({ towns: 3, emitUnlockLocations: true });
        const town0 = ['LQuests', 'Locks', 'Pots', 'SQuests'].map(supplyStepItemName);
        const town1 = ['Herbs', 'Hunt', 'WildMana'].map(supplyStepItemName);
        const town2 = ['Gamble'].map(supplyStepItemName);

        // A town-0 location must NOT be satisfiable by deeper towns' copies.
        expect(supplyLocs(emitZone(0)).at(-1).access_rule.args.item_names).toEqual(town0);
        // A town-1 location sees town 0 AND town 1, town-major.
        expect(supplyLocs(emitZone(1)).at(-1).access_rule.args.item_names)
            .toEqual([...town0, ...town1]);
        expect(supplyLocs(emitZone(2)).at(-1).access_rule.args.item_names)
            .toEqual([...town0, ...town1, ...town2]);
    });

    it('applies the general floor(i * K/L) formula, not a hardcoded i', () => {
        // The v1 pool is 1:1 so K/L === 1; assert the formula's own
        // output rather than the degenerate shortcut.
        omsi.applyPipelineConfig({ towns: 2, emitUnlockLocations: true });
        const pool = buildUnlockPool(2);
        const all = [...pool.zones[0].locations, ...pool.zones[1].locations];
        all.forEach((loc, i) => {
            const L = pool.zones.slice(0, loc.town + 1)
                .reduce((n, z) => n + z.locations.length, 0);
            expect(loc.count).toBe(Math.floor((i * L) / L));
        });
    });
});

describe('victory placement (ruling f)', () => {
    it('rides zone 0 when N = 1', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const zone = emitZone(0);
        const victory = zone.locations.at(-1);
        expect(victory.id).toBe('travel_onward');
        expect(victory.item).toBe('Victory');
        expect(victory.access_rule).toEqual({
            rule: 'HasFromList',
            args: { item_names: buildUnlockPool(1).itemNames, count: 89 },
        });
        expect(zone.payload.victoryTown).toBe(1);
    });

    it('moves to zone N-1 when N = 3, and no earlier zone carries it', () => {
        omsi.applyPipelineConfig({ towns: 3, emitUnlockLocations: true });
        expect(emitZone(0).locations.some((l) => l.item === 'Victory')).toBe(false);
        expect(emitZone(1).locations.some((l) => l.item === 'Victory')).toBe(false);
        const zone = emitZone(2);
        const victory = zone.locations.at(-1);
        expect(victory.id).toBe('travel_onward');
        expect(victory.item).toBe('Victory');
        // K_total - 1: 90 + 320 + 30 = 440 copies.
        expect(victory.access_rule.args.count).toBe(439);
        expect(zone.payload.victoryTown).toBe(3);
        expect(emitZone(0).payload.victoryTown).toBeUndefined();
    });
});

describe('libraryItems', () => {
    it('declares supply steps skip-balancing, plus Victory and the filler', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const lib = omsi.libraryItems;
        expect(lib['Pots Supply Step']).toEqual({ classification: 'progression_skip_balancing' });
        expect(lib.Victory).toEqual({ classification: 'progression', is_victory: true });
        expect(lib[OMSI_FILLER_ITEM_NAME]).toEqual({ classification: 'filler' });
        // 4 town-0 vars + Victory + filler.
        expect(Object.keys(lib)).toHaveLength(6);
    });

    it('grows with the town count and covers every emitted item', () => {
        omsi.applyPipelineConfig({ towns: 3, emitUnlockLocations: true });
        const lib = omsi.libraryItems;
        expect(Object.keys(lib)).toHaveLength(10);   // 8 vars + Victory + filler
        for (let t = 0; t < 3; t++) {
            for (const loc of supplyLocs(emitZone(t))) {
                expect(lib[loc.item]).toBeDefined();
            }
        }
    });
});

// ────────────────────────────────────────────────────────────────
// The independent-ish leg: the REAL evaluator, duplicate copies.
// ────────────────────────────────────────────────────────────────

describe('rule evaluation against duplicate item copies', () => {
    // The REAL host evaluation context, not a stub: createSnapshotInterface
    // is what stateManager hands evaluateRule in play, and it is the thing
    // that supplies `countItem`. Building it for real is the whole point —
    // a stub could accidentally provide a countItem the play path lacks.
    const ctx = (inventory) => createSnapshotInterface(
        { inventory },
        { game_name: 'Omsi Randomized Test', items: {}, locations: {}, regions: {} },
    );

    it('sums duplicate copies of ONE name past the 14-name ceiling', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        // The deepest town-0 location: needs 89 copies, far beyond the
        // 4 distinct names in its list (14 game-wide). Only a
        // count-summing HasFromList can satisfy it.
        const deepest = supplyLocs(emitZone(0)).at(-1);
        expect(deepest.access_rule.args.count).toBe(89);
        expect(deepest.access_rule.args.item_names.length).toBe(4);

        expect(evaluateRule(deepest.access_rule, ctx({ 'Pots Supply Step': 89 }))).toBe(true);
        expect(evaluateRule(deepest.access_rule, ctx({ 'Pots Supply Step': 88 }))).toBe(false);
        // Spread across names sums the same way.
        expect(evaluateRule(deepest.access_rule, ctx({
            'Pots Supply Step': 50,
            'SQuests Supply Step': 20,
            'Locks Supply Step': 10,
            'LQuests Supply Step': 9,
        }))).toBe(true);
    });

    it('would FAIL under presence-only counting — the fallback trap', () => {
        // Documents the failure mode the previous case guards: with one
        // copy of every name (presence satisfied for all 4), the rule
        // must still evaluate false, because 4 copies < 89.
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const deepest = supplyLocs(emitZone(0)).at(-1);
        const oneEach = Object.fromEntries(
            deepest.access_rule.args.item_names.map((n) => [n, 1]),
        );
        expect(evaluateRule(deepest.access_rule, ctx(oneEach))).toBe(false);
    });

    it('makes the whole town-0 chain reachable one location at a time', () => {
        omsi.applyPipelineConfig({ towns: 1, emitUnlockLocations: true });
        const locs = supplyLocs(emitZone(0));
        const inventory = {};
        locs.forEach((loc, i) => {
            // Standing at ordinal i we hold exactly the i preceding items.
            const rule = loc.access_rule;
            if (rule) expect(evaluateRule(rule, ctx(inventory))).toBe(true);
            inventory[loc.item] = (inventory[loc.item] ?? 0) + 1;
            expect(Object.values(inventory).reduce((a, b) => a + b, 0)).toBe(i + 1);
        });
        // …and the victory rule closes exactly on the last one.
        const victory = emitZone(0).locations.at(-1);
        expect(evaluateRule(victory.access_rule, ctx(inventory))).toBe(true);
    });
});
