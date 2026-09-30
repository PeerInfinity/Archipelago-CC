/**
 * ⛓⛓⛓ CONCEPT LIBRARY T4, D1 — **THE TRIAL WORLD: ONE CONCEPT GATE PER SUBSTRATE,
 * AND THE CONTROL'S LOGIC.**
 *
 * `CONCEPT_TRIAL_STATE` (maze START, maze 2 + text adventure 2, sword + swim +
 * victory, `concepts: [sword, guardian, swim, water]`), built headless through
 * the panel's own assembly (`buildRunFromState` → `runPresetHeadless`) beside
 * its control — the same state with `concepts: []`.
 *
 * ⛓ Measured over seeds 1–6 before this row was written (quotas maze 2 + text
 * adventure 2, 3 spheres): seeds 1, 2 and 5 realise one gate in EACH substrate
 * (the maze START's `water_gate_0`, a text-adventure room's guardian prose);
 * seeds 3, 4 and 6 put both gates on the maze START (`water_gate_0`,
 * `guardian_gate_1`) and no text-adventure exit carries prose. Seed 1 is the
 * first of the three, so the state takes it. The compiled logic equals the
 * control's at every seed.
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { CONCEPT_TRIAL_STATE } from './presetDefs.js';
import { buildRunFromState, runPresetHeadless, mergedItemLib } from './presetRun.js';
import { CONCEPTS, isConceptRow } from '../procgenCore/concepts.js';
import { MAZE_CONCEPT_REALISATIONS } from '../mazeRoom/mazeConcepts.js';
import { TEXT_ADVENTURE_CONCEPT_REALISATIONS } from '../textAdventureSubstrateWrapper/textAdventureConceptRealisations.js';

const control = { ...CONCEPT_TRIAL_STATE, params: { ...CONCEPT_TRIAL_STATE.params, concepts: [] } };
/** The document minus its sidecars and minus the recorded concept list (T0b D3's one metadata difference). */
const logicOf = ({ preset_sidecars: _s, ...rest }) => {
    const out = structuredClone(rest);
    for (const block of Object.values(out.procgen_metadata ?? {})) delete block.concepts;
    return out;
};

describe('T4 D1 — the concept trial world', async () => {
    const world = await runPresetHeadless(buildRunFromState(structuredClone(CONCEPT_TRIAL_STATE)));
    const ctrl = await runPresetHeadless(buildRunFromState(control));
    const sidecars = world.rulesJson.preset_sidecars['1'];

    it('builds with the plan-vs-world oracle clean, rooted in the maze START region_2_2', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(world.rulesJson.regions['1'].Menu.exits[0].connected_region).toBe('region_2_2');
        expect(Object.fromEntries(Object.entries(sidecars).map(([r, s]) => [r, s.substrate]))).toEqual({
            region_2_2: 'maze', region_2_3: 'text_adventure', region_3_3: 'text_adventure',
        });
    });

    it('the maze START\'s one gate is the painted water_gate_0 over Has(Progressive Swim)', () => {
        const lib = sidecars.region_2_2.playable_payload.obstacleLib;
        expect(Object.keys(lib)).toEqual(['water_gate_0']);
        expect(lib.water_gate_0).toMatchObject({
            concept: 'water', placement: 'gate', clear_set_type: 'rule',
            clear_rule: { rule: 'Has', args: { item_name: CONCEPTS.swim.item.id } },
            color: MAZE_CONCEPT_REALISATIONS.water.art.color, symbol: MAZE_CONCEPT_REALISATIONS.water.art.symbol,
        });
        const ctrlLib = ctrl.rulesJson.preset_sidecars['1'].region_2_2.playable_payload.obstacleLib;
        expect(Object.keys(ctrlLib)).toEqual(['logic_gate_0']);
    });

    it('the text-adventure room region_2_3\'s sword-gated exit carries the GUARDIAN\'s prose; no other exit does', () => {
        const ta = sidecars.region_2_3.playable_payload;
        expect(ta.exitGates).toEqual({ exit: { rule: 'Has', args: { item_name: CONCEPTS.sword.item.id } } });
        const { blocked, passedWith } = TEXT_ADVENTURE_CONCEPT_REALISATIONS.guardian.placements.gate.mechanic.prose;
        expect(ta.prose.exits).toEqual({ exit: { inaccessibleMessage: blocked, moveMessage: passedWith } });
        expect(sidecars.region_3_3.playable_payload.prose).toBeUndefined();
        expect(ctrl.rulesJson.preset_sidecars['1'].region_2_3.playable_payload.prose).toBeUndefined();
    });

    it('the compiled logic is the control\'s; the one metadata difference is the recorded concept list', () => {
        expect(logicOf(world.rulesJson)).toEqual(logicOf(ctrl.rulesJson));
        expect(world.rulesJson.procgen_metadata['1'].concepts).toEqual(['sword', 'guardian', 'swim', 'water']);
        expect(ctrl.rulesJson.procgen_metadata['1']).not.toHaveProperty('concepts');
    });

    it('the world\'s item library declares its concept items as marked table rows (the slow row\'s "no library declares" read)', () => {
        const lib = mergedItemLib(CONCEPT_TRIAL_STATE);
        for (const cid of ['sword', 'swim']) {
            const row = lib[CONCEPTS[cid].item.id];
            expect(isConceptRow(row)).toBe(true);
            expect(row.concept).toBe(cid);
        }
        expect(lib['Progressive Sword'].color).toBe('#c0a040');
        expect(lib['Progressive Swim'].color).toBe('#40b0c0');
    });
});
