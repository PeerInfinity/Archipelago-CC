/**
 * seedlingDemo/saveArrayRules — ⛓⛓ **SEAL DELIVERY: THE MERGE RULE OF EACH SAVE ARRAY**, stated once.
 *
 * The game's three save arrays (`tapeFormat.SAVE_SLOTS`) are three DIFFERENT data structures, and an AP grant
 * reaches each by its own rule. Every consumer (the panel adapter's writes, `wasmDelivery`'s staging and
 * landing, `wasmPlayback`'s declarations, the JS page's boots) asks this table instead of spelling a rule.
 *
 *   `keys`         ⚖ `union` (§5.31 KEY DELIVERY). Each key is its OWN AP item mapped to its own index, so
 *                  the game holds the union of what it picked up and what AP granted.
 *   `totem_parts`  ⚖ `count-fill`. A Totem Shard is ONE fungible AP item with five vanilla frames: N shards
 *                  mean "the game holds at least N indices". A vanilla `BossTotemPart` sets ITS OWN index, so
 *                  a union of the game's set with AP's 0..N-1 would over-count; the missing ones are the
 *                  SMALLEST indices not held.
 *   `seal_parts`   ⚖ `log-append`. `hasSealPart` is an ordered collection LOG: slot = ordinal, value = the seal's
 *                  IDENTITY, -1 = empty (`SealController.getSealPart` fills the first -1 slot;
 *                  `hasAllSealParts()` = the LAST slot filled). N Seals mean "at least N slots filled"; a missing
 *                  slot is APPENDED with the smallest identity the log does not hold (the game's sampler never
 *                  repeats an identity, and `Bot.parseSaveIndices` refuses a repeat).
 *
 * Every rule is SET_IF_MISSING (⚖ §5.31): the first array is the authority and is never shortened, reordered or
 * cleared; the second only extends it. A rule's output for a run AP gave nothing is the first array unchanged.
 *
 * Spellings: `union` / `count-fill` arrays are sorted index lists (`[0, 3]`); a `log-append` array is the log's
 * filled prefix in slot order (`[7, 3]`).
 *
 * ⛔ DOM-FREE, pure, no imports beyond the slot counts.
 */

import { SAVE_SLOTS } from './tapeFormat.js';

/** The rule per save array (see the header). */
export const SAVE_ARRAY_RULES = Object.freeze({ keys: 'union', totem_parts: 'count-fill', seal_parts: 'log-append' });

/** The arrays whose ORDER is content (a positional log, never sorted). */
export const POSITIONAL_SAVE_ARRAYS = Object.freeze(Object.keys(SAVE_ARRAY_RULES).filter((n) => SAVE_ARRAY_RULES[n] === 'log-append'));

const ints = (list) => (list ?? []).filter((i) => Number.isInteger(i));
const sorted = (list) => [...new Set(ints(list))].sort((a, b) => a - b);

function ruleOf(name) {
    const rule = SAVE_ARRAY_RULES[name];
    if (!rule) throw new Error(`saveArrayRules: no merge rule for save.${name} (known: ${Object.keys(SAVE_ARRAY_RULES).join(', ')})`);
    return rule;
}

/**
 * `held` extended by `granted` under `name`'s rule. `held` is the authority (the game's, or the staging's);
 * `granted` is what AP declares (the adapter's writes: indices 0..N-1, or a log of N identities).
 */
export function mergeSaveArray(name, held, granted) {
    const rule = ruleOf(name);
    if (rule === 'union') return sorted([...ints(held), ...ints(granted)]);
    const want = ints(granted);
    const out = rule === 'log-append' ? [...ints(held)] : sorted(held);
    const have = new Set(out);
    // `granted` holds `want.length` distinct values and at most `out.length` of them are held, so its own
    // values always suffice — and taken in order they are the smallest not held (granted is 0..N-1).
    for (const v of want) {
        if (out.length >= want.length) break;
        if (!have.has(v)) { out.push(v); have.add(v); }
    }
    return rule === 'log-append' ? out : out.sort((a, b) => a - b);
}

/**
 * The elements `after` holds that `before` does not, as rows `{array, index[, value]}`: an index for a set
 * rule, a SLOT (+ its identity) for the log. (A merge never removes, so this is the whole delta.)
 */
export function saveArrayDelta(name, before, after) {
    const rule = ruleOf(name);
    if (rule === 'log-append') {
        const b = ints(before);
        return ints(after).slice(b.length).map((value, i) => ({ array: name, index: b.length + i, value }));
    }
    const had = new Set(ints(before));
    return sorted(after).filter((i) => !had.has(i)).map((index) => ({ array: name, index }));
}

/**
 * `held` with the delta `added` (`saveArrayDelta`'s elements) put in: a set takes the indices, the log
 * appends the identities it does not hold. What a re-staging at the arrival adds — never a fill to a count
 * (a delta of 1 over a staging of 1 is 2).
 */
export function addToSaveArray(name, held, added) {
    const rule = ruleOf(name);
    if (rule !== 'log-append') return sorted([...ints(held), ...ints(added)]);
    const out = [...ints(held)];
    for (const v of ints(added)) if (!out.includes(v) && out.length < SAVE_SLOTS.seal_parts) out.push(v);
    return out;
}

/** The game's array off `botStatus.save[name]` in this module's spelling (booleans → indices; the log's filled prefix). */
export function liveSaveArray(name, raw) {
    if (!Array.isArray(raw)) return null;
    if (ruleOf(name) === 'log-append') {
        const firstEmpty = raw.indexOf(-1);
        return firstEmpty === -1 ? [...raw] : raw.slice(0, firstEmpty);
    }
    return raw.flatMap((v, i) => (v ? [i] : []));
}
