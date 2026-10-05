/**
 * seedlingSetPatches — seedling fidelity MOONROCK, D2: the delivered set's
 * record patches, the table the delivery carries, and where it applies.
 *
 * ⚖ The user (2026-10-04): the moonrock event never fires on the delivered set.
 * The L110 repoint the same ruling approved is NOT in the table — the game
 * measured it sending the fall to L0 (`seedlingSetPatches.js`' header,
 * `fidelityMoonrock.test.js`) — so its two candidates are pinned here as
 * NAMED, UNAPPLIED patches whose arithmetic is right.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    PATCH_L110_FALL_OFF_STAIRS,
    PATCH_L110_FALL_TO_L2,
    PATCH_MOONROCK_REMOVED,
    SEEDLING_SET_PATCHES,
    SET_PATCH_IDS,
    SetPatchError,
    applySetPatches,
    patchedMapDocument,
} from './seedlingSetPatches.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { buildLevelWorld } from './levelWorld.js';
import { fallDestination } from './playerPhysicsV2.js';
import { buildPlacementTable, rewriteRecordSet } from './apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import {
    buildAtlasCheckTable, itemOfEntityFrom, propertyLocationOfFrom,
} from './seedlingAtlasCheckTable.js';
import { PICKUP_CLEARS_OPTIONAL_TAG, tagOf } from './levelWorld.js';
import { placementTagId } from './procgenSeedling.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG, VICTORY_ITEM } from './seedlingAtlasDerivation.js';
import { placementKey } from './apPlacementRewriter.js';

const text = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const json = (rel) => JSON.parse(text(rel));
const MAP_TEXT = text('../flashPanel/atlases/seedling-map.json');
const MAP = () => JSON.parse(MAP_TEXT);
const EMBED = json('./fixtures/seedling-vanilla-set.json');
const rulesOf = (id) => json(`../../presets/${id}/AP_1/AP_1_rules.json`);

const moonrocksIn = (record) => record.entities.filter((e) => e.type === 'moonrock');
const controlIn = (record) => record.entities.find((e) => e.type === 'control');

describe('the table the delivery carries', () => {
    it('is the moonrock removal ONLY — the L110 repoint is stopped, its two candidates unapplied', () => {
        expect(SEEDLING_SET_PATCHES.map((p) => p.id)).toEqual([SET_PATCH_IDS.moonrockRemoved]);
        expect(SEEDLING_SET_PATCHES).not.toContain(PATCH_L110_FALL_TO_L2);
        expect(SEEDLING_SET_PATCHES).not.toContain(PATCH_L110_FALL_OFF_STAIRS);
        expect(Object.isFrozen(SEEDLING_SET_PATCHES)).toBe(true);
    });

    it('L0 loses its moonrock and nothing else; L110 keeps vanilla\'s control', () => {
        const map = MAP();
        const out = applySetPatches(map.levels);
        expect(moonrocksIn(map.levels[0])).toEqual([{ type: 'moonrock', x: 240, y: 256, attrs: { tag: '0' } }]);
        expect(moonrocksIn(out[0])).toEqual([]);
        expect(out[0].entities).toEqual(map.levels[0].entities.filter((e) => e.type !== 'moonrock'));
        expect(out[0].entities).toHaveLength(map.levels[0].entities.length - 1);
        // L0's stairs down to L2 (48,32) stay, and L2 still holds its pile entity (it appears only on {2,0})
        expect(out[0].entities).toContainEqual(expect.objectContaining({ type: 'stairsdown', x: 256, y: 272,
            attrs: expect.objectContaining({ to: '2', playerx: '48', playery: '32' }) }));
        expect(out[2]).toBe(map.levels[2]);
        expect(controlIn(out[110]).attrs).toEqual({ fallthrough: '0', xOff: '-256', yOff: '-272' });
        // every other record is the input's own object
        out.forEach((r, i) => { if (i !== 0) expect(r).toBe(map.levels[i]); });
    });

    it('the input is not mutated, and the map file is not touched', () => {
        const map = MAP();
        applySetPatches(map.levels);
        patchedMapDocument(map);
        expect(JSON.stringify(map)).toBe(JSON.stringify(JSON.parse(MAP_TEXT)));
        expect(moonrocksIn(map.levels[0])).toHaveLength(1);
    });

    it('is IDEMPOTENT — a patched document patches to itself', () => {
        const once = applySetPatches(MAP().levels);
        const twice = applySetPatches(once);
        expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
        const all = [...SEEDLING_SET_PATCHES, PATCH_L110_FALL_TO_L2];
        const a = applySetPatches(MAP().levels, all);
        expect(JSON.stringify(applySetPatches(a, all))).toBe(JSON.stringify(a));
    });

    it('REFUSES BY NAME when the extract moved under a patch', () => {
        const moved = MAP();
        moved.levels[0].entities = moved.levels[0].entities.map((e) => (e.type === 'moonrock'
            ? { ...e, attrs: { tag: '7' } } : e));
        expect(() => applySetPatches(moved.levels)).toThrow(SetPatchError);
        expect(() => applySetPatches(moved.levels)).toThrow(/moonrock-removed — level 0 holds a moonrock@240,256 that is not/);
        const noL0 = MAP().levels.filter((r) => r.level !== 0);
        expect(() => applySetPatches(noL0)).toThrow(/0 record\(s\) for level 0/);
        const otherControl = MAP();
        controlIn(otherControl.levels[110]).attrs = { fallthrough: '5', xOff: '0', yOff: '0' };
        expect(() => applySetPatches(otherControl.levels, [PATCH_L110_FALL_TO_L2]))
            .toThrow(/l110-fall-to-l2 — level 110 holds no control@64,64/);
    });
});

describe('the two L110 repoints (NOT in the table): the arithmetic of `checkFallingInPit`', () => {
    const pitFall = (patch) => {
        const levels = applySetPatches(MAP().levels, [patch]);
        const w = buildLevelWorld(levels[110]);
        // the room's only pit tile, every pixel the fall position can take inside it
        expect(w.pitTiles.map((t) => [t.tx, t.ty])).toEqual([[4, 4]]);
        const outs = new Set();
        for (let x = 64; x < 80; x += 1) {
            for (let y = 64; y < 80; y += 1) outs.add(JSON.stringify(fallDestination(w, { x, y })));
        }
        return { control: controlIn(levels[110]).attrs, outs: [...outs].map((s) => JSON.parse(s)) };
    };

    it('vanilla\'s control lands every pit pixel on L0\'s stairs tile (256,272)', () => {
        const w = buildLevelWorld(MAP().levels[110]);
        expect(fallDestination(w, { x: 72, y: 72 })).toEqual({ to_level: 0, ctor: { x: 256, y: 272 } });
    });

    it('the APPROVED repoint (fallthrough 2, xOff -48, yOff -32) lands every one at L2 (48,32)', () => {
        const { control, outs } = pitFall(PATCH_L110_FALL_TO_L2);
        expect(control).toEqual({ fallthrough: '2', xOff: '-48', yOff: '-32' });
        expect(outs).toEqual([{ to_level: 2, ctor: { x: 48, y: 32 } }]);
    });

    it('the OFF-STAIRS repoint (xOff -64, yOff -32) lands every one at L2 (64,32)', () => {
        const { control, outs } = pitFall(PATCH_L110_FALL_OFF_STAIRS);
        expect(control).toEqual({ fallthrough: '2', xOff: '-64', yOff: '-32' });
        expect(outs).toEqual([{ to_level: 2, ctor: { x: 64, y: 32 } }]);
    });

    it('PATCH_MOONROCK_REMOVED is the table\'s one row', () => {
        expect(SEEDLING_SET_PATCHES[0]).toBe(PATCH_MOONROCK_REMOVED);
    });
});

describe('vanillaRecordSet carries the table — the single source of the delivery', () => {
    it('by default: room 0\'s record has no moonrock, and the set says which patches it carries', () => {
        const { set, report } = vanillaRecordSet(EMBED, MAP());
        expect(moonrocksIn(set.rooms[0].source.record)).toEqual([]);
        expect(set.provenance.patches).toEqual(['moonrock-removed']);
        expect(report.patches).toEqual(['moonrock-removed']);
        expect(set.set_id).toBe('seedling-vanilla-record-329dd9d9');
    });

    it('`{patches: []}` is the unpatched vanilla, byte-identical to the pre-MOONROCK set', () => {
        const { set, report } = vanillaRecordSet(EMBED, MAP(), { patches: [] });
        expect(set.set_id).toBe('seedling-vanilla-record-1040ace1');
        expect(Object.hasOwn(set.provenance, 'patches')).toBe(false);
        expect(report.patches).toEqual([]);
        expect(moonrocksIn(set.rooms[0].source.record)).toHaveLength(1);
    });

    it('only room 0 differs between the two', () => {
        const a = vanillaRecordSet(EMBED, MAP(), { patches: [] }).set;
        const b = vanillaRecordSet(EMBED, MAP()).set;
        const differ = a.rooms.filter((r, i) => JSON.stringify(r) !== JSON.stringify(b.rooms[i])).map((r) => r.id);
        expect(differ).toEqual([0]);
    });

    it('the AP rewrite of the playthrough inherits it (the vanilla arm\'s delivery)', () => {
        const rules = rulesOf('seedling_playthrough');
        const [slot] = Object.keys(rules.regions);
        const placed = new Map();
        for (const region of Object.values(rules.regions[slot])) {
            for (const loc of region.locations ?? []) placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
        }
        const { table } = buildPlacementTable({
            locationItemOf: (n) => placed.get(n) ?? null, ledger: R7_GOAL_LEDGER, rooms: MAP().levels, selfPlayer: 1,
        });
        const { set } = rewriteRecordSet(vanillaRecordSet(EMBED, MAP()).set, table);
        const records = mountedRecordsOf(set);
        expect(moonrocksIn(records.get(0))).toEqual([]);
        expect(controlIn(records.get(110)).attrs).toEqual({ fallthrough: '0', xOff: '-256', yOff: '-272' });
    });
});

describe('where it does NOT apply', () => {
    it('a GENERATED set is built without it (seedlingGeneratedSet → buildLevelSet)', () => {
        const { set } = assembleGeneratedSeedlingSet(rulesOf('seedling_generated_room'), { selfPlayer: 1 });
        expect(Object.hasOwn(set.provenance, 'patches')).toBe(false);
        expect(set.set_id.startsWith('seedling-vanilla-record')).toBe(false);
    });

    it('the four atlas presets allocate NO retag, so the atlas arm delivers no set to them', () => {
        const ATLASES = '../flashPanel/atlases/';
        const INDEX = json(`${ATLASES}atlas_files.json`);
        const GAME = json('../flashPanel/games/seedling.json');
        const map = MAP();
        for (const id of ['seedling_atlas', 'seedling_atlas_location', 'seedling_atlas_host', 'seedling_atlas_maze']) {
            const rules = rulesOf(id);
            const file = INDEX.atlases.find((a) => a.atlas_id === rules.region_atlas.atlas_id).file;
            const byName = new Map();
            for (const r of Object.values(rules.regions['1'])) for (const l of r.locations ?? []) byName.set(l.name, l.item);
            const { retags } = buildAtlasCheckTable({
                rules, atlasDoc: json(`${ATLASES}${file}`), mapDoc: map, selfPlayer: 1,
                locationItemOf: (n) => { const it = byName.get(n); return it && typeof it.name === 'string' ? { name: it.name, player: it.player } : null; },
                placementKey, tagOf,
                itemOfEntity: itemOfEntityFrom({ itemForTag: ITEM_FOR_TAG, itemForKey: ITEM_FOR_KEY, victoryItem: VICTORY_ITEM }),
                propertyLocationOf: propertyLocationOfFrom(GAME, ITEM_FOR_TAG),
                allocateTag: placementTagId, optionalTagTypes: Object.keys(PICKUP_CLEARS_OPTIONAL_TAG),
            });
            expect(retags, id).toEqual([]);
        }
        // `seedling_atlas_sphere` names no region atlas: the atlas arm never reads it
        expect(rulesOf('seedling_atlas_sphere').region_atlas).toBeUndefined();
    });
});
