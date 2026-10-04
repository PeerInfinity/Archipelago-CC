/**
 * Coverage: every key the storage census found the app (and the games it wraps)
 * writing resolves to a declaration — so a fresh profile's Storage panel has an
 * EMPTY Unknown section — and the census's known orphans stay Unknown.
 */
import { describe, expect, it } from 'vitest';
import { normalizeDeclarations, ownerOf, buildView } from './storageModel.js';
import { readSourceDeclarations } from './sourceDeclarations.js';

/** The census (§37.2), one concrete key per row — a family appears as one member. */
export const CENSUS_KEYS = [
    'archipelagoToolSuite_modeData_default', 'archipelagoToolSuite_modeData_test-regression',
    'archipelagoToolSuite_lastActiveMode',
    'procgenPipeline_params', 'procgenPipeline_view', 'procgenPipeline_workingLibrary', 'procgenPipeline_presets',
    'presetUI_toolbar', 'presetUI_view', 'mazeRoom_params', 'mazeRoom_view', 'apcalcGenerator_params',
    'playbackBot_intercept', 'playbackBot_mazeCollect',
    'archipelago_loop_state', 'loops:savedQueues:v1', 'hideDoubleMovementWarning', 'hideDoubleDestinationWarning',
    'archipelago_loop_settings',
    'jta-aq-settings', 'jta-action-loadouts', 'jta-aq-collapsed',
    'jtaBalance_patches_v1_1', 'jtaBalance_patches_v1_1__ds_synthetic-sunken-meridian-s1-z3-5febd71f',
    'vcs-config', 'bounceDjReal.player', 'externalModule.customUrlWarning.suppressed',
    'clientSettings', 'clientId', '__storage_test__', 'frontendProfiling',
    'a-mazing-idle', 'a-mazing-idle-disable-biome-check',
    'incrementalGameSave', 'incrementalGameSave_substrate', 'incrementalGameSave_substrate__synthetic-x',
    'idleLoops1', 'idleLoopsChallenge', 'idleLoops_substrate', 'prestigeBackup',
    'updateRate', 'latestTheme', 'loadingText', 'loadPredictor', 'disabledMenus', 'actionListHeight',
    'localhost/frontend/modules/flashPanel/seedling.swf/shrumsave',
];

/**
 * Keys that are Unknown ON PURPOSE: the orphans in the user's profile (§37.9),
 * the retired client cache (§37.7.1), and the games no module wraps (Cavernous is
 * served as a standalone page only; golden-layout's popout key is never reached).
 */
export const EXPECTED_UNKNOWN = [
    '__pathAnalysisResults__', '__pathAnalysis_Kings Grave__', '__playwrightTestResults__', '__spoilerTestResults__',
    'dataPackage', 'dataPackageVersion', 'saveGameII', 'saveGameIIBackup', 'gl-window-config-abc',
];

describe('storage census coverage', () => {
    const { declarations, errors } = normalizeDeclarations(readSourceDeclarations());

    it('the declarations normalize without errors', () => {
        expect(errors).toEqual([]);
    });

    it('every census key has an owner (0 unknown)', () => {
        expect(CENSUS_KEYS.filter((k) => !ownerOf(k, declarations))).toEqual([]);
    });

    it('the known orphans stay Unknown (a declaration never hides them)', () => {
        expect(EXPECTED_UNKNOWN.filter((k) => ownerOf(k, declarations))).toEqual([]);
    });

    it('a view of the census puts nothing under Unknown, and Unknown is the first section', () => {
        const view = buildView(CENSUS_KEYS.map((key) => ({ key, chars: key.length })), declarations, 5242880);
        expect(view.sections[0].id).toBe('unknown');
        expect(view.sections[0].count).toBe(0);
    });
});
