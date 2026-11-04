/**
 * ⛓ LATCH SANDWICH (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then lay") — the push-tier pins of the prune in
 * `deriveLevelWorldLogic.js`: a lattice point is skipped when its upper probe U = Q ∪ {latch events} takes no uncovered target.
 *   - On GADGET ROOMS (memory `feedback_no_single_game_code_for_a_test`): prune on ≡ prune off, native and scripted, and the
 *     prune really skips there (a pin that never skips proves nothing). Mutant MEASURED red by this file: the own-event
 *     exclusion dropped (a latch's own event target probed holding its event) loses the press's minimal set.
 *   - A latch whose held token arms a TRAP is refused by name (holding its event arms something: not proven monotone).
 *   - The committed `seedling_playthrough_maze` preset lays no latch, so the prune is a provable NO-OP there (0 skips).
 * The L40-laid pins (search count; on ≡ off native and scripted) are the slow and train tiers':
 * `deriveLevelWorldLogic.latchSandwich.slow.test.js`, `deriveLevelWorldLogic.latchSandwich.train.test.js`.
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveEntryLogic, latchSandwich, nativeReachUnder } from './deriveLevelWorldLogic.js';
import { latchEvents, regionItems, regionTargets, reachedTarget } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES } from './deriveLevelWorldLogic.fixture.js';

const EV = 'Latch L pressed';

/**
 *   #  wall   P entrance   G goal (an item on the cell)   L latching button (holds sw_L)   D door (sw_L)
 *   a  door that needs item A   b  door that needs item B
 */
function room(rows) {
    const at = (ch) => {
        const out = [];
        rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push({ x, y }); }));
        return out;
    };
    return {
        width: rows[0].length,
        height: rows.length,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
        entrance: at('P')[0],
        obstacles: [...at('D').map((c) => ({ ...c, id: 'door' })), ...at('a').map((c) => ({ ...c, id: 'door_a' })),
            ...at('b').map((c) => ({ ...c, id: 'door_b' }))],
        items: at('G').map((c) => ({ ...c, id: 'goal' })),
        obstacleLib: {
            door: { id: 'door', name: 'door', clear_set: [['sw_L']] },
            door_a: { id: 'door_a', name: 'door a', clear_set: [['A']] },
            door_b: { id: 'door_b', name: 'door b', clear_set: [['B']] },
        },
        buttons: at('L').map((c) => ({ ...c, id: 'button_L' })),
        buttonLib: { button_L: { kind: 'button', holds: 'sw_L', latch: { event: EV } } },
    };
}

// The latch opens a dead end (its own pocket); the goal is behind A then B. Every point holding only one of A, B is
// skipped: its probe (that point + the latch event) cannot take the goal, and the press is already covered at [].
const SERIES = ['##########', '#P.L.ab.G#', '###D######', '###.######', '##########'];
// The latch's door IS the way to the goal; A opens a side pocket that holds nothing.
const GATED = ['#########', '#P.L.D.G#', '##a######', '##.######', '#########'];
// The latch is sealed (nothing presses it this visit): the goal needs the CARRIED event.
const SEALED = ['########', '#P..DG##', '######L#', '########'];
const ROOMS = { series: SERIES, gated: GATED, sealed: SEALED };

const derive = (w, opts) => {
    const r = deriveEntryLogic(w, null, HELPERS, opts);
    return { out: JSON.stringify({ items: r.items, levels: [...r.levels], targets: r.targets }), engine: r.engine };
};

describe('latch sandwich — gadget rooms: prune on ≡ prune off, and it skips', () => {
    for (const [name, rows] of Object.entries(ROOMS)) {
        for (const native of [true, false]) {
            it(`${name} room, ${native ? 'native' : 'scripted'}: on ≡ off byte for byte`, () => {
                const w = deserializeMazeWorld(room(rows));
                expect(latchEvents(w).map((l) => l.event)).toEqual([EV]);
                const on = derive(w, { native });
                const off = derive(w, { native, latchSandwich: false });
                expect(on.out).toBe(off.out);
                expect(off.engine.skipped).toBe(0);
            });
        }
    }
    it('the series room really skips (non-vacuous): 3 of its 8 points, 5 searches against 8 (measured)', () => {
        const w = deserializeMazeWorld(room(SERIES));
        expect(regionItems(w)).toEqual(['A', 'B', EV]);
        const on = derive(w, { native: true });
        const off = derive(w, { native: true, latchSandwich: false });
        expect([on.engine.skipped, on.engine.searches, off.engine.searches]).toEqual([3, 5, 8]);
    });
});

describe("latch sandwich — a latch's OWN event target is probed without its event", () => {
    // Called directly: through the derive the branch is unreachable today (the docblock of `latchSandwich` says why).
    // MUTANT (measured red here): drop the own-event exclusion — the probe U = [] ∪ {EV} holds the press's own event, where
    // `reachedTarget` is false by definition, so the sandwich would skip [] although [] takes the press.
    const w = deserializeMazeWorld(room(SERIES));
    const press = regionTargets(w).find((t) => t.event === EV);
    const memo = new Map();
    const reachOf = (set) => { const k = set.join('|'); if (!memo.has(k)) memo.set(k, nativeReachUnder(w, set)); return memo.get(k); };
    const sandwich = latchSandwich(w, reachOf);
    const takenAt = (r, u) => reachedTarget(r, press, u, w);
    it('[] takes the press, so [] is not skipped for it', () => {
        expect(takenAt(reachOf([]), [])).toBe(true);
        expect(sandwich([], press, takenAt)).toBe(false);
    });
    it('a point HOLDING the event never takes its press (skipped for it without a search)', () => {
        expect(sandwich([EV], press, () => { throw new Error('searched'); })).toBe(true);
    });
});

describe('latch sandwich — the unproven case is refused by name', () => {
    const armed = () => {
        const w = deserializeMazeWorld(room(SERIES));
        return { ...w, trapLib: { arrows: { kind: 'arrow', active: 'sw_L', fires: 'while_active' } } };
    };
    it('a latch whose held token arms a trap throws, naming the latch, the token and the trap', () => {
        expect(() => deriveEntryLogic(armed(), null, HELPERS, { native: true }))
            .toThrow('latch sandwich: button_L latches the token (sw_L) that arms trap arrows');
    });
    it('(control) with the prune off the same world derives, and a trap on another token is not refused', () => {
        expect(() => deriveEntryLogic(armed(), null, HELPERS, { native: true, latchSandwich: false })).not.toThrow();
        const other = { ...armed(), trapLib: { arrows: { kind: 'arrow', active: 'sw_X', fires: 'while_active' } } };
        expect(() => deriveEntryLogic(other, null, HELPERS, { native: true })).not.toThrow();
    });
});

describe('latch sandwich — a provable no-op on the committed preset', () => {
    it('no payload of seedling_playthrough_maze lays a latch, so no world has a latch event and the prune never runs', () => {
        const payloads = Object.values(RULES.preset_sidecars['1']).map((s) => s.playable_payload).filter(Boolean);
        expect(payloads.length).toBeGreaterThan(50);
        const latching = payloads.flatMap((p) => Object.entries(p.buttonLib ?? {}).filter(([, b]) => b.latch).map(([id]) => id));
        expect(latching).toEqual([]);
        const withEvents = payloads.map((p) => deserializeMazeWorld(p)).filter((w) => latchEvents(w).length > 0);
        expect(withEvents.length).toBe(0);
    });
});
