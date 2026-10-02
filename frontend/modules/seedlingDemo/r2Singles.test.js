/**
 * r2Singles — ⛓⛓⛓ R2-swim D3(c): a TERRAIN death's kill-lock clear, computed
 * by the scratch layer at the body's REMOVAL.
 *
 * `r2-terrain-killlock` replays through its DECLARED clear (`at` 283), so its
 * tapeRunner rows cannot see where the run's own ledger would have put it.
 * This drives the same staging with the declaration REMOVED and the scratch
 * layer ON: the run writes the clear itself, and the game's crossing (t 285,
 * the committed recording) is the oracle. Ledgered at the destroy tick (t 173)
 * the clear lands ten ticks early and the crossing reads t 275.
 */

import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

describe('R2-swim D3(c): a terrain death opens L5\'s kill lock at the removal', () => {
    it('the scratch layer\'s own clear reproduces the game\'s crossing on t 285', () => {
        const tape = loadTape('r2-terrain-killlock');
        const staging = { ...stagingFromTape(tape), persistence: [] };
        const run = createRunForStaging(staging, atlasLevelSource(), { scratchPersistence: true });
        for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
        expect(run.scratchClears.map((c) => [c.level, c.tag, c.removedAt, c.declaredAt]))
            .toEqual([[5, 0, 183, 283]]);
        const game = loadExpectation('r2-terrain-killlock').stream.transitions;
        expect(run.transitions.map((x) => x.t)).toEqual(game.map((x) => x.t));
        expect(game.map((x) => x.t)).toEqual([285]);
    });
});
