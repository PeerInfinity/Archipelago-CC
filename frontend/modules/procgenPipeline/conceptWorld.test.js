/**
 * ⛓⛓⛓ CONCEPT LIBRARY T1, D4 — **A WORLD THAT SHOWS IT** (not a committed
 * preset: a committed preset enrols in derived rosters).
 *
 * A maze-only sphere-growth world over the sword, swim and victory, built
 * through the panel's own assembly (`buildRunFromState` → `runPresetHeadless`)
 * twice at the same seed: `concepts: []` (the control) and `concepts: [sword,
 * guardian, swim, water]`. The planner gates the swim sphere on
 * `Has(Progressive Swim)` and the sword sphere on `Has(Progressive Sword)`; the
 * concept world realises those gates as `water_gate_*` / `guardian_gate_*`,
 * and the compiled `rules.json` is the control's rule for rule — **the concept
 * changed the picture, never the logic.**
 *
 * ⛓ Measured at seed 1 before this row was written: control gates
 * `region_2_2:logic_gate_0`, `region_2_3:logic_gate_0`; concept world
 * `region_2_2:water_gate_0`, `region_2_3:guardian_gate_0`; oracle clean in both.
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { buildRunFromState, runPresetHeadless, mergedItemLib } from './presetRun.js';
import { CONCEPTS } from '../procgenCore/concepts.js';
import { MAZE_CONCEPT_REALISATIONS } from '../mazeRoom/mazeConcepts.js';

const CONCEPT_LIST = ['sword', 'guardian', 'swim', 'water'];
const bundle = (concepts) => ({
    mode: 'sphereGrowth',
    params: { seed: 1, startSubstrate: 'maze', sphereCount: 3, fillerCount: 0, revisitPercent: 25, concepts },
    scenario: { items: { 'Progressive Sword': 1, 'Progressive Swim': 1, victory: 1 }, obstacles: {} },
    substrateQuotas: { maze: 99 },
    substrateMix: {},
    substrateMode: 'quotas',
});

const gatesOf = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .flatMap(([rid, s]) => Object.entries(s.playable_payload?.obstacleLib ?? {})
        .map(([id, def]) => ({ rid, id, def })));
const withoutSidecars = ({ preset_sidecars: _s, ...rest }) => rest;

describe('D4 — a maze sphere world over the sword and swim, with and without the concepts', async () => {
    const control = await runPresetHeadless(buildRunFromState(bundle([])));
    const world = await runPresetHeadless(buildRunFromState(bundle(CONCEPT_LIST)));

    it('both worlds generate with the plan-vs-world oracle clean', () => {
        expect(control.oracleErrors ?? []).toEqual([]);
        expect(world.oracleErrors ?? []).toEqual([]);
    });

    it('the control\'s gates are plain logic gates; the concept world\'s are one guardian and one water gate', () => {
        expect(gatesOf(control.rulesJson).map((g) => g.id)).toEqual(['logic_gate_0', 'logic_gate_0']);
        const gates = gatesOf(world.rulesJson);
        expect(gates.filter((g) => g.id.startsWith('guardian_gate_'))).toHaveLength(1);
        expect(gates.filter((g) => g.id.startsWith('water_gate_'))).toHaveLength(1);
        expect(gates.filter((g) => g.id.startsWith('logic_gate_'))).toHaveLength(0);
        for (const g of gates) {
            const concept = g.id.startsWith('guardian') ? 'guardian' : 'water';
            const need = concept === 'guardian' ? CONCEPTS.sword.item.id : CONCEPTS.swim.item.id;
            expect(g.def).toMatchObject({
                concept, placement: 'gate', clear_set_type: 'rule',
                clear_rule: { rule: 'Has', args: { item_name: need } },
                color: MAZE_CONCEPT_REALISATIONS[concept].art.color,
            });
        }
    });

    it('the gates stand where the control\'s stood, on the same rules', () => {
        const at = (rj) => gatesOf(rj).map((g) => [g.rid, g.def.clear_rule]);
        expect(at(world.rulesJson)).toEqual(at(control.rulesJson));
    });

    it('⛓ THE CONCEPT CHANGED THE PICTURE, NEVER THE LOGIC: the compiled rules.json is the control\'s, rule for rule', () => {
        expect(world.rulesJson.regions).toEqual(control.rulesJson.regions);
        expect(withoutSidecars(world.rulesJson)).toEqual(withoutSidecars(control.rulesJson));
    });

    it('the world\'s items carry the two concept items; its item library carries the table\'s colour', () => {
        const items = world.rulesJson.items['1'];
        for (const c of ['sword', 'swim']) {
            expect(items[CONCEPTS[c].item.id], c).toMatchObject({
                name: CONCEPTS[c].item.name, classification: CONCEPTS[c].item.classification,
            });
        }
        const lib = mergedItemLib(bundle(CONCEPT_LIST));
        expect(lib['Progressive Sword'].color).toBe(CONCEPTS.sword.item.color);
        expect(lib['Progressive Swim'].color).toBe(CONCEPTS.swim.item.color);
        // ⚠ FINDING, pinned: the colour does not travel into the region payload
        // (the sidecar serializer's base IS the merged library, so its itemLib
        // extras are empty) — play draws these pickups with the foreign hash.
        for (const s of Object.values(world.rulesJson.preset_sidecars['1'])) {
            expect(s.playable_payload.itemLib).toEqual({});
        }
    });
});
