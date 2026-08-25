/**
 * mazeRoom/mazeAtlasDerivation — **THE COMMITTED DEMO PACK, THROUGH THE WHOLE
 * CHAIN, WITH NOTHING WRITTEN TO MAKE A ROW PASS.**
 *
 * EDITOR v3 slice E2a. The input is `frontend/region-libraries/demo-maze-pack.json`
 * — four entries somebody captured out of the real generator long before this
 * slice existed — and the chain is derive → `validateRegionAtlas` (with the
 * committed schema) → `compileRegionAtlas` with the MAZE flavour → the real
 * `deserializeMazeWorld` → `reachableRegions`. ⛔ Every document here is
 * committed or authored as an overlay; nothing is a fixture written for the
 * assertion it satisfies.
 *
 * ⚠ **§22.3's CROSS-CHECK CLAUSE, HONOURED BY NAMING WHAT IS NOT CHECKED.**
 * `frontend/atlas-pools/seedling-atlas-pool.json` is NOT reproduced and no row
 * pretends to: it is the output of compiling the SEEDLING atlas through the
 * maze projection, whose input is a real game map with a semantics table behind
 * it. A region library is interchangeable rooms with no wiring. Different input
 * contract, no byte gate to be had — [[feedback_fixture_must_discriminate_two_builds]]
 * cuts the other way here, and a fabricated one would measure nothing.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { loadAtlasSchema } from '../procgenCore/jsonSchemaFiles.js';
import { gateabilityOf } from '../procgenCore/setEditorCore.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { deserializeMazeWorld } from './mazeRoomEngine.js';
import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import {
    LINK_ONE_WAY_DEFAULT, MazeAtlasDerivationError, assertOverlay, deriveAtlas, deriveAtlasOf,
    emptyMazeOverlay, mazeGridFor, overlayErrors, renumberOverlay, rulesJsonOf,
} from './mazeAtlasDerivation.js';

const LIBRARY = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../region-libraries/demo-maze-pack.json', import.meta.url)), 'utf8',
));
const ENTRIES = LIBRARY.entries;
const ATLAS_SCHEMA = loadAtlasSchema();

/**
 * ⛓ AN AUTHORED FOUR-LINK OVERLAY — a ring through all four entries. The
 * library carries no wiring at all (`carried_rules: null`, every payload exit's
 * `targetRegion` null), so this is exactly the half §22.6 Q2 rules is authored.
 */
const RING = Object.freeze([
    { from: [0, 'exit_1'], to: [1, 'exit_3'] },
    { from: [1, 'exit_1'], to: [2, 'exit_3'] },
    { from: [2, 'exit_1'], to: [3, 'exit_3'] },
    { from: [3, 'exit_0'], to: [0, 'exit_2'] },
]);

const overlayOf = (links = RING, extra = {}) => ({ ...emptyMazeOverlay(), links, ...extra });
const recordOf = (overlay = overlayOf()) => ({ library: LIBRARY, overlay });
const sessionOf = (overlay = overlayOf()) => ({ record: () => recordOf(overlay), ops: () => [] });
const compile = (overlay = overlayOf()) => rulesJsonOf(sessionOf(overlay), {}, { compileRegionAtlas });
const check = (overlay) => overlayErrors(overlay, { roomCount: ENTRIES.length, entries: ENTRIES });

/* ══════════════════════════════════════════════════════════════════════
 * THE LIBRARY'S OWN CONTRACT — the premise every row below rests on
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the committed demo pack really does carry NO wiring', () => {
    it('⛔⛔ every payload exit\'s target is NULL and every `carried_rules` is null — which is '
        + 'why the links have to be authored somewhere else', () => {
        expect(ENTRIES.length).toBeGreaterThan(1);
        for (const entry of ENTRIES) {
            expect(entry.carried_rules, entry.entry_id).toBeNull();
            expect(entry.payload.exits.length, entry.entry_id).toBeGreaterThan(0);
            for (const exit of entry.payload.exits) {
                expect(exit.targetRegion, `${entry.entry_id}/${exit.exit_id}`).toBeNull();
                expect(exit.targetExitId, `${entry.entry_id}/${exit.exit_id}`).toBeNull();
                // ⛓ `exit_id === exitName` is load-bearing downstream.
                expect(exit.exitName, `${entry.entry_id}/${exit.exit_id}`).toBe(exit.exit_id);
            }
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE GRID
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ `gridFor` — the ONE thing the compiler calls the GAME\'s', () => {
    it('⛓ a payload\'s tiles ARE the grid: wall stays wall, everything else opens', () => {
        const grid = mazeGridFor(ENTRIES[0].payload);
        expect(grid.width).toBe(ENTRIES[0].payload.width);
        expect(grid.cells).toHaveLength(grid.width * grid.height);
        expect(grid.origin).toEqual({ x: 0, y: 0 });
        const kinds = new Set(grid.cells.map((c) => c.kind));
        expect(kinds).toEqual(new Set(['wall', 'open']));
        ENTRIES[0].payload.tiles.forEach((t, i) => {
            expect(grid.cells[i].kind, `tile ${i}`).toBe(t === TILE_WALL ? 'wall' : 'open');
        });
    });

    /**
     * ⛔⛔ MUTANT: the cell carries no `conditions`/`faces`/`dirs`/`manual`.
     * `regionAtlasAnalyzer` reads all four unconditionally, so the compile dies
     * with a `TypeError` rather than a sentence.
     */
    it('⛓ every cell carries the analyzer\'s four annotation lists, empty', () => {
        for (const cell of mazeGridFor(ENTRIES[0].payload).cells) {
            expect(cell.conditions).toEqual([]);
            expect(cell.faces).toEqual({});
            expect(cell.dirs).toEqual({});
            expect(cell.manual).toEqual([]);
        }
    });

    it('⛔ a payload whose tile count disagrees with its size refuses BY NAME', () => {
        expect(() => mazeGridFor({ width: 3, height: 3, tiles: [0, 0] }))
            .toThrow(/a 3x3 payload needs 9 tiles, got 2/);
        expect(() => mazeGridFor({ width: 0, height: 3, tiles: [] }))
            .toThrow(/integer width\/height/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE DERIVATION
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ the atlas is DERIVED from the entries plus the authored links', () => {
    const derived = deriveAtlasOf(recordOf());

    it('⛓ one region per entry: `region_id` is the ENTRY id, `map_ref` is the INDEX', () => {
        expect(derived.atlas.regions.map((r) => r.region_id))
            .toEqual(ENTRIES.map((e) => e.entry_id));
        expect(derived.atlas.regions.map((r) => r.map_ref))
            .toEqual(ENTRIES.map((_e, i) => i));
        expect(derived.stats).toMatchObject({ rooms: 4, regions: 4, connections: 4 });
    });

    /**
     * ⛓⛓⛓ MUTANT: `region_id` is `room_<i>`. A reorder would then rename every
     * AP region — the compiler allocates ids from those names — so a person who
     * moved a room in the strip would silently invalidate every seed made from
     * the library before the move. The INDEX is what moves; the entry id is not.
     */
    it('⛔⛔ the two ids answer different questions: the entry id survives a reorder and the '
        + 'map_ref does not', () => {
        const reordered = [ENTRIES[1], ENTRIES[0], ...ENTRIES.slice(2)];
        const after = deriveAtlas(reordered, overlayOf([]), {
            atlas: { mapDocument: LIBRARY.library_id },
        }).atlas;
        expect(after.regions.map((r) => r.region_id))
            .toEqual([ENTRIES[1].entry_id, ENTRIES[0].entry_id, ...ENTRIES.slice(2).map((e) => e.entry_id)]);
        expect(after.regions.map((r) => r.map_ref)).toEqual([0, 1, 2, 3]);
    });

    it('⛓ bounds come from the payload size, at origin 0,0', () => {
        for (const [i, region] of derived.atlas.regions.entries()) {
            expect(region.bounds, region.region_id)
                .toEqual({ x: 0, y: 0, w: ENTRIES[i].payload.width, h: ENTRIES[i].payload.height });
        }
    });

    /**
     * ⛔⛔ MUTANT: the exit's `kind` is the brief's `'crossing'`. The atlas
     * schema declares `kind` as the CLOSED enum edge|teleporter, so the
     * STRUCTURAL pass fails and the REPORT refuses every maze export — a whole
     * substrate turned off by a word.
     */
    it('⛔⛔ a boundary exit is an `edge` whose SIDE is derived, and the payload\'s own side is '
        + 'only a cross-check', () => {
        const region = derived.atlas.regions[0];
        expect(region.exits.map((e) => e.exit_id)).toEqual(ENTRIES[0].payload.exits.map((e) => e.exit_id));
        for (const [i, exit] of region.exits.entries()) {
            const source = ENTRIES[0].payload.exits[i];
            expect(exit.kind, exit.exit_id).toBe('edge');
            expect(exit.side, exit.exit_id).toBe(source.side);
            expect(exit.exit_tiles, exit.exit_id).toEqual([[source.x, source.y]]);
            expect(exit.entrance_tile, exit.exit_id).toEqual([source.x, source.y]);
        }
    });

    it('⛔ …and a payload whose `side` disagrees with its tile refuses BY NAME', () => {
        const stale = JSON.parse(JSON.stringify(ENTRIES.slice(0, 1)));
        stale[0].payload.exits[0].side = 'S';
        expect(() => deriveAtlas(stale, overlayOf([]), { atlas: { mapDocument: 'x' } }))
            .toThrow(/says side "S" but its tile \[2,0\] is on the "N" bounds line/);
    });

    it('⛓ a payload exit flagged `isTeleporter` becomes a TELEPORTER, which carries no side', () => {
        const warped = JSON.parse(JSON.stringify(ENTRIES.slice(0, 1)));
        warped[0].payload.exits[0].isTeleporter = true;
        const [region] = deriveAtlas(warped, overlayOf([]), { atlas: { mapDocument: 'x' } }).atlas.regions;
        expect(region.exits[0].kind).toBe('teleporter');
        expect(region.exits[0].side).toBeUndefined();
    });

    /**
     * ⛔⛔⛔ MUTANT: `one_way` defaults to TRUE (Seedling's default, copied
     * across). Every maze crossing would then be one-way, half the ring would
     * be unreachable, and `gateabilityOf` would call every arrival endpoint
     * ungateable — the exact opposite of what a walkable tile means.
     */
    it('⛔⛔⛔ a link is TWO-WAY by default — the OPPOSITE of Seedling\'s transport primitive', () => {
        expect(LINK_ONE_WAY_DEFAULT).toBe(false);
        for (const conn of derived.atlas.vanilla_layout.connections) {
            expect(conn.one_way, `${conn.from} -> ${conn.to}`).toBe(false);
        }
        // ⛓ and the consequence, read off the shared gateability answer:
        expect(gateabilityOf(derived.atlas, 'mz_hub', 'exit_3')).toEqual({ gates: true, why: null });
        const oneWay = deriveAtlasOf(recordOf(overlayOf([{ ...RING[0], one_way: true }, ...RING.slice(1)])));
        expect(gateabilityOf(oneWay.atlas, 'mz_hub', 'exit_3').gates).toBe(false);
        expect(gateabilityOf(oneWay.atlas, 'mz_hub', 'exit_3').why).toMatch(/ARRIVAL side/);
    });

    it('⛓ `start` is the overlay\'s room index, and its ABSENCE is a NOTE, not a silence', () => {
        const notes = [];
        deriveAtlas(ENTRIES, overlayOf([]), { note: (m) => notes.push(m), atlas: { mapDocument: 'x' } });
        expect(notes).toEqual(['the overlay names no `start`, so entry 0 is the start region']);
        expect(derived.atlas.vanilla_layout.start_region).toBe(ENTRIES[0].entry_id);
        const chosen = deriveAtlas(ENTRIES, overlayOf(RING, { start: 2 }), {
            atlas: { mapDocument: 'x' },
        });
        expect(chosen.atlas.vanilla_layout.start_region).toBe(ENTRIES[2].entry_id);
    });

    /**
     * ⛔⛔ MUTANT: the derivation emits a `subgraph` for every region. The
     * projection recomputes the components and THROWS *"declares sub_regions […]
     * but its tile map computes […]"* — a sentence about a stale atlas, on an
     * atlas built seconds earlier.
     */
    it('⛔⛔ NO region carries a `subgraph` — a maze room is one component and the projection '
        + 'recomputes them', () => {
        for (const region of derived.atlas.regions) {
            expect(region.subgraph, region.region_id).toBeUndefined();
        }
    });

    it('⛔⛔ …and a payload whose floor SPLITS is refused HERE, by name, rather than emitted', () => {
        const split = JSON.parse(JSON.stringify(ENTRIES.slice(0, 1)));
        const p = split[0].payload;
        // Wall off the entrance's whole row and column neighbourhood: a cheap
        // way to strand at least one floor tile from the entrance.
        for (let x = 0; x < p.width; x += 1) p.tiles[(p.entrance.y - 1) * p.width + x] = TILE_WALL;
        for (let x = 0; x < p.width; x += 1) p.tiles[(p.entrance.y + 1) * p.width + x] = TILE_WALL;
        for (let y = 0; y < p.height; y += 1) p.tiles[y * p.width + p.entrance.x - 1] = TILE_WALL;
        for (let y = 0; y < p.height; y += 1) p.tiles[y * p.width + p.entrance.x + 1] = TILE_WALL;
        expect(() => deriveAtlas(split, overlayOf([]), { atlas: { mapDocument: 'x' } }))
            .toThrow(/floor splits into more than one component/);
    });

    it('⛔ every refusal that names a stale entry is this module\'s class', () => {
        expect(() => deriveAtlas([], overlayOf([]), { atlas: { mapDocument: 'x' } }))
            .toThrow(MazeAtlasDerivationError);
        expect(() => deriveAtlas(ENTRIES, overlayOf([]), {}))
            .toThrow(/needs `deps.atlas.mapDocument`/);
        expect(() => deriveAtlas(
            [ENTRIES[0], { ...ENTRIES[1], substrate: 'bounce' }],
            overlayOf([]), { atlas: { mapDocument: 'x' } },
        )).toThrow(/must declare the SAME `substrate`/);
    });

    /**
     * ⛓⛓ THE MAP DOCUMENT AND THE GAME ARE THE LIBRARY'S. ⛔ MUTANT: they are
     * left to `createEmptyAtlas`'s defaults, which are `game: 'seedling'` and
     * no map document at all — the atlas then fails validation with *"a region
     * names a map_ref, so the document those level ids live in has to be
     * identified"*, and if it did not, it would name the wrong game.
     */
    it('⛔⛔ the atlas names the LIBRARY as its map document and the ENTRIES\' substrate as its '
        + 'game — never `createEmptyAtlas`\'s Seedling defaults', () => {
        expect(derived.atlas.tile_space.map_document).toBe(LIBRARY.library_id);
        expect(derived.atlas.game).toBe('maze');
        expect(derived.atlas.name).toBe(LIBRARY.name);
    });

    it('⛔ the derived atlas is DELIBERATELY UNSTAMPED — the caller owns identity', () => {
        expect(derived.atlas.provenance?.content_hash).toBeUndefined();
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * LOCATIONS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ a location is a payload item the overlay has MARKED, and only that', () => {
    it('⛔⛔ an UNMARKED item is not a location — the count is the overlay\'s, not the payload\'s', () => {
        expect(ENTRIES[0].payload.items.length).toBeGreaterThan(0);
        expect(deriveAtlasOf(recordOf()).atlas.regions[0].locations).toEqual([]);
    });

    it('⛓ a marked item lands on the item\'s own tile, carrying the authored name and item', () => {
        const item = ENTRIES[0].payload.items[1];
        const overlay = overlayOf(RING);
        overlay.rooms = { 0: { locations: [{ item: 1, name: 'Cross Cache', vanilla_item: 'Key' }] } };
        const region = deriveAtlasOf(recordOf(overlay)).atlas.regions[0];
        expect(region.locations).toEqual([
            { name: 'Cross Cache', tile: [item.x, item.y], vanilla_item: 'Key' },
        ]);
        // …and it reaches the COMPILED rules, which is what the REPORT counts.
        const compiled = compile(overlay);
        expect(compiled.report.locations).toBe(1);
        expect(compiled.rules.regions['1'].mz_cross.locations[0].name).toBe('Cross Cache');
    });

    it('⛔ a marked item the entry does not have refuses BY NAME, quoting the slot count', () => {
        const overlay = overlayOf(RING);
        overlay.rooms = { 0: { locations: [{ item: 99, name: 'Nowhere', vanilla_item: 'Key' }] } };
        expect(() => deriveAtlasOf(recordOf(overlay)))
            .toThrow(/marks item 99 of room 0 \("Nowhere"\), but entry "mz_cross" holds 3 item slot\(s\)/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE OVERLAY'S OWN CHECKS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the maze overlay carries LINKS and START, and checks both', () => {
    it('⛓ a well-formed overlay produces no errors, and `links` is a declared field', () => {
        expect(check(overlayOf(RING, { start: 1 }))).toEqual([]);
        expect(check({ ...emptyMazeOverlay(), nope: 1 })[0])
            .toMatch(/carries schema_version, overlay_id, rooms, links, start and provenance/);
    });

    /**
     * ⛔⛔ MUTANT: the exit id is not checked against the entry. The link then
     * survives into the derivation, where `atlasOps.connect` refuses with
     * *"region X has no exit Y"* — true, but a sentence about the ATLAS, at a
     * point where the author can no longer see which link they typed wrong.
     */
    it('⛔⛔ a link naming an exit the entry does not have refuses BY NAME, listing what it has', () => {
        const [err] = check(overlayOf([{ from: [0, 'nope'], to: [1, 'exit_3'] }]));
        expect(err).toMatch(/overlay\.links\[0\]\.from names exit "nope", which entry "mz_cross" \(room 0\) does not have/);
        expect(err).toMatch(/Its exits are exit_0, exit_1, exit_2, exit_3\./);
    });

    it('⛔ an out-of-range room, a malformed endpoint and a non-boolean `one_way` each refuse', () => {
        expect(check(overlayOf([{ from: [9, 'exit_0'], to: [1, 'exit_3'] }]))[0])
            .toMatch(/must be \[roomIndex, exit_id\] with the room inside 0\.\.3/);
        expect(check(overlayOf([{ from: 'x', to: [1, 'exit_3'] }]))[0]).toMatch(/must be \[roomIndex, exit_id\]/);
        expect(check(overlayOf([{ ...RING[0], one_way: 'yes' }]))[0])
            .toMatch(/one_way must be a boolean when present \(it defaults to false/);
    });

    /**
     * ⛔⛔ MUTANT: duplicates are not caught. `atlasOps.connect` then refuses
     * with *"exit … is already connected"* from inside the derivation, and the
     * author is told about an atlas rather than about the two links they wrote.
     */
    it('⛔⛔ an exit crosses to exactly ONE place, and the second link naming it says which was '
        + 'first', () => {
        const [err] = check(overlayOf([RING[0], { from: [0, 'exit_1'], to: [2, 'exit_0'] }]));
        expect(err).toMatch(/overlay\.links\[1\]\.from names 0\/exit_1, which overlay\.links\[0\] already joins/);
    });

    it('⛓ a location row is addressed by an ITEM INDEX, not by Seedling\'s pixel entity', () => {
        const overlay = overlayOf(RING);
        overlay.rooms = { 0: { locations: [{ item: -1, name: 'x', vanilla_item: 'y' }] } };
        expect(check(overlay)[0]).toMatch(/must be a non-negative INDEX into the entry's payload.items\[\]/);
        overlay.rooms = { 0: { locations: [{ entity: { type: 't', x: 0, y: 0 }, name: 'x', vanilla_item: 'y' }] } };
        expect(check(overlay).some((e) => /entity is not a declared field/.test(e))).toBe(true);
    });

    it('⛔ `assertOverlay` throws this module\'s class and names the module', () => {
        let thrown = null;
        try { assertOverlay(overlayOf([{ from: [9, 'a'], to: [0, 'b'] }]), { roomCount: 4 }); } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(MazeAtlasDerivationError);
        expect(thrown.message).toMatch(/^mazeSetOverlay: this overlay is not well formed — /);
    });

    /**
     * ⛔⛔⛔ MUTANT: `renumberOverlay` spreads `links` through untouched. A
     * reorder would then leave every link pointing at whatever room landed on
     * the old index — the strip would look reordered and the WORLD would be
     * rewired, silently.
     */
    it('⛔⛔⛔ a renumbering re-keys the LINKS and the START, and drops a link into a dead room', () => {
        const overlay = overlayOf([...RING], { start: 3 });
        const mapping = new Map([[0, 1], [1, 0], [2, null], [3, 2]]);
        const { overlay: next } = renumberOverlay(overlay, mapping);
        expect(next.links).toEqual([
            { from: [1, 'exit_1'], to: [0, 'exit_3'] },
            { from: [2, 'exit_0'], to: [1, 'exit_2'] },
        ]);
        expect(next.start).toBe(2);
        // ⛓ …and a start whose room is GONE becomes ABSENT, not silently 0.
        const orphaned = renumberOverlay(overlayOf(RING, { start: 2 }), mapping).overlay;
        expect(Object.hasOwn(orphaned, 'start')).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE FIRST MAZE-OWNED COMPILE, END TO END
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ derive → validate → compile → the real maze world → reachability', () => {
    it('⛓ the derived atlas passes `validateRegionAtlas` WITH the committed schema', () => {
        const v = validateRegionAtlas(deriveAtlasOf(recordOf()).atlas, { schema: ATLAS_SCHEMA });
        expect(v.errors).toEqual([]);
        expect(v.ok).toBe(true);
        // ⛓ the warnings are the two EXPECTED kinds and nothing else: the
        //   deliberate absence of a stamp, and the exits no link touches yet.
        for (const w of v.warnings) {
            expect(w, w).toMatch(/content_hash missing|is not wired by vanilla_layout\.connections/);
        }
    });

    const { rules, report } = compile();

    it('⛓⛓ the compile emits MAZE sidecars, one per region, each bound to its atlas region', () => {
        expect(report.sidecar_flavor).toBe('maze');
        expect(report.regions_without_map_ref).toEqual([]);
        const sidecars = rules.preset_sidecars['1'];
        expect(Object.keys(sidecars).sort()).toEqual(ENTRIES.map((e) => e.entry_id).sort());
        for (const [name, sc] of Object.entries(sidecars)) {
            expect(sc.substrate, name).toBe('maze');
            expect(sc.playable_payload.atlas_region, name).toBe(name);
        }
        // ⛔ the maze flavour boots no original engine.
        expect(rules.flash_panel).toBeUndefined();
    });

    /**
     * ⛓⛓⛓ **THE SHAPE CLAIM IS ASKED OF THE REAL CONSUMER, NOT OF A COPY.**
     * §22.3 said to import `regionAtlasMazeProjection.test.js`'s helpers;
     * MEASURED — they are module-local `const`s and nothing there is exported.
     * So this asks the same question the way that file does: through the maze
     * engine's own `deserializeMazeWorld`, which is what the runtime runs.
     */
    it('⛓⛓ every payload loads through the REAL `deserializeMazeWorld`, entrance on floor', () => {
        for (const [name, sc] of Object.entries(rules.preset_sidecars['1'])) {
            const world = deserializeMazeWorld(sc.playable_payload);
            expect(world.width, name).toBe(sc.playable_payload.width);
            expect(world.exits.size, name).toBe(sc.playable_payload.exits.length);
            expect(world.tiles[world.entrance.y * world.width + world.entrance.x], name)
                .toBe(TILE_FLOOR);
        }
    });

    it('⛓ the projection had NOTHING to report — no carve, no unclassified cell, no walled sink', () => {
        expect(report.maze_notes).toEqual([]);
    });

    it('⛓⛓ the graph CLOSES: every compiled region is reachable from the start', () => {
        const all = Object.keys(regionsOf(rules, '1'));
        const reached = reachableRegions(rules, '1');
        expect(all).toHaveLength(ENTRIES.length + 1); // + Menu
        expect(all.filter((n) => !reached.has(n))).toEqual([]);
    });

    /**
     * ⛔⛔ MUTANT: the derivation drops a doorless region the way Seedling's
     * does. The unreachable room would then VANISH instead of being reported,
     * and an author who cut a link would see the room disappear from the report
     * rather than be told the graph no longer closes.
     */
    it('⛔⛔ a THREE-link overlay leaves one region UNREACHABLE — named, not dropped', () => {
        const short = compile(overlayOf(RING.slice(0, 2)));
        const all = Object.keys(regionsOf(short.rules, '1'));
        const reached = reachableRegions(short.rules, '1');
        expect(all.filter((n) => !reached.has(n))).toEqual(['mz_spur']);
        expect(short.atlas.regions.map((r) => r.region_id))
            .toEqual(ENTRIES.map((e) => e.entry_id));
    });

    it('⛓ the compile is DETERMINISTIC — the same record twice is the same bytes', () => {
        expect(JSON.stringify(compile().rules)).toBe(JSON.stringify(compile().rules));
    });

    it('⛓ an unwired exit is reported rather than silently omitted', () => {
        // 4 entries x 4 exits = 16 endpoints; 4 links wire 8 of them.
        const endpoints = ENTRIES.reduce((n, e) => n + e.payload.exits.length, 0);
        expect(report.unwired_exits).toHaveLength(endpoints - RING.length * 2);
    });

    it('⛔ `rulesJsonOf` refuses without an injected compiler — this module names no pipeline '
        + 'dependency of its own', () => {
        expect(() => rulesJsonOf(sessionOf(), {}, {}))
            .toThrow(/needs `compileRegionAtlas` injected/);
    });

    /**
     * ⛔⛔⛔ MUTANT: `rulesJsonOf` passes `sidecarFlavor: 'maze'` and lets
     * `mazeProjection` be `undefined`, or swallows the compiler's refusal. The
     * compile would then either throw a sentence nobody catches or — worse, if
     * the flavour were dropped instead — emit FLASH sidecars for a maze
     * library, which boot an engine that has no such game. This row asserts the
     * refusal is REAL, so a caller that forgot the grid cannot be silent.
     */
    it('⛔⛔ the maze arm REFUSES without a `gridFor`, by name — the grid is the GAME\'s', () => {
        const atlas = deriveAtlasOf(recordOf()).atlas;
        expect(() => compileRegionAtlas(atlas, { sidecarFlavor: 'maze' }))
            .toThrow(/sidecarFlavor "maze" needs options\.mazeProjection\.\{gridFor,conditionKey,resolveCondition\}/);
        // ⛓ …and the flavour really is what this module passes: a compile
        //   WITHOUT it emits no maze sidecars at all.
        expect(compileRegionAtlas(atlas, {}).report.sidecar_flavor).not.toBe('maze');
    });

    /** ⛓ The tile vocabulary has ONE spelling here, re-exported rather than retyped. */
    it('⛓ the tile constants are `shared/procgen/mazeAlgorithms/gridTiles.js`\'s own', () => {
        expect(TILE_FLOOR).toBe(0);
        expect(TILE_WALL).toBe(1);
    });
});
