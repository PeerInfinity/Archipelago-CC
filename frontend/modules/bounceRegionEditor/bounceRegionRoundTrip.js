/**
 * bounceRegionEditor/bounceRegionRoundTrip — **THE BOUNCE SUBSTRATE'S
 * DOCUMENT ⇄ ROOM-EDITOR ROUND TRIP** (APWORLD EDITOR HUB slice H4b).
 *
 * The maze's counterpart is `mazeRoom/mazeRegionRoundTrip.js`; this file is the
 * other half of the same declaration, and the two exist for the reason H3's
 * `compositeMap.drawRegion` does — the hub must not know what a bounce level
 * is. `bounceDemoLibrary` declares `regionRoundTrip` and reaches this module by
 * a DYNAMIC import, verbatim the reason its `roomEditor.open` does: a static
 * import would be a CYCLE (`buildEditedRegion.js` imports the library), and the
 * declaration has to stay DATA that a headless caller can read.
 *
 * ── ⛓⛓⛓ WHAT A rules.json CAN AND CANNOT SAY ABOUT A BOUNCE REGION ────
 *
 * The pipeline builds this editor's contract from a LIVE layout
 * (`buildTopDownRegionContract`, `procgenPipelineEngine.js:5157`), which the
 * hub does not have. MEASURED, field by field, against the H4a fixture's two
 * bounce slots (`multiworld/AP_05594871498841892311`, slots 3 and 4):
 *
 *   RECOVERABLE from `{regions[p][name], preset_sidecars[p][name]}`
 *     `exitSpecs`       side ← `playable_payload.exits[].side`; requirement ←
 *                       `extractItemRequirementFromRule` over the DOCUMENT's own
 *                       exit `access_rule` — the same extractor the top-down
 *                       realiser uses, so the geometry is gated the way ② gated it
 *     `locationSpecs`   id ← `playable_payload.ap_locations` (the payload's own
 *                       id → AP-name map); item ← the document's placement
 *     `itemPool`        `Object.keys(items[p])`
 *     `expectedItems`   `starting_items[p]`
 *     the LEVEL itself  `params.bounceLevel`
 *
 *   NOT IN THE DOCUMENT — three, and all three are WORLD-level generation
 *   settings the exporter never carried:
 *     `physicsProfile` · `mode` (braid/column) · `freeArrow`
 *   ⛔ `procgen_metadata` does not hold them either (measured: the fixture's is
 *   `{driver, stop_reason, region_count, grid_dims}`), and the payload's
 *   `params` carries `physics` only for a NON-experimental profile
 *   (`physicsStampFor` omits the stamp for `experimental`, so its absence is
 *   ambiguous between "experimental" and "not recorded").
 *
 * ⛓ **THE COST, PRICED: a DEGRADED editor, not a disabled button.** Those three
 * do not change what the level IS — they change how rules are DERIVED from it
 * and what a REGENERATE would build. The fallbacks here are `_editRegionTD`'s
 * OWN (`'experimental'` · `'braid'` · `'right'`), so the hub's contract equals
 * the pipeline's for any world generated with the defaults; a world generated
 * with others gets the same geometry and a Regenerate that would rebuild it
 * under different settings. The hub SAYS so in the button's title rather than
 * refusing an editor that works.
 */

import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { extractItemRequirementFromRule } from '../procgenPipeline/ruleRequirements.js';
import { apExitNameCandidates } from '../procgenCore/apLocationNaming.js';
import { buildEditedRegion } from './buildEditedRegion.js';

/** ⛓ `buildTopDownRegionContract`'s own `requirementOf`, quoted not re-invented. */
const requirementOf = (rule) => {
    const r = extractItemRequirementFromRule(rule);
    return { requirement: r.requirement, counts: r.counts ?? {} };
};

/**
 * ⛓⛓ THE THREE FALLBACKS, in one place and named after where they come from —
 * `buildBounceRegionContract`'s own (`regionParams.bounceMode ?? 'column'`),
 * `buildEditedRegion`'s own (`'column'`, `'experimental'`, `'right'`).
 *
 * ⛔⛔ **`mode` IS `column`, AND THAT IS A MEASUREMENT, NOT A COPY.** The
 * pipeline's `_editRegionTD` spells its own fallback `?? 'braid'`, and taking
 * that one made every derived rule `False_` on the H4a fixture: measured on
 * `multiworld/AP_05594871498841892311` slot 3 `region_1_0`,
 * `deriveBraidAccessRules` returns EMPTY minimal sets for both exits and the
 * pickup, where `deriveAccessRules` returns `[["left","right"]]`,
 * `[["right"]]` and `[[]]` — which are exactly the document's own
 * `HasAll(Left arrow, Right arrow)`, `Has(Right arrow)` and `True_`. ⇒ a braid
 * fallback would have opened every committed bounce region with a contract
 * claiming its exits are unreachable.
 *
 * ⚠ It is still a FALLBACK. A braid world's own `regionParams.bounceMode` is
 * not in the document either, so a braid region opens here as a column one —
 * which the hub names in the button's title. The baseline check is what makes
 * that safe: a rule the fallback cannot reproduce is a rule this door does not
 * move.
 */
export const BOUNCE_CONTRACT_FALLBACKS = Object.freeze({
    physicsProfile: 'experimental',
    mode: 'column',
    freeArrow: 'right',
});

/** ⛓ The fields a rules.json cannot supply — the hub prints this list. */
export const BOUNCE_UNRECOVERABLE_FIELDS = Object.freeze(
    Object.keys(BOUNCE_CONTRACT_FALLBACKS),
);

function open({ regionId, payload, region, itemPool = [], expectedItems = [] }) {
    const params = payload?.params ?? {};
    const level = params.bounceLevel;
    if (!level || typeof level !== 'object') {
        throw new Error(`bounceRegionRoundTrip: region "${regionId}" carries no `
            + '`playable_payload.params.bounceLevel`, and the bounce editor edits a LEVEL. '
            + `This payload's keys are [${Object.keys(payload ?? {}).join(', ')}].`);
    }
    const exitByName = new Map((region?.exits ?? []).map((e) => [e.name, e]));
    const locByName = new Map((region?.locations ?? []).map((l) => [l.name, l]));
    const docExit = (id) => apExitNameCandidates(regionId, id)
        .map((n) => exitByName.get(n)).find(Boolean) ?? null;

    const placed = (payload?.exits ?? []).filter((e) => e?.side);
    const exitSpecs = placed.map((e) => ({
        side: e.side, ...requirementOf(docExit(e.exit_id)?.access_rule),
    }));
    const apLocations = payload?.ap_locations ?? {};
    const locationSpecs = Object.entries(apLocations).map(([id, docName]) => {
        const loc = locByName.get(docName) ?? null;
        return { id, item: loc?.item?.name ?? null, ...requirementOf(loc?.access_rule) };
    });

    const contract = {
        exitSpecs,
        locationSpecs,
        physicsProfile: params.physics?.profile ?? BOUNCE_CONTRACT_FALLBACKS.physicsProfile,
        mode: (params.bounceLevel?.mode ?? BOUNCE_CONTRACT_FALLBACKS.mode) === 'braid'
            ? 'braid' : 'column',
        freeArrow: params.freeArrow ?? BOUNCE_CONTRACT_FALLBACKS.freeArrow,
        // ⛓ The editor's own two extras (`_editRegionTD` attaches the same two):
        //   what a pickup here may GRANT, and what the player is assumed to hold.
        itemPool: [...itemPool],
        expectedItems: [...expectedItems],
        regionParams: {},
    };

    /**
     * ⛓⛓ **THE REGION DESCRIPTOR, SYNTHESIZED FROM THE DOCUMENT.** The editor
     * reads `playable_payload.params.bounceLevel` to load and `buildEditedRegion`
     * reads `region_id`, `exits_placed` (side by exit id) and `extracted_rules`
     * to write back — so those four are what a document has to supply, and all
     * four are in it. ⛔ `extracted_rules.locations` is deliberately EMPTY: the
     * save replaces it wholesale from the edited level's pickups, so a value
     * here would be read by nobody and would look like a second source of truth.
     */
    const descriptor = {
        substrate: 'bounce',
        region_id: regionId,
        playable_payload: payload,
        exits_placed: placed.map((e) => ({
            exit_id: e.exit_id, side: e.side, tile_position: { x: e.x, y: e.y },
        })),
        extracted_rules: {
            region_id: regionId,
            exits: (payload?.exits ?? []).map((e) => ({
                id: e.exit_id,
                target_region: e.targetRegion ?? null,
                access_rule: docExit(e.exit_id)?.access_rule ?? null,
                paths: [],
            })),
            locations: [],
        },
    };

    return {
        session: { region: descriptor, contract },
        // ⛓ What the editor's save carries for a session nobody touched — the
        //   hub's BASELINE. Built HERE, from the same contract the editor gets,
        //   so the two cannot drift.
        unedited: buildEditedRegion({ region: descriptor, contract, level, settings: {} }),
    };
}

/**
 * ⛓⛓ **THE SAVE.** `saved` is `buildEditedRegion`'s output — a region whose
 * `playable_payload` the level rebuilt and whose `extracted_rules` carry the
 * re-derived paths. The rules compile the way `compileRegionGraph` compiles
 * them, with the SAME two per-region obstacle channels merged over the shared
 * library (`procgenPipelineEngine.js:2280-2285`): the region-level
 * `obstacle_defs` a zone substrate emits, and the payload's own `obstacleLib`.
 */
function save(saved, { regionId, payload }) {
    const rebuilt = saved?.playable_payload;
    if (!rebuilt || typeof rebuilt !== 'object') {
        throw new Error(`bounceRegionRoundTrip: the bounce editor's save carried no `
            + `\`playable_payload\` for "${regionId}".`);
    }
    const next = { ...rebuilt };
    /**
     * ⛓ The keys `buildZonePayload` does not emit at all — MEASURED on the
     * fixture, `exits` and `fogEnabled`, both written by the pipeline AFTER the
     * zone payload is built. Appended in the ORIGINAL's own order, so an
     * unedited round trip reproduces the document's bytes.
     */
    for (const [k, v] of Object.entries(payload ?? {})) if (!(k in next)) next[k] = v;

    const obstacleLib = {
        ...DEFAULT_OBSTACLES, ...(saved.obstacle_defs ?? {}), ...(next.obstacleLib ?? {}),
    };
    const compiled = compileRegion(saved.extracted_rules ?? {}, { obstacleLib });
    const apLocations = next.ap_locations ?? {};
    return {
        payload: next,
        exits: compiled.exits,
        // ⛓ The payload NAMES its own AP locations, so bounce answers with the
        //   document name directly and the hub needs no naming convention here.
        locations: compiled.locations.map((l) => ({
            ...l, ...(apLocations[l.id] ? { name: apLocations[l.id] } : {}),
        })),
    };
}

export const bounceRegionRoundTrip = Object.freeze({ open, save });

export default bounceRegionRoundTrip;
