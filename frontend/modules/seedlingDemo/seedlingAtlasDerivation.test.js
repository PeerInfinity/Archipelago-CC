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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildLevelSet, reachabilityOf, vanillaRecordSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel } from './procgenLevelOel.js';
import * as OV from '../flashPanel/seedlingPlaythroughOverlay.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { compileRegionAtlas, substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { indexMapDocument, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import {
    ITEM_FOR_TAG, LINK_TAGS, TRIGGER_FOR_NAMED_ROOM, deriveAtlas, inExitId, levelName,
    linksOf, namedInExitId, namedRoomArrivals, namedRoomTriggersAreNotLinks,
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

    /**
     * ⛓⛓ EDITOR INTEGRATION W1 — the region's substrate, DERIVED not spelled.
     *
     * ⛔ THIS SET'S `game` IS `'seedling-generated'`, WHICH IS THE WHOLE POINT
     * OF SCORING IT HERE. The literal `'flash_seedling'` would be GREEN against
     * the vanilla set — that is the mutant's trap. Against a caller that
     * overrode `deps.atlas.game`, the literal names a substrate this compile is
     * not defaulting to and the compiler refuses the whole atlas by name, so
     * the row below compares against `substrateIdFor` and the id it produces
     * for THIS document rather than against a constant.
     */
    it('every region carries the substrate DERIVED from the atlas\'s own game', () => {
        expect(atlas.game).toBe('seedling-generated');
        for (const region of atlas.regions) {
            expect(region.substrate).toBe(substrateIdFor(atlas.game));
        }
        // …and that is NOT the vanilla id, which a literal would have written.
        expect(atlas.regions[0].substrate).toBe('flash_seedling_generated');
        expect(atlas.regions[0].substrate).not.toBe('flash_seedling');
    });

    it('the field AGREES with the compile default — `compileRegionAtlas` with NO options', () => {
        // The point of the field being optional is that writing it changes
        // nothing about how a single-substrate set compiles. Both halves are
        // asserted: the sidecars carry the derived id, and the report counts
        // them all under it with no second substrate anywhere.
        const { rules, report } = compileRegionAtlas(atlas, {});
        const sidecars = rules.preset_sidecars['1'];
        for (const sc of Object.values(sidecars)) {
            expect(sc.substrate).toBe(substrateIdFor(atlas.game));
        }
        expect(report.substrates).toEqual({ [substrateIdFor(atlas.game)]: Object.keys(sidecars).length });
        expect(report.substrate).toBe(substrateIdFor(atlas.game));
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

/**
 * ── EDITOR v3 E5 — `named_rooms` AS CONNECTIONS, ON THE EDITOR PATH ONLY ─────
 *
 * §23.8 measured the hole: opening the vanilla 116 in the set editor REFUSED
 * the `rules.json` export because `level_58` is unreachable, and the COMMITTED
 * playthrough atlas has the same hole. The reason is not a bug in either — it
 * is that the ONE thing in the whole game that reaches `level_58` is a MANIFEST
 * fact (`named_rooms.tentacle_beast_mouth`), and `linksOf` only sees entities
 * with an `@to`.
 *
 * ⛔ **THE ROWS BELOW ARE ABOUT A SPLIT, NOT ONLY ABOUT A FEATURE.** The
 * derivation gained an OPTIONAL `deps.namedRooms`; `deriveAtlasOf` passes the
 * record's own manifest and the playthrough generator passes NOTHING, so the
 * committed atlas keeps the hole and its bytes do not move. Both halves are
 * pinned — the second one by reading the producer's source and by comparing the
 * committed file's md5 across a real `--check` run, because an exit code is not
 * an identity ([[feedback_identity_moves_while_verdict_stays_green]]).
 */
describe('⛓⛓ E5 — a `named_rooms` arrival is a connection, and its source is the trigger', () => {
    const vanillaRooms = () => {
        const { set } = vanillaRecordSet(
            JSON.parse(readFileSync(fileURLToPath(
                new URL('./fixtures/seedling-vanilla-set.json', import.meta.url)), 'utf8')),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')),
        );
        return { set, rooms: set.rooms.map((r, level) => ({ ...r.source.record, level })) };
    };

    /**
     * ⛔ THE OUT-SIDE SPELLING IS COLLISION-FREE BY CONSTRUCTION, and this row
     * asserts the CONSTRUCTION rather than measuring one fixture: a trigger that
     * were also a link tag would make `out_<type>_<x>_<y>` name two doors.
     */
    it('reuses `outExitId` because no trigger element is a transition primitive', () => {
        expect(namedRoomTriggersAreNotLinks()).toBe(true);
        expect(Object.values(TRIGGER_FOR_NAMED_ROOM).filter((t) => LINK_TAGS.includes(t)))
            .toEqual([]);
        // …and the entry key really is what keeps ELEVEN arrivals on one tile apart.
        expect(namedInExitId('bloody_seed_ending', 12, 64, 96))
            .not.toBe(namedInExitId('bloody_seed_ending', 32, 64, 96));
        expect(namedInExitId('light_boss_exit', 69, 112, 96))
            .not.toBe(namedInExitId('bloody_seed_ending', 69, 112, 96));
    });

    /**
     * ⛓ THE SIX ENTRIES, AND THEIR SOURCE COUNTS OVER THE REAL GAME. The counts
     * are pinned because they are the fact the derivation rule turns into edges;
     * the SOURCE LIST is derived from the rooms, never typed.
     */
    it('finds every source from the trigger element — 15 rows over 13 rooms, 11 of them one entry', () => {
        const { set, rooms } = vanillaRooms();
        const roomById = new Map(rooms.map((r) => [r.level, r]));
        const rows = namedRoomArrivals(rooms, set.named_rooms, { roomById });

        const byKey = new Map();
        for (const r of rows) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r.from]);
        expect(Object.fromEntries([...byKey].map(([k, v]) => [k, v.length]))).toEqual({
            moonrock_target: 1,
            dark_shrum_death: 1,
            bloody_seed_ending: 11,
            light_boss_exit: 1,
            tentacle_beast_mouth: 1,
        });
        expect(byKey.get('bloody_seed_ending').sort((a, b) => a - b))
            .toEqual([12, 32, 37, 43, 57, 69, 82, 89, 94, 103, 114]);
        expect(byKey.get('tentacle_beast_mouth')).toEqual([57]);
        expect(byKey.get('light_boss_exit')).toEqual([69]);
        expect(rows).toHaveLength(15);
        // ⚠ 15 ROWS OVER 13 ROOMS — L57 and L69 each hold TWO triggers (a
        //   `<watcher>` and the trap room's own boss controller), so a count of
        //   rooms and a count of warps are different numbers.
        expect(new Set(rows.map((r) => r.from)).size).toBe(13);

        // ⛔ `watcher_text` IS IN THE MANIFEST AND DERIVES NOTHING — `position:
        //    false`. The `<finaldoor>` element that makes it live IS in the set
        //    (L113), so this is the FIELD being read and not the trigger being
        //    missing.
        expect(byKey.has('watcher_text')).toBe(false);
        expect(rooms.some((r) => (r.entities ?? []).some((e) => e.type === 'finaldoor')))
            .toBe(true);
    });

    /**
     * ⛓⛓ THE EDITOR PATH — an EMPTY overlay, which is what the set editor opens
     * vanilla with, so every source is live.
     */
    it('adds 15 one-way connections and makes `level_58` reachable — the editor path', () => {
        const { set, rooms } = vanillaRooms();
        const deps = { tileSize: TILE, tileTypeForPlacement };
        const without = deriveAtlas(rooms, {}, deps);
        const withNamed = deriveAtlas(rooms, {}, { ...deps, namedRooms: set.named_rooms });

        const connOf = (d) => new Set(d.atlas.vanilla_layout.connections
            .map((c) => `${c.from[0]} ${c.from[1]} -> ${c.to[0]} ${c.to[1]}`));
        const added = [...connOf(withNamed)].filter((c) => !connOf(without).has(c));
        expect(added.sort()).toEqual([
            'level_0 out_moonrock_240_256 -> level_2 in_moonrock_target_L0_48_32',
            'level_103 out_watcher_120_24 -> level_1 in_bloody_seed_ending_L103_64_96',
            'level_114 out_watcher_72_72 -> level_1 in_bloody_seed_ending_L114_64_96',
            'level_12 out_watcher_296_104 -> level_1 in_bloody_seed_ending_L12_64_96',
            'level_1 out_oracle_64_32 -> level_114 in_dark_shrum_death_L1_72_128',
            'level_32 out_watcher_8_48 -> level_1 in_bloody_seed_ending_L32_64_96',
            'level_37 out_watcher_104_264 -> level_1 in_bloody_seed_ending_L37_64_96',
            'level_43 out_watcher_200_280 -> level_1 in_bloody_seed_ending_L43_64_96',
            'level_57 out_tentaclebeast_80_48 -> level_58 in_tentacle_beast_mouth_L57_56_96',
            'level_57 out_watcher_48_32 -> level_1 in_bloody_seed_ending_L57_64_96',
            'level_69 out_lightbosscontroller_72_72 -> level_36 in_light_boss_exit_L69_112_96',
            'level_69 out_watcher_144_144 -> level_1 in_bloody_seed_ending_L69_64_96',
            'level_82 out_watcher_72_96 -> level_1 in_bloody_seed_ending_L82_64_96',
            'level_89 out_watcher_248_176 -> level_1 in_bloody_seed_ending_L89_64_96',
            'level_94 out_watcher_152_128 -> level_1 in_bloody_seed_ending_L94_64_96',
        ].sort());
        expect(withNamed.stats.connections).toBe(without.stats.connections + 15);
        expect(withNamed.atlas.vanilla_layout.connections.every((c) => c.one_way === true))
            .toBe(true);

        // ⛔ AND `level_58` MOVES — a structural walk over the atlas's own
        //    connections, which is what the REPORT's `reach` section runs.
        const walk = (atlas) => {
            const out = new Map();
            for (const c of atlas.vanilla_layout.connections) {
                out.set(c.from[0], [...(out.get(c.from[0]) ?? []), c.to[0]]);
            }
            const seen = new Set([atlas.vanilla_layout.start_region]);
            const q = [atlas.vanilla_layout.start_region];
            while (q.length > 0) {
                for (const n of out.get(q.pop()) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
            }
            return seen;
        };
        expect(walk(without.atlas).has('level_58')).toBe(false);
        expect(walk(withNamed.atlas).has('level_58')).toBe(true);
        // …and nothing ELSE moved: 58 is the only region the manifest rescues.
        expect([...walk(withNamed.atlas)].filter((r) => !walk(without.atlas).has(r)))
            .toEqual(['level_58']);
    });

    /**
     * ⛔⛔ **A NEVER-ENTER SOURCE MAKES NO CONNECTION — AND IT COSTS `level_58`
     * ITS RESCUE.** §27.6 predicted the manifest would make `level_58` reachable
     * full stop. It does not: `tentacle_beast_mouth`'s ONLY source is L57 and
     * `light_boss_exit`'s ONLY source is L69, and BOTH are the trap rooms the
     * playthrough overlay declares never-enter. Under that overlay the pass adds
     * ELEVEN connections, not fifteen, and 58 stays unreached — which is the
     * right answer, because never-enter is encoded here as an ABSENCE and a warp
     * out of a trap room would put the trap room back in the graph.
     */
    it('skips a warp whose SOURCE is never-enter, and NOTES it rather than throwing', () => {
        const { set, rooms } = vanillaRooms();
        const notes = [];
        const deps = {
            tileSize: TILE,
            tileTypeForPlacement,
            note: (s) => notes.push(s),
            namedRooms: set.named_rooms,
        };
        /**
         * ⛔ THE LIST IS THE PLAYTHROUGH OVERLAY'S OWN, NEVER TYPED. It is
         * [57, 69, **82**] — three rooms, and the third is easy to miss because
         * only the first two are DROPPED from the committed atlas (L82 keeps
         * its outbound doors, so it survives the drop pass). A row that typed
         * `[57, 69]` would be measuring a ruling nobody made.
         */
        const overlay = {
            neverEnter: {
                levels: OV.NEVER_ENTER_LEVELS,
                cite: OV.NEVER_ENTER_CITE,
            },
        };
        const guarded = deriveAtlas(rooms, overlay, deps);
        const open = deriveAtlas(rooms, {}, deps);

        const namedOf = (d) => d.atlas.vanilla_layout.connections
            .filter((c) => /^in_(moonrock_target|dark_shrum_death|bloody_seed_ending|light_boss_exit|tentacle_beast_mouth)_/
                .test(c.to[1]));
        expect(namedOf(open)).toHaveLength(15);
        expect(namedOf(guarded)).toHaveLength(10);
        expect(namedOf(guarded).map((c) => c.from[0])
            .filter((r) => OV.NEVER_ENTER_LEVELS.some((l) => r === `level_${l}`)))
            .toEqual([]);
        // ⛓ FIVE refused, not three: L57 and L69 each hold TWO triggers (a
        //   `<watcher>` and the trap room's own boss controller) and L82 holds
        //   one — 15 - 5 = 10.
        const refused = notes.filter((n) => n.includes('NOT WIRED') && n.includes('warp'));
        expect(refused).toHaveLength(5);
        expect(refused.some((n) => n.includes('`tentacle_beast_mouth`') && n.includes('leaves a trap room')))
            .toBe(true);
        expect(refused.some((n) => n.includes('`light_boss_exit`') && n.includes('leaves a trap room')))
            .toBe(true);
        // ⇒ and `level_58` is NOT rescued under that overlay.
        expect(namedOf(guarded).some((c) => c.to[0] === 'level_58')).toBe(false);
    });

    /**
     * ⛓ AN ENTRY THE DERIVATION DOES NOT RECOGNISE, AND A TARGET ROOM THAT IS
     * NOT IN THE SET, BOTH DERIVE NOTHING RATHER THAN THROWING. Refusing a
     * manifest key here would be a SECOND authority for `set-field`'s own
     * closed-six refusal, and the two would come to disagree.
     */
    it('derives nothing from an unknown key, a missing level or a position-less entry', () => {
        const { rooms } = vanillaRooms();
        const roomById = new Map(rooms.map((r) => [r.level, r]));
        const rows = (nr) => namedRoomArrivals(rooms, nr, { roomById });
        expect(rows({ not_a_named_room: { level: 2, x: 0, y: 0 } })).toEqual([]);
        expect(rows({ tentacle_beast_mouth: { level: 999, x: 56, y: 96 } })).toEqual([]);
        expect(rows({ tentacle_beast_mouth: { level: 58 } })).toEqual([]);
        expect(rows({ watcher_text: { level: 114, x: 8, y: 8 } })).toEqual([]);
        expect(rows(undefined)).toEqual([]);
        expect(rows(null)).toEqual([]);
    });
});

/**
 * ⛔⛔ **THE SPLIT THAT KEEPS THE COMMITTED BYTES — PINNED FROM BOTH ENDS.**
 *
 * E5's whole shape rests on ONE claim: the EDITOR reads `named_rooms` and the
 * PLAYTHROUGH GENERATOR does not, so `seedling-playthrough.json` keeps §23.8's
 * hole and every id downstream of it stays where it is. A claim like that fails
 * silently — somebody adds `namedRooms` to the producer's deps bag "for
 * consistency" and 113 regions become 115 with no test saying so.
 *
 * ⛓ SO IT IS PINNED TWICE, and neither pin is an exit code:
 *   1. the producer's ONE `deriveAtlas` call site is READ, and its argument list
 *      is asserted not to name `namedRooms`;
 *   2. the committed atlas's md5 is compared ACROSS a real `--check` run
 *      ([[feedback_identity_moves_while_verdict_stays_green]] — a producer's
 *      md5 can move while its verdict stays 0).
 */
describe('⛔ E5 — the producer keeps the hole, and the committed atlas does not move', () => {
    const producerPath = fileURLToPath(
        new URL('../../../scripts/procgen/make-seedling-playthrough-rules.mjs', import.meta.url));
    const atlasPath = fileURLToPath(
        new URL('../flashPanel/atlases/seedling-playthrough.json', import.meta.url));
    const presetPath = fileURLToPath(
        new URL('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url));

    it('has exactly ONE `deriveAtlas` call site and it names no `namedRooms`', () => {
        const src = readFileSync(producerPath, 'utf8');
        // ⛔ CALL SITES, not mentions: the import line and the docblocks say the
        //    name too, and a count over those would pass whatever the code did.
        const calls = [...src.matchAll(/\bderiveAtlas\s*\(/g)];
        expect(calls).toHaveLength(1);
        // The argument list is everything from the call to the end of the
        // enclosing `return …;` — `derivePlaythroughLayer` is a single return.
        const from = calls[0].index;
        const args = src.slice(from, src.indexOf('\n}', from));
        expect(args).toContain('tileTypeForPlacement');   // the deps bag really is in view
        expect(args).not.toContain('namedRooms');
        expect(args).not.toContain('named_rooms');
    });

    /**
     * ⛓⛓ **THE CROSS-CHECK'S DIFF, BY NAME** (§22.2 #7's other half). E1's
     * cross-check proves the set-derived layer equals the committed one 1:1;
     * this says exactly what `named_rooms` ADDS to that comparison — and it is
     * NOT the fifteen the editor sees, because the committed atlas is built
     * under `NEVER_ENTER_LEVELS` = [57, 69, 82] and FIVE of the fifteen leave a
     * trap room (L57 and L69 hold two triggers each, L82 one).
     *
     * ⛔ §27.6 PREDICTED `level_58` WOULD MOVE TO REACHED HERE. IT DOES NOT, and
     * the reason is the measurement rather than a shrug: L57 is the only source
     * of the warp that reaches it.
     */
    it('adds TEN connections to the playthrough-shaped derivation, and none reach level_58', () => {
        const committed = JSON.parse(readFileSync(fileURLToPath(
            new URL('../flashPanel/atlases/seedling-playthrough.json', import.meta.url)), 'utf8'));
        const { set } = vanillaRecordSet(
            JSON.parse(readFileSync(fileURLToPath(
                new URL('./fixtures/seedling-vanilla-set.json', import.meta.url)), 'utf8')),
            JSON.parse(readFileSync(fileURLToPath(
                new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8')),
        );
        const rooms = set.rooms.map((r, level) => ({ ...r.source.record, level }));
        const overlay = {
            neverEnter: { levels: OV.NEVER_ENTER_LEVELS, cite: OV.NEVER_ENTER_CITE },
        };
        const guarded = deriveAtlas(rooms, overlay, {
            tileSize: TILE, tileTypeForPlacement, namedRooms: set.named_rooms,
        });

        const key = (c) => `${c.from[0]} -> ${c.to[0]}`;
        const committedKeys = new Set(committed.vanilla_layout.connections.map(key));
        const added = guarded.atlas.vanilla_layout.connections
            .filter((c) => /^in_(moonrock_target|dark_shrum_death|bloody_seed_ending|light_boss_exit|tentacle_beast_mouth)_/
                .test(c.to[1]));
        expect(added).toHaveLength(15 - 5);
        /**
         * ⛓ EVERY ONE OF THEM IS A NEW **DOOR** — no arrival id the manifest
         * mints exists in the committed atlas.
         *
         * ⚠ NOT every one is a new REGION PAIR, and the exception is a fact
         * about the game rather than a weakening: `level_0 -> level_2` is
         * already drawn by an ordinary teleporter, because `Moonrock.as:131`
         * finds the stairs it is about to replace by OVERLAP. So the manifest
         * warp lands beside a door that is already there, and a row asserting
         * "all eleven pairs are new" would be asserting the wrong thing.
         */
        const committedExits = new Set(committed.regions
            .flatMap((r) => (r.exits ?? []).map((e) => e.exit_id)));
        expect(added.filter((c) => committedExits.has(c.to[1]))).toEqual([]);
        expect(added.filter((c) => committedExits.has(c.from[1]))).toEqual([]);
        expect(added.filter((c) => committedKeys.has(key(c))).map(key))
            .toEqual(['level_0 -> level_2']);
        expect(added.map(key).sort()).toEqual([
            'level_0 -> level_2',
            'level_103 -> level_1',
            'level_114 -> level_1',
            'level_12 -> level_1',
            'level_1 -> level_114',
            'level_32 -> level_1',
            'level_37 -> level_1',
            'level_43 -> level_1',
            'level_89 -> level_1',
            'level_94 -> level_1',
        ].sort());
        // ⛔ AND `level_58` IS STILL UNREACHED IN THE COMMITTED DOCUMENT — the
        //    hole §23.8 found is exactly where it was.
        expect(committed.regions.some((r) => r.region_id === 'level_58')).toBe(true);
        expect(committed.vanilla_layout.connections.filter((c) => c.to[0] === 'level_58'))
            .toEqual([]);
        expect(added.filter((c) => c.to[0] === 'level_58')).toEqual([]);
    });

    it('rebuilds the committed atlas and its preset byte for byte, md5 unmoved', async () => {
        const { createHash } = await import('node:crypto');
        const { execFileSync } = await import('node:child_process');
        const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
        const before = { atlas: md5(atlasPath), preset: md5(presetPath) };
        const out = execFileSync(process.execPath, [producerPath, '--check'], { encoding: 'utf8' });
        const after = { atlas: md5(atlasPath), preset: md5(presetPath) };

        // ⛔ THE MD5, NOT THE EXIT CODE. `execFileSync` already throws on a
        //    non-zero exit; what this row adds is that the FILES did not move.
        expect(after).toEqual(before);
        expect(out).toContain('matches a fresh build');
        // …and the shape the hole is part of, so a rebuild that silently gained
        // the manifest's connections is a VALUE failure here.
        expect(out).toContain('113 regions');
        expect(out).toContain('312 one-way connections');
    }, 120000);
});
