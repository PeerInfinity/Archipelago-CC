/**
 * seedlingDemo/moverSolids.test — solidity is a property of the MOVER.
 *
 * R5 slice 12 step 1. The census carries one `collider` field per class and
 * its docblock says *"does not block the player"*; FlashPunk asks
 * `collideTypes(solids, …)` against the list the MOVING entity carries, and
 * a `PushableBlock*` carries a different one from the Player.
 *
 * That gap cost the shaft its entire ledger: a wandering `Spinner` — a
 * `type: 'Enemy'`, `collider: 'none'` census row — wedged block 2 mid-glide
 * in L39. See `r5Shaft.SPINNER_WEDGE` for the four tapes, one of them the
 * same tape 120 ticks later and byte-exact against the game.
 */

import { describe, expect, it } from 'vitest';

import {
    ENTITY_CLASSES, PLAYER_SOLID_TYPES, SOLIDS_BY_MOVER, blocksMover,
} from './levelWorld.js';
import { SPINNER_WEDGE } from './r5Shaft.js';

describe('the three solids lists, transcribed', () => {
    it('the PLAYER\'s list is `Mobile`\'s plus LavaBoss — unchanged', () => {
        expect(SOLIDS_BY_MOVER.player).toEqual(PLAYER_SOLID_TYPES);
        expect(SOLIDS_BY_MOVER.player).toContain('LavaBoss');
        expect(SOLIDS_BY_MOVER.player).not.toContain('Enemy');
    });

    it('⛔⛔ a PUSHABLE\'s list adds "Enemy" and "Player" — the ctor push', () => {
        // `PushableBlock.as:28` / `PushableBlockFire.as:31`:
        //     solids.push("Enemy", "Player");
        expect(SOLIDS_BY_MOVER.pushable).toContain('Enemy');
        expect(SOLIDS_BY_MOVER.pushable).toContain('Player');
        expect(SOLIDS_BY_MOVER.pushable).not.toContain('LavaBoss');
    });

    it('an ENEMY\'s list is the base one — it adds nothing', () => {
        expect(SOLIDS_BY_MOVER.enemy).not.toContain('Enemy');
        expect(SOLIDS_BY_MOVER.enemy).not.toContain('Player');
    });

    it('rejects a mover it does not know, rather than defaulting to the player', () => {
        expect(() => blocksMover('Solid', 'crusher')).toThrow(/unknown mover/);
    });
});

describe('⛔⛔ the verdict that was true about the wrong mover', () => {
    it('every Enemy in the census is `collider: none` AND blocks a pushable', () => {
        // The two halves of the finding, stated together so neither can be
        // read as a defect in the other. The census rows are RIGHT; the
        // question they answer is the player's.
        const enemies = Object.entries(ENTITY_CLASSES)
            .filter(([, row]) => row.type === 'Enemy');
        expect(enemies.length).toBeGreaterThan(10);
        for (const [tag, row] of enemies) {
            expect(row.collider, `${tag} blocks the player?`).toBe('none');
            expect(blocksMover(row.type, 'player'), `${tag} vs player`).toBe(false);
            expect(blocksMover(row.type, 'pushable'), `${tag} vs a block`).toBe(true);
        }
    });

    it('⛓ the spinner in particular — the class that did it', () => {
        const spinner = ENTITY_CLASSES.spinner;
        expect(spinner.as3).toBe('Spinner');
        expect(spinner.type).toBe('Enemy');
        expect(blocksMover(spinner.type, 'player')).toBe(false);
        expect(blocksMover(spinner.type, 'pushable')).toBe(true);
        // …and the census row now SAYS so, so the next reader is not
        // re-deriving it from four recordings.
        expect(spinner.why).toMatch(/PUSHABLE BLOCK/);
    });

    it('⚠ and a Player-typed entity blocks a block too, which is the other half', () => {
        // `solids.push("Enemy", "Player")` is one line with two members, and
        // the arc has read a two-member list as one before
        // ([[feedback_two_member_list_one_member_read]]). The Player half is
        // what makes a block wedge PERMANENTLY: it cannot retreat through
        // the player who followed it in.
        expect(blocksMover('Player', 'pushable')).toBe(true);
        expect(blocksMover('Player', 'player')).toBe(false);
    });
});

describe('the wedge, as banked', () => {
    it('names the mover lists it is derived from', () => {
        expect(SPINNER_WEDGE.moverSolids).toEqual(SOLIDS_BY_MOVER.pushable);
        expect(SPINNER_WEDGE.playerSolids).toEqual(SOLIDS_BY_MOVER.player);
        expect(SPINNER_WEDGE.blockerType).toBe('Enemy');
    });

    it('⛓⛓ and the discriminator is a TIME SHIFT, recorded on both sides', () => {
        // The claim is not "a probe failed" — it is that the same inputs at
        // a different absolute time give a different answer, which no static
        // solid can do.
        const delayed = SPINNER_WEDGE.probes.find((p) => p.tape === 'r5-press-delay');
        expect(delayed.byteExact).toBe(true);
        expect(delayed.delayTicks).toBeGreaterThan(0);
        const wedged = SPINNER_WEDGE.probes.filter((p) => p.stuckY !== undefined);
        expect(wedged.length).toBe(3);
        // …and the two wedge positions DISAGREE with each other, which is
        // the second independent sign that the blocker is not geometry.
        expect(new Set(wedged.map((p) => p.stuckY)).size).toBeGreaterThan(1);
    });

    it('⚠ the withdrawn tapes are not in the fixture roster', async () => {
        const { fixtureNames } = await import('./fixtures/index.js');
        const names = new Set(fixtureNames());
        for (const w of SPINNER_WEDGE.withdrawn) expect(names.has(w)).toBe(false);
        // …and the committed pair IS.
        expect(names.has(SPINNER_WEDGE.committedPair.press)).toBe(true);
        expect(names.has(SPINNER_WEDGE.committedPair.control)).toBe(true);
    });
});
