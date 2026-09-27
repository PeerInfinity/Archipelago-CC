// APWORLD SUBSTRATE CHANGE M3 (R8, the name-free rule) — THE DECLARED START IS
// THE MENU, WHATEVER IT IS CALLED.
//
// `resolveTopDownStart` strips the declared start iff it is a PURE hub
// (`isVirtualStart`: at least one exit, no locations) — its exits' targets are
// then the roots (M1). Any other start keeps its cell: a real room that is also
// the menu (apcalc's `C`, sm64ex's `Menu` with 5 locations). The start's NAME is
// never read. More than one declared start is refused by name.
//
// Measured before the change (plan §28.0, at `f7a8c699cf`): 205 player-1 slots;
// the shape rule and the old name rule (`/^menu$/i && exits > 0`) disagree on
// exactly the slots whose `Menu` has exits AND locations (7: bumpstik, meritous,
// osrs, rulebuilder_test, shapez, sm64ex, v6); every other layout is
// byte-identical (the digests below were taken off the engine at `f7a8c699cf`).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../mazeRoom/mazeRoomLibrary.js';
import { createRng } from '../shared/rng.js';
import { regionsOf, startRegionsOf } from '../procgenCore/rulesGraph.js';
import {
    layoutTopDown, resolveTopDownStart, isVirtualStart, computeSourceCounts,
    topDownFromRulesJson, TOPDOWN_START_REFUSALS,
} from './procgenPipelineEngine.js';
import { topDownGridSide } from './presetRun.js';
import { buildTopDownEnvelope, runTopDownToStep } from './topDownSteps.js';
import { sidecarIssues } from '../apworldEditor/sidecarIssues.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const preset = (game, id = 'AP_14089154938208861744') => JSON.parse(readFileSync(new URL(
    `../../presets/${game}/${id}/${id}_rules.json`, import.meta.url,
), 'utf8'));

const OPTS = (side) => ({
    gridDims: { width: side, height: side },
    regionSizeBase: { width: 8, height: 6 },
    seed: 1,
    substrateMix: { maze: 1 },
});
const sideOf = (doc) => topDownGridSide(Object.keys(doc.regions['1']).length);

/** A small hub whose start is NOT called Menu: Lobby → A, B, C (B also from A), D only from C. */
function lobbySource({ lobbyLocations = [] } = {}) {
    const T = { rule: 'True_' };
    const reg = (name, exits = [], locations = []) => ({ name, exits, locations });
    const ex = (name, to) => ({ name, connected_region: to, access_rule: T });
    return {
        game_name: 'Lobby',
        start_regions: { 1: { default: ['Lobby'] } },
        regions: {
            1: {
                Lobby: reg('Lobby', [ex('Lobby -> A', 'A'), ex('Lobby -> B', 'B'), ex('Lobby -> C', 'C')], lobbyLocations),
                A: reg('A', [ex('A -> B', 'B')], [{ name: 'A1', access_rule: T, item: { name: 'k1' } }]),
                B: reg('B', [], [{ name: 'B1', access_rule: T, item: { name: 'k2' } }]),
                C: reg('C', [ex('C -> D', 'D')], [{ name: 'C1', access_rule: T, item: { name: 'k3' } }]),
                D: reg('D', [], [{ name: 'D1', access_rule: T, item: { name: 'Victory' } }]),
            },
        },
        items: { 1: {} },
    };
}

describe('M3 — the strip is keyed on SHAPE, never on the name', () => {
    it('a start called anything with exits and NO locations is stripped; its exits\' targets are the roots', () => {
        const doc = lobbySource();
        const layout = layoutTopDown(doc, OPTS(6), createRng(1));
        expect(layout.menuName).toBe('Lobby');
        expect(layout.cellsByName.has('Lobby')).toBe(false);
        expect(layout.menuRoots).toEqual([
            { name: 'A', exit_id: 'Lobby -> A' },
            { name: 'C', exit_id: 'Lobby -> C' },
        ]);
        expect(layout.stats.regionsTotal).toBe(4);
        // ⛓ computeSourceCounts excludes the STRIPPED start by the same rule.
        expect(computeSourceCounts(doc, '1').regions).toBe(4);
    });

    it('the same start WITH a location is a CELL: placed first, every exit explored from it, counted', () => {
        const doc = lobbySource({ lobbyLocations: [{ name: 'Lobby Gift', access_rule: { rule: 'True_' }, item: { name: 'k4' } }] });
        const layout = layoutTopDown(doc, OPTS(6), createRng(1));
        expect(layout.menuName).toBeNull();
        expect(layout.menuRoots).toEqual([]);
        expect(layout.placementOrder[0]).toEqual({ name: 'Lobby', cell: layout.cellsByName.get('Lobby'), parent: null });
        expect(layout.placementOrder).toHaveLength(5);
        expect(layout.stats.regionsTotal).toBe(5);
        expect(computeSourceCounts(doc, '1')).toMatchObject({ regions: 5, locations: 5 });
    });

    it('isVirtualStart: exits and no locations, nothing else read', () => {
        expect(isVirtualStart({ name: 'Menu', exits: [{}], locations: [] })).toBe(true);
        expect(isVirtualStart({ name: 'Anything', exits: [{}] })).toBe(true);
        expect(isVirtualStart({ name: 'Menu', exits: [{}], locations: [{}] })).toBe(false);
        expect(isVirtualStart({ name: 'Menu', exits: [], locations: [] })).toBe(false);
    });
});

describe('M3 — over the committed corpus the shape rule moves ONLY the Menus with locations', () => {
    const files = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'frontend/presets'], { encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('_rules.json'));
    /** The rule M1 shipped — the ORACLE for "before" (the start's NAME and an exit). */
    const nameRule = (regions, start) => (/^menu$/i.test(start) && (regions[start]?.exits ?? []).length > 0
        && regions[regions[start].exits[0].connected_region] ? start : null);

    it('menuName equals the name rule\'s on every player-1 slot but those whose Menu has exits AND locations', () => {
        const moved = [];
        let slots = 0;
        for (const f of files) {
            const doc = JSON.parse(readFileSync(`${ROOT}${f}`, 'utf8'));
            if (!doc.regions?.['1']) continue;
            slots += 1;
            const regions = regionsOf(doc, '1');
            const [start = null] = startRegionsOf(doc, '1').default;
            const now = resolveTopDownStart(regions, start)?.menuName ?? null;
            if (now === nameRule(regions, start)) continue;
            moved.push(f);
            // ⛓ the only disagreement: a Menu the name rule stripped that has locations → now a cell.
            expect(now, f).toBeNull();
            expect(start, f).toMatch(/^menu$/i);
            expect(regions[start].locations.length, f).toBeGreaterThan(0);
        }
        expect(slots).toBeGreaterThan(moved.length);
        // ⛓ the measured population has such slots (plan §28.0) — a row over none proves nothing.
        expect(moved.length).toBeGreaterThan(0);
        expect(moved.some((f) => f.includes('/sm64ex/'))).toBe(true);
    });

    it('no committed start OTHER than a Menu is a pure hub — so every non-Menu start keeps its cell, as before', () => {
        for (const f of files) {
            const doc = JSON.parse(readFileSync(`${ROOT}${f}`, 'utf8'));
            for (const p of Object.keys(doc.regions ?? {})) {
                const [start = null] = startRegionsOf(doc, p).default;
                if (!start || /^menu$/i.test(start)) continue;
                expect(resolveTopDownStart(regionsOf(doc, p), start)?.menuName ?? null, `${f} ${p}`).toBeNull();
            }
        }
    });
});

describe('M3 — byte identity where the shape did not move', () => {
    // ⛓ sha256 (first 16 hex) of the layout — order, cells, teleporter edges,
    // substrates, menuRoots, rng state — at each document's topDownGridSide, seed 1,
    // taken off the engine at `f7a8c699cf` (M3's start) with the same code.
    const BEFORE = { adventure: 'fbd5d40e6b61cafd', apcalc: 'a784ec69f87be21e', alttp_worldgen: '45c05dc9d413121e' };
    for (const [game, digest] of Object.entries(BEFORE)) {
        it(`${game}: the layout digest is the one M1/M2 computed`, () => {
            const doc = preset(game);
            const rng = createRng(1);
            const L = layoutTopDown(doc, OPTS(sideOf(doc)), rng);
            const s = JSON.stringify({
                order: L.placementOrder, cells: [...L.cellsByName], tele: L.teleporterEdges,
                substrates: L.substrateByRegion, menuRoots: L.menuRoots, rng: rng.getState(),
            });
            expect(createHash('sha256').update(s).digest('hex').slice(0, 16)).toBe(digest);
        });
    }
});

describe('M3 — a Menu WITH locations is a room', () => {
    it('sm64ex (Menu: 10 exits, 5 locations): every region placed, the Menu first; 4 exits to neighbours, the rest teleporters', async () => {
        const source = preset('sm64ex');
        const menu = source.regions['1'].Menu;
        expect(menu.exits).toHaveLength(10);
        expect(menu.locations).toHaveLength(5);
        const side = sideOf(source);
        const env = buildTopDownEnvelope({ source, seed: 1, ...OPTS(side) });
        await runTopDownToStep(env, 'compile');
        const { layout } = env;
        expect(layout.menuName).toBeNull();
        expect(layout.placementOrder).toHaveLength(Object.keys(source.regions['1']).length);
        expect(layout.placementOrder[0].name).toBe('Menu');
        const at = layout.cellsByName.get('Menu');
        const kids = layout.placementOrder.filter((p) => p.parent?.name === 'Menu');
        expect(kids).toHaveLength(menu.exits.length);
        const adjacent = kids.filter((k) => Math.abs(k.cell.gx - at.gx) + Math.abs(k.cell.gy - at.gy) === 1);
        const tele = layout.teleporterEdges.filter((t) => t.from_name === 'Menu');
        expect(adjacent.length).toBeLessThanOrEqual(4);
        expect(adjacent.length + tele.length).toBe(menu.exits.length);
        expect(env.finalize.stats.teleportersPlaced).toBeGreaterThanOrEqual(tele.length);
        // ④: the Menu is a GRID region — its sidecar entry, its locations the room's — and no wrapper.
        const doc = env.compile.rulesJson;
        expect(env.finalize.menuRegion).toBeNull();
        expect(doc.start_regions['1'].default).toEqual(['Menu']);
        expect(Object.keys(doc.regions['1'])[0]).toBe('Menu');
        expect(doc.preset_sidecars['1'].Menu).toBeTruthy();
        expect(JSON.stringify(doc.regions['1'])).not.toContain('"GameStart"');
        expect(doc.regions['1'].Menu.locations.map((l) => l.item?.name).filter(Boolean).sort())
            .toEqual(menu.locations.map((l) => l.item.name).sort());
        expect(doc.procgen_metadata.source_counts.regions).toBe(Object.keys(source.regions['1']).length);
        expect(sidecarIssues(doc, '1').filter((i) => i.severity === 'error')).toEqual([]);
    });

    it('shapez (Menu: 4 exits, 3 locations): the Menu a cell, its 4 exits to neighbours, every region placed', () => {
        const source = preset('shapez');
        const layout = layoutTopDown(source, OPTS(sideOf(source)), createRng(1));
        expect(layout.menuName).toBeNull();
        expect(layout.placementOrder).toHaveLength(Object.keys(source.regions['1']).length);
        expect(layout.placementOrder.filter((p) => p.parent?.name === 'Menu'))
            .toHaveLength(source.regions['1'].Menu.exits.length);
    });
});

describe('M3 — more than one declared start is REFUSED by name', () => {
    const twoStarts = () => {
        const doc = lobbySource();
        doc.start_regions['1'].default = ['Lobby', 'C'];
        return doc;
    };

    it('layoutTopDown and topDownFromRulesJson throw the one sentence', () => {
        const sentence = TOPDOWN_START_REFUSALS.multiStart(2);
        expect(sentence).toBe('topDownFromRulesJson: 2 start regions declared; the top-down layout takes one');
        expect(() => layoutTopDown(twoStarts(), OPTS(6), createRng(1))).toThrow(sentence);
        expect(() => topDownFromRulesJson(twoStarts(), OPTS(6))).toThrow(sentence);
    });

    it('one declared start is not refused', () => {
        expect(() => layoutTopDown(lobbySource(), OPTS(6), createRng(1))).not.toThrow();
    });
});

describe('M3 — the sphere attribution skips the STRIPPED start, whatever its name', () => {
    it('a sphere log that lists the stripped Lobby warns about no unplaced region', async () => {
        const log = [
            { type: 'metadata', seed: 1 },
            { type: 'state_update', sphere_index: '0', player_data: { 1: { new_accessible_regions: ['Lobby', 'A', 'B', 'C', 'D'] } } },
        ];
        const env = buildTopDownEnvelope({ source: lobbySource(), seed: 1, ...OPTS(6), sphereLog: log });
        await runTopDownToStep(env, 'finalize');
        expect(env.layout.menuName).toBe('Lobby');
        expect(env.finalize.attributionWarnings.filter((w) => /was not placed/.test(w))).toEqual([]);
    });
});
