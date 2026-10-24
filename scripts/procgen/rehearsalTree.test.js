/**
 * rehearsalTree — **THE FAKE TREE'S OWN CONTRACT, UNIT-ROWED.**
 * R9 slice P1b, ⚖ ruling 54 (3); kickoff §39.12 (b).
 *
 * ⛓ The load-bearing row is the ROUND TRIP: a latch derived from a tape's own
 * boot blocks must author exactly those blocks back. If it does not, S1's
 * control in the rehearsal is not "zero movers" and every scenario built on it
 * is measuring the generator rather than the pipeline.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    SEAM_PREBUILD_FIELDS, SEAM_SIGNATURE, seamBootFields, segmentBootFromLatch,
    seamLatchFindings,
} from '../../frontend/modules/seedlingDemo/r7Acceptance.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { bootFromEnvelopeOnly, mergePersistence } from './rerecordCampaign.js';
import {
    CALM_ARRIVAL, REHEARSAL_PLAN, buildRehearsalTree, latchEnvelopeFor, latchRecordFor,
    readRehearsalMarker,
} from './rehearsalTree.js';

const TAPES = new URL('../../frontend/modules/seedlingDemo/fixtures/tapes/', import.meta.url);
const tapeOf = (name) => parseTape(readFileSync(new URL(`${name}.json`, TAPES), 'utf8'));
const DEPS = {
    signature: SEAM_SIGNATURE,
    prebuildFields: SEAM_PREBUILD_FIELDS,
    seamBootFields,
};
const BOOT_BLOCKS = ['boot', 'save', 'persistence', 'pins', 'rng', 'seam'];
const committedBlocks = (t) => {
    const out = {};
    for (const b of BOOT_BLOCKS) if (t[b] !== undefined) out[b] = t[b];
    return out;
};

describe('the derived latch is `segmentBootFromLatch` run backwards', () => {
    /**
     * ⛓⛓⛓ THE ROUND TRIP, THROUGH THE PIPELINE'S OWN PROJECTION. `persistence`
     * is the one row that needs it: a latch's clear set is `{level, tag}` and
     * the committed rows carry `note` too, which `mergePersistence` re-attaches
     * — exactly `bootFromEnvelopeOnly`'s documented reason for taking a
     * `project` function at all.
     */
    it.each(REHEARSAL_PLAN.chains.flatMap((c) => c.segments).slice(1)
        .map((label) => [label, REHEARSAL_PLAN.sources[label]]))(
        '⛓ %s (from the committed %s): every field compared, ZERO moved',
        (_label, source) => {
            const t = tapeOf(source);
            const committed = committedBlocks(t);
            const env = latchEnvelopeFor(t, DEPS, { tick: t.tick_count });
            const project = (e) => {
                const b = segmentBootFromLatch(e);
                return { ...b,
                    persistence: mergePersistence(b.persistence, committed.persistence) };
            };
            const { rows } = bootFromEnvelopeOnly(env, committed, project);
            expect(rows.length).toBeGreaterThan(30);
            expect(rows.filter((r) => r.moved).map((r) => r.field)).toEqual([]);
        },
    );

    it('⛓ …and the latch reads CALM to `seamLatchFindings`, which is what makes it '
        + 'bootable at all', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        const env = latchEnvelopeFor(t, DEPS, { tick: t.tick_count });
        expect(seamLatchFindings(env, { requireCalm: true }).filter((r) => !r.ok)).toEqual([]);
    });

    /**
     * ⛔ THE REFUSAL THAT KEEPS THE GENERATOR HONEST AS THE SIGNATURE GROWS. A
     * fake latch that invented a value for a row nobody classified would author
     * a state the game cannot reach — the same defect as carrying a stale one.
     */
    it('⛔ a SEAM_SIGNATURE row with no fill rule REFUSES BY NAME', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        const grown = [...SEAM_SIGNATURE,
            { field: 'static.Game.somethingNew', group: 'static', comparable: 'equality' }];
        expect(() => latchEnvelopeFor(t, { ...DEPS, signature: grown }))
            .toThrow(/static\.Game\.somethingNew/);
        expect(() => latchEnvelopeFor(t, { ...DEPS, signature: grown }))
            .toThrow(/no rule for it/);
    });

    it('⛔ …and the real signature has one for every row it carries today', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        expect(() => latchEnvelopeFor(t, DEPS)).not.toThrow();
        // ⛓ the six the boot side never declares, named rather than counted.
        expect(Object.keys(CALM_ARRIVAL).sort()).toEqual([
            'arrival.blackCover', 'arrival.velocity', 'static.Game.freezeObjects',
            'static.Game.menu', 'static.Game.shake', 'static.Game.talking',
        ]);
    });

    it('⛔ a caller that does not hand it the REAL signature is refused', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        expect(() => latchEnvelopeFor(t, {})).toThrow(/SEAM_SIGNATURE/);
    });

    it('⛓ an OVERRIDE is the only way a boundary moves, and it moves exactly one field', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        const committed = committedBlocks(t);
        const env = latchEnvelopeFor(t, DEPS, { override: { 'rng.gameplay': 424242 } });
        const project = (e) => {
            const b = segmentBootFromLatch(e);
            return { ...b, persistence: mergePersistence(b.persistence, committed.persistence) };
        };
        const { rows } = bootFromEnvelopeOnly(env, committed, project);
        expect(rows.filter((r) => r.moved).map((r) => r.field)).toEqual(['rng.seed']);
    });

    it('⛓ the RECORD is shaped like the Windows driver\'s own', () => {
        const t = tapeOf(REHEARSAL_PLAN.sources['rh-b']);
        const rec = latchRecordFor(t, DEPS, { tick: 41 });
        expect(Object.keys(rec).sort()).toEqual(['deadFrames', 'end', 'envelope', 'hits',
            'observations', 'persistenceCleared']);
        expect(rec.envelope.seam['latch.tick']).toBe(41);
    });
});

describe('the tree refuses to be built where it would move committed artifacts', () => {
    const sourceTapes = new URL('.', TAPES).pathname.replace(/\/$/, '');
    const deps = { ...DEPS, parseTape, segmentBootFromLatch, bootFromEnvelopeOnly,
        mergePersistence };

    /**
     * ⛔⛔ THE REFUSAL THAT MATTERS MOST. A rehearsal WRITES tapes, RE-DERIVES
     * every tick-0 block and runs a fake `--record`. Pointed at the committed
     * roster it would move artifacts under a name that says "rehearsal", which
     * is the one thing ⚖ 40's tape licence exists to stop.
     */
    it('⛔ REFUSES a directory inside `fixtures/`', () => {
        expect(() => buildRehearsalTree({
            dir: join(sourceTapes, '..', 'rehearsal-tree'), repo: '.', sourceTapes, deps,
        })).toThrow(/inside the committed fixtures/);
    });

    it('⛔ REFUSES a directory that CONTAINS the source roster', () => {
        expect(() => buildRehearsalTree({
            dir: join(sourceTapes, '..', '..', '..', '..', '..'), repo: '.', sourceTapes, deps,
        })).toThrow(/REFUSING to build a rehearsal tree/);
    });

    it('⛔ `readRehearsalMarker` REFUSES an unmarked directory — so `--rehearse-tree` can '
        + 'never be pointed at the committed roster', () => {
        expect(() => readRehearsalMarker(sourceTapes)).toThrow(/carries no rehearsal\.json/);
    });
});

describe('the plan is chosen so that FILE ORDER is the wrong answer', () => {
    /**
     * ⛔⛔ §35.4 item 4 is only rehearsable if the sorted order and the chain
     * order DISAGREE. `solve-rh-chain.mjs` sorts before `solve-rh-first.mjs`,
     * and `-first` owns segment 0 — so a `producerOrder` that fell back to
     * `[...running].sort()` would run the chain producer against a predecessor
     * that no longer exists, which is the defect verbatim.
     */
    it('⛓ the chain producer sorts FIRST and must run SECOND', () => {
        const files = Object.keys(REHEARSAL_PLAN.owners).filter((f) => f !== 'solve-rh-solo.mjs');
        expect([...files].sort()[0]).toBe('solve-rh-chain.mjs');
        expect(REHEARSAL_PLAN.owners['solve-rh-first.mjs']).toEqual(['rh-a']);
        expect(REHEARSAL_PLAN.chains[0].segments[0]).toBe('rh-a');
    });

    /**
     * ⛔ THE COUNT IS DERIVED, NOT PINNED. `lint-gate-labels` names a
     * `toHaveLength(<literal>)` over a declared roster for exactly this reason:
     * the claim is not "one segment", it is "a chain with NO BOUNDARY" — the
     * shape `subjects()` filters out and the walk accounting must still see.
     * A pinned length would go stale the day the plan grows a segment and
     * would say nothing about why the row exists.
     */
    it('⛓ the plan carries a HEADLINE, and a chain with NO BOUNDARY — the floors §33.4 '
        + 'named', () => {
        expect(REHEARSAL_PLAN.chains[0].headline).toBe('rh-main-full');
        const boundaries = REHEARSAL_PLAN.chains.map((c) => c.segments.length - 1);
        expect(Math.min(...boundaries)).toBe(0);
        expect(Math.max(...boundaries)).toBeGreaterThan(0);
    });

    it('⛓ every source tape is on the committed roster, and none is named twice', () => {
        const sources = Object.values(REHEARSAL_PLAN.sources);
        expect(new Set(sources).size).toBe(sources.length);
        for (const s of sources) expect(() => tapeOf(s)).not.toThrow();
    });
});
