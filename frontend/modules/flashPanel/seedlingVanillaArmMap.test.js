/**
 * ⛓ VANILLA MAP — the Playback Bot's name → cell map for the VANILLA randomizer arm
 * (`seedling_playthrough`; walk plan §5.16).
 *
 * ⛔ THE FIXTURE IS THE PRODUCTION LOAD: `loadSeedlingRandomizer` over the shipped rules, the shipped
 * map document and record set, driven in node with an injected importer (the
 * `seedlingRandomizerWiring.test.js` arrangement). Every count below is read off that load or the rules —
 * none is typed — so a moved ledger row, a new sidecar or a new link is followed, not pinned.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    ENCOUNTER_REFUSAL,
    SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
    SeedlingPlaybackController,
    realRoomLinks,
    realRoomPlaybackMap,
    resolveSeedlingAtlasGoal,
    vanillaArmPlaybackMap,
} from './seedlingPlaybackController.js';
import { loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';
import { ATLAS_CHECK_PLAYER, ATLAS_ROOM_SUBSTRATE_ID } from '../seedlingDemo/seedlingAtlasCheckTable.js';
import { AP_ITEM_TYPE } from '../seedlingDemo/apPlacementRewriter.js';
import { loadWasmPlaybackEngine } from './seedlingWasmPlayback.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const BASE = pathToFileURL(abs('../../')).href;
const GAME_CONFIG = readJson('./games/seedling.json');
const MANIFEST = readJson('./wasm/builds.json');
const fetchJson = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));

const rulesOf = (preset) => readJson(`../../presets/${preset}/AP_1/AP_1_rules.json`);
const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const load = (rules, over = {}) => loadSeedlingRandomizer({
    flashPanel: rules.flash_panel, manifest: MANIFEST, rawRules: rules, locations: locationsOf(rules),
    playerId: Object.keys(rules.regions)[0], gameConfig: GAME_CONFIG, baseUrl: BASE, fetchJson,
    importModule: (u) => import(/* @vite-ignore */ u), ...over,
});

const PT = rulesOf('seedling_playthrough');
const LOADED = await load(PT);
const MAP = realRoomPlaybackMap(LOADED, PT);
const SIDECARS = PT.preset_sidecars[ATLAS_CHECK_PLAYER];
const realRegion = (r) => SIDECARS[r]?.substrate === ATLAS_ROOM_SUBSTRATE_ID;
const EXITS = Object.entries(PT.regions[ATLAS_CHECK_PLAYER])
    .flatMap(([region, r]) => (r.exits ?? []).map((e) => ({ region, ...e })));
const DOOR_NAMES = new Set(Object.values(SIDECARS).flatMap((s) => (s.playable_payload?.exits ?? [])
    .map((x) => x.exitName)).filter(Boolean));

describe('the vanilla arm\'s map — seedling_playthrough, every name accounted for', () => {
    it('the load is the VANILLA arm on wasm, and the map is built from it', () => {
        expect(LOADED.verdict, LOADED.why).toBe('eligible');
        expect(LOADED.arm).toBeUndefined();
        expect(LOADED.set?.rooms?.length).toBeGreaterThan(0);
        expect(MAP?.arm).toBe('vanilla');
    });

    it('every location: a goal at the DELIVERED apitem (the table\'s entries), or an encounter refused by name', () => {
        const locations = locationsOf(PT);
        const goals = [];
        const refused = [];
        for (const [name, loc] of locations) {
            const r = resolveSeedlingAtlasGoal({ kind: 'location', name }, MAP, { region: loc.region });
            (r.goal ? goals : refused).push({ name, ...r });
        }
        expect(goals.length + refused.length).toBe(locations.size);
        expect(goals.map((g) => g.name).sort()).toEqual(LOADED.entries.map((e) => e.location).sort());
        // ⛔ The game plays the REWRITE: each goal names the entity the delivered room holds — the rewriter's
        // own type — at the table's (level, tag); the map document's vanilla type would not be found there.
        for (const g of goals) {
            const e = LOADED.entries.find((x) => x.location === g.name);
            expect(g.goal).toEqual({ kind: 'location', level: e.level, tag: e.tag, entityType: AP_ITEM_TYPE, name: g.name });
        }
        expect(refused.map((r) => r.name).sort()).toEqual(LOADED.encounters.map((e) => e.location).sort());
        for (const r of refused) {
            const enc = LOADED.encounters.find((e) => e.location === r.name);
            expect(r.refused).toBe(`"${r.name}" is a location the vanilla arm's map did NOT bind — ${ENCOUNTER_REFUSAL(enc)}`);
        }
    });

    it('every exit: a door → its sidecar exit_tiles; a same-level sub-region link → a LINK (credited, §5.17); nothing else but the Menu', () => {
        const tally = { door: 0, link: 0, other: [] };
        for (const exit of EXITS) {
            const r = resolveSeedlingAtlasGoal({ kind: 'exit', name: exit.name }, MAP, { region: exit.region });
            if (r.goal) {
                expect(DOOR_NAMES.has(exit.name), exit.name).toBe(true);
                expect(r.goal.tiles.length, exit.name).toBeGreaterThan(0);
                expect(r.goal.level).toBe(SIDECARS[exit.region].playable_payload.level);
                tally.door += 1;
            } else if (realRegion(exit.region) && realRegion(exit.connected_region)
                && SIDECARS[exit.region].playable_payload.level === SIDECARS[exit.connected_region].playable_payload.level) {
                const link = MAP.links.find((l) => l.name === exit.name);
                // ⛓ LOGICAL LINKS (§5.17) — answered as the link itself; the controller asks the binding to credit it.
                expect(r.link).toBe(link);
                tally.link += 1;
            } else {
                tally.other.push({ region: exit.region, name: exit.name, refused: r.refused });
            }
        }
        expect(tally.door).toBe([...DOOR_NAMES].filter((n) => EXITS.some((e) => e.name === n)).length);
        expect(tally.link).toBe(MAP.links.length);
        expect(tally.door + tally.link + tally.other.length).toBe(EXITS.length);
        // The only exit out of a non-room region: the AP origin (Menu → the start room), never walked.
        expect(tally.other.every((o) => !realRegion(o.region))).toBe(true);
        expect(tally.other.map((o) => o.refused)).toEqual(tally.other.map((o) => `"${o.name}" is not an exit of the atlas rooms`));
    });

    it('a link is DERIVED: both ends real rooms of one level, and no sidecar door of that name', () => {
        const regions = MAP.regions;
        expect(MAP.links.length).toBeGreaterThan(0);
        for (const l of MAP.links) {
            expect(regions.get(l.from).level).toBe(l.level);
            expect(regions.get(l.to).level).toBe(l.level);
            expect(DOOR_NAMES.has(l.name)).toBe(false);
        }
        expect(realRoomLinks(PT, regions)).toEqual(MAP.links);
    });
});

describe('the mutants\' rows', () => {
    it('THE MAP NOT BOUND: the panel\'s one decision binds a map for the vanilla arm (null was "no name → cell map")', () => {
        expect(realRoomPlaybackMap(LOADED, PT)).not.toBeNull();
        expect(realRoomPlaybackMap(LOADED, PT).entries.length).toBe(LOADED.entries.length);
        // …and none for a refused load, or the generated arm (that map is the other instance's report).
        expect(realRoomPlaybackMap({ ...LOADED, eligibility: { eligible: false } }, PT)).toBeNull();
        expect(realRoomPlaybackMap({ ...LOADED, arm: 'generated' }, PT)).toBeNull();
    });

    it('AN EXIT WITHOUT TILES is refused by name, never handed over as a goal with nothing to walk onto', () => {
        const door = EXITS.find((e) => DOOR_NAMES.has(e.name));
        const regions = new Map([...MAP.regions].map(([id, p]) => [id, id !== door.region ? p
            : { ...p, exits: p.exits.map((x) => (x.exitName === door.name ? { ...x, exit_tiles: [] } : x)) }]));
        const r = resolveSeedlingAtlasGoal({ kind: 'exit', name: door.name }, { ...MAP, regions }, { region: door.region });
        expect(r).toEqual({ refused: `the atlas exit "${door.name}" marks no exit tiles to walk onto` });
    });

    it('an entry the DELIVERED room does not hold is refused by name (the rewrite did not land)', () => {
        const [first] = LOADED.entries;
        const set = { ...LOADED.set, rooms: LOADED.set.rooms.map((room) => (room.id !== first.level ? room
            : { ...room, source: { record: { ...room.source.record, entities: room.source.record.entities
                .filter((e) => !(e.x === first.entity.x && e.y === first.entity.y)) } } })) };
        const map = vanillaArmPlaybackMap({ entries: LOADED.entries, encounters: [], set, regions: MAP.regions, rules: PT });
        expect(map.entries.some((e) => e.location === first.location)).toBe(false);
        expect(map.refused.find((x) => x.location === first.location)?.why)
            .toBe(`the delivered level ${first.level} holds no entity with tag ${first.tag} at (${first.entity.x}, `
                + `${first.entity.y}) — the rewrite did not land there`);
    });
});

describe('the atlas arm keeps its map (J3), and gains only the links', () => {
    it('seedling_atlas: the same entries/refused/regions as before, plus its own sub-region links', async () => {
        const rules = rulesOf('seedling_atlas');
        const loaded = await load(rules);
        expect(loaded.arm).toBe('atlas');
        const map = realRoomPlaybackMap(loaded, rules);
        expect(map.entries).toBe(loaded.entries);
        expect(map.refused).toBe(loaded.refused);
        expect([...map.regions.keys()].sort()).toEqual(Object.keys(rules.preset_sidecars['1'])
            .filter((r) => rules.preset_sidecars['1'][r].substrate === ATLAS_ROOM_SUBSTRATE_ID).sort());
        expect(map.links.length).toBeGreaterThan(0);
        for (const l of map.links) {
            expect(resolveSeedlingAtlasGoal({ kind: 'exit', name: l.name }, map).link).toBe(l);
        }
    });
});

describe('the wasm engine stages the DELIVERED rooms (solver flow)', () => {
    it('the controller loads the engine with the surface\'s delivered set, and hands it the apitem goal', async () => {
        const goals = [];
        const loads = [];
        const engine = { walkTo: (g) => { goals.push(g); return { ok: true }; }, liveLevel: () => 0, stop() {},
            status: () => ({ phase: 'idle', goal: null }), dispose() {} };
        const game = { botStatus() {} };
        const surface = { transport: 'wasm', setting: 'auto', atlas: MAP, region: null,
            wasm: { getGame: () => game, getWin: () => null, teleport: () => true, mapPath: 'm.json', deliveredSet: LOADED.set } };
        const c = new SeedlingPlaybackController({ getSurface: () => surface, substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE,
            resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true,
            wasmDeliveredSetOf: (s) => s?.wasm?.deliveredSet ?? null,
            timers: { setInterval: () => 1, clearInterval: () => {} },
            loadWasmEngine: async (d) => { loads.push(d); return engine; } });
        const [first] = LOADED.entries;
        expect(c.walkTo({ kind: 'location', name: first.location })).toBe(true);
        await new Promise((r) => { setTimeout(r, 0); });
        expect(loads).toHaveLength(1);
        expect(loads[0].deliveredSet).toBe(LOADED.set);
        expect(c.walkTo({ kind: 'location', name: first.location })).toBe(true);
        expect(goals.at(-1)).toMatchObject({ level: first.level, tag: first.tag, entityType: AP_ITEM_TYPE });
    });

    it('the engine loader: a delivered set is the rooms (no map fetched) and the engine stays a SOLVER engine', async () => {
        let fetched = 0;
        const engine = await loadWasmPlaybackEngine({ mapPath: 'never.json', deliveredSet: LOADED.set, baseUrl: BASE,
            fetchImpl: async () => { fetched += 1; throw new Error('no fetch'); }, getGame: () => null, teleport: () => false,
            timers: { setTimeout: () => 0, clearTimeout: () => {} } });
        expect(fetched).toBe(0);
        expect(engine.generated).toBe(false);
        engine.dispose();
    });
});

describe('⛓ §5.18 — the JS runtime TAKES the vanilla arm; a load that binds no map is still heard at once', () => {
    it('the load on js is the vanilla arm and binds the SAME map as on wasm (the map is arm-, not transport-keyed)', async () => {
        const js = await load(PT, { transport: 'js', manifest: null });
        expect(js.verdict, js.why).toBe('eligible');
        expect(js.eligibility.arm).toBe('vanilla');
        expect(js.set.set_id).toBe(LOADED.set.set_id);
        const map = realRoomPlaybackMap(js, PT);
        expect(map?.arm).toBe('vanilla');
        expect(JSON.stringify(map)).toBe(JSON.stringify(MAP));
    });

    it('a load refused by name (here: the flash transport) — the controller refuses by that reason, not a 60 s hold', async () => {
        const refused = await load(PT, { transport: 'flash', manifest: null });
        expect(refused.eligibility.eligible).toBe(false);
        expect(refused.why).toMatch(/^transport: /);
        expect(realRoomPlaybackMap(refused, PT)).toBeNull();
        const page = { walkTo: () => ({ ok: true }) };
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'js', atlas: null, apRefusal: refused.why, jsRuntime: { playback: page } }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas,
            timers: { setInterval: () => { throw new Error('a refusal is never held'); }, clearInterval: () => {} } });
        expect(c.walkTo({ kind: 'location', name: LOADED.entries[0].location })).toBe(false);
        expect(c.lastRefusal).toBe(`no name → cell map for the atlas rooms: the AP placement load bound none — ${refused.why}`);
    });

    it('while the load is still running (no refusal yet) the goal is HELD as before', () => {
        let held = 0;
        const c = new SeedlingPlaybackController({
            getSurface: () => ({ transport: 'wasm', atlas: null, apRefusal: null, wasm: { getGame: () => null } }),
            substrate: SEEDLING_ATLAS_PLAYBACK_SUBSTRATE, resolve: resolveSeedlingAtlasGoal, mapOf: (s) => s.atlas, wasm: true,
            timers: { setInterval: () => { held += 1; return 1; }, clearInterval: () => {} } });
        expect(c.walkTo({ kind: 'location', name: LOADED.entries[0].location })).toBe(true);
        expect(held).toBe(1);
    });
});
