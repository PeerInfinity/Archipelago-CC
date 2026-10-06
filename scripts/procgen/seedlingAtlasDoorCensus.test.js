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
    // ⛓ RULES re-closing locks — restamped (78d22cb4 -> b3ac708a): a grouped lock only a plain Button opens is
    // entered only from a side that can work the button this visit, so L15/L16/L28/L39/L41/L71 split at theirs:
    // 52 -> 54 regions with a subgraph, 190 -> 198 sub-regions, 295 -> 304 internal exits. L15's arrival column
    // reaches its button only by swimming: plain Has(Swim) 179 -> 181, swim 218 -> 220.
    // ⛓ RULES footprints — restamped (b3ac708a -> 5af7f784): every footprint is the model's hitbox. TreeLarge's
    // (L94) became its mask's 10x12 bounding box, the model seals the way past it, and the five water pockets behind
    // it (no members) are pruned with their 20 swim rows; L43's BossTotem splits r13c7 off (+1 sub-region, +1 row):
    // 198 -> 195 sub-regions, 304 -> 286 internal exits, swim 220 -> 200 (Has(Swim) 181 -> 166, Has(Swim, 2)
    // 33 -> 28), and L94 is no swim level.
    // ⛓ RULES obstacle-events — restamped (5af7f784 -> ae491163): L0's door to L1 is charged the rock its model
    // pocket opens through (one boundary exit rule); every count holds.
    // ⛓ RULES kill-locks — restamped (ae491163 -> 5c55890f): a decided kill-lock's rule is its room's bodies'
    // (L18/L26/L53/L60 widen to Wand | Dark Shield; L98's stairs under the lock are charged); every count holds.
    it('54 regions carry a subgraph: 195 sub-regions, 286 internal exits, 200 of them need Progressive Swim', () => {
        // ⛓ RULES game-truth-gaps — restamped (5c55890f -> db0a4f7f): L57 is lifted from never-enter (⚖ 2026-10-06),
        //   so 113 -> 114 regions (L57 is all water, no subgraph); every other count holds. The landing gates are rules-only.
        expect(c.atlasId).toBe('seedling-db0a4f7f');
        expect([c.regions, c.regionsWithSubgraph, c.subRegions, c.internalExits, c.swim]).toEqual([114, 54, 195, 286, 200]);
        expect(c.swimLevels).toHaveLength(21);
        expect(c.byRule.slice(0, 2)).toEqual([
            { rule: 'Has(Progressive Swim)', count: 166 },
            { rule: 'Has(Progressive Swim, 2)', count: 28 },
        ]);
    });

    // ⛓ RULES logical-links: 18 -> 17, L93 has no swim row left (above). ⛓ RULES footprints: 17 -> 16, L94 neither.
    it('the witnessed levels are derived from the tapes: 0, 37, 47, 87, 115 — the other 16 are BOT-UNCERTIFIED', () => {
        expect([...c.witnessedLevels].sort((a, b) => a - b)).toEqual([0, 37, 47, 87, 115]);
        expect(c.uncertifiedLevels).toHaveLength(16);
        expect(c.swimLevels.find((r) => r.level === 47).witnesses).toEqual(['r5-swim-cross.json', 'r5-swim-latch.json']);
        // ⛓ swim R3: `r3-drown` (L47, no conch, the drowning death) joins `r5-swim-drown`.
        expect(c.swimLevels.find((r) => r.level === 47).noSwimTapes).toEqual(['r3-drown.json', 'r5-swim-drown.json']);
    });

    it('ruleLabel spells nested rules in one line', () => {
        expect(ruleLabel({ rule: 'Has', args: { item_name: SWIM_ITEM, count: 2 } })).toBe('Has(Progressive Swim, 2)');
        expect(ruleLabel(null)).toBe('(none)');
    });
});
