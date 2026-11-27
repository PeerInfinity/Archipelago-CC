# seedling-hammer-latched-hold — the A1 32:12 latched bombpusher hold (L40 Totem 64,144)

Evidence: `seedling-hammer-latched-hold-evidence/` (`repro/`, `census/`, `survey/`, `page/`, `tools/`).

## 1. SHAs

- **Start:** `2b24a77e3f` (branch `hammer-flip-bos-gsw-pm`). It is not on `origin/main` (`75ac248ea6` does not contain it), so
  the base is the flip branch, as the brief said.
- **Branch:** `claude/seedling-latched-hold-t7m4vy`.
- **Head:** this report's commit. Code head: `b759bf2d`; evidence: `bbde2634`.

## 2. The answer first

- **Switch:** `LATCHED_HOLD_MOVE`, **OFF**.
  - Turn it on with `SEEDLING_LATCHED_HOLD_MOVE=1` or `withLatchedHoldMove(enabled, fn)`.
  - It is in `SOLVER_ENV_NAMES`.
  - Thread: `execHold` runs inside `solveAnytime`, i.e. in the page's solve worker (and in node). No main-thread mapper reads
    it, so the worker env channel is the whole wiring.
- **A1 32:12, ON:** **SOLVED**.
  - 1889 ticks. Both passes solve; model hits **0**.
  - A fresh replay of the plan has **0 hits and 0 deaths**.
  - Work 1866 of 2560. Answer `a404ddf42e41`.
- **A1 32:12, OFF:** unchanged, the refusal `599d2ef41b84`.
- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at base, at head OFF and at head ON.
- **The one thing to know first:** it solves the captured request, but **not** a fresh page's arrival at the same wall.
  - A crafted p4g leg reaches A1's refusal word for word (§6).
  - ON it still refuses. On that arrival's spinner phase, every walk out of the pocket meets `spinner@192,128`'s hammer at
    fork tick 22.
  - So the whole-game walk's entry 32:12 moves only if its arrival keeps A1's phase. The next re-measure decides.

## 3. The reproduction (measured, base `2b24a77e3f`)

**The refusal.** Replaying re-measure-8's `A1.stop-requests.jsonl.gz` row 32, request 12 (`tools/solvecap.mjs`) gives
answer `599d2ef41b84`, the same as re-measure-8:
- dashless refuses at 823 work;
- full is cut at `crusher-fork` (1738);
- message: *"apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) at (167.88…,135.25), inside
  bombpusher@112,128's 256 px reach … (MOVING_WAIT, 256 tried)"*.

**The hold** (`repro/base-32-12-probe.txt`, a temporary probe at `execHold`, not committed):
- It begins at run tick 1553, on `buttonroom@160,128` (t=1, room −1), with a bound of 131.
- Its `until` is that `wandlock@176,80` and `wandlock@176,208` are open.
- **Group 1 is already in `latchedGroups` at the hold's first tick:** the stance walk's arrival fired the latch.
  - The game agrees that a fired latch keeps the group open: `ButtonRoom.as`'s setter only ever writes `true` and sets
    the responders then, and `Lock`'s fade runs from `activate`, whoever stands where.
- The lobber is `bombpusher@112,128`. Its live point is (136,152), 36 px from the stance, and its `shotTime` is −1
  (shooting).

**A hitless wait exists in the model** (`repro/base-32-12-refuge-search.txt`).
- The search forks the segment at the hold and tries lattice cells nearest first: walk there, then stand until `until`,
  inside 131 ticks.
- 15 of the first 36 cells open the group hitless. The first is (200,135): walk 92 + stand 9.
- Before the 36th fork the deadline tripped.

**Class (a):** a solver rung, costed medium. It is not budget's (the 4× budget had refused too) and not fidelity's.

## 4. Design, change, OFF identity

**Hook.** `execHold`'s pace question is wrapped in `try`:
- OFF rethrows the same refusal (byte-identical).
- ON, and only where `pacedHoldPlan` or `lobberHoldRefusal` throws, `latchedHoldMove` is asked. It needs:
  - a presser hold (`stance` and `target`) with an observed `until`, the hold latched;
  - a `danger` refusal;
  - the presser's group in the live run's `latchedGroups`.
- New code: `LATCHED_HOLD_MOVE` and `latchedHoldCells`, `latchedHoldPreview`, `latchedHoldRoute`, `latchedHoldMove`.
- It reads no level, coordinate or entity id.

**What `latchedHoldMove` does:**
1. **Cells.** Free lattice cells (`TILE_SIZE`) within 96 px of the player, that:
   - plan from the player;
   - touch no other presser;
   - pass a preview screen: the run's own `previewStepper` walks there and stands, priced with `dangerDuringTransit`
     against the walk forecasts, **bombs only**;
   - arrive inside the bound.
2. **Order.** The shortest planned route on from the cell to `ctx.aim` (FADE_MOVE's aim), with the group's responders
   discharged (`bagWithDischarged`). Then nearest the player. This is the user's FADE-MOVE ruling: wait towards where
   the walk goes next.
3. **Cert.** At most **2** cells are played on the segment's fork: `forkWalkTo`, then `fadeForkStand` until `until`.
   - The first one kept has no hit or death, no crossing, no new latch, and opens inside the bound.
   - Its keys are replayed on the live run, which must agree; otherwise it refuses by name.
   - If nothing is kept, OFF's refusal stands.

**Each part was measured before it was kept:**
- **First cut** (nearest cell, first accepted): A1 solved, 2398 t, but with a **bomb hit at t1690** on the goal walk.
  - That cell, (200,135), sits behind the spinner shaft from the route.
  - Forcing route-side cells gave hitless solves: (232,103) 1899 t, (232,119) 1893, (232,135) 1889, (248,119) 1900,
    (232,151) 1895.
  - Hence the route order.
- **Second cut** (12 forks, all asked, best route): A1 solved hitless, but committed fixtures regressed.
  - Each fork replays the segment, about 48 work units per 1553-tick fork.
  - leg371 (OFF 1805 t, hitless) and leg376 (OFF 1614 t) refused ON at `shouldStop`.
  - Hence the screen and the 2-fork cap.
- **Bombs only in the screen.** The preview prices `spinner@192,128` at tick ~30 on every walk out of the A1 pocket, yet
  the forks walk those cells hitless. With full pricing the screen kept 0 cells.

**OFF identity.** The acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at base, head OFF and head ON (re-measured after
the submodule init). The 250-step survey is identical, §7.

## 5. Rows and bounded runs

**Fixture.** `fixtures/latched-hold-move/A1-32-12.request.json` (57 KB) is the page request with its source cut to L40's
record. It gives the full capture's answers: OFF `599d2ef41b84`, ON `a404ddf42e41`.

**Rows:**
- **Train tier**, `hammerLatchedHoldMove.train.test.js` (via `hammerLatchedHoldMoveRows.js`): **2/2, 95 s**.
  - OFF refuses by name (MOVING_WAIT), answer pinned.
  - ON solves 1889 t with `modelHits` 0, a fresh replay with 0 hits and 0 deaths, and the move row: t1553, wait at
    (248,103), 130 t, 1 fork.
- **Unit tier**, `hammerLatchedHoldMove.test.js` (4 rows): default OFF, the env channel, wrapper restore, generic bounds,
  instrument reset.
- `train-shard-costs.json` has a local row for the new file.

**Bounded vitest** (final code; paths only, no unfiltered run): `hammerLatchedHoldMove.test.js`,
`solverEnvChannel.test.js`, `hammerFadeMove.test.js`, `fidelityMovingWait.test.js` and
`scripts/procgen/seedlingSolverSurface.test.js`: **5 files, 83/83**. Plus the `scripts/test/` shard rows, 5/5.

**Regenerated and checked:**
- `census-seedling-solver-surface.mjs --write` / `--check`: GREEN, 375 rows.
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: no diff.
- No doc under `docs/json/developer/procgen/` changed, so no link-census pins were owed.

**Not done: the dispatched train-tier run.** `actions_run_trigger` on `unittests_frontend.yml` with `train_only=true`
returned **403 "Resource not accessible by integration"**. It is owed at the tip:

`gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-latched-hold-t7m4vy -f train_only=true`

## 6. Page play / game witness

**Fresh page, p4g.** `probe-seedling-divergence-sweep --page=seedling_bot_ap_p4g --mode=inv --page-legs=1
--leg-budget-ms=900000 --capture-requests`, with `serve-nocache.py` on :8000 (started and stopped by this session).
- The crafted leg (`page/legs-crafted.jsonl`, measurement only) has:
  - leg 379's south arrival `in_L39_144_0` at (480,896), A1's boot;
  - leg 847's goal `location:Level 040 - Totem Part 64,144` and its sphere 8.1;
  - L40 flags 7, 8 and 12 staged (not flag 1: that is `wandlock@176,80` cleared, which would remove the hold).
- **OFF:** `failed`, with A1 32:12's refusal word for word (640, then 2560 on the held retry).
- **ON** (`SOLVER_ENV: … SEEDLING_LATCHED_HOLD_MOVE=1`): **still `failed`**, on the same rung.
- Replaying the page's own captured request in node (`page/p4g-on-request-replays.txt`):
  - its spinner phase differs (MOVING_WAIT's down/up meets the spinner at paced tick 27, not 33);
  - both forks, and all 12 cells when forced, are hit at fork tick 22 by the `spinner@192,128` hammer;
  - an experimental still delay of 0–32 ticks before the walk does not clear it (ticks 22–28, then the bound, then
    tick 49). It was not shipped.
- The switch declines there correctly: no hit is shipped.

**A game witness of the solved plan is blocked**, exactly as STEP149 measured.
- The node plan as a staged tape (`tools/mktape.mjs`) is refused by the model: *"level 40: the tape clears tag(s) 14,
  25, which no entity in this level reads"*.
- A fresh page cannot reach A1's state without the whole-game walk.
- The node fresh replay (§5) is the evidence.

## 7. Census: which seed-1 sweep legs (by key) the change can move

**Reach.**
- A presser hold refused for a lobber's bomb (still or paced), whose group has latched.
- Only **L40** has a BombPusher (an atlas scan of all 116 levels).
- Its latching presser groups inside the 256 px reach are `buttonroom@160,128` (t=1) and `buttonroom@272,208` (t=0).
  Plain buttons never latch.

**Survey `--through=end`** (`survey/through-end-off-vs-on.tsv`):
- 250 steps, **identical OFF and ON on every field but `ms`**: SOLVED 226, REFUSED 24. No step gains a hit.
- With a preload instrument (`tools/lhm-preload.mjs`), the L40 steps 66, 96, 134, 136, 149, 166 and 173 all report
  **asked 0**.

**All 48 committed page-request fixtures, in node OFF vs ON** (`census/fixtures-on-off.jsonl`): **45 byte-identical.**
Four reach the code:

| capture (key) | OFF | ON |
|---|---|---|
| A1 32:12 (whole-game walk, L40 from the south) | refused `599d2ef41b84` | **solved** 1889 t, 0 hits |
| `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` (old-list leg 368, `l40bk2-witness`) | 1714 t, 0 hits | 1599 t, 0 hits |
| `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` (old-list leg 371, `hammer-bx-371`) | 1805 t, 0 hits | 1796 t, 0 hits |
| the same key (old-list leg 376, `hammer-376-bomb`) | 1614 t, 1 hit (t1248 bomb) | identical: asked, screen kept 0 cells, 0 forks |

**The current list** (`seedling-divergence-legs.mjs --presets=seedling_playthrough`, 915 legs) has two Totem 64,144 legs:
- `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`;
- `level_40__r4c4 <- in_L42_240_336 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`.

Both stage `flag:L40:1` (`wandlock@176,80` cleared). Their committed captures (the puncher-ladder fixtures) are
byte-identical with asked 0. **So no current seed-1 sweep leg is measured to move.** The two old-list captures that do move
get shorter, and stay hitless.

## 8. What the brief got wrong (measured)

- **"once the latch has fired, the rest of the hold":** the latch has fired **before** the hold starts (the stance walk's
  arrival, tick 1553), so the whole hold is a latched wait.
- **"walking out of the 256 px disc and back" / "needs a refuge outside the reach":** neither is needed.
  - The kept waits end 60–100 px from the stance, well inside the lobber's 256 px. A walking player is not where the aim
    lands, and the fork prices the stand.
  - There is no "back" either: the wait ends where the route goes on, and the goal walk starts from there.
- **"is there a hitless out-and-back":** yes, but the choice of cell is what matters. The nearest hitless wait leaves the
  goal walk a bomb hit (t1690). Only route-side cells give a hitless plan.
- **"Switch-independent in replay":** confirmed for OFF. A fresh page's arrival at the same wall is *not* the same
  request, though (spinner phase, §6), and the fix does not carry to it.

## 9. Residue / hand-overs

- **The page arrival (§6)** is the open part of the wall.
  - Every route out of the pocket shares the spinner shaft, and the hammer meets it at fork tick 22 whenever the walk
    leaves within 32 ticks.
  - A fix would need either a spinner-phase-aware departure (the press-kill slice's territory: kill `spinner@192,128`
    first) or a longer still wait than the bomb allows (first blast at 44).
  - The next re-measure should run with `SEEDLING_LATCHED_HOLD_MOVE=1` to see which phase entry 32:12 arrives on.
- **leg376's 1-hit plan** is OFF's, unchanged. No screened cell exists on that arrival.
- **The preview's spinner pricing:** stricter than the forks on the A1 pocket (§4). Not fidelity's to fix here; recorded
  for the planner.
- **Owed:** the dispatched train-tier run (403 here, §5), and the user's SHA-bound OK before any flip.
- **Planner follow-ups:** none arrived during this session.
