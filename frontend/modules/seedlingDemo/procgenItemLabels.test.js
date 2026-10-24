/**
 * seedlingDemo — **`ITEM_LABELS` CARRIES A COUNT** (seedling swim T2, D2).
 *
 * The feather is the SECOND `Progressive Swim`, so its requirement is
 * `Has('Progressive Swim', 2)`: the same AP name as the conch's, with a count.
 * A row of the table may therefore be a NAME (count 1, every row before T2)
 * or `{item, count}`, and every reader goes through `itemLabelOf`.
 *
 * ⛓ THE READERS, measured at T2's D2 (`grep -a ITEM_LABELS` over `frontend`
 * and `scripts`): `procgenRequirements` itself (the row's `item` and the two
 * label sentences — all through `itemLabel` now) and
 * `batch-seedling-acceptance.mjs`, which imports the table and reads only
 * `row.item`. ⛔ The gen room's exit gate does NOT read it: it clones the
 * input region's `access_rule`.
 *
 * ⛔ MUTANT (b) — the count dropped from `hasFeather` — makes the feather's
 * requirement read `Has('Progressive Swim')`, the conch's, and the rows below
 * red.
 */

import { describe, expect, it } from 'vitest';

import {
    ITEM_LABELS, itemLabel, itemLabelOf, requirementOf, requirementsFor,
} from './procgenRequirements.js';

describe('⛓⛓⛓ ITEM_LABELS: a name, or a name with a count (swim T2, D2)', () => {
    it('the feather is the conch\'s item with count 2', () => {
        expect(ITEM_LABELS.hasFeather).toEqual({ item: 'Progressive Swim', count: 2 });
        expect(itemLabelOf('hasFeather')).toEqual({ item: 'Progressive Swim', count: 2 });
    });

    it('a string row normalises to count 1, and an unknown flag to null', () => {
        expect(itemLabelOf('hasSword')).toEqual({ item: 'Progressive Sword', count: 1 });
        expect(itemLabelOf('canSwim')).toEqual({ item: 'Progressive Swim', count: 1 });
        expect(itemLabelOf('hasTorch')).toBe(null);
    });

    it('the requirement speaks the rule grammar, with the count only when it is not 1', () => {
        expect(requirementOf('hasFeather')).toBe("Has('Progressive Swim', 2)");
        expect(requirementOf('canSwim')).toBe("Has('Progressive Swim')");
        expect(requirementOf('hasSword')).toBe("Has('Progressive Sword')");
        expect(requirementOf('hasTorch')).toBe("Has('hasTorch')");
    });

    it('the report\'s words: every pre-T2 row reads as it did, the feather says ×2', () => {
        expect(itemLabel('hasSword')).toBe('Progressive Sword');
        expect(itemLabel('hasShield')).toBe('Progressive Shield');
        expect(itemLabel('canSwim')).toBe('Progressive Swim');
        expect(itemLabel('hasFeather')).toBe('Progressive Swim ×2');
        expect(itemLabel('hasTorch')).toBe('hasTorch');
    });

    it('the requirements report reads the counted row (its `item` and its label sentence)', () => {
        /** A candidate-free report still names nothing; drive the row builder
         *  with a boot whose only true flag is the feather and a with-arm
         *  that did not solve, so no solve is attempted on a real level. */
        const state = {
            palette: { items: { hasFeather: true } },
            model: { boot: () => ({ level: 900, x: 16, y: 16 }), goals: [] },
            summary: { pins: ['dead_frames'] },
            record: { level: 900 },
            seed: 1, biome: 'test',
        };
        const rep = requirementsFor(state, { verdict: 'REFUSED', ticks: null });
        const [row] = rep.rows;
        expect(row.flag).toBe('hasFeather');
        expect(row.item).toBe('Progressive Swim ×2');
        expect(row.label).toMatch(/Progressive Swim ×2/);
    });
});
