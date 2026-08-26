/**
 * provisionalLatch — the unit rows for ⚖ 54 (1) and (4).
 *
 * ⛔ EVERY ROW HERE IS ABOUT A DISTINCTION THAT WAS MEASURED, not about a
 * shape. The two the slice exists for:
 *   · a tape that differs only in `tick0` must key the SAME (the game never
 *     receives it), and the pre-P1 key separated them — which is how
 *     `r8-d2-19`'s 721-tick answer became unreachable in a cache that held it;
 *   · a tape that differs only in `description` must key the SAME (no consumer
 *     of the shipped bytes reads it), so a prose edit costs no drive.
 */
import { describe, it, expect } from 'vitest';

import {
    CERT_LEVELS, KEY_DROPS, KEY_KEEPS, certificationCell, certifyAgainstLatch,
    latchCacheCandidates, latchKeyOf, latchKeyTape, modelArrivalOf,
} from './provisionalLatch.js';

/** A projected tape — the shape `gameVisibleTape` returns. */
const projected = (over = {}) => ({
    tape_version: 8, game: 'seedling', name: 'x', description: 'a sentence',
    boot: { level: 19, x: 16, y: 144 }, noclip: false, noDamage: false,
    noHazards: [], grants: [], persistence: [], equips: [], pins: {},
    save: {}, rng: { seed: 1 }, seam: { time: 10 }, tick_count: 3,
    inputs: [{ t: 0, keys: ['right'] }],
    ...over,
});

describe('the KEY projection', () => {
    it('⛓ drops exactly `description`, and the classification is ENUMERATED', () => {
        expect(KEY_DROPS).toEqual(['description']);
        const kept = Object.keys(latchKeyTape(projected()));
        expect(kept).not.toContain('description');
        // every surviving key is one the enumeration claims the game reads
        for (const k of kept) expect(KEY_KEEPS).toContain(k);
    });

    /**
     * ⛔⛔ THE ROW THE WHOLE OF ⚖ 54 (4) IS FOR. Measured in anger: the game's
     * answer for `r8-d2-19`'s 721-tick walk is in `rerecord-cache/` under
     * `558c4596083c`, and the tape committed for that same walk misses it
     * because S2 re-derived `tick0` after S1 drove.
     */
    it('⛓ a PROSE-ONLY edit does not move the key', () => {
        expect(latchKeyOf(projected({ description: 'a different sentence' })))
            .toBe(latchKeyOf(projected()));
    });

    it('⛔ a WALK edit DOES move the key', () => {
        expect(latchKeyOf(projected({ inputs: [{ t: 0, keys: ['left'] }] })))
            .not.toBe(latchKeyOf(projected()));
    });

    it('⛔ a boot edit DOES move the key', () => {
        expect(latchKeyOf(projected({ boot: { level: 19, x: 17, y: 144 } })))
            .not.toBe(latchKeyOf(projected()));
    });

    /**
     * ⛔ THE REFUSAL IS THE POINT. A field nobody classified must not silently
     * join either side: kept is the safe error (a wasted GPU run), dropped is
     * the unsafe one (the wrong latch), so an unknown one stops the key.
     */
    it('⛔ an UNCLASSIFIED projected field is a REFUSAL BY NAME', () => {
        expect(() => latchKeyTape(projected({ commentary: 'new in v12' })))
            .toThrow(/commentary/);
        expect(() => latchKeyTape(projected({ commentary: 'new in v12' })))
            .toThrow(/KEY_KEEPS/);
    });
});

describe('the cache candidates — the migration', () => {
    it('⛓ the NEW key comes first and the pre-P1 spelling second', () => {
        const c = latchCacheCandidates({
            complete: { ...projected(), tick0: { rng: { seed: 7 } } },
            projected: projected(),
            legacy: 'complete',
        });
        expect(c).toHaveLength(2);
        expect(c[0].era).toBe('key');
        expect(c[1].era).toBe('legacy:complete');
        expect(c[0].key).toBe(latchKeyOf(projected()));
    });

    /**
     * ⛓⛓ TWO COMPLETE TAPES THAT DIFFER ONLY IN `tick0` NOW SHARE A KEY — and
     * their LEGACY keys still differ, which is exactly the pair that made a
     * paid-for GPU answer unreachable.
     */
    it('⛓ `tick0` moves the LEGACY key and not the live one', () => {
        const a = latchCacheCandidates({
            complete: { ...projected(), tick0: { rng: { seed: 111 } } },
            projected: projected(), legacy: 'complete' });
        const b = latchCacheCandidates({
            complete: { ...projected(), tick0: { rng: { seed: 222 } } },
            projected: projected(), legacy: 'complete' });
        expect(a[0].key).toBe(b[0].key);
        expect(a[1].key).not.toBe(b[1].key);
    });

    it('⛓ `latchOf`\'s legacy spelling is the projection WITH `description`', () => {
        const withProse = latchCacheCandidates({
            complete: projected(), projected: projected(), legacy: 'projection' });
        const other = latchCacheCandidates({
            complete: projected(), projected: projected({ description: 'else' }),
            legacy: 'projection' });
        expect(withProse[0].key).toBe(other[0].key);       // the live key ignores prose
        expect(withProse[1].key).not.toBe(other[1].key);   // the legacy one did not
    });

    it('⛔ an unknown legacy spelling is refused by name', () => {
        expect(() => latchCacheCandidates({
            complete: projected(), projected: projected(), legacy: 'guess' }))
            .toThrow(/complete.*projection/);
    });
});

/* ── ⚖ 49's STOP CONDITIONS ───────────────────────────────────────── */

const latchOf = (over = {}) => ({
    hits: 0,
    observations: 100,
    envelope: {
        latched: true,
        partial: false,
        seam: {
            'latch.tick': 99,
            level: 20,
            playerPositionX: 192,
            playerPositionY: 64,
            'arrival.velocity': { vx: 0, vy: 0, hits: 0, hits_timer: 0 },
            ...(over.seam ?? {}),
        },
    },
    ...over,
});
const modelOf = (over = {}) => ({
    hits: 0, deaths: 0, level: 20, to: 20,
    ctor: { x: 192, y: 64 }, end: { x: 200, y: 72 },
    velocity: { vx: 0, vy: 0 }, ...over,
});
const calmFindings = [{ name: 'latch: arrival.velocity', ok: true, detail: 'calm' },
    { name: 'the latch is whole', ok: true, detail: '46 field(s)' }];

describe('the certification column', () => {
    it('⛓ a latch that agrees is GAME-CERTIFIED', () => {
        const c = certifyAgainstLatch({
            latch: latchOf(), model: modelOf(), latchFindings: calmFindings });
        expect(c.level).toBe('GAME-CERTIFIED');
        expect(c.reasons).toEqual([]);
    });

    /**
     * ⛔⛔ THE THIRD STATE §33.2 SHOWS THE TABLES WERE MISSING. A row nobody
     * put to the game reads GREEN in a two-state column, and that is how three
     * runs of GPU were spent on walks the game had never seen.
     */
    it('⛓ no latch is MODEL-CERTIFIED — never GAME-CERTIFIED', () => {
        const c = certifyAgainstLatch({ latch: null, model: modelOf() });
        expect(c.level).toBe('MODEL-CERTIFIED');
        expect(CERT_LEVELS).toContain(c.level);
    });

    it('⛓ neither side is `unasked`', () => {
        expect(certifyAgainstLatch({}).level).toBe('unasked');
    });

    it('⛔ not-calm REFUSES by name', () => {
        const c = certifyAgainstLatch({
            latch: latchOf(), model: modelOf(),
            latchFindings: [{ name: 'latch: arrival.velocity', ok: false,
                detail: '⛔ NOT CALM — v=(0, 1.8000000000000007) hits=0' },
            { name: 'the latch is whole', ok: true, detail: 'ok' }],
        });
        expect(c.level).toBe('REFUSED');
        expect(certificationCell(c)).toMatch(/not-calm/);
        expect(certificationCell(c)).toMatch(/arrival\.velocity/);
    });

    /**
     * ⛔⛔ AN UNCLAIMED LATCH IS ITS OWN CONDITION. ⚖ 49's four all presuppose
     * that the run ARRIVED; calling "it never arrived" a non-calm arrival is a
     * true sentence about the wrong subject.
     */
    it('⛔ a walk that never LATCHED refuses as `unlatched`, not as not-calm', () => {
        const c = certifyAgainstLatch({
            latch: { hits: 0, observations: 41, envelope: { latched: false, seam: {} } },
            model: modelOf(),
            latchFindings: [{ name: 'latch: level', ok: false,
                detail: 'UNCLAIMED — the run never latched a seam' },
            { name: 'the latch is whole', ok: false, detail: '⛔ NOTHING LATCHED' }],
        });
        expect(c.level).toBe('REFUSED');
        expect(certificationCell(c)).toMatch(/unlatched/);
        expect(certificationCell(c)).not.toMatch(/not-calm/);
        // ⛔ BY SIDE, not by name: the MODEL has a `calm` row too and it comes first.
        expect(c.rows.find((r) => r.side === 'game' && r.name === 'calm').detail)
            .toMatch(/makes NO claim/);
    });

    it('⛔ a PARTIAL latch refuses too, and says which', () => {
        const c = certifyAgainstLatch({
            latch: { hits: 0, envelope: { latched: true, partial: true,
                why: 'a failure disarm', seam: {} } },
            model: modelOf(), latchFindings: [] });
        expect(certificationCell(c)).toMatch(/unlatched: the latch is PARTIAL/);
    });

    it('⛔ a HIT refuses', () => {
        const c = certifyAgainstLatch({
            latch: latchOf({ hits: 1 }), model: modelOf(), latchFindings: calmFindings });
        expect(c.level).toBe('REFUSED');
        expect(certificationCell(c)).toMatch(/hit: the game took 1/);
    });

    it('⛔ a LEVEL mismatch refuses', () => {
        const c = certifyAgainstLatch({
            latch: latchOf({ seam: { level: 18 } }), model: modelOf(),
            latchFindings: calmFindings });
        expect(c.level).toBe('REFUSED');
        expect(certificationCell(c)).toMatch(/level: L18 against the declared L20/);
    });

    /**
     * ⛓⛓ THE PIXEL ROW IS AGAINST THE SPAWN PAIR, AND THE DIGITS ARE
     * `r8-d2-19`'s OWN: the game latches (192, 64) and the model STANDS at
     * (200, 72). A column that compared `end` would refuse every arrival in
     * the roster.
     */
    it('⛓ the pixel row compares `ctor`, not `end`', () => {
        expect(certifyAgainstLatch({ latch: latchOf(), model: modelOf(),
            latchFindings: calmFindings }).level).toBe('GAME-CERTIFIED');
        const c = certifyAgainstLatch({
            latch: latchOf(), model: modelOf({ ctor: { x: 200, y: 72 } }),
            latchFindings: calmFindings });
        expect(c.level).toBe('REFUSED');
        expect(certificationCell(c)).toMatch(/pixel: \(192, 64\) against \(200, 72\)/);
    });

    it('⛓ no `ctor` makes NO pixel claim and says so', () => {
        const c = certifyAgainstLatch({ latch: latchOf(), model: modelOf({ ctor: null }),
            latchFindings: calmFindings });
        expect(c.level).toBe('GAME-CERTIFIED');
        expect(c.rows.find((r) => r.name === 'pixel').detail).toMatch(/makes NO claim/);
    });

    /** ⛔ §33.2 with the sides swapped is still §33.2. */
    it('⛔ a green MODEL cannot hide a red LATCH', () => {
        const c = certifyAgainstLatch({
            latch: latchOf({ hits: 3 }), model: modelOf(), latchFindings: calmFindings });
        expect(c.model).toBe('certified');
        expect(c.level).toBe('REFUSED');
    });
});

describe('the model arrival', () => {
    const run = {
        playerHits: [], playerDeaths: [],
        level: 20,
        transitions: [{ t: 721, to_level: 20 }],
        worldCtor: { x: 192, y: 64 },
        state: { x: 200, y: 72, vx: 0, vy: 0 },
        ticksCompleted: 721,
    };

    it('⛓ `ctor` is worldCtor and `end` is the standing pair', () => {
        const a = modelArrivalOf(run, 20);
        expect(a.ctor).toEqual({ x: 192, y: 64 });
        expect(a.end).toEqual({ x: 200, y: 72 });
        expect(a.to).toBe(20);
    });

    /** ⛔ A PROMOTED segment nobody re-solves reports NO arrival, not a green one. */
    it('⛓ a null run is a null arrival', () => {
        expect(modelArrivalOf(null, 20)).toBeNull();
    });

    /**
     * ⛔ THE LEVEL IS THE RUN'S OWN, not the last transition's: a walk that
     * ends without a transition still stands somewhere.
     */
    it('⛓ a walk with no transition still reports its level', () => {
        const a = modelArrivalOf({ ...run, transitions: [], level: 13 }, null);
        expect(a.level).toBe(13);
        expect(a.lastTransition).toBeNull();
    });
});
