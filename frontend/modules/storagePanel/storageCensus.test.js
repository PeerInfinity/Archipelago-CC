/**
 * Coverage: every key the storage census found the app (and the games it wraps)
 * writing resolves to a declaration — so a fresh profile's Storage panel has an
 * EMPTY Unknown section — and the census's known orphans stay Unknown.
 */
import { describe, expect, it } from 'vitest';
import { idbDeclarations, normalizeDeclarations, ownerOf, buildView } from './storageModel.js';
import { idbCensus, idbOpensInText, readSourceDeclarations, readSourceIdbOpens } from './sourceDeclarations.js';

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
    'incrementalGameSave', 'incrementalGameSave_substrate', 'incrementalGameSave_substrate__synthetic-x',
    'idleLoops1', 'idleLoopsChallenge', 'idleLoops_substrate', 'prestigeBackup',
    'updateRate', 'latestTheme', 'loadingText', 'loadPredictor', 'disabledMenus', 'actionListHeight',
    'localhost/frontend/modules/flashPanel/seedling.swf/shrumsave',
    'seedlingJsSave_0123456789abcdef',
    'seedlingRuffleSaveAside_localhost/frontend/modules/flashPanel/swf/seedling_injected.swf/shrumsave',
];

/**
 * Keys that are Unknown ON PURPOSE: the orphans in the user's profile (§37.9),
 * the retired client cache (§37.7.1), and the games no module wraps (Cavernous is
 * served as a standalone page only; golden-layout's popout key is never reached;
 * A-Mazing-Idle's saves outlive its removal, 2026-10-11).
 */
export const EXPECTED_UNKNOWN = [
    '__pathAnalysisResults__', '__pathAnalysis_Kings Grave__', '__playwrightTestResults__', '__spoilerTestResults__',
    'dataPackage', 'dataPackageVersion', 'saveGameII', 'saveGameIIBackup', 'gl-window-config-abc',
    'a-mazing-idle', 'a-mazing-idle-disable-biome-check',
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

/**
 * IndexedDB databases opened OUTSIDE the app's module boot, which the Storage
 * panel does not list: name → reason. Each must still be opened in source
 * (a stale entry is RED) and must not also be declared.
 */
export const IDB_ALLOWED_UNDECLARED = {
    // B1 D7: the standalone bounce demo page (modules/bounceDemo/djReal/index.html, never mounted by the app)
    // caches the original SWF it fetched in its own database; it refetches it when the database is gone.
    bounceDjReal: 'standalone page bounceDemo/djReal/index.html: its cached copy of the fetched SWF (refetched when absent)',
};

describe('storage census — IndexedDB, both ways', () => {
    const { declarations } = normalizeDeclarations(readSourceDeclarations());
    const declared = idbDeclarations(declarations).map((d) => d.value);
    const opened = readSourceIdbOpens();

    it('the census reads the tree: it finds the document library and the bounce demo page opening their databases', () => {
        expect(opened.map((o) => `${o.path} → ${o.name}`).sort()).toEqual([
            'modules/bounceDemo/djReal/index.html → bounceDjReal',
            'modules/procgenCore/documentLibraryIdb.js → archipelago-cc-document-library',
        ]);
    });

    it('every database the sources open is declared or allow-listed, every declared one is opened, nothing unresolved', () => {
        expect(idbCensus({ opened, declared, allowed: IDB_ALLOWED_UNDECLARED }))
            .toEqual({ unresolved: [], undeclared: [], unopened: [], staleAllowed: [] });
    });

    it('the library database is declared exactly once, by procgenLabPanel, as user data', () => {
        expect(idbDeclarations(declarations).map((d) => [d.moduleId, d.value, d.kind]))
            .toEqual([['procgenLabPanel', 'archipelago-cc-document-library', 'user']]);
    });

    it('RED both ways on synthetic inputs: an undeclared open, a declared name nobody opens, a stale allow-list entry', () => {
        const o = (name, path = 'x.js') => ({ path, arg: `'${name}'`, name });
        expect(idbCensus({ opened: [o('a'), o('b')], declared: ['a'] }).undeclared).toEqual(['b']);
        expect(idbCensus({ opened: [o('a')], declared: ['a', 'gone'] }).unopened).toEqual(['gone']);
        expect(idbCensus({ opened: [o('a')], declared: ['a'], allowed: { old: 'r', a: 'r' } }).staleAllowed).toEqual(['a', 'old']);
        expect(idbCensus({ opened: [{ path: 'y.js', arg: 'makeName()', name: null }], declared: [] }).unresolved)
            .toEqual(['y.js: open(makeName())']);
    });

    it('the scanner resolves a literal, a same-file binding, a default parameter bound to an exported constant; else unresolved', () => {
        const exported = (n) => (n === 'LIB' ? 'lib-db' : null);
        expect(idbOpensInText("indexedDB.open('lit-db', 1)").map((r) => r.name)).toEqual(['lit-db']);
        expect(idbOpensInText("const N = 'bound-db';\nindexedDB.open(N, 1)").map((r) => r.name)).toEqual(['bound-db']);
        expect(idbOpensInText('function f({ dbName = LIB } = {}) { factory.open(dbName, 1); }', exported).map((r) => r.name)).toEqual(['lib-db']);
        expect(idbOpensInText('indexedDB.open(nameFrom(x), 1)').map((r) => r.name)).toEqual([null]);
        expect(idbOpensInText('function f({ dbName = OTHER } = {}) { factory.open(dbName); }', exported).map((r) => r.name)).toEqual([null]);
    });
});
