/**
 * PULL PASSES — THE HYBRID (slice tile-pixel-pull-disc, ⚖ Robert 2026-11-21 "Hybrid + direction check"): an ALWAYS cell
 * reels on entry; a move into a PARTIAL cell passes ARMED only across a crossing the pull's `passes` names (the game has an
 * unpulled path that way), and otherwise reels; a WAIT while armed in the trap's disc reels (`LavaTrap.as:81-97` re-tests
 * every frame); a fresh state, a landing or a reel is never armed (`wait` starts TRUE and a reel sets it, `:26`, `:68`);
 * an armed trap stays armed on its `range` and disarms past it (`:99-102`). The scripted step agrees with the native one.
 */
import { describe, it, expect } from 'vitest';
import {
    createWorld, setTile, TILE_WALL, createState, step, whyBlocked, mazeVisitedKey, worldInputs, checkPulls,
    INPUT_E, INPUT_W, INPUT_WAIT, hasPullPasses, serializeMazeEntities,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SUIT = 'Dark Suit';
const GATE = Object.freeze({ id: 'pull_4_2', kind: 'pull', clear_set_type: 'rule', clear_rule: { rule: 'Has', args: { item_name: SUIT } } });
const DISC = [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }];
/** A 1-wide corridor (y = 1, x 1..7) passing a trap in an alcove below it at (4,2). */
function corridor({ passes = undefined, range = undefined, start = { x: 1, y: 1 } } = {}) {
    const rows = ['#########', '#.......#', '####.####', '#########'];
    const w = createWorld(9, 4, { entrance: start, exits: [] });
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 9; x++) if (rows[y][x] === '#') setTile(w, x, y, TILE_WALL);
    w.obstacleLib = { ...w.obstacleLib, pull_4_2: GATE };
    w.pulls = checkPulls([{ x: 4, y: 2, from: DISC, gate: 'pull_4_2', ...(passes ? { passes } : {}), ...(range ? { range } : {}) }], w, 'test');
    return w;
}
const PASS_IN = [{ from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }];
const walk = (world, state, inputs) => inputs.reduce((s, i) => {
    const n = step(world, s, i);
    if (n === null) throw new Error(`refused ${i} at ${JSON.stringify(s.player_pos)}: ${whyBlocked(world, s, i)}`);
    return n;
}, state);
const suited = (world) => ({ ...createState(world), inventory: new Set([SUIT]) });

describe('the hybrid: pass armed across a named crossing, reel otherwise, WAIT reels while armed', () => {
    it('a 1-wide corridor through an ALWAYS cell (no passes) reels on entry', () => {
        const w = corridor();
        expect(hasPullPasses(w)).toBe(false);
        expect(walk(w, suited(w), [INPUT_E, INPUT_E]).player_pos).toEqual({ x: 4, y: 2 });
    });

    it('through a PARTIAL cell with no crossing THAT way: reels (the pass names only the other direction)', () => {
        const w = corridor({ passes: [{ from: { x: 4, y: 1 }, to: { x: 3, y: 1 } }] });
        expect(walk(w, suited(w), [INPUT_E, INPUT_E]).player_pos).toEqual({ x: 4, y: 2 });
    });

    it('across a named crossing: stands in the cell ARMED; a WAIT there reels and disarms', () => {
        const w = corridor({ passes: PASS_IN });
        const s = walk(w, suited(w), [INPUT_E, INPUT_E]);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(s.pullArmed).toEqual(['4,2']);
        const reeled = walk(w, s, [INPUT_WAIT]);
        expect(reeled.player_pos).toEqual({ x: 4, y: 2 });
        expect(reeled.pullArmed).toEqual([]);
        // landed on the trap: a WAIT is no reel (the reel set `wait`)
        expect(walk(w, reeled, [INPUT_WAIT]).player_pos).toEqual({ x: 4, y: 2 });
    });

    it('armed, the next step into the disc is reeled (no crossing named for it)', () => {
        const w = corridor({ passes: PASS_IN });
        expect(walk(w, suited(w), [INPUT_E, INPUT_E, INPUT_E]).player_pos).toEqual({ x: 4, y: 2 });
    });

    it('a WAIT after an ARRIVAL inside the disc is no reel (the game\'s `wait` starts TRUE)', () => {
        const w = corridor({ passes: PASS_IN, start: { x: 3, y: 1 } });
        const s = walk(w, suited(w), [INPUT_WAIT, INPUT_WAIT]);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(s.pullArmed).toEqual([]);
    });

    it('without the gate: the crossing arms nothing and a WAIT reels nothing', () => {
        const w = corridor({ passes: PASS_IN });
        const s = walk(w, createState(w), [INPUT_E, INPUT_E, INPUT_WAIT]);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(s.pullArmed).toEqual([]);
    });

    it('DISARM on the range: armed stays armed on a range cell outside the disc, and leaves past the range', () => {
        const w = corridor({ passes: PASS_IN, range: [...DISC, { x: 2, y: 1 }] });
        const back = walk(w, suited(w), [INPUT_E, INPUT_E, INPUT_W]);
        expect(back.player_pos).toEqual({ x: 2, y: 1 });
        expect(back.pullArmed).toEqual(['4,2']);
        expect(walk(w, back, [INPUT_W]).pullArmed).toEqual([]);
        // with no range the disc is the range: stepping out of it disarms at once
        const w0 = corridor({ passes: PASS_IN });
        expect(walk(w0, suited(w0), [INPUT_E, INPUT_E, INPUT_W]).pullArmed).toEqual([]);
    });

    it('WAIT is a searched input only on a world with pull passes', () => {
        expect(worldInputs(corridor())).not.toContain(INPUT_WAIT);
        expect(worldInputs(corridor({ passes: PASS_IN }))).toContain(INPUT_WAIT);
    });

    it('a range that misses a disc cell is refused by name', () => {
        expect(() => corridor({ passes: PASS_IN, range: [{ x: 3, y: 1 }] })).toThrow(/its range does not hold/);
    });

    it('passes and range round-trip through the payload', () => {
        const w = corridor({ passes: PASS_IN, range: [...DISC, { x: 2, y: 1 }] });
        const out = serializeMazeEntities(w).pulls[0];
        expect(out.passes).toEqual(PASS_IN);
        expect(out.range).toEqual([{ x: 2, y: 1 }, ...DISC]);
    });

    for (const [name, opts] of Object.entries({ 'no passes': {}, 'a pass': { passes: PASS_IN }, 'a pass and a range': { passes: PASS_IN, range: [...DISC, { x: 2, y: 1 }] } })) {
        it(`scripted ≡ native over every reachable state (${name})`, () => {
            const world = corridor(opts);
            const start = suited(world);
            const seen = new Map([[mazeVisitedKey(start), start]]);
            const queue = [start];
            while (queue.length) {
                const s = queue.shift();
                for (const input of [...worldInputs(world), INPUT_WAIT]) {
                    const native = step(world, s, input);
                    const { next } = scriptedStep(world, s, input, HELPERS);
                    expect(next === null ? null : mazeVisitedKey(next), `${input}@${mazeVisitedKey(s)}`)
                        .toBe(native === null ? null : mazeVisitedKey(native));
                    if (native && !seen.has(mazeVisitedKey(native))) { seen.set(mazeVisitedKey(native), native); queue.push(native); }
                }
            }
            expect(seen.size).toBeGreaterThan(3);
        });
    }
});
