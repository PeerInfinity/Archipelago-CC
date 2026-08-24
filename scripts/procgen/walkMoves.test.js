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
    participationOf, reportRows,
} from './walkMoves.js';

const TAPES = join(process.cwd(), 'frontend/modules/seedlingDemo/fixtures/tapes');
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
    it('⛓⛓ the nomination finds the four solvers the committed tapes NAME', () => {
        const nominated = nominateOwners(chains(), { tapesDir: TAPES });
        for (const file of ['solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs']) {
            expect([...nominated.keys()], `${file} was not nominated`).toContain(file);
        }
        expect(nominated.get('solve-seedling-r9-campaign.mjs')).toContain('r9-solve-14');
        expect(nominated.get('solve-seedling-r8-battery.mjs')).toContain('r8-solve-1');
    });

    /**
     * ⛔⛔ **AND THE NOMINATION IS NOT THE ANSWER.** `r7-ends-meet-1`'s
     * description names NO producer at all, and yet
     * `plan-seedling-r7-ends-meet.mjs` emits it. A description says what a tape
     * SAYS ABOUT ITSELF; ownership is the producer's own claim (trap 576).
     * This row exists so nobody re-derives ownership from descriptions later.
     */
    it('⛔⛔ a nomination can MISS a real owner — `r7-ends-meet-1` names none', () => {
        const nominated = nominateOwners(chains(), { tapesDir: TAPES });
        const nominatedSegments = new Set([...nominated.values()].flat());
        expect(nominatedSegments.has('r7-ends-meet-1')).toBe(false);
        // …and the file that really writes it does exist in this directory.
        expect(readdirSync(join(process.cwd(), 'scripts/procgen')))
            .toContain('plan-seedling-r7-ends-meet.mjs');
    });

    /**
     * ⛓⛓⛓ **THE BROWSER DETECTOR FIRES ON A REAL SOURCE**, which is the only
     * calibration that means anything: `plan-seedling-r7-ends-meet.mjs`
     * imports playwright and launches chromium at module scope, so it can
     * never be measured inside an OFFLINE S0. The four solvers do not.
     */
    it('⛓⛓⛓ participation: the four solvers YES, the browser producer NO — and it says why', async () => {
        const rows = (await buildInstruments()).rows;
        const p = participationOf([
            'solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs',
            'plan-seedling-r7-ends-meet.mjs',
        ], { instrumentRows: rows });
        const by = new Map(p.map((r) => [r.file, r]));
        for (const file of ['solve-seedling-r9-campaign.mjs', 'solve-seedling-r8-battery.mjs',
            'solve-seedling-r8-l18.mjs', 'solve-seedling-r8-d2-chain.mjs']) {
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
