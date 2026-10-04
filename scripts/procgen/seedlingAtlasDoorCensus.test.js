/**
 * ⛓ SEEDLING SWIM S2 D2 — the atlas door census, pinned to the COMMITTED
 * playthrough atlas and tape roster. A restamped atlas (the analyzer re-run, a
 * sub-region split) or a new water-armed swim tape moves these rows: re-measure
 * with `node scripts/procgen/census-seedling-atlas-doors.mjs` and re-pin by name.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { censusAtlasDoors, swimWitnesses, ruleLabel, SWIM_ITEM } from './seedlingAtlasDoorCensus.js';
import { ITEM_FOR_TAG } from '../../frontend/modules/seedlingDemo/seedlingAtlasDerivation.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(ROOT + rel, 'utf8'));
const ATLAS = readJson('frontend/modules/flashPanel/atlases/seedling-playthrough.json');
const TAPE_DIR = 'frontend/modules/seedlingDemo/fixtures/tapes/';
const TAPES = readdirSync(ROOT + TAPE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((file) => ({ file, tape: readJson(TAPE_DIR + file) }));
const SWIM_TAGS = Object.entries(ITEM_FOR_TAG).filter(([, item]) => item === SWIM_ITEM).map(([tag]) => tag);

describe('census-seedling-atlas-doors — the committed playthrough atlas', () => {
    const { witness, noSwim } = swimWitnesses(TAPES, SWIM_TAGS);
    const c = censusAtlasDoors(ATLAS, { witness, noSwim });

    it('the swim tags are read off ITEM_FOR_TAG, not typed', () => {
        expect(SWIM_TAGS.sort()).toEqual(['conch', 'feather']);
    });

    // ⛓ SWIM T4 D4 — the one-sided locks restamped the atlas (ae833c1e -> 0faa7fee): L12's two-way
    // `Or(Swim, Red Key)` row split into two one-way rows, so +1 internal exit and +1 swim row.
    // ⛓ RULES (A) — restamped again (0faa7fee -> e5d9f89e): +9 return rows through the OPENED
    // one-sided locks (286 -> 295). None of them is a swim row, so 217 holds — but L12's
    // r0c37 -> r0c19 is now Or(Swim, And(Red Key, reached r0c19)), so plain Has(Swim) is 180 -> 179.
    it('52 regions carry a subgraph: 189 sub-regions, 295 internal exits, 217 of them need Progressive Swim', () => {
        expect(c.atlasId).toBe('seedling-bbddca3d');
        expect([c.regions, c.regionsWithSubgraph, c.subRegions, c.internalExits, c.swim]).toEqual([113, 52, 189, 295, 217]);
        expect(c.swimLevels).toHaveLength(23);
        expect(c.byRule.slice(0, 2)).toEqual([
            { rule: 'Has(Progressive Swim)', count: 179 },
            { rule: 'Has(Progressive Swim, 2)', count: 33 },
        ]);
    });

    it('the witnessed levels are derived from the tapes: 0, 37, 47, 87, 115 — the other 18 are BOT-UNCERTIFIED', () => {
        expect([...c.witnessedLevels].sort((a, b) => a - b)).toEqual([0, 37, 47, 87, 115]);
        expect(c.uncertifiedLevels).toHaveLength(18);
        expect(c.swimLevels.find((r) => r.level === 47).witnesses).toEqual(['r5-swim-cross.json', 'r5-swim-latch.json']);
        // ⛓ swim R3: `r3-drown` (L47, no conch, the drowning death) joins `r5-swim-drown`.
        expect(c.swimLevels.find((r) => r.level === 47).noSwimTapes).toEqual(['r3-drown.json', 'r5-swim-drown.json']);
    });

    it('ruleLabel spells nested rules in one line', () => {
        expect(ruleLabel({ rule: 'Has', args: { item_name: SWIM_ITEM, count: 2 } })).toBe('Has(Progressive Swim, 2)');
        expect(ruleLabel(null)).toBe('(none)');
    });
});
