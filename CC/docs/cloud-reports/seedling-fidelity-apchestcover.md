# seedling-fidelity-apchestcover: the Cover/APChest same-frame order (planning-24, wave 60)

**Verdict: STOP. The model and the key are built and the measurements are done; the game refutes ON.** I recorded
the witness myself on the p4h page, in a staged L38 room. **The APChest opens on tick 12**, which is the model's OFF
tick; ON says 11. **A vanilla `Chest` in the same room opens on 13**, where the model says 12. The one-tick order
between the two chests is real, but it sits on the other side of the fencepost from where wave 58's STOP put it.
The model's AP chest is already right with the key OFF. It is the **vanilla** chest that is one tick early, and that
fix is outside this slice's licence ("no change to the vanilla Chest's order"). The key ships OFF with a
⛔ do-not-flip note. OFF is byte-inert everywhere I measured.

| | |
|---|---|
| Start (base) | `ce838c703ade8292050afbf66ff4dd38ab6f8541` (wave 58's tip, `claude/apchest-model-port-r8suva`) |
| Code head (last code commit) | `a02ab9fe890da2e00016c25c2b47820e235ec30e` |
| Commits | `6f84893f` (model + key + rows + censuses), `51f10695` (a key-order pin), `a02ab9fe` (witness + rows) |
| Harness branch | `claude/apchest-cover-order-model-1t7juc` (local branch `seedling-fidelity-apchestcover`) |
| Keys / ON / `SOLVER_ENV_NAMES` | base **145 / 126 / 236**, head **146 / 126 / 237** (measured by importing `contactFidelity.js` and `solverEnvChannel.js`; the env list is sorted, with no duplicates) |

## D1: the AS3 and the model

### The update order (p4h `p4h-as3` @169247c4c4; every cite read with `git show`)

`World.addUpdate` prepends, so the update list is the reverse of `Game.loadlevel`'s add order:

| Add | Line | Updates |
|---|---|---|
| `Player` | `Game.as:2250` | last |
| `Pickups/APChest` (`<apitem kind="chest">`) | `:2335` | after the Button |
| `Button` | `:2348` | after the Cover |
| `Cover` | `:2367` | after the vanilla Chest |
| `Chest` (vanilla) | `:2384` | first of these |

So one frame runs **Chest → Cover → Button → APChest → … → Player**.

- **`Cover.update`** (`Puzzlements/Cover.as:38-69`). When `activate` is set, `alpha -= 0.1`, and on the update where
  `alpha <= 0` it sets `type = ""`. That is the frame the cover stops being Solid: the 11th active update (see
  `activators.opensOnTick(0.1)`). When `activate` is not set, it collides `["Solid","Player"]` at its own box. A
  `Chest` or `APChest` under it calls `reset()` (`:58`). An empty box also calls `reset()`. A Player alone keeps the
  current state.
- **`APChest.update`** (`Pickups/APChest.as:72-80`). The gate is `!collide("Solid", x, y)`; then comes the line one
  pixel under it. `open()` (`:82-94`) latches `frame`, sets `type = ""` and writes `setPersistence(tag, false)`.
- **`Button.update`** (`Puzzlements/Button.as:27-61`). It sets `activate` from its own overlap. The setter calls
  `activateAll`, which writes `activate` on every other `Activators` of the same `t`. It **never writes `type`**. The
  Cover reads that `activate` on its **next** update. So nothing between the Cover and the APChest changes what the
  APChest reads.
- ⚠ `Button.set activate` → `activateAll` → the **other** Button's setter → `activateAll` → … **Two `Button`s in one
  group recurse without end.** The page threw `Maximum call stack size exceeded` at the first press (see Witness).

### The frame table for the L38 room (staged; the player stands in the band and on the button)

**Predicted from source (the brief's and wave 58's reading):**
- The Cover leaves Solid on frame F.
- The APChest's `collide("Solid")` first fails on frame F, so it opens on F.
- The vanilla Chest opens on F+1.

**Measured on the game:**
- APChest: open on **12** (cut 11 not cleared, cut 12 cleared).
- Vanilla Chest: open on **13** (cut 12 not cleared, cut 13 cleared).
- So F = 12 in the tape's tick count.

**Measured on the model:**
- The cover's `s.open` turns in `stepActivators` at the end of advance 11 (`coverOpenTick: 11`).
- OFF, both chests open on 12.

So `stepActivators` at the end of tick *k* is the game's responder update of frame *k+1*. That is the R3 labelling in
`stepActivators`' own docblock ("one object whether you compute it at the bottom of tick N or the top of tick N+1").
`activators` at the chest step of tick *k+1* is therefore already "after this frame's Cover update": the APChest's
read. The fencepost note above `stepChestsNow(activators)` ("the chest opens on the tick AFTER the cover does … needs
no special case") is wrong by one for the **vanilla** chest, which should see the state one step older.

### The model's map (at the base; line numbers re-measured)

- `activators.stepActivators` (`activators.js:791`) runs the presses (`pressedGroups` from the post-move box), the
  ButtonRoom latches, and then each responder's fade, open, occupancy hold and reset. A cover is
  `RESPONDERS.cover` (`fade 0.1`). It opens in the same step that its alpha reaches 0.
- `levelRun` callers of `stepActivators`:
  - `:4049` `spanActivatorFrameNow` (a rock's span frames);
  - `:15148` `inventoryHoldFrameNow`;
  - `:16719` `runFrozenTick` (after `ticksCompleted++`);
  - `:25067` the main tick's end (after `ticksCompleted++`).
  (These numbers are at the head. At the base they are ~4049, ~15083, ~16654 and ~25002.)
- `activatorStateFor(level)` is the per-level state. The main tick reads it as `activators` before the player moves.
  `stepChestsNow(activators)` builds the chest's `solidOver` with `openActivators: openActivatorIds(activators)`.
- `chestStateFor` marks an APChest row `apChest: true` (wave 58). `stepChests` asks `solidOver` only when the line
  touches.

### The change chosen (ON only), and what it reads

- `activators.previewOpenActivatorIds(state, world, box, opts)` runs the **same** `stepActivators` on a copy of
  `byId`, `roomWritten` and `latched` (the only fields the step writes). It returns the open ids and leaves `state`
  untouched.
- In `stepChestsNow`'s `solidOver`, **an AP chest only** reads `apChestCoverOpenNow(activators, box)` when
  `CONTACT_FIDELITY.apChestCoverOrder` is ON. That is the preview from the pre-move box, `inventory`, `keys` and
  `movingSolidsNow()`. The vanilla chest keeps reading `openActivatorIds(activators)`.
- **The inputs.** alpha, open, held, latched and roomWritten, plus the inventory and key set, are final at the chest
  step. The **player box** and the **moving solids** are not: the real step reads the post-move ones.
  `apChestCoverAgreeNow()` runs after the tick's own step (`:16719`, `:25067`). It re-checks every responder over an
  AP chest, and a disagreement throws `AP_CHEST_COVER_NOT_FINAL`. That is the brief's STOP rule, and it is reachable:
  see the rows.
- OFF: `apChestCoverPreview` is never set, so `apChestCoverAgreeNow` returns at once. The expression otherwise
  evaluates the same `openActivatorIds(activators)`.

## D2: the key

`apChestCoverOrder`, LAST in `CONTACT_FIDELITY_DEFAULTS`, default `false`.
- Env: `SEEDLING_AP_CHEST_COVER_ORDER=0|1`.
- `SOLVER_ENV_NAMES` gains `SEEDLING_AP_CHEST_COVER_ORDER`, sorted, before `…_AP_CHEST_ITEM` (237).
- The doc block cites the table above and ends: *⛔⛔ REFUTED BY THE GAME … DO NOT FLIP; the hand-over is the vanilla
  fencepost.*
- **Composes** with every key, because it changes one gate's read. The composition row turns on the base's last four
  OFF keys (`pickupTickFreeze`, `dialogueFrameFreeze`, `frozenTickUngated`, `freezeEdgeFrames`): ON gives 11 and OFF
  gives 12, and L25 is unmoved.
- **Key-order pins** (grepped from `freezeEdgeFrames`, not from a list): 20 `toEqual` tails, `contactFidelity.test.js`
  (its skip list and its defaults object), and `fidelityFreezeEdgeFrames.test.js`'s "appended last". My first grep
  missed that last one, and the after-run caught it (`51f10695`).

### Rows (`fidelityApChestCover.test.js`, fast tier, 22 rows)

- The key: OFF, last, env in the channel; the default in this process.
- `previewOpenActivatorIds` answers what the real step leaves, and leaves the state untouched.
- **L38 (model-only button):**
  - OFF: cover 11, chest 12 (wave 58's row).
  - ON: chest 11. The take is `apitem@144,112` at t 11, `bankedClears` ∋ {38,1} (the `apItemFlags` →
    `pendingEarnedClears` path), and there is no `chestOpens` and no seal.
  - Cut at 10: no take. Cut at 11: the take.
- **The player arriving after the cover completes** (on the button below the band, then north from 15): ON = OFF,
  the whole result.
- **⛔ The named STOP.** The button is moved to x 136; the walk goes `up` to 7, then `right`. OFF takes nothing. ON
  throws `AP_CHEST_COVER_NOT_FINAL`.
- **A vanilla `Chest` under the same cover:** ON = OFF, the whole result, on p4g and on p4h.
- **p4g** `l11-below`, `l25-below`, `l38-covered` and `l38-cover-button`: ON = OFF.
- **p4h** with no cover turning (`l25-side`, `l25-above`, `l25-below`, `l11-below`, `l38-covered`): ON = OFF.
- **Composition** (above).
- **The game witness** reads the committed `d3/witness*.json`. The APChest's game tick is OFF's, not ON's, and both
  replays are 0 px. ⛔ Residue: the vanilla chest's game tick is the model's tick + 1.

### Mutants (copy → break → run the file → restore; each predicted and observed)

| Mutant | Predicted | Red rows |
|---|---|---|
| M1: the ON branch reads `activators` (preview ignored) | the ON rows | 3: the L38 ON row, the take-tick row, composition |
| M2: the preview applies to vanilla chests too | the vanilla row | 1: the vanilla-under-cover row |
| M3: the preview steps the real state (no copy) | purity + ON | 4: the preview row, L38 ON, take tick, composition |
| M4: the re-check never runs | the STOP row | 1: the STOP row |

## D3: measurement

- **Byte-inertia, OFF.**
  - `git diff --name-only ce838c70 HEAD | grep -aE 'fixtures/|golden|tapes/'` is **empty**.
  - `batch-seedling-acceptance.mjs | md5sum` is **`391322d681b7aa0229d94b3f6906d024`** at the base (a detached
    worktree), at the head OFF and at the head ON (`SEEDLING_AP_CHEST_COVER_ORDER=1`).
- **Every committed tape, OFF vs ON** (`…-evidence/tools/tape-onoff.mjs`, wave 56's tool, re-keyed): **294/294
  byte-identical** on p4g, and **294/294** under `setModelBuildDefault(p4h)` (`d3/tapes-onoff-p4{g,h}.txt`).
- **Census** (`tools/census-covered-apchests.mjs` → `d3/census-covered.txt`): the delivered set has 16 chests, all
  AP chests on p4h. **One has a responder over it: L38 `chest@144,112` under `cover@144,112`.** The vanilla atlas
  has the same one, as a vanilla chest.
  - In the delivered L38, `cover@144,112` opens only by the pulser parking the fire block on `button@80,192`
    (`fidelityProximity` D2). The witnessed vanilla tape `prox-l38-chest` reaches the band about 80 ticks after the
    cover opens, so the same-frame case does not arise on it.
  - Seed-1 legs and survey steps run p4g (no APChest; the survey has no capabilities door, wave 58). So **no leg and
    no survey step reaches an AP chest under a cover.**
- **Runtime probe** (a temporary throw at the ON branch, copy + restore): **0 hits** over the 294 tapes × {p4g,
  p4h} and the ON acceptance batch. The positive control, this file's rows, hit it at L38 and L11.
- **Bounded vitest** (`--maxWorkers=3`; the brief's list plus every `grep -a -l` file, 155 → 156 files):
  - **Before** (base): 154/155 green. The one red was `seedlingConstantsCensus` "(b) PREDICTED GREEN", caused by my
    first, inert edit landing mid-run. Re-run on a detached base worktree it is **24/24 green**, so the base is
    green.
  - **After** (`6f84893f`): 155/156. The red was `fidelityFreezeEdgeFrames` "appended last" (the missed pin), fixed
    in `51f10695` (11/11). Since then only the key's doc comment and this file's rows changed (re-run: 84/84 with
    `contactFidelity.test.js`).
  - **ON** (`SEEDLING_AP_CHEST_COVER_ORDER=1`, same 156 files): **ON movers**, both expected, because they are wave
    58's pins of the vanilla order:
    1. `fidelityApChest.test.js` › "L38 (model-only button): the cover opens, then the chest on the next tick — the
       vanilla order (named STOP)" (11 vs 12);
    2. `fidelityApChest.test.js` › "the witness plans … › l38-cover-button" (11 vs 12).

    Two rows skipped by design (this file's default-in-process rows).
  - **Train and slow files naming chest/cover/apChest, ON, one at a time:** `learnLattice.train`,
    `hammerChooserPair.train`, `hammerL98L99.train`, `hammerShovedLookahead.train`, `hammerSouthDoor.train`,
    `hammerTurretApproach.train`, `fidelityLights.slow`, `seedlingGenGoalChestPipeline.slow`,
    `seedlingGenGoalLootSweep.slow` and `strategySwitchTable.slow`. **All green**, with no movers.
- **Censuses.**
  - Constants: `--write`, with two new **structural** rows (`over.length > 0` and `p.t + 1`, in the new helpers)
    and line moves. `--profile-rows` changed no row (`seedling-constants-fields.csv` is unchanged). `--check` PASS.
  - Solver surface: `--write`, 374 rows, line numbers only, then GREEN.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all match.
- `ci-producer-checks.mjs --jobs=3` (at `a02ab9fe`): every one of the 99 producers exited 0, with 1 skipped (the
  standing browser arm). The tally says "1 red", and that is the battery's `TREE-MOVED` guard: it saw this report
  (untracked) appear while I wrote it mid-run. It is not a producer.
- The six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check`: **all checks
  green**.

- **CI** (`JavaScript Unit Tests`, the push run at the last code head `a02ab9fe`, run 45702928188): **success**.
  Suite 29828 passed / 0 failed; slow battery 438 passed. The train tier is not run on a slice push: dispatch
  `unittests_frontend.yml -f train_only=true` at `a02ab9fe` (planner; 403 here). Locally the train files that name
  chest/cover/apChest are green with the key ON (above).

### Witness: recorded here, on the p4h page

```
python3 scripts/serve-nocache.py 9798 &
SEEDLING_PAGE=seedling_bot_ap_p4h SEEDLING_PORT=9798 node CC/docs/cloud-reports/seedling-fidelity-apchestcover-evidence/tools/apchestcover-witness.mjs --out=…/d3/witness.json
SET=vanilla … (same) --out=…/d3/witness-vanilla.json
```

- **Staging (level data, not a game edit).**
  - The delivered set (or the vanilla set) has L38's `buttonroom@144,128` swapped for a `button tset 0`
    (`coverButtonRecord`), and `button@80,192` moved to the unused group 5.
  - It is loaded through `botLoadLevels`, the door the delivered set itself uses, under its own `set_id`
    (`…-l38btn`).
  - The first attempt staged `coverButtonRecord` alone, so two Buttons were in group 0. The page hung at tick 1 with
    `dead_frames` climbing and `Maximum call stack size exceeded` (the `Button.as:42-60` recursion above).
- Tape `l38-cover-button`: up for 30 ticks from (144,128). Cuts at 10, 11, 12 and 13, with `hold`.

| Set | Cuts 10 / 11 / 12 / 13 cleared (slot 38,1) | Game open | Model OFF | Model ON | Stream vs model |
|---|---|---|---|---|---|
| delivered (APChest) | F / F / **T** / T | **12** | 12 | 11 | 0 px both arms (31 obs) |
| vanilla (Chest) | F / F / F / **T** | **13** | 12 | 12 | 1.25 px from t12 (the model's chest opens a tick early) |

- **Named sweep:** none needed. The keyed ON-arm sweep has **0 legs**, because no seed-1 leg or survey step reaches
  an AP chest under a cover (census above). So it is shards = min(10, 0) = 0, ×1 per arm, nothing to dispatch.

## What the brief got wrong (measured)

- "APChest … opens ONE TICK EARLIER than the vanilla order". The relative order holds on the game (12 vs 13). But
  the model's OFF **is** the APChest's order: the model's `activators` at the chest step is already the state after
  that frame's Cover update. The off-by-one is the **vanilla** chest's (model 12, game 13).
- "the state 'after this frame's Cover update, before the Player' is not held at the chest step". It is held: it is
  `activators`. The model steps responders at the end of tick *k* for frame *k+1*.
- The ON shape the brief proposed (a preview of this tick's step) reads the **next** frame's Cover update. That is why
  it is one tick early against the game.
- Wave 58's model-only room (`coverButtonRecord`) cannot run on the game as written: two `Button`s share group 0, and
  `Button.as:42-60` recurses. The model presses each independently and has no such failure.
- The caller line numbers moved (above).

## Hand-overs

- **Planner (fidelity):**
  - The real fix is the **vanilla** `Chest`'s read under a cover: one step older than `activators`. A new key would
    need a licence, because it changes the vanilla Chest's order, which this slice was not given. The game target
    is the vanilla row above (13).
  - Note that the L38 vanilla route (`prox-l38-chest`, 0 px) does not reach the case.
  - Drop or keep `apChestCoverOrder` at harvest: it is OFF and refuted.
  - Dispatch `unittests_frontend.yml -f train_only=true` at `a02ab9fe` (I cannot dispatch, 403).
- **Model (residue, not hammer's):** the fencepost note above `stepChestsNow(activators)` in `levelRun.js` claims
  the vanilla chest reads "exactly the previous tick's state, which is what the game's chest sees". It is wrong by
  one for a cover that turns while the player stands in the band. That is unwitnessed on any route; witnessed only
  here.
- **Model (a gap):** two `Button`s of one group crash the game (infinite recursion). The model presses them
  independently. No vanilla or delivered room has two plain `Button`s in one group? *Not measured*: a census row
  for the planner.
- **HAMMER:** none new. Wave 58's three hand-overs stand.
- **JS arc:** none.

## Residue

- The vanilla Chest/Cover fencepost (above).
- `apChestCoverOrder` stays in the table, OFF, with its refuting rows.
- `Cover.as:58` resets with a `Chest`/`APChest` under it **even when the Player overlaps**. The model's `occupied`
  guard holds the cover on the Player alone. This is pre-existing; `seedlingResponderFade` covers the shape
  separately, and I did not touch it.
