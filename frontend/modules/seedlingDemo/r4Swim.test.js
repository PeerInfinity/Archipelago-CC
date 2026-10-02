/**
 * r4Swim — the R4-swim rows that a tape replay cannot carry.
 *
 * D1: the Owl's draw stream opens only in the room `botStart`'s reseed is
 * followed by — the boot room, on its first build. A run that WALKS into L112
 * paid the room it booted in (L113: one `Orb` draw, measured) and is refused
 * by name; without the split the premise refusal still answers first.
 *
 * D2: L40's IceTurret beside the bridged chasers. The witness tape
 * (`r4-iceturret-bobs`) replays through tapeRunner; what it cannot show is the
 * DERIVATION the refusal was replaced by — both sides of the turret's flip on
 * every bridged chaser's own `solids`.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { heldKeysAt } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { bridgedChaserTags, chaserSolids } from './chasers.js';

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

describe('R4-swim D2: the IceTurret\'s flip is invisible to every bridged chaser', () => {
    it('every bridged tag\'s solids carry BOTH "Enemy" (alive) and "Solid" (the corpse latch)', () => {
        const tags = bridgedChaserTags();
        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) {
            expect(chaserSolids(tag), tag).toEqual(expect.arrayContaining(['Enemy', 'Solid']));
        }
    });

    it('L40 with damage on builds and steps both families from boot', () => {
        const tape = loadTape('r4-iceturret-bobs');
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
        expect(run.chaserTerrainDeaths.map((d) => `${d.id}:${d.cause}@${d.t}`))
            .toEqual(['bob@352,448:pit@53', 'bob@352,416:pit@67']);
        expect(run.volleys.map((v) => v.t)).toEqual([4, 49, 94, 139]);
    });
});
