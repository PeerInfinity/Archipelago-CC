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

const room = (seed, seedlingGen) => generateGenRoom({ region_id: 'req', exits: [{ exit_id: 'a' }],
    size: { width: 10, height: 10 }, rng: createRng(seed), params: { seedlingGen } }).world;

describe('⛓⛓ the `require` knob — absent is byte-identical, given is honoured', () => {
    it('the default is the empty string, and an absent knob adds NO `require` to `generation`', () => {
        expect(GEN_ROOM_DEFAULTS.require).toBe('');
        const w = room(4, { biome: 'post-sword' });
        expect('require' in w.generation).toBe(false);
        const empty = room(4, { biome: 'post-sword', require: '' });
        expect(JSON.stringify(empty)).toBe(JSON.stringify(w));
    }, 60000);

    it('⛔ `require=hasSword` REACHES the generator — a different room, recorded, met first draw', () => {
        const plain = room(4, { biome: 'post-sword' });
        const req = room(4, { biome: 'post-sword', require: 'hasSword' });
        expect(req.generation.require).toBe('hasSword');
        expect(req.generation.rerolls).toBe(0);
        // ⛔ MUTANT (d): a knob recorded and never passed would leave these EQUAL.
        expect(JSON.stringify(req.record)).not.toBe(JSON.stringify(plain.record));
    }, 60000);

    it('a draw that misses the directive is RE-ROLLED, and says why', () => {
        const req = room(3, { biome: 'post-sword', require: 'hasSword' });
        expect(req.generation.rerolls).toBeGreaterThan(0);
        expect(req.generation.rerollCause).toBe(GEN_ROOM_REROLL_CAUSES.require);
    }, 120000);

    it('⛔ a directive no draw can meet is REFUSED BY NAME after the budget — never spun', () => {
        expect(() => room(1, { biome: 'post-shield', require: 'hasShield' }))
            .toThrow(/asked to REQUIRE \[hasShield\] and no draw met the directive in 8 re-roll\(s\)/);
    }, 120000);

    it('⛔ a malformed spec is a BAD KNOB, through the CLI\'s one parser', () => {
        expect(() => room(1, { biome: 'post-sword', require: 'hasSword,,' }))
            .toThrow(/knob `require` = "hasSword,," is not usable — .*EMPTY entry/);
    });

    /** ⛔ Measured at W4: before this rule a resolution refusal was RE-ROLLED 8
     *  times (~20 s) for a directive no draw can ever meet. */
    it('⛔ a directive refused at RESOLUTION is a bad knob at once — never re-rolled', () => {
        expect(() => room(1, { biome: 'post-sword', require: 'canSwim' }))
            .toThrow(/knob `require` = "canSwim" is not usable — no-element-needs-this-item/);
        expect(() => room(1, { biome: 'pre-sword', require: 'hasSword' }))
            .toThrow(/knob `require` = "hasSword" is not usable — the-biome-lacks-the-item/);
    }, 30000);

    it('the panel bag carries it ONLY when given', () => {
        expect('require' in buildSeedlingGenRegionParams({ params: {} }).seedlingGen).toBe(false);
        expect(buildSeedlingGenRegionParams({ params: { seedlingGenRequire: ' hasSword ' } })
            .seedlingGen.require).toBe('hasSword');
    });
});
