/**
 * ⛓⛓⛓ lab-set-seedling-identity (the study's S1) — **A WATCH-PAGE SET LEAVES THE LAB AS
 * SEEDLING, WITH ITS OWN FINGERPRINT, AND OFFERS NOTHING TO PLAY.**
 *
 * Every row drives the PAGE'S OWN deps and compile (`watchSetIdentity.js`, the module
 * `watchViewer.js` reads) through the same `reportOf` the mount's REPORT runs, over the
 * real vanilla 116 (`editorVanillaSet`, the `#editLoadVanilla` call).
 *
 * Mutants this file must red (each driven by hand, quoted in the as-built):
 *  · `WATCH_SET_ATLAS.game` back to `'seedling-watch-edit'` → the substrate row;
 *  · the stamp removed (the compile handed the derived atlas) → the two-ids row;
 *  · `LAB_SET_COMPILE_OPTIONS` without `flashPanel: false` → the no-`flash_panel` row.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { substrateRegistryEntry as FLASH_SEEDLING_ENTRY } from '../flashPanel/flashSeedlingLibrary.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { SEEDLING_ATLAS_GAME as MAZE_LAB_SEEDLING_GAME } from '../mazeRoom/mazeSetLab.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { compileRegionAtlas, substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { stampAtlasIdentity, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { TILE_SIZE } from './levelWorld.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { SEEDLING_ATLAS_GAME } from './seedlingAtlasDerivation.js';
import { createSeedlingSetAdapter, createSetSession, setRecord } from './seedlingSetAdapter.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import { editorVanillaSet, reportOf } from './watchSetEditor.js';
import {
    LAB_SET_ATLAS_BASE, LAB_SET_ROOMS_SOURCE, WATCH_SET_ATLAS, labSetIdentity,
} from './watchSetIdentity.js';

const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const VANILLA = readJson('./fixtures/seedling-vanilla-set.json');
/** ⛓ The SERVED index, read: the ids the player can resolve (what slice G keys on). */
const SERVED = new Set(readJson('../flashPanel/atlases/atlas_files.json').atlases.map((a) => a.atlas_id));

/** ⛓ The page's set deps (`watchViewer.js`'s `setDeps`, minus the manifest-form schema). */
const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE_SIZE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: WATCH_SET_ATLAS,
});
const VANILLA_SET = editorVanillaSet(VANILLA, MAP).set;

/** ⛓ The mount's REPORT over a set, with the page's compile; also returns its identity hooks. */
const reportFor = (set, lab = labSetIdentity({ compileRegionAtlas, stampAtlasIdentity })) => {
    const session = createSetSession(createSeedlingSetAdapter(DEPS), setRecord(set, emptyOverlay()),
        { base: { kind: 'set', set_id: set.set_id } });
    const rep = reportOf(session, DEPS, { compileRegionAtlas: lab.compileRegionAtlas, validateRegionAtlas });
    return { rep, lab, id: rep.rules?.region_atlas?.['1']?.atlas_id };
};
const VAN = reportFor(VANILLA_SET);

/** ⛓ Edits that do NOT reach the derived atlas: one tile, one tree (the study's p5 edit). */
const withTile = () => {
    const s = structuredClone(VANILLA_SET);
    const tiles = s.rooms[10].source.record.layers[0].tiles;
    tiles[0] = [tiles[0][0], tiles[0][1], tiles[0][2] === 48 ? 0 : 48, tiles[0][3]];
    return s;
};
const withTree = () => {
    const s = structuredClone(VANILLA_SET);
    s.rooms[10].source.record.entities.push({ type: 'tree', x: 16, y: 80 });
    return s;
};

describe('⛓⛓ the GAME: one Seedling constant, read by both labs', () => {
    it('`SEEDLING_ATLAS_GAME` is ONE binding: the maze lab re-exports the derivation\'s, and it slugs to the player\'s substrate', () => {
        expect(MAZE_LAB_SEEDLING_GAME).toBe(SEEDLING_ATLAS_GAME);
        expect(substrateIdFor(SEEDLING_ATLAS_GAME)).toBe(FLASH_SEEDLING_ENTRY.id);
        expect(WATCH_SET_ATLAS.game).toBe(SEEDLING_ATLAS_GAME);
    });
    it('the map-document LABEL is separate from the game, and is not a document the player can fetch', () => {
        expect(WATCH_SET_ATLAS.mapDocument).toBe('watch.html set editor');
        expect(WATCH_SET_ATLAS.mapDocument).not.toBe('seedling-map.json');
    });
});

describe('⛓⛓⛓ the page\'s deps over the vanilla 116: Seedling rooms, its own atlas id, no flash_panel', () => {
    it('the export is allowed, and EVERY room\'s substrate is `flash_seedling`', () => {
        expect(VAN.rep.download.rules.allowed).toBe(true);
        const rows = Object.values(VAN.rep.rules.preset_sidecars?.['1'] ?? {});
        expect(rows.length).toBe(VAN.rep.atlas.regions.length);
        expect(rows.length).toBeGreaterThan(100);
        expect(new Set(rows.map((r) => r.substrate))).toEqual(new Set([FLASH_SEEDLING_ENTRY.id]));
    });
    it('the rules carry NO `flash_panel` block (nothing pretends to play)', () => {
        expect(VAN.rep.rules).not.toHaveProperty('flash_panel');
    });
    it('`region_atlas[1]` names Seedling, a `seedling-lab-<8 hex>` id and the page\'s label, and every sidecar points at that id', () => {
        expect(VAN.rep.rules.region_atlas['1']).toEqual({
            atlas_id: VAN.id, game: SEEDLING_ATLAS_GAME, map_document: WATCH_SET_ATLAS.mapDocument,
        });
        expect(VAN.id).toMatch(new RegExp(`^${LAB_SET_ATLAS_BASE}-[0-9a-f]{8}$`));
        const refs = new Set(Object.values(VAN.rep.rules.preset_sidecars['1']).map((r) => r.playable_payload.atlas_ref));
        expect([...refs]).toEqual([VAN.id]);
    });
    it('the REPORT\'s own atlas stays deliberately unstamped (§19.10 hard #1); only the door\'s copy is stamped', () => {
        expect(VAN.rep.atlas.provenance?.content_hash).toBeUndefined();
        expect(VAN.rep.atlas.atlas_id).toBe(SEEDLING_ATLAS_GAME);
    });
});

describe('⛓⛓⛓ the FINGERPRINT: the same set keeps its id, a different set gets its own', () => {
    it('the same set twice → ONE id (two fresh sessions, two fresh hooks)', () => {
        expect(reportFor(structuredClone(VANILLA_SET)).id).toBe(VAN.id);
    });
    it('one tile changed → a DIFFERENT id, and one tree added → a third', () => {
        const tile = reportFor(withTile()).id;
        const tree = reportFor(withTree()).id;
        expect(new Set([VAN.id, tile, tree]).size).toBe(3);
    });
    it('…which needs the rooms\' fingerprint: the derived atlas alone does NOT see those edits', () => {
        const bare = (set) => stampAtlasIdentity(structuredClone(reportFor(set).rep.atlas), LAB_SET_ATLAS_BASE).atlas_id;
        expect(new Set([bare(VANILLA_SET), bare(withTile()), bare(withTree())]).size).toBe(1);
        expect(VAN.lab.atlasAtDoor(VAN.rep.atlas, VAN.rep.rules).tile_space.map_source)
            .toMatch(new RegExp(`^${LAB_SET_ROOMS_SOURCE}-[0-9a-f]{8}$`));
    });
    it('NO lab id is served: the vanilla set and both edited sets', () => {
        for (const id of [VAN.id, reportFor(withTile()).id, reportFor(withTree()).id]) {
            expect(SERVED.has(id), id).toBe(false);
        }
        expect(SERVED.size).toBeGreaterThan(0);
        for (const id of SERVED) expect(id.startsWith(`${LAB_SET_ATLAS_BASE}-`), id).toBe(false);
    });
    it('(documentation) the unedited vanilla set would not hit a served id with base `seedling` either', () => {
        const asSeedling = stampAtlasIdentity(
            VAN.lab.atlasAtDoor(VAN.rep.atlas, VAN.rep.rules), SEEDLING_ATLAS_GAME).atlas_id;
        expect(asSeedling).toMatch(/^seedling-[0-9a-f]{8}$/);
        expect(SERVED.has(asSeedling)).toBe(false);
    });
});

describe('⛓⛓ the BUNDLE door: the atlas member is the atlas the rules were compiled from', () => {
    it('`atlasAtDoor` returns that stamped copy: the id the rules name, a valid content hash, the report\'s regions', () => {
        const member = VAN.lab.atlasAtDoor(VAN.rep.atlas, VAN.rep.rules);
        expect(member.atlas_id).toBe(VAN.id);
        expect(member.regions).toEqual(VAN.rep.atlas.regions);
        const v = validateRegionAtlas(member);
        expect(v.errors).toEqual([]);
        expect(v.warnings.filter((w) => /content_hash/.test(w))).toEqual([]);
    });
    it('it mutates neither the report\'s atlas nor its rules', () => {
        const before = JSON.stringify([VAN.rep.atlas, VAN.rep.rules]);
        VAN.lab.atlasAtDoor(VAN.rep.atlas, VAN.rep.rules);
        expect(JSON.stringify([VAN.rep.atlas, VAN.rep.rules])).toBe(before);
    });
    it('it REFUSES by name rules no compile here made, and an atlas that is not theirs', () => {
        const other = reportFor(withTree());
        expect(() => VAN.lab.atlasAtDoor(other.rep.atlas, other.rep.rules)).toThrow(/no compile on this page made/);
        const moved = structuredClone(VAN.rep.atlas);
        moved.regions.pop();
        expect(() => VAN.lab.atlasAtDoor(moved, VAN.rep.rules)).toThrow(/does not match the report/);
        expect(() => VAN.lab.atlasAtDoor(VAN.rep.atlas, { region_atlas: {} })).toThrow(/not one/);
    });
    it('the stamp REFUSES a compile handed no rooms, rather than fingerprinting the atlas alone', () => {
        expect(() => VAN.lab.compileRegionAtlas(VAN.rep.atlas, {})).toThrow(/handed no `mapDoc.levels`/);
    });
});
