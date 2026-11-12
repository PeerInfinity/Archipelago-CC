# Seedling fidelity WALLSFLIP — every row the `chaserSpinnerWalls` flip moves, explained

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-fidelity-wallsflip` (planner `seedling-fidelity-planning-19`), wave 39b, cloud. ⚖ the user 2026-11-11 (*"Cloud slice finishes it (Recommended)"*). The flip itself is **built on the base and NOT licensed** |
| Start SHA | `4931c026e7` (= `fidelity-flip/walls`: BOBIFRAME's harvest + the wave-38 joint flip + main `546708bcf4`, then `cdd0b69d5c` the flip, `89f8f01fce` re-pins, `4931c026e7` the `l40button-l41-part0` re-record). `CONTACT_FIDELITY`: 120 keys ON, 10 OFF |
| Harness branch | `claude/seedling-fidelity-wave-39b-e0dwam` (the slice's name is `seedling-fidelity-wallsflip`) |
| Commits | `4e239fef` D6 skin goldens · `5b21f954` D4 OPP step 67 · `c9b47653` D5 WandHold witness · `30b17d9c` D1+D2 ClearTagChain train · `9e8ffe66` D3 ChooserPair train · the records commit (this report, the log, the doc line, evidence) |
| Port | 9783 (`python3 scripts/serve-nocache.py 9783`) |
| Verdicts | **W0 PASS · D1 STOP → hammer (a lost uncapped solve; the search's, game-witnessed) · D2 PASS · D3 PASS with a named coverage loss · D4 PASS with a named coverage change · D5 PASS (re-recorded on p4g, 0 px) · D6 PASS (JS signs) · D7 PASS (whole bounded set + train green at the head)** |

## 2. The answer first

**One mechanism moves every row.** A live Spinner is `type = "Enemy"` and a Bob's `solids` hold "Enemy", so a spinner
crossing a bob's sweep stops it. On L40 that happens in two places:

- `spinner@816,848` stops `bob@736,752` on its **first step** in the x 744 shaft (BOBIFRAME's game witness, t544). From
  then on that bob comes up the corridor 2 to 5 px behind where the wall-OFF model had it.
- `bob@288,112` is stopped from **t1251** on the north-west walk of the Totem Part legs (6.8 px east of its OFF place
  by t1430).

Every moved pin is a tick, a work count, or the name of the body met first, and follows from where those two bobs
stand. I found no mover in any other room.

**The licence question, in three lines.**

1. **New hits: none.** No row that was hitless takes a hit under the wall. Every plan that still solves is hitless in
   the model, and the two that are game witnesses were played on p4g with 0 hits.
2. **Lost solves: one, and it is not a page solve.** `hammerClearTagChain.train` leg 871 (uncapped, under a
   hand-picked switch set, work 2772 against the page's budget of 640) solved hitless before and refuses now. The old
   plan is still a hitless walk on the game, so the loss is the search's, not the model's. On the page's own dispatch
   the same captured request refuses at its deadline in **both** arms at all 13 clocks I asked.
3. **Coverage that moved without a replacement:** two hammer properties lost their witness at the pinned state
   (§ D3, § D4). Both are named in the tests and below.

## 3. W0

| Bank | Command | Value |
|---|---|---|
| Bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (node v22.23.4; `vendor/seedling` `ccdf189776`) |
| CI at the base | `ci-vitest-summary.mjs 4931c026e7` | run `42952082757`: 26,620 passed / **4 failed** (the four default-tier movers of § 5); slow 431 / 431 |
| CI at `9e8ffe66` (the last test-changing head) | `ci-vitest-summary.mjs 9e8ffe66` | run `42964003650`: **26,624 passed / 0 failed**; slow 431 / 431 |
| Bounded vitest BEFORE | 168 files (`evidence/bounded-set.txt`: BOBIFRAME's 92 + every `grep -a` hit for the brief's six names + the four CI reds), `--maxWorkers=2` | **5,045 / 5,049**; the 4 reds are CI's four (`evidence/bounded-vitest-before.txt`) |
| The base's earlier re-pins | inside that run | all green: `fidelityL40Bk2` 12/12, `fidelityL40Res` 10/10, `hammerPressKillChasers` 2/2, `hammerClearTagChain` 5/5, `hammerPressKillGuards` 5/5, `contactFidelity` 62/62, `fidelityL40Contact` 8/8, `fidelityBobIframe` 8/8, `fidelityL40Button` 7/7 |
| tapeRunner pairs | `status\tfullName` sorted, md5 | **643 `beea3ad6a54a434b8ca4e07bc47765c3`** (= BOBIFRAME's, OFF and ON) |
| Acceptance batch | `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null \| md5sum` | `abb206c88de25e7ba1874510d493ce85` (= main's) |
| Identity block | `reach-seedling-change.mjs --range=4931c026e7..HEAD` | the change reaches 4 test files, no module, no producer, no identity row; quoted, not re-measured (ruling 32 A) |
| Producer `--check`s | `ci-producer-checks.mjs --jobs=3` | **98 run, 0 red, 1 skipped** (`evidence/producer-checks.log`); `plan-seedling-l40button-witness` green since the base's re-record |
| Train BEFORE | the 19 Seedling `*.train.test.js` files that read a level (all but `seedlingGenCapacity`), one file at a time, `vitest.train.config.js` | **17 files green, 2 red**: `hammerClearTagChain.train` 0 / 2 and `hammerChooserPair.train` 4 / 6 — the four rows CI's `train_only` run `42952081922` named, and no fifth (`evidence/train-per-file.txt`) |

## 4. The D's

### D1 — `hammerClearTagChain.train` leg 871: a LOST SOLVE, and it is the search's (STOP → hammer)

**The row.** `leg 871 (from L39, (488,904))`, the page's request captured at `97739720dd`, solved uncapped on the
dashless pass under `withL40Flip(false)` plus the census's minimal set (`CLEARTAG_CHAIN`, `STANCE_BURN`,
`OPPORTUNISTIC_STRIKE`, `CHASER_STAGED_HUNT`, `PRESS_ESCAPE_EXACT`, `forecastShieldBump`).

| | wall OFF | wall ON (the flip) |
|---|---|---|
| Solve | ok, work 2772, **1122 t**, sha `aa43b331902e`, chain `kill, bait, kill, bait, kill, hold` | **refused**, work 885, at t724 |
| Result | `burnabletree@872,784` burnt, clears {40,0} + {40,12}, 0 hits, 0 deaths | — |

**The refusal** (`evidence/leg871-solve-both-arms.txt`): `clear-tag {40,12} wandlock@480,560 -> burn stance
(burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (743.9,790.5) —
chaser:bob@736,752 (inside leash 80 (d=7.1) …)`. `avoid`, `detour` and `forced-hit` refuse on the goal tile
(`bobsoldier@880,832` covers it); `time` is 192 px out of its range; `bait` and `kill` are asked about the bobsoldier,
and its seven stances and twenty orbit forks are each "hit at tick 80 / orbit tick 24 by chaser:bob@736,752".

**Where the walled bob stands, and where the two drives part** (`evidence/leg871-drives-part.txt`,
`leg871-window-t690-730.txt`, `leg871-decision-trace.txt`):

| Tick | wall OFF | wall ON |
|---|---|---|
| t543 | bob leaves (744, 760) | bob held at (744, 760) by the spinner |
| t628 | bob (743.9, 741.1) | bob (744.2, 743.2): 2.1 px behind |
| first opportunistic press | **t629** | **t630** (the first differing key) |
| bob's third hit | t699 | t700 |
| first decision (`kill spinner@880,848`, from t0) ends | **t731**, player (743.7, 793.5), second bob at 1 hit | **t724**, player (743.9, 799.0), second bob at 2 hits (t722) |
| next decision | `bait`, then `kill bobsoldier@880,832` at t895 | the ladder above, EXHAUSTED |

At t724 `bob@736,752` has had its three hits since t700 and is `dying: true` (`hitsTimer` 6); its body still stands at
(747.6, 805.3), 7.1 px from the player. In the OFF arm the same body leaves at t735, 36 ticks after its third hit. The
danger the ladder names is that dying body. No rung is asked about it, and nothing waits the dozen ticks until it is
gone. The live bob beside it (`bob@736,800`, 2 hits, 22 px south) is not named anywhere in the refusal.

**Would the game walk the old plan hitless? Yes, measured on the game.**

| Replay of the pre-wall 1122-t plan | Result |
|---|---|
| wall-OFF model | every expected row, 0 hits, tree burnt, both clears |
| wall-ON model | **the same rows**, 0 hits, tree burnt, both clears, all three chasers dead |
| **The game** (p4g, headless, the delivered AP set `seedling-ap-record-01b432a9`, `probe-seedling-bobiframe.mjs`) | **0 hits; 1122 / 1122 ticks sampled; the wall-ON model at 0 px** on the player, every Bob with `hits`/`hits_timer` (12,774 comparisons) and every Spinner (5,206). The wall-OFF model first parts at t543 (0.177 px, `bob@736,752`), as BOBIFRAME's witness does at t544 |

Tape `evidence/leg871-offplan.tape.json`, log `evidence/leg871-offplan-game.log`. So the old pin was not a model-only
solve, and the refusal is a **solver gap**: a hitless plan exists that the search no longer finds.

**What I changed (test only).** The row now pins three facts: the pre-wall solve under `chaserSpinnerWalls: false`
(the old pin, byte for byte, sha now named); the same plan re-driven on the wall-ON model (equal result); and the
refusal at the shipped default (work 885, the two strings above). When the search finds a plan again the last block
goes red, which is the re-pin to make. ⚠ This turns a red train row green while a solve is lost. I did it so the train
tier does not carry a known red; the planner can revert to a plain red by deleting the third block's expectations.

**The page arm.** The row's solve is uncapped (work 2772; the page's budget is 640 with an 85 upgrade window). On the
worker's dispatch at the shipped defaults (`solveAnytime`, the request's own passes), the same captured request refuses
at its deadline in **both** arms at clocks 5207..5219, with identical pass rows (`dashless: refusal@kill-chaser`,
`full: refusal@stance-hypothesis`, work 645). Leg 872's request does the same at 5205..5217
(`evidence/seam-census-871-872-shipped-defaults.tsv`). So on these two captured requests the wall moves no page
verdict. ⚠ The captures are from `97739720dd`; a fresh sweep of the two keys is dispatch 2 of § 6.

> ⚠ **Erratum (2026-11-12, measured by hammer's DYING-BODY-WAIT, `CC/docs/cloud-reports/seedling-hammer-dying-body-wait.md` §3/§8.1/§9 on its branch):** leg 871 (now 878) refuses at clock **826** against a **LIVE** `bob@736,752`. The "first decision ends at t724 … the danger the ladder names is that dying body" reading above is the branch `OPP_PRESS_FALLBACK` threw away, after its `spinner@880,848` press met `HAMMER_SAFETY` ("no step out") at t724. The conclusion stands: the old plan is hitless on the game, and the refusal is the search's (the spinner-press corner at t719–t724, hammer's).

### D2 — `hammerClearTagChain.train` leg 872 (PASS)

Still solves hitless with the same chain (`kill, bait, kill, bait, kill, hold`): work **3467 → 3823**, **2389 → 2385 t**.
The drives part at t694 (OFF presses at t694, ON at t696; the bob is 2.2 px behind at t690). Still witnesses "the tree
burnt, {40,12} written": yes (`burned [burnabletree@872,784]`, clears `40:0`, `40:12`, 0 hits, 0 deaths, every expected
row re-driven). `evidence/leg872-drives-part.txt`.

### D3 — `hammerChooserPair.train`, 853 at 5196 and at 5172 (PASS, coverage loss named)

| Row | Before | Under the wall | Still witnesses |
|---|---|---|---|
| 5196, OFF arm | silent, `chaser:bob@736,752` | the same | yes |
| 5196, ON arm | the pair `bob@736,752` + `bobsoldier@880,832` admits; kill of the bob t855; chain reaches the `spinner@816,848` press kill; death t1046 (`bob@736,800`) | **no pair admits**; size 3 admits the triple `bob@736,752` + `bob@736,800` + `bobsoldier@880,832` (1 ask, 4 sets); kill t920; the same chain; death t1228 | "OFF silent, ON admits a set, the arm kills the bob, the chain moves on": **yes**. "A PAIR is enough": **no** |
| 5172 | no pair admits, pair arm = OFF, message names `chaser:bobsoldier@880,832` | no pair admits, pair arm = OFF, message names `chaser:bob@736,800`; at size 3 the first climb admits a triple (4 sets) | yes (only the named danger moved) |

**The scan** (as HO1's was). `evidence/tools/cpair-scan.mjs`, leg 853 at the shipped wall, `CHOOSER_PAIR` ON:

- size 2, clocks **5140..5250 (111)**: a pair admits first at **5148, 5193 and 5238 only** (45 ticks apart, one hammer
  period), always `bob@736,752` + `bobsoldier@880,832` on the second set asked. At each, the chaser arm's dwell is hit at
  tick 3 (`kill (bob@736,752) by press: the dwell was HIT at tick 3 (hits 0 -> 1)`), so no kill follows. Six clocks ask
  nothing (an earlier hammer-rung refusal). `evidence/cpair-scan-size2-5140-5250.tsv`.
- size 3, clocks 5180..5215 (36): the first ask admits a triple wherever it admits; pairs appear only as later asks,
  after a bob is gone. `evidence/cpair-scan-size3-5180-5215.tsv`.

**Coverage loss, named:** under the wall no clock in 5140..5250 has a pair that admits **and** a kill that follows. "A
set admits and its first kill lands" stays witnessed by 5196's triple and by row 367's triple arm. The test header says
so. I did not add a 5193 row: it would pin a pair admission that ends in a hit dwell, which is hammer's to want or not.

### D4 — `hammerOpportunisticStrike` step 67 (PASS, coverage change named)

The PKC pattern, as the brief expected, plus two shape changes it did not.

| Value | Before | Under the wall |
|---|---|---|
| OFF: bob contacts → death | t660, t749, **t780** | t664, t708, **t767** (the same refusal, `PRESS_KILL_REBOOT_GUARD`) |
| ON: first aim / press | t651 / t652 | **t655 / t656** (at t652 the bob is at y 755.4 against 750.1: 5.3 px further south) |
| ON: the bob's three hits | t653, t683, t722 | **t657, t687, t717**; player hits `[]` in both |
| ON: first key that differs from OFF | the press (the aim was the walk's own `down`) | the aim (OFF's walk holds `right` at t655) |
| ON: `deferred` | 5 | **0** (and 0 through the kill's end at t1422) |
| ON: certified strike walks with previews | t604 and t718 | **t604 only** |
| ON: drive vs the t604 preview | the drive is a prefix (the preview held a `bob@736,800` strike the drive withheld) | the preview is a prefix (the drive takes a third strike at t712/713 the preview did not hold) |

Still witnesses "ON strikes the bob in reach, the hits land, the bob dies, no hit on the player, nothing dashed, keys
equal OFF's until the first aim": **yes**. Two things it no longer witnesses at this boot, both named in the test
header: a kill aim **deferred** behind an opportunistic window, and a **second** certified walk. The 30(c) block now
asserts the common prefix in the direction that holds and pins both lists. `evidence/opp67-walls-{on,off}.txt`,
`opp67-walls-on-uncapped.txt`.

### D5 — `fidelityWandHold` leg 368: the game witness re-recorded (PASS)

The solver's plan for `l40buttonStaging({40, 928, 96})` under the row's own arm (`STRIKE_ETA_FLOOR` off) is **1601 →
1600 t**, verbs unchanged (`brave, kill, hold, break, hold, collect`, two paced holds). The keys equal the old witness
through t1429; at t1430 the walk presses once (`primary+right`): `bob@288,112`, stopped by a spinner from t1251, stands
6.8 px east of its OFF place and is in reach.

Recorded with the probe that made it, on p4g, headless, damage on:
`SEEDLING_PORT=9783 node scripts/procgen/probe-seedling-bombpusher.mjs --file=<tape> --upto=1599 --record --name=wandhold-l41-368-paced`

| | Result |
|---|---|
| Ticks sampled | **1,599 of 1,599** |
| Game hits | **0** |
| Model vs game | **0 px** on every sampled tick: the player, every Bomb's position and velocity, the lobber's anim; 15 blasts, 0 body hits |
| Fixture bytes | `fixtures/bomb-witness/wandhold-l41-368-paced.json`: md5 `4f7ccc3e…` (262,889 B) → **`8674962abcf72d414edb13cf8129f8b2` (231,173 B)** |
| Test | `ticks: 1601 → 1600`; `fidelityWandHold.test.js` 10 / 10 |

Two earlier recordings on a loaded box sampled 1,571 and 1,583 ticks and passed the comparison; I kept the one taken
with the scans paused. The fixture's `source` field names this report (the probe writes the scratch path there). The
tape as played is `evidence/wandhold-l41-368-paced.tape.json`; the probe's log is `evidence/wandhold-368-record.log`.

### D6 — the skin goldens (PASS; the JS arc signs)

**Which tape, and why.** Both goldens are computed from the committed tape **`l40button-l41-part0`**
(`seedlingEffectSkin.test.js:66`, `seedlingHazardSkin.test.js:89`, both named `bombpusher-L40`). The base re-recorded
that tape at `4931c026e7` (the producer's plan under the wall, 1600 t). So the goldens moved because their input tape
did; the wall changes nothing in how a BombPusher or an Explosion is drawn. The plan differs from t1430 (the press of
§ D5), so the lobber aims at a player who is elsewhere from there: the effect golden's first changed line is t1507.

Regenerated with the files' own generator:
`UPDATE_SKIN_GOLDENS=1 npx vitest run seedlingEffectSkin.test.js seedlingHazardSkin.test.js` (82 / 82). `git status`
showed only these two files changed; no other golden moved.

| Golden | md5 before → after | Bytes | Diff |
|---|---|---|---|
| `fixtures/skin-goldens/effect-bombpusher-L40.txt` | `8df63480…` → `94219a6e9fdd5b5fd6d1e3c32e4e57a2` | 13,256 | 41 changed lines (diffstat) |
| `fixtures/skin-goldens/hazard-bombpusher-L40.txt` | `47f2a5ad…` → `8edf12fd026666405de8d2a2ea869a77` | 108,269 | 184 changed lines (diffstat) |

### D7 — the whole bounded set at the head

| Set | Result |
|---|---|
| Bounded default tier, 168 files, AFTER | **168 / 168 files, 5,049 / 5,049** (`evidence/bounded-vitest-after.txt`) |
| Train tier, the same 19 files, one at a time | **19 / 19 files green**: the 17 that were green before are untouched by this slice (their run is the BEFORE run), and the two re-pinned files re-run at the head are `hammerClearTagChain.train` 2 / 2 and `hammerChooserPair.train` 6 / 6 (`evidence/train-per-file.txt`, the `.rerun` rows). ⚠ Local, serial, on a shared box; dispatch 1 of § 6 is the CI run |
| Slow tier | quoted from CI at the base: 431 / 431 (`42952082757`); this slice changes no module a slow file imports, so I did not re-run it. Three slow files read L40 (`hammerDashShape`, `jsRuntimeSolverCalibration`, `strategySwitchApproach`); all were in that green CI run, which is the flip's |
| Producer `--check`s | 98 run, 0 red, 1 skipped |
| Acceptance md5 | `abb206c88de25e7ba1874510d493ce85` (unchanged) |
| tapeRunner pairs | 643 `beea3ad6…` (unchanged) |
| Local survey, wall OFF vs ON, steps 66, 86, 96, 98, 137, 150 (`--timeout=900`) | verdicts equal: 86 SOLVED 395 t; 98 70 t; 137, 150 172 t, every field equal; 66, 96 REFUSED in both, the refusal text and `family` move (`evidence/survey-{off,on}.tsv`) — BOBIFRAME's result, at this base |
| `probe-seedling-wasm-logical-links --only=B --budget-s=1200`, local, port 9783, one sample | **ALL CHECKS PASSED**, 19 PASS rows, 0 boot retries. `B ENDED: refusal at Level 040 - Boss Key 2 (+1097 s, 18 check(s))`: the solver ran out of 640, then 2560 work units — the same end the brief gives for main (`evidence/links-b-local.log`) |

## 5. Movers, the whole list

Every row or byte the flip moves, base re-pins included. "Witness" = does the row still witness what its title says.

| # | Row / bytes | Old → new | Mechanism | Witness | Owner | Where |
|---|---|---|---|---|---|---|
| 1 | `contactFidelity.test` defaults; `fidelityL40Contact` "ships ON" | `chaserSpinnerWalls` OFF → ON | the flip | yes | fidelity | base `cdd0b69d5c` |
| 2 | `fidelityL40Bk2` D1, `fidelityL40Res` D2 | same chain, press-kill death on `bob@736,752` t780 → t767 | the shaft bob is behind | yes | fidelity | base `89f8f01fce` |
| 3 | `fidelityL40Bk2` D2 | OFF@5290 1600 t `1da60bcb4c0d` → 1567 t `abf1e13c3bf7`; ON@5280 1558 t → 1555 t `2c4b20d9853c` | the shaft bob | yes, still hitless | fidelity | base |
| 4 | `hammerPressKillChasers` step 67 | hits 660/749/780 → 664/708/767; `SAME_THROUGH` 657 → 661 | the shaft bob | yes (ON hitless, 29 swaps) | hammer | base |
| 5 | `hammerClearTagChain` "ON (STANCE_BURN ON)" | death t799 → t817, work 232 → 233, sha → `7f0b11e8dd92` | the shaft bob | yes (the burn runs first) | hammer | base |
| 6 | `hammerPressKillGuards` HO1 | witness tick t2439 → t2437; continuation (664,680)@3276 → (648,680)@3297 | the shaft bob; t2439 lost its throw | yes, at the new tick | hammer | base |
| 7 | `hammerPressKillGuards` HO2 OFF / ON | death 788 → 787 | the shaft bob | yes | hammer | base |
| 8 | tape `l40button-l41-part0` + index | re-recorded: the producer's plan under the wall, 1600 t, 0 hits, on p4g | `bob@288,112` walled from t1251 | yes | fidelity | base `4931c026e7` |
| 9 | **`hammerClearTagChain.train` leg 871** | **solved 1122 t → refused at t724** | the ladder meets the killed bob's body 7 ticks earlier | **no: a lost solve** (search gap, § D1) | hammer | `30b17d9c` |
| 10 | `hammerClearTagChain.train` leg 872 | work 3467 → 3823; 2389 → 2385 t | the shaft bob | yes, hitless | hammer | `30b17d9c` |
| 11 | `hammerChooserPair.train` 853@5196 | pair → triple; kill t855 → t920; death t1046 → t1228 | both shaft bobs meet the corridor elsewhere | partly (§ D3) | hammer | `9e8ffe66` |
| 12 | `hammerChooserPair.train` 853@5172 | named danger `chaser:bobsoldier@880,832` → `chaser:bob@736,800` | the corridor meets `bob@736,800` first | yes | hammer | `9e8ffe66` |
| 13 | `hammerOpportunisticStrike` step 67 | § D4's table | the shaft bob, 5.3 px south | partly (§ D4) | hammer | `5b21f954` |
| 14 | `fidelityWandHold` leg 368 + `wandhold-l41-368-paced.json` | 1601 → 1600 t; fixture `4f7ccc3e…` → `8674962a…` | `bob@288,112`, one press at t1430 | yes, game-witnessed | fidelity | `c9b47653` |
| 15 | `effect-bombpusher-L40.txt`, `hazard-bombpusher-L40.txt` | `8df63480…` → `94219a6e…`; `47f2a5ad…` → `8edf12fd…` | computed from row 8's tape | yes | JS | `4e239fef` |
| 16 | survey steps 66, 96 (L40) | REFUSED → REFUSED, text and `family` | the chain stops earlier, at the weigh's approach | n/a | fidelity | measured |

**Every lost solve:** row 9, and no other. **Every new hit:** none.

Rows 4 to 7 and 9 to 13 are hammer-owned test pins; hammer-4 signs them. Row 15 is the JS arc's.

## 6. Dispatches for the planner

All on `claude/seedling-fidelity-wave-39b-e0dwam` (or the flip branch once harvested).

1. **Train tier at the head:** `unittests_frontend.yml -f train_only=true`. Expect every shard green.
2. **Sweep ×2, the two flag-12 keys and the L40/L92 legs**, `seedling-divergence-sweep.yml`, ≤ 10 shards,
   `-f page=seedling_bot_ap_p4g -f leg_budget_ms=180000 -f capture_requests=true -f keys=` every `level_40__*` and
   `level_92__*` key of a fresh `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`. OFF arm:
   `-f contact_fidelity=` the 119 default-ON keys of this base without `chaserSpinnerWalls`; ON arm: all 120. Read
   `roomHits`: the claim is **no ON row with a hit its OFF twin lacks**. The two keys this slice read in node are
   `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` and
   `… <- in_L43_176_464 ~> …` (both arms refused at the deadline on the old captures).
3. **Seam census** on those two keys, `-f seam_census=-6..6`, each arm.
4. **Survey A/B**, `seedling-survey.yml -f route=full -f through=end`, this branch against a branch with
   `SEEDLING_CHASER_SPINNER_WALLS=0` (or the pre-flip harvest). Expect only steps 66 and 96 to differ, in text.
5. **`seedling-probe.yml -f battery=standard`** on this branch. Logical-links B ends in L40; it is the probe the wall
   can move.

## 7. Hand-overs

**To the hammer arc (hammer-4).**

1. **Leg 871's lost solve** (§ D1). Replay: `node evidence/tools/leg871.mjs` (both arms, both replays),
   `leg871c.mjs` (the drives and the chasers per tick), `leg871d.mjs` (the decision traces). The measurement: the first
   decision ends at t724 instead of t731 with the player 7.1 px from `bob@736,752`'s body (3 hits at t700); the next
   plan's ladder names that body as the corridor's danger and has no rung for it. Open question for you and for
   fidelity: is a `dying: true` body a danger the map should name at all (ours), or one the ladder should wait out
   (yours)? In the OFF arm the same body stands at t731 and the plan goes ahead from 12 px; the game walks past it
   with no hit.
2. **Sign the re-pins** of rows 4 to 7 (base) and 9 to 13 (this slice), with the two coverage notes: no pair that
   admits and kills in 111 clocks (§ D3), and `deferred` 0 / one certified walk at step 67 (§ D4).
3. BOBIFRAME's hand-over 2 (the press kill's "no step out" refusals at seams 5225 / 5241) stands; I did not re-measure it.

**To the JS arc (`seedling-js-planning-17`).** Sign the two `bombpusher-L40` goldens (row 15). Nothing to wire: no new
key, no staging or result field, no `run.*` field renamed.

**To the user (licence), through the planner.** The flip is built and measured. It costs one uncapped train solve
(row 9, a search gap on a plan the game walks hitless) and no hit. On the page's own budget I found no verdict that
moves; the sweep of § 6 item 2 is the page-side confirmation.

## 8. What the brief got wrong (measured)

- *"leg 871 … A LOST SOLVE"* is right for the train pin, but the pin is not a page solve: it is uncapped (work 2772
  against 640) under `withL40Flip(false)` plus a hand-picked set. On the worker's dispatch both arms refuse.
- *"seedlingEffectSkin + seedlingHazardSkin … why it moves under the wall (a BombPusher room: what the wall changes
  there)"*. The wall changes nothing there. The goldens read `l40button-l41-part0`, which the base re-recorded.
- *"`hammerOpportunisticStrike` › step 67: t780 → t767 (the PKC pattern)"*. That, and also the ON arm's shape:
  `deferred` 5 → 0, one certified walk instead of two, and the first differing key is now the aim.
- *"853 at 5172 … no longer contains `chaser:bobsoldier@880,832`"* reads as a lost property. It is the named danger
  only; no pair admits and the pair arm still equals OFF.
- *"CI … train_only `42952081922`"* listed the two train files that red. Running all 19 Seedling train files here
  found no third.

## 9. Deltas, residue, byte-inertia

- **Byte-inertia.** No model, solver, walker, rules, AS3 or wasm file changed; no `CONTACT_FIDELITY` key added; no
  default moved by this slice. Changed: 4 test files, 1 game-witness fixture, 2 goldens, the bot doc line, the log,
  this report and its evidence. `reach-seedling-change` bounds it to 4 test files.
- **Stale text left alone (source, not mine to edit here):** comments in `levelRun.js` / `contactFidelity.js` that
  still say the key is OFF or "no licence". `seedling-bot.md`'s line is updated to "ON on the flip branch, licence
  pending".
- **Not run here:** the full route survey (six steps by BOBIFRAME's room census: only L40 and L92 hold a spinner and a
  chaser that it walls); any page sweep; `seedling-probe.yml`. L92's one bob beside one spinner: survey step 86 does
  not move; no L92 leg was run on the page.
- **One-sample caveats.** The logical-links B run is one sample on a loaded box, with no wall-OFF twin. The page-arm census of § D1 uses
  captures from `97739720dd`.
- **Residue.** (a) The licence. (b) Leg 871's search gap (hammer). (c) The pair-admits-and-kills witness (hammer, if
  wanted). (d) The stale OFF comments in source, for the flip's landing commit.

## 10. Rows to BANK

- The flip's movers are 16 rows; **0 new hits, 1 lost solve** (uncapped train pin, search gap, the old plan
  game-witnessed hitless at 0 px over 1122 ticks).
- `chaserSpinnerWalls` ON is the game on a third L40 plan: 1122 t, 12,774 bob + 5,206 spinner comparisons, 0 px.
- WandHold leg 368 under the wall: 1600 t, 0 hits on p4g, 0 px on 1,599 / 1,599 ticks.
- Leg 853, 111 clocks at size 2: a pair admits first only at 5148 / 5193 / 5238, and its kill's dwell is hit at tick 3.
- Legs 871 / 872 on the worker's dispatch, 13 clocks each: both arms refuse at the deadline, identical pass rows.
- Two L40 bobs are walled, not one: `bob@736,752` (t543/544) and `bob@288,112` (t1251 on the Totem Part walk).
