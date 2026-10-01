/**
 * seedlingDemo/seedlingGenRoom — **THE `require` KNOB, THROUGH THE PIPELINE**
 * (seedling substrate S1, D4; plan §2.1 G-d).
 *
 * `GEN_ROOM_DEFAULTS.require` is the CLI's `--require=` grammar
 * (`elementSpec.parseItemRequireList`), handed to the generator only when
 * given. A draw whose directive the differential does not grade REQUIRED is
 * re-rolled (`rerollCause: 'require'`), within the per-size budget and with no
 * growth, and then refused BY NAME.
 *
 * ⛓ Subjects measured at S1's W4 (scratch `d4probe.mjs`): seed 4 at 10x10
 * post-sword meets `hasSword` on the FIRST draw (1.6 s) with a room that is not
 * the undirected one — which is what makes mutant (d) visible: a knob that
 * reaches `generation` and never reaches the generator leaves the room equal to
 * the undirected room, and the "a different room" row reds while every
 * byte-inert row stays green. `hasShield` on `post-shield` is refused after the
 * budget (~17 s): its without-arm THROWS in `execTouch` and grades WEAK (routed
 * to L16).
 */

import { describe, expect, it } from 'vitest';

import { GEN_ROOM_DEFAULTS, GEN_ROOM_REROLL_CAUSES, generateGenRoom } from './seedlingGenRoom.js';
import { buildSeedlingGenRegionParams } from '../flashPanel/flashSeedlingGenLibrary.js';
import { createRng } from '../shared/rng.js';

const room = (seed, seedlingGen, size = { width: 10, height: 10 }) => generateGenRoom({
    region_id: 'req', exits: [{ exit_id: 'a' }], size, rng: createRng(seed), params: { seedlingGen } }).world;

describe('⛓⛓ the `require` knob — absent is byte-identical, given is honoured', () => {
    // ⚠ The two seed-4 rows build a post-sword room TWICE each. Since the biome
    // defaults fold (swim U8) the post-sword default draw at seed 4 is `arena`,
    // and the certification measures 51 s ALONE at the U5+U7+U8 merge head —
    // the old 60 s bound timed out under the suite's load. 180 s is the
    // measured cost ×3; the seed stays, because the next row shares it.
    it('the default is the empty string, and an absent knob adds NO `require` to `generation`', () => {
        expect(GEN_ROOM_DEFAULTS.require).toBe('');
        const w = room(4, { biome: 'post-sword' });
        expect('require' in w.generation).toBe(false);
        const empty = room(4, { biome: 'post-sword', require: '' });
        expect(JSON.stringify(empty)).toBe(JSON.stringify(w));
    }, 180000);

    it('⛔ `require=hasSword` REACHES the generator — a different room, recorded, met first draw', () => {
        const plain = room(4, { biome: 'post-sword' });
        const req = room(4, { biome: 'post-sword', require: 'hasSword' });
        expect(req.generation.require).toBe('hasSword');
        expect(req.generation.rerolls).toBe(0);
        // ⛔ MUTANT (d): a knob recorded and never passed would leave these EQUAL.
        expect(JSON.stringify(req.record)).not.toBe(JSON.stringify(plain.record));
    }, 180000);

    /** ⛓ SEEDLING SWIM U6 — the seed moved 3 → 8: with the strike's dwell priced
     *  and `stepToward` scoring the diagonals, seed 3's FIRST draw meets
     *  `hasSword` (rerolls 0, measured). Over seeds 1–10, seeds 1, 5, 8 and 9
     *  still re-roll by `require`; 8 is the cheapest (one re-roll, ~0.4 s). */
    it('a draw that misses the directive is RE-ROLLED, and says why', () => {
        const req = room(8, { biome: 'post-sword', require: 'hasSword' });
        expect(req.generation.rerolls).toBeGreaterThan(0);
        expect(req.generation.rerollCause).toBe(GEN_ROOM_REROLL_CAUSES.require);
    }, 120000);

    /** ⛓ The example moved at the L16 merge (2026-09-27): at 10×10 `hasShield` was
     *  "no draw can meet" only while `execTouch` THREW without the shield (the
     *  tripwire in `procgenDoorElements.test.js`); once L16's refusal landed the
     *  directive is MET at 10×10. A 5×4 room cannot seat a `shieldgate` (no cut
     *  with a west approach) in any of the 8 re-rolls — measured 302 ms — so the
     *  BUDGET path keeps a witness that no future solver line can satisfy. */
    it('⛔ a directive no draw can meet is REFUSED BY NAME after the budget — never spun', () => {
        expect(() => room(1, { biome: 'post-shield', require: 'hasShield' }, { width: 5, height: 4 }))
            .toThrow(/asked to REQUIRE \[hasShield\] and no draw met the directive in 8 re-roll\(s\)/);
    }, 120000);

    it('⛔ a malformed spec is a BAD KNOB, through the CLI\'s one parser', () => {
        expect(() => room(1, { biome: 'post-sword', require: 'hasSword,,' }))
            .toThrow(/knob `require` = "hasSword,," is not usable — .*EMPTY entry/);
    });

    /** ⛔ Measured at W4: before this rule a resolution refusal was RE-ROLLED 8
     *  times (~20 s) for a directive no draw can ever meet. */
    it('⛔ a directive refused at RESOLUTION is a bad knob at once — never re-rolled', () => {
        // ⛓ swim S1: `canSwim` is gated now (the water gate) — the feather is not.
        // ⛓ swim T2: the feather is gated now (the waterfall gate) — the dark suit is not.
        expect(() => room(1, { biome: 'post-sword', require: 'hasDarkSuit' }))
            .toThrow(/knob `require` = "hasDarkSuit" is not usable — no-element-needs-this-item/);
        expect(() => room(1, { biome: 'pre-sword', require: 'hasSword' }))
            .toThrow(/knob `require` = "hasSword" is not usable — the-biome-lacks-the-item/);
    }, 30000);

    it('the panel bag carries it ONLY when given', () => {
        expect('require' in buildSeedlingGenRegionParams({ params: {} }).seedlingGen).toBe(false);
        expect(buildSeedlingGenRegionParams({ params: { seedlingGenRequire: ' hasSword ' } })
            .seedlingGen.require).toBe('hasSword');
    });
});
