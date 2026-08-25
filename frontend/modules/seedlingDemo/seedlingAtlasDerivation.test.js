/**
 * seedlingDemo/seedlingAtlasDerivation — **THE ATLAS IS DERIVED FROM THE ROOMS**
 * (EDITOR v3 slice D0b; plan §16.3, ⚖ ruled by the user 2026-08-25).
 *
 * ⛓⛓ THE CLAIM WORTH GATING IS NOT "the code moved". That one is gated by
 * `make-seedling-playthrough-rules --check`, which rebuilds the 116-room
 * vanilla atlas AND its preset through this module and compares bytes. What is
 * gated HERE is the claim the lift was FOR: that the same derivation serves a
 * source the playthrough generator has never seen — a GENERATED level set —
 * and that what comes out is a real atlas the rest of the pipeline accepts.
 *
 * ⛔ AND THE SET IS GENERATED, NOT TYPED. `buildLevelSet({link: true})` over
 * `emptyLevel` rooms is the same path `levelSetExporter.test.js` uses; the
 * rooms and their exits come out of the exporter, so this row cannot pass by
 * agreeing with an atlas somebody wrote to make it pass.
 */

import { describe, expect, it } from 'vitest';

import { buildLevelSet, reachabilityOf } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { indexMapDocument, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import {
    ITEM_FOR_TAG, LINK_TAGS, deriveAtlas, inExitId, levelName, linksOf,
    outExitId, regionIdFor,
} from './seedlingAtlasDerivation.js';

const ATLAS_SCHEMA = loadAtlasSchema();
const RULES_SCHEMA = loadRulesSchema();
const TILE = 16;
const ROOMS = 6;

/**
 * A generated 6-room set, wired by the exporter's own linker.
 *
 * ⛓ `link: true` is what gives the rooms EXITS at all: the palette places
 * obstacles, not transitions, so an unlinked generated set is N unreachable
 * rooms — `levelSetExporter.js:255` says so out loud, and that is exactly the
 * property the agreement row below leans on.
 */
function generatedSet() {
    const rooms = Array.from({ length: ROOMS }, (_, level) => emptyLevel({ level }));
    return buildLevelSet(rooms, { setId: 'derivation-test', link: true });
}

/**
 * ⛓⛓ **THE ADAPTATION, AT THE CALL SITE — the whole point of §16.3's shape.**
 *
 * A set's room carries its OEL text, and `parseOelLevel` gives back the same
 * record the map extract's levels present. The ONLY field `deriveAtlas` needs
 * that a parsed room does not carry is `level` — a parsed `.oel` does not know
 * its own index, the SET does. One line, here, not inside the module.
 */
function roomsOf(set) {
    // ⛓ E1b — the exporter writes `source: {record}`; the record IS the shape
    //   the derivation wants, so there is nothing to parse.
    return set.rooms.map((room, level) => ({ ...room.source.record, level }));
}

describe('the two input shapes really are one record', () => {
    /**
     * ⛔ MEASURED, not asserted in a comment. The map extract's levels and a
     * parsed room must present the same fields, or "one derivation serves both
     * sources" is a sentence rather than a fact
     * ([[feedback_header_warning_is_not_a_check]]).
     */
    it('a parsed set room carries width/height/layers/entities and NOT `level`', () => {
        const doc = generatedSet().set.rooms[0].source.record;
        for (const key of ['width', 'height', 'layers', 'entities']) {
            expect(doc, `parsed room is missing ${key}`).toHaveProperty(key);
        }
        expect(doc.level).toBeUndefined();
        expect(Number.isInteger(doc.width) && Number.isInteger(doc.height)).toBe(true);
    });

    it('deriveAtlas REFUSES a room with no `level`, naming who supplies it', () => {
        const rooms = roomsOf(generatedSet().set).map(({ level, ...rest }) => rest);
        expect(() => deriveAtlas(rooms, {}, { tileSize: TILE, tileTypeForPlacement }))
            .toThrow(/rooms\[0\] carries no integer `level` id/);
        expect(() => deriveAtlas(rooms, {}, { tileSize: TILE, tileTypeForPlacement }))
            .toThrow(/the SET does/);
    });

    it('deriveAtlas refuses a missing tileSize rather than defaulting one', () => {
        expect(() => deriveAtlas(roomsOf(generatedSet().set), {}, {}))
            .toThrow(/deps\.tileSize must be a positive integer/);
    });
});

describe('⛓ a GENERATED 6-room set derives an atlas the pipeline accepts', () => {
    const { set } = generatedSet();
    const rooms = roomsOf(set);
    const { atlas, stats, dropped } = deriveAtlas(rooms, {}, {
        tileSize: TILE,
        tileTypeForPlacement,
        // ⚠ `mapDocument` is required once any region names a `map_ref`, and
        //   every derived region does — the validator says so by name. For a
        //   SET the map document IS the set, so a caller names its file.
        atlas: { game: 'seedling-generated', mapDocument: 'derivation-test-set.json' },
    });

    it('one region per room, named and bounded by the room', () => {
        expect(stats.rooms).toBe(ROOMS);
        expect(dropped).toEqual([]);
        expect(atlas.regions.map((r) => r.region_id))
            .toEqual(rooms.map((r) => regionIdFor(r.level)));
        for (const [i, region] of atlas.regions.entries()) {
            expect(region.name).toBe(levelName(i));
            expect(region.map_ref).toBe(i);
            expect(region.bounds).toEqual({ x: 0, y: 0, w: rooms[i].width, h: rooms[i].height });
        }
    });

    it('the exits are the link entities, and every connection is ONE-WAY', () => {
        const linkEntities = rooms.flatMap((r) => linksOf(r, {
            roomById: new Map(rooms.map((x) => [x.level, x])),
        }));
        expect(linkEntities.length).toBeGreaterThan(0);
        for (const e of linkEntities) expect(LINK_TAGS).toContain(e.e.type);
        // one source exit per link, one DEDUPED arrival exit per (to, inExitId)
        const arrivals = new Set(linkEntities.map(({ e, to }) => `${to}/${inExitId(
            rooms.find((r) => r.entities.includes(e)).level, e)}`));
        expect(stats.exits).toBe(linkEntities.length + arrivals.size);
        expect(stats.connections).toBe(linkEntities.length);
        for (const c of atlas.vanilla_layout.connections) expect(c.one_way).toBe(true);
        expect(atlas.vanilla_layout.start_region).toBe(regionIdFor(0));
    });

    it('the derived atlas is schema-valid and passes the authoritative validator', () => {
        const mapDoc = { levels: rooms };
        expect(indexMapDocument(mapDoc).size).toBe(ROOMS);
        const result = validateRegionAtlas(atlas, { mapDoc, schema: ATLAS_SCHEMA });
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('it compiles, and the rules.json is schema-valid', () => {
        const { rules } = compileRegionAtlas(atlas, { gameName: 'Derivation Test' });
        expect(rulesJsonSchemaErrors(rules, RULES_SCHEMA)).toEqual([]);
    });

    /**
     * ⛓⛓⛓ **THE ROW THE LIFT EXISTS FOR: TWO INDEPENDENT WALKS MUST AGREE ON
     * WHICH ROOMS ARE ENTERED.**
     *
     * `reachabilityOf` walks the SET — it re-parses each room's OEL and follows
     * `@to`/`@fallthrough`. `compileRegionAtlas().report.unwired_exits` names
     * the boundary exits the ATLAS has that no connection wires, and the
     * compiler DROPS those edges. The two look at different documents through
     * different code, so agreement is evidence and not a tautology.
     *
     * ⛔ A DERIVATION THAT DEDUPED ARRIVAL EXITS WRONGLY BREAKS EXACTLY THIS: it
     * would either lose an arrival (a room the atlas cannot be entered by, while
     * the set walk still enters it) or leave one unwired.
     */
    it('agrees with the set\'s own reachability on which rooms are entered', () => {
        const walk = reachabilityOf(set);
        expect(walk.rooms_not_walked).toBe(0);
        expect(walk.unreachable).toEqual([]);
        expect(walk.reachable).toBe(ROOMS);

        const { report, rules } = compileRegionAtlas(atlas, { gameName: 'Derivation Test' });
        // ⛔ NOT VACUOUS. `unwired_exits: []` only means "all wired" if there
        //   are exits to wire — a readout of an empty graph says the same thing
        //   ([[feedback_roster_readout_type_filter]]). So the graph is checked
        //   to have edges first, and the key to exist at all.
        expect(report).toHaveProperty('unwired_exits');
        expect(stats.exits).toBeGreaterThan(0);
        expect(report.unwired_exits).toEqual([]);
        const regions = Object.values(rules.regions ?? {})[0] ?? rules.regions;
        expect(JSON.stringify(regions)).toMatch(/"exits"/);

        // every region the atlas holds is one of the rooms the set walk entered
        const entered = new Set(Array.from({ length: walk.reachable }, (_, i) => regionIdFor(i)));
        expect(new Set(atlas.regions.map((r) => r.region_id))).toEqual(entered);
    });

    /**
     * ⛔ NON-VACUITY. The row above would pass over an atlas with NO exits at
     * all against a set with no exits at all. The UNLINKED set is the control:
     * the exporter's own note says a generated set is N unreachable rooms until
     * it is linked, so the two walks must agree on THAT too — and disagree with
     * the linked case.
     */
    it('the same two walks agree on an UNLINKED set, which is 1 room reachable', () => {
        const bare = buildLevelSet(
            Array.from({ length: ROOMS }, (_, level) => emptyLevel({ level })),
            { setId: 'derivation-control' },
        ).set;
        expect(reachabilityOf(bare).reachable).toBe(1);
        const bareRooms = roomsOf(bare);
        const derived = deriveAtlas(bareRooms, {}, { tileSize: TILE, tileTypeForPlacement });
        // Every room but the start has no door at all, so the derivation DROPS
        // them by name — which is the atlas's way of saying "unreachable".
        expect(derived.stats.exits).toBe(0);
        expect(derived.dropped.sort())
            .toEqual([1, 2, 3, 4, 5].map(regionIdFor).sort());
        expect(derived.atlas.regions.map((r) => r.region_id)).toEqual([regionIdFor(0)]);
    });
});

describe('the AUTHORED half travels in the overlay', () => {
    const rooms = roomsOf(generatedSet().set);

    /**
     * ⛓ §16.3's three authored things, exercised on a source that has no
     * vanilla ledger: an overlay row placed against a real entity becomes an AP
     * location with its `vanilla_item`, and NOTHING else in the derivation
     * changes.
     */
    it('an overlay location row becomes a location on the room that holds it', () => {
        const host = rooms.find((r) => r.entities.some((e) => e.type === 'torchpickup'))
            ?? (() => {
                // the generated rooms carry no pickup, so plant one — the row is
                // about the OVERLAY's effect, not about what emptyLevel emits
                rooms[2].entities.push({ type: 'torchpickup', x: 4 * TILE, y: 3 * TILE, attrs: {} });
                return rooms[2];
            })();
        const { atlas } = deriveAtlas(rooms, {
            locations: [{ id: 'torchpickup@x', kind: 'pickup', tag: 'torchpickup', level: host.level }],
        }, { tileSize: TILE, tileTypeForPlacement });
        const region = atlas.regions.find((r) => r.region_id === regionIdFor(host.level));
        expect(region.locations).toEqual([{
            name: `${levelName(host.level)} - Torchpickup`,
            tile: [4, 3],
            vanilla_item: ITEM_FOR_TAG.torchpickup,
        }]);
    });

    /**
     * ⛔ A ROW WHOSE ENTITY IS NOT THERE IS AN ERROR, NEVER A SKIP — trap 110.
     * A census that silently loses a row produces an atlas missing a
     * collectible, and nothing downstream can tell that from a game that has
     * one fewer.
     */
    it('an overlay row with no entity for it THROWS, naming the row and the level', () => {
        expect(() => deriveAtlas(rooms, {
            locations: [{ id: 'sword@nowhere', kind: 'pickup', tag: 'sword', level: 1 }],
        }, { tileSize: TILE, tileTypeForPlacement }))
            .toThrow(/ledger row sword@nowhere: no entity for it in level 1/);
    });

    /**
     * ⛓⛓ **A LOST COLLECTIBLE IS AN ERROR, NOT A NOTE.** A region with no door
     * at all is DROPPED — that is how the derivation encodes "nothing reaches
     * this room". But dropping a room that holds a location silently deletes an
     * AP location, and nothing downstream can tell that from a game with one
     * fewer collectible. This row is what makes the throw reachable: without it
     * the generated set never produces a doorless room that holds anything, and
     * the guard would have been dead code with a comment on it.
     */
    it('a DROPPED room that holds an overlay location THROWS — a lost collectible', () => {
        const bare = buildLevelSet(
            Array.from({ length: 3 }, (_, level) => emptyLevel({ level })),
            { setId: 'lost-collectible' },
        ).set;
        const bareRooms = roomsOf(bare);
        // room 2 has no door (nothing is linked), and now it holds a pickup
        bareRooms[2].entities.push({ type: 'torchpickup', x: 3 * TILE, y: 3 * TILE, attrs: {} });
        expect(() => deriveAtlas(bareRooms, {
            locations: [{ id: 'torch@2', kind: 'pickup', tag: 'torchpickup', level: 2 }],
        }, { tileSize: TILE, tileTypeForPlacement }))
            .toThrow(/level_2 has no entry point but holds 1 location\(s\) — that is a lost collectible/);
        // ⛔ and NOT vacuous: the same doorless room with NO location is a
        //   quiet drop, which is the behaviour the throw is carved out of.
        const noLoc = roomsOf(bare);
        expect(deriveAtlas(noLoc, {}, { tileSize: TILE, tileTypeForPlacement }).dropped)
            .toEqual([regionIdFor(1), regionIdFor(2)]);
    });

    it('a never-enter ruling leaves the target UNWIRED, and the note says why', () => {
        const notes = [];
        const to = rooms.flatMap((r) => linksOf(r, { roomById: new Map(rooms.map((x) => [x.level, x])) }))
            .map((l) => l.to).find((n) => n !== 0);
        const { atlas } = deriveAtlas(rooms, {
            neverEnter: { levels: [to], cite: { [to]: 'a test ruling' } },
        }, { tileSize: TILE, tileTypeForPlacement, note: (m) => notes.push(m) });
        expect(notes.some((n) => n.includes('NOT WIRED — trap room') && n.includes('a test ruling')))
            .toBe(true);
        for (const c of atlas.vanilla_layout.connections) {
            expect(c.to[0]).not.toBe(regionIdFor(to));
        }
    });
});

describe('the derived document is UNSTAMPED — the caller owns identity', () => {
    /**
     * ⛔ D0a §18.9 hard #3: `contentIdentity` is load-bearing for ten committed
     * ids, and a lift that stamped on a path that did not stamp before would
     * move the playthrough atlas. `deriveAtlas` hands back the live session
     * document; `AtlasSession.toDocument()` is still the only stamper.
     */
    it('carries no content hash and an unsuffixed atlas_id', () => {
        const { atlas } = deriveAtlas(roomsOf(generatedSet().set), {}, {
            tileSize: TILE, tileTypeForPlacement, atlas: { game: 'unstamped-check' },
        });
        expect(atlas.provenance.content_hash).toBeUndefined();
        expect(atlas.atlas_id).toBe('unstamped-check');
        expect(outExitId({ type: 'teleporter', x: 32, y: 48 })).toBe('out_teleporter_32_48');
    });
});
