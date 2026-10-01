# Seedling swim U13: the campaign chain toward sphere 2.2. It grew by one room, and step 23 STOPS at the Moonrock beam

**Slice:** `seedling-swim-u13`, an Opus build slice run in the cloud (plan §18.12–§18.13, ⚖ Q40, 2026-10-01: *"Yes, one slice"*). It was licensed to grow the chain and to move `campaign-frontier.json`, the campaign `--check` identity, the frontier's sources, and `r9-solve-20`'s walk.

| | |
|---|---|
| Started from | `origin/main` @ `6ebd3442dc` (the U12 bank commit, after the brief's `3534c806ed`) |
| Head | this report's commit, on top of D4 `0715d79` |
| Harness branch | `claude/seedling-swim-u13-chain-wcvmyx` (the harness pins it, not `seedling-swim-u13`) |
| Commits | D1 `1d23b07` · D2 `9c79547` · D3 `d86b242` `11553f5` · D4 `0715d79` · this report |
| Dev server | `scripts/serve-nocache.py 8930`, `SEEDLING_PORT=8930`, build `seedling_bot_ap_p4e`, headless logic-only |
| Siblings | R1 and J2. I edited no `solverBot.js`, simulation, `levelRun.js` or `botDriverV2.js` file. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `6ebd344`. The survey `--through=2.2` reads 9/9, every row md5-identical to U12's. `--check-frontier` was already red on one stale `sources` row (pre-existing, as at U6b). |
| D1 | **PASS** | The producer derives `reach-pit` (`exit: 'pit'`) and `encounter` (`encounter: '<drop>'`) from the model and the atlases. A terminal segment may cross exactly its encounter's pit. The frontier's source is the through-2.2 route. |
| D2 | **STOP at route step 23**, after 2 segments | `r9-solve-20`: 161 → **560 t** (predicted 560). `r9-solve-13-v2`: **48 t** (predicted 48). Both are recorded on the game, and the model reproduces each. `r9-solve-0-v3` (L0 → L12) is **REFUTED at t3**: the first L0 visit after the shield runs the `Moonrock` beam, which the model does not simulate. |
| D3 | **PASS** for the chain as grown | **22 windows, 6,221 t.** No new `earns`/`clears` row is owed. Frontier 4/0. Campaign `--check` moves `46990775 → f30369a4`; the other five are identical. Census NO CHAIN ROOM MOVES. Chain differential **675 PASS / 0 FAIL / 61 SKIP**, its chain rows 80 PASS / 4 SKIP. |
| D4 | **PASS, with one red owed to the bank** | Log section, bot page, reference (ALL 7 + 5 MATCH). Surface GREEN 189, constants PASS 4,654. Bounded vitest 33 files, 1,834/1,835. The one red is `rosterCategories`' banked composite row, which moves only with the coordinator's `standing-values --write`. |

**The one thing to know first.** The chain cannot cross route step 23 until the model simulates the **Moonrock beam**. Taking the shield arms `Moonrock.beam`. On the next L0 visit, the game freezes objects, turns the player toward the rock, runs the beam, and drops the rock (`Moonrock.as:66-118`). The survey's 9/9 is from staged pre-shield boots (`beam: false`), so it cannot see the beam: **the survey's yes for steps 23–30 is not evidence the chain can play them.** The seven rooms after L0 (L12's pit, L21, L22, L29, L31, L30, and the L32 encounter) were never reached by the producer.

## W0: the banked rows (at `6ebd344`)

| Row | Result |
|---|---|
| six `--check`s | battery `410f27c0` · d2-chain `7cba9530` · l18 `cef8048e` · tail `9a6a3192` · r9-l3 `6cd35fe1` · r9-campaign `46990775`, all exit 0 (= the bank) |
| `identity-block.sh .` (`SEEDLING_PORT=8930`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · the six `--check`s as above · reference ALL 7 + 5 MATCH. **Every row equals U12's head.** |
| campaign census `--no-write` | exit 0, chain 21/21, **5,774 t**, tail 3/3 1,828 t, **NO CHAIN ROOM MOVES**; normalised md5 (tree path → `TREE`) `c62276e5…` |
| `--check-frontier` | **exit 1**, 3 pass / 1 fail. The `sources` row is stale: `AP_1_rules.json` is `c4845373…` on disk and `602b318b…` in the artifact. The survey half was SKIPPED: `NewDocs/…/route.json` was absent. This is pre-existing (U6b reported the same row). |
| tapeRunner | **393** rows, green |
| roster pins | `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance` green at **168** |
| survey `--through=2.2 --only=22..30 --timeout=1500` | **9/9 SOLVED.** Row md5s (sans `ms`/`views`): `671973a3 341eb8ba b9d5b262 68909100 4319c056 1440e6ac 643cacb4 c2facdbc bee5e241`, **each equal to U12's**. Step 24: 2,419 t in 546 s. |
| bounded vitest BEFORE (25 files: `campaignChain`, `director`, `tiers`, `gameClock`, `playthroughAcceptance`, `tapeRunner`, `watchSolve`, `lintGateLabels`, `producerSegments`, `reachClosure`, `rerecordCampaign`, `walkMoves`, `rosterCategories`, `surveyFamily`, `surveyGrants`, `solverBot`, `solverEncounter`, `solverBotLethalPit`, `pull`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `r8Acceptance`, `watchOverlays`) | **25 files / 1,462 tests**, exit 0 |

**The frontier's source, measured.** `NewDocs/` is gitignored and was absent in this clone, so the census could not read its survey. I made the source the through-2.2 route, regenerated on this box:
- `survey-seedling-route.mjs --through=2.2` writes `through-2.2/route.json`, md5 `845a1cd3…`, which is U5's through-2.2 route.
- Its rows went to `through-2.2/survey.json` by `--out=`. Steps 1–30 read 29/30; step 8 is the known `NEEDS-GAME-ORACLE` row, which the chain already covers.
- Steps 22–30 were the W0 run's. Step 21 under the 2.2 route (the shield, then the exit to L13) SOLVES in 560 t.

## D1: the producer (`1d23b07`)

**The two goal shapes**, as declaration data (`campaignChain.js`'s DATA list gains `exit` and `encounter`):
- **`exit: 'pit'` → `reach-pit`.** The producer's `pitTo(level, to)` builds the level's world. It requires `world.fallthrough.level === to` and exactly one pit tile, and refuses as ambiguous otherwise, the same law as `exitTo`. On L12 that is tile (36,43) at (576,688), the survey's `pitEdgeFor` answer.
  - I did not take the survey's AP-sidecar derivation, which would mean extracting it from a module that runs at import. The model's control block is the run's own `fallDestination` input.
- **`encounter: '<drop>'` → `encounter`.** The location is the sphere-order row for that item in that level. `at` is that location's tile in `seedling-playthrough.json` (the survey's `encounterCoords`), and `then` is `'reach-pit'` when the control block names a fallthrough. For L32 that gives `{at: (64,128), drop: Fire, then: 'reach-pit'}`, the route step's goal verbatim.
- Both go through the solver's existing goals; `solverBot.js` was not touched.

**The tail.** I chose a TERMINAL `to: null` L32 segment whose goal is the encounter with `then: 'reach-pit'`, the route step verbatim. After the burn, that walk falls through the arena's pit to L30, so "a terminal segment crosses NOTHING" could not hold.
- The producer's terminal claim now reads *"crosses only its encounter's pit — it ends the route in L32 and falls to L30"*.
- The census aligns a terminal route step on the room that pit falls to (`terminalEndLevel`).
- The alternative, `to: 30` as a non-terminal tail, would make `campaignNextLevel()` 30 on a route with no step 31, which `campaignChain.test`'s frontier alignment rejects.
- **Since D2 stopped at step 23, no committed segment exercises this or either goal shape.** The code is present, and the D2-reverted declaration's docblock names it.

**`r9-solve-20`'s re-record.** `to: null` became `to: 13`. Its goals are now `collect-placement (112,48)` (the shield) and then `reach-exit stairsup@16,48`, and its walk moves (the licence).

**The predictions.**
- Each new segment: the survey's ticks.
- `r9-solve-20`: ~560, the through-2.2 survey's step 21, which also equals `r8-d2-20`'s walk.
- The chain: 5,774 − 161 + 560 + 4,796 = **10,969**.
- One place the producer's real boot would differ from the staged one: the latch carries the route's own consequences, such as the shield's `beam`. The staged block cannot carry them.

## D2: per segment (`9c79547`)

The producer emit was driven headless (`SEEDLING_PORT=8930 node scripts/procgen/solve-seedling-r9-campaign.mjs`). The latch cache was empty, so every non-last segment was driven fresh. Every one of the 20 older segments re-emitted **byte-identically** (only `r9-solve-20` moved), and every older latch was calm in the game.

| # | segment | route step | rooms | predicted | solved | game recording (`--record --only=r9-solve-20,r9-solve-13-v2`, 55 PASS / 0 FAIL) |
|---|---|---|---|---|---|---|
| 21 | `r9-solve-20` | 21 | L20 → L13 | 560 | **560** | 561 observations, the model reproduces it, 1 transition; a calm latch at t560 (46 rows) |
| 22 | `r9-solve-13-v2` | 22 | L13 → L0 | 48 | **48** | 49 observations, the model reproduces it, 1 transition; a calm latch at t48 |
| 23 | `r9-solve-0-v3` | 23 | L0 → L12 | 229 | 229 (model) | **REFUTED at t3. STOP.** |
| 24–30 | `r9-solve-12`, `-21`, `-22`, `-29`, `-31`, `-30`, `-32` | 24–30 | | 2,419 · 26 · 89 · 383 · 336 · 210 · 1,056 | not reached | — |

**The STOP, with the readout** (`seedling-swim-u13-wall.json`, md5 `73c57b60…`, has the per-tick table). `r9-solve-0-v3` boots from `r9-solve-13-v2`'s measured latch, which carries `beam: true, rock_set: false, hasShield: true`.

First, the producer's own latch drive refused: *"r9-solve-0-v3 ends at a CALM ARRIVAL in the GAME — latch: arrival.velocity ⛔ NOT CALM — v=(1.4999999999999998, 0)"*. Then I recorded the tape headless from a scratch copy of the producer, which stopped at the refusal instead of throwing; the copy is deleted. The differential:

- *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — tick 3 differs: expected (x=59.25, y=200, level=0), got (x=61.25, y=200, level=0) [dx=2, dy=0] ⛔ THE RECORDING IS VALID AND THE MODEL IS REFUTED"*;
- *"511 dead = 0 modelled … + 511 residue … ⛔ OUT OF BAND — a freeze fired that the model does not know about"*;
- *"the game's own latched `save.time` is the model's clock — game 12982, model 12511 (Δ 471 over 40 dead frame(s) the model counted)"*;
- *"drownTimer=9 (≈2 contact tick(s))"*;
- 5 checks FAILED.

| t | held (k−1) | game x | model x, v |
|---|---|---|---|
| 0 | — | 56 | 56, (0,0) |
| 1 | primary+right | 56.8 | 56.8, (0.8,0) |
| 2 | right | 58.15 | 58.15, (1.35,0) |
| **3** | **primary+right** | **59.25** | **61.25, (3.1,0)**: the model dashes |
| 4 | left | 59.3 | 63.3, (2.05,0) |
| 5 | right | 60.1 | 65.1, (1.8,0) |

**Attribution, read from `Moonrock.as:66-118`.** While `!Game.moonrockSet`, `(beam && canBeam) || trigger` sets `Game.freezeObjects = true` and `playersDirection(...)` turns the player. `canBeam` holds once a player is more than ¾ of the rock's width from its fall point. The beam then runs `beamTimeMax` frames and `trigger`s the fall. `Shield.removed()` armed `beam` (`r7Acceptance`'s shield row cites `Shield.as:46 → Moonrock.as:88-118`). So the first L0 visit after the shield owes this event, and the model has no Moonrock family.

That the t3 dash is refused by the freeze's input handling is my reading of the stream; I did not measure it separately. The 471-frame residue and the uncalm latch are measured.

**Not committed:** the refuted tape, its trace and its recording are in the session scratchpad only. The declaration was cut back to 22 segments. The cut docblock names the wall and points at the producer's two goal shapes.

**`swim-u5-bobboss-encounter`** cannot be compared: the chain's L32 segment was never reached.

## D3: the chain, the frontier, the checks (`d86b242`, `11553f5`)

**`PLAYTHROUGH_CHAINS.r9-campaign`** is unchanged in text: segments are derived and `endsAt` is derived.
- `earns`: no addition. `r9-solve-13-v2` collects nothing, and the differential reads *"the EARNED set is exactly what the chain declares — 4 earned"*.
- `clears`: no addition. Neither new tape declares a timed clear. The local probe (`stagedClearFindings` over every `PLAYTHROUGH_CHAINS` entry and every fixture tape) reads `r9-campaign: 12 rows, 0 red`, and **total red 0**.
- Ends-meet: the producer prints `183 + … + 746 + 560 + 48 = 6221`, and the differential reads *"the declared endsAt IS the tapes' own length — endsAt 6221 vs the segments' 6221"*.

**The campaign tier** derives from `CAMPAIGN_SEGMENT_NAMES`: 30 → **31** tapes, with no edit to `tiers.js`.

**The frontier** (`--write-frontier`, then `--check-frontier`: **4 pass / 0 fail**):
- `covered` 21 → 22, and `lastArrival` is `{step 22, L0, r9-solve-13-v2}`;
- `sources` now carries the current `AP_1_rules.json` md5;
- `complete` is gone. `nextStep: null` with *"every remaining step SOLVES today … a GAP LIST"*. That is the survey's answer from staged boots, and the producer contradicts it at step 23 (see residue).

**The tick-0 block.** `director.test` reddened on *"r9-solve-13-v2 tick0: expected undefined"*: a grown segment's v11 block is the game's zero-tick reading, and the producer only carries it. `derive-seedling-tick0.mjs` could not run here, because it spelled `py.exe` and `:8000` inline. I ported it to `driverChannel`: headless by default, `--win` kept, the page on `SEEDLING_PORT`, the cache key unchanged.
- `--only=r9-solve-13-v2`: a calm zero-tick latch, 20 dead frames, clock 12173 + 21 = **12194 measured (delta 21, the boot cost exactly)**.
- `--check` then reads 4 FAILs. All are `r8-d2-19/20` and `r9-solve-19/20` "declared + bootCost" deltas (−16/−40), and **identical on a pristine `origin/main` worktree**.

**The six `--check`s at the head:** battery `410f27c0` · d2-chain `7cba9530` · l18 `cef8048e` · tail `9a6a3192` · r9-l3 `6cd35fe1`, all identical. **r9-campaign `46990775 → f30369a4`** (exit 0). It was `54189141` before the tick-0 block; the one differing line is `r9-solve-13-v2`'s byte count, 6,982 → 7,228.

**The census** (head): exit 0, chain **22/22, 6,221 t**, end L0 (48,192), tail 3/3 1,828 t, **NO CHAIN ROOM MOVES**; normalised md5 `2d2aeb00…`.

**The differential over the WHOLE chain** (`--only=` all 22 names; the chain has no headline, ⚖ 37), at the head: **675 PASS / 0 FAIL / 61 SKIP, ALL CHECKS PASSED.**
- The chain rows (`chain r9-campaign`) are **80 PASS / 4 SKIP**. The four SKIPs are the headline-less UNASKABLE rows: ends-meet arithmetic, stream slice, ending state, and the goal-ledger report 4/41.
- New rows: *"THE SEAM r9-solve-19 -> r9-solve-20 is GREEN"*, *"r9-solve-20 ends at a CALM ARRIVAL — 46 signature rows latched at tick 560"*, *"THE SEAM r9-solve-20 -> r9-solve-13-v2 is GREEN over the whole signature — 46 signature rows compared"*, *"the boundary tick is observed twice and agrees — r9-solve-20 ends {level 13, x 104, y 56, t 560}; r9-solve-13-v2 starts {… t 0}"*, *"r9-solve-13-v2 ends at a CALM ARRIVAL … tick 48"*.
- The run before the tick-0 block read the same 675/0/61.

**tapeRunner: 395** (393 + the new tape's two rows). Every old row passes, and the only moved expectation is `r9-solve-20`'s (the licence).

## D4: records (`0715d79`)

- `seedling-bot-log.md` § *Seedling substrate U13-swim — the campaign chain to sphere 2.2*, after U12's section. It gives the producer's shapes, the per-segment table, the wall, D3, and the trap candidates.
- The generated `campaign-chain` region now reads *"22 segments … to the L0 arrival, 6221 ticks"* and *"NO REFUSED STEP"*.
- `seedling-bot.md`: one campaign passage after step 24's (the route, 560 + 48 t, 22 windows / 6,221 t, the stop and why).
- Reference: `generate-procgen-reference.mjs` + `generate-docs-index.mjs`. `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED.
- Tape index: 168 → **169** (`generate-tape-index.mjs --check` OK).
- **Roster pins**, each moved by `r9-solve-13-v2` unless noted:
  - `tapeEnvelope` 168 → 169;
  - `observationTolerance` 168 → 169 ×2 (names, `tally.swapped`);
  - `dialogueAutoAdvance` 168/167 → 169/168 (inert);
  - `producerSegments` 27 → 28 and 30 → 31;
  - `tiers` campaign 30 → 31 (mechanic `roster − 52`);
  - `rerecordCampaign`'s licence list gains the cascade's new successor.
  - By `r9-solve-20` gaining a successor: `gameClock`'s ceremony list adds `r9-solve-20` (the shield); `playthroughAcceptance`'s tail arrival 20 → 0.
  - R8 batch: `r8Acceptance` green, no exposure change (the new room is L13, not bridged).
  - `lintGateLabels` green: no test title moved.
- Surface `--check` GREEN 189 (no solver goal kind moved, so no `--write`). Constants `--check` PASS, 4,654 literals, 0 drift.
- **Bounded vitest AFTER** (the 25 above + `placedTalk`, `tapeFormat`, `ulpDash`, `watchManual`, `watchWasm`, `boxLock`, `exportSeedlingView`, `provisionalLatch`): **33 files, 1,834 passed / 1 failed.** The failure is `rosterCategories` *"the LIVE row carries one part per derived category"*: `expected 30 to be 31`. The banked composite row's campaign part counts 30 tapes and the live tier counts 31. It moves only with `standing-values --write`, which is the coordinator's bank, so it is owed, not fixed.

**Trap candidates** (in the log):
1. A survey that stages every room from one pre-event block cannot see an event the route itself arms.
2. A frontier projected from that survey reads "gap list" while the producer stands at a wall.
3. A measuring instrument with one hard-coded channel (`derive-seedling-tick0`) blocks a cloud growth after every solve and recording has passed.

## What the brief got wrong (measured)

1. **"The solver already crosses every surveyed room through 2.2 … This slice makes the CAMPAIGN CHAIN play them."** The survey crosses them from STAGED pre-shield boots. The chain's real latch after L20 carries `beam: true`, and step 23 is refuted on the game at t3. The survey's 9/9 is not evidence for steps 23–30.
2. **"Total 4,796 t, so the chain becomes ≈ 10,570 t over 30 windows."** It omits `r9-solve-20`'s new exit leg: 161 → 560 t (+399). The arithmetic would have been 10,969 over 30. Measured: 6,221 over 22.
3. **"The campaign category … +9 unique names makes 39."** +1, so 31. The brief also assumed every name would be fresh, but two route steps revisit rooms that already own a segment name (`r9-solve-13`, `r9-solve-0`). `--grow` refuses a taken name, so `-v2`/`-v3` were needed.
4. **"After L32 the route ends at 2.2: a terminal `to: null` with the encounter as its goal."** Under L18b's law a terminal segment crosses NOTHING, but the route's own L32 goal is `then: 'reach-pit'` and falls to L30. The terminal claim and the census alignment both had to admit that one crossing (D1). It is moot for now.
5. **W0 "`--check-frontier`" as a banked green row.** It was exit 1 at the bank, on a stale `sources` row that predates this slice.
6. **The tooling list.** `derive-seedling-tick0.mjs` (the v11 block every grown segment owes) had no headless channel, and no item of the brief named it; `director.test` found it.
7. **The roster pins "each moved BY YOUR NEW TAPES".** Two more moved because `r9-solve-20` gained a successor, not because of a new tape: `gameClock`'s ceremony list and `playthroughAcceptance`'s tail arrival. And `rosterCategories`' composite row cannot move without the bank.

## Residue

- **The Moonrock beam is unmodelled.** It is a simulation family (`Moonrock.update`: the freeze, the facing, the beam, the fall, `rockSet`), which needs a licence the coordinator asks for. Every step from 23 on waits on it. One of its two witnesses already exists in the scratchpad: the refuted tape and the game's recording of it.
- **The D1 goal shapes are unexercised by any committed segment:** `pitTo`, `encounter`, the terminal-pit claim and the census's `terminalEndLevel`. Their first real use will be the growth past step 23.
- **The frontier says "GAP LIST"** where the producer refuses. The frontier only projects the survey and cannot carry a producer refusal. A future slice could add the producer's verdict as a second source.
- **`rosterCategories`' composite row** is red until the coordinator banks `standing-values` (⛔ not run here).
- **The full tier on CI** (`seedling-full-tier.yml`, the campaign category) has not run on the moved `r9-solve-20` or the new `r9-solve-13-v2`. That is the coordinator's dispatch (⚖ 70 (f)). ⚖ 52: no local unfiltered vitest was run.
- **`derive-seedling-tick0 --check`'s four delta FAILs** (`r8-d2-19/20`, `r9-solve-19/20`) are pre-existing and identical on main.
- The latch and tick-0 caches live in this container's `/mnt/c/playwright` and die with it. The NewDocs survey files are also local (gitignored).
- **Scratch** (session scratchpad, not committed): `clears-probe.mjs`, `body.mjs`, `wall.mjs`, `atlas.mjs`, the `refuted-0v3/` tape, trace and recording, and every run log. The scratch producer copy was deleted from `scripts/procgen/`.

## Byte-inertia

| Artifact | W0 (`6ebd344`) | head |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d` / `c4841acb` · OK | **identical** |
| five `--check`s (battery, d2-chain, l18, tail, r9-l3) | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1` | **identical** |
| r9-campaign `--check` | `46990775` | **`f30369a4`** (licensed) |
| reference `--check` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH (after the regeneration) |
| campaign census | NO MOVES, 21/21, 5,774 t | NO MOVES, **22/22, 6,221 t** |
| `--check-frontier` | 3/1 (stale `sources`) | **4/0** |
| survey through 2.2, steps 22–30 | U12's nine rows | the same (measured at W0; no solver file changed) |
| tapeRunner | 393 | **395** |
| surface / constants | — | GREEN 189 / PASS 4,654 |
| `fixtures/**` vs main | — | `r9-solve-20` tape + trace + expectation (licensed); `r9-solve-13-v2` tape + trace + expectation (new); `tapes/index.json`; `campaign-frontier.json`; and `fixtures/tiers.test.js`'s campaign pin (30 → 31). Nothing else. |

None of the following was touched or run: AS3, wasm, gitlinks, biome defaults, `standing-values --write`, `pytest`, unfiltered vitest, or R1's and J2's regions. `solverBot.js`, every simulation file and every other committed tape are byte-identical to main.
