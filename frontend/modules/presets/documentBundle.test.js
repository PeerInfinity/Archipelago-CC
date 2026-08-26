// frontend/modules/presets/documentBundle.test.js
/**
 * EDITOR v3 slice E1c — the BUNDLE's rows.
 *
 * ⛓ Every claim is against a document this repo already commits, never against
 * a shape invented here: the 259 committed `_rules.json`, the vanilla level set,
 * the three committed region atlases, the three committed region libraries, and
 * an overlay built by the overlay module's own `emptyOverlay()`.
 *
 * ⛓⛓ EDITOR v3 E2c added the FIFTH kind, `region-library` — one predicate and
 * one entry (§25.12 #1). The rows below carry it the same way they carry the
 * other four: against the committed packs, walked rather than listed.
 *
 * ⛓⛓ EDITOR INTEGRATION W2 added the SIXTH, `world`. ⛔ There is NO committed
 * world to walk — the kind is a day old — so its document is built by the
 * module that owns it (`procgenCore/worldDocument.emptyWorld`) over the two
 * REAL substrates' empty overlays, never hand-typed here.
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
import { emptyWorld } from '../procgenCore/worldDocument.js';
import { emptyMazeOverlay } from '../mazeRoom/mazeAtlasDerivation.js';
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
/** ⛓ EDITOR v3 E2c — the LIBRARY dir is WALKED, so a fourth committed pack joins by existing. */
const LIBRARY_DIR = 'frontend/region-libraries';
const everyCommittedLibrary = () => readdirSync(join(REPO, LIBRARY_DIR))
    .filter((f) => f.endsWith('.json') && f !== 'region_library_files.json')
    .map((f) => [f, readJson(`${LIBRARY_DIR}/${f}`)]);
const MAZE_PACK = readJson(`${LIBRARY_DIR}/demo-maze-pack.json`);

/**
 * ⛓ EDITOR INTEGRATION W2 — a world over the two REAL substrates' empty
 * overlays, plus one crossing, built by `worldDocument`'s own constructor.
 */
const WORLD = {
    ...emptyWorld([
        { id: 'seed', kind: 'level-set', overlay: emptyOverlay() },
        { id: 'mz', kind: 'region-library', overlay: emptyMazeOverlay() },
    ]),
    links: [{
        from: { part: 'seed', room: 1, exit: 'out_teleporter_128_128' },
        to: { part: 'mz', room: 0, exit: 'exit_3' },
        one_way: true,
    }],
};

/**
 * ⛓ THE SIX, in `BUNDLE_KINDS` order. ⚠ It was FOUR until EDITOR v3 E2c and
 * FIVE until EDITOR INTEGRATION W2; the rows below read `BUNDLE_KINDS` rather
 * than a count, so the roster is the one authority and adding a seventh would
 * not need them rewritten.
 */
const SIX = [
    { kind: 'rules', doc: SMALL_RULES },
    { kind: 'level-set', doc: VANILLA_SET },
    { kind: 'overlay', doc: OVERLAY },
    { kind: 'region-atlas', doc: SMALL_ATLAS },
    { kind: 'region-library', doc: MAZE_PACK },
    { kind: 'world', doc: WORLD },
];
/** ⛓ The five that existed before W2 — the APPEND row's subject. */
const BEFORE_W2 = SIX.filter((m) => m.kind !== 'world');

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

    /**
     * ⛓⛓⛓ EDITOR v3 E2c — **THE FIFTH KIND, AND THE PREDICATE THAT CANNOT
     * MISTAKE AN ATLAS FOR IT.** ⛔ MUTANT: `region-library` keyed on
     * `isNonEmptyString(doc.library_id)` alone, or on `Array.isArray(doc.entries)`
     * alone — the first would still refuse an atlas (no `library_id`), the second
     * would claim any document that happens to carry an `entries` array. The
     * PAIR is the claim, and the row below asserts BOTH halves are needed by
     * stripping one at a time off a real committed pack.
     */
    it('classifies every committed region library as `region-library`, never as an atlas', () => {
        const libs = everyCommittedLibrary();
        expect(libs.length).toBeGreaterThan(0);
        for (const [name, doc] of libs) {
            expect(`${name} → ${classifyDocument(doc)}`).toBe(`${name} → region-library`);
        }
        // ⛔ Both halves are load-bearing: neither alone names this document.
        const { library_id: _id, ...noId } = MAZE_PACK;
        const { entries: _entries, ...noEntries } = MAZE_PACK;
        expect(classifyDocument(noId)).toBeNull();
        expect(classifyDocument(noEntries)).toBeNull();
        // ⛔ …and an ATLAS is still an atlas, whichever order the two are tried in:
        //    `atlas_id`+`regions[]` and `library_id`+`entries[]` share no key.
        expect(classifyDocument(SMALL_ATLAS)).toBe('region-atlas');
        expect(MAZE_PACK.atlas_id).toBeUndefined();
        expect(SMALL_ATLAS.library_id).toBeUndefined();
    });

    it('classifies an overlay as `overlay` — `rooms` keyed by index, not an array', () => {
        expect(classifyDocument(OVERLAY)).toBe('overlay');
        expect(classifyDocument(emptyOverlay())).toBe('overlay');
    });

    it('refuses to name a kind for a document that is none of the six', () => {
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

    /**
     * ⛓⛓⛓ **THE SIXTH KIND — A `parts` OBJECT PLUS A `links` ARRAY** (EDITOR
     * INTEGRATION W2). ⛔ mutant: classify a world as an `overlay` (drop the
     * `world` predicate, or key it on `world_id`, which an unsaved world does
     * not have). Both go red here.
     */
    it('classifies a world as `world`, and an UNSTAMPED one too', () => {
        expect(classifyDocument(WORLD)).toBe('world');
        expect(WORLD.world_id).toBeUndefined();
        expect(classifyDocument({ ...WORLD, world_id: 'world-abcd1234' })).toBe('world');
    });

    /**
     * ⛔ **THE PAIR IS WHAT KEEPS IT APART FROM AN OVERLAY.** A MAZE overlay
     * carries `links` too — measured, it is the maze's only connection source —
     * and no `parts`. A predicate on `links` alone would call every maze
     * overlay a world.
     */
    it('a maze overlay carrying `links` is still an `overlay`, never a world', () => {
        const mazeOverlay = { ...emptyMazeOverlay(), overlay_id: 'maze-overlay-row' };
        expect(Array.isArray(mazeOverlay.links)).toBe(true);
        expect(classifyDocument(mazeOverlay)).toBe('overlay');
        expect(classifyDocument({ parts: { a: {} } })).toBeNull();
        expect(classifyDocument({ links: [] })).toBeNull();
    });

    /**
     * ⛓⛓ **EVERY COMMITTED DOCUMENT CLASSIFIES AS IT DID** — the sixth kind is
     * additive, and this is the row that says so over the walked corpus rather
     * than over a list. (The three describe rows above walk the presets, the
     * atlases and the libraries; this one is the level set and the overlay.)
     */
    it('the sixth predicate moves NO committed document', () => {
        expect(classifyDocument(VANILLA_SET)).toBe('level-set');
        expect(classifyDocument(OVERLAY)).toBe('overlay');
        expect(classifyDocument(MAZE_PACK)).toBe('region-library');
        expect(classifyDocument(SMALL_ATLAS)).toBe('region-atlas');
        expect(classifyDocument(SMALL_RULES)).toBe('rules');
        for (const [, doc] of everyCommittedLibrary()) expect(classifyDocument(doc)).toBe('region-library');
    });
});

describe('BUNDLE_KINDS — `world` is APPENDED, and the order is bytes', () => {
    /**
     * ⛔⛔ **THE MUTANT IS `world` INSERTED RATHER THAN APPENDED, AND THE ROW
     * THAT DISCRIMINATES IS A POSITION ONE — SAID OUT LOUD.** The order decides
     * the zip's entry order, so it is bytes; but NO committed bundle carries a
     * world, so inserting the kind anywhere would leave every bundle written
     * before today byte-identical and a byte row over the corpus would be
     * VACUOUS ([[reference_seedling_arc_traps]] 777 — the instance is named,
     * and it is absent). What CAN be pinned is the position: the five kinds
     * that existed before W2 keep their indices, and `world` is last.
     */
    it('the five older kinds keep their indices and `world` is LAST', () => {
        expect(BUNDLE_KINDS).toEqual([
            'rules', 'level-set', 'overlay', 'region-atlas', 'region-library', 'world',
        ]);
        expect(BUNDLE_KINDS.indexOf('world')).toBe(BUNDLE_KINDS.length - 1);
        expect(BUNDLE_ENTRY_NAMES.world).toBe('world.json');
    });

    it('a bundle of the five older kinds writes them in their historical order', async () => {
        const bytes = await writeBundle(BEFORE_W2, { jszip });
        const { members } = await readBundle(bytes, { jszip });
        expect(members.map((m) => m.kind))
            .toEqual(['rules', 'level-set', 'overlay', 'region-atlas', 'region-library']);
    });

    /**
     * ⛓⛓ **A BUNDLE CARRYING A WORLD *IS* A WORLD; ONE WITHOUT IS TODAY'S SET.**
     * The two shapes the page will sniff, told apart by their member kinds
     * alone — no manifest, exactly as the module's own docblock promises.
     */
    it('a level-set + region-library + world bundle reads back as all three', async () => {
        const bytes = await writeBundle(
            [SIX[1], SIX[4], SIX[5]], { jszip },
        );
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(notes).toEqual([]);
        expect(members.map((m) => m.kind)).toEqual(['level-set', 'region-library', 'world']);
        expect(canonicalJson(members[2].doc)).toBe(canonicalJson(WORLD));
        // …and the Seedling set's own bundle is untouched by any of it.
        const set = await readBundle(await writeBundle([SIX[1], SIX[2]], { jszip }), { jszip });
        expect(set.members.map((m) => m.kind)).toEqual(['level-set', 'overlay']);
    });
});

describe('writeBundle / readBundle — the six documents round trip', () => {
    it('round trips all six by canonicalJson, and derives the entry names', async () => {
        const bytes = await writeBundle(SIX, { jszip });
        const { members, notes } = await readBundle(bytes, { jszip });
        expect(notes).toEqual([]);
        expect(members.map((m) => m.kind)).toEqual(BUNDLE_KINDS);
        expect(members.map((m) => m.name)).toEqual(BUNDLE_KINDS.map((k) => BUNDLE_ENTRY_NAMES[k]));
        for (const member of members) {
            const original = SIX.find((f) => f.kind === member.kind).doc;
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
        const a = await writeBundle(SIX, { jszip });
        const b = await writeBundle([...SIX].reverse(), { jszip });
        expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
        // The mtime DOES reach the bytes — so leaving it to the clock is a real
        // determinism defect, not a hypothetical one.
        const c = await writeBundle(SIX, { jszip, mtime: new Date(Date.UTC(2020, 0, 1)) });
        expect(Buffer.from(c).equals(Buffer.from(a))).toBe(false);
        expect(BUNDLE_MTIME.getTime()).toBe(Date.UTC(1980, 0, 1));
    });

    it('writes the rules member through stringifyRulesJson at the given indent', async () => {
        for (const indent of [2, 0]) {
            const bytes = await writeBundle([SIX[0]], { jszip, indent });
            const zip = await jszip.loadAsync(bytes);
            const text = await zip.file(BUNDLE_ENTRY_NAMES.rules).async('string');
            expect(text).toBe(`${stringifyRulesJson(SMALL_RULES, { indent })}\n`);
        }
    });

    it('is smaller at indent 0 and parses to the same object', async () => {
        const two = await writeBundle(SIX, { jszip, indent: 2 });
        const zero = await writeBundle(SIX, { jszip, indent: 0 });
        expect(zero.length).toBeLessThan(two.length);
        const back = await readBundle(zero, { jszip });
        for (const member of back.members) {
            const original = SIX.find((f) => f.kind === member.kind).doc;
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
        // ⛓ E2c: `region-library` is no longer one of those — the roster grew.
        expect(BUNDLE_KINDS).toContain('region-library');
        await expect(writeBundle([SIX[1], SIX[1]], { jszip }))
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
        const bytes = await writeBundle([SIX[1]], { jszip });
        const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
        const gz = new Uint8Array(await new Response(stream).arrayBuffer());
        expect([gz[0], gz[1]]).toEqual([0x1f, 0x8b]);
        const { members } = await readBundle(gz, { jszip });
        expect(members.map((m) => m.kind)).toEqual(['level-set']);
    });
});
