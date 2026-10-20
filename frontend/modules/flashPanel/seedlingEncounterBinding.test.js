/**
 * ⛓⛓ ENCOUNTERS — the two encounter locations (L32's Bob Boss → Fire, L12's Witch → the dark sword) bound on the
 * live path (the JS arc's half of fidelity's wave-10 encounter executors):
 *
 *   1. BINDING   `vanillaArmPlaybackMap` binds each encounter row whose drop has an executor as
 *                `{location, level, kind: 'encounter', at, drop: {item}, flag}` — `at` off the playthrough atlas,
 *                `item` off the row; any other encounter row stays refused by name.
 *   2. MAPPING   `solverGoalFor` (and through it `wasmArrival.arrivalSolverGoal`) maps that goal to the solver's
 *                `encounter` goal, `then` off the level's control block.
 *   3. CHECK     ⛓ R4b part 2: the location's check is the `bossreport` build's CLEAR at the row's fixed address
 *                ((32,4) the Fire drop, (12,1) the dark sword) — a table row like any other; the old flag path
 *                (`hasFire` / `hasDarkSword` turning true) is retired: on that build only the host's grant sets them.
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
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';
import { ENCOUNTER_EXECUTORS } from '../seedlingDemo/solverBot.js';
import { solverGoalFor, createInPlaceSolveService } from '../seedlingDemo/jsRuntimeSolver.js';
import { arrivalSolveRequest, arrivalSolverGoal } from '../seedlingDemo/wasmArrival.js';
import { withContactFidelity } from '../seedlingDemo/contactFidelity.js';
import { createRunForStaging, solveStaging, stagingFromTape } from '../seedlingDemo/tapeRunner.js';
import { parseTape } from '../seedlingDemo/tapeFormat.js';
import { atlasLevelSource } from '../seedlingDemo/levelSource.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';
import { createJsRuntime } from '../seedlingDemo/jsRuntimeCore.js';
import { FlashBridgeAdapter } from './flashBridgeAdapter.js';

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

    it('L32 Bob Boss → {kind: encounter, at (80,128) — the delivered rock tile, rules-l32-rock-move — drop Fire}; L12 Witch → at (416,384), drop Progressive Sword', () => {
        expect(entryOf(BOB)).toEqual({ location: BOB, level: 32, kind: 'encounter', at: { x: 80, y: 128 },
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
            encounter: { at: { x: 80, y: 128 }, drop: { item: 'Fire' } } });
        expect(atlasLocationGoal(entryOf(BOB), BOB)).toEqual(r.goal);
        // a non-encounter entry's goal is unchanged
        const e = LOADED.entries[0];
        expect(atlasLocationGoal(e, e.location)).toEqual({ kind: 'location', level: e.level, tag: e.tag,
            entityType: e.entityType ?? null, name: e.location });
    });
});

describe('2 · MAPPING — `solverGoalFor` / `arrivalSolverGoal` → the solver\'s encounter goal', () => {
    const goalOf = (name) => resolveSeedlingAtlasGoal({ kind: 'location', name }, MAP).goal;

    it('L32 (a `fallthrough` room): then = reach-pit with apReportBosses OFF, null with it ON; L12: then = null — on the JS runtime\'s mapping', () => {
        const l32 = createRunForStaging(tapeStaging('r5-bobboss-fire'), atlasLevelSource());
        expect(withContactFidelity({ apReportBosses: false }, () => solverGoalFor(goalOf(BOB), { run: l32, resolved: null })))
            .toEqual({ goal: { kind: 'encounter', at: { x: 80, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' } });
        // ⛓ R7: ON, the Fire drop grants nothing and the moved rock frees the stairs — the encounter ends at the drop
        // and its report, and the route's NEXT goal leaves the room.
        expect(withContactFidelity({ apReportBosses: true }, () => solverGoalFor(goalOf(BOB), { run: l32, resolved: null })))
            .toEqual({ goal: { kind: 'encounter', at: { x: 80, y: 128 }, drop: { item: 'Fire' }, then: null } });
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
            // the ARENA reading is the OFF arm's (ON, no room asks for the pit — the row above)
            const m = withContactFidelity({ apReportBosses: false }, () => solverGoalFor({ kind: 'location', level, tag: null,
                encounter: { at: { x: 0, y: 0 }, drop: { item: 'Fire' } } }, { run, resolved: null }));
            if (m.goal.then === 'reach-pit') arenas.push(level);
        }
        expect(arenas).toEqual([32]);
        expect(createRunForStaging(tapeStaging('enc-l12-witch'), src).world.fallthrough).not.toBeNull();
    }, 120_000);

    it('the wasm runtime\'s `arrivalSolverGoal` maps the same goals from a staging (no entity looked up)', () => {
        const src = atlasLevelSource();
        const s32 = tapeStaging('r5-bobboss-fire');
        expect(withContactFidelity({ apReportBosses: false },
            () => arrivalSolverGoal(goalOf(BOB), { staging: s32, levelSource: src, record: src(32) }).goal))
            .toEqual({ kind: 'encounter', at: { x: 80, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });
        expect(withContactFidelity({ apReportBosses: true },
            () => arrivalSolverGoal(goalOf(BOB), { staging: s32, levelSource: src, record: src(32) }).goal))
            .toEqual({ kind: 'encounter', at: { x: 80, y: 128 }, drop: { item: 'Fire' }, then: null });
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
    const cleared = [];
    const adapter = { teleport: vi.fn(), onStateReport: null, setHostOwnedLocations: vi.fn(),
        gameState: { level: 0 }, expectedEchoValue: {},
        // ⛓ the game's cleared table, as `botStatus().persistence_cleared` reads it (the reconcile's source)
        _getFlash: () => ({ botStatus: () => JSON.stringify({ persistence_cleared: cleared }) }) };
    glue.attachAdapter(adapter);
    glue.setCheckBinding(binding);
    /** One game report, the way `FlashBridgeAdapter._onStateChanged` makes it (state first, then the hook). */
    const report = (property, value) => { adapter.gameState[property] = value; adapter.onStateReport(property, value); };
    const checks = () => published.filter((p) => p.name === 'user:locationCheck').map((p) => p.data.locationName);
    /** One persistence write the game makes: the slot cleared in its table, and (unless `lost`) the report. */
    const clear = (level, tag, { seq, lost = false } = {}) => {
        cleared.push({ level, tag });
        if (!lost) report('pendingCheck', `${seq}|${level}|${tag}|0`);
    };
    return { glue, adapter, report, checks, clear };
}
const freshBinding = async () => (await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel['1'], manifest: readJson('./wasm/builds.json'), rawRules: PT, locations: locationsOf(PT),
    playerId: '1', gameConfig: GAME_CONFIG, baseUrl: BASE,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
})).checkBinding;

describe('3 · CHECK — ⛓ R4b part 2: the fixed-address CLEAR, never the game\'s flag', () => {
    it('(32,4) checks Bob Boss (the Fire drop), (12,1) the Witch (the dark sword), (32,3) Times (the kill)', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.clear(32, 3, { seq: 1 });
        g.clear(32, 4, { seq: 2 });
        g.report('level', 12);
        g.clear(12, 1, { seq: 3 });
        expect(g.checks()).toEqual(['Level 032 - Times', BOB, WITCH]);
    });

    it('⛔ the RETIRED flag path: `hasFire` / `hasDarkSword` turning true checks NOTHING, in its own level or not', async () => {
        const g = glueWith(await freshBinding());
        g.report('level', 32);
        g.report('hasFire', true);
        g.report('level', 12);
        g.report('hasDarkSword', true);
        expect(g.checks()).toEqual([]);
    });

    it('once: a second clear of the same address (a re-entry, a tape replay) does not check again', async () => {
        const g = glueWith(await freshBinding());
        g.clear(32, 4, { seq: 1 });
        g.clear(32, 4, { seq: 2 });
        expect(g.checks()).toEqual([BOB]);
    });

    it('⛓ THE OWL: (112,0) and (112,1) cleared in one tick — only (112,1) is reported — and the Owl is still checked', async () => {
        const g = glueWith(await freshBinding());
        g.clear(112, 0, { lost: true });  // overwritten in the single report slot before the host polled
        g.clear(112, 1, { seq: 7 });      // the rocklock EVENT's slot, which reaches `pendingCheck`
        expect(g.checks()).toEqual(['Level 112 - Owl']);
        expect(g.glue.checkBinding.stats).toMatchObject({ reconcile: 1, reconcileReads: 1 });
    });

    it('the property path stands down on its own names for the two flags (`Fire`, `Dark Sword`): no undo of the grant', async () => {
        const g = glueWith(await freshBinding());
        const owned = g.adapter.setHostOwnedLocations.mock.calls.at(-1)[0];
        expect(owned.has('Fire')).toBe(true);
        expect(owned.has('Dark Sword')).toBe(true);
        // ⛓ R4b part 2 — the encounter locations are TABLE rows now
        expect(owned.has(BOB)).toBe(true);
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
        // ⛓ fidelity APFLIP D6 (`apReportBosses` ON at the R7 merge): the staging and the fallen rock are as before,
        // but R4's Fire drop grants NOTHING (the HOST grants it, APBOSSES H1). ⛓ R7: so `solverGoalFor` ends an
        // arena encounter at the drop and its report under the switch (`then: null`, as the campaign's `r9-solve-32`
        // and `enc-l32-*` tapes do) — it used to ask for `reach-pit` and was refused BY NAME at the burn.
        expect(mapped.goal.then).toBe(null);
        expect(result.ok, result.message).toBe(true);
    }, 180_000);
});

/**
 * ⛓ ENCOUNTERS-2 — the host never writes back a value the room grants. The adapter's clearing write ("every
 * location-mapped property no owned item backs → false") put `hasFire = false` / `hasDarkSword = false` into the
 * game while the drop's AP copy was on its way or held by the delivery gate (fidelity ENCOUNTERS2: a write at
 * t840 reproduces CI's t932 Bob Boss divergence to the bit; at t377 it leaves the Witch legs without the sword).
 * The REAL adapter, the SHIPPED config, the vanilla load's REAL host-owned set.
 *
 *   mutant: the clearing write restored on host-owned locations -> both rows below red
 */
describe('5 · THE HOST\'S OWN WRITES — no clearing write over an encounter\'s drop', () => {
    const adapterWith = (inventory, owned) => {
        const a = new FlashBridgeAdapter({ config: GAME_CONFIG, flashObjectId: `enc2-${Math.random()}`,
            stateManager: { getLatestStateSnapshot: () => ({ inventory }) },
            dispatcher: { publish: () => {} }, eventBus: { subscribe: () => () => {} }, log: () => {} });
        if (owned) a.setHostOwnedLocations(owned);
        return a;
    };
    const valueOf = (writes, property) => writes.find((w) => w.property === property)?.value;

    it('no AP item yet: the encounter flags are NOT cleared under the vanilla load; every other location property still is', async () => {
        const owned = (await freshBinding()).hostOwnedLocations();
        const writes = adapterWith({}, owned)._buildItemWritesFromInventory();
        expect(valueOf(writes, 'hasFire')).toBeUndefined();
        expect(valueOf(writes, 'hasDarkSword')).toBeUndefined();
        // control: the same adapter with nobody claiming a location clears both (the path every other game keeps)
        const control = adapterWith({}, null)._buildItemWritesFromInventory();
        expect(valueOf(control, 'hasFire')).toBe(false);
        expect(valueOf(control, 'hasDarkSword')).toBe(false);
        // and the vanilla load's other location properties keep their clearing write
        const others = GAME_CONFIG.locations.filter((l) => !['hasFire', 'hasDarkSword'].includes(l.property)).map((l) => l.property);
        expect(others.length).toBeGreaterThan(0);
        for (const p of others) expect(valueOf(writes, p)).toBe(valueOf(control, p));
    });

    it('the delivery GATE holds AP\'s Fire: the push writes nothing for hasFire (was `false`, the drop taken back mid-room)', async () => {
        const owned = (await freshBinding()).hostOwnedLocations();
        const a = adapterWith({ Fire: 1 }, owned);
        expect(valueOf(a._buildItemWritesFromInventory(), 'hasFire')).toBe(true);   // admitted: written true
        a.setItemGate((inv) => { const held = { ...inv }; delete held.Fire; return held; });
        expect(valueOf(a._buildItemWritesFromInventory(), 'hasFire')).toBeUndefined();
    });
});
