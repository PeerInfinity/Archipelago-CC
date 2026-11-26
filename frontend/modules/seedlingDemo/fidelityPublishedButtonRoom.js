/**
 * seedlingDemo/fidelityPublishedButtonRoom — **ONE DERIVATION OF THE PUBLISHED-BUTTONROOM WITNESS** (slice
 * seedling-fidelity-buttonroomclear, wave 63), shared by the game witness (`CC/docs/cloud-reports/
 * seedling-fidelity-buttonroomclear-evidence/tools/br-witness.mjs`) and the node rows
 * (`fidelityPublishedButtonRoom.test.js`), so the rooms and tapes the page plays are the ones the rows replay.
 *
 *   · the ROOMS: wave 62's method (`fidelityPresserHang.hangRecord`) — the vanilla L38 plus the shape's entities, all in
 *     group 6 (unused in L38). `ON` is the tile on the player's walk (`(144,224)`), `OFF_A`/`OFF_B` floor tiles the walk
 *     never touches; `BELOW` is the walk's next tile (`(144,240)`), where a responder BLOCKS the walk until it opens.
 *   · the TAPES: boot `(144,192)` in L38 and walk DOWN through `ON` to the south door (`teleporter@144,304` → L37,
 *     arriving `(288,16)`). `revisit` then walks UP through `teleporter@288,0` back into L38 (arriving `(144,288)`), so
 *     the published-to ButtonRoom's `check()` runs on a NEW Game (the next-visit boot). `pull` stops on a rope and
 *     swings the sword at it. `long` holds DOWN long enough for a Lock's 100-update fade.
 *   · the REPLAY: `fidelityPresserHang.hangReplay` (the model's row before each tape tick, the run's terminal).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { L25_TAPE } from './fidelityL25ApItem.js';
import { parseTape } from './tapeFormat.js';
import { HANG_GROUP, hangRecord, hangReplay } from './fidelityPresserHang.js';

export { HANG_GROUP, hangRecord, hangReplay };

const at = Object.freeze({
    ON: { x: 144, y: 224 }, OFF_A: { x: 176, y: 240 }, OFF_B: { x: 112, y: 240 }, BELOW: { x: 144, y: 240 },
});
const T = String(HANG_GROUP);
const button = (p) => ({ type: 'button', ...p, attrs: { tset: T } });
const br = (p, flip, tag, room = -1) => ({ type: 'buttonroom', ...p, attrs: { tset: T, tag: String(tag), flip: String(flip), room: String(room) } });
const rope = (p, tag) => ({ type: 'rope', ...p, attrs: { tset: T, tag: String(tag) }, nodes: [{ x: p.x + 16, y: p.y }] });
const lock = (p, tag) => ({ type: 'lock', ...p, attrs: { tset: T, tag: String(tag) } });
const cover = (p) => ({ type: 'cover', ...p, attrs: { tset: T } });
const fallrock = (p, tag) => ({ type: 'fallrock', ...p, attrs: { tset: T, tag: String(tag) } });

/** The cross-room target: L37 (the walk's own destination), tag = the group (`ButtonRoom.as:93` keys on the TSET). */
export const BR_TARGET = Object.freeze({ level: 37, tag: HANG_GROUP });

/** Tape inputs by kind. Ticks are live ticks (dead frames are not tape ticks). */
const INPUTS = {
    walk: { ticks: 90, inputs: [{ key: 'down', from: 0, to: 90 }] },
    // DOWN to L37 (t88), then UP into `teleporter@288,0` → L38 (144,288), then stand.
    revisit: { ticks: 140, inputs: [{ key: 'down', from: 0, to: 90 }, { key: 'up', from: 90, to: 100 }] },
    // DOWN onto the rope (it is a Solid until pulled), the sword at it, then DOWN on to the door.
    pull: { ticks: 200, inputs: [{ key: 'down', from: 0, to: 60 }, { key: 'primary', from: 62, to: 63 }, { key: 'down', from: 90, to: 200 }] },
    long: { ticks: 260, inputs: [{ key: 'down', from: 0, to: 260 }] },
};

/**
 * The staged shapes. `entities` join L38; `clears` are L38 tags and `otherClears` `{level, tag}` the tape clears before
 * boot. `source` is what the AS3 predicts (D1); the witness measures it.
 */
export const BR_SHAPES = Object.freeze([
    // ── a Button publishes TRUE into a ButtonRoom that is not under the player ──
    { name: 'btn-br1', tape: 'walk', entities: [button(at.ON), br(at.OFF_A, 1, 10)], clears: [], source: 'the flip-1 setter runs: clears 38,10; publishes false back' },
    { name: 'btn-brx1', tape: 'walk', entities: [button(at.ON), br(at.OFF_A, 1, 10, 37)], clears: [], source: 'the cross-room setter runs: 37,6 ← false, 38,10 cleared' },
    // Two cross-room ones on one target slot: the getClass order (the REVERSE of the XML order within the
    // `buttonroom` loop, `Game.as:2342` + `World.addUpdate` prepending) decides which write lands last. `brx0` writes
    // TRUE (37,6 back on), `brx1` FALSE; the readout lists only the false slots, so the order is SEEN.
    { name: 'btn-brx0-then-brx1', tape: 'walk', entities: [button(at.ON), br(at.OFF_A, 0, 10, 37), br(at.OFF_B, 1, 11, 37)], clears: [], source: 'getClass: brx1 (XML last) runs first, brx0 last: 37,6 ends TRUE; 38,10 and 38,11 cleared' },
    { name: 'btn-brx1-then-brx0', tape: 'walk', entities: [button(at.ON), br(at.OFF_A, 1, 10, 37), br(at.OFF_B, 0, 11, 37)], clears: [], source: 'getClass: brx0 runs first, brx1 last: 37,6 ends FALSE; 38,10 and 38,11 cleared' },
    // ── a flip-0 ButtonRoom (pressed) publishes into another ──
    { name: 'br0-br1', tape: 'walk', entities: [br(at.ON, 0, 11), br(at.OFF_A, 1, 10)], clears: [], source: 'the flip-1 one is published to: 38,10 cleared (and the pressed 38,11)' },
    { name: 'br0-brx1', tape: 'walk', entities: [br(at.ON, 0, 11), br(at.OFF_A, 1, 10, 37)], clears: [], source: 'the cross-room one is published to: 37,6 ← false, 38,10 cleared' },
    // ── a rope publishes ──
    { name: 'pull-br1', tape: 'pull', entities: [rope({ x: 128, y: 240 }, 12), br(at.OFF_A, 1, 10)], clears: [], source: 'the pull publishes true: 38,10 cleared; the flip-1 answer sets the rope false' },
    { name: 'ropeboot-br1', tape: 'walk', entities: [rope(at.OFF_B, 12), br(at.OFF_A, 1, 10)], clears: [12], source: 'check() → hit() → true at build: 38,10 cleared at build' },
    // ── the next-visit boot (leave, come back) ──
    { name: 'btn-br1-revisit', tape: 'revisit', entities: [button(at.ON), br(at.OFF_A, 1, 10)], clears: [], source: '38,10 cleared on the walk; on re-entry check() boots the ButtonRoom pressed (re-runs its setter)' },
    { name: 'btn-brx1-revisit', tape: 'revisit', entities: [button(at.ON), br(at.OFF_A, 1, 10, 37)], clears: [], source: 'as btn-brx1; re-entry boots it pressed and re-writes 37,6 false' },
    { name: 'br0-br1-revisit', tape: 'revisit', entities: [br(at.ON, 0, 11), br(at.OFF_A, 1, 10)], clears: [], source: 'as br0-br1; re-entry boots both pressed' },
    // ── the responders in the group (every responder class is added AFTER every ButtonRoom, so it is BEFORE it in
    //    getClass order: it takes the true, then the flip-1 answer's false) ──
    { name: 'btn-lock', tape: 'long', entities: [button(at.ON), lock(at.BELOW, 13)], clears: [], source: 'control: the Lock fades open (~101 updates) and the walk goes on' },
    { name: 'btn-br1-lock', tape: 'long', entities: [button(at.ON), br(at.OFF_A, 1, 10), lock(at.BELOW, 13)], clears: [], source: 'the Lock ends every frame false: it never opens, the walk stays blocked' },
    { name: 'btn-cover', tape: 'long', entities: [button(at.ON), cover(at.BELOW)], clears: [], source: 'control: the Cover opens (11 updates)' },
    { name: 'btn-br1-cover', tape: 'long', entities: [button(at.ON), br(at.OFF_A, 1, 10), cover(at.BELOW)], clears: [], source: 'the Cover never opens' },
    { name: 'btn-br1-rock', tape: 'long', entities: [button(at.ON), br(at.OFF_A, 1, 10), fallrock({ x: 176, y: 272 }, 14)], clears: [], source: 'a FallRock falls on the true (its setter acts on it), the false does not undo it' },
    { name: 'br0-br1-lock', tape: 'long', entities: [br(at.ON, 0, 11), br(at.OFF_A, 1, 10), lock(at.BELOW, 13)], clears: [], source: 'the flip-0 latch is answered false: the Lock never opens' },
]);

export const brShape = (name) => {
    const s = BR_SHAPES.find((x) => x.name === name);
    if (!s) throw new Error(`fidelityPublishedButtonRoom: no shape ${name}`);
    return s;
};

/** The shape's tape, on the L25 survey tape's header (pins, save, rng), as wave 62's `hangTape`. */
export function brTape(root, shape) {
    const base = JSON.parse(readFileSync(join(root, L25_TAPE), 'utf8'));
    const { ticks, inputs } = INPUTS[shape.tape];
    return parseTape({
        ...base, name: `publishedbr-${shape.name}`, boot: { level: 38, x: 144, y: 192 },
        persistence: [...base.persistence,
            ...shape.clears.map((tag) => ({ level: 38, tag, note: 'publishedbr staging' })),
            ...(shape.otherClears ?? []).map((c) => ({ level: c.level, tag: c.tag, note: 'publishedbr staging' }))],
        inputs, tick_count: ticks,
    });
}
