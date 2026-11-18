# Seedling HAMMER-PHASE SMALL-WALLS: L63 / L38 / L12 (`seedling-hammer-small-walls`, Opus, cloud)

Planner `seedling-hammer-phase-planning-8`. ⚖ The user approved the slice on 2026-11-14, in the hammer replan: *"L63 / L38 / L12
small walls"*. Evidence is in [`seedling-hammer-small-walls-evidence/`](seedling-hammer-small-walls-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | `71adf001dd` (`origin/hammer-stack-trio`, as the brief names) |
| head | the commit carrying this report. The commit before it is `cc016f5f51` (evidence) |
| branch | `claude/seedling-hammer-small-walls-0eek3e` (the harness's designated branch). Nothing went to `main`, nothing was force-pushed, and no `git stash` was used |
| commits | `489eb938` switch · `d3629215` rows + solver-surface census · `7b1e149d` the resolver fallback · `cc016f5f` evidence · this report |
| box | 4 cores, node v22.23.4. `session_bootstrap.sh --seedling` reported `READY`. Five non-wasm submodules were `-` and were initialised; no gitlink moved. The dev server `serve-nocache.py 8000` was started here and killed by PID at the end |
| planner follow-ups | none arrived |

## 2. The answer first

**One switch: `FRONTIER_DOOR_ROUTE` (OFF; `SEEDLING_FRONTIER_DOOR_ROUTE=1`, `withFrontierDoorRoute`). It fixes L12. L63 and L38 are not
solver walls, and both end here as report-only.**

| wall | verdict | numbers |
|---|---|---|
| **L12 Chest** (r0c19 boots, no L12 flag) | **FIXED, ON** | node, the page's dashless request: from (432,368), 3,124 → **2,318 t**; from (16,80), 3,363 → **2,236 t**. Both 0 hits. `shieldlocknorm@288,704` (`12:10`) is no longer opened. **Game (p4g): both `finished`, 0 hits, the end equals the model's to the last decimal**, clears `12:5`, `12:2`, `12:9` |
| **L63 Chest** from L65 (128,288) | **report only: the brief's premise is wrong** | The "pole stance quantised onto a pit" is not a stance. The light arm's walk slid off the one-tile island, so the plan starts from a FALLING player (`terrain 6`, `fall.phase "out"`). Ten idle ticks later the model restores the player to (136,296). Snapping the start (built, measured, reverted) only reaches the next wall: a `darktrap@128,272` contact the model refuses by name. With `L63:7` staged (the flag the L65 door's own rule charges), the base solver plans the chest in **362 t, 0 hits** |
| **L38 Chest** from the L39 door (144,16) | **report only: the refusal is correct** | The chest sits under `cover@144,112`. The cover's only opener, `button@80,192` (tset 0), is in the south room, and `Chest.as:63` opens a chest only with no Solid on it and the player on the line below its bottom edge. The north arrival's component is 71 tiles and holds neither. `STANCE_REENTRY`'s words (*"the stance is on the far side of the obstacle it is the stance of"*) are literally true. The rules' single `level_38` region is what makes this a leg (hand-over, §9) |

**The one thing to know first:** on the seed-1 leg list the switch changes **no outcome**. The only leg it shortens is L12 Chest
re-booted at the r0c19 doors, the route's real way in (rules-7 §4.2), and that boot is not a leg in the list. The census leg (183,
from L83) plans without a frontier. Of 923 legs, the flood reorders the frontier on 4. Two end on the identical plan end. The other
two refuse on the same fire-wand model wall, naming the twin lock (§7).

**OFF identity:** acceptance md5 at base `391322d681b7aa0229d94b3f6906d024`. At head it is **`391322d681b7aa0229d94b3f6906d024`** OFF,
and also with the switch ON.

## 3. The reproduction (measured, at base)

**Capture.** I generated the legs at base (`seedling-divergence-legs.mjs --presets=seedling_playthrough`, 923 legs; the leg ids moved
since rules-7), then ran the sweep: `probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=480000
--page=seedling_bot_ap_p4g --keys=<4> --capture-requests=…`. Rows are in `repro/sweep-4-legs.rows.jsonl.gz`.

| leg (key) | page | node (`tools/solve.mjs`, dashless) |
|---|---|---|
| 906 `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest` (rules-7's 919) | failed: *"no corridor for goal collect-placement toward (132,268) … Obstacle: solid:pushableblockspear … Strategy 'shove' failed to apply. Planner said: A\* start tile (7,18) in level 63 — for (123.61554871341427,301.16961173792373) — is not walkable: pit"* | the same words, 97 work, 17 s |
| 354 `level_38 <- in_L39_144_624 -> location:Level 038 - Chest` | failed: *"apitem (144,112) contact -> pulse stance (cover@144,112) -> pulse stance (cover@144,112): STANCE_REENTRY … (152,136) … at tick 90"* | the same words at tick 147, 18 work |
| 350 `level_38 <- in_L37_288_0 -> location:Level 038 - Chest` (L38's control) | done, 324 t, 0 hits | — |
| 183 `level_12__r42c28 <- in_L83_32_64 -> location:Level 012 - Chest` | done, 230 t, 0 hits | dashless 366 t |
| 183 re-booted at (432,368) / (16,80), no flags (rules-7's r0c19 arm, `legwitness.mjs --boot`) | — | **3,124 t / 3,363 t**, 0 hits |

### 3.1 L12: the detour (model trace of the (432,368) plan, `tools/trace.mjs`)

| t | where | event |
|---|---|---|
| 0–500 | (432,368) → (286,711) | the walk south-west to the shield lock |
| 577 | (286,711) | `12:10` (`shieldlocknorm@288,704` opens). The walk turns back |
| 1000 | (232.6,264.1) | back north, past the start's latitude |
| 1668 | (429,226) | `12:4` (`bosslock@416,240`), the door the chest is really behind |
| 2265 | (488,637) | `12:2` (`burnabletree@480,640`) |
| 3124 | (327.9,824.2) | the chest |

**The code site.** `identifyAndSelect` (`solverBot.js`) orders the frontier *"ACTIONABLE FIRST, THEN NEAREST TO AIM"* (R8 slice 7).
Nearness is the door's own distance to the aim, not what lies behind it. The shield lock is beside the chest's corridor and leads to
none of it. Both existing frontier switches the L12DOORS docblock names (`fineFrontierFlood`, `fineFrontierHiddenDoor`) are already
ON at this base.

### 3.2 L63: the "pit stance" is a fall (`tools/l63probe.mjs`, `tools/l63state.mjs`; `repro/l63-*`)

- **Which walk refuses.** It is the light arm's (`execLightArm`, `deriveLightPole`): *"contact -> light (lightpole@112,272) stance"*,
  aim (132,268), the stance north of `darktrap@128,272`. Its attempts run from (136,296) at t0, (138.09,297.76) at t31 and
  (140.10,296) at t64. At t98 the player is at (123.62,301.17), and that is where the next plan refuses its own start.
- **The model state at t98.** `terrain: 6` (Pit), `fall: {phase: "out", target: (120,296), alpha 0.9}`, vx −1.30.
- **Idle from there.** (122.28,301.23), (121.27,301.16), …, (119.94,298.58) at t108, then **(136,296)** at t118: the pit restore to the
  arrival.
- **So the walk slid off the island**, and the next plan was asked from a falling body. Its refusal looked like a blocked corridor, and
  the frontier went on to shove `pushableblockspear@112,96`.

### 3.3 L38: no corridor exists from the north (`tools/reach.mjs`; `repro/l38-from-l39-door-reach.txt`)

- **The north component.** A tile flood from (144,16) with the cover, locks, pulser and pushables as walls reaches 71 tiles, all in the
  north room (rows 1–6), and touches the chest's tile only from above.
- **The cover.** `cover@144,112` (tset 0) is Solid until it is activated (`Cover.as`). Its tset-0 activator is `button@80,192`, in the
  south room (rows 8–18), which the north component never reaches.
- **The chest.** `Chest.as:59-65` opens only `if (!collide("Solid", x, y) && collideLine("Player", …, y - originY + height + 1, …))`,
  that is, uncovered and touched from the line under its bottom edge. That line is `buttonroom@144,128`'s tile, in the south room.
- The rooms' only other links are the two teleporters: north to L39, south to L37. Water borders both rooms, and the route has no
  Swim at sphere 4.8.

## 4. Design and change; OFF identity

**`FRONTIER_DOOR_ROUTE`** (one new function `frontierDoorRouted` plus a `const`, a `DEFAULT`, a wrapper, and one call site in
`identifyAndSelect`; `solverEnvChannel.SOLVER_ENV_NAMES` += `SEEDLING_FRONTIER_DOOR_ROUTE`). The decision runs in the solve
**worker** (`solverBot`), not on the main thread.

1. **ON, with ≥ 2 actionable frontier entries:** a 0-1 BFS runs over the planner's 16 px nodes, from the player to the aim, with the
   same `plannerObstacleAt` options as the frontier's own flood.
   - A free node costs 0.
   - A node blocked by an obstacle the frontier would call actionable (an entity whose strategy has a registered executor) costs one
     **door** to enter. A door spanning several nodes is entered once.
   - Terrain, pits, lethal terrain, teleporters and wall tiles are walls.
2. **When the aim's node is reached,** the frontier entry that **starts** a fewest-doors route moves to the front. Every other entry
   keeps its order.
3. **The fallback** (`7b1e149d`): when the resolver refuses the moved door, identification is asked again with the switch off, which
   gives today's order and today's words.
   - Measured before the fallback: `fidelityL40Res.test.js`'s survey-step-93 rows refused ON on `buttonroom@880,768` instead of the
     wandlock re-entry. Both arms refuse there.
   - After it, those rows read the same ON.
   - The L12 plans are unchanged (`fellBack: 0`, plan md5 equal to the witnessed ones).
4. **`counts` (`asked`, `moved`, `fellBack`)** only report; they decide nothing.
5. **No constants:** no level id, no coordinate, no Seedling constant. The flood reads only the planner's obstacles and the strategy
   table.

**Built and reverted (L63).** I built `WALK_START_SNAP` (on the planner's own refusal of a walk's START cell, re-ask once with
`snapStart`, SEEDLING JS J2). ON it took L63 past the start-tile refusal to *"levelRun: the `enemy` hit (darktrap@128,272) at tick 123 …
`hasDarkSuit` retaliates INTO the attacker … this source has not declared which it is (`byEnemy`)"*. Then §3.2 showed the start it
snapped from is a falling player. A snap there plans from a position the game is about to move, so the switch would be wrong, and I
reverted it before any commit. **Nothing for L63 or L38 is in the tree.**

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives `391322d681b7aa0229d94b3f6906d024` at
base and at head, and the same with `SEEDLING_FRONTIER_DOOR_ROUTE=1` (no acceptance leg moves).

## 5. Rows and bounded vitest runs

**`hammerFrontierDoorRoute.test.js`** (default tier). The witness is the AP-delivered level set (`l25Sets().deliveredSource`) with
the seed-1 sphere-4.8 staging from leg 183's capture.

| row | what it holds |
|---|---|
| ships OFF | `FRONTIER_DOOR_ROUTE_DEFAULT === false`, and the env name is in `SOLVER_ENV_NAMES` |
| L12 Chest from (432,368), no flag | **OFF:** solves, 2,295 t, 0 hits; the flood is never asked; `12:10` earned (the shield lock). **ON:** solves, **1,722 t**, 0 hits; `moved > 0`, `fellBack 0`; `12:10` not earned; at least 400 t shorter |
| control: the same chest from (32,864) with `12:7` + `12:12` (its door's flags) | ON keys md5 = OFF keys md5 (230 t), `asked 0` |

`solveSegment` directly (all dash passes) gives other tick counts than the page's dashless request in §2. From (16,80) it is OFF
2,779 t vs ON 1,678 t; that boot is not a row, because OFF takes 27 s.

**Bounded vitest runs** (⚖ 52; paths only; no unfiltered run, no pytest):

| run | result |
|---|---|
| `hammerFrontierDoorRoute`, `solverEnvChannel`, `seedlingSolverSurface`, `entityBlocks`, `procgenDocs/docLinks`, `procgenDocs/docsRender` | **6 files, 141 / 141** |
| OFF: `contactFidelity`, `fidelityCrusher`, `fidelityFrontier3`, `fidelityL100Lattice`, `fidelityL12Doors`, `fidelityL40Res`, `fidelityRulesref`, `solverBot`, `solverEnvChannel`, `hammerFrontierDoorRoute` | **10 files, 254 / 254** (before the fallback) |
| ON (`SEEDLING_FRONTIER_DOOR_ROUTE=1`): `fidelityFrontier3`, `fidelityL12Doors`, `fidelityL40Res`, `fidelityRulesref` | **4 files, 54 / 54** after the fallback (3 L40Res rows red before it, §4) |
| after the fallback: `hammerFrontierDoorRoute`, `solverEnvChannel`, `seedlingSolverSurface`, `fidelityL40Res` | **4 files, 62 / 62** |

**Generated surfaces.**
- `census-seedling-solver-surface.mjs --write`: 375 rows; two `solverBot.js` site counts +1. `--check` is GREEN.
- `generate-procgen-reference.mjs --check`: *"ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE"*.
- `generate-docs-index.mjs` was run; the index did not change.
- No docs edit under `docs/json/developer/procgen/`.

## 6. Game witness (p4g, headless logic-only, under the box lock)

The tool is `tools/legwitness.mjs` (rules-7's, unchanged). The fresh page's slot array is staged, and the boot is re-staged at the
real r0c19 door arrival with no L12 flag. Tapes and plays are in `game/`.

| boot | ON plan | model | game |
|---|---|---|---|
| (432,368) (L33's door) | 2,318 t, md5 `7d802bf3…` | end (327.6896,824.2994), 0 hits, earned `12:5`@866, `12:2`@1450 | **finished**, end (327.68962513034467, 824.2993578702769) = model, **0 hits**, clears `12:2, 12:5, 12:9` |
| (16,80) (L0's door) | 2,236 t, md5 `3705dac1…` | end (327.8989,824.8308), 0 hits, earned `12:5`@801, `12:2`@1372 | **finished**, end (327.8989111002846, 824.8308411940131) = model, **0 hits**, clears `12:2, 12:5, 12:9` |

The game opens the twin bosslock `@432,240` (`12:5`, beside `@416,240`, which OFF opened as `12:4`). The final
code's plans are byte-identical to the witnessed ones (md5 above, re-solved after `7b1e149d`).

## 7. Census: which seed-1 legs (by key) the switch can move

**Method** (`tools/census-leg.mjs`, `tools/census.sh`; `census/`):
- Each leg is solved in node the way the page's solver producer asks it: `ANYTIME_PASSES`, the JS-runtime arrival staging, and the
  sweep dump's delivered set and goals. It is adapted from the wallflyer slice's `inv-leg.mjs`.
- Granted items and slots depend only on the sphere. I read them off one sweep row per sphere: 36 spheres, `--leg-budget-ms=1500`,
  `census/sphere-items.jsonl`.
- One process per leg, 300 s cap, ON first. A leg whose flood never moves (`moved 0`) is OFF by construction: the order is the sort
  itself, and nothing else reads the switch.

| | legs |
|---|---|
| in the list | 923 |
| solved ON | 782 |
| flood asked (≥ 2 actionable entries on some frontier) | 45 |
| **frontier reordered (`moved > 0`)** | **4**, re-run OFF |
| over the 300 s cap, ON (not measured) | 21: L32 Times, L57 Tentacled Beast ×2, L69 Lights, L82 King of Fire ×2, L112 Owl, L19 Shieldspire, and 13 L43 Totem of Lacste arrivals (`level_43__r8c7 <- in_L40_320_576 …` and 12 `in_pit_L40_*`). These are boss-fight legs |

| leg (key) | OFF | ON |
|---|---|---|
| `level_40__r32c36 <- in_L39_144_0 ~> level_40__r26c13 -> location:Level 040 - Boss Key 2` | 4,491 t, 0 hits | 4,491 t, 0 hits, the same end (663.6998,535.0754), `moved 2`, `fellBack 0` |
| `level_40__r32c36 <- in_L43_176_464 ~> level_40__r26c13 -> location:Level 040 - Boss Key 2` | 4,527 t, 3 hits | 4,527 t, 3 hits, the same end, `moved 2` |
| `level_101__r0c6 <- in_L100_288_96 ~> level_101__r4c2 -> exit:out_teleporter_104_24` | refused: `magicallockfire@96,48` needs the Fire Wand's shot (`levelRun.weaponForPress`, case 5) | refused, the same words naming the twin `magicallockfire@112,48` |
| `level_101__r0c6 <- in_L102_64_96 ~> level_101__r4c2 -> exit:out_teleporter_104_24` | the same | the same |

**Why so few.** The flood needs a frontier, which means a walk with no corridor and two or more actionable doors on it. Seed-1's legs
mostly arrive at the side of the goal's region, where the rules' edge is open. The L12 Chest arrival that needs the switch (r0c19) is
the route's real way in, but the leg list's arrival for that goal is L83's door, whose corridor plans.

## 8. What the brief got wrong (measured)

1. **L63: "the pole-stance is quantised onto a PIT tile".**
   - The stance is (132,268), on the far side of the trap. The position quantised to a pit is not a stance: it is a falling player
     (§3.2: `fall.phase "out"`, restored to (136,296) 20 ticks on).
   - Fixing the quantisation only exposes the next wall: a Dark-Suit darktrap contact the model refuses by name (`byEnemy`
     undeclared, `levelRun.applyPlayerHit`).
   - Rules-7 measured why no hitless line exists from that tile. Spear-up needs x < 125.5, and the fall begins at x ≈ 126.66.
     Spear-left needs y < 286.5, and darktrap contact begins below y ≈ 290.1.
   - The rules already charge `L63:7` on that door. Staged, the base solver plans the chest at 362 t, 0 hits.
2. **L38: "a cover `STANCE_REENTRY` refusal".** This is accurate as a description of the refusal, but it is not a solver wall: the chest
   is unreachable from the L39 door (§3.3). The refusal's own words are the true statement of the room.
3. **L12: "the frontier's door habit".** Confirmed, and fixed by `FRONTIER_DOOR_ROUTE`. But the leg that shows it is not a seed-1 leg
   (§7): it is rules-7's r0c19 re-boot of leg 183.
4. **Leg ids moved, as the brief says:** L63 Chest 919 → 906. L38's L39-door leg is 354, and L12 Chest stays 183.

## 9. Residue and hand-overs

- **To the leg list / rules lane (L63):** `level_65__r0c8 → level_63__r6c9`'s rule names `L63 flag 7` (when no Ghost Sword Fusion is
  held), but the leg list stages nothing for this link leg (rules-7 §5.2). Staged, it is a 362 t hitless plan. No solver change is
  owed.
- **To the rules lane (L38):** the rules model `level_38` as one region, so the L39 door "reaches" the chest. On the game the cover
  splits the room, and the chest is reached only from the south room (the L37 door: page done, 324 t, 0 hits). That is a region split,
  or the chest's location needs the south room's region. I have not checked whether the AP logic ever routes the chest through L39.
- **To fidelity (optional, L63):** a darktrap body contact under the Dark Suit is refused by name (`byEnemy` undeclared for
  `darktrap`). That is the model surface the light arm's stance walk meets ON the snap. It decides nothing hitless here, because the
  stance itself is wrong.
- **Solver residue (L63, not fixed):**
  - `deriveLightPole` picked the stance (132,268), whose only corridor crosses its own target trap (`stanceReaches` passed it).
  - Its walk then slid into a pit without noticing. The next plan's refusal read as a blocked corridor, and the frontier went on to
    shove an unrelated block.
  - A refusal that names the fall would be clearer. This is message-only and was not built.
- **Census gaps:** the 21 boss-fight legs over 300 s were not measured ON (§7).
- **Rows ON in other files:** `fidelityL40Res` reads the same ON only because of the fallback. A flip should re-run the frontier files
  ON, as §5 did.
- **Not done:** no `standing-values --write`, no pytest, no unfiltered vitest, and no whole-game walk. No model file, `botDriverV*.js`,
  `flashPanel/*`, rules, AS3, wasm or gitlink was touched. The scratch captured requests (about 2 MB) are not committed; §3's sweep
  command regenerates them.
