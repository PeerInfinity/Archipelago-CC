/**
 * seedlingDemo/seedlingSetAdapter — **THE LEVEL SET AS AN `editCore` ADAPTER**
 * (EDITOR v3 slice D1; plan §16.3, §16.4, §20).
 *
 * ⛔ **EVERY SET HERE IS GENERATED, NOT TYPED.** `buildLevelSet({link: true})`
 * over `emptyLevel` rooms is the exporter's own path, the same one D0b's
 * agreement row uses — so no row can pass by agreeing with a document somebody
 * wrote to make it pass. The one hand-built thing is a seventh room's
 * `<teleporter>` and `<control fallthrough>`, and both are written through
 * `recordToOel`, the repo's one OEL renderer.
 *
 * ⛓⛓ WHAT IS GATED HERE, IN ORDER OF WEIGHT:
 *
 *  1. `assertAdapterBehaviour` — the core's seven laws, on a substrate whose
 *     cells are ROOMS.
 *  2. every op's REFUSAL, by name — the table in the module docblock.
 *  3. the ONE-STAMP law: five ops then one download is one id, and no op
 *     stamps anything.
 *  4. the CHAIN: a generated set → ops → derive → validate → compile →
 *     `unwired_exits` vs `reachabilityOf` → `reachableRegions`, then undo back
 *     to the base.
 */

import { describe, expect, it } from 'vitest';

import {
    assertAdapterBehaviour, canonicalJson, createEditSession, rectCopy, rectPasteOps,
} from '../procgenCore/editCore.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions } from '../procgenCore/rulesGraph.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { indexMapDocument, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { buildLevelSet, reachabilityOf } from './levelSetExporter.js';
import { removeExitFromRoomXml } from './levelSetExits.js';
import { parseRoomXml, stampLevelSetIdentity, validateLevelSet } from './levelSetValidator.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel, recordToOel } from './procgenLevelOel.js';
import { createSeedlingEditAdapter } from './seedlingEditAdapter.js';
import { regionIdFor } from './seedlingAtlasDerivation.js';
import { emptyOverlay, exitRuleKey, locationRuleKey } from './seedlingSetOverlay.js';
import {
    ROOM_FIELDS, SET_FIELDS, SET_OP_KINDS, closeRoomSession, createSeedlingSetAdapter,
    createSetSession, deriveAtlasOf, downloadSet, exitsOfRoom, roomsOfSet, rulesJsonOf,
    setRecord, setSessionRoomSource, whatLinksHere,
} from './seedlingSetAdapter.js';

const TILE = 16;
const ROOMS = 6;
const ATLAS_SCHEMA = loadAtlasSchema();
const RULES_SCHEMA = loadRulesSchema();

const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE,
    tileTypeForPlacement,
    rulesSchema: RULES_SCHEMA,
    atlas: { game: 'seedling-set-test', mapDocument: 'set-adapter-test.json' },
});

const adapter = createSeedlingSetAdapter(DEPS);

/** A generated N-room set, wired by the exporter's own linker. */
function generatedSet(n = ROOMS, setId = 'set-adapter-test') {
    return buildLevelSet(Array.from({ length: n }, (_, level) => emptyLevel({ level })),
        { setId, link: true }).set;
}

const baseRecord = (n = ROOMS) => setRecord(generatedSet(n));

const session = (n = ROOMS) => {
    const record = baseRecord(n);
    return {
        record,
        s: createSetSession(adapter, record, { base: { kind: 'set', set_id: record.set.set_id } }),
    };
};

/** A room with a teleporter (and optionally a pit control) — rendered, never typed. */
function wiredRoom(level, to, { fallthrough = null, pickup = false } = {}) {
    const base = emptyLevel({ level });
    const entities = [...(base.entities ?? []), {
        type: 'teleporter', x: 2 * TILE, y: 2 * TILE,
        attrs: { to, playerx: 128, playery: 128, tag: -1, show: 1, sign: 0 },
    }];
    if (fallthrough !== null) {
        entities.push({ type: 'control', x: 0, y: 0, attrs: { fallthrough, xOff: 0, yOff: 0, sign: 0 } });
    }
    if (pickup) entities.push({ type: 'torchpickup', x: 4 * TILE, y: 3 * TILE, attrs: {} });
    return recordToOel({ ...base, entities });
}

const apply = (s, op) => {
    const res = s.apply(op);
    if (!res.ok) throw new Error(res.description);
    return res;
};

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ the core\'s contract laws, on a substrate whose cells are ROOMS', () => {
    it('assertAdapterBehaviour passes with `other` = a DIFFERENT room', () => {
        const record = baseRecord();
        expect(assertAdapterBehaviour(adapter, {
            record,
            op: { op: 'set-room-field', room: 0, field: 'music', value: 5 },
            refused: { op: 'set-room-field', room: 99, field: 'music', value: 5 },
            cell: { x: 0, y: 0 },
            other: { x: ROOMS - 1, y: 0 },
        })).toBe(true);
    });

    /**
     * ⛓⛓ **THE ROW-GRID DECISION, STATED AS A MEASUREMENT.** `bounds` is
     * `{w: rooms.length, h: 1}` because a set IS a positionally addressed list
     * — the schema says "Position is identity", which is exactly why a reorder
     * has to rewrite every `@to`. A second row would be an axis with no meaning
     * and law 7 would be writing a room to a coordinate that names nothing.
     */
    it('rooms are a ONE-ROW grid and row 1 is REFUSED by name', () => {
        const record = baseRecord();
        expect(adapter.bounds(record)).toEqual({ w: ROOMS, h: 1 });
        expect(() => adapter.readCell(record, 0, 1)).toThrow(/ONE-ROW grid/);
        expect(() => adapter.writeOps({ room: {} }, 0, 1)).toThrow(/ONE-ROW grid/);
        expect(() => adapter.readCell(record, ROOMS, 0)).toThrow(/this set has 6/);
    });

    /**
     * ⛔ **`id` IS NOT IN THE DESCRIPTOR.** A room's id is its POSITION, so a
     * descriptor carrying it would disagree with wherever it is pasted — and
     * law 7 would fail on the one field the substrate is not free to choose.
     */
    it('the cell descriptor is a room plus its overlay, and carries no `id`', () => {
        const record = baseRecord();
        const desc = adapter.readCell(record, 2, 0);
        expect(Object.keys(desc).sort()).toEqual(['overlay', 'room']);
        // ⛓ EDITOR v3 E1b — the whole `source` travels, KIND AND ALL, so a
        //   copy never converts an `xml` room to a record or the reverse.
        expect(Object.keys(desc.room).sort()).toEqual(['music', 'name', 'source']);
        expect(desc.room.source).toEqual(record.set.rooms[2].source);
        expect(desc.overlay).toBeNull();
        expect(desc.room.name).toBe(record.set.rooms[2].name);
    });

    it('the optional flags appear only when TRUE, as the set carries them', () => {
        const { s } = session();
        expect(adapter.readCell(s.record(), 1, 0).room.snow_gradient).toBeUndefined();
        apply(s, { op: 'set-room-field', room: 1, field: 'snow_gradient', value: true });
        expect(adapter.readCell(s.record(), 1, 0).room.snow_gradient).toBe(true);
        apply(s, { op: 'set-room-field', room: 1, field: 'snow_gradient', value: false });
        expect(adapter.readCell(s.record(), 1, 0).room.snow_gradient).toBeUndefined();
        // ⛔ absent, not `false`: the schema says absent MEANS false, and a set
        //    full of `false` flags is noise a reader skims past
        expect(Object.hasOwn(s.record().set.rooms[1], 'snow_gradient')).toBe(false);
    });

    /**
     * ⛔⛔ **ABSENT MEANS FALSE, SO REPRODUCING A DESCRIPTOR MEANS CLEARING A
     * FLAG THE DESTINATION HAPPENS TO CARRY.** Measured: without this row
     * nothing reached `writeOps`' clearing branch at all — the contract's law 7
     * writes room 0 onto room 5 and neither carries a flag, so a `writeOps`
     * that emitted no clearing op read back identical and the branch was a
     * comment with an `if` in front of it ([[feedback_fixture_must_discriminate_two_builds]]).
     */
    it('a paste of an UNFLAGGED room onto a FLAGGED one clears the flag', () => {
        const { record, s } = session();
        apply(s, { op: 'set-room-field', room: 5, field: 'snow_gradient', value: true });
        apply(s, { op: 'set-room-field', room: 5, field: 'music_override_exempt', value: true });
        const desc = adapter.readCell(record, 0, 0);
        expect(desc.room.snow_gradient).toBeUndefined();
        apply(s, { op: 'group', label: 'paste room 0 onto room 5', ops: adapter.writeOps(desc, 5, 0) });
        expect(canonicalJson(adapter.readCell(s.record(), 5, 0).room))
            .toBe(canonicalJson(desc.room));
        expect(Object.hasOwn(s.record().set.rooms[5], 'snow_gradient')).toBe(false);
        expect(Object.hasOwn(s.record().set.rooms[5], 'music_override_exempt')).toBe(false);
    });

    /**
     * ⛓⛓ **`rectCopy`/`rectPasteOps` ARE A ROOM COPY BETWEEN SETS, with no new
     * code** — reason 2 for the row grid, exercised rather than asserted.
     */
    it('a clip of three rooms pastes into ANOTHER set through the core alone', () => {
        const from = baseRecord();
        const intoRecord = setRecord(generatedSet(ROOMS, 'set-adapter-destination'));
        const into = createSetSession(adapter, intoRecord,
            { base: { kind: 'set', set_id: intoRecord.set.set_id } });
        const clip = rectCopy(adapter, from, { x: 0, y: 0, w: 3, h: 1 });
        expect(clip.cells[0]).toHaveLength(3);
        /**
         * ⚠ PASTED AT 3, NOT AT 0, AND THE REASON IS A REAL PROPERTY OF THE
         * FOLD. Both sets are built from the same six `emptyLevel` rooms, so
         * rooms 0..2 are BYTE-IDENTICAL between them — a paste there changes
         * nothing, `equal` says so, and the core drops the whole stroke as a
         * no-op. A row that pasted at 0 would assert `applied` and be asserting
         * that two identical documents differ.
         */
        for (let i = 0; i < 3; i += 1) {
            expect(canonicalJson(adapter.readCell(into.record(), i + 3, 0)))
                .not.toBe(canonicalJson(clip.cells[0][i]));
        }
        const stroke = rectPasteOps(adapter, into.record(), clip, 3, 0);
        expect(apply(into, stroke).applied).toBe(true);
        for (let i = 0; i < 3; i += 1) {
            expect(canonicalJson(adapter.readCell(into.record(), i + 3, 0)))
                .toBe(canonicalJson(adapter.readCell(from, i, 0)));
        }
        // ⛓ ONE GROUP IS ONE UNDO, even though it carried 3 rooms x 5 ops
        expect(into.ops()).toHaveLength(1);
        expect(into.undo()).toBe(true);
        expect(adapter.equal(into.record(), intoRecord)).toBe(true);
    });

    /**
     * ⛔ **A PASTE PAST THE END IS A REFUSAL, NOT AN IMPLICIT `add-room`** — the
     * brief proposed the append and it is not implementable: `writeOps` is
     * handed a DESCRIPTOR and two coordinates and never sees the record, so it
     * cannot know where the end is. `rectPasteOps` clips before calling it, so
     * the case only arises from a hand-built op list.
     */
    it('writeOps past the end emits ops that REFUSE, and rectPasteOps clips first', () => {
        const record = baseRecord();
        const desc = adapter.readCell(record, 0, 0);
        const ops = adapter.writeOps(desc, ROOMS, 0);
        expect(ops[0]).toMatchObject({ op: 'replace-room', room: ROOMS });
        expect(adapter.apply(record, ops[0]).ok).toBe(false);
        expect(adapter.apply(record, ops[0]).description).toMatch(/names room 6; this set has 6/);
        // the core CLIPS, so a paste running off the end writes only what lands
        const clip = rectCopy(adapter, record, { x: 0, y: 0, w: 2, h: 1 });
        const stroke = rectPasteOps(adapter, record, clip, ROOMS - 1, 0);
        expect(stroke.ops.every((op) => op.room === ROOMS - 1)).toBe(true);
    });
});

describe('the op vocabulary, and every refusal by name', () => {
    /**
     * ⛔ THE ROSTER AND THE DISPATCH TABLE ARE ASKED TO AGREE, rather than the
     * roster's length being pinned: a count is a property of the roster, and a
     * kind that joined `SET_OP_KINDS` without a handler (or the reverse) is the
     * defect worth catching.
     */
    it(`names its ${SET_OP_KINDS.length} kinds, dispatches every one, and lists them on a miss`, () => {
        const record = baseRecord();
        const miss = adapter.apply(record, { op: 'nope' });
        expect(miss.ok).toBe(false);
        expect(miss.description).toContain('no op "nope"');
        for (const kind of SET_OP_KINDS) expect(miss.description).toContain(kind);
        // every declared kind REACHES a handler — its refusal is about its own
        // arguments, never "no op"
        for (const kind of SET_OP_KINDS) {
            const res = adapter.apply(record, { op: kind });
            expect(res.ok, kind).toBe(false);
            expect(res.description, kind).not.toContain('no op');
        }
        expect([...SET_OP_KINDS].sort()).toEqual([...SET_OP_KINDS]);
    });

    /**
     * ⛔⛔ **A BRAND-NEW ROOM'S `@to`s ARE ALREADY IN NEW COORDINATES**, and an
     * APPEND cannot show it: appending at the end leaves an IDENTITY mapping, so
     * a renumbering that wrongly remapped the new room's exits would move them
     * to exactly where they already were. Inserting at 0 is the discriminator —
     * every old room shifts up by one and a wrongly-remapped `to: 5` becomes 6.
     */
    it('add-room INSERTED at 0 leaves the new room\'s own @to alone and shifts the rest', () => {
        const { s } = session();
        apply(s, { op: 'add-room', xml: wiredRoom(9, 5), name: 'Inserted', at: 0 });
        expect(s.record().set.rooms[0].name).toBe('Inserted');
        expect(s.record().set.rooms.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        // the NEW room's exit still names room 5, which it was authored against
        expect(parseRoomXml(s.record().set.rooms[0].source.xml).exits.map((e) => e.to)).toEqual([5]);
        // …and every OLD room's exits shifted up by one
        expect(parseRoomXml(s.record().set.rooms[1].source.xml).exits.map((e) => e.to)).toEqual([2]);
        expect(parseRoomXml(s.record().set.rooms[3].source.xml).exits.map((e) => e.to)).toEqual([2, 4]);
        expect(s.record().set.start.level).toBe(1);
    });

    it('add-room refuses unparseable xml, a non-level document and an `at` out of range', () => {
        const { s } = session();
        expect(s.apply({ op: 'add-room', xml: '<level><objects/></level>' }).description)
            .toMatch(/carries no rectangle/);
        // ⛓ E1b — ONE OP, TWO DOORS, and exactly one of them at a time
        expect(s.apply({ op: 'add-room' }).description)
            .toMatch(/needs exactly one of `record`.*got neither/s);
        expect(s.apply({
            op: 'add-room', xml: recordToOel(emptyLevel({ level: 9 })),
            record: emptyLevel({ level: 9 }),
        }).description).toMatch(/needs exactly one of `record`.*got both/s);
        expect(s.apply({ op: 'add-room', xml: recordToOel(emptyLevel({ level: 9 })), at: 99 }).description)
            .toMatch(/`at` is 99; it must be 0\.\.6/);
        expect(s.apply({ op: 'add-room', xml: wiredRoom(9, 42) }).description)
            .toMatch(/an exit to room 42, outside 0\.\.6/);
    });

    /**
     * ⛔ **A REMOVE THAT WOULD ORPHAN A DOOR REFUSES AND LISTS THEM.** Silently
     * repointing a transition the author never looked at is the defect this op
     * exists to prevent.
     */
    it('remove-room refuses while anything targets it, and names every one', () => {
        const { s } = session();
        const res = s.apply({ op: 'remove-room', room: 3 });
        expect(res.ok).toBe(false);
        expect(res.description).toMatch(/would orphan 2 transitions into it/);
        expect(res.description).toContain('room 2 exit 1');
        expect(res.description).toContain('room 4 exit 0');
        // ⛓ and it GOES THROUGH once every one is named (the retarget speaks in
        //   OLD coordinates — the op maps them through the renumbering)
        const ok = apply(s, {
            op: 'remove-room', room: 3, retarget: { '2_1': 4, '4_0': 2 },
        });
        expect(ok.description).toMatch(/remove room 3/);
        expect(s.record().set.rooms).toHaveLength(5);
        expect(reachabilityOf(s.record().set).unreachable).toEqual([]);
    });

    it('remove-room refuses to empty the set, and refuses a retarget naming the dying room', () => {
        const one = setRecord(buildLevelSet([emptyLevel({ level: 0 })], { setId: 'lonely' }).set);
        expect(adapter.apply(one, { op: 'remove-room', room: 0 }).description)
            .toMatch(/would empty the set/);
        const { s } = session();
        expect(s.apply({ op: 'remove-room', room: 3, retarget: { '2_1': 3, '4_0': 2 } }).description)
            .toMatch(/it must be an OLD room index in 0\.\.5 other than 3/);
    });

    it('reorder refuses anything that is not a permutation', () => {
        const { s } = session();
        for (const order of [[0, 1, 2], [0, 1, 2, 3, 4, 4], [0, 1, 2, 3, 4, 9], 'nope', null]) {
            expect(s.apply({ op: 'reorder', order }).description, JSON.stringify(order))
                .toMatch(/needs a PERMUTATION of 0\.\.5/);
        }
        expect(apply(s, { op: 'reorder', order: [5, 4, 3, 2, 1, 0] }).applied).toBe(true);
    });

    it('connect refuses an exit ordinal the room does not have, and a self-join', () => {
        const { s } = session();
        expect(s.apply({ op: 'connect', from: [0, 4], to: [1, 0] }).description)
            .toMatch(/names exit 4; that room has 1 exit carrying a @to/);
        expect(s.apply({ op: 'connect', from: [0, 0], to: [0, 0] }).description)
            .toMatch(/joins room 0 exit 0 to itself/);
        expect(s.apply({ op: 'connect', from: [0, 0] }).description).toMatch(/`to` is \[room, exitIndex\]/);
    });

    it('set-field refuses an undeclared path and a room that does not exist', () => {
        const { s } = session();
        expect(s.apply({ op: 'set-field', path: 'set_id', value: 'x' }).description)
            .toMatch(/is not one the level-set schema declares/);
        expect(s.apply({ op: 'set-field', path: 'start', value: { level: 99 } }).description)
            .toMatch(/start names room 99; this set has 6/);
        expect(s.apply({ op: 'set-field', path: 'menu_rooms', value: [] }).description)
            .toMatch(/must be a NON-EMPTY array/);
        expect(s.apply({ op: 'set-field', path: 'named_rooms', value: { invented: { level: 0 } } }).description)
            .toMatch(/is not one of the six/);
        expect(apply(s, { op: 'set-field', path: 'name', value: 'Renamed' }).applied).toBe(true);
        expect(s.record().set.name).toBe('Renamed');
        expect(SET_FIELDS).toEqual(['name', 'description', 'start', 'menu_rooms', 'named_rooms']);
    });

    it('set-room-field refuses `id`, `source`, an out-of-range music and a wrong type', () => {
        const { s } = session();
        expect(ROOM_FIELDS).toEqual(['name', 'music', 'music_override_exempt', 'snow_gradient']);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'id', value: 3 }).description)
            .toMatch(/NOT `id`/);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'source', value: {} }).description)
            .toMatch(/NOT\n?\s*`source`|NOT `source`/);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'music', value: 14 }).description)
            .toMatch(/outside -1\.\.13/);
        expect(apply(s, { op: 'set-room-field', room: 0, field: 'music', value: -1 }).applied).toBe(true);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'snow_gradient', value: 1 }).description)
            .toMatch(/snow_gradient is a boolean/);
    });

    it('replace-room refuses a transition out of range, quoting the game\'s own hazard', () => {
        const { s } = session();
        expect(s.apply({ op: 'replace-room', room: 1, xml: wiredRoom(1, 9) }).description)
            .toMatch(/a transition to room 9, outside 0\.\.5/);
        expect(apply(s, { op: 'replace-room', room: 1, xml: wiredRoom(1, 2) }).applied).toBe(true);
    });

    it('mark-location refuses an entity the room does not hold, and a duplicate name', () => {
        const { s } = session();
        apply(s, { op: 'replace-room', room: 1, xml: wiredRoom(1, 2, { pickup: true }) });
        expect(s.apply({
            op: 'mark-location', room: 1, entity: { type: 'torchpickup', x: 0, y: 0 },
            name: 'T', vanilla_item: 'Light',
        }).description).toMatch(/room 1 holds no <torchpickup> at \(0, 0\)/);
        apply(s, {
            op: 'mark-location', room: 1, entity: { type: 'torchpickup', x: 4 * TILE, y: 3 * TILE },
            name: 'T', vanilla_item: 'Light',
        });
        apply(s, { op: 'replace-room', room: 2, xml: wiredRoom(2, 3, { pickup: true }) });
        expect(s.apply({
            op: 'mark-location', room: 2, entity: { type: 'torchpickup', x: 4 * TILE, y: 3 * TILE },
            name: 'T', vanilla_item: 'Light',
        }).description).toMatch(/already exists in room 1/);
    });

    it('unmark-location takes the rule with it, and refuses a name the room lacks', () => {
        const { s } = session();
        apply(s, { op: 'replace-room', room: 1, xml: wiredRoom(1, 2, { pickup: true }) });
        apply(s, {
            op: 'mark-location', room: 1, entity: { type: 'torchpickup', x: 4 * TILE, y: 3 * TILE },
            name: 'T', vanilla_item: 'Light',
        });
        apply(s, {
            op: 'set-access-rule', room: 1, target: locationRuleKey('T'),
            rule: { rule: 'Has', args: { item: 'Light', count: 1 } },
        });
        expect(s.record().overlay.rooms['1'].rules).toHaveProperty('loc:T');
        apply(s, { op: 'unmark-location', room: 1, name: 'T' });
        // ⛓ the rule went with it — a `loc:` rule left behind names a location
        //   that no longer exists and would silently do nothing
        expect(s.record().overlay.rooms['1']).toBeUndefined();
        expect(s.apply({ op: 'unmark-location', room: 1, name: 'T' }).description)
            .toMatch(/has no location named "T"/);
    });

    /**
     * ⛔ **"UNKNOWN AT DERIVE TIME" IS ASKED BY DERIVING**, and an adapter with
     * no derivation deps REFUSES rather than accepting the key unchecked — the
     * underived case refuses ([[feedback_fallback_reinstates_the_defect]]).
     */
    it('set-access-rule refuses an exit id that names nothing, and refuses when it cannot ask', () => {
        const { s } = session();
        expect(s.apply({
            op: 'set-access-rule', room: 0, target: exitRuleKey('out_teleporter_999_999'),
            rule: { rule: 'True_' },
        }).description).toMatch(/has no exit "out_teleporter_999_999"/);

        const blind = createSeedlingSetAdapter({});
        expect(blind.apply(baseRecord(), {
            op: 'set-access-rule', room: 0, target: exitRuleKey('anything'), rule: { rule: 'True_' },
        }).description).toMatch(/cannot be checked/);

        // a bare key never reaches the derivation at all
        expect(s.apply({ op: 'set-access-rule', room: 0, target: 'out_x', rule: { rule: 'True_' } })
            .description).toMatch(/carries neither "exit:" nor "loc:"/);
        // a location rule must name a location in THAT room
        expect(s.apply({ op: 'set-access-rule', room: 0, target: locationRuleKey('Nope'), rule: { rule: 'True_' } })
            .description).toMatch(/no such location is marked/);
    });

    /**
     * ⛔⛔⛔ **THE STORED-CLOSURE HAZARD, REACHED THROUGH THE ADAPTER.**
     * `seedlingSetOverlay.test.js` demonstrates that `canonicalJson` renders a
     * function as `null` and keeps the key; this is the consequence a code
     * mutation can actually produce. If an op ever put a FUNCTION into the
     * overlay, two different rules on one target would canonicalise identically,
     * `equal` would call the record unchanged, and the fold would DROP the
     * second authoring op — the edit would never reach the payload. So the row
     * is: the same target, two different rules, both APPLIED.
     */
    it('re-authoring a rule with a DIFFERENT tree is a real edit, not a no-op', () => {
        const { s } = session();
        const exit = deriveAtlasOf(s.record(), DEPS).atlas.regions
            .find((r) => r.map_ref === 0).exits[0].exit_id;
        const first = apply(s, {
            op: 'set-access-rule', room: 0, target: exitRuleKey(exit), rule: { rule: 'True_' },
        });
        expect(first.applied).toBe(true);
        const second = s.apply({
            op: 'set-access-rule', room: 0, target: exitRuleKey(exit),
            rule: { rule: 'Has', args: { item: 'Light', count: 1 } },
        });
        expect(second.ok).toBe(true);
        expect(second.applied).toBe(true);
        expect(s.ops()).toHaveLength(2);
        expect(s.record().overlay.rooms['0'].rules[exitRuleKey(exit)].rule).toBe('Has');
        // ⛔ and re-authoring the SAME tree really IS a no-op, so `applied` is
        //    discriminating rather than always true
        expect(s.apply({
            op: 'set-access-rule', room: 0, target: exitRuleKey(exit),
            rule: { rule: 'Has', args: { item: 'Light', count: 1 } },
        }).applied).toBe(false);
    });

    it('set-access-rule refuses a rule the schema rejects, and edits IN PLACE through a path', () => {
        const { s } = session();
        const exit = deriveAtlasOf(s.record(), DEPS).atlas.regions
            .find((r) => r.map_ref === 0).exits[0].exit_id;
        expect(s.apply({
            op: 'set-access-rule', room: 0, target: exitRuleKey(exit), rule: { notARule: true },
        }).description).toMatch(/not a valid Rule Builder node/);

        const tree = { rule: 'And', children: [{ rule: 'True_' }, { rule: 'True_' }] };
        apply(s, { op: 'set-access-rule', room: 0, target: exitRuleKey(exit), rule: tree });
        apply(s, {
            op: 'set-access-rule', room: 0, target: exitRuleKey(exit), path: [1],
            rule: { rule: 'Has', args: { item: 'Light', count: 1 } },
        });
        expect(s.record().overlay.rooms['0'].rules[exitRuleKey(exit)].children[1].rule).toBe('Has');
        // ⛔ a path with no tree under it refuses rather than inventing a root
        expect(s.apply({
            op: 'set-access-rule', room: 1, target: exitRuleKey(exit), path: [0], rule: { rule: 'True_' },
        }).description).toMatch(/has no rule on .* yet/);
    });

    /**
     * ⛔⛔ **`set-overlay` WRITES THE WHOLE ENTRY AND DOES NOT ASK THE
     * DERIVATION** — so it is the door a stale rule key comes in through (an
     * overlay pasted from another set, an exit that was later disconnected).
     * `applyOverlayRules` is the second net, and it REFUSES rather than
     * dropping: a rule that vanished leaves the author believing a door is
     * gated and the compiler treating it as free, and a missing `access_rule`
     * is indistinguishable from one that was never written.
     */
    it('a rule key that survives `set-overlay` is caught at DERIVE time, by name', () => {
        const { s } = session();
        apply(s, {
            op: 'set-overlay',
            room: 0,
            overlay: { rules: { [exitRuleKey('out_teleporter_999_999')]: { rule: 'True_' } } },
        });
        expect(() => deriveAtlasOf(s.record(), DEPS))
            .toThrow(/region "level_0" \(room 0\) has no exit "out_teleporter_999_999"/);
        expect(() => deriveAtlasOf(s.record(), DEPS)).toThrow(/Its exits are out_/);
    });

    /**
     * ⛓ AND A RULE ON A ROOM THE DERIVATION DROPPED is its own sentence: a room
     * with no door at all has no region, so the per-region loop never visits it
     * and a rule authored there would be discarded in silence.
     */
    it('a rule on a room with no region at all refuses, naming the drop', () => {
        const bare = setRecord(buildLevelSet(
            Array.from({ length: 3 }, (_, level) => emptyLevel({ level })), { setId: 'no-doors' },
        ).set);
        const s = createSetSession(adapter, bare, { base: { kind: 'set', set_id: bare.set.set_id } });
        apply(s, {
            op: 'set-overlay', room: 2, overlay: { rules: { [exitRuleKey('anything')]: { rule: 'True_' } } },
        });
        expect(() => deriveAtlasOf(s.record(), DEPS))
            .toThrow(/authors an exit rule on room 2, but the derived atlas holds no region for it/);
    });

    it('set-overlay refuses a shape the overlay validator rejects, and clears with null', () => {
        const { s } = session();
        expect(s.apply({ op: 'set-overlay', room: 0, overlay: { colour: 'red' } }).description)
            .toMatch(/is not a declared field/);
        apply(s, { op: 'set-overlay', room: 0, overlay: { name: 'Entrance' } });
        expect(s.record().overlay.rooms['0']).toEqual({ name: 'Entrance' });
        apply(s, { op: 'set-overlay', room: 0, overlay: null });
        expect(s.record().overlay.rooms['0']).toBeUndefined();
    });

    /**
     * ⛓ AN `embed`-SOURCED ROOM IS A DOCUMENT THE SESSION CAN HOLD AND NOT EDIT
     * — the same refusal `seedlingEditAdapter`'s `set-room` base makes one layer
     * down, and the whole committed vanilla set is such a document.
     */
    it('every op touching a room\'s OEL refuses an embed-sourced room BY NAME', () => {
        const set = generatedSet(2);
        const embedded = {
            ...set,
            rooms: set.rooms.map((r, i) => (i === 1 ? { ...r, source: { embed: 'levels/X.oel' } } : r)),
        };
        const record = setRecord(embedded);
        for (const op of [
            { op: 'connect', from: [1, 0], to: [0, 0] },
            { op: 'disconnect', room: 1, exitIndex: 0 },
            { op: 'mark-location', room: 1, entity: { type: 'chest', x: 0, y: 0 }, name: 'C', vanilla_item: 'Seal' },
        ]) {
            expect(adapter.apply(record, op).description, op.op).toMatch(/EMBED-sourced/);
        }
        expect(() => roomsOfSet(embedded, parseOelLevel)).toThrow(/EMBED-sourced/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛔⛔ `disconnect` — the OEL has NO inert door, and the four readers say so', () => {
    /**
     * ⛓⛓⛓ **THE MEASUREMENT THAT PICKED THE REPRESENTATION.** The brief asked
     * which spelling `reachabilityOf` and `deriveAtlas` both read as "no exit".
     * Both read `to=""` and an absent `to` that way — and so does
     * `validateLevelSet`, which is the trap: a live `Teleporter` is still
     * standing in the room, and `int(o.@to)` is **0** for both spellings, so the
     * set validates clean and the player is warped to room 0 by a door the
     * editor calls unwired.
     *
     * ⇒ the only representation ALL readers agree on is DELETING the element.
     */
    const setDoc = generatedSet(4, 'unwired-measure');
    const xml = setDoc.rooms[0].source.xml;
    const stamped = (next) => stampLevelSetIdentity({
        ...setDoc,
        provenance: { ...(setDoc.provenance ?? {}) },
        rooms: setDoc.rooms.map((r, i) => (i === 0 ? { ...r, source: { xml: next } } : r)),
    });

    it('an absent or empty @to is INVISIBLE to every JS reader — which is the hazard', () => {
        for (const [label, next] of [
            ['empty', xml.replace(/(<teleporter[^>]*?)to="\d+"/, '$1to=""')],
            ['absent', xml.replace(/(<teleporter[^>]*?)\s*to="\d+"/, '$1')],
        ]) {
            expect(parseRoomXml(next).exits, label).toHaveLength(0);
            const doc = stamped(next);
            expect(reachabilityOf(doc).reachable, label).toBe(1);
            // ⛔ AND IT PASSES. That is the whole finding.
            expect(validateLevelSet(doc).ok, label).toBe(true);
            // …while the element is STILL THERE, so the game still builds a Teleporter
            expect(next, label).toContain('<teleporter');
        }
    });

    it('a sentinel @to="-1" is the ONE spelling the validator catches', () => {
        const next = xml.replace(/(<teleporter[^>]*?)to="\d+"/, '$1to="-1"');
        expect(parseRoomXml(next).exits).toHaveLength(1);
        expect(validateLevelSet(stamped(next)).ok).toBe(false);
        expect(validateLevelSet(stamped(next)).errors[0]).toMatch(/@to -1 is out of range/);
    });

    it('deleting the element is the representation all four agree on', () => {
        const { xml: next, removed, seen } = removeExitFromRoomXml(xml, 0);
        expect(removed).toMatchObject({ element: 'teleporter', to: 1 });
        expect(seen.exits).toBe(1);
        expect(next).not.toContain('<teleporter');
        expect(parseRoomXml(next).exits).toHaveLength(0);
        expect(reachabilityOf(stamped(next)).reachable).toBe(1);
        expect(validateLevelSet(stamped(next)).ok).toBe(true);
        // ⛓ and the room still parses, with the line the element owned GONE
        expect(() => parseOelLevel(next)).not.toThrow();
        expect(next.split('\n')).toHaveLength(xml.split('\n').length - 1);
    });

    it('removeExitFromRoomXml addresses by ORDINAL and refuses one that is not there', () => {
        const two = wiredRoom(0, 1);
        expect(() => removeExitFromRoomXml(two, 5)).toThrow(/there is no exit 5 to unwire/);
        expect(() => removeExitFromRoomXml(two, -1)).toThrow(/non-negative integer exit ordinal/);
        // ⛔ an exit with CHILDREN refuses rather than leaving a closing tag behind
        const withChild = two.replace(/<teleporter([^>]*)\/>/, '<teleporter$1><node x="0" y="0"/></teleporter>');
        expect(() => removeExitFromRoomXml(withChild, 0)).toThrow(/with CHILDREN, not a self-closing element/);
    });

    it('the op says the door is DELETED and that the ordinals after it shift', () => {
        const { s } = session();
        expect(exitsOfRoom(s.record(), 1).map((e) => e.to)).toEqual([0, 2]);
        const res = apply(s, { op: 'disconnect', room: 1, exitIndex: 0 });
        expect(res.description).toMatch(/is DELETED \(Seedling has no inert door/);
        expect(res.description).toMatch(/shift down by one/);
        expect(exitsOfRoom(s.record(), 1).map((e) => e.to)).toEqual([2]);
        expect(s.apply({ op: 'disconnect', room: 1, exitIndex: 1 }).description)
            .toMatch(/that room has 1 exit carrying a @to/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓ `reorder` rewrites EVERY index a room reaches — exits AND fallthroughs', () => {
    const pitSet = buildLevelSet([
        { ...emptyLevel({ level: 0 }),
            entities: [...(emptyLevel({ level: 0 }).entities ?? []),
                { type: 'control', x: 0, y: 0, attrs: { fallthrough: 2, xOff: 0, yOff: 0, sign: 0 } }] },
        emptyLevel({ level: 1 }),
        emptyLevel({ level: 2 }),
    ], { setId: 'pit-reorder', link: true }).set;

    it('is ONE op and ONE undo, not a group of N retargets', () => {
        const record = setRecord(pitSet);
        const s = createSetSession(adapter, record, { base: { kind: 'set', set_id: pitSet.set_id } });
        apply(s, { op: 'reorder', order: [2, 1, 0] });
        expect(s.ops()).toHaveLength(1);
        expect(s.ops()[0]).toEqual({ op: 'reorder', order: [2, 1, 0] });
        expect(s.undo()).toBe(true);
        expect(adapter.equal(s.record(), record)).toBe(true);
    });

    /**
     * ⛔⛔ **THE FALLTHROUGH IS A SEPARATE LIST AND A SEPARATE ORDINAL SPACE.**
     * A rewrite that did the exits and forgot the pits leaves a set whose
     * `reachabilityOf` still walks the OLD destination — and the generated sets
     * every other row uses carry NO `<control fallthrough>`, so without this
     * fixture the mutant would be GREEN
     * ([[feedback_fixture_must_discriminate_two_builds]]).
     */
    it('a @fallthrough is renumbered with the exits, and reachability survives', () => {
        expect(parseRoomXml(pitSet.rooms[0].source.xml).fallthroughs).toEqual([
            { element: 'control', to: 2, sign: 0 },
        ]);
        const s = createSetSession(adapter, setRecord(pitSet), { base: { kind: 'set', set_id: pitSet.set_id } });
        apply(s, { op: 'reorder', order: [2, 1, 0] });
        const moved = s.record().set.rooms[2];        // old room 0 is now room 2
        expect(parseRoomXml(moved.source.xml).fallthroughs).toEqual([
            { element: 'control', to: 0, sign: 0 },   // old 2 is now 0
        ]);
        expect(reachabilityOf(s.record().set))
            .toMatchObject({ start: 2, reachable: 3, unreachable: [] });
    });

    it('start, menu_rooms, named_rooms, the room ids and the overlay all move together', () => {
        const withRefs = {
            ...pitSet,
            start: { level: 0, x: 80, y: 128 },
            menu_rooms: [0, 2],
            named_rooms: { watcher_text: { level: 1 } },
        };
        const record = setRecord(withRefs, {
            ...emptyOverlay(),
            rooms: { 0: { name: 'first' }, 2: { name: 'third' } },
            neverEnter: [2],
            regions: [1, 0, 3],
        });
        const s = createSetSession(adapter, record, { base: { kind: 'set', set_id: withRefs.set_id } });
        apply(s, { op: 'reorder', order: [2, 1, 0] });
        const out = s.record();
        expect(out.set.start).toEqual({ level: 2, x: 80, y: 128 });
        expect(out.set.menu_rooms).toEqual([2, 0]);
        expect(out.set.named_rooms.watcher_text).toEqual({ level: 1 });
        expect(out.set.rooms.map((r) => r.id)).toEqual([0, 1, 2]);
        expect(out.overlay.rooms).toEqual({ 2: { name: 'first' }, 0: { name: 'third' } });
        expect(out.overlay.neverEnter).toEqual([0]);
        expect(out.overlay.regions).toEqual([3, 0, 1]);
    });

    /**
     * ⛓⛓ **THE SIGN IS RECOMPUTED FROM THE TRANSITION, IN OLD COORDINATES.**
     * `sign` is a property of the TRANSITION, not of the destination
     * (`levelSetExits.js`, measured over all 292 vanilla transitions), so a
     * permuted set that kept its old signs would announce the region of the
     * room the player did NOT go to. And `overlay.regions` is still keyed by OLD
     * index while the rewrite runs — reading it by the NEW index would give
     * every room its neighbour's region.
     */
    it('a cross-region transition announces the DESTINATION\'s region after a reorder', () => {
        const record = setRecord(pitSet, {
            ...emptyOverlay(), rooms: {}, regions: [1, 1, 4],
        });
        const s = createSetSession(adapter, record, { base: { kind: 'set', set_id: pitSet.set_id } });
        // before: room 1 -> room 2 crosses region 1 -> 4, announced as 4
        apply(s, { op: 'reorder', order: [2, 1, 0] });
        // after: old room 1 is still room 1; its exit to old 2 (now room 0)
        // still crosses 1 -> 4 and must still announce 4
        const exits = parseRoomXml(s.record().set.rooms[1].source.xml).exits;
        const toZero = exits.find((e) => e.to === 0);
        expect(toZero.sign).toBe(4);
        const toTwo = exits.find((e) => e.to === 2);
        expect(toTwo.sign).toBe(0);         // 1 -> 1, same region, announce nothing
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓ `connect` — two-way by default, arriving on the return door', () => {
    /**
     * ⚠ **THE TWO ENDS MUST SIT AT DIFFERENT CELLS OR THIS ROW PROVES NOTHING.**
     * Measured: the exporter's linker puts room 5's only door and room 0's only
     * door BOTH at (128, 128), so a `connect` that landed the player on the
     * SOURCE exit instead of the destination's return door would read back
     * identical. Room 1's SECOND exit is at (128, 96) — the discriminating pair
     * ([[feedback_fixture_must_discriminate_two_builds]]).
     */
    it('writes BOTH sides, and the arrival is the destination exit\'s own cell', () => {
        const { s } = session();
        const before = exitsOfRoom(s.record(), 5)[0];
        const dest = exitsOfRoom(s.record(), 1)[1];
        expect([dest.x, dest.y]).not.toEqual([before.x, before.y]);
        apply(s, { op: 'connect', from: [5, 0], to: [1, 1] });
        const after = exitsOfRoom(s.record(), 5)[0];
        expect(after.to).toBe(1);
        expect([after.playerx, after.playery]).toEqual([dest.x, dest.y]);
        const back = exitsOfRoom(s.record(), 1)[1];
        expect(back.to).toBe(5);
        expect([back.playerx, back.playery]).toEqual([before.x, before.y]);
    });

    it('`one_way` writes ONLY the source side', () => {
        const { s } = session();
        const backBefore = exitsOfRoom(s.record(), 0)[0];
        apply(s, { op: 'connect', from: [5, 0], to: [0, 0], one_way: true });
        expect(exitsOfRoom(s.record(), 5)[0].to).toBe(0);
        expect(exitsOfRoom(s.record(), 0)[0].to).toBe(backBefore.to);
    });

    it('an explicit `arrival` overrides the latch landing, and a bad one refuses', () => {
        const { s } = session();
        apply(s, { op: 'connect', from: [5, 0], to: [0, 0], one_way: true, arrival: { x: 48, y: 64 } });
        expect(exitsOfRoom(s.record(), 5)[0]).toMatchObject({ playerx: 48, playery: 64 });
        expect(s.apply({ op: 'connect', from: [4, 0], to: [0, 0], arrival: { x: 1.5, y: 0 } }).description)
            .toMatch(/`arrival` is \{x, y\} in PIXELS/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ identity — the record is never stamped, and DOWNLOAD stamps ONCE', () => {
    const build = () => {
        const { record, s } = session();
        apply(s, { op: 'set-field', path: 'name', value: 'Five Edits' });
        apply(s, { op: 'set-room-field', room: 0, field: 'music', value: 3 });
        apply(s, { op: 'set-room-field', room: 1, field: 'music', value: 4 });
        apply(s, { op: 'set-overlay', room: 2, overlay: { name: 'Middle' } });
        apply(s, { op: 'reorder', order: [0, 1, 2, 3, 5, 4] });
        return { record, s };
    };

    /**
     * ⛔⛔ **NO OP STAMPS. THE ONE STAMP IS AT DOWNLOAD.** C2's residue: five
     * edits either produce five ids, four of which nobody ever saw, or one.
     * This is the one.
     */
    it('five ops leave the record\'s set_id and content_hash UNTOUCHED', () => {
        const { record, s } = build();
        expect(s.ops()).toHaveLength(5);
        expect(s.record().set.set_id).toBe(record.set.set_id);
        expect(s.record().set.provenance?.content_hash)
            .toBe(record.set.provenance?.content_hash);
        // ⛓ the derived atlas is not stamped either (§19.10 hard #1)
        const { atlas } = deriveAtlasOf(s.record(), DEPS);
        expect(atlas.provenance.content_hash).toBeUndefined();
        expect(atlas.atlas_id).toBe('seedling-set-test');
    });

    it('then ONE download is ONE new set_id, and the session still holds the old one', () => {
        const { record, s } = build();
        const out = downloadSet(s);
        expect(out.set.set_id).not.toBe(record.set.set_id);
        expect(out.set.set_id).toMatch(/-[0-9a-f]{8}$/);
        expect(out.set.set_id.endsWith(`-${out.set.provenance.content_hash}`)).toBe(true);
        expect(validateLevelSet(out.set).ok).toBe(true);
        expect(out.report).toMatchObject({ rooms: ROOMS, edits: 5 });
        // ⛔ THE SESSION'S RECORD IS UNCHANGED — `provenance` was COPIED, not
        //    shared, so the download did not stamp the document the caller holds
        expect(s.record().set.set_id).toBe(record.set.set_id);
        expect(s.record().set.provenance?.content_hash)
            .toBe(record.set.provenance?.content_hash);
        // downloading twice with no edits between gives the SAME id
        expect(downloadSet(s).set.set_id).toBe(out.set.set_id);
    });

    /**
     * ⛓ AND THE OTHER HALF OF C2's RESIDUE IS NOW A CHOICE THE PAGE MAKES, not
     * a law: the same five edits downloaded one at a time really do produce five
     * ids, because the id IS the content and the content differs at each step.
     */
    it('the same five edits, downloaded one at a time, are five DIFFERENT ids', () => {
        const { s } = session();
        const ids = [];
        for (const op of [
            { op: 'set-field', path: 'name', value: 'a' },
            { op: 'set-room-field', room: 0, field: 'music', value: 3 },
            { op: 'set-room-field', room: 1, field: 'music', value: 4 },
            { op: 'set-room-field', room: 2, field: 'music', value: 5 },
            { op: 'reorder', order: [0, 1, 2, 3, 5, 4] },
        ]) {
            apply(s, op);
            ids.push(downloadSet(s).set.set_id);
        }
        expect(new Set(ids).size).toBe(5);
    });

    it('the overlay is stamped by contentIdentity, and the AP companion by the SET', () => {
        const { s } = build();
        const out = downloadSet(s);
        expect(out.overlay.overlay_id).toMatch(/^overlay-[0-9a-f]{8}$/);
        expect(out.overlay.overlay_id.endsWith(`-${out.overlay.provenance.content_hash}`)).toBe(true);
        expect(out.apMapping).toMatchObject({
            set_id: out.set.set_id, content_hash: out.set.provenance.content_hash,
            status: 'invalidated', total_references: 24,
        });
    });

    /**
     * ⛓ CROSS-ROOM UNIQUENESS IS THE VALIDATOR'S, AND DOWNLOAD IS WHERE IT IS
     * ASKED. An op that refused a duplicate room name would make law 7
     * unsatisfiable (it writes a whole room descriptor to a DIFFERENT cell), and
     * two authorities for one rule is how the two come to disagree.
     */
    it('a duplicate room name passes the op and REFUSES the download, by name', () => {
        const { s } = session();
        apply(s, { op: 'set-room-field', room: 1, field: 'name', value: s.record().set.rooms[0].name });
        expect(() => downloadSet(s)).toThrow(/is not valid and is NOT downloaded/);
        expect(() => downloadSet(s)).toThrow(/duplicates rooms\[0\]/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ the ROOM session inside the SET session — C2\'s batching residue, closed', () => {
    const open = () => {
        const { record, s } = session();
        const roomAdapter = createSeedlingEditAdapter({
            parseOel: parseOelLevel, levelSetSource: setSessionRoomSource(s),
        });
        const tag = { kind: 'set-room', set_id: record.set.set_id, room: 2 };
        const roomSession = createEditSession(roomAdapter, roomAdapter.bases['set-room'](tag), { base: tag });
        return { record, s, roomSession, roomAdapter, tag };
    };

    it('N room edits become ONE set op, and the set_id does not move', () => {
        const { record, s, roomSession } = open();
        const before = s.record().set.rooms[2].source.xml;
        for (const [tx, ty] of [[2, 2], [3, 2], [4, 2]]) {
            expect(roomSession.apply({ op: 'paint', layer: 'tiles', tx, ty, terrain: 'wall' }).ok).toBe(true);
        }
        expect(roomSession.ops()).toHaveLength(3);
        expect(s.ops()).toHaveLength(0);

        const closed = closeRoomSession(s, roomSession, 2);
        expect(closed.ok).toBe(true);
        expect(closed.applied).toBe(true);
        expect(s.ops()).toHaveLength(1);
        expect(s.ops()[0].op).toBe('replace-room');
        expect(s.record().set.rooms[2].source.xml).not.toBe(before);
        expect(s.record().set.set_id).toBe(record.set.set_id);

        /**
         * ⛓⛓ UNDO IS THE FOLD'S, NOT A SNAPSHOT'S — the old OEL comes back BYTE
         * FOR BYTE because the fold never had it any other way.
         */
        expect(s.undo()).toBe(true);
        expect(s.record().set.rooms[2].source.xml).toBe(before);
        expect(adapter.equal(s.record(), record)).toBe(true);
    });

    /**
     * ⛓⛓ **THE ROOM IS OPENED AGAINST THE SESSION'S CURRENT FOLD**, which is
     * what a page wants: a room opened after a `reorder` must be the room that
     * is there NOW.
     */
    it('the room source follows the session, and CHECKS the set_id', () => {
        const { s, roomAdapter, tag } = open();
        apply(s, { op: 'replace-room', room: 2, xml: wiredRoom(2, 3, { pickup: true }) });
        const reopened = roomAdapter.bases['set-room'](tag);
        expect(reopened.entities.some((e) => e.type === 'torchpickup')).toBe(true);

        // ⛔ AND A TAG NAMING A DIFFERENT SET IS REFUSED — `setRoomBase` itself
        //    does not compare (measured; `atlasBase` does), so the injection is
        //    where the check lives.
        expect(() => roomAdapter.bases['set-room']({ ...tag, set_id: 'some-other-set' }))
            .toThrow(/no level set with set_id "some-other-set" is loaded here/);
    });

    /**
     * ⛓⛓⛓ **EDITOR v3 E1b — `closeRoomSession` NEEDS NO RENDERER ANY MORE.** It
     * was the one record → text hinge in the editor; a set carries records now,
     * so the room session's fold IS the payload and the render moved to the
     * chunk boundary. ⛔ The row asserts the op it emits carries a `record` and
     * NO `xml`, which is what makes "the render is gone" a fact rather than a
     * claim about a parameter list.
     */
    it('closeRoomSession commits the room session\'s RECORD, with no renderer', () => {
        const { s, roomSession } = open();
        expect(closeRoomSession.length).toBe(3);
        const closed = closeRoomSession(s, roomSession, 2);
        expect(closed.ok).toBe(true);
        const op = s.ops()[0];
        expect(op.op).toBe('replace-room');
        expect(op.record).toEqual(roomSession.record());
        expect(Object.hasOwn(op, 'xml')).toBe(false);
    });

    it('closeRoomSession quotes a refused write', () => {
        const { s, roomSession } = open();
        expect(() => closeRoomSession(s, roomSession, 99)).toThrow(/was REFUSED/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ THE CHAIN — a GENERATED set, edited, all the way to reachable rules', () => {
    /**
     * Extends D0b's §19.6 agreement row with OPS in between: the same
     * derive → validate → compile → `unwired_exits` vs `reachabilityOf` walk,
     * over a set that has been grown, wired, permuted and annotated.
     */
    const chain = () => {
        const { record, s } = session();
        apply(s, { op: 'add-room', xml: wiredRoom(6, 5, { pickup: true }), name: 'Seventh' });
        apply(s, { op: 'connect', from: [5, 0], to: [6, 0] });
        apply(s, { op: 'reorder', order: [0, 1, 2, 3, 6, 5, 4] });
        // old room 6 (the Seventh, holding the pickup) is now room 4
        apply(s, {
            op: 'mark-location', room: 4, entity: { type: 'torchpickup', x: 4 * TILE, y: 3 * TILE },
            name: 'Seventh Torch', vanilla_item: 'Light',
        });
        return { record, s };
    };

    it('seven rooms, every one still reachable in the SET\'s own walk', () => {
        const { s } = chain();
        expect(s.record().set.rooms).toHaveLength(7);
        expect(reachabilityOf(s.record().set))
            .toMatchObject({ reachable: 7, total: 7, unreachable: [], rooms_not_walked: 0 });
    });

    it('derives an atlas the AUTHORITATIVE validator accepts, schema and all', () => {
        const { s } = chain();
        const { atlas, stats, dropped, rulesApplied } = deriveAtlasOf(s.record(), DEPS);
        expect(dropped).toEqual([]);
        expect(rulesApplied).toBe(0);
        expect(stats).toMatchObject({ rooms: 7, regions: 7, locations: 1 });
        expect(stats.exits).toBeGreaterThan(0);
        const mapDoc = { levels: roomsOfSet(s.record().set, parseOelLevel) };
        expect(indexMapDocument(mapDoc).size).toBe(7);
        const result = validateRegionAtlas(atlas, { mapDoc, schema: ATLAS_SCHEMA });
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('compiles to a schema-valid rules.json whose unwired_exits agrees with the set walk', () => {
        const { s } = chain();
        const { rules, report, stats } = rulesJsonOf(s, DEPS, { compileRegionAtlas, gameName: 'Chain' });
        expect(rulesJsonSchemaErrors(rules, RULES_SCHEMA)).toEqual([]);
        // ⛔ NOT VACUOUS — an empty graph would also report `[]`
        expect(report).toHaveProperty('unwired_exits');
        expect(stats.exits).toBeGreaterThan(0);
        expect(report.unwired_exits).toEqual([]);
        const walk = reachabilityOf(s.record().set);
        const entered = new Set(Array.from({ length: walk.reachable }, (_, i) => regionIdFor(i)));
        expect(new Set(deriveAtlasOf(s.record(), DEPS).atlas.regions.map((r) => r.region_id)))
            .toEqual(entered);
    });

    /**
     * ⛓⛓⛓ **THE AUTHORED RULE IS LOAD-BEARING, AND THE PROOF IS THAT IT DROPS A
     * REGION.** With every edge free the structural walk reaches everything;
     * with an evaluator that refuses the authored rule's item, exactly the
     * region behind it falls out. Both pinned, because either alone is a
     * sentence rather than a check.
     */
    it('reachableRegions covers every region free, and DROPS the gated one when the item is refused', () => {
        const { s } = chain();
        // gate the only way IN to room 4 (the Seventh): room 5's exit toward it
        const derived = deriveAtlasOf(s.record(), DEPS);
        const gateRegion = derived.atlas.regions.find((r) => r.map_ref === 5);
        const gate = gateRegion.exits.find((e) => e.exit_id.startsWith('out_'));
        apply(s, {
            op: 'set-access-rule', room: 5, target: exitRuleKey(gate.exit_id),
            rule: { rule: 'Has', args: { item: 'Light', count: 1 } },
        });
        expect(deriveAtlasOf(s.record(), DEPS).rulesApplied).toBe(1);

        const { rules } = rulesJsonOf(s, DEPS, { compileRegionAtlas, gameName: 'Chain' });
        const all = Object.keys(rules.regions['1']);
        const free = reachableRegions(rules, '1');
        expect(free.size).toBe(all.length);

        const refusesLight = (rule) => !JSON.stringify(rule ?? null).includes('"Light"');
        const gated = reachableRegions(rules, '1', refusesLight);
        expect(gated.size).toBeLessThan(free.size);
        // ⛓ NAMED THROUGH THE DERIVATION'S OWN ID BUILDER, not spelled out: the
        //   Seventh room is room 4 after the reorder and `regionIdFor` is what
        //   turns that into the name the compiled graph carries.
        expect(all.filter((name) => !gated.has(name))).toEqual([regionIdFor(4)]);
    });

    it('undo ×N walks back to the base, byte for byte', () => {
        const { record, s } = chain();
        expect(s.ops()).toHaveLength(4);
        let n = 0;
        while (s.undo()) n += 1;
        expect(n).toBe(4);
        expect(adapter.equal(s.record(), record)).toBe(true);
        expect(canonicalJson(s.record().set)).toBe(canonicalJson(record.set));
        expect(canonicalJson(s.record().overlay)).toBe(canonicalJson(record.overlay));
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('§19.5\'s field census — the ONE line of adaptation, and the gate that watches it', () => {
    /**
     * ⛔⛔ **§19.10 HARD #4, MADE INTO A CHECK.** *"The one-line adaptation is
     * one line only while the two shapes agree… there is no gate today that
     * would catch a NEW divergence."* This is that gate: the map extract's
     * levels and a parsed set room are compared FIELD BY FIELD, and the
     * difference is asserted to be exactly the three D0b measured.
     */
    it('a parsed set room differs from a map-extract level by exactly {level, class, path}', async () => {
        const { default: mapDoc } = await import('../flashPanel/atlases/seedling-map.json',
            { assert: { type: 'json' } });
        const universal = (docs) => {
            const all = new Set(docs.flatMap((d) => Object.keys(d)));
            return [...all].filter((k) => docs.every((d) => Object.hasOwn(d, k))).sort();
        };
        const parsedRooms = generatedSet().rooms.map((r) => parseOelLevel(r.source.xml));
        const extractKeys = new Set(mapDoc.levels.flatMap((lv) => Object.keys(lv)));
        const parsedKeys = new Set(parsedRooms.flatMap((d) => Object.keys(d)));

        /**
         * ⚠ **UNIVERSAL KEYS, AND MEASURING IT CAUGHT A SLOPPY FIRST SPELLING.**
         * A union-of-keys comparison reported `tiles_outside_level` as
         * extract-only — which it is not: §19.5 measured it present on 51 of the
         * 116 extract levels and emitted by `parseOelLevel` when the count is
         * greater than zero, and the generated rooms simply have none. It is a
         * CONDITIONAL field in BOTH shapes, so the census asks about the keys
         * every document of a shape carries.
         */
        expect(universal(mapDoc.levels).filter((k) => !universal(parsedRooms).includes(k)))
            .toEqual(['class', 'level', 'path']);
        /**
         * ⛔⛔ **AND THE SAME CENSUS THROUGH `roomsOfSet`, WHICH IS THE ONE PLACE
         * THE ADAPTATION LIVES.** Measured: a census that only ever called
         * `parseOelLevel` did not gate the adapter at all — a `roomsOfSet` that
         * stamped an extra field, or the wrong `level`, passed it untouched. So
         * the claim is made about what the DERIVATION is handed: after the one
         * line, the only extract fields still missing are the two provenance
         * ones nothing here reads.
         */
        const adapted = roomsOfSet(generatedSet(), parseOelLevel);
        expect(universal(mapDoc.levels).filter((k) => !universal(adapted).includes(k)))
            .toEqual(['class', 'path']);
        expect(universal(adapted).filter((k) => !universal(mapDoc.levels).includes(k)))
            .toEqual([]);
        // ⛔ THE DIRECTION THAT MATTERS MOST: a parser that grew a field the
        //    extract lacks would break "one derivation serves both sources"
        //    just as surely, and nothing else in the repo would notice.
        expect([...parsedKeys].filter((k) => !extractKeys.has(k)).sort()).toEqual([]);
        // and the conditional field really is conditional on the extract side
        const withOutside = mapDoc.levels.filter((lv) => Object.hasOwn(lv, 'tiles_outside_level'));
        expect(withOutside.length).toBeGreaterThan(0);
        expect(withOutside.length).toBeLessThan(mapDoc.levels.length);
        expect(mapDoc.levels.length).toBe(116);
    });

    it('`roomsOfSet` is the ONE place `level: i` is stamped, and it refuses without a parser', () => {
        const set = generatedSet(3);
        const rooms = roomsOfSet(set, parseOelLevel);
        expect(rooms.map((r) => r.level)).toEqual([0, 1, 2]);
        for (const key of ['width', 'height', 'layers', 'entities']) {
            expect(rooms[0]).toHaveProperty(key);
        }
        expect(() => roomsOfSet(set, null)).toThrow(/needs a `parseOel`/);
        expect(() => roomsOfSet(set, null)).toThrow(/scripts → frontend, every time/);
    });
});

/* ══════════════════════════════════════════════════════════════════ */

describe('the `set` base resolves both halves, or refuses BY NAME', () => {
    const set = generatedSet(3, 'base-resolution');
    const overlay = { ...emptyOverlay(), overlay_id: 'ov-1', rooms: { 1: { name: 'middle' } } };

    it('resolves a set with no overlay named, and an empty overlay is the default', () => {
        const withSource = createSeedlingSetAdapter({ levelSetSource: (id) => (id === set.set_id ? set : null) });
        const record = withSource.bases.set({ kind: 'set', set_id: set.set_id });
        expect(record.set).toBe(set);
        expect(record.overlay).toEqual(emptyOverlay());
        expect(Object.isFrozen(record)).toBe(true);
    });

    it('resolves a named overlay, and refuses to fall back to an empty one', () => {
        const both = createSeedlingSetAdapter({
            levelSetSource: () => set,
            overlaySource: (id) => (id === 'ov-1' ? overlay : null),
        });
        expect(both.bases.set({ kind: 'set', set_id: set.set_id, overlay_id: 'ov-1' }).overlay)
            .toBe(overlay);
        expect(() => both.bases.set({ kind: 'set', set_id: set.set_id, overlay_id: 'nope' }))
            .toThrow(/no overlay with overlay_id "nope"/);
        // ⛔ NO SILENT EMPTY: a session missing every location and every rule is
        //    indistinguishable from a set nobody had annotated
        const noOverlaySource = createSeedlingSetAdapter({ levelSetSource: () => set });
        expect(() => noOverlaySource.bases.set({ kind: 'set', set_id: set.set_id, overlay_id: 'ov-1' }))
            .toThrow(/no `overlaySource` was injected/);
    });

    it('refuses a missing source, an unknown set and a malformed tag', () => {
        expect(() => createSeedlingSetAdapter({}).bases.set({ kind: 'set', set_id: 'x' }))
            .toThrow(/needs a `levelSetSource`/);
        expect(() => createSeedlingSetAdapter({ levelSetSource: () => null })
            .bases.set({ kind: 'set', set_id: 'x' })).toThrow(/no level set with set_id "x"/);
        expect(() => createSeedlingSetAdapter({ levelSetSource: () => set }).bases.set({ kind: 'set' }))
            .toThrow(/a `set` base is \{kind:'set', set_id, overlay_id\?\}/);
    });

    it('refuses an overlay whose shape is wrong, before a single op runs', () => {
        const bad = createSeedlingSetAdapter({
            levelSetSource: () => set, overlaySource: () => ({ ...emptyOverlay(), rooms: { 9: {} } }),
        });
        expect(() => bad.bases.set({ kind: 'set', set_id: set.set_id, overlay_id: 'x' }))
            .toThrow(/room 9 does not exist \(the set has 3\)/);
    });
});

describe('"what links here" and the room exit list — what D2\'s DOM will read', () => {
    it('names every transition INTO a room, exits and fallthroughs alike', () => {
        const record = baseRecord();
        expect(whatLinksHere(record, 3)).toEqual({
            links: [
                { from: 2, kind: 'exit', index: 1, element: 'teleporter' },
                { from: 4, kind: 'exit', index: 0, element: 'teleporter' },
            ],
            unreadable: [],
        });
        const pit = setRecord(buildLevelSet([
            { ...emptyLevel({ level: 0 }),
                entities: [...(emptyLevel({ level: 0 }).entities ?? []),
                    { type: 'control', x: 0, y: 0, attrs: { fallthrough: 1, xOff: 0, yOff: 0, sign: 0 } }] },
            emptyLevel({ level: 1 }),
        ], { setId: 'links-pit', link: true }).set);
        expect(whatLinksHere(pit, 1).links).toContainEqual(
            { from: 0, kind: 'fallthrough', index: 0, element: 'control' },
        );
    });

    /**
     * ⛔ AN `embed`-SOURCED ROOM IS NAMED, NOT SKIPPED. A readout that reported
     * "nothing links here" over a set holding one would be a floor presented as
     * a fact — the same reason `reachabilityOf` carries `rooms_not_walked`.
     */
    it('names the rooms whose links it could NOT read', () => {
        const set = generatedSet(3);
        const record = setRecord({
            ...set,
            rooms: set.rooms.map((r, i) => (i === 2 ? { ...r, source: { embed: 'levels/X.oel' } } : r)),
        });
        const out = whatLinksHere(record, 1);
        expect(out.unreadable).toEqual([2]);
        expect(out.links.map((l) => l.from)).toEqual([0]);
    });

    it('the exit list carries the ordinal `connect` and `disconnect` address by', () => {
        const record = baseRecord();
        expect(exitsOfRoom(record, 2)).toEqual([
            expect.objectContaining({ index: 0, to: 1 }),
            expect.objectContaining({ index: 1, to: 3 }),
        ]);
    });
});

/* ══════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ **EDITOR v3 E1b — THE ADAPTER READS AND WRITES RECORDS, AND NEVER
 * CONVERTS A KIND** (plan §22.8; as-built §24)
 * ══════════════════════════════════════════════════════════════════ */

/** The same generated set, carried as RECORDS. ⛔ Re-stamped: the content moved. */
const recordSet = (n = ROOMS, setId = 'set-adapter-record') => {
    const xmlSet = generatedSet(n, setId);
    return stampLevelSetIdentity({
        ...xmlSet,
        rooms: xmlSet.rooms.map((r) => ({
            ...r, source: { record: parseOelLevel(r.source.xml, r.name) },
        })),
    }, { base: setId });
};

/** A set where room 0 is legacy `xml` and every other room is a `record`. */
const mixedSet = (n = ROOMS) => {
    const rec = recordSet(n, 'set-adapter-mixed');
    return stampLevelSetIdentity({
        ...rec,
        rooms: rec.rooms.map((r, i) => (i !== 0 ? r
            : { ...r, source: { xml: recordToOel(r.source.record) } })),
    }, { base: 'set-adapter-mixed' });
};

const kindsOf = (set) => set.rooms.map((r) => (typeof r.source.record === 'object' ? 'record'
    : (typeof r.source.xml === 'string' ? 'xml' : 'embed')));

/**
 * ⚠ AN EDITED SET IS RE-STAMPED BEFORE IT IS VALIDATED, and that is the
 * download path's own order. `validateLevelSet` refuses a document whose
 * `content_hash` no longer matches — which is precisely §4.2's point — so
 * asking it about a mid-session fold would be asking it about the stamp rather
 * than about the edit.
 */
const validAfterEdit = (set) => validateLevelSet(
    stampLevelSetIdentity(set, { base: 'e1b-edited' }),
);

describe('EDITOR v3 E1b — a RECORD set drives every op the xml set does', () => {
    const recSession = (n = ROOMS) => {
        const record = setRecord(recordSet(n));
        return {
            record,
            s: createSetSession(adapter, record, { base: { kind: 'set', set_id: record.set.set_id } }),
        };
    };

    it('validates, and every room is `record`', () => {
        const set = recordSet();
        expect(validateLevelSet(set).ok).toBe(true);
        expect(kindsOf(set)).toEqual(Array(ROOMS).fill('record'));
    });

    it('assertAdapterBehaviour passes on a record set', () => {
        const record = setRecord(recordSet());
        expect(assertAdapterBehaviour(adapter, {
            record,
            op: { op: 'set-room-field', room: 0, field: 'music', value: 5 },
            refused: { op: 'set-room-field', room: 99, field: 'music', value: 5 },
            cell: { x: 0, y: 0 },
            other: { x: ROOMS - 1, y: 0 },
        })).toBe(true);
    });

    it('connect / disconnect / reorder / remove-room over records', () => {
        const { s } = recSession();
        // CONNECT — writes both ends on records
        expect(apply(s, { op: 'connect', from: [0, 0], to: [2, 0] }).applied).toBe(true);
        expect(exitsOfRoom(s.record(), 0)[0].to).toBe(2);
        expect(exitsOfRoom(s.record(), 2)[0].to).toBe(0);
        // DISCONNECT — §20.5: the door is DELETED
        const before = exitsOfRoom(s.record(), 0).length;
        expect(apply(s, { op: 'disconnect', room: 0, exitIndex: 0 }).description)
            .toMatch(/is DELETED \(Seedling has no inert/);
        expect(exitsOfRoom(s.record(), 0)).toHaveLength(before - 1);
        // REORDER — every `@to` rewritten, on records
        const order = [...Array(ROOMS).keys()].reverse();
        expect(apply(s, { op: 'reorder', order }).applied).toBe(true);
        expect(validAfterEdit(s.record().set).ok).toBe(true);
        expect(kindsOf(s.record().set)).toEqual(Array(ROOMS).fill('record'));
    });

    it('add-room takes a RECORD, and the room it makes is `record`-sourced', () => {
        const { s } = recSession();
        expect(apply(s, { op: 'add-room', record: emptyLevel({ level: 9 }), name: 'New' })
            .description).toMatch(/add room 6 "New" as `record`/);
        expect(kindsOf(s.record().set)[6]).toBe('record');
        expect(validAfterEdit(s.record().set).errors).toEqual([]);
    });

    it('mark-location finds an entity in a RECORD room, with no parse and no regex', () => {
        const { s } = recSession();
        const withPickup = parseOelLevel(wiredRoom(1, 2, { pickup: true }), 'probe');
        apply(s, { op: 'replace-room', room: 1, record: withPickup });
        expect(s.apply({
            op: 'mark-location', room: 1, entity: { type: 'torchpickup', x: 0, y: 0 },
            name: 'T', vanilla_item: 'Light',
        }).description).toMatch(/room 1 holds no <torchpickup> at \(0, 0\)/);
        expect(apply(s, {
            op: 'mark-location', room: 1, entity: { type: 'torchpickup', x: 4 * TILE, y: 3 * TILE },
            name: 'T', vanilla_item: 'Light',
        }).applied).toBe(true);
    });

    it('whatLinksHere and exitsOfRoom read records', () => {
        const record = setRecord(recordSet());
        const links = whatLinksHere(record, 1);
        expect(links.unreadable).toEqual([]);
        expect(links.links.length).toBeGreaterThan(0);
        // the same answer the xml twin gives
        const xmlRecord = baseRecord();
        expect(whatLinksHere(xmlRecord, 1).links).toEqual(links.links);
    });

    /**
     * ⛔⛔ **THE PIN: AN EDIT NEVER CONVERTS A KIND.** The document's form is the
     * AUTHOR's. A retarget that quietly turned a legacy `xml` room into a record
     * would rewrite a document nobody asked to change and move the set's content
     * hash for a reason no reader could name — which is the whole reason §22.8's
     * ruling is ADDITIVE.
     */
    it('a MIXED set edits each room IN ITS OWN KIND, and reorder keeps both', () => {
        const record = setRecord(mixedSet());
        expect(kindsOf(record.set)).toEqual(['xml', ...Array(ROOMS - 1).fill('record')]);
        const s = createSetSession(adapter, record,
            { base: { kind: 'set', set_id: record.set.set_id } });
        // a reorder rewrites EVERY room's exits
        apply(s, { op: 'reorder', order: [...Array(ROOMS).keys()].reverse() });
        expect(kindsOf(s.record().set))
            .toEqual([...Array(ROOMS - 1).fill('record'), 'xml']);
        expect(validAfterEdit(s.record().set).errors).toEqual([]);
        // …and a connect touching the xml room leaves it xml
        apply(s, { op: 'connect', from: [ROOMS - 1, 0], to: [0, 0] });
        expect(kindsOf(s.record().set)[ROOMS - 1]).toBe('xml');
        expect(kindsOf(s.record().set)[0]).toBe('record');
    });

    it('a COPY between kinds carries the source, so a paste does not convert either', () => {
        const mixed = setRecord(mixedSet());
        const fromXml = adapter.readCell(mixed, 0, 0);
        const fromRecord = adapter.readCell(mixed, 1, 0);
        expect(Object.keys(fromXml.room.source)).toEqual(['xml']);
        expect(Object.keys(fromRecord.room.source)).toEqual(['record']);
        // pasting the RECORD room onto the xml room makes that cell a record —
        // the author replaced the document, which is the one conversion there is
        const s = createSetSession(adapter, mixed,
            { base: { kind: 'set', set_id: mixed.set.set_id } });
        for (const op of adapter.writeOps(fromRecord, 0, 0)) apply(s, op);
        expect(kindsOf(s.record().set)[0]).toBe('record');
        expect(canonicalJson(adapter.readCell(s.record(), 0, 0)))
            .toBe(canonicalJson(fromRecord));
    });

    it('replace-room describes ENTITIES and TILES, not bytes, for a record', () => {
        const { s } = recSession();
        const rec = parseOelLevel(wiredRoom(1, 2, { pickup: true }), 'probe');
        expect(s.apply({ op: 'replace-room', room: 1, record: rec }).description)
            .toMatch(/`record`, \d+ entities, \d+x\d+ tiles, 1 exit/);
        // …and BYTES for a legacy xml payload, because that one really has some
        expect(s.apply({ op: 'replace-room', room: 1, xml: wiredRoom(1, 2) }).description)
            .toMatch(/`xml`, \d+ bytes, \d+x\d+ tiles, 1 exit/);
    });

    it('every op touching a room refuses an EMBED room BY NAME, as before', () => {
        const set = recordSet();
        const withEmbed = {
            ...set,
            rooms: set.rooms.map((r, i) => (i !== 1 ? r : { ...r, source: { embed: 'levels/X.oel' } })),
        };
        const record = setRecord(stampLevelSetIdentity(withEmbed, { base: 'embed-probe' }));
        for (const op of [
            { op: 'connect', from: [1, 0], to: [2, 0] },
            { op: 'disconnect', room: 1, exitIndex: 0 },
            { op: 'mark-location', room: 1, entity: { type: 'x', x: 0, y: 0 }, name: 'n', vanilla_item: 'i' },
        ]) {
            expect(adapter.apply(record, op).description, op.op)
                .toMatch(/EMBED-sourced \(levels\/X\.oel\)/);
        }
        expect(whatLinksHere(record, 2).unreadable).toEqual([1]);
    });
});
