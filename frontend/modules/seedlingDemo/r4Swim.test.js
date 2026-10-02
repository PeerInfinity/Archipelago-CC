/**
 * r4Swim — the R4-swim rows that a tape replay cannot carry.
 *
 * D1: the Owl's draw stream opens only in the room `botStart`'s reseed is
 * followed by — the boot room, on its first build. A run that WALKS into L112
 * paid the room it booted in (L113: one `Orb` draw, measured) and is refused
 * by name; without the split the premise refusal still answers first.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

describe('R4-swim D1: the Owl\'s stream opens only in the boot room, on its first build', () => {
    // R2's D4 hand drive (L113's south door into L112), with the split DECLARED,
    // so the premise refusal passes and the boot-room guard is what answers.
    const drive = (rng) => {
        const tape = loadTape('r2-two-teleporters');
        const run = createRunForStaging({ ...stagingFromTape(tape), rng }, atlasLevelSource());
        const keys = [...Array(30).fill('down'), ...Array(35).fill('right'), ...Array(100).fill('down')];
        let t = 0;
        try {
            for (const k of keys) { run.advance(new Set([k])); t += 1; }
        } catch (e) {
            return { t: t + 1, level: run.level, message: e.message };
        }
        return { t, level: run.level, message: null };
    };

    it('a split run that WALKS into L112 refuses by name on the entry tick, not silently at the wrong position', () => {
        const r = drive({ seed: 1, split: true, cosmetic: 0, fp: 0 });
        expect(r.t).toBe(123);
        expect(r.level).toBe(112);
        expect(r.message).toMatch(/the Owl's draw stream would open in level 112 after a boot in level 113/);
    });

    it('without the split the premise refusal still answers first, in its old words', () => {
        const r = drive({ seed: 1, split: false, cosmetic: 0, fp: 0 });
        expect(r.message).toMatch(/the Owl fight in level 112 needs `rng: \{ split: true \}`/);
    });
});
