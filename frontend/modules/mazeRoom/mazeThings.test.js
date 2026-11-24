/**
 * ⛓⛓ CONTENT SETS S2 — **A MAZE REGION'S THING** (`mazeThings.js`): what a region holds, the free-cell rule, the
 * serializer and deserializer wrappers, the round trip, and that nothing about reachability moves.
 *
 * Pinned with a FIXTURE theme held in memory (a character, an object, two pieces of information, a `/maze` text
 * variant); the default packs come from disk. The committed `meta` theme's things are pinned in
 * `procgenPipeline/metaTrialWorld.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { MAZE_CONTENT_ROLES } from './mazeContent.js';
import {
    MAZE_THING_KINDS, MAZE_TEXT_VARIANT, freeFloorCells, hash32, placeThings, regionThings, reseatThings,
    thingsDeserializer, thingsRegionCore, thingsSerializer,
} from './mazeThings.js';
import { deserializeMazeWorld, extractPathsAndObstacles, generateRegionCore } from './mazeRoomEngine.js';
import { serializeMazeWorld, TILE_GRID_SIDECAR_FIELDS } from './mazeSerializer.js';
import { mazeRegionRoundTrip } from './mazeRegionRoundTrip.js';
import { textVariantKey } from '../procgenCore/contentRoles.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { createRng } from '../shared/rng.js';
import { defaultContentSetOf, loadContentSet } from '../procgenPipeline/worldContent.js';
import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';

const DEFAULT = substrateRegistryEntry.defaultContentPack;
const DEFAULT_SET = defaultContentSetOf([DEFAULT]);

// ── the fixture theme, in memory ─────────────────────────────────────────
const THEME = 'fixture';
const MEM = 'mem:/packs/';
const SAYS = `${THEME}:keeper/says`;
const CONCEPTS_OF = (extra = {}) => ({
    [`${THEME}:character/keeper`]: {
        kind: 'character', name: 'Keeper', description: 'It keeps the room.', look: { color: '#123456', symbol: 'K' },
        art: `${THEME}:character/keeper`, text: { says: SAYS },
    },
    [`${THEME}:object/stone`]: { kind: 'object', name: 'Stone', look: { color: '#654321', symbol: 'S' } },
    // a character with no look: the maze's character role refuses it (the text adventure would take it)
    [`${THEME}:character/lookless`]: { kind: 'character', name: 'Lookless', text: { says: SAYS } },
    // presents a mechanic: fills no kind role (the contract)
    [`${THEME}:object/gate`]: { kind: 'object', name: 'Gate', look: { color: '#000000', symbol: '#' }, presents: 'guardian' },
    [`${THEME}:info/one`]: { kind: 'info', name: 'One', text: { body: `${THEME}:info/one/body` } },
    [`${THEME}:info/two`]: { kind: 'info', name: 'Two', text: { body: `${THEME}:info/two/body` } },
    ...extra,
});
const STRINGS = {
    [SAYS]: 'This is {roomName}.',
    [textVariantKey(SAYS, MAZE_TEXT_VARIANT)]: 'The rules call this {regionId}.',
    [`${THEME}:info/one/body`]: 'One & only, in {regionId}.',
    [`${THEME}:info/two/body`]: 'Two.',
};
function filesOf(concepts, strings) {
    return {
        [`${THEME}/pack.json`]: {
            schema_version: 1, id: THEME, title: 'A fixture theme', licence: 'CC0',
            layers: { concepts: 'concepts/manifest.json', text: 'text/manifest.json' },
        },
        [`${THEME}/concepts/manifest.json`]: { schema_version: 1, concepts },
        [`${THEME}/text/manifest.json`]: { schema_version: 1, strings },
    };
}
function ioOf(files) {
    const disk = nodePackIo();
    return {
        base: MEM,
        readJson: withFixtureProvenance(async (url) => {
            const rel = url.slice(MEM.length);
            if (rel in files) return structuredClone(files[rel]);
            if (rel.startsWith(`${THEME}/`)) throw new Error(`no file ${url}`);
            return disk.readJson(new URL(rel, disk.base).href);
        }),
    };
}
const themeSet = (concepts = CONCEPTS_OF(), strings = STRINGS) => loadContentSet([DEFAULT, THEME], ioOf(filesOf(concepts, strings)));

/** A small open room through the engine, the way the pipeline builds one. */
function room(regionId = 'region_1_1', seed = 7) {
    const rng = createRng(seed);
    const core = generateRegionCore({
        region_id: regionId, size: { width: 9, height: 9 }, entrances: [{ side: 'W', tile: { x: 0, y: 4 } }],
        exits: [{ side: 'E' }], rng, params: {},
    });
    return { core, rng, extracted: extractPathsAndObstacles(core.world, { regionId }) };
}

describe('the declaration', () => {
    it('the thing kinds are the maze\'s kind roles, and `things` is declared optional beside the serializer', () => {
        const kindRoles = Object.entries(MAZE_CONTENT_ROLES).filter(([, r]) => r.accepts.kinds).map(([id]) => id);
        expect([...MAZE_THING_KINDS]).toEqual(kindRoles);
        for (const id of kindRoles) expect(MAZE_CONTENT_ROLES[id].accepts.kinds).toEqual([id]);
        expect(TILE_GRID_SIDECAR_FIELDS.things.required).toBe(false);
        expect(substrateRegistryEntry.sidecarFields).toBe(TILE_GRID_SIDECAR_FIELDS);
    });
    it('⛔ nothing this slice adds is in the engine closure', () => {
        const closure = importClosure().map((f) => f.replaceAll('\\', '/'));
        for (const rel of ['mazeRoom/mazeThings.js', 'mazeRoom/mazeThingOverlay.js', 'mazeRoom/mazeContent.js',
            'mazeRoom/mazeSerializer.js', 'mazeRoom/mazeRoomLibrary.js', 'procgenCore/contentRoles.js']) {
            expect(closure.filter((f) => f.endsWith(`frontend/modules/${rel}`)), rel).toEqual([]);
        }
    });
});

describe('regionThings — what a region holds', () => {
    it('the default pack offers none: nothing, and no key', () => {
        expect(regionThings(DEFAULT_SET, 'region_1_1', 0)).toEqual([]);
        expect(regionThings(null, 'region_1_1', 0)).toEqual([]);
    });
    it('one holder (a look-bearing character or object; never a presenter) carrying one piece of information, baked', async () => {
        const set = await themeSet();
        const holders = [`${THEME}:character/keeper`, `${THEME}:object/stone`];
        const infos = [`${THEME}:info/one`, `${THEME}:info/two`];
        const seen = new Set();
        for (let i = 0; i < 40; i++) {
            const [t] = regionThings(set, `region_${i}`, 0);
            expect(holders).toContain(t.concept);
            expect(infos).toContain(t.info.concept);
            expect(t.id).toBe('thing_0');
            expect('x' in t || 'y' in t).toBe(false);
            const c = set.concepts.get(t.concept);
            expect({ kind: t.kind, name: t.name, color: t.color, symbol: t.symbol })
                .toEqual({ kind: c.kind, name: c.name, color: c.look.color, symbol: c.look.symbol });
            if (t.kind === 'character') {
                // the maze's own line (the variant) with {regionId} filled; not HTML-escaped
                expect(t.says).toBe(`The rules call this region_${i}.`);
                expect(t.description).toBe(c.description);
            } else expect(t.says).toBeUndefined();
            if (t.info.concept === `${THEME}:info/one`) expect(t.info.body).toBe(`One & only, in region_${i}.`);
            seen.add(t.concept);
        }
        expect(seen.size).toBe(holders.length);
    });
    it('the pick is a hash of the rng state and the region id: the same inputs, the same thing', async () => {
        const set = await themeSet();
        expect(regionThings(set, 'region_2_3', 123)).toEqual(regionThings(set, 'region_2_3', 123));
        const holders = [`${THEME}:character/keeper`, `${THEME}:object/stone`];
        expect(regionThings(set, 'region_2_3', 123)[0].concept)
            .toBe(holders[hash32('123:region_2_3:holder') % holders.length]);
    });
    it('information alone is a thing of kind info (a sign); a holder alone carries none', async () => {
        const { [`${THEME}:character/keeper`]: _k, [`${THEME}:object/stone`]: _s, ...infoOnly } = CONCEPTS_OF();
        const [sign] = regionThings(await themeSet(infoOnly), 'region_1_1', 0);
        expect(sign).toEqual({ id: 'thing_0', kind: 'info', concept: sign.info.concept, name: sign.info.name, info: sign.info });
        expect(sign.color).toBeUndefined();
        const { [`${THEME}:info/one`]: _1, [`${THEME}:info/two`]: _2, ...holdersOnly } = CONCEPTS_OF();
        const [holder] = regionThings(await themeSet(holdersOnly), 'region_1_1', 0);
        expect(holder.info).toBeUndefined();
    });
});

describe('the free-cell rule', () => {
    it('free = floor not named by any {x, y} or "x,y" of the payload; row order', () => {
        const { core, extracted } = room();
        const payload = serializeMazeWorld(core.world, extracted);
        const free = freeFloorCells(payload);
        const named = new Set([`${payload.entrance.x},${payload.entrance.y}`,
            ...payload.exits.map((e) => `${e.x},${e.y}`), ...payload.items.map((e) => `${e.x},${e.y}`),
            ...payload.obstacles.map((e) => `${e.x},${e.y}`)]);
        expect(free.length).toBeGreaterThan(0);
        for (const c of free) {
            expect(payload.tiles[c.y * payload.width + c.x]).toBe(0);
            expect(named.has(`${c.x},${c.y}`)).toBe(false);
        }
        const order = free.map((c) => c.y * payload.width + c.x);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        // a lane-like string list takes its cells too
        const lane = `${free[0].x},${free[0].y}`;
        expect(freeFloorCells({ ...payload, traps: [{ x: -1, y: -1, lane: [lane] }] }).map((c) => `${c.x},${c.y}`)).not.toContain(lane);
    });
    it('a position-less thing takes the free cell hash32("<region>:<concept>") mod count; a placed one keeps a free cell', () => {
        const { core, extracted } = room();
        const payload = serializeMazeWorld(core.world, extracted);
        const free = freeFloorCells(payload);
        const thing = { id: 'thing_0', kind: 'object', concept: 'x:object/a', name: 'A' };
        const [placed] = placeThings(payload, [thing], 'region_1_1');
        expect({ x: placed.x, y: placed.y }).toEqual(free[hash32('region_1_1:x:object/a') % free.length]);
        expect(Object.keys(placed).slice(0, 3)).toEqual(['id', 'x', 'y']);
        const kept = { ...thing, x: free[0].x, y: free[0].y };
        expect(placeThings(payload, [kept], 'region_1_1')).toEqual([kept]);
        // its cell turned to wall → moved by the rule
        const walled = { ...payload, tiles: payload.tiles.map((t, i) => (i === free[0].y * payload.width + free[0].x ? 1 : t)) };
        const [moved] = placeThings(walled, [kept], 'region_1_1');
        expect(`${moved.x},${moved.y}`).not.toBe(`${free[0].x},${free[0].y}`);
    });
    it('no free cell: no thing, and no refusal', () => {
        const { core, extracted } = room();
        const payload = serializeMazeWorld(core.world, extracted);
        const full = { ...payload, tiles: payload.tiles.map(() => 1) };
        expect(placeThings(full, [{ id: 'thing_0', kind: 'info', concept: 'x:info/a', name: 'A' }], 'r')).toEqual([]);
    });
});

describe('the wrappers — the engine never sees a thing', () => {
    it('core → serialize → deserialize → serialize: things placed, carried, unchanged; draws nothing from the rng', async () => {
        const set = await themeSet();
        const core = thingsRegionCore(generateRegionCore);
        const serialize = thingsSerializer(serializeMazeWorld);
        const deserialize = thingsDeserializer(deserializeMazeWorld);
        const input = (rng) => ({
            region_id: 'region_4_2', size: { width: 9, height: 9 }, entrances: [{ side: 'W', tile: { x: 0, y: 4 } }],
            exits: [{ side: 'E' }], rng, params: { contentSet: set },
        });
        const rngA = createRng(11);
        const a = core(input(rngA));
        const rngB = createRng(11);
        const b = generateRegionCore(input(rngB));
        expect(rngA.next()).toBe(rngB.next());
        expect(a.world.things).toHaveLength(1);
        const exA = extractPathsAndObstacles(a.world, { regionId: 'region_4_2' });
        const exB = extractPathsAndObstacles(b.world, { regionId: 'region_4_2' });
        // ⛔ reachability: the extractor's answer is the same with and without the thing
        expect(exA).toEqual(exB);
        const out = serialize(a.world, exA);
        const plain = serializeMazeWorld(b.world, exB);
        const { things, ...rest } = out;
        expect(rest).toEqual(plain);
        expect(Object.keys(out).at(-1)).toBe('things');
        expect(things).toHaveLength(1);
        expect(freeFloorCells(plain).some((c) => c.x === things[0].x && c.y === things[0].y)).toBe(true);
        const again = serialize(deserialize(JSON.parse(JSON.stringify(out))), exA);
        expect(again).toEqual(out);
    });
    it('a world with no thing serializes exactly as the engine does (no key)', () => {
        const { core, extracted } = room();
        const out = thingsSerializer(serializeMazeWorld)(core.world, extracted);
        expect(out).toEqual(serializeMazeWorld(core.world, extracted));
        expect('things' in out).toBe(false);
        expect('things' in thingsDeserializer(deserializeMazeWorld)(out)).toBe(false);
    });
    it('the registry entry carries the wrapped hooks', () => {
        const { core, extracted } = room();
        const payload = substrateRegistryEntry.serializeWorld(core.world, extracted);
        const world = substrateRegistryEntry.deserializeWorld({ ...payload, things: [{ id: 'thing_0', x: 1, y: 1, kind: 'info', concept: 'x:info/a', name: 'A', info: { concept: 'x:info/a', name: 'A', body: 'b' } }] });
        expect(world.things).toHaveLength(1);
    });
});

describe('the round trip keeps things (a re-derive moves none)', () => {
    it('open → save unedited: the payload\'s things come back on their cells', async () => {
        const set = await themeSet();
        const core = thingsRegionCore(generateRegionCore)({
            region_id: 'region_4_2', size: { width: 9, height: 9 }, entrances: [{ side: 'W', tile: { x: 0, y: 4 } }],
            exits: [{ side: 'E' }], rng: createRng(11), params: { contentSet: set },
        });
        const payload = thingsSerializer(serializeMazeWorld)(core.world, extractPathsAndObstacles(core.world, { regionId: 'region_4_2' }));
        payload.fogEnabled = true;
        const ctx = { regionId: 'region_4_2', payload };
        const opened = mazeRegionRoundTrip.open(ctx);
        const saved = mazeRegionRoundTrip.save(opened.unedited, ctx);
        expect(saved.payload.things).toEqual(payload.things);
        expect(Object.keys(saved.payload).slice(-2)).toEqual(['things', 'fogEnabled']);
        expect(reseatThings(payload, 'region_4_2')).toEqual(payload);
    });
});
