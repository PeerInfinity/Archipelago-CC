/**
 * ⛓ LATCH SANDWICH — prune ON ≡ prune OFF on L40 with its latches LAID (the committed preset since session tile-lay-l40-latches) (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then
 * lay"). TRAIN tier (⚖ Robert 2026-11-02 P3): the prune-off native pass is ~38 s on CI and the scripted pass ~130 s, too heavy for push.
 * Byte for byte: the derive pass over `level_40__r0c53`'s world (items, levels, every pair's minimal sets and witness plans) and the
 * entry pricing of its five regions (every target's minimal sets, witnesses, unreachable flag).
 *   - NATIVE, prune on ≡ prune off; and the before → after count, 2,045 → ≤ 300 engine searches (js-16's named mutant: the prune
 *     REMOVED makes the two counts equal and reds the ceiling);
 *   - SCRIPTED (`scriptedStep` + the helper bodies), prune on ≡ the native prune-off answer (scripted ≡ native is the parity suites').
 * The search-count pin alone runs on push: `deriveLevelWorldLogic.latchSandwich.slow.test.js`.
 *
 *   npm run test:unit:train -- frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.latchSandwich.train.test.js
 */
import { describe, it, expect } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { deriveLevelWorldLogic, deriveEntryLogic } from './deriveLevelWorldLogic.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, L40_REGIONS } from './deriveLevelWorldLogic.fixture.js';

const WORLD = () => deserializeMazeWorld(RULES.preset_sidecars['1'].level_40__r0c53.playable_payload);
/** The whole answer, in one string; `engine` = the summed real work. */
function derive(opts) {
    const w = WORLD();
    const pass = deriveLevelWorldLogic(w, HELPERS, opts);
    const entries = L40_REGIONS.map((r) => deriveEntryLogic(w, r, HELPERS, opts));
    return {
        out: JSON.stringify({
            items: pass.items, levels: [...pass.levels], pairs: pass.pairs,
            entries: entries.map((e) => ({ items: e.items, levels: [...e.levels], targets: e.targets })),
        }),
        pass: pass.engine,
    };
}

describe('latch sandwich — L40 laid: prune on ≡ prune off', () => {
    let off = null;
    it('native: byte-identical, and 2,045 → ≤ 300 searches (the prune removed equals the two)', () => {
        off = derive({ native: true, latchSandwich: false });
        const on = derive({ native: true });
        expect(on.out).toBe(off.out);
        expect(off.pass.searches).toBe(2045);
        expect(on.pass.searches).toBeLessThanOrEqual(300);
        expect(on.pass.skipped).toBeGreaterThan(0);
    }, 300_000);
    it('scripted, prune on: byte-identical to the native prune-off answer', () => {
        off ??= derive({ native: true, latchSandwich: false });
        expect(derive({ native: false }).out).toBe(off.out);
    }, 900_000);
});
