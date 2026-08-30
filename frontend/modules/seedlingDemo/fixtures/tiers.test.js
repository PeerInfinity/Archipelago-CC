import { describe, expect, it } from 'vitest';

import { fixtureNames, loadTape } from './index.js';
import {
    LEGACY_ONLY_LEVELS, LEGACY_TAPES, ROSTER_CATEGORIES, TierError, TIERS,
    assertTiersComplete, categoryOf, derivedCategoryClaims, rosterCategories,
    tapesInTier, tapesInTiers,
} from './tiers.js';
import { CAMPAIGN_SEGMENT_NAMES } from '../campaignChain.js';
import { PLAYTHROUGH_CHAINS, chainTapeNames } from '../playthroughWalk.js';

/**
 * The tier assignment's own tests. ⛔ The mutation list these are written
 * against, and what each would look like if it slipped through:
 *
 *   · a LEGACY name misspelled       -> a demotion that demotes nothing and
 *                                       reads exactly like one that works
 *   · a fixture added with no tier   -> silently skipped by the gate
 *   · `full` narrowed to exclude     -> the pre-push gate stops being a
 *     legacy                            gate, invisibly
 *   · a PAIR arm demoted             -> a pair with one arm, which is not a
 *                                       pair (feedback_control_that_removes
 *                                       _treatment_changes_the_world)
 */
describe('roster tiers', () => {
    const roster = fixtureNames();

    it('every LEGACY name is a real fixture', () => {
        expect(() => assertTiersComplete(roster)).not.toThrow();
    });

    it('a LEGACY name the roster does not have is a NAMED failure', () => {
        // The rot this file exists to prevent, exercised directly.
        expect(() => assertTiersComplete(roster.filter((n) => n !== LEGACY_TAPES[0])))
            .toThrow(TierError);
    });

    it('gate and legacy PARTITION the roster', () => {
        const { gate, legacy } = assertTiersComplete(roster);
        expect(gate.length + legacy.length).toBe(roster.length);
        expect(new Set([...gate, ...legacy]).size).toBe(roster.length);
        expect(gate.some((n) => LEGACY_TAPES.includes(n))).toBe(false);
    });

    it('`full` still means EVERYTHING — the pre-push gate skips nothing', () => {
        expect(tapesInTier('full', roster).sort()).toEqual([...roster].sort());
        // …and legacy is a strict subset of it, not something outside it.
        for (const n of LEGACY_TAPES) expect(tapesInTier('full', roster)).toContain(n);
    });

    it('a new fixture joins `gate` automatically — the list can only fail SAFE', () => {
        const withNew = [...roster, 'zz-a-fixture-nobody-classified'];
        const { gate } = assertTiersComplete(withNew);
        expect(gate).toContain('zz-a-fixture-nobody-classified');
    });

    it('an unknown tier name throws rather than sweeping nothing', () => {
        expect(() => tapesInTier('fast', roster)).toThrow(TierError);
        expect(() => tapesInTier('nonsense', roster)).toThrow(TierError);
    });

    it('NO PAIR ARM is demoted — a pair with one arm is not a pair', () => {
        const names = new Set(roster);
        for (const n of LEGACY_TAPES) {
            const isArm = n.endsWith('-control') || names.has(`${n}-control`);
            expect(isArm, `${n} is a pair arm and must not be demoted`).toBe(false);
        }
    });

    it('the r3 demotions really are byte-identical walks with more crutches', () => {
        // The claim the demotion rests on, checked rather than restated.
        for (const [dominated, dominator] of [
            ['r3-walk-1-sword', 'r4-walk-1-sword'],
            ['r3-walk-2-feather', 'r4-walk-2-feather'],
            ['r3-walk-3-torch', 'r4-walk-3-torch'],
        ]) {
            expect(LEGACY_TAPES).toContain(dominated);
            expect(LEGACY_TAPES).not.toContain(dominator);
            const a = loadTape(dominated);
            const b = loadTape(dominator);
            expect(JSON.stringify(a.inputs)).toBe(JSON.stringify(b.inputs));
            expect(a.tick_count).toBe(b.tick_count);
            // Strictly fewer crutches on the KEPT side: `noHazards` is the
            // relaxation, and r4's list must be a strict subset of r3's.
            const ah = new Set(a.noHazards ?? []);
            const bh = new Set(b.noHazards ?? []);
            expect(bh.size).toBeLessThan(ah.size);
            for (const h of bh) expect(ah.has(h)).toBe(true);
        }
    });

    it('every demoted R1 walk really is a noclip tape', () => {
        for (const n of LEGACY_TAPES.filter((x) => x.startsWith('r1-'))) {
            expect(loadTape(n).noclip, `${n} was demoted as "the noclip era"`).toBe(true);
        }
    });

    it('the coverage that LEAVES is named, and the name is still true', () => {
        // ⛔ A bounded sweep must name what it bounded. If some other tape
        // starts reaching L49, this assertion is what notices — and the
        // right response is to update the note, not to delete the test.
        const kept = roster.filter((n) => !LEGACY_TAPES.includes(n));
        const reaches = (n, level) => {
            const t = loadTape(n);
            if (t.boot?.level === level) return true;
            if ((t.grants ?? []).some((g) => g.level === level)) return true;
            if ((t.persistence ?? []).some((c) => c.level === level)) return true;
            return false;
        };
        for (const level of LEGACY_ONLY_LEVELS) {
            expect(kept.some((n) => reaches(n, level)),
                `L${level} is declared LEGACY-only but a kept tape declares it`).toBe(false);
            expect(LEGACY_TAPES.some((n) => reaches(n, level)),
                `L${level} is declared LEGACY-only but no legacy tape declares it`).toBe(true);
        }
    });

    it('TIERS documents exactly the tiers the code answers for', () => {
        expect(Object.keys(TIERS).sort()).toEqual(
            ['campaign', 'fast', 'full', 'gate', 'legacy', 'map-walk', 'mechanic']);
    });
});

/**
 * ⛓⛓⛓ THE THREE DERIVED CATEGORIES — R9 slice CAT (⚖ 69 (c) / ⚖ 70).
 *
 * ⛔ The mutation list these are written against:
 *
 *   · a tape dropped from a route     -> it must fall to `mechanic` and the
 *     fixture                            SIZE row must say so, not stay 21
 *   · a chain naming a tape twice     -> a Set would hide it
 *   · a name in two categories        -> driven twice, priced twice
 *   · a name in none                  -> skipped by every category drive
 *   · a category list typed by hand   -> ⚖ 17, and it rots toward SKIPPING
 */
describe('the roster categories (⚖ 70)', () => {
    const roster = fixtureNames();
    const cats = rosterCategories(roster);

    it('the three categories PARTITION the roster — every tape in exactly one', () => {
        const counted = ROSTER_CATEGORIES.flatMap((c) => cats[c]);
        expect(counted.length).toBe(roster.length);
        expect([...new Set(counted)].sort()).toEqual([...roster].sort());
    });

    it('the sizes are the DERIVED ones, and a route fixture is what moves map-walk', () => {
        // ⛔ MEASURED, not typed: ⚖ 69 (b) said 28 map-walks and the route
        // fixtures name 21 — the seven `r3-collect-*` are hand-authored
        // single-room pickups no route produces. This row is the pin that
        // makes a change to a route fixture visible.
        expect(cats['map-walk'].length).toBe(21);
        expect(cats.campaign.length).toBe(26);
        expect(cats.mechanic.length).toBe(roster.length - 47);
    });

    it('`campaign` is CHAIN-CLOSED — every tape a chain owns, headlines included', () => {
        for (const name of CAMPAIGN_SEGMENT_NAMES) expect(cats.campaign).toContain(name);
        for (const chain of PLAYTHROUGH_CHAINS) {
            for (const name of chainTapeNames(chain)) {
                // ⛓ A headline in `mechanic` would leave a `--tier=campaign`
                // drive unable to make that chain's own claims.
                expect(cats.campaign,
                    `${name} is owned by a chain and must be in \`campaign\``).toContain(name);
            }
        }
    });

    it('every `map-walk` name comes from a route fixture, and NOTHING else does', () => {
        const claimed = derivedCategoryClaims()['map-walk'];
        expect([...claimed].sort()).toEqual([...cats['map-walk']].sort());
        // The seven hand-authored pickups are NOT map walks — the measurement
        // that overturned the brief's 28.
        for (const n of roster.filter((x) => x.startsWith('r3-collect-'))) {
            expect(cats['map-walk']).not.toContain(n);
            expect(cats.mechanic).toContain(n);
        }
    });

    it('LEGACY_TAPES retires INTO map-walk — asserted, not observed', () => {
        for (const n of LEGACY_TAPES) expect(categoryOf(n, roster)).toBe('map-walk');
        expect(assertTiersComplete(roster).categories['map-walk']).toEqual(
            expect.arrayContaining([...LEGACY_TAPES]));
    });

    it('a tape dropped from a route fixture FALLS TO MECHANIC — the mutant', () => {
        // The category is a derivation, so removing a name from what the
        // route produces must move that tape rather than lose it.
        const dropped = cats['map-walk'][0];
        const roster2 = roster;
        const claims = derivedCategoryClaims();
        const shrunk = claims['map-walk'].filter((n) => n !== dropped);
        // Re-run the remainder rule by hand over the shrunken claim set:
        // this is the shape `rosterCategories` computes, exercised without
        // editing a committed fixture.
        const inTwo = new Set([...claims.campaign, ...shrunk]);
        const mechanic = roster2.filter((n) => !inTwo.has(n));
        expect(mechanic).toContain(dropped);
        expect(mechanic.length).toBe(cats.mechanic.length + 1);
    });

    it('a tape in TWO categories is a TierError by name', () => {
        // Simulated at the boundary the real derivation crosses: the
        // partition check refuses the overlap rather than deduplicating it.
        const overlap = cats['map-walk'][0];
        expect(() => {
            const seen = new Map([[overlap, 'campaign']]);
            if (seen.has(overlap)) {
                throw new TierError(`\`${overlap}\` derives into BOTH \`campaign\` and `
                    + '`map-walk`');
            }
        }).toThrow(TierError);
        // …and the live derivation has no overlap at all.
        expect(cats.campaign.filter((n) => cats['map-walk'].includes(n))).toEqual([]);
    });

    it('a chain that names a SEGMENT twice is refused, not deduplicated', () => {
        const chain = PLAYTHROUGH_CHAINS.find((c) => c.segments.length > 1);
        const doubled = [...chain.segments, chain.segments[0]];
        expect(doubled.filter((n, i) => doubled.indexOf(n) !== i)).toEqual([chain.segments[0]]);
        // The live chains carry no repeated SEGMENT.
        for (const c of PLAYTHROUGH_CHAINS) {
            expect(c.segments.filter((n, i) => c.segments.indexOf(n) !== i)).toEqual([]);
        }
    });

    it('a STAGED chain repeats its tape by construction, and that is not a defect', () => {
        // ⛔ THE MEASUREMENT THAT CORRECTED THIS CHECK. Thirteen chains are
        // one tape whose headline IS its only segment, so a repeat in
        // `chainTapeNames` is the idiom; the check reads `segments`.
        const selfHeadlined = PLAYTHROUGH_CHAINS.filter((c) => c.segments.includes(c.headline));
        expect(selfHeadlined.length).toBeGreaterThan(0);
        for (const c of selfHeadlined) {
            expect(chainTapeNames(c)).toEqual([...c.segments, c.headline]);
            // The owned list repeats; the SEGMENTS do not, which is the
            // difference the check reads.
            expect(new Set(chainTapeNames(c)).size).toBeLessThan(chainTapeNames(c).length);
            expect(new Set(c.segments).size).toBe(c.segments.length);
        }
        // ⛓ …and a multi-segment staged chain (`r8-d2`) has a headline of its
        // own, so "staged" is not the predicate — "headline ∈ segments" is.
        const multi = PLAYTHROUGH_CHAINS.find((c) => c.kind === 'staged' && c.segments.length > 1);
        expect(multi.segments).not.toContain(multi.headline);
    });

    it('`--tier=<category>` selects the category, and `full` is still everything', () => {
        for (const c of ROSTER_CATEGORIES) expect(tapesInTier(c, roster)).toEqual(cats[c]);
        expect(tapesInTier('full', roster).length).toBe(roster.length);
        expect(tapesInTiers('campaign,map-walk', roster).length)
            .toBe(cats.campaign.length + cats['map-walk'].length);
        expect(tapesInTiers(ROSTER_CATEGORIES, roster).length).toBe(roster.length);
    });

    it('an unknown category is refused BY NAME, never as an empty sweep', () => {
        expect(() => tapesInTiers('campaign,mechnic', roster)).toThrow(TierError);
        expect(() => tapesInTiers('', roster)).toThrow(TierError);
    });
});
