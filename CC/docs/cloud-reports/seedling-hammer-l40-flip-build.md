# Seedling hammer-phase L40-FLIP-BUILD — the L40 flip branch, and `OPP_PRESS_FALLBACK`

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-l40-flip-build` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ the user ruled the flip on 2026-11-08 (*"Yes, build the flip next (Recommended)"*) |
| Start SHA | `32d9c6468bd8922090a8e57f2cee9b3cae8a48c0` (`origin/hammer-harvest-drill-killlock`: main `4c3b425f90` + 376-BOMB + DRILL-EXIT-PASS + L53-KILLLOCK, all OFF), as the brief's **Base** names. `origin/fidelity-flip/knockback376` was NOT merged (no measurement here needed `rockGoneFencepost`) |
| Head | this report is the last commit on the branch. Steps: W0 `e8e4cc3f` + `7265d464`, M `d14b8437`, I `810a035a`, D `4336720f` + `1b965b61` (and this report) |
| Branch | `claude/seedling-l40-flip-build-s1yk22` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-l40-flip-build-evidence/` (`w0/`, `m/`, `tools/`; the captured requests, ~1.6 MB a page arm, are not committed: the commands are in `tools/queue.sh`) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done; every submodule initialised (the wasm one too); node v22.23.4; **4 cores**, the p4g page on :8000 (`serve-nocache.py`). ⚠ The box was loaded (load average 5–12) while page arms, node sweeps and the vitest tiers ran together: the local page's 90 s harness leg clock is tighter here than on a CI shard |

**Method.** Page arms = `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
--capture-requests`, with `--solver-env` for the arm and the DOOR-CARRY leg list (`--carry-route-flags`) where named. Node
= the page's own `solveAnytime` on its captured requests (`replay-seedling-solve-request.mjs`, page-faithful budgets
640/2560), and `--seam-time-sweep` for the arrival clock (`staging.seam.time` only moves). A solved plan is re-driven on a
fresh run (30(c)) where a row claims hitless.

## 2. The answer first

**The one thing to know first: the page-vs-node gap is three different things, and only one of them is the solver's.**
394/871 are a MODEL gap (the game diverges at t936 on a sword strike the model lands); 411/870/871/872 are the HARNESS's
90 s leg clock cutting a plan that solved and is playing clean; 376/377 are the arrival clock exposing an
`OPPORTUNISTIC_STRIKE` regression. The slices' node witnesses ran the DASHLESS pass uncapped; the page runs both passes
and keeps the full pass's shorter sword-dash plan, which is the plan that diverges on 394/871.

| question | answer (measured) |
|---|---|
| 394 / 871 ON: page vs node? | **A model difference → fidelity.** The page solves (`bait, kill` 1226 t), plays it, and the game diverges at **t936**: in the model the full pass's swing at t925 lands `bob@736,752`'s third hit at **t930**, on the tick its i-frames lapse (hitsTimer 1 → 30, dying), and the player walks through the dying bob; in the game the bob lives and hits the player at t936 (745.86,786.57). Byte-identical on 394 and 871 (same arrival). It is the staged hunt's plan (CSH+memo alone, and every wave-6 subset, return the same 1226-t plan). Which plan is picked is a function of the arrival clock (CI's 871 at 5217 played clean; CI's 394 at 5216 diverged at t1028 instead) |
| 411 ON: page vs node? | **The harness's 90 s leg clock.** Solved in 38.8 s (`bait, kill`, 1684 t), the game playing it clean at t754 when the leg budget ended. Same on 872 (solved 32.9 s, cut at t973/1098), 870 and 871 with the door carried. Not the solver's budget, not the model |
| 376/377 ON regression: which switch? | **`OPPORTUNISTIC_STRIKE`.** 377 over 21 arrival clocks: defaults 20/21, wave 6 14/21 (loses 5319–5324), wave 6 − OPP 8/8 on the lost range, OPP alone loses the same six. 376 over 25: defaults 17/25, wave 6 10/25, wave 6 − OPP **19/25** |
| The fix | **`OPP_PRESS_FALLBACK`** (new, ON in this branch): OPP's press kill that refuses with a `FIGHT_FALLBACK_CODES` code is rewound to its first tick and redone once with OPP off. 377: **14/21 → 19/21** (5320–5324 back, each the defaults' plan digest `63901cbdc728`; 5319 stays: OPP is asked there inside the stance derivation's prerequisite trial, which has no rewind). 376 under the full set: §4.2 |
| 376's bomb phase vs the ON regression | Separate. The defaults' own refusals (5321–22, 5333–38) are 376-BOMB's phases; the ON regression is OPP's (5319, 5325–32), a bomb-pusher blast met on the hold-stance walk OPP's strikes re-timed |
| BK2 869 over budget by 676 | **Not fitted here; measured why.** 2,484 of 869's 3,236 units (77 %) are `approachKillForCorpse`'s certified forks: the hitless try is the **276th** (side `right`, the corridor, wait 29). No exact cut exists inside the search (each try is a model run of a different key set); a reorder or a narrower wait range changes WHICH hitless try is chosen, so it is a preference change (its own switch, its own radius) or a budget ruling (§4.3) |
| The flip set | twelve switches ON (§5): `STAGED_HUNT_SCAN_MEMO`, `CHASER_STAGED_HUNT`, `OPPORTUNISTIC_STRIKE`, `CLEARTAG_CHAIN`, `STANCE_BURN`, `CHOOSER_CUT`, `DETOUR_VIA_BOUND`, `KEYLOCK_TURRET`, `LATCH_WEIGH_FIRST`, `TURRET_APPROACH`, `APPROACH_DOOR`, `BOMB_PHASE_WAIT`; plus the new `OPP_PRESS_FALLBACK`. `HAMMER_FIGHT_FALLBACK` untouched (⚖) |
| L40 on the page with the set, door carried | **done:** Chest 394, Chest 411, flag 8 395 and 412, Totem 376, flag 1 377. **budget:** BK2 869 (640 then 2560 tripped). **harness clock:** 870, 871, 872 (solved, cut mid-play) |
| Wave 5 | none merged. L95-PUNCHER's "CSH needs `CLEARTAG_STAND` on L12": measured on the page, §5.4 |

**Before → after (the page, L40 brief legs).** Defaults (arm B): 394, 411, 871, 872 refuse; 376 done; 377 diverged
(t1256, census wall H). The set with the door carried (arm C): 394, 411, 395, 412, 376, 377 done; 869 budget; 870, 871,
872 solved and cut by the harness clock.

## 3. W0 — every L40 brief leg, page and node

`w0/w0-table.txt` holds every row below, with its arrival clock (`seamTime`) and its history.

| leg | A: wave 6 ON, no carry (local) | CI 42145740415 wave 6 ON (1 of 3) | B: defaults, no carry | C: set + LTS + BPW, door carried |
|---|---|---|---|---|
| 376 Totem 64,144 | refused (bomb #13 on the hold walk) | refused (bomb) | **done** | **done** (`hold, walk`) |
| 377 flag 1 | **done** (5325) | refused (5323, spinner press "no step out") | diverged t1256 → cut | **done** |
| 394 Chest ← L39 | **solved → diverged t936** | solved → diverged t1028 | refused (A2) | **done** (`bait, kill`) |
| 411 Chest ← L43 | solved 38.8 s → **cut at t754** | timeout | refused (A1, death t792) | **done** |
| 395 flag 8 ← L39 | refused (KT: the door shut) | refused | — | **done** (`keylock, walk`) |
| 412 flag 8 ← L43 | refused (KT: the door shut) | refused | — | **done** |
| 869 BK2 ← L39 | refused (one visit: order bound) | refused | — | **budget** (640, 2560) |
| 870 BK2 ← L43 | refused (one visit) | refused | — | solved → **cut** (`shove, walk, weigh`) |
| 871 flag 12 ← L39 | **solved → diverged t936** | done (5217) | refused (wall B) | solved → **cut** |
| 872 flag 12 ← L43 | solved 32.9 s → **cut at t973** | refused (5223) | refused (wall B) | solved → **cut** |

### 3.1 394 / 871: the divergence, measured (`m/arms394.txt`, `tools/near.mjs`, `tools/bobtrack.sh`)

- Node reproduces the page's plan exactly (1226 t, 1525 work units, the full pass at `sword-dash`).
- In the model, `bob@736,752`'s hits: 1 at t867, 2 at t900, **3 at t930** (the swing pressed at t925, its hit tests
  T+1…T+`SLASH_HIT_TICKS`; `hitsTimer` lapses 1 → 0 between t929 and t930; fidelity's `strikeIframeLapse`, ON since
  2026-10-14). Dying from t930; the player walks down the x 744.38 shaft through it (d 4.1 at t940), no hit.
- On the game the player rows equal the model's through t935, and at t936 the game has a hit (`hits_timer` 19) at
  (745.86,786.57). The bob was not killed at t930 in the game.
- The DASHLESS plan (1373 t) kills the same bob up top (t881/911/941, at (757,680)): a different strike, untested on
  the game here. With `SEEDLING_STRIKE_IFRAME_LAPSE=0` (measurement only) the full pass refuses and the dashless
  1393-t plan wins (`m/394-lapse0.txt`).
- Every arm I tried returns the same plan: CSH+memo, OPP+CSH+memo, ±CUT, ±DVB, ±CC+SB, ±KT (`m/arms394.txt`).
- ⛔ This is a model question (the swing's last test tick against the lapse, or the bob's state the game holds): STOP for
  this part, hand-over §9.

### 3.2 411 / 872 / 870 / 871: the harness clock

Each solved (39 s, 33 s, the held retry) and was cut while the game played the plan, with no divergence. On CI's 2-CPU
shard the solve is slower and 411 timed out with no plan reported. The sweep for the flip should run the L40 legs with
`leg_budget_ms: 180000` (§7).

## 4. M — the regression and the budget

### 4.1 377: the bisect (node, the page's captured request, 21 arrival clocks; `m/seam-*-377-0.*`)

| arm | solved | refused at |
|---|---|---|
| defaults | 20/21 | 5333 |
| wave 6 ON | 14/21 | 5319–5324, 5333 |
| wave 6 − `CLEARTAG_CHAIN` (5319–26) | 2/8 | 5319–5324 |
| `CLEARTAG_CHAIN` alone (5319–26) | 8/8 | — |
| `OPPORTUNISTIC_STRIKE` alone (5319–26) | 2/8 | 5319–5324 |
| wave 6 − `OPPORTUNISTIC_STRIKE` (5319–26) | 8/8 | — |
| **wave 6 + `OPP_PRESS_FALLBACK`** | **19/21** | 5319, 5333 |

The refusal ON is `clear-tag {40,1} wandlock@176,80 -> hold stance -> break stance (breakablerock@176,128) -> kill
(spinner@192,160) by press: every key set … There is no step out.` The `hold stance -> break stance` is the stance rocks
prerequisite (ON at the defaults), not CLEARTAG_CHAIN's loop. OPP's policy steers the press kill's own ticks into a corner
the plain kill never walks into.

**The design.** A rewind-and-redo of one kill, B3's shape (`execKillByPress`'s `HAMMER_FIGHT_FALLBACK` path), keyed
on OPP: `execKillByPressOppFallback` wraps the existing body (renamed `execKillByPressFightFallback`, unchanged); a
`FIGHT_FALLBACK_CODES` refusal with OPP on and a rewind is rewound to t0, the admission asked again on the rewound run
(`PRESS_ADMISSIONS`), and the kill redone with `OPPORTUNISTIC_STRIKE.enabled = false` (restored in `finally`). Adopted if it
kills (a `PendingDeclaration` from the kill's lock tail counts), else undone and the original refusal thrown plus one
sentence. Lines touched in `solverBot.js`: one import (L203) and `execKillByPress` → three functions (around L19424).

| alternative | why not |
|---|---|
| drop OPP from the set | 411's SE press (census A1) needs it: with OPP off the Chest from L43 dies at t792 (arm B) |
| re-solve the whole segment without OPP | loses OPP everywhere in the segment, not only in the refused kill |
| fix OPP's policy inside the press kill | a change to what OPP prefers wherever it acts; the fallback changes only refused kills |

### 4.2 376 (25 clocks; `m/seam-*-376-0.*`)

| arm | solved | refused at |
|---|---|---|
| defaults | 17/25 | 5321–5322, 5333–5338 |
| wave 6 ON | 10/25 | 5319, 5325–5338 |
| wave 6 − OPP | 19/25 | 5333–5338 |
| the full set (12 + OPF) | FILLED-AT-END | |

### 4.3 BK2 869 (door carried) — 3,236 units against 2,560

Profiled with L40-CENSUS's `chain.mjs` on arm C's captured request (`m/prof869.*`): `crusher-fork` 2,484, `block-route`
472, `walk` 278. By frame: `approachKillForCorpse` 2,493 (the turret approach's forks), `deriveBlockRoute` 472. The
approach's winning try (`TURRET_APPROACH_COUNTS`): `{side: 'right', via: null, wait: 29, forks: 276}`. The search order is
sides (push side first, then nearest) × routes (corridor, then two vias) × waits 0…48; every try is a fork run of the
model to the turret's death or the first hit.

- **No exact cut.** Every try runs different keys, so no memo of an earlier try answers a later one (unlike
  STAGED-HUNT-CHEAP's leash scan); the existing exact prunes (`no-plan`, `approach-body`) already end routes early.
- **What would fit, and what it costs.** (a) Waits searched from the window the census measured (29–31) outward, or the
  right side first: the 276th try becomes the 1st–30th, but on a room where an earlier try also solves, the chosen
  plan changes: a preference change, its own switch and radius. (b) A budget ruling: the held retry at ≥ 3,300 units
  holds every L40 solve measured (L40-CENSUS's number, unchanged here). Not built: the brief scopes new code to what the
  flip needs, and BK2 870 (from L43) solves inside the budget.

## 5. I — the flip

### 5.1 The switches

Each `enabled` now reads `SEEDLING_<NAME> !== '0'`, each `<NAME>_DEFAULT` is `true`, each declaration carries one line
naming the flip. `l40FlipSet.js` names the twelve once (`L40_FLIP_SWITCHES`, `withL40Flip(enabled, fn)`); nothing in the
solver reads it. `OPP_PRESS_FALLBACK` (`oppPressFallback.js`) ships ON in this branch (`=0` opts out); it is inert while
OPP is off. `SOLVER_ENV_NAMES` gains `SEEDLING_OPP_PRESS_FALLBACK`.

### 5.2 Pins re-recorded (for the planner to sign)

**Default rows** (OFF → ON, by construction): `hammerStagedHuntScanMemo`, `hammerBk2Combat`, `hammerOpportunisticStrike`,
`hammerClearTagChain`, `hammerPocketBurn`, `hammerPitWest` (×2), `hammerKeylockTurret`, `hammerLatchWeigh`,
`hammerTurretApproach`, `hammerSouthDoor`, `hammerBombPhase` (`.test.js`): each `_DEFAULT` false → true and each
`.enabled` against `!== '0'`.

**Moved behaviour pins** — each passes with the flip set forced OFF (`SEEDLING_*=0` for all twelve: 7 files, 53/53) and
is re-recorded as a BEFORE pin, its solve under `withL40Flip(false, …)` (the AFTER is what the flip does there):

| file › row | BEFORE (kept) | AFTER (flip ON) | why it moves | class |
|---|---|---|---|---|
| `hammerClearTagChain` › ON (`STANCE_BURN` ON): the burn runs first, the refusal moves to wall A1 | 872 dashless refuses (death t799) | **solves** | OPP + CSH pass the SE fight the burn walk meets | gain |
| `hammerFightFallback` › a retry that does not solve is UNDONE | refusal = OFF's + one fight sentence | the message gains `OPP_PRESS_FALLBACK`'s sentence too (OPP on, the kill refuses twice) | the new fallback composes after B3's (HFF is only ever ON in this test) | composition, expected |
| `hammerKeylockTurret` › 412 with the door shut: refuses at APPROACH's staging point | `-> keylock -> kill (iceturret@472,400): no approach … 12 fork(s) {"no-plan":12}` | `no REACHABLE stance inside buttonroom@880,768 … from (487.75,578)` (the prerequisites tried) | `APPROACH_DOOR`/`LATCH_WEIGH_FIRST` try to open the south door first and meet the latch's button room | refusal text moves; still refused (no door in the save) |
| `hammerPressKillChasers` › step 67: OFF dies to bob@736,752 | death t780 | the refusal moves to the BobSoldier notch (A2) | OPP's strikes keep the player alive past the bob | later wall |
| `hammerPressKillGuards` › HO2 OFF: carries on past the death at t788 | death t788, sentinel at t1300 | no death at t788 (t1225, no sentinel) | OPP avoids the death | gain |
| `hammerPressKillGuards` › HO2 ON: refused on the first death | refused t788 | t1225 | the same | gain |
| `hammerRefugeBandText` › 371 at 5266 (PKB OFF) | `[false, 92]` | `[false, 96]` | +4 work units; same verdict and words | work only |
| `hammerRefugeBandText` › 371 at 5265 (defaults) | `[false, 92]` | `[false, 96]` | the same | work only |
| `hammerStrikeEtaFloor` › ON: the executed prefix IS the witness | 1629 ticks (the witness's keys) | 1732 ticks | the flip's strikes change the executed prefix | witness stays the BEFORE |

**Fidelity rows that move — for FIDELITY to sign (not edited here: `fidelity*.test.js` and fidelity's L30KEYLOCK
producer are fidelity's files).** CI's default tier on the flip head (JSUT 42522164775, shards complete, `1b965b61`):
**13 failed of 25,966**, all of them below; every `hammer*` file green. The producer battery: 4 checks red, all
`plan-seedling-l30keylock`. Each is a row recorded at the pre-flip defaults:

| file › row | BEFORE (the pin) | AFTER (flip ON, measured) | class |
|---|---|---|---|
| `fidelityL30KeyLock` › both OFF, (224,80): the survey's refusal, the BEFORE witness hit twice | refused (null) | **solved, 318 t** | gain (L95-PUNCHER's "a BEFORE witness that now solves") |
| `fidelityL30KeyLock` › WAIT alone: nothing is hit | solved 309 t | solved **318 t**, 0 hits | plan moves |
| `plan-seedling-l30keylock --check` (4 checks: the staging REFUSES; the committed `l30keylock-pit224-before` replays 2 hits; the fixture DRIFT; REFUSED and hit) | refusal + a 2-hit witness | it solves, 0 hits; the fixture would drift | gain; the producer's BEFORE arm needs the set OFF |
| `fidelityL40Bk2` › D1 ON: the chain ends in the hammer arc's press kill (death t780) | `… -> chest stance -> kill (spinner@880,848) by press: died t780` | `no REACHABLE stance inside buttonroom@880,768 … from (488,578)` | the door-shut solve stops earlier (the flip's door order) |
| `fidelityL40Bk2` › D2 leg 368 OFF, seam 5290: the 1600 t plan | `[true, 1600, 1da60bcb4c0d]` | `[true, 1713, ba143e9b21a0]` | plan moves (solved) |
| `fidelityL40Bk2` › D2 leg 368 ON, seam 5290: not certified | refused | **solved** | gain |
| `fidelityL40Bk2` › D2 leg 368 ON, seam 5280: OFF's 1558 t plan | `[true, 1558, 32f29414cd8e, []]` | `[true, 1713, ba143e9b21a0, []]` | plan moves (hitless) |
| `fidelityL40Bk2b` › W0 OFF: the orbit arm finds no hitless candidate | `orbit arm: no orbit kill … (20 fork(s) of 20)` | `the re-planned corridor failed too … proximity-hazard — chest` | refusal text moves |
| `fidelityL40Bk2b` › D1 ON: the orbit kill's ticks are the tape's | 125 | 112 | plan moves |
| `fidelityL40Latch` › W0 OFF: moved at hold tick 93 | `hold tick 93 of 131 MOVED` | the collect stance's ladder EXHAUSTED (`bobsoldier@880,832`) | refusal moves |
| `fidelityL40Res` › D2 OFF: STANCE_REENTRY at the west door | `… STANCE_REENTRY … tick 0` | `no REACHABLE stance inside buttonroom@880,768 …` | door-shut solve stops earlier |
| `fidelityL40Res` › D2 ON: re-entry passes to the chest | `… -> chest stance -> kill … died t780` | the same `buttonroom@880,768` refusal | door-shut solve stops earlier |
| `fidelityForcedHitXc` › D3 L40 leg 403 (LAPSECOST) | dashless refused at `detour` (`budget`) | refused, another deadline site | work moves (`DETOUR_VIA_BOUND`) |
| `fidelityLapseCost` › D1 MUTANT: refused at the DETOUR rung's budget | `detour` / `budget` | another deadline site | work moves (`DETOUR_VIA_BOUND`) |

The fix in every case is fidelity's call: wrap the BEFORE solve in `withL40Flip(false, …)` (`l40FlipSet.js`, as the
hammer rows here do), or re-record the AFTER. ⚠ Until fidelity signs, the branch's default tier and producer job are
red on exactly these rows. ⚠ The five `buttonroom@880,768` refusals are L40 solves with the south door SHUT: with the
flip, `APPROACH_DOOR`/`LATCH_WEIGH_FIRST`/`TURRET_APPROACH` try the door first and meet the latch's button room behind
`burnabletree@872,784`; the route carries the door (DOOR-CARRY), so the walk does not meet this state.

### 5.3 The ON radius

Measured here: the L40 brief legs on the page (§3) and the 376/377 clocks in node (§4). The bounded vitest set ON
(44 hammer fast files): 9 movers, all above. The full 930-leg sweep ON vs OFF and the survey are the planner's (§7);
this box cannot dispatch.

### 5.4 L12 (L95-PUNCHER's claim)

L95-PUNCHER: *"the flip needs `CHASER_STAGED_HUNT` AND `CLEARTAG_STAND` together (L12 14/14)"*. Measured on the p4g page,
CLEARTAG-STAND's 14 L12 bosslock keys (`w0/l12-{flip,off}-rows.jsonl`): **the set ON (no `CLEARTAG_STAND`) 14/14 done,
the set OFF 14/14 done**, the same verbs leg for leg (`kill, walk` ×8, `keylock` ×6), 0 divergences, 0 room hits in
either arm. No mover, so `CLEARTAG_STAND` is not in the flip. (Its L30KEYLOCK `--check` claim was not re-measured here.)

## 6. D — gates

FILLED-AT-END

## 7. The harvest A/B, and the exact ON dispatch

- **OFF (the branch with every flipped switch `=0`): no movers expected.** The branch's OFF is byte-identical to the base
  except `OPP_PRESS_FALLBACK`, which reads nothing while OPP is off.
- **ON (the branch's defaults):** dispatch `seedling-divergence-sweep.yml` at the branch head with **no `solver_env`**
  (the defaults ARE the flip), `carry_route_flags: true` and `false` (×2 each), `capture_requests: true`, and
  `leg_budget_ms: 180000` for the L40 subset (`keys` = the ten brief keys, `w0/w0-table.txt`). The OFF control is the
  same dispatch with `solver_env` = `SEEDLING_STAGED_HUNT_SCAN_MEMO=0;SEEDLING_CHASER_STAGED_HUNT=0;SEEDLING_OPPORTUNISTIC_STRIKE=0;SEEDLING_CLEARTAG_CHAIN=0;SEEDLING_STANCE_BURN=0;SEEDLING_CHOOSER_CUT=0;SEEDLING_DETOUR_VIA_BOUND=0;SEEDLING_KEYLOCK_TURRET=0;SEEDLING_LATCH_WEIGH_FIRST=0;SEEDLING_TURRET_APPROACH=0;SEEDLING_APPROACH_DOOR=0;SEEDLING_BOMB_PHASE_WAIT=0`.
- **On main (before the landing)**, the same set through the channel: `solver_env` =
  `SEEDLING_STAGED_HUNT_SCAN_MEMO=1;SEEDLING_CHASER_STAGED_HUNT=1;SEEDLING_OPPORTUNISTIC_STRIKE=1;SEEDLING_CLEARTAG_CHAIN=1;SEEDLING_STANCE_BURN=1;SEEDLING_CHOOSER_CUT=1;SEEDLING_DETOUR_VIA_BOUND=1;SEEDLING_KEYLOCK_TURRET=1;SEEDLING_LATCH_WEIGH_FIRST=1;SEEDLING_TURRET_APPROACH=1;SEEDLING_APPROACH_DOOR=1;SEEDLING_BOMB_PHASE_WAIT=1`
  (`OPP_PRESS_FALLBACK` exists only on this branch).
- **The page URL switch string** for js-16's walk at the branch head: none needed (the defaults). On main:
  `?seedlingSolverEnv=` + the `=1` string above, URL-encoded.
- **What to expect on L40:** the table in §3, arm C column, with 870/871/872 `done` once the leg budget is lifted; 394/871
  may diverge at t936 on the arrival clocks that pick the full pass's shaft strike (§3.1), until fidelity answers.

## 8. What the brief got wrong (measured)

- *"The slices' own node replays solved 394/411/871/872 within budget: this is the page-vs-node gap."* — The node
  replays and the page solve the same; the gap is the game (394/871), the harness clock (411/872), and the replays
  being dashless while the page keeps the full pass.
- *"376 also has an arrival-clock bomb phase … separate that from the ON regression"* — separated: the ON regression is
  OPP's (wave 6 − OPP is better than the defaults on 376, 19/25 vs 17/25).
- *"The fix … combine the BK2 switches and fit the budget"* — BK2 869's overrun is the turret approach's 276-fork search,
  not the staged hunt the memo cut, and no exact cut exists (§4.3).

## 9. Residue and hand-overs

1. **Fidelity (STOP, model):** L40 394/871 from L39 under CSH: the full pass's swing pressed at t925 lands
   `bob@736,752`'s third hit at t930 on its i-frame lapse in the model; the game's bob lives and hits the player at
   t936 (745.86,786.57). Witness: arm A's captured request 394/1 (seam 5222), `tools/bobtrack.sh`; the game's rows in
   `w0/a-w6-rows.jsonl` (394's `divs`). CI's 394 at seam 5216 diverged at t1028 (y≈851, `bob@736,800`'s ground) —
   likely the same family.
2. **377 at 5319:** OPP refuses inside the stance derivation's prerequisite trial (no rewind there); the fallback does
   not reach it.
3. **BK2 869:** a budget ruling or a preference-changing approach order (§4.3).
4. **The harness clock:** the sweep's L40 legs need `leg_budget_ms` ≈ 180000 to be measured at all under the set.
5. **377 at the defaults** diverges at t1256 (census wall H; fidelity's KNOCKBACK376 `rockGoneFencepost`, train 55).
