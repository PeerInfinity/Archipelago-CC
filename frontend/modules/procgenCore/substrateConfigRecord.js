/**
 * procgenCore/substrateConfigRecord — **THE CONFIG EACH CONTENT SOURCE WAS
 * INSTALLED WITH, RECORDED IN THE DOCUMENT** (APWORLD SUBSTRATE CHANGE R6b).
 *
 * A content source installs its pipeline config module-globally
 * (`applyPipelineConfig`), and the document it helps build does not always
 * carry every field of it (jta's shuffle seed and zone gating). A source that
 * declares `recordablePipelineConfig()` answers the part a document cannot
 * otherwise read back; `buildRulesJson` writes it to
 * `procgen_metadata.substrate_configs[id]` for every declaring source that
 * realised a region of the grid, and the APWorld hub's zone read-back hands it
 * to the source as `recorded`.
 *
 * ⛔ No substrate is named here: the population is the registry's declarers,
 * intersected with the substrates the grid realised.
 */

/** ⛓ The `procgen_metadata` key the records live under. */
export const SUBSTRATE_CONFIGS_KEY = 'substrate_configs';

/** ⛓ The registry slot a source declares to be recorded. */
export const RECORDABLE_CONFIG_HOOK = 'recordablePipelineConfig';

/** ⛓ The registry slot naming the keys `applyPipelineConfig` reads. */
export const PIPELINE_CONFIG_KEYS_SLOT = 'pipelineConfigKeys';

/**
 * The records for `ids` (the substrates a grid realised, in grid order): each
 * declaring entry's answer, deep-copied as JSON. `null` when none declares, so
 * the caller writes no key at all (absent, never `{}`).
 *
 * @param {string[]} ids
 * @param {(id: string) => object|undefined} entryOf
 * @returns {Record<string, object>|null}
 */
export function recordableConfigsFor(ids, entryOf) {
    const out = {};
    for (const id of ids) {
        const hook = entryOf(id)?.[RECORDABLE_CONFIG_HOOK];
        if (typeof hook !== 'function') continue;
        const answer = hook();
        if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
            throw new Error(`substrate '${id}' ${RECORDABLE_CONFIG_HOOK}() must answer a plain object, got `
                + `${JSON.stringify(answer)}`);
        }
        out[id] = JSON.parse(JSON.stringify(answer));
    }
    return Object.keys(out).length ? out : null;
}

/**
 * The record a document holds for substrate `id`, or `null` when it holds none.
 *
 * @param {object} doc a rules.json document
 * @param {string} id
 * @returns {object|null}
 */
export function recordedConfigOf(doc, id) {
    const rec = doc?.procgen_metadata?.[SUBSTRATE_CONFIGS_KEY]?.[id];
    return rec && typeof rec === 'object' && !Array.isArray(rec) ? rec : null;
}
