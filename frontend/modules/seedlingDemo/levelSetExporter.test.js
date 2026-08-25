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
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { emptyLevel, withTerrain } from './procgenLevel.js';
import { recordToOel, parseOelLevel } from './procgenLevelOel.js';
import { stableStringify } from '../procgenCore/contentIdentity.js';
import { canonicalJson } from '../procgenCore/editCore.js';
import { readBundle } from '../presets/documentBundle.js';
import { loadJSZipNode } from '../../../scripts/procgen/loadJSZipNode.mjs';

import {
    buildLevelSet,
    apMappingInvalidation,
    reachabilityOf,
    VANILLA_AP_REFERENCE_COUNT,
    DEFAULT_MUSIC,
    LevelSetExportError,
    vanillaRecordSet,
    VANILLA_RECORD_SET_ID_BASE,
} from './levelSetExporter.js';
import {
    validateLevelSet,
    planLevelSetChunks,
    assembleLevelSetChunks,
    saveStampMatches,
    levelSetSaveStamp,
    computeLevelSetContentHash,
    NAMED_ROOM_KEYS,
    MAX_CHUNK_BYTES,
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

/** The committed documents E1's rows read — both already in the browser graph. */
const fixture = (name) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8',
));

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
        /**
         * ⛓⛓⛓ **EDITOR v3 E1b — THE DELIVERY ROUND TRIP IS AN IDENTITY ON
         * CONTENT AND A ONE-WAY RENDER ON FORM.** A set carries `record` rooms;
         * `planLevelSetChunks` renders each one to `{xml}` because the receiver
         * ends at `LevelSet.as:139`. So the reassembled set is the same document
         * carried in the delivery's own form — ⛔ and asserting `toEqual(set)`
         * here would be asserting that the render never happened, which is the
         * mutant this row is meant to catch rather than to hide.
         */
        expect(back.set.rooms.every((r) => typeof r.source.xml === 'string')).toBe(true);
        expect(back.set.rooms.some((r) => 'record' in r.source)).toBe(false);
        expect(back.set).toEqual({
            ...set,
            rooms: set.rooms.map((r) => ({ ...r, source: { xml: recordToOel(r.source.record) } })),
        });
        // …and the CONTENT survives it, room for room.
        back.set.rooms.forEach((r, i) => {
            expect(parseOelLevel(r.source.xml, `room ${i}`)).toEqual(set.rooms[i].source.record);
        });

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

// ── PHASE 5b: the `link` option, which is the wiring rather than the rule ─────
//
// The rule itself lives in `levelSetExits.test.js`. What is asserted here is
// that the exporter puts it in the right place — BEFORE the record becomes OEL —
// and that the doors it produces travel in the REPORT rather than in the frozen
// set document.
describe('buildLevelSet({link}) — exits as data', () => {
    const walled = (level) => emptyLevel({ level });

    it('turns a disconnected export into a connected one, and it is opt-in', () => {
        const rooms = [walled(0), walled(1), walled(2), walled(3)];
        expect(reachabilityOf(buildLevelSet(rooms, { setId: 'a' }).set).reachable).toBe(1);
        const linked = buildLevelSet(rooms, { setId: 'a', link: true });
        expect(reachabilityOf(linked.set).reachable).toBe(4);
        expect(validateLevelSet(linked.set).errors).toEqual([]);
    });

    it('reports the doors, and does NOT put them in the set document', () => {
        const { set, report } = buildLevelSet([walled(0), walled(1)], { link: { topology: 'chain' } });
        expect(report.link.links).toBe(1);
        expect(report.doors).toHaveLength(2);
        expect(report.doors[0]).toHaveProperty('approach');
        expect(JSON.stringify(set)).not.toMatch(/approach/);
    });

    it('floods each room from ITS OWN generator start cell, not from a fixed one', () => {
        // A room whose only walkable pocket is around (8, 8): flooding from the
        // default (1, 1) would refuse it, so the entry's summary must be read.
        const offset = withTerrain(emptyLevel({ level: 0 }),
            Array.from({ length: 8 }, (_, i) => ({ tx: i + 1, ty: 7, terrain: 'wall' }))
                .concat(Array.from({ length: 6 }, (_, i) => ({ tx: 7, ty: i + 1, terrain: 'wall' }))));
        const entries = [
            { record: offset, summary: { startCell: { tx: 8, ty: 8 } } },
            { record: emptyLevel({ level: 1 }), summary: { startCell: { tx: 1, ty: 1 } } },
        ];
        const { report } = buildLevelSet(entries, { link: true });
        expect(report.link.components[0].walkable).toBeLessThan(64);
        expect(report.doors.filter((d) => d.room === 0)).toHaveLength(1);
    });

    it('carries the link report into the export report only when linking happened', () => {
        expect(buildLevelSet([record(), record()], { setId: 'x' }).report.link).toBeUndefined();
    });
});

// ── EDITOR v3 E1/E1b — `vanillaRecordSet`, THE VANILLA 116 AS `record` ──────
//
// ⛓ THE ORACLE IS AGAIN SOMEBODY ELSE'S. The VALUE round trip
// (`record → recordToOel → parseOelLevel → record′`, 116/116) is
// `procgenLevelOel.test.js:59`'s row and is NOT repeated here; what these rows
// own is the JOIN — WHICH record fed WHICH room — plus the manifest carry, the
// empty `invented`, and the id that must never be mistaken for the embed set's.
describe('vanillaRecordSet — the manifest and the map extract in, a record-sourced set out', () => {
    const embedSet = fixture('seedling-vanilla-set.json');
    const mapDoc = JSON.parse(readFileSync(fileURLToPath(
        new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8'));

    /** The record whose `path` names the file a room embeds — the join, spelled out. */
    const recordFor = (embed) => {
        const root = `${mapDoc.source.level_root}/`;
        const hits = mapDoc.levels.filter((r) => r.path.slice(root.length) === embed
            || embed.endsWith(`/${r.path.slice(root.length)}`));
        expect(hits, `no unique map record for ${embed}`).toHaveLength(1);
        return hits[0];
    };

    it('turns all 116 embed rooms into record rooms the validator accepts with NO embed warning', () => {
        const { set } = vanillaRecordSet(embedSet, mapDoc);
        expect(set.rooms).toHaveLength(116);
        // ⛓ EDITOR v3 E1b — `record`, and NOT a rendered `xml` anywhere in the
        //   SET document. The render happens at the chunk boundary, below.
        expect(set.rooms.every((r) => typeof r.source.record === 'object')).toBe(true);
        expect(set.rooms.some((r) => 'embed' in r.source || 'xml' in r.source)).toBe(false);
        const v = validateLevelSet(set);
        expect(v.errors).toEqual([]);
        expect(v.ok).toBe(true);
        // ⛔ THE POINT OF THE WHOLE ARM, AS A MEASUREMENT. The EMBED set warns
        // that it could not check ONE THING about any of its 116 rooms; the xml
        // set carries no such warning because every room is now readable.
        expect(validateLevelSet(embedSet).warnings.filter((w) => /embed source/.test(w)))
            .toHaveLength(1);
        expect(v.warnings.filter((w) => /embed/.test(w))).toEqual([]);
    });

    it('carries every manifest field and every room field but `source` VERBATIM', () => {
        const { set, report } = vanillaRecordSet(embedSet, mapDoc);
        for (const field of ['name', 'description', 'start', 'menu_rooms', 'named_rooms']) {
            expect(stableStringify(set[field]), field).toBe(stableStringify(embedSet[field]));
        }
        const noSource = (r) => { const { source, ...rest } = r; return rest; };
        expect(stableStringify(set.rooms.map(noSource)))
            .toBe(stableStringify(embedSet.rooms.map(noSource)));
        // ⛓ AN EMPTY `invented` IS THE PROOF NO FIELD WAS GUESSED — the same
        // list `buildLevelSet` writes for a generated set, where it is never
        // empty. `vanillaRecordSet` REFUSES rather than emitting a non-empty one,
        // so this row is the statement and the function is the guard.
        expect(report.invented).toEqual([]);
        expect(set.provenance.invented).toEqual([]);
    });

    /**
     * ⛔⛔ **THE ID IS PINNED AS A MEASURED LITERAL, AND THAT IS THE POINT.**
     * `seedling-vanilla-xml-02a70624` is the FNV-1a-32 of the whole document
     * (`contentIdentity.js`'s contract) over the 116 rooms as
     * `recordToOel(record)` writes them, measured 2026-08-25 at
     * `989d385ab` from `extract-seedling-map.mjs`'s committed extract.
     * A change to `recordToOel`'s output, or a re-extract of the map, MOVES it —
     * and moving it BY NAME here is the whole reason a derived document gets a
     * pinned id instead of a comment saying it is derived.
     */
    it('stamps its own id, which can never be mistaken for the embed set\'s', () => {
        const { set } = vanillaRecordSet(embedSet, mapDoc);
        /**
         * ⛓⛓⛓ **EDITOR v3 E1b — THE ID MOVED, AND PLAN §23.12 ITEM 6 SAID IT
         * WOULD.** E1 pinned `seedling-vanilla-xml-02a70624`, the hash of the
         * OEL-bearing document; ⚖ §22.8 made the room a `{record}`, so this is
         * a different document and takes a different hash under a different
         * base. ⛔ THE RETIRED ID IS NAMED HERE so a reader meeting it in an
         * old note knows which document it was about.
         */
        expect(VANILLA_RECORD_SET_ID_BASE).toBe('seedling-vanilla-record');
        expect(set.set_id).toBe('seedling-vanilla-record-1040ace1');
        expect(set.set_id).toMatch(/^seedling-vanilla-record-[0-9a-f]{8}$/);
        expect(set.set_id).not.toBe('seedling-vanilla-xml-02a70624');
        expect(set.set_id).not.toBe(embedSet.set_id);
        expect(computeLevelSetContentHash(set)).toBe(set.provenance.content_hash);
        // `derived_from` names the set it reproduces, by ITS identity.
        expect(set.provenance.derived_from).toEqual({
            set_id: embedSet.set_id, content_hash: embedSet.provenance.content_hash,
        });
        expect(set.provenance.map.generator).toBe(mapDoc.generator);
    });

    it('joins by PATH: every room\'s record IS the map record whose path it embeds', () => {
        const { set, report } = vanillaRecordSet(embedSet, mapDoc);
        set.rooms.forEach((room, i) => {
            const mapRecord = recordFor(embedSet.rooms[i].source.embed);
            // ⛓ THE CORE FOUR, and NOT `level`/`class`/`path`/
            //   `tiles_outside_level` — each of those is a second authority for
            //   something the SET already says. 51 of the 116 carry the last one.
            expect(room.source.record, `rooms[${i}] "${room.name}"`).toEqual({
                width: mapRecord.width, height: mapRecord.height,
                layers: mapRecord.layers, entities: mapRecord.entities,
            });
            for (const dropped of ['level', 'class', 'path', 'tiles_outside_level']) {
                expect(Object.hasOwn(room.source.record, dropped), dropped).toBe(false);
            }
        });
        expect(mapDoc.levels.filter((l) => l.tiles_outside_level !== undefined)).toHaveLength(51);
        // The MEASURED difference between the two documents' roots — one leading
        // directory — reported rather than typed into the rule.
        expect(report.join).toMatchObject({
            rooms: 116,
            level_root: 'assets/levels',
            embed_prefix: 'levels/',
            matched_exact: 0,
            matched_by_suffix: 116,
        });
    });

    /**
     * ⛔ **THE MUTANT FOR "JOIN BY INDEX", AND IT NEEDED A PERMUTED MAP TO BITE.**
     * Measured: `levels[i].level === i` and `rooms[i].id === i` for all 116, so
     * an index join agrees with a path join on today's corpus and no row over
     * the committed documents alone could tell them apart. Reversing the map's
     * `levels` leaves a PATH join's answer byte-identical and sends an INDEX
     * join's to a different set entirely.
     */
    it('is unmoved by the ORDER of the map\'s levels', () => {
        const straight = vanillaRecordSet(embedSet, mapDoc).set;
        const reversed = vanillaRecordSet(embedSet,
            { ...mapDoc, levels: [...mapDoc.levels].reverse() }).set;
        expect(stableStringify(reversed)).toBe(stableStringify(straight));
        expect(reversed.set_id).toBe(straight.set_id);
    });

    it('is deterministic — two calls produce the same document', () => {
        expect(stableStringify(vanillaRecordSet(embedSet, mapDoc).set))
            .toBe(stableStringify(vanillaRecordSet(embedSet, mapDoc).set));
    });

    it('REFUSES a renamed path by name rather than joining to the neighbour', () => {
        const renamed = {
            ...mapDoc,
            levels: mapDoc.levels.map((r, i) => (i === 3
                ? { ...r, path: r.path.replace(/\.oel$/, '.renamed.oel') } : r)),
        };
        expect(() => vanillaRecordSet(embedSet, renamed)).toThrow(LevelSetExportError);
        expect(() => vanillaRecordSet(embedSet, renamed))
            .toThrow(/rooms\[3\] "Dungeon1_1" embeds "levels\/Dungeon1\/1\.oel" and NO map record/);
    });

    it('REFUSES two rooms that would claim one record, and a room with no embed', () => {
        const twice = {
            ...embedSet,
            rooms: [embedSet.rooms[0], { ...embedSet.rooms[1], source: { ...embedSet.rooms[0].source } }],
        };
        expect(() => vanillaRecordSet(twice, mapDoc)).toThrow(/both join to map levels\[0\]/);
        const already = { ...embedSet, rooms: [{ ...embedSet.rooms[0], source: { xml: '<level/>' } }] };
        expect(() => vanillaRecordSet(already, mapDoc)).toThrow(/is not embed-sourced/);
    });

    it('REFUSES a map document with no `source.level_root` rather than guessing one', () => {
        expect(() => vanillaRecordSet(embedSet, { ...mapDoc, source: {} }))
            .toThrow(/needs the map document's `source.level_root`/);
    });

    /**
     * The MANIFEST-DEFAULT mutant, on a two-room stand-in: `buildLevelSet`
     * DERIVES `start` from `entries[0].summary.startCell` (and falls back to
     * `{level: 0}`) when the caller supplies none, so a `vanillaRecordSet` that
     * forgot to pass the embed set's would emit a set that starts in the wrong
     * room and lists `start` as invented. Both halves are asserted.
     */
    it('carries a manifest `start` that is NOT the one buildLevelSet would derive', () => {
        const rec = (path) => ({ ...record(), path, level: 0 });
        const smallMap = {
            generator: 'test', source: { level_root: 'assets/levels' },
            levels: [{ ...rec('assets/levels/A.oel'), level: 0 }, { ...rec('assets/levels/B.oel'), level: 1 }],
        };
        const smallSet = {
            schema_version: 1,
            set_id: 'stand-in-deadbeef',
            name: 'stand-in',
            provenance: { content_hash: 'deadbeef' },
            rooms: [
                { id: 0, name: 'a', source: { embed: 'levels/A.oel' }, music: 3 },
                { id: 1, name: 'b', source: { embed: 'levels/B.oel' }, music: 4, snow_gradient: true },
            ],
            start: { level: 1, x: 32, y: 48 },
            menu_rooms: [1],
            named_rooms: {},
        };
        const { set, report } = vanillaRecordSet(smallSet, smallMap);
        expect(set.start).toEqual({ level: 1, x: 32, y: 48 });
        expect(set.menu_rooms).toEqual([1]);
        expect(set.rooms[1].snow_gradient).toBe(true);
        expect(set.rooms.map((r) => r.music)).toEqual([3, 4]);
        expect(report.invented).toEqual([]);
        // What `buildLevelSet` WOULD have chosen with nothing supplied — the
        // mutant's answer, measured beside the real one so the row cannot pass
        // by both being the same.
        const bare = buildLevelSet(smallMap.levels.map((r) => ({ record: r })), { setId: 'x' });
        expect(bare.set.start).toEqual({ level: 0 });
        expect(bare.set.menu_rooms).toEqual([0]);
        expect(bare.report.invented).toContain('start');
    });
});

/**
 * ── THE CLI'S `--vanilla` ARM, DRIVEN ────────────────────────────────────────
 *
 * ⛓ THE ROWS LIVE BESIDE THE FUNCTION, because the arm owns no format logic:
 * it reads two committed files, calls `vanillaRecordSet` and prints. What is worth
 * gating is that STDOUT is still the DETERMINISM CHANNEL (the script's own law),
 * that the id it prints is the one this module's function produces — the SAME
 * function on both sides, which is what makes the page's row a comparison and
 * not a second implementation — and that the two arms REFUSE to be mixed.
 */
describe('export-seedling-level-set --vanilla', () => {
    const SCRIPT = fileURLToPath(
        new URL('../../../scripts/procgen/export-seedling-level-set.mjs', import.meta.url));
    const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

    it('prints a byte-identical STDOUT twice, carrying the id the function stamps', () => {
        const a = run('--vanilla');
        const b = run('--vanilla');
        expect(a.status).toBe(0);
        expect(a.stdout).toBe(b.stdout);
        const { set } = vanillaRecordSet(
            fixture('seedling-vanilla-set.json'),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')),
        );
        expect(a.stdout).toContain(`set_id:       ${set.set_id}`);
        expect(a.stdout).toContain(`derived_from: ${set.provenance.derived_from.set_id}`);
        // The §6.1 companion is `invalidated` for this set too — per IDENTITY,
        // deliberately (plan §22.2 decision 5) — and the note that says the
        // rooms are nevertheless the vanilla ones is printed under it.
        expect(a.stdout).toMatch(/§6\.1 — the vanilla AP mapping under this set: invalidated/);
        expect(a.stdout).toMatch(/reproduces the vanilla rooms BY VALUE/);
    }, 30000);

    it('REFUSES every generation flag by name, and still refuses `fixtures/`', () => {
        const clash = run('--vanilla', '--seeds=1-4');
        expect(clash.status).toBe(2);
        expect(clash.stderr).toMatch(/--vanilla takes no generation flag, and --seeds is one/);
        expect(clash.stdout).toBe('');
        const biome = run('--vanilla', '--biome=post-sword', '--exits=ring');
        expect(biome.status).toBe(2);
        expect(biome.stderr).toMatch(/--biome, --exits are one/);
        const fixtures = run('--vanilla', '--out-dir=/tmp/nope/fixtures/out');
        expect(fixtures.status).toBe(2);
        expect(fixtures.stderr).toMatch(/REFUSED to write under `fixtures\/`/);
    }, 30000);

    /**
     * ⛓⛓⛓ **EDITOR v3 E1b — WHERE OEL LIVES ON DISK NOW.** The `.json` is the
     * SET (records, no text); the `.chunks.json` is the DELIVERY (text, no
     * records). ⛔ A set file carrying an `xml` room, or a chunk file carrying a
     * `record` room, is a step one of the two did not take — and the row asks
     * the FILES rather than the functions, because the CLI is the seam a person
     * actually reads.
     */
    it('writes a set with ZERO xml rooms and chunks with ZERO record rooms', () => {
        const dir = mkdtempSync(join(tmpdir(), 'e1b-vanilla-'));
        try {
            const r = run('--vanilla', `--out-dir=${dir}`);
            expect(r.status).toBe(0);
            const id = 'seedling-vanilla-record-1040ace1';
            expect(r.stdout).toContain(`${dir}/${id}.{json,ap-invalidation.json,chunks.json}`);
            const set = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
            const chunks = JSON.parse(readFileSync(join(dir, `${id}.chunks.json`), 'utf8'));
            expect(set.rooms).toHaveLength(116);
            expect(set.rooms.filter((x) => 'xml' in x.source)).toHaveLength(0);
            expect(set.rooms.filter((x) => 'record' in x.source)).toHaveLength(116);
            const chunkRooms = chunks.flatMap((c) => c.rooms);
            expect(chunkRooms).toHaveLength(116);
            expect(chunkRooms.filter((x) => 'record' in x.source)).toHaveLength(0);
            expect(chunkRooms.filter((x) => typeof x.source.xml === 'string')).toHaveLength(116);
            // …and the text on disk is exactly what the one writer produces.
            chunkRooms.forEach((room, i) => {
                expect(room.source.xml, `room ${i}`).toBe(recordToOel(set.rooms[i].source.record));
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 60000);

    /**
     * ⛓⛓⛓ **EDITOR v3 E1c — `--bundle` AND `--minify`** (plan §25).
     *
     * ⛔ The bundle is written BESIDE the plain files, never instead of them,
     * and the `.chunks.json` stays a plain file — DELIVERY is not a member
     * (§24.12). ⛔ STDOUT is unchanged by either flag: it is the determinism
     * channel, and a report that grew a line when a file was written would make
     * `cmp` a proof about the flags rather than about the generator.
     */
    it('--bundle writes a DETERMINISTIC zip beside the plain files, chunks excluded', async () => {
        const a = mkdtempSync(join(tmpdir(), 'e1c-bundle-a-'));
        const b = mkdtempSync(join(tmpdir(), 'e1c-bundle-b-'));
        try {
            const plain = run('--vanilla', `--out-dir=${a}`);
            expect(plain.status).toBe(0);
            rmSync(a, { recursive: true, force: true });
            const one = run('--vanilla', `--out-dir=${a}`, '--bundle');
            const two = run('--vanilla', `--out-dir=${b}`, '--bundle');
            expect(one.status).toBe(0);
            expect(two.status).toBe(0);
            const id = 'seedling-vanilla-record-1040ace1';
            // STDOUT names the same three files with or without --bundle.
            expect(one.stdout).toBe(plain.stdout.split(a).join(a));
            expect(readdirSync(a).sort()).toEqual([
                `${id}.ap-invalidation.json`, `${id}.chunks.json`, `${id}.json`, `${id}.zip`,
            ]);
            const bytesA = readFileSync(join(a, `${id}.zip`));
            const bytesB = readFileSync(join(b, `${id}.zip`));
            expect(bytesB.equals(bytesA)).toBe(true);
            const { members, notes } = await readBundle(bytesA, { jszip: loadJSZipNode() });
            expect(members.map((m) => m.kind)).toEqual(['level-set']);
            expect(canonicalJson(members[0].doc))
                .toBe(canonicalJson(JSON.parse(readFileSync(join(a, `${id}.json`), 'utf8'))));
            // The companion travels as a NAMED extra, not as a member.
            expect(notes.join(' ')).toContain(`${id}.ap-invalidation.json`);
            // ⛔ And DELIVERY never got in.
            expect(notes.join(' ')).not.toContain('.chunks.json');
        } finally {
            rmSync(a, { recursive: true, force: true });
            rmSync(b, { recursive: true, force: true });
        }
    }, 90000);

    it('--minify shrinks what is written and leaves STDOUT alone', () => {
        const dir = mkdtempSync(join(tmpdir(), 'e1c-minify-'));
        try {
            const id = 'seedling-vanilla-record-1040ace1';
            const plain = run('--vanilla', `--out-dir=${dir}`);
            expect(plain.status).toBe(0);
            const big = statSync(join(dir, `${id}.json`)).size;
            const bigDoc = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
            rmSync(dir, { recursive: true, force: true });
            const small = run('--vanilla', `--out-dir=${dir}`, '--minify');
            expect(small.status).toBe(0);
            expect(small.stdout).toBe(plain.stdout);
            const text = readFileSync(join(dir, `${id}.json`), 'utf8');
            expect(text.trimEnd()).not.toContain('\n');
            expect(statSync(join(dir, `${id}.json`)).size).toBeLessThan(big / 2);
            expect(canonicalJson(JSON.parse(text))).toBe(canonicalJson(bigDoc));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 90000);

    it('REFUSES --bundle / --minify with no --out-dir, because neither touches STDOUT', () => {
        for (const flag of ['--bundle', '--minify']) {
            const r = run('--vanilla', flag);
            expect(r.status).toBe(2);
            expect(r.stderr).toMatch(/only describe what is WRITTEN/);
            expect(r.stdout).toBe('');
        }
    }, 60000);
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ **EDITOR v3 E1b — THE BOUNDARY, AND THE BYTES IT IS MEASURED ON**
 * ══════════════════════════════════════════════════════════════════════ */

describe('OEL is rendered at the chunk boundary, and the bound is measured there', () => {
    const VANILLA_SET = () => vanillaRecordSet(
        fixture('seedling-vanilla-set.json'),
        JSON.parse(readFileSync(fileURLToPath(
            new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')),
    ).set;

    it('a RECORD set and its xml-rendered twin produce IDENTICAL chunk documents', () => {
        const rec = VANILLA_SET();
        const twin = {
            ...rec,
            rooms: rec.rooms.map((r) => ({ ...r, source: { xml: recordToOel(r.source.record) } })),
        };
        expect(stableStringify(planLevelSetChunks(rec).chunks))
            .toBe(stableStringify(planLevelSetChunks(twin).chunks));
    });

    /**
     * ⛔⛔ **THE PLAN IS THE SAME PLAN E1 MEASURED, TO WITHIN THE ID'S OWN
     * LENGTH.** E1 recorded 9 chunks with a largest of 237,194 B over
     * `seedling-vanilla-xml-02a70624` (29 characters). This set's id is
     * `seedling-vanilla-record-1040ace1` (32), and a `set_id` appears once per
     * chunk — so the largest chunk is 237,197 B, EXACTLY 3 bytes more, and the
     * chunk COUNT is unchanged. ⛓ A different count would have meant the render
     * moved bytes, and the number is here so nobody has to wonder.
     */
    // ⛓ THE NAME CARRIES NO COUNT ON PURPOSE — every number below is DERIVED
    //   or pinned with its provenance in the docblock, and `lint-gate-labels`
    //   reds a name that states a cardinality its own body computes.
    it('plans the vanilla set to the SAME chunks E1 measured, plus the set_id\'s own bytes', () => {
        const { chunks, oversized } = planLevelSetChunks(VANILLA_SET());
        expect(chunks).toHaveLength(9);
        expect(oversized).toEqual([]);
        const largest = Math.max(...chunks.map((c) => JSON.stringify(c).length));
        expect(largest).toBe(237197);
        expect(largest).toBe(237194 + ('seedling-vanilla-record-1040ace1'.length
            - 'seedling-vanilla-xml-02a70624'.length));
        expect(largest).toBeLessThan(MAX_CHUNK_BYTES);
    });

    /**
     * ⛔⛔ **THE ORDER IS THE CLAIM: SIZE AFTER THE RENDER, NEVER BEFORE.**
     * Sizing the record would price a document 3.1× smaller than the one
     * delivered — and it plans to EIGHT chunks, one of which the proven
     * envelope was never measured for. This row is the mutant's own answer,
     * measured beside the real one so it cannot pass by both being the same.
     */
    it('sizing the RECORD instead of the render gives a DIFFERENT, wrong plan', () => {
        const set = VANILLA_SET();
        const unrendered = planLevelSetChunks(set, { render: () => '' });
        expect(unrendered.chunks.length).toBe(8);
        const recordBytes = JSON.stringify(set).length;
        const renderedBytes = JSON.stringify({
            ...set,
            rooms: set.rooms.map((r) => ({ ...r, source: { xml: recordToOel(r.source.record) } })),
        }).length;
        expect(recordBytes).toBe(528752);
        expect(renderedBytes).toBe(1652312);
        expect(renderedBytes / recordBytes).toBeGreaterThan(3);
    });

    it('the LEGACY conformance corpus plans exactly as it did — nothing rendered', () => {
        const conformance = fixture('seedling-level-set-delivery-conformance.json');
        for (const [ci, c] of conformance.cases.entries()) {
            for (const [chi, chunk] of (c.chunks ?? []).entries()) {
                const rooms = chunk.rooms ?? [];
                if (rooms.length === 0 || rooms.some((r) => typeof r.source?.xml !== 'string')) continue;
                const set = {
                    schema_version: 1, set_id: chunk.set_id, rooms, start: { level: 0 },
                    menu_rooms: [0], named_rooms: {},
                };
                const plan = planLevelSetChunks(set);
                // ⛓ EVERY room passes through byte for byte — no record, no render.
                expect(plan.chunks.flatMap((x) => x.rooms), `case ${ci} chunk ${chi}`)
                    .toEqual(rooms);
            }
        }
    });
});

/**
 * ── THE CROSS-CHECK: THE SAME DERIVATION, A DIFFERENT INPUT ──────────────────
 *
 * §11.8(a) proved `record → recordToOel → parseOelLevel → record′` by VALUE,
 * 116/116, and §11.8(b) proved the map extract equals the disk `.oel` by value
 * as well. This row is what makes that agreement CARRY: the playthrough
 * generator derives its atlas from the map RECORDS, the set editor derives one
 * from a set's PARSED XML, and if the two derivations disagree then the value
 * round trip was preserving something the atlas does not read.
 *
 * ⛓ ONE VARIABLE. `derivePlaythroughLayer(rooms)` is the generator's own call —
 * same overlay (`R7_GOAL_LEDGER`, `locationGuard`, `NEVER_ENTER_LEVELS`), same
 * deps, same `deriveAtlas` — with the ROOMS passed in. Nothing here re-derives
 * anything, which is the difference between a cross-check and a second opinion.
 *
 * ⛔ WHAT THIS COMPARES IS THE **DERIVED LAYER** AND NOTHING ELSE, and the
 * layers it does NOT compare are named and MEASURED below rather than dissolved
 * by a looser comparison: the analyzer's sub-regions and internal exits, the
 * `sub_region`/`access_rule` fields it and the hand rulings write onto exits and
 * locations, and the atlas's own stamp. Those are the VANILLA OVERLAY (plan
 * §22.1 #4) — CODE in `make-seedling-playthrough-rules.mjs`, not a D1 overlay
 * document — and a set editor opening vanilla has none of them.
 */
describe('the vanilla xml set derives the SAME atlas as the map extract', () => {
    /** The three fact-sets `deriveAtlas` owns: regions, boundary exits, connections. */
    const derivedFacts = (atlas) => ({
        regions: atlas.regions.map((r) => ({
            region_id: r.region_id, map_ref: r.map_ref, bounds: r.bounds,
        })),
        exits: atlas.regions.map((r) => [r.region_id, (r.exits ?? []).map((e) => e.exit_id).sort()]),
        connections: (atlas.vanilla_layout?.connections ?? [])
            .map((c) => ({ from: c.from, to: c.to, one_way: c.one_way })),
    });

    const roomsOfXmlSet = (set) => set.rooms.map((r, level) => ({
        // ⛓ THE ADAPTATION IS ONE FIELD, AND `seedlingAtlasDerivation.js`'s own
        // header says so: a parsed room is a map record minus `level`/`class`/
        // `path`, and the SET is what supplies the numbering.
        ...r.source.record, level,
    }));

    it('reproduces the regions, the boundary exits and the connections, 1:1', async () => {
        const { derivePlaythroughLayer } = await import(
            '../../../scripts/procgen/make-seedling-playthrough-rules.mjs');
        const { set } = vanillaRecordSet(fixture('seedling-vanilla-set.json'),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')));

        const fromMap = derivePlaythroughLayer();
        const fromXml = derivePlaythroughLayer(roomsOfXmlSet(set));

        // The counts, pinned — a comparison of two empty things is also equal.
        expect(fromMap.atlas.regions).toHaveLength(113);
        expect(fromMap.atlas.regions.flatMap((r) => r.exits ?? [])).toHaveLength(624);
        expect(fromMap.atlas.vanilla_layout.connections).toHaveLength(312);
        expect(fromMap.dropped).toHaveLength(3);

        expect(stableStringify(derivedFacts(fromXml.atlas)))
            .toBe(stableStringify(derivedFacts(fromMap.atlas)));
        // ⛓ AND IT IS STRONGER THAN THE ROW ASKS FOR, MEASURED: the whole
        // derived document agrees, locations and all — so the three fact-sets
        // are what this row CLAIMS, not the most it could prove.
        expect(stableStringify(fromXml.atlas)).toBe(stableStringify(fromMap.atlas));
        expect(stableStringify(fromXml.dropped)).toBe(stableStringify(fromMap.dropped));

        // …and against the COMMITTED atlas, which is the artifact anybody else
        // reads. Its extra layers are asserted PRESENT, so the exclusion below
        // is a measurement rather than a looser comparison.
        const committed = JSON.parse(readFileSync(fileURLToPath(
            new URL('../flashPanel/atlases/seedling-playthrough.json', import.meta.url)), 'utf8'));
        expect(stableStringify(derivedFacts(fromXml.atlas)))
            .toBe(stableStringify(derivedFacts(committed)));
        expect(committed.regions.filter((r) => r.subgraph)).toHaveLength(52);
        expect(committed.regions.flatMap((r) => r.subgraph?.internal_exits ?? [])).toHaveLength(285);
        expect(fromXml.atlas.regions.filter((r) => r.subgraph)).toHaveLength(0);
        const exitKeys = new Set(committed.regions.flatMap((r) => (r.exits ?? [])
            .flatMap((e) => Object.keys(e))));
        expect([...exitKeys].sort()).toEqual(
            ['access_rule', 'entrance_tile', 'exit_id', 'exit_tiles', 'kind', 'sub_region']);
        const derivedExitKeys = new Set(fromXml.atlas.regions.flatMap((r) => (r.exits ?? [])
            .flatMap((e) => Object.keys(e))));
        expect([...derivedExitKeys].sort()).toEqual(
            ['entrance_tile', 'exit_id', 'exit_tiles', 'kind']);
        expect(committed.atlas_id).toBe('seedling-7dc27a95');
        expect(fromXml.atlas.atlas_id).toBe('seedling');   // D1 §20.6: DELIBERATELY unstamped
    }, 60000);

    /**
     * ⛔ THE MUTANT, AND IT GOES THROUGH THE DERIVATION RATHER THAN THE
     * COMPARISON. One link entity is removed from one room's parsed record, so
     * the xml side emits one connection fewer — which is exactly the shape a
     * lossy `recordToOel`/`parseOelLevel` pair would produce, and the row that
     * would otherwise pass by comparing two things nobody perturbed.
     */
    it('goes RED when one connection is dropped from the xml side', async () => {
        const { derivePlaythroughLayer } = await import(
            '../../../scripts/procgen/make-seedling-playthrough-rules.mjs');
        const { set } = vanillaRecordSet(fixture('seedling-vanilla-set.json'),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')));
        const rooms = roomsOfXmlSet(set);
        const linkIndex = rooms[0].entities.findIndex((e) => e.type === 'teleporter');
        expect(linkIndex).toBeGreaterThanOrEqual(0);
        const lamed = rooms.map((r, i) => (i !== 0 ? r
            : { ...r, entities: r.entities.filter((_, k) => k !== linkIndex) }));

        const straight = derivePlaythroughLayer(rooms);
        const dropped = derivePlaythroughLayer(lamed);
        expect(dropped.atlas.vanilla_layout.connections.length)
            .toBe(straight.atlas.vanilla_layout.connections.length - 1);
        expect(stableStringify(derivedFacts(dropped.atlas)))
            .not.toBe(stableStringify(derivedFacts(straight.atlas)));
    }, 60000);
});
