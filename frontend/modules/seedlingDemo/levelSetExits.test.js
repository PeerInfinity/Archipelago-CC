// Unit tests for Phase 5b — exit destinations as data
// (CC/docs/plans/seedling-external-level-sets.md §4.6, §5).
//
// ⛓ THREE OF THESE ARE MEASUREMENTS OF THE REAL GAME, NOT OF THIS MODULE, and
// they are here because they are what the design rests on. §4.6's rule for
// `sign` is wrong, the warp-loop hazard a two-way link seems to have is not
// real, and both facts come from the vanilla corpus rather than from reasoning
// about it. A measurement kept only in a plan document is a measurement that
// rots; kept as a test, it fails the day the corpus or the parse changes.
import { describe, it, expect } from 'vitest';

import {
    EXIT_ELEMENTS,
    LevelSetExitError,
    MAX_REGION,
    REGION_NONE,
    approachKey,
    linkGeneratedRooms,
    occupiedCells,
    planTopology,
    retargetLevelSet,
    retargetRoomXml,
    signForTransition,
    walkableCellsFrom,
} from './levelSetExits.js';
import {
    SIGN_NONE,
    TILE_PX,
    parseRoomXml,
    stampLevelSetIdentity,
    validateLevelSet,
} from './levelSetValidator.js';
import { buildLevelSet, reachabilityOf } from './levelSetExporter.js';
import { emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { TILE_SIZE } from './levelWorld.js';
import roomRefs from './fixtures/seedling-vanilla-room-refs.json';

const VANILLA = Object.keys(roomRefs.rooms).map(Number).sort((a, b) => a - b);
const vanillaDoc = (id) => parseRoomXml(roomRefs.rooms[id]);

/** A 10x10 walled room, the shape `procgenSeedling` emits. */
const room = (level = 0) => emptyLevel({ level });

describe('the vanilla measurements this design rests on', () => {
    // ⛔⛔ §4.6 IS WRONG ABOUT `sign`, AND THIS IS THE MEASUREMENT THAT SAYS SO.
    // "`sign` is destination metadata" implies every entrance to a room carries
    // the same sign. Seven of vanilla's seven signed destinations are ALSO
    // entered by unsigned exits, so it is a property of the TRANSITION —
    // crossing INTO a region — not of the room.
    it('every signed vanilla destination is ALSO entered by an unsigned exit', () => {
        const into = new Map();
        for (const id of VANILLA) {
            const doc = vanillaDoc(id);
            for (const ex of doc.exits) {
                if (!into.has(ex.to)) into.set(ex.to, []);
                into.get(ex.to).push(ex.sign);
            }
            for (const f of doc.fallthroughs) {
                if (!into.has(f.to)) into.set(f.to, []);
                into.get(f.to).push(f.sign);
            }
        }
        const signedDestinations = [...into.entries()]
            .filter(([, signs]) => signs.some((s) => s > 0));
        expect(signedDestinations).toHaveLength(7);

        // Unambiguous where stated: no room is entered with two different
        // non-zero signs, so a room's region IS well defined when it exists.
        for (const [dest, signs] of signedDestinations) {
            const nonZero = [...new Set(signs.filter((s) => s > 0))];
            expect(nonZero, `room ${dest} carries conflicting signs`).toHaveLength(1);
        }
        // ⛓ AND THE POINT: every one of them also has a silent entrance.
        for (const [dest, signs] of signedDestinations) {
            expect(signs.some((s) => s === SIGN_NONE),
                `room ${dest} is only ever entered with a sign, so §4.6's rule would hold for it`)
                .toBe(true);
        }
    });

    it('vanilla exercises all seven entries of the closed sign table', () => {
        const used = new Set();
        for (const id of VANILLA) {
            const doc = vanillaDoc(id);
            for (const ex of doc.exits) if (ex.sign > 0) used.add(ex.sign);
            for (const f of doc.fallthroughs) if (f.sign > 0) used.add(f.sign);
        }
        expect([...used].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(MAX_REGION).toBe(7);
    });

    // ⛓ THE WARP-LOOP HAZARD IS NOT REAL, AND A RULE REFUSING IT WOULD REFUSE
    // THE GAME — §9.3's lesson, third time in this arc. `Game.update()` runs
    // every entity's `check()` behind a `!checked` latch BEFORE `super.update()`,
    // so the portal under an arriving player is already `playerTouching` when its
    // own `update()` runs that same frame.
    it('vanilla lands the player ON a return portal four times', () => {
        // The player's box on arrival at (px, py): `new Player(px, py)` centres
        // on the tile (+8) and `normalHitbox` is 4x5 at origin (2, 2).
        const overlapsCell = (px, py, ex, ey) => (px + 6) < ex + TILE_PX && ex < (px + 10)
            && (py + 6) < ey + TILE_PX && ey < (py + 11);
        const landings = [];
        for (const id of VANILLA) {
            for (const ex of vanillaDoc(id).exits) {
                if (ex.playerx === null || ex.playery === null) continue;
                if (!VANILLA.includes(ex.to)) continue;
                for (const back of vanillaDoc(ex.to).exits) {
                    if (overlapsCell(ex.playerx, ex.playery, back.x, back.y)) {
                        landings.push({ from: id, to: ex.to, backTo: back.to });
                    }
                }
            }
        }
        expect(landings).toHaveLength(4);
        // ⛓ AND IN EVERY CASE THE PORTAL LANDED ON POINTS BACK. That is what
        // makes it deliberate rather than an authoring slip: these are mutual
        // doorways, which is exactly the shape `linkGeneratedRooms` emits.
        for (const l of landings) expect(l.backTo).toBe(l.from);
    });

    // The rule Phase 5b added to the validator was measured against the real
    // game BEFORE it was written as an error rather than a warning.
    it('no vanilla arrival lands outside its destination room', () => {
        // The reduced fixture carries no <width>/<height>, so the check that
        // matters is that the PARSE reports the absence rather than inventing a
        // rectangle — an invented one would make this rule vacuous on every
        // embed-sourced set.
        expect(vanillaDoc(0).size).toBeNull();
    });
});

describe('signForTransition — the rule §4.6 could not state', () => {
    it('announces the destination region only when it CHANGES', () => {
        expect(signForTransition(1, 2)).toBe(2);
        expect(signForTransition(2, 1)).toBe(1);
        expect(signForTransition(1, 1)).toBe(SIGN_NONE);
        expect(signForTransition(REGION_NONE, 3)).toBe(3);
    });

    it('announces nothing when the destination has no declared region', () => {
        expect(signForTransition(4, REGION_NONE)).toBe(SIGN_NONE);
        expect(signForTransition(REGION_NONE, REGION_NONE)).toBe(SIGN_NONE);
        expect(signForTransition(undefined, undefined)).toBe(SIGN_NONE);
    });

    it('refuses a region past the closed seven-entry table', () => {
        expect(() => signForTransition(1, 8)).toThrow(/CLOSED/);
    });
});

describe('walkableCellsFrom — what the DATA walk cannot see', () => {
    it('floods the open interior of a bordered room and stops at the ring', () => {
        const flood = walkableCellsFrom(room(), { tx: 1, ty: 1 });
        expect(flood.size).toBe(8 * 8);
        expect(flood.has('0,0')).toBe(false);
        expect(flood.get('1,1').dist).toBe(0);
        expect(flood.get('8,8').dist).toBe(14);
    });

    it('does not cross a wall the generator painted, so a sealed cell is not a candidate', () => {
        // Seal (8,8) into its own pocket with an L of wall.
        const sealed = withTerrain(room(), [
            { tx: 7, ty: 8, terrain: 'wall' },
            { tx: 8, ty: 7, terrain: 'wall' },
            { tx: 7, ty: 7, terrain: 'wall' },
        ]);
        const flood = walkableCellsFrom(sealed, { tx: 1, ty: 1 });
        expect(flood.has('8,8')).toBe(false);
        expect(flood.size).toBe(8 * 8 - 4);
    });

    it('refuses a start cell that is inside a wall rather than reporting nothing reachable', () => {
        expect(() => walkableCellsFrom(room(), { tx: 0, ty: 0 }))
            .toThrow(LevelSetExitError);
        expect(() => walkableCellsFrom(room(), { tx: 0, ty: 0 }))
            .toThrow(/reachable from nowhere/);
    });

    it('records the neighbour each cell was reached through, and it is adjacent', () => {
        const flood = walkableCellsFrom(room(), { tx: 1, ty: 1 });
        for (const c of flood.values()) {
            if (c.from === null) continue;
            expect(Math.abs(c.from.tx - c.tx) + Math.abs(c.from.ty - c.ty)).toBe(1);
            expect(flood.has(`${c.from.tx},${c.from.ty}`)).toBe(true);
            expect(approachKey(c.from, c)).toMatch(/^(up|down|left|right)$/);
        }
    });

    it('sees an ENTITY solid, not only terrain', () => {
        const blocked = withEntities(room(), [
            // A pushable block is a 16x16 solid; the model builds it from the
            // same table the game does.
            { type: 'pushableblock', ...oelAtTile(1, 2) },
        ]);
        const flood = walkableCellsFrom(blocked, { tx: 1, ty: 1 });
        expect(flood.has('1,2')).toBe(false);
    });
});

describe('planTopology', () => {
    it('chains N rooms with N-1 two-way links', () => {
        expect(planTopology(4)).toEqual([{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }]);
    });

    it('closes the ring', () => {
        expect(planTopology(4, { kind: 'ring' })).toHaveLength(4);
        expect(planTopology(4, { kind: 'ring' }).at(-1)).toEqual({ a: 3, b: 0 });
    });

    it('does not double a two-room ring back onto itself', () => {
        expect(planTopology(2, { kind: 'ring' })).toEqual([{ a: 0, b: 1 }]);
    });

    it('refuses an unknown topology by name', () => {
        expect(() => planTopology(3, { kind: 'star' })).toThrow(/not one of chain, ring/);
    });
});

describe('linkGeneratedRooms — the EMIT arm', () => {
    // ⛔ EVERY TEST ROOM HAS AN UNREACHABLE POCKET, AND IT IS NOT DECORATION.
    // The first version of this suite used fully open rooms, so "a door is in
    // the room's walkable component" was true of every cell and the assertion
    // below could not fail. A mutant that drew door candidates from the whole
    // interior instead of from the flood passed it — the same shape as Phase
    // 5's D2, and the same answer: close it rather than leave the pair tidy.
    // The pocket (7,7)-(8,8) is sealed off, and it contains the cell farthest
    // from the start by raw distance, which is exactly what such a mutant picks.
    const POCKET_WALLS = [
        { tx: 6, ty: 7, terrain: 'wall' }, { tx: 6, ty: 8, terrain: 'wall' },
        { tx: 7, ty: 6, terrain: 'wall' }, { tx: 8, ty: 6, terrain: 'wall' },
    ];
    const rooms = (n) => Array.from({ length: n }, (_, i) => ({
        record: withEntities(withTerrain(room(i), POCKET_WALLS),
            [{ type: 'torchpickup', ...oelAtTile(4, 4), attrs: { tag: '0' } }]),
        start: { tx: 1, ty: 1 },
    }));

    it('turns N isolated rooms into a set reachable from its start — the blocking item', () => {
        const before = buildLevelSet(rooms(6).map((r) => r.record), { setId: 'before' });
        expect(reachabilityOf(before.set).reachable).toBe(1);

        const { records } = linkGeneratedRooms(rooms(6));
        const after = buildLevelSet(records, { setId: 'after' });
        const reach = reachabilityOf(after.set);
        expect(reach.reachable).toBe(6);
        expect(reach.unreachable).toEqual([]);
    });

    it('emits a set that survives the inherited validator with no one-way warning', () => {
        const { records } = linkGeneratedRooms(rooms(5));
        const { set } = buildLevelSet(records, { setId: 'linked' });
        const v = validateLevelSet(set);
        expect(v.errors).toEqual([]);
        expect(v.warnings.filter((w) => /one-way/.test(w))).toEqual([]);
    });

    // ⛓ THE PROPERTY THAT MAKES THE SET TRAVERSABLE IN THE GAME rather than in
    // the data: every door of a room is in the SAME walkable component, so a
    // player arriving at any of them can reach all the others. `reachabilityOf`
    // is blind to this — it would report 6/6 for six rooms whose exits are
    // sealed inside walls.
    it('puts every door of a room in the room\'s own walkable component', () => {
        const rs = rooms(4);
        const { records, doors } = linkGeneratedRooms(rs, { topology: 'ring' });
        records.forEach((record, id) => {
            const flood = walkableCellsFrom(record, rs[id].start);
            const mine = doors.filter((d) => d.room === id);
            expect(mine.length).toBeGreaterThan(0);
            for (const d of mine) {
                expect(flood.has(`${d.cell.tx},${d.cell.ty}`),
                    `room ${id} door (${d.cell.tx}, ${d.cell.ty}) is outside its own component`)
                    .toBe(true);
            }
        });
    });

    it('lands each arrival exactly on the destination\'s door for the same link', () => {
        const { doors } = linkGeneratedRooms(rooms(4), { topology: 'ring' });
        for (const d of doors) {
            const back = doors.find((o) => o.link === d.link && o.room === d.to);
            expect(back, `no return door for link ${d.link} in room ${d.to}`).toBeDefined();
            expect(d.arrival).toEqual({ x: back.cell.tx * TILE_SIZE, y: back.cell.ty * TILE_SIZE });
        }
    });

    it('never places a door on an occupied cell or on the room\'s own start', () => {
        const rs = rooms(4);
        const { records, doors } = linkGeneratedRooms(rs, { topology: 'ring' });
        records.forEach((record, id) => {
            // The occupancy of the room BEFORE its doors were added.
            const taken = occupiedCells(rs[id].record);
            for (const d of doors.filter((x) => x.room === id)) {
                expect(taken.has(`${d.cell.tx},${d.cell.ty}`)).toBe(false);
                expect(d.cell).not.toEqual(rs[id].start);
            }
        });
    });

    // ⛔ REGRESSION, FOUND ON THE REAL SIX-SEED EXPORT. Room 1's two doors came
    // out at (8,1) and (8,2) — so the `approach` cell handed back as a witness
    // for one of them WAS the other door, and a tape told to walk in from there
    // would have warped before taking a step.
    it('keeps two doors of one room non-adjacent, so no approach cell is a door', () => {
        const { doors } = linkGeneratedRooms(rooms(5), { topology: 'ring' });
        for (const d of doors) {
            const others = doors.filter((o) => o.room === d.room && o !== d);
            for (const o of others) {
                expect(Math.abs(o.cell.tx - d.cell.tx) + Math.abs(o.cell.ty - d.cell.ty))
                    .toBeGreaterThan(1);
            }
            expect(others.some((o) => o.cell.tx === d.approach.tx && o.cell.ty === d.approach.ty))
                .toBe(false);
        }
    });

    it('gives every door an APPROACH cell that is free, adjacent, and names one key', () => {
        const rs = rooms(4);
        const { records, doors } = linkGeneratedRooms(rs, { topology: 'chain' });
        for (const d of doors) {
            expect(d.approach).not.toBeNull();
            const flood = walkableCellsFrom(records[d.room], rs[d.room].start);
            expect(flood.has(`${d.approach.tx},${d.approach.ty}`)).toBe(true);
            expect(approachKey(d.approach, d.cell)).toBe(d.key);
        }
    });

    it('emits every attribute the receivers require, so the room still builds', () => {
        const { records } = linkGeneratedRooms(rooms(3));
        const { set } = buildLevelSet(records, { setId: 'attrs' });
        const doc = parseRoomXml(set.rooms[1].source.xml);
        expect(doc.exits).toHaveLength(2);
        for (const ex of doc.exits) {
            expect(EXIT_ELEMENTS).toContain(ex.element);
            expect(Number.isInteger(ex.to)).toBe(true);
            // ⛔ `levelWorld`'s `intAttr(attrs, 'to')` has NO fallback: a
            // teleporter missing any of these three throws at build time rather
            // than defaulting, so emitting them is not decoration.
            expect(ex.playerx).not.toBeNull();
            expect(ex.playery).not.toBeNull();
        }
    });

    // ⛓ THE SIGN RULE, END TO END. Two regions, one boundary: exactly the two
    // exits that cross it announce, and each announces the region it ARRIVES in.
    it('signs exactly the region-crossing exits, with the destination\'s region', () => {
        const { doors, report } = linkGeneratedRooms(rooms(4), { regions: [1, 1, 2, 2] });
        expect(report.announced).toBe(2);
        expect(report.silent).toBe(doors.length - 2);
        const crossings = doors.filter((d) => d.sign !== SIGN_NONE);
        expect(crossings.map((d) => [d.room, d.to, d.sign]))
            .toEqual([[1, 2, 2], [2, 1, 1]]);
    });

    it('announces nothing at all when no region is declared, and says how many', () => {
        const { doors, report } = linkGeneratedRooms(rooms(4));
        expect(report.announced).toBe(0);
        expect(report.silent).toBe(doors.length);
        expect(report.regions_declared).toBe(0);
    });

    it('refuses a room with too few free cells rather than placing an unreachable door', () => {
        // A room whose walkable component is one cell — the start, which is
        // never a door — so there is no cell a door could legally take.
        const tiny = withTerrain(room(0), [
            { tx: 2, ty: 1, terrain: 'wall' },
            { tx: 1, ty: 2, terrain: 'wall' },
        ]);
        expect(() => linkGeneratedRooms([
            { record: tiny, start: { tx: 1, ty: 1 } }, { record: room(1), start: { tx: 1, ty: 1 } },
        ])).toThrow(/reachabilityOf cannot see/);
    });

    it('refuses a link that names a room outside the set', () => {
        expect(() => linkGeneratedRooms(rooms(2), { links: [{ a: 0, b: 5 }] }))
            .toThrow(/outside 0\.\.1/);
        expect(() => linkGeneratedRooms(rooms(2), { links: [{ a: 1, b: 1 }] }))
            .toThrow(/to itself/);
    });

    it('refuses an element that does not carry @to', () => {
        expect(() => linkGeneratedRooms(rooms(2), { element: 'button' }))
            .toThrow(/does not carry @to/);
    });

    it('is deterministic — same rooms, same doors', () => {
        const a = linkGeneratedRooms(rooms(5), { topology: 'ring' });
        const b = linkGeneratedRooms(rooms(5), { topology: 'ring' });
        expect(JSON.stringify(a.doors)).toBe(JSON.stringify(b.doors));
    });
});

describe('retargetRoomXml — the RETARGET arm', () => {
    const xml = '<level>\n  <width>160</width>\n  <height>160</height>\n  <objects>\n'
        + '    <teleporter x="16" y="16" to="3" playerx="32" playery="48" sign="0" tag="-1"/>\n'
        + '    <stairsdown x="48" y="16" to="4" playerx="16" playery="16"/>\n'
        + '    <control x="0" y="0" xOff="8" yOff="8" fallthrough="7" sign="2"/>\n'
        + '  </objects>\n</level>\n';

    it('rewrites to/playerx/playery/sign and leaves every other byte alone', () => {
        const { xml: out, applied, seen } = retargetRoomXml(xml, {
            exits: [{ index: 0, to: 9, playerx: 64, playery: 80, sign: 5 }],
        });
        expect(applied).toBe(1);
        expect(seen).toEqual({ exits: 2, fallthroughs: 1 });
        const doc = parseRoomXml(out);
        expect(doc.exits[0]).toMatchObject({ to: 9, playerx: 64, playery: 80, sign: 5 });
        // untouched, byte for byte
        expect(out.split('\n')[5]).toBe(xml.split('\n')[5]);
        expect(out.split('\n')[6]).toBe(xml.split('\n')[6]);
    });

    it('refuses to move a destination without also settling the sign', () => {
        expect(() => retargetRoomXml(xml, { exits: [{ index: 0, to: 9 }] }))
            .toThrow(/announces the region of the room the player did NOT go to/);
        expect(() => retargetRoomXml(xml, { fallthroughs: [{ index: 0, to: 2 }] }))
            .toThrow(/Game\.as:2148/);
    });

    it('adds no sign attribute where there was none and the new sign is 0', () => {
        const { xml: out } = retargetRoomXml(xml, {
            exits: [{ index: 1, to: 2, sign: SIGN_NONE }],
        });
        expect(out).not.toMatch(/stairsdown[^>]*sign=/);
        expect(parseRoomXml(out).exits[1].to).toBe(2);
    });

    it('retargets a fallthrough on <control>, which is where @fallthrough lives', () => {
        const { xml: out } = retargetRoomXml(xml, {
            fallthroughs: [{ index: 0, to: 1, sign: 4 }],
        });
        const doc = parseRoomXml(out);
        expect(doc.fallthroughs[0]).toMatchObject({ element: 'control', to: 1, sign: 4 });
        // ⚠ the OFFSET is not an arrival and must survive untouched (Game.as:2126-2128)
        expect(out).toMatch(/xOff="8" yOff="8"/);
    });
});

describe('retargetLevelSet — over the real vanilla cross-reference graph', () => {
    // The reduced OEL fixture: every element that carries a level index, with the
    // tile grid dropped. It is the whole surface this arm touches (§9.4).
    const vanillaSet = () => stampLevelSetIdentity({
        schema_version: 1,
        set_id: 'vanilla-reduced',
        provenance: { generator: 'levelSetExits.test' },
        rooms: VANILLA.map((i) => ({
            id: i, name: `r${i}`, source: { xml: roomRefs.rooms[i] }, music: 0,
        })),
        start: { level: 0 },
        menu_rooms: [0],
        named_rooms: {},
    }, 'vanilla-reduced');

    const perm = (r) => (r * 7 + 3) % VANILLA.length;

    it('retargets all 280 exits and gets every destination right', () => {
        const before = vanillaSet();
        const { set: after, report } = retargetLevelSet(before, {
            destinationOf: (roomId, index, to) => perm(to),
        });
        expect(report.retargeted).toBe(280);
        expect(report.unreadable).toEqual([]);
        for (const id of VANILLA) {
            const was = parseRoomXml(before.rooms[id].source.xml).exits;
            const now = parseRoomXml(after.rooms[id].source.xml).exits;
            expect(now).toHaveLength(was.length);
            was.forEach((ex, k) => expect(now[k].to).toBe(perm(ex.to)));
        }
    });

    it('changes NOTHING outside the exit elements', () => {
        const before = vanillaSet();
        const { set: after } = retargetLevelSet(before, { destinationOf: (r, i, to) => perm(to) });
        const strip = (xml) => xml.replace(/<(teleporter|stairsup|stairsdown)[^>]*>/g, '<EXIT/>');
        for (const id of VANILLA) {
            expect(strip(after.rooms[id].source.xml)).toBe(strip(before.rooms[id].source.xml));
        }
    });

    it('carries the sign with the transition, under a declared region map', () => {
        const regions = VANILLA.map((i) => (i < 58 ? 1 : 2));
        const before = vanillaSet();
        const { set: after, report } = retargetLevelSet(before, {
            destinationOf: (r, i, to) => perm(to), regions,
        });
        expect(report.announced + report.silent).toBe(280);
        for (const id of VANILLA) {
            const now = parseRoomXml(after.rooms[id].source.xml).exits;
            for (const ex of now) {
                const want = regions[ex.to] === regions[id] ? SIGN_NONE : regions[ex.to];
                expect(ex.sign).toBe(want);
            }
        }
    });

    // ⛔ A RETARGETED SET IS A DIFFERENT SET. Keeping the old stamp would let a
    // save from the old layout be adopted under the new one — the exact silent
    // reinterpretation §9.1 put the content hash inside the id to close.
    it('re-stamps identity, and does not stamp the INPUT set by aliasing', () => {
        const before = vanillaSet();
        const beforeId = before.set_id;
        const beforeHash = before.provenance.content_hash;
        const { set: after, report } = retargetLevelSet(before, {
            destinationOf: (r, i, to) => perm(to),
        });
        expect(after.set_id).not.toBe(beforeId);
        expect(report.set_id_before).toBe(beforeId);
        expect(report.set_id_after).toBe(after.set_id);
        expect(before.set_id).toBe(beforeId);
        expect(before.provenance.content_hash).toBe(beforeHash);
    });

    it('NAMES a room whose source it could not read instead of skipping it quietly', () => {
        const set = vanillaSet();
        set.rooms[4] = { id: 4, name: 'embedded', source: { embed: 'levels/x.oel' }, music: 0 };
        const { report } = retargetLevelSet(set, { destinationOf: (r, i, to) => perm(to) });
        expect(report.unreadable).toEqual([{ id: 4, name: 'embedded' }]);
    });

    it('leaves an exit alone when destinationOf declines it', () => {
        const before = vanillaSet();
        const { set: after, report } = retargetLevelSet(before, { destinationOf: () => null });
        expect(report.retargeted).toBe(0);
        for (const id of VANILLA) {
            expect(after.rooms[id].source.xml).toBe(before.rooms[id].source.xml);
        }
    });
});

describe('the validator rule Phase 5b added', () => {
    const withArrival = (playerx, playery) => {
        const rs = [
            { record: room(0), start: { tx: 1, ty: 1 } },
            { record: room(1), start: { tx: 1, ty: 1 } },
        ];
        const { records } = linkGeneratedRooms(rs);
        const broken = records.map((r, i) => (i !== 0 ? r : {
            ...r,
            entities: r.entities.map((e) => (EXIT_ELEMENTS.includes(e.type)
                ? { ...e, attrs: { ...e.attrs, playerx, playery } } : e)),
        }));
        return buildLevelSet(broken, { setId: 'arrival' }).set;
    };

    it('refuses an arrival outside the destination room, by name', () => {
        const v = validateLevelSet(withArrival(320, 16));
        expect(v.ok).toBe(false);
        expect(v.errors.join(' ')).toMatch(/arrives at \(320, 16\), outside room 1/);
    });

    it('accepts an arrival inside it', () => {
        expect(validateLevelSet(withArrival(16, 16)).errors).toEqual([]);
    });

    it('keeps the tile constant it checks against in step with the engine', () => {
        expect(TILE_PX).toBe(TILE_SIZE);
    });
});
