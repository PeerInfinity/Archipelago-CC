/**
 * CONTENT SETS R5 — **A PACK CONCEPT'S ART DRAWS THE MAZE'S GATES AND ITEMS** (⚖ the user 2026-11-14).
 *
 * A concept gate or item row names its mechanic (`"concept": "water"`). At PLAY the world's stack's `concepts` layer
 * says which pack concept presents that mechanic for the row's role and carries an `art` key; when the stack's art
 * resolves the key the painter draws it, otherwise exactly what it drew before (the row's baked colour and symbol).
 * Nothing is baked (⚖ Q8), so no world document moves. In node, on the recorded draw-op log:
 *
 *   1. THE LOOKUP (`conceptArtKeys`): the latest pack presenting the mechanic WITH an art key wins; a later pack that
 *      presents it without art does not hide an earlier one's; a role's `needs` (a look, for the bake) are not asked.
 *   2. THE FALLBACK: no art loaded, the concept names no art, the key absent from the stack, the sheet not decoded —
 *      each draws the concept skin / item disc exactly as with no art at all.
 *   3. THE STATES: a closed gate's art is drawn whole, a passed one at `CONCEPT_ART_CLEARED_ALPHA`; the red marks
 *      drawn over or under it (a blocked location's border, a blocked exit's fill) are as many as without art; a
 *      collected item draws nothing either way.
 *   4. THE REAL `meta` STACK on `meta_trial`'s committed water region: the swim item draws from `"meta#<its key>"`,
 *      the water gate (the theme presents no water) the default way; the bake is untouched (the item role still takes
 *      the maze pack's look, the gate role the theme's), and a plain world's stack resolves no concept art.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { shapeSheetRef } from '../artLibrary/artLibrary.js';
import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createPackConcepts } from '../packConcepts/packConcepts.js';
import { documentContentOf, effectiveContentStack } from '../procgenPipeline/worldContent.js';
import { recordingContext } from './drawOpRecorder.js';
import { MAZE_CONTENT_ROLES, presentedLook } from './mazeContent.js';
import { createState, deserializeMazeWorld } from './mazeRoomEngine.js';
import { CONCEPT_ART_CLEARED_ALPHA, COLORS, TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { conceptArtFrame, conceptArtKeys, loadMazeTileArt, tileArtRefusal } from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const META_TRIAL = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const ROLES = substrateRegistryEntry.contentRoles;
const registry = { getAll: () => [substrateRegistryEntry] };

/** A stub rasteriser: the image names its shape's note-free content, so a blit says which shape it drew. */
const rasteriser = () => async (shape) => ({ shape: JSON.stringify(shape.draw) });
const noSheet = async () => { throw new Error('no sheet in this test'); };

// ── fixtures: packs in memory ───────────────────────────────────────────────────────────────────────────────────
const FIX_BASE = 'https://fixture.invalid/packs/';
const SHAPE = (fill) => ({ w: 20, h: 20, draw: [{ rect: [2, 2, 16, 16], fill }] });
const packJson = (id, layers) => ({ schema_version: 1, id, title: id, licence: 'test fixture', layers });
/** `early` and `late` both present the guardian with art; `bare` presents it with a look and NO art. */
const FILES = Object.freeze({
    'early/pack.json': packJson('early', { concepts: 'concepts.json', art: 'art.json' }),
    'early/concepts.json': { schema_version: 1, concepts: {
        'early:object/gate': { kind: 'object', name: 'Early gate', presents: 'guardian', art: 'early:gate' },
        'early:object/sword': { kind: 'object', name: 'Progressive Sword', presents: 'sword', art: 'early:sword' },
    } },
    'early/art.json': { schema_version: 1, shapes: { 'early:gate': SHAPE('#111111'), 'early:sword': SHAPE('#222222') } },
    'late/pack.json': packJson('late', { concepts: 'concepts.json', art: 'art.json' }),
    'late/concepts.json': { schema_version: 1, concepts: {
        'late:object/gate': { kind: 'object', name: 'Late gate', presents: 'guardian', art: 'late:gate' },
        // names a key no pack's art carries: falls back
        'late:object/swim': { kind: 'object', name: 'Progressive Swim', presents: 'swim', art: 'late:missing' },
    } },
    'late/art.json': { schema_version: 1, shapes: { 'late:gate': SHAPE('#333333') } },
    'bare/pack.json': packJson('bare', { concepts: 'concepts.json' }),
    'bare/concepts.json': { schema_version: 1, concepts: {
        'bare:object/gate': { kind: 'object', name: 'Bare gate', presents: 'guardian', look: { color: '#444444', symbol: 'B' } },
    } },
});
const fixtureIo = {
    base: FIX_BASE,
    readJson: async (url) => JSON.parse(JSON.stringify(FILES[url.slice(FIX_BASE.length)])),
    decode: noSheet,
    rasterise: rasteriser(),
    contentRoles: ROLES,
};

describe('⛓ the lookup: the latest pack presenting the mechanic WITH art', () => {
    it('a later pack\'s art wins; a later pack presenting it without art does not hide it', async () => {
        const ids = ['early', 'late', 'bare'];
        const concepts = createPackConcepts(await loadPackStack(ids, { ...fixtureIo, only: ['concepts'] }));
        const keys = conceptArtKeys(ROLES, concepts, ids);
        expect(keys.gate.guardian).toEqual({ key: 'late:gate', concept: 'late:object/gate', pack: 'late' });
        // reversed order: early is now the latest with art
        const rev = conceptArtKeys(ROLES, concepts, ['late', 'early', 'bare']);
        expect(rev.gate.guardian.key).toBe('early:gate');
    });

    it('asks only the role\'s accepts, not its needs: a concept with art and no look is found', async () => {
        const ids = ['early'];
        const concepts = createPackConcepts(await loadPackStack(ids, { ...fixtureIo, only: ['concepts'] }));
        expect(concepts.get('early:object/sword').look).toBeUndefined();
        expect(conceptArtKeys(ROLES, concepts, ids).item.sword.key).toBe('early:sword');
    });

    it('a mechanic no role accepts, or no pack gives art, is absent', async () => {
        const ids = ['bare'];
        const concepts = createPackConcepts(await loadPackStack(ids, { ...fixtureIo, only: ['concepts'] }));
        expect(conceptArtKeys(ROLES, concepts, ids)).toEqual({});
    });

    it('the load resolves it, and decodes the concept keys the stack\'s art carries', async () => {
        const r = await loadMazeTileArt(['early', 'late'], fixtureIo);
        expect(r.conceptArt.gate.guardian.key).toBe('late:gate');
        expect(r.conceptArt.item.swim.key).toBe('late:missing');
        expect([...r.tileArt.images.keys()].sort()).toEqual([shapeSheetRef('early', 'early:sword'), shapeSheetRef('late', 'late:gate')].sort());
        expect(tileArtRefusal(r.tileArt)).toBe(null);
        expect(conceptArtFrame(r.tileArt, 'gate', 'guardian').key).toBe('late:gate');
        expect(conceptArtFrame(r.tileArt, 'item', 'sword').key).toBe('early:sword');
        expect(conceptArtFrame(r.tileArt, 'item', 'swim'), 'a key the art does not carry falls back').toBe(null);
        expect(conceptArtFrame(null, 'gate', 'guardian')).toBe(null);
    });

    it('without contentRoles the load reads only the art layer, as before R5', async () => {
        const read = [];
        const io = { ...fixtureIo, contentRoles: undefined, readJson: async (url) => { read.push(url.slice(FIX_BASE.length)); return fixtureIo.readJson(url); } };
        const r = await loadMazeTileArt(['early'], io);
        expect(read).not.toContain('early/concepts.json');
        expect(r.conceptArt).toEqual({});
        expect(r.tileArt).toBe(null);
    });
});

// ── the painter ─────────────────────────────────────────────────────────────────────────────────────────────────
/** `meta_trial`'s water region (the theme's committed world): a water gate and a swim item, read off the data. */
const SLOT = Object.keys(META_TRIAL.procgen_metadata)[0];
const [, WATER_SIDECAR] = Object.entries(META_TRIAL.preset_sidecars[SLOT])
    .find(([, sc]) => sc.substrate === 'maze' && Object.values(sc.playable_payload?.obstacleLib ?? {}).some((d) => d.concept === 'water'));
const PAYLOAD = WATER_SIDECAR.playable_payload;
const [WATER_ID, WATER_DEF] = Object.entries(PAYLOAD.obstacleLib).find(([, d]) => d.concept === 'water');
const CONCEPT_ITEM = PAYLOAD.items.find((it) => PAYLOAD.itemLib[it.id]?.concept);

/** The water region; `guardian: true` re-labels its gate as a guardian (a staged scene, the def's look kept). */
function scene({ guardian = false } = {}) {
    const payload = JSON.parse(JSON.stringify(PAYLOAD));
    if (guardian) payload.obstacleLib[WATER_ID].concept = 'guardian';
    const world = deserializeMazeWorld(payload);
    const st = createState(world);
    return { world, view: { tilePx: TILE_PX, inventory: st.inventory, playerPos: st.player_pos } };
}
const draw = (world, view) => {
    const ctx = recordingContext();
    drawWorld(ctx, world, plainView(view));
    return ctx.__log;
};
const count = (log, line) => log.filter((l) => l === line).length;
const metaStack = () => effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], content: documentContentOf(META_TRIAL, SLOT), registry });
const metaArt = async () => loadMazeTileArt(metaStack(), { base: PACKS, readJson: fsJson, decode: noSheet, rasterise: rasteriser(), contentRoles: ROLES });
const META_CONCEPTS = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/meta/concepts/manifest.json'), 'utf8')).concepts;
const metaArtOf = (mechanic) => Object.values(META_CONCEPTS).find((c) => c.presents === mechanic)?.art ?? null;
const META_SHAPES = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/meta/art/manifest.json'), 'utf8')).shapes;
/** The index of the blit of art key `key` (its stub image names the shape's draw list) into cell (x, y), or -1. */
const blitAt = (log, key, x, y) => {
    const img = JSON.stringify({ shape: JSON.stringify(META_SHAPES[key].draw) });
    const at = `${x * TILE_PX},${y * TILE_PX},${TILE_PX},${TILE_PX})`;
    return log.findIndex((l) => l.startsWith(`drawImage(${img},`) && l.endsWith(at));
};

describe('⛓ the fallback draws exactly what no art drew', () => {
    it('premise: the water region has a water gate and a concept item', () => {
        expect(WATER_DEF.symbol).toBeTruthy();
        expect(CONCEPT_ITEM).toBeTruthy();
    });

    it.each([
        ['no art loaded', async () => null],
        ['art with no concept art (the load without roles)', async () => (await loadMazeTileArt(metaStack(), { base: PACKS, readJson: fsJson, decode: noSheet, rasterise: rasteriser() })).tileArt],
        ['the concept\'s art key absent from the stack', async () => {
            const { tileArt } = await metaArt();
            const conceptArt = { gate: { water: { key: 'meta:object/not-here' } }, item: { swim: { key: 'meta:object/not-here' }, sword: { key: 'meta:object/not-here' } } };
            return { ...tileArt, conceptArt };
        }],
        ['the sheet not decoded', async () => {
            const { tileArt } = await metaArt();
            return { ...tileArt, images: new Map([...tileArt.images].filter(([ref]) => !ref.includes('meta:object/'))) };
        }],
    ])('%s: the gate and item ops equal the no-art draw\'s', async (_, artOf) => {
        const tileArt = await artOf();
        const { world, view } = scene({ guardian: true });
        const baseline = draw(world, view);
        // the floor/wall/player art may be drawn; the gate's symbol text and the item disc must be there as without art
        const log = draw(world, { ...view, tileArt });
        const [gx, gy] = [...world.obstacles].find(([, id]) => id === WATER_ID)[0].split(',').map(Number);
        const disc = `arc(${CONCEPT_ITEM.x * TILE_PX + TILE_PX / 2},${CONCEPT_ITEM.y * TILE_PX + TILE_PX / 2},${TILE_PX * 0.3},0,${Math.PI * 2})`;
        const symbol = baseline.find((l) => l.startsWith(`fillText(${JSON.stringify(WATER_DEF.symbol)},`));
        expect(symbol).toBeTruthy();
        for (const line of [disc, symbol]) expect(count(log, line), line).toBe(count(baseline, line));
        expect(count(baseline, disc)).toBe(1);
        expect(blitAt(log, metaArtOf('guardian'), gx, gy)).toBe(-1);
        expect(blitAt(log, metaArtOf(PAYLOAD.itemLib[CONCEPT_ITEM.id].concept), CONCEPT_ITEM.x, CONCEPT_ITEM.y)).toBe(-1);
    });
});

describe('⛓ the real meta stack on meta_trial\'s water region', () => {
    it('the swim item draws from "meta#<its art key>"; the water gate draws its skin (meta presents no water)', async () => {
        const r = await metaArt();
        const mechanic = PAYLOAD.itemLib[CONCEPT_ITEM.id].concept;
        expect(r.conceptArt.item[mechanic].key).toBe(metaArtOf(mechanic));
        expect(r.conceptArt.gate?.water).toBeUndefined();
        expect(r.failed).toEqual([]);
        const { world, view } = scene();
        const log = draw(world, { ...view, tileArt: r.tileArt });
        const at = `${CONCEPT_ITEM.x * TILE_PX},${CONCEPT_ITEM.y * TILE_PX},${TILE_PX},${TILE_PX}`;
        const shape = JSON.stringify(JSON.stringify(JSON.parse(readFileSync(join(ROOT, 'frontend/packs/meta/art/manifest.json'), 'utf8')).shapes[metaArtOf(mechanic)].draw));
        expect(log.filter((l) => l.startsWith('drawImage(') && l.endsWith(`${at})`) && l.includes(shape.slice(1, -1)))).toHaveLength(1);
        expect(r.tileArt.art.frameRect(metaArtOf(mechanic), 0).sheetRef).toBe(shapeSheetRef('meta', metaArtOf(mechanic)));
        // the item's disc is not drawn; the water gate's symbol is
        const withoutArt = draw(world, view);
        const disc = `arc(${CONCEPT_ITEM.x * TILE_PX + TILE_PX / 2},${CONCEPT_ITEM.y * TILE_PX + TILE_PX / 2},${TILE_PX * 0.3},0,${Math.PI * 2})`;
        expect(count(withoutArt, disc)).toBe(1);
        expect(count(log, disc)).toBe(0);
        const symbol = withoutArt.find((l) => l.startsWith(`fillText(${JSON.stringify(WATER_DEF.symbol)},`));
        expect(symbol).toBeTruthy();
        expect(count(log, symbol)).toBe(1);
    });

    it('a guardian gate (staged on the same cell) draws the Gate\'s art whole while closed, at the cleared alpha once passed', async () => {
        const { tileArt } = await metaArt();
        const key = metaArtOf('guardian');
        expect(tileArt.conceptArt.gate.guardian.key).toBe(key);
        const { world, view } = scene({ guardian: true });
        const [gx, gy] = [...world.obstacles].find(([, id]) => id === WATER_ID)[0].split(',').map(Number);
        const gateBlit = (log) => blitAt(log, key, gx, gy);
        const closed = draw(world, { ...view, tileArt });
        const open = draw(world, { ...view, tileArt, inventory: new Set([...view.inventory, WATER_DEF.clear_rule.args.item_name]) });
        expect(gateBlit(closed)).toBeGreaterThan(-1);
        expect(gateBlit(open)).toBeGreaterThan(-1);
        // the alpha set last before the blit
        const alphaBefore = (log, i) => log.slice(0, i).reverse().find((l) => l.startsWith('globalAlpha=') || l === 'save()' || l === 'restore()');
        expect(alphaBefore(closed, gateBlit(closed))).toBe('save()');
        expect(alphaBefore(open, gateBlit(open))).toBe(`globalAlpha=${CONCEPT_ART_CLEARED_ALPHA}`);
        // no symbol text for the gate any more
        expect(closed.filter((l) => l.startsWith(`fillText(${JSON.stringify(WATER_DEF.symbol)},`))).toEqual([]);
        // what is drawn over or around it is as many as without art: blocked-exit fill, blocked-location border
        for (const inv of [view.inventory, new Set([...view.inventory, WATER_DEF.clear_rule.args.item_name])]) {
            const a = draw(world, { ...view, inventory: inv, tileArt });
            const b = draw(world, { ...view, inventory: inv });
            for (const line of [`fillStyle=${JSON.stringify(COLORS.exitBlocked)}`, `strokeStyle=${JSON.stringify(COLORS.locationBlocked)}`]) {
                expect(count(a, line), line).toBe(count(b, line));
            }
        }
    });

    it('a collected item draws nothing, art or not', async () => {
        const { tileArt } = await metaArt();
        const { world, view } = scene();
        const collected = { ...view, inventory: new Set([...view.inventory, CONCEPT_ITEM.id]) };
        const log = draw(world, { ...collected, tileArt });
        const key = metaArtOf(PAYLOAD.itemLib[CONCEPT_ITEM.id].concept);
        expect(blitAt(draw(world, { ...view, tileArt }), key, CONCEPT_ITEM.x, CONCEPT_ITEM.y)).toBeGreaterThan(-1);
        expect(blitAt(log, key, CONCEPT_ITEM.x, CONCEPT_ITEM.y)).toBe(-1);
    });

    it('the bake is untouched: the item role still takes the maze pack\'s look, the gate role the theme\'s', async () => {
        const ids = metaStack();
        const contentSet = { ids, concepts: createPackConcepts(await loadPackStack(ids, { base: PACKS, readJson: fsJson, only: ['concepts'] })) };
        const mazeConcepts = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/maze/concepts/manifest.json'), 'utf8')).concepts;
        for (const mechanic of MAZE_CONTENT_ROLES.item.accepts.presents) {
            const maze = Object.values(mazeConcepts).find((c) => c.presents === mechanic);
            expect(presentedLook(contentSet, 'item', mechanic), mechanic).toMatchObject({ color: maze.look.color, symbol: maze.look.symbol });
        }
        const gate = Object.values(META_CONCEPTS).find((c) => c.presents === 'guardian');
        expect(presentedLook(contentSet, 'gate', 'guardian')).toEqual({ name: gate.name, color: gate.look.color, symbol: gate.look.symbol });
        // and the committed world's item rows are the maze pack's look
        for (const it of Object.values(PAYLOAD.itemLib).filter((d) => d.concept)) {
            const maze = Object.values(mazeConcepts).find((c) => c.presents === it.concept);
            expect({ color: it.color, symbol: it.symbol }).toEqual(maze.look);
        }
    });

    it('a plain world (no content) resolves no concept art: its stack is the maze default pack alone', async () => {
        const stack = effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], content: [], registry });
        const r = await loadMazeTileArt(stack, { base: PACKS, readJson: fsJson, decode: noSheet, rasterise: rasteriser(), contentRoles: ROLES });
        expect(r.tileArt).toBe(null);
        expect(r.conceptArt).toEqual({});
    });
});

describe("the room the Gate recipe leaves for what is drawn under it", () => {
    it('the Gate recipe is inset, so a blocked exit\'s red fill stays visible round it', () => {
        const shapes = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/meta/art/manifest.json'), 'utf8')).shapes;
        const gate = shapes[metaArtOf('guardian')];
        const [x, y, w, h] = gate.draw[0].rect;
        const half = (gate.draw[0].width ?? 1) / 2;
        expect(x - half).toBeGreaterThan(0);
        expect(y - half).toBeGreaterThan(0);
        expect(x + w + half).toBeLessThan(gate.w);
        expect(y + h + half).toBeLessThan(gate.h);
    });
});
