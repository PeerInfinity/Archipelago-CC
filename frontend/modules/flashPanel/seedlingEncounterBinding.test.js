/**
 * ⛓⛓ ENCOUNTERS — the two encounter locations (L32's Bob Boss → Fire, L12's Witch → the dark sword) bound on the
 * live path (the JS arc's half of fidelity's wave-10 encounter executors):
 *
 *   1. BINDING   `vanillaArmPlaybackMap` binds each encounter row whose drop has an executor as
 *                `{location, level, kind: 'encounter', at, drop: {item}, flag}` — `at` off the playthrough atlas,
 *                `item` off the row; any other encounter row stays refused by name.
 *   2. MAPPING   `solverGoalFor` (and through it `wasmArrival.arrivalSolverGoal`) maps that goal to the solver's
 *                `encounter` goal, `then` off the level's control block.
 *   3. CHECK     the location's check is the GAME's flag (`hasFire` / `hasDarkSword`) turning true in the
 *                encounter's own level — never the plan, never an echo of the host's own item write.
 *   4. PERSISTENCE  a live arrival after a death in L32 ({32,1} cleared) is staged, mapped and SOLVED.
 *
 * ⛔ THE FIXTURE IS THE PRODUCTION LOAD (`loadSeedlingRandomizer` over the shipped rules, as
 * `seedlingVanillaArmMap.test.js`), and the glue rows drive the REAL glue + the load's REAL check binding.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
    BOUND_ENCOUNTER_DROPS, ENCOUNTER_ANCHOR_REFUSAL, ENCOUNTER_REFUSAL, atlasLocationGoal, encounterAnchorOf,
    realRoomPlaybackMap, resolveSeedlingAtlasGoal, rulesAtlasOf, vanillaArmPlaybackMap,
} from './seedlingPlaybackController.js';
import { loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';
import { SeedlingRegionGlue, reportContext } from './seedlingRegionGlue.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';
import { ENCOUNTER_EXECUTORS } from '../seedlingDemo/solverBot.js';
import { solverGoalFor, createInPlaceSolveService } from '../seedlingDemo/jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from '../seedlingDemo/wasmArrival.js';
import { createRunForStaging, solveStaging, stagingFromTape } from '../seedlingDemo/tapeRunner.js';
import { parseTape } from '../seedlingDemo/tapeFormat.js';
import { atlasLevelSource } from '../seedlingDemo/levelSource.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';
import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const BASE = pathToFileURL(abs('../../')).href;
const GAME_CONFIG = readJson('./games/seedling.json');
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const ATLAS = readJson('./atlases/seedling-playthrough.json');
const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const LOADED = await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel['1'], manifest: readJson('./wasm/builds.json'), rawRules: PT, locations: locationsOf(PT),
    playerId: '1', gameConfig: GAME_CONFIG, baseUrl: BASE,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
});
const MAP = realRoomPlaybackMap(LOADED, PT);
const BOB = 'Level 032 - Bob Boss';
const WITCH = 'Level 012 - Witch';
const entryOf = (name) => MAP.entries.find((e) => e.location === name);
const tapeStaging = (id) => solveStaging(stagingFromTape(parseTape(readJson(`../seedlingDemo/fixtures/tapes/${id}.json`))));

describe('1 · BINDING — both encounters bound, each value read off the data', () => {
    it('the load reports exactly the two encounter rows, each with the ledger\'s game flag', () => {
        expect(LOADED.encounters.map((e) => [e.location, e.vanillaItem, e.flag]).sort()).toEqual([
            [WITCH, 'Progressive Sword', 'hasDarkSword'], [BOB, 'Fire', 'hasFire']].sort());
    });

    it('L32 Bob Boss → {kind: encounter, at (64,128), drop Fire}; L12 Witch → at (416,384), drop Progressive Sword', () => {
        expect(entryOf(BOB)).toEqual({ location: BOB, level: 32, kind: 'encounter', at: { x: 64, y: 128 },
            drop: { item: 'Fire' }, flag: 'hasFire', entityType: 'fallrocklarge' });
        expect(entryOf(WITCH)).toEqual({ location: WITCH, level: 12, kind: 'encounter', at: { x: 416, y: 384 },
            drop: { item: 'Progressive Sword' }, flag: 'hasDarkSword', entityType: 'witch' });
        expect(MAP.refused.filter((r) => [BOB, WITCH].includes(r.location))).toEqual([]);
    });

    it('`at` IS the atlas tile × tile_size (the survey\'s `encounterCoords`), not a literal: a moved tile moves it', () => {
        const rows = LOADED.encounters;
        for (const e of rows) {
            const loc = ATLAS.regions.find((r) => r.map_ref === e.level).locations.find((l) => l.name === e.location);
            expect(encounterAnchorOf(ATLAS, e)).toEqual({ x: loc.tile[0] * 16, y: loc.tile[1] * 16 });
        }
        const moved = structuredClone(ATLAS);
        moved.regions.find((r) => r.map_ref === 32).locations.find((l) => l.name === BOB).tile = [5, 9];
        const map = vanillaArmPlaybackMap({ encounters: rows, set: LOADED.set, regions: MAP.regions, rules: PT, atlasDoc: moved });
        expect(map.entries.find((e) => e.location === BOB).at).toEqual({ x: 80, y: 144 });
    });

    it('the atlas is the one the RULES name (`region_atlas.atlas_id`); a rules doc naming another is refused by name', () => {
        expect(rulesAtlasOf(PT).atlasDoc?.atlas_id).toBe(PT.region_atlas['1'].atlas_id);
        const other = { ...PT, region_atlas: { 1: { ...PT.region_atlas['1'], atlas_id: 'seedling-00000000' } } };
        const map = realRoomPlaybackMap(LOADED, other);
        for (const e of LOADED.encounters) {
            expect(map.refused.find((r) => r.location === e.location)?.why).toBe(ENCOUNTER_ANCHOR_REFUSAL(e, 'seedling-00000000'));
        }
    });

    it('an encounter row whose drop has NO executor stays refused BY NAME (ENCOUNTER_REFUSAL)', () => {
        const owl = { ledgerId: 'owl@L112', level: 112, location: 'Level 112 - Owl', entityType: 'owl', vanillaItem: 'Owl', flag: 'x' };
        const map = vanillaArmPlaybackMap({ encounters: [...LOADED.encounters, owl], set: LOADED.set, regions: MAP.regions,
            rules: PT, atlasDoc: ATLAS });
        expect(map.refused.find((r) => r.location === owl.location)?.why).toBe(ENCOUNTER_REFUSAL(owl));
        expect(map.entries.some((e) => e.location === owl.location)).toBe(false);
        const r = resolveSeedlingAtlasGoal({ kind: 'location', name: owl.location }, map);
        expect(r.refused).toBe(`"${owl.location}" is a location the vanilla arm's map did NOT bind — ${ENCOUNTER_REFUSAL(owl)}`);
    });

    it('the bound drops ARE the solver\'s encounter executors (restated — the controller imports no model — and pinned)', () => {
        expect([...BOUND_ENCOUNTER_DROPS].sort()).toEqual(Object.keys(ENCOUNTER_EXECUTORS).sort());
    });

    it('resolve → a `location` goal with no tag and an `encounter` block (one spelling: `atlasLocationGoal`)', () => {
        const r = resolveSeedlingAtlasGoal({ kind: 'location', name: BOB }, MAP);
        expect(r.goal).toEqual({ kind: 'location', level: 32, tag: null, entityType: 'fallrocklarge', name: BOB,
            encounter: { at: { x: 64, y: 128 }, drop: { item: 'Fire' } } });
        expect(atlasLocationGoal(entryOf(BOB), BOB)).toEqual(r.goal);
        // a non-encounter entry's goal is unchanged
        const e = LOADED.entries[0];
        expect(atlasLocationGoal(e, e.location)).toEqual({ kind: 'location', level: e.level, tag: e.tag,
            entityType: e.entityType ?? null, name: e.location });
    });
});

describe('2 · MAPPING — `solverGoalFor` / `arrivalSolverGoal` → the solver\'s encounter goal', () => {
    const goalOf = (name) => resolveSeedlingAtlasGoal({ kind: 'location', name }, MAP).goal;

    it('L32 (a `fallthrough` room): then = reach-pit; L12: then = null — on the JS runtime\'s mapping', () => {
        const l32 = createRunForStaging(tapeStaging('r5-bobboss-fire'), atlasLevelSource());
        expect(solverGoalFor(goalOf(BOB), { run: l32, resolved: null })).toEqual({ goal: { kind: 'encounter',
            at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' } });
        const l12 = createRunForStaging(tapeStaging('enc-l12-witch'), atlasLevelSource());
        expect(l12.level).toBe(12);
        expect(solverGoalFor(goalOf(WITCH), { run: l12, resolved: null })).toEqual({ goal: { kind: 'encounter',
            at: { x: 416, y: 384 }, drop: { item: 'Progressive Sword' }, then: null } });
    });

    it('`then` is the ROOM\'s: L12 has a fallthrough too, but only an ARENA (fallthrough + a sealing boss rock) is left by its pit — L32 alone', () => {
        const src = atlasLevelSource();
        const levels = (readJson('./atlases/seedling-map.json').levels ?? []).map((l) => l.level);
        const arenas = [];
        for (const level of levels) {
            const run = createRunForStaging({ ...tapeStaging('r5-bobboss-fire'), boot: { ...tapeStaging('r5-bobboss-fire').boot, level } }, src);
            const m = solverGoalFor({ kind: 'location', level, tag: null, encounter: { at: { x: 0, y: 0 }, drop: { item: 'Fire' } } },
                { run, resolved: null });
            if (m.goal.then === 'reach-pit') arenas.push(level);
        }
        expect(arenas).toEqual([32]);
        expect(createRunForStaging(tapeStaging('enc-l12-witch'), src).world.fallthrough).not.toBeNull();
    }, 120_000);

    it('the wasm runtime\'s `arrivalSolverGoal` maps the same goals from a staging (no entity looked up)', () => {
        const src = atlasLevelSource();
        const s32 = tapeStaging('r5-bobboss-fire');
        expect(arrivalSolverGoal(goalOf(BOB), { staging: s32, levelSource: src, record: src(32) }).goal)
            .toEqual({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });
        const s12 = tapeStaging('enc-l12-witch');
        expect(arrivalSolverGoal(goalOf(WITCH), { staging: s12, levelSource: src, record: src(12) }).goal)
            .toEqual({ kind: 'encounter', at: { x: 416, y: 384 }, drop: { item: 'Progressive Sword' }, then: null });
    });

    it('a NON-encounter location still maps to collect-placement (byte-identical request shape)', () => {
        const run = createRunForStaging(tapeStaging('r5-bobboss-fire'), atlasLevelSource());
        expect(solverGoalFor({ kind: 'location', level: 32, tag: 3, name: 'x' }, { run, resolved: null, placement: { x: 8, y: 16 } }))
            .toEqual({ goal: { kind: 'collect-placement', placement: { x: 8, y: 16 } } });
        expect(solverGoalFor({ kind: 'location', level: 32, tag: 3, name: 'x' }, { run, resolved: null }))
            .toEqual({ walker: 'the location names no entity of the room' });
    });

    it('the JS PAGE refuses an encounter goal BY NAME (its walker completes a location by tag; wasm serves it)', () => {
        const rt = createJsRuntime();
        rt.setVanilla(new Map(indexLevels(readJson('./atlases/seedling-map.json'))));
        const answer = rt.playback.walkTo(resolveSeedlingAtlasGoal({ kind: 'location', name: BOB }, MAP).goal);
        expect(answer.ok).toBe(false);
        expect(answer.reason).toMatch(/is an ENCOUNTER \(the Fire drop in level 32\).*walked on the wasm runtime/);
    });
});

/** The REAL glue, the load's REAL check binding, an adapter stand-in carrying what the real one reports. */
function glueWith(binding) {
    const published = [];
    const glue = new SeedlingRegionGlue({ eventBus: { subscribe: () => () => {}, publish: () => {} },
        getDispatcher: () => ({ publish: (name, data) => published.push({ name, data }) }),
        loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT, getPanel: () => null });
    const adapter = { teleport: vi.fn(), onStateReport: null, setHostOwnedLocations: vi.fn(),
        gameState: { level: 0 }, expectedEchoValue: {} };
    glue.attachAdapter(adapter);
    glue.setCheckBinding(binding);
    /** One game report, the way `FlashBridgeAdapter._onStateChanged` makes it (state first, then the hook). */
    const report = (property, value) => { adapter.gameState[property] = value; adapter.onStateReport(property, value); };
    const checks = () => published.filter((p) => p.name === 'user:locationCheck').map((p) => p.data.locationName);
    return { glue, adapter, report, checks };
}
const freshBinding = async () => (await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel['1'], manifest: readJson('./wasm/builds.json'), rawRules: PT, locations: locationsOf(PT),
    playerId: '1', gameConfig: GAME_CONFIG, baseUrl: BASE,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
})).checkBinding;

describe('3 · CHECK — read off the GAME\'s flag in the encounter\'s own level, never the plan', () => {
    it('`hasFire` → true while the game reports level 32 checks Bob Boss; `hasDarkSword` in 12 checks the Witch', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.report('hasFire', true);
        g.report('level', 12);
        g.report('hasDarkSword', true);
        expect(g.checks()).toEqual([BOB, WITCH]);
        expect(g.glue.checkBinding.stats.encounterChecks).toBe(2);
    });

    it('⛔ NOT THE PLAN: a level-32 run whose flag never turns true checks nothing (a false report, a played-out goal)', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.report('hasFire', false);
        // the engine finishing its encounter goal reaches the glue as nothing at all: there is no plan input
        g.report('level', 30);
        expect(g.checks()).toEqual([]);
    });

    it('⛔ an ECHO of the host\'s own item write (an AP grant of Fire) is not the drop', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.adapter.expectedEchoValue.hasFire = true;
        expect(reportContext(g.adapter, 'hasFire', true)).toEqual({ level: 32, echo: true });
        g.report('hasFire', true);
        expect(g.checks()).toEqual([]);
        expect(g.glue.checkBinding.stats.encounterEchoes).toBe(1);
    });

    it('⛔ the flag turning true in ANOTHER level (Fire collected elsewhere) is not the encounter', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 30);
        g.report('hasFire', true);
        expect(g.checks()).toEqual([]);
        expect(g.glue.checkBinding.stats.encounterElsewhere).toBe(1);
    });

    it('once: a second flip (a reboot that re-set the flag) does not check again', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.report('hasFire', true);
        g.report('hasFire', false);
        g.report('hasFire', true);
        expect(g.checks()).toEqual([BOB]);
    });

    it('fail-closed: a report with no context (another caller) checks nothing', async () => {
        const b = await freshBinding();
        expect(b.onStateReport('hasFire', true)).toEqual([]);
    });

    it('the property path stands down on its own names for the two flags (`Fire`, `Dark Sword`): no undo of the drop', async () => {
        const g = glueWith(await freshBinding());
        const owned = g.adapter.setHostOwnedLocations.mock.calls.at(-1)[0];
        expect(owned.has('Fire')).toBe(true);
        expect(owned.has('Dark Sword')).toBe(true);
        // the encounter locations themselves are the binding's, not the property path's vocabulary
        expect(owned.has(BOB)).toBe(false);
        expect(owned.size).toBe(LOADED.table.size + 2);
    });
});

describe('4 · PERSISTENCE — a live arrival after a death in L32 ({32,1} cleared) is staged and SOLVED', () => {
    it('the staging carries {32,1}; the run builds the rock fallen; the encounter is mapped and solved (no arm leg)', () => {
        const src = atlasLevelSource();
        const records = new Map(indexLevels(readJson('./atlases/seedling-map.json')));
        // `stagingFromWasmArrival` copies `botStatus.persistence_cleared` into `persistence` EXACTLY (its witness row
        // `persistence = botStatus.persistence_cleared EXACTLY`); a death in the arena leaves {32,1} there.
        const staging = { ...tapeStaging('r5-bobboss-fire'), persistence: [{ level: 32, tag: 1 }] };
        const run = createRunForStaging(staging, src);
        expect(run.world.fallRocks.find((r) => r.thirdBoss)?.fallenAtBuild).toBe(true);
        const goal = resolveSeedlingAtlasGoal({ kind: 'location', name: BOB }, MAP).goal;
        const mapped = arrivalSolverGoal(goal, { staging, levelSource: src, record: src(32) });
        expect(mapped.goal?.kind).toBe('encounter');
        const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: src, records });
        const result = createInPlaceSolveService().start(request).result;
        expect(result.ok, result.message).toBe(true);
        expect(result.plan.verbs).not.toContain('arm');
        expect(result.plan.expected.at(-1).level).toBe(30);
    }, 180_000);
});
