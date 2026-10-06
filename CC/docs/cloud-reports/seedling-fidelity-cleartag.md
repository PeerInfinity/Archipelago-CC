# Seedling fidelity CLEARTAG: the `clear-tag` goal, a saved obstacle broken from its open side and finished on the game's write (cloud report)

**Slice:** `seedling-fidelity-cleartag`, an Opus build slice run in the cloud for the Seedling model-fidelity arc (planner
`seedling-fidelity-planning-3`), WAVE 8 (model coverage).

⚖ **The rulings:**
- (2026-10-05) *"break before first use"*. An arrival inside the obstacle requires the event, the JS planner visits an
  unmet event as a goal first, and ARRIVAL's refusal is the backstop.
- (2026-10-06) Build the executor AND measure the fallback (moving the obstacles off the screen edge), then recommend
  one.

| | |
|---|---|
| Started from | **`0f952e9a9e`** (`origin/fidelity-harvest/wave7`, the WAVE-7 harvest: main `9e1361f7c5` + CHECKPOINTS + LINEFLIP). Not rebased |
| Harness branch | **`claude/clear-tag-goal-executor-x9dk8o`**. Every push went here; nothing went to `main` |
| Commits | D1+D2 `335865c` · D3 `08f5a7d` · D4 `5b6f45d` · docs + reference `941afe3` · this report (the head) |
| Dev server | `serve-nocache.py 9470` (`SEEDLING_PORT=9470`); W0 in a pristine detached worktree on 9471 |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS (measured, not applied; recommendation: the executor)** |

## The one thing to know first

**An `earnedClears` row is not the game's write.** The brief said to finish "when the run's ledger shows `{level, tag}`
cleared". The game measured otherwise (p4f, held cuts, `probe-seedling-cleartag.mjs --scan`): the game's
`persistence_cleared` first holds the flag after **T + 1** ticks, where T is each family's own removal.

| family | the ledger row's `t` | the game's write T (cut T: held; cut T+1: set) |
|---|---|---|
| a rock (`{0,1}`) | 43, the HIT | **50**, `endAnim` (`rocksBroken.goneAt`) |
| a tree (`{24,0}`) | 64, the press | **105**, `removed()` (`treeBurns.goneAt`) |
| a lock snap (`{71,2}`) | 164 | **164**, `turnOff` (the row is stamped at the write) |

So a goal that finishes on the row ends before the flag exists. The first L71 solve ended at 164 t, one tick before the
game wrote. `execClearTag` therefore finishes only when the write has LANDED (`clearTagLanded`: `brokenRocks` /
`burnedTrees` hold it, or the run is past the row's `t`), idling if needed (L71: **165 t**). With that rule, all
**12 game arms pass**: every stream at 0 px, and the flag exact at the fencepost. This is a fact about the model's
ledger, and any consumer of it (the JS arc's collector, a continuation's declared flags) should know it.

## W0 (at `0f952e9a9e`, pristine detached worktree)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9471 bash scripts/procgen/identity-block.sh .` (venv) | log md5 **`610dccf57c7282807b3bcd47db7db4a7`** |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `a569eeec`, all exit 0 (LINEFLIP's post-flip digests) |
| kind pairs / censuses | in the block | c3 `043e1944` · c6 `f85e7722` · c4 `4aa74add` · ENEMY `d59f0c97` · generated set OK (= LINEFLIP's W1-ON column, now the default) |
| reference | in the block | **4 DIFFER at base**: `registry.js`, `capabilities.js` and two substrate-capability regions. They read the non-Seedling submodules (omsi-loops, cavernous-ii …), which a `--seedling` bootstrap does not initialise. It is environmental, identical in both trees, and never committed |
| surface / constants / entities / profile | each `--check` | **GREEN 208** · **PASS 5,327** · **518** · **138** |
| roster | `fixtures/tapes/index.json` | **238**, `df76e166414b685b23113394374e9989` |
| tapeRunner | sorted `(fullName, status)` | **533/533**, md5 **`71bda323e8c6a709fecbfd0734ebf945`** |
| bounded vitest BEFORE | 32 files (below) | **1,221 / 1,221** |

The 32 files are:
- the brief's list: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`,
  `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `fidelityArrival`, `fidelityAxe`,
  `contactFidelity`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`,
  `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`;
- the region and the verbs it reuses: `solverBot`, `breakVerb`, `fidelityBurn`, `fidelityProximity`, `fidelityStepOff`;
- every `grep -a` hit for `assertGoal` / `KNOWN_GOAL_KINDS` / `unknown goal kind` / `clear-tag` /
  `EVENT_GOAL_REFUSAL` / `resolveObstacleStrategy` / the survey: `seedlingVanillaArmMap`, `solverEncounter`,
  `solverReachPit`, `surveyFamily`.

## D1: measure (PASS)

**The open sides.** From the rules' events (`side` / `across`), ARRIVAL's landings (`gameLandings`) and
`arrivalInsideSolid`:

| event | obstacle | gated landing (inside, flag held) | open side (`side`) | arrivals into the level on the open side |
|---|---|---|---|---|
| `{0,1}` ON ROUTE | `breakablerock@288,176` | L12 `teleporter@0,80` → (288,176) | `level_0__r8c0` | L2, L13, L86, L89, L94 ×2 (L1's own landing is inside `{0,4}`) |
| `{0,4}` | `breakablerock@80,112` | L1 `teleporter@64,112` → (80,112) | `level_0__r8c0` | the same six |
| `{12,7}` + `{12,12}` (stacked) | `magicallock` + `bosslock` @32,864 | L83 `teleporter@32,64` → (32,864) | `level_12__r42c29` | 12 landings, none of them in the lock pocket |
| `{24,0}` | `burnabletree@32,128` (32×32) | L12 `teleporter@40,688` → (48,128) | `level_24` | L23 stairs → (96,80) |
| `{71,2}` ON ROUTE | `shieldlock@288,256` | L76 `teleporter@0,80` → (288,256) | `level_71__r0c6` | L72, L75, L80, L85 |
| `{112,1}` | `rocklock@112,16` | L113 ×2 → (112,16) | `level_112` | L111 |
| `{113,0}` | `finaldoor@112,0` (32×32) | L115 ×2 → (112,16), (128,16) | `level_113` | L112, L114 ×2 |

The stance is reached from those arrivals in the D3 census below. **The game's truth** is one witness per verb path,
plus the write scan above:

| witness | verb path | solve | game write T | arms |
|---|---|---|---|---|
| `L0-1-from-L2` | the walk to the stance strikes the rock (`cleared-in-passing`, `during: 'stance walk'`) | 54 t | 50 | 3/3 PASS |
| `L0-4-from-L13` | `execBreak` | 75 t | 63 | 3/3 PASS |
| `L71-2-from-L80` | `execTouch` + 1 idle tick | 165 t | 164 | 3/3 PASS |
| `L24-0-from-L23` | `execBurn` | 114 t | 105 | 3/3 PASS |

Each witness has three arms: the solve, the cut at T (the game's array does NOT hold the flag) and the cut at T + 1 (it
does). All are played DECLARED `hold` (`holdingWindowTape`, BURN's bracket). The first unheld recording read the flag one
tick early on L71 and late on the others, because the game ran on past the tape's end (a trap candidate). Oracle:
`fixtures/cleartag-oracle.json`, `SEEDLING_PORT=9470 node scripts/procgen/probe-seedling-cleartag.mjs --record=…`,
**ALL CHECKS PASSED**.

## D2: the executor (PASS, `335865c`)

**The change.** `solverBot.assertGoal` admits `clear-tag {tag: {level, tag}, at, obstacle?}`. `solveSegment`'s goal
loop runs `execClearTag`, which adds no new verb:
1. **Name the obstacle as the frontier does** (`solid:<class>`, id `<class>@<x>,<y>`).
2. **Select the verb** from `OBSTACLE_STRATEGIES` through `refineStrategy`.
3. **Resolve it** with `resolveObstacleStrategy`, whose stance is the one that already answers "reachable from here".
4. **Walk to the stance** with the loop's own `walkTo`.
5. **Run the registered executor.**
6. **Finish when the game's write has landed.**

The arms:
- `verb`;
- `cleared-in-passing`: the ledger already names the flag, or the stance walk struck it, so the verb is not re-run
  (re-asked after the walk);
- `already-clear`: the live world holds no such solid and the ledger is silent, i.e. the build left it out. This is the
  game's own `check()` for a flag the boot holds cleared.

A row whose write is still ahead is waited out with nothing held, up to `CLEAR_TAG_WRITE_TICKS = 120`. Every refusal is
the new **`SolverRefusal.obstacle.kind: 'clear-tag'`** with `{id, flag, reason}`, where `reason` is one of
`wrong-level`, `no-verb`, `cannot-act`, `unresolved`, `prerequisite` or `not-written`.

**Contract.** The signatures and contracts of `solveSegment`, `twoPassSolve`, `PendingDeclaration` and
`createRunForStaging` are untouched. The verbs' internals are untouched. `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`,
`KNOWN_STRATEGY_VERBS` and `FAMILY_RULES` are untouched (no row added). The solver reads only contract surfaces
(`entities('brokenRocks' | 'burnedTrees')`, `ledger('earnedClears')`). A first cut read `run.rocksBroken`, which the
surface census flagged **unlisted**, and it was replaced.

**ARRIVAL's guarantee holds and is mutant-tested.** The gated arrival still refuses with the flag unset. Run
`[clear-tag {0,1}, reach-exit L12]` (68 t) and stage the run's flags onto the L12 → L0 arrival: it then solves (5 t).

**Rows** (`fidelityClearTag.test.js`, 37). Shape refusals ×4. The four executor arms (the `{0,4}` verb at 75 t; the
`{0,1}` stance-walk strike at 54 t, with `rocksBroken.goneAt` 50 against the row's 43; L71 at 165 t, `waited: 1`; met
in passing; `already-clear` at 0 t). `not-written` (a wrong tag on a real rock), `cannot-act` (no Sword),
`wrong-level` and `unresolved` (L89's north pocket). The guarantee ×2. The census ×8. The oracle ×13.

**Mutants** (predicted in the file header, each made by copy + edit + run + restore, md5 verified):

| mutant | predicted | measured |
|---|---|---|
| m1 the top in-passing check removed | the double-goal row reds (the 2nd reads `already-clear`) | **1 red**, that row |
| m2 the stance walk skipped | every SOLVES row reds | **the whole file reds at collection**: `clearTagArms()` solves inside `describe` and its refusal kills the file. Louder than predicted, same verdict |
| m3 `not-written` refusal dropped | the wrong-tag row reds | **1 red**, that row |
| m4 ARRIVAL's entry check off | the guarantee row reds | **6 red**: mine + ARRIVAL's 5 |
| m5 finish on the row (no write tick) | the L71 rows red (164 t) | **3 red**: the L71 executor row, the census row, the oracle's L71 solve arm |

**Pins re-pinned:** `solverEncounter` and `solverReachPit` assert that the unknown-kind refusal lists every kind the
solver owns. It now lists `… 'encounter' and 'clear-tag'`. U5 did the same for `encounter`.

## D3: the census (PASS, `08f5a7d`)

`node scripts/procgen/measure-seedling-cleartag.mjs [--json]` → `seedling-fidelity-cleartag-census.json`. **59
rows: 12 INSIDE (never acted from), 13 SOLVES, 34 REFUSES by name, 0 THREW.**

| event | solves (ticks) | refuses by name |
|---|---|---|
| `{0,1}` | L2 54 · L13 198 · L86 175 · L94 244 / 233 | L89: `unresolved` (no reachable stance from the north pocket) |
| `{0,4}` | L2 121 · L13 75 · L86 181 · L94 54 / 59 | L89: `unresolved` |
| `{12,7}` | none | all 13: `unresolved`. The catalogue's `solid:magicallock` row is **`kill`**, which binds nothing here, while the census names the WAND (`wand` has no executor) |
| `{12,12}` | none | with every key, all 13: `unresolved`. The lock pocket sits behind `bosslock@80,656`, and a plain `reach-exit` to L83's door loops `keylock(bosslock@80,656)` ×4 (STANCE's region) |
| `{24,0}` | L23 114 (`burn`) | none |
| `{71,2}` | L80 165 · L75 457 (`touch`) | L72: `danger` (the ladder EXHAUSTED on `spinningaxe@256,144`) · L85: `unresolved` (no reachable touch stance) |
| `{112,1}` | none | `no-verb`: no `solid:rocklock` row |
| `{113,0}` | none | `no-verb`: no `solid:finaldoor` row (its write is the Watcher's) |

**The survey rows** (`node scripts/procgen/survey-seedling-route.mjs --through=end --only=29,33,163,171`, both
trees). `--through=end`'s derive at this base emits **0 `clear-tag` legs**, before and after. The
gated arrivals are **step 33** (L12 → L0 into `{0,1}`) and **step 171** (L76 → L71 into `{71,2}`). Each is preceded by
a walk THROUGH the obstacle (steps 29 and 163) that credits the event.

| step | before | after |
|---|---|---|
| 29 L0 | SOLVED 275 t | SOLVED 275 t (same row) |
| 33 L0 | REFUSED `arrival-inside-solid` (`breakablerock@288,176`) | the same refusal |
| 163 L71 | SOLVED 327 t | SOLVED 327 t (same row) |
| 171 L71 | REFUSED `arrival-inside-solid` (`shieldlock@288,256`) | the same refusal |

⚠ **The survey's gap is the staging, not a missing goal.** Each step boots a fresh staged block, so the flag that step
29's / 163's walk credited never reaches step 33's / 171's boot. Measured with a simple JS-runtime staging: step 33 with
`{0,1}` declared SOLVES (198 t); step 171 with `{71,2}` declared gets past ARRIVAL to its next wall (`no REACHABLE
stance inside button@112,176`, STANCE's region). The work order is the rules arc's survey staging: declare the flags its
own earlier legs credited.

## D4: the fallback, measured and NOT applied (PASS, `5b6f45d`)

`node scripts/procgen/measure-seedling-cleartag-patch.mjs [--json] [--no-tapes]` →
`seedling-fidelity-cleartag-patch.json`. Each obstacle is moved one width inward, away from the back door its gated
landing sits in front of, on a copy of the map. L113's back door is under the door itself, so that one moves away from
the nearest edge. L12's stacked pair moves together.

| event | the patch row (op `move`) | landing | still gates? (pocket, flag held → cleared) | clear from the pocket | committed tapes visiting the level |
|---|---|---|---|---|---|
| `{0,1}` | rock → (272,176) | free | **yes** (2 tiles, 1 door → 110 tiles, 6 doors) | SOLVES 21 t `break` | 38 |
| `{0,4}` | rock → (80,128) | free | **NO**: the rock sits directly under its door, so any move opens the room (109 tiles, all 6 doors with the flag held) | (moot) | 38 |
| `{12,7}`+`{12,12}` | both → (32,880) | free | no other door either way (the far side is itself sealed: 48 tiles, 1 door) | REFUSES (`kill` binds nothing; the keylock stance loops) | 30 |
| `{24,0}` | tree → (32,96) | free | **yes** (4 → 35 tiles) | SOLVES 54 t `burn` | 12 |
| `{71,2}` | lock → (272,256) | free | **yes** (2 → 107 tiles) | **REFUSES**: the touch stance loops from the pocket side | 13 |
| `{112,1}` | rocklock → (112,32) | free | **yes** | REFUSES `no-verb` | 2 |
| `{113,0}` | finaldoor → (112,32) | free | **yes** | REFUSES `no-verb` | 5 |

**What a patch costs:**
- the applier has no `move` op (`remove` and `set-attrs` only), so each patch needs a ~15-line op or a remove + add pair;
- the delivered set then differs from the model's built-in map (`levelSource.loadAtlas()`, which every committed tape is
  recorded against and which `seedlingSetPatches` deliberately does not touch);
- `seedling_playthrough`'s rules need regenerating: the events and their exit gates vanish, and the landing pocket
  becomes a sub-region;
- ARRIVAL's census and edge fixture change, and so do the JS arc's event collector rows;
- no committed tape moves, since the tapes are the built-in map's.

| event | recommendation | why |
|---|---|---|
| `{0,1}` ON ROUTE | **executor** | 5 of 6 open-side arrivals solve, game-witnessed; the patch adds nothing the route lacks |
| `{0,4}` | **executor** | the patch loses the gate |
| `{12,7}`+`{12,12}` | **neither yet** | both fail today; the work orders are a wand executor and STANCE's keylock loop at `bosslock@80,656`. Off route |
| `{24,0}` | **executor** | solves, game-witnessed; the patch only shortens the walk |
| `{71,2}` ON ROUTE | **executor** | solves from L80/L75, game-witnessed; the patch's pocket touch REFUSES, so it would make the solver worse |
| `{112,1}`, `{113,0}` | **executor**, after a catalogue row | the patch keeps the gate but still needs the same verb (`no-verb` either way) |

**Overall: the executor.** The fallback buys nothing on either on-route event. It loses `{0,4}`'s gate, regresses
`{71,2}`, and costs a delivered-set / model-map divergence plus a rules regeneration.

## What the JS arc must wire, and its pins

- **Wire:** dispatch the route's `clear-tag` goal to `solveSegment`. The goal loop accepts it now.
  - `seedlingPlaybackController.EVENT_GOAL_REFUSAL` still refuses it by name ("which the solver does not execute yet").
    That sentence and `seedlingVanillaArmMap.test.js:156`'s pin are the JS arc's to retire.
  - **New refusal kind:** `obstacle.kind 'clear-tag'` with `{id, flag, reason}`.
  - **New record fields:** `{goal: 'clear-tag', arm, flag, obstacle, ledgerAt, confirmedAt, by, during?, waited, …verb record}`.
- **For the collector:** the model's `earnedClears` row runs AHEAD of the game's `persistence_cleared` for rocks (by
  the hit-to-`endAnim` span) and trees (by press-to-`goneAt`). A model-side credit read off the row is early by that
  span.
- **No JS-arc pin moves.** `jsRuntimeDeclarations` and `seedlingVanillaArmMap` are green, unchanged.
- **Doc:** `playback-and-debugging.md`'s line "whose executor is not built" now reads "its executor is `solverBot`'s;
  the Playback Bot does not dispatch it yet".

## Deltas

| row | W0 | AFTER |
|---|---|---|
| identity block | `610dccf5…` | **`610dccf57c7282807b3bcd47db7db4a7`, byte-identical** (`SEEDLING_PORT=9470`, this tree) |
| six `--check`s | as W0 | **the same six digests, all exit 0** (in the block) |
| surface | GREEN 208 | GREEN 208 after `--write` (site counts only: solverBot's new reads of `run.state`/`world`/`ledger`/`entities`; **no row added**) |
| constants / entities / profile | 5,327 / 518 / 138 | unchanged |
| roster | 238 `df76e166…` | unchanged (no tape added or moved) |
| tapeRunner | 533 `71bda323…` | **533 `71bda323…`, pairs identical** |
| bounded vitest | 1,221/1,221 (32 files) | **1,258/1,258** (33 files: + `fidelityClearTag` 37). The 32 files' pairs are identical except the two re-pinned vocabulary rows (failed before the re-pin, passed after) |
| reference | 4 env-only DIFFER | the same 4. `instruments.js` + `architecture.md` list the 3 new instruments; `docsIndex` + README hold the token counts |
| `check-procgen-help --only=` ×3 | n/a | ALL PASS (both doors) |

## What the brief got wrong (measured)

1. **"Finish when the run's ledger shows `{level, tag}` cleared."** The ledger row precedes the game's write for rocks
   (the hit, 7 ticks early) and trees (the press, 41 ticks early). It is the model's next-build permission, not the
   write. The executor finishes on the write.
2. **"L0's rock {0,1} (from L12, step 42), L71's shieldlock {71,2} (from L76, step 186)."** At this base the
   `--through=end` route has **221** steps (`route.json`), and the gated arrivals are **steps 33 and 171**.
3. **"The wand (`wand` row) … `magicallock {12,7}`."** The catalogue's `solid:magicallock` row is **`kill`** (R8's
   kill-lock reading). `wand` is `solid:wandlock`'s row. The executor reports `unresolved` (kill binds nothing), not
   `no-verb`.
4. **"`hold`/`pulse` (activation-group locks)."** L71's shieldlock is `touch`, and the two activation-group locks
   (`rocklock`, `finaldoor`) have **no** catalogue row at all.
5. **"None on current routes"** for `clear-tag` legs is confirmed (0). But the on-route gated steps still refuse
   `arrival-inside-solid` in the survey, because each step's staged boot drops the flag the previous walk credited
   (D3 ⚠).

## Residue (named, not fixed)

- L12's stacked locks: a wand executor (and the `magicallock` row's reading), plus STANCE's keylock loop at
  `bosslock@80,656`.
- No catalogue row for `rocklock` (activation group) or `finaldoor` (the Watcher's write). Adding a shared-table row
  changes the frontier in L112/L113, so it is left for a slice that measures those rooms.
- `{71,2}` from L72 (the spinning-axe ladder, LADDER2/AXE's) and from L85 (no reachable touch stance).
- The survey's staged boots do not declare flags their own earlier legs credited (the rules arc).
- `execClearTag`'s `prerequisite` arm refuses rather than chaining an opener (no event needs it today).

## Byte-inertia

No committed tape, no `--check` digest, no producer output moved. The executor is reached only by a `clear-tag` goal,
which every committed caller previously could not pass (`assertGoal` threw). The only changed text on an existing path
is the unknown-kind refusal's kind list (two pins re-pinned). No AS3, wasm, gitlink or rules edit. No flag was needed.

## Rows to BANK

- `fidelityClearTag.test.js` (37) and `fixtures/cleartag-oracle.json` (12 arms, ALL CHECKS PASSED on p4f).
- `probe-seedling-cleartag.mjs` in `boxLock.test.js`'s guarded list.
- The census and patch tables (`seedling-fidelity-cleartag-census.json`, `-patch.json`).
- **Trap candidates** (in the log): *a ledger row is a permission, not a write*; *an unheld cut reads a later state*;
  *a goal's first walk can satisfy it*.
