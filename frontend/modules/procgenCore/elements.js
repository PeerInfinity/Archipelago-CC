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
 * ── ⛓⛓⛓ **TWO PHASES, ONE CONTRACT** (arc 3, slice 4a, D1) ───────────
 *
 * The paragraph above is the `pre-carve` phase and it is still the DEFAULT: the
 * element writes its WHOLE rectangle, the rectangle is reserved before the
 * connector runs, and the carve is told to keep off. That is exactly right for a
 * gadget that brings its own room (the reverse-pull block) and exactly wrong for
 * a DOOR, whose geometry is a function of the corridor it stands in — a corridor
 * that does not exist until the connector has carved it.
 *
 * So an element declares `phase`:
 *
 *   `pre-carve`    (default) — today's law, unchanged byte for byte.
 *   `on-connector` — CONSTRUCTED AFTER THE CARVE. The binding hands it the
 *                    room's interior as its site plus a READ-ONLY `room` probe
 *                    (below), and it writes a SPARSE tile set — only the cells
 *                    it CHANGES (wall cells grown, floor cells carved) — plus
 *                    its entities, its DOOR CELLS and its CLEARER cells.
 *
 * ⛔ AN `on-connector` ELEMENT DRAWS NOTHING ITS ROOM DECIDES. Its geometry is a
 * function of the skeleton; the only draw it is licensed to spend is a CHOICE
 * among cells the room offers equally (the kill gate draws ONE index over its
 * qualifying door cells, declared in its own docblock and nowhere else). Trap
 * 321's *"absence is a draw"* does not apply, because there is no absent
 * parameter — there is no parameter.
 *
 * ⛔ AND THE DOOR LAW IS THE BINDING'S, NOT THIS FILE'S. `doorCells`/`clearer`
 * are DECLARED here and adjudicated by the binding with the very function it
 * adjudicates a door TEMPLATE with (`procgenSeedling`'s `doorLawRefusal`) — one
 * law, two callers. This file only checks that the declaration is WELL FORMED,
 * which is the same division of labour `assertDoorCells` has on the palette side.
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
 * ⛓⛓⛓ **THE TWO PHASES** — see the file docblock. `pre-carve` is the default
 * and is what every element written before arc-3 slice 4a is.
 */
export const ELEMENT_PHASES = Object.freeze(['pre-carve', 'on-connector']);
export const PHASE_PRE_CARVE = 'pre-carve';
export const PHASE_ON_CONNECTOR = 'on-connector';

/**
 * ⛓⛓ **THE ROOM PROBE — WHAT AN `on-connector` ELEMENT IS ALLOWED TO KNOW**,
 * and the list is closed on purpose.
 *
 * The binding builds it ONCE, over the finished SKELETON (`base`), and it is
 * READ-ONLY: an element that could write through it would be editing the room it
 * is being asked about. The seven members are exactly what a door needs and
 * nothing more —
 *
 *   `width`,`height`  the room, so a cell can be tested for the border ring
 *   `start`,`goal`    `{x,y}`, the two cells the level is about
 *   `floorAt(x,y)`    the SKELETON's terrain, one reading (the binding's cached
 *                     ground mask, never a second scan)
 *   `mainPath`        slice 1's ONE canonical shortest start->goal path, the
 *                     cells a door may stand on
 *   `isCut(cell)`     slice 2's clause 1 as a FUNCTION — walling this one cell
 *                     disconnects the goal from the start
 *   `connectedWith({paint, walled})` the same flood, asked generally: does the
 *                     START still reach the GOAL with these tiles painted and
 *                     these cells solid? ⛓ The block pocket's whole promise —
 *                     *a shove EXISTS which clears the way* — is this question
 *                     asked of the cell the block comes to rest in, and `isCut`
 *                     is its one-cell special case rather than a second flood.
 *   `doorLaw({paint, doorCells, clearer})` the BINDING'S OWN door law, handed in
 *                     so a proposal is filtered by the very rule that will
 *                     adjudicate it. ⛔ This is what "ONE door law, both callers"
 *                     means at the element end: the element does not re-derive
 *                     the law, it ASKS it.
 */
export function assertRoomProbe(room, owner) {
    const needFns = ['floorAt', 'isCut', 'connectedWith', 'doorLaw'];
    for (const fn of needFns) {
        if (typeof room?.[fn] !== 'function') {
            fail(`elements: ${owner} was offered a site whose \`room\` probe has no `
                + `\`${fn}()\`. An \`on-connector\` element's geometry is a FUNCTION of the `
                + `room, so the probe is not optional — the members are [${needFns.join(', ')}] `
                + 'plus width/height/start/goal/mainPath.');
        }
    }
    const okCell = (c) => c && Number.isInteger(c.x) && Number.isInteger(c.y);
    if (!Number.isInteger(room.width) || !Number.isInteger(room.height)
        || !okCell(room.start) || !okCell(room.goal) || !Array.isArray(room.mainPath)) {
        fail(`elements: ${owner}'s \`room\` probe is missing width/height/start/goal/mainPath `
            + `(got ${JSON.stringify({ width: room.width, height: room.height,
                start: room.start, goal: room.goal, mainPath: room.mainPath?.length })}).`);
    }
    return room;
}

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

/**
 * ⛓⛓⛓ **THE SNUG FOOTPRINT, PER ORIENTATION** — PROCGEN ELEMENTS arc 5, slice
 * 2 (§3.2), and it exists because a BINDING that has to guess an element's
 * extents guesses a SQUARE.
 *
 * The Seedling binding sized its site `len + SITE_MARGIN_STRAIGHT` on BOTH
 * axes because that is the longest extent a straight reverse-pull gadget has;
 * across the pull axis the gadget only ever needed `EXIT_RUN + 1 = 4`. On a
 * 10x10 room's 8x8 interior that difference is the whole game: a 6x6 site fits
 * 3x3 = 9 positions and a 6x4 fits 3x5 = 15, twice with the orientation
 * swapped. ⛔ The census measured what the square cost — `no-site-fits-this-
 * room` 130 of 360 cells, and ZERO placements at `len = 4` on every kind —
 * which is arc-3 §18.2 C1's *"a snug site that need not be corner-aligned
 * recovers most of it"*, spent.
 *
 * ⛔ **ABSENT MEANS TODAY'S SQUARE, AND THAT IS WHY THE MAZE IS UNTOUCHED.**
 * `footprint` is OPTIONAL: an element that declares none is offered whatever
 * rectangle its binding decides on, exactly as before. The maze binding
 * (`mazeRoom/procgenMaze.js`) never asks, so its `len + SITE_MARGIN` squares —
 * and every md5 that hashes them — cannot move.
 *
 * ⛔ **AND `null` IS A LEGAL ANSWER FOR SOME PARAMETERS.** A `footprint` is a
 * function of the element's own VALUES, and an element may know its snug
 * extents for some of them and not others — the reverse-pull block knows them
 * for `turns = 0` and cannot state them for a bent walk, whose bounding box
 * depends on WHICH steps turn and is drawn inside `construct`. Answering
 * `null` there says so; inventing a rectangle would be a claim the geometry
 * does not make.
 *
 * THE TWO LAWS, both refusals rather than repairs:
 *   · **NO TWO ENTRIES MAY BE THE SAME RECTANGLE.** The binding enumerates one
 *     candidate per (position, footprint) and draws ONE `pick` over the list,
 *     so a rectangle named twice is a rectangle drawn twice as often. An
 *     element whose orientations COINCIDE (the reverse-pull block at `len = 2`,
 *     where `len + 2` is already 4) declares ONE.
 *   · **EVERY ENTRY IS NAMED, AND THE NAMES ARE DISTINCT.** `orient` is what a
 *     census counts by and what a ledger row prints; a placement that could not
 *     say WHICH declared shape it realised would make "the pick never chooses
 *     the tall one" an unaskable question.
 *
 * @param {Array<{w:number,h:number,orient:string}>|null} list
 * @returns the frozen list, or `null`
 */
export function assertFootprints(list, owner) {
    if (list === null || list === undefined) return null;
    if (!Array.isArray(list) || list.length === 0) {
        fail(`elements: ${owner}'s \`footprint\` returned ${JSON.stringify(list)}. It is a `
            + 'NON-EMPTY array of `{w, h, orient}` — the snug extents the element really '
            + 'needs, one entry per orientation — or `null` for "these values have no '
            + 'single snug rectangle", which is not the same claim as an empty list.');
    }
    const shapes = new Set();
    const names = new Set();
    for (const f of list) {
        if (!Number.isInteger(f?.w) || !Number.isInteger(f?.h) || f.w <= 0 || f.h <= 0) {
            fail(`elements: ${owner} declared the footprint ${JSON.stringify(f)}. Each entry `
                + 'is `{w, h, orient}` with a positive integer extent on both axes.');
        }
        if (typeof f.orient !== 'string' || !f.orient) {
            fail(`elements: ${owner} declared a footprint ${f.w}x${f.h} with no \`orient\` `
                + 'name. The name is what the census counts by and what the ledger prints — '
                + 'an unnamed orientation is a placement nobody can attribute.');
        }
        const shape = `${f.w}x${f.h}`;
        if (shapes.has(shape)) {
            fail(`elements: ${owner} declared ${shape} TWICE. The binding offers one candidate `
                + 'per (position, footprint) and draws ONE `pick` over the list, so the same '
                + 'rectangle named twice is the same rectangle drawn twice as often — the '
                + 'element whose orientations coincide declares ONE.');
        }
        if (names.has(f.orient)) {
            fail(`elements: ${owner} used the orientation name "${f.orient}" twice.`);
        }
        shapes.add(shape);
        names.add(f.orient);
    }
    return Object.freeze(list.map((f) => Object.freeze({ w: f.w, h: f.h, orient: f.orient })));
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
function assertPlacementShape(placement, { name, site, values, assertPlacement, phase }) {
    const where = `element "${name}"${values ? ` ${JSON.stringify(values)}` : ''}`;
    const onConnector = phase === PHASE_ON_CONNECTOR;

    // ── tiles ────────────────────────────────────────────────────────
    if (!Array.isArray(placement?.tiles)) {
        fail(`elements: ${where} produced no \`tiles\` array.`);
    }
    /**
     * ⛔ THE NON-EMPTY DEMAND IS `pre-carve`'s ALONE, and the asymmetry is the
     * whole point of the phase. A pre-carve element with an empty footprint is
     * one the binding would stamp as FIXED and then carve straight through. An
     * `on-connector` element writing NOTHING is the ORDINARY case: a kill gate
     * on a one-wide corridor grows zero wall cells and finds its spinner pocket
     * already ground, so its entire geometry is two entities on cells the carve
     * made. It is `entities` that may not be empty there (below).
     */
    if (!onConnector && placement.tiles.length === 0) {
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
    /**
     * ⛓ **STANDABLE ≠ WRITTEN AS FLOOR, AND ONLY IN THE `on-connector` PHASE.**
     * A pre-carve element writes its WHOLE rectangle, so "floor" and "a cell I
     * wrote TILE_FLOOR" are the same set and `isFloorCell` is the whole test. An
     * `on-connector` element writes SPARSELY: its lock stands on a corridor cell
     * the CARVE made, which it did not write and must not (writing it would
     * claim a cell it does not own). ⇒ the test is *floor AFTER me*: what I
     * wrote if I wrote it, and the room's own skeleton if I did not.
     */
    const standable = (x, y) => {
        const w = written.get(posKey(x, y));
        if (w !== undefined) return w === TILE_FLOOR;
        return onConnector ? Boolean(site.room.floorAt(x, y)) : false;
    };

    // ── entities ─────────────────────────────────────────────────────
    const ents = placement.entities;
    let entityCount = 0;
    for (const kind of ['blocks', 'buttons', 'obstacles', 'items']) {
        if (!Array.isArray(ents?.[kind])) {
            fail(`elements: ${where} has no \`entities.${kind}\` array. All four are `
                + 'declared even when empty, so a reader never has to ask whether an '
                + 'absent key means "none" or "this element does not do that".');
        }
        for (const en of ents[kind]) {
            entityCount += 1;
            if (!Number.isInteger(en?.x) || !Number.isInteger(en?.y)) {
                fail(`elements: ${where} put a ${kind} entry at ${JSON.stringify(en)} — an `
                    + 'entity is an integer cell.');
            }
            if (!standable(en.x, en.y)) {
                /** ⛔ THE `pre-carve` SENTENCE IS UNCHANGED WORD FOR WORD. It is
                 *  asserted by `elements.test.js`, and a wording fix that
                 *  reddened a row would be trap 337 arriving through the door
                 *  this phase opened. */
                fail(`elements: ${where} put a ${kind} entry at (${en.x},${en.y}), which this `
                    + `element did not write as FLOOR${onConnector
                        ? ' and which the skeleton did not leave as floor either' : ''}. `
                    + 'Blocks, buttons, obstacles and items all sit ON floor; one on wall is '
                    + 'an entity nothing can ever reach.');
            }
            if (kind !== 'blocks' && (typeof en.id !== 'string' || !en.id)) {
                fail(`elements: ${where} put a ${kind} entry at (${en.x},${en.y}) with no \`id\`. `
                    + 'The id is what the binding looks up in the library it merges.');
            }
        }
    }
    if (onConnector && entityCount === 0) {
        fail(`elements: ${where} is an \`on-connector\` element with NO entity. Its tiles may `
            + 'be empty — a door on a one-wide corridor changes no terrain at all — so the '
            + 'entities are the whole of what it puts in the room, and a placement with '
            + 'neither is a placement that placed nothing.');
    }

    // ── doorCells / clearer — the `on-connector` phase's own two lists ──
    /**
     * ⛓⛓⛓ **A DOOR DECLARES ITS DOOR CELLS AND ITS CLEARER, exactly as a door
     * TEMPLATE does** (`procgenPalette.assertDoorCells`, arc-3 slice 2 §9.3).
     * Same two words, same meaning, one law adjudicating both — the element's
     * are ABSOLUTE cells where the template's are offsets from an anchor, and
     * that is the only difference.
     *
     * ⛔ FOUR SILENT MIS-DECLARATIONS ARE REFUSED HERE, and they are the palette
     * check's four with the phase's own wording: no door cells at all (the law
     * would wall the empty set and pass every candidate — a door that gates
     * nothing); a door cell OUTSIDE the site; a door cell the element itself
     * writes as WALL (the law's open half is the seal check's answer, and a cell
     * the element walls is never walkable); and a clearer cell that is not floor
     * after the element (the thing that OPENS the door has to be somewhere the
     * player can stand).
     */
    if (onConnector) {
        for (const [field, cells] of [['doorCells', placement.doorCells],
            ['clearer', placement.clearer]]) {
            if (!Array.isArray(cells)) {
                fail(`elements: ${where} is an \`on-connector\` element with no \`${field}\` `
                    + 'array. Both are DECLARED even when empty — `clearer` is empty for a '
                    + 'family whose opener IS its door cell (a block standing in the gap) — '
                    + 'and an absent one reads as "unknown" where "none" was meant.');
            }
            for (const c of cells) {
                if (!Number.isInteger(c?.x) || !Number.isInteger(c?.y)) {
                    fail(`elements: ${where} named ${JSON.stringify(c)} in \`${field}\`; a `
                        + 'door cell is an integer cell.');
                }
                if (!inSite(site, c.x, c.y)) {
                    fail(`elements: ${where} named (${c.x},${c.y}) in \`${field}\`, which is `
                        + `OUTSIDE its site ${JSON.stringify({ x: site.x, y: site.y,
                            w: site.w, h: site.h })}.`);
                }
                if (!standable(c.x, c.y)) {
                    fail(`elements: ${where} named (${c.x},${c.y}) in \`${field}\` and it is `
                        + 'not FLOOR after this element. A door cell the element WALLS is one '
                        + 'the law would wall twice and the player could never stand in; a '
                        + 'clearer on wall is an opener nobody can reach.');
                }
            }
        }
        if (placement.doorCells.length === 0) {
            fail(`elements: ${where} declared an EMPTY \`doorCells\`. The door law walls the `
                + 'door cells and asks whether the goal is still reachable — over the empty '
                + 'set it asks nothing and every placement passes, which is a legality gate '
                + 'that does not gate.');
        }
    } else if (placement.doorCells !== undefined || placement.clearer !== undefined) {
        fail(`elements: ${where} is a \`${PHASE_PRE_CARVE}\` element and declared `
            + '`doorCells`/`clearer`. Those are the `on-connector` phase\'s fields: a '
            + 'pre-carve element\'s door is INSIDE the rectangle it wrote, and the binding '
            + 'checks it is a cut of the finished room (the guard\'s own '
            + '`the-guard-is-not-a-cut-of-the-level`) rather than running the door law on it.');
    }

    // ── ports ────────────────────────────────────────────────────────
    /**
     * ⛔ AN `on-connector` ELEMENT HAS NO PORTS, AND SAYING SO IS A RULE RATHER
     * THAN AN OMISSION. A port is where a CONNECTOR attaches to a rectangle the
     * carve was told to keep off; this element is standing IN the connector
     * already. A port declared here would name a mouth into a site that is the
     * whole room.
     */
    if (onConnector) {
        if (Array.isArray(placement.ports) && placement.ports.length > 0) {
            fail(`elements: ${where} is an \`on-connector\` element and declared `
                + `${placement.ports.length} port(s). It stands IN the connector — there is `
                + 'nothing for a connector to attach to.');
        }
    } else if (!Array.isArray(placement.ports) || placement.ports.length === 0) {
        fail(`elements: ${where} declared no \`ports\`. An element with no port is one no `
            + 'connector can reach — the carve may not enter its rectangle (⚖ ruling 4).');
    }
    for (const p of (placement.ports ?? [])) {
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
    /**
     * ⛔⛔ **AN `on-connector` ELEMENT DECLARES `area: null`, AND THAT IS A
     * CLAIM RATHER THAN A GAP.** A pre-carve element declares itself an area
     * because the partition's blob rule (an all-floor 2×2 square) would never
     * find its 1-wide push lane. A DOOR is the opposite thing: it does not MAKE
     * an area, it CUTS one, and the two sides it cuts are the room's own — which
     * is exactly what slice 4b's area binding will partition. An element that
     * declared its door cell an area would be offering the partition a
     * one-cell region that is not a place at all.
     */
    if (onConnector) {
        if (placement.area !== null) {
            fail(`elements: ${where} is an \`on-connector\` element and declared an \`area\` `
                + `(${JSON.stringify(placement.area)}). A door does not MAKE an area, it CUTS `
                + 'one; `area: null` is how this phase says so, and the two sides belong to '
                + 'the room\'s own partition.');
        }
    } else if (placement.area?.kind !== 'element') {
        fail(`elements: ${where} declared an area of kind ${JSON.stringify(placement.area?.kind)}. `
            + 'An element DECLARES itself an area so the partition never has to find it — '
            + 'and the maze\'s blob rule (an all-floor 2×2 square) would never find a '
            + '1-wide push lane at all.');
    }
    if (!onConnector && (!Array.isArray(placement.area.cells)
        || placement.area.cells.length === 0)) {
        fail(`elements: ${where} declared an EMPTY area. An area with no cells holds no item `
            + 'and joins no edge.');
    }
    const seenArea = new Set();
    for (const c of (placement.area?.cells ?? [])) {
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
 * @param {Function} [o.footprint]  `(values) → [{w, h, orient}] | null` — the SNUG
 *   extents this element really needs, per orientation, for those values. ABSENT
 *   (or `null`) leaves the binding to size the site as it always did, which is
 *   what keeps every existing binding byte-identical. See `assertFootprints`.
 * @param {'pre-carve'|'on-connector'} [o.phase]  WHEN the binding constructs it
 *   — see the file docblock. Defaults to `pre-carve`, which is every element
 *   written before arc-3 slice 4a and is unchanged byte for byte.
 */
export function defineElement({ name, family, params = [], why, construct,
    assertPlacement = null, footprint = null, phase = PHASE_PRE_CARVE }) {
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
    if (footprint !== null && typeof footprint !== 'function') {
        fail(`elements: element "${name}"'s \`footprint\` must be a function of its VALUES — `
            + 'the snug extents depend on the parameters (a len-4 lane is longer than a '
            + 'len-2 one), so a fixed list would be a claim about one instantiation '
            + 'printed over all of them.');
    }
    if (!ELEMENT_PHASES.includes(phase)) {
        fail(`elements: element "${name}" declared phase ${JSON.stringify(phase)}; the phases `
            + `are [${ELEMENT_PHASES.join(', ')}]. "${PHASE_PRE_CARVE}" is the default and is `
            + `today's law (the whole rectangle written, reserved before the connector); `
            + `"${PHASE_ON_CONNECTOR}" is constructed AFTER the carve and writes sparsely.`);
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
        phase,
        params: base.params,
        why,
        /** ⛓ `null` when the element declares none — the binding then sizes the
         *  site itself, which is every binding written before arc 5. */
        declaresFootprint: footprint !== null,
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
                phase,
                params: row.params,
                instance: row.instance,
                why: row.why,
                /**
                 * ⛓⛓ THE SNUG EXTENTS FOR **THESE** VALUES — asked of the
                 * element, checked by the contract, and `null` both when the
                 * element declares no footprint at all and when it declines to
                 * state one for these particular values (the two are different
                 * facts and `declaresFootprint` tells them apart).
                 */
                footprint() {
                    if (footprint === null) return null;
                    return assertFootprints(footprint(row.params),
                        `element "${name}" ${JSON.stringify(row.params)}`);
                },
                construct(site) {
                    assertSite(site, `element "${name}"`);
                    /** ⛔ THE PROBE IS PART OF THE SITE for this phase, and it
                     *  is asked for HERE rather than trusted: an element whose
                     *  geometry is a function of the room cannot be handed a
                     *  site with no room and answer anything honest. */
                    if (phase === PHASE_ON_CONNECTOR) {
                        assertRoomProbe(site.room, `element "${name}"`);
                    }
                    return assertConstructOutput(construct(row.params, site, rng), {
                        name, site, values: row.params, assertPlacement, phase,
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
