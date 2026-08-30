// frontend/modules/procgenCore/worldSetAdapter.test.js
/**
 * procgenCore/worldSetAdapter — **THE COMPOSITE, OVER A TWO-PART TOY.**
 *
 * EDITOR INTEGRATION slice W2.
 *
 * ⛔ **THE PARTS ARE TOYS, DELIBERATELY.** The module under test may import no
 * substrate and neither does this file. Two toys with DIFFERENT vocabularies
 * are what make the union rows bite — `alpha` has `replace-room` and `beta` has
 * `mark-location`, so "a kind ONE part has" and "a kind NEITHER has" are
 * different cases here, which they would not be over two copies of one
 * substrate. The REAL composite over `seedlingSetAdapter` and `mazeSetAdapter`
 * is `seedlingDemo/worldChain.test.js`.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import {
    assertAdapterBehaviour, canonicalJson, createEditSession, foldEdits, group, rectCopy,
    rectPasteOps,
} from './editCore.js';
import { roomRowsOf } from './setEditorCore.js';
import { emptyWorld } from './worldDocument.js';
import {
    PART_ADDRESSED_OP_KINDS, WORLD_FIELDS, WORLD_ONLY_OP_KINDS, createWorldSetAdapter,
    globalIndexOf, isWorldSetRefusal, partAt, partSpans, validateWorldForDownload, worldAdapterFns,
    worldRecord,
} from './worldSetAdapter.js';

/* ══════════════════════════════════════════════════════════════════════
 * THE TOYS — two substrates with two vocabularies
 * ══════════════════════════════════════════════════════════════════════ */

class ToyRefusal extends Error {
    constructor(message) { super(message); this.name = 'ToyRefusal'; }
}
const toyFail = (m) => { throw new ToyRefusal(m); };

const roomsOf = (rec) => rec.doc.rooms;
const frozen = (doc, overlay) => Object.freeze({ doc, overlay });

/** ⛓ ONE renumbering machine, exactly as both real adapters have one. */
function renumber(rec, plan) {
    const rooms = plan.map((old) => (old === null ? null : roomsOf(rec)[old]));
    const mapping = new Map();
    plan.forEach((old, next) => { if (old !== null) mapping.set(old, next); });
    const overlayRooms = {};
    for (const [key, value] of Object.entries(rec.overlay.rooms ?? {})) {
        const to = mapping.get(Number(key));
        if (to !== undefined) overlayRooms[String(to)] = value;
    }
    const retarget = (room) => (room === null ? null : ({
        ...room,
        exits: (room.exits ?? []).map((e) => ({ ...e, to: mapping.get(e.to) ?? null })),
    }));
    return frozen({ ...rec.doc, rooms: rooms.map(retarget) }, { ...rec.overlay, rooms: overlayRooms });
}

function toyAdapter(name, extraKinds) {
    const KINDS = [...new Set([
        'add-room', 'remove-room', 'reorder', 'set-room-field', 'set-overlay', 'connect',
        'disconnect', ...extraKinds,
    ])].sort();
    const at = (rec, room, where) => {
        const list = roomsOf(rec);
        if (!Number.isInteger(room) || room < 0 || room >= list.length) {
            toyFail(`${name}: ${where} names room ${JSON.stringify(room)}; this part has ${list.length}`);
        }
        return list[room];
    };
    const OPS = {
        'add-room': (rec, op) => {
            const list = roomsOf(rec);
            const index = Number.isInteger(op.at) ? op.at : list.length;
            if (index < 0 || index > list.length) toyFail(`${name}: \`at\` ${index} is outside 0..${list.length}`);
            const plan = [];
            for (let i = 0; i < index; i += 1) plan.push(i);
            plan.push(null);
            for (let i = index; i < list.length; i += 1) plan.push(i);
            const grown = renumber(rec, plan);
            const rooms = [...grown.doc.rooms];
            rooms[index] = { name: op.name ?? 'new', exits: [] };
            return { record: frozen({ ...grown.doc, rooms }, grown.overlay), description: `add room "${op.name}"` };
        },
        'remove-room': (rec, op) => {
            at(rec, op.room, '`remove-room`');
            if (roomsOf(rec).length === 1) toyFail(`${name}: a part keeps at least one room`);
            const plan = roomsOf(rec).map((_, i) => i).filter((i) => i !== op.room);
            return { record: renumber(rec, plan), description: `remove room ${op.room}` };
        },
        reorder: (rec, op) => {
            const n = roomsOf(rec).length;
            const sorted = [...(op.order ?? [])].sort((a, b) => a - b);
            if (sorted.length !== n || sorted.some((v, i) => v !== i)) {
                toyFail(`${name}: \`order\` must be a permutation of 0..${n - 1}`);
            }
            return { record: renumber(rec, op.order), description: `reorder ${op.order.join(',')}` };
        },
        'set-room-field': (rec, op) => {
            at(rec, op.room, '`set-room-field`');
            if (op.field !== 'name') toyFail(`${name}: \`set-room-field\` writes name, not "${op.field}"`);
            const rooms = roomsOf(rec).map((r, i) => (i === op.room ? { ...r, name: op.value } : r));
            return { record: frozen({ ...rec.doc, rooms }, rec.overlay), description: `set room ${op.room} name` };
        },
        'set-overlay': (rec, op) => {
            at(rec, op.room, '`set-overlay`');
            const rooms = { ...(rec.overlay.rooms ?? {}) };
            if (op.overlay === null) delete rooms[String(op.room)]; else rooms[String(op.room)] = op.overlay;
            return { record: frozen(rec.doc, { ...rec.overlay, rooms }), description: `set overlay ${op.room}` };
        },
        connect: (rec, op) => {
            const room = at(rec, op.from?.[0], '`connect`.from');
            at(rec, op.to?.[0], '`connect`.to');
            const ordinal = op.from?.[1];
            if (!Number.isInteger(ordinal) || !(room.exits ?? [])[ordinal]) {
                toyFail(`${name}: room ${op.from?.[0]} has no exit ordinal ${JSON.stringify(ordinal)}`);
            }
            const rooms = roomsOf(rec).map((r, i) => (i === op.from[0]
                ? { ...r, exits: r.exits.map((e, x) => (x === ordinal ? { ...e, to: op.to[0] } : e)) } : r));
            return { record: frozen({ ...rec.doc, rooms }, rec.overlay), description: `connect ${op.from} -> ${op.to}` };
        },
        disconnect: (rec, op) => {
            const room = at(rec, op.room, '`disconnect`');
            if (!(room.exits ?? [])[op.exitIndex]) toyFail(`${name}: no exit ordinal ${op.exitIndex}`);
            const rooms = roomsOf(rec).map((r, i) => (i === op.room
                ? { ...r, exits: r.exits.filter((_, x) => x !== op.exitIndex) } : r));
            return { record: frozen({ ...rec.doc, rooms }, rec.overlay), description: `disconnect ${op.room}/${op.exitIndex}` };
        },
    };
    for (const kind of extraKinds) {
        OPS[kind] = (rec, op) => {
            at(rec, op.room, `\`${kind}\``);
            const rooms = roomsOf(rec).map((r, i) => (i === op.room ? { ...r, [kind]: op.value ?? true } : r));
            return { record: frozen({ ...rec.doc, rooms }, rec.overlay), description: `${kind} on ${op.room}` };
        };
    }
    return Object.freeze({
        name,
        SET_OP_KINDS: Object.freeze(KINDS),
        apply(record, op) {
            const fn = Object.hasOwn(OPS, op?.op) ? OPS[op.op] : null;
            if (!fn) return { ok: false, description: `${name}: no op "${op?.op}"` };
            try {
                const { record: next, description } = fn(record, op);
                return { ok: true, op, record: next, description };
            } catch (e) {
                if (e?.name === 'ToyRefusal') return { ok: false, description: e.message, reason: e.name };
                throw e;
            }
        },
        equal: (a, b) => canonicalJson(a?.doc) === canonicalJson(b?.doc),
        bounds: (rec) => ({ w: roomsOf(rec).length, h: 1 }),
        readCell: (rec, x, y) => {
            if (y !== 0) toyFail(`${name}: one row only`);
            const room = at(rec, x, 'readCell');
            return { room: { name: room.name }, overlay: rec.overlay.rooms?.[String(x)] ?? null };
        },
        writeOps: (desc, x, y) => {
            if (y !== 0) toyFail(`${name}: one row only`);
            return [
                { op: 'set-room-field', room: x, field: 'name', value: desc.room.name },
                { op: 'set-overlay', room: x, overlay: desc.overlay },
            ];
        },
    });
}

const ALPHA = toyAdapter('alpha', ['replace-room']);
const BETA = toyAdapter('beta', ['mark-location']);

const partOf = (id, adapter, substrate) => ({
    id,
    kind: id === 'a' ? 'level-set' : 'region-library',
    adapter,
    opKinds: adapter.SET_OP_KINDS,
    recordOf: (doc, overlay) => frozen(doc, overlay),
    splitRecord: (rec) => ({ doc: rec.doc, overlay: rec.overlay }),
    readSetCell: (rec, x, y) => adapter.readCell(rec, x, y),
    exitsOfRoom: (rec, room) => (roomsOf(rec)[room]?.exits ?? [])
        .map((e, index) => ({ index, exit_id: `e${index}`, to: e.to })),
    whatLinksHere: (rec, room) => ({
        links: roomsOf(rec).flatMap((r, from) => (r.exits ?? [])
            .filter((e) => e.to === room).map((e, i) => ({ from, kind: 'exit', index: i, exit_id: `e${i}` }))),
        unreadable: [],
    }),
    bounds: (rec) => adapter.bounds(rec),
    isRefusal: (e) => e?.name === 'ToyRefusal',
    substrateOfRoom: () => substrate,
    validateForDownload: (session) => {
        const rec = session.record();
        const bad = roomsOf(rec).filter((r) => r.name === '');
        return { ok: bad.length === 0, errors: bad.map(() => 'a room has an empty name'), warnings: [] };
    },
});

const PARTS = () => [partOf('a', ALPHA, 'sub_a'), partOf('b', BETA, 'sub_b')];

const doc = (names, exits = []) => ({
    rooms: names.map((name, i) => ({ name, exits: exits[i] ?? [] })),
});

const RECORD = () => worldRecord(
    emptyWorld([
        { id: 'a', kind: 'level-set', overlay: { rooms: {} } },
        { id: 'b', kind: 'region-library', overlay: { rooms: {} } },
    ]),
    {
        a: doc(['A0', 'A1', 'A2'], [[{ to: 1 }], [{ to: 2 }], []]),
        b: doc(['B0', 'B1'], [[{ to: 1 }], []]),
    },
);

const adapter = () => createWorldSetAdapter({ parts: PARTS() });
const apply = (record, op) => {
    const r = adapter().apply(record, op);
    if (!r.ok) throw new Error(`the fixture's own op was refused: ${r.description}`);
    return r.record;
};
const refusalOf = (record, op) => {
    const r = adapter().apply(record, op);
    expect(r.ok, `expected a refusal, got: ${r.description}`).toBe(false);
    return r.description;
};

/* ══════════════════════════════════════════════════════════════════════
 * THE CORE'S CONTRACT
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ `editCore`\'s seven contract laws hold over a TWO-PART world', () => {
    /**
     * ⛔ **LAW 7 IS RUN INSIDE ONE PART, DELIBERATELY.** The default `other` is
     * `{x: w-1}`, which here is the other part — and a paste across parts is a
     * REFUSAL by design, so the law would be asking the adapter to do the one
     * thing it exists to forbid. Cells 0 and 1 are both part "a".
     */
    it('`assertAdapterBehaviour` passes with law 7 INSIDE a part', () => {
        expect(assertAdapterBehaviour(adapter(), {
            record: RECORD(),
            op: { op: 'set-room-field', room: 0, field: 'name', value: 'Renamed' },
            refused: { op: 'set-room-field', room: 0, field: 'colour', value: 'red' },
            cell: { x: 0, y: 0 },
            other: { x: 1, y: 0 },
        })).toBe(true);
    });

    it('the grid is the parts CONCATENATED, and a global index resolves to (part, local)', () => {
        const record = RECORD();
        expect(adapter().bounds(record)).toEqual({ w: 5, h: 1 });
        expect(partSpans(record, PARTS()).map((s) => [s.part.id, s.offset, s.count]))
            .toEqual([['a', 0, 3], ['b', 0 + 3, 2]]);
        expect(partAt(record, 3, PARTS()).part.id).toBe('b');
        expect(partAt(record, 3, PARTS()).local).toBe(0);
        expect(() => partAt(record, 5, PARTS())).toThrow(/"a" 0\.\.2, "b" 3\.\.4/);
        expect(() => adapter().readCell(record, 0, 1)).toThrow(/ONE-ROW grid/);
    });

    /**
     * ⛓⛓⛓ EDITOR INTEGRATION W4 — **AND BACK: (part, LOCAL) → the GLOBAL
     * index.** The page opens *room 1 of part "b"* and has to issue the
     * composite's op by the GLOBAL index, so the inverse is a function and not
     * a page-side sum.
     *
     * ⛔⛔ **THE OFF-BY-ONE AT THE PART SEAM IS INVISIBLE INSIDE PART 0.** A
     * mutant that returns `local` unchanged (or `offset + local - 1`) is GREEN
     * for every room of the FIRST part, whose local indices ARE its global
     * ones — which is the same blindness the undo row below records. Every
     * assertion here is therefore about part "b" as well as part "a".
     */
    it('`globalIndexOf` is `partAt`\'s inverse, and it round trips at the SEAM', () => {
        const record = RECORD();
        expect(globalIndexOf(record, 'a', 0, PARTS())).toBe(0);
        expect(globalIndexOf(record, 'a', 2, PARTS())).toBe(2);
        expect(globalIndexOf(record, 'b', 0, PARTS())).toBe(3);
        expect(globalIndexOf(record, 'b', 1, PARTS())).toBe(4);
        // ⛓ the round trip, over EVERY room of the world
        for (let g = 0; g < adapter().bounds(record).w; g += 1) {
            const at = partAt(record, g, PARTS());
            expect(globalIndexOf(record, at.part.id, at.local, PARTS())).toBe(g);
        }
        /**
         * ⛔ AN OUT-OF-RANGE LOCAL INDEX REFUSES rather than answering a number
         * outside its part: `globalIndexOf(record, 'a', 3)` would be 3, which
         * `partAt` resolves to part "b" room 0 — a silent answer addressing a
         * DIFFERENT DOCUMENT.
         */
        expect(() => globalIndexOf(record, 'a', 3, PARTS()))
            .toThrow(/names room 3 of part "a", which holds 3 room\(s\) \(0\.\.2\)/);
        expect(() => globalIndexOf(record, 'b', -1, PARTS())).toThrow(/names room -1 of part "b"/);
        expect(() => globalIndexOf(record, 'nope', 0, PARTS())).toThrow(/names part "nope"/);
        expect(isWorldSetRefusal(
            (() => { try { globalIndexOf(record, 'a', 9, PARTS()); return null; } catch (e) { return e; } })(),
        )).toBe(true);
    });

    /**
     * ⛔ mutant: drop `substrate` from the descriptor. The strip's whole point
     * is that a reader can see which substrate plays each room WITHOUT deriving
     * an atlas, and law 7 still holds because the field is a per-part constant.
     */
    it('`readCell` adds `part` and `substrate` to the part\'s own descriptor', () => {
        const record = RECORD();
        expect(adapter().readCell(record, 0, 0))
            .toEqual({ room: { name: 'A0' }, overlay: null, part: 'a', substrate: 'sub_a' });
        expect(adapter().readCell(record, 4, 0))
            .toEqual({ room: { name: 'B1' }, overlay: null, part: 'b', substrate: 'sub_b' });
        // ⛓ a part that declares no reader gets `null`, never a guess.
        const noReader = createWorldSetAdapter({
            parts: PARTS().map((p) => ({ ...p, substrateOfRoom: undefined })),
        });
        expect(noReader.readCell(record, 0, 0).substrate).toBeNull();
    });

    it('`equal` is the WORLD canonically AND every part\'s own `equal`', () => {
        const record = RECORD();
        expect(adapter().equal(record, record)).toBe(true);
        // a part's document moved
        expect(adapter().equal(record, apply(record, { op: 'set-room-field', room: 0, field: 'name', value: 'X' })))
            .toBe(false);
        // only the WORLD moved — the parts' documents are untouched
        const named = apply(record, { op: 'set-field', path: 'name', value: 'Two Toys' });
        expect(adapter().equal(record, named)).toBe(false);
        expect(ALPHA.equal(record.parts.a && { doc: record.parts.a }, { doc: named.parts.a })).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FORWARDING
 * ══════════════════════════════════════════════════════════════════════ */

describe('forwarding — every op kind of BOTH vocabularies', () => {
    it('the roster is the UNION of the parts\' own, plus the world\'s', () => {
        const kinds = adapter().SET_OP_KINDS;
        for (const k of [...ALPHA.SET_OP_KINDS, ...BETA.SET_OP_KINDS]) expect(kinds).toContain(k);
        for (const k of [...WORLD_ONLY_OP_KINDS, ...PART_ADDRESSED_OP_KINDS]) expect(kinds).toContain(k);
        // ⛔ DERIVED — not a list typed in the module (trap 574's shape).
        expect(kinds).toEqual([...new Set([
            ...ALPHA.SET_OP_KINDS, ...BETA.SET_OP_KINDS,
            ...WORLD_ONLY_OP_KINDS, ...PART_ADDRESSED_OP_KINDS,
        ])].sort());
    });

    it.each([
        { op: 'set-room-field', room: 0, extra: { field: 'name', value: 'Renamed' }, part: 'a' },
        { op: 'set-room-field', room: 4, extra: { field: 'name', value: 'Renamed' }, part: 'b' },
        { op: 'set-overlay', room: 1, extra: { overlay: { rules: {} } }, part: 'a' },
        { op: 'set-overlay', room: 3, extra: { overlay: { rules: {} } }, part: 'b' },
        { op: 'disconnect', room: 0, extra: { exitIndex: 0 }, part: 'a' },
        { op: 'disconnect', room: 3, extra: { exitIndex: 0 }, part: 'b' },
    ])('forwards `$op` at global room $room to part "$part"', ({ op, room, extra, part }) => {
        const result = adapter().apply(RECORD(), { op, room, ...extra });
        expect(result.ok).toBe(true);
        expect(result.description).toMatch(new RegExp(`^world: part "${part}":`));
    });

    /**
     * ⛔ **A KIND ONE PART HAS AND THE OTHER DOES NOT** — forwarded where it
     * exists, refused with THAT part's vocabulary where it does not. The toys
     * differ on purpose: `alpha` has `replace-room`, `beta` has `mark-location`.
     */
    it('a kind ONE part has works there and refuses in the other, quoting its vocabulary', () => {
        expect(adapter().apply(RECORD(), { op: 'replace-room', room: 0 }).ok).toBe(true);
        expect(refusalOf(RECORD(), { op: 'replace-room', room: 3 }))
            .toMatch(/part "b" \(region-library\) has no op "replace-room" — its vocabulary is/);
        expect(adapter().apply(RECORD(), { op: 'mark-location', room: 3 }).ok).toBe(true);
        expect(refusalOf(RECORD(), { op: 'mark-location', room: 0 })).toMatch(/part "a" .* has no op "mark-location"/);
    });

    /** ⛔ …and a kind NEITHER part has names BOTH vocabularies. */
    it('a kind NEITHER part has refuses with both vocabularies named', () => {
        const why = refusalOf(RECORD(), { op: 'set-access-rule', room: 0, rule: {} });
        expect(why).toMatch(/no op "set-access-rule"/);
        expect(why).toMatch(/"a": .*replace-room/);
        expect(why).toMatch(/"b": .*mark-location/);
        expect(why).toMatch(/plus the world's own add-room, connect, disconnect, reorder, set-field/);
    });

    it('the part\'s own REFUSAL travels, prefixed with the part it came from', () => {
        expect(refusalOf(RECORD(), { op: 'set-room-field', room: 0, field: 'colour', value: 'red' }))
            .toBe('world: part "a": alpha: `set-room-field` writes name, not "colour"');
        // ⛓ and a room outside the world at all is the WORLD's refusal
        expect(refusalOf(RECORD(), { op: 'set-room-field', room: 9, field: 'name', value: 'x' }))
            .toMatch(/`set-room-field` names room 9; this world holds 5 room\(s\)/);
    });

    it('`add-room` and `reorder` are addressed by PART NAME and refuse without one', () => {
        const grown = apply(RECORD(), { op: 'add-room', part: 'b', name: 'B2' });
        expect(adapter().bounds(grown)).toEqual({ w: 6, h: 1 });
        expect(adapter().readCell(grown, 5, 0).room.name).toBe('B2');
        for (const op of PART_ADDRESSED_OP_KINDS) {
            expect(refusalOf(RECORD(), { op, order: [0, 1, 2] }))
                .toMatch(new RegExp(`\`${op}\` is PER PART and must name one — "a", "b"`));
        }
        expect(refusalOf(RECORD(), { op: 'reorder', part: 'ghost', order: [0] }))
            .toMatch(/names part "ghost"; this world holds "a", "b"/);
        // ⛓ a reorder cannot cross parts — position is identity inside each one
        expect(refusalOf(RECORD(), { op: 'reorder', part: 'a', order: [0, 1, 2, 3, 4] }))
            .toMatch(/permutation of 0\.\.2/);
    });

    it('`set-field` addresses the WORLD, or a part when one is named', () => {
        const named = apply(RECORD(), { op: 'set-field', path: 'name', value: 'Two Toys' });
        expect(named.world.name).toBe('Two Toys');
        expect(WORLD_FIELDS).toEqual(['name', 'description']);
        expect(refusalOf(RECORD(), { op: 'set-field', path: 'world_id', value: 'x' }))
            .toMatch(/`world_id` is STAMPED at download, not set/);
        expect(refusalOf(RECORD(), { op: 'set-field', path: 'name', value: 7 })).toMatch(/must be a string/);
        // a part-addressed one goes to the part — which these toys do not have,
        // so it comes back with THAT part's vocabulary rather than the world's.
        expect(refusalOf(RECORD(), { op: 'set-field', part: 'a', path: 'name', value: 'x' }))
            .toMatch(/`set-field` names neither a room nor a part/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE CROSSINGS
 * ══════════════════════════════════════════════════════════════════════ */

describe('connect / disconnect — one part, or the world', () => {
    const CROSS = {
        op: 'connect',
        from: { part: 'a', room: 2, exit: 'out_a2' },
        to: { part: 'b', room: 0, exit: 'e0' },
        one_way: true,
    };

    /** ⛔ mutant: forward a cross-part connect to a part. */
    it('a CROSS-part connect writes `world.links` and touches no part document', () => {
        const record = RECORD();
        const next = apply(record, CROSS);
        expect(next.world.links).toEqual([{ from: CROSS.from, to: CROSS.to, one_way: true }]);
        expect(canonicalJson(next.parts)).toBe(canonicalJson(record.parts));
        expect(adapter().apply(record, CROSS).description)
            .toBe('world: connect a/2/out_a2 -> b/0/e0');
    });

    /** ⛔ mutant: write a same-part connect to `world.links`. */
    it('a SAME-part connect is FORWARDED, in the part\'s own array form', () => {
        const record = RECORD();
        const next = apply(record, { op: 'connect', from: [0, 0], to: [2, 0] });
        expect(next.world.links).toEqual([]);
        expect(next.parts.a.rooms[0].exits[0].to).toBe(2);
        // ⛓ …and re-based: global 3→4 is part "b"'s 0→1
        const inB = apply(record, { op: 'connect', from: [3, 0], to: [4, 0] });
        expect(inB.parts.b.rooms[0].exits[0].to).toBe(1);
    });

    it('an ARRAY connect that straddles two parts refuses, and says which form to use', () => {
        const why = refusalOf(RECORD(), { op: 'connect', from: [0, 0], to: [3, 0] });
        expect(why).toMatch(/joins room 0 of part "a" to room 3 of part "b" in the ARRAY form/);
        expect(why).toMatch(/from:\{part, room, exit\}/);
        expect(why).toMatch(/Seedling an ORDINAL, the maze an exit id/);
    });

    it('an OBJECT connect inside ONE part refuses — that door is the part\'s own', () => {
        expect(refusalOf(RECORD(), {
            op: 'connect',
            from: { part: 'a', room: 0, exit: 'x' },
            to: { part: 'a', room: 1, exit: 'y' },
            one_way: false,
        })).toMatch(/joins two rooms of part "a" — a world link is a crossing BETWEEN parts/);
        // ⛓ half of each is neither
        expect(refusalOf(RECORD(), { op: 'connect', from: { part: 'a', room: 0, exit: 'x' }, to: [3, 0] }))
            .toMatch(/Half of each is neither/);
    });

    it('a crossing with no `one_way`, a bad room or an unknown part refuses through `linksErrors`', () => {
        const { one_way: _drop, ...noWay } = CROSS;
        expect(refusalOf(RECORD(), noWay)).toMatch(/one_way must be a boolean and is REQUIRED/);
        expect(refusalOf(RECORD(), { ...CROSS, to: { part: 'b', room: 9, exit: 'e0' } }))
            .toMatch(/room is 9 and part "b" holds 2 room\(s\)/);
        expect(refusalOf(RECORD(), { ...CROSS, to: { part: 'ghost', room: 0, exit: 'e0' } }))
            .toMatch(/which this world does not hold/);
        // ⛓ ONE ENDPOINT, ONE LINK — against the links already there
        const one = apply(RECORD(), CROSS);
        expect(refusalOf(one, { ...CROSS, to: { part: 'b', room: 1, exit: 'e0' } }))
            .toMatch(/already joins — an exit crosses to exactly one place/);
    });

    it('`disconnect` with an OBJECT endpoint removes the world link, from either side', () => {
        const one = apply(RECORD(), CROSS);
        expect(apply(one, { op: 'disconnect', from: CROSS.from }).world.links).toEqual([]);
        expect(apply(one, { op: 'disconnect', from: CROSS.to }).world.links).toEqual([]);
        expect(refusalOf(one, { op: 'disconnect', from: { part: 'a', room: 0, exit: 'nope' } }))
            .toMatch(/no world link joins a\/0\/nope/);
        expect(refusalOf(RECORD(), { op: 'disconnect', from: CROSS.from }))
            .toMatch(/crossings are \(none\)/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE RE-KEY
 * ══════════════════════════════════════════════════════════════════════ */

describe('a renumbering in one part re-keys the WORLD\'s links', () => {
    const withLinks = () => {
        let record = RECORD();
        record = apply(record, {
            op: 'connect', from: { part: 'a', room: 2, exit: 'x' }, to: { part: 'b', room: 1, exit: 'y' }, one_way: true,
        });
        record = apply(record, {
            op: 'connect', from: { part: 'a', room: 0, exit: 'z' }, to: { part: 'b', room: 0, exit: 'w' }, one_way: false,
        });
        return record;
    };

    /** ⛔ mutant: forward a reorder and leave `world.links` alone. */
    it('a reorder in part A moves A\'s endpoints and leaves B\'s alone', () => {
        const next = apply(withLinks(), { op: 'reorder', part: 'a', order: [2, 1, 0] });
        expect(next.world.links.map((l) => [l.from.room, l.to.room])).toEqual([[0, 1], [2, 0]]);
        // …and the part really did reorder
        expect(next.parts.a.rooms.map((r) => r.name)).toEqual(['A2', 'A1', 'A0']);
    });

    it('an add-room shifts the endpoints at or after it; an APPEND moves nothing', () => {
        expect(apply(withLinks(), { op: 'add-room', part: 'b', at: 0, name: 'B-' })
            .world.links.map((l) => l.to.room)).toEqual([2, 1]);
        expect(apply(withLinks(), { op: 'add-room', part: 'b', name: 'B2' })
            .world.links.map((l) => l.to.room)).toEqual([1, 0]);
    });

    it('a remove-room DROPS the link into the dead room and SAYS how many went', () => {
        const result = adapter().apply(withLinks(), { op: 'remove-room', room: 4 });
        expect(result.ok).toBe(true);
        expect(result.record.world.links).toHaveLength(1);
        expect(result.record.world.links[0].to.room).toBe(0);
        expect(result.description).toMatch(/1 world link\(s\) into a room that is gone went with it/);
        // ⛓ and a removal that strands nothing says nothing
        expect(adapter().apply(withLinks(), { op: 'remove-room', room: 1 }).description)
            .not.toMatch(/went with it/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * PASTE, ROWS, DOWNLOAD
 * ══════════════════════════════════════════════════════════════════════ */

describe('the paste, the rows and the download check', () => {
    /** ⛔ mutant: let `writeOps` drop `part`; the cross-part paste then lands. */
    it('a paste ACROSS parts REFUSES by name; one INSIDE a part lands', () => {
        const record = RECORD();
        const a = adapter();
        const clip = rectCopy(a, record, { x: 0, y: 0, w: 1, h: 1 });
        const across = rectPasteOps(a, record, clip, 3, 0);
        expect(across.ops.length).toBeGreaterThan(0);
        // ⛓ the FOLD is where a refusal lands, and `foldEdits` throws it rather
        //   than skipping — a skipped paste would reconstruct a different world.
        expect(() => foldEdits(a, record, [across]))
            .toThrow(/carries a descriptor from part "a" and room 3 is in part "b"/);
        expect(() => foldEdits(a, record, [across])).toThrow(/A PASTE ACROSS PARTS IS REFUSED/);
        // …and the same clip INSIDE part "a" really does paste
        const inside = foldEdits(a, record, [rectPasteOps(a, record, clip, 2, 0)]);
        expect(inside.dropped).toEqual([]);
        expect(a.readCell(inside.record, 2, 0).room.name).toBe('A0');
        // ⛓ a descriptor from a part this world does not hold refuses in writeOps
        expect(() => a.writeOps({ ...a.readCell(record, 0, 0), part: 'ghost' }, 0, 0))
            .toThrow(/handed a descriptor from part "ghost"/);
    });

    it('`roomRowsOf` takes the composite\'s fns unchanged, and links here crosses parts', () => {
        const record = apply(RECORD(), {
            op: 'connect', from: { part: 'a', room: 2, exit: 'x' }, to: { part: 'b', room: 0, exit: 'e0' }, one_way: true,
        });
        const rows = roomRowsOf(record, worldAdapterFns(PARTS()));
        expect(rows).toHaveLength(5);
        expect(rows.map((r) => r.name)).toEqual(['A0', 'A1', 'A2', 'B0', 'B1']);
        expect(rows.map((r) => r.exits)).toEqual([1, 1, 0, 1, 0]);
        // ⛔ room 3 is part "b" room 0, reached ONLY from the other part — a
        //   part cannot see that, so `whatLinksHere` had to add it.
        expect(rows[3].linkedFrom).toBe(1);
        expect(rows[1].linkedFrom).toBe(1); // part-internal, re-based to GLOBAL 0
    });

    it('`validateWorldForDownload` runs every part\'s validator PLUS the link check', () => {
        const record = apply(RECORD(), { op: 'set-room-field', room: 3, field: 'name', value: '' });
        const check = validateWorldForDownload({ record: () => record }, PARTS());
        expect(check.ok).toBe(false);
        expect(check.errors).toEqual(['part "b": a room has an empty name']);
        expect(check.world_id).toBeNull();
        expect(validateWorldForDownload({ record: () => RECORD() }, PARTS()).ok).toBe(true);
        // ⛓ the LINK check is the world's own half — a hand-built bad link is caught
        const bad = Object.freeze({
            ...RECORD(),
            world: { ...RECORD().world, links: [{ from: { part: 'a', room: 0, exit: 'x' }, to: { part: 'a', room: 1, exit: 'y' }, one_way: true }] },
        });
        expect(validateWorldForDownload({ record: () => bad }, PARTS()).errors.join(' '))
            .toMatch(/joins two rooms of part "a"/);
    });

    /**
     * ⛔⛔ **THE SESSION STORES THE OP IT IS HANDED BACK AND REFOLDS THE LIST
     * FROM THE BASE, SO A RE-BASED OP IN THAT LIST ADDRESSES THE WRONG PART.**
     *
     * ⛓ The first spelling returned the re-based op — `{room: <LOCAL>}` — and
     * every row in this file stayed GREEN, because each of them touched part
     * "a", whose local indices ARE the global ones. The chain row over the two
     * real adapters found it on the first refold, with the MAZE part's own
     * `connect` arriving at the Seedling part. This is that case, brought back
     * where it belongs: an op in the SECOND part, replayed.
     * ⛔ mutant: return `inner` instead of `op` from `forward`.
     */
    it('an op in the SECOND part survives a REFOLD — the stored op is GLOBAL', () => {
        const record = RECORD();
        const s = createEditSession(adapter(), record);
        s.apply({ op: 'set-room-field', room: 3, field: 'name', value: 'B0!' });
        s.apply({ op: 'set-room-field', room: 4, field: 'name', value: 'B1!' });
        // the stored edits address GLOBAL rooms, which is what a refold replays
        expect(s.payload().edits.map((o) => o.room)).toEqual([3, 4]);
        // one undo REFOLDS the remaining op from the base — the moment a local
        // index in the list would land on part "a" instead
        expect(s.undo()).toBe(true);
        expect(adapter().readCell(s.record(), 3, 0).room.name).toBe('B0!');
        expect(adapter().readCell(s.record(), 0, 0).room.name).toBe('A0');
        expect(s.undo()).toBe(true);
        expect(canonicalJson(s.record())).toBe(canonicalJson(record));
    });

    it('a session over the composite undoes back to its base', () => {
        const record = RECORD();
        const s = createEditSession(adapter(), record);
        s.apply({ op: 'set-room-field', room: 0, field: 'name', value: 'X' });
        s.apply({ op: 'add-room', part: 'b', name: 'B2' });
        s.apply({ op: 'connect', from: { part: 'a', room: 2, exit: 'x' }, to: { part: 'b', room: 2, exit: 'y' }, one_way: true });
        expect(adapter().equal(s.record(), record)).toBe(false);
        while (s.undo());
        expect(adapter().equal(s.record(), record)).toBe(true);
        expect(canonicalJson(s.record())).toBe(canonicalJson(record));
    });

    it('refuses a part list that is empty, duplicated or missing an injected half', () => {
        expect(() => createWorldSetAdapter({ parts: [] })).toThrow(/non-empty `parts` array/);
        expect(() => createWorldSetAdapter({ parts: [PARTS()[0], PARTS()[0]] })).toThrow(/two parts are called "a"/);
        const { splitRecord: _gone, ...crippled } = PARTS()[0];
        expect(() => createWorldSetAdapter({ parts: [crippled] })).toThrow(/without `splitRecord`/);
        try {
            createWorldSetAdapter({ parts: [] });
        } catch (e) {
            expect(isWorldSetRefusal(e)).toBe(true);
        }
    });

    /** ⛔ The fence, stated locally as well as in `bindingContract`'s roster. */
    it('this module imports no substrate', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync(new URL('./worldSetAdapter.js', import.meta.url), 'utf8');
        expect(src).not.toMatch(/from '\.\.\/(seedlingDemo|mazeRoom|flashPanel)\//);
    });
});
