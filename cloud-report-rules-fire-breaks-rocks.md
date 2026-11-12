# cloud-report — rules-fire-breaks-rocks

Branch `claude/rules-fire-breaks-rocks-kiyz4z`, from `origin/main` = `737a451f5038f6dfe2f322b26457de0b5fb0aee9`.

## Verdict: STOPPED, a brief stop condition (tileSpike engine)

The rule is written, derived from the source, and game-witnessed where the brief asked. **Seed 1's spheres do not move.**
It cannot land as it stands: the **maze certifier** (`mazeRoom/tileSpike`, the derived maze world against the atlas
rules) goes red on L0. Agreeing with a *sided* Fire rule needs a **tileSpike engine change**, which is on the brief's
STOP list. Details in § "Why it stops".

| commit | what | land? |
|---|---|---|
| `8f61525d` W | game witnesses for the three solver-only cases (`FIREBREAK_RULES_WITNESSES`, `--set=rules`), recorded and replayed by `fidelityFireBreak.test.js`; `--set=rules-refused` prints the rows the solver will not plan | can land alone |
| `aae9c4e1` R | the rule, regenerated through the maze and `seedling_er` | **NO**: certifier red (below) |
| this commit | the report | drop before landing |

Not done, because of the stop: the frontier (`--write-frontier`), `census-seedling-constants --write`,
`generate-procgen-reference`, and the pins that move with the atlas id.

## The source (vendor/seedling `ccdf1897`)

- `Puzzlements/BreakableRock.as:57-67`: `hit(_t)` → `if (rockType <= _t) … play("break")`. `Game.as:2375-2376`:
  `breakablerock` is rockType 0, `breakablerockghost` rockType 1.
- `Player.as:1091-1094`: `else if (e is BreakableRock) { (e as BreakableRock).hit(hasGhostSword ? 1 : 0); }`. The hit
  power is the Ghost Sword flag, never the weapon.
- `genericHit` has exactly three callers in `src/`: `Player.as:924` (the slash, `genericHit(v[i], hasGhostSword ? "Spear" : "Sword", …)`),
  `:989` (the thrust, `genericHit(v[i], "Spear", spearForce, spearDamage)`), `:1032` (the flame, `genericHit(e, "Fire", fireForce, fireDamage)`).
  All three collide with `hitables` (`:99`, which includes "Solid"), and a BreakableRock's type is "Solid".
- The flame (`Player.as:1015-1035`): `collideRectInto(hitables[i], x - sprFire.originX, y - sprFire.originY, sprFire.width, sprFire.height, vc)`,
  keeping each entity with `FP.distanceRects(…) <= sprFire.width / 2` (16 px), and hits **all** of them.
- Not breakers: the Wand's shot (`Projectiles/WandShot.as:checkEntity` handles `Enemy` and `MagicalLock` only). Nothing
  else in `src/` names `BreakableRock`. The Dark Shield bump never reaches `genericHit`.
- ⇒ ordinary rock: Sword | Spear | Fire. Ghost rock: `hasGhostSword` only (row unchanged).

## The rule (general, no per-room literal)

`frontend/modules/flashPanel/seedlingRockBreakers.js` (`rockFireSides`, with the physics model injected):

1. **Stance**: a walkable tile centre in the ±2-tile window (`plannerObstacleAt` null) whose `auditFire` flame reaches
   this rock and **no other `modelled` or `refused` responder**. This is fidelity's resolver criterion, asked of the
   static level. It reproduces fidelity's W0 table cell for cell: L0 5/1/4, L3 2, L15 3·5, L16 1·1·3·4, L30 8, **L40 0·0·0,
   L41 0·0**, L53 3·3, L73 5, L92 4·5, L100 2.
2. **Side**: entering the rock moving `dir`, the free floor behind the entry (a 4-connected flood of walkable centres,
   never through this rock) must reach a stance. Otherwise that side keeps the swing's rule.
3. **Isolated landing**: a landing tile with no walkable floor beside it counts as floor, because its occupant can only
   have arrived. This is L3's L11 pocket, game-witnessed by fidelity (`firebreak-l3-pocket`).

Wiring: the overlay's `rockFireRuling` (occupied on `anyOf(hasSword, hasSpear, hasFire)`, with an `enter` gate back to
the swing on each side that has no stance). The semantics fold now reads a row's own `enter`. The analyzer's
`simplifyRule` absorbs an Or that a sibling implies (`A ∧ (A ∨ B) = A`), so a swing-only side reads `Or(Sword, Spear)`
byte for byte. The base transcription rows are untouched.

## Witness runs (p4g, `probe-seedling-fire-break.mjs --set=rules --record`): ALL CHECKS PASSED

| witness | rules row | result |
|---|---|---|
| `rules-l0-east-cross` | L0 r7c6 → r11c19 (`@288,176`) | press t102 from (280,184); 0 px on 149 ticks; ends L12; flag {0,1} at t114 = goneAt + 1; no hit |
| `rules-l0-west-cross` | L0 r7c6 → r6c5 (`@80,112`) | press t85 from (72,136); 0 px on 151 ticks; ends L1; flag {0,4} at t97; no hit |
| `rules-l0-north-rock` | L0 r2c13 → r1c6 (`@192,32`) | Fire + **swim**: press t69 from (216,40); 0 px on 96 ticks; flag {0,3} at t81; no hit |

The L0 north rock with Fire alone refuses (no corridor from the L89 landing at (240,16), which stands in water). The
rules already charge `Progressive Swim` on every way into r2c13 (`level_89__r11c12 → level_0__r2c13`), so the row is
right as derived.

`--set=rules-refused` (no game witness possible: the solver will not plan these with Fire alone):

| row the rule opens | solver refusal |
|---|---|
| L15 r1c5 → r1c9 | the block route: `pushableblock@64,64` shove (the solver's block-route break takes a swing stance, FIREBREAK residue) |
| L16 r1c9 → r4c21 | the block route of `lock@320,112` (`pushableblock@256,80`, `button@272,48`): stalls at the lock |
| L73 r3c7 → r0c4, r0c4 → r3c7 | combat ladder exhausted, `lavarunner@72,24` |
| L92 r4c2 → … → r7c17 (reverse) | a hit inside the break's wait, `bob@224,112` |

No case the game **refused**. These rows are opened by the source derivation but have **no game evidence**, so they
need a ruling. ⚠ The block search charges a block stepping into a rock the rock's occupancy condition, which is not
sided, so L15's and L16-east's Fire half is not side-checked inside the block route.

## Scope (`seedling_playthrough` AP_1, before → after; each checked against the region atlas's internal exits)

| row | before | after | evidence |
|---|---|---|---|
| L0 r7c6 → r11c19 | Or(Sword, Spear) | +Fire | GAME (this slice) |
| L0 r7c6 → r6c5 | Or(Sword, Spear) | +Fire | GAME (this slice) |
| L0 r2c13 → r1c6 | Or(Sword, Spear) | +Fire | GAME (this slice, with the Swim the entry already costs) |
| L0 r1c6 → r2c13 | Or(Sword, Spear) | +Fire | none; logic-neutral (r1c6 has no door, so it is entered only through this rock) |
| L0 r7c6 @ `L0 flag 1: …@288,176 cleared` | Or(Sword, Spear) | +Fire | GAME (fidelity) |
| L0 r7c6 @ `L0 flag 4: …@80,112 cleared` | Or(Sword, Spear) | +Fire | GAME (fidelity) |
| L0 r11c19 → r7c6, r6c5 → r7c6 | Or(Sword, Spear) (was one bidirectional row) | **unchanged** (now one-way rows) | the in-rock landings: no stance behind |
| L3 r0c4 ↔ r8c6 | Or(Sword, Spear) | +Fire both ways | GAME (fidelity `firebreak-l3-pocket`, from r8c6) |
| L30 r2c10 → level_31__r5c24 (`out_pit_3_34`) | Or(Sword, Spear) | +Fire | GAME (fidelity) |
| L92 r7c17 → r3c12 → r1c7 | Or(Sword, Spear) | +Fire | GAME (fidelity) |
| L92 r1c7 → r3c12 → r7c17 | Or(Sword, Spear) | +Fire | none (solver: hit in the wait) |
| L15 r1c5 → r1c9 | Or(Sword, Spear, Swim) | +Fire | none (block route) |
| L15 r1c9 → r1c5 | Or(Swim, And(Or(Sword, Spear), Swim)) | Fire inside the inner Or | none |
| L16 r1c9 → r4c21 | Or(Sword, Spear) | +Fire | none (block route) |
| L16 r6c8 → r3c7 | And(rope flag, Or(Sword, Spear)) | +Fire | none; logic-neutral (the rope flag already gives r1c1 → r3c7) |
| L73 r0c4 ↔ r3c7 | Or(Dark Suit, Sword, Spear) | +Fire | none (solver: lavarunner) |
| L100 r4c10 → r2c3 | Or(Sword, Spear) | +Fire | none; logic-neutral (r4c10 has no arrival) |
| L100 r2c3 → r4c10 | Or(Sword, Spear) | unchanged | west side: no stance (the 8 px sliver) |
| L40 ×3, L41 ×2 | (And Fire …) | **unchanged** | no clean stance |
| L3/L101 ghost rocks, L53 | — | unchanged (L53: byte order only) | — |
| L71 r11c7 ↔ r13c7 | And(Ghost Spear, Or(Sword, Ghost Spear)) | Ghost Spear | absorption; same logic |

`seedling_er` moves the same rows (the semantic diff is identical; 3 order-only rows).

## Seed 1 (minimal-spoilers)

- `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 1`: the sphere log
  and spoiler are **byte-identical** to main. **No sphere move.**
- `.archipelago` md5: main `9c2cd5555606e8db4660d60c78e9f527` → `cb6f1c582411532544e462f63fb3dfb1` (it embeds the rules).
- The Generate dirt (`preset_files.json`, trailing newline) was reverted.
- Worldgen: `check-worldgen-package-freshness.py seedling_playthrough` → PASS.

## The derived-rule table (not regenerated)

`payloadMd5` `38db6f1571b7724d287e4802262016c4` → `a00d742f2b800ba9852f391d4325a889`. `engineMd5` is unchanged (the
closure does not reach the analyzer or the semantics). **No table row sits in a moved level** (0, 3, 15, 16, 30, 71,
73, 92, 100), so no row blocks. Red by design: `seedlingAtlasDerivation.test.js` › *rebuilds the committed atlas…*
(`make-seedling-playthrough-rules.mjs --check` = STALE table).

`--blocks` was not run: the stop came first. No sphere moved, so every opened row's weight is the same as main's.

## Why it stops: the maze certifier

`certifyEventLocations`, `certifyInternalOnly` (×2), `waterExits` (×2) and `sphereOrderLevels` (×6) go red on L0, for
example:

```
level_0__r7c6 → level_0__r11c19 holding [Fire]: derived false, atlas true
level_0__r6c5 → level_0__r7c6 holding [Fire,L0 flag 4: breakablerock@80,112 cleared]: derived true, atlas false
```

The maze world builds a rock's strikes from the **base** transcription (`seedlingAtlasAnalysis.seedlingLevelEntities`
reads `entitySemantics`): Sword and Spear, struck through the rock's cells from any side. Giving it Fire needs Fire
**only from the stance sides**. The engine strikes an obstacle **either** from `struck_from` stances (the whole entry,
the poles' and ropes' mechanism: `tileStep.js:136-137`, `mazeRoomEngine.js:477,1606-1607`) **or** through its cells,
never both. An unsided Fire strike (a projection-only change) would make the maze looser than the atlas on every
swing-only side (L0's in-rock landings, L16, L53, L73, L92, L100), which is the same red the other way round. ⇒ a
tileSpike engine change: per-action `struck_from` on a cell-struck rock. STOP.

The second reading (`derived true, atlas false` with the flag held) is the same question from the other side: the event
flag opens the cell in the maze, but the atlas row is the swing's.

## Gates run

- Bounded vitest: 102 files (every test that reads the atlas, AP_1, the maze, `seedling_er` or the partition, from a
  guarded `rg -a -l`, plus the brief's list and the no-tracked-pointers guard). Result: **90 files / 1866 tests pass,
  12 files / 23 tests red**:
  - the maze certifier (12, above): **the stop**;
  - pins that follow the atlas id or its counts (expected with any atlas move): `seedlingAtlasDoorCensus` (atlas id
    `seedling-b06ae22d` → `seedling-9cf5e965`; internal exits 305 → 309), `levelSetExporter` (305 → 309),
    `flashSeedlingAtlasKnob` + `flashSeedlingAtlasRoom` ×4 (`atlas_files.json` lists the old id), `vanillaOverlay`
    (fixture md5), `seedlingAtlasDerivation` (the stale table, by design);
  - `seedlingPlaythroughObstacleEvents` ×2: the L0↔L1 binding pin (the event rule gains Fire) and L71's pin (expects
    `And`, the absorption gives `Has(Ghost Spear)`);
  - `seedlingErDoorCensus` (A): the producer now reads `gameLandings` in one more place (the rock-landing tiles), and
    that reader must be named.
- New: `seedlingRockBreakers.test.js` 11/11. Mutations checked: absorption off reds the absorption row; dropping the
  "nothing else" test reds the L40/L41 and overlay rows.
- `fidelityFireBreak.test.js` replays the three new recordings (in the bounded set: green).
- Not run, because of the stop: `census-seedling-constants --write`, `generate-procgen-reference` (the probe gained
  `--set`), the frontier. The 4.2 surveys ran (both exit 0) but were not projected.

## What the planner needs to decide

1. **The engine question** (Robert): per-action `struck_from` on a cell-struck rock, so the maze takes Fire from the
   stance sides only. Without it, this rule cannot pass the certifier.
2. **The unwitnessed openings**: L15 (both), L16 r1c9 → r4c21, L73 (both), L92 reverse. The source derivation opens
   them. The solver refuses them on its block route and combat ladder, not on reach. Accept them, or rule a narrower
   rule.
3. `8f61525d` (the witnesses) is independent and can land on its own.
