/**
 * procgenCore/paletteRoster — **THE SUB-ROSTER**, and the CATALOGUE that shows
 * what a palette holds. Substrate-agnostic, one spelling for both lab pages.
 *
 * ── ⛓ WHY IT LEFT `seedlingDemo/procgenPalette.js` IN SLICE 3 ─────────
 *
 * CONSTRUCTIVE-MODE slice 2's as-built (§9.1) recorded these three as STAYING,
 * and named the line that decided it: *"the roster/URL spellings of the Seedling
 * page"*. ⛓ THAT LINE IS NOW FALSE — there is a second page, `mazeRoom/
 * lab.html`, with the same `?families=`/`?templates=` spelling and the same
 * catalogue, so "the Seedling page's spellings" describes neither of them.
 * Re-read against the code: not one of the three touches a Seedling fact. They
 * read `palette.name`, `palette.templates[].{name, family, params, why}`,
 * `palette.excluded[]` and `palette.items` — the shape `procgenCore/
 * templateContract.defineTemplate` produces, which is the CORE's own vocabulary
 * and is exactly what `mazeRoom/procgenMaze.MAZE_PALETTE` is built out of.
 *
 * ⛔ THE ALTERNATIVE WAS A MAZE COPY, and a second `normalizeRoster` is a second
 * answer to *"what may this run draw from"* — the failure mode the refusals
 * below are written against, one level up. `procgenPalette.js` re-exports all
 * three, so no Seedling caller learns the move happened.
 *
 * ⚠ WHAT STAYED IN `procgenPalette.js`, and the line that decides it:
 * `assertPalette` (three Seedling facts in one function — `TERRAIN`, the
 * `door !== 'h'/'v'` rule, the group/tag slots), `CLEARER_STRATEGY`/`verbOf`/
 * `dischargesVerb` (keyed on the Seedling SOLVER's strategy names), and the
 * geometry helpers (`cell`/`paint`/`at`'s transpose is wave-1 door geometry).
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both pages load this in a browser.
 */

export class PaletteRosterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaletteRosterError';
    }
}

const fail = (message) => { throw new PaletteRosterError(message); };

/**
 * A restriction, validated against the palette it restricts and normalized —
 * or `null`, which means THE WHOLE ROSTER.
 *
 * ⛔ AN UNKNOWN NAME REFUSES BY NAME AND LISTS THE ROSTER, and never silently
 * drops the member. A typo that dropped one member of a two-member restriction
 * would WIDEN the roster the run draws from — a level generated under a roster
 * nobody asked for, which is exactly the class of defect this arc keeps
 * refusing (`paletteFor`'s biome refusal is the same argument one level up).
 *
 * ⛔ AN EMPTY LIST REFUSES TOO, rather than meaning "everything". `absent` is
 * how the whole roster is spelled; a restriction that names nothing is a
 * control that has been emptied, and `levelGenerator` would meet it as "an
 * empty palette is a finding ABOUT THE PALETTE".
 */
export function normalizeRoster(palette, roster) {
    if (roster === null || roster === undefined) return null;
    if (typeof roster !== 'object' || Array.isArray(roster)) {
        fail(`paletteRoster: a restriction must be {axis, names} or null, got `
            + `${JSON.stringify(roster)}. Null is how "the whole roster" is spelled.`);
    }
    const { axis, names } = roster;
    if (axis !== 'families' && axis !== 'templates') {
        fail(`paletteRoster: a restriction's axis must be "families" or "templates", got `
            + `${JSON.stringify(axis)}. The axis is part of the restriction because a `
            + 'name alone is ambiguous — "arrow-lane" is both a family and a template.');
    }
    if (!Array.isArray(names) || names.some((n) => typeof n !== 'string' || !n)) {
        fail(`paletteRoster: a restriction's names must be a list of non-empty strings, `
            + `got ${JSON.stringify(names)}.`);
    }
    const roster_ = palette?.templates ?? [];
    const available = axis === 'families'
        ? [...new Set(roster_.map((t) => t.family))]
        : roster_.map((t) => t.name);
    const wanted = [...new Set(names)].sort();
    if (wanted.length === 0) {
        fail(`paletteRoster: an EMPTY restriction on "${axis}" names nothing to draw from. `
            + `Palette "${palette?.name}" offers [${available.join(', ')}]; omit the `
            + 'restriction entirely to draw from the whole roster. An empty palette is a '
            + 'finding ABOUT THE PALETTE, not a run that quietly places nothing.');
    }
    for (const n of wanted) {
        if (!available.includes(n)) {
            fail(`paletteRoster: restriction on "${axis}" names ${JSON.stringify(n)}, which `
                + `palette "${palette?.name}" does not offer — it has `
                + `[${available.join(', ')}]. ⛔ An unknown member is REFUSED rather than `
                + 'dropped: silently dropping it would WIDEN the roster the run draws '
                + 'from, and the level would be certified under a roster nobody asked for.');
        }
    }
    return Object.freeze({ axis, names: Object.freeze(wanted) });
}

/**
 * THE SUB-ROSTER A RUN MAY DRAW FROM — a palette object of the same shape,
 * handed to the same loop.
 *
 * ⛔ **THE SUBSET KEEPS ROSTER ORDER AND THE SAME FROZEN BASE OBJECTS.**
 * `rng.pick` indexes a list, so the ORDER is part of the level's identity;
 * `filter` preserves it, and re-sorting the roster here would silently change
 * every restricted level for no reason a reader could see. The elements are
 * the palette's own template objects, so `instantiateKept`, the pin union and
 * both sentinel slots behave identically on a restricted run BY IDENTITY —
 * there is no second copy of a template to drift.
 *
 * ⛔ **`excluded` IS CARRIED WHOLE, NEVER FILTERED.** A restriction says what a
 * RUN may draw from; an exclusion says what the BIOME cannot generate at all
 * and why (`cause`/`measured`/`wouldNeed`). Filtering the exclusions by a
 * restriction would make the catalogue quieter exactly where it is supposed to
 * be loudest.
 *
 * ⚠ A restriction that happens to name the WHOLE roster is allowed and is not
 * the same thing as no restriction: the palette NAME differs, so the payload
 * and the readout both say a restriction was asked for. That is the honest
 * reading — the run was asked a different question and got the same answer.
 */
export function restrictPalette(palette, roster) {
    const r = normalizeRoster(palette, roster);
    if (!r) return palette;
    const keep = r.axis === 'families'
        ? (t) => r.names.includes(t.family)
        : (t) => r.names.includes(t.name);
    const templates = palette.templates.filter(keep);
    if (templates.length === 0) {
        fail(`paletteRoster: the restriction ${r.axis}=[${r.names.join(', ')}] leaves palette `
            + `"${palette.name}" with NO templates. Every name was checked against the `
            + 'roster, so this is unreachable by construction — report it rather than '
            + 'running an empty palette.');
    }
    return Object.freeze({
        name: `${palette.name}[${r.axis}:${r.names.join(',')}]`,
        items: palette.items,
        templates: Object.freeze(templates),
        excluded: palette.excluded,
        roster: r,
    });
}

/**
 * ⛓ THE CATALOGUE — ⚖ ruling 1's *"a list of things that can be generated"*,
 * grouped by family, as DATA so the page renders it and a test asserts it.
 *
 * ⛔ **THE EXCLUDED ROWS ARE IN IT**, in their own family group, carrying
 * `cause` / `measured` / `wouldNeed` VERBATIM. A list of what can be generated
 * that hides what cannot — and why — is the graceful-skip shape wearing a
 * roster's clothes, and the data has been written since PoC slice 2.
 *
 * ⛔ **BUILT FROM THE ROSTER, NEVER FROM A COUNT** (trap 199): the groups, the
 * order and the totals are all derived from `palette.templates` /
 * `palette.excluded`, so a template added to the table appears here without
 * anybody editing a number.
 *
 * `selectable` is the row's own answer to "may a restriction name this?" — the
 * page renders a checkbox for exactly the rows that say true, and an excluded
 * row says false because there is nothing to draw.
 */
export function catalogueRows(palette) {
    const groups = new Map();
    const group = (family) => {
        if (!groups.has(family)) groups.set(family, { family, templates: [], excluded: [] });
        return groups.get(family);
    };
    for (const t of palette.templates ?? []) {
        group(t.family).templates.push(Object.freeze({
            name: t.name,
            family: t.family,
            params: t.params ?? [],
            why: t.why ?? null,
            selectable: true,
        }));
    }
    for (const e of palette.excluded ?? []) {
        group(e.family).excluded.push(Object.freeze({
            name: e.name,
            family: e.family,
            cause: e.cause ?? null,
            measured: e.measured ?? null,
            wouldNeed: e.wouldNeed ?? null,
            refusalText: e.refusalText ?? null,
            selectable: false,
        }));
    }
    return Object.freeze({
        palette: palette.name,
        roster: palette.roster ?? null,
        groups: Object.freeze([...groups.values()].map((g) => Object.freeze({
            family: g.family,
            templates: Object.freeze(g.templates),
            excluded: Object.freeze(g.excluded),
        }))),
        counts: Object.freeze({
            families: groups.size,
            templates: (palette.templates ?? []).length,
            excluded: (palette.excluded ?? []).length,
        }),
    });
}
