# Seedling hammer-phase KT-ARRIVAL — L40's boss lock past the ice turret, from the south arrival: kill the turret first, baiting its volley at the range's edge (`KEYLOCK_TURRET_ARRIVAL`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-kt-arrival` (planner `seedling-hammer-phase-planning-14`), cloud, Opus. ⚖ approved by the user 2026-11-24 (*"Launch it (Recommended)"*) |
| Start SHA | `ad51fadf186044c14b5e6a62b8352cc103029718` (`origin/hammer-stack-face1-meter` = main `817d620e30` + four OFF hammer switches) |
| Head | step commits `c39f84f0` (measure), `3493d563` (code), `aa36d358` (rows), `06be51b2` (ON/OFF, page witness, census); this report is the last commit |
| Branch | `claude/keylock-turret-arrival-25x4c5` (the harness's designated branch) |
| main at the end | `817d620e30`, unmoved and an ancestor of the head, so no merge was needed |
| Switch | `solverBot.KEYLOCK_TURRET_ARRIVAL`, **OFF**. `SEEDLING_KEYLOCK_TURRET_ARRIVAL=1` / `withKeylockTurretArrival(enabled, fn)`; its line is in `SOLVER_ENV_NAMES`. The decision runs on the page's **worker** thread (the frontier loop in `solverBot`), not on a main-thread mapper |
| Follow-ups followed | planning-14's follow-up (the user's *"we already have a strategy for fighting the turret … predicting when and where it fires, and baiting it. Can we do something similar for approaching it?"*): measured FIRST, as asked (§3.3). It shaped the change: the approach now baits the volley at the range's edge (§4) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-kt-arrival-evidence/` (its README names every file) |

## 2. The answer first

**The one thing to know first:** the turret can be killed hitless from the south arrival, but two orderings stood in the
way, and the existing arms fixed only the first.

1. The frontier walks to the keylock stance BEFORE anything kills the turret. Its `brave` row has already exempted the
   turret's disc, so the stance derives with the turret alive, and the walk meets the turret's body.
2. Handed the turret (by `ICETURRET_STATIC_KILL`, or by the keylock arm), the approach starts every try from a
   staging point at rest just outside the range. From the point it picks once the door is open, (488,561), every
   try is hit. The waits do not help: they stand at the kill stance, inside the volley. Stopping first at the
   range's edge (4 px inside the range), so the volley clock starts there, makes the kill hitless at the first-ranked
   try.

| question | answer (measured) |
|---|---|
| A1 29:11 (the captured request, GSW+PM ON as captured) | OFF: REFUSED, work 74 (live answer `c7b1b22b2c60`). **ON: SOLVED 1404 ticks on the dashless pass at work 345 (inside the 640 budget); fresh-run replay 0 hits, 0 deaths, crosses to L41 at t1404** |
| …with GSW and PM OFF | OFF: the same refusal. **ON: the same SOLVED 1404, work 345, 0 hits** |
| survey step 134 | OFF REFUSED (the brief's words). **ON SOLVED 1384 ticks, 0 hits, 0 deaths, ends in L41, earns {40,8}** |
| other survey steps | the six other L40 steps (66, 96, 136, 149, 166, 173): **byte-identical rows ON vs OFF** (ms dropped). No step gained a hit. No other level can reach the code (§7) |
| p4g game witness (fresh page) | **both crafted legs `done`, 0 room hits, no divergence, no recovery, end L41 (24,168) = the model's**. The south arrival from L39 plays the same 1404-tick plan as A1 29:11. OFF, the page refuses with A1's words |
| `ICETURRET_STATIC_KILL=1` (the planner's hand-off) | not sufficient: every mode hands the turret over at t100, then refuses. At 640 and 2560 it hits the budget (46/193 tries); unbounded it ends with *"no side of iceturret@472,400 gives a hitless kill"* (490 forks) |
| OFF identity | acceptance md5 **`391322d681b7aa0229d94b3f6906d024`** at the head (OFF) and at the base (a pristine `ad51fadf18` worktree) |

Classification: **(a)**. A hitless line exists in the model (and in the game), and two orderings miss it: the walk
before the kill, and the approach's in-range start.

## 3. The reproduction (measured)

### 3.1 A1 29:11 and step 134 at the base

- A1 29:11 replayed in node (`tools/m.mjs`, the worker's `solveAnytime`) with GSW+PM ON: REFUSED, work 74, the message
  word for word (`m1/base-on.txt`). Also at 2560 with both OFF: the same 74 (`m1/base-off-2560.txt`). It is HARD, not
  a budget cut.
- Survey `--through=end --only=134`: REFUSED, "LADDER — every rung of ⚖ §11.8a's order refused", the same text.

### 3.2 (a) Where the walk is, and why the stance walk runs before the turret kill

Temporary prints (removed before any commit) at `deriveKeylockStance` and the frontier's stance walk:

- the walk is at **(488,904), t100**, standing below the door `wandlock@480,560`. Tag 12 is in the persistence, and the
  door fades open at about t100. The first 100 ticks are the frontier's `hold` row (`wandlock@480,560`, t0).
- `deriveKeylockStance` is asked with contacts `["proximity-hazard:iceturret@472,400"]`. The reach-exit frontier's
  `brave` row has already exempted the disc. So `keylockCandidates` finds 1 cell, (488,376), and `stanceReaches` reaches
  it. The arm returns a plain stance, **not** `turretFirst`, because `KEYLOCK_TURRET` asks `keylockTurretStance` only
  on **0 candidates**. KEYLOCK-TURRET's own report named this as residue ("the frontier path … the turret's `brave`
  row has usually already put its disc in the contacts, so the candidates are non-empty and this arm is not asked").
- The frontier's `walkTo(goal, stance)` then plans past the live body at (471.6,441.1). Avoid finds "different
  connected components" and kill refuses the static body by name. The ladder throws at **perTick 100 → 100: no tick
  spent**.

### 3.3 The planner's follow-up first: the existing volley-timed approach, handed the turret

| arm | 640 | 2560 | unbounded |
|---|---|---|---|
| `ICETURRET_STATIC_KILL=1` (both / chooser / hit, GSW+PM ON) | handed t100 (`via chooser`/`hit`); budget cut after 46 tries | budget cut after 193 tries (GSW+PM OFF also) | REFUSED: "no side of iceturret@472,400 gives a hitless kill — up: no try is hitless (490 fork(s)) …; left/right/down: no plannable staging point outside the range" |
| the keylock arm handed it (step 2's hand-off WITHOUT the edge bait) | budget cut after 44 tries | budget cut after 192 tries | REFUSED: "no approach to iceturret@472,400 from the staging point (488,561) is hitless — 504 fork(s), {approach-body 2, approach-hit 10, wait-hit 480}" |

So the hand-off alone is not the fix. Files: `m1/isk-*.txt`, `legs/395-exit-on.txt`, `legs/412-exit-on.txt`.

### 3.4 (b) Why legs 395/412 (clear-tag) solve and this arrival does not

Leg 395's staging (`hammerKeylockTurretL40.LEG_395`) boots at **the same (480,896)** as A1. With the walk's own goal
(teleporter@944,96) it reproduces A1's refusal word for word (`legs/395-exit-off.txt`), so the goal is what differs,
not the state. With the clear-tag goal it solves (718 t, `right` wait 29, 70 forks) because:

- the clear-tag keylock has 0 candidates (no brave row), so `KEYLOCK_TURRET` carries `turretFirst` and the kill runs
  **at t0**;
- at t0 the door is still shut, so APPROACH's staging scan skips (488,561) (solid) and stages at **(488,579)**.

The clock alone moves it: the clear-tag goal after 50 empty ticks still solves; after **100 or 150 it refuses**, with
exactly A1's 504-fork tally (`legs/395-ct-idle*.txt`). By then the door is open, the scan's first point is (488,561),
and every try from there is hit.

### 3.5 (c) Is there a hitless kill from this side? Yes; the knob is the in-range start

Temporary hooks on the clear-tag/idle-100 case (`sweep/`; removed):

| knob | result |
|---|---|
| staging point pushed past (488,561) by N px (N = 0…32) | solves at N = 2, 10, 14, 18, 28; refuses at 0, 4, 6, 8, 12, 16, 20, 24, 32. A lottery: the player stands at rest at the stage, so N only moves the entry into the range |
| still ticks at (488,561) before the tries (1…8) | none solves: the same 504-fork tally. Outside the range `IceTurret.update`'s `else` re-arms `shootTimer`, so waiting there changes nothing (turret at (488,416); the stage is at `int` distance 145 > 128) |
| **every try first stops on the stage→turret line at D px from the turret** | **solves at D = 127, 124, 120, 112**: rank 0 or 2, 16–40 forks, 3–6 s, fresh run hitless |

This is the user's baiting idea applied to the approach. The volley's clock starts where the player enters the range,
and that place is chosen: stop at the edge, then take the route. The waits APPROACH already tries stand at the route's
first waypoint, which on this side is the kill stance itself, inside the volley (480 `wait-hit`).

## 4. Design and change; OFF identity

All in `solverBot.js` (plus one name in `solverEnvChannel.js`). New functions and one call site; two small hunks pass
an opt-in field through existing functions. Nothing reformatted or renamed.

- **The switch block** (after `resetKeylockTurretCounts`): `KEYLOCK_TURRET_ARRIVAL`, `_DEFAULT = false`,
  `withKeylockTurretArrival`, `KEYLOCK_TURRET_ARRIVAL_COUNTS` (`asked`: written only ON, read by nothing that decides)
  and `resetKeylockTurretArrivalCounts`.
- **The call site**: the frontier's stance walk (`walkTo(goal, plan.resolved.stance, …)`) gains a `catch`. ON, it asks
  `keylockTurretArrival`; if that declines, the refusal is rethrown unchanged. OFF, `KEYLOCK_TURRET_ARRIVAL.enabled &&`
  short-circuits and the error is rethrown. One line records `stanceFrom = perTick.length`.
- **`keylockTurretArrival`** (new, after `keylockTurretFirst`) takes over only when all of these hold:
  - the plan is `keylock`, has a stance and no `turretFirst`, and no tick was spent;
  - the refusal is a `SolverRefusal` containing `the combat ladder is EXHAUSTED`, and its `obstacle` is `danger`;
  - every source it names is a **live ice turret** of the room (`run.world.iceTurrets`, not dead or removed);
  - the stance is inside each turret's disc. This is the arm's own question: with that disc not exempt,
    `plannerObstacleAt(stance)` answers that turret's `proximity-hazard`.

  It then calls **`keylockTurretFirst`**, the keylock arm's existing kill path (§11.4: one writer of the turret's
  death), with `turretFirst: {kill, stance, exempt: contacts + discs, edgeBait: true}`. That path runs
  `requireVerb('kill', …)`, `approachKillForCorpse` on forks, reads the death back on the live run, then does the
  stance walk with the discs exempt. Its refusal propagates by name. The executor's lean and hold follow as before.
- **The edge bait**: `keylockTurretFirst` passes `edgeBait` to `approachKillForCorpse` only when its `turretFirst`
  carries it, and only this arm sets it. There, `approachEdgePoint(run, turret, stage, opts)` (new) is the point on the
  stage→turret line `TURRET_APPROACH_EDGE_DEPTH` (4) px inside `attackRange`, measured from the turret's own x,y (the
  origin `FP.distance` uses). It is null where that point is not plannable floor. Each try first stops there (`edge-hit`
  counted if hit), then runs its route, wait and kill unchanged. The keys include the stop, so the live replay is the
  fork's. Without `edgeBait`, `edge` is null and every try is OFF's.
- No level id, coordinate or Seedling constant in the logic. The depth is a tuning constant derived from
  `ICE_TURRET.attackRange`.
- Not edited: `contactFidelity.js`, `levelRun.js`, `dangerMap.js`, `iceTurret.js`, `botDriverV*.js`, `flashPanel/*`,
  rules, AS3, wasm, gitlinks.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives
`391322d681b7aa0229d94b3f6906d024` at the head and at the base (`gates/acceptance-md5.txt`).

## 5. Rows and bounded vitest runs

| file | row | asserts |
|---|---|---|
| `hammerKeylockTurretArrival.test.js` (fast, ~5 s) | ships OFF | `_DEFAULT` false; `enabled` follows the env; the env channel lists the name; the wrapper toggles and restores |
| | the source | exactly one call site, the guarded catch that rethrows; the arm calls `keylockTurretFirst` with `edgeBait: true`; the no-tick guard; `edgeBait` set in two places only; the edge asked only through `resolved.edgeBait` |
| | L40 leg 412 staging, exit goal | OFF refuses on the stance walk (`EXHAUSTED … iceturret@472,400`), nothing asked. ON: solved, fresh-run hits [] and deaths 0, crosses to 41, `asked` = one entry `{lock, t:100, turrets, stance (488,376)}` |
| `hammerKeylockTurretArrival.train.test.js` (train, ~45 s) | A1 29:11 (fixture) | OFF: refused, work 74, the live words. ON: the dashless pass solves inside 640 with `modelHits {0,0}`; fresh run hitless and deathless; crosses to L41 on the last tick |
| | leg 395 staging, exit goal | ON solved, fresh run hitless, into L41 |
| | the door shut | ON deep-equals OFF, nothing asked (the latch's button room refuses first) |
| `hammerKeylockTurretArrivalRows.js` | (support) | `solveL40Exit` (staging + worker path + fresh replay) and `solveCapturedA1` |
| `fixtures/kt-arrival/A1-29-11.request.json` | (63 KB) | the page worker's own request, its source cut to its L40/L41 records. Over the committed atlas it answers as the capture does (OFF work 74; ON 1404 at 345). The committed atlas alone refuses it ("clears tag(s) 14, 25") |

**Mutants** (each applied to a copy, the fast rows run, the file restored byte for byte): M1 guard forced off (`false &&`)
→ the source row and the leg-412 row red; M2 the arm's `edgeBait: false` → the same two red. The leg-412 ON solve
refuses again without the bait (54 s, the 504-fork search).

**Bounded vitest by path** (⚖ 52; `gates/bounded-files.txt`: the 81 fast files naming `approachKillForCorpse`,
`keylockTurret`, `KEYLOCK_TURRET`, `iceturret@472,400`, `bosslock@480,352`, `solverEnvChannel` or `TURRET_APPROACH`):
**OFF 81 files 1011/1011**, **`SEEDLING_KEYLOCK_TURRET_ARRIVAL=1` 81 files 1011/1011**. The new train file: 3/3
locally (`--config vitest.train.config.js`, by path).

**Regenerated / checked:** `census-seedling-solver-surface --check` was RED on site counts only; after `--write` it is
GREEN at 374 rows (no new row). `census-seedling-constants --check` PASS (0 new). `generate-procgen-reference` →
`check-procgen-reference` ALL CHECKS PASSED. `generate-docs-index` OK and `--check` OK (no change). No doc under
`docs/json/developer/procgen/` was edited.

**Not done:** the dispatched train-tier run (`unittests_frontend.yml -f train_only=true`). The dispatch from this
session was refused (`403 Resource not accessible by integration`), so it is the planner's (§9). The slice push runs
CI's default tier.

## 6. Page play / game witness

`probe-seedling-divergence-sweep --page=seedling_bot_ap_p4g --mode=inv` (fresh pages, `serve-nocache.py` on :8000
started and stopped by this session). The legs file `page/kt-legs.jsonl` holds two **measurement-only crafted legs**.
Each is leg 853's or 854's arrival with its staged `flag:L40:12` event, plus leg 360's goal (`exit:out_teleporter_944_96`,
→ `level_41__r4c3`). The sweep has no leg with this pair: its south region's exits are all south of the lock.

| crafted leg (key) | OFF | ON (`--solver-env=SEEDLING_KEYLOCK_TURRET_ARRIVAL=1`) |
|---|---|---|
| `level_40__r23c29 <- in_L39_144_0 ~> level_40__r26c13 -> exit:out_teleporter_944_96` | `failed`: A1's words, (471.6,441.1) | **`done`**: 1404 t (dashless, work 345), roomHits max 0, no divergence, 0 recoveries, end L41 (24,168) = expected |
| `level_40__r23c29 <- in_L43_176_464 ~> level_40__r26c13 -> exit:out_teleporter_944_96` | `failed`: the same words, (472.3,441.5) | **`done`**: 1233 t (full pass, work 285), roomHits max 0, end L41 (24,168) = expected |

Rows: `page/{on,off}-rows.jsonl` (the `granted` lists dropped).

## 7. Census: which seed-1 divergence-sweep legs the change can move

- **Reach.** The arm needs a keylock plan whose stance lies inside a live ice turret's disc. Only two levels have an
  ice turret: L40 and L98. Only L40 also has a boss lock (`bosslock@480,352`). This holds in the committed atlas and in
  the page's own records (A1's source). L98's turret has no lock. So only L40 legs can reach the code.
- **The L40 sweep legs** (ids at this base, keys from `seedling-divergence-legs.mjs`):
  - Two legs ask for that lock from the south, where the key line is:
    - `level_40__r23c29 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 8: bosslock@480,352 cleared` (853);
    - `… <- in_L43_176_464 ~> …` (854);
    - these are KEYLOCK-TURRET's 395/412 at its SHA.
  - Measured on their stagings in node: **ON = OFF, nothing asked**, with the door carried (both solve, 718/740 t) and
    with it shut (both refuse, same text) (`census/`). Their clear-tag keylock has 0 cells, so `KEYLOCK_TURRET`'s
    `turretFirst` takes them first, and the arm requires that there is none.
  - Exit and location legs of `level_40__r26c13`, `r32c36` and `r48c54` (365–396, 855–858): their goals are south or
    east of the door. They walk no keylock stance under the turret.
  - North arrivals `level_40__r0c53 <- in_L41_0_160 / in_L42_240_336 -> …` (359–364) and `level_40__r23c29 <- in_L41 /
    in_L42 ~> level_40__r0c53 -> location:L40 flag 8` (851/852): from the north the key line is behind the lock (sealed).
    Not measured; nothing there walks into the turret's disc to a stance.
- **So no sweep leg in the committed list is expected to move.** The change moves the whole-game walk's own leg (entry
  29, A1 29:11) and survey step 134. A sweep leg would move only if it carried L40 from the south with tag 12 and a
  goal north of the lock, which is exactly the crafted pair of §6.
- **Survey:** all seven L40 steps both ways (`--through=end --only=66,96,134,136,149,166,173`). 134: REFUSED → SOLVED
  1384 t, 0 h. The other six: identical rows. A full `--through=end` survey ON was not run locally (CI's job is 12
  shards per route and has no `solver_env` input). By the reach argument above, the other 243 steps never ask the arm.

## 8. What the brief got wrong (measured)

- *"the keylock arm (`execKeylock` under `KEYLOCK_TURRET`, default ON, which kills the turret first …) is never
  reached"*: right that it is never reached, but `execKeylock` is reached only after the stance walk. The arm that would
  carry the kill, `keylockTurretStance`, is not asked, because the stance derives with 1 candidate: the brave row
  already exempted the disc.
- *"when the walk … refuses and its only danger is a turret the keylock arm would kill, run that kill as a prerequisite
  first, then the walk"*: necessary, not sufficient. Run first, the kill itself refuses from this arrival (504 forks, no
  hitless try at (488,561)). The second piece is the approach's in-range start (§3.5), the planner's follow-up idea.
- The step-1 class question: the hitless line needed the edge bait, not a pure reorder. It is still class (a): it is
  found in the model and witnessed in the game. No fidelity gap was found.
- Leg ids: 395/412 (KEYLOCK-TURRET's SHA) are **853/854** at this base.
- *"the request's staging boots at L40@480,896 … the door is OPEN"*: confirmed, though the door fades open at ~t100 of
  the request, not at t0. The frontier's `hold` row waits for it, which is why the stance walk starts at t100.

## 9. Residue and hand-overs

- **Train-tier dispatch (planner):** `unittests_frontend.yml -f train_only=true` at the head (this session's dispatch was
  refused with 403). The new train file is 3/3 locally.
- **ICETURRET_STATIC_KILL's path** (`killIceTurretOnWalk`) shares the gap. Its tries refuse the same way from (488,561)
  (unbounded, 490 forks). It is not edited here; the edge bait could be offered to it the same way if the planner wants
  that arm ON.
- **`TURRET_APPROACH_VOLLEY_ORDER`'s anchor** is probed from the staging point, not from the edge. On this leg the bait
  solves at rank 0 regardless (anchor null). An edge-relative anchor is unmeasured.
- **The edge bait for KEYLOCK_TURRET's own (0-cell) path** is not wired. Its legs (853/854) solve today because their
  kill starts at t0 with the door shut. Measured: delayed 100+ ticks, that path refuses the same way. Offering
  `edgeBait` there is a one-field change, out of this brief's scope.
- **Game witness scope:** the two crafted legs on p4g, not the whole-game walk (not asked). The next re-measure of the
  walk will tell whether entry 29 passes in place.
- Not committed: the 21 MB A1 capture (it is on `origin/claude/whole-game-wasm-remeasure-yl4bw0`), the survey logs, and
  the temporary debug hooks (none were ever committed).
