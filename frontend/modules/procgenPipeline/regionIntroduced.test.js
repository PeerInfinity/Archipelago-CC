/**
 * ⛓⛓ REGION INTRODUCED ITEMS + THE INTRODUCTIONS REPORT (slice 2b, `procgen-region-introduced`; ⚖ the user
 * 2026-11-03: *"Yes, add introduced"*, on top-down with several key gates *"Yes, allow"*, and on rooms configured
 * for a key gate that got none *"Accept, and report it"*). Vocabulary: `procgenCore/itemIntroduction.js`.
 *
 * Engine-level and substrate-agnostic (the key-gate rows that READ the field are
 * `seedlingDemo/seedlingGenKeyGateIntroduced.test.js`):
 *   1. `introducedFromGrid`: the items standing at every OTHER region's locations, exact, frozen, the region itself
 *      excluded.
 *   2. Delivery: every region generator of the PLAN-LESS modes (grid growth, the shuffled spiral's procedural and
 *      content cells, top-down's procedural and zone regions) is handed `introduced`; SPHERE GROWTH IS NOT (it keeps
 *      its requests). Never in the output.
 *   3. The report folds per-region notes into `{requested, placed, notPlaced}`; the reason names are declared once;
 *      the sphere planner decides each NONE reason, the pure pre-pass rows produce `no-host`, `batch-boundary`,
 *      `last-wave-of-plan` and `filler-region`.
 *   4. ⛔ PER PLAYER: the report is the SLOT's (`procgen_metadata["<p>"].introductions`), pinned on a 2-player
 *      document; ABSENT (not empty) on a world with no configured region.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { buildRulesJson, growMaze, introducedFromGrid } from './procgenPipelineEngine.js';
import { scheduleSphereIntroductions } from './sphereIntroductions.js';
import { SHIPPED_PRESETS, SEEDLING_GENERATED_ROOM_STATE } from './presetDefs.js';
import { buildRunFromState, runPresetHeadless } from './presetRun.js';
import { resolveLibrarySelection } from './regionLibraryLoader.js';
import {
    INTRODUCTION_NOT_PLACED_REASONS, REGION_INTRODUCTION, introductionReport, markRegionIntroduction,
    regionIntroductionNote, regionIntroductionOf,
} from '../procgenCore/itemIntroduction.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend');
const GEN = 'flash_seedling_gen';

beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
});

// --- 1. the computation ------------------------------------------------------------------------------------

describe('1 — introducedFromGrid: what stands at every OTHER region, exact', () => {
    const grid = {
        allRegions: () => [
            { region_id: 'a', extracted_rules: { locations: [{ id: 'l0', item: 'Red Key' }, { id: 'l1', item: 'x' }] },
                placed_items: [{ item_id: 'x', location_id: 'l1' }] },
            { region_id: 'b', extracted_rules: { locations: [{ id: 'm0', item: { name: 'x' } }, { id: 'm1' }] },
                placed_items: [{ item_id: 'key_red', location_id: 'm1' }] },
            { region_id: 'self', extracted_rules: { locations: [{ id: 's0', item: 'Green Key' }] } },
            { region_id: 'stub' },
        ],
    };
    it('counts every item instance once per location, the region being (re)generated EXCLUDED', () => {
        const got = introducedFromGrid(grid, 'self');
        /** l1 is counted from its extracted item, not again from placed_items; m1 from placed_items alone */
        expect(got).toEqual({ items: { 'Red Key': 1, x: 2, key_red: 1 }, source: 'run', exact: true });
        expect(introducedFromGrid(grid, 'a').items).toEqual({ x: 1, key_red: 1, 'Green Key': 1 });
    });
    it('frozen; nothing stands anywhere → `{}` (known: nothing), never absent', () => {
        const got = introducedFromGrid(grid, 'self');
        expect(Object.isFrozen(got)).toBe(true);
        expect(Object.isFrozen(got.items)).toBe(true);
        expect(introducedFromGrid({ allRegions: () => [] }, 'self')).toEqual({ items: {}, source: 'run', exact: true });
    });
});

// --- 2. delivery -------------------------------------------------------------------------------------------

const HOOKS = {
    generateRegionCore: 0,
    generateZoneForSpecs: 1,
    generateZoneForSpecsGen: 1,
    extractZoneRules: 1,
    instantiateLibraryEntry: 1,
    instantiateLibraryEntryForSpecs: 1,
    instantiateAtlasEntryForSpecs: 1,
};
let restore = [];
afterEach(() => {
    for (const undo of restore) undo();
    restore = [];
});
/** Wrap every generator hook of every registered substrate (the held-items spy, reading `introduced`). */
function spyEveryHook() {
    const calls = [];
    for (const entry of substrateRegistry.getAll()) {
        const spy = Object.create(entry);
        let wrapped = false;
        for (const [hook, argIdx] of Object.entries(HOOKS)) {
            const orig = entry[hook];
            if (typeof orig !== 'function') continue;
            wrapped = true;
            Object.defineProperty(spy, hook, {
                value(...args) {
                    const arg = args[argIdx];
                    calls.push({
                        substrate: entry.id, hook, region: arg?.region_id,
                        has: !!arg && Object.prototype.hasOwnProperty.call(arg, 'introduced'),
                        introduced: arg?.introduced,
                    });
                    return orig.apply(this, args);
                },
            });
        }
        if (!wrapped) continue;
        substrateRegistry.entries.set(entry.id, spy);
        restore.push(() => substrateRegistry.entries.set(entry.id, entry));
    }
    return calls;
}
const TD = 'frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744';
async function diskFetch(url) {
    const text = readFileSync(join(FRONTEND, url), 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
}
async function runShipped(id) {
    const state = structuredClone(SHIPPED_PRESETS.find((p) => p.id === id).state);
    const refs = state.libraries ?? [];
    const resolvedLibraries = refs.length
        ? (await resolveLibrarySelection(refs, { fetchImpl: diskFetch, basePath: '' })).resolved : [];
    const ctx = state.mode !== 'topDown' ? { resolvedLibraries } : {
        resolvedLibraries,
        topDownSource: JSON.parse(readFileSync(join(ROOT, `${TD}_rules.json`), 'utf8')),
        sphereLog: readFileSync(join(ROOT, `${TD}_sphere_log.jsonl`), 'utf8')
            .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)),
    };
    return runPresetHeadless(buildRunFromState(state, ctx));
}
const hooksSeen = (calls) => [...new Set(calls.map((c) => `${c.substrate}.${c.hook}`))].sort();
const expectRunShape = (c) => {
    expect(c.has, `${c.substrate}.${c.hook} ${c.region}`).toBe(true);
    expect(c.introduced).toMatchObject({ source: 'run', exact: true });
    expect(Object.isFrozen(c.introduced.items)).toBe(true);
};

describe('2 — every PLAN-LESS region generator is handed `introduced`; sphere growth is not', () => {
    it('grid growth: every region; the start sees `{}`, a later region what the earlier ones hold', async () => {
        const calls = spyEveryHook();
        const { rulesJson } = await runShipped('shipped:grid-growth-demo');
        expect(calls.length).toBeGreaterThan(1);
        for (const c of calls) expectRunShape(c);
        expect(calls[0].introduced.items).toEqual({});
        expect(calls.some((c) => Object.keys(c.introduced.items).length > 0)).toBe(true);
        /** ⛔ never in the output */
        expect(JSON.stringify(rulesJson)).not.toMatch(/"source":"run"/);
    });

    it('shuffled spiral: procedural cells AND content cells (zone extractZoneRules, library instantiate)', async () => {
        const calls = spyEveryHook();
        await runShipped('shipped:content-spiral-mix');
        await runShipped('shipped:library-spiral-demo');
        const seen = hooksSeen(calls);
        expect(seen).toEqual(expect.arrayContaining(['maze.generateRegionCore']));
        expect(seen.some((h) => h.endsWith('.extractZoneRules'))).toBe(true);
        expect(seen.some((h) => h.endsWith('.instantiateLibraryEntry'))).toBe(true);
        for (const c of calls) expectRunShape(c);
    });

    it('top-down: every region (procedural and zone), excluding itself, from the regions realised before it', async () => {
        const calls = spyEveryHook();
        const { rulesJson } = await runShipped('shipped:topdown-zones-demo');
        expect(calls.length).toBeGreaterThan(0);
        for (const c of calls) expectRunShape(c);
        /** the first region realised sees nothing; each later one at most what the world holds in the end */
        expect(calls[0].introduced.items).toEqual({});
        const finalItems = Object.values(rulesJson.regions['1']).flatMap((r) => (r.locations ?? [])
            .map((l) => l.item?.name ?? l.item)).filter(Boolean);
        for (const c of calls) {
            for (const item of Object.keys(c.introduced.items)) expect(finalItems).toContain(item);
        }
    });

    it('sphere growth: NOT handed (its planner REQUESTS what a region introduces; the plan is the oracle)', async () => {
        const calls = spyEveryHook();
        await runShipped('shipped:maze-bounce-sphere-mix');
        expect(calls.length).toBeGreaterThan(0);
        for (const c of calls) expect(c.has, `${c.substrate}.${c.hook}`).toBe(false);
    });
});

// --- 3. the report -----------------------------------------------------------------------------------------

describe('3 — the report: notes folded into {requested, placed, notPlaced}; reasons named once', () => {
    it('the reason names are the declared set, spelled once', () => {
        expect(Object.values(INTRODUCTION_NOT_PLACED_REASONS)).toEqual(
            ['last-wave-of-plan', 'batch-boundary', 'no-host', 'filler-region', 'not-drawn']);
    });

    const entry = { id: 'fake', itemIntroduction: { introducibleItems: (p) => (p.on ? ['K1', 'K2'] : []) } };
    it('a region note: configured or not; placed; the DRIVER\'s own items are never the region\'s introductions', () => {
        expect(regionIntroductionNote(entry, { on: false }, [{ item: 'K1' }])).toBe(null);
        expect(regionIntroductionNote(entry, { on: true }, [{ item: 'K2' }, { item: 'x' }])).toEqual({ placed: ['K2'] });
        expect(regionIntroductionNote(entry, { on: true }, [{ item: 'x' }], { reasonIfNone: 'no-host' }))
            .toEqual({ placed: [], reason: 'no-host' });
        expect(regionIntroductionNote(entry, { on: true }, [{ item: 'x' }])).toEqual({ placed: [], reason: 'not-drawn' });
        /** a top-down source location holding a same-named item: the driver's, not an introduction */
        expect(regionIntroductionNote(entry, { on: true }, [{ item: 'K1' }], { driverItems: ['K1'] }).placed).toEqual([]);
        expect(regionIntroductionNote(entry, { on: true }, [{ item: 'K1' }, { item: 'K1' }], { driverItems: ['K1'] })
            .placed).toEqual(['K1']);
    });

    it('the mark rides a spread (the grid copies regions), and never JSON, structuredClone or Object.keys', () => {
        const region = markRegionIntroduction({ region_id: 'r' }, { placed: ['K1'] });
        expect(regionIntroductionOf({ ...region })).toEqual({ placed: ['K1'] });
        expect(JSON.stringify(region)).toBe('{"region_id":"r"}');
        expect(regionIntroductionOf(structuredClone(region))).toBe(null);
        expect(Object.keys(region)).toEqual(['region_id']);
        expect(region[REGION_INTRODUCTION]).toEqual({ placed: ['K1'] });
        /** a re-realised region that is no longer configured drops its old note */
        expect(regionIntroductionOf(markRegionIntroduction(region, null))).toBe(null);
    });

    it('introductionReport folds; null (→ the field ABSENT) when nothing was configured', () => {
        expect(introductionReport([null, null])).toBe(null);
        expect(introductionReport([])).toBe(null);
        expect(introductionReport([{ placed: ['K1'] }, null, { placed: [], reason: 'no-host' },
            { placed: [], reason: 'no-host' }, { placed: [], reason: 'not-drawn' }]))
            .toEqual({ requested: 4, placed: 1, notPlaced: { 'no-host': 2, 'not-drawn': 1 } });
    });

    /** The pure pre-pass: one declaring substrate, a hand-built tree. Each NONE reason is produced. */
    describe('the sphere planner decides each NONE reason', () => {
        const entryOf = (id) => (id === 'S' ? entry : undefined);
        const plan = () => ({ spheres: [{ sphere: 1, items: ['a'] }, { sphere: 2, items: ['b'] }, { sphere: 3, items: ['V'] }] });
        const node = (index, wave, items, extra = {}) => ({ index, wave, substrate: 'S', items: items.map((item, i) =>
            ({ id: `loc_${i}`, item })), ...extra });
        const run = (nodes, p = plan()) => scheduleSphereIntroductions(p, nodes, { regionParams: { on: true }, entryOf });

        it('last-wave-of-plan, and a placed one', () => {
            const nodes = run([node(0, 0, ['a']), node(1, 1, ['b']), node(2, 2, ['V'])]);
            expect(nodes.map((n) => n.introductionNone ?? n.introduces[0]?.item))
                .toEqual(['K1', 'K2', INTRODUCTION_NOT_PLACED_REASONS.lastWaveOfPlan]);
        });
        it('no-host: wave w+1 exists and holds no dealt item', () => {
            const nodes = run([node(0, 0, ['a']), node(1, 1, []), node(2, 2, ['V'])]);
            expect(nodes[0].introductionNone).toBe(INTRODUCTION_NOT_PLACED_REASONS.noHost);
        });
        it('batch-boundary: no node of wave w+1 is wired yet', () => {
            const nodes = run([node(0, 0, ['a'])]);
            expect(nodes[0].introductionNone).toBe(INTRODUCTION_NOT_PLACED_REASONS.batchBoundary);
        });
        it('filler-region: a filler is decided NONE outright (asked for none), never compacted with a reason', () => {
            const nodes = run([node(0, 0, ['a']), node(1, 0, [], { isFiller: true }), node(2, 1, ['b']), node(3, 2, ['V'])]);
            expect(nodes[1].introduces).toEqual([]);
            expect(nodes[1].introductionNone).toBe(INTRODUCTION_NOT_PLACED_REASONS.filler);
        });
    });
});

// --- 4. per player, and absent ---------------------------------------------------------------------------

describe('4 — the report is the SLOT\'s, and ABSENT where nothing was configured', () => {
    const keygateGrid = (seed) => {
        const { run } = buildRunFromState({ mode: 'gridGrowth',
            params: { seed, gridWidth: 3, gridHeight: 3, seedlingGenElements: 'keygate' },
            scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
            substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 2 }, substrateMode: 'mix' });
        return { run, grown: growMaze(run.grow) };
    };
    /** ⚠ MEASURED, not this slice's: `buildRulesJson` with a playerId other than '1' AND a completion condition
     *  throws (`scaffold.game_info[playerId]` is never created), so the slot-2 compile names none. */
    const compile = ({ run, grown }, playerId) => buildRulesJson(grown.grid, {
        startCell: grown.startCell, ...run.compile, completionConditionItem: null, playerId,
        procgenMetadata: { driver: 'grid-growth' },
    });

    it('a 2-player document: each slot carries ITS OWN report under procgen_metadata["<p>"], none at the top', () => {
        const p1 = compile(keygateGrid(1), '1');
        const p2 = compile(keygateGrid(2), '2');
        const doc = { procgen_metadata: { ...p1.procgen_metadata, ...p2.procgen_metadata } };
        expect(Object.keys(doc.procgen_metadata)).toEqual(['1', '2']);
        const r1 = doc.procgen_metadata['1'].introductions;
        const r2 = doc.procgen_metadata['2'].introductions;
        expect(r1).toBeTruthy();
        expect(r2).toBeTruthy();
        /** each slot's numbers are its own world's: requested = its generated rooms, placed = its key-gate rooms */
        for (const [p, rules] of [['1', p1], ['2', p2]]) {
            const gens = Object.values(rules.preset_sidecars[p]).filter((sc) => sc.substrate === GEN);
            const keyed = gens.filter((sc) => sc.playable_payload.locations.some((l) => l.kind === 'boss-key'));
            const r = rules.procgen_metadata[p].introductions;
            expect(r.requested, `slot ${p}`).toBe(gens.length);
            expect(r.placed, `slot ${p}`).toBe(keyed.length);
            expect(Object.values(r.notPlaced).reduce((a, b) => a + b, 0)).toBe(r.requested - r.placed);
        }
        expect(r1).not.toEqual(r2);
        expect(p1).not.toHaveProperty('introductions');
        expect(p1.procgen_metadata).not.toHaveProperty('introductions');
    });

    it('ABSENT, not empty: a world with no declaring substrate, and one whose declaring substrate is configured for none', async () => {
        const { rulesJson: plain } = await runShipped('shipped:grid-growth-demo');
        expect(plain.procgen_metadata['1']).not.toHaveProperty('introductions');
        const { rulesJson: gen } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_GENERATED_ROOM_STATE)));
        expect(Object.values(gen.preset_sidecars['1']).some((sc) => sc.substrate === GEN)).toBe(true);
        expect(gen.procgen_metadata['1']).not.toHaveProperty('introductions');
    }, 120_000);
});
