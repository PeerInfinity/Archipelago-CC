# cloud-report — rules-k-exempt-entry (REPORT ONLY): **yes, rule K lets a player into a lavarunner's leash uncharged, through an exempt cell. The L77 traversal it prices is GAME NO, and a general sketch closes it with no looser row and the certifier at 1/16/0**

Branch `claude/rule-k-leash-entry-72cy4q`.
- **Base:** `origin/main` @ **`c1b250e6380746f579b509132868c0d7818de560`**: rule K + (b) `3c602f965d`, then three `train:` commits that do not touch the guard, the producers or the presets.
- **Second tree (read-only, measured only):** `origin/tile-pixel-pull-disc-choice-nits` @ **`52b76155ec6a5e63336e38fd8893aead3ce30399`**, merge-base `3c602f965d`, in a detached worktree. Nothing here depends on it.
- **Game:** wasm `seedling_bot_ap_p4g`, headless logic-only (`CHANNEL: … lost:1`). One fresh page per tape, damage on (`noDamage: false`, no hazard coerced).
- **Setup:** `session_bootstrap.sh --seedling` READY; the six submodules initialised; `minimal-spoilers`. No pointer moved.
- **Nothing committed** in rules, presets, atlas, tables, solver, levelRun, `CONTACT_FIDELITY`, level data or the engine closure. The sketch ran in a throwaway worktree and is not applied (`…-evidence/sketch/k-exempt-traversal.patch`).
- **No CI dispatch** (B1 not engaged). **No vitest run**: no code under test changed.

Evidence: `CC/docs/cloud-reports/rules-k-exempt-entry-evidence/` (`tools/`, `runs/`, `tapes/`, `sketch/`).

## Answer table

| # | question | verdict | witness / measurement | decided by |
|---|---|---|---|---|
| 1 | **Static census**, every guarded body, all levels | **34 exempt-in-zone hits on 8 levels** (L72–75, 77, 78, 80, 99): 28 TRAVERSE, 6 ARRIVE-AND-LEAVE. **Only 3 entry doorways reach an uncharged GOAL** (an exit or a location beyond their own doorway): **L74** landing (1,8) → the Darkshield; **L77** trap tile (6,12) → the L78 doorway; **L80** trap tile (5,6) → the L71 doorway. **(ii) unfollowed entry: 0 cells anywhere**, even with no filter | `runs/census-main.{json,txt}`, `runs/census-table.md` (`tools/kcensus.mjs`, the producer's own `KG.chaserGuardCells` inputs) | `chaserGuardCells`' `exempt.has(i) → continue` (`seedlingChaserPursuitGuard.js:217`) never charges an exempt cell, and nothing charges the step off it |
| 1′ | which presets' ROUTES show it (main) | **one route: L74 `L75 → Darkshield = FREE`** (all three presets). L77 and L80 stay row-level: the lift into each trap tile already costs the arm | `runs/base/routes-*.json`, `runs/hit-rows.txt` | the lifts `r2c0 → r12c6` (L77) and `r0c2 → r6c5` (L80) |
| 2a | **L77 TRAVERSE (6,12) → (6,19) → L78**, Suit alone | **GAME NO, 7 / 7 lines from (6,12)** (3–6 hits each, every line with 1–2 deaths). The suit-alone witness's 5 lines that enter (6,12) by the reel and go on: all hit | `runs/game/boot2/trav-612-*`, `runs/game/q2/trav-612-*`; `da0b87d7` `hand/q1-rev-K-*`, `pxcont/*` | `lavarunner@80,272` / `@112,256` on (6,13)–(6,16). E.g. `trav-612-down-b2`: t130 (6,15), runner at (92.3, 253.4), 8.3 px; t158 (6,15), (103.5, 249.2), 3.0 px; deaths t90, t180 |
| 2b | **L77 reverse** L78 → (6,18) → (6,12), Suit alone | **GAME YES, 1 line** (the suit-alone witness's 1b prefix, replayed on fresh pages here: east lava, reeled (8,12) → (6,12) at **t181**, **0 hits** to t230). Straight up column 6: GAME NO (mine 3 hits; theirs 6 and 4) | `runs/game/q2/rev-1b-cut{200,230}`, `rev-col6-up-to-612` | the timed east-lava weave; the trap's reel is harmless with the Suit (`LavaTrap.as:63-68`) |
| 2c | **L77 ARRIVE-AND-LEAVE at (6,19)**: L78 → r15c6 → L78 | **GAME YES, 4 / 4 lines**, 0 hits: out at t6, t16, t36, and the whole L78 → L77 (t7) → L78 (t20) loop | `runs/game/q2/al-619-*` | the runners need > 36 ticks to reach the doorway (nearest sampled 14.6 px at t31) |
| 3a | **L74 L75 → Darkshield** (FREE), item-less | **GAME NO, 4 / 4 lines.** The RUNNER hits on the one line that waits out the Bulb (`wait160`: t236 on (4,5), `lavarunner@24,56` at (63.3, 79.5), 8.8 px). The other three lines are hit by the **Bulb** (t25, t45, t58 on row 7) and die in lava after a knockback | `runs/game/q3/l74-75-darkshield-*` | the runner pins at (31.4, 73.1) only while the player stays at the landing (as seedling-fidelity-leash found); once the player walks north it unpins and catches |
| 3b | **L80 (5,6) → L71 door**, Suit alone | **GAME NO, 4 / 4 lines** (1, 1, 3 and 5 hits; 2 with deaths) | `runs/game/boot2/l80-*` | `lavarunner@80,32` and `@0,96` reach the player on (1,1), (3,6), (5,4), (4,4). E.g. `diag-b2`: t116 (1,1), runner at (34.7, 36.5), 9.8 px, beside the door |
| 3c | L72, L73, L75, L78 TRAVERSE hits | **UNWITNESSED, by design**: their uncharged flood reaches **no** exit or location beyond the entry's own doorway, so no row prices the uncharged walk. Every way to any goal from there steps on a cut cell (charged). A game hit inside cannot make a row looser | `runs/census-table.md` (goal column "—") | — |
| 4 | **Both trees** | **The census is identical** (34/34 hits, same classes and goals). **The routes differ at L77:** on the pull-disc branch, `L76 → L78 = Dark Suit \| Ghost Spear`, in all three presets. The branch's lift drops the Suit holder on (6,12), and the uncharged (6,12) → (6,19) traversal (2a: GAME NO) carries it to L78 | `runs/census-pulldisc.*`, `runs/pulldisc/routes-*.json` | the exempt traversal at (6,12) |
| 5 | **Sketch** (general: charge the step OFF an exempt cell into the leash) | **Only stricter.** Main: route walk **1 CHG** (L74 `L75 → Darkshield`: FREE → arm), **0 ADD, 0 DEL**, all three presets; rows 12 CHG, all STRICTER. Pull-disc branch: **2 CHG** (that one plus L77 `L76 → L78`: `Dark Suit` → `Dark Suit & arm`). **Certifier 1 / 16 / 0, vanilla and ER, arm `new`**, at base and with the patch, on both trees. Derived-rule table verdicts: 0 ADD / 0 DEL / 0 CHG. **engineMd5 unchanged:** main `74ae60f575531492ed9eaec1839e1fe3`; branch `82e5ca9e068525b1442bb2de23e0b768` | `runs/sketch/`, `runs/sketch-pulldisc/`, `sketch/k-exempt-traversal.patch` | — |

**The one thing to know.** The hole is real, and the code shows its shape: an exempt cell inside a zone is never charged, so a player who ENTERS the zone at one crosses no cut.
- It **bites** where the uncharged flood from the exempt cell reaches a goal. That happens at 3 doorways (L74, L77, L80), and all three are GAME NO on every line tried (4, 7 and 4 lines).
- On main, that shows in one route: L74's Darkshield from L75 (FREE in all three presets, GAME NO on 4 lines).
- At L77 it is row-level on main. It becomes route-level the moment a lift lands the Suit holder on (6,12) with the Suit alone, which is exactly what the pull-disc branch does.
- **Arrive-and-leave is sound where measured** (L77 (6,19), 4/4 YES).

## Q1 — the census

**Tool.** `tools/kcensus.mjs` does not model a zone:
- it copies the playthrough producer to a throwaway file beside it and injects one capture call before the producer's own `KG.stampChaserGuards(...)`;
- it builds every level's grid through `playthroughGridFor`;
- it then calls `KG.chaserGuardCells` itself on every captured body, with the producer's inputs: the K-measure grid, `tileTypes`, `centreOf`, `exempt`.

The kinds come from the producer's own three sources:
- **landing:** `arrivalTilesFor`;
- **door:** `doorTilesOf`;
- **trap:** `playthroughLavaTrapPulls(level).tile`.

For each exempt zone cell of each guarding body (after (b)), it records:
- **boundary:** the raw cut (`exempt` emptied) holds it;
- **flood:** the player's 4-step from it over the zone's UNCHARGED cells (zone minus the union of every guarding body's cut);
- **class:** TRAVERSE when the flood holds a non-exempt zone cell, else ARRIVE-AND-LEAVE;
- **uncharged goals:** atlas exit tiles and location tiles in the flood, outside the entry's own doorway (its exempt cells, 4-connected).

Gated cells crossed: only `hasDarkSuit` (lava/T), which the brief's player holds.

**The 34 hits** (`runs/census-table.md`; the same on the pull-disc branch):

| level | bodies | exempt cells in zone (kind) | class | uncharged goal beyond the doorway |
|---|---|---|---|---|
| L72 | `@80,216`, `@136,88` | (0,16) door, (1,16) landing+door; (11,1) landing+door | TRAVERSE | — |
| L73 | `@32,24` | (4,0) door, (4,1) landing+door | TRAVERSE | — |
| **L74** | **`@24,56`** | **(1,8) landing+door (interior), (1,9) door** | **TRAVERSE** | **loc `Level 074 - Darkshield` @ (3,2)** |
| L74 | `@208,96` | (18,8) landing+door (boundary) | ARRIVE-AND-LEAVE | — |
| L75 | `@104,64` | (4,0) door, (4,1) landing+door | TRAVERSE | — |
| **L77** | **`@80,272`, `@112,256`** | **(6,12) trap (interior)** | **TRAVERSE** | **exits `in_L78_256_0` @ (6,18), `out_teleporter_96_304` @ (6,19)** |
| L77 | both | (6,18) landing+door, (6,19) door | TRAVERSE (its flood reaches (6,12), not a goal) | — |
| L78 | `@144,72`, `@96,32`, `@56,120`, `@112,136` | (9,3) trap, (6,5) trap; (2,0) door, (2,1) landing+door | TRAVERSE | — |
| L78 | `@192,144`, `@144,72`, `@96,32`, `@112,136` | (9,6) trap | ARRIVE-AND-LEAVE | — |
| **L80** | **`@80,32`** | **(5,6) trap (interior)**; (2,0) door, (2,1) landing+door | **TRAVERSE** | **(5,6) → exits `in_L71_224_304`, `out_teleporter_32_0`** |
| L80 | `@0,96` | (2,1) landing+door, (5,6) trap (both on its boundary) | TRAVERSE / ARRIVE-AND-LEAVE | — |
| L99 | `@176,64` | (7,7) door (boundary) | ARRIVE-AND-LEAVE | — |

- L71's five runners guard a 9-cell pocket with an empty cut, and hold no exempt cell.
- **(ii) unfollowed entry: no cell, measured unfiltered.**
  - The census records `unfollowedAny`: every zone cell beside a player cell that is outside the zone and not `followed`, charged or not. It is empty for all 27 guarding bodies.
  - The reason: a lavarunner's flood (`bodyRegion`) covers the lava and the floor it walks. So every player cell next to a zone cell is in the region or adjacent to it, and that is `followed`'s definition (`:212`).
  - (ii) is a shape the code allows, but the delivered map never produces it. The sketch therefore does not charge it.

**The rows that use the three biting hits** (`runs/hit-rows.txt`; the same in all three presets on main):

```
L74  level_75__r0c4 -> level_74__r2c2  = FREE ; level_74__r2c2 : loc Level 074 - Darkshield = FREE
L77  level_77__r12c6 -> level_77__r15c6 = Dark Suit | Ghost Spear   (both directions)
     level_77__r2c0  -> level_77__r12c6 = Ghost Spear | Dark Suit & (Sword | Wand | Shield×2)   (the lift: charged)
L80  level_80__r6c5 -> level_80__r0c2  = Dark Suit   (both directions; r0c2 holds the L71 doorway)
     level_80__r0c2 -> level_80__r8c1  = Dark Suit & arm   (the chest side: charged)
```

**Route walk on main** (`tools/routeWalk.py`, the pursuit-resume slice's walker; `runs/base/routes-*.json`):
- `L75 → L74 ⇒ Darkshield = FREE` and `L75 → L74 ⇒ exit L75 = FREE` (the latter is arrive-and-leave).
- L77: `L76 → L78` = `Ghost Spear | Dark Suit & (Sword|Wand|Shield×2)`; L78 → L76 is the same.
- L80: every goal costs `Dark Suit & arm`.

## Q2 — the game at L77 (Suit alone, damage on, fresh page per tape)

**Sibling evidence read first.** The running witness had reported: `claude/l77-dark-suit-witness-jo1yfp` @ `da0b87d7`, `cloud-report-rules-l77-suit-alone-witness.md`. Its tapes for this column are reused here, and its tools (`w77.mjs`, `chase/`) are copied into `tools/`.
- **What it found:** Suit alone crosses L77 GAME YES both ways, by a narrow timed lava dodge.
  - 1a (L76 → L78) avoids the trap.
  - 1b (L78 → L76) is reeled (8,12) → (6,12) at t181 and goes on west.
- **Every line that walks column 6 between (6,12) and (6,18) is hit.**

**My harness** is `tools/kw.mjs`: `w77.mjs` plus one addition, a polled `botMobiles` + `botStatus` trace during the main play. It records every sampled runner position with its game tick (`bodyTrace` in each `*.game.json`, 20–124 samples per tape), and the closest approach.
- Contacts are bisected on truncated fresh-page replays, as in `w77.mjs`. Each contact row names the two nearest bodies and their positions.
- ⚠ **Boot offset:** a tape's `boot` (x, y) shows in the game trace at (x+8, y+8). Arrival boots use the door's `playerx`/`playery`, as the game does.
  - My first TRAVERSE batch, booted at (97,200), therefore started on **(6,13)**, one tile south of the trap tile (`runs/game/q2/trav-612-*`). That tile is in the zone, uncharged, and in (6,12)'s flood. Those lines are kept as evidence, but they are not "entered AT the exempt cell".
  - The `boot2` batch (`runs/game/boot2/`) boots at (89,192), so the game places the player at the reel's release point (97,200) on (6,12).

### 2a — TRAVERSE (6,12) → (6,19) → L78

**`boot2`: entered AT (6,12)**, at the reel's release point (97,200). **GAME NO on all 7 lines** (`runs/boot2-rows.txt`):

| line | hits / deaths | contacts (tick, player tile, nearest runner at (x, y), distance) |
|---|---|---|
| `trav-612-down-b2` (straight down) | 4 / 2 | t130 (6,15) (92.3, 253.4) 8.3 px; t158 (6,15) (103.5, 249.2) 3.0; deaths t90, t180 on (6,15), runner 0.9 px |
| `trav-612-east-down-b2` (east side) | 6 / 2 | t49 (6,15) (102.0, 254.0) 6.4; t68 (6,16) (114.1, 262.1) 7.0; t130, t157 (6,15); deaths t90, t180 |
| `trav-612-west-down-b2` (west side) | 5 / 1 | t49 (5,14) (88.1, 248.3) 9.2; t80 (5,15) (88.3, 242.6) 2.4; t149, t179 (6,15); death t112 (5,16) |
| `trav-612-wait60-down-b2` (stand 60, then down) | 4 / 2 | t180 (6,15) (92.3, 253.5) 9.5; t209 (6,15) (103.5, 249.2) 3.0; deaths t141 (5,14), t231 |
| `trav-612-wait150-down-b2` (stand 150, then down) | 4 / 2 | t190 (6,15) (93.4, 252.4) 6.8; t209 (6,15) (105.9, 244.0) 2.8; deaths t231 (5,14), t321 |
| `trav-612-westlava-b2` (west lava field) | 4 / 1 | t133 (2,16) (41.4, 258.9) 7.9; t167 (2,17) (40.1, 279.9) 4.2; t268 (6,15); death t231 (4,19) |
| `trav-612-eastlava-b2` (east lava) | 3 / 1 | re-reeled (7,13) → (6,12) at t178; t187 (6,13) (104.5, 216.2) 5.6; t216 (5,13) (93.2, 215.3) 1.8; death t272 (4,15) |

- Both runners leave their spawns and come up the column to the player, in every line: the samples show them on (5,13)–(6,15).
- Standing still on (6,12) does not help (`wait60`, `wait150`): they arrive and wait at (5–6,14–15).

**First batch (start (6,13), one tile south of the trap tile): GAME NO on all 6 lines that reach the column** (`runs/q2-rows.txt`):

| line | hits / deaths | contacts (tick, player tile, nearest runner at (x, y), distance) |
|---|---|---|
| `trav-612-down` | 4 / 2 | t125 (6,15) runner (96.9, 255.2) 9.8 px; t145 (6,16) (112.2, 262.1) 3.4; deaths t89, t178 on (6,16), runner 3.4 / 0.8 px |
| `trav-612-west-down` | 2 / 2 | deaths t87 (6,17), t176 (6,16) runner (112.1, 264.3) 1.5 px |
| `trav-612-wait60-down` | 2 / 0 | t71 (6,13) runner (97.8, 230.3) 12.1; t102 (7,13) (105.7, 220.8) 6.6: the runner came up the column to the player |
| `trav-612-wait150-down` | 2 / 2 | reeled onto (6,12) at t85; then deaths t225 (6,15), t314 (6,16) runner (112.3, 265.0) 2.2 px |
| `trav-612-westlava` | 6 / 2 | t166 (6,15), t195 (6,16), t266, t286; deaths t129 (3,15) runner (53.5, 239.9) 7.8 px, t229 (8,16) |
| `trav-612-eastlava` | 3 / 1 | t250 (6,15), t270 (6,16); death t215 (8,16) runner (140.1, 263.5) 5.4 |
| `trav-612-east-down` | 0 / 0 | **not a crossing**: stopped on wall (7,14) at (113.6, 221), never reached the door |

**Sibling lines that ENTER (6,12) by the reel and go on** (`da0b87d7`, `runs/summary.txt`), all GAME NO:
- `hand/q1-rev-K-4-12-col6-west`: 3 hits, death; t480 (6,15) 9.6 px, t510 (6,15) 1.1 px.
- `hand/q1-rev-K-4-12-col6-east`: 1 hit at t508 (7,13).
- `hand/q1-rev-K-7-11-col6`: 3 hits, death; t442, t468 (5,14).
- `pxcont/q1-px-reel-then-beam-w21` and `-w23`: 3 hits, death each; t543 (6,14), t606–608 (3,14).

**Why** (source, as the sibling report cites):
- The lavarunners out-run the player, walk 1.5 / swim 1.0 against 1.17 / 0.45 (`LavaRunner.as:17-18,40`). They home inside `runRange` 80 (`Bob.as:55-69`).
- Column 6 is one tile wide between walls (7,14), (7,15) and (5,18), (5,19), with both spawns beside it ((5,17), (7,16)).
- A player standing on (6,12) is 56–72 px from them and on screen, so they come.
- The Suit does not protect from them (`Player.as:1381-1386`).

### 2b — reverse L78 → (6,18) → (6,12)

- **GAME YES** on one line: `rev-1b-cut200` and `rev-1b-cut230` (the 1b tape cut after its reel).
  - Path: (6,18) → (7,18) → (8,18) → (8,17) → (9,16) … (8,12), reeled onto (6,12) at **t181**, on to (4,11) at t216, **0 hits**.
  - Closest runner: 9.4 px at t57, on (8,18).
- **GAME NO** straight up the column: `rev-col6-up-to-612`, 3 hits and a death (t76 (6,17) runner (95.8, 281.8) 8.4 px; t99 (7,17) (118.0, 273.1) 1.1 px). The sibling's `q1-fwd-col6-up-west` (6 hits) and `-east` (4 hits) agree.
- The reverse reaches (6,12) only by a weave through the lava that K's zone also covers. It is not a column walk.

### 2c — ARRIVE-AND-LEAVE at (6,19)

| line | out to L78 | hits | closest runner (tick, distance) |
|---|---|---|---|
| `al-619-now` (land (6,18), down at once) | t6 | 0 | t0, 22.6 px (both still at spawn) |
| `al-619-wait10` | t16 | 0 | t10, 18.1 px |
| `al-619-wait30` | t36 | 0 | t31, 14.6 px |
| `al-619-from78` (boot L78 (256,16), up into its door, land L77 (6,18) at t7, down) | **L78 again at t20** | 0 | t13, 18.7 px |

**GAME YES.** `exempt` is sound here for arrive-and-leave: the doorway pair is left before either runner closes.

## Q3 — the other TRAVERSE hits

### 3a — L74 `L75 → Darkshield` (FREE in all three presets): GAME NO, item-less

Boot (16,128), the L75 door's `playerx`/`playery` (trace (24,136), (1,8)).

| line | hits / deaths | contacts |
|---|---|---|
| `l74-75-darkshield-now` | 4 / 2 | t25, t45 on (2,7) by **`Bulb`** (46.2, 118.8) 10.2 px; the runner at (30.9, 73.1), 41 px; deaths on (1,6) (lava, after the knockback) |
| `…-wait40` | 4 / 3 | t58 (1,7) Bulb 10.8 px; lava deaths on (1,6) |
| `…-wait160` | 2 / 1 | **t236 (4,5) `lavarunner@24,56` at (63.3, 79.5), 8.8 px**: it left its pin when the player walked north; death t328 on (5,1) |
| `…-west` (column 1 north) | 1 / 1 | lava death on (1,6) at t53 (my line steps into lava: an authoring miss, not a body) |

- **The K-relevant point.** `lavarunner@24,56` pins on (2,5)'s corner while the player stands on the landing (seedling-fidelity-leash's witness `leash-l74-629-pin-lavarunner`). It **reaches the player as soon as the player walks toward the Darkshield** (`wait160`).
- So the uncharged (1,8) → (3,2) traversal is not one the game grants.
- The **Bulb** (`bulb@48,112`, not a K body) hits three of the lines. That is a second, separate reason the FREE row is unsound for an item-less player; it is out of K's scope and named here only.
- **Not witnessed:** a Bulb-drowning lure followed by the walk. The solver's leg 629 solves it only with a sword kill (seedling-fidelity-leash).

### 3b — L80 (5,6) → the L71 doorway, Suit alone: GAME NO, 4 / 4

Booted at (73,96), so the game places the player at (81,104) on the trap tile (5,6), the release offset the L77 reel shows (`runs/boot2-rows.txt`).

| line | hits / deaths | contacts |
|---|---|---|
| `l80-612-door-diag-b2` (NW through the lava) | 1 / 0, door not reached | t116 (1,1) runner at (34.7, 36.5), 9.8 px (`@80,32`, now beside the door) |
| `l80-612-door-west-b2` (west, then north) | 1 / 0, door not reached | t45 (3,6) runner at (41.2, 103.9), 7.8 px (`@0,96`); re-reeled (3,6) → (5,6) at t55 |
| `l80-612-door-north-b2` | 3 / 1 | t41 (5,4) (84.7, 71.0) 6.4; t71 (4,4) (77.3, 75.1) 8.8; death t102 (3,3) |
| `l80-612-door-wait60-b2` | 5 / 1 | t71 (4,6) (62.9, 103.3) 5.5; t99 (3,6) 0.5; t173, t201 (5,4); death t132 (3,6) |

- Two runners guard this: `@80,32` homes on any line north, and `@0,96` on any line west.
- ⚠ **A first batch booted at (81,104) is not a crossing** (`runs/game/q3/l80-*`, `runs/q3-rows.txt`). The +8 offset put the player on (5,7), below the trap tile, where it never left in 160–220 ticks. It is kept as evidence only.

### 3c — UNWITNESSED by design

The remaining TRAVERSE hits (L72, L73, L75, L78, and L80's (2,1) doorway) flood into their zone uncharged, but they reach **no** exit or location beyond the entry's own doorway (`runs/census-table.md`). Every goal from there costs a cut cell. They decide no row, so a game hit inside cannot make one looser. They are not witnessed.

## Q4 — the two trees

| | main `c1b250e638` | `tile-pixel-pull-disc-choice-nits` `52b76155ec` |
|---|---|---|
| census | 34 hits (`runs/census-main.*`) | the same 34, same classes and goals (`runs/census-pulldisc.*`; the only text difference is L78 (9,3)'s flood listing sub-region `r1c10`, a naming change) |
| route L76 → L78 | `Ghost Spear \| Dark Suit & (Sword\|Wand\|Shield×2)` | **`Dark Suit \| Ghost Spear`**: the only route the branch moves (all three presets, `runs/pulldisc/routes-*.json`) |
| route L75 → Darkshield | FREE | FREE |
| certifier, arm `new` | 1 / 16 / 0 vanilla and ER | 1 / 16 / 0 vanilla and ER |
| engineMd5 | `74ae60f575531492ed9eaec1839e1fe3` | `82e5ca9e068525b1442bb2de23e0b768` (the branch edits `tileStep.js` and others in the closure) |

- **The interaction.** The branch's line-cut pull disc lets the reel from (4,11)'s sliver lift a Suit holder onto (6,12) for the Dark Suit alone. K's exempt (6,12) then carries the holder down column 6 uncharged.
- That traversal is **GAME NO** (2a). So the branch's `Dark Suit` for L76 → L78 is derived through a line the game refuses.
- The ROUTE's answer happens to match the game: the sibling's 1a crosses with the Suit alone by a different line, avoiding the trap and dodging through the west lava.
- A K fix and that branch must land together or be measured together. With the sketch, the branch's L76 → L78 goes back to main's charge (Q5), which is the known over-charge against 1a (the sibling's report, ⚖ Robert's call there).

## Q5 — the sketch (throwaway; `sketch/k-exempt-traversal.patch`; reverted: it lived only in `/home/user/wt-sketch` and the pull-disc worktree)

**The rule (general, no level literal):**
- An exempt cell stays uncharged: arriving there, or leaving by the same exempt doorway, is not a crossing (2c).
- **The step off it into the leash is charged:** every non-exempt zone cell 4-adjacent to an exempt zone cell joins the cut.
- It reads only `zone`, `exempt` and the grid. It only ADDS cut cells, so it cannot loosen a row.
- The unfollowed-entry shape is not charged: the census shows it never occurs.

```js
for (const i of zone) {
    if (!exempt.has(i)) continue;
    for (const n of neighbours(i, width, height)) if (zone.has(n) && !exempt.has(n) && player(n)) cut.add(n);
}
```

**The run.** The producers ran by `REGEN_RECIPE`'s order in a throwaway worktree (`tools/sketch-regen.sh`):
1. pass 1 with the committed table aside;
2. `probe-seedling-derived-rules.mjs --shards=2`, locally, for the table;
3. pass 2: rules, partition, maze, ER;
4. the certifier, then the engine closure.

Seed 1 and the world package were not run. At base, the same probe locally reproduces the committed table exactly (`runs/sketch/table-diff.txt`).

| measurement | main: base → sketch | pull-disc branch: tip → sketch |
|---|---|---|
| route walk, AP_1 / ER / maze | **1 CHG, 0 ADD, 0 DEL** in each: `L75 → L74 ⇒ Darkshield`: FREE → `Ghost Spear \| Shield×2 \| Sword \| Wand` | **2 CHG** in each: that one, and `L76 → L78`: `Dark Suit \| Ghost Spear` → `Ghost Spear \| Dark Suit & (Sword\|Wand\|Shield×2)` |
| rows (sub-region level) | 92 ADD / 6 DEL / **12 CHG, all STRICTER** (the ADD/DEL are the new sub-region splits, e.g. L72's landing `r16c0`; the route walk folds them) | 92 / 6 / **11 CHG, all STRICTER** |
| levels touched | L71 (the L72 arrival's new sub-region name), 72, 73, 74, 75, 77, 78, 80 | the same |
| certifier `--arms=new`, vanilla / ER | **1 / 16 / 0 → 1 / 16 / 0** (both; the one problem is the standing L63 row) | **1 / 16 / 0 → 1 / 16 / 0** |
| derived-rule table | 99 rows, 6 exclusions → **0 ADD / 0 DEL / 0 CHG** (only `inputs.payloadMd5` moves) | 99 rows → the same count |
| engineMd5 | `74ae60f5…` → **`74ae60f5…`** | `82e5ca9e…` → **`82e5ca9e…`** |

Files: `runs/sketch/{base,patch}/`, `route-diff-main-*.txt`, `row-diff-main-*.txt`; `runs/sketch-pulldisc/{base,patch}/`, `route-diff-*.txt`, `row-diff-*.txt`.

**What the sketch costs.**
- **L74 Darkshield from L75:** FREE → arm. The game agrees an item-less player is caught (3a).
- **L77 r12c6 ↔ r15c6:** `Dark Suit` drops out. The game agrees for the column (2a). The reverse YES (2b) reaches (6,12) by a lava weave, and that weave already crosses K's cut cells, so it was never K-free.
- **L80 r6c5 ↔ r0c2:** `Dark Suit` → `Dark Suit & arm`. The game agrees (3b: 4/4 hit).
- **L72/L73/L75/L78 sub-region rows** (charged already at route level): no route moves.
- **Not affected:** an arrive-and-leave doorway (2c YES) keeps its free exit, because the doorway's own exempt cells stay uncharged.

## Stops checked

- **No change** to any rule, preset, atlas, table, solver, levelRun, `CONTACT_FIDELITY`, level data or engine closure. The diff is this report and its evidence directory only.
- **No edit** to `worlds/seedling/`, `vendor/seedling`, `.github/` or a submodule pointer.
- **The sketch makes no row looser:** route walk 0 LOOSER, row diff 0 LOOSER, on both trees.
- No CI dispatch. No vitest.
