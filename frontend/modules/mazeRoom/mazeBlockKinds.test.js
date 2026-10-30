/**
 * ⛓⛓ BLOCK KINDS + WAKE, the Fire push AWAY, PULSERS (session tile-mechanisms-m1, ⚖ user 2026-10-30 "Four primitives,
 * 2 slices"; the design is session tile-primitives-mechanisms-w0's). The engine primitives Seedling's L40 corpse chain
 * is made of, proven on GADGET ROOMS read from pictures (and on seeded random rooms) — no level of any game:
 *   - a `block_lib` kind per block: walked (`PushableBlock`), struck (`PushableBlockSpear` / `PushableBlockFire`),
 *     pulsed, or woken into another kind by a strike, per visit (`IceTurret.as:136-148`: a weapon kills it into a
 *     corpse that Fire and pulses move, `:172-200`);
 *   - an action's `push: 'away'`: one cell away from the player along the axis between them (the AS3 `atan2` rule,
 *     `PushableBlockFire.hit`); a diagonal block is NOT moved (the game moves it on both axes; fenced, named);
 *   - pulsers: a held token pushes every pulsed block on its reach away from it, and the reach is an ARMED LANE
 *     (`Pulser.as:87-114`: the pulse hits the player too).
 * Scripted parity: every new condition goes through a tile helper (`block_struck`, `woken`, `pulse_shoves`,
 * `pulse_armed`; geometry native), and red-first mutant pins show a broken helper makes scripted ≠ native.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, deserializeMazeWorld, serializeMazeEntities,
    checkBlockLib, checkPulsers, awayDelta, strikePushes, strikeWakes, effectiveInventory, pulseShoves, getExitAt,
    extractPathsAndObstacles, useInput, turnInput, INPUT_WAIT, blockWithinReach,
} from './mazeRoomEngine.js';
import { createRng } from '../shared/rng.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SWORD = 'Progressive Sword';
const FIRE = 'Fire';
const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const ACTIONS = {
    sword: { item: SWORD, primitive: 'strike', condition: 'strikes', key: 'z' },
    // Seedling's Fire: an area round the player (all eight neighbours, the weapon-footprints slice), pushing AWAY.
    fire: {
        item: FIRE, primitive: 'strike', condition: 'strikes', key: 'c', push: 'away',
        footprint: Object.fromEntries(['N', 'E', 'S', 'W'].map((f) => [f, NEIGHBOURS])),
    },
};
const KINDS = {
    plain: { walk: true },
    fire: { walk: false, struck_by: ['fire'], pulsed: true },
    turret: { walk: false, wake: { struck_by: ['sword'], becomes: 'corpse' } },
    corpse: { walk: false, struck_by: ['fire'], pulsed: true },
};

/**
 *   #  wall   P entrance   X exit   B plain block   F fire block   T turret   C corpse
 *   o  button holding sw_0   D door (sw_0)   q  button holding sw_1   Q  pulser (a wall cell) on sw_1, reach = its 8 neighbours
 *   R  pulser on sw_0
 */
function sidecar(rows, { pulsers = true, kinds = KINDS } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const at = (ch) => {
        const out = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rows[y][x] === ch) out.push({ x, y });
        return out;
    };
    const KIND_OF = { B: 'plain', F: 'fire', T: 'turret', C: 'corpse' };
    const inGrid = ({ x, y }) => x >= 0 && y >= 0 && x < width && y < height;
    const buttons = [...at('o').map((c) => ({ ...c, id: 'button_0' })), ...at('q').map((c) => ({ ...c, id: 'button_1' }))];
    return {
        width,
        height,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' || c === 'Q' || c === 'R' ? 1 : 0))),
        entrance: at('P')[0],
        exits: at('X').map((c) => ({ exit_id: 'exit', ...c })),
        obstacles: at('D').map((c) => ({ ...c, id: 'door' })),
        items: [],
        obstacleLib: { door: { id: 'door', name: 'door', clear_set: [['sw_0']] } },
        blocks: Object.keys(KIND_OF).flatMap((ch) => at(ch).map((c) => ({ ...c, kind: KIND_OF[ch] }))),
        block_lib: kinds,
        ...(buttons.length > 0 ? {
            buttons,
            buttonLib: { button_0: { kind: 'button', holds: 'sw_0' }, button_1: { kind: 'button', holds: 'sw_1' } },
        } : {}),
        action_lib: ACTIONS,
        ...(pulsers && at('Q').length + at('R').length > 0 ? {
            pulsers: [...at('Q').map((c) => ({ ...c, token: 'sw_1' })), ...at('R').map((c) => ({ ...c, token: 'sw_0' }))].map((p) => ({
                ...p, reach: NEIGHBOURS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(inGrid),
            })),
        } : {}),
    };
}

const world = (rows, opts) => deserializeMazeWorld(sidecar(rows, opts));
const holding = (w, items, pos = null, facing = null) => {
    const s = createState(w);
    s.inventory = new Set(items);
    if (pos) s.player_pos = { ...pos };
    if (facing) s.facing = facing;
    return s;
};
const walk = (w, s, inputs) => inputs.reduce((acc, input) => {
    const n = step(w, acc, input);
    if (n === null) throw new Error(`refused ${input} at ${mazeVisitedKey(acc)}: ${whyBlocked(w, acc, input)}`);
    return n;
}, s);

/** Every state `step` reaches from the entrance holding `items`, keyed (capped). */
function reachable(w, items, cap = 60000) {
    const start = holding(w, items);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        for (const input of worldInputs(w)) {
            const n = step(w, queue[head], input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.set(mazeVisitedKey(n), n);
            queue.push(n);
        }
        if (seen.size > cap) throw new Error('exploration truncated');
    }
    return [...seen.values()];
}
const reachesExit = (w, items) => reachable(w, items).some((s) => getExitAt(w, s.player_pos.x, s.player_pos.y));

/**
 * Every disagreement between native and scripted over the reachable states of `w` holding `items` (all inputs + WAIT),
 * with counts of what the new branches did, so no pin is vacuous.
 */
const MEMO = new Map();
function disagreements(w, items, helpers = HELPERS) {
    const memoKey = helpers === HELPERS ? `${JSON.stringify(serializeMazeEntities(w))}|${w.tiles.join('')}|${items}` : null;
    if (memoKey !== null && MEMO.has(memoKey)) return MEMO.get(memoKey);
    const result = disagreementsUncached(w, items, helpers);
    if (memoKey !== null) MEMO.set(memoKey, result);
    return result;
}

function disagreementsUncached(w, items, helpers) {
    const out = [];
    const seen = { moved: 0, woken: 0, pulsed: 0, pulseRefusals: 0 };
    for (const s of reachable(w, items)) {
        for (const input of [...worldInputs(w), INPUT_WAIT]) {
            const native = step(w, s, input);
            const why = whyBlocked(w, s, input);
            const { next } = scriptedStep(w, s, input, helpers);
            const at = `${input}@${mazeVisitedKey(s)}`;
            if ((why === null) !== (native !== null)) out.push(`${at} whyBlocked=${why} step=${native !== null}`);
            const a = native === null ? null : mazeVisitedKey(native);
            const b = next === null ? null : mazeVisitedKey(next);
            if (a !== b) out.push(`${at} native=${a} scripted=${b}`);
            // After any step the world is settled: a WAIT changes nothing (the searches never branch on one).
            if (input === INPUT_WAIT && s.turn > 0 && a !== null && a !== mazeVisitedKey(s)) out.push(`${at} a wait moved the world: ${a}`);
            if (native === null) { if (why?.startsWith('pulse of')) seen.pulseRefusals += 1; continue; }
            if (native.blocks.join(';') !== s.blocks.join(';')) {
                if (input.startsWith('USE:')) seen.moved += 1;
                else if (!['N', 'E', 'S', 'W'].includes(input) || !s.blocks.includes(`${native.player_pos.x},${native.player_pos.y}`)) seen.pulsed += 1;
            }
            if (Object.values(native.blockKinds).join() !== s.blocks.map((k) => s.blockKinds[k]).join()
                && native.blocks.join(';') === s.blocks.join(';')) seen.woken += 1;
        }
    }
    return { out, ...seen };
}

describe('block_lib — checked, round-tripped', () => {
    it('refuses by name: unknown key, walk not boolean, walked AND struck, a missing action, a bad wake', () => {
        const chk = (lib) => () => checkBlockLib(lib, ACTIONS, 't');
        expect(chk({ a: { walk: true, slides: true } })).toThrow(/\.a names slides; a kind holds only/);
        expect(chk({ a: { struck_by: ['fire'] } })).toThrow(/\.a\.walk must be true or false/);
        expect(chk({ a: { walk: true, struck_by: ['fire'] } })).toThrow(/both walked and struck — the game has no such block/);
        expect(chk({ a: { walk: false, struck_by: ['spear'] } })).toThrow(/names spear, which the action_lib does not hold/);
        expect(chk({ a: { walk: false, wake: { struck_by: ['sword'], becomes: 'b' } } })).toThrow(/wake\.becomes names "b", not another kind/);
        expect(chk({ a: { walk: false, wake: { struck_by: ['sword'], becomes: 'a' } } })).toThrow(/wake\.becomes names "a", not another kind/);
        expect(chk({ a: { walk: false, struck_by: ['sword'], wake: { struck_by: ['sword'], becomes: 'b' } }, b: { walk: true } }))
            .toThrow(/sword both moves and wakes it/);
        expect(chk({})).toThrow(/non-empty object of kinds/);
    });

    it('a block names a kind of the lib, and only on a block_lib world; an action push is facing or away', () => {
        const ROOM = ['#####', '#PF.#', '#####'];
        const sc = sidecar(ROOM);
        expect(() => deserializeMazeWorld({ ...sc, blocks: [{ x: 2, y: 1, kind: 'ice' }] })).toThrow(/kind "ice", which the block_lib does not hold/);
        expect(() => deserializeMazeWorld({ ...sc, blocks: [{ x: 2, y: 1 }] })).toThrow(/kind undefined, which the block_lib does not hold/);
        const { block_lib: _, ...bare } = sc;
        expect(() => deserializeMazeWorld(bare)).toThrow(/names kind "fire", but the world has no block_lib/);
        expect(() => deserializeMazeWorld({ ...sc, action_lib: { ...ACTIONS, fire: { ...ACTIONS.fire, push: 'pull' } } }))
            .toThrow(/action_lib\.fire\.push is "pull"; one of facing, away/);
    });

    it('serializes back as it was loaded (blocks with their kinds, the lib, the pulsers)', () => {
        const sc = sidecar(['#######', '#PFTC.#', '#.B.Q.#', '#..q..#', '#######']);
        const out = serializeMazeEntities(deserializeMazeWorld(sc));
        expect(out.block_lib).toEqual(KINDS);
        expect(out.blocks).toEqual(sc.blocks.slice().sort((a, b) => a.y - b.y || a.x - b.x));
        expect(out.pulsers).toEqual(sc.pulsers);
        const again = deserializeMazeWorld({ ...sc, ...out });
        expect(serializeMazeEntities(again)).toEqual(out);
    });

    it("a state carries where each kind stands, and the visited key reads it (two kinds swapped are two states)", () => {
        const w = world(['######', '#PBF.#', '######']);
        const s = createState(w);
        expect(s.blockKinds).toEqual({ '2,1': 'plain', '3,1': 'fire' });
        expect(mazeVisitedKey(s)).toBe('1,1||2,1;3,1|kplain;fire|fS|');
        const swapped = { ...s, blockKinds: { '2,1': 'fire', '3,1': 'plain' } };
        expect(mazeVisitedKey(swapped)).not.toBe(mazeVisitedKey(s));
    });
});

describe('the Fire push AWAY (the AS3 atan2 rule on cell centres)', () => {
    it('awayDelta: away along the axis between them; a diagonal (and near-diagonal inside bothRange) moves nothing', () => {
        const from = { x: 5, y: 5 };
        expect(awayDelta(from, { x: 6, y: 5 })).toEqual({ dx: 1, dy: 0 });
        expect(awayDelta(from, { x: 4, y: 5 })).toEqual({ dx: -1, dy: 0 });
        expect(awayDelta(from, { x: 5, y: 4 })).toEqual({ dx: 0, dy: -1 });
        expect(awayDelta(from, { x: 5, y: 6 })).toEqual({ dx: 0, dy: 1 });
        expect(awayDelta(from, { x: 6, y: 6 })).toBeNull();
        expect(awayDelta(from, { x: 7, y: 6 })).toEqual({ dx: 1, dy: 0 }); // 2:1 is one axis
        expect(awayDelta(from, { x: 13, y: 12 })).toBeNull(); // 8:7 — |sin| - |cos| inside 0.1: both axes in the game
        expect(awayDelta(from, from)).toBeNull();
    });

    it('a fire use moves each orthogonal fire block one cell away; the diagonal one stays; a plain block is not struck', () => {
        const w = world([
            '#######',
            '#.....#',
            '#.FF..#',
            '#.BP..#',
            '#..F..#',
            '#.....#',
            '#######',
        ]);
        const s = holding(w, [FIRE], { x: 3, y: 3 }, 'N');
        const used = step(w, s, useInput('fire'));
        // (3,2) N of the player → (3,1); (3,4) S → (3,5); (2,2) diagonal: not moved; (2,3) plain: not struck.
        expect(used.blocks).toEqual(['2,2', '2,3', '3,1', '3,5']);
        expect(used.blockKinds).toEqual({ '2,2': 'fire', '2,3': 'plain', '3,1': 'fire', '3,5': 'fire' });
        expect(used.player_pos).toEqual({ x: 3, y: 3 });
        // The facing does not matter to an 'away' push.
        expect(step(w, { ...s, facing: 'W' }, useInput('fire')).blocks).toEqual(used.blocks);
        // Without Fire the use is refused, as every use without its item.
        expect(step(w, holding(w, [], { x: 3, y: 3 }, 'N'), useInput('fire'))).toBeNull();
    });

    it('a fire block is never walked into; whyBlocked names what moves it', () => {
        const w = world(['######', '#PF..#', '######']);
        const s = holding(w, [FIRE]);
        expect(step(w, s, 'E')).toBeNull();
        expect(whyBlocked(w, s, 'E')).toBe('block at (2,1) (fire) is not walk-pushed — a strike moves it (fire)');
        expect(scriptedStep(w, s, 'E', HELPERS).refused.primitive).toBe('push');
        // A fire block pushed into a wall stays put (the use still passes a turn).
        const stuck = world(['#####', '#PF##', '#####']);
        const t = step(stuck, holding(stuck, [FIRE], null, 'E'), useInput('fire'));
        expect(t.blocks).toEqual(['2,1']);
        expect(t.turn).toBe(1);
    });
});

describe('WAKE: a turret struck by the sword becomes its corpse, per visit', () => {
    const ROOM = ['#######', '#PT...#', '#######'];

    it('the sword wakes it (no move); Fire then moves the corpse; Fire alone does nothing to a turret', () => {
        const w = world(ROOM);
        const s = holding(w, [SWORD, FIRE], null, 'E');
        expect(whyBlocked(w, s, 'E')).toBe('block at (2,1) (turret) is not walk-pushed — nothing moves it until sword wakes it into corpse');
        expect(step(w, s, useInput('fire')).blocks).toEqual(['2,1']);
        expect(step(w, s, useInput('fire')).blockKinds).toEqual({ '2,1': 'turret' });
        expect(strikeWakes(w, s, 'sword')).toEqual([{ at: '2,1', becomes: 'corpse' }]);
        const killed = step(w, s, useInput('sword'));
        expect(killed.blocks).toEqual(['2,1']);
        expect(killed.blockKinds).toEqual({ '2,1': 'corpse' });
        const pushed = walk(w, killed, [useInput('fire'), 'E', useInput('fire')]);
        expect(pushed.blocks).toEqual(['4,1']);
        expect(pushed.blockKinds).toEqual({ '4,1': 'corpse' });
        // Per visit: a fresh state stands the turret back up.
        expect(createState(w).blockKinds).toEqual({ '2,1': 'turret' });
    });

    it('blockWithinReach counts a block the use would WAKE (the facing-free search skips a use that does nothing)', () => {
        const w = world(ROOM);
        expect(blockWithinReach(w, holding(w, [SWORD], null, 'E'), 'sword')).toBe(true);
        expect(blockWithinReach(w, holding(w, [SWORD], null, 'S'), 'sword')).toBe(false);
    });
});

/** The corpse chain in miniature: kill the turret, burn its corpse onto the button, the door it holds opens. */
const CORPSE_CHAIN = [
    '#########',
    '#P......#',
    '#..T....#',
    '#.......#',
    '#...o...#',
    '#######D#',
    '#######X#',
    '#########',
];

/** A pulse clears a corridor: park the plain block on q, the pulser shoves the fire block aside, step off, walk through. */
const PULSE_GATE = [
    '########',
    '#PB.q..#',
    '#......#',
    '#.#Q####',
    '#..F..X#',
    '###.####',
    '########',
];

describe('PULSERS: a held token pushes the pulsed blocks on its reach away; the reach is an armed lane', () => {
    it('refuses by name: a pulser on floor, an overlap of reaches, two pushes onto one cell, its own cell, no token', () => {
        const w = world(PULSE_GATE, { pulsers: false });
        const p = (o) => () => checkPulsers([{ x: 3, y: 3, token: 'sw_1', reach: [{ x: 3, y: 4 }], ...o }], w, 't');
        expect(p({ x: 3, y: 4, reach: [{ x: 3, y: 5 }] })).toThrow(/stands on floor — a pulser is a solid body/);
        expect(p({ token: '' })).toThrow(/names no group token/);
        expect(p({ reach: [] })).toThrow(/reaches no cell/);
        expect(p({ reach: [{ x: 3, y: 3 }] })).toThrow(/lists its own cell/);
        expect(p({ reach: [{ x: 3, y: 4 }, { x: 3, y: 4 }] })).toThrow(/lists \(3,4\) twice/);
        expect(() => checkPulsers([
            { x: 3, y: 3, token: 'sw_1', reach: [{ x: 3, y: 4 }] },
            { x: 2, y: 3, token: 'sw_1', reach: [{ x: 3, y: 4 }] },
        ], w, 't')).toThrow(/\(3,4\) is in the reach of the pulsers at \(3,3\) and \(2,3\)/);
        const tall = world(['#####', '#P..#', '#.#.#', '#####'], { pulsers: false });
        expect(() => checkPulsers([
            { x: 2, y: 0, token: 't', reach: [{ x: 2, y: 1 }] },
            { x: 2, y: 2, token: 't', reach: [{ x: 3, y: 1 }, { x: 1, y: 1 }] },
        ], tall, 't')).not.toThrow(); // diagonals: no push, no clash
        expect(() => checkPulsers([
            { x: 1, y: 0, token: 't', reach: [{ x: 1, y: 1 }] },
            { x: 3, y: 0, token: 't', reach: [{ x: 3, y: 1 }] },
            { x: 2, y: 2, token: 't', reach: [{ x: 2, y: 1 }] },
        ], tall, 't')).not.toThrow();
        const cross = world(['#######', '#P....#', '###.###', '#.....#', '#######'], { pulsers: false });
        expect(() => checkPulsers([
            { x: 3, y: 0, token: 't', reach: [{ x: 3, y: 1 }] },
            { x: 2, y: 2, token: 't', reach: [{ x: 3, y: 2 }] },
            { x: 3, y: 4, token: 't', reach: [{ x: 3, y: 3 }] },
        ], cross, 't')).toThrow(/pulses push \(3,1\) and \(3,3\) both onto \(3,2\)/);
        // A reach cell pushed onto another reach cell: chained pulses are not modelled.
        expect(() => checkPulsers([
            { x: 3, y: 0, token: 't', reach: [{ x: 3, y: 1 }] },
            { x: 3, y: 4, token: 't', reach: [{ x: 3, y: 2 }] },
        ], cross, 't')).toThrow(/a pulse pushes \(3,1\) onto \(3,2\), another reach cell — chained pulses are not modelled/);
    });

    it('the world settles within the step: a block one round parks on a button lights another pulser at once', () => {
        const w = world([
            '#########',
            '#......P#',
            '##QFo..q#',
            '#.......#',
            '#....F..#',
            '#####R###',
            '#########',
        ]);
        // On q the player lights Q (2,2): round 1 pushes F (3,2) east onto o (4,2), which lights R (5,5) on sw_0;
        // round 2 pushes F (5,4) north to (5,3); round 3 moves nothing. One step.
        const s = walk(w, holding(w, []), ['S']);
        expect(s.blocks).toEqual(['4,2', '5,3']);
        expect(step(w, s, INPUT_WAIT).blocks).toEqual(s.blocks);
        expect(scriptedStep(w, holding(w, []), 'S', HELPERS).next.blocks).toEqual(s.blocks);
    });

    it('the gadget plays: park the block on q → the pulse shoves F south → step off q → walk through to the exit', () => {
        const w = world(PULSE_GATE);
        // Without the pulser F walls the corridor, never walked into, and Fire only pushes it along it.
        expect(reachesExit(world(PULSE_GATE, { pulsers: false }), [SWORD, FIRE])).toBe(false);
        let s = walk(w, holding(w, []), ['E']);
        expect(s.blocks).toEqual(['3,1', '3,4']);
        // The block reaches q (4,1): the pulse that ends the same step shoves F south, away from Q (3,3).
        s = walk(w, s, ['E']);
        expect(s.blocks).toEqual(['3,5', '4,1']);
        // Push the block off q (the player now holds it, off the reach), step off: the reach is quiet.
        s = walk(w, s, ['E', 'S', 'W', 'W', 'W', 'S', 'S', 'E', 'E', 'E', 'E', 'E']);
        expect(getExitAt(w, s.player_pos.x, s.player_pos.y)).toBeTruthy();
        expect(reachesExit(w, [])).toBe(true);
    });

    it('a step that ends on a live reach is refused, and whyBlocked names the pulser; off the button it is walkable', () => {
        const w = world(PULSE_GATE);
        // Beside Q's reach with the token held: the block on q.
        const s = { ...holding(w, [], { x: 1, y: 2 }), blocks: ['3,4', '4,1'], blockKinds: { '3,4': 'fire', '4,1': 'plain' } };
        const inv = effectiveInventory(w, s.inventory, s.player_pos, s.blocks, s.broken);
        expect(inv.has('sw_1')).toBe(true);
        expect(pulseShoves(w, s, inv)).toEqual([{ from: '3,4', to: '3,5' }]);
        expect(step(w, s, 'E')).toBeNull(); // (2,2) is in Q's reach
        expect(whyBlocked(w, s, 'E')).toBe('pulse of the pulser at (3,3) reaches (2,2) — its group (sw_1) is active');
        expect(scriptedStep(w, s, 'E', HELPERS).refused).toEqual({ primitive: 'pulse', cell: { x: 2, y: 2 }, helper: 'pulse_armed' });
        // The token held by the PLAYER standing on q: a wait pulses.
        const onQ = { ...holding(w, [], { x: 4, y: 1 }), blocks: ['2,1', '3,4'], blockKinds: { '2,1': 'plain', '3,4': 'fire' } };
        expect(step(w, onQ, INPUT_WAIT).blocks).toEqual(['2,1', '3,5']);
        // Nothing on q: the reach is quiet, and walkable.
        const quiet = { ...holding(w, [], { x: 1, y: 2 }), blocks: ['2,1', '3,4'], blockKinds: { '2,1': 'plain', '3,4': 'fire' } };
        expect(step(w, quiet, 'E').player_pos).toEqual({ x: 2, y: 2 });
    });

    it('a pulse never pushes a block onto the player (the block collides, as with any body)', () => {
        const w = world(['#######', '#.....#', '#.##Q##', '#..PF.#', '#..q..#', '#######']);
        // Q (4,2) reaches (4,3)=F; F's push is S onto (4,4) — free. Stand on (4,4)? It is in no reach: Q's reach is rows 1-3.
        const s = { ...holding(w, [], { x: 4, y: 4 }), blocks: ['4,3'], blockKinds: { '4,3': 'fire' } };
        const held = { ...s, inventory: new Set(['sw_1']) };
        expect(pulseShoves(w, held, held.inventory)).toEqual([]);
        expect(step(w, held, INPUT_WAIT).blocks).toEqual(['4,3']);
    });
});

describe('the corpse chain, priced by the engine search (logic by search: ⚖ Q3)', () => {
    it('the exit needs the sword (kill) AND Fire (burn the corpse onto the button)', () => {
        const w = world(CORPSE_CHAIN);
        expect(reachesExit(w, [])).toBe(false);
        expect(reachesExit(w, [SWORD])).toBe(false);
        expect(reachesExit(w, [FIRE])).toBe(false);
        expect(reachesExit(w, [SWORD, FIRE])).toBe(true);
    });

    it('extractPathsAndObstacles prices the exit And(Fire, sword) — the search reads the wake and the push', () => {
        const w = world(CORPSE_CHAIN);
        const [exit] = extractPathsAndObstacles(w).exits;
        const names = JSON.stringify(exit.access_rule).match(/"item_name":"[^"]+"/g);
        expect(exit.access_rule.rule).toBe('And');
        expect(names).toEqual([`"item_name":"${FIRE}"`, `"item_name":"${SWORD}"`]);
    });
});

describe('scripted ≡ native (every new condition by helper; geometry native)', () => {
    const ROOMS = {
        'corpse chain': [CORPSE_CHAIN, [SWORD, FIRE]],
        'pulse gate': [PULSE_GATE, [FIRE]],
        'fire away + plain': [['#######', '#..F..#', '#.FPB.#', '#..C..#', '#######'], [FIRE]],
    };
    for (const [name, [rows, items]] of Object.entries(ROOMS)) {
        it(`agrees over every reachable (state, input) of the ${name}`, () => {
            const r = disagreements(world(rows), items);
            expect(r.out).toEqual([]);
        });
    }

    it('the new branches are exercised (moves, wakes, pulses, pulse refusals)', () => {
        const all = Object.values(ROOMS).map(([rows, items]) => disagreements(world(rows), items));
        expect(all.reduce((n, r) => n + r.moved, 0)).toBeGreaterThan(0);
        expect(all.reduce((n, r) => n + r.woken, 0)).toBeGreaterThan(0);
        expect(all.reduce((n, r) => n + r.pulsed, 0)).toBeGreaterThan(0);
        expect(all.reduce((n, r) => n + r.pulseRefusals, 0)).toBeGreaterThan(0);
    });

    it('agrees over seeded random gadget rooms (kinds, a button + door, a pulser)', () => {
        let rooms = 0;
        for (let seed = 1; rooms < 6 && seed < 200; seed++) {
            const rows = randomRoom(createRng(seed));
            let w;
            try { w = world(rows); } catch { continue; }
            const r = disagreements(w, [SWORD, FIRE]);
            expect(r.out, rows.join('\n')).toEqual([]);
            rooms += 1;
        }
        expect(rooms).toBe(6);
    });

    describe('red-first: a broken helper makes scripted ≠ native', () => {
        const mutate = (name, body) => ({ ...HELPERS, [name]: { ...HELPERS[name], body } });
        const attr = (a) => ({ type: 'attribute', object: { type: 'name', name: 'tile' }, attr: a });
        const findings = (h, rows, items) => disagreements(world(rows), items, h).out.length;

        it('the mutants drop one conjunct each (shape pinned)', () => {
            expect(HELPERS.block_struck.body).toEqual({ type: 'and', conditions: [attr('block'), attr('block_struck')] });
            expect(HELPERS.woken.body).toEqual({ type: 'and', conditions: [attr('block'), attr('wakes')] });
            expect(HELPERS.pulse_armed.body.conditions.map((c) => c.type)).toEqual(['compare', 'item_check']);
            expect(HELPERS.pulse_shoves.body.conditions.slice(0, 2)).toEqual([attr('block'), attr('pulsed')]);
            expect(HELPERS.block_may_enter.body.conditions.some((c) => c.type === 'not' && c.condition.attr === 'player')).toBe(true);
        });

        it('block_struck that ignores the kind (moves ANY block) is caught by "fire away + plain"', () => {
            const h = mutate('block_struck', { type: 'and', conditions: [attr('block')] });
            expect(findings(h, ROOMS['fire away + plain'][0], [FIRE])).toBeGreaterThan(0);
        });

        it('woken that ignores `wakes` (any strike wakes) is caught by the corpse chain', () => {
            const h = mutate('woken', { type: 'and', conditions: [attr('block')] });
            expect(findings(h, CORPSE_CHAIN, [SWORD, FIRE])).toBeGreaterThan(0);
        });

        it('pulse_armed that forgets the token (always live) is caught by the pulse gate', () => {
            const [isReach] = HELPERS.pulse_armed.body.conditions;
            const h = mutate('pulse_armed', { type: 'and', conditions: [isReach] });
            expect(findings(h, PULSE_GATE, [FIRE])).toBeGreaterThan(0);
        });

        it('pulse_shoves that forgets `pulsed` (pulses every kind) is caught by a plain block on a reach', () => {
            const conds = HELPERS.pulse_shoves.body.conditions;
            const h = mutate('pulse_shoves', { type: 'and', conditions: conds.filter((c) => !(c.type === 'attribute' && c.attr === 'pulsed')) });
            const PLAIN_ON_REACH = ['#######', '#P....#', '#..q..#', '#.....#', '#.#Q###', '#.#B..#', '#.#...#', '#######'];
            expect(findings(h, PLAIN_ON_REACH, [])).toBeGreaterThan(0);
            expect(findings(HELPERS, PLAIN_ON_REACH, [])).toBe(0);
        });

        it('block_may_enter that forgets the player is caught by a pulse toward the player', () => {
            const h = mutate('block_may_enter', {
                ...HELPERS.block_may_enter.body,
                conditions: HELPERS.block_may_enter.body.conditions.filter((c) => !(c.type === 'not' && c.condition.attr === 'player')),
            });
            // The player standing on q (3,4) holds the token; the pulse pushes F (3,3) south, onto the player.
            const TOWARD = ['#######', '#P....#', '#.#Q#.#', '#.#F#.#', '#.#q#.#', '#.....#', '#######'];
            expect(findings(h, TOWARD, [])).toBeGreaterThan(0);
            expect(findings(HELPERS, TOWARD, [])).toBe(0);
        });

        it('(control) the unmutated helpers find nothing on every room', () => {
            for (const [rows, items] of Object.values(ROOMS)) expect(findings(HELPERS, rows, items)).toBe(0);
        });
    });
});

/**
 * A seeded random gadget room: 8×7, sparse walls, a plain, a fire and a turret block, one button `o` holding the door
 * `D` before the exit, and one pulser `Q` (a wall cell) whose token `q` is a second button. Refused layouts (a pulser
 * on a reach clash) are skipped by the caller.
 */
function randomRoom(rng) {
    const W = 8;
    const H = 7;
    const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.')));
    const free = () => {
        for (;;) {
            const x = 1 + Math.floor(rng.next() * (W - 2));
            const y = 1 + Math.floor(rng.next() * (H - 3));
            if (g[y][x] === '.') return [x, y];
        }
    };
    for (let i = 0; i < 4; i++) { const [x, y] = free(); g[y][x] = '#'; }
    for (const ch of ['P', 'B', 'F', 'T', 'o', 'q', 'Q']) { const [x, y] = free(); g[y][x] = ch; }
    for (let x = 1; x < W - 1; x++) g[H - 2][x] = '#';
    g[H - 2][W - 2] = 'D';
    g[H - 1][W - 2] = 'X';
    return g.map((r) => r.join(''));
}
