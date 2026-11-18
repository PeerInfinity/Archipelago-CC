# Seedling hammer-phase — BAIT-REMOVED: the bait arm when its target already left the world

Slice `seedling-hammer-bait-removed` (Opus, cloud). Planner: `seedling-hammer-phase-planning-6`/`-7`; no follow-up
arrived during the slice, so only the brief was followed. ⚖ User approval of the slice: 2026-11-12 (the hammer
replan). Landing still needs the user's own SHA-bound OK.

## 1. SHAs

- Start (base): `7a08bb360bb9023daa3651c7fe8eb2b910a6311f` (`origin/claude/seedling-solver-er-gaps-m6mwa5`)
- Branch: `claude/seedling-bait-removed-replan-b7m8di`
- Head: the commit that carries this report (code head before it: `a0cf68cb`)

## 2. The answer first

**Switch `BAIT_TARGET_GONE`** (`SEEDLING_BAIT_TARGET_GONE=1`, `withBaitTargetGone(enabled, fn)`), OFF by default.
It is read on the **worker thread** (the solve, `solverBot.js`). No main-thread mapper reads it.

- **Witness 2 (L99 east (96,112) → (48,96), Sword only):** OFF refuses (bait ALREADY TRUE). ON **SOLVES in 649 t,
  0 hits**, into L100. **Game witness PASS** on wasm `seedling_bot_ap_p4g`: 650 obs, maxHits 0, levels [99,100],
  respawns 0.
- **Witness 1 (ER c3, L40 → pit, `CHASER_PASS` ON):** OFF refuses (bait ALREADY TRUE on `bob@224,496`). ON the leg
  **goes past the bait** to the next named wall. The OUTER bait's (`bob@208,448`) stance walk re-plans from the pit's
  edge. The player drops into **L43, the goal level, at t688 with 0 hits**, and that sub-walk then refuses in L43
  ("not reached within 400 ticks", aiming at a stance in the room it left). §9 hands this over.
- **Live-body bait unchanged ON:** the generated bait gate (seed 1) gives the same tape and the same records ON as OFF.
- **OFF identity:** acceptance md5 base `391322d681b7aa0229d94b3f6906d024` = head `391322d681b7aa0229d94b3f6906d024`.

**The one thing to know first:** the brief's second hypothesis is wrong. The chooser did **not** pick a body that the
forecast already had leaving before the dwell. In both witnesses the forecast put the removal *after* the arrival
(+26 t and +168 t). The body chased the player during the stance walk and reached the kill region early. So the fix
is on the arm's side: a body gone after the stance walk means the bait is done. A chooser-side filter would not
have moved either witness.

## 3. The reproduction (measured at the base, before any change)

Node driver (scratch): `probe-seedling-er-landings.mjs`'s `landingStaging` plus `twoPassSolve`, the same call as
`solveFrom`. The timing was read with a temporary scratch hook on the bait arm (choice tick, arrival tick, and the
tick each chaser left the roster). The hook was reverted and never committed.

| witness | switches | verdict | time |
|---|---|---|---|
| 2: L99 (96,112) → reach-exit (48,96)->L100, post-sword latch, Sword only | base defaults | REFUSED: *"reach-exit (48,96)->L100 -> kill -> chaser kill (lavarunner@160,32) stance -> bait (lavarunner@160,32) stance -> bait (lavarunner@160,32): the dwell's condition (lavarunner@160,32 has left the world — the room's own kill region removed it) is ALREADY TRUE before a tick is spent …"* | 42.7 s |
| 1: ER c3, L40 (320,592) → reach-pit (14,27)->L43, Sword only | `SEEDLING_CHASER_PASS=1` | REFUSED: *"reach-pit (14,27)->L43 -> bait (bob@208,448) stance -> bait (bob@224,496): the dwell's condition (bob@224,496 has left the world — the room's own kill region removed it) is ALREADY TRUE before a tick is spent …"* | 151.8 s |

When the body left the world, relative to the arm's choice:

| witness | body | chosen at | forecast said | left the world | stance reached | hits |
|---|---|---|---|---|---|---|
| 2 | `lavarunner@160,32` (stance (120,72), bound 56) | t169 | removed **26 t after** the arrival | **t317** | t327 | 0 |
| 1 | `bob@224,496` (stance (232,424), bound 198) | t442 | removed **168 t after** the arrival | **t587** | t664 | 0 |
| 1 (outer) | `bob@208,448` (stance (248,504), bound 85) | t442 | 55 t after the arrival | t625 | — | 0 |

Why the arm chose the body: at the choice, each body was live and its derivation was sound. `deriveBaitStance`'s
straight line plus the chaser forecast put the removal after the arrival, which is what a bait needs. The walk to
the stance is an ordinary `walkTo`. It re-plans and climbs (in witness 2 it is itself nested inside the kill arm's
stance walk), and it takes far longer than the forecast's walk (158 t and 222 t). Meanwhile the body keeps chasing
the player. It crosses its kill region before the player arrives. `runDwell` then refuses, because waiting for a
condition that is already met proves nothing. That is correct for the dwell. For the arm it is wrong: the obstacle
is gone, and the walk that saw it go was the run's own walk, with its hits already billed (0).

## 4. Design and change

`solverBot.js` (one new block beside `CHASER_PASS`, one call site), `solverEnvChannel.js` (one name):

- `BAIT_TARGET_GONE = { enabled }`, `BAIT_TARGET_GONE_DEFAULT = false`, `BAIT_TARGET_GONE_COUNTS.gone` (rows
  `{id, chosenAt, arrivedAt}`), `withBaitTargetGone`.
- `baitTargetGoneRecord(run, bodyId, chosenAt, perTick, why)`: when the switch is ON and the bait's body is not in
  `run.entities('chasers')` after the stance walk, it returns a bait record `{kind: 'bait-gone', ticks: 0, at, why,
  until, strikes: 0}`. Otherwise it returns null.
- At the call site, after `walkTo(goal, bait.stance)`: if a record comes back, the arm pushes it and returns
  `{ escalations }`, exactly as it does after a dwell. The ladder then re-plans the corridor against the room as it
  now stands. Otherwise `runDwell` runs as before.

Why the arm side and not the chooser: §3 shows the forecast had both bodies leaving *after* the arrival, so a chooser
filter has nothing to filter. The defect is that the walk's own time is not the forecast's. Counting the removal as
done is the generic answer: the bait's goal is reached either way. `runDwell`'s refusal is untouched, so a dwell asked
on an absent body for any other reason still refuses by name. Nothing in the logic reads a level, a coordinate or an
enemy class.

OFF identity: `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives base
`391322d681b7aa0229d94b3f6906d024` and head `391322d681b7aa0229d94b3f6906d024`. Both witnesses' OFF refusals are
re-measured at the head and match the base text above (witness 2: 49.6 s; witness 1: 162.3 s).

## 5. Rows and bounded vitest runs

- `frontend/modules/seedlingDemo/hammerBaitRemoved.test.js` (default tier): **2 passed**.
  - the switch is OFF by default, named in `SOLVER_ENV_NAMES`, and the wrapper restores it;
  - live-body bait: the generated bait gate (`empty` 10x10, pre-sword, seed 1) solves ON with the same tape and
    records as OFF. The bait is the 139-tick `dwell` on `bob@16,80`, not `bait-gone`, and `gone` stays empty.
- `frontend/modules/seedlingDemo/hammerBaitRemoved.train.test.js` (train tier, `vitest.train.config.js`): **3
  passed, 392 s**.
  - witness 2 OFF: the refusal text;
  - witness 2 ON: 649 t, `gone` holds `{lavarunner@160,32, chosenAt 169, arrivedAt 327}`; replayed on the run (0 hits,
    L100) and on the tape stepper (`replaySolved`: `playerHits` [], last tick in L100);
  - witness 1 ON: `gone` holds `{bob@224,496, 442, 664}`; no ALREADY TRUE; the refusal is the outer bait's stance walk
    in level 43; the replayed `perTick` lands in L43 at t688 with 0 hits.
- `solverEnvChannel.test.js`: 11 passed.
- The witness-1 OFF pin in `hammerErGaps.train.test.js` is unchanged; it still holds OFF.
- Regenerated: `census-seedling-solver-surface.mjs --write` (one site row moved: `chasers` 22→23), then `--check`
  GREEN with 372 rows. `generate-procgen-reference.mjs`: no change, `--check` ALL MATCH. `generate-docs-index.mjs`:
  no change, `--check` OK. `census-seedling-constants.mjs --check`: PASS (0 new, 0 moved). No docs edit under
  `docs/json/developer/procgen/`, so no procgenDocs pins are owed.
- No train-shard cost row was added for the new train file. It takes the lightest shard, and the job warns, as
  `hammerErGaps.train.test.js` does today. Measured cost: 392 s locally.

## 6. Game witness

Witness 2's ON plan was run on the game. A scratch copy of `probe-seedling-er-landings.mjs` added one case,
`w2-l99-east`, solved from the bare goal with `SEEDLING_BAIT_TARGET_GONE=1`. The tracked probe is unchanged.
Setup: dev server `scripts/serve-nocache.py 8000`, wasm `seedling_bot_ap_p4g`, delivered set
`seedling-vanilla-record-5aeefc3c`, headless logic-only, under the box lock:

```
INFO {"model":"w2-l99-east",…,"verdict":"SOLVED","ticks":649,"verbs":["kill(lavarunner@176,64)","kill(lock@112,112)","kill(lavarunner@160,32)","walk","walk","walk","dodge(lavachain@80,64)","walk"],"ms":69779}
ROW {"tape":"w2-l99-east",…,"observations":650,"boot":{"level":99,"x":96,"y":112},"held":{"items":["hasSword"],"keys":[]},
     "levels":[99,100],"wrote":["99:0"],"maxHits":0,"seals":0,"respawns":0,"final":{"t":649,"x":40,"y":104,"level":100}}
PASS: w2-l99-east: the game ran the tape to its end on the delivered set — 650 obs
PASS: w2-l99-east: Sword only, BAIT_TARGET_GONE ON: from L99 (96,112) the player reaches L100 by (48,96), without dying
ALL CHECKS PASSED
```

Witness 1 does not solve, so it has no game witness.

## 7. Census

**The switch moves only a leg whose current stop is the bait arm's "ALREADY TRUE … has left the world".** Any other
leg never reaches the new branch with the body gone: a live body still dwells, as in the bait-gate row.

- **Route surveys at the base, defaults (OFF), `--through=end`:** vanilla 244 steps (219 SOLVED, 25 stops);
  seedling_er 383 steps (338 SOLVED, 45 stops). No stop's refusal contains "has left the world" or "ALREADY TRUE".
  ER step 50 (`L40 visit 1`) stops earlier, on *"the combat ladder is EXHAUSTED"*, because `CHASER_PASS` is OFF.
- **ER steps 50 and 60 (L40) with `SEEDLING_CHASER_PASS=1`, `--timeout=600`, OFF vs ON:** both steps
  move. OFF: REFUSED on *"reach-pit (14,27)->L43 -> bait (bob@208,448) stance -> bait (bob@224,496): … ALREADY TRUE"*,
  in 160.1 s and 158.7 s. `BAIT_TARGET_GONE` ON: no ALREADY TRUE. Both refuse at the next wall (§9.1): *"bait
  (bob@208,448) stance: the re-planned corridor failed too … in level 43, aiming at (40,424)"*, in 159.6 s and 160.6 s.
  Step 60 is the same room and the same stop as step 50.
- **Seed-1 divergence-sweep legs:** the leg list was rebuilt at the base (`seedling-divergence-legs.mjs`, 936 legs).
  Neither witness is a sweep leg. The sweep's L99 legs are region-local: `level_99__r2c7 <- in_L98_112_112 ->
  exit:out_stairsdown_112_112` and `level_99__r2c4 <- in_L100_48_96 -> exit:out_stairsup_48_96`. Neither crosses the
  lava room from the east arrival to (48,96). The sweep's L40 pit legs arrive from L39 or L43
  (`level_40__r26c13 <- in_L39_144_0 -> exit:out_pit_*`, `… <- in_L43_176_464 -> …`), not from L19's stairs. The
  committed sweep evidence carries no bait "ALREADY TRUE" row either. Its two "has left the world" rows are other
  refusals: leg `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield` is a bait that *never became true*
  (`seedling-fidelity-leash-evidence/sweep-base-solver.jsonl`), and `level_16__r1c9 <- in_L17_32_48 ~> … ->
  exit:out_pit_8_4` is the press-kill arm's (`seedling-fidelity-corpsebump-evidence/sweep-A*.jsonl`). The switch
  moves neither. **Expected movement on the seed-1 sweep: none.** No browser sweep was run.
- **Witness 3 (Connected L92, the jellyfish):** not reachable from the cloud. The bait chooser reads the live roster
  (`run.entities('chasers')`), so it cannot pick a body that is already dead at the choice. If the server-data run
  shows the same text, the body probably left during the stance walk, which is this switch's case. That is
  unmeasured. Re-run there with `SEEDLING_BAIT_TARGET_GONE=1`.

## 8. What the brief got wrong (measured)

- *"why the arm chose a body the forecast already had leaving"*: in both witnesses it did not. The forecast had the
  removal 26 t and 168 t **after** the arrival (§3). The stance walk was longer than the forecast's walk, and the
  chasing body reached its kill region first. So the "and/or the chooser does not pick a body the forecast has
  leaving" half was not built: it would move neither witness.
- *"The target was removed by the ROOM between the choice and the dwell"*: correct, and it happened **during the
  stance walk** itself (t317 vs arrival t327; t587 vs t664).
- *"(witness 1) 173 s"*: at this base the driver took 151.8–162.3 s OFF (4 cores, sometimes with a survey running
  alongside).

## 9. Residue / hand-overs

1. **Witness 1's next wall (solver, sub-walk transition):** after the inner bait is done, the outer bait's
   (`bob@208,448`, already gone at t625) stance walk re-plans from (232,424) at the pit's edge. It crosses into L43,
   the goal's own target level, at t688 with 0 hits, then keeps aiming at (40,424) in L43 for 400 ticks and refuses.
   Two generic candidates:
   - (a) the outer bait arm checks for its body before its stance walk *re-plans* (the same rule, asked inside the
     walk), so the outer bait would end at t664 too;
   - (b) a sub-walk that crosses into the parent goal's target level hands the goal back as reached.
   Either one would be a new switch. Rows: `hammerBaitRemoved.train.test.js`'s third test is the witness.
2. **A train-shard cost row** for `hammerBaitRemoved.train.test.js` (392 s locally) is the CI owner's call.
3. **Witness 3** (Connected L92) needs a run with server data (§7).
