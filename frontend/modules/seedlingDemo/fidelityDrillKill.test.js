/**
 * Seedling fidelity DRILLKILL (wave 26): the solver kills L28's drills first, then cuts the rope, behind
 * `CONTACT_FIDELITY.drillKillFirst` (OFF). ⚖ The user (2026-10-22): "The intended solution is to fight the drills first."
 *
 *   · W0: `Drill extends Enemy` — `hitsMax` 3, `hitsTimer` 30 per landing, `knockback` EMPTY; `swordDamage` 1 (3
 *     landings), `spearDamage` 2 (2). FIRE CANNOT KILL A DRILL: `Enemy.hit` runs `if (hitByFire || t != "Fire")` and a
 *     Drill's `hitByFire` is false (`fireDamage` is 0 besides) — `drill.hitDrill` already says so (`landed: false`).
 *   · D2: `solverBot.execDrillKillsFirst` — before a `rope` clear-tag, each live drill the planned walk to the cut's
 *     stance would wake is killed: a pre-stance 48 px out on one axis, a creep until it hops, a press each time its
 *     `hitsTimer` runs out, its removal waited out. A Fire-only run keeps the cut's own refusal, which now says Fire
 *     cannot kill a drill.
 *   · D1 (the game): `fixtures/drillkill-witness/` (`probe-seedling-drill-kill.mjs --record`, p4g, headless), replayed
 *     here against the model at 0 px — the player, every drill (position, anim, `hits`, `hitsTimer`), the bobsoldier.
 *
 * rules-2's measurement (`ropeCutAnyWeapon` + `drillLive` + `drillMixedRooms` ON) is the acceptance: Sword SOLVED from
 * both arrivals; Spear REFUSED from both; Fire SOLVED from L25 and REFUSED from L26. ON: the Spear solves from both; Fire
 * from L26 stays refused (a game fact, named).
 *
 * ── THE MUTATION LIST (each predicted first; copy + edit + run + restore) ──
 *   k1 `execDrillKillsFirst` returns null at once            -> the ON Spear rows red (REFUSED on the drill's hop)
 *   k2 no face tap (`toward` ignored)                        -> Spear from L26 reds: the presses miss (refused by name)
 *   k3 press without the `hitsTimer <= 1` gate               -> the Sword rows red: a press inside the i-frame does
 *                                                               not land, the miss refusal fires
 *   k4 `preStance` 56                                         -> the L25 rows red: no kill stance above the drills
 *   d1 `stepDrillGraphic`'s "die" case keeps the anim name (no `play("")`) -> the four kill witnesses red from the tick
 *      the death anim ends (the game's row reads anim "" through the fade)
 * Measured: all red. k1 as predicted (and the Fire+Spear row); k2 a superset — the L25 rows and the Fire+Spear row
 * too (the north stances' walk also ends facing across the axis); k3 as predicted (and the Fire+Spear row); k4 a
 * superset — the L26 rows too (a 56 px stance west of `drill@128,96` is where `drill@80,96` stood) and the pin.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { solveSegment, SolverRefusal, DRILL_KILL } from './solverBot.js';
import { hitDrill, newDrill } from './drill.js';
import { DRILLKILL_WITNESS_DIR, DRILLKILL_WITNESSES, compareDrillKillWitness, drillKillModelSamples, drillKillTape }
    from './fidelityDrillKill.js';

const SRC = atlasLevelSource();
const L28_CUT = Object.freeze({ kind: 'clear-tag', tag: { level: 28, tag: 0 }, at: { x: 160, y: 64 },
    obstacle: 'rope@160,64' });
const ARRIVALS = Object.freeze({ L25: { level: 28, x: 96, y: 16 }, L26: { level: 28, x: 16, y: 96 } });

function solve(arrival, items) {
    const boot = ARRIVALS[arrival];
    const run = createRunForStaging(arrivalStaging(boot, { items }), SRC);
    try {
        const out = solveSegment({ run, goals: [{ ...L28_CUT }], name: 'drillkill', boot });
        return { run, out, refusal: null, kills: (out.records ?? []).flatMap((r) => r.drillKills ?? []) };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, refusal: e, kills: [] };
    }
}
const ON = (fn) => withContactFidelity({ drillKillFirst: true }, fn);
const OFF = (fn) => withContactFidelity({ drillKillFirst: false }, fn);
const drills = (run) => Object.fromEntries(run.drills.bodies.map((d) => [d.id, { x: d.x, y: d.y, hits: d.hits,
    removed: d.removed }]));

describe('fidelity DRILLKILL — the switch', () => {
    it('is OFF by default, and its prerequisites are ON', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.drillKillFirst).toBe(false);
        expect(CONTACT_FIDELITY.drillKillFirst).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS).toMatchObject({ drillLive: true, drillMixedRooms: true, ropeCutAnyWeapon: true });
    });
    it('the pre-stance is the run range itself, three tiles out', () => {
        expect(DRILL_KILL.preStance).toBe(48);
        expect(DRILL_KILL.preStance % 16).toBe(0);
    });
});

describe('fidelity DRILLKILL — W0: what kills a drill (`Enemy.hit`, transcribed in `drill.hitDrill`)', () => {
    const lands = (t, damage, n) => {
        let d = newDrill({ id: 'drill@0,0', x: 0, y: 0 });
        for (let i = 0; i < n; i += 1) {
            d = hitDrill(d, { damage, t }).d;
            d = { ...d, hitsTimer: 0 };
        }
        return d;
    };
    it('the sword kills in 3 landings, the spear in 2', () => {
        expect(lands('Sword', 1, 2).anim).not.toBe('die');
        expect(lands('Sword', 1, 3).anim).toBe('die');
        expect(lands('Spear', 2, 1).anim).not.toBe('die');
        expect(lands('Spear', 2, 2).anim).toBe('die');
    });
    it('FIRE never lands (`hitByFire` false; `fireDamage` 0)', () => {
        const d = lands('Fire', 0, 10);
        expect(d.hits).toBe(0);
        expect(hitDrill(newDrill({ id: 'drill@0,0', x: 0, y: 0 }), { damage: 1, t: 'Fire' }).landed).toBe(false);
    });
});

describe('fidelity DRILLKILL — D2: L28\'s rope cut from both arrivals (rules-2\'s acceptance)', () => {
    it.each([
        // arrival, weapon, items, ticks ON, the drills killed (removed) ON
        ['L25', 'the Sword', ['hasSword'], 170, ['drill@128,96']],
        ['L25', 'the Spear', ['hasSpear'], 176, ['drill@128,96']],
        ['L26', 'the Sword', ['hasSword'], 303, ['drill@80,96', 'drill@128,96']],
        ['L26', 'the Spear', ['hasSpear'], 265, ['drill@80,96', 'drill@128,96']],
    ])('ON: from %s with %s, the drills the walk wakes are killed first, then the cut SOLVES', (arrival, _, items, ticks,
        killed) => ON(() => {
        const { run, out, refusal, kills } = solve(arrival, items);
        expect(refusal).toBeNull();
        expect(out.perTick.length).toBe(ticks);
        expect(kills.map((k) => k.drill)).toEqual(killed);
        const after = drills(run);
        for (const id of killed) expect(after[id].removed).toBe(true);
        expect(run.damage.hits).toBe(0);
        expect((run.ledger('playerHits') ?? []).length).toBe(0);
        expect((run.ledger('ropePulls') ?? []).some((p) => p.id === 'rope@160,64')).toBe(true);
    }), 120000);
    it('ON: Fire from L25 plans what OFF plans — its stance wakes no drill, so nothing is killed', () => {
        const off = OFF(() => solve('L25', ['hasFire']));
        const on = ON(() => solve('L25', ['hasFire']));
        expect(on.kills).toEqual([]);
        expect(on.out.perTick.length).toBe(89);
        expect(on.out.perTick.map((h) => [...h].join('+'))).toEqual(off.out.perTick.map((h) => [...h].join('+')));
    }, 120000);
    it('ON: Fire from L26 is still REFUSED on `drill@80,96` — and the refusal says Fire cannot kill a drill', () => ON(() => {
        const { refusal } = solve('L26', ['hasFire']);
        expect(refusal).not.toBeNull();
        expect(refusal.obstacle).toMatchObject({ kind: 'solid', id: 'rope@160,64', drill: 'drill@80,96' });
        expect(refusal.message).toMatch(/FIRE CANNOT \(`Enemy.hit`: `hitByFire` is false for a Drill/);
    }), 120000);
    it('ON: a Fire-selected run holding the Spear selects the spear for the kill (`equip`), and solves from L26', () => ON(() => {
        const { refusal, kills } = solve('L26', ['hasFire', 'hasSpear']);
        expect(refusal).toBeNull();
        expect(kills.map((k) => [k.drill, k.weapon, k.slot])).toEqual([['drill@80,96', 'spear', 1],
            ['drill@128,96', 'spear', 1]]);
    }), 120000);
    it.each([
        ['L25', ['hasSword'], 52, null],
        ['L25', ['hasSpear'], null, /drill@128,96 hopped onto the player at run tick 59/],
        ['L25', ['hasFire'], 89, null],
        ['L26', ['hasSword'], 77, null],
        ['L26', ['hasSpear'], null, /drill@80,96 hopped onto the player at run tick 31/],
        ['L26', ['hasFire'], null, /drill@80,96 hopped onto the player at run tick 31 on the way to \(or at\) the stance, and/],
    ])('OFF (byte-identical): from %s with %j — rules-2\'s measurement', (arrival, items, ticks, refused) => OFF(() => {
        const { out, refusal, kills } = solve(arrival, items);
        expect(kills).toEqual([]);
        if (ticks === null) expect(refusal.message).toMatch(refused);
        else expect(out.perTick.length).toBe(ticks);
    }), 120000);
});

describe('fidelity DRILLKILL — D1: the game witnesses (p4g), replayed against the model at 0 px', () => {
    const load = (name) => JSON.parse(readFileSync(join(DRILLKILL_WITNESS_DIR, `${name}.json`), 'utf8'));
    it('every witness is recorded, on the default build', () => {
        const files = readdirSync(DRILLKILL_WITNESS_DIR).filter((f) => f.endsWith('.json')).sort();
        expect(files).toEqual(DRILLKILL_WITNESSES.map((w) => `${w.name}.json`).sort());
        for (const w of DRILLKILL_WITNESSES) expect(load(w.name).page).toBe('seedling_bot_ap_p4g');
    });
    it.each(DRILLKILL_WITNESSES.map((w) => [w.name]))('%s: the model reproduces the game on every sampled tick', async (name) => {
        const rec = load(name);
        const model = await drillKillModelSamples(rec.tape);
        expect(model.error).toBeNull();
        expect(compareDrillKillWitness(rec.samples, model.samples, rec.tape.boot.level)).toEqual([]);
        expect(rec.samples.every((g) => g.hits === 0)).toBe(true);
    }, 120000);
    it.each(DRILLKILL_WITNESSES.filter((w) => w.script.goals).map((w) => [w.name]))(
        '%s: the drills die on the game, the rope is cut, and the solver still makes the recorded plan', async (name) => {
            const rec = load(name);
            const w = DRILLKILL_WITNESSES.find((x) => x.name === name);
            const { tape } = await drillKillTape(w);
            expect(tape.inputs).toEqual(rec.tape.inputs);
            const killed = w.boot.x === 16 ? 2 : 1;
            expect(rec.samples.at(-1).drills.length).toBe(2 - killed);
            const model = await drillKillModelSamples(rec.tape);
            expect(model.pulls.map((p) => p.id)).toEqual(['rope@160,64']);
        }, 120000);
    it('drillkill-l28-fire-l26: burned point-blank, the drill\'s hits never move on the game (`hitByFire` false)', () => {
        const rec = load('drillkill-l28-fire-l26');
        // the flame is `sprFire` (32x32, centred) cut to 16 px of the player's box (hit frames 3-6 of 9 at 25 fps, ~7-17
        // ticks after a press); the presses of tape ticks 31 and 42 find the drill 8.05 px in front, then 7.95 px behind
        const at = (t) => rec.samples.find((g) => g.t === t);
        for (const t of [38, 41, 44, 47, 50]) {
            const g = at(t);
            expect(g.drills.some((d) => Math.abs(d.x - g.x) < 9 && d.y === g.y)).toBe(true);
        }
        for (const g of rec.samples) {
            for (const d of g.drills) {
                expect(d.hits).toBe(0);
                expect(d.hitByFire).toBe(false);
            }
        }
    });
});
