# Seedling hammer-phase L40-CENSUS — every failing L40 leg's chain of walls, and the budget it needs (measure only)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-l40-census` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-05 ("Launch the census") |
| Start SHA | `2342e256049cf35d0cd864c699cf2aaa0b81b1af` (origin/main, "train: fidelity-harvest/r5retire eeb1f2b91d"). The brief's sweep was at `26ed405d3f`; leg ids are unchanged at this SHA (the brief's 869–872, 411, 394, 412, 395, 387, 388, 376 are the same keys) |
| Head | W0 `f7a1bd21`, W1 `e09bfa0e`, W2 `244cabc1`; this report is the last commit on the branch |
| Branch | `claude/seedling-l40-census-map-vkfsga` (the harness's designated branch) |
| Behaviour | **unchanged**: no solver, driver, model, generator or test file edited; no switch; no fixture. Instruments are scratch, under the evidence directory's `tools/` |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l40-census-evidence/` (its README names every file) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done (the Archipelago pip line failed, as in earlier slices; nothing here reads it); every submodule initialised (the wasm one too: the sweep drives `seedling_bot_ap_p4g`); node v22.23.4; 4 cores |

**Method.** W0 = the live page sweep (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1
--page=seedling_bot_ap_p4g --capture-requests`, :8000, main's defaults). W1 = every failing leg's captured request
replayed in node by `tools/chain.mjs`: `solveAnytime`'s pass loop and work clock, with the deadline lifted to a cap of
**40960 work units** (64× the page's 640; 16× its held retry). Each trace row is stamped with the work unit it landed at,
each unit with its solver frame. A SOLVED plan is replayed on a fresh run (30(c): rows, hits, deaths). The replay
reproduces the page: 388/1 at cap 2560 gives work 2562, `deadline: detour`, the captured answer's numbers. **The cap was
never the end of any chain except one exploratory arm** (870 ALL+OFA, which stopped at the cap's own unit 40961). Every
other run ended on a named refusal or a solve at 20–13186 units, so 40960 was enough.

## 2. The answer first — the map

**The one thing to know first: one room gates 8 of the 10 brief legs.** The SE fight is `spinner@880,848` pressed
while `bob@736,752` lives, plus `bobsoldier@880,832` in its notch.
- It blocks the two Chest legs directly. **Two existing OFF switches already pass it hitless:**
  `OPPORTUNISTIC_STRIKE` + `CHASER_STAGED_HUNT`.
- It sits under every route to the south door `wandlock@480,560` (flag 12), whose button room is behind the burnable
  tree in the same corner. That door is the real key to Boss Key 2.
- **With flag 12 banked, both BK2 legs SOLVE hitless under three existing OFF switches**: `LATCH_WEIGH_FIRST`,
  `TURRET_APPROACH`, `APPROACH_DOOR`. So the long BK2 chain is a symptom of solving the door, the burn and the fight
  inside the BK2 visit.

The other two walls are independent: the west pit corridor (387/388) and leg 376's flake.

Legend: **●** first wall at the defaults; **○** a later wall, met once the earlier ones are passed (measured);
**◇** inferred (the leg's own refusal names a body this wall holds); **·** not on that leg's chain.
Fix kinds: R = a rung/arm in the solver, O = order/route, B = budget, F = model fidelity.

| wall | 394 | 411 | 869 | 870 | 871 | 872 | 395 | 412 | 387 | 388 | 376 | answered by an OFF switch? | kind · size |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A1** SE press: `spinner@880,848` pressed with `bob@736,752` alive → death (t819/t822) | · | ● | ○ | ● | ○ | ○ | ◇ | ◇ | · | · | · | **yes, `OPPORTUNISTIC_STRIKE`** | R · none (exists) |
| **A2** SE `bobsoldier@880,832` in its notch → ladder EXHAUSTED | ● | ○ | ● | ○ | ○ | ○ | ◇ | ◇ | · | · | · | **yes, `CHASER_STAGED_HUNT`** | R · none (exists) |
| **A3** the staged hunt's cost: 80% of the solve; 411 needs 2630 > 2560 | ○ | ○ | ○ | ○ | ○ | ○ | · | · | · | · | · | no | B · small (cheaper ask) or a budget ruling |
| **B** the clear-tag arm "does not chain openers": the button room is shut by `burnabletree@872,784` | · | · | · | · | ● | ● | ◇ | ◇ | · | · | · | half: `STANCE_BURN` names the burn; the clear-tag arm refuses to run it | R · small–medium |
| **C** the clear-tag hold walk meets `bob@736,752` FIRST while `spinner@880,848` lives (every chaser stance refused by the spinner) | · | · | · | · | ○ | · | · | · | · | · | · | no (OPP/CSH/ALL identical) | R/O · medium |
| **D** BK2 in one visit: the walk back to the door after `hold(wandlock@480,560)` meets a live spinner; the chooser hands `bob@352,448`, the spinner's press arm is never asked | · | · | ○ | ○ | · | · | · | · | · | · | · | no (`CHOOSER_HIT_SOURCES` measured: no move) | R · medium — **avoidable by order (O)** |
| **E** BK2 in one visit: the strategy-order bound (6 orders; `FIFTH_ORDER` admits 5) | · | · | ○ | ○ | · | · | · | · | · | · | · | no | ruling · — **avoidable by order** |
| **F** flag 8: every key-line cell of `bosslock@480,352` is inside the live `iceturret@472,400`'s proximity hazard; the keylock arm has no prerequisite for it | · | · | · | · | · | · | ● | ● | · | · | · | no | R · medium (and needs the door, flag 12) |
| **G** west pit corridor: `bob@192,480` (+ cluster); no removal admits a corridor; detour spends 3480 units/pass for nothing | · | · | · | · | · | · | · | · | ● | ● | · | no (all 11 arms byte-identical) | R · medium |
| **H** leg 376: arrival-tick dependent — a planned spinner hit whose knockback the game does not follow (t1256), or a bomb at the goal | · | · | · | · | · | · | · | · | · | · | ● | no | F + R · small–medium, flaky |

**Budget verdict.** The page gives 640 work units, then 2560 on the held retry.

| leg | arm | needs | fits? |
|---|---|---|---|
| 394 | OPP+CSH | 2153 | yes, on the retry |
| 394 | CSH alone | 1862 | yes, on the retry |
| 411 | OPP+CSH | 2629 | **no, by 69 units** |
| 411 | all nine | 3023 | **no** |
| 869 | flag 12 banked, LTS | 3235 | **no** |
| 870 | flag 12 banked, LTS | 1020 | yes |
| 872 | tree banked, all nine | 2750 | **no** |

About 80% of the Chest legs' work (1695 of 2154 units on 394, 2200 of 2630 on 411) is the staged hunt asking
`deriveKillByChaser` once per still tick. A cheaper ask would put both Chest legs well inside the retry, likely inside 640.
**To hold every solve measured here as-is, the retry would have to be about 3300 units.** No measured leg is
budget-bound once its walls are answered, except by the margins above.

## 3. W0 — all 64 legs at main's defaults

The 64 are `seedling-divergence-legs.mjs`'s rows with `level === 40 || target_level === 40`: 48 legs inside L40 and
16 legs from an L40 door into L39/L41/L42/L43 (366, 413, 414, 416–440 even). Result: **53 done, 11 failed**
(`w0/sweep-l40.tsv`):

| id | key (abbrev.) | end | page text (head) |
|---|---|---|---|
| 376 | r0c53 ← L42 → Totem Part 64,144 | failed | the flake (§5.5): plan 1565 t (full pass), 1 hit at t1248, divergence at t1256, then a refusal on `spinner@192,160` |
| 387 / 388 | r23c29 ← L39 → `out_pit_13_21` / `_14_21` | failed | *"ran out of 640, then 2560 work units … at the `walk` site … reach-pit (23,28)/(24,28)->L43"* |
| 394 | ← L39 → Chest | failed | combat ladder EXHAUSTED, `bobsoldier@880,832` |
| 395 / 412 | ← L39 / L43 → flag 8 `bosslock@480,352` | failed | *"no REACHABLE stance on bosslock@480,352's key line — 0 cell(s) …"* |
| 411 | ← L43 → Chest | failed | `kill (spinner@880,848) by press: the player died at t819 (chaser bob@736,752)` |
| 869 | BK2 ← L39 | failed | `shove → hold(wandlock@448,432) → burn(burnabletree@872,784)`: EXHAUSTED on `bobsoldier@880,832` |
| 870 | BK2 ← L43 | failed | the same chain → press death at t822 to `bob@736,752` |
| 871 / 872 | flag 12 `wandlock@480,560` ← L39 / L43 | failed | *"no REACHABLE stance inside buttonroom@880,768"*, prerequisites refused |

The 53 done include every other L40 pit exit (both arrivals), the stairs and teleporters, Totem Part 160,640, the r0c53
legs from L41, and the 16 legs out of L40.

## 4. W1 — the chains, uncapped, and the what-if arms

### 4.1 The chain per failing leg at the defaults (`w1/chains-D0.txt`)

Each row is `u<work unit> <verb> <body> t<game tick>`. A refusal is answered by the dashless pass and then the full
pass; the full pass repeats the dashless chain. Only the dashless pass is shown here.

| leg | walls in order (unit: verb body @tick) | end (work) | where the work went |
|---|---|---|---|
| 387/388 | u1 brave `iceturret@472,400` t0 · u25 time/bait/kill `bob@192,480` t0 · u47 narrow · **u3527 detour** · forced-hit | REFUSED 3527/pass (7054), 57 s: EXHAUSTED `chaser:bob@192,480` at (216.5,504.6). avoid: different components with the 17 volumes forbidden; bait: *"NO LIVE BODY's removal admits a corridor"*; kill: no target (the chooser named none) | `deriveChaserDetour` 6960 of 7054 |
| 394 | u0 apitem · u16 kill `spinner@880,848` t0 · u53 time/bait `bobsoldier@880,832` t860 · u690 kill (chaser arm: 7 stances, all *"still standing after the whole ceiling"* or the APPROACH hit; orbit arm 20/20 forks hit by `bob@736,800`) · u699 detour (COVERED GOAL) | REFUSED 699/pass (1398), 18 s | `orbitKillChaser` 1080, `deriveKillByChaser` 180 |
| 395/412 | `deriveBlockRoute` 18 · `deriveKeylockStance` 2 | REFUSED 10/pass, 1 s: **0 candidate cells** | — |
| 411 | u0 apitem · press-kill `spinner@880,848` → death t819 (`bob@736,752`, PRESS_KILL_REBOOT_GUARD) | REFUSED 41/pass (82), 22 s | — |
| 869 | u183 shove `pushableblockfire@576,576` · u198 hold `wandlock@448,432` · u624 burn `burnabletree@872,784` · u640 kill `spinner@880,848` · u674–804 kill `bob@736,800` t865 · u822–1606 `bobsoldier@880,832` t1051 | REFUSED 1611/pass (3222), 47 s: EXHAUSTED `bobsoldier@880,832` | `orbitKillChaser` 1320, `deriveBlockRoute` 1232, `deriveKillByChaser` 494 |
| 870 | the same order to the burn, then the press → death t822 (`bob@736,752`) | REFUSED 665/pass (1330), 52 s | — |
| 871/872 | `deriveBlockRoute` 362, `deriveHoldStance` 2 | REFUSED 182/pass (364), 9 s | — |
| 376 /0, /1 | /0: dashless refuses at 106, full SOLVES 1565 t (1 hit, modelled). /1 (seam 6596, after the divergence): EXHAUSTED `spinner@192,160` | 400 / 178 | — |

**At the page's budget:** 869 is at the burn by unit 640 and at the BobSoldier by 2560. 387/388 are at the `narrow`
rung on `bob@192,480` at both budgets: the detour rung is what the deadline cuts.

### 4.2 The what-if arms (`w1/arms-table.txt.gz`)

Arms are each OFF switch alone (`STANCE_BURN` SB, `CHASER_STAGED_HUNT` CSH, `OPPORTUNISTIC_STRIKE` OPP,
`LATCH_WEIGH_FIRST` LWF, `TURRET_APPROACH` TA, `APPROACH_DOOR` SD, `FIFTH_ORDER` FO, `PRESS_ESCAPE_EXACT` PEE,
fidelity's `forecastShieldBump` FSB), ALL nine, ALL minus each one, ALL+`CHOOSER_HIT_SOURCES`, ALL+`orbitFreeAim`, and
OPP+CSH. Every SOLVED row was replayed fresh: **hits 0, deaths 0, rows modelled** on every solve below.

| leg | passes (alone) | moves to a later wall (alone) | ALL | minimal set measured |
|---|---|---|---|---|
| 394 | **CSH: SOLVED 1279 t** (1862 u) | OPP: same wall, more work | SOLVED 1266 t (2337 u) | CSH alone; OPP+CSH 1373 t (2153 u). ALL−CSH regresses to A2 |
| 411 | — | OPP → A2 (BobSoldier) | SOLVED 2246 t (3023 u) | **OPP+CSH: SOLVED 1763 t (2629 u)**. ALL−OPP → A1, ALL−CSH → A2 |
| 869 | — | LWF → A2 via weigh; CSH → the order bound on a REPEAT `hold(wandlock@448,432)` (LWEIGH's reason) | **D**: the walk back to the door, `spinner@880,848` at (803.5,855.9), 7951 u | ALL−SB: the button-room hold; ALL−SD: *"no approach to iceturret@472,400"*; ALL−TA / ALL−LWF / OPP+CSH: the bound on a repeat; ALL−OPP: A1 at t782 |
| 870 | — | OPP → A2 | **D**: `spinner@816,848` at (827.9,855.9), 13186 u (full pass **799 s**); ALL+OFA: **E**, the 5-order bound `[shove, weigh, burn, hold(wandlock@480,560), weigh(wandlock@800,400)]` at the cap | as 869 |
| 871/872 | — | **SB → B** (*"'hold''s stance is reachable only once burnabletree@872,784 is discharged … a clear-tag order does not chain openers"*) | B | ALL−SB back to the original refusal |
| 395/412 | — | — | F (byte-identical) | — |
| 387/388 | — | — | G (byte-identical on all 11 arms) | — |
| 376 | /0 SOLVED on every arm; /1 refused on every arm | — | /0 a different, dashless plan (1772 t, 1 hit) | — |

- **Regressions:** none against the defaults. Every arm either passes, moves a wall later, or leaves it unchanged.
- **Movers inside the stack:** PEE+FSB change positions and work. 411 drops from 3023 to 2629 units without them,
  869's wall moves to (843.2,855.7). They change no verdict here.
- **No-ops here:** `CHOOSER_HIT_SOURCES` changes nothing on 869/870. `orbitFreeAim` changes nothing except 870 (to E).

## 5. W2 — the map

### 5.1 Dependency: is "no REACHABLE stance" downstream of the SE fight or the BK2 chain?

Measured by staging L40 persistence rows on the captured requests (`--persist`, `w1/whatif-persist.txt`). The tags are
0 the tree burnt, 12 the south door cleared, 13 the chest opened, 16 `spinner@880,848` killed. ⚠ The page sweep stages
none of these: flags flow game → AP only. A leg at sphere 6.6 holds *"L40 flag 12 … cleared"* as an AP item, while its
game still has the door shut (395's staging persistence is `[]`).

**871/872 (flag 12) are downstream of the SE corner. Proven.**
- The button room `buttonroom@880,768` is shut by `burnabletree@872,784`; `STANCE_BURN` names exactly that.
- Staging tag 0 (tree burnt): **872 SOLVES under ALL** (1501 t, 2750 u, hitless).
- 871 (from L39's (488,904)) then meets wall C: the hold walk climbs the x 744 shaft, meets `bob@736,752` first, and
  every chaser stance is refused because `spinner@880,848` is alive. This is the order BK2COMBAT measured and rejected
  as "press-chasers-first".
- With tags 0+13+16, 871 at the defaults ends on the BobSoldier (A2). The bobs and the BobSoldier are not persistent:
  they are back on every visit.

**395/412 (flag 8) are NOT a reachability question.**
- `keylockCandidates` finds 0 cells, and every cell whose pinned box touches the key line `{x 482–491, y 369}` is a
  planner obstacle: `proximity-hazard` of the live `iceturret@472,400` (`w1/keyline-395.txt`: (488,328), (488,344),
  (488,376), (488,392)).
- Staging flag 12, or 0+12+13+16, changes nothing (digest `5ef26e7cad6c` throughout).
- The turret has no persistence tag, so it must die in the same visit. Its killer is LWEIGH's corpse weigh, which lives
  behind the south door (LWEIGH: the press stance (488,440) is behind `wandlock@480,560`).
- **So flag 8 depends on flag 12's door and a same-visit turret kill.** The keylock arm has no prerequisite arm for a
  hazard body (wall F).

**869/870 (BK2) are downstream of the door, not of the BK2 chain.** Staging tag 12 alone, each leg SOLVES hitless (verbs
shove, walk, weigh):

| leg | arm | ticks | work |
|---|---|---|---|
| 869 | LWF+TA+SD | 4491 | 3235 (dashless) |
| 870 | LWF+TA+SD | 4519 | 1020 (dashless) |
| 869 | ALL nine | 4491 | 3235 |
| 870 | ALL nine | 4519 | 1020 |

With 0+13+16 but the door shut, 869 under ALL still ends on `bob@736,752` at the door's hold walk.

**The Chests (394/411) ARE the SE fight**, and nothing beyond it. Pass the fight and they solve.

| group | first shared wall |
|---|---|
| 394, 411 | A (the SE fight) |
| 871, 872 | B (the tree), then A (and C for 871) |
| 869, 870 | the door (= 871/872's goal), else A → D → E in one visit |
| 395, 412 | F, which needs the door (= 871/872's goal) |
| 387, 388 | G (independent, west corridor) |
| 376 | H (independent, north-west, flaky) |

### 5.2 Budget: the work and wall time to each chain's end

| leg | arm | ends | work (page: 640, then 2560) | node wall time |
|---|---|---|---|---|
| 394 | CSH / OPP+CSH | SOLVED | 1862 / 2153 → **fits the retry** | 8 / 16 s |
| 411 | OPP+CSH / ALL | SOLVED | 2629 / 3023 → **over by 69 / 463** | 40 s |
| 872 | ALL + tree banked | SOLVED | 2750 → over | 82 s |
| 869 | LTS + door banked | SOLVED | 3235 → over | 41–47 s |
| 870 | LTS + door banked | SOLVED | 1020 → fits | 18–22 s |
| 869 | ALL, one visit | REFUSED (D) | 3815 dashless + 4136 full | 107 s |
| 870 | ALL, one visit | REFUSED (D) | 8995 + 4191 | **864 s** (the full pass alone 799 s: past the page's 300 s backstop) |
| 871 | any arm + tree banked | REFUSED (C) | 3618/pass | **171 s** dashless |
| 387/388 | any arm | REFUSED (G) | 3527/pass | 51–57 s |

Where the extra work goes:
- **The staged hunt** (A3): 1695 of 2154 units on 394 and 2200 of 2630 on 411 are `stagedChaserHunt>deriveKillByChaser`,
  one ask per still tick (`w1/staged-hunt-cost.txt`). Without it the Chest legs would be roughly 450–550 units.
- **The detour rung**: about 3480 units per pass on 387, 388 and 871 for *"0 candidate corridor(s) previewed … 3479
  leg(s) of the 500 planned"*.

**Which legs are budget-bound once every wall is answered:**
- 411 by 69 units (OPP+CSH).
- 869 by 675 (with the door banked).
- 872 by 190 (tree banked; then wall B's code).

**What the budget would have to be:** about **3300 units** on the held retry for every solve measured. A cheaper staged
ask would instead bring the Chests under 2560 without touching the budget.

**Wall time** is the second limit:
- The single-visit BK2 attempts (107–864 s) are past the page's leg budget (90 s) and, for 870, the 300 s backstop.
- 871's refused hold walk takes 171 s per pass.

### 5.3 The wall list

| wall | legs blocked (first / later) | OFF switch answers? | fix kind | rough size |
|---|---|---|---|---|
| A1 SE press with `bob@736,752` alive | 411, 870 / 869, 871, 872 | **yes: OPP** | — | flip question only |
| A2 BobSoldier in its notch | 394, 869 / 411, 870, 871, 872 | **yes: CSH** | — | flip question only |
| A3 staged hunt cost | 411 (−69), 869/872 indirectly | no | B: one ask per still tick → sparser (e.g. only cells beside the body, or every k ticks) | small |
| B clear-tag arm does not chain openers | 871, 872 | half (SB names the burn) | R: let the clear-tag hold run its stance prerequisite (the order `prerequisiteOrder` already builds for `apitem`) | small–medium |
| C hold walk meets the shaft bob before the spinner | 871 | no | R/O: a fight order for the SE corner (press the spinner first, as the Chest path does), or route the hold walk through the corridor the Chest path uses | medium |
| D BK2's walk back past a live spinner (chooser picks `bob@352,448`) | 869, 870 (one visit) | no (CHS no move) | R: the chooser hands the spinner its press arm on a walk | medium — avoidable by order |
| E the order bound (6 distinct orders) | 869, 870 (one visit) | no (FO admits 5) | ruling | — — avoidable by order |
| F turret hazard on the key line | 395, 412 | no | R: a keylock stance prerequisite (raise the turret's corpse weigh/kill), in the door-open region | medium |
| G west pit corridor, bob cluster at the arrival | 387, 388 | no | R: the chooser/kill rung offers no target, the detour finds no corridor | medium |
| H 376 seam flake | 376 | no | F (hit knockback vs the game at t1256) + R (bomb at the goal) | small–medium |

### 5.4 Is there a shorter road?

**Yes, for BK2 and flag 8: open the south door first.**
- With flag 12 banked, BK2 solves under three existing OFF switches. Walls D and E disappear: the solver no longer has to
  burn, fight, hold and walk back inside one visit.
- The AP route places flag 12 and BK2 in the same sphere (5.3). A real player clears flag 12 (or the Chest) before BK2
  on the same save. The sweep's page-legs=1 harness never carries a game flag between legs.

**Does the solver's search already try it?**
- Within a single BK2 solve, partly. With SD+TA on, the approach door's discharge does order `hold(wandlock@480,560)`
  before the weigh (869 ALL: the hold at t2185). It then fails on the walk back (D), or on the order count (E).
- Across goals, no. Each leg is one goal, and the solver does not plan a multi-goal visit (Chest → flag 12 → BK2).

**No route skips the SE fight.**
- From both arrivals ((488,904) and (328,600)), the button room is behind the tree in the fight's corner.
- Every BK2 or flag-8 route needs the south door.
- The fight's persistent parts (tree, chest, `spinner@880,848`) bank once. The two bobs and the BobSoldier are
  re-fought on every visit.

### 5.5 The 376 flake

**Seam (arrival-tick) dependent, not a budget.** Five page runs at the head (`w1/leg376.txt`); two passed:

| seam | outcome |
|---|---|
| 5319 | passed: dashless plan, 1736 t, hitless |
| 5327 | passed: dashless plan, 1888 t, hitless |
| 5313 | failed (W0's run): dashless refused; the full pass shipped 1565 t with one planned hit from `spinner@192,160` at t1247, the game left the plan at t1256 (dx 3.08 px, the knockback row), and the recovery re-plan refused on the same spinner |
| 5314 | failed: the same as 5313 |
| 5333 | failed: both 640 and 2560 tripped (`crusher-fork`); uncapped it refuses by name at 8450 units on `bombpusher@112,128`'s explosion at the goal, the forced-hit rung spending ~2600 units |

So the arrival clock picks the spinners' and the bomb's phase. Two of five phases need a planned hit, whose knockback
the game does not follow, and one phase needs a bomb answer the ladder does not have. The budget is not what fails it:
even the uncapped run at seam 5333 refuses by name.

## 6. A recommended plan (ordered)

1. **A design/budget question for the user first: carry the door.** Should a BK2 or flag-8 arrival be measured from a
   save where flag 12 is already cleared (the route's own order; a harness staging like the arrival events), or must
   each arrival solve the door in-visit?
   - If carried: **+2 legs from existing switches** (LTS flip). 870 at 1020 units fits; 869 at 3235 needs A3's cut or a
     budget of about 3300.
   - If not carried: D and E stand (two more slices plus a ruling) before BK2 moves at all.
2. **Slice STAGED-HUNT-CHEAP (A3, small).** Make `stagedChaserHunt`'s per-still-tick ask cheaper. Then a flip
   decision on OPP+CSH.
   - Unlocks **394 and 411** (+2; 394 already fits the retry with CSH alone).
   - Lowers every later SE chain's bill (872, 869).
   - The flip carries the pins BK2COMBAT §7 listed.
3. **Slice CLEARTAG-CHAIN (B).** The clear-tag hold runs its stance prerequisite (the burn).
   - Unlocks **872** (measured with the tree banked: SOLVED under ALL, 2750 units, so it needs step 2's cut to fit).
   - Takes 871 to wall C.
4. **Slice SE-FIGHT-ORDER (C).** For 871's x 744 shaft approach, kill the spinner before the bob (or route the hold
   walk the Chest path's way). Unlocks **871**.
5. **Slice KEYLOCK-TURRET (F),** after 1 and 3. Raise the turret kill as a keylock stance prerequisite in the
   door-open region. Unlocks **395, 412**. Each needs the door (1 or 3) and the turret in the same visit.
6. **Slice PIT-WEST (G),** independent. The chooser or kill rung for the bob cluster at the L39 arrival, plus a bound
   on the detour rung's 3480-unit no-answer. Unlocks **387, 388**.
7. **376 (H):** hand the t1256 knockback divergence to fidelity (one planned hit's knockback against the game). The
   bomb phase is a rung question. Low priority: it passes on 2 of 5 arrival ticks.

**Leg count if every step lands:** 10 + 376 → up to 11. **The first two steps alone (a ruling and one small slice) are
worth 4 legs.**

## 7. What the brief got wrong (measured)

- *"387, 388: the anytime deadline (640, then 2560) at `walk`"*: true on the page, but they are **not budget-bound**.
  Uncapped, both refuse by name at 3527 units per pass: combat ladder EXHAUSTED on `bob@192,480`, the detour rung
  spending 3480 units for no candidate.
- *"`L40 flag 8: bosslock@480,352`: 412, 395: no REACHABLE stance on the key line"*: the text is right, but the cause
  is not reachability. **0 candidate cells exist**: every key-line cell is the live ice turret's proximity hazard.
  Staging flag 12 does not move it.
- *"411 … died at t816"*: t819 on this head (page and node). *"870: ladder exhausted / refusal"*: at the defaults 870
  is the press death at t822 (A1), not the ladder.
- *"376 ≈ 50%"*: 2 of 5 here, with two distinct failure modes (§5.5). Neither is the deadline alone.
- *"64 L40 legs"*: 48 inside L40 plus 16 out of an L40 door into L39/L41/L42/L43, by the leg list's `level` and
  `target_level`.
- The brief's main was `26ed405d3f`. This census ran at `2342e256` and the ids are unchanged.

## 8. Residue

- **Not measured:**
  - The radius of any flip outside L40.
  - The single-visit BK2 chain past wall E (only 870 ALL+OFA reached it, at the cap).
  - The turret-dead what-if for flag 8: the turret has no persistence tag to stage, so F's claim rests on the geometry
    probe plus LWEIGH's region finding.
  - Whether 871's wall C changes once B is built: it is measured only with the tree pre-banked.
- **In flight elsewhere, not duplicated:**
  - VOLLEY-APPROACH (860's LWEIGH volley): no L40 brief leg here met a turret volley.
  - L95-PUNCHER, OPP-FREEZE, KEYGATE-YIELD: not on these chains.
- **Tooling:**
  - `tools/chain.mjs` wraps `Array.prototype.push` in its own process to stamp trace rows with the work unit. It is
    measurement-only and never loaded by the app.
  - The frame attribution (one stack capture per unit) slows a solve about 4× and is off (`--frames=0`) for the arms.
  - Commits used `BOX_LOCK_COMMIT_ANYWAY=1` while this session's own sweep held the box lock.
- **Not committed:** the captured requests (37 MB) and the full chain rows. The README names the re-capture command.
