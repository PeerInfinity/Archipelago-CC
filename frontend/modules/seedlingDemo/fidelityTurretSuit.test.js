/**
 * ⛓ SEEDLING FIDELITY TURRETSUIT (wave 50) — a Turret's body contact at its AS3 slot, and its "Suit" retaliation
 * (`CONTACT_FIDELITY.turretSuitRetaliation`, OFF), through `levelRun.stepShootersNow`'s `onHitPlayer`.
 *
 *     Turret.as:47       super.update();          → Enemy.update: hitUpdate(); hitPlayer();   (Enemy.as:106-111)
 *     Turret.as:48-51    if (freezeObjects || destroy || currentAnim == "die") return;
 *     Turret.as:64       else if (hitsTimer <= 0) { shootTimer = 40; play("startshot"); }
 *     Player.as:1384-87  if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y), darkSuitDamage 1, "Suit");
 *
 * Wave 46 (DARKSUITSTATIC) left Turret undeclared: the model billed its contact in the static scan, BELOW the
 * turret's fire gate. ON, the contact is answered at the top of the turret's own turn, so the fire gate and the "die"
 * return read what `Enemy.hit` wrote. Report: `CC/docs/cloud-reports/seedling-fidelity-turretsuit.md`.
 *
 * Every row stages L29 the way wave 46 did: booted above `turret@128,192` (entity point (136,200)) with a `darksuit`
 * grant, idle, then `down` held into the body. The room's second turret (`turret@80,176`) fires throughout.
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { withStaticSwordArm } from './enemyDamage.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const levelSource = atlasLevelSource();
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const KEY = 'turretSuitRetaliation';
const BODY = 'turret@128,192';
const REFUSAL = /hasDarkSuit` retaliates INTO the attacker/;

/**
 * Boot L29 at (128,168) with the suit (and `health` extra hearts), idle `idle` ticks, then hold `down`; the whole
 * observable result (or the throw).
 */
function stage({ idle = 0, ticks = 40, health = 0, suit = true } = {}, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({
            levelSource, boot: { level: 29, x: 128, y: 168 }, pins: ['sound', 'dead_frames'], roles: ROLES,
            grants: [{ level: 29, items: [...(suit ? ['darksuit'] : []), ...Array(health).fill('health')] }],
        });
        let thrown = null;
        try {
            for (let k = 0; k < ticks; k += 1) run.advance(new Set(k <= idle ? [] : ['down']));
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown,
            hits: run.ledger('playerHits'),
            spawns: run.ledger('spitEvents').filter((s) => s.what === 'spawn').map((s) => [s.t, s.id]),
            suppressed: run.contactsSuppressed,
            deaths: run.ledger('staticBodyDeaths'),
        };
    });
}
const on = (o = {}) => ({ [KEY]: true, ...o });

describe('TURRETSUIT — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_TURRET_SUIT_RETALIATION)(
        'ships OFF, appended after owlContactInStep, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 51: PICKUPFREEZE `pickupTickFreeze` was appended after this key; wave 52: DIALOGUEFREEZE after it.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['pickupTickFreeze', 'dialogueFrameFreeze']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_TURRET_SUIT_RETALIATION');
        });
});

describe('TURRETSUIT — the contact under the suit', () => {
    it('OFF: wave 46\'s refusal by name; with `darkSuitStaticRetaliation` ON it carries the D1 reason', () => {
        const off = stage({}, { [KEY]: false });
        expect(off.thrown).toMatch(/the `enemy` hit \(turret@128,192\) at tick 14 in level 29/);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.thrown).not.toMatch(/DARKSUITSTATIC D1/);
        expect(off.hits).toEqual([]);
        const dssr = stage({}, { [KEY]: false, darkSuitStaticRetaliation: true });
        expect(dssr.thrown).toMatch(REFUSAL);
        expect(dssr.thrown).toMatch(/fidelity DARKSUITSTATIC D1: `Turret.update` reads `hitsTimer` in its fire gate/);
    });
    it('ON: billed at tick 14 with `Enemy.hit`\'s writes (hits, the 30-tick i-frames, the dark latch)', () => {
        const r = stage({}, on());
        expect(r.thrown).toBe(null);
        expect(r.hits).toEqual([{
            t: 14, level: 29, source: 'enemy', id: BODY, hits: 1, hitsMax: 3, died: false, shake: 5,
            knockback: r.hits[0].knockback,
            retaliation: { id: BODY, as3: 'Turret', landed: true, hits: 1, hitsTimer: 30, hitByDarkStuff: true },
        }]);
        expect(r.hits[0].knockback.dy).toBeLessThan(0);
        // the turret's own `hitsTimer` now gates its `hitPlayer` (`Enemy.as:213`): the next touch is refused by it
        expect(r.suppressed.filter((s) => s.id === BODY).every((s) => s.why === 'enemy hitsTimer')).toBe(true);
    });
    it('ON with `darkSuitStaticRetaliation` ON too: the same result (that key\'s Turret arm is never reached)', () => {
        expect(stage({}, on({ darkSuitStaticRetaliation: true }))).toEqual(stage({}, on()));
    });
});

describe('TURRETSUIT — the fire gate reads the post-hit timer', () => {
    // idle until the contact lands on tick 55, the tick `turret@128,192`'s `shootTimer` is 0 and it would start a shot
    const FIRE_TICK = { idle: 41, ticks: 100, health: 3 };
    it('no suit (ON = OFF): the contact tick starts the shot, which leaves the barrel at t61', () => {
        const off = stage({ ...FIRE_TICK, suit: false }, { [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.hits.find((h) => h.id === BODY)?.t).toBe(55);
        expect(off.spawns).toContainEqual([61, `${BODY}#2`]);
    });
    it('suit ON: `hitsTimer = 30` closes `else if (hitsTimer <= 0)` on that tick; the shot waits for the timer (t91)', () => {
        const r = stage(FIRE_TICK, on());
        expect(r.thrown).toBe(null);
        expect(r.hits.find((h) => h.id === BODY)).toMatchObject({ t: 55, retaliation: { hits: 1, hitsTimer: 30 } });
        const mine = r.spawns.filter(([, id]) => id.startsWith(`${BODY}#`));
        expect(mine).toEqual([[7, `${BODY}#1`], [91, `${BODY}#2`]]);
        // the room's other turret is untouched by the order
        const other = (x) => x.spawns.filter(([, id]) => !id.startsWith(`${BODY}#`));
        expect(other(r)).toEqual(other(stage({ ...FIRE_TICK, suit: false }, { [KEY]: false })));
    });
});

describe('TURRETSUIT — the third Suit hit', () => {
    it('plays "die" in the turret\'s own turn: no shot after it, and the graphic steps on the blow\'s tick', () => {
        const r = stage({ ticks: 110, health: 6 }, on());
        expect(r.thrown).toBe(null);
        const mine = r.hits.filter((h) => h.id === BODY);
        // the turret's own 30-tick `hitsTimer` spaces its contacts
        expect(mine.map((h) => h.t)).toEqual([14, 44, 74]);
        expect(mine.map((h) => h.retaliation.hits)).toEqual([1, 2, 3]);
        expect(mine.at(-1).retaliation.killed).toBe(true);
        // "die" (18 ticks with the blow-tick step), then `destroy` and `Mobile.death`'s fade
        expect(r.deaths).toEqual([{ level: 29, id: BODY, as3: 'Turret', tag: -1, killedAt: 74, removedAt: 103,
            write: null, declaredAt: null }]);
        expect(r.suppressed.filter((s) => s.id === BODY && s.t > 74).map((s) => s.why))
            .toEqual([...Array(17).fill('die anim'), ...Array(12).fill('destroy')]);
        expect(r.spawns.filter(([t, id]) => id.startsWith(`${BODY}#`) && t > 7)).toEqual([]);
    });
});

describe('TURRETSUIT — without the suit, and without the relabel', () => {
    it('no suit: ON = OFF, the whole result (the contact\'s player-side writes are order-free for the turret)', () => {
        for (const s of [{ ticks: 120, health: 6 }, { idle: 41, ticks: 120, health: 3 }]) {
            const a = stage({ ...s, suit: false }, { [KEY]: false });
            const b = stage({ ...s, suit: false }, on());
            expect(b).toEqual(a);
            expect(a.hits.some((h) => h.id === BODY)).toBe(true);
            for (const h of a.hits) expect(h).not.toHaveProperty('retaliation');
        }
    });
    it('`STATIC_SWORD_ARM` OFF: no hook is passed, and the scan refuses the turret as before, ON as OFF', () => {
        const a = withStaticSwordArm(false, () => stage({}, { [KEY]: false }));
        const b = withStaticSwordArm(false, () => stage({}, on()));
        expect(b).toEqual(a);
        expect(a.thrown).toMatch(/turret@128,192 in level 29 at tick 14 .* prices it as "mover"/);
    });
});
