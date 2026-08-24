/**
 * seedlingDemo/watchEdit.test — the four ops, the ONE fold, and the two laws.
 *
 * CONSTRUCTIVE-MODE arc, slice 11 (family K; ⚖ ruling 8, §3.8). What is
 * actually at stake here is not "does a paint paint" — it is:
 *
 *  1. **THE FOLD IS THE IDENTITY.** `applyEdits(recipeRecord, edits)` has to
 *     be the only way an edited level is ever rebuilt, and it has to be
 *     BYTE-DETERMINISTIC — the page, `?gen=`, `generateWithDirectives({edits})`
 *     and this file all go through it, and a payload that reconstructed
 *     differently in node and in chromium would take the cross-runtime claim
 *     down with it.
 *  2. **UNDO IS THAT FOLD, NOT AN INVERSE.** So an undone level must be BYTE
 *     IDENTICAL to a level that never had the popped edit — asserted, because
 *     "of course it is" is exactly the shape that stops being true the day
 *     somebody adds a stack.
 *  3. **NOTHING HERE ADJUDICATES LEGALITY.** A wall across the corridor, a
 *     wall ring painted to ground, an entity the world has never heard of —
 *     they all APPLY. The oracle is the guard, and these rows are what say so.
 *  4. **THE ROSTER IS WHAT THE WORLD BUILDS.** Every offered entity type is in
 *     `levelWorld.ENTITY_CLASSES`, asked of that table rather than of a list
 *     this arc keeps.
 */

import { describe, expect, it } from 'vitest';

import {
    CELL_OPS, EDIT_OPS, ENTITY_ROSTER, ENTITY_ROSTER_PROCGEN, ENTITY_ROSTER_TYPES, ROOM_OPS,
    ROOM_GEOMETRY_BOSSES, WatchEditError, applyEdit, applyEdits, coerceAttrValue, describeEdit,
    editState, editStates, entityDecl, entityIndexAt, entityRosterFrom, normalizeAttrsAgainst,
    normalizeEdit, normalizeGroupOrEdit, resizeWarnings, undoEdit,
} from './watchEdit.js';
import {
    LAYER_COLUMNS, LAYER_TILESETS, TERRAIN_NAMES, TILE_LAYERS, assertColumnsModelled, emptyLevel,
    hasTile, layerNamed, oelAtTile, resizeRoom, shellOf, terrainAt, tileAtOel, tileCellAt,
    withTerrain,
} from './procgenLevel.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLIFFSIDE_FRAME_MASKS, MODELLED_TILE_TYPES } from './levelWorld.js';
import { TILE_COLUMN_TO_TYPE } from '../flashPanel/seedlingSemantics.js';
import { loadAtlas } from './levelSource.js';
import { ENTITY_CLASSES, buildLevelWorld, LevelWorldError } from './levelWorld.js';
import { generateStep, generateWithDirectives } from './watchGenerate.js';
import { atlasOf } from './procgenLevel.js';
import { levelSourceFromAtlas } from './atlasSource.js';

const SUBJECT = { seed: 3, biome: 'pre-sword' };
const skeleton = () => generateStep({ ...SUBJECT, step: 0 });
const ladder = (step = 2) => generateStep({ ...SUBJECT, step });
const j = (v) => JSON.stringify(v);

describe('the op set — closed, and normalized before anything is applied', () => {
    it('the ops ARE the set every reader shares — slice 11\'s four, plus B\'s two', () => {
        expect(EDIT_OPS).toEqual(['paint', 'place', 'attrs', 'remove', 'nodes', 'resize']);
        expect(Object.isFrozen(EDIT_OPS)).toBe(true);
    });

    /**
     * ⛓ CELL vs ROOM, DERIVED — trap 574's shape. `resize` is the one op that
     * carries no `tx`/`ty`, and the split is declared once so `normalizeEdit`'s
     * demand for a cell follows the declaration instead of a chain of
     * `op.op !== …` that a seventh op joins by being forgotten.
     */
    it('⛓ every op is a CELL op or a ROOM op, and the two lists PARTITION the set', () => {
        expect([...CELL_OPS, ...ROOM_OPS].sort()).toEqual([...EDIT_OPS].sort());
        expect(CELL_OPS.filter((o) => ROOM_OPS.includes(o))).toEqual([]);
        expect(ROOM_OPS).toEqual(['resize']);
    });

    it('an unknown op refuses BY NAME and names the whole set', () => {
        expect(() => normalizeEdit({ op: 'nudge', tx: 1, ty: 1 }))
            .toThrow(/is not one of the 6 edit ops \[paint, place, attrs, remove, nodes, resize\]/);
    });

    /**
     * ⛓⛓⛓ THE ROW THE CROSS-RUNTIME CLAIM RESTS ON. The edit list is compared
     * BYTE for BYTE between a payload and a page, so key ORDER is part of the
     * op — two ways of typing one edit must produce one string or `?gen=` would
     * report a difference in a field that says the same thing.
     */
    it('⛔ the canonical form is KEY-ORDERED, so one edit has one spelling', () => {
        const a = normalizeEdit({ terrain: 'wall', ty: 4, op: 'paint', tx: 3 });
        const b = normalizeEdit({ op: 'paint', tx: 3, ty: 4, terrain: 'wall' });
        expect(j(a)).toBe(j(b));
        expect(j(a)).toBe('{"op":"paint","tx":3,"ty":4,"terrain":"wall"}');
    });

    it('⛔ …and so are the ATTRS, sorted — two typing orders, one payload', () => {
        const a = normalizeEdit({ op: 'place', tx: 2, ty: 2, type: 'lock',
            attrs: { tag: '-1', tset: '0' } });
        const b = normalizeEdit({ op: 'place', tx: 2, ty: 2, type: 'lock',
            attrs: { tset: '0', tag: '-1' } });
        expect(j(a)).toBe(j(b));
        expect(j(a.attrs)).toBe('{"tag":"-1","tset":"0"}');
    });

    it('a non-integer cell refuses — an edit addresses a CELL a reader can see', () => {
        expect(() => normalizeEdit({ op: 'paint', tx: 1.5, ty: 1, terrain: 'wall' }))
            .toThrow(WatchEditError);
        expect(() => normalizeEdit({ op: 'remove', tx: 1, ty: null }))
            .toThrow(/needs an integer ty/);
    });

    it('a terrain outside the four-terrain vocabulary refuses, and names them', () => {
        expect(() => normalizeEdit({ op: 'paint', tx: 1, ty: 1, terrain: 'lava' }))
            .toThrow(new RegExp(`\\[${TERRAIN_NAMES.join(', ')}\\]`));
    });

    /**
     * ⚠ THE GAP IS DELIBERATE AND IT IS LAW (b): a TYPE is not validated here.
     * The engine refuses an untranscribed tag by name with the construction
     * site it wants, which is a better answer than any list in this module.
     */
    it('⛔ an UNKNOWN entity type is ACCEPTED here — free means free', () => {
        expect(() => normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'notathing' }))
            .not.toThrow();
        expect(ENTITY_CLASSES.notathing).toBeUndefined();
    });

    it('…but an EMPTY type refuses, because it names nothing at all', () => {
        expect(() => normalizeEdit({ op: 'place', tx: 1, ty: 1, type: '' }))
            .toThrow(/needs a non-empty entity type/);
    });

    it('a nested attrs value refuses — an OEL attribute is a scalar', () => {
        expect(() => normalizeEdit({ op: 'attrs', tx: 1, ty: 1, attrs: { nodes: [{ x: 1 }] } }))
            .toThrow(/an OEL attribute is a scalar/);
    });
});

describe('⛓⛓ THE ROSTER IS WHAT THE **WORLD** BUILDS', () => {
    /**
     * ⛔ ASKED OF `ENTITY_CLASSES`, the engine's own transcribed table, and not
     * of a second list this arc keeps. A roster that named a type
     * `buildLevelWorld` refuses would be a page offering an edit that cannot be
     * drawn — the offer is a suggestion, but a suggestion that is always wrong
     * is a defect.
     */
    it('every offered type is in levelWorld.ENTITY_CLASSES', () => {
        for (const row of ENTITY_ROSTER) {
            expect(ENTITY_CLASSES[row.type], `${row.type} is not transcribed`).toBeTruthy();
        }
        expect(ENTITY_ROSTER_TYPES).toEqual(
            ['pushableblock', 'button', 'lock', 'spinner', 'arrowtrap']);
    });

    /**
     * ⛓ AND THE FIVE ARE THE ONES THE PALETTE PLACES — the measurement the
     * roster was chosen by, asserted rather than left in a docblock. Every one
     * of them is a body the generator already builds, solves and certifies in
     * this exact room, which is the evidence the wider guess had none of.
     */
    it('⛓ …and each carries a REASON, so the datalist can say why', () => {
        for (const row of ENTITY_ROSTER) {
            expect(typeof row.why).toBe('string');
            expect(row.why.length).toBeGreaterThan(10);
        }
    });

    it('⚠ the GOAL class is deliberately NOT offered', () => {
        expect(ENTITY_ROSTER_TYPES).not.toContain('torchpickup');
    });
});

describe('the ops, applied — PURE, and the record before is untouched', () => {
    it('paint replaces one cell\'s terrain and nothing else', () => {
        const s = skeleton();
        const before = j(s.record);
        const next = applyEdit(s.record, { op: 'paint', tx: 5, ty: 5, terrain: 'water' });
        expect(terrainAt(next, 5, 5)).toBe('water');
        expect(terrainAt(s.record, 5, 5)).toBe('ground');
        expect(j(s.record)).toBe(before);
        expect(next.entities).toEqual(s.record.entities);
    });

    /**
     * ⛓⛓⛓ LAW (b), IN ITS SHARPEST FORM: the BORDER RING is editable. A wall
     * ring painted to ground is a room the player can walk out of — and this
     * module says nothing about it. The ORACLE is the guard.
     */
    it('⛔ the BORDER RING is editable — nothing here checks legality', () => {
        const s = skeleton();
        expect(terrainAt(s.record, 0, 0)).toBe('wall');
        const next = applyEdit(s.record, { op: 'paint', tx: 0, ty: 0, terrain: 'ground' });
        expect(terrainAt(next, 0, 0)).toBe('ground');
    });

    it('…and a cell OUTSIDE the rectangle refuses with procgenLevel\'s own sentence', () => {
        const s = skeleton();
        expect(() => applyEdit(s.record, { op: 'paint', tx: 99, ty: 0, terrain: 'wall' }))
            .toThrow(/is outside level 900's 10x10 rectangle/);
    });

    it('place puts the entity at the cell\'s OEL CORNER, attrs LITERAL', () => {
        const s = skeleton();
        const next = applyEdit(s.record,
            { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} });
        expect(next.entities.length).toBe(s.record.entities.length + 1);
        const placed = next.entities[next.entities.length - 1];
        expect({ x: placed.x, y: placed.y }).toEqual(oelAtTile(4, 6));
        expect(tileAtOel(placed.x, placed.y)).toEqual({ tx: 4, ty: 6 });
        expect(placed.attrs).toEqual({});
    });

    /**
     * ⛔ NO PLACEMENT SLOTS. `procgenPalette` derives a template's `tset`/`tag`
     * from its ANCHOR so two placements cannot share an activator group; a hand
     * placement has no anchor to derive from, so what you typed is what the
     * record carries.
     */
    it('⛔ a hand-placed lock keeps the LITERAL tset it was given', () => {
        const s = skeleton();
        const next = applyEdit(s.record,
            { op: 'place', tx: 4, ty: 6, type: 'lock', attrs: { tset: '7', tag: '-1' } });
        expect(next.entities[next.entities.length - 1].attrs).toEqual({ tset: '7', tag: '-1' });
    });

    it('remove deletes the LAST entity in the cell, and refuses an empty one', () => {
        const s = skeleton();
        const goal = s.model.goalCell;
        const withTwo = applyEdits(s.record, [
            { op: 'place', tx: 4, ty: 6, type: 'button', attrs: { tset: '0' } },
            { op: 'place', tx: 4, ty: 6, type: 'lock', attrs: { tset: '1' } },
        ]);
        /**
         * ⛓⛓ RE-COUNTED AT ARC-3 SLICE 4c. The step-0 record is the SEAM's
         * model now (`generateStep`), and the biome's DEFAULT ELEMENT SPEC puts
         * an element in the skeleton — so the room this file edits starts with
         * the goal PLUS whatever the element placed, rather than with the goal
         * alone. ⛔ The count is therefore taken FROM the record instead of
         * being a literal: the claim is *two placed entities arrive and the
         * remove takes the LAST one*, which is about `applyEdit` and not about
         * how furnished the room was.
         */
        const before = s.record.entities.length;
        expect(withTwo.entities.length).toBe(before + 2);
        const gone = applyEdit(withTwo, { op: 'remove', tx: 4, ty: 6 });
        expect(gone.entities.map((e) => e.type))
            .toEqual([...s.record.entities.map((e) => e.type), 'button']);
        expect(() => applyEdit(s.record, { op: 'remove', tx: 9, ty: 9 }))
            .toThrow(/holds no entity/);
        // ⚠ and the GOAL itself is removable — the oracle then refuses, loudly.
        // ⛓ SLICE 4c: the room may hold an ELEMENT's entities too, so the claim
        // is that the GOAL is gone rather than that the room is empty.
        const noGoal = applyEdit(s.record, { op: 'remove', tx: goal.tx, ty: goal.ty });
        expect(noGoal.entities.some((e) => e.type === 'torchpickup')).toBe(false);
        expect(noGoal.entities).toHaveLength(s.record.entities.length - 1);
    });

    it('attrs REPLACES rather than merges — clearing is spelled by leaving out', () => {
        const s = skeleton();
        const goal = s.model.goalCell;
        expect(s.record.entities[0].attrs).toEqual({ tag: '0' });
        const next = applyEdit(s.record,
            { op: 'attrs', tx: goal.tx, ty: goal.ty, attrs: { tset: '4' } });
        expect(next.entities[0].attrs).toEqual({ tset: '4' });
        const cleared = applyEdit(s.record, { op: 'attrs', tx: goal.tx, ty: goal.ty });
        expect(cleared.entities[0].attrs).toEqual({});
    });

    it('entityIndexAt answers LAST-wins, and -1 for an empty cell', () => {
        const s = skeleton();
        const two = applyEdits(s.record, [
            { op: 'place', tx: 2, ty: 2, type: 'button', attrs: {} },
            { op: 'place', tx: 2, ty: 2, type: 'lock', attrs: {} },
        ]);
        expect(two.entities[entityIndexAt(two, 2, 2)].type).toBe('lock');
        expect(entityIndexAt(two, 8, 8)).toBe(-1);
    });
});

describe('⛓⛓⛓ THE FOLD IS THE IDENTITY', () => {
    /**
     * ⛓⛓⛓ **THE WATER CELL MOVED (6,6) → (8,6) AT ARC 5 SLICE 6a**, re-picked
     * by its own rule rather than by hand (trap 285).
     *
     * ⛔ THE ROW BELOW IS ABOUT A LIST OF EDITS THAT ALL LAND, and `editState`
     * drops an op that moved no bytes on purpose (*"§3.8 is a law about
     * CHANGES"*, above). Slice 6a's biome default puts a `chamber` in this
     * subject's room, and `paint water (6,6)` became a NO-OP — the page's fold
     * then carried three ops where the raw fold carried four, which is the row
     * reporting a real difference about a list nobody meant to shorten.
     *
     * ⛓ THE RULE: the NEXT cell in row-major order at which the same op still
     * changes the record. On `seed 3`/`pre-sword`/step 2 the no-op block is
     * exactly (5..7, 6..7) — ten cells of a hundred — so the answer is (8,6).
     */
    const OPS = [
        { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
        { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} },
        { op: 'paint', tx: 8, ty: 6, terrain: 'water' },
        { op: 'attrs', tx: 4, ty: 6, attrs: { tset: '2' } },
    ];

    it('applyEdits folds in ORDER, and the order matters', () => {
        const base = skeleton().record;
        const forward = applyEdits(base, [OPS[0], OPS[2]]);
        const reversed = applyEdits(base, [OPS[2], OPS[0]]);
        expect(terrainAt(forward, 5, 5)).toBe('wall');
        expect(terrainAt(forward, 8, 6)).toBe('water');
        // ⚠ these two happen to commute; the point of the row is that both ran.
        expect(j(forward)).toBe(j(reversed));
        const paintTwice = applyEdits(base, [
            { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
            { op: 'paint', tx: 5, ty: 5, terrain: 'pit' },
        ]);
        expect(terrainAt(paintTwice, 5, 5)).toBe('pit');
    });

    /**
     * ⛓⛓⛓ THE ROW THAT MAKES THE PAYLOAD A REPRODUCTION. Two INDEPENDENT
     * folds of the same list over the same recipe record — one through
     * `editStates` (the page's path) and one through `applyEdits` (the raw
     * fold) — are the same bytes.
     */
    it('⛔ the page\'s fold and the raw fold produce the SAME BYTES', () => {
        const s = ladder(2);
        const viaState = editStates(s, OPS);
        const viaRecord = applyEdits(s.record, OPS);
        expect(j(viaState.record)).toBe(j(viaRecord));
        expect(j(viaState.edits)).toBe(j(OPS.map(normalizeEdit)));
    });

    it('⛔ generateWithDirectives({edits}) IS ladder → directives → edits', () => {
        const withEdits = generateWithDirectives({ ...SUBJECT, step: 2, edits: OPS });
        const byHand = editStates(generateStep({ ...SUBJECT, step: 2 }), OPS);
        expect(j(withEdits.record)).toBe(j(byHand.record));
        expect(j(withEdits.edits)).toBe(j(byHand.edits));
        // and an absent list is exactly an empty one
        expect(j(generateWithDirectives({ ...SUBJECT, step: 2 }).record))
            .toBe(j(generateWithDirectives({ ...SUBJECT, step: 2, edits: [] }).record));
    });

    /**
     * ⛓⛓ AND THE STATE'S OTHER FIELDS DO NOT MOVE. A hand edit is not part of
     * the run that produced the prefix — rewriting `summary` for it would make
     * the payload claim a loop kept something no loop drew.
     */
    it('⛔ an edit leaves summary / trace / directives / keptTemplates alone', () => {
        const s = ladder(2);
        const e = editStates(s, OPS);
        expect(e.summary).toBe(s.summary);
        expect(e.trace).toBe(s.trace);
        expect(e.directives).toBe(s.directives);
        expect(e.keptTemplates).toBe(s.keptTemplates);
        expect(e.baseRecord).toBe(s.record);
    });
});

describe('⛓⛓⛓ TRAP 263 — a click that CHANGED NOTHING is not an edit', () => {
    /**
     * ⚖ §3.8 is a law about CHANGES. The maze page paid for this once (§10.6
     * defect 2) with an editor descriptor that called a no-op click a tile
     * edit; here the ops are honest and the no-op is still reachable, because
     * painting ground onto ground is a perfectly legal op that moves no bytes.
     */
    it('painting a cell its own terrain returns the SAME STATE OBJECT', () => {
        const s = ladder(1);
        expect(terrainAt(s.record, 8, 8)).toBe('ground');
        expect(editState(s, { op: 'paint', tx: 8, ty: 8, terrain: 'ground' })).toBe(s);
    });

    it('…and so does rewriting an entity\'s attrs with the ones it has', () => {
        const s = skeleton();
        const goal = s.model.goalCell;
        expect(s.record.entities[0].attrs).toEqual({ tag: '0' });
        expect(editState(s, { op: 'attrs', tx: goal.tx, ty: goal.ty, attrs: { tag: '0' } }))
            .toBe(s);
    });

    /**
     * ⛔ AND `applyEdit` STAYS TOTAL. It is the pure writer the fold calls for
     * every op in a payload; the change test belongs to the STATE transition,
     * because it is the edit LIST that is the identity.
     */
    it('⛔ applyEdit itself still applies a no-op — the writer is total', () => {
        const s = ladder(1);
        const same = applyEdit(s.record, { op: 'paint', tx: 8, ty: 8, terrain: 'ground' });
        expect(j(same)).toBe(j(s.record));
        expect(same).not.toBe(s.record);
    });

    it('⚠ a payload carrying a no-op reconstructs the same RECORD, a SHORTER list', () => {
        const s = ladder(1);
        const replayed = editStates(s, [
            { op: 'paint', tx: 8, ty: 8, terrain: 'ground' },
            { op: 'paint', tx: 7, ty: 7, terrain: 'wall' },
        ]);
        expect(replayed.edits.length).toBe(1);
        expect(j(replayed.record))
            .toBe(j(applyEdits(s.record, [{ op: 'paint', tx: 7, ty: 7, terrain: 'wall' }])));
    });
});

describe('⛓⛓⛓ UNDO IS THE FOLD, NOT AN INVERSE', () => {
    it('one undo is BYTE IDENTICAL to a level that never had the last edit', () => {
        const s = ladder(1);
        const two = editStates(s, [
            { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
            { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} },
        ]);
        const undone = undoEdit(two);
        const oneOnly = editStates(s, [{ op: 'paint', tx: 5, ty: 5, terrain: 'wall' }]);
        expect(j(undone.record)).toBe(j(oneOnly.record));
        expect(j(undone.edits)).toBe(j(oneOnly.edits));
    });

    it('undoing to zero returns the RECIPE\'s own record, byte for byte', () => {
        const s = ladder(2);
        let e = editStates(s, [
            { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
            { op: 'remove', tx: s.model.goalCell.tx, ty: s.model.goalCell.ty },
        ]);
        e = undoEdit(undoEdit(e));
        expect(e.edits.length).toBe(0);
        expect(j(e.record)).toBe(j(s.record));
    });

    it('undo at zero edits is the identity — a page can call it unconditionally', () => {
        const s = ladder(1);
        expect(undoEdit(s)).toBe(s);
    });
});

describe('⛓⛓⛓ CERTIFICATION IS THE GUARD — the ENGINE is what refuses', () => {
    const build = (record) => buildLevelWorld(
        levelSourceFromAtlas(atlasOf(record))(record.level), record.level,
        ['blocking', 'route']);

    it('a legally-shaped record built out of hand edits still BUILDS', () => {
        const s = skeleton();
        const edited = applyEdits(s.record, [
            { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
            { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} },
        ]);
        expect(() => build(edited)).not.toThrow();
    });

    /**
     * ⛓⛓⛓ THE ENGINE-THROW SUBJECT, MEASURED HERE so the browser row can
     * assert about the PAGE's display of it rather than re-deriving what
     * throws. ⛔ `LevelWorldError` and NOT a generic `Error`: the page's catch
     * is bounded by that class, so a row that passed on any throw would pass on
     * a `TypeError` the page must NOT swallow.
     */
    it('⛔ an entity the class table has never heard of throws LevelWorldError', () => {
        const s = skeleton();
        const bad = applyEdit(s.record,
            { op: 'place', tx: 4, ty: 6, type: 'notathing', attrs: {} });
        expect(() => build(bad)).toThrow(LevelWorldError);
        expect(() => build(bad)).toThrow(/not in the transcribed class table/);
    });

    it('⛔ …and the EDIT itself did not refuse — the record holds it', () => {
        const s = skeleton();
        const bad = applyEdit(s.record,
            { op: 'place', tx: 4, ty: 6, type: 'notathing', attrs: {} });
        expect(bad.entities[bad.entities.length - 1].type).toBe('notathing');
    });
});

describe('describeEdit — the pane\'s row, in the brief\'s own spelling', () => {
    it('names the op, the cell and what it did', () => {
        expect(describeEdit(normalizeEdit({ op: 'paint', tx: 3, ty: 4, terrain: 'wall' })))
            .toBe('EDIT paint (3,4) → wall');
        expect(describeEdit(normalizeEdit(
            { op: 'place', tx: 1, ty: 2, type: 'lock', attrs: { tset: '0' } })))
            .toBe('EDIT place (1,2) → lock {tset=0}');
        expect(describeEdit(normalizeEdit({ op: 'remove', tx: 7, ty: 8 })))
            .toBe('EDIT remove (7,8) → the entity there is gone');
        expect(describeEdit(normalizeEdit({ op: 'attrs', tx: 7, ty: 8, attrs: { tag: '2' } })))
            .toBe('EDIT attrs (7,8) → {tag=2}');
    });

    it('⛓ every op the set holds has a row text — none falls through', () => {
        const at = { tx: 1, ty: 1 };
        const samples = {
            paint: { ...at, op: 'paint', terrain: 'pit' },
            place: { ...at, op: 'place', type: 'button' },
            attrs: { ...at, op: 'attrs' },
            remove: { ...at, op: 'remove' },
            nodes: { ...at, op: 'nodes', nodes: [{ x: 16, y: 32 }] },
            resize: { op: 'resize', width: 12, height: 12 },
        };
        for (const op of EDIT_OPS) {
            expect(describeEdit(normalizeEdit(samples[op])), op).toMatch(/^EDIT /);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 · SLICE B — THE WIDENED OPS AND THE `.oep` SCHEMA
 * ══════════════════════════════════════════════════════════════════════ */

const ATLAS = loadAtlas();

const SCHEMA = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/seedling-ogmo-schema.json', import.meta.url)), 'utf8',
));

describe('the .oep schema fixture — what the editor OFFERS, derived', () => {
    it('⛓ every declared value carries one of the FOUR Ogmo types, and the fixture '
        + 'publishes the closed set rather than the three that happen to occur', () => {
        expect(SCHEMA.value_types).toEqual(['integer', 'number', 'string', 'boolean']);
        const used = new Set(Object.values(SCHEMA.entities)
            .flatMap((e) => e.values.map((v) => v.type)));
        for (const t of used) expect(SCHEMA.value_types).toContain(t);
        // ⚠ MEASURED: Seedling's project uses three of the four. The consumer must
        // not learn "there are three types" from data that merely omits the fourth.
        expect([...used].sort()).toEqual(['integer', 'number', 'string']);
    });

    it('⛓⛓ EVERY entity type the 116 SHIPPED ROOMS hold is declared — the fixture is '
        + 'checked against the DATA the game loads, not against a second reading of the AS3',
    () => {
        const types = new Set(ATLAS.levels.flatMap((l) => l.entities.map((e) => e.type)));
        const undeclared = [...types].filter((t) => !SCHEMA.entities[t]);
        expect(undeclared, `${types.size} types in the atlas`).toEqual([]);
        expect(types.size).toBe(137);
        expect(Object.keys(SCHEMA.entities).length).toBe(144);
    });

    it('⛓⛓⛓ THE HARDENING RULE ACCEPTS THE REAL DATA — every attribute value of every '
        + 'entity in all 116 rooms satisfies its declared type and range', () => {
        let checked = 0;
        const refused = [];
        for (const level of ATLAS.levels) {
            for (const e of level.entities) {
                const decl = SCHEMA.entities[e.type];
                for (const [k, v] of Object.entries(e.attrs ?? {})) {
                    const d = decl.values.find((x) => x.name === k);
                    expect(d, `<${e.type}> carries an undeclared ${k}`).toBeTruthy();
                    checked += 1;
                    try { coerceAttrValue(d, v, 'row'); } catch (err) {
                        refused.push(`${e.type}.${k}=${v}: ${err.message}`);
                    }
                }
            }
        }
        // ⚠ TRAP "a hardening rule can REFUSE the real data": the corpus this rule is
        // about is the fixture the rule must satisfy, and the count is what makes the
        // row non-vacuous.
        expect(refused).toEqual([]);
        expect(checked).toBe(3574);
    });

    it('⚠ AND OGMO DOES **NOT** WRITE EVERY DECLARED VALUE — the brief said it does, '
        + 'measured false: 183 of 2,461 instances lack one', () => {
        let complete = 0;
        let partial = 0;
        const missing = new Map();
        for (const level of ATLAS.levels) {
            for (const e of level.entities) {
                const want = SCHEMA.entities[e.type].values.map((v) => v.name);
                const got = new Set(Object.keys(e.attrs ?? {}));
                const absent = want.filter((n) => !got.has(n));
                if (absent.length === 0) complete += 1; else partial += 1;
                for (const n of absent) missing.set(`${e.type}.${n}`, (missing.get(`${e.type}.${n}`) ?? 0) + 1);
            }
        }
        expect(complete).toBe(2278);
        expect(partial).toBe(183);
        expect([...missing.entries()].sort((a, b) => b[1] - a[1])[0]).toEqual(['teleporter.sign', 137]);
        // ⛓ …AND EVERY ONE OF THE ABSENT VALUES HAS A DECLARED DEFAULT. That is what
        // makes the finding "a value declared AFTER those rooms were last saved"
        // rather than "the format is optional wherever it feels like it".
        for (const key of missing.keys()) {
            const [type, name] = key.split('.');
            const d = SCHEMA.entities[type].values.find((v) => v.name === name);
            expect(d.default, key).not.toBeNull();
        }
    });

    it('⛓ `rope` is the ONE type declaring <nodes>, and the roster derives it', () => {
        const withNodes = Object.entries(SCHEMA.entities)
            .filter(([, e]) => e.nodes).map(([t]) => t);
        expect(withNodes).toEqual(['rope']);
        const roster = entityRosterFrom(SCHEMA);
        expect(roster.length).toBe(144);
        expect(roster.filter((r) => r.nodes).map((r) => r.type)).toEqual(['rope']);
    });

    it('⛓ the five ROOM-GEOMETRY bosses are all declared, in the `enemies` folder — a '
        + 'literal WITH PROVENANCE, pinned against the schema so a rename reddens', () => {
        for (const name of Object.keys(ROOM_GEOMETRY_BOSSES)) {
            expect(SCHEMA.entities[name], name).toBeTruthy();
            expect(SCHEMA.entities[name].folder, name).toBe('enemies');
        }
        expect(Object.keys(ROOM_GEOMETRY_BOSSES).length).toBe(5);
    });

    it('⛔ `ENTITY_ROSTER` DID NOT WIDEN — the page reads its [0] as the default place '
        + 'type, and `ENTITY_ROSTER_PROCGEN` is the SAME frozen array', () => {
        expect(ENTITY_ROSTER_PROCGEN).toBe(ENTITY_ROSTER);
        expect(ENTITY_ROSTER_TYPES).toEqual(
            ['pushableblock', 'button', 'lock', 'spinner', 'arrowtrap']);
        // …and every one of the five IS in the wide vocabulary, so the narrow list is a
        // SUBSET rather than a second roster.
        for (const t of ENTITY_ROSTER_TYPES) expect(SCHEMA.entities[t], t).toBeTruthy();
    });
});

describe('paint — all 45 columns, and the cliffsides layer', () => {
    it('⛓⛓⛓ BYTE-INERT: a terrain-NAME paint normalizes to exactly slice 11\'s op', () => {
        expect(j(normalizeEdit({ op: 'paint', tx: 3, ty: 4, terrain: 'wall' })))
            .toBe('{"op":"paint","tx":3,"ty":4,"terrain":"wall"}');
        // ⛔ `layer` is ABSENT when it is `tiles`: the op is compared BYTE for BYTE
        // between a payload and a page, so writing the default into every op would
        // make every level generated before this slice disagree with itself.
        expect(j(normalizeEdit({ op: 'paint', tx: 3, ty: 4, terrain: 'wall', layer: 'tiles' })))
            .toBe('{"op":"paint","tx":3,"ty":4,"terrain":"wall"}');
    });

    it('⛓ a COLUMN paint reaches all 45, and the record holds what was asked for', () => {
        const r = emptyLevel({ level: 1 });
        for (const column of [0, 21, 36, 44]) {
            const out = applyEdit(r, { op: 'paint', tx: 4, ty: 4, column });
            expect(tileCellAt(out, 4, 4).column, `column ${column}`).toBe(column);
        }
    });

    it('⚠ THERE IS NO "Unused" COLUMN TO REFUSE — all 45 build a type the JS model '
        + 'transcribes, so the only paint refusal is OUT OF RANGE', () => {
        expect(assertColumnsModelled(MODELLED_TILE_TYPES)).toBe(true);
        expect(() => normalizeEdit({ op: 'paint', tx: 1, ty: 1, column: 45 }))
            .toThrow(/is not a column of the "tiles" layer — that layer has 45 \(0\.\.44\)/);
        expect(() => normalizeEdit({ op: 'paint', tx: 1, ty: 1, column: -1 }))
            .toThrow(/not a column of the "tiles" layer/);
    });

    it('a paint carrying BOTH a name and a column refuses — two spellings of one choice',
        () => {
            expect(() => normalizeEdit({ op: 'paint', tx: 1, ty: 1, terrain: 'wall', column: 3 }))
                .toThrow(/carries a `terrain` NAME and a `column` at once/);
        });

    it('⛓⛓ the cliffsides layer: painted into a room that has NONE creates it, with the '
        + 'tileset the 116 rooms use and AFTER the tiles layer', () => {
        const r = emptyLevel({ level: 1 });
        expect(layerNamed(r, 'cliffsides')).toBeNull();
        const out = applyEdit(r, { op: 'paint', tx: 4, ty: 4, layer: 'cliffsides', column: 2 });
        expect(out.layers.map((l) => l.name)).toEqual(['tiles', 'cliffsides']);
        expect(layerNamed(out, 'cliffsides').set).toBe(LAYER_TILESETS.cliffsides);
        expect(tileCellAt(out, 4, 4, 'cliffsides').column).toBe(2);
        // …and the TILES layer is untouched by a cliffsides paint.
        expect(tileCellAt(out, 4, 4).column).toBe(tileCellAt(r, 4, 4).column);
    });

    it('⛔ a terrain NAME on the cliffsides layer refuses BY NAME — `wall`\'s column is '
        + '3, which would silently paint mask 3 (CliffSideMaskRU)', () => {
        expect(() => normalizeEdit({
            op: 'paint', tx: 1, ty: 1, layer: 'cliffsides', terrain: 'wall',
        })).toThrow(/asked of the "cliffsides" layer/);
    });

    it('the cliffsides column bound is CLIFFSIDE_FRAME_MASKS.length, derived', () => {
        expect(LAYER_COLUMNS.cliffsides).toBe(CLIFFSIDE_FRAME_MASKS.length);
        expect(LAYER_COLUMNS.tiles).toBe(TILE_COLUMN_TO_TYPE.length);
        expect(() => normalizeEdit({
            op: 'paint', tx: 1, ty: 1, layer: 'cliffsides', column: 5,
        })).toThrow(/that layer has 5 \(0\.\.4\)/);
    });

    it('a third layer name refuses — `loadlevel` builds exactly two', () => {
        expect(() => normalizeEdit({ op: 'paint', tx: 1, ty: 1, layer: 'decor', column: 0 }))
            .toThrow(/layer must be one of \[tiles, cliffsides\]/);
    });

    it('⛓ the EDITOR\'s writer ADDS a cell the layer lacks; the GENERATOR\'s replaces only',
        () => {
            // A 3x3 wall block: its centre is a wall with no floor in reach, so the
            // strip drops it — a `shellOf(emptyLevel)` drops NOTHING (every ring wall
            // touches the floor), and a row over that would distinguish nothing.
            const block = [];
            for (let ty = 4; ty <= 6; ty += 1) {
                for (let tx = 4; tx <= 6; tx += 1) block.push({ tx, ty, terrain: 'wall' });
            }
            const dense = withTerrain(emptyLevel({ level: 1 }), block);
            const sparse = shellOf(dense);
            // (0,0) is a corner wall the shell strip keeps; pick a cell it dropped.
            const gone = [];
            for (let ty = 0; ty < dense.height; ty += 1) {
                for (let tx = 0; tx < dense.width; tx += 1) {
                    if (!hasTile(sparse, tx, ty)) gone.push([tx, ty]);
                }
            }
            expect(gone.length, 'the shell must drop something for this row to mean anything')
                .toBeGreaterThan(0);
            const [tx, ty] = gone[0];
            expect(withTerrain(sparse, [{ tx, ty, terrain: 'ground' }]).layers[0].tiles.length)
                .toBe(sparse.layers[0].tiles.length);
            expect(applyEdit(sparse, { op: 'paint', tx, ty, terrain: 'ground' })
                .layers[0].tiles.length).toBe(sparse.layers[0].tiles.length + 1);
        });
});

describe('place — the whole vocabulary, typed', () => {
    it('⛓⛓⛓ BYTE-INERT with NO schema: slice 11\'s place op, unchanged', () => {
        expect(j(normalizeEdit({ op: 'place', tx: 3, ty: 4, type: 'button', attrs: { tset: '0' } })))
            .toBe('{"op":"place","tx":3,"ty":4,"type":"button","attrs":{"tset":"0"}}');
        // …and every one of the five procgen types round-trips its OFFERED attrs
        // through the schema-bearing path unchanged, which is what makes the
        // typed path safe to hand the palette.
        for (const e of ENTITY_ROSTER) {
            expect(j(normalizeEdit({ op: 'place', tx: 1, ty: 1, type: e.type, attrs: e.attrs })),
                e.type)
                .toBe(j(normalizeEdit(
                    { op: 'place', tx: 1, ty: 1, type: e.type, attrs: e.attrs }, { schema: SCHEMA },
                )));
        }
    });

    it('an UNDECLARED attribute refuses BY NAME, and names what the type declares', () => {
        expect(() => normalizeEdit(
            { op: 'place', tx: 1, ty: 1, type: 'button', attrs: { nope: '1' } },
            { schema: SCHEMA },
        )).toThrow(/<button> has no attribute "nope"\. `Shrum\.oep` declares \[tset\]/);
    });

    it('an UNDECLARED TYPE refuses on the schema path — and stays FREE TEXT without one',
        () => {
            expect(() => normalizeEdit(
                { op: 'place', tx: 1, ty: 1, type: 'nope', attrs: {} }, { schema: SCHEMA },
            )).toThrow(/is not one of the 144 entity types/);
            // ⚠ law (b) is untouched: with no schema the world is still the adjudicator.
            expect(normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'nope', attrs: {} }).type)
                .toBe('nope');
        });

    it('min / max / maxChars are enforced from the declaration', () => {
        const at = { op: 'place', tx: 1, ty: 1 };
        expect(() => normalizeEdit({ ...at, type: 'button', attrs: { tset: '101' } },
            { schema: SCHEMA })).toThrow(/above the declared maximum 100/);
        expect(() => normalizeEdit({ ...at, type: 'button', attrs: { tset: '-1' } },
            { schema: SCHEMA })).toThrow(/below the declared minimum 0/);
        expect(() => normalizeEdit({ ...at, type: 'torch', attrs: { c: '0xFFCC0000' } },
            { schema: SCHEMA })).toThrow(/maxChars=8/);
        expect(() => normalizeEdit({ ...at, type: 'button', attrs: { tset: 'x' } },
            { schema: SCHEMA })).toThrow(/declared `integer` and "x" is not a number/);
        expect(() => normalizeEdit({ ...at, type: 'button', attrs: { tset: '1.5' } },
            { schema: SCHEMA })).toThrow(/is not a whole number/);
    });

    it('⛓ a value is COERCED to the text an OEL would hold — {tset: 0} and {tset: "0"} '
        + 'are one payload', () => {
        const a = normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'button', attrs: { tset: 0 } },
            { schema: SCHEMA });
        const b = normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'button', attrs: { tset: '0' } },
            { schema: SCHEMA });
        expect(j(a)).toBe(j(b));
        expect(a.attrs.tset).toBe('0');
        // …and a `number` value keeps its fraction (pull.direction default 0.75).
        expect(normalizeAttrsAgainst(SCHEMA, 'pull', { direction: 0.75 }).direction).toBe('0.75');
    });

    it('⛔ fillDefaults is OFF by default and the 183-instance measurement is why', () => {
        const bare = normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'lock', attrs: {} },
            { schema: SCHEMA });
        expect(bare.attrs).toEqual({});
        const filled = normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'lock', attrs: {} },
            { schema: SCHEMA, fillDefaults: true });
        expect(filled.attrs).toEqual({ tag: '0', tset: '-1' });
        // ⚠ a value with NO declared default stays absent even when filling — three of
        // the 166 have none and inventing a zero would write an author's silence as data.
        const flip = normalizeEdit({ op: 'place', tx: 1, ty: 1, type: 'bonetorch', attrs: {} },
            { schema: SCHEMA, fillDefaults: true });
        expect(Object.keys(flip.attrs)).toEqual(['c']);
        expect(entityDecl(SCHEMA, 'bonetorch').values.find((v) => v.name === 'flip').default)
            .toBeNull();
    });

    it('an `attrs` op is checked against the RECORD\'s entity, not the op\'s', () => {
        const r = applyEdit(emptyLevel({ level: 1 }),
            { op: 'place', tx: 4, ty: 4, type: 'button', attrs: { tset: '0' } });
        expect(() => applyEdit(r, { op: 'attrs', tx: 4, ty: 4, attrs: { tag: '1' } },
            { schema: SCHEMA })).toThrow(/<button> has no attribute "tag"/);
        expect(applyEdit(r, { op: 'attrs', tx: 4, ty: 4, attrs: { tset: 3 } },
            { schema: SCHEMA }).entities[0].attrs).toEqual({ tset: '3' });
    });
});

describe('nodes — the rope\'s node list, as an op', () => {
    const roped = (record) => applyEdit(record,
        { op: 'place', tx: 4, ty: 4, type: 'rope', attrs: {} });

    it('⛓ REPLACES the cell\'s last entity\'s node list', () => {
        const r = roped(emptyLevel({ level: 1 }));
        const out = applyEdit(r, { op: 'nodes', tx: 4, ty: 4, nodes: [{ x: 96, y: 64 }] });
        expect(out.entities[0].nodes).toEqual([{ x: 96, y: 64 }]);
        expect(r.entities[0].nodes).toBeUndefined();
    });

    it('⚠ an EMPTY list REMOVES the field — `nodes: []` is a shape the round trip cannot '
        + 'preserve (the writer emits a self-closing element)', () => {
        const r = applyEdit(roped(emptyLevel({ level: 1 })),
            { op: 'nodes', tx: 4, ty: 4, nodes: [{ x: 96, y: 64 }] });
        const out = applyEdit(r, { op: 'nodes', tx: 4, ty: 4, nodes: [] });
        expect('nodes' in out.entities[0]).toBe(false);
    });

    it('⛔ refused for a type the schema says has no <nodes>', () => {
        const r = applyEdit(emptyLevel({ level: 1 }),
            { op: 'place', tx: 4, ty: 4, type: 'button', attrs: { tset: '0' } });
        expect(() => applyEdit(r, { op: 'nodes', tx: 4, ty: 4, nodes: [{ x: 1, y: 1 }] },
            { schema: SCHEMA })).toThrow(/does not declare <nodes>/);
        // …and a `place` carrying one is refused at normalisation, before any record.
        expect(() => normalizeEdit({
            op: 'place', tx: 1, ty: 1, type: 'button', attrs: {}, nodes: [{ x: 1, y: 1 }],
        }, { schema: SCHEMA })).toThrow(/does not declare <nodes>/);
    });

    it('a node is {x, y} in OEL PIXELS, refusing anything else', () => {
        expect(() => normalizeEdit({ op: 'nodes', tx: 1, ty: 1, nodes: [{ x: 1 }] }))
            .toThrow(/a node is `\{x, y\}` in OEL PIXELS/);
        expect(() => normalizeEdit({ op: 'nodes', tx: 1, ty: 1, nodes: 'x' }))
            .toThrow(/needs an array of \{x, y\}/);
    });

    it('a nodes op on a cell with no entity refuses, like every other cell-subject op',
        () => {
            expect(() => applyEdit(emptyLevel({ level: 1 }),
                { op: 'nodes', tx: 4, ty: 4, nodes: [] })).toThrow(/which holds no entity/);
        });
});

describe('resize — ⚖ ruling 5', () => {
    it('⛓ the ROOM op carries no cell, and its canonical form names the anchor', () => {
        expect(j(normalizeEdit({ op: 'resize', width: 12, height: 14 })))
            .toBe('{"op":"resize","width":12,"height":14,"anchor":"top-left"}');
        expect(() => normalizeEdit({ op: 'resize', width: 12, height: 14, anchor: 'centre' }))
            .toThrow(/anchor must be one of \[top-left\]/);
    });

    it('GROW adds cells with NO tile', () => {
        const r = emptyLevel({ level: 1 });
        const out = applyEdit(r, { op: 'resize', width: 14, height: 12 });
        expect([out.width, out.height]).toEqual([14, 12]);
        expect(out.layers[0].tiles.length).toBe(r.layers[0].tiles.length);
        expect(hasTile(out, 12, 11)).toBe(false);
    });

    it('⛔ CROP REFUSES a dropped cell that holds a tile or an entity, BY NAME', () => {
        const r = emptyLevel({ level: 1 });
        expect(() => applyEdit(r, { op: 'resize', width: 5, height: 5 }))
            .toThrow(/would drop \d+ tile\(s\) and 0 entity\(ies\)/);
        // …and the identity resize is not a refusal.
        expect(resizeRoom(r, { width: 10, height: 10 })).toBe(r);
    });

    it('⛔ crop names the ENTITY when only an entity is in the way', () => {
        // A room whose tiles all fit, holding one body that does not.
        const r = emptyLevel({ level: 1 });
        const stripped = {
            ...r,
            layers: r.layers.map((l) => ({ ...l, tiles: l.tiles.filter(([tx, ty]) => tx < 5 && ty < 5) })),
            entities: [{ type: 'button', ...oelAtTile(7, 7), attrs: { tset: '0' } }],
        };
        expect(() => resizeRoom(stripped, { width: 5, height: 5 }))
            .toThrow(/0 tile\(s\) and 1 entity\(ies\).*button@112,112/s);
    });

    it('the ROOM SIZE bounds still hold', () => {
        const r = emptyLevel({ level: 1 });
        expect(() => applyEdit(r, { op: 'resize', width: 61, height: 10 }))
            .toThrow(/outside \[3\.\.60\]/);
        expect(() => applyEdit(r, { op: 'resize', width: 2, height: 10 }))
            .toThrow(/outside \[3\.\.60\]/);
    });

    it('⚖ ruling 5 — the readout WARNS about the five compiled-in boss geometries, and '
        + 'never refuses', () => {
        const r = applyEdit(emptyLevel({ level: 1, width: 20, height: 20 }),
            { op: 'place', tx: 4, ty: 4, type: 'bosstotem', attrs: { tag: '0' } });
        const w = resizeWarnings(r, { op: 'resize', width: 24, height: 24 });
        expect(w.join(' ')).toMatch(/<bosstotem>.*COMPILED IN/s);
        expect(w.join(' ')).toMatch(/BossTotemShot\.roomBottom/);
        expect(w.join(' ')).toMatch(/hold NO TILE/);
        // ⛔ a warning, not a refusal: the op still applies.
        expect(applyEdit(r, { op: 'resize', width: 24, height: 24 }).width).toBe(24);
        // …and a room without one warns about neither boss nor growth on a shrink.
        expect(resizeWarnings(emptyLevel({ level: 1 }), { op: 'resize', width: 10, height: 10 }))
            .toEqual([]);
    });

    it('a resize to the SAME size is the identity — the fold\'s no-op rule reports it, '
        + 'not a refusal here', () => {
        const r = emptyLevel({ level: 1 });
        expect(applyEdit(r, { op: 'resize', width: r.width, height: r.height })).toBe(r);
        expect(editState({ record: r, edits: [] },
            { op: 'resize', width: r.width, height: r.height }).edits).toEqual([]);
    });
});

describe('group — the two folds agree on ONE payload', () => {
    const STROKE = {
        op: 'group',
        label: 'stroke 3',
        ops: [
            { op: 'paint', tx: 2, ty: 2, terrain: 'wall' },
            { op: 'paint', tx: 3, ty: 2, column: 9 },
            { op: 'place', tx: 4, ty: 4, type: 'button', attrs: { tset: '0' } },
        ],
    };

    it('⛓⛓ `applyEdits` folds a group, and the result is the members applied in order',
        () => {
            const r = emptyLevel({ level: 1 });
            expect(j(applyEdits(r, [STROKE]))).toBe(j(applyEdits(r, STROKE.ops)));
        });

    it('⛔ a NESTED group refuses — `editCore` refuses the same shape, and one fold '
        + 'accepting what the other refuses is the disagreement this arm prevents', () => {
        expect(() => applyEdits(emptyLevel({ level: 1 }),
            [{ op: 'group', label: 'outer', ops: [STROKE] }])).toThrow(/NESTED/);
    });

    it('⛔ ALL-OR-NOTHING: a refusing member leaves the record untouched', () => {
        const r = emptyLevel({ level: 1 });
        const bad = { op: 'group', label: 'x', ops: [STROKE.ops[0], { op: 'remove', tx: 9, ty: 9 }] };
        expect(() => applyEdits(r, [bad])).toThrow(/holds no entity/);
        expect(j(r)).toBe(j(emptyLevel({ level: 1 })));
    });

    it('an EMPTY group refuses, and `describeEdit` has a row for a group', () => {
        expect(() => applyEdits(emptyLevel({ level: 1 }), [{ op: 'group', label: 'x', ops: [] }]))
            .toThrow(/carries no ops/);
        expect(describeEdit(normalizeGroupOrEdit(STROKE))).toBe('EDIT group "stroke 3" (3 op(s))');
    });

    it('⛓ a group\'s MEMBERS are canonicalised too — the byte comparison is over the '
        + 'whole list', () => {
        const messy = { op: 'group', label: 'x', ops: [{ ty: 2, tx: 2, op: 'paint', terrain: 'wall' }] };
        expect(j(normalizeGroupOrEdit(messy)))
            .toBe('{"op":"group","label":"x","ops":[{"op":"paint","tx":2,"ty":2,"terrain":"wall"}]}');
    });

    it('⛓ a group rides in a STATE\'s edit list as one entry, and UNDO pops the whole '
        + 'stroke', () => {
        const r = emptyLevel({ level: 1 });
        const s = editState({ record: r, edits: [] }, STROKE);
        expect(s.edits.length).toBe(1);
        expect(j(undoEdit(s).record)).toBe(j(r));
    });
});

describe('the tile-layer facts this slice DERIVES, pinned against the 116', () => {
    it('⛓ every `tiles` layer carries set="tileset" and every `cliffsides` layer '
        + 'set="cliffsidesset" — LAYER_TILESETS is a literal these rows own', () => {
        const seen = {};
        for (const level of ATLAS.levels) {
            for (const layer of level.layers) {
                (seen[layer.name] ??= new Set()).add(layer.set);
            }
        }
        expect([...seen.tiles]).toEqual([LAYER_TILESETS.tiles]);
        expect([...seen.cliffsides]).toEqual([LAYER_TILESETS.cliffsides]);
        // …and both names are declared in the `.oep`'s <tilesets>.
        const declared = SCHEMA.tilesets.map((t) => t.name);
        expect(declared).toContain(LAYER_TILESETS.tiles);
        expect(declared).toContain(LAYER_TILESETS.cliffsides);
        expect(Object.keys(seen).sort()).toEqual(['cliffsides', 'tiles']);
    });

    it('⛓ `tiles` first, `cliffsides` second — the order every vanilla room writes', () => {
        const orders = new Set(ATLAS.levels.map((l) => l.layers.map((x) => x.name).join('+')));
        expect([...orders].sort()).toEqual(['tiles', 'tiles+cliffsides']);
        expect(ATLAS.levels.filter((l) => l.layers.length === 2).length).toBe(16);
    });

    it('⛓ the schema\'s <layers> and the record\'s tile layers agree on the two names', () => {
        expect(SCHEMA.layers.filter((l) => l.kind === 'tiles').map((l) => l.name))
            .toEqual(TILE_LAYERS);
    });
});
