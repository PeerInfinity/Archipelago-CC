/**
 * ⛓ LATCH SANDWICH — prune ON ≡ prune OFF on L40 with its latches LAID (the committed preset since session tile-lay-l40-latches) (session tile-latch-prune; ⚖ Robert 2026-11-03 "B: Prune, then
 * lay"). TRAIN tier (⚖ Robert 2026-11-02 P3): the prune-off native pass is ~38 s on CI and the scripted pass ~130 s, too heavy for push.
 * Byte for byte: the derive pass over `level_40__r0c53`'s world (items, levels, every pair's minimal sets and witness plans) and the
 * entry pricing of its regions (`L40_REGIONS`, read off the atlas; seven since R-A5) (every target's minimal sets, witnesses,
 * unreachable flag).
 *   - NATIVE, prune on ≡ prune off; and the prune removes at least half the searches, both counts derived (js-16's named mutant:
 *     the prune REMOVED makes the two counts equal and reds the ratio; ⛓ R-A5);
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
    // ⛓ R-A5 (⚖ design-4, 2026-11-11): the prune's GUARD is relative, both numbers derived here: laid ≤ ½ × prune-off (measured
    // 571 / 2,931 = 0.19 at R-A5's arm c187b8c594, 283 / 2,045 = 0.14 before; a disabled prune gives 1.0). It replaces the literal
    // 2,045 → ≤ 300 (tile-latch-prune's own numbers, 4386cdda2d), which L40's split (five regions → seven) outgrew. The absolute
    // cost tripwire (≤ 700) is the slow tier's.
    it('native: byte-identical, and the prune removes at least half the searches (both counts derived)', () => {
        off = derive({ native: true, latchSandwich: false });
        const on = derive({ native: true });
        expect(on.out).toBe(off.out);
        expect(on.pass.searches * 2).toBeLessThanOrEqual(off.pass.searches);
        expect(on.pass.searches).toBeLessThanOrEqual(700);
        expect(on.pass.skipped).toBeGreaterThan(0);
    }, 300_000);
    it('scripted, prune on: byte-identical to the native prune-off answer', () => {
        off ??= derive({ native: true, latchSandwich: false });
        expect(derive({ native: false }).out).toBe(off.out);
    }, 900_000);
});
