/**
 * ⛓⛓ CONTENT SETS S2 — **A REGION'S THING, DRAWN BESIDE `drawWorld`** (`mazeThingOverlay.js`) and the art lookup by
 * a thing's pack concept (`mazeTileArt.thingArtKeys`): art first, else a sign for unheld information, else the baked
 * look; nothing under the fog or under the player; `drawWorld`'s own ops are untouched.
 */
import { describe, expect, it } from 'vitest';

import { recordingContext } from './drawOpRecorder.js';
import { COLORS, TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { drawMazeThings, mazeThingLines, thingAt } from './mazeThingOverlay.js';
import {
    MAZE_ART_KEYS, loadMazeTileArt, thingArtFrame, thingArtKeys, tileArtRefusal,
} from './mazeTileArt.js';
import { createWorld } from './mazeRoomEngine.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { loadPackStack } from '../contentPacks/contentPacks.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';

const ROLES = substrateRegistryEntry.contentRoles;
const FIX_BASE = 'https://fixture.invalid/packs/';
const SHAPE = (fill) => ({ w: 20, h: 20, draw: [{ rect: [2, 2, 16, 16], fill }] });
const FILES = Object.freeze({
    'fx/pack.json': { schema_version: 1, id: 'fx', title: 'fx', licence: 'test fixture', layers: { concepts: 'concepts.json', art: 'art.json' } },
    'fx/concepts.json': { schema_version: 1, concepts: {
        'fx:character/keeper': { kind: 'character', name: 'Keeper', look: { color: '#123456', symbol: 'K' }, art: 'fx:keeper' },
        'fx:object/stone': { kind: 'object', name: 'Stone', look: { color: '#654321', symbol: 'S' }, art: 'fx:missing' },
        // a presenter with art: a gate's look, never a thing's
        'fx:object/gate': { kind: 'object', name: 'Gate', presents: 'guardian', art: 'fx:gate' },
        'fx:info/note': { kind: 'info', name: 'Note' },
    } },
    'fx/art.json': { schema_version: 1, shapes: {
        'fx:keeper': SHAPE('#111111'), 'fx:gate': SHAPE('#222222'), [MAZE_ART_KEYS.sign.key]: SHAPE('#333333'),
    } },
});
const io = {
    base: FIX_BASE,
    readJson: withFixtureProvenance(async (url) => JSON.parse(JSON.stringify(FILES[url.slice(FIX_BASE.length)]))),
    decode: async () => { throw new Error('no sheet'); },
    rasterise: async (shape) => ({ shape: JSON.stringify(shape.draw) }),
};

/** A 5×5 open room with three things on it. */
function worldWith(things) {
    const w = createWorld(5, 5, { entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'e', x: 4, y: 4, side: 'E' }] });
    w.things = things;
    return w;
}
const KEEPER = { id: 'thing_0', x: 1, y: 1, kind: 'character', concept: 'fx:character/keeper', name: 'Keeper', color: '#123456', symbol: 'K', says: 'Hello.' };
const STONE = { id: 'thing_1', x: 2, y: 2, kind: 'object', concept: 'fx:object/stone', name: 'Stone', color: '#654321', symbol: 'S' };
const NOTE = { id: 'thing_2', x: 3, y: 3, kind: 'info', concept: 'fx:info/note', name: 'Note', info: { concept: 'fx:info/note', name: 'Note', body: 'Read me.' } };
const view = (over = {}) => ({ tilePx: TILE_PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt: null, ...over });

describe('thingArtKeys — a thing\'s art, by its pack concept', () => {
    it('every non-presenting concept of a kind the roles accept, with an `art` key; a presenter never', async () => {
        const stack = await loadPackStack(['fx'], { ...io, only: ['concepts'] });
        const keys = thingArtKeys(ROLES, createPackConcepts(stack));
        expect(Object.keys(keys).sort()).toEqual(['fx:character/keeper', 'fx:object/stone']);
        expect(keys['fx:character/keeper']).toEqual({ key: 'fx:keeper', pack: 'fx' });
    });
    it('the load carries it, decodes its keys and the sign\'s; the frame resolves, a missing key does not', async () => {
        const loaded = await loadMazeTileArt(['fx'], { ...io, contentRoles: ROLES });
        expect(tileArtRefusal(loaded.tileArt)).toBeNull();
        expect(loaded.keyed.sign).toBe('fx');
        expect(thingArtFrame(loaded.tileArt, 'fx:character/keeper')?.key).toBe('fx:keeper');
        expect(thingArtFrame(loaded.tileArt, 'fx:object/stone')).toBeNull();
        const bare = await loadMazeTileArt(['fx'], io);
        expect(bare.thingArt).toEqual({});
    });
    it('the sign is in the key table, its fallback colour in COLORS', () => {
        expect(MAZE_ART_KEYS.sign.key).toBe('maze:object/sign');
        for (const c of MAZE_ART_KEYS.sign.colors) expect(COLORS[c], c).toBeTruthy();
    });
});

describe('drawMazeThings', () => {
    it('without art: the holder\'s baked look (colour + symbol), the sign in COLORS.sign', () => {
        const ctx = recordingContext();
        const drawn = drawMazeThings(ctx, worldWith([KEEPER, STONE, NOTE]), view());
        expect(drawn.map((d) => d.as)).toEqual(['look', 'look', 'sign']);
        const log = ctx.__log.join('\n');
        expect(log).toContain(`fillStyle="${KEEPER.color}"`);
        expect(log).toContain('fillText("K"');
        expect(log).toContain(`fillStyle="${COLORS.sign}"`);
    });
    it('with art: the holder\'s own key; a key the art lacks falls back; the sign\'s key for unheld information', async () => {
        const { tileArt } = await loadMazeTileArt(['fx'], { ...io, contentRoles: ROLES });
        const ctx = recordingContext();
        const drawn = drawMazeThings(ctx, worldWith([KEEPER, STONE, NOTE]), view({ tileArt }));
        expect(drawn.map((d) => d.as)).toEqual(['art', 'look', 'sign-art']);
        expect(ctx.__log.filter((l) => l.startsWith('drawImage(')).length).toBe(2);
    });
    it('nothing under the fog until seen, nothing under the player', () => {
        const fog = view({ fogEnabled: true, isTileVisible: (x, y) => x === 1 && y === 1 });
        expect(drawMazeThings(recordingContext(), worldWith([KEEPER, STONE]), fog).map((d) => d.id)).toEqual(['thing_0']);
        const onKeeper = view({ playerPos: { x: 1, y: 1 } });
        expect(drawMazeThings(recordingContext(), worldWith([KEEPER, STONE]), onKeeper).map((d) => d.id)).toEqual(['thing_1']);
    });
    it('⛔ drawWorld\'s own ops do not change with things on the world (the overlay is a sibling)', () => {
        const plain = worldWith(undefined);
        delete plain.things;
        const a = recordingContext();
        drawWorld(a, plain, plainView());
        const b = recordingContext();
        drawWorld(b, worldWith([KEEPER, STONE, NOTE]), plainView());
        expect(b.__log).toEqual(a.__log);
    });
});

describe('reading', () => {
    it('the text adventure\'s order: description, "<name> says:", "<info name>: <body>"; else "You see <name>."', () => {
        expect(mazeThingLines({ ...KEEPER, description: 'It keeps.', info: NOTE.info }))
            .toEqual(['It keeps.', 'Keeper says: Hello.', 'Note: Read me.']);
        expect(mazeThingLines(NOTE)).toEqual(['Note: Read me.']);
        expect(mazeThingLines(STONE)).toEqual(['You see Stone.']);
    });
    it('thingAt finds by cell', () => {
        const w = worldWith([KEEPER, STONE]);
        expect(thingAt(w, 2, 2)).toBe(STONE);
        expect(thingAt(w, 0, 0)).toBeNull();
    });
});
