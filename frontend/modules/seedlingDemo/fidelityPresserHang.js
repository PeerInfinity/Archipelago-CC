/**
 * seedlingDemo/fidelityPresserHang — **ONE DERIVATION OF THE PRESSER-RECURSION WITNESS** (slice
 * seedling-fidelity-presserloop, wave 62), shared by the game witness (`CC/docs/cloud-reports/
 * seedling-fidelity-presserloop-evidence/tools/hang-witness.mjs`) and the node rows (`fidelityPresserHang.test.js`), so
 * the rooms and tapes the page plays are the ones the rows replay.
 *
 *   · the ROOMS: the vanilla L38 plus the shape's pressers, all in group 6 (unused in L38). `ON` is the presser on the
 *     player's walk (`(144,224)`, the one-tile column south of the boot); `OFF_A`/`OFF_B` are floor tiles on the row
 *     at y 240, which the walk never touches. Level DATA, loaded through `botLoadLevels`; no game edit.
 *   · the TAPE: boot `(144,192)` in L38 and walk DOWN through `ON` to the south door (`teleporter@144,304` → L37),
 *     across `buttonroom@144,288` (t 4, tag 5, flip 1, room 37: its press clears its own tag 5 and writes L37 tag 4).
 *     So one tape asks every question the brief does: when the first throw lands, whether the player still moves,
 *     whether a press still writes persistence, and whether a door still works.
 *   · the REPLAY: the model's row before each tape tick (`{level, x, y}`, the game's drained shape), the run's terminal.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { L25_TAPE } from './fidelityL25ApItem.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

/** The group every staged presser shares (L38 uses 0, 1, 2, 4 and 8). */
export const HANG_GROUP = 6;

const at = Object.freeze({ ON: { x: 144, y: 224 }, OFF_A: { x: 176, y: 240 }, OFF_B: { x: 112, y: 240 } });
const T = String(HANG_GROUP);
const button = (p) => ({ type: 'button', ...p, attrs: { tset: T } });
const br = (p, flip, tag, room = -1) => ({ type: 'buttonroom', ...p, attrs: { tset: T, tag: String(tag), flip: String(flip), room: String(room) } });
// A rope's pulley is its own tile; its handle (`node`) is one tile east, so its box covers both (`RopeStart.as:26`).
const rope = (p, tag) => ({ type: 'rope', ...p, attrs: { tset: T, tag: String(tag) }, nodes: [{ x: p.x + 16, y: p.y }] });

/**
 * The staged shapes. `entities` join L38; `clears` are L38 tags the tape clears before boot (a cleared rope tag is a
 * pulled rope, `RopeStart.check`; a cleared ButtonRoom tag boots it pressed, `ButtonRoom.check`). `source` is what the
 * AS3 setters predict (D1), and the witness measures it.
 */
export const HANG_SHAPES = Object.freeze([
    { name: 'btn-btn', entities: [button(at.ON), button(at.OFF_A)], clears: [], source: 'hang: the first live frame (Button.update publishes every frame)' },
    { name: 'btn-rope', entities: [button(at.ON), rope(at.OFF_A, 10)], clears: [], source: 'hang: the first live frame' },
    { name: 'rope-rope', entities: [rope(at.OFF_A, 10), rope({ x: 112, y: 240 }, 11)], clears: [], source: 'none on this walk: no rope is hit' },
    { name: 'rope-rope-pulled', entities: [rope(at.OFF_A, 10), rope({ x: 112, y: 240 }, 11)], clears: [10], source: 'hang: the build (check() → hit())' },
    { name: 'br0-btn', entities: [br(at.ON, 0, 10), button(at.OFF_A)], clears: [], source: 'hang: the frame the ButtonRoom is pressed' },
    { name: 'btn-br0', entities: [button(at.ON), br(at.OFF_A, 0, 10)], clears: [], source: 'hang: the frame the Button is pressed' },
    { name: 'br0-br0', entities: [br(at.ON, 0, 10), br(at.OFF_A, 0, 11)], clears: [], source: 'hang: the frame the first is pressed' },
    { name: 'br0-rope', entities: [br(at.ON, 0, 10), rope(at.OFF_A, 11)], clears: [], source: 'hang: the frame the ButtonRoom is pressed' },
    { name: 'br1-rope-rope', entities: [br(at.ON, 1, 10), rope(at.OFF_A, 11), rope(at.OFF_B, 12)], clears: [], source: 'hang: the press (a false runs the rope pair)' },
    { name: 'btn-br0-boot', entities: [button(at.ON), br(at.OFF_A, 0, 10)], clears: [10], source: 'hang: the build (check() publishes true)' },
    // ── the near misses ──
    { name: 'br1-btn', entities: [br(at.ON, 1, 10), button(at.OFF_A)], clears: [], source: 'none: the ButtonRoom publishes false, which it does not take' },
    { name: 'btn-br1', entities: [button(at.ON), br(at.OFF_A, 1, 10)], clears: [], source: 'none (the Button is set false inside its own setter)' },
    { name: 'br0-br1', entities: [br(at.ON, 0, 10), br(at.OFF_A, 1, 11)], clears: [], source: 'none: the flip 1 answers false' },
    { name: 'br1-br0', entities: [br(at.ON, 1, 10), br(at.OFF_A, 0, 11)], clears: [], source: 'none: a false into a ButtonRoom stops' },
    { name: 'brx-btn', entities: [br(at.ON, 0, 10, 37), button(at.OFF_A)], clears: [], source: 'none: a cross-room ButtonRoom publishes nothing here' },
    { name: 'btn-solo', entities: [button(at.ON)], clears: [], source: 'none: one presser' },
]);

export const hangShape = (name) => {
    const s = HANG_SHAPES.find((x) => x.name === name);
    if (!s) throw new Error(`fidelityPresserHang: no shape ${name}`);
    return s;
};

/** L38 with the shape's pressers added (every other room unchanged). */
export function hangRecord(rec, shape) {
    if (rec?.level !== 38) return rec;
    return { ...rec, entities: [...rec.entities, ...shape.entities.map((e) => ({ ...e, attrs: { ...e.attrs } }))] };
}

/** The walk: boot (144,192), DOWN from tick 0 to the south door, on the L25 survey tape's header (pins, save, rng). */
export const HANG_TICKS = 90;
export function hangTape(root, shape, { ticks = HANG_TICKS } = {}) {
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    return parseTape({
        ...base, name: `presserhang-${shape.name}`, boot: { level: 38, x: 144, y: 192 },
        persistence: [...base.persistence, ...shape.clears.map((tag) => ({ level: 38, tag, note: 'presserhang staging' }))],
        inputs: [{ key: 'down', from: 0, to: ticks }], tick_count: ticks,
    });
}

/**
 * The model's replay: `rows[i]` = the row before tape tick `i` (up to `tick_count + 1` rows), and `error` (the message
 * and name of whatever stopped the run, or null). A refusal at the build leaves `rows` empty.
 */
export function hangReplay(tape, levelSource, { capabilities = null } = {}) {
    let run;
    const rows = [];
    try {
        run = createRunForStaging(stagingFromTape(tape), levelSource, { scratchPersistence: true, capabilities });
        rows.push({ level: run.level, x: run.state.x, y: run.state.y });
        for (let t = 0; t < tape.tick_count; t++) {
            run.advance(heldKeysAt(tape, t));
            rows.push({ level: run.level, x: run.state.x, y: run.state.y });
        }
    } catch (e) {
        return { run, rows, error: { name: e?.name ?? 'Error', message: String(e?.message ?? e) } };
    }
    return { run, rows, error: null };
}
