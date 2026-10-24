# Seedling fidelity HITLESS — the Tentacled Beast's fork prefers a variant that takes no hit

Session `seedling-fidelity-hitless` (wave 27, planner `seedling-fidelity-planning-11`). ⚖ The user, 2026-10-22:
*"Flip now, hitless later."*

| | |
|---|---|
| start SHA | `ba57be9a3d` (= main, recorded) |
| head | the commit carrying this report (the last on the branch); last code head `9e76fc5d` |
| harness branch | `claude/seedling-hitless-tentacle-xmt0bh` |
| new switch | `tentacleHitlessFirst` — **OFF** (byte-identical OFF) |
| evidence | `CC/docs/cloud-reports/seedling-fidelity-hitless-evidence/` (tools, seed sweeps, request replays, sweep rows, survey rows, vitest file list) |

**Verdicts:** W0 PASS · D1 PASS (ranking + drown rejection) · D1b PASS (the settle, found by the mover measurement) ·
D2 PASS (3 game witnesses, 0 px, game hits 0) · Movers: measured locally, **STOP for the flip licence** (list below).

**The one thing to know first:** the hit is real ON THE GAME and the ranking removes it — but playing all five
variants exposed a second gap: the faster hitless fight can leave a whirlpool alive, and the walk to the mouth then
drowns in it (leg 494, every seam time). D1b's **settle** (ON only) waits the whirlpools out inside the verb; the
walker itself still prices no whirlpool (residue R1, named, OFF too).

---

## W0 — the executor, the fork, and which L57 plans take a hit

**The executor** (`solverBot.execTentacleBeast`, BOSSFORK 8935f8e110): `playTentacleBeastPolicy` plays
`tentacleBeastPolicy.js`'s step on a run until the mouth stands (`run.entities('tentacleBeastFight').mouth`), failing
on a death (a `playerHits` row with `died`) or the 6000-tick bound. With `ctx.fork` (the segment's `forkRun`, the
hammer arc's closure — **read only, untouched**), it plays `TENTACLE_BEAST_POLICY_VARIANTS` (5 rows: gap / margin /
whirl / warn) each on a fresh fork **in list order and commits the first `ok`** — a variant that takes a swipe is `ok`.

**Which plans take a hit today (switch OFF — the survey at the base; the sweep's first run on the base tree carrying
D1's uncommitted code with its switch OFF, and repeated at the head: identical rows):**

| where | arrival | OFF plan | hit |
|---|---|---|---|
| survey (full) step 110, L57 | pit landing from L56, (96,160), seed 418414780 | SOLVED 2060 t | **0** |
| `tb-solve-s2` staging (seed 2) | (96,160) | 1047 t = the witness's tape | **1 at t393 — and the game takes it too** (`tb-solve-s2` samples: hits 0 → 1 at t393) |
| sweep leg 492 `level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48` | pit | done, 3124 + 259 t | **1 at t1257 on the game** (the brief's swipe) |
| sweep leg 493 `… in_pit_L56_6_10 -> location:Level 057 - Tentacled Beast` | pit | done, 2924 t | **1 at t1257 on the game** |
| sweep leg 494 `… in_L58_48_112 -> exit:out_tentaclebeast_80_48` | L58 door (96,64) | done, 1804 + 259 t | 0 |
| sweep leg 495 `… in_L58_48_112 -> location:…` | L58 door | done, 1604 t | 0 |

Leg keys derived at the base (`seedling-divergence-legs.mjs --blocks`, 850 legs): L57 = 492–495, L58 = 496
(`level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96 -> exit:out_teleporter_48_112`). The sweep rows are a LOCAL run
of `probe-seedling-divergence-sweep.mjs` on p4g, port 9722, `--page-legs=1 --leg-budget-ms=240000 --capture-requests`
(`evidence/sweep-l57-off-rows.jsonl`); each captured request replayed in node reproduces its leg's ticks and hits
(`evidence/replay-legs492-495-off.jsonl`, identical at every seam time −3..+3).

**How often variant 0 is not the best (node, `evidence/tools/seedsweep.mjs`, rng seed 1..40, OFF):** on the (96,160)
staging 9/40 seeds commit a hit and 8/40 throw the whirlpool drown; on the (96,64) door staging 8/40 commit a hit and
7/40 throw. (The `tb-solve-s2` and step-110 stagings give identical fights per seed: the fight depends only on the
arrival point and the seed.)

**Banks (W0):**

| row | result |
|---|---|
| bounded vitest BEFORE (`evidence/vitest-files.txt`: SPEARRECT's 157 + every test that greps `tentaclebeast` / `tentacleBeast*` / the brief's named rows; 165 run, `.slow` excluded) — base worktree `ba57be9a3d` | **5,631 tests, 5,631 passed**, 165 files |
| surface census at the base | GREEN 345 |
| constants census | `--check` PASS |
| reference `--check` | 4 DIFFER — environmental (registry/capabilities), as SPEARRECT/DRILL measured |
| identity block (`identity-block.sh`, base worktree vs head, port 9722) | every md5 row equal: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640` (all exit 0) — equal to SPEARRECT's published head. Generated set: OK at head; the base worktree has no venv (environmental). Reference: 4 DIFFER at both (environmental) |
| tapeRunner pairs (`tapeRunner.test.js`, `fullName\tstatus` sorted) | 635 rows, 0 non-pass, md5 `a02def3b2b47710b8825a88cd62f6c4c` at base AND head |

## D1 — the policy (PASS, behind `tentacleHitlessFirst`, OFF)

`contactFidelity.js`: new key `tentacleHitlessFirst: false` (+ `SEEDLING_TENTACLE_HITLESS_FIRST=0|1`); the defaults
pin in `contactFidelity.test.js` gains the row. `solverBot.js`, only inside the `tentaclebeast` executor:

- **ON, every variant is played on its own fork** and `chooseTentacleVariant(tried)` (new export, pure) commits: of the
  `ok` ones, **no hit first, then the fewest hits, then the fewest ticks, then list order**. A hit stays ACCEPTABLE
  when no variant is hitless. `playTentacleBeastPolicy` counts the landed `Player.hit`s of its own play
  (`playerHits` rows since its start).
- The record gains `choice` `{rule: 'hitless'|'fewest-hits', variant, hits, tried, hitless}` (how many were tried, how
  many were hitless) and each `tried` row its `hits` — ON only.
- **ON, a fork that meets the whirlpool drown is a rejected variant.** The run refuses `Player.drown()` from outside the
  player by NAME with a plain `Error` (`levelRun.stepTentacleRuntimeNow`, bosskills D3: "a death the solver keeps out
  of"). The first-`ok` loop rarely met it; playing all five meets it often (seed 7: variant 1 drowns at t1177), and the
  throw ended the whole solve. ON, only that message is caught on a fork and recorded as `ok: false, why: "the player
  drowned: …"`; anything else still throws.
- The run's play must take the hits its fork took, or the verb refuses by name (a determinism guard).
- OFF: the old loop, unchanged.

**Measurement (ON, after D1b):** `evidence/seeds-*-on.jsonl` — (96,160) staging **40/40 hitless, 0 errors**; door
staging **39 hitless + 1 fewest-hits (seed 35: 0 of 5 variants hitless, one swipe at t169 committed), 0 errors**. OFF
on the same seeds: 9 + 8 hit commits, 8 + 7 errors.

**Tests** (`fidelityTentacleBeast.test.js`, `fidelity HITLESS`): ships OFF; the ranking on synthetic rows (incl.
fewest-hits, ties, none ok); seed 2 — OFF commits variant 0 and its t393 swipe (the game's plan, tick count = the
witness), ON variant 1, 0 hits, 1850 t, the five `tried` rows pinned; seed 7 — the drowned variant rejected; the door
staging at seed 35 — the fewest-hits rule on real data.

**Mutants** (predicted, copy + restore): H1 rank ticks before hits → predicted the seed-2 row; RUN: that + the
synthetic ranking row + D2's `tb-hitless-s2` re-plan. H2 drop the drown catch → the seed-7 row alone (RUN, as
predicted). H3 count hits from the run's whole ledger → survives (no staging holds an earlier hit), named.

## D1b — the settle (PASS, ON only) — found by the mover measurement

Replaying leg 494's captured request ON (D1 alone): the hitless variant 1 ends the fight sooner, with whirlpool#36
alive, and the WALK to the mouth (`reach-exit`) is pulled into it and **drowns at t928 — at every seam time −3..+3**
(`evidence/replay-legs492-495-on-presettle.jsonl`); OFF the leg is done. The drown is in the walker's walk
(`botDriverV2.drive` → `levelRun.advance`), not in the fight.

ON only: once the mouth stands, `settleTentacleWhirlpools` holds the player out of every live whirlpool's keep-out
(`tentacleBeastPolicy.tentacleBeastSettleStep`; the fight's own step (2) factored as `stepOutKey`, byte-identical for
the fight) until none is left, bounded at 300 ticks (a whirlpool lives 150 + 60 + 30 updates, and the beast spawns none
after its death), on every fork and on the run; `spent` counts it, a death during it is the fight's. This is the solver
keeping out of a death it already refuses by name — the fight's existing keep-out, extended to the whirlpools the fight
leaves behind — not a model of the drown (residue R1).

After D1b all four captured requests solve ON with **0 hits** (492: 2177 t, 493: 1977, 494: 1212, 495: 1008), identical
at every seam time −3..+3 (`evidence/replay-legs492-495-on.jsonl`). Mutant H5 (no settle) → the six ON rows red (RUN,
as predicted).

## D2 — the witnesses (PASS; p4g headless logic-only, 0 px, no player hit on the game)

`probe-seedling-bosskills.mjs --file=<tape> --record --name=<n> --dir=tentaclebeast-witness`, port 9722. Each tape IS
the solver's ON answer (`evidence/tools/maketape.mjs`: clear-tag {57,0}, then the mouth), one tick past the solve:

| witness | arrival / staging | ON choice | ticks | game |
|---|---|---|---|---|
| `tb-hitless-pit` | the route's pit landing (survey step 110's staging, seed 418414780) | variant 4 (5/5 hitless) | 1389 | hits 0 on every sample, {57,0}, L58 |
| `tb-hitless-door` | the L58 door's arrival (96,64) on that staging (legs 494/495) | variant 1 (3/5 hitless) | 977 | hits 0, {57,0}, L58 |
| `tb-hitless-s2` | `tb-solve-s2`'s staging (seed 2) — where OFF's swipe lands on the game | variant 1 (3/5) | 1850 | hits 0, {57,0}, L58 |

The witness loop replays each embedded tape in node, switch ON: player, level, hits, the beast's anim, every tentacle
row and the generator state equal the game's on every sampled tick (0 px). A second row per witness re-plans it ON from
its staging and matches the tape tick for tick. Each tape includes the settle (the whirlpools alive at the mouth,
waited out), and the game plays it with no pull. The witness-roster row is now eight names. Mutant H4 (re-plan with the
switch OFF) → the three re-plan rows red (RUN, as predicted).

`tb-hitless-pit` was first recorded under CPU load (1342 of 1390 ticks sampled) and re-recorded on a quiet box: 1390 of
1390 (`49be4101`).

## Movers — the survey and sweep rows this moves (switch ON), STOP for the licence

| instrument | row (by key) | OFF (base) | ON (head) |
|---|---|---|---|
| route survey (full) | step 110 L57 clear-tag {57,0} + the mouth | SOLVED 2060 t, 0 hits | **SOLVED 1389 t, 0 hits** (local, `--only=110,111`) |
| route survey (full) | step 111 L58 | REFUSED (the tag-1 teleporter on a pit tile) | unchanged |
| sweep 492 (pit → exit) | `level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48` | done, **1 hit t1257** | **done, 0 hits** (2177 + 259 t) |
| sweep 493 (pit → location) | `level_57 <- in_pit_L56_6_10 -> location:Level 057 - Tentacled Beast` | done, **1 hit t1257** | **done, 0 hits** (1977 t) |
| sweep 494 (door → exit) | `level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48` | done, 0 hits (1804 + 259) | **done, 0 hits** (1212 t) — D1 alone: drowned in the walk |
| sweep 495 (door → location) | `level_57 <- in_L58_48_112 -> location:Level 057 - Tentacled Beast` | done, 0 hits (1604) | **done, 0 hits** (1008) |
| sweep 496 (L58) | `level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96 -> exit:out_teleporter_48_112` | done (7 t walk) | done (7 t walk) — no fight, cannot move |

Sweep rows: local p4g, `--leg-budget-ms=240000 --page-legs=1`; the ON arm passed `--contact-fidelity=` the 49 default-ON
keys + `tentacleHitlessFirst` (each plan's `contactFidelity` stamp read back: it carries the key). **×2 agrees, both
arms**: the repeat over all five keys (`evidence/sweep-l57-l58-{off,on}-rows-2.jsonl`) gives the same verdicts, hits and
plan lengths; the OFF repeat ran at the HEAD with the switch at its default and reproduces the base's rows exactly
(492/493 hit at t1257, 3124/2924 t) — the OFF byte-inertia, on the game. 0 divergences in every row.

**Probes standard, switch ON** (local, p4g, port 9722, the default flipped in the tree for the run and restored —
`evidence/probes-standard-on.txt`): **11/11 ALL CHECKS PASSED** (logical-links B,R 964 s; vanilla-map 888 s;
arrival-composites 133 s; midroom-replan D; restart-route W,J; restart-warp W,J; adopt; obstacle-events W,J;
generated-playback; loop-restart; seal-delivery A). None of them reaches L57 (logical-links' B session ends near
sphere 5; no log names level 57), so the switch is not exercised there — consistent with the reachability argument.

**Tapes / goldens that pin the tentacle plan:** no committed tape or producer digest solves L57 (the fight is reached
only through the `tentaclebeast` verb; `grep -a` over the tapes and `check-*` gates: none). The bounded vitest with the
switch ON (`SEEDLING_TENTACLE_HITLESS_FIRST=1`): **4 red of 5,646**, every one a flip re-pin:
  1. `contactFidelity.test.js` › the shipped defaults (`tentacleHitlessFirst: false` → `true`);
  2. `fidelityTentacleBeast.test.js` › BOSSKILLS' *ON: the verb opens the mouth…* — `out.perTick.length` 1047 (=
     `tb-solve-s2`, the hit-taking witness) → 1850 (= `tb-hitless-s2`); the flip re-points that row at the hitless witness;
  3. `fidelityTentacleBeast.test.js` › HITLESS *ships OFF*;
  4. `dashShape.test.js` › *the defaults add no field* — an ARTEFACT of flipping by env: the env flip happens after
     `CONTACT_FIDELITY_DEFAULTS` is frozen, so the set reads off-default and the request is stamped `contactFidelity`;
     a flip of the source default does not red it (the same artefact every env-measured switch shows).
  No tape, no producer, no control, no stub assumed the old behaviour (`grep -a` for the key, the verb, `tried`,
  `TENTACLE_BEAST_POLICY_VARIANTS`: only the tentacle test file and the BOSSKILLS rows).

**Reachability argument:** the switch is read in `execTentacleBeast` alone; that executor is reached only through the
`tentaclebeast` strategy, which only `solid:tentaclebeast` maps to, which only L57 holds. Survey: one step (110); sweep:
legs 492–495. Still owed on CI runners (below): the full survey A/B (locally only steps 110/111 were run) and the sweep
A/B ×2 (run ×2 locally).

### The CI dispatches the planner should run (branch `claude/seedling-hitless-tentacle-xmt0bh`, my last head)

1. **Survey A/B** (`seedling-survey.yml` has no contact-switch input): OFF = `-f through=end -f route=full` at my last
   head (expected = main's: step 110 SOLVED 2060 t). ON = the same on a planner commit that flips
   `tentacleHitlessFirst: true` in `contactFidelity.js` (one line) — expected: step 110 SOLVED 1389 t, 0 hits, and no
   other step moves. A cheap pre-check: `-f route=full -f only=110,111 -f base_run=<the OFF run>`.
2. **Sweep A/B, ×2** (`seedling-divergence-sweep.yml`, branch `claude/seedling-hitless-tentacle-xmt0bh`, my last head):
   `-f keys='level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48|level_57 <- in_pit_L56_6_10 -> location:Level 057 - Tentacled Beast|level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48|level_57 <- in_L58_48_112 -> location:Level 057 - Tentacled Beast|level_58__r4c1 <- in_tentacle_beast_mouth_L57_56_96 -> exit:out_teleporter_48_112' -f leg_budget_ms=240000 -f capture_requests=true`
   - arm OFF: `contact_fidelity` empty (the defaults);
   - arm ON: `-f contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,igneousLava,lightsBossFight,kingOfFireFight,tentacleBeastFight,ropeCutVerb,chestProbeLineEnd,enclosedPitCorner,igneousDeadFrames,ropeCutAnyWeapon,drillMixedRooms,yetiTalk,pixelMaskSightLines,spearGameTest,tentacleHitlessFirst`
     (the 49 default-ON keys + `tentacleHitlessFirst` — ⚠ the input turns every unlisted key OFF).
   Run each arm twice. Expected (local, measured above): OFF 492/493 one hit at t1257, ON 492–495 done with 0 hits,
   496 done in both.
3. **Probes:** `seedling-probe.yml -f battery=standard` at my last head (OFF = the default; expected green as main), and
   on the flipped commit of (1) for ON (local result above).

## JS arc — pins that move, what it must wire

- New optional fields on the `tentaclebeast` verb's record (ON only): `choice` and `tried[].hits`. The trace consumers
  read records as data; nothing to wire unless the JS page wants to show the choice.
- The switch hook needs nothing: `seedlingContactSettings.js` derives `seedlingContactTentacleHitlessFirst` from
  `CONTACT_FIDELITY_DEFAULTS` (`contactFidelityHook.test.js` in the bounded set).
- No `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` contract changed; no new
  `SolverRefusal.obstacle.kind`; no `run.*` field renamed or reshaped (the skin reads nothing new).

## Hammer arc — nothing handed over

The fork closure (`ctx.fork` / `forkRun` / `replayOntoFork`) is called, not edited. No digest part, no escape, no
`planWaypoints` touched; no new per-visit run map (the settle reads `run.entities('tentacleBeastFight')`, the existing
family).

## What the brief got wrong (measured)

- *"survey L57 step = SOLVED 2060 t"* — right, but the survey step **takes no hit** (replay hits 0): the swipe is a
  sweep-staging fact (legs 492/493, t1257), not a survey one. ON still moves the survey row (2060 → 1389 t), because
  the ranking breaks ties by ticks.
- *"L57/L58 legs"* — at the base there are four L57 legs (492–495) and **one** L58 leg (496); the L58 leg does not fight.
- *"(re-derive keys at your base)"* — the ids did not shift: 492–495 are the same L57 legs planning-10 named.
- *"the fight may take one swipe"* — the GAME takes it too (`tb-solve-s2` is a game recording of the OFF plan, hit at
  t393), so this was never a model-only artefact.

## Residue

- **R1 — the walker prices no whirlpool.** A walk across a live whirlpool is pulled to its centre and the run throws
  the drown by name (a plain `Error`, not a `SolverRefusal`). OFF, 7–8 of 40 seeds per arrival end that way in the
  post-fight walk; ON the settle removes it for the verb's own continuation. The model fix (transcribe the drown as a
  death, or price the pull in the walker — `botDriverV2.drive`, fidelity's behind a switch with the JS arc's review) is
  queued, not done.
- **R2 — `fewest-hits` is rare.** One seed in 80 (door, 35) has no hitless variant; the five variants are BOSSFORK's.
  A wider variant list would only matter there.
- **R3 — the settle lengthens a location-only leg** (493/495: +the settle ticks after the report), harmless (0 hits).

## Byte-inertia

OFF, the executor runs the unchanged first-`ok` loop; the only new statements on the OFF path are a `ledger('playerHits')`
read (a copy, no side effect) and an extra `hits` field on the play's private return, which the OFF record never copies.
Measured: the identity block's every md5 row and the six producer `--check`s equal at base and head; tapeRunner pairs
equal (`a02def3b…`); bounded vitest OFF 5,646/5,646 (BEFORE 5,631/5,631; +15 = 14 new rows in `fidelityTentacleBeast` (22 → 36) and
one per-key row in `contactFidelityHook` (67 → 68)); the OFF game sweep at head reproduces the base's five rows exactly. No committed tape and no
producer digest moves.

## Records

- `docs/json/developer/procgen/seedling-bot-log.md`: the HITLESS entry, with three trap candidates.
- Surface census `--write` (345 rows, GREEN): the fork's `playerHits` reads, the `advance` / `entities` / `state` sites
  of the settle, the switch's `CONTACT_FIDELITY` site — line moves, no new kind. Constants census `--write` + `--check`
  PASS (line moves only).
- Bounded vitest AFTER (switch OFF): **5,646 / 5,646 passed**, 165 files.
- The reference regenerated: the docs index (one heading, +34 lines) and the instruments' citation of
  `probe-seedling-bosskills.mjs` (the build-log entry); the 4 environmental DIFFERs left as at the base.
- Push CI (`JavaScript Unit Tests`) at `9e76fc5d` (the last code/doc head before this report): run 39991974594
  **success** — 22,278 passed, 0 failed; slow battery 265 passed. This report's commit is docs/evidence only; its run is
  read before the final message.

## Rows to BANK

- `tentacleHitlessFirst` OFF; ON → L57 legs 492–495 done with 0 hits (local p4g), survey step 110 SOLVED 1389 t.
- Three p4g witnesses `tb-hitless-{pit,door,s2}`: game hits 0, 0 px.
- Seed sweep ON (80 seeds, 2 arrivals): 79 hitless, 1 fewest-hits, 0 errors.
