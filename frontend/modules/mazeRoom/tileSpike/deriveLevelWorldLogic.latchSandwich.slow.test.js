/**
 * ⛓ LATCH SANDWICH — the SEARCH-COUNT pin (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then lay"). L40 with its three
 * latches laid — the COMMITTED preset since session tile-lay-l40-latches (the producer lays them from the rules' in-room press
 * events) — derived natively, prune ON: a later change that silently disables the prune turns this red on push. The "not laid"
 * arm is `unlayLatches` (every latch stripped; ≡ the pre-lay payload byte for byte). Measured at the slice's base (main 06fe11dea5), native derive pass over `level_40__r0c53`'s world:
 *   laid, prune on: 283 searches / 634,702 states (1,770 points skipped)  ·  laid, prune off: 2,045 / 2,867,222  ·  not laid: 267.
 * MUTANTS this pin catches (each MEASURED red, the slice's record): the prune REMOVED (js-16's named mutant: 2,045 searches);
 * U = Q (no lift, so no skip: 2,045); the memo dropped (the probes re-searched: over the ceiling).
 * The ≡ (prune on ≡ off, native and scripted) is the train tier's: `deriveLevelWorldLogic.latchSandwich.train.test.js`.
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, unlayLatches, L40_REGIONS } from './deriveLevelWorldLogic.fixture.js';
import { deriveEntryLogic } from './deriveLevelWorldLogic.js';

const L40 = (rules) => deserializeMazeWorld(rules.preset_sidecars['1'].level_40__r0c53.playable_payload);
const L40_LAID_SEARCH_CEILING = 300;

describe('latch sandwich — L40 laid, native: the search count', () => {
    it(`the prune holds L40 laid to ≤ ${L40_LAID_SEARCH_CEILING} engine searches (measured 283; prune removed: 2,045)`, () => {
        const { engine } = deriveLevelWorldLogic(L40(RULES), HELPERS, { native: true });
        expect(engine.searches).toBeLessThanOrEqual(L40_LAID_SEARCH_CEILING);
        expect(engine.skipped).toBeGreaterThan(0);
    }, 120_000);
    it('L40 with every latch unlaid: the prune is a no-op — 0 skipped, the same 267 searches as prune off', () => {
        const bare = unlayLatches();
        const on = deriveLevelWorldLogic(L40(bare), HELPERS, { native: true });
        const off = deriveLevelWorldLogic(L40(bare), HELPERS, { native: true, latchSandwich: false });
        // ⛓ R-A4b: 328,476 → 376,330 states (+14.6%): `unlayLatches` strips the buttons but not L40's flag-8 BossLock, a sided opener
        // whose per-visit mark splits the search states. It adds no search (267), and this pin guards the prune's no-op, not a bound.
        expect(on.engine).toEqual({ searches: 267, states: 376_330, skipped: 0 });
        expect(off.engine).toEqual(on.engine);
    }, 120_000);
    // ⛓ THE PRESS TARGETS, PRICED (session tile-lay-l40-latches; the in-world event class, half (a)): each latch's own press
    // target is priced from top \ {its event}. Before, the top search (holding it: pre-latched) read every one unreachable.
    // Each prices True_ ([[]]) in its sub-region — reached without the lock it opens (rules-4's check) — so the empty set covers
    // every point before the sandwich is asked, and its own-event branch decides none here (engine.ownEvent 0; the gadget
    // room in `latchSandwich.test.js` is where it runs).
    it('L40\'s three presses are live and priced [[]] in their sub-regions (engine.ownEvent 0: True_ covers every point)', () => {
        const w = L40(RULES);
        const entries = L40_REGIONS.map((r) => [r, deriveEntryLogic(w, r, HELPERS, { native: true })]);
        const presses = entries.flatMap(([r, e]) => e.targets.filter((t) => t.event && t.event !== 'L40 flag 8: bosslock@480,352 cleared')
            .map((t) => [r, t.event, t.minimal, t.unreachable]));
        expect(presses).toEqual([
            ['level_40__r0c53', 'L40 flag 1: wandlock@176,80 cleared', [[]], false],
            ['level_40__r0c53', 'L40 flag 7: wandlock@208,128 cleared', [[]], false],
            ['level_40__r48c54', 'L40 flag 12: wandlock@480,560 cleared', [[]], false],
        ]);
        expect(entries.map(([, e]) => e.engine.ownEvent)).toEqual([0, 0, 0, 0, 0]);
    }, 120_000);
});
