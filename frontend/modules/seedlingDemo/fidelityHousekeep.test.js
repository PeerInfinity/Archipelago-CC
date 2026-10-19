/**
 * seedling-fidelity-housekeep D1 — A SOLVER CAN'T-DO THAT ARRIVES AS A PLAIN THROW LEAVES `solveSegment` AS A
 * `SolverRefusal`, BY NAME (`solverBot.REFUSAL_BY_NAME`).
 *
 * The three measured sites (model only, the committed atlas):
 *   - `levelRun`'s press on a FROZEN tick (`code: 'FROZEN_TICK_PRESS'`): sweep leg 631, L74 booted on the L73 door's
 *     button — the arrival drops `fallrock@288,144` and the walk's sword press lands in the freeze;
 *   - `botDriverV2.findExit`'s teleporter on a PIT tile: survey step 113, L43's door to L37 at (144,64);
 *   - `botDriverV2.runHold`'s presser no responder answers: ROCKMOVE's leg 311 with L29's fallrock removed and its
 *     button kept.
 * Each one: the class (`SolverRefusal`), the obstacle kind, the original on `cause` (class and code), the words kept,
 * and the RK class `progressKind` gives it — on the refusal AND on the cause (a progress frame the throw unwinds
 * through reads the cause), never `error` or `other`. A NESTED `solveSegment` does not convert (only the outermost
 * does: a frozen-tick press throws mid-`advance`, so no rung may catch it as a refusal and go on).
 */
import { describe, expect, it } from 'vitest';
import { loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { REFUSAL_BY_NAME, SolverRefusal, solveSegment } from './solverBot.js';
import { BotDriverV2Error } from './botDriverV2.js';
import { progressKind } from './solveProgress.js';

const ATLAS = patchedMapDocument(loadAtlas());
const withoutEntity = (doc, level, type, x, y) => ({ ...doc,
    levels: doc.levels.map((r) => (r.level !== level ? r
        : { ...r, entities: r.entities.filter((e) => !(e.type === type && e.x === x && e.y === y)) })) });

const solve = (doc, level, boot, goal, extra = {}) => {
    const run = createRunForStaging(arrivalStaging({ level, ...boot }, { items: ['hasSword'] }), levelSourceFromAtlas(doc));
    return solveSegment({ run, goals: [goal], name: `housekeep-L${level}`, boot: { level, ...boot }, ...extra });
};
const thrown = (f) => { try { f(); } catch (e) { return e; } throw new Error('expected a throw'); };

const FROZEN = () => solve(ATLAS, 74, { x: 288, y: 128 }, { kind: 'reach-exit', exit: { x: 288, y: 144 } });
const PIT = () => solve(ATLAS, 43, { x: 176, y: 448 }, { kind: 'reach-exit', exit: { x: 144, y: 64 } });
const ORPHAN = () => solve(withoutEntity(ATLAS, 29, 'fallrock', 112, 112), 29, { x: 16, y: 224 },
    { kind: 'reach-exit', exit: { x: 112, y: 32 } });

describe('housekeep D1: a named throw leaves solveSegment as a SolverRefusal', () => {
    it('declares the three kinds and the one code', () => {
        expect(REFUSAL_BY_NAME.kinds).toEqual(['unmodelled-frozen-press', 'unmodelled-pit-teleporter', 'orphan-presser']);
        expect(REFUSAL_BY_NAME.codes).toEqual({ FROZEN_TICK_PRESS: 'unmodelled-frozen-press' });
    });

    it('sweep leg 631 (L74 on the L73 door\'s button): the frozen-tick press', () => {
        const e = thrown(FROZEN);
        expect(e.name).toBe('SolverRefusal');
        expect(e instanceof SolverRefusal).toBe(true);
        expect(e.obstacle).toEqual({ kind: 'unmodelled-frozen-press', code: 'FROZEN_TICK_PRESS' });
        expect(e.cause.name).toBe('Error');
        expect(e.cause.code).toBe('FROZEN_TICK_PRESS');
        expect(e.byName).toEqual({ name: 'Error', code: 'FROZEN_TICK_PRESS' });
        expect(e.message).toMatch(/^levelRun: a sword press at tick 0 would fire its rect on a FROZEN tick \(a button-dropped fallrock\)/);
        expect(e.message).toBe(e.cause.message);
        expect(progressKind(e)).toBe('unmodelled');
        expect(progressKind(e.cause)).toBe('unmodelled');
    });

    it('survey step 113 (L43\'s door to L37): the teleporter on a pit tile', () => {
        const e = thrown(PIT);
        expect(e.name).toBe('SolverRefusal');
        expect(e instanceof SolverRefusal).toBe(true);
        expect(e.obstacle).toEqual({ kind: 'unmodelled-pit-teleporter', id: 'teleporter@144,64', tile: [9, 4] });
        expect(e.cause instanceof BotDriverV2Error).toBe(true);
        expect(e.message).toMatch(/^the teleporter at \(144,64\) in level 43 stands ON a PIT tile \(9,4\)/);
        expect(progressKind(e)).toBe('unmodelled');
        expect(progressKind(e.cause)).toBe('unmodelled');
    });

    it('ROCKMOVE leg 311 (L29, the rock removed, its button kept): the orphan presser', () => {
        const e = thrown(ORPHAN);
        expect(e.name).toBe('SolverRefusal');
        expect(e instanceof SolverRefusal).toBe(true);
        expect(e.obstacle).toEqual({ kind: 'orphan-presser', id: 'button@112,128' });
        expect(e.cause instanceof BotDriverV2Error).toBe(true);
        expect(e.message).toMatch(/hold: button@112,128 presses group t=0, which NO responder in level 29 answers/);
        expect(e.message).toMatch(/the hold resolves to NOTHING in this level \(housekeep D1\)\.$/);
        expect(progressKind(e)).toBe('does-not-apply');
        expect(progressKind(e.cause)).toBe('does-not-apply');
    });

    it('under the progress hook: the segment ends refused, its last why the refusal, no node tallies error', () => {
        let peek = null;
        const e = thrown(() => solve(ATLAS, 74, { x: 288, y: 128 }, { kind: 'reach-exit', exit: { x: 288, y: 144 } },
            { onProgress: (site, p) => { peek = p; } }));
        expect(e.name).toBe('SolverRefusal');
        expect(e instanceof SolverRefusal).toBe(true);
        const snap = typeof peek === 'function' ? peek() : peek;
        expect(snap.segment.outcome).toBe('refused');
        expect(snap.lastWhy.kind).toBe('unmodelled');
        expect(snap.lastWhy.name).toBe('SolverRefusal');
        const kinds = {};
        const walk = (n) => {
            for (const [k, c] of Object.entries(n.rejectionKinds ?? {})) kinds[k] = (kinds[k] ?? 0) + c;
            for (const ch of n.children ?? []) walk(ch);
        };
        walk(snap.tree);
        expect(kinds.error ?? 0).toBe(0);
        expect(kinds.other ?? 0).toBe(0);
        expect(kinds.unmodelled ?? 0).toBeGreaterThan(0);
    });

    it('a NESTED solveSegment does not convert: only the outermost one does', () => {
        let inner = null;
        const e = thrown(() => solve(ATLAS, 74, { x: 288, y: 128 }, { kind: 'reach-exit', exit: { x: 288, y: 144 } },
            // `walk` is emitted inside the outer segment's loop (`segment` is emitted before it is entered)
            { onProgress: (site) => { if (site === 'walk' && inner === null) inner = thrown(PIT); } }));
        expect(inner?.name).toBe('BotDriverV2Error');
        expect(inner.obstacle?.kind).toBe('unmodelled-pit-teleporter');
        expect(e.name).toBe('SolverRefusal');
    });
});
