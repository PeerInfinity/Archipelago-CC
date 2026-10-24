/**
 * bounceRegionEditor/bounceEditAdapter — **THE BOUNCE LEVEL AS AN `editCore`
 * ADAPTER, AND IT DECLARES NO CELL SPACE** (EDITOR INTEGRATION slice B-b; plan
 * §3.1's bounce row and the widening paragraph after it).
 *
 * ── ⛔⛔ TWO MEMBERS, AND THAT IS THE WHOLE ADAPTER ────────────────────
 *
 * `{name, apply, equal}`. ⛔ `bounds` / `readCell` / `writeOps` are ABSENT —
 * not stubbed, not throwing, absent — because a bounce level has no grid of
 * cells to have them over: platforms, springs, jetpacks, pickups, portals and
 * teleports all live at FLOAT pixel centres in level-local space
 * (`bounceDemo/level.js`'s own model note), and `editorView.js`'s cell reader
 * discards a non-integer cell BY NAME. That refusal is the measured reason the
 * widening exists, and it is why this editor keeps its own click listener and
 * its own hit test instead of mounting `editorView`.
 *
 * ⇒ `hasCellSpace(bounceAdapter)` is `false`; `rectCopy`, `rectPasteOps`,
 * `floodOps`, `descriptorFieldsOf` and `mountEditorView` refuse it by name; and
 * `assertAdapterBehaviour` asks it laws 2–5 and SAYS which three it skipped.
 * (Three, not one — see `CELL_SPACE_LAWS`.)
 *
 * ── ⛓ WHY `equal` IS A DEEP EQUALITY IN WHICH KEY ORDER IS CONTENT ─────
 *
 * B-a's reasoning, on a different subject. The atlas's key order is pinned by
 * BYTE gates; the bounce level's is pinned by a PERSON: `_exportLevel` writes
 * `JSON.stringify(level, null, 2)` to a file called `<region>.level.json`, and
 * a fixture under `bounceDemo/fixtures/` is a hand-authored file somebody
 * diffs. `canonicalJson` would sort the keys at every depth and tell
 * `foldEdits` that an op which only re-ordered them moved nothing — dropping it
 * from the identity while the exported bytes changed underneath. So key order
 * is content here too, and for a reason of its own rather than by analogy.
 *
 * ⚠ IT IS THE SAME 20 LINES AS `atlasEditAdapter.atlasesEqual`, COPIED RATHER
 * THAN IMPORTED, and that is a measurement: importing it would make the bounce
 * editor depend on `regionMarkingTool/atlasEditAdapter.js`, which imports
 * `procgenCore/atlasOps.js` — 1,000+ lines of a DIFFERENT substrate's op
 * vocabulary pulled in for a twenty-line predicate. The two are structurally
 * identical and neither is generic enough to belong in `editCore` (the core
 * ships `canonicalJson`, whose whole point is the opposite convention). If a
 * third adapter wants it, that is the slice that moves it — named here.
 *
 * ── ⛓ AND THERE IS NO `bases` ─────────────────────────────────────────
 *
 * A bounce session is opened on a level somebody else resolved: the panel
 * either reads it out of a live region's `playable_payload.params.bounceLevel`
 * (Edit ▸) or loads a fixture. Neither is a tag this adapter could turn into a
 * record without the panel's help, so `bases` is absent and `resolveBase`
 * refuses by name — the maze's precedent, and B-a's.
 */

import { applyBounceOp } from './bounceLevelOps.js';
import { deepEqualKeyOrder } from '../procgenCore/deepEqualKeyOrder.js';

/**
 * ⛓⛓⛓ **EQUALITY IN WHICH KEY ORDER IS CONTENT** — see the header.
 *
 * ⛓ THE TWENTY LINES MOVED (EDITOR INTEGRATION B-c, plan §15.11): the header's
 * *"if a third adapter wants it, that is the slice that moves it"* came due —
 * the rules document is the third — and they are `procgenCore/deepEqualKeyOrder.js`
 * now. ⛔ THE NAME STAYS, so this file's test rows and every reader of
 * `adapter.equal` are unmoved; the hoist's own test asserts `levelsEqual ===
 * deepEqualKeyOrder`.
 *
 * ⚠ `a === b` FIRST, at every depth, is still the reason it is exact instead of
 * cheap: the ops share every untouched array, so comparing two levels that
 * differ by one platform costs the depth of the one rebuilt spine.
 */
export const levelsEqual = deepEqualKeyOrder;

/**
 * ⛓ THE ADAPTER. A frozen singleton rather than a factory: unlike B-a's, it
 * needs nothing injected — no level view, no schema, no parser. Every op is a
 * function of the level alone.
 */
export const bounceEditAdapter = Object.freeze({
    name: 'bounce',

    /**
     * ⛓ ONE ATOMIC OP. The refusal sentence is `bounceLevelOps`' own — which
     * is, wherever the model has one, `validateLevel`'s own — so the message a
     * refused edit prints in the panel's status line is the message the panel
     * already prints for an invalid level.
     *
     * ⛓⛓ `value` RIDES OUT UNCHANGED and the session forwards it (trap 857,
     * closed in B-b): `session.apply({op:'add-platform'}).value` IS the new
     * platform, so this adapter needs no side slot and no session subclass.
     */
    apply(record, op) {
        const res = applyBounceOp(record, op);
        if (!res.ok) return { ok: false, description: res.error };
        return {
            ok: true,
            description: res.description,
            record: res.level,
            ...(res.value === undefined ? {} : { value: res.value }),
        };
    },

    equal: levelsEqual,
});

export default bounceEditAdapter;
