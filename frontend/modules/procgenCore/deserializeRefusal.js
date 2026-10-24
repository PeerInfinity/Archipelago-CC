/**
 * ⛓⛓⛓ **A PAYLOAD ITS OWN SUBSTRATE CANNOT READ IS A REGION REFUSED BY
 * SENTENCE, NOT A THROW** (PRESET SIDECARS C1, 2026-09-13).
 *
 * A registry entry's `deserializeWorld` REFUSES a payload that is not its
 * shape by throwing its own sentence. Three readers that build worlds for a
 * whole document — the play-time warehouse, the composite map and the sphere
 * rebuild — used to let that throw escape, so ONE bad region blanked play and
 * the Map (plan §24.7's table: two `Error in event handler for` at play, a
 * blank Map tab and a page error in the hub). The hub's validation bar was the
 * only surface that caught it (`sidecarIssues`' `DESERIALIZE_THROWS`).
 *
 * This is the one door those readers share: it calls the entry's own
 * `deserializeWorld` and answers either the world or the refusal sentence,
 * naming the region and the substrate it was HANDED (off the sidecar entry —
 * this file names no substrate) and quoting the entry's own words. Each reader
 * decides what a refusal means for it: the warehouse and the map SKIP the
 * region and report it; the rebuild, which cannot drop a node from a tree,
 * refuses the whole document by its own named refusal.
 *
 * ⛔ It catches only the deserializer's throw. A missing registry entry, or
 * one with no `deserializeWorld`, is each reader's own earlier question.
 */

/**
 * @param {string} regionId   the sidecar's key
 * @param {string} substrate  the sidecar entry's `substrate`
 * @param {unknown} err       what `deserializeWorld` threw
 * @returns {string} the refusal sentence
 */
export function deserializeRefusalSentence(regionId, substrate, err) {
    return `region ${regionId}: its \`${substrate}\` payload cannot be read — `
        + `${err?.message ?? err}`;
}

/**
 * @param {{deserializeWorld: Function}} adapter  the registry entry
 * @param {unknown} payload
 * @param {{regionId: string, substrate: string, opts?: object}} who
 * @returns {{world: object} | {refusal: string}}
 */
export function deserializeOrRefuse(adapter, payload, { regionId, substrate, opts }) {
    try {
        return { world: opts === undefined
            ? adapter.deserializeWorld(payload)
            : adapter.deserializeWorld(payload, opts) };
    } catch (err) {
        return { refusal: deserializeRefusalSentence(regionId, substrate, err) };
    }
}
