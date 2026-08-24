/**
 * seedlingEditAdapter.test — **THE TWO FOLDS AGREE, THE CONTRACT HOLDS BY
 * BEHAVIOUR, AND §3.2's `base` UNION RESOLVES.**
 *
 * EDITOR v3, slice B. Three things are asked here and nothing else:
 *
 *  1. for every member of `EDIT_OPS`, a session apply ≡ a direct `applyEdit`,
 *     `foldEdits ≡ applyEdits` on a mixed list including a group, and the
 *     session's undo (a shorter FOLD) ≡ `watchEdit.undoEdit`;
 *  2. `assertAdapterBehaviour` — A1 §9.8's residue, now a shipping function —
 *     passes on this adapter and on the maze's, and its seven laws each go RED
 *     against a broken adapter;
 *  3. `bases`: the atlas hash MATCH and its MISMATCH (⚖ ruling 2), the `oel`
 *     parse, and the two kinds this adapter refuses by name.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    assertAdapter, assertAdapterBehaviour, createEditSession, foldEdits, group, rectCopy,
    rectPasteOps, resolveBase,
} from '../procgenCore/editCore.js';
import { mazeEditAdapter } from '../mazeRoom/mazeEditAdapter.js';
import { generateStep } from '../mazeRoom/mazeLab.js';
import { BASE_KINDS, createSeedlingEditAdapter, readSeedlingCell, seedlingWriteOps } from './seedlingEditAdapter.js';
import { EDIT_OPS, applyEdit, applyEdits, undoEdit } from './watchEdit.js';
import { emptyLevel, layerNamed, tileCellAt } from './procgenLevel.js';
import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { recordToOel } from './procgenLevelOel.js';
import { parseOelLevel } from '../../../scripts/procgen/seedlingOgmo.js';

const FIX = (name) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8',
));
const SCHEMA = FIX('seedling-ogmo-schema.json');
const VANILLA_SET_ID = FIX('seedling-vanilla-set.json').set_id;
const SOURCE = atlasLevelSource();

const adapter = createSeedlingEditAdapter({
    schema: SCHEMA, levelSource: SOURCE, vanillaSetId: VANILLA_SET_ID, parseOel: parseOelLevel,
});
/** ⛓ The schema-free adapter — slice 11's ops, which is what a caller with no
 *  fixture in reach gets, and it must still satisfy the whole contract. */
const bare = createSeedlingEditAdapter();

const room = () => applyEdits(emptyLevel({ level: 1, width: 12, height: 12 }), [
    { op: 'place', tx: 3, ty: 3, type: 'button', attrs: { tset: '0' } },
    { op: 'place', tx: 3, ty: 3, type: 'pushableblock', attrs: {} },
    { op: 'place', tx: 5, ty: 5, type: 'rope', attrs: { tset: '0', tag: '-1' } },
    { op: 'nodes', tx: 5, ty: 5, nodes: [{ x: 5 * 16 + 48, y: 5 * 16 }] },
    { op: 'paint', tx: 6, ty: 6, layer: 'cliffsides', column: 2 },
]);

const j = (v) => JSON.stringify(v);

describe('the adapter contract — SHAPE, then BEHAVIOUR', () => {
    it('satisfies `assertAdapter`, and declares the OPTIONAL `bases` member', () => {
        expect(assertAdapter(adapter)).toBe(adapter);
        expect(Object.keys(adapter.bases).sort()).toEqual([...BASE_KINDS].sort());
        // …and the maze, which resolves its base on the page, leaves it absent.
        expect(mazeEditAdapter.bases).toBeUndefined();
        expect(assertAdapter(mazeEditAdapter)).toBe(mazeEditAdapter);
    });

    it('⛓⛓⛓ A1 §9.8 CLOSED — `assertAdapterBehaviour` passes on BOTH adapters, so the '
        + 'contract now has behaviour and not only shape', () => {
        expect(assertAdapterBehaviour(adapter, {
            record: room(),
            op: { op: 'paint', tx: 4, ty: 4, column: 21 },
            refused: { op: 'remove', tx: 9, ty: 9 },
            cell: { x: 3, y: 3 },
            other: { x: 8, y: 8 },
        })).toBe(true);
        expect(assertAdapterBehaviour(bare, {
            record: room(),
            op: { op: 'paint', tx: 4, ty: 4, terrain: 'wall' },
            refused: { op: 'remove', tx: 9, ty: 9 },
        })).toBe(true);
        const world = generateStep({ seed: 5, step: 3, width: 7, height: 7 }).record;
        expect(assertAdapterBehaviour(mazeEditAdapter, {
            record: world,
            // ⚠ (2,1) is a free floor cell of this world, MEASURED — law 4 needs an
            // op that actually changes the record, and `_setTile` returns ok:true for
            // a click that changed nothing ("Tile (3,3) already floor.", trap 263).
            op: { op: 'setBlock', x: 2, y: 1 },
            refused: { op: 'setTile', x: 99, y: 99, tile: 'wall' },
            cell: { x: 1, y: 1 },
            other: { x: 4, y: 1 },
        })).toBe(true);
    });

    /**
     * ⛓⛓ THE MUTANTS OF THE CONTRACT ITSELF — a behaviour check nobody can
     * break is not a check. Each row breaks ONE law on a wrapper around the
     * real adapter and asserts the sentence names that law.
     */
    it.each([
        ['1 bounds', { bounds: () => ({ w: 0, h: 3 }) }, /contract law 1/],
        ['2 apply', { apply: () => ({ oops: true }) }, /contract law 2/],
        ['3 mutation', {
            apply(record, op) {
                const res = adapter.apply(record, op);
                if (res.ok) record.entities.push({ type: 'x', x: 0, y: 0 });
                return res;
            },
        }, /contract law 3/],
        ['4 equal', { equal: () => true }, /contract law 4/],
        ['5 refusal', { apply: (r, o) => ({ ...adapter.apply(r, o), ok: true }) }, /contract law 5/],
        ['6 writeOps', { writeOps: () => 'nope' }, /contract law 6/],
        ['7 inverse', { writeOps: () => [] }, /contract law 7/],
    ])('⛓ MUTANT: law %s goes RED', (_name, override, re) => {
        // ⚠ law 3's mutant needs a MUTABLE record; every other law is happy with
        // the frozen one the constructors return.
        const record = JSON.parse(JSON.stringify(room()));
        expect(() => assertAdapterBehaviour({ ...adapter, ...override }, {
            record,
            op: { op: 'paint', tx: 4, ty: 4, column: 21 },
            refused: { op: 'remove', tx: 9, ty: 9 },
            cell: { x: 3, y: 3 },
            other: { x: 8, y: 8 },
        }), _name).toThrow(re);
    });
});

describe('⛓⛓⛓ THE TWO FOLDS AGREE — a session apply ≡ a direct applyEdit', () => {
    const SAMPLES = {
        paint: { op: 'paint', tx: 4, ty: 4, column: 21 },
        place: { op: 'place', tx: 7, ty: 7, type: 'lock', attrs: { tset: '0', tag: '-1' } },
        attrs: { op: 'attrs', tx: 3, ty: 3, attrs: {} },
        remove: { op: 'remove', tx: 3, ty: 3 },
        nodes: { op: 'nodes', tx: 5, ty: 5, nodes: [{ x: 96, y: 80 }] },
        resize: { op: 'resize', width: 16, height: 16 },
    };

    it('⛓ the sample roster IS `EDIT_OPS` — trap 574: a hand list would go quiet the day '
        + 'a seventh op arrived', () => {
        expect(Object.keys(SAMPLES).sort()).toEqual([...EDIT_OPS].sort());
    });

    it.each(EDIT_OPS)('%s: session.apply ≡ watchEdit.applyEdit', (name) => {
        const base = room();
        const session = createEditSession(adapter, base);
        const res = session.apply(SAMPLES[name]);
        expect(res.ok, res.description).toBe(true);
        expect(j(session.record())).toBe(j(applyEdit(base, SAMPLES[name], { schema: SCHEMA })));
    });

    it('⛓⛓ `foldEdits` ≡ `applyEdits` over a mixed list of SIX ops including a group', () => {
        const base = room();
        const ops = [
            SAMPLES.paint,
            group('stroke', [
                { op: 'paint', tx: 5, ty: 4, column: 3 },
                { op: 'paint', tx: 5, ty: 5, column: 3 },
            ]),
            SAMPLES.place,
            { op: 'attrs', tx: 7, ty: 7, attrs: { tset: '2', tag: '4' } },
            SAMPLES.nodes,
            { op: 'paint', tx: 2, ty: 2, layer: 'cliffsides', column: 4 },
            SAMPLES.resize,
        ];
        const folded = foldEdits(adapter, base, ops);
        expect(folded.dropped).toEqual([]);
        expect(j(folded.record)).toBe(j(applyEdits(base, ops, { schema: SCHEMA })));
        expect(folded.steps.length).toBe(ops.length);
    });

    it('⛓⛓ UNDO — the session\'s shorter FOLD ≡ `watchEdit.undoEdit`, at every depth', () => {
        const base = room();
        const ops = [SAMPLES.paint, SAMPLES.place, SAMPLES.nodes, SAMPLES.remove];
        const session = createEditSession(adapter, base);
        let state = { record: base, edits: [] };
        for (const op of ops) {
            expect(session.apply(op).ok, j(op)).toBe(true);
            state = { ...state, record: applyEdit(state.record, op, { schema: SCHEMA }), edits: [...state.edits, op] };
        }
        for (let depth = ops.length; depth > 0; depth -= 1) {
            expect(j(session.record()), `depth ${depth}`).toBe(j(state.record));
            session.undo();
            state = undoEdit({ ...state, baseRecord: base }, { schema: SCHEMA });
        }
        expect(j(session.record())).toBe(j(base));
    });

    it('⛓ a no-op is DROPPED from the identity by the same rule on both sides', () => {
        const base = room();
        const same = { op: 'paint', tx: 4, ty: 4, terrain: 'ground' };
        expect(tileCellAt(base, 4, 4).terrain).toBe('ground');
        const folded = foldEdits(adapter, base, [same]);
        expect(folded.applied).toEqual([]);
        expect(folded.dropped.length).toBe(1);
        expect(j(folded.record)).toBe(j(base));
    });

    it('⛔ a refusal is ONE catch at the adapter and NAMES THE CLASS', () => {
        const base = room();
        expect(adapter.apply(base, { op: 'remove', tx: 9, ty: 9 }))
            .toMatchObject({ ok: false, reason: 'WatchEditError' });
        // …and a REC0RD-level refusal comes back as one too, under its own class.
        expect(adapter.apply(base, { op: 'resize', width: 4, height: 4 }))
            .toMatchObject({ ok: false, reason: 'ProcgenLevelError' });
        expect(adapter.apply(base, { op: 'paint', tx: 99, ty: 99, column: 0 }))
            .toMatchObject({ ok: false, reason: 'ProcgenLevelError' });
        /**
         * ⚠ AND ANYTHING ELSE IS **NOT** CAUGHT — a defect must not read as a
         * refusal. ⛔ The first spelling of this row raised its error OUTSIDE
         * the adapter's `try` (a wrapper whose own `apply` threw), so it passed
         * against a `catch` that swallowed EVERYTHING — a mutant-invisible row.
         * A record whose `entities` is not an array throws a `TypeError` from
         * `withEntities`, INSIDE the try, which is where the discrimination is.
         */
        const malformed = { ...base, entities: 5 };
        expect(() => adapter.apply(malformed, { op: 'place', tx: 1, ty: 1, type: 'button', attrs: {} }))
            .toThrow(TypeError);
    });
});

describe('⛓⛓ readCell / writeOps — the THREE-WAY descriptor', () => {
    it('a cell reads as {tile, cliff, entities}, and `cliff` is a FIELD even in a room '
        + 'with no cliffsides layer', () => {
        const plain = emptyLevel({ level: 1 });
        expect(layerNamed(plain, 'cliffsides')).toBeNull();
        const d = readSeedlingCell(plain, 4, 4);
        expect(Object.keys(d).sort()).toEqual(['cliff', 'entities', 'tile']);
        expect(d.cliff).toBeNull();
    });

    it('a cell holding TWO bodies reports both, in order', () => {
        const d = readSeedlingCell(room(), 3, 3);
        expect(d.entities.map((e) => e.type)).toEqual(['button', 'pushableblock']);
    });

    it('⛓ a rope\'s nodes are RELATIVE to the cell, so a paste keeps the SPAN', () => {
        const d = readSeedlingCell(room(), 5, 5);
        expect(d.entities[0].nodes).toEqual([{ dx: 48, dy: 0 }]);
        const moved = foldEdits(adapter, emptyLevel({ level: 1, width: 12, height: 12 }),
            [group('paste', seedlingWriteOps(d, 8, 9))]);
        const back = readSeedlingCell(moved.record, 8, 9);
        expect(back.entities[0].nodes).toEqual([{ dx: 48, dy: 0 }]);
        expect(moved.record.entities[0].nodes).toEqual([{ x: 8 * 16 + 48, y: 9 * 16 }]);
    });

    it('⛓⛓⛓ §9.3\'s LESSON — the descriptor is written at a DIFFERENT cell and read '
        + 'back, because a fixed point on an UNCHANGED cell distinguishes nothing', () => {
        const src = room();
        const blank = emptyLevel({ level: 1, width: 12, height: 12 });
        for (const [sx, sy] of [[3, 3], [5, 5], [6, 6], [0, 0]]) {
            const d = readSeedlingCell(src, sx, sy);
            const out = foldEdits(adapter, blank, [group('w', seedlingWriteOps(d, 9, 10))]);
            expect(j(readSeedlingCell(out.record, 9, 10)), `${sx},${sy}`).toBe(j(d));
        }
    });

    it('⛔ BOUND 1 — a paste does NOT clear the destination\'s bodies; it ACCUMULATES', () => {
        const src = room();
        const d = readSeedlingCell(src, 3, 3);
        const onto = foldEdits(adapter, src, [group('w', seedlingWriteOps(d, 3, 3))]);
        expect(readSeedlingCell(onto.record, 3, 3).entities.map((e) => e.type))
            .toEqual(['button', 'pushableblock', 'button', 'pushableblock']);
    });

    it('⛓ the THREE-WAY filter — `only` keeps one descriptor field, and each writes '
        + 'only its own', () => {
        const src = room();
        const blank = emptyLevel({ level: 1, width: 12, height: 12 });
        const clip = rectCopy(adapter, src, { x: 3, y: 3, w: 4, h: 4 });
        const tiles = foldEdits(adapter, blank, [rectPasteOps(adapter, blank, clip, 3, 3, { only: 'tile' })]);
        expect(readSeedlingCell(tiles.record, 3, 3).entities).toEqual([]);
        const ents = foldEdits(adapter, blank, [rectPasteOps(adapter, blank, clip, 3, 3, { only: 'entities' })]);
        expect(readSeedlingCell(ents.record, 3, 3).entities.map((e) => e.type))
            .toEqual(['button', 'pushableblock']);
        const cliffs = foldEdits(adapter, blank, [rectPasteOps(adapter, blank, clip, 3, 3, { only: 'cliff' })]);
        expect(layerNamed(cliffs.record, 'cliffsides').tiles.length).toBe(1);
        expect(readSeedlingCell(cliffs.record, 3, 3).entities).toEqual([]);
        expect(rectPasteOps(adapter, blank, clip, 3, 3, { only: 'cliff' }).label)
            .toBe('paste cliff 4x4 at (3,3)');
    });

    it('⛓ the MAZE\'s two-way filters are untouched — the booleans are aliases into the '
        + 'same field selector', () => {
        const world = generateStep({ seed: 5, step: 3, width: 7, height: 7 }).record;
        const clip = rectCopy(mazeEditAdapter, world, { x: 1, y: 1, w: 2, h: 2 });
        expect(rectPasteOps(mazeEditAdapter, world, clip, 3, 3, { tilesOnly: true }).label)
            .toBe('paste tile 2x2 at (3,3)');
        expect(() => rectPasteOps(mazeEditAdapter, world, clip, 3, 3,
            { tilesOnly: true, entitiesOnly: true })).toThrow(/two filters that cancel/);
        // ⛔ …and a filter the maze's descriptor has no field for still refuses BY NAME.
        expect(() => rectPasteOps(mazeEditAdapter, world, clip, 3, 3, { only: 'cliff' }))
            .toThrow(/it has no `cliff` field/);
    });
});

describe('⛓⛓⛓ §3.2\'s `base` UNION — two resolved, two refused by name', () => {
    it('⚖ RULING 2 — the atlas base MATCHES the vanilla content hash', () => {
        const r = resolveBase(adapter, { kind: 'atlas', set_id: VANILLA_SET_ID, level: 14 });
        expect(r.level).toBe(14);
        expect(j(r)).toBe(j(SOURCE(14)));
    });

    it('⛔ ⚖ RULING 2 — a MISMATCHED set_id refuses, in the save stamp\'s own shape', () => {
        expect(() => resolveBase(adapter,
            { kind: 'atlas', set_id: 'seedling-vanilla-deadbeef', level: 14 }))
            .toThrow(/names set_id "seedling-vanilla-deadbeef" and the vanilla set here is/);
        expect(() => resolveBase(adapter,
            { kind: 'atlas', set_id: 'seedling-vanilla-deadbeef', level: 14 }))
            .toThrow(/CONTENT HASH/);
    });

    it('⛔ an atlas base with no injected level source or set id refuses BY NAME', () => {
        expect(() => resolveBase(createSeedlingEditAdapter(),
            { kind: 'atlas', set_id: VANILLA_SET_ID, level: 0 })).toThrow(/needs a `levelSource`/);
        expect(() => resolveBase(createSeedlingEditAdapter({ levelSource: SOURCE }),
            { kind: 'atlas', set_id: VANILLA_SET_ID, level: 0 })).toThrow(/needs the vanilla set's `set_id`/);
    });

    it('⛓ the `oel` base parses pasted XML into a record — through the INJECTED parser', () => {
        const src = SOURCE(14);
        const r = resolveBase(adapter, { kind: 'oel', xml: recordToOel(src), level: 14, class: src.class, path: src.path });
        const core = (x) => j({ width: x.width, height: x.height, layers: x.layers, entities: x.entities });
        expect(core(r)).toBe(core(src));
        expect(r.level).toBe(14);
        expect(() => resolveBase(createSeedlingEditAdapter(), { kind: 'oel', xml: '<level/>' }))
            .toThrow(/needs a `parseOel`/);
    });

    it('⛔ `generate` and `set-room` are MEMBERS that refuse — a kind that is somebody '
        + 'else\'s job gets a sentence, not a "no such kind"', () => {
        expect(() => resolveBase(adapter, { kind: 'generate', seed: 1 }))
            .toThrow(/it is the GENERATE ladder's identity/);
        expect(() => resolveBase(adapter, { kind: 'set-room', set_id: 'x', room: 3 }))
            .toThrow(/loading a set is the level-set arm's/);
        // …and a kind outside the union gets the other sentence.
        expect(() => resolveBase(adapter, { kind: 'nope' }))
            .toThrow(/is not a base kind the seedling adapter resolves/);
    });

    it('⛔ an adapter with no `bases` says so, rather than saying "unknown kind"', () => {
        expect(() => resolveBase(mazeEditAdapter, { kind: 'maze-lab' }))
            .toThrow(/declares no `bases`/);
        expect(() => assertAdapter({ ...adapter, bases: 'atlas' }))
            .toThrow(/`bases` is OPTIONAL, but when it is present/);
    });

    it('⛓ every one of §3.2\'s four kinds is a member — the union is not a subset', () => {
        expect(BASE_KINDS).toEqual(['generate', 'atlas', 'oel', 'set-room']);
        for (const k of BASE_KINDS) expect(typeof adapter.bases[k], k).toBe('function');
    });

    it('⛓ the vanilla set_id this slice pins is the one the committed fixture stamps, '
        + 'and it is a CONTENT hash of the 116 rooms', () => {
        expect(VANILLA_SET_ID).toMatch(/^seedling-vanilla-[0-9a-f]{8}$/);
        expect(loadAtlas().levels.length).toBe(116);
    });
});
