# cloud report — rules-l20-button-latch

Branch `claude/l20-button-latch-rules-l11ndw`, based on origin/main `05dc442022b6227a7c90ab3371d5774df15b70ce`
(`git merge-base HEAD origin/main`). The planner drops this file before landing.

## Verdict: IN SCOPE for ER v1, now fixed. The latch has a sided press event, and seed 1 has NO SPHERE MOVE.

## 1. Measure

**The doorways on each side of `lock@32,80`.** Sources: `seedling-map.json` L20 (`Dungeon2/7.oel`) and the playthrough atlas
`level_20`.

| sub-region | doorway | class |
|---|---|---|
| r3c1 (the alcove, press-less) | `out_stairsup_16_48` (to L13) | **stairs** (stairsup) |
| r3c1 | `in_L13_96_32` (landing from L13 `stairsdown@96,32`) | **stairs** (stairsdown) |
| r1c4 (shield room) | `out_stairsdown_192_48` (to L19) | stairs |
| r1c4 | `in_L19_16_96` (landing from L19 `stairsup@16,96`) | stairs |
| r1c12 (the button, behind `shieldlocknorm@176,16`) | none | — |

The press-less side is r3c1: its only internal way to the button runs through the lock. Both of its doorways are stairs, so
under ER v1 (stairs only, coupled) a shuffle can land a player in r3c1 from any other stairs doorway, with the Shield and
without the press. **So the residue is in scope.** It is pinned in `seedlingBossLockCensus.test.js` ("the press-less side … has
only STAIRS doorways").

**What the game does (AS3, `vendor/seedling/src/Puzzlements`).**
- `ButtonRoom` `{tset 0, tag 4, flip 0, room -1}`:
  - `set activate(true)` with `room == -1` walks every `Activators` with `t == tset` and gives each `activate = !flip`
    (ButtonRoom.as:79-89).
  - It then writes its OWN slot with `setPersistence(tag, !activate)`, which is always a clear because it sits under `if (a)`
    (:96).
  - `check()` reads that slot back on every build (`_active = !checkPersistence(tag); activate = _active`, :43-44) and
    re-publishes the group. **So the press latches, and the persistent flag is `{20,4}`.**
- `Lock` `{tset 0, tag 1}`:
  - `set activate(true)` → `activationStep` fades it → `turnOff()` clears its type.
  - Its own tag is inert: `check()` honours it only while `tSet < 0` (Lock.as:42). This is law 2 in the overlay.

**Before the change:** r1c4 ↔ r3c1 cost `Has(Progressive Shield)` both ways. That came from `OV.GROUPED_LOCK_EXCEPTIONS`,
which prices the presser's reach, not the press.

## 2. The change (reuses the cross-room button-event path; no level literals)

- `seedlingObstacleEvents.js`:
  - New `inRoomLatchButtonsOf(map)` returns every `room == -1` ButtonRoom with a tset and a tag, in `crossRoomButtonsOf`'s row
    shape. `write` is the button's own tag, cleared, and the targets share its tset.
  - `deriveButtonEvents` now asks for the gates before minting. An empty list skips the target by name (cross-room rows never
    hit this, because `barrierCut` throws instead).
  - A `{from, to}` gate goes to a new `internalExitGates` output (kind `in-room-press`).
- `make-seedling-playthrough-rules.mjs`: `playthroughButtonEvents` derives over both row sets. `inRoomLatchAnalysis` answers the
  three in-room questions:
  - **Effect:** the target is a model `lock-despawn` (a Lock) and is handed `activate = true`.
  - **Priced by the button:** the group has no other in-level opener (uses the new `OV.isLatchingOpener` / `isHoldingOpener`
    exports).
  - **Gates:** the analyzer crossings whose every way steps through the target's tiles.
  - The layer passes them on as `internalExitGates`.
- **Derived result:** exactly L20's lock is gated. L38's and L107's latches publish to a pulser or a cover, which is not a Lock.
  No crossing passes through any of L40's six wand locks, because the overlay rules them open. All of these are skipped by name
  in the producer log.
- `make-seedling-playthrough-maze.mjs` + `regionAtlasMazeProjection.js`:
  - The maze certifier first named the L18–L20 world LOOSER than AP: the lock cell opened on the Shield alone.
  - Fix: an in-room target that the press opens is laid as a mode-`target` cell. Its cell already holds an atlas gate, so it
    now costs `And(<gate rule>, press)`.
  - Any other stacked obstacle is still refused by name.
  - ⚠ The projection's comment had left "what a stacked target costs" open. Joining an atlas gate is my call: it mirrors the AP
    rule exactly. Planner, please review.
- `GROUPED_LOCK_EXCEPTIONS` stays, with a comment added. It is what keeps the alcove its own sub-region for the event to gate.

**rules.json diff (`seedling_playthrough/AP_1`; the maze preset gets the same AP rows):**
```
level_20__r1c4 -> level_20__r3c1 : Has(Progressive Shield)  ->  And(Has(Progressive Shield), Has(L20 flag 4: lock@32,80 cleared))
level_20__r3c1 -> level_20__r1c4 : Has(Progressive Shield)  ->  And(Has(Progressive Shield), Has(L20 flag 4: lock@32,80 cleared))
+ level_20__r1c12 location "L20 flag 4: lock@32,80 cleared"
    event_id flag:L20:4, event_kind game_state, access True_
    obstacle {20, 4, lock, 32, 80}, action {press, presser {20, buttonroom, 192, 16}}
    side level_20__r1c12, across []
+ the event item, and its entry in the event counts
```
- **Atlas:** byte-identical (the producer `--check` printed OK).
- **Partition:** unchanged.
- **World package:** regenerated (Items, Locations, Rules, `__init__`).
- **Maze:** the event is a location on the button cell (12,1), and the lock cell (2,5) is the joined target.

**Seed 1 (Generate.py, minimal-spoilers):**
- **NO SPHERE MOVE.** A script over the sphere log, events excluded, found the real-item sequence (48 steps), every region's
  major sphere and every location's major sphere identical.
- The event is inserted at sphere 4.3, so the old 4.3–4.8 renumber to 4.4–4.9.
- Spoiler: +2 lines, the event in the location list and in sphere 5.
- The maze's embedded sphere log changes the same way.
- `preset_files.json` and `apquest` were untouched; there was no dirt to revert.

**Pins re-recorded:**
- `seedlingPlaythroughObstacleEvents.test.js`: the button event ids gain `flag:L20:4`, the in-room skips are listed by name, and
  there is a new L20 row.
- `seedlingEventCollector.test.js`: the events list gains `flag:L20:4`.
- `seedlingDivergenceLegs.test.js`: the PRESS set gains `flag:L20:4`. The leg list itself is unchanged.
- `certifyEventLocations.test.js`: the laid targets gain the L20 lock.

**New tests:**
- `seedlingObstacleEvents.test.js`: the in-room census, the internal gates, and the skip of a target no crossing passes through.
- `seedlingBossLockCensus.test.js`: one in-room press, both crossings `And(Shield, press)`, and the press-less side's
  stairs-only doorways.

The atlas ids, door census, levelSetExporter and vanillaOverlay pins needed nothing, because the atlas did not move.

## 3. Census counts, before → after (AP_1 rules)
- game_state events: 32 → 33
- press events: 3 → 4
- in-room press events: 0 → 1
- internal exits: 500 → 500, of which costing an event: 28 → 30
- Shield-lock census (`censusLocks`, W probe): AGREES 3 → AGREES 3
- Boss-lock census: AGREES 11 / NOT 2 / NOT-SEALED 1, unchanged
- Two-way internal crossings through a latched lock that cost no event: L20 r1c4 ↔ r3c1 → none

## Gates
- **Bounded vitest, 111 files:**
  - Coverage: every test that reads the playthrough atlas, AP_1, the AP_1440… seed or the maze preset (non-slow, non-calib),
    plus `regionAtlasMazeProjection.test.js` and `deriveLevelWorldLogic.slow.test.js`.
  - Also included: the obstacle-events, block-paths, semantics, block-stoppers and constants-census tests, `boxLock.test.js`,
    `noNewDocsReferences.test.js` and `checkProcgenHelp.test.js`.
  - Result: 2238/2239 passed. The one red was `certifyEventLocations`' laid-targets pin; I re-recorded it and it passes alone
    (24/24).
  - The earlier four reds (pins and the maze certifier) were fixed before this run.
- `census-seedling-constants.mjs --write`: the CSV is unchanged. `generate-procgen-reference.mjs`, then `--check`: ALL 7
  GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH.
- Producer `--check`:
  - rules: atlas OK, AP_1 OK
  - partition: checked
  - maze: byte-identical
- **For the planner (not run here):** TT, the probe 8×, the whole-game certifier A/B and the survey A/B. The solver may meet
  `flag:L20:4` as a clear-tag goal:
  - Its obstacle is `lock@32,80`, a solid, so the goal resolves to `solid:lock` → `hold`.
  - The model ledgers the ButtonRoom's own-tag write (`activators.js` `which: 'own'` → `earnedClears`).
  - No solver change was made. Watch the certifier for a `not-written` refusal.
