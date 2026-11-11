# Seedling fidelity BOBIFRAME — L40's `bob@736,752` at t930: a spinner walls the bob; the lapse is the game's

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-fidelity-bobiframe` (planner `seedling-fidelity-planning-19`), wave 39, cloud. ⚖ the user's GO 2026-11-10 (*"Bob + BreakableRock now (Recommended)"*) |
| Start SHA | `a4f57f8c53` (= `origin/main` at launch; 117 default-ON keys of 128) |
| Harness branch | `claude/seedling-fidelity-wave-39-anh0tg` (the slice's name is `seedling-fidelity-bobiframe`; the harness pushes to its own branch) |
| Commits | `5a7381d2` (D0 witness: probe, fixtures, test, registries) · the records commit (this report, the log, the doc line, evidence) |
| Port | 9781 (`python3 scripts/serve-nocache.py 9781`) |
| Verdicts | **W0 PASS · D0 PASS (the game answers; neither candidate as worded) · D1 STOP by design (no new key: the fix exists, OFF) · D2 MEASURED (`chaserSpinnerWalls` ON; nothing flipped) → licence + hammer** |

## 2. The answer first

**The model's third hit at t930 is not the swing's last test tick and not the i-frame lapse. A spinner walls the bob.**

- On the game, `spinner@816,848` crosses `bob@736,752`'s box on the bob's **first step (t544)**. A Spinner is
  `type = "Enemy"` (`Enemy.as:58`); `Bob.solids` hold "Enemy" (`Bob.as:39`); `Mobile.moveX/moveY` stop the bob.
- From t544 the game's bob stands elsewhere than the model's. Its hit 1 lands at **t874** (model t867), hit 2 at **t906**
  (model t900). The swing pressed at t925 runs its **five** tests at t926..t930 (the game's own counter), and each meets
  `hits_timer` **10, 9, 8, 7, 6**. The bob lives, and touches the player at t936.
- The model already has this wall: `CONTACT_FIDELITY.chaserSpinnerWalls` (L40CONTACT D1, wave 17), **OFF by default**
  ("no licence"). With it ON, the unchanged 1226-t plan replays as the game at **0 px over all 1226 ticks**: the player,
  every Bob's position, velocity, `hits` and `hits_timer` (14,522 comparisons), every Spinner (5,742), and the three
  player hits at t936, t977 and the lethal t1064.
- With the key ON the solver's own plan for the same request (1222 t) **plays hitless on the game**, at 0 px.

So the brief's D1 (a new key refining `strikeIframeLapse`) has nothing to refine, and I added none. What this slice
ships is the game witness and its test, byte-inert. What it measures is the flip of the existing key.

| | OFF (shipped) | `chaserSpinnerWalls` ON |
|---|---|---|
| Leg `Chest ← L39`, 14 arrival clocks, node replay of the captured request | **9 hit-taking plans** (6 lethal), 4 clean, 1 refused | **12 clean, 2 refused, 0 hit-taking** |
| Same, played on the game (p4g) | 5222: hits t936/t977/t1064 (death). 5247: hit t824 | 5222: **0 hits**, 0 px. 5247: **0 hits**, 0 px |
| Clean under OFF, refused under ON | — | **none** |

## 3. W0

| Bank | Command | Value |
|---|---|---|
| Bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (node v22.23.4; `vendor/seedling` `ccdf189776`) |
| Legs at this base | `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` | 933 legs. ⚠ re-keyed: `…Level 040 - Chest` ← L39 is id **397** (was 394); `…flag 12` ← L39 is **875** (was 871) |
| Leg 397 on the page, defaults | `probe-seedling-divergence-sweep.mjs --ids=397 --leg-budget-ms=180000 --capture-requests=…` | seam **5247**: solved `bait, kill` 1051 t → **diverged t824**, a hit at (743.681, 764.807) → refused. `evidence/page-default-397.jsonl` |
| Leg 875 on the page, defaults | same, `--ids=875` | seam 5258: **done** (one sample) |
| Node = page | the worker's dispatch on the captured request (`evidence/tools/near.mjs`) | seam 5247: 1051 t, work 1329. Seam **5222** (the brief's): **1226 t, work 1525, full pass at `sword-dash`** — the brief's numbers exactly |
| Model, t860–t940 | replay of that plan | `bob@736,752` hits 1 @t867, 2 @t900, **3 @t930** (`hitsTimer` 1 at t929); no player hit. As the brief says |
| Bounded vitest BEFORE | 92 files (`evidence/bounded-set.txt`) | **2,123 / 2,123** |
| Train BEFORE | `fidelityL40Bk2.train`, `fidelityL40Latch.train` (`vitest.train.config.js`) | **3 / 3** |
| tapeRunner pairs | `status\tfullName` sorted, md5 | **643 `beea3ad6a54a434b8ca4e07bc47765c3`** |
| Acceptance batch | `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null \| md5sum` | `abb206c88de25e7ba1874510d493ce85` (= main's) |
| Identity block | `reach-seedling-change.mjs --range=a4f57f8c53..HEAD` | the change reaches 4 test files and no producer or identity row; quoted, not re-measured (ruling 32 A) |
| Six producer `--check`s, gates | CI at `5a7381d2` | `Producer --checks` green; every gate shard `Expected reds only?` green |

**Where the model decides hit 3.** `levelRun.js` `applyThrust`'s chaser arm calls `enemyDamage.enemyHit` (gate 1:
`hitsTimer <= 0 || hitByDarkStuff`); `presses.swordWindowStep` fires the pending thrust at T+1 and four repeats
(`SLASH_HIT_TICKS` 5); `stepChasersNow` runs the i-frame down once per body update.

**The AS3** (`vendor/seedling/src/`):

- `Enemies/Enemy.as:141–181` `hit()`: `if ((hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit)` …
  `hits += d; hitsTimer = hitsTimerMax` (30).
- `Enemy.as:62–118` `update()`: off-screen return, then `super.update()` (the move), then `hitUpdate(); hitPlayer();`.
  `hitUpdate` (`:223–245`) is `hitsTimer--`. `hitPlayer` (`:211–221`) needs `hitsTimer <= 0`.
- `Player.as:892–929` `slash()`: `slashDelayMax` is 0, so the rect test runs on every tick `slashing` is up; a plain
  swing is five ticks (T+1..T+5).
- `Mobile.as:86–118` `moveX/moveY`: each sub-step asks `collideTypes(solids, …)`; `Enemies/Bob.as:39`
  `solids.push("Enemy")`; `Enemies/Spinner.as:29–45` is an `Enemy` with a 7×7 box, `activeOffScreen`.

The swing, the lapse and the update order are transcribed correctly. The code supports **candidate 2 (bob state)**, in
a form the hand-over did not name: the bob's position, through a wall.

## 4. D0 — the game witness (PASS)

**Instrument.** `scripts/procgen/probe-seedling-bobiframe.mjs` (new; box lock, kind `browser`). It plays each tape of
`fixtures/bobiframe-witness/` on p4g (headless logic-only) on the **delivered AP record set** (`l25Sets(…).delivered`,
`seedling-ap-record-01b432a9`, equal room for room to the page's dump), polls `botMobiles()` + `botStatus()`, keeps the
last poll before each tick advanced, and compares with the model's replay OFF and ON.

**Result** (`evidence/probe-record.log`, `evidence/d0-game-vs-model-t860-940.txt`):

| Tape | Game hits | Model OFF vs game | Model ON vs game |
|---|---|---|---|
| `l40-chest-l39-s5222-default` (1226 t) | **t936, t977, t1064 (death)** | first Bob parting **t544** (0.177 px); player parts **t936**; model bills no hit | **0 px on every tick**; hits t936/t977/t1064 |
| `l40-chest-l39-s5222-walls` (1222 t, the ON plan) | **none** | first Bob parting t544; player never parts (the plan is hitless in both) | **0 px on every tick**; no hit |

The window the brief asked for, every tick t860–t940, is `evidence/d0-game-vs-model-t860-940.txt`. The rows that decide it:

| Tick | Game `bob@736,752` | Model OFF | Model ON |
|---|---|---|---|
| t544 | (744, 760), did not move; `spinner@816,848` at (744.80, 755.59) | (743.82, 759.82) | (744, 760) |
| hit 1 | **t874** | t867 | t874 |
| hit 2 | **t906** | t900 | t906 |
| t926–t930 (the t925 swing's tests; the game counts **5**) | `hits` 2, `hits_timer` **10, 9, 8, 7, 6** | timer 4, 3, 2, 1, then **hit 3 at t930** | 10, 9, 8, 7, 6: refused |
| t936 | player hit, (745.859, 786.567), `hits_timer` 19 | no hit, (744.382, 788.668) | hit, (745.859, 786.567) |
| hit 3 | **t946** (the next swing) | t930 | t946 |

**First tick where game and model differ, and why:** t544. The model (OFF) lets the bob take its first chase step; the
game's `moveX`/`moveY` meet the Spinner's box and the bob stays at (744, 760).

**The brief's STOP clause.** D0 was to stop if "the model is right and the bob is a different body". It is the same
body in a different place, and the model that puts it there exists behind an OFF key. I treated that as the STOP for D1
and carried on with the measurement of that key.

**A second sample.** My own page run at seam 5247 (hit at t824) is the same wall: OFF first Bob parting t545, player
t824; ON 0 px over 1051 ticks with the hit at t824. Not committed (one fixture per claim); the tapes are reproducible
from `evidence/captured-request-397-seam5247.jsonl.gz` with `evidence/tools/mktape.mjs`.

## 5. D1 — STOP by design: no new key

Nothing in `strikeIframeLapse`, `SLASH_HIT_TICKS` or `hitsTimer` needs a refinement, so no key was appended to
`CONTACT_FIDELITY_DEFAULTS`, no env line added, and `SOLVER_ENV_NAMES` is untouched. Committed instead (`5a7381d2`):

- `scripts/procgen/probe-seedling-bobiframe.mjs` (`--record`, `--only=`, `--host=`).
- `frontend/modules/seedlingDemo/fixtures/bobiframe-witness/`: two tapes and the game's rows (player every tick; the two
  shaft bobs and `spinner@816,848` from t500).
- `frontend/modules/seedlingDemo/fidelityBobIframe.test.js`, 8 rows, default tier, 0.6 s. They set the key themselves
  (`withContactFidelity`), so they hold under either default.
- `scripts/procgen/boxLock.test.js` (the guarded roster), the generated reference (`instruments.js`, `architecture.md`).

**Rows, predicted first; all 8 passed on the first run.** The fixtures name p4g, the set and every tick · the game's
hits (default t936/t977/t1064; walls none) · the game runs five tests for the t925 swing against `hits_timer` 10..6 ·
the cause on the game (t544: steered, did not move, the spinner's box over its sweep) · ON: 0 px, hits, and the model's
ledger refuses the same five tests · OFF control: parts at t544 by 0.177 px, hit 3 at t930, player parts at t936 · ON
plan: 0 px, no hit · ON plan's OFF control: the bob still parts at t544.

**Mutant** (copy + edit + run + restore; `levelRun.js` restored, tree clean): `chaserSpinnerWallsNow` returns `[]` even
when ON. Predicted 2 reds (both "ON: the model is the game" rows), the game rows and both OFF controls green.
Measured: **exactly those 2**.

## 6. D2 — `chaserSpinnerWalls` ON, measured (nothing flipped)

`SEEDLING_CHASER_SPINNER_WALLS=1` in node; `--contact-fidelity=<117 default-ON keys>,chaserSpinnerWalls` on the page
(`evidence/contact-fidelity-on-arm.txt`, built from this base's defaults).

### 6.1 Where it can move at all

Only a room with a live spinner and a chaser whose `solids` hold "Enemy" (census over `seedling-map.json`): **L40**
(5 spinners; 12 bobs, 2 punchers) and **L92** (1 spinner; 1 bob). L18 and L39 hold spinners and no such chaser.

### 6.2 The leg, over arrival clocks (`evidence/seam-census-397.tsv`, `evidence/tools/seamarms.mjs`)

Each row solves the captured request at that clock OFF and ON, then replays the plan on the ON model (the game's, by
the four recordings of §4) and counts player hits.

| Seam | OFF plan → hits on the game | ON plan → hits |
|---|---|---|
| 5216, 5217 | 1207 t → none | 1165 t → none |
| 5218 – 5223 (six) | 1226 t → **t936, t977, t1064 (death)** | 1222 t → none |
| 5224 | 1285 t → none | 1285 t → none |
| 5225 | REFUSED (press kill on `spinner@880,848`: no step out) | REFUSED (same) |
| 5226 | 1258 t → **t974** | 1302 t → none |
| 5241 | 1097 t → **t814, t890** | **REFUSED** (press kill on `spinner@816,848`: no step out) |
| 5247 | 1051 t → **t824** | 1066 t → none |
| 5258 | 1230 t → none | 1267 t → none |

OFF: 9 hit-taking, 4 clean, 1 refused. ON: 12 clean, 2 refused, 0 hit-taking. ⚖ 2026-11-03 asks that a flip never turn
a hitless leg into a hit-taking one: here none does, and none turns clean → refused.

**On the page, ON arm** (`evidence/page-on-397-875.jsonl`, one sample each): 397 at seam 5241 and 875 at seam 5227
both end `failed` on the solver's refusal above, with **no hit** (`roomHits.max` 0). The 5241 row is the census's.

### 6.3 Movers, key ON

| Set | OFF | ON |
|---|---|---|
| Bounded vitest, 92 files | 2,123 / 2,123 | **2,112 / 2,123, 10 red, 1 skipped** (`evidence/bounded-vitest-off-on.txt`) |
| Train (`fidelityL40Bk2.train`, `fidelityL40Latch.train`) | 3 / 3 | **3 / 3** |
| tapeRunner pairs | 643 `beea3ad6…` | **643 `beea3ad6…`**: no committed roster tape's replay moves |
| Acceptance batch | `abb206c8…` | `abb206c8…` |
| Producer `--check`s (`ci-producer-checks.mjs`) | green (CI) | **1 red of 98**: `plan-seedling-l40button-witness` |
| Local survey, steps 66, 86, 96, 98, 137, 150 | 66, 96 REFUSED; 86 SOLVED 395 t; 98 70 t; 137, 150 172 t | 86, 98, 137, 150 **identical in every field**; 66, 96 REFUSED, text moved |

**The 10 reds** (the skip is L40CONTACT's own "ships OFF" row under the env):

| Row | Owner | What moves |
|---|---|---|
| `contactFidelity.test` › the shipped defaults | fidelity | the env arm; a flip re-pins the default |
| `fidelityL40Bk2.test` › D1 ON: the chain walks the south door's links | fidelity | the refusal text (the `shove stance` link) |
| `fidelityL40Bk2.test` › D2 OFF, seam 5290 (`withL40Flip(false)`) | fidelity | 1600 t `1da60bcb…` → **1567 t** `abf1e13c…` |
| `fidelityL40Bk2.test` › D2 ON, seam 5280 (`withL40Flip(false)`) | fidelity | 1558 t `32f29414…` → **1555 t** `2c4b20d9…`, still hitless |
| `fidelityL40Res.test` › D2 ON: the re-entry passes to the chest | fidelity | the refusal text (the `hold stance (wandlock@448,432)` link) |
| `hammerClearTagChain.test` › ON (`STANCE_BURN` ON): the burn runs first | **hammer** | the expected refusal site |
| `hammerPressKillChasers.test` › step 67 (`withL40Flip(false)`) | **hammer** | the refusal no longer names `kill (spinner@880,848) by press` |
| `hammerPressKillGuards.test` › HO1 at t2439 | **hammer** | band tick 2395 → 2394 |
| `hammerPressKillGuards.test` › HO2 OFF, HO2 ON (`withL40Flip(false)`) | **hammer** | the death tick 788 → 787 (two rows) |

Of the L40 rows that run inside `withL40Flip` (the pre-flip pins), 6 move by their failure stacks: the two
`fidelityL40Bk2` D2 rows, `hammerClearTagChain`'s ON row, `hammerPressKillChasers` step 67 and the two HO2 rows. The three
train rows and every other such row in the 14 default-tier files that call `withL40Flip(false` hold. Hammer-owned pins
are listed, not re-pinned.

**Sword-strike tapes.** No roster tape's replay moves (pairs equal). One committed tape is no longer what its producer
writes: **`l40button-l41-part0`** (the solver's plan changes under ON: `brave, kill, hold, break, hold, collect`, 1600 t,
0 hits in the model). `l40button-l42-part0` stays byte-identical. A flip owes the re-record of `l40button-l41-part0` on
the game.

**Hits per run, every mover.** Game-recorded: default plan 5222 → 3 hits (death); ON plan 5222 → 0; default plan 5247 →
1; ON plan 5247 → 0. Model, ON: `fidelityL40Bk2` D2 ON seam 5280 → `[]`; `l40button-l41-part0` re-solved → 0.

**Survey steps 66 and 96** (L40 Boss Key 2 / Totem Part, REFUSED in both arms; `evidence/survey-*.tsv`). OFF: *"applied
4 strategies for one goal [shove…, weigh…, burn…, hold…] and the corridor still does not plan."* ON: the chain stops
earlier, at the weigh's approach — *"-> weigh -> iceturret@472,400 approach door wandlock@480,560: the combat ladder is
EXHAUSTED … spinner:spinner@880,848 (a live Spinner's HAMMER …)"*. ⚠ OFF at the default 120 s timed out on this box
under load; the OFF rows are a `--timeout=900` re-run.

## 7. The dispatches the planner should run

The survey has no switch input, so its ON arm needs a flip-arm branch: this head plus `chaserSpinnerWalls: true` in
`CONTACT_FIDELITY_DEFAULTS` (and nothing else).

1. **Survey A/B.** `seedling-survey.yml -f route=full -f through=end` on this branch (control) and on the flip-arm
   branch. Expect: every row equal except L40's steps 66 and 96 (refusal text). Step 86 (L92) SOLVED 395 t in both.
2. **Sweep ×2 per arm**, `seedling-divergence-sweep.yml` on this branch, ≤ 10 shards, `-f page=seedling_bot_ap_p4g
   -f leg_budget_ms=180000 -f capture_requests=true`, `-f keys=` every L40 and L92 leg (`level_40__*`, `level_92__*`
   of a fresh `seedling-divergence-legs.mjs`; the two this slice read are
   `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` and
   `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared`).
   OFF arm: `-f contact_fidelity=` the contents of `evidence/contact-fidelity-off-arm.txt`. ON arm:
   `evidence/contact-fidelity-on-arm.txt` (the same 117 keys + `chaserSpinnerWalls`). Read `roomHits` per row: the
   claim is **no ON row with a hit that its OFF twin lacks**. No other room's leg can move (§6.1).
3. **Seam census** on the two keys above: `-f seam_census=-6..6` in each arm, to repeat §6.2 on CI's clock.
4. **`seedling-probe.yml -f battery=standard`** on the flip-arm branch (the wasm probes;
   `probe-seedling-wasm-arrival-composites` in particular).
5. **Train tier** on the flip-arm branch: `unittests_frontend.yml -f train_only=true` (the hammer L40 train files read
   L40 under their own switches; I ran only the two fidelity files).

## 8. Hand-overs

**To the user (licence).** Flipping `chaserSpinnerWalls` ON is a default flip. It owes: the re-record of
`l40button-l41-part0`; the re-pins of 4 fidelity rows and the two default rows (`contactFidelity.test`,
`fidelityL40Contact.test` "ships OFF"); hammer's signature on 5 rows. It was built and game-witnessed in wave 17 and
never licensed.

**To the hammer arc.**
1. The five pins of §6.3.
2. **The ON refusals at seams 5225 and 5241** (and the page's 875 at 5227): `apitem (880,816) contact -> kill
   (spinner@816,848 | spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player
   box on a body's 7x7 rect or on the 13 px hammer line … There is no step out. The corner formed 7 tick(s) after the
   press … LANDED.` That is the press kill's escape, yours. Under OFF the same clock (5241) returns a plan that takes
   two hits on the game; under ON it refuses honestly. Replay: `evidence/captured-request-397-seam5247.jsonl.gz`,
   `evidence/tools/seamarms.mjs --id=397 --seam=5241`.
3. §3.1 / §9 item 1 of L40-FLIP-BUILD can be closed as "the spinner wall (L40CONTACT D1), not the lapse". Your DD
   witness pins the lapse OFF by design and is untouched.

**To the JS arc.** Nothing to wire: no new key, no staging or result field, no `run.*` field renamed. The panel setting
the flip rides (`seedlingContactChaserSpinnerWalls`) exists and was exercised by this slice's ON page run.

## 9. What the brief got wrong (measured)

- *"its hit tests run T+1…T+SLASH_HIT_TICKS, hitsTimer lapses 1 → 0 between t929 and t930"* as the cause. True of the
  model, not the cause: on the game the timer reads 6 at t930, because hit 2 landed at t906 and not t900.
- *"The census names two candidates: the swing's LAST test tick against the lapse, or bob state."* The first is
  refuted (the game runs five tests, t926..t930). The second holds, as the bob's **position**, from 386 ticks before
  the swing.
- *"D1 (new key OFF)"*. No new key is warranted; the existing `chaserSpinnerWalls` is the model of this interaction.
- *"sweep legs 394 … and 871"*. At this base they are ids 397 and 875 (match by key).
- *"reproduce 394 … from arm A's captured request (394/1, seam 5222 in the report's evidence)"*. The request is not
  in that evidence directory (it lived in the hammer session's scratchpad). I captured a fresh one (seam 5247) and
  replayed it at 5222; mine is committed.
- The evidence's `tools/bobtrack.sh` output at the end of `m/394-lapse0.txt` (bob hits at t881/t914/t947) is the
  lapse-OFF dashless plan, not the game.

## 10. Deltas, residue, byte-inertia

- **Byte-inertia.** No model, solver, walker, rules, AS3 or wasm file changed; no default moved; no committed tape or
  producer digest moved. `reach-seedling-change` bounds the change to 4 test files. CI at `5a7381d2`: vitest
  **26,517 passed / 0 failed**, slow 431 / 431, `Producer --checks` green, every gate shard "expected reds only".
- **Not run here:** the full route survey (only the six L40/L92 steps, by §6.1's bound); the hammer train files with
  the key ON; `seedling-probe.yml` (cannot dispatch). The identity block was quoted, not re-run.
- **Residue.** (a) The flip itself (licence). (b) `l40button-l41-part0`'s re-record under the flip. (c) The two ON
  refusals (hammer). (d) L92: one spinner beside one bob; survey step 86 does not move, and no L92 leg was run on the
  page here — the sweep of §7 item 2 covers it.
- **One-sample caveats.** The page rows are one sample each; the decisions above rest on the node census (14 clocks)
  and the four game recordings, not on them.

## 11. Rows to BANK

- `chaserSpinnerWalls` ON is the game on L40's x 744 shaft: **0 px over 1226 + 1222 + 1051 + 1066 ticks** on four
  plans, Bobs' `hits`/`hits_timer` and Spinners included.
- The lapse (`strikeIframeLapse`), the five-test swing and the `hitUpdate` order are game-true on this window.
- Leg `Chest ← L39`, 14 clocks: OFF 9 hit-taking / 4 clean / 1 refused; ON 12 / 2 / 0.
- ON movers: 10 bounded reds (5 hammer-owned), 1 producer drift (`l40button-l41-part0`), 0 roster pairs, acceptance
  unmoved, survey 66/96 text only.
- A standalone `game.html` boots the vanilla rooms; a page plan must be replayed on the delivered set
  (`botLoadLevels`), or L40's spinners bounce off a Chest that the page does not have.
