// Unit tests for the Phase 5 exporter — generated rooms → a mountable level set
// (CC/docs/plans/seedling-external-level-sets.md).
//
// ⛓ THE ORACLE IS THE INHERITED VALIDATOR, NOT A RESTATEMENT OF IT. Every set
// built here is handed to `validateLevelSet`, which has been the sender-side
// authority since Phase 2 and was mutation-checked then. Asserting "the exporter
// emits a room id equal to its position" inside this file would be a second copy
// of a rule that already exists; asserting "what this exporter emits SURVIVES
// that rule" is the claim worth making, and it is the one that fails if either
// side moves.
import { describe, it, expect } from 'vitest';

import {
    buildLevelSet,
    apMappingInvalidation,
    reachabilityOf,
    VANILLA_AP_REFERENCE_COUNT,
    DEFAULT_MUSIC,
    LevelSetExportError,
} from './levelSetExporter.js';
import {
    validateLevelSet,
    planLevelSetChunks,
    assembleLevelSetChunks,
    saveStampMatches,
    levelSetSaveStamp,
    computeLevelSetContentHash,
    NAMED_ROOM_KEYS,
} from './levelSetValidator.js';

/** A record shaped exactly as `procgenSeedling` emits one — 900 and all. */
const record = (overrides = {}) => ({
    level: 900,
    class: 'Procgen900',
    path: 'procgen/900.oel',
    width: 10,
    height: 10,
    layers: [{
        name: 'tiles',
        set: 'tileset',
        tiles: [[0, 0, 48, 0], [1, 1, 0, 0], [9, 9, 48, 0]],
    }],
    entities: [{ type: 'torchpickup', x: 80, y: 112, attrs: { tag: '0' } }],
    ...overrides,
});

const summary = { startCell: { tx: 1, ty: 1 }, goalCell: { tx: 5, ty: 7 } };

describe('buildLevelSet — what it emits survives the inherited validator', () => {
    it('builds a set of N generated rooms that validates clean', () => {
        const { set } = buildLevelSet([record(), record(), record()],
            { setId: 'procgen-test' });
        const r = validateLevelSet(set);
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
        expect(set.rooms.map((x) => x.id)).toEqual([0, 1, 2]);
    });

    // ⛔ THE GENERATOR'S OWN IDENTITY IS UNUSABLE, AND THIS IS THE PROOF. Every
    // record it emits is `level: 900`, `class: "Procgen900"` — so passing them
    // through would give three rooms all claiming index 900 and all sharing a
    // name. Both are ASSIGNED here, and the assignment is what the manifest's
    // "position is identity" rule needs.
    it('assigns dense ids and unique names over records that all say 900', () => {
        const { set, report } = buildLevelSet([record(), record(), record()]);
        expect(set.rooms.map((x) => x.name)).toEqual(
            ['Procgen900_000', 'Procgen900_001', 'Procgen900_002'],
        );
        expect(report.notes.filter((n) => /answers to level 900/.test(n))).toHaveLength(3);
    });

    it('refuses two rooms with the same name, naming the generator as the cause', () => {
        expect(() => buildLevelSet([{ record: record(), name: 'a' }, { record: record(), name: 'a' }]))
            .toThrow(LevelSetExportError);
        expect(() => buildLevelSet([{ record: record(), name: 'a' }, { record: record(), name: 'a' }]))
            .toThrow(/Every generated record carries class "Procgen900"/);
    });

    // ⛓ THE ⚖ 2026-08-14 RULING, END TO END. A generated set has no Watcher, no
    // moonrock and no Owl — and the empty object is CHECKED against the rooms by
    // the validator rather than taken on trust, which is what makes it a
    // statement rather than a default.
    it('emits named_rooms: {} and the validator MEASURES that all six are unneeded', () => {
        const { set } = buildLevelSet([record()]);
        expect(set.named_rooms).toEqual({});
        const r = validateLevelSet(set);
        expect(r.ok).toBe(true);
        expect(r.stats.named_rooms_omitted.sort()).toEqual([...NAMED_ROOM_KEYS].sort());
        expect(r.stats.named_rooms_unverifiable).toEqual([]);
        expect(r.stats.named_rooms_required_missing).toEqual([]);
    });

    // ⛔ AND IT IS NOT A BLANKET EXEMPTION. Put a trigger in a generated room and
    // the set is refused until it says where that name points. A test that only
    // showed the empty object passing would be showing a rule that never fires.
    it('a generated room carrying a trigger makes the entry required again', () => {
        const withBeast = record({
            entities: [{ type: 'tentaclebeast', x: 32, y: 32, attrs: { tag: '4' } }],
        });
        const { set } = buildLevelSet([record(), withBeast]);
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /named_rooms\.tentacle_beast_mouth is required: rooms\[1\]/.test(e)))
            .toBe(true);

        // …and supplying it is the cure, with no other change.
        const fixed = buildLevelSet([record(), withBeast], {
            namedRooms: { tentacle_beast_mouth: { level: 0, x: 56, y: 96 } },
        }).set;
        expect(validateLevelSet(fixed).errors).toEqual([]);
    });
});

// ⛔ A VALUE THE EXPORTER CHOSE MUST NOT READ AS ONE THE GENERATOR DETERMINED.
// Plan §5 presumed procgenSeedling's output already carried what a manifest
// needs; it does not, and the difference has to survive into the document rather
// than into a console line nobody keeps.
describe('provenance.invented separates measured values from chosen ones', () => {
    it('lists the fields nothing determined, and travels IN the set', () => {
        const { set, report } = buildLevelSet([{ record: record(), summary }]);
        expect(set.provenance.invented).toEqual(report.invented);
        expect(set.provenance.invented).toContain('menu_rooms');
        expect(set.provenance.invented).toContain('rooms[].music');
        expect(set.provenance.invented).toContain('rooms[].name');
    });

    // ⛓ `start` IS DERIVED WHEN THE GENERATOR ACTUALLY KNOWS IT — startCell is a
    // real measurement, in TILES, and a manifest spawn is in PIXELS. Listing a
    // derived value as invented would be as wrong as the reverse.
    it('DERIVES start from summary.startCell, in pixels, and does not call it invented', () => {
        const { set, report } = buildLevelSet([{ record: record(), summary }]);
        expect(set.start).toEqual({ level: 0, x: 16, y: 16 });
        expect(report.invented).not.toContain('start');
    });

    it('and says so when there is no summary to derive it from', () => {
        const { set, report } = buildLevelSet([record()]);
        expect(set.start).toEqual({ level: 0 });
        expect(report.invented).toContain('start');
        expect(report.notes.some((n) => /no summary.startCell/.test(n))).toBe(true);
    });

    it('stops listing a field once the caller supplies it', () => {
        const { report } = buildLevelSet([{ record: record(), name: 'entrance', music: 5 }],
            { menuRooms: [0], start: { level: 0, x: 80, y: 128 } });
        expect(report.invented).toEqual([]);
    });

    it('falls back to music 0 and reports it, rather than picking silently', () => {
        const { set, report } = buildLevelSet([record()]);
        expect(set.rooms[0].music).toBe(DEFAULT_MUSIC);
        expect(report.invented).toContain('rooms[].music');
    });

    // ⛔ THIS TEST EXISTS BECAUSE THE MUTATION GATE FOUND ITS ABSENCE. One of
    // Phase 5's two planted defects made `buildLevelSet` write
    // `snow_gradient: true` on every room, and this file did not notice —
    // `validateLevelSet` accepts any boolean, so the whole JS side was blind to
    // a generated room claiming vanilla room 45's behaviour. Only the artifact
    // readback caught it (`snow [0,1,2,3,4,5]`). ⚠ The flags are ABSENT-means-
    // false, so "the set says nothing" and "the set says false" are the same to
    // the game and must both stay distinguishable from "the set says true".
    it('writes NEITHER room flag unless the entry asked for it', () => {
        const { set } = buildLevelSet([record(), record()]);
        for (const room of set.rooms) {
            expect(room.snow_gradient).toBeUndefined();
            expect(room.music_override_exempt).toBeUndefined();
        }
        const asked = buildLevelSet([{ record: record(), snow_gradient: true }]).set;
        expect(asked.rooms[0].snow_gradient).toBe(true);
        expect(asked.rooms[0].music_override_exempt).toBeUndefined();
    });
});

// ⛔ THE FINDING THAT WOULD OTHERWISE BE INVISIBLE. A generated set validates
// clean while being N rooms the player can never leave the first of — the
// palette places obstacles, not transitions. Reported every time, because a set
// that passed every rule and is disconnected is exactly the quiet §6 exists for.
describe('reachability — a set that validates is not thereby connected', () => {
    it('reports a generated set as N isolated rooms', () => {
        const { report } = buildLevelSet([record(), record(), record()]);
        expect(report.reachability).toEqual({
            start: 0, reachable: 1, total: 3, unreachable: [1, 2], rooms_not_walked: 0,
        });
        // …and the validator is still happy, which is the whole point.
        expect(validateLevelSet(buildLevelSet([record(), record(), record()]).set).ok).toBe(true);
    });

    it('follows exits and fallthroughs once a room has them', () => {
        const withExit = record({
            entities: [{ type: 'teleporter', x: 16, y: 16, attrs: { to: '1', playerx: '8', playery: '8' } }],
        });
        const withFall = record({
            entities: [{ type: 'control', x: 0, y: 0, attrs: { fallthrough: '2', xOff: '0', yOff: '0' } }],
        });
        const { report } = buildLevelSet([withExit, withFall, record()]);
        expect(report.reachability.reachable).toBe(3);
        expect(report.reachability.unreachable).toEqual([]);
    });

    // ⛔ NAME WHAT THE WALK COULD NOT SEE. An embed-sourced room's exits are
    // unreadable, so a reachable count computed over it would be a floor
    // presented as a fact.
    it('counts rooms it could not walk instead of assuming they are leaves', () => {
        const set = {
            rooms: [{ id: 0, source: { xml: '<level><objects></objects></level>' } },
                { id: 1, source: { embed: 'levels/Somewhere.oel' } }],
            start: { level: 0 },
        };
        expect(reachabilityOf(set).rooms_not_walked).toBe(1);
    });
});

// ⚖ USER, 2026-08-14: INVALIDATE, STAMPED (plan §6.1).
describe('the AP-mapping companion', () => {
    it('names all 24 references, in three tables, carrying the set stamp', () => {
        const { set } = buildLevelSet([record()], { setId: 'procgen-test' });
        const doc = apMappingInvalidation(set);
        expect(doc.total_references).toBe(24);
        expect(VANILLA_AP_REFERENCE_COUNT).toBe(24);
        expect(doc.references.map((r) => r.count)).toEqual([9, 11, 4]);
        expect(doc.set_id).toBe(set.set_id);
        expect(doc.content_hash).toBe(set.provenance.content_hash);
        expect(doc.status).toBe('invalidated');
    });

    // ⛓ THE SAME MECHANISM THE SAVE STAMP USES. An unstamped companion could be
    // matched to any set, which is the failure the content hash exists to close:
    // an EDITED set reusing its id is the normal development case.
    it('refuses to describe an UNSTAMPED set', () => {
        expect(() => apMappingInvalidation({ set_id: 'x' }))
            .toThrow(/needs a STAMPED set/);
    });

    it('is invalidated by an edit to the set it describes', () => {
        const { set } = buildLevelSet([record()], { setId: 'procgen-test' });
        const doc = apMappingInvalidation(set);
        const edited = structuredClone(set);
        edited.rooms[0].music = 7;
        expect(doc.content_hash).not.toBe(computeLevelSetContentHash(edited));
    });
});

// ⛓ THE STRONGEST CLAIM AVAILABLE WITHOUT A BROWSER: every stage the arc
// already built, in order, over a set this exporter produced. The wasm leg is
// the round-trip gate; this is the part that can run in CI.
describe('the export survives the whole delivery pipeline', () => {
    it('validates, chunks, reassembles to an identical set, and stamps a save', () => {
        const rooms = Array.from({ length: 20 }, (_, i) => record({
            entities: [{ type: 'torchpickup', x: 16 * (i % 9), y: 32, attrs: { tag: String(i % 30) } }],
        }));
        const { set } = buildLevelSet(rooms, { setId: 'procgen-pipeline' });
        expect(validateLevelSet(set).errors).toEqual([]);

        const { chunks, oversized } = planLevelSetChunks(set);
        expect(oversized).toEqual([]);
        expect(chunks.length).toBeGreaterThan(1);          // 20 rooms > MAX_ROOMS_PER_CHUNK

        const back = assembleLevelSetChunks(chunks);
        expect(back.errors).toEqual([]);
        expect(back.set).toEqual(set);

        // The save stamp keys on both fields, so a re-export with one room
        // changed must not match a save written against the original.
        expect(saveStampMatches(levelSetSaveStamp(set), set)).toBe(true);
        const rebuilt = buildLevelSet(rooms.map((r, i) => (i === 3
            ? record({ entities: [{ type: 'torchpickup', x: 999, y: 32, attrs: { tag: '3' } }] })
            : r)), { setId: 'procgen-pipeline' }).set;
        expect(saveStampMatches(levelSetSaveStamp(set), rebuilt)).toBe(false);
    });

    // ⚠ THE CHUNK BOUND IS BYTES AS WELL AS ROOMS, and a generated room is small
    // enough that only the room bound can bind — asserted so a future room that
    // is not stays visible rather than silently producing a chunk the runtime
    // aborts on (§9.1: vanilla's worst 16-room window is larger than the chunk
    // that already died).
    it('bounds a delivery on rooms here, and reports it rather than assuming', () => {
        const { set } = buildLevelSet(Array.from({ length: 17 }, () => record()));
        const { chunks } = planLevelSetChunks(set);
        expect(chunks.map((c) => c.rooms.length)).toEqual([16, 1]);
        expect(Math.max(...chunks.map((c) => JSON.stringify(c).length))).toBeLessThan(239967);
    });
});
