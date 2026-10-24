import { describe, it, expect } from 'vitest';
import {
    BLAST_DAMAGE, BLAST_PLAN, FREEZE_SPAN, ICE_TURRET_BLAST, blastIsSpent,
    createIceTurretBlast, iceTurretBlastRect, spawnVolley, stepIceTurretBlast,
} from './iceTurretBlast.js';
import { ICE_TURRET, createIceTurret, stepIceTurret } from './iceTurret.js';
import { FP_ELAPSED } from './chasers.js';

/** A blast's box against a player box, with nothing else in the world. */
const solo = (b, playerBox = null) => stepIceTurretBlast(b, { playerBox });

describe('the constants, against `Projectiles/IceTurretBlast.as`', () => {
    it('the hitbox is 4x4 CENTRED — `setHitbox(4, 4, 2, 2)`', () => {
        const b = createIceTurretBlast('t#1.0', 100, 200, 6, 0);
        expect(iceTurretBlastRect(b)).toMatchObject({
            x: 98, y: 198, right: 102, bottom: 202, w: 4, h: 4,
        });
    });

    it('⛔ `hitables` is NARROWER than `Mobile.solids` and WIDER than `Crusher`\'s', () => {
        expect(ICE_TURRET_BLAST.hitables).toEqual(['Player', 'Tree', 'Solid', 'Shield']);
        // The player's list, for the contrast that makes this a third list.
        expect(ICE_TURRET.solids).toContain('Rope');
        expect(ICE_TURRET_BLAST.hitables).not.toContain('Rope');
        // ...and a Tree stops a blast, which `Crusher.solids` (["Solid"])
        // does not stop a crusher with.
        expect(ICE_TURRET_BLAST.hitables).toContain('Tree');
    });

    it('⛔ `solids` is EMPTY — its own hitable check is its only stop', () => {
        expect(ICE_TURRET_BLAST.solids).toEqual([]);
    });

    it('⛔ the `case "Enemy"` arm is DEAD and is recorded as dead', () => {
        // `collideTypesInto(hitables, ...)` can never put an Enemy in the
        // vector, so the switch arm below it is unreachable. Transcribed so
        // a later reader knows it was seen and ruled out, not missed.
        expect(ICE_TURRET_BLAST.deadSwitchArm).toBe('Enemy');
        expect(ICE_TURRET_BLAST.hitables).not.toContain('Enemy');
    });
});

describe('⛓⛓⛓ THE FREEZE SPAN — FOURTEEN, FROM FIFTEEN', () => {
    it('the arithmetic, not the outcome: `freezeStep` runs ABOVE `input()`', () => {
        // `Player.update` calls `freezeStep()` at :532 and `super.update()`
        // (whose `mobileUpdate` calls `input()`) after it — so the contact
        // tick's own decrement lands before the gate is read, and the gate
        // `frozenTimer > 0` first fails on the tick the decrement writes 0.
        let frozen = 0;
        const refused = [];
        // The blast updates FIRST (it prepends), so the write is tick 0's.
        for (let t = 0; t < 20; t += 1) {
            if (t === 0) frozen = ICE_TURRET_BLAST.freezeTicks;
            if (frozen > 0) frozen -= 1;      // freezeStep()
            if (frozen > 0) refused.push(t);  // Player.input()'s first line
        }
        expect(refused.length).toBe(FREEZE_SPAN.refusedTicks);
        expect(FREEZE_SPAN.refusedTicks).toBe(14);
        expect(refused[0]).toBe(0);
        expect(refused[refused.length - 1]).toBe(13);
    });

    it('⛔ a refused tick is NOT a dead frame, and the two must never merge', () => {
        // `Game.freezeObjects` skips the whole `mobileUpdate` and costs the
        // tape its observation; `frozenTimer` skips `input()` alone, so
        // friction and both sweeps still run and the tape keeps counting.
        expect(FREEZE_SPAN.isDeadFrames).toBe(false);
    });

    it('⛔⛔ …and it BURNS a press, but does not cancel an open window', () => {
        // `useItem` is called from inside `input()`, below the return;
        // `slash()`/`fire()` are called from `Player.update` above it.
        expect(FREEZE_SPAN.burnsAPress).toBe(true);
        expect(FREEZE_SPAN.cancelsAnOpenWindow).toBe(false);
    });

    it('⛓ a zero-force knockback displaces NOTHING — the term is verified', () => {
        // `Player.knockback` is `v.x += f * center.x` behind two magnitude
        // tests, and the blast passes f = 0. Under `noDamage` even that
        // never runs, but the claim has to be about the `noDamage: false`
        // arm too — otherwise "the blast only freezes" is a statement about
        // a flag rather than about the class.
        expect(BLAST_DAMAGE.force).toBe(0);
        expect(BLAST_DAMAGE.knockbackDisplaces).toBe(0);
        expect(BLAST_DAMAGE.gates).toContain('hits < hitsMax');
        expect(BLAST_DAMAGE.shakeIsCameraOnly).toBe(true);
    });
});

describe('the volley — three bodies, one velocity, INT spawn points', () => {
    it('⛔ the ctor params are `int`, so the off-centre spawns TRUNCATE', () => {
        // Aim straight down: angle -90 => a = +90deg => v = (0, 6) modulo
        // the cosine's own epsilon, and the perpendicular is (0, ... ) — so
        // pick an angle whose offsets are provably fractional instead.
        const v = spawnVolley('t', 1, 487.5, 424, -82.17);
        expect(v).toHaveLength(3);
        expect(v.map((b) => [b.x, b.y])).toEqual([[487, 424], [475, 425], [499, 422]]);
        // ⛓ and every one of them is an integer, which is the claim.
        for (const b of v) {
            expect(Number.isInteger(b.x)).toBe(true);
            expect(Number.isInteger(b.y)).toBe(true);
        }
    });

    it('⛓ ALL THREE SHARE ONE VELOCITY — the spread is a translation, not a fan', () => {
        const v = spawnVolley('t', 1, 487.5, 424, -82.17);
        expect(v[1].v).toEqual(v[0].v);
        expect(v[2].v).toEqual(v[0].v);
        expect(Math.hypot(v[0].v.x, v[0].v.y)).toBeCloseTo(ICE_TURRET_BLAST.speed, 12);
    });

    it('the offsets are ±12 px PERPENDICULAR to the aim', () => {
        const v = spawnVolley('t', 1, 400, 400, 0);   // a = 0 => due east
        // a + PI/2 is due south in screen coords, so blast 1 is BELOW.
        expect(v[0].v.x).toBeCloseTo(6, 12);
        expect(Math.abs(v[0].v.y)).toBeLessThan(1e-12);
        expect(v[1].y - v[0].y).toBe(12);
        expect(v[2].y - v[0].y).toBe(-12);
        expect(v[1].x).toBe(400);
    });
});

describe('the flight', () => {
    it('moves 6 px/tick, ACCUMULATED IN 1 px STEPS (not `x += v.x`)', () => {
        const b = createIceTurretBlast('t#1.0', 0, 0, 0.84, 5.94);
        solo(b);
        // `Mobile.moveX`'s loop: 1,1,1,1,1,0.94 — a different double from
        // one addition of 5.94, which is why the loop is transcribed.
        let acc = 0;
        for (let i = 0; i < 5.94; i += 1) acc += Math.min(1, 5.94 - i);
        expect(b.y).toBe(acc);
        expect(b.x).toBe(0.84);
    });

    it('⛔ `friction()` still runs with f = 0, and ZEROES an axis under 0.05', () => {
        // A shot within ~0.48 degrees of an axis loses its cross component
        // permanently on its first tick — `Mobile.friction`'s two tests are
        // below the `normalize`, which f = 0 makes an identity.
        const b = createIceTurretBlast('t#1.0', 0, 0, 0.04, 6);
        solo(b);
        expect(b.v.x).toBe(0);
        expect(b.x).toBe(0);
    });

    it('⛔ the COLLISION TEST is not freeze-gated — only the move is', () => {
        const b = createIceTurretBlast('t#1.0', 100, 100, 6, 0);
        const box = { x: 99, y: 99, right: 103, bottom: 103 };
        const r = stepIceTurretBlast(b, { frozen: true, playerBox: box });
        // It did not move (mobileUpdate's gate)...
        expect(b.x).toBe(100);
        // ...and it froze the player anyway (update()'s own body, below it).
        expect(r.hitPlayer).toBe(true);
        expect(r.removed).toBe(true);
    });

    it('⛓⛓ COVER IS A RESOURCE: any Solid removes it, player or not', () => {
        const b = createIceTurretBlast('t#1.0', 0, 0, 0, 6);
        const r = stepIceTurretBlast(b, {
            playerBox: null,
            blockedAt: () => true,
        });
        expect(r.removed).toBe(true);
        expect(r.hitTypes).toEqual(['Solid']);
        expect(BLAST_PLAN.avoidable).toBe(false);
    });

    it('…and a wall and the player on the same tick is ONE removal, both reported', () => {
        const b = createIceTurretBlast('t#1.0', 0, 6, 0, 6);
        const r = stepIceTurretBlast(b, {
            playerBox: { x: -4, y: 8, right: 4, bottom: 16 },
            blockedAt: () => true,
        });
        expect(r.hitPlayer).toBe(true);
        expect(r.hitTypes).toEqual(['Player', 'Solid']);
    });

    it('a removed blast is inert on every later tick', () => {
        const b = createIceTurretBlast('t#1.0', 0, 0, 0, 6);
        stepIceTurretBlast(b, { blockedAt: () => true });
        const at = b.y;
        const r = stepIceTurretBlast(b, { blockedAt: () => true });
        expect(b.y).toBe(at);
        expect(r.hitPlayer).toBe(false);
    });
});

describe('⛔ the prune, and it is not a lifetime', () => {
    const reach = { x: 0, y: 0, right: 100, bottom: 100 };

    it('a blast inside the reach is never spent', () => {
        expect(blastIsSpent(createIceTurretBlast('a', 50, 50, 6, 0), reach)).toBe(false);
    });

    it('outside AND receding is spent', () => {
        expect(blastIsSpent(createIceTurretBlast('a', 110, 50, 6, 0), reach)).toBe(true);
    });

    it('⛓ outside and APPROACHING is NOT — the direction is half the test', () => {
        // The game has no bound at all, so a prune that dropped this one
        // would be inventing a lifetime rather than proving unreachability.
        expect(blastIsSpent(createIceTurretBlast('a', 110, 50, -6, 0), reach)).toBe(false);
    });
});

describe('⛓⛓⛓ THE VOLLEY CLOCK, DRIVEN THROUGH THE TURRET', () => {
    /** A turret with a player parked due south, inside range and stationary. */
    const rig = () => {
        const t = createIceTurret(472, 400);
        const player = { x: 488, y: 500 };
        const fired = [];
        for (let k = 1; k <= 140; k += 1) {
            stepIceTurret(t, { player, terrainAt: null });
            if (t.spawned) fired.push(k);
        }
        return { t, fired };
    };

    it('⛔ a turret that starts IN RANGE fires on tick ONE — `shootTimer` seeds 0', () => {
        // `shootTimer` is `private var shootTimer:int = 0`, and the fire arm
        // is the `else` of `if (shootTimer > 0) shootTimer--`. So a turret
        // whose first live tick is already in range does not wait 25 — it
        // shoots. What spends the 25 is every OUT-of-range tick writing
        // `shootTimerMax` back, so the count starts at the range boundary.
        const { fired } = rig();
        expect(fired[0]).toBe(1 + BLAST_PLAN.spawnTickAfterPlay);
    });

    it('⛓⛓ …and one that walks INTO range spends 25 first — the L40 phase', () => {
        // The case the recording pinned: the player crosses the 128 px
        // boundary at tick R, the play is at R+25 and the blasts at R+28.
        const t = createIceTurret(472, 400);
        const far = { x: t.x, y: t.y + 400 };
        const near = { x: t.x, y: t.y + 100 };
        for (let k = 0; k < 10; k += 1) stepIceTurret(t, { player: far, onScreen: false });
        let fired = -1;
        for (let k = 1; k <= 60 && fired < 0; k += 1) {
            stepIceTurret(t, { player: near, onScreen: false });
            if (t.spawned) fired = k;
        }
        expect(fired).toBe(ICE_TURRET.shootTimerMax + 1 + BLAST_PLAN.spawnTickAfterPlay);
    });

    it('⛔ and the period is 45 — the ANIMATION plus 26, not 25 from the shot', () => {
        const { fired } = rig();
        expect(fired[1] - fired[0]).toBe(BLAST_PLAN.volleyPeriodTicks);
        expect(fired[2] - fired[1]).toBe(BLAST_PLAN.volleyPeriodTicks);
        // ⛓ THE ARITHMETIC, ASSERTED — not just the outcome. `update()`'s
        // `else { shootTimer = shootTimerMax }` runs on every tick of both
        // animations, because the anim test is in the SAME `&&` as the
        // range test — so the 25 restarts when the animation ENDS:
        //
        //   play at T … anim ends at T+19 … 25 decrements T+20..T+44 …
        //   shootTimer is 0 at T+44 and the fire arm is reached at T+45.
        //
        // A schedule's slack can hide an arithmetic error, so the period is
        // built out of its two terms here and only then compared.
        expect(BLAST_PLAN.animEndTickAfterPlay + ICE_TURRET.shootTimerMax + 1)
            .toBe(BLAST_PLAN.volleyPeriodTicks);
    });

    it('the two animation lengths come from `_timer += rate * FP.elapsed`', () => {
        // Ten increments of 0.333 leave 3.33, not 10/3 — the wraps are at
        // 4 and 16 updates, which a division to 3 and 15 would miss.
        const wrapAt = (frames) => {
            let timer = 0; let index = 0;
            for (let n = 1; n <= 200; n += 1) {
                timer += ICE_TURRET.attackAnimSpeed * FP_ELAPSED;
                while (timer >= 1) {
                    timer -= 1; index += 1;
                    if (index === frames) return n;
                }
            }
            return -1;
        };
        expect(wrapAt(1)).toBe(4);
        expect(wrapAt(5)).toBe(16);
        // play -> callback is (updates - 1) ticks, because the play tick's
        // own graphic update is the first increment.
        expect(wrapAt(1) - 1).toBe(BLAST_PLAN.spawnTickAfterPlay);
        expect((wrapAt(1) - 1) + wrapAt(5)).toBe(BLAST_PLAN.animEndTickAfterPlay);
    });

    it('⛔ the range test TRUNCATES — `var d:int = FP.distance(...)`', () => {
        // 128.9 px is in range and 129.0 is not, so the boundary is a
        // pixel further out than `attackRange` reads.
        // ⚠ DRIVEN OFF SCREEN, and that is not a convenience. An on-screen
        // turret's `input()` snaps its own y by 8 px on its first tick, so
        // a range test driven on screen measures a body that has moved —
        // which is exactly the confusion that put slice 21's model 33 ticks
        // out. Off screen the body is pinned at its constructor point AND
        // still shoots, because the screen gate is inside `Enemy.update`
        // and the aim block is one frame above it.
        const at = (dy) => {
            const t = createIceTurret(472, 400);
            const player = { x: t.x, y: t.y + dy };
            let fired = false;
            for (let k = 0; k < 40 && !fired; k += 1) {
                stepIceTurret(t, { player, onScreen: false });
                if (t.spawned) fired = true;
            }
            expect(t.y).toBe(416);
            return fired;
        };
        expect(at(128.9)).toBe(true);
        expect(at(129.0)).toBe(false);
    });

    it('⛔⛔⛔ AN OFF-SCREEN TURRET STILL SHOOTS — and does NOT move', () => {
        // `Enemy.update`'s `if (!activeOffScreen && !onScreen()) return`
        // returns out of `super.update()`; `IceTurret.update`'s aim-and-fire
        // tail is BELOW that call and runs regardless. So the camera decides
        // whether the body moves and its terrain kills it — not whether it
        // is a threat. The 8 px `input()` snap is the observable half, and
        // it is what makes `onScreen` load-bearing for the volley PHASE.
        const off = createIceTurret(472, 400);
        const on = createIceTurret(472, 400);
        const player = { x: 488, y: 500 };
        for (let k = 0; k < 8; k += 1) {
            stepIceTurret(off, { player, onScreen: false });
            stepIceTurret(on, { player, onScreen: true });
        }
        // ⛔ The off-screen body is EXACTLY at its constructor point; the
        // on-screen one is 8 px down and oscillating on the rest cycle's
        // two values (§34.6's two-cycle, which is why this is `oneOf`).
        expect(off.y).toBe(416);
        expect([423.5, 424]).toContain(on.y);
        expect(on.y - off.y).toBeGreaterThanOrEqual(7.5);
        expect(off.volleys).toBe(1);
        expect(on.volleys).toBe(1);
    });

    it('⛓ a turret with no player is INERT — the seam a corpse probe wants', () => {
        const t = createIceTurret(472, 400);
        for (let k = 0; k < 200; k += 1) stepIceTurret(t, {});
        expect(t.anim).toBe('');
        expect(t.volleys).toBe(0);
    });

    it('⛔⛔ a ceremony does NOT stop a volley already in the barrel', () => {
        // `Spritemap.update` is called by `World.update` and reads no
        // freeze flag at all, so `endAnim` fires on schedule through frozen
        // frames. What the freeze stops is the DECISION to start another.
        const t = createIceTurret(472, 400);
        const player = { x: 488, y: 500 };
        let played = -1;
        for (let k = 1; k <= 30 && played < 0; k += 1) {
            stepIceTurret(t, { player });
            if (t.anim === 'startshot') played = k;
        }
        expect(played).toBeGreaterThan(0);
        // Freeze from here on: the animation still reaches its callback.
        let fired = -1;
        for (let k = played + 1; k <= played + 10 && fired < 0; k += 1) {
            stepIceTurret(t, { player, frozen: true });
            if (t.spawned) fired = k;
        }
        expect(fired).toBe(played + BLAST_PLAN.spawnTickAfterPlay);
    });

    it('⛓ the i-frame gates the NEXT volley — `else if (hitsTimer <= 0)`', () => {
        const base = createIceTurret(472, 400);
        const hurt = createIceTurret(472, 400);
        const player = { x: 488, y: 500 };
        const runTo = (t, n, hitAt = -1) => {
            const at = [];
            for (let k = 1; k <= n; k += 1) {
                // A landed hit sets `hitsTimer = 30` during the PLAYER's
                // update, i.e. after this body's own — so it is written
                // between two steps, which is where this puts it.
                if (k === hitAt) t.hitsTimer = ICE_TURRET.hitsTimerMax;
                stepIceTurret(t, { player });
                if (t.spawned) at.push(k);
            }
            return at;
        };
        const clean = runTo(base, 120);
        // ⚠ THE HIT HAS TO BE LIVE WHEN THE FIRE ARM IS REACHED, and a hit
        // during the ANIMATION is not: 30 i-frames drain inside the 19-tick
        // animation plus the 25 decrements after it, so the gate is already
        // open when the clock comes round. Landed at tick 40, six ticks
        // before the second play, it is not.
        const gated = runTo(hurt, 120, 40);
        expect(gated[0]).toBe(clean[0]);
        expect(gated[1] - clean[1]).toBeGreaterThan(0);
        // ⛓ AND THE SLIP IS THE TIMER'S REMAINDER, NOT A FIXED PENALTY. The
        // `else if (hitsTimer <= 0)` refuses on each tick the gate is shut
        // and the clock is already at zero, so the volley lands on the first
        // tick after the i-frame drains.
        expect(gated[1] - clean[1]).toBeLessThanOrEqual(ICE_TURRET.hitsTimerMax);
    });
});
