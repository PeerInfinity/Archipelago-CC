/**
 * seedlingDemo/vanillaOverlay — **THE VANILLA AUTHORED OVERLAY** (EDITOR v3
 * slice E5; plan §27.6, §34).
 *
 * ⛓⛓ WHAT IS GATED HERE, AND WHAT IS NOT.
 *
 * `scripts/procgen/make-seedling-vanilla-overlay.mjs` LIFTS the committed
 * playthrough atlas's 41 locations and 5 authored access rules into a D1
 * overlay document, and PRINTS what it cannot express. The rows below gate the
 * lift itself — that every row it writes really did go through the adapter,
 * that the entity it picked is the derivation's own answer and not the first
 * one on the tile, and that the "cannot express" census is a MEASUREMENT of the
 * atlas rather than a paragraph.
 *
 * ⛔ THE COMMITTED FIXTURE'S BYTES ARE GATED SEPARATELY, in the commit that
 * introduces it — a `--check` row here would have made the commit that writes
 * the script red until the commit that writes the fixture landed, and the
 * fixture lands on its own window.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { freeEdgesOf } from '../procgenCore/setEditorCore.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { TILE_SIZE } from './levelWorld.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { tileOf } from './seedlingAtlasDerivation.js';
import { emptyOverlay } from './seedlingSetOverlay.js';
import {
    createSeedlingSetAdapter, createSetSession, setRecord,
} from './seedlingSetAdapter.js';
import { reportOf } from './watchSetEditor.js';

const {
    buildOverlayText, cannotExpress, liftVanillaOverlay,
} = await import('../../../scripts/procgen/make-seedling-vanilla-overlay.mjs');

const ATLAS = JSON.parse(readFileSync(fileURLToPath(
    new URL('../flashPanel/atlases/seedling-playthrough.json', import.meta.url)), 'utf8'));

const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE_SIZE,
    tileTypeForPlacement,
    rulesSchema: loadRulesSchema(),
    atlas: { game: 'seedling-watch-edit', mapDocument: 'watch.html set editor' },
});

/** ⛓ ONE lift for the whole file — it parses the 116-room map extract. */
const LIFT = liftVanillaOverlay();

describe('⛓⛓ E5 — the lift, and what it put through the adapter', () => {
    it('expresses every one of the atlas\'s 41 locations and 5 authored rules, refusing none', () => {
        const atlasLocations = ATLAS.regions.flatMap((r) => r.locations ?? []);
        const atlasRules = ATLAS.regions.flatMap((r) => (r.exits ?? []).filter((e) => e.access_rule))
            .concat(atlasLocations.filter((l) => l.access_rule));
        // ⛔ THE EXPECTATIONS ARE THE ATLAS'S OWN COUNTS, not literals: a lift
        //    that lost a row would be red, and so would one written against a
        //    number that stopped being true.
        expect(atlasLocations).toHaveLength(41);
        expect(atlasRules).toHaveLength(6);

        expect(LIFT.unjoined).toEqual([]);
        expect(LIFT.refused).toEqual([]);
        expect(LIFT.expressed.filter((o) => o.op === 'mark-location'))
            .toHaveLength(atlasLocations.length);
        // ⚠ FIVE OF THE SIX. The sixth is the `level_12` exit rule pinned to a
        //   SUB-REGION, and it is in the cannot-express census by name.
        expect(LIFT.expressed.filter((o) => o.op === 'set-access-rule'))
            .toHaveLength(atlasRules.length - 1);
        expect(LIFT.cannotRules).toEqual([{
            region: 'level_12', exit_id: 'out_teleporter_32_848', sub_region: 'r0c37',
        }]);
    });

    /**
     * ⛔⛔ **THE ENTITY IS THE DERIVATION'S ANSWER, NOT THE TILE'S FIRST
     * OCCUPANT.** A D1 location addresses `{type, x, y}` in PIXELS; the atlas
     * carries only a TILE. Five of the 41 sit on a tile holding more than one
     * entity, so a by-tile join would silently mark a `<cover>` or a `<wire>`.
     */
    it('resolves the five ambiguous tiles through `entityForLedgerRow`, and every tile agrees', () => {
        expect(LIFT.rows).toHaveLength(41);
        expect(LIFT.rows.filter((r) => !r.tileAgrees)).toEqual([]);

        const rooms = LIFT.set.rooms.map((r) => r.source.record);
        const ambiguous = LIFT.rows.filter((r) => (rooms[r.level].entities ?? [])
            .filter((e) => String(tileOf(e, TILE_SIZE)) === String(r.atlasLoc.tile)).length > 1);
        expect(ambiguous.map((r) => `${r.level}:${r.entity.type}`).sort()).toEqual([
            '115:seed', '32:fallrocklarge', '38:chest', '40:chest', '67:bosskey',
        ].sort());
    });

    /**
     * ⛓ THE CENSUS IS A MEASUREMENT. Every count is recomputed here off the
     * atlas by a DIFFERENT expression than the script's, so a census that
     * drifted from the document it describes goes red rather than staying
     * eloquent.
     */
    it('prints what it cannot express, by CATEGORY, with every count read off the atlas', () => {
        const census = cannotExpress(LIFT);
        expect(census.map((c) => c.category)).toEqual([
            'sub-region graphs',
            'internal exits',
            'boundary exits pinned to a sub-region',
            'exit rules pinned to a sub-region',
            'locations pinned to a sub-region',
            'per-region annotations',
            'the never-enter ruling',
            'the room -> region map',
            'location names that had to be disambiguated',
        ]);
        const count = (name) => census.find((c) => c.category === name).count;

        let subgraphs = 0; let internal = 0; let subExits = 0; let subLocs = 0; let annotated = 0;
        for (const r of ATLAS.regions) {
            if (r.subgraph) subgraphs += 1;
            if (r.annotations) annotated += 1;
            internal += (r.subgraph?.internal_exits ?? []).length;
            for (const e of r.exits ?? []) if (e.sub_region !== undefined) subExits += 1;
            for (const l of r.locations ?? []) if (l.sub_region !== undefined) subLocs += 1;
        }
        expect(count('sub-region graphs')).toBe(subgraphs);
        expect(count('internal exits')).toBe(internal);
        expect(count('boundary exits pinned to a sub-region')).toBe(subExits);
        expect(count('locations pinned to a sub-region')).toBe(subLocs);
        expect(count('per-region annotations')).toBe(annotated);
        expect(count('exit rules pinned to a sub-region')).toBe(LIFT.cannotRules.length);
        // 116 rooms in the set, 113 regions in the committed atlas.
        expect(count('the never-enter ruling'))
            .toBe(LIFT.set.rooms.length - new Set(ATLAS.regions.map((r) => r.map_ref)).size);
        expect(count('the room -> region map')).toBe(0);
        expect(count('location names that had to be disambiguated')).toBe(LIFT.disambiguated);
        // …and every category says WHY, because a count with no reason is a
        // number a reader cannot act on.
        expect(census.every((c) => c.why.length > 40)).toBe(true);
    });

    /**
     * ⛔⛔ **NEITHER `neverEnter` NOR `regions` IS IN THE FIXTURE, AND THE
     * REASON IS NOT THE SCHEMA.** Both fields exist on the overlay and
     * `overlayToDeriveInput` reads `neverEnter`. NO OP WRITES EITHER — so a
     * document built by folding ops through the adapter cannot carry them, and
     * a script that wrote them by hand would be emitting a fixture the editor
     * could never have produced.
     */
    it('carries no `neverEnter` and no `regions` — no op writes them', () => {
        expect(LIFT.overlay.neverEnter).toBeUndefined();
        expect(LIFT.overlay.regions).toBeUndefined();
        expect(Object.keys(LIFT.overlay).sort())
            .toEqual(['overlay_id', 'provenance', 'rooms', 'schema_version']);
    });

    it('is IDEMPOTENT — two builds are byte-equal and carry one stamped id', () => {
        const a = buildOverlayText();
        const b = buildOverlayText();
        expect(a.text).toBe(b.text);
        expect(a.overlay.overlay_id).toBe(b.overlay.overlay_id);
        expect(a.overlay.overlay_id).toMatch(/^seedling-vanilla-overlay-[0-9a-f]{8}$/);
    });
});

/**
 * ── WHAT THE OVERLAY IS WORTH, ON THE REAL 116 ───────────────────────────────
 *
 * ⛔⛔ **§27.6 PREDICTED THE FREE-EDGE COUNT WOULD DROP. IT RISES, AND THAT IS
 * THE RIGHT ANSWER.** `freeEdgesOf` counts LOGIC OBLIGATIONS — every compiled
 * edge with no rule, and a LOCATION is one of those edges. Authoring 41
 * locations therefore creates 41 obligations, of which vanilla's own logic
 * discharges 3; the two liftable exit rules discharge 2 of the 334 doors. The
 * overlay does not make the world smaller, it makes what is UNSTATED visible.
 */
describe('⛓⛓ E5 — the REPORT over vanilla + the lifted overlay', () => {
    const reportWith = (overlay) => {
        const session = createSetSession(
            createSeedlingSetAdapter(DEPS), setRecord(LIFT.set, overlay),
            { base: { kind: 'set', set_id: LIFT.set.set_id } });
        return reportOf(session, DEPS, { compileRegionAtlas, validateRegionAtlas });
    };

    it('moves 334 free exits + 0 locations to 332 + 38, and the export stays ALLOWED', () => {
        const before = freeEdgesOf(reportWith(emptyOverlay()).rules);
        const after = freeEdgesOf(reportWith(LIFT.overlay).rules);

        expect(before.filter((e) => e.kind === 'exit')).toHaveLength(334);
        expect(before.filter((e) => e.kind === 'location')).toHaveLength(0);
        expect(after.filter((e) => e.kind === 'exit')).toHaveLength(332);
        expect(after.filter((e) => e.kind === 'location')).toHaveLength(38);

        /**
         * ⛓ THE TWO DOORS THAT STOPPED BEING FREE ARE THE TWO LIFTED EXIT
         * RULES — not two the compiler happened to drop.
         *
         * ⚠ THE NAME IS THE COMPILER'S, NOT THE DERIVATION'S. A free edge is
         * read off the COMPILED rules, where an exit is named
         * `level_113 -> level_115` (and `#2` for the second door between the
         * same pair) — the atlas's `out_teleporter_112_0` never appears there.
         * So the row asserts the PAIR, which is the compiled document's own
         * vocabulary, and the exit ids are asserted on the atlas below.
         */
        const gone = before.filter((e) => e.kind === 'exit')
            .filter((e) => !after.some((a) => a.region === e.region && a.name === e.name));
        expect(gone).toHaveLength(2);
        expect(gone.every((e) => e.region === 'level_113' && e.name.startsWith('level_113 -> level_115')))
            .toBe(true);
        const ruled = reportWith(LIFT.overlay).atlas.regions
            .flatMap((r) => (r.exits ?? []).filter((e) => e.access_rule)
                .map((e) => `${r.region_id} ${e.exit_id}`));
        expect(ruled.sort())
            .toEqual(['level_113 out_teleporter_112_0', 'level_113 out_teleporter_128_0']);
        // …and the three locations that are NOT free are the three the
        //   playthrough guards.
        const guarded = LIFT.rows.filter((r) => r.atlasLoc.access_rule);
        expect(guarded).toHaveLength(3);
        expect(after.filter((e) => e.kind === 'location')).toHaveLength(41 - guarded.length);
    });

    it('gives the vanilla set 41 locations and an ALLOWED rules.json export', () => {
        const report = reportWith(LIFT.overlay);
        expect(report.atlas.regions.reduce((n, r) => n + (r.locations ?? []).length, 0)).toBe(41);
        expect(report.download.rules.allowed).toBe(true);
        expect(report.download.rules.why).toBeNull();
    });
});
