import { describe, expect, it } from 'vitest';

import {
    FINAL_BOSS, FINAL_BOSS_ANIMS, FINAL_BOSS_ANIM_UPDATES, FinalBossError,
    GRENADE_EXPLODE_UPDATES, POD_OPEN_UPDATES, ROCKFALL_BREAK_UPDATES, ROCK_FALL,
    advanceFinalBossGraphic, advancePodGraphic, advanceRockFallGraphic,
    animCallbackUpdates, createFinalBoss, createOwlRoom, createPod, createRockFall,
    finalBossBox, finalBossCoast, finalBossDeathSchedule, finalBossHit,
    finalBossKnockback, finalBossLavaVerdict, firstTileUnder, podIsLethal, podIsOpen,
    pointDistance, pointLength, rockFallBox, rockFallUpdatesToLand, setPodOpen,
    stepOwlRoom, stepRockFall,
} from './finalBossFight.js';
import { R6_ANIM_CLOCKS } from './r6Acceptance.js';
import { buildLevelWorld, ROLES } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';

const world = buildLevelWorld(atlasLevelSource()(112), { roles: ROLES });

describe('finalBossFight — the anim clocks, derived twice', () => {
    it('agrees with `R6_ANIM_CLOCKS` on every row this module owns', () => {
        // ⛓ TWO COST MODELS MUST AGREE. `r6Acceptance` derived these rows at
        // slice 6b from the same clamped elapsed; this module derives them
        // again rather than importing them, and the two are compared here.
        // A single table with one computation would be one thing to get
        // wrong, not two things that have to match.
        const mine = {
            'FinalBoss/die': FINAL_BOSS_ANIM_UPDATES.die,
            'FinalBoss/dead': FINAL_BOSS_ANIM_UPDATES.dead,
            'FinalBoss/walk': FINAL_BOSS_ANIM_UPDATES.walk,
            'RockFall/break': ROCKFALL_BREAK_UPDATES,
            'Pod/open': POD_OPEN_UPDATES,
            'Grenade/explode': GRENADE_EXPLODE_UPDATES,
        };
        for (const [key, got] of Object.entries(mine)) {
            const [owner, anim] = key.split('/');
            const row = R6_ANIM_CLOCKS.find((r) => r.owner === owner && r.anim === anim);
            expect(row, key).toBeTruthy();
            expect(got, key).toBe(row.expect);
        }
    });

    it('a frameRate of 0 never wraps — the `deadframe` terminal', () => {
        expect(FINAL_BOSS_ANIMS.deadframe.frameRate).toBe(0);
        expect(animCallbackUpdates(0, 1)).toBe(Infinity);
    });
});

describe('finalBossFight — the death schedule and its two fenceposts', () => {
    it('is 109 ticks from the kill, not §8.6\'s 110', () => {
        // ⛔ BOTH HALVES ARE TRAP 104's. `play("die")` happens inside
        // `update()`, so the die anim's first advance is that very tick and
        // its callback is `49 - 1` ticks later; `play("dead")` happens inside
        // the die CALLBACK, which resets `_timer` after this tick's advance,
        // so the dead anim's first advance is the NEXT tick and its callback
        // is a full 61 after that. 48 + 61 = 109.
        const s = finalBossDeathSchedule(1000);
        expect(s.dieEndsAt).toBe(1000 + 48);
        expect(s.tagTick).toBe(1000 + 109);
        expect(s.ticksFromKill).toBe(109);
        // ⚠ AND IT IS LEFT FOR A RECORDING TO ARBITRATE. §17.4 is the
        // precedent: the door's two fenceposts were only settled by the
        // game refusing the model. This is the same shape and the same risk.
        expect(s.dieUpdates + s.deadUpdates).toBe(110);
    });

    it('the graphic runs the chain even though the entity returns early', () => {
        const b = createFinalBoss({ x: 120, y: 128, tag: 0 });
        b.anim = 'die';
        b.animAge = 0;
        b.destroy = true;
        b.solid = true;
        let dieEnd = null;
        let deadEnd = null;
        // ⛓ THE LOOP STARTS AT 0 BECAUSE THE PLAY TICK IS ITS OWN FIRST
        // ADVANCE — `World.update` runs `e.update()` and `e._graphic.update()`
        // in one pass, so the tick whose `update()` called `play("die")` also
        // advanced the Spritemap. This is trap 104 expressed as an index.
        for (let t = 0; t <= 200; t += 1) {
            for (const e of advanceFinalBossGraphic(b)) {
                if (e.what === 'dieAnimEnded') dieEnd = t;
                if (e.what === 'deadAnimEnded') deadEnd = t;
            }
        }
        expect(dieEnd).toBe(48);
        expect(deadEnd).toBe(109);
        expect(b.tagsWritten).toBe(true);
        expect(b.anim).toBe('deadframe');
        // ⛔ AND THE CORPSE IS STILL SOLID. `death()` is overridden EMPTY, so
        // nothing fades and `FP.world.remove` is never called.
        expect(b.solid).toBe(true);
    });
});

describe('finalBossFight — `Enemy.hit`, both arms', () => {
    it('a sword press only SHOVES: no damage, no timer, so all five land', () => {
        const b = createFinalBoss({ x: 120, y: 128 });
        for (let i = 0; i < 5; i += 1) {
            const r = finalBossHit(b, {
                force: FINAL_BOSS.swordForce, fromX: 100, fromY: 128, type: 'Sword',
            });
            expect(r.landed).toBe(true);
            expect(r.damaged).toBeFalsy();
        }
        expect(b.hits).toBe(0);
        expect(b.hitsTimer).toBe(0);
        // Five collinear pushes of 5, straight east.
        expect(b.vx).toBeCloseTo(25, 10);
        expect(b.vy).toBeCloseTo(0, 10);
    });

    it('a lava hit damages, sets the 30-tick timer, and knocks from the centre', () => {
        const b = createFinalBoss({ x: 120, y: 128 });
        const r = finalBossHit(b, {
            force: FINAL_BOSS.lavaForce,
            fromX: FINAL_BOSS.lavaKnockFrom.x,
            fromY: FINAL_BOSS.lavaKnockFrom.y,
            type: 'Lava',
        });
        expect(r.damaged).toBe(true);
        expect(b.hits).toBe(1);
        expect(b.hitsTimer).toBe(FINAL_BOSS.hitsTimerMax);
        // ⛓ `(FP.width / 2, (FP.height - Tile.h) / 2)` with FP.width/height the
        // LEVEL's 240 — not the 160x160 screen. From (120,128) that is dead
        // south, so the knock is dead south too.
        expect(b.vx).toBeCloseTo(0, 10);
        expect(b.vy).toBeCloseTo(6, 10);
    });

    it('the third lava hit KILLS and does not knock', () => {
        const b = createFinalBoss({ x: 120, y: 128 });
        b.hits = 2;
        const r = finalBossHit(b, {
            force: FINAL_BOSS.lavaForce, fromX: 120, fromY: 112, type: 'Lava',
        });
        expect(r.killed).toBe(true);
        expect(b.vx).toBe(0);
        expect(b.vy).toBe(0);
    });

    it('refuses while a barrage is running, and says which gate', () => {
        // `canHit = rockfallTime < 0` — untouchable for all 240 ticks.
        const b = createFinalBoss({ x: 120, y: 128 });
        b.canHit = false;
        const r = finalBossHit(b, { force: 5, fromX: 100, fromY: 128, type: 'Sword' });
        expect(r.landed).toBe(false);
        expect(r.why).toMatch(/barrage/);
    });

    it('clamps at `maxForce` once it is set, and not before', () => {
        const b = createFinalBoss({ x: 120, y: 128 });
        expect(b.maxForce).toBe(-1);
        const first = finalBossHit(b, { force: 5, fromX: 100, fromY: 128, type: 'Sword' });
        expect(first.force).toBe(5);
        b.maxForce = FINAL_BOSS.maxForceAfterFirstLavaHit;
        const later = finalBossHit(b, { force: 5, fromX: 100, fromY: 128, type: 'Sword' });
        expect(later.force).toBe(2);
    });
});

describe('finalBossFight — the shove, derived on the real loop', () => {
    it('one unclamped press is 68.25 px over 18 ticks — NOT §14.4\'s 71.25', () => {
        // ⛔ RE-DERIVED, AS THE BRIEF REQUIRES. §14.4's table opens at
        // `|v| 5.75` on tick 1; on this transcription tick 1 moves ZERO,
        // because the Player updates LAST and the first hit test therefore
        // lands after the boss has already moved with `v = 0`. The five
        // 8.75 px steps and the 18-tick length agree with §14.4 exactly; the
        // total does not, by one tick-1 step.
        const r = finalBossCoast({ x: 110, y: 128, px: 100, py: 128 });
        expect(r.ticks).toBe(18);
        expect(r.total).toBeCloseTo(68.25, 10);
        expect(r.steps[0].step).toBe(0);
        expect(r.steps[1].step).toBeCloseTo(4.75, 10);
        for (const i of [2, 3, 4, 5]) expect(r.steps[i].step).toBeCloseTo(8.75, 10);
    });

    it('a clamped press (maxForce 2) is 50.50 px, still 18 ticks', () => {
        const r = finalBossCoast({ x: 110, y: 128, px: 100, py: 128, maxForce: 2 });
        expect(r.ticks).toBe(18);
        expect(r.total).toBeCloseTo(50.5, 10);
    });

    it('the cap never binds inside a press, which is why five tests compound', () => {
        // `if (v.length > 4) v.normalize(4)` sits in `update()`, above the
        // phases and BEFORE the player's `slash()`. So it only ever sees the
        // value the previous press left, never the one being built.
        const r = finalBossCoast({ x: 110, y: 128, px: 100, py: 128 });
        const peak = Math.max(...r.steps.map((s) => s.step));
        expect(peak).toBeGreaterThan(FINAL_BOSS.velocityCap * 2);
    });

    it('the knock is away from the player, along the ray through the body', () => {
        const b = createFinalBoss({ x: 100, y: 100 });
        finalBossKnockback(b, 5, 100, 110);
        expect(b.vx).toBeCloseTo(0, 10);
        expect(b.vy).toBeCloseTo(-5, 10);
    });
});

describe('finalBossFight — the runtime\'s own arithmetic (slice 6h, trap 118)', () => {
    /**
     * ⛔⛔⛔ THE MODEL MUST NOT BE MORE ACCURATE THAN THE GAME.
     *
     * `SWFRecomp`'s `point_get_length` is `sqrt(x*x + y*y)` and its
     * `point_normalize` is `x *= thickness / length`; `FP.distance` is
     * `Math.sqrt(dx*dx + dy*dy)`. `Math.hypot` computes the same real number
     * to better precision and a DIFFERENT double, and the Owl's walk/coast
     * split reads that double against `moveSpeed` at exactly the boundary.
     */
    const V = { x: 0.4265638150199433, y: -0.9044574681628931 };

    it('`pointLength` is `sqrt(x*x + y*y)` — and the witness shows it is not `Math.hypot`', () => {
        expect(pointLength(V.x, V.y)).toBe(Math.sqrt(V.x * V.x + V.y * V.y));
        // The positive witness: on this vector the two disagree, so the
        // assertion above cannot pass because the two happen to coincide.
        expect(pointLength(V.x, V.y)).not.toBe(Math.hypot(V.x, V.y));
        expect(Math.hypot(V.x, V.y) - pointLength(V.x, V.y)).toBeGreaterThan(0);
    });

    it('`pointDistance` is `FP.distance`, and its argument order cannot matter', () => {
        expect(pointDistance(1, 2, 4, 6)).toBe(5);
        expect(pointDistance(4, 6, 1, 2)).toBe(pointDistance(1, 2, 4, 6));
    });

    it('a coast whose speed descends THROUGH `moveSpeed` re-aims a tick sooner '
        + 'than `Math.hypot` says', () => {
        // The lava knock's own vector, from the W-owl plan's first hit: the
        // friction chain then descends 4.00, 3.75, … 1.00 and the split is
        // `v.length <= moveSpeed`, so it lands ON the boundary once.
        const KNOCK = { x: 3.25409913814836837531, y: -6.89977481447441043372 };
        const resumeTick = (len) => {
            let { x, y } = KNOCK;
            const norm = (l) => {
                const s = len(x, y);
                if (s === 0) return;
                const n = l / s;
                x *= n; y *= n;
            };
            for (let t = 1; t <= 20; t += 1) {
                norm(Math.max(len(x, y) - FINAL_BOSS.friction, 0));
                if (Math.abs(x) < 0.05) x = 0;
                if (Math.abs(y) < 0.05) y = 0;
                if (len(x, y) > FINAL_BOSS.velocityCap) norm(FINAL_BOSS.velocityCap);
                if (len(x, y) <= FINAL_BOSS.moveSpeed) return t;
            }
            return null;
        };
        // ⇒ the whole defect, in one number: thirteen coast ticks against
        // fourteen. The frame the model spent coasting is a frame the game
        // spent WALKING, and a walk tick rolls a grenade — one draw, after
        // which every random number in the fight is off by one.
        expect(resumeTick(pointLength)).toBe(13);
        expect(resumeTick(Math.hypot)).toBe(14);
    });

    it('the Owl leaves the coast on the tick the runtime\'s arithmetic says, '
        + 'through the real step', () => {
        const room = createOwlRoom({ tiles: world.tiles, seed: 1234567 });
        const player = { x: 40, y: 216, vx: 0, vy: 0 };
        stepOwlRoom(room, { player, introRelease: true });
        // Hand him the lava knock where he stands (no lava under him here, so
        // the arm under test is the COAST and nothing else).
        room.boss.vx = 3.25409913814836837531;
        room.boss.vy = -6.89977481447441043372;
        const phases = [];
        for (let t = 0; t < 16; t += 1) phases.push(stepOwlRoom(room, { player }).phase);
        expect(phases.indexOf('walk')).toBe(12); // the 13th tick after the knock
        expect(phases.slice(0, 12).every((p) => p === 'coast')).toBe(true);
    });
});

describe('finalBossFight — the lava test, and trap 95', () => {
    it('the walk from the spawn to pod0 never touches lava', () => {
        // §8.5's finding, re-checked through the SELECTION the game makes
        // rather than through the geometric question §8.5 asked.
        const room = createOwlRoom({ tiles: world.tiles, seed: 1234567 });
        const player = { x: 40, y: 216, vx: 0, vy: 0 };
        let lava = 0;
        for (let t = 0; t < 200; t += 1) {
            const r = stepOwlRoom(room, { player, introRelease: t === 2 });
            lava += r.events.filter((e) => e.what === 'lava').length;
        }
        expect(lava).toBe(0);
    });

    it('reports the game\'s predicate and the order-independent one apart', () => {
        // ⛔ trap 95: `collide("Tile", x, y)` returns ONE entity — the first
        // in world order, which is the reverse of the `.oel`'s. A box
        // straddling lava and floor hits or does not by a line number, so a
        // plan aims for `wholly` and this function refuses to conflate them.
        const centre = finalBossLavaVerdict(world.tiles, 120, 128);
        expect(centre.wholly).toBe(true);
        expect(centre.hit).toBe(true);
        const outside = finalBossLavaVerdict(world.tiles, 40, 216);
        expect(outside.touching).toBe(false);
        expect(outside.hit).toBe(false);
        // The octagon's own corner cell — the geometry §8.5 found CUT.
        const corner = finalBossLavaVerdict(world.tiles, 88, 104);
        expect(corner.wholly).toBe(false);
    });

    it('walks the tile list from the END, which is FlashPunk\'s world order', () => {
        const box = finalBossBox(120, 128);
        const first = firstTileUnder(world.tiles, box);
        const overlapping = world.tiles.filter((t) => {
            const r = t.rect;
            return box.right > r.x && box.bottom > r.y && box.x < r.right && box.y < r.bottom;
        });
        expect(overlapping.length).toBeGreaterThan(1);
        expect(first).toBe(overlapping[overlapping.length - 1]);
    });
});

describe('finalBossFight — the rocks', () => {
    it('lands on its sixteenth update, whatever the scale or the aim', () => {
        expect(rockFallUpdatesToLand()).toBe(16);
        for (const scale of [0.25, 0.5, 0.7499]) {
            const r = createRockFall(120, 128, scale);
            let landedAt = null;
            for (let t = 1; t <= 40 && landedAt === null; t += 1) {
                if (stepRockFall(r).landed) landedAt = t;
            }
            expect(landedAt, `scale ${scale}`).toBe(16);
        }
    });

    it('the hitbox is a DRAW, truncated twice — trap 108 at two `setHitbox`es', () => {
        const r = createRockFall(120.9, 128.9, 0.53125);
        // `RockFall(_x:int, _y:int)` truncates before anything else happens.
        expect(r.x).toBe(120);
        expect(r.goto).toBe(128);
        // `setHitbox(32 * scale, 16 * scale)` — ints, so 17 x 8.
        expect(r.width).toBe(17);
        expect(r.height).toBe(8);
        // and the second call re-derives the origins from the TRUNCATED pair.
        expect(r.originX).toBe(8);
        expect(r.originY).toBe(-0);
        const box = rockFallBox(r);
        expect(box.right - box.x).toBe(17);
    });

    it('the landing adds `scale + 1` to the shake and the break anim removes it', () => {
        const r = createRockFall(120, 128, 0.5);
        let shake = 0;
        for (let t = 1; t <= 16; t += 1) shake += stepRockFall(r).shake;
        expect(shake).toBeCloseTo(1.5, 10);
        let removed = null;
        for (let t = 1; t <= 40 && removed === null; t += 1) {
            if (advanceRockFallGraphic(r)) removed = t;
        }
        expect(removed).toBe(ROCKFALL_BREAK_UPDATES);
        expect(r.removeRequested).toBe(true);
    });

    it('the fall constants are the class\'s own', () => {
        expect(ROCK_FALL.fallHeight).toBe(96);
        expect(ROCK_FALL.startingSpeed).toBe(6);
        expect(ROCK_FALL.gravity).toBe(0.05);
        expect(ROCK_FALL.force).toBe(3);
        expect(ROCK_FALL.damage).toBe(1);
    });
});

describe('finalBossFight — the pods', () => {
    it('"closed" is 22 updates after the close, and only "closed" pins', () => {
        // ⛔ Both directions matter: a plan that treats a closing pod as
        // already lethal over-avoids by 22 ticks, one that treats it as safe
        // is 22 ticks late.
        const p = createPod({ x: 120, y: 56 });
        setPodOpen(p, false);
        expect(podIsLethal(p)).toBe(false);
        let closedAt = null;
        for (let t = 1; t <= 60 && closedAt === null; t += 1) {
            if (advancePodGraphic(p) === 'closed') closedAt = t;
        }
        expect(closedAt).toBe(POD_OPEN_UPDATES);
        expect(podIsLethal(p)).toBe(true);
        expect(podIsOpen(p)).toBe(false);
    });

    it('the getter is "open" OR "opened" — not a boolean the setter wrote', () => {
        const p = createPod({ x: 120, y: 56 });
        expect(podIsOpen(p)).toBe(true);
        for (let t = 0; t < POD_OPEN_UPDATES; t += 1) advancePodGraphic(p);
        expect(p.anim).toBe('opened');
        expect(podIsOpen(p)).toBe(true);
    });
});

describe('finalBossFight — the room, and the phase loop', () => {
    it('the intro costs no draws and pins the boss where he spawned', () => {
        const room = createOwlRoom({ tiles: world.tiles, seed: 1234567 });
        const player = { x: 40, y: 216, vx: 0, vy: 0 };
        const before = room.stream.count;
        for (let t = 0; t < 2; t += 1) stepOwlRoom(room, { player });
        expect(room.stream.count).toBe(before);
        expect(room.boss.x).toBe(72);
        expect(room.boss.y).toBe(104);
        expect(room.boss.started).toBe(false);
    });

    it('reaches pod0, opens the barrage, and spawns rocks off the schedule', () => {
        const room = createOwlRoom({ tiles: world.tiles, seed: 1234567 });
        const player = { x: 40, y: 216, vx: 0, vy: 0 };
        let began = null;
        let rocks = 0;
        for (let t = 0; t < 200; t += 1) {
            const r = stepOwlRoom(room, { player, introRelease: t === 2 });
            for (const e of r.events) {
                if (e.what === 'barrageBegan') began ??= t;
                if (e.what === 'rock') rocks += 1;
            }
        }
        expect(began).toBeGreaterThan(60);
        // ⛓ THE SNAP IS AN EVENT, NOT A RESTING PLACE. `x = pod.x; y = pod.y+1`
        // lands him on the pod, and then the BARRAGE arm runs — which never
        // touches `v`, so the walk velocity he arrived with carries him a few
        // more pixels off it under friction. Asserting the position here would
        // be asserting the friction tail, which is a different claim.
        expect(room.boss.rockfallTime).toBeGreaterThan(0);
        expect(Math.hypot(room.boss.x - 120, room.boss.y - 57)).toBeLessThan(3);
        // ⛓ `rockFrequency` is 6, so a 240-tick barrage fires ~40 rocks; a
        // partial one fires proportionally. The assertion is that the phase
        // is LIVE, not a count the seed happens to give.
        expect(rocks).toBeGreaterThan(0);
    });

    it('a landing lifts `Game.shake`, and the jiggle then draws every frame', () => {
        const room = createOwlRoom({ tiles: world.tiles, seed: 1234567 });
        const player = { x: 40, y: 216, vx: 0, vy: 0 };
        let sawJiggle = false;
        for (let t = 0; t < 200; t += 1) {
            const r = stepOwlRoom(room, { player, introRelease: t === 2 });
            if (r.jiggle) sawJiggle = true;
        }
        // ⛔ THE FEEDBACK LOOP §16.8 NAMES: the rocks the boss's draws made
        // land into a counter the frame's own `view()` reads.
        expect(sawJiggle).toBe(true);
        // ⚠ NOT `room.shake > 0` at the end: the decay is one per FRAME and
        // the landings are ~one in six ticks, so the counter passes through
        // zero between them. The claim is that the loop CLOSED at all.
    });

    it('the level build is consumed BEFORE tick 0', () => {
        const room = createOwlRoom({ tiles: world.tiles, seed: 55 });
        expect(room.stream.count).toBe(2);
        expect(room.stream.log.map((d) => d.site)).toEqual(['enemyCoins', 'orbRandVal']);
    });

    it('refuses a room with no tiles, by name', () => {
        expect(() => createOwlRoom({ seed: 1 })).toThrow(FinalBossError);
    });
});
