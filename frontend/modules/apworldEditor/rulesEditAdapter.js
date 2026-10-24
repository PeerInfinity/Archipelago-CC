/**
 * apworldEditor/rulesEditAdapter — **THE `rules.json` DOCUMENT AS AN `editCore`
 * ADAPTER, AND IT IS THE SECOND CELL-LESS ONE** (EDITOR INTEGRATION slice B-c;
 * plan §3.1's APWorld row, §15.11 #1–#3).
 *
 * ── ⛔⛔ TWO MEMBERS, AND THAT IS THE WHOLE ADAPTER ────────────────────
 *
 * `{name, apply, equal}`. ⛔ `bounds` / `readCell` / `writeOps` are ABSENT —
 * not stubbed, not throwing, absent — because this editor **has no canvas at
 * all**: a `rules.json` is regions, exits, locations, items and rule trees, and
 * there is no (x, y) anywhere in it to read a cell at. That is the second of
 * the two substrates the widening's own refusal sentence names by name.
 *
 * ⇒ `hasCellSpace(rulesEditAdapter)` is `false`; `rectCopy`, `rectPasteOps`,
 * `floodOps`, `descriptorFieldsOf` and `mountEditorView` refuse it by name; and
 * `assertAdapterBehaviour` asks it laws 2–5 and SAYS which three it skipped.
 * ⛓ Nothing here was added to the core for it — B-b's widening was written for
 * two substrates and this is the second, so the whole cost of being cell-less
 * is the three members this file does not declare.
 *
 * ── ⛓ `equal` IS THE HOISTED PREDICATE ────────────────────────────────
 *
 * `procgenCore/deepEqualKeyOrder` — a deep equality in which KEY ORDER IS
 * CONTENT. §15.11 left B-c the decision of whether the third copy should move
 * the twenty lines; it did, and this adapter is the third caller rather than
 * the third copy.
 *
 * ⛔ IT IS NOT `canonicalJson`, AND FOR THIS DOCUMENT THAT MATTERS MOST OF THE
 * THREE. `cloneFullRulesDoc` exists precisely to preserve every top-level key
 * IN PLACE — `procgen_metadata` carries `sphere_tree` / `sphere_plan` and a
 * grown world must round-trip it to stay re-growable — and Apply republishes
 * the document for the exporter to read. A sorting `equal` would tell
 * `foldEdits` that a key-order-only op moved nothing, drop it from the
 * identity, and let the published bytes move underneath a record that says
 * they did not.
 *
 * ── ⛓ AND THERE IS NO `bases` ─────────────────────────────────────────
 *
 * An APWorld session is opened on a document somebody else resolved, and there
 * are exactly three such somebodies: the app's `stateManager:rawJsonDataLoaded`
 * event, `getLastRawJsonData()`, and the marking tool's `apworldEditor:loadRules`
 * hand-off. None is a tag this adapter could turn into a record without the
 * panel's event bus, so `bases` is absent and `resolveBase` refuses by name —
 * the maze's precedent, B-a's, and bounce's.
 */

import { deepEqualKeyOrder } from '../procgenCore/deepEqualKeyOrder.js';
import { applyRulesDocOp } from './rulesDocOps.js';

/**
 * ⛓ THE ADAPTER. A frozen singleton rather than a factory: like bounce's and
 * unlike B-a's, it needs nothing injected — no level view, no schema, no
 * parser. Every op is a function of the document alone, and the one thing that
 * might have been injected (the player slot) is an op FIELD with a default,
 * because a document holds every slot and an adapter frozen to one could not
 * fold an edit list that named another.
 */
export const rulesEditAdapter = Object.freeze({
    name: 'apworld',

    /**
     * ⛓ ONE ATOMIC OP. The refusal sentence is `rulesDocOps`' own — which is,
     * wherever the op breaks a reference, `validateRules`' own, quoted from a
     * run over the document the op would have produced. So the message a
     * refused edit prints in the status line is the message the validation bar
     * already prints for a broken document.
     *
     * ⛓⛓ `value` RIDES OUT UNCHANGED and the session forwards it (trap 857,
     * closed in B-b): `session.apply({op:'add-region'}).value` IS the new
     * region, so this adapter needs no side slot and no session subclass —
     * §15.11 #3, and the reason there is no `rulesEditSession.js`.
     */
    apply(record, op) {
        const res = applyRulesDocOp(record, op);
        if (!res.ok) return { ok: false, description: res.error };
        return {
            ok: true,
            // ⛓ THE RESOLVED OP, forwarded: `rulesDocOps` returns a private copy
            //   of the op with every drawn parameter spent, and `editCore`
            //   records `res.op ?? op`. Dropping it here would put the CALLER's
            //   mutable object in the edit list — the defect the first browser
            //   run found.
            op: res.op,
            description: res.description,
            record: res.doc,
            ...(res.value === undefined ? {} : { value: res.value }),
        };
    },

    equal: deepEqualKeyOrder,
});

export default rulesEditAdapter;
