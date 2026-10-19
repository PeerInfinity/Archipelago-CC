/**
 * seedlingGenRegionRoundTrip — a generated Seedling room ⇄ the Seedling lab,
 * through the APWorld Editor's own door (`inspectRegionRoom` / `buildSidecarOp`).
 *
 * ⛓ The claims (⚖ region-editor-launch Q3, the user 2026-10-19):
 *   (1) every committed generated room passes the hub's baseline — an unedited
 *       save moves no byte, every endpoint maps to a document name;
 *   (2) the editor is handed the room AS IT PLAYS (its doors and AP items);
 *   (3) a door or AP item moved, or a resize, is REFUSED by name;
 *   (4) an edit that keeps every location reachable is certified, one that
 *       walls the goal in is SAVED and flagged — never refused;
 *   (5) `certifyGenRoom` certifies every committed room unedited;
 *   (6) an EDITED room still plays on the JS runtime: the world's generated set
 *       is assembled with the edit (`assembleGeneratedSeedlingSet`, as the host
 *       delivers it) and every goal of the edited room is SOLVED by the solver,
 *       asked exactly as the wasm arrival asks (seedling-js-planning-7's pin).
 *
 * ⛔ The roster is DERIVED: every `flash_seedling_gen` sidecar in every
 * committed preset.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const PRESETS = join(ROOT, 'frontend/presets');

let hub;
let gen;
let registry;

/** Every committed generated room: `{doc, player, name}`. */
function committedRooms() {
    const out = [];
    for (const dir of readdirSync(PRESETS)) {
        const base = join(PRESETS, dir);
        if (!statSync(base).isDirectory()) continue;
        for (const ap of readdirSync(base).filter((d) => d.startsWith('AP_'))) {
            const file = join(base, ap, `${ap}_rules.json`);
            if (!existsSync(file)) continue;
            const text = readFileSync(file, 'utf8');
            if (!text.includes('flash_seedling_gen')) continue;
            const doc = JSON.parse(text);
            for (const [player, sidecars] of Object.entries(doc.preset_sidecars ?? {})) {
                for (const [name, entry] of Object.entries(sidecars)) {
                    if (entry.substrate === 'flash_seedling_gen') out.push({ doc, player, name, where: `${dir}/${name}` });
                }
            }
        }
    }
    return out;
}

const wallAround = (record, cell) => {
    const near = new Set([[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => `${cell.tx + dx},${cell.ty + dy}`));
    const wall = record.layers[0].tiles.find(([x, y]) => x === 0 && y === 0)[2];
    record.layers = record.layers.map((l) => (Array.isArray(l.tiles) ? { ...l,
        tiles: l.tiles.map((t) => (near.has(`${t[0]},${t[1]}`) ? [t[0], t[1], wall, ...t.slice(3)] : t)) } : l));
};

beforeAll(async () => {
    await import('../flashPanel/flashSeedlingGenLibrary.js');
    hub = await import('../apworldEditor/regionRoundTrip.js');
    gen = await import('./seedlingGenRoom.js');
    ({ substrateRegistry: registry } = await import('../shared/procgen/substrateRegistry.js'));
}, 120_000);

/** The floor cell of an edited room's tiles farthest (Manhattan) from every door, location and the start. */
function farFloorCell(payload) {
    const tiles = payload.record.layers[0].tiles;
    const floor = tiles.find(([x, y]) => x === payload.start.tx && y === payload.start.ty)[2];
    const keep = [payload.start, payload.goal_cell, ...payload.locations.map((l) => l.cell),
        ...payload.exits.map((e) => ({ tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] }))];
    let best = null;
    for (const [tx, ty, id] of tiles) {
        if (id !== floor) continue;
        const d = Math.min(...keep.map((c) => Math.abs(c.tx - tx) + Math.abs(c.ty - ty)));
        if (!best || d > best.d) best = { tx, ty, d };
    }
    return best;
}

describe('seedlingGenRegionRoundTrip', () => {
    it('(1)(2) every committed generated room passes the hub baseline, handed over as it plays', async () => {
        const rooms = committedRooms();
        expect(rooms.length).toBeGreaterThan(0);
        for (const { doc, player, name, where } of rooms) {
            // eslint-disable-next-line no-await-in-loop
            const ins = await hub.inspectRegionRoom(doc, player, name);
            expect(ins.ok, `${where}: ${ins.why}`).toBe(true);
            const payload = doc.preset_sidecars[player][name].playable_payload;
            const entities = ins.session.record.rooms[0].source.record.entities;
            expect(entities.filter((e) => e.type === 'teleporter')).toHaveLength(payload.exits.length);
            expect(entities.filter((e) => e.type === 'apitem')).toHaveLength(payload.locations.length);
        }
    }, 120_000);

    it('(3) a moved door, a removed AP item and a resize are REFUSED by name', async () => {
        const { doc, player, name } = committedRooms()[0];
        const ins = await hub.inspectRegionRoom(doc, player, name);
        const edit = async (fn) => {
            const saved = structuredClone(ins.unedited);
            fn(saved.set.rooms[0].source.record);
            return hub.buildSidecarOp({ saved, inspection: ins });
        };
        const door = await edit((r) => { r.entities.find((e) => e.type === 'teleporter').x += 16; });
        expect(door.error).toContain('Doors and AP item locations are the world\'s');
        const item = await edit((r) => { r.entities = r.entities.filter((e) => e.type !== 'apitem'); });
        expect(item.error).toContain('Doors and AP item locations are the world\'s');
        const size = await edit((r) => { r.width += 1; });
        expect(size.error).toContain('resized');
    }, 120_000);

    it('(4) a harmless edit is certified; walling the goal in is SAVED and flagged', async () => {
        const { doc, player, name } = committedRooms()[0];
        const ins = await hub.inspectRegionRoom(doc, player, name);
        const payload = doc.preset_sidecars[player][name].playable_payload;
        const status = (p) => registry.get('flash_seedling_gen').regionEditStatus(p);

        const harmless = structuredClone(ins.unedited);
        const at = harmless.set.rooms[0].source.record;
        // ⛓ a decoration entity on an empty corner cell — the room plays the same
        at.entities.push({ type: 'torch', x: 0, y: 0, attrs: {} });
        const ok = await hub.buildSidecarOp({ saved: harmless, inspection: ins });
        expect(ok.error).toBeUndefined();
        expect(ok.op.payload.generation.edited).toEqual({ certified: true });
        expect(status(ok.op.payload).flagged).toBe(false);
        expect(ok.op.payload.record.entities.at(-1)).toMatchObject({ type: 'torch', x: 0, y: 0 });

        const walled = structuredClone(ins.unedited);
        wallAround(walled.set.rooms[0].source.record, payload.goal_cell);
        const flagged = await hub.buildSidecarOp({ saved: walled, inspection: ins });
        expect(flagged.error).toBeUndefined();
        expect(flagged.op.payload.generation.edited.certified).toBe(false);
        expect(status(flagged.op.payload)).toMatchObject({ flagged: true });
        expect(status(payload)).toBe(null);
    }, 120_000);

    it('(5) certifyGenRoom certifies every committed room unedited, and not one whose goal is walled in', () => {
        for (const { doc, player, name, where } of committedRooms()) {
            const payload = doc.preset_sidecars[player][name].playable_payload;
            expect(gen.certifyGenRoom(payload, name), where).toEqual({ certified: true, failures: [] });
            const walled = structuredClone(payload);
            wallAround(walled.record, payload.goal_cell);
            expect(gen.certifyGenRoom(walled, name).certified, where).toBe(false);
        }
    }, 120_000);

    it('(6) an EDITED room still plays: assembled into the world\'s set, every goal of it SOLVED on the JS runtime', async () => {
        const { assembleGeneratedSeedlingSet } = await import('./seedlingGeneratedSet.js');
        const { mountedRecordsOf } = await import('./wasmWalkTape.js');
        const { levelSourceFromAtlas } = await import('./atlasSource.js');
        const { bootStaging } = await import('./procgenOracle.js');
        const { JS_RUNTIME_PINS } = await import('./jsRuntimeCore.js');
        const { ITEM_PROPERTIES } = await import('./tapeFormat.js');
        const { solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } = await import('./jsRuntimeSolver.js');
        const { arrivalSolveRequest, arrivalSolverGoal } = await import('./wasmArrival.js');
        const flags = Object.fromEntries(Object.values(ITEM_PROPERTIES).map((x) => [x.property, x.kind === 'add' ? x.base : false]));

        const doc = JSON.parse(readFileSync(join(PRESETS, 'seedling_generated_room/AP_1/AP_1_rules.json'), 'utf8'));
        const name = 'region_0_0';
        const ins = await hub.inspectRegionRoom(doc, '1', name);
        expect(ins.ok, ins.why).toBe(true);
        const payload = doc.preset_sidecars['1'][name].playable_payload;
        const cell = farFloorCell(payload);
        expect(cell, 'a floor cell to wall').toBeTruthy();
        const saved = structuredClone(ins.unedited);
        const rec = saved.set.rooms[0].source.record;
        const wall = rec.layers[0].tiles.find(([x, y]) => x === 0 && y === 0)[2];
        rec.layers[0].tiles = rec.layers[0].tiles.map((t) => (t[0] === cell.tx && t[1] === cell.ty
            ? [t[0], t[1], wall, ...t.slice(3)] : t));
        const out = await hub.buildSidecarOp({ saved, inspection: ins });
        expect(out.error).toBeUndefined();
        expect(out.op.payload.generation.edited).toEqual({ certified: true });
        expect(JSON.stringify(out.op.payload.record)).not.toBe(JSON.stringify(payload.record));

        const edited = structuredClone(doc);
        edited.preset_sidecars['1'][name].playable_payload = out.op.payload;
        const assembled = assembleGeneratedSeedlingSet(edited, { selfPlayer: 1 });
        const records = mountedRecordsOf(assembled.set);
        const levelSource = levelSourceFromAtlas(records);
        const level = assembled.levelOf.get(name);
        expect(records.get(level).layers).toEqual(out.op.payload.record.layers);
        const goals = [
            ...assembled.report.apitems.filter((a) => a.room === level)
                .map((a) => ({ kind: 'location', level, tag: a.tag, name: a.location })),
            ...assembled.report.doors.filter((d) => d.room === level)
                .map((d) => ({ kind: 'exit', level, tile: [d.cell.tx, d.cell.ty], name: `${d.region}__${d.exitName}` })),
        ];
        expect(goals.length).toBeGreaterThan(0);
        const start = assembled.set.start;
        for (const goal of goals) {
            const staging = bootStaging({ boot: { level: start.level, x: start.x, y: start.y }, items: flags, pins: [...JS_RUNTIME_PINS] });
            const mapped = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(level) });
            const request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records,
                name: `edited-${goal.name}`, scratchPersistence: true });
            const answer = solveAnytime({ ...request, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
            expect(answer.ok, `${goal.name}: ${answer.message}`).toBe(true);
        }
    }, 240_000);
});
