/**
 * ⛓⛓⛓ SEEDLING FIDELITY CORPSEBUMP — the bodies a pushable's glide and an ice-turret corpse's slide stop on, and the
 * corpse bumped onto a button as a weigh's holder (wave 29). Keys, all OFF:
 *   `blockSweepBodies`  the model (D1): the block's sweep asks every stepped chaser and every unremoved ice turret;
 *                       the corpse's slide stops on the spinners and the chasers; `runFire`'s refusals narrow to
 *                       what neither sweep consults.
 * The witnesses are recorded on the game (`fixtures/corpsebump-witness/`, p4g headless, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    CORPSEBUMP_D1_SWITCHES, CORPSEBUMP_WITNESS_DIR, compareCorpseBumpWitness, corpseBumpModelSamples, l4WedgeTape,
    unpackCorpseBumpSample,
} from './fidelityCorpseBump.js';
import { enemiesUnseenByBlockSweep } from './spinner.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const load = (name) => JSON.parse(readFileSync(join(CORPSEBUMP_WITNESS_DIR, `${name}.json`), 'utf8'));
const L4 = load('corpsebump-l4-bob-wedge');
const L4_GAME = L4.samples.map(unpackCorpseBumpSample);

describe('CORPSEBUMP — the switches', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_BLOCK_SWEEP_BODIES)(
        'blockSweepBodies ships OFF', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.blockSweepBodies).toBe(false);
            expect(CONTACT_FIDELITY.blockSweepBodies).toBe(false);
        });
});

describe('CORPSEBUMP D1 — a Bob stops a block\'s glide (L4, the game witness)', () => {
    it('the recorded tape is the one the module builds (r8-solve-4\'s boot, the wedge runs)', async () => {
        const tape = await l4WedgeTape();
        expect(tape.inputs).toEqual(L4.tape.inputs);
        expect(tape.boot).toEqual(L4.tape.boot);
    });

    it('the game stops pushableblock@32,64 at x 48.5 against bob@64,64, which is still alive', () => {
        const end = L4_GAME.at(-1);
        expect(end.blocks).toEqual([{ cls: 'PushableBlock', x: 48.5, y: 64 }]);
        expect(end.bodies.map((b) => b.cls)).toEqual(['Bob']);
    });

    it('ON, the model reproduces the game at 0 px on every sampled tick: the player, the block, the Bob', async () => {
        const model = await corpseBumpModelSamples(L4.tape, CORPSEBUMP_D1_SWITCHES);
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(L4_GAME, model.samples)).toEqual([]);
    });

    it('OFF (the control), the model glides the block through the Bob: it parts from the game at t79', async () => {
        const model = await corpseBumpModelSamples(L4.tape, { blockSweepBodies: false });
        const bad = compareCorpseBumpWitness(L4_GAME, model.samples);
        expect(bad[0]).toBe('t 79: blocks game [PushableBlock@48.5,64] model [PushableBlock@49,64]');
    });
});

describe('CORPSEBUMP D1 — runFire\'s enemy-room refusal narrows to the bodies the sweeps do not consult', () => {
    // L40 with the bodies stepped (prox-l40-turret-volley's staging: damage on, so the chasers have positions).
    const tape = parseTape(readFileSync(join(CORPSEBUMP_WITNESS_DIR, '..', 'tapes', 'prox-l40-turret-volley.json'),
        'utf8'));
    const unseen = (on, mover) => withContactFidelity({ blockSweepBodies: on }, () => {
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        const enemies = run.world.combat.enemies.filter((e) => !e.removed);
        return enemiesUnseenByBlockSweep(enemies, { seenIds: run.blockSweepBodyIds(mover) });
    });

    it('OFF: L40\'s block sweep sees only the spinners — five classes are unseen, and runFire refuses', () => {
        expect(unseen(false, 'block')).toEqual(['IceTurret', 'Bob', 'BombPusher', 'BobSoldier', 'Puncher']);
    });

    it('ON: the block sweep consults every body in L40 (the chasers, the turret, the static BombPusher)', () => {
        expect(unseen(true, 'block')).toEqual([]);
    });

    it('ON: the corpse\'s sweep consults the chasers and the BombPusher (the turret is the corpse itself)', () => {
        expect(unseen(true, 'corpse')).toEqual(['IceTurret']);
    });

    it('a body the run does not step (noDamage) is NOT seen by id: the refusal stands for it', () => {
        const nd = parseTape(JSON.stringify({ ...JSON.parse(JSON.stringify(tape)), noDamage: true }));
        const ids = withContactFidelity({ blockSweepBodies: true }, () => createRunForStaging(stagingFromTape(nd),
            atlasLevelSource()).blockSweepBodyIds('block'));
        expect([...ids].some((id) => id.startsWith('bob@'))).toBe(false);
        expect(ids.has('iceturret@472,400')).toBe(true);
    });
});
