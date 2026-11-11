# Cloud report: `rules-no-hit-l22`

Base: `origin/main` = `0d37f8caf975d6dbd07946ed1cbeeb2802f260d0`. Branch `claude/rules-no-hit-l22-gate-dj09e3`.

**STOPPED before the rule.** No rule, atlas, preset, world package, derived-rule table, pin, solver, levelRun,
`CONTACT_FIDELITY`, shared-module or wasm byte moved. Two commits add a witness instrument and the band derivation;
the rules do not read either.

## Why I stopped

1. **Brief item 3 fired.** The general derivation (each wallflyer's flight band, charged as crossing material) fires
   in all three wallflyer rooms: L22, L25 and L27.
2. **The game says a band is not a hazard by itself.** Played on the wasm game with no item and no hit:
   L27 is crossed in both directions, L25 from east to west, and L22 itself from north to south. So the charge is
   too strict in every room it fires in, L22 included. The cost depends on the direction, which a charged cell
   cannot say.
3. **The derived-rule table holds every exit of the three rooms.** 12 rows are keyed on `level_22`, `level_25` and
   `level_27` as single regions, all `True_`. Any split renames those elements, and the producer throws
   (`derived-rule table: level_21|level_21 -> level_22 names no element of the compiled document`) until the table
   is regenerated on CI. The brief says not to regenerate it.

## The witness (item 1)

Instrument: `scripts/procgen/probe-seedling-wallflyer-nohit.mjs`. A case is a room, the door the player came in by,
the door to reach, and the items held. The keys come from a search on the JS model that drops a branch at its first
hit; the wasm game `seedling_bot_ap_p4g` judges, on `seedling-vanilla-record-5aeefc3c`, `noDamage` and `noclip`
false. Staged: landing position, inventory, inputs. Each plan ran three times on fresh pages with the same result:
60 runs, 0 hits, 0 respawns, every one in the target room.

"NOT FOUND" means the search ended at its node budget without a plan. It is not "impossible". The search is weak
evidence: at 60,000 nodes it missed two walks that exist (below).

### L22, from L25's door (16,128) to L29's door (192,64)

| held | no-hit on the game | hits | ticks | how |
|---|---|---|---|---|
| nothing | NOT FOUND, 250,002 nodes (the earlier slice: about 80 hand plans, 1 hit) | n/a | n/a | n/a |
| Sword | **YES** ×3 | 0 | 173 | 11 slashes; a slash that lands turns the flyer back (`Enemy.hit`, then `WallFlyer.knockback`: `v = -v`) |
| Ghost Spear (`hasSpear`) | **YES** ×3 | 0 | 193 | two thrusts, one per row; the same keys with no item take 3 hits |
| Shield | **YES** ×3 | 0 | 209 | `shieldBump` knocks the flyer back while the player walks at it (`Player.as:1703`) |
| Dark Shield | **YES** ×3 | 0 | 189 | the same bump, with damage |
| Fire | NOT FOUND, 60,012 nodes | n/a | n/a | Fire only knocks back (`Enemy.as:145`) |
| Wand | **UNWITNESSED** | n/a | n/a | see below |

The Wand: the JS model refuses a WandShot in a room that holds a wallflyer, so there is no search. I tried two blind
tapes on the game (shoot each lower flyer from row 8, under its cell; then the same after shooting at the Bob first).
Both failed: a cast moves the player, so a walk planned without the shots does not replay, and the Bob reaches a
player who stands still. I did not go further.

### L22, every door pair with no item

North doors: L21 (top), L29 (east). South doors: L25 (west), L30 (bottom). The lower flyer row lies between.

| from \ to | L21 | L29 | L25 | L30 |
|---|---|---|---|---|
| L21 | | **YES** (121 t) | **YES** (277 t, joined) | **YES** (257 t) |
| L29 | **YES** (117 t) | | **YES** (278 t, joined) | **YES** (261 t) |
| L25 | NOT FOUND 60,003 | NOT FOUND 250,002 | | **YES** (113 t) |
| L30 | NOT FOUND 60,003 | NOT FOUND 60,003 | **YES** (113 t) | |

Every YES is 0 hits on the game, three runs. So:

- staying on one side is free, as the brief expected for the L21 entry;
- **north to south is free.** The walk waits in the lower row under `rock@96,96`, above the flyers' ray, then drops
  through at x 96 to 100, where both flyers are farthest;
- **south to north was not found**, from either south door to either north door. The same spot does not work
  upward: the rock is directly above it.

"Joined": the searches for L21→L25 and L29→L25 ran out of budget (60,003 nodes at weight 2.5, and again at weight 5)
although L21→L30 and L29→L30 were found. Those two plans are the found plan's first 188 and 191 ticks (the crossing)
and then a straight walk west along y 134. The game passes both. This is the proof that NOT FOUND at 60,000 nodes
is weak.

### L25 and L27

| case | held | no-hit on the game |
|---|---|---|
| L27, L26's door → L28's door | nothing | **YES** ×3 (157 t) |
| L27, L28's door → L26's door | nothing | **YES** ×3 (161 t) |
| L25, L22's door → L26's door (east → west) | nothing | **YES** ×3 (249 t) |
| L25, L28's door → L26's door (east → west) | nothing | **YES** ×3 (185 t) |
| L25, L26's door → L22's door (west → east) | nothing | NOT FOUND, 250,002 nodes |
| L25, L26's door → L22's door | Sword | **YES** ×3 (129 t) |
| L25, L26's door → L22's door | Ghost Spear | **YES** ×3 (189 t) |
| L25, L26's door → L22's door | Shield | **YES** ×3 (165 t) |
| L25, L26's door → L22's door | Dark Shield | **YES** ×3 (177 t) |

L25's east-to-west walk passes under both flyers along the bottom of their columns, one at a time, each just before
the flyer lands. L25 has the same shape as L22: one direction free, the other not found without an item.

## The derivation (item 2) and what it would change (item 3)

`frontend/modules/flashPanel/seedlingWallFlyerBands.js` `wallFlyerBands(level, world)` runs the class's own
transcription (`seedlingDemo/wallFlyer.js`) on the room's solids: the body settles into its wall, launches once, and
every tile its box covers until it stops is its band. No level is named. The bands:

| room | flyer | flies | band tiles |
|---|---|---|---|
| L22 | `wallflyer@64,80`, `wallflyer@128,80` (facing each other) | along y 88 | row 5, columns 4 to 8 |
| L22 | `wallflyer@48,112`, `wallflyer@144,112` (facing each other) | along y 120 | row 7, columns 3 to 9 |
| L25 | `wallflyer@48,48` | down | column 3, rows 3 to 5 |
| L25 | `wallflyer@64,48` | down | column 4, rows 3 to 5 |
| L27 | `wallflyer@192,48` | west | row 3, columns 3 to 12 |

I wired the bands into `rawBaseGridFor` as `cellCharges` beside the rope lanes, charged
`OV.KILL_ARM_CONDITION`, in the working tree only, with the 12 table rows removed from a scratch copy of the table
so the producer would run. **Not committed.** The wiring is this:

```js
const flyerChargesFor = (level) => bandCharges(wallFlyerBands(level, buildLevelWorld(level)), OV.KILL_ARM_CONDITION, doorTilesOf(level));
// in rawBaseGridFor:
const cellCharges = [...(a minted rope in this level ? ropeChargesFor(level, base) : []), ...flyerChargesFor(level)];
```

where `bandCharges` turns each band tile into `{tile, condition, open: doorTiles.has(tile)}`.

What AP_1 would become (`W` = `Progressive Sword | Ghost Spear | Wand | Progressive Shield×2`, the condition I
tried; every changed element is `True` today):

| room | new sub-regions | changed crossing | today | charged | the game, no item |
|---|---|---|---|---|---|
| L22 | `r0c6` (L21 and L29 doors), `r8c0` (L25 and L30 doors), `r6c7` (the east half of row 6, between the rows) | `r8c0 → r0c6` (south to north) | True | W | NOT FOUND |
| L22 | | `r0c6 → r8c0` (north to south) | True | W | **free** (too strict) |
| L22 | | `r6c7 ↔ r0c6`, `r6c7 ↔ r8c0` | True | W | not asked (no door, no location) |
| L25 | `r3c2` (L26 door), `r2c7` (L22 and L28 doors, the chest) | `r3c2 → r2c7` (west to east) | True | W | NOT FOUND |
| L25 | | `r2c7 → r3c2` (east to west) | True | W | **free** (too strict) |
| L27 | `r0c2` (L26 door), `r1c10` (L28 door) | both directions | True | W \| Progressive Swim | **free** both ways (too strict) |

Every exit of the three rooms and the exits into them are renamed by the split (`level_21 -> level_22` becomes
`level_21 -> level_22__r0c6`, and so on); their rules stay `True`. `Level 025 - Chest` stays `True`, bound to
`level_25__r2c7`.

Two things about the condition. `KILL_ARM_CONDITION` names the Dark Shield (`Progressive Shield×2`), but the game
shows the plain Shield is enough. And it names the Wand, which is unwitnessed. The witnessed set is
`Progressive Sword | Ghost Spear | Progressive Shield`.

**Vanilla route and spheres.** Dungeon 3 is entered through L21, and the goal ledger has goals in L25, L29 and L30,
so the vanilla route crosses L22 in both directions. It holds the Sword (sphere 1) by then. I did not run `Generate.py` on the charged rules (the table
blocks the pipeline). A reachability pass of my own over the compiled rules with vanilla placement gives 14 spheres
and 88 locations before and after, no location moved, nothing unreachable. It is my own evaluator, not AP's; on
the committed rules it places `Level 025 - Chest` where the committed seed-1 sphere log does.

## What Robert has to choose

- **A. Charge every band (the wiring above), with the witnessed set.** Safe: the logic never asks for a hit. Too
  strict in L27 (both ways) and in one direction each of L22 and L25. No vanilla sphere moves by my pass. Needs the
  table regenerated in the same packet (12 rows), and the maze derivation has to agree with the charge.
- **B. Price the direction.** South-to-north in L22 and west-to-east in L25 cost the set; the reverse and L27 stay
  free. This matches every witness. I have no general derivation for it: the direction came out of a search on the
  model, not out of the entities' data. Written today it would be a per-room literal, which is a stop of the brief.
- **C. Leave it.** L22 south to north and L25 west to east keep `True`, which expects a hit as far as anything found
  says.

A possible general reading for B, not built or tested: a band costs the set unless the room gives the player a
place to wait inside it, off the ray, at the far end of every flight. I name it only as a direction.

## What I added

- `frontend/modules/flashPanel/seedlingWallFlyerBands.js` and its test: the band derivation. Read by the probe
  only.
- `scripts/procgen/probe-seedling-wallflyer-nohit.mjs`: the instrument. `--search=<case,…> [--max-nodes=N] [--write]`
  runs the model search; with no `--search` it plays every kept plan on the game and prints `BAND`, `INFO`, `ROW`
  and `PASS`/`FAIL` rows. `--only=`, `--repeat=N`, `--dump`.
- `scripts/procgen/seedling-wallflyer-nohit-plans.json`: 20 plans as key spans, and 6 NOT FOUND rows with budgets.
- `scripts/procgen/probeSeedlingWallflyerNohit.test.js`: the doors, the staging, the key spans, every plan replayed
  on the model, the reader.
- `scripts/procgen/boxLock.test.js`: the probe is in the roster. The procgen reference is regenerated.

## Gates

Box: 4 CPUs, cloud container. Dev server `scripts/serve-nocache.py 8000`.

- **The probe**, full run at the last code commit: 20 plans, 60 checks, `ALL CHECKS PASSED`.
- **The probe**, `--repeat=3`, before that: 18 plans, 54 runs, 162 checks, `ALL CHECKS PASSED`; then the two joined
  plans (added later), `--repeat=3`: 6 runs, `ALL CHECKS PASSED`.
- **Bounded vitest**, 6 files, 62 tests, all pass: `seedlingWallFlyerBands.test.js`,
  `probeSeedlingWallflyerNohit.test.js`, `boxLock.test.js`, `checkProcgenHelp.test.js`, `lintGateLabels.test.js`,
  and the no-tracked-pointers guard.
- **Bounded vitest**, 3 more files, all pass: `seedlingObstacleEvents.test.js`,
  `seedlingPlaythroughObstacleEvents.test.js` (20 tests), `seedlingErDoorCensus.test.js` (9 tests). No rule moved, so
  the other atlas, AP_1, maze and `seedling_er` readers were not run.
- **`generate-procgen-reference.mjs`** then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **`check-procgen-help.mjs --only=probe-seedling-wallflyer-nohit.mjs`**: `ALL PASS`.
- **`census-seedling-constants.mjs --write`** then `--check`: `PASS`, 0 new, 0 vanished, 0 moved. Its test was not
  run (the census did not change).
- **Producers**, `ci-producer-checks.mjs --jobs=3`: `98 run | 0 red | 1 skipped | 0 known-red`.
- **Not run:** `Generate.py`, the world package, the maze, `seedling_er`, the frontier, `--blocks` (no rule landed);
  the unfiltered vitest (by rule); `npm test` browser batches.
- No submodule pointer moved. Of the submodules the setup step names, only `shared` and `bulletml-dodge` are
  initialised here; nothing I ran needed the others.

## Notes for the planner

- The earlier slice's probe (`probe-seedling-er-landings.mjs`) is not on `main`. This probe does not depend on it.
- One thing outside the slice, seen on the model only: in L25 a search from L22's door to L28's door found nothing
  (60,003 nodes), and a straight walk stops at the chest's east face. `Chest.as:63` opens a chest only from the
  line under its bottom edge, and that tile is behind the chest from the L22 side. AP has L25 as one region with
  every exit `True`. I did not check it on the game or look further.
- The search: weighted A* over 4-tick key macros, states merged on the player's 2 px cell and every body's pose.
  A larger budget or a finer macro could still find a south-to-north line in L22.
