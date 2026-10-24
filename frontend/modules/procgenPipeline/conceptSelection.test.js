/**
 * procgenPipeline/conceptSelection — **THE RULE SELECTS** (concept library T0,
 * D3). The concepts are the shipped table; the substrate half is a TEST DOUBLE
 * of the brief's shape (no registry entry declares one yet).
 */
import { describe, expect, it } from 'vitest';

import { createRng } from '../shared/rng.js';
import { CONCEPTS, assertRealisations } from '../procgenCore/concepts.js';
import { extractItemRequirementFromRule } from './ruleRequirements.js';
import {
    candidatesFor, decorationsFor, needsAsItems, ruleFor, selectRealisation,
} from './conceptSelection.js';

const SWORD = 'Progressive Sword';
const SWIM = 'Progressive Swim';
const has = (item_name, count) => (count ? { rule: 'Has', args: { item_name, count } } : { rule: 'Has', args: { item_name } });

function double() {
    return {
        id: 'double',
        conceptRealisations: {
            guardian: {
                tier: 'mechanic', art: null, placements: {
                    gate: { effect: 'requires', needs: ['sword'], mechanic: { element: 'killgate' } },
                    roaming: { effect: 'none', mechanic: { element: 'roam' } },
                },
            },
            water: {
                tier: 'mechanic', art: null, placements: {
                    gate: { effect: 'requires', needs: ['swim'], mechanic: { element: 'watergate' } },
                    shortcut: { effect: 'helps', needs: ['swim'], mechanic: { element: 'watershortcut' } },
                },
            },
            sword: { tier: 'mechanic', flag: 'hasSword' },
        },
    };
}
const ALL = ['sword', 'swim', 'guardian', 'water'];
const O = { concepts: CONCEPTS, offered: ALL };

/** A shared-rng stream that counts every draw it spends. */
function countingRng(seed = 7) {
    const rng = createRng(seed);
    const next = rng.next.bind(rng);
    rng.draws = 0;
    rng.next = () => { rng.draws += 1; return next(); };
    return rng;
}

describe('ruleFor — a placement\'s needs as Rule Builder JSON, round-tripping EXACTLY', () => {
    const rows = [
        ['guardian.gate (sword)', { needs: ['sword'] }, has(SWORD), [SWORD], {}],
        ['water.gate (swim)', { needs: ['swim'] }, has(SWIM), [SWIM], {}],
        ['water.shortcut (swim, helps)', { effect: 'helps', needs: ['swim'] }, has(SWIM), [SWIM], {}],
        ['the feather (swim ×2)', { needs: [{ concept: 'swim', count: 2 }] }, has(SWIM, 2), [SWIM], { [SWIM]: 2 }],
        ['sword AND swim ×2', { needs: ['sword', { concept: 'swim', count: 2 }] },
            { rule: 'And', children: [has(SWORD), has(SWIM, 2)] }, [SWORD, SWIM], { [SWIM]: 2 }],
    ];
    it.each(rows)('%s', (_label, placement, rule, requirement, counts) => {
        expect(ruleFor(placement, CONCEPTS)).toEqual(rule);
        expect(extractItemRequirementFromRule(ruleFor(placement, CONCEPTS)))
            .toEqual({ requirement, counts, exact: true });
    });

    it('no needs is True_', () => {
        expect(ruleFor({ effect: 'none' }, CONCEPTS)).toEqual({ rule: 'True_' });
    });

    it('needsAsItems names the AP item and its count', () => {
        expect(needsAsItems({ needs: ['sword', { concept: 'swim', count: 2 }] }, CONCEPTS))
            .toEqual([{ name: SWORD, count: 1 }, { name: SWIM, count: 2 }]);
    });

    it('the double is a well-formed substrate half against the shipped table', () => {
        expect(() => assertRealisations(double(), CONCEPTS)).not.toThrow();
    });
});

describe('candidatesFor — the requires placements whose needs EQUAL the rule\'s exact requirement', () => {
    const rows = [
        ['Has(Sword) → the guardian gate', has(SWORD), ['guardian.gate']],
        ['Has(Swim) → the water gate (never the shortcut)', has(SWIM), ['water.gate']],
        ['⛓ mutant (b): Has(Swim, 2) → nothing (the water gate needs swim ×1)', has(SWIM, 2), []],
        ['And(Sword, Swim) → nothing (no placement needs both)', { rule: 'And', children: [has(SWORD), has(SWIM)] }, []],
        ['HasAll([Sword]) → the guardian gate (exact)', { rule: 'HasAll', args: { items: [SWORD] } }, ['guardian.gate']],
        ['Or(Sword, Swim) → nothing (inexact)', { rule: 'Or', children: [has(SWORD), has(SWIM)] }, []],
        ['HasAny([Sword, Swim]) → nothing (inexact)', { rule: 'HasAny', args: { items: [SWORD, SWIM] } }, []],
        ['Or(Sword, Sword+Swim) → nothing, though its necessary subset is Sword', {
            rule: 'Or', children: [has(SWORD), { rule: 'And', children: [has(SWORD), has(SWIM)] }],
        }, []],
        ['True_ → nothing (no gate to realise)', { rule: 'True_' }, []],
        ['a foreign item → nothing', has('Hookshot'), []],
    ];
    it.each(rows)('%s', (_label, rule, want) => {
        expect(candidatesFor(rule, double(), O).map((c) => `${c.concept}.${c.placement}`)).toEqual(want);
    });

    it('a candidate carries its concept, placement, effect, needs, tier, art and mechanic', () => {
        expect(candidatesFor(has(SWORD), double(), O)).toEqual([{
            concept: 'guardian', placement: 'gate', effect: 'requires', needs: ['sword'],
            tier: 'mechanic', art: null, mechanic: { element: 'killgate' },
        }]);
    });

    it('only an OFFERED concept is a candidate; an empty or absent list offers none', () => {
        expect(candidatesFor(has(SWORD), double(), { concepts: CONCEPTS, offered: ['water', 'sword'] })).toEqual([]);
        expect(candidatesFor(has(SWORD), double(), { concepts: CONCEPTS, offered: [] })).toEqual([]);
        expect(candidatesFor(has(SWORD), double(), { concepts: CONCEPTS })).toEqual([]);
    });

    it('an entry with no realisations has no candidate (rule 4)', () => {
        expect(candidatesFor(has(SWORD), { id: 'bare' }, O)).toEqual([]);
    });
});

describe('selectRealisation — the draw budget', () => {
    const twoGates = () => {
        const e = double();
        e.conceptRealisations.guardian.placements.arena = { effect: 'requires', needs: ['sword'], mechanic: { element: 'arena' } };
        return e;
    };

    it('0 candidates → null, NO draw', () => {
        const rng = countingRng();
        expect(selectRealisation(has(SWIM, 2), double(), { ...O, rng })).toBeNull();
        expect(rng.draws).toBe(0);
    });

    it('an empty or absent `offered` → null, NO draw (a world that lists no concept is untouched)', () => {
        const rng = countingRng();
        expect(selectRealisation(has(SWORD), twoGates(), { concepts: CONCEPTS, offered: [], rng })).toBeNull();
        expect(selectRealisation(has(SWORD), twoGates(), { concepts: CONCEPTS, rng })).toBeNull();
        expect(rng.draws).toBe(0);
    });

    it('1 candidate → it, NO draw', () => {
        const rng = countingRng();
        expect(selectRealisation(has(SWORD), double(), { ...O, rng })).toMatchObject({ concept: 'guardian', placement: 'gate' });
        expect(rng.draws).toBe(0);
    });

    it('2 candidates → one of them, EXACTLY ONE draw, the same one for the same seed', () => {
        const picks = [];
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const rng = countingRng(seed);
            const got = selectRealisation(has(SWORD), twoGates(), { ...O, rng });
            expect(rng.draws).toBe(1);
            expect(['gate', 'arena']).toContain(got.placement);
            expect(selectRealisation(has(SWORD), twoGates(), { ...O, rng: countingRng(seed) })).toEqual(got);
            picks.push(got.placement);
        }
        expect(new Set(picks).size, 'eight seeds reach both candidates').toBe(2);
    });

    it('2 candidates and no rng → refuses by name', () => {
        expect(() => selectRealisation(has(SWORD), twoGates(), O)).toThrow(/2 candidates for one rule and no rng/);
    });
});

describe('decorationsFor — the helps and none placements, which no rule selects', () => {
    it('the roaming guardian and the water shortcut, in declared order', () => {
        expect(decorationsFor(double(), O).map((d) => `${d.concept}.${d.placement}:${d.effect}`))
            .toEqual(['guardian.roaming:none', 'water.shortcut:helps']);
    });

    it('none of them is ever a candidate', () => {
        for (const rule of [has(SWORD), has(SWIM), has(SWIM, 2)]) {
            for (const c of candidatesFor(rule, double(), O)) expect(c.effect).toBe('requires');
        }
    });

    it('nothing offered → nothing', () => {
        expect(decorationsFor(double(), { offered: [] })).toEqual([]);
        expect(decorationsFor(double(), {})).toEqual([]);
    });
});

describe('T0b — an entry OR its realisations object: one normaliser, pinned both ways', () => {
    const entry = double();
    const reals = entry.conceptRealisations;
    it('candidatesFor answers the same for both', () => {
        for (const rule of [has(SWORD), has(SWIM), has(SWIM, 2), { rule: 'And', children: [has(SWORD), has(SWIM)] }]) {
            expect(candidatesFor(rule, reals, O)).toEqual(candidatesFor(rule, entry, O));
        }
        expect(candidatesFor(has(SWORD), reals, O).map((c) => c.concept)).toEqual(['guardian']);
    });
    it('selectRealisation answers the same for both', () => {
        expect(selectRealisation(has(SWIM), reals, O)).toEqual(selectRealisation(has(SWIM), entry, O));
        expect(selectRealisation(has(SWIM), reals, O)).toMatchObject({ concept: 'water', placement: 'gate' });
    });
    it('decorationsFor answers the same for both', () => {
        expect(decorationsFor(reals, O)).toEqual(decorationsFor(entry, O));
        expect(decorationsFor(reals, O).map((d) => `${d.concept}.${d.placement}`))
            .toEqual(['guardian.roaming', 'water.shortcut']);
    });
    it('an entry that realises nothing still selects nothing', () => {
        expect(selectRealisation(has(SWORD), { id: 'bare', supportedFeatures: ['logic_gate'] }, O)).toBeNull();
    });
});
