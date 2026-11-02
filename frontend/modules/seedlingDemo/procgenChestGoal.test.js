/**
 * seedlingDemo/procgenChestGoal.test — **A LOOT CHEST AS A ROOM'S GOAL CERTIFIES** (seedling-js-chest-goal-collect,
 * the js-side prerequisite of ⚖ Robert's 2026-11-01 pick "(e) Loot/goal chests").
 *
 * THE DEFECT (lab, 4/4): a `collect-placement` goal on a chest's placement selects the `chest` verb
 * (`solverBot.resolveCollectStrategy`), the solve opens the chest and takes the SealPiece `Chest.open()` spawns
 * (`Chest.as:78`), and `procgenOracle.certifyCollects` — which only read `pickup:{x,y}` — found "no collect record"
 * and THREW the seam error, aborting a whole generation run. The `chest` record names its target as
 * `chest:{id,x,y}` and carries `collectedAt`, the seal collection `runChest` waits for.
 *
 * THE ROOMS (10x10 `emptyLevel`, boot (1,1) unless said; both biomes' boot items):
 *   `loot-open`   the chest is the goal at (5,5), the stance row below it free (15 of the 16 vanilla chests);
 *   `loot-north`  the chest is the goal at (5,1), against the north wall (L17/L86's shape);
 *   `loot-south`  the chest is the goal at (5,8), against the SOUTH wall: the stance row is the border — the
 *                 legitimately uncertifiable layout, which must REVERT (a REFUSED verdict), never throw;
 *   `door-south`  the CONTROL: a wall across row 4 with the chest in its only gap at (5,4), boot (1,8), the goal a
 *                 torch pickup at (8,2) — the chest is opened from below as a door, `[chest, collect]`.
 *
 * Before the fix (base `c84a3592ab`): loot-open and loot-north THROW `ProcgenOracleError … no collect record for
 * place:80,80 / place:80,16` in both biomes; loot-south REFUSES (`STANCE_REENTRY`); the control SOLVES. After: the
 * loot-* rooms certify with a `collected` row keyed to the chest's placement, loot-south still REFUSES, and the
 * control's certificate, records and tape are byte-identical (digests measured at the base, below).
 *
 * MUTANTS (each measured red, then reverted — the slice's report):
 *  (M1) `certifyCollects` without the chest arm (`?? rows.find(isChestCollect …)`) ⇒ 6 red: the four loot-open /
 *       loot-north rows THROW (the defect, restored) and the goal-chest and seal-removed unit rows;
 *  (M2) every `chest` record put into `collected` (not only a goal's) ⇒ 3 red: both door-south digest rows and the
 *       "door chest elsewhere" unit row;
 *  (M3) `isChestCollect` without the `collectedAt` condition ⇒ the "opened, never collected" unit row reds;
 *  (M4) the chest arm not keyed to the goal's placement ⇒ the "door chest elsewhere" unit row reds.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { VERDICT, bootStaging, certifyCollects, collectGoal, solve } from './procgenOracle.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';

const LEVEL = 900;
const BIOMES = [['pre-sword', null], ['post-sword', POST_SWORD_ITEMS]];
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** A 10x10 room whose only entity is a chest at `tile`, and that chest is the goal. */
function lootRoom(tile) {
    const at = oelAtTile(tile.tx, tile.ty);
    return {
        record: withEntities(emptyLevel({ level: LEVEL }), [{ type: 'chest', ...at, attrs: { tag: '0' } }]),
        goal: at,
        boot: { tx: 1, ty: 1 },
    };
}

/** The control: the chest is a DOOR in a wall's only gap, opened from below on the way to a torch pickup. */
function doorSouthRoom() {
    let record = emptyLevel({ level: LEVEL });
    record = withTerrain(record, [1, 2, 3, 4, 6, 7, 8].map((tx) => ({ tx, ty: 4, terrain: 'wall' })));
    const chest = oelAtTile(5, 4);
    const goal = oelAtTile(8, 2);
    record = withEntities(record, [
        { type: 'chest', ...chest, attrs: { tag: '1' } },
        { type: 'torchpickup', ...goal, attrs: { tag: '0' } },
    ]);
    return { record, goal, boot: { tx: 1, ty: 8 } };
}

const solveRoom = ({ record, goal, boot }, items, name) => solve(record,
    bootStaging({ boot: bootAtTile(record, boot.tx, boot.ty), items }), [collectGoal(goal.x, goal.y)],
    undefined, name ? { name } : {});

describe('a LOOT CHEST named as the goal certifies by its own `chest` record, keyed to its placement', () => {
    for (const [biome, items] of BIOMES) {
        for (const [name, tile] of [['loot-open', { tx: 5, ty: 5 }], ['loot-north', { tx: 5, ty: 1 }]]) {
            it(`${biome} ${name}: SOLVED, and the collect row is the chest's place`, () => {
                const room = lootRoom(tile);
                const out = solveRoom(room, items, name);
                expect(out.verdict).toBe(VERDICT.SOLVED);
                expect(out.records.map((r) => r.strategy)).toEqual(['chest']);
                expect(out.records[0].chest).toMatchObject({ x: room.goal.x, y: room.goal.y });
                expect(Number.isInteger(out.records[0].collectedAt)).toBe(true);
                expect(out.certification).toEqual({
                    certified: true,
                    missing: [],
                    collected: [{
                        tag: 'chest', x: room.goal.x, y: room.goal.y, item: 'sealpiece', strategy: 'chest',
                        id: `chest@${room.goal.x},${room.goal.y}`,
                    }],
                });
            }, 60000);
        }

        it(`${biome} loot-south: the uncertifiable layout REVERTS (REFUSED, by name) — it does not throw`, () => {
            const out = solveRoom(lootRoom({ tx: 5, ty: 8 }), items, 'loot-south');
            expect(out.verdict).toBe(VERDICT.REFUSED);
            expect(out.reasonText).toMatch(/STANCE_REENTRY/);
            expect(out.certification).toBeUndefined();
        }, 60000);
    }
});

describe('the CONTROL: a door chest\'s certificate is byte-identical to the base', () => {
    /** Measured at the base, `c84a3592ab`, before the fix: `[ticks, certification, records, tape]` digests (default name). */
    const BASE = {
        'pre-sword': [274, '66097b268a457bd3', '09c8251cd4b2d20a', '9718648407e46e9d'],
        'post-sword': [217, '66097b268a457bd3', '2ff3d749b65ea1dc', '2b8d0920bf146a34'],
    };
    for (const [biome, items] of BIOMES) {
        it(`${biome} door-south: SOLVED [chest, collect], the chest NOT in \`collected\`, every digest the base's`, () => {
            const out = solveRoom(doorSouthRoom(), items) // the default name: the tape carries it;
            expect(out.verdict).toBe(VERDICT.SOLVED);
            expect(out.records.map((r) => r.strategy)).toEqual(['chest', 'collect']);
            expect(out.certification.collected).toEqual([{
                tag: 'torchpickup', x: 128, y: 32, item: 'torch', strategy: 'collect',
            }]);
            expect([out.ticks, digest(out.certification), digest(out.records), digest(out.tape)])
                .toEqual(BASE[biome]);
        }, 60000);
    }
});

describe('certifyCollects, alone — the chest arm', () => {
    const chestRow = (x, y, extra = {}) => ({
        goal: 'collect-placement', strategy: 'chest', chest: { id: `chest@${x},${y}`, x, y, persistTag: 0 },
        collectedAt: 40, ...extra,
    });

    it('a goal chest certifies, and its collect row is keyed to the chest\'s place', () => {
        const out = certifyCollects([collectGoal(80, 80)], [chestRow(80, 80)]);
        expect(out).toEqual({
            certified: true, missing: [],
            collected: [{ tag: 'chest', x: 80, y: 80, item: 'sealpiece', strategy: 'chest', id: 'chest@80,80' }],
        });
    });

    it('a door chest ELSEWHERE certifies nothing and stays out of `collected`', () => {
        const out = certifyCollects([collectGoal(80, 80)], [chestRow(64, 64)]);
        expect(out).toEqual({ certified: false, missing: ['place:80,80'], collected: [] });
    });

    it('a chest record with no collect (opened, the piece never taken) certifies nothing', () => {
        const out = certifyCollects([collectGoal(80, 80)], [chestRow(80, 80, { collectedAt: undefined })]);
        expect(out.certified).toBe(false);
        expect(out.missing).toEqual(['place:80,80']);
    });

    it('the seal-removed arm (the game\'s `checkBySeal()`) certifies, with no piece taken', () => {
        const out = certifyCollects([collectGoal(80, 80)],
            [chestRow(80, 80, { collectedAt: undefined, arm: 'seal-removed' })]);
        expect(out.certified).toBe(true);
        expect(out.collected).toEqual([{
            tag: 'chest', x: 80, y: 80, item: null, strategy: 'chest', id: 'chest@80,80', arm: 'seal-removed',
        }]);
    });
});
