/**
 * ⛓⛓⛓ SEEDLING FIDELITY TURRETCIRCLE — L40's ice turret killed with the plain Sword WITHOUT a hit, by circling it
 * (⚖ the user, 2026-10-24: "keep moving while attacking. Keep circling around the turret."). Keys, all OFF:
 *   `iceBlastShield`      the model (D1): an `IceTurretBlast` stops on the player's shield entity (`hitables`).
 *   `turretCircleKill`    the solver (D2): `killForCorpse` with the Sword alone kills on the move
 *                         (`killIceTurretInPlace`'s `circle` option, `solverBot.circleKillIceTurret`).
 *   `iceTurretDeathAnim`  the model (D3): the corpse's `play("dead")` stops a `startshot` in progress.
 * The witnesses are recorded on the game (`fixtures/turretcircle-witness/`, p4g headless, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS } from './contactFidelity.js';
import {
    L40_CIRCLE_RUNS, TURRETCIRCLE_D1_SWITCHES, TURRETCIRCLE_D3_SWITCHES, TURRETCIRCLE_WITNESS_DIR,
    compareTurretCircleWitness, l40CircleTape, l40PocketBoot, l40ShieldNearTape, l40ShieldStandTape,
    l40SwordHolderTape, turretCircleModelSamples, unpackTurretCircleSample,
} from './fidelityTurretCircle.js';
import { CORPSEBUMP_D2_SWITCHES, CORPSEBUMP_WITNESS_DIR, l40PocketBootTape, l40PocketTail } from './fidelityCorpseBump.js';
import { circleKillIceTurret } from './solverBot.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const load = (name) => JSON.parse(readFileSync(join(TURRETCIRCLE_WITNESS_DIR, `${name}.json`), 'utf8'));
const W = Object.fromEntries(['turretcircle-l40-sword-circle', 'turretcircle-l40-shield-stand',
    'turretcircle-l40-shield-near', 'turretcircle-l40-t2-holder-sword'].map((n) => {
    const w = load(n);
    return [n, { ...w, game: w.samples.map(unpackTurretCircleSample) }];
}));
const OFF = { iceBlastShield: false, turretCircleKill: false, iceTurretDeathAnim: false };

describe('TURRETCIRCLE — the switches', () => {
    for (const [k, env] of [['iceBlastShield', 'SEEDLING_ICE_BLAST_SHIELD'],
        ['turretCircleKill', 'SEEDLING_TURRET_CIRCLE_KILL'], ['iceTurretDeathAnim', 'SEEDLING_ICE_TURRET_DEATH_ANIM']]) {
        // ⛓ planning-13's flip: the three shipped OFF, now ON by default.
        it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env[env])(`${k} ships ON`, () => {
            expect(CONTACT_FIDELITY_DEFAULTS[k]).toBe(true);
            expect(CONTACT_FIDELITY[k]).toBe(true);
        });
    }
});

describe('TURRETCIRCLE D1 — circling beats the aim; a blast stops on the shield (L40, the game witnesses)', () => {
    it('every recording is p4g\'s, and its tape is the one the module builds', async () => {
        for (const [n, build] of [['turretcircle-l40-sword-circle', l40CircleTape],
            ['turretcircle-l40-shield-stand', l40ShieldStandTape], ['turretcircle-l40-shield-near', l40ShieldNearTape]]) {
            const tape = await build();
            expect(W[n].page).toBe('seedling_bot_ap_p4g');
            expect(tape.inputs).toEqual(W[n].tape.inputs);
            expect(tape.seam).toEqual(W[n].tape.seam);
        }
        expect(L40_CIRCLE_RUNS.reduce((a, [, n]) => a + n, 0)).toBe(140);
    });

    it('the game: circling with the Sword (no shield) kills the turret on t79 and is never hit', () => {
        const g = W['turretcircle-l40-sword-circle'].game;
        expect(W['turretcircle-l40-sword-circle'].tape.seam.items).toMatchObject({ hasSword: true,
            hasGhostSword: false, hasShield: false });
        expect(g.find((s) => s.turret?.dead).t).toBe(79);
        expect(g.every((s) => s.hits === 0)).toBe(true);
    });

    it('the game: standing with the shield at y 447.6 is never hit; at y 443.5 once, on t97', () => {
        expect(W['turretcircle-l40-shield-stand'].game.every((s) => s.hits === 0)).toBe(true);
        const near = W['turretcircle-l40-shield-near'].game;
        expect(near.find((s) => s.hits > 0).t).toBe(97);
        expect(near.at(-1).hits).toBe(1);
    });

    for (const n of ['turretcircle-l40-sword-circle', 'turretcircle-l40-shield-stand', 'turretcircle-l40-shield-near']) {
        it(`${n}: ON, the model reproduces the game at 0 px — player, hits, freeze, turret, blasts`, async () => {
            const model = await turretCircleModelSamples(W[n].tape, TURRETCIRCLE_D1_SWITCHES);
            expect(model.error).toBeNull();
            expect(compareTurretCircleWitness(W[n].game, model.samples)).toEqual([]);
        }, 60000);
    }

    it('OFF: the circle needs no key (0 px), and both shield stands part on the first volley (t52 / t51)', async () => {
        const circle = await turretCircleModelSamples(W['turretcircle-l40-sword-circle'].tape, OFF);
        expect(compareTurretCircleWitness(W['turretcircle-l40-sword-circle'].game, circle.samples)).toEqual([]);
        for (const [n, t] of [['turretcircle-l40-shield-stand', 52], ['turretcircle-l40-shield-near', 51]]) {
            const m = await turretCircleModelSamples(W[n].tape, OFF);
            expect(compareTurretCircleWitness(W[n].game, m.samples)[0]).toMatch(new RegExp(`^t ${t}: blasts`));
        }
    }, 60000);
});

describe('TURRETCIRCLE D2 — the solver kills on the move with the Sword alone', () => {
    const swordBoot = () => l40PocketBoot({});

    it('OFF (CORPSEBUMP\'s set): the Sword alone refuses by name, as CORPSEBUMP left it', async () => {
        // ⛓ planning-13's flip: `iceTurretDeathAnim` pinned OFF too (CORPSEBUMP's set) — ON, a standing kill can be
        // hitless and the weigh refuses later, at the corpse glide's self-check.
        const r = await l40PocketTail(await swordBoot(), { ...CORPSEBUMP_D2_SWITCHES, turretCircleKill: false,
            iceTurretDeathAnim: false });
        expect(r.refusal.message).toMatch(/no start delay 0 … 100 kills iceturret@472,400 from the up side .* without a hit/);
    }, 120000);

    it('ON: SOLVED — the corpse weigh\'s kill is a circling one (cw from corner 3, delay 0, three swings)', async () => {
        const r = await l40PocketTail(await swordBoot(), TURRETCIRCLE_D3_SWITCHES);
        expect(r.refusal).toBeNull();
        const kill = r.out.records[0].corpse.kill;
        expect(kill).toMatchObject({ phase: 'turret-kill', target: 'iceturret@472,400', circle: { cw: true, start: 3 },
            presses: 3, delay: 0, corpseOnly: true });
        expect(r.out.records.at(-1)).toMatchObject({ goal: 'reach-pit', to: 43 });
    }, 120000);

    it('the Ghost Sword keeps CORPSEBUMP\'s standing kill: its recorded plan is unchanged with the key ON', async () => {
        const L40 = JSON.parse(readFileSync(join(CORPSEBUMP_WITNESS_DIR, 'corpsebump-l40-t2-holder.json'), 'utf8'));
        const r = await l40PocketTail(await l40PocketBootTape(), { ...CORPSEBUMP_D2_SWITCHES, turretCircleKill: true });
        expect(r.out.records[0].corpse.kill.circle).toBeUndefined();
        expect(r.out.perTick.length).toBe(L40.tape.tick_count);
    }, 120000);

    it('no ring ⇒ refused by name: L98\'s turret sits against its walls', () => {
        const w = JSON.parse(readFileSync(join(TURRETCIRCLE_WITNESS_DIR, '..', 'killlock-witness', 'killlock-l98-turret.json'),
            'utf8'));
        const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify({ ...w.tape, tick_count: 0, inputs: [] }))),
            atlasLevelSource());
        expect(() => circleKillIceTurret(run, [], 'iceturret@104,24', { circle: { cw: true, start: 0 } },
            { what: 'ring', goal: null })).toThrow(/no circling loop around iceturret@104,24: \(100\.0,17\.5\) on its clockwise ring/);
    });
});

describe('TURRETCIRCLE D3 — the solver\'s own Sword-only t2 holder on L40 (the game witness)', () => {
    const w = W['turretcircle-l40-t2-holder-sword'];

    it('the recorded tape is the solver\'s plan, input for input', async () => {
        const tape = await l40SwordHolderTape();
        expect(tape.inputs).toEqual(w.tape.inputs);
        expect(tape.tick_count).toBe(518);
    }, 120000);

    it('ON, the model reproduces the game at 0 px on all 518 ticks', async () => {
        const model = await turretCircleModelSamples(w.tape, TURRETCIRCLE_D3_SWITCHES);
        expect(model.error).toBeNull();
        expect(compareTurretCircleWitness(w.game, model.samples)).toEqual([]);
    }, 60000);

    it('the game: never hit, the corpse on button@480,384 from t289, the player into L43', () => {
        expect(w.game.every((s) => s.hits === 0)).toBe(true);
        expect(w.game.find((s) => s.level === 40 && s.turret?.dead && s.turret.y < 400).t).toBe(289);
        expect(w.game.at(-1).level).toBe(43);
    });

    it('`iceTurretDeathAnim` OFF: the model fires a volley from the corpse (t77) that the game never does', async () => {
        const model = await turretCircleModelSamples(w.tape, { ...TURRETCIRCLE_D3_SWITCHES, iceTurretDeathAnim: false });
        expect(compareTurretCircleWitness(w.game, model.samples)[0]).toMatch(/^t 77: blasts game \[\] model \[/);
    }, 60000);
});
