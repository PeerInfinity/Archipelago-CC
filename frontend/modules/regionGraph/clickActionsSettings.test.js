/**
 * clickActionsSettings — the Region Graph's `moduleSettings.regionGraph.clickActions` (slice CA-S2):
 *   1. the ONE-TIME migration (js-21 edit 3): it writes once, a second load changes nothing, and a stored
 *      `clickActions` is never overwritten; the seven old keys are left in place;
 *   2. the six settings presets carry `clickActions` = the migration of the old keys they named at base (CA-S3 removed
 *      those keys from the presets, keeping `addLocationsToPath`; the pin: no `frontend/settings/*.json` names one);
 *   3. the Region Map's FIRST-RUN COPY (CA-S3, ⚖ R4) over each preset and the default = the migration of the click
 *      config its interim reader (`regionMapClicks.readClickOptions`) measured at base: the copy is exact.
 * The settings manager is a fake with getSetting's precedence (override > stored > schema default > call-site).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const S = await import('./clickActionsSettings.js');
const CA = await import('../regionView/clickActions.js');
const { loadRegionMapClickActions, REGION_MAP_CLICK_ACTIONS_KEY } = await import('../regionMap/regionMapClickActions.js');

const PRESETS = ['depgraph', 'vibecoding', 'apcalc', 'check-all-from-graph', 'metamath', 'textadventure'];
const presetFile = (name) => new URL(`../../settings/settings-${name}.json`, import.meta.url);
const readPreset = (name) => JSON.parse(fs.readFileSync(name === 'default'
    ? new URL('../../settings/settings.json', import.meta.url) : presetFile(name), 'utf8'));

/** The Region Graph's schema defaults as registered (`index.js`): `clickActions` and the one old key it keeps. */
const SCHEMA = { [S.CLICK_ACTIONS_KEY]: S.clickActionsSchemaEntry().default, 'moduleSettings.regionGraph.addLocationsToPath': false };

/** A settings manager over `tree` (stored values), recording every write. */
function fakeSettings(tree = {}) {
    const writes = [];
    const lookup = (key) => {
        let cur = tree;
        for (const k of key.split('.')) {
            if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
            else return { found: false };
        }
        return { found: true, value: cur };
    };
    return {
        writes, tree,
        async hasStoredSetting(key) { return lookup(key).found; },
        async getSetting(key, dflt) {
            const l = lookup(key);
            if (l.found) return l.value;
            if (key in SCHEMA) return structuredClone(SCHEMA[key]);
            return dflt;
        },
        async updateSetting(key, value) {
            writes.push([key, value]);
            const ks = key.split('.');
            let cur = tree;
            for (const k of ks.slice(0, -1)) cur = (cur[k] ??= {});
            cur[ks.at(-1)] = value;
            return true;
        },
    };
}

describe('⛓ the one-time migration (js-21 edit 3)', () => {
    it('no stored clickActions: migrates the old keys ONCE, writes it, and leaves the old keys in place', async () => {
        const old = { addToPath: false, overwritePath: true, movePlayerDirectly: false, showRegionInPanel: false,
            checkAllLocationsInRegion: true, addLocationsToPath: true, movePlayerOneStep: true };
        const sm = fakeSettings({ moduleSettings: { regionGraph: { ...old } } });
        const first = await S.loadRegionGraphClickActions(sm);
        expect(first.migrated).toBe(true);
        expect(first.clickActions).toEqual({ enabled: true,
            region: { 'path.route': { from: 'start' }, 'path.checkAll': true, 'regions.open': false },
            location: { 'path.check': 'addToPath' } });
        expect(sm.writes).toEqual([[S.CLICK_ACTIONS_KEY, first.clickActions]]);
        for (const [k, v] of Object.entries(old)) expect(sm.tree.moduleSettings.regionGraph[k]).toBe(v);

        // Idempotent: the second load reads it and writes nothing.
        const second = await S.loadRegionGraphClickActions(sm);
        expect(second).toEqual({ clickActions: first.clickActions, migrated: false });
        expect(sm.writes).toHaveLength(1);
    });

    it('a stored clickActions is NEVER overwritten by the migration, whatever the old keys say', async () => {
        const stored = { enabled: false, region: { 'path.route': { from: 'player' }, 'flash.teleport': true }, location: {} };
        const sm = fakeSettings({ moduleSettings: { regionGraph: { clickActions: stored, addToPath: true, movePlayerDirectly: false } } });
        for (let i = 0; i < 3; i++) {
            const r = await S.loadRegionGraphClickActions(sm);
            expect(r).toEqual({ clickActions: stored, migrated: false });
        }
        expect(sm.writes).toEqual([]);
    });

    it('a fresh user (nothing stored): the migration of the old defaults = defaultClickActions() = the schema default', async () => {
        const sm = fakeSettings({ moduleSettings: {} });
        const r = await S.loadRegionGraphClickActions(sm);
        expect(r.clickActions).toEqual(CA.defaultClickActions());
        expect(r.clickActions).toEqual(SCHEMA[S.CLICK_ACTIONS_KEY]);
        expect(sm.writes).toHaveLength(1);
    });

    it('a stored value that is not an object is not overwritten; the panel runs the defaults in memory', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { clickActions: 'garbage' } } });
        const r = await S.loadRegionGraphClickActions(sm);
        expect(r).toEqual({ clickActions: CA.defaultClickActions(), migrated: false });
        expect(sm.writes).toEqual([]);
    });

    it('⚖ movePlayerOneStep alone migrates to the path action OFF', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { movePlayerOneStep: true, movePlayerDirectly: false, addToPath: false } } });
        expect((await S.loadRegionGraphClickActions(sm)).clickActions.region['path.route']).toBe(false);
    });
});

describe('⛓ the addLocationsToPath MIRROR (⚖ planner 2026-11-19): a strip save only', () => {
    it('a strip save flips the old key both ways, and touches no other old key', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { addToPath: true, movePlayerDirectly: false } } });
        const on = CA.defaultClickActions();
        on.location['path.check'] = 'addToPath';
        await S.saveRegionGraphClickActions(sm, on);
        expect(sm.tree.moduleSettings.regionGraph.addLocationsToPath).toBe(true);
        const off = { ...on, location: { 'path.check': 'now' } };
        await S.saveRegionGraphClickActions(sm, off);
        expect(sm.tree.moduleSettings.regionGraph.addLocationsToPath).toBe(false);
        expect(sm.writes.map(([k]) => k)).toEqual([S.CLICK_ACTIONS_KEY, S.MIRRORED_LEGACY_KEY, S.CLICK_ACTIONS_KEY, S.MIRRORED_LEGACY_KEY]);
        // An unchanged mirror is not rewritten; the region keys are never written.
        await S.saveRegionGraphClickActions(sm, { ...off, enabled: false });
        expect(sm.writes.map(([k]) => k).slice(4)).toEqual([S.CLICK_ACTIONS_KEY]);
        expect(sm.tree.moduleSettings.regionGraph.addToPath).toBe(true);
        expect(sm.tree.moduleSettings.regionGraph.movePlayerDirectly).toBe(false);
    });

    it('a LOAD (the migration included) never writes the old key', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { addLocationsToPath: true } } });
        await S.loadRegionGraphClickActions(sm);
        await S.loadRegionGraphClickActions(sm);
        expect(sm.writes.map(([k]) => k)).toEqual([S.CLICK_ACTIONS_KEY]);
        expect(sm.tree.moduleSettings.regionGraph.addLocationsToPath).toBe(true);
    });
});

/**
 * The Region Map's effective click config, MEASURED at base 41561f80944b (`readClickOptions` over each preset file, with
 * the Region Graph's schema then: only `addLocationsToPath: false`), as the JSON it printed. CA-S2 left it
 * byte-identical (its presets kept their old keys); CA-S3 removed the keys, so these are now the record of what each
 * preset said, and both pins below read them.
 */
const MAP_CONFIG_AT_BASE = {
    default: '{"movePlayerOneStep":false,"movePlayerDirectly":true,"showRegionInPanel":true,"addToPath":true,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":false}',
    depgraph: '{"movePlayerOneStep":false,"movePlayerDirectly":false,"showRegionInPanel":false,"addToPath":false,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":true}',
    vibecoding: '{"movePlayerOneStep":false,"movePlayerDirectly":false,"showRegionInPanel":false,"addToPath":false,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":false}',
    apcalc: '{"movePlayerOneStep":false,"movePlayerDirectly":false,"showRegionInPanel":false,"addToPath":false,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":false}',
    "check-all-from-graph": '{"movePlayerOneStep":false,"movePlayerDirectly":false,"showRegionInPanel":false,"addToPath":false,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":true}',
    metamath: '{"movePlayerOneStep":false,"movePlayerDirectly":false,"showRegionInPanel":false,"addToPath":false,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":true}',
    textadventure: '{"movePlayerOneStep":false,"movePlayerDirectly":true,"showRegionInPanel":false,"addToPath":true,"overwritePath":false,"addLocationsToPath":false,"checkAllLocationsInRegion":false}',
};

/** The six keys CA-S3 removed from the presets and the schema (`addLocationsToPath` stays until CA-S4). */
const REMOVED_KEYS = Object.keys(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS).filter((k) => k !== 'addLocationsToPath');

describe('⛓ the old click keys are gone from every settings file (CA-S3)', () => {
    it('no frontend/settings/*.json names a removed key (scanned, not trusted)', () => {
        expect(REMOVED_KEYS).toEqual(['movePlayerOneStep', 'movePlayerDirectly', 'showRegionInPanel', 'addToPath',
            'overwritePath', 'checkAllLocationsInRegion']);
        const dir = new URL('../../settings/', import.meta.url);
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        expect(files.length).toBeGreaterThan(PRESETS.length);
        const naming = files.filter((f) => {
            const rg = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')).moduleSettings?.regionGraph ?? {};
            return REMOVED_KEYS.some((k) => k in rg);
        });
        expect(naming).toEqual([]);
    });

    it('the Region Graph\'s schema keeps addLocationsToPath (the Regions panel reads it until CA-S4) and no removed key', async () => {
        const src = fs.readFileSync(new URL('./index.js', import.meta.url), 'utf8');
        const schema = src.slice(src.indexOf('registerSettingsSchema('));
        expect(schema).toMatch(/addLocationsToPath: \{/);
        for (const k of REMOVED_KEYS) expect(schema).not.toMatch(new RegExp(`\\b${k}: \\{`));
    });
});

describe('⛓ the presets\' clickActions = the migration of the old keys they named at base', () => {
    for (const name of PRESETS) {
        it(`settings-${name}.json: clickActions = migrate(its base keys), and a load does not migrate`, async () => {
            const { clickActions } = readPreset(name).moduleSettings.regionGraph;
            expect(clickActions).toEqual(CA.migrateRegionGraphClickKeys(JSON.parse(MAP_CONFIG_AT_BASE[name])));
            const sm = fakeSettings(readPreset(name));
            expect((await S.loadRegionGraphClickActions(sm)).migrated).toBe(false);
            expect(sm.writes).toEqual([]);
        });
    }
});

describe('⛓ the Region Map\'s first-run copy (CA-S3, ⚖ R4) per preset = the migration of what its interim reader read', () => {
    for (const name of ['default', ...PRESETS]) {
        it(`${name}: the copy is exact, saved once as the Map's, and a second load writes nothing`, async () => {
            const sm = fakeSettings(readPreset(name));
            const first = await loadRegionMapClickActions(sm);
            expect(first.copied).toBe(true);
            expect(first.clickActions).toEqual(CA.migrateRegionGraphClickKeys(JSON.parse(MAP_CONFIG_AT_BASE[name])));
            expect(sm.writes.at(-1)).toEqual([REGION_MAP_CLICK_ACTIONS_KEY, first.clickActions]);
            const n = sm.writes.length;
            expect(await loadRegionMapClickActions(sm)).toEqual({ clickActions: first.clickActions, copied: false });
            expect(sm.writes).toHaveLength(n);
        });
    }
});
