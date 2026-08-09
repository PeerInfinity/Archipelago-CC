/**
 * The honest-playthrough overlay — R7 slice 4's G1 stratum.
 *
 * Two things are asserted here that no other test in the tree can:
 *
 *   1. THE TWO LAWS (§12.9 item 3) as TESTS. A grouped `Lock`'s persistence
 *      write is inert, so a grouped lock must never produce a rules row that
 *      depends on it; a `ButtonRoom` re-publishes at `check()`, so a
 *      room-latched opening is permanent. A row that broke either would be an
 *      invisible defect in a generated artifact nobody reads by hand.
 *   2. THAT THE OVERLAY ONLY EVER SPEAKS WHERE THE TRANSCRIPTION REFUSED.
 *      `seedlingSemantics` is the transcription and this is opinion; opinion
 *      that overwrote a transcribed rule would be a silent fork of the source.
 *
 * Every count is derived from a table, never typed.
 */

import { describe, expect, it } from 'vitest';

import { ENTITY_SEMANTICS, conditionKey } from './seedlingSemantics.js';
import {
    A_WEAPON,
    L40_EAST_RULE,
    NEVER_ENTER_CITE,
    NEVER_ENTER_LEVELS,
    PIXEL_MASK_TAGS,
    PLAYTHROUGH_ENTITY_OVERLAY,
    REFUTATION_FIELDS,
    REFUTATION_LOG,
    WANDLOCK_IS_A_LOCK,
    isRefutation,
    overlayEntitySemantics,
    resolveOverlayCondition,
} from './seedlingPlaythroughOverlay.js';

const lock = (tag, tset, persistTag = '3') => ({
    type: tag, x: 0, y: 0, attrs: { tset: String(tset), tag: persistTag },
});
const base = (tag) => ENTITY_SEMANTICS[tag] ?? null;

describe('the overlay speaks only where the transcription refused', () => {
    it('every overlay row replaces a `manual` row, and never a ruled one', () => {
        for (const tag of Object.keys(PLAYTHROUGH_ENTITY_OVERLAY)) {
            const b = base(tag);
            expect(b, `"${tag}" is not an entity the transcription knows`).toBeTruthy();
            expect(b.kind, `"${tag}" already has a transcribed ruling — the overlay must not overwrite it`)
                .toBe('manual');
        }
    });

    it('every overlay row carries its source citation and its reading', () => {
        for (const [tag, row] of Object.entries(PLAYTHROUGH_ENTITY_OVERLAY)) {
            expect(typeof row.cite, `"${tag}" has no cite`).toBe('string');
            expect(row.cite.length, `"${tag}"'s cite is empty`).toBeGreaterThan(0);
            expect(typeof row.why, `"${tag}" has no reading`).toBe('string');
            expect(['open', 'wall', 'gated']).toContain(row.kind);
            if (row.kind === 'gated') expect(row.condition).toBeTruthy();
        }
    });

    it('the pixel-mask families are DECLARED rather than ruled — they go to the model', () => {
        for (const tag of PIXEL_MASK_TAGS) {
            expect(base(tag), `"${tag}" is not on the map`).toBeTruthy();
            // The transcription either refuses outright (`manual`, the
            // buildings) or approximates with the sprite rect (`wall` —
            // `opentree`, `snowhill`). Both are answers the MASK improves on,
            // and neither is something this module may overrule from a table.
            expect(['manual', 'wall'], `"${tag}"`).toContain(base(tag).kind);
            // ...and the overlay deliberately does NOT rule on them.
            expect(PLAYTHROUGH_ENTITY_OVERLAY[tag]).toBeUndefined();
        }
    });

    it('leaves an entity it has no opinion about exactly as it found it', () => {
        expect(overlayEntitySemantics({ type: 'burnabletree', attrs: {} }, base('burnabletree')))
            .toBeNull();
        expect(overlayEntitySemantics({ type: 'tree', attrs: {} }, base('tree'))).toBeNull();
    });
});

describe('⛔ LAW 1 — a kill-lock is a weapon gate, and it is DURABLE', () => {
    // `Lock.checkEnemies()`: `if (tSet == -1 && totalEnemies() == 0) activate = true`.
    // `Lock.check()`: removed when `tag >= 0 && tSet < 0 && !checkPersistence(tag)`.
    it.each(['lock', 'wandlock', 'grasslock'])('%s with tSet -1 gates on a weapon', (tag) => {
        const ruled = overlayEntitySemantics(lock(tag, -1), base(tag));
        expect(ruled.kind).toBe('gated');
        expect(conditionKey(ruled.condition)).toBe(conditionKey(A_WEAPON));
        expect(ruled.why).toMatch(/DURABLE/);
    });
});

describe('⛔ LAW 2 — a GROUPED lock never becomes a rules row', () => {
    // Its `turnOff()` writes persistence and its `check()` reads persistence
    // only while `tSet < 0`, so the write is INERT: a row that treated a
    // grouped lock as a durable opening would claim a door stays open across a
    // visit when the game rebuilds it shut.
    it.each([0, 1, 2, 5])('a lock in group %i is choreography, not a gate', (tset) => {
        const ruled = overlayEntitySemantics(lock('lock', tset), base('lock'));
        expect(ruled.kind).toBe('open');
        expect(ruled.condition).toBeUndefined();
        expect(ruled.why).toMatch(/INERT/);
    });

    it('...and the ruling is stated in terms of the group, not the tag', () => {
        const a = overlayEntitySemantics(lock('lock', 2, '9'), base('lock'));
        const b = overlayEntitySemantics(lock('lock', 2, '10'), base('lock'));
        expect(a.kind).toBe(b.kind);
    });
});

describe('⛔ THE BRIEF WAS WRONG ABOUT WandLock, and the test says so', () => {
    // The slice-4 brief asked for `wandlock -> wand SHOT`. `WandLock.as` extends
    // `Lock` and overrides only the sprite, and `WandShot.checkEntity` handles
    // `Enemy` and `MagicalLock` and nothing else. A future edit that "restores"
    // the wand requirement has to delete this test first.
    it('a wandlock is ruled exactly as a lock of the same group', () => {
        for (const tset of [-1, 0, 3]) {
            expect(overlayEntitySemantics(lock('wandlock', tset), base('wandlock')).kind)
                .toBe(overlayEntitySemantics(lock('lock', tset), base('lock')).kind);
        }
    });

    it('and no overlay row anywhere gates on the wand for a LOCK', () => {
        const wandish = Object.entries(PLAYTHROUGH_ENTITY_OVERLAY)
            .filter(([, r]) => JSON.stringify(r.condition ?? null).includes('Wand'));
        expect(wandish).toEqual([]);
        expect(WANDLOCK_IS_A_LOCK.cite).toMatch(/WandShot/);
    });

    it('the wand still belongs to the MAGICAL lock, which the transcription owns', () => {
        expect(base('magicallock').kind).toBe('gated');
        expect(conditionKey(base('magicallock').condition)).toMatch(/hasWand/);
        expect(PLAYTHROUGH_ENTITY_OVERLAY.magicallock).toBeUndefined();
    });
});

describe('the trap rooms, and the L40 ruling', () => {
    it('every never-enter level carries the citation that makes it one', () => {
        expect(NEVER_ENTER_LEVELS.length).toBeGreaterThan(0);
        for (const level of NEVER_ENTER_LEVELS) {
            expect(typeof NEVER_ENTER_CITE[level], `L${level} has no citation`).toBe('string');
        }
        // Derived, never typed: the citation table and the level list agree.
        expect(Object.keys(NEVER_ENTER_CITE).map(Number).sort((a, b) => a - b))
            .toEqual([...NEVER_ENTER_LEVELS].sort((a, b) => a - b));
    });

    it('L40\'s hand ruling is STRICTLY STRONGER than the general rule', () => {
        // The general rule for the east half's door (a grouped wandlock) is
        // `open`. The ruling adds fire AND a weapon — so it can only ever
        // remove reachability, never add it, which is the only shape a hand
        // ruling is allowed to take here.
        const general = overlayEntitySemantics(lock('wandlock', 2, '10'), base('wandlock'));
        expect(general.kind).toBe('open');
        expect(L40_EAST_RULE.condition.all).toBeTruthy();
        expect(L40_EAST_RULE.condition.all.length).toBe(2);
        expect(L40_EAST_RULE.cite).toMatch(/probe-seedling-r7-l40-holder/);
        expect(L40_EAST_RULE.tile).toEqual([32, 30]);
    });
});

describe('the refutation log — the mechanism, built before it is needed', () => {
    it('starts empty, because no segment has driven any of these gates yet', () => {
        expect(REFUTATION_LOG).toEqual([]);
    });

    it('but its SHAPE is asserted, so the mechanism cannot rot while it waits', () => {
        const good = Object.fromEntries(REFUTATION_FIELDS.map((f) => [f, 'x']));
        expect(isRefutation(good)).toBe(true);
        for (const f of REFUTATION_FIELDS) {
            expect(isRefutation({ ...good, [f]: '' }), `an empty "${f}" must not pass`).toBe(false);
            const missing = { ...good };
            delete missing[f];
            expect(isRefutation(missing), `a missing "${f}" must not pass`).toBe(false);
        }
        expect(isRefutation(null)).toBe(false);
    });
});

describe('the overlay-only condition vocabulary', () => {
    it('resolves the seal count and the totem set, and refuses everything else', () => {
        expect(resolveOverlayCondition({ seals: 16 }))
            .toEqual({ rule: 'Has', args: { item_name: 'Seal', count: 16 } });
        expect(resolveOverlayCondition({ flag: 'hasTotemPartsAll' }))
            .toEqual({ rule: 'Has', args: { item_name: 'Totem Shard', count: 5 } });
        // A plain engine flag is the TRANSCRIPTION's to resolve, not ours.
        expect(resolveOverlayCondition({ flag: 'hasFire' })).toBeNull();
        expect(resolveOverlayCondition(null)).toBeNull();
    });
});
