# Seedling fidelity SLOWFIX — the Lights sortie portfolio (`lightsSortiePortfolio`, OFF); the L15 post-chest walk is a hold seam (`run.stepHeldFrames`)

| | |
|---|---|
| Session | `seedling-fidelity-slowfix` (planner `seedling-fidelity-planning-11`, wave 27) |
| Start SHA | `ba57be9a3d` (main; the brief's base — the harness branch already sat on it) |
| Code head | `693c9812` (code: D-A `7830682d` + `2a431235` + `693c9812`, D-B `8280b457`, census `8f0848d3`); records `c10c16ea`; the report's commit carries the last surface `--write` (one more `CONTACT_FIDELITY` read site from the prunes) |
| Harness branch | `claude/seedling-fidelity-slowfix-bca2p9` (nothing pushed elsewhere) |
| Port | 9723 (the pristine base worktree's own server: 9724) |
| Verdicts | **W0 PASS · D-A PASS behind `lightsSortiePortfolio` (OFF; 303 t ≤ 361, witnessed on p4g at 0 px) — flip STOPs for a licence · D-B STOP: not a model gap; the model piece (`run.stepHeldFrames`) is in and witnessed, the wiring is the JS arc's** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-slowfix-evidence/` |

## The one thing to know first

**Neither D was what the brief suspected, and both were measured to the tick.** D-A's 133 t is not a forecast error: the
forecast equals the live run at every plan, and the 494 t vs 361 t is the greedy sortie search landing on different
sides of an equal-cost TIE — the fight's length is chaotic in that choice (ten arrival clocks: 324..473 t, neither tie
order better on average). The fix is a search one: roll the whole fight out under both tie orders and play the shorter
(never longer than today's greedy) → **303 t**, recorded on p4g at 0 px. Two rollouts cost 2× and timed the L69 sweep
legs out at 90 s; two EXACT prunes on the same key (no answer changes) make the portfolio cheaper than today's greedy,
and the legs are done/done ×2. D-B's 0.25 px is not the chest or the walk's
sub-pixel: **the two legs played as ONE tape are the model's at 0 px on p4g**; the live 115.30 appears only when the
game is HELD between the legs, because the held frames step the pinned Swim channel (`Game.time` and the player frozen,
the mixer running, 33 → 44 over a 300 ms hold), which shifts the swim boost window. The model now has the primitive
(`run.stepHeldFrames(n)`, 0 px with the game's 10), but only the JS arc's continuation knows `n` — **`l15-post-chest-walk`
retires when the JS arc wires it**, not on this branch.

## W0 — the base (PASS)

| row | result |
|---|---|
| checkout | the harness branch `claude/seedling-fidelity-slowfix-bca2p9` already at `ba57be9a3d`; bootstrap `READY`, Node 22.22.0 |
| identity block (`identity-block.sh`, pristine base worktree on port 9724 vs this tree's head on 9723; `evidence/identity-*.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640` (all exit 0) — **base = head on every row**, and every row equals SPEARRECT's published value. Generated set: head OK (the base worktree has no venv: environmental). Reference: 4 DIFFER at base and at head, the same 4 (registry/capabilities and their two regions — environmental, as SPEARRECT measured); my doc edits added 2 (docsIndex + README's index), regenerated |
| surface / constants | surface GREEN at the base; at the head RED by my new reads + one door finding (`lightsVerb.js` imported `contactFidelity.js` directly — fixed through `solverView.js`), then `--write` → GREEN 345 rows; constants `--check` PASS, `--write` (literals moved) → 0 drift |
| bounded vitest BEFORE (`evidence/vitest-files.txt`: SPEARRECT's 156 + the brief's list + every test that names `lightsVerb`, `lightsSortiePortfolio`, `CONTACT_FIDELITY_KEYS/DEFAULTS`, `chestProbeLineEnd`, `seedlingKnownDivergences`, `fidelityReturn`, `fidelityL1516`; 166 files, `.slow` excluded by the default config) | **5,494 tests, 5,494 passed** (pristine base worktree) |
| logical-links B, locally (`probe-seedling-wasm-logical-links.mjs --only=B --trace`, port 9723) | the known divergence reproduced at history 75 with the CI numbers (t18, 115.05 / 115.30); `--trace` captured every solve request (with the page's room records) and every shipped tape |

## D-A — the L69 Lights spear solve (PASS behind `lightsSortiePortfolio`, OFF)

**Measurement.** A trace of every sortie decision, ON vs OFF, from the committed `lights-solve-spear` staging: identical
to t165, then OFF takes `left3 stay` and ON `left3 back` — both land one hit at the same cost (9 ticks: the plan pads to
n + 1 + `swingTests`). OFF's forecast rejects `left3 back` (the float rect misses on the way back); ON's admits it, and
the greedy keeps the first candidate in its loop order (`back` first). From there the two fights take different kill
orders and ON spends its last 180 ticks waiting for lone fliers (`w60` sorties and idle dodges). Every live plan
matched its forecast digest in both arms: **the forecast is right; the search is greedy.** The perturbation census
(`evidence/da-perturb*.jsonl`, seam.time ±60, both tie orders) makes it a property, not a sample:

| seam.time Δ | −24 | −16 | −8 | −4 | +4 | +8 | +16 | +24 | +40 | +60 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| spear, greedy (`back` first, today) | 421 | 473 | 324 | 328 | 421 | 334 | 363 | 331 | 368 | 380 | 374.3 |
| spear, `stay` first | 336 | 436 | 326 | 330 | 372 | 339 | 445 | 331 | 365 | 385 | 366.5 |
| **spear, portfolio (ON)** | 336 | 436 | 324 | 328 | 372 | 334 | 363 | 331 | 365 | 380 | **356.9** |
| sword, greedy | 657 | 703 | 720 | 543 | 667 | 679 | 661 | 677 | 541 | 544 | 639.2 |
| **sword, portfolio (ON)** | = greedy on all ten |  |  |  |  |  |  |  |  |  | 639.2 |

(fight ticks from the solver's record; 0 refusals in 40 solves.) A one-step lookahead tie-break was tried and rejected
(spear 409, sword 695 — worse than the greedy on the sword).

**Change** (`lightsVerb.js`, `contactFidelity.js`). A new key `lightsSortiePortfolio` (OFF; `SEEDLING_LIGHTS_SORTIE_PORTFOLIO=0|1`).
ON: before the fight's first decision `execLights` rolls the whole fight out in its own forecast once per tie order
(`LIGHTS_VERB.tieOrders`: `back`-first, then `stay`-first; `rolloutLightsFight`, which mirrors the live loop — a decision
starts with no pending test and no held press, as `lightsForecastState` would), keeps the shortest (the greedy's order
wins a tie), and plays it plan by plan with the same checks as before (a hit, a digest mismatch, a crossing, the bound —
each a refusal by name, and a queue the live fight leaves is a new `unresolved` refusal). No rollout finishing → the
greedy plays live, as today. The record carries `portfolio: {tried: [{order, ticks}], chose}` only while ON.
**The forecast fault the rollout exposed:** carrying the forecast across a plan boundary showed a spear press setting
the sword's `slashTimer` (20) and `slashing`. `set spearing` sets neither (`Player.as:810-822`; only `set slashing`,
`:780-801`). The greedy never read it (it re-clones `slashTimer` from the run, which models it right), the rollout did —
its `back`-first rollout ran 418 t where the live greedy ran 421. ON, the spear press leaves both alone (the shield bump
reads `slashing`, so a shield + spear fight was affected too). OFF: byte-identical — the old assignments stand.

**Witness.** The ON solve from the committed staging: **303 t** (fight 297; rollouts `back-stay` 421 = the greedy exactly,
`stay-back` 239), played on p4g headless (`probe-seedling-lights.mjs --compare --record --name=lights-solve-spear-portfolio`):
**PASS, 304 sampled ticks, worst |Δ| 0** (player, fliers, shots, level, the {69,0} write at t297, the last flier gone at
t296, the exit to L36). `fixtures/lights-witness/lights-solve-spear-portfolio.json`. The sword under the key: rollouts tie
(507 | 507), its tape is `lights-solve-sword` byte for byte (559 t). Rows: `fidelityLights.test.js` (+2: the replay, the
write tick), `fidelityLights.slow.test.js` (+2: the portfolio spear solve = the witness key for key, the sword under the
key = its committed tape; both pin the `portfolio` ledger, and the OFF rows pin its absence) — **5/5 slow rows green**
(the portfolio rows take ~45 s each, 2× the greedy's, inside the 120 s bound).

**Mutant** (predicted first, copy + restore): the spear-timer fix removed (the rollout steps a spear press as a sword's)
→ predicted "the portfolio no longer equals the greedy, the solve moves off 303". Measured: rollouts 418 | 416, the
solve 479 t (the slow row's witness would go red); restored, `git status` clean.

**The cost, and two exact prunes (`693c9812`).** Measured ON before them: both L69 sweep legs ran out the 90 s leg budget,
×2 (OFF already takes 51–89 s there). A profile of one greedy solve (node): 2.67 M forecast ticks — the sortie search
10.2 s over 39 decisions, the dodge search 3.5 s over 27. Two prunes, behind the same key, that change no answer:
a sortie candidate that has landed nothing by its last swing test (plan index n + `swingTests`) is rejected either way,
so its forecast stops there (no back leg, no 16-tick safe tail); and a dodge unhit to the horizon scores `Infinity`,
which no later candidate beats (`score > best.score`), so the dodge search returns the first (most dodges are the first
candidate, one idle tick). Same answers on the committed staging (303 t, rollouts 421 | 239; the sword 559 t, 507 | 507;
all three tapes byte-equal to the fixtures) and on all twenty perturbed solves (`evidence/da-perturb-portfolio-pruned.jsonl`
= the unpruned file); the portfolio solve now costs **less than the greedy alone** (slow rows: 15 s vs 23–27 s). After
them the L69 ON legs are done/done ×2 (51–71 s). Mutant (predicted: "a prune one tick early drops the spear's T+5 hits
and moves a rollout"): `n + swingTests − 1` → the `back-stay` rollout 421 → 328 (the chosen tape stays 303) — red on the
slow row's ledger pin; restored.

## D-B — the L15 post-chest walk (STOP: a hold seam, not a model gap; the model piece is in)

**W0 — the segment, recorded.** The engine's own requests (from logical-links B's `--trace`): the chest leg
`wasm-location-15` (185 t, the request's staging with seam.time 26706) and the continuation `wasm-continue-exit-15`
(157 t), whose request is that staging + the chest leg as its 185-tick prefix. Three things the brief did not have:
1. **In AP play there is no chest at (144,96).** The page mounts each AP location as an `apitem`: L15's is
   `{type: 'apitem', x: 144, y: 96, attrs: {tag: '1', look: 'chest'}}` (36 rooms differ from the delivered set this
   way). The player swims INTO it and ends the chest leg at (152.6, 103.45) — in the water (`terrain` 5, swim channel
   `{frames 33, open}`). (A replay on the delivered set's chest stops at x 141.95 against the Solid — the first false
   lead.)
2. **The two legs as ONE tape are the model's at 0 px on the game** (p4g headless, the AP set mounted;
   `fixtures/hold-seam-witness/l15-hold-seam.json` `joined`): 343 observations, worst 0; **the game reads 115.05 at
   walk t18**, the model's value.
3. **Played as the engine ships them** — the chest leg `hold: true`, a 300 ms hold, then the engine's continuation tape
   on the held game (`held`): through the hold `game_time` stays 26912 and x stays 152.6, but `sound_pin` runs 33 → 43
   (44 at the continuation's t1): `Bot.update` steps `Music.pinStep()` above the armed check, on every engine frame
   (`crossSwapStatics` `Music.<swim channel>`: "a mixer does not stop"). The continuation reads **115.30 at t18** — the
   live signature. The channel closes at t4 (frame 47) instead of later, the replay restarts it, and the boost window
   (`Player.as:548`, `soundPosition("Swim") < 0.1` → +0.25) lands one stroke differently: positions equal through t17,
   first different at t18, +0.25 px, y equal.

The first divergent field is therefore the **swim channel at the seam** (`state.swim.frames`), 0 frames in the model
against the hold's frames in the game. In the model, idle seam frames reproduce the signature for any count ≥ 2
(1 parts at t19), so the live hold was ≥ 2 frames; the recorded one was 10.

**Change** (`levelRun.js`, byte-inert). `run.stepHeldFrames(n)`: steps the swim channel by `n` (`stepChannel`) and nothing
else — the third kind of unbilled frame beside a door's `LOAD_DEAD_FRAMES` and a ceremony's, which the model already
carries. It refuses a non-integer or negative `n` by name and returns null when no swim sound has played. **Nothing calls
it**: a continuation staged after a hold must hand it the held frames, and that caller is the JS arc's (below). No key —
an uncalled method moves nothing.

**Witness / rows** (`fidelityHoldSeam.test.js`, 7 rows): the AP room derived in-test (the delivered L15 with its chest
swapped for the page's `apitem` — equal to the page's records for L14 and L15, measured); `joined` at 0 px (343 obs);
the hold's facts (game_time frozen, pin 33 → 44, 10 held frames); the chest leg at 0 px with its end channel = the game's
pin; **`stepHeldFrames(10)` → the held continuation at 0 px (158 obs)**; CONTROL without it → t18, 115.05 vs 115.30, y
equal; the method's contract. The recorder is `evidence/probe-hold-seam.mjs` (self-contained from the fixture and the
engine's continuation tape `evidence/l15-continuation-tape-as-shipped.json`): a second run reproduced both recordings
byte for byte (heldFrames 10 again).

**Mutant** (predicted first, copy + restore): `stepHeldFrames` made a no-op → predicted "the 0 px held row goes red at
t18". Measured: exactly that row red (6/7 green); restored, diff = the 21 added lines.

**Why STOP.** The fix that retires the known divergence is in the continuation's staging — `solveSegment`'s prefix
admission / the delivery's held end — both the JS arc's (read-only here). The model is right for every frame it is told
about.

## Movers

**D-A (`lightsSortiePortfolio` ON).** The verb runs only through `OBSTACLE_STRATEGIES['solid:lightbosscontroller']`
(L69's clear-tag), so the survey's only reachable step is **148**:

| instrument | OFF | ON |
|---|---|---|
| route survey step 148 (`--through=end --route=full --only=148 --timeout=900`, local) | SOLVED 826 t, 3 decisions | **SOLVED 826 t**, identical modulo timing (measured before the prunes: 131 s → 257 s under load; the prunes change no answer) |
| keyed sweep, L69 legs 594/595 ×2 (local, p4g, inv/solver, page_legs 1; keys below; `evidence/sweeps-local.txt`) | done/done ×2 (594: 70.7 s, 88.8 s; 595: 50.6 s, 75.9 s) | before the prunes: **timeout/timeout ×2** (90 s); **after them (`693c9812`): done/done ×2** (594: 53.2 s, 51.0 s; 595: 71.5 s, 67.9 s), 0 divergences |
| bounded vitest (167 files, at `693c9812`) with `SEEDLING_LIGHTS_SORTIE_PORTFOLIO=1` | 5,503 / 5,503 | 5,501 pass, **1 red**: `dashShape.test.js` "the defaults add no field" — an artefact of measuring through env (the switch is off-default, so the request gets a `contactFidelity` stamp); at a real flip `CONTACT_FIDELITY_DEFAULTS` carries the key and the stamp vanishes. 1 skipped (`contactFidelity.test.js`'s defaults pin, `skipIf` the env) |
| wasm probes standard | not run here (no dispatch) — see below | |

**D-B.** No switch; `stepHeldFrames` is uncalled: nothing can move. The L15 keyed legs at the defaults ×2 (local):
done/done ×2 (legs 198/199, 1.3 s each; `evidence/sweeps-local.txt`). ⚠ L15 has two legs at this base (`level_15__r1c5 <- in_L14_32_64 -> exit:out_stairsup_32_64`,
`level_15__r1c9 <- in_L16_16_64 -> exit:out_stairsdown_144_16`); neither is the post-chest continuation, which only the
logical-links walk plays.

**At a flip of `lightsSortiePortfolio`, re-pin:** `fidelityLights.slow.test.js`'s `lights-solve-spear-on` row (the
default solve becomes `lights-solve-spear-portfolio`; the ON-tape `lights-solve-spear-on` stays a replay witness) and its
OFF-record `portfolio` absence pins; `contactFidelity.test.js`'s defaults table; `dashShape.test.js`'s "defaults add no
field" stays green at a real flip (it went red only under the env measurement). Read the CI ON sweep's L69 leg times
against the 90 s budget (local: 51–71 s).

## CI dispatches for the planner (I cannot dispatch)

1. **Sweep A/B, L69** (`seedling-divergence-sweep.yml`, branch `claude/seedling-fidelity-slowfix-bca2p9`, ×2 each):
   `keys=level_69 <- in_pit_L70_3_8 -> exit:out_lightbosscontroller_72_72|level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights`,
   `capture_requests=true`, and for the ON arm
   `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,igneousLava,lightsBossFight,kingOfFireFight,tentacleBeastFight,ropeCutVerb,chestProbeLineEnd,enclosedPitCorner,igneousDeadFrames,ropeCutAnyWeapon,drillMixedRooms,yetiTalk,pixelMaskSightLines,spearGameTest,lightsSortiePortfolio`
   (the 49 default-ON keys at this base + the new one; comma-separated, as `parseContactFidelity` splits). Expect
   done/done; read the ON legs' times against `leg_budget_ms` 90000.
2. **Survey, full** (`seedling-survey.yml`, the branch, `through=end`, `route=full`): the default arm must equal the
   wave-26 base (both changes are OFF / uncalled). The survey has no switch input, so its ON arm is the local step-148 row
   above.
3. **Sweep, L15 legs** at the defaults ×2: `keys=level_15__r1c5 <- in_L14_32_64 -> exit:out_stairsup_32_64|level_15__r1c9 <- in_L16_16_64 -> exit:out_stairsdown_144_16`.
4. **Probes** (`seedling-probe.yml battery=standard`, the branch): the default arm only (nothing OFF moves). And
   `probe-seedling-wasm-logical-links.mjs` (`probes=probe-seedling-wasm-logical-links.mjs`, `args=--only=B`) to confirm
   the known divergence still matches its entry at this head (it did locally).

## The JS arc — what it must wire (D-B), and its pins

- **`run.stepHeldFrames(n)` (new, optional).** At a continuation shipped onto a held game, the model's run must step the
  swim channel by the engine frames the game was held between the request's snapshot and the tape's tick 0. `n` is the
  game's `botStatus.sound_pin.channels[0]` advance across the hold (frames at the continuation's tick 0 minus the
  model's `state.swim.frames` at the prefix end), or the hold's engine-frame count. A plan solved before the hold ended
  cannot know `n`; the shape of the fix (re-check the pin at ship and re-solve / re-stage when the player is in water and
  the channel moved, or stage the continuation from the game's pin) is the JS arc's choice — the delivery's
  `shipClock`/`adoptClock` already do this for `Game.time`, which the hold does NOT move.
- **Retire `l15-post-chest-walk`** (`scripts/procgen/seedlingKnownDivergences.js`, row id `l15-post-chest-walk`, and its
  `seedlingKnownDivergences.test.js`) once the wiring lands and logical-links B shows 0 divergences at history 74–76.
- ⚠ The same seam exists after ANY held end or held arrival with the player in water or lava (the pin is the swim boost);
  a dry seam is unaffected (no boost read). The model's door carry (`enterWorld`'s `LOAD_DEAD_FRAMES`) is unchanged.
- Pins: none of the JS arc's move (no shared function's signature or contract changed; `execLights`' record gains an
  optional `portfolio` field only while the key is ON).

## Handed to the hammer arc

Nothing (no hammer-owned function touched; `lightsVerb` is the Lights strategy, owned here).

## Deltas

- `contactFidelity.js`: `lightsSortiePortfolio: false` (+ env line); `contactFidelity.test.js`: the defaults table and the
  `skipIf` env list.
- `lightsVerb.js`: `LIGHTS_VERB.tieOrders`, `rolloutLightsFight` (exported), `planLightsSortie` reads `env.tieOrder`, the
  spear press's dash timer under the key, `execLights`' portfolio queue, the two exact prunes (`forecastPlan`'s `landBy`,
  the dodge's first `Infinity`; `env.exactPrune` = the key); reads `CONTACT_FIDELITY` through `solverView.js`.
- `levelRun.js`: `run.stepHeldFrames(n)` (21 lines; no state shape change — the run's `swim` field is the existing one).
- Fixtures: `lights-witness/lights-solve-spear-portfolio.json`, `hold-seam-witness/l15-hold-seam.json`. Tests:
  `fidelityLights.test.js` (+2), `fidelityLights.slow.test.js` (+2), `fidelityHoldSeam.test.js` (new, 7).
- Records: surface + constants census `--write`; `seedling-bot-log.md` entry; `seedling-bot.md` (the `lights` verb, the
  swim pin's held frames); reference (docsIndex + README index) regenerated.

## What the brief got wrong (measured)

- D-A "fix the forecast so ON finds ≤ 361 t": the forecast was right at every played plan in both arms; the 133 t is the
  greedy's tie order and the fight's chaos in it (perturbation table). ON's greedy is not worse on average than OFF's
  would be; the 494 t was one bad draw. (The forecast DID carry a fault — the spear's dash timer — but the greedy never
  read it; only the rollout did.)
- D-B "suspects: the chest's post-open state/solid, or the walk's starting sub-pixel": in AP play there is no chest (an
  `apitem` stands there), and the walk's start is exact. The divergence is the hold's frames on the swim channel; one
  continuous tape reproduces at 0 px.
- D-B "record … the walk alone from the chest state": a fresh page cannot start mid-water with a running swim channel;
  the faithful witness is the chest leg + a hold + the shipped continuation on one page, which is what was recorded.
- "Movers … keyed sweep (L15 legs)": no L15 sweep leg plays the post-chest continuation.

## Residue

- The live hold's frame count is unknown (≥ 2 by the signature; the recorded hold was 10 at 300 ms). The JS arc's wiring
  will measure it per seam.
- The portfolio runs two full rollouts; with the prunes it still costs less than today's greedy. A third tie order
  would cost a third; not tried. The prunes ride the key — OFF keeps today's (slower) search byte for byte.
- The portfolio's rollout carries `prevPrimary: false` at each decision, as the greedy's forecast assumes — the live check
  guards any plan that starts with a held press.

## Byte-inertia

OFF / uncalled: the identity block base = head on every row; the bounded vitest 5,494 → 5,503 (+9 new rows), 0 red; the
committed Lights tapes replay and re-solve unchanged with the key OFF (slow rows `lights-solve-sword`, `-spear-on`,
`-spear` green); no producer `--check` moved.

## Rows to BANK

- `fidelityHoldSeam.test.js` (7) and `fidelityLights.test.js` / `.slow.test.js` (+2 / +2).
- The identity values above (unmoved).
- Surface 345 rows; constants 6,900 literals.
- The perturbation table (D-A) as the reference distribution for any future Lights search change.
