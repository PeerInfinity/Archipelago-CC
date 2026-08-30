/**
 * mazeRoom/mazeLibraryEntry — **THE BLANK-ROOM CONSTRUCTOR** (EDITOR v3 slice
 * E3b; plan §30.13, §31.1 #6, §31.2).
 *
 * ⛔ **WHAT IS GATED HERE.** The capture / instantiate / validate hooks in this
 * module are exercised through `mazeSetAdapter.test.js` and
 * `mazeRoomLibrary.test.js`, which drive them with real committed entries. This
 * file gates the one thing E3b added — `blankTileGridLibraryEntry` — and it
 * gates it the only way that means anything: by putting its result through
 * `add-room`, which is the op it exists to feed.
 */

import { describe, expect, it } from 'vitest';

import { serializeMazeWorld } from '../procgenPipeline/procgenPipelineEngine.js';
import { blankTileGridLibraryEntry, validateTileGridLibraryEntry } from './mazeLibraryEntry.js';
import {
    TILE_FLOOR, createWorld, deserializeMazeWorld, extractPathsAndObstacles,
} from './mazeRoomEngine.js';
import { deriveAtlasOf } from './mazeAtlasDerivation.js';
import {
    blankMazeRoomPayload, createMazeSetAdapter, setRecord,
} from './mazeSetAdapter.js';

const DEPS = Object.freeze({
    createWorld, serialize: serializeMazeWorld, extract: extractPathsAndObstacles,
});

/** ⛓ A library with no entries — what a page's "new library" starts from. */
const emptyLibrary = () => setRecord({
    schema_version: 1, library_id: 'blank-probe', entries: [],
});

describe('⛓⛓⛓ `blankTileGridLibraryEntry` — a PAYLOAD, doorless and one component', () => {
    it('⛓ it is a sidecar `deserializeMazeWorld` reads back at the size asked for', () => {
        const payload = blankTileGridLibraryEntry({ width: 8, height: 6 }, DEPS);
        expect(payload.width).toBe(8);
        expect(payload.height).toBe(6);
        expect(payload.tiles).toHaveLength(48);
        const world = deserializeMazeWorld(payload);
        expect(world.width).toBe(8);
        expect(world.height).toBe(6);
    });

    /**
     * ⛓⛓ EVERY TILE IS FLOOR, so the one-component check `mazeAtlasDerivation`
     * floods from the entrance passes BY CONSTRUCTION rather than by luck —
     * `createWorld`'s `Int8Array` is zeros and `TILE_FLOOR` is 0.
     */
    it('⛓ every tile is FLOOR and there is exactly ONE entrance', () => {
        const payload = blankTileGridLibraryEntry({ width: 5, height: 4 }, DEPS);
        expect(TILE_FLOOR).toBe(0);
        expect(payload.tiles.every((t) => t === TILE_FLOOR)).toBe(true);
        expect(payload.entrance).toEqual({ x: 0, y: 0 });
        expect(blankTileGridLibraryEntry({ width: 5, height: 4, entrance: { x: 2, y: 1 } }, DEPS)
            .entrance).toEqual({ x: 2, y: 1 });
    });

    /**
     * ⛔⛔ **DOORLESS ON PURPOSE, AND MEASURED VALID.** `createWorld`'s DEFAULT
     * is an exit at the bottom-right — a door the author did not draw — so the
     * constructor passes `exits: []` explicitly. §31.2 asked what
     * `validateTileGridLibraryEntry` says of a doorless entry, and the answer,
     * measured here rather than assumed, is `{errors: []}`: its three checks are
     * capability-vs-payload consistency, and a declared `exit_sides: []` agrees
     * with an actual `[]`. ⇒ the constructor does NOT mint an exit.
     */
    it('⛔ it is DOORLESS, and the capability validator accepts that', () => {
        const payload = blankTileGridLibraryEntry({ width: 6, height: 6 }, DEPS);
        expect(payload.exits).toEqual([]);
        expect(payload.items).toEqual([]);
        expect(payload.obstacles).toEqual([]);
        // the entry the CAPTURE path builds from it — the only place capability
        // metadata is ever written — and what the validator says of it
        const adapter = createMazeSetAdapter();
        const record = emptyLibrary();
        const out = adapter.apply(record, { op: 'add-room', payload });
        expect(out.ok, out.description).toBe(true);
        const [entry] = out.record.library.entries;
        expect(entry.exit_sides).toEqual([]);
        expect(entry.location_slots).toBe(0);
        expect(entry.region_size).toEqual({ width: 6, height: 6 });
        // ⛔ the contract `entryFromPayload` asserts, asserted again from outside
        expect(entry.carried_rules).toBe(null);
        expect(validateTileGridLibraryEntry(entry, { deserialize: deserializeMazeWorld }))
            .toEqual({ errors: [] });
        // ⛓ …and a doorless entry really is the discriminating case: the CONTROL
        //   is the same world with a door, which the validator also accepts, so
        //   the row above is not passing because the validator accepts anything.
        const withDoor = serializeMazeWorld(
            createWorld(6, 6, { entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'e0', x: 5, y: 0, side: 'N' }] }),
            extractPathsAndObstacles(createWorld(6, 6, {
                entrance: { x: 0, y: 0 }, exits: [{ exit_id: 'e0', x: 5, y: 0, side: 'N' }],
            }), { regionId: null }),
        );
        expect(withDoor.exits).toHaveLength(1);
        const doored = adapter.apply(out.record, { op: 'add-room', payload: withDoor });
        expect(doored.ok).toBe(true);
        expect(doored.record.library.entries[1].exit_sides).toEqual(['N']);
    });

    /**
     * ⛔ **NO `entry_id`, NO `name`** — the kickoff named both, and the payload
     * carries neither. `add-room` MINTS the id (`freshEntryId`, derived from the
     * library's count) and takes the `name`, so a parameter here would be one
     * the caller believes named the room and that nothing reads.
     */
    it('⛔ the payload carries no identity — `add-room` mints it, and takes the name', () => {
        const payload = blankTileGridLibraryEntry({ width: 4, height: 4 }, DEPS);
        expect(Object.keys(payload)).not.toContain('entry_id');
        expect(Object.keys(payload)).not.toContain('name');
        const adapter = createMazeSetAdapter();
        const out = adapter.apply(emptyLibrary(), { op: 'add-room', payload, name: 'Scratch' });
        expect(out.ok).toBe(true);
        expect(out.record.library.entries[0].entry_id).toBe('room_0');
        expect(out.record.library.entries[0].name).toBe('Scratch');
        // …and a second blank room gets the NEXT id, from the same counter
        const two = adapter.apply(out.record, { op: 'add-room', payload });
        expect(two.record.library.entries[1].entry_id).toBe('room_1');
    });

    /** ⛓ The binding a page calls, over the maze's own three primitives. */
    it('⛓ `blankMazeRoomPayload` is the same payload, with the engine bound', () => {
        expect(JSON.stringify(blankMazeRoomPayload({ width: 7, height: 3 })))
            .toBe(JSON.stringify(blankTileGridLibraryEntry({ width: 7, height: 3 }, DEPS)));
    });

    /**
     * ⛔ THE DEPS ARE REQUIRED BY NAME. This module names no engine of its own —
     * every hook in it takes `serialize`/`extract`/`deserialize` as `deps` —
     * and a default here would be the first import it ever made.
     */
    it('⛔ each dep is refused by name when absent, and `createWorld` owns the size rule', () => {
        for (const missing of ['createWorld', 'serialize', 'extract']) {
            const deps = { ...DEPS };
            delete deps[missing];
            expect(() => blankTileGridLibraryEntry({ width: 4, height: 4 }, deps), missing)
                .toThrow(new RegExp(`\`deps.${missing}\` is required`));
        }
        expect(() => blankTileGridLibraryEntry({ width: 4, height: 4 }, undefined))
            .toThrow(/`deps.createWorld` is required/);
        // ⛓ …and a dimension below 2 is refused by `createWorld`, not re-spelled
        //   here: ONE authority for what a world may be.
        expect(() => blankTileGridLibraryEntry({ width: 1, height: 5 }, DEPS))
            .toThrow(/invalid dimensions 1x5/);
    });

    /**
     * ⛓⛓ **THE ROOM IS UNWIRED, AND THE DERIVATION KEEPS IT.** §26.5 rules that
     * a library entry with no link YET is a room the author just added, not an
     * orphan — the opposite of Seedling's drop — and that the REPORT names it.
     * The row drives the whole path: blank payload → `add-room` → derive.
     */
    it('⛓ a blank room survives the DERIVATION as an unwired region', () => {
        const adapter = createMazeSetAdapter();
        const seeded = adapter.apply(emptyLibrary(),
            { op: 'add-room', payload: blankMazeRoomPayload({ width: 5, height: 5 }) });
        expect(seeded.ok).toBe(true);
        const { atlas } = deriveAtlasOf(seeded.record, { atlas: { game: 'maze' } });
        const [region] = atlas.regions;
        // ⛓ KEPT, not dropped — §26.5's rule, the opposite of Seedling's
        expect(atlas.regions).toHaveLength(1);
        expect(region.exits).toEqual([]);
        expect(atlas.vanilla_layout.connections).toEqual([]);
        expect(region.bounds).toEqual({ x: 0, y: 0, w: 5, h: 5 });
        // …and the derived atlas names the substrate the LIBRARY declares
        expect(atlas.game).toBe('maze');
    });
});
