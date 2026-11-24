/**
 * CONTENT SETS PASS-1 — **DECLARED PASSABILITY: `walkable` / `blocked`, END TO END** (⚖ the user 2026-11-18: "One per
 * slice", "Pack declares, world copies", "Separate, no lying looks"; planner: floor over a blocked kind is refused,
 * the declaration lives in `structure` as a `terrain` entry the concept presents).
 *
 *   1. The lookup: `tileKindKeys` reads each kind's pass through the structure layer; every look/logic refusal by name.
 *   2. The editor: `setTileKind` bakes and lowers (a blocked kind writes a wall), `clearEntity` restores floor, floor
 *      over a blocked kind is refused, copy/paste carries it. The payload's `pass` and its refusals.
 *   3. ⛓ THE PROOF, on a REAL committed world (the meta trial's maze region with a thing) with a TEST-ONLY fixture pack
 *      held in memory (no committed pack or preset gains it): the lab's SET arm places one blocked and one walkable
 *      kind, the round trip saves, the registry reloads. The blocked kind's re-derived exits and locations equal a
 *      hand-painted wall's on the same cell; `bfsSolver`, `step` and the autopather refuse to enter it and `whyBlocked`
 *      says wall; the walkable kind changes nothing; both views draw both kinds over their bases.
 *   4. Drift: a pack change after the save is reported by name and never rewrites the world.
 *   5. Outside the engine closure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';
import { DEFAULT_TERRAIN_PASS, TERRAIN_PASSES } from '../packConcepts/packConcepts.js';
import { recordingContext } from './drawOpRecorder.js';
import {
    INPUTS, TILE_FLOOR, TILE_WALL, bfsSolver, createState, getTile, isFloor, step, whyBlocked,
} from './mazeRoomEngine.js';
import { findPath } from './mazeAutopather.js';
import { drawWorld, plainView } from './mazeRoomRender.js';
import { MAZE_CONTENT_ROLES } from './mazeContent.js';
import { drawMazeCompositeRegion } from './mazeCompositeMap.js';
import { createMazeEditAdapter, mazeWriteOps, readMazeCell } from './mazeEditAdapter.js';
import { MazeRoomEditor, PALETTE_TYPES, applyEditOp, placeableTileKinds } from './mazeRoomEditor.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { mazeRegionRoundTrip } from './mazeRegionRoundTrip.js';
import { closeRoomSession, createMazeSetAdapter, createSetSession, setRecord } from './mazeSetAdapter.js';
import { WRITTEN_TILE_KIND_PASSES, serializeMazeWorld } from './mazeSerializer.js';
import { drawMazeTileKinds } from './mazeTileKindOverlay.js';
import {
    MazeTileKindError, TILE_KIND_REFUSALS, deserializeMazeWorldWithKinds, occupiedWorldCells, placedTileKindDrift,
    placedTileKindRefusals, tileKindRefusal, tileKindsList,
} from './mazeTileKinds.js';
import { loadMazeTileArt, paintMazeTileBase, resetMazeTilePlaceholderLogForTests } from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(HERE, '../../packs')}/`).href;
const META = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const [REGION_ID, PAYLOAD] = Object.entries(META.preset_sidecars['1'])
    .filter(([, sc]) => sc.substrate === 'maze' && sc.playable_payload?.things?.length)
    .map(([id, sc]) => [id, sc.playable_payload])[0];
const PX = 16;
const BLOCKED = 'blocked';

/**
 * ⛔ THE FIXTURE PACK — test-only, in memory. Its `structure` layer declares the passability (`terrain` entries) and
 * its concepts present them (Z.1: the words carry no logic):
 *   · PILLAR  base wall,   blocked   — the wall look a blocked kind may now have;
 *   · RUG     base marker, walkable  — a marker goes with either value;
 *   · STATUE  base marker, blocked;
 *   · LIAR_WALL  base wall,  walkable — a lying look, refused;
 *   · LIAR_FLOOR base floor, blocked  — a lying look, refused;
 *   · GHOST   presents a terrain entry the structure does not hold — its pass cannot be read, refused.
 */
const FIXTURE = 'pass1-fixture';
const K = (slug) => `${FIXTURE}:terrain/${slug}`;
const [PILLAR, RUG, STATUE, LIAR_WALL, LIAR_FLOOR, GHOST] = ['pillar', 'rug', 'statue', 'painted-wall', 'trapdoor', 'ghost'].map(K);
const TERRAIN = { [PILLAR]: BLOCKED, [RUG]: 'walkable', [STATUE]: BLOCKED, [LIAR_WALL]: 'walkable', [LIAR_FLOOR]: BLOCKED };
const BASES = { [PILLAR]: 'wall', [RUG]: 'marker', [STATUE]: 'marker', [LIAR_WALL]: 'wall', [LIAR_FLOOR]: 'floor', [GHOST]: 'marker' };
const structureOf = (terrain) => ({
    schema_version: 1,
    entries: Object.fromEntries(Object.entries(terrain).map(([k, pass]) => [k, { kind: 'terrain', pass }])),
});
const CONCEPTS = {
    schema_version: 1,
    concepts: Object.fromEntries(Object.entries(BASES).map(([k, base]) => [k, { kind: 'terrain', name: k, base, presents: k }])),
};
/** The committed packs from disk, the fixture from memory; `terrain` replaces the fixture's structure (a pack change). */
const readerFor = (terrain) => withFixtureProvenance(async (url) => {
    if (url === `${PACKS}${FIXTURE}/pack.json`) {
        return {
            schema_version: 1, id: FIXTURE, title: 'PASS-1 fixture', licence: 'CC0',
            layers: { structure: 'structure/manifest.json', concepts: 'concepts/manifest.json' },
        };
    }
    if (url === `${PACKS}${FIXTURE}/structure/manifest.json`) return structureOf(terrain);
    if (url === `${PACKS}${FIXTURE}/concepts/manifest.json`) return structuredClone(CONCEPTS);
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
});
const load = (ids, terrain = TERRAIN) => loadMazeTileArt(ids, {
    base: PACKS, readJson: readerFor(terrain), decode: async (u) => ({ src: u }), rasterise: async (s) => ({ s }),
    contentRoles: MAZE_CONTENT_ROLES,
});

const fresh = () => JSON.parse(JSON.stringify(PAYLOAD));
const key = (c) => `${c.x},${c.y}`;
const freeCells = (w) => {
    const busy = occupiedWorldCells(w);
    const out = [];
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) === TILE_FLOOR && !busy.has(key({ x, y }))) out.push({ x, y });
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
const DELTA = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });
/** The player reaches `cell` from the entrance (the engine's own search, over the full state). */
const reaches = (world, cell) => bfsSolver({
    world, startState: createState(world), goalPred: (s) => s.player_pos.x === cell.x && s.player_pos.y === cell.y,
    options: { budget: 200000 },
});

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. the lookup reads each kind\'s pass through the structure layer; the look must not lie', () => {
    it('tileKindKeys: the declared pass of each kind; an unreadable one is null with its reason', async () => {
        const { tileKinds } = await load([FIXTURE]);
        for (const [k, pass] of Object.entries(TERRAIN)) expect(tileKinds[k].pass, k).toBe(pass);
        expect(tileKinds[GHOST].pass).toBeNull();
        expect(tileKinds[GHOST].passError).toMatch(new RegExp(`presents "${GHOST}", which no structure in the stack holds`));
        // A kind the maze's own packs declare presents no terrain: walkable (TILE-3's meaning, unchanged).
        expect(Object.values((await load(['maze', 'meta'])).tileKinds).every((d) => d.pass === DEFAULT_TERRAIN_PASS)).toBe(true);
    });

    it('every refusal of a declared kind, by name; the palette offers exactly the rest', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const want = {
            [LIAR_WALL]: { reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase(LIAR_WALL, TERRAIN[LIAR_WALL]) },
            [LIAR_FLOOR]: { reason: 'floor-base-not-walkable-tile-kind', description: TILE_KIND_REFUSALS.floorBaseNotWalkable(LIAR_FLOOR, TERRAIN[LIAR_FLOOR]) },
            [GHOST]: { reason: 'unreadable-pass-tile-kind', description: TILE_KIND_REFUSALS.passUnread(GHOST, tileKinds[GHOST].passError) },
        };
        for (const k of Object.keys(tileKinds)) expect(tileKindRefusal(k, tileKinds), k).toEqual(want[k] ?? null);
        expect(placeableTileKinds(tileKinds)).toEqual(Object.keys(tileKinds).filter((k) => !(k in want)));
        expect(placeableTileKinds(tileKinds)).toContain(PILLAR); // ⛓ a wall look is placeable when it is blocked
    });
});

describe('2. the editor bakes and lowers; the payload carries the copy', () => {
    it('a blocked kind writes a wall under itself; floor over it is refused; erase restores floor; replace re-lowers', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a] = freeCells(w);
        const at = (op) => applyEditOp(w, { ...op, ...a }, { tileKinds });
        expect(at({ op: 'setTileKind', kind: PILLAR })).toMatchObject({ ok: true, op: { op: 'setTileKind', ...a, kind: PILLAR } });
        expect(getTile(w, a.x, a.y)).toBe(TILE_WALL);
        expect(tileKindsList(w)).toEqual([{ ...a, kind: PILLAR, pass: BLOCKED }]);
        expect(at({ op: 'setTile', tile: 'floor' })).toEqual({
            ok: false, type: 'noop', reason: 'blocked-tile-kind', description: TILE_KIND_REFUSALS.floorOverBlocked(a.x, a.y, PILLAR), op: null,
        });
        for (const op of [{ op: 'setTile', tile: 'wall' }, { op: 'setItem', id: 'key_green' }, { op: 'setEntrance' }]) {
            expect(at(op), op.op).toMatchObject({ ok: false, reason: 'occupied-tile-kind' });
        }
        expect(getTile(w, a.x, a.y)).toBe(TILE_WALL);
        expect(at({ op: 'setTileKind', kind: PILLAR }).description).toMatch(/already holds/);
        // a walkable kind replacing it gives the floor back; a blocked one walls it again
        expect(at({ op: 'setTileKind', kind: RUG })).toMatchObject({ ok: true });
        expect(getTile(w, a.x, a.y)).toBe(TILE_FLOOR);
        expect(tileKindsList(w)).toEqual([{ ...a, kind: RUG }]);
        expect(at({ op: 'setTile', tile: 'floor' }).ok).toBe(true); // TILE-3: a no-op on a walkable kind
        expect(at({ op: 'setTileKind', kind: STATUE })).toMatchObject({ ok: true });
        expect(getTile(w, a.x, a.y)).toBe(TILE_WALL);
        expect(at({ op: 'clearEntity' })).toMatchObject({ ok: true, description: `Erased tile kind ${STATUE} at (${a.x},${a.y}).` });
        expect(getTile(w, a.x, a.y)).toBe(TILE_FLOOR);
        expect(w.tileKinds).toBeUndefined();
    });

    it('the placement refusals: a lying look, a painted wall, the entrance; nothing is written by a refusal', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const before = Array.from(w.tiles);
        const [a] = freeCells(w);
        const at = (cell, kind) => applyEditOp(w, { op: 'setTileKind', ...cell, kind }, { tileKinds });
        expect(at(a, LIAR_WALL)).toMatchObject({ ok: false, reason: 'wall-base-tile-kind' });
        expect(at(a, LIAR_FLOOR)).toMatchObject({ ok: false, reason: 'floor-base-not-walkable-tile-kind' });
        expect(at(a, GHOST)).toMatchObject({ ok: false, reason: 'unreadable-pass-tile-kind' });
        expect(at(wallCell(w), PILLAR)).toMatchObject({ ok: false, reason: 'wall-tile' });
        expect(at(w.entrance, PILLAR)).toMatchObject({ ok: false, reason: 'occupied' });
        expect(at(w.things[0], PILLAR)).toMatchObject({ ok: false, reason: 'occupied' });
        expect(w.tileKinds).toBeUndefined();
        expect(Array.from(w.tiles)).toEqual(before);
    });

    it('copy/paste carries a blocked kind: the cell reads as the floor it took, and the paste lowers it again', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: PILLAR }, { tileKinds });
        const desc = readMazeCell(w, a.x, a.y);
        expect(desc).toEqual({ tile: 'floor', entity: { tileKind: PILLAR } });
        const s = createEditSession(createMazeEditAdapter({ tileKinds: () => tileKinds }), w);
        for (const op of mazeWriteOps(desc, b.x, b.y)) expect(s.apply(op).ok, op.op).toBe(true);
        const out = s.record();
        expect(out.tileKinds.get(key(b))).toBe(PILLAR);
        expect(getTile(out, b.x, b.y)).toBe(TILE_WALL);
    });

    it('the payload: `pass` written only when not walkable; a pass that does not match its cell, or is not written, is refused', () => {
        expect(WRITTEN_TILE_KIND_PASSES).toEqual(TERRAIN_PASSES.filter((p) => p !== DEFAULT_TERRAIN_PASS));
        const fields = sidecarFieldsOf(substrateRegistryEntry);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a] = freeCells(w);
        const wall = wallCell(w);
        const ok = { ...fresh(), tileKinds: [{ ...wall, kind: PILLAR, pass: BLOCKED }, { ...a, kind: RUG }] };
        expect(sidecarPayloadErrors(fields, ok)).toEqual([]);
        expect(serializeMazeWorld(substrateRegistryEntry.deserializeWorld(ok), { region_id: REGION_ID }).tileKinds)
            .toEqual([...ok.tileKinds].sort((p, q) => (p.y - q.y) || (p.x - q.x)));
        const refused = (list) => {
            try { substrateRegistryEntry.deserializeWorld({ ...fresh(), tileKinds: list }); } catch (e) { return e; }
            return null;
        };
        for (const pass of [DEFAULT_TERRAIN_PASS, 'sink']) {
            const e = refused([{ ...a, kind: RUG, pass }]);
            expect(e, pass).toBeInstanceOf(MazeTileKindError);
            expect(e.message).toMatch(new RegExp(`entry 0: pass "${pass}" is not one a payload writes`));
            expect(sidecarPayloadErrors(fields, { ...fresh(), tileKinds: [{ ...a, kind: RUG, pass }] })).not.toEqual([]);
        }
        expect(refused([{ ...a, kind: PILLAR, pass: BLOCKED }]).message).toBe(TILE_KIND_REFUSALS.passMismatch(a.x, a.y, PILLAR, BLOCKED));
        expect(refused([{ ...wall, kind: PILLAR }]).message).toBe(TILE_KIND_REFUSALS.passMismatch(wall.x, wall.y, PILLAR, DEFAULT_TERRAIN_PASS));
    });
});

describe('3. ⛓ THE PROOF: the lab places, the round trip saves, the registry reloads', () => {
    /** Open the room as the lab's SET arm does, apply `opsFor(room, editor)`, close it, save. */
    const saveAfter = (declared, apply) => {
        const opened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: fresh() });
        const setSession = createSetSession(createMazeSetAdapter(), setRecord(opened.session.record));
        const roomWorld = deserializeMazeWorldWithKinds(setSession.record().library.entries[0].payload);
        const room = createEditSession(createMazeEditAdapter({ tileKinds: () => declared }), roomWorld);
        const editor = new MazeRoomEditor();
        editor.setTileKinds(declared);
        apply(room, editor);
        closeRoomSession(setSession, room, 0);
        return { saved: mazeRegionRoundTrip.save(setSession.record(), { regionId: REGION_ID, payload: fresh() }), opened };
    };
    const press = (room, editor, type, cell, kind) => {
        editor.selectType(type);
        if (kind) editor.selectTileKind(kind);
        const r = room.apply(editor.opFor(cell.x, cell.y));
        expect(r, `${type} ${kind ?? ''} at ${key(cell)}`).toMatchObject({ ok: true });
    };

    it('a blocked kind is a hand-painted wall to every reader; a walkable kind changes nothing; both views draw both', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const themed = await load(['maze', 'meta', FIXTURE]);
        const declared = themed.tileKinds;
        const plain = substrateRegistryEntry.deserializeWorld(fresh());
        // Two free cells (not a thing's), each with a free floor neighbour the player reaches: the blocked kind's cell
        // and the walkable kind's. Read off the world, so the proof follows the data.
        const thingCells = new Set((PAYLOAD.things ?? []).map(key));
        const free = freeCells(plain).filter((c) => !thingCells.has(key(c)));
        const freeSet = new Set(free.map(key));
        const withDoor = free.flatMap((c) => INPUTS.filter((d) => DELTA[d]).map((d) => {
            const n = { x: c.x - DELTA[d][0], y: c.y - DELTA[d][1] };
            return freeSet.has(key(n)) ? { cell: c, from: n, dir: d } : null;
        }).filter(Boolean).slice(0, 1)).filter((p) => reaches(plain, p.from).ok && reaches(plain, p.cell).ok);
        expect(withDoor.length).toBeGreaterThan(1);
        const blockedAt = withDoor[0];
        const rugAt = withDoor.find((p) => key(p.cell) !== key(blockedAt.cell) && key(p.cell) !== key(blockedAt.from)
            && key(p.from) !== key(blockedAt.cell));
        const [p, r] = [blockedAt.cell, rugAt.cell];

        // ── the lab: a TILE KIND press for each, by the palette
        const { saved, opened } = saveAfter(declared, (room, editor) => {
            press(room, editor, PALETTE_TYPES.TILE_KIND, p, PILLAR);
            press(room, editor, PALETTE_TYPES.TILE_KIND, r, RUG);
        });
        expect(saved.payload.tileKinds).toEqual([{ ...p, kind: PILLAR, pass: BLOCKED }, { ...r, kind: RUG }]
            .sort((a, b) => (a.y - b.y) || (a.x - b.x)));
        expect(saved.payload.things).toEqual(PAYLOAD.things);

        // ── the controls: the same cell walled by hand with no kind; the rug alone; nothing at all
        const { saved: handWall } = saveAfter(declared, (room, editor) => press(room, editor, PALETTE_TYPES.WALL, p));
        const { saved: rugOnly } = saveAfter(declared, (room, editor) => press(room, editor, PALETTE_TYPES.TILE_KIND, r, RUG));
        const unedited = mazeRegionRoundTrip.save(opened.unedited, { regionId: REGION_ID, payload: fresh() });
        expect('tileKinds' in handWall.payload).toBe(false);
        // the cell walls off something (measured: the exits' rules move), so the equality below is not vacuous
        expect(JSON.stringify([handWall.exits, handWall.locations])).not.toBe(JSON.stringify([unedited.exits, unedited.locations]));
        expect(saved.payload.tiles).toEqual(handWall.payload.tiles);
        expect(saved.exits).toEqual(handWall.exits);
        expect(saved.locations).toEqual(handWall.locations);
        // the walkable kind changes nothing, and writes no `pass`
        expect(rugOnly.payload.tileKinds).toEqual([{ ...r, kind: RUG }]);
        expect(rugOnly.payload.tiles).toEqual(unedited.payload.tiles);
        expect(rugOnly.exits).toEqual(unedited.exits);
        expect(rugOnly.locations).toEqual(unedited.locations);

        // ── reload: the registry's deserializer (what every view reads), and a second open
        const reloaded = substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(saved.payload)));
        expect(new Map(reloaded.tileKinds)).toEqual(new Map([[key(p), PILLAR], [key(r), RUG]]));
        expect(getTile(reloaded, p.x, p.y)).toBe(TILE_WALL);
        expect(mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: saved.payload }).session.record.entries[0].payload.tileKinds)
            .toEqual(saved.payload.tileKinds);
        expect(placedTileKindRefusals(reloaded, declared)).toEqual([]);
        expect(placedTileKindDrift(reloaded, declared)).toEqual([]);

        // ── the readers: the engine's search, its step and its sentence, and the autopather
        expect(reaches(reloaded, p)).toMatchObject({ ok: false, reason: 'unreachable' });
        expect(reaches(reloaded, r).ok).toBe(true);
        const at = { ...createState(reloaded), player_pos: { ...blockedAt.from } };
        expect(step(reloaded, at, blockedAt.dir)).toBeNull();
        expect(whyBlocked(reloaded, at, blockedAt.dir)).toMatch(/wall/);
        expect(isFloor(reloaded, p.x, p.y)).toBe(false);
        expect(findPath(reloaded, blockedAt.from, { kind: 'tile', ...p })).toBeNull();
        const toRug = findPath(reloaded, reloaded.entrance, { kind: 'tile', ...r });
        expect(toRug).not.toBeNull();
        expect(toRug.steps.some((s) => key(s) === key(p))).toBe(false);
        expect(findPath(plain, blockedAt.from, { kind: 'tile', ...p })).not.toBeNull(); // the control: it was open

        // ── both views, with no theme art and with the meta theme: each kind's base over its cell
        const want = (offX, offY) => [[p, 'wall'], [r, 'marker']]
            .map(([c, base]) => ops((ctx) => paintMazeTileBase(ctx, base, offX + c.x * PX, offY + c.y * PX, PX)));
        for (const tileArt of [null, themed.tileArt]) {
            const single = ops((ctx) => {
                drawWorld(ctx, reloaded, plainView({ tilePx: PX, tileArt }));
                const draws = drawMazeTileKinds(ctx, reloaded, {
                    tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt, tileKinds: declared,
                });
                expect(draws).toEqual([{ ...p, kind: PILLAR, as: 'base' }, { ...r, kind: RUG, as: 'base' }]
                    .sort((a, b) => (a.y - b.y) || (a.x - b.x)));
            });
            for (const run of want(0, 0)) expect(containsRun(single, run)).toBe(true);
            const [offX, offY] = [48, 32];
            const composite = ops((ctx) => drawMazeCompositeRegion(ctx, { playable_payload: reloaded }, {
                offX, offY, tilePx: PX, tileArt, tileKinds: declared,
            }));
            for (const run of want(offX, offY)) expect(containsRun(composite, run)).toBe(true);
        }
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('4. drift: a pack change never rewrites a saved world; it is reported by name', () => {
    it('a kind baked blocked that the pack now declares walkable (and back): listed, the world kept as saved', async () => {
        const before = (await load([FIXTURE])).tileKinds;
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: STATUE }, { tileKinds: before });
        applyEditOp(w, { op: 'setTileKind', ...b, kind: RUG }, { tileKinds: before });
        const payload = serializeMazeWorld(w, { region_id: REGION_ID });
        // the pack changes after the save: the statue is walkable now, the rug blocked
        const after = (await load([FIXTURE], { ...TERRAIN, [STATUE]: 'walkable', [RUG]: BLOCKED })).tileKinds;
        const reloaded = substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(payload))); // not refused
        expect(getTile(reloaded, a.x, a.y)).toBe(TILE_WALL); // ⛔ never re-lowered
        expect(getTile(reloaded, b.x, b.y)).toBe(TILE_FLOOR);
        const drift = (c, kind, baked, now) => ({
            ...c, kind, baked, declared: now, reason: 'tile-kind-pass-drift', description: TILE_KIND_REFUSALS.drift(c.x, c.y, kind, baked, now),
        });
        expect(placedTileKindDrift(reloaded, after)).toEqual([drift(a, STATUE, BLOCKED, 'walkable'), drift(b, RUG, 'walkable', BLOCKED)]
            .sort((p, q) => (p.y - q.y) || (p.x - q.x)));
        expect(placedTileKindDrift(reloaded, before)).toEqual([]);
        expect(serializeMazeWorld(reloaded, { region_id: REGION_ID }).tileKinds).toEqual(payload.tileKinds);
        // re-placing the kind takes the pack's current value (the one way a world moves: an edit)
        expect(applyEditOp(reloaded, { op: 'setTileKind', ...a, kind: STATUE }, { tileKinds: after }).ok).toBe(true);
        expect(getTile(reloaded, a.x, a.y)).toBe(TILE_FLOOR);
        expect(placedTileKindDrift(reloaded, after).map((d) => d.kind)).toEqual([RUG]);
    });
});

describe('5. outside the engine closure', () => {
    it('no file PASS-1 reads or writes `pass` in is in the closure `engineMd5` hashes', () => {
        const engine = new Set(importClosure());
        const files = ['mazeRoom/mazeTileKinds.js', 'mazeRoom/mazeSerializer.js', 'mazeRoom/mazeRoomEditor.js', 'mazeRoom/mazeTileArt.js',
            'mazeRoom/mazeEditAdapter.js', 'packStructure/packStructure.js', 'packConcepts/packConcepts.js'];
        for (const f of files) expect(engine.has(relative(ROOT, join(HERE, '..', f))), f).toBe(false);
    });
});
