/**
 * apworldEditor — **TEST HELPERS**: the zone-source vitest rows' document builders
 * (`regionContent.test.js`, `recordedZoneConfig.test.js`), and (H2, at the foot) the S2
 * read-back row's target derivation, which the IN-APP row imports — test code only, never the app's.
 *
 * ⛓⛓ APWORLD SUBSTRATE CHANGE R6c. The five pipeline-built jta fixtures were
 * RE-RECORDED with their `procgen_metadata` block (user ruling 2026-09-24). The
 * rows that needed a document WITHOUT a record had read one straight off the
 * corpus, so the re-record turned them red: they pinned what the corpus lacked,
 * not what the code does. A row about the UN-recorded case now builds that
 * document from a copy of the committed fixture, so it reads the same whatever
 * the corpus records.
 */

/** ⛓ A copy of `doc` with slot `player`'s `procgen_metadata` block removed (P1a: the block is per
 *  player; the map goes with its last slot). The input is never mutated. */
export function withoutProcgenMetadata(doc, player) {
    const out = JSON.parse(JSON.stringify(doc));
    delete out.procgen_metadata?.[String(player)];
    if (out.procgen_metadata && Object.keys(out.procgen_metadata).length === 0) delete out.procgen_metadata;
    return out;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ APWORLD SUBSTRATE CHANGE H2 — the S2 read-back row's TARGET, derived by
 * the fact the row later asserts. Shipped to the in-app row
 * (`apworldEditorTests.js` `apworldARegionFormReadsBackTheInitialiseBag`) and
 * pinned by `readBackTarget.test.js` over a FAKE registry order.
 *
 * The row's premise is "the hook's control moves a read-back knob". H1 derived
 * the target by `generationCost` alone, and the registry's order is the page's
 * parallel module-import order, so the filter promoted the next coin-flip draw
 * (trap 1513): a light target whose read-back names NO knob the control moves
 * (its `procgenParamsFromPayload({})` answers `{}`), which failed the row in
 * 0.4 s whenever it registered first. The skip is that FACT, never a name.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ Move ONE knob of `bag` through a hook node's OWN controls: each `input` /
 * `select` under `hookNode` in turn is moved (a number +1 — or the next step —,
 * a select to another enabled option, a checkbox flipped) and a `change`
 * dispatched; the first whose change moves exactly `key` in `bag` (or, with no
 * `key`, exactly one key) is kept, any other is put back.
 * → `{key, from, to}` or `null`. Lifted from the S2 rows' `s2MoveHookKnob`.
 */
export function moveHookKnob(hookNode, bag, key = null) {
    if (!hookNode) return null;
    for (const c of hookNode.querySelectorAll('input, select')) {
        const snap = JSON.stringify(bag);
        const old = c.type === 'checkbox' ? c.checked : c.value;
        if (c.tagName === 'SELECT') {
            const other = [...c.options].find((o) => !o.disabled && o.value !== c.value);
            if (!other) continue;
            c.value = other.value;
        } else if (c.type === 'checkbox') {
            c.checked = !c.checked;
        } else {
            c.value = String(Number(c.value) + Number(c.step || 1));
        }
        c.dispatchEvent(new Event('change', { bubbles: true }));
        const before = JSON.parse(snap);
        const movedKeys = Object.keys(bag).filter((k) => JSON.stringify(bag[k]) !== JSON.stringify(before[k]));
        if (movedKeys.length === 1 && (key === null || movedKeys[0] === key)) {
            return { key: movedKeys[0], from: before[movedKeys[0]], to: bag[movedKeys[0]] };
        }
        if (c.type === 'checkbox') c.checked = old; else c.value = old;
        c.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return null;
}

/** ⛓ The keys an entry's payload read-back NAMES — its answer for an empty payload (the row's own reading). */
export const readBackKeysOf = (entry) => Object.keys(entry?.procgenParamsFromPayload?.({}) ?? {});

/**
 * ⛓ The read-back knob the hook's control moves: the first key `entry`'s
 * read-back names that `moveHookKnob` moves through `hookNode`'s controls
 * over `bag`. → `{key, from, to}` or `null` (no key named, or none moved).
 */
export function moveReadBackKnob(entry, bag, hookNode) {
    for (const key of readBackKeysOf(entry)) {
        const moved = moveHookKnob(hookNode, bag, key);
        if (moved) return moved;
    }
    return null;
}

/** Why a target was passed over (the row's premise line quotes these). */
export const READ_BACK_SKIP = Object.freeze({
    NO_HOOKS: 'no renderProcgenParams + procgenParamsFromPayload',
    HEAVY: 'declares its generation heavy',
    NO_KNOB: 'no knob the control moves',
});

/**
 * ⛓⛓ The read-back row's target: the first of `order` whose entry has both
 * hooks, does not declare its generation heavy, AND whose read-back knob the
 * hook's control moves (`knobMoves(id, entry)` — in the page, the same probe
 * the row asserts, over a detached render of the hook). Probing stops at the
 * chosen target. → `{target, skipped: [{id, reason}]}` (`target` null when
 * none qualifies — the row's premise says so, with every skip).
 *
 * @param {string[]} order the hooked targets in the registry's order
 * @param {(id: string) => object|undefined} entryOf
 * @param {{isHeavy: (entry: object, id: string) => boolean,
 *          knobMoves: (id: string, entry: object) => boolean}} facts
 */
export function readBackTarget(order, entryOf, { isHeavy, knobMoves }) {
    const skipped = [];
    for (const id of order) {
        const e = entryOf(id);
        let reason = null;
        if (typeof e?.renderProcgenParams !== 'function' || typeof e?.procgenParamsFromPayload !== 'function') {
            reason = READ_BACK_SKIP.NO_HOOKS;
        } else if (isHeavy(e, id)) {
            reason = READ_BACK_SKIP.HEAVY;
        } else if (!knobMoves(id, e)) {
            reason = READ_BACK_SKIP.NO_KNOB;
        }
        if (!reason) return { target: id, skipped };
        skipped.push({ id, reason });
    }
    return { target: null, skipped };
}
