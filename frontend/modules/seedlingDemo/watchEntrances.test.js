/**
 * seedlingDemo/watchEntrances.test — WHERE THE GAME PUTS YOU, asserted
 * against the atlas rather than against a fixture this file invented.
 *
 * ⛔ THE ROWS THAT MATTER ARE THE ONES TIED TO THE ENGINE. A derivation that
 * says "an entrance is a teleporter with `to === N`" is worth nothing on its
 * own; what makes it a fact is that BOOTING at an entrance's coordinates puts
 * the player exactly where `arriveIn` puts them when they walk through that
 * teleporter. Two of these rows ask the engine that question directly.
 */

import { describe, expect, it } from 'vitest';

import {
    BOOT_TO_PLAYER_OFFSET, collectEntrances, entranceLabel, entrancesTo, playerPointFor,
} from './watchEntrances.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { arriveIn } from './playerPhysicsV2.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const levels = [...loadAtlas().levels.map((l) => l.level)].sort((a, b) => a - b);
const collected = collectEntrances(levelSource, levels);

describe('the entrance index', () => {
    /**
     * ⛔ THE MEASUREMENT THE ITEM WAS DESIGNED ON, PINNED. If these numbers
     * move, the sentences the page prints about them ("112 of 116", "four of
     * the rooms are like this") have quietly stopped being true — and those
     * sentences are the whole reason a reader trusts the control.
     */
    it('⛔ scans the whole atlas and refuses nothing', () => {
        expect(collected.scanned).toBe(levels.length);
        expect(collected.refused).toEqual([]);
    });

    it('⛔ 112 of the 116 rooms have an entrance, and the four without are named', () => {
        const without = levels.filter((n) => !collected.index.has(n));
        expect(without).toEqual([58, 69, 81, 84]);
        expect(levels.length - without.length).toBe(112);
        const total = [...collected.index.values()].reduce((n, l) => n + l.length, 0);
        expect(total).toBe(280);
    });

    /**
     * ⚠ THE ORDINAL IS NOT DECORATION. Measured: L94 holds TWO teleporters into
     * L0 and L24 holds two into L12 that share ONE arrival point, so `from`
     * alone is not a key and a picker keyed on it would silently offer one
     * option where the atlas has two.
     */
    it('⚠ ids are unique per destination, even when two entrances share a room', () => {
        for (const [to, list] of collected.index) {
            const ids = new Set(list.map((e) => e.id));
            expect(ids.size, `level ${to}`).toBe(list.length);
        }
        const toZero = collected.index.get(0).filter((e) => e.from === 94);
        expect(toZero.map((e) => e.id)).toEqual(['L94#0', 'L94#1']);
        expect(new Set(toZero.map((e) => `${e.x},${e.y}`)).size).toBe(2);
        // …and the case where the two DO share a point still gets two ids
        const toTwelve = collected.index.get(12).filter((e) => e.from === 24);
        expect(toTwelve).toHaveLength(2);
        expect(new Set(toTwelve.map((e) => e.id)).size).toBe(2);
        expect(new Set(toTwelve.map((e) => `${e.x},${e.y}`)).size).toBe(1);
    });

    /**
     * ⛔⛔⛔ THE ENGINE ROW — the one that makes this a derivation of the game's
     * answer rather than a plausible reading of some attributes.
     *
     * For every entrance in the atlas: booting a run at the entrance's
     * coordinates must land the player at EXACTLY the position `arriveIn`
     * gives for that teleporter. If the half tile were dropped, or the arrival
     * used where the ctor args belong, every one of these would be 8 px out.
     */
    it('⛔⛔⛔ booting at an entrance == walking through it, for all 280', () => {
        let checked = 0;
        for (const [to, list] of collected.index) {
            for (const e of list) {
                const world = buildLevelWorld(levelSource(to), { roles: ['trigger'] });
                const walked = arriveIn(world, { arrival: e.arrival });
                const booted = createRunForStaging(
                    solveStaging({ version: 8, name: 'e', boot: { level: to, x: e.x, y: e.y } }),
                    levelSource,
                ).state;
                expect(booted.x, e.id).toBe(walked.x);
                expect(booted.y, e.id).toBe(walked.y);
                checked += 1;
            }
        }
        expect(checked).toBe(280);
    });

    /**
     * ⛔⛔ THE HALF TILE, STATED AS AN EQUATION THE ENGINE HAS TO SATISFY.
     * A boot block holds `Game`'s ctor args; the Player ctor re-centres onto
     * the tile. Everything on the page that shows both numbers depends on this
     * being exactly `BOOT_TO_PLAYER_OFFSET` and not "about 8".
     */
    it('⛔⛔ a boot block\'s coordinates are the CTOR ARGS, offset by the half tile', () => {
        expect(BOOT_TO_PLAYER_OFFSET).toBe(8);
        const e = collected.index.get(10)[0];
        expect(playerPointFor(e)).toEqual(e.arrival);
        const booted = createRunForStaging(
            solveStaging({ version: 8, name: 'e', boot: { level: 10, x: e.x, y: e.y } }),
            levelSource,
        ).state;
        expect({ x: booted.x, y: booted.y }).toEqual(playerPointFor(e));
    });

    /**
     * ⚠ A DEACTIVATED TELEPORTER IS CARRIED, NOT FILTERED. Its arrival point is
     * still exactly where the game would put you; what is shut is the ROUTE.
     * Dropping it would hide a real entrance and offering it unmarked would
     * imply a way in that does not exist, so it rides with its flag and the
     * label says so.
     */
    it('⚠ the atlas\'s one deactivated teleporter is listed, and marked', () => {
        const all = [...collected.index.values()].flat();
        const off = all.filter((e) => e.deactivated);
        expect(off).toHaveLength(1);
        expect(entranceLabel(off[0])).toMatch(/DEACTIVATED/);
        expect(all.filter((e) => e.isStairs)).toHaveLength(52);
    });

    /** ⚠ THREE ANSWERS, and two of them are absences with different causes. */
    it('⚠ entrancesTo names its absences instead of returning a bare empty', () => {
        const unbuilt = entrancesTo(null, 4);
        expect(unbuilt.entrances).toEqual([]);
        expect(unbuilt.why).toMatch(/has not been built/);
        expect(unbuilt.why).toMatch(/NOT\s+the same as/);

        const none = entrancesTo(collected, 58);
        expect(none.entrances).toEqual([]);
        expect(none.why).toMatch(/no teleporter anywhere in the atlas/);
        expect(none.why).toMatch(/58, 69, 81, 84/);

        const some = entrancesTo(collected, 10);
        expect(some.why).toBe(null);
        expect(some.entrances.map((e) => e.from)).toEqual([9, 11]);
        expect(unbuilt.why).not.toBe(none.why);
    });

    /**
     * ⛓ THE LABEL LEADS WITH THE SOURCE ROOM because it is the only field that
     * always distinguishes: entrances to one level share a destination, and two
     * of them can share an arrival point.
     */
    it('⛓ the label names the room you came from, both coordinate pairs, and stairs', () => {
        const fromEleven = collected.index.get(10).find((e) => e.from === 11);
        const label = entranceLabel(fromEleven);
        expect(label).toMatch(/^from L11/);
        expect(label).toContain('stairs');
        expect(label).toContain(`start ${fromEleven.x},${fromEleven.y}`);
        expect(label).toContain(`${fromEleven.arrival.x},${fromEleven.arrival.y}`);
    });

    /**
     * ⚠ A COMMITTED BOOT AND AN ENTRANCE ANSWER DIFFERENT QUESTIONS, and the
     * page's ladder rests on that being true rather than assumed. MEASURED
     * here so a future change that "unified" them has to argue with a number:
     * L10's committed boot sits ON its L9 entrance, L20's does not sit on
     * either of its.
     */
    it('⚠ a committed boot may or may not be an entrance — both happen', () => {
        const ten = collected.index.get(10);
        expect(ten.some((e) => e.x === 48 && e.y === 80)).toBe(true);   // r3-collect-sword
        const twenty = collected.index.get(20);
        expect(twenty.some((e) => e.x === 112 && e.y === 72)).toBe(false); // r3-collect-shield
    });
});
