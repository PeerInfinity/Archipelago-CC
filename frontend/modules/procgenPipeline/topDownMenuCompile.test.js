// APWORLD SUBSTRATE CHANGE M1 (R8, shape A) — THE COMPILE KEEPS THE SOURCE MENU.
//
// `finalizeTopDown` answers `menuRegion` (the stripped Menu: its exits to placed
// targets, rules verbatim; its locations verbatim) and `menuWarnings` (each Menu
// exit dropped because its target was not placed). `buildRulesJson` emits that
// Menu in place of the synthetic `{GameStart → start}` one; its locations go
// through the same compile a grid location does (items, pool, placements).
// Grid-growth and sphere growth pass no `menuRegion` and keep the synthetic Menu.
//
// Measured before (plan §26.0): of 108 one-exit sources, 39 name their Menu exit
// `GameStart` with `True_` and no Menu locations — their compiled documents are
// unchanged — and 69 name it otherwise, so their compiled Menu takes the source's
// exit name (3 of them also regain a rule, 4 their Menu locations).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '../mazeRoom/mazeRoomLibrary.js';
import { buildRulesJson } from './procgenPipelineEngine.js';
import {
    buildTopDownEnvelope, runTopDownToStep, runTopDownStep,
    serializeTDEnvelope, deserializeTDEnvelope, TOPDOWN_STEPS,
} from './topDownSteps.js';
import { validateRules } from '../apworldEditor/rulesUtils.js';
import { sidecarIssues } from '../apworldEditor/sidecarIssues.js';

const preset = (game, id = 'AP_14089154938208861744') => JSON.parse(readFileSync(new URL(
    `../../presets/${game}/${id}/${id}_rules.json`, import.meta.url,
), 'utf8'));

function envFor(source, side) {
    return buildTopDownEnvelope({
        source, seed: 1, gridDims: { width: side, height: side },
        regionSizeBase: { width: 8, height: 6 }, substrateMix: { maze: 1 },
    });
}

async function compiled(source, side) {
    const env = envFor(source, side);
    await runTopDownToStep(env, 'compile');
    return env;
}

const errors = (issues) => issues.filter((i) => i.severity === 'error');

/** ④'s own buildRulesJson call, re-issued over ③'s output with the given Menu and no simulator log. */
function recompile(env, menuRegion) {
    const c = env.compileIn;
    return buildRulesJson(env.finalize.grid, {
        startCell: env.finalize.startCell, seed: c.seed, embedSphereLog: false,
        assumeBidirectional: c.assumeBidirectional, startingItems: c.startingItems,
        sourceItems: c.sourceItemDefs, menuRegion,
    });
}

/** A small hub: Menu → A, B, C; A → B; C → D. ⛓ M3 — the Menu is a PURE hub (no
 *  locations: one would make it a cell); `k1`, which gates Menu → C, is A's gift. */
function hubSource() {
    const T = { rule: 'True_' };
    const reg = (name, exits = [], locations = []) => ({ name, exits, locations });
    const ex = (name, to, rule = T) => ({ name, connected_region: to, access_rule: rule });
    return {
        game_name: 'Hub',
        start_regions: { 1: { default: ['Menu'] } },
        regions: {
            1: {
                Menu: reg('Menu', [ex('Menu -> A', 'A'), ex('Menu -> B', 'B'),
                    ex('Menu -> C', 'C', { rule: 'Has', args: { item_name: 'k1' } })]),
                A: reg('A', [ex('A -> B', 'B')], [{ name: 'A1', access_rule: T, item: { name: 'k2' } },
                    { name: 'A Gift', access_rule: T, item: { name: 'k1', player: 1 } }]),
                B: reg('B', [], [{ name: 'B1', access_rule: T, item: { name: 'k3' } }]),
                C: reg('C', [ex('C -> D', 'D')], [{ name: 'C1', access_rule: T, item: { name: 'k4' } }]),
                D: reg('D', [], [{ name: 'D1', access_rule: T, item: { name: 'Victory' } }]),
            },
        },
        items: { 1: {} },
    };
}

describe('M1 — ④ emits the SOURCE Menu', () => {
    it('mm3: the compiled Menu is the source\'s 13 exits with their Has rules; validateRules no worse; 0 sidecar errors', async () => {
        const source = preset('mm3');
        const env = await compiled(source, 7);
        const doc = env.compile.rulesJson;
        const strip = (e) => ({ name: e.name, connected_region: e.connected_region, access_rule: e.access_rule });
        expect(doc.regions['1'].Menu.exits).toEqual(source.regions['1'].Menu.exits.map(strip));
        // 13 gated exits (10 `Has`, the rest composites) — the synthetic Menu had one True_ exit.
        expect(doc.regions['1'].Menu.exits).toHaveLength(13);
        expect(doc.regions['1'].Menu.exits.filter((e) => e.access_rule.rule !== 'True_')).toHaveLength(13);
        expect(Object.keys(doc.regions['1'])[0]).toBe('Menu');
        expect(env.compile.menuWarnings).toEqual([]);
        expect(errors(validateRules(doc, '1')).length)
            .toBeLessThanOrEqual(errors(validateRules(source, '1')).length);
        expect(errors(sidecarIssues(doc, '1'))).toEqual([]);
    });

    it('sm64ex (M3): a Menu WITH locations is a CELL — its 5 locations are its room\'s, no source Menu is carried', async () => {
        // ⛓ M1 carried these 5 on the stripped Menu; since M3 a start with locations
        // is placed like any region (plan §25.10), so the compile keeps no menuRegion.
        const source = preset('sm64ex');
        const env = await compiled(source, 12);
        const doc = env.compile.rulesJson;
        const srcLocs = source.regions['1'].Menu.locations;
        expect(srcLocs).toHaveLength(5);
        expect(env.layout.menuName).toBeNull();
        expect(env.finalize.menuRegion).toBeNull();
        expect(env.layout.cellsByName.has('Menu')).toBe(true);
        expect(doc.start_regions['1'].default).toEqual(['Menu']);
        expect(Object.keys(doc.regions['1'])[0]).toBe('Menu');
        expect(doc.preset_sidecars['1'].Menu).toBeTruthy();
        const menuItems = doc.regions['1'].Menu.locations.map((l) => l.item?.name).filter(Boolean).sort();
        expect(menuItems).toEqual(srcLocs.map((l) => l.item.name).sort());
        expect(errors(sidecarIssues(doc, '1'))).toEqual([]);
    });

    it('a Menu exit whose target was not placed is DROPPED and named — the document gains no dangling exit', async () => {
        const env = await compiled(hubSource(), 1);
        expect(env.layout.placementOrder.map((p) => p.name)).toEqual(['A']);
        const menu = env.compile.rulesJson.regions['1'].Menu;
        expect(menu.exits.map((e) => e.connected_region)).toEqual(['A']);
        expect(env.compile.menuWarnings).toEqual([
            'Menu exit "Menu -> B" → "B" dropped: its target was not placed',
            'Menu exit "Menu -> C" → "C" dropped: its target was not placed',
        ]);
        expect(validateRules(env.compile.rulesJson, '1')
            .filter((i) => /points at unknown region/.test(i.message))).toEqual([]);
        // ⛓ M3 — a stripped start has no locations by construction (one would make it a cell).
        expect(menu.locations).toEqual([]);
    });

    it('a rule on a Menu exit is kept verbatim (the synthetic Menu wrote True_)', async () => {
        const env = await compiled(hubSource(), 6);
        const menu = env.compile.rulesJson.regions['1'].Menu;
        expect(menu.exits.map((e) => [e.name, e.access_rule])).toEqual([
            ['Menu -> A', { rule: 'True_' }],
            ['Menu -> B', { rule: 'True_' }],
            ['Menu -> C', { rule: 'Has', args: { item_name: 'k1' } }],
        ]);
    });
});

describe('M1 — a ONE-exit source', () => {
    it('adventure (`GameStart`, True_, no locations): the compiled document is byte-identical to the synthetic Menu\'s', async () => {
        const env = await compiled(preset('adventure'), 4);
        expect(env.finalize.menuRegion.exits.map((e) => e.name)).toEqual(['GameStart']);
        expect(JSON.stringify(recompile(env, env.finalize.menuRegion)))
            .toBe(JSON.stringify(recompile(env, null)));
    });

    it('bakingadventure (`StartBaking`): the ONLY difference is the Menu exit\'s NAME', async () => {
        const source = preset('bakingadventure');
        const env = await compiled(source, 4);
        const withMenu = recompile(env, env.finalize.menuRegion);
        const synthetic = recompile(env, null);
        const srcExit = source.regions['1'].Menu.exits[0];
        expect(srcExit.name).not.toBe('GameStart');
        expect(withMenu.regions['1'].Menu.exits[0].name).toBe(srcExit.name);
        withMenu.regions['1'].Menu.exits[0].name = 'GameStart';
        expect(JSON.stringify(withMenu)).toBe(JSON.stringify(synthetic));
    });
});

describe('M1 — the stepped runner\'s codec carries menuRoots and menuRegion', () => {
    it('a serialize → deserialize between EVERY step reproduces the straight-through document (mm3)', async () => {
        const straight = await compiled(preset('mm3'), 7);
        let env = envFor(preset('mm3'), 7);
        for (const step of TOPDOWN_STEPS) {
            await runTopDownStep(step, env);
            env = deserializeTDEnvelope(JSON.parse(JSON.stringify(serializeTDEnvelope(env))));
        }
        expect(env.layout.menuRoots).toEqual(straight.layout.menuRoots);
        expect(env.layout.menuRoots).toHaveLength(13);
        expect(env.finalize.menuRegion).toEqual(straight.finalize.menuRegion);
        expect(JSON.stringify(env.compile.rulesJson)).toBe(JSON.stringify(straight.compile.rulesJson));
    });
});
