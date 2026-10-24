/**
 * seedlingDemo/sealCeremony.test — the pickup that walks onto you.
 *
 * R5 slice 9. Three claims carry this file, and all three are places the
 * plausible reading is wrong:
 *
 *  1. the overlay is ~180 ticks, not the "60 fade + 60 wait" its own
 *     fields read as — there is a THIRD phase;
 *  2. the piece REACHES a stationary player, which the R3 static-rect
 *     model can never report;
 *  3. the freeze is invisible to `saw_auto_advance`, so the positive
 *     evidence has to be the dead frames.
 */

import { describe, expect, it } from 'vitest';

import {
    CEREMONY_DEAD_FRAMES, SEAL_AUTOADVANCE_BLIND_SPOT, SEAL_CONTROLLER, SEAL_MUSIC_STATICS,
    SEAL_PIECE, SealError, createSealPiece, sealApproachTicks, sealControllerTicks,
    sealPieceBox, stepSealPiece,
} from './sealCeremony.js';
import { chestStanceBand } from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import { playerBoxAt } from './playerPhysicsV2.js';

/** The join cell's geometry: the chest at (144,112), the walls either side. */
const CHEST_ENTITY = { x: 152, y: 120 };
/** Column 9 is open from the chest down; columns 8 and 10 of row 7 are wall. */
const openColumn = (x) => x >= 148 && x <= 156;
const blockedAt = (x, y) => !openColumn(x) || y < 112;

describe('⛓ the overlay has a THIRD phase, and it is most of it', () => {
    it('holds the freeze for 181 ticks, not 120', () => {
        expect(CEREMONY_DEAD_FRAMES.controller).toBe(181);
    });

    it('the "60 fade + 60 wait" reading is what the fields say and it is short', () => {
        const naive = SEAL_CONTROLLER.alphaSteps + SEAL_CONTROLLER.waitTime;
        expect(naive).toBe(120);
        expect(CEREMONY_DEAD_FRAMES.controller).toBeGreaterThan(naive);
        // The third phase runs alphaStep from alphaSteps to alphaSteps * 2,
        // plus the tick the removal itself takes.
        expect(CEREMONY_DEAD_FRAMES.controller).toBe(naive + SEAL_CONTROLLER.alphaSteps + 1);
    });

    it('the whole ceremony is 331 dead frames — the pickup plus the overlay', () => {
        expect(CEREMONY_DEAD_FRAMES.pickup).toBe(150);
        expect(CEREMONY_DEAD_FRAMES.total).toBe(331);
    });
});

describe('⚠⚠ no tape can dismiss it, and the guard cannot see it', () => {
    it('a dismissal is not an execution a tape can produce, and asking says so', () => {
        expect(() => sealControllerTicks(true)).toThrow(SealError);
        expect(() => sealControllerTicks(true)).toThrow(/Game\.talking \|\| helpUp/);
    });

    it('the blind spot names the predicate, not just the symptom', () => {
        expect(SEAL_AUTOADVANCE_BLIND_SPOT.where).toMatch(/Game\.talking \|\| helpUp/);
        expect(SEAL_AUTOADVANCE_BLIND_SPOT.fix).toMatch(/AS3/);
    });

    it('and it says the thing that stops it being a deadlock', () => {
        expect(SEAL_AUTOADVANCE_BLIND_SPOT.terminates).toMatch(/unconditional `else`/);
    });
});

describe('⚠ the Music statics: the risk §21.5 raised, closed', () => {
    it('the pin reads positions, and no volume is among them', () => {
        expect(SEAL_MUSIC_STATICS.pinReads.join(' ')).not.toMatch(/[Vv]olume/);
        expect(SEAL_MUSIC_STATICS.written.every((s) => /Volume/.test(s))).toBe(true);
    });

    it('the verdict is INERT and it is asserted rather than assumed', () => {
        expect(SEAL_MUSIC_STATICS.verdict).toMatch(/INERT/);
    });
});

describe('⛔⛔ the piece reaches a player who never moves', () => {
    const player = (y) => ({
        player: { x: 152, y },
        playerBox: playerBoxAt(152, y),
        blockedAt,
    });

    it('spawns at the CHEST, which no stance band row overlaps', () => {
        const piece = createSealPiece(CHEST_ENTITY.x, CHEST_ENTITY.y);
        for (const y of chestStanceBand(144, 112, HITBOX)) {
            const box = playerBoxAt(152, y);
            const pb = sealPieceBox(piece);
            const overlap = pb.x < box.right && pb.right > box.x
                && pb.y < box.bottom && pb.bottom > box.y;
            // ⛔ THE R3 MODEL'S WHOLE FAILURE: no overlap at t = 0, and the
            // player never moves again.
            expect(overlap).toBe(false);
        }
    });

    it('and reaches a stationary player in 9 live ticks', () => {
        const r = sealApproachTicks(createSealPiece(CHEST_ENTITY.x, CHEST_ENTITY.y), player(130));
        expect(r.ticks).toBe(9);
        // The contact test runs at the TOP of the tick, before the move, so
        // the 9th call finds the position the 8th left.
        expect(r.path[7].y).toBeCloseTo(126.769, 3);
        expect(r.path[8].y).toBe(r.path[7].y);
    });

    it('⛓ AND IT IS 9 FROM BOTH BAND ROWS — the leg does not care which one it stops in', () => {
        // Not a coincidence worth relying on blindly, so both are asserted:
        // the further row starts 1 px back and is pulled 1/20 px/tick
        // harder, and the two cancel to the same tick. If a future change
        // moves either, this is the test that says which.
        const near = sealApproachTicks(createSealPiece(CHEST_ENTITY.x, CHEST_ENTITY.y), player(130));
        const far = sealApproachTicks(createSealPiece(CHEST_ENTITY.x, CHEST_ENTITY.y), player(131));
        expect(far.ticks).toBe(near.ticks);
        expect(far.path[8].y).toBeGreaterThan(near.path[8].y);
    });

    it('⚠ it ACCELERATES: `stopped` is never set false, so the attraction is every tick', () => {
        const r = sealApproachTicks(createSealPiece(CHEST_ENTITY.x, CHEST_ENTITY.y), player(130));
        const steps = r.path.map((p, i) => p.y - (i === 0 ? CHEST_ENTITY.y : r.path[i - 1].y));
        // Monotone increasing until the contact tick, which does not move.
        const moving = steps.slice(0, -1);
        for (let i = 1; i < moving.length; i += 1) {
            expect(moving[i]).toBeGreaterThan(moving[i - 1]);
        }
        expect(moving[0]).toBeCloseTo(0.25, 10);
    });

    it('the FIRST tick moves 0.25 px — friction runs ABOVE the move', () => {
        const r = stepSealPiece(createSealPiece(152, 120), player(130));
        // attraction 0.5, minus one friction step of 0.25.
        expect(r.piece.y).toBeCloseTo(120.25, 10);
        expect(r.contact).toBe(false);
    });

    it('⚠ a sub-pixel velocity still moves: `i < Math.abs(rel)` with i integer', () => {
        // The failure this guards: flooring the distance would leave the
        // piece motionless for its whole approach.
        const r = stepSealPiece(createSealPiece(152, 120), player(130));
        expect(r.piece.y).not.toBe(120);
    });

    it('a wall stops it: `moveY` refuses the STEP, so no contact ever happens', () => {
        expect(() => sealApproachTicks(createSealPiece(152, 120), {
            player: { x: 152, y: 130 },
            playerBox: playerBoxAt(152, 130),
            // Everything below the spawn is wall.
            blockedAt: (x, y) => y > 120,
        }, 40)).toThrow(SealError);
    });

    it('refuses a caller with no player — the attraction has no default', () => {
        expect(() => stepSealPiece(createSealPiece(152, 120), { blockedAt })).toThrow(SealError);
    });

    it('refuses a caller with no geometry', () => {
        expect(() => stepSealPiece(createSealPiece(152, 120), {
            player: { x: 152, y: 130 }, playerBox: playerBoxAt(152, 130),
        })).toThrow(SealError);
    });
});

describe('the constants are the source\'s', () => {
    it('the body is 4x4 with a 2,2 origin — the smallest on the arc', () => {
        expect(SEAL_PIECE.box).toEqual({ w: 4, h: 4, originX: 2, originY: 2 });
    });

    it('textless and special: phase A only, no NPC', () => {
        expect(SEAL_PIECE.text).toBe('');
        expect(SEAL_PIECE.special).toBe(true);
    });

    it('the attraction floor is a FLOOR and the speed cap is a CAP', () => {
        expect(SEAL_PIECE.minAttraction).toBe(0.3);
        expect(SEAL_PIECE.minSpeedToPlayer).toBe(2);
    });
});
