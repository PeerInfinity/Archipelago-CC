# Seedling fidelity AXETIMING: a spinning axe's gap, crossed on its clock at dash speed

| | |
|---|---|
| Session | `seedling-fidelity-axetiming` (planner `seedling-fidelity-planning-8`, wave 18, model coverage) |
| Start SHA | `d1fbfeffc2` (main: wave 17 harvested OFF; not rebased) |
| Head | the commit carrying this report. Code: D2 `bd70a7f6` + the fix `f6e6eb00`; D1 evidence `034bb0ce`; D3 `9dc181c3`; records `9738d79f` |
| Harness branch | `claude/seedling-axe-timing-n9ym90` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (two switches, both OFF; STOP at the flip, movers listed) · D3 PASS (5 game witnesses, 0 px)** |

## The one thing to know first

**A stall cannot buy what the walk's speed cannot.** Every point inside a spinning axe's reach is swept once a
revolution. So a walk is hitless at some phase only if its angle round the hub, measured relative to the blade's,
turns by less than one revolution while it is in reach. The stall phase does not decide it.

On L61, the walk under `spinningaxe@160,80` turns **8.77 rad** in 55 in-reach ticks. Every stall the AXE arm tries is
therefore hit (at least 1 hit at each of the 52 phases).

The sword's dash chain shortens the crossing to ~20 ticks. Dashed, **17–21 of the 52 stalls are clean**, and the game
agrees at 0 px.

That is the rung. ON, it flips 6 failing sweep legs and survey steps 152/183, and adds no other mover.

Three of the brief's legs are different: 597, 630 and 754, plus survey steps 161/204. Their corridor is a forced U
round the hub against the blade, and no timing exists for them at any phase or speed. They need a **priced**
crossing, not this rung.

## W0 — the bank at base (`d1fbfeffc2`)

| row | command | result |
|---|---|---|
| base | the harness branch reset to `d1fbfeffc2`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Dev server `serve-nocache.py 9685` (pid 563). The six non-wasm submodules were initialised by hand (`git submodule update --init` …) |
| identity block | `SEEDLING_PORT=9685 bash scripts/procgen/identity-block.sh .` | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set `OK`. The six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0. These equal SPINNINGAXE's banked values on every row (`evidence/w0/identity-base.txt`). The reference read "4 differ" before the submodules were initialised and **ALL 7 + 5 MATCH** after |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` | **611**, `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass |
| roster | `fixtures/tapes/index.json` `.tapes` | **277** |
| surface / constants / entities / profile | the four `--check`s | GREEN 308 · PASS 6,000 · PASS 566 · PASS 138 (both JSONs), each measured in the base worktree |
| bounded vitest BEFORE (base worktree) | 120 files: the brief's list + every non-slow test naming `spinningaxe`, `AXE_DODGE_RUNG`, `CONTACT_FIDELITY_KEYS/_DEFAULTS`, `DASH_CHAIN_PATTERN`, `climbLadder`, `ESCALATION_LADDER`, `axeVisitClock`, the surface/constants/profile tests, `mover`, `tapeRunner` (`evidence/w0/bounded.txt`) | 4,984: 4,972 pass, 10 skip. 2 red: `loopBlockBuilder` and `generated`. 3 files fail at load: `registerBackend: duplicate id 'empty'`. All five come from the worktree environment (symlinked submodules), and the same files pass in the primary tree (AFTER, below). md5 `098593ac8c32120683a3cb63260771cd` |

## D1 — why each leg refuses (PASS)

**Method.** I derived the legs with `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`; the ids
equal the sweep's. I then solved each leg in node at its baseline row's `seamTime`: inventory staging plus the row's
items and slots (`drivers/leg.mjs`, SPINNINGAXE's driver with a budgeted path added).

**Two budget regimes, both measured.**
- *In place.* `createInPlaceProduceService` strips the budget.
- *The page's own flow* (`PAGE_BUDGET=1`). `solveAnytime` runs at 640 work units with the 85-unit upgrade window.
  When a pass is cut, the held retry runs at 2,560 over the passes not yet answered, on one work clock.
  This reproduces the sweep rows' *"ran out of 640, then 2560 work units"* exactly.

I captured each corridor's preview at the AXE arm with a scratch hook (`drivers/axdbg-hook.patch`, made by copy and
restore), and also previewed it dashed, with the sword's chain every 20 t. `drivers/spread2.mjs` measures:
- the in-reach span;
- the **unwrapped turn of the walk's angle relative to the blade** (θ − a);
- the hits at every stall.

| leg (key) | baseline | in reach (walk) | relative turn walk / dashed | clean stalls walk / dashed | cause |
|---|---|---|---|---|---|
| 529 `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_0_160` | failed (640, 2560) | 55 t | **8.77** / 4.3–5.1 rad | **0** / 17–21 of 52 | **T** (gap at dash speed) |
| 530 `… -> exit:out_teleporter_112_0` | failed | same corridor | same | same | **T** |
| 597 `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0` | failed | 131 t | **20.5** / 31–58 | 0 / 0 | **A** (forced U against the blade) |
| 598 / 600 / 601 (L71, south: `224_304`, Chest, shieldlock) | failed | — | — | — | **T**. ⚠ My D1 sample was 597 alone; the A/B found these three. Their corridors leave the hub southward and never make 597's U |
| 630 `level_75 <- in_L71_96_0 -> exit:out_teleporter_64_0` | failed | 130 t | **18.2** / 17.6–50.6 | 0 / 0 | **A** |
| 754 `level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96` | failed | 101 t | **11.2** / 20.9–37.6 | 0 / 0 | **A** |
| 497 `level_54__r27c8 <- in_L52_112_0 -> exit:out_teleporter_128_464` | failed | — | — | — | **B** (arrival inside the disc; the gate) |
| 768 `level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144` | **done** at 5508 | — | — | — | not moved by either switch (below) |

(`evidence/d1/turn-and-stalls.txt`, the corridors `d1/corridor-*.json`, room maps `d1/room-maps.txt`.)

**The rungs, by cause.**
- **TIME** cannot help, for two reasons. Every aim is 208–299 px away, beyond `TIME_RUNG.reach` (48 px). And
  `forbiddenByDanger` asks `dangerAt`'s default **WAIT** mode, where an axe is its whole 32 px disc, so the mover
  could not see the gap even in range.
- **The AXE arm's stall** (`AXE_DODGE_RUNG`, one revolution × 8 walk-offsets) and its bent corridors (60 previews,
  ≤ 2 vias) are the right question for a walk whose turn is under a revolution. All four T/A corridors turn more, so
  286–1,711 previews spend themselves for nothing.
- **The budget.** Under the page's flow the AXE arm's search is the whole bill. The dashless pass spends 1,976 of the
  retry's 2,560 units, and the full pass is cut at `axe-dodge` with ~584 left. So a rung asked *after* the search is
  never reached on the page. (Mutant M3, below, measures exactly this.)
- **A: there is no gap.** L71's north exit, L75's north exit and L101's stairs each go round the hub against the
  blade. The turn is 11–20 rad walking and 17–58 dashed. At the best stall, the walk would be billed
  **1 (597, 754) or 2 (630)** hits with the player's 20-tick i-frames (`Player.as:336`; approximate, since knockback
  is ignored; `d1/group-a-priced-hits.txt`). This is a **model** question with a known answer: the game bills the
  hit (SPINNINGAXE's `spinningAxePlayerHit`). What is missing is the planner's acceptance of a priced crossing.
  See the hand-over.
- **B: the gate.** The player arrives at (136,456), 16 px under `spinningaxe@128,432`'s hub (rate −2, a revolution in
  180 updates). The walk's opening gate (`refuseDanger` → `dangerNow`, WAIT mode) refuses on the disc *"Slice 2 has
  NO DODGE POLICY"*, before any corridor is planned. Yet the blade is far from the player, and the goal is the door
  8 px below.

## D2 — the AXE TIMING rung, and the gate's timed blade (PASS; STOP at the flip)

### `CONTACT_FIDELITY.axeTimingRung` (`SEEDLING_AXE_TIMING_RUNG=0|1`), OFF

`solverBot.js`, inside the ladder's AXE arm (the `dodge` rung), as a closure: `axeTimingCrossing`. Bounds:
`AXE_TIMING_RUNG = { rest: 12, offsetStep: 2, maxPreviews: 240, turnMargin: 1 }`.

**The search.**
- It searches the doorstep stall (0 … period − 1, at the AXE arm's own doorstep) × **10 phases of a repeating sword
  dash chain**: `DASH_CHAIN_PATTERN` `[0,2,8,14]`, one window every `ORDINARY_SWING_PERIOD` (20), starting
  `0, 2, …, 18` ticks after the walk resumes.
- The schedule rides on the walk's own strike policy (`strikePolicyFor(run, {dashPlan, dashMode})`). The presses are
  the walk's, and a press the game would gate buys nothing in the preview either.
- Stalls longer than `rest` are screened by arithmetic first. The stalled walk is the rest-length one shifted, dash
  schedule and all, and is priced with `axeHitsPlayer` at the shifted update. Only a clean screen is previewed.

**The certificate.**
- Each candidate is previewed to the point where it has been in reach and then **passed the waypoint the undashed
  corridor heads for after its last in-reach sample**. A goal inside the reach is walked to its end.
- It is certified by `probeSamples` over that whole prefix: the danger map's transit arm, `axeHitsPlayer` at the
  visit's update count on each sample's **pre-move** box. That is exactly the question `spinningAxePlayerHit` bills.

**The drive.**
- The crossing is driven through `run.advance` (the view counts its dashes).
- Then the run's own `playerHits` are read. A hit the drive took refuses by name: *"AXETIMING — the crossing … was
  HIT on the run at t…"*.
- Then `{}` is handed back, the spit DODGE's contract: the walk re-plans from the far side, and the ordinary probe
  certifies the rest. A second axe there gets its own climb (L61 has two).

**The order.**
- `axeTimingFirst` measures the corridor's relative turn over the samples whose box centre is inside the blade's
  length. When it exceeds a revolution + `turnMargin`, the rung is asked **before** the stall search.
- Otherwise it is asked after the stall search and the bent corridors.
- ⚠ This is a heuristic for the order, not a proof: the blade can step over a 4 px box between two updates. That is
  why the stall search still runs when the rung finds nothing.

**The gates.**
- A pass that may dash (`dashMode !== 'none'`; the dashless pass is refused by name).
- The sword in the room and in `primary` (`sword` / `ghostsword`; the ghost's chain is `GHOST_DASH_CHAIN_PATTERN`).
- A visit clock that vouches for the count (`axeVisitClock`).

**It does not call `planSwordDash`, `dashPrefixesFor` or `corridorDashRescue`** (hammer DB). The schedule is built
from the pattern, and the dash's model is the preview's.

**Step 152, as decided.** One `dodge` row, `axeTiming: {stall: 3, offset: 8, door: 13, ticks: 42}`, 35 previews.
Then an ordinary walk row whose `swordDash` plan handles the second axe. 227 t in all.

**The fix found by the flip battery** (`f6e6eb00`). My first cut ended a crossing at the *first* out-of-reach
sample. On L75's U (step 163, `partialDodgeReprobe` ON), that stopped an 87-t crossing at a brief exit mid-U, and
the next climb met the blade again: SPINNINGAXE D2's ON row moved from update 160 to update 157. With the fix, that
row is back at 160, and every plan below is byte-equal to the first cut's (tape `inputs` compared for 529/598/600;
step 152 still 227).

### `CONTACT_FIDELITY.axeGateTransit` (`SEEDLING_AXE_GATE_TRANSIT=0|1`), OFF

`solverBot.axeGateTimed`, called from `dangerNow` (new option `timedAxe`). It is reached only from the gate a
**walk** opens with (`refuseDanger(…, {timedSword: true, timedAxe: true})`). This is BOBSOLDIER2 D2b's shape for an
axe:
- Each spinning axe's WAIT disc is replaced by its exact blade and hub at the walk's first transit sample (update
  `ticksCompleted + 1 − V`, the pre-move box), so the gate and the probe that follows it ask one question.
- A visit clock that cannot vouch for the count keeps the disc.
- An executor's gate keeps the disc.

### Measurement

| instrument | OFF | ON (both) | ON + `spinningAxePlayerHit` |
|---|---|---|---|
| survey step 152 (L61 `208,96 → 0,160`) | REFUSED (EXHAUSTED, the blade at update 40) | **SOLVED 227** | SOLVED 227 |
| survey step 183 (same staging) | REFUSED | **SOLVED 227** | SOLVED 227 |
| step 152 under `solveAnytime` at 2,560 | refused: full pass cut at `axe-dodge` | **SOLVED 227** in the full pass (350 work) | — |
| leg 497 (page budget) | refused by the gate | **SOLVED 7** (dashless, 2 work) | SOLVED 7 |

**Mutants** (each predicted, then made by copy and restore; M1–M3 were first run at `bd70a7f6`, and M1 and M3 were
re-run on the final code `f6e6eb00`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | the certificate gutted (no danger stop, no `probeSamples`) | the ON solve rows move; with the axe arm ON, the post-drive check refuses by name | ✔ at `bd70a7f6`: ON → 230 t (an uncertified crossing); ON + axe arm → *"AXETIMING — … was HIT on the run at t32 by spinningaxe@160,80"*. On the final code: exactly the 3 ON solve rows (unbudgeted ×2, budgeted ×1) of 24 |
| M1+M2 | M1 and the post-drive hit check removed | the hit is walked on | ✔ the run takes the hit and the solve dies elsewhere (*"no corridor … solid:spinningaxe@64,144"*). The check is what names it |
| M3 | `axeTimingFirst` always false (the rung only after the search) | vitest unchanged; the page flow loses 529/530 | ✔ 529/530 refuse under `PAGE_BUDGET`. The first test cut was 11/11 under M3, so I added the 2,560-unit row. On the final code M3 reds exactly that row (1 of 24) |
| M4 | `axeGateTimed` returns the WAIT answer | exactly the D2b ON row | ✔ exactly that 1 (at `bd70a7f6`; `axeGateTimed` is unchanged since) |

Rows: `fidelityAxeTiming.test.js` (24).

**Does this rung's flip require `spinningAxePlayerHit`'s?** No. The rung certifies against the danger map's transit
blade, which exists with the axe arm OFF, and every crossing it drives is hitless (the post-drive check never fired
on a real plan). With the axe arm ON, the run bills nothing on any of the crossings (pair arm = ON arm on all 77 legs
and all 222 survey steps except 163, which is the axe arm's own mover). The pair is the stronger state, because only
then can the run's own billing veto a wrong certificate. I recommend licensing them together.

## D3 — game witnesses (PASS)

The rung's plans were recorded on the game (p4f headless, `botLoadTape`/`botStart`, `botDrain` plus the last
`botStatus` poll per tick; `drivers/game.mjs`, SMALLGAPS's driver). Each was then replayed by the model with the axe
arm OFF and ON (`drivers/cmp.mjs`):

| witness | the plan | game | model OFF | model ON |
|---|---|---|---|---|
| `axetiming-l61-152-plan` | survey step 152, 227 t | 228 rows, `hits` 0 | **0 px**, no hit | **0 px**, no hit |
| `axetiming-l61-529-plan` | sweep leg 529 at `seamTime` 5172, 227 t | 228 rows, `hits` 0 | 0 px | 0 px |
| `axetiming-l71-598-plan` | leg 598 at 5414, 122 t | 123 rows, every `hits` read 0 | 0 px | 0 px |
| `axetiming-l71-600-plan` | leg 600 at 5406, 181 t | 182 rows, every `hits` read 0 | 0 px | 0 px |
| `axetiming-l54-497-plan` | leg 497 at 5176, 7 t (the gate) | 8 rows, `hits` 0, L52 at t7 | 0 px | 0 px |

⚠ The sweep tapes carry `seam.items.hitsMax` (3 on all four). `parseTape` rejects it, as SPINNINGAXE found, so it
was stripped. 3 is the game's default, so the boot is unchanged.

## The survey / sweep rows this moves (before → after)

**Survey** (local, `--through=end --route=full`, all 222 steps per arm; `evidence/survey/survey-table.tsv`):
- Local OFF = CI 38926053841 on 220 steps.
- Steps 156 and 187 (L12, no axe) were `TIMEOUT` in all three parallel arms. Re-run alone they are REFUSED in both
  arms, = CI. They are CI's own single-step slow shards.

| step | level | CI = OFF | ON (both) | ON + `spinningAxePlayerHit` |
|---|---|---|---|---|
| 152 | 61 | REFUSED | **SOLVED 227** | SOLVED 227 |
| 183 | 61 | REFUSED | **SOLVED 227** | SOLVED 227 |
| 163 | 75 | SOLVED 366 | SOLVED 366 | REFUSED (SPINNINGAXE D1's own mover; the game agrees) |

ON tallies: 172 SOLVED / 46 REFUSED / 1 / 1 (CI 170 / 50 / 1 / 1, counting 156/187 as CI's REFUSED). The 23
axe-room steps were re-run on the fixed code (`f6e6eb00`), with the same three movers.

**Sweep legs** (node at each baseline row's `seamTime`, the page's budget flow, all **77 legs in axe rooms**: L48,
L54, L61, L63, L71, L75, L98, L101, L103; `evidence/sweep/`):
- OFF agrees with the baseline's failed/not-failed on all 76 run rows (611 is a `skipped` row).

| leg (by key) | baseline 38926058850 | OFF | ON (both) | ON + axe arm | the game |
|---|---|---|---|---|---|
| 497 `level_54__r27c8 <- in_L52_112_0 -> exit:out_teleporter_128_464` | failed | REFUSED (gate) | **SOLVED 7** | SOLVED 7 | witnessed, 0 px |
| 529 `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_0_160` | failed | REFUSED | **SOLVED 227** | SOLVED 227 | witnessed, 0 px |
| 530 `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_112_0` | failed | REFUSED | **SOLVED 91** | SOLVED 91 | (same crossing as 529) |
| 598 `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_224_304` | failed | REFUSED | **SOLVED 122** | SOLVED 122 | witnessed, 0 px |
| 600 `level_71__r0c6 <- in_L72_0_256 -> location:Level 071 - Chest` | failed | REFUSED | **SOLVED 181** | SOLVED 181 | witnessed, 0 px |
| 601 `level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared` | failed | REFUSED | **SOLVED 176** | SOLVED 176 | — |

- 71 other legs unchanged in every arm, including 597, 630, 754 (group A), 633, 765 and 768.
- **Leg 768's seam census** (5500–5514, page budget): identical ON and OFF at all 15. REFUSED at ≤ 5506, on the axe
  `spinningaxe@112,144`. Unbudgeted at 5502, the rung *is* asked: 140 previews, no clean crossing, so it is an honest
  refusal. SOLVED 577/576 at ≥ 5507.
- No `producer:walker` row exists in the baseline (all 843 are `solver`), so no walker row moves. The walker
  (`botDriverV2.drive`/…) was not touched.

### Dispatches for the planner (branch `claude/seedling-axe-timing-n9ym90`)

`<D>` = the ON defaults at base:
`collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove`.

1. **Full sweep A/B** (`seedling-divergence-sweep.yml`), against baseline 38926058850 or `-f contact_fidelity=<D>`:
   - (a) `-f contact_fidelity=<D>,axeTimingRung,axeGateTransit`;
   - (b) `-f contact_fidelity=<D>,axeTimingRung,axeGateTransit,spinningAxePlayerHit`;
   - optionally (c) `<D>,axeTimingRung` and (d) `<D>,axeGateTransit` to license them apart.

   Expect 497/529/530/598/600/601 failed → done or crossed; (d) moves 497 alone. ~20 `crossed`↔`done` swaps each way
   are noise; repeat ×2 on any other key that moves.
2. **Narrow sweep** (cheaper, the same claim), the same `contact_fidelity` sets, with
   `-f keys='level_54__r27c8 <- in_L52_112_0 -> exit:out_teleporter_128_464|level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_0_160|level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_112_0|level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_224_304|level_71__r0c6 <- in_L72_0_256 -> location:Level 071 - Chest|level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared|level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0|level_75 <- in_L71_96_0 -> exit:out_teleporter_64_0|level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96|level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144'`
   and `-f capture_requests=true` (at the defaults only, per the JS arc's condition). Expect the six to move and the
   other four not to.
3. **Survey** (no `contact_fidelity` input). Make a measurement commit flipping both defaults (or with the axe arm
   too), then run
   `seedling-survey.yml -f through=end -f route=full -f only=152,183,163 -f base_run=38926053841`.
   Expect 152/183 SOLVED 227. 163 moves only with `spinningAxePlayerHit` flipped as well. A full run expects no
   other mover.

## The JS arc's pins that move + what it must wire

- **Nothing breaks unwired.** Two `CONTACT_FIDELITY` keys are appended after `corridorBodyPricing`, with no reorder:
  `axeTimingRung`, `axeGateTransit`. `seedlingContactSettings.js` derives a page setting per key, and the sweep's
  `contact_fidelity=` reaches both.
- No signature or contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`). No
  new staging or result field, and no new `obstacle.kind`.
- A `dodge` trace row ON may carry the new strategy field `axeTiming: {stall, offset, door, ticks}`.
- New refusal text (`obstacle.kind: 'danger'`): *"AXETIMING — the crossing … was HIT on the run …"*.
- `dangerNow` takes an optional `timedAxe` (internal; nothing outside `solverBot.js` calls it).
- The rung's dash presses are driven through the segment's view, so `dashesPressed`/`dashTicks` count them as usual.

## Handed to the hammer arc

Nothing changed in its region. `planSwordDash`, `dashPrefixesFor`, `corridorDashRescue`, `deriveStrike`, the
`primaryWeapon === 'sword'` gates and every other function in its list are untouched.

The rung *reads* `run.progress('primaryWeapon')` in its own gate. It also builds a `dashPlan` for `strikePolicyFor`
in the format `planSwordDash`'s `scheduleFor` produces (`{ticks: Set, starts, windows, why}`). If hammer DB changes
that format, this rung must follow it.

## Handed on (not built): the priced axe crossing (group A)

- **Legs:** L71 597, L75 630, L101 754; survey steps 161 and 204.
- **Why timing cannot solve them:** each corridor is a forced U round the hub against the blade, so no timing exists
  at any phase or speed (D1).
- **What the game does:** it bills the hit (`spinningAxePlayerHit`), with knockback 5 and 20 i-frames.
- **The size:** at the best stall the crossing costs ~1–2 hits (`d1/group-a-priced-hits.txt`, approximate).
- **The interim:** none is built. These legs keep refusing by name.

The modelling that remains is the planner's acceptance of a priced crossing, certified by the run's own billing. It
may be the FORCEDHIT rung (`forcedHits`, ON). Today that rung fails here because it cannot *prove* the hit forced:
*"depth 3 needs 46,656 more fork steps than the budget's 668"*. A relative-turn certificate (no hitless walk along
this corridor at any phase) is a cheaper proof for this one corridor. It is not a proof over all corridors.

## Deltas (base → head)

**Code**
- `solverBot.js`: `AXE_TIMING_RUNG`; in the AXE arm, `timingBase`, `axeTimingFirst`, `axeTimingCrossing`, their calls
  and the crossing's drive; `dangerNow`'s `timedAxe`, `axeGateTimed`, and `refuseDanger`'s option at the walk gate.
- `contactFidelity.js`: two switches, OFF, env hooks.

**Tests**
- `fidelityAxeTiming.test.js` (24, new).
- `contactFidelity.test.js`: the defaults pin +2 keys; its `skipIf` +2 env names.

**Fixtures** (`fixtures/chaser-witness/`, not the roster): `axetiming-l61-152-plan`, `-l61-529-plan`,
`-l71-598-plan`, `-l71-600-plan`, `-l54-497-plan`.

**Censuses and docs**
- Surface `--write`: 308 rows, count drift on existing rows only.
- Constants PASS 6,000; entities PASS 566; profile PASS 138; roster 277.
- `seedling-bot.md` paragraph; `seedling-bot-log.md` § *Seedling fidelity AXETIMING* (with 3 trap candidates).
- The reference regenerated (the docs index).

**Evidence:** `CC/docs/cloud-reports/seedling-fidelity-axetiming-evidence/`.

## Byte-inertia (OFF) and the flip's movers (ON)

| row | OFF (head) | ON |
|---|---|---|
| identity block | every value row and the six `--check`s = W0 (`evidence/w0/identity-head-off.txt`, at `9dc181c3`; OFF the fix is unreachable). The reference `ALL 7 + 5 MATCH` after regeneration | **identical to W0 on every row**, the six producer `--check`s included (`SEEDLING_AXE_TIMING_RUNG=1 SEEDLING_AXE_GATE_TRANSIT=1`, at `9738d79f`; `evidence/w0/identity-head-on.txt`). Reference MATCH |
| tapeRunner | 611, `75a3c41f…`, 0 non-pass | — (no tape replays an axe crossing) |
| bounded vitest (121 files, primary tree, at `9738d79f`) | **5,271: all pass**. md5 `5ca42e5d836aa9a10192c4146ccd5a17` | — |
| a real default flip (both `true`, scratch worktree at `9738d79f`) | — | 5,010 run, md5 `ad3d2620502d5698a908699e210dec3b`. **2 rows of ours:** `contactFidelity.test.js` "the shipped defaults", and `fidelityAxeTiming`'s "ships OFF". Plus the base worktree's 5 environment reds (`loopBlockBuilder`, `generated`, 3 duplicate-backend loads); all 5 pass in the primary tree with both switches ON by env (339/339). Nothing else in the bounded set moves, including `r8Acceptance`, every roster pin and `fidelitySpinningAxe`. ⚠ The FIRST flip run (at `9dc181c3`) also moved `fidelitySpinningAxe`'s D2 ON row (update 157 for 160); that was the crossing-end defect fixed in `f6e6eb00`, and this run is after the fix |

## What the brief got wrong (measured)

1. *"A spinning axe's … gap is the game's intended crossing: passing between sweeps."* Three of the brief's legs have
   no gap at any phase or speed: 597, 630 and 754, plus survey 161/204. Their corridors turn 11–20 rad against the
   blade (D1). Where a gap exists (L61, L71 south), it opens only at dash speed.
2. *"the TIME rung's `MOVER_RANGE` bound (48 px)"*. That bound is one reason. The other is that the TIME rung's
   `forbiddenByDanger` asks the WAIT mode, where an axe is its disc, so it could not see a gap even in range.
3. The brief groups 597/598/600/601 as one L71 cluster. They split: 597 is a U (group A), and 598/600/601 are crossed
   southward and flip.
4. *"9–10 failing legs refuse with the combat ladder is EXHAUSTED"*. Leg 497 never reaches the ladder: the walk's
   opening gate refuses on the axe's WAIT disc (group B).
5. *"768 … at 5502 an honest refusal"*. Correct, and measured with the rung asked. But the baseline row for 768 is
   `done` at seam 5508, so it is not one of the failing legs at this baseline.
6. *"run out of budget"* is the AXE arm's own stall search under the page's single work clock (640, then 2,560, the
   dashless pass first). A new rung has to be ordered before that search to be reached on the page at all.

## Residue

1. **Group A, the priced crossing** (above).
2. **`axeTimingFirst` is a heuristic for the order.** A corridor that turns just under the margin is still searched
   by the stall arm first, and may spend the budget there.
3. **The dashless pass cannot use the rung** (`dashMode: none`). It still spends most of the budget on the stall
   search before the full pass runs. That is unchanged, and it is the page's pass order, not this slice's.
4. **The axe under a freeze** (SPINNINGAXE's residue 1) is still unwitnessed. The rung refuses when `axeVisitClock`
   cannot vouch for the count.
5. **`seam.items.hitsMax`** is still not a tape seam field (the JS arc; stripped here).

## Rows to BANK

- `contactFidelity.js`: `axeTimingRung: false`, `axeGateTransit: false`.
- `AXE_TIMING_RUNG = { rest: 12, offsetStep: 2, maxPreviews: 240, turnMargin: 1 }`.
- `fidelityAxeTiming.test.js` 24 rows. Witnesses: `axetiming-l61-152-plan` (228), `-l61-529-plan` (228),
  `-l71-598-plan` (123), `-l71-600-plan` (182), `-l54-497-plan` (8).
- Survey: local OFF = CI 38926053841 on all 222 (156/187 re-run alone). ON: 152, 183 move. +axe arm: + 163.
- Sweep (node, page budget, 77 axe-room legs): ON moves 497, 529, 530, 598, 600, 601. The axe arm adds none.
- Surface GREEN 308 · constants PASS 6,000 · entities PASS 566 · profile PASS 138 · roster 277 · reference ALL 7 + 5
  MATCH · tapeRunner 611 `75a3c41f…`.
- CI (`JavaScript Unit Tests`) at `9738d79f` (the last code/records head): run 38953890063, **success**. Vitest unfiltered 20,587 passed / 0 failed; slow battery 253/253. This report's own commit adds only the report and two evidence files.
