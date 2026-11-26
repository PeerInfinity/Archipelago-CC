/**
 * ⛓ SEEDLING FIDELITY DARKSUITSTATIC (wave 46) — the dark suit's retaliation into a STATIC body
 * (`CONTACT_FIDELITY.darkSuitStaticRetaliation`, OFF), through `levelRun.stepContactsNow`'s `staticSuitRetaliation`.
 *
 *     Player.as:1384-1387   if (e && hasDarkSuit) e.hit(darkSuitForce, new Point(x, y), darkSuitDamage, "Suit");
 *
 * `Enemy.hitPlayer` passes the body as `e` (`Enemies/Enemy.as:211-221`), and the static scan declared no `retaliate`,
 * so every static contact under the suit was refused by name — hammer met it at L63 `darktrap@128,272`. D1's census
 * (report `CC/docs/cloud-reports/seedling-fidelity-darksuitstatic.md`): DarkTrap and IceTrap are no-ops; SandTrap's
 * `Enemy.hit` writes F4's damage row; Turret stays refused (its fire gate reads `hitsTimer` after `super.update()`).
 *
 * Each row stages the contact directly: the room booted above the body with a `darksuit` grant, `down` held.
 */
import { describe, expect, it } from 'vitest';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const levelSource = atlasLevelSource();
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const KEY = 'darkSuitStaticRetaliation';

/** Boot `level` at (x, y) with the suit (and `health` extra hearts), hold `key` for `ticks`; the hits, or the throw. */
function stage({ level, x, y, key = 'down', ticks = 30, health = 0, suit = true }, on) {
    return withContactFidelity({ [KEY]: on }, () => {
        const run = createLevelRun({
            levelSource, boot: { level, x, y }, pins: ['sound', 'dead_frames'], roles: ROLES,
            grants: [{ level, items: [...(suit ? ['darksuit'] : []), ...Array(health).fill('health')] }],
        });
        let thrown = null;
        try {
            for (let k = 0; k < ticks; k += 1) run.advance(new Set(k === 0 ? [] : [key]));
        } catch (e) {
            thrown = e.message;
        }
        return { thrown, hits: run.ledger('playerHits'), deaths: run.ledger('staticBodyDeaths') };
    });
}

const L63_DARKTRAP = { level: 63, x: 128, y: 248 };
const L45_ICETRAP = { level: 45, x: 64, y: 40 };
const L8_SANDTRAP = { level: 8, x: 96, y: 56 };
const L29_TURRET = { level: 29, x: 128, y: 168 };
const REFUSAL = /hasDarkSuit` retaliates INTO the attacker/;

describe('DARKSUITSTATIC — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_DARK_SUIT_STATIC_RETALIATION)(
        'ships OFF, appended after wallFlyerCorpseGone, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 47: L39HIT `pulserForecastPulse` was appended after this key; wave 48: DARKSUITBOSSES `darkSuitBossRetaliation` after that.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['pulserForecastPulse', 'darkSuitBossRetaliation', 'owlContactInStep', 'turretSuitRetaliation', 'pickupTickFreeze', 'dialogueFrameFreeze', 'frozenTickUngated', 'freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DARK_SUIT_STATIC_RETALIATION');
        });
});

describe('DARKSUITSTATIC — L63 `darktrap@128,272` (hammer\'s wall)', () => {
    it('OFF: the contact is the named `byEnemy` refusal', () => {
        const off = stage(L63_DARKTRAP, false);
        expect(off.thrown).toMatch(/the `enemy` hit \(darktrap@128,272\) at tick 14 in level 63/);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.hits).toEqual([]);
    });
    it('ON: the contact bills as `Player.hit` (hits, knockback, shake) with a no-op retaliation row', () => {
        const on = stage(L63_DARKTRAP, true);
        expect(on.thrown).toBe(null);
        expect(on.hits).toEqual([{
            t: 14, level: 63, source: 'enemy', id: 'darktrap@128,272', hits: 1, hitsMax: 3, died: false, shake: 5,
            knockback: { dx: 0, dy: -3, landed: { x: false, y: true } },
            retaliation: { id: 'darktrap@128,272', as3: 'DarkTrap', landed: false, effect: 'none',
                why: '`DarkTrap.hit` is an empty override (Enemies/DarkTrap.as:56-59)' },
        }]);
    });
    it('without the suit the row carries no `retaliation` key, ON or OFF (older rows byte-identical)', () => {
        const a = stage({ ...L63_DARKTRAP, suit: false }, false);
        const b = stage({ ...L63_DARKTRAP, suit: false }, true);
        expect(a).toEqual(b);
        expect(a.hits.length).toBeGreaterThan(0);
        for (const h of a.hits) expect(h).not.toHaveProperty('retaliation');
    });
});

describe('DARKSUITSTATIC — the other declared classes', () => {
    it('IceTrap (L45 `icetrap@64,64`): OFF refused; ON a no-op row (`canHit = false`)', () => {
        expect(stage(L45_ICETRAP, false).thrown).toMatch(REFUSAL);
        const on = stage(L45_ICETRAP, true);
        expect(on.thrown).toBe(null);
        expect(on.hits.map((h) => h.retaliation)).toEqual([{ id: 'icetrap@64,64', as3: 'IceTrap', landed: false,
            effect: 'none', why: '`canHit = false` (Enemies/IceTrap.as:32) closes `Enemy.hit` (Enemies/Enemy.as:147)' }]);
    });
    it('SandTrap (L8 `sandtrap@96,80`): OFF refused; ON `Enemy.hit` writes hits, i-frames and the dark latch', () => {
        expect(stage(L8_SANDTRAP, false).thrown).toMatch(REFUSAL);
        const on = stage(L8_SANDTRAP, true);
        expect(on.thrown).toBe(null);
        expect(on.hits.map((h) => [h.t, h.retaliation])).toEqual([[14, { id: 'sandtrap@96,80', as3: 'SandTrap',
            landed: true, hits: 1, hitsTimer: 30, hitByDarkStuff: true }]]);
    });
    it('SandTrap: the third Suit hit plays "die" — staged as the sword\'s, plus the same-tick graphic step', () => {
        const health = 3;
        const on = stage({ ...L8_SANDTRAP, ticks: 100, health }, true);
        expect(on.thrown).toBe(null);
        const first = on.hits.filter((h) => h.id === 'sandtrap@96,80');
        // the trap's own `hitsTimer` (30) gates its `hitPlayer`, so the contacts are 30 ticks apart
        expect(first.map((h) => h.t)).toEqual([14, 44, 74]);
        expect(first.map((h) => h.retaliation.hits)).toEqual([1, 2, 3]);
        expect(first.at(-1).retaliation.killed).toBe(true);
        // the blow lands inside `SandTrap.update`, so `World.update` steps "die" on the blow's tick: 18 ticks, not 19
        expect(on.deaths).toEqual([{ level: 8, id: 'sandtrap@96,80', as3: 'SandTrap', tag: 0, killedAt: 74,
            removedAt: 92, write: 'earned', declaredAt: null }]);
    });
});

describe('DARKSUITSTATIC — the class D1 leaves undeclared', () => {
    it('Turret (L29 `turret@128,192`): refused ON as OFF, and ON the refusal names the D1 reason', () => {
        const off = stage(L29_TURRET, false);
        const on = stage(L29_TURRET, true);
        expect(off.thrown).toMatch(REFUSAL);
        expect(off.thrown).not.toMatch(/DARKSUITSTATIC/);
        expect(on.thrown).toMatch(REFUSAL);
        expect(on.thrown).toMatch(/fidelity DARKSUITSTATIC D1: `Turret.update` reads `hitsTimer` in its fire gate/);
    });
});
