/**
 * apworldEditor/menuMarker — **THE MENU ON THE MAP: THE ROWS** (APWORLD
 * SUBSTRATE CHANGE M2, task 2). The derivation `menuMarkerFor` and the setting
 * `showMenuOnMap`, on committed documents initialised in memory (read-only: no
 * fixture is written). The Map's DOM marker is the in-app `apworldEditor` rows'.
 *
 * ⛓ The subjects are DERIVED from the committed corpus, never named: the first
 * bare slot whose declared start has more than one exit and IS stripped by the
 * layout (a Menu hub), the first whose start is NOT stripped but has more than
 * one exit (the start is a cell AND the menu — planner, M2), and the first with
 * exactly one exit.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { SettingsManager } from '../../app/core/settingsManager.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { register } from './index.js';
import { startRegionsOf } from '../procgenCore/rulesGraph.js';
import { exitsOf } from '../menuPanel/menuPanelEngine.js';
import { initialiseFacts, initialiseSlot, planInitialise } from './slotInitialise.js';
import {
    SHOW_MENU_ON_MAP_DEFAULT, SHOW_MENU_ON_MAP_KEY, SHOW_MENU_ON_MAP_SETTING, menuMarkerFor, showMenuOnMap,
} from './menuMarker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

/** ⛓ The population's size bound (the slotInitialise population row's). */
const MAX_REGIONS = 100;

const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('_rules.json'));

/** ⛓ The first committed bare player-1 slot (≤ MAX_REGIONS) that `pick(doc, facts, exits)` accepts. */
function firstSlot(pick) {
    for (const f of files) {
        const doc = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
        const facts = initialiseFacts(doc, '1');
        if (!facts.bare || facts.blocker || facts.regions > MAX_REGIONS) continue;
        const exits = exitsOf(doc, '1', facts.declaredStart);
        if (pick(doc, facts, exits)) return { f, doc, facts };
    }
    return null;
}

const HUB = firstSlot((doc, facts, exits) => !!facts.menu && exits.length > 1);
const CELL_START = firstSlot((doc, facts, exits) => !facts.menu && exits.length > 1);
const ONE_EXIT = firstSlot((doc, facts, exits) => exits.length === 1);

/** ⛓ The slot with an initialise's entries written the way the op writes them (a COPY). */
function initialisedDoc(doc) {
    const res = initialiseSlot({ doc, player: '1' });
    expect(res.ok, res.threw).toBe(true);
    const copy = JSON.parse(JSON.stringify(doc));
    copy.preset_sidecars = { ...(copy.preset_sidecars ?? {}), 1: res.entries };
    return { copy, res };
}

describe('the setting showMenuOnMap', () => {
    it('⛓ index.js registers it beside R2\'s and R7\'s: boolean, default ON, the WHERE sentence names the Map', () => {
        const schemas = [];
        register(new Proxy({}, { get: (_, n) => (n === 'registerSettingsSchema' ? (s) => schemas.push(s) : () => {}) }));
        const prop = schemas[0].properties[SHOW_MENU_ON_MAP_KEY];
        expect(prop.type).toBe('boolean');
        expect(prop.default).toBe(SHOW_MENU_ON_MAP_DEFAULT);
        expect(SHOW_MENU_ON_MAP_DEFAULT).toBe(true);
        expect(prop.description).toMatch(/Map tab/);
        expect(SHOW_MENU_ON_MAP_SETTING).toBe(`moduleSettings.apworldEditor.${SHOW_MENU_ON_MAP_KEY}`);
    });

    it('⛓ getSetting with NO persisted value answers the schema default; a stored false turns it off', async () => {
        const schemas = [];
        register(new Proxy({}, { get: (_, n) => (n === 'registerSettingsSchema' ? (s) => schemas.push(s) : () => {}) }));
        centralRegistry.registerSettingsSchema('apworldEditor', schemas[0]);
        const sm = new SettingsManager();
        sm.setInitialSettings({ moduleSettings: {} });
        expect(showMenuOnMap(await sm.getSetting(SHOW_MENU_ON_MAP_SETTING))).toBe(true);
        await sm.updateSetting(SHOW_MENU_ON_MAP_SETTING, false, { persist: false });
        expect(showMenuOnMap(await sm.getSetting(SHOW_MENU_ON_MAP_SETTING))).toBe(false);
    });

    it.each([[true, true], [false, false], [undefined, true], [null, true], ['false', true], [0, true]])(
        'a stored %j means %j', (stored, shown) => {
            expect(showMenuOnMap(stored)).toBe(shown);
        });
});

describe('menuMarkerFor — the declared start and its exits, each target\'s cell', () => {
    it('⛓ the derived subjects exist (a row over none proves nothing)', () => {
        expect(HUB, 'a bare slot with a stripped multi-exit start').not.toBeNull();
        expect(CELL_START, 'a bare slot whose multi-exit start is NOT stripped').not.toBeNull();
        expect(ONE_EXIT, 'a bare slot whose start has one exit').not.toBeNull();
    });

    it('⛓ a BARE slot: every exit listed, none placed (no entry carries a grid_cell)', () => {
        const m = menuMarkerFor(HUB.doc, '1');
        const [start] = startRegionsOf(HUB.doc, '1').default;
        expect(m.name).toBe(start);
        expect(m.exits.map((e) => e.target)).toEqual(exitsOf(HUB.doc, '1', start).map((e) => e.targetRegion));
        expect(m.exits.map((e) => e.name)).toEqual(exitsOf(HUB.doc, '1', start).map((e) => e.name));
        expect(m.exits.every((e) => e.placed === false)).toBe(true);
    });

    it('⛓⛓ the hub slot INITIALISED: every exit placed, and the targets ARE the layout\'s menuRoots', () => {
        const { copy } = initialisedDoc(HUB.doc);
        const m = menuMarkerFor(copy, '1');
        const plan = planInitialise(HUB.doc, '1');
        expect(m.exits.length).toBe(plan.menuExits);
        expect(m.exits.every((e) => e.placed), HUB.f).toBe(true);
        expect(m.exits.map((e) => e.target)).toEqual(plan.menuRoots.map((r) => r.name));
        // ⛓ `placed` is the ENTRY's grid_cell, read off the document (not the layout).
        for (const e of m.exits) expect(!!copy.preset_sidecars['1'][e.target].grid_cell).toBe(e.placed);
    });

    it('⛓ a target whose entry lost its grid_cell is placed:false (the flag is the document\'s)', () => {
        const { copy } = initialisedDoc(HUB.doc);
        const victim = menuMarkerFor(copy, '1').exits[1].target;
        delete copy.preset_sidecars['1'][victim].grid_cell;
        const m = menuMarkerFor(copy, '1');
        expect(m.exits.filter((e) => !e.placed).map((e) => e.target)).toEqual([victim]);
    });

    it('⛓ a start that is NOT named Menu and is a CELL still gets the marker (the declared start is the menu)', () => {
        const [start] = startRegionsOf(CELL_START.doc, '1').default;
        expect(CELL_START.facts.menu).toBeNull();
        const { copy } = initialisedDoc(CELL_START.doc);
        const m = menuMarkerFor(copy, '1');
        expect(m.name).toBe(start);
        expect(m.exits.length).toBe(exitsOf(CELL_START.doc, '1', start).length);
        expect(m.exits.length).toBeGreaterThan(1);
        for (const e of m.exits) expect(e.placed, e.target).toBe(!!copy.preset_sidecars['1'][e.target]?.grid_cell);
        // ⛓ the start itself has a cell here — it is a region on the grid AND the menu.
        expect(!!copy.preset_sidecars['1'][start]?.grid_cell).toBe(true);
    });

    it('⛓ a one-exit start: one entry', () => {
        expect(menuMarkerFor(ONE_EXIT.doc, '1').exits).toHaveLength(1);
    });

    it('⛓ null when the slot declares no start, or its start has no exit', () => {
        const noExit = { start_regions: { 1: ['A'] }, regions: { 1: { A: { name: 'A', exits: [] } } } };
        const noStart = { start_regions: {}, regions: { 1: { A: { name: 'A', exits: [] } } } };
        expect(menuMarkerFor(noExit, '1')).toBeNull();
        expect(menuMarkerFor(noStart, '1')).toBeNull();
    });
});
