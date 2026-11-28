# Seedling hammer-phase: CHASER-STAND (a press kill's strike approach priced against chasers)

Slice `seedling-hammer-chaser-stand` (Opus, cloud). Planner: `seedling-hammer-phase-planning-16`. ⚖ Approved by the user
on 2026-11-26 (*"Chaser-stand fix (Recommended)"*): measure first, switch-guarded OFF. Landing needs the user's own
SHA-bound OK (the planner asks). No planner follow-up arrived during the slice, so none was followed. Evidence:
[`seedling-hammer-chaser-stand-evidence/`](seedling-hammer-chaser-stand-evidence/).

## 1. Commits

- **Start:** `e06722c153` (branch `hammer-flip-lhm`, the brief's base: `hammer-stack-4sw` @d8bd5bb578 plus
  `LATCHED_HOLD_MOVE` ON). Acceptance md5 measured there: `391322d681b7aa0229d94b3f6906d024`.
- **Branch:** `claude/seedling-chaser-stand-fix-lethjl`.
- **Commits:**
  - `98d72264`: step 1, the reproduction (measurement only);
  - `ecd64826`: step 2, `OPP_AIM_CHASERS` and `PRESS_KILL_STRIKE_BOMBS`;
  - `7fbfb25c`: step 3, the train-tier witness rows and the F1 32:10 game witness;
  - `eac45148`: step 2b, `HIT_AVOID_STAND_BOMBS`;
  - `f6f72cd0`: steps 4–5, the evidence (matrix, sweep, fixtures, surveys, census);
  - the report commit (this file) is the head.

## 2. The answer first

- **The one thing to know first:** the chaser hit is **not the strike approach's stand**. The stand is fine: PKC refuses
  the walk key five ticks running and stands the player clear. The hit is the **next tick's opportunistic AIM** at that
  same bob. An OPP aim skips `safeStep`, so PKC is never asked, and `oppStrikeLandsClear` asks the hammers only. The aim's
  one step (`up`, 0.8 px) walks the player into the bob. Class **(a)**, a solver miss.
- **Three switches, all OFF, all in the solve worker:**

  | switch | what it asks | where |
  |---|---|---|
  | `OPP_AIM_CHASERS` (OAC) | the press kill's drive offers the OPP an in-reach body for an aim only when the aim lands chaser-clear (PKC's own `landsClearOfChasers`) | `solverBot.js`, one new function + one call site |
  | `PRESS_KILL_STRIKE_BOMBS` (PSB) | `deriveStrike`'s stand asks the lobber: `PRESS_KILL_BOMBS`' stand half alone, as PKRB is its refuge half | `solverBot.js`, one condition |
  | `HIT_AVOID_STAND_BOMBS` (HSB) | after the ladder (and hit-avoid), a plan that **still bills a hit** reruns the first pass once with PSB ON; only a hitless plan replaces it | `jsRuntimeSolver.js`, one block + one function |

- **The recommended set is `OPP_AIM_CHASERS` + `HIT_AVOID_STAND_BOMBS`** (PSB is used only through HSB). On top of all4 it
  **meets the brief's bar**:
  - **16-seam sweep of 32:10: 12 hitless / 0 with hits / 4 refusals**. all4 alone is 11 / 2 / 3. **No hitless solve of
    all4's is lost.**
  - **Every measured request ships 0 hits**: F1/A1 32:10, F1/A1 32:12, P1 32:10 at −20/0/+7, under all4 and under
    PKSW+PKRB.
  - A1 32:10 keeps 651 t, 0 h, and 32:12 keeps 1889 t, 0 h.
  - **Survey `--through=end`**: identical to all4 on all 250 steps, and no step gains a hit.
  - **The 18 L40 fixtures by key**: identical to all4 on all 18. Legs 371 (1678 t) and 376 (1599 t) keep their 0-hit
    solves.
- **F1 32:10 itself (the bad arrival) refuses** under the recommended set: no hit, but no plan either.
  - Its dashless pass now keeps the kill hitless and then refuses, by name, on the next step's latched hold
    (`wandlock@176,208`; LHM is asked and declines).
  - Base OFF refuses there too. The whole-game walk would retry or stop as it does at OFF.
  - It solves **hitless only with PSB ON everywhere**: 814 t, 0 h, played on a fresh p4g page as finished 2263/2263 with
    0 hits. But PSB everywhere loses three sweep seams and A1 32:10.
- **Flip-ready by the numbers?** PKSW + PKRB (+ DSS) + OAC + HSB: **yes on this slice's bar** (0 hits everywhere
  measured, no hitless solve lost). What remains: §9.

## 3. The reproduction (measured)

**Inputs.**
- The captures are fetched from their branches:
  - re-measure-9's `F1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-9-ltkolv`);
  - re-measure-8's `A1`/`P1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-8-89f0jy`).
- Each request is solved in node as the worker does (`tools/solve.mjs`, STACK4's, plus a `passes` column). Each hit is
  owned by the last verb row at or before its key.
- The per-tick logs come from `tools/cs-hook.mjs`, an in-memory loader patch (no repo file edited). It logs, per press
  kill tick:
  - the walk's key before the OPP, the OPP decision and the key taken;
  - every `landsClearOfChasers` verdict PKC asked.

**F1 32:10 under all4, the defect** (`measure/f1-32-10-all4-off-ticks.txt`). The plan is 926 t, 1 h,
`t1799 chaser:bob@272,112 <- row1755 kill`, answer `851256c5b984` (STACK4's). In the second kill's walk to its strike
cell (216,152):

| key | walk key | OPP | taken | PKC's verdicts this tick |
|---|---|---|---|---|
| 1791 | left+up | none | left+up | left+up:ok |
| 1792 | left+up | none | **down** | left+up:**HIT**, stand:HIT, right:HIT, up:HIT, left:HIT, down:ok |
| 1793–1796 | left+up | none | **stand** | left+up:**HIT**, stand:ok |
| **1797** | left+up | **aim** | **up** | **(not asked: an OPP aim skips `safeStep`)** |
| 1798 | left+up | press | primary | – |

- So PKC prices this approach correctly and stands the player clear.
- The read that misses is the OPP's: `oppStrikeOffer` → `oppStrikeLandsClear` prices the aim and press against the
  **spinners only**. The policy then aims at the bob itself, and the aim's step lands in its contact.
- **Classification: (a)**, a solver miss.

**Why `hit-avoid` is cut at `window`** (`measure/hit-avoid-budget.txt`, `tools/ha-hook.mjs`):
- The pass stops 85 units after its own start. One try is a whole dashless re-solve from a later start: 361 → 484, so
  **123 units**. The first try is cut at unit 86.
- Given the attempt's whole remaining budget, delay 1 **still plans 1 hit** (786 t), and delay 2 is cut by the 640 budget.
- So the budget component **(d)** is real, but not the fix: more hit-avoid budget does not make F1 hitless.
- "Do not ship a billed-hit plan while a hit-avoid try remains" would cost +38 units per try here and change nothing on
  F1.

**PKSW alone's `bomb#9` (t1690, kill@1663).** It is PKSW-HITS' own measured cause: a refuge at the player's own cell
while the dead body fades, with nothing asking the lobber. PKRB fixes it: A1/F1 32:10 under PKSW+PKRB give 651 t, 0 h and
the chaser defect respectively. OAC does not touch it (PKSW-alone variants keep `#9`, §4). **Class (a), already fixed by
PKRB.**

**The seam +7 strike-stand bomb (`#8`, t1644)** (`measure/psb-stand-shadow.txt`, `tools/psb-hook.mjs`: PSB's stand
question as a shadow, refusing nothing):
- Under all4 the kill takes strike (232,168), press +24. The shadow says #8 lands at +28 at (218,168), and the live
  player stands on that cell ((231.9,167.6)) when it does. That is the hit.
- It is `PRESS_KILL_BOMBS`' stand half, switched off in PKB-OFF. **Class (a)**; PSB is that half alone.
- **PSB everywhere over-refuses.** At seam −60, all4 ships 651 t, 0 h, yet the strike it takes at t1579, (248,152), is
  "bombed" by the same question (#7 at +18). The live walk never stands there: it re-derives, and the bomb, aimed at the
  real player, lands at (235,130) while the player is at (239.3,146.7). Refusing that strike sends the search into a room
  corner that refuses (*"the combat ladder is EXHAUSTED"*, bomb #14 on the corridor), even with the full pass alone and
  the whole budget.
- That is why PSB is used only **after** the ladder, for a plan that still bills a hit (HSB): there it cannot cost a
  hitless plan.

**The measure, OFF vs ON** (`measure/requests.md`, `sweep-32-10.md`, `fixtures.md`; raw JSONL beside them). "OAC" =
`OPP_AIM_CHASERS`, "PSB" = `PRESS_KILL_STRIKE_BOMBS`, "HSB" = `HIT_AVOID_STAND_BOMBS`; all4 = PKSW + PKRB + DSS (LHM is ON
at the base).

The requests (ticks, hits):

| request | OFF | OAC + HSB | all4 | all4 + OAC | all4 + PSB | **all4 + OAC + HSB** | PKSW+PKRB + OAC + HSB | PKSW + OAC + HSB |
|---|---|---|---|---|---|---|---|---|
| F1 32:10 (rm9) | refusal | refusal | 926 t, **1 h** chaser | refusal | 814 t, 0 h | **refusal** | refusal | 797 t, **1 h** `#9` |
| A1 32:10 | refusal | refusal | 651 t, 0 h | 651 t, 0 h | **refusal** | **651 t, 0 h** | 651 t, 0 h | 797 t, **1 h** `#9` |
| A1 32:12 | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | **1889 t, 0 h** | 1889 t, 0 h | 1889 t, 0 h |
| F1 32:12 (rm9) | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | 1889 t, 0 h | **1889 t, 0 h** | 1889 t, 0 h | 1889 t, 0 h |
| P1 32:10 −20 | 618 t, **2 h** | 618 t, **2 h** | 793 t, 0 h | 793 t, 0 h | 813 t, 0 h | **793 t, 0 h** | 793 t, 0 h | 618 t, **2 h** |
| P1 32:10 0 | refusal | refusal | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h | **722 t, 0 h** | 722 t, 0 h | 722 t, 0 h |
| P1 32:10 +7 | 741 t, **1 h** `#8` | 741 t, **1 h** `#8` | 719 t, **1 h** `#8` | 719 t, **1 h** `#8` | 582 t, 0 h | **779 t, 0 h** | 779 t, 0 h | 741 t, **1 h** `#8` |

- The switches alone (OAC + HSB with nothing else) move nothing: the same answers as OFF. Every hit they leave is OFF's
  own.
- PKSW alone keeps PKRB's `#9` and OFF's P1 hits: it is not a flip set with or without these switches.
- The full 17-variant table is `measure/requests.md`.

The 16-seam sweep of 32:10 (period 90; `off`/`all4` are STACK4's raw rows at the same configuration):

| seam (P1 = 82082; F1 = P1 − 97) | off (STACK4, LHM OFF) | all4 | all4 + OAC | all4 + PSB | **all4 + OAC + HSB** |
|---|---|---|---|---|---|
| P1-97 | REFUSED | 926 t, 1 h (chaser) | REFUSED | 814 t, 0 h | REFUSED |
| P1-90 | REFUSED | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h |
| P1-80 | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED |
| P1-70 | REFUSED | 649 t, 0 h | 649 t, 0 h | 531 t, 0 h | 649 t, 0 h |
| P1-60 | REFUSED | 651 t, 0 h | 651 t, 0 h | REFUSED | 651 t, 0 h |
| P1-50 | 727 t, 0 h | 853 t, 0 h | 853 t, 0 h | 853 t, 0 h | 853 t, 0 h |
| P1-40 | REFUSED | 613 t, 0 h | 613 t, 0 h | 613 t, 0 h | 613 t, 0 h |
| P1-30 | REFUSED | 651 t, 0 h | 651 t, 0 h | REFUSED | 651 t, 0 h |
| P1-20 | 618 t, 2 h (bomb:bomb#7 bomb:bomb#8) | 793 t, 0 h | 793 t, 0 h | 813 t, 0 h | 793 t, 0 h |
| P1-10 | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED |
| P1+0 | REFUSED | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h |
| P1+7 | 738 t, 1 h (bomb:bomb#8) | 719 t, 1 h (bomb:bomb#8) | 719 t, 1 h (bomb:bomb#8) | 582 t, 0 h | 779 t, 0 h |
| P1+10 | REFUSED | REFUSED | REFUSED | REFUSED | REFUSED |
| P1+20 | REFUSED | 649 t, 0 h | 649 t, 0 h | 531 t, 0 h | 649 t, 0 h |
| P1+30 | REFUSED | 651 t, 0 h | 651 t, 0 h | REFUSED | 651 t, 0 h |
| P1+40 | 727 t, 0 h | 853 t, 0 h | 853 t, 0 h | 853 t, 0 h | 853 t, 0 h |
| **hitless / with hits / refusals** | **2 / 2 / 12** | **11 / 2 / 3** | **11 / 1 / 4** | **10 / 0 / 6** | **12 / 0 / 4** |

The 18 L40 fixtures by key (OFF, OAC + HSB, all4, all4 + OAC, all4 + OAC + HSB; `measure/fixtures.md`):
- **all4 + OAC and all4 + OAC + HSB give all4's answer on all 18**, byte for byte:
  - leg 371 (`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`): **1678 t, 0 h**;
  - leg 376 (the same key, STACK4's seam-5271 capture): **1599 t, 0 h**.
- **OAC + HSB alone gives OFF's answer on all 18**, leg 376's own OFF hit included: `t1248 bomb#9`, a refuge bomb, which
  HSB's stand question does not cover.

The survey `--through=end` (`survey/`), read per step:
- OAC alone and OAC + PSB alone are identical to OFF on all 250 steps.
- all4 + OAC and all4 + OAC + HSB are identical to all4 on all 250 steps. Only step 149 moves from OFF (refused → 2128 t,
  0 h, as all4).
- The steps with hits are the same in every variant (24 L16 1 h, 202 L82 2 h, 220 L82 2 h), with 0 deaths. **No step gains
  a hit.**

## 4. Design + change, OFF identity

- **`OPP_AIM_CHASERS`** (`solverBot.js`): `oppAimClearOfChasers(run, policy, bodies)`, called once, at the press kill's
  OPP offer in the drive (`execKillByPressOnce`).
  - With no press owed (`policy.aimed === null`) and a chaser forecast in the room, it removes each in-reach body whose
    aim (`FACING_KEYS[facingToward(state, rect)]`, `oppStrikeLandsClear`'s key) fails `landsClearOfChasers`.
  - A withheld body is not struck this tick, and the walk key goes through `safeStep` (PKC) as usual.
  - Drive only: the strike and refuge previews already price their walked samples against the chaser forecast.
  - Instrument: `OPP_AIM_CHASERS_COUNTS {asked, withheld}`.
- **`PRESS_KILL_STRIKE_BOMBS`** (`solverBot.js`): `deriveStrike`'s `bombs` is
  `(PRESS_KILL_BOMBS.enabled || PRESS_KILL_STRIKE_BOMBS.enabled) && bombsInPlay(run)`. It asks the same `standBlastAt`
  over the same horizon, in both the bounded pass and the continuation.
- **`HIT_AVOID_STAND_BOMBS`** (`jsRuntimeSolver.js`): after the hit-avoid block of `solveAnytime`. When the plan in hand
  still bills a model hit, `standBombsPass` runs the first pass's search once under `withPressKillStrikeBombs(true)`:
  - It runs on the attempt's work clock to the attempt's budget, with no window.
  - A budget cut is the row's `cut`, never `limit`, so it never sends the shipped plan to a held retry.
  - Its plan is kept only if the model plays it hitless (`betterAnswer` then prefers it by verdict).
  - Already under PSB, it does not run (a `skipped` row).
  - Instrument: `HIT_AVOID_STAND_BOMBS_COUNTS {tried, replaced}`.
- **Threads:** all three are read in the page's **solve worker** (and in node); none is read on the main thread.
  - The env names are in `solverEnvChannel.SOLVER_ENV_NAMES`.
  - `with<Name>(enabled, fn)` wrappers: `withOppAimChasers`, `withPressKillStrikeBombs`, `withHitAvoidStandBombs`.
  - The page spec is `;`-separated, e.g.
    `SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1`.
- **No single-game constants:** no level id, coordinate or Seedling constant in the logic (pinned by a source row).
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - at the base: `391322d681b7aa0229d94b3f6906d024`;
  - at `ecd64826` (OAC + PSB): `391322d681b7aa0229d94b3f6906d024`;
  - at `eac45148` (+ HSB): `391322d681b7aa0229d94b3f6906d024`.
  - Every OFF solve measured here also reproduces its STACK4 answer: F1 32:10 `851256c5b984` with the code in place.
- **Regenerated:**
  - `census-seedling-solver-surface.mjs --write`: 375 rows, **GREEN** on `--check` (three counts moved: `state:y`, and
    `presses.js#distanceRectPoint` / `#SLASH_REACH` +1 each, all OAC's);
  - `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: no diff.
- **One pin in another slice's test moved:** `pkswHits.test.js` pins `deriveStrike`'s gate line, which now carries PSB's
  condition. Its intent (PKRB does not touch the strike's stand) is unchanged.

## 5. Rows + bounded vitest runs

- **`hammerChaserStand.test.js`** (default tier, 11 rows), for each switch:
  - ships OFF, and its env name is in the worker's table;
  - its wrapper restores the switch, also on a throw.
- Source rows:
  - OAC has one call site, guarded, using PKC's predicate, and no single-game constant;
  - OAC returns the offer unchanged when OFF, with a press owed, with no chaser forecast, or with no body in reach (a
    fake run, nothing asked);
  - PSB's gate is BW's own question, and `refugeAsksBombs` does not read it;
  - HSB is asked after the hit-avoid pass, only for a plan that still bills a hit. Its pass keeps only a hitless plan,
    never writes `limit`, and is skipped when PSB is already ON.
- **`hammerChaserStand.train.test.js`** (train tier, 6 rows; the first 5 took 186 s on a loaded box, all 6 took 214 s; cost row added to
  `scripts/test/train-shard-costs.json`). The witness is the committed `press-kill-start-wait/P1-32-10` fixture
  (`hammerPkswHitsRows.solveCapturedTotem64`) under all4.
  - **F1 32:10 (seam 81985):**
    - OFF: ships `t1799 chaser:bob@272,112`;
    - OAC: refuses by name, with aims withheld;
    - OAC + PSB: hitless on a fresh replay.
  - **P1 + 7 (82089):**
    - OFF and OAC: ship `t1644 bomb:bombpusher@112,128#8`;
    - PSB: hitless;
    - OAC + HSB: hitless, with passes `dashless, full, hit-avoid, stand-bombs`; the ladder's plans billed the bomb.
- **Bounded runs:**

  | files | tier | result |
  |---|---|---|
  | `hammerChaserStand.test.js`, `pkswHits.test.js`, `solverEnvChannel.test.js`, `hammerPressKillChasers.test.js` | default | 4 files, **28/28** (before HSB) |
  | `hammerChaserStand.test.js` (with HSB) | default | **11/11** |
  | `solverEnvChannel.test.js` | default | green |
  | `scripts/test/trainShardPlan.test.js` | default | **21/21** |
  | `hammerChaserStand.train.test.js` | train | **5/5**, then the HSB row **1/1**; at the final code, the whole file **6/6** (214 s) |
  | `hammerChaserStand.test.js`, `pkswHits.test.js`, `solverEnvChannel.test.js` | default | at the final code: **30/30** |

- **Not run:** no unfiltered vitest, no pytest, no `standing-values --write`. **A dispatched train-tier run at the tip is
  owed** (the slice touches solverBot's press kill and the anytime ladder).

## 6. Page play / game witness

**F1 32:10 on the game** (`game/`, `tools/reqwitness.mjs`): legwitness's play half, driving the whole key stream.
- **Method:**
  - the request is solved in node as the worker does;
  - the staged tape is the request's prefix (1449 keys, its two equips kept) plus the plan;
  - it is played on a fresh `seedling_bot_ap_p4g` page, headless logic-only, with the delivered AP set, under the box
    lock.
- **Results:**

  | variant | plan | game |
  |---|---|---|
  | all4 + OAC + PSB | 814 t, model 0 h | **finished 2263/2263, 0 hits**, end L40 (71.564…,152.896…), the model's end exactly |
  | control: all4, switches OFF | 926 t, model 1 h | finished 2375/2375, **1 hit**, the model's end exactly |

- So the billed chaser hit is real on the game, and the PSB plan's absence of it is too.
- The recommended set (OAC + HSB) refuses F1 32:10, so it has no plan to witness.
- A page `--solver-env` run was not made. The witness above plays the worker's own answer, and the solve is a pure
  function of the request (work units, no clock).

## 7. Census: which seed-1 divergence-sweep legs (by key) the change can move

- **The leg list at this head:** `seedling-divergence-legs.mjs --presets=seedling_playthrough` gives 915 legs, 50 on
  L40, the same list as STACK4's (`census/legs-reach.txt`).
- **`OPP_AIM_CHASERS`:**
  - It is asked only in a **press kill** (a spinner room: L18, L39, L40, L92 in the atlas), on a tick the OPP is offered an
    in-reach body, in a room with a **chaser forecast**.
  - Spinner rooms with a chaser: **L40** (12 bobs, 2 punchers, 1 bobsoldier) and **L92** (1 bob). That is 52 legs:
    the 50 L40 legs and
    - 698 `level_92__r4c2 <- in_L91_240_48 -> exit:out_teleporter_32_144`;
    - 699 `level_92__r7c17 <- in_L87_16_32 -> exit:out_teleporter_272_144`.
  - L18 and L39 hold no chaser, so they cannot reach it.
  - **Survey reach** (all4 + OAC + HSB, `survey/reach-all4oachsb.jsonl`): the OPP is asked on steps 66, 96 and 149 (L40)
    but **aims 0 times**, so OAC is asked 0 times and **no survey step can move**.
- **`HIT_AVOID_STAND_BOMBS` (and PSB through it):**
  - It runs on any `solveAnytime` answer whose plan still bills a hit, but it can change one only where the stand question
    reads something: a **lobber room**. That is **L40** (the BombPusher), its 50 legs.
  - Elsewhere the try repeats the first pass on less budget and is never kept. It costs work units after the ladder,
    nothing else.
  - ⚠ **The survey cannot witness it.** The survey solves in place, with no anytime ladder: `hsb.tried` is 0 on all 250
    steps, step 24's billed hit included. The page path (whole-game walk, divergence sweep) does reach it.
- **By key over the committed captures:**
  - Every request that moves is the whole-game entry-32 request, `level_40 … -> location:Level 040 - Totem Part 64,144`
    (re-measure-8/9's 32:10), at some arrival clock.
  - The 18 L40 fixtures: none moves under any variant of OAC/HSB (§3, *the measure*).
- **What a landing's sweeps must watch:** the 50 L40 legs (OAC and HSB) and legs 698/699 (OAC).

## 8. What the brief got wrong (measured)

- **"Price a press kill's strike approach/stand against chasers (F1 32:10: stands 4 ticks beside bob@272,112)":** the
  stand is priced, by PKC, and is clear.
  - `landsClearOfChasers` refuses the walk key at 1792–1796 and keeps the stand; the stand itself is `ok` each tick.
  - The hit is taken on the **next** tick's OPP aim, which skips `safeStep`.
  - Pricing the stand harder would change nothing; PKC § M2 also measured that a priced stand refuses almost everything.
- **"PKC covers the hammer and landing lines; which read misses this stand?":** the read that misses is
  `oppStrikeLandsClear`: the OPP's aim and press are offered on a spinners-only test.
- **"Give hit-avoid a try past the window on a billed hit":** measured. A try needs 123 units against an 85-unit window,
  and with the whole budget its plan still takes 1 hit (F1). It is not the fix.
- **"The bar: 0 seams with a hit under all4 + your switch":** not reachable by a chaser fix alone. Seam +7's hit is the
  strike-stand **bomb** (OFF's own, every variant).
  - The bar needed the stand half of BW too, and PSB everywhere loses hitless solves (§3).
  - Hence HSB: three switches where the brief named one.
- **"Base (all four OFF) refuses there":** confirmed, with LHM ON (`cd02c0916e6c`).
- **"F1 32:10 … if it now solves hitless":** under the recommended set it refuses. Hitless needs PSB everywhere
  (witnessed on the game, §6).

## 9. Residue / hand-overs

1. **F1 32:10's refusal under the recommended set** (solver; class (a) / (b) open):
   - The dashless pass refuses on the **latched hold** that follows the kill: `wandlock@176,208` at (167.1,136.4), inside
     `bombpusher@112,128`'s reach. MOVING_WAIT tried 256 pacings, none clean, and LHM is asked once and declines.
   - The full pass dies at t2058 (bomb #17) while pressing `spinner@192,160` from strike (312,88). That is a strike-stand
     bomb, which PSB prices (814 t, 0 h with PSB on).
   - **Candidate:** let HSB also run on a **refusal** in a lobber room, with the full pass under PSB. Measured cost: PSB's
     full pass alone solves F1 in 314 units, after OAC's 283, so 597 of 640. Unmeasured over the sweep and fixtures.
2. **PSB everywhere** (`PRESS_KILL_STRIKE_BOMBS` alone): hitless on F1 and +7, but it loses A1 32:10 (651 t, 0 h →
   refusal) and sweep seams −60/−30/+30.
   - Its stand question prices a stand the drive, re-deriving, never makes.
   - A sharper question (asked of the strike the drive actually stands at, or along the escape certificate after the
     press) is the model-side fix. Until then it ships only through HSB.
3. **HSB's budget margin:** at P1 + 7 the try ends at unit **631 of 640**. A request whose ladder spends more is cut and
   ships the plan in hand: a hit, exactly as today, never worse.
4. **The survey does not reach the anytime ladder** (§7), so it is no witness for HIT_AWARE / HIT_AVOID / HSB. A
   page-path sweep of the 50 L40 legs is the landing's evidence for HSB.
5. **Owed:**
   - a dispatched train-tier run at the tip (`unittests_frontend.yml -f train_only=true`);
   - the planner's L40 page sweep with `SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1` on top of all4;
   - a whole-game re-measure with the five-name `;` spec. Expect entry 32's 640 continue to **refuse** on F1's phase,
     rather than ship the chaser hit.
