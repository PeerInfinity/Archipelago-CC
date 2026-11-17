# cloud-report — rules-lavatrap-neck (rule T, wired)

Branch `claude/rules-lavatrap-neck-nw7jl5`, from `origin/land/rules-move-fireguard`. `git rev-parse HEAD` at setup:
**`2b66279e529cb71b1dc3ef2a149a2c9280dccc8b`**. Main was not merged. `session_bootstrap.sh --seedling` reached READY (wasm
`seedling_bot_ap_p4g`). The six submodules are initialised and no pointer moved. Host settings: `minimal-spoilers`.
Nothing under `worlds/seedling/`, `vendor/seedling` or `.github/` was touched. There is no solver, `levelRun`,
`CONTACT_FIDELITY`, AS3 or level-data change.

⚖ Robert (2026-11-17, direct): "T wired + K measured, 2 parallel". This slice is the wired T. K is not in it.

Evidence is in `CC/docs/cloud-reports/rules-lavatrap-neck-evidence/` (`runs/`, `tools/`, `tapes/`). Base measurements were
taken in a detached worktree at `2b66279e52`, on the same box.

## Answer

| question | answer | evidence |
|---|---|---|
| Which trap classes kill without the Dark Suit | **LavaTrap only.** The only `die()` a body calls on the player outside `Player.as` is `LavaTrap.as:72` (`attached.die()`), behind `if (Player.hasDarkSuit)` at `:64`. SandTrap, DarkTrap (it extends SandTrap) and IceTrap call no `die()` and read no `hasDarkSuit` | `TONGUE_KILL_CLASSES`. A unit row re-derives it from the AS3 whenever the submodule is checked out |
| Where the charge lands | **In the grid (the derivation input).** Every cell in a killing trap's clear-line reach is a **gated** cell costing `Or(Dark Suit, <arms>)`, the kill-lock shape. The analyzer splits the room there and the maze lays the cell as floor plus gate. The trap's own tile, landings and doors are not charged | `seedlingTrapTongueGuard.js`, `baseGridFor` |
| Every disc, or only the sealing ones | **Only where a level's live discs together seal a route** (`discsSeal`, derived). An anchor pair (the derived region's exits, locations and landings) must be connected without the discs and cut with them. Passable means every condition is met by every item but the suit. **Result: L77 and L78 are gated; L80 and L108 seal nothing and are untouched.** Gating every disc was tried first: it renamed L108's `r11c8`, which a table row names, so it would have broken term 2 | `runs/two-grids.txt` |
| The arms (derived, not listed) | **Ghost Spear at all four L77/L78 traps.** Its windows, `[33, 37)` W/E, 33..39 N and 33..35 S, are the witness's own. **Sword, Ghost Sword and Dark Shield:** no cardinal spot outside the disc lands their hit test, because their reach ends inside 33 px. **Fire and the plain Shield:** `Enemy.hit` never damages the trap (`hitByFire` false; the shield only knocks back). **Wand:** the spot is computed (L77 W yes, N no: the wall) but the arm is **not granted**. See § The Wand | `runs/kill-arms.txt` (`tools/killArms.mjs`), unit rows |
| Discs killed in order (L78) | **Yes, derived.** From the L77 landing the first round kills (9,3) and (9,6), then (6,5). From the L79 landing it kills (6,5) first, then the two. Both game runs kill in an order the derivation allows: forward (9,6) → (6,5); reverse (6,5) → (9,6) | `runs/kill-arms.txt` (`order`) |
| Composes with the maze's `pulls` | **Yes, with no engine change.** L77's and L78's `pulls` are **byte-identical** at base and tip. The T cells are laid as `atlas_gate_1` = `Or(Dark Suit, Ghost Spear)` beside them. A move holding the suit is still reeled in by the pull's own gate. One holding only the Spear walks the floor-plus-gate cell | `runs/keywalk-maze.txt`, `tools/mazePulls.py` |
| engineMd5 | **`bec369878feb67081187edca62baa951` (42 files) at base and tip** | `runs/engine-closure-{base,tip}.txt` |
| Movers, rule T on every room (AP_1, `seedling_er`, maze) | **Exactly 4 in each, the expected ones.** L76 ↔ L78 through L77: `FREE` → `Or(Dark Suit, Ghost Spear)`. L77 ↔ L79 through L78: `Or(Dark Suit, Ghost Spear, Progressive Sword)` → `Or(Dark Suit, Ghost Spear)`. No other level moves. The key walks touch only L76 (its exit's renamed target), L77, L78 and id restamps | `runs/route-diff-*.txt`, `runs/keywalk-{ap1,er,maze,atlas,seed1}.txt` |
| Seed 1 | **Every sphere's locations are unchanged; `_Spoiler.txt` is byte-identical.** ⚠ The **sphere-log FILE moved**, in one line: sphere 11.7's `new_accessible_regions` lists L77's three new sub-regions where it listed `level_77`, plus L78's six new ones. Folded to levels it is equal. **Read literally, the brief makes this a STOP: the planner decides** (see § For the planner) | `runs/seed1-sphere-log-diff.txt` |
| Vanilla order, seal | Vanilla-placement spheres: **0 moved** (89/89, last sphere 15). All-items seal: **89/89 at base and tip** | `runs/spheres-vanilla-placement.txt`, `runs/seal-all-items.txt` |
| ER | **The committed draw is kept and stays beatable.** Draws 1, 0 unbeatable, 50 placements, no placement moves; the same 4 movers | `runs/regen-make-seedling-er-preset.log`, `runs/keywalk-er.txt` |
| Certifier (term 3) | **1/16/0 at base and tip, vanilla and `--source=er --arms=new`.** Problems, accepted and threw are **identical rows** at base and tip, in both arms. No row was gained in a T room | `runs/cert-{vanilla,er}-{base,tip}.log`, `runs/cert-base-vs-tip.txt` |
| Calib timing (the maze moved) | **Only the moved L78 is flagged.** L78 goes 186 → 369 ms (normalised 2.12, against a median 0.937 over 53 reference levels). L77 goes 39 → 180 ms, too small to rate. **Every non-moved level stays within 0.704–1.395.** With `--expect-flag=level_78`, ALL CHECKS PASSED | `runs/calib-compare*.txt`, `runs/calib-levels-{base,tip}.json` |
| Derived-rule table (term 4) | **Only L77's rows move, plus `inputs`.** Before/after in § Derived-rule table. `composedDisagrees` is **0** at the tip, and CERT 1/16/0 | `runs/keywalk-derived-table.txt`, `runs/derived-rules-tip.log` |
| The two-grid split (term 1) | **Consistent.** Over all 116 levels, `gridFor` and `gridFor(…, {guards:false})` differ only on L77 (5 cells) and L78 (23 cells), every one of them a rule-T disc cell. Neither level holds a pushable or a rock, so no T cell lies on a block path; a gated cell a block must cross cannot occur | `runs/two-grids.txt` |
| Witnesses: the four charged rows' cheapest new state (Ghost Spear) | **GAME YES on all four.** L77 both ways and L78 forward reuse the chase witness's tapes (the same state). **L78 reverse is new here**: out at **t893**, 0 hits, 0 restarts, with the L78 kill-lock's tag pre-cleared at boot (the lock is not T's; see § Witnesses) | § Witnesses |
| Unit rows (term 5) | **15 / 15.** Mutations m1–m5 each red their row | `runs/vitest-bounded.log`, `runs/mutations.txt` (`tools/mutations.sh`), § Unit rows |
| Bounded vitest | **21 files, 428 tests, all pass** (after one re-pin, `mazeSeedlingLink`, listed below) | `runs/vitest-bounded.log` |

## How rule T is built (`scripts/procgen/seedlingTrapTongueGuard.js`)

- **The disc (tile):** the pull disc (`OV.lavaTrapPulls`: every tile whose centre is within `chompRange` of the trap's, by `int(FP.distance)`), cut to the cells whose centre-to-centre line crosses no wall (`LavaTrap.as:88` `!collideLine("Solid")`).
- **The charge:** `stampOccupancy`. An open cell becomes `gated` with `Or(hasDarkSuit, hasSpear)`. A cell that already holds the condition, or one of its disjuncts, is left alone. This covers a lava cell's Dark Suit, and also the overlap of two discs: commit `49632ae4` fixed a duplicate there. Outputs were byte-identical before and after that fix.
- **The arms (`trapKillArms`, pixel-level):** holding one arm only (the grid's cell conditions are resolved and evaluated with that arm's items), the 1 px flood of the player's position runs from each landing. It uses the model's `playerBoxAt` against the room's solids, in the L99 sided kill-lock's permissive world.
  - The flood never stands in a LIVE trap's reach: `int(distance) <= 32` and `crusher.collideLineSolid` clear.
  - A trap dies when the flood reaches one of its cardinal spots. A spot is a free point on one of the trap's 4 axes, outside the reach, facing the trap, from which the arm's own hit test lands and `enemyDamage.enemyHit` kills. A dead trap stops being live, so the walk can continue to the next.
  - An arm qualifies at a trap when every landing whose plain flood comes near the trap kills it.
  - The hit tests are the production ones:
    - Spear: `presses.spearHitRect`, no Solid test.
    - Sword and Ghost Sword: `combatVerbs.swingHits`, with its point-to-box reach of `width × scaleX` and its line test, at both scales `slashScaleFor` allows.
    - Wand: the model's own shot (`wandShotSpawn`, `createWandShot`, `stepWandShot`), against the trap's box and `collidesSolid`.
    - Dark Shield: the bump, which needs the player's box on the body.
    - Fire and Shield: a spot is offered anywhere, and `Enemy.hit` refuses them.
- **Where:** `discsSeal` (above). The producer passes the anchors (the derived atlas region's exits and locations, plus `arrivalTilesFor`) and `passable`.
- **Producer wiring** (from `de4b4d08db` / `3e70dbad45`, T parts only):
  - `baseGridFor` stamps T last, unless `guards: false` or `arrivals: false`.
  - The rock Fire narrowings (holder census, chaser guard) and the block push model read `{guards: false}`.
  - A LavaTrap lift whose `from` tile rule T gated leaves from the sub-regions beside it. This applies to those tiles ONLY: the unrestricted form, as ported, added two lifts in L108, a non-T mover, so it was narrowed.
- **The per-level derivation output** (`playthroughTrapKillArms`):

| level | trap | arms | Spear windows (W/E/N/S, px) | killed from (Spear) | Wand spots | Sword / GhostSword / DarkShield | Fire / Shield |
|---|---|---|---|---|---|---|---|
| L77 | 6,12 | **Ghost Spear** | 33..37 / 33..37 / 33..39 / 33..35 | `1,2` and `6,18` | E, W, S (N: the c6 r11 wall) | 0 spots | `Enemy.hit` never kills |
| L78 | 9,3 | **Ghost Spear** | same | `16,1` and `2,1` | all four | 0 spots | never kills |
| L78 | 6,5 | **Ghost Spear** | same | `16,1` and `2,1` | all four | 0 spots | never kills |
| L78 | 9,6 | **Ghost Spear** | same | `16,1` and `2,1` | N, W | 0 spots | never kills |
| L80, L108 | — | not stamped (their discs seal nothing) | | | | | |

The seal pairs: L77 `0,2`/`1,2` ↔ `6,18`/`6,19`; L78 `2,0`/`2,1` ↔ `16,0`/`16,1`.

### The Wand: computed, not granted

The Wand's geometry is derived. On L77 it has a spot from W but none from N (the wall stops the shot), exactly as the witness found. But its kill is 6 shots, each after the trap's 30 i-frame ticks: `WandShot.as:29` damage 0.5 against `hitsMax` 3. So the player must stand at the spot for about 150 ticks.

Whether the room's other bodies allow that stand is a chase question. That is rule K's (out of scope), and the witness's Wand crossings were GAME NO because of runners and the bulb. The arm is therefore left out of the gate by name (`ARM_TIME_UNDECIDED`) rather than from a list, and its spots stay in the derivation's output.

## Witnesses

Every row is the Ghost Spear alone on the DELIVERED set (`play.mjs --spot=delivered`), headless and logic-only.

| charged row | old cheapest state | new cheapest state (Spear) | verdict | evidence |
|---|---|---|---|---|
| L77 forward, L78 → L76 | FREE | Ghost Spear | **GAME YES** (reused: same state, same set) | chase witness `chain/l77-fwd-spear`: out at **t538**, 0 hits, 0 restarts, trap dead at t178, the player ≥ 34.00 px away until then. Tape copied to `tapes/reused/` |
| L77 reverse, L76 → L78 | FREE | Ghost Spear | **GAME YES** (reused) | `chain/l77-rev-spear`: out at **t530**, 0 hits, 0 restarts, trap dead at t332 (W spot) |
| L78 forward, L77 → L79 | Progressive Sword | Ghost Spear | **GAME YES** (reused) | `l78/l78-fwd-spear`: out at **t897**, 0 hits, 0 restarts. Kills (9,6) at t216 and (6,5) at t627, from ≥ 36.21 / 33.55 px; (9,3) is never nearer than 34.23 px. The derivation's order from that landing is the same, (9,6) then (6,5) |
| L78 reverse, L79 → L77 | Progressive Sword | Ghost Spear | **GAME YES** (new). ⚠ Booted with L78 tag 0 (lock@32,32, the kill-lock) pre-cleared, so it measures rule T's traps, not the lock | `runs/game/l78r/L78r-spear-full.game.json.gz`, tape `tapes/beam/L78r-spear-full.tape.json`: out to L77 at **t893**, **0 hits, 0 restarts**. (6,5) killed from its W spot (70.38, 87.53), gone at **t213**, never nearer than **33.53 px** alive. (9,6) killed from its W spot (116.95, 103.22), gone at **t632**, never nearer than **35.06 px**. (9,3) stays alive, never nearer than **33.57 px** (t754). The Spear also kills four runners on the way. Order (6,5) → (9,6), as the derivation's L79-side order. Summary: `runs/game-l78r-spear-full-summary.json` (`tools/trapNear.py`) |

**How the L78 reverse tape was built** (`tools/chase/l78rev.mjs`, `tools/chase/beam.mjs`; the model only chooses keys and the game decides):
1. A beam from the L79 landing (32,16) to (6,5)'s W spot tile. It holds `--avoid` on all three traps, `--clear=78` (no awake runner within its `runRange`) and a new `--settle=16`: a goal state counts only if 16 idle ticks after it stay hit-free and alive. Without it, the beam's last held segment slid the player into lava a tick after "arriving".
2. Hand nudges into the window and 3 thrusts 40 ticks apart. Then the player stands at (80,86) and thrusts every 10 ticks, so the runner the walk wakes runs onto the Spear (`l78r-kill65r`: alone on the game, clear, 0 hits).
3. A beam to (9,6)'s W spot tile, a hand kill, and a beam to the L77 door (`--avoid` (9,3) only).

Try 1 (`*-try1`) had no step 2's stand: (6,5) still died hit-free at t213, but `lavarunner@144,72` hit at **t388**, where the model's beam had killed it. That is a body divergence (rule K's), not the trap.

**The old cheaper states:**
- **L77 item-less: GAME NO**, already witnessed. rules-chaser-arrival-killarm reverse: dies at t32. Chase witness forward: tongued t52–57, dead t63.
- **The Sword at L77's trap: GAME NO**, already witnessed. `spot/l77spot-{N,W}-sword` leave the trap alive, and the crossing dies.
- **The Sword through L78:** not played here. (6,5) is the same class with the same reach, and the Sword has no spot outside the disc (derived). No route to L79 avoids (6,5)'s disc (its seal pair).

**Not witnessed here (named):**
- The **Dark Suit alone** state on these rows. The suit's release at the trap is the pull rule, and both rooms' runners hit a suit-only player in the chase witness's attempts. That is rule K's question, measured by the parallel K slice.
- The **L79 pocket's kill-lock** (below). The reverse witness pre-clears it.

## Derived-rule table (term 4)

Regenerated locally by REGEN_RECIPE, in three passes:
1. The stale table names `level_76 -> level_77`, an element rule T renames, and the producer refuses it. So pass 1 ran rules → partition → maze → ER with the table moved aside.
2. `probe-seedling-derived-rules.mjs --shards=2` emitted the new table, and pass 2 re-ran the producers with it.
3. `GITHUB_SHA=49632ae45b… node scripts/procgen/probe-seedling-derived-rules.mjs` at that HEAD: **the table matches the committed one, every pinned count matches, CERT 1/16/0, ALL CHECKS PASSED** (`runs/derived-rules-tip.log`). Re-run on CI per REGEN_RECIPE: it should differ only in `measuredAt`.

| row | before | after |
|---|---|---|
| `level_76\|level_76 -> level_77` | `True_` | **renamed** `level_76\|level_76 -> level_77__r2c0`, `True_` (the same element: L77's north part is now `r2c0`) |
| `level_77\|level_77 -> level_76` | `True_` | **left the table**: the element is now `level_77__r2c0 -> level_76`, composed `FREE` |
| `level_77\|level_77 -> level_78__r0c16` | `True_` | **left the table**: the element is now `level_77__r15c6 -> level_78__r0c16`, composed `FREE` |
| `inputs.payloadMd5` | `c03264c5…` | `1f1a4d53…` |
| `counts` | rows 108, regions 51 | rows 106, regions 50 |
| `excluded` | 6 | 6, unchanged |

- No L78 row and no other level's row moved. `composedDisagrees` = 0.
- `seedling-derived-rules-expected.json` was re-recorded for 15 drifted counts, all from the same split, with the reason in its `$comment`:
  - path-vs-edge 126 → 133, derived pairs 204 → 213, regionsPriced 204 → 205, arrivalNodes 240 → 241;
  - overridable 60 → 59, unpriced 305 → 354 (L78 now holds 47 unpriced rows: six internal-only sub-regions).

## Re-pinned (each with its reason in the file)

| what | before → after | where |
|---|---|---|
| atlas id | `seedling-630fbc4c` → `seedling-ac434804` | `levelSetExporter.test.js`, `seedlingAtlasDoorCensus.test.js`, `atlas_files.json` |
| atlas md5 | `26bec328…` → `687a6ad3…` | `vanillaOverlay.test.js` |
| internal exits | 316 → 355 | `levelSetExporter.test.js`, `seedlingAtlasDoorCensus.test.js` |
| regions with a subgraph / sub-regions | 56 → 57 / 207 → 216 (L77 +3, L78 +6) | the same two |
| L78's maze crossing | `[["Dark Suit"],["Ghost Spear"],["Progressive Sword"]]` → `[["Dark Suit"],["Ghost Spear"]]`, both ways | `certifyLavaPulls.test.js` (the L77 + L78 + L79 cut still certifies clean, native = scripted: `runs/cert-l77-l78-cut.txt`) |
| roomless maze regions | 150 → 158 (the new sub-regions share their level's world) | `mazeSeedlingLink.test.js` |
| campaign frontier `sources` AP_1 md5 | `8c3cdc8a` → `03d7cb80`, by hand | `campaign-frontier.json`; `--check-frontier`: 15 pass / 0 fail (2 SKIP, as at base) |
| derived-rules expected counts | 15 counts (above) | `seedling-derived-rules-expected.json` |

The delivered-set ids and the identity digests did not move: no level data changed.

## Unit rows (`scripts/procgen/seedlingTrapTongueGuard.test.js`, 15)

- **Synthetic rooms:**
  - the disc on the only neck charges, both ways;
  - a trap with a way round charges nothing (`discsSeal` empty, grid untouched);
  - SandTrap on the neck charges nothing;
  - a spearable trap gets the Spear arm, from both landings (W window `33..37`);
  - the Sword, Ghost Sword and Dark Shield have no spot (derived from `swingHits`'s reach);
  - Fire and Shield never kill (`hitsToKill` is ∞; Spear 2, Wand 6);
  - the Wand is not granted;
  - no cardinal spot exists (axis tiles are walls): Suit only;
  - a spot reachable only beyond the disc from one landing: Suit only;
  - two traps killed in order (the L78 shape).
- **Delivered, through the producer:**
  - L77's disc seals and its crossing costs `Or(Dark Suit, Ghost Spear)`;
  - L78: three traps, Spear from both landings, no duplicated gate;
  - L80 and L108 are not stamped.
- **The AS3 re-derivation row** (skipped without `vendor/seedling`).
- **Mutations, each red:**
  - m1 (`discsSeal` ignored) → the way-round row and L80/L108;
  - m2 (the flood ignores live reaches) → the beyond-the-disc row;
  - m3 (a killed trap stays live) → 5 rows, the in-order row among them;
  - m4 (the spot search starts inside the disc) → the Sword row and the Spear window row;
  - m5 (`tongueKills` ignores the class table) → the SandTrap row.

## For the planner

1. **The seed-1 sphere-log file moved, on region names only.** The brief says "Seed 1's sphere log or spoiler moving is a STOP", and its Stops list says "Seed 1's spheres move".
   - What moved: no location changed sphere and the spoiler is byte-identical.
   - The one changed line is sphere 11.7's `new_accessible_regions` (`level_77` → `level_77__r2c0`, `__r12c6`, `__r15c6`, plus L78's six new sub-regions).
   - Any gated-cell rule that splits a room renames its regions there. This slice reads it as no sphere move, but **flags it**: if the literal reading holds, this is the STOP and nothing here should land.
2. **The L79 side of L78 is gated before rule T's traps by things that are not T.**
   - The lock@32,32 kill-lock opens only when the room's runners are dead. From the 1-wide L79 pocket (a floor column in lava), only `lavarunner@96,32` wakes, and it swims to the pocket and hits a player standing there (seen on the model).
   - The base rules already grant L79 → L77 for `Or(Dark Suit, Sword, Spear)`. Rule T only removes the Sword.
   - The reverse witness therefore boots with tag 0 pre-cleared. Whether the pocket can clear the lock hit-free is the encounter-lock rule's question (sided, like L99's) and rule K's. Neither is decided here.
3. The derived-rule table and expected counts were measured locally (`GITHUB_SHA=49632ae45b`). The CI re-record per REGEN_RECIPE should differ only in `measuredAt`.
4. The calib base and tip ran on the same box (4 vCPU), one after the other. Parts of both overlapped other work: producer runs, bounded vitest, and the derived probe on 2 shards. The compare normalises by the median over 53 levels, and every non-moved level stays within 0.704–1.395. A CI pair would be the clean number.
5. The L80 / L108 discs stay ungated because no route needs them. A walk into them without the suit is the game's death, but the logic grants no route that must take one.

## Commits

1. `45ae03cc` rule T: the module, its unit rows, the producer wiring, `maze.md`
2. `cd84386f` re-record by recipe: atlas, AP_1, partition, maze, `seedling_er`, world package, seed 1, `atlas_files.json`, procgen reference, the derived table, the expected counts
3. `3e6cbc37` re-pins
4. `b945a617` the campaign frontier `sources` md5
5. `49632ae4` one gate per cell where discs overlap (outputs byte-identical)
6. `185ecb53` the table's `measuredAt`
7. `8c88a337` the `mazeSeedlingLink` re-pin
8. `9bc1fcfe` `trapKillArms` records the kill order per landing (no output moves)
9. `72ef88a0` evidence
10. this report
