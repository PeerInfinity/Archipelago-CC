/**
 * ⛓⛓ LATCHING BUTTONS (session tile-mechanisms-m4-latch; ⚖ user 2026-10-31 "Record it as owed (Recommended)", ⚖ user
 * 2026-11-01 "Both in parallel, if possible."): `buttonLib[id].latch: {event?}`, the in-level ButtonRoom latch m2-l40
 * found owed. Game truth (`ButtonRoom.as`): `update` presses it while any Player / Enemy / Solid (not a Cover) stands on
 * it; the `activate` setter "Can't be reset to false!!"; it persists by `tag`. The maze's shape is the ROPE's: down
 * while pressed now, or pressed earlier THIS visit (`state.latched`), or its event carried (an earlier visit — an 'ap'
 * search grants nothing at a location).
 *
 * Proven on GADGET ROOMS read from pictures (memory `feedback_no_single_game_code_for_a_test`), no level of any game:
 *   - a block shoved through a latching button keeps its door open after the block leaves; a per-visit button does not;
 *   - a block a pulse shoves on and off within ONE step still latches it (the settle records each round);
 *   - a latch carried as its event from an earlier visit holds the door from the start;
 *   - scripted ≡ native over every reachable (state, input), and red-first mutants of the `latched` helper are caught.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, deserializeMazeWorld, serializeMazeEntities,
    effectiveInventory, latchTokens, checkButtonLib, INPUT_WAIT, extractPathsAndObstacles,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { reachUnder, regionItems, regionTargets, reachedTarget, latchEvents } from './tileSpike/deriveTileLogic.js';
import { nativeReachUnder } from './tileSpike/deriveLevelWorldLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const EV = 'Latch L pressed';

/**
 *   #  wall   P entrance   G goal (an item on the cell)   B plain block   S pulsed block   L latching button (holds sw_L)
 *   D  door (sw_L)   h  holding button (holds sw_H)   K  a plain block standing on an h   X  pulser (a wall cell) on sw_H
 */
function sidecar(rows, { latch = { event: EV }, reach = [] } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const at = (...chs) => {
        const out = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (chs.includes(rows[y][x])) out.push({ x, y });
        return out;
    };
    const pulsed = at('S').length > 0;
    const blocks = [...at('B', 'K').map((c) => ({ ...c, ...(pulsed ? { kind: 'plain' } : {}) })), ...at('S').map((c) => ({ ...c, kind: 'pushy' }))];
    return {
        width,
        height,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' || c === 'X' ? 1 : 0))),
        entrance: at('P')[0],
        obstacles: at('D').map((c) => ({ ...c, id: 'door' })),
        items: at('G').map((c) => ({ ...c, id: 'goal' })),
        obstacleLib: { door: { id: 'door', name: 'door', clear_set: [['sw_L']] } },
        blocks,
        ...(pulsed ? { block_lib: { plain: { walk: true }, pushy: { walk: true, pulsed: true } } } : {}),
        buttons: [...at('L').map((c) => ({ ...c, id: 'button_L' })), ...at('h', 'K').map((c) => ({ ...c, id: 'button_H' }))],
        buttonLib: {
            button_L: { kind: 'button', holds: 'sw_L', ...(latch === null ? {} : { latch }) },
            button_H: { kind: 'button', holds: 'sw_H' },
        },
        ...(at('X').length > 0 ? { pulsers: at('X').map((c) => ({ ...c, token: 'sw_H', reach })) } : {}),
    };
}
const world = (rows, opts) => deserializeMazeWorld(sidecar(rows, opts));

// A block comes down column 3 onto L and on into the pocket below; the door is three cells east of L, and row 3 is
// entered only through L — so a parked block shuts the player out, and standing on L does not reach the door.
const SHOVE = [
    '#########',
    '###P#####',
    '###B#####',
    '###L..DG#',
    '###.#####',
    '###.#####',
    '#########',
];
// The pulser (4,2) is live from the start (K holds sw_H, walled in); its reach is L (4,3) alone, an armed lane the
// player never stands in. A push puts S on L, and the same step's pulse shoves it on into the pocket (4,4).
const PULSE = [
    '###########',
    '#K#########',
    '####X######',
    '#P.SL######',
    '##.#.######',
    '##.########',
    '##....DG###',
    '###########',
];
const PULSE_OPTS = { reach: [{ x: 4, y: 3 }] };
// L is a sealed cell: nothing ever presses it this visit.
const SEALED = [
    '########',
    '#P..DG##',
    '######L#',
    '########',
];

const holding = (w, items) => {
    const s = createState(w);
    s.inventory = new Set(items);
    return s;
};
const walk = (w, s, inputs) => inputs.reduce((acc, input) => {
    const n = step(w, acc, input);
    if (n === null) throw new Error(`refused ${input} at ${mazeVisitedKey(acc)}: ${whyBlocked(w, acc, input)}`);
    return n;
}, s);

function reachable(w, items, cap = 20000) {
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
const goalOf = (w) => [...w.items.keys()][0];
const reachesGoal = (w, items = []) => reachable(w, items).some((s) => `${s.player_pos.x},${s.player_pos.y}` === goalOf(w));

/** Every native ≠ scripted disagreement over the reachable states (all inputs + WAIT), and how often a latch was recorded. */
function disagreements(w, items, helpers = HELPERS) {
    const out = [];
    let latchings = 0;
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
            if ((native?.latched?.length ?? 0) > (s.latched?.length ?? 0)) latchings += 1;
        }
    }
    return { out, latchings };
}

describe('latching buttons — the engine (native step)', () => {
    it('a block shoved through a latching button keeps the door open after it leaves', () => {
        const w = world(SHOVE);
        const s = walk(w, createState(w), ['S', 'S', 'S']);   // the block: L, then the pocket; the player ends on (3,4)
        expect(s.blocks).toEqual(['3,5']);
        expect(s.latched).toEqual(['3,3']);
        const at = walk(w, s, ['N', 'E', 'E', 'E']);          // off L, through the door
        expect(at.player_pos).toEqual({ x: 6, y: 3 });
        expect(reachesGoal(w)).toBe(true);
    });

    it('a per-visit button (no `latch`) does not: the same room never reaches the goal', () => {
        const w = world(SHOVE, { latch: null });
        expect(reachesGoal(w)).toBe(false);
        const s = walk(w, createState(w), ['S', 'S', 'S', 'N', 'E', 'E']);
        expect(whyBlocked(w, s, 'E')).toBe('door is shut — nothing on button_L');
    });

    it('a pulse that shoves the block on and off L within ONE step still latches it', () => {
        const w = world(PULSE, PULSE_OPTS);
        const s = walk(w, createState(w), ['E', 'E']);       // the push puts S on L; the step's pulse shoves it to (4,4)
        expect(s.blocks).toEqual(['1,1', '4,4']);
        expect(s.latched).toEqual(['4,3']);
        expect(reachesGoal(w)).toBe(true);
        expect(reachesGoal(world(PULSE, { ...PULSE_OPTS, latch: null }))).toBe(false);
    });

    it('a latch carried as its event from an earlier visit holds the door from the start', () => {
        const w = world(SEALED);
        expect(reachesGoal(w)).toBe(false);
        expect(reachesGoal(w, [EV])).toBe(true);
        expect(latchTokens(w, new Set([EV]), [])).toEqual(['sw_L']);
        expect(latchTokens(w, new Set(), [])).toBeNull();
        expect(effectiveInventory(w, new Set(), { x: 1, y: 1 }, w.blocks.size ? [] : undefined, undefined, ['6,2']).has('sw_L')).toBe(true);
        expect(whyBlocked(w, walk(w, createState(w), ['E', 'E']), 'E'))
            .toBe(`door is shut — nothing has pressed button_L (it latches; or carry ${EV})`);
    });

    it('a latch without an event latches for the visit only (nothing carried opens it)', () => {
        const w = world(SEALED, { latch: {} });
        expect(reachesGoal(w, [EV])).toBe(false);
        expect(reachesGoal(world(SHOVE, { latch: {} }))).toBe(true);
        expect(whyBlocked(w, walk(w, createState(w), ['E', 'E']), 'E')).toBe('door is shut — nothing has pressed button_L (it latches)');
    });

    it('an arrival standing on a latch latches it at once', () => {
        // (the entrance cell carries the latching button)
        const sc = sidecar(['######', '#P.DG#', '######']);
        sc.buttons = [{ x: 1, y: 1, id: 'button_L' }];
        const on = deserializeMazeWorld(sc);
        expect(createState(on).latched).toEqual(['1,1']);
        expect(reachesGoal(on)).toBe(true);
    });

    it('a latch whose event is carried is never recorded (it is down already; the record would only split states)', () => {
        const w = world(SHOVE);
        const carried = reachable(w, [EV]);
        expect(carried.every((s) => s.latched.length === 0)).toBe(true);
        expect(reachable(w, []).some((s) => s.latched.length > 0)).toBe(true);
        expect(carried.some((s) => `${s.player_pos.x},${s.player_pos.y}` === goalOf(w))).toBe(true);
    });

    it('`state.latched` and the visited key\'s `|l` segment exist only on a world that places a latch', () => {
        const plain = world(SHOVE, { latch: null });
        expect(createState(plain).latched).toBeUndefined();
        expect(mazeVisitedKey(createState(plain))).not.toContain('|l');
        const latching = world(SHOVE);
        expect(mazeVisitedKey(createState(latching))).toBe(`${mazeVisitedKey(createState(plain))}|l`);
    });

    it('the latch rides a sidecar round trip (serializeMazeEntities → deserializeMazeWorld)', () => {
        const w = world(SHOVE);
        const back = serializeMazeEntities(w);
        expect(back.buttonLib.button_L.latch).toEqual({ event: EV });
        expect(deserializeMazeWorld({ ...sidecar(SHOVE), ...back }).buttonLib.button_L.latch).toEqual({ event: EV });
    });
});

describe('latching buttons — refused by name (checkButtonLib)', () => {
    const refuse = (mut) => {
        const sc = sidecar(SHOVE);
        mut(sc);
        return () => deserializeMazeWorld(sc);
    };
    it('a latch that is not an object', () => {
        expect(refuse((sc) => { sc.buttonLib.button_L.latch = true; })).toThrow(/button_L\.latch must be an object/);
    });
    it('a latch key it does not model (the ButtonRoom `flip`)', () => {
        expect(refuse((sc) => { sc.buttonLib.button_L.latch = { event: EV, flip: true }; })).toThrow(/button_L\.latch\.flip is not modelled/);
    });
    it('an event that is not a non-empty string', () => {
        expect(refuse((sc) => { sc.buttonLib.button_L.latch = { event: '' }; })).toThrow(/latch\.event must be a non-empty string/);
    });
    it('a latch that holds no token', () => {
        expect(refuse((sc) => { delete sc.buttonLib.button_L.holds; })).toThrow(/button_L latches but holds no token/);
    });
    it('a latching button on an obstacle cell', () => {
        expect(refuse((sc) => { sc.obstacles.push({ x: 3, y: 3, id: 'door' }); })).toThrow(/latches on \(3,3\), an obstacle's cell/);
    });
    it('a latching button inside a pull disc', () => {
        expect(refuse((sc) => {
            sc.obstacleLib.suit = { id: 'suit', name: 'suit', clear_set: [['Suit']] };
            sc.pulls = [{ x: 4, y: 3, from: [{ x: 3, y: 3 }], gate: 'suit' }];
        })).toThrow(/inside the disc of the pull at \(4,3\)/);
    });
    it('a pulser its token lights', () => {
        const sc = sidecar(PULSE, PULSE_OPTS);
        sc.pulsers[0].token = 'sw_L';
        expect(() => deserializeMazeWorld(sc)).toThrow(/latches the token \(sw_L\) that lights the pulser at \(4,2\)/);
    });
    it('(control) the unmutated rooms load, and a world without a latch is not asked', () => {
        for (const [rows, o] of [[SHOVE], [PULSE, PULSE_OPTS], [SEALED]]) expect(() => world(rows, o)).not.toThrow();
        expect(() => checkButtonLib({ buttonLib: { a: { holds: 'x' } }, buttons: new Map() }, 't')).not.toThrow();
    });
});

describe('latching buttons — scripted ≡ native, and the `latched` helper is load-bearing', () => {
    const ROOMS = {
        'shove (latch + event)': [world(SHOVE), []],
        'shove (per-visit control)': [world(SHOVE, { latch: null }), []],
        'pulse (latch)': [world(PULSE, PULSE_OPTS), []],
        'sealed, event carried': [world(SEALED), [EV]],
        'sealed, nothing carried': [world(SEALED), []],
    };
    for (const [name, [w, items]] of Object.entries(ROOMS)) {
        it(`agrees over every reachable (state, input) of ${name}`, () => {
            expect(disagreements(w, items).out).toEqual([]);
        });
    }
    it('the latch branch is exercised (some step records a latch in the latching rooms)', () => {
        expect(disagreements(...ROOMS['shove (latch + event)']).latchings).toBeGreaterThan(0);
        expect(disagreements(...ROOMS['pulse (latch)']).latchings).toBeGreaterThan(0);
    });

    describe('mutants are caught', () => {
        const mutate = (body) => ({ ...HELPERS, latched: { ...HELPERS.latched, body } });
        const [thisVisit, carried] = HELPERS.latched.body.conditions;
        it('the mutant bodies are the real helper minus one disjunct (shape check)', () => {
            expect(HELPERS.latched.body.type).toBe('or');
            expect(thisVisit).toEqual({ type: 'attribute', object: { type: 'name', name: 'tile' }, attr: 'latched' });
            expect(carried.type).toBe('and');
        });
        it("`latched` that forgets THIS visit's press is caught by the shove room", () => {
            expect(disagreements(...ROOMS['shove (latch + event)'], mutate(carried)).out.length).toBeGreaterThan(0);
        });
        it('`latched` that forgets the CARRIED event is caught by the sealed room', () => {
            expect(disagreements(...ROOMS['sealed, event carried'], mutate(thisVisit)).out.length).toBeGreaterThan(0);
        });
        it('`latched` that never holds (no latch at all) is caught by the pulse room', () => {
            expect(disagreements(...ROOMS['pulse (latch)'], mutate({ type: 'constant', value: false })).out.length).toBeGreaterThan(0);
        });
        it('(control) the unmutated helpers find nothing in any room', () => {
            for (const [w, items] of Object.values(ROOMS)) expect(disagreements(w, items).out.length).toBe(0);
        });
    });
});

describe('latching buttons — derived logic (the press is an event location; the carried event is an axis item)', () => {
    it('the latch event joins the item axis and is a target of its own', () => {
        const w = world(SHOVE);
        expect(regionItems(w)).toEqual([EV]);
        expect(latchEvents(w)).toEqual([{ key: '3,3', x: 3, y: 3, event: EV, latch: true }]);
        expect(regionTargets(w).map((t) => t.id)).toContain(`event:${EV}@3,3`);
    });

    it('scripted and native searches reach the press and the goal empty-handed in the shove room', () => {
        const w = world(SHOVE);
        const ev = regionTargets(w).find((t) => t.event === EV);
        const goal = regionTargets(w).find((t) => t.item === 'goal');
        for (const reach of [reachUnder(w, [], HELPERS), nativeReachUnder(w, [])]) {
            expect(reachedTarget(reach, ev, [], w)).toBe(true);
            expect(reachedTarget(reach, goal, [], w)).toBe(true);
        }
    });

    it('in the sealed room the goal needs the carried event, and the press is never reached', () => {
        const w = world(SEALED);
        const ev = regionTargets(w).find((t) => t.event === EV);
        const goal = regionTargets(w).find((t) => t.item === 'goal');
        for (const [items, goalReached] of [[[], false], [[EV], true]]) {
            for (const reach of [reachUnder(w, items, HELPERS), nativeReachUnder(w, items)]) {
                expect(reachedTarget(reach, goal, items, w)).toBe(goalReached);
                expect(reachedTarget(reach, ev, items, w)).toBe(false);
            }
        }
    });

    it('the region analysis prices the sealed goal by the event (`extractPathsAndObstacles`)', () => {
        const w = world(SEALED);
        const { locations } = extractPathsAndObstacles(w);
        const goal = locations.find((l) => l.position.x === 5 && l.position.y === 1);
        expect(goal.access_rule).toEqual({ rule: 'Has', args: { item_name: EV } });
    });
});
