/**
 * procgenCore/elements/openChamber — **THE ELEMENT THAT IS SPACE.** A single
 * open floor blob, declared as an AREA, with a mouth a connector can attach to
 * and NOTHING ELSE: no block, no button, no door, no symbol, no tag.
 *
 * PROCGEN ELEMENTS arc 5, slice 3 (`NewDocs/plans/procgen-elements-arc5-
 * kickoff.md` §3.3), and it exists because of a MEASUREMENT rather than an
 * argument. ⚖ Design ruling 24 says *area is pass 1's job*; slice 1's area
 * census then measured what pass 1 could actually build:
 *
 *   **a BARE TREE KIND accepts `--areas=2` on 0 of 264 cells at EVERY size —
 *   10x10, 15x15, 20x20 and 30x30 alike** (§9.4), refusing throughout with
 *   `no-area-at-that-key-level-can-hold-its-key`.
 *
 * ⇒ a bigger tree room grows its CORRIDOR, not its AREAS (`winding`'s corridor
 * sites go 10 -> 51 from 10x10 to 20x20 while its chamber count stays 1). What
 * a tree kind lacks is a PLACE, and no amount of room gives it one. This
 * element is a place.
 *
 * ── ⛔ IT IS THE GUARD'S CONTRACT WITH THE PUZZLE TAKEN OUT ────────────
 *
 * The reverse-pull block declares an `area` because its push lane is 1 wide and
 * the partition's blob rule (an all-floor 2x2 square) would shred it. This
 * element declares an `area` for the opposite reason: its blob IS a chamber by
 * that rule — every cell of a `w x h` open rectangle with `w, h >= 2` belongs
 * to an all-floor 2x2 square — and it declares it anyway, because a DECLARED
 * area is one the partition never has to find, is excluded from the blob rule
 * entirely, and carries the element's own id (`E0`) into the graph. ⛓ That the
 * blob really is a chamber by `sites.js`' own rule is ASSERTED by a unit row
 * over a generated skeleton, not assumed from this paragraph.
 *
 * ⛔ **NO SYMBOL, NO TAG, NO `binds`.** `symbols.holds` and `symbols.grants`
 * are both empty: this element does not hold a door open and does not grant a
 * key, so there is nothing for the area graph to BIND to it. What the graph may
 * do with the space is put a key IN it, which is `capacity.item` — the
 * partition's own lever, decided by the binding, and untouched here. A chamber
 * that named a symbol would be a guard with no door.
 *
 * ── ⛔⛔ THE DECLARED DRAW ORDER ──────────────────────────────────────
 *
 *   1. `w`         ⎫ the parameters, in schema order, by `defineElement`'s
 *   2. `h`         ⎭ (= `defineTemplate`'s) machinery. An override spends none.
 *   then, at `construct`, FROM THE SAME STREAM:
 *   3. `entryDir`  the side the mouth is PREFERRED on — `pick(PORT_DIRS)`
 *   4. `entryAt`   where along that side              — `pick(that edge's cells)`
 *
 * ⛔ TWO GEOMETRY DRAWS, ALWAYS, WHATEVER THE PARAMETERS — so the draw count is
 * a constant and a record of this element is `{params, site}` plus the level's
 * seed, exactly as `elements.js` requires of every element.
 *
 * ⛓⛓⛓ **AND SINCE ARC 5 SLICE 4 ALL FOUR MOUTHS ARE DECLARED, STILL ON TWO
 * DRAWS.** The drawn side is the element's PREFERENCE and the other three are
 * derivations (`openChamberMouths`); the BINDING takes the first its room can
 * use, because whether a mouth cell is the room's border ring is a fact about
 * the ROOM. Slice 3 measured what declaring one cost: 28 of 70 refusals at
 * 10x10 were `the-entry-mouth-is-the-rooms-border-ring`.
 *
 * ⛓ **THE EXIT PORTS SPEND NO DRAW.** Each is the OPPOSITE side at the SAME
 * offset, which is a derivation and not a decision: a binding that wants to
 * carry a corridor THROUGH the chamber has a mouth at each end, and one that
 * seals everything but the chosen entry (Seedling's composite does) gets a side
 * room. Drawing them would be four decisions nothing in either binding reads.
 *
 * ── REFUSALS, BY NAME ─────────────────────────────────────────────────
 *   `site-is-not-a-declared-footprint`  the rectangle the binding offered is
 *                     not one of the ones `openChamberFootprint` named for
 *                     these values. ⛔ A chamber's snug footprint IS its size:
 *                     a bigger rectangle is a bigger chamber and this element
 *                     will not silently build one, and a smaller one it cannot
 *                     fill. Deterministic, spends NO draw — so a binding that
 *                     sizes its own site (the maze's `len + SITE_MARGIN`
 *                     square) is REFUSED BY NAME rather than throwing a
 *                     contract error over a tile written outside its site.
 *
 * ⛔ IMPORTS NOTHING SUBSTRATE-SIDE. `gridTiles.js` is the ONE grid vocabulary;
 * everything else is `procgenCore/`. Asserted in `bindingContract.test.js`.
 */

import { TILE_FLOOR } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';
import { DIR_DELTA, OPPOSITE_DIR, PORT_DIRS, defineElement } from '../elements.js';

/** ⛓ THE CENSUS KEY for this module — every refusal name it raises. The gate is
 *  `procgenCore/refusalCensus.test.js`, which scans this file's own text. */
export const OPEN_CHAMBER_REFUSALS = Object.freeze([
    'site-is-not-a-declared-footprint',
]);

/**
 * ⛓ BELOW THIS THE BLOB IS NOT A CHAMBER. `areaPartition.wideBlobs`' rule is
 * *a cell is WIDE iff it belongs to at least one all-floor 2x2 square*, so a
 * 1-wide strip is CORRIDOR in the site vocabulary and would be a declared area
 * the room's own rule disagrees with. 2 is the smallest honest chamber.
 */
export const MIN_CHAMBER = 2;

const OPPOSITE = OPPOSITE_DIR;

/**
 * ⛓⛓⛓ **THE SNUG FOOTPRINT — AND FOR THIS ELEMENT IT IS THE WHOLE GEOMETRY**
 * (`elements.assertFootprints` states the contract this answers; arc 5, slice
 * 2 built the seam).
 *
 * The reverse-pull block's two axes are different lengths because its lane and
 * its exit corridor are different things. A chamber has one thing in it —
 * space — so its footprint is exactly `w x h`, and when `w !== h` the SAME
 * chamber turned on its side is a second, distinct rectangle the binding may
 * offer. ⛔ At `w === h` the two coincide and the contract refuses a list that
 * names one rectangle twice, so this returns ONE entry, named `square`.
 */
export function openChamberFootprint({ w, h }) {
    if (w === h) return [{ w, h, orient: 'square' }];
    return [
        { w, h, orient: 'wide' },
        { w: h, h: w, orient: 'tall' },
    ];
}

/** The cells of one edge of a rectangle, in row-major order. */
function edgeCells(site, dir) {
    const out = [];
    if (dir === 'N' || dir === 'S') {
        const y = dir === 'N' ? site.y : site.y + site.h - 1;
        for (let x = site.x; x < site.x + site.w; x += 1) out.push({ x, y });
    } else {
        const x = dir === 'W' ? site.x : site.x + site.w - 1;
        for (let y = site.y; y < site.y + site.h; y += 1) out.push({ x, y });
    }
    return out;
}

/** The same cell on the OPPOSITE edge — the mirror across the site's middle. */
function mirrorCell(site, dir, c) {
    if (dir === 'N' || dir === 'S') {
        return { x: c.x, y: dir === 'N' ? site.y + site.h - 1 : site.y };
    }
    return { x: dir === 'W' ? site.x + site.w - 1 : site.x, y: c.y };
}

/**
 * ⛓⛓⛓ **THE BLOB — THE HALF THE ARENA SHARES** (arc 5, slice 4). The footprint
 * check and the fill, with NO draw and no payload: an arena is this blob plus
 * bodies, and this function existing is what makes "the arena does not fork the
 * chamber" a diff a reader can check rather than a claim.
 *
 * @returns {{tiles, cells}|{refused:{reason, detail}}}
 */
export function openChamberBlob(values, site) {
    const shapes = openChamberFootprint(values);
    if (!shapes.some((f) => f.w === site.w && f.h === site.h)) {
        return { refused: { reason: 'site-is-not-a-declared-footprint',
            detail: `the binding offered ${site.w}x${site.h} and a w=${values.w} h=${values.h} `
                + `chamber declares [${shapes.map((f) => `${f.w}x${f.h}`).join(', ')}]. ⛔ A `
                + 'chamber\'s snug footprint IS its size, so a rectangle that is not one of '
                + 'them is a different chamber — this element fills what it declared and does '
                + 'not silently grow into, or rattle around inside, somebody else\'s guess.' } };
    }
    const tiles = [];
    const cells = [];
    for (let y = site.y; y < site.y + site.h; y += 1) {
        for (let x = site.x; x < site.x + site.w; x += 1) {
            tiles.push({ x, y, tile: TILE_FLOOR });
            cells.push(Object.freeze({ x, y }));
        }
    }
    return { tiles, cells };
}

/**
 * ⛓⛓⛓ **THE FOUR MOUTHS, TWO DRAWS** — arc 5, slice 4 (`elements.js`'s
 * *entry ports are a candidate list in preference order*).
 *
 * The two draws are the ones slice 3 declared and they still mean what they
 * meant: the side the element PREFERS its mouth on, and where along that side.
 * What is new is that the other three sides are declared TOO, as fallbacks the
 * binding may take when its room cannot use the preferred one — and they are
 * DERIVATIONS, so this spends exactly two draws whatever the site is:
 *
 *   · the preference ORDER is the drawn side first, then the remaining three in
 *     `PORT_DIRS` order — a rotation fixed by one draw;
 *   · each other side's mouth is the cell at THE SAME INDEX ALONG THAT SIDE,
 *     clamped to its length (a `w x h` blob's N/S edges are `w` long and its
 *     E/W edges `h`, so the index is clamped rather than assumed to fit). ⛓ On
 *     the drawn side the clamp is a no-op and the port IS the drawn cell, which
 *     is what makes the change a strict extension.
 *   · each entry's `exit` is its mirror across the site, exactly as slice 3's
 *     single pair was, and is matched back to it by DIRECTION.
 *
 * ⛔ ONE ENTRY PER SIDE, NOT ONE PER EDGE CELL. A list of every edge cell would
 * be a search the binding performs with the element's draws already spent —
 * the thing arc 2 refused when it ruled *refuse rather than redraw*. Four is
 * the number of ways a rectangle faces a room.
 */
export function openChamberMouths(site, rng) {
    /** ⛓ DRAW 3 — the side the mouth is PREFERRED on, over the ONE direction
     *  vocabulary. */
    const entryDir = rng.pick(PORT_DIRS);
    const drawnEdge = edgeCells(site, entryDir);
    /** ⛓ DRAW 4 — where along that side, over the edge's cells row-major. */
    const entryPort = rng.pick(drawnEdge);
    const at = drawnEdge.findIndex((c) => c.x === entryPort.x && c.y === entryPort.y);
    const order = [entryDir, ...PORT_DIRS.filter((dir) => dir !== entryDir)];
    const mouthOn = (dir) => {
        const cells = edgeCells(site, dir);
        return cells[Math.min(at, cells.length - 1)];
    };
    return [
        ...order.map((dir) => {
            const c = mouthOn(dir);
            return { x: c.x, y: c.y, dir, role: 'entry' };
        }),
        ...order.map((dir) => {
            const m = mirrorCell(site, dir, mouthOn(dir));
            return { x: m.x, y: m.y, dir: OPPOSITE[dir], role: 'exit' };
        }),
    ];
}

/**
 * The element's internals, exported so the geometry is testable without the
 * contract wrapper.
 *
 * @returns {{placement}|{refused:{reason, detail}}}
 */
export function buildOpenChamber(values, site, rng) {
    const blob = openChamberBlob(values, site);
    if (blob.refused) return blob;
    const { tiles, cells } = blob;
    const ports = openChamberMouths(site, rng);
    return { placement: {
        tiles,
        /** ⛔ ALL FOUR DECLARED AND ALL FOUR EMPTY — the contract requires the
         *  arrays either way, and an element that is SPACE puts nothing in the
         *  room but the space. */
        entities: { blocks: [], buttons: [], obstacles: [], items: [] },
        ports,
        /**
         * ⛔ **NOTHING OUTSIDE ME MATTERS**, which is what an empty `demand`
         * says (`elements.js` names that spelling). The guard demands its ring
         * stay wall because a second way in would put the player past its door
         * without the block; a chamber has no door and no inside to protect —
         * what the binding does with the ring is the binding's decision, and a
         * demand here would be this element voting on it.
         */
        demand: [],
        /** ⛓ THE WHOLE BLOB, ROW-MAJOR — the partition consumes it exactly as
         *  it consumes the guard's, through the same `declared` parameter. */
        area: { cells, kind: 'element' },
        symbols: { holds: [], grants: [] },
        cost: { w: site.w, h: site.h, cells: cells.length },
    } };
}

/** The invariants only THIS element can state — asked on every construct. */
function assertOpenChamberPlacement(placement, { site, fail }) {
    const { blocks, buttons, obstacles, items } = placement.entities;
    const n = blocks.length + buttons.length + obstacles.length + items.length;
    if (n !== 0) {
        fail(`openChamber: a chamber is SPACE and puts NO entity in the room — got ${n} `
            + '(blocks/buttons/obstacles/items '
            + `${blocks.length}/${buttons.length}/${obstacles.length}/${items.length}). An `
            + 'element that placed one would be a guard, an arena or a door wearing this '
            + 'element\'s name.');
    }
    if (placement.symbols.holds.length !== 0 || placement.symbols.grants.length !== 0) {
        fail('openChamber: a chamber holds and grants NOTHING. A symbol here would be a '
            + 'door the area graph could bind to and there is no door.');
    }
    if (site.w < MIN_CHAMBER || site.h < MIN_CHAMBER) {
        fail(`openChamber: ${site.w}x${site.h} is under ${MIN_CHAMBER} on an axis, so the blob `
            + 'has no all-floor 2x2 square and is CORRIDOR by `wideBlobs`\' own rule — a '
            + 'declared area the room\'s vocabulary would disagree with.');
    }
    if (placement.area.cells.length !== site.w * site.h) {
        fail(`openChamber: the declared area is ${placement.area.cells.length} cell(s) and the `
            + `site is ${site.w}x${site.h} = ${site.w * site.h}. The blob IS the site — an `
            + 'area smaller than the write would leave floor no area owns inside a rectangle '
            + 'the binding reserved.');
    }
    assertBlobMouths(placement, { site, fail, owner: 'openChamber' });
}

/**
 * ⛓⛓ **THE MOUTH INVARIANTS, SHARED WITH THE ARENA** (arc 5, slice 4) — the
 * four-mouth contract stated where it can be ASKED rather than only described.
 * ⛔ It is asserted per element rather than in `assertPlacementShape` because
 * the contract permits ONE entry (the guard declares one); *four, one per side,
 * each paired with its mirror* is a claim about a BLOB.
 */
export function assertBlobMouths(placement, { site, fail, owner }) {
    const entries = placement.ports.filter((p) => p.role === 'entry');
    const exits = placement.ports.filter((p) => p.role === 'exit');
    if (entries.length !== PORT_DIRS.length || exits.length !== PORT_DIRS.length
        || placement.ports.length !== 2 * PORT_DIRS.length) {
        fail(`${owner}: a blob declares one mouth PER SIDE — ${PORT_DIRS.length} entry ports `
            + `and ${PORT_DIRS.length} exit ports; got ${entries.length}/${exits.length} out `
            + `of ${placement.ports.length}. The binding picks among them (⛓ \`elements`
            + '.chooseEntryPort\`), so a short list is mouths the room was never offered.');
    }
    if (new Set(entries.map((p) => p.dir)).size !== PORT_DIRS.length
        || new Set(exits.map((p) => p.dir)).size !== PORT_DIRS.length) {
        fail(`${owner}: two mouths face the same way (entries `
            + `[${entries.map((p) => p.dir)}], exits [${exits.map((p) => p.dir)}]). One per `
            + 'side is what makes the exit pairing by DIRECTION unambiguous.');
    }
    for (const entry of entries) {
        const exit = exits.find((p) => p.dir === OPPOSITE[entry.dir]);
        const mirror = mirrorCell(site, entry.dir, entry);
        if (exit.x !== mirror.x || exit.y !== mirror.y) {
            fail(`${owner}: the ${entry.dir} entry at (${entry.x},${entry.y}) pairs with the `
                + `${exit.dir} exit at (${exit.x},${exit.y}), and its mirror across the site `
                + `is (${mirror.x},${mirror.y}). The exit is the OPPOSITE side at the SAME `
                + 'offset by derivation, so a disagreement here is a defect in the mirror '
                + 'rather than a fact about the site.');
        }
        const d = DIR_DELTA[entry.dir];
        if (site.w === 1 || site.h === 1 || (d.dx === 0 && d.dy === 0)) {
            fail(`${owner}: the entry direction is not one of the four orthogonals.`);
        }
    }
}

export const OPEN_CHAMBER = defineElement({
    name: 'open-chamber',
    family: 'chamber',
    why: 'The element that is SPACE (⚖ design ruling 24, arc-5 §3.3): an open floor blob '
        + 'DECLARED as an area, so a room whose skeleton offers no chamber at all — every '
        + 'bare tree kind, at every size slice 1 measured — has somewhere a key can live. '
        + 'It holds nothing, grants nothing and locks nothing; what it provides is a PLACE.',
    params: [
        { key: 'w', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s width. 2 is the smallest rectangle `wideBlobs`\' 2x2 rule calls '
                + 'a chamber at all; 6 is where the reserved rectangle (the blob plus a '
                + 'one-cell ring) stops fitting the 8x8 interior of the DEFAULT 10x10 room '
                + 'with the start and the goal left outside it.' },
        { key: 'h', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s height, on the same domain and for the same two reasons. ⛓ It '
                + 'is a SEPARATE knob because a non-square chamber has two orientations and '
                + 'the site pick offers both (arc 5, slice 2) — which is the difference '
                + 'between 9 candidate positions and 15-and-15 on a small room.' },
    ],
    construct(values, site, rng) {
        const out = buildOpenChamber(values, site, rng);
        return out.refused ? out : out.placement;
    },
    footprint: openChamberFootprint,
    assertPlacement: assertOpenChamberPlacement,
});
