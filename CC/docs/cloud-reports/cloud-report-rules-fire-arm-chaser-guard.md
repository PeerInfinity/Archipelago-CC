# cloud-report — rules-fire-arm-chaser-guard

Branch `claude/rules-fire-arm-chaser-guard-5o1nn3`. Base: `origin/claude/l73-lavarunner-move-patch-5h4k7x` =
`f2ef58c47b8b681ee11ebfc4e655a6d54aab4b04` (the L73 move included). `origin/main` at the start: `ba73e15420827bf8738273977eca5d5e9abc53bf`;
main was not merged. Wasm page `seedling_bot_ap_p4g`, headless logic-only channel (asserted on every page). Evidence is in
`CC/docs/cloud-reports/rules-fire-arm-chaser-guard-evidence/` (`tools/`, `runs/`, `tapes/`, `runs/game/*.game.json.gz`).
No pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling`, `.github/`, the solver, `levelRun` or `CONTACT_FIDELITY`
changed.

## ⛔ ONE STOP, on L100. Robert rules (details in § L100)

The rule as built drops Fire from L100 `r4c10 → r2c3` (the flyer). On the game, Fire only **enters r2c3 hit-free**: the player is
in c7 r2 at **t301 with 0 hits**. The brief's stop "the rule drops Fire from a row the game crosses with Fire only" therefore
fires if "crosses" means "enters the target region". Under the earlier witnesses' convention ("through to the target region's
exit"), neither arm completes the row on my tapes: Fire and the Sword control are both hit going west from c7 r2 toward the
L99 stairs. The L100 row is logic-neutral: r4c10 has no arrival edge, and seed 1's spheres do not move. I did not tune the rule
to avoid the stop. Everything below is measured with L100 dropped, as the rule says. The two ways out are listed at the end of
§ L100.

## Answer

| question | verdict | evidence |
|---|---|---|
| L73 `r3c7 → r0c4`, Fire only (moved room) | **GAME NO**, so the rule drops Fire ✔ | `l73n-fire-bulb@delivered`: hit **t286**, 2 hits (census tape, replayed: `runs/play-l73-recheck.log`) |
| L73 `r0c4 → r3c7`, Fire only (moved room) | **GAME NO**, so the rule drops Fire ✔ | `l73s-fire@delivered`: hit **t58** (the bulb), 2 hits |
| L73 north, Sword (the kept arm) | **GAME YES** | `l73-north-sword-delivered` (the solver's plan): **0 hits**, out to L74 at **t166** |
| L73 south, Sword (the kept arm) | **GAME YES** | `l73s-sword-east@delivered`: **0 hits**, out to L72 at **t353** |
| L92 both rows (Fire kept) | the rule keeps Fire, consistent with the witness's GAME YES | bob 0.5 / jellyfish 0.8 / spinner (not a homer): no body passes (b)+(c) |
| L100 `r4c10 → r2c3` (the rule drops Fire) | **into r2c3: GAME YES** (t301, 0 hits) · **to r2c3's exit: GAME NO for both arms on my tapes** ⇒ **⛔ STOP (ruling)** | `tapes/l100-fire`, `l100-fire-out`, `l100-sword-out`, `l100-idle`; `runs/play-l100.log` |
| AP_1 rows that move | exactly 3: L73 ×2 → `Or(Dark Suit, Progressive Sword, Ghost Spear)`; L100 → `Or(Progressive Sword, Ghost Spear)` | `runs/keywalk-producers.txt`; L92/L16/L30/L0/L3/L15 untouched |
| seed 1 sphere log / spoiler | **byte-identical** (regenerated) | `git status` after `Generate.py`: only `.archipelago` and `_rules.json` move, and only on the 3 rows |
| `seedling_er` | rule text of the same 3 rows; 50 placements, same draw | key walk |
| maze moves | L73 and L100 only | key walk |
| derived-rule table (local probe) | **no row moves**: 108 rows / 51 regions / 6 excluded; CERT **1/16/0** | `runs/derived-rules.log`, `runs/keywalk-derived-table.txt` (only `inputs.payloadMd5` and `measuredAt`) |
| whole-game certifier | vanilla **1/16/0**, ER `--arms=new` **1/16/0** (pin matches); the one problem is `level_63__r6c9 → level_63__r0c1` (OPEN_L63) | `runs/certify-vanilla.log`, `runs/certify-er.log` |
| engineMd5 | **`bec36987…` at base and at tip**, closure identical (42 files); no closure file imports the guard | `--print-engine-closure` at both |
| calib P3 (same box) | **no flags**; median ratio 0.990 over 39 reference levels, spread 0.797–1.110; L73 0.667, L100 0.822 (moved) | `runs/calib-compare.log` |

## The rule (module `scripts/procgen/seedlingFireChaserGuard.js`, beside `seedlingHolderParking.js`)

At an ordinary rock with a flame stance, a body **blocks** the Fire arm when all three hold:

- **(a) the Fire-only state cannot stop it.**
  - It takes no Fire damage: it would need `hitByFire && fireDamage > 0`. `Enemy.as:38` `hitByFire = false`, and no AS3
    subclass sets it (grep: only `Enemy.as:38,151` and LavaBoss). `Enemy.as:151` sends any other Fire hit to `knockback`.
    `Player.as:178` `fireDamage = 0`. In the module: `ENEMY_DAMAGE_DEFAULTS.hitByFire` and `PROFILE.fireDamage`.
  - No lethal tile borders the region it moves in. A tile is lethal by `ENEMY_CLASSES[tag].terrain`, `dies`/`falls`, which
    mirrors `Enemy.as:69-88`. A homer walks straight at its target with no avoidance (`Bob.as:55-66`), so a lethal tile on its
    border is one the player can lure it onto. Game evidence: the witness lured L73's bulb into the lava pit, gone at t154.
- **(b) it is strictly faster than `dMS`** (`Player.as:73`, 0.8 = `PROFILE.walkSpeed`) on the terrain its region holds.
  - Speed comes from `CHASERS[tag].speedByTerrain` where the class re-chooses it by tile (LavaRunner walk 1.5 / swim 1,
    `LavaRunner.as:17-18,110,117`); otherwise from `ENEMY_CLASSES[tag].speed`.
  - **Equality does not block.** `Bob.as:61-68` normalises `v` to `moveSpeed`, so at `moveSpeed == dMS` the body cannot close
    on a player moving away. The game agrees: L30's bobsoldier and L92's jellyfish (both 0.8) are GAME YES with Fire.
- **(c) it homes, and its leash covers the corridor from its region.**
  - "Homes" means `aggro.kind ∈ {chase, chase-through-walls, teleport-hop}`; these are kinds, not class names.
  - The leash test is `runRange ≥` the cell-square distance from the region to the corridor (`Bob.as:58` `d <= runRange`,
    inclusive). That distance is a lower bound on centre-to-player distance, so the test is conservative.

**Region.** A flood from the body's spawn tiles (`HP.bodyTiles`, from `contactRect`) over the cells it can stand on.

- Excluded: `wall`/`sink`/`manual` cells; entity-gated cells (a condition on a non-terrain tile — a rock or lock is "Solid",
  `Mobile.as:17`, `BreakableRock.as:41`); its lethal tiles.
- Included: terrain-gated cells (water/lava conditions are the player's); the crossing's own rock cell (the crossing happens
  with the rock broken).
- A class with `CHASERS[tag].solidsMover === 'none'` (Flyer, `Flyer.as:45` `solids = new Array()`) crosses every non-lethal cell.

**Corridor.** It is deliberately conservative: a superset of every crossing's cells.

- The rock's tiles, plus its flame stances (`rockFireSides`).
- The player-open component on each side of the rock: grid cells `open`/`directional` with no condition, flooded from the
  rock's neighbours. That component contains every walk to the side's exits and landings that needs no other key.

**Where it runs.** One pass over the same `rockFireSides` map as the holder narrowing (`make-seedling-playthrough-rules.mjs`
`narrowRockFireByChasers`), so rules and maze drop Fire together.

- **Pass order:** holders first, then this guard.
- **They commute.** Both decide from the RAW map, and both fold Fire away through one shared fold (`foldRockFire`): stances `[]`,
  fireDirs folded into swingDirs. The holder pass now folds `out.get(key)` through the same function; its output is unchanged
  (L16 still holds its `narrowed` record, and its unit rows pass).
- A rock narrowed by both passes keeps both reasons (`narrowed`, `guarded: [{body, spawn, speed, runRange, distance}]`). A unit
  row shows guard∘holder == holder∘guard and both records. No rock is narrowed by both today.
- **Full narrowings list:**
  - holders: `L16:breakablerock@304,64` (`bob@160,112`, entry `lock@320,112 from 19,7`)
  - guard: `L73:breakablerock@64,48` (`lavarunner@32,24`), `L100:breakablerock@128,144` (`flyer@224,96`)

**Unit rows (13, in a test file beside the module).** All 13 pass, alongside the precedent's 4.

- Real bodies:
  - L73 runner — blocks
  - L73 bulb — does not block: slower **and** borders lava (term (a) is false on it too, so the dies-in-lava term is live on the
    bulb, not only the speed)
  - bob 0.5 — does not block
  - L92 jellyfish 0.8 in water — does not block (not faster)
  - L53 puncher — fast and leashed, but stopped by the water past its broken rock (see below)
- Synthetic bodies:
  - a fast homer whose leash covers the corridor — blocks
  - a fast homer whose leash misses the corridor — does not block (with an 80 px leash it does)
  - a fast homer that dies in lava on its approach — does not block (a lava-survivor in the same room does)
  - a fast homer that takes Fire damage (`hitByFire` with `fireDamage` 1) — does not block. With the game's `fireDamage` 0 it still blocks.
  - exact equality at `dMS` — does not block; `dMS + 0.01` blocks
- Composition and the producer:
  - commutation
  - the producer names exactly L73 and L100, with body and spawn recorded
  - rules and maze drop Fire there and keep it on L92

## Per narrowed rock

| level · rock | body | speed vs dMS | runRange | flood → corridor | (a) | (b) | (c) |
|---|---|---|---|---|---|---|---|
| L73 `@64,48` (c4 r3) | `lavarunner@32,24` (spawn on lava, the moved spot) | 1.5 walk / 1 swim > 0.8 | 80 | region 73 cells (lava ring + pocket + south floor), **0 px**; lethal border 0 (L73 has no water/pit) | `Enemy.as:38,151` + `Player.as:178`; `LavaRunner.as:38` `dieInLava = false`; `Enemy.as:69-88` (water/pit absent) | `LavaRunner.as:17-18,110,117` vs `Player.as:73` | `Bob.as:21,58-68` (LavaRunner extends Bob) |
| L100 `@128,144` (c8 r9) | `flyer@224,96` | 1 > 0.8 | 80 | region 299 cells (the whole grid: no solids), **0 px**; lethal border 0 | `Flyer.as:37-39` (`dieInLava`/`dieInWater`/`canFallInPit` false); Fire as above | `Flyer.as:17,41` vs `Player.as:73` | `Flyer.as:45` (no solids) + `Bob.as:58-68` |

Every other body in a Fire-rock room fails at least one term (`runs/verdicts.txt`):

- bob 0.5 (b); bulb 0.65 (a)+(b); bobsoldier 0.8 (b); jellyfish 0.8 (b); spinner (c: `aggro none`, runRange 0); sandtrap and icetrap (c: static)
- L53 puncher (1 > 0.8, leashed at 0 px): (a) fails. The water past its broken rock (c7 r9) borders its region, and
  `ENEMY_CLASSES.puncher.terrain.water = 'dies'`. Without the "rock cell is open" term, L53 would have narrowed and moved the
  maze outside L73/L100 (a stop). The term is the crossing's own semantics, not a fix for L53.

## L100 (the STOP)

Staging: `arrivalStaging({level 100, x 288, y 80}, [hasFire])`, the room's own teleporter landing in r4c10. AP_1 has no arrival
edge into r4c10. The route: west along r6, down the c9 block to the east stance (152,144), face west, Fire. Then through the rock
cell into the c7 lane and up it. The lane is 8 px wide: pixel masks cover the left half of c7 r3–r9. At c7 r2 the player is in
sub-region r2c3 per the partition (`A` at c7 r2).

| tape (`tapes/`, delivered set `23510f80`) | arm | through the rock | c7 r2 (r2c3) | first hit | end |
|---|---|---|---|---|---|
| `l100-fire` (wait there) | Fire | t211, 0 hits | **t301, 0 hits** | **t372** (flyer right above at (128.8,35.8); the jellyfish at (116.8,40) is also close) | died, back to the landing |
| `l100-fire-out` (west to the stairs) | Fire | t211, 0 | t301, 0 | **t317** at (114.3,38.3), going west over the waterfall top (jellyfish at (106.7,48); the flyer 35 px away) | died ×2; L101 later |
| `l100-sword-out` (control, no swings) | Sword | t257, 0 | t347, 0 | **t361**, the same spot | died; L101 later |
| `l100-idle` | Fire | — | — | t107 (flyer) | — |

The model agrees within a tick on the hits it predicts (`runs/l100-model.log`, `tools/l100.mjs`).

- **What the rule claims:** the flyer (unstoppable, 1 > 0.8, flies through walls) reaches the whole room. True: it caught the
  player at t372 the moment they stopped.
- **What the game shows:**
  - A moving Fire-only player gets through the rock and into r2c3 untouched. `Flyer.as:83-85` `hitPlayer` is empty; it
    damages only by its standing drop.
  - The walk on to r2c3's exit is hit for **both** arms on my tapes, by the jellyfish in the waterfall column. It is not faster
    (so not a guard), but Fire cannot kill it, while a swinging Sword could (not attempted).
- **The ruling Robert owes** (I did not pick one):
  1. **Accept the drop.** Read "crossing" as reaching the region's exit, which the flyer and jellyfish together make NO for Fire
     on every attempt here. Logic-neutral (r4c10 has no arrival). Nothing to change.
  2. **Keep L100's Fire** with a derived refinement: a body whose contact does not damage (`CHASERS[tag].contactHits === false`,
     `Flyer.as:83-85`) is not a chase guard, because its standing drop does not catch a moving player. That changes only L100.
     It would undo the L100 rows above, the 316 → 315 internal-exit pin and L100's maze move. A second witness should then
     settle whether r2c3's exit is hit-free with Fire at all.

## Re-records (recipe order), and what moved (`runs/keywalk-*.txt`, python key walk with id-only paths folded)

| producer | result |
|---|---|
| rules (atlas + AP_1) | atlas `seedling-88e3788c → 626182a8`: L73's internal row loses Fire; **L100's one-way pair re-merges into one two-way row** (`regions/99` internal_exits 2 → 1, `bidirectional` true). AP_1: the 3 rows above; everything else is `atlas_ref`/`atlas_id` only (266 + 2) |
| partition | `--check`-style rewrite: only the atlas id key moves |
| maze | 12 differences, all in L73 (`rock_4_3` → `rock_sword_spear`, `action_lib.fire` gone) and L100 (`rock_8_9` → `rock_sword_spear`, `action_lib.fire` gone), plus the 3 rule rows and the atlas id |
| `seedling_er` | the same 3 rows; shuffled atlas `d98dcb06 → e2c191a2`; 50 placements, the same draw |
| sphere order | unchanged (no diff) |
| `worlds/seedling_playthrough` (`world_generator … --canonical-seed 1`) | `Rules.py`: the 3 `HasAny` lines lose `'Fire'`; `_worldgen_*` atlas id/refs |
| seed 1 (`Generate.py`, minimal-spoilers) | `_sphere_log.jsonl`, `_Spoiler.txt` **byte-identical**; `.archipelago`, `_rules.json` (the 3 rows); `preset_files.json` newline reverted |
| `atlas_files.json` | `seedling-playthrough.json` id → `626182a8` (hand line, as before) |
| procgen reference | no instrument added; `check-procgen-help` / `-docs` / `-reference` / `check-worldgen-package-sidecars` all pass; constants census `--check` PASS |

**Pins, before → after (each with its reason in the file):**

- `levelSetExporter.test.js`: internal exits **316 → 315**; atlas `88e3788c → 626182a8`
- `seedlingAtlasDoorCensus.test.js`: atlas `88e3788c → 626182a8`; internal exits **316 → 315** (swim 207 unchanged)
- `vanillaOverlay.test.js`: atlas md5 `e53ce517… → 1dd93b16…`

**Tests (bounded, explicit lists).**

- The new unit rows (13) and the precedent's rows (4) pass.
- The 141 test files that read a moved preset or atlas: after the pins, every one passes except two. Both fail on the
  **stale derived-rule table** only:
  - `derivedRuleTableFresh` (payloadMd5 `2c844d31… → 98d0ebe5…`, engineMd5 unchanged)
  - `seedlingAtlasDerivation`, which runs the producer's `--check` and hits the same staleness
- The table is CI's to regenerate, as briefed. Its rows do not move (above).
- No unfiltered vitest (ruling 52).

## Setup and runs

- `session_bootstrap.sh --seedling` reached READY. The six submodules were initialised; no pointer moved. Minimal-spoilers was set.
  Dev server: `scripts/serve-nocache.py 8000`.
- The container restarted mid-session. Both calib runs were redone back-to-back on the new box: base in a worktree at
  `f2ef58c47b`, tip on this branch (base wall 998.9 s, tip 993.4 s, level_40 heaviest at 476–483 s of 900 s). The earlier
  box's base run is not used.
- Tools (`tools/`):
  - `verdicts.mjs` — every rock × body, the three terms
  - `keywalk.py` — the key walk, `--fold=` for id-only paths
  - `grid.mjs` — a level's grid and tile terrain
  - `l100.mjs` — the L100 hand scripts, built on the census slice's `author.mjs` (delivered set)
- Game runs used the census slice's `play.mjs --spot=delivered`.
