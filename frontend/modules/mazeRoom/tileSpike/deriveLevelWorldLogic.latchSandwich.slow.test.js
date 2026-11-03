/**
 * ⛓ LATCH SANDWICH — the SEARCH-COUNT pin (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then lay"). L40 with its three
 * latches laid (`layL40Latches`, the lay the prune is for) derived natively, prune ON: a later change that silently disables the
 * prune turns this red on push. Measured at the slice's base (main 06fe11dea5), native derive pass over `level_40__r0c53`'s world:
 *   laid, prune on: 283 searches / 634,702 states (1,770 points skipped)  ·  laid, prune off: 2,045 / 2,867,222  ·  not laid: 267.
 * MUTANTS this pin catches (each MEASURED red, the slice's record): the prune REMOVED (js-16's named mutant: 2,045 searches);
 * U = Q (no lift, so no skip: 2,045); the memo dropped (the probes re-searched: over the ceiling).
 * The ≡ (prune on ≡ off, native and scripted) is the train tier's: `deriveLevelWorldLogic.latchSandwich.train.test.js`.
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, layL40Latches } from './deriveLevelWorldLogic.fixture.js';

const L40 = (rules) => deserializeMazeWorld(rules.preset_sidecars['1'].level_40__r0c53.playable_payload);
const L40_LAID_SEARCH_CEILING = 300;

describe('latch sandwich — L40 laid, native: the search count', () => {
    it(`the prune holds L40 laid to ≤ ${L40_LAID_SEARCH_CEILING} engine searches (measured 283; prune removed: 2,045)`, () => {
        const { engine } = deriveLevelWorldLogic(L40(layL40Latches()), HELPERS, { native: true });
        expect(engine.searches).toBeLessThanOrEqual(L40_LAID_SEARCH_CEILING);
        expect(engine.skipped).toBeGreaterThan(0);
    }, 120_000);
    it('L40 as committed (no latch): the prune is a no-op — 0 skipped, the same 267 searches as prune off', () => {
        const on = deriveLevelWorldLogic(L40(RULES), HELPERS, { native: true });
        const off = deriveLevelWorldLogic(L40(RULES), HELPERS, { native: true, latchSandwich: false });
        expect(on.engine).toEqual({ searches: 267, states: 328_476, skipped: 0 });
        expect(off.engine).toEqual(on.engine);
    }, 120_000);
});
