/**
 * turret.test — U15-swim D1: `Turret` + `TurretSpit` as transcribed. The game
 * witnesses are `u15-turret-spit` and `u15-turret-shield` (tapeRunner); these
 * rows pin the pieces.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { rect } from './levelWorld.js';
import {
    TURRET, TURRET_CADENCE, TURRET_SPIT, createTurret, createTurretSpit, spawnSpit,
    stepTurret, stepTurretSpit, turretDistance, turretInRange, turretRect, turretSpitRect,
} from './turret.js';

describe('Turret, transcribed (Enemies/Turret.as)', () => {
    it('L29 places three turrets, the cell centre is the entity point', () => {
        const ts = atlasLevelSource()(29).entities.filter((e) => e.type === 'turret');
        expect(ts.map((e) => [e.x, e.y])).toEqual([[80, 176], [128, 192], [112, 240]]);
        const t = createTurret(80, 176);
        expect([t.x, t.y]).toEqual([88, 184]);
        expect(turretRect(t)).toMatchObject({ x: 80, y: 176, right: 96, bottom: 192 });
    });

    it('the range test truncates: 64.99 is in range, 65 is not', () => {
        const t = createTurret(0, 0);
        expect(turretDistance(t, { x: t.x + 64.99, y: t.y })).toBe(64);
        expect(turretInRange(t, { x: t.x + 64.99, y: t.y })).toBe(true);
        expect(turretInRange(t, { x: t.x + 65, y: t.y })).toBe(false);
    });

    it('the cadence, simulated: play on tick one, the spit at +6, idle at +14, every 54', () => {
        // 10 * 0.0333 = 0.333 per update: three leave 0.999, so each two-frame
        // animation wraps on its SEVENTH update; the 40 is re-armed through both.
        expect(TURRET_CADENCE).toEqual({
            firstPlayTick: 0,
            spawnAfterPlay: 6,
            firstSpitUpdateAfterPlay: 7,
            idleAfterPlay: 14,
            periodTicks: 54,
            playAfterEntry: 40,
        });
    });

    it('a player walking INTO range is shot 40 ticks after the entry tick', () => {
        const t = createTurret(0, 0);
        const far = { x: t.x + 100, y: t.y };
        const near = { x: t.x + 30, y: t.y };
        for (let k = 0; k < 5; k += 1) stepTurret(t, { player: far });
        expect(t.shootTimer).toBe(TURRET.shootTimerMax);
        let played = null;
        for (let k = 0; k < 60 && played === null; k += 1) {
            stepTurret(t, { player: near });
            if (t.anim === 'startshot') played = k;
        }
        expect(played).toBe(40);
    });

    it('the aim turns a tenth of the difference per tick, and the spit flies along it', () => {
        const t = createTurret(80, 176);
        // The first frame: one tenth of the way from 0 deg toward the player.
        stepTurret(t, { player: { x: 40, y: 200 } });
        const want = -Math.atan2(200 - 184, 40 - 88) * 180 / Math.PI;
        expect(t.angle).toBeCloseTo(want / 10, 12);
        expect(t.anim).toBe('startshot');
        let spit = null;
        for (let k = 0; k < 6; k += 1) {
            stepTurret(t, { player: { x: 40, y: 200 } });
            if (t.spawned) spit = t.spawned;
        }
        expect(spit).not.toBeNull();
        const a = -t.angle / 180 * Math.PI;
        expect(spit).toMatchObject({ x: 88, y: 184, v: { x: 3 * Math.cos(a), y: 3 * Math.sin(a) } });
    });

    it('a frozen tick keeps the shot in the barrel moving but starts no new one', () => {
        const t = createTurret(0, 0);
        stepTurret(t, { player: { x: t.x + 10, y: t.y }, frozen: true });
        expect(t.anim).toBe('');
        stepTurret(t, { player: { x: t.x + 10, y: t.y } });
        expect(t.anim).toBe('startshot');
        let spawned = 0;
        for (let k = 0; k < 6; k += 1) {
            stepTurret(t, { player: { x: t.x + 10, y: t.y }, frozen: true });
            if (t.spawned) spawned += 1;
        }
        expect(spawned).toBe(1);
    });
});

describe('TurretSpit, transcribed (Projectiles/TurretSpit.as)', () => {
    it('moves 3 px a tick in 1 px sub-steps and hits the player box', () => {
        const s = createTurretSpit('s', 88, 184, -3, 0);
        const player = rect(76, 182, 4, 5);
        const r1 = stepTurretSpit(s, { playerBox: player });
        expect([s.x, s.y, r1.hitPlayer]).toEqual([85, 184, false]);
        stepTurretSpit(s, { playerBox: player });
        const r3 = stepTurretSpit(s, { playerBox: player });
        expect([s.x, r3.hitPlayer, r3.removed]).toEqual([79, true, true]);
    });

    it('the shield entity removes it with NO hit when the shield is met first', () => {
        const s = createTurretSpit('s', 88, 184, -3, 0);
        const player = rect(76, 182, 4, 5);
        const shield = rect(80, 181, 3, 7);
        let r;
        do { r = stepTurretSpit(s, { playerBox: player, shieldBox: shield }); } while (!r.removed);
        expect(r.hitPlayer).toBe(false);
        expect(r.hitTypes).toEqual(['Shield']);
    });

    it('friction zeroes an axis below 0.05 on the first tick, for good', () => {
        const s = spawnSpit('s', 88, 184, 90 - 0.5);
        expect(Math.abs(s.v.x)).toBeLessThan(TURRET_SPIT.frictionZero);
        stepTurretSpit(s, {});
        expect(s.v.x).toBe(0);
    });

    it('the off-screen cull runs below the collision, at a margin of 12', () => {
        const s = createTurretSpit('s', 10, 10, 3, 0);
        let margin = null;
        const r = stepTurretSpit(s, { onScreen: (b, m) => { margin = m; return false; } });
        expect([r.culled, r.removed, margin]).toEqual([true, true, 12]);
        expect(turretSpitRect(s)).toMatchObject({ x: 11, y: 8, right: 15, bottom: 12 });
    });
});
