/**
 * Collapse the fork view's coalesced request queue (Instant-policy pass,
 * slice 1). PUMP-SCOPED: paced play never calls this, and stays byte-inert.
 *
 * ── The defect this works around ─────────────────────────────────────────
 *
 * `view.requestUpdate` (views/main.view.js) means to coalesce:
 *
 *     requestUpdate(category, target) {
 *         if (!this.requests[category].includes(target)) this.requests[category].push(target);
 *     }
 *
 * `includes` is reference equality, and the hot callers hand it a FRESH
 * OBJECT LITERAL every call — `town.js:194` (`finishProgress`, unconditional,
 * once per progress tick), plus `:244` and `:151/190`. So the dedupe never
 * fires for exactly the entries that repeat most: the array grows by ~1 per
 * tick, each push linear-scans it, and the eventual `view.update()` replays
 * every duplicate as its own DOM update.
 *
 * Under paced play that is invisible — `view.update()` drains every
 * VIEW_UPDATE_MIN_MS (≤10 entries), so neither cost is reachable. Under a
 * synchronous pump that runs a whole loop between drains it is quadratic in
 * ticks, and it would have presented as an unexplained slowdown rather than
 * as a bug: the pump would still be CORRECT, just slower than the paced play
 * it exists to beat.
 *
 * ── Why collapsing is safe ───────────────────────────────────────────────
 *
 * Every request is an idempotent "repaint this row from CURRENT state" call —
 * `handleUpdateRequests` looks the value up when it runs, and carries nothing
 * forward from the request itself. N identical requests and one therefore
 * render the same pixels. Collapsing them is what the fork's own `includes`
 * was trying to do; this only supplies the value equality that object
 * literals denied it. First-occurrence ORDER is preserved so any ordering the
 * fork's categories rely on survives.
 *
 * ⚠ Deliberately NOT a fork edit. Fixing `requestUpdate` upstream would touch
 * every paced boot of the game (the byte-gate surface), to fix a cost only the
 * pump can reach. The pump owns the workaround because the pump owns the cost.
 */

/**
 * Stable identity for a request target, or `null` when it has no value
 * identity we can vouch for.
 *
 * The fork's target shapes, enumerated from every `requestUpdate` call site:
 *   - `undefined` / `null` / string / number / boolean — primitives, which
 *     `includes` already deduped correctly; keyed here the same way.
 *   - `{name, index}`     — `updateRegular` (the hot one)
 *   - `{name, town}`      — `updateProgressAction`, where `town` is a live
 *                           Town object and `town.index` is its identity
 *   - anything else       — `updateCloudSave`'s Drive payloads,
 *                           `updateMultiPart`'s Action objects. These get NO
 *                           value key: an unrecognised object falls back to
 *                           reference identity, which is exactly the fork's
 *                           existing behavior, so an unmodelled shape can
 *                           never be collapsed WRONGLY. (It is also why the
 *                           caller must keep using a Set for the fallback —
 *                           see dedupeViewRequests.)
 *
 * @param {*} target
 * @returns {string|null} a value key, or null to fall back to identity
 */
function targetKey(target) {
    if (target === null || target === undefined) return `p:${String(target)}`;
    const t = typeof target;
    if (t === 'string' || t === 'number' || t === 'boolean') return `${t[0]}:${String(target)}`;
    if (t !== 'object') return null;
    const name = target.name;
    if (typeof name !== 'string') return null;
    // {name, index} — updateRegular
    if (typeof target.index === 'number') return `r:${name}|${target.index}`;
    // {name, town} — updateProgressAction. A town without a numeric index is
    // not a shape we model; fall back rather than collapse on the name alone
    // (two towns share progress var names).
    const townIndex = target.town?.index;
    if (typeof townIndex === 'number') return `t:${name}|${townIndex}`;
    return null;
}

/**
 * Collapse duplicate entries in a view request bag, in place.
 *
 * @param {Object<string, Array>|null|undefined} requests
 *   The fork view's `requests` bag: category -> array of targets. Mutated in
 *   place, because the view holds the same array references.
 * @returns {number} how many entries were removed (diagnostics only)
 */
export function dedupeViewRequests(requests) {
    if (!requests || typeof requests !== 'object') return 0;
    let removed = 0;
    for (const category of Object.keys(requests)) {
        const list = requests[category];
        if (!Array.isArray(list) || list.length < 2) continue;
        const seenKeys = new Set();
        // Reference identity for the shapes targetKey declines to model. A Set
        // (not `includes`) so the fallback path stays O(1) per entry too —
        // otherwise an unmodelled shape would reintroduce the quadratic scan
        // this function exists to remove.
        const seenRefs = new Set();
        let write = 0;
        for (let read = 0; read < list.length; read += 1) {
            const target = list[read];
            const key = targetKey(target);
            const seen = key === null ? seenRefs : seenKeys;
            const id = key === null ? target : key;
            if (seen.has(id)) {
                removed += 1;
                continue;
            }
            seen.add(id);
            list[write] = target;
            write += 1;
        }
        list.length = write;
    }
    return removed;
}
