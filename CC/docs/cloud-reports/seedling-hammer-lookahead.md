# SEEDLING HAMMER-PHASE — slice LOOKAHEAD (`seedling-hammer-lookahead`)

## 1. SHAs

- Start: `ba367618590c5cc9b9c7c0e6e603c6c9879e2332` (main after TRAIN 193).
- Branch: `claude/seedling-hammer-lookahead-1xm5sa`.
- Head: the commit that carries this report (the `Cloud-Status` trailer).
- Evidence: `CC/docs/cloud-reports/seedling-hammer-lookahead-evidence/` (`README.txt` lists it).

## 2. The answer first

**Blocked: the brief's premise is wrong. No code changed, and no switch was added.**

- **The one thing to know first:** at seed 1, **no exit has more than one tile.**
  - All 640 sidecar exits of `seedling_playthrough` are single-tile, and so are all 703 exit legs of the sweep list.
  - The L16 pit is **7 separate AP exits**: `level_16__r1c9 -> level_17`, `… #2` … `… #7`, one tile each.
  - All seven have the same source region, the same `connected_region: level_17` and the rule `True_`.
  - A look-ahead that drops tiles from one exit's tile set therefore reaches **0 legs**, the 4 witness legs among them.
- **Where the choice lives.** It is the choice between AP-equivalent sibling exits, and the route layer makes it:
  - on the page, `seedlingPlaybackController.resolveSeedlingAtlasGoal` (`flashPanel/`, out of this slice's bounds) maps the
    route's exit NAME to that exit's `exit_tiles`;
  - in the survey, the crossing is "the door AP's path took" (`survey-seedling-route.mjs`), and step 24 is
    `reach-pit(… out_pit_7_2, tile 12,3)`, 1 hit.
- **The model agrees with the user's witness** (§3), so this is not a fidelity hand-over.
- **The hit is already billed inside the L16 leg's own plan.**
  - The pit plan carries the whole fall into L17: the level changes at t70 and the plan ends on landing at t149.
  - So the hit-aware rows already rank the named exit as `1h0d`, and the sibling exits' own solves already say `0h0d`.
  - No next-room probe is needed to see it.
  - ⚠ A probe from a **fresh** L17 arrival would get it wrong: all 7 fresh `level_17 <- in_pit_L16_*` arrivals are hitless,
    both goals and both passes. The hazard is in the fall, and a fresh staging skips the fall.
- **The fix the measurement points to (a hand-over, §9):** where the route names an exit, offer its AP-equivalent siblings and
  ship the hitless one. For the 4 legs:

| leg (key) | named exit: plan, hits | hitless siblings (shipped plan, ticks) |
|---|---|---|
| `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_2` | dashless 371 t, 1 hit (L17) | 8_2 455, **9_2 355**, 9_3 412, 8_4 436 |
| `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_3` | full 381 t, 1 hit (L17) | the same set |
| `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2` | full 149 t, 1 hit (L17) | 8_2 315, **9_2 195**, 8_3 233, 9_3 209 |
| `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_3` | full 174 t, 1 hit (L17) | the same set |

**Census** (§7): 160 seed-1 legs belong to a sibling group, in 63 (arrival, group) pairs.
- 4 of the 160 legs hit, and they are exactly these 4.
- Only the two L16 pit pairs could move to a hitless sibling.
- Every other pair is already hitless on the exit the route names.

## 3. The reproduction (measured)

Tool: `tools/pit-landing.mjs`, node.
- The census tools of FEWER-HITS / HIT-TIEBREAK, with one change: the vanilla atlas (`seedling-map.json`) replaces the p4g
  dump. An exit leg reads no dump entry.
- Inv staging uses the sphere's items and slots matched by KEY (`sphere-items.jsonl`, HIT-TIEBREAK's), plus the leg's staged
  `flag:L16:0`.
- `ANYTIME_PASSES` runs under `SOLVER_BUDGET_WORK` / `SOLVER_UPGRADE_WINDOW_WORK`.
- `--siblings=1` swaps the goal for every sibling exit into the same target level. Each plan is replayed, plus N idle ticks.
- **Validated:** the named exit's rows reproduce FEWER-HITS's census exactly. For example, `in_L17_32_48 … out_pit_7_2`
  gives dashless 183 t / 9 units / 1h, and full 149 t / 21 units / 1h. The hit is `chaser bob@96,32` at t149.

**The leg ids in this base's list** (`seedling-divergence-legs.mjs` at the base, `legs.jsonl.gz`): 829 / 832 / 836 / 839.
In FEWER-HITS's list they were 836 / 839 / 843 / 846.

**Every pit tile, from both arrivals** (`step1/siblings-idle300.jsonl`).
- Each row: the tile, its L17 landing (`target_spawn`), the shipped plan, and the plan's own L17 hit.
- "First idle hit" is the first hit when the player then stands still. A bob reaches an idle player everywhere, so standing
  still is **not** the test of a safe landing.

| tile (exit) | L17 landing | from `in_L17_32_48`: plan, hit | from `in_L15_144_16`: plan, hit | first idle hit after the plan |
|---|---|---|---|---|
| (12,3) `out_pit_7_2` | (112,32) | full 149, **hit t149 bob@96,32 (the landing)** | dashless 371, **hit t371 (the landing)** | (the landing) |
| (13,3) `out_pit_8_2` | (128,32), under the chest (128,16) | dashless 315, 0 | full 455, 0 | +67 t |
| (14,3) `out_pit_9_2` | (144,32) | full 195, 0 | full 355, 0 | +173 t (`bob@112,80`) |
| (12,4) `out_pit_7_3` | (112,48) | full 174, **hit t162 bob@96,32** (12 t before landing) | full 381, **hit t369** | (in the fall) |
| (13,4) `out_pit_8_3` | (128,48) | full 233, 0 | refused, both passes | +69 t |
| (14,4) `out_pit_9_3` | (144,48) | full 209, 0 | full 412, 0 | +98 t |
| (13,5) `out_pit_8_4` | (128,64) | refused, both passes | full 436, 0 | +8 t |

- **No plan takes a hit in L16** (`hitsByLevel` holds only L17).
- The fall:
  - The level changes ~79 t before the plan ends. The landing row's first L17 tick is at y −43 for the top row, −27 for the
    second row and −11 for the third.
  - The bobs move during the fall.
  - The plan ends on the landing.
- **Against the user's witness:**
  - "leftmost lands too close to the bob": (12,3) hits `bob@96,32` on the landing.
  - "the two to its right are safe": (13,3) and (14,3) are hitless.
  - "the middle lands directly in front of the chest": (13,3) lands at (128,32), one tile under the L17 chest at (128,16).
  - The second row behaves the same way: the left tile hits, the others do not.
  - **The model agrees with the witness.**

**The next room, as a fresh arrival** (`step1/l17-arrivals.jsonl`).
- These are the list's own L17 legs: `level_17 <- in_pit_L16_<t> -> exit:out_stairsup_32_48`, and the same arrival
  `-> location:Level 017 - Chest`.
- All 14 legs solve hitless on both passes, (12,3) included: for example, `in_pit_L16_7_2` gives full 33 t to the stairs and
  full 88 t to the chest, 0h0d.
- A cross-room continuation from the L16 plan's end is refused by design, ⚖ Q5: "the bot plans ONE goal in ONE room"
  (`step1/siblings-cont.jsonl`).

## 4. Design and change; OFF identity

**There was no change.** Step 2 found that the design the brief specifies has nothing to act on.
- **Where the exit goal's tile set is chosen:**
  - on the page, `resolveSeedlingAtlasGoal` (`flashPanel/seedlingPlaybackController.js:221`): `tiles: exit.exit_tiles` of
    the ONE exit the route names;
  - in the survey, the crossing edge, as `reach-pit {tx, ty}` / `reach-exit {x, y}`. `solverBot.assertGoal` states the
    contract: "The MACRO layer names WHICH pit; the solver owns HOW to reach it."
- `solveSegment`, the exit goals and the `jsRuntimeSolver` passes all receive one tile at seed 1, so they have no choice to
  make.
- Widening the set inside solver land (for example in `wasmArrival.arrivalSolverGoal`, which sees only the level record)
  would make the solver cross a different **AP entrance** than the route asked for. Only the AP layer knows that the siblings
  are equivalent (same region, same `connected_region`, same rule). That is a route decision, not a solver one.
- **No next-room probe is needed.**
  - The landing hit is inside the leg's own plan, so a sibling's verdict is just its own solve's `modelHits`, which the
    hit-aware rows already carry.
  - The brief's suggested probe, "bounded hitless survival from the arrival in room N+1", would be **unsound** here: a fresh
    arrival skips the fall and reads (12,3) as safe (§3).
- **Cost of the sibling solve** (node, the page budget, per sibling): 295–1495 ms in step 1, against today's one solve of the
  named exit. The census rows carry `ms` for every sibling leg.
- **OFF identity:**
  - acceptance md5 at the base: `391322d681b7aa0229d94b3f6906d024`, the expected value;
  - at the head: re-measured, `391322d681b7aa0229d94b3f6906d024`. No tracked source changed (the diff is this report and its evidence directory only).

## 5. Rows and bounded vitest

- **None.** With no change there is no switch to pin, and a synthetic two-room row would pin a mechanism that was not built.
- No vitest was run. The diff touches no source or test file.
- No regenerations were owed: no docs under `docs/json/developer/procgen/` and no solver surface changed.

## 6. Page play / game witness

- **None run.**
  - The user's own hand witness is the game's answer for (12,3), (13,3) and (14,3), and the model matches it (§3).
  - With no change, there is no tip to witness.
- The FEWER-HITS hand-over still stands for a future change that moves these legs: the p4g lab's `roomHits` drops samples
  outside the leg's level (`seedlingDivergenceLab.js`). A witness of a pit leg must sample past the transition.

## 7. Census

**The brief's reach (multi-tile exits into another level): 0 legs.** At seed 1, all 640 sidecar exits and all 703 exit legs
are single-tile.

**The reach of the change the measurement points to (AP-equivalent sibling exits).**
- A sibling group is the exits of one region with the same `connected_region`, `access_rule` and target level.
- There are 21 groups, with sizes 2 ×17, 3, 4, 7 (the L16 pit) and 13 (the L40 → L43 stairs plus 12 pits).
- Together they cover **160 legs** (`step1/sibling-exit-legs.txt`).

**Method** (`tools/census-run.sh`, `tools/census-summary.py`):
- every one of the 160 legs is solved once, as in §3, 3 in parallel with a 120 s cap (0 hit the cap);
- legs with the same arrival and the same group make one pair;
- the "named" member is the group's un-numbered `exitName`, the one the AP path takes.

**Results** (`census/census.jsonl`, `census/summary.txt`):
- Per leg: 142 hitless, 14 refused (no plan) and **4 hit**. The 4 are this brief's legs, each billed 1 hit in L17.
- Per pair (63):
  - **60 CLEAN**: the named exit is hitless, so there is nothing to move.
  - **2 MOVABLE**: `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1` and `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7`
    into `level_17`. The named `out_pit_7_2` hits, and 4 siblings in each pair are hitless (§2).
  - **1 UNKNOWN**: `level_40__r26c13 <- in_L43_176_464`. All 12 pit siblings are refused, and the named stairs is clean
    (full 5 t, 0 hits), so it cannot move either.
- So a sibling choice would change the exit on exactly 2 arrivals, and move only the 2 named-exit legs (`… -> exit:out_pit_7_2`).
  - The two `out_pit_7_3` legs are a sibling (`#4`) the AP path never names.
  - Their verdicts only matter as candidates.
- **Cost:** a solve takes a median of 205 ms per leg, and the maximum is 16.5 s (an L40 leg). A sibling choice adds one solve
  per extra sibling, only where a group exists:
  - 6 extra for the L16 pit;
  - 1 for each pair-of-two group.

## 8. What the brief got wrong (measured)

1. **"before committing a level's exit … rule out tiles whose arrival is hit-forced" / "run only on exits that … have more than
   one tile":**
   - At seed 1, no exit has more than one tile (640 sidecar exits, 703 exit legs).
   - The pit tiles are 7 distinct AP exits, so the mechanism's reach is 0 legs.
   - The choice the witness describes is among **AP-equivalent sibling exits**, and the route layer makes it.
2. **"solve the next room's arrival from each candidate entrance tile":**
   - Every fresh L17 arrival is hitless, (12,3) included (14/14 legs, both passes).
   - The hazard is the ~79-tick fall, which only the L16 leg's own tape models.
   - So a next-room probe is not just unnecessary, it would also wrongly pass the hitting tile.
3. **"the lab's roomHits is blind outside the leg's level" / "the model bills … on the landing":**
   - Both are true for (12,3).
   - For (12,4) (`out_pit_7_3`), the hit comes 12 t **before** the plan ends, during the fall (t162 of 174; t369 of 381).
4. **"Both pit exit variants hit today":**
   - True. But the other 4–5 tiles of the same pit (per arrival) solve hitless, and the route only ever asks for the first
     (`out_pit_7_2`, survey step 24).
5. **Ids:** in this base's list, the 4 legs are 829 / 832 / 836 / 839, not 836 / 839 / 843 / 846.

## 9. Residue / hand-overs

- **Planner / route owner (the fix, outside this slice's bounds: `flashPanel/` + the survey's crossing):**
  - **SIBLING-EXIT CHOICE**, switch-guarded OFF.
  - When the route names an exit with AP-equivalent siblings (same source region, same `connected_region`, same
    `access_rule`, same target level), solve each sibling from the same arrival, and ship the named exit unless it hits and a
    sibling does not.
  - Among the hitless siblings, pick by today's order (hit verdict, then ticks). If every sibling hits, keep the named exit and
    say so in the notes.
  - It is generic (no level, coordinate or entity), it runs only where a sibling group exists, and the census in §7 is its
    whole reach.
  - The region binding must accept the arrival door the bot took (`in_pit_L16_9_2` rather than `in_pit_L16_7_2`). That is the
    open question the owner must answer first.
  - The per-sibling hit verdict is the solve's own `modelHits`, so no new model is needed.
- **Survey:** step 24 changes only if the survey's crossing gets the same sibling choice.
- **Not measured:**
  - the page and the wasm game for the siblings (the user's hand witness covers the top row);
  - the census's node rng against the page's (node seed 0);
  - continuations after an item delivery (only arrival requests were solved).
