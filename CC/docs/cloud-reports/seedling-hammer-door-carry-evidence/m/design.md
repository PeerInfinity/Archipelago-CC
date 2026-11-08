# DOOR-CARRY M — the design choice

| | A. leg-list mode `--carry-route-flags` (CHOSEN) | B. keep the default, derive a `--stage-flags` spec by key |
|---|---|---|
| Where the carry is computed | `seedling-divergence-legs.mjs`, which already holds the sphere log, the rules and the event map | a new deriver, then a `<key>=>L:T,…|…` string pasted into the dispatch |
| Default list / baselines | byte-identical OFF (pinned: `seedlingDivergenceRouteCarry.test.js`) | byte-identical (nothing changes) |
| Stamp | `carriedFlags` on the leg → every row (`stamp`), a `ROUTE-CARRY:` line | `stagedFlags` (the WITNESS stamp: reads as a hand-picked model witness, not the route's state) |
| The whole inventory (radius) | one boolean input | an 87-leg spec in a workflow input string; a key move at a later SHA fails it |
| Staging channel, own page, read-back, `stage-failed` | the same (`stagedEvents`) | the same |
| Workflow | `carry_route_flags` boolean, default false, stamped in the run name | none |

**Recommendation: A.** B stays available for one-leg witnesses (it is what KEYLOCK-TURRET used), but a derived route
state is a property of the leg list, not a hand witness, and the radius needs the whole list.

## The rule (W0 = the implementation, 0 mismatches over 930 legs)
- **Route order** = the sphere log's `sphere_locations` row (where the route COLLECTS a location), not the leg's
  `sphere` (where its goal becomes ACCESSIBLE). A location goal carries flags collected at a row `<` its own; an exit
  goal carries flags collected at rows `<=` its sphere (they are in the AP inventory the leg holds).
  - BK2 is accessible at 5.3 (row 29) with the door; the route collects flag 12 at 6.1 (row 33) and BK2 at 6.6 (row 38).
    By the accessibility sphere BK2 would carry NOTHING (its inventory lacks flag 12) — the census's "same sphere".
- **Reads** = the leg's level's own flags + another level's flag a rule of the level names, except a door edge's far-side
  obstacle (the exit's target level). On the playthrough that leaves exactly L113 ← L114:0 (`FinalDoor.as:50`), whose
  legs already stage it as a goal event, so every carried flag at this SHA is the leg's own level's.
- **Never its own goal** (a flag location goal), never a skipped leg; a flag already staged is not added twice and is
  not stamped.
- Only `game_state` flags (36 on the playthrough). Chests / keys / totems hold persistence tags the rules do not carry
  (no `obstacle`): out of scope.
