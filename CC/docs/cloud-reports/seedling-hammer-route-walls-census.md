# Seedling hammer-phase ROUTE-WALLS-CENSUS — the whole-game walls past L40, mapped (measure only)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-route-walls-census` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-07 ("Census them first (Recommended)") |
| Start SHA | `6473024aa824efe5c532d24e9f1bccb3942df205` (origin/main, "train: seedling-gen-goal-loot-lift") |
| Head | tools `94ef4a79`, W0 `fef1a5f0`, W1 `10611b40`, W2 `b4fe8a7b`; this report is the last commit |
| Branch | `claude/seedling-hammer-walls-census-dz8cbl` (the harness's designated branch) |
| Behaviour | **unchanged.** No solver, driver, model, generator, test or switch edit on a tracked path. The one code what-if is a scratch patch in a throwaway worktree (`w1/whatif-drill.patch`) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-route-walls-census-evidence/` (README names every file; 21 MB of captured requests not committed) |
| Wave-6 switches | none are on main yet. They were measured on `origin/hammer-harvest-wave6` `a874dc163f` (main 534cf9b6 + the five), whose D0 equals main's on every request here |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done (its pip line failed, as in earlier slices; nothing here reads it); every submodule incl. the wasm one; node v22.23.4; 4 cores; :8000 `serve-nocache.py` |

## 2. The answer first — the map

**The one thing to know first: the drill in L91 is the key wall, and the Feather wall is not a solver wall.**
- The Feather pocket can only be entered from above. Its two approaches are waterfall tiles (`r5Feather.js`), and
  without the feather a waterfall is one-way down. The rules let L89's bottom rooms reach it with one Progressive Swim,
  but the feather *is* the second Progressive Swim. So the walk takes a logical shortcut the game does not have.
- The real route is L92 → L91 → L89 `r1c10` → down to the pocket. It crosses L91 east→west, which is leg 719: the
  drill. That wall also strands the bot.
- The drill is a **wiring gap**, not a missing rung. Both drill executors exist and are ON, but neither engages on a
  door leg while a sword is held. A scratch what-if built from those two executors solves leg 718 on the game page
  (190 t, 0 hits, 0 divergences).

Legend: ● first wall at the defaults (page and node agree); · not on that leg; ✓ done at the defaults.

| wall | 9001 | 9002 | 482 | 923 | 924 | 921/922 | 719 | 718 | 717/720 | 721/9003 | cause | OFF switch? | fix kind · size | budget |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **W1** L53 kill-lock `lock@144,208` | ● | ● | ✓ | · | · | · | · | · | · | · | the K3 chaser arm cannot kill `jellyfish@144,192` (dashless) / `puncher@136,96` (full) in the water arena | **no** (13 arms identical) | R · medium | not budget-bound: refuses by name at 7368 / 5555 units |
| **W2** L89 Feather from below | · | · | · | ● | ● | ✓ | · | · | · | · | **AP logic**: bottom → pocket at Swim ×1; the game needs the feather (Swim ×2) | no | **logic (user question)** · small | refuses at once (2 units) |
| **W3** L91 drill `drill@64,80` | · | · | · | · | · | · | ● | ● | ✓ | · | the drill blocks a one-tile passage; no rung offers it; both drill executors gated off | **no** | R (wiring) · small, then F (drill in water) · small–medium | not budget-bound (8–20 units) |
| **W4** seed 2 L92 bait | · | · | · | · | · | · | · | · | · | ✓ | **not reproduced** under the vanilla inventory | — | — | — |
| strand in L91 | | | | | | | | | 720 ✓ | | the walk's planner, not the solver (the solver leaves L91 east) | — | walk recovery · small–medium | — |

**Budget.** No wall here is a budget wall. Every chain ends on a named refusal: W2/W3 within 20 units, W1 at 5555–7368
units. The page's 640/2560 cut W1 mid-kill, and that is why seed 2's text reads as a deadline. A bigger budget changes no
verdict.

**Dependency.** W3 gates W2's real route, and through it the L90 Chest and Ghostspear rows (seed 1 rows 26, 31). W1 is
independent: BK3 and everything behind L54. W4 is unmeasured.

## 3. W0 — the page sweep at main's defaults

The 40 legs with `level` or `target_level` in {53, 54, 89, 90, 91, 92} (`w0/sweep.tsv`). **35 done, 5 failed.**

| id | key (abbrev.) | end | page text (head) |
|---|---|---|---|
| 712 | L89 `r11c12` ← L0 → L87 door (sphere 0.1) | failed | *"A\* start tile (10,18) … lethal-terrain Water"*: the sphere-0.1 inventory has no Swim and the L0 arrival is water. A leg-list artifact, not one of the walls (§8) |
| 718 | L91 ← L89 arrival → L92 door | failed | combat ladder EXHAUSTED, `enemy:drill@64,80`; bait *"NO LIVE BODY's removal admits a corridor"* |
| 719 | L91 ← L92 arrival → L89 door (**the walk's leg**) | failed | the same, the other direction |
| 923 / 924 | Feather ← L0 / L87 arrival (bottom `r11c12`) | failed | *"no corridor … pixelmask:cliffside1 … No strategy row exists … refused 3 UPWARD step(s) … `climbsArmedWaterfall`"* |

Done, among the rest:
- **482** (L53 `r14c9` from the L54 door → the L54 teleporter).
- **921 / 922** (the Feather from the top arrivals `r1c10` / `r1c15`).
- **717 / 720** (L91 to the door beside each arrival).
- **721** (L92 `r4c2` → L91), 709–711, 713–716, the 12 L87 legs and the L48/L51/L52/L54 legs.

**The walk's L53 leg is not in the list.** The walk enters L53 at `r2c2` (from L51 / L48) and crosses the logical
links `r2c2 → r9c10 → r14c9`. Leg 482 arrives at `r14c9` from below, and the list only builds link legs for rooms *no*
door enters. I hand-built the walk's legs in the list's own link format (`w0/cross-room-legs.jsonl.gz`;
`sweep-cross-room.tsv`):

| id | crossing | end | text |
|---|---|---|---|
| 9001 | L51 door → `r2c2` → `r9c10` → `r14c9` exit | failed | **seed 1's text verbatim**: *"chaser kill (jellyfish@144,192) by press: … still in the world after the whole 174-tick bound … 22.5 px"*, then 640 → 2560 |
| 9002 | L48 door → the same | failed | **seed 2's text**: *"ran out of 640, then 2560 work units … ⏱ DEADLINE"* |
| 9003 | L87 door → `r7c17` → `r3c12` → `r1c7` → `r4c2` exit (seed 2's L92 leg, crossed) | **done** | 464 t, 0 hits |

**`--carry-route-flags`** is on the DOOR-CARRY branch, not on main. I built the leg list with and without it from that
branch. Of the 40 legs only leg 0 changes (L0 flags 1/4; leg 0 is done anyway), and no wall leg carries a flag
(`w0/carry-check.txt`). It does not apply here.

## 4. W1 — the chains (node, deadline lifted) and the arms

**The instrument.** L40-CENSUS's `tools/chain.mjs`, unchanged: `solveAnytime`'s passes on one work clock, the deadline
lifted to 40960 units (64× the page's 640). **The cap was enough:** no run came within 5× of it. Every chain ended on a
named refusal (max 7368 units), and 482/721 solve as controls.

| leg | chain (work unit: verb body @tick) | end (work) | where the work went |
|---|---|---|---|
| 9001 | u1 break `breakablerock@112,128` · u12 break `breakablerock@128,160` t158 · u19 kill `lock@144,208` t229 … (the full pass repeats it from u2373) | REFUSED 7368 (2372 dashless + 4996 full), 16 s: the dashless pass on `jellyfish@144,192`, the full pass on *"chaser kill (puncher@136,96) by press: … still in the world after the whole 166-tick bound … 39.7 px"* | `execKill>deriveKillByChaser` 6310, `deriveGuardApproach` 968 |
| 9002 | the same breaks and the lock kill (dashless, to u4963) · full: break `@128,160` t206 → walk/time/bait/kill/narrow/detour/forced-hit on `puncher@136,96` | REFUSED 5555, 11 s: *"break stance (breakablerock@128,160): the combat ladder is EXHAUSTED … chaser:puncher@136,96 (inside leash 80 (d=11.6))"* | `deriveKillByChaser` 4459, `deriveGuardApproach` 654 |
| 719 / 718 | the combat ladder, one wall | REFUSED 20 / 8 units, < 1 s | — |
| 923 / 924 | the planner, one wall | REFUSED 2 units | — |

**The L53 room** (`w1/map-l53-9001.txt`).
- `lock@144,208` shuts the only way down to the teleporter.
- The arena (x 112–208, y 144–208) holds `jellyfish@144,192`, `jellyfish@184,160`, `jellyfish@152,168`,
  `puncher@136,96` (in the corridor above) and a static `icetrap@160,192`.
- The kill-lock opens on `totalEnemies() == 0`. Jellyfish survive water and never fall (`killLockBodies.js` K1), so
  the kill is the K3 chaser arm's, one body at a time.

**The L91 room** (`w1/map-l91-719.txt`). The drill stands in the one-tile west passage (row y 80, x 64). The three bobs
are east of it.
- With all four volumes forbidden: no corridor.
- Removing **`drill@64,80` alone admits** (a size-1 set).
- So the chooser's "no live body's removal admits" is literal: the chooser asks chasers only, and the drill is a static
  "Enemy". Compare PIT-WEST: there the blocking set was four chasers, too big for the chooser. Here the blocker is not a
  chaser at all.

### The arms (`w1/arms-table.tsv.gz`, 101 env-arm runs)

| arms | 9001 | 9002 | 719 | 718 | 923 | 924 |
|---|---|---|---|---|---|---|
| main: CSH, OPP, PEE, CPAIR, OPP+CSH, ALL (nine) | = D0 | = D0 | = D0 | = D0 | = D0 | = D0 |
| wave-6 tree: D0, STAGED_HUNT_SCAN_MEMO, CHOOSER_CUT, DETOUR_VIA_BOUND, CLEARTAG_CHAIN, KEYLOCK_TURRET, CSH+SHSM, OPP+CSH+SHSM, W6 (all fourteen) | = D0 | = D0 | = D0 | = D0 | = D0 | = D0 |

"= D0": the same digest as main's D0, i.e. the same refusal, byte for byte. **Pass: none. Later wall: none. Regress:
none.** No existing OFF switch touches these walls.

### The drill what-if (scratch; `w1/whatif-drill.patch`)

Why the existing drill code never runs here (measured with debug lines):
1. `execDrillKillsFirst` (DRILLKILL, ON) is called only before a **rope** clear-tag.
2. `execDrillTimedPassExit` (residue D-A, ON) returns early when the run holds a drill-killing weapon. At sphere 5.6 the
   bot holds a sword.
3. Both decide "the walk wakes a drill" on `plannedWalkSamples`. That function passes `allowTeleporter = null` to the
   planner, so a walk *to a door centre* never plans. The straight-line fallback passes 80 px from the drill, outside its
   48 px wake range, so nothing counts as woken.

| arm (scratch) | 718 (→ L92) | 719 (→ L89, the walk's) |
|---|---|---|
| A (timed pass allowed with a weapon) alone, B (kill first on a reach-exit) alone, C (the walk with the door allowed and the drill lifted) alone | = D0 | = D0 |
| **A+C** | **SOLVED 190 t, hitless (node fresh-run check: 0 hits, 0 deaths; 26 units)** | REFUSED: *"drill@64,80 … hops onto tile type 1 at (40,120) on tick 211; `Enemy.update`'s terrain switch … is not modelled for a drill. Refused by name (fidelity DRILL D2)"* |
| B+C, A+B+C | *"no drill has a kill stance — north/south/west not plannable floor, east wakes it"* | *"the creep from (120,88) reached 37.89 px on the axis and the drill never hopped"* |
| **A+C on the game page** (`seedling_bot_ap_p4g`, scratch tree served on :8124) | **done, 190 t, 0 room hits, 0 divergences** | the same DRILL D2 refusal |

So the timed pass is the answer for the drill, not a kill. 718 needs only the wiring. 719 then needs the model to follow
a drill that hops into water.

## 5. W2 — causes, dependency, budget

### W1 L53 kill-lock (BK3)
- **Cause:** a rung/approach gap in the kill-lock's chaser arm: a press kill that cannot close on a jellyfish
  (22.5 px off at the bound) and then on the puncher. It is not a budget wall: uncapped, both passes refuse by name.
- **OFF switch:** none (CSH, OPP, the staged hunt, the scan memo and the cut are all inert here).
- **Fix kind:** R, medium. The approach to a jellyfish/puncher in this arena. The puncher half overlaps the in-flight
  L95-PUNCHER topic.
- **Unlocks:** 9001/9002, i.e. the walk's L53→L54 crossing, BK3 and the L54 side.
- **Why seed 2 reads as a deadline:** from the L48 door the chain reaches the puncher only on the full pass, after 4963
  units, which is past 2560. The wall is the same.

### W2 L89 Feather from below
- **Not a solver wall.** The solver refuses the climb because the game forbids it (`climbsArmedWaterfall`, Player.as's
  waterfall push). The same goal from the top arrivals (921/922) is done.
- **The logic question for the user:** in the rules, `level_89__r11c12 / r4c4 / r6c16 → level_89__r9c6` need one
  `Progressive Swim`. The game needs the feather, which is the second Progressive Swim (the WATERFALL GATE catalogue
  entry), and the feather lies inside that pocket. Measured from the solver side: from the bottom the pocket is
  unreachable before the feather.
- **Options:**
  - (a) Correct the rules: those three links need Swim ×2, or are dropped. The Feather is then reachable only via
    `r1c10`/`r1c15`.
  - (b) Keep the rules and have the walk prefer the top arrival.
  - Either way the real route is L92 → L91 → L89 `r1c10`, which needs W3.
- **AP impact:** Feather's sphere stays 5.6 through the top route (L87 → L92 `r7c17` → `r3c12` → `r1c7` → `r4c2` → L91
  → L89 `r1c10`, each held at 5.6). So (a) should not move the sphere. This is argued from the rules, not measured with
  a sphere log.

### W3 L91 drill
- **Cause:** wiring, plus one fidelity gap. The rung exists; three gates keep it off (§4).
- **OFF switch:** none.
- **Fix kind:**
  - R, small: let the exit timed pass run with a weapon held, or try the pass before refusing; and pass the door to the
    wake test's planner.
  - Then F, small–medium: a drill's `Enemy.update` terrain switch (water). A kill-first arm is not the fix: no stance
    on 718, no hop on 719.
- **Unlocks:** 718 at once (measured on the page). 719, i.e. the walk's leg, after the fidelity row. Through 719: the
  Feather's real route, the L90 Chest (L90 is entered only from `r1c15`, which from below also needs Swim ×2), and the
  later rows that go through L91 (seed 1 row 31, Ghostspear).
- **Why does no removal admit a corridor?** The removal list is chasers-only. The one body whose removal admits (a
  size-1 set) is the static drill, which the list never contains. PIT-WEST's finding was the opposite case: chasers
  only, but the set needed was size 4.

### The strand
- **The walk's, not the solver's.** From the L92 arrival the solver leaves L91 by the L92 door (720 done).
- The whole-game walk's `planRoute` found neither a graph walk nor a Menu restart route for rows 27–30, yet routed row
  31 through L91 again. What filtered the graph there (`avoid`, events, the snapshot) needs a walk repro. Not measured
  here.

### W4 seed 2 L92 bait
- Not reproduced. Under the vanilla route's 5.6 inventory both `r4c2` legs pass, from L91 (721) and crossed from L87
  (9003). Seed 2's randomized inventory was not rebuilt (§8).

### Budget vs 640 / 2560
No wall is budget-bound. The 640 → 2560 messages on L53 are the page cutting a refusal that comes at 2372 units
(dashless) and 7368 units (both passes). Once W1 is answered, the solved chain's cost is unknown. The two-pass work here
suggests it would sit near the 2560 retry; that is unmeasured.

## 6. A recommended order

1. **User question first (no code): the Feather's logic.**
   - Should L89's bottom rooms reach the Feather pocket with one Swim? The game says no.
   - Ruling (a), correct the rules, or (b), keep them and make the walk prefer the top.
   - Either way the census predicts the Feather then waits on step 2.
2. **Slice DRILL-EXIT-PASS (W3, R, small).**
   - Let `execDrillTimedPassExit` run when a weapon is held (or as a rung before EXHAUSTED).
   - Fix the wake test's planner call (the door as `allowTeleporter`).
   - Unlocks 718 (measured on the page). Pins: the residue-D-A L28 rows.
3. **Fidelity row DRILL-WATER (W3's second half, F, small–medium).** A drill hopping onto water (`Enemy.update`'s
   terrain switch).
   - Unlocks 719 = the walk's L91 crossing → the Feather (with step 1), the L90 Chest, Ghostspear, and the rows behind
     the strand.
   - Hand it to fidelity with 719's request as the witness.
4. **Slice L53-KILLLOCK (W1, R, medium).** The K3 chaser arm vs the jellyfish (dashless) and the puncher (full) in the
   L53 arena. Coordinate the puncher half with L95-PUNCHER.
   - Unlocks the walk's L53→L54 crossing (BK3).
   - Independent of 1–3, so it can run in parallel.
5. **Walk question (the strand).** Reproduce the whole-game walk's rows 27–30 planner refusal from L91.
   - It may disappear once step 3 lands, because the bot no longer ends in L91.
   - Ask only if it persists.
6. **Seed-2 L92:** re-measure on a seed-2 leg list (its inventory) only once 1–4 have landed.

## 7. What the brief got wrong (measured)

- *"L53→L54 exit `level_53__r14c9 -> level_54__r1c8`"*: that leg (482, from the L54 door) is **done**. The wall is on
  the walk's crossing from `r2c2`, which the leg list lacks (9001/9002 reproduce both seeds' texts).
- *"chaser kill `jellyfish@144,192` … 640→2560"*: the jellyfish is the dashless pass's wall. Uncapped, the full pass
  ends on **`puncher@136,96`**, and the leg is a kill-lock (`lock@144,208`), not a lone chaser.
- *"L89 Feather … say whether the logic expects it reachable without the feather"*: it does. The rules give the bottom
  rooms the pocket at Swim ×1, while the game needs Swim ×2 (= the feather). From the top it is done today.
- *"L91→L89 … the drill"*: the walk's leg is 719 (from the L92 arrival). From the L89 arrival (717) it is done. 718 (the
  other way) fails too.
- *"Seed 2 … L92→L91 jellyfish bait"*: not reproduced under the vanilla inventory (721, 9003 done).
- *"wave-6 OFF switches … landing as trains 49/50"*: none were on main at the start SHA. They were measured on
  `hammer-harvest-wave6`. `--carry-route-flags` is on the DOOR-CARRY branch only, and it touches no wall leg.
- *"`execCorpseWeigh`-family"*: the "ALREADY TRUE before a tick" text is `botDriverV2.js:2213` (the dwell guard). Not
  measured further, since W4 did not reproduce.

## 8. Residue

- **Not measured:**
  - The L53 chain past the puncher (no arm reaches it).
  - The solved cost of W1.
  - Seed 2's inventory: no seed-2 preset is committed, so W4 was not rebuilt.
  - The strand's planner state.
  - The Feather's sphere under ruling (a) (argued from the rules only).
- **Leg 712:** a sphere-0.1 exit leg whose L0 arrival lands in water without Swim. A leg-list artifact (the arrival's
  region needs Swim); not a wall.
- **The leg list has no cross-room legs** for rooms that a door does enter (L53 `r14c9`, L92 `r4c2`). The walk uses
  such crossings, so a census of the walk's walls needs them. A list mode for that is a possible instrument slice.
- **Tooling:**
  - `tools/chain.mjs` wraps `Array.prototype.push` in its own process (measure-only).
  - The scratch worktrees (`wt-wi`, `wt-w6`, `wt-carry`) live in the session scratchpad, not in the repo.
  - Commits used `BOX_LOCK_COMMIT_ANYWAY=1` while this session's own sweep held the box lock.
