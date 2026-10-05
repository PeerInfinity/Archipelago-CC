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
    // ⛓ RULES logical-links — restamped (bbddca3d -> aeb590c4): the physics model SEALED the five True_
    // hand rows (L0, L12, L66, L93 x2), and three pockets they alone reached were pruned (L66 r1c2, L93
    // r1c0/r1c13): 189 -> 186 sub-regions, 295 -> 289 internal exits. L93's r1c0 <-> r1c13 Has(Swim) row
    // joined two of those pockets, so swim 217 -> 216, plain Has(Swim) 179 -> 178, and L93 is no swim level.
    // ⛓ RULES burnable-trees — restamped (aeb590c4 -> 0cdaf2c2): the burnable tree claims its 2x2 hitbox, so
    // L12 (r42c29), L37 (r12c6), L40 (r48c54) and L44 (r6c4) split along their trees: 186 -> 190 sub-regions,
    // 289 -> 295 internal exits. Swim 216 -> 218: L12's r0c19 <-> r42c29 Has(Swim) is new (+2) and L12's
    // r0c19 -> r0c37 loses its Swim half (its water way now runs past the tree); plain Has(Swim) 178 -> 179.
    // ⛓ RULES patched-set — restamped (0cdaf2c2 -> 78d22cb4): L110's pit CHAINS (its fall fires L0's
    // stairs mid-descent) and now exits to level_2 (3,2), not level_0. Boundary exits only; every count holds.
    it('52 regions carry a subgraph: 190 sub-regions, 295 internal exits, 218 of them need Progressive Swim', () => {
        expect(c.atlasId).toBe('seedling-78d22cb4');
        expect([c.regions, c.regionsWithSubgraph, c.subRegions, c.internalExits, c.swim]).toEqual([113, 52, 190, 295, 218]);
        expect(c.swimLevels).toHaveLength(22);
        expect(c.byRule.slice(0, 2)).toEqual([
            { rule: 'Has(Progressive Swim)', count: 179 },
            { rule: 'Has(Progressive Swim, 2)', count: 33 },
        ]);
    });

    // ⛓ RULES logical-links: 18 -> 17, L93 has no swim row left (above).
    it('the witnessed levels are derived from the tapes: 0, 37, 47, 87, 115 — the other 17 are BOT-UNCERTIFIED', () => {
        expect([...c.witnessedLevels].sort((a, b) => a - b)).toEqual([0, 37, 47, 87, 115]);
        expect(c.uncertifiedLevels).toHaveLength(17);
        expect(c.swimLevels.find((r) => r.level === 47).witnesses).toEqual(['r5-swim-cross.json', 'r5-swim-latch.json']);
        // ⛓ swim R3: `r3-drown` (L47, no conch, the drowning death) joins `r5-swim-drown`.
        expect(c.swimLevels.find((r) => r.level === 47).noSwimTapes).toEqual(['r3-drown.json', 'r5-swim-drown.json']);
    });

    it('ruleLabel spells nested rules in one line', () => {
        expect(ruleLabel({ rule: 'Has', args: { item_name: SWIM_ITEM, count: 2 } })).toBe('Has(Progressive Swim, 2)');
        expect(ruleLabel(null)).toBe('(none)');
    });
});
