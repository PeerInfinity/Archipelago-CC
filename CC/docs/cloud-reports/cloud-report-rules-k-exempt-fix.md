# cloud-report — rules-k-exempt-fix (WIRED): **rule K now charges the step off an exempt cell into a lavarunner's leash. Every moved row and route is STRICTER, certifier 1/16/0 on both arms and both trees, 0 table verdict moves, engineMd5 unchanged**

Branch `claude/rule-k-exempt-charging-y6j1dv`.
- **Base:** `origin/main` @ **`0749fcb4d5114006362c8cc14f155f93019885a1`** (rule K + (b) is on it).
- **Pixel tree (read-only, measured only):** `origin/tile-pixel-pull-disc` @ **`a6a07631128666cffd32a5ffc8410fd4a8137346`** (merge-base = the base), in a detached worktree with the six submodules. The patch was applied there as a throwaway. Nothing from that tree is committed here.
- **Setup:** `session_bootstrap.sh --seedling` READY; the six submodules initialised; `minimal-spoilers`. No pointer moved.
- **Source read:** the report slice `rules-k-exempt-entry` (`origin/claude/rule-k-leash-entry-72cy4q` @ `2384bb6f18`), its report and its evidence. Its census tool, route walker and row diff are copied into `…-evidence/tools/`; that branch is not merged.
- **Path note:** the brief names `frontend/modules/flashPanel/seedlingChaserPursuitGuard.js`. The guard lives at **`scripts/procgen/seedlingChaserPursuitGuard.js`** (the only file with that name); that is the file edited.
- **No CI dispatch** (B1 not engaged). The planner dispatches `train_only` and the full battery at the tip.

Evidence: `CC/docs/cloud-reports/rules-k-exempt-fix-evidence/` (`tools/`, `runs/main/`, `runs/pixel/`, `runs/chains-*`).

## Answer table

| # | term | answer | measurement |
|---|---|---|---|
| 1 | **The fix** (the report's Q5 rule, GENERAL) | **Wired.** Every non-exempt zone cell 4-adjacent to an exempt zone cell joins K's cut. The exempt cell itself stays uncharged, so arrive-and-leave at the same doorway stays free. No level literal | `seedlingChaserPursuitGuard.js` `chaserGuardCells` + header § EXEMPT ENTRY; **65** step-off cells added over the 27 guarding bodies (`runs/chains-main-patch.txt`) |
| 2 | **(a) unfollowed entry** | **0 cells, on main and on the pixel tree**, counted unfiltered over all 27 guarding bodies (the census's `unfollowedAny`). **Fixed anyway in the add-only shape:** the boundary test drops `followed(n)`, so a zone cell beside ANY outside player cell is cut. It adds 0 cells on the delivered map | `runs/chains-main-base.txt`, `runs/pixel/chains-pixel-patch.txt`: `TOTALS … "unfollowedAny":0 … "added_unfollowed":0` |
| 3 | **(b) exempt chains** | **8 chains** (7 distinct; L77's is held by both of its runners), **0 mixed, 0 charged.** Each one is a door tile and its own landing that lead to ONE neighbouring doorway. Decided per run (below): a run is charged only when it names two doorways | `runs/chains-main-patch.txt` (`"chains":8,"mixedChains":0,"added_chainCut":0`), `runs/chainpeers-main-base.txt` (all 7 `peer-4-connected=True`) |
| 4 | **Routes on main** (AP_1, ER, maze, seed 1) | **Exactly 1 moved route in each:** L74 `L75 → Darkshield`: **FREE → `Ghost Spear \| Shield×2 \| Sword \| Wand`**. 0 route ADD/DEL. (a) and (b) add none | `runs/main/route-diff-{playthrough,er,maze,seed1}.txt` |
| 5 | **Rows on main** | **92 ADD / 6 DEL / 12 CHG; all 12 CHG STRICTER, 0 LOOSER.** The ADD/DEL rows are the new doorway sub-regions; the route walk folds them. All four presets are identical | `runs/main/row-diff-*.txt` |
| 6 | **Pixel tree** | **2 moved routes** (all three presets): the L74 Darkshield one, and **L77 `L76 → L78`: `Dark Suit \| Ghost Spear` → `Ghost Spear \| Dark Suit & (Sword\|Wand\|Shield×2)`**, which is main's rule, as expected. Rows 92/6/11 CHG, all STRICTER. Certifier 1/16/0 both arms. Table 0 verdict moves. engineMd5 `11ddc2c6…` unchanged | `runs/pixel/` |
| 7 | **Seed 1** | **0 sphere moves.** The sphere log moves only `new_accessible_regions` NAMES, in spheres 10.1 and 11.7 (verbatim below). **`_Spoiler.txt` byte-identical** | `runs/main/sphere-diff.txt` (`tools/spherediff.py`) |
| 8 | **ER draw** | **Kept**: the same 50 placements, `0 unbeatable`. Only `entrance_randomization.source.atlas_id` moves | `.cache/regen-seedling/er.write.log` line quoted below |
| 9 | **Certifier** `--arms=new` | **1 / 16 / 0 vanilla and ER** (OPEN_L63 only) | `runs/main/cert-{vanilla,er}.log` |
| 10 | **Derived-rule table** | **99 rows / 47 regions / 6 exclusions, 0 verdict moves.** Rows, exclusions and counts are byte-equal; only `inputs.payloadMd5` (`e705ea93… → 50a57378…`) and `measuredAt` move. `composedDisagrees`: no row moved, so no new disagreement (the rules `--check` OK) | `runs/main/table/` |
| 11 | **engineMd5** (worktrees WITH submodules) | base `74ae60f575531492ed9eaec1839e1fe3` → tip **`74ae60f575531492ed9eaec1839e1fe3`** (42 files). Pixel: `11ddc2c615fc84abc7140bb992027164` → **`11ddc2c6…`** | `--print-engine-closure` in `/home/user/wt-base`, this tree, and the pixel worktree |
| 12 | **`regen-seedling --check`** | **10 / 10 OK.** `refresh-seedling-derived-rules --check`: `OK: … fresh and on count` | quoted below |
| 13 | **Bounded vitest** | **Default tier 157 files / 2646 tests green. Slow tier: `presetDefs.generate.slow` 27/27 green; `deriveLevelWorldLogic.slow` re-pinned (one rename), re-run 2/2 green** | `runs/bounded-vitest-*.txt` (slow: `bounded-vitest-slow-{first-run,result}.txt`) |
| 14 | **Python key walk** (K levels only) | **AP_1, ER, seed 1 and the world's `_worldgen_rules.json`: 489 / 489 / 399 / 489 changed paths, all on L71–75, 77, 78, 80; 0 paths name no level.** The maze: 1489 paths, the same levels. `Rules.py`: changed lines name only L72–75, 77 | `runs/main/keywalk-levels.txt`, `runs/main/keywalk-world.txt` |

**Stops checked: none hit.**
- No LOOSER row or route on either tree.
- No sphere move beyond names.
- Certifier 1/16/0 everywhere.
- engineMd5 unchanged on both trees.
- No level literal in code.
- 0 table verdict moves.

## The change (`scripts/procgen/seedlingChaserPursuitGuard.js`, `69d65c0a`)

**Why** (the header section, condensed).
- K's cut skipped exempt cells: `if (exempt.has(i)) continue` (the old line 217).
- Nothing charged the step OFF an exempt cell, so a player who entered a zone at a landing, a door or a LavaTrap tile the reel drops them on crossed no cut.
- `rules-k-exempt-entry` measured 34 such cells on 8 levels, 3 reaching an uncharged goal, all GAME NO:
  - L74 (1,8) → Darkshield, 4/4;
  - L77 (6,12) → L78, 7/7;
  - L80 (5,6) → the L71 door, 4/4.
- Arrive-and-leave at L77 (6,19): GAME YES 4/4.

**Three terms, all add-only (no row can loosen):**
```js
// boundary, with (a): the outside cell need not be `followed`
const out = neighbours(i).filter((n) => !zone.has(n) && player(n));
if (out.some(followed)) cut.add(i); else if (out.length) { cut.add(i); unfollowed.add(i); }
// EXEMPT ENTRY: the step off an exempt zone cell
for (const i of zone) if (exempt.has(i)) for (const n of neighbours(i)) if (zone.has(n) && !exempt.has(n) && player(n)) cut.add(n);
// (b) EXEMPT CHAINS: a 4-connected run of exempt zone cells naming >1 doorway → every cell of it joins the cut
```
`chaserGuardCells` returns `unfollowed`, `exemptStep` and `chainCut` beside `cut` (every cell of each is also in `cut`).

**How (b) decides "the same doorway", exactly.**
1. **The doorway** is the report's definition: the 4-connected run of exempt cells inside the zone.
2. **Each exempt cell's identity** comes from `doorwayOf(i)`, supplied by the producer (`make-seedling-playthrough-rules.mjs`, `doorwayIdsFor`):
   - An atlas exit cell is identified by the doorway on the OTHER side of its connection. That is the peer region plus the least tile of the 4-connected run of the peer region's exit tiles that holds the peer exit. So a door and its own landing name ONE doorway, and two doors into the same neighbouring level do not.
   - A LavaTrap tile is its own doorway (`trap@x,y`).
   - An exempt cell with neither is its own doorway (`cell@x,y`), so it chains with nothing: the strict side.
3. **The rule:** a run of ≥ 2 cells whose cells name more than one identity is a walk between two doorways inside the leash, and every cell of it is charged. Otherwise it is an arrive-and-leave and stays free.
4. **The default `doorwayOf`** (`ONE_DOORWAY`, for callers that pass none) names one doorway for every cell. That is the report's definition with no identity data, and it keeps the existing unit rows' door + landing pair free.

**Plumbing (outside the brief's MAY list, flagged).** The producer change is 50 lines:
- `doorwayIdsFor` (memoised off the same quiet atlas `arrivalTilesFor` reads);
- the `doorwayOf` closure passed to `KG.stampChaserGuards`.

It is the guard's only caller. It is not in the engine closure (engineMd5 is unchanged) and it is not solver/levelRun.

**Unit rows** (the guard's own test file, `+5`, all **red on the base guard and green with the fix**, checked by stashing the two code files):
- **EXEMPT ENTRY, interior trap tile:**
  - `exemptStep` = both neighbours, and the trap tile itself is uncharged;
  - a goal inside the zone needs the arm.
- **EXEMPT ENTRY at a doorway:**
  - landing → own door: free;
  - landing → a goal inside the zone: the arm;
  - mutant: the cut without `exemptStep` leaves that goal free.
- **(b) chain:**
  - door A + landing B: both charged, so landing → door costs the arm;
  - the same cells naming one doorway: free.
- **(a) unfollowed:** two lock-gated cells (solid to the body) make (5,1) a zone cell whose outside neighbour is not `followed`. It is cut (`unfollowed` = [(5,1)]), and the walk in needs the arm.
- **Delivered set, L74:**
  - (1,8) → (1,9) (the L75 door): free with the Dark Suit;
  - (1,8) → (3,2) (the Darkshield): not walkable without the arm, walkable with it.

## (a) and (b): the census (`tools/kchains.mjs`, the producer's own `KG.chaserGuardCells` inputs)

`kchains.mjs` hooks the producer like `rules-k-exempt-entry`'s `kcensus.mjs`, and also captures the producer's `doorwayOf`. It counts per guarding body (after (b) pursuit).

**Totals, main** (`runs/chains-main-base.txt` before the fix, `runs/chains-main-patch.txt` after; the pixel tree identical, `runs/pixel/chains-pixel-patch.txt`):
```
bodies 27 · (a) unfollowedAny 0 · (b) chains 8 · mixedChains 0 · exempt-adjacent pairs 8
added: unfollowed 0 · exemptStep 65 · chainCut 0
```

**(b) chains** (each is one door + its own landing; `runs/chainpeers-main-base.txt`, the peer side 4-connected too):

| level | cells (kind) | doorway (producer `doorwayOf`) | peer tiles |
|---|---|---|---|
| L72 | (0,16) door, (1,16) landing+door | `level_71@18,6` | (18,6), (19,6) |
| L73 | (4,0) door, (4,1) landing+door | `level_74@18,8` | (18,8), (18,9) |
| L74 | (1,8) landing+door, (1,9) door | `level_75@4,0` | (4,0), (4,1) |
| L75 | (4,0) door, (4,1) landing+door | `level_74@1,8` | (1,8), (1,9) |
| L77 (both runners) | (6,18) landing+door, (6,19) door | `level_78@16,0` | (16,0), (16,1) |
| L78 | (2,0) door, (2,1) landing+door | `level_79@4,13` | (4,13), (4,14) |
| L80 | (2,0) door, (2,1) landing+door | `level_71@14,18` | (14,18), (14,19) |

**Step-off cells added per body** (`exemptStep`): L72 `@80,216` (0,15) (1,15) (2,16), `@136,88` (11,2); L73 (5,0) (3,0) (5,1) (4,2); L74 `@24,56` (1,7) (2,8); L75 `@104,64` (4,2) (3,1); L77 `@80,272` (6,13) (5,12) (6,17) (7,18) (7,19), `@112,256` the same + (7,12); L78 four bodies around the traps (9,3), (6,5), (9,6) and the (2,1) landing; L80 `@80,32` (3,0) (1,0) (3,1) (2,2) (1,1) (5,5) (6,6) (4,6), `@0,96` (2,2) (4,6).
- The ARRIVE-AND-LEAVE cells of the entry report gain nothing: L74 (18,8), L78 (9,6) and L99 (7,7). Their zone neighbours are not non-exempt zone cells.

## Routes and rows

### Main (base = the committed presets at `0749fcb4d5`, tip = this branch)

| preset | route walk | rows |
|---|---|---|
| `seedling_playthrough/AP_1` | **1 CHG:** `L75 → L74 ⇒ Darkshield`: FREE → `Ghost Spear \| Shield×2 \| Sword \| Wand` | 92 ADD / 6 DEL / 12 CHG STRICTER |
| `seedling_er/AP_1` | the same 1 CHG | the same |
| `seedling_playthrough_maze/AP_1` | the same 1 CHG | the same |
| seed 1 (`AP_14089154938208861744_rules.json`) | the same 1 CHG | the same |

**The 12 CHG rows** (every one STRICTER):

| row (both directions) | base | tip | GAME (entry report) |
|---|---|---|---|
| L72 r0c11 ↔ r5c4 | `Suit \| arm` | `Suit & arm` | (sub-region row; route already charged) |
| L73 r0c4 ↔ r4c4 | `Suit \| Spear \| Sword` | `Spear \| Sword \| Suit & (Shield×2 \| Wand)` | (sub-region row) |
| L75 r0c4 ↔ r8c6 | `Suit` | `Suit & arm` | (sub-region row) |
| L77 r12c6 ↔ r15c6 | `Suit \| Spear` | `Spear \| Suit & (Sword \| Wand \| Shield×2)` | **GAME NO 7/7** (2a) |
| L78 r1c10 ↔ r3c9 | `Suit \| Spear` | `Spear \| Suit & (Sword \| Wand \| Shield×2)` | (sub-region row) |
| L80 r0c2 ↔ r6c5 | `Suit` | `Suit & arm` | **GAME NO 4/4** (3b) |

- The route row, L74 Darkshield from L75, is **GAME NO 4/4** (3a).
- `arm` = `KILL_ARM_CONDITION` = `Or(Sword, Ghost Spear, Wand, Shield×2)`.
- **The 6 DEL rows are renames**, each paired with an ADD of the same rule to the new landing member:
  - `level_71__r0c6 ↔ level_72__r11c6` → `r16c0`;
  - `level_74__r2c2 ↔ level_75__r0c4` → `level_74__r8c1`;
  - `level_77__r15c6 ↔ level_78__r0c16` → `level_77__r18c6`.
- The other ADD rows are the new members' internal rows. No route moves beyond the one.

### Pixel tree (base = its committed presets at `a6a0763112`, tip = the patch applied, by `tools/pixel-regen.sh`)

| preset | route walk | rows |
|---|---|---|
| all three | **2 CHG:** the L74 Darkshield one, and **`L76 → L77 ⇒ exit L78`: `Dark Suit \| Ghost Spear` → `Dark Suit & Shield×2 \| Dark Suit & Sword \| Dark Suit & Wand \| Ghost Spear`** (= main's `Ghost Spear \| Dark Suit & (Sword\|Wand\|Shield×2)`, as expected) | 92 ADD / 6 DEL / **11 CHG, all STRICTER** (L78's moved row there is `r5c6 → r6c9 #2` instead of main's r1c10 ↔ r3c9 pair) |

The pixel tree, measured:
- **Certifier `--arms=new`:** 1/16/0 vanilla and ER.
- **Table:** 99/47/6, rows, exclusions and counts equal to that branch's committed table (only `inputs` and `measuredAt` move).
- **engineMd5:** `11ddc2c6…` before and after the patch.
- ⚠ **Pre-existing on that branch, not this slice:** its committed table is already stale against its own engine (`rules1` warns `engineMd5 74ae60f5… → 11ddc2c6…`). The pixel landing re-derives it anyway.

Files: `runs/pixel/{route,row}-diff-*.txt`, `runs/pixel/regen.log`, `runs/pixel/cert/cert-lines.txt`, `runs/pixel/table/`.

## Seed 1: the sphere log and the Spoiler

`tools/spherediff.py`. Every field but `new_accessible_regions` is identical, sphere by sphere; the log is the same length.
```
sphere 10.1: regions -[] +['level_72__r16c0', 'level_72__r2c10', 'level_73__r1c6', 'level_73__r2c3', 'level_73__r2c5', 'level_74__r8c1', 'level_75__r2c5']; folded to levels -[] +[]
sphere 11.7: regions -[] +['level_77__r18c6']; folded to levels -[] +[]
SPHERE MOVES (beyond region names): 0
```
**`AP_14089154938208861744_Spoiler.txt`: byte-identical** (`cmp`, md5 `39ca6d69dc29167ad2a80338c391065c` at both). Every sphere's LOCATIONS are unchanged, and the Darkshield is still found in sphere 10.1 (with the Wand).

## Re-records, by recipe

1. `node scripts/procgen/regen-seedling.mjs --write`: pass 1, commit **`cf738c57dd`**. It rewrote:
   - the atlas, AP_1, the partition, the world package and the seed-1 `.archipelago`, `_rules.json` and `_sphere_log.jsonl`;
   - the maze and ER presets.

   The Spoiler, sphere order and `preset_files.json` were not rewritten.
2. `--check` → `rules REFUSED: STALE derived-rule table: the maze world payloads moved (payloadMd5 e705ea93… → 50a57378…)`, as the brief predicted.
3. `GITHUB_SHA=cf738c57dd… node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2` (local):
   - `CERT: 1 problems / 16 accepted / 0 threw`;
   - `TABLE: 99 rows in 47 regions; 6 exact elements excluded`;
   - 11 expected-count drifts.

   **Base control**, the same probe at `0749fcb4d5` in `/home/user/wt-base`: `PASS: the derived-rule table matches …` and `PASS: every pinned count matches …`.
4. Copied the table, then ran `regen-seedling --write` again (pass 2): no product moved.
5. **`regen-seedling --check`: 10/10 OK** (rules, partition, world, template, host-settings, seed1, maze, er, sphere-order, census).
6. **`refresh-seedling-derived-rules.mjs --check`:** `rows 99=99, regions 47=47, excluded 6=6 OK; staleness: OK …; OK: the committed derived-rule table is fresh and on count`.

**Table before / after** (`seedling-playthrough-derived-rules.json`):

| | before | after |
|---|---|---|
| rows / regions / excluded | 99 / 47 / 6 | **99 / 47 / 6** (rows and `excluded` byte-equal) |
| `inputs.payloadMd5` | `e705ea936f2ccf407f1046a4e5d11439` | `50a5737827ca27376e8195cdbe0dcb8a` |
| `inputs.engineMd5` | `74ae60f5…` | `74ae60f5…` |
| `measuredAt` | (main's) | `cf738c57dd` |

**Every pin re-recorded, with its reason:**

| pin | old → new | reason |
|---|---|---|
| `seedling-derived-rules-expected.json` `labels.pair` | path-vs-edge 181→196, derived 229→230 | the new doorway members' pairs (L72 +12/−8, L73 +6, L74 +5/−3, L75 +2, L77 +4/−2; `runs/main/element-diff.txt`) |
| … `labels.location` | derived 60→59, path-vs-edge 13→15 | L74's Darkshield (r2c2) is internal-only now and priced from two member arrivals (r8c1, r8c18), path-vs-edge |
| … `w0.location` | equal 62→61, stricter 12→13 | the same element: FREE in the atlas row before, now the arm |
| … `arrivals` | regionsPriced 208→209, arrivalNodes 244→246, regionsPerArrivalCount.2 32→33 | r2c2 priced from 2 arrivals |
| … `routeA.classes.internal-only` | 28→29 | r2c2 |
| … `unpriced` | 572→645 | the split levels' internal-only edges (L72 +34, L73 +12, L74 +6, L75 +16, L77 +5) |
| … `measuredAt` | → `cf738c57dd` | the probe's commit |
| `campaign-frontier.json` `sources` AP_1 md5 | `51023885…` → `23146275…` | by hand, never `--write-frontier` (precedent `30062a3f`) |
| `atlas_files.json` + atlas-id pins (`levelSetExporter`, `seedlingAtlasDoorCensus`, `watchSetIdentity`'s comment) | `seedling-b856f0fc` → `seedling-bc3ac9f3` | the atlas id moves with the atlas |
| `seedlingMountKeyLevelSet` | 3 rows: ER `16a2f41d…`→`7f0a4e5d…`, AP_1 `b980a716…`→`568dd7af…`, seed 1 `70771818…`→`b6336a92…` (and their `jsSaveKey`s) | measured with the module's own `seedlingMountKey` over the regenerated presets (base reproduced first: the old 3 digests at `0749fcb4d5`); the other 5 rows unmoved |
| `seedlingDivergenceLegs` + `fixtures/divergence-door-leg-keys.json` | the goal-event id map (ids 611–908 −1, links from 909 +1); fixture: 3 keys re-keyed, 1 gone | **the same 67 goal-event legs by key and events.** 3 door legs re-key to their landing members (L72 r11c6 → r16c0, L74 r2c2 → r8c1, L77 r15c6 → r18c6). The L74 Darkshield door leg from the L75 landing goes; 2 Darkshield link legs come (from r8c1 and r8c18). The fixture was written by its `rerecord` recipe (legs file in the scratchpad, not `/tmp`). `legs[802]` → `legs[801]` (the Watcher's leg) |
| `seedlingAtlasDoorCensus` | sub-regions 251→259, internal exits 489→532; the `Dark Suit & arm` internal rule 75→106 | L72 +2/+19, L73 +3/+8, L74 +1/+4, L75 +1/+9, L77 +1/+3 |
| `levelSetExporter` | internal exits 489→532 | the same |
| `seedlingAtlasArm` | room regions 306→314 | the 8 new members |
| `mazeConvertedLink` / `mazeConvertedLoad` / `mazeSeedlingLink` | room-less 190→198 (sidecars 306→314) | the same 8, room-less members of their level worlds |
| `mazeInputOutputSplit` | plain level worlds 19→18 | **L74 is still ONE level world**, but by colliding crossings now: the new r8c1's crossings share exit tile (2,9). Asserted beside it |
| `deriveLevelWorldLogic` | the unreached set +8 names | the same 8 members, all behind the same weapon gate (**none freed**) |
| `deriveLevelWorldLogic.slow` | one line renamed `level_71__r0c6 → level_72__r11c6` → `… r16c0` | the same landing, points and universe |
| `vanillaOverlay` | atlas md5 `5c3dd651…` → `8e550d31…` | the overlay fixture is byte-identical (E5's fresh-build row green) |
| `certifyLavaPulls` broken-helper mutant | `toThrow(/player_pos/)` → caught by disagreement | with the step off the L80 trap tile charged, the broken arm no longer steps where the native engine refuses. It runs and is caught twice: its lift rows price `[]` where the native engine prices the Suit and the arm, and its own replay fails (`r0c2 → r6c5: witness … replays to 7,6, not 5,6`) |

**ER draw kept:** `seedling_er: seed 1, 50 placements, 48 exit(s) moved, draws 1 (0 shuffle-refused, 0 unbeatable, 0 check-rejected), 90 sphere states; source atlas seedling-bc3ac9f3`.
- `entrance_randomization` differs only in `source.atlas_id`.
- The ER key walk names only K levels.

## Certifier lines (main tip)

```
vanilla  ARM new: 1 problems (derived-true/atlas-false 1, derived-false/atlas-true 0, other 0) / 16 accepted / 0 threw; 100 row(s) skip unadmitted landing points; clean 114/115 levels; 862 lines
         PROBLEM[new] level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: lightpole@112,272 cleared]: derived true, atlas false
er       ARM new: 1 problems (…) / 16 accepted / 0 threw; …; clean 114/115 levels; 863 lines
         PROBLEM[new] level_63__r6c9 → level_63__r0c1 … (the same OPEN_L63 row)
pixel    vanilla 1 / 16 / 0 (860 lines); er 1 / 16 / 0 (861 lines)
```

## Bounded vitest

The list is derived and explicit (`runs/bounded-vitest-files.txt`, 157 paths, never empty). It holds every test that names:
- the guard;
- the K-stamping producer (`make-seedling-playthrough-rules.mjs`) or the maze, ER or partition producers;
- `seedling-derived-rules-expected.json`, or any moved preset, atlas, partition, table or frontier.

It also holds `seedlingMountKeyLevelSet`, `seedlingDivergenceLegs` and `deriveLevelWorldLogic`.

| run | result |
|---|---|
| default tier, first run (after the re-record, before the pins) | 12 files red, all pin moves listed above (`runs/bounded-vitest-first-run.txt`) |
| **default tier, after the pins** | **`Test Files 157 passed (157)`, `Tests 2646 passed (2646)`** (`runs/bounded-vitest-result.txt`) |
| slow tier (`vitest.slow.config.js`) | `presetDefs.generate.slow.test.js` **27 passed**. `deriveLevelWorldLogic.slow.test.js`: its one rename re-pinned, then re-run: **2 passed (2), 214.7 s** |

Not run here:
- the train tier (`deriveLevelWorldLogic.train`, `learnLattice.train`): the planner's `train_only` dispatch;
- `deriveLevelWorldLogic.calib`: manual only.

The guard's own file: 15 tests (10 before + 5 new), green.

## Commits

1. `69d65c0a`: the guard (the fix, (a), (b)), its 5 unit rows, the producer's `doorwayOf`.
2. `cf738c57`: pass 1 (`regen-seedling --write`).
3. `c0193598`: the table (local probe at `cf738c57dd`), pass 2, the frontier md5.
4. `ef9c7009`: the probe's expected counts, `atlas_files.json`, the atlas-id pins.
5. `3cdfd84a`: the 12 test files' pins and the divergence fixture.
6. `12456c9e`: the slow-tier rename pin.
7. `8f3cd06f`: the evidence.
8. This report (last).
