# seedling-fidelity-responderorder: the responders step in the game's frame order (planning-25, wave 65)

**Verdict: PASS.** One new key, `responderStepAfterReaders`, default OFF. OFF is byte-identical.

**ON = the game.** These all replay at 0 px with the responder's type agreeing every tick:
- all 13 of wave 64's shapes, with no 1-tick stand-in artefact;
- all 15 of this wave's D1 shapes;
- wave 63's 17 witness rows (with `publishedButtonRoomSetter` ON beside it), including `btn-lock` and `btn-cover`, which lag OFF;
- L40RES, the Chest's tick 13, and the L28 span witness.

**The one thing to know first: a spinner presses a Button, and that moves two committed VANILLA L40 tapes by hundreds of
ticks.** This is game-witnessed on the tapes themselves, with hold-cuts:
- In `r5-l40-part5`, `spinner@880,848` presses `buttonroom@880,768`. (40,12) is cleared at cut 115. OFF says the player
  presses it at 742.
- In `l40button-l42-part0`, a spinner presses `buttonroom@160,128`. (40,1) is cleared at cut 1337, where OFF says 1370.
  Its wandlocks (40,2) and (40,3) open at cut 1438, where OFF says 1470.

So 20 committed tapes move under ON, not 18. Every one is ledger-only: no tick, transition or hit moves.
- 14 are wave 64's press-lag eighteen with a field shifted by one tick.
- 4 are those eighteen's pulser tapes (`pulserHits`/`pulsePushes` +1).
- 2 are the "horizon" tapes. Their final deferred step lies past the tape's last frame, and the game's hold-cut agrees.
- Of the 14, 3 (`r5-l40-part5`, its control, `l40button-l42-part0`) move far, through the spinner press.

| | |
|---|---|
| Start (base) | `aeb2437d5a7baccb14563a795cd9e2e1b5d524b6` (wave 63's tip, `claude/buttonroom-tag-clear-model-4074or`) |
| Head | the report commit on top of the last code commit, `3dc81668` |
| Harness branch | `claude/seedling-responder-step-order-fazdoz` (local `seedling-fidelity-responderorder`) |
| Commits | `30901b2f` (wave 64's evidence), `086b7041` (the key), `8742d14b` (D1 + the frame kinds + rows), `5520883a` (guard by name; surface re-derived), `663b45a9` (a torn-down world's step dropped), `668b0e08` (two pins, the census literal), `3dc81668` (the corpsebump2 hold-cut witness and row, the probe counters), then this report |
| Page | `seedling_bot_ap_p4g`, `scripts/serve-nocache.py 9798` (stopped by PID at the end) |
| Key count | 152 → 153 keys (126 ON unchanged); last key `responderStepAfterReaders`; `SOLVER_ENV_NAMES` 249 → 250 (sorted, unique) |

Evidence lives in `CC/docs/cloud-reports/seedling-fidelity-responderorder-evidence/`:
- `tools/`:
  - `replay-order.mjs`: wave 64's `replay-arms.mjs` re-keyed. `STAGE=order` gives this wave's shapes.
  - `stage-order.mjs` and `witness-order.mjs`: the D1 shapes, the vanilla-tape hold-cuts (`--tapes=`, `--tapecuts=`), and the horizon.
  - `tape-order.mjs`: every tape OFF vs ON, field by field.
  - `probe-scratch.py` and `probe-order.mjs`: the ON branch's runtime counters (copy + restore).
- `d2/`: the game witnesses (`witness-order`, `-horizon`, `-l40spinner`, `-l40button`, `-leave`), and the replays OFF/ON (`replay-order-*.txt`, `replay-w64-*.txt`).
- `d3/`: `tape-order{,-last4}.{json,txt}` and `probe-order.{json,txt}`.

Wave 64's report and evidence are committed as the row set (`seedling-fidelity-readerorder*`, from `a66e27dcd9`).

## D1: the owed witnesses (p4g; staged L38 through `botLoadLevels`, a fresh page per shape)

L's type is the page's `persistence_cleared` ∋ (38,20). The comparison is the same as wave 64's: positions at game tick t
against model row t. R's type is read from row t−1 OFF and from row t ON. The step that OFF runs at the end of advance
t−1 runs inside advance t ON, so ON reads R off the same row as the positions.

| Shape (staged) | Game | OFF | ON |
|---|---|---|---|
| `w-latch` — a ButtonRoom latch pressed MID-tape | L opens at **on + 102** (tick 125) | L first differs t124 (open a frame early: on + 101) | 0 px, L every tick |
| `w-latch-boot` — the boot press | L opens at 102 | agrees | agrees |
| `w-block` — a block pushed onto a Button, held, pushed off | L re-shuts a frame after OFF | L first differs t228 | 0 px, L every tick |
| `w-cover-{100…128}` — (B) with a Cover (spinner vs a resetting Cover) | the spinner reads the Cover's reset a frame late | `-124` 0.71 px at t132, `-128` at t135; the rest 0 | 0 px all |
| `w-spin-button` — a spinner crossing `button@144,176`, its Cover `cover@144,224` (group 6), the player pinned below | the Cover **opens**: the player walks in at t83 (and takes a hit) | 96 px from t83 | 0 px |
| `w-leave-{108,110,112}` — the player walks off L's Button into L38's south teleporter | L **never re-closes**: (38,20) stays cleared in L37 | writes the close (`lock@64,224` true) | no close |

**The answers:**
1. **The latch half of the press lag: on + 102**, as the Button's. A ButtonRoom is a presser that updates after every
   responder (`Game.as:2342`), so the latch it sets is read the next frame.
2. **A block on a Button.** The press is right in the model, as wave 64 said. The RELEASE is not: L re-shuts a frame
   later in the game (`w-block`). The release is the player's step off behind the block, and that carries the press lag.
3. **A Cover under (B).** The read alone is enough: `Cover.hitables` has no Enemy. The observable is the spinner's own
   reflection (no Chest is needed). ON closes `w-cover-124`/`-128`.
4. **A spinner on a Button: GAP, modelled under this key.** `Button.hitables` and `ButtonRoom.hitables` hold "Enemy"
   (`Button.as:15`, `ButtonRoom.as:17`), and both update after the readers. So the presser half counts the spinner and
   wallflyer boxes. `w-spin-button` is 0 px ON. A wallflyer on a Button is from source, the same `hitables`, and
   unwitnessed.
5. **The horizon (found here).** The hold-cut after exactly N frames holds no write from the model's step at the end of
   advance N. The un-held read after the bot finishes does, because the world runs on. Witnessed on
   `l71-hold-101-shut`: no (71,3) at cut 101. And on `l30keylock-pit224-before`: no (30,0) at cut 212.
6. **The level change (found here).** The level being left runs no responder update on the transition tick
   (`w-leave-*`). OFF's end-of-transition-tick step is a frame the game never runs.

### The model's map (D1.4)

| Frame kind | Caller (head line) | The game's responder update | OFF | ON |
|---|---|---|---|---|
| main tick | `levelRun.js:25287` (end) | after the readers (`stepSpinners` `:23129`, `stepWallFlyersNow` `:23237`, `stepPushables` `:23241`) and the Chest (`:23377`), before the Pulser (`:23381`) and the player | the end of the tick, labelled the next frame's | deferred; run at `:23380` of the next tick |
| button-rock frame A | `:23305`, then `runFrozenTick` | after that tick's readers | `runFrozenTick`'s end | the pending step runs before `runFrozenTick`; its own is deferred |
| frozen tick (ceremonies) | `runFrozenTick` `:16876` | the readers step above the early return; the responders after them | its end | deferred |
| span frame (rope rock, `fallRockHoldsButton`) | `spanActivatorFrameNow` `:4012` | after that frame's blocks (`stepPushablesDeadFrameNow`) and the rock's update | at once, after the rock | the frame before's pending step runs on this frame's readers; this one is deferred; the release frame runs the last (`:4061`) |
| inventory hold frame | `inventoryHoldFrameNow` `:15151` | no reader steps in a hold | at once | the pending step runs, then this one is deferred (the same count; the last rolls into the next tick) |
| dead frames (pickup lumps, the span) | `stepPushablesDeadFrameNow` `:14807` | the responders update too | **no responder step** | the same: no step (a pre-existing gap of the model, named) |
| boot | none (no row-0 step) | the arrival frame's Button publishes from the boot cell | the first step presses at once | the first step in a world seeds its publish first (`state.published === undefined`): the boot press, as OFF |
| level change | the transition tick | the old level runs no later frame | one old-level step at the tick's end | not run (witnessed) |
| a torn-down world | `enterWorld` into the same level (a death reboot) | none | — | the pending step is dropped (derived; 25 steps over 23 tapes; 0 movers) |

The readers of `openActivatorIds*`:
- `pushableCtx` (`:6576`) reads `openActivatorIds`. ON makes that the frame before's set (the readers step before the
  deferred step).
- `spinnerCtx` (`:6670`) reads `openActivatorIdsBeforeLatestStep` under `spinnerLockLag`. ON reads plain
  `openActivatorIds` (no double lag).
- The vanilla Chest (`:8447`) reads `openActivatorIdsBeforeStep` under `chestCoverFencepost`. ON reads plain
  `openActivatorIds`, because the Chest steps before the deferred step.
- The APChest (`c.apChest`, absent on this base) keeps `openActivatorIds`, which ON makes the pre-step set. That is a
  hand-over (below).
- The solver's views (`run.entities('openActivators')`, `solverBot.js`, about 20 sites) are read-only to me. A hand-over (below).

## D2: the key

`responderStepAfterReaders` (`contactFidelity.js`, last).
- **Its doc block** carries the frame table, the cites (`World.as:937-951`, `Game.as:2341-2419`, `Lock.as:23`,
  `Cover.as:21`, `Button.as:15`, `ButtonRoom.as:17`), and wave 64's and this wave's witnesses.
- **Its env lines:** `SEEDLING_RESPONDER_STEP_AFTER_READERS=0|1`.

ON:
- **`levelRun`.** The main tick's and a frozen tick's step is deferred (`deferResponderStep`).
  `runDeferredResponderStepNow` runs it after the readers and the Chest, before the Pulser and the player. It runs with
  the player's box where the last tick left it, the readers where this tick left them (`movingSolidsNow()`), and the
  spinner and wallflyer boxes (`responderEnemiesNow`).
  - A touch lock's snap lands at once.
  - A `presserRecursionHang` hang throws in that tick.
  - The span, hold, frame-A, transition and torn-down cases are as in the map above.
- **`activators.stepActivators`.** The responders run FIRST, on `state.published`: the previous step's Button /
  ButtonRoom press, and the latch as it stands. The presser half (`presserHalf`: the cross-room writes, the latch,
  wave 63's setters) then runs on this step's box, followed by the new publish, which counts enemies. A world's first
  step seeds the publish first.
- **The guard.** The Lock family's guard (`RESPONDERS[tag].guard === 'occupancy'`) counts the enemy boxes. A Cover's does not.
- **`stepPulsersNow`** reads `state.responderRead`, the responders' own read. `pulserPublishLag`'s `pressedLast` is not
  carried. The forecast stepper is seeded from `state.published`.
- **`presserRecursionHang`'s early return stays first** in `stepActivators`.

**OFF:** byte-identical.
- Acceptance md5: `391322d681b7aa0229d94b3f6906d024` at the base and at the head.
- Every tape's OFF result is unchanged; the OFF arm of `tape-order` is the shipped run.
- `git diff --name-only aeb2437d HEAD | grep -aE 'fixtures/|golden|tapes/'` is empty.

### The double applications (rows)

- `spinnerLockLag` OFF/ON → the same ON replay on every shape.
- `pulserPublishLag` OFF/ON → the same ON replay on every shape, and the same `prox-l38-chest` result.
- `chestCoverFencepost` OFF/ON → the staged chest opens on 13 (and the late walk on 26), with the stream at 0 px.
- `publishedButtonRoomSetter` ON beside it → wave 63's 17 rows are the game's (cleared set, 0 px, length).
- The base's last 4 OFF keys ON beside it (`plainPickupInFreeze`, `chestCoverFencepost`, `presserRecursionHang`,
  `publishedButtonRoomSetter`) → every shape still at 0 px. The tape movers are the same 20, and the md5 is the same
  as ON alone.

### Rows (`fidelityResponderOrder.test.js`, fast tier, 63 tests; the shapes ported into `fidelityResponderOrder.js`)

- The key contract.
- Every witnessed shape: OFF = the shipped first divergence and R tick (a table); ON = 0 px with R agreeing every tick.
- The level change (`w-leave-*`).
- The double applications.
- L40RES: ON with the lag OFF or ON gives 0 px, every game spinner row matched, and the hit at t1222.
- The frame kinds:
  - span: the three L28 rock-button recordings sample for sample, with `{28,2}` at OFF's stamp;
  - frozen + dead: `r5-shaft`, ON = OFF over the whole result;
  - hold: a hold mid-fade opens L on OFF's stamp, one row later.
- The 20 movers, each with its moved field and the stream, transitions and hits unmoved.
- The horizon, against the game's hold-cuts.
- The L40 spinner presses, against the game's hold-cuts.

### Mutants (copy + restore, `fidelityResponderOrder.test.js`)

| Mutant | Predicted | Shown |
|---|---|---|
| M1 the Lock guard ignores enemies | b1-spinner, b1-occ, b1-r124, b2-flyer, b2-occ | exactly those 5 + the last-four composite |
| M2 the responders read the current press (no publish) | a2-*, b1-r124, w-latch | **30 rows**: those, plus w-block, w-cover-124/-128, w-spin-button, w-leave, the BR row, the span and `r5-shaft` rows and the press-lag movers. My prediction was too narrow; the lag is what cancels the deferral everywhere. |
| M3 no enemy in the presser half | w-spin-button, the L40 row | those + the 3 L40 mover rows + the composite |
| M4 the transition tick's step run | the w-leave row | exactly that |
| M5 the span step run at once | the span row | exactly that |

## D3: the ON measurement

- **Byte-inertia OFF:** the fixtures diff is empty, and the acceptance md5 is the standing value at the head.
- **The acceptance md5:**
  - base and head OFF: `391322d681b7aa0229d94b3f6906d024`;
  - head ON, and head ON + the last 4 keys: `d871cee754a7490a7003a7395028e531`.
  - The only moved seed is **post-swim seed 3** (`waterx2 wallx4`, "requires Progressive Shield"):
    - skeleton → final goes from `220→227` to `221→228`;
    - its 2-process digest moves;
    - its five requirement lines' tick counts each move +1 (227 → 228, 277 → 278).
  - Nothing else moves: no certification and no requirement verdict. I did not attribute the +1. It is most likely a
    solver view reading the pre-step set between ticks (the hand-over below).
- **Tapes (`d3/tape-order.txt`):** 322 tapes, 20 movers, and the same 20 with the last 4 keys.
  - The fields: `lockWrites` 15, `earnedClears` 4, `pulserHits`/`pulsePushes` 4.
  - The stream moves on 0 tapes, and the hits on 0.
  - The refuted `r8-solve-5` throws the same way in both arms.
- **The movers, by field:**
  - `lockWrites` +1 tick: `hammer-bw-l42-381-bombstand`, `l40button-l41-part0`, `r2-walk-5-darkshield`, `r2-walk-full`,
    `r3-walk-5-darkshield`, `r3-walk-full`, `r5-l40-part0`(+`-control`), `r8-d2`, `r8-d2-20` and `r9-solve-20`. Those
    are the press lag.
  - `pulserHits`/`pulsePushes` +1, with the last hit past the horizon: `prox-l38-chest`, `prox-l38-reach-l39` and
    `r5-totem-entrance`(+`-control`). That is L38's latched pulser, the latch half (now witnessed).
  - `earnedClears`/`lockWrites` far: `r5-l40-part5` (+`-control`): 40,12 742 → 114, and `wandlock@480,560` 842 → 215.
    `l40button-l42-part0`: 40,1 1370 → 1336, and `wandlock@176,80`/`@176,208` 1470 → 1437, with its +1 lockWrites at
    1096 → 1097. This is the spinner press, game-witnessed.
  - The horizon: `l71-hold-101-shut` (`lockWrites` t101 dropped) and `l30keylock-pit224-before` (`earnedClears` t212
    dropped). Game-witnessed.
- **The runtime probe at the ON branch (`d3/probe-order.txt`, 323 tape files):**
  - 192,800 deferred steps, of which 192,596 ran;
  - 204 were pending at a tape's end (the horizon);
  - 669 seeded first steps;
  - 441 transition steps dropped, and 25 torn-down steps dropped;
  - **397 spinner presses**, on `r5-shaft` 185, `r5-shaft-control` 111, `r5-l40-part5`(+`-control`) 39 each,
    `l40button-l41-part0` 19 and `l40button-l42-part0` 4;
  - **0 holds by an enemy alone.** On L39 the spinners press Buttons that blocks already hold, and nothing moves.
  - The acceptance batch, in-process: 41,106 steps, 0 spinner presses, 0 torn-down. Its subprocesses are not counted.
- **The hit gate:** no committed tape takes a hit ON that it does not take OFF (`hits` and `playerHits` are unmoved on
  all 322), and the batch's hit columns are unmoved.
- **ON movers by file:row (tests, key ON):** see § The ON test sweep.
- **The keyed ON-arm sweep, named for the planner:** `SEEDLING_RESPONDER_STEP_AFTER_READERS=1` over the route survey,
  with shards = min(10, legs).
  - **The survey legs are not counted:** the regenerable cache (`.cache/seedling-survey/`) is not in this container,
    the same as wave 64.
  - The probe says which legs to expect: the routes through L39 (spinner presses, 0 moves), L40 (spinner presses on the
    t3 and t1 latches) and L38's latched pulser.

### The ON test sweep

`SEEDLING_RESPONDER_STEP_AFTER_READERS=1` over every test file that names the families: 576 files.
- 542 fast-tier files, in 19 batches of 30 (`--maxWorkers=2`).
- 34 `.slow.`/`.train.`/`.calib.` files, one at a time, each under its own config.

**95 rows fail ON, in 42 files, out of 15,725.** Every one falls in one of four classes. None is a model error.
The counts come from the JSON reports: this vitest's `--reporter=json --outputFile` exits 0 on a red batch.

**(1) Game-witnessed: ON is the game, and the row pins OFF's timing (19 rows).**
- **Measured: these game replays now match ON.**
  - `fidelityL39Shaft` D1 (`l39shaft-scripted`): ON at `lockLag` 0 has 0 disagreements. OFF needs `lockLag` 1, and ON
    at 1 gives exactly OFF's four lock rows, one tick later. The ledger read offset that OFF needed is the deferral.
  - The same shift explains the D2 lock row (t367/368), and the D2 MUTANT row's first disagreement is now a lock row,
    not a spinner row (2 rows).
  - `fidelityPublishedButtonRoom` `btn-lock`/`btn-cover`: the controls the row names as lagging the game "OFF and ON
    alike" replay at **0 px ON** (2 rows).
- `fidelityL40Button` `l40button-l42-part0`: ON clears (40,1) at 1336, and the game's hold-cut is 1337 (`d2/witness-l40button`).
  OFF says 1370. The forced-order assertion (`at[1]` after every rock) does not hold in the game: rock (40,23) clears at 1360.
- `fidelityCorpseBump2`: `openAt` 1301 → 1303. The game's (40,9) is at cut 1303, which is ON's stamp 1302.
- The latch/hold +1 (`w-latch`: the game opens at on + 102):
  - `levelRun` R2 ×3 (101 → 102 ticks of standing);
  - `activators` ×3 (the fades, the release, the block latch);
  - `r5Totem` link 4 ("the hold is 101 ticks");
  - `botDriverV2` R2 (a 101-tick hold is now short).
- `fidelityL30KeyLock` D1 ×3:
  - `bosslock@64,32` opens one model row later: 304 → 305 and 325 → 326. That is OFF row t−1 = ON row t, the same game tick.
  - The 212-tick `pit224-before` opens past its last frame: the horizon, which the game's hold-cuts witness.
- `fidelityWandHold`: the game samples all still agree (`disagreements` = []). Only the model's own cover row moves:
  open 40 → 42, shut 61 → 63. That is the deferral plus the responders reading the Button's previous publish.

**(2) OFF-contract units and OFF-arm rows: they pin the call order or a key that ON ignores (25 rows).**
- `fidelityDeterm` (c) ×6 and `r5Shaft` `lockclose`: these step `stepActivators` and read the events of the same call.
  ON emits them a call later.
- `levelRun` R3 and `botDriverV2` R3: the touch-lock window, 263/264 and 27/28.
- `fidelityChestCover` ×5: the OFF-12 expectations, and the `chestCoverFencepost` arm, which ON gates off (no double
  application). The Chest's tick 13 holds ON in `fidelityResponderOrder.test.js`.
- `fidelityFirePush` (`pulserPublishLag` OFF) and `fidelityL40Res` (`spinnerLockLag` OFF): ON ignores both lags.
  `fidelityResponderOrder.test.js` holds L40RES at 0 px either way.
- `seedlingResponderFade` (`f6-l20-reentry`): its anchor reads the type against the open at OFF's row alignment.
- The frame-choice goldens recorded OFF, each shifted by a frame:
  - `seedlingMachineSkin`;
  - `seedlingPuzzleSkin`;
  - `seedlingSolidsSkin` ×4;
  - `seedlingSoundCues` ×2.

**(3) Solver re-plans: the solver plans with the ON model and comes out a tick or a few different (51 rows).** This is
the HAMMER hand-over. A wait reads the pre-step set between ticks, so it sees an open one tick later.
- Fast tier:
  - `fidelityCorpseBump`, `fidelityCrossRoom` ×5, `fidelityL100Lattice`, `fidelityL12Doors` ×4,
    `fidelityL30KeyLock` D2 ×9, `fidelityL39Hit` ×2, `fidelityL39Shaft` D2 (2741/2740), `fidelityL40Latch`,
    `fidelityProximity` ×2, `fidelityRulesref` ×2, `fidelityTurretCircle` ×2;
  - `hammerDashWindow`, `hammerErGaps`, `hammerKeylockTurretArrival`, `hammerLatchWeigh`, `hammerRockHolderWait` ×2,
    `hammerSpinnerPress`;
  - `r5Totem` L41 (77/76), `seedlingRobust` ×2, `solverBot` R9 12d″ ×2.
- Train tier:
  - `fidelityCorpseBump2.train` ×2, `hammerBk2Combat.train`, `hammerChooserPair.train` (656/655),
    `hammerEscapeExact.train` ×2, `hammerTurretApproach.train` ×3.
  - OFF, the same five train files: `fidelityCorpseBump2.train` passes; the other four are still running (filled in by the next commit).
- **Hits, measured where a row pins them:**
  - `fidelityL30KeyLock` D2: every re-plan is +1 tick at **0 hits** (347 → 348, 309 → 310, 318 → 319, 320 → 321, 341 → 342).
  - Its two "both OFF" rows still refuse, under a different refusal message.
- **CrossRoom (verified):** ON replays the OFF-solved tapes at 0 px. Its D4 rows fail because the solver's ON plan is a
  different tape: 407 rows against 422. The `TypeError`s are the rows that index that plan.

**(4) Not this slice.** `omsiUnlockPool` fails to load (an ENOENT on a file this slice does not touch); it is not counted in the 95.

**The hit gate over the sweep:**
- No row that replays a committed tape or a game witness takes a hit ON.
- The re-plans that pin hits pin 0, and they still get 0.
- I did not measure hits on every hammer re-plan. Those rows pin ticks, not hits; the train runs are named for CI below.

## Gates

All gates are at the head with the key OFF.
- **Bounded vitest:**
  - before, at the base worktree: 56 files, 1618 passed;
  - after, at the head: 61 files, **1768 passed**, 0 failed. That is the same family set plus the new and touched files,
    `fidelityResponderOrder.test.js` among them (64 tests).
- **CI at `3dc81668`, the last code head** (`ci-vitest-summary.mjs`):
  - suite: vitest (unfiltered), 1445 files, **30338 passed, 0 failed**;
  - slow battery: 39 files, 460 passed.
  - The run at `668b0e08` was cancelled when the next push superseded it. The commits after it are evidence and one
    test file.
- **The train tier is NOT run in CI at this head.** For the planner: `gh workflow run unittests_frontend.yml -R
  PeerInfinity/Archipelago-CC --ref claude/seedling-responder-step-order-fazdoz -f train_only=true`. I can't dispatch.
  Locally, OFF, the five train files that move ON pass (above).
- **The six solve `--check`s exit 0:** r8-battery, r8-d2-chain, r8-l18, r8-tail, r9-l3 and r9-campaign.
- **Checks that pass:**
  - `check-procgen-docs`;
  - `generate-procgen-reference --check`;
  - the constants census;
  - `seedling-solver-surface --check` (re-derived with `--write`, line numbers only).
- **`ci-producer-checks`:** 99 run, 0 red, 1 skipped, 0 known-red.
- **No fixture diff.** The acceptance md5 at head OFF is the base's: `391322d681b7aa0229d94b3f6906d024`.
- Not run, by the brief: `pytest`, the unfiltered local vitest (⚖ 52) and `standing-values --write`.

## What the brief got wrong (measured)

- **"Only the 18 ledger-only movers"** is wrong on two counts. It is 20, and three of the 14 lockWrites tapes move by
  hundreds of ticks, not one: the spinner presses a latch, which the brief listed as unwitnessed residue.
  - The 2 additions are the horizon. OFF writes a step past the tape's last frame, and the game's hold-cut has no such
    write.
  - All 20 are still ledger-only.
- **"The model is right for a block on a Button" (wave 64)** is half right. The press is right; the release behind the
  block re-shuts L a frame later in the game (`w-block`).
- **"The level change, whose responder step runs last in the old level"** is wrong for the game. The game runs no old
  level step on the transition tick (`w-leave-*`), so ON does not run it. OFF does.
- **"Every frame kind gets the same order":**
  - The span needed it literally. A span step that only reads the lagged publish is one frame late on a rock that lands
    on a Button: L28's `{28,2}` at 166 against the game's 165. Each span frame's step therefore defers to the next span
    frame's readers, like the main tick.
  - The dead frames have no responder step at all, OFF or ON. That is a pre-existing gap, not an order.
- **"`Cover.hitables` has no Enemy, so for a Cover the read alone should be enough":** witnessed true
  (`w-cover-124`/`-128`).
- **The press lag's latch half:** on + 102, witnessed.

## Hand-overs

### Planner (fidelity)

- PASS. The key is ready for a flip decision. It was measured ON over every committed tape and the acceptance batch,
  with every mover explained and game-witnessed.
- A flip re-records:
  - the 20 movers' ledger pins (the rows that read `lockWrites`/`earnedClears`/`pulserHits` ticks);
  - the acceptance md5 (`d871cee754a7490a7003a7395028e531`; post-swim seed 3);
  - the ON sweep's class (1) and (2) rows, 44 in all (§ The ON test sweep), `fidelityL30KeyLock`'s `open: 212` among them;
  - the class (3) re-plans, which follow whatever HAMMER decides about the between-tick view.
- CI: dispatch `unittests_frontend.yml -f train_only=true` at the head (I can't dispatch).
- The press lag's latch half is now witnessed (`w-latch`), so `prox-l38-chest`'s pulser pushes move with it, as wave 64 asked.

### HAMMER (`seedling-hammer-phase-planning-15`)

- Under ON, a pending step sits between ticks. A read-only view of `run.entities('openActivators')` /
  `activatorsNow` taken between ticks sees the set BEFORE the next frame's responder update. OFF it saw the set after it.
  That is the set the player's next sweep reads.
- A solver wait ("until open") therefore sees an open one tick later. That is the safe direction: it waits one tick
  more.
- It is the likely cause of post-swim seed 3's +1.
- If the views should read what the player's next tick reads, they need a peek at the pending step. That is solver-side
  and not mine.
- The APChest (p4h) updates after the responders. Under ON it must read the post-step set, so on a base that has it,
  it would need that peek too.

### Residue

- **A wallflyer on a Button:** from source (the same `hitables`), unwitnessed.
- **The other enemies:** a Lock's box and a Button count only the spinner and the wallflyer. Other enemies have no
  model position here (the standing boundary).
- **A spinner or wallflyer on a FallRock's Button:** `armButtonFallRocks` keeps its own press, unchanged.
- **The arrow trap's lag:** game-adjudicated, unchanged.
- **The dead frames:** the model steps no responder in them, OFF or ON.
- **A death reboot's dropped step:** derived, unwitnessed (0 movers).
- **The survey legs:** not counted (no cache).

### JS arc

None.
