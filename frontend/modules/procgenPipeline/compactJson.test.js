// Unit tests for the compact JSON writer (region-atlas plan, Phase 2,
// Deliverable 4). The properties that matter to its callers are the ones the
// atlas identity rides on: a round trip must not change the parsed document
// (so the content hash cannot move), and re-serializing must be byte-stable
// (so `--restamp` on an unedited file produces no diff).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { compactStringify, compactJsonFile, inlineJson, DEFAULT_MAX_INLINE } from './compactJson.js';
import { computeAtlasContentHash, validateRegionAtlas } from './regionAtlasValidator.js';

const FIXTURE_PATH = fileURLToPath(
    new URL('../flashPanel/atlases/seedling-fixture.json', import.meta.url),
);
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

describe('inlineJson', () => {
    it('packs arrays tight and lets objects breathe', () => {
        expect(inlineJson([39, 40])).toBe('[39,40]');
        expect(inlineJson([[39, 40], [39, 41]])).toBe('[[39,40],[39,41]]');
        expect(inlineJson({ x: 0, y: 32 })).toBe('{ "x": 0, "y": 32 }');
        expect(inlineJson([])).toBe('[]');
        expect(inlineJson({})).toBe('{}');
    });

    it('follows JSON.stringify on undefined and functions', () => {
        expect(inlineJson({ a: 1, b: undefined })).toBe('{ "a": 1 }');
        expect(inlineJson([1, undefined, 2])).toBe('[1,null,2]');
        expect(inlineJson({ a: 1, f: () => {} })).toBe('{ "a": 1 }');
    });
});

// A real document never fits on one line, so exercise the writer the way it is
// actually used: as a value inside a document too wide to inline.
const inDoc = (value) => compactStringify({ note: 'x'.repeat(DEFAULT_MAX_INLINE), value });
const lineOf = (out, key) => out.split('\n').find((l) => l.trimStart().startsWith(`"${key}"`));

describe('compactStringify', () => {
    it('keeps a tile pair list on one line — the whole point of this writer', () => {
        expect(lineOf(inDoc([[39, 40], [39, 41], [39, 42]]), 'value'))
            .toBe('  "value": [[39,40],[39,41],[39,42]]');
        // JSON.stringify(…, 2) is what this replaces: one number per line.
        expect(JSON.stringify({ exit_tiles: [[39, 40]] }, null, 2)).toContain('\n      39,');
    });

    it('inlines a short object like bounds', () => {
        expect(lineOf(inDoc({ x: 0, y: 32, w: 40, h: 24 }), 'value'))
            .toBe('  "value": { "x": 0, "y": 32, "w": 40, "h": 24 }');
    });

    it('breaks a list of records one per line even when it would fit', () => {
        expect(inDoc([{ a: 1 }, { b: 2 }])).toContain('"value": [\n    { "a": 1 },\n    { "b": 2 }\n  ]');
    });

    it('applies the record-list rule transitively, so no ancestor inlines it', () => {
        // Without this, a small enough parent would put the whole record list
        // back on one line and undo the rule its child asked for.
        expect(compactStringify({ rs: [{ a: 1 }] })).toBe('{\n  "rs": [\n    { "a": 1 }\n  ]\n}');
    });

    it('expands anything wider than the budget', () => {
        const wide = { k: Array.from({ length: 60 }, (_, i) => i) };
        const out = compactStringify(wide);
        expect(out.split('\n').length).toBeGreaterThan(10);
        expect(JSON.parse(out)).toEqual(wide);
    });

    it('counts the indent against the budget', () => {
        const pair = { deep: { deeper: { deepest: { tiles: [[1, 2], [3, 4]] } } } };
        expect(JSON.parse(compactStringify(pair))).toEqual(pair);
        // A value that fits at depth 0 need not fit at depth 4.
        const value = Array.from({ length: 12 }, (_, i) => i * 1111);
        expect(inlineJson(value).length).toBeLessThan(DEFAULT_MAX_INLINE);
        const nested = compactStringify({ a: { b: { c: { d: { e: value } } } } });
        expect(nested).toContain('\n');
    });

    it('honours indent and maxInline options', () => {
        expect(compactStringify({ a: [{ b: 1 }] }, { indent: 4 })).toBe('{\n    "a": [\n        { "b": 1 }\n    ]\n}');
        expect(compactStringify({ a: [1, 2] }, { maxInline: 1 })).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    });

    it('handles empty containers and nulls', () => {
        expect(compactStringify({ a: [], b: {}, c: null })).toBe('{ "a": [], "b": {}, "c": null }');
    });

    it('compactJsonFile adds exactly one trailing newline', () => {
        const text = compactJsonFile({ a: 1 });
        expect(text).toBe('{ "a": 1 }\n');
    });
});

describe('round-trip guarantees the atlas identity depends on', () => {
    it('leaves the parsed document — and so the content hash — unchanged', () => {
        const before = computeAtlasContentHash(FIXTURE);
        const reparsed = JSON.parse(compactJsonFile(FIXTURE));
        expect(reparsed).toEqual(FIXTURE);
        expect(computeAtlasContentHash(reparsed)).toBe(before);
        expect(validateRegionAtlas(reparsed).ok).toBe(true);
    });

    it('is byte-stable: re-serializing its own output changes nothing', () => {
        const once = compactJsonFile(FIXTURE);
        const twice = compactJsonFile(JSON.parse(once));
        expect(twice).toBe(once);
    });

    it('matches JSON.parse(JSON.stringify(x)) for undefined-bearing input', () => {
        const messy = { a: 1, b: undefined, c: [1, undefined], d: { e: undefined } };
        expect(JSON.parse(compactStringify(messy))).toEqual(JSON.parse(JSON.stringify(messy)));
    });

    it('is far more compact than JSON.stringify(…, 2) on a real atlas', () => {
        const compact = compactJsonFile(FIXTURE).split('\n').length;
        const pretty = `${JSON.stringify(FIXTURE, null, 2)}\n`.split('\n').length;
        expect(compact).toBeLessThan(pretty / 2);
    });
});
