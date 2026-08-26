// frontend/modules/mazeRoom/mazeSetLab.test.js
/**
 * EDITOR v3 slice E2c — the maze SET arm's page-side bindings, in node.
 *
 * ⛓ Every subject is a document this repo already commits: the three served
 * region libraries and their index, a committed `_rules.json`, a committed
 * region atlas, the vanilla level set, and an overlay from the adapter's own
 * `emptyMazeOverlay()`. ⛔ Nothing here is a shape invented to make a row pass.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LAB_SUBSTRATE, mazeLibraryRows, sniffSetDocument } from './mazeSetLab.js';
import { emptyMazeOverlay } from './mazeSetAdapter.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));

const LIB_DIR = 'frontend/region-libraries';
const INDEX = readJson(`${LIB_DIR}/region_library_files.json`).libraries;
const MAZE_PACK = readJson(`${LIB_DIR}/demo-maze-pack.json`);
const BOUNCE_PACK = readJson(`${LIB_DIR}/demo-bounce-pack.json`);
const RULES = readJson('frontend/presets/seedling_atlas/AP_1/AP_1_rules.json');
const ATLAS = readJson('frontend/modules/flashPanel/atlases/seedling-fixture.json');
const VANILLA_SET = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');

describe('mazeSetLab — the served picker offers what this arm can OPEN', () => {
    /**
     * ⛓⛓⛓ **THE CLAIM IS THE FILTER, NOT A COUNT.** ⛔ A row asserting
     * `length === 1` would go red the day somebody commits a second maze pack —
     * a true statement about the day it was written. What has to hold is that
     * the packs whose payloads are NOT maze worlds are absent, BY NAME.
     * ⛔ MUTANT: the picker filled from the index unfiltered — the bounce pack
     * is offered, and pressing it hands `deserializeMazeWorld` a bounce zone.
     */
    it('drops every pack whose own `substrates` do not include `maze`', () => {
        const rows = mazeLibraryRows(INDEX);
        const ids = rows.map((r) => r.library_id);
        expect(ids).toContain(MAZE_PACK.library_id);
        expect(ids).not.toContain(BOUNCE_PACK.library_id);
        expect(ids).not.toContain(readJson(`${LIB_DIR}/demo-runner-pack.json`).library_id);
        // ⛔ …and it is the DECLARED field that decides, not the file name.
        expect(INDEX.filter((r) => r.substrates.includes(LAB_SUBSTRATE)).length)
            .toBe(rows.length);
    });

    it('offers a MIXED pack, because it declares `maze` among its substrates', () => {
        const rows = mazeLibraryRows([
            { file: 'mixed.json', library_id: 'mixed-1', name: 'Mixed', entry_count: 3, substrates: ['bounce', 'maze'] },
        ]);
        expect(rows.map((r) => r.file)).toEqual(['mixed.json']);
        expect(rows[0].label).toBe('Mixed — 3 entry(ies)');
    });

    it('survives an index that is missing, empty or malformed', () => {
        expect(mazeLibraryRows(undefined)).toEqual([]);
        expect(mazeLibraryRows([])).toEqual([]);
        expect(mazeLibraryRows([{ file: 'x.json' }, null])).toEqual([]);
    });
});

describe('mazeSetLab — ONE intake path per document kind', () => {
    it('names a committed region library and an overlay', () => {
        expect(sniffSetDocument(MAZE_PACK)).toEqual({ kind: 'library', doc: MAZE_PACK });
        // ⛓ every committed pack, not just the maze one — the sniff is about the
        //   DOCUMENT's shape and the ARM decides whether it can open it.
        expect(sniffSetDocument(BOUNCE_PACK).kind).toBe('library');
        const overlay = emptyMazeOverlay();
        expect(sniffSetDocument(overlay).kind).toBe('overlay');
    });

    /**
     * ⛓⛓⛓ **A KIND THIS ARM DOES NOT LOAD IS NAMED, NOT CALLED "not a library".**
     * ⛔ The failure mode this row exists against is a TRUE SENTENCE ABOUT THE
     * WRONG SUBJECT ([[feedback_header_warning_is_not_a_check]]): a `rules.json`
     * pasted here is perfectly well formed and simply belongs to another reader,
     * and *"this is not a region library"* tells the person nothing they can act
     * on.
     */
    it('names the FOUR kinds it refuses, each by what the document IS', () => {
        expect(sniffSetDocument(RULES).why).toMatch(/this is a `rules\.json`/);
        expect(sniffSetDocument(RULES).why).toMatch(/DERIVES one from the library/);
        expect(sniffSetDocument(ATLAS).why).toMatch(/this is a REGION ATLAS/);
        expect(sniffSetDocument(VANILLA_SET).why).toMatch(/SEEDLING LEVEL SET/);
        expect(sniffSetDocument(VANILLA_SET).why).toMatch(/watch\.html\?source=edit/);
        for (const doc of [RULES, ATLAS, VANILLA_SET]) {
            expect(sniffSetDocument(doc).kind).toBe(null);
        }
    });

    it('refuses a document of no kind at all, naming BOTH shapes it takes', () => {
        const why = sniffSetDocument({ hello: 'world' }).why;
        expect(why).toMatch(/`library_id` \+ an `entries` array/);
        expect(why).toMatch(/`overlay_id`, or `rooms` keyed by room INDEX/);
        expect(sniffSetDocument(null).kind).toBe(null);
        expect(sniffSetDocument([1, 2, 3]).kind).toBe(null);
        expect(sniffSetDocument('a string').kind).toBe(null);
    });

    /**
     * ⛓⛓ **ONE CLASSIFIER, AND THIS ROW IS WHAT SAYS SO.** `sniffSetDocument`
     * delegates to `documentBundle.classifyDocument` — the same function the
     * bundle reader and Seedling's load box use. ⛔ A second predicate here
     * would be a second answer to *"what is this document"*, and the two would
     * part company on the first new field. The mutant: a local
     * `doc.library_id && doc.entries` test — green today, and silently
     * divergent the moment the classifier learns a sixth kind.
     */
    it('answers exactly what `classifyDocument` answers, kind for kind', async () => {
        const { classifyDocument } = await import('../presets/documentBundle.js');
        const pairs = [
            [MAZE_PACK, 'region-library', 'library'],
            [emptyMazeOverlay(), 'overlay', 'overlay'],
            [RULES, 'rules', null],
            [ATLAS, 'region-atlas', null],
            [VANILLA_SET, 'level-set', null],
            [{ hello: 'world' }, null, null],
        ];
        for (const [doc, kind, mine] of pairs) {
            expect(classifyDocument(doc)).toBe(kind);
            expect(sniffSetDocument(doc).kind).toBe(mine);
        }
    });
});
