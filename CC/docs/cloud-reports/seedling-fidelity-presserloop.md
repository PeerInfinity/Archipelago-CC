# Seedling fidelity PRESSERLOOP (wave 62): the game's hang on a recursing activator group

**Verdict: PASS.** One new key, `presserRecursionHang`, ships OFF and appended last. I measured the game on 17 staged
shapes (p4g, plus p4d on five). Every recursing shape throws `Maximum call stack size exceeded` **once**, and then **no
later frame runs**. The tick, `dead_frames`, the position and the persistence readout stay frozen, no door is reached and
nothing is written.

With the key ON:
- A room whose recursion fires on the build's first frame is refused at build by name (`LevelWorldError`).
- A publish during the run (a press, a rope pull, the wand's sweep) into a recursing group marks the activator state.
  The run's next `advance` then throws `PresserRecursionHang`.
- The ON replay is the game's stream at 0 px and stops where the game stops: 24 observations on every press shape. The
  one named exception is the Button+Button/Rope first-frame refusal, where the game drains its arrival observation and
  the model refuses at build.

OFF is byte-inert:
- the acceptance md5 is the standing value at the base, head OFF, head ON and head ON + the last 4 keys;
- 294/294 tapes are identical OFF vs ON (both alone and composed);
- there are no fixture, golden or tape diffs.

The census finds **0** recursion groups in 844 non-control rooms (vanilla, delivered, generated presets and a 600-room
generator sweep). So the keyed ON-arm sweep has 0 legs.

| | |
|---|---|
| Start (base) | `fbdd2ab6853653c73bcd59839a76728dbc41889d` (wave 61's tip, `claude/chest-cover-tick-order-i4hzpy`) |
| Code head (last code commit) | `554e33014a7ab5e7ed96bf962f0ff2dad9f95b11` (CI `JavaScript Unit Tests` push run 45729953126: **success**) |
| Commits | `2a3ceb63` (model, key, pins, rows, witness), `053f9612` (censuses), `554e3301` (the 17th shape, env-robust rows, no-write row, D3 evidence), `47e476a6` (mutants, runtime probe), then this report |
| Harness branch | `claude/seedling-hang-dual-pressers-qvdl42` (local branch `seedling-fidelity-presserloop`) |
| Keys / ON / `SOLVER_ENV_NAMES` | base **150 / 126 / 247**, head **151 / 126 / 248** (measured by importing `contactFidelity.js` and `solverEnvChannel.js`; the env list is sorted, with no duplicates) |

## D1: the AS3, the game after the throw, and the model

### 1. The setters (vendor `vendor/seedling/src`, the default build's pinned source)

`Activators.set activate` (`Puzzlements/Activators.as:20-23`) is `_active = a` and nothing else. I re-measured the
thirteen subclasses (`grep "extends Activators"`). **Exactly three re-publish:**

| Class | Setter | Publishes | Value |
|---|---|---|---|
| `Button` | `Button.as:42-48` → `activateAll` `:50-61` (`FP.world.getClass(Activators)`, every `v[i] != _exclude && v[i].t == _t`) | every call | the value it got |
| `RopeStart` | `RopeStart.as:79-91` (the same walk, inline) | every call | the value it got |
| `ButtonRoom`, `room == -1` | `ButtonRoom.as:67-98`, body inside `if (a)`; the walk `:79-90` | only a true | `persist = a`, flipped by `flip`: **flip 0 → true, flip 1 → false** |
| `ButtonRoom`, `room >= 0` | `:91-94` `Game.setPersistence(t, persist, room)` | nothing locally | — |

The other ten store the flag and stop, so none publishes back: `Lock.as:55`, `RockLock.as:40`, `BossLock.as:49`,
`LightPole.as:94` (a persistence write), `FallRock.as:111` / `FallRockLarge.as:145` (`fall()`), plus `Cover`,
`Crusher`, `Pulser` and `ArrowTrap` on the base setter. Two non-`Activators` callers publish into a group:
- `Pickups/Wand.as:55-70` (`n.activate = true` on every tset-0 member);
- `Enemies/FinalBoss.as:218` (`Button.activateAll(null, 0, true)`).

**Who writes each setter, and when:**
- `Button.update` (`Button.as:27-40`) writes `activate = <overlap>` **every frame**.
- `RopeStart.hit()` (`:40-49`, from `Player.as:1097`, a sword hit) writes a true. So does `RopeStart.check()`
  (`:31-38`) when the rope's tag is cleared.
- `ButtonRoom.update` (`:52-65`) writes the overlap every frame (a false is ignored). `ButtonRoom.check()` (`:40-50`)
  writes `!checkPersistence(tag)`: true when the tag is cleared.
- `check()` runs for every entity on the first frame of a new `Game`, in the `if (!checked)` pass, before the
  `blackCover` gate and before any `update()` (`Game.as:870-880`).

**The family, derived:**
- A **false** loops forever between two pass-throughs (Button / RopeStart).
- A **true** loops among the pass-throughs and the flip-0 ButtonRooms. A flip-1 one turns a true into a false, which
  loops only where the false does.

With *pass* = #Button + #RopeStart and *br0* / *br1* = the `room == -1` ButtonRooms by flip, in one `t`:

| Condition | When the game recurses |
|---|---|
| a Button, and pass ≥ 2 | the **first live frame** (`Button.update` writes every frame) |
| pass + br0 ≥ 2 and a `check()` publishes true (a cleared rope tag, a cleared flip-0 ButtonRoom tag) | the **build's first frame**, inside `check()` |
| pass ≥ 2 and a flip-1 ButtonRoom boots pressed | the build's first frame (its `check()` publishes false) |
| pass + br0 ≥ 2 | the frame a **true** is published: a Button or flip-0 ButtonRoom pressed, a rope pulled, the wand's sweep |
| pass ≥ 2 (two ropes, no Button) | the frame a flip-1 ButtonRoom is pressed (its false runs the rope pair), or any true |

**Wave 61's table, re-measured:**
- "{Button, RopeStart} × {Button, RopeStart} — the first frame" is **wrong for two ropes**. With no Button nothing
  writes every frame, so two unpulled ropes run forever (the `rope-rope` shape below plays out).
- "two `ButtonRoom{-1}`, one of them flip 0 — once one is pressed" is **wrong for flip 0 + flip 1**. The flip-1 one
  answers false, and a false into a ButtonRoom stops (`br0-br1` and `br1-br0` play out). Two flip-0 ones are needed.
- **Missed by the table:**
  - a flip-1 ButtonRoom with two ropes (its press hangs);
  - the at-build shapes (a pulled rope, a pressed-at-boot ButtonRoom);
  - three-way groups, which follow the same counts: Button + br1 + br1 does not loop, br1 + rope + rope does.
  - `Lock`/`Cover`-side setters publish nothing back: no shape there.

### 2. What the game does after the throw (MEASURED)

**Tool:** `-evidence/tools/hang-witness.mjs`.
- Each shape is the vanilla L38 plus its pressers in group 6, which L38 does not use.
  - The on-walk presser is at (144,224); the others are off-walk floor at (176,240) / (112,240).
  - The rooms are `fidelityPresserHang.HANG_SHAPES` (shared with the rows).
- It is loaded through `botLoadLevels` under its own `set_id` (level data; no game edit).
- The tape boots at (144,192) and walks DOWN for 90 ticks. It crosses the on-walk presser, then
  `buttonroom@144,288` (t 4, tag 5, flip 1, room 37), and reaches the south door to L37 at t 88.
- Each shape runs on a **fresh page**. The page's errors are kept with wall-clock times, `botStatus` is sampled every
  150 ms for 15 s, and `botDrain` is read at the end.
- Streams: `d3/witness-p4g.json` / `.log`, and `d3/witness-p4d.json` / `.log` (p4d: btn-btn, rope-rope-pulled,
  br0-btn, br0-br1, btn-solo, **identical** to p4g).

| Shape (group 6) | Game | Drained obs | `tick` | `dead_frames` | Level | Cleared (38/37) |
|---|---|---|---|---|---|---|
| `btn-btn` | **HUNG** | 1 | 1 | 20 | 38 | — |
| `btn-rope` | **HUNG** | 1 | 1 | 20 | 38 | — |
| `rope-rope` (neither pulled) | plays out | 91 | 90 | 40 | 37 | 37,4 38,5 |
| `rope-rope-pulled` (tag 10 cleared) | **HUNG** | 0 | 0 | 1 | 38 | (the staged 38,10) |
| `br0-btn` (flip-0 on the walk) | **HUNG** | 24 | 24 | 20 | 38 | — |
| `btn-br0` (Button on the walk) | **HUNG** | 24 | 24 | 20 | 38 | — |
| `br0-br0` | **HUNG** | 24 | 24 | 20 | 38 | — |
| `br0-rope` | **HUNG** | 24 | 24 | 20 | 38 | — |
| `br1-rope-rope` (flip-1 on the walk) | **HUNG** | 24 | 24 | 20 | 38 | — |
| `btn-br0-boot` (flip-0's tag cleared) | **HUNG** | 0 | 0 | 1 | 38 | (the staged 38,10) |
| `br1-btn` / `btn-br1` / `br1-br0` / `brx-btn` (room 37) | plays out | 91 | 90 | 40 | 37 | 37,4 38,5 38,10 |
| `br0-br1` | plays out | 91 | 90 | 40 | 37 | 37,4 38,5 38,10 **38,11** |
| `btn-solo` | plays out | 91 | 90 | 40 | 37 | 37,4 38,5 |
| `br1-btn-br0` (flip-1 on the walk; a Button and a flip-0 off it) | plays out | 91 | 90 | 40 | 37 | 37,4 38,5 38,10 |

The whole 17-shape run was recorded twice (the second run added `br1-btn-br0`), and every shared shape's summary is
identical between the two. The committed stream is the second run.

**The game's state, named: HUNG.**
- After the one `pageerror: Maximum call stack size exceeded`, **no later frame runs at all**.
  - On every hung shape, 83–92 samples over at least 12.7 s after the throw show **no field changing**: `tick`,
    `buffered`, `dead_frames`, `x`, `y`, `level`, the persistence readout.
  - There is no second error, so the frames are not re-throwing: they are not running.
  - So `Bot.update` (the first call in `Main.update`, `Main.as:79`) does not run either.
- The JS side is alive (`botStatus` and `botDrain` answer), but the movie's frame loop is gone. No try/catch exists in
  `Game`, `Main`, `Engine` or `World`, so the stack-overflow `RangeError` unwinds `Engine.onEnterFrame`, and this
  runtime does not schedule the next frame.
- **Where the throw lands:**
  - **Button+Button, Button+Rope:** in the first live frame's world update, after `Bot.update` recorded observation 0
    and moved `tick` to 1. The fade's 20 dead frames ran first, because `Game.update` skips `super.update()` while
    `blackCover > 0`.
  - **A pulled rope pair, a pressed-at-boot flip-0 ButtonRoom with a Button:** inside the first frame's `check()` pass.
    That is one dead frame (`blackCover > 0`), and **no observation at all**.
  - **The press shapes:** in the world update of the frame that recorded observation 23. The on-walk presser updates
    before the Player (`addUpdate` prepends) and reads the box observation 23 left. So 24 observations, `tick` 24.
    - **No persistence** is written: the pressed ButtonRoom's own `setPersistence(tag)` (`ButtonRoom.as:96`) is below
      the recursion.
    - `buttonroom@144,288` is never reached.
    - **No door**: L37 is never entered.
- **Not measurable on this page, named:** a death, damage and the AP check after the throw. No frame runs, so none can
  happen, and there is nothing to stage that would show one.
- **⚠ The `dead_frames` reading in the brief and wave 60** ("climbing") is not what p4g/p4d show. It stops at the
  fade's 20 (or 1 for a `check()` hang) and never moves again.

### 3. The model's map (at the base)

- **The group index.**
  - `levelWorld.buildLevelWorld` builds `world.pressers` (`button` and `buttonroom`, with `t`, `rect`, and for a
    ButtonRoom `room`, `flip`, `persistTag`, `bootPressed`).
  - It builds each rope as a solid with `ropeId`, `ropeT`, `ropeTag` and `bootPulled`.
  - `ACTIVATOR_PRESSERS` is `{button, buttonroom}`.
- **The presses.**
  - `activators.stepActivators` runs `pressedGroups` (the post-move box).
  - It runs the ButtonRoom arm: `roomWritten`, `localPublish` → `state.latched`, and `crossRoomWrites`.
  - Then each responder's fade, open and reset.
  - The callers are `levelRun`'s main tick end, `runFrozenTick`, `inventoryHoldFrameNow` and
    `spanActivatorFrameNow`.
- **The latches.**
  - `createActivatorState` → `bootPress` (a pressed-at-boot ButtonRoom).
  - `levelRun.buildActivatorState` → `bootPulledRopes` → `publishRopeGroup({atBuild})`.
  - A pull goes through `dropRock` → `publishRopeGroup`.
  - The wand sweep is `latched.set(WAND_PICKUP.tset)` in `Wand.removed`'s arm.
  - **`FinalBoss`'s `activateAll(null, 0, true)` is not modelled as a publish**: the model takes the boss room's
    rocklock off its tag.
- **Where a run can end by name.**
  - `LevelWorldError` (`buildLevelWorld`'s `fail`) refuses a world at build.
  - `ActivatorError` comes from the activator machinery.
  - `levelRun` throws named `Error`s for terminal game states (e.g. the ShieldLock `turnOff` that never restores input).
  - The solver's refusals are read-only here (hammer's).
- **The model OFF on these rooms.** It presses each presser independently and plays every shape out to L37: the
  certification gap.

### 4. The change chosen (the measured behaviour, modelled)

- **`levelWorld.presserRecursionGroups(world)`**: the census above, over the built world's `pressers` and rope solids.
  It returns `{t, members, trueLoops, falseLoops, firstFrame, bootBy}` for each group that can recurse, by `t`.
- **At build (ON):** `buildLevelWorld` refuses a world with a `bootBy` or a `firstFrame` group. The refusal is a
  `LevelWorldError` naming the group, every re-publisher with its kind, the cites, and "PRESSER RECURSION HANG".
  - That matches the game exactly for the `check()` shapes, where the game drains 0 observations.
  - For Button+Button/Rope the game drains its **arrival observation** before the hang (`Bot.update` runs before the
    world's update). The model refuses the room. That is one row of the boot position, not a frame of play.
    - It is kept as a build refusal (the brief's shape) so that a consumer that builds without running (a planner, a
      census, an editor check) cannot certify the room either. Named below.
- **During a run (ON):** `stepActivators` (every caller) tests each pressed presser first:
  - a Button publishes true;
  - a `room == -1` ButtonRoom publishes `!flip`;
  - a cross-room one publishes nothing.

  If the value hangs its group (`presserRecursionHangsOn`), the state is marked `presserHang` (the first kept) and the
  step returns with no other mutation: no latch, no fade, no `roomwrite`, so no clear is banked. `publishRopeGroup` (a
  pull, not at build) and the wand's sweep mark it the same way.

  `levelRun.advance` refuses the next tick by name, `PresserRecursionHang` (an `ActivatorError` carrying `hang`). The
  check is the first line **inside** the tick arrow, which keeps `fidelityFencepost`'s SOURCE-SHAPE pin.

  So the tick that ends with the hang is the game's last observation (row 23 = the game's 24th), and no later tick runs.

## D2: the key

`presserRecursionHang` (`SEEDLING_PRESSER_RECURSION_HANG=0|1`) is the last key of `CONTACT_FIDELITY_DEFAULTS`, after
`chestCoverFencepost`. Its doc block has the cites, the measured witness, the ON shape, the named not-modelled items
and the env line. `SOLVER_ENV_NAMES` gains the name in sorted place.

- **OFF:**
  - `buildLevelWorld`, `stepActivators`, `publishRopeGroup`, the wand arm and `advance` never read anything new;
  - no field is written;
  - the WeakMap cache is filled only from the ON path.
- **Composes** with every key: it is one more refusal, before or instead of a step. The composition rows run it with
  the base's last 4 OFF keys ON.
- **Key-order pins updated** (grep of `chestCoverFencepost`, every hit):
  - 25 fast-tier files' tail arrays gain `'presserRecursionHang'`. That includes `fidelityFreezeSpanUpdates`'
    `slice(-4)` → `slice(-5)`, `fidelityNestedRockCeremony`'s `slice(-3)` → `slice(-4)`, and the Ceremony126 filter.
  - `contactFidelity.test.js`'s env-skip list and defaults object;
  - `fidelityChestCover`'s `.at(-1)` row ("appended last") now pins its tail as `['presserRecursionHang']`.
  - No pin exists under `scripts/**`.

**Rows** (`fidelityPresserHang.test.js`, fast tier, 61 rows; the OFF arms pin the key OFF, so the file is green with
the env either way: env ON gives 60 passed and 1 skipped, the "OFF in this process" row by design):
- **The key:** OFF, last, env name; and OFF in this process.
- **The census** (`presserRecursionGroups`) on synthetic lists:
  - every family row, the near misses and three-way groups;
  - a true-only loop group, where a flip-1 press (a false) does not hang;
  - the boot publishes;
  - a built staged room against vanilla L38 (none).
- **The staged shapes, one row each** (OFF plays the walk to L37; ON gives the measured class):
  - a build refusal by name, with 0 rows (`build`, `firstFrame`);
  - `PresserRecursionHang` at "tick 23", with the OFF rows' first 24, and no clear earned at or after t23 (`press`);
  - the whole result equal to OFF (`none`).
  - Plus the press tick row.
- **The witness replay, one row per shape:** ON vs `d3/witness-p4g.json`'s drained stream. It is 0 px; the row count is
  equal (24 / 91 / 0); first-frame = game 1, model 0; and `finished` matches.
- **The editor:** two `ENTITY_ROSTER` buttons (`tset '0'`) placed with `applyEdits`. OFF certifies the walk to L37; ON
  refuses "activator group 0" by name. The editor is read, not changed.
- **Model-only publishes** (unwitnessed timing): `r5-shaft` with a flip-0 ButtonRoom added in the rope's group 6
  (off-walk). OFF is identical to vanilla; ON refuses tick 190 (the pull is t189), `rope@96,384 (pulled)`. `r5-l43-wand`
  with two flip-0s in tset 0: ON refuses after `the wand (Wand.removed)`.
- **Vanilla, ON = OFF** (whole result): `prox-l38-chest`, `prox-l38-reach-l39`, `r5-shaft`, `r5-l43-wand`,
  `f7-l16-reentry`; and no vanilla room holds a group.
- **Composition** with the last 4 OFF keys ON: the hang/refusal is identical, the near misses equal the 4 alone, and
  `prox-l38-chest` with all 5 = the 4.
- **The error class** carries `hang`, and the build throws `LevelWorldError`.

**Mutants** (copy → break → run the file → restore; `tools/mutants.py` → `d3/mutants.txt`; each one predicted, then
observed; the sources were restored, and `git status` was clean after):

| Mutant | Predicted | Red rows (of 61) |
|---|---|---|
| M1: `trueLoops` ignores the flip-0 ButtonRooms | every br0 shape, the at-build br0, the model-only pull and wand rows, the census br0 rows | 17: five staged and five witness rows (`br0-btn`, `btn-br0`, `br0-br0`, `br0-rope`, `btn-br0-boot`), press-tick, error class, pull, wand, three census rows |
| M2: no first-frame refusal | btn-btn, btn-rope (staged and witness), the editor, the census first-frame row | 7: those plus the error class |
| M3: the hang step keeps stepping (marks, no `return`) | the press rows whose on-walk presser banks a clear | 4: `br0-btn`, `br0-br0`, `br0-rope`, `br1-rope-rope` (`btn-br0` banks nothing, as predicted) |
| M4: `advance` never refuses | every press row, the model-only rows, press-tick, error class | 14 |
| M5: a flip-1 press publishes true | only `br1-btn-br0`: no other staged group loops a true but not a false | 2: its staged and witness rows. The 17th shape was added (and witnessed) for this mutant. |

## D3: measurement

- **Byte-inertia, OFF.**
  - `git diff --name-only fbdd2ab6 HEAD | grep -aE 'fixtures/|golden|tapes/'` is **empty** (re-checked at `47e476a6`).
  - `batch-seedling-acceptance.mjs 2>/dev/null | md5sum` is `391322d681b7aa0229d94b3f6906d024` at **all four** points
    (`d3/acceptance-md5.txt`): the base (a detached worktree at `fbdd2ab6`), the head OFF, the head ON, and the head ON
    with the base's last 4 OFF keys (`freezeSpanUpdates`, `nestedRockCeremony`, `plainPickupInFreeze`,
    `chestCoverFencepost`) ON.
- **Every committed tape, OFF vs ON** (`tools/tape-onoff.mjs`): **294/294 byte-identical**, and 294/294 with the last 4
  keys ON in both arms (`d3/tapes-onoff.txt`, `d3/tapes-onoff-last4.txt`).
- **Census** (`tools/census.mjs` → `d3/census.txt`; the model's predicate beside wave 61's verbatim, and the ON answer
  per room):
  - **Controls** (the 17 staged shapes): the model's predicate finds 11 groups: the 10 the game hangs on, plus
    `br1-btn-br0`, a true-only loop that the flip-1 press cannot start (ON builds it, and the run plays out). ON refuses
    the 4 build-time ones and builds the rest. **Wave 61's predicate flags 13**: three of them (`br0-br1`, `br1-br0`,
    `br1-btn-br0`) are rooms the game plays out, and it calls `rope-rope` first-frame.
  - **The vanilla atlas** (116 rooms), **the delivered set** (116) and **the committed generated presets** (5 sets,
    12 rooms): **0** groups, **0** ON refusals, and wave 61's predicate 0.
  - **Generator sweep** (named): `generateSeedlingLevel` over every `GENERATE_BIOMES` biome (12) × elements
    {default, `ropegate`, `holdgate`, `weighgate`, `guard`} × seeds 1–10, with the box gate's bounds
    `{obstacleTarget 6, triesPerStep 8, saturationK 3}`. That gave **600 rooms, 317 pressers/ropes placed, 0 recursion
    groups, 0 refusals** (`placementGroupId`, injective, as wave 61 read).
  - **TOTAL (controls excluded): 844 rooms, 0 groups, 0 refusals.**
- **Runtime probe** (`tools/runtime-probe.py` → `d3/runtime-probe.txt`; a marker throw at both ON branches, copy +
  restore): **0 fires**. All 294 tapes have the probe in their ON arm and are identical to OFF. The ON acceptance batch
  with the probe is md5 `391322d681b7aa0229d94b3f6906d024`, unchanged. Positive control: this slice's rows fire it
  (19 red, 7 probe messages). Restored; clean.
- **ON movers: none outside this slice's own file.**
  - I ran **333 fast-tier files** with `SEEDLING_PRESSER_RECURSION_HANG=1`: the gate list below plus every fast-tier test
    that names `button`, `buttonroom`, `rope` or `activators` (case-insensitive). Result: **332/333 green**.
  - The one red was this file's own OFF arms, which inherited the env. They now pin the key OFF (`554e3301`); re-run
    with env ON, 60 passed and 1 skipped (the "OFF in this process" row).
  - **The 10 `.train.`/`.slow.` files** that name those words ran with the key ON, **one at a time**, under their own
    config. **All green**: `deriveLevelWorldLogic.latchSandwich.slow`, `deriveLevelWorldLogic.slow`,
    `learnLattice.train`, `hammerKeylockTurretArrival.train`, `hammerLatchWeigh.train`, `hammerPocketBurn.train`,
    `hammerSouthDoor.train`, `hammerTurretApproach.train`, `strategySwitchGrade.slow`, `strategySwitchTable.slow`.
- **The witness** (D1 item 2). The ON model replayed against each committed stream gives 0 px on every shape, with:
  - **press shapes:** the game's 24 rows exactly, then `PresserRecursionHang`;
  - **near misses** (including `br1-btn-br0`): 91 = 91;
  - **`check()` hangs:** 0 = 0;
  - **first-frame:** the game's 1 arrival row against the model's build refusal (named).
- **The named sweep:** the keyed ON-arm sweep has **0 legs**. No vanilla or delivered room, and so no seed-1 leg or
  survey step, holds a recursion group (census). Shards = min(10, 0) = **0**, ×1 per arm: nothing to dispatch.

## Gates

- **Bounded vitest** (`--maxWorkers=3`; the brief's globs, every `grep -a -l` file for `pressedGroups`,
  `stepActivators`, `activateAll`, `ENTITY_ROSTER`, `LevelWorldError`, the key and `chestCoverFencepost` (every
  key-order pin), and the named gate files; fast tier only):
  - **Before**, at the base (a detached worktree at `fbdd2ab6`), 58 files: 57/58 on the first pass. The red was
    `seedlingWasmPlayback` ("registerBackend: duplicate id 'empty'", then a missing `bulletml-dodge` module). Both came
    from my worktree's symlinked or empty submodules. With real copies of the submodules it is green, so the base is
    **58/58**.
  - **After**, at `2a3ceb63`, 59 files (+ this file): **59/59, 1985 passed**. Since then only this file and
    `fidelityPresserHang.js` changed; the file re-ran 61/61 with env unset, and 60 + 1 skipped with env ON.
- **`ci-producer-checks.mjs --jobs=3`:** 99 run, **0 red**, 1 skipped. The skip is `plan-seedling-r7-ends-meet`, by
  the harness's own rule: it drives the wasm game in a browser, and CI's browser matrix runs it.
- **`check-procgen-docs.mjs`:** ALL CHECKS PASSED. **`generate-procgen-reference.mjs --check`:** all 7 modules and
  5 regions match.
- **Solver surface:** `--check` RED (line moves), then `--write` (374 rows; 125 `line` values only), then **GREEN**.
- **Constants census:** `--check` RED on the four new literals in `presserRecursionGroups`. They are classified in
  `seedling-constants-fields.csv` (one `rule,sentinel`, three `rule,count`, each with its AS3 cite), then `--write`,
  then `--profile-rows`, then `--write`, then `--check` **PASS** (7184 literals; 0 new, 0 vanished, 0 moved).
  `seedlingConstantsCensus` and `seedlingSolverSurface` are green.
- **The six `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check`:** all green.
- **CI** (`JavaScript Unit Tests`, the push run at the last code head `554e3301`, run 45729953126): **success**. The
  unfiltered suite is 30231 passed, 0 skipped, 0 failed; the slow battery is 460 passed.
  - The train tier does not run on a slice push. Dispatch
    `unittests_frontend.yml -f train_only=true` at `554e33014a7ab5e7ed96bf962f0ff2dad9f95b11` (I cannot dispatch: 403).

## What the brief got wrong (measured)

- **"`dead_frames` climbing"** (wave 60's reading, quoted in the gap). On p4g and p4d, `dead_frames` stops at the fade's
  20 (or 1 for a `check()` hang) and never moves. No frame runs after the throw, dead or live.
- **The family table** (wave 61):
  - two ropes do not recurse on the first frame;
  - flip 0 + flip 1 does not recurse;
  - it missed flip 1 + two ropes and the at-build shapes.
  - Wave 61's census predicate has the same false positives, plus `br1-btn-br0` (its controls never staged them).
- **"HUNG at tick 1"** is right for two Buttons, but the hang is not always after an observation: the `check()` shapes
  hang before observation 0.

## Hand-overs

- **Editor (`watchEdit`), for its owner.**
  - `ENTITY_ROSTER`'s `button {tset: '0'}` puts every placed button in group 0. So **one** placed button in a room that
    already has a group-0 Button (L38's `button@80,192`) is a first-frame hang, and so are two placed anywhere.
  - With the key ON the model refuses the room by name. The editor still offers the placement.
  - Candidates for the editor's owner, not done here (out of scope): a per-placement fresh group, or surfacing the
    `presserRecursionGroups` refusal at placement time.
- **Fidelity planner: a published-to ButtonRoom runs its whole setter.** `ButtonRoom.set activate(true)` reached by
  another presser's publish clears its **own** tag (`:96`) and, flip 1, publishes false back. The game cleared 38,10 in
  `btn-br1` and 38,11 in `br0-br1` (the flip-1 one that was published to). The model banks only the pressed one's tag.
  The streams are in `d3/witness-p4g.json`.
  - Related: in `btn-br1` the Button's own `_active` ends false inside its setter (the flip-1 answers false), so the
    group's responders after the ButtonRoom in `getClass` order see true then false within one frame. Unmodelled,
    unwitnessed beyond the clear.
- **`FinalBoss`'s `Button.activateAll(null, 0, true)`** is not a model publish. A recursion shape staged in the boss
  room's group 0 would hang on the death frame; the model would not refuse it. The boss room has no presser.
- **Timing of the two model-only publishes** (a sword pull and the wand sweep) is unwitnessed. The model refuses the
  tick after the pull/sweep tick; the game's throw lands inside `Player.update` / `Wand.removed`.
- **Flash Player vs this runtime.** A Flash Player re-dispatches `ENTER_FRAME` after an uncaught error. This wasm
  runtime does not (measured). The model is of the measured runtime, the game this arc plays.

## Residue

- The first-frame refusal holds 0 rows where the game drains the arrival observation (above).
- The ON branch's order is "the step does nothing". The entities that update before the throwing setter in the hang
  frame did update in the game. No later frame observes them, and a persistence write from one of them in that same
  frame would be missed (none in any room: census 0).
