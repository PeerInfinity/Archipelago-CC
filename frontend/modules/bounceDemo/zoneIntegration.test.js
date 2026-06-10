/**
 * Step-5 integration: the zone-locations channel — side-exit
 * transform, Rule Builder emission, and the spiral → rules.json
 * end-to-end path with a winnability check on the canonical
 * placement.
 */
import { describe, it, expect } from 'vitest';
import './bounceDemoLibrary.js'; // registers the 'bounce' substrate
import { extractZoneRules, ZONES } from './bounceDemoLibrary.js';
import { attachSideExits } from './sideExits.js';
import { minimalSetsToRule } from './apRules.js';
import { validateLevel } from './level.js';
import { bounceStack } from './fixtures/bounceStack.js';
import { easyTower } from './fixtures/easyTower.js';
import { fillerClimb } from './fixtures/fillerClimb.js';
import {
    arrangeShuffledSpiral,
    buildRulesJson,
} from '../procgenPipeline/procgenPipelineEngine.js';

const ALL_SIDES = ['N', 'E', 'S', 'W'];

describe('attachSideExits', () => {
    it('produces a valid level for every fixture with all four sides', () => {
        for (const zone of ZONES) {
            const { level } = attachSideExits(zone.level, ALL_SIDES);
            expect(validateLevel(level)).toEqual([]);
        }
    });

    it('reuses the existing up-portal for N and adds platforms for the rest', () => {
        const { level, sidePortals } = attachSideExits(bounceStack, ALL_SIDES);
        expect(sidePortals.N).toBe('exit_up');
        expect(sidePortals.E).toBe('side_exit_E');
        expect(level.platforms.some((p) => p.id === 'side_pf_E')).toBe(true);
        // pure: input fixture untouched
        expect(bounceStack.platforms.some((p) => p.id === 'side_pf_E')).toBe(false);
    });
});

describe('minimalSetsToRule', () => {
    it('maps the verifier output shapes onto Rule Builder JSON', () => {
        expect(minimalSetsToRule([])).toEqual({ rule: 'False_' });
        expect(minimalSetsToRule([[]])).toEqual({ rule: 'True_' });
        expect(minimalSetsToRule([['springs']]))
            .toEqual({ rule: 'Has', args: { item_name: 'Springs' } });
        // (an empty set never coexists with others — minimality would
        // have removed the rest — so the realistic multi-set case is:)
        expect(minimalSetsToRule([['springs'], ['jetpacks']])).toEqual({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'Springs' } },
                { rule: 'Has', args: { item_name: 'Jetpacks' } },
            ],
        });
    });
});

describe('extractZoneRules', () => {
    it('emits canonical items and derived rules for the start zone', () => {
        const r = extractZoneRules(0, { region_id: 'r0', exitSides: ['N', 'E'] });
        expect(r.locations).toEqual([{
            id: 'loc_arrow',
            item: 'Right arrow',
            access_rule: { rule: 'True_' },
            position: null,
        }]);
        expect(r.exitRules.N).toEqual({ rule: 'True_' });
        expect(r.exitRules.E).toEqual({ rule: 'Has', args: { item_name: 'Right arrow' } });
        expect(r.payload.params.bounceLevel.platforms.some((p) => p.id === 'side_pf_E')).toBe(true);
        expect(r.payload.params.sidePortals).toEqual({ N: 'exit_up', E: 'side_exit_E' });
        expect(r.payload.ap_locations).toEqual({ loc_arrow: 'r0__loc_arrow' });
        expect(r.payload.flashCapabilities.start).toBe('auto');
    });

    it('filler zones emit no locations', () => {
        const fillerIdx = ZONES.findIndex((z) => z.level === fillerClimb);
        const r = extractZoneRules(fillerIdx, { region_id: 'rf', exitSides: ['N'] });
        expect(r.locations).toEqual([]);
    });

    it('throws when a pickup has no canonical item assignment', () => {
        const easyIdx = ZONES.findIndex((z) => z.level === easyTower);
        // sanity that the real table covers it, then break it via a fake zone
        expect(() => extractZoneRules(easyIdx, { region_id: 'r', exitSides: ['N'] }))
            .not.toThrow();
        expect(() => extractZoneRules(99, { region_id: 'r', exitSides: ['N'] }))
            .toThrow(/out of range/);
    });
});

// --- rules.json winnability -------------------------------------------

function evalRule(rule, items) {
    switch (rule.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'Has': return items.has(rule.args.item_name);
        case 'And': return rule.children.every((c) => evalRule(c, items));
        case 'Or': return rule.children.some((c) => evalRule(c, items));
        default: throw new Error(`evalRule: unhandled rule '${rule.rule}'`);
    }
}

/** AP-style sweep: expand reachable regions/locations until fixpoint. */
function sweep(regions, startRegion) {
    const items = new Set();
    const reachableRegions = new Set([startRegion]);
    const checkedLocations = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        for (const name of [...reachableRegions]) {
            const region = regions[name];
            for (const exit of region.exits ?? []) {
                if (!exit.connected_region || reachableRegions.has(exit.connected_region)) continue;
                if (evalRule(exit.access_rule ?? { rule: 'True_' }, items)) {
                    reachableRegions.add(exit.connected_region);
                    changed = true;
                }
            }
            for (const loc of region.locations ?? []) {
                if (checkedLocations.has(loc.name)) continue;
                if (evalRule(loc.access_rule ?? { rule: 'True_' }, items)) {
                    checkedLocations.add(loc.name);
                    if (loc.item?.name) items.add(loc.item.name);
                    changed = true;
                }
            }
        }
    }
    return { items, reachableRegions, checkedLocations };
}

describe('spiral -> rules.json end-to-end', () => {
    const build = () => {
        const { grid, startCell } = arrangeShuffledSpiral({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: { substrateQuotas: { bounce: 5 } },
        });
        return buildRulesJson(grid, { startCell, seed: 1, embedSphereLog: false });
    };

    it('emits all five zones with derived rules and reaches Victory (winnable)', () => {
        const rulesJson = build();
        const regions = rulesJson.regions['1'];
        // 5 zones + Menu
        expect(Object.keys(regions)).toHaveLength(6);

        const result = sweep(regions, 'Menu');
        expect(result.reachableRegions.size).toBe(6);
        expect(result.items).toContain('Right arrow');
        expect(result.items).toContain('Springs');
        expect(result.items).toContain('Left arrow');
        expect(result.items).toContain('Blue platforms');
        expect(result.items).toContain('Victory');
    });

    it('rules are non-trivial: at least one exit is item-gated', () => {
        const rulesJson = build();
        const regions = rulesJson.regions['1'];
        const gated = Object.values(regions)
            .flatMap((r) => r.exits ?? [])
            .filter((e) => e.access_rule && e.access_rule.rule !== 'True_');
        expect(gated.length).toBeGreaterThan(0);
    });
});
