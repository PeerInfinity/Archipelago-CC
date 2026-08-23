/**
 * rerecordCampaign — the pipeline's LAWS, unit-rowed.
 * ⚖ R9 ruling 21, slice 9.
 *
 * Each row here is a mutant the pipeline must refuse. The first one is the
 * defect shape slice 9 was sent to find: an authoring pass that MERGES a
 * measured envelope over a committed block and keeps whatever the envelope
 * did not name.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import { PLAYTHROUGH_CHAINS } from '../../frontend/modules/seedlingDemo/playthroughWalk.js';
import {
    bootFromEnvelopeOnly,
    chainSubjects,
    isTrueStart,
    latchCacheKey,
    mergePersistence,
    timedClearHazard,
} from './rerecordCampaign.js';

/** A stand-in `segmentBootFromLatch`: the four rows it takes pre-build. */
const project = (env) => ({
    boot: { level: env.beginEntry['begin.level'], x: 32, y: 16 },
    rng: {
        seed: env.beginEntry['rng.gameplay'],
        split: false,
        cosmetic: env.beginEntry['rng.cosmetic'],
        fp: env.beginEntry['fp.seed'],
    },
    seam: { time: env.beginEntry['save.time'] - 1 },
});

const envelope = (seed) => ({
    latched: true,
    partial: false,
    beginEntry: {
        'begin.level': 6,
        'rng.gameplay': seed,
        'rng.cosmetic': 0,
        'fp.seed': 341033166,
        'save.time': 6188,
    },
});

const committed = {
    boot: { level: 6, x: 32, y: 16 },
    rng: { seed: 514746467, split: false, cosmetic: 0, fp: 341033166 },
    seam: { time: 6187 },
};

describe('the successor boot is the ENVELOPE\'s, never a merge', () => {
    /**
     * ⛔⛔⛔ THE DEFECT'S OWN MUTANT. An authoring pass written as
     * `{...committed, ...measured}` keeps every field the measurement did not
     * name — and a stale `rng.seed` is exactly the field a projection can miss
     * while `seam` moves. The pipeline never merges, so the row that would
     * have hidden the survival is the row that PRINTS it.
     */
    it('⛓ every field comes from the measurement, and a MOVED one is reported', () => {
        const { blocks, rows } = bootFromEnvelopeOnly(envelope(1196897329), committed, project);
        expect(blocks.rng.seed).toBe(1196897329);
        const seedRow = rows.find((r) => r.field === 'rng.seed');
        expect(seedRow).toEqual({
            field: 'rng.seed', committed: 514746467, measured: 1196897329, moved: true,
        });
        // and the fields that did NOT move are reported too — a diff that
        // printed only movers could not tell "unchanged" from "not compared".
        expect(rows.find((r) => r.field === 'rng.fp')).toEqual({
            field: 'rng.fp', committed: 341033166, measured: 341033166, moved: false,
        });
        expect(rows.some((r) => r.moved && r.field !== 'rng.seed')).toBe(false);
    });

    it('⛓ a measurement that AGREES with the committed block moves nothing', () => {
        const { blocks, rows } = bootFromEnvelopeOnly(envelope(514746467), committed, project);
        expect(blocks.rng.seed).toBe(514746467);
        expect(rows.filter((r) => r.moved)).toEqual([]);
    });

    /**
     * ⛔ THE CARRY-OVER MUTANT: a projection that stops producing a field the
     * committed tape declares. A merge would silently keep the committed
     * value; this REFUSES BY NAME.
     */
    it('⛔ a field the envelope cannot produce REFUSES BY NAME', () => {
        const lossy = (env) => {
            const b = project(env);
            delete b.rng.seed;
            return b;
        };
        expect(() => bootFromEnvelopeOnly(envelope(1196897329), committed, lossy))
            .toThrow(/rng\.seed/);
        expect(() => bootFromEnvelopeOnly(envelope(1196897329), committed, lossy))
            .toThrow(/REFUSAL BY NAME/);
    });
});

describe('the latch cache key covers the COMPLETE bytes', () => {
    /**
     * ⛔ THE MUTANT: keying on the game-visible projection. `tick0` is a
     * `GAME_VISIBLE_DROPS` field, so two tapes that differ ONLY in the block a
     * continuation window is driven with project to the same bytes — and a
     * projection-keyed cache would hand the second one the first one's latch.
     */
    it('⛓ two boots that differ ONLY in `tick0` get DIFFERENT keys', () => {
        const base = { name: 'x', boot: { level: 6 }, rng: { seed: 1 }, inputs: [] };
        const a = { ...base, tick0: { rng: { seed: 111 } } };
        const b = { ...base, tick0: { rng: { seed: 222 } } };
        expect(latchCacheKey(a)).not.toBe(latchCacheKey(b));
        expect(latchCacheKey(a)).toBe(latchCacheKey({ ...base, tick0: { rng: { seed: 111 } } }));
    });
});

describe('the subject is DERIVED', () => {
    const tapes = {
        't1': { rng: { seed: 0 }, seam: null, boot: { level: 0 }, persistence: [] },
        't2': { rng: { seed: 7 }, seam: { time: 5 }, boot: { level: 1 }, persistence: [] },
        's1': { rng: { seed: 9 }, seam: { time: 1 }, boot: { level: 18 }, persistence: [] },
    };
    const tapeOf = (n) => tapes[n];

    it('⛓ a true start declares NEITHER a stream nor a clock', () => {
        expect(isTrueStart(tapes.t1)).toBe(true);
        expect(isTrueStart(tapes.t2)).toBe(false);
    });

    it('⛓ only a multi-segment CUSTODY chain from a true start is a subject', () => {
        const chains = [
            { id: 'pair', segments: ['t1', 't2'] },
            { id: 'staged', kind: 'staged', segments: ['s1', 't2', 't2'] },
            { id: 'single', segments: ['t1'] },
            { id: 'not-a-start', segments: ['t2', 't2'] },
        ];
        expect(chainSubjects(chains, tapeOf).map((c) => c.id)).toEqual(['pair']);
    });
});

describe('the fresh-vs-continuation hazard is DERIVED, and it is not sufficient', () => {
    const l5 = {
        boot: { level: 5 },
        persistence: [{ level: 5, tag: 0, at: 427 }],
    };
    const l6 = { boot: { level: 6 }, persistence: [{ level: 5, tag: 0 }] };

    it('⛔ a continuation window with a TIMED clear for its OWN room is at risk', () => {
        const h = timedClearHazard(l5, 4);
        expect(h.atRisk).toBe(true);
        expect(h.ownRoom).toEqual(['5:0']);
        expect(h.why).toMatch(/NECESSARY, NOT SUFFICIENT/);
    });

    it('⛓ window 0 is NEVER at risk — it is a fresh boot on both paths', () => {
        expect(timedClearHazard(l5, 0).atRisk).toBe(false);
        expect(timedClearHazard(l5, 0).why).toMatch(/FRESH boot on both paths/);
    });

    it('⛓ a clear for a room the segment never enters is not a hazard', () => {
        expect(timedClearHazard(l6, 5).atRisk).toBe(false);
        expect(timedClearHazard(l6, 5).ownRoom).toEqual([]);
    });

    it('⛓ an UNTIMED clear is a boot state, not a mid-run one', () => {
        expect(timedClearHazard({ boot: { level: 5 }, persistence: [{ level: 5, tag: 0 }] }, 4)
            .atRisk).toBe(false);
    });
});

describe('a persistence row has a MEASURED half and a MODEL half', () => {
    /**
     * ⛔⛔ THE MUTANT THIS ROW PRICES: writing the latch's `{level, tag}` set
     * verbatim. It DELETES every `at` — the timed clears ⚖ ruling 14 gave the
     * walk — and every `note`, which on `r8-solve-8` is the record of a real
     * GPU binary search. Both would vanish into a tape that still parses.
     */
    it('⛓ a TIMED row survives a re-derivation the latch cannot see', () => {
        const committed = [
            { level: 5, tag: 0, note: 'earned upstream' },
            { level: 8, tag: 0, note: 'game-sourced', at: 246 },
            { level: 8, tag: 1, note: 'game-sourced', at: 645 },
        ];
        // the latch, taken BEFORE this walk, sees only what is in force
        expect(mergePersistence([{ level: 5, tag: 0 }], committed)).toEqual(committed);
    });

    it('⛓ `note` rides with its row, and a NEW row gets an empty one', () => {
        const committed = [{ level: 5, tag: 0, note: 'why' }];
        expect(mergePersistence([{ level: 5, tag: 0 }, { level: 9, tag: 2 }], committed))
            .toEqual([
                { level: 5, tag: 0, note: 'why' },
                { level: 9, tag: 2, note: '' },
            ]);
    });

    it('⛓ a committed UNTIMED row the measurement drops IS a real move', () => {
        expect(mergePersistence([], [{ level: 5, tag: 0, note: '' }])).toEqual([]);
    });

    it('⛔ a clear cannot be both INHERITED and EARNED', () => {
        expect(() => mergePersistence([{ level: 5, tag: 0 }],
            [{ level: 5, tag: 0, note: '', at: 427 }]))
            .toThrow(/both inherited and earned/);
    });

    it('⛓ the result is sorted the way `parsePersistence` sorts', () => {
        const out = mergePersistence(
            [{ level: 9, tag: 1 }, { level: 5, tag: 2 }, { level: 5, tag: 0 }], []);
        expect(out.map((c) => `${c.level}:${c.tag}`)).toEqual(['5:0', '5:2', '9:1']);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12b″ — **THE PRODUCER AND THE CHAIN NAME THE SAME SEGMENTS.**
 *
 * `solve-seedling-r9-campaign.mjs` declares `SEGMENTS` and
 * `PLAYTHROUGH_CHAINS.r9-campaign` declares `segments`; the pipeline reads the
 * SECOND and the tapes come from the FIRST. Nothing had ever asserted they
 * agree, and the failure mode is silent in both directions: a producer that
 * grew a room the chain does not play emits a tape the sequence never walks,
 * and a chain that grew one the producer does not solve refuses at load with
 * an ENOENT nobody predicted.
 *
 * ⛔ THE SOURCE IS READ, because that is where the mistake is made. The
 * producer cannot be imported — it solves the whole campaign at module scope
 * and drives Windows Chrome for the latches — so the declaration is scanned
 * out of its text, and the scan asserts its own non-vacuity first.
 */
describe('the campaign producer and the campaign chain (R9 slice 12b\u2033)', () => {
    it('\u26d3 name the same segments, in the same order', () => {
        const src = readFileSync(
            new URL('./solve-seedling-r9-campaign.mjs', import.meta.url), 'utf8');
        const block = src.slice(src.indexOf('const SEGMENTS = ['),
            src.indexOf('/** \u26d3 The head of the chain'));
        // non-vacuity: the slice really is the declaration and nothing else
        expect(block).toMatch(/^const SEGMENTS = \[/);
        expect(block).toMatch(/\];\s*$/);
        const names = [...block.matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]);
        const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === 'r9-campaign');
        expect(names).toEqual([...chain.segments]);
    });

    it('\u26d3 …and the producer\u2019s LAST segment is the room the chain ends on \u2014 L14 \u2192 L15', () => {
        const src = readFileSync(
            new URL('./solve-seedling-r9-campaign.mjs', import.meta.url), 'utf8');
        const block = src.slice(src.indexOf('const SEGMENTS = ['),
            src.indexOf('/** \u26d3 The head of the chain'));
        const rows = [...block.matchAll(
            /\{ name: '([^']+)', level: (\d+), to: (\d+)/g)]
            .map((m) => ({ name: m[1], level: Number(m[2]), to: Number(m[3]) }));
        expect(rows.length).toBeGreaterThan(1);
        expect(rows.at(-1)).toEqual({ name: 'r9-solve-14', level: 14, to: 15 });
        // ⛓ and every row's `to` is its successor's `level` — the sphere
        //   order's own chaining, derived rather than restated
        expect(rows.slice(0, -1).filter((r, i) => r.to !== rows[i + 1].level)).toEqual([]);
    });
});
