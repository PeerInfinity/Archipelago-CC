/**
 * CONTENT SETS PASS-2 — **DECLARED PASSABILITY: `needs`, END TO END** (⚖ the user 2026-11-18: "One per slice", "Pack
 * declares, world copies", "Separate, no lying looks"; ⚖ planner 2026-11-19: the obstacle id is DERIVED from the cell,
 * not stored, and the round trip, the drift report and `withTileKinds` check it by name).
 *
 *   1. The lookup and every declared-kind refusal (an unknown concept, a lying look), and the world's realisation.
 *   2. The editor lowers a needs kind to the rule obstacle `tilekind_gate_<x>_<y>`; erase lifts it (byte-equal);
 *      painting floor over it is refused; replacing it lifts it; copy/paste re-derives the id. The payload's
 *      `pass`/`needs` and every ownership refusal (`withTileKinds` and the round trip's save).
 *   3. ⛓ THE PROOF, on a REAL committed world (the meta trial's maze region with a thing) with a TEST-ONLY fixture pack
 *      held in memory (no committed pack or preset gains it): the lab's SET arm places a `needs sword` kind, the
 *      round trip saves, the registry reloads. Its re-derived exits and locations equal a HAND-PLACED rule obstacle's
 *      with the same rule (and it is never a location); `bfsSolver`, `step` and the autopather refuse it without the
 *      item and pass it with it; `whyBlocked` names the rule; both views draw the kind.
 *   4. Drift: a changed `needs` concept and a changed pass, reported by name, the world kept as saved.
 *   5. Outside the engine closure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importClosure } from '../../../scripts/procgen/seedlingDerivedRuleTable.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { CONCEPTS, itemIdOfNeed } from '../procgenCore/concepts.js';
import { withFixtureProvenance } from '../contentPacks/testing/fixtureProvenance.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { recordingContext } from './drawOpRecorder.js';
import { TILE_FLOOR, bfsSolver, createState, getObstacle, getTile, step, whyBlocked } from './mazeRoomEngine.js';
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
    MazeTileKindError, NEEDS_PASS, TILE_KIND_REFUSALS, deserializeMazeWorldWithKinds, needsRealisationRefusal,
    needsRuleOf, occupiedWorldCells, placedTileKindDrift, tileKindGateDef, tileKindGateId, tileKindRefusal, tileKindsList,
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
const SWORD = itemIdOfNeed('sword', CONCEPTS);

/**
 * ⛔ THE FIXTURE PACK — test-only, in memory. Its `structure` declares the terrain, its concepts present it:
 *   · SHRINE  base marker, needs sword  — the proof's kind;
 *   · POOL    base marker, needs swim   — a second concept, for drift and replace;
 *   · RUG     base marker, walkable;
 *   · PAINTED base floor,  needs swim   — a lying look (a plain floor that is not walkable), refused;
 *   · GROTTO  base wall,   needs swim   — a lying look (a wall that is not blocked), refused;
 *   · LANTERN base marker, needs lantern — a concept the concept table does not declare, refused.
 */
const FIXTURE = 'pass2-fixture';
const K = (slug) => `${FIXTURE}:terrain/${slug}`;
const [SHRINE, POOL, RUG, PAINTED, GROTTO, LANTERN] = ['shrine', 'pool', 'rug', 'painted', 'grotto', 'lantern'].map(K);
const TERRAIN = {
    [SHRINE]: { pass: NEEDS_PASS, needs: 'sword' }, [POOL]: { pass: NEEDS_PASS, needs: 'swim' }, [RUG]: { pass: 'walkable' },
    [PAINTED]: { pass: NEEDS_PASS, needs: 'swim' }, [GROTTO]: { pass: NEEDS_PASS, needs: 'swim' }, [LANTERN]: { pass: NEEDS_PASS, needs: 'lantern' },
};
const BASES = { [SHRINE]: 'marker', [POOL]: 'marker', [RUG]: 'marker', [PAINTED]: 'floor', [GROTTO]: 'wall', [LANTERN]: 'marker' };
const readerFor = (terrain) => withFixtureProvenance(async (url) => {
    if (url === `${PACKS}${FIXTURE}/pack.json`) {
        return {
            schema_version: 1, id: FIXTURE, title: 'PASS-2 fixture', licence: 'CC0',
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
const refused = (fn) => {
    try { fn(); } catch (e) { return e; }
    return null;
};

afterEach(() => {
    resetMazeTilePlaceholderLogForTests();
    vi.restoreAllMocks();
});

describe('1. the lookup, the declared-kind refusals, the world\'s realisation', () => {
    it('tileKindKeys carries needs beside its pass; the rule is the concept-gate idiom\'s Has(<item>)', async () => {
        const { tileKinds } = await load([FIXTURE]);
        for (const [k, t] of Object.entries(TERRAIN)) expect({ pass: tileKinds[k].pass, needs: tileKinds[k].needs }, k).toEqual(t);
        expect(tileKinds[RUG].needs).toBeUndefined();
        expect(needsRuleOf('sword')).toEqual({ rule: 'Has', args: { item_name: SWORD } });
        for (const c of ['lantern', 'guardian', 'key', undefined]) expect(needsRuleOf(c), String(c)).toBeNull();
    });

    it('every refusal of a declared kind, by name; the palette offers exactly the rest', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const want = {
            [PAINTED]: { reason: 'floor-base-not-walkable-tile-kind', description: TILE_KIND_REFUSALS.floorBaseNotWalkable(PAINTED, NEEDS_PASS) },
            [GROTTO]: { reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase(GROTTO, NEEDS_PASS) },
            [LANTERN]: { reason: 'unknown-needs-tile-kind', description: TILE_KIND_REFUSALS.needsUnknown(LANTERN, 'lantern') },
        };
        for (const k of Object.keys(tileKinds)) expect(tileKindRefusal(k, tileKinds), k).toEqual(want[k] ?? null);
        expect(placeableTileKinds(tileKinds)).toEqual(Object.keys(tileKinds).filter((k) => !(k in want)));
    });

    it('a mechanic the world cannot realise is refused at placement, by name', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const noSword = fresh();
        noSword.itemLib = Object.fromEntries(Object.entries(noSword.itemLib).filter(([id]) => id !== SWORD));
        const w = substrateRegistryEntry.deserializeWorld(noSword);
        expect(w.itemLib[SWORD]).toBeUndefined();
        const [a] = freeCells(w);
        expect(applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds })).toMatchObject({
            ok: false, reason: 'unrealisable-needs-tile-kind',
            description: TILE_KIND_REFUSALS.needsUnrealisable(SHRINE, 'sword', `the world's item library holds no "${SWORD}"`),
        });
        expect(w.tileKinds).toBeUndefined();
        expect(getObstacle(w, a.x, a.y)).toBeUndefined();
        // the other branch: a concept the maze does not realise as a mechanic (`guardian` is a skin gate)
        expect(needsRealisationRefusal(w, SHRINE, 'guardian')).toMatch(/the maze realises no mechanic "guardian" \(it realises sword, swim\)/);
    });
});

describe('2. the editor lowers to the derived gate; the payload carries the copy; ownership refused by name', () => {
    it('place → the rule obstacle on the floor cell; floor over it refused; erase lifts it, byte-equal', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const before = JSON.stringify(serializeMazeWorld(w, { region_id: REGION_ID }));
        const [a] = freeCells(w);
        const id = tileKindGateId(a.x, a.y);
        const at = (op) => applyEditOp(w, { ...op, ...a }, { tileKinds });
        expect(at({ op: 'setTileKind', kind: SHRINE })).toMatchObject({
            ok: true, description: `Placed tile kind ${SHRINE} at (${a.x},${a.y}) (needs sword: the rule obstacle ${id} under it).`,
        });
        expect(getTile(w, a.x, a.y)).toBe(TILE_FLOOR);
        expect(getObstacle(w, a.x, a.y)).toBe(id);
        expect(w.obstacleLib[id]).toEqual(tileKindGateDef(a.x, a.y, needsRuleOf('sword')));
        expect(w.obstacleLib[id]).toEqual({ ...DEFAULT_OBSTACLES.logic_gate, id, clear_rule: { rule: 'Has', args: { item_name: SWORD } } });
        expect(tileKindsList(w)).toEqual([{ ...a, kind: SHRINE, pass: NEEDS_PASS, needs: 'sword' }]);
        expect(at({ op: 'setTile', tile: 'floor' })).toEqual({
            ok: false, type: 'noop', reason: 'needs-tile-kind', description: TILE_KIND_REFUSALS.floorOverBlocked(a.x, a.y, SHRINE, NEEDS_PASS), op: null,
        });
        for (const op of [{ op: 'setTile', tile: 'wall' }, { op: 'setObstacle', id: 'water_gate_0' }, { op: 'setItem', id: SWORD }]) {
            expect(at(op), op.op).toMatchObject({ ok: false, reason: 'occupied-tile-kind' });
        }
        expect(at({ op: 'setTileKind', kind: SHRINE }).description).toMatch(/already holds/);
        // replace: another concept re-lowers under the same id; a walkable kind lifts it
        expect(at({ op: 'setTileKind', kind: POOL })).toMatchObject({ ok: true });
        expect(w.obstacleLib[id].clear_rule).toEqual(needsRuleOf('swim'));
        expect(at({ op: 'setTileKind', kind: RUG })).toMatchObject({ ok: true });
        expect(getObstacle(w, a.x, a.y)).toBeUndefined();
        expect(id in w.obstacleLib).toBe(false);
        expect(at({ op: 'setTileKind', kind: SHRINE })).toMatchObject({ ok: true });
        expect(at({ op: 'clearEntity' })).toMatchObject({ ok: true, description: `Erased tile kind ${SHRINE} at (${a.x},${a.y}).` });
        expect(getObstacle(w, a.x, a.y)).toBeUndefined();
        expect(JSON.stringify(serializeMazeWorld(w, { region_id: REGION_ID }))).toBe(before);
    });

    it('the gate is added copy-on-write: a clone taken before placement never sees it', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const c = cloneWorld(w);
        const [a] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds });
        expect(tileKindGateId(a.x, a.y) in c.obstacleLib).toBe(false);
    });

    it('copy/paste: the cell reads as the kind (not its gate); the paste lowers under the destination\'s own id', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = deserializeMazeWorldWithKinds(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds });
        const desc = readMazeCell(w, a.x, a.y);
        expect(desc).toEqual({ tile: 'floor', entity: { tileKind: SHRINE } });
        const s = createEditSession(createMazeEditAdapter({ tileKinds: () => tileKinds }), w);
        for (const op of mazeWriteOps(desc, b.x, b.y)) expect(s.apply(op).ok, op.op).toBe(true);
        const out = s.record();
        expect(getObstacle(out, b.x, b.y)).toBe(tileKindGateId(b.x, b.y));
        expect(out.obstacleLib[tileKindGateId(b.x, b.y)].clear_rule).toEqual(needsRuleOf('sword'));
    });

    it('the payload: pass and needs together; every ownership refusal by name (withTileKinds and the save)', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const fields = sidecarFieldsOf(substrateRegistryEntry);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds });
        const good = { ...fresh(), ...serializeMazeWorld(w, { region_id: REGION_ID }) };
        expect(sidecarPayloadErrors(fields, good)).toEqual([]);
        expect(serializeMazeWorld(substrateRegistryEntry.deserializeWorld(structuredClone(good)), { region_id: REGION_ID }).tileKinds)
            .toEqual(good.tileKinds);
        const id = tileKindGateId(a.x, a.y);
        const variants = {
            'needs without pass': [(p) => { delete p.tileKinds[0].pass; }, /entry 0: needs is written with pass "needs", and only there/],
            'pass without needs': [(p) => { delete p.tileKinds[0].needs; }, /entry 0: needs is written with pass "needs", and only there/],
            'an unknown concept': [(p) => { p.tileKinds[0].needs = 'lantern'; }, TILE_KIND_REFUSALS.needsUnknown(SHRINE, 'lantern')],
            'the gate missing': [(p) => { p.obstacles = p.obstacles.filter((o) => o.id !== id); }, TILE_KIND_REFUSALS.gateMissing(a.x, a.y, SHRINE, id)],
            'the gate not a rule': [(p) => { p.obstacleLib[id] = { ...p.obstacleLib[id], clear_set_type: 'combo', clear_set: [[SWORD]] }; },
                TILE_KIND_REFUSALS.gateNotRule(a.x, a.y, SHRINE, id)],
            'the gate\'s rule not the concept\'s': [(p) => { p.obstacleLib[id].clear_rule = needsRuleOf('swim'); },
                TILE_KIND_REFUSALS.gateRuleMismatch(a.x, a.y, SHRINE, id, 'sword')],
            'a walkable kind on a cell holding its derived gate': [(p) => { delete p.tileKinds[0].pass; delete p.tileKinds[0].needs; },
                TILE_KIND_REFUSALS.gateUnowned(a.x, a.y, SHRINE, id)],
            'a needs kind moved off its gate': [(p) => { Object.assign(p.tileKinds[0], b); },
                TILE_KIND_REFUSALS.gateMissing(b.x, b.y, SHRINE, tileKindGateId(b.x, b.y))],
        };
        for (const [name, [edit, want]] of Object.entries(variants)) {
            const p = structuredClone(good);
            edit(p);
            const e = refused(() => substrateRegistryEntry.deserializeWorld(p));
            expect(e, name).toBeInstanceOf(MazeTileKindError);
            if (typeof want === 'string') expect(e.message, name).toBe(want); else expect(e.message, name).toMatch(want);
        }
        // the round trip's save refuses the same, before deriving anything
        const opened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: good });
        const record = structuredClone(opened.unedited);
        record.library.entries[0].payload.obstacles = record.library.entries[0].payload.obstacles.filter((o) => o.id !== id);
        expect(() => mazeRegionRoundTrip.save(record, { regionId: REGION_ID, payload: good })).toThrow(TILE_KIND_REFUSALS.gateMissing(a.x, a.y, SHRINE, id));
    });
});

describe('3. ⛓ THE PROOF: the lab places a needs kind, the round trip saves, the registry reloads', () => {
    /** Open the room as the lab's SET arm does (the record optionally edited first), `apply`, close it, save. */
    const saveAfter = (declared, apply, editRecord = (r) => r) => {
        const opened = mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: fresh() });
        const setSession = createSetSession(createMazeSetAdapter(), setRecord(editRecord(structuredClone(opened.session.record))));
        const roomWorld = deserializeMazeWorldWithKinds(setSession.record().library.entries[0].payload);
        const room = createEditSession(createMazeEditAdapter({ tileKinds: () => declared }), roomWorld);
        const editor = new MazeRoomEditor({ obstacleLib: roomWorld.obstacleLib });
        editor.setTileKinds(declared);
        apply(room, editor);
        closeRoomSession(setSession, room, 0);
        return { saved: mazeRegionRoundTrip.save(setSession.record(), { regionId: REGION_ID, payload: fresh() }), opened };
    };
    const press = (room, editor, type, cell, pick = () => {}) => {
        editor.selectType(type);
        pick(editor);
        expect(room.apply(editor.opFor(cell.x, cell.y)), `${type} at ${key(cell)}`).toMatchObject({ ok: true });
    };
    const HAND = 'logic_gate_hand';

    it('its rules equal a hand-placed rule obstacle\'s; the solver, the step and the autopather agree; both views draw it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const themed = await load(['maze', 'meta', FIXTURE]);
        const declared = themed.tileKinds;
        const plain = substrateRegistryEntry.deserializeWorld(fresh());
        // The cell: a free cell whose rule obstacle moves the room's derived rules (so the equality is not vacuous),
        // with a free floor neighbour to step from. Read off the data.
        const thingCells = new Set((PAYLOAD.things ?? []).map(key));
        const { saved: unedited } = { saved: mazeRegionRoundTrip.save(mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: fresh() }).unedited, { regionId: REGION_ID, payload: fresh() }) };
        const free = freeCells(plain).filter((c) => !thingCells.has(key(c)));
        const freeSet = new Set(free.map(key));
        const withHandGate = (r) => {
            r.entries[0].payload.obstacleLib = { ...r.entries[0].payload.obstacleLib, [HAND]: { ...DEFAULT_OBSTACLES.logic_gate, id: HAND, clear_rule: needsRuleOf('sword') } };
            return r;
        };
        const handAt = (c) => saveAfter(declared, (room, editor) => press(room, editor, PALETTE_TYPES.OBSTACLE, c, (e) => { e.selectedObstacleId = HAND; }), withHandGate).saved;
        const pick = free.map((c) => {
            const dir = Object.keys(DELTA).find((d) => freeSet.has(key({ x: c.x - DELTA[d][0], y: c.y - DELTA[d][1] })));
            return dir ? { cell: c, dir, from: { x: c.x - DELTA[dir][0], y: c.y - DELTA[dir][1] } } : null;
        }).filter(Boolean).find((p) => JSON.stringify(handAt(p.cell).exits) !== JSON.stringify(unedited.exits));
        expect(pick).toBeTruthy();
        const p = pick.cell;
        const id = tileKindGateId(p.x, p.y);

        // ── the lab: a TILE KIND press; the control: the hand-placed rule obstacle (palette OBSTACLE) on the same cell
        const { saved } = saveAfter(declared, (room, editor) => press(room, editor, PALETTE_TYPES.TILE_KIND, p, (e) => e.selectTileKind(SHRINE)));
        const hand = handAt(p);
        expect(saved.payload.tileKinds).toEqual([{ ...p, kind: SHRINE, pass: NEEDS_PASS, needs: 'sword' }]);
        expect(saved.payload.obstacles).toContainEqual({ ...p, id });
        expect(saved.payload.obstacleLib[id]).toEqual(tileKindGateDef(p.x, p.y, needsRuleOf('sword')));
        expect(saved.payload.things).toEqual(PAYLOAD.things);
        expect(saved.payload.tiles).toEqual(hand.payload.tiles);
        expect(saved.exits).toEqual(hand.exits);
        expect(saved.locations).toEqual(hand.locations);
        expect(saved.exits).not.toEqual(unedited.exits); // the gate moved the exits' rules: the equality is not vacuous
        // ⛔ never a location: the same locations, by name, as the room without it
        expect(saved.locations.map((l) => l.name).sort()).toEqual(unedited.locations.map((l) => l.name).sort());

        // ── reload: the registry's deserializer (it runs every ownership check) and a second open
        const reloaded = substrateRegistryEntry.deserializeWorld(JSON.parse(JSON.stringify(saved.payload)));
        expect([...reloaded.tileKinds]).toEqual([[key(p), SHRINE]]);
        expect(getObstacle(reloaded, p.x, p.y)).toBe(id);
        expect(mazeRegionRoundTrip.open({ regionId: REGION_ID, payload: saved.payload }).session.record.entries[0].payload.tileKinds)
            .toEqual(saved.payload.tileKinds);
        expect(placedTileKindDrift(reloaded, declared)).toEqual([]);

        // ── the readers. The room's only pickup is the swim on the corridor, so the search starts beside the gate
        //    with the pickups taken out: the gate alone decides.
        const bare = cloneWorld(reloaded);
        bare.items = new Map();
        const at = (inv) => ({ ...createState(bare), player_pos: { ...pick.from }, inventory: new Set(inv) });
        const reach = (inv) => bfsSolver({
            world: bare, startState: at(inv), goalPred: (s) => s.player_pos.x === p.x && s.player_pos.y === p.y, options: { budget: 100000 },
        });
        expect(reach([])).toMatchObject({ ok: false, reason: 'unreachable' });
        expect(reach([SWORD]).ok).toBe(true);
        expect(step(bare, at([]), pick.dir)).toBeNull();
        expect(step(bare, at([SWORD]), pick.dir)).not.toBeNull();
        expect(whyBlocked(bare, at([]), pick.dir)).toMatch(new RegExp(`${id}|${SWORD}`));
        expect(whyBlocked(bare, at([SWORD]), pick.dir)).toBeNull();
        expect(findPath(bare, pick.from, { kind: 'tile', ...p }, { inventory: new Set() })).toBeNull();
        expect(findPath(bare, pick.from, { kind: 'tile', ...p }, { inventory: new Set([SWORD]) })).not.toBeNull();

        // ── both views, with no theme art and with the meta theme: the kind's marker base over its cell
        for (const tileArt of [null, themed.tileArt]) {
            const single = ops((ctx) => {
                drawWorld(ctx, reloaded, plainView({ tilePx: PX, tileArt }));
                expect(drawMazeTileKinds(ctx, reloaded, {
                    tilePx: PX, playerPos: null, fogEnabled: false, isTileVisible: () => true, tileArt, tileKinds: declared,
                })).toEqual([{ ...p, kind: SHRINE, as: 'base' }]);
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
});

describe('4. drift: a changed needs concept or pass is reported by name; the world is kept as saved', () => {
    it('needs sword → needs swim, and needs → walkable: listed; the gate unmoved; re-placing takes the pack\'s value', async () => {
        const before = (await load([FIXTURE])).tileKinds;
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a, b] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds: before });
        applyEditOp(w, { op: 'setTileKind', ...b, kind: POOL }, { tileKinds: before });
        const payload = { ...fresh(), ...serializeMazeWorld(w, { region_id: REGION_ID }) };
        const after = (await load([FIXTURE], { ...TERRAIN, [SHRINE]: { pass: NEEDS_PASS, needs: 'swim' }, [POOL]: { pass: 'walkable' } })).tileKinds;
        const reloaded = substrateRegistryEntry.deserializeWorld(structuredClone(payload)); // not refused
        expect(reloaded.obstacleLib[tileKindGateId(a.x, a.y)].clear_rule).toEqual(needsRuleOf('sword')); // ⛔ never re-lowered
        const drift = (c, kind, baked, now) => ({
            ...c, kind, baked, declared: now, reason: 'tile-kind-pass-drift', description: TILE_KIND_REFUSALS.drift(c.x, c.y, kind, baked, now),
        });
        expect(placedTileKindDrift(reloaded, after)).toEqual([drift(a, SHRINE, 'needs sword', 'needs swim'), drift(b, POOL, 'needs swim', 'walkable')].sort(rowOrder));
        expect(placedTileKindDrift(reloaded, before)).toEqual([]);
        expect(serializeMazeWorld(reloaded, { region_id: REGION_ID }).tileKinds).toEqual(payload.tileKinds);
        expect(applyEditOp(reloaded, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds: after }).ok).toBe(true);
        expect(reloaded.obstacleLib[tileKindGateId(a.x, a.y)].clear_rule).toEqual(needsRuleOf('swim'));
        expect(placedTileKindDrift(reloaded, after).map((d) => d.kind)).toEqual([POOL]);
    });

    it('a gate lost in memory is named by the drift report (the load would refuse it)', async () => {
        const { tileKinds } = await load([FIXTURE]);
        const w = substrateRegistryEntry.deserializeWorld(fresh());
        const [a] = freeCells(w);
        applyEditOp(w, { op: 'setTileKind', ...a, kind: SHRINE }, { tileKinds });
        const id = tileKindGateId(a.x, a.y);
        w.obstacleLib = { ...w.obstacleLib, [id]: { ...w.obstacleLib[id], clear_rule: { rule: 'True_' } } };
        expect(placedTileKindDrift(w, tileKinds)).toEqual([{
            ...a, kind: SHRINE, reason: 'tile-kind-gate-mismatch', description: TILE_KIND_REFUSALS.gateRealisesNone(a.x, a.y, SHRINE, id),
        }]);
    });
});

describe('5. outside the engine closure', () => {
    it('no file PASS-2 reads or writes `needs` in is in the closure `engineMd5` hashes', () => {
        const engine = new Set(importClosure());
        const files = ['mazeRoom/mazeTileKinds.js', 'mazeRoom/mazeSerializer.js', 'mazeRoom/mazeRoomEditor.js', 'mazeRoom/mazeTileArt.js',
            'mazeRoom/mazeEditAdapter.js', 'mazeRoom/mazeRegionRoundTrip.js', 'packStructure/packStructure.js', 'packConcepts/packConcepts.js'];
        for (const f of files) expect(engine.has(relative(ROOT, join(HERE, '..', f))), f).toBe(false);
    });
});
