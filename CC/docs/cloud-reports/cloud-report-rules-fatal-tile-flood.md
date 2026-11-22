# Cloud report: `rules-fatal-tile-flood` (MEASURE + SKETCH, report only)

- **Base:** `origin/main` = **f96d6b66254cd8c2dd08323a489d5d1f07525600**.
- **Branch:** `claude/rules-fatal-tile-flood-kkdg0z`.
- **Evidence:** `CC/docs/cloud-reports/rules-fatal-tile-flood-evidence/`. Its README lists every file and how to rerun it.
- **What changed in the tree:** no rule, preset, atlas, table, solver, levelRun, `CONTACT_FIDELITY`, level-data or engine-closure change. I applied `flood.patch` to a scratch copy of the tree (`cp -a`), measured it there, and deleted the copy.

## Answer table

| # | question | answer | game |
|---|---|---|---|
| 1 | Census before | **10 kill-lock rooms.** L5 `free`. L18, L26, L53, L60, L98 `gated` (all four arms). L39, L71, L78, L99 `undecided` (kept `A_WEAPON`). Vanilla = delivered for 9 of 10. L39's level record differs, but its ruling is the same. Full table in § 1; JSON in `census-before.json` | — |
| 2 | The flood | `tools/flood.mjs` is a pure function. It runs an 8-neighbour flood from every tile the body's 16×16 box touches. It walks every cell except the analyzer grid's `wall` cells (one source; gated and sink cells are walked), and stops on a fatal tile of the class. The walls audit shows every grid wall in the 10 rooms is an AS3 `"Solid"`/`"Tree"`/`"Rope"` type, and all three are in `Mobile.as:17` | source only (no witness needed: it over-approximates) |
| 3 | Census after | **Two rooms move, at the ruling only.** L71 goes `undecided` → `gated` `any(DarkShield, Spear, Sword, Wand)`: tile6 is dropped from all 5 lavarunners. In L39, tile1 is dropped from the 3 spinners; the room stays `undecided` because of the pulser, so this is reworded-equal. **Committed rules: AP_1 and `seedling_er` byte-identical** (`md5` 51023885… and 22cd779f…, 0 key-walk differences). L71 still reduces to `Ghost Spear` both ways | — |
| 4 | LOOSER movers | **One, at the ruling and at the maze payload only.** L71's own condition widens from `Or(Sword, Spear)` to also allow the Wand and the Dark Shield. The `across` conjunct (`Ghost Spear`) covers it: the committed rule is unchanged. The game's refusal of the Wand and the Dark Shield there is already witnessed, so no new witness is owed | **GAME NO** for Wand / Dark Shield / plain Sword across the L71 wall (`probe-seedling-killlock-arms.mjs`, recorded at `seedlingObstacleEvents.js:293-296`); not re-run here |
| 5 | Lava reach (sketch 3) | **No.** The flood over-approximates where a body CAN go. The note asks whether an item arm DOES reach the body, which needs an under-approximation. L99's and L78's lavarunners each flood onto 63 / 67 floor cells the player can stand on, but that proves nothing about reach. Both rooms also keep an unmeasured `lavachain` arm. Nothing moves. L99's committed sided rule is unchanged | UNWITNESSED (nothing to witness: no mover) |
| 6 | Other readers | Measured on the scratch tree. **Moves:** the maze preset (`level_71__r0c6` `atlas_gate_1`, 4 key paths); the derived-rule table's `inputs.payloadMd5` and `measuredAt` only (rows / regions / exclusions 99 / 47 / 6 → 99 / 47 / 6, `composedDisagrees` 0); 7 L71 lines of the `deriveLevelWorldLogic.slow.test.js` partial list (counts double, ratios equal). **Unchanged:** engineMd5 `74ae60f5…` (42 files) at base and on the scratch tree; certifier 1/16/0 for both arms (OPEN_L63 only, no gained row); seed 1; ER draw; sphere order | — |

**Bottom line:**
- The flood is exact in the direction the brief predicted. L71 becomes decided, and nothing that ships moves.
- The one widening is in the ruling's own disjunction (Wand, Dark Shield). It reaches the committed rule only if the `across` conjunct is ever dropped, which is the L71 warning from `rules-l71-l63-oddities`, now measured.

---

## 1. The census before (main f96d6b6625)

Source: `ROOT=<main> node tools/census.mjs` → `census-before.json`. `W` = `any(hasDarkShield|hasSpear|hasSword|hasWand)`; `A_WEAPON` = `any(hasSpear|hasSword)`. Every non-free body has `items` = all four arms.

| room | verdict | condition | bodies (env) | why |
|---|---|---|---|---|
| L5 | free | — | 3× bob `measured:ceiling` (free) | tape `f1-l5-lock-removal` (the arrow traps kill all three) |
| L18 | gated | W | spinner@48,96, spinner@112,48 `none` | — |
| L26 | gated | W | puncher@32,208, puncher@80,168 `none` | — |
| L39 | undecided | A_WEAPON | spinner@112,88, @224,112, @224,208 `unmeasured:tile1+pulser@64,96` | ×3 "an environmental arm nothing measured (tile1+pulser@64,96)" |
| L53 | gated | W | jellyfish@144,192, @184,160, @152,168 `none`; puncher@136,96 `unmeasured:tile1` (absorbed: implied by the cnf) | — |
| L60 | gated | W | jellyfish@120,112, @56,64 `none` | — |
| L71 | undecided | A_WEAPON | lavarunner@64,224, @64,192, @72,208, @48,200, @80,224 `unmeasured:tile6` | ×5 "an environmental arm nothing measured (tile6)" |
| L78 | undecided | A_WEAPON | lavarunner@192,144, @144,72, @96,32, @56,120, @112,136 `unmeasured:lavachain@160,32`; grenade@232,72 `self` (free) | ×4 "stands on lava it survives (reach undecided)"; ×5 "an environmental arm nothing measured (lavachain@160,32)" |
| L98 | gated | W | jellyfish@56,48, @176,72, @72,104 `unmeasured:iceturret@104,24` (absorbed); iceturret@104,24 `none` (its corpse stands on Water) | — |
| L99 | undecided | A_WEAPON | lavarunner@192,64, @160,32, @176,64 `unmeasured:lavachain@80,64` | ×3 "stands on lava it survives (reach undecided)"; ×3 "an environmental arm nothing measured (lavachain@80,64)" |

`vanillaEqualsDelivered`: true for every room except L39. L39's level record differs between the vanilla and delivered maps (`SEEDLING_SET_PATCHES`), but its ruling row is identical. The producer prices the delivered map.

## 2. The flood (`tools/flood.mjs`; wired form in `flood.patch`)

### What can move a counted Enemy (vendor/seedling/src)

- **Every voluntary or forced move is a 1 px step that `collideTypes(solids, …)` refuses** (`Mobile.as:39-40,86-118`).
  - Chase and wander work this way.
  - Knockback only adds to `v` (`Enemy.as:247-255`) and is spent through the same `moveX`/`moveY`.
  - An enemy-hitter (arrow, pulser, crusher, lavachain, turret, …) calls `Enemy.hit`, which also ends in knockback.
- **The base `solids` is `["Solid","Tree","Rock","Rope","ShieldBoss"]`** (`Mobile.as:17`).
  - Every counted class only PUSHES onto that list: `Bob.as:39` `"Enemy"`; `LavaRunner.as:43` `"LavaBoss","Enemy"`; `Puncher.as:48` `"Enemy","Player"`; `Jellyfish.as:35` `"Enemy"`; `IceTurret.as:148` `"Enemy","Player"`.
  - No class removes a base entry. The extras are bodies, so the flood ignores them, which only widens it.
- **A pushable block stops at a body and never shoves one.** Its own solids hold `"Enemy"` (`PushableBlock.as:28,60-86`; `PushableBlockFire.as:31,54`).
- **An opened lock, a broken rock or a burnt tree only REMOVES a solid.** The flood assumes this up front: every `gated` cell is walked.
- **The pit fall re-centres x/y with no collision test, but only on the pit the body is already on** (`Enemy.as:92-103`). It moves no body to a new tile.
- **The fatal tiles come from `Enemy.update`** (`Enemy.as:63-90`): Water (1) if `dieInWater`, Pit (6) if `canFallInPit`, Lava (17) if `dieInLava`. This is the class row's `dies`.
  - `LavaRunner.as:38` sets `dieInLava = false`, so lava is walkable floor for it.
  - `Jellyfish.as:31-37` sets all three to false, so its `dies` is `[]`.
- **`getState` reads `nearestToPoint("Tile", x, y)`** (`Enemy.as:131-139`). A `"Solid"` tile is not a `"Tile"` (`Tile.as:24-27`). The prototype widens any reached cell that has no Tile entity: the fatal types one ring past the nearest tiled ring count as touched. L99 has one such reached cell and no fatal tile near it.
- **Leashes are ignored** (`Bob.runRange`, `Bob.as:21`).
- **Connectivity is 8-neighbour**, which allows a corner squeeze the game's box cannot make. That is a widening too.

### One source for walls (designer term 1)

- **The source.** `wall(x, y)` is the producer's analyzer-grid `wall` cell: `rawBaseGridFor(level, {directionalLocks, arrivals: true})`, the call `playthroughLavaTrapPulls` makes. Those are the walls `pullLineClear` and rule T read.
- **Walls audit** (`census-before.json` `wallsAudit`). Every wall cell in the 10 rooms is one of these:
  - a `"Solid"` tile;
  - a `tree` (`Tree.as:24` `"Tree"`);
  - a `pole`, `rock`, `rock2`, `dungeonspire`, `ruinedpillar` or `pulser` (`Pole.as:18`, `Rock.as:16`, `DungeonSpire.as:20`, `RuinedPillar.as:21`, `Pulser.as:48`, all `"Solid"`);
  - the `iceturret` (`IceTurret.as:94` `"Solid"`).
  - **0 unexplained.** Every type is in `Mobile.as:17`, so the grid's walls are a subset of every counted class's solids, and the flood over-approximates.
- **MISSING FIELD, named.** A grid cell does not carry the AS3 collision `type` of whatever makes it a wall. A future kill-lock room whose wall is a `"Player"`-only solid would make the grid too strict for a body. Today no such cell exists in any kill-lock room. The follow-up should pin the audit as a test rather than add a second grid.
- **Why not a second build.** `tools/walls-equal.mjs` compares `buildSeedlingRegionGrid` without the producer's `entityOverride` against the analyzer grid: **24 cells differ over 116 levels**, among them L39 (4,6), a kill-lock room. A parallel grid would not be the same walls.

### Per body (`census-before.json` `flood`)

| room | body | flood cells | fatal present → reached |
|---|---|---|---|
| L18 | 2 spinners | 63 | none → none |
| L26 | 2 punchers | 92 | none → none |
| L39 | 3 spinners | 196 | **1 → none**: the room's water is sealed from them |
| L53 | puncher@136,96 | 52 | 1 → **1**, at (7,9) (1,10) (1,11)-(5,11) |
| L53 / L60 / L98 | jellyfish, iceturret | 77 / 130 / 87 | `dies` = [] |
| L71 | 5 lavarunners | **9** each: the walled 3×3 chamber (3..5, 12..14) | **6 → none**: the Pit at (12,13) is sealed off, as `rules-l71-l63-oddities` § 1 found by hand |
| L78 | 5 lavarunners | 195 (128 lava) | none → none |
| L99 | 3 lavarunners | 77 (11 lava) | none → none |

## 3. The census after, and the committed rules

How "after" was measured:
- `flood.patch` was applied to the scratch tree.
- `ROOT=<scratch> node tools/census.mjs` → `census-after.json`.
- The producers were run with `regen-seedling.mjs --check`, then `--write`, then `--check` again.

**The patch's two-phase `KILL_LOCKS`.** Phase 1 is today's census. Phase 2 re-prices every room over the raw grid, at the end of the module. It is built that way because filling `KILL_LOCKS` from the grid at import time hits the temporal dead zone of `pitChainMemo`, through `entityOverride → rockFireSides → gridFor`. Two checks show it is sound:
- The phase-2 walls equal the final grid's walls: **0 of 2470 cells differ** (`runs/walls-phase2-vs-final.txt`).
- Variant B injects the phase-2 rulings at phase 1, so every memo sees them from the start. It gives the same rulings, byte for byte, and the same `regen --check` (`runs/regen-check-scratch-variantB.txt`). The memo order does not matter.

| room | verdict / condition before → after | `why` before → after | committed rule AP_1 & ER (across ∧ ruling) before → after | class |
|---|---|---|---|---|
| L5, L18, L26, L53, L60, L98 | unchanged | unchanged | byte-identical | — |
| L39 | undecided A_WEAPON → undecided A_WEAPON | `(tile1+pulser@64,96)` ×3 → `(pulser@64,96)` ×3 | byte-identical | reworded-equal |
| **L71** | **undecided A_WEAPON → gated W** | 5 "tile6" notes → none | `level_71__r11c7 ↔ level_71__r13c7` : `Has Ghost Spear` → `Has Ghost Spear`. The across grade `Ghost Spear` ANDed with `Or(Sword, Spear)` before, and with W after: both reduce to `Ghost Spear` (`runs/rules-l71-l99-*.txt`) | **LOOSER at the ruling**; committed reworded-equal |
| L78 | unchanged | unchanged (lavachain, lava notes) | byte-identical | — |
| L99 | unchanged | unchanged | byte-identical | — |

The preset md5s, main → scratch, from `runs/keywalk-*.txt`:

| preset | md5 | key-walk differences |
|---|---|---|
| `seedling_playthrough/AP_1` | `51023885…` → `51023885…` | 0 |
| `seedling_er/AP_1` | `22cd779f…` → `22cd779f…` | 0 |
| `seedling_playthrough_maze/AP_1` | `724a25a1…` → `013df41a…` | 4 |

`gameGatedSolidTiles` now charges L71's kill-lock tiles (the room is `gated`). Nothing lies under them, so no door rule moved: `rules --check` OK.

Expected L71 (`undecided` → decided, rule still reduces to `Ghost Spear`): **confirmed.**

## 4. The LOOSER mover (designer term 3)

| room | what widened | does the `across` conjunct alone cover the game's refusal? | game witness |
|---|---|---|---|
| L71 `lock@112,192` | the ruling's own condition: `Or(Sword, Spear)` → `Or(Shield x2, Spear, Sword, Wand)`. Also the maze payload `level_71__r0c6` `obstacleLib.atlas_gate_1.clear_rule` (and its `name`) | **YES.** Each crossing's across conjunct is `Ghost Spear` (`throughCondition`: the Spear's thrust, plus the Ghost Sword, which `holds` the Spear's item and so drops out). The game kills the five only with the Spear's thrust or the Ghost Sword's slash | **GAME NO** for the Sword, the Dark Sword, the Wand and the Dark Shield. Already recorded: `probe-seedling-killlock-arms.mjs` (`--only=71 --margin=2`) → `seedlingObstacleEvents.js:293-296`, "the same two arms kill them and no other does". The Wand shot stops at Solid (`WandShot.as:69-70`) and the Dark Shield needs contact (`Player.as:1695-1701`). Not re-run here |

- The widening is honest by the ruling's own semantics: each body dies to any item arm that reaches it. Whether an arm reaches it is the across grade's question.
- It stays hidden only while that conjunct is ANDed.
- **What the follow-up owes:** no new witness. It does owe a guard: a unit row asserting that L71's committed crossing equals the across arms. Then a change that drops the conjunct fails loudly, instead of shipping `Or(Wand, Dark Shield, …)`.

## 5. Lava reach (sketch 3)

Source: `tools/lava-reach.mjs` → `runs/lava-reach.txt`.

| body | flood | non-lava cells the player can stand on (grid open/gated) |
|---|---|---|
| L99, each of the 3 lavarunners | 77 cells (Igneous 10, Lava 11, type 33 ×35, …) | 63 (the flood passes the gated lock cell) |
| L78, each of the 4 lava-standers | 195 cells (lava 128) | 67 |

- **The flood does not answer `stands on lava it survives (reach undecided)`.** That note asks whether an item arm reaches a body standing on lava. The flood can only prove the negative (no arm-reachable cell, which would be STRICTER), and every one of these bodies floods onto ground the player can stand on.
- **Only an under-approximation would settle it in the loose direction:** the leash (`Bob.as:21,57-62`, 80 px), the chase, the player's own reach. That is the sided grade's job. L99 already has one on main (`rules-l99-sided-killlock`, rule K):

  | crossing / event (AP_1 = ER) | rule |
  |---|---|
  | `level_99__r2c4 → level_99__r7c5` | `And(L99 flag 0: lock@80,96 cleared, Or(Progressive Sword, Ghost Spear))` |
  | `level_99__r2c7 → level_99__r2c4` | `Or(Progressive Sword, Ghost Spear)` |
  | event `L99 flag 0` | `Or(Progressive Sword, Ghost Spear)` |

- **Both rooms also keep `unmeasured:lavachain`.** So under the flood: **nothing moves** in L78 or L99, and the note stays.

## 6. Who else reads it (designer term 2, measured)

| reader | main | scratch | moved |
|---|---|---|---|
| engineMd5 (`seedlingDerivedRuleTable.js --print-engine-closure`) | `74ae60f575531492ed9eaec1839e1fe3` (42 files) | same | no. The overlay and the producer are outside the closure (0 of 42 files) |
| maze key walk, `seedling_playthrough_maze` | — | 4 paths, all `level_71__r0c6/playable_payload/obstacleLib/atlas_gate_1`: `clear_rule.children` 2 → 4 (`Has Progressive Shield count 2`, `Ghost Spear`, `Progressive Sword`, `Wand`), and `name` | **yes** |
| maze key walk, AP_1 / `seedling_er` | — | 0 / 0 | no |
| derived-rule table (REGEN_RECIPE's probe, local `--shards=2`) | 99 rows / 47 regions / 6 excluded; PASS vs committed | 99 / 47 / 6. Only `inputs.payloadMd5` `e705ea93…` → `4624bcab…` and `measuredAt` move (`runs/keywalk-derived-rule-table.txt`). `regen --check` then refuses `STALE derived-rule table` by name | inputs only; **no verdict moves** |
| the probe's row file `derived-rules.json` | — | rows 703-725 (the 23 L71 rows): `counts.compared/of/unadmitted/ownEvent` double (32/48 → 64/96: two more items to subset). No label or verdict path moves | counts only |
| `composedDisagrees` | 0 | 0 (`rules --check` OK before the table went stale) | no |
| certifier, vanilla `--arms=new` | 1 / 16 / 0, OPEN_L63 only | 1 / 16 / 0, the same row, clean 114/115 | no |
| certifier, `--source=er --arms=new` | 1 / 16 / 0 | 1 / 16 / 0; PASS vs `seedling-er-whole-game-certify-expected.json` | no |
| seed 1 (`regen --check seed1`) | OK | OK: 4 files + the index row match a fresh build | no; spheres unchanged |
| ER draw / sphere order / census step | OK | OK | no |

Bounded vitest:

| file(s) | main | scratch |
|---|---|---|
| `seedlingKillLocks`, `seedlingObstacleEvents`, `seedlingMountKeyLevelSet`, `encounterKillArms`, `seedlingPlaythroughObstacleEvents` | — | 117 / 117 pass (the patch keeps `wall` optional, so the unit pins still see the old census) |
| `countedRules`, `deriveLevelWorldLogic`, `seedlingDivergenceLegs`, `derivedRuleOverride`, `refreshSeedlingDerivedRules`, `certifyLavaPulls` | pass | pass |
| `derivedRuleTableFresh` | pass | **FAIL**: payloadMd5 |
| `deriveLevelWorldLogic.slow.test.js` | 2 / 2 pass | **FAIL** on 7 lines of the partial list (`runs/vitest-slow-scratch.txt`): L71's `8/48 → 16/96` and `24/48 → 48/96` |

No reader consumes the `why` text in an output: `rules --check` stays OK with the lock's explanation changed. The derived-rule table reads only the maze payload, so its verdicts are unaffected.

## 7. Sketch: the wired follow-up (needs Robert's word and the designer's review; lands after the pixel-pull-disc, or re-merges onto it, per term 4)

### Files

1. **`frontend/modules/flashPanel/seedlingPlaythroughOverlay.js`**
   - Add `killLockFatalReach` (as in `flood.patch`).
   - `killLockRoomRuling(level, {wall})`: make `wall` REQUIRED, like `lavaTrapPulls`'s `solid`. `wall: null` stays the presence census, by name. Refuse an omitted one.
   - `buildKillLockRulings(map, {wallOf})`.
   - Update the census doc comment (four undecided → three).
2. **`scripts/procgen/make-seedling-playthrough-rules.mjs`**
   - Price `KILL_LOCKS` over `rawBaseGridFor`'s walls.
   - Prefer a lazy getter over the patch's two-phase fill. The measurement shows the two are equivalent today (variant B), but a getter cannot strand a memo.
   - Export the walls audit's subject.
3. **Tests**
   - `seedlingKillLocks.test.js`: the map census reads the producer's grid. `by('gated')` → `[18, 26, 53, 60, 71, 98]`; `by('undecided')` → `[39, 78, 99]`; every gated condition stays `W`.
   - New unit rows:
     - a sealed pit is not reached;
     - lava is walked by a `dieInLava = false` class;
     - a gated cell is walked;
     - an untiled cell widens;
     - an omitted `wall` is refused;
     - the walls audit as a pin (every kill-lock room's grid walls ⊆ `Mobile.as:17`; a new type is a named MISSING FIELD);
     - the L71 guard from § 4.
4. **Re-records, in the same packet:**
   - the maze preset (`regen-seedling.mjs --write`);
   - the derived-rule table by REGEN_RECIPE (inputs only);
   - the `deriveLevelWorldLogic.slow.test.js` partial list (7 L71 lines).

### Rule diffs per preset

| preset | diff |
|---|---|
| `seedling_playthrough/AP_1` | **none** |
| `seedling_er/AP_1` | **none** |
| `seedling_playthrough_maze/AP_1` | `level_71__r0c6` `atlas_gate_1`: `(Progressive Sword OR Ghost Spear)` → `(Progressive Shield x2 OR Ghost Spear OR Progressive Sword OR Wand)` |

### Seed-1 sphere prediction

Unchanged: the `seed1` check is byte-identical on the scratch tree.

### Certifier

Both arms 1 / 16 / 0, OPEN_L63 only.

### Pins

**Move:**
- `seedling-playthrough-derived-rules.json` (`inputs.payloadMd5`, `measuredAt`);
- the `deriveLevelWorldLogic.slow.test.js` partial list;
- `seedlingKillLocks.test.js` (only once its census reads the grid).

**Do not move (measured):**
- `seedling-derived-rules-expected.json` (every pinned count PASS);
- the divergence leg keys (`seedlingDivergenceLegs.test.js` pass; AP_1 unchanged);
- `seedlingMountKeyLevelSet.test.js`;
- `seedlingObstacleEvents.test.js`;
- `seedlingPlaythroughObstacleEvents.test.js`;
- `countedRules.test.js`;
- `deriveLevelWorldLogic.test.js` (`SPHERE85_WEAPON_GATED`);
- `certifyLavaPulls.test.js`;
- `seedling-er-whole-game-certify-expected.json`;
- `atlas_files.json`;
- the sphere order.

No procgen doc quotes the kill-lock verdict census.

### Designer review and witness

- **Designer review: required.** The table rule does not trigger it, because no table verdict moves. The brief requires it anyway.
- **Witness first: NO.** No shipped rule moves. The one widening (§ 4) is already GAME NO-witnessed, and the across conjunct covers it.

## Gates run

| gate | result |
|---|---|
| `node tools/census.mjs`, main and scratch | `census-before.json` / `census-after.json` |
| `regen-seedling.mjs --check`, main | every step OK, 75.5 s |
| `regen-seedling.mjs`, scratch | `--check`: maze STALE; `--write`: only the maze preset; `--check` again: rules REFUSED (STALE table, inputs only); variant B: identical |
| `probe-seedling-derived-rules.mjs --shards=2`, main | ALL CHECKS PASSED, 99 / 47 / 6 |
| `probe-seedling-derived-rules.mjs --shards=2`, scratch | 99 / 47 / 6; the only FAIL is the table's input hash; explained problem PASS; pinned counts PASS |
| `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new`, scratch, vanilla | 1 / 16 / 0, ALL CHECKS PASSED |
| `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new`, scratch, ER | 1 / 16 / 0, ALL CHECKS PASSED |
| bounded `npx vitest run <paths>` | as tabled in § 6 |

No unfiltered vitest. No game witness was run: none was needed, and no mover asked for one. No CI dispatch.
