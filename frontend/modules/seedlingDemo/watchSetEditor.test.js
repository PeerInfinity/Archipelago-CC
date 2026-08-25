/**
 * seedlingDemo/watchSetEditor — **THE SET EDITOR'S PURE HALF, AS DATA.**
 *
 * EDITOR v3 slice D2 (`NewDocs/plans/seedling-editor-v3.md` §16.4, §21). The
 * mount itself needs a DOM and this repo's vitest is `environment: 'node'`, so
 * the split is `watchEditor.test.js`': the rows below drive everything that is a
 * FUNCTION OF THE RECORD — the rooms list, the reorder permutation, the
 * renumbering ruling, the arrow shapes, the two forms, the rule targets and the
 * whole REPORT — and `check-seedling-editor-arm.mjs` drives the mount with a
 * real mouse.
 *
 * ⛔ **EVERY SET HERE WAS GENERATED**, `buildLevelSet({link: true})` over
 * `emptyLevel` rooms, exactly as D1's rows are: a document written to make a
 * row pass is a row that measures nothing.
 *
 * ⛓ EDITOR v3 E1 ADDS THE OTHER KIND — the last describe block runs the same
 * functions over the REAL 116 (`vanillaRecordSet` of the committed map extract and
 * the committed manifest), which is data nobody wrote for this file and the only
 * place its numbers can be measured rather than chosen.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { assertShape } from '../procgenCore/editorView.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import {
    NAMED_ROOMS, MUSIC_COUNT, MUSIC_NONE, stampLevelSetIdentity,
} from './levelSetValidator.js';
import { buildLevelSet, vanillaRecordSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel, recordToOel } from './procgenLevelOel.js';
import { emptyOverlay, exitRuleKey, locationRuleKey } from './seedlingSetOverlay.js';
import {
    createSeedlingSetAdapter, createSetSession, setRecord,
} from './seedlingSetAdapter.js';
import {
    LINK_SCAN, OVERVIEW, addRoomMapping, exitArrowShapes, freeEdgesOf, inertRulesOf,
    linkScanBound, linkScanCost, linkScanKb, manifestFormRows, moveOrder, overlayLocationCount,
    overviewLayout, removeRoomMapping, renumberDecision, reorderMapping, reportOf, roomCentre,
    roomFormRows, roomRowsOf, ruleTargetKeys, ruleTargetsOf,
} from './watchSetEditor.js';

const TILE = 16;
const ROOMS = 6;
const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: { game: 'watch-set-editor-test', mapDocument: 'watch-set-editor-test.json' },
});
const ATLAS_SCHEMA = loadAtlasSchema();
const adapter = createSeedlingSetAdapter(DEPS);

const generatedSet = (n = ROOMS, setId = 'watch-set-editor-test') => buildLevelSet(
    Array.from({ length: n }, (_, level) => emptyLevel({ level })), { setId, link: true },
).set;

const sessionOf = (n = ROOMS, overlay = emptyOverlay()) => {
    const record = setRecord(generatedSet(n), overlay);
    return createSetSession(adapter, record, { base: { kind: 'set', set_id: record.set.set_id } });
};

const apply = (s, op) => {
    const res = s.apply(op);
    if (!res.ok) throw new Error(res.description);
    return res;
};

/** An `embed`-sourced room, the one thing a set can HOLD and not EDIT. */
const withEmbedRoom = (set, index) => ({
    ...set,
    rooms: set.rooms.map((r, i) => (i === index
        ? { ...r, source: { embed: 'levels/Test.oel' } } : r)),
});

/* ══════════════════════════════════════════════════════════════════════
 * THE LINK-SCAN BOUND
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ EDITOR v3 E1b — `buildLevelSet` writes `source: {record}`, so a row about
 * OEL BYTES has to render one on purpose. This is the LEGACY `xml` kind, which
 * the format still accepts and the bound still prices in KB.
 */
const asXmlSet = (set) => stampLevelSetIdentity({
    ...set,
    provenance: { ...(set.provenance ?? {}) },
    rooms: set.rooms.map((r) => ({ ...r, source: { xml: recordToOel(r.source.record) } })),
}, 'rendered');

describe('⛓⛓ the whole-set link scan is BOUNDED, and the bound is SAID', () => {
    it('⛓ the scan size of an `xml` set is n × the set — n rooms, each parsing the whole document', () => {
        const record = setRecord(asXmlSet(generatedSet(4)));
        const bytes = record.set.rooms.reduce((a, r) => a + r.source.xml.length, 0);
        expect(linkScanKb(record)).toBeCloseTo((4 * bytes) / 1024, 6);
    });

    it('⛓ a small generated set fits the budget and the column is computed', () => {
        const b = linkScanBound(setRecord(generatedSet(ROOMS)));
        expect(b.ok).toBe(true);
        expect(b.why).toBe(null);
        expect(roomRowsOf(setRecord(generatedSet(ROOMS)))[0].linkedFrom).not.toBe(null);
    });

    /**
     * ⛓⛓ MUTANT: the bound is on the ROOM COUNT instead of the bytes. A
     * count is a proxy — the widest committed room is 107× the smallest — and
     * the row below is a set the count would wave through and the bytes stop.
     */
    it('⛔⛔ a set whose BYTES blow the budget is bounded, and the sentence NAMES the column '
        + 'it stopped computing rather than leaving it blank', () => {
        const set = asXmlSet(generatedSet(2));
        const fat = 'x'.repeat(Math.ceil(
            (LINK_SCAN.budgetMs / LINK_SCAN.msPerKb) * 1024,
        ));
        const record = setRecord({
            ...set,
            rooms: set.rooms.map((r) => ({ ...r, source: { xml: `${r.source.xml}<!--${fat}-->` } })),
        });
        const b = linkScanBound(record);
        expect(b.ok).toBe(false);
        expect(b.why).toMatch(/links here/);
        expect(b.why).toMatch(/Bounded and said, not skipped/);
        // ⛓ …and the ARROWS are unaffected — they are ONE pass, not n of them.
        expect(b.why).toMatch(/ARROWS are UNAFFECTED/);
        expect(roomRowsOf(record, { links: false })[0].linkedFrom).toBe(null);
    });

    /* ══ EDITOR v3 E1b — THE RECORD HALF, PRICED IN ENTITIES ══════════════ */

    /** The same generated set, carried as RECORDS. */
    // ⛓ EDITOR v3 E1b — the exporter WRITES records, so this IS `generatedSet`.
    const recordSet = (n = ROOMS, setId = 'watch-set-editor-record') => generatedSet(n, setId);

    it('⛓⛓ a RECORD set is priced in ENTITIES, not bytes — its KB are ZERO', () => {
        const record = setRecord(recordSet(4));
        const entities = record.set.rooms.reduce((a, r) => a + r.source.record.entities.length, 0);
        const cost = linkScanCost(record);
        expect(cost.kb).toBe(0);
        expect(cost.entities).toBe(4 * entities);
        expect(cost.ms).toBeCloseTo(4 * entities * LINK_SCAN.msPerEntity, 9);
    });

    it('⛓ a MIXED set sums both halves, and an EMBED room costs nothing', () => {
        const rec = recordSet(4);
        const mixed = setRecord({
            ...rec,
            rooms: rec.rooms.map((r, i) => {
                if (i === 0) return { ...r, source: { xml: recordToOel(r.source.record) } };
                if (i === 1) return { ...r, source: { embed: 'levels/Test.oel' } };
                return r;
            }),
        });
        const cost = linkScanCost(mixed);
        expect(cost.kb).toBeCloseTo(
            (4 * recordToOel(rec.rooms[0].source.record).length) / 1024, 6,
        );
        const rest = rec.rooms.slice(2).reduce((a, r) => a + r.source.record.entities.length, 0);
        expect(cost.entities).toBe(4 * rest);
        expect(cost.ms).toBeCloseTo(
            cost.kb * LINK_SCAN.msPerKb + cost.entities * LINK_SCAN.msPerEntity, 9,
        );
    });

    /**
     * ⛔⛔ **THE RE-PRICING DID NOT DELETE THE BOUND, AND THAT IS THE FINDING.**
     * A record room parses nothing, so the whole column got ~47× cheaper — but
     * it is still O(n²) room visits, and at the size of the real vanilla set it
     * is still over a quarter-second. What moved is WHERE the bound bites:
     * ~89 rooms on records against ~21 on text.
     */
    it('⛓⛓ the bound still BITES on a vanilla-sized record set, and lets a small one through',
        () => {
            const entitiesPerRoom = 2461 / 116;      // the measured vanilla mean
            const at = (n) => n * n * entitiesPerRoom * LINK_SCAN.msPerEntity;
            expect(at(116)).toBeGreaterThan(LINK_SCAN.budgetMs);
            expect(at(21)).toBeLessThan(LINK_SCAN.budgetMs);
            // and the text price at the same sizes, for the comparison
            const kbPerRoom = 1332 / 116;
            const textAt = (n) => n * n * kbPerRoom * LINK_SCAN.msPerKb;
            expect(textAt(116) / at(116)).toBeGreaterThan(10);
            expect(textAt(30)).toBeGreaterThan(LINK_SCAN.budgetMs);
            expect(at(30)).toBeLessThan(LINK_SCAN.budgetMs);
            // a real small record set is computed
            const small = setRecord(recordSet(ROOMS));
            expect(linkScanBound(small).ok).toBe(true);
            expect(roomRowsOf(small)[0].linkedFrom).not.toBe(null);
        });

    it('⛓ the bounded sentence NAMES the quantity it priced, per kind', () => {
        const rec = recordSet(2);
        const fatRoom = {
            ...rec.rooms[0].source.record,
            entities: Array.from(
                { length: Math.ceil(LINK_SCAN.budgetMs / LINK_SCAN.msPerEntity) },
                () => ({ type: 'torchpickup', x: 0, y: 0, attrs: {} }),
            ),
        };
        const record = setRecord({
            ...rec, rooms: rec.rooms.map((r, i) => (i === 0 ? { ...r, source: { record: fatRoom } } : r)),
        });
        const b = linkScanBound(record);
        expect(b.ok).toBe(false);
        expect(b.why).toMatch(/record entities \(every room, once per room\)/);
        expect(b.why).not.toMatch(/KB of OEL text/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ROOMS LIST
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ the rooms list is a VIEW of the record', () => {
    it('⛓ one row per room, in `bounds().w` order, carrying what `readSetCell` carries', () => {
        const record = setRecord(generatedSet(ROOMS));
        const rows = roomRowsOf(record);
        expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(rows.length).toBe(adapter.bounds(record).w);
        for (const row of rows) {
            expect(row.name).toBe(record.set.rooms[row.index].name);
            expect(row.music).toBe(record.set.rooms[row.index].music);
        }
    });

    it('⛓⛓ the exits and the "links here" count agree with the adapter\'s own readers — the '
        + 'linker wired the set, so both are non-zero and this row is not vacuous', () => {
        const rows = roomRowsOf(setRecord(generatedSet(ROOMS)));
        expect(rows.reduce((n, r) => n + r.exits, 0)).toBeGreaterThan(0);
        expect(rows.reduce((n, r) => n + r.linkedFrom, 0))
            .toBe(rows.reduce((n, r) => n + r.exits, 0));
    });

    /**
     * ⛓⛓⛓ MUTANT: an unreadable room is DROPPED from the list (a `continue`
     * instead of a `why`). The reader would then see a five-room list for a
     * six-room set and no sentence saying a room is missing — ⚖ the
     * graceful-skip trap, which `whatLinksHere` was fixed for in D1.
     */
    it('⛔⛔ an `embed`-sourced room is NAMED, not dropped: it keeps its row, its `exits` is '
        + '`null` and its `why` is the adapter\'s own refusal, verbatim', () => {
        const record = setRecord(withEmbedRoom(generatedSet(ROOMS), 2));
        const rows = roomRowsOf(record, { links: false });
        expect(rows.length).toBe(ROOMS);
        expect(rows[2].openable).toBe(false);
        expect(rows[2].exits).toBe(null);
        expect(rows[2].why).toMatch(/EMBED-sourced/);
        expect(rows[1].openable).toBe(true);
    });

    it('⛓ the overlay\'s locations and rules are counted per room', () => {
        const s = sessionOf(ROOMS);
        apply(s, {
            op: 'set-overlay',
            room: 1,
            overlay: { locations: [{ entity: { type: 'x', x: 0, y: 0 }, name: 'L', vanilla_item: 'i' }] },
        });
        expect(roomRowsOf(s.record(), { links: false })[1].locations).toBe(1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * MOVING A ROOM, AND WHAT IT DOES TO AN OPEN ROOM SESSION
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ MOVE is ONE `reorder`, and its `order` is pinned in BOTH readings', () => {
    it('⛓⛓⛓ `order` is the NEW array in OLD indices — `rooms_new[i] = rooms_old[order[i]]`, '
        + 'measured through the op rather than asserted about the array', () => {
        const s = sessionOf(4);
        const before = s.record().set.rooms.map((r) => r.name);
        const order = moveOrder(4, 1, 1); // move room 1 DOWN
        expect(order).toEqual([0, 2, 1, 3]);
        apply(s, { op: 'reorder', order });
        expect(s.record().set.rooms.map((r) => r.name))
            .toEqual(order.map((old) => before[old]));
    });

    it('⛓ ONE op, not two retargets that compose — a reader can count the edits in a payload '
        + 'only if a move IS one', () => {
        const s = sessionOf(4);
        apply(s, { op: 'reorder', order: moveOrder(4, 0, 1) });
        expect(s.ops().length).toBe(1);
    });

    it('⛔ the ends refuse BY NAME rather than clamping — a press that did nothing and said '
        + 'nothing is indistinguishable from a broken button', () => {
        expect(() => moveOrder(4, 0, -1)).toThrow(/already first/);
        expect(() => moveOrder(4, 3, 1)).toThrow(/already last/);
        expect(() => moveOrder(4, 9, 1)).toThrow(/outside 0\.\.3/);
    });
});

describe('⛓⛓⛓ §20.11 #2 — a RENUMBERING closes or DISCARDS an open room session', () => {
    /**
     * ⛓⛓⛓ MUTANT: the decision is `none` for every renumbering (the room
     * session is left open). It would not be visible until the WRITE-BACK, and
     * then a `replace-room-xml` would land on a room the reader never opened.
     */
    it('⛔⛔ a room session WITH edits is DISCARDED, loudly, naming how many went', () => {
        const d = renumberDecision({ room: 1, ops: 3 }, reorderMapping([0, 2, 1, 3]), 'MOVE DOWN');
        expect(d.action).toBe('discard');
        expect(d.warning).toMatch(/DISCARDED/);
        expect(d.warning).toMatch(/3 unwritten edit\(s\)/);
    });

    it('⛓ a room session with ZERO ops is silently REOPENED on the room\'s new index', () => {
        const d = renumberDecision({ room: 1, ops: 0 }, reorderMapping([0, 2, 1, 3]), 'MOVE DOWN');
        expect(d).toMatchObject({ action: 'reopen', room: 2 });
        expect(d.warning).toMatch(/moved to index 2/);
    });

    it('⛓ …and one whose index did NOT move is reopened with nothing to say', () => {
        const d = renumberDecision({ room: 3, ops: 0 }, reorderMapping([0, 2, 1, 3]), 'MOVE');
        expect(d).toEqual({ action: 'reopen', room: 3, warning: null });
    });

    it('⛓ no open session is `none`', () => {
        expect(renumberDecision(null, reorderMapping([0, 1]), 'MOVE').action).toBe('none');
    });

    it('⛓⛓ the ONE decision function serves all THREE renumbering ops, and each mapping is '
        + 'measured against what the op really did', () => {
        // add-room at the end shifts nothing; at 0 it shifts everything.
        expect(addRoomMapping(0)(0)).toBe(1);
        expect(addRoomMapping(4)(0)).toBe(0);
        // remove-room DELETES its own room and pulls the rest down.
        expect(removeRoomMapping(1)(1)).toBe(null);
        expect(removeRoomMapping(1)(2)).toBe(1);
        expect(renumberDecision({ room: 1, ops: 0 }, removeRoomMapping(1), 'REMOVE').action)
            .toBe('discard');
    });

    it('⛓⛓ the ADD mapping matches the op — a set-session `add-room` at 0 really does move '
        + 'every old room up by one', () => {
        const s = sessionOf(3);
        const before = s.record().set.rooms.map((r) => r.name);
        apply(s, { op: 'add-room', xml: recordToOel(emptyLevel({ level: 0 })), at: 0, name: 'new' });
        const after = s.record().set.rooms.map((r) => r.name);
        for (let old = 0; old < before.length; old += 1) {
            expect(after[addRoomMapping(0)(old)]).toBe(before[old]);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE OVERVIEW
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the overview is the ADAPTER\'s grid — one row, one cell per room', () => {
    it('⛓ it shrinks to fit and then SCROLLS, never below a clickable cell', () => {
        expect(overviewLayout(4, 4000).cellPx).toBe(OVERVIEW.cellPx);
        expect(overviewLayout(200, 600).cellPx).toBe(OVERVIEW.minCellPx);
        expect(overviewLayout(200, 600).scrolls).toBe(true);
        expect(overviewLayout(4, 4000).scrolls).toBe(false);
    });

    it('⛓ a cell too small for a still says so, and the strip draws labelled boxes instead', () => {
        expect(overviewLayout(200, 600).stills).toBe(false);
        expect(overviewLayout(4, 4000).stills).toBe(true);
    });

    it('⛓ a room\'s centre is in CELL space — room 3 is at x 3.5, which is what the painter '
        + 'multiplies by the cell width', () => {
        expect(roomCentre(3).x).toBe(3.5);
        expect(roomCentre(3).y).toBeGreaterThan(OVERVIEW.roomTop);
        expect(roomCentre(3).y).toBeLessThan(1);
    });
});

describe('⛓⛓⛓ the exits, as POLYLINES the view can actually paint', () => {
    const shapesOf = (record, opts) => exitArrowShapes(roomRowsOf(record, { links: false }), opts);

    it('⛓ every shape it produces is one `editorView.assertShape` accepts — the two files '
        + 'agree by measurement and not by comment', () => {
        const shapes = shapesOf(setRecord(generatedSet(ROOMS)));
        expect(shapes.length).toBeGreaterThan(0);
        for (const s of shapes) expect(() => assertShape(s)).not.toThrow();
    });

    /**
     * ⛓⛓⛓ MUTANT: a two-way link is drawn as TWO one-headed lines. The reader
     * then cannot tell two separate ONE-WAY doors from one two-way door — which
     * is the single distinction `connect {one_way}` exists to make.
     */
    it('⛔⛔ a TWO-WAY link is ONE line with TWO heads, not two lines', () => {
        const s = sessionOf(4);
        apply(s, { op: 'connect', from: [0, 0], to: [2, 0] });
        const between = shapesOf(s.record())
            .filter((sh) => sh.label === 'L0 ↔ L2' || sh.label === 'L2 ↔ L0');
        expect(between.length).toBe(1);
        expect(between[0].arrow).toBe(true);
        expect(between[0].arrowBack).toBe(true);
    });

    it('⛓ a ONE-WAY link keeps a single head, and the label says which way it goes', () => {
        const s = sessionOf(4);
        apply(s, { op: 'connect', from: [0, 0], to: [3, 0], one_way: true });
        const one = shapesOf(s.record()).find((sh) => sh.label === 'L0 → L3');
        expect(one).toBeTruthy();
        expect(one.arrowBack).toBe(false);
    });

    it('⛓⛓ the SELECTED room\'s "what links here" is HIGHLIGHTED, and nothing else is', () => {
        const s = sessionOf(4);
        apply(s, { op: 'connect', from: [0, 0], to: [3, 0], one_way: true });
        const lit = shapesOf(s.record(), { selected: 3 }).filter((sh) => sh.highlight);
        expect(lit.map((sh) => sh.label)).toContain('L0 → L3');
        expect(shapesOf(s.record(), { selected: null }).some((sh) => sh.highlight)).toBe(false);
    });

    it('⛔ a link to a room the set does not have is DROPPED from the picture rather than '
        + 'drawn off the end of the strip — the REPORT is where a dangling target is named', () => {
        const rows = [{ index: 0, exitList: [{ index: 0, to: 99 }] }];
        expect(exitArrowShapes(rows)).toEqual([]);
    });

    it('⛓ a SELF-JOIN is a LOOP with real length — `assertShape` refuses a one-point '
        + 'polyline, so a zero-length line would have refused at mount', () => {
        const rows = [
            { index: 0, exitList: [{ index: 0, to: 0 }] },
            { index: 1, exitList: [] },
        ];
        const [loop] = exitArrowShapes(rows);
        expect(loop.points.length).toBeGreaterThan(2);
        expect(() => assertShape(loop)).not.toThrow();
        expect(loop.label).toMatch(/↺/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE FORMS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the forms are DERIVED — from the op vocabulary and from the authorities', () => {
    it('⛓ the manifest form has exactly one row per `SET_FIELDS` entry, in that order — a '
        + 'field added to the op vocabulary appears here by EXISTING', async () => {
        const { SET_FIELDS } = await import('./seedlingSetAdapter.js');
        expect(manifestFormRows(null).map((r) => r.field)).toEqual([...SET_FIELDS]);
    });

    /**
     * ⛓⛓⛓ MUTANT: `named_rooms`' keys are typed here (or read off the JSON
     * schema's `properties`). The schema itself says the requiredness is
     * DERIVED FROM THE ROOM DATA and names `levelSetValidator.js` as the
     * authority; a second list would drift on the first slice that adds a
     * code-site reference.
     */
    it('⛔⛔ `named_rooms` is read off `levelSetValidator.NAMED_ROOMS` — the CLOSED six, each '
        + 'with whether it carries an arrival POSITION and the `Game.as` site it comes from', () => {
        const row = manifestFormRows(null).find((r) => r.field === 'named_rooms');
        expect(row.keys.map((k) => k.key)).toEqual(Object.keys(NAMED_ROOMS));
        for (const k of row.keys) {
            expect(k.position).toBe(Boolean(NAMED_ROOMS[k.key].position));
            expect(k.cite).toBe(NAMED_ROOMS[k.key].cite);
        }
        // ⛓ …and the two kinds really do differ, so the flag is not a constant.
        expect(new Set(row.keys.map((k) => k.position)).size).toBe(2);
    });

    it('⛓ `menu_rooms` carries the schema\'s own `minItems`, when a schema is handed in', () => {
        const schema = { properties: { menu_rooms: { minItems: 1, description: 'd' } } };
        expect(manifestFormRows(schema).find((r) => r.field === 'menu_rooms').minItems).toBe(1);
    });

    it('⛓⛓ the room form\'s `music` range is `Music.songs`\' own — the SAME constants the op '
        + 'refuses against, so the form and the refusal cannot disagree', async () => {
        const { ROOM_FIELDS } = await import('./seedlingSetAdapter.js');
        const rows = roomFormRows();
        expect(rows.map((r) => r.field)).toEqual([...ROOM_FIELDS]);
        const music = rows.find((r) => r.field === 'music');
        expect(music.min).toBe(MUSIC_NONE);
        expect(music.max).toBe(MUSIC_COUNT - 1);
        // ⛓ and the op agrees, asked directly.
        const s = sessionOf(2);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'music', value: music.max }).ok)
            .toBe(true);
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'music', value: music.max + 1 }).ok)
            .toBe(false);
    });

    it('⛓ the two optional flags are CHECKBOXES, because the schema declares them as presence '
        + 'booleans', () => {
        for (const f of ['music_override_exempt', 'snow_gradient']) {
            expect(roomFormRows().find((r) => r.field === f).control).toBe('checkbox');
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * RULE AUTHORING
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ the rule targets — DERIVED once per selection (§20.11 #4)', () => {
    it('⛓⛓ the exit targets are the DERIVATION\'s own exit ids for THAT room, and the op '
        + 'accepts every one of them', () => {
        const s = sessionOf(ROOMS);
        const targets = ruleTargetsOf(s.record(), 1, DEPS);
        expect(targets.exits.length).toBeGreaterThan(0);
        expect(targets.why).toBe(null);
        for (const e of targets.exits) {
            const probe = sessionOf(ROOMS);
            expect(probe.apply({
                op: 'set-access-rule', room: 1, target: exitRuleKey(e.id), rule: { rule: 'True_' },
            }).ok).toBe(true);
        }
    });

    /**
     * ⛓⛓⛓⛓ **THE DEFECT THIS SLICE'S OWN ROWS FOUND.** `set-access-rule`
     * ACCEPTS a rule on an `in_*` arrival exit and the compiler builds NO AP
     * exit for it — measured at `regionAtlasCompiler.js:341`, where the `to`
     * endpoint of a `one_way` connection is recorded `{apExitName: null,
     * arrivalOnly: true}` — so the rule reaches nothing and the door stays
     * FREE. ⛓ MUTANT: `gates` is `true` for every target; the list stops
     * marking them and the REPORT stops naming them.
     */
    it('⛔⛔⛔ an ARRIVAL-side exit is MARKED as gating nothing — the op accepts a rule on it '
        + 'and the compiled rules never see it', () => {
        const s = sessionOf(ROOMS);
        const targets = ruleTargetsOf(s.record(), 1, DEPS);
        const inert = targets.exits.filter((e) => !e.gates);
        const gating = targets.exits.filter((e) => e.gates);
        expect(inert.length).toBeGreaterThan(0);
        expect(gating.length).toBeGreaterThan(0);
        expect(inert.every((e) => e.id.startsWith('in_'))).toBe(true);
        expect(inert[0].why).toMatch(/ARRIVAL side of a ONE-WAY connection/);

        // ⛓ …and the claim is MEASURED against the compiler, not asserted about
        //   a naming convention: a rule on the inert one moves no free edge.
        const before = freeEdgesOf(reportOf(sessionOf(ROOMS), DEPS, reportArgs).rules).length;
        apply(s, {
            op: 'set-access-rule',
            room: 1,
            target: exitRuleKey(inert[0].id),
            rule: { rule: 'Has', args: { item: 'Sword' } },
        });
        expect(freeEdgesOf(reportOf(s, DEPS, reportArgs).rules).length).toBe(before);
        expect(inertRulesOf(s.record(), reportOf(s, DEPS, reportArgs).atlas))
            .toEqual([{ room: 1, exitId: inert[0].id, why: inert[0].why }]);
    });

    /**
     * ⛓⛓ MUTANT: the targets are read for the WRONG room (`map_ref` ignored).
     * The author would then hang a rule on another room's door and the
     * derivation would refuse it — a refusal at COMMIT for a list the page
     * offered.
     */
    it('⛔ …and an exit id of a DIFFERENT room is refused by the op, which is what makes the '
        + 'per-room list a real filter', () => {
        const s = sessionOf(ROOMS);
        const other = ruleTargetsOf(s.record(), 2, DEPS).exits[0].id;
        const mine = ruleTargetsOf(s.record(), 1, DEPS).exits.map((e) => e.id);
        expect(mine).not.toContain(other);
        expect(s.apply({
            op: 'set-access-rule', room: 1, target: exitRuleKey(other), rule: { rule: 'True_' },
        }).ok).toBe(false);
    });

    it('⛓ the LOCATION targets come from the OVERLAY and cost no derivation — they are the '
        + '`mark-location` op\'s own names', () => {
        const s = sessionOf(ROOMS);
        const overlay = {
            ...emptyOverlay(),
            rooms: { 0: { locations: [{ entity: { type: 't', x: 0, y: 0 }, name: 'Chest A', vanilla_item: 'i' }] } },
        };
        const record = setRecord(s.record().set, overlay);
        expect(ruleTargetsOf(record, 0, DEPS).locations).toEqual(['Chest A']);
        expect(ruleTargetKeys(ruleTargetsOf(record, 0, DEPS)))
            .toContain(locationRuleKey('Chest A'));
    });

    it('⛔ a record whose atlas will not derive says WHY rather than offering an empty list', () => {
        const record = setRecord(withEmbedRoom(generatedSet(ROOMS), 2));
        const t = ruleTargetsOf(record, 0, DEPS);
        expect(t.exits).toEqual([]);
        expect(t.why).toMatch(/EMBED-sourced/);
    });

    it('⛓ every target key carries its PREFIX, so an exit and a location can share a name', () => {
        const record = setRecord(generatedSet(2), {
            ...emptyOverlay(),
            rooms: { 0: { locations: [{ entity: { type: 't', x: 0, y: 0 }, name: 'out_teleporter_32_48', vanilla_item: 'i' }] } },
        });
        const keys = ruleTargetKeys(ruleTargetsOf(record, 0, DEPS));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.filter((k) => k.startsWith('loc:')).length).toBe(1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE REPORT
 * ══════════════════════════════════════════════════════════════════════ */

const reportArgs = {
    compileRegionAtlas, validateRegionAtlas, atlasSchema: ATLAS_SCHEMA,
};
const kinds = (rep, kind) => rep.rows.filter((r) => r.kind === kind);

describe('⛓⛓⛓ the REPORT is a LIST, and the rules.json download rides on it', () => {
    it('⛓ a linked generated set: every section reports, and the graph closes', () => {
        const rep = reportOf(sessionOf(ROOMS), DEPS, reportArgs);
        expect(rep.rows.length).toBeGreaterThan(0);
        for (const kind of ['level-set', 'region-atlas', 'unwired', 'free', 'reach', 'locations']) {
            expect(kinds(rep, kind).length, kind).toBeGreaterThan(0);
        }
        expect(kinds(rep, 'reach').every((r) => r.severity === 'ok')).toBe(true);
        expect(rep.download.rules.allowed).toBe(true);
        expect(rep.download.rules.why).toBe(null);
    });

    /**
     * ⛓⛓⛓ MUTANT: the refusal is dropped and the export is always allowed.
     * A rules.json whose graph does not close is a world nobody can finish, and
     * the seed that found out would be the report.
     */
    /**
     * ⛓⛓⛓ MUTANT: the refusal is dropped and the export is always allowed.
     * A rules.json whose graph does not close is a world nobody can finish, and
     * the seed that found out would be the report.
     *
     * ⛔ **THE ISLAND IS TWO ROOMS, AND THAT IS A MEASUREMENT.** A single cut-off
     * room is not unreachable — the derivation DROPS a region with no door at
     * all (`seedlingAtlasDerivation.js:405-418`: *"no link in the whole map
     * reaches it and it holds nothing"*), so it never reaches the compiled
     * rules and `reachableRegions` has nothing to miss. Rooms 4 and 5 keep each
     * other's doors, so both survive the derivation and BOTH are unreachable —
     * which is the shape a person actually produces by disconnecting a chain.
     */
    it('⛔⛔ AN UNREACHABLE GRAPH REFUSES THE rules.json EXPORT **BY NAME** — and reconnecting '
        + 'un-refuses it, so the row measures the condition and not a constant', () => {
        const s = sessionOf(ROOMS);
        expect(reportOf(s, DEPS, reportArgs).download.rules.allowed).toBe(true);

        /** ⛓ CUT every transition that crosses the 3|4 boundary, both ways. */
        const cut = () => {
            for (let room = 0; room < ROOMS; room += 1) {
                for (;;) {
                    const rows = roomRowsOf(s.record(), { links: false });
                    const bad = rows[room].exitList.find(
                        (e) => (room <= 3) !== (e.to <= 3),
                    );
                    if (!bad) break;
                    apply(s, { op: 'disconnect', room, exitIndex: bad.index });
                }
            }
        };
        cut();
        const rep = reportOf(s, DEPS, reportArgs);
        const unreachable = kinds(rep, 'reach').filter((r) => r.severity === 'error');
        expect(unreachable.length).toBe(2);
        expect(unreachable[0].text).toMatch(/UNREACHABLE/);
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/REFUSED BEFORE EXPORT/);
        // ⛓ …and every unreachable region is NAMED in the refusal.
        for (const row of unreachable) {
            expect(rep.download.rules.why).toContain(row.text.match(/"([^"]+)"/)[1]);
        }

        /** ⛓ …and a `connect` back across the cut re-opens the export. */
        const gate = roomRowsOf(s.record(), { links: false });
        apply(s, {
            op: 'connect',
            from: [3, gate[3].exitList[0].index],
            to: [4, gate[4].exitList[0].index],
            one_way: true,
        });
        const healed = reportOf(s, DEPS, reportArgs);
        expect(kinds(healed, 'reach').filter((r) => r.severity === 'error')).toEqual([]);
        expect(healed.download.rules.allowed).toBe(true);
    });

    it('⛓⛓ every FREE edge is NAMED — a free AP exit is a logic obligation, and the count '
        + 'agrees with the compiled rules asked directly', () => {
        const rep = reportOf(sessionOf(ROOMS), DEPS, reportArgs);
        expect(freeEdgesOf(rep.rules).length).toBe(kinds(rep, 'free')
            .filter((r) => r.severity === 'warn').length);
    });

    it('⛓⛓ …and AUTHORING a rule takes that edge OFF the free list — the row that proves the '
        + 'REPORT reads the compiled rules and not the atlas', () => {
        const s = sessionOf(ROOMS);
        const before = freeEdgesOf(reportOf(s, DEPS, reportArgs).rules).length;
        const target = ruleTargetsOf(s.record(), 1, DEPS).exits.find((e) => e.gates);
        expect(target).toBeTruthy();
        apply(s, {
            op: 'set-access-rule',
            room: 1,
            target: exitRuleKey(target.id),
            rule: { rule: 'Has', args: { item: 'Sword' } },
        });
        expect(freeEdgesOf(reportOf(s, DEPS, reportArgs).rules).length).toBe(before - 1);
    });

    /**
     * ⛓⛓⛓ MUTANT: the overlay is dropped on the way in (an `emptyOverlay()`
     * fallback where the document should have been). §20.11 #3 — the location
     * count is *"the only thing that would say so"*.
     */
    it('⛔⛔ the OVERLAY\'s location count is reported against the COMPILED one — §20.11 #3\'s '
        + 'tell that an overlay did not travel with its set', () => {
        const s = sessionOf(ROOMS);
        const room = s.record().set.rooms[0];
        const entity = room.source.record.entities[0];
        expect(entity).toBeTruthy();
        apply(s, {
            op: 'mark-location',
            room: 0,
            entity: { type: entity.type, x: entity.x, y: entity.y },
            name: 'The First Chest',
            vanilla_item: 'Progressive Sword',
        });
        expect(overlayLocationCount(s.record())).toBe(1);
        const rep = reportOf(s, DEPS, reportArgs);
        const row = kinds(rep, 'locations')[0];
        expect(row.text).toMatch(/1 location\(s\) in the OVERLAY, 1 compiled/);
        expect(row.severity).toBe('ok');

        // …and the same set WITHOUT its overlay disagrees, which is the tell.
        const bare = createSetSession(adapter, setRecord(s.record().set), {
            base: { kind: 'set', set_id: s.record().set.set_id },
        });
        expect(kinds(reportOf(bare, DEPS, reportArgs), 'locations')[0].text)
            .toMatch(/0 location\(s\) in the OVERLAY/);
    });

    it('⛓ every unwired exit is named BY ROOM AND ORDINAL — a silent omission reads as a '
        + 'fully-bound map', () => {
        const rep = reportOf(sessionOf(ROOMS), DEPS, reportArgs);
        const unwired = kinds(rep, 'unwired');
        expect(unwired.length).toBe(1);
        expect(unwired[0].severity).toBe('ok');
        expect(rep.report.unwired_exits).toEqual([]);
    });

    it('⛔ a set that cannot DERIVE refuses the export and says which stage failed, rather '
        + 'than throwing out of the report', () => {
        const record = setRecord(withEmbedRoom(generatedSet(ROOMS), 2));
        const s = createSetSession(adapter, record, {
            base: { kind: 'set', set_id: record.set.set_id },
        });
        const rep = reportOf(s, DEPS, reportArgs);
        expect(kinds(rep, 'derive').some((r) => r.severity === 'error')).toBe(true);
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.rules).toBe(null);
    });

    it('⛓ the atlas STRUCTURAL pass runs when a schema is injected, and SAYS SO when it is '
        + 'not — a true sentence about the wrong subject is the failure this avoids', () => {
        const withSchema = reportOf(sessionOf(ROOMS), DEPS, reportArgs);
        const without = reportOf(sessionOf(ROOMS), DEPS,
            { compileRegionAtlas, validateRegionAtlas });
        expect(kinds(withSchema, 'region-atlas')[0].text).toMatch(/schema included/);
        expect(kinds(without, 'region-atlas')[0].text).toMatch(/no schema was injected/);
        /**
         * ⛓⛓ AND THE SUMMARY ROW IS ALWAYS THERE — this atlas WARNS (it is
         * deliberately unstamped), so a summary printed only on a clean atlas
         * would have gone quiet about the schema exactly here.
         */
        expect(kinds(withSchema, 'region-atlas').some((r) => r.severity === 'warn')).toBe(true);
        expect(kinds(withSchema, 'region-atlas').some(
            (r) => /DELIBERATELY UNSTAMPED/.test(r.text))).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛔ THE MODULE REACHES FOR NO RENDERER OF ITS OWN
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ the set editor draws no substrate — the ONE-RENDERER law, as a scan', () => {
    it('⛓ it imports no renderer, no world builder and no pipeline module: the page injects '
        + '`drawRoomStill`, `compileRegionAtlas` and `validateRegionAtlas`', async () => {
        const { readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const src = readFileSync(
            fileURLToPath(new URL('./watchSetEditor.js', import.meta.url)), 'utf8');
        const specs = [...src.matchAll(/^\s*import[^'"]*from\s*['"]([^'"]+)['"]/gm)]
            .map((m) => m[1]);
        expect(specs.length).toBeGreaterThan(0);
        for (const spec of specs) {
            expect(/procgenPipeline\/|levelWorld|watchViewer/.test(spec), spec).toBe(false);
        }
        // ⛓ the scan is not vacuous
        expect(/procgenPipeline\//.test('../procgenPipeline/regionAtlasCompiler.js')).toBe(true);
        expect(specs).toContain('./seedlingSetAdapter.js');
    });
});

/**
 * ── EDITOR v3 E1 — **THE SAME PURE HALF, OVER THE REAL 116** ─────────────────
 *
 * Every row above drives a GENERATED set, because until E1 there was no way to
 * put the vanilla rooms in front of this file: all 116 committed rooms are
 * `embed`-sourced and the set editor cannot read one. `vanillaRecordSet` makes the
 * same 116 an `xml` set out of two committed documents, so the rows below are
 * the FIRST measurements of this code over data nobody wrote for it.
 *
 * ⛓ They are MEASUREMENTS, and each number is here because it is the number a
 * reader would otherwise guess: what the link-scan bound does at 116 rooms,
 * what the overview draws at 116 cells, how many edges a vanilla set with NO
 * overlay leaves FREE, and whether the rules.json export is offered at all.
 */
describe('the VANILLA 116, through the set editor\'s pure half', () => {
    const vanillaSession = () => {
        const { set } = vanillaRecordSet(
            JSON.parse(readFileSync(fileURLToPath(
                new URL('./fixtures/seedling-vanilla-set.json', import.meta.url)), 'utf8')),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')),
        );
        const record = setRecord(set, emptyOverlay());
        return createSetSession(adapter, record, { base: { kind: 'set', set_id: set.set_id } });
    };

    /**
     * ⛔ §21.4's BOUND, RE-PRICED FOR E1b AND MEASURED ON THE CORPUS IT WAS
     * SIZED FOR. `whatLinksHere` READS the whole set, so asking it per room is
     * n × the set — and the QUANTITY changed with the kind. E1 measured 116 ×
     * 1,332 KB = 154,528 KB of TEXT, estimated 7,726 ms at 0.05 ms/KB and
     * actually ~19 s. A record room parses NOTHING: the same corpus is 116 ×
     * 2,461 = 285,476 ENTITY visits, ≈ 428 ms at the measured ceiling of
     * 0.0015 ms/entity, and 365 ms in fact — **~47× cheaper and STILL over the
     * 250 ms budget**, so the verdict is unchanged and only the size of the
     * refused work moved. The bound now bites at about 89 rooms instead of 21.
     *
     * ⛓ The remaining cost is STRUCTURAL: `roomRowsOf` asks once per room and
     * each answer is a full pass, so the column is O(n²) over a graph ONE pass
     * could bucket (3.5 ms at n=116, measured). That is `whatLinksHere`'s
     * contract and therefore E3's; §24 names it with the number.
     */
    it('BOUNDS the links column at 116 rooms, and the rows still list every exit', () => {
        const session = vanillaSession();
        const scan = linkScanBound(session.record());
        expect(scan.ok).toBe(false);
        // ⛓ ZERO KB of text — the whole set is records now — and the price is
        //   the entity visits instead.
        expect(scan.kb).toBe(0);
        expect(scan.entities).toBe(116 * 2461);
        expect(scan.ms).toBeGreaterThan(LINK_SCAN.budgetMs);
        expect(scan.why).toMatch(/reads `\(bounded\)`/);
        expect(scan.why).toMatch(/record entities/);
        expect(scan.why).toMatch(/ARROWS are UNAFFECTED/);

        const rows = roomRowsOf(session.record(), { links: scan.ok });
        expect(rows).toHaveLength(116);
        // ⛓ `null`, NOT `0` — "not computed" and "nothing links here" are
        // different facts and the column prints different things for them.
        expect(rows.every((r) => r.linkedFrom === null)).toBe(true);
        // ⛔ AND EVERY ROOM IS OPENABLE, which is the whole point of the arm:
        // the committed vanilla set's 116 rooms are all refused by name.
        expect(rows.every((r) => r.openable)).toBe(true);
        expect(rows.filter((r) => r.exits > 0).length).toBeGreaterThan(100);
        // The ARROWS come from each room's own exit list — ONE pass — so they
        // are computed at 116 rooms even though the column is not.
        expect(exitArrowShapes(rows, overviewLayout(rows.length, 1200)).length)
            .toBeGreaterThan(100);
    }, 60000);

    /** At 116 cells the strip is below `minStillPx`, so a cell is a LABELLED BOX. */
    it('draws the overview as boxes rather than stills at 116 cells', () => {
        const lay = overviewLayout(116, 1200);
        expect(lay.rooms).toBe(116);
        expect(lay.stills).toBe(false);
        expect(lay.cellPx).toBeLessThan(OVERVIEW.minStillPx);
        expect(lay.scrolls).toBe(true);
    });

    /**
     * ⛔⛔ **VANILLA OPENS WITH AN EMPTY OVERLAY, AND THE REPORT SAYS SO IN
     * NUMBERS** (plan §22.2 bound 1). The playthrough generator's "vanilla
     * overlay" is CODE — the analyzer pass, the lava-trap pulls, the hand
     * rulings — not a `{rooms: {i: {locations, rules}}}` document, so a set
     * editor opening vanilla has NOTHING authored: every compiled edge is
     * `True_`, and the count below is that fact as a number.
     *
     * ⚠ AND THE EXPORT IS **REFUSED**, which nobody predicted: region
     * `level_58` is UNREACHABLE from the start under any rule set, because the
     * only way into it in the real game is a mechanism the derivation cannot
     * see (`reachabilityOf`'s own docblock names them: a boss that warps you, a
     * debug key, `named_rooms`). The D2 refusal is doing exactly its job on real
     * data — and it is the first evidence for what a vanilla overlay AS A
     * DOCUMENT would have to carry.
     */
    it('reports every edge FREE and REFUSES the rules export, naming the region', () => {
        const session = vanillaSession();
        const rep = reportOf(session, DEPS,
            { compileRegionAtlas, validateRegionAtlas, atlasSchema: ATLAS_SCHEMA });

        // ⛓ DERIVED FROM THE COMPILED RULES, never typed: a hardcoded 319 would
        // pass over a one-room set too, and that is the mutant.
        const free = freeEdgesOf(rep.rules);
        expect(rep.rows.filter((r) => r.kind === 'free')).toHaveLength(free.length);
        expect(free.length).toBe(319);
        expect(overlayLocationCount(session.record())).toBe(0);

        const reach = rep.rows.filter((r) => r.kind === 'reach');
        expect(reach).toHaveLength(1);
        expect(reach[0].severity).toBe('error');
        expect(reach[0].text).toMatch(/region "level_58" is UNREACHABLE/);
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/level_58/);

        // The summary row is present whatever the verdict (§21.8), and the
        // derived atlas is the 116 minus the one region nothing reaches.
        const summary = rep.rows.find((r) => r.kind === 'region-atlas');
        expect(summary.text).toMatch(/115 region\(s\)/);
        expect(rep.rows.filter((r) => r.kind === 'derive')[0].text)
            .toMatch(/region "level_81" was DROPPED/);
    }, 120000);
});
