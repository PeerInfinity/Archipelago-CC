# seedling-js-l107-investigate — what happens on leg 785 in L107

Leg 785 `level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48` solves at 12 of 61 arrival clocks (5600..5611,
fidelity MISCRES D2, copied under `d2/`). Verdict: **a PLANNER gap (lane choice under a clocked beam), not an honest
refusal and not a budget problem.** The game gets through at every clock.

## The room (`tiles.mjs`)
The only way west is the 2-tile corridor of rows 7-8 (y 112..144, x 32..192). Both beam towers fire their LEFT beam
along its whole length: tower `@208,120` at [y1-19, y1-15] (row 7), tower `@208,136` at [y1-3, y1+1] (row 8), y1 =
tower 1's live y (`BeamTower.getRect`). Each beam is 4 px tall; the player box is 4x5 (`Player.normalHitbox`). So a
walk goes *along* the beams for ~130 px, and the 12 px lane BETWEEN the bands is the place to be.

## Q1 — the clock (`phase.mjs` → `q1/`)
- The beam's on/off is the tower's own Spritemap from its ctor: built on the visit's first stepped tick
  (`levelRun.beamTowerStateFor`), so it is visit-relative (left firings at visit ticks 190, 242, 294, … every 52) and
  independent of the arrival clock.
- The bob `y += 0.3·sin(Game.worldFrame(100, 2)/100·2π)` reads `Game.time` (period `timePerFrame 45 × loops 2` = 90)
  and ACCUMULATES. So the arrival clock fixes the tower's y trajectory for the whole visit (y1 sweeps an 8.6 px window
  whose position is set by `seam mod 90`). A stall cannot change that offset.
- The solve band is where that window sits lowest (y1Min 127.39 at 5604-5605), i.e. band 1 lifted furthest above
  the planner's tile-centre row y≈120 (the refusal's own danger point is (130.9,120.8)).
- PREDICTED and MEASURED on the solver (request 1, its own 2,560 budget, `d2/sites.mjs`): it also solves at
  5510..5521 and 5690..5701, refuses at 5509/5522/5689/5702, 1,548 units in every band. The verdict is a function of
  `seam mod 90` alone.

## Q2 — the game (`scripts/procgen/probe-seedling-l107-lane.mjs`, `lane-walk.mjs` → `q2/`)
- The LANE WALK (wait under the corridor for tower 2's left beam to end, ride the 12 px lane with the bob, wait at the
  west end for tower 1's left beam to end, up and out) reaches L102 with zero hits at **90/90** clocks 5564..5653 on
  the model, 372..387 t (the solver's own plan is 387..390 t).
- On the GAME (p4g, headless logic-only, at `152af53509`): run `40130819530`, 11 sample clocks in and out of the band
  — the game reaches L102 at every one, its stream identical to the model's (first differing row −1); run
  `40130832484`, all 61 clocks 5564..5624 (see the as-built for its verdict).
- CONTROL: the same walk at a FIXED y 120.8 (the planner's row) passes only 5601..5605, 5610..5612 on the model (the
  solver's band); on the game (run `40130826099`) it is knocked by `beamtower@208,120` at 5594, 5622 and 5640 and
  passes at 5605, row-identical to the model each time.

## Q3 — the cost (`fixed-lanes.mjs`, `dodge-row.mjs` → `q3/`)
- One `phase-dodge` unit = one preview of the (walk-offset, stall) grid: 8 offsets × 89 stalls = 712 per corridor. At
  640 the first pass cannot finish one grid (632 units there). At the solving clocks the stall it finds is 41-44 t at
  plan tick 132 — the 8th (last) offset — so it costs ~712 and needs the 2,560 retry. At refusing clocks MISCRES
  measured ten full grids (7,120 units) before the ladder is exhausted.
- No stall lever fixes it: on the tile-centre row, stalls 0..89 pass 0/90 at 5594, 5622, 5640 (40/90 at 5605); a FIXED
  gap-centre lane (y 124/126/128) with stalls 0..89 passes 0/90 at 5564/5594/5622/5640 (the bob's 8.6 px swing exceeds
  the lane's 7 px slack); fixed lanes 114..138 pass at most 3 of 30 clocks. ⚠ This walk re-syncs to each beam's end,
  so a stall here only chooses WHICH firing (52 t apart) the walk meets — the solver's own refusal text covers its
  grid. `phaseDodgeArrivalStall` is a stall too: MISCRES measured 10,949 units, still refused.

## Q4 — honesty of the clock
The planner reads the arrival clock only as game state: `staging.seam.time` → the run's `Game.time` (the bob) and
`dangerMap.axeVisitClock` (visit-relative, from the run's transitions). Wall clock in `solveAnytime` times rows only
(`ms`; "it decides nothing"). Identical work per band across three bands = deterministic. Arrival clocks vary between
CI repeats because the game runs real frames before the leg — game state, which a player meets too.

## Smallest honest fix (named, not landed)
A LANE lever for the dodge rung's PHASE arm: when a corridor runs along a beam band, walk it in the band-to-band lane
at the towers' live y (`beamTower` state the model already steps; priced per firing by `phaseHazardHit`), crossing
each band right after its own firing. One deterministic walk per corridor instead of a 712-preview grid.
