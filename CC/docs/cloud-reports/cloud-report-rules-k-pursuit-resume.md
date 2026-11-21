# cloud-report — rules-k-pursuit-resume: rule K + (b) re-recorded on the line-cut pull disc — **DONE; certifier 1/16/0 both arms; FINDINGS for the planner: a 16th mover (L77 L76→L78), L99's split, the (11,4) west edge, calib flags on three moved levels**

Branch `claude/rules-k-pursuit-resume-ldr2yl`.
- **K's tip:** `origin/claude/rules-k-pursuit-speed-0s83t8` @ **`b66f327267461e4877e369105c6c8a6a23c41fa6`**.
- **Main merged ("before" for every comparison here):** `origin/main` @ **`11ca7efeca6fe33b74e6645ee2e4bcf67dbc8117`** (it carries the pull-disc fix).
- Merge commit `b59e75c9`: **no conflict**. One semantic fix after it (`1aae7719`, below).

**Setup.** `session_bootstrap.sh --seedling` reached READY. The six submodules are initialised; no pointer moved.
Host settings: `minimal-spoilers`. Base measurements ran in a worktree at `11ca7efeca` on the same box.

Evidence: `CC/docs/cloud-reports/rules-k-pursuit-resume-evidence/` (`runs/`, `tools/`).

## Answer

| question | result |
|---|---|
| Merge (What 1) | **DONE**, no conflict. K's code read the old API: its exemption set called `OV.lavaTrapPulls(level, TILE)` without `solid`, which main now refuses. `1aae7719` makes it read the ONE disc (`playthroughLavaTrapPulls`); it needs only the trap tiles, so nothing is re-cut or bypassed |
| Re-record by recipe (What 2) | **DONE.** Pass 1 with the stale table aside (`e129b09e`), the table by REGEN_RECIPE at that commit (`1c4ba85a`), pass 2 with the new table (`971500cd`). `regen-seedling --check`: every step OK except `census`, whose only FAIL is the frontier `sources` md5, set by hand (`db17873e → 51023885`). `atlas_files.json` re-stamped `seedling-ea1ef5ba → seedling-b856f0fc`. `generate-procgen-reference`: no change. `preset_files.json`: unchanged (the chain restores the newline) |
| **Certifier (What 3, term 3)** | **1 / 16 / 0 at base and tip, vanilla and `--source=er --arms=new`** (OPEN_L63 only). The two L78 r6c11 rows that STOPPED K now **derive**: `r0c16 → r6c11 = [[Ghost Spear], [Progressive Sword], [Wand], [Progressive Shield ×2]]`, suit-less, as the pull-line report predicted |
| engineMd5 (term 3) | `bec369878feb67081187edca62baa951` (42 files) at base and tip |
| Derived-rule table (term 4) | 106 → 99 rows, 50 → 47 regions, exclusions (6) equal. DEL the 7 K-level rows (L72 ×2, L74 ×3, L75 ×2). L98's row is RENAME-ONLY (`level_99__r2c7 → level_99__r7c5`, equal under the map: **True**). `composedDisagrees` = 0 (the producers' `--check` holds it). 16 pinned counts re-pinned in `seedling-derived-rules-expected.json`, each with its reason |
| Seed 1 (term 5) | **Every sphere's LOCATIONS unchanged; `_Spoiler.txt` byte-identical.** The sphere log moves only `new_accessible_regions` NAMES, in spheres 68, 75 and 77 (verbatim below) |
| ER draw (term 5) | **Kept.** The same 50 placements (equal under the L99 rename); the producer reports `0 unbeatable` |
| Maze key walk (term 2) | **Only L71–75, 77, 78, 80, 98, 99** (maze 1323 paths, AP_1 487, plus the atlas-id stamp and the sphere-log region names). ER also names L40/L43, and each of those 7 paths is the L99 stairs rename inside the shuffled pairing. **L80's lift-from-gated rewiring is NAMED** (§ L80) |
| Two-grid split (term 1) | K rides `guards:false` exactly as T does. **No K level holds a pushable block**, and **0** changed maze paths name a block or push. No gated cell lies on a block's path |
| Movers (What 5) | **16 routes, identical in AP_1, `seedling_er` and the maze.** These are the stopped slice's 15 plus **L77 L76→L78**: **FINDING 1** (below). Every one is stricter than main; none is looser. No r6c11 row is an AP route (r6c11 is internal to L78). The L34/L65 table-aside artifacts are **gone** |
| **L78 (11,4) with the Dark Suit (What 4)** | **FINDING 4 (not a STOP): the only GAME YES Dark Suit lines through (11,4) avoid its west part.** K's whole route from r0c16, holding the Dark Suit, reaches (11,6) **not reeled** on 4 lines, with (11,4) crossed at x ≥ 180.05. 2 lines that slide on to x ≈ 176 on y = 72 **are reeled** onto (9,3) at t24–28 |
| Calib (term 3) | **3 flags, all on moved K levels.** The compare FAILS as run: L77 2.10×, L78 3.91×, L80 2.96× normalised (control 159/301/208 ms → tip 335/1182/618 ms). `--expect-flag=level_77,level_78,level_80`: PASS, exactly those. No unmoved level is flagged (reference median 1.005 over 34 levels, spread 0.876–1.413). Both runs pass every level, and the heaviest test (L40, 452.6 s vs 454.7 s at base) keeps 49.7 % of the 900 s `testTimeout`. The growth is the K split's data (L78 8 → 12 sub-regions, 35 → 71 rows); engineMd5 is unchanged. **Planner's call** whether term 3 wants PASS on moved levels |
| Bounded vitest | **green: 203 files / 3498 tests**, plus a second batch of **44 files / 1264 tests** (every other non-slow test naming a K level). The brief's 15 named files are all in batch 1 (§ Bounded vitest) |
| `deriveLevelWorldLogic.pullDiscNit.test.js` and its fixture | **untouched**, green (What 8) |
| L99 (**FINDING 2**) | It is not a pure rename. K guards L99's three lavarunners, so L99's lower floor splits (r2c7 / r6c12 / r7c5 / r8c10, every internal row being the kill arm). **No L99 route moves**, and the AP row L98 → L99 is rename-equal (§ L99) |
| `old` certifier arm (not a binding term) | **FINDING 3**: one L78 row more than at base, `r5c6 → r6c9 holding [Dark Suit]: derived true, atlas false`. The atlas is STRICTER there; it is not a looser rule (§ Finding 3) |

## Commits

1. `b59e75c9`: merge of `origin/main` 11ca7efeca (no conflict).
2. `1aae7719`: K's exemption reads the one pull disc.
3. `e129b09e`: re-record pass 1 (derived-rule table aside).
4. `1c4ba85a`: the derived-rule table (local probe, `GITHUB_SHA=e129b09e53 … --shards=2`) and the count pin.
5. `971500cd`: re-record pass 2, the frontier md5, `atlas_files.json`, and the atlas-id pins.
6. `7eb2e90f`: the pins K's re-record moves (18 test files and the divergence leg-key fixture).
7. `41465b057f`: evidence and tools.
8. This report.

## FINDING 1 — the 16th mover, L77 L76→L78, is K's own charge, no longer masked by a pull through a wall

| | base (main 11ca7efeca) | tip |
|---|---|---|
| L77 L76→L78 | `Dark Suit` \| `Ghost Spear` | `Ghost Spear` \| `Dark Suit & (Sword \| Wand \| Shield ×2)` |

**What the stopped slice said.** It counted 15 movers. It said L76→L78 composes to T's rule unchanged.

**Why that held then.** On the stopped sketch's atlas, L77's lift `r2c0 → r12c6` cost the **Dark Suit alone**. It left from (6,10), which the UNCUT disc of trap (6,12) held. That reel crosses the wall at (6,11). The pull-line slice cut (6,10) out of the disc, and witnessed in the game that (6,10) is **not pulled** (GAME YES, `L77-6-10-*`, 0 reels).

**Why it moves now.** With the cut disc, every way from r2c0 into (6,12)'s disc steps on (4,12) or (7,11). Both are K∧T cells (`runs/L77-grid-tip.txt`: `X`). So the lift costs `And(Dark Suit, arm)` (`applyLavaTrapPulls`' lift-from-gated rule). The tip atlas reads `r2c0 → r12c6 = And(Dark Suit, Or(Sword, Spear, Wand, Shield ×2))`, and the sketch read `Dark Suit`.

**Where it sits.** It is in the narrowing report's (b) column. That column has 16 routes: the L72, L73-Dark-Suit, L74, L75, L77 (both ways), L78-Dark-Suit and L80 rows (`b48f397863` § "The 16 routes (b) moves"). This slice's 16 are the same rows, by level and count. It also matches its mirror, L78→L76, which both the stopped slice and this tip charge `Dark Suit & arm | Ghost Spear`.

**GAME.**
- L77's runners are a real fault: L78→L76 is GAME NO item-less, hit at t15–37.
- L76→L78 item-less is decided by T (the trap kills, t32).
- **L76→L78 holding only the Dark Suit is UNWITNESSED.**
- The rule is stricter than main, never looser.

**Not a STOP in my reading, but the planner's call.** The brief listed the expected movers as "the stopped slice's 15 … plus whatever the r6c11 rows now derive". This is a 16th mover. It is not caused by r6c11. It is caused by the merged pull-disc fix removing a game-impossible reel.

## FINDING 2 — L99: K's split, AP-equivalent

- **The guards.** K guards `lavarunner@192,64`, `@160,32` and `@176,64` on L99 (`runs/k-guards-by-level.txt`). These are the kill-lock census's three runners, with the census arm `Or(Sword, Spear, Wand, Shield ×2)`.
- **The split.** At base, the lower floor was one sub-region, r2c7. At tip it is four: r2c7, r6c12, r7c5 (the L98 stairs landing) and r8c10. Every row between them is that arm.
- **The kill-lock event moves sub-region.** `L99 flag 0: lock@80,96 cleared` moves from r2c7 to r7c5, on the same floor. Its location name is unchanged.
- **The pocket.** Its crossing `r2c4 → r7c5` still asks for that event plus the weapon.
- **Why no AP route moves.** The L98 stairs already charge that arm (`seedlingKillLocks`: "L98 → L99 costs the room's kill"). The route walk has no L99 line in any preset, and the table's L98 row is equal under the map.
- **What is not identical.** The maze's L99 world is not byte-identical under a rename: it carries K's stamped cells. The maze's L98 leaf is identical under the map.
- **Why named.** The designer's term 2 calls L98/L99 "renames", so this is named rather than hidden.

## FINDING 3 — `old` arm only: L78 r5c6 → r6c9 holding [Dark Suit]: derived true, atlas false

- **Scope.** The binding arms (vanilla `new`, ER `new`) are 1/16/0. The legacy `old` arm goes 9/13/0 → 10/27/0. The +14 accepted are K-split pairs, L72 (12) and L80 (2), all accepted. The +1 problem is this row.
- **What the atlas says.** The row is stricter in the atlas than in the maze, `And(K arm, …) ∨ Spear` vs `Dark Suit ∨ Spear`. It is an over-charge, never a looser rule.
- **The cause** (`tools/l78cells.mjs`):
  - r5c6 is trap (6,5)'s own tile.
  - The maze walks (6,5) → (6,6) → (7,6) on T-only cells. (7,6) is in both discs, so the step is reeled onto (9,6) = r6c9.
  - The atlas's lift leaves only from a sub-region ADJACENT to the reeling cell. (6,5) is diagonal to (7,6), so the only lifts into r6c9 cost K's arm.
- **Base.** The same maze line `r5c6>r6c9=[["Dark Suit"],["Ghost Spear"]]` is unchanged from base. The atlas at base agreed: `Dark Suit | Spear`, via cells K now gates.
- **GAME: UNWITNESSED.** Named for the planner as a possible new over-charge from the one-step lift model.

## What 4 — L78 (11,4), the corner pull, with the Dark Suit

Tool: `tools/k-route-witness.mjs`, built on the pull-line slice's `pull-line-witness.mjs`.
- **Setup.** p4g, headless logic-only, the delivered set, the Dark Suit granted, `noDamage`. The question is the PULL; the runners' contact is K's arm, which the narrowing report witnessed.
- **Evidence.** Tapes in `runs/witness/*.tape.json`; per-tick game positions in `*.game.json.gz`; the rows in `runs/witness/witness.log`. Each arm is a fresh page.
- **The route.** K's route is `runs/L78-route-r0c16-r6c11.txt`: (16,1) ↓ (16,4) ← along row 4 ← (11,4) ↓ (11,5) ↓ (11,6).

| arm | (11,4) crossed at x | closest to (9,3)'s centre | reeled onto | reaches (11,6) | hits |
|---|---|---|---|---|---|
| `L78-K-route-r0c16-to-r6c11-centre` (left 69) | 180.05–191.15, y 74.1 | 33.38 px (t121) | **none** | t141 | 0 |
| `…-left71` | 180.05–191.15 | 33.38 px | **none** | t143 | 0 |
| `…-left66` | 183.65–191.15 | 36.46 px | **none** | t138 | 0 |
| `…-left64` | 187.10–191.15 | 39.49 px | **none** | t136 | 0 |
| `L78-K-11-4-tap-from-12-4` (boot (12,4), left 8) | 187.5–191 | 38.94 px | **none** | t39 | 0 |
| `L78-K-11-4-centre-from-12-4` (boot (12,4), left 14) | slid to 176.75, y 72 | 7.85 px | **(9,3) at t24–28** | no | 0 |
| `L78-K-11-4-west-edge-from-12-4` (left 19) | slid to 176.15, y 72 | 7.66 px | **(9,3) at t24–28** | no | 0 |

**What decides it** (`LavaTrap.as:81-88`): the trap measures `FP.distance` from its own position to the player's, floored, against `chompRange` 32, on a clear line.
- On K's route the walk west comes down column 16 and runs row 4 at y ≈ 74.1. A solid stops it at x = 180.05 (left 69 and left 71 stop at the same x). Its nearest point to (152,56) is 33.38 px: **outside** the reach, by 1.38 px.
- Booted at the row's centre line (y = 72), a 14-tick press slides on to x ≈ 176. That point is 29–30 px from the trap, and the game reels it.
- So a Dark Suit holder walks K's route through (11,4) **unreeled when the line stays at x ≥ 180**. One who drifts into (11,4)'s west part at y ≈ 72 is reeled onto (9,3).

**Verdict.**
- The maze's tile-centre disc says (11,4) is never reeled, so it grants both lines. The game refuses the west-edge line and allows the K route's own line.
- Not every Suit line through (11,4) is reeled, so this is **not a STOP**. Per What 4, it is a **FINDING**: the GAME YES line avoids the west edge, with a 1.38 px margin on the route as walked.
- The disc was **not** widened to pixel level here (one-source rule; its own slice).
- The suit-less sets K derives for r6c11 (`[Ghost Spear]`, `[Progressive Sword]`, `[Wand]`, `[Progressive Shield ×2]`) hold no suit, so no reel applies. They were **not** game-witnessed in this slice, so they are UNWITNESSED, and so is runner contact on that route.

## Movers (What 5): the 16 routes, base = main 11ca7efeca

`runs/route-diff-{seedling_playthrough,seedling_er,seedling_playthrough_maze}.txt` (`tools/routeWalk.py`, the stopped slice's walker). The three are identical.

| route | base | tip | in the stopped slice's 15? |
|---|---|---|---|
| L72 L71→L73, L73→L71 | FREE | Ghost Spear \| Shield×2 \| Sword \| Wand | yes |
| L73 L72→L74, L74→L72 | Dark Suit \| Ghost Spear \| Sword | Dark Suit&Shield×2 \| Dark Suit&Wand \| Ghost Spear \| Sword | yes |
| L74 L73→L75, L73→Darkshield, L75→L73 | FREE | the arm | yes |
| L75 L71→L74, L74→L71 | FREE | the arm | yes |
| L77 L78→L76 | Dark Suit \| Ghost Spear | Dark Suit&Shield×2 \| Dark Suit&Sword \| Dark Suit&Wand \| Ghost Spear | yes |
| **L77 L76→L78** | Dark Suit \| Ghost Spear | as L78→L76 | **no: FINDING 1** |
| L78 L77→L79, L79→L77 | Dark Suit \| Ghost Spear | as L77 L78→L76 | yes |
| L80 chest from L71, chest from L79, L79→L71 | Dark Suit | Dark Suit & the arm | yes |

- **No route is looser.** No route outside L72–L80 moves.
- **The L34/L65 maze changes** the stopped slice called table-aside artifacts: **gone**. The maze key walk names neither level.

## Per row: GAME verdict and K's arm (the narrowing report's witnesses, not re-witnessed)

K's arm is the kill-lock census arm on every row:
- `KILL_ARM_CONDITION` = `Or(Progressive Sword, Ghost Spear, Wand, Progressive Shield ×2)`;
- `KILL_LOCK_BODY_CLASSES.lavarunner` (`LavaRunner.as:38,41`).

The only guarding class is the lavarunner. Every puncher and drill is dropped by (b) (`runs/k-guards-by-level.txt`: L12, L26, L28, L40, L53, L88, L91).

| row | GAME | witness | arm vs the witness |
|---|---|---|---|
| L72 L71→L73, item-less | **GAME NO** | hit t35 | charged ✔ |
| L72 L73→L71, item-less | UNWITNESSED | — | charged |
| L72 Dark Suit alone, both ways | **GAME YES** | `beam/L72-71to73-suit`, `-73to71-suit`, t376, 0 hits | known over-charge, KEPT (⚖ Robert) |
| L73 L72↔L74, Dark Suit | GAME NO | attempts t43, t117 | charged ✔ |
| L74 L73→L75 and the Darkshield | GAME NO | attempt t81 | charged ✔ |
| L74 L75→L73 | UNWITNESSED | a bulb hits | charged |
| L75 L74→L71, item-less | **GAME YES** | `movers/L75-74to71`, t216 (the two-runner jam) | known over-charge, KEPT (⚖ Robert) |
| L75 L71→L74 | UNWITNESSED | grenade blast t66 | charged |
| L77 L78→L76 | GAME NO item-less | t15–37 | charged ✔ |
| L77 L76→L78 | item-less: T decides it (trap kills, t32); **Dark Suit alone: UNWITNESSED** | — | charged: FINDING 1 |
| L78 L77↔L79, Dark Suit | GAME NO | attempts t212, t57 | charged ✔ |
| L78 r0c16 → r6c11 (internal), Dark Suit, along K's route | **GAME YES** for the pull (x ≥ 180: not reeled, 4 lines); **GAME NO** for the pull at x ≈ 176 (reeled onto (9,3)) | `runs/witness/L78-K-*`, t136–143 / t24–28, 0 hits, `noDamage` | suit-less sets derive; runner contact UNWITNESSED |
| L80 chest from L71 / from L79, L79→L71 (Dark Suit) | GAME NO | attempts; L79→L71 t153 | charged ✔ |

## Term 1: the two-grid split

- **The grids.** K is measured on the grid before T and stamped onto T's grid with T's `stampOccupancy`. Both happen only when `arrivals && guards`. The `guards:false` grid carries neither: the pit census, the rock Fire narrowings and the block push model all read it.
- **Blocks.** No pushable block on any K level (L71–75, 77, 78, 80, 99). **0** changed maze paths name a block or push. A gated cell that a block must cross: **none**.

## L80: the named lift-from-gated rewiring

- **Before and after.** At base, L80's lift is `r16c1 → r12c3` on the Dark Suit. At tip it is `r16c1 → r14c2` on the Dark Suit alone. r14c2 is trap (2,14)'s own tile, which K never charges.
- **What the maze reaches.** Past the lift, r16c1 reaches r6c5, r8c1 (the chest), r8c4, r9c5, r12c4 and r13c3 holding `Dark Suit & arm` (`runs/L80-maze-lines.txt` vs `-base.txt`).
- **The rewiring.** The stopped slice named it: `r8c4 → r6c4` would otherwise vanish. With K's re-cut, r6c4 is r6c5.
- **Stripping the pulls** leaves 9 rows unpriced (was 6).

## Re-record detail

| artifact | base → tip |
|---|---|
| atlas id | `seedling-ea1ef5ba → seedling-b856f0fc` |
| atlas: regions with a subgraph / sub-regions / internal exits | 57/216/355 → 60/251/489 |
| per level (sub-regions/rows) | L72 0/0→9/36; L73 2/1→5/7; L74 0/0→4/6; L75 0/0→9/36; L78 8/35→12/71; L80 6/6→9/14; L99 2/2→5/8 (`runs/atlas-per-level-counts.txt`) |
| maze `payloadMd5` | `104e6bf1… → e705ea93…` (= the table's `inputs.payloadMd5`) |
| frontier `sources` (AP_1) | `db17873e5cc320cb95da474374b01b5a → 51023885010d0851dc7321176985e2bf` (by hand) |

**The 16 count re-pins** (`seedling-derived-rules-expected.json`, read off the probe's row diff, `runs/table/count-attribution.txt`):

| count | base → tip | why |
|---|---|---|
| `labels.pair.path-vs-edge` | 133 → 181 | the new member pairs |
| `labels.pair.derived` | 213 → 229 | the new member pairs; the two L78 → r6c11 pairs derive |
| `arrivals.regionsPriced` | 205 → 208 | three whole-level regions (L72/L74/L75) become six members |
| `arrivals.arrivalNodes` | 241 → 244 | the same |
| `arrivals.regionsPerArrivalCount.1` | 171 → 174 | the same |
| `routeA.classes.walk-in from another member` | 102 → 108 | +2 per split level |
| `routeA.classes.overridable` | 59 → 56 | the three levels |
| `routeA.overridableElements` | 135 → 128 | the 7 table rows that leave |
| `routeA.overridableEchoFree` | 126 → 119 | the same 7 |
| `routeA.overridableExact` | 112 → 105 | the same 7 |
| `routeA.regionsWithAnEchoFreeOverride` | 57 → 54 | their regions |
| `routeA.regionsWithAnExactOverride` | 51 → 48 | their regions |
| `unpriced` | 354 → 572 | the split levels' internal-only edges: L72 +56, L73 +9, L74 +6, L75 +56, L78 +92/−24, L80 +20/−6, L99 +9 |
| `sharedBinding` | 159 → 162 | +3; the probe keeps no per-row flag, and no non-K row moves |
| `table.rows` | 106 → 99 | the 7 K-level rows |
| `table.regions` | 50 → 47 | their 3 regions |

## Seed 1 sphere log (verbatim, ⚖ Robert's T ruling: sub-region names only)

```
sphere 68 new_accessible_regions: -['level_72', 'level_74', 'level_75'] +['level_72__r0c11', 'level_72__r10c8', 'level_72__r11c11', 'level_72__r11c6', 'level_72__r5c4', 'level_72__r6c17', 'level_72__r9c10', 'level_72__r9c12', 'level_72__r9c14', 'level_73__r4c4', 'level_73__r5c7', 'level_73__r8c2', 'level_74__r1c7', 'level_74__r2c11', 'level_74__r2c2', 'level_74__r8c18', 'level_75__r0c4', 'level_75__r10c4', 'level_75__r10c6', 'level_75__r11c3', 'level_75__r11c5', 'level_75__r13c3', 'level_75__r3c3', 'level_75__r8c4', 'level_75__r8c6']
sphere 75 new_accessible_regions: -['level_78__r3c1', 'level_78__r4c4'] +['level_78__r3c12', 'level_78__r4c2', 'level_78__r5c12', 'level_78__r6c11', 'level_78__r8c10', 'level_78__r8c8']
sphere 77 new_accessible_regions: -['level_80__r12c3', 'level_80__r6c4'] +['level_80__r12c4', 'level_80__r13c3', 'level_80__r14c2', 'level_80__r6c5', 'level_80__r9c5', 'level_99__r6c12', 'level_99__r7c5', 'level_99__r8c10']
```

Locations: 0 differences in any sphere. `.archipelago` and `_rules.json` move with the rules, and `_Spoiler.txt` is byte-identical.

## Bounded vitest

- **Batch 1** (`runs/bounded-vitest-files.txt`, 203 files):
  - the brief's 15 named files;
  - every default-tier test that names the overlay, the guards (T, K, the Fire chaser guard), the atlas analysis, the four producers, `deriveLevelWorldLogic`, the derived-rule table, `regen-seedling`, or a preset or atlas this slice moved.
- **Batch 2** (`runs/bounded-vitest-files-2.txt`, 44 files): every other non-slow, non-train test that names a K level, L80 or L99.
- **Both green.** The first run had **21 reds in 18 files**, all pins this re-record moves. Each was re-pinned with its reason (`7eb2e90f`), including `fixtures/divergence-door-leg-keys.json` by its `rerecord` recipe. One pin changed shape:
  - `certifyLavaPulls`' broken-`pulled`-helper mutant is now caught by a throw, not a disagreeing row: the certifier's native replay refuses the broken arm's witness move (`step → null`).
  - At base the same mutant gave `witness [Dark Suit] replays to 6,6, not 4,6` (`runs/L80-maze-lines-base.txt`).
  - The engine is untouched.

## Stops checked

- **No change** to the solver, levelRun, `CONTACT_FIDELITY`, AS3, level data or the engine closure (engineMd5 unchanged). No level literal or exception, and no typed speed (K's speeds are measured off the ports in its unit rows).
- **Nothing edited** in `worlds/seedling/`, `vendor/seedling`, `.github/` or any submodule pointer.
- **No rule is looser** at a row the game says NO.
