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

import {
    LAB_SUBSTRATE, SEEDLING_ATLAS_GAME, bindWorldParts, makeDrawRoomStill, mazeLibraryRows,
    mazeSetBindings, roomBaseTag, sniffSetDocument, worldPartDescriptors,
} from './mazeSetLab.js';
import { classifyDocument } from '../presets/documentBundle.js';
import { emptyWorld } from '../procgenCore/worldDocument.js';
import { substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { substrateRegistryEntry as FLASH_SEEDLING_ENTRY } from '../flashPanel/flashSeedlingLibrary.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { buildLevelSet } from '../seedlingDemo/levelSetExporter.js';
import { TILE_SIZE } from '../seedlingDemo/levelWorld.js';
import { emptyLevel } from '../seedlingDemo/procgenLevel.js';
import { parseOelLevel } from '../seedlingDemo/procgenLevelOel.js';
import { emptyOverlay as emptySeedlingOverlay } from '../seedlingDemo/seedlingSetOverlay.js';
import { emptyMazeOverlay } from './mazeAtlasDerivation.js';
import { ADAPTER_FNS } from '../procgenCore/setEditorView.js';
import { OVERVIEW } from '../procgenCore/setEditorCore.js';
import { emptyMazeOverlay, readSetCell, setRecord } from './mazeSetAdapter.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { deserializeMazeLevel } from './procgenMaze.js';
import { TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';

/**
 * ⛓ A RECORDING 2D CONTEXT and a fake canvas — `editorView.test.js`'s
 * discipline. ⛔ The claims below are about what the still DID: how big it made
 * the surface and how many marks it laid down, not what it looked like.
 */
const recordingContext = (calls) => new Proxy({}, {
    get: (_t, key) => {
        if (key === 'canvas') return {};
        return (...args) => { calls.push(`${String(key)}(${JSON.stringify(args)})`); };
    },
    set: (_t, key, value) => { calls.push(`${String(key)}=${JSON.stringify(value)}`); return true; },
});
const fakeCanvas = (calls) => ({ width: 0, height: 0, getContext: () => recordingContext(calls) });
const cellOf = (i) => readSetCell(setRecord(MAZE_PACK, emptyMazeOverlay()), i, 0);

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

describe('mazeSetLab — the STILL is `drawWorld` on the payload\'s own world', () => {
    /**
     * ⛓⛓⛓ **THE TILE SIZE IS DERIVED FROM THE CELL AND THE ROOM, NEVER
     * `TILE_PX`.** ⛔ MUTANT: `plainView()` with its default — `TILE_PX` is 20,
     * the EDIT canvas's scale, and an 11-tile room would be drawn 220 px wide
     * into a 96 px strip cell. The row asserts the SIZE against numbers it
     * computes from the cell and the room, and states what the mutant's would
     * have been.
     */
    it('sizes the surface from the strip cell and the room, not from TILE_PX', () => {
        for (const cellPx of [OVERVIEW.cellPx, OVERVIEW.minStillPx]) {
            const calls = [];
            const canvas = fakeCanvas(calls);
            expect(makeDrawRoomStill({ cellPx })(canvas, cellOf(0), 0)).toBe(null);
            const world = deserializeMazeWorld(cellOf(0).payload);
            const tilePx = Math.floor(cellPx / Math.max(world.width, world.height));
            expect(tilePx).toBeGreaterThan(0);
            expect(canvas.width).toBe(world.width * tilePx);
            expect(canvas.height).toBe(world.height * tilePx);
            expect(canvas.width).toBeLessThanOrEqual(cellPx);
        }
        // ⛔ what the mutant would have produced, stated:
        expect(11 * TILE_PX).toBe(220);
        expect(220).toBeGreaterThan(OVERVIEW.cellPx);
    });

    /**
     * ⛓ **IT PAINTS.** ⚖ §23.11 #5's law, at the node level: assert INK, not
     * that a canvas exists. The base tile layer alone is one `fillRect` per
     * cell, so a still that drew nothing cannot reach the count.
     */
    it('lays down at least one mark per tile, on every committed entry', () => {
        for (const [i, entry] of MAZE_PACK.entries.entries()) {
            const calls = [];
            makeDrawRoomStill()(fakeCanvas(calls), cellOf(i), i);
            const world = deserializeMazeWorld(entry.payload);
            const fills = calls.filter((c) => c.startsWith('fillRect(')).length;
            expect(`${entry.entry_id}: ${fills >= world.width * world.height}`)
                .toBe(`${entry.entry_id}: true`);
        }
    });

    /**
     * ⛔⛔ **THE MUTANT THE KICKOFF PREDICTED IS NOT DISCRIMINATING, AND THIS ROW
     * IS THE MEASUREMENT THAT SAYS SO** (trap 713's lesson: a green row over a
     * mutant nothing can see is not a row). Drawing the LIBRARY payload through
     * `deserializeMazeLevel` — the LAB spelling — produces a BYTE-IDENTICAL
     * draw-op stream on every committed entry, because `drawWorld` reads tiles,
     * items, obstacles, the entrance and exit POSITIONS, and both spellings
     * agree on all of them; what parts company is AP vocabulary (`side`,
     * `exitName`, `targetRegion`) the renderer never looks at.
     *
     * ⛓ The right spelling is STILL load-bearing — `mazeSetAdapter`'s CLOSE row
     * (§28.5) is what sees it, where an unedited close through the lab spelling
     * MINTS AN EDIT and every exit's `side` comes back `null`. This row pins the
     * identity so that a renderer which one day DOES read `side` reddens here
     * and the claim gets re-examined instead of quietly becoming true.
     */
    it('⛔ paints IDENTICALLY through the LAB spelling — the still cannot see the difference', () => {
        for (const entry of MAZE_PACK.entries) {
            const a = [];
            const b = [];
            drawWorld(recordingContext(a), deserializeMazeWorld(entry.payload),
                plainView({ tilePx: 8 }));
            drawWorld(recordingContext(b), deserializeMazeLevel(entry.payload),
                plainView({ tilePx: 8 }));
            expect(`${entry.entry_id}: ${a.join('|') === b.join('|')}`)
                .toBe(`${entry.entry_id}: true`);
            expect(a.length).toBeGreaterThan(300);
        }
        // ⛓ …and the two worlds ARE different documents, which is why the
        //   spelling matters somewhere else: the AP vocabulary is gone.
        const p = MAZE_PACK.entries[0].payload;
        expect([...deserializeMazeWorld(p).exits.values()].every((e) => e.side !== null)).toBe(true);
        expect([...deserializeMazeLevel(p).exits.values()].every((e) => e.side === null)).toBe(true);
    });
});

describe('mazeSetLab — the base tag and the binding list', () => {
    /**
     * ⛓⛓ **A ROOM SESSION'S BASE NAMES THE LIBRARY, THE INDEX *AND* THE ENTRY.**
     * ⛔ MUTANT: the index alone. A `library_id` carries the document's CONTENT
     * HASH, so a payload naming only `room: 2` could be re-opened against a
     * library these edits were never edits OF; and a reorder MOVES the index
     * while the `entry_id` does not, so a reader of a stale tag can tell WHICH
     * fact went stale.
     */
    it('names the library, the index and the entry', () => {
        const entry = MAZE_PACK.entries[2];
        expect(roomBaseTag(MAZE_PACK, 2, entry)).toEqual({
            kind: 'library-room',
            library_id: MAZE_PACK.library_id,
            room: 2,
            entry_id: entry.entry_id,
        });
        expect(Object.isFrozen(roomBaseTag(MAZE_PACK, 0, MAZE_PACK.entries[0]))).toBe(true);
        expect(roomBaseTag(null, 0, null))
            .toEqual({ kind: 'library-room', library_id: null, room: 0, entry_id: null });
    });

    /**
     * ⛓ **THE BINDING LIST IS COMPLETE AGAINST THE MOUNT'S OWN ROSTER.** ⛔ Read
     * off `setEditorView.ADAPTER_FNS` rather than typed here: the mount
     * `need()`-checks every one BY NAME at mount, so a binding that fell out
     * would refuse on the page — and a roster copied into this row would go
     * stale the day the mount asks for a tenth.
     */
    it('supplies every `ADAPTER_FNS` name the mount checks for', () => {
        const b = mazeSetBindings({});
        for (const name of ADAPTER_FNS) expect(typeof b.adapterFns[name]).toBe('function');
        expect(Object.keys(b.adapterFns).sort()).toEqual([...ADAPTER_FNS].sort());
        expect(b.document).toMatchObject({
            kind: 'region-library', noun: 'library', validator: 'validateRegionLibrary',
        });
        expect(b.document.idOf(MAZE_PACK)).toBe(MAZE_PACK.library_id);
        expect(b.document.docOf({ library: MAZE_PACK })).toBe(MAZE_PACK);
        // ⛓ the still is THREADED, and absent by default (the node rows stub it).
        expect(mazeSetBindings({}).drawRoomStill).toBe(null);
        const still = makeDrawRoomStill();
        expect(mazeSetBindings({ drawRoomStill: still }).drawRoomStill).toBe(still);
        // ⛔ …and the bound is SAID, not defaulted: there is none, and it says so.
        expect(b.linkBound()).toEqual({ ok: true, why: null });
        /**
         * ⛓⛓ **`addRoomOp` IS THREADED, AND ABSENT BY DEFAULT** (EDITOR v3
         * E6b). ⛔ `null` and not a thrower: with no `blankSize` the mount's own
         * press says *"no `addRoomOp` was injected"*, which is one sentence
         * about a missing parameter rather than two about a missing size.
         * ⛓ The op it builds is `blankMazeRoomPayload`'s straight through —
         * MUTANT: the thunk is CALLED ONCE at binding time instead of at the
         * press, and the second press mints the size the page had at mount.
         */
        expect(b.addRoomOp).toBe(null);
        const sizes = [];
        const sized = mazeSetBindings({
            blankSize: () => {
                sizes.push(sizes.length);
                return { width: 4 + sizes.length, height: 3 };
            },
        });
        expect(sizes).toEqual([]);
        const first = sized.addRoomOp(7);
        expect(first).toMatchObject({ op: 'add-room', at: 7 });
        expect(first.payload).toMatchObject({ width: 5, height: 3 });
        // ⛔ EXITS `[]` — `blankTileGridLibraryEntry` hands `createWorld` an
        //    explicit empty list, so the blank room is DOORLESS by construction.
        expect(first.payload.exits).toEqual([]);
        // ⛓ …and the SECOND press reads the thunk AGAIN, which is the whole
        //   reason it is a thunk and not a value.
        expect(sized.addRoomOp(8).payload).toMatchObject({ width: 6, height: 3 });
        expect(sizes).toEqual([0, 1]);
        // ⛔ NOTHING HERE CHECKS THE SIZE — `createWorld` is the one authority.
        expect(() => mazeSetBindings({ blankSize: () => ({ width: 1, height: 11 }) }).addRoomOp(0))
            .toThrow(/createWorld: invalid dimensions 1x11/);
        /**
         * ⛓⛓ **THE STILLS CACHE IS KEYED ON THE PAYLOAD OBJECT, BY IDENTITY.**
         * ⛔ MUTANT: keyed on the room INDEX — a `replace-room` swaps the
         * payload and the index does not move, so an edited room would keep its
         * OLD picture for ever while every other readout stayed right. ⛔ And
         * keyed on something FRESH per call (E2b's mutant #4) it would never
         * hit and every render would redraw every room.
         */
        const cell = cellOf(2);
        expect(b.stillKey(cell)).toBe(cell.payload);
        expect(b.stillKey(cellOf(2))).toBe(b.stillKey(cellOf(2)));
        expect(b.stillKey(cellOf(0))).not.toBe(b.stillKey(cellOf(1)));
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE WORLD: ITS PARTS, ITS BINDING
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛓ EVERY DOCUMENT IS GENERATED OR COMMITTED, none typed — the same recipe
 * `seedlingDemo/worldChain.test.js` uses: `buildLevelSet({link: true})` over two
 * `emptyLevel` rooms, and the first two entries of the committed
 * `frontend/region-libraries/demo-maze-pack.json`.
 */

const W4_WORLD_PARTS = { seed: 'level-set', mz: 'region-library' };

const w4Deps = () => ({
    tileSize: TILE_SIZE,
    parseOel: parseOelLevel,
    tileTypeForPlacement,
    substrateIdFor,
});

const w4LevelSet = () => buildLevelSet(
    [0, 1].map((level) => emptyLevel({ level })), { setId: 'w4-world', link: true },
).set;

const w4Library = () => {
    const pack = readJson('frontend/region-libraries/demo-maze-pack.json');
    return { ...pack, entries: pack.entries.slice(0, 2) };
};

const w4World = (overrides = {}) => {
    const set = overrides.set ?? w4LevelSet();
    const lib = overrides.library ?? w4Library();
    return emptyWorld([
        {
            id: 'seed',
            kind: 'level-set',
            overlay: emptySeedlingOverlay(),
            substrate: 'flash_seedling',
            ...(overrides.seedDocId === null ? {} : { doc_id: overrides.seedDocId ?? set.set_id }),
        },
        {
            id: 'mz',
            kind: 'region-library',
            overlay: emptyMazeOverlay(),
            substrate: 'maze',
            doc_id: overrides.mzDocId ?? lib.library_id,
        },
    ]);
};

const w4Members = (set, lib, world) => [
    { kind: 'level-set', doc: set }, { kind: 'overlay', doc: {} },
    { kind: 'region-library', doc: lib }, { kind: 'world', doc: world },
].filter((m) => m.doc !== undefined && m.kind !== 'overlay');

describe('⛓⛓⛓ W4 — a WORLD arriving at the maze lab', () => {
    /**
     * ⛔ MUTANT: the world sniffed as a LIBRARY (or as nothing at all). The
     * sentence has to NAME the kind — a world pasted here is a perfectly
     * well-formed document that belongs to a BUNDLE, and *"not a region
     * library"* would be a true sentence about the wrong subject.
     */
    it('a world pasted as bare JSON REFUSES BY NAME and says to load the bundle', () => {
        const world = w4World();
        expect(classifyDocument(world)).toBe('world');
        const sniff = sniffSetDocument(world);
        expect(sniff.kind).toBeNull();
        expect(sniff.why).toMatch(/this is a WORLD document/);
        expect(sniff.why).toMatch(/`seed`, `mz`/);
        expect(sniff.why).toMatch(/Load the\s+BUNDLE/);
        // ⛓ …and the four kinds this arm already knew still answer as they did.
        expect(sniffSetDocument(w4Library()).kind).toBe('library');
        expect(sniffSetDocument({ overlay_id: 'x' }).kind).toBe('overlay');
        expect(sniffSetDocument(w4LevelSet()).kind).toBeNull();
    });

    it('the part descriptors take the WORLD\'s own ids, in DECLARATION order', () => {
        const world = w4World();
        const { parts, deps, errors } = worldPartDescriptors({ world, ...w4Deps() });
        expect(errors).toEqual([]);
        expect(parts.map((p) => p.id)).toEqual(['seed', 'mz']);
        expect(parts.map((p) => p.kind)).toEqual(['level-set', 'region-library']);
        /**
         * ⛔ MUTANT: ids minted here (`seed`/`mz` as literals). A world whose
         * author called its parts something else would have every op refused,
         * because every op is addressed BY PART ID.
         */
        const renamed = {
            ...world,
            parts: { alpha: world.parts.seed, beta: world.parts.mz },
            overlays: { alpha: world.overlays.seed, beta: world.overlays.mz },
        };
        expect(worldPartDescriptors({ world: renamed, ...w4Deps() }).parts.map((p) => p.id))
            .toEqual(['alpha', 'beta']);
        // ⛓ each part carries its own deps, keyed by ITS id
        expect(Object.keys(deps)).toEqual(['seed', 'mz']);
        expect(deps.seed.atlas).toEqual({ game: SEEDLING_ATLAS_GAME, mapDocument: 'world.json' });
    });

    /**
     * ⛓⛓ **THE GAME IS A CONSTANT WITH ITS AUTHORITY UNDER IT.**
     * `substrateIdFor` is a slug function and cannot be inverted, so the value
     * is PINNED against `flashSeedlingLibrary`'s own registry id rather than
     * derived. ⚠ And `watch.html`'s own word is measured to be a DIFFERENT
     * substrate, which is why this page does not copy it.
     */
    it('`SEEDLING_ATLAS_GAME` slugs to the substrate the player actually holds', () => {
        expect(substrateIdFor(SEEDLING_ATLAS_GAME)).toBe(FLASH_SEEDLING_ENTRY.id);
        expect(substrateIdFor('seedling-watch-edit')).not.toBe(FLASH_SEEDLING_ENTRY.id);
        const { parts } = worldPartDescriptors({ world: w4World(), ...w4Deps() });
        expect(parts[0].substrateOfRoom()).toBe(FLASH_SEEDLING_ENTRY.id);
    });

    it('a SECOND part of one kind, and an unknown kind, each refuse by name', () => {
        const two = emptyWorld([
            { id: 'a', kind: 'level-set', overlay: emptySeedlingOverlay() },
            { id: 'b', kind: 'level-set', overlay: emptySeedlingOverlay() },
        ]);
        const { parts, errors } = worldPartDescriptors({ world: two, ...w4Deps() });
        expect(parts.map((p) => p.id)).toEqual(['a']);
        expect(errors.join(' ')).toMatch(/declares a SECOND `level-set` part \("b"\)/);
        // ⛓ an unknown kind never reaches `emptyWorld`, so it is built by hand
        const odd = { ...two, parts: { a: { kind: 'region-atlas' } }, overlays: { a: {} } };
        expect(worldPartDescriptors({ world: odd, ...w4Deps() }).errors.join(' '))
            .toMatch(/part "a" declares kind "region-atlas"/);
    });

    /**
     * ⛔⛔ MUTANT: parts bound BY POSITION rather than by `doc_id`. Both
     * documents are of the kind their part declares, so a positional binder
     * loads happily — and the world's links then name room indices into a
     * document nobody authored them over.
     */
    it('a part whose `doc_id` disagrees with the held document REFUSES, naming both', () => {
        const set = w4LevelSet();
        const lib = w4Library();
        const world = w4World({ set, library: lib });
        const parts = worldPartDescriptors({ world, ...w4Deps() }).parts;
        const good = bindWorldParts({ world, members: w4Members(set, lib, world), parts });
        expect(good.errors).toEqual([]);
        expect(good.ok).toBe(true);
        expect(Object.keys(good.docs)).toEqual(['seed', 'mz']);
        expect(good.docs.seed).toBe(set);
        expect(good.docs.mz).toBe(lib);

        const wrong = w4World({ set, library: lib, mzDocId: 'somebody-elses-pack' });
        const bad = bindWorldParts({ world: wrong, members: w4Members(set, lib, wrong), parts });
        expect(bad.ok).toBe(false);
        expect(bad.errors).toHaveLength(1);
        expect(bad.errors[0]).toMatch(/part "mz" names `somebody-elses-pack`/);
        expect(bad.errors[0]).toContain(lib.library_id);
        expect(bad.errors[0]).toMatch(/not the same\s+document/);
    });

    it('an ABSENT `doc_id` binds by kind and SAYS SO; a MISSING member refuses', () => {
        const set = w4LevelSet();
        const lib = w4Library();
        const world = w4World({ set, library: lib, seedDocId: null });
        const parts = worldPartDescriptors({ world, ...w4Deps() }).parts;
        const bound = bindWorldParts({ world, members: w4Members(set, lib, world), parts });
        expect(bound.ok).toBe(true);
        expect(bound.notes.join(' ')).toMatch(/part "seed" declares no `doc_id`/);
        expect(bound.notes.join(' ')).toContain(set.set_id);

        // ⛔ the level-set member simply is not in the zip
        const short = bindWorldParts({
            world, parts, members: [{ kind: 'region-library', doc: lib }, { kind: 'world', doc: world }],
        });
        expect(short.ok).toBe(false);
        expect(short.errors.join(' ')).toMatch(/part "seed" is a `level-set` and this bundle carries none/);
        expect(short.errors.join(' ')).toMatch(/`region-library`, `world`/);
    });

    /**
     * ⛓ `idOf` on the descriptor and `document.idOf` on the mount's bindings are
     * the SAME field — asserted rather than assumed, because two readers of one
     * stamp is the pair that parts company.
     */
    it('the maze descriptor\'s `idOf` is the one `mazeSetBindings` hands the mount', () => {
        const lib = w4Library();
        const { parts } = worldPartDescriptors({ world: w4World({ library: lib }), ...w4Deps() });
        const mz = parts.find((p) => p.kind === 'region-library');
        expect(mz.idOf(lib)).toBe(mazeSetBindings().document.idOf(lib));
        expect(mz.idOf(lib)).toBe(lib.library_id);
    });
});
