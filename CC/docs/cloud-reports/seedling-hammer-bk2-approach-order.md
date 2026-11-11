# Seedling hammer-phase BK2-APPROACH-ORDER — Boss Key 2 from L39 inside the solver budget (`TURRET_APPROACH_VOLLEY_ORDER`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-bk2-approach-order` (planner `seedling-hammer-phase-planning-4`), cloud. ⚖ the user ruled on 2026-11-09: *"Land without; slice next (Recommended)"* |
| Start SHA | `1f8fc08ec34c23a8d0b438e1fa02700d953d7d72` (`origin/hammer-harvest-l40-flip` = main `debb711234` + the L40 flip), as the brief's **Base** names. Main was not merged |
| Head | this report is the last commit. Steps: W0 `2b9bd93b`, M `fce4ede0`, I `fb931092`, D `0b163182` (the last code head) |
| Branch | `claude/seedling-bk2-approach-order-p4dy8a` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-bk2-approach-order-evidence/` (`w0/`, `m/`, `d/`, `tools/`). The captured page requests (10.6 MB) are not committed; three of them, cut to level 40, are the test fixtures |
| Scope messages | none arrived |
| Environment | bootstrap `--seedling` READY; submodules `shared`, `bulletml-dodge`, `flashPanel/wasm`, `vendor/seedling` initialised (the five others are not on any gate's path here and were left as `-`); node v22.23.4; 4 cores; the p4g page on :8000 (`serve-nocache.py`). ⚠ `pip headless: FAILED` in the bootstrap log; no gate here asked for it |

**Method.** Page arms = `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1
--page=seedling_bot_ap_p4g --capture-requests` on a `--carry-route-flags` leg list (the switch through `--solver-env`).
Node = the captured requests: L40-CENSUS's `chain.mjs` (every pass on one work clock, the budget lifted, 30(c) on a fresh
run) and `replay-seedling-solve-request.mjs --seam-time-sweep` (the page's own `solveAnytime`, 640/2,560). CI could not be
fetched for artifacts, so the planner's run 42753668423 was not used: the requests were re-captured here (§3).

⚠ **Leg ids.** On this head's leg list Boss Key 2 ← L39 is leg **873** and ← L43 is **874** (869/870 in L40-FLIP-BUILD's
list); flag 8 ← L39 / ← L43 are 398 / 415. The KEYS are the stable names and are used in §7.

## 2. The answer first

**The one thing to know first: the wait the approach is looking for is read off the turret's own clock, and the switch
changes the order of the tries, not the tries. Boss Key 2 ← L39 solves at 1,382 units (was 3,236), with the same plan key
for key, and is `done` on the page. Where two hitless tries exist the other one can be met first: Boss Key 2 ← L43 and
flag 8 ← L43 get a different hitless plan.**

| question | answer (measured) |
|---|---|
| Can the approach find its winning try early, by an order derived from the room? | **Yes.** Each route's ANCHOR is the number of ticks a stand at its first waypoint takes until the turret's `anim` turns to "startshot" (one probe fork a route). The route's waits run from the anchor outward, and the routes are asked rank by rank (every route's k-th wait before any route's (k+1)-th) |
| BK2 ← L39 inside 2,560, hitless, certified, on the page? | **Yes.** Node, the page's held-retry request: **3,236 → 1,382** units; the hitless try moves from the 276th fork to the 70th (12 probes + 58 tries: anchor 32, rank 5, wait 29); plan digest equal to OFF's uncapped plan; hitless on a fresh run. 25/25 arrival clocks (±12) solve inside 2,560 (OFF 0/25). **Page:** `done`, 4,491 ticks, solve 33 s, no hit, no divergence |
| Is the derived value 29–31 on L40? | **No, and it does not need to be.** The anchors are 32 (← L39), 35 (← L43), 31 (the latch boot), 33 (south of the door). The hitless wait is 0–3 ticks BEFORE the anchor: it is AT the anchor on two of the four, at rank 1 on one and at rank 5 on BK2 ← L39 |
| What does the order change elsewhere? | Six solves reach the approach. Same plan: BK2 ← L39, flag 8 ← L39 (2,534 → 680 units). Different plan, same verdict (hitless): BK2 ← L43 (1,021 → 835), flag 8 ← L43 (323 → 132), the latch boot (376 → 20 forks). Same refusal: the latch boot south of the door. **No verdict changes, no solve lost.** Everything that does not reach the approach is byte-identical |
| OFF | byte-identical to the base: units by site and plan digests equal on three approach solves run on a base worktree; the acceptance batch md5 equal |

**Before → after (BK2 ← L39):** the page's solve refuses on its held retry (640, then 2,560 units; 3,236 needed) →
**1,382 units, solved in the held retry, played to the key with no hit.** ⚠ It still needs the held retry (1,382 > 640).

## 3. W0 — the problem re-measured, and the approach's tries censused

### 3.1 The page at the base (`w0/page-base-rows.jsonl`; defaults = the flip ON, door carried, 90 s legs)

| leg (key, short) | end | what |
|---|---|---|
| BK2 ← L39 (873) | **failed** | *"the solver ran out of 640, then 2560 work units on its held retry"* (dashless: `crusher-fork`, `budget`) |
| BK2 ← L43 (874) | timeout | solved (`shove, walk, weigh`), cut by the 90 s clock mid-play |
| flag 12 ← L39 / ← L43 (875, 876) | timeout ×2 | solved, cut mid-play (875 after one interrupted plan) |
| Chest ← L39 (397) | done | `bait, kill`, 1,310 t |
| Chest ← L43 (414) | failed | both budgets spent (not this slice's; its uncapped refusal is the combat ladder at `spinner@816,848`) |
| flag 8 ← L39 / ← L43 (398, 415) | done ×2 | `keylock, walk`, 718 t / 748 t. 398 solved on its held retry |
| Totem 64,144 ← L41 (374) | failed | the combat ladder EXHAUSTED at `puncher@816,128` (not this slice's) |
| flag 1 ← L41 (375), Totem ← L42 (379), flag 1 ← L42 (380) | done ×3 | none reaches the approach |

With a 420 s leg budget (`m/page-off-420s-rows.jsonl`): BK2 ← L39 **failed** on the budget again (64 s); BK2 ← L43
**done** (4,306 ticks).

### 3.2 The 3,236 units, reproduced (`w0/census-off.txt`)

`chain.mjs` on the captured held-retry request for BK2 ← L39: **SOLVED 4,491 ticks, hitless on a fresh run, 3,236 work
units** (dashless 3,235 + the full pass's 1): `crusher-fork` 2,484, `block-route` 472, `walk` 278, `stance-hypothesis` 2.
`TURRET_APPROACH_COUNTS`: `{side: 'right', via: null, wait: 29, forks: 276}`, the report's numbers exactly. Both captured
requests of the leg (640 and 2,560) carry the same staging and give the same answer.

### 3.3 The census: every solve that reaches `approachKillForCorpse`

| solve | OFF verdict | units | winning try (side, route, wait) | fork # |
|---|---|---|---|---|
| BK2 ← L39 (873) | solved 4,491 t, hitless | 3,236 | right, corridor, 29 | 276 |
| BK2 ← L43 (874) | solved 4,519 t (dashless), hitless | 1,021 | up, via (466,445), 25 | 27 |
| **flag 8 ← L39 (398)** | solved 718 t, hitless | **2,534** | right, corridor, 29 | 276 |
| **flag 8 ← L43 (415)** | solved 748 t, hitless | 323 | up, via (466,445), 25 | 27 |
| the latch boot (`l40latch-witness/latch-boot.json`, the flip's defaults; CPAIR size 2 and 3 alike) | solved 4,142 t, hitless | (376 forks) | right, corridor, 30 | 376 |
| the latch boot at (488,579), south of the door | refused later (the collect stance's ladder) | (80 forks) | up, via (466,445), 29 | 80 |

Not reaching it (their ON is byte-identical, measured): Chest ← L39 / ← L43, flag 12 ← L39 / ← L43, Totem 64,144 ← L41,
flag 1 ← L41, Totem ← L42, flag 1 ← L42, ICEST's pocket boot (480,456). No generated room in the test fixtures reaches the
approach: it is asked only under `latchWeighFirst`'s corpse weigh and the keylock's turret, and the fast rows that build a
generated turret room (`hammerTurretApproach.test.js`, `hammerKeylockTurret.test.js`) record nothing approached.

### 3.4 Where the tries go (`w0/latch-tries-by-route.txt`, `w0/south-volley-probe.jsonl`)

On the latch boot the 376 tries are: the push side's corridor (1: the turret's body, pruned), its two vias (49 + 49), the
left side's three routes (49 each), the bottom side (1 + 49 + 49), then the right side's corridor (31, the win at wait 30).
Every 49-wait route fails at every wait; so the cost is the SIDE order far more than the wait.

Inside one route the outcome is periodic in the wait. Standing at the first waypoint (the probe, south of the door: arrival
at tick 1905): a volley is in flight for ticks 0–8, none for 9–35, the next spawns at tick 36 (its "startshot" begins at
33, the anchor). On the push side's near via, most walks that leave at wait 5–26 are met by that volley (hits at
t1951–1954), at 27–28 the walk reaches the stance and a later volley lands during the kill (t2034), and at **29** it is
hitless; on the neighbouring via, waits 31–32 are met on the approach by the volley after (t1993). The hitless window is
1–3 ticks wide and sits just before the next "startshot".

## 4. M — the candidate orders (`m/orders-table.txt`, scratch arms `tools/scratch-orders.patch`)

Units are the whole solve's work units (page requests) or the approach's forks (latch boots, whose solve has no work clock).
⚠ "window" and "right first" are the L40-FLIP-BUILD report's two: both hard-code an L40 answer and were measured only.

| order | BK2 ← L39 | BK2 ← L43 | latch boot | south of the door |
|---|---|---|---|---|
| OFF (sides × routes × waits 0…48) | 3,236 · same | 1,021 · up via w25 | 376 f · w30 | 80 f |
| **anchor outward, rank by rank (built)** | **1,382** · same plan | 835 · right corr w35, another plan (4,527 t) | 20 f · w31 (4,144 t) | 26 f |
| anchor outward, route by route | 3,083 · same | 941 · up via w27 (4,521 t) | 356 f · w31 | 55 f |
| rank by rank, no anchor (ascending) | 3,434 · same | **3,281** · same as OFF | 310 f · w30 | 229 f |
| anchor descending then ascending, rank by rank | 1,202 · same | 835 · as built | 20 f · as built | 26 f |
| waits from 30 outward, route by route (hard-coded) | 2,984 · same | 861 · up via w27 | 346 f · w30 | 51 f |
| the right side first (hard-coded) | 1,022 · same | 1,105 · right corr w34 | 31 f · w30 | 30 f |

Every arm solves what OFF solves, hitless on a fresh run, and refuses what OFF refuses (same later wall). Only two orders
bring BK2 ← L39 under 2,560 with margin: the built one and "right first"; "waits from 30" does not (2,984), because
the winning route is the seventh of twelve. The anchor needs the ranks, and the ranks need the anchor (3,434 without).
"Descending" is 180 units cheaper on BK2 ← L39 and equal elsewhere; "outward" was built because it does not assume the
window lies before the anchor.

## 5. I — the build

### 5.1 The switch and what the order is derived from

`TURRET_APPROACH_VOLLEY_ORDER` (`solverBot.js`; OFF; `SEEDLING_TURRET_APPROACH_VOLLEY_ORDER=1`;
`withTurretApproachVolleyOrder(enabled, fn)`; its name in `solverEnvChannel.SOLVER_ENV_NAMES`). Asked only inside
`approachKillForCorpse`, so only under `TURRET_APPROACH`.

- **The anchor** (`approachVolleyAnchor`): on a fork, the route's own walk to its first waypoint, then a stand there until
  the turret's `anim` (`run.turretDamage`, the shooter's own clock) turns to "startshot". The ticks stood are the wait
  whose walk leaves the waypoint as the next volley is committed. null (the route keeps OFF's ascending order) when the
  route has no corridor, the walk or the stand is hit or crosses a door, or no startshot begins inside
  `TURRET_APPROACH_WAIT_MAX` ticks. Nothing in it names a level, a side or a number of ticks.
- **The wait order** (`approachWaitOrder`, exported): 0…48 sorted by distance from the anchor, the earlier of a pair first.
- **The ranks** (`approachTriesByVolley`): the routes in OFF's order (sides, then corridor and vias); rank k asks each live
  route's k-th wait. A route is probed when first reached. A route `attempt` reports done leaves the ranks.
- **The try** is OFF's code: the loop body became `attempt(side, via, w, extra)`, each `continue route` a
  `TRY_ROUTE_DONE` return, each `continue` a `null` return. OFF loops over it as before. ON the count row and the record
  gain `order: 'volley'`, `anchor`, `rank`.

**Lines touched in `solverBot.js`** (at `0b163182`): `approachKillForCorpse` 12572–12702 (`routesOf`, `attempt`, the
ON/OFF branch); the three new functions 12711–12772; the switch 16866–16884. Nothing else in the file.
`solverEnvChannel.js`: the one name (lines 91–93 rewrapped).

### 5.2 Rows

`hammerApproachOrder.test.js` (4, fast): ships OFF and the env alone turns it on, the name in the channel; no anchor =
ascending; an anchor = the anchor first, outward, every wait once; an anchor on the range's edge.

`hammerApproachOrder.train.test.js` (7; 436 s on this box; the page's own requests,
`fixtures/hammer-bk2-approach-order/`, the page's `solveAnytime` at the captured 2,560):

| row | pinned |
|---|---|
| BK2 ← L39 OFF | refused; the dashless pass `deadline: 'crusher-fork'`, `limit: 'budget'`, 2,561 units |
| BK2 ← L39 OFF, budget lifted | solved 4,491 t, 3,235 units (dashless); try 276: right, corridor, wait 29 |
| BK2 ← L39 **ON** | solved inside the budget: dashless 1,381 units, 4,491 t, `shove, walk, weigh`; try 70, anchor 32, rank 5; the digest of OFF's uncapped plan; 0 hits, 0 deaths, the turret killed, every expected row met on a fresh run |
| BK2 ← L43 OFF | dashless 4,519 t, 1,020 units; up via (466,445) wait 25, try 27; the plan played is the full pass's 4,306 t; hitless |
| BK2 ← L43 ON | dashless 4,527 t, 834 units; right corridor wait 35, anchor 35, rank 0, fork 8; played 4,308 t; hitless |
| flag 8 ← L39 OFF | 718 t, 2,533 units (26 inside the budget); try 276 |
| flag 8 ← L39 ON | 718 t, 679 units; try 70; OFF's digest; hitless; `40:8` earned |

### 5.3 Mutants (`m/mutants/`, `tools/mutants.py`; each applied to the working file, then restored)

| mutant | fast rows | train `ON:` rows |
|---|---|---|
| M1 the wait order reverted (ascending whatever the anchor) | **2 fail** | **2 fail** (BK2 ← L39 ON, BK2 ← L43 ON) |
| M2 the ranks reverted (a route's every wait before the next route) | pass | **2 fail** |
| M3 the anchor never read off the turret's clock | pass | **2 fail** |
| M4 the switch not read (OFF's loop under ON) | pass | **2 fail** |

### 5.4 The ON radius, by mover class

| class | solves |
|---|---|
| same plan, fewer units | BK2 ← L39 (3,236 → 1,382; **refused → solved at the page's budget**), flag 8 ← L39 (2,534 → 680) |
| different plan, same verdict | BK2 ← L43 (dashless 4,519 → 4,527 t; played 4,306 → 4,308 t; 1,021 → 835 units), flag 8 ← L43 (748 → 740 t; 323 → 132), the latch boot (4,142 → 4,144 t; 376 → 20 forks). All hitless on a fresh run |
| same refusal, fewer forks | the latch boot south of the door (80 → 26; the approach itself waits 32 where OFF waits 29) |
| verdict change | **none** |
| identical (do not reach the approach) | the eight other captured L40 legs, ICEST's pocket boot |

Arrival clocks (`m/seam-*.txt`, ±12 around the captured clock, 640/2,560): BK2 ← L39 OFF **0/25**, ON **25/25**;
BK2 ← L43 OFF 25/25 (2,502 units over both passes), ON 25/25 (1,706). One distinct answer per arm: the approach does not
vary with the arrival clock.

Page, ON through the env channel (`m/page-on-420s-rows.jsonl`): BK2 ← L39 **done** (4,491 t, 229 s the leg); BK2 ← L43
**done** (4,308 t, 205 s). No room hit, no divergence in either.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest, fast: `hammerApproachOrder`, `hammerApproach`, `hammerTurretApproach`, `hammerLatchWeigh`, `hammerSouthDoor`, `hammerKeylockTurret`, `solverEnvChannel`, `strategySwitch` (`.test.js`) | 8/8 files green |
| `contentIdentity`, `entityBlocks`, `boxLockCommit`, `boxLock`, `trainShardPlan` (fixtures and a costs row added) | 94/94 and 21/21 |
| train files, local, by path (`npx vitest run --config vitest.train.config.js <file>`) | **6/6 files green**: `hammerApproachOrder` 7/7 (436 s), `hammerTurretApproach` 3/3, `hammerSouthDoor` 4/4, `hammerLatchWeigh` 2/2, `hammerPocketBurn` 4/4, `hammerKeylockTurret` 1/1 (the five that reach `approachKillForCorpse` or the keylock's turret; all at the defaults, the switch OFF). The other train files were not run here: the planner dispatches the tier |
| `ci-producer-checks` at the defaults | **0 red** / 98 run (1 skipped by name) |
| `ci-producer-checks` with `SEEDLING_TURRET_APPROACH_VOLLEY_ORDER=1` | **0 red** / 98 run |
| `census-seedling-solver-surface --check` | GREEN, 371 rows match a fresh census (no `--write` needed) |
| `census-seedling-constants --check` | PASS (0 new, 20 moved) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README + docsIndex word counts) → ALL CHECKS PASSED |
| `scripts/quicklaunch/generate-docs-index.mjs --check` | OK, current |
| `batch-seedling-acceptance.mjs \| md5sum` | `abb206c88de25e7ba1874510d493ce85` at the base (a worktree of `1f8fc08e`), at this head, and at this head with the switch ON |
| OFF = the base, on the approach itself (`d/base-1f8fc08e-arms.jsonl`) | BK2 ← L39, BK2 ← L43, flag 8 ← L39 on a base worktree: units by site and plan digests equal to this head's OFF |
| CI JSUT | run **42864561424** at `0b163182` (the last code head; `ci-summary.mjs --run=`): **success** — suite 26,337 passed, 0 skipped, 0 failed; **slow battery 431/431 passed**. The run at `fb931092` (42862209700) was cancelled by the next push. The train tier does not run on a slice push |

⚠ `ci-producer-checks` ran with `--jobs=3` here (the box was shared with the sweeps), not 4.
⚠ Not run: `identity-block.sh`, `check-seedling-wasm-ship` (no generated module, wasm or pin is touched).

## 7. What the harvest A/B should expect, and the exact ON dispatch

- **OFF (the branch's defaults): no movers.** The switch is OFF by default and the OFF loop runs the same tries in the same
  order (§6's two identity rows).
- **ON arm, the four legs the switch can move** — `seedling-divergence-sweep.yml` at this branch's head:
  - `keys`: `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2|level_40__r32c36 <- in_L43_176_464 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2|level_40__r23c29 <- in_L39_144_0 -> location:L40 flag 8: bosslock@480,352 cleared|level_40__r23c29 <- in_L43_176_464 -> location:L40 flag 8: bosslock@480,352 cleared`
  - `solver_env`: `SEEDLING_TURRET_APPROACH_VOLLEY_ORDER=1`
  - `carry_route_flags`: `true`
  - `leg_budget_ms`: `480000` (the 4,491-tick plan took 229 s of leg on a 4-core box; at 180 s it is cut clean at t3313)
  - `capture_requests`: `true`
  - The OFF control is the same dispatch with `solver_env` empty.
- **Expect, ON:** BK2 ← L39 `done` (`shove, walk, weigh`, 4,491 t; OFF: `failed` on the budget). BK2 ← L43 `done`
  (4,308 t; OFF 4,306 t). Flag 8 ← L39 `done` (`keylock, walk`, 718 t, the same plan). Flag 8 ← L43 `done` (740 t; OFF
  748 t). No room hit, no divergence.
- **The full sweep ON vs OFF** (`keys` empty, the same `solver_env`): the movers should be those four keys and nothing
  else. Any other mover is a leg that reaches the approach and was not captured here; its row is the measurement.
- **Train tier** (the planner's dispatch): `hammerApproachOrder.train.test.js` is new (its costs row is this box's 436 s,
  marked `measuredFrom.local`; replace it with the train job's line).

## 8. What the brief got wrong (measured)

- *"Then measure that the derived value is 29–31 on L40."* The derived anchor is 31–35 (32 on BK2 ← L39). The hitless wait
  sits 0–3 ticks before the startshot the anchor marks, so the outward order meets it within six tries of a route.
- *"The 276th try becomes one of the first ~30"* by the wait order alone: it does not. Waits from the window, route by
  route, leave BK2 ← L39 at 2,984–3,083 units: the cost is the six routes asked before the right side's corridor, 49 waits
  each. The ranks are what bring it to the 70th fork.
- *"All L40 legs … Boss Key 2"* as the population: flag 8 (`bosslock@480,352`) from both arrivals asks the same
  approach, and flag 8 ← L39 was 26 units from the same refusal at the base (2,534 of 2,560).
- *"Captured page requests … run 42753668423"*: not fetchable from the cloud box; re-captured on the p4g page here.
- The leg ids moved (869/870 → 873/874 on this head's list).

## 9. Residue and hand-overs

1. **The preference cost, stated.** Rank by rank costs more than OFF in a room whose only hitless try is on an early route
   and far from that route's anchor (about one try a live route for each rank of distance). The bound is OFF's whole set
   plus one probe a route. No measured solve is such a room; the full sweep's ON arm is the wider measurement (§7).
2. **BK2 ← L39 still needs the held retry** (1,382 > 640), and flag 8 ← L39 too (680 > 640).
3. **The harness clock.** A 4,300–4,500-tick plan does not finish inside a 90 s or a 180 s leg; the L40 legs need
   `leg_budget_ms` ≥ 300000 to be read as `done`.
4. **"Descending" is 180 units cheaper on BK2 ← L39** (1,202 vs 1,382) and equal on the rest. Not built: it assumes the
   window lies before the anchor, which is all four measured rooms and no more than that.
5. **Chest ← L43 (414) and Totem 64,144 ← L41 (374) fail at the base's defaults on this box** (`w0/page-base-rows.jsonl`).
   Not this slice's; named because L40-FLIP-BUILD's arm C had them `done` at other arrival clocks.
6. Follow-ups followed from the planner: none arrived.
