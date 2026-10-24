/**
 * ⛓⛓ CONCEPT LIBRARY T1, D2 — **THE MAZE REALISES THREE CONCEPTS** (sword and
 * swim as pickups; guardian and water as SKIN gates over the rule gate).
 *
 * The oracle: a gate the world realises as a concept compiles to the SAME rule
 * as the control's `logic_gate` (extract + compile, a row per concept), the
 * room is otherwise the control's tile for tile (the selection spent no draw),
 * and the payload round-trips the skinned definition. A world that names no
 * concept places exactly today's `logic_gate_<n>`.
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    generateRegionCore, placeFromRules, extractPathsAndObstacles, deserializeMazeWorld, getObstacle,
} from './mazeRoomEngine.js';
import { serializeMazeWorld } from './mazeSerializer.js';
import { substrateRegistryEntry as ENTRY } from './mazeRoomLibrary.js';
import { MAZE_CONCEPT_REALISATIONS, conceptGateFor } from './mazeConcepts.js';
import {
    CONCEPTS, CONCEPT_ITEMS_FEATURE, assertRealisations, conceptsRealisedBy, itemTagsImpliedBy,
} from '../procgenCore/concepts.js';

const SWORD = { rule: 'Has', args: { item_name: 'Progressive Sword' } };
const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
const RED = { rule: 'Has', args: { item_name: 'key_red' } };
const ALL = Object.keys(CONCEPTS);

/** A counting wrap of the shared rng: every `next()` (and so every `choice`) is counted. */
function countingRng(seed) {
    const rng = createRng(seed);
    const next = rng.next.bind(rng);
    let draws = 0;
    rng.next = () => { draws += 1; return next(); };
    return { rng, draws: () => draws };
}

const freshCore = () => generateRegionCore({
    region_id: 'r1', size: { width: 10, height: 8 },
    entrances: [{ side: 'W', tile: { x: 0, y: 3 } }], exits: [{ side: 'E' }],
    rng: createRng(7), params: {},
});

/** One room, one exit rule and one location rule, placed with `params`. */
function place({ exitRule, locRule, params }) {
    const { world } = freshCore();
    const exitId = [...world.exits.keys()][0];
    const { rng, draws } = countingRng(11);
    const out = placeFromRules(world, {
        exit_rules: exitRule ? { [exitId]: exitRule } : {},
        location_rules: locRule ? { loc0: locRule } : {},
        item_placements: [{ item_id: 'map', location_id: 'loc0' }],
        rng,
        ...(params !== undefined ? { params } : {}),
    });
    return { world, out, draws: draws() };
}

const compiled = (world) => compileRegion(extractPathsAndObstacles(world, { regionId: 'r1' }),
    { obstacleLib: world.obstacleLib });

describe('the entry declares the realisations, and they are well-formed', () => {
    it('assertRealisations(entry, CONCEPTS) passes; sword/swim are mechanic, guardian/water skin gates', () => {
        expect(ENTRY.conceptRealisations).toBe(MAZE_CONCEPT_REALISATIONS);
        expect(() => assertRealisations(ENTRY, CONCEPTS)).not.toThrow();
        expect(conceptsRealisedBy(ENTRY, CONCEPTS)).toEqual([
            { concept: 'sword', kind: 'item', tier: 'mechanic', placements: [] },
            { concept: 'swim', kind: 'item', tier: 'mechanic', placements: [] },
            { concept: 'guardian', kind: 'enemy', tier: 'skin', placements: [{ key: 'gate', effect: 'requires' }] },
            { concept: 'water', kind: 'obstacle', tier: 'skin', placements: [{ key: 'gate', effect: 'requires' }] },
        ]);
    });
    it('⛓ T0b: sword/swim carry the concept-items `feature`, so itemTagsImpliedBy names it (T1\'s finding, closed)', () => {
        expect(itemTagsImpliedBy(ENTRY, CONCEPTS)).toEqual([CONCEPT_ITEMS_FEATURE]);
    });
    it('⛔ the entry declares NO libraryItems (top-down grants them as free starting items)', () => {
        expect('libraryItems' in ENTRY).toBe(false);
    });
});

describe('a world that names NO concept places today\'s logic_gate, byte for byte', () => {
    for (const [label, params] of [['params absent', undefined], ['params {}', {}], ['concepts []', { concepts: [] }]]) {
        it(`${label}: Has(Sword) on the exit and Has(Swim) on the location stay logic_gate_0 / logic_gate_1`, () => {
            const control = place({ exitRule: SWORD, locRule: SWIM, params: undefined });
            const got = place({ exitRule: SWORD, locRule: SWIM, params });
            expect(got.out.placed_logic_gates.map((g) => g.gate_id)).toEqual(['logic_gate_0', 'logic_gate_1']);
            expect(serializeMazeWorld(got.world, null)).toEqual(serializeMazeWorld(control.world, null));
            expect(got.draws).toBe(control.draws);
        });
    }
});

describe('a world that names the concept realises the gate as it — the picture moves, the logic does not', () => {
    const CASES = [
        { concept: 'guardian', rule: SWORD, need: 'sword' },
        { concept: 'water', rule: SWIM, need: 'swim' },
    ];
    for (const { concept, rule, need } of CASES) {
        it(`${concept}: on the EXIT — ${concept}_gate_0, the same clear_rule, the same compiled rule, the same room`, () => {
            const control = place({ exitRule: rule, params: { concepts: [] } });
            const got = place({ exitRule: rule, params: { concepts: [concept, need] } });
            const [gate] = got.out.placed_logic_gates;
            expect(gate.gate_id).toBe(`${concept}_gate_0`);
            const def = got.world.obstacleLib[gate.gate_id];
            const art = MAZE_CONCEPT_REALISATIONS[concept].art;
            expect(def).toEqual({
                ...DEFAULT_OBSTACLES.logic_gate, id: gate.gate_id, clear_set_type: 'rule', clear_rule: rule,
                concept, placement: 'gate', name: art.name, color: art.color, symbol: art.symbol,
            });
            expect(getObstacle(got.world, gate.position.x, gate.position.y)).toBe(gate.gate_id);
            expect(compiled(got.world).exits.map((e) => e.rule)).toEqual(compiled(control.world).exits.map((e) => e.rule));
            expect(compiled(got.world).exits[0].rule).toEqual(rule);
            expect(got.draws).toBe(control.draws);
            expect(Array.from(got.world.tiles)).toEqual(Array.from(control.world.tiles));
            expect([...got.world.items]).toEqual([...control.world.items]);
        });
        it(`${concept}: on a LOCATION — ${concept}_gate_0 on the item tile, the same compiled location rule`, () => {
            const control = place({ locRule: rule, params: { concepts: [] } });
            const got = place({ locRule: rule, params: { concepts: [concept] } });
            const [gate] = got.out.placed_logic_gates;
            expect(gate.gate_id).toBe(`${concept}_gate_0`);
            expect(gate.position).toEqual(control.out.placed_logic_gates[0].position);
            const rules = (w) => compiled(w).locations.map((l) => [l.item, l.rule]);
            expect(rules(got.world)).toEqual(rules(control.world));
            expect(rules(got.world)).toEqual([['map', rule]]);
        });
    }

    it('the concept is offered only by NAME: guardian alone skins Has(Sword), never Has(Swim)', () => {
        const got = place({ exitRule: SWORD, locRule: SWIM, params: { concepts: ['guardian'] } });
        expect(got.out.placed_logic_gates.map((g) => g.gate_id)).toEqual(['guardian_gate_0', 'logic_gate_1']);
    });

    it('a rule no realisation needs exactly stays a logic_gate, whatever the world names', () => {
        for (const rule of [RED, { rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } },
            { rule: 'And', children: [SWORD, SWIM] }, { rule: 'Or', children: [SWORD, SWIM] }]) {
            const got = place({ exitRule: rule, params: { concepts: ALL } });
            expect(got.out.placed_logic_gates[0].gate_id, JSON.stringify(rule)).toBe('logic_gate_0');
        }
    });

    it('conceptGateFor uses rng.choice when the stream has it, and next() when it does not (no draw for 0/1 candidate)', () => {
        let nexts = 0;
        const bare = { next: () => { nexts += 1; return 0.5; } };
        const base = DEFAULT_OBSTACLES.logic_gate;
        expect(conceptGateFor(SWORD, { offered: ['guardian'], rng: bare, n: 3, logicGateBase: base }).id)
            .toBe('guardian_gate_3');
        expect(conceptGateFor(RED, { offered: ALL, rng: bare, n: 0, logicGateBase: base })).toBeNull();
        expect(nexts).toBe(0);
    });
});

describe('the payload carries the skinned gate (mazeSerializer obstacleLib extras)', () => {
    it('serialise → deserialise: the guardian gate\'s whole definition survives, and still compiles to the rule', () => {
        const got = place({ exitRule: SWORD, locRule: SWIM, params: { concepts: ['guardian', 'water'] } });
        const payload = JSON.parse(JSON.stringify(serializeMazeWorld(got.world, null)));
        expect(Object.keys(payload.obstacleLib)).toEqual(['guardian_gate_0', 'water_gate_1']);
        expect(payload.obstacleLib.guardian_gate_0).toEqual(got.world.obstacleLib.guardian_gate_0);
        const back = deserializeMazeWorld(payload);
        expect(back.obstacleLib.water_gate_1).toEqual(got.world.obstacleLib.water_gate_1);
        // the rules compiled off the round-tripped room are the control's round trip's
        const control = place({ exitRule: SWORD, locRule: SWIM, params: { concepts: [] } });
        const controlBack = deserializeMazeWorld(JSON.parse(JSON.stringify(serializeMazeWorld(control.world, null))));
        expect(compiled(back).exits.map((e) => e.rule)).toEqual(compiled(controlBack).exits.map((e) => e.rule));
        expect(compiled(back).locations.map((l) => l.rule)).toEqual(compiled(controlBack).locations.map((l) => l.rule));
        expect(compiled(back).locations.map((l) => l.rule)).toEqual([SWIM]);
    });
});
