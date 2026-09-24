/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G2 task 1 — **THE SET, ASSEMBLED FROM THE
 * rules.json** (`seedlingGeneratedSet.js`). Two worlds: the headless spiral
 * (`SEEDLING_GENERATED_ROOM_STATE`, G1's — every expectation READ OFF its
 * sidecars, never typed) and a hand-built one small enough to spell by hand
 * (a room with no door, a location off any entity, an unjoined item). Then every
 * refusal, by its sentence.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import {
    GENERATED_SET_ID_BASE, GENERATED_SET_REFUSALS, GeneratedSetError, PARKING_CELL, PARKING_ROOM_NAME,
    assembleGeneratedSeedlingSet, parkingRoomRecord,
} from './seedlingGeneratedSet.js';
import { GEN_ROOM_SUBSTRATE_ID, genDoorId, generatedRoomCensus } from './seedlingGenRoomPayload.js';
import { AP_ITEM_TYPE, AP_LOOK, placementKey } from './apPlacementRewriter.js';
import { apMappingInvalidation } from './levelSetExporter.js';
import { computeLevelSetContentHash, validateLevelSet } from './levelSetValidator.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The rules' own item join — what the panel's `locations` Map answers. */
const joinOf = (rules) => {
    const byName = new Map();
    for (const region of Object.values(rules.regions['1'])) {
        for (const l of region.locations ?? []) byName.set(l.name, l.item ?? null);
    }
    return (name) => {
        const item = byName.get(name);
        return item ? { name: item.name, player: item.player } : null;
    };
};
const px = (cell) => ({ x: cell.tx * 16, y: cell.ty * 16 });
const entityAt = (record, x, y) => record.entities.filter((e) => e.x === x && e.y === y);

describe('the headless spiral world (G1\'s SEEDLING_GENERATED_ROOM_STATE)', () => {
    let rules;
    let out;
    beforeAll(async () => {
        for (const rel of REGISTRY_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(join(ROOT, rel));
        }
        ({ rulesJson: rules } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_GENERATED_ROOM_STATE))));
        out = assembleGeneratedSeedlingSet(rules, { locationItemOf: joinOf(rules), selfPlayer: 1 });
    }, 60000);

    const gen = () => Object.entries(rules.preset_sidecars['1'])
        .filter(([, s]) => s.substrate === GEN_ROOM_SUBSTRATE_ID);

    it('one room per generated sidecar in sidecar order, named by region, then the PARKING room', () => {
        const regions = gen().map(([r]) => r);
        expect(regions.length).toBeGreaterThan(1);
        expect(out.set.rooms.map((r) => r.name)).toEqual([...regions, PARKING_ROOM_NAME]);
        expect([...out.levelOf]).toEqual(regions.map((r, i) => [r, i]));
        expect(out.report.parkingLevel).toBe(regions.length);
        expect(out.set.rooms.at(-1).source.record).toEqual(parkingRoomRecord());
    });

    it('every door: on its tile, `to` its generated target or the parking room, arriving on the PAIRED approach', () => {
        const levelOf = new Map(gen().map(([r], i) => [r, i]));
        let pairs = 0;
        let parked = 0;
        for (const [region, { playable_payload: p }] of gen()) {
            const record = out.set.rooms[levelOf.get(region)].source.record;
            for (const e of p.exits) {
                const [tx, ty] = e.exit_tiles[0];
                const doors = entityAt(record, tx * 16, ty * 16).filter((x) => x.type === 'teleporter');
                expect(doors, `${region} ${e.exit_id}`).toHaveLength(1);
                const { attrs } = doors[0];
                if (levelOf.has(e.targetRegion)) {
                    const target = rules.preset_sidecars['1'][e.targetRegion].playable_payload;
                    const paired = target.exits.find((b) => b.targetRegion === region);
                    expect(attrs, `${region} ${e.exit_id}`).toMatchObject({
                        to: String(levelOf.get(e.targetRegion)),
                        playerx: String(paired.entrance_spawn.x), playery: String(paired.entrance_spawn.y) });
                    pairs += 1;
                } else {
                    expect(attrs, `${region} ${e.exit_id}`).toMatchObject({
                        to: String(out.report.parkingLevel),
                        playerx: String(px(PARKING_CELL).x), playery: String(px(PARKING_CELL).y) });
                    parked += 1;
                }
                expect(attrs).toMatchObject({ tag: '-1', show: '1', sign: '0' });
            }
        }
        // ⛓ both kinds are present in this world, so neither branch is vacuous
        expect(pairs).toBeGreaterThan(0);
        expect(parked).toBeGreaterThan(0);
        expect(out.report.doors).toHaveLength(pairs + parked);
        expect(out.report.unsigned).toBe(pairs + parked);
    });

    it('every location is an `apitem` on its cell, REPLACING the goal pickup under location 0', () => {
        let placed = 0;
        for (const [region, { playable_payload: p }] of gen()) {
            const record = out.set.rooms[p.level].source.record;
            for (const loc of p.locations) {
                const { x, y } = px(loc.cell);
                expect(entityAt(record, x, y), `${region} ${loc.name}`).toEqual([
                    { type: AP_ITEM_TYPE, x, y, attrs: { tag: String(loc.tag), look: AP_LOOK } }]);
                placed += 1;
            }
            // the goal pickup of a room with no location stays (⚖ Q6)
            if (p.locations.length === 0) {
                const g = px(p.goal_cell);
                expect(entityAt(record, g.x, g.y).map((e) => e.type), region).not.toContain(AP_ITEM_TYPE);
                expect(entityAt(record, g.x, g.y), region).toHaveLength(1);
            }
        }
        expect(placed).toBe(1);
        expect(out.report.apitems[0].replaced).toBe(
            gen()[0][1].playable_payload.record.entities.find((e) => e.x === px(gen()[0][1].playable_payload.goal_cell).x
                && e.y === px(gen()[0][1].playable_payload.goal_cell).y).type);
    });

    it('the start: level 0 on its first door\'s approach — the Menu hop\'s own landing', () => {
        const p = gen()[0][1].playable_payload;
        expect(out.set.start).toEqual({ level: 0, ...p.exits[0].entrance_spawn });
        expect(out.set.menu_rooms).toEqual([0]);
    });

    it('the stamp: seedling-gen-<seed>-<content hash>, validated, invalidation matched, provenance names the world', () => {
        const hash = computeLevelSetContentHash(out.set);
        expect(out.set.set_id).toBe(`${GENERATED_SET_ID_BASE}-${rules.seed_name || rules.generation_seed}-${hash}`);
        expect(validateLevelSet(out.set).ok).toBe(true);
        expect(out.invalidation).toEqual(apMappingInvalidation(out.set));
        expect(out.set.provenance.world).toEqual({ seed_name: rules.seed_name, regions: gen().map(([r]) => r) });
        expect(out.report.reachability).toMatchObject({ reachable: out.set.rooms.length, unreachable: [] });
        // the parking room's one-way warning is REPORTED, never an error
        expect(out.report.warnings.some((w) => /"parking" is entered from .* a one-way transition/.test(w))).toBe(true);
    });

    it('the table: placementKey(level, tag) → the location, the rules\' item and player', () => {
        const [region, { playable_payload: p }] = gen()[0];
        const loc = p.locations[0];
        const item = joinOf(rules)(loc.name);
        expect([...out.table]).toEqual([[placementKey(p.level, loc.tag), {
            ledgerId: loc.name, level: p.level, tag: loc.tag, location: loc.name,
            item: item.name, player: item.player, look: AP_LOOK }]]);
        expect(region).toBe(Object.keys(rules.preset_sidecars['1'])[0]);
        expect(out.report.unjoined).toEqual([]);
    });

    it('DETERMINISTIC and PURE: assembled twice, the same bytes; the rules are not touched', () => {
        const before = JSON.stringify(rules);
        const again = assembleGeneratedSeedlingSet(rules, { locationItemOf: joinOf(rules), selfPlayer: 1 });
        expect(JSON.stringify(again.set)).toBe(JSON.stringify(out.set));
        expect(JSON.stringify([...again.table])).toBe(JSON.stringify([...out.table]));
        expect(JSON.stringify(rules)).toBe(before);
    });
});

// ── a hand-built world ───────────────────────────────────────────────────────

/** An open w×h room: walls round the edge, floor inside. */
function openRecord(w, h, entities = []) {
    const tiles = [];
    for (let ty = 0; ty < h; ty += 1) {
        for (let tx = 0; tx < w; tx += 1) {
            tiles.push([tx, ty, (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1) ? 48 : 0, 0]);
        }
    }
    return { width: w, height: h, layers: [{ name: 'tiles', set: 'tileset', tiles }], entities };
}
const door = (tx, ty, approach, exitName, targetRegion, targetSubstrate) => ({
    exit_id: genDoorId({ tx, ty }), kind: 'teleporter', side: 'E', exit_tiles: [[tx, ty]], entrance_tile: [tx, ty],
    entrance_spawn: px(approach), exitName, targetRegion, targetExitId: null, isTeleporter: false,
    external: true, target_level: null, target_spawn: null, target_substrate: targetSubstrate,
});
const genSidecar = (level, { exits, locations = [], entities = [], start = { tx: 1, ty: 1 } }) => ({
    substrate: GEN_ROOM_SUBSTRATE_ID,
    playable_payload: {
        gameId: 'seedling', generated: true, seed: 7 + level, size: { width: 6, height: 6 },
        record: openRecord(6, 6, entities), start, goal_cell: { tx: 4, ty: 4 }, generation: {},
        locations, level, tile_size: 16, exits, exitGates: {}, fogEnabled: true,
    },
});
function handWorld() {
    return {
        seed_name: 'HAND', generation_seed: 9,
        regions: { 1: {
            a: { locations: [{ name: 'a__goal', item: { name: 'key_red', player: 2 } }] },
            b: { locations: [{ name: 'b__loc', item: null }] },
            c: { locations: [] },
            m: { locations: [] },
        } },
        preset_sidecars: { 1: {
            a: genSidecar(0, {
                exits: [door(4, 1, { tx: 3, ty: 1 }, 'exit_0', 'b', GEN_ROOM_SUBSTRATE_ID),
                    door(4, 3, { tx: 3, ty: 3 }, 'exit_1', 'm', 'maze')],
                locations: [{ name: 'a__goal', item: 'key_red', cell: { tx: 4, ty: 4 }, tag: 0 }],
                entities: [{ type: 'torchpickup', x: 64, y: 64, attrs: { tag: '0' } }],
            }),
            m: { substrate: 'maze', playable_payload: { width: 3, height: 3, tiles: [] } },
            b: genSidecar(1, {
                // ⛓ the door to a is SECOND: the pairing is "the target's door back", not its first
                exits: [door(4, 1, { tx: 3, ty: 1 }, 'exit_1', 'm', 'maze'),
                    door(1, 4, { tx: 1, ty: 3 }, 'exit_0', 'a', GEN_ROOM_SUBSTRATE_ID)],
                locations: [{ name: 'b__loc', cell: { tx: 2, ty: 2 }, tag: 3 }],
            }),
            c: genSidecar(2, { exits: [], start: { tx: 2, ty: 3 } }),
        } },
    };
}

describe('a hand-built world — every rule spelled out', () => {
    const rules = handWorld();
    const out = assembleGeneratedSeedlingSet(rules, { locationItemOf: joinOf(rules), selfPlayer: 1 });
    const rec = (i) => out.set.rooms[i].source.record;

    it('rooms a, b, c (the maze sidecar between them is skipped), parking at 3', () => {
        expect(out.set.rooms.map((r) => r.name)).toEqual(['a', 'b', 'c', 'parking']);
        expect(out.report.parkingLevel).toBe(3);
    });

    it('a → b arrives on b\'s door-to-a approach (its SECOND door); b → a on a\'s door-to-b approach; a → maze parks at (16, 16)', () => {
        expect(rec(0).entities.filter((e) => e.type === 'teleporter')).toEqual([
            { type: 'teleporter', x: 64, y: 16, attrs: { to: '1', playerx: '16', playery: '48', tag: '-1', show: '1', sign: '0' } },
            { type: 'teleporter', x: 64, y: 48, attrs: { to: '3', playerx: '16', playery: '16', tag: '-1', show: '1', sign: '0' } },
        ]);
        expect(rec(1).entities.filter((e) => e.type === 'teleporter')).toEqual([
            { type: 'teleporter', x: 64, y: 16, attrs: { to: '3', playerx: '16', playery: '16', tag: '-1', show: '1', sign: '0' } },
            { type: 'teleporter', x: 16, y: 64, attrs: { to: '0', playerx: '48', playery: '16', tag: '-1', show: '1', sign: '0' } },
        ]);
        expect(rec(2).entities).toEqual([]);
    });

    it('the goal torch under a__goal is REPLACED; b__loc on a bare cell is APPENDED before the doors', () => {
        expect(rec(0).entities[0]).toEqual({ type: 'apitem', x: 64, y: 64, attrs: { tag: '0', look: 'ap' } });
        expect(rec(0).entities.filter((e) => e.type === 'torchpickup')).toEqual([]);
        expect(rec(1).entities[0]).toEqual({ type: 'apitem', x: 32, y: 32, attrs: { tag: '3', look: 'ap' } });
        expect(out.report.apitems.map((a) => a.replaced)).toEqual(['torchpickup', null]);
    });

    it('the table joins through the caller: a foreign item keeps its player; no item is REPORTED, still placed', () => {
        expect(out.table.get('0|0')).toMatchObject({ location: 'a__goal', item: 'key_red', player: 2 });
        expect(out.table.get('1|3')).toMatchObject({ location: 'b__loc', item: null, player: null });
        expect(out.report.unjoined).toEqual(['b__loc']);
    });

    it('the start is room 0\'s first approach; a room with NO door starts nothing and is reached by nothing', () => {
        expect(out.set.start).toEqual({ level: 0, x: 48, y: 16 });
        expect(out.report.reachability.unreachable).toEqual([2]);
        const alone = handWorld();
        alone.preset_sidecars[1] = { c: { ...alone.preset_sidecars[1].c } };
        alone.preset_sidecars[1].c.playable_payload.level = 0;
        expect(assembleGeneratedSeedlingSet(alone).set.start).toEqual({ level: 0, x: 32, y: 48 });
    });

    it('the set id takes seed_name, falling back to generation_seed', () => {
        expect(out.set.set_id).toMatch(/^seedling-gen-HAND-[0-9a-f]{8}$/);
        const unnamed = handWorld();
        unnamed.seed_name = '';
        expect(assembleGeneratedSeedlingSet(unnamed).set.set_id).toMatch(/^seedling-gen-9-[0-9a-f]{8}$/);
    });
});

describe('every refusal, by its sentence', () => {
    const refusal = (mutate) => {
        const rules = handWorld();
        mutate(rules);
        try {
            assembleGeneratedSeedlingSet(rules);
        } catch (e) {
            expect(e).toBeInstanceOf(GeneratedSetError);
            return e.message;
        }
        throw new Error('not refused');
    };
    const sc = (rules) => rules.preset_sidecars[1];

    it('no generated room', () => {
        expect(refusal((r) => { r.preset_sidecars[1] = { m: sc(r).m }; }))
            .toBe(GENERATED_SET_REFUSALS.noRooms());
    });
    it('a MIXED world — a real room of the same game beside the generated ones', () => {
        expect(refusal((r) => { sc(r).real = { substrate: 'flash_seedling', playable_payload: { gameId: 'seedling', level: 0 } }; }))
            .toBe(GENERATED_SET_REFUSALS.mixed(['a', 'b', 'c'], ['real']));
        expect(generatedRoomCensus(handWorld()).mixed).toEqual([]);
    });
    it('a payload that is not a room', () => {
        expect(refusal((r) => { delete sc(r).b.playable_payload.record; }))
            .toMatch(/^generated Seedling set: region 'b' — this payload is not a generated Seedling room — it lacks `record`/);
    });
    it('a level that is not its ordinal', () => {
        expect(refusal((r) => { sc(r).b.playable_payload.level = 5; }))
            .toBe(GENERATED_SET_REFUSALS.wrongLevel('b', 5, 1));
    });
    it('a door spelled off its tile', () => {
        expect(refusal((r) => { sc(r).a.playable_payload.exits[1].exit_id = 'out_teleporter_0_0'; }))
            .toBe(GENERATED_SET_REFUSALS.badDoor('a', 'out_teleporter_0_0', 'out_teleporter_64_48'));
    });
    it('a ONE-WAY generated pairing says what is missing', () => {
        expect(refusal((r) => { sc(r).b.playable_payload.exits[1].targetRegion = 'm'; }))
            .toBe(GENERATED_SET_REFUSALS.oneWay('a', 'exit_0', 'b'));
    });
    it('a validator ERROR (a tag outside the level\'s 30 persistence slots)', () => {
        expect(refusal((r) => { sc(r).b.playable_payload.locations[0].tag = 30; }))
            .toMatch(/^generated Seedling set: the assembled set does not validate — .*tag/);
    });
});
