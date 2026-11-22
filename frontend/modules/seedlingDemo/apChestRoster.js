/**
 * seedlingDemo/apChestRoster — **WHERE AN AP LOCATION STANDS ON EACH BUILD** (slice seedling-p4h-beside, the chest
 * readers, rules-12's census).
 *
 * ⛓ WHAT MOVED AT p4h. On p4g every `<apitem>` builds `Pickups/APItem` — a `Pickup`, so a `Mobile`, so a row of
 * `botMobiles()`. On a build declaring `apchest` (p4h, Seedling `p4h-as3` 0451516252) an `<apitem kind="chest">`
 * builds `Pickups/APChest` instead: a Solid chest that is NOT a Mobile, so it is ABSENT from `botMobiles()` and is
 * listed in `botActivators().chests` (`{cls: 'Pickups::APChest', x, y, type, frame, alpha, tag}`, the same half-tile
 * centre an APItem reports). An `<apitem>` without `kind` is still an APItem, on either build.
 *
 * ⛓ THE GATE IS THE CAPABILITY, AND THE ANSWER IS A UNION. On a build declaring `apchest` the AP-location roster is
 * `botMobiles` ∪ the APChest rows of `botActivators().chests`; on any other build it is `botMobiles` alone and
 * `botActivators` is never asked (p4g has no such export). A union rather than a switch, because WHICH element a
 * location became is the delivered set's choice (`kind="chest"`), not the build's: the host rewriter writes
 * `{tag, look}` today (`apPlacementRewriter.js`), so every location is still an APItem on p4h too, and a reader that
 * switched rosters on the capability alone would lose all of them.
 */

import { AP_CHEST_CAPABILITY } from '../flashPanel/seedlingRandomizerEligibility.js';

/** The class `botActivators().chests` reports for an AP chest location (`getQualifiedClassName`). */
export const AP_CHEST_CLASS = 'Pickups::APChest';

const parsed = (v) => {
    if (typeof v !== 'string') return v ?? null;
    try { return JSON.parse(v); } catch { return null; }
};

/** Does this capability list put AP chest locations in `botActivators().chests`? */
export const declaresApChest = (capabilities) => (capabilities ?? []).includes(AP_CHEST_CAPABILITY);

/**
 * The AP chest rows of one `botActivators()` reading, on a build declaring `apchest`; `[]` on any other build
 * (whatever the reading holds).
 * @param {string[]|null|undefined} capabilities the build's manifest `capabilities`
 * @param {string|object|null} activators `botActivators()` (raw JSON or parsed)
 * @returns {Array<object>}
 */
export function apChestRowsOf(capabilities, activators) {
    if (!declaresApChest(capabilities)) return [];
    const chests = parsed(activators)?.chests;
    return Array.isArray(chests) ? chests.filter((c) => String(c?.cls ?? '') === AP_CHEST_CLASS) : [];
}

/**
 * The AP-location roster: the `botMobiles` rows, plus — on a build declaring `apchest` — the AP chest rows.
 * @param {Array<object>} mobileRows `botMobiles().mobiles`
 * @param {{capabilities?: string[], activators?: string|object|null}} o
 * @returns {Array<object>}
 */
export function withApChestRows(mobileRows, { capabilities = [], activators = null } = {}) {
    const rows = Array.isArray(mobileRows) ? mobileRows : [];
    const chests = apChestRowsOf(capabilities, activators);
    return chests.length ? [...rows, ...chests] : rows;
}

/**
 * Ask a game surface for `botActivators()` — only on a build declaring `apchest` (null otherwise, or when the
 * export is missing or throws).
 * @param {object|null} game the bridge's `game` (its `botActivators` export)
 * @param {string[]|null|undefined} capabilities
 * @returns {object|null}
 */
export function readActivatorsFor(game, capabilities) {
    if (!declaresApChest(capabilities) || typeof game?.botActivators !== 'function') return null;
    try { return parsed(game.botActivators()); } catch { return null; }
}
