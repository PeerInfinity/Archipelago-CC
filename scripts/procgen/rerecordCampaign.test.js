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
import { gameVisibleTape, parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { cascadeFrom } from './walkMoves.js';
import { producerScripts } from './standingValues.js';
import {
    DASH_WITNESSES,
    HAND_WITNESSES,
    accountingUniverse,
    movedProjections,
    projectionIndex,
    bootFromEnvelopeOnly,
    chainSubjects,
    duplicatedWitnesses,
    isTrueStart,
    latchCacheKey,
    mergePersistence,
    rosterComplement,
    timedClearHazard,
} from './rerecordCampaign.js';
import { solverRosterFromData } from './producerSegments.js';
import { rosterLabels } from './fullTierEstimate.js';

/** ⛓ This repository — the derivations below ask the real producers. */
const REPO = new URL('../../', import.meta.url).pathname;

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

describe('the PRE-P1 latch cache key — kept only so the migration can read it', () => {
    /**
     * ⛔⛔ THIS ROW IS ABOUT THE LEGACY SPELLING AND IS NO LONGER A CLAIM THAT
     * THE LEGACY SPELLING IS RIGHT (R9 P1, ⚖ 54 (4)).
     *
     * It used to carry the argument: `tick0` is a `GAME_VISIBLE_DROPS` field,
     * so two tapes differing only in "the block a continuation window is
     * driven with" project to the same bytes, and a projection-keyed cache
     * would hand the second one the first one's latch. ⛔ The continuation
     * window that is driven with `tick0` is `watchWasm`'s, not this cache's:
     * `driveLatch` ships `gameVisibleTape(parsed)`, so `tick0` never reaches
     * the game and a latch cannot depend on it. Separating those two tapes is
     * what made `r8-d2-19`'s 721-tick answer unreachable in a cache that held
     * it — the whole difference being the `tick0` block S2 re-derives AFTER S1
     * has driven.
     *
     * ⇒ the live key is `provisionalLatch.latchCacheCandidates`, whose own
     * rows assert the OPPOSITE of this one; this stays because the migration
     * still has to compute the old key to find the old files.
     */
    it('⛓ the LEGACY key separates two boots that differ ONLY in `tick0`', () => {
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

/**
 * ⛓⛓⛓ R9 SLICE 12e′ — **THE ACCOUNTING UNIVERSE IS NOT THE SUBJECT, AND THE
 * DAY THEY WERE THE SAME LIST A REAL WALK MOVE WENT UNREPORTED.**
 *
 * S0's *"every chain segment is ACCOUNTED FOR"* was total over the chains it
 * ENUMERATED — the multi-segment ones — rather than over the chains that
 * EXIST. `r8-solve-11` is the only segment of the one-segment chain
 * `r8-battery-11`; its own producer reported it as a walk move; `reportRows`
 * dropped it into neither the table nor the named `unmeasured` list. Measured
 * 2026-08-25: 87 t -> 84 t under ⚖ ruling 46 (R9 §33).
 */
describe('R9 12e′: the walk accounting is total over the chains that EXIST', () => {
    it('⛓ every chain contributes, and a segment two chains name is claimed ONCE', () => {
        const chains = [
            { id: 'pair', segments: ['a', 'b'] },
            { id: 'solo-dup', segments: ['a'] },
            { id: 'solo-new', segments: ['z'] },
        ];
        expect(accountingUniverse(chains)).toEqual([
            { id: 'pair', segments: ['a', 'b'], headline: null },
            { id: 'solo-new', segments: ['z'], headline: null },
        ]);
    });

    it('⛔ the MULTI-segment chain claims first, so no existing row changes its label', () => {
        // Declared solo-first on purpose: the order of `chains` must not decide
        // which chain owns `a`, or the table's `chain` column would depend on a
        // declaration order nobody is holding still.
        const chains = [
            { id: 'solo', segments: ['a'] },
            { id: 'pair', segments: ['a', 'b'] },
        ];
        expect(accountingUniverse(chains)).toEqual([
            { id: 'pair', segments: ['a', 'b'], headline: null },
        ]);
    });

    it('⛓ on the REAL tree it adds exactly the segments nobody could see', () => {
        const subject = new Set(PLAYTHROUGH_CHAINS
            .filter((c) => (c.segments ?? []).length >= 2)
            .flatMap((c) => c.segments));
        const extra = accountingUniverse(PLAYTHROUGH_CHAINS)
            .flatMap((c) => c.segments).filter((s) => !subject.has(s));
        // ⛔ DERIVED, not typed: ten of the twelve one-segment chains name a
        // segment `r9-campaign` already carries, so only two are new — and one
        // of them is the segment that was lost.
        expect(extra).toEqual(['r8-solve-11', 'r8-solve-20']);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **THE HEADLINE FELL THROUGH THE SAME FLOOR, ONE
 * LEVEL UP.** `solve-seedling-r8-d2-chain.mjs` re-authors and REPORTS `r8-d2`
 * (2186 t) on every run, and it is not in `chain.segments`, so `reportRows`
 * threw the row away exactly as it threw `r8-solve-11`'s away.
 */
describe('R9 12e′ RE-RUN: a chain HEADLINE is accounted for, and never twice', () => {
    it('⛓ a headline no chain claims as a segment becomes the chain\'s own row', () => {
        const chains = [{ id: 'pair', segments: ['a', 'b'], headline: 'pair-full' }];
        expect(accountingUniverse(chains)).toEqual([
            { id: 'pair', segments: ['a', 'b'], headline: 'pair-full' },
        ]);
    });

    it('⛔ a headline that IS its own only segment is NOT counted a second time', () => {
        // This is the shape twelve of the fifteen declared chains have
        // (`r8-battery-*`, `r8-d2-shield`): claiming the tape twice would break
        // the "in exactly one report" arithmetic the universe exists for.
        const chains = [{ id: 'solo', segments: ['a'], headline: 'a' }];
        expect(accountingUniverse(chains)).toEqual([
            { id: 'solo', segments: ['a'], headline: null },
        ]);
    });

    it('⛔ a headline that is ANOTHER chain\'s segment is claimed by that chain alone', () => {
        // The second pass exists for exactly this: a one-pass claim would let
        // the declaration ORDER decide whether the tape is counted once or
        // twice, which is the defect the multi-first ordering already fixed
        // for segments.
        const chains = [
            { id: 'owner', segments: ['a', 'b'] },
            { id: 'other', segments: ['z'], headline: 'a' },
        ];
        expect(accountingUniverse(chains)).toEqual([
            { id: 'owner', segments: ['a', 'b'], headline: null },
            { id: 'other', segments: ['z'], headline: null },
        ]);
    });

    it('⛓ on the REAL tree exactly TWO headlines are new, and one of them is `r8-d2`', () => {
        // ⛔ DERIVED, not typed: every other declared headline is already its
        // own chain's segment.
        const extra = accountingUniverse(PLAYTHROUGH_CHAINS)
            .map((c) => c.headline).filter(Boolean).sort();
        expect(extra).toEqual(['r7-ends-meet-full', 'r8-d2']);
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
 * ⛓⛓⛓ R9 SLICE 12b″ — **THE PRODUCER AND THE CHAIN NAMED THE SAME SEGMENTS**,
 * asserted by two rows that read the producer's SOURCE, because nothing had
 * ever checked that `solve-seedling-r9-campaign.mjs`'s `SEGMENTS` and
 * `PLAYTHROUGH_CHAINS.r9-campaign.segments` agreed — and the failure was silent
 * in both directions.
 *
 * ⛔⛔ BOTH ROWS ARE RETIRED HERE, AND NOT SILENTLY (trap 119). ⚖ Ruling 38 (1),
 * R9 slice 12d, deleted the duplicate they compared: the membership is one
 * declaration, `frontend/modules/seedlingDemo/campaignChain.js`, and the
 * producer IMPORTS it. An agreement row is what you write when the duplicate is
 * staying; there is nothing left for these two to disagree about.
 *
 * Where each claim went — `campaignChain.test.js`:
 *   · "name the same segments, in the same order" → an IDENTITY row: the page
 *     table and the roster table are the SAME frozen array, which a typed copy
 *     cannot be, plus a source row asserting the producer declares no list.
 *   · "every row's `to` is its successor's `level`" → a predicate over the
 *     declaration (`campaignChainBreaks()`), not a regex over text.
 *   · the tail `{name:'r9-solve-14', level:14, to:15}` → `campaignNextLevel()
 *     === frontier.nextStep.level`. ⚠ THE TYPED TAIL WAS TRAP 574'S SHAPE —
 *     a gate's subject frozen as a literal, decaying once per growth — and it
 *     is now the artifact `--grow` itself asks before it writes anything.
 */

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **S3's RECORD SET, DERIVED FROM THE ARTIFACTS
 * RATHER THAN FROM S2's BOOKKEEPING** (§33.4 item 4).
 *
 * `record()` used to select `s2.wrote`: the tapes whose BOOT blocks S2 edited.
 * That is the cascade's SUCCESSORS, so it is every moved segment EXCEPT the
 * first in each chain — whose boot is upstream of its own move and never
 * changes. The dropped ones then carry stale expectations into S4, which reds
 * by name AFTER the GPU has been spent.
 */
describe('R9 12e′ RE-RUN: the record set is the game-visible projection diff', () => {
    it('⛓ the index is keyed on the PROJECTION, so two tapes with the same bytes agree', () => {
        const idx = projectionIndex(['a', 'b'], (n) => (n === 'a' ? 'X' : 'X'));
        expect(idx.a).toBe(idx.b);
        expect(idx.a).toMatch(/^[0-9a-f]{32}$/);
    });

    it('⛓ a moved projection, an APPEARED tape and a VANISHED one are told apart', () => {
        const before = { keep: '1', move: '1', gone: '1' };
        const after = { keep: '1', move: '2', fresh: '9' };
        expect(movedProjections(before, after)).toEqual({
            moved: ['move'], appeared: ['fresh'], vanished: ['gone'],
        });
    });

    it('⛓ the answer does not depend on directory order — both lists come back sorted', () => {
        const r = movedProjections({ z: '1', a: '1', m: '1' }, { z: '2', a: '2', m: '2' });
        expect(r.moved).toEqual(['a', 'm', 'z']);
    });

    /**
     * ⛔⛔⛔ **MUTANT (e), AS A ROW.** The synthetic run below is this slice's
     * own licensed set: thirteen tapes move, and the EIGHT `s2.wrote` would
     * have selected are the cascade successors. The five it cannot see are
     * named, because a count would have passed on the wrong five.
     */
    describe('⛔ against `s2.wrote`, which is what it replaces', () => {
        // The ⚖ ruling 49 + extension licence, in chain order.
        const LICENSED = ['r8-solve-18', 'r8-d2-19', 'r8-d2-20', 'r8-d2', 'r8-solve-20',
            'r8-solve-11', 'r8-solve-10', 'r9-solve-11', 'r9-solve-3', 'r9-solve-2',
            'r9-solve-0', 'r9-solve-13', 'r9-solve-14', 'r9-solve-15'];
        // Two tapes the run does not touch, so the diff has something to be
        // silent about — an all-movers fixture could not tell a selector from
        // a constant.
        const INERT = ['r8-solve-1', 'r9-l0-sword-dash-rest'];
        const before = projectionIndex([...LICENSED, ...INERT], (n) => `committed:${n}`);
        const after = projectionIndex([...LICENSED, ...INERT],
            (n) => (LICENSED.includes(n) ? `re-authored:${n}` : `committed:${n}`));

        /**
         * ⛔ `s2.wrote` IS DERIVED HERE, NOT TYPED, and that is what makes the
         * comparison mean something. S2 writes the boots the CASCADE
         * downgrades, so the set is `cascadeFrom`'s own successors over the
         * REAL chain shapes — read out of `PLAYTHROUGH_CHAINS` — against the
         * same thirteen movers. A second typed roster would have been a list
         * agreeing with a list.
         */
        const chains = ['r9-campaign', 'r8-d2'].map((id) => {
            const c = PLAYTHROUGH_CHAINS.find((x) => x.id === id);
            return { id, segments: c.segments.slice(), headline: c.headline ?? null };
        });
        const moved = LICENSED.map((segment) => {
            const chain = chains.find((c) => c.segments.includes(segment)
                || c.headline === segment);
            if (!chain) return { chain: 'other', index: 0, segment, role: 'segment' };
            const index = chain.segments.indexOf(segment);
            return index === -1
                ? { chain: chain.id, index: chain.segments.length, segment, role: 'headline' }
                : { chain: chain.id, index, segment, role: 'segment' };
        });
        const s2Wrote = [...cascadeFrom(chains, moved).values()]
            .flatMap((c) => c.successors);

        it('⛓⛓ the projection diff lands on every licensed tape, and on nothing else', () => {
            const r = movedProjections(before, after);
            expect(r.moved).toEqual([...LICENSED].sort());
            expect(r.appeared).toEqual([]);
            expect(r.vanished).toEqual([]);
        });

        it('⛔⛔ the tapes `s2.wrote` DROPS are NAMED — a count would pass on the wrong ones', () => {
            const dropped = movedProjections(before, after).moved
                .filter((n) => !s2Wrote.includes(n));
            // ⛓ The two chains' first movers, the headline that is in no
            //   chain's boot order, and the segment whose chain has no
            //   boundary at all.
            expect(dropped.sort()).toEqual(
                ['r8-d2', 'r8-solve-10', 'r8-solve-11', 'r8-solve-18', 'r8-solve-20']);
            // …and the complement is exactly what a cascade CAN see, so the
            // two sets partition the licence rather than merely differing.
            expect([...dropped, ...s2Wrote].sort()).toEqual([...LICENSED].sort());
        });

        /**
         * ⛓ AND A TICK-0-ONLY MOVE COSTS NO GPU, which is the saving the
         * projection buys rather than a claim about it: `tick0` is a
         * `GAME_VISIBLE_DROPS` field, and S2 re-derives FIFTEEN of them at this
         * head — more tapes than the record set itself.
         */
        it('⛓ a change the projection drops does NOT enter the set', () => {
            const same = projectionIndex(INERT, (n) => `committed:${n}`);
            expect(movedProjections(same, same).moved).toEqual([]);
        });
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **WHAT THE SELECTOR CAN AND CANNOT SEE, MEASURED
 * ON A REAL COMMITTED TAPE RATHER THAN ASSERTED IN ITS DOCBLOCK.**
 *
 * The design this replaces was written believing `gameVisibleTape` projects
 * `description` away, so a ⚖ ruling 39 prose edit would cost no GPU. It does
 * not — and the two rows below are the difference between knowing that and
 * hoping it.
 */
describe('R9 12e′ RE-RUN: the projection\'s reach, on a committed tape', () => {
    const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
    const rawOf = (n) => JSON.parse(readFileSync(`${TAPES}/${n}.json`, 'utf8'));
    const projected = (raw) => JSON.stringify(gameVisibleTape(parseTape(raw)));

    it('⛔ `description` SURVIVES the projection — the selector is over-inclusive here', () => {
        const raw = rawOf('r9-solve-13');
        expect(raw.description.length).toBeGreaterThan(0);
        expect(projected(raw)).not.toBe(projected({ ...raw, description: 'edited' }));
        // ⛓ …and the direction is the safe one: it can spend a GPU row on a
        //   prose edit, never miss a walk. The defect being repaired is
        //   UNDER-recording.
    });

    it('⛓ `tick0` is DROPPED — S2\'s fifteen re-derivations cost no GPU at all', () => {
        const raw = rawOf('r9-solve-13');
        expect(raw.tick0).toBeTruthy();
        const moved = { ...raw, tick0: { ...raw.tick0, rng: { ...raw.tick0.rng, seed: 12345 } } };
        expect(projected(moved)).toBe(projected(raw));
    });

    it('⛓ `inputs` moving MOVES it — the case the whole selector exists for', () => {
        const raw = rawOf('r9-solve-13');
        // ⛓ THE SPAN BOUNDS ARE KEPT and only the KEY is swapped, so the tape
        //   still parses: a shortened `tick_count` is refused by `parseTape`
        //   ("the bot would disarm mid-hold") and would have tested the
        //   validator rather than the projection.
        const swapped = { ...raw,
            inputs: raw.inputs.map((r, i) => (i === 0 ? { ...r, key: 'right' } : r)) };
        expect(swapped.inputs[0].key).not.toBe(raw.inputs[0].key);
        expect(projected(swapped)).not.toBe(projected(raw));
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * R9 P1b, ⚖ 54 (3) — THE SEAM'S OWN LANDMINE, ASSERTED RATHER THAN WARNED
 * ══════════════════════════════════════════════════════════════════════ */
describe('the pipeline is NOT a producer, and the row that keeps it that way', () => {
    /**
     * ⛔⛔ THE DEFECT THIS REFUSES IS ON THE RECORD. `standingValues.producerScripts`
     * scans this directory for files matching `^(?:solve|plan|rerecord)-…\.mjs$`
     * that spell `--check` as a LITERAL, and it added a row for
     * `rerecord-seedling-campaign.mjs` the moment S0's walk measurement started
     * shelling out with that flag — which then RAN THE WHOLE PIPELINE (browser,
     * GPU, tape writes) inside a baseline measurement. The cure was to spell the
     * flag through `walkMoves.CHECK_FLAG`, a `.js` outside that scan.
     *
     * ⛓ THE PIPELINE'S OWN HEADER SAYS SO, AND A HEADER IS NOT A CHECK (trap 717).
     * P1b's injection seam is a large edit to that file; a `'--check'` typed into
     * it anywhere — a new default, a stub's argv, a rehearsal — re-arms the row
     * silently. This row is what makes that impossible to do by accident.
     */
    it('⛔ `producerScripts` does NOT list the re-record pipeline', () => {
        const listed = producerScripts();
        expect(listed).not.toContain('rerecord-seedling-campaign.mjs');
        // ⛓ …and the scan is NOT vacuous: it finds the real producers.
        expect(listed).toContain('solve-seedling-r8-d2.mjs');
        expect(listed.length).toBeGreaterThan(5);
    });

    it('⛔ …because the file spells the flag through `CHECK_FLAG`, never as a literal', () => {
        const src = readFileSync(
            new URL('./rerecord-seedling-campaign.mjs', import.meta.url), 'utf8');
        // ⛓ the three spellings `producerScripts` matches, by name.
        for (const literal of ["'--check'", '"--check"', '--check=']) {
            expect(src.includes(literal)).toBe(false);
        }
        expect(src).toContain('CHECK_FLAG');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ R9 P3b, §47.6 — S4's COVERAGE, DERIVED (⚖ 17)
 * ══════════════════════════════════════════════════════════════════════ */
describe('the S4 coverage derivation', () => {
    const TAPES = new URL('../../frontend/modules/seedlingDemo/fixtures/tapes/',
        import.meta.url).pathname;

    /**
     * ⛔⛔ THIS IS THE ⚖ 17 LINT, AND IT RUNS OFFLINE. Both witness lists are
     * HAND lists; the one thing that must stay true of them is that neither
     * restates a membership `solverRosterFromData` already derives. Two
     * spellings of one fact disagree the first time either moves, and the hand
     * one is the one that goes stale. While these constants lived in the
     * pipeline script this claim could only be made by spending a `--win`
     * roster inside `prove()`.
     */
    it('no hand witness duplicates what the producers themselves declare', () => {
        const derived = solverRosterFromData({ repo: REPO });
        expect(duplicatedWitnesses(derived)).toEqual([]);
    });

    /**
     * ⛓⛓ THE PARTITION. `roster ∖ prove()` and what S4 drives must together be
     * the roster and share nothing — the property that makes "covered" a
     * complement rather than a second list somebody keeps.
     */
    it('partitions the roster: complement ∪ covered = roster, and they are disjoint', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        const derived = solverRosterFromData({ repo: REPO });
        const complement = rosterComplement({ roster, derived });
        const covered = new Set([...derived, ...HAND_WITNESSES, ...DASH_WITNESSES]);
        for (const label of complement) expect(covered.has(label)).toBe(false);
        const rebuilt = new Set([...complement, ...roster.filter((l) => covered.has(l))]);
        expect([...rebuilt].sort()).toEqual(roster);
    });

    /**
     * ⛓⛓⛓ THE POSITIVE CONTROL — §47.6's OWN NINE. R9 slice 12h named nine
     * pinned tapes `prove()` never drove; a derivation that could not see them
     * would be a complement in name only.
     *
     * ⚠ TWO OF THE NINE ARE NAMED WRONG IN §47.6 and are corrected here from
     * the disk: `r9-l6-harmless-control` / `r9-l6-harmless-press`, not
     * `r9-l6-bob-harmless-*` (the section's dash-continuation reads as a `-bob`
     * prefix it does not have).
     */
    it('names §47.6\'s nine uncovered tapes, every one', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        const complement = new Set(rosterComplement(
            { roster, derived: solverRosterFromData({ repo: REPO }) }));
        for (const label of ['r7-act2-5', 'r7-act2-6', 'r7-act2-full',
            'r7-ends-meet-1', 'r7-ends-meet-2', 'r7-ends-meet-full',
            'r9-l6-bob-press', 'r9-l6-harmless-control', 'r9-l6-harmless-press']) {
            expect({ label, onDisk: roster.includes(label) })
                .toEqual({ label, onDisk: true });
            expect({ label, uncovered: complement.has(label) })
                .toEqual({ label, uncovered: true });
        }
    });

    /**
     * ⛔ AND THE COMPLEMENT IS NOT VACUOUSLY EVERYTHING. A `rosterComplement`
     * that ignored `derived` would satisfy every row above; this one cannot.
     */
    it('excludes what the producers DO declare', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        const derived = solverRosterFromData({ repo: REPO });
        expect(derived.length).toBeGreaterThan(0);
        const complement = new Set(rosterComplement({ roster, derived }));
        for (const label of derived) expect(complement.has(label)).toBe(false);
        expect(complement.size).toBeLessThan(roster.length);
    });
});
