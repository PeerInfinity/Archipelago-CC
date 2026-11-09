/**
 * ⛓ RULES l89-feather — a location reached only through gated material binds to its CHEAPEST way, not its nearest
 * (`cheapestLocationBinding`, make-seedling-playthrough-rules.mjs). Gadget rows on the pure decision, then the one real
 * element it moves today: L89's Feather, r9c6 (the west ledge, which climbs the south waterfall) → r1c10 (down the
 * north one on Swim alone).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapestLocationBinding } from './make-seedling-playthrough-rules.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const key = (c) => c;
const ways = (...sets) => sets.map((conditions) => ({ conditions }));
const comp = (id, ...sets) => ({ component: { id }, free: false, manual: false, conditionSets: ways(...sets) });
const cross = (from, to, ...sets) => ({ from, to, free: sets.length === 0, manual: false, conditionSets: ways(...sets) });
const noLanding = () => null;

/** The L89 shape: the nearest component climbs (swim + feather); a farther one comes down (swim). */
const l89 = (extra = {}) => ({
    ...comp('ledge', ['swim', 'feather']),
    necessary: ['swim'],
    alternatives: [comp('top', ['swim'])],
    landingWays: [],
    ...extra,
});

describe('cheapestLocationBinding — the decision', () => {
    it('rebinds to the component whose way pays exactly what every way pays, when every other way reaches it first', () => {
        const out = cheapestLocationBinding(l89(), [cross('ledge', 'top', ['swim', 'feather'])], noLanding, key);
        expect(out.refused).toBeUndefined();
        expect(out.component.id).toBe('top');
        expect(out.way).toEqual(['swim']);
    });

    it('RED-FIRST: a component whose way does NOT pass through the chosen one refuses the rebind', () => {
        const out = cheapestLocationBinding(l89(), [], noLanding, key);
        expect(out.refused).toEqual(['ledge [swim + feather] does not reach top first']);
    });

    it('a crossing that costs MORE than the way it must be implied by does not count', () => {
        const out = cheapestLocationBinding(l89(), [cross('ledge', 'top', ['swim', 'feather', 'key'])], noLanding, key);
        expect(out.refused).toEqual(['ledge [swim + feather] does not reach top first']);
    });

    it('a multi-hop path counts when every hop is within the way', () => {
        const b = l89({ alternatives: [comp('mid', ['swim', 'feather']), comp('top', ['swim'])] });
        const out = cheapestLocationBinding(b, [cross('ledge', 'mid'), cross('mid', 'top', ['feather'])], noLanding, key);
        expect(out.component.id).toBe('top');
    });

    it('two components that both pay exactly `necessary`: the first in the analyzer\'s order wins, deterministically', () => {
        const both = (first, second) => ({
            ...comp(first, ['swim']), necessary: ['swim'], alternatives: [comp(second, ['swim'])], landingWays: [],
        });
        const xs = [cross('a', 'b', ['swim']), cross('b', 'a', ['swim'])];
        expect(cheapestLocationBinding(both('a', 'b'), xs, noLanding, key).component.id).toBe('a');
        expect(cheapestLocationBinding(both('b', 'a'), xs, noLanding, key).component.id).toBe('b');
    });

    it('a landing way must start in, or reach, the chosen component; one with no AP sub-region refuses', () => {
        const b = l89({ landingWays: [{ tile: [3, 4], conditionSets: ways(['swim']) }] });
        const xs = [cross('ledge', 'top', ['swim', 'feather'])];
        expect(cheapestLocationBinding(b, xs, () => 'top', key).component.id).toBe('top');
        expect(cheapestLocationBinding(b, xs, () => 'ledge', key).refused)
            .toEqual(['the landing at [3,4] (ledge) [swim] does not reach top first']);
        expect(cheapestLocationBinding(b, xs, noLanding, key).refused).toEqual(['the landing at [3,4] has no AP sub-region']);
    });

    it('refuses on a manual-only component, an overflow, no necessary condition, or no exact way', () => {
        const xs = [cross('ledge', 'top', ['swim', 'feather'])];
        const manual = l89({ alternatives: [comp('top', ['swim']), { component: { id: 'cave' }, manual: true, conditionSets: [] }] });
        expect(cheapestLocationBinding(manual, xs, noLanding, key).refused).toEqual(['cave reaches it only through manual material']);
        expect(cheapestLocationBinding(l89({ reachOverflowed: true }), xs, noLanding, key).refused).toHaveLength(1);
        expect(cheapestLocationBinding(l89({ necessary: [] }), xs, noLanding, key).refused).toHaveLength(1);
        expect(cheapestLocationBinding(l89({ alternatives: [] }), xs, noLanding, key).refused)
            .toEqual(['no component has a way paying exactly what every way pays']);
    });
});

describe('the committed AP_1: L89\'s Feather is reached only from the top', () => {
    const rules = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
    const regions = rules.regions['1'];
    const holder = Object.entries(regions).filter(([, r]) => (r.locations ?? []).some((l) => l.name === 'Level 089 - Feather'));

    it('the Feather lies in level_89__r1c10 and costs one Progressive Swim there (not True_ in the ledge r9c6)', () => {
        expect(holder.map(([n]) => n)).toEqual(['level_89__r1c10']);
        const loc = holder[0][1].locations.find((l) => l.name === 'Level 089 - Feather');
        expect(loc.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
    });

    it('from the bottom rooms, r1c10 costs the Feather (Progressive Swim x2)', () => {
        for (const from of ['level_89__r11c12', 'level_89__r4c4', 'level_89__r6c16', 'level_89__r9c6']) {
            const exit = regions[from].exits.find((e) => e.connected_region === 'level_89__r1c10');
            expect(exit.access_rule, from).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } });
        }
    });
});
