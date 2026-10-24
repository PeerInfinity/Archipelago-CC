/**
 * mazeRoom/mazeElementOverlay.test — ⛓⛓⛓ THE PIXEL GATE FOR THE **SECOND**
 * SIBLING DRAW (PROCGEN ELEMENTS arc 2, slice 4).
 *
 * ⛓ THE ONE RECORDING CONTEXT (`drawOpRecorder.js`), the same one
 * `mazeRoomRender.test.js` and `mazeAreaOverlay.test.js` use — a second
 * recorder would be a second answer to *"what counts as a draw operation"*, and
 * the value of that one is that it THROWS on a member it does not model rather
 * than dropping the op out of the log.
 *
 * ── ⛔ THE HASH IS A DRIFT DETECTOR, NOT THE CLAIM (trap 300) ─────────
 *
 * This draw is NEW. There is no earlier tree to capture a hash FROM, so a
 * pasted hash of my own output is a fixed point and nothing more. ⇒ every
 * claim below is a COUNT or a GEOMETRY computed independently from the
 * placement (how many tunnel cells the binding recorded, where the site
 * rectangle is, which cell the block is in at frame k), and the hash is
 * recorded beside them, labelled as exactly that.
 *
 * ── ⛓⛓ THE ROW THIS FILE EXISTS FOR ──────────────────────────────────
 *
 * *"the overlay draws `state.blocks`, not `world.blocks`, during a replay"* —
 * mutant (b) of this slice. It is asserted TWICE: once as a value (the block
 * `fillRect` lands on the cell the live layout names) and once as a
 * DIFFERENTIAL (two different `view.blocks` produce two different logs), because
 * the first alone would pass on a build that ignored `view.blocks` whenever the
 * live layout happened to equal the initial one.
 */

import { describe, expect, it } from 'vitest';

import { hashOf, recordingContext } from './drawOpRecorder.js';
import {
    ELEMENT_COLORS, ElementOverlayError, assertElementView, drawElementOverlay, elementLegend,
} from './mazeElementOverlay.js';
import { mazeModel } from './procgenMaze.js';

const TILE = 20;
const GUARD = { name: 'guard', params: { len: 2, turns: 1 } };
const logOf = (elements, { layer = 'all', blocks = null, tilePx = TILE } = {}) => {
    const ctx = recordingContext();
    drawElementOverlay(ctx, elements, { tilePx, layer, blocks });
    return ctx.__log;
};
const countOf = (log, prefix) => log.filter((op) => op.startsWith(prefix)).length;

/**
 * ⛓ THE SUBJECTS ARE THE ONES THE CENSUS MEASURED (§10.1): `guard;len=2;
 * turns=1` on `rooms` at 15x15 places on about 57% of seeds. Seed 6 places AND
 * guards K0 with a 20-cell tunnel — the long tunnel is what makes the
 * "distinguish it from the carve" claims non-vacuous. Seed 1 REFUSES at the
 * same size, which is the honest majority state (§10.11.5).
 */
const PLACED = mazeModel({
    seed: 6, width: 15, height: 15, skeleton: { kind: 'rooms' }, areas: { keys: 1 },
    elements: GUARD,
}).elements;
const REFUSED = mazeModel({
    seed: 1, width: 15, height: 15, skeleton: { kind: 'rooms' }, areas: { keys: 1 },
    elements: GUARD,
}).elements;
const OFF = mazeModel({ seed: 6, width: 15, height: 15, skeleton: { kind: 'rooms' } }).elements;

const P = () => PLACED.placed[0];
const keyOf = (c) => `${c.x},${c.y}`;

describe('mazeElementOverlay — the subjects are what this arc measured', () => {
    it('⛔ THE NON-VACUITY GUARD: one subject really placed, one really refused', () => {
        // Every row below is about one of these three, and a subject that
        // quietly stopped placing would make the whole file pass for nothing.
        expect(PLACED.ran).toBe(true);
        expect(PLACED.placed).toHaveLength(1);
        expect(P().guards).toBe('K0');
        expect(P().tunnel.length).toBeGreaterThan(10);
        expect(REFUSED.ran).toBe(false);
        expect(REFUSED.refused.reason).toBe('the-entry-port-cannot-be-joined');
        expect(OFF.spec.name).toBe('none');
    });
});

describe('mazeElementOverlay — the draw', () => {
    it('⛔ draws NOTHING at `off`, on a REFUSED element, or with no element at all', () => {
        expect(logOf(PLACED, { layer: 'off' })).toEqual([]);
        expect(logOf(REFUSED)).toEqual([]);
        expect(logOf(OFF)).toEqual([]);
        expect(logOf(null)).toEqual([]);
        // …and the one that placed DOES draw, so the four rows above are not
        // passing because the function is inert.
        expect(logOf(PLACED).length).toBeGreaterThan(50);
    });

    it('⛓ the SITE is outlined once, at the rectangle the binding recorded', () => {
        const log = logOf(PLACED);
        const s = P().site;
        expect(log).toContain(`strokeRect(${s.x * TILE + 0.5},${s.y * TILE + 0.5},`
            + `${s.w * TILE - 1},${s.h * TILE - 1})`);
        expect(log).toContain(`strokeStyle=${JSON.stringify(ELEMENT_COLORS.site)}`);
    });

    it('⛓⛓ the TUNNEL is drawn CELL BY CELL, in its own hue, filled AND dashed '
        + '(§10.11.6: a 28-cell corridor must not read as the backend\'s carve)', () => {
        const log = logOf(PLACED);
        const n = P().tunnel.length;
        // ⛔ COUNTED FROM THE BINDING'S OWN LIST, not from the log's own shape.
        expect(countOf(log, `fillStyle=${JSON.stringify(ELEMENT_COLORS.tunnel)}`)).toBe(n);
        expect(countOf(log, 'setLineDash([2,2])')).toBe(n);
        for (const c of P().tunnel) {
            expect(log).toContain(`fillRect(${c.x * TILE},${c.y * TILE},${TILE},${TILE})`);
        }
    });

    it('⛓ the DOOR gets its own border and the FLAG a pennant, at the recorded cells', () => {
        const log = logOf(PLACED);
        const d = P().door;
        expect(log).toContain(`strokeRect(${d.x * TILE + 1},${d.y * TILE + 1},`
            + `${TILE - 2},${TILE - 2})`);
        expect(log).toContain(`strokeStyle=${JSON.stringify(ELEMENT_COLORS.door)}`);
        const f = P().flagCell;
        expect(log).toContain(`moveTo(${f.x * TILE + TILE * 0.3},${f.y * TILE + TILE * 0.8})`);
    });

    it('⛓ one PORT stub per declared port, coloured by ROLE and pointing OUTWARD', () => {
        const log = logOf(PLACED);
        expect(countOf(log, `strokeStyle=${JSON.stringify(ELEMENT_COLORS.portEntry)}`))
            .toBe(P().ports.filter((p) => p.role === 'entry').length);
        expect(countOf(log, `strokeStyle=${JSON.stringify(ELEMENT_COLORS.portExit)}`))
            .toBe(P().ports.filter((p) => p.role === 'exit').length);
        const exit = P().ports.find((p) => p.role === 'exit');
        const delta = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[exit.dir];
        expect(log).toContain(`lineTo(${exit.x * TILE + TILE / 2 + delta[0] * TILE * 0.55},`
            + `${exit.y * TILE + TILE / 2 + delta[1] * TILE * 0.55})`);
    });

    it('⛓ with `blocks: null` the BLOCK is drawn at the LEVEL\'s own initial cell', () => {
        const log = logOf(PLACED);
        const b = P().block;
        expect(log).toContain(`fillRect(${b.x * TILE + TILE * 0.15},${b.y * TILE + TILE * 0.15},`
            + `${TILE * 0.7},${TILE * 0.7})`);
    });

    it('⛓⛓⛓ …and with `blocks` SET it is drawn THERE instead — the replay\'s live '
        + '`state.blocks`, which is what makes the picture move', () => {
        const moved = { x: P().block.x + 1, y: P().block.y + 3 };
        const log = logOf(PLACED, { blocks: [keyOf(moved)] });
        expect(log).toContain(`fillRect(${moved.x * TILE + TILE * 0.15},`
            + `${moved.y * TILE + TILE * 0.15},${TILE * 0.7},${TILE * 0.7})`);
        // ⛔ AND THE INITIAL CELL IS NOT DRAWN — without this the row would pass
        // on a build that drew BOTH layouts, which is a picture with two blocks.
        const b = P().block;
        expect(log).not.toContain(`fillRect(${b.x * TILE + TILE * 0.15},`
            + `${b.y * TILE + TILE * 0.15},${TILE * 0.7},${TILE * 0.7})`);
    });

    it('⛓⛓ THE DIFFERENTIAL — two different live layouts give two different logs, '
        + 'so a build that IGNORED `view.blocks` cannot pass the row above by accident', () => {
        const a = logOf(PLACED, { blocks: [keyOf({ x: 4, y: 4 })] });
        const b = logOf(PLACED, { blocks: [keyOf({ x: 9, y: 9 })] });
        expect(hashOf(a)).not.toBe(hashOf(b));
        expect(hashOf(a)).not.toBe(hashOf(logOf(PLACED)));
    });

    it('⛓⛓ the BUTTON is FILLED exactly when something is standing on it — the HOLD, '
        + 'read off the live layout and not off the level', () => {
        const btn = P().button;
        const held = logOf(PLACED, { blocks: [keyOf(btn)] });
        expect(countOf(held, `fillStyle=${JSON.stringify(ELEMENT_COLORS.button)}`)).toBe(1);
        expect(held).toContain('fill()');
        const notHeld = logOf(PLACED, { blocks: [keyOf({ x: 0, y: 0 })] });
        expect(countOf(notHeld, `fillStyle=${JSON.stringify(ELEMENT_COLORS.button)}`)).toBe(0);
        /**
         * ⛓⛓ AND THE LEVEL AS GENERATED SHOWS THE BUTTON **UNHELD** — which is
         * the puzzle, and it corrects §3.2.1 as a reader would first read it.
         * The construction starts the block ON the button and PULLS IT
         * BACKWARDS; what the placement RECORDS is where the pull left it, so
         * the shipped level has the block away from its button and the door
         * shut. Measured, not assumed: this asserts the two cells DIFFER.
         */
        expect(keyOf(P().block)).not.toBe(keyOf(btn));
        expect(countOf(logOf(PLACED), `fillStyle=${JSON.stringify(ELEMENT_COLORS.button)}`)).toBe(0);
    });

    it('⛔ writes NO TEXT AT ALL — arc 1\'s rule: the canvas carries shape and colour, '
        + 'and every symbol is named once in the LEGEND', () => {
        expect(countOf(logOf(PLACED), 'fillText')).toBe(0);
        expect(countOf(logOf(PLACED), 'font=')).toBe(0);
    });

    it('⛓ THE DRIFT DETECTOR — the op log for the placed subject at `all`, '
        + 'blocks:null. ⛔ NOT a claim: a hash of my own new output can only ever '
        + 'say "the picture changed"', () => {
        const log = logOf(PLACED);
        expect(log.length).toBe(225);
        expect(hashOf(log)).toBe('2459ed2a28a7523c357d277e90e1e607');
    });

    it('⛓ the same gadget at a different tilePx moves only the NUMBERS — the op '
        + 'SEQUENCE is identical (the page may zoom without a second renderer)', () => {
        const strip = (log) => log.map((op) => op.replace(/[\d.]+/g, '#'));
        expect(strip(logOf(PLACED, { tilePx: 40 }))).toEqual(strip(logOf(PLACED)));
    });
});

describe('mazeElementOverlay — the view contract', () => {
    it('⛔ REFUSES a missing field BY NAME rather than defaulting it', () => {
        expect(() => assertElementView({ tilePx: 20, layer: 'all' }))
            .toThrow(ElementOverlayError);
        expect(() => assertElementView({ tilePx: 20, layer: 'all' })).toThrow(/missing "blocks"/);
        expect(() => assertElementView({ layer: 'all', blocks: null })).toThrow(/missing "tilePx"/);
        expect(() => assertElementView({ tilePx: 20, blocks: null })).toThrow(/missing "layer"/);
    });

    it('⛔ and REFUSES a `blocks` that is not the engine\'s posKey array', () => {
        expect(() => assertElementView({ tilePx: 20, layer: 'all', blocks: new Set(['1,1']) }))
            .toThrow(/must be an array of/);
        expect(assertElementView({ tilePx: 20, layer: 'all', blocks: [] }).blocks).toEqual([]);
        expect(assertElementView({ tilePx: 20, layer: 'all', blocks: null }).blocks).toBe(null);
    });

    it('⛔ a non-positive tilePx refuses — the caller sizes the canvas from it', () => {
        expect(() => assertElementView({ tilePx: 0, layer: 'all', blocks: null }))
            .toThrow(/positive number/);
    });
});

describe('mazeElementOverlay — the legend', () => {
    it('⛓ one row per PLACED gadget, carrying the three per-instance ids and the '
        + 'symbol it guards', () => {
        const rows = elementLegend(PLACED);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            kind: 'placed',
            element: 'reverse-pull-block',
            index: 0,
            button: 'button_A0',
            door: 'door_A0',
            hold: 'sw_A0',
            guards: 'K0',
        });
        expect(rows[0].tunnelCells).toBe(P().tunnel.length);
        expect(rows[0].siteCells).toBe(P().site.w * P().site.h);
    });

    it('⛓⛓ a REFUSED element gets a row of its own carrying the binding\'s reason '
        + 'VERBATIM — §10.11.5: most seeds refuse, and that is what the page has to say', () => {
        const rows = elementLegend(REFUSED);
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('refused');
        expect(rows[0].reason).toBe(REFUSED.refused.reason);
        expect(rows[0].detail).toBe(REFUSED.refused.detail);
    });

    it('⛔ and NOTHING at all when no element was asked for — a legend that spoke at '
        + '`none` would describe a machinery that did not run', () => {
        expect(elementLegend(OFF)).toEqual([]);
        expect(elementLegend(null)).toEqual([]);
    });
});
