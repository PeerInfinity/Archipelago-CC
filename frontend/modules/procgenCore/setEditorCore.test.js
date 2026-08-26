/**
 * procgenCore/setEditorCore — **THE SET EDITOR'S PURE HALF, ASKED WITHOUT A
 * SUBSTRATE AT ALL.**
 *
 * EDITOR v3 slice E2a. Until this slice every one of these functions was
 * exercised through `seedlingDemo/watchSetEditor.test.js` — over a Seedling
 * level set, a Seedling derivation and a Seedling compile. That proved they
 * WORK; it could not prove they are substrate-free, because the only caller
 * was the substrate they came from ([[feedback_fixture_must_discriminate_two_builds]]).
 *
 * ⛔⛔ **SO THE DISCRIMINATING ROWS HERE DRIVE A SUBSTRATE THAT DOES NOT
 * EXIST.** `FAKE` below is twelve lines of adapter-shaped functions over a
 * document with no rooms, no OEL, no tiles and no library — and `roomRowsOf`,
 * `reportOver`, `inertRulesOf` and `ruleTargetsOver` all answer it. A version of
 * this file that only re-asked Seedling's questions would go green against a
 * `setEditorCore.js` that still imported `seedlingSetAdapter.js`, which is the
 * one thing this slice exists to make impossible.
 *
 * ⛓ The rows that MOVED here from `watchSetEditor.test.js` (the renumbering
 * ruling, the overview layout) are verbatim: a moved function whose rows were
 * rewritten on the way is a moved function nobody checked.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { describe, expect, it } from 'vitest';

import { assertShape } from './editorView.js';
import {
    OVERVIEW, SetEditorCoreError, addRoomMapping, exitArrowShapes, freeEdgesOf, gateabilityOf,
    inertRulesOf, moveOrder, overlayLocationCount, overviewLayout, removeRoomMapping,
    renumberDecision, reorderMapping, reportOver, roomCentre, roomRowsOf, ruleTargetKeys,
    ruleTargetsOver,
} from './setEditorCore.js';

/* ══════════════════════════════════════════════════════════════════════
 * A SUBSTRATE THAT IS NOT SEEDLING AND IS NOT THE MAZE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE FAKE DOCUMENT.** `{cells: [{name, exits: [to…]}], overlay}` — a
 * positionally addressed list of rooms and an overlay keyed by index, which is
 * the ONLY shape the core is entitled to know. ⛔ It carries no `set`, no
 * `library` and no `rooms` key, so a core function that reached for one of
 * those names goes red here and nowhere else.
 */
const fakeRecord = (cells, overlay = { rooms: {} }) => ({ cells, overlay });

const FAKE = Object.freeze({
    bounds: (record) => ({ w: record.cells.length, h: 1 }),
    readSetCell: (record, x, y) => {
        if (y !== 0) throw new Error('fake: one row');
        return { room: { name: record.cells[x].name, music: null }, overlay: record.overlay.rooms[String(x)] ?? null };
    },
    exitsOfRoom: (record, room) => {
        const cell = record.cells[room];
        if (cell.unreadable) {
            const e = new Error(`fake: room ${room} is unreadable`);
            e.name = 'FakeRefusal';
            throw e;
        }
        return cell.exits.map((to, index) => ({ index, to }));
    },
    whatLinksHere: (record, room) => ({
        links: record.cells.flatMap((c, from) => (c.unreadable ? []
            : c.exits.filter((to) => to === room).map(() => ({ from })))),
        unreadable: record.cells.flatMap((c, from) => (c.unreadable ? [from] : [])),
    }),
    isRefusal: (e) => e?.name === 'FakeRefusal',
});

const readers = (extra = {}) => ({ ...FAKE, ...extra });

/** ⛓ The rule-target key BUILDERS, in a spelling that is NOT Seedling's. */
const FAKE_KEYS = Object.freeze({
    exit: (id) => `door/${id}`,
    location: (name) => `prize/${name}`,
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ROOMS LIST
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the rooms list is a VIEW of any adapter\'s record', () => {
    const RECORD = fakeRecord(
        [
            { name: 'a', exits: [1, 2] },
            { name: 'b', exits: [0] },
            { name: 'c', exits: [] },
        ],
        { rooms: { 1: { locations: [{ name: 'chest' }], rules: { 'door/x': {} } } } },
    );

    it('⛓ one row per room in `bounds().w` order, carrying what `readSetCell` carries', () => {
        const rows = roomRowsOf(RECORD, readers());
        expect(rows.map((r) => r.index)).toEqual([0, 1, 2]);
        expect(rows.map((r) => r.name)).toEqual(['a', 'b', 'c']);
        expect(rows.map((r) => r.exits)).toEqual([2, 1, 0]);
        expect(rows[0].exitList.map((e) => e.to)).toEqual([1, 2]);
    });

    /**
     * ⛓⛓⛓ MUTANT: the row count comes from `record.set.rooms.length`. It would
     * be green over Seedling for ever and `undefined.length` here — which is
     * the whole reason this file drives a document with no `set` key.
     */
    it('⛔ the COUNT is the injected `bounds`, not a key this module names', () => {
        expect(roomRowsOf(RECORD, readers()).length).toBe(FAKE.bounds(RECORD).w);
        expect(RECORD.set).toBeUndefined();
    });

    it('⛓⛓ the "links here" column is the injected scan, and `links: false` leaves it NULL '
        + 'rather than 0 — a blank column and an empty one are different findings', () => {
        const on = roomRowsOf(RECORD, readers());
        expect(on.map((r) => r.linkedFrom)).toEqual([1, 1, 1]);
        const off = roomRowsOf(RECORD, readers({ links: false }));
        expect(off.map((r) => r.linkedFrom)).toEqual([null, null, null]);
        expect(off.map((r) => r.unreadable)).toEqual([null, null, null]);
    });

    it('⛔⛔ a room the adapter cannot read keeps its row and carries the refusal VERBATIM', () => {
        const rec = fakeRecord([{ name: 'a', exits: [] }, { name: 'b', unreadable: true, exits: [] }]);
        const rows = roomRowsOf(rec, readers());
        expect(rows).toHaveLength(2);
        expect(rows[1]).toMatchObject({ openable: false, exits: null });
        expect(rows[1].why).toBe('fake: room 1 is unreadable');
        expect(rows[1].exitList).toEqual([]);
    });

    /**
     * ⛔⛔ MUTANT: `roomRowsOf` catches every error rather than asking
     * `isRefusal`. A `TypeError` in an adapter would then be reported as "this
     * room declined to open" and the defect would live in a table cell.
     */
    it('⛔ an error the substrate does NOT call a refusal is re-thrown, not printed', () => {
        const rec = fakeRecord([{ name: 'a', exits: [] }]);
        expect(() => roomRowsOf(rec, readers({
            exitsOfRoom: () => { throw new TypeError('a defect, not a refusal'); },
        }))).toThrow(TypeError);
    });

    it('⛓ the overlay\'s locations and rules are counted per room', () => {
        const rows = roomRowsOf(RECORD, readers());
        expect(rows.map((r) => r.locations)).toEqual([0, 1, 0]);
        expect(rows.map((r) => r.rules)).toEqual([0, 1, 0]);
    });

    it('⛔ every reader is REQUIRED and the refusal names the one that is missing', () => {
        for (const missing of ['readSetCell', 'exitsOfRoom', 'whatLinksHere', 'bounds', 'isRefusal']) {
            const deps = readers();
            delete deps[missing];
            expect(() => roomRowsOf(RECORD, deps), missing)
                .toThrow(new RegExp(`\`${missing}\` injected`));
        }
        expect(() => roomRowsOf(RECORD, readers({ bounds: undefined })))
            .toThrow(SetEditorCoreError);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * MOVING A ROOM, AND WHAT IT DOES TO AN OPEN ROOM SESSION
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ MOVE is ONE `reorder`, and its `order` is pinned in BOTH readings', () => {
    it('⛓⛓⛓ `order` is the NEW array in OLD indices — `rooms_new[i] = rooms_old[order[i]]`', () => {
        expect(moveOrder(4, 1, 1)).toEqual([0, 2, 1, 3]);
        expect(moveOrder(4, 2, -1)).toEqual([0, 2, 1, 3]);
        // …and the reading, spelled out over a list.
        const before = ['a', 'b', 'c', 'd'];
        const order = moveOrder(4, 1, 1);
        expect(order.map((old) => before[old])).toEqual(['a', 'c', 'b', 'd']);
    });

    it('⛔ the ends refuse BY NAME rather than clamping — a press that did nothing and said '
        + 'nothing is indistinguishable from a broken button', () => {
        expect(() => moveOrder(4, 0, -1)).toThrow(/already first/);
        expect(() => moveOrder(4, 3, 1)).toThrow(/already last/);
        expect(() => moveOrder(4, 9, 1)).toThrow(/outside 0\.\.3/);
        expect(() => moveOrder(0, 0, 1)).toThrow(/needs a room count/);
    });
});

describe('⛓⛓⛓ §20.11 #2 — a RENUMBERING closes or DISCARDS an open room session', () => {
    /**
     * ⛓⛓⛓ MUTANT: the decision is `none` for every renumbering (the room
     * session is left open). It would not be visible until the WRITE-BACK, and
     * then a room replacement would land on a room the reader never opened.
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

    it('⛓⛓ the ONE decision function serves all THREE renumbering ops', () => {
        // add-room at the end shifts nothing; at 0 it shifts everything.
        expect(addRoomMapping(0)(0)).toBe(1);
        expect(addRoomMapping(4)(0)).toBe(0);
        // remove-room DELETES its own room and pulls the rest down.
        expect(removeRoomMapping(1)(1)).toBe(null);
        expect(removeRoomMapping(1)(2)).toBe(1);
        expect(renumberDecision({ room: 1, ops: 0 }, removeRoomMapping(1), 'REMOVE').action)
            .toBe('discard');
        // …and a reorder that drops the room off the end is the same discard.
        expect(reorderMapping([0, 1])(5)).toBe(null);
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

describe('⛓⛓ the arrows are drawn from ROOM INDICES and nothing else', () => {
    const shapesOf = (record, opts) => exitArrowShapes(
        roomRowsOf(record, readers({ links: false })), opts,
    );

    it('⛓ every shape it produces is one `editorView.assertShape` accepts', () => {
        const shapes = shapesOf(fakeRecord([
            { name: 'a', exits: [1] }, { name: 'b', exits: [0] }, { name: 'c', exits: [0] },
        ]));
        expect(shapes.length).toBeGreaterThan(0);
        for (const s of shapes) expect(() => assertShape(s)).not.toThrow();
    });

    /**
     * ⛓⛓⛓ MUTANT: a two-way link is drawn as TWO one-headed lines. The reader
     * then cannot tell two separate ONE-WAY doors from one two-way door.
     */
    it('⛔⛔ a TWO-WAY link is ONE line with TWO heads, not two lines', () => {
        const both = shapesOf(fakeRecord([{ name: 'a', exits: [1] }, { name: 'b', exits: [0] }]));
        expect(both).toHaveLength(1);
        expect(both[0]).toMatchObject({ arrow: true, arrowBack: true, label: 'L0 ↔ L1' });
    });

    it('⛓ a ONE-WAY link keeps a single head, and the label says which way it goes', () => {
        const one = shapesOf(fakeRecord([{ name: 'a', exits: [1] }, { name: 'b', exits: [] }]));
        expect(one).toHaveLength(1);
        expect(one[0]).toMatchObject({ arrowBack: false, label: 'L0 → L1' });
    });

    it('⛓⛓ the SELECTED room\'s "what links here" is HIGHLIGHTED, and nothing else is', () => {
        const rec = fakeRecord([
            { name: 'a', exits: [1] }, { name: 'b', exits: [] }, { name: 'c', exits: [] },
        ]);
        expect(shapesOf(rec, { selected: 1 }).filter((s) => s.highlight).map((s) => s.label))
            .toEqual(['L0 → L1']);
        expect(shapesOf(rec, { selected: null }).some((s) => s.highlight)).toBe(false);
    });

    it('⛔ a link to a room the set does not have is DROPPED from the picture rather than '
        + 'drawn off the end of the strip — the REPORT is where a dangling target is named', () => {
        expect(exitArrowShapes([{ index: 0, exitList: [{ index: 0, to: 99 }] }])).toEqual([]);
    });

    it('⛓ a SELF-JOIN is a LOOP with real length — `assertShape` refuses a one-point '
        + 'polyline, so a zero-length line would have refused at mount', () => {
        const [loop] = exitArrowShapes([
            { index: 0, exitList: [{ index: 0, to: 0 }] },
            { index: 1, exitList: [] },
        ]);
        expect(loop.points.length).toBeGreaterThan(2);
        expect(() => assertShape(loop)).not.toThrow();
        expect(loop.label).toMatch(/↺/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * GATEABILITY, RULE TARGETS AND INERT RULES — over a HAND-BUILT atlas
 * ══════════════════════════════════════════════════════════════════════ */

const ATLAS = Object.freeze({
    regions: [
        {
            region_id: 'r0',
            map_ref: 0,
            exits: [{ exit_id: 'out' }, { exit_id: 'lonely' }],
            locations: [],
        },
        { region_id: 'r1', map_ref: 1, exits: [{ exit_id: 'in' }, { exit_id: 'both' }], locations: [] },
    ],
    vanilla_layout: {
        start_region: 'r0',
        connections: [
            { from: ['r0', 'out'], to: ['r1', 'in'], one_way: true },
            { from: ['r1', 'both'], to: ['r0', 'out'] },
        ],
    },
});

describe('⛔⛔ gateability — which endpoint a rule can actually gate', () => {
    it('⛓ the SOURCE side of any connection gates', () => {
        expect(gateabilityOf(ATLAS, 'r0', 'out')).toEqual({ gates: true, why: null });
        expect(gateabilityOf(ATLAS, 'r1', 'both')).toEqual({ gates: true, why: null });
    });

    it('⛔⛔ the ARRIVAL side of a ONE-WAY connection gates NOTHING, and says why', () => {
        const g = gateabilityOf(ATLAS, 'r1', 'in');
        expect(g.gates).toBe(false);
        expect(g.why).toMatch(/ARRIVAL side of a ONE-WAY/);
    });

    /**
     * ⛓⛓ MUTANT: `one_way` is read as truthy rather than `=== true`. A
     * connection carrying `one_way: undefined` (the two-way default) would then
     * still be read as directed — no, the mutant is the OTHER way: reading it
     * as `!== false` would call a two-way arrival ungateable. This row is the
     * one that tells the two apart.
     */
    it('⛓ …but the arrival side of a TWO-WAY connection DOES gate', () => {
        expect(gateabilityOf(ATLAS, 'r0', 'out').gates).toBe(true);
        const twoWay = {
            regions: [], vanilla_layout: { connections: [{ from: ['a', 'x'], to: ['b', 'y'] }] },
        };
        expect(gateabilityOf(twoWay, 'b', 'y')).toEqual({ gates: true, why: null });
    });

    it('⛔ an UNWIRED endpoint is named as unwired, not as an arrival', () => {
        const g = gateabilityOf(ATLAS, 'r0', 'lonely');
        expect(g.gates).toBe(false);
        expect(g.why).toMatch(/UNWIRED/);
    });
});

describe('⛓⛓ the rule targets and the inert-rule scan read the INJECTED key spelling', () => {
    const RECORD = fakeRecord([{ name: 'a', exits: [] }, { name: 'b', exits: [] }], {
        rooms: {
            0: { rules: { 'door/lonely': { rule: 'True_' }, 'prize/gold': { rule: 'True_' } } },
            1: { rules: { 'door/in': { rule: 'True_' } }, locations: [{ name: 'gem' }] },
        },
    });

    it('⛓ the targets of one room are the derivation\'s exit ids, each MARKED', () => {
        const t = ruleTargetsOver(RECORD, 0, {}, { deriveAtlasOf: () => ({ atlas: ATLAS }) });
        expect(t.why).toBeNull();
        expect(t.exits.map((e) => e.id)).toEqual(['out', 'lonely']);
        expect(t.exits.map((e) => e.gates)).toEqual([true, false]);
        expect(t.locations).toEqual([]);
    });

    it('⛓ the LOCATION targets come from the OVERLAY and cost no derivation', () => {
        let derived = 0;
        const t = ruleTargetsOver(RECORD, 1, {}, {
            deriveAtlasOf: () => { derived += 1; return { atlas: ATLAS }; },
        });
        expect(t.locations).toEqual(['gem']);
        expect(derived).toBe(1); // the EXITS cost one; the locations cost none
    });

    it('⛔ a record whose atlas will not derive says WHY rather than offering an empty list', () => {
        const t = ruleTargetsOver(RECORD, 0, {}, {
            deriveAtlasOf: () => { throw new Error('no geometry'); },
        });
        expect(t.exits).toEqual([]);
        expect(t.why).toMatch(/could not be derived — no geometry/);
    });

    it('⛓ every target key carries its PREFIX, in the SUBSTRATE\'s spelling', () => {
        const keys = ruleTargetKeys({ exits: [{ id: 'out' }], locations: ['gem'] }, FAKE_KEYS);
        expect(keys).toEqual(['door/out', 'prize/gem']);
    });

    /**
     * ⛔⛔⛔ MUTANT: `inertRulesOf` keys on the literal `'exit:'`. It is green
     * over Seedling for ever and reports ZERO inert rules for every other
     * substrate — a silent all-clear, which is the worst shape a verdict has.
     */
    it('⛔⛔ the inert scan reads `ruleKeys.exit(\'\')` as its prefix, NOT a literal', () => {
        const inert = inertRulesOf(RECORD, ATLAS, { ruleKeys: FAKE_KEYS });
        expect(inert.map((r) => `${r.room}/${r.exitId}`)).toEqual(['0/lonely', '1/in']);
        expect(inert[0].why).toMatch(/UNWIRED/);
        expect(inert[1].why).toMatch(/ARRIVAL side/);
        // ⛓ …and the location rule is NOT an exit rule, in either spelling.
        expect(inert.some((r) => r.exitId === 'gold')).toBe(false);
        // ⛓ the same record read with SEEDLING's spelling finds nothing, which
        //   is exactly what a literal prefix would have reported for the maze.
        expect(inertRulesOf(RECORD, ATLAS, {
            ruleKeys: { exit: (id) => `exit:${id}`, location: (n) => `loc:${n}` },
        })).toEqual([]);
    });

    it('⛔ a rule on a room the derivation kept NO region for is named too', () => {
        const rec = fakeRecord([{ name: 'a', exits: [] }], {
            rooms: { 7: { rules: { 'door/anything': { rule: 'True_' } } } },
        });
        expect(inertRulesOf(rec, ATLAS, { ruleKeys: FAKE_KEYS })[0].why)
            .toMatch(/kept no region/);
    });

    it('⛔ the prefix builder is REQUIRED', () => {
        expect(() => inertRulesOf(RECORD, ATLAS, {})).toThrow(/`ruleKeys.exit` injected/);
        expect(() => ruleTargetKeys({ exits: [], locations: [] }, {}))
            .toThrow(/`ruleKeys.exit` injected/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FREE EDGES AND THE OVERLAY'S LOCATION COUNT
 * ══════════════════════════════════════════════════════════════════════ */

const rulesDoc = (regions) => ({
    regions: { 1: regions },
    start_regions: { 1: ['Menu'] },
});

describe('⛓⛓ every FREE edge is NAMED, off the COMPILED rules', () => {
    it('⛓ an exit or location whose compiled rule is `True_` is FREE, and so is one with no '
        + 'rule at all — the compiler writes the first and an author omits the second', () => {
        const free = freeEdgesOf(rulesDoc({
            Start: {
                exits: [
                    { name: 'open', access_rule: { rule: 'True_' } },
                    { name: 'gated', access_rule: { rule: 'Has', item: 'Sword' } },
                    { name: 'bare' },
                ],
                locations: [{ name: 'chest' }, { name: 'locked', access_rule: { rule: 'Has' } }],
            },
        }));
        expect(free.map((f) => f.name)).toEqual(['open', 'bare', 'chest']);
        expect(free.map((f) => f.kind)).toEqual(['exit', 'exit', 'location']);
        expect(new Set(free.map((f) => f.region))).toEqual(new Set(['Start']));
    });

    it('⛓ a fully gated graph reports NO free edges', () => {
        expect(freeEdgesOf(rulesDoc({
            Start: { exits: [{ name: 'g', access_rule: { rule: 'Has' } }], locations: [] },
        }))).toEqual([]);
    });
});

describe('⛓ the OVERLAY\'s location count', () => {
    it('⛓ sums every room\'s list and answers 0 for an overlay with no rooms', () => {
        expect(overlayLocationCount(fakeRecord([], {
            rooms: { 0: { locations: [{ name: 'a' }, { name: 'b' }] }, 3: { locations: [{ name: 'c' }] } },
        }))).toBe(3);
        expect(overlayLocationCount(fakeRecord([], { rooms: {} }))).toBe(0);
        expect(overlayLocationCount({})).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE REPORT, OVER A SUBSTRATE THAT DOES NOT EXIST
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ The four adapter functions and the document descriptor, all fake. The
 * compile is a hand-written rules.json; the derivation is the hand-built atlas
 * above. ⛔ Nothing Seedling is imported by this file at all — which is the
 * claim.
 */
const fakeSession = (record) => ({ record: () => record, ops: () => [] });

const fakeReport = (over = {}) => {
    const record = over.record ?? fakeRecord([{ name: 'a', exits: [] }, { name: 'b', exits: [] }]);
    return reportOver({
        session: fakeSession(record),
        deps: {},
        adapterFns: {
            bounds: FAKE.bounds,
            validateForDownload: over.validateForDownload
                ?? (() => ({ ok: true, errors: [], warnings: [], doc_id: 'fake-0001' })),
            deriveAtlasOf: over.deriveAtlasOf ?? (() => ({ atlas: ATLAS, dropped: [] })),
            rulesJsonOf: over.rulesJsonOf ?? (() => ({
                rules: rulesDoc({
                    Menu: {
                        exits: [{ name: 'to_r0', connected_region: 'r0', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    r0: {
                        exits: [{ name: 'out', connected_region: 'r1', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    r1: { exits: [], locations: [] },
                }),
                report: { unwired_exits: [], locations: 0 },
            })),
        },
        document: {
            kind: 'region-library', noun: 'library', validator: 'validateFake',
            idOf: (c) => c.doc_id,
        },
        ruleKeys: FAKE_KEYS,
        compileRegionAtlas: () => { throw new Error('never called — rulesJsonOf is injected'); },
        validateRegionAtlas: over.validateRegionAtlas,
        ...(over.atlasSchema === undefined ? {} : { atlasSchema: over.atlasSchema }),
    });
};

describe('⛓⛓⛓ the REPORT is a LIST, and it names the document the SUBSTRATE names', () => {
    /**
     * ⛔⛔ **A RECORD WITH NO `overlay` HALF AT ALL REPORTS — IT DOES NOT
     * CRASH** (EDITOR INTEGRATION W2, measurement 4). `record.overlay.rooms`
     * was the ONE unguarded read of the overlay in this function, beside two
     * that already went through `?.`; a WORLD's record is `{world, parts}`
     * with its parts' overlays inside the world document, so it is the first
     * record that has none, and the `TypeError` landed in the REPORT rather
     * than in the thing under test.
     *
     * ⛔ mutant: put `record.overlay.rooms` back — this row goes red with
     * *"Cannot read properties of undefined (reading 'rooms')"* and every
     * other row in this file stays green, because every other record here has
     * an overlay.
     */
    it('⛔ a record with NO overlay half reports instead of throwing', () => {
        const noOverlay = Object.freeze({ cells: [{ name: 'a', exits: [] }, { name: 'b', exits: [] }] });
        const rep = fakeReport({ record: noOverlay });
        expect(rep.rows.some((r) => r.kind === 'reach' && r.severity === 'ok')).toBe(true);
        // ⛓ …and the two rows the overlay would have driven are simply ABSENT,
        //   rather than claiming something about an overlay that is not there.
        expect(rep.rows.some((r) => r.kind === 'inert-rule')).toBe(false);
        expect(rep.rows.find((r) => r.kind === 'locations').text)
            .toMatch(/^0 location\(s\) in the OVERLAY, 0 compiled$/);
        expect(rep.download.rules.allowed).toBe(true);
    });

    it('⛓⛓ section 1 quotes the injected validator, noun and id — none of them Seedling\'s', () => {
        const rep = fakeReport();
        const row = rep.rows.find((r) => r.kind === 'region-library');
        expect(row.severity).toBe('ok');
        expect(row.text).toBe('validateFake: ok — 2 room(s), stamped fake-0001');
    });

    /**
     * ⛔⛔ MUTANT: the row is hard-coded to `validateLevelSet: ok — … stamped
     * <set_id>` and the kind to `'level-set'`. The maze's REPORT would then
     * claim a validator that never ran over a document it does not have.
     */
    it('⛔ the export refusal calls the document by the substrate\'s NOUN', () => {
        const rep = fakeReport({
            validateForDownload: () => ({
                ok: false, errors: ['entries must be a non-empty array'], warnings: [],
                doc_id: 'fake-0001',
            }),
        });
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/the library itself is not valid/);
        expect(rep.download.rules.why).not.toMatch(/the set itself/);
    });

    it('⛓ a clean graph ALLOWS the rules.json export and reports every section', () => {
        const rep = fakeReport();
        expect(rep.download.rules).toEqual({ allowed: true, why: null });
        expect(new Set(rep.rows.map((r) => r.kind)))
            .toEqual(new Set(['region-library', 'unwired', 'free', 'reach', 'locations']));
        expect(rep.rules).toBeTruthy();
        expect(rep.atlas).toBe(ATLAS);
    });

    it('⛔⛔ an UNREACHABLE region REFUSES the export BY NAME', () => {
        const rep = fakeReport({
            rulesJsonOf: () => ({
                rules: rulesDoc({
                    Menu: {
                        exits: [{ name: 'to_r0', connected_region: 'r0', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    r0: { exits: [], locations: [] },
                    island: { exits: [], locations: [] },
                }),
                report: { unwired_exits: [], locations: 0 },
            }),
        });
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/island/);
        expect(rep.rows.some((r) => r.kind === 'reach' && r.severity === 'error')).toBe(true);
    });

    it('⛔ a derivation that THROWS stops the report and says which stage failed', () => {
        const rep = fakeReport({ deriveAtlasOf: () => { throw new Error('links name no exit'); } });
        expect(rep.rules).toBeNull();
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.rows.at(-1).text).toMatch(/could not be derived — links name no exit/);
    });

    it('⛔ a compile that THROWS is the other stage, and it is named too', () => {
        const rep = fakeReport({ rulesJsonOf: () => { throw new Error('no gridFor'); } });
        expect(rep.download.rules.why).toMatch(/does not compile/);
        expect(rep.rows.at(-1).text).toMatch(/compileRegionAtlas REFUSED — no gridFor/);
    });

    it('⛓⛓ the atlas STRUCTURAL row is added whether the pass is CLEAN or not, and says when '
        + 'no schema was injected', () => {
        const clean = fakeReport({
            validateRegionAtlas: () => ({ ok: true, errors: [], warnings: [] }),
        });
        const row = clean.rows.find((r) => r.kind === 'region-atlas');
        expect(row.text).toMatch(/validateRegionAtlas: ok — 2 region\(s\)/);
        expect(row.text).toMatch(/no schema was injected/);
        const dirty = fakeReport({
            validateRegionAtlas: () => ({ ok: false, errors: ['bad'], warnings: ['warn'] }),
        });
        expect(dirty.rows.filter((r) => r.kind === 'region-atlas').map((r) => r.severity))
            .toEqual(['error', 'error', 'warn', 'ok']);
    });

    it('⛓ an INERT authored rule refuses the export, in the substrate\'s own key spelling', () => {
        const rep = fakeReport({
            record: fakeRecord([{ name: 'a', exits: [] }, { name: 'b', exits: [] }], {
                rooms: { 1: { rules: { 'door/in': { rule: 'True_' } } } },
            }),
        });
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/room 1 \/ in/);
    });

    it('⛔ every injected function is REQUIRED, and the refusal names it', () => {
        for (const missing of ['validateForDownload', 'deriveAtlasOf', 'rulesJsonOf', 'bounds']) {
            const fns = {
                validateForDownload: () => ({ ok: true, errors: [], warnings: [] }),
                deriveAtlasOf: () => ({ atlas: ATLAS }),
                rulesJsonOf: () => ({ rules: {}, report: {} }),
                bounds: FAKE.bounds,
            };
            delete fns[missing];
            expect(() => reportOver({
                session: fakeSession(fakeRecord([])),
                adapterFns: fns,
                document: { kind: 'k', noun: 'n', validator: 'v', idOf: () => 'x' },
                ruleKeys: FAKE_KEYS,
            }), missing).toThrow(new RegExp(`adapterFns.${missing}\` injected`));
        }
        expect(() => reportOver({
            session: fakeSession(fakeRecord([])),
            adapterFns: {
                validateForDownload: () => ({ ok: true, errors: [], warnings: [] }),
                deriveAtlasOf: () => ({ atlas: ATLAS }),
                rulesJsonOf: () => ({ rules: {}, report: {} }),
                bounds: FAKE.bounds,
            },
            document: { kind: 'k', noun: 'n', idOf: () => 'x' },
            ruleKeys: FAKE_KEYS,
        })).toThrow(/document` = \{kind, noun, validator, idOf\}/);
    });
});
