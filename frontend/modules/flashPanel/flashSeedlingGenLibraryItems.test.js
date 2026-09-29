/**
 * flashPanel — **THE GENERATED SEEDLING ENTRY DECLARES ITS GATE ITEMS AS A
 * LIBRARY, DERIVED FROM THE LABEL TABLE** (swim T1's merge, 2026-09-29).
 *
 * `presetDefs.generate.slow.test.js` refuses a shipped preset whose scenario
 * names an item no item library of its substrates declares — and
 * `seedling_generated_swim` names `Progressive Swim`, the first shipped world
 * gated on the GAME's own item. CI at `17c1c999f5` read that row red (slow
 * battery 242/1). The cure is the generated plan's option B, third leg: the
 * item in `libraryItems`, ONE per distinct AP name in `ITEM_LABELS`, never
 * typed twice.
 *
 * ⛓ The table lives in a LEAF (`seedlingDemo/itemLabels.js`) so the light
 * entry can import it without the requirements module's closure (the oracle
 * and the solver); `procgenRequirements.js` re-exports the same bindings.
 *
 * MUTANTS this file catches, predicted: (a) `libraryItems` dropped from the
 * entry ⇒ rows 1 and 3 red; (b) a typed name diverging from the table ⇒ row 2
 * red; (c) the re-export removed ⇒ row 4 red by identity.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { substrateRegistryEntry, FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import {
    ITEM_LABELS, SEEDLING_GATE_ITEM_NAMES, SEEDLING_LIBRARY_ITEMS, itemLabelOf,
} from '../seedlingDemo/itemLabels.js';
import * as REQUIREMENTS from '../seedlingDemo/procgenRequirements.js';
import { mergedItemLib } from '../procgenPipeline/presetRun.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { SHIPPED_PRESETS } from '../procgenPipeline/presetDefs.js';

describe('the generated Seedling entry declares its gate items as a library', () => {
    it('1. `libraryItems` is the leaf\'s derived library, one row per distinct AP name in ITEM_LABELS', () => {
        expect(substrateRegistryEntry.libraryItems).toBe(SEEDLING_LIBRARY_ITEMS);
        const distinct = [...new Set(Object.keys(ITEM_LABELS).map((f) => itemLabelOf(f).item))];
        expect(Object.keys(SEEDLING_LIBRARY_ITEMS)).toEqual(distinct);
        expect(SEEDLING_GATE_ITEM_NAMES).toEqual(distinct);
        for (const [name, row] of Object.entries(SEEDLING_LIBRARY_ITEMS)) {
            expect(row.id).toBe(name);
            expect(row.name).toBe(name);
            expect(row.classification).toBe('progression');
        }
    });

    it('2. the feather adds no fourth item: it is Progressive Swim ×2, the same name', () => {
        expect(itemLabelOf('hasFeather')).toEqual({ item: 'Progressive Swim', count: 2 });
        expect(Object.keys(SEEDLING_LIBRARY_ITEMS)).toHaveLength(3);
        expect(SEEDLING_LIBRARY_ITEMS['Progressive Swim']).toBeDefined();
    });

    it('3. every shipped preset that selects the generated substrate names only declared scenario items', () => {
        if (!substrateRegistry.has(FLASH_SEEDLING_GEN_SUBSTRATE_ID)) {
            substrateRegistry.register(substrateRegistryEntry);
        }
        const selecting = SHIPPED_PRESETS.filter((p) => JSON.stringify(p.state).includes(FLASH_SEEDLING_GEN_SUBSTRATE_ID));
        expect(selecting.map((p) => p.id)).toContain('shipped:seedling-generated-swim-demo');
        for (const preset of selecting) {
            // The slow tier's own merge: the pipeline's base library plus every selected substrate's `libraryItems`.
            const lib = mergedItemLib(preset.state);
            const unknown = Object.keys(preset.state.scenario?.items ?? {}).filter((id) => !(id in lib));
            expect(unknown, `${preset.id} names scenario item(s) no item library of its substrates declares`).toEqual([]);
        }
        // And the row CI read red at 17c1c999f5, by name: the swim world's item is the entry's own.
        const swim = SHIPPED_PRESETS.find((p) => p.id === 'shipped:seedling-generated-swim-demo');
        expect(Object.keys(swim.state.scenario.items)).toContain('Progressive Swim');
        expect('Progressive Swim' in mergedItemLib(swim.state)).toBe(true);
    });

    it('4. `procgenRequirements` re-exports the leaf\'s bindings by identity, and the leaf imports nothing', () => {
        expect(REQUIREMENTS.ITEM_LABELS).toBe(ITEM_LABELS);
        expect(REQUIREMENTS.itemLabelOf).toBe(itemLabelOf);
        const src = readFileSync(fileURLToPath(new URL('../seedlingDemo/itemLabels.js', import.meta.url)), 'utf8');
        expect(src).not.toMatch(/^\s*import\s/m);
    });
});
