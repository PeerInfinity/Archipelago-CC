/**
 * seedlingDemo/watchSummary + watchBridge's projection — **`window.__watch`,
 * and the rename layer between it and the protocol.**
 *
 * CONSTRUCTIVE-MODE arc, slice 4. ⛔ These rows test a PROJECTION, not the
 * page: the input is a readout of the shape `watchViewer` writes, hand-built
 * here, and the question is only whether the fields arrive under the
 * protocol's names with their meanings intact.
 *
 * ⛓ The two that matter are the ones a coercion would quietly break: `null`
 * for an arm with no ladder (a `0` there would be a page claiming seed 0), and
 * `certified: null` surviving as `null` (trap 262).
 */

import { describe, expect, it } from 'vitest';

import { noLevelIdentity, watchSummary } from './watchSummary.js';
import { watchBridgeSummary } from './watchBridge.js';
import { assertStateChanged } from '../procgenCore/labProtocol.js';

const HREF = 'http://localhost:8000/frontend/modules/seedlingDemo/watch.html?source=generate';

/** The shape `show()` writes — only the fields the projection reads. */
const GENERATE_OK = Object.freeze({
    status: 'ok',
    seed: 3,
    biome: 'pre-sword',
    step: 2,
    identity: 'seed 3 · pre-sword · step 2 · CERTIFIED',
    certified: true,
    directives: [{ instance: 'wall-segment#1', outcome: 'KEPT' }],
    payloadCheck: null,
});

const PAYLOAD = Object.freeze({ seed: 3, biome: 'pre-sword', level: { name: 'x' } });

describe('watchSummary — the generate arm', () => {
    it('carries the readout\'s fields under the protocol\'s names', () => {
        const w = watchSummary({
            source: 'generate', href: HREF, generate: GENERATE_OK, generated: PAYLOAD,
        });
        expect(w.source).toBe('generate');
        expect(w.url).toBe(HREF);
        expect(w.seed).toBe(3);
        expect(w.biome).toBe('pre-sword');
        expect(w.step).toBe(2);
        expect(w.identity).toBe(GENERATE_OK.identity);
        expect(w.certified).toBe(true);
        expect(w.directives).toEqual(GENERATE_OK.directives);
        expect(w.payload).toEqual(PAYLOAD);
        expect(w.status).toBe('ok');
    });

    it('⛓ carries the page\'s OWN identity string, never one it built', () => {
        const w = watchSummary({
            source: 'generate', href: HREF,
            generate: { ...GENERATE_OK, identity: 'a sentence only describeState could write' },
        });
        expect(w.identity).toBe('a sentence only describeState could write');
    });

    it('⛓ certified: null SURVIVES as null — nobody has asked ≠ the oracle said no', () => {
        const w = watchSummary({
            source: 'generate', href: HREF, generate: { ...GENERATE_OK, certified: null },
        });
        expect(w.certified).toBe(null);
        const w2 = watchSummary({
            source: 'generate', href: HREF, generate: { ...GENERATE_OK, certified: false },
        });
        expect(w2.certified).toBe(false);
    });

    it('⚠ edits is ALWAYS 0 — Seedling free editing is slice 11', () => {
        expect(watchSummary({ source: 'generate', href: HREF, generate: GENERATE_OK }).edits)
            .toBe(0);
    });

    it('an absent payload is null, not undefined', () => {
        const w = watchSummary({ source: 'generate', href: HREF, generate: GENERATE_OK });
        expect(w.payload).toBe(null);
    });
});

describe('watchSummary — the arms with no ladder', () => {
    for (const source of ['solve', 'manual', 'replay']) {
        it(`${source}: seed and step are NULL and the identity names the arm`, () => {
            const w = watchSummary({ source, href: HREF, generate: null, generated: null });
            expect(w.seed).toBe(null);
            expect(w.step).toBe(null);
            expect(w.biome).toBe(null);
            expect(w.certified).toBe(null);
            expect(w.identity).toBe(noLevelIdentity(source));
            expect(w.identity).toContain(source);
            expect(w.directives).toEqual([]);
            expect(w.payload).toBe(null);
            expect(w.status).toBe('none');
        });
    }

    it('⛔ a REFUSED generate is not a level either', () => {
        const w = watchSummary({
            source: 'generate', href: HREF,
            generate: { status: 'refused', message: 'the URL parameters were REFUSED' },
            // ⚠ A stale payload from the run before is deliberately supplied:
            // a projection that read it would hand the host a level the page
            // has stopped showing.
            generated: PAYLOAD,
        });
        expect(w.status).toBe('refused');
        expect(w.seed).toBe(null);
        expect(w.payload).toBe(null);
        expect(w.identity).toBe(noLevelIdentity('generate'));
    });
});

describe('watchBridge — the projection onto stateChanged', () => {
    it('⛓⛓ produces a payload the protocol\'s validator ACCEPTS', () => {
        const w = watchSummary({
            source: 'generate', href: HREF, generate: GENERATE_OK, generated: PAYLOAD,
        });
        const message = {
            substrate: 'seedling', iframeId: 'procgenLab-seedling-1', ...watchBridgeSummary(w),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
    });

    it('⛓⛓ …and so does the no-ladder arm\'s, with its nulls intact', () => {
        const w = watchSummary({ source: 'replay', href: HREF });
        const message = {
            substrate: 'seedling', iframeId: 'procgenLab-seedling-1', ...watchBridgeSummary(w),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
        expect(message.seed).toBe(null);
        expect(message.certified).toBe(null);
    });

    it('⛔ drops `biome`, `payload`, `payloadCheck` and `status` — the SMALL event', () => {
        const w = watchSummary({
            source: 'generate', href: HREF, generate: GENERATE_OK, generated: PAYLOAD,
        });
        expect(Object.keys(watchBridgeSummary(w)).sort()).toEqual([
            'certified', 'directives', 'edits', 'identity', 'seed', 'source', 'step', 'url',
        ]);
    });

    it('answers null before the first mount rather than inventing a state', () => {
        expect(watchBridgeSummary(null)).toBe(null);
        expect(watchBridgeSummary(undefined)).toBe(null);
    });
});

/**
 * ── ⛓⛓ THE SHIP'S CHANNEL IS CARRIED **WHOLE**, AND THAT IS A ROW NOW ────
 *
 * ⛔ The browser rows read `__watch.wasm`, not the DOM — so every field a ship
 * publishes has to survive the projection UNCHANGED. The per-tick slice added
 * `verdict.perTick` and `drain` to what a ship writes, and a projection that
 * whitelisted fields would have dropped them silently: the rows would then be
 * asserting `undefined === 'agrees'` and reading it as a page that never got
 * there. `watchSummary` adds no truth of its own, and this is the gate on it.
 */
describe('the ▶ load-in-wasm ship, projected', () => {
    const SHIP = Object.freeze({
        stage: 'verdict',
        stages: ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain', 'verdict'],
        reached: ['probe', 'runtime', 'start', 'tape', 'running', 'finished', 'drain', 'verdict'],
        refusal: null,
        drain: { observations: 256, reportedTransitions: 0 },
        verdict: {
            kind: 'agrees',
            agrees: true,
            text: 'agrees',
            deltas: { dx: 0, dy: 0, level: 5, expectedLevel: 5, missing: [] },
            perTick: {
                kind: 'agrees', agrees: true, observations: 256, transitions: 1, diff: null,
                text: 'agrees per tick (256 observations)',
            },
            drain: { observations: 256, reportedTransitions: 0 },
        },
        label: 'r8-solve-4 — the solve\'s own tape',
        set: null,
        status: { finished: true, tick: 255 },
        scope: 'end state only — …',
    });

    it('⛓ carries the ship block field for field, including the PER-TICK verdict', () => {
        const w = watchSummary({ source: 'solve', href: HREF, wasm: SHIP });
        expect(w.wasm).toBe(SHIP);
        expect(w.wasm.verdict.perTick.kind).toBe('agrees');
        expect(w.wasm.verdict.perTick.observations).toBe(256);
        expect(w.wasm.drain.observations).toBe(256);
        expect(w.wasm.reached).toContain('drain');
    });

    it('⛔ carries it under a REFUSED generate too — the stage it stopped at is the '
        + 'finding, so hiding the channel there would hide it where it matters', () => {
        const refused = { stage: 'levels', stages: SHIP.stages, reached: ['probe'], drain: null,
            refusal: { stage: 'levels', reason: 'set-readback-disagrees' },
            verdict: { kind: 'not-finished', perTick: { kind: 'not-finished' } } };
        const w = watchSummary({
            source: 'generate', href: HREF,
            generate: { status: 'refused', message: 'nope' }, wasm: refused,
        });
        expect(w.wasm).toBe(refused);
        expect(w.wasm.verdict.perTick.kind).toBe('not-finished');
    });

    it('⚠ `null` means NO SHIP ON THIS PAGE — never "the ship disagreed" (trap 262)', () => {
        expect(watchSummary({ source: 'solve', href: HREF }).wasm).toBe(null);
    });
});

