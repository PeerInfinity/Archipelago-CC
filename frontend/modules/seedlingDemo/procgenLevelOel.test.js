// Unit tests for the record → OEL writer (Phase 5 of
// CC/docs/plans/seedling-external-level-sets.md).
//
// ⛓ THE ORACLE IS THE OTHER IMPLEMENTATION, NOT A SECOND DESCRIPTION OF THE
// FORMAT. `scripts/procgen/seedlingOgmo.js` is the repo's one OEL READER, written
// for the atlas extract and in use since long before this arc; `recordToOel` is
// the one WRITER. Asserting `parse(render(r))` deep-equals `r` tests them
// against each other. A second hand-maintained "here is what OEL looks like"
// inside this file would share the writer's assumptions and prove nothing about
// either — this arc has already recorded that failure twice (§9.4, and Phase
// 3b's original model-side replay).
//
// ⚠ BY VALUE, NEVER BY BYTES, AND THE CORPUS IS WHY. `treelarge.oel` carries
// `text="…Press &lt;W> to hear…"` — a RAW `>` inside an attribute value, legal
// XML, which this writer emits as `&gt;`. Same value, different bytes. A
// byte-comparison would fail there and would be measuring the encoder's taste.
//
// ⛔ WHAT THIS FILE'S CORPUS ARM DOES AND DOES NOT BOUND. The 116 rooms below
// are the REDUCED vanilla OEL (`seedling-vanilla-room-refs.json`): every element
// bearing a cross-reference or persistence attribute, with the tile grid and
// untagged decoration dropped (§9.4). So they carry 63 distinct element kinds
// and the real attribute values, and NO tiles and NO <node> children and no
// escaped characters — the fixture contains not one `&`. Those three surfaces
// are covered synthetically below, deliberately and by name, rather than left to
// a corpus that cannot reach them. The full 1.38 MB corpus round trip is a
// MEASUREMENT recorded in the plan's Phase 5 as-built; it needs the AS3 checkout
// and so cannot be a test here.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { loadAtlas } from './levelSource.js';
import { emptyLevel } from './procgenLevel.js';
import { canonicalJson, foldEdits, group } from '../procgenCore/editCore.js';
import {
    createSeedlingEditAdapter, readSeedlingCell, seedlingWriteOps,
} from './seedlingEditAdapter.js';

import { describe, it, expect } from 'vitest';

import { parseOelLevel } from '../../../scripts/procgen/seedlingOgmo.js';
import { recordToOel, escapeXmlAttr, ProcgenOelError } from './procgenLevelOel.js';

const VANILLA_REFS = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/seedling-vanilla-room-refs.json', import.meta.url)), 'utf8',
));

// The reduced fixture is `<level><objects>…</objects></level>` with no
// <width>/<height> — it was built to feed the validator's regex, which does not
// need them. `parseOelLevel` requires them, so the arm gives every room the same
// size. That size is never asserted; only the entity round trip is.
const sized = (xml) => xml.replace('<level>', '<level>\n  <width>640</width>\n  <height>640</height>');

/** parse → render → parse, the property under test. */
const reparse = (record) => parseOelLevel(recordToOel(record), '<rendered>');

describe('recordToOel — the inverse of the repo\'s one OEL reader', () => {
    it('round-trips all 116 reduced vanilla rooms by value', () => {
        const ids = Object.keys(VANILLA_REFS.rooms);
        expect(ids).toHaveLength(116);
        const kinds = new Set();
        for (const id of ids) {
            const once = parseOelLevel(sized(VANILLA_REFS.rooms[id]), `room ${id}`);
            once.entities.forEach((e) => kinds.add(e.type));
            expect(reparse(once), `room ${id} did not survive the round trip`).toEqual(once);
        }
        // The corpus's own breadth, asserted so a fixture that quietly shrank
        // could not make this arm pass by covering less.
        expect(kinds.size).toBeGreaterThanOrEqual(60);
    });

    it('converts TILES to PIXELS in both places, and only those places', () => {
        const record = {
            width: 10,
            height: 4,
            layers: [{ name: 'tiles', set: 'tileset', tiles: [[0, 0, 48, 0], [9, 3, 64, 16]] }],
            entities: [{ type: 'statue2', x: 184, y: 7 }],
        };
        const xml = recordToOel(record);
        expect(xml).toContain('<width>160</width>');
        expect(xml).toContain('<height>64</height>');
        // tile: x/y scaled, tx/ty raw.
        expect(xml).toContain('<tile tx="64" ty="16" x="144" y="48"/>');
        // ⚠ entity coordinates are RAW PIXELS and are NOT grid-aligned — the
        // real `statue2` in OverWorld.oel sits at x=184. Scaling them would be
        // invisible in any test whose entities all happened to land on the grid.
        expect(xml).toContain('<statue2 x="184" y="7"/>');
        expect(reparse(record)).toEqual(record);
    });

    it('keeps <node> children — a rope without them is a 16x16 stub', () => {
        const record = {
            width: 4,
            height: 4,
            layers: [],
            entities: [{ type: 'rope', x: 16, y: 32, attrs: { tag: '3' }, nodes: [{ x: 96, y: 32 }] }],
        };
        const back = reparse(record);
        expect(back.entities[0].nodes).toEqual([{ x: 96, y: 32 }]);
        expect(back.entities[0].attrs).toEqual({ tag: '3' });
    });

    it('emits <objects> even when a room has none', () => {
        const xml = recordToOel({ width: 2, height: 2, layers: [], entities: [] });
        expect(xml).toContain('<objects>');
        expect(reparse({ width: 2, height: 2, layers: [], entities: [] }).entities).toEqual([]);
    });

    it('gives a layer its `set` back only when it had one', () => {
        const withSet = reparse({ width: 2, height: 2, layers: [{ name: 'tiles', set: 'tileset', tiles: [] }], entities: [] });
        expect(withSet.layers[0].set).toBe('tileset');
        const without = reparse({ width: 2, height: 2, layers: [{ name: 'cliffsides', set: null, tiles: [] }], entities: [] });
        expect(without.layers[0].set).toBe(null);
    });
});

// ⛔ THE ESCAPING SURFACE THE CORPUS FIXTURE CANNOT REACH. The reduced fixture
// contains not one `&`, so without these the writer could emit raw ampersands
// and every test above would still pass — while the game's E4X parser aborted on
// `new XML(str)` inside the wasm, which is a dead page rather than a message.
describe('attribute escaping', () => {
    it('escapes & < > and " — and & FIRST, so nothing is double-escaped', () => {
        expect(escapeXmlAttr('a & b')).toBe('a &amp; b');
        expect(escapeXmlAttr('<w>')).toBe('&lt;w&gt;');
        expect(escapeXmlAttr('say "hi"')).toBe('say &quot;hi&quot;');
        // The order test: an already-escaped entity must come back as the same
        // TEXT, not as a double-escaped one. `&lt;` → `&amp;lt;` is correct
        // encoding of the literal five characters, and decoding gives them back.
        expect(escapeXmlAttr('&lt;')).toBe('&amp;lt;');
    });

    // The literal from treelarge.oel's rekcahdam dialogue, which is the reason
    // the repo's XML reader is a character scanner and not a regex.
    it('round-trips the real dialogue that carries a raw > inside a value', () => {
        const text = 'Approach the tree and press <W> to hear it speak.~It said "why?" & left.';
        const record = {
            width: 2, height: 2, layers: [],
            entities: [{ type: 'rekcahdam', x: 0, y: 0, attrs: { text, frames: '3' } }],
        };
        expect(reparse(record).entities[0].attrs.text).toBe(text);
    });
});

// A writer that accepted everything would move the failure into the wasm, where
// it is an abort with no message. Every refusal below names its own cause.
describe('recordToOel REFUSES rather than emitting something the game discards', () => {
    const base = { width: 4, height: 4, layers: [], entities: [] };

    // ⛔ THE ONE THAT MATTERS MOST. Ogmo lets an author paint past the level
    // rectangle and 51 shipped levels do; the game's loader guards each
    // placement and silently ignores those. A GENERATED record has no such
    // history, so an out-of-rectangle cell is a generator bug — and emitting it
    // would leave the game without a tile this record says the room contains.
    it('refuses a tile outside the level rectangle, naming the silent drop', () => {
        const bad = { ...base, layers: [{ name: 'tiles', set: 'tileset', tiles: [[4, 0, 48, 0]] }] };
        expect(() => recordToOel(bad)).toThrow(ProcgenOelError);
        expect(() => recordToOel(bad)).toThrow(/outside the 4x4 rectangle/);
        expect(() => recordToOel(bad)).toThrow(/drop it silently/);
    });

    it('refuses attrs.x — position lives in one place, never two', () => {
        const bad = { ...base, entities: [{ type: 'lock', x: 0, y: 0, attrs: { x: '96' } }] };
        expect(() => recordToOel(bad)).toThrow(/duplicates the entity's own x/);
    });

    it('refuses an entity type that is not a legal element name', () => {
        expect(() => recordToOel({ ...base, entities: [{ type: 'not a tag', x: 0, y: 0 }] }))
            .toThrow(/not a legal XML element name/);
    });

    it('refuses non-integer geometry rather than emitting NaN', () => {
        expect(() => recordToOel({ ...base, width: 4.5 })).toThrow(/record.width must be an integer/);
        expect(() => recordToOel({ ...base, entities: [{ type: 'lock', x: 1.5, y: 0 }] }))
            .toThrow(/entities\[0\].x must be an integer/);
    });

    it('refuses a tile entry that is not [x, y, tx, ty]', () => {
        expect(() => recordToOel({ ...base, layers: [{ name: 'tiles', set: null, tiles: [[0, 0, 48]] }] }))
            .toThrow(/must be \[x, y, tx, ty\] in tiles/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 · SLICE B — **THE VANILLA ROUND TRIP**, over all 116
 *
 * The gate that proves the WIDENED model is the GAME's. Slice B taught the
 * editor about 45 tile columns, a second tile layer, typed attributes and
 * `<node>` children; the question this section asks is whether a record that
 * carries all of that still means the room the game loads.
 *
 * ⛓ THREE ARMS, AND THEY ARE NOT THE SAME CLAIM:
 *
 *   (a) `record → recordToOel → parseOelLevel → record′` — a FIXED POINT, and
 *       by itself it proves only that the writer and the reader agree. ⚠ Trap
 *       "a fixed point tests SELF-CONSISTENCY, never correctness": a
 *       consistently-wrong pair round-trips perfectly.
 *   (b) `parseOelLevel(THE DISK OEL) → record″` value-equal to the ATLAS
 *       record. That is the arm with a second source in it — the committed
 *       extract was produced by a DIFFERENT walk over the same files — and it
 *       is what makes (a) mean something.
 *   (c) BYTE identity against the disk file. A **MEASUREMENT**, never an
 *       assertion, and its three difference classes are named below.
 *
 * (b) and (c) need the AS3 checkout, so they skip when it is absent — the row
 * NAMES that, because a silently-skipped arm is an unmade claim wearing a green
 * tick.
 * ══════════════════════════════════════════════════════════════════════ */

const ATLAS = loadAtlas();
const SEEDLING = process.env.SEEDLING_SRC ?? join(homedir(), 'CC', 'seedling');
const HAVE_CHECKOUT = existsSync(join(SEEDLING, 'assets', 'levels'));

/**
 * ⛓ THE COMPARABLE HALF OF A RECORD. ⛔ `tiles_outside_level` is EXCLUDED and
 * that is not a convenience: it is a count of placements the parser DISCARDED
 * from the disk file (51 of the 116 rooms paint past their own rectangle), so
 * it is a fact about that FILE and not about the room. A re-rendered record has
 * no out-of-rectangle tiles to drop — `recordToOel` refuses one — so demanding
 * the key back would be demanding the round trip reproduce history.
 */
const roomOf = (r) => JSON.stringify({
    width: r.width, height: r.height, layers: r.layers, entities: r.entities,
});

describe('⛓⛓⛓ THE VANILLA ROUND TRIP — all 116 rooms', () => {
    it('(a) FIXED POINT: every room survives record → OEL → record, by VALUE', () => {
        let ok = 0;
        const bad = [];
        for (const level of ATLAS.levels) {
            const back = parseOelLevel(recordToOel(level), level.path);
            if (roomOf(back) === roomOf(level)) ok += 1; else bad.push(level.level);
        }
        expect(bad).toEqual([]);
        expect(ok).toBe(116);
    });

    it('(a′) …and the arm is NOT vacuous: one changed attribute breaks it', () => {
        const level = ATLAS.levels.find((l) => l.entities.some((e) => e.attrs));
        const mutant = {
            ...level,
            entities: level.entities.map((e, i) => (i === level.entities.findIndex((x) => x.attrs)
                ? { ...e, attrs: { ...e.attrs, [Object.keys(e.attrs)[0]]: 'MUTANT' } } : e)),
        };
        expect(roomOf(parseOelLevel(recordToOel(mutant), 'm'))).not.toBe(roomOf(level));
    });

    it.skipIf(!HAVE_CHECKOUT)('(b) THE INDEPENDENT PARSER: parsing the DISK OEL reproduces '
        + 'the committed atlas record, 116/116 — needs ~/CC/seedling', () => {
        let ok = 0;
        const bad = [];
        for (const level of ATLAS.levels) {
            const disk = readFileSync(join(SEEDLING, level.path), 'utf8');
            if (roomOf(parseOelLevel(disk, level.path)) === roomOf(level)) ok += 1;
            else bad.push(level.level);
        }
        expect(bad).toEqual([]);
        expect(ok).toBe(116);
    });

    it.skipIf(!HAVE_CHECKOUT)('(c) BYTE IDENTITY IS A MEASUREMENT — 0/116 exact, 64/116 '
        + 'modulo the trailing newline, and exactly THREE difference classes', () => {
        let exact = 0;
        let modNewline = 0;
        const classes = { newlineOnly: [], droppedOutside: [], escaping: [] };
        for (const level of ATLAS.levels) {
            const mine = recordToOel(level);
            const disk = readFileSync(join(SEEDLING, level.path), 'utf8');
            if (mine === disk) exact += 1;
            if (mine.replace(/\n$/, '') === disk) { modNewline += 1; classes.newlineOnly.push(level.level); continue; }
            if (level.tiles_outside_level) classes.droppedOutside.push(level.level);
            else classes.escaping.push(level.level);
        }
        /**
         * ⛓⛓ THE THREE CLASSES, EACH A KNOWN AND DOCUMENTED PROPERTY OF THIS
         * WRITER — which is what makes 0/116 a BOUND rather than a defect:
         *
         *  1. **the trailing newline** — every one of the 116. This writer ends
         *     its document with `\n`; Ogmo does not. ⛔ NOT FIXED HERE: the
         *     output is `source.xml` in committed level-set artifacts, and
         *     dropping the newline would move a fixture this slice must not
         *     touch. Slice C or the level-set arm can pay for it.
         *  2. **dropped out-of-rectangle tiles** — 51 rooms. Ogmo lets an author
         *     paint past the level rectangle and the game's loader silently
         *     discards those; the extract discards them too and COUNTS them in
         *     `tiles_outside_level`, so the record no longer holds tiles the
         *     disk file does. A writer that re-emitted them would need history
         *     the record deliberately does not carry.
         *  3. **attribute escaping** — exactly ONE room. `treelarge.oel`
         *     (level 94) carries a RAW `>` inside an attribute value, legal XML,
         *     which this writer emits as `&gt;`. Same value, different bytes —
         *     the docblock at the top of this file has named it since Phase 5.
         */
        expect(exact).toBe(0);
        expect(modNewline).toBe(64);
        expect(classes.droppedOutside.length).toBe(51);
        expect(classes.escaping).toEqual([94]);
        expect(classes.newlineOnly.length + classes.droppedOutside.length
            + classes.escaping.length).toBe(116);
        // ⛓ …and class 2 IS the `tiles_outside_level` set, not merely the same size.
        expect(classes.droppedOutside.sort((a, b) => a - b))
            .toEqual(ATLAS.levels.filter((l) => 'tiles_outside_level' in l)
                .map((l) => l.level).sort((a, b) => a - b));
    });
});

describe('⛓⛓ readCell → writeOps → readCell over WHOLE vanilla rooms', () => {
    const adapter = createSeedlingEditAdapter({
        schema: JSON.parse(readFileSync(fileURLToPath(
            new URL('./fixtures/seedling-ogmo-schema.json', import.meta.url)), 'utf8')),
    });
    const LEVELS = [0, 14, 94];
    const at = (record, tx, ty) => readSeedlingCell(record, tx, ty);
    const write = (record, d, tx, ty) => foldEdits(adapter, record,
        [group('rt', seedlingWriteOps(d, tx, ty))]).record;

    /**
     * ⛓⛓⛓ **THE COMPARISON IS `canonicalJson`, AND THAT IS A FINDING.**
     *
     * A vanilla record's `attrs` carry the ORDER the level's author wrote them
     * in (`to playerx playery show tag invert sign` on a teleporter, straight
     * out of the XML). Every op path canonicalises to SORTED — `normalizeAttrs`
     * has since slice 11, because the edit list is compared byte for byte
     * between a payload and a page and two pages that typed the same attributes
     * in a different order must produce one payload.
     *
     * ⇒ **an editor that rewrites a vanilla cell re-orders that entity's
     * attributes in the OEL.** Value-inert, byte-visible, and named here rather
     * than found by somebody diffing a saved room. `canonicalJson` (keys sorted
     * at every depth) is the equality a DESCRIPTOR takes — `editCore`'s own
     * docblock says why an adapter-assembled value needs it, and this is the
     * corpus that proves it.
     */
    it.each(LEVELS)('level %i — the TILE and CLIFF halves are a fixed point at EVERY cell',
        (id) => {
            const record = ATLAS.levels.find((l) => l.level === id);
            let cells = 0;
            const bad = [];
            for (let ty = 0; ty < record.height; ty += 1) {
                for (let tx = 0; tx < record.width; tx += 1) {
                    cells += 1;
                    const d = at(record, tx, ty);
                    for (const field of ['tile', 'cliff']) {
                        if (d[field] === null) continue;
                        const half = { [field]: d[field] };
                        const back = at(write(record, half, tx, ty), tx, ty);
                        if (canonicalJson(back[field]) !== canonicalJson(d[field])) {
                            bad.push(`${field} ${tx},${ty}`);
                        }
                    }
                }
            }
            expect(bad.slice(0, 5)).toEqual([]);
            expect(cells).toBe(record.width * record.height);
        });

    it.each(LEVELS)('level %i — the WHOLE descriptor is a fixed point on the cells that '
        + 'hold NO body, and ACCUMULATES on the ones that do (⚠ the adapter\'s bound 1)',
    (id) => {
        const record = ATLAS.levels.find((l) => l.level === id);
        let empty = 0;
        let occupied = 0;
        const bad = [];
        for (let ty = 0; ty < record.height; ty += 1) {
            for (let tx = 0; tx < record.width; tx += 1) {
                const d = at(record, tx, ty);
                const back = at(write(record, d, tx, ty), tx, ty);
                if (d.entities.length === 0) {
                    empty += 1;
                    if (canonicalJson(back) !== canonicalJson(d)) bad.push(`${tx},${ty}`);
                } else {
                    occupied += 1;
                    // ⛔ THE BOUND, ASSERTED RATHER THAN AVOIDED: Seedling has no
                    // clear-cell op, so a paste ADDS. The bodies double, in order.
                    if (canonicalJson(back.entities)
                        !== canonicalJson([...d.entities, ...d.entities])) {
                        bad.push(`accumulation ${tx},${ty}`);
                    }
                }
            }
        }
        expect(bad.slice(0, 5)).toEqual([]);
        expect(empty).toBeGreaterThan(0);
        expect(occupied).toBeGreaterThan(0);
    });

    /**
     * ⛓⛓⛓ **§9.3's LESSON, AT CORPUS SCALE.** The rows above are fixed points on
     * an UNCHANGED cell and therefore distinguish almost nothing — a `writeOps`
     * returning `[]` passes every one of level 0's 400 cells. This row writes
     * each DISTINCT descriptor at a cell of an EMPTY room and reads it back,
     * which is the question that has an inverse in it.
     */
    it.each(LEVELS)('level %i — every DISTINCT descriptor survives being written '
        + 'SOMEWHERE ELSE', (id) => {
        const record = ATLAS.levels.find((l) => l.level === id);
        const blank = emptyLevel({ level: 999, width: 12, height: 12 });
        const seen = new Map();
        for (let ty = 0; ty < record.height; ty += 1) {
            for (let tx = 0; tx < record.width; tx += 1) {
                const d = at(record, tx, ty);
                seen.set(canonicalJson(d), d);
            }
        }
        const bad = [];
        for (const [key, d] of seen) {
            const ops = seedlingWriteOps(d, 5, 6);
            // ⚠ An ALL-NULL descriptor (a cell the room does not extend to) writes
            // nothing, and there is nothing for it to reproduce.
            if (ops.length === 0) continue;
            if (canonicalJson(at(write(blank, d, 5, 6), 5, 6)) !== key) bad.push(key.slice(0, 90));
        }
        expect(bad).toEqual([]);
        // ⛓ the count is what makes the row non-vacuous.
        expect(seen.size).toBeGreaterThan(3);
    });

    it('⛓ …and THAT row is not vacuous either: a `writeOps` that dropped the bodies '
        + 'fails it', () => {
        const record = ATLAS.levels[0];
        const blank = emptyLevel({ level: 999, width: 12, height: 12 });
        const occupied = [];
        for (let ty = 0; ty < record.height && occupied.length === 0; ty += 1) {
            for (let tx = 0; tx < record.width; tx += 1) {
                if (at(record, tx, ty).entities.length > 0) { occupied.push([tx, ty]); break; }
            }
        }
        const [tx, ty] = occupied[0];
        const d = at(record, tx, ty);
        const dropped = seedlingWriteOps(d, 5, 6).filter((o) => o.op === 'paint');
        const out = foldEdits(adapter, blank, [group('rt', dropped)]).record;
        expect(canonicalJson(at(out, 5, 6))).not.toBe(canonicalJson(d));
    });
});
