/**
 * blockAnnotations — the per-block economy annotations loops attaches to a
 * recording (M4 slice 4).
 *
 * Post-M3b, loops is the sole economy observer, so it is the only place that
 * can say what a region visit COST and what it YIELDED. A Record block runs
 * a tracker for the length of the visit; on a successful exit the tracker is
 * built into an `annotations` object stored alongside the recording in
 * savedQueueStore (the universal envelope — coarse-only substrates get an
 * ACTIONS-LESS entry carrying annotations alone).
 *
 * Two rulings shape this (user, 2026-07-23 — settled):
 *
 *  - Everything is a DELTA FROM BLOCK START, never an absolute. An
 *    annotation describes what one visit did, so it stays meaningful when
 *    the block is replayed from a different starting inventory.
 *  - The tracked resources are CONSUMABLE ITEMS — including cross-substrate
 *    pool items — plus XP, which is tracked but not displayed. MANA is
 *    deferred.
 *
 * Item identity is the D2 namespaced id `${owningSubstrate}/${itemType}`, so
 * a grant into jta and jta's own use of the same item fold into one key.
 *
 * ## Why the minimum is conservative
 *
 * "The lowest value each resource reached" would need one ordered stream of
 * every gain and spend. There isn't one: grants arrive as live
 * `crossSubstrate:itemGranted` events while consumption is only visible in
 * the substrate's finalized recording, and the two have no shared clock (the
 * M3b lesson — reconstructing an interleaving from two channels is exactly
 * the bug family that motivated the coarse-capture refactor).
 *
 * So the minimum is the MOST CONSERVATIVE interleaving: every spend happens
 * before any gain. `min = min(0, total consumed)`, which reads in the UI as
 * "needs ≥ −min at start" and can only ever OVERSTATE the requirement. The
 * design already accepts minima as a feasibility estimate rather than a
 * measurement; overstating is the safe direction for a "can I run this
 * block?" hint. If a substrate ever publishes live consumption on the same
 * channel as grants, this fold is the one place that changes.
 */

/**
 * The namespaced item id (ruling D2). Owner is the substrate that holds the
 * item in its own inventory — grants name it as `to`, recorded uses name it
 * by the substrate whose recording they came from.
 * @param {string} owner
 * @param {string} itemType
 * @returns {string|null} null when either part is missing
 */
export function itemKey(owner, itemType) {
    if (typeof owner !== 'string' || !owner) return null;
    if (typeof itemType !== 'string' || !itemType) return null;
    return `${owner}/${itemType}`;
}

/**
 * Accumulates one Record block's economy activity. Created when the block
 * parks, discarded with the recording on a wrong exit / mana-out / reset,
 * and built into annotations on a successful exit.
 */
export class BlockAnnotationTracker {
    /** @type {Map<string, {net: number, consumed: number}>} */
    #items = new Map();

    /** @type {number} */
    #xp = 0;

    /**
     * Fold one signed item delta into the block. Positive = collected
     * (a cross-substrate grant, a consumable tile pickup); negative =
     * consumed. No-ops on a bad key or a non-finite / zero amount.
     * @param {string|null} key - namespaced item id, see itemKey()
     * @param {number} amount
     */
    noteItemDelta(key, amount) {
        if (!key || typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) return;
        const entry = this.#items.get(key) ?? { net: 0, consumed: 0 };
        entry.net += amount;
        if (amount < 0) entry.consumed += amount;
        this.#items.set(key, entry);
    }

    /**
     * Fold the item USES out of a substrate's finalized fine recording.
     * Recorded `useItem` entries are the only visible consumption signal
     * today; `loops` counts as the number of uses.
     * @param {object[]} actions - shared/actionQueue entries
     * @param {string} substrateId - the recording's owning substrate
     */
    foldRecordedItemUses(actions, substrateId) {
        for (const a of Array.isArray(actions) ? actions : []) {
            if (a?.actionType !== 'useItem') continue;
            const name = (typeof a.label === 'string' && a.label) ? a.label : null;
            const count = (typeof a.loops === 'number' && a.loops > 0) ? a.loops : 1;
            this.noteItemDelta(itemKey(substrateId, name), -count);
        }
    }

    /** Fold XP awarded during the block (tracked, not displayed). */
    noteXp(amount) {
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
        this.#xp += amount;
    }

    /**
     * Build the stored annotations, or null when the block moved no
     * economy at all (so an empty visit doesn't carry a noise object).
     * @returns {{items: Object<string,{net:number,min:number}>, xp: {net:number}}|null}
     */
    build() {
        const items = {};
        let anyItem = false;
        for (const [key, { net, consumed }] of this.#items) {
            if (net === 0 && consumed === 0) continue;
            items[key] = { net, min: Math.min(0, consumed) };
            anyItem = true;
        }
        if (!anyItem && this.#xp <= 0) return null;
        return { items, xp: { net: this.#xp } };
    }
}

/**
 * The panel's view of an annotations object (M4 slice 5). Kept here, apart
 * from the DOM, so the display RULE is testable on its own.
 *
 * The rule (user, 2026-07-23): show NET deltas whenever nonzero; show a
 * minimum ONLY when it went below zero, rendered "needs ≥X at start" — a
 * minimum is only ever useful as a can-I-run-this-block hint. XP is tracked
 * but never gets a badge; it appears in the detail tooltip alongside the
 * full per-item numbers.
 *
 * @returns {{nets: string[], needs: string[], detail: string}}
 */
export function formatAnnotations(annotations) {
    const items = annotations?.items ?? {};
    const nets = [];
    const needs = [];
    const detail = [];
    for (const [key, v] of Object.entries(items)) {
        const name = key.includes('/') ? key.slice(key.indexOf('/') + 1) : key;
        if (v?.net) nets.push(`${v.net > 0 ? '+' : ''}${v.net} ${name}`);
        if (v?.min < 0) needs.push(`needs ≥${-v.min} ${name} at start`);
        detail.push(`${key}: net ${v?.net >= 0 ? '+' : ''}${v?.net ?? 0}, lowest ${v?.min ?? 0}`);
    }
    if (annotations?.xp?.net > 0) detail.push(`XP earned: ${Math.round(annotations.xp.net)}`);
    return { nets, needs, detail: detail.join('\n') };
}

/**
 * Whether an annotations object says anything worth showing. Used by the
 * UI so an all-zero annotation renders nothing.
 */
export function annotationsAreEmpty(annotations) {
    if (!annotations) return true;
    const items = annotations.items ?? {};
    for (const v of Object.values(items)) {
        if (v?.net || v?.min) return false;
    }
    return !(annotations.xp?.net > 0);
}
