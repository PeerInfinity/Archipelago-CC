/**
 * walkMoves — ⚖ RULING 43's mode, unit-rowed.
 *
 * ⛔⛔ EVERY FILTER HERE IS A NEGATIVE ONE — "which producer owns this",
 * "which producer may participate", "which segment moved" all answer by
 * EXCLUDING — and a negative filter that looks like precision is trap 579/580's
 * shape. So each one is calibrated against a KNOWN POSITIVE taken from the
 * REAL tree, not from a fixture that was built to agree with it.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { PLAYTHROUGH_CHAINS } from '../../frontend/modules/seedlingDemo/playthroughWalk.js';
import { buildInstruments } from './reference/instruments.mjs';
import {
    LICENSE_FLAG, applyLicence, cascadeFrom, licenceFrom, movedSegments, nominateOwners,
    participationOf, producerOrder, reportRows,
} from './walkMoves.js';
import { ownersByEmit } from './producerSegments.js';

const TAPES = join(process.cwd(), 'frontend/modules/seedlingDemo/fixtures/tapes');
/** ⛓ The real tree's ownership, DERIVED from the producers (R9 P3 (C)). */
const owners = () => ownersByEmit({ repo: process.cwd() });
const chains = () => PLAYTHROUGH_CHAINS
    .filter((c) => (c.segments ?? []).length >= 2)
    .map((c) => ({ id: c.id, segments: c.segments.slice() }));

describe('walkMoves: the two derivations, calibrated against the REAL tree', () => {
    /**
     * ⛓⛓ THE KNOWN POSITIVES: the four producers that own campaign / r8-d2
     * segments must be nominated, by their real committed tapes' own
     * descriptions. A nomination scan that silently found nothing would leave
     * every segment `unmeasured` and every walk move invisible.
     */
    it('⛓⛓ the nomination finds the four solvers that EMIT the chain segments', () => {
        const nominated = nominateOwners(chains(), { owners: owners() });
        for (const file of ['solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs']) {
            expect([...nominated.keys()], `${file} was not nominated`).toContain(file);
        }
        expect(nominated.get('solve-seedling-r9-campaign.mjs')).toContain('r9-solve-14');
        expect(nominated.get('solve-seedling-r8-battery.mjs')).toContain('r8-solve-1');
    });

    /**
     * ⛓⛓⛓ **THE DEFECT THIS ROW USED TO PIN IS CURED, AND THE ROW IS THE
     * PROOF.** `r7-ends-meet-1`'s description names NO producer at all — it
     * never has (trap 576) — so while ownership was regexed out of prose it was
     * an owner-less segment, and this file asserted that MISS as a fact of
     * life. `plan-seedling-r7-ends-meet.mjs` emits it and always did; asking the
     * producer instead of the tape returns the owner the prose could not.
     * R9 P3 (C), trap 773.
     */
    it('⛓⛓⛓ the segment whose PROSE names nobody now has its real owner', () => {
        const nominated = nominateOwners(chains(), { owners: owners() });
        expect(nominated.get('plan-seedling-r7-ends-meet.mjs')).toContain('r7-ends-meet-1');
        // …and the file that really writes it does exist in this directory.
        expect(readdirSync(join(process.cwd(), 'scripts/procgen')))
            .toContain('plan-seedling-r7-ends-meet.mjs');
    });

    /**
     * ⛔ AND THE MAP IS INJECTED — a caller that passes none is REFUSED by
     * name rather than falling back to this repository, which is what keeps a
     * REHEARSAL answering about its own tree.
     */
    it('⛔ nominateOwners refuses an absent owner map rather than guessing', () => {
        expect(() => nominateOwners(chains(), {})).toThrow(/must be a Map of tape -> producer/);
    });

    /**
     * ⛓⛓⛓ **THE BROWSER DETECTOR FIRES ON A REAL SOURCE**, which is the only
     * calibration that means anything: `plan-seedling-r7-ends-meet.mjs`
     * imports playwright and launches chromium at module scope, so it can
     * never be measured inside an OFFLINE S0. The four solvers do not.
     */
    it('⛓⛓⛓ participation: the five solvers YES, the browser producer NO — and it says why', async () => {
        const rows = (await buildInstruments()).rows;
        const p = participationOf([
            'solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs',
            // ⛓ R9 12e′ RE-RUN — the FIFTH. `r8-solve-20` is on ⚖ 49's licence
            //   (365 t -> 229 t) and was `unmeasured` for want of this flag,
            //   which meant `spendWalkLicence` could never re-author it.
            'solve-seedling-r8-d2.mjs',
            'plan-seedling-r7-ends-meet.mjs',
        ], { instrumentRows: rows });
        const by = new Map(p.map((r) => [r.file, r]));
        for (const file of ['solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs',
            'solve-seedling-r8-d2.mjs']) {
            expect(by.get(file).participates, `${file} should participate`).toBe(true);
            expect(by.get(file).browser).toBe(false);
        }
        const ends = by.get('plan-seedling-r7-ends-meet.mjs');
        expect(ends.participates).toBe(false);
        expect(ends.browser).toBe(true);
        expect(ends.why).toMatch(/DRIVES A BROWSER/);
    });

    it('⛔ participation refuses to guess without the instruments scan', () => {
        expect(() => participationOf(['x.mjs'])).toThrow(/buildInstruments/);
    });
});

describe('walkMoves: the accounting, and it must balance', () => {
    const report = (producer, segments) => ({ producer, segments });
    const seg = (segment, verdict, solvedTicks = 10, committedTicks = 10) => ({
        segment, verdict, solvedTicks, committedTicks, moved: [], inputsIdentical: verdict !== 'walk-moves',
    });
    const toy = [{ id: 'toy', segments: ['a', 'b', 'c'] }];

    it('⛓ a segment reported by exactly one producer is measured', () => {
        const r = reportRows([report('p.mjs', [seg('a', 'none'), seg('b', 'none'),
            seg('c', 'none')])], toy);
        expect(r.rows).toHaveLength(3);
        expect(r.unmeasured).toEqual([]);
        expect(r.stops).toEqual([]);
    });

    it('⛔ a segment reported by TWO producers is a STOP by name', () => {
        const r = reportRows([report('p.mjs', [seg('a', 'none')]),
            report('q.mjs', [seg('a', 'none')])], toy);
        expect(r.stops.join(' ')).toMatch(/a is reported by TWO producers — p\.mjs and q\.mjs/);
    });

    it('⛓ a segment nobody reported is UNMEASURED by name, carrying the blocker\'s reason', () => {
        const r = reportRows([report('p.mjs', [seg('a', 'none')])], toy,
            [{ file: 'q.mjs', why: 'q.mjs DRIVES A BROWSER' }]);
        expect(r.unmeasured.map((u) => u.segment)).toEqual(['b', 'c']);
        expect(r.unmeasured[0].why).toMatch(/DRIVES A BROWSER/);
    });
});

/**
 * ⛓⛓ R9 SLICE 12e′ — **AN UNMEASURED SEGMENT MUST NAME THE PRODUCER **IT**
 * NOMINATED**, not every blocked producer in the tree.
 *
 * The joined form is a TRUE sentence about the WRONG SUBJECT (trap 566's
 * family): on the real tree `r8-solve-20` was told it was unmeasurable because
 * `plan-seedling-r7-ends-meet.mjs` imports playwright — a producer it has
 * never named and that has nothing to do with it. The reader who acts on that
 * sentence fixes the wrong instrument.
 */
describe('R9 12e′: an unmeasured segment names ITS OWN blocked producer', () => {
    const report = (producer, segments) => ({ producer, segments });
    const seg = (segment) => ({ segment, verdict: 'none', solvedTicks: 10,
        committedTicks: 10, moved: [], inputsIdentical: true });
    const toy = [{ id: 'toy', segments: ['a', 'b', 'c'] }];
    const blocked = [{ file: 'browser.mjs', why: 'browser.mjs DRIVES A BROWSER' },
        { file: 'noflag.mjs', why: 'noflag.mjs does not accept `--walk-report`' }];
    const nominations = new Map([['browser.mjs', ['b']], ['noflag.mjs', ['c']]]);

    it('⛓ each unmeasured segment carries ONLY its own nominee\'s reason', () => {
        const r = reportRows([report('p.mjs', [seg('a')])], toy, blocked, nominations);
        const why = new Map(r.unmeasured.map((u) => [u.segment, u.why]));
        expect(why.get('b')).toMatch(/DRIVES A BROWSER/);
        expect(why.get('b')).not.toMatch(/--walk-report/);
        expect(why.get('c')).toMatch(/does not accept/);
        expect(why.get('c')).not.toMatch(/DRIVES A BROWSER/);
    });

    it('⛓ a segment that nominated NOBODY says so, rather than borrowing a reason', () => {
        // `r7-ends-meet-1`'s own shape: its description names no producer at
        // all (trap 576), so no blocked producer is ITS blocker.
        const r = reportRows([report('p.mjs', [seg('a'), seg('b')])], toy, blocked,
            new Map([['browser.mjs', ['b']]]));
        const c = r.unmeasured.find((u) => u.segment === 'c');
        expect(c.why).toMatch(/no producer IT NOMINATED was blocked/);
    });
});

describe('walkMoves: the cascade — and the row is NOT vacuous', () => {
    const seg = (segment, verdict, before = 10, after = 10) => ({
        segment, verdict, solvedTicks: after, committedTicks: before, moved: [],
    });

    /**
     * ⛔⛔⛔ **THE SYNTHETIC CHAIN IS THE POINT** (§27.9 point 3, trap 250).
     * `r9-solve-14` is LAST in `r9-campaign`, so a cascade row run on the real
     * chain has NO successor to downgrade and would pass with an empty list —
     * green, and about nothing. So the mover here is the MIDDLE segment.
     */
    const chain = [{ id: 'synthetic', segments: ['s1', 's2', 's3', 's4'] }];
    const rows = () => reportRows([{
        producer: 'synthetic.mjs',
        segments: [seg('s1', 'none'), seg('s2', 'walk-moves', 145, 96),
            seg('s3', 'none'), seg('s4', 'none')],
    }], chain).rows;

    it('⛓⛓⛓ the moved segment is NOT last, so the cascade has successors to name', () => {
        const moved = movedSegments(rows());
        expect(moved.map((m) => m.segment)).toEqual(['s2']);
        expect(moved[0].before).toBe(145);
        expect(moved[0].after).toBe(96);
        const cascade = cascadeFrom(chain, moved);
        expect(cascade.get('synthetic')).toEqual({
            firstMove: 1, firstMoveSegment: 's2', successors: ['s3', 's4'],
        });
    });

    /**
     * ⛓ AND IT IS THE FIRST MOVE THAT DECIDES. Two movers do not produce two
     * cascades: everything after the earlier one is downstream already.
     */
    it('⛓ two movers cascade from the FIRST, not from each', () => {
        const two = reportRows([{
            producer: 'synthetic.mjs',
            segments: [seg('s1', 'none'), seg('s2', 'walk-moves'), seg('s3', 'none'),
                seg('s4', 'walk-moves')],
        }], chain).rows;
        expect(cascadeFrom(chain, movedSegments(two)).get('synthetic').successors)
            .toEqual(['s3', 's4']);
    });

    it('⛓ nothing moved, nothing cascades', () => {
        expect(cascadeFrom(chain, []).size).toBe(0);
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **THE HEADLINE ROW.** §33.4 item 2: the d2-chain
 * producer reports `r8-d2` (2186 t) on every run and `reportRows` discarded it,
 * because it is not in `chain.segments`. It is accounted for now, with a `role`
 * so nothing downstream has to infer what it is from its index.
 */
describe('R9 12e′ RE-RUN: the headline is accounted for, and it never opens a cascade', () => {
    const seg = (segment, verdict, before = 10, after = 10) => ({
        segment, verdict, solvedTicks: after, committedTicks: before, moved: [],
    });
    const chain = [{ id: 'c', segments: ['s1', 's2'], headline: 'c-full' }];

    it('⛓ a reported headline is a ROW, at one past the last segment', () => {
        const r = reportRows([{ producer: 'p.mjs',
            segments: [seg('s1', 'none'), seg('s2', 'none'), seg('c-full', 'none')] }], chain);
        expect(r.rows.map((x) => [x.segment, x.role, x.index]))
            .toEqual([['s1', 'segment', 0], ['s2', 'segment', 1], ['c-full', 'headline', 2]]);
        expect(r.unmeasured).toEqual([]);
    });

    it('⛔ a headline NOBODY reported is NAMED unmeasured, not dropped', () => {
        // ⛔ THE MUTANT THIS ROW IS: with the headline arm removed, `unmeasured`
        //   comes back EMPTY and the accounting balances at 2 — which is
        //   exactly how a 2186 t tape went missing without a single red row.
        const r = reportRows([{ producer: 'p.mjs',
            segments: [seg('s1', 'none'), seg('s2', 'none')] }], chain,
        [{ file: 'q.mjs', why: 'q.mjs DRIVES A BROWSER' }]);
        expect(r.unmeasured.map((u) => [u.segment, u.role])).toEqual([['c-full', 'headline']]);
        expect(r.unmeasured[0].why).toMatch(/DRIVES A BROWSER/);
    });

    it('⛓ a headline nominates its own producer, so its reason is ITS producer\'s', () => {
        // The nomination map is what keeps an unmeasured row from carrying a
        // TRUE sentence about the WRONG SUBJECT (12e′'s `r8-solve-20`).
        const r = reportRows([], chain,
            [{ file: 'mine.mjs', why: 'mine.mjs does not accept `--walk-report`' },
                { file: 'theirs.mjs', why: 'theirs.mjs DRIVES A BROWSER' }],
            new Map([['mine.mjs', ['c-full']], ['theirs.mjs', ['s1', 's2']]]));
        const hl = r.unmeasured.find((u) => u.segment === 'c-full');
        expect(hl.why).toMatch(/does not accept/);
        expect(hl.why).not.toMatch(/DRIVES A BROWSER/);
    });

    /**
     * ⛔⛔ **A HEADLINE MOVING MUST NOT CASCADE, AND THE ROW DISCRIMINATES.**
     * The headline is at `index === segments.length`, so a `min` would never
     * pick it — that is an ACCIDENT of the index, not the rule. Here the
     * headline is the ONLY mover, so a cascade that took it would name a
     * chain with an empty successor list where the honest answer is no entry
     * at all.
     */
    it('⛔⛔ the headline is the ONLY mover — and NOTHING cascades', () => {
        const r = reportRows([{ producer: 'p.mjs',
            segments: [seg('s1', 'none'), seg('s2', 'none'),
                seg('c-full', 'walk-moves', 2186, 1672)] }], chain);
        const moved = movedSegments(r.rows);
        expect(moved.map((m) => [m.segment, m.role, m.before, m.after]))
            .toEqual([['c-full', 'headline', 2186, 1672]]);
        expect(cascadeFrom(chain, moved).size).toBe(0);
    });

    it('⛓ a segment moving beside it still cascades, from the SEGMENT', () => {
        const r = reportRows([{ producer: 'p.mjs',
            segments: [seg('s1', 'walk-moves', 541, 410), seg('s2', 'none'),
                seg('c-full', 'walk-moves', 2186, 1672)] }], chain);
        expect(cascadeFrom(chain, movedSegments(r.rows)).get('c')).toEqual({
            firstMove: 0, firstMoveSegment: 's1', successors: ['s2'],
        });
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12e′ RE-RUN — **THE LICENSED PRODUCERS RUN IN THE ORDER THE
 * CHAINS REQUIRE, AND A SORTED-FILE ORDER GOT IT WRONG ON THE REAL TREE.**
 *
 * Measured 2026-08-25: `spendWalkLicence` sorted by file name, so
 * `solve-seedling-r8-d2-chain.mjs` ran before `solve-seedling-r8-l18.mjs` —
 * which OWNS `r8-solve-18`, that chain's FIRST segment. The chain producer
 * drove the game for the latch of the 541-tick tape the series was about to
 * replace with a 410-tick one and solved `r8-d2-19` from it.
 */
describe('R9 12e′ RE-RUN: the producers run in the CHAINS\' order, not the file system\'s', () => {
    const row = (chain, index, segment, producer) => ({ chain, index, segment, producer,
        role: 'segment', verdict: 'walk-moves' });

    it('⛔⛔ on the REAL `r8-d2` shape, `-l18` runs BEFORE `-d2-chain` — and file order does not', () => {
        // ⛓ The chain and its owners are the tree's own: `r8-solve-18` is
        //   `r8-d2` segment 0 and belongs to the l18 producer.
        const c = PLAYTHROUGH_CHAINS.find((x) => x.id === 'r8-d2');
        expect(c.segments[0]).toBe('r8-solve-18');
        const rows = [
            row('r8-d2', 0, 'r8-solve-18', 'solve-seedling-r8-l18.mjs'),
            row('r8-d2', 1, 'r8-d2-19', 'solve-seedling-r8-d2-chain.mjs'),
            row('r8-d2', 2, 'r8-d2-20', 'solve-seedling-r8-d2-chain.mjs'),
        ];
        const running = ['solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-l18.mjs'];
        expect(producerOrder(rows, running))
            .toEqual(['solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs']);
        // …and this is the MUTANT stated as a row: the order it replaces is the
        // sorted one, which puts them the other way round.
        expect([...running].sort()).toEqual(
            ['solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-l18.mjs']);
    });

    it('⛓ a producer that is NOT running constrains nothing — the edge is dropped', () => {
        // Its predecessor's walk did not move, so its tape is already final.
        const rows = [
            row('c', 0, 's1', 'first.mjs'),
            row('c', 1, 's2', 'second.mjs'),
        ];
        expect(producerOrder(rows, ['second.mjs'])).toEqual(['second.mjs']);
    });

    it('⛓ producers no chain orders come back in NAME order, so a run is reproducible', () => {
        // ⚠ REWRITTEN at R9 12e′ (third run). This row used to pass `[]` for
        //   `rows`, which BLESSED the exact answer the lost-rows defect
        //   produced — sorted file order — and so could never have caught it.
        //   The subject is "no chain ORDERS these producers", and that is
        //   expressible with real rows about somebody else.
        const rows = [
            row('other', 0, 's1', 'unrelated.mjs'),
            row('other', 1, 's2', 'unrelated.mjs'),
        ];
        expect(producerOrder(rows, ['b.mjs', 'a.mjs', 'c.mjs']))
            .toEqual(['a.mjs', 'b.mjs', 'c.mjs']);
    });

    it('⛔⛔ ZERO rows with more than one producer REFUSES — it would BE the file order', () => {
        // ⛓ The defect this refuses is measured, not imagined: `predict()`
        //   returned a `walk` without `rows`, so a straight-through S0→S1 run
        //   handed this function `[]` and got the sorted order back — with
        //   `solve-seedling-r8-d2-chain.mjs` ahead of the `-l18` that owns its
        //   chain's first segment, which is what §35.4 removed.
        expect(() => producerOrder([], [
            'solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-l18.mjs',
        ])).toThrow(/ZERO report rows[\s\S]*FILE SYSTEM'S order[\s\S]*lost `walk\.rows`/);
        // …and the answer it refuses to give is exactly the wrong one.
        expect(['solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-l18.mjs'].sort())
            .toEqual(['solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-l18.mjs']);
    });

    it('⛓ ONE producer needs no order, so zero rows still answers', () => {
        expect(producerOrder([], ['only.mjs'])).toEqual(['only.mjs']);
    });

    it('⛔ two chains that disagree are a CYCLE, refused by name', () => {
        const rows = [
            row('one', 0, 's1', 'p.mjs'), row('one', 1, 's2', 'q.mjs'),
            row('two', 0, 't1', 'q.mjs'), row('two', 1, 't2', 'p.mjs'),
        ];
        expect(() => producerOrder(rows, ['p.mjs', 'q.mjs']))
            .toThrow(/CYCLE.*p\.mjs after \[q\.mjs\].*q\.mjs after \[p\.mjs\]/s);
    });

    it('⛓ a HEADLINE sits after every segment, so it never re-orders its own producer', () => {
        const rows = [
            row('c', 0, 's1', 'first.mjs'),
            row('c', 1, 's2', 'second.mjs'),
            { chain: 'c', index: 2, segment: 'c-full', producer: 'second.mjs',
                role: 'headline', verdict: 'walk-moves' },
        ];
        expect(producerOrder(rows, ['first.mjs', 'second.mjs']))
            .toEqual(['first.mjs', 'second.mjs']);
    });
});

describe('walkMoves: the licence', () => {
    const moved = [{ chain: 'c', index: 1, segment: 's2', producer: 'p.mjs',
        before: 145, after: 96 }];

    it('⛔ refused BY NAME without a ruling id — bare, and with an empty value', () => {
        expect(() => licenceFrom([LICENSE_FLAG])).toThrow(/REFUSED without a ruling id/);
        expect(() => licenceFrom([`${LICENSE_FLAG}=`])).toThrow(/REFUSED without a ruling id/);
        expect(() => licenceFrom([`${LICENSE_FLAG}=  `])).toThrow(/REFUSED without a ruling id/);
    });

    it('⛓ absent is `null` — the flag changes nothing when it is not given', () => {
        expect(licenceFrom(['--dry-run'])).toBeNull();
    });

    it('⛓ with an id it carries the id', () => {
        expect(licenceFrom([`${LICENSE_FLAG}=ruling 35(c)/41`])).toEqual({ ruling: 'ruling 35(c)/41' });
    });

    it('⛔⛔ a measured move with NO licence is a STOP naming the segment and both ticks', () => {
        const r = applyLicence(moved, null);
        expect(r.permitted).toEqual([]);
        expect(r.sealed).toBeNull();
        expect(r.stops[0]).toMatch(/s2 RE-SOLVES DIFFERENTLY \(145 t committed against 96 t today\)/);
    });

    /**
     * ⛔ **A LICENCE CANNOT WIDEN THE SET**, and the reason is structural
     * rather than checked: it carries a ruling id and nothing else, so there is
     * no place for a segment name to enter. What it seals is the MEASUREMENT.
     */
    it('⛓⛓ a licence permits EXACTLY the measured set, and seals the ruling with both ticks', () => {
        const r = applyLicence(moved, { ruling: 'ruling 35(c)/41' });
        expect(r.stops).toEqual([]);
        expect(r.permitted.map((p) => p.segment)).toEqual(['s2']);
        expect(r.sealed).toEqual({
            ruling: 'ruling 35(c)/41',
            segments: [{ segment: 's2', chain: 'c', producer: 'p.mjs', before: 145, after: 96 }],
        });
    });

    it('⛓ a licence offered against an EMPTY measured set is reported, not an error', () => {
        const r = applyLicence([], { ruling: 'ruling 43' });
        expect(r.stops).toEqual([]);
        expect(r.sealed.segments).toEqual([]);
        expect(r.sealed.note).toMatch(/measured set is EMPTY/);
    });
});
