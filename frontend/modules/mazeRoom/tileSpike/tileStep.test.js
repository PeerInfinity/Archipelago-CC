/**
 * Tile-primitives SPIKE — parity against the engine as the ORACLE.
 *
 * Over every (state, input) the REAL `step` reaches in each fixture: the scripted step agrees on
 * legality and on the next state, and a scripted `push` refusal ⇔ `whyBlocked` names the block.
 * Mutant rows prove each fixture can tell a wrong condition apart (no vacuous green).
 */
import { describe, it, expect } from 'vitest';
import {
    createWorld, createState, step, whyBlocked, mazeVisitedKey, setTile, setBlock, setButton, setObstacle,
    setItem, TILE_WALL, INPUTS, INPUT_WAIT,
} from '../mazeRoomEngine.js';
import { worldInputs, useInput } from '../mazeRoomEngine.js';
import { itemActionPicture, ROCK_CORRIDOR } from '../mazeItemActions.fixtures.js';
import { scriptedStep } from './tileStep.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const DOOR_A = { name: 'Door A', id: 'door_A', clear_set_type: 'combo_list', clear_set: [['sw_A']] };
// A rule-type obstacle (the L15 shape: a rock either weapon or Swim gets past) — read against the
// step's own inventory, not a snapshot.
const ROCK = {
    name: 'Rock', id: 'rock', clear_set_type: 'rule',
    clear_rule: { rule: 'Or', children: [
        { rule: 'Has', args: { item_name: 'Progressive Sword' } },
        { rule: 'Has', args: { item_name: 'Progressive Swim' } }] },
};
const BUTTON_A = { name: 'Button A', id: 'button_A', kind: 'button', holds: 'sw_A' };

// '#' wall · '.' floor · 'P' entrance · 'B' block · 'b' button_A · 'D' door_A · 'F' flag_B · 'K' key_red · 'R' door_red
// · 'O' rock (rule obstacle) · 'S' Progressive Sword
function picture(rows) {
    let entrance = { x: 0, y: 0 };
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'P') entrance = { x, y }; }));
    const w = createWorld(rows[0].length, rows.length, { entrance, exits: [{ exit_id: 'exit', ...entrance }] });
    w.obstacleLib = { ...w.obstacleLib, door_A: DOOR_A, rock: ROCK };
    w.buttonLib = { button_A: BUTTON_A };
    rows.forEach((r, y) => [...r].forEach((c, x) => {
        if (c === '#') setTile(w, x, y, TILE_WALL);
        if (c === 'B') setBlock(w, x, y);
        if (c === 'b') setButton(w, x, y, 'button_A');
        if (c === 'D') setObstacle(w, x, y, 'door_A');
        if (c === 'R') setObstacle(w, x, y, 'door_red');
        if (c === 'F') setItem(w, x, y, 'flag_B');
        if (c === 'K') setItem(w, x, y, 'key_red');
        if (c === 'O') setObstacle(w, x, y, 'rock');
        if (c === 'S') setItem(w, x, y, 'Progressive Sword');
    }));
    return w;
}

const FIXTURES = {
    'an open room': ['#####', '#P..#', '#...#', '#####'],
    'a door and its key (key off the route)': ['######', '#P.R.#', '#.K..#', '######'],
    'the 7×7 guard gadget': ['#######', '#P....#', '##.B#.#', '##....#', '##b#.##', '####DF#', '#######'],
    'a door held by the PLAYER (one-way ticket)': ['#######', '#P.bDF#', '#######'],
    'two blocks (block into block)': ['#######', '#PBB..#', '#.....#', '#######'],
    // ⛔ Two vacuous spellings were MEASURED by the third mutant before this one: the button beside the door
    //   (every push into the door started ON the button), and the block in row 1 (pushable only E/W, never
    //   reaching the door's row). Here a push E along row 2 meets the door shut.
    'a block over an item, pushed through a held door':
        ['########', '#P.....#', '#.BK.D.#', '#..b...#', '#......#', '########'],
    // The block's lane crosses a RULE obstacle; the sword that clears it is in the room.
    'a block pushed through a rule-gated rock': ['#######', '#PS...#', '#.B.O.#', '#..b..#', '#######'],
};

function reachable(world, cap = 20000) {
    const start = createState(world);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const frontier = [start];
    while (frontier.length) {
        const s = frontier.pop();
        for (const input of INPUTS) {
            const n = step(world, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.set(mazeVisitedKey(n), n);
            frontier.push(n);
        }
        if (seen.size > cap) throw new Error('exploration truncated');
    }
    return [...seen.values()];
}

/** Every disagreement between the oracle and the scripted step, as strings. */
function disagreements(world, helpers) {
    const out = [];
    let pairs = 0;
    let refusals = 0;
    let pushRefusals = 0;
    for (const s of reachable(world)) {
        for (const input of [...INPUTS, INPUT_WAIT]) {
            pairs += 1;
            const oracle = step(world, s, input);
            const why = whyBlocked(world, s, input);
            const { next, refused } = scriptedStep(world, s, input, helpers);
            const at = `${input}@${mazeVisitedKey(s)}`;
            if (oracle === null) refusals += 1;
            if ((oracle === null) !== (next === null)) out.push(`${at} legality oracle=${oracle !== null} scripted=${next !== null}`);
            else if (oracle !== null && (mazeVisitedKey(oracle) !== mazeVisitedKey(next) || oracle.turn !== next.turn)) {
                out.push(`${at} state oracle=${mazeVisitedKey(oracle)} scripted=${mazeVisitedKey(next)}`);
            }
            const oraclePush = why?.startsWith('block at') ?? false;
            if (oraclePush) pushRefusals += 1;
            if (refused && oraclePush !== (refused.primitive === 'push')) {
                out.push(`${at} refusal why=${why} scripted=${refused.primitive}`);
            }
        }
    }
    return { out, pairs, refusals, pushRefusals };
}

describe('tile-primitives spike — scripted step ≡ engine step', () => {
    for (const [name, rows] of Object.entries(FIXTURES)) {
        it(`agrees over every reachable (state, input) of ${name}`, () => {
            const { out, pairs, refusals } = disagreements(picture(rows), HELPERS);
            expect(out).toEqual([]);
            expect(refusals).toBeGreaterThan(0);
            expect(refusals).toBeLessThan(pairs);
        });
    }

    it('the push branch is exercised (some fixture refuses a push)', () => {
        const total = Object.values(FIXTURES).reduce((n, rows) => n + disagreements(picture(rows), HELPERS).pushRefusals, 0);
        expect(total).toBeGreaterThan(0);
    });
});

describe('tile-primitives spike — the fixtures DETECT a wrong condition (mutants)', () => {
    const mutate = (name, body) => ({ ...HELPERS, [name]: { ...HELPERS[name], body } });
    const attr = (a) => ({ type: 'attribute', object: { type: 'name', name: 'tile' }, attr: a });

    it('block_may_enter that forgets other blocks is caught by "two blocks"', () => {
        const h = mutate('block_may_enter', attr('floor'));
        expect(disagreements(picture(FIXTURES['two blocks (block into block)']), h).out.length).toBeGreaterThan(0);
    });

    it('presses that ignores the player is caught by "a door held by the PLAYER"', () => {
        const h = mutate('presses', attr('block'));
        expect(disagreements(picture(FIXTURES['a door held by the PLAYER (one-way ticket)']), h).out.length)
            .toBeGreaterThan(0);
    });

    it('a block that may enter a SHUT door is caught by "a block over an item…"', () => {
        const h = mutate('block_may_enter', { type: 'and', conditions: [attr('floor'), { type: 'not', condition: attr('block') }] });
        expect(disagreements(picture(FIXTURES['a block over an item, pushed through a held door']), h).out.length)
            .toBeGreaterThan(0);
    });
});

/* ── ITEM ACTIONS (slice tile-primitives-item-actions): turn / use / strike ─────────────────────── */

const ACTION_FIXTURES = {
    'the rock corridor (sword off the route)': ROCK_CORRIDOR,
    // The rock sits before a key door: a strike that ignored `struck_by` would break the DOOR too.
    'a rock before a door': ['########', '#PS.rRX#', '#.....##', '########'],
    // The block's lane runs into the rock; it passes only once the rock is struck from below.
    'a block through a struck rock': ['#######', '#PSB.r#', '#....##', '#######'],
};

function reachableActions(world, cap = 20000) {
    const start = createState(world);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const frontier = [start];
    const inputs = worldInputs(world);
    while (frontier.length) {
        const s = frontier.pop();
        for (const input of inputs) {
            const n = step(world, s, input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.set(mazeVisitedKey(n), n);
            frontier.push(n);
        }
        if (seen.size > cap) throw new Error('exploration truncated');
    }
    return [...seen.values()];
}

function actionDisagreements(world, helpers) {
    const out = [];
    let pairs = 0;
    let strikes = 0;
    for (const s of reachableActions(world)) {
        for (const input of [...worldInputs(world), INPUT_WAIT, useInput('bow')]) {
            pairs += 1;
            const oracle = step(world, s, input);
            const { next } = scriptedStep(world, s, input, helpers);
            const at = `${input}@${mazeVisitedKey(s)}`;
            if ((oracle === null) !== (next === null)) {
                out.push(`${at} legality oracle=${oracle !== null} scripted=${next !== null}`);
            } else if (oracle !== null && (mazeVisitedKey(oracle) !== mazeVisitedKey(next) || oracle.turn !== next.turn)) {
                out.push(`${at} state oracle=${mazeVisitedKey(oracle)} scripted=${mazeVisitedKey(next)}`);
            }
            if (oracle !== null && oracle.broken.length > s.broken.length) strikes += 1;
        }
    }
    return { out, pairs, strikes };
}

describe('tile-primitives — scripted step ≡ engine step with ITEM ACTIONS', () => {
    for (const [name, rows] of Object.entries(ACTION_FIXTURES)) {
        it(`agrees over every reachable (state, input) of ${name}`, () => {
            const { out, strikes } = actionDisagreements(itemActionPicture(rows), HELPERS);
            expect(out).toEqual([]);
            expect(strikes).toBeGreaterThan(0);   // the strike branch really runs
        });
    }

    describe('mutants are caught', () => {
        const mutate = (name, body) => ({ ...HELPERS, [name]: { ...HELPERS[name], body } });
        const attr = (a) => ({ type: 'attribute', object: { type: 'name', name: 'tile' }, attr: a });
        const findings = (h, name) => actionDisagreements(itemActionPicture(ACTION_FIXTURES[name]), h).out.length;

        it('the mutant bodies are the real helper minus one conjunct (shape check)', () => {
            expect(HELPERS.strikes.body.type).toBe('and');
            expect(HELPERS.strikes.body.conditions).toHaveLength(3);
        });

        it('strikes that ignores `struck` (breaks ANY obstacle) is caught by "a rock before a door"', () => {
            const [obstacle, , notBroken] = HELPERS.strikes.body.conditions;
            const h = mutate('strikes', { type: 'and', conditions: [obstacle, notBroken] });
            expect(findings(h, 'a rock before a door')).toBeGreaterThan(0);
        });

        it('strikes that ignores `broken` (re-breaks) is caught by the rock corridor', () => {
            const [obstacle, struck] = HELPERS.strikes.body.conditions;
            const h = mutate('strikes', { type: 'and', conditions: [obstacle, struck] });
            expect(findings(h, 'the rock corridor (sword off the route)')).toBeGreaterThan(0);
        });

        it('cleared that forgets `broken` is caught by "a block through a struck rock"', () => {
            const body = HELPERS.cleared.body;
            expect(body.type).toBe('or');
            const h = mutate('cleared', { type: 'or', conditions: body.conditions.filter((c) => !(c.type === 'attribute' && c.attr === 'broken')) });
            expect(h.cleared.body.conditions.length).toBe(body.conditions.length - 1);
            expect(findings(h, 'a block through a struck rock')).toBeGreaterThan(0);
        });

        it('(control) the unmutated helpers find nothing on the same three fixtures', () => {
            for (const name of Object.keys(ACTION_FIXTURES)) expect(findings(HELPERS, name)).toBe(0);
        });
    });
});
