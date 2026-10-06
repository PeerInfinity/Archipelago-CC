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
 *
 * D3: `previewStepper` from inside a knockback's i-frame. A preview is the
 * solver's ETA for the walk the drive then takes (⚖ §13.10a), so the oracle
 * is the drive itself: the same keys, from the same mid-knockback state, tick
 * by tick. Held `up` (away from `bob@64,64`), so no second contact lands in
 * the drive — a hit is the one thing a preview never models.
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
    /**
     * ⛓ fidelity BOBSOLDIER: NOT every bridged tag carries "Enemy" any more — `BobSoldier`'s list is `Mobile`'s base.
     * For it the flip DOES decide whether the turret blocks, and the stepper answers it from the stepped turret's
     * `solid` latch (`levelRun.enemyBoxStopsChaser`); so the invariant the refusal rests on is "Solid" for every tag.
     */
    it('every bridged tag\'s solids carry "Solid" (the corpse latch); every one but the BobSoldier\'s carries "Enemy" too', () => {
        const tags = bridgedChaserTags();
        expect(tags.length).toBeGreaterThan(0);
        for (const tag of tags) {
            expect(chaserSolids(tag), tag).toEqual(expect.arrayContaining(['Solid']));
            if (tag === 'bobsoldier') expect(chaserSolids(tag)).not.toContain('Enemy');
            else expect(chaserSolids(tag), tag).toEqual(expect.arrayContaining(['Enemy', 'Solid']));
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

describe('R4-swim D3: a preview started inside an i-frame is the drive', () => {
    const HIT_AFTER = 21;
    const AHEAD = 30;
    const mid = () => {
        const tape = loadTape('u11-facing-knockback');
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        for (let t = 0; t < HIT_AFTER; t += 1) run.advance(heldKeysAt(tape, t));
        return run;
    };

    it('the staging is mid-knockback: the facing parked DOWN, the knockback carrying the player UP', () => {
        const run = mid();
        expect(run.damage).toEqual({ hits: 1, hitsTimer: 18, directionFace: 3 });
        expect(run.state.vy).toBeLessThan(0);
    });

    it('facing, position and the recovery agree with the drive on every one of 30 ticks', () => {
        const live = mid();
        const step = live.previewStepper();
        const held = new Set(['up']);
        let st = live.state;
        const preview = [];
        for (let k = 0; k < AHEAD; k += 1) {
            st = step(st, held);
            preview.push({ x: st.x, y: st.y, direction: st.direction });
        }
        const drive = [];
        for (let k = 0; k < AHEAD; k += 1) {
            live.advance(held);
            drive.push({ x: live.state.x, y: live.state.y, direction: live.state.direction });
        }
        expect(preview).toEqual(drive);
        // The window really spans both halves: the parked facing (3) through
        // the i-frame, then the hand-back and steering north (1) after it.
        expect(drive[0].direction).toBe(3);
        expect(drive[AHEAD - 1].direction).toBe(1);
        expect(drive[AHEAD - 1].y).toBeLessThan(drive[17].y);
    });

    it('a preview OUTSIDE an i-frame carries no damage key — the 12c closure, unchanged', () => {
        const tape = loadTape('u11-facing-knockback');
        const run = createRunForStaging(stagingFromTape(tape), atlasLevelSource());
        for (let t = 0; t < 5; t += 1) run.advance(heldKeysAt(tape, t));
        const next = run.previewStepper()(run.state, new Set(['down']));
        expect(Object.getOwnPropertySymbols(next)).toEqual([]);
    });
});
