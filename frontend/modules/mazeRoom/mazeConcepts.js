/**
 * mazeRoom/mazeConcepts — **THE MAZE'S HALF OF THE CONCEPT LIBRARY**
 * (concept library T1; plan `concept-library-plan.md` §3.1, ⚖ the user Q-F:
 * a maze realisation is a SKIN over the logic gate, accepted for the trial).
 *
 * The planner fixes each gate's rule and hands it to `placeFromRules`, which
 * realises it as a `logic_gate_<n>` clone ON the target tile carrying the rule
 * as `clear_rule`. When the world names concepts (`params.concepts`) and a
 * planned rule is EXACTLY what one of the realisations below needs
 * (`conceptSelection.selectRealisation`), the clone is registered as that
 * concept instead — `guardian_gate_<n>` / `water_gate_<n>` — with the SAME
 * `clear_set_type: 'rule'` and the SAME `clear_rule`. The concept changes the
 * picture (the renderer paints it), never the logic.
 *
 *   sword, swim   `mechanic` — a pickup IS the maze's mechanic for an item
 *   guardian      `skin` gate, needs the sword
 *   water         `skin` gate, needs swim
 *
 * ⛓ CONTENT SETS R2 — **the LOGIC half only.** A gate's name, colour and
 * symbol, and an item concept's colour and symbol, are CONTENT: they live in
 * the maze's default content pack (`frontend/packs/maze/`, the entry's
 * `defaultContentPack`), one pack concept per realised mechanic that
 * `presents` it and carries a `look`, and generation resolves them through the
 * world's content set (`params.contentSet`, `presentedLook`) and writes them
 * into the world document, as before (⚖ Q8). Which row a role writes, and
 * which fields, is behaviour (⚖ Q6) and stays here: `MAZE_CONTENT_ROLES`.
 *
 * ⛔ NO `libraryItems` (T1, measured): top-down grants every in-mix
 * substrate's `libraryItems` as free starting items, so a static declaration
 * moved the shipped top-down presets with no concept named. The item rows of a
 * concept the WORLD names join that world's item library
 * (`presetRun.mergedItemLib`, from the table's `itemRowsOf`).
 *
 * ⛔ No DOM, no panel, no registry import: the engine imports this (the placer
 * selects through it) and so does `mazeRoomLibrary.js` (`loadable: true`).
 */

import { CONCEPTS } from '../procgenCore/concepts.js';
import { selectRealisation } from '../procgenPipeline/conceptSelection.js';
import { candidatesForRole } from '../procgenCore/contentRoles.js';

/** ⛓⛓ The maze's `conceptRealisations` (checked by `assertRealisations` in the entry's test). */
export const MAZE_CONCEPT_REALISATIONS = Object.freeze({
    sword: Object.freeze({ tier: 'mechanic' }),
    swim: Object.freeze({ tier: 'mechanic' }),
    guardian: Object.freeze({
        tier: 'skin',
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires', needs: Object.freeze(['sword']),
                mechanic: Object.freeze({ obstacle: 'guardian_gate' }),
            }),
        }),
    }),
    water: Object.freeze({
        tier: 'skin',
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires', needs: Object.freeze(['swim']),
                mechanic: Object.freeze({ obstacle: 'water_gate' }),
            }),
        }),
    }),
});

/** ⛓ CONTENT SETS R2 — the pack whose looks a world gets when it names no theme (the entry's `defaultContentPack`). */
export const MAZE_DEFAULT_CONTENT_PACK = 'maze';

/**
 * ⛓⛓ CONTENT SETS R2 — **WHAT THE MAZE CAN SHOW FROM A PACK** (the entry's
 * `contentRoles`; contract `procgenCore/contentRoles.js`). Two roles, split by
 * what the maze WRITES from them (`ROLE_WRITES`): a gate takes the concept's
 * name and look; an item takes its look only, because an item row's name is
 * the AP item name, which is logic.
 */
export const MAZE_CONTENT_ROLES = Object.freeze({
    gate: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['guardian', 'water']) }),
        needs: Object.freeze({ look: true }),
        why: 'A rule gate the planner selected a concept for is named and painted as that concept.',
    }),
    item: Object.freeze({
        accepts: Object.freeze({ presents: Object.freeze(['sword', 'swim']) }),
        needs: Object.freeze({ look: true }),
        why: 'An item concept the world names is drawn on its tile in the concept\'s colour and symbol.',
    }),
});

/** ⛓ Which fields of a resolved pack concept each role writes into its row (Q6: behaviour, so code). */
const ROLE_WRITES = Object.freeze({
    gate: Object.freeze(['name', 'color', 'symbol']),
    item: Object.freeze(['color', 'symbol']),
});

/** ⛓ The maze's refusals for content, by name. */
export const MAZE_CONTENT_REFUSALS = Object.freeze({
    noContentSet: (what, conceptId) => `maze ${what}: the world offers "${conceptId}", and no content set was `
        + 'handed in (params.contentSet): its look lives in a content pack, so the caller loads one (the region '
        + 'seam does: assertContentLoaded)',
    noPresenter: (what, conceptId, roleId, ids) => `maze ${what}: no pack in the content set [${ids.join(', ')}] `
        + `presents "${conceptId}" with what the "${roleId}" role needs (a look)`,
});

/**
 * ⛓⛓ CONTENT SETS R2 — **A MECHANIC'S LOOK, FROM THE WORLD'S CONTENT SET.**
 * The pack concepts that fill `roleId` (`candidatesForRole`: right `presents`,
 * a `look`) and present `conceptId`, latest pack in the stack first; the first
 * gives `{name, color, symbol}`. So a later pack that presents the mechanic
 * with a look wins, and one that presents it WITHOUT a look (the text
 * adventure's default pack does) falls through to an earlier pack — in the end
 * the maze's own. `null` when no pack in the set fills the role for it.
 *
 * @param {{ids: string[], concepts: object}} contentSet
 * @param {string} roleId a role of `MAZE_CONTENT_ROLES`
 * @param {string} conceptId a mechanic concept id
 * @returns {{name: string, color: string, symbol: string}|null}
 */
export function presentedLook(contentSet, roleId, conceptId) {
    const { ids, concepts } = contentSet;
    const rank = (key) => ids.indexOf(concepts.get(key).pack);
    const key = candidatesForRole(MAZE_CONTENT_ROLES, roleId, concepts)
        .filter((k) => concepts.get(k).presents === conceptId)
        .sort((a, b) => rank(b) - rank(a))[0];
    if (!key) return null;
    const c = concepts.get(key);
    return { name: c.name, color: c.look.color, symbol: c.look.symbol };
}

/** `presentedLook` reduced to the fields `roleId` writes, refused by name when the set is absent or fills nothing. */
function lookFor(contentSet, what, roleId, conceptId) {
    if (!contentSet) throw new Error(MAZE_CONTENT_REFUSALS.noContentSet(what, conceptId));
    const look = presentedLook(contentSet, roleId, conceptId);
    if (!look) throw new Error(MAZE_CONTENT_REFUSALS.noPresenter(what, conceptId, roleId, contentSet.ids));
    return Object.fromEntries(ROLE_WRITES[roleId].map((f) => [f, look[f]]));
}

/**
 * ⛓⛓ CONTENT SETS R2 — **THE ITEM LIBRARY, PRESENTED.** Every row the world's
 * concept list added (`presetRun.mergedItemLib` marks it `concept: '<id>'`)
 * whose concept the `item` role accepts gets that concept's colour and symbol
 * from the content set, IN PLACE of its own (key order kept: the row's own
 * `color` / `symbol` slots are overwritten). Returns the SAME object when no
 * row is marked (a world that names no item concept: nothing is read, and no
 * set is needed); otherwise a new object, so a library shared between regions
 * is never mutated.
 *
 * @param {Record<string, object>} itemLib
 * @param {object|null|undefined} contentSet
 */
export function presentItemLib(itemLib, contentSet) {
    const accepts = MAZE_CONTENT_ROLES.item.accepts.presents;
    const marked = Object.entries(itemLib ?? {}).filter(([, def]) => accepts.includes(def?.concept));
    if (!marked.length) return itemLib;
    const out = { ...itemLib };
    for (const [id, def] of marked) out[id] = { ...def, ...lookFor(contentSet, `item "${id}"`, 'item', def.concept) };
    return out;
}

/** ⛓ `rng.choice` when the stream has it (the shared `rng.js`), else the same draw over `next()`. */
const chooser = (rng) => (typeof rng?.choice === 'function'
    ? rng
    : { choice: (arr) => arr[Math.floor(rng.next() * arr.length)] });

/**
 * ⛓⛓ **THE GATE A PLANNED RULE BECOMES** — `null` (keep today's `logic_gate`),
 * or `{id, def}` for a concept gate: the logic gate's own def with the concept's
 * id prefix, name, colour and symbol, the concept and placement named, and the
 * SAME `clear_set_type: 'rule'` + `clear_rule`. An empty or absent `offered`
 * spends no draw (T0's contract), so a concept-less world never reaches here
 * with a candidate.
 *
 * ⛓ CONTENT SETS R2 — the name, colour and symbol are the `gate` role's,
 * resolved from `contentSet` (`presentedLook`) AFTER the draw, so the set
 * never changes which concept is chosen. A selected concept with no set, or
 * no pack presenting it with a look, is refused by name.
 *
 * @param {object} rule the planned Rule Builder rule
 * @param {{offered?: string[], rng: object, n: number, logicGateBase: object, contentSet?: object}} o
 */
export function conceptGateFor(rule, { offered, rng, n, logicGateBase, contentSet }) {
    const cand = selectRealisation(rule, MAZE_CONCEPT_REALISATIONS, { concepts: CONCEPTS, offered, rng: chooser(rng) });
    if (!cand) return null;
    const id = `${cand.mechanic?.obstacle ?? `${cand.concept}_gate`}_${n}`;
    return {
        id,
        def: {
            ...logicGateBase,
            id,
            clear_set_type: 'rule',
            clear_rule: rule,
            concept: cand.concept,
            placement: cand.placement,
            ...lookFor(contentSet, `gate "${id}"`, 'gate', cand.concept),
        },
    };
}

/**
 * ⛓⛓ **THE SKIN, PAINTED** (D3) — a `rule` gate that carries a `concept` is
 * drawn as the concept: its colour as an inset square with its symbol, and,
 * once cleared, the dimmed dashed outline the coloured door uses (the combo-list
 * door's own idiom in `mazeRoomRender.drawWorld`). A plain `logic_gate` is never
 * passed here, so it draws exactly as before. Takes `ctx`; touches no DOM.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x0: number, y0: number, px: number, def: object, cleared: boolean}} o
 *   the tile's canvas origin and size, the gate's obstacle definition
 */
export function paintConceptGate(ctx, { x0, y0, px, def, cleared }) {
    const color = def.color ?? '#b06eb8';
    ctx.save();
    if (cleared) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x0 + 3, y0 + 3, px - 6, px - 6);
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(x0 + 2, y0 + 2, px - 4, px - 4);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 2, y0 + 2, px - 4, px - 4);
    }
    if (def.symbol) {
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.floor(px * 0.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.symbol, x0 + px / 2, y0 + px / 2);
    }
    ctx.restore();
}

/** ⛓ Is this obstacle definition a concept's skin (a `rule` gate that names its concept)? */
export const isConceptGate = (def) => def?.clear_set_type === 'rule' && typeof def.concept === 'string';
