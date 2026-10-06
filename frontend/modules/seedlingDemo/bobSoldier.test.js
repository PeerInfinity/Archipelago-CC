/**
 * seedling-fidelity-bobsoldier — `bobSoldier.js` (the sword) and its bridge into the chaser loop.
 *
 * The game witnesses are the TERRAIN captures (L30 legs 308/309, `contactFidelity.test.js`) and this slice's two
 * recorded tapes (`bobsoldier-sword`, `bobsoldier-kill`, replayed by `tapeRunner.test.js`); the body itself is
 * compared tick by tick by `probe-seedling-bobsoldier-mobiles.mjs`. These rows pin the transcription's own claims.
 */
import { describe, expect, it } from 'vitest';

import {
    BOB_SOLDIER, angleDifference, bobSoldierBeginCheck, bobSoldierSpinStep, bobSoldierSwordLine,
    bobSoldierSwordTail, createBobSoldierSword,
} from './bobSoldier.js';
import {
    CHASERS, bridgedChaserTags, chaserChasesWhileDying, chaserHasSword, chaserSolids, createDieAnim, deathTicks,
    isBridgedChaser,
} from './chasers.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { contactPricing } from './combat.js';
import { CORPSE_COUNTING, KILL_ARM_POLICY, KILL_SIDE_WRITES, removalTicksAfterHit } from './enemyDamage.js';
import { MODELLED_ENEMY_CLASSES } from './spinner.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { PIN_NAMES } from './tapeFormat.js';
import { loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

describe('bobSoldier.js — the sword state machine, as `BobSoldier.as` writes it', () => {
    it('the class numbers: weaponLength 16, attackRange 32, π/10 a tick, a 60-update reset, one blade', () => {
        expect(BOB_SOLDIER.weaponLength).toBe(16);
        expect(BOB_SOLDIER.attackRange).toBe(32);
        expect(BOB_SOLDIER.swordSpinRate).toBe(Math.PI / 10);
        expect(BOB_SOLDIER.swordSpinResetTimerMax).toBe(60);
        expect(BOB_SOLDIER.swords).toBe(1);
        const s = createBobSoldierSword();
        expect(s.swordSpin).toEqual([Math.PI * 3 / 2, Math.PI / 2, Math.PI, 0]);
        expect(s.swordSpinBegin).toEqual([0, 0]);
        expect(s.swordSpinning).toBe(false);
    });

    it('⛔ THE SWORD IS ALWAYS OUT: at rest it points DOWN, 8 to 16 px below the body', () => {
        const l = bobSoldierSwordLine({ x: 56, y: 88 }, createBobSoldierSword());
        expect(l.x0).toBeCloseTo(56, 9);
        expect(l.y0).toBeCloseTo(96, 9);
        expect(l.x1).toBeCloseTo(56, 9);
        expect(l.y1).toBeCloseTo(104, 9);
    });

    it('⛔ `d` IS AN int: the spin begins at d = 32.99 (truncated to 32) and not at d = 33', () => {
        const a = createBobSoldierSword();
        expect(bobSoldierBeginCheck(a, 32.99)).toBe(true);
        expect(a.swordSpinning).toBe(true);
        expect(a.swordSpinResetTimer).toBe(60);
        const b = createBobSoldierSword();
        expect(bobSoldierBeginCheck(b, 33)).toBe(false);
        expect(b.swordSpinning).toBe(false);
    });

    it('the reset timer counts down ONLY inside the range with the sword at rest', () => {
        const s = createBobSoldierSword();
        s.swordSpinResetTimer = 2;
        expect(bobSoldierBeginCheck(s, 100)).toBe(false);
        expect(s.swordSpinResetTimer).toBe(2);
        expect(bobSoldierBeginCheck(s, 10)).toBe(false);
        expect(bobSoldierBeginCheck(s, 10)).toBe(false);
        expect(s.swordSpinResetTimer).toBe(0);
        expect(bobSoldierBeginCheck(s, 10)).toBe(true);
    });

    it('a spin is a full turn and stops pointing AT the player (the -atan2 angle), within one step', () => {
        const s = createBobSoldierSword();
        const body = { x: 0, y: 0 };
        const player = { x: 20, y: -5 };
        bobSoldierBeginCheck(s, 10);
        let n = 0;
        while (s.swordSpinning && n < 100) { bobSoldierSpinStep(s, body, player); n += 1; }
        expect(s.swordSpinning).toBe(false);
        expect(n).toBeGreaterThanOrEqual(20);
        expect(n).toBeLessThanOrEqual(40);
        const ang = (-Math.atan2(player.y - body.y, player.x - body.x) + Math.PI * 2) % (Math.PI * 2);
        expect(s.swordSpin[0]).toBe(ang);
        // and the resting blade then points at the player
        const l = bobSoldierSwordLine(body, s);
        expect(Math.atan2(l.y1, l.x1)).toBeCloseTo(Math.atan2(player.y, player.x), 12);
    });

    it('`FP.angle_difference` wraps once each way', () => {
        expect(angleDifference(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 12);
        expect(angleDifference(2 * Math.PI - 0.1, 0.1)).toBeCloseTo(-0.2, 12);
    });

    it('the tail measures `d` from the body to the player with `FP.distance` (sqrt, not hypot)', () => {
        const s = createBobSoldierSword();
        const r = bobSoldierSwordTail(s, { x: 0, y: 0 }, { x: 32, y: 0.5 });
        expect(r.began).toBe(true);
        expect(r.lines).toHaveLength(1);
    });
});

describe('the bridge — `chasers.CHASERS.bobsoldier` × `MODELLED_ENEMY_CLASSES.BobSoldier`, under W4', () => {
    it('ON (the default): bridged, stepped and priced by `stepChasersNow`', () => {
        expect(CONTACT_FIDELITY.bobSoldierLive).toBe(true);
        expect(MODELLED_ENEMY_CLASSES.BobSoldier.module).toBe('chasers.js');
        expect(isBridgedChaser('bobsoldier')).toBe(true);
        expect(bridgedChaserTags()).toContain('bobsoldier');
        expect(contactPricing('bobsoldier')).toMatchObject({ kind: 'stepped', pricedBy: 'stepChasersNow' });
    });

    it('OFF: the class is the `mover` it was — not bridged, priced nowhere', () => {
        withContactFidelity({ bobSoldierLive: false }, () => {
            expect(isBridgedChaser('bobsoldier')).toBe(false);
            expect(bridgedChaserTags()).not.toContain('bobsoldier');
            expect(contactPricing('bobsoldier').kind).toBe('mover');
        });
    });

    it('⛔ NOT Bob\'s row: no die animation, a corpse that chases, the base solids, a sword', () => {
        const c = CHASERS.bobsoldier;
        expect(c.dieAnim).toBeNull();
        expect(createDieAnim('bobsoldier')).toBeNull();
        expect(deathTicks('bobsoldier')).toBe(0);
        expect(chaserChasesWhileDying('bobsoldier')).toBe(true);
        expect(chaserChasesWhileDying('bob')).toBe(false);
        expect(chaserSolids('bobsoldier')).not.toContain('Enemy');
        expect(chaserHasSword('bobsoldier')).toBe(true);
        expect(chaserHasSword('bob')).toBe(false);
    });

    it('the kill policy, the corpse row and the side write', () => {
        expect(KILL_ARM_POLICY.BobSoldier.policy).toBe('modelled');
        expect(CORPSE_COUNTING.BobSoldier).toMatchObject({ shape: 'fade', removesBody: true, chaserTag: 'bobsoldier' });
        expect(KILL_SIDE_WRITES.BobSoldier.writes).toBe('none');
        expect(removalTicksAfterHit('BobSoldier', deathTicks('bobsoldier'))).toBe(11);
    });
});

function l30Run(items = {}, boot = { level: 30, x: 96, y: 112 }) {
    return createLevelRun({
        levelSource: atlasLevelSource(),
        boot,
        noclip: false,
        noHazards: [],
        noDamage: false,
        grants: [],
        persistence: [],
        despawn: [],
        equips: [],
        pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: null,
        seam: { items },
        roles: ROLES,
    });
}

describe('the stepped body in L30 (the witnesses\' own boot)', () => {
    it('`bobsoldier-sword`: the spin begins at t 49 and the blade lands at t 80 and t 107', () => {
        const tape = loadTape('bobsoldier-sword');
        const run = l30Run();
        let began = null;
        for (let t = 0; t < tape.tick_count; t += 1) {
            run.advance(new Set());
            if (began === null && run.chasers[0]?.swordSpinning) began = t + 1;
        }
        expect(began).toBe(49);
        expect(run.playerHits.filter((h) => h.source === 'sword').map((h) => h.t)).toEqual([80, 107]);
        expect(run.playerHits.filter((h) => h.source === 'chaser')).toEqual([]);
    });

    it('⛔⛔ A CORPSE STILL SWINGS: after the kill the blade keeps turning until the removal (the tail has no `destroy` gate)', () => {
        const tape = loadTape('bobsoldier-kill');
        const r = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        const spins = [];
        for (let t = 0; t < tape.tick_count; t += 1) {
            r.advance(heldKeysAt(tape, t));
            const c = r.chasers.find((x) => x.id === 'bobsoldier@48,80');
            if (c?.destroy) spins.push(c.swordSpin);
        }
        expect(r.chaserKills.map((k) => k.by)).toEqual(['press']);
        // the fade ticks with the body still in the roster, and the blade's angle moves on them
        expect(spins.length).toBeGreaterThanOrEqual(10);
        expect(new Set(spins).size).toBeGreaterThan(1);
        expect(r.chasers.some((x) => x.id === 'bobsoldier@48,80')).toBe(false);
    });
});
