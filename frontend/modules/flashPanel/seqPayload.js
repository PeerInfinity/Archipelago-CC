/**
 * ⛓ **ONE PARSER FOR THE `<seq>|…` STRING PROPERTY REPORTS** (maze-lab arms
 * F-a / plan §17.1 F5).
 *
 * BridgeGeneric reports a declared property only when its value CHANGED, so
 * every string report the AS3 writes carries a leading `<seq>` counter that
 * makes two identical events two distinct strings. `Game.pendingCheck`
 * (`seedlingCheckBinding.js`) and `Game.pendingExit`
 * (`seedlingRegionBinding.js`) both use that dialect, and until this module
 * existed both spelled the same five rules — including the "EMPTY IS NOT ZERO"
 * comment, written out twice.
 *
 * ⛔ WHY THIS IS ITS OWN FILE AND NOT A FUNCTION IN `seedlingSemantics.js`.
 * Both binding modules import NOTHING today (`grep -c "from '"` = 0 at
 * `8a1eb6b1a`). `seedlingSemantics.js` is the tile/entity TRANSCRIPTION — 700+
 * lines of tables with a census guard of its own — and a report parser has no
 * business depending on it, in the bundle or in the reading. Ten lines in a
 * file with no imports of its own is the smallest thing that removes the
 * duplicate.
 *
 * ⛔ WHAT IT DOES **NOT** DO: typing. `pendingCheck` sweeps all four fields to
 * integers and folds the fourth into a boolean (`cleared: written === 0`);
 * `pendingExit` sweeps five of six and keeps `type` a STRING. Those are the
 * callers' contracts, they do not agree, and folding them in here would be the
 * drift this file exists to prevent.
 */

/**
 * Split one `<seq>|…` report into its fields, or refuse it.
 *
 * The five rules, stated once:
 *  1. a non-string is not a report;
 *  2. the EMPTY string is the boot report BridgeGeneric fires for every
 *     declared property before the game has written one (measured on p4c at
 *     W5-0) — it is not a value;
 *  3. the field count is exact;
 *  4. ⛔ **EMPTY IS NOT ZERO** — `Number('')` is 0 and `Number.isInteger(0)`
 *     is true, so a payload whose last field never got written (`"1|19|4|"`)
 *     would otherwise parse as a real value at a real address;
 *  5. the `<seq>` is RETURNED but never compared — it is not part of any
 *     address.
 *
 * @param {unknown} value  the raw property value the bridge reported.
 * @param {number} fields  how many `|`-separated fields this report carries.
 * @returns {string[]|null} the fields, untyped, or null for anything malformed.
 */
export function parseSeqPayload(value, fields) {
    if (typeof value !== 'string' || value === '') return null;
    const parts = value.split('|');
    if (parts.length !== fields) return null;
    if (parts.some((part) => part === '')) return null;
    return parts;
}
