// frontend/modules/presets/documentBundle.test.js
/**
 * EDITOR v3 slice E1c — the BUNDLE's rows.
 *
 * ⛓ Every claim is against a document this repo already commits, never against
 * a shape invented here: the 259 committed `_rules.json`, the vanilla level set,
 * the three committed region atlases, and an overlay built by the overlay
 * module's own `emptyOverlay()`.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    BUNDLE_ENTRY_NAMES,
    BUNDLE_KINDS,
    BUNDLE_MTIME,
    RULES_SCHEMA_VERSION,
    classifyDocument,
    describeBundle,
    gunzipIfNeeded,
    readBundle,
    writeBundle,
} from './documentBundle.js';
import { canonicalJson } from '../procgenCore/editCore.js';
import { emptyOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import { loadJSZipNode } from '../../../scripts/procgen/loadJSZipNode.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));

const jszip = loadJSZipNode();

const PRESETS_DIR = join(REPO, 'frontend/presets');
const ATLAS_DIR = 'frontend/modules/flashPanel/atlases';

/** ⛓ The corpus is WALKED, not listed — a new preset joins the row by existing. */
function everyCommittedRulesPath(dir = PRESETS_DIR, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) everyCommittedRulesPath(full, out);
        else if (entry.name.endsWith('_rules.json')) out.push(full);
    }
    return out;
}

const VANILLA_SET = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const SMALL_RULES = readJson('frontend/presets/seedling_atlas/AP_1/AP_1_rules.json');
const SMALL_ATLAS = readJson(`${ATLAS_DIR}/seedling-fixture.json`);
const OVERLAY = { ...emptyOverlay(), overlay_id: 'overlay-e1c-row', rooms: { 3: { rules: {} } } };

const FOUR = [
    { kind: 'rules', doc: SMALL_RULES },
    { kind: 'level-set', doc: VANILLA_SET },
    { kind: 'overlay', doc: OVERLAY },
    { kind: 'region-atlas', doc: SMALL_ATLAS },
];

describe('classifyDocument — the kind is the document\'s SHAPE', () => {
    it('classifies every committed _rules.json as `rules`', () => {
        const paths = everyCommittedRulesPath();
        expect(paths.length).toBeGreaterThan(200);
        const wrong = [];
        for (const p of paths) {
            const kind = classifyDocument(JSON.parse(readFileSync(p, 'utf8')));
            if (kind !== 'rules') wrong.push(`${p} → ${kind}`);
        }
        expect(wrong).toEqual([]);
    });

    it('classifies the vanilla level set as `level-set`, never as an atlas', () => {
        expect(classifyDocument(VANILLA_SET)).toBe('level-set');
    });

    it('classifies every committed region atlas as `region-atlas`, never as a set', () => {
        const files = readdirSync(join(REPO, ATLAS_DIR)).filter((f) => f.endsWith('.json'));
        const atlases = files
            .map((f) => [f, readJson(`${ATLAS_DIR}/${f}`)])
            .filter(([, d]) => typeof d.atlas_id === 'string' && Array.isArray(d.regions));
        expect(atlases.length).toBeGreaterThan(0);
        for (const [name, doc] of atlases) {
            expect(`${name} → ${classifyDocument(doc)}`).toBe(`${name} → region-atlas`);
        }
    });

    it('classifies an overlay as `overlay` — `rooms` keyed by index, not an array', () => {
        expect(classifyDocument(OVERLAY)).toBe('overlay');
        expect(classifyDocument(emptyOverlay())).toBe('overlay');
    });

    it('refuses to name a kind for a document that is none of the four', () => {
        // The MAP document — `{levels: […]}` — travels beside an atlas and is
        // not one; an editor payload is `{base, edits}`.
        expect(classifyDocument(readJson(`${ATLAS_DIR}/seedling-map.json`))).toBeNull();
        expect(classifyDocument({ base: { kind: 'atlas' }, edits: [] })).toBeNull();
        expect(classifyDocument(null)).toBeNull();
        expect(classifyDocument([1, 2, 3])).toBeNull();
    });

    it('reads the rules schema version off the writer rather than a literal', () => {
        expect(RULES_SCHEMA_VERSION).toBe(SMALL_RULES.schema_version);
    });
});

describe('writeBundle / readBundle — the four documents round trip', () => {
    it('round trips all four by canonicalJson, and derives the entry names', async () => {
        const bytes = await writeBundle(FOUR, { jszip });
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(notes).toEqual([]);
        expect(members.map((m) => m.kind)).toEqual(BUNDLE_KINDS);
        expect(members.map((m) => m.name)).toEqual(BUNDLE_KINDS.map((k) => BUNDLE_ENTRY_NAMES[k]));
        for (const member of members) {
            const original = FOUR.find((f) => f.kind === member.kind).doc;
            expect(canonicalJson(member.doc)).toBe(canonicalJson(original));
        }
    });

    it('classifies by SHAPE, so a renamed entry still reads back (the name mutant)', async () => {
        const zip = new jszip();
        zip.file('zzz-somebody-renamed-this.json', JSON.stringify(VANILLA_SET));
        zip.file('aaa.json', JSON.stringify(SMALL_ATLAS));
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(notes).toEqual([]);
        expect(members.map((m) => m.kind)).toEqual(['level-set', 'region-atlas']);
        expect(members[0].name).toBe('zzz-somebody-renamed-this.json');
    });

    it('writes DETERMINISTIC bytes — fixed order, fixed mtime', async () => {
        const a = await writeBundle(FOUR, { jszip });
        const b = await writeBundle([...FOUR].reverse(), { jszip });
        expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
        // The mtime DOES reach the bytes — so leaving it to the clock is a real
        // determinism defect, not a hypothetical one.
        const c = await writeBundle(FOUR, { jszip, mtime: new Date(Date.UTC(2020, 0, 1)) });
        expect(Buffer.from(c).equals(Buffer.from(a))).toBe(false);
        expect(BUNDLE_MTIME.getTime()).toBe(Date.UTC(1980, 0, 1));
    });

    it('writes the rules member through stringifyRulesJson at the given indent', async () => {
        for (const indent of [2, 0]) {
            const bytes = await writeBundle([FOUR[0]], { jszip, indent });
            const zip = await jszip.loadAsync(bytes);
            const text = await zip.file(BUNDLE_ENTRY_NAMES.rules).async('string');
            expect(text).toBe(`${stringifyRulesJson(SMALL_RULES, { indent })}\n`);
        }
    });

    it('is smaller at indent 0 and parses to the same object', async () => {
        const two = await writeBundle(FOUR, { jszip, indent: 2 });
        const zero = await writeBundle(FOUR, { jszip, indent: 0 });
        expect(zero.length).toBeLessThan(two.length);
        const back = await readBundle(zero, { jszip });
        for (const member of back.members) {
            const original = FOUR.find((f) => f.kind === member.kind).doc;
            expect(canonicalJson(member.doc)).toBe(canonicalJson(original));
        }
    });
});

describe('readBundle — what it refuses, and what it merely names', () => {
    it('REFUSES a `.chunks.json` member by name (delivery is not a member)', async () => {
        const zip = new jszip();
        zip.file(`${VANILLA_SET.set_id}.chunks.json`, JSON.stringify({ chunks: [] }));
        zip.file('level-set.json', JSON.stringify(VANILLA_SET));
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        await expect(readBundle(bytes, { jszip })).rejects.toThrow(/DELIVERY artefact/);
    });

    it('REFUSES two members of one kind, naming both entries', async () => {
        const zip = new jszip();
        zip.file('a.json', JSON.stringify(VANILLA_SET));
        zip.file('b.json', JSON.stringify(VANILLA_SET));
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        await expect(readBundle(bytes, { jszip })).rejects.toThrow(/TWO `level-set` members/);
    });

    it('NAMES an unclassifiable member instead of dropping it in silence', async () => {
        const zip = new jszip();
        zip.file('level-set.json', JSON.stringify(VANILLA_SET));
        zip.file('notes.json', JSON.stringify({ hello: 'world' }));
        zip.file('README.md', '# not a document');
        zip.file('broken.json', '{ not json');
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(members.map((m) => m.kind)).toEqual(['level-set']);
        expect(notes.join(' | ')).toMatch(/notes\.json/);
        expect(notes.join(' | ')).toMatch(/README\.md/);
        expect(notes.join(' | ')).toMatch(/broken\.json/);
        expect(describeBundle({ members, notes })).toMatch(/level-set/);
    });

    it('refuses a kind writeBundle does not carry', async () => {
        await expect(writeBundle([{ kind: 'sphere-log', doc: {} }], { jszip }))
            .rejects.toThrow(/not a bundle member kind/);
        await expect(writeBundle([FOUR[1], FOUR[1]], { jszip }))
            .rejects.toThrow(/two `level-set` members/);
    });

    it('refuses when JSZip was not injected', async () => {
        await expect(readBundle(new Uint8Array([0]), {})).rejects.toThrow(/JSZip INJECTED/);
    });
});

describe('gunzipIfNeeded — one seam, sniffed by the magic bytes', () => {
    const gzip = async (text) => {
        const stream = new Blob([new TextEncoder().encode(text)]).stream()
            .pipeThrough(new CompressionStream('gzip'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    };

    it('gunzips bytes that start 1f 8b', async () => {
        const text = JSON.stringify(SMALL_ATLAS);
        const gz = await gzip(text);
        expect([gz[0], gz[1]]).toEqual([0x1f, 0x8b]);
        expect(new TextDecoder().decode(await gunzipIfNeeded(gz))).toBe(text);
    });

    it('leaves plain bytes alone — a wire-gzipped response is ALREADY decoded', async () => {
        const plain = new TextEncoder().encode('{"a":1}');
        expect(new TextDecoder().decode(await gunzipIfNeeded(plain))).toBe('{"a":1}');
        // The double-decode mutant: gunzipping by header/name would throw here.
        expect(new TextDecoder().decode(await gunzipIfNeeded(await gunzipIfNeeded(plain))))
            .toBe('{"a":1}');
    });

    it('reads a `.json.gz` MEMBER of a bundle', async () => {
        const zip = new jszip();
        zip.file('level-set.json.gz', await gzip(JSON.stringify(VANILLA_SET)));
        const bytes = await zip.generateAsync({ type: 'uint8array' });
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(notes).toEqual([]);
        expect(members.map((m) => m.kind)).toEqual(['level-set']);
        expect(canonicalJson(members[0].doc)).toBe(canonicalJson(VANILLA_SET));
    });

    it('reads a gzipped BUNDLE (`.zip.gz`) through the same seam', async () => {
        const bytes = await writeBundle([FOUR[1]], { jszip });
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
        const gz = new Uint8Array(await new Response(stream).arrayBuffer());
        expect([gz[0], gz[1]]).toEqual([0x1f, 0x8b]);
        const { members } = await readBundle(gz, { jszip });
        expect(members.map((m) => m.kind)).toEqual(['level-set']);
    });
});
