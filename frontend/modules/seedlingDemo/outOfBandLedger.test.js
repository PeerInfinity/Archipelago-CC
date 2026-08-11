/**
 * seedlingDemo/outOfBandLedger.test — the tag = −1 family.
 *
 * The point of the module is that the FOURTH member cannot arrive
 * silently, so most of these tests are about the refusal rather than
 * about the arithmetic (which `breakableRocks.test.js` already drives
 * from both directions).
 */

import { describe, expect, it } from 'vitest';

import {
    OUT_OF_BAND_WRITERS, OutOfBandLedgerError, TAGS_PER_LEVEL,
    expectedOutOfBandEntries, ledgerKey, outOfBandFlagForWriter, outOfBandReadFor,
} from './outOfBandLedger.js';
import { outOfBandFlagFor } from './breakableRocks.js';
import { FIRE_OUT_OF_BAND_FLAG } from './r5Acceptance.js';

describe('the family registry', () => {
    // ⛓ FIVE at R5 slice 7. `Lock` and `RopeStart` were registered from the
    // SOURCE when the shaft's route needed them — both take `_tag:int = -1`
    // as a CONSTRUCTOR DEFAULT, which is a third way into this family after
    // a runtime spawn (`Fire`) and authored map data (`BreakableRock`).
    it('has exactly the SEVEN members read out of the source, each with a citation', () => {
        // ⛓ R5 slice 12 adds `BurnableTree` — the sixth. Its write is in
        // `removed()`, which has no tag guard, so a `-1` tree clears a flag
        // in the PREVIOUS level exactly as `Fire` and `BreakableRock` do.
        // Both trees in the committed extract are `tag 0`, so the sentinel
        // is reachable and unexercised — which is why the entry is here.
        // ⛓⛓⛓ R8 SLICE 6 adds `Spinner` — the SEVENTH, and the first with a
        // DRIVEN witness on a route: L18's two placements carry `tag="-1"` as
        // authored data, so a press kill there writes {17,29}. Kickoff §13.10
        // measured that consequence as NIL ("the write is a no-op"); it is
        // this module.
        expect(Object.keys(OUT_OF_BAND_WRITERS).sort())
            .toEqual(['BreakableRock', 'BurnableTree', 'DarkSword', 'Fire', 'Lock',
                'RopeStart', 'Spinner']);
        for (const [name, entry] of Object.entries(OUT_OF_BAND_WRITERS)) {
            expect(entry.as3, `${name} must cite its file and lines`).toMatch(/\.as:\d+/);
            expect(entry.writeSite, name).toMatch(/\(\)$/);
            expect(['always', 'ifFlagAlreadySet']).toContain(entry.writesWhen);
            expect(entry.minusOneFrom.length, name).toBeGreaterThan(20);
            expect(entry.skipsItsOwnGuard.length, name).toBeGreaterThan(20);
        }
    });

    it('names a witness tape per member — an unexercised member is a finding', () => {
        // ⚠ `DarkSword`'s witness is slice 5 step 5's, and it is named here
        // BEFORE the tape exists on purpose: the registry is a list of
        // NAMES, and a member with no name to check would be the predicate
        // this arc keeps getting bitten by.
        expect(OUT_OF_BAND_WRITERS.Fire.witness).toBe('r5-bobboss-fire');
        expect(OUT_OF_BAND_WRITERS.BreakableRock.witness).toBe('r5-feather');
        expect(OUT_OF_BAND_WRITERS.DarkSword.witness).toBe('r5-witch-darksword');
        expect(OUT_OF_BAND_WRITERS.Lock.witness).toBe('r5-shaft');
        expect(OUT_OF_BAND_WRITERS.RopeStart.witness).toBe('r5-shaft');
        // ⚠ AND THE SIXTH HAS NO WITNESS, said out loud rather than left
        // blank: the burn is modelled and undriven. An unexercised member
        // is a finding, and this is the finding.
        expect(OUT_OF_BAND_WRITERS.BurnableTree.witness).toMatch(/none yet/);
    });
});

describe('outOfBandFlagForWriter', () => {
    it('derives Fire\'s {31,29} from L32 rather than restating it', () => {
        const f = outOfBandFlagForWriter({ as3: 'Fire', level: 32, tag: -1 });
        expect(f).toMatchObject({ level: 31, tag: 29, outOfBand: true, as3: 'Fire' });
        expect(f.key).toBe('31:29');
        expect(f.expectsLedgerEntry).toBe(true);
    });

    it('derives the rocks\' {91,29} from L92', () => {
        const f = outOfBandFlagForWriter({ as3: 'BreakableRock', level: 92, tag: -1 });
        expect(f).toMatchObject({ level: 91, tag: 29, outOfBand: true });
        expect(f.key).toBe('91:29');
    });

    it('is the SAME arithmetic the general form uses', () => {
        for (const level of [1, 12, 32, 60, 92, 115]) {
            const plain = outOfBandFlagFor(level, -1);
            const viaFamily = outOfBandFlagForWriter({ as3: 'Fire', level, tag: -1 });
            expect(viaFamily.level).toBe(plain.level);
            expect(viaFamily.tag).toBe(plain.tag);
            expect(viaFamily.tag).toBe(TAGS_PER_LEVEL - 1);
            expect(viaFamily.level).toBe(level - 1);
        }
    });

    it('and `r5Acceptance.FIRE_OUT_OF_BAND_FLAG` is now that derivation', () => {
        // The slice-4 shape was a hard-coded {31,29} asserted against the
        // formula. This is the same claim from the other side: the
        // constant IS the helper's output, so there is nothing left to
        // drift apart.
        expect(FIRE_OUT_OF_BAND_FLAG.level).toBe(31);
        expect(FIRE_OUT_OF_BAND_FLAG.tag).toBe(29);
        expect(FIRE_OUT_OF_BAND_FLAG.as3).toBe('Fire');
    });

    it('REFUSES an unclassified class — this is the "by construction" half', () => {
        expect(() => outOfBandFlagForWriter({ as3: 'Conch', level: 44, tag: -1 }))
            .toThrow(OutOfBandLedgerError);
        expect(() => outOfBandFlagForWriter({ as3: 'Conch', level: 44, tag: -1 }))
            .toThrow(/not a classified out-of-band writer/);
        // and the message names the ones it does know, so the fix is
        // obvious from the failure alone
        // ⛓ R8 SLICE 6: this used `Spinner`, which is now classified — so
        // the CONTROL moves to a class that still is not. `Bob` is an enemy
        // whose `removed()` is an EMPTY override (it writes nothing at all),
        // which is exactly why it has no row here and exactly why asking for
        // one must throw rather than answer.
        expect(() => outOfBandFlagForWriter({ as3: 'Bob', level: 5, tag: -1 }))
            .toThrow(/Fire, BreakableRock, DarkSword/);
    });

    it('refuses an IN-BAND tag — the family is the sentinel only', () => {
        expect(() => outOfBandFlagForWriter({ as3: 'BreakableRock', level: 92, tag: 3 }))
            .toThrow(/is IN band/);
    });

    it('refuses a non-object', () => {
        expect(() => outOfBandFlagForWriter(null)).toThrow(OutOfBandLedgerError);
        expect(() => outOfBandFlagForWriter('Fire')).toThrow(OutOfBandLedgerError);
    });

    it('defaults the tag to the sentinel, because every member carries it', () => {
        expect(outOfBandFlagForWriter({ as3: 'DarkSword', level: 12 }).key).toBe('11:29');
    });

    it('inherits the refusal at level 0 — the game would write outside the array', () => {
        expect(() => outOfBandFlagForWriter({ as3: 'Fire', level: 0, tag: -1 })).toThrow();
    });
});

describe('the guard column', () => {
    it('separates the unconditional writers from the read-guarded one', () => {
        expect(outOfBandFlagForWriter({ as3: 'Fire', level: 32 }).expectsLedgerEntry)
            .toBe(true);
        expect(outOfBandFlagForWriter({ as3: 'BreakableRock', level: 92 }).expectsLedgerEntry)
            .toBe(true);
        // ⛔ `DarkSword.removed()` writes only `if (Game.checkPersistence(tag))`,
        //    an out-of-band READ of the very slot it would clear. So the
        //    ITEM is unconditional and the LEDGER ENTRY is not — a model
        //    that treated all three alike would predict a clear the game
        //    does not make.
        const ds = outOfBandFlagForWriter({ as3: 'DarkSword', level: 12 });
        expect(ds.writesWhen).toBe('ifFlagAlreadySet');
        expect(ds.expectsLedgerEntry).toBe(false);
    });

    it('outOfBandReadFor answers only for the member that HAS a guard', () => {
        expect(outOfBandReadFor({ as3: 'DarkSword', level: 12 }).key).toBe('11:29');
        expect(() => outOfBandReadFor({ as3: 'Fire', level: 32 }))
            .toThrow(/has no read guard/);
    });
});

describe('expectedOutOfBandEntries', () => {
    it('collects the unconditional writers and drops the guarded one', () => {
        const entries = expectedOutOfBandEntries([
            { as3: 'Fire', level: 32, tag: -1 },
            { as3: 'BreakableRock', level: 92, tag: -1 },
            { as3: 'BreakableRock', level: 92, tag: -1 },   // two rocks, ONE flag
            { as3: 'DarkSword', level: 12, tag: -1 },
        ]);
        expect([...entries.keys()].sort()).toEqual(['31:29', '91:29']);
    });

    // ⚠ THE CLASS THIS TEST USED TO NAME IS NOW A MEMBER. `RopeStart` was
    // the unclassified example until slice 7 built its arm — which is the
    // registry working, and is why the example is now a class that really
    // has no entry rather than one that was merely waiting for a route.
    it('a walk that meets an unclassified writer FAILS rather than under-reporting', () => {
        expect(() => expectedOutOfBandEntries([{ as3: 'Pulser', level: 39, tag: -1 }]))
            .toThrow(OutOfBandLedgerError);
    });

    it('refuses a non-array', () => {
        expect(() => expectedOutOfBandEntries('Fire')).toThrow(OutOfBandLedgerError);
    });
});

describe('ledgerKey', () => {
    it('is the one spelling', () => {
        expect(ledgerKey({ level: 31, tag: 29 })).toBe('31:29');
        expect(ledgerKey(outOfBandFlagFor(92, -1))).toBe('91:29');
    });

    it('refuses a malformed flag rather than emitting "undefined:undefined"', () => {
        expect(() => ledgerKey({ level: 31 })).toThrow(OutOfBandLedgerError);
        expect(() => ledgerKey(null)).toThrow(OutOfBandLedgerError);
    });
});
