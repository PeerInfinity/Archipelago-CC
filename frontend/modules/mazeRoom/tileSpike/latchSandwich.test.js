/**
 * ⛓ LATCH SANDWICH (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then lay") — the push-tier pins of the prune in
 * `deriveLevelWorldLogic.js`: a lattice point is skipped when its upper probe U = Q ∪ {latch events} takes no uncovered target.
 *   - On GADGET ROOMS (memory `feedback_no_single_game_code_for_a_test`): prune on ≡ prune off, native and scripted, and the
 *     prune really skips there (a pin that never skips proves nothing). Mutant MEASURED red by this file: the own-event
 *     exclusion dropped (a latch's own event target probed holding its event) loses the press's minimal set.
 *   - A latch whose held token arms a TRAP is refused by name (holding its event arms something: not proven monotone).
 *   - The committed `seedling_playthrough_maze` preset lays exactly L40's three latches (session tile-lay-l40-latches; the
 *     producer lays them from the rules' in-room press events): one payload, the cells `L40_LATCHES` checks.
 * The L40-laid pins (search count; on ≡ off native and scripted) are the slow and train tiers':
 * `deriveLevelWorldLogic.latchSandwich.slow.test.js`, `deriveLevelWorldLogic.latchSandwich.train.test.js`.
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveEntryLogic, latchSandwich, nativeReachUnder } from './deriveLevelWorldLogic.js';
import { latchEvents, regionItems, regionTargets, reachedTarget } from './deriveTileLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, L40_LATCHES, payloadLatches, unlayLatches } from './deriveLevelWorldLogic.fixture.js';

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
// The press is the room's only target, behind door a (it opens a dead end).
const PRESS_ONLY = ['#######', '#P.a.L#', '#####D#', '#######'];

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
    // ⛓ session tile-lay-l40-latches: 3/5/8 → 2/6/9. The press's own target is now priced WITHOUT its event (one more search
    // in each arm, of top \ {EV}); before, the top search (holding EV, so the latch pre-latched) read it unreachable.
    it('the series room really skips (non-vacuous): 2 of its 8 points, 6 searches against 9 (measured)', () => {
        const w = deserializeMazeWorld(room(SERIES));
        expect(regionItems(w)).toEqual(['A', 'B', EV]);
        const on = derive(w, { native: true });
        const off = derive(w, { native: true, latchSandwich: false });
        expect([on.engine.skipped, on.engine.searches, off.engine.searches]).toEqual([2, 6, 9]);
    });
    // ⛓ THE OWN-EVENT BRANCH THROUGH THE DERIVE (session tile-lay-l40-latches): the press is the room's only target, behind A.
    // At [EV] the press is uncovered and its own event is held: the branch skips the point. A press priced True_ (L40's three)
    // is covered at every point before the sandwich is asked, so there it never runs (the slow tier pins that, engine.ownEvent 0).
    for (const native of [true, false]) {
        it(`a press behind a door, ${native ? 'native' : 'scripted'}: the own-event branch decides one point (engine.ownEvent 1), on ≡ off`, () => {
            const w = deserializeMazeWorld(room(PRESS_ONLY));
            const on = derive(w, { native });
            const off = derive(w, { native, latchSandwich: false });
            expect(on.out).toBe(off.out);
            expect(JSON.parse(on.out).targets.map((t) => [t.id, t.minimal, t.unreachable])).toEqual([[`event:${EV}@5,1`, [['A']], false]]);
            expect(on.engine).toMatchObject({ skipped: 1, ownEvent: 1, searches: 3 });
            expect(off.engine).toMatchObject({ skipped: 0, searches: 5 });
        });
    }
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

describe('latch sandwich — the committed preset lays exactly L40\'s three latches (session tile-lay-l40-latches)', () => {
    it('one payload lays latches, level_40__r0c53: the cells L40_LATCHES names (a literal that only CHECKS the producer)', () => {
        const payloads = Object.entries(RULES.preset_sidecars['1']).filter(([, s]) => s.playable_payload);
        expect(payloads.length).toBeGreaterThan(50);
        const laying = payloads.filter(([, s]) => Object.values(s.playable_payload.buttonLib ?? {}).some((b) => b.latch)).map(([k]) => k);
        expect(laying).toEqual(['level_40__r0c53']);
        const laid = payloadLatches(RULES.preset_sidecars['1'].level_40__r0c53.playable_payload);
        expect(Object.fromEntries(Object.entries(laid).map(([g, { button, locks }]) => [g, { button, locks }])))
            .toEqual(JSON.parse(JSON.stringify(L40_LATCHES)));
        // each latch's event is an AP event location of the rules (the certifier's "no AP location" would name it otherwise)
        const apEvents = new Set(Object.values(RULES.regions['1']).flatMap((r) => r.locations.filter((l) => l.event).map((l) => l.name)));
        expect(Object.values(laid).every((l) => apEvents.has(l.event))).toBe(true);
        const withEvents = payloads.map(([, s]) => deserializeMazeWorld(s.playable_payload)).filter((w) => latchEvents(w).length > 0);
        expect(withEvents.length).toBe(1);
    });
    it('unlayLatches strips every latch (no level named): no payload lays one after it', () => {
        const bare = unlayLatches(RULES);
        const latching = Object.values(bare.preset_sidecars['1']).map((s) => s.playable_payload).filter(Boolean)
            .flatMap((p) => Object.values(p.buttonLib ?? {}).filter((b) => b.latch));
        expect(latching).toEqual([]);
    });
});
