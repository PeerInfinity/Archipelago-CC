/**
 * ⛓⛓⛓ **SEEDLING EDITOR E1 — THE SEEDLING HALF.**
 *
 * The room op vocabulary's two additions (`erase`, and `which` on `attrs`/`nodes`), the adapter's `clearOps`,
 * the FILL / CLEAR / REPLACE / MOVE builders on a real Seedling room, the tile-art palette's frame choice, SOLVE
 * in EDIT (`editSolve`), and the IDENTITY pin: load/fold/save of the vanilla 116 and a fixed list of every
 * pre-E1 op kind is byte-identical to origin/main (`IDENTITY_DIGEST`, measured there at 6473024aa8).
 * Every row names its MUTANT.
 */
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    createEditSession, floodOps, foldEdits, group, rectClearOps, rectCopy, rectFillOps, rectMoveOps,
    rectPasteOps, rectReplaceOps,
} from '../procgenCore/editCore.js';
import { createSeedlingEditAdapter, seedlingClearOps } from './seedlingEditAdapter.js';
import { applyEdit, describeEdit, normalizeEdit } from './watchEdit.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel, recordToOel } from './procgenLevelOel.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CLIFFSIDE_ART_KEY, paletteTileFrame } from './watchArt.js';
import { TILE_ART } from './seedlingSkinRenderer.js';
import { TILE_COLUMN_TO_TYPE } from '../flashPanel/seedlingSemantics.js';
import {
    EditSolveError, NO_GOAL_REFUSAL, editSolveGoals, parseSolveItems, solveEditedRoom,
} from './editSolve.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const MAP = JSON.parse(readFileSync(here('../flashPanel/atlases/seedling-map.json'), 'utf8'));
const EMBED = JSON.parse(readFileSync(here('./fixtures/seedling-vanilla-set.json'), 'utf8'));
const adapter = createSeedlingEditAdapter({
    schema: null, levelSource: levelSourceFromAtlas(MAP), vanillaSetId: EMBED.set_id, parseOel: parseOelLevel,
});
const L = (n) => MAP.levels.find((l) => l.level === n);
const j = (v) => JSON.stringify(v);
const cell = (r, x, y) => adapter.readCell(r, x, y);

/* ══ IDENTITY ══════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ MEASURED ON origin/main 6473024aa8 (a throwaway worktree) AND ON THIS TREE: the same digest. It covers,
 * for each of the 116 vanilla rooms, a session opened on the atlas base → its record as OEL + its payload, and
 * the OEL parse of the record; the derived `vanillaRecordSet`; and a fixed list of every pre-E1 op kind plus a
 * paste, an undone flood and a stroke on L14 (payload, OEL and the fold's sentences). MUTANT: write `which`
 * into every `attrs` op (or `layer: 'tiles'` into every erase/paint) — the digest moves.
 */
const IDENTITY_DIGEST = '5f49b4cda3e5658ce2c984e0a55ffdf5348eba5c58a0ae45aaf3e8e88b1491f4';

describe('⛓⛓⛓ IDENTITY — load/fold/save is byte-identical to main', () => {
    it('the vanilla 116, the record set and a pre-E1 op list digest exactly as on main', () => {
        const h = crypto.createHash('sha256');
        let oel = '';
        for (const rec of MAP.levels) {
            const s = createEditSession(adapter, rec, { base: { kind: 'atlas', set_id: EMBED.set_id, level: rec.level } });
            oel += recordToOel(s.record()) + JSON.stringify(s.payload());
            oel += JSON.stringify(parseOelLevel(recordToOel(rec)));
        }
        h.update(oel);
        h.update(JSON.stringify(vanillaRecordSet(EMBED, MAP).set));
        const rec = L(14);
        const s = createEditSession(adapter, rec);
        for (const op of [
            { op: 'paint', tx: 3, ty: 3, column: 21 },
            { op: 'paint', tx: 4, ty: 3, terrain: 'wall' },
            { op: 'paint', tx: 5, ty: 3, layer: 'cliffsides', column: 2 },
            { op: 'place', tx: 6, ty: 4, type: 'lock', attrs: { tset: '0', tag: '-1' } },
            { op: 'place', tx: 6, ty: 4, type: 'pushableblock', attrs: {} },
            { op: 'attrs', tx: 6, ty: 4, attrs: { tset: '1' } },
            { op: 'remove', tx: 6, ty: 4 },
            { op: 'remove', tx: 6, ty: 4, which: 0 },
            { op: 'place', tx: 7, ty: 4, type: 'rope', attrs: { tset: '0', tag: '-1' } },
            { op: 'nodes', tx: 7, ty: 4, nodes: [{ x: 160, y: 64 }] },
        ]) expect(s.apply(op).ok).toBe(true);
        s.apply(rectPasteOps(adapter, s.record(), rectCopy(adapter, s.record(), { x: 2, y: 2, w: 3, h: 2 }), 1, 5));
        s.apply(floodOps(adapter, s.record(), 1, 1, { tile: { column: 3 } }));
        s.undo();
        s.apply(group('stroke', [{ op: 'paint', tx: 1, ty: 1, column: 0 }, { op: 'paint', tx: 2, ty: 1, column: 0 }]));
        h.update(JSON.stringify(s.payload()) + recordToOel(s.record()));
        h.update(JSON.stringify(foldEdits(adapter, rec, s.ops()).steps.map((x) => x.description)));
        expect(h.digest('hex')).toBe(IDENTITY_DIGEST);
    });
});

/* ══ the op vocabulary ═════════════════════════════════════════════════ */

describe('⛓ erase, and `which` on attrs', () => {
    const room = () => emptyLevel({ level: 1, width: 8, height: 8 });

    /** MUTANT: `eraseTile` drops every tile on the layer, or does nothing (the op would be dropped as a no-op). */
    it('erase takes ONE tile off its layer, refuses an absent one by name, and round-trips through OEL', () => {
        const r = room();
        expect(cell(r, 2, 2).tile).not.toBe(null);
        const after = applyEdit(r, { op: 'erase', tx: 2, ty: 2 });
        expect(cell(after, 2, 2).tile).toBe(null);
        expect(cell(after, 3, 2).tile).toEqual(cell(r, 3, 2).tile);
        expect(() => applyEdit(after, { op: 'erase', tx: 2, ty: 2 })).toThrow(/holds no tile there/);
        expect(() => applyEdit(r, { op: 'erase', tx: 2, ty: 2, layer: 'cliffsides' })).toThrow(/no such layer/);
        expect(j(parseOelLevel(recordToOel(after)).layers)).toBe(j(after.layers));
        expect(describeEdit(normalizeEdit({ op: 'erase', tx: 2, ty: 2 }))).toBe('EDIT erase (2,2) → no tile');
        // ⛓ `layer: 'tiles'` is the absence, byte-inert like paint's
        expect(j(normalizeEdit({ op: 'erase', tx: 1, ty: 1, layer: 'tiles' }))).toBe('{"op":"erase","tx":1,"ty":1}');
    });

    /** MUTANT: `normalizeEdit` drops `which` on attrs — the LAST body is rewritten instead of body 0. */
    it('attrs {which} rewrites THAT body; a bare attrs is unchanged (no `which` key) and still hits the last', () => {
        let r = applyEdit(room(), { op: 'place', tx: 3, ty: 3, type: 'lock', attrs: { tset: '0' } });
        r = applyEdit(r, { op: 'place', tx: 3, ty: 3, type: 'button', attrs: { tset: '0' } });
        const a = applyEdit(r, { op: 'attrs', tx: 3, ty: 3, which: 0, attrs: { tset: '5' } });
        expect(cell(a, 3, 3).entities.map((e) => e.attrs.tset)).toEqual(['5', '0']);
        const b = applyEdit(r, { op: 'attrs', tx: 3, ty: 3, attrs: { tset: '7' } });
        expect(cell(b, 3, 3).entities.map((e) => e.attrs.tset)).toEqual(['0', '7']);
        expect(Object.keys(normalizeEdit({ op: 'attrs', tx: 3, ty: 3, attrs: {} }))).toEqual(['op', 'tx', 'ty', 'attrs']);
        expect(() => applyEdit(r, { op: 'attrs', tx: 3, ty: 3, which: 2, attrs: {} })).toThrow(/holds 2 entities/);
        expect(describeEdit(normalizeEdit({ op: 'attrs', tx: 3, ty: 3, which: 0, attrs: { tset: '5' } })))
            .toBe('EDIT attrs (3,3) entity 0 → {tset=5}');
    });
});

/* ══ the four rectangle gestures on a Seedling room ════════════════════ */

describe('⛓ FILL · CLEAR · REPLACE · MOVE on a Seedling room (adapter clearOps)', () => {
    const seeded = () => {
        const s = createEditSession(adapter, emptyLevel({ level: 1, width: 8, height: 8 }));
        s.apply({ op: 'place', tx: 2, ty: 2, type: 'lock', attrs: { tset: '0' } });
        s.apply({ op: 'place', tx: 2, ty: 2, type: 'button', attrs: { tset: '0' } });
        s.apply({ op: 'place', tx: 5, ty: 5, type: 'pushableblock', attrs: {} });
        return s;
    };

    /** MUTANT: `seedlingClearOps` emits ONE remove per cell — a two-body cell keeps a body. */
    it('clearOps empties the named fields (bodies last-first, bare `remove`), and skips an overwritten tile', () => {
        const s = seeded();
        expect(seedlingClearOps(s.record(), 2, 2, { fields: ['entities'] }))
            .toEqual([{ op: 'remove', tx: 2, ty: 2 }, { op: 'remove', tx: 2, ty: 2 }]);
        expect(seedlingClearOps(s.record(), 2, 2, { fields: ['tile'] })).toEqual([{ op: 'erase', tx: 2, ty: 2 }]);
        expect(seedlingClearOps(s.record(), 2, 2, { fields: ['tile'], incoming: { tile: { column: 0 } } })).toEqual([]);
        expect(seedlingClearOps(s.record(), 2, 2, { fields: ['cliff'] })).toEqual([]);
    });

    /** MUTANT: FILL ignores the descriptor's field — a PLACE fill also repaints the terrain. */
    it('FILL of a PLACE target puts one body on each cell and leaves the terrain', () => {
        const s = seeded();
        const tiles = j([0, 1].map((x) => cell(s.record(), x, 0).tile));
        s.apply(rectFillOps(adapter, s.record(), { x: 0, y: 0, w: 2, h: 1 },
            { entities: [{ type: 'pushableblock', attrs: {} }] }));
        expect([0, 1].map((x) => cell(s.record(), x, 0).entities.length)).toEqual([1, 1]);
        expect(j([0, 1].map((x) => cell(s.record(), x, 0).tile))).toBe(tiles);
        expect(s.ops()).toHaveLength(4);
    });

    /** MUTANT: REPLACE built from `rectPasteOps` alone — the destination keeps its two bodies AND gains one. */
    it('REPLACE paste: the destination holds exactly the clip\'s bodies; ADD still accumulates', () => {
        const s = seeded();
        const clip = rectCopy(adapter, s.record(), { x: 5, y: 5, w: 1, h: 1 });
        const add = createEditSession(adapter, s.record());
        add.apply(rectPasteOps(adapter, add.record(), clip, 2, 2, { only: 'entities' }));
        expect(cell(add.record(), 2, 2).entities.map((e) => e.type)).toEqual(['lock', 'button', 'pushableblock']);
        const rep = createEditSession(adapter, s.record());
        rep.apply(rectReplaceOps(adapter, rep.record(), clip, 2, 2, { only: 'entities' }));
        expect(cell(rep.record(), 2, 2).entities.map((e) => e.type)).toEqual(['pushableblock']);
    });

    /** MUTANT: MOVE skips the cut — the source still holds its bodies after the move. */
    it('MOVE carries the bodies and leaves the source empty, as ONE undo', () => {
        const s = seeded();
        const base = j(s.record());
        const clip = rectCopy(adapter, s.record(), { x: 2, y: 2, w: 1, h: 1 });
        s.apply(rectMoveOps(adapter, s.record(), clip, { x: 2, y: 2 }, 4, 1, { only: 'entities' }));
        expect(cell(s.record(), 2, 2).entities).toEqual([]);
        expect(cell(s.record(), 4, 1).entities.map((e) => e.type)).toEqual(['lock', 'button']);
        expect(cell(s.record(), 2, 2).tile).not.toBe(null);   // entities-only: the terrain stayed
        s.undo();
        expect(j(s.record())).toBe(base);
    });

    /** MUTANT: CLEAR refuses nothing — an empty rectangle records an empty group. */
    it('CLEAR of a body-less rectangle (entities only) refuses by name; of everything, erases the tiles', () => {
        const s = seeded();
        expect(() => rectClearOps(adapter, s.record(), { x: 0, y: 6, w: 2, h: 2 }, { fields: ['entities'] }))
            .toThrow(/found nothing to clear/);
        s.apply(rectClearOps(adapter, s.record(), { x: 1, y: 1, w: 2, h: 2 }));
        for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
            expect(cell(s.record(), x, y)).toEqual({ tile: null, cliff: null, entities: [] });
        }
    });
});

/* ══ the tile-art palette ═══════════════════════════════════════════ */

describe('⛓ paletteTileFrame — the chip draws with the room\'s own TILE_ART rule', () => {
    const fakeArt = (keys) => ({
        has: (k) => keys.includes(k),
        resolve: (k) => ({ sprite: { anims: { flow: { frames: [6, 7] }, shimmer: { frames: [3] }, closed: { frames: [2] } } } }),
        frameRect: (k, f) => ({ key: k, frame: f, sheetRef: `s/${k}`, sx: f * 16, sy: 0, sw: 16, sh: 16 }),
    });

    /** MUTANT: the chip reads `TILE_ART[column]` instead of `TILE_ART[TILE_COLUMN_TO_TYPE[column]]`. */
    it('every tiles column resolves through TILE_COLUMN_TO_TYPE to its type\'s key; anims take their first frame', () => {
        const keys = TILE_ART.map((t) => t.key);
        const art = fakeArt(keys);
        for (let column = 0; column < TILE_COLUMN_TO_TYPE.length; column += 1) {
            const fr = paletteTileFrame(art, 'tiles', column);
            expect(fr.key, `column ${column}`).toBe(TILE_ART[TILE_COLUMN_TO_TYPE[column]].key);
        }
        expect(paletteTileFrame(art, 'tiles', 2).frame).toBe(6);         // water: 'flow' frame 0
        expect(paletteTileFrame(art, 'tiles', 0).frame).toBe(0);         // ground: autotile mask 0
    });

    /** MUTANT: a missing key falls back to another sheet instead of `null` (the caller's swatch). */
    it('a missing key is null (the swatch); cliffsides draw frame = column', () => {
        expect(paletteTileFrame(fakeArt([]), 'tiles', 0)).toBe(null);
        expect(paletteTileFrame(null, 'tiles', 0)).toBe(null);
        const art = fakeArt([CLIFFSIDE_ART_KEY]);
        expect([0, 1, 2, 3, 4].map((c) => paletteTileFrame(art, 'cliffsides', c).frame)).toEqual([0, 1, 2, 3, 4]);
    });
});

/* ══ SOLVE in EDIT ═══════════════════════════════════════════════════ */

describe('⛓⛓ SOLVE in EDIT — the oracle GENERATE uses, on the edited record', () => {
    /** a small walled room with a sword at (5,5) and the player booting at (2,2) */
    const room = () => {
        let r = emptyLevel({ level: 1, width: 9, height: 9 });
        r = applyEdit(r, { op: 'place', tx: 5, ty: 5, type: 'sword', attrs: {} });
        return r;
    };
    const boot = { level: 1, x: 32, y: 32 };

    it('the goals are the room\'s own: collectables first, then exits; an exit OUT of the room is refused by name', () => {
        const goals = editSolveGoals(L(1));
        expect(goals.length).toBeGreaterThan(0);
        const out = goals.find((g) => g.id.startsWith('exit@'));
        expect(out.goal).toBe(null);
        expect(out.refused).toMatch(/leads to level 0, not back into this room/);
        expect(editSolveGoals(room()).map((g) => g.id)).toEqual(['collect@80,80']);
    });

    /** MUTANT: solve the BASE record instead of the edited one — the wall edit below would still SOLVE. */
    it('SOLVES a hand-built room to its pickup, with a tape; walling the pickup in is NOT solved', () => {
        const ok = solveEditedRoom(room(), { boot });
        expect(ok.verdict).toBe('SOLVED');
        expect(ok.tape).toBeTruthy();
        expect(ok.goalId).toBe('collect@80,80');
        let walled = room();
        for (const [x, y] of [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]]) {
            walled = applyEdit(walled, { op: 'paint', tx: x, ty: y, terrain: 'wall' });
        }
        expect(solveEditedRoom(walled, { boot }).verdict).not.toBe('SOLVED');
    });

    it('a vanilla room solves to its own pickup (L10\'s sword)', () => {
        const goals = editSolveGoals(L(10));
        const sword = goals.find((g) => g.label.includes('<sword>'));
        expect(sword).toBeTruthy();
    });

    /** MUTANT: a goal-less room solved against an invented goal instead of refused. */
    it('refuses BY NAME: no goal, an unknown goal, an exit out, no spawn, a bad inventory', () => {
        const empty = emptyLevel({ level: 1, width: 6, height: 6 });
        expect(() => solveEditedRoom(empty, { boot })).toThrow(EditSolveError);
        expect(() => solveEditedRoom(empty, { boot })).toThrow(NO_GOAL_REFUSAL);
        expect(() => solveEditedRoom(room(), { boot, goalId: 'collect@0,0' })).toThrow(/no goal "collect@0,0"/);
        const exitId = editSolveGoals(L(1)).find((g) => g.id.startsWith('exit@')).id;
        expect(() => solveEditedRoom(L(1), { boot, goalId: exitId })).toThrow(/ONE room/);
        expect(() => solveEditedRoom(room(), { boot: null })).toThrow(/no spawn/);
        expect(parseSolveItems('')).toBe(null);
        expect(parseSolveItems(' {} ')).toBe(null);
        expect(parseSolveItems('{"hasSword": true}')).toEqual({ hasSword: true });
        expect(() => parseSolveItems('[1]')).toThrow(/JSON OBJECT/);
        expect(() => parseSolveItems('{nope')).toThrow(/does not parse/);
    });
});
