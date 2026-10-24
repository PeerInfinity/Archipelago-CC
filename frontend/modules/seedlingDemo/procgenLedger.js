/**
 * seedlingDemo/procgenLedger — **THE GENERATION LEDGER: ONE ROW PER PHASE,
 * WRITTEN BY THE PHASE AS IT RUNS.**
 *
 * PROCGEN ELEMENTS arc 3, slice 5a (D3), from ⚖ the user's own requirement on
 * the 2026-08-17 generation review (§4 item 6): *"a step-through of the WHOLE
 * generation — a button per step and a report at each"*. The page reveals phase
 * k WITHOUT re-running anything, so the phases have to leave a record behind
 * them, and this is the shape of it.
 *
 * ── ⛔⛔ THE ROWS ARE APPENDED **BY** THE PHASE, NEVER ASSEMBLED AFTERWARDS
 *
 * `seedlingModel` calls `ledger.phase(name, …)` at the site where the phase
 * runs, with the facts that phase has ALREADY computed for its own purposes.
 * ⛔ The alternative — walking a constant list of phase names at the end and
 * asking each for its state — is trap 357 (*a "deepest stage" list is a second
 * spelling of the pipeline's order*): the list and the code drift, and the
 * ledger then narrates an order the generator does not run. A phase that is
 * never reached (the element branch at `--elements=none`) writes NO ROW, which
 * is the honest report and is also what makes the omission visible.
 *
 * ── ⛔ IT IS BYTE-INERT, AND THAT IS A CLAIM ABOUT THREE THINGS ────────
 *
 *  1. **No draw.** Nothing here is handed an rng. The appender reads
 *     `roomRng.draws` as a NUMBER the caller passes; it never touches a stream.
 *  2. **No payload.** The ledger hangs off `model.ledger` and off the seam's
 *     own return — never off `summary`, which is what the CLI serialises
 *     (arc-3 §15.13's false mover: a field that reaches `certification
 *     .geometry` reaches the payload, and the batch md5 moved on five rows
 *     before anybody noticed).
 *  3. **No draw stream reordering.** The appender is called AFTER the phase's
 *     own work, so a build with recording disabled (`seedlingModel({ledger:
 *     false})` — the SPY's arm, and it exists for the spy and the cost lever
 *     and for no caller) runs the same code in the same order.
 *
 * ── THE ROW ──────────────────────────────────────────────────────────
 *
 *   {index, phase, sentence, draws:{before, after},
 *    tiles:{changed:[{x,y,from,to}]},          ⛓ the DELTA against the previous row
 *    entities:{added:[…], removed:[…]},        ⛓ likewise
 *    refusal:{reason,detail}|null,
 *    data:{…scalars, facts:[PAINTABLE…]}}
 *
 * ⛓⛓⛓ **`data.facts` IS ONE SHAPE FOR EVERY INTERMEDIATE RESULT** — ⚖ the
 * user's ruling of 2026-08-18 (recorded verbatim in the arc-3 as-built §16):
 * *"only display the visual representation when the corresponding TEXT
 * DESCRIPTION is selected; then overlapping entries are less of a problem and
 * visually distinct styles per element matter less."* ⇒ every candidate set,
 * flood, path, region and pick a phase computed is a PAINTABLE
 * `{id, label, kind, cells, pick, note}`, the page lists them as selectable
 * lines, and ONE generic painter draws whichever are selected. ⛔ No per-fact
 * drawing code, and therefore no per-fact hue vocabulary to keep in step.
 *
 * ⛔ NO DOM, NO NODE IMPORTS: this is on the page's path and in a node unit
 * runner.
 */

import { TERRAIN } from './procgenLevel.js';
import { TILE_SIZE } from './levelWorld.js';

export class LedgerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LedgerError';
    }
}

const fail = (message) => { throw new LedgerError(message); };

/** ⛓ The paintable KINDS, named once. The page's painter switches on these. */
export const PAINTABLE_KINDS = Object.freeze(['cells', 'outline', 'path', 'flood']);

/**
 * ⛓⛓ **THE ONE CONSTRUCTOR FOR AN INTERMEDIATE RESULT.** Every phase builds
 * its facts through this, so a fact the page cannot paint cannot be recorded in
 * the first place — the refusal is here rather than in the painter, where it
 * would be a runtime surprise on somebody's screen.
 *
 * @param {string} id     stable within its row; the page's selection key
 * @param {string} label  the READER's line — what the phase would say about it
 * @param {string} kind   one of `PAINTABLE_KINDS`
 * @param {Array}  cells  `{x,y}` in TILE coordinates (row-major is not required)
 * @param {object|null} pick  the ONE cell the phase chose out of `cells`
 * @param {string|null} note  a clause the reader needs and the cells do not say
 */
export function paintable({ id, label, kind, cells = [], pick = null, note = null }) {
    if (typeof id !== 'string' || id === '') fail('procgenLedger: a paintable needs an id.');
    if (typeof label !== 'string' || label === '') {
        fail(`procgenLedger: the paintable ${JSON.stringify(id)} needs a label — it IS the `
            + 'line the reader selects, and a fact with no sentence cannot be chosen.');
    }
    if (!PAINTABLE_KINDS.includes(kind)) {
        fail(`procgenLedger: the paintable ${JSON.stringify(id)} declares kind `
            + `${JSON.stringify(kind)}, which is not one of [${PAINTABLE_KINDS.join(', ')}].`);
    }
    const norm = cells.map((c) => {
        const x = c.x ?? c.tx;
        const y = c.y ?? c.ty;
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            fail(`procgenLedger: the paintable ${JSON.stringify(id)} carries a cell that is `
                + `neither {x,y} nor {tx,ty}: ${JSON.stringify(c)}.`);
        }
        return Object.freeze({ x, y });
    });
    return Object.freeze({
        id,
        label,
        kind,
        cells: Object.freeze(norm),
        pick: pick ? Object.freeze({ x: pick.x ?? pick.tx, y: pick.y ?? pick.ty }) : null,
        note,
        /** ⛓ The count the page prints beside the line, so a reader can tell an
         *  empty candidate set from one it simply did not select. */
        count: norm.length,
    });
}

/**
 * ⛓ THE TERRAIN OF A RECORD AS A FLAT ARRAY OF NAMES — **one pass over the
 * tiles layer**, never `terrainAt` per cell.
 *
 * ⛔ `procgenLevel.terrainAt` is a LINEAR SCAN of the layer and costs ~5.8 µs a
 * call (arc-3 §8.6 measured 72× for asking it per cell). A snapshot per phase
 * would be 100 of those; this is one walk of the same list.
 */
export function terrainSnapshot(record) {
    const layer = (record.layers ?? []).find((l) => l.name === 'tiles');
    if (!layer) fail('procgenLedger: the record has no "tiles" layer.');
    const byColumn = new Map(Object.values(TERRAIN).map((t) => [t.column, t.name]));
    const out = new Array(record.width * record.height).fill(null);
    for (const [tx, ty, txPixel] of layer.tiles) {
        out[tx + ty * record.width] = byColumn.get(Math.floor(txPixel / TILE_SIZE)) ?? null;
    }
    return out;
}

/** ⛓ The identity of an entity for the added/removed diff — type, cell and
 *  attributes, because two `lock`s differ only in their tags. */
const entityKey = (e) => `${e.type}@${e.x},${e.y}#${JSON.stringify(e.attrs ?? null)}`;

/**
 * ⛓⛓⛓ THE APPENDER. One per model construction.
 *
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {boolean} [o.enabled]  ⛔ **THE SPY'S ARM AND THE COST LEVER, AND NOT A
 *   CALLER-FACING KNOB.** `false` makes every `phase()` call return immediately
 *   and leaves `rows()` empty, which is what lets a test prove that a model with
 *   recording OFF produces a byte-identical `--json` payload — the claim that
 *   the recording is inert. Nothing in the shipped callers passes it.
 */
export function makeLedger({ width, height, enabled = true } = {}) {
    const rows = [];
    let prevTiles = null;
    let prevEntities = new Map();
    let prevDraws = 0;

    /**
     * ⛔ THE DELTA IS AGAINST THE PREVIOUS ROW, NOT AGAINST THE START, so
     * folding rows 0..k rebuilds the room as of phase k and no row carries a
     * second copy of the terrain. The FIRST row's delta is therefore the whole
     * room, which is correct: before the first phase there is no room.
     */
    const tileDelta = (record) => {
        if (record === null) return Object.freeze({ changed: Object.freeze([]) });
        const now = terrainSnapshot(record);
        const changed = [];
        for (let i = 0; i < now.length; i += 1) {
            const from = prevTiles === null ? null : prevTiles[i];
            if (from === now[i]) continue;
            changed.push(Object.freeze({ x: i % width, y: Math.floor(i / width), from, to: now[i] }));
        }
        prevTiles = now;
        return Object.freeze({ changed: Object.freeze(changed) });
    };

    const entityDelta = (entities) => {
        if (entities === null) return Object.freeze({ added: Object.freeze([]), removed: Object.freeze([]) });
        const now = new Map(entities.map((e) => [entityKey(e), e]));
        const added = [];
        const removed = [];
        for (const [k, e] of now) if (!prevEntities.has(k)) added.push(e);
        for (const [k, e] of prevEntities) if (!now.has(k)) removed.push(e);
        prevEntities = now;
        return Object.freeze({ added: Object.freeze(added), removed: Object.freeze(removed) });
    };

    return {
        enabled,
        /**
         * ⛓ THE CALL A PHASE MAKES. `record`/`entities` are what the room looks
         * like AFTER this phase; pass `null` for a phase that wrote neither
         * (the head draw, the graph) and the delta is empty rather than absent.
         */
        phase(name, { sentence, draws, record = null, entities = null,
            refusal = null, data = {}, facts = [] } = {}) {
            if (!enabled) return;
            if (typeof sentence !== 'string' || sentence === '') {
                fail(`procgenLedger: phase ${JSON.stringify(name)} recorded no SENTENCE. ⛔ `
                    + 'Every row carries the phase\'s OWN words — a row the page can only '
                    + 'describe by re-narrating it is a second answer to what the phase did.');
            }
            const after = Number.isFinite(draws) ? draws : prevDraws;
            const row = Object.freeze({
                index: rows.length,
                phase: name,
                sentence,
                draws: Object.freeze({ before: prevDraws, after }),
                tiles: tileDelta(record),
                entities: entityDelta(entities),
                refusal: refusal ? Object.freeze({ ...refusal }) : null,
                data: Object.freeze({ ...data, facts: Object.freeze(facts.filter(Boolean)) }),
            });
            prevDraws = after;
            rows.push(row);
        },
        rows: () => Object.freeze([...rows]),
    };
}

/**
 * ⛓⛓ **A ROW FOR A PHASE THAT WROTE NEITHER TILES NOR ENTITIES** — the
 * CERTIFICATION, which runs in the SEAM after the model is built.
 *
 * ⛔ It is a second CONSTRUCTOR and not a second SHAPE: the row is the same
 * object `phase()` builds, with the two deltas empty, so `foldLedger` and the
 * page's readers meet one thing. The seam cannot use the appender itself
 * because the appender's delta bookkeeping lives in the model's closure — and
 * it does not need to, because a certification solve writes no tile: it either
 * passes, or the model is REBUILT with the element dropped and its own ledger
 * describes the room that shipped.
 */
export function phaseRow({ index, phase: name, sentence, draws = 0, refusal = null,
    data = {}, facts = [] } = {}) {
    if (typeof sentence !== 'string' || sentence === '') {
        fail(`procgenLedger: phaseRow ${JSON.stringify(name)} recorded no SENTENCE.`);
    }
    return Object.freeze({
        index,
        phase: name,
        sentence,
        draws: Object.freeze({ before: draws, after: draws }),
        tiles: Object.freeze({ changed: Object.freeze([]) }),
        entities: Object.freeze({ added: Object.freeze([]), removed: Object.freeze([]) }),
        refusal: refusal ? Object.freeze({ ...refusal }) : null,
        data: Object.freeze({ ...data, facts: Object.freeze(facts.filter(Boolean)) }),
    });
}

/**
 * ⛓⛓⛓ **THE ROOM AS OF PHASE k, FOLDED FROM THE DELTAS** — the step-through's
 * whole mechanism, and it re-runs nothing.
 *
 * @returns {{terrain: Array<{tx,ty,terrain}>, entities: Array}} the terrain
 *   writes to apply to a wall-filled room of this size, and the entities that
 *   existed at the end of row k.
 */
export function foldLedger(rows, k, { width, height }) {
    if (!Number.isInteger(k) || k < 0) {
        fail(`procgenLedger: phase index ${JSON.stringify(k)} is not a non-negative integer.`);
    }
    const tiles = new Array(width * height).fill(null);
    const entities = new Map();
    for (let i = 0; i <= Math.min(k, rows.length - 1); i += 1) {
        for (const c of rows[i].tiles.changed) tiles[c.x + c.y * width] = c.to;
        for (const e of rows[i].entities.removed) entities.delete(entityKey(e));
        for (const e of rows[i].entities.added) entities.set(entityKey(e), e);
    }
    const terrain = [];
    for (let i = 0; i < tiles.length; i += 1) {
        if (tiles[i] === null) continue;
        terrain.push({ tx: i % width, ty: Math.floor(i / width), terrain: tiles[i] });
    }
    return { terrain, entities: [...entities.values()] };
}
