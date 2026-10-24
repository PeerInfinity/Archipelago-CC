/**
 * procgenCore/densityBlock.js — **THE DENSITY IDENTITY BLOCK: SIX LEVERS, ONE
 * LINE, ONE SPELLING, BOTH SUBSTRATES.**
 *
 * ⚖ PROCGEN ELEMENTS arc 5 §3.6, the arc's last mechanism: *"One declared
 * identity block — kind, `chambers=k`, size, fill, element list,
 * `obstacleTarget` — printed in the identity line … published as a measured
 * table (what each setting buys, per kind/size). No new mechanism; the
 * chamber/arena elements are the levers, the dial is naming + measurement."*
 *
 * ── ⛔⛔ IT READS. IT DOES NOT COMPUTE, AND IT DOES NOT STORE ──────────
 *
 * Every field below is a value the caller ALREADY HAS — the skeleton spec it
 * generated from, the room the record was built at, the fill it asked for, the
 * element head the stream resolved, the target the bounds carry. ⛔ Nothing
 * here re-derives one of them from the finished level:
 *
 *   - `fill` is the DECLARED fill, never a guess from the written-cell count.
 *     Arc 5 slice 1 measured the case that separates them: `fill=shell` on an
 *     OPEN room strips **0%** — every wall of the border ring touches floor —
 *     so a block that recomputed the word from `tiles.length === w*h` would
 *     print `dense` about a level generated `shell`, and the page and the CLI
 *     would then disagree about what the same run WAS.
 *   - `chambers` is the RESOLVED skeleton parameter (`resolveSkeletonParams`),
 *     not a count of chambers found in the carve — the knob is what a reader
 *     can set; what it yields is the census's column.
 *   - the ELEMENT is the head AS RESOLVED — the one the `+` list's `pick`
 *     landed on — because *"guard+blockpocket+chamber;w=2;h=3"* names four
 *     possible rooms and only one of them was built.
 *
 * ⛔⛔ **AND IT ADDS NO PAYLOAD FIELD.** ⚖ The arc's ONE re-record was spent by
 * slice 6a on the biome default; a `density:` key on `summary` would move every
 * committed Seedling payload for a string that is a projection of five fields
 * already on it. The block is spelled at PRINT time, by this function, from
 * what the record and the summary already carry — which is also why the page
 * and the CLI cannot drift: there is one spelling and they both call it.
 *
 * ── THE SIX FIELDS, IN ONE ORDER ──────────────────────────────────────
 *
 *   kind=<skeleton kind>       what carves the room
 *   chambers=<n|n/a>           the area lever — `n/a` where the kind declares
 *                              no `chambers` knob (`empty`, `classic`,
 *                              `corridor`: the open room's interior IS its
 *                              one chamber and there is no knob to turn)
 *   size=<w>x<h>               arc 5 slice 1's channel, ≤ 60x60
 *   fill=<dense|shell>         arc 5 slice 1's format; `dense` on the maze,
 *                              which writes its grid whole and has no knob
 *   element=<spec|none>        the head AS RESOLVED, in the URL's spelling
 *   target=<obstacleTarget>    how many obstacles pass 2 was asked for
 *
 * ⛓ ALL SIX ARE ALWAYS PRINTED, which is the one place this line breaks the
 * identity line's own house rule (*a clause on every level is a clause a reader
 * stops reading* — `skeleton:`/`room:`/`fill:` are all named only when they are
 * not the default). ⛔ Deliberate, and the reason is what the block is FOR: a
 * DIAL is read by seeing every position at once. A block that dropped `fill` at
 * `dense` would make two of its six settings visible only by their absence,
 * which is exactly the reading a density comparison cannot do.
 *
 * ⛔ THE BLOCK IS THE SETTINGS, NEVER THE YIELD. Two levels with the same block
 * can hold very different amounts of stuff — one placed its element, one refused
 * — and that is the point: the block names the DIAL POSITION and
 * `scripts/procgen/census-seedling-density.mjs` is the table that says what each
 * position buys. The refusal has its own line, on both pages and both CLIs.
 */

import { formatElementSpec } from './elementSpec.js';
import { normalizeSkeleton, paramSchemaFor, resolveSkeletonParams } from './skeletonKinds.js';

/** The block's own separator and its label, spelled once. */
const SEP = ' · ';
export const DENSITY_LABEL = 'density';

/**
 * ⛓ The `chambers` knob is a SKELETON parameter and not every kind declares
 * one. ⛔ `n/a` rather than `0`: a reader who sees `chambers=0` may reasonably
 * ask for `chambers=1`, and on `empty` that refuses by name.
 */
export function chambersOf(skeleton) {
    const norm = normalizeSkeleton(skeleton ?? { kind: 'empty' });
    if (!paramSchemaFor(norm.kind).some((p) => p.key === 'chambers')) return 'n/a';
    return String(resolveSkeletonParams(norm.kind, norm.params ?? {}).chambers);
}

/**
 * **THE BLOCK.** Every argument is a value the caller already holds.
 *
 * @param {object}  o
 * @param {object}  o.skeleton        the skeleton spec `{kind, params}`
 * @param {number}  o.width           the room's width, from the RECORD
 * @param {number}  o.height          the room's height, from the RECORD
 * @param {string}  [o.fill]          the DECLARED fill; `dense` where there is
 *                                    no knob
 * @param {object}  [o.element]       the element spec AS RESOLVED, or null
 * @param {number}  o.obstacleTarget  `bounds.obstacleTarget`
 * @returns {string} `kind=… · chambers=… · size=…x… · fill=… · element=… · target=…`
 */
export function densityBlock({
    skeleton, width, height, fill = 'dense', element = null, obstacleTarget,
} = {}) {
    const kind = normalizeSkeleton(skeleton ?? { kind: 'empty' }).kind;
    /** ⛓ `formatElementSpec` is the URL's own spelling, so the block names the
     *  element the way the address bar and both CLIs do. */
    const spec = element ? formatElementSpec(element) : 'none';
    return [
        `kind=${kind}`,
        `chambers=${chambersOf(skeleton)}`,
        `size=${width}x${height}`,
        `fill=${fill}`,
        `element=${spec}`,
        `target=${obstacleTarget}`,
    ].join(SEP);
}

/** The block with its label — the form the identity lines and the CLIs print. */
export function densityLine(readings) {
    return `${DENSITY_LABEL}: ${densityBlock(readings)}`;
}

export default densityBlock;
