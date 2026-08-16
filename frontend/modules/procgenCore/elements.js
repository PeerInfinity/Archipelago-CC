/**
 * procgenCore/elements — WHAT AN **ELEMENT** IS, for every substrate on the
 * loop. ⚑ The shape below is the design session's (PROCGEN ELEMENTS arc 2,
 * `NewDocs/plans/procgen-elements-arc2-kickoff.md` §3.2, ⚖ ruling 3): it is
 * FIXED here and every later element inherits it, Seedling's included.
 *
 * ── AN ELEMENT IS A TEMPLATE THAT EXISTS **BEFORE** THE CARVE ─────────
 *
 * A pass-2 TEMPLATE (`templateContract.js`) decorates a skeleton that already
 * exists: it is offered an anchor, it writes a RELATIVE footprint, and the loop
 * keeps or reverts it. An ELEMENT is the other end of the pipeline (⚖ design
 * ruling 2, §4.3): it is constructed FIRST, in ABSOLUTE coordinates, inside a
 * rectangle the binding hands it, and the connector carves AROUND it. So it
 * writes its own WALLS as well as its own floor, it declares the PORTS a
 * connector may attach to, and it declares the cells OUTSIDE itself that must
 * stay as they are (`demand`) — the three things a template never needs because
 * a template is placed onto geometry somebody else already fixed.
 *
 * ⛔ EVERYTHING ELSE IS THE TEMPLATE CONTRACT, REUSED AND NOT RE-SPELLED.
 * `params` is the SAME schema array `[{key, domain, default, why}]`, checked by
 * the SAME `assertParamSchema`; the parameters are drawn by the SAME
 * `defineTemplate` machinery, in schema order, one `rng.pick` each, and an
 * override spends NO draw. There is ONE schema language in this directory and
 * an element does not get a second one.
 *
 * ── ⛔⛔ THE DRAW ORDER IS THE IDENTITY, AND IT HAS **TWO** HALVES ────
 *
 * `instantiate(rng, overrides)` spends the PARAMETER draws. `construct(site)`
 * spends whatever the element's own geometry needs, FROM THE SAME STREAM, at
 * the moment it is given a site. That split is deliberate and it is why
 * `construct` is a method on the concrete instance rather than a free function:
 * the concrete element CAPTURES the stream it was drawn from, so a binding that
 * instantiates and then constructs spends one continuous, declared sequence.
 *
 * ⚠ CONSEQUENCE, STATED SO NOBODY REDISCOVERS IT: an element instantiated with
 * `rng = null` (the `instantiateKept` idiom, where every parameter is an
 * override and spends no draw) can be INSPECTED but generally cannot be
 * CONSTRUCTED — its geometry draws have no stream. An element whose geometry is
 * a pure function of its parameters may be; the reverse-pull gadget is not.
 * ⇒ A RECORD OF AN ELEMENT IS ITS PARAMETERS **PLUS THE SEED**, never the
 * parameters alone. Slice 3 owes that to the payload.
 *
 * ── THE PLACEMENT ─────────────────────────────────────────────────────
 *
 *   {
 *     tiles:    [{x, y, tile}]      ABSOLUTE, floor AND wall — an element on a
 *                                   carved room may claim wall, which is the
 *                                   abundant resource there
 *     entities: { blocks:[{x,y}], buttons:[{x,y,id}],
 *                 obstacles:[{x,y,id}], items:[{x,y,id}] }
 *     ports:    [{x, y, dir, role}] role 'entry'|'exit'; the port is a CELL OF
 *                                   THE ELEMENT ON ITS SITE'S EDGE and `dir` is
 *                                   OUTWARD — a connector attaches at port+dir
 *     demand:   [{x, y, must}]      cells the element does NOT write but needs
 *                                   kept ('floor'|'wall') — a hammer's ring, a
 *                                   gadget's outer wall
 *     area:     { cells, kind:'element' }   it DECLARES itself an area for the
 *                                   partition (⛓ a 1-wide push lane has no
 *                                   all-floor 2×2 square, so the maze's blob
 *                                   rule would never find it — §3.3)
 *     symbols:  { holds:[id…], grants:[id…] }
 *     cost:     { …element-declared numbers }
 *   }
 *
 * ⚠ `symbols.holds` / `symbols.grants` are **IDS THE ELEMENT NAMES, NOT LIBRARY
 * ENTRIES IT INVENTS.** `holds: ['sw_A']` says "this element derives the token
 * `sw_A` while it is satisfied"; it is the BINDING that realises that as a
 * `world.buttonLib` entry `{kind:'button', holds:'sw_A'}` and an `obstacleLib`
 * entry `{clear_set_type:'combo_list', clear_set:[['sw_A']]}` (arc 2 slice 1
 * §8.12.5). An element that wrote library entries would be an element that knew
 * which substrate it was on, which is the whole thing this file refuses.
 *
 * ── A REFUSAL IS A VALUE, A MALFORMED PLACEMENT IS A THROW ────────────
 *
 * `construct` returns `{refused: {reason, detail}}` when the site cannot hold
 * the element. That is an ordinary outcome — the binding tries another site —
 * and it is NEVER a throw. A placement that violates the contract above IS a
 * throw (`ElementContractError`): it is a defect in the element, not a fact
 * about the site, and a binding that silently placed one would corrupt the grid
 * it was handed.
 *
 * ⛔ NO NODE IMPORTS AND NOTHING SUBSTRATE-SIDE. Like `levelGenerator.js` and
 * `templateContract.js` this file is on every binding's browser path; the ONLY
 * thing it imports beyond this directory is `gridTiles.js`, which is the ONE
 * grid vocabulary (`bindingContract.test.js` asserts it).
 */

import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { assertParamSchema, defineTemplate, enumerateValues } from './templateContract.js';

export class ElementContractError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ElementContractError';
    }
}

const fail = (message) => { throw new ElementContractError(message); };

/**
 * ⛓ THE **ONE** DIRECTION VOCABULARY of this seam. A port's `dir`, an
 * element's own walk, and the maze engine's `INPUT_N/S/E/W` all spell the four
 * orthogonals the same way and in the same order — the engine's `INPUTS` order,
 * so a plan and a port never need translating. ⛔ The order is a DRAW ORDER
 * wherever an element picks from it, so it is frozen.
 */
export const PORT_DIRS = Object.freeze(['N', 'S', 'E', 'W']);

export const DIR_DELTA = Object.freeze({
    N: Object.freeze({ dx: 0, dy: -1 }),
    S: Object.freeze({ dx: 0, dy: 1 }),
    E: Object.freeze({ dx: 1, dy: 0 }),
    W: Object.freeze({ dx: -1, dy: 0 }),
});

export const PORT_ROLES = Object.freeze(['entry', 'exit']);

/**
 * ⛓⛓⛓ **THE ID ALLOCATOR — ONE OF IT, AND SLICE 4 IS WHY IT MOVED HERE.**
 *
 * A guard gadget's three ids are indexed from the FIRST one (`button_A0` /
 * `door_A0` / `sw_A0`, arc-2 §10.4: a special case for index 0 would be two
 * spellings of one id), and a flag symbol's item is `flag_<symbol>`.
 *
 * ⛔ These were `procgenMaze.js`'s until the maze lab page's EDIT PALETTE grew
 * BLOCK / BUTTON / FLAG brushes (arc-2 slice 4). A hand-placed button whose id
 * the editor invented privately would be a SECOND spelling of the binding's own
 * — the page could then build a gadget the generator cannot read back and the
 * two would drift silently. ⇒ the definition lives in `procgenCore/` (which
 * imports nothing substrate-side) and `procgenMaze.js` RE-EXPORTS both names,
 * so every existing importer and every test is unchanged.
 *
 * ⚠ They are STRING FUNCTIONS, not a registry: nothing here remembers which
 * indices are taken. Choosing the next free index is the caller's, because only
 * the caller knows which world it is looking at (`allocateGuardIndex` in the
 * editor scans `world.buttonLib`; the binding counts its own placements).
 */
export const guardIdsFor = (index) => Object.freeze({
    button: `button_A${index}`,
    door: `door_A${index}`,
    hold: `sw_A${index}`,
});

/** `flag_K0` ← 'K0' — the item id a symbol realised as a step-on LATCH carries
 *  (⚖ design rulings 21-22). */
export const flagIdFor = (symbol) => `flag_${symbol}`;

const posKey = (x, y) => `${x},${y}`;

/** A site is a rectangle the BINDING offers — inside the room, off its ring. */
export function assertSite(site, owner) {
    const ok = site && [site.x, site.y, site.w, site.h].every(Number.isInteger)
        && site.w > 0 && site.h > 0;
    if (!ok) {
        fail(`elements: ${owner} was offered ${JSON.stringify(site)} as a site. A site is `
            + '`{x, y, w, h}` with integer coordinates and a positive extent — the '
            + 'rectangle the element writes ABSOLUTE cells into.');
    }
    return site;
}

const inSite = (site, x, y) => x >= site.x && x < site.x + site.w
    && y >= site.y && y < site.y + site.h;

const onSiteEdge = (site, x, y) => inSite(site, x, y)
    && (x === site.x || x === site.x + site.w - 1
        || y === site.y || y === site.y + site.h - 1);

/**
 * ⛓⛓⛓ EVERY CLAIM THE PLACEMENT CONTRACT MAKES, ASKED OF ONE PLACEMENT.
 *
 * Run on EVERY `construct`, not only at load time. The check is O(site area)
 * and the alternative is a binding stamping a malformed element into a grid it
 * then carves around — a defect that would surface as a broken level three
 * layers away from its cause.
 */
function assertPlacementShape(placement, { name, site, values, assertPlacement }) {
    const where = `element "${name}"${values ? ` ${JSON.stringify(values)}` : ''}`;

    // ── tiles ────────────────────────────────────────────────────────
    if (!Array.isArray(placement?.tiles) || placement.tiles.length === 0) {
        fail(`elements: ${where} produced no \`tiles\`. An element with an empty footprint `
            + 'is one the binding would stamp as FIXED and then carve straight through.');
    }
    const written = new Map();
    for (const t of placement.tiles) {
        if (!Number.isInteger(t?.x) || !Number.isInteger(t?.y)) {
            fail(`elements: ${where} wrote a tile with no integer cell (${JSON.stringify(t)}).`);
        }
        if (t.tile !== TILE_FLOOR && t.tile !== TILE_WALL) {
            fail(`elements: ${where} wrote ${JSON.stringify(t.tile)} at (${t.x},${t.y}). The `
                + 'grid contract has exactly two tiles, TILE_FLOOR and TILE_WALL '
                + '(`shared/procgen/mazeAlgorithms/gridTiles.js`).');
        }
        if (!inSite(site, t.x, t.y)) {
            fail(`elements: ${where} wrote (${t.x},${t.y}), which is OUTSIDE its site `
                + `${JSON.stringify(site)}. An element writes only what the binding offered `
                + 'it; what it needs beyond that is `demand`, which the binding CHECKS '
                + 'rather than overwrites.');
        }
        const k = posKey(t.x, t.y);
        if (written.has(k)) {
            fail(`elements: ${where} wrote (${t.x},${t.y}) twice. Two writes to one cell is `
                + 'an order dependence, and the order of a tile list is not a contract.');
        }
        written.set(k, t.tile);
    }
    const isFloorCell = (x, y) => written.get(posKey(x, y)) === TILE_FLOOR;

    // ── entities ─────────────────────────────────────────────────────
    const ents = placement.entities;
    for (const kind of ['blocks', 'buttons', 'obstacles', 'items']) {
        if (!Array.isArray(ents?.[kind])) {
            fail(`elements: ${where} has no \`entities.${kind}\` array. All four are `
                + 'declared even when empty, so a reader never has to ask whether an '
                + 'absent key means "none" or "this element does not do that".');
        }
        for (const en of ents[kind]) {
            if (!Number.isInteger(en?.x) || !Number.isInteger(en?.y)) {
                fail(`elements: ${where} put a ${kind} entry at ${JSON.stringify(en)} — an `
                    + 'entity is an integer cell.');
            }
            if (!isFloorCell(en.x, en.y)) {
                fail(`elements: ${where} put a ${kind} entry at (${en.x},${en.y}), which this `
                    + 'element did not write as FLOOR. Blocks, buttons, obstacles and items '
                    + 'all sit ON floor; one on wall is an entity nothing can ever reach.');
            }
            if (kind !== 'blocks' && (typeof en.id !== 'string' || !en.id)) {
                fail(`elements: ${where} put a ${kind} entry at (${en.x},${en.y}) with no \`id\`. `
                    + 'The id is what the binding looks up in the library it merges.');
            }
        }
    }

    // ── ports ────────────────────────────────────────────────────────
    if (!Array.isArray(placement.ports) || placement.ports.length === 0) {
        fail(`elements: ${where} declared no \`ports\`. An element with no port is one no `
            + 'connector can reach — the carve may not enter its rectangle (⚖ ruling 4).');
    }
    for (const p of placement.ports) {
        if (!PORT_ROLES.includes(p?.role)) {
            fail(`elements: ${where} declared a port with role ${JSON.stringify(p?.role)}; `
                + `the roles are [${PORT_ROLES.join(', ')}].`);
        }
        if (!PORT_DIRS.includes(p.dir)) {
            fail(`elements: ${where} declared a port at (${p.x},${p.y}) with dir `
                + `${JSON.stringify(p.dir)}; the directions are [${PORT_DIRS.join(', ')}].`);
        }
        if (!onSiteEdge(site, p.x, p.y)) {
            fail(`elements: ${where} declared a port at (${p.x},${p.y}), which is not on its `
                + `site's EDGE (${JSON.stringify(site)}). The element writes every cell of `
                + 'its site, so a port in the interior is a mouth walled in by its own '
                + 'element and a connector could only reach it by carving through — which '
                + 'is exactly what ⚖ ruling 4 forbids.');
        }
        const d = DIR_DELTA[p.dir];
        if (inSite(site, p.x + d.dx, p.y + d.dy)) {
            fail(`elements: ${where} declared a port at (${p.x},${p.y}) facing ${p.dir}, which `
                + 'points back INTO its own site. `dir` is OUTWARD — it is where the '
                + 'connector attaches.');
        }
        if (!isFloorCell(p.x, p.y)) {
            fail(`elements: ${where} declared a port at (${p.x},${p.y}) and wrote that cell as `
                + 'WALL. A port a connector reaches and cannot enter is a mouth that is not '
                + 'a mouth.');
        }
    }

    // ── demand ───────────────────────────────────────────────────────
    if (!Array.isArray(placement.demand)) {
        fail(`elements: ${where} has no \`demand\` array (an empty one is the way to say `
            + '"nothing outside me matters").');
    }
    for (const d of placement.demand) {
        if (!Number.isInteger(d?.x) || !Number.isInteger(d?.y)) {
            fail(`elements: ${where} demanded ${JSON.stringify(d)} — a demand is an integer cell.`);
        }
        if (d.must !== 'floor' && d.must !== 'wall') {
            fail(`elements: ${where} demanded ${JSON.stringify(d.must)} at (${d.x},${d.y}); a `
                + 'demand is `floor` or `wall`.');
        }
        if (written.has(posKey(d.x, d.y))) {
            fail(`elements: ${where} demanded (${d.x},${d.y}), a cell it WRITES itself. A `
                + 'demand is about what the element does NOT control; demanding one\'s own '
                + 'write is a claim that can never fail and therefore never checks anything.');
        }
    }

    // ── area ─────────────────────────────────────────────────────────
    if (placement.area?.kind !== 'element') {
        fail(`elements: ${where} declared an area of kind ${JSON.stringify(placement.area?.kind)}. `
            + 'An element DECLARES itself an area so the partition never has to find it — '
            + 'and the maze\'s blob rule (an all-floor 2×2 square) would never find a '
            + '1-wide push lane at all.');
    }
    if (!Array.isArray(placement.area.cells) || placement.area.cells.length === 0) {
        fail(`elements: ${where} declared an EMPTY area. An area with no cells holds no item `
            + 'and joins no edge.');
    }
    const seenArea = new Set();
    for (const c of placement.area.cells) {
        if (!isFloorCell(c?.x, c?.y)) {
            fail(`elements: ${where} put (${c?.x},${c?.y}) in its area, which it did not write `
                + 'as FLOOR. An area is somewhere the player can BE.');
        }
        const k = posKey(c.x, c.y);
        if (seenArea.has(k)) fail(`elements: ${where} listed (${c.x},${c.y}) in its area twice.`);
        seenArea.add(k);
    }

    // ── symbols ──────────────────────────────────────────────────────
    for (const kind of ['holds', 'grants']) {
        if (!Array.isArray(placement.symbols?.[kind])) {
            fail(`elements: ${where} has no \`symbols.${kind}\` array. Both are declared even `
                + 'when empty — they are what the area graph may BIND to, and an absent one '
                + 'reads as "unknown" where "none" was meant.');
        }
        for (const id of placement.symbols[kind]) {
            if (typeof id !== 'string' || !id) {
                fail(`elements: ${where} names ${JSON.stringify(id)} in \`symbols.${kind}\`; a `
                    + 'symbol is a non-empty id.');
            }
        }
    }

    // ── cost ─────────────────────────────────────────────────────────
    if (!placement.cost || typeof placement.cost !== 'object') {
        fail(`elements: ${where} carries no \`cost\` record. ⚖ design ruling 20 makes solver `
            + 'work a DIAL, and a dial starts as a number somebody recorded.');
    }
    for (const [k, v] of Object.entries(placement.cost)) {
        if (!Number.isFinite(v)) {
            fail(`elements: ${where} recorded cost.${k} = ${JSON.stringify(v)}. A cost record `
                + 'holds numbers; anything else is a note, and notes go in the docblock.');
        }
    }

    // ── the element's OWN invariants ─────────────────────────────────
    if (assertPlacement) assertPlacement(placement, { values, site, fail });
    return placement;
}

function assertConstructOutput(out, ctx) {
    if (out && out.refused !== undefined) {
        const r = out.refused;
        if (typeof r?.reason !== 'string' || !r.reason) {
            fail(`elements: element "${ctx.name}" refused a site without a \`reason\`. A `
                + 'refusal that cannot be counted is a refusal nobody can act on — the '
                + 'census counts BY NAME.');
        }
        return Object.freeze({ refused: Object.freeze({ ...r }) });
    }
    return assertPlacementShape(out, ctx);
}

/**
 * ⛓⛓⛓ THE ONE CONSTRUCTOR EVERY ELEMENT IN EVERY SUBSTRATE GOES THROUGH.
 *
 * @param {string}   o.name    the catalogue key and what a cost record names
 * @param {string}   o.family  what the census counts by
 * @param {Array}    o.params  the SAME schema array a template declares
 * @param {string}   o.why     the element's own reason to exist
 * @param {Function} o.construct  `(values, site, rng) → placement | {refused}`
 * @param {Function} [o.assertPlacement]  `(placement, {values, site, fail})` —
 *   the invariants only THIS element can state. Run on every construct, beside
 *   the contract's own.
 */
export function defineElement({ name, family, params = [], why, construct, assertPlacement = null }) {
    if (typeof name !== 'string' || !name) {
        fail('elements: an element needs a name — it is the catalogue key, the cost record\'s '
            + '`element` field and what a spec string asks for.');
    }
    if (typeof construct !== 'function') {
        fail(`elements: element "${name}" has no \`construct\`. An element IS a function from `
            + '(values, site, rng) to geometry (⚖ design ruling 2); a table of cells is the '
            + 'shape this contract replaced.');
    }
    if (assertPlacement !== null && typeof assertPlacement !== 'function') {
        fail(`elements: element "${name}"'s \`assertPlacement\` must be a function.`);
    }
    // ⛔ ASKED HERE FIRST so the refusal names an ELEMENT. `defineTemplate` asks
    // the same question of the same array a line later and would answer it in
    // the word "template" — one schema language, but the reader who typed the
    // bad domain must meet a sentence about the thing they typed it into.
    assertParamSchema(params, `element "${name}"`);
    const base = defineTemplate({ name, family, params, why, build: () => ({}) });

    return Object.freeze({
        name,
        family,
        params: base.params,
        why,
        /**
         * ⛔ THE PARAMETER DRAWS ARE `defineTemplate`'s, VERBATIM — schema
         * order, one `pick` each, an override spends none. What is added here
         * is that the concrete element CAPTURES `rng`, so its own geometry
         * draws come from the same stream when `construct(site)` is called.
         */
        instantiate(rng, overrides = {}) {
            const row = base.instantiate(rng, overrides);
            const concrete = {
                name: row.name,
                family: row.family,
                params: row.params,
                instance: row.instance,
                why: row.why,
                construct(site) {
                    assertSite(site, `element "${name}"`);
                    return assertConstructOutput(construct(row.params, site, rng), {
                        name, site, values: row.params, assertPlacement,
                    });
                },
            };
            return Object.freeze(concrete);
        },
    });
}

/**
 * EVERY DECLARED VALUE COMBINATION of one element, instantiated. ⛔ The
 * cartesian product is `enumerateValues`', taken over the DECLARED domains, so
 * a domain that grew grows this with it.
 *
 * ⚠ Unlike `enumerateInstantiations` for templates this NEEDS a stream per row:
 * an element's geometry draws at `construct` time, and `null` has no draws.
 *
 * @param {Function} makeRng `(index) => rng` — a fresh stream per combination,
 *   so one combination's geometry cannot move another's.
 */
export function enumerateElementInstantiations(element, makeRng) {
    return enumerateValues(element).map((values, i) => element.instantiate(makeRng(i), values));
}

/**
 * ⛓⛓ THE LOAD-TIME SWEEP — ⚖ ruling 4's "a domain nobody can enumerate is a
 * domain nobody swept", spent.
 *
 * Constructs EVERY declared combination × every seed on a GENEROUS reference
 * site and asks the contract of each result. Returns the CENSUS, because a
 * sweep whose refusals are invisible is a sweep that reports a green wall over
 * an element that never built anything.
 *
 * ⛔ NON-VACUITY IS PART OF THE CHECK: an element that refused every single
 * combination on a generous site is a defect, and this says so BY NAME rather
 * than passing with `constructed: 0`.
 */
export function assertElement(element, { site, makeRng, seeds = [1] }) {
    assertSite(site, `element "${element?.name}"`);
    if (typeof makeRng !== 'function') {
        fail(`elements: assertElement needs a \`makeRng(key)\` for element `
            + `"${element?.name}" — the geometry draws, so a sweep with no stream is a `
            + 'sweep that never ran.');
    }
    const census = { element: element.name, family: element.family, site,
        constructed: 0, refused: {}, rows: [] };
    for (const values of enumerateValues(element)) {
        for (const seed of seeds) {
            const concrete = element.instantiate(makeRng(seed), values);
            const out = concrete.construct(site);
            const reason = out.refused ? out.refused.reason : null;
            if (reason) census.refused[reason] = (census.refused[reason] ?? 0) + 1;
            else census.constructed += 1;
            census.rows.push({ instance: concrete.instance, seed, refused: reason });
        }
    }
    if (census.constructed === 0) {
        fail(`elements: element "${element.name}" constructed NOTHING over its own declared `
            + `domains on ${JSON.stringify(site)} (refusals: ${JSON.stringify(census.refused)}). `
            + 'A sweep that only ever refuses certifies nothing at all.');
    }
    return census;
}
