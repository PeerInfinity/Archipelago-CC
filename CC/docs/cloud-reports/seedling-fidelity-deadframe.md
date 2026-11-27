# seedling-fidelity-deadframe: the responders on the dead frames, and an enemy on a FallRock's Button (planning-25, wave 66)

**Verdict: PASS.** Two new keys, both default OFF: `deadFrameResponderStep` (gap 1) and `enemyPressesFallRockButton`
(gap 3, witnessed: GAP). Gap 2, a wallflyer on a Button, is wave 65's `responderStepAfterReaders` branch. It is witnessed
here, agrees with the game every tick, and adds no key. OFF is byte-identical.

**The one thing to know first: all three gaps are real in the game, and the committed corpus can't see any of them.** The
census finds 0 dead spans on which a responder would change, 0 wallflyer–Button overlaps and 0 enemy–FallRock-Button
overlaps, over 322 tapes and the acceptance batch. Every witness had to be staged. ON moves 0 tapes and 0 acceptance
md5s, so a flip of either key re-records nothing.

| | |
|---|---|
| Start (base) | `29df7d90664a85d5e436e395ec7c756a7a8bbd04` (wave 65's final tip, `claude/seedling-responder-step-order-fazdoz`) |
| Head | the report commit on top of the last code commit, `7cfef447` |
| Harness branch | `claude/seedling-wave-66-deadframes-3j11d7` (local `seedling-fidelity-deadframe`) |
| Page | `seedling_bot_ap_p4g`, `scripts/serve-nocache.py 9798` (stopped by PID at the end) |
| Key count | 153 → 155 keys (126 ON unchanged); the last two are `deadFrameResponderStep` then `enemyPressesFallRockButton`; `SOLVER_ENV_NAMES` 250 → 252 (sorted, unique) |

The evidence is in `CC/docs/cloud-reports/seedling-fidelity-deadframe-evidence/`:
- `tools/`:
  - `census-scratch.py`, `census.mjs` and `census-preload.mjs`: the D1 census (copy + restore);
  - `stage-deadframe.mjs`, `witness-deadframe.mjs` (wave 65's witness, re-pointed) and `replay-deadframe.mjs`: the D1 shapes, the game, and the model against it;
  - `tape-deadframe.mjs`: every tape OFF vs ON (wave 65's `tape-order.mjs`, re-keyed);
  - `probe-scratch.py`, `probe-deadframe.mjs` and `probe-preload.mjs`: the ON branch's runtime counters (copy + restore).
- `d1/`: `census-{off,last5,frozen}.{json,txt}`.
- `d2/`: `witness-all.json`, `witness-edges.json` (the game), and `replay-*.txt` (the model OFF / with `responderStepAfterReaders`).
- `d3/`: `tape-*.{json,txt}`, `acceptance-md5.txt`, `probe*.{json,txt}` and `mutants.{json,txt}`.

## D1: the census, the witnesses, the map

### 1. The census (`d1/`; `census-scratch.py` hooks `clock.spend` and every live tick's end)

At every span of dead frames the model charges, the census steps a CLONE of the level's activator state once per frame,
with the box and the blocks as they stand. That is wave 65's probe method: copy, step, diff. It counts the frames on which a
responder's `open`/`alpha` would move. At every live tick's end it counts the spinner and wallflyer boxes on a Button or
ButtonRoom, and on one whose group holds an unlanded FallRock.

| Dead-frame kind (322 tapes, shipped defaults) | Spans | Frames | In a room with responders | Spans a responder would change |
|---|---|---|---|---|
| pickup lump (phase A) | 75 | 11,250 | 28 | **0** |
| span: a rope's rock (`dropRock`) | 3 | 591 | 3 (L28; already stepped, `fallRockHoldsButton`) | **0** |
| span: a button's / the wand's rocks (`dropRocksTogether`) | 3 | 558 | 0 | **0** |
| seal piece | 13 | 4,303 | 8 | 0 |
| door ceremony, moonrock, BobBoss rock, seed cover fade, wand approach fade, Help | 29 | 4,250 | 0 | 0 |

- **Overlaps (live ticks):** spinner on a Button 305, spinner on a ButtonRoom 101 (wave 65's L39/L40 presses).
  **Wallflyer on a Button: 0. Enemy on a FallRock's Button: 0.**
- **The acceptance batch, in-process:** 300 pickup lumps (45,000 frames), 14 in a room with responders, **0 that a
  responder would change**, and 0 overlaps. Its md5 with the scratch hooks live was the standing
  `391322d681b7aa0229d94b3f6906d024`.
- With `responderStepAfterReaders` and the base's last 5 OFF keys ON (`census-last5`), and with `frozenTickUngated` ON
  (`census-frozen`), the counts are the same.

**Every count is 0, so each gap needs a staged witness to be seen at all.**

### 2–4. The witnesses (p4g; staged L38 through `botLoadLevels`, its own `set_id`, a fresh page per shape)

These follow wave 64's `stage.mjs` method. L38 is stripped to its teleporters and `lightalpha`. L is `lock@112,48` tag
20, and its type is `persistence_cleared` ∋ (38,20). A FallRock's `fall()` writes (38,22), so the page shows the frame it
falls. `dead_frames` is read on every sample. The model's L is compared from row t−1 OFF and from row t with
`responderStepAfterReaders` ON (wave 65's alignment).

| Shape | Game | Model OFF | ON | Verdict |
|---|---|---|---|---|
| `d-key`: latched from the boot (L opens on frame 102); the player walks onto a text-less `bosskey keyType 1` | dead frames +150 at t25; **L open at t25** | L opens at 102 | 0 px, L every tick, both `responderStepAfterReaders` arms | **GAP 1** |
| `d-health`: the same with a texted `health` | +**149** at t27; **L open at t27** | 102 | 0 px, L every tick, both arms | **GAP 1** |
| `d-span`: the same latch; the player walks onto `button@64,48` of `fallrock@192,48` | rock falls t24, +167 at t25; **L open at t25** | 102 | 0 px, L and the rock every tick, both arms | **GAP 1** |
| `d-{key,health,span}-at100…103`: the edges (contact / frame A at advance #100…#103) | at100: L at 101; at101–103: 102 | 102 every time | 0 px, L every tick, both arms (12 shapes) | at100 GAP; the rest agree OFF |
| `w-fly-rest`: a WallFlyer launched down col 9 comes to rest on `button@144,208` (group 6) from t20; L is group 6 | **L open at t116** | never | `responderStepAfterReaders` ON: 0 px, L every tick (opens 116) | **NO GAP** against wave 65's branch (OFF has no enemy press, by its contract) |
| `e-fly-rock`: the same flyer on `button@144,208` of group 7, whose `fallrock@64,272` | **rock falls at t15** (the tick the flyer reaches the button), +182 at t16 | never | 0 px, the rock every tick, both arms | **GAP 3** |
| `e-spin-rock`: a Spinner crossing `button@144,176` (group 7) of the same rock | **rock falls at t72**, +182 at t73 | never | 0 px, both arms | **GAP 3** |

What the witnesses answer:
1. **The dead frames run the responders.** A freeze gates only `Mobile` and the enemies. `Game.update` runs
   `super.update()` whenever `blackCover <= 0` (`Game.as:880-883`). So a Lock fading from a latch keeps fading through a
   pickup's phase A and through a button rock's span. The game opens L at the first live tick after the dead frames, 77
   ticks before the model.
2. **They lie right after the contact frame / frame A.** The dead counter jumps between that tick's observation and the
   next. The edges show the contact frame's own responder update runs before the freeze: at101's contact frame is L's
   101st update, and the first dead frame (frame 102) opens it, so the game gets 102 = OFF. at100's dead frames hold L's
   frame 102, so the game gets 101.
3. **The counts are the game's own:** a text-less lump is 150 dead frames, a texted one **149** (the lump
   `ceremonyShove` measured; the model's clock charges 150 for both, which is not this slice's to touch), a button
   rock's span 167, and an enemy-dropped one 182. The model's spans match each.
4. **A wallflyer on a Button presses it,** as wave 65 read from `Button.hitables`. Its ON branch agrees on every tick:
   the open at 116 is the flyer's arrival (t20) + 101 + the press lag.
5. **An enemy on a FallRock's Button drops it in the enemy's own frame.** The Spinner and the WallFlyer update before the
   Button (`Game.as:2415-2416` vs `:2341`). So the Button sees the enemy where this frame moved it, `fall()` raises the
   freeze in that same frame, and that frame is frame A. A player's press is read a frame later.

### 5. The map

**Every dead-frame path, at the head** (line numbers are `levelRun.js`):

| Path | Caller | The game's responder update | OFF (shipped) | `deadFrameResponderStep` ON, `responderStepAfterReaders` OFF | …and `responderStepAfterReaders` ON |
|---|---|---|---|---|---|
| a text-less pickup's phase A (150) | the placed-pickup branch `:24150` (`stepPushablesDeadFrameNow` × 150 under `frozenTickUngated`) | every dead frame, right after the contact frame | none | queued at the contact (`:24153`); run before the contact tick's own end step (`:25372`) | run at the next advance's top (`:23108`), before its readers; that frame's own deferred step runs after the readers as before |
| a texted pickup's phase A (149) | the same branch; the lump `stepCeremonyLumpNow` at the next top (`:23105`, `ceremonyShove`) | the same | none | queued at the contact; run before `runFrozenTick`'s step (`:16942`) | at the next top, right after the lump (`:23108`) |
| the runtime Dark Sword / Fire (texted, 149) | `:24061`, `:24087` | the same | none | as a texted pickup | as a texted pickup |
| a button's / the wand's rocks (`dropRocksTogether`) | `stepPushablesDeadFrameNow` `:4132`; frame A is `runFrozenTick` (`:23378` runs the pending step first) | every span frame, the release included | none | queued per frame (a rock is Solid from the frame after it lands: `Lock` updates before `FallRock`), run at once (`:4196`): past the frame-A tick's own step | at the next top; the frame-A tick's deferred step (the span's first frame) runs after the readers, so the count is the same |
| a nested span (`nestedRockCeremony`) | `:4132` with `nested` | the ceremony's frames | none | the ceremony's queue carries them; no own queue | the same |
| a rope's rock (`dropRock`) | `stepPushablesDeadFrameNow` `:4042`, `spanActivatorFrameNow` `:4002` | every span frame | **already stepped** (`fallRockHoldsButton`, ROCKBUTTON) | unchanged | unchanged: wave 65's pending-per-frame (`:4012`, `:4061`) |
| `stepCeremonyDeadFrameNow` (the texted lump's frames) | `:14880` | — | the blocks only | the responders come from the pickup's queue | the same |
| the wand's approach fade, a seal piece, a door ceremony, the moonrock, BobBoss's and LavaBoss's rocks, a seed's cover fade, a Help | `:23986` and the `spendFrozen` / `clock.spend` sites | every dead frame | none | **not modelled** (residue: unwitnessed; the census: 0 changes) | the same |
| an inventory hold | `inventoryHoldFrameNow` `:15152` | — | already stepped | unchanged | unchanged |

**With `responderStepAfterReaders` ON, does a pending step run on the dead frame, or wait?** It waits. The pending step is
the NEXT live frame's update, and it runs after that frame's readers as wave 65 shipped it. The dead frames are queued
separately and run first, at the top of that advance, before its readers. For a span this is a reorder of the span's
first frame (the frame-A tick's deferred step), and the ledger stamps agree between the arms. A queue past the tape's
last frame never runs, like wave 65's horizon. On 5 committed tapes the last advance is a totem part's contact: 0
responder changes, so nothing is observable.

**`armButtonFallRocks`'s press path:** `fallRocksArmedBy(world, box, solids)`. The box is the player's, and the solids
are `movingSolidsNow()`: the pushables, a crusher, the ice turrets. It is called:
- at the arrival frame (`:23349`, `arrivalButtonArm`);
- at every live tick's end (`:25379`, the post-move box, resolved next tick as frame A);
- at `runFrozenTick`'s end (`:16951`, a refusal);
- at an inventory hold frame (`:15167`);
- and in `spanActivatorFrameNow`'s refusal.

**No enemy box was ever counted.** ON, `armButtonFallRocksByEnemiesNow` (`:16258`) runs at the top of every live tick
(`:23357`), after the readers stepped and before the frame-A branch, and passes the live spinner and wallflyer boxes as
the solids. A hit makes this tick frame A.

## D2: the keys

### `deadFrameResponderStep` (`contactFidelity.js`, second-to-last)

- **Its doc block** carries the game reading (`Game.as:880-883`, `Button.as:24-35`, `Game.as:2353-2356`), the witnesses
  with their dead counts and the edges, the two arms, the sites, and the residue.
- **Its env lines:** `SEEDLING_DEAD_FRAME_RESPONDER_STEP=0|1`.

ON (`levelRun.queueDeadResponderFramesNow` / `flushDeadResponderFramesNow`):
- **The site queues `n` frames.** Each carries the frozen box, the enemies (with `responderStepAfterReaders` ON) and its
  own solids.
- **`responderStepAfterReaders` OFF:** the queue runs before the tick's own step, which `stepActivators`' labelling makes
  the next live frame's update. It is stamped with that step.
- **`responderStepAfterReaders` ON:** it runs at the next advance's top, before the readers.
- **A torn-down world drops the queue,** as it drops a deferred step.
- **Two spans in one tick are refused by name.**
- **The ledger `run.deadResponderFrames`** (`{t, level, why, frames, changed}`) is written ON only.

**Both arms are witnessed and both agree with the game.** The contract does NOT require `responderStepAfterReaders`:
each arm carries its own row.

### `enemyPressesFallRockButton` (`contactFidelity.js`, last)

- **Its doc block** carries `Button.hitables` (`Button.as:15`), the setter (`FallRock.as:103-118`), the update order
  (`Game.as:2415-2416` vs `:2341`), and the witnesses.
- **Its env lines:** `SEEDLING_ENEMY_PRESSES_FALL_ROCK_BUTTON=0|1`.
- **ON:** the enemy arm above, with the ledger `run.enemyRockPresses`.
- **It needs no other key,** and it agrees with the game in both `responderStepAfterReaders` arms.

**OFF (both): byte-identical.**
- `git diff --name-only 29df7d90 HEAD | grep -aE 'fixtures/|golden|tapes/'` is empty.
- The acceptance md5 at head OFF is `391322d681b7aa0229d94b3f6906d024`.
- No ledger is written.

### Rows

**`fidelityDeadFrame.test.js`** (fast tier, 30 tests; the shapes ported into `fidelityDeadFrame.js`, the game streams read from `d2/`):
- **The key contract:** both OFF, the last two in order, both env names, OFF in this process.
- **Every witness (18 shapes):**
  - OFF is the shipped result: the game's and the model's L open and rock fall, positions at 0 px;
  - ON with `responderStepAfterReaders` OFF: 0 px, with L and the rock agreeing every tick. `w-fly-rest` keeps OFF's L by
    its contract;
  - ON with `responderStepAfterReaders` ON: every shape at 0 px.
- **Each key answers its own gap:** with one key alone, the set of shapes that agree is exactly that gap's shapes plus
  the edges OFF already gets right. That holds in both arms.
- **The wallflyer's press** under `responderStepAfterReaders` ON: 0 px, L opens at 116. OFF: L first differs at 116.
- **The dead frames, counted:**
  - the game's `dead_frames` jumps (150 / 149 / 167 / 182 / 182) equal the model's `rockFalls` and its queued counts, in
    both arms;
  - OFF writes no ledger;
  - the enemy arm's tick is pinned.
- **Composition:**
  - with the base's last 5 OFF keys ON, every shape is at 0 px;
  - wave 65's 28 shapes under `responderStepAfterReaders` ON replay byte-identically with both keys ON (rows equal).
- **The 39 committed tapes the census names** (dead spans in a room with responders, or an enemy on a presser) are
  byte-identical with both keys ON.

**`fidelityDeadFrame.slow.test.js`** (slow tier): every committed tape is byte-identical with both keys ON, alone and
with the last 5 beside them.

**Key-order pins:** 28 files (the `indexOf(…)+1` and `includes` lists, `slice(-7)`→`(-9)`, `slice(-6)`→`(-8)`), plus wave
65's `.at(-1)` → `indexOf` in `fidelityResponderOrder.test.js`, and `contactFidelity.test.js`'s defaults table and its env
skip list.

### Mutants (`d3/mutants.txt`; applied in a worktree at the head and restored)

| Mutant | Predicted | Shown |
|---|---|---|
| M1 the queue is never flushed | the 6 gap-1 rows that OFF gets wrong (d-key, d-health, d-span, the at100 edges), the dead-key row, the counted row, composition | exactly those 9, **plus** the census-tapes row: an unflushed queue meets the next pickup's "two dead spans in one tick" refusal |
| M2 `responderStepAfterReaders` ON flushes at the site (inside the contact / frame-A advance) | the ON arms of d-key, d-health, d-span and the at100 edges (L a tick early), the counted row, composition | those **plus the three at101 edges** (12): their first dead frame is L's opening frame, so a flush inside advance #101 shows it on row 101 |
| M3 the enemy arm is read at the tick's end, as the player's is | e-fly-rock, e-spin-rock (the rock a tick late), the enemy-key row, the counted rows, composition | exactly those 6 |
| M4 a texted lump counted 150, not 149 | only the counted row (no replay can see the far edge) | exactly that 1 |
| M5 a span's landed rock is never a Solid to the dead steps | nothing: no witness has a responder in the rock's cell | 0. **A survivor, named:** the per-frame rock solid is a reading of the add order (`Lock` before `FallRock`), not a witness |

## D3: the ON measurement

- **Byte-inertia OFF:** the fixtures diff is empty, and the acceptance md5 at head OFF is the standing value.
- **The acceptance md5 (`d3/acceptance-md5.txt`):**

  | Run | md5 |
  |---|---|
  | base | `391322d681b7aa0229d94b3f6906d024` (measured with the census hooks live; they are no-ops without `__DF`) |
  | head OFF | `391322d681b7aa0229d94b3f6906d024` |
  | head `deadFrameResponderStep` ON | `391322d681b7aa0229d94b3f6906d024` |
  | head `enemyPressesFallRockButton` ON | `391322d681b7aa0229d94b3f6906d024` |
  | head both ON | `391322d681b7aa0229d94b3f6906d024` |
  | head both + the last 5 ON | `d871cee754a7490a7003a7395028e531` = wave 65's ON value |

  **No seed and no field moves under either key.**
- **Every committed tape OFF vs ON (`tape-deadframe.mjs`, `d3/tape-*.txt`):** 322 tapes, **0 movers** in every arm:
  each key alone, both, both with `responderStepAfterReaders` ON, and both with the last 5 ON. The refuted `r8-solve-5`
  throws the same way in both arms.
- **The runtime probe at the ON branch (`d3/probe*.txt`):**

  | Run | Queues | Dead-frame responder steps | Steps that changed a responder | Enemy FallRock presses |
  |---|---|---|---|---|
  | 322 tapes, both keys ON | 37 | 5,525 | **0** | **0** |
  | 322 tapes, with `responderStepAfterReaders` ON | 37 (32 run; 5 past the tape's end, the horizon) | 4,775 | **0** | **0** |
  | the acceptance batch, in-process | 14 | 2,086 | **0** | **0** |

  The batch's subprocesses are not counted.
- **The hit gate:** no tape moves, so no tape takes a hit ON that it doesn't OFF. The batch md5 is unmoved. The 18
  witnesses take 0 hits in the game, and the model is at 0 px on them.
- **ON movers by file:row:** see § The ON test sweep.
- **The keyed ON-arm sweep, named for the planner:** `SEEDLING_DEAD_FRAME_RESPONDER_STEP=1
  SEEDLING_ENEMY_PRESSES_FALL_ROCK_BUTTON=1` over the route survey, with shards = min(10, legs).
  - **The legs are not counted:** the regenerable survey cache (`.cache/seedling-survey/`) is not in this container, as
    in waves 64 and 65.
  - **The probe's best list:** no committed route reaches a responder in a dead span or an enemy on a FallRock's Button.
    The legs to watch are those that collect a pickup in a room with a live fade (L38, L39, L40) and anything through
    L29 or L74's FallRock Buttons.

### The ON test sweep

Both keys ON (`SEEDLING_DEAD_FRAME_RESPONDER_STEP=1 SEEDLING_ENEMY_PRESSES_FALL_ROCK_BUTTON=1`) over every seedlingDemo
and `scripts/procgen` test file that names the families: **563 files** (`d3/sweep.txt`).
- **527 fast-tier files**, in 18 batches of 30 (`--maxWorkers=2`): 12,016 passed, 4 failed.
- **36 `.slow.`/`.train.` files**, one at a time under their own configs: **127 passed, 0 failed**. These include
  `fidelityCorpseBump2.train`, `hammerChooserPair.train`, `hammerEscapeExact.train`, `hammerSpinnerPress.train` and
  `fidelityL40Latch.train`, the files wave 65's key moved.

**0 rows move because of the model.** The 4 failures, by file:row and class:
- **OFF-contract (the env channel), 3 rows:**
  - `dashOnlyWindow.test.js` "the default adds no field (today's request key list exactly)";
  - `dashOnlyWindow.test.js` "`stampHooks` is the service's one stamping door…";
  - `dashShape.test.js` "the defaults add no field…".
  - Any set `SEEDLING_*` switch is carried into the solve request. With wave 65's `SEEDLING_RESPONDER_STEP_AFTER_READERS=1`
    as the control, the same 3 rows fail; with no env they pass.
- **Not this slice, 1 row:** `standingValues.test.js` "a gate that sleeps past the deadline is KILLED…". It fails
  identically with no env: this container's process-group kill.
- **Game-witnessed and solver re-plan: 0 rows.**

Wave 65's rows (`fidelityResponderOrder.test.js`) pass with both keys ON.

**Not run:** each key alone over the whole sweep. Both together move nothing. With each key alone, every tape, the
batch, the probe and the 18 witnesses are measured (above).

## Gates

All at the head with both keys OFF.
- **Bounded vitest:**
  - before, at the base (a clean worktree at `29df7d90`): 61 files, **1773 passed**;
  - after, at the head: 62 files, **1805 passed**, 0 failed (the base's 61 files plus `fidelityDeadFrame.test.js`, 30 tests).
  - The set is the brief's families, every `grep -a -l` file for `stepPushablesDeadFrameNow`, `armButtonFallRocks`,
    `stepActivators`, `responderStepAfterReaders` and the new key names, every key-order pin file, `r8Acceptance`,
    `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`,
    `seedlingSolverSurface` and `oneSpelling`.
- **CI at the last code head:** `7cfef447` (`ci-vitest-summary.mjs`, run 45875077285): suite: vitest (unfiltered), 1446 files, **30370 passed, 0 failed**; slow battery 40 files, **462 passed**. The commits after it are evidence and this report only.
- **The train tier is NOT run in CI at this head.** For the planner: `gh workflow run unittests_frontend.yml -R
  PeerInfinity/Archipelago-CC --ref claude/seedling-wave-66-deadframes-3j11d7 -f train_only=true`. I can't dispatch.
- **The six solve `--check`s exit 0:** r8-battery, r8-d2-chain, r8-l18, r8-tail, r9-l3 and r9-campaign.
- **Checks that pass:**
  - `check-procgen-docs`;
  - `generate-procgen-reference --check`;
  - the constants census `--check`. It was re-derived with `--write`; `--profile-rows` left the fields table unchanged.
    15 new structural literals, the rest line moves;
  - `census-seedling-solver-surface --check`. It was re-derived with `--write`: 374 rows, line numbers, and the run's
    surface `properties` 255 → 257 / `getter` 221 → 223. Those are the two new read-only ledgers, `deadResponderFrames` and
    `enemyRockPresses`.
- **`ci-producer-checks --jobs=2`:** 99 run, 1 skipped, 0 known-red. The one red, `regenerate-procgen-topdown-presets`
  ("registerBackend: duplicate id 'empty'"), came from running in a worktree whose `shared` submodule is a symlink. It
  is 12/12 green in the primary tree at the same head.
- Not run, by the brief: `pytest`, the unfiltered local vitest (⚖ 52) and `standing-values --write`.

## What the brief got wrong (measured)

- **"A count of 0 says the gap needs a staged witness":** true of all three gaps, and stronger than the brief allowed
  for. Under each key, ON moves no committed tape, no acceptance seed and (§ The ON test sweep) no test row (563 files). The keys
  are pure model coverage today.
- **"Stage a responder whose state changes during a pickup lump, then one during a span frame":** the span that lacks
  a step is the button's / the wand's (`dropRocksTogether`). The rope's span (`dropRock`) has been stepped since
  ROCKBUTTON (`fallRockHoldsButton`, ON by default).
- **"A Pulser mid-cycle":** the Pulser's dead-frame update (its pulse and hits) is not in this key. It is residue.
- **The pickup lump's length:** a texted pickup is 149 dead frames in the game's own counter, not the model clock's 150.
  The key steps 149. The clock is unchanged (not this slice).
- **"Does an enemy on a FallRock's Button drop the rock, and on which frame?":** yes, and on the enemy's OWN frame,
  one tick earlier than a player's press would be read. The key models that order; M3 shows it.
- **"With `responderStepAfterReaders` ON, is the pending step run on the dead frame, or does it wait?":** it waits.
  The dead frames are their own queue, run before the next live frame's readers.

## Hand-overs

### Planner (fidelity)

- PASS. Both keys are ready for a flip decision. A flip re-records nothing measured here: 0 tape movers, 0 md5 moves.
  A flip moves only the key-contract rows (`fidelityDeadFrame` "are OFF in this process" and the defaults table).
- CI: dispatch `unittests_frontend.yml -f train_only=true` at the head (I can't dispatch).
- The census tools (`census-scratch.py`) count any dead span a responder would change. Rerun them on a new corpus before
  trusting "0".

### HAMMER (`seedling-hammer-phase-planning-16`)

- None from this measurement: ON changes no solve, no tape and no batch seed. With `deadFrameResponderStep` ON a solver
  view taken after a pickup's contact, between ticks with `responderStepAfterReaders` ON, sees the responders before the
  dead frames ran (the queue runs at the next top). That is wave 65's between-tick hand-over, extended by the dead
  frames; it is read-only to me.

### JS arc

None.

### Residue

- **The other dead frames:** a seal piece's, a door ceremony's, the moonrock's, BobBoss's and LavaBoss's rocks, the wand's
  approach fade, a seed's cover fade, and a Help's frame. The game runs the responders on all of them (all are
  `freezeObjects` frames). They are unwitnessed, and the census finds 0 changes on committed tapes.
- **The Pulser's dead-frame update:** its pulse timer and its hits.
- **A block's glide through dead frames** (`frozenTickUngated`) is not interleaved per frame with the dead responder
  steps: the steps read the blocks where they stand.
- **A span's rock as a Solid to the dead steps** (from the frame after its landing): read from the add order,
  unwitnessed (M5 survives).
- **A block on a FallRock's Button:** it updates before the Button too, so its press may be same-frame like an enemy's.
  The model reads it at the tick's end. Unwitnessed.
- **The other enemies:** no model position (the standing boundary).
- **The model clock's 150 for a texted lump:** the game counts 149. Not this slice's; nothing here reads the clock's span.
- **A rope span with `fallRockHoldsButton` OFF:** no responder step, and this key does not add one (it is ON by default).
- **The survey legs:** not counted (no cache).
