/**
 * ⛓ REGION HELD ITEMS (procgen-region-held-items, ⚖ user 2026-11-03: "report which key colors, or which items
 * in general, the player is expected to already have when they first reach the region that is currently being
 * generated"). The pipeline hands EVERY region generator one optional, substrate-agnostic field:
 *
 *   held = { items: { [item]: count }, source: 'sphere' | 'arrival-approx', exact, sphere? }
 *
 * - sphere growth: EXACT (`sphereHeldItems`, sphere-sweep semantics);
 * - grid growth + shuffled spiral: the `accumulatedInventory` approximation with counts, `exact: false`;
 * - top-down: ABSENT (unknown) — never faked.
 *
 * Rows: the computation per growth mode (with an off-by-one-wave mutant that must red), and DELIVERY — a spy on
 * every generator hook of every registered substrate records what each region build was handed, per mode. No
 * substrate acts on `held` in this slice, so delivery is all there is to see.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    sphereHeldItems, heldFromArrivalInventory, accumulatedInventory, growSpheres,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { SHIPPED_PRESETS } from './presetDefs.js';
import { buildRunFromState, runPresetHeadless } from './presetRun.js';
import { resolveLibrarySelection } from './regionLibraryLoader.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend');

beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
});

// --- the computation -------------------------------------------------------------------------------------

/** A 3-sphere plan; `b` has an instance in sphere 1 AND sphere 2 (a count gate's case). */
const PLAN = {
    spheres: [
        { sphere: 1, items: ['a', 'b'] },
        { sphere: 2, items: ['c', 'b'] },
        { sphere: 3, items: ['d', 'Victory'] },
    ],
};
/** Wave-w regions host sphere-(w+1) items and gate on a sphere-w item (the grower's stratification rule). */
const NODES = [
    { index: 0, wave: 0, gate: [], gateCounts: {}, parent: null },                  // start
    { index: 1, wave: 1, gate: ['a'], gateCounts: {}, parent: 0 },                  // wave 1
    { index: 2, wave: 2, gate: ['c'], gateCounts: {}, parent: 1 },                  // wave 2
    { index: 3, wave: 0, gate: ['a'], gateCounts: {}, parent: 0, isFiller: true },  // wave-0 filler (sphere-1 gate)
    { index: 4, wave: 2, gate: ['b'], gateCounts: { b: 2 }, parent: 0 },            // count gate: b ×2 → sphere 2
    { index: 5, wave: 0, gate: [], gateCounts: {}, parent: 2 },                     // ungated child of a wave-2 host
];
const SPHERES_1_2 = { a: 1, b: 2, c: 1 };

/** The row's assertion, as a function a mutant can be run through. */
function assertWave2Row(held) {
    expect(held).toEqual({ items: SPHERES_1_2, source: 'sphere', exact: true, sphere: 2 });
}

describe('sphere growth: held is EXACT', () => {
    it('a wave-2 region of a 3-sphere plan holds every item of spheres 1 and 2, in counts', () => {
        assertWave2Row(sphereHeldItems(PLAN, NODES[2], NODES));
    });

    it('MUTANT: an off-by-one wave reds the row (spheres 1 only, or 1..3)', () => {
        // The plausible slips: cumCounts[wave] instead of cumCounts[wave - 1], or the reverse.
        const through = (k) => ({
            items: Object.fromEntries(PLAN.spheres.slice(0, k).flatMap((s) => s.items)
                .reduce((m, it) => m.set(it, (m.get(it) ?? 0) + 1), new Map())),
            source: 'sphere', exact: true, sphere: 2,
        });
        expect(() => assertWave2Row(through(1))).toThrow();
        expect(() => assertWave2Row(through(3))).toThrow();
        expect(() => assertWave2Row(through(2))).not.toThrow(); // the control: the row's own answer
    });

    it('the start holds exactly nothing; a wave-1 region holds sphere 1', () => {
        expect(sphereHeldItems(PLAN, NODES[0], NODES)).toEqual({ items: {}, source: 'sphere', exact: true, sphere: 0 });
        expect(sphereHeldItems(PLAN, NODES[1], NODES).items).toEqual({ a: 1, b: 1 });
    });

    it('sphere-sweep, not wave: a wave-0 FILLER gated on a sphere-1 item holds sphere 1', () => {
        expect(sphereHeldItems(PLAN, NODES[3], NODES).sphere).toBe(1);
    });

    it('a count gate (b ×2) is first met by sphere 2; an ungated child inherits its host\'s sphere', () => {
        expect(sphereHeldItems(PLAN, NODES[4], NODES).sphere).toBe(2);
        expect(sphereHeldItems(PLAN, NODES[5], NODES).sphere).toBe(2);
    });

    it('UNKNOWN is null, never a guess: no plan, or a gate the plan never supplies', () => {
        expect(sphereHeldItems(null, NODES[2], NODES)).toBeNull();
        expect(sphereHeldItems(PLAN, { index: 9, wave: 1, gate: ['zzz'], parent: 0 }, NODES)).toBeNull();
        expect(sphereHeldItems(PLAN, { index: 9, wave: 2, gate: ['b'], gateCounts: { b: 3 }, parent: 0 }, NODES))
            .toBeNull();
    });

    it('the result is frozen (a reader cannot edit a shared count)', () => {
        const held = sphereHeldItems(PLAN, NODES[2], NODES);
        expect(Object.isFrozen(held)).toBe(true);
        expect(Object.isFrozen(held.items)).toBe(true);
    });
});

describe('grid growth / spiral: held is the arrival approximation', () => {
    const grid = {
        allRegions: () => [
            { placed_items: [{ item_id: 'key_red' }, { item_id: 'key_red' }] },
            { placed_items: [{ item_id: 'key_blue' }] },
            {},
        ],
    };
    it('keys are exactly accumulatedInventory(grid), with instance counts, exact:false', () => {
        const held = heldFromArrivalInventory(grid);
        expect(held).toEqual({ items: { key_red: 2, key_blue: 1 }, source: 'arrival-approx', exact: false });
        expect(new Set(Object.keys(held.items))).toEqual(accumulatedInventory(grid));
    });
});

// --- delivery ----------------------------------------------------------------------------------------------

/** Each generator hook, and which argument carries the region input / context. */
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

/**
 * Wrap every generator hook of every registered substrate; returns the call log. Some registry entries are
 * frozen, so the spy is a child object (prototype = the entry) swapped into the registry for the test.
 */
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
                        substrate: entry.id, hook,
                        has: !!arg && Object.prototype.hasOwnProperty.call(arg, 'held'),
                        held: arg?.held,
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
async function runShipped(id, mutate = (s) => s) {
    const preset = SHIPPED_PRESETS.find((p) => p.id === id);
    const state = mutate(structuredClone(preset.state));
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

describe('every region generator is handed `held`', () => {
    it('sphere growth — procedural (maze generateRegionCore) and zone (bounce generateZoneForSpecs[Gen]): exact', async () => {
        const calls = spyEveryHook();
        const { rulesJson } = await runShipped('shipped:maze-bounce-sphere-mix');
        expect(hooksSeen(calls)).toEqual(expect.arrayContaining(['maze.generateRegionCore']));
        expect(hooksSeen(calls).some((h) => h.startsWith('bounce.generateZoneForSpecs'))).toBe(true);
        for (const c of calls) {
            expect(c.has, `${c.substrate}.${c.hook}`).toBe(true);
            expect(c.held.source).toBe('sphere');
            expect(c.held.exact).toBe(true);
        }
        // Real waves reach the generators: some region is built holding spheres 1..2 at least.
        expect(Math.max(...calls.map((c) => c.held.sphere))).toBeGreaterThanOrEqual(2);
        // ⛔ never in the output
        expect(JSON.stringify(rulesJson)).not.toMatch(/"held"|arrival-approx/);
    });

    // The atlas and library sphere branches, through the MONOLITHIC driver (growSpheres) — the configs
    // sphereAtlas.slow / the served maze pack use.
    const growMazeSpheres = (quotas, substrateConfig) => growSpheres({
        regionSize: { width: 8, height: 6 },
        seed: 1,
        growthParams: {
            spherePlan: planSpheres({
                itemPool: { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 },
                sphereCount: 3, victoryItem: 'victory', seed: 1,
            }),
            substrateQuotas: quotas, startSubstrate: 'maze', maxItemsPerRegion: 2, fillerCount: 2,
            substrateConfig,
        },
    });

    it('sphere growth — the ATLAS branch (maze instantiateAtlasEntryForSpecs) gets it too', () => {
        const calls = spyEveryHook();
        const pool = JSON.parse(readFileSync(join(FRONTEND, 'atlas-pools/seedling-atlas-pool.json'), 'utf8'));
        growMazeSpheres({ maze: 4, 'atlas:seedling': 3 }, { seedling: { atlasDoc: pool } });
        expect(calls.filter((c) => c.hook === 'instantiateAtlasEntryForSpecs').length).toBeGreaterThan(0);
        for (const c of calls) {
            expect(c.has, `${c.substrate}.${c.hook}`).toBe(true);
            expect(c.held).toMatchObject({ source: 'sphere', exact: true });
        }
    });

    it('sphere growth — the LIBRARY branch (maze instantiateLibraryEntryForSpecs) gets it too', () => {
        const calls = spyEveryHook();
        const doc = JSON.parse(readFileSync(join(FRONTEND, 'region-libraries/demo-maze-pack.json'), 'utf8'));
        const id = `library:${doc.library_id}`;
        growMazeSpheres({ maze: 4, [id]: 3 }, { [id]: { libraryDoc: doc } });
        expect(calls.filter((c) => c.hook === 'instantiateLibraryEntryForSpecs').length).toBeGreaterThan(0);
        for (const c of calls) {
            expect(c.has, `${c.substrate}.${c.hook}`).toBe(true);
            expect(c.held).toMatchObject({ source: 'sphere', exact: true });
        }
    });

    it('grid growth — the approximation, exact:false; the start region holds nothing', async () => {
        const calls = spyEveryHook();
        await runShipped('shipped:grid-growth-demo');
        expect(calls.length).toBeGreaterThan(1);
        for (const c of calls) {
            expect(c.has, `${c.substrate}.${c.hook}`).toBe(true);
            expect(c.held).toMatchObject({ source: 'arrival-approx', exact: false });
        }
        expect(calls[0].held.items).toEqual({});
        expect(calls.some((c) => Object.keys(c.held.items).length > 0)).toBe(true);
    });

    it('shuffled spiral — procedural cells AND content cells (zone extractZoneRules, library instantiate)', async () => {
        const calls = spyEveryHook();
        await runShipped('shipped:content-spiral-mix');
        await runShipped('shipped:library-spiral-demo');
        const seen = hooksSeen(calls);
        expect(seen).toEqual(expect.arrayContaining(['maze.generateRegionCore']));
        expect(seen.some((h) => h.endsWith('.extractZoneRules'))).toBe(true);
        expect(seen.some((h) => h.endsWith('.instantiateLibraryEntry'))).toBe(true);
        for (const c of calls) {
            expect(c.has, `${c.substrate}.${c.hook}`).toBe(true);
            expect(c.held).toMatchObject({ source: 'arrival-approx', exact: false });
        }
    });

    it('top-down — ABSENT (its waves are attributed after the regions are built)', async () => {
        const calls = spyEveryHook();
        await runShipped('shipped:topdown-zones-demo');
        expect(calls.length).toBeGreaterThan(0);
        for (const c of calls) expect(c.has, `${c.substrate}.${c.hook}`).toBe(false);
    });
});
