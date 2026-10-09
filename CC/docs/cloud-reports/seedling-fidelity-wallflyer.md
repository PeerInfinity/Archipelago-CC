# Seedling fidelity WALLFLYER: a WallFlyer dies, keeps flying while it dies, and the shield turns one

| | |
|---|---|
| Session | `seedling-fidelity-wallflyer` (planner `seedling-fidelity-planning-4`, wave 9, model coverage) |
| Start SHA | `cf647f39ef` (main before the hammer arc's A2+A3; not rebased) |
| Head | see the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/wallflyer-death-staging-qb19h5` (local `seedling-fidelity-wallflyer`) |
| Commits | D1 `63fe786` · D2 `6ea4ad7` · D3 `4c950ea` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (two switches, both ship ON) · D3 PASS** |

**The one thing to know first.** The kill was not the whole wall. The step-47 plan that "needed" the kill was built
on a model with no **shield bump on a wallflyer**. `Player.shieldBump` calls `WallFlyer.knockback`, which is `v = -v`
with no gate, and the model never asked it. I found this on the game while witnessing the kill. With W7 (that bump)
ON, step 47 solves **without killing anything** (201 t, game-exact at 0 px). W6 (the kill) is staged and witnessed
too. Both ship ON: no committed tape, producer `--check` or identity row moved.

## W0 — bank at base (`cf647f39ef`, primary tree, pristine)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9500 bash scripts/procgen/identity-block.sh .` | log md5 `dd28b242fd23f89bda5e7235ec6ea0c2`; maze `246dfbce…`, acceptance `608693d2…`, pairs c3 `043e1944…` c6 `f85e7722…` c4 `4aa74add…`, ENEMY `25417923…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2 `01210c82…` s5 `07ce222a…` s9 `30a1e3e7…`, pre-sword `e28c1e5d…`, post-sword `fb1a59e5…` |
| six `--check`s | in the block | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, all exit 0 (= the wave-8 bank) |
| generated set | `check-seedling-generated-set.mjs`, re-run alone | `OK` (the block's own row printed a box-lock refusal: my probe held the box) |
| reference | in the block | 4 DIFFER: environmental (the substrate submodules are absent here: registry, capabilities, substrate-registry, procgen-substrates) |
| surface / constants / entities / profile | the four `--check`s | **GREEN 220** · **PASS 5,414** · **PASS 528** · **PASS 138** (both) |
| roster | `fixtures/tapes/index.json` | **250** |
| bounded vitest BEFORE | 47 files (below) | **47 files / 2,431 tests, all green**, md5 `2090bdfd…`; tapeRunner **557** pairs, `ddb1bec5143bf87673a2335ce2a31e7d` (`status\tfullName`, sorted, `\n`-joined) |

The 47 files: the brief's standing set (`r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`,
`tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`,
`fidelityArrival`, `fidelityAxe`, `fidelityKillLock`, `fidelityLadder2`, `bobSoldier`, `solverReachPit`, `arrowTrap`,
`oneSpelling`, `enemyDamage`, `contactFidelity`, `decisionTrace`, `entityBlocks`, `solverDeadline`,
`seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations`, `boxLock`, `lintGateLabels`, `seedlingSolverSurface`,
`seedlingConstantsCensus`), my region (`wallFlyer`, `levelRun`, `tapeRunner`), and every `rg -a` hit for
`CONTACT_FIDELITY|withContactFidelity|wallFlyer|wallflyer|WallFlyer|shieldBumps|CORPSE_COUNTING|KILL_SIDE_WRITES|
KILL_ARM_POLICY|killArmModelled|MODELLED_KILL_ARMS|removalTicksAfterHit|chaserPressHits` in `*.test.js`:
`botDriverV2`, `chasers`, `combat`, `encounters`, `entityRecords` (+ `.agreement`), `fidelityF4`, `iceTurret`,
`shieldBossFight`, `solverBot`, `spinner`, `arrivalCompositesLegs`; plus `checkProcgenHelp`, `procgenHelpBaseline`
(new scripts). AFTER adds `fidelityWallFlyer` (new).

## D1 — the class, measured (PASS)

Read off `vendor/seedling/src/Enemies/WallFlyer.as`, `Enemy.as`, `Mobile.as`, `Game.as`:

- `hitsMax` 3 and `hitsTimerMax` 30 (`Enemy`'s, not overridden); `knockback` is OVERRIDDEN to `v = -v`
  (`WallFlyer.as:172-176`) with **no** `!destroy`/"die" gate.
- `startDeath(t)` = `play("die"); dieEffects(t)`, with **no `destroy`**. `add("die", [5,6,7,8], 10)` gives 4 frames
  and 13 graphic updates. `dieEffects("Sword"|"Spear")` adds a `SlashHit`, an untyped visual `Entity` that nothing
  reads.
- `endAnim`'s "die" arm sets `destroy` (and plays `""`). `Mobile.death` then takes 0.1 alpha a tick: 11 subtractions,
  then `FP.world.remove`.
- `totalEnemies()` counts `classCount(WallFlyer)` until the removal. Its readers are `Lock`/`RockLock` (`tSet == -1`)
  and `LightBossController`. **L22, L25 and L27 hold no `tset -1` lock** (`killLockLedger` scan: nil).
- No `removed()` in the chain, no `setPersistence`, and `dropCoins` has no caller in the class. A kill writes nothing,
  and a re-entered room rebuilds the body.
- **While dying the body keeps moving.** `Enemy.update` → `mobileUpdate` runs while `!destroy`, and the killing hit
  takes no knockback. `WallFlyer.update`'s tail (trigger, `activeOffScreen`) returns on the anim, and `hitPlayer` is
  gated on the anim. That gate is unreachable for this class: every kill sets the 30-tick i-frame, which outlasts the
  13-update anim (mutant M5, below).

**The game agrees, field by field.** New instrument `probe-seedling-wallflyer-mobiles.mjs` (box-locked; `--tape`,
`--file`, `--out`, `--record`) samples `botMobiles()` while a tape replays. It compares every WallFlyer row (x, y, vx,
vy, `hits`, `hits_timer`, `anim == "die"` and its `anim_index`, `destroy`, `alpha`, presence) against the model at the
same tick. It joins by the cheapest assignment (two flyers on one ray CROSS: a nearest-first join swapped them) and
calibrates the clock off the player.

| tape | game | model | comparisons, worst |Δ| |
|---|---|---|---|
| `wallflyer-kill` | "die" t66, `destroy` t79, count 4 → 3 between t89 and t90 | killed@65 (press tick), die t66, destroy t79, removed t90 | 387, **0** |
| `wallflyer-kill-flight` | "die" t86, `destroy` t99, count 4 → 3 at t110 | the same; the corpse x 79 → 131 | 455, **0** |
| `wallflyer-shield-bump` | turns at t5/7/9/13 | the same | 100, **0** |

The removal comes 25 ticks after the press = 13 (anim) + 11 (fade) + 1. That +1 is the documented press fencepost: the
Player updates last, so the anim's first update is the next tick.

## D2 — the model (PASS; two switches, both ON)

**W6 `contactFidelity.wallFlyerKill`.** `wallFlyer.js` already transcribed the anim, `endAnim`'s `destroy`, the fade
and the removal. Only the entry was refused, in two places: TERRAIN W2's press arm and R2-swim D1's dark-suit
retaliation. Both now call `levelRun.stageWallFlyerKill(w, by, t, refusal)`:
- **ON**: it computes `killLockLedger(levelSource(level), …)` with every wallflyer the visit has already doomed taken
  out of `bodiesAfter`, and refuses by name if the removal would open a `tset -1` lock (or if a room has locks but no
  census). Otherwise it logs a `killed` event.
- **OFF**: it throws the two old refusals, word for word.

Table and record changes:
- `chaserPressHits[].killed` / the press row's `hits[].killed` now carry the verdict. They were hard-coded `false`.
- `KILL_ARM_POLICY.WallFlyer` is a getter on the switch (Jellyfish's shape).
- New rows `CORPSE_COUNTING.WallFlyer` (`anim+fade`, `chaserTag: null`) and `KILL_SIDE_WRITES.WallFlyer` (`none`).
- New export `wallFlyer.wallFlyerDeathTicks()` (13, through `chasers.animTicks`).

**W7 `contactFidelity.wallFlyerShieldBump`.** `shieldBumpNow` gains a wallflyer arm. A touched flyer gets `v = -v`
(no gate). The dark arm is `hitWallFlyer(t: "Shield", 0.5)`, and a kill there is `stageWallFlyerKill`'s. Ledger rows
are `family: 'wallflyer'`. It is asked only where the flyers are stepped (`!noDamage`).

**Why W7 is in this slice.** The first game witness of W6 was survey step 47's own walk. It left the game at **t52**:
`wallflyer@64,80` reversed with `hits_timer` 24 and no hit, then reversed back at t53, as the player's shield crossed
it. The kill plan was built on a flyer the game had already turned. With W6+W7 ON that walk is game-exact, player
included (230 ticks, 920 body comparisons, |Δ| 0).

**Movers with both ON**:
- tapeRunner: 557 pairs, md5 `ddb1bec5…` = base = OFF.
- The six producers: identical, campaign `a569eeec` included.
- `plan-seedling-r2-wallflyer --check`: exit 0.

**So both ship ON** (TERRAIN's precedent). `SEEDLING_CONTACT_FIDELITY=…` without the two keys is the BEFORE model.

## D3 — witnesses + census (PASS)

**Game witnesses** (`plan-seedling-wallflyer.mjs [--check]`, recorded with `check-seedling-bot-differential --record
--only=…`, "ALL CHECKS PASSED (recording mode)"; bodies in the D1 table). `fixtures/wallflyer-witness/*.json` are the
probe's `--record` samples. `fidelityWallFlyer.test.js` (12 rows) replays them in node, and also asserts:
- the death timelines;
- the flying corpse;
- the turns;
- W6 OFF throws the W2 words verbatim;
- W7 OFF leaves the game at t5.

**Mutants** (each predicted first, made by copy + restore in the scratch worktree, run against `fidelityWallFlyer`):

| mutant | predicted | measured |
|---|---|---|
| M1 a dying body stops moving | `-flight` red from t86; rest kill and shield green | ✔ 2 red (`-flight` body rows, the corpse row) |
| M2 the press fencepost removed (anim steps on the blow) | both kills red | ✔ 4 red |
| M3 W7's turn gated on `!destroy && !die` | no witness changes: a **coverage hole** | ✔ 12 green (no witness shields a dying flyer) |
| M5 `hitPlayer`'s "die" gate removed | `-flight` red (a contact as the corpse crosses) | ✘ **12 green**: an EQUIVALENT mutant. The 30-tick i-frame always covers the 13-update anim. My prediction was wrong |

### The survey / sweep rows this moves (before → after)

| row | before | after | how measured |
|---|---|---|---|
| survey **step 47** (L22 → L29) | REFUSED (the kill) | **SOLVED 201 t**, 1 hit, 0 deaths; W7 alone also gives 201 t; the walk is game-exact (202 ticks, 804 body rows, |Δ| 0) | `survey-seedling-route.mjs --through=end --route=full --only=47`, locally (0.5 s) |
| survey step 45 (L22) | SOLVED 113 | SOLVED 113 | the same |
| survey step 46 (L25) | REFUSED (chest in rock2) | the same | the same |
| survey **step 53** (L22 → L21) | SOLVED 278 t, 2 hits | **SOLVED 406 t, 6 hits, 2 deaths** (W7 alone) | the same, per switch |
| JS-arc leg **262** `level_22 <- in_L25 -> level_29__r2c2` (the brief's) | failed: the kill refusal | **done** | `probe-seedling-divergence-sweep.mjs --mode=inv --ids=262,263,265 --page-legs=1 --host=http://localhost:9500`, locally |
| JS-arc leg **263** `level_22 <- in_L29 -> level_25` | failed: the kill refusal (`wallflyer@128,80`) | **done** | the same |
| JS-arc leg 265 `level_22 <- in_L29 -> level_30` | diverged t112 (0.04 px, exact repeat) | the same t112, same rows | the same: not this slice's |
| JS-arc legs 255 259 267 285 286 289 290 293 294 296 297 309 (the other wallflyer-room legs) | done | done (12/12) | the same |

**Step 53, read on the game.** I played both walks with the body probe:
- **BEFORE walk (278 t)**: the new model follows the game at 0 px (279 ticks, 1,116 rows). The W7-OFF model leaves
  at t36 on a shield turn. On the game this walk takes 2 hits and **ends in L22 at (49.6, 34.1): it never reaches the
  exit**. The old SOLVED was false.
- **AFTER walk (406 t)**: game-exact too (407 ticks, 1,624 rows, deaths included). It exits, but dies twice.

The new verdict is truer, and its plan is bad. That is residue for the solver (below).

## The JS arc's pins and what it must wire

- No signature or contract changed. No new `SolverRefusal.obstacle.kind`.
- New refusal texts, both by name:
  - a wallflyer kill whose removal would open a kill lock: *"… moves `totalEnemies()` past a kill lock … (seedling-fidelity-wallflyer W6)"*, unreachable today;
  - a dark-shield kill under W6 OFF.
- New optional fields:
  - `run.wallFlyers.events` gains `kind: 'killed'` rows `{t, level, id, by, x, y, vx, vy}`;
  - `chaserPressHits[]` rows with `tag: 'wallflyer'` can carry `killed: true`;
  - `run.shieldBumps` gains `family: 'wallflyer'` rows.
- The page and the solve worker run the defaults (both ON). Legs 262/263 already play through the production page
  locally. The arc should re-bank its sweep rows for L22.

## Deltas

| | before | after |
|---|---|---|
| roster | 250 | **253** (`wallflyer-kill`, `wallflyer-kill-flight`, `wallflyer-shield-bump`) |
| tapeRunner | 557, `ddb1bec5…` | **563**, `9aea120c…`; all 557 old rows identical |
| R8 exposure | 73 | **76** (the three, L22; declarations in `r8Acceptance.js`, mirror pins) |
| bounded vitest | 47 / 2,431 | **48 / 2,452, all green** (primary tree) |
| surface / constants / entities / profile | 220 / 5,414 / 528 / 138 | **220 / 5,420** (5 `shieldBumpNow` literals classified) **/ 528 / 138** |
| instruments | 391 | **393** (`probe-seedling-wallflyer-mobiles` in the box-lock guarded list) |

## What the brief got wrong (measured)

1. *"its die anim, its fade and its place in `totalEnemies()` are not staged"*: they were. `wallFlyer.js` had the
   anim, `endAnim`'s `destroy`, the fade and the removal since R2-swim. Only the entry was refused (two sites).
2. *"a plan that kills it refuses"*: the plan that killed it was the artifact of a missing mechanism, the shield
   bump. With W7 the step-47 solve kills nothing. Lifting the refusal alone (W6 only) gave SOLVED 229 t with a walk the
   game does NOT play (it leaves at t52).
3. *"measure step 47 on CI (`seedling-survey.yml -f only=47`)"*: `workflow_dispatch` is refused to this session
   (HTTP 403 "Resource not accessible by integration", MCP and `gh` alike). Step 47 costs 0.5 s, so it was measured
   locally. **The CI re-run is for the planner** (`seedling-survey.yml -f route=full -f only=45,46,47,53 -f
   base_run=37661110536`).
4. *"BOBSOLDIER found a corpse that keeps swinging"*: the WallFlyer analogue is a corpse that keeps FLYING. It is
   harmless, so its contact gate is never the deciding one.

## Residue

- **Step 53's new plan dies twice** (t99, t235, both wallflyer contacts, game-confirmed). Two causes:
  - the solver's danger pricing does not see a shield-turned flyer;
  - the survey still counts a solve with deaths as SOLVED.

  Both are solver/danger-map work, outside this slice.
- **M3's hole**: no witness shields a DYING flyer.
- **The kill-lock arm of `stageWallFlyerKill` is a bounded vacuity**: no wallflyer room has a `tset -1` lock.
- **Unchanged residue**: leg 265's t112 0.04 px divergence.
- `wallFlyer.js`'s header cites `WallFlyer.as:200-204` for `knockback`. The pinned source has it at 172-176
  (pre-existing; not edited).
- **The dark-shield arm of W7 has no game witness** (no wallflyer room is reached with the dark shield on any tape).

## Byte-inertia (AFTER, primary tree, both switches ON)

- **Identity block**: every row equals BEFORE: maze … post-sword, and the six `--check`s
  `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, all exit 0.
- **generated set**: `OK` (re-run alone; the block's row met my sweep's box).
- **Reference**: the base's four environmental DIFFERs only, after regeneration (mine: architecture §instruments,
  README §docs-index, `instruments.js`, `docsIndex.js`, `seedling-constants.md` §region).

## CI at the pushed head

`node scripts/procgen/ci-vitest-summary.mjs 4c950ea`: run 37985261092. JavaScript Unit Tests: **19,234 / 19,235**.
The one red is `rosterCategories.test.js` › *the LIVE row carries one part per derived category*: `expected 190 to be
193`. The standing composite roster row still quotes the pre-slice tape count, and the three new tapes raise it. That
row is re-quoted by the planner's bank commit (`chore(bank): … composite roster re-quoted …`, as for BOBSOLDIER's 248
and hammer-A's 250). This slice may not run `standing-values --write`, so it is a **bank row**, not a defect. No
other row is red.

## Rows to BANK

- **The composite roster row, re-quoted at 253 tapes** (`rosterCategories` stays red until then: 190 → 193 in the
  category the three L22 witnesses join).

- `plan-seedling-wallflyer --check`: all checks green (three tapes byte-identical).
- `probe-seedling-wallflyer-mobiles --tape=<each>`: PASS/PASS, worst |Δ| 0 (387 / 455 / 100).
- `fidelityWallFlyer.test.js`: 12/12.
- Survey step 47 SOLVED 201 t; step 53 SOLVED 406 t (2 deaths, residue).
- JS-arc legs 262/263 done.
- Roster 253; tapeRunner 563; exposure 76; surface GREEN 220; constants PASS 5,420; entities 528; profile 138;
  instruments 393.

## Trap candidates

- **A refusal can hide a missing mechanism one tick earlier.** The kill refusal was the visible wall. The plan behind
  it was built on a flyer the shield should already have turned. Only the body probe on the solver's own walk showed
  it.
- **An override drops the base method's gate.** `WallFlyer.knockback` replaces `Enemy.knockback`, and its
  `!destroy`/"die" test goes with it.
- **A gate can be dead by arithmetic.** The i-frame (30) outlasts the anim (13), so M5 is an equivalent mutant.
- **A nearest-body join swaps crossing bodies.** Two flyers on one ray pass each other, so a probe's join must be an
  assignment.
