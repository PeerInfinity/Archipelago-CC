/**
 * apworldEditor/regionGenerationFlow — **WHAT THE BLOCK'S "REGION GENERATION"
 * FORM SAYS AND SENDS**, as pure functions (APWORLD SUBSTRATE CHANGE R2; plan
 * §3b, §9.3, ⚖ user 2026-09-23 Q1 A, Q2, Q4, §7.7 #5).
 *
 * The flow: a substrate picked on a region's block changes the LABEL (D1's
 * op, untouched) and opens **▾ Region generation** under the block. Its bag is
 * the target's registry defaults (`defaultProcgenParams`) + a seed + the region
 * size for a tiles target (`regionSizeFor`, ⚖ Q4); the region's OWN recorded
 * knobs (`bagFromPayload`) are offered beside them when they differ (trap 1399:
 * they can be the harder ones). **Generate ▸** runs `regenerateRegionEntry` in
 * a worker (`regionGenerationRun.js`) and lands the RESULT as ONE
 * `set-region-sidecar` with a `provenance` (§9.3: a recorded realiser would
 * re-run on every undo's refold).
 *
 * ⛔ **THE OP IS THE AUTHORITY, THE FORM A COURTESY** (1305): every refusal the
 * flow prints is the op's own sentence (`regenerateOpRefusal`,
 * `regenerateRealiserRefusal`) or the worker's (`regionGenerationRun.js`), and
 * the answer to a landed Generate is the op's own description
 * (`describeRegeneration`) — never a copy.
 *
 * ⛔ No substrate is named here: every fact is read off the registry entry.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GEOMETRY, geometryOf } from '../procgenCore/regionGeometry.js';
import { bagFromPayload } from '../procgenCore/regionGenerationForm.js';
import { assembleLibraryRegionParams, assembleRegionParams } from '../procgenPipeline/sphereConfigHooks.js';
import { effectiveHazardOpts } from '../procgenPipeline/presetRun.js';
import {
    REGENERATE_BASE_REGION_PARAMS, REGION_SOURCE_KINDS, freeItemsFor, hostsSurplusExitsNatively,
    librarySourceSummary, offersLibrarySource, regionSizeFor,
} from './regionRegenerate.js';
import { describeRegeneration, regenerateOpRefusal, regenerateRealiserRefusal } from './rulesDocOps.js';
import { payloadBuiltBy } from './sidecarIssues.js';
import {
    REGION_GENERATION_CANCELLED, regionGenerationLoadTimeoutSentence, regionGenerationTimeoutSentence,
} from './regionGenerationRun.js';

/** ⛓ The bag key the form's seed row binds. */
export const REGION_GENERATION_SEED_KEY = 'seed';

/**
 * ⛓ The generic form rows the op READS — region width/height become the op's
 * `size`. `maxItemsPerRegion` is not a knob of the op (the region's locations
 * are the document's), so the hub draws no control that writes nothing.
 */
export const REGION_GENERATION_OP_FIELDS = Object.freeze(['regionWidth', 'regionHeight']);

/** ⛓ The first seed a region's form offers; the panel's counter moves it +1 per Generate. */
export const REGION_GENERATION_FIRST_SEED = 1;

/**
 * ⛓⛓ **WHAT THE FORM OPENS ON** for `region` → `target`.
 *
 * @returns {{target: string, refusal: string|null, tiles: boolean,
 *   size: {width, height, source}|null, defaults: object, recorded: object|null,
 *   recordedDiff: Array<[string, *]>}}
 *   `refusal` — the op's own sentence when it would refuse before the realiser
 *   runs (no realiser, more exits than sides, …): the form draws it and no
 *   Generate. `recorded` — the defaults overlaid by the target's
 *   `procgenParamsFromPayload` read off the region's payload, ONLY when that
 *   payload is the target's own (`payloadBuiltBy`) and the read differs.
 */
export function regionGenerationPlan(doc, player, region, target, { seed = REGION_GENERATION_FIRST_SEED } = {}) {
    const refusal = regenerateOpRefusal(doc, {
        op: 'regenerate-region-sidecar', player, region, substrate: target, seed,
    });
    const entry = substrateRegistry.get(target);
    const tiles = !!entry && geometryOf(entry) === REGION_GEOMETRY.TILES;
    const size = tiles ? regionSizeFor(doc, player) : null;
    const generic = {
        [REGION_GENERATION_SEED_KEY]: seed,
        ...(size ? { regionWidth: size.width, regionHeight: size.height } : {}),
    };
    const own = { ...(entry?.defaultProcgenParams ?? {}) };
    const defaults = { ...own, ...generic };
    const payload = doc?.preset_sidecars?.[player]?.[region]?.playable_payload;
    let recorded = null;
    let recordedDiff = [];
    if (entry && payload && payloadBuiltBy(payload).includes(target)) {
        const read = bagFromPayload(entry, payload);
        recordedDiff = Object.entries(read).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(own[k]));
        if (recordedDiff.length) recorded = { ...read, ...generic };
    }
    return {
        target, refusal, tiles, size, defaults, recorded, recordedDiff, offersLibrary: offersLibrarySource(entry),
    };
}

/**
 * ⛓ The form's SOURCE row (R5a, plan §12): *Generate* always; *Library entry*
 * only when the target declares `instantiateLibraryEntryForSpecs`
 * (`plan.offersLibrary`, the sphere path's own test).
 */
export const REGION_GENERATION_SOURCES = Object.freeze([
    { id: REGION_SOURCE_KINDS.GENERATE, label: 'Generate' },
    { id: REGION_SOURCE_KINDS.LIBRARY, label: 'Library entry' },
]);

export function regionGenerationSourcesFor(plan) {
    return REGION_GENERATION_SOURCES.filter((s) => s.id !== REGION_SOURCE_KINDS.LIBRARY || plan.offersLibrary);
}

/**
 * ⛓⛓ **THE BAG → THE OP'S ARGUMENTS** — exactly as the pipeline's top-down run
 * composes them (`presetRun.buildTopDownRun`): `assembleRegionParams` over the
 * one target in `topDown` mode, `effectiveHazardOpts`; plus the size for a tiles
 * target and top-down's free-item rule, made EXPLICIT so the provenance records
 * what the realiser was handed.
 */
export function composeRegenerateArgs(doc, player, region, target, bag, { source } = {}) {
    // ⛓ R5a — a LIBRARY source: no seed (the entry draws none; the op refuses
    //   one), no size (the captured room's own), no free items (nothing
    //   drifts); `regionParams` = the target's LIBRARY knobs
    //   (`buildLibraryRegionParams`, in the sphere mode the hook is written for).
    if (source?.kind === REGION_SOURCE_KINDS.LIBRARY) {
        return {
            doc,
            player,
            region,
            substrate: target,
            regionParams: assembleLibraryRegionParams({ substrateIds: [target], mode: 'sphere', params: bag }),
            source,
        };
    }
    const entry = substrateRegistry.get(target);
    const tiles = !!entry && geometryOf(entry) === REGION_GEOMETRY.TILES;
    return {
        doc,
        player,
        region,
        substrate: target,
        seed: bag[REGION_GENERATION_SEED_KEY],
        regionParams: assembleRegionParams({ activeIds: [target], mode: 'topDown', params: bag }),
        hazardOpts: effectiveHazardOpts(bag),
        ...(tiles ? { size: { width: bag.regionWidth, height: bag.regionHeight } } : {}),
        freeItems: freeItemsFor(doc, player, entry),
    };
}

/**
 * ⛓ The op's own pre-realiser refusal for the arguments a Generate composed
 * (a seed typed as nothing, a size below one tile, …) — `null` when the op would
 * hand them to the realiser.
 */
export function regenerateArgsRefusal(args) {
    const { doc, ...op } = args;
    return regenerateOpRefusal(doc, { op: 'regenerate-region-sidecar', ...op });
}

/**
 * ⛓ The free-item sentence the form shows — `null` when the target hosts
 * surplus exits natively under these params (the items would drift nothing;
 * §7.7 ⚖ #5, RULED: the clause is dropped).
 */
export function freeItemsSentence(target, args) {
    const entry = substrateRegistry.get(target);
    if (hostsSurplusExitsNatively(entry, { ...REGENERATE_BASE_REGION_PARAMS, ...args.regionParams })) return null;
    const n = args.freeItems.length;
    return `${n} item${n === 1 ? '' : 's'} ride free${n ? ` [${args.freeItems.join(', ')}]` : ''} — the slot's `
        + 'starting items and the target\'s library items this document does not define (top-down\'s rule): '
        + 'a surplus exit may drift onto one the player always holds.';
}

/**
 * ⛓ The `provenance` the landed `set-region-sidecar` carries (§9.3): the pure
 * op's arguments, so the record says how the entry came to be.
 */
export function regenerationProvenance(args, res) {
    // ⛓ R5a — the id pair and the entry's name, never its payload: the pure op
    //   carries the whole entry; the record's reader needs the pair.
    if (args.source?.kind === REGION_SOURCE_KINDS.LIBRARY) {
        return {
            op: 'regenerate-region-sidecar',
            substrate: args.substrate,
            source: librarySourceSummary(args.source),
            seed: null,
            regionParams: args.regionParams,
            ms: Math.round(res.ms ?? 0),
        };
    }
    return {
        op: 'regenerate-region-sidecar',
        substrate: args.substrate,
        seed: args.seed,
        regionParams: args.regionParams,
        hazardOpts: args.hazardOpts ?? null,
        ...(args.size ? { size: args.size } : {}),
        freeItems: args.freeItems,
        ms: Math.round(res.ms ?? 0),
    };
}

/**
 * ⛓⛓ **THE ANSWER TO A GENERATE**, in the op's or the worker's own words.
 *
 * @param {object} args the job's arguments
 * @param {object} res `runRegenerateInWorker`'s outcome
 * @param {number} budgetS the budget the run was given, in seconds
 * @returns {{landed: boolean, text: string}}
 */
export function regenerationAnswer(args, res, budgetS) {
    const { region, substrate, seed } = args;
    if (res.ok) return { landed: true, text: describeRegeneration({ region, substrate, seed, res }) };
    if (res.timedOut && res.phase === 'loading') {
        return { landed: false, text: regionGenerationLoadTimeoutSentence(res.budgetMs) };
    }
    if (res.timedOut) return { landed: false, text: regionGenerationTimeoutSentence(budgetS, substrate, region) };
    if (res.cancelled) return { landed: false, text: `apworld: ${REGION_GENERATION_CANCELLED}.` };
    if (res.unavailable || res.workerFailed) return { landed: false, text: `apworld: ${res.threw}` };
    return { landed: false, text: regenerateRealiserRefusal({ region, substrate, res }) };
}
