# Cloud report: `seedling-js-playback-door-chest-goal`

**Branch:** `claude/playback-bot-door-chest-nr1ly8`. The harness pinned this branch, so the suggested
`seedling-js-playback-door-chest-goal` name was not used.
**Base:** `65c9ea5590` (origin/main). That is after `f886ddcadf train: chestdoor-ap 224e66fc6d`, so it is main after
chestdoor-ap, as the slice required. Confirmed on this base: `report.chestDoors` is separate from `report.apitems`
(`seedlingGeneratedSet.js:255`), and the key is ABSENT on all four committed generated presets.

## Verdict

The Playback Bot now takes a generated door chest (`<region> - Chest`) as its goal.
- **JS runtime: done.** The walk goes end to end through the controller, with the solver ON and OFF. The chest opens,
  the page reports `pendingCheck 1|0|1|0`, and the check binding turns it into `locationCheck 'region_0_0 - Chest'`.
- **wasm engine (node, fake game, real solve): done.** It solves the goal and ships it as a plan with the `chest` verb.
- **Real wasm game: STOPPED.** No committed chest-door preset exists, and committing one is not small (see below).
- **Identity holds:** byte-identical before and after on the four committed generated presets.

## Files and why

| File | Hunk | Why |
|---|---|---|
| `frontend/modules/flashPanel/seedlingPlaybackController.js` | `resolveSeedlingGoal` location arm: apitems first (unchanged), then `report.chestDoors`; header and JSDoc lines | The gap: names were looked up in `apitems` only |
| `frontend/modules/seedlingDemo/jsRuntimeCore.js` | `validateGoal`: a mounted set's location that NAMES `entityType` is that entity (after the apitem check); `locationPointOf`: apitem first, then the named entity's stance | The page refused it with "level 0 has no apitem with tag 1" (measured) |
| `frontend/modules/seedlingDemo/wasmWalkTape.js` | `walkTapeFromStaging` takes a named-entity location goal: the walker gets its `locationPointOf`, and the walk ends when the run clears that slot (`liveClears`) → `end: 'opened'` | The slice asked the walk-tape instrument to take the same goals |
| `frontend/modules/flashPanel/seedlingPlaybackDoorChest.test.js` (new) | the pins below | |
| `frontend/modules/flashPanel/seedlingWasmPlayback.test.js` | one describe: the wasm engine over the chest set | the wasm-engine pin |

⚠ **The jsRuntimeCore edit needs your call.** I read the limit "No jsRuntimeCore/fidelity flag edits" as *no edits
to its pins or fidelity flags*: `JS_RUNTIME_PINS` and `CONTACT_FIDELITY` are untouched. The edit is to the page's
goal acceptance, and the slice's "the JS runtime … plays it" cannot be met without it: the page's `validateGoal` is
where the door chest was refused. If the limit meant the file as a whole, this hunk is the one to bounce.

**LAB REVIEW:** none. `seedlingGeneratedSet.js`, `seedlingGenRoom.js` and every `procgen*` file are untouched. The
tests only *build* chestdoor-ap's world through `presetRun`/`presetDefs`, read-only. No `vendor/seedling`, wasm binary,
`levelRun`, solver core or submodule edit.

## The strategy decision

- **The goal shape:** a door chest resolves to `{kind: 'location', level: c.room, tag: c.tag, entityType: 'chest', name}`.
- **No new goal kind:** it is the same shape the atlas rooms' chests already use (`atlasLocationGoal`).
- **What the solver does with it (unchanged code):**
  - `arrivalSolverGoal` / `solverGoalFor` find the chest by tag and type (`locationEntityOf`).
  - They map it to the existing `collect-placement` goal at the chest's placement, `{32,16}` for `region_0_0`
    (the same mapping chestdoor-ap pinned).
  - The solver plans it with its existing **`chest` strategy** (the plan's verbs contain `chest`). That is not the
    `apitem` strategy, because there is no apitem.
- **What the walker does with it (solver OFF):** it walks to the chest's stance band (`locationPointOf` →
  `chestStanceBand`, from BELOW).
- **Why it can reach:**
  - The chest IS the door. It is solid until it opens, and the room's only way through.
  - So the walk only has to stand on the stance band south of the chest and open it. Nothing else has to be opened
    first.
  - The generator's certificate (`[chest, collect]`, enforced by `chestDoorBypassRefusal`) proves a route to that
    stance exists.
  - Measured: solver 132 ticks, walker 82 ticks, walk-tape instrument 81 ticks. All three end with the slot
    `{0,1}` cleared and 0 deaths.
- **Why `entityType` and not the apitem shape:**
  - An apitem-shaped goal (`{level, tag}`) reaches the page's apitem-only rule and is refused (mutant M2).
  - Naming the entity lets the page, the solver mapping and the tape all find the chest.
  - Apitem goals still name no entity, so nothing they reach moved.
  - Both page hunks check the apitem FIRST. A vanilla-arm rewritten set's goals do carry an `entityType`, but their
    tag is an apitem, so those resolve exactly as before.

## Pins and their mutants

All pins live in `seedlingPlaybackDoorChest.test.js` (11 rows), plus 1 row in `seedlingWasmPlayback.test.js`. I
applied each mutant, ran the pins, and reverted it. Every mutant is killed.

| Mutant | Killed by |
|---|---|
| M1: the resolver ignores `report.chestDoors` | resolver row, JS E2E ×2, tape row, wasm-engine row (5) |
| M2: a door chest resolved apitem-shaped (no `entityType`) | the same 5 |
| M3: apitem goals carry `entityType: 'apitem'` | resolver row, **IDENTITY ×4** (5) |
| M4: page `validateGoal` stays apitem-only | JS E2E ×2, page refusal row (3) |
| M5: page `locationPointOf` stays apitem-only | JS E2E ×2 (2) |
| M6: the tape never sees the chest clear | tape row (1) |
| M7: the tape refuses a named entity | tape row (1) |

- **Refusal pin:** `Nowhere`, and `region_0_0 - Chest` on a world with no door chest, both still refuse as `"<name>"
  is not an AP location of the generated Seedling rooms`, the old words.
- **Page refusal:** a chest goal whose tag holds no chest refuses as `level 0 has no chest with tag 9`. A goal that
  names no entity keeps `level 0 has no apitem with tag 1`.
- **Tape refusal:** the same bad goal refuses as `level 0 of the mounted set has no chest with tag 9`.

## Identity digests (before = after)

What is hashed (sha256, first 16 hex characters):
- **resolved:** every target × live level `{null, 0, 1}` → `resolveSeedlingGoal`. The targets are every apitem name,
  every exit in all three spellings, `Nowhere`, a chest-shaped name and a tile.
- **tapes:** every arrival × resolved goal → `walkTapeFromStaging` (keys + expected trajectory, or the refusal text).

Before was measured on a `git stash` of the change, after with it applied: identical. The values are pinned in the
IDENTITY rows.

| preset | resolved | tapes |
|---|---|---|
| seedling_generated_room | 48 · `0f328447ba81f9c5` | 54 · `d1b6bbb59b7840ee` |
| seedling_generated_leaf | 21 · `2e31c1065414a1d9` | 10 · `ba5acc63683fc948` |
| seedling_generated_host | 21 · `1cc05550429156d3` | 10 · `605c72ec430c6777` |
| seedling_generated_swim | 21 · `5338400059fbe52e` | 10 · `fd399d71b9d6aae3` |

The existing pins over the same presets also stay green (below): chestdoor-ap's set/table/report digests, the
walker-producer tape digests (`wasmWalkTape.test.js`) and the solver classification (`jsRuntimeGeneratedSolver.test.js`).

## The end-to-end walks

- **JS runtime (`seedlingPlaybackDoorChest.test.js` "END TO END"):**
  - Setup: chestdoor-ap's world (the committed `seedling_generated_room` state with `seedlingGenElements:
    'chestdoor'`, built headless). It is mounted on a live page as the host delivers it (chunks), with a
    `SeedlingPlaybackController` over it (`transport: 'js'`).
  - Steps: `walkTo({kind: 'location', name: 'region_0_0 - Chest'})` → true; then `play()`; then page ticks until DONE.
  - Solver ON: `lastSolve.goal = collect-placement {32,16}`, verbs ∋ `chest`, 0 declines. Solver OFF: 0 solves
    (the walker alone).
  - Result in both modes: `persistence_cleared ∋ {0,1}`, no apitem collected, `pendingCheck` exactly `['1|0|1|0']`,
    the binding → `locationCheck 'region_0_0 - Chest'`, 0 deaths. **PASS.**
- **wasm engine (`seedlingWasmPlayback.test.js` "⛓ DOOR CHESTS"):**
  - Setup: the same set, `generated: true`. The arrival is a **synthetic** stand-in: the recorded p4g arrival G_A0
    moved to that set's start, `(32,112)` ctor.
  - Steps: `walkTo(goal)` → `force-re-arrival`. The solver request is `collect-placement {32,16}` with
    `scratchPersistence`, and the plan's verbs ∋ `chest`.
  - Result: shipped, done with no divergence, `heldEnd`, phase `held`. **PASS.**

**Bounded suite run, after the change:** 12 files, **344/344 passed**. The files: jsRuntimeSolveService, jsRuntimeEventGoalWalk,
jsRuntimeAtlas, jsRuntimeVerbs, wasmWalkTape, jsRuntimeEncounterLegWalk, jsRuntimeWalker, seedlingPlaybackController,
seedlingPlaybackDoorChest, seedlingWasmPlayback, jsRuntimeGeneratedSolver and seedlingGenChestDoorAp. No unfiltered
vitest was run locally (ruling 52); the suite number comes from CI at the pushed SHA.

**Generated reference:** `node scripts/procgen/generate-procgen-reference.mjs --check` → **ALL 7 GENERATED MODULES AND
5 MARKDOWN REGIONS MATCH THE CODE**. None of the touched files is a cited source that needed regenerating.

## The wasm leg: real game STOPPED

What is done on wasm, in node: the engine's goal mapping, solve and ship (above). Its completion check needs no
change, because `locationGoalServed` reads the chest's `{level, tag}` clear off `persistence_cleared`, the same as any
location.

What is STOPPED: the real Seedling wasm game playing it. No committed preset holds a door chest. Committing one is
**not small**:
- a new `presetDefs.js` state (procgen-owned, so LAB REVIEW);
- a `make-seedling-spiral-room-preset.mjs` arm;
- a `preset_files.json` entry;
- the derived rosters a new generated preset enrols in. At least the "committed X preset IS this world" world rows,
  `presetDefs.test.js`, chestdoor-ap's four-preset identity table, `wasmWalkTape.test.js` and
  `jsRuntimeGeneratedSolver.test.js`'s "classify EVERY member" rows (each enumerates presets by an explicit list), and
  the substrate capability or reference rows if the preset is cited;
- plus a new WebGPU in-app row in the `seedling-wasm` batch to actually play it. This container can't confirm that
  row green.

**Open gap for the coordinator / lab-1:** a committed chest-door generated preset, and the in-app wasm row that walks
`region_0_0 - Chest` to its `locationCheck`. The JS and engine pins above are what that row would build on.

## Residue

- `region_0_1 - Chest` sits in room 1. A walk to it from the start is two goals: the door, then the chest (the bot
  plans ONE goal in ONE room, ⚖ Q5). Only the room-0 chest is walked here. Room 1's chest is pinned only at the
  resolver.
- The wasm-engine row's arrival is synthetic: a recorded read moved, not a recording of the chest world. A real
  recording comes with the committed preset.
- `git config core.hooksPath scripts/git-hooks` was set on this clone, as CLAUDE.md asks.
