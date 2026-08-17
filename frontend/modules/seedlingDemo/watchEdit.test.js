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
    EDIT_OPS, ENTITY_ROSTER, ENTITY_ROSTER_TYPES, WatchEditError, applyEdit, applyEdits,
    describeEdit, editState, editStates, entityIndexAt, normalizeEdit, undoEdit,
} from './watchEdit.js';
import { TERRAIN_NAMES, oelAtTile, terrainAt, tileAtOel } from './procgenLevel.js';
import { ENTITY_CLASSES, buildLevelWorld, LevelWorldError } from './levelWorld.js';
import { generateStep, generateWithDirectives } from './watchGenerate.js';
import { atlasOf } from './procgenLevel.js';
import { levelSourceFromAtlas } from './atlasSource.js';

const SUBJECT = { seed: 3, biome: 'pre-sword' };
const skeleton = () => generateStep({ ...SUBJECT, step: 0 });
const ladder = (step = 2) => generateStep({ ...SUBJECT, step });
const j = (v) => JSON.stringify(v);

describe('the op set — closed, and normalized before anything is applied', () => {
    it('the four ops ARE the set every reader shares', () => {
        expect(EDIT_OPS).toEqual(['paint', 'place', 'attrs', 'remove']);
        expect(Object.isFrozen(EDIT_OPS)).toBe(true);
    });

    it('a fifth op refuses BY NAME and names the four', () => {
        expect(() => normalizeEdit({ op: 'nudge', tx: 1, ty: 1 }))
            .toThrow(/is not one of the four edit ops \[paint, place, attrs, remove\]/);
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
    const OPS = [
        { op: 'paint', tx: 5, ty: 5, terrain: 'wall' },
        { op: 'place', tx: 4, ty: 6, type: 'pushableblock', attrs: {} },
        { op: 'paint', tx: 6, ty: 6, terrain: 'water' },
        { op: 'attrs', tx: 4, ty: 6, attrs: { tset: '2' } },
    ];

    it('applyEdits folds in ORDER, and the order matters', () => {
        const base = skeleton().record;
        const forward = applyEdits(base, [OPS[0], OPS[2]]);
        const reversed = applyEdits(base, [OPS[2], OPS[0]]);
        expect(terrainAt(forward, 5, 5)).toBe('wall');
        expect(terrainAt(forward, 6, 6)).toBe('water');
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
        };
        for (const op of EDIT_OPS) {
            expect(describeEdit(normalizeEdit(samples[op])), op).toMatch(/^EDIT /);
        }
    });
});
