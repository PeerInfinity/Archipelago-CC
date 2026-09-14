// frontend/modules/procgenCore/exitSides.js
//
// ⛓⛓ PRESET SIDECARS slice M3 — **WHAT ELSE IN A PAYLOAD IS KEYED BY AN EXIT'S
// SIDE**, as a registry-entry declaration (`exitSides`), read by the APWorld
// editor's `move-exit-side` / `swap-exit-sides` ops.
//
// An exit's `side` is not always a place. For a zone game it is a LINKING KEY:
// play resolves `params.sidePortals[exit.side]` to a level portal whose geometry
// does not depend on the side, so moving an exit to another side is a RELABEL —
// the exit's `side`, and every other payload fact that is keyed by it. Which
// facts those are is the substrate's to say (a portal map, a back-exit side, a
// cosmetic arrow …), so the hub names none of them: it asks this slot.
//
//   exitSides: {
//     keys:    ['params.sidePortals', …],  // what the relabel rewrites, as words
//                                          // for a reader (docs, the op's answer)
//     relabel: (payload, moves) => payload' // PURE: clone in, clone out
//   }
//
// ⛓ G2a — `keys` MAY BE EMPTY: a substrate whose side is only where its exit is
// listed (the text adventure's compass) keys nothing else by it, and says so
// with `keys: []` and an identity relabel. An empty list is a DECLARATION
// ("nothing else"); only an absent slot is a refusal.
//
// `moves` is `[{exitId, from, to}]`, applied SIMULTANEOUSLY — one entry for a
// move, two for a swap (a swap is not two moves in a row: the first would land
// on a side the second has not vacated yet). ⛔ `relabel` does NOT write
// `payload.exits` — the op writes those through the substrate's own
// deserialize → serialize pair, the path M2's flag writes already take, so the
// exit records stay in the serializer's form.
//
// ⛔ ABSENT ⇒ REFUSED. An entry that does not declare the slot cannot have an
// exit moved to another side by the hub, because the hub cannot say what else
// in its payload the old side keys. The op words the refusal; this reader
// answers WHY in facts (absent / malformed, by name) — never a default.
//
// ⛓ PIPELINE RELAYOUT R2 — whether a side that already carries an exit may take
// another is answered HERE, from the declaration, for every editor
// (`sideMayHoldAnotherExit`).
//
// ⛔ It lives in procgenCore and imports nothing (`bindingContract.test.js`), so a
// substrate library declares without importing the editor.

/** The registry-entry slot this module reads. */
export const EXIT_SIDES_SLOT = 'exitSides';

/**
 * ⛓⛓ PIPELINE RELAYOUT R2 — **THE ONE SIDE-AGNOSTIC DECLARATION.** A substrate
 * whose exit side is only WHERE the exit is listed or labelled — nothing else in
 * its payload keyed by it — declares this object, never a copy of it: `keys` is
 * empty and the relabel is the identity (a clone: the op writes the exits through
 * the substrate's own serializer). Declared by the text adventure (the 3×3
 * compass), jta (the exit-choice task's label) and omsi (the synthetic exit
 * action's label) — ⚖ the user, 2026-09-13 (relayout plan §5 Q3).
 */
export const SIDE_AGNOSTIC_EXIT_SIDES = Object.freeze({
    keys: Object.freeze([]),
    relabel: (payload) => structuredClone(payload),
});

/**
 * The `exitSides` declaration of a registry entry, or why there is none.
 *
 * @param {object|undefined} entry a substrate registry entry
 * @returns {{decl: {keys: string[], relabel: Function}} | {absent: true} | {malformed: string}}
 *   `malformed` names what is wrong, in words the op quotes after the substrate.
 */
export function exitSidesOf(entry) {
    const decl = entry?.[EXIT_SIDES_SLOT];
    if (decl === undefined) return { absent: true };
    if (!decl || typeof decl !== 'object' || Array.isArray(decl)) {
        return { malformed: `its \`${EXIT_SIDES_SLOT}\` is ${JSON.stringify(decl)}, not an object` };
    }
    if (typeof decl.relabel !== 'function') {
        return { malformed: `its \`${EXIT_SIDES_SLOT}.relabel\` is ${typeof decl.relabel}, not a function` };
    }
    if (!Array.isArray(decl.keys) || decl.keys.some((k) => typeof k !== 'string' || !k)) {
        return {
            malformed: `its \`${EXIT_SIDES_SLOT}.keys\` is ${JSON.stringify(decl.keys)}, not a list of the `
                + 'payload paths the relabel rewrites (empty when it rewrites none)',
        };
    }
    return { decl };
}

/**
 * ⛓⛓ PIPELINE RELAYOUT R2 — the verdicts of `sideMayHoldAnotherExit`, as words
 * a caller branches on (never a string it types).
 */
export const SIDE_SHARING = Object.freeze({
    /** declares `exitSides` with EMPTY `keys`: nothing in the payload is keyed by a side */
    SIDE_AGNOSTIC: 'side-agnostic',
    /** declares `exitSides` with keys: those payload facts hold ONE value per side */
    KEYED: 'keyed',
    /** declares no `exitSides`: nobody has said what a side keys */
    ABSENT: 'absent',
    /** declares a malformed `exitSides` */
    MALFORMED: 'malformed',
});

/**
 * ⛓⛓⛓ **MAY A SIDE THAT ALREADY CARRIES AN EXIT TAKE ANOTHER ONE?** (PIPELINE
 * RELAYOUT R2 — the ONE rule every exit-side editor asks.)
 *
 * The law, in words: a region's side may hold a second exit **iff its
 * substrate declares `exitSides` with an EMPTY `keys` list** — the declaration
 * that nothing in its payload is keyed by a side, so two exits on one side
 * collide nowhere (the text adventure's compass lists both). A declaration WITH
 * keys says some payload fact holds one value per side (the zone family's
 * `params.sidePortals`), so a second exit there would overwrite the first: the
 * answer is no. A substrate that declares nothing, or declares it malformed,
 * has not said what a side keys, so the answer is no for a DIFFERENT reason —
 * the caller refuses it by that absence, not by a side collision.
 *
 * ⛔ No substrate name and no list: the declaration is the only input.
 *
 * @param {object|undefined} entry a substrate registry entry
 * @returns {{may: true, reason: 'side-agnostic'}
 *   | {may: false, reason: 'keyed', keys: string[]}
 *   | {may: false, reason: 'absent'}
 *   | {may: false, reason: 'malformed', malformed: string}}
 */
export function sideMayHoldAnotherExit(entry) {
    const got = exitSidesOf(entry);
    if (got.absent) return { may: false, reason: SIDE_SHARING.ABSENT };
    if (got.malformed) return { may: false, reason: SIDE_SHARING.MALFORMED, malformed: got.malformed };
    if (got.decl.keys.length > 0) return { may: false, reason: SIDE_SHARING.KEYED, keys: [...got.decl.keys] };
    return { may: true, reason: SIDE_SHARING.SIDE_AGNOSTIC };
}
