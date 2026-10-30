/**
 * seedling-fidelity-secuse W0 — THE X+C TICK, ON THE GAME AND IN THE MODEL (`CONTACT_FIDELITY.secondaryUse`).
 *
 * `Player.input()` ends `if (Input.pressed(keys[4])) useItem(Main.primary); if (Input.pressed(keys[5]))
 * useItem(Main.secondary);` (`Player.as:1561-1568`): X and C on one tick are two `useItem` calls in one frame, primary
 * first, both before the frame's move. The verbs' setters exclude each other (`set slashing` / `spearing` / `wanding` /
 * `firing` each need the others off), so for two DIFFERENT verbs the second call is refused by the first's flag and the
 * tick is the first verb's. But two SWORD calls are not excluded: the first starts the slash (`slashTimer =
 * slashTimerMax`), and the second finds `slashTimer > 0 && !slashDashed` and DASHES (`knockback(2, …)`) — a slash-dash
 * on the press's own frame, which neither X nor C alone can reach. A fresh game's `Main.secondary` is slot 0, the
 * same slot as `Main.primary`, so that is the common case.
 *
 * The witness (`fixtures/secondary-use-witness/secuse-l73-622-xc.json`, p4g headless,
 * `probe-seedling-secondary-use.mjs --record`) is leg 622 — L73, the arrival from L74, `lavarunner@72,24` diagonally
 * adjacent, the FORCEDHIT slice's proven forced hit — with `up` held and t0 pressing nothing, X, C or X+C:
 *   · none / X / C: the lavarunner bills the hit at t2, and the walk crosses to L74 at t4 with it;
 *   · X+C (both slots the Sword): vy −2.8 at t1 (−0.8 of walk + the 2 px dash), NO hit, and the crossing at t4 is
 *     HITLESS — so the forced-hit proof's "every input over 36 held sets is hit by t2" is FALSE on the game;
 *   · secondary = slot 1 (Fire): C and X+C read exactly as none and X (the slash's flag refuses the fire).
 *
 * The model at the defaults (`secondaryUse` OFF) reads C as nothing and X+C as X, so it reproduces every arm but the
 * sword X+C one — the OFF proof's soundness gap, named here. ON, it refused X+C by name until the C4 arm, so the
 * proof was left open. ⛓ js's C4 arm (seedling-js-xc-model) models the X+C tick as `useItem(primary)` then
 * `useItem(secondary)` through the setters' exclusions; the rows marked C4 below are its acceptance rows.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { inventorySlotsFor, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { proveForcedHit } from './forcedHit.js';
import { xcSecondCallAdmitted } from './levelRun.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'secondary-use-witness', 'secuse-l73-622-xc.json'), 'utf8'));
const W622 = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'leash-l73-622-up-lavarunner.json'), 'utf8'));
const levelSource = atlasLevelSource();

/** The keys held at tick `t` of a tape's `inputs`. */
const heldAt = (inputs, t) => new Set(inputs.filter((i) => i.from <= t && t < i.to).map((i) => i.key));

/** The model's player after each tick of an arm (index 0 = boot), as the witness samples the game. */
function modelRows(arm, ticks = W.tick_count) {
    const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(arm.tape))), levelSource);
    const hitsIn = () => (run.ledger('playerHits') ?? []).filter((h) => h.level === run.level).length;
    const rows = [{ t: 0, level: run.level, x: run.state.x, y: run.state.y, hits: 0 }];
    for (let t = 0; t < ticks; t += 1) {
        run.advance(heldAt(arm.inputs, t));
        rows.push({ t: t + 1, level: run.level, x: run.state.x, y: run.state.y, hits: hitsIn() });
    }
    return rows;
}
const gameRows = (name, ticks = W.tick_count) => W.arms[name].samples.filter((s) => s.t <= ticks)
    .map((s) => ({ t: s.t, level: s.level, x: s.x, y: s.y, hits: s.hits }));

describe('SECUSE W0 — the game witness', () => {
    it('is the GAME\'s (p4g), recorded by the instrument, six arms over 6 ticks', () => {
        expect(W).toMatchObject({ page: 'seedling_bot_ap_p4g', base: 'forcedhit-l73-622-plan', tick_count: 6,
            recordedBy: 'scripts/procgen/probe-seedling-secondary-use.mjs --record' });
        expect(Object.keys(W.arms)).toEqual(['none', 'X', 'C', 'XC', 'C-fire', 'XC-fire']);
        for (const a of Object.values(W.arms)) expect(a.samples.map((s) => s.t)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    it('none, X and C: the lavarunner bills the hit at t2, and the walk crosses to L74 at t4', () => {
        for (const name of ['none', 'X', 'C', 'C-fire', 'XC-fire']) {
            expect(W.arms[name].samples.map((s) => s.hits)).toEqual([0, 0, 1, 1, 0, 0, 0]);
            expect(W.arms[name].samples.map((s) => s.level)).toEqual([73, 73, 73, 73, 74, 74, 74]);
        }
    });
    it('X+C with both slots the Sword: a same-frame slash-dash (vy −2.8 at t1), and the crossing is HITLESS', () => {
        const s = W.arms.XC.samples;
        expect(s[1]).toMatchObject({ x: 72, y: 21.2, vy: -2.8 });
        expect(W.arms.X.samples[1]).toMatchObject({ x: 72, y: 23.2, vy: -0.8 });
        expect(s.map((r) => r.hits)).toEqual([0, 0, 0, 0, 0, 0, 0]);
        expect(s.map((r) => r.level)).toEqual([73, 73, 73, 73, 74, 74, 74]);
    });
    it('X+C with the secondary on Fire is X, sample for sample (the slash\'s flag refuses the fire)', () => {
        expect(W.arms['XC-fire'].samples).toEqual(W.arms.X.samples);
        expect(W.arms['C-fire'].samples).toEqual(W.arms.none.samples);
    });
});

describe('SECUSE W0 — the model against the witness', () => {
    it('OFF (C read by nothing): none, X, C and both Fire arms are the game\'s at every sample (0 px)', () => {
        withContactFidelity({ secondaryUse: false }, () => {
            for (const name of ['none', 'X', 'C', 'C-fire', 'XC-fire']) expect(modelRows(W.arms[name])).toEqual(gameRows(name));
        });
    });
    it('OFF: the sword X+C arm is NOT the game\'s — the model reads it as X, and bills the hit the game does not', () => {
        withContactFidelity({ secondaryUse: false }, () => {
            const m = modelRows(W.arms.XC);
            expect(m).toEqual(gameRows('X'));
            expect(m[2].hits).toBe(1);
            expect(W.arms.XC.samples[2].hits).toBe(0);
        });
    });
    it('ON: C on the Sword slot is the game\'s at every sample; C on the Fire slot is, up to the door (0 px)', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            expect(modelRows(W.arms.C)).toEqual(gameRows('C'));
            expect(modelRows(W.arms['C-fire'], 3)).toEqual(gameRows('C-fire', 3));
        });
    });
    it('ON, a RESIDUE (not this slice\'s): the t0 fire window rides the L73→L74 teleport and its t5 hit tick is refused on '
        + 'L74\'s arrival freeze, where the game walks on (a new world\'s Player has no fire window)', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            expect(() => modelRows(W.arms['C-fire'])).toThrow(/a fire window's hit tick 5 falls on a FROZEN tick/);
        });
        expect(W.arms['C-fire'].samples.slice(4).map((s) => s.level)).toEqual([74, 74, 74]);
    });
    it('ON (C4, seedling-js-xc-model): both X+C arms are the game\'s at every sample — the sword one a same-frame '
        + 'slash-dash that crosses HITLESS, the Fire one X (0 px)', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            for (const name of ['XC', 'XC-fire']) expect(modelRows(W.arms[name])).toEqual(gameRows(name));
        });
    });
    it('ON (C4): the X+C velocities are the game\'s too, and the sword X+C tick is ONE slash then ONE dash, at t0', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            for (const name of ['XC', 'XC-fire']) {
                const arm = W.arms[name];
                const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(arm.tape))), levelSource);
                for (let t = 0; t < W.tick_count; t += 1) {
                    run.advance(heldAt(arm.inputs, t));
                    const g = arm.samples[t + 1];
                    expect({ vx: run.state.vx, vy: run.state.vy }).toEqual({ vx: g.vx, vy: g.vy });
                }
                expect(run.slashPresses.map((d) => [d.t, d.outcome])).toEqual(name === 'XC'
                    ? [[0, 'slash'], [0, 'dash']] : [[0, 'slash']]);
            }
        });
    });
});

describe('SECUSE D1 — the forced-hit proof at leg 622 (STOP: X+C escapes the hit on the game)', () => {
    const fork622 = () => createRunForStaging(stagingFromTape(parseTape(JSON.stringify(W622.tape))), levelSource);
    const both = (over) => withContactFidelity({ forcedHitWitnessFirst: false, ...over }, () => proveForcedHit(fork622));
    it('the fork stands where the witness does: both slots are slot 0, the Sword', () => {
        const r = fork622();
        expect({ primary: r.primary, secondary: r.secondary, weapon: r.primaryWeapon }).toEqual({ primary: 0, secondary: 0,
            weapon: 'sword' });
        expect(r.state).toMatchObject({ x: W.arms.XC.samples[0].x, y: W.arms.XC.samples[0].y });
    });
    it('OFF: "proven" at depth 2 over 36 held sets — a verdict the game refutes (its X+C+up crossing is hitless)', () => {
        expect(both({ secondaryUse: false })).toMatchObject({ proven: true, depth: 2, nodes: 1332, minHits: 1 });
    });
    it('ON (C4 modelled): the proof is no longer refused — it finds the game\'s hitless [up+primary+secondary] '
        + 'and stays OPEN on it (the hitless-leaf crossing is fidelity\'s follow-up)', () => {
        const before = CONTACT_FIDELITY.secondaryUse;
        const p = both({ secondaryUse: true });
        expect(p).toMatchObject({ proven: false, hitless: 'up+primary+secondary ·' });
        expect(p.unmodelled).toBeUndefined();
        expect(CONTACT_FIDELITY.secondaryUse).toBe(before);
    });
});

describe('C4 (seedling-js-xc-model) — the X+C tick\'s exclusions, each transcribed from `Player.as`', () => {
    /** The XC witness's tape re-staged with other slots / items, only X+C on t0, stepped 3 ticks (short of the door). */
    function xcRun(primary, secondary, items = {}) {
        const base = W.arms.XC.tape;
        const inputs = [{ key: 'primary', from: 0, to: 1 }, { key: 'secondary', from: 0, to: 1 }];
        const tape = { ...base, tick_count: 3, inputs,
            seam: { ...base.seam, primary, secondary, items: { ...base.seam.items, ...items } } };
        const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(tape))), levelSource);
        for (let t = 0; t < 3; t += 1) run.advance(heldAt(tape.inputs, t));
        return run;
    }
    const none = { firing: false, wanding: false, spearing: false };
    const flags = (over = {}) => ({ earlier: none, slashing: false, firing: false, wanding: false, spearing: false,
        hasFireWand: false, ...over });
    it('the gate: a second non-sword call is refused by the first verb\'s flag (`set firing` :858, `set wanding` :834, '
        + '`set spearing` :815)', () => {
        for (const w of ['fire', 'wand', 'spear']) {
            expect(xcSecondCallAdmitted(w, flags())).toBe(true);
            expect(xcSecondCallAdmitted(w, flags({ slashing: true }))).toBe(false);
        }
        expect(xcSecondCallAdmitted('spear', flags({ earlier: { ...none, firing: true }, firing: true }))).toBe(false);
        expect(xcSecondCallAdmitted('spear', flags({ earlier: { ...none, wanding: true }, wanding: true }))).toBe(false);
        expect(xcSecondCallAdmitted('fire', flags({ earlier: { ...none, spearing: true }, spearing: true }))).toBe(false);
        expect(xcSecondCallAdmitted('wand', flags({ earlier: { ...none, spearing: true }, spearing: true }))).toBe(false);
    });
    it('the gate: Fire⇄Wand — refused by each other, and BOTH run under `hasFireWand` (the `|| hasFireWand` terms)', () => {
        const afterWand = flags({ earlier: { ...none, wanding: true }, wanding: true });
        const afterFire = flags({ earlier: { ...none, firing: true }, firing: true });
        expect(xcSecondCallAdmitted('fire', afterWand)).toBe(false);
        expect(xcSecondCallAdmitted('wand', afterFire)).toBe(false);
        expect(xcSecondCallAdmitted('fire', { ...afterWand, hasFireWand: true })).toBe(true);
        expect(xcSecondCallAdmitted('wand', { ...afterFire, hasFireWand: true })).toBe(true);
    });
    it('the gate: the same verb twice is `useItem`\'s own `if (!firing)` / `if (!wanding)` / `if (!spearing)` — a no-op, '
        + 'even under `hasFireWand`', () => {
        expect(xcSecondCallAdmitted('fire', flags({ earlier: { ...none, firing: true }, firing: true, hasFireWand: true })))
            .toBe(false);
        expect(xcSecondCallAdmitted('wand', flags({ earlier: { ...none, wanding: true }, wanding: true, hasFireWand: true })))
            .toBe(false);
        expect(xcSecondCallAdmitted('spear', flags({ earlier: { ...none, spearing: true }, spearing: true }))).toBe(false);
    });
    it('in the run: Fire then Sword, and Spear then Sword — the sword call is GATED by the first verb\'s flag', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            expect(xcRun(1, 0).slashPresses.map((d) => d.outcome)).toEqual(['gated']);
            const spear = xcRun(3, 0);
            expect(spear.slashPresses.map((d) => d.outcome)).toEqual(['gated']);
            expect(spear.presses.filter((p) => p.t === 0).map((p) => p.weapon)).toEqual(['spear']);
        });
    });
    it('in the run: Sword then Spear — the spear is refused by `slashing`; the tick is the sword\'s alone', () => {
        withContactFidelity({ secondaryUse: true }, () => {
            const r = xcRun(0, 3);
            expect(r.slashPresses.map((d) => d.outcome)).toEqual(['slash']);
            expect(new Set(r.presses.map((p) => p.weapon))).toEqual(new Set(['sword']));
        });
    });
    it('`hasFireWand` FUSES items 1 and 2 into 5 (`Inventory.as:306-321`, `appendInventorySlots`), so the Fire⇄Wand '
        + 'pair is unreachable through slots and the gate above is its only pin', () => {
        const slots = inventorySlotsFor({ ...W.arms.XC.tape.seam.items, hasFireWand: true });
        expect(slots).toContain(5);
        expect(slots.filter((id) => id === 1 || id === 2)).toEqual([]);
    });
});
