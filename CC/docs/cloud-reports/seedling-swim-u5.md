# Seedling swim U5: R-f, L32 (Bob Boss) as an `encounter` goal

**Slice:** `seedling-swim-u5`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §16). It ran in parallel with U6 (the kill rung's press arm and `dangerMap.spinnerDanger`), U7 (`chasers.js`, `combat.js`, `enemyDamage.js`) and U8 (`procgenSeedling`, biome defaults, presets). This slice touched none of their regions.

| | |
|---|---|
| Started from | `origin/main` @ `f4a4a28` (`4081ecc742` + two bank commits; the harness branch already sat on it) |
| Harness branch | `claude/bobboss-encounter-goal-0kb2ko` |
| Commits | D1 `165e27b` · D4 `0545dc9` · D5 `d9df86b` · this report (last) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS (bank) / the premise FAILS** | Every banked row reproduces the brief's values. The replay falsifies the brief's §1 premise: **the model does not play the encounter at all**. The stream diverges at t=15 (the arm frame), and the rock never falls. |
| D1 | **PASS** | `encounter` is a goal kind: `assertGoal` (four kinds), `decisionTrace`, and the survey's step 30. It refuses BY NAME before a tick: `ENCOUNTER_EXECUTORS` is empty. The default survey mode is byte-identical. |
| D2 | **STOP** | No executor can be derived from a model that has no fight: no freeze, no boss roster, no dialogue, no drop. A getter cannot expose state the run never builds. |
| D3 | **STOP** | No executor, so no tape. A model differential of the fight diverges at the arm frame by construction. `fixtures/**` is untouched. |
| D4 | **PASS** | Step 30 is REFUSED as `ENCOUNTER-UNMODELLED` (new name). 22, 23 and 25–29 are byte-identical to U4's rows. **HEADLINE 7/9.** |
| D5 | **PASS** | Log § U5-swim, the bot-page paragraph, reference and docs index regenerated, surface GREEN 185, bounded vitest 12 files / 610. |

**The one thing to know first.** `r5-bobboss-fire` is one of `r5Chain.MODEL_EXEMPT`'s three names, and `tapeRunner.test.js` asserts that it DIVERGES from the model. The model simulates none of L32's script:
- `fallrocklarge` is deliberately not a `FALL_RESPONDERS` row, so the rock never arms;
- there is no BobBoss in any entity family (`bosses` is L43's totem);
- no dialogue or transition freezes the run;
- nothing spawns the Fire.

The 2,501-observation expectation is the GAME's recording, not a model replay. So "an executor derived from the model" needs the encounter simulated in `levelRun.js` first. That is a simulation family, far past the one-getter allowance, and it is a ruling for the coordinator, not a solver slice.

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
- **The goal loop** looks the executor up by the drop, in `ENCOUNTER_EXECUTORS`. This mirrors `STRATEGY_EXECUTORS`' "selected but not registered" idiom. The table is **empty**, and its docblock says why (the W0 measurement). The refusal fires before a tick:
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

## D2: the executor (STOP)

What the brief's executor needs, and what the run exposes:

| Leg | Needs | The run |
|---|---|---|
| (a) arm + wait | the frozen span | the rock never arms (`fallrocklarge` ∉ `FALL_RESPONDERS`), and no freeze |
| (b) per form | the boss as a chase body, and its hits per landing | no family holds a BobBoss. `chasers` has no row; `bosses` is L43's totem |
| (b) pages | the freeze flag, to tell a page from a swing | no dialogue, and `inCeremony` never true |
| (c) drop | `hasFire` + the two persistence writes | never |
| (d) burn + pit | `burnableTree` + `reach-pit` | exists, but is unreachable without (c) |

A getter can expose a fact the run computes. These facts are not computed. Simulating them means writing a BobBoss family in `levelRun.js`, from `bobBoss.js`'s transcription: the rock, three forms, the transitions with the per-frame teleport, the dialogues, and the runtime Fire. That is ⛔ for this slice. No executor was written, no tick prediction was made (there is no run to predict), and the brief's two mutants have nothing to act on. `KILL_ARM_POLICY.BobBoss` stays `refused`.

## D3: the witness (STOP)

There is no executor, so no tape. The differential's model half would diverge at the arm frame, as `r5-bobboss-fire` already does. No tape was committed. `r5-bobboss-*` are untouched, and `git diff origin/main -- frontend/modules/seedlingDemo/fixtures` is empty.

## D4: the survey

`--through=2.2 --only=30 --timeout=600 --out=CC/docs/cloud-reports/seedling-swim-u5-survey.json`, then `--only=22,23,25,26,27,28,29`. The rows are merged into that file (md5 `6097fa87…`).

| step | room | predicted | measured |
|---|---|---|---|
| 30 | L32 | REFUSED, new name, ms-scale | **REFUSED, `ENCOUNTER-UNMODELLED`**, 3 ms, before a tick |
| 22 | L13 | U4's row | SOLVED 48, byte-identical* |
| 23 | L0 | U4's row | SOLVED 229, byte-identical* |
| 25 | L21 | U4's row | SOLVED 26, byte-identical* |
| 26 | L22 | U4's row | SOLVED 89, byte-identical* |
| 27 | L29 | U4's row | SOLVED 383, byte-identical* |
| 28 | L31 | U4's row | SOLVED 336, byte-identical* |
| 29 | L30 | U4's row | SOLVED 210, byte-identical* |

\* Every field equals U4's `seedling-swim-u4-survey.json` row, with `ms` (wall clock) and `views` (output paths) stripped.

## HEADLINE: 7/9

Step 24 waits on the puncher arm (U7). Step 30 waits on a simulation of the BobBoss encounter.

## The surface table delta

185 → 185 rows, `--check` GREEN after `--write`. One site count changed: `run:level` 86 → 87, in `solverBot.js`, from the refusal text. No new member, family, kind or getter, and **no simulation line**. `census-seedling-constants --check` PASS.

## What the brief got wrong (measured)

1. **§1 "The model ALREADY plays the encounter tick-exactly … `r5-bobboss-fire`'s expectation replays in `tapeRunner`."** It does not. The expectation is the game's recording, the tape is `MODEL_EXEMPT`, and `tapeRunner.test.js`'s `EXPECTED_TO_DIVERGE` asserts the divergence. First divergence t=15; the model ends at (80, 34.05) against the game's (80, 80.7).
2. **"`levelRun.js` `bossStates` (`:1174`)".** It is the BossTotem (L43) state, not BobBoss. No BobBoss state exists in the run.
3. **"Every `BobBoss`/`Fire`/`freezeObjects`/`blackCover`/dialogue read the run exposes".** For L32, none: no BobBoss and no Fire spawn. The freeze readings exist for other families (ceremonies, fall rocks), but `fallrocklarge` is deliberately excluded (`activators.js:488`).
4. **"`Bot.update` skips the tape on `Game.freezeObjects` … three auto-starting dialogues gate `Player.input()`".** The game's dead-frame record for the tape is 345 = 21 + 174 + 150. So the dialogue frames are NOT skipped by the tape, whatever gates input inside them.
5. **"one sentence at §11.4" of `seedling-bot.md`.** That page has no §11.4 (it is the plan's numbering). The sentence went into the goal-vocabulary paragraph.
6. **"`then: 'reach-pit'` for L32, the pit from `pitEdgeFor`".** `pitEdgeFor` keys on a route hop (`from → to`), and the through-2.2 route ends at L32. The control block is the honest source.

## Residue (what a simulation slice, or a chain segment, would need)

- **The ruling the coordinator owes.** Either license a BobBoss simulation family in `levelRun.js` (from `bobBoss.js`: the rock as a 32x32 `FALL_RESPONDERS`-like row, three forms with `hitsMax` 2/3/2, `BOSS_IFRAMES 30`, 120-frame transitions with the per-frame teleport from frame 40, the `player.hits = 0` write, three `BobBossNPC` dialogues at line length 28, `new Fire(80,80,-1)` and its out-of-band {31,29}), or treat L32 as an oracle-recorded segment (the R5 tape is already a game-verified hand script).
- **Seam facts from the game's recording**: the arm at t=12 (y < 120); dead frames 174 (rock) and 150 (Fire phase A); the first teleport visible t=293→294; the Fire touched at t=1830; the end standing at (80, 80.7). The form deaths, landings and pages need the game's own per-tick readout (the differential's item and `receiveInput` channels), not a position stream.
- **A census oddity, not chased.** `burnableTree.js`'s header says L32's arena tree is a `tag = -1` per-visit tree. The model's world builds `burnabletree@64,0` with **tag 0**. That matters for which persistence slot the burn writes. It is outside this slice and unverified against the OEL.

## Byte-inertia

| Artifact | W0 (`f4a4a28`) | head (`d9df86b`) |
|---|---|---|
| identity block, all 21 rows + six `--check`s + reference, stdout md5 | `c55eb622…` | **`diff`-identical** (`c55eb622…`) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical, exit 0 |
| campaign census | exit 0, `NO CHAIN ROOM MOVES`, `88fa2333…` | identical |
| survey default derive / route | `27ff43db…` / `1e08f9ad…` | identical |
| survey through-2.2 derive / route | `1172328c…` / `dae52ec7…` | `d200a51f…` / `845a1cd3…` (step 30's goal only, by design) |
| `tapeRunner` | 365/365 | 365/365 |
| bounded vitest | 9 files / 572 | 12 files / 610 (+ `solverEncounter`, `solverReachPit`, `decisionTrace`) |
| solver surface | GREEN 185 | GREEN 185 (one site count) |
| `fixtures/**` | — | `git diff origin/main` empty: no tape added |

No AS3, wasm, gitlink, tape, `campaign-frontier.json`, biome default, `standing-values --write`, `pytest` or unfiltered vitest was touched or run. No simulation file was edited.
