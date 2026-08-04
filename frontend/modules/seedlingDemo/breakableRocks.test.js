/**
 * breakableRocks — the sixth press arm.
 *
 * Three strata, deliberately: the ARITHMETIC (the animation and the
 * persistence index, both pure), the GEOMETRY (L92's two rocks, from the
 * extract), and the RUN (a press that actually breaks one, through
 * `levelRun`). The first two are what a reader checks against the AS3; the
 * third is the one that would go red if the plumbing between the run, the
 * planner and the physics ever stopped agreeing about which rocks are gone.
 */

import { describe, expect, it } from 'vitest';

import {
    BREAK_ANIM, BreakableRockError, FP_MAX_ELAPSED, HIT_TO_GONE_TICKS,
    TAGS_PER_LEVEL, WAIT_AFTER_PRESS_TICKS, animCallbackTick, assertWaitCovers,
    brokenRockIds, createRockState, hitRock, outOfBandFlagFor, rockBreaksUnder,
} from './breakableRocks.js';
import { FIRE_OUT_OF_BAND_FLAG } from './r5Acceptance.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { PRESS_ARM_POLICY } from './presses.js';
import { createLevelRun } from './levelRun.js';

const source = atlasLevelSource();
const L92 = () => buildLevelWorld(source(92), { roles: ROLES });

describe('the animation, transcribed rather than divided', () => {
    it('`endAnim` fires seven ticks after `play("break")`', () => {
        expect(HIT_TO_GONE_TICKS).toBe(7);
        expect(animCallbackTick()).toBe(7);
    });

    it('...and the truncated FP.elapsed and a true 1/30 AGREE', () => {
        // ⚠ THE POINT OF ASSERTING BOTH. `Engine.as:270` is the literal
        // 0.0333 and the arc has already been bitten by a derivation that
        // only worked for one value of a constant. 20/30 accumulates to
        // 0.9999999999999999 on the third update in doubles and misses the
        // `>= 1` by an ulp — the same tick 0.0333 misses it by 0.006.
        expect(animCallbackTick(BREAK_ANIM, FP_MAX_ELAPSED)).toBe(7);
        expect(animCallbackTick(BREAK_ANIM, 1 / 30)).toBe(7);
    });

    it('⛔ and the DIVISION disagrees, which is why the loop is transcribed', () => {
        // At a true 1/30 the closed form is exact: 4 / (20/30) = 6, and a
        // model that divided would clear the cell a tick early. The
        // accumulation does not, because 0.3333... + 0.6666... is
        // 0.9999999999999999 in doubles and the `while (_timer >= 1)` gate
        // is a strict comparison against a running SUM, not against a
        // product. One ulp, one tick, and the only defence is running the
        // loop the game runs.
        expect(Math.ceil(BREAK_ANIM.frames / (BREAK_ANIM.frameRate * (1 / 30)))).toBe(6);
        expect(animCallbackTick(BREAK_ANIM, 1 / 30)).toBe(7);
    });

    it('refuses an animation it cannot count', () => {
        expect(() => animCallbackTick({ frames: 0, frameRate: 20 })).toThrow(BreakableRockError);
        expect(() => animCallbackTick(BREAK_ANIM, 0)).toThrow(BreakableRockError);
    });
});

describe('⛔ the persistence write, resolved through `levelPersistenceSet`', () => {
    it('a tag -1 rock in L92 clears {91,29} — the PREVIOUS level\'s last slot', () => {
        expect(outOfBandFlagFor(92, -1)).toMatchObject({ level: 91, tag: 29, outOfBand: true });
    });

    it('and it reproduces the committed L32 answer, which was hard-coded', () => {
        // `r5Acceptance.FIRE_OUT_OF_BAND_FLAG` is this same arithmetic
        // written out for `Fire.removed()`. Two derivations of one rule is
        // how they drift, so the general form is checked against the
        // specific one rather than replacing it silently.
        expect(outOfBandFlagFor(32, -1))
            .toMatchObject({ level: FIRE_OUT_OF_BAND_FLAG.level, tag: FIRE_OUT_OF_BAND_FLAG.tag });
    });

    it('an in-band tag is its own level\'s flag, untouched', () => {
        expect(outOfBandFlagFor(92, 3)).toMatchObject({ level: 92, tag: 3, outOfBand: false });
        expect(outOfBandFlagFor(0, TAGS_PER_LEVEL - 1))
            .toMatchObject({ level: 0, tag: 29, outOfBand: false });
    });

    it('⛔ and it REFUSES the one case the game would write off the front', () => {
        // L0 tag -1 is index -1. The game writes outside the array; this
        // model says so rather than guessing, because "index -1" in AS3 is
        // a dynamic property and not a crash.
        expect(() => outOfBandFlagFor(0, -1)).toThrow(BreakableRockError);
    });
});

describe('what breaks a rock', () => {
    it('a PLAIN sword breaks a rockType-0 rock', () => {
        expect(rockBreaksUnder(0, {})).toBe(true);
        expect(rockBreaksUnder(0, { hasGhostSword: true })).toBe(true);
    });

    it('and only the ghostsword touches a rockType-1 one', () => {
        expect(rockBreaksUnder(1, {})).toBe(false);
        expect(rockBreaksUnder(1, { hasGhostSword: true })).toBe(true);
    });
});

describe('the per-visit state', () => {
    const rock = { rockId: 'breakablerock@256,112', persistTag: -1, rockType: 0, x: 256, y: 112 };

    it('a hit schedules the despawn and nothing before it', () => {
        const st = createRockState();
        const { started, goneAt } = hitRock(st, rock, 100);
        expect(started).toBe(true);
        expect(goneAt).toBe(100 + HIT_TO_GONE_TICKS);
        expect(brokenRockIds(st, goneAt - 1).size).toBe(0);
        expect(brokenRockIds(st, goneAt).has(rock.rockId)).toBe(true);
    });

    it('⛔ a SECOND hit does not restart it — `play("break")` early-returns', () => {
        // `Spritemap.play(name, reset = false)` opens with
        // `if (!reset && _anim && _anim._name == name) return _anim`, so the
        // timer keeps running. A model that reset it would push the despawn
        // later than the game's and the route would wait for a wall that had
        // already gone.
        const st = createRockState();
        const first = hitRock(st, rock, 100);
        const second = hitRock(st, rock, 104);
        expect(second.started).toBe(false);
        expect(second.goneAt).toBe(first.goneAt);
    });

    it('refuses a rock the world built without an id', () => {
        expect(() => hitRock(createRockState(), { x: 1, y: 2 }, 0)).toThrow(BreakableRockError);
    });

    it('the leg obligation is bigger than the transcription, and says why', () => {
        expect(WAIT_AFTER_PRESS_TICKS).toBeGreaterThan(HIT_TO_GONE_TICKS + 1);
        expect(assertWaitCovers(WAIT_AFTER_PRESS_TICKS, 'x')).toBe(true);
        expect(() => assertWaitCovers(HIT_TO_GONE_TICKS, 'the L92 leg'))
            .toThrow(/at least 20 ticks/);
    });
});

describe('L92\'s two rocks, from the extract', () => {
    it('both are `tag = -1` rockType-0 solids, and they carry ids', () => {
        const rocks = L92().solids.filter((s) => s.tag === 'breakablerock');
        expect(rocks.length).toBe(2);
        for (const r of rocks) {
            expect(r.rockId).toBe(`breakablerock@${r.x},${r.y}`);
            expect(r.rockType).toBe(0);
            expect(r.persistTag).toBe(-1);
        }
        expect(rocks.map((r) => `${r.x},${r.y}`).sort())
            .toEqual(['176,48', '256,112']);
    });

    it('⛓ and BOTH of them resolve to ONE ledger entry', () => {
        // Which is why the run keys its flag map by the FLAG and not by the
        // rock: two writes, one slot, one entry.
        const rocks = L92().solids.filter((s) => s.tag === 'breakablerock');
        const flags = new Set(rocks.map((r) => {
            const f = outOfBandFlagFor(92, r.persistTag);
            return `${f.level}:${f.tag}`;
        }));
        expect([...flags]).toEqual(['91:29']);
    });

    it('the geometry opens exactly where the rock was, and only there', () => {
        const world = L92();
        const rock = world.solids.find((s) => s.rockId === 'breakablerock@256,112');
        const box = playerBoxAt(rock.x + 8, rock.y + 8);
        expect(world.collidesSolid(box)?.rockId).toBe(rock.rockId);
        expect(world.collidesSolid(box, { brokenRocks: new Set([rock.rockId]) })).toBeNull();
        // ...and breaking the OTHER one leaves this cell solid, which is the
        // control that says the set is consulted by id rather than by class.
        expect(world.collidesSolid(box, { brokenRocks: new Set(['breakablerock@176,48']) })
            ?.rockId).toBe(rock.rockId);
    });

    it('and the planner sees the same thing the physics does', () => {
        const world = L92();
        const rock = world.solids.find((s) => s.rockId === 'breakablerock@256,112');
        const box = playerBoxAt(rock.x + 8, rock.y + 8);
        expect(world.plannerBlockerAt(box)?.blocker?.rockId).toBe(rock.rockId);
        expect(world.plannerBlockerAt(box, null, { brokenRocks: new Set([rock.rockId]) }))
            .toBeNull();
    });
});

describe('the press arm, through a real run', () => {
    /**
     * L0's own `breakablerock`, pressed — the `collide-up-rock` fixture's
     * level, driven by hand rather than by a tape so the press tick is a
     * constant of the test rather than of a recording.
     *
     * ⚠ THIS IS THE ARM THE POLICY TABLE JUST FLIPPED. Before slice 5 the
     * same press was a synthesis-time THROW ("a stray responder is a route
     * change, a ledger entry or a death — never a no-op"), so a test that
     * only checked the new behaviour would not notice if the refusal had
     * been removed for the wrong class.
     */
    const l0Rock = () => buildLevelWorld(source(0), { roles: ROLES })
        .solids.find((s) => s.tag === 'breakablerock');

    it('is MODELLED now, and the table says why', () => {
        expect(PRESS_ARM_POLICY.BreakableRock.policy).toBe('modelled');
        expect(PRESS_ARM_POLICY.BreakableRock.why).toMatch(/setPersistence/);
    });

    it('⛓ a swing at the rock breaks it, opens the cell and banks the flag', () => {
        const rock = l0Rock();
        expect(rock).toBeDefined();
        // Stand one tile WEST of the rock and face east: the slash rect is
        // 32x5 from the player, so the rock is inside it.
        const boot = { level: 0, x: rock.x - 24, y: rock.y };
        // ⚠ THE SWORD ARRIVES AS A GRANT NAMING THE BOOT LEVEL, which is
        // the only way a run holds an item: `weaponForPress` reads
        // `inventorySlotsFor(inventory)[primary]`, and an empty slot is a
        // SILENT no-op — the exact shape of a press test that passes while
        // pressing nothing.
        const run = createLevelRun({
            levelSource: source, boot, noclip: false,
            grants: [{ level: 0, items: ['sword'] }],
        });
        // A tick of `right` gives the press its FACING (`sprites()` derives
        // `direction` from velocity, sticky at rest), then the press.
        run.advance(new Set(['right']));
        for (let t = 0; t < 8; t += 1) run.advance(new Set());
        run.advance(new Set(['primary']));
        const pressTick = run.ticksCompleted;
        for (let t = 0; t < WAIT_AFTER_PRESS_TICKS; t += 1) run.advance(new Set());

        const broken = run.rocksBroken;
        expect(broken.length).toBe(1);
        expect(broken[0].id).toBe(rock.rockId);
        expect(broken[0].goneAt).toBeLessThanOrEqual(pressTick + 1 + HIT_TO_GONE_TICKS);
        expect(run.brokenRocks.has(rock.rockId)).toBe(true);
        // The cell the rock filled is walkable now, in the run's OWN view —
        // which is the one the planner reads.
        const box = playerBoxAt(rock.x + 8, rock.y + 8);
        expect(run.world.collidesSolid(box, { brokenRocks: run.brokenRocks })).toBeNull();
        // ...and the ledger names the flag `endAnim` wrote.
        const flag = outOfBandFlagFor(0, rock.persistTag);
        expect(run.earnedClears).toContainEqual(
            expect.objectContaining({ level: flag.level, tag: flag.tag }),
        );
    });

    it('⛔ and the cell is SOLID until the animation finishes', () => {
        // The half of the mechanic a route can trip over: `hit()` starts an
        // animation, `endAnim` removes the entity, and a leg that walks on
        // the press tick walks into a wall.
        const rock = l0Rock();
        const boot = { level: 0, x: rock.x - 24, y: rock.y };
        const run = createLevelRun({
            levelSource: source, boot, noclip: false,
            grants: [{ level: 0, items: ['sword'] }],
        });
        run.advance(new Set(['right']));
        for (let t = 0; t < 8; t += 1) run.advance(new Set());
        run.advance(new Set(['primary']));
        // One tick after the press the rect has fired and the timer is
        // running; the rock is still there.
        run.advance(new Set());
        expect(run.rocksBroken.length).toBe(1);
        expect(run.brokenRocks.size).toBe(0);
    });

    it('a swing with NO sword breaks nothing', () => {
        // The negative control the pair rule asks for: same stance, same
        // press, no weapon. `weaponForPress` finds an empty slot and the
        // press is a silent no-op in the game, so it is one here.
        const rock = l0Rock();
        const boot = { level: 0, x: rock.x - 24, y: rock.y };
        const run = createLevelRun({ levelSource: source, boot, noclip: false });
        run.advance(new Set(['right']));
        for (let t = 0; t < 8; t += 1) run.advance(new Set());
        run.advance(new Set(['primary']));
        for (let t = 0; t < WAIT_AFTER_PRESS_TICKS; t += 1) run.advance(new Set());
        expect(run.rocksBroken).toEqual([]);
        expect(run.earnedClears).toEqual([]);
    });
});
