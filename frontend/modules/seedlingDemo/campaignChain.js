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
 * `exit`, `encounter`, `why`.
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
 * ⛓ R9 slice L18b — `to: null` is the TERMINAL segment: the route's last step
 * crosses nothing (the shield, `route.steps[].crossesTo === null`), so the
 * producer gives it its `collects` and NO `reach-exit`, and the chain ends in
 * that room. At most the tail may be terminal (`campaignChainBreaks`).
 *
 * ⛓ Swim U13 — since `r9-solve-20` gained the 2.2 route's exit, no segment is
 * terminal: the chain's tail is `r9-solve-13-v2`, which leaves into L0. A
 * future L32 tail (the encounter with `then: 'reach-pit'`) would be terminal
 * and fall its arena's pit; the producer and the census accept exactly that
 * one crossing on a terminal segment.
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
            + 'is the ROUTE\'s step 11. One room, two goals, in the sphere order\'s sense',
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
            + 'crosses',
    }),
    Object.freeze({
        name: 'r9-solve-14', level: 14, to: 15,
        why: 'L14 — the SIX-BOB room, crossed by the PARRY-WALK (⚖ ruling 29(a)): the '
            + 'strike opens its window ahead of the walk, so the bobs are knocked back '
            + 'rather than killed and the crossing takes no hit',
    }),
    Object.freeze({
        name: 'r9-solve-15', level: 15, to: 16,
        why: 'L15 — THE BLOCK IS THE DOOR, THE BUTTON IS THE KEY, AND THE ROCKS ARE '
            + 'THE ONLY WAY BEHIND THE BLOCK (R9 slice L15, kickoff §54): the block is '
            + 'shoved E2, the south rock is broken to lean it N2 (the north rock is its '
            + 'stop), the north rock is broken from across the button to lean it E1 '
            + 'onto the button, the lock fades while the block presses, and the walk '
            + 'crosses — one block-route search, five orders, no hit',
    }),
    Object.freeze({
        name: 'r9-solve-16', level: 16, to: 18,
        why: 'L16 — grown by `rerecord-seedling-campaign.mjs --grow` at route step '
            + '18: stairsup@352,80 → L18. The survey\'s own solve is 625 tick(s), 5 '
            + 'decision(s), 0 re-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-18', level: 18, to: 19,
        why: 'L18 — grown by `rerecord-seedling-campaign.mjs --grow` at route step '
            + '19: teleporter@176,112 → L19. The survey\'s own solve is 485 tick(s), '
            + '2 decision(s), 0 re-plan(s), passes [discover, measure, solve]',
    }),
    Object.freeze({
        name: 'r9-solve-19', level: 19, to: 20, collects: Object.freeze(['bosskey']),
        why: 'L19 — grown by `rerecord-seedling-campaign.mjs --grow` at route step '
            + '20: Level 019 - Boss Key 0 (sphere 1.2) → Red Key; stairsup@16,96 → '
            + 'L20. The survey\'s own solve is 746 tick(s), 5 decision(s), 0 '
            + 're-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-20', level: 20, to: 13, collects: Object.freeze(['shield']),
        why: 'L20 — grown by `rerecord-seedling-campaign.mjs --grow` at route step '
            + '21: Level 020 - Shield (sphere 2.1) → Progressive Shield. The '
            + 'survey\'s own solve is 161 tick(s), 2 decision(s), 0 re-plan(s), '
            + 'passes [solve]. Swim U13 (⚖ Q40) gave it the 2.2 route\'s exit, '
            + 'stairsup@16,48 → L13: the through-2.2 survey\'s solve of the step is '
            + '560 tick(s), 5 decision(s), 0 re-plan(s), passes [solve]',
    }),
    /**
     * ⛓⛓ SWIM U13 (⚖ Q40, user 2026-10-01: "Yes, one slice") — the through-2.2
     * route (`survey-seedling-route.mjs --through=2.2`), grown by hand rather
     * than by `--grow`, which grows one room per run and derives a name a
     * second visit already holds. The `why` keeps `--grow`'s form.
     *
     * ⛓ L13 is visited AGAIN, so the name says which visit: `r9-solve-13-v2`
     * (visit 2). The first visit keeps `r9-solve-13` (trap 169's shape).
     *
     * ⛓ U13 STOPPED HERE, AT A WALL THE GAME NAMED: route step 23 (L0, visit
     * 3) is the first L0 visit after the shield, and `Shield.removed()` armed
     * `Moonrock.beam`. Swim U14 transcribed `Moonrock.update` (`moonrock.js`,
     * witnessed by `u14-moonrock-beam`/`-set`) and resumed the chain below.
     */
    Object.freeze({
        name: 'r9-solve-13-v2', level: 13, to: 0,
        why: 'L13 — grown by swim U13 at route step 22 (visit 2): stairsup@64,144 → '
            + 'L0. The survey\'s own solve is 48 tick(s), 1 decision(s), 0 re-plan(s), '
            + 'passes [solve]',
    }),    /**
     * ⛓⛓ SWIM U14 (⚖ Q46, user 2026-10-01: "Yes, one slice") — route steps 23–26,
     * U13's declarations verbatim, resumed once the model steps the moonrock
     * (`moonrock.js`): step 23's first L0 frame beams (451 dead frames, measured),
     * and step 24 is the chain's first PIT seam (`exit: 'pit'`, the successor's
     * clock read at the L21 arrival's `Game.begin()`, 80 ticks before the tape
     * ends on its calm landing).
     *
     * U14 STOPPED AT A SECOND WALL THE GAME NAMED. Route step 27 (L29, `bosskey`
     * → the Green Key, `stairsdown@112,32` → L31) solved in the model in 383 t
     * with no hit, and the game refuted it at t196: a `TurretSpit` from
     * `turret@80,176` knocked the player, who ended with `hits` 1 and no Green
     * Key (`seedling-swim-u14-wall.json`).
     */
    /**
     * ⛓⛓ SWIM U15 (⚖ Q47, user 2026-10-02: "Yes, one slice") — route steps 27–30,
     * U13's declarations verbatim (`ee34b23`), resumed once the model steps the
     * turret and its spit (`turret.js`, witnessed by `u15-turret-spit`/`-shield`)
     * and the solver prices the spit (`dangerMap.spitDanger`, the DODGE rung):
     * step 27 stalls one tick at walk-offset 183 and the spit that hit U14's walk
     * dies on cover. Step 30 is the route's terminal: L32's Bob Boss encounter
     * (U5's `bobBossFight.js`), the Fire, its slot equipped at t840, the tree
     * burned and the fall to L30 at t976 — every tick's keys identical to U5's
     * staged `swim-u5-bobboss-encounter`, and so is the game's stream.
     */
    Object.freeze({
        name: 'r9-solve-0-v3', level: 0, to: 12,
        why: 'L0 — grown by swim U13 at route step 23 (visit 3): teleporter@304,176 → '
            + 'L12. The survey\'s own solve is 229 tick(s), 2 decision(s), 0 '
            + 're-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-12', level: 12, to: 21, exit: 'pit',
        why: 'L12 — grown by swim U13 at route step 24: pit@576,688 (out_pit_5_5, '
            + 'tile 36,43) → L21, the puncher killed and the Pull funnel ridden into '
            + 'the pit (U12). The survey\'s own solve is 2419 tick(s), 4 decision(s), '
            + '0 re-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-21', level: 21, to: 22,
        why: 'L21 — grown by swim U13 at route step 25, arriving by the L12 pit: '
            + 'teleporter@80,160 → L22. The survey\'s own solve is 26 tick(s), 1 '
            + 'decision(s), 0 re-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-22', level: 22, to: 29,
        why: 'L22 — grown by swim U13 at route step 26: teleporter@192,64 → L29. The '
            + 'survey\'s own solve is 89 tick(s), 1 decision(s), 0 re-plan(s), passes '
            + '[solve]',
    }),
    Object.freeze({
        name: 'r9-solve-29', level: 29, to: 31, collects: Object.freeze(['bosskey']),
        why: 'L29 — grown by swim U13 at route step 27: Level 029 - Boss Key 1 (sphere '
            + '1.4) → Green Key; stairsdown@112,32 → L31. The survey\'s own solve is 383 '
            + 'tick(s), 4 decision(s), 0 re-plan(s), passes [solve]',
    }),
    Object.freeze({
        name: 'r9-solve-31', level: 31, to: 30,
        why: 'L31 — grown by swim U13 at route step 28: stairsup@160,384 → L30. The '
            + 'survey\'s own solve is 336 tick(s), 2 decision(s), 0 re-plan(s), passes '
            + '[solve]',
    }),
    Object.freeze({
        name: 'r9-solve-30', level: 30, to: 32,
        why: 'L30 — grown by swim U13 at route step 29: stairsup@224,160 → L32. The '
            + 'survey\'s own solve is 210 tick(s), 2 decision(s), 0 re-plan(s), passes '
            + '[solve]',
    }),
    Object.freeze({
        name: 'r9-solve-32', level: 32, to: null, encounter: 'Fire',
        why: 'L32 — grown by swim U13 at route step 30: Level 032 - Bob Boss (sphere '
            + '2.2) → Fire, the encounter (U5\'s `bobBossFight.js`), then the burned '
            + 'tree\'s pit. The survey\'s own solve is 1056 tick(s), 15 decision(s), 0 '
            + 're-plan(s), passes [solve]',
    }),
]);

/** The chain's id — the thing `?tapes=` names and a page expands. */
export const CAMPAIGN_CHAIN_ID = 'r9-campaign';

/**
 * ⛓⛓⛓ ⚖ 68 (user, 2026-08-29: "I choose B now") — EVERY CAMPAIGN SEGMENT
 * DECLARES `rng.split: true` AND BOOTS THE LATCHED `cosmetic` STATE.
 *
 * The chain's boundary 16/17 refused on the pre-build `rng`: `Music.playSound`
 * draws its sound INDEX from the one global LFSR, a pinned mixer whose
 * channels are reset once per ▶ Start replays (and draws) fewer indices on a
 * continuation than a fresh page does, and the live seed at the boundary was
 * the tape's TWO draws behind (measured with `rngRuler`). With the split ON,
 * `Rng.cos()` — sound indices, tile and grass ctors, chest coin counts, the
 * moonrock beams — lands on the COSMETIC stream, which the admission carries
 * and never asserts, and the gameplay stream is what gameplay draws.
 * `Rng.split` is a STATIC `botStart` assigns on every load, so a chain must
 * declare it on every window or none (`director.sequenceAdmission` refuses
 * a later window that differs) — hence one declaration here, applied by the
 * producer to every segment it emits. `segmentBootFromLatch` already authors
 * `split` and `cosmetic` from the latch; the re-record measures the cosmetic
 * states. The r8-d2 staged chain is untouched.
 */
export const CAMPAIGN_RNG_SPLIT = true;

/**
 * The segment tape NAMES, in order. This is what `PAGE_CHAINS` and
 * `PLAYTHROUGH_CHAINS[].segments` are: the same list, one derivation.
 */
export const CAMPAIGN_SEGMENT_NAMES = Object.freeze(
    CAMPAIGN_SEGMENTS.map((s) => s.name));

/**
 * ⛓ R9 slice L18b — is `name` a TERMINAL campaign segment (`to: null`)? A
 * terminal segment ends the route inside its own room and nothing boots from
 * its latch, so the CALM-ARRIVAL law — which exists so a successor can build a
 * fresh Player at v = 0 — is not asked of it (measured: `r9-solve-20` ends as
 * the shield pickup's freeze releases, v = (−0.55, 1.18), and the model
 * reproduces it tick for tick). Since swim U13 `r9-solve-20` leaves by its
 * stairs to L13, and no segment is terminal.
 */
export const isTerminalSegment = (name) =>
    CAMPAIGN_SEGMENTS.some((s) => s.name === name && s.to === null);

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
export const campaignNextLevel = () => campaignTail().to;   // null once the tail is terminal

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
