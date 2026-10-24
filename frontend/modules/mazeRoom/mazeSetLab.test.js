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
    mazeSetBindings, roomBaseTag, sniffSetDocument, worldDoorDisconnectOp, worldDoorOp,
    roomOpenRefusal,
    worldAllMazeRulesJson, worldDoorPreview, worldDoorRows, worldDownloadMembers,
    worldPartDescriptors, worldSetBindings,
} from './mazeSetLab.js';
import { deriveWorldAtlasOf, partOfRegion } from '../procgenCore/worldDerivation.js';
import { reportOver, roomRowsOf } from '../procgenCore/setEditorCore.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { projectRegionToMaze } from '../procgenPipeline/regionAtlasMazeProjection.js';
import { seedlingMazeProjectionDeps } from '../flashPanel/seedlingAtlasAnalysis.js';
import { roomsOfSet } from '../seedlingDemo/seedlingSetAdapter.js';
import { MAZE_CONDITION_DEPS, emptyMazeOverlay, mazeGridFor } from './mazeAtlasDerivation.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { ADAPTER_FNS } from '../procgenCore/setEditorView.js';
import { createWorldSetAdapter, worldRecord } from '../procgenCore/worldSetAdapter.js';
import { mazeEditAdapter } from './mazeEditAdapter.js';
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
import { OVERVIEW } from '../procgenCore/setEditorCore.js';
import { readSetCell, setRecord } from './mazeSetAdapter.js';
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ W4 — THE WORLD'S BINDINGS, OVER BOTH REAL ADAPTERS
 * ══════════════════════════════════════════════════════════════════════ */

const w4Session = ({ crossing = false } = {}) => {
    const set = w4LevelSet();
    const lib = w4Library();
    const world = w4World({ set, library: lib });
    const { parts, deps } = worldPartDescriptors({ world, ...w4Deps() });
    const adapter = createWorldSetAdapter({ parts });
    const session = createEditSession(adapter, worldRecord(world, { seed: set, mz: lib }));
    const go = (op) => {
        const r = session.apply(op);
        if (!r.ok) throw new Error(`the fixture's own op was refused: ${r.description}`);
        return r;
    };
    go({ op: 'connect', from: [2, 'exit_1'], to: [3, 'exit_3'] });
    if (crossing) {
        go({
            op: 'connect',
            from: { part: 'seed', room: 1, exit: 'out_teleporter_128_128' },
            to: { part: 'mz', room: 0, exit: 'exit_3' },
            one_way: true,
        });
    }
    return { session, parts, deps, adapter, set, lib, world, go };
};

const w4Bindings = (h) => worldSetBindings({
    parts: h.parts,
    deps: h.deps,
    parseOel: parseOelLevel,
    drawMazeStill: makeDrawRoomStill(),
    /**
     * ⛓ THE MAZE ROW'S `gridFor`, BOUND TO THE MAZE PART — the page's own
     * `worldCompileOptions()`, in node. ⛔ Namespaced ids, so the resolver has
     * to split the part off first and a region of the OTHER part answers `null`
     * (its sidecar is the flash builder's, not this row's).
     */
    compileOptions: {
        mazeProjection: {
            ...MAZE_CONDITION_DEPS,
            gridFor: (region) => {
                if (partOfRegion(region.region_id) !== 'mz') return null;
                const entry = h.session.record().parts.mz.entries[region.map_ref];
                return entry ? mazeGridFor(entry.payload) : null;
            },
        },
    },
    gameName: 'W4 World',
});

describe('⛓⛓⛓ W4 — `worldSetBindings` over a Seedling set and a maze library', () => {
    /**
     * ⛔ The mount refuses a missing binding BY NAME at mount time rather than
     * at the first render — so the claim here is that every name it `need()`s
     * is supplied, asked of `ADAPTER_FNS` itself and not of a list typed twice.
     */
    it('supplies every binding `mountSetEditor` requires, by the mount\'s own roster', () => {
        const b = w4Bindings(w4Session());
        for (const name of ADAPTER_FNS) expect(typeof b.adapterFns[name]).toBe('function');
        for (const name of ['idOf', 'docOf']) expect(typeof b.document[name]).toBe('function');
        for (const name of ['exit', 'location']) expect(typeof b.ruleKeys[name]).toBe('function');
        for (const name of ['manifestRows', 'roomRows']) expect(typeof b.forms[name]).toBe('function');
        for (const name of ['valueOf', 'labelOf', 'addressOf', 'targetOptions', 'disconnectOp']) {
            expect(typeof b.exits[name]).toBe('function');
        }
        for (const name of ['options', 'targetOf']) expect(typeof b.locations[name]).toBe('function');
        for (const name of ['linkBound', 'isRefusal', 'stillKey', 'sourceKind']) {
            expect(typeof b[name]).toBe('function');
        }
        expect(b.document).toMatchObject({ kind: 'world', noun: 'world', validator: 'worldErrors' });
        /**
         * ⛔ **NO `addRoomOp`, AND IT IS `null` RATHER THAN A GUESS** — a
         * world's `add-room` is PART-addressed and the mount's press says only
         * WHERE, so the press keeps the mount's own sentence.
         */
        expect(b.addRoomOp).toBeNull();
    });

    /**
     * ⛓ BOTH parts' overlays are built by `procgenCore/setOverlay.js`, so the
     * world does not CHOOSE a rule-key spelling — asserted as the same function
     * object rather than as two strings that happen to match today.
     */
    it('the rule keys are ONE function object, shared by both parts', () => {
        const h = w4Session();
        const b = w4Bindings(h);
        const [seed, mz] = h.parts;
        expect(b.ruleKeys.exit).toBe(seed.ruleKeys.exit);
        expect(b.ruleKeys.exit).toBe(mz.ruleKeys.exit);
        expect(b.ruleKeys.location).toBe(seed.ruleKeys.location);
        expect(b.ruleKeys.location).toBe(mz.ruleKeys.location);
    });

    it('the strip reads the SUBSTRATE off the cell, and the card names it', () => {
        const h = w4Session();
        const b = w4Bindings(h);
        const rows = roomRowsOf(h.session.record(), b.adapterFns);
        expect(rows).toHaveLength(4);
        const cells = [0, 1, 2, 3].map((i) => b.adapterFns.readSetCell(h.session.record(), i, 0));
        expect(cells.map((c) => b.cellSubstrate(c)))
            .toEqual(['flash_seedling', 'flash_seedling', 'maze', 'maze']);
        expect(cells.map((c) => c.part)).toEqual(['seed', 'seed', 'mz', 'mz']);
        /**
         * ⛔ MUTANT: the badge DERIVED (`deriveWorldAtlasOf(...).atlas.regions[i]
         * .substrate`). It agrees here — and it costs an atlas MERGE per paint,
         * and it answers for a region the derivation may have DROPPED. The
         * claim is that it comes off the descriptor, which is why this reads
         * `cellSubstrate(cell)` and not the atlas.
         */
        expect(b.cellSubstrate({})).toBeNull();
        /**
         * ⛓⛓ ⚖ THE ONE-RENDERER LAW — a maze cell goes to the maze's own
         * painter and a Seedling cell gets a CARD, and the two are told apart by
         * the number of draw calls: a real still lays down one mark per tile.
         */
        const mazeCalls = [];
        expect(b.drawRoomStill(fakeCanvas(mazeCalls), cells[2], 2)).toBeNull();
        const seedCalls = [];
        expect(b.drawRoomStill(fakeCanvas(seedCalls), cells[0], 0)).toBeNull();
        expect(mazeCalls.length).toBeGreaterThan(50);
        expect(seedCalls.filter((c) => c.startsWith('fillText'))).toHaveLength(3);
        expect(seedCalls.join(' ')).toContain('flash_seedling');
    });

    /**
     * ⛔⛔ **THE ENDPOINT VALUE CARRIES ITS PART, AND THE CLAIM IS SCORED
     * AGAINST THE LAW.** Not "the two bindings agree" — the address this
     * produces is handed to the WORLD ADAPTER and the claim is that the op is
     * ACCEPTED. A binding that dropped the part tag would hand a maze `exit_id`
     * to Seedling's ordinal reader, which coerces to 0 and wires a door nobody
     * drew.
     */
    it('a parted exit value round trips and the ADAPTER accepts the address', () => {
        const h = w4Session();
        const b = w4Bindings(h);
        const record = h.session.record();
        const seedExits = b.adapterFns.exitsOfRoom(record, 1);
        const mzExits = b.adapterFns.exitsOfRoom(record, 2);
        expect(seedExits.every((e) => e.part === 'seed')).toBe(true);
        expect(mzExits.every((e) => e.part === 'mz')).toBe(true);
        const seedValue = b.exits.valueOf(seedExits[0]);
        const mzValue = b.exits.valueOf(mzExits[0]);
        expect(seedValue).toMatch(/^seed\//);
        expect(mzValue).toMatch(/^mz\//);
        // ⛓ the ADDRESS is the part's own kind: an ORDINAL vs an exit id
        expect(typeof b.exits.addressOf(seedValue)).toBe('number');
        expect(typeof b.exits.addressOf(mzValue)).toBe('string');
        // ⛔ AND THE ADAPTER TAKES IT — a maze door inside the maze part
        const ring = h.session.apply({
            op: 'connect',
            from: [2, b.exits.addressOf(mzValue)],
            to: [3, b.exits.addressOf(b.exits.valueOf(b.adapterFns.exitsOfRoom(record, 3)[0]))],
        });
        expect(ring.ok || /already/.test(ring.description)).toBe(true);
        // ⛓ …and a `disconnect` built from a parted value is the PART's own op
        expect(b.exits.disconnectOp(2, mzValue))
            .toEqual({ op: 'disconnect', room: 2, exit_id: mzExits[0].exit_id });
        expect(b.exits.disconnectOp(1, seedValue))
            .toEqual({ op: 'disconnect', room: 1, exitIndex: seedExits[0].index });
    });

    /**
     * ⛓⛓⛓ **A ROOM CLOSES INTO ITS OWN PART AND THE OP IS ADDRESSED GLOBALLY.**
     * ⛔ MUTANT: the close addressed by the LOCAL index. Room 2 of the world is
     * room 0 of the maze part, so a local address would `replace-room` the
     * SEEDLING part's room 0 — a picture of one document written into another.
     */
    it('`closeRoomSession` folds ONE `replace-room` at the GLOBAL index', () => {
        const h = w4Session();
        const b = w4Bindings(h);
        const before = h.session.ops().length;
        const cell = b.adapterFns.readSetCell(h.session.record(), 2, 0);
        const world = deserializeMazeWorld(cell.payload);
        const roomSession = createEditSession(mazeEditAdapter, world);
        /**
         * ⛔⛔ **THE ROOM SESSION HAS TO CARRY AN EDIT, AND THAT IS THE ROW'S
         * OWN FINDING.** `editCore` drops a no-op: a close that re-serialised
         * an untouched room came back `{ok: true, applied: false}` and moved no
         * op at all, so a row over a ZERO-edit session would have passed under a
         * `closeRoomSession` that did nothing (trap 599's family — the close is
         * a TRANSITION, and its evidence here is the op, not the call).
         */
        const painted = roomSession.apply({ op: 'setTile', x: 2, y: 2, tile: 'wall' });
        expect(painted).toMatchObject({ ok: true, applied: true });
        expect(roomSession.ops()).toHaveLength(1);
        b.adapterFns.closeRoomSession(h.session, roomSession, 2);
        const ops = h.session.ops();
        expect(ops).toHaveLength(before + 1);
        expect(ops[ops.length - 1]).toMatchObject({ op: 'replace-room', room: 2 });
        // ⛔ …and the SEEDLING half is byte-untouched by a maze room's close
        expect(JSON.stringify(h.session.record().parts.seed)).toBe(JSON.stringify(h.set));
    });

    /**
     * ⛓⛓⛓ **THE DOWNLOAD IS THE WORLD PLUS BOTH PARTS, STAMPED ONCE.**
     */
    it('`worldDownloadMembers` emits the world, both parts and the companion', () => {
        const h = w4Session({ crossing: true });
        const out = worldDownloadMembers(h.session, h.parts);
        expect(out.members.map((m) => m.kind))
            .toEqual(['world', 'level-set', 'ap-mapping', 'region-library']);
        const world = out.members[0].doc;
        expect(world.world_id).toMatch(/^world-[0-9a-f]+$/);
        expect(out.report.world_id).toBe(world.world_id);
        expect(out.report.parts).toEqual(['seed', 'mz']);
        expect(out.report.rooms).toBe(4);
        expect(out.report.links).toBe(1);
        /**
         * ⛔ **THE PARTS' OVERLAYS RIDE INSIDE THE WORLD AND NOWHERE ELSE** — a
         * bundle carries ONE `overlay.json` member, so two overlays cannot both
         * ride it and a world that emitted them separately would write a member
         * kind the reader would hand back as somebody else's.
         */
        expect(Object.keys(world.overlays).sort()).toEqual(['mz', 'seed']);
        expect(world.overlays.mz.links).toHaveLength(1);
        expect(out.members.map((m) => m.kind).filter((k) => k === 'overlay')).toEqual([]);
        // ⛓ ONE STAMP PER PRESS — two presses over the same edits are one id
        expect(worldDownloadMembers(h.session, h.parts).members[0].doc.world_id)
            .toBe(world.world_id);
        // ⛓ …and an edit MOVES it
        h.go({ op: 'set-field', path: 'name', value: 'a world with a name' });
        expect(worldDownloadMembers(h.session, h.parts).members[0].doc.world_id)
            .not.toBe(world.world_id);
        // ⛓ the maze's `apMappingWhy` travels as a note, not as an empty companion
        expect(out.apMappingWhy).toMatch(/a region library has no VANILLA mapping/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ W4 — CROSS-PART DOORS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ W4 — the cross-part door', () => {
    /**
     * ⛔⛔ **THE EXITS ARE THE DERIVED ATLAS'S AND NOT THE PART'S** (§8.10 #4).
     * The claim is scored against the LAW: what the control offers is fed to
     * the world adapter's `connect`, and the row asserts it is ACCEPTED — and
     * that what the PART's own `exitsOfRoom` offers for the same room is a
     * different vocabulary that `deriveWorldAtlas` refuses by name.
     */
    it('offers the DERIVED exit ids, which are not the part\'s own', () => {
        const h = w4Session();
        const rows = worldDoorRows(h.session.record(), h.parts, h.deps);
        expect(rows.ok).toBe(true);
        expect(rows.rows.map((r) => r.index)).toEqual([0, 1, 2, 3]);
        expect(rows.rows.map((r) => r.part)).toEqual(['seed', 'seed', 'mz', 'mz']);
        expect(rows.rows.map((r) => r.local)).toEqual([0, 1, 0, 1]);
        expect(rows.rows.map((r) => r.region_id))
            .toEqual(['seed.level_0', 'seed.level_1', 'mz.mz_cross', 'mz.mz_hub']);
        // ⛓ a Seedling room's derived exits are `out_<type>_<x>_<y>`…
        expect(rows.rows[1].exits.some((e) => /^out_teleporter_\d+_\d+$/.test(e))).toBe(true);
        // ⛔ …and its PART's own `exitsOfRoom` offers ORDINALS instead
        const b = w4Bindings(h);
        const partExits = b.adapterFns.exitsOfRoom(h.session.record(), 1);
        expect(partExits.every((e) => Number.isInteger(e.index))).toBe(true);
        expect(partExits.some((e) => rows.rows[1].exits.includes(String(e.index)))).toBe(false);
    });

    /**
     * ⛔⛔ MUTANT: the gesture writes ARRAY endpoints for a cross-part door. The
     * shape is picked from the two cells' PARTS, and the two cases refuse each
     * other by name.
     */
    it('the SHAPE comes from the two parts — same part refuses the world form', () => {
        const from = { part: 'seed', room: 1, exit: 'out_teleporter_128_128' };
        const to = { part: 'mz', room: 0, exit: 'exit_3' };
        const cross = worldDoorOp(from, to, true);
        expect(cross.ok).toBe(true);
        expect(cross.shape).toBe('world');
        expect(cross.op).toEqual({ op: 'connect', from, to, one_way: true });
        // ⛔ both in ONE part is that part's own door, and it says which gesture draws it
        const same = worldDoorOp(from, { part: 'seed', room: 0, exit: 'x' }, true);
        expect(same.ok).toBe(false);
        expect(same.shape).toBe('part');
        expect(same.why).toMatch(/both endpoints are in part "seed"/);
        expect(same.why).toMatch(/ARRAY form/);
    });

    /**
     * ⛔⛔ MUTANT: `one_way` DEFAULTED. The refusal quotes BOTH substrates'
     * conventions, because the whole reason there is no default is that they
     * disagree and a crossing is in neither.
     */
    it('`one_way` is REQUIRED and the refusal quotes both conventions', () => {
        const from = { part: 'seed', room: 1, exit: 'out_teleporter_128_128' };
        const to = { part: 'mz', room: 0, exit: 'exit_3' };
        const unset = worldDoorOp(from, to, null);
        expect(unset.ok).toBe(false);
        expect(unset.why).toMatch(/one_way: true/);
        expect(unset.why).toMatch(/LINK_ONE_WAY_DEFAULT/);
        expect(worldDoorOp(from, to, false).op.one_way).toBe(false);
        expect(worldDoorOp(from, to, true).op.one_way).toBe(true);
        // ⛓ …and the world ADAPTER refuses an op with no `one_way`, which is the LAW
        const h = w4Session();
        const bad = h.session.apply({ op: 'connect', from, to });
        expect(bad.ok).toBe(false);
        expect(bad.description).toMatch(/one_way/);
    });

    /**
     * ⛓⛓⛓ **THE PREVIEW IS THE DERIVATION'S OWN ANSWER.** ⛔ MUTANT: the
     * displacement not shown (or predicted by a second model). A generated
     * Seedling set has NO spare exit — measured in W2 §8.3 — so a crossing out
     * of one ALWAYS displaces, and the row asserts the preview says the same
     * thing the applied op then says.
     */
    it('the DISPLACEMENT is previewed, and the press then reports the same one', () => {
        const h = w4Session();
        const built = worldDoorOp(
            { part: 'seed', room: 1, exit: 'out_teleporter_128_128' },
            { part: 'mz', room: 0, exit: 'exit_3' },
            true,
        );
        const preview = worldDoorPreview(h.session.record(), h.parts, h.deps, built.op);
        expect(preview.ok).toBe(true);
        expect(preview.displaced).toEqual([{
            link: 0, region: 'seed.level_1', exit: 'out_teleporter_128_128',
            was: ['seed.level_0', 'in_L1_128_128'],
        }]);
        expect(preview.notes.join(' ')).toMatch(/DISPLACED the part-internal connection/);
        // ⛔ …and the PRESS produces exactly that, off a derivation that really ran
        expect(h.session.apply(built.op).ok).toBe(true);
        const after = deriveWorldAtlasOf(h.session.record(), { parts: h.parts, deps: h.deps });
        expect(after.displaced).toEqual(preview.displaced);
        // ⛓ the SYMMETRIC op takes ONE endpoint and the adapter finds the link from either side
        const off = worldDoorDisconnectOp(built.op.to);
        expect(off.ok).toBe(true);
        const gone = h.session.apply(off.op);
        expect(gone.ok).toBe(true);
        expect(h.session.record().world.links).toEqual([]);
    });

    /**
     * ⛓ A ROOM THE DERIVATION DROPPED HAS NO REGION AND SAYS SO — an empty exit
     * list alone reads as *"this room has no doors"*, which is a different fact.
     */
    it('a room with no region is NAMED, not offered as an empty list', () => {
        const set = buildLevelSet(
            [0, 1, 2].map((level) => emptyLevel({ level })), { setId: 'w4-drop', link: false },
        ).set;
        const lib = w4Library();
        const world = w4World({ set, library: lib });
        const { parts, deps } = worldPartDescriptors({ world, ...w4Deps() });
        const rows = worldDoorRows(worldRecord(world, { seed: set, mz: lib }), parts, deps);
        expect(rows.ok).toBe(true);
        const dropped = rows.rows.filter((r) => r.region_id === null);
        expect(dropped.length).toBeGreaterThan(0);
        for (const row of dropped) {
            expect(row.exits).toEqual([]);
            expect(row.why).toMatch(/the derivation kept NO region for this room/);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ W4 — THE ALL-MAZE PROJECTION (M2), AND THE PER-PART REPORT ROWS
 * ══════════════════════════════════════════════════════════════════════ */

const w4AllMazeProjection = (h) => {
    const record = h.session.record();
    const seedDeps = seedlingMazeProjectionDeps({
        mapDoc: { levels: roomsOfSet(record.parts.seed, parseOelLevel) }, gameConfig: {},
    });
    return {
        ...MAZE_CONDITION_DEPS,
        ...seedDeps,
        gridFor: (region) => {
            if (partOfRegion(region.region_id) === 'mz') {
                const entry = record.parts.mz.entries[region.map_ref];
                return entry ? mazeGridFor(entry.payload) : null;
            }
            return seedDeps.gridFor(region);
        },
    };
};

describe('⛓⛓⛓ W4 — the ALL-MAZE projection (M2)', () => {
    /**
     * ⛔⛔ **THE BRIEF'S RECIPE THROWS, AND THIS ROW IS WHY THE SHIPPED ONE IS
     * DIFFERENT.** W2 §8.7 proposed an injected `sidecarBuilders` row for
     * `flash_seedling`; over a WIRED world it dies on `wiredExit is not a
     * function`, because the maze row's context is built INSIDE
     * `compileRegionAtlas` from that compile's own graph and an injected builder
     * is handed `(region, substrateId)` and nothing else. ⛓ Pinned rather than
     * remembered: the day the compiler hands its ctx to injected rows, this row
     * goes red and the shipped recipe can be simplified.
     */
    it('an INJECTED `flash_seedling` builder cannot have the maze row\'s ctx', () => {
        const h = w4Session({ crossing: true });
        const derived = deriveWorldAtlasOf(h.session.record(), { parts: h.parts, deps: h.deps });
        const proj = w4AllMazeProjection(h);
        expect(() => compileRegionAtlas(derived.atlas, {
            gameName: 'W4',
            mazeProjection: proj,
            sidecarBuilders: {
                [substrateIdFor(SEEDLING_ATLAS_GAME)]: (region) => {
                    const grid = proj.gridFor(region);
                    if (!grid) return { sidecars: {}, bound: false };
                    const p = projectRegionToMaze(region, grid, { ...proj });
                    return { sidecars: p.sidecars, bound: true, notes: p.notes };
                },
            },
        })).toThrow(/wiredExit is not a function/);
    });

    /**
     * ⛓⛓ …and the shipped one: the region's own `substrate` is STRIPPED for this
     * one compile so the compiler's BUILT-IN maze row — with its full ctx —
     * projects every region.
     */
    it('the shipped recipe compiles EVERY region to `maze`, schema-clean', () => {
        const h = w4Session({ crossing: true });
        const out = worldAllMazeRulesJson(h.session, h.deps, {
            parts: h.parts,
            compileRegionAtlas,
            mazeProjection: w4AllMazeProjection(h),
            gameName: 'W4 all-maze',
        });
        // ⛔ THE HEADLINE — every one of the four rooms, on ONE substrate.
        expect(out.report.substrates).toEqual({ maze: 4 });
        expect(rulesJsonSchemaErrors(out.rules, loadRulesSchema())).toEqual([]);
        const all = Object.keys(regionsOf(out.rules, '1'));
        const reached = reachableRegions(out.rules, '1');
        expect(all.filter((n) => !reached.has(n))).toEqual([]);
        // ⛓ …and the FLASH-default compile of the same world still reports BOTH,
        //   which is what makes the two downloads two answers and not one.
        const b = w4Bindings(h);
        const flash = b.adapterFns.rulesJsonOf(h.session, h.deps, { compileRegionAtlas });
        expect(flash.report.substrates).toEqual({ flash_seedling: 2, maze: 2 });
        /**
         * ⛔ **NOTHING IS WRITTEN BACK.** The projection is a COMPILE-TIME one:
         * the world, both parts and every region's authored `substrate` are
         * untouched, which is what keeps the download beside it honest.
         */
        const after = deriveWorldAtlasOf(h.session.record(), { parts: h.parts, deps: h.deps });
        expect(after.atlas.regions.map((r) => r.substrate))
            .toEqual(['flash_seedling', 'flash_seedling', 'maze', 'maze']);
        expect(out.atlas.regions.every((r) => r.substrate === undefined)).toBe(true);
        /**
         * ⛓⛓⛓ DEDUP M9 — **AND IT IS THE SAME SHAPE THE OTHER `rules.json`
         * PATH RETURNS.** This function was a second copy of
         * `worldRulesJsonOf` and its copy DROPPED `stats` and `dropped`, so the
         * same page had two rules.json paths with two shapes and a reader that
         * asked this one for the derivation's own numbers got `undefined`. It
         * is a three-line wrapper now; the row states the shape.
         */
        expect(Object.keys(out))
            .toEqual(['rules', 'report', 'atlas', 'notes', 'displaced', 'stats', 'dropped']);
        expect(out.stats.substrates).toEqual({ flash_seedling: 2, maze: 2 });
        expect(out.stats.parts).toBe(2);
        expect(out.dropped).toEqual([]);
        /**
         * ⛔ …and `stats` is the DERIVATION's, not the compile's: the atlas it
         * counts still names both substrates, where `report.substrates` above
         * says `{maze: 4}`. Two true sentences about two different objects, and
         * the copy could say neither.
         */
        expect(out.report.substrates).toEqual({ maze: 4 });
    });
});

describe('⛓⛓⛓ W4 — the REPORT rows a world can only answer PER PART', () => {
    /**
     * ⛔⛔ W2 §8.1 #4: both rows read `record.overlay.rooms` keyed by room INDEX
     * and join a region by `map_ref`, which in a MERGED atlas is the PART's own
     * local index. A world's record has no `overlay` at all, so `reportOver`
     * prints NEITHER — and the mutant this catches is a world REPORT that says
     * *"every authored rule gates something"* over an overlay it never looked at.
     */
    it('`reportOver` prints neither row for a world, and the binding adds both', () => {
        const h = w4Session();
        const b = w4Bindings(h);
        const rep = reportOver({
            session: h.session,
            deps: h.deps,
            adapterFns: b.adapterFns,
            document: b.document,
            ruleKeys: b.ruleKeys,
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: loadAtlasSchema(),
        });
        // ⛔ the composite's own report is SILENT on the inert-rule scan
        expect(rep.rows.filter((r) => r.kind === 'inert-rule')).toEqual([]);
        /**
         * ⛔⛔ **AND ITS `locations` ROW IS WORSE THAN SILENT — THIS ROW FOUND
         * IT.** §8.10 called it *"structurally empty"*; it is printed either
         * way, comparing `overlayLocationCount` (0 for a world — its parts'
         * overlays live INSIDE the world document) against the COMPILED total,
         * which counts every part's. So it reads a harmless 0/0 here…
         */
        expect(rep.rows.filter((r) => r.kind === 'locations').map((r) => r.text))
            .toEqual(['0 location(s) in the OVERLAY, 0 compiled']);
        // ⛓ …and the binding's rows name the PART in every one of them
        const extra = b.reportRows(h.session.record(), rep);
        const parted = extra.filter((r) => r.text.startsWith('part "'));
        expect(parted.length).toBeGreaterThan(0);
        expect(parted.every((r) => /^part "(seed|mz)": /.test(r.text))).toBe(true);
        expect(parted.filter((r) => r.kind === 'locations').map((r) => r.text))
            .toEqual(['part "seed": 0 location(s) in its own overlay',
                'part "mz": 0 location(s) in its own overlay']);
        // ⛓ …and the row that says the core's own one does not apply
        expect(extra[0].text).toMatch(/does NOT apply to a world/);

        /**
         * ⛔⛔ **…AND IT FLIPS TO A FALSE `warn` AS SOON AS A PART HOLDS ONE.**
         * One location in the maze part makes the compiled total 1 while the
         * composite overlay's count stays 0, and the core's row then quotes a
         * sentence about *"an overlay that did not travel with its set"* which
         * is NOT what happened. This is the claim the extra row exists to
         * defuse, and the per-part rows are what tell the truth.
         */
        const marked = h.session.apply({
            op: 'mark-location', room: 2, item: 0, name: 'a coin', vanilla_item: 'Coin',
        });
        expect(marked.ok).toBe(true);
        const rep2 = reportOver({
            session: h.session,
            deps: h.deps,
            adapterFns: b.adapterFns,
            document: b.document,
            ruleKeys: b.ruleKeys,
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: loadAtlasSchema(),
        });
        const core = rep2.rows.filter((r) => r.kind === 'locations');
        expect(core).toHaveLength(1);
        expect(core[0].severity).toBe('warn');
        expect(core[0].text).toMatch(/0 location\(s\) in the OVERLAY, 1 compiled/);
        expect(core[0].text).toMatch(/they DISAGREE/);
        const after = b.reportRows(h.session.record(), rep2)
            .filter((r) => r.kind === 'locations' && r.text.startsWith('part "'))
            .map((r) => r.text);
        expect(after).toEqual(['part "seed": 0 location(s) in its own overlay',
            'part "mz": 1 location(s) in its own overlay']);
    });

    /**
     * ⛓⛓⛓ DEDUP M10 — **THE ROWS READ THE ATLASES THE REPORT ALREADY
     * DERIVED**, and the count is what says so. Every part's atlas was derived
     * a second time here for rows that are byte-identical either way, so a
     * claim about the ROWS cannot see this change at all — the subject is the
     * NUMBER OF DERIVATIONS, counted with a spy on each part's own
     * `deriveAtlasOf` and stated as a function of `parts.length` rather than
     * typed.
     *
     * ⛔ The FALLBACK is exercised beside it: `reportOver` returns EARLY with no
     * derivation when the world's atlas does not build, so rows called without
     * a report must still derive for themselves — which is what makes a
     * `derivedParts`-less call produce the SAME rows at the OLD price.
     */
    it('the per-part rows cost the report NOTHING to derive, and say the same thing', () => {
        const h = w4Session();
        let derives = 0;
        const spied = h.parts.map((p) => ({
            ...p,
            deriveAtlasOf: (...a) => { derives++; return p.deriveAtlasOf(...a); },
        }));
        const b = worldSetBindings({
            parts: spied,
            deps: h.deps,
            parseOel: parseOelLevel,
            drawMazeStill: makeDrawRoomStill(),
            compileOptions: {
                mazeProjection: {
                    ...MAZE_CONDITION_DEPS,
                    gridFor: (region) => {
                        if (partOfRegion(region.region_id) !== 'mz') return null;
                        const entry = h.session.record().parts.mz.entries[region.map_ref];
                        return entry ? mazeGridFor(entry.payload) : null;
                    },
                },
            },
            gameName: 'W4 World',
        });
        const rep = reportOver({
            session: h.session,
            deps: h.deps,
            adapterFns: b.adapterFns,
            document: b.document,
            ruleKeys: b.ruleKeys,
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: loadAtlasSchema(),
        });
        /**
         * ⛓ The REPORT itself derives the world twice — once for the atlas it
         * validates and once inside the compile — so its own price is
         * `2 × parts`. What this row is about is the NEXT number.
         */
        const forReport = derives;
        expect(forReport).toBe(2 * h.parts.length);
        const withReport = b.reportRows(h.session.record(), rep);
        expect(derives - forReport).toBe(0);
        // ⛓ …and WITHOUT the report's derivation the rows are the same rows,
        //   derived here — one per part, the price this change removed.
        const before = derives;
        const withoutReport = b.reportRows(h.session.record(), null);
        expect(derives - before).toBe(h.parts.length);
        expect(withoutReport).toEqual(withReport);
        expect(withReport.filter((r) => r.kind === 'locations' && r.text.startsWith('part "'))
            .map((r) => r.text)).toEqual(h.parts
            .map((p) => `part "${p.id}": 0 location(s) in its own overlay`));
    });
});

describe('⛓⛓⛓ DEDUP M11 — "another room is open", ONE rule for both open routes', () => {
    /**
     * ⛔⛔ **THIS IS THE PIN FOR D3'S ONE BEHAVIOUR CHANGE**, and it is here
     * rather than in the browser gate for the reason `roomOpenRefusal`'s own
     * docblock gives: the branch that moved needs the page to hold a LOCAL room
     * session at an index whose cell reads as the OTHER substrate, which the
     * page can barely reach — a browser row would be a fixture that cannot tell
     * the two builds apart (⛓ the vacuous-mutant family). The rule is pure, so
     * the state is just an argument.
     */
    const OPEN_NOTHING = { foreignRoomIndex: null, roomIndex: null, roomOps: 0 };

    it('nothing open ⇒ every index opens', () => {
        expect(roomOpenRefusal(OPEN_NOTHING, 0)).toBe(null);
        expect(roomOpenRefusal(OPEN_NOTHING, 7)).toBe(null);
        // ⛓ …and the DEFAULTS say the same thing, so a caller that knows of no
        //   open room does not have to spell three nulls.
        expect(roomOpenRefusal({}, 3)).toBe(null);
        expect(roomOpenRefusal(undefined, 3)).toBe(null);
    });

    it('a FOREIGN room open blocks every OTHER index and exempts its own', () => {
        const open = { ...OPEN_NOTHING, foreignRoomIndex: 2 };
        expect(roomOpenRefusal(open, 3)).toBe('foreign');
        expect(roomOpenRefusal(open, 0)).toBe('foreign');
        expect(roomOpenRefusal(open, 2)).toBe(null);
    });

    it('a LOCAL room open with UNWRITTEN edits blocks every OTHER index', () => {
        const open = { ...OPEN_NOTHING, roomIndex: 2, roomOps: 1 };
        expect(roomOpenRefusal(open, 3)).toBe('local');
        expect(roomOpenRefusal(open, 0)).toBe('local');
    });

    /**
     * ⛓⛓⛓ **THE ROW THE ASYMMETRY WOULD RED.** Before D3 the FOREIGN route did
     * not exempt the same index from the LOCAL guard: `openForeignRoomAt` asked
     * `roomIndex !== null && ops > 0` where `openSetRoomAt` asked
     * `roomIndex !== null && roomIndex !== index && ops > 0`. Reinstating the
     * asymmetric spelling makes this row return `'local'`.
     */
    it('⛔ …and NOT its own index — the same-index exemption is in BOTH guards', () => {
        expect(roomOpenRefusal({ ...OPEN_NOTHING, roomIndex: 2, roomOps: 1 }, 2)).toBe(null);
        expect(roomOpenRefusal({ ...OPEN_NOTHING, roomIndex: 0, roomOps: 9 }, 0)).toBe(null);
    });

    it('a LOCAL room open with NO unwritten edit blocks nothing', () => {
        const clean = { ...OPEN_NOTHING, roomIndex: 2, roomOps: 0 };
        expect(roomOpenRefusal(clean, 3)).toBe(null);
        expect(roomOpenRefusal(clean, 2)).toBe(null);
    });

    /** ⛓ …and the FOREIGN guard is asked FIRST, which is the order both routes
     *  printed their sentences in. */
    it('both open ⇒ the FOREIGN guard answers', () => {
        expect(roomOpenRefusal({ foreignRoomIndex: 1, roomIndex: 2, roomOps: 1 }, 3))
            .toBe('foreign');
    });
});
