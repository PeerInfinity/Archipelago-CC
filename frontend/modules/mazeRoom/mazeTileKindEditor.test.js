/**
 * CONTENT SETS TILE-3 — **THE EDITOR PLACES A PACK-DECLARED TILE KIND, AND IT SURVIVES THE ROUND TRIP** (⚖ the user,
 * 2026-11-17: "Editor first, then generator"; "placed kinds are walkable" for now).
 *
 *   1. The op (`setTileKind`) and the TILE KIND palette entry, and every refusal by name: no packs loaded, a kind no
 *      loaded pack declares, a wall-based kind that is not blocked (⛓ PASS-1: the look/logic rule), a wall cell, an
 *      occupied cell. A cell holding a kind takes no entity
 *      and no wall; `clearEntity` removes it. A wall-based kind is not offered.
 *   2. The adapter carries a kind through copy/paste (`readMazeCell` / `mazeWriteOps`).
 *   3. ⛓ THE PROOF, on a REAL committed world (the meta trial's maze region with a thing), with a TEST-ONLY fixture
 *      pack held in memory (no committed pack or preset gains it): the APWorld editor's round trip opens the room as a
 *      one-entry library, the lab's set session opens the room, the palette places the fixture's kind, the room closes
 *      back into the library, the save writes the payload, and the reload (the registry's deserializer, and a second
 *      open) carries the kind. It draws as the MARKER base in both views, with no theme art and with the `meta` theme;
 *      nothing throws.
 *   4. `?packs=` (`mazeLab.readPacksParam`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createEditSession } from '../procgenCore/editCore.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';
import { recordingContext } from './drawOpRecorder.js';
import { TILE_FLOOR, TILE_WALL, getTile } from './mazeRoomEngine.js';
import { drawWorld, plainView } from './mazeRoomRender.js';
import { MAZE_CONTENT_ROLES } from './mazeContent.js';
import { drawMazeCompositeRegion } from './mazeCompositeMap.js';
import { createMazeEditAdapter, mazeWriteOps, readMazeCell } from './mazeEditAdapter.js';
import { MazeRoomEditor, PALETTE_ENTRIES, PALETTE_TYPES, applyEditOp, placeableTileKinds } from './mazeRoomEditor.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { mazeRegionRoundTrip } from './mazeRegionRoundTrip.js';
import { closeRoomSession, createMazeSetAdapter, createSetSession, setRecord } from './mazeSetAdapter.js';
import { drawMazeTileKinds } from './mazeTileKindOverlay.js';
import { TILE_KIND_REFUSALS, deserializeMazeWorldWithKinds, occupiedWorldCells, tileKindRefusal } from './mazeTileKinds.js';
import { loadMazeTileArt, paintMazeTileBase, resetMazeTilePlaceholderLogForTests } from './mazeTileArt.js';
import { readPacksParam } from './mazeLab.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKS = pathToFileURL(`${join(HERE, '../../packs')}/`).href;
const META = JSON.parse(readFileSync(join(HERE, '../../presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const [REGION_ID, PAYLOAD] = Object.entries(META.preset_sidecars['1'])
    .filter(([, sc]) => sc.substrate === 'maze' && sc.playable_payload?.things?.length)
    .map(([id, sc]) => [id, sc.playable_payload])[0];
const PX = 16;

/**
 * ⛔ THE FIXTURE PACK — test-only, in memory. A marker-based kind no theme has art for, and a wall-based one that
 * presents no terrain entry, so it is walkable and its wall look lies (⛓ PASS-1 keeps refusing it; a BLOCKED wall-based
 * kind is `mazeTilePass.test.js`'s).
 */
const FIXTURE = 'tile3-fixture';
const LANTERN = `${FIXTURE}:object/lantern`;
const PILLAR = `${FIXTURE}:object/pillar`;
const FIXTURE_CONCEPTS = {
    schema_version: 1,
    concepts: {
        [LANTERN]: { kind: 'object', name: 'A Lantern', art: `${FIXTURE}:tile/lantern`, base: 'marker' },
        [PILLAR]: { kind: 'object', name: 'A Pillar', base: 'wall' },
    },
};
/** The committed packs from disk, the fixture from memory. */
const readJson = withFixtureProvenance(async (url) => {
    if (url === `${PACKS}${FIXTURE}/pack.json`) {
        return { schema_version: 1, id: FIXTURE, title: 'TILE-3 fixture', licence: 'CC0', layers: { concepts: 'concepts/manifest.json' } };
    }
    if (url === `${PACKS}${FIXTURE}/concepts/manifest.json`) return structuredClone(FIXTURE_CONCEPTS);
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
});
const load = (ids) => loadMazeTileArt(ids, {
    base: PACKS, readJson, decode: async (u) => ({ src: u }), rasterise: async (s) => ({ s }), contentRoles: MAZE_CONTENT_ROLES,
});

const fresh = () => JSON.parse(JSON.stringify(PAYLOAD));
const freeCells = (w) => {
    const busy = occupiedWorldCells(w);
    const out = [];
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) === TILE_FLOOR && !busy.has(`${x},${y}`)) out.push({ x, y });
    return out;
};
const wallCell = (w) => {
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) === TILE_WALL) return { x, y };
    return null;
};
const ops = (fn) => {
    const ctx = recordingContext();
    fn(ctx);
    return ctx.__log;
};
const containsRun = (log, run) => {
    for (let i = 0; i + run.length <= log.length; i++) if (run.every((op, j) => log[i + j] === op)) return true;
    return false;
};

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. the op, the palette entry, and every refusal by name', () => {
    it('the fixture stack declares its two kinds; a wall-based one is not offered', async () => {
        const { tileKinds } = await load([FIXTURE]);
        expect(Object.keys(tileKinds)).toEqual(Object.keys(FIXTURE_CONCEPTS.concepts));
        expect(placeableTileKinds(tileKinds)).toEqual([LANTERN]);
        const ed = new MazeRoomEditor();
        ed.setTileKinds(tileKinds);
        expect(ed.selectedTileKind).toBe(LANTERN);
        expect(PALETTE_ENTRIES.map((e) => e.type)).toContain(PALETTE_TYPES.TILE_KIND);
        ed.selectType(PALETTE_TYPES.TILE_KIND);
        expect(ed.opFor(1, 2)).toEqual({ op: 'setTileKind', x: 1, y: 2, kind: LANTERN });
    });

    it('each refusal names its reason', async () => {
        const { tileKinds } = await load([FIXTURE]);
        // the registry's world: it carries the region's things (the occupancy rule counts them)
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a] = freeCells(w);
        const wall = wallCell(w);
        const at = (cell, kind, declared = tileKinds) => applyEditOp(w, { op: 'setTileKind', ...cell, kind }, { tileKinds: declared });
        expect(at(a, LANTERN, null)).toMatchObject({ ok: false, reason: 'no-tile-kinds' });
        expect(at(a, 'other:object/x')).toMatchObject({ ok: false, reason: 'undeclared-tile-kind', description: tileKindRefusal('other:object/x', tileKinds).description });
        expect(at(a, PILLAR)).toMatchObject({ ok: false, reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase(PILLAR, 'walkable') });
        expect(at(wall, LANTERN)).toMatchObject({ ok: false, reason: 'wall-tile' });
        expect(at(w.entrance, LANTERN)).toMatchObject({ ok: false, reason: 'occupied', description: TILE_KIND_REFUSALS.occupied(w.entrance.x, w.entrance.y) });
        const thing = w.things[0];
        expect(at(thing, LANTERN)).toMatchObject({ ok: false, reason: 'occupied' });
        expect(w.tileKinds).toBeUndefined(); // nothing was placed by a refusal
    });

    it('a placed kind\'s cell takes no entity and no wall; clearEntity removes it; placing again replaces', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a] = freeCells(w);
        expect(applyEditOp(w, { op: 'setTileKind', ...a, kind: LANTERN }, { tileKinds })).toMatchObject({ ok: true, op: { op: 'setTileKind', ...a, kind: LANTERN } });
        expect(w.tileKinds.get(`${a.x},${a.y}`)).toBe(LANTERN);
        for (const op of [{ op: 'setTile', tile: 'wall' }, { op: 'setItem', id: 'key_green' }, { op: 'setBlock' }, { op: 'setEntrance' }]) {
            expect(applyEditOp(w, { ...op, ...a }), op.op).toMatchObject({ ok: false, reason: 'occupied-tile-kind' });
        }
        expect(applyEditOp(w, { op: 'setTileKind', ...a, kind: LANTERN }, { tileKinds }).description).toMatch(/already holds/);
        expect(applyEditOp(w, { op: 'clearEntity', ...a })).toMatchObject({ ok: true, description: `Erased tile kind ${LANTERN} at (${a.x},${a.y}).` });
        expect(w.tileKinds).toBeUndefined();
    });
});

describe('2. copy/paste carries a placed kind', () => {
    it('readMazeCell reports it and mazeWriteOps writes it back', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: LANTERN }, { tileKinds });
        const desc = readMazeCell(w, a.x, a.y);
        expect(desc.entity).toEqual({ tileKind: LANTERN });
        const s = createEditSession(createMazeEditAdapter({ tileKinds: () => tileKinds }), w);
        for (const op of mazeWriteOps(desc, b.x, b.y)) expect(s.apply(op).ok).toBe(true);
        expect(s.record().tileKinds.get(`${b.x},${b.y}`)).toBe(LANTERN);
    });
});

describe('3. ⛓ THE PROOF: place with the editor in a real world, save, reload, draw', () => {
    it('round-trips, and draws as the marker base in both views; nothing throws', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // The world's stack for the drawing: the maze's default pack, the meta theme, the fixture. And without art.
        const themed = await load(['maze', 'meta', FIXTURE]);
        expect(themed.tileArt).not.toBeNull();
        expect(themed.tileArt.art.has(FIXTURE_CONCEPTS.concepts[LANTERN].art)).toBe(false); // no theme has its art

        // ── the APWorld editor opens the room for the lab: a one-entry library
        const opened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: fresh() });
        const setSession = createSetSession(createMazeSetAdapter(), setRecord(opened.session.record));
        // ── the lab opens room 0 (as `mazeLabView` does) and the palette places the fixture's kind
        const roomWorld = deserializeMazeWorldWithKinds(setSession.record().library.entries[0].payload);
        const adapter = createMazeEditAdapter({ tileKinds: () => themed.tileKinds });
        const room = createEditSession(adapter, roomWorld);
        const editor = new MazeRoomEditor();
        editor.setTileKinds(themed.tileKinds);
        editor.selectType(PALETTE_TYPES.TILE_KIND);
        const [cell] = freeCells(roomWorld).filter((c) => !(PAYLOAD.things ?? []).some((t) => t.x === c.x && t.y === c.y));
        expect(room.apply(editor.opFor(cell.x, cell.y))).toMatchObject({ ok: true });
        // ── the room closes into the library; the APWorld editor saves
        closeRoomSession(setSession, room, 0);
        const saved = mazeRegionRoundTrip.save(setSession.record(), { regionId: REGION_ID, payload: fresh() });
        expect(saved.payload.tileKinds).toEqual([{ ...cell, kind: LANTERN }]);
        // ⛔ no logic moved: the exits and locations the save re-derives are the unedited save's
        const control = mazeRegionRoundTrip.save(opened.unedited, { regionId: REGION_ID, payload: fresh() });
        expect(saved.exits).toEqual(control.exits);
        expect(saved.locations).toEqual(control.locations);
        // the thing stayed on its cell
        expect(saved.payload.things).toEqual(PAYLOAD.things);

        // ── reload: the registry's deserializer (what every view reads), and a second open
        const reloaded = substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(saved.payload)));
        expect([...reloaded.tileKinds]).toEqual([[`${cell.x},${cell.y}`, LANTERN]]);
        const reopened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: saved.payload });
        expect(reopened.session.record.entries[0].payload.tileKinds).toEqual(saved.payload.tileKinds);

        // ── both views, with no theme art and with the meta theme: the marker base at the kind's cell
        for (const tileArt of [null, themed.tileArt]) {
            const single = ops((ctx) => {
                drawWorld(ctx, reloaded, plainView({ tilePx: PX, tileArt }));
                const draws = drawMazeTileKinds(ctx, reloaded, {
                    tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt, tileKinds: themed.tileKinds,
                });
                expect(draws).toEqual([{ ...cell, kind: LANTERN, as: 'base' }]);
            });
            expect(containsRun(single, ops((ctx) => paintMazeTileBase(ctx, 'marker', cell.x * PX, cell.y * PX, PX)))).toBe(true);
            const [offX, offY] = [48, 32];
            const composite = ops((ctx) => drawMazeCompositeRegion(ctx, { playable_payload: reloaded }, {
                offX, offY, tilePx: PX, tileArt, tileKinds: themed.tileKinds,
            }));
            expect(containsRun(composite, ops((ctx) => paintMazeTileBase(ctx, 'marker', offX + cell.x * PX, offY + cell.y * PX, PX)))).toBe(true);
        }
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('4. `?packs=`', () => {
    it('a comma list in stack order; absent or empty is null; a bad id is refused by name', () => {
        expect(readPacksParam('maze,meta')).toEqual(['maze', 'meta']);
        expect(readPacksParam(null)).toBeNull();
        expect(readPacksParam('')).toBeNull();
        expect(() => readPacksParam('maze,Bad Id')).toThrow(/\?packs= names "Bad Id", which is not a content pack id/);
    });
});
