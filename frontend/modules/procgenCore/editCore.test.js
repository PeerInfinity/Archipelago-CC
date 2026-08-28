/**
 * ⛓⛓⛓ **THE EDIT CORE, AGAINST A TOY SUBSTRATE THAT DOES NOT EXIST.**
 *
 * EDITOR v3 arc, slice A1 (`NewDocs/plans/seedling-editor-v3.md` §7.2). ⛔ THE
 * TOY IS THE POINT: a core proven only against the maze would be a maze editor
 * with an extra indirection, and the day Seedling's adapter arrived (slice B)
 * the parts that had quietly grown maze vocabulary would be found one by one.
 * So this file imports NOTHING from `mazeRoom/` or `seedlingDemo/` — and the
 * last describe block asserts that by reading its own source, because a comment
 * saying so is not a gate (trap 580's family: a scan that reads its own
 * fixtures allowlists them, so the subject here is the file itself).
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT — the change to `editCore.js` that would make
 * the row go RED. A row with no such mutant is a row that would pass over a
 * broken core.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    ADAPTER_MEMBERS,
    CELL_SPACE_LAWS,
    CELL_SPACE_MEMBERS,
    EditCoreError,
    applyOne,
    assertAdapter,
    assertAdapterBehaviour,
    canonicalJson,
    createEditSession,
    describeOps,
    descriptorFieldsOf,
    floodOps,
    foldEdits,
    group,
    hasCellSpace,
    rectCopy,
    rectPasteOps,
} from './editCore.js';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE TOY SUBSTRATE — a dozen lines, and every word of its vocabulary is
 *   its own. It is not a small maze and it is not a small Seedling room.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * A `w × h` grid of `{tile: 'a'|'b', entity: null | {kind}}`.
 *
 * Two atomic ops — `setTile` and `setEntity` — and ONE refusal that is the
 * toy's own legality rule rather than the core's: **an entity may not stand on
 * a `'b'` tile**. It exists so the group's all-or-nothing claim has something
 * real to refuse on, and so `apply`'s `ok:false` arm is exercised by a
 * substrate rule and not by a shape check.
 */
const TILES = Object.freeze(['a', 'b']);

const toyWorld = (w, h, fill = 'a') => Object.freeze({
    w,
    h,
    cells: Object.freeze(Array.from({ length: w * h }, () => Object.freeze({
        tile: fill, entity: null,
    }))),
});

const at = (rec, x, y) => rec.cells[x + y * rec.w];

const withCell = (rec, x, y, cell) => Object.freeze({
    ...rec,
    cells: Object.freeze(rec.cells.map((c, i) => (i === x + y * rec.w ? Object.freeze(cell) : c))),
});

const toyAdapter = Object.freeze({
    name: 'toy',
    apply(record, op) {
        if (!op || !['setTile', 'setEntity'].includes(op.op)) {
            return { ok: false, description: `toy: unknown op ${JSON.stringify(op?.op)}.` };
        }
        const { x, y } = op;
        if (!(x >= 0 && y >= 0 && x < record.w && y < record.h)) {
            return { ok: false, description: `toy: (${x},${y}) is off the grid.` };
        }
        const cell = at(record, x, y);
        if (op.op === 'setTile') {
            if (!TILES.includes(op.tile)) {
                return { ok: false, description: `toy: no tile ${JSON.stringify(op.tile)}.` };
            }
            return {
                ok: true,
                op: { op: 'setTile', x, y, tile: op.tile },
                description: `tile (${x},${y}) → ${op.tile}`,
                record: withCell(record, x, y, { ...cell, tile: op.tile }),
            };
        }
        // ⛓ THE TOY'S OWN LEGALITY RULE — an entity may not stand on a 'b'.
        // ⛓⛓ EDITOR v3 E6a — and it names its refusal CLASS in `reason`, which
        //    is what a real substrate does (`SeedlingSetDeriveRefusal`). ⛔ The
        //    toy's OTHER refusals give none, so every row below separates "the
        //    core carried the substrate's class" from "the core invented one".
        if (op.entity && cell.tile === 'b') {
            return {
                ok: false,
                reason: 'toy-rule',
                description: `toy: (${x},${y}) is a 'b' tile and nothing stands on a 'b'.`,
            };
        }
        return {
            ok: true,
            op: { op: 'setEntity', x, y, entity: op.entity ? { kind: op.entity.kind } : null },
            description: `entity (${x},${y}) → ${op.entity ? op.entity.kind : 'none'}`,
            record: withCell(record, x, y, {
                ...cell, entity: op.entity ? Object.freeze({ kind: op.entity.kind }) : null,
            }),
        };
    },
    equal: (a, b) => canonicalJson(a) === canonicalJson(b),
    bounds: (record) => ({ w: record.w, h: record.h }),
    readCell: (record, x, y) => {
        const c = at(record, x, y);
        return { tile: c.tile, entity: c.entity ? { kind: c.entity.kind } : null };
    },
    /**
     * ⛓ THE INVERSE OF `readCell`, and it emits ops only for the fields the
     * descriptor PRESENTS — which is what makes the core's `tilesOnly` /
     * `entitiesOnly` a filter on the descriptor rather than a second op set.
     */
    writeOps: (desc, x, y) => {
        const out = [];
        if (Object.prototype.hasOwnProperty.call(desc, 'tile')) {
            out.push({ op: 'setTile', x, y, tile: desc.tile });
        }
        if (Object.prototype.hasOwnProperty.call(desc, 'entity')) {
            out.push({ op: 'setEntity', x, y, entity: desc.entity });
        }
        return out;
    },
});

const tileOp = (x, y, tile) => ({ op: 'setTile', x, y, tile });
const entOp = (x, y, kind) => ({ op: 'setEntity', x, y, entity: kind ? { kind } : null });

/* ══════════════════════════════════════════════════════════════════════
 * THE FOLD
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ foldEdits — the ONE reconstruction', () => {
    /**
     * ⛓ MUTANT: a fold that SKIPS op #2 (`if (i === 1) return;` in the
     * `forEach`) — the record then holds `'a'` at (1,0) and the row goes RED on
     * both the record comparison and the `applied` length.
     */
    it('base → ops in order → the record, and a fold that skipped one would differ', () => {
        const base = toyWorld(4, 3);
        const ops = [tileOp(0, 0, 'b'), tileOp(1, 0, 'b'), entOp(2, 0, 'rock')];
        const out = foldEdits(toyAdapter, base, ops);
        expect(out.applied).toHaveLength(3);
        expect(toyAdapter.readCell(out.record, 0, 0)).toEqual({ tile: 'b', entity: null });
        expect(toyAdapter.readCell(out.record, 1, 0)).toEqual({ tile: 'b', entity: null });
        expect(toyAdapter.readCell(out.record, 2, 0)).toEqual({ tile: 'a', entity: { kind: 'rock' } });
        // ⛔ the BASE is untouched — the fold never mutates its input.
        expect(toyAdapter.readCell(base, 0, 0)).toEqual({ tile: 'a', entity: null });
    });

    /**
     * ⛓ MUTANT: drop the `adapter.equal` guard in `foldEdits` — the no-op then
     * lands in `applied` and `dropped` is empty. ⚖ Law (b), trap 263.
     */
    it('a NO-OP is dropped from `applied` and REPORTED in `dropped`', () => {
        const base = toyWorld(3, 3);
        const out = foldEdits(toyAdapter, base, [
            tileOp(0, 0, 'b'),
            tileOp(0, 0, 'b'), // ⛓ already 'b' — legal, ok:true, and moves no bytes
            tileOp(1, 1, 'b'),
        ]);
        expect(out.applied).toHaveLength(2);
        expect(out.dropped).toHaveLength(1);
        expect(out.dropped[0].index).toBe(1);
        expect(out.dropped[0].op).toMatchObject({ op: 'setTile', x: 0, y: 0 });
    });

    /**
     * ⛓ MUTANT: turn the `fail(...)` in `foldEdits` into a `return` (a SKIP) —
     * the throw never happens and the row goes RED. ⚠ The maze's own law: a
     * fold that skipped an edit would report a level difference three lines up.
     */
    it('a REFUSED op THROWS naming the INDEX and quoting the adapter', () => {
        const base = foldEdits(toyAdapter, toyWorld(3, 3), [tileOp(1, 1, 'b')]).record;
        let err = null;
        try {
            foldEdits(toyAdapter, base, [tileOp(0, 0, 'b'), entOp(1, 1, 'rock')]);
        } catch (e) { err = e; }
        expect(err).toBeInstanceOf(EditCoreError);
        expect(err.message).toContain('op #2');
        expect(err.message).toContain("nothing stands on a 'b'");
        expect(err.message).toContain('toy');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE SESSION
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ createEditSession — identity is base + ops', () => {
    /**
     * ⛓⛓ THE AGREEMENT CLAIM: after ANY sequence, re-folding the session's own
     * op list from the base reproduces the session's record.
     *
     * ⛓ MUTANT: make `apply` record the op it was HANDED rather than the
     * adapter's RESOLVED op (`ops = [...ops, op]`) — still green here, because
     * the toy's resolution is an identity; the maze adapter's `setButton index`
     * row is where that mutant dies, and it is named there. What DOES kill this
     * row is a session that mutates `record` outside the fold (e.g. an `apply`
     * that writes the record but forgets to append the op).
     */
    it('fold(base, session.ops()) === session.record(), after a mixed sequence', () => {
        const base = toyWorld(5, 4);
        const s = createEditSession(toyAdapter, base, { base: { kind: 'toy', n: 1 } });
        s.apply(tileOp(0, 0, 'b'));
        s.apply(entOp(1, 1, 'rock'));
        s.apply(group('stroke', [tileOp(2, 2, 'b'), tileOp(3, 2, 'b')]));
        s.apply(entOp(1, 1, null));
        expect(s.ops()).toHaveLength(4);
        const re = foldEdits(toyAdapter, base, s.ops());
        expect(canonicalJson(re.record)).toBe(canonicalJson(s.record()));
        expect(re.dropped).toHaveLength(0);
    });

    /**
     * ⛓ MUTANT: replace the fold in `undo()` with a stack pop of the previous
     * record. The row stays green for a single undo — which is exactly why it
     * undoes a GROUP: a pop restores one record, the fold rebuilds from the
     * base, and the two only agree if nothing else ever wrote the record. What
     * kills the mutant outright is deleting `refold()` (undo then changes
     * nothing) or folding the FULL list (undo becomes a no-op).
     */
    it('UNDO is the fold over a SHORTER list — and a GROUP goes back whole', () => {
        const base = toyWorld(4, 4);
        const s = createEditSession(toyAdapter, base);
        s.apply(tileOp(0, 0, 'b'));
        const afterOne = canonicalJson(s.record());
        s.apply(group('fill', [tileOp(1, 0, 'b'), tileOp(2, 0, 'b'), tileOp(3, 0, 'b')]));
        expect(s.ops()).toHaveLength(2);
        expect(s.undo()).toBe(true);
        expect(s.ops()).toHaveLength(1);
        expect(canonicalJson(s.record())).toBe(afterOne);
        expect(s.undo()).toBe(true);
        expect(canonicalJson(s.record())).toBe(canonicalJson(base));
        // ⚠ at zero ops undo changes nothing and says so
        expect(s.undo()).toBe(false);
        expect(canonicalJson(s.record())).toBe(canonicalJson(base));
    });

    /**
     * ⛓ MUTANT: drop the `adapter.equal` guard in `session.apply` — the no-op
     * click then appends an op AND drops the certification, which is trap 263
     * in its original habitat.
     */
    it('a no-op click is not an edit — the list does not grow and certification stands', () => {
        const s = createEditSession(toyAdapter, toyWorld(3, 3));
        s.apply(tileOp(0, 0, 'b'));
        s.setCertified(true);
        const res = s.apply(tileOp(0, 0, 'b'));
        expect(res).toMatchObject({ ok: true, applied: false });
        expect(s.ops()).toHaveLength(1);
        expect(s.certified).toBe(true);
    });

    /**
     * ⛓ MUTANT: move the `cert = null` in `apply` above the `equal` guard, or
     * delete it from `undo()`. Either half of this row then goes RED.
     */
    it('`certified` is a tri-state that resets to null on APPLY and on UNDO', () => {
        const s = createEditSession(toyAdapter, toyWorld(3, 3));
        expect(s.certified).toBe(null);
        s.setCertified(true);
        s.apply(tileOp(0, 0, 'b'));
        expect(s.certified).toBe(null);
        s.setCertified(false); // ⛓ THE ONE `false` SITE — an oracle verdict
        expect(s.certified).toBe(false);
        s.undo();
        expect(s.certified).toBe(null);
        expect(() => s.setCertified('no')).toThrow(/true, false or null/);
    });

    /**
     * ⛓ MUTANT: have `payload()` interpret `base` (e.g. spread it, or replace
     * it with the base RECORD). The identity check on the returned object then
     * fails — the core must hand back the caller's own value.
     */
    it('a refusal moves nothing, and `payload()` carries the caller\'s opaque base verbatim', () => {
        const tag = { kind: 'atlas', set_id: 'toy-0000', level: 14 };
        const s = createEditSession(toyAdapter, toyWorld(3, 3), { base: tag });
        s.apply(tileOp(0, 0, 'b'));
        const before = canonicalJson(s.record());
        const res = s.apply(entOp(0, 0, 'rock')); // ⛓ refused by the toy's own rule
        expect(res.ok).toBe(false);
        expect(res.description).toContain("nothing stands on a 'b'");
        expect(s.ops()).toHaveLength(1);
        expect(canonicalJson(s.record())).toBe(before);
        expect(s.payload().base).toBe(tag);
        expect(s.payload().edits).toBe(s.ops());
        expect(s.payload().certified).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE GROUP
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ group — atomic, one undo, flat', () => {
    /**
     * ⛓ MUTANT: commit each member onto the caller's record as it succeeds
     * (`record = res.record` inside the member loop of `applyOne`). Members 1
     * and 2 then survive the group's refusal and the row goes RED on the (0,0)
     * cell.
     */
    it('ATOMICITY — member #3 refused ⇒ the record and the op list are UNCHANGED', () => {
        const base = foldEdits(toyAdapter, toyWorld(4, 4), [tileOp(2, 2, 'b')]).record;
        const s = createEditSession(toyAdapter, base);
        const res = s.apply(group('stroke', [
            tileOp(0, 0, 'b'),
            tileOp(1, 0, 'b'),
            entOp(2, 2, 'rock'), // ⛓ (2,2) is 'b' — the toy refuses
            tileOp(3, 0, 'b'),
        ]));
        expect(res.ok).toBe(false);
        expect(res.description).toContain('member #3');
        expect(res.description).toContain('WHOLE group is refused');
        expect(s.ops()).toHaveLength(0);
        expect(canonicalJson(s.record())).toBe(canonicalJson(base));
    });

    /**
     * ⛓ MUTANT: delete the `depth > 0` arm of `applyOne` — the nested group
     * then applies and the row goes RED.
     */
    it('a NESTED group is refused BY NAME — a stroke is flat', () => {
        const s = createEditSession(toyAdapter, toyWorld(4, 4));
        const res = s.apply(group('outer', [
            tileOp(0, 0, 'b'),
            group('inner', [tileOp(1, 0, 'b')]),
        ]));
        expect(res.ok).toBe(false);
        expect(res.description).toContain('NESTED group');
        expect(res.description).toContain('"inner"');
        expect(s.ops()).toHaveLength(0);
    });

    /**
     * ⛓ MUTANT: ask `adapter.equal` of each MEMBER instead of the group's whole
     * effect — the all-no-op group then reports two applied members and the op
     * list grows.
     */
    it('a group whose members are ALL no-ops is a no-op', () => {
        const base = foldEdits(toyAdapter, toyWorld(3, 3), [tileOp(0, 0, 'b'), tileOp(1, 0, 'b')]).record;
        const s = createEditSession(toyAdapter, base);
        const res = s.apply(group('repaint', [tileOp(0, 0, 'b'), tileOp(1, 0, 'b')]));
        expect(res).toMatchObject({ ok: true, applied: false });
        expect(s.ops()).toHaveLength(0);
    });

    /** ⛓ MUTANT: allow an empty `ops` array in `group()` — the throw vanishes. */
    it('an EMPTY group is refused at construction, not folded to a no-op', () => {
        expect(() => group('nothing', [])).toThrow(/EMPTY group is refused/);
        expect(() => group('', [tileOp(0, 0, 'b')])).toThrow(/non-empty label/);
    });

    /**
     * ⛓ MUTANT: count a group's MEMBERS in `describeOps` (`sizes` summed into
     * the head) — the head then says "14 edit(s)" for a list of 3.
     */
    it('describeOps counts TOP-LEVEL ops and puts the group sizes in the parenthesis', () => {
        expect(describeOps([])).toBe('0 edit(s)');
        expect(describeOps([tileOp(0, 0, 'b')])).toBe('1 edit(s)');
        const twelve = Array.from({ length: 12 }, (_, i) => tileOp(i % 4, 0, 'b'));
        expect(describeOps([tileOp(0, 0, 'b'), group('fill', twelve), tileOp(1, 1, 'b')]))
            .toBe('3 edit(s) (1 group of 12)');
        expect(describeOps([group('a', twelve), group('b', [tileOp(0, 0, 'b')])]))
            .toBe('2 edit(s) (2 groups of 12, 1)');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * RECT COPY / PASTE
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ EDITOR v3 E6a — the substrate\'s refusal CLASS survives the session', () => {
    /**
     * ⛔ **A PAGE THAT WANTS TO BRANCH ON THE REFUSAL CLASS COULD NOT**
     * (§33.12 #1, §33.13). The adapter's `reason` died at the session's refusal
     * arm, so every caller that needed the class had to match `description`
     * text — the one channel the core promises never to paraphrase.
     *
     * ⛓ The field is OPTIONAL and the core NEVER INVENTS ONE: the two rows here
     * drive a refusal that HAS a class and one that does not, and assert
     * `'reason' in res` both ways. A version that defaulted `reason` to
     * something would pass the first row and fail the second.
     */
    it('a refusal with a `reason` carries it; one without has no `reason` KEY at all', () => {
        const s = createEditSession(toyAdapter, toyWorld(3, 3));
        expect(s.apply(tileOp(0, 0, 'b')).applied).toBe(true);
        const refused = s.apply(entOp(0, 0, 'rock'));
        expect(refused.ok).toBe(false);
        expect(refused.reason).toBe('toy-rule');
        // ⛔ and a refusal the toy gives no class for stays classless
        const shapeless = s.apply({ op: 'nope' });
        expect(shapeless.ok).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(shapeless, 'reason')).toBe(false);
    });

    /**
     * ⛓⛓ **THROUGH A GROUP IT IS THE MEMBER'S CLASS**, because the group's
     * refusal IS the member's — the group adds no class of its own, and a page
     * that branches should see what it would have seen had the member been
     * applied alone.
     */
    it('a group refused by a member carries THAT member\'s reason, and the description still nests', () => {
        const s = createEditSession(toyAdapter, toyWorld(3, 3));
        expect(s.apply(tileOp(1, 1, 'b')).applied).toBe(true);
        const res = s.apply(group('stroke', [tileOp(0, 0, 'a'), entOp(1, 1, 'rock')]));
        expect(res.ok).toBe(false);
        expect(res.reason).toBe('toy-rule');
        expect(res.description).toMatch(/member #2 of group "stroke"/);
        // ⛓ …and the all-or-nothing law is untouched: member #1 did not land.
        expect(s.record().cells[0].tile).toBe('a');
        expect(s.ops()).toHaveLength(1);
    });

    /** ⛔ `applyOne` itself — the layer the session reads — carries it too, so
     *  the field is not something only the session knows about. */
    it('applyOne carries the reason for a bare op and for a group', () => {
        const rec = toyAdapter.apply(toyWorld(2, 2), tileOp(0, 0, 'b')).record;
        expect(applyOne(toyAdapter, rec, entOp(0, 0, 'rock')).reason).toBe('toy-rule');
        expect(applyOne(toyAdapter, rec, group('g', [entOp(0, 0, 'rock')])).reason)
            .toBe('toy-rule');
    });
});

describe('⛓ rectCopy / rectPasteOps', () => {
    const gadgetWorld = () => foldEdits(toyAdapter, toyWorld(8, 6), [
        tileOp(1, 1, 'b'), tileOp(2, 1, 'b'), entOp(1, 2, 'rock'), entOp(3, 3, 'coin'),
    ]).record;

    /**
     * ⛓ MUTANT: transpose the paste (`writeOps(desc, x + dy, y + dx)`) — the
     * destination region then differs from the source on any non-square
     * content and the row goes RED.
     */
    it('a 3x3 region copied and pasted elsewhere reproduces it cell for cell', () => {
        const rec = gadgetWorld();
        const clip = rectCopy(toyAdapter, rec, { x: 1, y: 1, w: 3, h: 3 });
        expect(clip.w).toBe(3);
        expect(clip.cells[0][0]).toEqual({ tile: 'b', entity: null });
        const s = createEditSession(toyAdapter, rec);
        expect(s.apply(rectPasteOps(toyAdapter, rec, clip, 5, 2))).toMatchObject({ ok: true, applied: true });
        for (let dy = 0; dy < 3; dy += 1) {
            for (let dx = 0; dx < 3; dx += 1) {
                expect(toyAdapter.readCell(s.record(), 5 + dx, 2 + dy))
                    .toEqual(clip.cells[dy][dx]);
            }
        }
        // ⛓ ONE op in the list — a paste is one undo
        expect(s.ops()).toHaveLength(1);
        expect(describeOps(s.ops())).toBe('1 edit(s) (1 group of 18)');
    });

    /**
     * ⛓ MUTANT: drop the bounds test in `rectPasteOps`' inner loop — `writeOps`
     * is then called off-grid, the adapter refuses inside the group, and the
     * whole paste dies instead of clipping. The row goes RED on `ok`.
     */
    it('a paste at the EDGE is CLIPPED — the on-grid part lands, the rest is dropped', () => {
        const rec = gadgetWorld();
        const clip = rectCopy(toyAdapter, rec, { x: 1, y: 1, w: 3, h: 3 });
        const s = createEditSession(toyAdapter, rec);
        const g = rectPasteOps(toyAdapter, rec, clip, 6, 4);
        // ⛓ 2 columns x 2 rows survive on an 8x6 grid → 4 cells → 8 ops
        expect(g.ops).toHaveLength(8);
        expect(s.apply(g)).toMatchObject({ ok: true, applied: true });
        expect(toyAdapter.readCell(s.record(), 6, 4)).toEqual(clip.cells[0][0]);
        expect(toyAdapter.readCell(s.record(), 7, 5)).toEqual(clip.cells[1][1]);
    });

    /** ⛓ MUTANT: clip `rectCopy` instead of refusing — the throw vanishes. */
    it('rectCopy REFUSES an out-of-bounds rectangle rather than clipping it', () => {
        const rec = gadgetWorld();
        expect(() => rectCopy(toyAdapter, rec, { x: 6, y: 4, w: 4, h: 4 }))
            .toThrow(/runs off the 8x6 toy grid/);
        expect(() => rectCopy(toyAdapter, rec, { x: 0, y: 0, w: 0, h: 2 }))
            .toThrow(/w must be a positive integer/);
    });

    /**
     * ⛓ MUTANT: make `filterDescriptor` return `desc` unchanged when the field
     * is missing (the "ignore the flag" mutant) — the tilesOnly paste then
     * writes the entities too and the (5,2) entity row goes RED. ⚠ trap 594's
     * family: a flag you do not implement must be REFUSED, not dropped.
     */
    it('tilesOnly / entitiesOnly are a filter on the DESCRIPTOR, and each writes only its half', () => {
        const rec = gadgetWorld();
        const clip = rectCopy(toyAdapter, rec, { x: 1, y: 1, w: 2, h: 2 });
        const tiles = rectPasteOps(toyAdapter, rec, clip, 5, 2, { tilesOnly: true });
        expect(tiles.ops.every((o) => o.op === 'setTile')).toBe(true);
        const ents = rectPasteOps(toyAdapter, rec, clip, 5, 2, { entitiesOnly: true });
        expect(ents.ops.every((o) => o.op === 'setEntity')).toBe(true);
        expect(() => rectPasteOps(toyAdapter, rec, clip, 5, 2, {
            tilesOnly: true, entitiesOnly: true,
        })).toThrow(/two filters that cancel/);
    });

    /**
     * ⛓ MUTANT: as above — with the filter IGNORED this row goes green-to-red,
     * because a substrate whose descriptor has no `tile` would silently accept
     * a tiles-only paste.
     */
    it('a filter a substrate cannot express is REFUSED BY NAME, not ignored', () => {
        const flat = Object.freeze({
            ...toyAdapter,
            name: 'flat',
            readCell: (record, x, y) => ({ colour: at(record, x, y).tile }),
            writeOps: (desc, x, y) => [{ op: 'setTile', x, y, tile: desc.colour }],
        });
        const rec = toyWorld(4, 4);
        const clip = rectCopy(flat, rec, { x: 0, y: 0, w: 2, h: 2 });
        expect(() => rectPasteOps(flat, rec, clip, 1, 1, { tilesOnly: true }))
            .toThrow(/no `tile` field, so the split does not exist on this substrate/);
        // ⛓ and the UNFILTERED paste on the same adapter works, so the refusal
        //   is about the filter and not about the adapter.
        expect(rectPasteOps(flat, rec, clip, 1, 1).ops).toHaveLength(4);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * FLOOD
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ floodOps — exactly the 4-connected component', () => {
    /**
     * A 5x5 of `'a'` with a `'b'` cross carved so that (0,0)'s component is an
     * L, and (4,0) touches it ONLY DIAGONALLY at (3,1)/(4,0)… laid out below.
     *
     * ⛓ MUTANT: swap `reachableFrom` for an 8-neighbour walk — the diagonal
     * neighbour joins the component and the row goes RED on both the size and
     * the (4,0) cell.
     */
    const crossWorld = () => foldEdits(toyAdapter, toyWorld(5, 5), [
        // a 'b' wall down column 1 and along row 1, leaving (0,0) alone in a
        // 1-cell pocket and (2,0)..(4,0) as a separate 3-cell strip.
        tileOp(1, 0, 'b'), tileOp(1, 1, 'b'), tileOp(2, 1, 'b'),
        tileOp(3, 1, 'b'), tileOp(4, 1, 'b'), tileOp(0, 1, 'b'),
    ]).record;

    it('paints the seed component and NOT a diagonal-only neighbour', () => {
        const rec = crossWorld();
        // (0,0) is a 1-cell pocket: (1,0) is 'b', (0,1) is 'b'. Its only
        // diagonal neighbour (1,1) is 'b' too — and (2,0), a same-looking 'a',
        // is two cells away with no 4-path.
        const g = floodOps(toyAdapter, rec, 0, 0, { tile: 'b' });
        expect(g.ops).toHaveLength(1);
        expect(g.ops[0]).toMatchObject({ op: 'setTile', x: 0, y: 0, tile: 'b' });
        const s = createEditSession(toyAdapter, rec);
        s.apply(g);
        expect(toyAdapter.readCell(s.record(), 2, 0).tile).toBe('a');
    });

    /** ⛓ MUTANT: compare only `desc.tile` in the flood predicate — the cell
     *  holding an entity then joins the component and the count goes RED. */
    it('the membership test is the WHOLE descriptor, not just its tile', () => {
        const rec = foldEdits(toyAdapter, toyWorld(4, 1), [entOp(2, 0, 'rock')]).record;
        const g = floodOps(toyAdapter, rec, 0, 0, { tile: 'b', entity: null });
        // (0,0) and (1,0) look alike; (2,0) holds a rock and stops the walk.
        expect(g.ops.filter((o) => o.op === 'setTile')).toHaveLength(2);
        expect(g.label).toContain('2 cell(s)');
    });

    /** ⛓ MUTANT: drop the seed bounds check — `reachableFrom` then throws a
     *  `GridFloodError` instead, and the row's message assertion goes RED. */
    it('an off-grid seed refuses by name', () => {
        expect(() => floodOps(toyAdapter, toyWorld(3, 3), 3, 0, { tile: 'b' }))
            .toThrow(/off the 3x3 toy grid/);
    });

    /**
     * ⛓ MUTANT: emit the flood's cells in `reachableFrom`'s BFS order — the op
     * order then depends on the walk rather than on the grid, and two floods
     * of one component from different seeds would write different payloads.
     */
    it('the ops are in GRID order, so the payload does not carry the walk\'s order', () => {
        const rec = toyWorld(3, 2);
        const a = floodOps(toyAdapter, rec, 0, 0, { tile: 'b' });
        const b = floodOps(toyAdapter, rec, 2, 1, { tile: 'b' });
        expect(a.ops.map((o) => `${o.x},${o.y}`)).toEqual(b.ops.map((o) => `${o.x},${o.y}`));
        expect(a.ops.map((o) => `${o.x},${o.y}`))
            .toEqual(['0,0', '1,0', '2,0', '0,1', '1,1', '2,1']);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ADAPTER CONTRACT
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓ assertAdapter', () => {
    /**
     * ⛓ MUTANT: check the members with a hand-written chain that forgets one
     * (say `writeOps`) — that row goes RED. The list is DERIVED from
     * `ADAPTER_MEMBERS`, so a seventh member cannot arrive in the contract and
     * not in this test either.
     */
    it.each(Object.keys(ADAPTER_MEMBERS))('refuses a missing `%s` BY NAME', (member) => {
        const broken = { ...toyAdapter };
        delete broken[member];
        expect(() => assertAdapter(broken)).toThrow(new RegExp(`\`${member}\` must be a`));
    });

    it('refuses a non-object, and an empty name', () => {
        expect(() => assertAdapter(null)).toThrow(/an adapter must be an object/);
        expect(() => assertAdapter({ ...toyAdapter, name: '' })).toThrow(/NON-EMPTY string/);
        expect(assertAdapter(toyAdapter)).toBe(toyAdapter);
    });

    /** ⛓ canonicalJson is what every descriptor comparison is built on. */
    it('canonicalJson sorts keys at every depth, so two spellings of one cell agree', () => {
        expect(canonicalJson({ tile: 'a', entity: { kind: 'rock', n: 1 } }))
            .toBe(canonicalJson({ entity: { n: 1, kind: 'rock' }, tile: 'a' }));
        expect(canonicalJson([1, { b: 2, a: 1 }])).toBe('[1,{"a":1,"b":2}]');
        expect(canonicalJson(undefined)).toBe('null');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛔⛔ THE SPLIT IS REAL — asserted on the SOURCE
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THIS FILE IMPORTS NO SUBSTRATE**, and the claim is checked by reading
 * its own source rather than trusted to a docblock.
 *
 * ⛔ Why the TEST and not just `editCore.js`: `bindingContract.test.js` already
 * scans the shipping modules of this directory, and A1 put `editCore.js` in
 * that subject. But a core can be perfectly agnostic and still be proven only
 * against one substrate — the day this test reached for `mazeRoomEngine`'s
 * `TILE_WALL` "just for a fixture", the toy would stop being a toy and the
 * agnosticism would be a claim nobody was checking any more.
 *
 * ⚠ trap 580's family: a scan that reads its own gate's fixtures ALLOWLISTS
 * them. The subject here is exactly one file — this one — so there is nothing
 * to allowlist, and the non-vacuity row below is what proves the pattern bites.
 */
describe('⛓⛓⛓ descriptorFieldsOf — the filter offer, derived from the DESCRIPTOR', () => {
    const rec = toyWorld(3, 3);

    it('⛓ it is the descriptor\'s own keys, in the descriptor\'s own order', () => {
        expect(descriptorFieldsOf(toyAdapter, rec))
            .toEqual(Object.keys(toyAdapter.readCell(rec, 0, 0)));
    });

    it('⛓⛓ a FOURTH field arrives as an offer with no edit at the call site — which is the '
        + 'whole point of deriving it', () => {
        const wider = Object.freeze({
            ...toyAdapter,
            readCell: (r, x, y) => ({ ...toyAdapter.readCell(r, x, y), weather: 'rain' }),
        });
        expect(descriptorFieldsOf(wider, rec))
            .toEqual([...descriptorFieldsOf(toyAdapter, rec), 'weather']);
    });

    it('⛓ every field it offers is one `rectPasteOps` will actually accept as `only`', () => {
        for (const field of descriptorFieldsOf(toyAdapter, rec)) {
            expect(() => rectPasteOps(toyAdapter, rec, rectCopy(toyAdapter, rec,
                { x: 0, y: 0, w: 2, h: 2 }), 1, 1, { only: field })).not.toThrow();
        }
        // ⛔ …and a field the descriptor does NOT carry is refused BY NAME
        expect(() => rectPasteOps(toyAdapter, rec, rectCopy(toyAdapter, rec,
            { x: 0, y: 0, w: 2, h: 2 }), 1, 1, { only: 'weather' }))
            .toThrow(/no `weather` field, so the split does not exist on this substrate/);
    });

    it('⛔ an adapter whose readCell is not a plain object refuses BY NAME rather than '
        + 'offering nothing', () => {
        const broken = Object.freeze({ ...toyAdapter, readCell: () => ['a'] });
        expect(() => descriptorFieldsOf(broken, rec)).toThrow(EditCoreError);
        expect(() => descriptorFieldsOf(broken, rec)).toThrow(/a cell DESCRIPTOR is a plain/);
    });
});

describe('⛔ the toy test imports nothing substrate-side', () => {
    const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
    const specifiers = [...source.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)]
        .map((m) => m[1]);
    const BINDING = /(^|\/)(mazeRoom|seedlingDemo)\//;

    it('reaches for no binding', () => {
        expect(specifiers.length).toBeGreaterThan(0);
        for (const spec of specifiers) {
            expect(BINDING.test(spec), `this test imports "${spec}"`).toBe(false);
        }
    });

    /** ⛔ NON-VACUITY — the scanner reads real specifiers and the pattern bites
     *  on the two names it is about. */
    it('the scan is not vacuous', () => {
        expect(specifiers).toContain('./editCore.js');
        expect(specifiers).toContain('node:fs');
        expect(BINDING.test('../mazeRoom/mazeRoomEngine.js')).toBe(true);
        expect(BINDING.test('../seedlingDemo/watchEdit.js')).toBe(true);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE NO-CELL-SPACE WIDENING (EDITOR INTEGRATION B-b, plan §3.1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ **A SECOND TOY, AND IT HAS NO GRID AT ALL** — a LEDGER of named entries.
 *
 * ⛔ It is a second toy rather than `toyAdapter` with three members deleted,
 * because the point of the widening is a substrate whose document is *not* a
 * cell space, and a crippled grid adapter would still have a grid's vocabulary
 * in its ops. The bounce region editor and the APWorld editor are the two real
 * ones (§3.1); this file imports neither, for the reason its own header gives.
 */
const ledger = (entries = []) => Object.freeze({ entries: Object.freeze([...entries]) });

const ledgerAdapter = Object.freeze({
    name: 'ledger',
    apply(record, op) {
        if (op?.op === 'add-entry') {
            if (record.entries.some((e) => e.id === op.id)) {
                return { ok: false, description: `ledger: '${op.id}' is already an entry.` };
            }
            const entry = Object.freeze({ id: op.id, note: op.note ?? '' });
            return {
                ok: true,
                op: { op: 'add-entry', id: op.id, note: entry.note },
                description: `added ${op.id}`,
                record: ledger([...record.entries, entry]),
                // ⛓ THE VALUE CHANNEL — the node this op created.
                value: entry,
            };
        }
        if (op?.op === 'set-note') {
            const found = record.entries.find((e) => e.id === op.id);
            if (!found) return { ok: false, description: `ledger: no entry '${op.id}'.` };
            const next = Object.freeze({ id: found.id, note: op.note });
            return {
                ok: true,
                op: { op: 'set-note', id: op.id, note: op.note },
                description: `${op.id}.note → ${JSON.stringify(op.note)}`,
                record: ledger(record.entries.map((e) => (e.id === op.id ? next : e))),
                value: next,
            };
        }
        return { ok: false, description: `ledger: unknown op ${JSON.stringify(op?.op)}.` };
    },
    equal: (a, b) => canonicalJson(a) === canonicalJson(b),
});

describe('⛓⛓⛓ the CELL-SPACE TRIO — all three or none', () => {
    /** ⛓ MUTANT: `hasCellSpace` built on `some` instead of `every` — RED. */
    it('`hasCellSpace` is `every`, so a PARTIAL trio is not a cell space', () => {
        expect(hasCellSpace(toyAdapter)).toBe(true);
        expect(hasCellSpace(ledgerAdapter)).toBe(false);
        for (const missing of CELL_SPACE_MEMBERS) {
            const partial = { ...toyAdapter };
            delete partial[missing];
            expect(hasCellSpace(partial), `missing ${missing}`).toBe(false);
        }
        expect(hasCellSpace(null)).toBe(false);
    });

    /** ⛓ MUTANT: drop the trio branch from `assertAdapter` — the cell-less
     *  adapter is then refused for a "missing" `bounds` and this row goes RED. */
    it('`assertAdapter` ACCEPTS a cell-less adapter — the row that proves the widening', () => {
        expect(assertAdapter(ledgerAdapter)).toBe(ledgerAdapter);
    });

    /**
     * ⛓ MUTANT: treat the trio as independently optional (`if (adapter[m] ===
     * undefined) continue`) — a partial trio then sails through and this goes
     * RED. ⛔ The message must ALSO still say "`bounds` must be a function", or
     * the `it.each(Object.keys(ADAPTER_MEMBERS))` row above stops biting on
     * three of its six members.
     */
    it.each(CELL_SPACE_MEMBERS)('refuses a PARTIAL trio missing `%s` BY NAME', (member) => {
        const partial = { ...toyAdapter };
        delete partial[member];
        expect(() => assertAdapter(partial)).toThrow(new RegExp(`\`${member}\` must be a`));
        expect(() => assertAdapter(partial)).toThrow(/CELL-SPACE TRIO/);
        expect(() => assertAdapter(partial))
            .toThrow(new RegExp(`declares \\[${CELL_SPACE_MEMBERS.filter((m) => m !== member)
                .join(', ')}\\]`));
    });

    /** ⛓ MUTANT: a mis-TYPED trio member (present, not a function) reading as
     *  "declared" is right — but it must still refuse on the type. */
    it('a MIS-TYPED trio member is a declared trio and refuses on its TYPE', () => {
        expect(() => assertAdapter({ ...toyAdapter, readCell: 'nope' }))
            .toThrow(/`readCell` must be a function, got string/);
    });

    /** ⛓ MUTANT: name a member in `CELL_SPACE_MEMBERS` that `ADAPTER_MEMBERS`
     *  has no type for — it would be un-checked for every adapter. */
    it('every trio name carries a TYPE in the member table', () => {
        for (const m of CELL_SPACE_MEMBERS) expect(ADAPTER_MEMBERS).toHaveProperty(m);
    });
});

describe('⛔ the four cell-space callers refuse a cell-less adapter BY NAME', () => {
    const rec = ledger([{ id: 'a', note: '' }]);
    const clip = Object.freeze({ w: 1, h: 1, cells: Object.freeze([Object.freeze([{}])]) });

    /**
     * ⛓ MUTANT: drop `requireCellSpace` from any one of the four — that row
     * dies inside the adapter with "adapter.bounds is not a function", a
     * sentence about JavaScript rather than about the substrate.
     */
    it.each([
        ['rectCopy', () => rectCopy(ledgerAdapter, rec, { x: 0, y: 0, w: 1, h: 1 })],
        ['rectPasteOps', () => rectPasteOps(ledgerAdapter, rec, clip, 0, 0)],
        ['floodOps', () => floodOps(ledgerAdapter, rec, 0, 0, {})],
        ['descriptorFieldsOf', () => descriptorFieldsOf(ledgerAdapter, rec)],
    ])('`%s` refuses, naming the adapter AND the members', (name, call) => {
        expect(call).toThrow(EditCoreError);
        expect(call).toThrow(new RegExp(
            `ledger declares no cell space — ${name} needs ${CELL_SPACE_MEMBERS.join('/')}`));
    });

    /** ⛔ NON-VACUITY — the same four are perfectly happy on the grid toy. */
    it('the same four run on the GRID toy, so the refusal is about the TRIO', () => {
        const grid = toyWorld(3, 3);
        expect(() => rectCopy(toyAdapter, grid, { x: 0, y: 0, w: 1, h: 1 })).not.toThrow();
        expect(() => descriptorFieldsOf(toyAdapter, grid)).not.toThrow();
    });
});

describe('⛓⛓⛓ assertAdapterBehaviour over a CELL-LESS adapter — laws 2–5, and the skips SAID', () => {
    const rec = ledger([{ id: 'a', note: '' }]);
    const op = { op: 'set-note', id: 'a', note: 'hello' };
    const refused = { op: 'set-note', id: 'nope', note: 'x' };

    /**
     * ⛓⛓ THE BRIEF SAID "laws 1–6, skip 7"; the CODE says 1, 6 AND 7 are the
     * cell-space laws. This row is that measurement.
     */
    it('names THREE skipped laws — 1 (`bounds`), 6 (`writeOps`) and 7 — not one', () => {
        const said = [];
        expect(assertAdapterBehaviour(ledgerAdapter, {
            record: rec, op, refused, say: (line) => said.push(line),
        })).toBe(true);
        expect(said).toHaveLength(3);
        expect(CELL_SPACE_LAWS.map((l) => l.n)).toEqual([1, 6, 7]);
        for (const { n, member } of CELL_SPACE_LAWS) {
            expect(said.some((l) => l.includes(`contract law ${n} (\`${member}\``)),
                `law ${n} not said: ${said.join(' | ')}`).toBe(true);
        }
        for (const line of said) expect(line).toMatch(/ledger adapter declares no cell space/);
    });

    /**
     * ⛓⛓⛓ MUTANT — **the whole point of the row above.** Let a cell-less
     * adapter through without `say` (or emit nothing through it) and
     * `assertAdapterBehaviour` returns a bare `true`: a green claim about
     * seven laws of which three were never asked (trap 806's family).
     */
    it('⛔ REFUSES a cell-less adapter with NO `say` — a skip must not read as a pass', () => {
        expect(() => assertAdapterBehaviour(ledgerAdapter, { record: rec, op, refused }))
            .toThrow(/declares no cell space, so contract laws 1, 6, 7 CANNOT be asked/);
        expect(() => assertAdapterBehaviour(ledgerAdapter, { record: rec, op, refused }))
            .toThrow(/pass `say`/);
    });

    /** ⛓ The four laws it DOES ask still bite — one row per law, cell-less. */
    it.each([
        [2, { apply: () => ({ nope: true }) }, /fails contract law 2/],
        [3, {
            apply: (r, o) => {
                r.mutated = true;
                return ledgerAdapter.apply(r, o);
            },
        }, /fails contract law 3/],
        [4, { equal: () => true }, /fails contract law 4/],
        [5, { apply: (r, o) => (o === refused ? { ok: false } : ledgerAdapter.apply(r, o)) },
            /fails contract law 5/],
    ])('law %i goes RED against a wrapper that breaks it', (n, override, re) => {
        expect(() => assertAdapterBehaviour({ ...ledgerAdapter, ...override }, {
            record: { ...rec, entries: [...rec.entries] }, op, refused, say: () => {},
        })).toThrow(re);
    });

    /** ⛓ And a CELL-FUL adapter is untouched: seven laws, no `say`, `true`. */
    it('a cell-space adapter needs no `say` and still answers all seven', () => {
        expect(assertAdapterBehaviour(toyAdapter, {
            record: toyWorld(3, 3), op: tileOp(0, 0, 'b'), refused: { op: 'nope' },
        })).toBe(true);
    });
});

describe('⛓⛓⛓ the session FORWARDS the adapter\'s `value` — trap 857, closed', () => {
    const rec = ledger([]);

    /**
     * ⛓⛓⛓ MUTANT — restore the field-by-field return in `createEditSession
     * .apply` (drop the `...(res.value === undefined ? …)` spread) and this row
     * goes RED. It is the defect B-a had to work around with a side slot on its
     * own adapter.
     */
    it('an APPLIED op carries `value` — the node the adapter named', () => {
        const sess = createEditSession(ledgerAdapter, rec);
        const res = sess.apply({ op: 'add-entry', id: 'a', note: 'first' });
        expect(res.applied).toBe(true);
        expect(res.value).toEqual({ id: 'a', note: 'first' });
    });

    it('a NO-OP carries it too — presence must not depend on whether bytes moved', () => {
        const sess = createEditSession(ledgerAdapter, ledger([{ id: 'a', note: 'x' }]));
        const res = sess.apply({ op: 'set-note', id: 'a', note: 'x' });
        expect(res.applied).toBe(false);
        expect(res.value).toEqual({ id: 'a', note: 'x' });
    });

    it('a REFUSED op carries NONE, and an adapter that names none produces no key', () => {
        const sess = createEditSession(ledgerAdapter, rec);
        expect('value' in sess.apply({ op: 'set-note', id: 'ghost', note: 'x' })).toBe(false);
        const quiet = createEditSession(toyAdapter, toyWorld(2, 2));
        expect('value' in quiet.apply(tileOp(0, 0, 'b'))).toBe(false);
    });

    /** ⛓ A GROUP names no single node — `applyOne` builds its own result. */
    it('a GROUP carries none — a stroke of many ops has no one value', () => {
        const sess = createEditSession(ledgerAdapter, rec);
        const res = sess.apply(group('two', [
            { op: 'add-entry', id: 'a' }, { op: 'add-entry', id: 'b' },
        ]));
        expect(res.applied).toBe(true);
        expect('value' in res).toBe(false);
    });
});

describe('⛓ a cell-less session is a whole session — undo included', () => {
    it('N ops → undo ×N → the base, byte for byte', () => {
        const base = ledger([{ id: 'a', note: '' }]);
        const sess = createEditSession(ledgerAdapter, base, { base: { kind: 'ledger' } });
        sess.apply({ op: 'add-entry', id: 'b' });
        sess.apply({ op: 'set-note', id: 'a', note: 'hi' });
        expect(sess.ops()).toHaveLength(2);
        while (sess.undo());
        expect(canonicalJson(sess.record())).toBe(canonicalJson(base));
        expect(sess.payload()).toEqual({ base: { kind: 'ledger' }, edits: [], certified: null });
    });
});
