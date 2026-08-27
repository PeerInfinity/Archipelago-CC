// frontend/modules/seedlingDemo/worldChain.test.js
/**
 * ⛓⛓⛓ **THE CHAIN — A MIXED WORLD, END TO END, OVER BOTH REAL ADAPTERS.**
 *
 * EDITOR INTEGRATION slice W2 (`NewDocs/plans/editor-integration.md` §2.2, item 5
 * of the slice's work list).
 *
 * ⛔ **THIS FILE LIVES UNDER `seedlingDemo/` BECAUSE IT IMPORTS BOTH SUBSTRATES,
 * AND `procgenCore/` MAY NOT.** `bindingContract.test.js` reads
 * `procgenCore/`'s directory and refuses any SHIPPING module there that imports
 * `seedlingDemo/`, `mazeRoom/` or `flashPanel/` — so the three world modules
 * take their substrate halves INJECTED and this is the one place the real two
 * are plugged in. `worldDocument.test.js`, `worldDerivation.test.js` and
 * `worldSetAdapter.test.js` do the same work over toys.
 *
 * ⛓ **EVERY DOCUMENT IS GENERATED OR COMMITTED, NONE TYPED.** The Seedling half
 * is `buildLevelSet({link: true})` over two `emptyLevel` rooms; the maze half is
 * the first two entries of the committed `frontend/region-libraries/
 * demo-maze-pack.json`, which predates this slice by arcs.
 *
 * The walk: two set documents → a WORLD over both → a cross-part `connect` →
 * `deriveWorldAtlas` → `validateRegionAtlas` (+schema) → `compileRegionAtlas`
 * with the maze row's `gridFor` bound to the library → `rulesJsonSchemaErrors`
 * → `report.substrates` → `reachableRegions` → `buildWarehouse` → undo ×N. Then
 * the NEGATIVE: the same world with the crossing removed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { canonicalJson, createEditSession } from '../procgenCore/editCore.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadAtlasSchema, loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { reportOver, roomRowsOf } from '../procgenCore/setEditorCore.js';
import { emptyWorld } from '../procgenCore/worldDocument.js';
import {
    deriveWorldAtlasOf, partOfRegion, worldRulesJsonOf,
} from '../procgenCore/worldDerivation.js';
import {
    createWorldSetAdapter, validateWorldForDownload, worldAdapterFns, worldRecord,
} from '../procgenCore/worldSetAdapter.js';
import { compileRegionAtlas, substrateIdFor } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { buildWarehouse } from '../procgenPlayer/procgenPlayerEngine.js';
import { substrateRegistryEntry as FLASH_SEEDLING_ENTRY } from '../flashPanel/flashSeedlingLibrary.js';
import { resolveCrossingExit } from '../flashPanel/seedlingRegionBinding.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { tileGridDeserializer } from '../shared/procgen/adapterPrimitives.js';
import {
    MAZE_CONDITION_DEPS, emptyMazeOverlay, mazeGridFor,
} from '../mazeRoom/mazeAtlasDerivation.js';
import * as maze from '../mazeRoom/mazeSetAdapter.js';
import { LevelSetExitError } from './levelSetExits.js';
import { buildLevelSet } from './levelSetExporter.js';
import { emptyLevel } from './procgenLevel.js';
import { parseOelLevel } from './procgenLevelOel.js';
import * as seed from './seedlingSetAdapter.js';
import {
    SeedlingSetOverlayError, emptyOverlay, exitRuleKey, locationRuleKey,
} from './seedlingSetOverlay.js';

const RULES_SCHEMA = loadRulesSchema();
const ATLAS_SCHEMA = loadAtlasSchema();
const PACK = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../region-libraries/demo-maze-pack.json', import.meta.url)), 'utf8',
));

const TILE = 16;
const SEED_DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE,
    tileTypeForPlacement,
    rulesSchema: RULES_SCHEMA,
    atlas: { game: 'seedling', mapDocument: 'w2-world-set.json' },
});
const PART_DEPS = Object.freeze({ seed: SEED_DEPS, mz: {} });

const seedAdapter = seed.createSeedlingSetAdapter(SEED_DEPS);
const mazeAdapter = maze.createMazeSetAdapter({ rulesSchema: RULES_SCHEMA });

/**
 * ⛓ The four refusal classes `seedlingSetAdapter.apply` catches, composed from
 * the CLASSES rather than from their names — the same list `watchSetEditor.js`
 * spells for the page, and a class one reader named and the other did not is a
 * data condition that crashes on one path and is a row on the other.
 */
const isSeedlingRefusal = (e) => [
    seed.SeedlingSetAdapterError, seed.SeedlingSetDeriveRefusal,
    SeedlingSetOverlayError, LevelSetExitError,
].some((Klass) => e instanceof Klass);

/** ⛓ THE TWO PART DESCRIPTORS — every substrate half, as a parameter. */
const SEED_PART = Object.freeze({
    id: 'seed',
    kind: 'level-set',
    adapter: seedAdapter,
    opKinds: seed.SET_OP_KINDS,
    recordOf: (set, overlay) => seed.setRecord(set, overlay),
    splitRecord: (record) => ({ doc: record.set, overlay: record.overlay }),
    readSetCell: seed.readSetCell,
    exitsOfRoom: seed.exitsOfRoom,
    whatLinksHere: seed.whatLinksHere,
    bounds: seedAdapter.bounds,
    isRefusal: isSeedlingRefusal,
    /**
     * ⛓⛓ **THE SUBSTRATE READER NEEDED NO EXPORT FROM EITHER ADAPTER.** A
     * Seedling room's substrate is `substrateIdFor(atlas.game)` — the value W1
     * made `seedlingAtlasDerivation` write onto every region, derived from the
     * SAME dep the derivation reads, never the literal `'flash_seedling'`
     * (§7.1 #2: the literal is a mutant that reds 4 rows over a generated set).
     */
    substrateOfRoom: () => substrateIdFor(SEED_DEPS.atlas.game),
    validateForDownload: seed.validateForDownload,
    deriveAtlasOf: seed.deriveAtlasOf,
    closeRoomSession: seed.closeRoomSession,
});

const MAZE_PART = Object.freeze({
    id: 'mz',
    kind: 'region-library',
    adapter: mazeAdapter,
    opKinds: maze.SET_OP_KINDS,
    recordOf: (library, overlay) => maze.setRecord(library, overlay),
    splitRecord: (record) => ({ doc: record.library, overlay: record.overlay }),
    readSetCell: maze.readSetCell,
    exitsOfRoom: maze.exitsOfRoom,
    whatLinksHere: maze.whatLinksHere,
    bounds: mazeAdapter.bounds,
    isRefusal: maze.isMazeSetRefusal,
    /** ⛓ …and the maze's is the ENTRY's own field, per room. */
    substrateOfRoom: (record, room) => record.library.entries[room].substrate,
    validateForDownload: maze.validateForDownload,
    deriveAtlasOf: maze.deriveAtlasOf,
    closeRoomSession: maze.closeRoomSession,
});

const PARTS = Object.freeze([SEED_PART, MAZE_PART]);
const adapter = () => createWorldSetAdapter({ parts: PARTS });

/** ⛓ Two generated Seedling rooms, wired by the exporter's own linker. */
const seedlingSet = () => buildLevelSet(
    [0, 1].map((level) => emptyLevel({ level })), { setId: 'w2-world', link: true },
).set;

/** ⛓ …and the first two entries of the COMMITTED demo pack. */
const mazeLibrary = () => JSON.parse(JSON.stringify({ ...PACK, entries: PACK.entries.slice(0, 2) }));

const baseRecord = () => worldRecord(
    emptyWorld([
        { id: 'seed', kind: 'level-set', overlay: emptyOverlay(), substrate: 'flash_seedling' },
        { id: 'mz', kind: 'region-library', overlay: emptyMazeOverlay(), substrate: 'maze' },
    ]),
    { seed: seedlingSet(), mz: mazeLibrary() },
);

/**
 * ⛓ THE CROSSING: the Seedling room-1 teleporter's own derived boundary exit,
 * into the maze entry 0's **W** side. ⛔ Both endpoint spellings are the
 * DERIVED ATLAS ids, which is what a world link names.
 */
const CROSSING = Object.freeze({
    op: 'connect',
    from: { part: 'seed', room: 1, exit: 'out_teleporter_128_128' },
    to: { part: 'mz', room: 0, exit: 'exit_3' },
    one_way: true,
});
/** ⛓ …and the maze part's own ring, in ITS array form (global rooms 2 and 3). */
const MAZE_RING = Object.freeze({ op: 'connect', from: [2, 'exit_1'], to: [3, 'exit_3'] });

function session({ crossing = true } = {}) {
    const record = baseRecord();
    const s = createEditSession(adapter(), record);
    const go = (op) => {
        const r = s.apply(op);
        if (!r.ok) throw new Error(`the fixture's own op was refused: ${r.description}`);
    };
    go(MAZE_RING);
    if (crossing) go(CROSSING);
    return { base: record, s };
}

const gridFor = (region) => {
    if (partOfRegion(region.region_id) !== 'mz') return null;
    const entry = mazeLibrary().entries[region.map_ref];
    return entry ? mazeGridFor(entry.payload) : null;
};
const COMPILE_OPTIONS = { mazeProjection: { ...MAZE_CONDITION_DEPS, gridFor } };

const rulesOf = (s) => worldRulesJsonOf(s, PART_DEPS, {
    compileRegionAtlas, parts: PARTS, gameName: 'W2 World', compileOptions: COMPILE_OPTIONS,
});

/* ══════════════════════════════════════════════════════════════════════
 * THE SESSION
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ a world over a Seedling SET and a maze LIBRARY', () => {
    it('the strip is four rooms and every one names the substrate that PLAYS it', () => {
        const { s } = session();
        const a = adapter();
        expect(a.bounds(s.record())).toEqual({ w: 4, h: 1 });
        expect([0, 1, 2, 3].map((i) => a.readCell(s.record(), i, 0).substrate))
            .toEqual(['flash_seedling', 'flash_seedling', 'maze', 'maze']);
        expect([0, 1, 2, 3].map((i) => a.readCell(s.record(), i, 0).part))
            .toEqual(['seed', 'seed', 'mz', 'mz']);
        // ⛓ the core's rows take the composite's fns unchanged
        const rows = roomRowsOf(s.record(), worldAdapterFns(PARTS));
        expect(rows).toHaveLength(4);
        expect(rows.map((r) => r.openable)).toEqual([true, true, true, true]);
        /**
         * ⛔ room 2 (maze entry 0) is linked from BOTH: its own part's ring
         * (two-way, so entry 1 counts as an inbound) and the WORLD's crossing
         * from the Seedling part — which no part can see. ⛓ Without the
         * crossing it is 1, and that difference is the claim.
         */
        expect(rows[2].linkedFrom).toBe(2);
        const noCross = roomRowsOf(session({ crossing: false }).s.record(), worldAdapterFns(PARTS));
        expect(noCross[2].linkedFrom).toBe(1);
    });

    it('the maze ring went to the PART and the crossing went to the WORLD', () => {
        const { s } = session();
        expect(s.record().world.links)
            .toEqual([{ from: CROSSING.from, to: CROSSING.to, one_way: true }]);
        // the ring is in the maze part's own overlay, inside the world document
        expect(s.record().world.overlays.mz.links)
            .toEqual([{ from: [0, 'exit_1'], to: [1, 'exit_3'], one_way: false }]);
        // …and the Seedling half's document was not touched by either
        expect(canonicalJson(s.record().parts.seed)).toBe(canonicalJson(seedlingSet()));
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE CHAIN
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ THE CHAIN — derive, validate, compile, reach, warehouse', () => {
    it('the merged atlas is namespaced, carries both substrates, and VALIDATES', () => {
        const { s } = session();
        const { atlas, notes, displaced, stats } = deriveWorldAtlasOf(s.record(),
            { parts: PARTS, deps: PART_DEPS });
        expect(atlas.regions.map((r) => r.region_id))
            .toEqual(['seed.level_0', 'seed.level_1', 'mz.mz_cross', 'mz.mz_hub']);
        expect(atlas.regions.map((r) => r.substrate))
            .toEqual(['flash_seedling', 'flash_seedling', 'maze', 'maze']);
        expect(stats.substrates).toEqual({ flash_seedling: 2, maze: 2 });
        expect(atlas.game).toBe('seedling');
        const v = validateRegionAtlas(atlas, { schema: ATLAS_SCHEMA });
        expect(v.errors).toEqual([]);
        expect(v.ok).toBe(true);

        /**
         * ⛔⛔ **THE TWO MEASUREMENTS, AS THE NOTES THE MERGE ACTUALLY EMITS.**
         * The parts really do disagree about `tile_size` (16 vs 1), and the
         * crossing really does land on a door the Seedling set already wired —
         * because a generated Seedling set has NO spare exit.
         */
        expect(notes.join(' ')).toMatch(/disagree about `tile_space\.tile_size` \(seed: 16, mz: 1\)/);
        expect(atlas.tile_space.tile_size).toBe(TILE);
        expect(displaced).toEqual([{
            link: 0, region: 'seed.level_1', exit: 'out_teleporter_128_128',
            was: ['seed.level_0', 'in_L1_128_128'],
        }]);
        expect(notes.join(' ')).toMatch(/DISPLACED the part-internal connection/);
    });

    it('compiles to a schema-valid rules.json whose SUBSTRATES are two', () => {
        const { s } = session();
        const { rules, report } = rulesOf(s);
        expect(rulesJsonSchemaErrors(rules, RULES_SCHEMA)).toEqual([]);
        // ⛔ THE SLICE'S HEADLINE NUMBER — counted off the EMITTED sidecars (W1).
        expect(report.substrates).toEqual({ flash_seedling: 2, maze: 2 });
        expect(Object.keys(rules.preset_sidecars['1']).sort())
            .toEqual(['mz.mz_cross', 'mz.mz_hub', 'seed.level_0', 'seed.level_1']);
        // ⛓ the two payloads are the two BUILDERS' own shapes, not one label twice
        expect(rules.preset_sidecars['1']['seed.level_0'].playable_payload)
            .toHaveProperty('exits');
        expect(rules.preset_sidecars['1']['mz.mz_cross'].playable_payload)
            .toHaveProperty('tiles');
        // ⛓ ANY flash region means the flashPanel wiring ships (W1 §7.2)
        expect(rules.flash_panel).toBeTruthy();
        // ⛓ the freed far endpoint really is unwired, and the report names it
        expect(report.unwired_exits.map((u) => `${u.region_id}/${u.exit_id}`))
            .toContain('seed.level_0/in_L1_128_128');
    });

    it('every one of the four regions is REACHABLE from the Seedling start', () => {
        const { s } = session();
        const { rules } = rulesOf(s);
        const all = Object.keys(regionsOf(rules, '1'));
        const reached = reachableRegions(rules, '1');
        expect(all.filter((n) => !reached.has(n))).toEqual([]);
        expect(all.sort()).toEqual(['Menu', 'mz.mz_cross', 'mz.mz_hub', 'seed.level_0', 'seed.level_1']);
        expect(rules.start_regions['1'].default).toEqual(['Menu']);
    });

    /**
     * ⛓⛓⛓ **THE PLAYER'S WAREHOUSE HOLDS TWO SUBSTRATES.**
     *
     * ⛔ The registry is INJECTED — `buildWarehouse`'s third parameter — and its
     * two entries are the real ones: `flash_seedling`'s whole
     * `substrateRegistryEntry`, and the maze's `deserializeWorld`, which is the
     * `tileGridDeserializer` that `mazeRoomLibrary.js:135` composes its entry
     * from. ⚠ Both libraries are `loadable: true` in the GENERATED registry
     * (`procgenDocs/generated/registry.js`), which is what says a node process
     * may import them at all; the maze's is composed from its primitive here
     * rather than imported, because that module registers a PANEL as a side
     * effect of being loaded.
     */
    it('`buildWarehouse` holds all four regions across BOTH substrates', () => {
        const { s } = session();
        const { rules } = rulesOf(s);
        const registry = new Map([
            [FLASH_SEEDLING_ENTRY.id, FLASH_SEEDLING_ENTRY],
            ['maze', { id: 'maze', loadRegionEvent: 'maze:loadRegion', deserializeWorld: tileGridDeserializer }],
        ]);
        const warehouse = buildWarehouse(rules, '1', registry);
        expect(warehouse.size()).toBe(4);
        expect(warehouse.keys().sort())
            .toEqual(['mz.mz_cross', 'mz.mz_hub', 'seed.level_0', 'seed.level_1']);
        const bySubstrate = warehouse.keys().map((k) => warehouse.get(k).substrate);
        expect(new Set(bySubstrate)).toEqual(new Set(['flash_seedling', 'maze']));
        // ⛔ NOT VACUOUS — every region really deserialised, and the two
        //   substrates route to DIFFERENT load events.
        for (const key of warehouse.keys()) expect(warehouse.get(key).world).toBeTruthy();
        expect(new Set(warehouse.keys().map((k) => warehouse.get(k).loadRegionEvent)).size).toBe(2);
    });

    /**
     * ⛓⛓⛓ **THE CROSS-PART DOOR IS MARKED, AND THAT IS WHAT UN-COLLIDES THE
     * TWO EXITS OF `seed.level_1`** (EDITOR INTEGRATION W6 / plan §11.1 A3).
     *
     * ⛔ **THE PRE-FIX MEASUREMENT, WHICH IS WHAT THIS ROW IS FOR.** This exact
     * world used to compile `seed.level_1` with TWO exits both claiming
     * `target_level: 0`:
     *
     *   in_L0_128_128          target_level 0   target_spawn {128,128}  (real: seed.level_0)
     *   out_teleporter_128_128 target_level 0   target_spawn {0,96}     (a LIE: mz.mz_cross's
     *                                                                   map_ref is a LIBRARY
     *                                                                   ENTRY INDEX)
     *
     * so `resolveCrossingExit(world, 0, spawn)` took its two-candidate branch and
     * tie-broke on distance — and a player who walked back to Seedling level 0
     * landing anywhere nearer `{0,96}` resolved to the MAZE door. Both halves are
     * asserted below: the compiled field, and the resolution it fixes.
     *
     * ⚠ `target_spawn` was junk on that exit for a second reason worth naming —
     * the maze entrance tile times the START part's `tile_size` 16, on a part
     * whose own `tile_size` is 1 (§8.6). It is null now for both reasons at once.
     */
    it('the cross-part exit is EXTERNAL, and the same-part one still carries a real level', () => {
        const { s } = session();
        const { rules, report } = rulesOf(s);
        const exits = rules.preset_sidecars['1']['seed.level_1'].playable_payload.exits;
        const crossing = exits.find((e) => e.exit_id === 'out_teleporter_128_128');
        const samePart = exits.find((e) => e.exit_id === 'in_L0_128_128');

        expect(crossing.targetRegion).toBe('mz.mz_cross');
        expect(crossing.external).toBe(true);
        expect(crossing.target_substrate).toBe('maze');
        expect(crossing.target_level).toBeNull();
        expect(crossing.target_spawn).toBeNull();

        // ⛔ THE CONTROL, in the SAME payload: the part-internal door is
        // untouched, so this is not "the compiler nulled everything".
        expect(samePart.target_level).toBe(0);
        expect(samePart.target_spawn).toEqual({ x: 128, y: 128 });
        expect('external' in samePart).toBe(false);

        // ⛓ …and the SOURCE room's own outbound door, one region over, is
        // ordinary too — one exit in this whole world crosses.
        const level0 = rules.preset_sidecars['1']['seed.level_0'].playable_payload.exits;
        expect(level0.every((e) => !('external' in e))).toBe(true);
        expect(report.external_exits).toBe(1);
    });

    /**
     * ⛔⛔ **THE DEFECT ITSELF, THROUGH THE REAL HOST FILTER.** `resolveCrossingExit`
     * filters on `e.target_level === level`; `null !== 0` drops the external exit
     * by construction, with no edit to the binding. Both spawns now resolve to
     * the ONE real candidate — pre-fix the second resolved to the maze door.
     */
    it('`resolveCrossingExit` no longer mis-resolves a return to level 0', () => {
        const { s } = session();
        const { rules } = rulesOf(s);
        const world = { exits: rules.preset_sidecars['1']['seed.level_1'].playable_payload.exits };
        // the spawn beside the SEEDLING entrance, and the one beside the MAZE's
        for (const spawn of [{ x: 128, y: 128 }, { x: 0, y: 96 }]) {
            expect(resolveCrossingExit(world, 0, spawn).exit_id).toBe('in_L0_128_128');
        }
        // ⛓ NOT VACUOUS — there really are two exits, and one really does reach
        // a region; the filter is what excludes it, not an empty list.
        expect(world.exits).toHaveLength(2);
        expect(world.exits.filter((e) => e.targetRegion !== null)).toHaveLength(1);
    });

    it('undo ×N and the world equals its base — the whole session unwinds', () => {
        const { base, s } = session();
        expect(adapter().equal(s.record(), base)).toBe(false);
        while (s.undo());
        expect(adapter().equal(s.record(), base)).toBe(true);
        expect(canonicalJson(s.record())).toBe(canonicalJson(base));
    });

    it('`validateWorldForDownload` runs both substrates\' own validators', () => {
        const { s } = session();
        const check = validateWorldForDownload(s, PARTS);
        expect(check.errors).toEqual([]);
        expect(check.ok).toBe(true);
        // ⛓ each part's own validator really ran and stamped its own document
        expect(check.parts.seed.set_id).toMatch(/^w2-world/);
        expect(check.parts.mz.library_id).toMatch(/^demo-maze-pack/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛔ THE NEGATIVE — the control for every row above
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛔ THE ISLAND — the same world with the crossing removed', () => {
    it('the maze part falls out of reach, and the REPORT names every region of it', () => {
        const { s } = session({ crossing: false });
        expect(s.record().world.links).toEqual([]);
        const { rules, report } = rulesOf(s);
        // ⛓ the compile is unchanged in every other respect — same four regions,
        //   same two substrates. Only the graph moved.
        expect(report.substrates).toEqual({ flash_seedling: 2, maze: 2 });
        expect(rulesJsonSchemaErrors(rules, RULES_SCHEMA)).toEqual([]);
        const all = Object.keys(regionsOf(rules, '1'));
        const reached = reachableRegions(rules, '1');
        expect(all.filter((n) => !reached.has(n)).sort()).toEqual(['mz.mz_cross', 'mz.mz_hub']);

        /**
         * ⛓⛓ …and the REPORT is what a person sees. `reportOver` binds the
         * composite exactly as it binds either single-substrate adapter.
         *
         * ⚠ `ruleKeys` is the Seedling overlay's pair and is INERT here, which
         * is W2's measurement 4 said out loud: a world's record has no `overlay`
         * half — its parts' overlays live inside the world document, keyed by
         * part — so `inertRulesOf` and `overlayLocationCount` both read nothing
         * and the inert-rule row does not fire. Making those two rows per-part
         * is W4's page work; a world REPORT that claimed "every authored rule
         * gates something" over an overlay it never looked at would be a true
         * sentence about the wrong subject.
         */
        const rep = reportOver({
            session: s,
            deps: PART_DEPS,
            adapterFns: {
                ...worldAdapterFns(PARTS),
                validateForDownload: (sess) => validateWorldForDownload(sess, PARTS),
                deriveAtlasOf: (record, deps) => deriveWorldAtlasOf(record, { parts: PARTS, deps }),
                rulesJsonOf: (sess, deps, o) => worldRulesJsonOf(sess, deps, {
                    ...o, parts: PARTS, gameName: 'W2 World', compileOptions: COMPILE_OPTIONS,
                }),
            },
            document: {
                kind: 'world',
                noun: 'world',
                validator: 'validateWorldForDownload',
                idOf: (c) => c.world_id ?? '(unstamped)',
            },
            ruleKeys: { exit: exitRuleKey, location: locationRuleKey },
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: ATLAS_SCHEMA,
        });
        const islands = rep.rows.filter((r) => r.kind === 'reach' && r.severity === 'error');
        expect(islands.map((r) => r.text.match(/region "([^"]+)"/)[1]).sort())
            .toEqual(['mz.mz_cross', 'mz.mz_hub']);
        expect(rep.download.rules.allowed).toBe(false);
        expect(rep.download.rules.why).toMatch(/2 region\(s\) \(mz\.mz_cross, mz\.mz_hub\) cannot be reached/);
        // ⛓ section 1 called the document by the WORLD's own noun and validator
        expect(rep.rows.some((r) => r.kind === 'world')).toBe(true);
    });

    /** ⛔ …and the positive control, so the row above is a DIFFERENCE. */
    it('with the crossing back, nothing is unreachable and the export is allowed', () => {
        const { s } = session();
        const rep = reportOver({
            session: s,
            deps: PART_DEPS,
            adapterFns: {
                ...worldAdapterFns(PARTS),
                validateForDownload: (sess) => validateWorldForDownload(sess, PARTS),
                deriveAtlasOf: (record, deps) => deriveWorldAtlasOf(record, { parts: PARTS, deps }),
                rulesJsonOf: (sess, deps, o) => worldRulesJsonOf(sess, deps, {
                    ...o, parts: PARTS, gameName: 'W2 World', compileOptions: COMPILE_OPTIONS,
                }),
            },
            document: {
                kind: 'world', noun: 'world', validator: 'validateWorldForDownload',
                idOf: (c) => c.world_id ?? '(unstamped)',
            },
            ruleKeys: { exit: exitRuleKey, location: locationRuleKey },
            compileRegionAtlas,
            validateRegionAtlas,
            atlasSchema: ATLAS_SCHEMA,
        });
        expect(rep.rows.filter((r) => r.kind === 'reach' && r.severity === 'error')).toEqual([]);
        expect(rep.download.rules.allowed).toBe(true);
        expect(rep.report.substrates).toEqual({ flash_seedling: 2, maze: 2 });
    });
});
