# Seedling fidelity IGNEOUS — the Igneous-to-Lava tile (type 31)

| | |
|---|---|
| Session | `seedling-fidelity-igneous` (wave 20, planner `seedling-fidelity-planning-9`) |
| Start SHA | `934f99422b` (main: R7 + L40GUARD flip + H1 wording + `rules-r4b-followup`) |
| Harness branch | `claude/igneous-lava-tile-9gjpvf` |
| Code head | `9dbcc75b` (this report is the commit after it) |
| CI at the code head | `JavaScript Unit Tests` **green**: vitest 21,443 / 21,443, slow 259 / 259 (run at `9dbcc75b`) |
| Switch | `CONTACT_FIDELITY.igneousLava`, **OFF**, byte-identical OFF |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (digest field STOPPED → hammer arc) · D3 PASS · D4 PASS** (CI dispatches named, not run) |

## The one thing to know first

**The model was missing the tile, and the solver's waits were walking onto it.** The game turns a type-31 tile to lava
36 renders after the player first comes within √512/2 px of its centre: 9 to break it, then 27 more whether or not the
player stays. The model now does exactly this. All five game witnesses are reproduced at 0 px, and leg 649's t39 death
is among them.

The real cause of leg 649 is the plan. L76's route is a snake of type-31 tiles between two islands of safe floor. The
OFF plan waits there for `lavachain@128,64`'s phase standing on tile (2,5), so the tile turns under it.

With D3 the solver replays the tiles' clocks along its own previewed walk. Survey step 195 (L76) then solves in 496
ticks (OFF: 519, a plan that dies on the game). The new walk is witnessed on p4g at |Δ| 0 with no death.

ON moves exactly **one survey step (195) and one sweep leg (649)**. It moves no identity row, no producer `--check`, no
tapeRunner pair and no tape, and the bounded set ON has no real red.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/igneous-lava-tile-9gjpvf 934f99422b` | bootstrap `READY`, node v22.22.0; server PID 943 on port 9704 |
| identity block | `SEEDLING_PORT=9704 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`c807d56da2fc5ccec1c0bf0d72a8c452`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK, reference ALL MATCH |
| six `--check`s | the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1`, exit 0 · ⚠ **r9-campaign `c6fc1297` exit 1 AT THE BASE**: re-run alone on the clean tree, one FAIL, `r9-solve-32 trace … DRIFT` (`w0/campaign.txt`). Pre-existing; this slice neither causes nor fixes it, and it reads the same digest after |
| surface / constants / entities / profile | each `--check` (clean base worktree) | GREEN **321** · PASS **6,102** · PASS 566 · PASS 138 (both) |
| roster | `fixtures/tapes/index.json` `.tapes` | **289** (unchanged after: no tape added to the roster) |
| bounded vitest BEFORE | 241 non-slow files: the brief's standing list + every test naming `probeSamples`, `dangerAt`, `dangerDuringTransit`, `ENTITY_FAMILY_NAMES`, `FAMILY_BLOCKS`, `CONTACT_FIDELITY_KEYS`, `tileWriteEvents`, `tileWrites`, `withTileWrites`, `entities('`, `levelWorld` or `surface` (`grep -a -l`; list: `evidence/bounded-files.txt`) + `fidelityL32ArenaPrefix` (slow config) | **8,105 / 8,105**, sorted `status\tfile > name` md5 `f888907627f699c94435a7d9469f788e`; slow L32 5 / 5. ⚠ `apReportBosses` has no test file of that name |
| tapeRunner rows | the bounded run's rows naming `tapeRunner` | **638**, `17bbc7ffc8475691866af87f1e6ce45f` |

Evidence: `seedling-fidelity-igneous-evidence/` (`w0/`, `after/`, `d1/`, `d4/`, `survey/`, `drivers/`).

## D1 — the tile on the game (PASS)

**The source** (vendor/seedling `src/` @`ccdf189776`, each line read):
- `Tile.as:105` — `super(_x + w/2, _y + h/2)`. A Tile's `x, y` is its **centre**, so the distance in
  `Tile.as:396` is measured from the centre, not the `.oel` corner.
- `Tile.as:126-130` — `render()` returns at `!onScreen(int(t == 32) * 16)`, which is margin 0 for type 31.
- `Tile.as:390-433` — the state machine as the brief quotes it. `FP.world.nearestToPoint("Player", x, y)` is the one
  player.
- `Game.as:278-279` — `IgneousLava.png` is **48 × 16**, so `frameCount` is **3**.
- `Player.as:706-737` — the setter applies `inLava` only when the state changes, and 31 → 17 under a standing player
  is a change.
- `Game.as:132-162` — type-31 levels: **L71** (Dungeon7/Entrance, 7 tiles), **L74** (Dungeon7/3, 18), **L76**
  (Dungeon7/5, 36), **L77** (Dungeon7/6, 4), **L78** (Dungeon7/7, 6), **L85** (OverWorld/d7entrance, 11), **L99**
  (Dungeon8/1, 4). The counts come from `levelWorld`'s build and equal the brief's.

**The witnesses.** Each was played on p4g headless (`probe-seedling-encounter-ticks.mjs --tape-file --out`; L76, boot
(16,80) → (24,88), the brief's item set, `pins: ["sound","dead_frames"]`). The model's predictions were written before
each run, and the game's drained streams are committed (`fixtures/igneous-witness/*.game-obs.json`).

| tape | in-range renders | game | model ON |
|---|---|---|---|
| `igneous-l76-leg649` (the brief's tape) | t3 → | stops t39 (y 83.55), respawn (24,88) t69 | break t11, lava at the **t38** render, death t39 — 91 ticks at 0 px |
| `igneous-l76-k8` | t5–t12 (**8**), back t48 | no break; the return breaks on its first render (t48), lava t75 with the player away; re-entry → death, respawn t127 | 0 px |
| `igneous-l76-k9-rebuild` | t5–t13 (**9**) | breaks t13, lava t40; stepping on at t52 → death (respawn t82); after the restart, in range t105 → death **t141** (= 105 + 36: **rebuilt**) | 0 px |
| `igneous-l76-k4-stand` | t5–t8 (4), back t47, stands | death **t79** (respawn t109). A reset counter would give t83 | 0 px |
| `igneous-l76-fresh-stand` | t45 →, stands | death **t81** (respawn t111) | 0 px |

Pinned from these:
- **Trigger**: the origin within (10.90, 11.75) of the centre counts; that bracket holds √512/2 = 11.31.
- **Break**: on the 9th in-range render, the first one after the counter reaches 0.
- **Counter**: not reset by absence.
- **Timing**: 9 renders per frame, so lava 27 renders after the break with nobody near.
- **Rebuild**: a death restart rebuilds the tile. A door re-entry is the same `new Game`, from source; not separately
  witnessed.

⚠ Not witnessed: dead frames and freezes. L76 has no freeze, and no teleporter arrival on any of the seven levels lands
within range: of all arrivals, the nearest type-31 tile is 16 px away. The model refuses those cases by name instead
(D2).

## D2 — the model (PASS; one part STOPPED)

**Change.**
- `igneousLava.js` (new, pure): `IGNEOUS` (31 → 17, counter 8, 3 frames, radius √512/2), `stepIgneousRender`,
  `igneousInRange`, `igneousRendersToLava`.
- `levelRun.js`, inside my own functions:
  - `igneousStates` (per visit, dropped by `freshVisitState`) and an `igneousEvents` ledger.
  - `renderIgneousNow()` is stepped **at the frame's render point**: right after `renderBossesNow()` in the live tail
    (after `view()` and `updateLists()`), gated `!noclip && !next.transition`, and in `runFrozenTick` after its
    `stepCameraNow`, because `render()` runs on frozen frames.
  - Off-screen tiles are skipped through `camOnScreen` / `onScreenUnderShake` with margin 0.
  - A turned tile is written into `tileWritesByLevel` and `world` is re-wrapped (`visitWorld`), the Bulb's overlay.
    So the next update's `resolveTerrainState` reads 17 and the existing lava death runs.
  - The family `igneousTiles` (null OFF) and the getters `run.igneousTiles` / `run.igneousEvents`. The write also
    appends a `tileWriteEvents` row of kind `'igneous-lava'`.
- **Refused by name** (`IGNEOUS_UNMODELLED`, a named INTERIM; the modelling is queued below):
  - dead frames spent since the last render (any `clock.spend`: freeze, ceremony, help) while a tile is breaking or in
    range;
  - an uncertain shake band over a tile its render would change;
  - an arrival within range of an unturned tile (the load fade's renders would count it).
- Shared tables (rows added, none reordered): `CONTACT_FIDELITY` (+ `igneousLava`, its env hook
  `SEEDLING_IGNEOUS_LAVA`), `ENTITY_FAMILY_NAMES`, `ENTITY_FAMILIES`, `FAMILY_BLOCKS`, the surface doc's family table.

**Gate.** `fidelityIgneous.test.js` has 16 rows: the state machine, the five witnesses (OFF diverges at its named tick,
ON is 0 px with the deaths and lava ticks named), the query, the arrival refusal, and D3's rows.

**Mutants** (predicted first, made by copy + restore):

| mutant | predicted | measured |
|---|---|---|
| M1 radius 8 | the five witness rows + the constants row red | 11 red, those plus every row that reads the clock (query, arrival, D3 ×2) |
| M2 `stepIgneousRender` resets the counter out of range | k4-stand and k8 red | ⚠ **prediction wrong**: only the unit row red. The run never calls the machine for an unbroken out-of-range tile (it skips first, as the game's render does nothing there) |
| M2′ the run's skip resets the counter | k4-stand and k8 red | exactly those 2 |
| M3 no `world` re-wrap after the write | every ON death row red | the 5 witness rows |

**⛔ STOP — the digest.** `igneousStates`, the per-visit map of tile clocks in `levelRun`, is new run state that walks
read and that a fork/escape replay carries. It is **not** in `stateDigestParts`. A turned tile IS covered, because the
written world is digested as its overlay (`worldToken`). An unturned clock (counter, `breaking`, `frame`) is not covered.
Under `igneousLava` ON, two runs that differ only in a tile's counter digest equal, and `ESCAPE_CROSS_PASS_CACHE` could
reuse an escape across them. OFF, the map is always empty, so nothing changes. **Hand-over to the hammer arc:** add
`igneousStates` to the `visit` component (`part({…, igneousStates})`) before `igneousLava` can flip. I did not edit
`stateDigest`/`stateDigestParts`.

## D3 — the solver (PASS)

**What failed with the model alone.** Step 195 ON with no D3 was REFUSED, "the combat ladder is EXHAUSTED … avoid: no
walkable tile path in level 76 from tile (1,5)". The phase stall (`solverBot`'s PHASE arm,
`PHASE_DODGE_RUNG`) certifies a stall with `probeSamples` over a `previewWalk`. The preview steps no tile clock, so a
25-tick stall parked on tile (2,5) certified clean, and the drive then turned the tile and cut the snake behind it.

**Change.**
- `dangerMap.igneousDanger(run, box, tick, mode)` is one row in `dangerAt`'s source list.
  - A **breaking** tile is lava from `now + igneousRendersToLava`, in both modes, for a box whose terrain probe
    touches it.
  - An **unbroken** tile is danger in **WAIT** mode only: a dwell in range long enough to break it (`counter + 1`
    renders), because the break is the point of no return.
- `dangerMap.igneousWalkDanger(run, samples)` replays copies of the live clocks along a previewed walk, one render per
  sample at its position. A tick gap renders the previous position again. It reports the first sample whose probe
  touches a tile that turned at an **earlier** render. The source is `{kind: 'igneous', id: 'igneous@tx,ty', breakAt,
  lavaAt, why}`, so the refusal names the tile and its clock.
- `solverBot.probeSamples` gains one row: that check after its per-sample loop. Every corridor probe, the AVOID re-plan
  and the PHASE/AXE stall certifiers share it.
- The imports go through the door: `solverView.js` re-exports `igneousInRange`, `igneousRendersToLava` and
  `stepIgneousRender`.

The tiles' timing is priced, not avoided. No tile is forbidden outright, and walking through an unbroken one is free.

**Measured.**
- Step 195 ON: **SOLVED 496** (1 decision, 0 hits). Its walk leaves (2,5) by t30, before the t38 turn, and the snake
  crumbles behind it (`igneousEvents`: (2,5) t38, (2,4) t62, (2,3) t73, (3,3) t94 …).
- That walk played on p4g: **497 ticks, |Δ| 0** (OFF model) and print-rounding only (ON model, 2.8e-13), no death on
  either side, clock shift [0]. It is committed as witness `igneous-l76-survey195-on`.

**Mutants.**

| mutant | predicted | measured |
|---|---|---|
| M5 the walk check reads lava after the same sample's render | the leg-649 walk-check row red (t38 for t39) | exactly that row |
| M4 `probeSamples`' igneous row removed | `fidelityIgneous` green (it calls the check directly); survey 195 ON refuses again | both, as predicted. ⚠ The wiring is pinned by the survey only, not by a unit row |

## D4 — movers (PASS)

**Survey** (local, `survey-seedling-route.mjs --through=end --route=full --only=<the 15 steps on L71/74/76/77/78/85/99>`;
the switch acts only in a room with type-31 tiles, since the family is `[]` elsewhere and the stepper returns, and a
survey step solves one room). OFF equals the CI survey 39496129402 on all 15 by verdict and ticks.

| step | level | OFF | ON (model only) | ON (model + D3) |
|---|---|---|---|---|
| **195** | L76 | SOLVED 519 (the walk dies on the game: leg 649's tape is its first 40 ticks) | REFUSED (LADDER) | **SOLVED 496** |
| 189, 190, 192, 194, 196, 197, 199, 200, 201, 202, 220, 221, 223, 232 | — | — | unchanged | **unchanged** (verdict, ticks, refusal text byte-equal) |

**Sweep legs, in node.** All 49 legs whose key or level is a type-31 level (the 48 by level plus the skipped 625), staged
by the unbilledgate slice's `inv-leg.mjs` with the row's `seamTime` (`drivers/inv-leg.mjs`, `inv-leg-replay.mjs`;
ANYTIME_PASSES, unbounded). Run OFF and ON. No captured requests exist for this baseline sweep, so this is the staged
equivalent, not a `replay-seedling-solve-request` replay.

| leg | key | OFF | ON |
|---|---|---|---|
| **649** | `level_76 <- in_L71_304_256 -> exit:out_teleporter_304_112` | OK 583 t — **the OFF plan dies six times under the ON model** (a death loop from ~t284; lava (2,5) t40 …) | **OK 580 t, 0 deaths** under the ON model |
| the other 48 | (`d4/legs-off.jsonl`, `legs-on.jsonl`) | — | **unchanged** (verdict, ticks, message) |

**Bounded set ON** (`SEEDLING_IGNEOUS_LAVA=1`, the same 242 files): 8,114 / 8,122 passed, 1 skipped (the "ships OFF"
row). Its reds are the five shared with OFF (below, fixed at `45e938cc`/`9dbcc75b`) plus two **artifacts**:
`contactFidelity` "the shipped defaults: all three ON" and `dashShape` "the defaults add no field". The control switch
`SEEDLING_BOMB_BLAST_BODY=1` reds the same two rows, so any off-default env switch does. **0 real reds ON.** The
tapeRunner rows are 638 with the same md5 ON. The identity block ON equals OFF equals W0 (`c807d56d…`).

**The CI dispatches the planner should run** (I cannot dispatch):
1. `seedling-divergence-sweep.yml`, ref `claude/igneous-lava-tile-9gjpvf`, `capture_requests=true`, `keys=` the 49 keys
   in `evidence/d4/sweep-keys.txt`. Two arms, ×2 each:
   - A: `contact_fidelity=` line `A=` of `evidence/d4/contact-fidelity-A-B.txt` (today's defaults);
   - B: line `B=` (the defaults + `igneousLava`).

   Expected: B moves leg 649 off `failed` (5/6 on main per planning-9) to `done`/`crossed`, and nothing else beyond the
   ~20-leg crossed↔done noise.
2. `seedling-survey.yml`, ref the branch, `route=full`, `through=end`,
   `only=189,190,192,194,195,196,197,199,200,201,202,220,221,223,232`, `base_run=39496129402`. This is the OFF arm, and
   it should equal 39496129402 on those steps. ⚠ **The survey workflow has no switch input**, so the ON arm needs a
   one-line scratch branch with `igneousLava: true` (or the flip itself); expected: step 195 SOLVED 519 → 496, the other
   14 unchanged.

## What moves for the JS arc (wire, no pin moves)

- New **optional** run surface: `run.entities('igneousTiles')` (and the getter), `run.igneousEvents`, and
  `tileWriteEvents` rows of `kind: 'igneous-lava'` (`id: 'igneous@tx,ty'`). The skin reads `run.tileWrites`, so a turned
  tile already shows as lava there. Renamed or reshaped `run.*` fields: none.
- A new danger **source** kind `'igneous'` (`dangerKindOf` → `volume`; `solveProgress.test`'s list carries it). No new
  `SolverRefusal.obstacle.kind`: a corridor refused by it names the source in the ladder's text.
- `contactFidelityHook` derives the page setting `flashPanel.seedlingContactIgneousLava` (default false) by itself.
- No `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` contract changed. No walker
  (`botDriverV2`) edit, so no `producer:walker` row moves.

## Handed to the hammer arc

- `igneousStates` into `stateDigestParts`' `visit` part (D2's STOP, above).
- For their own previews: the escape kernel's and forced-hit's forks replay the run, so they step the tiles. Any of
  their forecasts that uses `previewWalk` alone does not, and `probeSamples` covers only the walks it is handed.

## Deltas

| row | before | after |
|---|---|---|
| identity block | `c807d56d…` | `c807d56d…` OFF, **and ON** |
| six `--check`s | as W0 (campaign exit 1, base drift) | identical digests and exits |
| tapeRunner rows | 638 `17bbc7ff` | 638 `17bbc7ff` (OFF and ON) |
| bounded vitest | 8,105 / 8,105 (241 files) | 8,122 rows (242 files): every W0 row unchanged; +16 `fidelityIgneous`, +1 levelRun family-witness row, +1 `contactFidelityHook` settings row (`before-to-off.diff`). CI at `26f34b12` named 6 reds in the shared tables (the bounded run caught 5: `seedlingConstantsCensus.test.js` was not in my set and is now); all fixed, CI green at `9dbcc75b` |
| surface / constants / entities / profile | 321 / 6,102 / 566 / 138 | **324** (re-recorded: +3 imports) / **6,126** (re-recorded: +19 classified igneousLava literals, +5 structural) / 566 / 138 |
| roster | 289 | 289 |
| reference | ALL MATCH | regenerated, ALL MATCH; `check-procgen-docs` ALL PASSED |

## What the brief got wrong (measured)

1. *"Check whether the distance uses the tile's top-left x,y (as written)"*: `x, y` IS the centre (`Tile.as:105`). The
   witnesses' timing fits the centre exactly, and the top-left would move every death.
2. Leg 649's death tick is not a property of the leg. At the brief's seam (5790) the tape dies at t39. At the baseline
   row's own seam (5564) the solver's OFF plan is a different 583-tick walk, which dies first near t284 under the ON
   model. Planning-9's "5/6 fail" and this sweep's single `done` row are samples of one seam-dependent plan.
3. The fix the finding implied was not the model alone. With only D2, step 195 regresses from SOLVED to REFUSED: the
   stall cuts the snake. The planner-side gap is the stall certifier's blindness to the player's own dwell.
4. The campaign `--check` is red at the base (`r9-solve-32` trace drift), before any edit.

## Residue (queued, named)

- **Dead spans and the load fade** are refused, not stepped. Stepping them means rendering `frames` times at the frozen
  position under the frozen camera. The first that matters is a ceremony on a type-31 level; none was found on the
  route.
- **The walk check takes every tile as on screen.** L76 is 320 px wide on a 160 px screen, so a breaking tile far off
  screen really pauses. That is conservative for a walk beside it and optimistic for one returning to it after a long
  absence.
- **The probe is the conservative half of `getState`**: rect overlap, without the nearest-tile test.
- **One-way corridors.** A crossed snake is lava behind the player. A later leg back through L76 without the Dark Suit
  meets written lava only if it is the same visit; a new visit rebuilds. Step 201 (L76 west, with the suit) is
  unaffected.
- **AVOID's static volumes** do not carry a breaking tile. The transit check catches it per corridor.
- The CI survey cannot run the ON arm without a code edit (no switch input).

## Byte-inertia

OFF is byte-identical: the identity block, the six `--check` digests, the tapeRunner pairs, the 15 survey steps and the
49 legs are all equal to the base. ON the identity block is equal as well. Every OFF path returns before touching
state: the stepper returns at once, the family is `null`, and both danger functions return `[]` / `null`.

## Rows to BANK

- `fidelityIgneous.test.js` (16 rows) and `fixtures/igneous-witness/` (6 tapes + game streams).
- Surface **324**, constants **6,126**.
- The game constants: radius √512/2 from the centre, counter 8, frames 3, 36 renders fresh → lava.
- Movers for a flip licence: **survey 195** (519 → 496) and **sweep leg 649**. Plus the hammer arc's digest row, which
  must land first.
