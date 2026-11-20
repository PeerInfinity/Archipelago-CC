/**
 * clickActionsSettings — the Region Graph's `moduleSettings.regionGraph.clickActions` (slice CA-S2):
 *   1. the ONE-TIME migration (js-21 edit 3): it writes once, a second load changes nothing, and a stored
 *      `clickActions` is never overwritten; the seven old keys are left in place;
 *   2. the six settings presets carry `clickActions` = the migration of their own old keys, alongside those keys;
 *   3. the Region Map is unchanged (js-21 edit 2): its effective click config (`regionMapClicks.readClickOptions`,
 *      which reads the seven `regionGraph.*` keys until CA-S3) is the one measured at base, for each preset and the
 *      default.
 * The settings manager is a fake with getSetting's precedence (override > stored > schema default > call-site).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const S = await import('./clickActionsSettings.js');
const CA = await import('../regionView/clickActions.js');
const { readClickOptions, CLICK_OPTIONS_PREFIX } = await import('../regionMap/regionMapClicks.js');

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
        const mapBefore = await readClickOptions(sm, CLICK_OPTIONS_PREFIX);
        await S.saveRegionGraphClickActions(sm, on);
        expect(sm.tree.moduleSettings.regionGraph.addLocationsToPath).toBe(true);
        // The ONE interim change (js-21): the Region Map's click config follows the strip on this key alone.
        expect(await readClickOptions(sm, CLICK_OPTIONS_PREFIX)).toEqual({ ...mapBefore, addLocationsToPath: true });
        const off = { ...on, location: { 'path.check': 'now' } };
        await S.saveRegionGraphClickActions(sm, off);
        expect(sm.tree.moduleSettings.regionGraph.addLocationsToPath).toBe(false);
        expect(await readClickOptions(sm, CLICK_OPTIONS_PREFIX)).toEqual({ ...mapBefore, addLocationsToPath: false });
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

describe('⛓ the settings presets that name the old keys carry clickActions alongside them', () => {
    it('the presets that name an old key are exactly the ones listed here (scanned, not trusted)', () => {
        const dir = new URL('../../settings/', import.meta.url);
        const naming = fs.readdirSync(dir).filter((f) => /^settings-.*\.json$/.test(f)).filter((f) => {
            const rg = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8')).moduleSettings?.regionGraph ?? {};
            return Object.keys(CA.LEGACY_REGION_GRAPH_CLICK_DEFAULTS).some((k) => k in rg);
        }).map((f) => f.slice('settings-'.length, -'.json'.length)).sort();
        expect(naming).toEqual([...PRESETS].sort());
    });

    for (const name of PRESETS) {
        it(`settings-${name}.json: clickActions = the migration of its own old keys, and a load does not migrate`, async () => {
            const rg = readPreset(name).moduleSettings.regionGraph;
            const { clickActions, ...rest } = rg;
            expect(clickActions).toEqual(CA.migrateRegionGraphClickKeys(rest));
            const sm = fakeSettings(readPreset(name));
            expect((await S.loadRegionGraphClickActions(sm)).migrated).toBe(false);
            expect(sm.writes).toEqual([]);
        });
    }
});

/**
 * The Region Map's effective click config, MEASURED at base 41561f80944b (`readClickOptions` over each preset file, with
 * the Region Graph's schema then: only `addLocationsToPath: false`), as the JSON it printed. CA-S2 must leave it
 * byte-identical: the presets keep their old keys and the schema keeps `addLocationsToPath`.
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

describe('⛓ the Region Map is unchanged (js-21 edit 2): its effective click config, base → tip', () => {
    for (const name of ['default', ...PRESETS]) {
        it(`${name}: readClickOptions is byte-identical to base`, async () => {
            const got = await readClickOptions(fakeSettings(readPreset(name)), CLICK_OPTIONS_PREFIX);
            expect(JSON.stringify(got)).toBe(MAP_CONFIG_AT_BASE[name]);
        });
    }
});
