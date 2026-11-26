# Seedling hammer-phase EDGEBAIT — the turret edge bait offered to the other two kill paths (`KEYLOCK_TURRET_EDGE_BAIT`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-edgebait` (planner `seedling-hammer-phase-planning-14`), cloud, Opus. ⚖ approved by the user 2026-11-24 (*"Edge bait follow-up"*) |
| Start SHA | `a5f7c6caf4563d8b0c65776f03ada03e2343c04a` (`origin/main`, TRAIN 207) |
| Head | step commits `271f0c51` (measure), `a8dd8ec2` (code), `e9a2e81f` (rows), `7c5bf80a` (ON/OFF, page); this report is the last commit |
| Branch | `claude/seedling-hammer-edgebait-w7xryd` (the harness's designated branch) |
| main at the end | `a5f7c6caf4`, unmoved (fetched before this report), so no merge was needed |
| Switch | `solverBot.KEYLOCK_TURRET_EDGE_BAIT`, **OFF**. `SEEDLING_KEYLOCK_TURRET_EDGE_BAIT=1` / `withKeylockTurretEdgeBait(enabled, fn)`; its name is in `SOLVER_ENV_NAMES`. The decision runs on the page's **worker** thread (`keylockTurretFirst`, inside the keylock executor), not on a main-thread mapper |
| Follow-ups followed | none arrived |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-edgebait-evidence/` (its README names every file) |

## 2. The answer first

**The one thing to know first:** the edge bait helps the keylock arm's own path only as a **second family of tries
next to OFF's**, not in place of them. Run edge-first, it solves the door-open cases but breaks a case that solves
today (leg 854 at tick 0) under the worker's budget of 640. For the walker's general kill (`ICETURRET_STATIC_KILL`),
the bait does not help at all. That arm's tries hit the turret's body on their route, and no timing fixes geometry.

| path | OFF (base) | ON (`KEYLOCK_TURRET_EDGE_BAIT=1`) |
|---|---|---|
| `KEYLOCK_TURRET`'s 0-cell path, leg 853's staging, clear-tag goal after a 100 / 150-tick idle | REFUSED: 504 forks `{approach-body 2, approach-hit 10, wait-hit 480}` from (488,561); the worker (640) runs out of budget | **SOLVED**: 673 t, edge family, rank 0, 32 forks; worker dashless pass at work 476 / 542; fresh run 0 hits, 0 deaths, lock open, turret dead |
| the same for leg 854's staging (100 / 150) | REFUSED: 600 forks `{approach-hit 20, wait-hit 528, kill-refused 40}`; the worker runs out of budget | **SOLVED**: 699 t, edge family, rank 0, 29 forks; worker dashless at work 468 / 499; fresh run hitless |
| leg 854 at tick 0 (door shut, today's solve) | SOLVED 740 / 559 t, 8 forks, work 312 | **identical plan, key for key**, work 312 |
| leg 853 at tick 0 | unbounded SOLVED 718 t (70 forks); the worker's 640 runs out of budget | unbounded the same 718 t / wait 29 plan (130 forks); 640 runs out of budget as OFF does |
| `ICETURRET_STATIC_KILL` (A1 29:11, leg 395/853 exit goal) | REFUSED: 490 forks `{approach-hit:iceturret 98, circle:other 392}` | **not changed**. Measured with a hook, the bait on its own tries still refuses (490 forks, `approach-hit:iceturret 89, blast 9`). Not wired (§8) |
| OFF identity | acceptance md5 **`391322d681b7aa0229d94b3f6906d024`** at the base and at the head (OFF) | — |

No survey step moves: all eight L40 and L98 steps are byte-identical ON vs OFF, with `KEYLOCK_TURRET_ARRIVAL` OFF and
also ON. The two sweep legs that reach the code, 853 and 854, play `done` with 0 room hits on p4g both ways. So the
switch moves **no** seed-1 sweep leg and **no** survey step at this base. What it repairs is the keylock arm's own path
whenever that path starts after the door below the turret is open. Today that happens only in a node staging (§7).

## 3. The reproduction (measured)

Tools: `evidence/tools/leg.mjs` (KT-ARRIVAL's, `solveFromTape`, no budget), `legA.mjs` (the same stagings through
`solveAnytime` with the worker's two passes and budget 640), `fx.mjs` (the committed A1 29:11 fixture).

### 3.1 Path 1: `KEYLOCK_TURRET`'s own turret-first path (`keylockTurretStance` → `turretFirst`)

| case | base | edge-first (hook `HOOK_EB_KT`) | edge-first + anchor from the edge (`HOOK_ANCHOR_EDGE`) |
|---|---|---|---|
| 853 clear-tag idle 0 | SOLVED 718, right wait 29, 70 forks (anchor 32, rank 5) | SOLVED 722, via (467,402) wait 17, **369 forks** (rank 29) | SOLVED 722, 345 forks (anchor 31, rank 27) |
| 853 idle 100 | REFUSED, 504 forks (A1's tally) | **SOLVED 673, via (467,446) wait 0, 16 forks, rank 0** | SOLVED 675, 371 forks (anchor 20, rank 35) |
| 853 idle 150 | REFUSED, 504 forks | **SOLVED 673, 16 forks, rank 0** | — |
| 854 idle 0 | SOLVED 740, right wait 35, 8 forks (rank 0) | SOLVED 741, **462 forks** (rank 37) | SOLVED 741, 269 forks |
| 854 idle 100 | REFUSED, 600 forks | **SOLVED 699, 10 forks, rank 0** | SOLVED 701, 388 forks |

All solves above are hitless on a fresh run. Under the worker's budget (`legA.mjs`, 640):

| case | base | edge-first |
|---|---|---|
| 853 idle 0 | budget cut (`crusher-fork`) | budget cut |
| 853 idle 100 | budget cut | **SOLVED 653 (full pass), work 549** |
| 854 idle 0 | **SOLVED 559, work 312** | **budget cut: a regression** |
| 854 idle 100 | budget cut | SOLVED 502, work 406 |

So edge-first is not shippable (it loses 854 at t0), and an anchor probed after the edge stop is worse everywhere.

### 3.2 Path 2: `ICETURRET_STATIC_KILL` (`killIceTurretOnWalk`, the walker's kill rung)

| case | result |
|---|---|
| A1 29:11 (fixture), `ICETURRET_STATIC_KILL=1`, unbounded | REFUSED, 490 forks, "no side of iceturret@472,400 gives a hitless kill — up: … {approach-hit:iceturret 98, circle:other 392} … left/right/down: no plannable staging point outside the range" |
| the same at 640 | budget cut after 46 tries |
| + the edge bait on each of its tries (`HOOK_EB_ISK`), unbounded and at 640 | **unchanged**: 490 forks `{approach-hit:iceturret 89, circle:other 392, approach-hit:blast 9}`; budget cut at 640 |
| leg 853's staging, exit goal, ISK: base / + bait | REFUSED 490 forks / REFUSED 490 forks (the same) |
| ISK's kill handed to APPROACH with the edge bait FIRST (`HOOK_ISK_APPROACH=first`) | **A1 SOLVED at 640: 1404 t, dashless work 329, fresh 0 hits, into L41**; 853 exit goal SOLVED 1404, 16 forks |
| the same hand-off WITHOUT the bait | REFUSED, 504 forks (APPROACH's own words) |
| ISK's own tries, then APPROACH + bait (`after`), unbounded | SOLVED (1404 / 1384), work 13413: no use at 640 |
| ISK ON **and** `KEYLOCK_TURRET_ARRIVAL` ON, A1 at 640 | **budget cut**: ISK takes the turret inside the walk's ladder first, spends 300 ticks and its forks, and the arrival arm's no-tick guard never fires |

Why the bait does not help ISK: its only side with a staging point is `up`. Its stance is south of the turret's body,
and its single corridor dog-legs into the snapped body at (470.4,443.5) at every delay. APPROACH stages once and
tries every side and its via routes from there. Its hitless try is `right via (467,446)`, a route ISK does not have.

## 4. Design and change; OFF identity

All in `solverBot.js` plus one name in `solverEnvChannel.js`. There is one call site and one switch block, plus small
opt-in hunks in `approachKillForCorpse` and `approachTriesByVolley`. Nothing is reformatted or renamed.

- **The switch block** (after `resetKeylockTurretArrivalCounts`): `KEYLOCK_TURRET_EDGE_BAIT`, `_DEFAULT = false`,
  `withKeylockTurretEdgeBait`. No new counter: the existing `TURRET_APPROACH_COUNTS.approaches` row carries
  `bait: true|false` in this mode.
- **The call site** (`keylockTurretFirst`): `turretFirst.edgeBait ? {edgeBait: true} : (KEYLOCK_TURRET_EDGE_BAIT.enabled ?
  {edgeBait: 'also'} : {})`. The arrival arm's own edge-only bait (`edgeBait: true`) has precedence and is not moved.
- **`approachKillForCorpse`, `edgeBait: 'also'`**: the edge point is KT-ARRIVAL's `approachEdgePoint`, unchanged.
  `baitFamilies = [false, true]` when it is plannable, else null (the tries are OFF's). Each try's bait is
  `baitFamilies === null ? edge !== null : extra.bait === true`. Without families this is exactly the old
  `edge !== null`, so OFF's tries and the arrival arm's are unchanged.
- **The order.** In the volley order (default ON), `approachTriesByVolley` gets `families`. Every route appears once
  per family, and at each rank OFF's family is asked first, then the edge family. A twin reuses its route's anchor
  (probed from the staging point; probing after the edge stop measured worse, §3.1), so the bait adds no anchor fork.
  With the volley order OFF, OFF's whole order runs first, then the edge family's.
- Why this shape: a case OFF solves at rank r is solved by the same try, because OFF's family precedes at every rank
  (854 at t0: 8 forks, plan and work identical). A door-open case is solved at the edge family's rank 0, after OFF's
  rank-0 tries (29–32 forks).
- No level id, coordinate or Seedling constant in the logic.
- Not edited: `contactFidelity.js`, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `flashPanel/*`, rules, AS3, wasm,
  gitlinks, `killIceTurretOnWalk`.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` =
`391322d681b7aa0229d94b3f6906d024` at the base (before any edit) and at the head after the code commit
(`gates/acceptance-md5.txt`).

## 5. Rows and bounded vitest runs

| file | row | asserts |
|---|---|---|
| `hammerKeylockTurretEdgeBait.test.js` (fast, ~6 s) | ships OFF | `_DEFAULT` false; `enabled` follows the env; the env channel lists it; the wrapper toggles and restores |
| | the source | one `KEYLOCK_TURRET_EDGE_BAIT.enabled` read; one `{ edgeBait: 'also' }`; the call site's shape; `baitFamilies` only for `'also'`; the per-try bait falls back to `edge !== null`; `twins` only under `ctx.families`; the volley-OFF edge loop only under `baitFamilies` |
| | leg 854 staging, clear-tag after a 100-tick idle | ON: solved, fresh run hits [] / deaths 0 / lock open / turret dead; the single approach row is `{right, wait 0, volley, rank 0, bait: true}` |
| `hammerKeylockTurretEdgeBait.train.test.js` (train, 43 s) | legs 853 and 854, idle 100, worker budget 640 | OFF: dashless pass `{ok:false, deadline:'crusher-fork', limit:'budget'}`. ON: dashless `{ok:true, modelHits {0,0}}`; fresh run hitless, deathless, lock open, turret dead |
| | the door-shut control (854 at t0, 640) | ON's solution deep-equals OFF's; work equal |
| `hammerKeylockTurretEdgeBaitRows.js` | (support) | `solveL40Lock(staging, {idle, budget})` |

**Mutants** (each applied to the file, the rows run, the file restored by copy and md5-checked):
- M1, the guard forced off: the source row and the leg-854 row are red.
- M2, the families reversed (`[true, false]`): the source row is red, and the train control row is red (ON's plan ≠ OFF's).
- M3, a try's bait `!== false` instead of `=== true`: green. This is an equivalent mutant, because both
  families always pass an explicit `bait`.

**Bounded vitest by path** (⚖ 52). `gates/bounded-files.txt` lists the 87 fast files naming `approachKillForCorpse`,
`keylockTurret`, `KEYLOCK_TURRET`, `iceturret@472,400`, `bosslock@480,352`, `solverEnvChannel`, `TURRET_APPROACH` or
`approachTriesByVolley`.
- **OFF: 87 files, 1073/1073.**
- **`SEEDLING_KEYLOCK_TURRET_EDGE_BAIT=1`: 1072/1073.** The one red is `hammerKeylockTurret.test.js`'s door-shut pin
  (leg 854 without tag 12). It still refuses at the same staging point (488,579) with the same `no-plan` reason, but
  with **36 forks `{"no-plan":24}`** where OFF has 24 `{"no-plan":12}`: the 12 edge twins also find no corridor
  behind the latched door. The verdict is the same and the refusal is costlier. A flip re-records that pin.
- New train file: 3/3 locally (`--config vitest.train.config.js`, by path).

**Regenerated / checked:**
- `census-seedling-solver-surface --check` GREEN at 374 rows (no `--write` needed).
- `census-seedling-constants --check` PASS.
- `generate-procgen-reference` → `check-procgen-reference` ALL CHECKS PASSED (no diff).
- `generate-docs-index` and `--check` OK (no diff).
- No doc under `docs/json/developer/procgen/` was edited, so no procgenDocs pins are owed.

**Not done:** the dispatched train-tier run (`unittests_frontend.yml -f train_only=true`). This session has no
GitHub Actions dispatch; that run is the planner's (§9).

## 6. Page play / game witness

`probe-seedling-divergence-sweep --page=seedling_bot_ap_p4g --mode=inv` ran on fresh pages, with `serve-nocache.py` on
:8000 started and stopped by this session. It ran the only two sweep legs that reach the code, by key, both ways
(`--solver-env=SEEDLING_KEYLOCK_TURRET_EDGE_BAIT=1`):

| leg (key) | OFF | ON |
|---|---|---|
| `level_40__r23c29 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 8: bosslock@480,352 cleared` | `done`: 718 t after the room's 2560 retry, roomHits max 0, no divergence, 0 recoveries | `done`: the same 718 t (solve 18.4 s vs 12.0 s), roomHits max 0 |
| `level_40__r23c29 <- in_L43_176_464 ~> level_40__r26c13 -> location:L40 flag 8: bosslock@480,352 cleared` | `done`: 559 t (full pass), roomHits max 0, end = expected | `done`: the same 559 t, roomHits max 0 |

**No game witness of the newly solved plans.** Those plans exist only when the kill starts after the door below the
turret has opened. The sweep asks its goal at arrival (t0), where the door is still shut, so no page leg plays them.
The whole-game walk's own L40 arrival (A1 29:11) takes the arrival arm, which this switch does not move (§7). Their
witness is the fresh-run replay in the JS runtime: hitless and deathless in every case of §2. A p4g recording needs a
staged arrival after the door opens, which the sweep cannot express.

## 7. Census: which seed-1 divergence-sweep legs the change can move

- **Reach.** The changed code runs only when `keylockTurretFirst` gets a `turretFirst` without a bait of its own, which
  means from `keylockTurretStance`. That requires a keylock all of whose stance cells are removed by a **live ice
  turret's** disc, and an edge point that is plannable floor.
  - Only L40 and L98 have an ice turret, and only L40 has a boss lock (`bosslock@480,352`).
  - The arrival arm (`KEYLOCK_TURRET_ARRIVAL`) passes its own bait and is not moved: A1 29:11 with both switches = with
    `KEYLOCK_TURRET_ARRIVAL` alone (1404 t, work 345, fresh 0 hits).
  - `KEYLOCK_TURRET_EDGE_BAIT` alone leaves A1's refusal as it is (work 74).
- **The sweep legs** (915 at this base; L40 has 50 legs and L98 has 6, keys from `seedling-divergence-legs.mjs`):
  - **853 and 854 reach the code** (`level_40__r23c29 <- in_L39_144_0 / in_L43_176_464 ~> level_40__r26c13 -> location:L40 flag 8: bosslock@480,352 cleared`).
    Their clear-tag keylock has 0 cells, and their kill starts at t0 with the door shut. Both are `done` on p4g ON and
    OFF with the same ticks (§6). In node, 854's plan is key-for-key OFF's, and 853's unbounded plan is the same at a
    higher fork count (130 vs 70).
  - The other 48 L40 legs do not reach it:
    - the north arrivals' legs (359–364, 847–852): the key line is behind the lock;
    - the south arrivals' exit and location legs (365–396, 855–858): their goals are south or east of the lock, and no
      keylock stance is derived under the turret.
  - L98's 6 legs (726–731): no lock.
- **So no sweep leg is expected to change verdict**, and the two that run the code measured the same.
- **Survey:** all eight L40/L98 steps (`--through=end --only=66,96,134,136,149,166,173,227`) are identical row for
  row, ON vs OFF (ms dropped), with `KEYLOCK_TURRET_ARRIVAL` OFF and with it ON. Step 134 is REFUSED both ways with the
  arrival arm OFF, and SOLVED 1384 t both ways with it ON. No step gains a hit.
- I did not run the node bare pass (`seedling-divergence-bare.mjs`) over the L40/L98 keys. It solves with **no
  inventory**, so the kill verb (Sword / Ghost Sword) can never run there. The node evidence for the reaching legs is
  their stagings (`legA.mjs` / `leg.mjs`, §3.1 and `m4/`).

## 8. What the brief got wrong (measured)

- *"offer the turret edge bait … to the walker's general turret kill"*: the bait alone does not turn that refusal
  (490 forks before and after, §3.2). ISK's tries meet the turret's body on its one corridor; that is geometry, which
  no stop timing fixes. What solves A1 is handing ISK's kill to APPROACH's search with the bait. That is a re-route of
  the ICEST arm, not an offer of the bait, so per the brief's own condition it is not wired here (§9).
- *"offer `edgeBait` … (one new switch, or extend `KEYLOCK_TURRET_ARRIVAL`'s reach)"*: neither shape KT-ARRIVAL used
  works here unchanged. Edge-first loses leg 854's t0 solve under the worker's budget (§3.1). The bait has to be a
  second family of tries. A new switch was needed, because extending KT-ARRIVAL's switch would have moved legs it does
  not move today.
- *"`TURRET_APPROACH_VOLLEY_ORDER`'s anchor is probed from the staging point, not from the edge"* (unmeasured): now
  measured. Probing from the edge is worse in every case: 16 → 371 forks (853 idle 100) and 10 → 388 (854 idle 100).
  The stage-probed anchor stays.
- *"legs 853/854 … Delayed 100+ ticks (door open), it refuses"*: confirmed (504 / 600 forks unbounded; out of budget at
  640).
- *"A1 29:11 / leg 395 with `ICETURRET_STATIC_KILL=1`"*: confirmed (490 forks). Leg ids: KEYLOCK-TURRET's 395/412 are
  853/854 at this base, as KT-ARRIVAL noted.

## 9. Residue / hand-overs

- **Train-tier dispatch (planner):** `unittests_frontend.yml -f train_only=true` at the head. The new train file is
  3/3 locally.
- **A flip of `KEYLOCK_TURRET_EDGE_BAIT`** owes a re-record of `hammerKeylockTurret.test.js`'s door-shut pin. That pin
  stays a refusal, at 36 forks `{"no-plan":24}`.
- **ICEST (`ICETURRET_STATIC_KILL`), if the planner wants that arm ON:** the measured fix is to hand its kill to
  `approachKillForCorpse` with the bait, **before** its own tries. Handing it over after them needs 13 k work units and
  is useless at 640. Measured with a hook (A1 at 640: dashless work 329, 1404 t, fresh 0 hits; leg 853 exit goal: 16
  forks). That changes which kill ICEST runs, not only its timing, so it is a new slice with its own switch.
  - Watch the interaction: ISK ON together with `KEYLOCK_TURRET_ARRIVAL` ON runs A1 **out of budget**. ISK takes the
    turret inside the walk's ladder and spends ticks, so the arrival arm's no-tick guard declines.
- **Cost of the families:** a case that already solves pays the edge twins' forks only at the ranks before its own.
  853 at t0, unbounded, goes from 70 to 130 forks; the page's 853 solve went from 12.0 s to 18.4 s with the same plan.
- **No game recording** of the newly solved door-open plans (§6). Their only witness is the JS fresh run.
- Not committed: the temporary hooks (`evidence/tools/temporary-hooks.diff` is the record, and they were never in the
  source), the survey's full JSON (rows without `traceRows`/`replay` are under `evidence/survey/`), and the scratch
  `legs.jsonl` (`seedling-divergence-legs.mjs --out=` regenerates it).
