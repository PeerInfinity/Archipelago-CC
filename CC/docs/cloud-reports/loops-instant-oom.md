# LOOPS-I1 — Loop mode under Instant: an action the pool cannot afford drains and fails, as at normal speed

Branch `loops-instant-oom`. Planner: concept-library-content-planning-3. ⚖ Robert 2026-11-21 ("Fix Loops Instant mode").

## The measured table

One `explore` (cost 50, no cost data), queue of two so a completion does not end the queue. Normal speed is stepped at
2 mana a frame (`gameSpeed` 10 × 1000 ms frames). "Instant" is the global `instantMode`; the per-block Instant toggle
(`_currentBlockIsInstant`) took the same branch and measured the same in every row. Measured by driving
`_processFrame` in node, at base (`origin/main` 84d9ccd29d) and at the tip.

| Pool | Normal speed, base | Instant, base | Every speed, tip |
|---|---|---|---|
| 80 (affordable) | completes; XP 50; 30 left | same | same |
| 50 (exactly the cost) | completes, THEN the OOM reset (events: `actionCompleted`, `loopReset`); XP 50 | same | same |
| 30 (exceeds) | 15 frames drain 30 → XP 30; progress 60 %; no completion; OOM reset; progress cleared by the reset | **completes in 1 frame; XP 50**; then the reset | drains 30 → XP 30; no completion; reset |
| 49 (exceeds, edge inside a frame) | **completes**: frame 25 asks 2, the pool holds 1, `deductMana` clamps; XP 50 | **completes**; XP 50 | drains 49 → XP 49; no completion; reset |

Order of events at normal speed for an over-cost action: each frame adds progress and spends the frame's mana, banking
it 1:1 as region XP (`gameState:xpChanged`). The frame that empties the pool runs `_maybeCompleteCurrentAction` (progress
< 100 → nothing), then `_maybeResetForOOM` → `_resetLoop`. That refills mana, clears every action's progress
(`_resetActionsProgress`: partial progress does NOT persist across the reset), puts the index back to 0 and publishes
`loopState:loopReset`. The XP stays.

## The fix

`frontend/modules/loops/loopState.js` `_advanceActionProgress`: **a frame spends at most what the pool holds.** If the
frame's progress would cost more than `currentMana`, the progress is capped at what the pool pays for, and the frame
spends exactly `currentMana`. XP gained = mana spent, 1:1, as before.

- One rule for every timer path: `instantMode`, a per-block Instant, and normal speed's last frame (⚖ planner: "An
  action the pool cannot pay for must never complete, at any speed").
- Not capped: zero-cost actions, and debt mode (`noManaDepletionReset`). There the pool runs negative and `manaDebt` keeps
  the depth. The Cost Debugger's Verify and `timerTests` run that way, so they are unaffected.
- An action costing exactly the pool (within `PROGRESS_EPSILON`, 1e-9 % of progress) still completes, then the OOM
  reset fires, as at normal speed.
- An affordable action is unchanged at every speed.
- `_processFrame`'s order (complete, then the OOM check) is unchanged: with the cap, an over-cost action never reaches
  100 %, so the order no longer matters for it.

## The pins

`frontend/modules/loops/instantParity.test.js` (16 rows). Each case runs the same queue from the same pool at normal
speed (stepped), under `instantMode` and under a per-block Instant, and asserts:
- normal speed gives the measured outcome;
- both Instants give an IDENTICAL end state (completions, reset, event order, XP, mana, index) in one working frame.

The cases:
- affordable (80);
- exactly the pool (50);
- exceeds (30);
- **the normal-speed edge** (49, named so in the test).

A fifth case, a fractional pool (77/97), must land on exactly 0 and reset at every speed. See the next section.

Mutations:
- Base `loopState.js` → 3 red: the 30-pool rows under `instantMode` and under per-block Instant, and normal speed on 49.
- The first cut (below) → 3 red: the fractional-pool rows.

## Defects my own tests found

1. **The first cut left a float sliver above 0, and the queue stalled.** At `f2284988b3` the capped spend was recomputed
   as `(mana / cost × 100) / 100 × cost`. About one pool/cost pair in ten leaves about 1e-14 (measured: 10 534 of 100 000
   random pairs). A pool above 0 never fires `_maybeResetForOOM`, so each frame drained a smaller sliver, forever.
   - CI found it at `f2284988b3`. Both rows were green on main at 84d9ccd29d (nightly 44895366627, TT 44843371152):
     - `playback-bot-loop-mode-adventure`: stuck at "loop 2: explore Overworld (action 3 of 3, mana 0 left)";
     - `tutorial-walk-loops-adventure`: step 6 `run-explore`, done check never held.
   - Fixed at `65f18ee25d`: a capped frame spends `currentMana` exactly. Pinned by the 77/97 case.
   - Both rows are green at `65f18ee25d`: TT 44924869576's playback-bot job, and manual `tutorials` 44924871859.

## The blast radius

Every in-app batch ran on CI. The first full set was at `f2284988b3`: TT 44922782034 and manual `batch=all` 44922784603.
Every batch was green except the two rows above, and those were this slice's own defect.

**Rows that moved because they had passed only thanks to the overshoot: NONE.** No row needed a test fix, at either the
normal-speed edge or Instant.

At `65f18ee25d` (the sliver fix) the regression job of TT 44924869576 went red once:
- `test_settings_colorblind_mode_toggle` ("Colorblind symbol not found in Menu region");
- `test_json_panel_import_from_text` ("Failed to update colorblind regions setting to true").

Neither touches Loop mode. The same job was green at `f2284988b3`, and a re-run of the failed job at the same SHA was
green (job 136919970843). It is a flake, not this slice's.
<!-- BLAST-RADIUS-TIP -->

## ActionNodes (step 4)

<!-- AN3B -->

## Follow-ups (named, not fixed here)

- **Instant prices an action once; normal speed re-prices every frame.** At `loopState.js:3464` (`const actionCost =
  this._calculateActionCost(this.currentAction)`, top of `_advanceActionProgress`), the cost carries the region-XP
  discount (`applyRegionXpCostEffect`). At normal speed the XP banked mid-action can level the region up, and the rest of
  the action gets cheaper. Instant prices it once, at the level it started at. So an action that crosses a level boundary
  costs a little less at normal speed, and that holds for affordable actions too. This is older than the slice, and the
  planner ruled it out of scope.
- **Sum-of-fractions slivers outside `loops/`.** These spends deduct fractional costs and test `<= 0` for depletion:
  - the maze's per-tile spends (`mazeRoom/mazeRoomUI.js:2617`, `:4848`, `:4904`);
  - `chargeMana` (`resourceChannels/resourceChannelsLibrary.js:175`).

  A pool that should run out after exactly n tiles can keep about 1e-14 (measured: pool 100 at 100/n per tile leaves a
  sliver for 24 of n = 2…60). The reset then fires one step late, when that step clamps the pool to 0. It is not a stall:
  the next spend ends it. Inside `loops/`, every path drains a sliver on the next frame or the next pass:
  - an uncapped frame whose remainder is float noise is followed by a capped frame;
  - auto-restart wraps a queue that ended on a sliver;
  - `_spendMana` clamps whole costs.

  The natural fix point is `gameState/state.js` `deductMana` (round a result within ε of 0 to 0).

## Gates

- Bounded vitest over `loops`, `playbackBot`, `actionNodes`, `resourceChannels`, `loopsCostDebugger`: 52 files,
  1177 tests, green at `65f18ee25d`.
- `check-loop-costs-one-model.mjs`: ALL PASS (5 documents).
- Maze engine closure: `engineMd5 bec369878feb67081187edca62baa951` (42 files), identical at base and tip.
- No committed preset moves: the diff touches `loops/loopState.js`, `loops/instantParity.test.js` and this report.
- Gitlinks: 0 moved.
<!-- CI-TIP -->
