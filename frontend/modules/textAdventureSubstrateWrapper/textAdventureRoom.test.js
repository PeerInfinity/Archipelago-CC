/**
 * textAdventureRoom — **THE TEXT ADVENTURE'S OWN ROOM HOOKS, DRIVEN** (⛓ PRESET
 * SIDECARS G2a, Route P).
 *
 * Per hook over a spec with gates; then through the ENGINE on the three
 * branches a text-adventure region takes: top-down (the committed
 * `procgen_topdown` AP_10–12's driver, over the Adventure source they are
 * built from), the REBUILD path (`rebuildEnvelopeFromRulesJson`, where the
 * maze's BFS used to answer), and the shuffled spiral (the `tasw-*` in-app
 * rows' config).
 *
 * ⛔ The document rules are compared against the SOURCE document's own, read
 * off disk — never against a rule typed here.
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import {
    TEXT_ADVENTURE_ROOM_REFUSALS,
    deserializeTextAdventureRoom,
    textAdventureRoomRefusal,
    extractTextAdventureRules,
    generateTextAdventureRoom,
    placeTextAdventureItems,
    placeTextAdventureRules,
    serializeTextAdventureRoom,
} from './textAdventureRoom.js';
import {
    DEFAULT_REGION_SIZE,
    arrangeShuffledSpiral,
    buildRulesJson,
    rebuildEnvelopeFromRulesJson,
    topDownFromRulesJson,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { TEXT_ADVENTURE_CONCEPT_REALISATIONS as TA_REAL } from './textAdventureConceptRealisations.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TRUE = { rule: 'True_' };
/** The keys a tile-grid payload / world carries and a room never does. */
const TILE_KEYS = ['tiles', 'width', 'height', 'entrance', 'obstacles', 'items', 'obstacleLib', 'itemLib',
    'longestShortestPath'];

/** An rng that REFUSES to be drawn — a room has nothing to roll. */
const noDrawRng = () => ({ next() { throw new Error('a text adventure room drew from the rng'); } });

const GATE_A = { rule: 'Has', args: { item_name: 'Yellow Key' } };
const GATE_B = { rule: 'HasAll', args: { item_names: ['Black Key', 'Bridge'] } };
const LOC_GATE = { rule: 'Has', args: { item_name: 'Sword' } };

/** Two gated exits, one open exit; three locations (one gated, one True_, one item-only). */
function gatedRoom() {
    const core = generateTextAdventureRoom({
        region_id: 'Hall',
        size: { width: 8, height: 6 },
        entrances: [{ side: 'S', tile: { x: 4, y: 5 } }],
        exits: [
            { exit_id: 'North', exitName: 'North', side: 'N', targetRegion: 'Tower' },
            { exit_id: 'East', exitName: 'East', side: 'E', targetRegion: 'Vault' },
            { exit_id: 'Down', exitName: 'Down', side: 'S', targetRegion: 'Cellar' },
        ],
        rng: noDrawRng(),
    });
    const placement = placeTextAdventureRules(core.world, {
        exit_rules: { North: GATE_A, East: GATE_B, Down: TRUE },
        location_rules: { 'Slay Dragon': LOC_GATE, 'Open Chest': TRUE },
        item_placements: [
            { item_id: 'Black Key', location_id: 'Slay Dragon' },
            { item_id: 'Bridge', location_id: 'Open Chest' },
            { item_id: 'Sword', location_id: 'Pick Up Sword' },
        ],
        rng: noDrawRng(),
    });
    return { core, placement };
}

describe('the room core (`generateRegionCore`)', () => {
    it('places every requested exit on its requested SIDE — no tile, no entrance, no location, no rng draw', () => {
        const { core } = gatedRoom();
        expect([...core.world.exits.keys()]).toEqual(['North', 'East', 'Down']);
        expect(core.world.exits.get('East')).toEqual({
            exit_id: 'East', side: 'E', exitName: 'East', targetRegion: 'Vault',
            isBackExit: false, isTeleporter: false, access_rule: GATE_B,
        });
        expect(core.exits_placed).toEqual([
            { exit_id: 'North', side: 'N' }, { exit_id: 'East', side: 'E' }, { exit_id: 'Down', side: 'S' },
        ]);
        for (const k of TILE_KEYS) expect(core.world).not.toHaveProperty(k);
        for (const e of core.world.exits.values()) {
            expect(e).not.toHaveProperty('x');
            expect(e).not.toHaveProperty('y');
        }
    });

    it("a side-less exit takes the FREE sides clockwise (the zone generator's law), then cycles `SIDES`", () => {
        const exits = [{ side: 'E' }, {}, {}, {}, {}, {}];
        const { world } = generateTextAdventureRoom({ region_id: 'R', exits, rng: noDrawRng() });
        const free = SIDES.filter((s) => s !== 'E');
        expect([...world.exits.values()].map((e) => e.side)).toEqual(['E', ...free, SIDES[0], SIDES[1]]);
        // the maze's default ids, so a region's exit names do not move with its substrate
        expect([...world.exits.keys()]).toEqual(['exit_0', 'exit_1', 'exit_2', 'exit_3', 'exit_4', 'exit_5']);
        expect([...generateTextAdventureRoom({ region_id: 'R', exits: [{ side: 'N' }] }).world.exits.keys()])
            .toEqual(['exit']);
    });

    it('refuses by SENTENCE: no region id, an exit requested twice, a rule naming an exit the room lacks', () => {
        expect(() => generateTextAdventureRoom({ exits: [] })).toThrow(TEXT_ADVENTURE_ROOM_REFUSALS.noRegionId());
        expect(() => generateTextAdventureRoom({ region_id: 'R', exits: [{ exit_id: 'a', side: 'N' }, { exit_id: 'a', side: 'S' }] }))
            .toThrow(TEXT_ADVENTURE_ROOM_REFUSALS.duplicateExit('R', 'a'));
        const { world } = generateTextAdventureRoom({ region_id: 'R', exits: [{ exit_id: 'a', side: 'N' }] });
        expect(() => placeTextAdventureRules(world, { exit_rules: { b: GATE_A } }))
            .toThrow(TEXT_ADVENTURE_ROOM_REFUSALS.unknownExit('R', 'b'));
    });
});

describe('the placers and the extractor, over a spec with gates', () => {
    it('`placeFromRules` records each AUTHORED rule on its exit / location (`True_` as absent), no tile', () => {
        const { core, placement } = gatedRoom();
        expect(core.world.exits.get('North').access_rule).toEqual(GATE_A);
        expect(core.world.exits.get('Down')).not.toHaveProperty('access_rule');
        expect(core.world.locations).toEqual([
            { id: 'Slay Dragon', item: 'Black Key', access_rule: LOC_GATE },
            { id: 'Open Chest', item: 'Bridge' },
            { id: 'Pick Up Sword', item: 'Sword' },
        ]);
        expect(placement.placed_locations).toEqual(
            [{ location_id: 'Slay Dragon' }, { location_id: 'Open Chest' }, { location_id: 'Pick Up Sword' }]);
        expect(placement.placed_logic_gates).toEqual([]);
        expect(placement.placed_items.map((p) => p.location_id)).toEqual(['Slay Dragon', 'Open Chest', 'Pick Up Sword']);
    });

    it("the extractor emits the spec's rules verbatim, `True_` where none — and never shares an object with the room", () => {
        const { core } = gatedRoom();
        const extracted = extractTextAdventureRules(core.world, { regionId: 'Hall' });
        expect(extracted).toEqual({
            region_id: 'Hall',
            exits: [
                { id: 'North', target_region: 'Tower', access_rule: GATE_A },
                { id: 'East', target_region: 'Vault', access_rule: GATE_B },
                { id: 'Down', target_region: 'Cellar', access_rule: TRUE },
            ],
            locations: [
                { id: 'Slay Dragon', item: 'Black Key', access_rule: LOC_GATE },
                { id: 'Open Chest', item: 'Bridge', access_rule: TRUE },
                { id: 'Pick Up Sword', item: 'Sword', access_rule: TRUE },
            ],
        });
        extracted.exits[0].access_rule.args.item_name = 'MUTATED';
        expect(core.world.exits.get('North').access_rule).toEqual(GATE_A);
    });

    it('`placeFromItems` makes each item a location named the maze\'s way, de-duplicated, and places NO obstacle', () => {
        const { world } = generateTextAdventureRoom({ region_id: 'R', exits: [{ side: 'N' }] });
        const out = placeTextAdventureItems(world, {
            items_to_place: ['key_red', 'key_red', 'victory'], obstacles_to_place: ['door_red'], rng: noDrawRng(),
        });
        expect(world.locations.map((l) => l.id)).toEqual(['key_red_pickup', 'key_red_pickup_2', 'victory_pickup']);
        expect(out.placed_obstacles).toEqual([]);
        expect(out.placed_items).toEqual([
            { item_id: 'key_red', location_id: 'key_red_pickup' },
            { item_id: 'key_red', location_id: 'key_red_pickup_2' },
            { item_id: 'victory', location_id: 'victory_pickup' },
        ]);
    });
});

describe('the payload (`serializeWorld` ⇄ `deserializeWorld`)', () => {
    it('carries the sided exits, the gates beside them, and the locations by AP name — no tile key', () => {
        const { core } = gatedRoom();
        const extracted = extractTextAdventureRules(core.world, { regionId: 'Hall' });
        extracted.locations[0].global_name = 'Slay Dragon';
        const payload = serializeTextAdventureRoom(core.world, extracted);
        expect(Object.keys(payload)).toEqual(['exits', 'exitGates', 'locations']);
        expect(payload.exits[0]).toEqual({
            exit_id: 'North', side: 'N', exitName: 'North', targetRegion: 'Tower', targetExitId: null,
            isBackExit: false, isTeleporter: false,
        });
        expect(payload.exitGates).toEqual({ North: GATE_A, East: GATE_B });
        // a location with no global_name gets the engine's AP name for a tile-free location
        expect(payload.locations).toEqual([
            { name: 'Slay Dragon', item: 'Black Key', access_rule: LOC_GATE },
            { name: 'Hall__Open Chest', item: 'Bridge' },
            { name: 'Hall__Pick Up Sword', item: 'Sword' },
        ]);
    });

    it('round-trips byte-identically, and each direction is a CLONE (M2\'s mutant H)', () => {
        const { core } = gatedRoom();
        const payload = serializeTextAdventureRoom(core.world, extractTextAdventureRules(core.world, { regionId: 'Hall' }));
        const before = JSON.stringify(payload);
        const world = deserializeTextAdventureRoom(payload);
        expect(world.exits).toBeInstanceOf(Map);
        expect(world.exits.get('East').access_rule).toEqual(GATE_B);
        world.exits.get('East').side = 'W';
        world.exits.get('East').access_rule.args.item_names.push('MUTATED');
        world.locations[0].name = 'MUTATED';
        expect(JSON.stringify(payload)).toBe(before);
        const again = deserializeTextAdventureRoom(payload);
        const reserialized = serializeTextAdventureRoom(again, extractTextAdventureRules(again, { regionId: 'Hall' }));
        expect(JSON.stringify(reserialized)).toBe(before);
        reserialized.exitGates.North.args.item_name = 'MUTATED';
        expect(again.exits.get('North').access_rule).toEqual(GATE_A);
    });

    /**
     * ⛓ G2a-fix — play reads `manaEnabled` off the WORLD (`procgenPlayer.
     * getRegionInfo` → `mana.js`), so the deserializer carries it: the maze's
     * law, `true` → `true`, anything else → ABSENT (never `false`). The
     * committed witness is read off the file, never typed.
     */
    it('⛓ carries the payload\'s `manaEnabled: true` onto the world — absent (not `false`) without it; the '
        + 'committed jta_mixed_test AdventureZone deserializes mana-enabled', () => {
        const { core } = gatedRoom();
        const payload = serializeTextAdventureRoom(core.world, extractTextAdventureRules(core.world, { regionId: 'Hall' }));
        expect('manaEnabled' in deserializeTextAdventureRoom(payload)).toBe(false);
        expect('manaEnabled' in deserializeTextAdventureRoom({ ...payload, manaEnabled: false })).toBe(false);
        expect(deserializeTextAdventureRoom({ ...payload, manaEnabled: true }).manaEnabled).toBe(true);
        // the serializer is unchanged: the flag is the engine's to stamp on the envelope
        const world = deserializeTextAdventureRoom({ ...payload, manaEnabled: true });
        expect(Object.keys(serializeTextAdventureRoom(world, extractTextAdventureRules(world, { regionId: 'Hall' }))))
            .toEqual(['exits', 'exitGates', 'locations']);

        const committed = JSON.parse(fs.readFileSync(join(ROOT, 'frontend/presets/jta_mixed_test/AP_1/AP_1_rules.json'), 'utf-8'));
        const az = committed.preset_sidecars['1'].AdventureZone;
        expect(az.substrate).toBe(substrateRegistryEntry.id);
        expect(az.playable_payload.manaEnabled).toBe(true);
        expect(substrateRegistryEntry.deserializeWorld(az.playable_payload).manaEnabled).toBe(true);
    });

    /**
     * ⛔ ONE FORMAT (⚖ the user, 2026-09-13: no support for the old format). The
     * fixture is INLINE — the tile-grid payload `generate-jta-mixed-test-preset.py`
     * wrote before the re-record, verbatim — because every committed payload is a
     * room now: a row that read its "legacy" fixture off the corpus went VACUOUS at
     * the re-record (plan §24.7 #29, proven by a mutant).
     */
    it('⛔ REFUSES a tile-grid payload (the format written before G2a) with a sentence naming its keys', () => {
        const legacy = {
            width: 8, height: 6, tiles: new Array(48).fill(0), entrance: { x: 4, y: 3 },
            exits: [{ exit_id: 'ToJtaZone1', x: 7, y: 3, side: 'E', exitName: 'ToJtaZone1', targetRegion: 'JtaZone1',
                targetExitId: 'FromAdventure', isBackExit: false, isTeleporter: false }],
            obstacles: [], items: [], obstacleLib: {}, itemLib: {}, longestShortestPath: 1,
            fogEnabled: false, manaEnabled: true,
        };
        const refusal = textAdventureRoomRefusal(legacy);
        expect(refusal).toMatch(/^this payload is not a text-adventure room — /);
        for (const key of ['width', 'height', 'tiles', 'obstacles', 'items', 'obstacleLib', 'itemLib', 'longestShortestPath',
            'exitGates', 'locations']) {
            expect(refusal).toContain(`\`${key}\``);
        }
        // `entrance` / `manaEnabled` / `fogEnabled` are ENVELOPE fields: carried, not refused
        expect(refusal).not.toContain('`entrance`');
        expect(() => deserializeTextAdventureRoom(legacy)).toThrow(refusal);
        expect(() => substrateRegistryEntry.deserializeWorld(legacy)).toThrow(refusal);
        expect(() => deserializeTextAdventureRoom(undefined)).toThrow(/not an object/);
        // …and the room the script writes NOW is read, not refused
        const committed = JSON.parse(fs.readFileSync(join(ROOT, 'frontend/presets/jta_mixed_test/AP_1/AP_1_rules.json'), 'utf-8'));
        const payload = committed.preset_sidecars['1'].AdventureZone.playable_payload;
        expect(textAdventureRoomRefusal(payload)).toBeNull();
        expect([...deserializeTextAdventureRoom(payload).exits.keys()]).toEqual(['ToJtaZone1']);
    });
});

/**
 * ⛓ CONCEPT LIBRARY T2, D1 — **THE `prose` FIELD.** A per-region slice of the
 * per-game file's shape, written only when the room says something (⇒ every
 * payload built without it keeps its three keys), keyed by `exit_id` and by the
 * location's AP NAME, declared in `sidecarFields`, and carried onto the world.
 */
describe('the `prose` field (concept library T2, D1)', () => {
    const MOVE = 'You pass on to {destinationRegion}.';
    const BLOCKED = 'Something bars the way to {destinationRegion}.';
    const CHECK = 'You find {item} here.';
    const fields = sidecarFieldsOf(substrateRegistryEntry);

    it('a room with no prose (or only empty prose) serializes WITHOUT the key', () => {
        const { core } = gatedRoom();
        const ex = () => extractTextAdventureRules(core.world, { regionId: 'Hall' });
        expect(Object.keys(serializeTextAdventureRoom(core.world, ex()))).toEqual(['exits', 'exitGates', 'locations']);
        core.world.prose = { exits: { North: {} }, locations: {} };
        expect(Object.keys(serializeTextAdventureRoom(core.world, ex()))).toEqual(['exits', 'exitGates', 'locations']);
    });

    it('writes exits by `exit_id` and locations by AP NAME, round-trips, and holds its declaration', () => {
        const { core } = gatedRoom();
        core.world.prose = {
            exits: { North: { inaccessibleMessage: BLOCKED, moveMessage: MOVE } },
            locations: { 'Pick Up Sword': { checkMessage: CHECK } },
        };
        const payload = serializeTextAdventureRoom(core.world, extractTextAdventureRules(core.world, { regionId: 'Hall' }));
        expect(Object.keys(payload)).toEqual(['exits', 'exitGates', 'locations', 'prose']);
        expect(payload.prose).toEqual({
            exits: { North: { moveMessage: MOVE, inaccessibleMessage: BLOCKED } },
            locations: { 'Hall__Pick Up Sword': { checkMessage: CHECK } },
        });
        expect(payload.locations.map((l) => l.name)).toContain('Hall__Pick Up Sword');
        expect(sidecarPayloadErrors(fields, { ...payload, fogEnabled: true })).toEqual([]);
        expect(textAdventureRoomRefusal(payload)).toBeNull();

        const world = deserializeTextAdventureRoom(payload);
        expect(world.prose).toEqual(payload.prose);
        world.prose.exits.North.moveMessage = 'MUTATED';
        expect(payload.prose.exits.North.moveMessage).toBe(MOVE); // a clone
        const again = deserializeTextAdventureRoom(payload);
        const reserialized = serializeTextAdventureRoom(again, extractTextAdventureRules(again, { regionId: 'Hall' }));
        expect(JSON.stringify(reserialized)).toBe(JSON.stringify(payload));
    });

    it('the declaration refuses a message kind the per-game file does not have, and an empty message', () => {
        const { core } = gatedRoom();
        const payload = serializeTextAdventureRoom(core.world, extractTextAdventureRules(core.world, { regionId: 'Hall' }));
        const errs = (prose) => sidecarPayloadErrors(fields, { ...payload, fogEnabled: true, prose });
        expect(errs({ exits: { North: { checkMessage: CHECK } }, locations: {} }).map((e) => e.field)).toEqual(['prose']);
        expect(errs({ exits: {}, locations: { X: { moveMessage: MOVE } } }).map((e) => e.field)).toEqual(['prose']);
        expect(errs({ exits: {}, locations: {}, enterMessage: '' }).map((e) => e.field)).toEqual(['prose']);
        expect(errs({ exits: {}, locations: {}, lore: 'x' }).map((e) => e.field)).toEqual(['prose']);
        expect(errs({ enterMessage: 'You arrive.', exits: {}, locations: {} })).toEqual([]);
    });
});

/**
 * ⛓ CONCEPT LIBRARY T2, D3 — **THE RULE SELECTS A REALISATION, AND THE ROOM
 * SPEAKS IT.** A guardian-gated exit (`Has(Progressive Sword)`) and a
 * water-gated one (`Has(Progressive Swim)`) carry their concept's two
 * messages; a plain-rule exit carries none; the recorded rule is the same
 * with or without; and no offered concept ⇒ no `prose` at all.
 */
describe('concept realisations in `placeFromRules` (concept library T2, D3)', () => {
    const SWORD = { rule: 'Has', args: { item_name: 'Progressive Sword' } };
    const SWIM = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
    const G = TA_REAL.guardian.placements.gate.mechanic.prose;
    const W = TA_REAL.water.placements.gate.mechanic.prose;
    const OFFERED = ['sword', 'swim', 'guardian', 'water'];

    function conceptRoom(concepts) {
        const core = generateTextAdventureRoom({
            region_id: 'Keep',
            exits: [
                { exit_id: 'Gate', side: 'N', targetRegion: 'Throne' },
                { exit_id: 'Moat', side: 'E', targetRegion: 'Garden' },
                { exit_id: 'Door', side: 'W', targetRegion: 'Vault' },
                { exit_id: 'Out', side: 'S', targetRegion: 'Yard' },
            ],
        });
        placeTextAdventureRules(core.world, {
            exit_rules: { Gate: SWORD, Moat: SWIM, Door: GATE_A, Out: TRUE },
            location_rules: { 'Rack': TRUE },
            item_placements: [
                { item_id: 'Progressive Sword', location_id: 'Rack' },
                { item_id: 'Yellow Key', location_id: 'Shelf' },
            ],
            rng: noDrawRng(),
            ...(concepts === undefined ? {} : { params: { concepts } }),
        });
        return core.world;
    }
    const payloadOf = (world) => serializeTextAdventureRoom(world, extractTextAdventureRules(world, { regionId: 'Keep' }));

    it("a guardian-gated exit's payload carries BOTH messages, a water-gated one its own, a plain rule none", () => {
        const payload = payloadOf(conceptRoom(OFFERED));
        expect(payload.prose.exits).toEqual({
            Gate: { inaccessibleMessage: G.blocked, moveMessage: G.passedWith },
            Moat: { inaccessibleMessage: W.blocked, moveMessage: W.passedWith },
        });
        // the sword's location speaks the sword's prose (keyed by its AP name); the key's says nothing
        expect(payload.prose.locations).toEqual({ Keep__Rack: { checkMessage: TA_REAL.sword.prose.checkMessage } });
        expect(sidecarPayloadErrors(sidecarFieldsOf(substrateRegistryEntry), { ...payload, fogEnabled: true })).toEqual([]);
    });

    it('the recorded RULE is unchanged either way — exits, gates and locations are byte-identical', () => {
        const withC = payloadOf(conceptRoom(OFFERED));
        const without = payloadOf(conceptRoom(undefined));
        const { prose, ...rest } = withC;
        expect(prose).toBeDefined();
        expect(JSON.stringify(rest)).toBe(JSON.stringify(without));
        expect(without.exitGates).toEqual({ Gate: SWORD, Moat: SWIM, Door: GATE_A });
    });

    it('⛔ no offered concept (absent or empty) ⇒ no `prose` key — a world that lists none is what it was', () => {
        expect(Object.keys(payloadOf(conceptRoom(undefined)))).toEqual(['exits', 'exitGates', 'locations']);
        expect(Object.keys(payloadOf(conceptRoom([])))).toEqual(['exits', 'exitGates', 'locations']);
        // only what is offered: guardian without water speaks at the Gate only, and no item prose
        const partial = payloadOf(conceptRoom(['guardian']));
        expect(Object.keys(partial.prose.exits)).toEqual(['Gate']);
        expect(partial.prose.locations).toEqual({});
    });
});

/** The Adventure source AP_11 is built from, and its sphere log (the driver's own inputs). */
function adventureSource(seedId) {
    const dir = join(ROOT, 'frontend/presets/adventure', seedId);
    const source = JSON.parse(fs.readFileSync(join(dir, `${seedId}_rules.json`), 'utf-8'));
    const sphereLog = fs.readFileSync(join(dir, `${seedId}_sphere_log.jsonl`), 'utf-8')
        .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
    return { source, sphereLog };
}

/** `{exits: {name: rule}, locations: {name: rule}}` of one document region. */
const rulesOf = (region) => ({
    exits: Object.fromEntries((region.exits ?? []).map((e) => [e.name, e.access_rule])),
    locations: Object.fromEntries((region.locations ?? []).map((l) => [l.name, l.access_rule])),
});

describe('through the engine — top-down, the rebuild path, the spiral', () => {
    // `generate-topdown-preset.js`'s own call for AP_11 (`generated_commands.sh`): seed 11, the maze +
    // text adventure mix, the sibling sphere log, its default region size and auto grid.
    const SEED = 11;
    const { source, sphereLog } = adventureSource('AP_01043188731678011336');
    const n = Object.keys(source.regions['1']).length;
    const dim = Math.max(3, Math.ceil(Math.sqrt(n * 1.5)));
    const built = topDownFromRulesJson(source, {
        gridDims: { width: dim, height: dim }, regionSizeBase: { width: 8, height: 6 }, seed: SEED,
        substrateMix: { maze: 1, text_adventure: 1 }, sphereLog,
    });
    const doc = buildRulesJson(built.grid, {
        startCell: built.startCell, seed: SEED, sphereLog,
        assumeBidirectional: source.assume_bidirectional_exits !== false,
        procgenMetadata: { driver: 'top-down-sphere', sphere_tree: built.sphereTree, sphere_plan: built.spherePlan },
    });
    const sidecars = doc.preset_sidecars['1'];
    const taRegions = Object.keys(sidecars).filter((r) => sidecars[r].substrate === 'text_adventure');

    it('a top-down world with the mix BUILDS, its text-adventure payloads carry no tile key, and every '
        + "text-adventure region's document rules are the SOURCE document's", () => {
        expect(built.stats.regionsBuilt).toBe(built.stats.regionsTotal);
        expect(taRegions.length).toBeGreaterThan(0);
        for (const r of taRegions) {
            const payload = sidecars[r].playable_payload;
            for (const k of TILE_KEYS) expect(payload, `${r}.${k}`).not.toHaveProperty(k);
            for (const e of payload.exits) expect(e, `${r} exit ${e.exit_id}`).not.toHaveProperty('x');
            const got = rulesOf(doc.regions['1'][r]);
            const want = rulesOf(source.regions['1'][r]);
            // every source exit / location, with the source's rule (the document may ADD a back exit)
            for (const [name, rule] of Object.entries(want.exits)) expect(got.exits[name], `${r} exit ${name}`).toEqual(rule);
            expect(got.locations, r).toEqual(want.locations);
            // the payload's gates ARE the document's (True_ absent)
            const gated = Object.fromEntries(Object.entries(got.exits).filter(([name, rule]) => rule.rule !== 'True_'
                && payload.exits.some((e) => e.exit_id === name && !e.isBackExit)));
            expect(payload.exitGates, r).toEqual(gated);
        }
    });

    it('⛓ task 2 — every text-adventure payload of the build holds its declaration, and its declared AP-name '
        + 'readers answer the DOCUMENT\'s own location and exit names', () => {
        const fields = sidecarFieldsOf(substrateRegistryEntry);
        for (const r of taRegions) {
            const payload = sidecars[r].playable_payload;
            expect(sidecarPayloadErrors(fields, payload), r).toEqual([]);
            const region = doc.regions['1'][r];
            expect(substrateRegistryEntry.apLocationNamesOf(payload), r).toEqual(region.locations.map((l) => l.name));
            expect([...substrateRegistryEntry.apExitNamesOf(payload)].sort(), r).toEqual(region.exits.map((e) => e.name).sort());
        }
    });

    it('the REBUILD path re-emits the same text-adventure rules FROM the payload, and sizes from a tile world or the default', () => {
        const root = doc.procgen_metadata['1'].sphere_tree.nodes.find((node) => node.parent == null);
        expect(root.substrate).toBe('text_adventure');
        const env = rebuildEnvelopeFromRulesJson(doc);
        const rebuilt = buildRulesJson(env.grow.grid, {
            startCell: env.startCell, seed: SEED, sphereLog,
            assumeBidirectional: source.assume_bidirectional_exits !== false,
        });
        for (const r of taRegions) {
            expect(rulesOf(rebuilt.regions['1'][r]), r).toEqual(rulesOf(doc.regions['1'][r]));
            expect(rebuilt.preset_sidecars['1'][r].playable_payload, r).toEqual(sidecars[r].playable_payload);
        }
        expect(Number.isInteger(env.config.regionSize.width)).toBe(true);
        expect(Number.isInteger(env.config.regionSize.height)).toBe(true);
    });

    it('the rebuild falls back to `DEFAULT_REGION_SIZE` when no world carries a size (every region a room)', () => {
        const allRooms = structuredClone(doc);
        for (const node of allRooms.procgen_metadata['1'].sphere_tree.nodes) node.substrate = 'text_adventure';
        for (const [r, sc] of Object.entries(allRooms.preset_sidecars['1'])) {
            if (sc.substrate === 'text_adventure') continue;
            sc.substrate = 'text_adventure';
            sc.playable_payload = { exits: sc.playable_payload.exits.map(({ x, y, ...e }) => e), exitGates: {}, locations: [] };
            expect(r).toBeTruthy();
        }
        expect(rebuildEnvelopeFromRulesJson(allRooms).config.regionSize).toEqual({ ...DEFAULT_REGION_SIZE });
    });

    it('the shuffled spiral (the `tasw-*` rows\' config) builds text-adventure rooms whose locations compile `True_`', () => {
        const result = arrangeShuffledSpiral({
            regionSize: { width: 7, height: 7 },
            itemPool: { victory: 1, key_red: 1, key_green: 1, key_blue: 1 },
            obstaclePool: { door_red: 1, door_green: 1, door_blue: 1 },
            seed: 'tasw-test-1',
            regionParams: {},
            growthParams: { substrateQuotas: { text_adventure: 6, maze: 3 }, maxItemsPerRegion: 2, startSubstrate: 'text_adventure' },
            hazardOpts: {},
        });
        const spiral = buildRulesJson(result.grid, { startCell: result.startCell, seed: 'tasw-test-1', completionConditionItem: 'victory' });
        const rooms = Object.entries(spiral.preset_sidecars['1']).filter(([, sc]) => sc.substrate === 'text_adventure');
        expect(rooms.length).toBe(6);
        const locationCount = rooms.reduce((sum, [, sc]) => sum + sc.playable_payload.locations.length, 0);
        expect(locationCount).toBeGreaterThan(0);
        for (const [r, sc] of rooms) {
            for (const k of TILE_KEYS) expect(sc.playable_payload, `${r}.${k}`).not.toHaveProperty(k);
            const region = spiral.regions['1'][r];
            expect(region.locations.map((l) => l.name)).toEqual(sc.playable_payload.locations.map((l) => l.name));
            for (const l of region.locations) expect(l.access_rule, `${r} ${l.name}`).toEqual(TRUE);
        }
    });
});
