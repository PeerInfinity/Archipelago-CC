/**
 * procgenPipeline — P5d (⚖ Robert 2026-11-05: *"Only what was used"*, scope *"Both"*):
 * **A TOP-DOWN GRANT IS NARROWED TO WHAT THE BUILT ROOMS LEAN ON.**
 *
 * `grantedLibraryItems` stays the CANDIDATE list (what the realiser is handed free);
 * `grantsUsedBy` keeps a candidate only when a drift leaned on it (`collectUsedFreeItems`)
 * or a realised substrate's declared `startingInventory` need names it (unmet by the
 * source). `used` null (unknown: a hand-edited room) = every candidate. Each pin names
 * the mutant it kills. The drift itself is pinned on real bounce geometry in
 * `freeItemsUsed.slow.test.js`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { collectUsedFreeItems } from './procgenPipelineEngine.js';
import {
    GRANTED_ITEM_FIRST_ID, buildTopDownEnvelope, grantedLibraryItems, grantsUsedBy, runTopDownStep, runTopDownToStep,
} from './topDownSteps.js';
import { regenerationGrants } from '../apworldEditor/regionGenerationFlow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const ADVENTURE = JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', 'adventure', 'AP_14089154938208861744',
    'AP_14089154938208861744_rules.json'), 'utf8'));
/** ⛓ Derived, never typed: the realiser that declares a starting need, and one that declares none but has candidates. */
const NEEDER = substrateRegistry.getAll().find((e) => e.startingInventory?.needs?.length)?.id;
const NAMED = new Set(substrateRegistry.get(NEEDER).startingInventory.needs.flatMap((n) => n.anyOf));
const PLAIN = substrateRegistry.getAll().find((e) => !e.startingInventory
    && grantedLibraryItems(ADVENTURE, '1', [e.id]).grantedItems.length > 0)?.id;

describe('grantsUsedBy — the candidates narrowed to what leans on them', () => {
    it('⛓ premises: a need-declaring realiser and a plain one with candidates', () => {
        expect(NEEDER).toBeTruthy();
        expect(PLAIN).toBeTruthy();
    });

    it('⛓ used null (unknown) = the full candidate grant, the very same answer', () => {
        const g = grantedLibraryItems(ADVENTURE, '1', [NEEDER]);
        // mutant: treat null as [] → a hand-edited run loses its grants
        expect(grantsUsedBy(g, null, { substrateIds: [NEEDER] })).toBe(g);
    });

    it('⛓⛓ nothing used, a plain target → no grant at all (cloudberry, jta, … granted 1–47 before)', () => {
        const g = grantedLibraryItems(ADVENTURE, '1', [PLAIN]);
        const n = grantsUsedBy(g, [], { substrateIds: [PLAIN] });
        // mutant: return `grant` unchanged → every candidate granted
        expect(n.grantedItems).toEqual([]);
        expect(n.startingItems).toEqual(g.sourceStarting);
        expect(n.defs).toEqual({});
    });

    it('⛓⛓ a declared need keeps the candidates it names; a drift keeps its item; candidate order kept', () => {
        const g = grantedLibraryItems(ADVENTURE, '1', [NEEDER]);
        const needOnly = grantsUsedBy(g, [], { substrateIds: [NEEDER] });
        // mutant: drop the declared-need branch → [] (a bounce slot that cannot move)
        expect(needOnly.grantedItems).toEqual(g.grantedItems.filter((n) => NAMED.has(n)));
        expect(needOnly.grantedItems.length).toBeGreaterThan(0);
        const extra = g.grantedItems.find((n) => !NAMED.has(n));
        const withDrift = grantsUsedBy(g, [extra], { substrateIds: [NEEDER] });
        expect(withDrift.grantedItems).toEqual(g.grantedItems.filter((n) => NAMED.has(n) || n === extra));
        // defs follow the narrowed names, by the pipeline's id rule
        withDrift.grantedItems.forEach((n, i) => expect(withDrift.defs[n].id).toBe(GRANTED_ITEM_FIRST_ID - i));
        // the need is only for a substrate PRESENT: no substrateIds → nothing named
        expect(grantsUsedBy(g, [], {}).grantedItems).toEqual([]);
    });

    it('⛓ a need the source already meets adds nothing (only an UNMET need leans on a candidate)', () => {
        const held = [...NAMED][0];
        const src = { ...ADVENTURE, starting_items: { 1: [held] } };
        const g = grantedLibraryItems(src, '1', [NEEDER]);
        expect(g.sourceStarting).toEqual([held]);
        // mutant: ignore `met` → the other named candidates are granted too
        expect(grantsUsedBy(g, [], { substrateIds: [NEEDER] }).grantedItems).toEqual([]);
        expect(grantsUsedBy(g, [], { substrateIds: [NEEDER] }).startingItems).toEqual([held]);
    });

    it('⛓ the editor\'s Generate: after the run, only what was used; before it (the form), the candidates', () => {
        const before = regenerationGrants(ADVENTURE, '1', PLAIN);
        expect(before?.starting.length).toBeGreaterThan(0);
        // mutant: `used` ignored → the landed op grants every candidate
        expect(regenerationGrants(ADVENTURE, '1', PLAIN, { used: [] })).toBeNull();
        const after = regenerationGrants(ADVENTURE, '1', NEEDER, { used: [] });
        expect(after.starting).toEqual(grantedLibraryItems(ADVENTURE, '1', [NEEDER]).grantedItems.filter((n) => NAMED.has(n)));
    });
});

describe('collectUsedFreeItems', () => {
    it('⛓ nothing drifted → []; it nests, and an inner call reports to the outer', () => {
        expect(collectUsedFreeItems(() => 7)).toEqual({ value: 7, used: [] });
        const outer = collectUsedFreeItems(() => collectUsedFreeItems(() => 1).used);
        expect(outer.used).toEqual([]);
    });
});

describe('the pipeline compiles the narrowed grant (the ONE rule, R9)', () => {
    const envFor = (id) => buildTopDownEnvelope({ source: ADVENTURE, seed: 1, gridDims: { width: 4, height: 4 },
        regionSizeBase: { width: 8, height: 6 }, substrateMix: { [id]: 1 } });
    /** ⛓ Derived: the first plain target (no declared need, some candidates) the headless pipeline realises. */
    let SYNC = null;
    beforeAll(async () => {
        for (const e of substrateRegistry.getAll()) {
            if (e.startingInventory || !grantedLibraryItems(ADVENTURE, '1', [e.id]).grantedItems.length) continue;
            try {
                // eslint-disable-next-line no-await-in-loop
                await runTopDownToStep(envFor(e.id), 'compile');
                SYNC = e.id;
                break;
            } catch { /* needs a generator or refuses this source: the next */ }
        }
    }, 120000);
    const env = () => envFor(SYNC);

    it('⛓ premise: a plain target realises headless', () => expect(SYNC).toBeTruthy());

    it('⛓⛓ a plain target realised with no drift compiles NO granted starting item', async () => {
        const e = env();
        expect(e.compileIn.grantedItems.length).toBeGreaterThan(0);
        const done = await runTopDownToStep(e, 'compile');
        expect(done.layout.stats.freeItemsUsed).toEqual([]);
        // mutant: stepCompile reads compileIn unchanged → every candidate starts held
        expect(done.compile.rulesJson.starting_items?.['1'] ?? []).toEqual(ADVENTURE.starting_items?.['1'] ?? []);
        for (const n of e.compileIn.grantedItems) {
            expect(Object.hasOwn(done.compile.rulesJson.items['1'], n), n).toBe(false);
        }
    });

    it('⛓ a hand-edited room (freeItemsUsed null) compiles the full candidate grant, as before P5d', async () => {
        const e = env();
        await runTopDownToStep(e, 'finalize');
        e.layout.stats.freeItemsUsed = null;   // what the panel's room-editor write-back does
        const done = await runTopDownStep('compile', e);
        expect(done.compile.rulesJson.starting_items['1']).toEqual([...(ADVENTURE.starting_items?.['1'] ?? []),
            ...e.compileIn.grantedItems]);
    });
});
