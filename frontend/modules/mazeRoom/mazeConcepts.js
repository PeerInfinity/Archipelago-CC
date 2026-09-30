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
 * ⛓ The gates' colour and symbol are the maze's own `art`: the neutral table
 * gives `guardian` and `water` no presentation (T1 finding), and a realisation's
 * `art` is where a substrate's picture of a concept goes.
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

/** ⛓⛓ The maze's `conceptRealisations` (checked by `assertRealisations` in the entry's test). */
export const MAZE_CONCEPT_REALISATIONS = Object.freeze({
    sword: Object.freeze({ tier: 'mechanic' }),
    swim: Object.freeze({ tier: 'mechanic' }),
    guardian: Object.freeze({
        tier: 'skin',
        art: Object.freeze({ name: 'Guardian', color: '#8c5a2c', symbol: 'G' }),
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires', needs: Object.freeze(['sword']),
                mechanic: Object.freeze({ obstacle: 'guardian_gate' }),
            }),
        }),
    }),
    water: Object.freeze({
        tier: 'skin',
        art: Object.freeze({ name: 'Water', color: '#2f6fd0', symbol: '~' }),
        placements: Object.freeze({
            gate: Object.freeze({
                effect: 'requires', needs: Object.freeze(['swim']),
                mechanic: Object.freeze({ obstacle: 'water_gate' }),
            }),
        }),
    }),
});

/** The shape `selectRealisation` reads — the maze's realisations, and nothing else of the entry. */
const REALISER = Object.freeze({ conceptRealisations: MAZE_CONCEPT_REALISATIONS });

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
 * @param {object} rule the planned Rule Builder rule
 * @param {{offered?: string[], rng: object, n: number, logicGateBase: object}} o
 */
export function conceptGateFor(rule, { offered, rng, n, logicGateBase }) {
    const cand = selectRealisation(rule, REALISER, { concepts: CONCEPTS, offered, rng: chooser(rng) });
    if (!cand) return null;
    const art = MAZE_CONCEPT_REALISATIONS[cand.concept]?.art ?? {};
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
            ...(art.name !== undefined ? { name: art.name } : {}),
            ...(art.color !== undefined ? { color: art.color } : {}),
            ...(art.symbol !== undefined ? { symbol: art.symbol } : {}),
        },
    };
}
