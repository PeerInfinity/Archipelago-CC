/**
 * procgenCore/substratePredicates — the app's capability predicates, over
 * HAND-BUILT entries (one per kind, plus the absent / `null` edges).
 *
 * ⛓ The agreement with the app's callers (loopState's region methods, the
 * hub, the pipeline) is pinned by THEIR suites, which run unchanged against the
 * lifted functions; this file pins each rule on its own.
 */
import { describe, expect, it } from 'vitest';

import {
    CAPTURE_SHAPES, REALISER_KINDS, SOLVER_KINDS,
    botHonorsInstant, captureShapeOf, offersPlayback, regionRealiserKind, solverKindOf,
} from './substratePredicates.js';
import * as viaHub from '../apworldEditor/regionRegenerate.js';

const fn = () => null;

describe('regionRealiserKind', () => {
    it('procedural wins over a zone generator; either zone slot is a zone', () => {
        expect(regionRealiserKind({ generateRegionCore: fn, generateZoneForSpecs: fn })).toBe(REALISER_KINDS.PROCEDURAL);
        expect(regionRealiserKind({ generateZoneForSpecs: fn })).toBe(REALISER_KINDS.ZONE);
        expect(regionRealiserKind({ generateZoneForSpecsGen: fn })).toBe(REALISER_KINDS.ZONE);
    });
    it('null for no entry, no slot, or a slot that is not a function', () => {
        expect(regionRealiserKind(undefined)).toBeNull();
        expect(regionRealiserKind(null)).toBeNull();
        expect(regionRealiserKind({})).toBeNull();
        expect(regionRealiserKind({ generateRegionCore: null, generateZoneForSpecs: true })).toBeNull();
    });
    it('the hub re-exports the SAME function and constant, not a copy', () => {
        expect(viaHub.regionRealiserKind).toBe(regionRealiserKind);
        expect(viaHub.REALISER_KINDS).toBe(REALISER_KINDS);
    });
});

describe('captureShapeOf', () => {
    it('fine = a takeLastRecording function, and it wins over summary', () => {
        expect(captureShapeOf({ takeLastRecording: fn })).toBe(CAPTURE_SHAPES.FINE);
        expect(captureShapeOf({ takeLastRecording: fn, loopSupport: { summaryRecording: true } }))
            .toBe(CAPTURE_SHAPES.FINE);
    });
    it('summary = loopSupport.summaryRecording truthy', () => {
        expect(captureShapeOf({ loopSupport: { summaryRecording: true } })).toBe(CAPTURE_SHAPES.SUMMARY);
    });
    it('coarse for everything else, including no entry and a non-function recorder', () => {
        expect(captureShapeOf(undefined)).toBe(CAPTURE_SHAPES.COARSE);
        expect(captureShapeOf(null)).toBe(CAPTURE_SHAPES.COARSE);
        expect(captureShapeOf({ loopSupport: { manual: true } })).toBe(CAPTURE_SHAPES.COARSE);
        expect(captureShapeOf({ takeLastRecording: null, loopSupport: null })).toBe(CAPTURE_SHAPES.COARSE);
    });
});

describe('solverKindOf', () => {
    it("walkTo = executeVia 'solver', and it wins over delegation", () => {
        expect(solverKindOf({ loopSupport: { executeVia: 'solver' } })).toBe(SOLVER_KINDS.WALK_TO);
        expect(solverKindOf({
            loopSupport: { executeVia: 'solver' }, sharing: { mana: { loopActionDelegation: true } },
        })).toBe(SOLVER_KINDS.WALK_TO);
    });
    it('delegation = sharing.mana.loopActionDelegation === true (the ENTRY half only)', () => {
        expect(solverKindOf({ sharing: { mana: { loopActionDelegation: true } } })).toBe(SOLVER_KINDS.DELEGATION);
        expect(solverKindOf({ sharing: { mana: { loopActionDelegation: 'yes' } } })).toBeNull();
    });
    it('null for no entry, a null sharing, or another executeVia', () => {
        expect(solverKindOf(undefined)).toBeNull();
        expect(solverKindOf({ sharing: null, loopSupport: null })).toBeNull();
        expect(solverKindOf({ loopSupport: { executeVia: 'playbackBot' } })).toBeNull();
    });
});

describe('offersPlayback', () => {
    it('any real loopSupport declaration: manual, a queue action, or an executeVia', () => {
        expect(offersPlayback({ loopSupport: { manual: true, queueActions: [] } })).toBe(true);
        expect(offersPlayback({ loopSupport: { manual: false, queueActions: ['regionMove'] } })).toBe(true);
        expect(offersPlayback({ loopSupport: { manual: false, queueActions: [], executeVia: 'solver' } })).toBe(true);
    });
    it('false for an empty declaration, a null one, or no entry', () => {
        expect(offersPlayback({ loopSupport: { manual: false, queueActions: [] } })).toBe(false);
        expect(offersPlayback({ loopSupport: null })).toBe(false);
        expect(offersPlayback({})).toBe(false);
        expect(offersPlayback(null)).toBe(false);
    });
});

describe('botHonorsInstant', () => {
    const fineSolver = { loopSupport: { instant: true, executeVia: 'solver' }, takeLastRecording: fn };
    it('instant ∧ walkTo ∧ fine', () => {
        expect(botHonorsInstant(fineSolver)).toBe(true);
    });
    it('each missing condition alone makes it false', () => {
        expect(botHonorsInstant({ ...fineSolver, loopSupport: { executeVia: 'solver' } })).toBe(false);
        expect(botHonorsInstant({ ...fineSolver, loopSupport: { instant: true } })).toBe(false);
        expect(botHonorsInstant({ loopSupport: { instant: true, executeVia: 'solver', summaryRecording: true } }))
            .toBe(false);
        expect(botHonorsInstant({
            loopSupport: { instant: true }, sharing: { mana: { loopActionDelegation: true } }, takeLastRecording: fn,
        })).toBe(false);
        expect(botHonorsInstant(null)).toBe(false);
    });
});
