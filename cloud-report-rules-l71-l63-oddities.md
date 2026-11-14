# Cloud report — `rules-l71-l63-oddities` (report only)

Base `origin/main` = **39e8a29f7fe8f9ebca9a17c3fa2d98d4123f09a4**. Branch `claude/rules-l71-l63-oddities-j6ovzr`.
Evidence: `CC/docs/cloud-reports/rules-l71-l63-oddities-evidence/` (its README lists every file and how to rerun it).
No rule, preset, atlas, table, solver or `CONTACT_FIDELITY` change.

## Answer table

| # | question | game | committed AP_1 rule | verdict |
|---|---|---|---|---|
| 1a | L71 `lock@112,192` crossing `r11c7 ↔ r13c7` (button cell ↔ L85 pocket) | **GAME YES only with the Spear's thrust or the Ghost Sword's slash** (the verdict already recorded in `seedlingObstacleEvents.js`, from `probe-seedling-killlock-arms.mjs`; not re-run here) | `And(Ghost Spear, Or(Progressive Sword, Ghost Spear))` = **Ghost Spear**, both directions, vanilla and ER identical | **AGREES** (both game arms need the Ghost Spear item; the `Or` conjunct is redundant, harmless) |
| 1b | L71 `unmeasured:tile6` note | tile 6 = **Pit**, one cell at (12,13), sealed from the lavarunners' chamber by Solid tiles (`Tile.as:24-27`: type 15 is `"Solid"`): **GAME NO**, no lavarunner can reach it | — (the note only keeps the room `undecided`) | **HARMLESS NAMING**: a fatal tile anywhere in the level is listed even when no body can reach it |
| 1c | L99 lavarunners (`lock@80,96`) | **UNWITNESSED** here (the L99 lock witness belongs to another slice) | `Or(Progressive Sword, Ghost Spear)` both directions (`r2c4 ↔ r2c7`), vanilla and ER | **OPEN, possibly LOOSER**: the ruling is `undecided`; the committed rule is the kept `A_WEAPON`, which lets a plain Sword clear it. That slice has to decide it |
| 2 | OPEN_L63: `level_63__r6c9 → level_63__r0c1`, Spear in hand, flag 1 unset | **GAME NO** (arm A: the player is boxed into (6,6) at t1781, flag 1 never set) · **GAME YES with `L63 flag 1`** (arm B: reaches (3,7) in r0c1 at t496) | `And(Ghost Spear, L63 flag 1: lightpole@64,88 cleared)` | **COMMITTED RULE AGREES**. The *derived* maze (`derived true`) is the looser side, and it never reaches the shipped rules (it is a PROBLEM row, not an exact element). The label "path-vs-edge / block-state" is accurate |

None of the four rows is a committed rule that is LOOSER than the game. One row (1c) is still undecided and could be looser. The stricter-side check comes out clean too: no committed rule here asks for more than the game needs.

---

## 1. L71 kill-lock residue

### The ruling, run (`tools/ruling.mjs` → `ruling-l71-l99.txt`)

```
=== L71 verdict=undecided condition=any(flag:hasSpear|flag:hasSword)
locks: lock@112,192  hazards: {"tiles":[6,17],"hitters":[],"spawners":[]}
  body lavarunner@64,224 cell 4,14 stands-on tile 16 env=unmeasured:tile6
  body lavarunner@64,192 cell 4,12 stands-on tile 16 env=unmeasured:tile6
  body lavarunner@72,208 cell 5,13 stands-on tile 16 env=unmeasured:tile6
  body lavarunner@48,200 cell 3,13 stands-on tile 5  env=unmeasured:tile6
  body lavarunner@80,224 cell 5,14 stands-on tile 16 env=unmeasured:tile6
  why: <each of the five>: an environmental arm nothing measured (tile6)
  tile6 cells: 12,13
```

There is **no `reach undecided` note in L71**. All five bodies stand on floor: Igneous Stone (16) or Dungeon Tile (5), never lava. The only notes are the five `unmeasured:tile6`.

### What tile 6 is, and why it cannot kill or move a lavarunner in L71

- Tile 6 is **Pit** (`TILE_TYPE_NAMES[6]`; `Enemy.update` `case 6` → `fallInPit`, `Enemies/Enemy.as:63-84`). `LavaRunner` keeps `canFallInPit` true and sets only `dieInLava = false` (`Enemies/LavaRunner.as:38`), so a pit WOULD kill one *if it got there*.
- L71's only pit is (12,13), the level `<control>` fallthrough cell (`control@192,208 fallthrough 82`). From `grid-l71.txt`: it is ringed by `F` (type 15) on its W, N and E sides. Its only open neighbour is (12,14) Igneous, which in turn touches only (13,14) and lava ((12,15), (13,15), (14,14)).
- The lavarunners' chamber is cells (3..5, 12..14), ringed on every side by type 15: row 11 cols 3-5, row 15 cols 3-5, column 2 rows 12-14 and column 6 rows 12-14 are all `F`. `Tile.as:24-27` maps type 15 to `"Solid"`, which is in every `Mobile`'s `solids` (`Mobile.as:17`). So a lavarunner never leaves the chamber.
- Each lavarunner is also leashed: `Bob.runRange = 80` (`Enemies/Bob.as:21`), and the pit is about 8 cells (128 px) away.
- Nothing else in L71 moves an enemy into a fatal tile: there are no enemy-hitters, and the plain shield's knockback needs contact, which the wall rules out.

So the tile-6 arm can never fire in L71. The note is **harmless naming**: `killLockRoomRuling` builds `fatal` from `present`, which holds every tile type anywhere in the level, without asking whether any body can reach that tile.

### The committed rule against the game verdict

From `rules-l71-playthrough.txt` (ER: `rules-l71-er.txt`, internal edges identical):

```
level_71__r11c7 -> level_71__r13c7 : And(Has Ghost Spear, Or(Has Progressive Sword, Has Ghost Spear))
level_71__r13c7 -> level_71__r11c7 : (same)
```

`r11c7` holds the button cell (7,11). `r13c7` is the L85 pocket (its teleporter, `teleporter@16,304 to 85`).

The game verdict: only the Spear's thrust or the Ghost Sword's slash kills the five through the wall.
- The Spear's thrust needs `hasSpear`, which is the **Ghost Spear** item.
- The Ghost Sword needs `And(Ghost Spear, Ghost Sword Fusion, Progressive Sword)` (`worlds/seedling/Rules.py:18-22`).

So the game condition reduces to exactly **Ghost Spear**, and the committed rule (the `across` grade ANDed with the kept `A_WEAPON`) also reduces to Ghost Spear. **AGREES**, neither looser nor stricter. There is no event (latch) alternative on either side, which is right: neither side can clear the room any other way.

⚠ The undecided ruling's own fallback, `A_WEAPON = Or(hasSword, hasSpear)`, *would* be looser here: a plain Sword cannot hurt the bodies through the wall. It does not ship only because the obstacle-event `across` conjunct is ANDed in. If that conjunct were ever dropped, L71 would turn looser.

### L99 (notes only; the lock witness is another slice's)

```
=== L99 verdict=undecided condition=any(flag:hasSpear|flag:hasSword)
locks: lock@80,96  hazards: {"tiles":[17],"hitters":["lavachain@80,64"],"spawners":[]}
  body lavarunner@192,64 cell 12,4 stands-on tile 17 env=unmeasured:lavachain@80,64
  body lavarunner@160,32 cell 10,2 stands-on tile 17 env=unmeasured:lavachain@80,64
  body lavarunner@176,64 cell 11,4 stands-on tile 17 env=unmeasured:lavachain@80,64
  why: each: stands on lava it survives (reach undecided)
  why: each: an environmental arm nothing measured (lavachain@80,64)
```

Committed (`rules-l99-playthrough.txt`, ER identical): `level_99__r2c4 ↔ level_99__r2c7 : Or(Progressive Sword, Ghost Spear)`. That is the kept `A_WEAPON`.

**UNWITNESSED.** Two questions are open for that slice, and either could make this rule looser:
- Can a plain Sword reach lava-standing lavarunners from each side? A Bob's chase (`Bob.as:57-62`, 80 px) could pull them onto Igneous floor at (7..8, 3..5) on the east side.
- Can the west side (`r2c4`) clear the room with the lock shut? Its cells sit right at the leash's edge: (5,2)'s centre is exactly 80 px from `lavarunner@160,32`'s centre (168,40), and the wall at column 6 stands between them. Only the game can settle it. If the west side cannot clear the room at all, its Sword crossing is looser.

---

## 2. OPEN_L63

### Reproduced

`node scripts/procgen/probe-seedling-whole-game-certify.mjs --shards=2 --arms=new` (local, vanilla) → `certify-vanilla-new.txt`:

```
ARM new: 1 problems (derived-true/atlas-false 1, derived-false/atlas-true 0, other 0) / 16 accepted / 0 threw; ... clean 114/115 levels
PROBLEM[new] level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: lightpole@112,272 cleared]: derived true, atlas false
```

The ER arm was not re-run here. Its pinned baseline (`seedling-er-whole-game-certify-expected.json`) carries the same single row, and L63 has no stair to shuffle.

The committed rule (`rules-l63-playthrough.txt`) is `level_63__r6c9 → level_63__r0c1 : And(Ghost Spear, L63 flag 1: lightpole@64,88 cleared)`. The reverse direction is `Ghost Spear`. The atlas subgraph alone says `Ghost Spear` both ways; the committed producer adds the flag-1 conjunct to this direction.

### The geometry (from `grid-l63.txt`; S/Q = floor, R = Body Wall (27, Solid), 6 = Pit)

```
       col: 3 4 5 6 7 8 9
  row 4:    6 S S 6 R R R      darktrap@80,64 on (5,4)
  row 5:    6 R Q R R S R      lightpole@64,88 on (4,5) (tag 1)
  row 6:    6 Q S S S 6 S      darktrap@64,96 on (4,6); pushableblockspear@112,96 on (7,6); r6c9 starts at (9,6)
  row 7:    Q S R R S 6 S      (4,7)->(3,7) is r0c1; (7,7) is r6c9's way up to the block
```

The only floor link between r6c9 and r0c1 is the row-6 corridor (7,6)–(6,6)–(5,6)–(4,6). It is walled north and south at columns 5–7, apart from (5,5) above (5,6) and (7,7) below (7,6).

### Source

- `PushableBlockSpear` moves only for a `"Spear"` hit (`Puzzlements/PushableBlockSpear.as:14`). Each hit moves it ONE tile, away from the striker (`PushableBlockFire.as:76-123`). Its `solids` include `"Enemy"` (`:31`), and it sinks on water, lava or pit (`:43`).
- A `DarkTrap` is an `Enemy` (`SandTrap.as`), so the block stops against it. `hit()` is empty: no weapon kills it (`DarkTrap.as:56-59`). Only a non-player `Light` within `radiusMin` kills it (`DarkTrap.as:27-38`). `lightpole@64,88` has `radiusMin` 28 (`LightPole.as:41`), and its tag is L63 flag 1.
- The pole itself can be toggled by a Spear hit (`Player.as:1103-1108`, `LightPole.as:77-84`). From (6,6) the thrust cannot reach it:
  - The thrust's rect is 5 px thick at `spearY = y+2` (`Player.as:977`, `:1345`).
  - The player's 4×5 hitbox under the (6,5) wall keeps `y ≥ 98`, so the rect's top is ≥ 97.5.
  - The pole's hitbox (`setHitbox(10,12,5,6)` about a rendered `y = 88 ± 2`, `LightPole.as` `render`) ends at ≤ 96.

So the source predicts: Spear only → the block parks on (5,6) against the trap on (4,6), and the player is sealed in (6,6). The game agrees.

### Witness on the game (`tools/l63live.mjs` → `witness/l63live-run.txt`)

Setup: wasm `seedling_bot_ap_p4g`, headless logic-only (`CHANNEL` proved), box lock taken. The run is CLOSED LOOP ON THE GAME (chained continuation windows, same boot), because the model does not move a `PushableBlockSpear`. Boot: L63 (9,6). Granted: `spear` only. `noDamage: true`; jellyfish knockback into pits resets the room otherwise. Tapes as played: `witness/A-spear-only.tape.json`, `witness/B-control-flag1.tape.json`. Per-window samples are in `witness/<arm>.live.json`.

| arm | staged | key ticks | end | verdict |
|---|---|---|---|---|
| **A-spear-only** | nothing but the Spear | t53 the thrust from (9,6) moves the block (112,96)→(96,96); t180 the thrust from (7,6) moves it to (80,96) = (5,6); t255 / t337 / t431 three thrusts west from (6,6), hugging the north and then the south wall: the block stays at (80,96), `cleared[]` stays empty, both DarkTraps stay alive; walking W, S and W for 1350 ticks: no progress | t1781 at (98.1,109.0) = cell (6,6); `minX` 98.06 | **GAME NO** without flag 1 |
| **B-control-flag1** | `persistence [{63,1}]` | the pole is lit at boot: DarkTraps (88,72) and (72,104) die (`63:2`, `63:8` written); t183 block at (5,6); t257 block at (4,6) (64,96); t339 the block is gone (it sank in the (3,6) pit); t449 at (4,6), t457 at (4,7), t466 at (3,7) | t496 at (55.2,123.4) = **(3,7), r0c1** | **GAME YES** with flag 1 + the Spear |

The block moves only one way along the corridor: the north wall stops a push from (7,7), and pushing it east into the (8,6) pit needs a stance west of it, which does not exist. So arm A's sequence is the only use of the block. Without flag 1 the corridor ends sealed. Damage would not change this, because the barrier is the Solid block, not the trap's bite.

### Verdict

- The game needs **both** the Ghost Spear (the block moves only for a `"Spear"` hit; the Ghost Sword also needs the Ghost Spear) **and** flag 1.
- The committed rule is exactly `And(Ghost Spear, L63 flag 1)`, so it **AGREES**: not looser, not stricter.
- The "derived true" side of the certifier row is the looser one. It groups (6,6) with (5,5) through the cell where the block ends up parked. It is held out of the shipped rules: it is a PROBLEM row, not an exact element of `derivedRuleTable` (`derivedRuleRows.js`).
- The existing label (`EXPLAINED_PROBLEMS`: "path-vs-edge, block-state framing") is accurate, and the queued side-aware R-A4 fix is a precision fix for the maze, not a soundness fix for the shipped rules.

**Other AP paths, noted only:** with the Ghost Spear, AP logic can also leave r6c9 for L65 (`level_63__r6c9 → level_65__r0c8`) and come back into L63 elsewhere. Those are multi-level routes through other rooms' rules, not this edge. Nothing here showed a route that reaches r0c1 more cheaply than the game allows, and none was witnessed.

---

## 3. Fix sketches

No row is a committed rule LOOSER than the game, so no soundness fix is due. Two general precision sketches follow; both are derived from data, with no level literals.

1. **`killLockRoomRuling`: limit `fatal` to tiles the body can reach.** Flood each body from its own cell over what its class can walk: every cell whose tile is not a `"Solid"` type (`Tile.as` `types`), plus lava for a class with `dieInLava = false` (it swims; `LavaRunner.update` `case 17`). Keep only the fatal tiles inside that flood. In L71 that drops `tile6` from all five bodies, which then fall to the `across` grade already shipped. This is a stricter→exact change; it adds nothing looser.
2. **OPEN_L63 (maze side, the R-A4 candidate):** the block-state fix already queued. A push-once block's terminal cell (the first cell along the push line where the block's `solids`, a Solid tile or a live `Enemy`, stop it) becomes WALL for the side that pushed it, unless the stopper is removed by an event, and that event then becomes the crossing's conjunct. The game confirms this framing: the stopper is `darktrap@64,96`, removed by flag 1's light.
3. **L99 (for the witness slice):** if its game verdict is "west cannot clear" or "only across-the-cut arms", the existing `encounterLockSides` grade (`seedlingObstacleEvents.js`) already handles both, as it did for L71. Its lava-standing bodies need a `through`/reach entry that counts lava as swimmable for `dieInLava = false` classes, which is the same flood as sketch 1.

## Gates

- `node tools/ruling.mjs 71 99`, `node tools/grid.mjs <71|63|99>`, `dump_regions.py` (pure reads).
- `probe-seedling-whole-game-certify.mjs --shards=2 --arms=new` (vanilla): 1 / 16 / 0, the row above (43.8 s wall).
- `census-seedling-darktrap-gates.mjs` (read-only, exit 0): its note `level_63 pushableblockspear@112,96: r6c9 -> r5c5 needs L63 flag 1` matches the witness.
- The L63 game witness: two arms, decisive, as tabled.
- No vitest was run (no test or source file was touched).
