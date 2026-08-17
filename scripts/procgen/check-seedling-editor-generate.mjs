#!/usr/bin/env node
/**
 * check-seedling-editor-generate — THE PROCGEN PoC SLICE 5 ACCEPTANCE ROW.
 *
 * Does the PAGE, running the Cloudberry loop in a browser from nothing but
 * URL parameters, generate the same level and the same trace node does — and
 * does it DRAW the walk it solved, all of it?
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * The editor arc's own lesson (`export-seedling-view.mjs`'s docblock, trap
 * 176): the browser rows that SKIPPED when no dev server was up hid a page
 * that could not load AT ALL for two rungs. This row starts one on a free
 * port (`serveRepoRoot`, shared with the exporter so there is exactly one
 * static server in the arc) and shuts it down on every path. **There is no
 * skip condition.** `--host=` uses an existing server instead, which is a
 * convenience and not an escape.
 *
 * ── WHAT IT CAN CATCH, AND WHAT IT CANNOT ─────────────────────────────
 *
 * Both sides call the same loop, so this is NOT a check that the loop is
 * correct — it is a check that the PAGE'S OWN PATH TO IT is, and everything
 * between a URL and that call is page-owned and unshared: parsing the bounds,
 * choosing the palette, wiring the model to the oracle, running 60-odd
 * modules in chromium rather than node, and re-stepping the resulting tape
 * through the scrubber. A defect in any of them shows here.
 *
 * ⛔ It does NOT re-derive the generator's answer independently — nothing can,
 * short of a second generator. The anchor is node's OWN output for the same
 * seed, which is the artifact `generate-seedling-level.mjs` emits.
 *
 * ── THE FOUR CLAIMS ───────────────────────────────────────────────────
 *
 *  1. **STEP** — one press of STEP from the skeleton gives the level
 *     `generateSeedlingLevel(target=1)` gives, byte for byte. (The prefix
 *     property `watchGenerate` rests on, crossing the runtime boundary.)
 *  2. **RUN-ALL + the VERBATIM refusals** — the finished level and its whole
 *     trace match node's, and every veto the pane shows carries the reason
 *     text node recorded, character for character (⚖ §7.4; trap 202 — the
 *     refusals are the evidence channel).
 *  3. **⛓⛓⛓ THE SCRUB FORK, IN A BROWSER** — a post-sword CARRIER (a level
 *     whose ELEMENT is a certified `killgate`, whose solve banks a scratch
 *     clear no tape can declare; ⛓ it was a level holding
 *     `wall-gap-spinner-killlock-*` until slice 4c retired that template)
 *     draws EVERY frame of its walk. Before slice
 *     5's stepper option the page collected 270 of 379 and reported a throw;
 *     the failure mode is a plausible SHORT replay, so the frame count is the
 *     only thing that shows it. ⛓ ARC 3 SLICE 2c adds the ✕: the same walk,
 *     scrubbed to the tick its scratch clear names and to the tick before it,
 *     asserting the DRAWN world-state mark on the kill lock appears exactly
 *     there.
 *  4. **`?gen=`** — a payload emitted by the CLI is reproduced in the browser
 *     byte-identically, which is a determinism statement across two runtimes.
 *  6. **⛓⛓⛓ THE CATALOGUE + VERB 1 (RESTRICT)** (slice 4) — the page lists
 *     what this biome can generate INCLUDING what it cannot and why; unticking
 *     restricts the roster a run may draw from, the URL names the restriction,
 *     a copied link reproduces the restricted level byte for byte, an EMPTY
 *     restriction refuses BEFORE the press, and an unknown name refuses BY
 *     NAME. ⛔ Its subject's two kept lists are DISJOINT, so a restriction the
 *     page echoes without PASSING to the loop reds this row.
 *  8g. **⛓⛓⛓ THE PRE-CHECK ON THE OPEN ROOM** (constructive-mode slice 6b) —
 *     ⚖ the user dropped the rule's kind scope, so a directive that would SEAL
 *     an `empty` room — one whose terrain a REAL LADDER accumulated, since no
 *     single row seals a fresh one — is `ILLEGAL_PLACEMENT` with a sentence
 *     naming that room's own kind. The cell comes from an independent flood
 *     here (trap 269).
 *  5. **⛓⛓⛓ THE URL ROUND TRIP** (GENERATE-mode UI arc, slice 1) — edit the
 *     form, press, and the address bar NAMES the run; copy it, load it fresh,
 *     and the panel AND the level come back identical. Before slice 1 the
 *     form edited local variables only: seed 3 → 9 + RUN-ALL left `?seed=3`
 *     standing, so the link named a level the page was not showing. ⛔ Both
 *     halves are asserted because a writer nobody reads back is the two-
 *     spellings defect wearing a green tick.
 *  7. **⛓⛓⛓ VERB 2 — THE DIRECTED ATTEMPT** (GENERATE-mode UI arc, slice 5).
 *  8. **⛓⛓⛓ CLICK-TO-ANCHOR** (slice 6) — AT… arms a canvas click, the
 *     clicked TILE becomes the explicit anchor of ONE directed attempt at
 *     exactly that cell, and an ILLEGAL cell refuses BY NAME with the model's
 *     own text WITHOUT spending a solve. ⛔ The tile is checked against an
 *     answer THIS FILE computes from the canvas geometry — the URL fixed point
 *     cannot gate a VALUE (trap 250), and the click lands on the LAST PIXEL of
 *     the target tile because an off-by-one is invisible to a middle-of-tile
 *     click.
 *
 * Run: node scripts/procgen/check-seedling-editor-generate.mjs
 *      node scripts/procgen/check-seedling-editor-generate.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
// ⛓ The loop core left `seedlingDemo/` in CONSTRUCTIVE-MODE slice 2 (the maze
// binds to the same file); the Seedling bindings did not.
const CORE = (p) => import(join(REPO, 'frontend/modules/procgenCore', p));
const {
    DIRECTED_ANCHOR_TRIES, generateStep, generateWithDirectives, paletteFor,
} = await M('watchGenerate.js');
// ⛓ SLICE 6: a pure READER of a record, used to say WHERE the clicked
// template's footprint actually landed. Both records it is asked about came out
// of the BROWSER, so this is an independent read of the browser's own answer.
const { terrainAt } = await M('procgenLevel.js');

/**
 * ⛓ THE SUBJECTS ARE MEASURED, NOT PICKED.
 *
 * ⛓⛓⛓ **RE-MEASURED AT THE GENERATE-mode UI ARC's SLICE 2** (the
 * parameterized-template migration). Drawing a template's parameters spends
 * rng draws, so EVERY recorded seed→level pair expired — ⚖ ruling 5 licensed
 * exactly that (*"it's not a problem if the seed level pairs expire"*). Both
 * subjects below were re-derived by re-running THIS FILE's own documented
 * scans; the old values are quoted so a reader can see the properties are the
 * same and only the seeds moved. ⛔ REPLACED, NEVER RELAXED (trap 62): not one
 * assertion was loosened to make an old seed fit.
 *
 * `PRE` is **seed 4 at target 2** — the cheapest pre-sword case that VETOES
 * something, which claim 2 needs because it asserts the veto text is VERBATIM.
 * A first draft of this file used a seed that keeps both its candidates and the
 * check passed over an EMPTY list; a row that reports PASS on nothing is the
 * bounded-sweep trap in acceptance clothes. Re-scanned (seeds 1..12 at targets
 * 2 and 3): **only seeds 4 and 12 veto at target 2**, and 4 vetoes twice where
 * 12 vetoes once, so 4 is the subject. (Was seed 1, which now keeps both.)
 *
 * `CARRIER` is **seed 41 post-sword**, which keeps its kill template at step
 * **1** — what makes the scrub-fork claim affordable in a browser. Re-scanned
 * (post-sword, step 1, seeds 1..72): the pool is 10/12/13/14/15/25/41/54/69,
 * and all nine SOLVE with a `kill` record and a scratch clear. 41 is the
 * cheapest walk of the nine (379 ticks against 386–452), which is the only
 * property that decides between them. (Was seed 36, which no longer keeps one
 * at step 1.)
 *
 * ⛓⛓ RE-SCANNED AT ARC 3 SLICE 2 — the door law and the kill family's `span`
 * domain both moved every post-sword level, so seed 41 keeps a `pit-patch` now.
 * SAME SCAN, same bounds, seeds 1..72: the pool is **14/25/31/36/54/60/61**, all
 * seven SOLVE with a `kill` record and a scratch clear, and **61 is the cheapest
 * walk (388 ticks against 412–452)** — the same tie-break, so the subject moves
 * and the rule does not.
 */
/**
 * ⛓⛓⛓ **BOTH SUBJECTS RE-PICKED AT ARC 3 SLICE 4c, BY THEIR OWN SCANS** (trap
 * 285 — the scan, the target and the count are named). ⚖ The user retired the
 * three door TEMPLATES into the room-aware ELEMENTS and gave the generator a
 * biome DEFAULT SPEC, which moved every level in this file.
 *
 * `PRE` — the cheapest pre-sword case that VETOES something, which claim 2 needs
 * because it asserts the veto text is VERBATIM. ⛔ **NOT ONE SEED IN 1..12
 * VETOES AT TARGET 2 OR 3 ANY MORE**, which is the retirement's own consequence
 * said once more: a roster of three DECORATION families is reverted far less
 * often than one holding three door families, so a short ladder now keeps
 * everything it draws. RE-SCANNED at targets 4/5/6 over seeds 1..20: **exactly
 * TWO seeds veto — 2 and 18, once each, at every one of the three targets** —
 * and both REACH. **Seed 2 at target 4** is taken: the cheapest target that has
 * a veto at all. (Was seed 4 at target 2, which vetoed twice.)
 *
 * `CARRIER` — a post-sword level whose walk banks a SCRATCH CLEAR no tape can
 * declare, kept at step **1** so the scrub-fork claim is affordable in a
 * browser. ⛔ ITS SUBJECT CHANGED KIND: there is no kill TEMPLATE to keep, so
 * the carrier is now a level whose ELEMENT is a CERTIFIED `killgate`.
 * RE-SCANNED (post-sword, step 1, seeds 1..72) for a certified kill gate whose
 * final solve carries a `kill` record AND a scratch clear: **three qualify — 29
 * (403 ticks, `cause: 'sword'`), 38 (377, `cause: 'pit'`) and 60 (551,
 * `sword`)**. **Seed 29 is taken**: it is the cheapest of the two whose clear is
 * the SWORD's, and the cause is what makes it a post-sword carrier rather than
 * a level a hazard happened to clear. ⚠ 38 is cheaper in ticks and clears by
 * `pit` — a swordless boot would clear it too — so the tie-break is the cause
 * and not the clock, which is a change from the old rule and is said here.
 */
const PRE = { seed: 2, biome: 'pre-sword', count: 4 };
const CARRIER = { seed: 29, biome: 'post-sword', count: 1 };

/**
 * ⛓ THE ROUND-TRIP SUBJECT, AND EVERY FIELD OF IT MOVES.
 *
 * Claim 5 starts from `?seed=1&biome=post-sword&count=1` with no `?tries=` and
 * no `?k=` and edits the form to THIS — so every one of the five controls has
 * to travel, and a writeback that silently dropped one falls back to a
 * DIFFERENT value (`DEFAULT_BOUNDS` is tries 8 / k 3) rather than coinciding
 * with the right one. ⚠ That is the whole reason `tries`/`k` are not the
 * defaults here: a subject that agrees with the fallback cannot fail.
 *
 * `tickbudget` is the parameter with NO CONTROL AT ALL — the rewrite must
 * copy it — and it is set away from the default 400 so it is a budget the run
 * is really certified under and not just a string in a query.
 *
 * ⛓ SLICE 3 ADDS `anchortries` TO THE SET THAT HAS TO TRAVEL — six controls
 * now, and it is set to 2 (the default is 1) so a dropped writeback lands on a
 * DIFFERENT bound. ⚠ At 2 the ladder may KEEP a candidate the one-anchor bound
 * would have reverted, so the level this subject names is genuinely a
 * search's; the node side is computed under the same bound, which is what
 * makes the byte comparison a claim about the URL and not about the search.
 *
 * The seed is a MEASUREMENT: at these bounds it must REACH its target, or the
 * step the URL names is not the target the form asked for and the claim gets
 * softer than it reads. ⛓ RE-MEASURED at slice 2: **all of seeds 1..12 reach
 * target 2 at tries=3**, so the choice is only about not colliding with the
 * other claims' subjects — 6 is used because 4 is `PRE`, 5 is claim 3b's
 * (`PRE.seed + 1`), 7 is claim 5d's (`PRE.seed + 3`) and 41 is the carrier's.
 * (Was seed 5, back when `PRE` was seed 1.)
 */
const ROUND = {
    seed: 6, biome: 'pre-sword', count: 2, tries: 3, k: 2, anchortries: 2, tickbudget: 600,
};
const ROUND_BOUNDS = {
    obstacleTarget: ROUND.count,
    triesPerStep: ROUND.tries,
    saturationK: ROUND.k,
    /**
     * ⛓ SLICE 3's BOUND, AND IT IS 2 RATHER THAN 1 FOR THE SAME REASON
     * `tries`/`k` are not their defaults: `DEFAULT_BOUNDS.anchorTriesPerCandidate`
     * IS 1, so a subject at 1 would read back correctly from a writer that never
     * wrote it (trap 235).
     */
    anchorTriesPerCandidate: ROUND.anchortries,
};
const ROUND_BUDGET = { maxTicksPerTarget: ROUND.tickbudget };

/**
 * ⛓⛓⛓ CLAIM 6's SUBJECT — THE CATALOGUE AND VERB 1 (slice 4).
 *
 * ⛓ MEASURED, and the property that matters is asserted below before the claim
 * uses it: the two kept lists are **DISJOINT**, so a restriction the page read,
 * echoed and did not PASS to the loop is visible in the kept list itself and not
 * only in a hash (trap 235: a subject that agrees with its fallback cannot
 * fail). The seed's own re-pick is on the `RESTRICT` literal below.
 *
 * ⚠ The two members were chosen for what they exercise, not for size: the
 * water pool is the only pin-declaring family (`sound`), so the restricted run
 * goes through the whole PIN UNION rather than a quiet corner of it. ⛓ SLICE 4c:
 * the second member was the weigh lock (the pre-sword row that used BOTH
 * sentinel slots) until that template retired; `pit-patch` takes its place and
 * the sentinel half of the claim moved to `procgenPalette.test.js`'s
 * `SLOT_DOOR` rows, which is where the mechanism still has a subject.
 */
const RESTRICT = {
    /**
     * ⛓⛓ RE-PICKED AT SLICE 4c. `wall-gap-lock-weigh` retired, and seed 3 stopped
     * discriminating (restricted and unrestricted now keep the SAME two water
     * pools, so "kept ⊆ restriction" would pass vacuously). RE-SCANNED over
     * seeds 1..12 at target 2 under `pit,water`: eight discriminate and **seed
     * 8's two kept lists are FULLY DISJOINT — `water-pool`+`water-pool`
     * restricted against `wall-segment`+`wall-segment` whole** — the strongest
     * form of the property this claim needs.
     */
    seed: 8,
    biome: 'pre-sword',
    count: 2,
    templates: ['pit-patch', 'water-pool'],
    /**
     * ⛓ THE COARSE SPELLING OF THE SAME SUB-ROSTER. `water` + `pit` are
     * exactly the families of those two templates, so `?families=` must
     * produce the SAME level — and must SURVIVE a press rather than being
     * rewritten as `?templates=`, which would freeze a membership whose whole
     * point is that it is by family.
     */
    families: ['pit', 'water'],
};
const RESTRICT_ROSTER = { axis: 'templates', names: [...RESTRICT.templates].sort() };
const RESTRICT_BOUNDS = { obstacleTarget: RESTRICT.count };

/**
 * ⛓⛓⛓ CLAIM 7's SUBJECTS — VERB 2, THE DIRECTED ATTEMPT (slice 5).
 *
 * ⚖ THE USER'S RULING: *verb 2 PREFERS DISCHARGE; the free loop keeps
 * FIRST-SOLVED.* So the subject has to be one where the two DISAGREE, or the
 * claim is about nothing.
 *
 * ⛓ CHOSEN BY MEASUREMENT (`sweep-seedling-directed-bound.mjs` plus the
 * per-outcome probe recorded in kickoff §12), and the property is asserted
 * below before any claim uses it: on the pre-sword SKELETON at seed 6,
 * `wall-gap-block(ori=v,gap=1)` SOLVES at four successive anchors — 65 ticks
 * each, the walk never touching the door — and DISCHARGES only at the fifth
 * (232 ticks). ⇒ a build that kept the first SOLVED anchor lands at a
 * different cell, and the pane carries FOUR rows reading `REVERTED · SOLVED`
 * that only a discharge-preferring walk can produce.
 *
 * ⛓⛓⛓ **ARC 3 SLICE 2 KILLED THAT PREMISE, AND THE MEASUREMENT IS THE NEW
 * CLAIM** (trap 312). ⚖ Design ruling 17's door law refuses any anchor whose
 * wall is not a CUT — and an anchor where the door SOLVED WITHOUT DISCHARGING
 * *is* a wall the walk went round. So the `solved-only` class is not merely rare
 * now; it is **EMPTY**. MEASURED over both biomes × every template × every
 * declared instantiation × seeds 1..12 × steps {0,2} — **2056 directed attempts,
 * ZERO `KEPT/solved-only`** (1093 `solved-no-verb`, 599 NO_ANCHOR, 286
 * `discharged`, 78 REVERTED). ⇒ no subject in the space can make the two keep
 * policies disagree, and claim 7's discriminator is retired to a MEASURED
 * ABSENCE rather than re-pointed at a seed that does not exist.
 *
 * ⛓ THE SUBJECT MOVES ANYWAY, because seed 6 now has exactly ONE legal anchor
 * for this instance (its goal (3,1) makes every column east of 2 a decoration
 * door) and the click block needs several. Re-scanned (pre-sword step 0, seeds
 * 1..12, six door instantiations, ≥3 legal anchors and a KEEPING anchor that is
 * not the searched one): **seed 9** carries six legal anchors — (2,1) (3,1)
 * (4,1) (5,1) (6,1) (7,1) — the SEARCH lands on (4,1), and (2,1) (3,1) (5,1)
 * (6,1) all KEEP while (7,1) REVERTS.
 *
 * ⚠ AND THE PARAMETERS ARE NON-DEFAULT IN BOTH POSITIONS (`ori=h,gap=4` is the
 * declared default), so a URL that dropped its parameters rebuilds a visibly
 * different instance rather than coinciding with the right one — trap 235, at
 * the directive.
 */
/**
 * ⛓⛓⛓ **RE-POINTED AT A SURVIVING TEMPLATE AT SLICE 4c.** `wall-gap-block`
 * retired; `wall-segment(ori=v,len=4)` takes its place and keeps the property
 * that made the old instance a subject — **NON-DEFAULT IN BOTH POSITIONS**
 * (`ori=h,len=3` is the declared default), so a URL that dropped its parameters
 * rebuilds a visibly different instance rather than coinciding with the right
 * one (trap 235, at the directive).
 *
 * ⛔ AND THE DISCHARGE CLAIM IS GONE WITH THE POLICY. `PREFER_DISCHARGE` retired
 * on Seedling in this slice (arc-3 §13.5): every directive runs under
 * `first-solved`, `walkAnchors` never asks the predicate, and `keptKind` is
 * `null` — which `levelGenerator`'s own docblock calls the ANSWER (*the walk
 * never asked*) rather than a missing value. The spec therefore names no policy
 * at all; naming one is REFUSED by `applyDirective`.
 */
const DIRECT = {
    /**
     * ⛔⛔ **AND THE BASE MOVED FROM STEP 0 TO STEP 3, WHICH IS THE FINDING.**
     * Claim 7's pane assertion needs a walk longer than ONE anchor, and slice
     * 4c measured that **no step-0 subject can produce one** — every
     * instantiation of every remaining template over seeds 1..20, directed onto
     * the BARE skeleton, walks exactly one anchor. The three families that could
     * SEAL a bare room were the door templates; what remains is decoration, and
     * a bare 10x10 room solves around all of it at every anchor.
     *
     * ⇒ the subject is a room that ALREADY HOLDS OBSTACLES, which is where the
     * bound was ever spent for real. RE-SCANNED at steps 3 and 5: **pre-sword
     * seed 2 at step 3 walks THREE of five offered anchors — `d1a1` REVERTED,
     * `d1a2` REVERTED, `d1a3` KEPT at (8,5)** — the richest of the five hits and
     * the only one that ends in a KEEP.
     */
    seed: 2,
    biome: 'pre-sword',
    step: 3,
    bounds: { obstacleTarget: 3 },
    template: 'wall-segment',
    params: { ori: 'v', len: 4 },
};
const DIRECT_SPEC = {
    template: DIRECT.template,
    params: DIRECT.params,
    anchor: null,
    bound: DIRECTED_ANCHOR_TRIES,
};
/**
 * ⛓ THE OTHER THREE OUTCOMES, each measured to be REACHABLE at these
 * coordinates (the probe swept seeds 1..12 x steps 0/2/4/6 x six templates):
 *   · NO_ANCHOR   — a filled room offers a door no legal cell at all;
 *   · REVERTED    — anchors exist, the oracle refuses every one;
 *   · solved-only — it has a verb and no anchor within the bound discharged it.
 * ⛔ ILLEGAL_PLACEMENT is NOT among them and its absence is NAMED rather than
 * left looking untested — see claim 7d.
 *
 * ⛓⛓ **THE `REVERTED` SUBJECT MOVED IN SLICE 6b, AND MY OWN ROW CAUGHT IT.** ⚖
 * The user widened the connectivity pre-check to every kind, so `empty` runs it
 * too and pre-sword seed 2's step-6 ladder is one of the 22 seed→level pairs
 * that expired (GENERATE-UI ruling 5). At the new step-6 record the same door
 * has no legal cell at all, so the row reported `NO_ANCHOR` where it asserts
 * `REVERTED` — an outcome class silently going untested is exactly what this
 * arm exists to prevent. ⛔ REPLACED, NEVER RELAXED (trap 62): the same probe
 * was re-run (seeds 1..12 x steps 0/2/4/6 x the six templates) and **seed 4 at
 * step 4** keeps the SAME template and parameters, walking 2 of 2 anchors to a
 * revert. (Was seed 2 step 6.) ⚠ Seed 4 pre-sword is not among the pairs that
 * moved at either count, so the subject is not one this slice destabilised.
 */
/**
 * ⛓⛓⛓ CLAIM 8's SUBJECTS — CLICK-TO-ANCHOR (slice 6).
 *
 * ⛔ THE CLICKED CELL IS CHOSEN BY MEASUREMENT AND EVERY PROPERTY IS ASSERTED
 * BELOW BEFORE THE CLAIM USES IT (trap 235, at the anchor). ⛓ RE-MEASURED AT
 * ARC 3 SLICE 2 with `DIRECT`: on pre-sword **seed 9**'s skeleton the plain
 * vertical door is legal at exactly six cells — (2,1) (3,1) (4,1) (5,1) (6,1)
 * (7,1) — and a SEARCHED directive lands on **(4,1)**. So **(6,1)** is:
 *   · LEGAL, and its attempt KEEPS (or the claim would be the illegal case
 *     wearing the wrong name — and (7,1), the old cell, is the one anchor of
 *     the six that REVERTS, so it would have been exactly that);
 *   · NOT the searched answer — a build that ignored the clicked cell and
 *     searched would land on (4,1) and red the value check;
 *   · not the START (1,1), not the GOAL (8,5), and not the first interior cell
 *     that a naive implementation would produce by accident.
 *
 * `ILLEGAL_CLICK` is seed 9's GOAL cell, so the refusal is a class the model
 * names rather than a footprint that happens not to fit.
 */
/**
 * ⛓⛓ RE-MEASURED AT SLICE 4c ON `DIRECT`'s OWN BASE (pre-sword seed 2 at step
 * 3). That room offers **five** legal cells for the subject instance — (5,4)
 * (8,4) (1,5) (5,5) (8,5) — and all five were clicked: **(5,4) and (1,5)
 * REVERT**, the other three KEEP, and a SEARCHED directive lands on **(8,5)**.
 * ⇒ **(8,4)** is LEGAL, KEEPS, is NOT the searched answer, is not the START
 * (1,1) and is not the GOAL — which is **(6,5)** here, and is therefore
 * `ILLEGAL_CLICK`.
 */
const CLICK = { tx: 8, ty: 4 };
const ILLEGAL_CLICK = { tx: 6, ty: 5 };

/**
 * ⛓⛓ RE-SCANNED AT SLICE 4c over seeds 1..8 x steps {0,2,4} x all 23
 * instantiations — 552 directed attempts: **533 KEPT, 14 NO_ANCHOR, 5
 * REVERTED, 0 ILLEGAL_PLACEMENT**, and `keptKind` is `null` on every one of
 * them (see `DIRECT`'s docblock). The two cases below are the first NO_ANCHOR
 * and the REVERTED that walks its WHOLE offered list.
 */
const NO_ANCHOR_CASE = { seed: 2, biome: 'pre-sword', step: 2,
    template: 'water-pool', params: { w: 3, h: 3 } };
/**
 * ⛓⛓ RE-PICKED at PROCGEN ELEMENTS arc 3 slice 1 (trap 285 — the scan, the
 * target and the count are named). `arrow-lane` leaving the roster moved every
 * draw, and seed 4's `wall-gap-block(ori=v,gap=1)` at step 4 now reports
 * NO_ANCHOR rather than REVERTED — a subject that no longer reaches the class
 * this claim is about.
 *
 * SCANNED: pre-sword, seeds 1..8 × steps {0, 2, 4} × six door instantiations
 * (`wall-gap-block` ori×gap ∈ {v1, h2, v3, h5}, `wall-gap-lock-weigh` ori×2),
 * for a DIRECTED attempt whose outcome is REVERTED — **exactly THREE remain**:
 * `wall-gap-lock-weigh(ori=h)` seed 1 step 2 (walked 1 of 1),
 * `(ori=v)` seed 4 step 2 (1 of 1), and `(ori=v)` seed 7 step 0 (**5 of 5**).
 *
 * ⛔ SEED 7 IS TAKEN because it WALKS ITS WHOLE OFFERED LIST — 5 anchors
 * offered, 5 walked, then REVERTED — so the claim below grades a walk that
 * really exhausted the room rather than one anchor that happened to fail.
 * ⚠ AND `wall-gap-block` NO LONGER PRODUCES ONE AT ALL in that space: the
 * REVERTED class is now reached only through the weigh lock. Named rather than
 * left for the next slice to rediscover.
 *
 * ⛓⛓⛓ **RE-SCANNED AT SLICE 4c, and both of those templates are gone.** Over
 * seeds 1..8 x steps {0,2,4} x all 23 remaining instantiations — 552 directed
 * attempts — the class is reached **FIVE times**: `water-pool(3,2)` and
 * `pit-patch(3,2)` at seed 2 step 4 (2 of 2 each), the same two at seed 4 step 4
 * (1 of 1 each), and `wall-segment(ori=v,len=5)` at **seed 7 step 4, walking 2
 * of 2**. ⛔ THE LAST IS TAKEN, by the SAME tie-break the old subject won on: it
 * walks its whole offered list and then reverts, so the claim grades a walk that
 * really exhausted the room rather than one anchor that happened to fail.
 */
const REVERTED_CASE = { seed: 7, biome: 'pre-sword', step: 4,
    template: 'wall-segment', params: { ori: 'v', len: 5 } };
/**
 * ⛓⛓⛓ **RETIRED AT ARC 3 SLICE 2 — THE CLASS IS EMPTY, AND THAT IS THE
 * MEASUREMENT** (trap 312: replace a vacated claim with the sentence that still
 * has content).
 *
 * This was `pre-sword seed 2 step 0 wall-gap-lock-weigh(ori=v)`, kept with
 * `keptKind: 'solved-only'` — a door the room tolerated without anyone clearing
 * it. ⚖ Design ruling 17's door law refuses exactly that: a wall the walk goes
 * ROUND is not a CUT. Seed 2's subject now REVERTS, and no seed replaces it —
 * measured over **2056 directed attempts** (both biomes × every template ×
 * every declared instantiation × seeds 1..12 × steps {0,2}): 1093
 * `KEPT/solved-no-verb`, 599 `NO_ANCHOR`, 286 `KEPT/discharged`, 78 `REVERTED`,
 * and **ZERO `KEPT/solved-only`**.
 *
 * ⛓⛓⛓ **AND THE RESIDUE IT LEFT WAS ANSWERED IN SLICE 4c: NO.** Its last line
 * asked *"is `PREFER_DISCHARGE` still earning its complexity on Seedling?"* — ⚖
 * the user ruled it OUT (arc-3 §13.5), for two reasons that compound: the class
 * this row measured empty, and the retirement of the last three templates with a
 * VERB at all. `keptKind` is now `null` on EVERY directed attempt because
 * `walkAnchors` never asks the predicate under `first-solved`.
 *
 * ⛔ SO THE ROW BELOW GRADES A STRONGER ABSENCE, and it is one that can still
 * FAIL. It no longer asks *"did any attempt come back `solved-only`"* — nothing
 * can, by a code path that does not execute — it asks that **no directed attempt
 * reports a `keptKind` at all**, which is the observable form of *the policy is
 * gone*. A build that quietly restored the preference (or a caller that slipped
 * a `keepPolicy` past `applyDirective`'s refusal) would produce a non-null value
 * here and red. ⛓ The page's `describeKeptKind` readout is deliberately NOT
 * deleted: it still has three live branches for the MAZE, and
 * `watchGenerate.test.js` drives all of them on synthetic states.
 */
const SOLVED_ONLY_PROBE = Object.freeze({
    biome: 'pre-sword', seeds: [1, 2, 3, 4, 5, 6], steps: [0, 2],
    instances: Object.freeze([
        ['wall-segment', { ori: 'v', len: 4 }], ['wall-segment', { ori: 'h', len: 2 }],
        ['water-pool', { w: 3, h: 3 }], ['water-pool', { w: 1, h: 1 }],
        ['pit-patch', { w: 3, h: 2 }], ['pit-patch', { w: 1, h: 1 }],
    ]),
});

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
const GEN_ROUTE = '/__generated-payload.json';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
const json = (v) => JSON.stringify(v);

// ── node's own answers, first: the anchors every claim is measured against ──

const nodeSkeleton = generateStep({ ...PRE, step: 0 });
const nodeStep1 = generateStep({ ...PRE, step: 1 });
const nodeFull = generateStep({ ...PRE, step: PRE.count });
const nodeCarrier = generateStep({ ...CARRIER, step: CARRIER.count });
const nodeRound = generateStep({
    seed: ROUND.seed, biome: ROUND.biome, step: ROUND.count,
    bounds: ROUND_BOUNDS, budget: ROUND_BUDGET,
});
const nodeRoundSkeleton = generateStep({ seed: ROUND.seed, biome: ROUND.biome, step: 0 });

const payload = {
    generator: 'scripts/procgen/check-seedling-editor-generate.mjs',
    seed: PRE.seed,
    biome: PRE.biome,
    bounds: nodeFull.bounds,
    level: nodeFull.record,
    trace: nodeFull.trace,
};

console.log(`node: skeleton goal cell (${nodeSkeleton.model.goalCell.tx},`
    + `${nodeSkeleton.model.goalCell.ty}); step 1 keeps `
    + `${nodeStep1.summary.kept.map((k) => k.template).join(', ')}; target ${PRE.count} keeps `
    + `${nodeFull.summary.kept.map((k) => k.template).join(', ')} over `
    + `${nodeFull.summary.attempts} attempt(s)`);
console.log(`node: carrier seed ${CARRIER.seed} keeps `
    + `${nodeCarrier.summary.kept.map((k) => k.template).join(', ')}`);
/**
 * ⛓⛓⛓ THE CARRIER'S OWN PROPERTY, RE-AIMED AT SLICE 4c. It used to be *"the
 * level keeps a KILL TEMPLATE"*; the kill family retired into the `killgate`
 * ELEMENT, so what makes this level a carrier is that its ELEMENT is a
 * CERTIFIED kill gate — which is what banks the scratch clear no tape can
 * declare. ⛔ Asserted BEFORE claim 3 uses it, and both halves: the head that
 * was drawn, and that its certification SOLVED (an uncertified element is
 * DROPPED and the walk would have nothing to clear).
 */
check(nodeCarrier.model.elementHead?.name === 'killgate',
    'the carrier subject\'s element really IS a KILL GATE — otherwise claim 3 is vacuous',
    `${nodeCarrier.model.elementHead?.name}; kept `
    + `${nodeCarrier.summary.kept.map((k) => `${k.template}(${k.family})`).join(', ')}`);
check(nodeCarrier.summary.elements?.certification?.certified === true,
    '…and it CERTIFIED, so the gate is in the level rather than dropped',
    json(nodeCarrier.summary.elements?.certification?.gap ?? 'certified'));
const nodeRestricted = generateStep({
    seed: RESTRICT.seed, biome: RESTRICT.biome, step: RESTRICT.count,
    bounds: RESTRICT_BOUNDS, roster: RESTRICT_ROSTER,
});
const nodeUnrestricted = generateStep({
    seed: RESTRICT.seed, biome: RESTRICT.biome, step: RESTRICT.count, bounds: RESTRICT_BOUNDS,
});
const PRE_ROSTER = paletteFor(RESTRICT.biome).templates.map((t) => t.name);
const PRE_EXCLUDED = paletteFor(RESTRICT.biome).excluded;
{
    const restrictedKept = nodeRestricted.summary.kept.map((k) => k.template);
    const wholeKept = nodeUnrestricted.summary.kept.map((k) => k.template);
    check(nodeRestricted.summary.keptCount === RESTRICT.count && !nodeRestricted.saturated,
        'the RESTRICT subject really REACHES its target under the restriction',
        `kept ${nodeRestricted.summary.keptCount}/${RESTRICT.count}, stop ${nodeRestricted.stop}`);
    check(restrictedKept.every((t) => RESTRICT.templates.includes(t))
        && wholeKept.every((t) => !RESTRICT.templates.includes(t)),
        '⛔ AND THE TWO KEPT LISTS ARE DISJOINT — a restriction the page echoed but did not '
        + 'PASS to the loop shows up in the kept list, not only in a hash',
        `restricted [${restrictedKept.join(', ')}] vs whole [${wholeKept.join(', ')}]`);
}
check(nodeRound.summary.keptCount === ROUND.count && !nodeRound.saturated,
    'the ROUND-TRIP subject really REACHES its target — a saturated one would let claim 5 '
    + 'assert about a step nobody asked for',
    `kept ${nodeRound.summary.keptCount}/${ROUND.count}, stop ${nodeRound.stop}`);

/**
 * ⛓⛓ NODE'S OWN ANSWER FOR THE DIRECTED SUBJECTS — every browser assertion is
 * measured against these, never against a literal.
 *
 * ⛔ AND THE SUBJECT'S OWN PROPERTIES ARE ASSERTED FIRST (trap 235): if seed 6
 * did not pass over a SOLVING anchor on its way to a discharging one, claim 7
 * would pass on a build that ignored the ruling entirely.
 */
const nodeDirect = generateWithDirectives({
    seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
    directed: [DIRECT_SPEC],
});
{
    const d = nodeDirect.directives[0];
    check(d.outcome === 'KEPT' && d.keptKind === null,
        '⛓ the DIRECTED subject really KEEPS, and reports NO `keptKind` — arc-3 slice 4c '
        + 'retired the discharge preference on Seedling, so `null` is the walk\'s answer '
        + 'rather than a missing value', `${d.outcome}/${d.keptKind}`);
    /**
     * ⛓⛓⛓ **THIS ROW USED TO BE THE DISCRIMINATOR AND ITS CLASS IS NOW EMPTY.**
     * It asserted that the walk PASSED OVER an anchor that SOLVED on its way to
     * one that DISCHARGED — the signature only a discharge-preferring walk can
     * produce. ⚖ Design ruling 17 removed that class from the generator: an
     * anchor where a door SOLVES without discharging is a wall the walk went
     * ROUND, and the cut law refuses it before any solve. Measured over 2056
     * directed attempts (both biomes × every instantiation × seeds 1..12 ×
     * steps {0,2}): **ZERO `KEPT/solved-only`**.
     *
     * ⛔ SO IT IS REPLACED BY THE CLAIM THAT STILL HAS CONTENT (trap 312): the
     * walk really WALKED — more than one anchor was offered and adjudicated —
     * and every anchor it passed over was REVERTED BY THE ORACLE rather than
     * silently skipped. A build that stopped at anchor 1 still reds here.
     */
    const walkedRows = nodeDirect.trace.filter((r) => r.directive === 1);
    const passedOver = walkedRows.filter((r) => r.outcome === 'REVERTED');
    check(d.anchorsOffered > 1 && d.anchorsWalked >= 1
        && walkedRows.length === d.anchorsWalked
        && passedOver.every((r) => r.verdict !== null),
        '⛔ AND THE WALK REALLY WALKED — more than one anchor was OFFERED, every anchor '
        + 'walked is a trace row, and every passed-over anchor carries the ORACLE\'s own '
        + 'verdict rather than being skipped silently. ⛓ The old form of this row asserted '
        + 'a passed-over anchor that SOLVED; the door law made that class EMPTY (0 of 2056 '
        + 'directed attempts), so it is replaced rather than re-pointed',
        `${d.anchorsWalked} of ${d.anchorsOffered} walked, ${passedOver.length} reverted, `
        + `then discharged`);
    const base = paletteFor(DIRECT.biome).templates.find((t) => t.name === DIRECT.template);
    check(base.params.some((pp) => DIRECT.params[pp.key] !== pp.default),
        '⚠ and its parameters DIFFER from the declared defaults, so a URL that dropped '
        + 'them would rebuild a different instance rather than coincide with this one',
        `${json(DIRECT.params)} vs defaults `
        + `${json(Object.fromEntries(base.params.map((pp) => [pp.key, pp.default])))}`);
}

/**
 * ⛓⛓⛓ THE `keptKind` ABSENCE, MEASURED HERE RATHER THAN ASSERTED IN A
 * DOCBLOCK — and BOUNDED OUT LOUD (`feedback_bounded_sweep_must_name_what_it_
 * bounded`). The full scan behind slice 4c's tally was 552 directed attempts
 * over seeds 1..8 × steps {0,2,4} × all 23 instantiations (533 KEPT, 14
 * NO_ANCHOR, 5 REVERTED, 0 ILLEGAL_PLACEMENT, and `keptKind` null on every
 * one); this row re-drives a stated SLICE of it — pre-sword, 6 seeds × 2 steps
 * × 6 instantiations = **72 attempts** — because a browser row may not spend
 * the full sweep, and a row that claimed the whole space while checking part of
 * it would be worse than one that says which part.
 */
{
    let solvedOnly = 0;
    let attempts = 0;
    for (const seed of SOLVED_ONLY_PROBE.seeds) {
        for (const step of SOLVED_ONLY_PROBE.steps) {
            for (const [template, params] of SOLVED_ONLY_PROBE.instances) {
                let out;
                try {
                    out = generateWithDirectives({
                        seed, biome: SOLVED_ONLY_PROBE.biome, step,
                        directed: [{ ...DIRECT_SPEC, template, params }],
                    });
                } catch { continue; }
                attempts += 1;
                // ⛓ SLICE 4c: ANY non-null `keptKind`, not just `solved-only`.
                // Under `first-solved` the walk never asks the predicate, so a
                // value here means the preference came back.
                if (out.directives[0]?.keptKind != null) solvedOnly += 1;
            }
        }
    }
    check(attempts >= 60 && solvedOnly === 0,
        '⛓⛓⛓ NO DIRECTED ATTEMPT REPORTS A `keptKind` AT ALL — ⚖ `PREFER_DISCHARGE` '
        + 'retired on Seedling in arc-3 slice 4c, so `walkAnchors` never asks the '
        + 'discharge predicate and `null` is the ANSWER rather than a missing value. '
        + '⛔ Graded as an ABSENCE on purpose: the readout still KNOWS the three kinds '
        + '(the MAZE has the policy), and this row is what reds if the preference — or a '
        + '`keepPolicy` slipped past `applyDirective`\'s refusal — comes back',
        `${solvedOnly} non-null keptKind of ${attempts} directed attempts (pre-sword, seeds `
        + `${SOLVED_ONLY_PROBE.seeds.join(',')}, steps ${SOLVED_ONLY_PROBE.steps.join(',')}, `
        + `${SOLVED_ONLY_PROBE.instances.length} instantiations)`);
}

// ── node's answers for CLAIM 8, and the clicked cell's own properties ──
const CLICK_SPEC = { ...DIRECT_SPEC, anchor: CLICK, bound: 1 };
const ILLEGAL_SPEC = { ...DIRECT_SPEC, anchor: ILLEGAL_CLICK, bound: 1 };
const nodeClicked = generateWithDirectives({
    seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
    directed: [CLICK_SPEC],
});
const nodeIllegal = generateWithDirectives({
    seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
    directed: [ILLEGAL_SPEC],
});
{
    const skel = generateStep({
        seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
    });
    const instance = paletteFor(DIRECT.biome).templates
        .find((t) => t.name === DIRECT.template).instantiate(null, DIRECT.params);
    check(skel.model.refusalAt(skel.record, instance, CLICK.tx, CLICK.ty) === null
        && nodeClicked.directives[0].outcome === 'KEPT',
        `⛓ the CLICKED cell (${CLICK.tx},${CLICK.ty}) is LEGAL for this instance and the `
        + 'attempt at it is KEPT — otherwise claim 8c is the illegal case under another name',
        `${nodeClicked.directives[0].outcome}/${nodeClicked.directives[0].keptKind}`);
    check(json(nodeDirect.directives[0].at) !== json(CLICK)
        && json(skel.model.goalCell) !== json(CLICK)
        && !(CLICK.tx === 1 && CLICK.ty === 1),
        '⛔ AND IT IS NOT WHERE A SEARCH GOES, not the goal, and not (1,1) — a build that '
        + 'ignored the clicked cell would land elsewhere rather than coincide with it',
        `search lands ${json(nodeDirect.directives[0].at)}, goal ${json(skel.model.goalCell)}, `
        + `click ${json(CLICK)}`);
    check(json(nodeClicked.record) !== json(nodeDirect.record),
        '⛔ …so the clicked level and the SEARCHED level are different levels',
        `clicked kept at ${json(nodeClicked.directives[0].at)}`);
    check(json(skel.model.goalCell) === json(ILLEGAL_CLICK)
        && nodeIllegal.directives[0].outcome === 'ILLEGAL_PLACEMENT'
        && json(nodeIllegal.record) === json(skel.record),
        `⛓ and the ILLEGAL cell (${ILLEGAL_CLICK.tx},${ILLEGAL_CLICK.ty}) is this seed's GOAL `
        + 'cell — ILLEGAL_PLACEMENT, and the record does not move',
        `${nodeIllegal.directives[0].outcome}`);
}

// ── the browser ───────────────────────────────────────────────────────

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot({ routes: { [GEN_ROUTE]: Buffer.from(`${json(payload)}\n`) } });
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 12 — THE PAYLOAD CHANNEL, AS A ROUTE THIS ROW FULFILS
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §3.9 took `?directed=` off the address bar and gave the directive list to
 * the PAYLOAD, so every claim below that used to copy a URL now copies a
 * payload: the page's OWN `window.__editorGenerated` (what `#genDownload`
 * writes) is served back to it at `?gen=`.
 *
 * ⛔ FULFILLED BY PLAYWRIGHT rather than added to `serveRepoRoot`'s `routes`,
 * because the payload is built IN THE BROWSER, mid-run — a static route map is
 * fixed when the server starts and could not carry it. ⚠ The predicate matches
 * on the PATHNAME, never as a glob: `?gen=/__constructed-payload.json` puts the
 * route's own name in the DOCUMENT's query string, and a `**\/…` glob
 * intercepts the NAVIGATION and serves JSON as the page (measured on the maze
 * row; it reads as a STUCK wait with no console error).
 */
const PAYLOAD_ROUTE = '/__constructed-payload.json';
let servedPayload = null;
await page.route(
    (u) => u.pathname === PAYLOAD_ROUTE,
    (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: `${json(servedPayload)}\n`,
    }),
);

/**
 * ⛔ WAIT FOR THE LADDER TO STOP, NOT FOR IT TO START.
 *
 * `window.__editorGenerate` appears at the SKELETON, before RUN-ALL has run a
 * single rung, and the driver yields a frame per step — so a wait on the
 * readout alone can read a mid-ladder page and assert about a URL that is
 * about to be rewritten. The buttons are disabled for exactly the span of the
 * run (`busy()`), which is the honest "it finished" marker.
 */
const settled = (step, seed = null) => page.waitForFunction(
    ([s, sd]) => window.__editorGenerate?.step === s
        && (sd === null || window.__editorGenerate.seed === sd)
        && !document.getElementById('genRunAll').disabled,
    [step, seed], { timeout: 300000 });

/**
 * Load a GENERATE view and wait for the arm's own readout.
 *
 * ⛓⛓ **SLICE 6's SWEEP FIXED THIS ONE (trap 246).** It waited only for
 * `window.__editorGenerate` to EXIST — which the arm publishes at the
 * SKELETON, before `?run=1`'s ladder and before `?gen=`'s comparison — and
 * then RETURNED that reading to the caller. Four claims (2, 3, 3b and 6e)
 * asserted on the returned object, so on a box slow enough to schedule the
 * poll between the skeleton and the run they read step 0 and reddened a page
 * that was about to be perfectly correct. Claim 4 hit exactly this and was
 * repaired in slice 4; the same hole was still open here four call sites over.
 *
 * ⇒ pass `step` (and `seed` when the load changes it) whenever the URL names a
 * RUN, and the read happens after `settled()` — the CLAIM's own field plus a
 * not-busy signal, which is the closing pattern.
 */
async function load(query, { timeout = 300000, step = null, seed = null } = {}) {
    errors.length = 0;
    const url = `${origin}${PAGE_PATH}?${query}`;
    console.log(`page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate, null, { timeout });
    if (step !== null) await settled(step, seed);
    return page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated?.level ?? null,
        trace: window.__editorGenerated?.trace ?? null,
        paneRows: [...document.querySelectorAll('#genTrace .tr')].map((e) => e.textContent),
        paneVisible: !document.getElementById('genTraceSection').hidden,
        panelVisible: !document.getElementById('generatePanel').hidden,
    }));
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 12 — ARM-AND-CLICK, THE PAGE'S OWN EXPLICIT-ANCHOR AFFORDANCE
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §3.9 retired `?directed=`, and the claims that used it to place a template
 * at a NAMED CELL (the two sealing subjects) are re-cut onto GENERATE-UI slice
 * 6's own control: press AT…, then click the tile. ⛔ Replaced, not relaxed —
 * the CLAIM is the same `ILLEGAL_PLACEMENT` sentence at the same measured cell.
 *
 * ⚠ THE CLICK BUILDS `{bound: 1}` (`watchViewer`'s `spec`), where the retired
 * URL spelled `@1s`. ⛓ SLICE 4c: it used to build a `keepPolicy` too, and does
 * not any more — `PREFER_DISCHARGE` retired on Seedling and `applyDirective`
 * REFUSES a spec that names a policy. The node side below is built the same
 * way, so the two are the same directive rather than two that happen to agree.
 *
 * ⛔ AND THE RECTANGLE IS RE-READ BEFORE EVERY CLICK: the identity line above
 * the canvas grows as clauses appear, the header re-wraps and the canvas moves
 * DOWN (the maze row's §10.5 measurement, one substrate over).
 */
const armTemplate = (template, params) => page.evaluate(({ t, p }) => {
    const row = [...document.querySelectorAll('#genRoster .catRow')]
        .find((r) => r.querySelector(`button[data-arm="${t}"]`));
    for (const [k, v] of Object.entries(p)) {
        row.querySelector(`select[data-param="${k}"]`).value = String(v);
    }
    row.querySelector(`button[data-arm="${t}"]`).click();
}, { t: template, p: params });

/** ⛓ The LAST PIXEL of a tile — an off-by-one is invisible to a middle click. */
const clickTile = async (tx, ty) => {
    const geo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        return {
            left: r.left, top: r.top, width: r.width, height: r.height,
            cols: window.__editorGenerated.level.width,
            rows: window.__editorGenerated.level.height,
        };
    });
    await page.mouse.click(
        geo.left + ((tx + 1) * geo.width) / geo.cols - 1,
        geo.top + ((ty + 1) * geo.height) / geo.rows - 1,
    );
};

/** The five generate controls and the address bar, as the browser holds them. */
const panelOf = () => page.evaluate(() => ({
    url: window.location.search,
    seed: document.getElementById('genSeed').value,
    biome: document.getElementById('genBiome').value,
    count: document.getElementById('genCount').value,
    tries: document.getElementById('genTries').value,
    k: document.getElementById('genK').value,
    anchortries: document.getElementById('genAnchorTries').value,
    // ⛓ SLICE 4: the catalogue's ticks are a CONTROL like the six above, so
    // they travel with them through the round trip.
    checked: [...document.querySelectorAll('#genRoster input[data-template]')]
        .filter((b) => b.checked).map((b) => b.dataset.template),
}));

/**
 * ⛓ THE CATALOGUE AS THE BROWSER HOLDS IT — every assertion about it is built
 * from THIS against node's own palette, never against a literal count.
 */
const catalogueOf = () => page.evaluate(() => ({
    boxes: [...document.querySelectorAll('#genRoster input[data-template]')]
        .map((b) => b.dataset.template),
    families: [...document.querySelectorAll('#genRoster .catFamily .catHead')]
        .map((e) => e.textContent),
    excluded: [...document.querySelectorAll('#genRoster .catRow.excluded')]
        .map((e) => e.textContent),
    excludedInputs: document.querySelectorAll('#genRoster .catRow.excluded input').length,
    note: document.getElementById('genRosterNote').textContent,
    disabled: ['genStep', 'genRunAll', 'genReset']
        .map((id) => document.getElementById(id).disabled),
    /**
     * ⛔ THE CONTAINER CHECK. `#layers` holds one input per overlay layer and
     * three acceptance rows ENUMERATE it; `#bootForm`'s checkboxes are counted
     * by the switch row. A catalogue checkbox in either box would red a row
     * that has nothing to do with this slice (the group-B lesson).
     */
    inLayers: document.getElementById('layers')
        .querySelectorAll('input[data-template]').length,
    inBootForm: document.getElementById('bootForm')
        ? document.getElementById('bootForm').querySelectorAll('input[data-template]').length
        : 0,
    layersInputs: document.querySelectorAll('#layers input').length,
}));

// ── CLAIM 0: the arm mounts, and the SKELETON is what step 0 shows ────
{
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}`;
    const web = await load(q);
    check(web.panelVisible && web.paneVisible,
        'the GENERATE panel and the generation pane are both mounted');
    check(web.gen.status === 'ok', 'the arm reached a state without refusing',
        web.gen.message ?? web.gen.status);
    check(web.gen.step === 0 && web.gen.genRows === 0,
        'it lands on the SKELETON — step 0, no generation rows yet',
        `step ${web.gen.step}, ${web.gen.genRows} row(s)`);
    check(json(web.level) === json(nodeSkeleton.record),
        'and the skeleton the page shows is node\'s own skeleton, byte for byte');

    // ── CLAIM 1: ONE PRESS OF STEP ───────────────────────────────────
    await page.click('#genStep');
    await page.waitForFunction(() => window.__editorGenerate?.step === 1,
        null, { timeout: 300000 });
    const stepped = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    check(json(stepped.level) === json(nodeStep1.record),
        'STEP once → the level `generateSeedlingLevel(target=1)` gives, byte for byte');
    check(json(stepped.trace) === json(nodeStep1.trace),
        '…and its whole trace too',
        `${stepped.trace.length} row(s)`);
    check(stepped.gen.agreement.compared && stepped.gen.agreement.agrees,
        'the DISPLAY solve agrees with the trace row that accepted the record',
        `display ${stepped.gen.agreement.displayTicks}t, trace `
        + `${stepped.gen.agreement.traceTicks}t`);
}

// ── CLAIM 2: RUN-ALL, and the refusals VERBATIM ──────────────────────
{
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}&run=1`;
    // ⛓ SLICE 6's SWEEP: the URL names a RUN, so the read waits for the LADDER
    // to settle — not for the readout to exist at the skeleton (trap 246).
    const web = await load(q, { step: PRE.count });
    check(web.gen.step === PRE.count, `RUN-ALL reached step ${PRE.count}`,
        `step ${web.gen.step}, stop ${web.gen.stop}`);
    check(json(web.level) === json(nodeFull.record),
        'the finished level is node\'s, byte for byte');
    check(json(web.trace) === json(nodeFull.trace),
        'the whole generation trace is node\'s, byte for byte',
        `${web.trace.length} row(s)`);
    check(web.paneRows.length === nodeFull.trace.length,
        'the pane renders ONE ROW PER ATTEMPT — kept and vetoed alike',
        `${web.paneRows.length} rendered, ${nodeFull.trace.length} in the trace`);

    /**
     * ⛔ VERBATIM, and this is trap 202's channel. The danger record is empty
     * on every success BY CONSTRUCTION, so a veto's own reason text is the
     * only evidence the pane carries — a page that summarised it would be
     * showing a lossy copy of the whole content.
     */
    const nodeVetoes = nodeFull.trace.filter((r) => r.outcome !== 'KEPT' && r.reasonText);
    check(nodeVetoes.length > 0,
        '⛔ THE SUBJECT REALLY VETOES SOMETHING — otherwise the claim below passes '
        + 'over an empty list',
        `${nodeVetoes.length} veto(es) with text`);
    check(json(web.gen.vetoes.map((v) => v.reasonText).filter(Boolean))
        === json(nodeVetoes.map((r) => r.reasonText)),
        `every veto's reason text is VERBATIM node's (${nodeVetoes.length} veto(es) with text)`,
        nodeVetoes.length
            ? `first: ${nodeVetoes[0].reasonText.slice(0, 90)}…`
            : '(none)');
    check(errors.length === 0, 'no page errors during the RUN-ALL',
        errors.join(' | ') || 'none');
}

// ── CLAIM 3: ⛓⛓⛓ THE SCRUB FORK, in a browser ───────────────────────
{
    const q = `source=generate&seed=${CARRIER.seed}&biome=${CARRIER.biome}`
        + `&count=${CARRIER.count}&run=1`;
    const web = await load(q, { step: CARRIER.count, seed: CARRIER.seed });
    check(web.gen.status === 'ok' && web.gen.verdict === 'SOLVED',
        'the CARRIER level solves in the page', `${web.gen.verdict} in ${web.gen.ticks} ticks`);
    check((web.gen.scratchClears ?? []).length > 0,
        'its solve banks a SCRATCH CLEAR no tape can declare — the fork\'s precondition',
        json(web.gen.scratchClears?.map((c) => `${c.by} → ${c.lock} @${c.at}`) ?? []));
    check((web.gen.strategies ?? []).includes('kill'),
        'and the clearer is DISCHARGED on the route (⚖ §12.1\'s standard: a RECORD in '
        + 'the FINAL solve, never a keep-count)',
        json(web.gen.strategies));
    /**
     * ⛔ THE CLAIM ITSELF. `collectRun` RETURNS a mid-walk throw rather than
     * raising it, so the pre-slice-5 failure is a plausible SHORT replay with
     * an error under it — never a crash. The frame count is what shows it.
     */
    check(web.gen.frames === web.gen.ticks + 1,
        'the SCRUB DRAWS EVERY FRAME of the walk it solved (the scrub fork, §13.4)',
        `${web.gen.frames} frame(s) for a ${web.gen.ticks}-tick walk`);
    /**
     * ⛓⛓⛓ ARC 3 SLICE 2c — THE KILL LOCK'S ✕, READ OFF THE OVERLAY AT TWO
     * TICKS. ⚖ The user's own report (2026-08-16): every other lock gets a
     * struck-through box when its group is pressed and this one never did.
     *
     * ⛔ A VALUE CLAIM, NOT AN ECHO (trap 269 / arc-2 §11's §317). The subject
     * is `drawn.worldstate.changes` — what the DRAW ITSELF put on the canvas
     * on the tick the scrubber is showing — not a sentence about it and not
     * the run's own ledger. The tick comes from the run's `scratchClears[].at`
     * above, so the two ends of the claim are independent: the ENGINE says
     * when the flag went off, the PICTURE says whether it is marked.
     *
     * ⛔⛔ AND IT IS A PAIR. A mark present at `at` proves nothing on its own —
     * a layer that struck through every lock it was handed would pass. The
     * tick BEFORE must be clean, and before this slice BOTH ticks were.
     */
    const clear = (web.gen.scratchClears ?? [])[0] ?? null;
    if (!clear) {
        check(false, '⛓ the kill lock\'s ✕ — NO SCRATCH CLEAR TO SCRUB TO',
            'the claim below has no subject; re-scan the CARRIER pool');
    } else {
        const markAt = async (t) => page.evaluate((tick) => {
            const s = document.getElementById('scrub');
            s.value = String(tick);
            s.dispatchEvent(new Event('input'));
            const d = window.__editorOverlays.drawn.worldstate;
            return {
                // ⚠ THE SCRUBBER'S OWN VALUE. `__editorShot.tick` is the
                // cursor CAPTURED AT MOUNT and never moves — reading it here
                // reports `undefined`/0 for every seek, which is a claim about
                // nothing (measured on the first cut of this row).
                at: Number(document.getElementById('scrub').value),
                changes: d.changes.map((c) => ({ id: c.id, effect: c.effect, verb: c.verb })),
                why: d.why,
                placed: window.__editorOverlays.changeCounts?.placed ?? null,
            };
        }, t);
        const before = await markAt(clear.at - 1);
        const after = await markAt(clear.at);
        const hit = (m) => m.changes.find((c) => c.id === clear.lock);
        check(before.at === clear.at - 1 && !hit(before),
            `⛓ the tick BEFORE the clear (${clear.at - 1}) draws NO mark on ${clear.lock} — `
            + 'the lock is standing and the run has not opened it',
            `t${before.at}: ${json(before.changes)} placed=${before.placed}`);
        check(after.at === clear.at && Boolean(hit(after)) && hit(after).effect === 'gone'
            && /^CLEARED/.test(hit(after).verb ?? ''),
            `⛓⛓⛓ and from the clear's own tick (${clear.at}) the canvas STRIKES IT `
            + 'THROUGH — the same `gone` glyph a group-pressed lock gets, decided in the '
            + 'one place the marker is decided',
            `t${after.at}: ${json(after.changes)} placed=${after.placed} why=${after.why}`);
        // ⛔ THE RESTORE (trap 299): the next claim re-navigates, but a block
        // that left the cursor parked mid-walk would couple every later read
        // to the order of this one.
        await page.evaluate(() => {
            const s = document.getElementById('scrub');
            s.value = '0';
            s.dispatchEvent(new Event('input'));
        });
    }
    check(errors.length === 0, 'and no page errors while it did',
        errors.join(' | ') || 'none');
}

// ── CLAIM 3b: THE SEED IS THE LEVEL'S IDENTITY, and the form says so ──
{
    /**
     * ⛓ A LADDER BELONGS TO ONE SEED. Step 2 of seed A followed by step 3 of
     * seed B would be a display that has never shown a level any single run
     * produces — so a changed seed RESETS to the skeleton. Driven, because
     * "the control edits a value nobody reads" is exactly the defect the
     * editor arc's slice 5 found in the SOLVE button.
     */
    const q = `source=generate&seed=${PRE.seed}&biome=${PRE.biome}&count=${PRE.count}&run=1`;
    // ⛓ SLICE 6's SWEEP: settle the FIRST ladder before editing the form —
    // a fill landing mid-run would be racing the driver, not testing the reset.
    await load(q, { step: PRE.count, seed: PRE.seed });
    await page.fill('#genSeed', String(PRE.seed + 1));
    await page.click('#genStep');
    await page.waitForFunction((s) => window.__editorGenerate?.seed === s,
        PRE.seed + 1, { timeout: 300000 });
    const after = await page.evaluate(() => ({
        gen: window.__editorGenerate, level: window.__editorGenerated.level,
    }));
    const nodeOther = generateStep({ ...PRE, seed: PRE.seed + 1, step: 1 });
    check(after.gen.step === 1,
        'retyping the seed RESTARTS the ladder at step 1 rather than continuing the old one',
        `step ${after.gen.step} (was ${PRE.count})`);
    check(json(after.level) === json(nodeOther.record),
        'and the level it shows is the NEW seed\'s own step 1, byte for byte');
}

// ── CLAIM 5: ⛓⛓⛓ THE URL ROUND TRIP ─────────────────────────────────
{
    /**
     * ⛓ TWO HALVES, AND NEITHER IS THE CLAIM ON ITS OWN. "The press wrote the
     * params" is a statement about a string; "the copied link reproduces" is
     * the statement anybody actually wants. A writer nobody reads back agrees
     * with itself forever, which is how the defect this repairs survived.
     */
    const start = `source=generate&seed=${PRE.seed}&biome=post-sword&count=1`
        + `&tickbudget=${ROUND.tickbudget}&layers=path`;
    await load(start);
    await page.fill('#genSeed', String(ROUND.seed));
    await page.selectOption('#genBiome', ROUND.biome);
    await page.fill('#genCount', String(ROUND.count));
    await page.fill('#genTries', String(ROUND.tries));
    await page.fill('#genK', String(ROUND.k));
    await page.fill('#genAnchorTries', String(ROUND.anchortries));
    await page.click('#genRunAll');
    await settled(ROUND.count);
    const pressed = await panelOf();
    const web = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    const u = new URLSearchParams(pressed.url);

    check(web.gen.step === ROUND.count && web.gen.seed === ROUND.seed,
        'RUN-ALL after the edits reached the edited target under the edited seed',
        `step ${web.gen.step}, seed ${web.gen.seed}, bounds ${json(web.gen.bounds)}`);
    check(json(web.level) === json(nodeRound.record)
        && json(web.trace) === json(nodeRound.trace),
        'and the level it generated is node\'s own under those bounds, byte for byte');
    check(u.get('seed') === String(ROUND.seed) && u.get('biome') === ROUND.biome
        && u.get('count') === String(web.gen.step) && u.get('tries') === String(ROUND.tries)
        && u.get('k') === String(ROUND.k)
        && u.get('anchortries') === String(ROUND.anchortries) && u.get('run') === '1',
        '⛓ EVERY generate control is written back — the address bar NAMES the run '
        + '(the defect: it named the level BEFORE the edits)', pressed.url);
    check(web.gen.bounds.anchorTriesPerCandidate === ROUND.anchortries,
        '…and the anchor bound the URL names is the one the RUN used, not just a string',
        json(web.gen.bounds));
    /**
     * ⛔ `?tickbudget=` HAS NO CONTROL ON THE FORM. A rewrite that rebuilt the
     * query instead of copying it would drop the budget the level on screen
     * was certified under, silently — so the parameters this writer does not
     * own are asserted to survive it.
     */
    check(u.get('tickbudget') === String(ROUND.tickbudget) && u.get('layers') === 'path',
        'and the parameters it does NOT own survive the rewrite — ?tickbudget= (no control '
        + 'at all) and ?layers=', pressed.url);
    check(web.gen.budget.maxTicksPerTarget === ROUND.tickbudget,
        '…and that preserved budget is the one the run really used, not just a string',
        json(web.gen.budget));

    // ── 5b: the COPIED link, loaded fresh ────────────────────────────
    await load(pressed.url.replace(/^\?/, ''));
    await settled(ROUND.count);
    const reloaded = await panelOf();
    const back = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    check(reloaded.seed === pressed.seed && reloaded.biome === pressed.biome
        && reloaded.count === pressed.count && reloaded.tries === pressed.tries
        && reloaded.k === pressed.k && reloaded.anchortries === pressed.anchortries,
        '⛓⛓ the copied URL brings the PANEL back identical — all SIX controls',
        `${json(pressed)} → ${json(reloaded)}`);
    check(json(back.level) === json(web.level) && json(back.trace) === json(web.trace),
        '⛓⛓ …and the LEVEL back byte-identical, trace included — the link reproduces '
        + 'the run and not merely the form');
    /**
     * ⚠ THE REWRITE IS A FIXED POINT. A link that grew or renamed a parameter
     * on every load would still "round trip" once and drift on the third copy.
     */
    check(reloaded.url === pressed.url,
        'and loading it rewrites it to ITSELF — the encoding is a fixed point, not a drift',
        `${pressed.url}\n        → ${reloaded.url}`);

    // ── 5c: RESET is the SKELETON, and the link says so by ABSENCE ───
    await page.click('#genReset');
    await page.waitForFunction(() => window.__editorGenerate?.step === 0
        && !document.getElementById('genReset').disabled, null, { timeout: 300000 });
    const reset = await panelOf();
    const ru = new URLSearchParams(reset.url);
    check(!ru.has('run') && ru.get('count') === String(ROUND.count),
        'RESET drops ?run= rather than spelling it `run=0` — the skeleton is what a load '
        + 'with no ?run= already shows — and ?count= is the form\'s target again', reset.url);
    const afterReset = await load(reset.url.replace(/^\?/, ''));
    check(afterReset.gen.step === 0 && json(afterReset.level) === json(nodeRoundSkeleton.record),
        'and that link opens on the SKELETON — node\'s own step 0 for this seed, byte for byte',
        `step ${afterReset.gen.step}`);
    check(errors.length === 0, 'no page errors anywhere in the round trip',
        errors.join(' | ') || 'none');
}

// ── CLAIM 6: ⛓⛓⛓ THE CATALOGUE + VERB 1 (RESTRICT) ──────────────────
{
    /**
     * ⛓ SIX HALVES, AND EACH IS A DIFFERENT CLAIM:
     *  a. the catalogue ENUMERATES the roster AND the exclusions, from the
     *     palette, with the measured causes verbatim and no checkbox on a row
     *     nothing can draw;
     *  b. a restriction pressed → the URL NAMES it → the level is node's own
     *     restricted level and NOT the unrestricted one;
     *  c. the copied URL reproduces it, ticks included, and is a fixed point;
     *  d. an EMPTY restriction refuses BEFORE the press;
     *  e. the COARSE `?families=` spelling denotes the same sub-roster and
     *     SURVIVES a press;
     *  f. an unknown name, and both spellings at once, refuse BY NAME.
     */
    const q = `source=generate&seed=${RESTRICT.seed}&biome=${RESTRICT.biome}`
        + `&count=${RESTRICT.count}`;
    const opened = await load(q);
    const cat = await catalogueOf();

    // ── 6a: the catalogue is the ROSTER, and the exclusions are in it ──
    check(json(cat.boxes) === json(PRE_ROSTER),
        '⛓ the catalogue offers ONE checkbox per ROSTER template, in the palette\'s own '
        + `order (${PRE_ROSTER.length} from the palette, not a literal)`,
        `${json(cat.boxes)}`);
    check(cat.excluded.length === PRE_EXCLUDED.length && cat.excludedInputs === 0,
        '⛔ every EXCLUDED row is in the catalogue too, and NOT ONE of them is selectable',
        `${cat.excluded.length} excluded row(s) of ${PRE_EXCLUDED.length}, `
        + `${cat.excludedInputs} input(s) on them`);
    /**
     * ⛔ VERBATIM — the same law the veto texts ride under (trap 202). An
     * exclusion's `measured` IS its content; a catalogue that paraphrased it
     * would show a lossy copy of the only evidence the row carries.
     */
    const missing = PRE_EXCLUDED.filter((e) => !cat.excluded.some(
        (text) => text.includes(e.cause) && text.includes(e.measured)
            && text.includes(e.wouldNeed)));
    check(missing.length === 0,
        'and each carries its `cause` + `measured` + `wouldNeed` VERBATIM from the palette',
        missing.length ? `missing: ${missing.map((e) => e.name).join(', ')}`
            : PRE_EXCLUDED.map((e) => e.name).join(', '));
    /**
     * ⛔ THE CONTAINER IS THE CONTRACT (the group-B lesson): a knob dropped
     * into `#layers` counts as a LAYER and reds three unrelated rows at once.
     */
    check(cat.inLayers === 0 && cat.inBootForm === 0,
        '⛔ and the checkboxes are in NEITHER enumerated container — not #layers '
        + '(one input per overlay layer, enumerated by three rows) and not #bootForm',
        `#layers has ${cat.layersInputs} input(s), none of them a catalogue box`);
    check(cat.note.includes(`${PRE_ROSTER.length} template(s), no restriction`),
        'the note says the WHOLE roster is on offer before anything is unticked', cat.note);
    /**
     * ⚠ THE READOUT'S OWN COUNTS ARE ASSERTED TOO, so the field is READ rather
     * than merely written — a readout nobody checks is state nobody reads.
     */
    check(opened.gen.catalogue?.templates === PRE_ROSTER.length
        && opened.gen.catalogue?.boxes === PRE_ROSTER.length
        && opened.gen.catalogue?.excluded === PRE_EXCLUDED.length
        && opened.gen.palette === RESTRICT.biome && opened.gen.roster === null,
        'and the readout agrees with the DOM about what the catalogue holds, and says the '
        + 'palette is unrestricted before anything is unticked', json(opened.gen.catalogue));

    // ── 6b: RESTRICT, pressed ────────────────────────────────────────
    await page.evaluate((keep) => {
        for (const b of document.querySelectorAll('#genRoster input[data-template]')) {
            if (b.checked !== keep.includes(b.dataset.template)) b.click();
        }
    }, RESTRICT.templates);
    const restricted = await catalogueOf();
    check(restricted.note.includes(`RESTRICTED to ${RESTRICT.templates.length} of `
        + `${PRE_ROSTER.length}`),
        'unticking says so BEFORE the press — the note names the sub-roster', restricted.note);
    await page.click('#genRunAll');
    await settled(RESTRICT.count);
    const pressed = await panelOf();
    const web = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
    }));
    const pu = new URLSearchParams(pressed.url);
    check(pu.get('templates') === RESTRICT_ROSTER.names.join(',') && !pu.has('families'),
        '⛓ the press writes the sub-roster to the URL — sorted, one axis only', pressed.url);
    check(json(web.level) === json(nodeRestricted.record)
        && json(web.trace) === json(nodeRestricted.trace),
        '⛓⛓ and the level is node\'s own RESTRICTED level, byte for byte — trace included');
    check(json(web.level) !== json(nodeUnrestricted.record),
        '⛔ …and NOT the unrestricted one: the restriction reached the LOOP, not just the URL',
        `kept ${json(web.gen.keptCount)} — ${json(nodeRestricted.summary.kept.map(
            (k) => k.template))}`);
    check(web.gen.palette === nodeRestricted.palette.name
        && json(web.gen.roster) === json(RESTRICT_ROSTER),
        'the readout NAMES the derived palette, which is `summary.palette`\'s own string',
        `${web.gen.palette} / ${json(web.gen.roster)}`);

    // ── 6c: the copied URL ───────────────────────────────────────────
    await load(pressed.url.replace(/^\?/, ''));
    await settled(RESTRICT.count);
    const reloaded = await panelOf();
    const back = await page.evaluate(() => ({
        level: window.__editorGenerated.level, trace: window.__editorGenerated.trace,
    }));
    check(json(reloaded.checked) === json(pressed.checked),
        '⛓⛓ the copied URL brings the CATALOGUE back — the same templates ticked',
        `${json(pressed.checked)} → ${json(reloaded.checked)}`);
    check(json(back.level) === json(web.level) && json(back.trace) === json(web.trace),
        '⛓⛓ …and the RESTRICTED level back byte-identical, trace included');
    check(reloaded.url === pressed.url,
        'and the restricted link is a FIXED POINT — loading it rewrites it to itself',
        `${pressed.url}\n        → ${reloaded.url}`);

    // ── 6d: the EMPTY restriction, refused BEFORE the press ──────────
    await page.evaluate(() => {
        for (const b of document.querySelectorAll('#genRoster input[data-template]')) {
            if (b.checked) b.click();
        }
    });
    const empty = await catalogueOf();
    check(json(empty.disabled) === json([true, true, true]),
        '⛔ an EMPTY restriction disables the three ladder buttons BEFORE a press — the loop\'s '
        + 'own refusal stays as the backstop, but the page knew already', json(empty.disabled));
    check(empty.note.includes('NOTHING is ticked') && empty.note.includes('EMPTY roster'),
        'and it SAYS why, where the ticks are', empty.note);
    check(errors.length === 0, 'no page errors through the catalogue round trip',
        errors.join(' | ') || 'none');

    // ── 6e: the COARSE spelling — same sub-roster, and it SURVIVES ───
    const fq = `source=generate&seed=${RESTRICT.seed}&biome=${RESTRICT.biome}`
        + `&count=${RESTRICT.count}&families=${RESTRICT.families.join(',')}&run=1`;
    // ⛓⛓ SLICE 6's SWEEP, AND THIS ONE WAS A LIVE HOLE: the `settled()` below
    // was already here, but `byFamily` was READ BEFORE it — so the level the
    // check below compares was whatever the page held at the skeleton.
    const byFamily = await load(fq, { step: RESTRICT.count });
    const famPanel = await panelOf();
    const fu = new URLSearchParams(famPanel.url);
    check(json(byFamily.level) === json(nodeRestricted.record),
        '⛓ ?families= denotes the SAME sub-roster as ?templates= and produces the SAME level '
        + '— the subset and its ORDER are what the rng indexes, not the spelling');
    check(json(famPanel.checked.sort()) === json([...RESTRICT.templates].sort()),
        'and the catalogue shows that family\'s members ticked', json(famPanel.checked));
    await page.click('#genRunAll');
    await settled(RESTRICT.count);
    const afterPress = new URLSearchParams((await panelOf()).url);
    check(afterPress.get('families') === RESTRICT.families.join(',')
        && !afterPress.has('templates'),
        '⛔ and a press that did not change the ticks KEEPS the coarse spelling — rewriting it '
        + 'as ?templates= would freeze the membership of a by-family restriction',
        `${fu.get('families')} → ${afterPress.get('families')}`);

    // ── 6f: the refusals, BY NAME, on the page ───────────────────────
    const refusalOf = async (query) => {
        errors.length = 0;
        await page.goto(`${origin}${PAGE_PATH}?${query}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorParams?.status === 'refused',
            null, { timeout: 60000 });
        return page.evaluate(() => ({
            message: window.__editorParams.message,
            status: document.getElementById('status').textContent,
            mounted: Boolean(window.__editorGenerate),
        }));
    };
    const unknown = await refusalOf(`source=generate&biome=${RESTRICT.biome}&templates=nope`);
    check(unknown.message.includes('"nope"') && unknown.message.includes(PRE_ROSTER[0])
        && !unknown.mounted,
        '⛔ an unknown template REFUSES BY NAME and lists the roster — and the arm does NOT '
        + 'mount, so nothing was generated under a roster nobody asked for',
        unknown.message.slice(0, 120));
    const both = await refusalOf(`source=generate&biome=${RESTRICT.biome}`
        + '&families=water&templates=water-pool');
    check(both.message.includes('BOTH present') && both.message.includes('two spellings'),
        '⛔ and both spellings at once REFUSE — they do not compose, and the page says so',
        both.message.slice(0, 120));
    check(/REFUSED/.test(both.status),
        'the refusal is ON THE PAGE, not only in the console — a refusal nobody can see is '
        + 'a page that just stopped', both.status);
}

// ── CLAIM 7: ⛓⛓⛓ VERB 2 — THE DIRECTED ATTEMPT ─────────────────────
{
    /**
     * ⛓ SIX HALVES, each a different claim:
     *  a. every SELECTABLE catalogue row carries a param form and an ATTEMPT
     *     button built from its own declared schema; no EXCLUDED row does;
     *  b. a press → a pane row PER ANCHOR → the readout says WHICH KIND of
     *     keep, and the level is node's own directed level;
     *  c. the URL names the whole construction and a copied one reproduces it
     *     byte for byte, and is a fixed point;
     *  d. the refusal classes, each with VERBATIM text — and the one that is
     *     UNREACHABLE is named with its reason rather than left looking untested;
     *  e. STEP after a directive RESETS and SAYS so, and the page said what
     *     would happen BEFORE the press;
     *  f. CLEAR returns to the ladder.
     */
    /**
     * ⛓⛓ SLICE 4c: THE PAGE HAS TO REACH `DIRECT.step` BEFORE THE PRESS. The
     * subject moved from the BARE skeleton to a room already holding three
     * obstacles, because no step-0 subject can make the walk longer than one
     * anchor any more (see `DIRECT`'s docblock). `count=<step>&run=1` is how
     * the URL spells a run to that target — `stepFromParams` reads `run ?
     * count : 0` — so the page and node start from the same room.
     */
    const q = `source=generate&seed=${DIRECT.seed}&biome=${DIRECT.biome}`
        + `&count=${DIRECT.step}&run=1`;
    await load(q);

    // ── 7a: the form is built FROM the row's declared schema ─────────
    const forms = await page.evaluate(() => ({
        attemptButtons: [...document.querySelectorAll('#genRoster button[data-attempt]')]
            .map((b) => b.dataset.attempt),
        onExcluded: document.querySelectorAll('#genRoster .catRow.excluded button[data-attempt]')
            .length,
        selectsFor: Object.fromEntries([...document.querySelectorAll('#genRoster .catRow')]
            .filter((r) => r.querySelector('button[data-attempt]'))
            .map((r) => [r.querySelector('button[data-attempt]').dataset.attempt,
                [...r.querySelectorAll('select[data-param]')].map((sel) => ({
                    key: sel.dataset.param,
                    options: [...sel.options].map((o) => o.value),
                    selected: sel.value,
                }))])),
    }));
    check(json(forms.attemptButtons) === json(PRE_ROSTER),
        '⛓ ONE ATTEMPT button per ROSTER template, in the palette\'s own order',
        json(forms.attemptButtons));
    check(forms.onExcluded === 0,
        '⛔ and NOT ONE on an EXCLUDED row — there is nothing there to attempt',
        `${forms.onExcluded} button(s) on excluded rows`);
    {
        // ⛔ BUILT FROM THE PALETTE'S OWN SCHEMA, compared against it here
        // rather than against a literal (trap 199).
        const bad = [];
        for (const t of paletteFor(DIRECT.biome).templates) {
            const got = forms.selectsFor[t.name] ?? [];
            if (json(got.map((g) => g.key)) !== json(t.params.map((pp) => pp.key))) {
                bad.push(`${t.name}: keys ${json(got.map((g) => g.key))}`);
                continue;
            }
            for (const pp of t.params) {
                const g = got.find((x) => x.key === pp.key);
                // ⛓ the domain PLUS the empty "any (draw it)" option, and the
                // DECLARED DEFAULT pre-selected.
                if (json(g.options) !== json(['', ...pp.domain.map(String)])
                    || g.selected !== String(pp.default)) {
                    bad.push(`${t.name}.${pp.key}: ${json(g.options)} sel=${g.selected}`);
                }
            }
        }
        check(bad.length === 0,
            'and each form offers exactly its DECLARED domain plus an "any (draw it)" '
            + 'choice, with the declared DEFAULT pre-selected',
            bad.length ? bad.join(' | ') : `${PRE_ROSTER.length} form(s) match the schema`);
    }

    // ── 7b: the press ────────────────────────────────────────────────
    await page.evaluate(({ template, params }) => {
        const row = [...document.querySelectorAll('#genRoster .catRow')]
            .find((r) => r.querySelector(`button[data-attempt="${template}"]`));
        for (const [k, v] of Object.entries(params)) {
            row.querySelector(`select[data-param="${k}"]`).value = String(v);
        }
        row.querySelector(`button[data-attempt="${template}"]`).click();
    }, { template: DIRECT.template, params: DIRECT.params });
    /**
     * ⛔ WAIT ON THE CLAIM'S OWN FIELD PLUS A NOT-BUSY SIGNAL (trap 246, the
     * hole slice 4 found in claim 4): the readout exists from the skeleton
     * onward, so waiting for it to EXIST would read the page before the
     * directive ran.
     */
    await page.waitForFunction(
        () => window.__editorGenerate?.directives?.length === 1
            && !document.getElementById('genRunAll').disabled,
        null, { timeout: 300000 },
    );
    const after = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated?.level ?? null,
        trace: window.__editorGenerated?.trace ?? null,
        paneRows: [...document.querySelectorAll('#genTrace .tr')].map((e) => e.textContent),
        dRows: [...document.querySelectorAll('#genDirectives .dRow')].map((e) => e.textContent),
        status: document.getElementById('status').textContent,
        detail: document.getElementById('detail').textContent,
        url: window.location.search,
    }));
    const nd = nodeDirect.directives[0];
    check(after.gen.directives?.length === 1
        && after.gen.directives[0].outcome === 'KEPT'
        && after.gen.directives[0].keptKind === null,
        '⛓⛓ the readout carries the keep KIND field and it is `null` — arc-3 slice 4c '
        + 'retired the discharge preference on Seedling, and `null` is the walk\'s own '
        + 'answer (*it never asked*) rather than a value the page dropped',
        json(after.gen.directives?.[0] && {
            outcome: after.gen.directives[0].outcome,
            keptKind: after.gen.directives[0].keptKind,
            walked: after.gen.directives[0].anchorsWalked,
            of: after.gen.directives[0].anchorsOffered,
        }));
    check(after.gen.directives[0].anchorsWalked === nd.anchorsWalked
        && after.gen.directives[0].anchorsOffered === nd.anchorsOffered
        && json(after.gen.directives[0].at) === json(nd.at),
        'and it walked the SAME anchors node did, to the same cell',
        `browser walked ${after.gen.directives[0].anchorsWalked} of `
        + `${after.gen.directives[0].anchorsOffered} to ${json(after.gen.directives[0].at)}; `
        + `node ${nd.anchorsWalked}/${nd.anchorsOffered} to ${json(nd.at)}`);
    {
        // ⛔ EVERY ANCHOR WALKED IS A PANE ROW, in slice 3's row shape.
        const dPane = after.paneRows.filter((t) => /^d1a\d/.test(t.trim()));
        check(dPane.length === nd.anchorsWalked,
            '⛓ EVERY anchor walked is a PANE ROW, labelled d1a<k>',
            `${dPane.length} pane row(s) for ${nd.anchorsWalked} anchor(s) walked`);
        /**
         * ⛓⛓ THE DISCRIMINATOR, RESTATED FOR ARC 3 SLICE 2. It used to look for
         * a pane row reading `REVERTED · SOLVED` — an anchor that solved and was
         * passed over — which is the class ⚖ ruling 17's door law emptied (0 of
         * 2056 directed attempts; see `DIRECT`'s docblock). What the pane can
         * still show, and what a first-SOLVED build still could not, is MORE
         * THAN ONE anchor row for one directive, each carrying its own outcome.
         */
        check(dPane.length > 1 && dPane.every((t) => /REVERTED|KEPT/.test(t)),
            '⛔ and the pane SHOWS EVERY anchor the walk touched, each with its own outcome '
            + '— a build that stopped at the first solved anchor emits ONE row',
            `${dPane.length} rows: ${dPane.map((t) => t.trim().slice(0, 24)).join(' | ')}`);
    }
    check(after.dRows.length === 1
        && after.dRows[0].includes('the keep policy was first-SOLVED')
        && after.dRows[0].includes(`walked ${nd.anchorsWalked} of ${nd.anchorsOffered}`),
        '⛓ the directives list SAYS WHY there is no keep kind, and how many anchors were '
        + 'walked — `describeKeptKind`\'s `null` branch, which is the sentence that '
        + 'survived the policy (trap 312)',
        after.dRows[0]?.slice(0, 160));
    check(json(after.level) === json(nodeDirect.record)
        && json(after.trace) === json(nodeDirect.trace),
        '⛓⛓ and the level the browser built IS node\'s directed level, byte for byte '
        + '(level AND trace)',
        `level ${json(after.level) === json(nodeDirect.record)}, `
        + `trace ${json(after.trace) === json(nodeDirect.trace)}`);
    check(after.detail.includes('then 1 directed attempt(s)'),
        '⛓ the identity line says ladder-to-step-k PLUS the directives',
        after.detail.slice(0, 160));

    // ── 7c: ⛓⛓⛓ SLICE 12 — THE **PAYLOAD** NAMES THE CONSTRUCTION ─────
    /**
     * ⚖ §3.9 RE-CUT THIS HALF WHOLE. It used to assert `?directed=` carried the
     * instance label and that a copied URL rebuilt the construction. ⛔ Replaced
     * rather than relaxed (trap 62/199): the same three claims — *the identity
     * is copyable*, *the replayed directive is the one the press produced*, and
     * *the rewrite is a fixed point* — are driven through the channel the
     * construction now travels on, plus the new claim that the BAR carries
     * none. The URL-SPELLING claim itself is RETIRED: it was about a parameter
     * that no longer exists.
     */
    check(new URLSearchParams(after.url).get('directed') === null,
        '⛔⛔ SLICE 12: the BAR NAMES NO DIRECTIVE — a URL is what a person LAUNCHES',
        after.url);
    check(after.detail.includes('the URL is NOT a reproduction of this construction')
        && after.detail.includes('names the LADDER alone'),
        '⛓⛓ …and the page SAYS SO where it states the identity, so the bar is never read '
        + 'as complete', after.detail.slice(-150));
    {
        // ⛓ THE PAGE'S OWN PAYLOAD — the object `#genDownload` writes — served
        // straight back to it. Nothing is re-assembled by this file.
        servedPayload = await page.evaluate(() => window.__editorGenerated);
        check((servedPayload.directives ?? []).length === 1,
            '⛓ the payload the page would DOWNLOAD carries the directive',
            json(servedPayload.directives?.[0]?.instance));
        await load(`gen=${PAYLOAD_ROUTE}`);
        await page.waitForFunction(
            () => window.__editorGenerate?.payloadCheck
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const back = await page.evaluate(() => ({
            gen: window.__editorGenerate,
            level: window.__editorGenerated?.level ?? null,
            trace: window.__editorGenerated?.trace ?? null,
            url: window.location.search,
        }));
        check(back.gen.directives?.length === 1
            && json(back.level) === json(after.level)
            && json(back.trace) === json(after.trace),
        '⛓⛓⛓ `?gen=` OF A DIRECTED PAYLOAD REPRODUCES THE WHOLE CONSTRUCTION, BYTE FOR '
            + 'BYTE — the directives were REPLAYED (before slice 12 this path applied the '
            + 'edits and left the directives to the bar, and the level would be the ladder)',
        `${back.gen.directives?.length ?? 0} directive(s), `
            + `level ${json(back.level) === json(after.level)}, `
            + `trace ${json(back.trace) === json(after.trace)}`);
        check(back.gen.payloadCheck?.checked === true && back.gen.payloadCheck?.agrees === true,
            '⛓⛓ …and the page CHECKED it rather than displaying it — the reproduction claim, '
            + 'made by the page about its own bytes',
            json(back.gen.payloadCheck?.differences ?? []));
        check(json(back.gen.directives) === json(after.gen.directives),
            'and the directive it replayed is the one the press produced, field for field',
            json(back.gen.directives?.[0]?.keptKind));
    }
    {
        /**
         * ⛓⛓⛓ AND THE URL STILL DOES ITS JOB — IT LAUNCHES THE LADDER. ⛔ This
         * is the VALUE claim about the diet, and it is what a fixed point alone
         * could never say: the copied bar comes back with ZERO directives on a
         * level that is the ladder's own, NOT the directed one. A build whose
         * writer still emitted the parameter would reproduce the construction
         * here and redden this line.
         */
        // ⛓ SLICE 4c: WAIT FOR THE LADDER TO SETTLE at `DIRECT.step`. The row
        // used to compare against the SKELETON, which a freshly-loaded page is
        // already showing — so `load()` without a `step` was enough. The
        // subject is a step-3 ladder now and the auto-run is asynchronous; a
        // comparison taken before it settles reads the skeleton and reports a
        // mismatch that is about the WAIT rather than about the URL.
        const back = await load(after.url.replace(/^\?/, ''),
            { step: DIRECT.step, seed: DIRECT.seed });
        const backPanel = await panelOf();
        const ladderOnly = generateStep({
            seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
        });
        check((back.gen.directives ?? []).length === 0
            && json(back.level) === json(ladderOnly.record),
        '⛓⛓ a COPIED URL reproduces the LADDER ALONE, byte for byte — the launch it names, '
            + 'and not the construction the payload carries',
        `${(back.gen.directives ?? []).length} directive(s), `
            + `level matches the ladder: ${json(back.level) === json(ladderOnly.record)} `
            + `· page kept [${(back.gen.summary?.kept ?? []).map((k) => k.instance).join(', ')}]`
            + ` · node kept [${ladderOnly.summary.kept.map((k) => k.instance).join(', ')}]`
            + ` · page ents ${(back.level?.entities ?? []).length}`
            + ` node ents ${ladderOnly.record.entities.length}`);
        check(!back.gen.identity.includes('NOT a reproduction'),
            '⛔ …and the identity line drops the warning, because on THIS level the URL is a '
            + 'reproduction again', back.gen.identity.slice(0, 120));
        // ⛓ THE FIXED POINT (slice 1's own claim), over the ladder's own bar.
        check(backPanel.url === after.url,
            '⛓ and the rewrite is a FIXED POINT — loading it rewrites it to itself',
            `${after.url}\n        vs ${backPanel.url}`);
    }

    // ── 7d: the refusal classes ──────────────────────────────────────
    for (const [label, subject, expect] of [
        ['NO_ANCHOR', NO_ANCHOR_CASE, 'NO_ANCHOR'],
        ['REVERTED', REVERTED_CASE, 'REVERTED'],
    ]) {
        await load(`source=generate&seed=${subject.seed}&biome=${subject.biome}`
            + `&count=${subject.step}${subject.step ? '&run=1' : ''}`);
        await settled(subject.step, subject.seed);
        await page.evaluate(({ template, params }) => {
            const row = [...document.querySelectorAll('#genRoster .catRow')]
                .find((r) => r.querySelector(`button[data-attempt="${template}"]`));
            for (const [k, v] of Object.entries(params)) {
                row.querySelector(`select[data-param="${k}"]`).value = String(v);
            }
            row.querySelector(`button[data-attempt="${template}"]`).click();
        }, subject);
        await page.waitForFunction(
            () => window.__editorGenerate?.directives?.length === 1
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const got = await page.evaluate(() => ({
            d: window.__editorGenerate.directives[0],
            dRow: document.querySelector('#genDirectives .dRow')?.textContent ?? '',
            status: document.getElementById('status').textContent,
            paneRows: [...document.querySelectorAll('#genTrace .tr')]
                .map((e) => e.textContent).filter((t) => /^d1/.test(t.trim())),
        }));
        check(got.d.outcome === expect && got.d.keptKind == null,
            `⛓ the ${label} class is REACHED and reported distinctly`,
            `${got.d.outcome}${got.d.keptKind ? `/${got.d.keptKind}` : ''}, `
            + `walked ${got.d.anchorsWalked} of ${got.d.anchorsOffered}`);
        if (label === 'NO_ANCHOR') {
            check(got.paneRows.some((t) => t.includes('no legal anchor')),
                '  …with the model\'s own VERBATIM reason in the pane', got.paneRows[0]);
        }
        if (label === 'REVERTED') {
            check(got.paneRows.some((t) => t.length > 40),
                '  …with the oracle\'s own VERBATIM refusal in the pane',
                got.paneRows[0]?.slice(0, 120));
            check(got.status.includes('the level on screen is UNCHANGED'),
                '  …and the page SAYS the record did not move', got.status.slice(-90));
        }

    }
    /**
     * ⛔⛔ THE FOURTH CLASS IS NO LONGER AN ABSENCE — IT IS DRIVEN, IN CLAIM 8e.
     *
     * Slice 5 recorded here that `ILLEGAL_PLACEMENT` was UNREACHABLE from a
     * SEARCHED directive (`anchorsFor` only offers cells `legalAt` accepted, so
     * `place` has nothing left to refuse) and named that absence with its
     * reason rather than leaving the class looking untested. ⛓ Slice 6's
     * CLICKED cell is the first caller that can produce it, so the stated
     * absence is REPLACED by a driven case — trap 62: replace, never relax.
     * What survives here is the half that is still true, and it is asserted
     * rather than narrated: a SEARCHED directive cannot reach the class.
     */
    check(!nodeDirect.trace.some((r) => r.outcome === 'ILLEGAL_PLACEMENT')
        && nodeIllegal.trace.some((r) => r.outcome === 'ILLEGAL_PLACEMENT'),
        '⛔ ILLEGAL_PLACEMENT is unreachable from a SEARCHED directive and REACHABLE from a '
        + 'CLICKED one — the same template, the same seed, the two anchor paths',
        `searched: ${nodeDirect.trace.filter((r) => r.directive).map((r) => r.outcome)
            .join('/')} · clicked-illegal: ${nodeIllegal.trace.filter((r) => r.directive)
            .map((r) => r.outcome).join('/')}`);

    // ── 7e: STEP after a directive RESETS, and said so BEFORE the press ──
    {
        await load(`source=generate&seed=${DIRECT.seed}&biome=${DIRECT.biome}&count=2`);
        const noteBefore = await page.evaluate(
            () => document.getElementById('genDirectivesNote').textContent);
        check(noteBefore.includes('none yet'),
            'with no directives the page says the level is the ladder alone', noteBefore);
        await page.evaluate(({ template, params }) => {
            const row = [...document.querySelectorAll('#genRoster .catRow')]
                .find((r) => r.querySelector(`button[data-attempt="${template}"]`));
            for (const [k, v] of Object.entries(params)) {
                row.querySelector(`select[data-param="${k}"]`).value = String(v);
            }
            row.querySelector(`button[data-attempt="${template}"]`).click();
        }, { template: DIRECT.template, params: DIRECT.params });
        await page.waitForFunction(
            () => window.__editorGenerate?.directives?.length === 1
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const warned = await page.evaluate(
            () => document.getElementById('genDirectivesNote').textContent);
        /**
         * ⛔ THE LAW IS STATED **BEFORE** THE PRESS. The brief allowed either
         * disabling the ladder buttons or resetting-with-a-note; this arm
         * resets, so what it owes is that the page says what will happen while
         * the button is still unpressed.
         */
        check(warned.includes('RESET') && warned.includes('prefix property'),
            '⛓⛓ the page says BEFORE the press that STEP will RESET and why — the prefix '
            + 'property does not cross a directive', warned.slice(0, 150));
        await page.click('#genStep');
        await settled(1, DIRECT.seed);
        const stepped = await page.evaluate(() => ({
            gen: window.__editorGenerate,
            status: document.getElementById('status').textContent,
            url: window.location.search,
        }));
        check((stepped.gen.directives ?? []).length === 0 && stepped.gen.step === 1,
            'and STEP really DID reset — the directives are gone and the ladder is at step 1',
            `step ${stepped.gen.step}, ${(stepped.gen.directives ?? []).length} directive(s)`);
        /**
         * ⛓⛓ SLICE 12 RE-CUT THIS. It asserted `?directed=` was gone from the
         * bar — a claim the diet makes VACUOUS, since the writer never emits
         * one. What still has content is the SENTENCE: the identity line
         * carried "the URL is NOT a reproduction" while the directive stood,
         * and STEP has to take it back.
         */
        check(new URLSearchParams(stepped.url).get('directed') === null
            && !stepped.gen.identity.includes('NOT a reproduction'),
        '⛓ and the page stops SAYING the URL is not a reproduction — the level on screen is '
            + 'the ladder again, and the bar names it',
        `${stepped.url} · ${stepped.gen.identity.slice(0, 80)}`);
    }

    // ── 7f: CLEAR returns to the ladder ──────────────────────────────
    {
        await load(`source=generate&seed=${DIRECT.seed}&biome=${DIRECT.biome}`
            + `&count=${DIRECT.step}&run=1`);
        await page.evaluate(({ template, params }) => {
            const row = [...document.querySelectorAll('#genRoster .catRow')]
                .find((r) => r.querySelector(`button[data-attempt="${template}"]`));
            for (const [k, v] of Object.entries(params)) {
                row.querySelector(`select[data-param="${k}"]`).value = String(v);
            }
            row.querySelector(`button[data-attempt="${template}"]`).click();
        }, { template: DIRECT.template, params: DIRECT.params });
        await page.waitForFunction(
            () => window.__editorGenerate?.directives?.length === 1
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        await page.click('#genDirectivesClear');
        await page.waitForFunction(
            () => (window.__editorGenerate?.directives ?? []).length === 0
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const cleared = await page.evaluate(() => ({
            gen: window.__editorGenerate,
            level: window.__editorGenerated?.level ?? null,
            url: window.location.search,
        }));
        // ⛓ SLICE 4c: the ladder here is `DIRECT.step`, not the skeleton — the
        // subject moved off step 0 because no step-0 walk is longer than one
        // anchor any more (see `DIRECT`'s docblock).
        const skel = generateStep({
            seed: DIRECT.seed, biome: DIRECT.biome, step: DIRECT.step, bounds: DIRECT.bounds,
        });
        check((cleared.gen.directives ?? []).length === 0
            && json(cleared.level) === json(skel.record),
            `CLEAR returns the page to the ladder — here step ${DIRECT.step}, byte for byte`,
            `${(cleared.gen.directives ?? []).length} directive(s), level matches: `
            + `${json(cleared.level) === json(skel.record)}`);
        check(new URLSearchParams(cleared.url).get('directed') === null
            && !cleared.gen.identity.includes('NOT a reproduction'),
        'and the page says so too — no directive on the bar (there never is one since slice '
            + '12) and no "not a reproduction" clause', cleared.url);
    }
}

// ── CLAIM 8: ⛓⛓⛓ CLICK-TO-ANCHOR (slice 6, ⚖ ruling 6) ──────────────
{
    /**
     * ⛓ FIVE HALVES:
     *  a. every SELECTABLE catalogue row carries an AT… control and no
     *     EXCLUDED row does — built FROM the roster, like ATTEMPT;
     *  b. arming is VISIBLE (the button, the canvas and the note all say so)
     *     and ESCAPE disarms;
     *  c. a click on a MEASURED legal cell places the template THERE — and the
     *     tile is checked against an INDEPENDENTLY produced answer;
     *  d. the copied link reproduces the whole construction byte for byte;
     *  e. a click on an ILLEGAL cell refuses BY NAME with the model's own
     *     text, leaves the record alone, and spends NO solve.
     *
     * ⛔⛔ WHY (c) IS NOT A FIXED-POINT CHECK. Slice 5 measured that the URL
     * fixed point stays GREEN under a writer that is CONSISTENTLY wrong (trap
     * 250) — it compares the writer to ITSELF. So `!tx,ty` gets a VALUE check
     * against an answer this file computes on its own, from the canvas's
     * bounding box and the room's own dimensions, WITHOUT calling the page's
     * `tileAtPoint`. Four things then have to agree: that arithmetic, the
     * readout's `anchor`, the URL's `!tx,ty`, and the directive's `at` — plus
     * the placed FOOTPRINT really starting at that cell.
     *
     * ⛔ AND THE CLICK LANDS ON THE **LAST PIXEL** OF THE TARGET TILE, not on
     * its middle. A pixel-to-tile off-by-one is invisible to a middle-of-tile
     * click and is exactly what a boundary click catches.
     */
    // ⛓ SLICE 4c: the click block shares `DIRECT`'s base, so it reaches the
    // same step — see claim 7's `q` for why the subject is not step 0.
    const q = `source=generate&seed=${DIRECT.seed}&biome=${DIRECT.biome}`
        + `&count=${DIRECT.step}&run=1`;
    await load(q);

    // ── 8a: the AT… control, from the roster ─────────────────────────
    const arms = await page.evaluate(() => ({
        buttons: [...document.querySelectorAll('#genRoster button[data-arm]')]
            .map((b) => b.dataset.arm),
        onExcluded: document.querySelectorAll('#genRoster .catRow.excluded button[data-arm]')
            .length,
        note: document.getElementById('genArmNote').textContent,
        readout: window.__editorGenerate.armed,
        canvasArmed: document.getElementById('canvas').classList.contains('armed'),
    }));
    check(json(arms.buttons) === json(PRE_ROSTER),
        '⛓ ONE AT… control per ROSTER template, in the palette\'s own order', json(arms.buttons));
    check(arms.onExcluded === 0,
        '⛔ and NOT ONE on an EXCLUDED row — there is nothing there to place',
        `${arms.onExcluded} on excluded rows`);
    check(arms.readout === null && arms.canvasArmed === false
        && arms.note.includes('press AT…'),
        'nothing is armed before a press, and the page says how to arm it',
        arms.note.slice(0, 80));

    // ── 8b: arming is VISIBLE, and Escape disarms ────────────────────
    const armRow = async () => page.evaluate(({ template, params }) => {
        const row = [...document.querySelectorAll('#genRoster .catRow')]
            .find((r) => r.querySelector(`button[data-arm="${template}"]`));
        for (const [k, v] of Object.entries(params)) {
            row.querySelector(`select[data-param="${k}"]`).value = String(v);
        }
        row.querySelector(`button[data-arm="${template}"]`).click();
    }, { template: DIRECT.template, params: DIRECT.params });
    await armRow();
    const armedNow = await page.evaluate((t) => ({
        readout: window.__editorGenerate.armed,
        canvasArmed: document.getElementById('canvas').classList.contains('armed'),
        button: document.querySelector(`button[data-arm="${t}"]`).textContent,
        lit: document.querySelector(`button[data-arm="${t}"]`).classList.contains('armed'),
        note: document.getElementById('genArmNote').textContent,
    }), DIRECT.template);
    check(armedNow.readout === DIRECT.template && armedNow.canvasArmed && armedNow.lit
        && /ARMED/.test(armedNow.button) && /ARMED/.test(armedNow.note),
        '⛓⛓ AT… ARMS, and the state is VISIBLE in all three places — the button, the canvas '
        + 'and the note — not only in a readout',
        `${armedNow.button} · canvas.armed=${armedNow.canvasArmed}`);
    await page.keyboard.press('Escape');
    const escaped = await page.evaluate(() => ({
        readout: window.__editorGenerate.armed,
        canvasArmed: document.getElementById('canvas').classList.contains('armed'),
        status: document.getElementById('status').textContent,
        directives: (window.__editorGenerate.directives ?? []).length,
    }));
    check(escaped.readout === null && !escaped.canvasArmed && escaped.directives === 0
        && /cancelled/.test(escaped.status),
        '⛔ ESCAPE disarms and SAYS so, and nothing was placed', escaped.status);
    await armRow();
    await armRow();
    check(await page.evaluate(() => window.__editorGenerate.armed) === null,
        'and a SECOND press of AT… disarms too — two armed rows would make the next click '
        + 'mean two things');

    // ── 8c: the click, and the tile checked FOUR ways ────────────────
    await armRow();
    /**
     * ⛓ THE TEST'S OWN ARITHMETIC. `rect` is the canvas as the browser is
     * PRESENTING it and `level.width/height` is the room; the target pixel is
     * the LAST one of tile `CLICK.tx`, computed here rather than asked of the
     * page. ⛔ Nothing in this block calls `tileAtPoint`.
     */
    const geo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        return {
            left: r.left, top: r.top, width: r.width, height: r.height,
            cols: window.__editorGenerated.level.width,
            rows: window.__editorGenerated.level.height,
        };
    });
    const lastPixelOf = (tx, ty) => ({
        x: geo.left + ((tx + 1) * geo.width) / geo.cols - 1,
        y: geo.top + ((ty + 1) * geo.height) / geo.rows - 1,
        // the tile that pixel is IN, by this file's own arithmetic
        expect: {
            tx: Math.floor(((((tx + 1) * geo.width) / geo.cols - 1) * geo.cols) / geo.width),
            ty: Math.floor(((((ty + 1) * geo.height) / geo.rows - 1) * geo.rows) / geo.height),
        },
    });
    const target = lastPixelOf(CLICK.tx, CLICK.ty);
    check(json(target.expect) === json(CLICK),
        '⛓ the LAST PIXEL of the target tile is that tile, by this file\'s own arithmetic — '
        + 'the independent answer everything below is compared against',
        `pixel (${Math.round(target.x)},${Math.round(target.y)}) on a `
        + `${geo.width}x${geo.height} canvas over ${geo.cols}x${geo.rows} tiles `
        + `⇒ ${json(target.expect)}`);
    const beforeClick = await page.evaluate(() => window.__editorGenerated.level);
    await page.mouse.click(target.x, target.y);
    await page.waitForFunction(
        () => window.__editorGenerate?.directives?.length === 1
            && !document.getElementById('genRunAll').disabled,
        null, { timeout: 300000 },
    );
    const clicked = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated.level,
        trace: window.__editorGenerated.trace,
        url: window.location.search,
        dRow: document.querySelector('#genDirectives .dRow')?.textContent ?? '',
        status: document.getElementById('status').textContent,
    }));
    const cd = clicked.gen.directives[0];
    /**
     * ⛓⛓ SLICE 12 — THE FOURTH WAY IS THE **PAYLOAD**, not the bar. `!tx,ty` is
     * still a directive OBJECT's `anchor` and the CLI still spells it; what
     * left is its URL spelling, so the fourth independent reading is taken from
     * the file the page would DOWNLOAD. ⛔ Four readings, replaced not reduced.
     */
    const cp = await page.evaluate(() => window.__editorGenerated?.directives?.[0]?.anchor);
    check(json(cd.anchor) === json(target.expect)
        && json(cd.at) === json(target.expect)
        && json(cp) === json(target.expect)
        && new URLSearchParams(clicked.url).get('directed') === null,
    '⛓⛓⛓ THE TILE AGREES FOUR WAYS — this file\'s own arithmetic, the readout\'s `anchor`, '
        + 'the directive\'s `at`, and the PAYLOAD\'s `anchor` — while the BAR names none',
    `expected ${json(target.expect)} · anchor ${json(cd.anchor)} · at ${json(cd.at)} · `
        + `payload ${json(cp)} · ?directed=${new URLSearchParams(clicked.url).get('directed')}`);
    /**
     * ⛔ AND THE FOOTPRINT REALLY STARTS THERE. A build that recorded the cell
     * and placed the template elsewhere passes every field check above; the
     * terrain the record now holds at the clicked cell is what separates them.
     */
    {
        const clickedInstance = paletteFor(DIRECT.biome).templates
            .find((t) => t.name === DIRECT.template).instantiate(null, DIRECT.params);
        const moved = [];
        for (let ty = 0; ty < geo.rows; ty += 1) {
            for (let tx = 0; tx < geo.cols; tx += 1) {
                if (terrainAt(beforeClick, tx, ty) !== terrainAt(clicked.level, tx, ty)) {
                    moved.push(`${tx},${ty}`);
                }
            }
        }
        const expected = (clickedInstance.terrain ?? [])
            .map((w) => `${target.expect.tx + w.dx},${target.expect.ty + w.dy}`);
        check(expected.length > 0
            && json([...moved].sort()) === json([...expected].sort()),
            '⛔ …and the PLACED FOOTPRINT really STARTS at that cell — the cells whose terrain '
            + 'moved between the two BROWSER records are exactly the instance\'s own writes '
            + 'offset by the clicked anchor. A directive that recorded the cell and placed '
            + 'elsewhere passes every field check above and fails this one',
            `moved [${moved.join(' ')}] vs the instance at ${json(target.expect)} `
            + `[${expected.join(' ')}]`);
    }
    check(json(clicked.level) === json(nodeClicked.record)
        && json(clicked.trace) === json(nodeClicked.trace),
        '⛓⛓ the level the browser built IS node\'s own CLICKED level, byte for byte '
        + '(level AND trace)');
    check(json(clicked.level) !== json(nodeDirect.record),
        '⛔ …and NOT the SEARCHED level: the clicked cell reached the MODEL, not just the URL',
        `search keeps at ${json(nodeDirect.directives[0].at)}, this at ${json(cd.at)}`);
    check(cd.bound === 1 && cd.anchorsOffered === 1 && cd.anchorsWalked === 1,
        'a clicked attempt is a walk of ONE cell, and the record says so',
        `bound ${cd.bound}, ${cd.anchorsWalked} of ${cd.anchorsOffered}`);
    check(clicked.dRow.includes('EXPLICIT anchor') && clicked.dRow.includes('a CLICK, not a '
        + 'search') && !clicked.dRow.includes('legal anchor(s)'),
        '⛓ the directives list says it was a CLICK — and does NOT claim "1 of 1 LEGAL '
        + 'anchor(s)", which a refused cell would make false', clicked.dRow.slice(-120));
    check(clicked.gen.armed === null,
        'and the click DISARMED — a second click cannot queue a second directive');

    // ── 8d: the copied PAYLOAD (slice 12 — it was the copied link) ────
    {
        servedPayload = await page.evaluate(() => window.__editorGenerated);
        await load(`gen=${PAYLOAD_ROUTE}`);
        await page.waitForFunction(
            () => window.__editorGenerate?.payloadCheck
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const back = await page.evaluate(() => ({
            gen: window.__editorGenerate,
            level: window.__editorGenerated.level,
            trace: window.__editorGenerated.trace,
            url: window.location.search,
        }));
        check(json(back.level) === json(clicked.level)
            && json(back.trace) === json(clicked.trace),
        '⛓⛓⛓ A COPIED `!tx,ty` **PAYLOAD** REPRODUCES THE WHOLE CONSTRUCTION, BYTE FOR BYTE '
            + '— the clicked CELL survives the channel change');
        check(json(back.gen.directives[0].anchor) === json(target.expect),
            'and the anchor it replayed is the cell that was clicked', json(target.expect));
        check(back.gen.payloadCheck?.agrees === true,
            '⛓ …and the page checked it against its own regeneration and agreed. ⚠ NOT the '
            + 'gate on the VALUE (trap 250): the four-way check above is',
            json(back.gen.payloadCheck?.differences ?? []));
    }

    // ── 8e: the ILLEGAL cell, refused BY NAME with NO solve ──────────
    {
        await load(`source=generate&seed=${DIRECT.seed}&biome=${DIRECT.biome}`
            + `&count=${DIRECT.step}&run=1`);
        const skeletonLevel = await page.evaluate(() => window.__editorGenerated.level);
        await armRow();
        const bad = lastPixelOf(ILLEGAL_CLICK.tx, ILLEGAL_CLICK.ty);
        check(json(bad.expect) === json(ILLEGAL_CLICK),
            `the illegal target pixel is tile ${json(ILLEGAL_CLICK)}, this seed's GOAL cell`,
            json(bad.expect));
        await page.evaluate(() => document.getElementById('canvas')
            .scrollIntoView({ block: 'center' }));
        await page.mouse.click(bad.x, bad.y);
        await page.waitForFunction(
            () => window.__editorGenerate?.directives?.length === 1
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const refused = await page.evaluate(() => ({
            gen: window.__editorGenerate,
            level: window.__editorGenerated.level,
            status: document.getElementById('status').textContent,
            paneRows: [...document.querySelectorAll('#genTrace .tr')]
                .map((e) => e.textContent).filter((t) => /^d1/.test(t.trim())),
        }));
        const rd = refused.gen.directives[0];
        check(rd.outcome === 'ILLEGAL_PLACEMENT' && rd.at === null,
            '⛓⛓⛓ AN ILLEGAL CLICKED CELL IS `ILLEGAL_PLACEMENT` — the class slice 5 recorded '
            + 'as UNREACHABLE, now DRIVEN from the page', `${rd.outcome}, at ${json(rd.at)}`);
        /**
         * ⛔ VERBATIM, and it is the MODEL's own sentence — node's `refusalAt`
         * for the same cell, character for character. A page that paraphrased
         * the rule would pass a substring match and fail this.
         */
        const nodeWhy = nodeIllegal.trace.find((r) => r.directive === 1).reasonText;
        check(refused.paneRows.length === 1 && refused.paneRows[0].includes(nodeWhy),
            '⛔ …with the MODEL\'s own text VERBATIM in the pane, character for character',
            `${nodeWhy.slice(0, 110)}…`);
        check(nodeWhy.includes('is the GOAL cell'),
            '  …and it names the RULE that refused, not a generic "illegal"',
            nodeWhy.slice(0, 90));
        check(json(refused.level) === json(skeletonLevel),
            '⛔ and the level on screen did NOT move');
        check(refused.status.includes('the level on screen is UNCHANGED'),
            '  …and the page SAYS so', refused.status.slice(-90));
        /**
         * ⛔⛔ NO SOLVE WAS SPENT. `ticks` is the oracle's own count and the row
         * carries `null` because the oracle was never called — the half of this
         * claim that a "the outcome was ILLEGAL_PLACEMENT" check cannot see.
         */
        const row = nodeIllegal.trace.find((r) => r.directive === 1);
        check(row.verdict === null && row.ticks === null
            && row.classifiedBy.includes('before any solve'),
            '⛔⛔ …and NO SOLVE WAS SPENT — no verdict, no ticks, and the row says the model '
            + 'answered BEFORE the oracle', row.classifiedBy);
        check(errors.length === 0, 'no page errors through the whole click path',
            errors.join(' | ') || 'none');
    }
}

// ── CLAIM 4: ?gen= reproduces node's payload in the browser ──────────
if (!host) {
    /**
     * ⛔ WAIT FOR THE REPRODUCTION TO HAVE BEEN CHECKED, NOT FOR THE ARM TO
     * HAVE A READOUT — the same law `settled` states one claim up, which this
     * claim did not follow until slice 4 caught it.
     *
     * ⛓ MEASURED, on a box under load (~10 on 8 cores) while another project
     * built in parallel: `load()` resolves when `window.__editorGenerate`
     * first EXISTS, and the `?gen=` path sets it at the **SKELETON** — the
     * ladder and the payload comparison come after. So the read could land on
     * step 0, where `payloadCheck` is null and the level is the empty room,
     * and all three of this claim's lines went red on a page that then went on
     * to reproduce the payload byte-identically (probed separately: `{checked:
     * true, agrees: true}`). A pre-existing hole in the row, not in the page —
     * and one that only fires when the box is slow enough to schedule the poll
     * between the skeleton and the run.
     */
    const reproduced = () => page.waitForFunction(
        () => window.__editorGenerate?.payloadCheck
            && !document.getElementById('genRunAll').disabled,
        null, { timeout: 300000 });
    await load(`gen=${GEN_ROUTE}`);
    await reproduced();
    const web = await page.evaluate(() => ({
        gen: window.__editorGenerate,
        level: window.__editorGenerated?.level ?? null,
    }));
    check(web.gen.payloadCheck?.checked === true,
        'the ?gen= payload was checked rather than merely displayed');
    check(web.gen.payloadCheck?.agrees === true,
        'the browser REPRODUCED node\'s payload byte-identically — level AND trace',
        json(web.gen.payloadCheck?.differences ?? []));
    check(json(web.level) === json(payload.level),
        'and what it drew is that level');

    /**
     * ── ⛓⛓⛓ CLAIM 5d: `?gen=` IS AN IDENTITY, SO IT CANNOT SHARE THE BAR ──
     *
     * The payload names its own seed/biome/bounds and REPLACES the URL's, so
     * a link carrying both it and the form's values holds two spellings of
     * one run — the exact defect slice 1 exists to end. At the first press
     * the page owns the run, `gen` goes, and the explicit parameters take
     * over. ⚠ `source=generate` has to go in with them: `?gen=` was also what
     * SELECTED this arm.
     */
    const other = PRE.seed + 3;
    await page.fill('#genSeed', String(other));
    await page.click('#genStep');
    await settled(1, other);
    const dropped = await panelOf();
    const du = new URLSearchParams(dropped.url);
    const nodeDropped = generateStep({
        seed: other, biome: PRE.biome, step: 1, bounds: nodeFull.bounds,
    });
    check(!du.has('gen') && du.get('source') === 'generate' && du.get('seed') === String(other)
        && du.get('count') === '1' && du.get('run') === '1',
        '⛓ the first press DROPS ?gen= and writes the explicit parameters — including '
        + '?source=generate, since ?gen= was also the arm selector', dropped.url);
    check(/\?gen= was DROPPED at the press/.test(await page.textContent('#detail')),
        'and the page SAYS the reproduction claim is gone rather than just dropping it',
        await page.textContent('#detail'));
    const backFromDrop = await load(dropped.url.replace(/^\?/, ''));
    await settled(1, other);
    const droppedLevel = await page.evaluate(() => window.__editorGenerated.level);
    check(json(droppedLevel) === json(nodeDropped.record),
        'and the ?gen=-free link reproduces the level the press produced, byte for byte',
        `step ${backFromDrop.gen.step}`);
} else {
    // ⚠ NAMED, not skipped silently: with `--host=` the caller's server has
    // no route to serve the payload at, so this claim has no vehicle.
    console.log('NOTE: claim 4 (?gen=) needs this row\'s OWN server to serve the payload '
        + 'route, so it is not available under --host=. Run without --host= for it.');
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 8 — `?skeleton=` (CONSTRUCTIVE-MODE SLICE 5)
 * ══════════════════════════════════════════════════════════════════════
 *
 * The Seedling half of the constructive mode, in the browser. ⛔ THE VALUES ARE
 * ASSERTED AGAINST LITERALS THIS FILE STATES, never against a round trip: a
 * fixed point tests self-consistency and never correctness.
 *
 * ⚠ THE BOUNDS ARE DELIBERATELY TINY. Probe 2 measured it and the CLI confirms
 * it: pass 2 over a carved corridor saturates, and a candidate that SEALS the
 * corridor makes the planner run to its cap before refusing (a default-bounds
 * saturated run took 106 s). The claim here is that the KIND reaches the loop
 * and produces a ROW — the yield table (slice 6) is where the cost is measured.
 */
{
    const KIND = 'winding';
    /**
     * ⛓⛓ RE-PICKED AT ARC 3 SLICE 4c (trap 285 — the scan and the count are
     * named). The seal claim needs a `winding` skeleton on which a 2-or-3 cell
     * wall segment SEALS the room, found by this file's own INDEPENDENT flood;
     * the GOAL DRAW moved every `winding` room and **seed 3 no longer has one**
     * — its own precondition row is what said so, which is why that row is
     * there. RE-SCANNED over seeds 1..12: **eleven of the twelve have a sealer**
     * (3 is the only one that does not), and **seed 1 is taken** — the first,
     * with `wall-segment(ori=h,len=2)` at (1,3).
     */
    const CARVED = { seed: 1, biome: 'pre-sword', count: 1, tries: 1, k: 1 };
    const nodeCarvedSkeleton = generateStep({
        seed: CARVED.seed, biome: CARVED.biome, step: 0, skeleton: { kind: KIND },
    });
    const nodeOpenSkeleton = generateStep({ seed: CARVED.seed, biome: CARVED.biome, step: 0 });

    const q = `source=generate&seed=${CARVED.seed}&biome=${CARVED.biome}`
        + `&count=${CARVED.count}&tries=${CARVED.tries}&k=${CARVED.k}&skeleton=${KIND}`;
    const web = await load(q);
    check(web.gen.status === 'ok', 'the arm mounted under ?skeleton=' + KIND,
        web.gen.message ?? web.gen.status);
    check(json(web.gen.skeleton) === json({ kind: KIND }),
        `⛓ ?skeleton=${KIND} reached the MODEL — the state names the kind`,
        json(web.gen.skeleton));
    /**
     * ⛔ THE CLAIM THAT CANNOT BE SATISFIED BY ECHOING THE PARAMETER: the room
     * the page drew is node's own CARVED skeleton, byte for byte, and it is NOT
     * the open room the same seed produces.
     */
    check(json(web.level) === json(nodeCarvedSkeleton.record),
        '⛓⛓ …and the room on screen IS node\'s carved skeleton, byte for byte');
    check(json(web.level) !== json(nodeOpenSkeleton.record),
        '⛔ …and it is NOT the open room the same seed builds — the parameter did work, '
        + 'not just get echoed');
    check(/skeleton: winding \(CARVED, not the open room\)/.test(web.gen.identity ?? ''),
        'the identity line NAMES the carved kind', web.gen.identity);
    // ⚠ `load()`'s object has no address bar in it — `panelOf()` is where this
    // page reads one, and it is the same helper every other URL claim uses.
    const carvedPanel = await panelOf();
    check(new URLSearchParams(carvedPanel.url).get('skeleton') === KIND,
        '⛓ the bar still names it — ?skeleton=winding', carvedPanel.url);

    /** ⛓ THE SELECTOR shows the kind the URL asked for, and greys what Seedling cannot run. */
    const selector = await page.evaluate(() => {
        const sel = document.getElementById('genSkeleton');
        return {
            value: sel?.value ?? null,
            options: [...(sel?.options ?? [])].map((o) => ({
                v: o.value, disabled: o.disabled, title: o.title,
            })),
        };
    });
    check(selector.value === KIND, 'the SKELETON selector shows the kind the URL named',
        json(selector.value));
    check(selector.options.map((o) => o.v).join(',')
        === 'empty,classic,corridor,branchy,bushy,loopy,open,rooms,winding',
        'the selector lists the WHOLE vocabulary — one set of names, both substrates',
        json(selector.options.map((o) => o.v)));
    const greyed = selector.options.filter((o) => o.disabled).map((o) => o.v);
    check(json(greyed) === json(['classic', 'corridor']),
        '⛔ …with exactly the two simulator-bound kinds GREYED rather than hidden',
        json(greyed));
    check(/maze simulator/.test(selector.options.find((o) => o.v === 'corridor')?.title ?? ''),
        '…and the greyed row carries its REASON, so "why can\'t I pick that?" has an answer',
        selector.options.find((o) => o.v === 'corridor')?.title);

    /** ⛓ STEP produces a ROW on a carved room — Probe 2's outcome, whatever it is. */
    await page.click('#genStep');
    await settled(1, CARVED.seed);
    const stepped = await page.evaluate(() => ({
        step: window.__editorGenerate.step,
        rows: window.__editorGenerate.genRows,
        vetoes: window.__editorGenerate.vetoes,
        skeleton: window.__editorGenerate.skeleton,
    }));
    check(stepped.step === 1 && stepped.rows > 0,
        '⛓ STEP on a CARVED room produces attempt row(s) — a saturating pass 2 is still a '
        + 'pass 2, and the page shows what happened',
        `step ${stepped.step}, ${stepped.rows} row(s), ${json(stepped.vetoes)}`);
    check(json(stepped.skeleton) === json({ kind: KIND }),
        '…and the kind survived the press', json(stepped.skeleton));

    /** ⛔ THE DEFAULT IS SPELLED BY ABSENCE. */
    const open = await load(`source=generate&seed=${CARVED.seed}&biome=${CARVED.biome}&count=1`);
    const openPanel = await panelOf();
    check(new URLSearchParams(openPanel.url).get('skeleton') === null,
        '⛔ the writer DELETES ?skeleton= at the open room rather than writing the default',
        openPanel.url);
    check(!/skeleton: /.test(open.gen.identity ?? ''),
        '…and the identity line stays silent about the kind when it is the open room',
        open.gen.identity);
    check(json(open.level) === json(nodeOpenSkeleton.record),
        '…and the open room is still node\'s own open room, byte for byte');

    /* ── 8f2: THE KIND PARAMETERS (constructive-mode slice 7) ─────── */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM, NOT AN ECHO (trap 269, which this arc paid for on
     * the maze page in slice 5). The subject is the count of `ground` cells in
     * the room the PAGE built, read off `window.__editorGenerated.level` — a
     * page that copied `;chambers=2` into its readout and its bar while carving
     * without it fails this claim and no other.
     */
    const roomyQ = `source=generate&seed=${CARVED.seed}&biome=${CARVED.biome}&count=0`
        + `&skeleton=${encodeURIComponent(`${KIND};chambers=2`)}`;
    const plainQ = `source=generate&seed=${CARVED.seed}&biome=${CARVED.biome}&count=0`
        + `&skeleton=${KIND}`;
    const plainRoom = await load(plainQ);
    const roomyRoom = await load(roomyQ);
    /**
     * ⛔ COUNTED THROUGH THE RECORD'S OWN READER (`terrainAt`), never off a
     * raw field: the record's terrain list is sparse and a cell nobody painted
     * reads as the level's floor default, so `terrain.length` would answer a
     * different question than "how much of this room can be stood on".
     */
    const groundIn = (level) => {
        if (!level) return 0;
        let n = 0;
        for (let ty = 1; ty < level.height - 1; ty += 1) {
            for (let tx = 1; tx < level.width - 1; tx += 1) {
                if (terrainAt(level, tx, ty) === 'ground') n += 1;
            }
        }
        return n;
    };
    check(groundIn(roomyRoom.level) > groundIn(plainRoom.level),
        `⛓⛓ ?skeleton=${KIND};chambers=2 produces MORE GROUND than ?skeleton=${KIND} at the `
        + 'same seed — counted from the LEVEL the page built, not from the URL it echoed',
        `${groundIn(roomyRoom.level)} ground cells vs ${groundIn(plainRoom.level)}`);
    const nodeRoomy = generateStep({
        seed: CARVED.seed, biome: CARVED.biome, step: 0,
        skeleton: { kind: KIND, params: { chambers: 2 } },
    });
    check(json(roomyRoom.level) === json(nodeRoomy.record),
        '⛓⛓ …and the browser\'s parameterized room IS node\'s, byte for byte');
    check(new RegExp(`skeleton: ${KIND};chambers=2 \\(CARVED`).test(roomyRoom.gen.identity ?? ''),
        '⛓ the identity line NAMES the non-default parameter, in the URL\'s own spelling',
        roomyRoom.gen.identity);
    const roomyPanel = await panelOf();
    check(new URLSearchParams(roomyPanel.url).get('skeleton') === `${KIND};chambers=2`,
        '⛓ …and the bar still spells it that way after the page rewrote the URL',
        roomyPanel.url);
    /** ⛓ THE FORM — one control per declared knob, mounted from the catalogue. */
    await load(`source=generate&seed=${CARVED.seed}&biome=${CARVED.biome}&count=0`
        + '&skeleton=rooms');
    const skelParams = await page.evaluate(() => [...document.querySelectorAll(
        '#genSkeletonParams select[data-skel-param]')].map((s2) => s2.dataset.skelParam));
    check(json(skelParams) === json(['minRoom', 'chambers']),
        '⛓ the SKELETON PARAMS form mounts one control per declared knob, in declaration '
        + 'order', json(skelParams));
    /** ⛔ …and a REFUSAL BY NAME on the parameter rather than on the kind. */
    await page.goto(`${origin}${PAGE_PATH}?source=generate`
        + `&skeleton=${encodeURIComponent('rooms;minRoom=9')}`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorParams?.status === 'refused',
        null, { timeout: 60000 });
    const refusedParam = await page.evaluate(() => window.__editorParams);
    check(/declared domain \[2, 3, 4\]/.test(refusedParam.message ?? ''),
        '⛔ ?skeleton=rooms;minRoom=9 REFUSES BY NAME with the declared domain',
        refusedParam.message);

    /* ── 8g: THE CONNECTIVITY PRE-CHECK, ON THE PAGE (slice 6) ─────── */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM ABOUT WHAT THE RULE DID (trap 269), not an echo of
     * the outcome word.
     *
     * ⛔ THE CELL IS FOUND BY AN INDEPENDENT FLOOD WRITTEN HERE, never by asking
     * `refusalAt` which cell it dislikes: a row that located its subject with
     * the rule it then asserts would be *"the model agrees with itself"* —
     * green for a build whose flood is inverted, because the search and the
     * assertion would move together. The flood below is written from the rule's
     * ENGLISH: 4-neighbour, `ground` only, terrain writes applied, entities
     * ignored.
     */
    {
        const skelRecord = nodeCarvedSkeleton.record;
        const start = nodeCarvedSkeleton.model.defaults.start;
        const goal = nodeCarvedSkeleton.model.goalCell;
        const opens = (writes) => {
            const painted = new Map(writes.map((w) => [`${w.tx},${w.ty}`, w.terrain]));
            const ok = (x, y) => x >= 0 && y >= 0 && x < skelRecord.width
                && y < skelRecord.height
                && (painted.get(`${x},${y}`) ?? terrainAt(skelRecord, x, y)) === 'ground';
            if (!ok(start.tx, start.ty) || !ok(goal.tx, goal.ty)) return false;
            const seen = new Set([`${start.tx},${start.ty}`]);
            let ring = [{ x: start.tx, y: start.ty }];
            while (ring.length) {
                const nextRing = [];
                for (const p of ring) {
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const c = { x: p.x + dx, y: p.y + dy };
                        const key = `${c.x},${c.y}`;
                        if (seen.has(key) || !ok(c.x, c.y)) continue;
                        if (c.x === goal.tx && c.y === goal.ty) return true;
                        seen.add(key);
                        nextRing.push(c);
                    }
                }
                ring = nextRing;
            }
            return false;
        };
        let SEALER = null;
        for (const [ori, len] of [['h', 2], ['v', 2], ['h', 3], ['v', 3]]) {
            for (let ty = 1; ty < skelRecord.height - 1 && !SEALER; ty += 1) {
                for (let tx = 1; tx < skelRecord.width - 1 && !SEALER; tx += 1) {
                    const cells = Array.from({ length: len }, (_, i) => (ori === 'h'
                        ? { tx: tx + i, ty } : { tx, ty: ty + i }));
                    const inside = cells.every((c) => c.tx < skelRecord.width - 1
                        && c.ty < skelRecord.height - 1);
                    const free = cells.every((c) => terrainAt(skelRecord, c.tx, c.ty) === 'ground'
                        && !(c.tx === start.tx && c.ty === start.ty)
                        && !(c.tx === goal.tx && c.ty === goal.ty));
                    if (!inside || !free) continue;
                    if (opens(cells.map((c) => ({ ...c, terrain: 'wall' })))) continue;
                    SEALER = { ori, len, tx, ty };
                }
            }
            if (SEALER) break;
        }
        check(SEALER !== null,
            `⛓ a sealing subject EXISTS on seed ${CARVED.seed}'s \`${KIND}\` skeleton — found `
            + 'by an INDEPENDENT flood in this file, never by asking the rule',
            SEALER ? `wall-segment(ori=${SEALER.ori},len=${SEALER.len})@(${SEALER.tx},`
                + `${SEALER.ty})` : 'NONE — the claim below has no subject');
        if (SEALER) {
            /**
             * ⛓ SLICE 12 — the spec is the one THE CLICK BUILDS (bound 1), so
             * node and the page ask the same question. ⛓⛓ SLICE 4c: the click
             * no longer builds a `keepPolicy` at all — Seedling runs every
             * directive under `first-solved` and `applyDirective` REFUSES a spec
             * that names one, so a policy here would make this row ask a
             * question the page cannot.
             */
            const spec = { template: 'wall-segment', params: { ori: SEALER.ori, len: SEALER.len },
                anchor: { tx: SEALER.tx, ty: SEALER.ty }, bound: 1 };
            const nodeSealed = generateWithDirectives({
                seed: CARVED.seed, biome: CARVED.biome, step: 0,
                skeleton: { kind: KIND }, directed: [spec],
            });
            const nodeWhy = nodeSealed.trace.find((r) => r.directive === 1).reasonText;
            // ⛓⛓ DRIVEN THROUGH THE PAGE'S AT… CONTROL AND A CLICK — the
            // affordance §3.9 leaves for naming a cell (it was `?directed=…!x,y`).
            const sealedWeb = await load(`source=generate&seed=${CARVED.seed}`
                + `&biome=${CARVED.biome}&count=0&skeleton=${KIND}`);
            await armTemplate('wall-segment', { ori: SEALER.ori, len: SEALER.len });
            await clickTile(SEALER.tx, SEALER.ty);
            await page.waitForFunction(
                () => window.__editorGenerate?.directives?.length === 1
                    && !document.getElementById('genRunAll').disabled,
                null, { timeout: 300000 },
            );
            const sealedPane = await page.evaluate(() => ({
                directives: window.__editorGenerate?.directives ?? [],
                rows: [...document.querySelectorAll('#genTrace .tr')].map((e) => e.textContent),
            }));
            const sdir = sealedPane.directives[0];
            check(sdir?.outcome === 'ILLEGAL_PLACEMENT' && sdir?.at === null,
                '⛓⛓⛓ SLICE 6: an EXPLICIT-anchor directive that would SEAL a `winding` '
                + 'corridor is ILLEGAL_PLACEMENT — the MODEL refused it before any solve',
                `${sdir?.outcome}, at ${json(sdir?.at)}`);
            check(sealedPane.rows.some((t) => t.includes(nodeWhy)),
                '⛓⛓ …and the PANE prints the flood\'s own sentence VERBATIM — node\'s '
                + '`refusalAt` for the same cell, character for character',
                `${(nodeWhy ?? '(none)').slice(0, 120)}…`);
            check(/would SEAL the room/.test(nodeWhy ?? '')
                && new RegExp(`no ground path from the START \\(${start.tx},${start.ty}\\) to `
                    + `the GOAL \\(${goal.tx},${goal.ty}\\)`).test(nodeWhy ?? ''),
            '⛓ …and the sentence names THIS RULE and the two cells THIS FILE computed '
                + 'independently — a VALUE claim, not an echo of the outcome word',
            (nodeWhy ?? '').slice(0, 150));
            check(json(sealedWeb.level) === json(nodeCarvedSkeleton.record),
                '⛔ …and the level on screen did NOT move — a refusal keeps the old record');
        }
    }

    /** ⛔ A KIND SEEDLING CANNOT BUILD REFUSES BY NAME, at READ time. */
    await page.goto(`${origin}${PAGE_PATH}?source=generate&skeleton=corridor`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorParams?.status === 'refused',
        null, { timeout: 60000 });
    const refusedKind = await page.evaluate(() => window.__editorParams);
    check(/\?skeleton="corridor"/.test(refusedKind.message ?? '')
        && /needs the maze simulator/.test(refusedKind.message ?? '')
        && /the Seedling page offers/.test(refusedKind.message ?? ''),
        '⛔ ?skeleton=corridor REFUSES BY NAME, with what it needs AND what IS offered',
        refusedKind.message);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 8g — THE PRE-CHECK ON THE **OPEN** ROOM (SLICE 6b)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ THE USER DROPPED THE RULE'S KIND SCOPE on 2026-08-15 (the PROCGEN ELEMENTS
 * design session; GENERATE-UI ruling 5 licensed the pair expiry), so `empty` —
 * the kind every committed seed→level pair is generated at — is no longer
 * exempt. This is that claim on the page.
 *
 * ⛔ **THE SUBJECT CANNOT BE A SKELETON, AND THAT IS THE WHOLE POINT.** The
 * longest wave-1 row is `wall-segment(len=5)` against an 8x8 interior, so no
 * single candidate seals a FRESH open room — which is exactly why slice 6's
 * *"the `empty` room never seals"* fixture stayed green while 8 committed pairs
 * moved underneath it (§13.6 B). An open room seals only once pass 2 has
 * ACCUMULATED terrain, so the subject below is the record after a REAL LADDER of
 * `k` steps, scanned by an INDEPENDENT flood written here (trap 269: the cell is
 * never chosen by asking `refusalAt` which cell it dislikes).
 */
{
    const OPEN_BIOME = 'pre-sword';
    let OPEN = null;
    for (let seed = 1; seed <= 12 && !OPEN; seed += 1) {
        for (let step = 1; step <= 4 && !OPEN; step += 1) {
            let st = null;
            try {
                st = generateStep({ seed, biome: OPEN_BIOME, step });
            } catch { continue; } // ⚠ an ABORTING ladder is not a subject; skipped BY NAME below
            const rec = st.record;
            const start = st.model.defaults.start;
            const goal = st.model.goalCell;
            const opens = (writes) => {
                const painted = new Map(writes.map((w) => [`${w.tx},${w.ty}`, w.terrain]));
                const ok = (x, y) => x >= 0 && y >= 0 && x < rec.width && y < rec.height
                    && (painted.get(`${x},${y}`) ?? terrainAt(rec, x, y)) === 'ground';
                if (!ok(start.tx, start.ty) || !ok(goal.tx, goal.ty)) return false;
                const seen = new Set([`${start.tx},${start.ty}`]);
                let ring = [{ x: start.tx, y: start.ty }];
                while (ring.length) {
                    const nextRing = [];
                    for (const p of ring) {
                        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                            const c = { x: p.x + dx, y: p.y + dy };
                            const key = `${c.x},${c.y}`;
                            if (seen.has(key) || !ok(c.x, c.y)) continue;
                            if (c.x === goal.tx && c.y === goal.ty) return true;
                            seen.add(key);
                            nextRing.push(c);
                        }
                    }
                    ring = nextRing;
                }
                return false;
            };
            for (const [ori, len] of [['v', 5], ['h', 5], ['v', 4], ['h', 4], ['v', 3],
                ['h', 3], ['v', 2], ['h', 2]]) {
                for (let ty = 1; ty < rec.height - 1 && !OPEN; ty += 1) {
                    for (let tx = 1; tx < rec.width - 1 && !OPEN; tx += 1) {
                        const cells = Array.from({ length: len }, (_, i) => (ori === 'h'
                            ? { tx: tx + i, ty } : { tx, ty: ty + i }));
                        const inside = cells.every((c) => c.tx < rec.width - 1
                            && c.ty < rec.height - 1);
                        // ⛔ THE FOOTPRINT WALK RUNS FIRST, so a cell it would
                        // reject is not a subject for the FLOOD — my own row
                        // caught that: the first draft picked a cell holding a
                        // pushable block and got `ILLEGAL_PLACEMENT` for the
                        // wrong rule, with the right outcome word. `isFree` is
                        // a DIFFERENT rule from the one under test, so using it
                        // as a precondition is not trap 269's echo.
                        const free = cells.every((c) => terrainAt(rec, c.tx, c.ty) === 'ground'
                            && st.model.isFree(rec, c.tx, c.ty)
                            && !(c.tx === start.tx && c.ty === start.ty)
                            && !(c.tx === goal.tx && c.ty === goal.ty));
                        if (!inside || !free) continue;
                        if (opens(cells.map((c) => ({ ...c, terrain: 'wall' })))) continue;
                        OPEN = { seed, step, ori, len, tx, ty, start, goal };
                    }
                }
                if (OPEN) break;
            }
        }
    }
    check(OPEN !== null,
        '⛓ an OPEN-room sealing subject EXISTS — a `empty` ladder of k steps whose ACCUMULATED '
        + 'terrain one more wall-segment would seal, found by an INDEPENDENT flood in this '
        + 'file and never by asking the rule',
        OPEN ? `seed ${OPEN.seed} ${OPEN_BIOME} at step ${OPEN.step}: `
            + `wall-segment(ori=${OPEN.ori},len=${OPEN.len})@(${OPEN.tx},${OPEN.ty})`
            : 'NONE — the claim below has no subject, and the scan has to be widened');
    if (OPEN) {
        // ⛓ SLICE 4c: no `keepPolicy` — see the sealing spec above.
        const spec = { template: 'wall-segment', params: { ori: OPEN.ori, len: OPEN.len },
            anchor: { tx: OPEN.tx, ty: OPEN.ty }, bound: 1 };
        const nodeOpenSealed = generateWithDirectives({
            seed: OPEN.seed, biome: OPEN_BIOME, step: OPEN.step, directed: [spec],
        });
        const nodeWhy = nodeOpenSealed.trace.find((r) => r.directive === 1).reasonText;
        // ⛓⛓ SLICE 12 — AT… + a click, on the ladder this subject was measured on.
        const web = await load(`source=generate&seed=${OPEN.seed}&biome=${OPEN_BIOME}`
            + `&count=${OPEN.step}&run=1`, { step: OPEN.step, seed: OPEN.seed });
        await armTemplate('wall-segment', { ori: OPEN.ori, len: OPEN.len });
        await clickTile(OPEN.tx, OPEN.ty);
        await page.waitForFunction(
            () => window.__editorGenerate?.directives?.length === 1
                && !document.getElementById('genRunAll').disabled,
            null, { timeout: 300000 },
        );
        const pane = await page.evaluate(() => ({
            directives: window.__editorGenerate?.directives ?? [],
            rows: [...document.querySelectorAll('#genTrace .tr')].map((e) => e.textContent),
        }));
        const od = pane.directives[0];
        check(od?.outcome === 'ILLEGAL_PLACEMENT' && od?.at === null,
            '⛓⛓⛓ SLICE 6b: an EXPLICIT-anchor directive that would SEAL the **OPEN** room is '
            + 'ILLEGAL_PLACEMENT — `empty` is no longer exempt from the pre-check',
            `${od?.outcome}, at ${json(od?.at)}`);
        check(/would SEAL the room/.test(nodeWhy ?? '')
            && /at EVERY skeleton kind — this room is "empty"/.test(nodeWhy ?? '')
            && new RegExp(`no ground path from the START \\(${OPEN.start.tx},`
                + `${OPEN.start.ty}\\) to the GOAL \\(${OPEN.goal.tx},${OPEN.goal.ty}\\)`)
                .test(nodeWhy ?? ''),
        '⛓⛓ …and the sentence names THIS ROOM\'S OWN KIND (`empty`) plus the two cells THIS '
            + 'FILE computed — a VALUE claim: the kind-scoped build could not produce this '
            + 'line at all',
        (nodeWhy ?? '(none)').slice(0, 170));
        check(pane.rows.some((t) => t.includes(nodeWhy)),
            '⛓ …and the PANE prints it VERBATIM — node\'s `refusalAt` for the same cell, '
            + 'character for character',
            `${(nodeWhy ?? '(none)').slice(0, 110)}…`);
        check(json(web.level) === json(generateStep({
            seed: OPEN.seed, biome: OPEN_BIOME, step: OPEN.step,
        }).record),
        '⛔ …and the level on screen is the k-step ladder UNMOVED — a refusal keeps the old '
        + 'record');
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ CLAIM 9 — `?directed=` IS REFUSED BY NAME (CONSTRUCTIVE SLICE 12)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §3.9. ⛔ A saved link naming a construction must FAIL LOUDLY rather than
 * quietly open the plain ladder — a page that dropped the parameter would show
 * a level the address promises is something else, which is the failure the
 * whole URL grammar is full of refusals about. The refusal has to NAME THE WAY
 * IN: a reader holding an old link has no other channel to learn where
 * directives went.
 */
{
    const stale = `${DIRECT.template}(ori=${DIRECT.params.ori},gap=${DIRECT.params.gap})`
        + `@${DIRECTED_ANCHOR_TRIES}d`;
    await page.goto(`${origin}${PAGE_PATH}?source=generate&seed=${DIRECT.seed}`
        + `&biome=${DIRECT.biome}&count=0&directed=${encodeURIComponent(stale)}`,
    { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorParams?.status === 'refused',
        null, { timeout: 60000 });
    const refusedDirected = await page.evaluate(() => window.__editorParams);
    check(/no longer a URL parameter/.test(refusedDirected.message ?? ''),
        '⛔⛔ SLICE 12: ?directed= REFUSES BY NAME on watch.html — a link from before the diet '
        + 'does not silently open the ladder', refusedDirected.message);
    check(/directives ride the PAYLOAD/.test(refusedDirected.message ?? '')
        && /\?gen=/.test(refusedDirected.message ?? '')
        && /SEND/.test(refusedDirected.message ?? '')
        && /--directed=/.test(refusedDirected.message ?? ''),
    '⛔ …and the refusal NAMES ALL THREE WAYS IN — `?gen=`, the host\'s SEND, and the CLI '
        + 'flag that stayed', refusedDirected.message);
    check(await page.evaluate(() => window.__editorGenerate === undefined
        || window.__editorGenerate === null),
    '⛔ …and NO run happened: a refused parameter does not fall through to a level nobody '
        + 'asked for');
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
