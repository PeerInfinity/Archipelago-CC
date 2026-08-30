/**
 * bobBoss — the encounter's numbers, each derived a SECOND way.
 *
 * Every constant in `bobBoss.js` is a transcription, so the useful question
 * here is not "does the module return what it says" — it is "does the number
 * survive a different derivation, and does the extract still agree".
 * `r5Chain.test.js` does the same job for the route declarations.
 */

import { describe, expect, it } from 'vitest';

import { buildLevelWorld, ROLES, rectsOverlap, rect } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { pagesOf } from './dialogue.js';
import { animTicks } from './chasers.js';
import { KILL_PRESS_CADENCE } from './combatVerbs.js';
import { ENEMY_IFRAMES } from './combat.js';
import {
    ARENA, ROCK, BOSS_IFRAMES, FORM_TRANSITION_FRAMES, FORM_TELEPORT_AT, FORMING_FRAMES,
    BOB_BOSS_FORMS, BOSS_LINE_LENGTH, BOSS_TEXT_SPEED, FIRE, BURNABLE_TREE,
    BOB_BOSS_LEDGER, BobBossError, rockSchedule, formPresses, bobBossPressBill,
} from './bobBoss.js';

const source = atlasLevelSource();
const world = buildLevelWorld(source(ARENA.level), { roles: ROLES });

describe('the rock, and the 174 frames it costs', () => {
    it('the extract really holds the boss rock, with the declared tag', () => {
        const raw = source(ARENA.level).entities.find((e) => e.type === 'fallrocklarge');
        expect(raw).toBeDefined();
        expect(raw.x).toBe(ROCK.sealsRect.x);
        expect(raw.attrs).toMatchObject({ bossrock: '1', thirdboss: '1' });
        expect(Number(raw.attrs.tag)).toBe(ROCK.tag);
    });

    it('the arm line is DERIVED — `fallTo - height/2 - 8`, not a stated number', () => {
        // `super(_x + Tile.w, _y + Tile.h)` makes `fallTo` 144 out of an OEL
        // y of 128, and the sprite is 32 tall.
        expect(ROCK.fallTo).toBe(ROCK.sealsRect.y + 16);
        expect(ROCK.armY).toBe(ROCK.fallTo - ROCK.sealsRect.h / 2 - 8);
        // ...and the arrival is eight pixels clear of it, which is the whole
        // margin the key leg has to stop inside.
        expect(ARENA.arrival.y - ROCK.armY).toBe(8);
    });

    it('the fall is 24 steps, and the closed form agrees with the loop', () => {
        const s = rockSchedule();
        expect(s.fallTicks).toBe(24);
        // y = -32 + 0.3·n·(n+1). The loop is the transcription; this is the
        // independent derivation, and it is the one that shows 23 is short.
        const yAt = (n) => ROCK.fallFrom + 0.3 * n * (n + 1);
        expect(yAt(23)).toBeLessThan(ROCK.fallTo);
        expect(yAt(24)).toBeGreaterThanOrEqual(ROCK.fallTo);
        expect(s.landsAt).toBeCloseTo(yAt(24), 6);
    });

    it('and the whole arm is 174 frames', () => {
        const s = rockSchedule();
        expect(s.bossSpawnsAt).toBe(174);
        expect(s.waitTicks + s.fallTicks + s.cameraTicks).toBe(s.bossSpawnsAt);
    });

    it('⛓ THE PROBE SAID THOSE 174 ARE DEAD FRAMES', () => {
        // `r5-bobboss-arm` came back `dead_frames = 195` — the boot fade plus
        // exactly these — so the arm costs the tape nothing. It is asserted
        // here as arithmetic over the measured total rather than as a second
        // recording: 195 - 174 is the ~21-frame room fade every boot pays.
        const MEASURED_DEAD_FRAMES = 195;
        const bootFade = MEASURED_DEAD_FRAMES - rockSchedule().bossSpawnsAt;
        expect(bootFade).toBeGreaterThanOrEqual(19);
        expect(bootFade).toBeLessThanOrEqual(22);
    });

    it('⛔ the rock lands ON the stairs, which is how the arena seals', () => {
        const stairs = world.teleporters.find((t) => t.to === 30);
        const sealed = rect(ROCK.sealsRect.x, ROCK.sealsRect.y, ROCK.sealsRect.w,
            ROCK.sealsRect.h);
        expect(rectsOverlap(sealed, stairs.rect)).toBe(true);
    });
});

describe('the three forms', () => {
    it('⛔ form 1 has NO hitsMax of its own — 2+3+2 comes from a missing case', () => {
        expect(BOB_BOSS_FORMS.map((f) => f.hitsMax)).toEqual([2, 3, 2]);
        // `Enemy.hitsMax = 3` is the default the switch never overrides for
        // form 1, so the widest form is the one the source says least about.
        expect(BOB_BOSS_FORMS[1].hitsMax).toBe(3);
        expect(BOB_BOSS_FORMS.reduce((n, f) => n + f.hitsMax, 0)).toBe(7);
    });

    it('the declared pages ARE what the shipped wrapper produces at 28 columns', () => {
        // ⚠ 28, not 32. `BobBossNPC`'s `super(...)` passes no `_lineLength`,
        // so it takes `NPC`'s default rather than a pickup ceremony's 32 —
        // and `endlineText` INSERTS rather than replaces on a non-space, so
        // the wrapped page's `.length` is what the page-advance test reads.
        expect(BOSS_LINE_LENGTH).toBe(28);
        for (const f of BOB_BOSS_FORMS) {
            expect(pagesOf(f.text, BOSS_LINE_LENGTH), `form ${f.index}`)
                .toEqual([...f.pages]);
        }
        expect(BOB_BOSS_FORMS.map((f) => f.pages.length)).toEqual([3, 7, 4]);
        expect(BOSS_TEXT_SPEED).toBe(6);
    });

    it('the transition teleport starts a THIRD of the way from the end', () => {
        expect(FORM_TRANSITION_FRAMES).toBe(120);
        expect(FORM_TELEPORT_AT).toBe(40);
        expect(FORMING_FRAMES).toBe(60);
        // `player.x = FP.width / 2; player.y = FP.height - 40` in a 160x160
        // room — and it repeats every frame for all 40, so a model that
        // applied it once would let the player drift for 39.
        expect(ARENA.transitionTo).toEqual({ x: 80, y: 120 });
    });

    it('⚠ and the teleport lands the player exactly ON the arm line, not past it', () => {
        // `p.y < 120` is strict, so being written to 120 does not re-arm
        // anything. One pixel the other way and every transition would fire
        // a rock that has already fallen.
        expect(ARENA.transitionTo.y).toBe(ROCK.armY);
    });

    it('the press bill is 7 landed, 10 with slack, at the i-frame cadence', () => {
        const bill = bobBossPressBill();
        expect(bill.landed).toBe(7);
        expect(bill.presses).toBe(10);
        // ⚠ Re-checked against the shared derivation rather than re-derived:
        // two transcriptions of one number is what put slice 2's census
        // eight pixels off the map.
        expect(BOSS_IFRAMES).toBe(ENEMY_IFRAMES);
        expect(bill.cadence).toBe(KILL_PRESS_CADENCE);
    });

    it('refuses a cadence the boss would simply ignore', () => {
        expect(() => bobBossPressBill({ cadence: BOSS_IFRAMES }))
            .toThrow(BobBossError);
        expect(() => bobBossPressBill({ cadence: 21 })).toThrow(/i-frames/);
    });

    it('halves with a doubled damage, which is what the dark sword buys', () => {
        expect(formPresses(BOB_BOSS_FORMS[1], { damage: 2, slack: 0 }).landed).toBe(2);
        expect(bobBossPressBill({ damage: 2, slack: 0 }).landed).toBe(4);
    });

    it('refuses a form it cannot read rather than returning NaN', () => {
        expect(() => formPresses(null)).toThrow(BobBossError);
        expect(() => formPresses({ hitsMax: 1.5 })).toThrow(BobBossError);
        expect(() => formPresses(BOB_BOSS_FORMS[0], { damage: 0 })).toThrow(BobBossError);
    });
});

describe('the reward, and the flag it writes in another level', () => {
    it('⛔ `setPersistence(-1)` in L32 lands on L31 tag 29', () => {
        // `Main.levelPersistenceSet(i, j)` writes `levelPersistence[i*30 + j]`.
        const TAGS_PER_LEVEL = 30;
        const index = ARENA.level * TAGS_PER_LEVEL + FIRE.tag;
        expect(index).toBe(959);
        expect(Math.floor(index / TAGS_PER_LEVEL)).toBe(FIRE.outOfBandFlag.level);
        expect(index % TAGS_PER_LEVEL).toBe(FIRE.outOfBandFlag.tag);
        // ...and 29 is the LAST slot, which is the part that makes it look
        // like a legitimate entry rather than an overflow.
        expect(FIRE.outOfBandFlag.tag).toBe(TAGS_PER_LEVEL - 1);
    });

    it('the ledger names all three writers, and only one is the boss\'s own', () => {
        expect(BOB_BOSS_LEDGER.map((e) => `${e.level}:${e.tag}`))
            .toEqual(['32:1', '31:29', '32:0']);
    });

    it('Fire spawns at the room centre and its ceremony is two pages', () => {
        expect(FIRE.at).toEqual({ x: 80, y: 80 });
        expect(FIRE.at).toEqual(ARENA.bossAt);
        // Both are `FP.width/2 - Tile.w/2` through a ctor that adds Tile/2
        // back — so the reward appears exactly where the boss stood.
        expect(pagesOf(FIRE.text, 32)).toHaveLength(2);
        expect(FIRE.specialTimerMax).toBe(150);
    });

    it('⛔ the burnable tree covers BOTH pit tiles — the exit needs fire', () => {
        const tree = world.solids.find((s) => s.tag === 'burnabletree');
        expect(tree.rect).toEqual(rect(BURNABLE_TREE.at.x, BURNABLE_TREE.at.y,
            BURNABLE_TREE.at.w, BURNABLE_TREE.at.h));
        expect(world.pitTiles).toHaveLength(2);
        for (const pit of world.pitTiles) {
            expect(rectsOverlap(tree.rect, pit.rect)).toBe(true);
        }
        expect(world.fallthrough.level).toBe(30);
    });

    it('the burn is 41 ticks, not 40 — the step is 0.4995', () => {
        // `15 * FP.elapsed` is 0.4995, so twenty frames need 41 updates.
        // Dividing by 0.5 gives 40 and the difference is a whole tick of a
        // window floor.
        expect(BURNABLE_TREE.burnTicks).toBe(animTicks(BURNABLE_TREE.burnFrames,
            BURNABLE_TREE.burnRate));
        expect(BURNABLE_TREE.burnTicks).toBe(41);
        expect(Math.ceil(20 / 0.5)).toBe(40);
    });
});
