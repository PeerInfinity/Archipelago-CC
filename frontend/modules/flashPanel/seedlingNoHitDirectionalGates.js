/**
 * flashPanel/seedlingNoHitDirectionalGates — **THE DIRECTIONAL NO-HIT GATES, READ FROM A PER-ROOM TABLE** (slice
 * rules-no-hit-directional).
 *
 * ⚖ USER RULING, 2026-11-11, verbatim: "Add the directional gates for now, but make a note to reexamine this later."
 * (And earlier that day: "No-hit rule: gate it": the logic never expects the player to tank a hit, generalising the
 * 2026-10-21 L16 ruling.)
 *
 * ⚠ THIS IS A PER-ROOM TABLE FOR NOW, TO BE RE-EXAMINED LATER. `seedlingNoHitDirectionalGates.json` states, per room,
 * which way across a wallflyer band costs an item arm. It is the arc's one licensed exception to "no single-level
 * literal": slice rules-no-hit-l22 found no general derivation of the DIRECTION (the bands themselves are derived:
 * `seedlingWallFlyerBands`), and the game showed that charging every band is too strict (L27 both ways, L25 east to
 * west and L22 north to south are walked with no item and no hit). The general rule that slice suggested, NOT built
 * and the thing to re-examine: **a band is passable with no item where the room offers a waiting spot off the ray at
 * the far end of every flight.**
 *
 * So the table is DATA backed by the game witness, and a gate cannot outlive its evidence:
 *   - a gate's band is named by its flyers; the tiles are `wallFlyerBands`' (never typed in the table), and a flyer the
 *     level does not hold is refused;
 *   - every witness id must be in `scripts/procgen/seedling-wallflyer-nohit-plans.json` (the probe
 *     `probe-seedling-wallflyer-nohit.mjs` plays those plans on the game): each `notFound` id under `notFound`, each
 *     arm's id and each `free` id under `plans`. A missing one refuses the gate BY NAME;
 *   - each witness is checked against the gate it stands for: its level, its arm (the control `none` for `notFound`
 *     and `free`, the arm's own item for an arm), and its direction (a blocked-direction witness starts behind the
 *     band and ends past it along `blocked`; a `free` one the reverse);
 *   - the blocked direction is across every flight of the band (perpendicular to each flyer's launch), and every arm
 *     of the gate has a witness.
 *
 * What a gate does to the grid (`stampNoHitDirectionalGates`): each band tile that is not a wall takes
 * `dirs[blocked] += anyOf(arms)`, the analyzer's gate on MOVING that way on the tile (the waterfall's kind). The
 * reverse direction, both sides of the band and every door stay as they were.
 */
import { flag, anyOf } from './seedlingSemantics.js';

const NAME = 'no-hit directional gates';
/** Unit step of each compass letter (y grows downward). */
const STEP = Object.freeze({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] });
/** The plan-file arm each engine flag is witnessed under (`probe-seedling-wallflyer-nohit.mjs` `ARMS`). */
export const WITNESS_ARM_OF_FLAG = Object.freeze({ hasSword: 'sword', hasSpear: 'spear', hasShield: 'shield' });

const parseWitness = (id) => {
    const m = /^l(\d+)-(\d+)-(\d+)-([a-z]+)$/.exec(id);
    return m ? { level: Number(m[1]), from: Number(m[2]), to: Number(m[3]), arm: m[4] } : null;
};

/** The condition a gate's blocked direction costs: any one of its arms. */
export const gateCondition = (gate) => anyOf(...gate.arms.map((f) => flag(f)));

/**
 * One level's gates, checked against the level, its bands and the witness plans. Throws by name on any refusal.
 *
 * @param {{gates:object[]}} table the committed table
 * @param {{plans:object, notFound:object}} plans the witness plans file
 * @param {{level:number, entities?:object[]}} level a map level record
 * @param {{id:string, launch:{x:number,y:number}, tiles:[number,number][]}[]} bands `wallFlyerBands(level, world)`
 * @param {(levelNo:number, to:number)=>{door:[number,number], landing:[number,number]}|null} doorOf the level's door to
 *   room `to` (its tile) and the tile the far room's door lands the player on in THIS level
 * @returns {{gate:object, condition:object, blocked:string, tiles:[number,number][]}[]}
 */
export function noHitDirectionalGatesFor(table, plans, level, bands, doorOf) {
    const out = [];
    for (const gate of (table.gates ?? []).filter((g) => g.level === level.level)) {
        const who = `${NAME}: L${gate.level} ${gate.blocked} [${(gate.band ?? []).join(', ')}]`;
        const step = STEP[gate.blocked];
        if (!step) throw new Error(`${who}: "blocked" is not one of N, E, S, W`);
        if (!Array.isArray(gate.band) || gate.band.length === 0) throw new Error(`${who}: names no flyer`);
        if (!Array.isArray(gate.arms) || gate.arms.length === 0) throw new Error(`${who}: names no arm`);
        const tiles = new Map();
        for (const id of gate.band) {
            const band = bands.find((b) => b.id === id);
            if (!band) throw new Error(`${who}: level ${level.level} holds no ${id} (its wallflyers: ${bands.map((b) => b.id).join(', ') || 'none'})`);
            if (Math.round(band.launch.x) * step[0] + Math.round(band.launch.y) * step[1] !== 0 || (band.launch.x === 0 && band.launch.y === 0)) {
                throw new Error(`${who}: ${id} flies (${band.launch.x}, ${band.launch.y}), which "${gate.blocked}" does not cross`);
            }
            for (const [tx, ty] of band.tiles) tiles.set(`${tx},${ty}`, [tx, ty]);
        }
        // Where the band lies along the blocked axis: a blocked-direction witness starts before it and ends past it.
        const along = ([x, y]) => x * step[0] + y * step[1];
        const lo = Math.min(...[...tiles.values()].map(along));
        const hi = Math.max(...[...tiles.values()].map(along));
        const witness = (id, { list, listName, arm, blocked }) => {
            if (!(id in (list ?? {}))) {
                throw new Error(`${who}: its witness ${id} is not under "${listName}" in the witness plans file `
                    + '(scripts/procgen/seedling-wallflyer-nohit-plans.json) — the gate has lost its evidence');
            }
            const c = parseWitness(id);
            if (!c || c.level !== gate.level) throw new Error(`${who}: witness ${id} is not a case of level ${gate.level}`);
            if (c.arm !== arm) throw new Error(`${who}: witness ${id} holds "${c.arm}", not "${arm}"`);
            const from = doorOf(gate.level, c.from);
            const to = doorOf(gate.level, c.to);
            if (!from || !to) throw new Error(`${who}: witness ${id} names a door level ${gate.level} does not have`);
            const [start, end] = blocked ? [along(from.landing), along(to.door)] : [along(to.door), along(from.landing)];
            if (!(start < lo && end > hi)) throw new Error(`${who}: witness ${id} does not cross the band ${blocked ? 'in' : 'against'} the blocked direction`);
        };
        const w = gate.witness ?? {};
        if (!Array.isArray(w.notFound) || w.notFound.length === 0) throw new Error(`${who}: no NOT FOUND witness of the blocked direction`);
        for (const id of w.notFound) witness(id, { list: plans.notFound, listName: 'notFound', arm: 'none', blocked: true });
        for (const f of gate.arms) {
            const arm = WITNESS_ARM_OF_FLAG[f];
            if (!arm) throw new Error(`${who}: arm ${f} has no witness arm (${Object.keys(WITNESS_ARM_OF_FLAG).join(', ')})`);
            const id = w.arms?.[f];
            if (!id) throw new Error(`${who}: arm ${f} has no witness plan`);
            witness(id, { list: plans.plans, listName: 'plans', arm, blocked: true });
        }
        const extra = Object.keys(w.arms ?? {}).filter((f) => !gate.arms.includes(f));
        if (extra.length) throw new Error(`${who}: witness for ${extra.join(', ')}, which the gate does not offer`);
        for (const id of w.free ?? []) witness(id, { list: plans.plans, listName: 'plans', arm: 'none', blocked: false });
        out.push({ gate, condition: gateCondition(gate), blocked: gate.blocked, tiles: [...tiles.values()] });
    }
    return out;
}

/**
 * The grid with each gate's band tiles charged `dirs[blocked]`. A wall tile is skipped (a flyer rests inside its
 * wall); a tile that is a door (`doorTiles`, `"tx,ty"`) is refused, so every door stays free.
 */
export function stampNoHitDirectionalGates(grid, gates, doorTiles = new Set()) {
    if (gates.length === 0) return grid;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const cells = grid.cells.slice();
    for (const { gate, condition, blocked, tiles } of gates) {
        for (const [tx, ty] of tiles) {
            const x = tx - ox;
            const y = ty - oy;
            if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
            const i = y * grid.width + x;
            const cell = cells[i];
            if (cell.kind === 'wall') continue;
            if (doorTiles.has(`${tx},${ty}`)) throw new Error(`${NAME}: L${gate.level} ${blocked}: the band tile [${tx},${ty}] is a door`);
            if (cell.kind !== 'open') throw new Error(`${NAME}: L${gate.level} ${blocked}: the band tile [${tx},${ty}] is ${cell.kind}, not open floor`);
            if (cell.dirs?.[blocked] === null) continue;
            cells[i] = {
                ...cell,
                kind: 'directional',
                labels: [...(cell.labels ?? []), 'no-hit band'],
                dirs: { ...(cell.dirs ?? {}), [blocked]: [...(cell.dirs?.[blocked] ?? []), condition] },
            };
        }
    }
    return { ...grid, cells };
}
