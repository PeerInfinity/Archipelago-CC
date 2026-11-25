# seedling-fidelity-chestcover: the vanilla Chest under a Cover (planning-24, wave 61)

**Verdict: PASS. The fix is modelled behind one new key, OFF, and the game agrees with ON.** I re-recorded the witness
on the default p4g page in this container. In the staged L38 room the vanilla `Chest` opens on **13**. ON opens it on
13, and ON replays the whole 31-observation stream at **0 px**. OFF opens it on 12 and is 1.25 px off from t12, the
same as wave 60's p4h row. OFF is byte-inert everywhere I measured. Across 294 tapes, the acceptance batch, the six
solves and the census, nothing the model ships reaches the case, so there is nothing for an ON sweep to run.

**STOP for the planner (census only, nothing changed): the hand editor can build the recursion room.**
`watchEdit.ENTITY_ROSTER` places every `button` with `tset '0'`. So two placed buttons share group 0 unless an `attrs`
edit moves one. That room hangs the game (`Button.as:42-60`), while the model presses each button independently and
the oracle certifies it. No vanilla, delivered or generated room has the shape (the census below, with controls).

| | |
|---|---|
| Start (base) | `478a0fed4c833592cdfbbf502202e4fabc020ef0` (the W59 harvest, `fidelity-harvest/plainpickup-w59`) |
| Code head (last code commit) | `69764869ba4a3c48cdc967cd5bf3eeee6011dcf7` |
| Commits | `86de9a58` (key + model + pins + shared module), `1f2ab082` (rows + p4g witness + tapes), `db5abfee` (censuses), `69764869` (solver-surface regen, probe evidence, module note), then the report (docs only) |
| Harness branch | `claude/chest-cover-tick-order-i4hzpy` (local branch `seedling-fidelity-chestcover`) |
| Keys / ON / `SOLVER_ENV_NAMES` | base **149 / 126 / 246**, head **150 / 126 / 247**, measured by importing `contactFidelity.js` and `solverEnvChannel.js`. The env list is sorted, with no duplicates |

Evidence: `CC/docs/cloud-reports/seedling-fidelity-chestcover-evidence/`. It holds `tools/` (wave 60's tools copied,
plus mine), `w60/` (wave 60's p4h vanilla witness, copied verbatim) and `d3/` (this slice's measurements).

## D1: the AS3 and the model

### The frame table (vendor `vendor/seedling` @ccdf1897, read here; p4h lines from wave 60)

`World.addUpdate` (`net/flashpunk/World.as:937-951`) prepends. So the update list runs in the reverse of
`Game.loadlevel`'s add order.

| Add | vendor line | p4h line | Updates |
|---|---|---|---|
| `Player` | `Game.as:2250` | `:2250` | last |
| `Button` | `:2341` | `:2348` | after every responder |
| `Lock`, `RockLock`, `Pulser` | `:2355-2357` | | |
| `Cover` | `:2360` | `:2367` | after the Chest |
| `GrassLock`, `ShieldLock`×2, `WandLock`, `BossLock`, `MagicalLock`×2 | `:2361-2367` | | before the Cover |
| `Chest` | `:2377` | `:2384` | **before every responder** |
| `PushableBlock`, `…Fire`, `…Spear` | `:2382-2384` | | before the Chest |
| `WallFlyer`, `Spinner` | `:2415-2416` | | before all of these |

- `Chest.update` (`Chest.as:59-67`) runs `checkBySeal()` and then gates on `!collide("Solid", x, y)` plus the line one
  pixel under its box (`y - originY + height + 1`). So it reads the Cover's `type` as the **previous** frame's
  `Cover.update` left it.
- `Cover.update` (`Puzzlements/Cover.as:37-68`). When active, `alpha -= 0.1`, and it sets `type = ""` on the update
  where `alpha <= 0` (the 11th active update). When not active, it resets on a `Chest` under it or on an empty box.
- The model steps responders at the end of tick k. By `stepActivators`' own labelling, that step is the game's
  responder update of frame k+1. So `activators` at the chest step of tick k+1 is already "after this frame's Cover
  update". That is right for the Player and the APChest, and one step new for the vanilla Chest.

### The other reader-before-responder pairings (measured from source; hand-overs, not changed)

| Reader (updates before the responders) | What it reads | The model's read | Off by one? |
|---|---|---|---|
| **Chest** (`:2377`) | `collide("Solid")` at its own box | `stepChestsNow` → `openActivatorIds(activators)` | **yes: this slice (ON fixes it)** |
| `PushableBlock*` (`:2382-2384`, `Mobile`) | `collideTypes(solids)` in its sweep | `pushableCtx` → `openActivatorIds` (current) | **yes, both directions; unwitnessed** |
| `Spinner` (`:2416`) | its sweep | `spinnerCtx` → `openActivatorIdsBeforeLatestStep` under `spinnerLockLag` (ON by default) | opens: fixed (L40RES, game-witnessed). A reset on the latest step is **not** covered: that helper reads `held` and drops only fresh opens |
| `WallFlyer` (`:2415`) | `collideTypes(["Solid","Tree"])` and its sweep | `stepWallFlyersNow` → `spinnerCtx` | the same as the Spinner |
| `Pod` (`:2409`) | `collideTypesInto(["Player"])` | n/a | no: it reads no responder |
| Moonrock, BreakableRock, DungeonSpire, the statues | only set their own `type = "Solid"` | n/a | no |

Readers that update after the responders (every enemy `:2276-2299`, every pickup `:2330-2340`, the Crusher `:2300`,
the FallRocks `:2353-2354`, the Player) see the current set. That is the model's `activators` read, so it is right.

### The model's map (at the head)

- `activators.stepActivators` (`activators.js:767`) runs the presses (`pressedGroups`), the ButtonRoom latches, and each
  responder's fade, open, hold and reset. With the key ON, it first writes `state.openBefore = openActivatorIds(state)`.
- `levelRun` has four callers of `stepActivators`. Each one now takes the snapshot, because it lives inside the step:
  - the main tick's end, after `ticksCompleted++`;
  - `runFrozenTick` (a frozen tick's end);
  - `inventoryHoldFrameNow` (each held frame);
  - `spanActivatorFrameNow` (a rope span's frames, all but the release frame, whose update is the pull tick's own
    end-of-tick step).

  Every one of them is the responder update of the frame whose chest step comes next. So "the set before the latest
  step" is the chest's read at every caller, a span or a hold included.
- `activatorStateFor(level)` is the per-visit state, and it is in the run digest (`visit.activatorStates`). So ON, the
  snapshot is digested too, which is right: two states that differ only in it behave differently. OFF writes no field.
- `stepChestsNow(activators)` (one caller, the main tick) asks `solidOver`. With the key ON, a chest whose row has no
  `apChest` reads `openActivatorIdsBeforeStep(activators)`. That is the snapshot, or the current set on a state no step
  has run on yet: the constructed set, which is what a fresh visit's chest sees. The APChest arm (wave 58, P2) is
  **not on this base**. The `!c.apChest` guard keeps it on `openActivatorIds` when P2 merges.

### The change chosen

The smallest exact change is the snapshot, not the existing `openActivatorIdsBeforeLatestStep` (the Spinner's). That
helper drops only a responder that **opened** on the latest step. The chest must also see a cover that **reset** on the
latest step as still open (`Cover.as:58`'s reset is one frame too). The rows show the difference (the reset row,
mutant M3). No case needed state the model does not hold, so there is no STOP on D1.

## D2: the key

`chestCoverFencepost`, LAST in `CONTACT_FIDELITY_DEFAULTS` (after `plainPickupInFreeze`), default `false`.
- Env: `SEEDLING_CHEST_COVER_FENCEPOST=0|1`.
- `SOLVER_ENV_NAMES` gains it, sorted, between `…_CHEST_BODY_PLACEMENT_PROBE` and `…_CHEST_LEG_DELTA` (247).
- The doc block cites the table above and wave 60's p4h witness. It names the hand-overs (pushables, spinner resets) and
  ends ⛔ OFF by default.
- **Composes** with every key: it changes one gate's read. The composition row turns on the base's last four OFF keys
  (`freezeReleaseTick`, `freezeSpanUpdates`, `nestedRockCeremony`, `plainPickupInFreeze`). With them, ON gives 13 and
  OFF gives 12. The late walk and `prox-l38-chest` are unmoved.
- **Key-order pins** (grepped for `'plainPickupInFreeze']`, not taken from a list): 24 test files with a `toEqual` tail
  each. Plus `contactFidelity.test.js` (its defaults object and its env skip list), and
  `fidelityPlainPickupInFreeze.test.js`'s `.at(-1)` "last" row, now a "followed by" row. ⚠ My mechanical append broke
  two `slice(-N)` pins (`fidelityFreezeSpanUpdates`, `fidelityNestedRockCeremony`). I caught them before the commit
  and widened N.

### Rows (`fidelityChestCover.test.js`, fast tier)

The shared module is `fidelityChestCover.js`. It holds the staged room (`coverButtonRecord`: `buttonroom@144,128` → a
`button tset 0`, **and** `button@80,192` → group 5, so ONE Button is in group 0), the tapes (on the L25 survey header)
and the replay.
- The key: OFF, last, env in the channel; OFF in this process (skipped under a measuring env).
- The snapshot, at the activators level:
  - the staged room holds one Button in group 0, and the cover is over the chest;
  - OFF writes no field;
  - ON, the open: the cover is open after step 11, and the chest's read sees it after step 12;
  - ON, the reset: off the button at step 12, the chest still sees the cover open, where the Spinner's helper says
    shut.
- **The stand** (`l38-cover-button`):
  - OFF opens on 12. ON opens on **13**, with `chestOpens` `{t: 13}`.
  - Cut at 12, ON: no open, no banked {38,1}, no SealPiece. Cut at 13: all three. OFF has all three at 12.
- **The late walk** (`l38-cover-late`: still on the button for 20 ticks, then north): ON = OFF, the whole replay and
  the effects. It opens on 26.
- **Composition** (above).
- **Every committed tape that opens a chest:** `prox-l38-chest` (the vanilla L38 route), `prox-l38-reach-l39`,
  `r5-totem-entrance`(+`-control`), `r5-l40-join`(+`-control`), `r7-act2-full`, `r8-solve-11`, `r9-solve-11`,
  `stance-l46-chest` and `stance-l48-chest`. Each one gives ON = OFF over the whole `runTape` result.
- **A chest with no cover:** L11, L40, L46 and L48 have no responder over the chest (asserted), and their tapes are
  in the row above.
- **The game witness** reads the committed `d3/witness-p4g.json`:
  - the stand: the game opens on 13 (cut 12 not cleared, 13 cleared), ON is 0 px over the stream, OFF 1.25 px;
  - wave 60's p4h vanilla row says 13 as well;
  - the late walk: the game opens on 26, and both arms are 0 px.

### Mutants (copy → break → run the file → restore; `tools/mutants.py`)

| Mutant | Predicted | Red rows |
|---|---|---|
| M1: the ON branch reads `openActivatorIds` | 3: the stand ON, composition, the witness stand | **3**, as predicted |
| M2: the snapshot is written OFF too | 1: OFF writes no field | **1** |
| M3: the reader is the Spinner's helper (opens only) | 1: the reset row | **2**: the reset row, and the OFF row, because the mutant replaced the exported reader, which the OFF row also asks |
| M4: the snapshot is taken after the mutation | 5: the open, the reset, the stand ON, composition, the witness stand | **5** |

The sources were restored after each one (`git status` clean).

## D3: measurement

- **Byte-inertia, OFF.** `git diff --name-only 478a0fed HEAD | grep -aE 'fixtures/|golden|tapes/'` is **empty**.
- **`batch-seedling-acceptance.mjs | md5sum`**: **`391322d681b7aa0229d94b3f6906d024`** in every arm:
  - the base (measured before the first edit);
  - the head OFF;
  - the head ON;
  - the head ON plus the last four OFF keys;
  - the last four alone.
- **Every committed tape, OFF vs ON** (`tools/tape-onoff.mjs`, re-keyed): **294/294 byte-identical**
  (`d3/tapes-onoff.txt`). 11 of them open a chest (listed above).
- **The runtime probe** (a temporary throw in `solidOver` when ON's answer differs from OFF's; copy + restore,
  `d3/runtime-probe.txt`):
  - **0 hits** over the 294 tapes, the ON acceptance batch, and the six `solve-seedling-*.mjs --check` with the key ON
    (all green);
  - the positive control, this file's rows, hits at L38 `chest@144,112` tick 11.
- **The covered-chest census** (`tools/census.mjs` → `d3/census.txt`):
  - vanilla atlas: 116 levels, 16 chests, **1 under a responder: L38 `chest@144,112` under `cover@144,112` (t 0)**;
  - the delivered set (playthrough AP_1, p4g records): 0 chests (they are `APItem`s on p4g; wave 60 measured the p4h
    side: 16 AP chests, the same L38 one covered);
  - every committed generated preset (`seedling_generated_{chestdoor,host,leaf,room,swim}`): 12 rooms, 2 chests, 0
    covered.

  The generator's emitters, by source: `procgenSeedlingElements.js` emits `chest` (chest door, loot chest), `lock`,
  `shieldlocknorm`, `bosslock`, `button` and `buttonroom`, and **never `cover`**. The only covered chest anywhere is the
  vanilla L38 one. On its witnessed route `prox-l38-chest`, the chest opens at t249, long after the cover (the pulser
  parks the fire block on `button@80,192`): the runtime probe says the same-frame window is never reached.
- **The two-Button census** (same tool, with three positive controls):
  - **0** groups with two plain `Button`s, and **0** recursion shapes in the vanilla atlas, the delivered set and the
    generated presets.
  - Controls: wave 60's first staging → 1 and 1. Button + `ButtonRoom{-1, flip 0}` → 0 and 1. Button +
    `ButtonRoom{-1, flip 1}` → 0 and 0.
  - **The family is wider than two Buttons** (measured from source): `RopeStart.set activate` (`RopeStart.as:79-90`)
    re-publishes unconditionally too, and `ButtonRoom.set activate` with `room == -1` (`ButtonRoom.as:67-98`)
    re-publishes `true`.

    | Pair in one group | When it recurses |
    |---|---|
    | {Button, RopeStart} × {Button, RopeStart} | the first frame (`Button.update` writes every frame) |
    | either one + a `ButtonRoom{-1, flip 0}` | once the group goes true |
    | two `ButtonRoom{-1}`, one of them flip 0 | once one is pressed |

  - **The generator cannot emit it.** Every presser's group is `placementGroupId(own cell)` (`procgenSeedling.js:800`,
    injective; the guard element fails by name on a collision, `procgenSeedlingElements.js`). That covers the weigh
    gate's `button`, the hold gate's `buttonroom`, the reverse-pull element's `button` and `buttonroom`, and the area
    flags' `buttonroom{-1, flip 0}` (`procgenSeedling.js:2791`, one flag per symbol).
  - **⛔ The hand editor can** (`watchEdit.ENTITY_ROSTER`: `button {tset: '0'}`). That is the STOP at the top. No
    committed edit list in the tests places two buttons.
- **ON movers: none.** I ran the same 277 fast-tier files with `SEEDLING_CHEST_COVER_FENCEPOST=1`. The file list is
  the brief's globs, every `grep -a -l` file (`stepActivators`, `stepChestsNow`, `openActivatorIds`,
  `activatorStateFor`, `chestStateFor`, the key), every key-order pin, the named gate files, and every fast-tier test
  that names `chest`, `Chest`, `cover`, `Cover` or `activators`.
  - Result: **277/277 files, 7713 passed, 2 skipped by design**: the two "OFF in this process" rows, this file's and
    `contactFidelity.test.js`'s defaults row.
  - **The 12 `.train.`/`.slow.` files** that name a chest, cover or activators, ON, **one at a time** under their own
    config: `deriveLevelWorldLogic.slow`, `atlasMazeBot.slow`, `sphereAtlas.slow`, `hammerKill880StandHold.train`,
    `hammerL98L99.train`, `hammerShovedLookahead.train`, `hammerSouthDoor.train`, `hammerTurretApproach.train`,
    `seedlingGenGoalChestPipeline.slow`, `seedlingGenGoalLootSweep.slow`, `strategySwitchTable.slow` and
    `strikePreviewLean.slow`. **All green**, with no movers.
- **Censuses.**
  - Solver surface: `--write`, 374 rows, line numbers only (57), then GREEN.
  - Constants: `--check` PASS (7179 literals; 0 new, 0 vanished, 825 moved), so no `--write` was needed.
    `--profile-rows` was not needed either (no row changed).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match.
- **Bounded vitest** (`--maxWorkers=3`):
  - **Before**, at the base: the brief's gate list plus every `grep -a -l` file and every key-order pin, 49 files:
    **49/49, 1324 passed**.
  - **After**, at `69764869`: that list plus this file and every fast-tier file naming a chest, cover or activators,
    277 files: **277/277, 7715 passed**.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red, 1 skipped** (the standing browser arm), 0 known-red.
- The six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check`: **all checks green**
  OFF (default), and all green ON with the probe armed (above).
- **CI** (`JavaScript Unit Tests`, the push run at the last code head `69764869`, run 45712755727): **success**.
  - The suite: **30169 passed / 0 failed / 0 skipped** over 3 shards.
  - The slow battery: **460 passed**.
  - The train tier does not run on a slice push. Dispatch `unittests_frontend.yml -f train_only=true` at `69764869`
    (the planner's; I get 403 here). Locally, the train files that name a chest, cover or activators are green with the
    key ON (above).
- **Game witness** (`tools/chestcover-witness.mjs`, recorded here on **p4g**, the default page; `d3/witness-p4g.json`
  keeps the whole drained stream):

  | Plan | Cuts (slot 38,1 cleared) | Game open | Model OFF | Model ON | Stream vs model |
  |---|---|---|---|---|---|
  | `l38-cover-button` | 10 F, 11 F, 12 F, **13 T**, 14 T | **13** | 12 | **13** | OFF 1.25 px from t12; **ON 0 px** (31 obs) |
  | `l38-cover-late` | 24 F, 25 F, **26 T**, 27 T | **26** | 26 | 26 | 0 px in both arms (51 obs) |

  The tool also checks that the record-set source the page mounts and the atlas source the rows use replay the same.
  It loads through `botLoadLevels` under its own `set_id` (`…-l38btn1`), with one Button in group 0: the page did not
  hang.
- **The named sweep:** none. The keyed ON-arm sweep has **0 legs**, so shards = min(10, 0) = 0, ×1 per arm, and there
  is nothing to dispatch. The reason: no seed-1 leg, survey step, tape or acceptance row reaches a chest under a cover
  in the same-frame window (the probe and the census above).

## What the brief got wrong (measured)

- "Two `Button`s with the same `t`" is one shape of a wider family. A `RopeStart`, or a `ButtonRoom` with `room -1`,
  recurses with a Button too (table above). The census covers the whole family.
- The add-order cites (`:2384`, `:2367`, `:2348`, `:2335`) are p4h's. The vendored source (`vendor/seedling`
  @ccdf1897) has `Chest :2377`, `Cover :2360` and `Button :2341`, and no APChest. The doc block cites both.
- "The base's last 4 OFF keys" are `freezeReleaseTick`, `freezeSpanUpdates`, `nestedRockCeremony` and
  `plainPickupInFreeze`. They are not wave 60's set: W59 added one.
- "Re-record it on the p4g (default) page if your container can boot `seedling_bot_ap_p4g`": it could, and the p4h page
  is not in this container (only p4d, p4g and the original), so the p4h row is wave 60's, quoted.
- The fencepost note is kept, as the OFF branch's, with the corrected reading added under it for ON.

## Hand-overs

- **Planner (fidelity):**
  - ⛔ **STOP (census):** `watchEdit` can author two Buttons in group 0, which hangs the game and is certified by the
    model. Options for a later licence: model the hang as a refusal (a `LevelWorldError` by name on any recursion
    shape), or have the editor allocate a fresh group per placed presser. I changed neither.
  - The flip is yours. ON is game-witnessed on p4g (0 px) and p4h (wave 60's 13). The ON sweep has 0 legs. Nothing
    hitless can turn hit-taking, because no leg reaches the branch (probe: 0 hits).
  - Dispatch `unittests_frontend.yml -f train_only=true` at `69764869` (I cannot dispatch: 403).
- **Fidelity (new pairings, unwitnessed, no route reaches them):**
  - a `PushableBlock*` reads the current open set, but it updates before every responder;
  - `spinnerLockLag`'s helper covers a fresh open but not a reset on the latest step, for the Spinner and the WallFlyer
    alike. `openActivatorIdsBeforeStep` is the exact read both could use, under their own key.
- **Residue (pre-existing, not touched):**
  - the model steps no chest on a frozen tick, a hold frame or a span frame (the game's `Chest.update` is ungated; the
    hold refuses an opening chest by name);
  - `Cover.as:58`'s reset with a chest under it even when the Player overlaps (the model's `occupied` guard).
- **HAMMER / JS arc:** none.
