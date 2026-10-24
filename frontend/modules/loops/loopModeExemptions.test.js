/**
 * loopModeExemptions.test.js — the PLANNING-source matrix.
 *
 * ⛓ WHAT THESE ROWS PROVE. `isLoopModePlanningSource` answers yes for every
 * `source` tag an AUTHORING publisher stamps on a `user:regionMove`, and no for
 * performed play. Two consumers read it (loopState.evaluateActionGate, gameState
 * handleRegionMove), and both treat a false as "this was play": the strict
 * loop-mode gate swallows the move and the path append is dropped.
 *
 * ⛔ WHAT THEY REFUSE TO PROVE. Nothing about either consumer's behaviour —
 * this is the classifier alone. The consumer-side claim (a menu-panel exit press
 * survives loop mode) is the in-app row `loops-real-actions-processed`.
 *
 * The tags are taken from the publishers' own constants where the publisher
 * exports them, so a rename that moves the tag reds here rather than silently
 * declassifying a publisher.
 */

import { describe, it, expect } from 'vitest';
import { isLoopModePlanningSource } from './loopModeExemptions.js';
import {
    MOVE_SOURCE_EXIT,
    MOVE_SOURCE_START,
    MOVE_SOURCE_RESTART,
} from '../menuPanel/menuPanelEngine.js';

describe('⛓ isLoopModePlanningSource — authoring sources', () => {
    it('classifies the region graph\'s four click shapes', () => {
        for (const source of [
            'regionGraph-addToPath',
            'regionGraph-overwritePath',
            'regionGraph-oneStep',
            'regionGraph-directMove',
        ]) {
            expect(isLoopModePlanningSource(source)).toBe(true);
        }
    });

    it('classifies procgenPlayer\'s synthesized start hop', () => {
        expect(isLoopModePlanningSource('procgenPlayer-start')).toBe(true);
    });

    it('classifies all three menu-panel moves, by the module\'s own constants', () => {
        expect(isLoopModePlanningSource(MOVE_SOURCE_EXIT)).toBe(true);
        expect(isLoopModePlanningSource(MOVE_SOURCE_START)).toBe(true);
        expect(isLoopModePlanningSource(MOVE_SOURCE_RESTART)).toBe(true);
    });
});

describe('⛓ isLoopModePlanningSource — everything else is performed play', () => {
    it('rejects the substrate and panel publishers', () => {
        for (const source of [
            'regionsModule:exitClicked',
            'seedlingRegionGlue',
            'flashSubstrate',
            'jtaSubstrateWrapper',
            'omsiSubstrateWrapper',
            'bounceDemo',
            'mazeRoom',
        ]) {
            expect(isLoopModePlanningSource(source)).toBe(false);
        }
    });

    it('rejects non-strings and the empty tag', () => {
        for (const source of [undefined, null, 0, 1, {}, [], '']) {
            expect(isLoopModePlanningSource(source)).toBe(false);
        }
    });

    it('matches on a PREFIX, so a lookalike that merely CONTAINS a tag is play', () => {
        expect(isLoopModePlanningSource('substrate-menuPanel')).toBe(false);
        expect(isLoopModePlanningSource('replay-regionGraph')).toBe(false);
    });
});
