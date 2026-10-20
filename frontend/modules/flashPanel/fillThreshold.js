/**
 * ⛓⛓ R4b part 2 (rules-boss-host) — **A THRESHOLD FILL, STATED ONCE.**
 *
 * A fill item whose LAST slot is a door (Seedling's seal log: `SealController.hasAllSealParts()` reads slot 16 of
 * 16) and whose world sets how many copies open it (`seals_required`, 1..23). N copies held map to slots:
 *   · `count >= required` → ALL `slots` (the Nth copy opens the door, whatever N is);
 *   · otherwise `min(count, slots - 1)` — one slot per copy, the door's slot held back until N; nothing is ever
 *     written past `slots`.
 * `required` absent (an old preset, a world without the option) → `min(count, slots)`, the plain fill.
 * With `required === slots` the two are the same function.
 *
 * Two readers, one statement: the panel adapter's fill writes (`flashBridgeAdapter._fillWritesFor`, a `fill`
 * that names `required`) and `seedlingDemo/saveArrayRules.sealLogSlots` (the survey's and the staging's).
 *
 * ⛔ No imports: the adapter is in the shipped bundle and `saveArrayRules` reaches `tapeFormat` (136 KB).
 *
 * @param {number} count     copies held (a non-negative integer)
 * @param {number} slots     the fill's slot count
 * @param {number|null|undefined} [required]  copies that open the last slot; absent = the plain fill
 * @returns {number} the slots to fill
 */
export function thresholdFillSlots(count, slots, required = null) {
    if (!Number.isInteger(count) || count < 0) {
        throw new Error(`fillThreshold: a copy count must be a non-negative integer, got ${JSON.stringify(count)}`);
    }
    if (!Number.isInteger(slots) || slots < 1) {
        throw new Error(`fillThreshold: a fill needs a positive integer slot count, got ${JSON.stringify(slots)}`);
    }
    if (required === null || required === undefined) return Math.min(count, slots);
    if (!Number.isInteger(required) || required < 1) {
        throw new Error(`fillThreshold: the copies required must be a positive integer, got ${JSON.stringify(required)}`);
    }
    return count >= required ? slots : Math.min(count, slots - 1);
}
