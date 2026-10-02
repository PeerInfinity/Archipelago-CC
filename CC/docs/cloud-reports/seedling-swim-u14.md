# Seedling swim U14: the Moonrock beam is transcribed, and the campaign chain grows to route step 26, then STOPS at L29's turret spit

**Slice:** `seedling-swim-u14`, an Opus build slice run in the cloud (⚖ Q46, 2026-10-01: *"Yes, one slice"*). It was licensed to:
- transcribe `Moonrock.update` as a simulation family, witnessed on the game first;
- resume the campaign chain from route step 23 with U13's producer, until L32 or the next unmodelled event.

| | |
|---|---|
| Started from | `origin/main` @ `9a0b031c83` (R1 + U13 + J2) |
| Head | this report's commit, on top of D3 `77867e7` |
| Harness branch | `claude/moonrock-beam-simulation-wkqats` (the harness pins it, not `seedling-swim-u14`) |
| Commits | D1 `d20a8a6` · D2 `a9d6a5f` · D3 `77867e7` · this report |
| Dev server | `scripts/serve-nocache.py 8950`, `SEEDLING_PORT=8950`, build `seedling_bot_ap_p4e`, headless logic-only |
| Sibling | R3 (player death). I edited none of its regions: not `fallDestination`, `checkDrowning`/lava, `pendingDeath`, or the BobBoss death reboot. `levelRun.js`'s edits are a new block between the final door and the Owl in `advance`, a new state block beside `fallRockStateFor`, the shield's `removed()` line, one `earnedClears` loop, one `shakeWritersHere` line and one getter. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced. U13's refutation re-emitted from a scratch producer copy and recorded headless: t3 59.25 vs 61.25, 511 dead, `save.time` Δ 471. |
| D1 | **PASS, witnessed first** | `moonrock.js` + `levelRun.stepMoonrocksNow`. The game confirmed the AS3 reading exactly: **451 dead frames** (predicted 451, before the recording), the clock 451 ahead, no dash at t3. Mutant: 2 reds / 411, at the predicted ticks. tapeRunner 411/411. Identity block and six `--check`s identical. |
| D2 | **STOP at route step 27**, after 4 segments | `r9-solve-0-v3` 299 t, `r9-solve-12` 2,419, `r9-solve-21` 26, `r9-solve-22` 89. All four were recorded on the game and the model reproduces each, clocks exact. **Step 27 (`r9-solve-29`, L29, the Green Key) is REFUTED at t196** by a `TurretSpit` the model does not step. |
| D3 | **PASS** for the chain as grown | **26 windows, 9,054 t.** No new `earns` or `clears`. Frontier 4/0 (covered 26). Campaign `--check` moves `f30369a4 → f2873fcb`; the other five are identical. Census NO CHAIN ROOM MOVES. Whole-chain differential **827 PASS / 0 FAIL / 61 SKIP**. |

**The one thing to know first.** The chain now stops at **L29's turrets**, not at an event the route arms. Route step 27's walk passes 15.9 px from `turret@80,176`, and the game's `TurretSpit` knocks the player at t196. The game then ends with `hits` 1 and **without the Green Key**. The model steps neither `Turret` nor `TurretSpit` (`combat.js` prices the turret as a 64-px volume, and the solver's L29 danger list was empty). So the survey's "4/4 SOLVE" for steps 27–30 is, again, the model agreeing with itself. A second, smaller finding rides along: **the chain's first pit seam (step 24) breaks the free oracle's "a segment ends at its arrival" law** (fixed in the producer and census; see D2).

## W0: the banked rows (at `9a0b031`)

| Row | Result |
|---|---|
| `identity-block.sh .` (`SEEDLING_PORT=8950`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK. **Every row equals the bank.** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 f30369a4`, all exit 0 (= the bank) |
| reference row | ⚠ read *"2 GENERATED MODULE(S)/REGION(S) DIFFER"*, contaminated by **my own scratch producer copy** (`scripts/procgen/_u14-scratch-producer.mjs`, an instrument the generated index scans), which existed during that run. A pristine worktree could not answer: it lacks the submodules. Quoted from the bank instead (ALL MATCH at `9a0b031`); D3's regeneration reads ALL 7 + 5 MATCH. |
| U13's refutation, reproduced | Scratch producer copy (step 23 appended last). The 22 committed segments re-emitted **byte-identically**; `r9-solve-0-v3` was emitted at 229 t; `--record --only=r9-solve-0-v3`: *"tick 3 differs: expected (x=59.25, y=200, level=0), got (x=61.25, y=200, level=0)"*, *"511 dead = 0 modelled … + 511 residue … OUT OF BAND"*, *"save.time … game 12982, model 12511 (Δ 471 over 40 dead frame(s) the model counted)"*. It also read `drownTimer=2 (≈9 contact tick(s))`; U13's report quotes `9 (≈2)`, a transposition. The recording's `transitions` are `[]`: the game never reached L12. The scratch copy is deleted. |
| bounded vitest BEFORE (26 files) | **1,496 / 1,498.** The two reds: `rosterCategories`' banked composite row (30 vs 31, owed to the coordinator's bank, as U13 left it) and `tapeEnvelope` 177 vs 175. The second was my two new witness tapes appearing mid-run; re-run on the pristine roster it reads 23/23. |
| quoted from the bank (consistent with what D1 measured) | tape index 175 · tapeRunner 407 · surface 189 · constants 4,660 · profile 138 keys · entities 461 leaves · R8 `exposed` 33 · roster 175 (inert 174) · census 22/22 6,221 t · frontier 4/0 |

## D1: the Moonrock family (`d20a8a6`)

### The order, as read (`Scenery/Moonrock.as` whole, `Shield.as`, `Game.as`, `Bot.as`, `Player.as`)

- **Order.** `loadlevel` adds the Player at `Game.as:2227` and the moonrock at `:2345`, and `addUpdate` prepends. So the rock updates **before** the Player. `Bot.update` runs in `Main.update` above `super.update()`, so its dead-frame gate reads `Game.freezeObjects` as the previous frame left it.
- **The freeze arm reads LAST frame's `canBeam`** (`if ((beam && canBeam) || trigger)` is above `canBeam = …`). So:
  - **F1 (t0)** is live and unfrozen; the beam starts (300 → 299);
  - **F2 (t1)** is a live tape tick with a **frozen player**;
  - **F3…F453** are dead;
  - on the **release frame** the rock lowers the flag above the Player, so the player moves once, unobserved, under the held keys.
- **`beamTimeMax = Main.FPS * 5` and `Main.FPS` is 60** (`Main.as:27`), so the beam is 300 frames. The fall is `ceil(1256/20)` = 63 frames, starting on the beam's last. The hold is 90, then one release frame. ⇒ **451 dead frames.**
- **The frozen frames are DEAD frames** (the gate counts them; the tape does not advance). `Game.time` advances on every one.
- **The `else` branch (a set rock)**, every frame:
  - it snaps an overlapping player onto its top (`y + 2 − 5`);
  - it replaces a `Stairs` under it with a teleporter to `moonrock_target` and clears that room's tag 0 (vanilla `{2,0}`, `VanillaSet.as:132`);
  - it runs the hold, then the release.
  
  A rock built after the landing has `cameraTimer = 0`, so its first update runs the release arm on a visit that never froze.
- **`playersDirection`** writes `Player.directionFace` (0 if the player is left of the rock's centre, else 2; −1 at the release). `sprites()` pins `direction` to it on every frame, frozen ones included.
- **`slash()` runs above `super.update()`**, so the 20-frame double-tap window drains through every frozen frame. `genericHit` returns under the freeze, so a swing across it is burned.
- **`Game.shake = 60` lands inside the freeze**, 91 frames before the release, and decays to 0 by then (measured: `static.Game.shake` 0 in the latch). L0 holds no on-screen-gated body, and L12 is a new `Game` (its band is cleared). It is not a wall.
- **The render's flares** draw `Rng.cos()`, which is the cosmetic stream under the campaign's `rng.split`.
- **Which committed tapes see a Moonrock:** 35 tapes visit L0. None boots `rock_set: true`, and only `r9-solve-13-v2` boots `beam: true`, which ends ON its L0 arrival, so no L0 frame runs. The R2 walks are *granted* the shield (`Shield.removed()` never runs), and no committed tape's model collects the shield and then enters L0 (probed: `r2-walk-1-sword-shield`, `r2-walk-full` collect nothing; `r9-solve-20` collects it and ends in L13).

### The witnesses (`plan-seedling-u14-moonrock.mjs`, `--check`), recorded on the game BEFORE `moonrock.js` existed

Staged as route step 23 boots (`r9-solve-13-v2`'s measured latch through the producer; `beam: true`).

| tape | prediction (`predictBeam`, from the AS3 alone) | game | model after D1 |
|---|---|---|---|
| `u14-moonrock-beam` (sword t0, release t1, sword t2; `right` t0–t9; still to t20) | beam ends F300, fall 63, lands F362, release F453 → **451 dead** after the live frozen tick t1; facing 0; t3 a fresh swing, not a dash; latch beam false, rockSet true, {2,0} cleared, shake 0 | **471 dead = 20 boot + 451**; `save.time` 12733, i.e. 451 ahead of the pre-D1 model; x: 56, 56.8, 58.15, **59.25**, 60.1, 61.5 …; `drownTimer` 0; latch `save.beam` false, `save.rockSet` true, {2,0} cleared (23 rows), `static.Game.shake` 0 | all 21 observations; **451 modelled** (0 residue beyond the boot); clock **12733 = 12733**; events beam-started t0 (facing 0), frozen t1, swing-burned, landed y 256, stairs-replaced, released (451 dead) |
| `u14-moonrock-set` (`rock_set: true`, boot (208,280), `right` ×40) | blocked: the box never enters x 240 | stops at **237.95** from t26; 20 dead; {2,0} cleared | all 41 observations; no freeze; {2,0} cleared |

The recording was made twice: my first copy was clobbered by an `mv` collision before any model code existed. The re-record is byte-identical in every observation (md5 `f27080d8…` / `d7b167d7…`).

**Mutant** (predicted first: `moonrockStateFor` returns no rock, so 2 reds / 411, at t3 (61.25 vs 59.25) and t27 (239.45 vs 237.95)). **Measured exactly that.** The restored `levelRun.js` is `cmp`-identical.

**Parity.**
- tapeRunner: **411/411** (407 + the witnesses' 4 rows); every old row passes.
- Identity block AFTER D1: every row identical to W0.
- Six `--check`s identical.

**What the family is, and what it refuses.**
- `moonrock.js`:
  - `MOONROCK`, a `defineRecord` entity record, the `FALL_ROCK` precedent: 13 leaves, entities md5 `e338c30f → 143e37e6`;
  - `createMoonrock`, `stepMoonrock` (source order), `moonrockRect`;
  - `moonrockSpan`, which `moonrock.test` pins at 300 + 63 + 90 + 1 / 451.
- `levelRun`:
  - `moonrockBeam`/`moonrockSet` read `save.beam`/`save.rockSet` off the boot and are written by `Shield.removed()` (the ceremony's finishing frame) and the landing;
  - the per-visit rock (`check()` removes it when its tag is cleared);
  - `stepMoonrocksNow` in `advance`. The frozen tick is `runFrozenTick` plus an `after()` that steps every dead frame: the rock, `shieldBump`, `slash()`'s timer, `hitUpdate`, the facing and the camera. It ends with `spendFrozen(n, 'moonrock')`, the animation-end `slashEnd`, and the release frame's held-key step.
  - The set rock is a Solid through `fallenRocksNow` (no new `liveSolidOpts(` site; that function lost an early `return null` that skipped rooms with no FallRock, equivalent everywhere else). The {2,0} write is an `earnedClears` feeder. `camera.SHAKE_WRITERS.moonrockLanding` (`=`, 60). `shakeWritersHere` names it while the landing is ahead. `run.moonrock` is the member.
- `SEAM_BOOT_SPEC`'s `beam`/`rock_set` are `modelled: true` now.
- **Refused by name:**
  - two rocks in one room;
  - a span in a room holding any family a frozen frame advances (chasers, spinners, pulsers, activators, …; L0 holds none);
  - a span opening during a hit, an ice freeze, a wand or fire window;
  - a release frame that would transition;
  - a moonrock freeze alongside a pickup ceremony.

**Census rows.**
- Constants 4,660 → **4,730**, PASS (31 classified `moonrock.js` rows; the snap reuses `fallRock.PLAYER_SNAP`).
- Entity witness re-run (`--write --jobs=3`, 2,124 s): **472** number leaves over today's 123 fast-tier tapes. `moonrock`: 3 move (`cameraTimerMax`, `target.level`, `target.tag` throw under a ULP), 8 corpus-blind. Observation streams do not carry a dead-frame count, so `fps`/`fallRate` move no stream.
- Surface GREEN **189** rows; `runObject` 184 (+`moonrock`), 56 simulation files.
- Profile unchanged at 138.

## D2: the chain resumed (`a9d6a5f`)

U13's step 23–30 declarations restored verbatim; the producer emits headless (`SEEDLING_PORT=8950`).

| # | segment | route step | rooms | predicted | solved | game (`--record`, ALL CHECKS PASSED) |
|---|---|---|---|---|---|---|
| 23 | `r9-solve-0-v3` | 23 | L0 → L12 | ~229 t (and 491 dead) | **299** | 300 obs, **491 dead = 20 + 451 + 20**, all accounted; clock 13032 = 13032; calm latch |
| 24 | `r9-solve-12` | 24 | L12 → L21 (the pit) | 2,419 | **2,419** | 2,420 obs; crossing t2339, calm landing t2419; clock 15471 = 15471 |
| 25 | `r9-solve-21` | 25 | L21 → L22 | 26 | **26** | 27 obs; clock 15437 = 15437 |
| 26 | `r9-solve-22` | 26 | L22 → L29 | 89 | **89** | 90 obs; clock 15546 = 15546 |
| 27 | `r9-solve-29` | 27 | L29 → L31 (Green Key) | 383 | 383 (model) | **REFUTED at t196. STOP.** |
| 28–30 | `r9-solve-31`, `-30`, `-32` | 28–30 | | 336 · 210 · 1,056 | not reached | — |

**Step 23's +70** (299 vs the survey's 229). Both traces open with the same tick-0 decision (`break` `breakablerock@288,176`; *"sword-dash window: not-faster … 299 against 299"*), and the walks part at t3. The old model's t2 press dashed. The new one is a fresh swing (the window drained through the freeze), so the break leg's press train re-plans and ends at t288 instead of t218.

**The pit seam (step 24 → 25), and the oracle it broke.** The producer's first emit reddened one row: *"the free oracle: r9-solve-21 declares seam.time 15370 — 13011 + 40 − LOAD_FADE_FRAMES + 2419 = 15450"*.
- `gameClock.declaredSeamTimeAfter`'s own docblock assumes *"the segment ENDS AT AN ARRIVAL — the last transition's tick is the tape's last"*. A pit walk does not: it crosses at t2339 and lands calm at t2419.
- The latch's `beginEntry` (`begin.tick` 2339, `save.time` 15371) is what `segmentBootFromLatch` boots the successor from; the latch's end-of-tape `save.time` is 15471.
- So the oracle counts to the **arrival tick** (the last transition's `t`) in the producer, the census and `gameClock.test`, which is `tick_count` on every door seam. No earlier row moved: they print the same number.
- The continuous JS sequence keeps the 80 walk-on ticks: its live clock is `declared + 21 + 80` from that boundary on (asserted by name in `gameClock.test`).

**The STOP, with its readout** (`CC/docs/cloud-reports/seedling-swim-u14-wall.json`, md5 `549a872c…`). `r9-solve-29` was emitted from a scratch producer copy (step 27 appended last) and recorded headless.
- The producer's own latch drive had already refused it: *"r9-solve-29 ends at a CALM ARRIVAL in the GAME — latch: arrival.velocity ⛔ NOT CALM — v=(1.25, 0) hits=1"*.
- The differential: *"tick 196 differs: expected (x=108.42416035523557, y=149.2682929719388, level=29), got (x=109.05000000000003, y=151.7000000000001, level=29) … ⛔ THE RECORDING IS VALID AND THE MODEL IS REFUTED"*.
- *"the game's own `hits` matches the damage model — game … 1, model: 0"*.
- *"the game's own `hasKey` … game: [true,false,…], model: [true,true,…]"*.
- *"192 dead = 150 modelled … + 42 residue … OUT OF BAND"*.
- *"save.time … game 16101, model 16099"*.

| t | held (k−1) | game x, y | model x, y | distance to `turret@80,176`'s centre (88,184) |
|---|---|---|---|---|
| 192 | right | 104.35, 151.7 | same | 36.2 |
| 193 | right | 105.70, 151.7 | same | 36.8 |
| 194 | right | 106.80, 151.7 | same | 37.4 |
| 195 | right | 107.65, 151.7 | same | 37.8 |
| **196** | right | **108.424, 149.268** | **109.05, 151.70** | 40.3 |
| 197 | right | 109.122, 147.075 | 110.20, 151.70 | 42.5 |
| 198 | right | 109.745, 146.075 | 111.10, 151.70 | 43.7 |

The game player is inside `turret@80,176`'s `attackRange` 64 from **t31** and comes within **15.9 px** of it; `turret@128,192` is in range from t89.

**Attribution, read from the AS3.**
- `Enemies/Turret.as:64-76`: within `attackRange` 64 the turret turns toward the player and, every `shootTimerMax` 40 frames, plays "startshot", whose end spawns a `TurretSpit` at `shotSpeed` 3.
- `Projectiles/TurretSpit.as:47-53`: `collideTypesInto(hitables)` → `Player.hit(null, v.length, spit position)`. The knockback at t196 points away from the south-west turret.
- The model steps neither: `combat.js` `turret.threat` says *"THE BODY IS NOT THE THREAT"* and prices it as a volume, and the solver's tick-0 trace row at L29 has `danger: []`.
- So the model's walk takes no hit and collects the key at t329, while the game, knocked off its line, never does.

That this is the spit, not some other body, is my reading of the AS3 and the knockback direction. I did not record a turret-position stream.

**Not committed:** the refuted tape, its trace and its recording are in the session scratchpad only. The declaration is cut back to 26 segments; its docblock names the wall and the four waiting steps (their declarations are U13's, `ee34b23`).

## D3: the chain, the frontier, the checks (`77867e7`)

**`PLAYTHROUGH_CHAINS.r9-campaign`** is unchanged in text (segments and `endsAt` are derived).
- `earns`: no addition. None of the four collects anything, and the differential reads *"the EARNED set is exactly what the chain declares — 4 earned"*.
- `clears`: no addition. No new tape declares a timed (`at`) clear (checked per tape), so `stagedClearFindings` has no new row to red on.
- Ends-meet: *"the declared endsAt IS the tapes' own length — endsAt 9054 vs the segments' 9054"*.

**Tick-0 blocks.** `derive-seedling-tick0.mjs --only=` the four: each a calm zero-tick latch, clock delta **21** (the boot cost) on all four. `--check` reads the same four pre-existing FAILs U13 reported (`r8-d2-19/20`, `r9-solve-19/20`) and passes the four new ones.

**The frontier** (`--write-frontier`, then `--check-frontier`: **4 pass / 0 fail**).
- `covered` 22 → **26**; `lastArrival` `{step 26, L29, r9-solve-22}`.
- Its survey source was regenerated for the steps after the chain: `survey-seedling-route.mjs --through=2.2 --only=27,28,29,30 --timeout=1500` → *"4/4 route steps SOLVE today"* (model-only).
- So `nextStep` stays null, a *"GAP LIST"*, while the producer stands at step 27's wall. U13's residue, unchanged in kind.

**The census** (`--no-write`): exit 0, chain **26/26, 25 boundaries admitted, 9,054 t**, end L29 (16,224), tail 3/3 1,828 t, **NO CHAIN ROOM MOVES**; normalised md5 `a1adbe08…`.
- Before the arrival-tick fix it read `NEEDS RE-RECORD r9-solve-21 … PREDICTED: seam.time = 15450`, the oracle's pit flaw a second time.

**The six `--check`s:**
- battery `410f27c0` · d2-chain `7cba9530` · l18 `cef8048e` · tail `9a6a3192` · r9-l3 `6cd35fe1`, all identical;
- **r9-campaign `f30369a4 → f2873fcb`** (exit 0, "all checks green"). Every free-oracle row passes, including *"r9-solve-12 declares seam.time 13011 — 12241 + 491 − LOAD_FADE_FRAMES + 299 = 13011"* (the beam's 451 counted) and *"r9-solve-21 … 13011 + 40 − LOAD_FADE_FRAMES + 2339 = 15370"*.

**The differential over the WHOLE chain plus the witnesses** (`--only=` all 26 names + `u14-moonrock-beam,u14-moonrock-set`): **827 PASS / 0 FAIL / 61 SKIP, ALL CHECKS PASSED.**
- The chain rows are **92 PASS / 4 SKIP**. The four SKIPs are the headline-less UNASKABLE rows: ends-meet arithmetic, stream slice, ending state, and the goal-ledger report 4/41.
- New rows: *"THE SEAM r9-solve-13-v2 -> r9-solve-0-v3 is GREEN over the whole signature — 46 signature rows compared"*, and the same for `0-v3 → 12`, `12 → 21` and `21 → 22`.
- *"the boundary tick is observed twice and agrees"* at all four. `r9-solve-12` ends `{level 21, x 88, y 88, t 2419}`; `r9-solve-21` starts `{… t 0}`.
- *"ends at a CALM ARRIVAL"* for all four.

**tapeRunner: 419** (411 + the four segments' 8 rows); every old row passes.

**Records.**
- `seedling-bot-log.md` § *Seedling substrate U14-swim — the Moonrock beam; the chain to L29*: D1, D2, the wall, D3 and four trap candidates.
- `seedling-bot.md`: a moonrock paragraph beside the Pull one, and the campaign passage (26 windows / 9,054 t, the stop at L29's turret).
- The generated `campaign-chain` region now reads *"26 segments … to the L29 arrival, 9054 ticks"*.
- Reference: `generate-procgen-reference.mjs` → ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED; the quick-launch docs index is current.
- Tape index 175 → 177 (D1) → **181**.

**Roster pins**, each moved by my tapes:

| pin | move | moved by |
|---|---|---|
| `tapeEnvelope` | 175 → 177 → 181 | the witnesses, then the segments |
| `observationTolerance` ×2 (names, `tally.swapped`) | 175 → 181 | the same |
| `dialogueAutoAdvance` | 175/174 → 181/180, all inert | the same |
| `producerSegments` | 28 → 32 and 31 → 35 | the segments |
| `fixtures/tiers` | campaign 31 → 35, mechanic `roster − 56` | the segments |
| `rerecordCampaign` | the licence list gains the four cascade successors | the segments |
| `playthroughAcceptance` | tail arrival 0 → **29** | the segments |
| `campaignChain.test` | boot levels gain 12, 21, 22; bridged touching gains the four | the segments |
| `gameClock.test` | the oracle row counts to the arrival tick; the resumed clock is `declared + 21 + carried walk-on`, with the one pit boundary named (`r9-solve-12 -> r9-solve-21: 80`) | the pit seam |
| R8 batch | `exposed` 33 → **37** | the segments |
| `r7Acceptance` | `beam`/`rock_set` modelled | the `SEAM_BOOT_SPEC` flip (D1) |
| `entityRecords` | md5 → `143e37e6`, module list + `moonrock.js` | the record (D1) |
| `lintGateLabels` | green; no test title moved | — |

The R8 rows in the table above, in detail:
- **D3's R8 rows were written before the roster measured them.** `campaignBridgeCoverageFindings` named all four at the declaration, since L12 holds `puncher@416,256` and L22 holds `bob@96,144`.
- Each row predicts exposure (it retires `noDamage` and its stream enters the room). `r9-solve-0-v3` and `r9-solve-21` are exposed at their arrival only.
- The synthetic room-mutation fixture mirrors them.

**Constants:** `--profile-rows` → `--write` → `--check` PASS, **4,730** literals, 0 drift. **Surface:** `--check` GREEN 189.

**Bounded vitest AFTER:**
- the 30 files above (BEFORE's 26, plus `moonrock`, `pull`, `tapeFormat`, `tapeIndexManifest`): **1,868 / 1,869**;
- U13's broader set plus the neighbours (`watchSolve`, `reachClosure`, `walkMoves`, `surveyFamily`, `surveyGrants`, `solverEncounter`, `solverBotLethalPit`, `placedTalk`, `ulpDash`, `watchManual`, `watchWasm`, `boxLock`, `exportSeedlingView`, `provisionalLatch`, `watchOverlays`, `fallRockButton`, `levelWorld`, `playerPhysicsV2`, `bobBossFight`, `shieldFight`, `dangerMap`, `combatVerbs`): **22 files / 946 / 946**;
- the one red is `rosterCategories`' banked composite row: *"expected 30 to be 35"*. The banked row still counts the campaign tier as it stood before U13 and moves only with the coordinator's `standing-values --write` (⛔ not run here; ⚖ 52: no unfiltered vitest).

## What the brief got wrong (measured)

1. **"`beamTimeMax = Main.FPS * 5`: read `Main.FPS`; 30 ⇒ 150 frames."** `Main.as:27` is `FPS:int = 60`, so the beam is **300** frames, and the span is 451 dead frames, not ~300.
2. **"Step 23 now includes the beam's frozen frames"** (as ticks). Frozen frames are DEAD frames: the tape does not advance on them. The segment is 299 live ticks plus 451 dead frames, and it is 70 ticks longer than the survey's for a different reason (the drained dash re-plans the break leg).
3. **"U13's residue was 511 against 0 modelled: the beam plus the fall plus whatever else."** The beam is 451. The other 40 came from U13's refuted walk, which desynced at t3, never reached L12 and touched water. A witness that stands still reads 471 = 20 + 451.
4. **"A new constant is a `seedlingProfile.js` key."** I followed the `FallRock` precedent: the class's constants are an entity RECORD (`defineRecord('moonrock')`). The profile holds named top-level scalars and leaves entity tables where they are. The record owed the entity witness (re-run, 472 leaves), not the profile's two tiers (138 keys, unchanged).
5. **"A new `liveSolidOpts(` site owes an R8 batch row."** No new site: the Solid rides `fallenRocksNow`. The R8 batch moved anyway, for a reason the brief didn't name: the chain grew into two bridged rooms (L12, L22), so four prediction rows were owed (33 → 37).
6. **"Expect more route-armed events (the Green Key, Fire)."** The next wall is not route-armed. It is an unmodelled shooter (`Turret`/`TurretSpit`) that the staged survey cannot see either, because it is model-only. The Green Key is where the walk was going when the spit hit.
7. **"A 60-frame shake right after the beam may open the same band in L0 or L12."** The shake lands inside the freeze, 91 frames before the release, and is 0 at the first live tick after it (latched). L0 holds no on-screen-gated body, and L12 is a new `Game`. Not a wall.
8. **Not anticipated:** the chain's first PIT seam breaks the free oracle's "a segment ends at its arrival" law (`gameClock`'s own docblock states it). It was found by the producer's first emit, fixed in the producer, the census and `gameClock.test`, and it leaves a named 80-tick clock phase in the continuous sequence.

## Residue

- **`Turret`/`TurretSpit` are unmodelled.** Steps 27–30 (`r9-solve-29`, `-31`, `-30`, `-32`) wait on them. That needs a simulation family (aim, `shootTimer`, the spit's flight and `Player.hit`) and its licence.
- **The pit seam's clock phase.** From `r9-solve-21` on, the continuous JS sequence's `Game.time` runs 80 ahead of the per-segment game's, because the successor boots from the arrival's `Game.begin()`. Inert today (L21, L22 and L29 read no `Game.time`); a `Game.time`-coupled body downstream of a pit seam would see it.
- **The frontier says "GAP LIST"** while the producer stands at step 27 (the survey is model-only). U13's residue, unchanged.
- **Moonrock, bounded:**
  - the solver's preview steps no freeze (the run does);
  - the stairs replacement is modelled as its persistence write only (both stairs and teleporter lie under the Solid);
  - the facing the beam writes is modelled and predicted but not observable in a stream;
  - the refusals above are unwitnessed by design (L0 reaches none).
- **`rosterCategories`' composite row** is red until the coordinator banks `standing-values` (30 vs 35).
- **The full tier on CI** (`seedling-full-tier.yml`) has not run on the four new segments or the witnesses. That is the coordinator's dispatch (⚖ 70 (f)).
- **`derive-seedling-tick0 --check`'s four delta FAILs** are pre-existing (U13 reported them).
- The latch and tick-0 caches live in this container's `/mnt/c/playwright`; the regenerated survey files are local (`NewDocs/`, gitignored).
- **Scratch** (session scratchpad, not committed):
  - the refuted `r9-solve-0-v3` (W0) and `r9-solve-29` (D2) tapes, traces and recordings;
  - `wall29.mjs`, `latch-of.mjs` and the probes;
  - every run log.
  
  Both scratch producer copies were deleted from `scripts/procgen/`.

## Byte-inertia

| Artifact | W0 (`9a0b031`) | head |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d` / `c4841acb` · OK | **identical** |
| five `--check`s (battery, d2-chain, l18, tail, r9-l3) | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1` | **identical** |
| r9-campaign `--check` | `f30369a4` | **`f2873fcb`** (licensed) |
| reference `--check` | ALL MATCH (bank; W0's run contaminated, above) | ALL 7 + 5 MATCH |
| campaign census | NO MOVES, 22/22, 6,221 t (bank) | NO MOVES, **26/26, 9,054 t** |
| `--check-frontier` | 4/0 (bank) | **4/0**, covered 26 |
| tapeRunner | 407 | **419** |
| surface / constants | 189 / 4,660 | 189 / **4,730** |
| profile / entities | 138 / 461 | 138 / **474** (472 number leaves witnessed) |
| `fixtures/**` vs main | — | new: `u14-moonrock-beam`/`-set` (tape + expectation), `r9-solve-0-v3`/`-12`/`-21`/`-22` (tape + trace + expectation); moved: `tapes/index.json`, `campaign-frontier.json`; and the test pins listed above. Nothing else. |

None of the following was touched or run: AS3, wasm, gitlinks, biome defaults, `standing-values --write`, `pytest`, unfiltered vitest, R3's regions, `jsRuntimeCore.js`, or `botDriverV2`'s `driveStepHeld`/`planTilePath`. `solverBot.js` and every committed tape other than the new ones are byte-identical to main.
