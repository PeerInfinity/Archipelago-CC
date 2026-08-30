/**
 * The VANILLA data source for the pipeline's jta identity channel: the
 * committed dataset fixture (datasets/vanilla.json), exposed under the
 * names the snapshot era established.
 *
 * This replaces the retired hand-regenerated zoneTaskData.js snapshot
 * (unification U-a, jta-synthetic-post-v1-design.md §4.4). The fixture is
 * regenerated from the fork build by export-vanilla-dataset.mjs and checked
 * by datasetValidator.js — the exporter + validator ARE the sync mechanism,
 * so there is no second copy of the fork's task identity to drift.
 *
 * Iframe-safe and headless-import-safe: a static JSON module import touches
 * neither `window` nor the DOM, and resolves relative to this file in the
 * browser (raw ES modules), in Node, and under esbuild bundling alike.
 */

import vanillaDoc from './datasets/vanilla.json' with { type: 'json' };

/** The full vanilla jta-dataset document (schema jta-dataset.schema.json). */
export const JTA_VANILLA_DATASET = vanillaDoc;

/**
 * The grant-suppression sentinel for vanilla worlds — the fork's
 * PerkType.Count. Dead slots are explicit `{placeholder: true}` entries in
 * the fixture, so array length ≡ the engine enum's Count.
 */
export const JTA_PERK_COUNT = vanillaDoc.perks.length;

/**
 * taskId -> the perk display name that task grants in vanilla (null if it
 * grants none). The map the randomized-progression smoke tests use to prove
 * a shuffle really moved perks off their native tasks.
 *
 * @returns {Map<number, string|null>}
 */
export function vanillaPerkNameByTaskId() {
    return new Map(vanillaDoc.zones.flatMap((z) => z.tasks).map((t) => [
        t.id,
        t.perk != null ? (vanillaDoc.perks[t.perk]?.name ?? null) : null,
    ]));
}
