# Content sets GEN-4: the generator places `one-way` tile kinds

Branch `content-gen4`, based on `origin/main` `e6e571c4b2`. The design is GEN-D's (§ 2.4, § 2.5, § 4 GEN-4). The brief
is the planner's GEN-4 prompt.

⚖ Rulings in force:
- Robert, 2026-11-25 (via liaison-6): "AN-TIME-4 and GEN-4 in parallel (Recommended)".
- GEN-1's rulings (Q1 to Q8), and GEN-3's planner ruling A (law (d) strict and local), unchanged.
- Planner (content-5), 2026-11-25, on this slice's STOP (§ 6.1): **APPROVED**, use the gate-aware (a) and (c), on four
  conditions: (1) pin that with no entry gate the walk is `computeLongestShortestPath`, over committed rooms, with a
  mutation; (2) count the committed rooms with entry gates, and say whether any GEN-1/GEN-3 decision moves on them, with
  every committed preset byte-identical; (3) the payload's `longestShortestPath` stays the serializer's value, and the
  report and `maze.md` say (c) compares the gate-aware walk; (4) the yield and the per-law counts go in the report.

## Commits

| # | SHA | What |
|---|---|---|
| 1/3 | `1a6e5a5386` | `mazeTileKindsGen.js`: the `one-way` row; law (a) through `gate: null` entry gates, and its own-cell exemption only for a kind that lowers to a wall; law (c) as `tileKindWalk` (gate-aware). The fixture pack `slope`. The unit pins |
| 2/3 | `9ad92953ed` | `procgenPipeline/oneWayTileKindsWorld.slow.test.js`: the world proof, with play and draw |
| 3/3 | this commit | Docs: `maze.md` § Region biomes (and PASS-1's stale pass list); the regenerated README index and `docsIndex`. This report and its screenshot |

## 1. What was built

### 1.1 The row

`TILE_KIND_PASS_LAWS` gains `one-way: { lowers: true, rules: byte-equal, fromArrivals: true }`. Nothing else in the
generator branches on the pass:
- `generatedTileKinds` already carries the terrain's own fields, so a one-way kind arrives as
  `{kind, pass: 'one-way', dirs}`;
- `lowerTileKind` (PASS-3) writes the owned `gate: null` entry for every direction not in `dirs`, and `liftTileKind`
  removes them;
- the serializer writes `dirs` and `entry_gates` through PASS-3's path (`tileKindDirsAt`, `entry_gates`).

The serializer's copy already shared `entryGates` safely: both `lowerTileKind` and `liftTileKind` replace the Map
copy-on-write. This is pinned (the world's `entryGates` stays undefined after a placing serialize).

### 1.2 Law (a) and law (c) see entry gates (the STOP, § 6.1)

- **(a)** `floorReach` floods over walls **and `gate: null` entry gates** (GEN-D § 2.4(a) already said so; the code
  predated gates).
- **(a)'s own-cell exemption.** GEN-1 skipped the kind's own cell, which is right for a pillar (it becomes a wall).
  It is now skipped **only when the kind lowered it to a wall**. A kind that keeps its cell floor must stay reachable
  itself. Without this, a ledge whose only open side faces a wall is accepted: no move can enter it, so it is a wall
  drawn as a ledge (§ 6.2). For `needs` nothing changes, because obstacles are transparent to the flood.
- **(c)** compares `tileKindWalk(world) = { length, oneWayPairs }`:
  - in a room with **no entry gate** it is `{ computeLongestShortestPath(world), 0 }`, which is GEN-1's measure exactly;
  - **with entry gates**, `length` is the same longest shortest path between the entrance and the exits, measured in
    **both directions** of every pair and **through the gates**, and `oneWayPairs` counts the pairs walkable one way
    only. Both must be unchanged (refusal `moves-walk-length`).
  - Why `oneWayPairs`: the length skips an unwalkable pair (as GEN-1's does), so a ledge that makes an exit unable to
    walk back to the entrance would otherwise pass (c). The serializer pin caught this (§ 6.2).
- **The payload's `longestShortestPath` stays the serializer's undirected value.** (c) holds the gate-aware walk equal
  to the room's before the kind, so the recorded loop cost stays the true walk.

## 2. The pins (`mazeTileKindsGen.test.js`, GEN-4 rows)

Three fixture rooms are built in the test:
- **the RING** (3×3): the entrance (0,0) and a linked exit (2,0) along the top row (2 steps), and the long way round a
  wall at (1,1) (6 steps);
- **the LINE** (5×2, its second row wall): a linked exit (0,0), a location (2,0), the entrance (4,0);
- **the STUB** (4×3): a corridor from the entrance to a linked exit, and an empty dead-end stub off it.

| Pin | Result |
|---|---|
| `slope`'s ledge (one-way S, `generate: true`) qualifies, carrying `dirs`; `ground`'s ledge (no `generate`) is still out | ✅ |
| The row is data: `{lowers: true, rules: byte-equal, fromArrivals: true}`; `GENERATED_TILE_KIND_PASSES` ends in `one-way` | ✅ |
| The walk (c) on the ring: 2, and `computeLongestShortestPath`'s; a ledge (E) on (1,0) makes it 6, while `computeLongestShortestPath` still says 2 | ✅ |
| **Condition 1:** with the directed branch forced (an entry gate keyed off the grid, which shuts nothing), `tileKindWalk` is `{computeLongestShortestPath, 0}` room for room over the first 12 maze rooms of `procgen_topdown` AP_7 and AP_4, `procgen_maze` AP_1, `meta_trial` AP_1 | ✅ |
| ✅ **ACCEPTED:** a ledge (E) on the ring's long way round, (1,2). Not vacuous: it owns `1,2,N/S/W` and `step` refuses the move W onto it, allows the move E | ✅ null |
| ⛔ **REJECTED by (a):** a ledge entered moving N only at the stub's mouth cuts the empty stub off; nothing there is a target, so only the gate-aware flood sees it. Entered moving S it is accepted | ✅ `cuts-off-floor` |
| ⛔ **REJECTED by (a):** a ledge (S) on the ring's (1,2), under the wall: no move can enter it | ✅ `cuts-off-floor` |
| ⛔ **REJECTED by (c), the walk made longer:** a ledge (E) on the ring's (1,0), the short way; the walk from the exit back becomes 6 | ✅ `moves-walk-length` |
| ⛔ **REJECTED by (c), a pair made one-way:** a ledge (W) on the line's (1,0); the longest walk is still 4, `oneWayPairs` goes 0 → 1 | ✅ `moves-walk-length` |
| ⛔ **REJECTED by (d), on real data:** `procgen_topdown` AP_4 `Region 3`, a ledge (S) on (6,2). The arrival on exit (7,2) has (6,2) as its only floor neighbour that is not an exit; entered moving W it is shut. (a), (b) and (c) hold: the walk passes through the neighbouring exit tiles (7,1)/(7,3), but the extractor treats an exit as a dead end, so from (7,2) every target goes `False_`. With no arrival measured it is accepted | ✅ `strands-arrival` |
| `placeTileKinds` + the serializer on the ring (`percent` 100, cap 8): no ledge on (1,0); each carries `{pass: 'one-way', dirs: ['E']}` and exactly its three owned `gate: null` entries; the world untouched; `longestShortestPath` equals the plain room's; it loads back through the ownership check and re-derives byte-equal rules from the entrance and the arrival; the gate-aware walk is still 2 | ✅ |

**Mutations** (each run, then reverted; 32 to 34 tests at the time):

| Mutation | Red |
|---|---|
| (d) off (`one-way.fromArrivals: false`) | 3: the row pin, the accepted pin (it reads the arrival baseline), the AP_4 (d) pin |
| The entry gates dropped (`lowerTileKind` writes none for one-way) | 6: the walk pin, accepted, both (c) pins, the (d) pin, the serializer pin |
| The directed walk off by one | 6, including the condition-1 sample pin |
| `oneWayPairs` not counted | 2: the one-way-pair (c) pin and the serializer pin |
| (a)'s flood blind to gates | 1: the stub pin (added because this mutation first turned nothing red) |
| (a)'s own cell always exempt | 1: the unenterable-ledge pin |

## 3. The world proof (`procgenPipeline/oneWayTileKindsWorld.slow.test.js`)

- **The world:** `CONCEPT_TRIAL_STATE` with the fixture `slope` named under "what exists", and the maze biome
  `scattered`, beside its control (the same state, no biome).
- **The logic:** `rules.json` minus `preset_sidecars` and the recorded setting keys is the control's, string for
  string, and so are the run's `stats`. The sphere log and the spoiler are written from `rules.json`, so they are
  unchanged by construction (GEN-D § 2.5).
- **Each maze room** equals the control's payload once its ledges and their owned `entry_gates` are taken out
  (`longestShortestPath` included). Each ledge is `{kind: 'slope:terrain/ledge', pass: 'one-way', dirs: ['S']}` with
  exactly `E`, `N`, `W` → `gate: null`. Each room loads back with its kinds, re-derives **byte-equal** rules from the
  entrance and from every arrival tile, and its gate-aware walk equals the control's.
- **Placed:** 2 ledges, both in `region_1_3`, at (1,5) and (4,5) (the cells GEN-3's pools took). `region_2_3` gets none.
- **Play and draw** (PASS-3's existing paths), for each placed ledge:
  - `step` onto it moving S lands on it; from every other floor neighbour it is `null`, and the autopather's one-step
    route that way is refused; at least one way is open and at least one is shut;
  - the panel's `drawWorld` + `drawMazeTileKinds` reports the kind `as: 'base'` and paints its marker base, and so does
    the composite cell.

## 4. The screenshot

`CC/docs/cloud-reports/content-sets-gen4-shots/ledge-ring-lab.png`:
- `lab.html`, with a 5×3 ring room loaded through the page's own LOAD box (`#labText` → `#labLoad`; the page says
  "loaded a 5x3 level", no page errors);
- the ledge was placed by `tileKindsSerializer` from a plan (`seedKey` 0, cap 1, the pack's dirs `S`). It sits on
  (0,2), entered moving S from (0,1); the move W onto it from (1,2) is shut;
- no pack in the lab's stack declares `slope:terrain/ledge`, so it draws as TILE-1's placeholder (the magenta tile
  labelled "sl"), the designed fallback, as in GEN-3.

The script ran under the box lock (`own-port`, its own server) and is not committed. Its first take put the ledge on
(3,2), under a wall: no move could enter it. That is the defect § 6.2 fixed.

## 5. The yield (one ledge, dirs S; GEN-3 § 6's method)

Every committed procedural maze region with a sidecar `biome` (1,061 regions over 229 rules files), up to 40 hashed free
cells each. Each cell was tried on its own against the room as committed, then lifted.

| | Count |
|---|---|
| Tries | 40,337 |
| **Accepted** | **36,301 (90.0%)** |
| Rooms that take a ledge somewhere | 1,009 of 1,060 with a free cell |
| Refused by (a) `cuts-off-floor` | 3,766 |
| Refused by (c) `moves-walk-length` | 201, **every one invisible to GEN-1's undirected measure** |
| Refused by (b) `changes-rules` | 16 |
| Refused by (d) `strands-arrival` | 53 |
| Rooms with an arrival tile | 546 |

The (a) count is mostly the unenterable ledge: with `dirs: ['S']`, any cell whose north neighbour is not floor cannot
be entered. Before the own-cell fix the same sweep accepted 39,668 (98.3%), with (a) 395, (c) 113, (b) 28, (d) 133. That
was the figure first sent to the planner; it counted those hidden walls as ledges. (c) is far from "rejects almost
every placement", so it is not the brief's STOP.

**Condition 2 (rooms with entry gates).** 41 committed maze sidecars carry `entry_gates`, all in
`seedling_playthrough_maze` AP_1; 16 of them hold a `gate: null`. **None carries a region biome**, so the generator
never places a kind in them. So no GEN-1 or GEN-3 placement in any committed world can change, and no committed
preset moved (§ 7).

### 5.1 The old-vs-new decision comparison (partial)

On those rooms, `origin/main`'s `mazeTileKindsGen.js` against this slice's: a blocked and a needs kind on up to 12
free cells per room, skipping cells that hold an entry gate (a lift would delete it).
- **13 of the 41 rooms** measured, **4 of them** among the 16 with a `gate: null` (`level_12__r0c19`, `level_28__r0c6`,
  `level_37__r0c18`, `level_39__r0c9`): **312 tries, 0 decisions differ**.
- The run stopped at its 40-minute cap: a Seedling room's extraction costs up to minutes per try (`level_0__r1c6`
  83 s and `level_30__r0c4` 72 s for 24 tries each, then a room that did not finish). Under ⚖ "CPU-heavy work goes to
  CI/cloud" it was not pushed further. It is moot for shipped worlds (none of these rooms has a biome), and it is
  recorded as partial, not as a pass.

## 6. What the code overturned

1. **The brief's law (c) "as GEN-1 defined it" cannot refuse a one-way kind.** GEN-1's `computeLongestShortestPath`
   and `floorReach` are undirected and ignore entry gates, and a ledge changes no tile. So (a) and (c), as coded, never
   fire for one-way, and the "(c) rejects a longer walk" pin could not be built. ⚖ The planner approved the gate-aware
   (a) and (c) (§ 1.2), which is what GEN-D § 2.4(a) already says.
2. **Defects my own tests found, both fixed before commit:**
   - **The length alone skips a one-way pair.** The serializer pin placed a ledge on the ring's short way after earlier
     ledges had made the long way one-way: the exit could no longer walk back at all, the pair was skipped, and the
     longest walk was still 2. (c) now counts `oneWayPairs`.
   - **A ledge no move can enter was accepted.** (a) exempted the kind's own cell, as for a pillar. The first lab
     screenshot showed one, under a wall. The exemption now applies only when the kind lowered to a wall.
3. **(d) earns its place for one-way, on real data.** An exit tile is a dead end to the extractor but not to the walk,
   so a ledge that is an arrival exit's only non-exit neighbour passes (a) to (c) and is refused only by (d) (AP_4
   `Region 3`). 53 of the yield's refusals are (d)'s.
4. **Design § 2.2's table:** the fixture `ground` pack's ledge has no `generate`. GEN-4 adds a fixture pack `slope`
   (one ledge, one-way S, `generate: true`), as GEN-3 added `wet`, so GEN-1's `ground` rows do not move.

## 7. Gates (local)

All runs are on the slice's tree.

| Instrument | Result |
|---|---|
| `--print-engine-closure` | `74ae60f575531492ed9eaec1839e1fe3`, 42 files, unchanged (main's); closure ∩ diff = ∅ |
| `refresh-seedling-derived-rules.mjs --check` | fresh and on count (rows 99, regions 47, excluded 6) |
| `ci-producer-checks.mjs --jobs=4` | 99 run, 0 red, 1 skipped (its named exclusion) |
| `check-sidecar-fields` | ALL PASS: 2,433 entries, 0 issues; rule agreement 0 FAIL |
| `generate-procgen-reference --check` | ALL MATCH, after regenerating the README index and `docsIndex` (word counts) |
| `check-procgen-docs`, `check-maze-lab` (browser, each with its own server on this tree) | ALL CHECKS PASSED / ALL CHECKS PASSED |
| Bounded vitest: `mazeRoom` (without `tileSpike`), `procgenPipeline`, `packStructure`, `packConcepts`, `contentPacks`, `procgenDocs` (the doc-link pins included) | 160 files, 4,386 passed. Re-run after the own-cell fix: `procgenDocs` + `mazeTileKindsGen` + `mazeFurniturePack` + `packStructure`, 12 files, 620 passed |
| Slow tier: `scatteredBiomeWorld` (GEN-1), `needsTileKindsWorld` (GEN-3), `oneWayTileKindsWorld` | 10 passed |
| Committed presets moved | **none** (the producers rewrote nothing; `tile_kinds_demo` `--check` OK, md5 `99b1c64f6ca07712533155b438619edc`, GEN-2's figure) |
| Gitlinks changed | 0 |

Main had not moved (`e6e571c4b2`), so there was no merge. No markdown link was added, so the doc-link census does not
move.

### 7.1 CI at the tip

In the report back (the ids are quoted there, at the exact final SHA).

## 8. Next slice's line

- **A demo of the ledge** needs a pack that declares a `generate: true` one-way kind with art. Today that is only the
  test fixture `slope`. Either the `furniture` pack gains a ledge, or a new pack does; then a committed preset (with its
  own re-record and the roster enrolment) can show one. Out of scope here (no pack change, no new preset).
- **Pick `dirs` per placement.** A pack's ledge has fixed `dirs`; with `S` only, 3,766 of the 40,337 tries were
  unenterable cells. A generator that tried each rotation the pack allows would need a pack field to permit it (GEN-D
  has none); that would be a design question, not a law change.
- **(d) stays local** (ruling A). The yield's 53 (d) refusals are rooms where an arrival exit has the ledge as its only
  non-exit neighbour.
