/**
 * The generation-time pricing (`noiz2saPricing.js`, bulletml N5): the trainer prediction, the walk over the one cost
 * model's plan (the predicted skill rises with the Noiz2sa mana spent, the length ramp, the spans' chances, the final
 * region = the setting), the rate (expected mana = the planned cost), the check spans (their expected mana is the
 * closest to the location's cost), the payloads, and the pipeline hook (only Noiz2sa regions are touched; with the
 * shared writer's payload-rate rule, the block carries the rates).
 */
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_FINAL_SPAN, TARGET_FINAL_SKILL, DEFAULT_POINTS_PER_MANA, FINAL_SPAN_PARAM,
    skillForPoints, predictedSkill, pointsForSkill, pointsPerManaFor, noiz2saWalkEvents, checkSpanFor,
    planNoiz2saWorld, applyNoiz2saPricing, priceNoiz2saRegions,
} from './noiz2saPricing.js';
import { spanDifficulty, parseSpan, spanLength, spanAt, sceneIndex, SCENE_TOTAL, pickSpan } from './noiz2saDifficulty.js';
import { showSpan, regionSpansOf } from './noiz2saRegion.js';
import { substrateRegistryEntry, zoneRulesOf } from './noiz2saSubstrateLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import * as loopCostPlanner from '../shared/procgen/loopCostPlanner.js';
import { generateLoopCosts, DEFAULT_TIME_DRAIN_PER_SECOND } from '../shared/procgen/loopCostGenerator.js';
import { priceSubstrateRegions } from '../procgenPipeline/procgenPipelineEngine.js';

/** ⛓ the shared submodule's payload-rate rule (bulletml N5) is feature-detected: without it the block keeps 1 */
const SHARED_HAS_PAYLOAD_RATES = typeof loopCostPlanner.regionDrainRatesFromRulesJson === 'function';

// ── a world: Menu → R0 → R1 → … → R5, each a Noiz2sa region with one location, checked in order over six spheres ──
const N = 6;
const ZONES = Array.from({ length: N }, () => ({ start: '1:1', end: '1:1', locations: 1 }));
function world({ extra = {} } = {}) {
    const regions = { Menu: { exits: [{ name: 'Menu -> R0', connected_region: 'R0' }], locations: [] } };
    const sidecars = {};
    for (let i = 0; i < N; i++) {
        const name = `R${i}`;
        const zr = zoneRulesOf(ZONES, i, { region_id: name });
        regions[name] = {
            exits: [
                ...(i > 0 ? [{ name: `${name} -> R${i - 1}`, connected_region: `R${i - 1}` }] : [{ name: 'R0 -> Menu', connected_region: 'Menu' }]),
                ...(i < N - 1 ? [{ name: `${name} -> R${i + 1}`, connected_region: `R${i + 1}` }] : []),
            ],
            locations: zr.locations.map((l) => ({ name: `${name}__${l.id}`, id: 1000 + i, item: { name: l.item } })),
        };
        sidecars[name] = { substrate: 'noiz2sa', playable_payload: { ...zr.payload, exits: [], fogEnabled: false } };
    }
    return {
        regions: { 1: regions },
        start_regions: { 1: { default: ['Menu'] } },
        items: { 1: { Victory: { classification: 'progression' }, 'Noiz2sa Star': { classification: 'filler' } } },
        preset_sidecars: { 1: { ...sidecars, ...extra } },
    };
}
const sphereLog = () => Array.from({ length: N }, (_, i) => ({
    type: 'state_update', sphere_index: String(i),
    player_data: { 1: { sphere_locations: [`R${i}__check1`], new_inventory_details: { base_items: { 'Noiz2sa Star': 1 } } } },
}));

describe('the trainer prediction', () => {
    it('Even: the mean track rises with the points; all-95 costs pointsForSkill(95)', () => {
        let last = -1;
        for (const pts of [0, 5, 50, 500, 2000, 6000, 10000]) {
            const s = skillForPoints(pts);
            expect(s).toBeGreaterThanOrEqual(last);
            last = s;
        }
        expect(skillForPoints(0)).toBe(0);
        expect(skillForPoints(pointsForSkill(95))).toBe(95);
        expect(skillForPoints(pointsForSkill(95) - 1)).toBeLessThan(95);
        expect(predictedSkill(100, 2)).toBe(skillForPoints(200));
    });
    it('the pace reaches TARGET_FINAL_SKILL on the walk\'s mana (rounded up); no mana → the default', () => {
        const ppm = pointsPerManaFor(220.43);
        expect(predictedSkill(220.43, ppm)).toBeGreaterThanOrEqual(TARGET_FINAL_SKILL);
        expect(ppm).toBeLessThan(pointsForSkill(TARGET_FINAL_SKILL) / 220.43 * 1.001);
        expect(pointsPerManaFor(0)).toBe(DEFAULT_POINTS_PER_MANA);
    });
});

describe('the walk\'s events', () => {
    it('moves out of and checks in Noiz2sa regions spend; explores do not; the order is traversal, prices, check', () => {
        const isN = (r) => r.startsWith('R');
        const ev = noiz2saWalkEvents([
            { phase: 'EXPLORE', queue: [{ type: 'move', from: 'Menu', cost: 0 }, { type: 'move', from: 'R0', cost: 7 }, { type: 'explore', region: 'R1', cost: 20 }],
                costAssignments: [{ type: 'region', name: 'R1', cost: 10 }] },
            { phase: 'CHECK', queue: [{ type: 'move', from: 'R0', cost: 7 }, { type: 'locationCheck', region: 'R1', location: 'R1__check1', cost: 40 }],
                costAssignments: [{ type: 'location', name: 'R1__check1', cost: 40 }] },
        ], { isNoiz2sa: isN, regionOfLocation: (l) => l.split('__')[0] });
        expect(ev.map((e) => `${e.kind}:${e.region}:${e.mana ?? e.cost}`)).toEqual([
            'spend:R0:7', 'region:R1:10', 'spend:R0:7', 'location:R1:40', 'spend:R1:40',
        ]);
    });
});

describe('the walk over a planned world', () => {
    const plan = planNoiz2saWorld({ rulesJson: world(), sphereLog: sphereLog(), playerId: '1' });
    const finalScenes = spanLength(parseSpan(DEFAULT_FINAL_SPAN));

    it('every Noiz2sa region priced, in first-reach order, the last one the final', () => {
        expect(plan.regions.map((r) => r.region)).toEqual(['R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
        expect(plan.regions.map((r) => r.order)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(plan.finalRegion).toBe('R5');
        expect(plan.regions.filter((r) => r.final).map((r) => r.region)).toEqual(['R5']);
    });
    it('the predicted skill rises with the Noiz2sa mana spent before each region', () => {
        for (let i = 1; i < plan.regions.length; i++) {
            expect(plan.regions[i].mana).toBeGreaterThan(plan.regions[i - 1].mana);
            expect(plan.regions[i].skill).toBeGreaterThanOrEqual(plan.regions[i - 1].skill);
        }
        expect(plan.regions[0]).toMatchObject({ mana: 0, skill: 0 });
        // the pace makes the walk end at the target skill
        expect(predictedSkill(plan.manaEnd, plan.pointsPerMana)).toBeGreaterThanOrEqual(TARGET_FINAL_SKILL);
    });
    it('the length ramps from 1 to the final region\'s count; the final region is the setting exactly', () => {
        const lengths = plan.regions.map((r) => r.scenes);
        expect(lengths[0]).toBe(1);
        expect(lengths.at(-1)).toBe(finalScenes);
        for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
        expect(lengths).toEqual(plan.regions.map((_, k) => Math.round(1 + (finalScenes - 1) * k / (N - 1))));
        expect(showSpan(plan.regions.at(-1).span)).toBe(DEFAULT_FINAL_SPAN);
    });
    it('every other region\'s span: the hardest the predicted bot clears deathless with chance ≥ 0.5 (when one does)', () => {
        for (const r of plan.regions.filter((x) => !x.final)) {
            const pick = pickSpan(r.scenes, r.skill);
            expect(showSpan(r.span)).toBe(showSpan(pick.span));
            if (pick.reached) expect(r.p).toBeGreaterThanOrEqual(0.5);
            expect(r.p).toBeCloseTo(spanDifficulty(r.span, r.skill).p, 12);
        }
    });
    it('the rate: a move run\'s expected mana (rate × E at the predicted skill) is the planned cost', () => {
        for (const r of plan.regions) {
            expect(r.cost).toBeGreaterThan(0);
            expect(r.rate).toBeCloseTo(r.cost / r.seconds, 4);
            expect(Math.abs(r.expected - r.cost) / r.cost).toBeLessThan(0.005);
        }
    });
    it('a check span starts at the move span\'s start; its length is the one whose expected mana is closest to the location\'s cost', () => {
        expect(plan.locations).toHaveLength(N);
        for (const l of plan.locations) {
            const r = plan.regions.find((x) => x.region === l.region);
            expect(l.span.start).toEqual(r.span.start);
            const a = sceneIndex(r.span.start);
            const miss = (n) => Math.abs(Math.log(r.rate * spanDifficulty(spanAt(a, n), l.skill).seconds / l.cost));
            const n = spanLength(l.span);
            for (let m = 1; a + m <= SCENE_TOTAL; m++) expect(miss(n)).toBeLessThanOrEqual(miss(m) + 1e-9);
            expect(l.expected).toBeCloseTo(r.rate * l.seconds, 9);
        }
    });
    it('checkSpanFor picks the length that buys the cost', () => {
        const start = parseSpan('2:1').start;
        const one = spanDifficulty(spanAt(sceneIndex(start), 1), 100).seconds;
        const c = checkSpanFor(start, { rate: 1, cost: 3 * one, skill: 100 });
        expect(spanLength(c.span)).toBe(3);
    });
    it('another final span setting: the final region plays it, the ramp ends on its length', () => {
        const p2 = planNoiz2saWorld({ rulesJson: world(), sphereLog: sphereLog(), playerId: '1', finalSpan: '5:boss' });
        expect(showSpan(p2.regions.at(-1).span)).toBe('5:boss');
        expect(p2.regions.map((r) => r.scenes)).toEqual([1, 1, 1, 1, 1, 1]);
    });
});

describe('the payloads and the pipeline hook', () => {
    it('applyNoiz2saPricing writes move, check, the rate and pricing; the payload still loads', () => {
        const rules = world();
        const plan = planNoiz2saWorld({ rulesJson: rules, sphereLog: sphereLog(), playerId: '1' });
        expect(applyNoiz2saPricing(rules, '1', plan)).toBe(N);
        for (const r of plan.regions) {
            const p = rules.preset_sidecars[1][r.region].playable_payload;
            expect(p.move).toEqual(r.span);
            expect(p.timeDrainPerSecond).toBe(r.rate);
            expect(p.pricing).toMatchObject({ pointsPerMana: plan.pointsPerMana, cost: r.cost, final: r.final });
            const l = plan.locations.find((x) => x.region === r.region);
            expect(p.locations[0].check).toEqual(l.span);
            expect(regionSpansOf(p).locations[0].check).toEqual(l.span);
            expect(() => substrateRegistryEntry.deserializeWorld(p)).not.toThrow();
        }
    });
    it('the registry hook reads the final span from the params bag', () => {
        expect(substrateRegistryEntry.priceRegions).toBe(priceNoiz2saRegions);
        expect(substrateRegistryEntry.defaultProcgenParams).toEqual({ [FINAL_SPAN_PARAM]: DEFAULT_FINAL_SPAN });
        const rules = world();
        rules.sphere_log = sphereLog();
        priceNoiz2saRegions({ rulesJson: rules, sphereLog: rules.sphere_log, playerId: '1', params: { [FINAL_SPAN_PARAM]: '9:boss' } });
        expect(showSpan(rules.preset_sidecars[1].R5.playable_payload.move)).toBe('9:boss');
    });
    it('priceSubstrateRegions touches only the regions of a substrate with the hook (runner/bounce unchanged)', () => {
        if (!substrateRegistry.has('runner_like_n5')) {
            substrateRegistry.register({ id: 'runner_like_n5', label: 'r', panelComponentType: 'p', loadRegionEvent: 'r:l',
                loopSupport: { summaryRecording: true } });
        }
        const runnerPayload = { exits: [], params: { a: 1 } };
        const rules = world({ extra: { Extra: { substrate: 'runner_like_n5', playable_payload: structuredClone(runnerPayload) } } });
        rules.regions[1].Extra = { exits: [{ name: 'Extra -> R0', connected_region: 'R0' }], locations: [] };
        rules.regions[1].R0.exits.push({ name: 'R0 -> Extra', connected_region: 'Extra' });
        rules.sphere_log = sphereLog();
        priceSubstrateRegions(rules, { playerId: '1' });
        expect(rules.preset_sidecars[1].Extra.playable_payload).toEqual(runnerPayload);
        expect(typeof rules.preset_sidecars[1].R0.playable_payload.timeDrainPerSecond).toBe('number');
        const block = generateLoopCosts({ rulesJson: rules, sphereLog: rules.sphere_log, playerId: '1' });
        expect(block.regions.Extra.timeDrainPerSecond).toBe(DEFAULT_TIME_DRAIN_PER_SECOND);
        // with the shared writer's payload-rate rule the block carries each Noiz2sa region's own rate; without it, 1
        for (let i = 0; i < N; i++) {
            const own = rules.preset_sidecars[1][`R${i}`].playable_payload.timeDrainPerSecond;
            expect(block.regions[`R${i}`].timeDrainPerSecond).toBe(SHARED_HAS_PAYLOAD_RATES ? own : DEFAULT_TIME_DRAIN_PER_SECOND);
            expect(block.regions[`R${i}`].moveCost).toBeUndefined();
        }
    });
});
