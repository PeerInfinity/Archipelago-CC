/**
 * CONTENT SETS PASS-3 — **DECLARED PASSABILITY: `one-way`, END TO END** (⚖ the user 2026-11-18: "One per slice",
 * "Pack declares, world copies", "Separate, no lying looks"; 2026-11-19: "Yes, please continue" past the part-1
 * checkpoint). `dirs` names the MOVE directions that may enter the cell; the lowering is the engine's `entry_gates`,
 * `gate: null` for every other direction (part 0 made every reader honour them).
 *
 *   1. The lookup and the declared-kind refusals (a lying look).
 *   2. The editor: place / replace / erase restore the cell's gates exactly; floor over it refused; a cell with the
 *      world's own entry gates refused; copy/paste. The payload's `dirs` and every ownership refusal.
 *   3. ⛓ THE PROOF, on the meta trial's maze region (a corridor) with a TEST-ONLY in-memory fixture pack: the lab's SET
 *      arm places the kind, the round trip saves, the registry reloads. The compiled rules equal HAND-PLACED
 *      `entry_gates` on the same cell; along the declared direction nothing moves, against it the exit is cut off;
 *      `bfsSolver`, the extractor and the autopather agree both ways; `whyBlocked` names the one-way; both views draw it.
 *   4. The round trip keeps a document's own entry gates beside the kind's, and drops the kind's on erase.
 *   5. Drift; and outside the engine closure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';
import { recordingContext } from './drawOpRecorder.js';
import {
    TILE_FLOOR, bfsSolver, createState, extractPathsAndObstacles, getTile, step, whyBlocked,
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
import { serializeMazeWorld } from './mazeSerializer.js';
import { drawMazeTileKinds } from './mazeTileKindOverlay.js';
import {
    MazeTileKindError, ONE_WAY_PASS, TERRAIN_DIRS, TILE_KIND_REFUSALS, deserializeMazeWorldWithKinds, occupiedWorldCells,
    placedTileKindDrift, tileKindRefusal, tileKindsList,
} from './mazeTileKinds.js';
import { cloneWorld } from './procgenMaze.js';
import { loadMazeTileArt, paintMazeTileBase, resetMazeTilePlaceholderLogForTests } from './mazeTileArt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(HERE, '../../packs')}/`).href;
const META = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8'));
const [REGION_ID, PAYLOAD] = Object.entries(META.preset_sidecars['1'])
    .filter(([, sc]) => sc.substrate === 'maze' && sc.playable_payload?.things?.length)
    .map(([id, sc]) => [id, sc.playable_payload])[0];
const PX = 16;
const DELTA = Object.freeze({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] });
const OPPOSITE = Object.freeze({ N: 'S', S: 'N', E: 'W', W: 'E' });

/**
 * ⛔ THE FIXTURE PACK — test-only, in memory. Its `structure` declares the terrain, its concepts present it:
 *   · LEDGE_W / LEDGE_E  base marker, one-way, entered moving W / E (the proof's pair);
 *   · TURNSTILE          base character, one-way N,S (two directions);
 *   · RUG                base marker, walkable;
 *   · PAINTED            base floor, one-way — a lying look (a plain floor that is not walkable), refused;
 *   · CLIFF              base wall, one-way  — a lying look (a wall that is not blocked), refused.
 */
const FIXTURE = 'pass3-fixture';
const K = (slug) => `${FIXTURE}:terrain/${slug}`;
const [LEDGE_W, LEDGE_E, TURNSTILE, RUG, PAINTED, CLIFF] = ['ledge-w', 'ledge-e', 'turnstile', 'rug', 'painted', 'cliff'].map(K);
const TERRAIN = {
    [LEDGE_W]: { pass: ONE_WAY_PASS, dirs: ['W'] }, [LEDGE_E]: { pass: ONE_WAY_PASS, dirs: ['E'] },
    [TURNSTILE]: { pass: ONE_WAY_PASS, dirs: ['S', 'N'] }, [RUG]: { pass: 'walkable' },
    [PAINTED]: { pass: ONE_WAY_PASS, dirs: ['E'] }, [CLIFF]: { pass: ONE_WAY_PASS, dirs: ['E'] },
};
const BASES = { [LEDGE_W]: 'marker', [LEDGE_E]: 'marker', [TURNSTILE]: 'character', [RUG]: 'marker', [PAINTED]: 'floor', [CLIFF]: 'wall' };
const readerFor = (terrain) => withFixtureProvenance(async (url) => {
    if (url === `${PACKS}${FIXTURE}/pack.json`) {
        return {
            schema_version: 1, id: FIXTURE, title: 'PASS-3 fixture', licence: 'CC0',
            layers: { structure: 'structure/manifest.json', concepts: 'concepts/manifest.json' },
        };
    }
    if (url === `${PACKS}${FIXTURE}/structure/manifest.json`) {
        return { schema_version: 1, entries: Object.fromEntries(Object.entries(terrain).map(([k, t]) => [k, { kind: 'terrain', ...t }])) };
    }
    if (url === `${PACKS}${FIXTURE}/concepts/manifest.json`) {
        return {
            schema_version: 1,
            concepts: Object.fromEntries(Object.entries(BASES).map(([k, base]) => [k, { kind: 'terrain', name: k, base, presents: k }])),
        };
    }
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
});
const load = (ids, terrain = TERRAIN) => loadMazeTileArt(ids, {
    base: PACKS, readJson: readerFor(terrain), decode: async (u) => ({ src: u }), rasterise: async (s) => ({ s }),
    contentRoles: MAZE_CONTENT_ROLES,
});

const fresh = () => JSON.parse(JSON.stringify(PAYLOAD));
const key = (c) => `${c.x},${c.y}`;
const rowOrder = (a, b) => (a.y - b.y) || (a.x - b.x);
const freeCells = (w) => {
    const busy = occupiedWorldCells(w);
    const out = [];
    for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (getTile(w, x, y) === TILE_FLOOR && !busy.has(key({ x, y }))) out.push({ x, y });
    return out;
};
const gatesAt = (w, c) => TERRAIN_DIRS.filter((d) => w.entryGates?.has(`${c.x},${c.y},${d}`)).map((d) => [d, w.entryGates.get(`${c.x},${c.y},${d}`)]);
const nullGates = (c, dirs) => TERRAIN_DIRS.filter((d) => !dirs.includes(d)).map((d) => ({ ...c, dir: d, gate: null }));
const ops = (fn) => {
    const ctx = recordingContext();
    fn(ctx);
    return ctx.__log;
};
const containsRun = (log, run) => {
    for (let i = 0; i + run.length <= log.length; i++) if (run.every((op, j) => log[i + j] === op)) return true;
    return false;
};
const refused = (fn) => {
    try { fn(); } catch (e) { return e; }
    return null;
};

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. the lookup and the declared-kind refusals', () => {
    it('tileKindKeys carries dirs (canonical order) beside its pass; a lying look is refused by name', async () => {
        const { tileKinds } = await load([FIXTURE]);
        expect(tileKinds[TURNSTILE]).toMatchObject({ pass: ONE_WAY_PASS, dirs: ['N', 'S'] });
        expect(tileKinds[LEDGE_E]).toMatchObject({ pass: ONE_WAY_PASS, dirs: ['E'] });
        const want = {
            [PAINTED]: { reason: 'floor-base-not-walkable-tile-kind', description: TILE_KIND_REFUSALS.floorBaseNotWalkable(PAINTED, ONE_WAY_PASS) },
            [CLIFF]: { reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase(CLIFF, ONE_WAY_PASS) },
        };
        for (const k of Object.keys(tileKinds)) expect(tileKindRefusal(k, tileKinds), k).toEqual(want[k] ?? null);
        expect(placeableTileKinds(tileKinds)).toEqual(Object.keys(tileKinds).filter((k) => !(k in want)));
    });
});

describe('2. the editor lowers to entry gates; the payload carries the copy; ownership refused by name', () => {
    it('place → null gates for every other direction; floor over it refused; replace and erase restore the cell exactly', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const before = JSON.stringify(serializeMazeWorld(w, { region_id: REGION_ID }));
        expect(w.entryGates).toBeUndefined();
        const [a] = freeCells(w);
        const at = (op) => applyEditOp(w, { ...op, ...a }, { tileKinds });
        expect(at({ op: 'setTileKind', kind: TURNSTILE })).toMatchObject({
            ok: true, description: `Placed tile kind ${TURNSTILE} at (${a.x},${a.y}) (one-way: entered moving N or S only).`,
        });
        expect(gatesAt(w, a)).toEqual([['E', null], ['W', null]]);
        expect(getTile(w, a.x, a.y)).toBe(TILE_FLOOR);
        expect(tileKindsList(w)).toEqual([{ ...a, kind: TURNSTILE, pass: ONE_WAY_PASS, dirs: ['N', 'S'] }]);
        const out = serializeMazeWorld(w, { region_id: REGION_ID });
        expect(out.entry_gates).toEqual(nullGates(a, ['N', 'S']));
        expect(at({ op: 'setTile', tile: 'floor' })).toEqual({
            ok: false, type: 'noop', reason: 'one-way-tile-kind', description: TILE_KIND_REFUSALS.floorOverBlocked(a.x, a.y, TURNSTILE, ONE_WAY_PASS), op: null,
        });
        expect(at({ op: 'setTileKind', kind: TURNSTILE }).description).toMatch(/already holds/);
        expect(at({ op: 'setTileKind', kind: LEDGE_E })).toMatchObject({ ok: true });
        expect(gatesAt(w, a)).toEqual([['N', null], ['S', null], ['W', null]]);
        expect(at({ op: 'setTileKind', kind: RUG })).toMatchObject({ ok: true });
        expect(w.entryGates).toBeUndefined();
        expect(at({ op: 'setTileKind', kind: LEDGE_W })).toMatchObject({ ok: true });
        expect(at({ op: 'clearEntity' })).toMatchObject({ ok: true, description: `Erased tile kind ${LEDGE_W} at (${a.x},${a.y}).` });
        expect(w.entryGates).toBeUndefined();
        expect(JSON.stringify(serializeMazeWorld(w, { region_id: REGION_ID }))).toBe(before);
    });

    it('a cell carrying the world\'s own entry gates is refused; the gates are copy-on-write', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const [a, b] = freeCells(substrateRegistryEntry.deserializeWorld(fresh()));
        const w = substrateRegistryEntry.deserializeWorld({ ...fresh(), entry_gates: [{ ...a, dir: 'N', gate: null }] });
        expect(applyEditOp(w, { op: 'setTileKind', ...a, kind: RUG }, { tileKinds })).toMatchObject({
            ok: false, reason: 'foreign-entry-gates', description: TILE_KIND_REFUSALS.foreignEntryGates(a.x, a.y),
        });
        const c = cloneWorld(w);
        expect(applyEditOp(w, { op: 'setTileKind', ...b, kind: LEDGE_E }, { tileKinds })).toMatchObject({ ok: true });
        expect(gatesAt(c, b)).toEqual([]);
        // the world's own gate and the kind's, written together
        expect(serializeMazeWorld(w, { region_id: REGION_ID }).entry_gates).toEqual([{ ...a, dir: 'N', gate: null }, ...nullGates(b, ['E'])]);
    });

    it('copy/paste re-lowers the gates at the destination', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: LEDGE_E }, { tileKinds });
        const desc = readMazeCell(w, a.x, a.y);
        expect(desc).toEqual({ tile: 'floor', entity: { tileKind: LEDGE_E } });
        const s = createEditSession(createMazeEditAdapter({ tileKinds: () => tileKinds }), w);
        for (const op of mazeWriteOps(desc, b.x, b.y)) expect(s.apply(op).ok, op.op).toBe(true);
        expect(gatesAt(s.record(), b)).toEqual([['N', null], ['S', null], ['W', null]]);
    });

    it('the payload: dirs with pass one-way; every ownership refusal by name', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const fields = sidecarFieldsOf(substrateRegistryEntry);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: LEDGE_E }, { tileKinds });
        const good = { ...fresh(), ...serializeMazeWorld(w, { region_id: REGION_ID }) };
        expect(sidecarPayloadErrors(fields, good)).toEqual([]);
        expect(serializeMazeWorld(substrateRegistryEntry.deserializeWorld(structuredClone(good)), { region_id: REGION_ID }))
            .toMatchObject({ tileKinds: good.tileKinds, entry_gates: good.entry_gates });
        const variants = {
            'dirs without pass': [(p) => { delete p.tileKinds[0].pass; }, /entry 0: dirs is written with pass "one-way", and only there/],
            'pass without dirs': [(p) => { delete p.tileKinds[0].dirs; }, /entry 0: dirs is written with pass "one-way", and only there/],
            'dirs not in order': [(p) => { p.tileKinds[0].dirs = ['W', 'E']; }, /entry 0: dirs \["W","E"\] is not a proper subset of N, S, E, W written in that order/],
            'dirs of all four': [(p) => { p.tileKinds[0].dirs = [...TERRAIN_DIRS]; }, /is not a proper subset/],
            'a gate missing': [(p) => { p.entry_gates = p.entry_gates.slice(1); },
                TILE_KIND_REFUSALS.entryGatesMismatch(a.x, a.y, LEDGE_E, ['E'], 'S:null W:null')],
            'a gate that is not null': [(p) => { p.entry_gates[0].gate = 'water_gate_0'; },
                TILE_KIND_REFUSALS.entryGatesMismatch(a.x, a.y, LEDGE_E, ['E'], 'N:water_gate_0 S:null W:null')],
            'a gate on a let-in direction': [(p) => { p.entry_gates.push({ ...a, dir: 'E', gate: null }); },
                TILE_KIND_REFUSALS.entryGatesMismatch(a.x, a.y, LEDGE_E, ['E'], 'N:null S:null E:null W:null')],
            'a walkable kind on a gated cell': [(p) => { delete p.tileKinds[0].pass; delete p.tileKinds[0].dirs; },
                TILE_KIND_REFUSALS.entryGatesUnowned(a.x, a.y, LEDGE_E, 'walkable')],
            'a one-way kind moved off its gates': [(p) => { Object.assign(p.tileKinds[0], b); },
                TILE_KIND_REFUSALS.entryGatesMismatch(b.x, b.y, LEDGE_E, ['E'], 'none')],
        };
        for (const [name, [edit, want]] of Object.entries(variants)) {
            const p = structuredClone(good);
            edit(p);
            const e = refused(() => substrateRegistryEntry.deserializeWorld(p));
            expect(e, name).toBeInstanceOf(Error);
            if (typeof want === 'string') expect(e.message, name).toBe(want); else expect(e.message, name).toMatch(want);
        }
        expect(refused(() => substrateRegistryEntry.deserializeWorld({ ...structuredClone(good), tileKinds: [{ ...good.tileKinds[0], dirs: ['W', 'E'] }] })))
            .toBeInstanceOf(MazeTileKindError);
    });
});

describe('3. ⛓ THE PROOF: the lab places a one-way kind, the round trip saves, the registry reloads', () => {
    const saveAfter = (declared, apply, doc = fresh()) => {
        const opened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: doc });
        const setSession = createSetSession(createMazeSetAdapter(), setRecord(opened.session.record));
        const roomWorld = deserializeMazeWorldWithKinds(setSession.record().library.entries[0].payload);
        const room = createEditSession(createMazeEditAdapter({ tileKinds: () => declared }), roomWorld);
        const editor = new MazeRoomEditor();
        editor.setTileKinds(declared);
        apply(room, editor);
        closeRoomSession(setSession, room, 0);
        return mazeRegionRoundTrip.save(setSession.record(), { regionId: REGION_ID, payload: doc });
    };
    const press = (room, editor, cell, kind) => {
        editor.selectType(PALETTE_TYPES.TILE_KIND);
        editor.selectTileKind(kind);
        expect(room.apply(editor.opFor(cell.x, cell.y)), `${kind} at ${key(cell)}`).toMatchObject({ ok: true });
    };
    const reach = (w, from, to) => bfsSolver({
        world: w, startState: { ...createState(w), player_pos: { ...from } }, goalPred: (s) => s.player_pos.x === to.x && s.player_pos.y === to.y,
        options: { budget: 100000 },
    }).ok;

    it('against the declared direction the exit is cut off, as hand-placed entry_gates cut it; along it nothing moves', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const themed = await load(['maze', 'meta', FIXTURE]);
        const declared = themed.tileKinds;
        const plain = substrateRegistryEntry.deserializeWorld(fresh());
        const unedited = mazeRegionRoundTrip.save(mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: fresh() }).unedited, { regionId: REGION_ID, payload: fresh() });
        // The cell: a free cell between two free floor cells on a horizontal line, whose closing (against the way a
        // walk from the entrance crosses it) moves the exits. Read off the data.
        const thingCells = new Set((PAYLOAD.things ?? []).map(key));
        const free = freeCells(plain).filter((c) => !thingCells.has(key(c)));
        const freeSet = new Set(free.map(key));
        const handDoc = (c, dirs) => ({ ...fresh(), entry_gates: nullGates(c, dirs) });
        const handSave = (c, dirs) => mazeRegionRoundTrip.save(mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: handDoc(c, dirs) }).unedited,
            { regionId: REGION_ID, payload: handDoc(c, dirs) });
        const pick = free.filter((c) => freeSet.has(key({ x: c.x - 1, y: c.y })) && freeSet.has(key({ x: c.x + 1, y: c.y })))
            .map((c) => {
                // the way a walk from the entrance crosses c: east or west
                const viaEast = reach(plain, plain.entrance, { x: c.x + 1, y: c.y }) && !reach(
                    Object.assign(cloneWorld(plain), { entryGates: new Map([[`${c.x},${c.y},W`, null]]) }), plain.entrance, { x: c.x - 1, y: c.y });
                return { cell: c, along: viaEast ? 'W' : 'E' };
            })
            .find((p) => JSON.stringify(handSave(p.cell, [OPPOSITE[p.along]]).exits) !== JSON.stringify(unedited.exits));
        expect(pick).toBeTruthy();
        const p = pick.cell;
        const AGAINST = pick.along === 'W' ? LEDGE_E : LEDGE_W;
        const ALONG = pick.along === 'W' ? LEDGE_W : LEDGE_E;
        const againstDirs = declared[AGAINST].dirs;

        // ── the lab: a TILE KIND press against the walk; the control: the same entry_gates written by hand
        const saved = saveAfter(declared, (room, editor) => press(room, editor, p, AGAINST));
        const hand = handSave(p, againstDirs);
        expect(saved.payload.tileKinds).toEqual([{ ...p, kind: AGAINST, pass: ONE_WAY_PASS, dirs: againstDirs }]);
        expect(saved.payload.entry_gates).toEqual(nullGates(p, againstDirs));
        expect(saved.payload.tiles).toEqual(hand.payload.tiles);
        expect(saved.exits).toEqual(hand.exits);
        expect(saved.locations).toEqual(hand.locations);
        expect(saved.exits).not.toEqual(unedited.exits); // the one-way moved the exits' rules: not vacuous
        expect(saved.payload.things).toEqual(PAYLOAD.things);
        // ── along the walk: nothing moves
        const along = saveAfter(declared, (room, editor) => press(room, editor, p, ALONG));
        expect(along.exits).toEqual(unedited.exits);
        expect(along.locations).toEqual(unedited.locations);

        // ── reload; the readers agree both ways
        const reloaded = substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(saved.payload)));
        expect([...reloaded.tileKinds]).toEqual([[key(p), AGAINST]]);
        expect(placedTileKindDrift(reloaded, declared)).toEqual([]);
        const west = { x: p.x - 1, y: p.y };
        const east = { x: p.x + 1, y: p.y };
        const [inDir] = againstDirs;              // the one move that may enter
        const [from, to] = inDir === 'E' ? [west, east] : [east, west];
        const bare = cloneWorld(reloaded);
        bare.items = new Map();
        expect(reach(bare, from, to)).toBe(true);  // the declared way passes
        expect(reach(bare, to, from)).toBe(false); // the other way is refused
        expect(findPath(bare, from, { kind: 'tile', ...to })).not.toBeNull();
        expect(findPath(bare, to, { kind: 'tile', ...from })).toBeNull();
        const againstMove = OPPOSITE[inDir];
        const standing = { ...createState(bare), player_pos: { ...to } };
        expect(step(bare, standing, againstMove)).toBeNull();
        expect(whyBlocked(bare, standing, againstMove)).toBe(`no entry into (${p.x},${p.y}) moving ${againstMove}`);
        // the extractor, from the entrance: the cell beyond is reachable exactly when the engine says so
        const ex = extractPathsAndObstacles(reloaded, { regionId: REGION_ID });
        expect(ex.exits.map((e) => e.paths.length > 0)).toEqual(ex.exits.map((e) => {
            const exit = [...reloaded.exits.values()].find((x) => x.exit_id === e.id) ?? null;
            return exit ? reach(Object.assign(cloneWorld(reloaded), { items: new Map() }), reloaded.entrance, exit) : true;
        }));

        // ── both views, with no theme art and with the meta theme: the marker base over the cell
        for (const tileArt of [null, themed.tileArt]) {
            const single = ops((ctx) => {
                drawWorld(ctx, reloaded, plainView({ tilePx: PX, tileArt }));
                expect(drawMazeTileKinds(ctx, reloaded, {
                    tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt, tileKinds: declared,
                })).toEqual([{ ...p, kind: AGAINST, as: 'base' }]);
            });
            expect(containsRun(single, ops((ctx) => paintMazeTileBase(ctx, 'marker', p.x * PX, p.y * PX, PX)))).toBe(true);
            const [offX, offY] = [48, 32];
            const composite = ops((ctx) => drawMazeCompositeRegion(ctx, { playable_payload: reloaded }, {
                offX, offY, tilePx: PX, tileArt, tileKinds: declared,
            }));
            expect(containsRun(composite, ops((ctx) => paintMazeTileBase(ctx, 'marker', offX + p.x * PX, offY + p.y * PX, PX)))).toBe(true);
        }
        expect(warn).not.toHaveBeenCalled();
    });

    it('the round trip keeps the document\'s own entry gates beside the kind\'s, and an erase drops only the kind\'s', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const [a, b] = freeCells(substrateRegistryEntry.deserializeWorld(fresh()));
        const own = [{ ...a, dir: 'N', gate: null }];
        const doc = { ...fresh(), entry_gates: own };
        const placed = saveAfter(tileKinds, (room, editor) => press(room, editor, b, LEDGE_E), doc);
        expect(placed.payload.entry_gates).toEqual([...own, ...nullGates(b, ['E'])]);
        // an erase of the kind, saved over the document that held it: the document's own gate stays, the kind's go
        const erased = saveAfter(tileKinds, (room) => expect(room.apply({ op: 'clearEntity', ...b }).ok).toBe(true), placed.payload);
        expect(erased.payload.entry_gates).toEqual(own);
        expect('tileKinds' in erased.payload).toBe(false);
        // and with no kind anywhere the old rule holds: the document's gates come back as they were
        const untouched = saveAfter(tileKinds, () => {}, doc);
        expect(untouched.payload.entry_gates).toEqual(own);
    });
});

describe('4. drift: a changed dirs or pass is reported by name; the world kept as saved', () => {
    it('one-way E → one-way N,S and one-way → walkable', async () => {
        const before = (await load([FIXTURE])).tileKinds;
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: LEDGE_E }, { tileKinds: before });
        applyEditOp(w, { op: 'setTileKind', ...b, kind: TURNSTILE }, { tileKinds: before });
        const payload = { ...fresh(), ...serializeMazeWorld(w, { region_id: REGION_ID }) };
        const after = (await load([FIXTURE], { ...TERRAIN, [LEDGE_E]: { pass: ONE_WAY_PASS, dirs: ['N', 'S'] }, [TURNSTILE]: { pass: 'walkable' } })).tileKinds;
        const reloaded = substrateRegistryEntry.deserializeWorld(structuredClone(payload)); // not refused
        expect(gatesAt(reloaded, a)).toEqual([['N', null], ['S', null], ['W', null]]); // ⛔ never re-lowered
        const drift = (c, kind, baked, now) => ({
            ...c, kind, baked, declared: now, reason: 'tile-kind-pass-drift', description: TILE_KIND_REFUSALS.drift(c.x, c.y, kind, baked, now),
        });
        expect(placedTileKindDrift(reloaded, after)).toEqual([drift(a, LEDGE_E, 'one-way E', 'one-way N,S'), drift(b, TURNSTILE, 'one-way N,S', 'walkable')].sort(rowOrder));
        expect(placedTileKindDrift(reloaded, before)).toEqual([]);
        expect(applyEditOp(reloaded, { op: 'setTileKind', ...a, kind: LEDGE_E }, { tileKinds: after }).ok).toBe(true);
        expect(gatesAt(reloaded, a)).toEqual([['E', null], ['W', null]]);
    });
});

describe('5. outside the engine closure', () => {
    it('no file PASS-3 parts 2–4 touch is in the closure `engineMd5` hashes (part 0 moved mazeRoomEngine.js alone)', () => {
        const engine = new Set(importClosure());
        const files = ['mazeRoom/mazeTileKinds.js', 'mazeRoom/mazeSerializer.js', 'mazeRoom/mazeRoomEditor.js', 'mazeRoom/mazeAutopather.js',
            'mazeRoom/mazeRegionRoundTrip.js', 'packStructure/packStructure.js', 'packConcepts/packConcepts.js'];
        for (const f of files) expect(engine.has(relative(ROOT, join(HERE, '..', f))), f).toBe(false);
        expect(engine.has(relative(ROOT, join(HERE, 'mazeRoomEngine.js')))).toBe(true);
    });
});
