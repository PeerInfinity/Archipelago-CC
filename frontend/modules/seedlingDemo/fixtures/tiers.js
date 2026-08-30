/**
 * seedlingDemo/fixtures/tiers — the roster's TIER assignment, pinned by
 * name, with a completeness assertion so it cannot rot.
 *
 * Ruled by the user at R6 slice 0 (`NewDocs/plans/seedling-bot-r6-opus-kickoff.md`
 * §6.3, and `note_roster_trim_evaluation`'s five criteria). The parked
 * request was "evaluate which tests from previous rungs aren't worth
 * including in the full test run"; the answer had to be MEASURED, and it
 * was — `scripts/procgen/mine-seedling-roster-history.mjs` is the evidence.
 *
 * ── ⛔ WHAT THE EVIDENCE ACTUALLY SAID ────────────────────────────────
 *
 * In TWENTY recorded sweeps the roster produced exactly TWO sole
 * detectors: `transition-west-return` (run 1) and `r5-l42-part4-control`
 * (run 16). Two of the red runs were model-wide breakages that reddened 4
 * and 37 tapes at once, and a tape that failed inside one of those has
 * demonstrated nothing about itself. Forty-three of the hundred tapes are
 * R5's and carry one to seven runs of history. ⇒ **the failure history
 * cannot justify a cut**, and ranking tapes by it would be reading a
 * number as if it meant what a ranking implies.
 *
 * So the cut was made on MEASURED REDUNDANCY instead, two ways:
 *
 * 1. **Strict domination, provable.** `r3-walk-{1,2,3}` have
 *    BYTE-IDENTICAL `inputs` to `r4-walk-{1,2,3}` and differ only in
 *    `tape_version`, `noHazards` and `persistence` — the same walk with
 *    strictly FEWER crutches. That is exactly the ruled criterion ("cut
 *    only tapes whose mechanism set is a strict subset of a kept tape's"),
 *    satisfied outright.
 *
 * 2. **The noclip era.** All seven `r1-walk-*` tapes are `noclip: true`,
 *    granted and relaxed; R2 re-walks the same game with solids restored,
 *    R3 removes the grants, R4 restores hazards. None has ever been a sole
 *    detector, and their ONLY unique level coverage is L49.
 *
 * ⚠⚠ **AND THE COVERAGE THAT LEAVES IS NAMED, because a bounded sweep must
 * name what it bounded.** Demoting the R1 walks takes **L49** — the 5x9
 * conch room (`conch@32,80` + a teleporter) — out of the default gate.
 * No other tape in the roster reaches it. That is the price of the 23%,
 * stated rather than discovered later.
 *
 * ⛔ WHAT WAS *NOT* CUT, AND WHY. A first pass at "strict domination" also
 * flagged `r5-bobboss-fire`, `l71-shieldlock-open` and `r5-karlore-fire`,
 * on a crutch-count heuristic. Those are PAIR ARMS: the whole point of a
 * pair is that both arms run, and calling the treatment arm "dominated" by
 * its control is the mistake
 * [[feedback_control_that_removes_treatment_changes_the_world]] is about.
 * The heuristic was wrong, not the fixtures. Pairs are never demoted.
 *
 * And the ten noclip PRE-WALK oracles are not walks at all:
 * `straight-run` / `diagonal-run` / `friction-stop` / `direction-flip` /
 * `shuffle-stop` are the v1 physics transcription's own oracles, and
 * `pit-fall-83` / `pit-fall-chain-85` / `hazard-boot-pit` are the only
 * coverage of the pit transport and of L83. The whole pre-walk set is 4%
 * of the sweep. Cutting it would buy nothing and remove the floor.
 *
 * ── ⛓⛓ WHY THIS IS A NAMED LIST AND STILL CANNOT ROT ─────────────────
 *
 * `--tier=fast` is deliberately TICK-DERIVED, and its docblock says why: a
 * hand-kept list "would go stale the first time a fixture was added and
 * nobody thought about which tier it belonged in"
 * ([[feedback_coincidental_predicate_rots]]). A named tier assignment
 * reintroduces exactly that hazard — so it is built the only way that
 * defuses it:
 *
 *   · **`LEGACY` is the ONLY named set.** Every other tier is its
 *     COMPLEMENT over `fixtureNames()`, so a fixture added tomorrow lands
 *     in the default gate automatically. The list can only ever fail
 *     SAFE — by running something, never by skipping it.
 *   · **Every name in `LEGACY` is asserted to be a real fixture**
 *     (`assertTiersComplete`). A rename or a typo is a NAMED FAILURE, not
 *     a silently empty demotion.
 *   · **`full` still means EVERYTHING.** The pre-push gate is unchanged
 *     and never skips a tape; `legacy` only leaves the per-slice `gate`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAMPAIGN_SEGMENT_NAMES } from '../campaignChain.js';
import { PLAYTHROUGH_CHAINS, chainTapeNames } from '../playthroughWalk.js';
import { r2TapeSpecs } from '../r2Walk.js';
import { r3TapeSpecs } from '../r3Walk.js';
import { r4TapeSpecs } from '../r4Walk.js';

/**
 * The demoted set, by name. Ruled 2026-08-07.
 *
 * ⚠ These tapes are NOT deleted and NOT excluded from `--tier=full`. They
 * leave the per-slice `gate` tier only, and `--tier=legacy` runs them on
 * demand. The cut is reversible by construction because it is a list.
 */
export const LEGACY_TAPES = Object.freeze([
    // ⛓⛓ THE SEVEN `r1-walk-*` TAPES ARE GONE FROM THE REPOSITORY, not just
    // from this list — ⚖ ruling 26 (user, 2026-08-22) retired them in R9
    // slice 9b, and the ARGUMENT IS THE ONE THIS FILE ALREADY MADE: R2
    // re-walks the same game with solids restored, R3 removes the grants,
    // R4 restores the hazards, so a later-version tape witnesses the family
    // and none of the seven had ever been a sole detector. ⚠ L49 left with
    // them, as the note below still says — and it is now gone from the
    // ROSTER, not merely from the default gate.
    // Strictly dominated: byte-identical `inputs` to the r4 twin, with
    // `noHazards` ["water","lava","ice","waterfall"] against the twin's
    // ["water","waterfall"]. The same walk, more crutches.
    // ⛓ r3-walk-{4,5,6} and r3-walk-full DIVERGE from the r4 route (the
    //   first differing span is index 98 of r3-walk-4-spear), so they are
    //   NOT dominated and stay in the gate.
    'r3-walk-1-sword',
    'r3-walk-2-feather',
    'r3-walk-3-torch',
]);

/**
 * Level coverage that leaves the default gate with `LEGACY_TAPES`.
 *
 * ⛓ EMPTY SINCE ⚖ RULING 26, and that is a REAL LOSS rather than a
 * bookkeeping one: L49 (the 5x9 conch room) was reachable only through the
 * `r1-walk-*` tapes, which are now retired, so it has left the ROSTER
 * entirely. Nothing else demoted here takes unique level coverage with it —
 * `r3-walk-{1,2,3}` are byte-identical in `inputs` to their r4 twins.
 */
export const LEGACY_ONLY_LEVELS = Object.freeze([]);

/**
 * ── ⛓⛓⛓ THE THREE DERIVED CATEGORIES (R9 slice CAT, ⚖ 69 (c) / ⚖ 70) ───
 *
 * The user's direction (2026-08-29): *"I want to limit running the full tape
 * to cases where there is something that can only be tested in that way …
 * Can we at least make those a separate category that only runs when we need
 * to test that specifically?"* A category is therefore a SCHEDULING unit: a
 * tape-moving change re-drives the categories its reach names and quotes the
 * rest from the last same-build bank.
 *
 * ⛔⛔ **NO TAPE IS NAMED HERE.** ⚖ 17 (minimize hardcoding): a hand-kept
 * category list is the same rot `--tier=fast` was built tick-derived to
 * avoid, and it fails in the direction that SKIPS. So each category is a
 * derivation over an artifact that already exists and is already asserted:
 *
 *   `campaign`   every tape a CHAIN owns — `CAMPAIGN_SEGMENT_NAMES` ∪
 *                `chainTapeNames(chain)` over `PLAYTHROUGH_CHAINS`.
 *   `map-walk`   every tape the R2–R4 ROUTE FIXTURES name, through the same
 *                `rNTapeSpecs(route)` call `fixtures/regenerate-rN-tapes.mjs`
 *                writes those tapes with. A name can only be in this
 *                category if the fixture that produces the tape says so.
 *   `mechanic`   THE REMAINDER — never a list, so a fixture added tomorrow
 *                lands here and is driven, rather than being skipped.
 *
 * ── ⛓ WHY `campaign` IS CHAIN-CLOSED AND NOT "THE SEGMENTS" ───────────
 *
 * ⚖ 70 (a) wrote *"the segments of `CAMPAIGN_SEGMENTS` ∪ every
 * `PLAYTHROUGH_CHAINS` segment"*, which is 24 tapes and puts two chain
 * HEADLINES — `r7-ends-meet-full` and `r8-d2` — in `mechanic`. MEASURED
 * against the differential: a chain claim SKIPS unless the sweep replayed
 * every segment *and* the headline ("the chain needs all 16 segment(s) and
 * its headline; run --tier=full or --only with every name"). A campaign
 * category that could not make its own chain claims when driven alone would
 * defeat the point of having one, so the category is `chainTapeNames`'s
 * closure — the one spelling of "every tape a chain owns" (⚖ 32 D's shape).
 *
 * ── ⛔ AND `r3-collect-*` IS NOT A MAP WALK, MEASURED ─────────────────
 *
 * ⚖ 69 (b) counted 28 "R2–R4 whole-map HAND WALKS (`r2-walk-*`,
 * `r3-walk-*`, `r3-collect-*`, `r4-walk-*`)". The route fixtures name
 * **21**. The seven `r3-collect-*` tapes are HAND-AUTHORED single-room item
 * pickups (`r3-collect-sword`: "HAND-AUTHORED, and the first tape on the
 * ladder that COLLECTS AN ITEM FOR REAL", 54 ticks) — no route fixture
 * produces them, and the nearest derivation that would reach them
 * (`r3-route.json`'s `collects[].item`) names SIX of the seven and misses
 * `r3-collect-shield` outright. A predicate that catches six of seven is
 * the rot this file exists to refuse, so they fall to `mechanic`, where the
 * remainder rule drives them either way. The 28 was prose; 21 is the
 * measurement.
 */

/** ⛓ The R2–R4 route fixtures, and the spec function each is read by. */
const ROUTE_SPECS = Object.freeze([
    Object.freeze({ route: 'r2-route.json', specs: r2TapeSpecs }),
    Object.freeze({ route: 'r3-route.json', specs: r3TapeSpecs }),
    Object.freeze({ route: 'r4-route.json', specs: r4TapeSpecs }),
]);

/** The categories, in the order every readout prints them. */
export const ROSTER_CATEGORIES = Object.freeze(['campaign', 'map-walk', 'mechanic']);
/**
 * ⛓ THE ONE CATEGORY THAT IS A REMAINDER, named once. Everything else CLAIMS
 * its tapes from an artifact; this one takes what is left, which is what makes
 * the scheme fail SAFE — a fixture nobody classified is driven, never skipped.
 */
export const REMAINDER_CATEGORY = 'mechanic';
/** The categories that CLAIM names, derived from the two constants above. */
const CLAIMING_CATEGORIES = ROSTER_CATEGORIES.filter((c) => c !== REMAINDER_CATEGORY);

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The tape names each of the two DERIVED categories claims, before the
 * roster is consulted. `mechanic` is not here: it is the remainder, and a
 * remainder computed against anything but the live roster would be a second
 * definition of the roster.
 *
 * ⛓ Exported so a test can assert the derivation itself rather than only its
 * result, and so the differential can print where a name came from.
 */
export function derivedCategoryClaims() {
    const campaign = new Set(CAMPAIGN_SEGMENT_NAMES);
    for (const chain of PLAYTHROUGH_CHAINS) {
        const owned = chainTapeNames(chain);
        /**
         * ⛔ A SEGMENT LISTED TWICE IN ONE CHAIN IS A `TierError`, and the SET
         * this derivation ends in is exactly why it has to be caught here: the
         * repeat would be deduplicated into a category that looks correct
         * while the chain replays the tape twice and its `endsAt` arithmetic
         * is off by that tape.
         *
         * ⛓⛓ MEASURED, AND THE FIRST CUT OF THIS CHECK WAS WRONG: it read
         * `chainTapeNames`, and THIRTEEN live chains failed it at once. A
         * `staged` chain is one tape — its headline IS its only segment
         * (`{segments: ['r8-solve-1'], headline: 'r8-solve-1'}`) — so a
         * repeat in the OWNED list is the staged idiom, not a defect. The
         * defect is a repeat among the SEGMENTS, which is what this reads.
         * ⛓ A repeat ACROSS chains and between the two sources is NORMAL too
         * (a staged chain's headline IS a campaign segment).
         */
        const twice = chain.segments.filter((n, i) => chain.segments.indexOf(n) !== i);
        if (twice.length) {
            throw new TierError(
                `the chain whose segments are [${chain.segments.join(', ')}] names `
                + `${[...new Set(twice)].join(', ')} more than once. A category derived `
                + 'from it would deduplicate the repeat and read as correct while the '
                + 'chain replays the tape twice.');
        }
        for (const n of owned) campaign.add(n);
    }
    const mapWalk = new Set();
    for (const { route, specs } of ROUTE_SPECS) {
        const parsed = JSON.parse(readFileSync(join(HERE, route), 'utf8'));
        for (const spec of specs(parsed)) mapWalk.add(spec.name);
    }
    return { campaign: [...campaign], 'map-walk': [...mapWalk] };
}

/**
 * The roster split into the three categories.
 *
 * ⛔ THIS IS A PARTITION AND IT IS ASSERTED, not asserted-in-a-comment. A
 * tape in TWO categories would be driven twice and priced twice; a tape in
 * NONE would be skipped by every category run and still counted in the
 * checkpoint row's tape total — the exact failure a category scheme has to
 * be unable to have. Both are a `TierError` BY NAME.
 *
 * ⛓ A derived name the roster does not carry is also a `TierError`: a chain
 * or a route naming a tape that is not on disk means the derivation is
 * describing a roster that does not exist, and silently dropping it would
 * make the category smaller with no line saying so.
 *
 * @param {string[]} rosterNames `fixtureNames()`
 */
export function rosterCategories(rosterNames) {
    const roster = new Set(rosterNames);
    const claims = derivedCategoryClaims();
    const seen = new Map();
    const out = { campaign: [], 'map-walk': [], mechanic: [] };
    for (const category of CLAIMING_CATEGORIES) {
        for (const name of claims[category]) {
            if (!roster.has(name)) {
                throw new TierError(
                    `the \`${category}\` derivation names \`${name}\`, which the roster does `
                    + 'not have. The derivation reads the chains and the route fixtures — one '
                    + 'of them describes a tape that is not on disk. Fix the artifact, do not '
                    + 'drop the name: a category that quietly shrinks skips what it dropped.');
            }
            if (seen.has(name)) {
                throw new TierError(
                    `\`${name}\` derives into BOTH \`${seen.get(name)}\` and \`${category}\`. `
                    + 'The categories must PARTITION the roster — a tape in two of them is '
                    + 'driven twice and priced twice, and the checkpoint row\'s parts stop '
                    + 'summing to the roster.');
            }
            seen.set(name, category);
            out[category].push(name);
        }
    }
    /**
     * ⛔ EVERY CATEGORY COMES BACK IN **ROSTER ORDER**, and it is not
     * cosmetic: `--tier=full` sweeps `rosterNames` in that order, so a
     * category returned in DERIVATION order would drive the same tapes in a
     * different sequence from the run its numbers are compared against. It
     * also made the two spellings of "the tapes in category C" disagree —
     * `tapesInTier` handed back the derivation's order and `tapesInTiers`
     * the roster's, which a test caught the first time both were asked the
     * same question.
     */
    for (const category of CLAIMING_CATEGORIES) {
        const claimed = new Set(out[category]);
        out[category] = rosterNames.filter((n) => claimed.has(n));
    }
    out[REMAINDER_CATEGORY] = rosterNames.filter((n) => !seen.has(n));
    const total = out.campaign.length + out['map-walk'].length + out.mechanic.length;
    if (total !== rosterNames.length) {
        throw new TierError('the categories do not partition the roster: '
            + `${out.campaign.length} campaign + ${out['map-walk'].length} map-walk + `
            + `${out.mechanic.length} mechanic = ${total} != ${rosterNames.length}`);
    }
    return out;
}

/**
 * The category one tape belongs to, or `null` if it is not in the roster.
 *
 * ⚠ IT RE-DERIVES EVERY TIME (the route fixtures are read off disk, ~25 ms).
 * A caller asking about MANY names should call `rosterCategories` once and
 * read the three lists, not loop over this.
 */
export function categoryOf(name, rosterNames) {
    const cats = rosterCategories(rosterNames);
    return ROSTER_CATEGORIES.find((c) => cats[c].includes(name)) ?? null;
}

/** The tiers a sweep can ask for, and what each means. */
export const TIERS = Object.freeze({
    /** Tick-derived (< 600 ticks). Unchanged, and still not a named list. */
    fast: 'every tape under the tick threshold — the iteration loop',
    /** The complement of LEGACY. The per-slice gate. */
    gate: 'everything except LEGACY_TAPES — the per-slice gate',
    /**
     * ⚠ DEPRECATED at R9 slice CAT: `legacy` is now the INTERSECTION of
     * `LEGACY_TAPES` with `map-walk`, which the assertion proves is
     * `LEGACY_TAPES` itself. It is kept for one slice so a caller with the
     * old spelling still selects the same three tapes, and every run that
     * asks for it says so.
     */
    legacy: 'the demoted set, by name — run on demand, never skipped by `full` '
        + '(DEPRECATED: it is `LEGACY_TAPES` ∩ `map-walk`; ask for `map-walk`)',
    /** Unchanged: EVERYTHING. */
    full: 'the whole roster — the pre-push / rung-close gate, skips nothing',
    /** ⛓ R9 slice CAT — the three DERIVED categories (⚖ 69 (c) / ⚖ 70). */
    campaign: 'every tape a CHAIN owns — derived from CAMPAIGN_SEGMENT_NAMES and '
        + 'chainTapeNames over PLAYTHROUGH_CHAINS; the seam claims need all of them',
    'map-walk': 'every tape the R2–R4 route fixtures name, through the same '
        + 'rNTapeSpecs(route) call that writes them',
    mechanic: 'THE REMAINDER — physics primitives, presses, contacts, pairs and '
        + 'controls, and every solver witness not on a chain',
});

export class TierError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TierError';
    }
}

/**
 * Every `LEGACY_TAPES` entry must be a real fixture, and the tiers must
 * partition the roster.
 *
 * ⛔ THE POINT IS THE FIRST HALF. A demotion list whose names no longer
 * exist reads as a clean, working cut and quietly demotes nothing — the
 * shape [[feedback_coincidental_predicate_rots]] describes. This throws
 * instead, so a rename surfaces as a failure at the moment it happens.
 *
 * @param {string[]} rosterNames `fixtureNames()`
 */
export function assertTiersComplete(rosterNames) {
    const roster = new Set(rosterNames);
    const unknown = LEGACY_TAPES.filter((n) => !roster.has(n));
    if (unknown.length) {
        throw new TierError(
            `LEGACY_TAPES names ${unknown.length} tape(s) the roster does not have: `
            + `${unknown.join(', ')}. A demotion list that names nothing demotes `
            + 'nothing and reads exactly like one that works — fix the name or drop it.');
    }
    const dupes = LEGACY_TAPES.filter((n, i) => LEGACY_TAPES.indexOf(n) !== i);
    if (dupes.length) {
        throw new TierError(`LEGACY_TAPES repeats ${dupes.join(', ')}`);
    }
    const gate = rosterNames.filter((n) => !LEGACY_TAPES.includes(n));
    if (gate.length + LEGACY_TAPES.length !== rosterNames.length) {
        throw new TierError('gate + legacy does not partition the roster: '
            + `${gate.length} + ${LEGACY_TAPES.length} != ${rosterNames.length}`);
    }
    /**
     * ⛓⛓ R9 slice CAT — THE THREE CATEGORIES ARE ASSERTED ON THE SAME CALL,
     * for the same reason the LEGACY names are: the differential runs this
     * on EVERY sweep, `--tier=full` and `--only` included, so a derivation
     * that has come apart from the roster is a named failure at the moment
     * it happens rather than at the next category drive.
     */
    const categories = rosterCategories(rosterNames);
    /**
     * ⛔ `LEGACY_TAPES` RETIRES INTO `map-walk` — ⚖ 70 (a). The three names
     * are `r3-walk-{1,2,3}`, which the R3 route fixture produces, so this is
     * not a coincidence to be discovered later but a DERIVATION to be
     * asserted: if a demoted tape stopped deriving into `map-walk` it would
     * be in `mechanic`, and a `map-walk` drive would no longer cover the
     * set the demotion is defined against.
     */
    const strays = LEGACY_TAPES.filter((n) => !categories['map-walk'].includes(n));
    if (strays.length) {
        throw new TierError(
            `LEGACY_TAPES retires INTO \`map-walk\`, but ${strays.join(', ')} derive(s) `
            + 'elsewhere. The demoted set is a subset of what the R3 route fixture names; '
            + 'if that stopped being true, the demotion and the category disagree about '
            + 'the same tapes.');
    }
    return { gate, legacy: [...LEGACY_TAPES], categories };
}

/**
 * The tapes a tier selects, out of the roster.
 *
 * `fast` is not answered here — it is TICK-DERIVED and the verifier owns
 * the threshold, which is the whole reason it cannot rot. Asking for it
 * here would create a second definition of one tier.
 */
export function tapesInTier(tier, rosterNames) {
    const { gate, legacy, categories } = assertTiersComplete(rosterNames);
    switch (tier) {
        case 'full': return [...rosterNames];
        case 'gate': return gate;
        /**
         * ⚠ DEPRECATED, and it is an INTERSECTION now: `legacy` selects the
         * demoted names that derive into `map-walk`, which `assertTiersComplete`
         * has just proved is all of them. Spelling it as the intersection means
         * the alias cannot outlive the fact that justifies it.
         */
        case 'legacy': return legacy.filter((n) => categories['map-walk'].includes(n));
        default:
            if (ROSTER_CATEGORIES.includes(tier)) return categories[tier];
            throw new TierError(`tapesInTier: "${tier}" is not a named tier `
                + `(${Object.keys(TIERS).join(', ')}); "fast" is tick-derived and `
                + 'is resolved by the verifier, not here');
    }
}

/**
 * The tapes a comma-list of tiers selects, in roster order, deduplicated.
 *
 * ⛔ ONE SPELLING FOR THE LIST, because three callers take one (the
 * differential's `--tier=`, the pipeline's `--categories=`, the owed gate's
 * verdict). An unknown name is refused BY NAME rather than silently
 * selecting nothing — a sweep that runs zero tapes prints the same green as
 * one that ran them all.
 */
export function tapesInTiers(tiers, rosterNames) {
    const asked = (Array.isArray(tiers) ? tiers : String(tiers).split(','))
        .map((t) => t.trim()).filter(Boolean);
    if (!asked.length) throw new TierError('tapesInTiers: no tier named');
    const picked = new Set();
    for (const tier of asked) for (const n of tapesInTier(tier, rosterNames)) picked.add(n);
    return rosterNames.filter((n) => picked.has(n));
}
