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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
