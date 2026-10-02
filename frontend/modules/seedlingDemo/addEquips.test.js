/**
 * ⛓⛓ SWIM S1 — `levelRun.addEquips`: a later window's `equips`, handed over to a
 * resumed run the way its timed clears are (`addTimedClears`). The census's
 * whole-chain row asserts the END it buys (`census-seedling-campaign.mjs`: the
 * continuation ends in L30 where `r9-solve-32`'s own run ends, not in L32); these
 * rows pin the method's own contract.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const tape = (name) =>
    JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const runOf = (name) => createRunForStaging(stagingFromTape(parseTape(tape(name))), atlasLevelSource());

describe('levelRun.addEquips — a resumed window\'s equips, rebased by the caller', () => {
    it('refuses a malformed row by its shape', () => {
        const run = runOf('r9-solve-32');
        expect(() => run.addEquips([{ t: 'x', slot: 1 }])).toThrow(/a row is `\{t, slot\}`/);
        expect(() => run.addEquips([null])).toThrow(/a row is `\{t, slot\}`/);
    });

    it('refuses a tick already PASSED — an unrebased row could never fire', () => {
        const run = runOf('r9-solve-32');
        run.advance(new Set());
        run.advance(new Set());
        expect(() => run.addEquips([{ t: 1, slot: 1 }])).toThrow(/in the PAST — this run is at tick 2/);
    });

    it('refuses a tick that already equips (two writes of `Main.primary` on one observation)', () => {
        // `r9-solve-32` declares its own `{t: 840, slot: 1}` at construction.
        const run = runOf('r9-solve-32');
        expect(() => run.addEquips([{ t: 840, slot: 1 }])).toThrow(/tick 840 already equips slot 1/);
    });

    it('takes no rows as a no-op', () => {
        const run = runOf('r9-solve-32');
        expect(() => run.addEquips([])).not.toThrow();
        expect(() => run.addEquips(undefined)).not.toThrow();
    });
});
