/**
 * STRATEGY SWITCH r1 (D2) — `require:['strategy:<verb>']`: a directive may name a SOLVER STRATEGY, and its head is
 * derived from the element rows' `needsStrategy`, exactly as an item's is from `needs`.
 *   - the four gadgets: rockgate (break), shieldgate (touch), killgate + arena (kill), blockpocket (shove);
 *   - an item-only directive resolves exactly as before (the strategy branch is never asked);
 *   - a strategy no element declares (a budget rung `time`, a verb with no gadget) refuses `no-element-needs-this-item`;
 *   - a strategy head the biome cannot HOST (its own `needs` not granted) refuses `the-biome-lacks-the-item`;
 *   - an item and a strategy together intersect (`hasSword` + `strategy:kill` → killgate/arena).
 */
import { describe, expect, it } from 'vitest';

import {
    ELEMENT_TABLE, STRATEGIES_ELEMENTS_NEED, headsNeeding, parseItemRequireList, resolveRequireDirective,
    strategyOfRequire,
} from './elementSpec.js';

const POST_SWORD = { hasSword: true, hasShield: false, canSwim: false, hasFeather: false };
const PRE_SWORD = { hasSword: false, hasShield: false, canSwim: false, hasFeather: false };

describe('require — strategy entries (strategy switch r1, D2)', () => {
    it('the catalogue\'s strategies are read off `needsStrategy`; the gadgets carry theirs', () => {
        expect(STRATEGIES_ELEMENTS_NEED).toEqual(['break', 'burn', 'hold', 'keylock', 'kill', 'rope', 'shove', 'touch', 'weigh']);
        // ⛓ rope strategy — the rope gate carries `rope` (and heads ONLY strategy directives: `MEETS_STRATEGY_ONLY`)
        expect(headsNeeding('strategy:rope')).toEqual(['ropegate']);
        expect(headsNeeding('hasSword')).not.toContain('ropegate');
        // ⛓ strategy elements r2 — the key gate carries `keylock`
        expect(headsNeeding('strategy:keylock')).toEqual(['keygate']);
        // ⛓ strategy switch r2 — the burn gate carries `burn`
        expect(headsNeeding('strategy:burn')).toEqual(['burngate']);
        /** ⛓ strategy gadgets (r3) — the hold gate and the weigh gate. */
        expect(headsNeeding('strategy:hold')).toEqual(['holdgate']);
        expect(headsNeeding('strategy:weigh')).toEqual(['weighgate']);
        expect(headsNeeding('strategy:break')).toEqual(['rockgate']);
        expect(headsNeeding('strategy:touch')).toEqual(['shieldgate']);
        expect(headsNeeding('strategy:kill')).toEqual(['killgate', 'arena']);
        expect(headsNeeding('strategy:shove')).toEqual(['blockpocket']);
        expect(strategyOfRequire('strategy:kill')).toBe('kill');
        expect(strategyOfRequire('hasSword')).toBe(null);
        expect(parseItemRequireList('hasSword,strategy:kill')).toEqual(['hasSword', 'strategy:kill']);
        for (const [name, row] of Object.entries(ELEMENT_TABLE)) {
            if (row.needsStrategy) expect(Object.isFrozen(row.needsStrategy), name).toBe(true);
        }
    });

    it('an item directive resolves exactly as before', () => {
        const r = resolveRequireDirective({ require: ['hasSword'], items: POST_SWORD });
        expect(r.refused).toBe(null);
        expect(r.heads).toEqual(headsNeeding('hasSword'));
        expect(r.forced).toBe(true);
    });

    it('a strategy is forced to its head(s) where the biome can host them', () => {
        expect(resolveRequireDirective({ require: ['strategy:shove'], items: PRE_SWORD }).elements)
            .toEqual({ name: 'blockpocket' });
        expect(resolveRequireDirective({ require: ['strategy:kill'], items: POST_SWORD }).elements)
            .toEqual({ any: [{ name: 'killgate' }, { name: 'arena' }] });
        expect(resolveRequireDirective({ require: ['hasSword', 'strategy:kill'], items: POST_SWORD }).heads)
            .toEqual(['killgate', 'arena']);
    });

    it('refusals by name: no element declares it; the biome cannot host the head', () => {
        for (const v of ['time', 'pull', 'nope']) { // ⛓ r2: `burn` has a gadget now; rope strategy: `rope` too
            expect(resolveRequireDirective({ require: [`strategy:${v}`], items: POST_SWORD }).refused.reason)
                .toBe('no-element-needs-this-item');
        }
        expect(resolveRequireDirective({ require: ['strategy:time'], items: POST_SWORD }).refused.detail)
            .toMatch(/declares `needsStrategy` on "time"\. The strategies some element needs are \[break, burn, hold, keylock, kill, rope, shove, touch, weigh\]/);
        const r = resolveRequireDirective({ require: ['strategy:touch'], items: POST_SWORD });
        expect(r.refused.reason).toBe('the-biome-lacks-the-item');
        expect(r.refused.detail).toMatch(/shieldgate \[hasShield\]/);
        expect(resolveRequireDirective({ require: ['strategy:kill'], items: PRE_SWORD }).refused.reason)
            .toBe('the-biome-lacks-the-item');
    });
});
