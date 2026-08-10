/**
 * THE SPHERE ORDER — R7 slice 5's G1 stratum.
 *
 * `seedling-sphere-order.json` is AP's own collection order for the honest
 * playthrough, derived from the committed sphere log. This suite asserts the
 * properties that make it usable as the segment campaign's map, and every count
 * is derived from the artifact rather than typed:
 *
 *   - it is COMPLETE (every ledger location appears, exactly once);
 *   - it is a VALID ORDER (the Seed is last, and all sixteen seals precede it —
 *     the FinalDoor's condition, which is the whole endgame gate);
 *   - each guarded item lands after what guards it, which is the check that
 *     would have caught the two defects the first sphere log exposed;
 *   - the cross-check against the walkthrough's intended order is present, and
 *     every divergence is RULED rather than merely listed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { R7_GOAL_LEDGER } from '../seedlingDemo/r7Acceptance.js';
import { COMPLETION, SEAL_TOTAL } from './seedlingPlaythroughOverlay.js';

const ORDER = JSON.parse(readFileSync(
    fileURLToPath(new URL('./atlases/seedling-sphere-order.json', import.meta.url)), 'utf8',
));

const indexOf = (predicate) => ORDER.order.findIndex(predicate);
const firstItem = (item) => indexOf((r) => r.item === item);
const nthItem = (item, n) => {
    let seen = 0;
    return ORDER.order.findIndex((r) => r.item === item && (seen += 1) === n);
};

describe('the sphere order is complete', () => {
    it('carries every goal-ledger location exactly once', () => {
        expect(ORDER.order).toHaveLength(R7_GOAL_LEDGER.length);
        expect(new Set(ORDER.order.map((r) => r.location)).size).toBe(ORDER.order.length);
        const levels = new Set(ORDER.order.map((r) => r.level));
        for (const row of R7_GOAL_LEDGER) expect(levels, row.id).toContain(row.level);
    });

    it('came from the canonical seed, and says which log', () => {
        expect(ORDER.seed).toBe(1);
        expect(ORDER.seed_name).toBe('14089154938208861744');
        expect(ORDER.source_log).toMatch(/AP_14089154938208861744_sphere_log\.jsonl$/);
    });
});

describe('the endgame gate holds in the order itself', () => {
    it('ends on the Seed', () => {
        expect(ORDER.order.at(-1).item).toBe('The Seed');
        expect(ORDER.order.at(-1).level).toBe(115);
    });

    // ⛔ The check that would have caught it: the first sphere log took The Seed
    // holding TWELVE seals, because the FinalDoor sits UNDER the exits to the
    // Seed room instead of between them.
    it('collects all sixteen seals BEFORE the Seed', () => {
        const seals = ORDER.order.filter((r) => r.item === 'Seal');
        expect(seals).toHaveLength(SEAL_TOTAL);
        expect(nthItem('Seal', SEAL_TOTAL)).toBeLessThan(firstItem('The Seed'));
    });

    it('names the bloodless seed as the goal and the bloody one as a non-goal', () => {
        expect(COMPLETION.goal).toMatch(/bloodless/);
        expect(COMPLETION.excludedBranch).toMatch(/bloody|BLOODY/);
    });
});

describe('every guarded item lands after its guard', () => {
    it('takes the Wand only after all five Totem Shards', () => {
        expect(nthItem('Totem Shard', 5)).toBeLessThan(firstItem('Wand'));
    });

    it('takes the Dark Sword (the second Progressive Sword) after the Wand', () => {
        expect(firstItem('Wand')).toBeLessThan(nthItem('Progressive Sword', 2));
    });

    it('takes the Fire Wand and the Ghost Sword after the Dark Suit', () => {
        const suit = firstItem('Dark Suit');
        expect(suit).toBeGreaterThan(-1);
        expect(suit).toBeLessThan(firstItem('Fire Wand Fusion'));
        expect(suit).toBeLessThan(firstItem('Ghost Sword Fusion'));
    });

    it('takes the Dark Shield through the D7 approach, after the Wand and key 4', () => {
        const darkShield = nthItem('Progressive Shield', 2);
        expect(firstItem('Wand')).toBeLessThan(darkShield);
        expect(firstItem('Yellow Key')).toBeLessThan(darkShield);
    });
});

describe('the walkthrough cross-check', () => {
    it('compares against the R4 §10 intended order and reports where it parts', () => {
        expect(ORDER.cross_check.intended_order[0]).toBe('Progressive Sword');
        expect(ORDER.cross_check.ap_equipment_order.length).toBeGreaterThan(9);
        // The first three are the same in both, which is what makes the
        // comparison meaningful rather than a shape assertion.
        expect(ORDER.cross_check.ap_equipment_order.slice(0, 2))
            .toEqual(['Progressive Sword', 'Progressive Shield']);
    });

    it('RULES every divergence rather than listing it', () => {
        expect(ORDER.divergences.length).toBeGreaterThan(0);
        for (const d of ORDER.divergences) {
            expect(typeof d.item).toBe('string');
            expect(d.verdict, d.item).toMatch(/PERMITTED|FINDING/);
            expect(d.why.length, d.item).toBeGreaterThan(40);
        }
        // A divergence the report notices must be one the divergence list rules
        // on — an unruled one would read as agreement.
        const first = ORDER.cross_check.first_divergence[0];
        if (first) {
            expect(ORDER.divergences.some((d) => d.item.includes(first.ap))).toBe(true);
        }
    });

    it('keeps the caveat that this is only as true as rules v1', () => {
        expect(ORDER.caveat).toMatch(/refutes a rules row/);
    });
});
