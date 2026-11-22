# Cloud report: rules-fatal-tile-walkable-census

Slice `rules-fatal-tile-walkable-census`. REPORT ONLY: no rule, preset, atlas, table, solver, levelRun,
`CONTACT_FIDELITY`, level-data or engine-closure change. Branch `claude/rules-fatal-tile-walkable-3m33e2`.

- Base: `origin/main` = **c1b250e638** (`git rev-parse origin/main` = `c1b250e6380746f579b509132868c0d7818de560`; later than 3c602f965d).
- engineMd5 at the base, quoted from this worktree with the submodules initialized: **`74ae60f575531492ed9eaec1839e1fe3`** (`seedlingDerivedRuleTable.engineMd5()`).
- Game: wasm `seedling_bot_ap_p4g`, headless logic-only (asserted on every page), set `seedling-vanilla-record-23510f80`, a fresh page per tape.
- Evidence: `CC/docs/cloud-reports/rules-fatal-tile-walkable-census-evidence/` (paths below are relative to it).

## Answer table

| Q | Answer | Decided by |
|---|---|---|
| **Q1** static: does L78 `r0c16 → r6c11`'s own witness cross a player-fatal tile the maze calls walkable? | **NO.** The derive returns the same 10-step witness for all four suit-less sets, `{Ghost Spear}`, `{Progressive Sword}`, `{Wand}` and `{Progressive Shield×2}`: (16,1)→(16,4)→(15,4)→(15,5)→(13,5)→(13,6)→(11,6). None of its cells is lava, water or pit. It crosses **three igneous-to-lava tiles (t=31)** at (16,2), (16,3) and (16,4). **No TILE CLASSIFICATION bug.** | `q1-L78-witness.json`; the derive is `deriveLevelWorldLogic(world, HELPERS, {native: true})`, the certifier's own call (`certifyPlaythroughMaze.js:590`) |
| Q1: the census's death at (255,54) | **Not a lava edge and not a hitbox margin. It is IGNEOUS CONVERSION under a player who stood still.** The census tapes stop giving input at t32 ("model best node, goal NOT reached") and then stand at (254.7,53.6) on the igneous tile (15,3). That tile turns into lava at **t58**, which the source predicts to the tick. That is the first `hits_timer` arm in all 6 lines. The restart is at t88. The derived path does not go through (15,3). | `Tile.as:390-424`; `q1-igneous-timing.txt` |
| Q1 (designer, binding): which point the game samples for `eff` | **ONE POINT, (x, y+1). Not an overlap.** `getState` picks the Tile entity whose CENTRE is nearest to (x, y + checkOffsetY), and takes its `t` only if that tile's rectangle meets the (shifted) hitbox. `checkOffsetY = -originY + height - 2 = -2 + 5 - 2 = 1`. Tile centres sit on the 16-px grid, so the nearest centre is the tile that contains (x, y+1). The pixel-pull-disc stand box is **not** needed. | `Player.as:295,432-434,677-689`; `World.as:659-668` (`nearestToPoint`, centre distance); `Tile.as:103,109` |
| Q1 margin | On the derived centre-line, the sample point is at least **7.0 px** from any lava tile. The tightest spot is the turn at (16,4), above lava (16,5). The game player **slides about 6.5–7 px after a key is released**. An open-loop line that released at the (16,4) centre slid to (256.1,80.6), into (16,5), and took a lava hit at t50 (damage 0, `hits_timer` armed). So this route is tight but walkable; it is not a reachability problem. | `q1-margins.txt`; run `runs/q2-try/*-walk-wand` t43→t50 |
| **Q2** game witness, suit-less, exact derived path, fresh page each | **{Progressive Sword}: GAME YES**, twice, on the exact derived cell sequence: `sw-a100-p14-sword` stands on (11,6) at **t151** and `sw-a124-p14-sword` at **t150**. Neither has a hit or a lava contact before the goal (each takes a lavarunner hit later, at t174 / t170, while standing at the goal). **{Ghost Spear}, {Wand}, {Progressive Shield×2}: UNWITNESSED**, because of LAVARUNNER CONTACT (the K chaser question). In the 78 played lines, every enemy hit before the goal came from a `LavaRunner`, around (13,6)/(12,6)/(11,6) or along row 5. The only lava contacts before the goal are the uncompensated slide into (16,5) and four sword lines pushed into (13,7) with a runner 7–11 px away; both are listed below. | tables below; `q2-*-verdicts.jsonl` |
| **Q3** general census: all levels, all three presets | **NONE.** No derived row's witness crosses a player-fatal tile that the maze treats as walkable for that row's item set, with the Dark Suit respected. 2,900 witness paths were replayed on the engine's `step` (2,435 in-world, 465 entry; 0 refusals). They contain 105 fatal-typed cells, and every one has a sound reason: 49 are the CROSSING itself (a pit or water exit, the last cell of the path), 52 are ENTRY-GATE water in L50/L52 (Swim is charged on every entrance in all three presets), and 4 are ARRIVALS on a pit exit tile (the same reach as the floor neighbour). Classifier census over every maze cell: **0 lava cells walkable without the Dark Suit**. | `q3-census.json` (`unexplained: []`), `q3-classifier-census.json`, `q3-witness-paths-all.json.gz` |
| **Q4** fix sketch | **Not applicable: no classifier bug found.** The one mechanism the static grid does not model is igneous conversion. It is ruled free on purpose (`IGNEOUS_IS_FREE`, a standing ruling), and this census found no witness that waits on, revisits or acts on an igneous tile (below). Notes for the designer and for tape authors are at the end. | |

## Q1: the derivation's own witness, cell by cell

Classifier chain for every cell: `make-seedling-playthrough-rules.mjs:703-718` (`rawBaseGridFor`) → `seedlingSemantics.buildSeedlingRegionGrid`
(`seedlingSemantics.js:1047`) with `tileOverride: OV.overlayTileSemantics` (`:708`; `seedlingPlaythroughOverlay.js:1485`), then the stamps
(`stampEncounterLocks`, T, K: `make-seedling-playthrough-rules.mjs:559-570`). The atlas compile carries that grid into the maze world, so the
`atlas_gate_*` obstacles are the grid's gated cells.

Same path for all four sets (`q1-L78-witness.json`):

| # | cell | maze class | grid kind (decider) | raw t (level data) | game effect, suit-less |
|---|---|---|---|---|---|
| 0 | (16,1) | floor (arrival) | open (TILE_TYPE_SEMANTICS fallback, t=16) | 16 igneousStone | none |
| 1 | (16,2) | floor | open (**`PLAYTHROUGH_TILE_OVERLAY[31]` = `IGNEOUS_IS_FREE`, overlay:1440-1476**) | **31 igneousToLava** | converts after dwell (Tile.as:390-424) |
| 2 | (16,3) | floor | open (IGNEOUS_IS_FREE) | **31** | converts after dwell |
| 3 | (16,4) | floor | open (IGNEOUS_IS_FREE) | **31** | converts after dwell |
| 4 | (15,4) | floor | open | 16 | none |
| 5 | (15,5) | obstacle `atlas_gate_3` (Sword ∨ Spear ∨ Wand ∨ Shield×2) | gated: RULE K stamp (`stampChaserGuards`, :564-570) | 16 | none (chaser guard) |
| 6 | (14,5) | obstacle `atlas_gate_3` | gated: RULE K | 16 | none |
| 7 | (13,5) | floor | open | 16 | none |
| 8 | (13,6) | floor | open | 16 | none |
| 9 | (12,6) | obstacle `atlas_gate_3` | gated: RULE K | 16 | none |
| 10 | (11,6) | floor (target, r6c11) | open | 16 | none |

**Player-fatal tile effects in the source** (the full list checked):

- **lava**, `eff == 17 && !hasDarkSuit`: `Player.as:1460`. Each frame it calls `hit(null, 0, null, 0)` (:1468; damage 0, `hits_timer` armed), and the drown timer then calls `die()` (:1442).
  The grid's rule is gated `hasDarkSuit` (`seedlingSemantics.js:220`).
- **water**, `eff == 1 && !canSwim`: `Player.as:1456` → drown → `die()`. The grid's rule is gated `canSwim` (`seedlingSemantics.js:200`).
- **pit**, `eff == 6` while `onGround`: `Player.as:720-724` → `checkFallingInPit` → `die()` (:768) or the level's fallthrough. The grid calls it a `sink` (`seedlingSemantics.js:205`).
- **igneous-to-lava, t=31**: not fatal when placed, but it becomes `t = 17` (`Tile.as:422`). The grid table rules it `manual` (`seedlingSemantics.js:250`); the
  playthrough overlay overrides that to `open` (`IGNEOUS_IS_FREE`).
- Not fatal: waterfall (25) pushes but does not drown (`inWater`, but `checkDrowning` tests only `eff == 1`); ice (22) is slide only.

**Conversion timing, from the source:**

- The countdown runs only while the player ORIGIN is within `sqrt(16²+16²)/2 = 11.31 px` of the tile centre (`FP.distance(p.x, p.y, x, y)`; a Tile's x,y is its centre, `Tile.as:103`).
- `igneousCounterMax = 8` (`Tile.as:83`), so `igneousBreakApart` is set on the 9th in-range frame. The counter does not reset when the player leaves range.
- After that, one `sprIgneousLava` frame every 9 frames, whether or not the player is near. The sprite has 3 frames (`IgneousLava.png` is 48×16, `Game.as:278-279`).
- So the tile is lava on **frame 36 after the first in-range frame**, as long as the player was in range for 9 frames.

On the census tapes (copied to `census-L78/`), `tools/igneous.py` predicts (15,3) → lava at t58. Every one of the 6 lines takes its first
`hits_timer` arm at **t58** and restarts at t88. The same lines also converted (16,2) at t41 and (15,2) at t49, behind the player.

**Slack on the exact-path GAME YES line** (`sw-a100-p14-sword`; `q1-igneous-timing.txt`): the sample point leaves (16,2) at t20 and the tile
converts at t41, leaves (16,3) at t33 vs t54, and leaves (16,4) at t54 vs t68. That is 21, 21 and 14 frames of slack. A line that keeps
walking is safe. A line that stands still (the census's) dies about 36 frames after it arrives.

## Q2: the tapes

Hand tapes, authored by `tools/pathtape.mjs`: the witness path centre to centre, one axis at a time, 1.17 px/tick, released 2.6 px early, an
8-tick gap after each leg, and the seam items as flags with `equips: []`. **The slot trap does not apply:** each set holds one item, so the
fresh page's slot array is that item alone (`slots: [2]` for the Wand in every read), and `primary` names it. Played with `tools/wand/wplay.mjs`
(the census's, fresh page per tape). Verdicts come from `tools/verdict.py`: GAME YES means the state sample point stands in (11,6) before any
`hits_timer` arm and before any restart.

| run | set | verdict | goal | hits / lava contacts (tick, x/y, cause) |
|---|---|---|---|---|
| `runs/q2-sweep/…-sw-a100-p14-sword` | Progressive Sword | **GAME YES, exact path** | t151 | none before the goal; t174 enemy (LavaRunner) while standing at the goal |
| `runs/q2-sweep/…-sw-a124-p14-sword` | Progressive Sword | **GAME YES, exact path** | t150 | none before the goal; t170 enemy (LavaRunner) at the goal |
| `runs/q2-try3/…-walk3atk-sword` | Progressive Sword | GAME YES, adjacent line (row 5 for the last two cells: (12,5), (11,5)) | t126 | none |
| `runs/q2-sweep/…-sw-a100-p10-wand` | Wand | hit at the goal: exact path, but hit on arrival | t159 | t159 enemy at (188.0,103.2), LavaRunner(194,104) 6.3 px |
| `runs/q2-try3/…-walk3atk-spear` | Ghost Spear | UNWITNESSED | — | t147 enemy at (206.4,105.5), LavaRunner(208,115) 9.4 px |
| `runs/q2-try3/…-walk3atk-shield2` | Progressive Shield×2 | UNWITNESSED | — | t132 enemy at (217.9,100.4), LavaRunner(210,111) 13.1 px |
| `runs/q2-try/…-walk-*` (no slide compensation) | all | UNWITNESSED | — | **t50 lava contact (damage 0) at (256.1,79.6): the slide into (16,5)**, then runner hits t122 / t151 |

- All 78 lines (`q2-walk-verdicts.jsonl`: 12, `q2-sweep-verdicts.jsonl`: 48, `q2-pause-verdicts.jsonl`: 18; tapes under `tapes/`) were
  checked: every slide-compensated line that reaches (13,6) gets there with no lava contact (checked over all 74 such lines).
- Every hit before the goal is a `LavaRunner` coming out of the lava south of row 6 or along row 5.
- The other lava arms in those files come from three things, none of them the derived line itself:
  - four sword lines pushed off the line into (13,7) lava with a LavaRunner 7–11 px away (`sw-a112-p6/p10/p14-sword`, `sw-a124-p6-sword`,
    t129–135; the push is either the slash-dash knockback or the runner's contact);
  - the tape's leftover inputs after a restart walking off the boot tile into (15,1) (`q2-pause` t186+, `sw-a100-p6-sword` t147);
  - the uncompensated slide above.
- The Spear/Wand/Shield×2 outcome is the chaser duel the wand census already measured. It is not a terrain question.
- No CI dispatch was made. Everything ran in this container (B1 does not apply).

## Q3: the census

**Scope.** All three presets compile from the same producer grid: `playthroughGridFor`; `seedling_er` re-runs `compilePlaythroughRules` on
the shuffled doc and moves stairs only. Only `seedling_playthrough_maze` carries walkable witnesses, and the certifier holds its rows equal
to the atlas rows. So:

- the **witness census** covers every derived row of the maze preset: `tools/witness-cells.mjs --entry`, which runs every shared world's
  `deriveLevelWorldLogic` and every region's `deriveEntryLogic` (without `arrivalBlocked`, which can only refuse more), and replays each
  witness on `step`;
- the **classifier census** covers every maze cell, and so the grid the other two presets share: `tools/classcensus.mjs`. A cell counts as
  walkable without its protector when it is floor and its obstacle clears with every pool item except the protector.

**Classifier census tally** (`q3-classifier-census.json`):

| raw tile | cells | walkable without the protector |
|---|---|---|
| lava (17) | 1,826 | **0** |
| water (1) | 5,370 | 121: L50 and L52 (ENTRY GATE, below), plus L57 (5,3) (below) |
| pit (6) | 2,787 | 41, all EXIT cells: the pit drop is the AP exit |
| igneousToLava (31) | 86 | 86, ruled free (L71, 74, 76, 77, 78, 85, 99) |

**Witness census** (`q3-census.json`): 105 fatal-typed cells on witness paths, **0 UNEXPLAINED**.

| disposition | cells | levels | why it is not looser |
|---|---|---|---|
| CROSSING | 49 | pits L12, 16, 30, 32, 40, 43, 48, 56, 58, 70, 71, 83, 84, 100, 110; water exits L0, 50, 52, 54 | it is the exit tile itself and the last cell of the path (`endsWalk` stops the walk there). The drop or edge is the AP exit being priced. |
| ENTRY GATE | 52 | L50 (entry), L52 (in-world and entry) | `entryGateOf` (`make-seedling-playthrough-rules.mjs:491-517`) lifts a level's single shared binding gate, here `canSwim` (measured: `playthroughEntryGate` = `{"flag":"canSwim"}` for both). Every entrance into L50/L52 from another level names Progressive Swim in all three presets (6 of 6 in each). |
| ARRIVAL ON A PIT EXIT TILE | 4 | L71 `r14c12` (3 rows), L84 `r2c4` (1) | the sub-region's entrance cell is its pit exit. Reach from the pit cell equals reach from its floor neighbour (12,14) for all 3 L71 sets (`q3-pit-arrivals.jsonl`). The L84 row is the drop itself. |

- **L57 (5,3)** (classifier only; on no witness path). Raw water; the grid says `gated canSwim`; the maze obstacle there is
  `(Sword ∨ Spear ∨ Wand)`, so the Swim is not on the cell. It is the Tentacled Beast's Seal location tile. Without the Swim, L57's arrival
  reaches **1 cell, itself** (`q3-l57-cell.txt`), so no row gets looser. This is a cosmetic mismatch between the grid and the maze cell; a
  designer may want it named.
- **Igneous rows** (suit-less sets only): 159 witness paths cross igneous tiles (L71: 9, L74: 48, L76: 2, L77: 2, L78: 84, L99: 14).
  - **0 revisit an igneous cell.** Adjacent tile centres are 16 px apart, more than the 11.31 px range, so only the cells on the path start counting down.
  - **0 put a non-moving plan input (turn or use) on one.**
  - 41 end on one; the target is stood on, and the row does not wait there.

## Q4 and notes for the designer

**No classifier bug, so no fix to sketch.** No rows would get stricter. Two observations, neither a change request:

1. **Igneous is a timing hazard, not a reachability one, and the ruling covers it.** `IGNEOUS_IS_FREE` (overlay:1440-1476) rests on three
   things: it starts walkable, the conversion resets on level entry, and walk order is the tape generator's burden. The game confirms the
   first two on these tapes: the derived line has 14–21 frames of slack and the reset holds at the restart. The census's "lava at (255,54)"
   is that burden, not met: its lines stood on (15,3).
   A tape or solver line that pauses, fights or waits on a t=31 tile without the Dark Suit dies 36 frames after it first comes within
   11.31 px. **Guidance for tape authors and `wsim`:** treat a t=31 tile as lava 36 frames after first approach, and never idle on one.
   If a general guard were ever wanted, it would be one source in the producer's grid terms: per t=31 tile, the dwell budget (9 in-range
   frames to start, then 27 frames), checked against the witness's dwell. Only lines that stop on igneous would change; this census's
   0 / 0 / 41 counts are the candidates. It is an engine-closure change and would queue behind the pixel-pull-disc and nit (B).
2. **Within one visit, igneous is one-way for a suit-less player.** After a pass, the tiles behind become lava until the level is
   re-entered (`Game.as:1966-2010` rebuilds every Tile). L78's (16,1) pocket, for example, cannot be re-entered suit-less in the same visit
   once its column is walked. AP reach is monotone and the pocket is reachable again through the L77 teleporter, so no derived row depends
   on the return. This is noted only because it is the same mechanism.

## Reproduce

```
cd CC/docs/cloud-reports/rules-fatal-tile-walkable-census-evidence
node tools/witness-cells.mjs --levels=78 --pair='level_78__r0c16>level_78__r6c11' --out=q1-L78-witness.json
node tools/rawjson.mjs 78 > l78-raw.json
python3 tools/igneous.py l78-raw.json census-L78/runs/*.gz
node tools/pathtape.mjs --path=16,1:16,4:15,4:15,5:13,5:13,6:11,6 --boot=78:256:16 --speed=1.17 --slide=2.6 --gap=8 --hold=120 \
  --tag=sw-a100-p14 --attack=<primary:t-t+2 every 14 from 100> --out=tapes/q2-sweep
node tools/wand/wplay.mjs --spot=delivered --tapes=<tape.json,…> --out=runs/<dir>   # dev server on 8000, takes the box lock
python3 tools/verdict.py runs/<dir>/<run>.game.json.gz 11,6 l78-raw.json
node tools/witness-cells.mjs --entry --out=<all.json>; gzip it; python3 tools/q3summary.py <all.json.gz> q3-pit-arrivals.jsonl > q3-census.json
node tools/classcensus.mjs --out=q3-classifier-census.json
```
