/**
 * MAZE CONVERTED LOAD (step 1 of the maze link overlay): the maze lab's LOAD takes a Seedling-converted room
 * (a `rules.json` preset sidecar, or its `playable_payload`) with its arrow traps, entry gates, block sinks,
 * block kinds and pulls intact, and save → load → save is a fixed point for EVERY room of the preset.
 *
 * Driven over the committed `seedling_playthrough_maze` preset (real sidecar data, no fixture). The counts are
 * the census's, measured: 266 sidecars (264 before no-hit), 116 carry a room, the rest are regions of a shared level world; 33 token
 * groups / 76 members / 13 dangling (a presser no maze responder names).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { labPayload, levelOfPayload, loadPayload } from './mazeLab.js';
import { ENGINE_ENTITY_FIELDS, cloneWorld, deserializeMazeLevel, serializeMazeLevel } from './procgenMaze.js';
import { armedTrapAt, deserializeMazeWorld, posKey, serializeMazeEntities } from './mazeRoomEngine.js';
import { applyEditOp } from './mazeRoomEditor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const RULES = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const SIDECARS = Object.entries(RULES.preset_sidecars['1']);
const ROOMS = SIDECARS.filter(([, s]) => s.playable_payload !== undefined);
const SHARED = SIDECARS.filter(([, s]) => s.playable_payload === undefined);
const room = (prefix) => ROOMS.find(([k]) => k.startsWith(prefix))[1];

const saveOf = (state) => JSON.stringify(labPayload(state));

/**
 * The token groups of a world, read from the token fields ONLY (`buttonLib.holds`, `obstacleLib.activates`, a
 * one-token `clear_set`, `trapLib.active`, `pulsers.token`). Test-local: the overlay's own reader is step 3.
 */
function tokenGroups(world) {
    const g = new Map();
    const at = (t) => { if (!g.has(t)) g.set(t, { pressers: 0, responders: 0 }); return g.get(t); };
    const tokens = new Set();
    for (const id of world.buttons?.values() ?? []) if (world.buttonLib?.[id]?.holds) tokens.add(world.buttonLib[id].holds);
    for (const id of world.obstacles.values()) if (world.obstacleLib[id]?.activates) tokens.add(world.obstacleLib[id].activates);
    for (const t of world.traps ?? []) if (world.trapLib?.[t.id]?.active) tokens.add(world.trapLib[t.id].active);
    for (const p of world.pulsers ?? []) tokens.add(p.token);
    for (const id of world.buttons?.values() ?? []) { const h = world.buttonLib?.[id]?.holds; if (h) at(h).pressers += 1; }
    for (const id of world.obstacles.values()) {
        const e = world.obstacleLib[id];
        if (e?.activates) at(e.activates).pressers += 1;
        for (const set of e?.clear_set ?? []) if (set.length === 1 && tokens.has(set[0])) at(set[0]).responders += 1;
    }
    for (const t of world.traps ?? []) { const a = world.trapLib?.[t.id]?.active; if (a) at(a).responders += 1; }
    for (const p of world.pulsers ?? []) at(p.token).responders += 1;
    return g;
}
const census = (worlds) => {
    let groups = 0; let members = 0; let dangling = 0;
    for (const w of worlds) {
        for (const x of tokenGroups(w).values()) {
            groups += 1; members += x.pressers + x.responders;
            if (x.pressers && !x.responders) dangling += 1;
        }
    }
    return { groups, members, dangling };
};

describe('maze converted load: which object is the level', () => {
    it('the preset sidecars split into rooms and regions of a shared level world, as measured', () => {
        // 264/116/148 at fe98f37f22; train 102's no-hit (rules-7) split L22/L25 at their new gates: +2 sidecars, both
        // room-less regions of their level's shared world (measured on main 7e99af41cc).
        expect([SIDECARS.length, ROOMS.length, SHARED.length]).toEqual([266, 116, 150]);
    });
    it('a sidecar envelope and its bare playable_payload load the same level', () => {
        const s = room('level_16');
        expect(saveOf(loadPayload(s))).toBe(saveOf(loadPayload(s.playable_payload)));
    });
    it('a bare playable_payload is the level although its `level` is a number (the Seedling level)', () => {
        const p = room('level_16').playable_payload;
        expect(p.level).toBe(16);
        expect(levelOfPayload(p)).toBe(p);
    });
    it('a lab payload still loads its `level` object', () => {
        const s = loadPayload(room('level_16'));
        const saved = labPayload(s);
        expect(levelOfPayload(saved)).toBe(saved.level);
    });
    it('a non-maze sidecar is refused by name', () => {
        expect(() => loadPayload({ substrate: 'seedling', playable_payload: {} })).toThrow(/"seedling" sidecar/);
    });
    it('every room-less sidecar is refused by name, pointing at its shared level world', () => {
        for (const [, s] of SHARED) {
            expect(() => loadPayload(s)).toThrow(new RegExp(`shared level world "${s.shared_world}"`));
        }
    });
});

describe('maze converted load: traps and the other engine fields survive', () => {
    it('the token census survives a lab load: 33 groups / 76 members / 13 dangling, as in the raw sidecars', () => {
        const raw = census(ROOMS.map(([, s]) => deserializeMazeWorld(s.playable_payload)));
        const lab = census(ROOMS.map(([, s]) => loadPayload(s).record));
        expect(raw).toEqual({ groups: 33, members: 76, dangling: 13 });
        expect(lab).toEqual(raw);
    });
    it('11 traps in 5 rooms (L4, L5, L8, L16, L67) are present after a lab load', () => {
        const withTraps = ROOMS.filter(([, s]) => s.playable_payload.traps)
            .map(([k, s]) => [k.split('__')[0], loadPayload(s).record.traps.length]);
        expect(withTraps).toEqual([['level_4', 2], ['level_5', 4], ['level_8', 1], ['level_16', 3], ['level_67', 1]]);
    });
    it('the lab reader and the engine reader agree on every engine entity field, for every room', () => {
        const differ = ROOMS.filter(([, s]) => JSON.stringify(serializeMazeEntities(loadPayload(s).record))
            !== JSON.stringify(serializeMazeEntities(deserializeMazeWorld(s.playable_payload)))).map(([k]) => k);
        expect(differ).toEqual([]);
    });
    it('a loaded trap room arms the same lane cells as the engine reads them (trapLanes adopted)', () => {
        for (const prefix of ['level_4', 'level_16']) {
            const p = room(prefix).playable_payload;
            const lab = loadPayload(room(prefix)).record;
            const eng = deserializeMazeWorld(p);
            const cells = p.traps.flatMap((t) => t.lane);
            expect(cells.length).toBeGreaterThan(0);
            for (const c of cells) {
                expect(lab.trapLanes.has(posKey(c.x, c.y))).toBe(true);
                expect(JSON.stringify(armedTrapAt(lab, new Set(), c.x, c.y)))
                    .toBe(JSON.stringify(armedTrapAt(eng, new Set(), c.x, c.y)));
            }
        }
    });
    it('an edit keeps the traps (cloneWorld carries them)', () => {
        const w = cloneWorld(loadPayload(room('level_16')).record);
        const r = applyEditOp(w, { op: 'setTile', x: 0, y: 0, tile: 1 });
        expect(r).toBeTruthy();
        expect(w.traps.length).toBe(3);
        expect(serializeMazeLevel(w).traps.length).toBe(3);
    });
});

describe('maze converted load: save → load → save is a fixed point', () => {
    it('for EVERY room of the preset (116)', () => {
        const moved = ROOMS.filter(([, s]) => {
            const save1 = saveOf(loadPayload(s));
            return saveOf(loadPayload(JSON.parse(save1))) !== save1;
        }).map(([k]) => k);
        expect(moved).toEqual([]);
    });
    it('a saved trap room carries the traps (the save is not silently stripped)', () => {
        const saved = labPayload(loadPayload(room('level_67')));
        expect(saved.level.traps.length).toBe(1);
        expect(Object.keys(saved.level.trapLib)).toEqual(Object.keys(room('level_67').playable_payload.trapLib));
    });
});

describe('maze converted load: obstacleLib rides through opaquely', () => {
    const base = () => JSON.parse(JSON.stringify(room('level_16').playable_payload));
    it('a rock entry with an unknown shape and a per-cell id survives save → load on the lab path', () => {
        const p = base();
        for (const f of ENGINE_ENTITY_FIELDS) delete p[f];
        delete p.trapLib;
        p.obstacleLib.rock_3_4 = { id: 'rock_3_4', kind: 'rock', at: '3,4', clear_set: [], struck_by: ['sword'],
            struck_from_future: { sword: ['3,5,N'] }, anything: [1, { nested: true }] };
        const once = serializeMazeLevel(deserializeMazeLevel(p));
        expect(once.obstacleLib.rock_3_4).toEqual(p.obstacleLib.rock_3_4);
        expect(serializeMazeLevel(deserializeMazeLevel(once))).toEqual(once);
    });
    it('the same entry survives on the engine path (a room with traps)', () => {
        const p = base();
        p.obstacleLib.rock_3_4 = { id: 'rock_3_4', kind: 'rock', at: '3,4', clear_set: [], struck_by: ['sword'],
            anything: [1, { nested: true }] };
        const once = serializeMazeLevel(deserializeMazeLevel(p));
        expect(once.traps.length).toBe(3);
        expect(once.obstacleLib.rock_3_4).toEqual(p.obstacleLib.rock_3_4);
        expect(serializeMazeLevel(deserializeMazeLevel(once))).toEqual(once);
    });
    it('every obstacleLib entry of every room is written back verbatim', () => {
        const differ = [];
        for (const [k, s] of ROOMS) {
            const out = serializeMazeLevel(loadPayload(s).record).obstacleLib ?? {};
            for (const [id, e] of Object.entries(s.playable_payload.obstacleLib ?? {})) {
                if (JSON.stringify(out[id]) !== JSON.stringify(e)) differ.push(`${k}/${id}`);
            }
        }
        expect(differ).toEqual([]);
    });
});

describe('maze converted load: a payload without engine fields takes no new path', () => {
    it('ENGINE_ENTITY_FIELDS are exactly the serializeMazeEntities fields the lab reader does not read itself', () => {
        expect([...ENGINE_ENTITY_FIELDS]).toEqual(['block_lib', 'traps', 'entry_gates', 'block_sinks', 'pulls', 'pulsers']);
    });
    it('the preset room fields the new path adopts (counts of rooms carrying each)', () => {
        const count = (f) => ROOMS.filter(([, s]) => s.playable_payload[f] !== undefined).length;
        // entry_gates 39 at fe98f37f22 → 41: train 102's no-hit (rules-7) gave L22/L25 their new entry gates.
        expect(Object.fromEntries(ENGINE_ENTITY_FIELDS.map((f) => [f, count(f)])))
            .toEqual({ block_lib: 3, traps: 5, entry_gates: 41, block_sinks: 8, pulls: 4, pulsers: 0 });
    });
});
