/**
 * endingChain.test.js — the ending's mechanics, as a SECOND derivation.
 *
 * ⛔ THE MUTATION LIST these are written against:
 *
 *  · the talk radius read as a box          -> `levelWorld`'s watcher rect is
 *                                              the bounding SQUARE; using it
 *                                              as the schedule's test opens
 *                                              the dialogue up to 10 px early
 *  · the starting release also advancing    -> every dialogue one page short,
 *    a page                                    and the seed window off by one
 *  · leaving the radius modelled as a       -> it calls `doneTalking()`, so it
 *    CANCEL                                    EARNS the tag; a control built
 *                                              on "walk away" proves nothing
 *  · the door's half-tile constructor       -> the door and its 32 px circle
 *                                              land 8 px north-west
 *  · the 200-frame fades counted as TICKS   -> a ~690-frame window read as a
 *                                              dead bot by `deadlineFor`
 *  · the tree grow taken at 60 fps          -> 274 where the game says 138
 */

import { describe, expect, it } from 'vitest';

import {
    COVER_ALPHA_RATE,
    EndingError,
    FINAL_DOOR,
    NPC_LINE_LENGTH,
    SEED_ARMS,
    SEED_CEREMONY_FRAMES,
    TALK_RANGE,
    TREE_GROW_FRAMES,
    WATCHER,
    beginNpcDialogue,
    boxHitsWatcherSeed,
    coverFadeFrames,
    finalDoorOpenUpdates,
    freshFinalDoor,
    inTalkRange,
    stepFinalDoor,
    stepNpcDialogue,
    treeGrowUpdates,
    watcherSeedBox,
} from './endingChain.js';
import { atlasLevelSource } from './levelSource.js';
import { HITBOX } from './playerPhysicsV1.js';

const source = atlasLevelSource();
const L114 = source(114);
const WATCHER_OEL = L114.entities.find((e) => e.type === 'watcher');
const WATCHER_ENTITY = {
    x: WATCHER_OEL.x + WATCHER.ctor.dx,
    y: WATCHER_OEL.y + WATCHER.ctor.dy,
};
const playerBox = (x, y) => ({
    x: x - HITBOX.originX,
    y: y - HITBOX.originY,
    right: x - HITBOX.originX + HITBOX.width,
    bottom: y - HITBOX.originY + HITBOX.height,
});

describe('the placed NPC: a radius, a start, and an exit that still pays', () => {
    it('the Watcher is at (80,80) — the ctor half-tile, from the extract', () => {
        expect(WATCHER_OEL).toMatchObject({ x: 72, y: 72 });
        expect(WATCHER_ENTITY).toEqual({ x: 80, y: 80 });
        expect(WATCHER_OEL.attrs.tag).toBe('0');
        // The talk speed is the `frames` ATTRIBUTE, not a class default —
        // `Game.as:2237` passes `o.@frames` as `_talkingSpeed`.
        expect(WATCHER_OEL.attrs.frames).toBe('3');
    });

    it('the talk test is a CIRCLE, and the bounding square is 10 px wider', () => {
        // Dead south at exactly 24: in. One further: out.
        expect(inTalkRange(WATCHER_ENTITY, { x: 80, y: 104 })).toBe(true);
        expect(inTalkRange(WATCHER_ENTITY, { x: 80, y: 105 })).toBe(false);
        // ⛔ THE CORNER IS WHERE A BOX MODEL LIES. (80+17, 80+17) is inside
        // the 48x48 bounding square `levelWorld` prices and OUTSIDE the
        // circle the game tests — 24.04 px away.
        expect(inTalkRange(WATCHER_ENTITY, { x: 97, y: 97 })).toBe(false);
        expect(Math.hypot(17, 17)).toBeGreaterThan(TALK_RANGE);
    });

    it('⛔ the STARTING release does not also advance a page', () => {
        // `NPC.talk()` tests `if (talking)` BEFORE `if (inRange) …
        // startTalking()`, so the frame that opens the dialogue has already
        // skipped the advance arm. The model expresses that by construction:
        // a dialogue does not exist until it is begun, so the release that
        // begins it cannot be handed to `stepNpcDialogue`.
        const d = beginNpcDialogue('one~two', { talkingSpeed: 3 });
        expect(d.page).toBe(0);
        expect(d.currentCharacter).toBe(0);
        expect(d.done).toBe(false);
    });

    it('refuses a dialogue with no talking speed rather than defaulting to 0', () => {
        expect(() => beginNpcDialogue('hi', {})).toThrow(EndingError);
        expect(() => beginNpcDialogue('hi', {})).toThrow(/`frames` ATTRIBUTE/);
    });

    it('⛔⛔ LEAVING THE RADIUS IS NOT A CANCEL — it runs `doneTalking()`', () => {
        // `NPC.talk`'s `else` arm is `talked = false; if (talking) talking =
        // false;` and the SETTER's `if (!talking)` branch ends with
        // `doneTalking()`. For the Watcher that is the `{114,0}` write,
        // guarded only by `checkPersistence(tag)` — still set. So walking
        // away mid-dialogue EARNS THE TAG exactly as finishing it does.
        //
        // ⇒ a W-talk control built on "walk out of range" would clear the
        // flag it exists to withhold. The control has to end the TAPE while
        // still inside the circle instead.
        const d = beginNpcDialogue('one~two~three', { talkingSpeed: 3 });
        const out = stepNpcDialogue(d, false, false);
        expect(out.left).toBe(true);
        expect(d.done).toBe(true);
        // ...and the page counter is reset, which is what makes a
        // re-approach start from page 0.
        expect(d.page).toBe(0);
        expect(d.currentCharacter).toBe(0);
    });

    it('⛓ a release on the LEAVING frame still advances first', () => {
        // The game's order: the advance arm runs, THEN the radius `else`.
        // A model that tore down first would lose a page on every exit.
        const d = beginNpcDialogue('a~b', { talkingSpeed: 3 });
        // Type page 0 out so the next release advances rather than skipping.
        for (let i = 0; i < 40; i += 1) stepNpcDialogue(d, false, true);
        expect(d.page).toBe(0);
        const before = d.page;
        stepNpcDialogue(d, true, false);
        // It advanced (to page 1, or straight to done) and THEN left.
        expect(d.done).toBe(true);
        expect(before).toBe(0);
    });

    it('a dialogue that stays in range runs to `done` on its own releases', () => {
        const d = beginNpcDialogue('a~b~c', { talkingSpeed: 3 });
        let frames = 0;
        // Release every 8 frames — comfortably past the 3-frames/character
        // typing of a one-character page.
        while (!d.done && frames < 500) {
            stepNpcDialogue(d, frames > 0 && frames % 8 === 0, true);
            frames += 1;
        }
        expect(d.done).toBe(true);
        expect(frames).toBeLessThan(500);
    });

    it('a placed NPC wraps at 28 columns, a pickup\'s at 32', () => {
        // `NPC`'s `_lineLength` default is 28 and `Pickup.as:101` passes 32.
        // The wrap changes `.length`, and `.length` is exactly what the
        // page-advance test compares against — so the two cannot share one
        // constant.
        expect(NPC_LINE_LENGTH).toBe(28);
        const long = 'a'.repeat(60);
        const wide = beginNpcDialogue(long, { talkingSpeed: 3, lineLength: 32 });
        const narrow = beginNpcDialogue(long, { talkingSpeed: 3, lineLength: 28 });
        expect(narrow.pages[0].length).not.toBe(wide.pages[0].length);
    });
});

describe('⛔⛔⛔ the Watcher\'s live Seed — a run-ender 10 px from the stance', () => {
    it('the box is [65,75) x [73,87), derived through three offsets', () => {
        expect(watcherSeedBox(WATCHER_OEL))
            .toEqual({ x: 65, y: 73, right: 75, bottom: 87 });
    });

    it('a stance dead SOUTH of the Watcher clears it, and one NW does not', () => {
        // The W-talk stance: inside the 24 px circle, outside the seed box.
        expect(inTalkRange(WATCHER_ENTITY, { x: 80, y: 100 })).toBe(true);
        expect(boxHitsWatcherSeed(playerBox(80, 100), WATCHER_OEL)).toBe(false);
        // ⛔ AND THE NORTH-WEST APPROACH IS THE ONE THAT ENDS THE RUN. A
        // player 10 px north-west of the same Watcher is equally "in range"
        // and standing in the pickup.
        expect(inTalkRange(WATCHER_ENTITY, { x: 70, y: 80 })).toBe(true);
        expect(boxHitsWatcherSeed(playerBox(70, 80), WATCHER_OEL)).toBe(true);
    });

    it('the seed is live for OVER HALF the dialogue, so a stance cannot wait it out', () => {
        // `myCurrentText ∈ [9, 19]` of a 20-page text.
        const pages = beginNpcDialogue(WATCHER_OEL.attrs.text,
            { talkingSpeed: Number(WATCHER_OEL.attrs.frames) }).pages;
        expect(pages).toHaveLength(20);
        const live = WATCHER.seedIndexMax - WATCHER.seedIndexMin + 1;
        expect(live).toBe(11);
        expect(live / pages.length).toBeGreaterThan(0.5);
    });
});

describe('the door: one approach, two arms, and a whole-tile constructor', () => {
    const L113 = source(113);
    const DOOR_OEL = L113.entities.find((e) => e.type === 'finaldoor');

    it('⛔ the entity is (128,16) — a WHOLE tile, not the usual half', () => {
        expect(DOOR_OEL).toMatchObject({ x: 112, y: 0 });
        expect(FINAL_DOOR.ctor.dx).toBe(16);
        expect(FINAL_DOOR.ctor.dy).toBe(16);
        const entity = { x: DOOR_OEL.x + 16, y: DOOR_OEL.y + 16 };
        expect(entity).toEqual({ x: 128, y: 16 });
        // The body: `setHitbox(32, 32, 16, 16)` about that point.
        expect({
            x: entity.x - 16, y: entity.y - 16, right: entity.x + 16, bottom: entity.y + 16,
        }).toEqual({ x: 112, y: 0, right: 144, bottom: 32 });
    });

    it('the open animation is 57 updates at the clamped elapsed', () => {
        expect(finalDoorOpenUpdates()).toBe(57);
    });

    it('⛓⛓ the ceremony and the open are ONE APPROACH — §2.5 refuted', () => {
        let s = freshFinalDoor();
        const ctx = { inRadius: true, sealControllerUp: false,
            hasAllSealParts: true, talkedToWatcher: true };
        // First tick in radius: the ceremony, unconditionally.
        let r = stepFinalDoor(s, ctx);
        expect(r.event).toBe('ceremony');
        s = r.state;
        // The 180 frozen frames: the door's own `update` runs (it is an
        // Entity with no freeze gate) and does nothing, because
        // `mySealController` is up.
        for (let n = 0; n < 180; n += 1) {
            r = stepFinalDoor(s, { ...ctx, sealControllerUp: true });
            expect(r.event).toBeNull();
            s = r.state;
        }
        // `SealController.removed()` nulls `parent.mySealController`, so the
        // NEXT tick of the SAME approach opens it.
        r = stepFinalDoor(s, ctx);
        expect(r.event).toBe('open');
        s = r.state;
        // ...and 57 updates later `animEnd` removes it, which is the
        // `{113,0}` CLEAR.
        let removedAt = null;
        for (let n = 1; n <= 100 && removedAt === null; n += 1) {
            r = stepFinalDoor(s, ctx);
            s = r.state;
            if (r.event === 'removed') removedAt = n;
        }
        expect(removedAt).toBe(57);
        expect(s.removed).toBe(true);
    });

    it('⛓ leaving the radius resets `seenSeal`, so a RE-approach re-ceremonies', () => {
        let s = freshFinalDoor();
        const ctx = { inRadius: true, sealControllerUp: false,
            hasAllSealParts: false, talkedToWatcher: false };
        expect(stepFinalDoor(s, ctx).event).toBe('ceremony');
        s = stepFinalDoor(s, ctx).state;
        // Still in radius, nothing more happens — the gates are shut.
        expect(stepFinalDoor(s, ctx).event).toBeNull();
        // Step out...
        s = stepFinalDoor(s, { ...ctx, inRadius: false }).state;
        expect(s.seenSeal).toBe(false);
        // ...and back in: a FRESH ceremony, 180 more frozen frames.
        expect(stepFinalDoor(s, ctx).event).toBe('ceremony');
    });

    it('⛔ the open arm needs BOTH gates — either one alone is silence', () => {
        const after = (hasAllSealParts, talkedToWatcher) => {
            let s = freshFinalDoor();
            const ctx = { inRadius: true, sealControllerUp: false,
                hasAllSealParts, talkedToWatcher };
            s = stepFinalDoor(s, ctx).state;           // the ceremony
            return stepFinalDoor(s, ctx).event;
        };
        expect(after(true, true)).toBe('open');
        expect(after(true, false)).toBeNull();
        expect(after(false, true)).toBeNull();
        expect(after(false, false)).toBeNull();
    });
});

describe('the seed: three arms, two reboots, and ~690 frozen frames', () => {
    it('the cover fade is 200 frames BY ACCUMULATION, and the division agrees', () => {
        expect(coverFadeFrames()).toBe(200);
        // ⚠ A BOUNDED VACUITY, RECORDED WITH ITS WITNESS. The naive
        // `1 / 0.005` is 200 too, so the accumulate-don't-divide law does not
        // bite HERE. It bites two lines down.
        expect(1 / COVER_ALPHA_RATE).toBe(200);
        // The witness: 199 increments leave 0.995, and 200 overshoots 1.
        let a = 0;
        for (let n = 0; n < 199; n += 1) a += COVER_ALPHA_RATE;
        expect(a).toBeLessThan(1);
        expect(a + COVER_ALPHA_RATE).toBeGreaterThan(1);
    });

    it('...and the tree grow is 138, where the same division says 274', () => {
        expect(treeGrowUpdates()).toBe(138);
        expect(Math.round(TREE_GROW_FRAMES / (3.5 / 60))).toBe(274);
    });

    it('⛔⛔ every ceremony frame but the dialogue is FROZEN — ~690 of them', () => {
        // `deadlineFor` scales from `frozenFramesOwed`; a deadline scaled
        // from the tick count would look at this window and see a dead bot.
        expect(SEED_CEREMONY_FRAMES.specialTimer).toBe(150);
        expect(SEED_CEREMONY_FRAMES.fade).toBe(200);
        expect(SEED_CEREMONY_FRAMES.treeGrow).toBe(138);
        expect(SEED_CEREMONY_FRAMES.frozenTotal).toBe(688);
        expect(SEED_CEREMONY_FRAMES.reboots).toBe(2);
    });

    it('⛓⛓⛓ the plain arm is what ARMS the tree arm — `_tree` is `cutscene[2]`', () => {
        // `Game.as:2194`: `new Seed(o.@x, o.@y, false, o.@text, cutscene[2])`.
        // So the two are one chain and not two options, and the SAME arm is
        // benign in L115 and a soft-lock in L114 — decided by whether the
        // destination has a `seed` object to rebuild.
        expect(SEED_ARMS.plain.sets).toMatch(/cutscene\[2\] = true/);
        expect(SEED_ARMS.plain.why).toMatch(/L114, which has none/);
        expect(SEED_ARMS.tree.sets).toMatch(/menu = true/);
        expect(SEED_ARMS.bloody.reboot).toEqual({ level: 1, x: 64, y: 96 });
    });

    it('L115 really does hold the seed the tree arm needs, and L114 does not', () => {
        // The claim above, put to the extract rather than asserted.
        expect((source(115).entities ?? []).some((e) => e.type === 'seed')).toBe(true);
        expect((source(114).entities ?? []).some((e) => e.type === 'seed')).toBe(false);
        // ...and L1, the bloody destination, holds the Oracle that makes
        // that branch end in a menu too.
        expect((source(1).entities ?? []).some((e) => e.type === 'oracle')).toBe(true);
    });
});
