/**
 * ⛓⛓⛓ CONCEPT LIBRARY T4, D1 — **THE TRIAL WORLD: ONE CONCEPT GATE PER SUBSTRATE,
 * AND THE CONTROL'S LOGIC.**
 *
 * `CONCEPT_TRIAL_STATE` (text-adventure START, seed 8, maze 2 + text adventure
 * 2, sword + swim + victory, `concepts: [sword, guardian, swim, water]`), built
 * headless through the panel's own assembly (`buildRunFromState` →
 * `runPresetHeadless`) beside its control — the same state with `concepts: []`.
 *
 * ⛓ Measured before this row was written (quotas maze 2 + text adventure 2,
 * 3 spheres, no filler). With a MAZE start (the brief's), seeds 1, 2 and 5
 * realise one gate in each substrate — but every such world puts a
 * text-adventure room behind a gate, whose gated BACK-exit its payload did not
 * record at T4, and `check-sidecar-fields` FAILed its rule agreement; 0 of 99
 * such worlds over 30 configurations passed. With a TEXT-ADVENTURE start, seeds
 * 1 and 7–12 realise one of each and seeds 8 and 9 passed; seed 8 is taken. The
 * compiled logic equals the control's at every seed. ⛓ Concept library T2c
 * closed the gap (the maze-start seed-1 world now passes —
 * `textAdventureBackExitGates.test.js`); this world is unchanged by it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

    it('builds with the plan-vs-world oracle clean, rooted in the text-adventure START region_2_2', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(world.rulesJson.regions['1'].Menu.exits[0].connected_region).toBe('region_2_2');
        expect(Object.fromEntries(Object.entries(sidecars).map(([r, s]) => [r, s.substrate]))).toEqual({
            region_2_2: 'text_adventure', region_2_3: 'maze', region_1_3: 'maze',
        });
    });

    it('every text-adventure exit the document gates is in the payload\'s exitGates (the census\'s rule agreement)', () => {
        const regions = world.rulesJson.regions['1'];
        for (const [rid, s] of Object.entries(sidecars).filter(([, sc]) => sc.substrate === 'text_adventure')) {
            for (const e of regions[rid].exits) {
                const ex = s.playable_payload.exits.find((x) => x.targetRegion === e.connected_region);
                expect(s.playable_payload.exitGates[ex.exit_id] ?? { rule: 'True_' }).toEqual(e.access_rule);
            }
        }
    });

    it('the maze region_2_3\'s one gate is the painted water_gate_0 over Has(Progressive Swim)', () => {
        const lib = sidecars.region_2_3.playable_payload.obstacleLib;
        expect(Object.keys(lib)).toEqual(['water_gate_0']);
        expect(lib.water_gate_0).toMatchObject({
            concept: 'water', placement: 'gate', clear_set_type: 'rule',
            clear_rule: { rule: 'Has', args: { item_name: CONCEPTS.swim.item.id } },
            color: MAZE_CONCEPT_REALISATIONS.water.art.color, symbol: MAZE_CONCEPT_REALISATIONS.water.art.symbol,
        });
        const ctrlLib = ctrl.rulesJson.preset_sidecars['1'].region_2_3.playable_payload.obstacleLib;
        expect(Object.keys(ctrlLib)).toEqual(['logic_gate_0']);
        expect(sidecars.region_1_3.playable_payload.obstacleLib).toEqual({});
    });

    it('the text-adventure START\'s sword-gated exit carries the GUARDIAN\'s prose, and the sword lies in that room', () => {
        const ta = sidecars.region_2_2.playable_payload;
        expect(ta.exitGates).toEqual({ exit: { rule: 'Has', args: { item_name: CONCEPTS.sword.item.id } } });
        const { blocked, passedWith } = TEXT_ADVENTURE_CONCEPT_REALISATIONS.guardian.placements.gate.mechanic.prose;
        expect(ta.prose.exits).toEqual({ exit: { inaccessibleMessage: blocked, moveMessage: passedWith } });
        expect(ta.locations).toEqual([{ name: 'region_2_2__loc_0', item: CONCEPTS.sword.item.id }]);
        expect(ctrl.rulesJson.preset_sidecars['1'].region_2_2.playable_payload.prose).toBeUndefined();
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

describe('T4 D2 — the committed concept_trial preset IS this world', async () => {
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const text = readFileSync(join(ROOT, 'frontend/presets/concept_trial/AP_1/AP_1_rules.json'), 'utf8');
    const committed = JSON.parse(text);
    const fresh = await runPresetHeadless(buildRunFromState(structuredClone(CONCEPT_TRIAL_STATE)));

    it('byte for byte a fresh build of CONCEPT_TRIAL_STATE (the producer\'s --check, in the suite)', () => {
        expect(text).toBe(JSON.stringify(fresh.rulesJson, null, 2));
    });

    it('names the concept items, records the concept list, and carries the painted gate and the prose', () => {
        expect(Object.keys(committed.items['1'])).toEqual(expect.arrayContaining(['Progressive Sword', 'Progressive Swim']));
        expect(committed.procgen_metadata['1'].concepts).toEqual(['sword', 'guardian', 'swim', 'water']);
        const sc = committed.preset_sidecars['1'];
        const maze = Object.values(sc).filter((s) => s.substrate === 'maze');
        const gates = maze.flatMap((s) => Object.values(s.playable_payload.obstacleLib ?? {})).filter((d) => d.concept);
        expect(gates.map((d) => [d.id, d.concept, d.color])).toEqual([['water_gate_0', 'water', '#2f6fd0']]);
        expect(maze.every((s) => s.playable_payload.itemLib['Progressive Swim']?.color === '#40b0c0')).toBe(true);
        const ta = Object.values(sc).filter((s) => s.substrate === 'text_adventure');
        expect(ta.map((s) => Object.keys(s.playable_payload.prose?.exits ?? {}))).toEqual([['exit']]);
    });
});
