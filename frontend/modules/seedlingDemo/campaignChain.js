/**
 * seedlingDemo/campaignChain.js — **THE CAMPAIGN CHAIN'S ONE DECLARATION.**
 * ⚖ Ruling 38 item (1) (user, 2026-08-23: *"I want to implement all of the
 * streamlining changes that you listed"*), R9 slice 12d.
 *
 * ── ⛔⛔ WHY THIS FILE EXISTS — the measurement, not the preference ─────
 *
 * The membership of `r9-campaign` — which rooms, in which order, each one's
 * boot level and the door it leaves by — was written out **six times** in a
 * tree where exactly one of them could be right:
 *
 *   1. `scripts/procgen/solve-seedling-r9-campaign.mjs`'s `SEGMENTS`
 *   2. `playthroughWalk.js`'s `CHAIN_DECLARATIONS[r9-campaign].segments`
 *   3. `director.js`'s `PAGE_CHAINS['r9-campaign']`
 *   4. `procgenDocs/demos.js`'s `windows.length == 16` claim and its prose
 *   5. `docs/…/seedling-bot.md`'s hand chain table
 *   6. `r8Acceptance.js`'s campaign exposure row
 *
 * Slices 12b / 12b′ / 12b″ paid for that six times over, and 12b″ could only
 * add a ROW asserting that two of the copies agreed (§23c.7a) — an agreement
 * is what you assert when you have given up on removing the duplicate. This
 * file removes it: the list below is the declaration, and every one of those
 * consumers DERIVES from it.
 *
 * ── ⛔ WHY THE PRODUCER IMPORTS THIS AND NOT THE OTHER WAY ROUND ───────
 *
 * `solve-seedling-r9-campaign.mjs` cannot be imported: it solves the whole
 * campaign at module scope and drives Windows Chrome for the latches, so
 * anything that imported it would run the campaign. This module is inert
 * data with no imports at all, which is also what makes it BROWSER-SAFE —
 * `director.js` and `playthroughWalk.js` load it in a page. The dependency
 * therefore runs one way only, and that is a fact about the producer rather
 * than a design choice here.
 *
 * ── WHAT IS DATA AND WHAT IS DERIVED ──────────────────────────────────
 *
 * DATA (a human decided it): `name`, `level`, `to`, `promoted`, `collects`,
 * `why`.
 * DERIVED elsewhere, never written here: every COORDINATE (the producer's
 * `placement`/`exitTo` read the atlas), every TICK COUNT (`playthroughWalk`'s
 * `withDerivedTicks` reads the committed tapes), the cuts, `endsAt`, and the
 * frontier.
 *
 * ⛓ `why` IS HISTORY AND IS KEPT VERBATIM. Each sentence was written by the
 * slice that authored that room, and the producer writes it into the tape's
 * `description` — which `gameVisibleTape` KEEPS and the producer's `--check`
 * compares, so a stale `why` reds BY NAME (§23c.4). A GROWN segment's `why`
 * is derived from its own solve record by `rerecord-seedling-campaign.mjs
 * --grow`; a hand sentence is only ever the history of a room recorded before
 * that command existed.
 *
 * ⛔ THE ORDER IS THE SPHERE ORDER. `survey-seedling-route.mjs` derives the
 * same level sequence independently from the sphere order, and the producer
 * compares its rows against these.
 */

/**
 * ⛔ THE CAMPAIGN, DECLARED ONCE.
 *
 * `collects` names the goal ledger rows a segment takes BEFORE it leaves;
 * the producer turns each into `collect-placement` on that room's own atlas
 * entity and appends `reach-exit` toward `to`. A segment with no `collects`
 * is a `reach-exit` alone, which is fifteen of the sixteen.
 *
 * `promoted` marks a segment this chain did NOT re-author: its boot already
 * IS its predecessor's latch (the census measured CONTINUES on every pair up
 * to `r8-solve-4`, and segment 1's boot is the game's own), so the chain
 * gives it a RELATION rather than a rewrite and `solve-seedling-r8-battery
 * .mjs` keeps it.
 */
export const CAMPAIGN_SEGMENTS = Object.freeze([
    Object.freeze({
        name: 'r8-solve-1', level: 0, to: 2, promoted: true,
        why: 'L0 — the TRUE INITIAL BOOT, `new Game(0,80,128)` with an empty save',
    }),
    Object.freeze({
        name: 'r8-solve-2', level: 2, to: 3, promoted: true,
        why: 'L2 — the first teleporter',
    }),
    Object.freeze({
        name: 'r8-solve-3', level: 3, to: 4, promoted: true,
        why: 'L3 — outbound, PRE-SWORD (the breakable rocks are not yet passable)',
    }),
    Object.freeze({
        name: 'r8-solve-4', level: 4, to: 5, promoted: true,
        why: 'L4 — the hold-then-shove room',
    }),
    Object.freeze({
        name: 'r8-solve-5', level: 5, to: 6,
        why: 'L5 — the arrow-bait kill lock; the walk earns `{5,0}` on its own tick',
    }),
    Object.freeze({
        name: 'r8-solve-6', level: 6, to: 7,
        why: 'L6 — the ladder\'s proving room, the AVOID → TIME → BAIT ladder',
    }),
    Object.freeze({
        name: 'r8-solve-7', level: 7, to: 8,
        why: 'L7 — a straight corridor, two spires, two stairs',
    }),
    Object.freeze({
        name: 'r8-solve-8', level: 8, to: 9,
        why: 'L8 — two kill locks, `{8,0}` and `{8,1}`, both the walk\'s own',
    }),
    Object.freeze({
        name: 'r8-solve-9', level: 9, to: 10,
        why: 'L9 — the teleporter pair',
    }),
    Object.freeze({
        name: 'r8-solve-10', level: 10, to: 11, collects: Object.freeze(['sword']),
        why: 'L10 — THE SWORD (`sword@L10`, the goal ledger\'s first credited row)',
    }),
    Object.freeze({
        name: 'r9-solve-11', level: 11, to: 3, collects: Object.freeze(['chest']),
        why: 'L11 — THE CHEST (`chest@L11`) and out by the TELEPORTER to L3. ⛔ NOT '
            + '`r8-solve-11`, which takes the same chest and returns to L10: that is the '
            + 'BATTERY\'s room (its goals come from `act2-the-sword`\'s units) and this '
            + 'is the ROUTE\'s step 11, which the survey solves at 119 t for the exit '
            + 'alone. One room, two goals, in the sphere order\'s sense',
    }),
    Object.freeze({
        name: 'r9-solve-3', level: 3, to: 2,
        why: 'L3 — the RETURN, and the `break` verb\'s room: `breakablerock@96,112` is '
            + 'the door out of a one-cell arrival pocket (R9 slice 4)',
    }),
    Object.freeze({
        name: 'r9-solve-2', level: 2, to: 0,
        why: 'L2 — the return leg, up the stairs to L0',
    }),
    Object.freeze({
        name: 'r9-solve-0', level: 0, to: 13,
        why: 'L0 — the overworld crossed a second time, south to L13',
    }),
    Object.freeze({
        name: 'r9-solve-13', level: 13, to: 14,
        why: 'L13 — a corridor and a door, into the six-bob room the next segment '
            + 'crosses. ⛓ R9 slice 12b″: route step 16 was this chain\'s STOP for four '
            + 'slices (the survey refused L14\'s camera band); slice 12b\' solved it and '
            + '`r9-solve-14` records it, so L14 is a room the chain walks THROUGH now '
            + 'rather than the arrival it parked at',
    }),
    Object.freeze({
        name: 'r9-solve-14', level: 14, to: 15,
        why: 'L14 — the SIX-BOB room, crossed by the PARRY-WALK (⚖ ruling 29(a)): '
            + 'six presses, five bobs knocked back, none killed, no hit taken. The '
            + 'chaser arm exists and this room does not need it',
    }),
]);

/** The chain's id — the thing `?tapes=` names and a page expands. */
export const CAMPAIGN_CHAIN_ID = 'r9-campaign';

/**
 * The segment tape NAMES, in order. This is what `PAGE_CHAINS` and
 * `PLAYTHROUGH_CHAINS[].segments` are: the same list, one derivation.
 */
export const CAMPAIGN_SEGMENT_NAMES = Object.freeze(
    CAMPAIGN_SEGMENTS.map((s) => s.name));

/** The chain's tail — the room a growth is asked about. */
export const campaignTail = () => CAMPAIGN_SEGMENTS[CAMPAIGN_SEGMENTS.length - 1];

/**
 * The room the chain would grow into next: the tail's own `to`.
 *
 * ⛔ DERIVED, never typed. `rerecord-seedling-campaign.mjs --grow` asks the
 * committed route survey (`fixtures/campaign-frontier.json`) about exactly
 * this level, and `campaignChain.test.js` asserts it against the frontier's
 * own `nextStep.level` — so the tail cannot drift from the artifact that
 * describes what is in front of it. A typed `{name, level, to}` tail was the
 * previous spelling and it decayed once per growth (trap 574's shape).
 */
export const campaignNextLevel = () => campaignTail().to;

/**
 * The boot levels the chain's segments enter FROM — the set a bridged-room
 * census is intersected with. ⛔ Not the rooms the walks VISIT: a walk that
 * crosses into its successor's room enters that one too, and the exposure
 * guard measures the visited set off the recorded stream rather than from
 * here. What this derives is the DECLARATION's own half of that question.
 */
export const campaignBootLevels = () => Object.freeze(
    [...new Set(CAMPAIGN_SEGMENTS.map((s) => s.level))].sort((a, b) => a - b));

/**
 * ⛓ Every row's `to` is its successor's `level` — the sphere order's own
 * chaining, as a predicate rather than a restatement. Returns the offending
 * pairs, so a caller can name them.
 */
export const campaignChainBreaks = () => CAMPAIGN_SEGMENTS
    .slice(0, -1)
    .map((s, i) => ({ from: s, to: CAMPAIGN_SEGMENTS[i + 1] }))
    .filter((p) => p.from.to !== p.to.level);
