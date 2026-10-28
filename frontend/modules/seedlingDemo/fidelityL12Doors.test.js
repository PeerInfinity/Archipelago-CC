/**
 * ⛓⛓⛓ SEEDLING FIDELITY L12DOORS — L12 → L83 through the stacked doors behind the 13 px gap (survey steps 172/203).
 *
 *   D1 `wandShotChaserBodies`    a WandShot in a room with a STEPPED chaser fires (L12's `puncher@416,256` no longer
 *                                refuses every shot in the room); the chaser's live box stops a shot that meets it
 *   D2 `fineFrontierHiddenDoor`  the 8 px frontier is asked when it names a door the 16 px one cannot see, nearer the aim
 *   D3 `fineWandStance`          a wand stance the 8 px lattice reaches (the strip under the doors, past the gap)
 *
 * The game witnesses (`fixtures/l12doors-witness/`, recorded on p4g headless by `probe-seedling-l12doors.mjs
 * --record`) are the solver's own plans; the model replays each at 0 px with its switches ON.
 */
import { describe, expect, it } from 'vitest';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    L12DOORS_SWITCHES, L12DOORS_WITNESSES, compareL12DoorsStreams, l12doorsFixture, l12doorsGameChecks, l12doorsModel,
    l12doorsPlan, l12doorsTape, unpackL12DoorsTick, verbsOf,
} from '../../../scripts/procgen/plan-seedling-l12doors-witness.mjs';

const W = Object.fromEntries(L12DOORS_WITNESSES.map((w) => [w.name, w]));
const OFF = Object.fromEntries(Object.keys(L12DOORS_SWITCHES).map((k) => [k, false]));
const DOOR_VERBS = ['wand(magicallock@32,864)', 'keylock(bosslock@32,864)', 'walk'];

/** The plan's verdict under a switch set: `{verbs, ticks}` or `{refusal}`. */
async function verdict(w, switches) {
    try {
        const { solved } = await l12doorsPlan(w, switches);
        return { verbs: verbsOf(solved), ticks: solved.out.perTick.length };
    } catch (e) {
        return { refusal: String(e.message) };
    }
}

describe('fidelity L12DOORS — the switches ship OFF', () => {
    it('all three default OFF', () => {
        for (const k of Object.keys(L12DOORS_SWITCHES)) expect(CONTACT_FIDELITY_DEFAULTS[k], k).toBe(false);
    });
});

describe('fidelity L12DOORS D1 — a wand shot in a room with a stepped chaser (`wandShotChaserBodies`)', () => {
    it('OFF: the solver under the doors refuses — the room guard names the puncher ~650 px away (G1, the base)', async () => {
        const r = await verdict(W['l12doors-under-locks'], OFF);
        expect(r.refusal).toMatch(/WandShot in level 12 would collide with 1 Enemy-typed bod\(ies\) this run cannot place: puncher@416,256/);
    }, 120000);

    it('ON: the shot opens magicallock@32,864 through the standing bosslock, the key line opens it, the walk is L83', async () => {
        const r = await verdict(W['l12doors-under-locks'], { ...OFF, wandShotChaserBodies: true });
        expect(r.verbs).toEqual(DOOR_VERBS);
        expect(r.ticks).toBe(114);
    }, 120000);

    it('ON under `noDamage`: no chaser is stepped, so it has no position and the room still refuses by name', async () => {
        const f = l12doorsFixture('l12doors-under-locks');
        const tape = parseTape(JSON.stringify(f.tape));
        await withContactFidelity({ wandShotChaserBodies: true }, () => {
            const run = createRunForStaging({ ...tape, noDamage: true, equips: tape.equips ?? [] }, atlasLevelSource());
            expect(() => {
                for (let i = 0; i < tape.tick_count; i += 1) {
                    run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
                }
            }).toThrow(/cannot place: puncher@416,256/);
        });
    });
});

describe('fidelity L12DOORS D2 + D3 — route step 172 from the L36 arrival', () => {
    const w = W['l12doors-arrival'];

    it('OFF: KEYLOCK-SEALED on bosslock@112,192 {12,11} (the base: the 16 px frontier never asks the 8 px one)', async () => {
        const r = await verdict(w, OFF);
        expect(r.refusal).toMatch(/SEALED BEHIND ITSELF/);
        expect(r.refusal).toMatch(/bosslock@112,192/);
    }, 300000);

    it('ON: SOLVED into L83 through the doors, never touching bosslock@112,192', async () => {
        const r = await verdict(w, L12DOORS_SWITCHES);
        expect(r.verbs).toEqual(DOOR_VERBS);
        expect(r.ticks).toBe(1301);
    }, 300000);

    it('every switch is needed: each one alone OFF refuses, by its own gap', async () => {
        const noD1 = await verdict(w, { ...L12DOORS_SWITCHES, wandShotChaserBodies: false });
        expect(noD1.refusal).toMatch(/cannot place: puncher@416,256/);
        const noD3 = await verdict(w, { ...L12DOORS_SWITCHES, fineWandStance: false });
        expect(noD3.refusal).toMatch(/no REACHABLE stance with a clear wand line at magicallock@32,864/);
        const noD2 = await verdict(w, { ...L12DOORS_SWITCHES, fineFrontierHiddenDoor: false });
        expect(noD2.refusal).toMatch(/SEALED BEHIND ITSELF/);
    }, 600000);
});

describe.each(L12DOORS_WITNESSES.map((x) => [x.name, x]))('fidelity L12DOORS — the game witness %s', (name, w) => {
    const f = l12doorsFixture(name);

    it('the committed recording is on p4g, the delivered set, and the game reached L83 through both doors', () => {
        expect(f.page).toBe('seedling_bot_ap_p4g');
        const ticks = f.ticks.map(unpackL12DoorsTick);
        for (const c of l12doorsGameChecks({ ticks, wrote: f.wrote, hits: f.hits })) expect(c.ok, c.name).toBe(true);
    });

    it('the recording\'s tape is the solver\'s plan today (switches ON)', async () => {
        expect(JSON.stringify(await l12doorsTape(w))).toBe(JSON.stringify(f.tape));
    }, 300000);

    it('the model (switches ON) reproduces the game at 0 px on every tick, hitless', async () => {
        const m = await l12doorsModel(f.tape, w.switches);
        expect(m.error).toBeNull();
        expect(compareL12DoorsStreams(f.ticks.map(unpackL12DoorsTick), m.ticks)).toEqual([]);
        expect(m.hits).toBe(f.hits);
        expect(m.magicalLocksOpened.map((l) => l.id)).toEqual(['magicallock@32,864']);
    });

    it('OFF the model refuses the shot (the D1 room guard)', async () => {
        const m = await l12doorsModel(f.tape, OFF);
        expect(m.error).toMatch(/cannot place: puncher@416,256/);
    });
});
