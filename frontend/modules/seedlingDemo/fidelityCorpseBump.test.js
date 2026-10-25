/**
 * ⛓⛓⛓ SEEDLING FIDELITY CORPSEBUMP — the bodies a pushable's glide and an ice-turret corpse's slide stop on, and the
 * corpse bumped onto a button as a weigh's holder (wave 29). Keys, all OFF:
 *   `blockSweepBodies`  the model (D1): the block's sweep asks every stepped chaser and every unremoved ice turret;
 *                       the corpse's slide stops on the spinners and the chasers; `runFire`'s refusals narrow to
 *                       what neither sweep consults.
 *   `corpseBumpWeigh`   the solver (D2): an ice turret's corpse is a weigh's holder — killed, bumped onto the button
 *                       by Fire, the fade waited out (`solverBot.deriveCorpseWeigh` / `execCorpseWeigh`).
 * The witnesses are recorded on the game (`fixtures/corpsebump-witness/`, p4g headless, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    CORPSEBUMP_D1_SWITCHES, CORPSEBUMP_D2_SWITCHES, CORPSEBUMP_WITNESS_DIR, compareCorpseBumpWitness,
    corpseBumpModelSamples, l40HolderTape, l40PocketBootTape, l40PocketTail, l4WedgeTape, unpackCorpseBumpSample,
} from './fidelityCorpseBump.js';
import { createTapeStepper } from './tapeRunner.js';
import { staticEnemyDanger } from './dangerMap.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { enemiesUnseenByBlockSweep } from './spinner.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const load = (name) => JSON.parse(readFileSync(join(CORPSEBUMP_WITNESS_DIR, `${name}.json`), 'utf8'));
const L4 = load('corpsebump-l4-bob-wedge');
const L4_GAME = L4.samples.map(unpackCorpseBumpSample);

describe('CORPSEBUMP — the switches', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_BLOCK_SWEEP_BODIES)(
        'blockSweepBodies ships ON (⚖ user 2026-10-24, planning-12\'s flip)', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.blockSweepBodies).toBe(true);
            expect(CONTACT_FIDELITY.blockSweepBodies).toBe(true);
        });
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_CORPSE_BUMP_WEIGH)(
        'corpseBumpWeigh ships ON (⚖ user 2026-10-24, planning-12\'s flip)', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.corpseBumpWeigh).toBe(true);
            expect(CONTACT_FIDELITY.corpseBumpWeigh).toBe(true);
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

const L40 = load('corpsebump-l40-t2-holder');
const L40_GAME = L40.samples.map(unpackCorpseBumpSample);

describe('CORPSEBUMP D2/D3 — the ice turret\'s corpse is L40\'s t2 holder (the solver\'s plan, the game witness)', () => {
    it('OFF: the pocket\'s pit goal refuses as before — the t2 lock\'s hold stance is the button, behind the turret', async () => {
        const r = await l40PocketTail(await l40PocketBootTape(), { ...CORPSEBUMP_D2_SWITCHES, corpseBumpWeigh: false });
        expect(r.out).toBeNull();
        expect(r.refusal.message).toMatch(/hold stance \(wandlock@448,432\): the combat ladder is EXHAUSTED/);
    });

    it('ON: the solver kills the turret, bumps its corpse north twice onto button@480,384, waits the fade, reaches the pit',
        async () => {
            const r = await l40PocketTail(await l40PocketBootTape());
            expect(r.refusal).toBeNull();
            const w = r.out.records.find((x) => x.strategy === 'weigh');
            expect(w.corpse.turret).toBe('iceturret@472,400');
            expect(w.corpse.kill).toMatchObject({ side: 'up', corpseOnly: true });
            expect(w.corpse.presses.map((p) => [p.stance, p.rest])).toEqual([
                [{ x: 488, y: 440 }, { tx: 30, ty: 25 }], [{ x: 488, y: 424 }, { tx: 30, ty: 24 }]]);
            expect(r.out.records.at(-1)).toMatchObject({ goal: 'reach-pit', to: 43 });
        });

    it('the recorded tape is the solver\'s plan, input for input', async () => {
        const tape = await l40HolderTape();
        expect(tape.inputs).toEqual(L40.tape.inputs);
        expect(tape.tick_count).toBe(L40.tape.tick_count);
    });

    it('ON, the model reproduces the game at 0 px on every tick: the player, the corpse, every chaser', async () => {
        const model = await corpseBumpModelSamples(L40.tape, CORPSEBUMP_D2_SWITCHES);
        expect(model.error).toBeNull();
        expect(compareCorpseBumpWitness(L40_GAME, model.samples)).toEqual([]);
    });

    it('the game\'s corpse rests on (30,24) from the second bump on, and the player leaves by the pit into L43', () => {
        const onT2 = L40_GAME.filter((g) => g.level === 40 && g.bodies.some((b) => b.cls === 'IceTurret' && b.y < 400));
        expect(onT2[0].t).toBe(215);
        expect(L40_GAME.at(-1).level).toBe(43);
    });

    it('`corpseBumpWeigh` is a SOLVER key: with it OFF (the rest ON) the model still replays the recording at 0 px', async () => {
        const model = await corpseBumpModelSamples(L40.tape, { ...CORPSEBUMP_D2_SWITCHES, corpseBumpWeigh: false });
        expect(compareCorpseBumpWitness(L40_GAME, model.samples)).toEqual([]);
    });

    it('it needs `blockSweepBodies` ON (the bump arm\'s enemy-room refusal): OFF, the corpse source is not raised', async () => {
        const r = await l40PocketTail(await l40PocketBootTape(), { ...CORPSEBUMP_D2_SWITCHES, blockSweepBodies: false });
        expect(r.refusal.message).toMatch(/hold stance \(wandlock@448,432\)/);
    });

    // ⛓ control since planning-13's flip: `turretCircleKill` ON circles the turret and SOLVES this goal (the ON truth is
    // fidelityTurretCircle.test.js's 'ON: SOLVED' row); the standing kill alone still refuses. `iceTurretDeathAnim` is
    // pinned OFF too: ON, a death stops the volley, so a standing kill CAN be hitless, and the weigh then refuses later,
    // at the corpse glide's self-check (measured at the flip; residue).
    it('with the Sword alone (no Ghost Sword) the STANDING kill is never hitless, and the weigh refuses by name (turretCircleKill, iceTurretDeathAnim OFF)', async () => {
        const sw = JSON.parse(readFileSync(join(CORPSEBUMP_WITNESS_DIR, '..', 'tapes', 'prox-l40-turret-volley.json'),
            'utf8'));
        const r = await l40PocketTail({ ...sw, tick_count: 0, inputs: [] }, { ...CORPSEBUMP_D2_SWITCHES, turretCircleKill: false,
            iceTurretDeathAnim: false });
        expect(r.refusal.message).toMatch(/no start delay 0 … 100 kills iceturret@472,400 from the up side .* without a hit/);
    });

    it('the danger map: a DEAD turret is not priced at its placement with the key ON (OFF: it is)', async () => {
        const at = (on) => withContactFidelity({ ...CORPSEBUMP_D2_SWITCHES, corpseBumpWeigh: on }, () => {
            let run = null;
            const st = createTapeStepper(parseTape(JSON.stringify(L40.tape)), { levelSource: atlasLevelSource(),
                onTick: (t, s, h, rn) => { run = rn; } });
            let r = st.next();
            while (!r.done && r.value.observation.t < 150) r = st.next();
            expect(run.entities('turrets').get('iceturret@472,400').dead).toBe(true);
            return staticEnemyDanger(run, playerBoxAt(488, 424)).map((d) => d.id);
        });
        expect(at(false)).toContain('iceturret@472,400');
        expect(at(true)).not.toContain('iceturret@472,400');
    });
});
