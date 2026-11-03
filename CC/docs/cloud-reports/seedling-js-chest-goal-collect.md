# seedling-js-chest-goal-collect — a loot chest as a room's GOAL certifies

Cloud slice for js-15. Branch: `claude/seedling-chest-goal-collect-iawv75` (the harness pinned this branch name).
I did not push main.

- **Base:** `c84a3592abf26d9e7b3d9c53835073757b2d62d1` (origin/main at fetch).
- **Fix commit:** `dd20907a`. This report is the last commit after it.

## The cause

The goal chest is collected. The oracle reads the wrong key in the record.

1. **The game.** `Chest.open()` spawns the SealPiece at the chest's own position: `vendor/seedling/src/Chest.as:78`
   `FP.world.add(new SealPiece(x, y))`. It writes the persistence flag at `:89`. With all sixteen seals held,
   `checkBySeal()` (`:47-57`) writes the same flag and removes the chest, and no piece spawns.
2. **The solver picks the verb.** A `collect-placement` goal is one goal kind with three verbs.
   `solverBot.js:8418-8432` `resolveCollectStrategy` checks chests first: a chest at the placement selects
   `chest`, a pickup selects `collect`, and an apitem selects `apitem`.
3. **The chest verb's record.** `solverBot.js:31432-31438` pushes `{goal:'collect-placement', strategy:'chest',
   ...runChest's record}`. `botDriverV2.js:5274` `runChest` waits until the `sealCollections` row whose `from` is
   this chest exists (`:5337-5341`). If the piece is never collected, it `fail`s (`:5357-5363`). It returns
   `chest:{id,x,y,persistTag}` and `collectedAt` (`:5388-5397`), and **no `pickup` key**. The seal-removed arm
   (`solverBot.js:31279-31287`) also returns a `chest` key and no `pickup`.
4. **The oracle.** On base, `procgenOracle.certifyCollects` matched only `r.pickup.x/y` against the goal's placement.
   So a solved goal-chest room had "no collect record" and threw at `procgenOracle.js:767` on base (`:805` now).
5. **The door chest is different.** It is an *obstacle*. Its `chest` record is keyed at the door cell, which no goal
   names, and the goal is a pickup beyond it. So it certifies as `[chest, collect]` through the pickup record.

## The fix, and why this shape

`certifyCollects` (`procgenOracle.js:372`, helper `isChestCollect` at `:428`) now has a second arm. If no `pickup`
record matches the goal's placement, it accepts a `chest` record whose `chest.x/y` is that placement **and** that
has a collect: either an integer `collectedAt`, or `arm: 'seal-removed'`.

- **Why not a new `collect-chest` goal kind:** the solver models a chest goal as `collect-placement`.
  `resolveCollectStrategy` treats chest, pickup and apitem as three verbs for one goal ("the same goal shape selects
  differently in different rooms"). The apitem docblock (`solverBot.js:8446-8457`) also argues against adding a goal
  kind. A new kind would make the generator choose a verb, and the solver already does that. The fix makes the
  certificate read the record of the verb the solver picked.
- **`collected`:** a goal chest adds the row `{tag:'chest', x, y, item:'sealpiece', strategy:'chest', id}`. A
  seal-removed chest gives `item: null, arm:'seal-removed'`. A chest record that no goal names (a door chest) stays
  out of `collected`. That is why door-chest certificates are byte-identical.
- **⛔ The seam throw is unchanged** (`:799-808`). A chest record with no collect certifies nothing. So does a pickup
  or chest at another placement. Both still throw.
- **The revert path:** if a goal chest has no stance (the row below it is the south wall), the solver throws a
  `SolverRefusal` (`STANCE_REENTRY`). The oracle classifies that as `REFUSED`, and the candidate reverts. It never
  throws. This was the same before the fix.

Docs: the palette's `chest-in-the-gap` row said this shape "makes the solve RETURN UNCERTIFIED". That is now false, so
the row has one added sentence saying it is fixed (`procgenPalette.js`, `wouldNeed`). `catalogue.js` was regenerated:
11 copies of that one string changed, and nothing else.

## Repro: `frontend/modules/seedlingDemo/procgenChestGoal.test.js`

All rooms are 10×10 `emptyLevel` rooms. Boot is at (1,1) unless noted. Each room ran under both biomes' boot items
(pre-sword `null`, post-sword `POST_SWORD_ITEMS`).

| room | shape | base `c84a3592ab` | after |
|---|---|---|---|
| `loot-open` | chest is the goal at (5,5), the row below free | **THROW** `no collect record for place:80,80` (both biomes) | SOLVED; `collected` = chest@80,80 `sealpiece` |
| `loot-north` | chest is the goal at (5,1), against the north wall | **THROW** `… place:80,16` (both) | SOLVED; `collected` = chest@80,16 |
| `loot-south` | chest is the goal at (5,8); its stance row is the border | REFUSED `STANCE_REENTRY` (revert) | REFUSED `STANCE_REENTRY` (unchanged) |
| `door-south` (control) | wall across row 4 at x=1..4,6..8; chest in the gap at (5,4); boot (1,8); torch goal at (8,2) | SOLVED `[chest, collect]`, 274 / 217 ticks | identical: same ticks and the same certificate, records and tape digests |

Running the new file against base (`git stash` of the oracle only): **6 failed / 6 passed**. The four loot rows throw
the seam error, the two goal-chest unit rows fail, and the control and loot-south pass. After the fix: **12/12**.

The lab measured `loot-north` throwing, and I confirmed that on base. A north-wall chest's stance row (row 2) is
free, so after the fix it solves.

Also measured, not pinned: the palette's residue shape (a chest and a torch pickup on the same placement (7,7)) threw
on base and certifies after the fix as the chest. Either way the solver picks the chest verb, because
`resolveCollectStrategy` checks chests first. ⚠ For lab's B1: if a generator ever puts a pickup under a chest, the
goal resolves to the chest. Avoid co-placing them.

## Pins and their mutants (each measured red, then reverted)

| pin | mutant | red |
|---|---|---|
| a goal-chest room certifies, its collect row keyed to the chest's place (loot-open/north × 2 biomes, plus the unit row) | **M1:** drop the chest arm `?? rows.find(isChestCollect …)` | 6 (the 4 loot rows THROW; goal-chest and seal-removed unit rows) |
| the door-chest control's certificate is byte-identical (`[ticks, sha(certification), sha(records), sha(tape)]` measured at base) | **M2:** every chest record goes into `collected`, not only a goal's | 3 (both door-south digest rows, plus "door chest elsewhere") |
| an opened chest whose piece was never taken certifies nothing (the seam stays loud) | **M3:** drop the `collectedAt` / seal-removed condition | 1 |
| a chest at another placement does not certify a goal | **M4:** do not key the chest arm to the goal's placement | 1 |

## Identity evidence

- `make-seedling-spiral-room-preset.mjs --check` passes for every state: `spiral`, `generated`, `generated-chestdoor`
  (**seedling_generated_chestdoor unchanged**), `generated-host`, `generated-leaf`, `generated-swim`. I ran the
  generated and chestdoor states again after the palette text edit, and they still match.
- These also report OK / exact under `--check`: `make-seedling-entity-colliders`, `-font`, `-playthrough-maze`,
  `-playthrough-rules`, `-sphere-order`, `-starter-atlas`, `-subregion-partition` and `-vanilla-overlay`.
- ⚠ `make-demo-bounce-pack` and `make-demo-runner-pack` have no `--check`. They ignored the flag and rewrote their
  outputs. Their pack JSON came out byte-identical. They also rewrote `region_library_files.json`, which dropped the
  cloudberry row. That happened because `make-demo-cloudberry-pack` exits 1 here: the Cloudberry site is not fetched
  in this container. I reverted the index with `git checkout`, and the tree only has my changes. None of these three
  scripts reach the Seedling oracle.
- **NO_TAPE_CHAIN** is unchanged: `jsRuntimeTape.test.js` passes with `{chain:'0852da9e5639860e8b2d4ccbeda5', rows:224}`.
- `node scripts/procgen/generate-procgen-reference.mjs --check` → **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS
  MATCH THE CODE** (after the regen).
- Bounded vitest, no unfiltered run: 10 files, **182/182**. The files: `procgenChestGoal`, `procgenOracle`,
  `procgenChestDoor`, `seedlingGenChestDoorAp`, `jsRuntimeTape`, `procgenCollectPath`, `procgenWeigh`,
  `procgenPostSword`, `procgenCore/levelGenerator`, `fidelityChestSeal`. After the palette edit:
  `procgenPostSword`, `procgenChestGoal` and `procgenDocs/*` gave 10 files, **519/519**.

## STOPPED / not done

- Nothing was STOPPED. No `vendor/seedling`, wasm, jsRuntimeCore or levelRun edit was needed. The only code change is
  in `procgenOracle.js`.
- I left lab-side B1/B3 alone (the "chest" location kind, `goalClass: 'chest'`).
- **A sibling with the same shape, not fixed:** the `apitem` verb's record carries `apItem:{id,tag,x,y}` and no
  `pickup` (`solverBot.js:31237-31242`). So an oracle goal on an apitem's placement would also read as "no collect
  record". The procgen oracle never sees apitems today, because they are placed after generation. I left it alone
  because no repro exists in this scope. If it is wanted, the fix is the same arm as the chest's.
