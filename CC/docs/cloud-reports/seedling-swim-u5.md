# Seedling swim U5: R-f, L32 (Bob Boss) as an `encounter` goal, the BobBoss simulation, step 30 solved

**Slice:** `seedling-swim-u5`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §16). It ran in parallel with U6 (the kill rung's press arm and `dangerMap.spinnerDanger`), U7 (`chasers.js`, `combat.js`, `enemyDamage.js`) and U8 (`procgenSeedling`, biome defaults, presets). This slice touched none of their regions.

| | |
|---|---|
| Started from | `origin/main` @ `f4a4a28` (`4081ecc742` + two bank commits; the harness branch already sat on it) |
| Harness branch | `claude/bobboss-encounter-goal-0kb2ko` |
| Part 1 (the brief) | D1 `165e27b` · D4 `0545dc9` · D5 `d9df86b` · first report `74703bb` |
| Part 2 (after the user licensed the simulation) | simulation `989d8e2` · executor + shield bump `39d6f5c` · witness fixture `f03baa7` · records and this report (last) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS (bank) / premise FAILED** | Every banked row reproduced. The brief's §1 premise was false: the model played none of the encounter (it diverged at t=15, the arm frame). |
| D1 | **PASS** | `encounter` is a goal kind (`assertGoal` with four kinds, `decisionTrace`, the survey's step 30). The default survey mode is byte-identical. |
| D2 | **PASS (after a STOP)** | Stopped on W0's measurement. The user then licensed a BobBoss simulation family (`bobBossFight.js`). The three `r5-bobboss-*` tapes now match their oracles exactly, and `MODEL_EXEMPT` is retired. The executor (`ENCOUNTER_EXECUTORS.Fire`) is derived from it: forecast-searched strikes, verified landings, pages, the drop, the burn, the pit. |
| D3 | **PASS** | `swim-u5-bobboss-encounter` (1,056 t) is recorded against the live game: ALL CHECKS PASSED, and the model reproduces the recording it made. Its first recording REFUTED the model and found **`Player.shieldBump`**, now modelled for the boss. |
| D4 | **PASS** | **Step 30 SOLVES, 1,056 ticks**, 0 hits, ending in L30. Steps 22, 23 and 25–29 are byte-identical to U4's rows. **HEADLINE 8/9.** |
| D5 | **PASS** | Log § U5-swim, the bot-page paragraph, reference and docs index regenerated, surface GREEN 187, constants census PASS, bounded vitest 24 files / 1,155. |

**The one thing to know first.** The live game shoves enemies with the player's shield, and the model has no shove for any enemy but L32's boss. `Player.shieldBump` runs every frame with no freeze gate: a moving player holding the shield calls `knockback(5, playerPoint)` on every `Enemy` touching the shield's box. The R5 tapes never held a shield, so nothing had seen it. The survey's boot holds one, and the first recording of the solver's walk parted from the model at t=419: the game's player was knocked (−2.613, 0) by a boss the model had placed elsewhere. I transcribed the bump for the BobBoss only, inside the licensed family. Bobs, spinners and every other stepped `Enemy` still lack it. That gap lives in U7's chaser region, so it needs its own slice before any shielded walk near a chaser is trusted.

## W0: the banked rows (clean tree `f4a4a28`)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8860`), stdout md5 `c55eb622…` | maze `246dfbce…`, acceptance `d02ed4c0…`, c3 `d43a8c97…`, c6 `62b5475f…`, c4 `556eb1ee…`, ENEMY `fdff69ee…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`999e1900…`, level pre/post s1 `e28c1e5d…`/`0076f26f…`, generated set OK, reference ALL 7 + 5 MATCH. All equal U4b's table. |
| six r8/r9 `--check`s | `410f27c0` `b470c14d` `17be7d70` `9a6a3192` `6cd35fe1` `2823a811`, all exit 0 |
| campaign census | exit 0, `NO CHAIN ROOM MOVES`, md5 `88fa2333…` |
| survey default `--derive-only` / `route.json` | `27ff43db…` / `1e08f9ad…` |
| survey through-2.2 derive / route | `1172328c…` / `dae52ec7…` |
| solver surface `--check` | GREEN 185 |
| `census-seedling-constants --check` | PASS |
| bounded vitest BEFORE (the brief's eight paths) | **9 files / 572 tests**, green (`tapeRunner` 365) |
| `--through=2.2 --only=30 --out=/tmp/…/w0.json` | REFUSED, verbatim: *"solverBot(survey-step-30): collect-placement (64,128) resolves to NOTHING in level 32 — no chest and no pickup stands there. A goal about an absent thing is a macro-layer error, said here rather than walked at."* (family `unclassified`) |

### The replay: what the brief asked to be measured, and what could be measured

The brief asked for a model replay of `r5-bobboss-fire` printing the freeze spans, the dialogue pages, the form transitions, the boss's hits per landing, the Fire's tick and the persistence writes. **The model has none of them.** Measured (scratch probes `w0-replay.mjs` and `w0-model.mjs`; every progress field, ledger kind and entity family sampled per tick):

| Fact | Model | Game (its recording, and `dead-frame-observations.json`) |
|---|---|---|
| first stream divergence | t=15: model y 115.35, game y 116.85 (the game froze) | — |
| end of tape (t=2500) | (80, 34.05): walked to the top wall | (80, 80.70): standing on the Fire's spot |
| rock arm / fall | `rockFalls` = `[]` for all 2,500 ticks | stream first reads y < 120 at t=12 (y 119), and holds still from t=14 |
| frozen frames | one dead span, `load` 20 frames | 345 dead = 21 boot + **174** rock + **150** Fire phase A. The three dialogues are therefore NOT dead frames: they consume tape ticks |
| boss roster / hits | no family holds a BobBoss | not observable in a position stream |
| form transitions | none | the first teleport to (80,120) is visible from t=293 to t=294. The second lands on the same spot, so it is invisible |
| dialogue pages | none (`inCeremony` never true) | not attributable from a position stream: the player stands still at t=14–121 through four presses (t=26, 57, 88, 119), and form 0's text is three pages |
| `hasFire` | never true | the Fire is touched at t=1830 (y 84.75); then 150 dead frames, and the text |
| persistence writes | `roomWrites` / `earnedClears` stay empty | {32,1} and {31,29} (the R5 batch's ledger assertion, `r5Acceptance`) |
| the only ledger that moves | `presses` (380 entries by t=2500) | — |

The tape presses at the 31-tick cadence: 76 rising edges, the first at t=26. Its only keys are `up` (t=4–17 and t=1800–1879) and `primary`.

## D1: the goal kind (`165e27b`)

- **`assertGoal`** accepts `{kind: 'encounter', at: {x, y}, drop: {item}, then: 'reach-pit' | null}` and refuses any other shape by name. The unknown-kind refusal lists the four kinds.
- **`decisionTrace.KNOWN_GOAL_KINDS`** gains `encounter`.
- **The goal loop** looks the executor up by the drop, in `ENCOUNTER_EXECUTORS`. This mirrors `STRATEGY_EXECUTORS`' "selected but not registered" idiom. The table was **empty** at D1, and its docblock said why (the W0 measurement); Part 2 registered `Fire`. The refusal fires before a tick:
  > *solverBot(survey-step-30) encounter (64,128)->Fire: no encounter executor is registered for a 'Fire' drop in level 32. The model does not simulate this encounter: no entity family holds the boss, the arena's `fallrocklarge` never falls (`rockFalls` stays empty), no dialogue or form transition freezes the run, and nothing spawns the drop. `r5-bobboss-fire` DIVERGES from the game at t=15, the arm frame (`r5Chain.MODEL_EXEMPT`). An executor derived from the model needs the encounter MODELLED first, which is a simulation family, not a solver policy.*

  The obstacle is `{kind: 'unmodelled-encounter', id: 'encounter@64,128'}`.
- **The survey** (`encounterGoal`): `at` = `encounterCoords` (the atlas tile, unchanged), `drop.item` = the sphere row's item (`Fire`), and `then` = `'reach-pit'` when the level's **control block** names a `fallthrough` (L32: `fallthrough 30`, pits (4,0) (5,0) under `burnabletree@64,0`), else `null`. I did not use `pitEdgeFor`: it is keyed on a route hop, the through-2.2 route ends in L32, and the solver resolves which tile. `pickupCoords` lost its now-unreachable encounter branch.
- **`surveyFamily`** gains `ENCOUNTER-UNMODELLED`, so step 30 is no longer `unclassified`.
- **Unit rows** (`solverEncounter.test.js`, 6):
  - the accept and refuse shapes;
  - the four-kind refusal;
  - the L32 run from the survey boot (72,120) with the sword, refusing by name at `ticksCompleted 0`;
  - the registry having no Fire row;
  - **the guard**: the model replay pins `rockFalls []`, dead spans `['load']` and `hasFire` false. The day the model simulates the fight, this row goes red and the executor is owed (the `EXPECTED_TO_DIVERGE` pattern).
  - `solverReachPit.test.js`'s kind-list row is updated, and its title no longer carries a count.
- **Default mode byte-identical:** `27ff43db…` / `1e08f9ad…`. The through-2.2 pair moves **by exactly step 30's goal**: `d200a51f…` / `845a1cd3…`. Checked in a pristine worktree: the `route.json` diff is the goal object, and the stdout diff is the one `goals:` line, plus the path line that a worktree always differs on.
- **Mutant** (the `encounter` arm of `assertGoal` renamed away, one build). Predicted: the accept row, the shape-refusal row and the refuses-by-name row go red (*"unknown goal kind"*); the kind-list, registry and replay rows stay green. Measured: **3 red / 3 green, exactly those**. Restored md5-identical (`7edcf9ff…`).

## Part 1: D2 and D3 as first measured (STOP), kept for the record

### D2 (STOP)

What the brief's executor needs, and what the run exposes:

| Leg | Needs | The run |
|---|---|---|
| (a) arm + wait | the frozen span | the rock never arms (`fallrocklarge` ∉ `FALL_RESPONDERS`), and no freeze |
| (b) per form | the boss as a chase body, and its hits per landing | no family holds a BobBoss. `chasers` has no row; `bosses` is L43's totem |
| (b) pages | the freeze flag, to tell a page from a swing | no dialogue, and `inCeremony` never true |
| (c) drop | `hasFire` + the two persistence writes | never |
| (d) burn + pit | `burnableTree` + `reach-pit` | exists, but is unreachable without (c) |

A getter can expose a fact the run computes. These facts are not computed. Simulating them means writing a BobBoss family in `levelRun.js`, from `bobBoss.js`'s transcription: the rock, three forms, the transitions with the per-frame teleport, the dialogues, and the runtime Fire. That is ⛔ for this slice. No executor was written, no tick prediction was made (there is no run to predict), and the brief's two mutants have nothing to act on. `KILL_ARM_POLICY.BobBoss` stays `refused`.

### D3 (STOP)

There is no executor, so no tape. The differential's model half would diverge at the arm frame, as `r5-bobboss-fire` already does. No tape was committed. `r5-bobboss-*` are untouched, and `git diff origin/main -- frontend/modules/seedlingDemo/fixtures` is empty.

## Part 2: the BobBoss simulation family (`989d8e2`, shield bump in `39d6f5c`)

**What it transcribes.** `bobBossFight.js` steps the encounter, built from `Enemies/BobBoss.as`, `BobSoldier.as`, `Enemy.as`, `Mobile.as`, `Scenery/FallRockLarge.as` and `NPCs/BobBossNPC.as`. `levelRun` runs it per visit, for a `thirdboss` rock only (`levelWorld` now carries `bossRock`/`thirdBoss`), so L82's boss-less large rock is unchanged:
- **The rock.** It arms when the player's y < 120. The arm frame is a live tape tick with a frozen player, followed by 174 dead frames (`rockSchedule().bossSpawnsAt`) and the release frame's unobserved step. The {32,1} write lands on the arm frame.
- **Three forms.** Each has its chase (`runRange` 80, moveSpeed 0.5/0.65/0.5), its swords (forms 0 and 1 spin for ever, form 2 a turn at a time and re-seeds on each hit), `hitsTimer` 30, body contact gated on those i-frames, and `hit` with force 0.
- **Transitions.** `receiveInput = false`, `directionFace = 1`, the pin to (80,120) for the last 40 frames, and `hits = 0` at the spawn.
- **Dialogues.** Three `BobBossNPC` dialogues, live ticks with a frozen player, paged by the release (`dialogue.js`).
- **The Fire.** Runtime-added, with a ceremony (150 dead frames, then pages) and `removed()`'s out-of-band {31,29}.
- **The shield.** `Player.shieldBump` against the boss only.

**Three source facts only the game's recordings found (each was a measured divergence first):**
1. **The boss updates BEFORE its own NPC.** The ctor queues `new BobBossNPC` inside itself, before the caller queues the boss, and `addUpdate` prepends. So on every dialogue frame the boss reads the freeze flag the previous frame's `Game.update` tail lowered, and it forms, chases and swings while the player is held. With the NPC first, the first kill landed 62 ticks late.
2. **The graphic-less NPC is a wall.** It is a zero-size `Solid` at (80,80), and `Entity.collide`'s strict test still catches a box that straddles the point. The boss spawns centred on it, so it cannot move until the NPC removes itself. Without this, the first kill landed one press early.
3. **`Player.shieldBump`** (above). It was found by the witness, below.

**Retired.** `r5Chain.MODEL_EXEMPT` is now `{}`. `r5-bobboss-arm` (901), `-fire` (2,501) and `-fire-control` (2,501) match their committed oracle recordings exactly, with no re-record (`tapeRunner.test.js`'s blanket sweep). On the live game the differential reads 84 PASS / 0 FAIL on the three tapes. Its dead-frame budget is now spent from the model's own spans: 174 freeze + 150 pickup + the load residue.

**The run's new surface.** Entity family `bobBoss` (a Map by role: `rock`, `boss`, `dialogue`, `pending`, `fire`); ledger kind `bobBossEvents`; method `bobBossForecast()` (surface row `seedling`/`forecast`); `inputRefused` covers a transition. A death in the fight is REFUSED by name: the reboot into a fallen rock with an immediate respawn is not modelled.

## Part 2: the executor (`39d6f5c`)

`execBobBossEncounter`, registered as `ENCOUNTER_EXECUTORS.Fire`:
- **(a) Arm.** Hold `up` until `run.entities('bobBoss').get('rock').armed`.
- **(b) Per form.**
  - **Dialogue:** page with `ceremonyCadenceStep`, and count pages from the `dialogue-release` rows, never as landings.
  - **Transition:** hold nothing while `inputRefused`.
  - **Strike:** search plans against `run.bobBossForecast()`. A plan holds one of nine key sets for n ≤ 72 ticks, presses, then holds one of nine for a 48-tick tail. Each forecast tick runs in `advance`'s own order: the boss step, `shieldBump`, the slash timer, the due tests, `slashSet` for the press, the player step, and `slashEnd`. A plan is admitted only if no sword line and no body touch the player and the press is an ordinary `slash`. The earliest landing wins.
  - **Verification:** after the press, the landing is checked on the run's `boss-hit` rows. A mismatch refuses by name.
  - **No admissible strike:** take the key set whose forecast stays untouched longest, for 6 ticks.
- **(c) Drop.** Walk onto the Fire, page its ceremony, and require `hasFire` plus both writes (`rock-armed`, `fire-removed`).
- **(d) Burn.** Equip slot 1 **one tick after the flag**: `addItemsFromSave` rebuilds the slot array in the next frame's `Game.update` tail, after `Bot.update` has applied that frame's equips (the live game measured it, below). Then walk to the nearest stance whose `fireRect` reaches the tree, come to rest, and run `botDriverV2.runFire` (newly exported) with `overPit: true`: the tree stands on L32's pit tiles, so its cell is a pit after the burn, and the leg declares that. The goal loop then falls the nearest pit through the `reach-pit` code, now shared.
- `solveSegment` returns its own slot selections (`equips`). The survey applies them in the replay and writes them into the walk tape.

**Mutants** (each predicted first; one build; copied and restored md5-identical):
- (a) Landings read off the player's hits. Predicted: refuses at the first strike. Measured: *"the forecast landed form 0's hit at +11 and the run's boss reports 0 landing(s)"*. **As predicted.**
- (b) The page/swing distinction dropped (no dialogue branch). Predicted: no page is ever sent, so it refuses at the 8,000-tick bound. Measured: refuses earlier, at t=23, *"the forecast landed form 0's hit at +12 and the run's boss reports 0 landing(s)"*. The strike search ran during the dialogue, and its forecast does not hold the player frozen. **Red by name, but not where I predicted.**

**Unit rows** (`solverEncounter.test.js`, 6), from `r5-bobboss-fire`'s committed boot (honest, sword granted, no shield):
- SOLVES in 1,042 ticks with 0 player hits. Landings run forms `[0,0,1,1,1,2,2]` with kills `[0,1,2]`; drop at t=825 with 7 landings and 14 pages; equip `{t: 826, slot: 1}`; the pit at t=962 with an 80-tick coast. The two writes are `rock-armed` and `fire-removed`.
- The registry holds `Fire`; an unregistered drop refuses by name before a tick.
- The replay row pins t=12's arm, the three kills, the pages `[3,7,4]`, and the dead spans `load 20 · freeze 174 · ceremony 150`.

## Part 2: D3, the witness (`f03baa7`)

1. **First recording: REFUTED.** I recorded the survey's step-30 walk (then 1,053 t, `--record --only=swim-u5-bobboss-encounter`, headless). The game took 2 hits where the model took 0, and the tape disarmed at the equip. The streams agreed for **418 ticks** and parted at t=419 by Δx −2.15. `Player.knockback` adds only components with |c| ≥ 0.5, so the game's impulse (≈ −2.6, 0) came from a force-3 hit up and to the right of the player. The model's boss was below the player, dying. Reading `Player.update` found `shieldBump`.
2. **Shield bump modelled.** The model then reproduced that same game recording exactly through its own death at t=497, including the t=419 knockback (−2.61317622827665, 0) to the digit.
3. **Second recording.** The re-solved walk (1,064 t) failed only on the equip: the game's slot array held one item on the flag's tick. That fixed the one-tick wait.
4. **Third recording: ALL CHECKS PASSED (recording mode, 32 PASS).** The tape is `swim-u5-bobboss-encounter`, 1,056 ticks. Rows measured:
   - **THE MODEL REPRODUCES THE RECORDING IT JUST MADE:** 1,057 observations, 1 transition;
   - all 14 items;
   - both encounter writes off in the game;
   - the game refused input where the model says (3 form transitions, 1 pit transport);
   - dead frames 364 = 174 + 150 + two loads;
   - `hits` 0 and `hits_timer` 0 against the model;
   - every edge seen.
5. **Non-record differential** over this tape and the three `r5-bobboss-*`: **109 PASS / 0 FAIL**.

The tape and its expectation are committed, and the tape index is regenerated (155). `r5-bobboss-*` are untouched. Per ⚖ 70 (f), the coordinator dispatches `seedling-full-tier.yml` at the merge.

## D4: the survey (final)

`--through=2.2 --only=22,23,25,26,27,28,29,30 --timeout=600 --out=CC/docs/cloud-reports/seedling-swim-u5-survey.json` (md5 `0351288c…`):

| step | room | measured |
|---|---|---|
| 22 · 23 · 25 · 26 · 27 · 28 · 29 | L13 · L0 · L21 · L22 · L29 · L31 · L30 | SOLVED 48 · 229 · 26 · 89 · 383 · 336 · 210, **byte-identical to U4's rows** (`ms` and `views` stripped) |
| 30 | L32 | **SOLVED 1,056 ticks**, 15 decisions, 0 re-plans, 0 hits, 1 pass. Replay: hits 0, deaths 0, end level 30, earned clear {32,0} (the tree). |

The tick count was predicted before each run, but only after each probe: 1,053 (first executor), 1,064 (with the shield), 1,056 (with the one-tick equip). For each, the survey run matched its probe. The R5 tape's 2,500 hand ticks are not comparable: that run had no damage, a 31-tick cadence and no burn.

## HEADLINE: 8/9

Step 24 waits on the puncher arm (U7). Every other through-2.2 step solves.

## The surface table delta

185 → **187** rows, `--check` GREEN.
- **New rows:**
  - `run:bobBossForecast`, `seedling`/`forecast`: a deep copy of the live boss plus pure closures (`step`, `shieldBump`, `slash`);
  - `import:tapeFormat.js#inventorySlotsFor`, `seedling`/`function`: the slot array a selection indexes.
- **Folded lists:** entity family `bobBoss` and ledger kind `bobBossEvents`.
- **Site counts:** `run:equipNow` now names `solverBot.js` too. The surface test's mutant (a′), which used `equipNow` as its "reached by `botDriverV2.js` only" member, now expects both files.
- **Constants census:** PASS at 4,603 literals. Every new literal in `bobBoss.js` and `bobBossFight.js` (now inside `levelRun`'s closure) is classed by scope selector with an AS3 anchor. One `advance` statement I edited (the `acting` gate) re-keyed its row.
- ⚠ **`989d8e2` itself left `census-seedling-constants --check` RED.** I ran the census only after it; `39d6f5c` repairs it.

## What the brief got wrong (measured)

1. **§1 "The model ALREADY plays the encounter tick-exactly … `r5-bobboss-fire`'s expectation replays in `tapeRunner`."** It does not. The expectation is the game's recording, the tape is `MODEL_EXEMPT`, and `tapeRunner.test.js`'s `EXPECTED_TO_DIVERGE` asserts the divergence. First divergence t=15; the model ends at (80, 34.05) against the game's (80, 80.7).
2. **"`levelRun.js` `bossStates` (`:1174`)".** It is the BossTotem (L43) state, not BobBoss. No BobBoss state exists in the run.
3. **"Every `BobBoss`/`Fire`/`freezeObjects`/`blackCover`/dialogue read the run exposes".** For L32, none: no BobBoss and no Fire spawn. The freeze readings exist for other families (ceremonies, fall rocks), but `fallrocklarge` is deliberately excluded (`activators.js:488`).
4. **"`Bot.update` skips the tape on `Game.freezeObjects` … three auto-starting dialogues gate `Player.input()`".** The game's dead-frame record for the tape is 345 = 21 + 174 + 150. So the dialogue frames are NOT skipped by the tape, whatever gates input inside them.
5. **"one sentence at §11.4" of `seedling-bot.md`.** That page has no §11.4 (it is the plan's numbering). The sentence went into the goal-vocabulary paragraph.
6. **"`then: 'reach-pit'` for L32, the pit from `pitEdgeFor`".** `pitEdgeFor` keys on a route hop (`from → to`), and the through-2.2 route ends at L32. The control block is the honest source.

7. **"the boss cannot be knocked back (chase only — a fixed stance is viable)"** (from `bobBoss.js`'s header note 4). `hit` cannot knock it back (force 0, point null), but `Player.shieldBump` can: `BobBoss` does not override `Enemy.knockback`. The live game measured it, and note 4 is corrected.
8. **"the R5 tape's 76 presses did both jobs by cadence"** and **"a fixed stance"**. In an honest run, standing still with the R5 cadence dies in form 1 (`hitsMax` 3: a sword hit, then two body contacts). The executor's strikes move.

## Residue

- **`Player.shieldBump` for every other `Enemy`.** This is a model-wide gap: a shielded, moving player shoves bobs, spinners and the rest in the game and not in the model. It is in U7's chaser region and needs its own slice.
- **A death in the BobBoss fight** is refused by name. The reboot into a fallen rock with an immediate respawn (`cameraTimer` 0) is not modelled.
- **`hasDarkShield` in the fight** is refused by name: the bump then HITS (`darkShieldDamage`).
- **`Enemy`'s ctor draws RNG** (`coins`, `FP.choose`) at each of the three constructions. The model does not count them, so a continuation that relies on the RNG after L32 inherits that gap.
- **`burnableTree.js`'s header calls L32's tree `tag = -1`.** The world builds it `tag 0`, and the burn writes {32,0}.
- **The survey's `transitions` readout prints `undefined->undefined@976`.** It reads `t.from`/`t.to`, not `from_level`/`to_level`. This is pre-existing and was not touched.

## Byte-inertia

| Artifact | W0 (`f4a4a28`) | simulation (`989d8e2`) | head (`f03baa7` + records) |
|---|---|---|---|
| identity block (21 rows + six `--check`s) | `c55eb622…` | `diff`-identical | `diff`-identical, every row; the reference line regenerated after the doc edits (ALL 7 + 5 MATCH) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical | identical |
| campaign census | `88fa2333…`, `NO CHAIN ROOM MOVES` | identical | identical |
| survey default derive / route | `27ff43db…` / `1e08f9ad…` | identical | identical |
| survey through-2.2 derive / route | `1172328c…` / `dae52ec7…` | `d200a51f…` / `845a1cd3…` (D1, step 30's goal) | identical to D1 |
| `tapeRunner` | 365/365 | 365/365 (the three bobboss tapes moved from DIVERGES to matches) | 366/366 (+ the witness) |
| `fixtures/**` | — | — | + `swim-u5-bobboss-encounter` (tape, expectation) and `index.json` only |
| bounded vitest | 9 files / 572 | 13 files / 763 | **24 files / 1,155** |

No AS3, wasm or gitlink was touched; no `campaign-frontier.json`, no biome default, no `standing-values --write`, no `pytest`, no unfiltered vitest. Simulation files WERE edited, under the user's license: `levelRun.js`, `levelWorld.js` (the rock's two attrs) and the new `bobBossFight.js`. U6's and U7's named regions were not touched.
