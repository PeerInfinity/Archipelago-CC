# Seedling fidelity L12KEYLINE — L12's sealed locks and the way round them

Wave 11 (model coverage), planner `seedling-fidelity-planning-5`. ⚖ The user (2026-10-05): *"The first priority is to
expand the model to include everything in the game."* Standard: the solver handles either state of a lock, knows which
state it is in, and never clears the save or re-enters the room.

| | |
|---|---|
| Start SHA | `99cdf5ce23` (main after wave 10 `d978c76322` + the rules arc's F3) |
| Head | the commit carrying this report, on top of `ac890d5` |
| Harness branch | `claude/seedling-l12-keylock-qke18o` |
| Commits | D2 `401cfad` · D1 `150a69a` · D3 records `ac890d5` · this report |
| Dev servers | `serve-nocache.py 9590` (this tree) and `9591` (a base worktree at `99cdf5ce23`, never pushed: W0) |
| Verdicts | **W0 PASS · D1 PASS (1 game witness) · D2 PASS for 134/175 · D2b STOPPED (154/185, hand-over) · D3 PASS** |

## The one thing to know first

**AP's way round the lock is real in the game, and the planner could already plan it.** From the (592,16) arrival, the
east shaft runs south past the lock row, `burnabletree@480,640` is the only door to the shore, and the row-48 water is
the only way west. With the tree hypothesised gone, `planWaypoints` plans the whole corridor at once. The gap was the
**frontier's choice of door**. It sorts the doors by distance to the aim and resolves only the first. The sealed
`bosslock@416,240` is nearer (≈415 px) than the tree (≈545 px), its derivation throws SEALED BEHIND ITSELF, and the
tree was never asked. Steps 134/175 now SOLVE (1269 t; game-witnessed).

**154/185 are a different room fact.** The brief's "equivalent for bosslock@112,192" premise does not hold.
`bosslock@112,192` is only the frontier's nearest name. The goal's real door is the stacked `bosslock@32,864` +
`magicallock@32,864`, opened from the SOUTH. The way to that south side passes a cliff gap that only the 8 px lattice
can see. That needs work in the WAND slice's region (handed over below).

## W0 (at `99cdf5ce23`, base worktree, port 9591)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9591 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`0d927f7161962ca3aa2fba0f548d9a54`** |
| six `--check`s | in the block | `405d9c4b` · `b76f6483` · `465a8b46` · `35456fbc` · `6cd35fe1` · `b064c264`, all exit 0 |
| reference | in the block | *"4 GENERATED MODULE(S)/REGION(S) DIFFER"*. This is an ENVIRONMENT artefact: the five non-Seedling submodules are not initialised by `--seedling`. With them initialised in this tree, only this slice's two instrument regions differed, and after `generate-procgen-reference` **ALL 7 MODULES AND 5 REGIONS MATCH** |
| surface / constants / entities / profile | the four `--check`s | **GREEN 234** · **PASS 5,488** · **PASS 528** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **266**, `51e1da091698b1d7033af06e39e53b51` |
| bounded vitest BEFORE | 54 files (below) | **2,322 / 2,322 green** |
| tapeRunner | `status\tfullName`, sorted, `\n`-joined | **589**, md5 **`73d9d6457056ce0d2ff757edb4d0892a`** |
| route survey (BEFORE) | CI 38075646127, fetched; reproduced locally for 134/154/175/185 | identical: 4 × KEYLOCK-SEALED (134/175 in 2.6 s; 154/185 in ~460 s) |

The 54 files are: the brief's list; the roster pins (`fixtures/tiers`, `rosterCategories`); `tapeRunner`; and every
`grep -a` hit for what this slice touches (`SEALED BEHIND|.sealed|keylock|identifyAndSelect|resolveObstacleStrategy|
also on the frontier|failed to apply|plan-seedling-stance-witness|surveyFamily`): `activators`, `blockRoute`,
`fidelityReturn`, `fidelityStance`, `procgenCountableClock`, `procgenNestedOpeners`, `procgenPostSword`,
`procgenWeigh`, `r5Chain`, `solverBot`, `wasmEquips`, `surveyFamily`, `walkMoves`. Plus `chest`, `fidelityBurn`,
`fidelityClearTag`, `fidelityFrontier3`, `fidelityProximity`.

## D1 — measured on the game (PASS)

**The room** (`run.world` at step 134's staging; one character per 16 px tile): the arrival pocket (columns 36–37,
rows 1–15) reaches the lock row (row 15, `LL` at columns 26–27). The east shaft goes on south (rows 16–37) to the
south-east area. Its only door south is `burnabletree@480,640` (tiles 30–31 × 40–41, `BurnableTree.hit` on `"Fire"`).
Below the tree, the shore (rows 42–47, columns 26–31) meets the row-48 water. The water is the only connection west to
x 216 (rows 48–49). From there a walk north reaches the west area and `teleporter@0,352` (L95). The shieldlock
`shieldlocknorm@288,704` also joins the two halves, but `ShieldLock.update` probes `collide("Player", x - 1, y)`, so it
opens only from its WEST side; from the east it is closed. That matches AP's chain exactly:
**r0c37 →[Fire]→ r42c29 →[Progressive Swim]→ r0c19**.

**The planner, asked directly** (`planWaypoints`, 16 px, the run's own bag):

| bag | (600,24) → (24,360) |
|---|---|
| as is | FAIL (different components) |
| tree burned | **PLANS**, 13 waypoints, one swim leg (456,744) → (216,776) |
| tree burned, `canSwim` false | FAIL |
| locks open | PLANS through the lock's cell |

**The game witness** `l12keyline-134-round` is the solver's own plan from the survey's staging
(`plan-seedling-l12keyline-witness.mjs`, `--check` byte-identical). It was recorded with `SEEDLING_PORT=9590
check-seedling-bot-differential --record --only=l12keyline-134-round` on p4f (headless) and gave **ALL CHECKS PASSED**:
`drownTimer` 0 ("never stood on water without canSwim"), `hits` 0, `save.time` 9896 = model, keys/items/slots equal.
Burned at t347, gone at t388, 184 ticks in water, into L95 at t1269. `bosslock@416,240` and `@432,240` never open. The
model reproduces the recording at **0 px** (`fidelityL12Keyline.test.js`, plus the tapeRunner differential pair).

| tape | obs | transitions | md5 tape / expectation |
|---|---|---|---|
| `l12keyline-134-round` | 1270 | 1 (→ L95) | `l12keyline-134-round.json` / `expectations/l12keyline-134-round.json` (committed `150a69a`) |

## D2 — the planner gap (PASS for 134/175)

**Cause.** `identifyAndSelect` floods the reachable component, collects the actionable entities on its edge, sorts
them (registered verb first, then distance to the aim), and resolves `actionable[0]` only. For 134/175 that is
`bosslock@416,240`. `deriveKeylockStance` throws SEALED BEHIND ITSELF (fidelity STANCE's correct, game-witnessed
refusal: SHUT state, flag {12,4}). The throw ended the goal. The tree (`burn`, registered) was third on the same
frontier and was never resolved.

**Change** (`solverBot.js`, `SEALED_LOCK_NEXT_ON_FRONTIER`, exported, **ON**):
- When the chosen door's resolver throws a `SolverRefusal` carrying `sealed.self`, `identifyAndSelect` registers a
  next-door question against that refusal (a closure-private `WeakMap`, `nextDoorAfter`) and re-throws.
- `walkTo`'s existing catch first asks FRONTIER3's 8 px retry, exactly as before. **Only if that also fails** does it ask
  the next-door question.
- `nextPastSealedLock` resolves the rest of the actionable frontier in its own order. A candidate that throws a
  refusal, returns nothing, or answers `held: false` ("not held", e.g. a burn without Fire) is passed over. The first
  that binds becomes the round's order. Its `rejected` list starts with *"keylock bosslock@416,240 (nearer the aim on the
  frontier) — SEALED BEHIND ITSELF: its key line (y=257) is on its far side from (600,24) and the save holds its flag
  {12,4} (the SHUT state), so from here it is a wall …"*, followed by the passed-over candidates.
- If nothing binds, the original SEALED refusal is re-thrown **unchanged**.

The solver still knows which state it is in (the SHUT flag is named in the order's row). It never clears the save and
never re-enters the room.

**No new `SolverRefusal.obstacle.kind`, no new staging/result field.** The JS arc has nothing to wire. A trace row's
`rejected[0]` carries the new text.

**Mutants** (predicted first; copy → edit → `fidelityL12Keyline` → restore; `solverBot.js` md5 `4e3d23c9…` before and
after, verified):

| mutant | predicted | measured |
|---|---|---|
| M1: `SEALED_LOCK_NEXT_ON_FRONTIER = false` | the switch row and the go-round row red; the no-Fire control green | **2 red, 2 green** ✓ |
| M2: accept a `held: false` answer as the next door | the no-Fire control red (the burn refusal becomes the order) | **1 red**: *"solverBot(l12keyline-134) reach-exit …"* instead of the SEALED text ✓ |

**A control re-pinned.** `fidelityStance.test.js`'s *"L12 twin locks (route step 135's arrival)"* staged
`ROUTE_ITEMS` (Fire + Swim). With the change, that staging goes round, so the row now stages the no-other-door case
(Fire dropped) and still asserts the same `sealed` shape. This is a control that assumed the old frontier, not a moved
tape.

## D2b — steps 154/185 (STOPPED: hand-over)

Measured on the model (not game evidence):
- **The goal's pocket.** `teleporter@32,848` sits in a pocket (player x 16–64, y 816–856) closed on all sides except
  the south. On the south side are `bosslock@32,864` (keyType 4, key line y 881, flag {12,12}) and `magicallock@32,864`
  (`MagicalLock.hit` from a `WandShot`, flag {12,7}), stacked on the same tile. A 1 px BFS of player positions
  (`collidesSolid`) from the chest pocket reaches (40,900), south of the locks, but not the pocket.
- **The cliff gap.** The way to that south side passes a cliffside-pixelmask gap: player x **202..214** at y 896, and
  194..214 at y 904. No 16 px node centre (x 200, 216) falls in it, so the tile A\* and `identifyAndSelect`'s flood put
  the south area in another component.
- **The fine retry never runs.** FRONTIER3's 8 px retry fires only when the frontier has NO verb. L12's frontier always
  has one (chest, shield lock, tree, locks), so four strategies are spent on doors that lead nowhere. After D2 the run
  goes further than before (chest → touch → burn → `keylock(bosslock@416,240)`, opened from its own side after the
  puncher) and stops at `MAX_STRATEGIES_PER_GOAL`.
- **With an 8 px lattice everywhere** (an env-gated experiment, file restored, md5 verified): the flood reaches the
  south side from the arrival at once and names `magicallock@32,864`. Its `kill` row *"could not be resolved against
  live state"*.

**Hand-over:**
1. **WAND slice:** a `MagicalLock` verb (`WandShot` → `hit(_t)`, `lockType <= _t`, its `Game.setPersistence(tag,
   false)`), on `magicallock@32,864`.
2. **The planner** (L12KEYLINE's next round, or FRONTIER's owner): the 8 px lattice for the frontier flood and the
   walks when the 16 px frontier's orders do not reach the aim. Today the gate is "no verb at all". This will move
   committed tapes, so it needs a flag and a mover list.
3. Then the existing `keylock` on `bosslock@32,864` from its own side (key 4 is held at 154/185).

No rules question: the game path exists (Swim + key 4 + Wand).

## D3 — census (PASS)

**The 11 later-L12 survey steps**: BEFORE is CI 38075646127, AFTER is this tree (`survey-seedling-route.mjs
--through=end --route=full --only=57,63,78,87,108,120,134,140,154,175,185 --timeout=1500`):

| step | before | after |
|---|---|---|
| 134 | REFUSED KEYLOCK-SEALED `{12,4}` | **SOLVED 1269 t** (burn, swim; 219 s, of which ~200 s is `planSwordDash`) |
| 175 | REFUSED KEYLOCK-SEALED `{12,4}` | **SOLVED 1269 t** |
| 154 | REFUSED KEYLOCK-SEALED `{12,11}` | REFUSED, text moved: *"applied 4 strategies for one goal [chest(chest@320,816), touch(shieldlocknorm@288,704), burn(burnabletree@480,640), keylock(bosslock@416,240)] …"* (family `unclassified`) |
| 185 | REFUSED KEYLOCK-SEALED `{12,11}` | REFUSED, the same move as 154 |
| 57, 63, 78, 87, 108, 120, 140 | — | verdict, ticks and the first 300 characters of the refusal **identical** |

Survey totals at 38075646127 were 157 / 61 (+2 rules). The predicted totals are **159 SOLVED / 59 REFUSED**. No other
step carries a SEALED refusal (D1 of the census: the only `KEYLOCK-SEALED` rows are these four).

**Dispatches for the planner:**
- `seedling-survey.yml` on `claude/seedling-l12-keylock-qke18o`: `through=end`, `route=full`,
  `only=57,63,78,87,108,120,134,140,154,175,185`, `base_run=38075646127`, `timeout=1500`. Confirms the table above.
- `seedling-survey.yml`, the whole route (`through=end`, `route=full`), to confirm no other step moves. The change
  fires only on a SEALED throw, and only these four rows had one.
- The JS arc's divergence sweep (`seedling-divergence-sweep.yml`) on the branch. **Predicted: no leg moves.** Every
  L12 leg arriving at (592,16) (legs 174, 175) holds neither Fire nor Swim. The legs that hold both arrive with
  `{12,4}` already cleared (the OPEN state). The derived legs file is 841 legs, 83 in L12.

## Byte-inertia

- Identity block: log md5 **`0d927f71…` before and after** (every row, the six producer `--check`s included).
- Committed tapes: none moved. tapeRunner 589 → **591** pairs (md5 `e28bc4c4…`). The only differences are the two
  added `l12keyline-134-round` pairs (the differential and the stepping face), both passed.
- Surface GREEN 234 · constants PASS 5,488 · entities PASS 528 · profile PASS 138: unchanged.
- Bounded vitest AFTER: **56 files, 2,383 / 2,384**. The one red is `rosterCategories`' LIVE composite row (206 vs
  207): it is the planner's quote and is re-quoted at the bank (`standing-values --write` is not a slice's to run).
- Branch CI at `150a69a` (run 38089455745): 19,463 passed / 3 failed. Those were `rosterCategories` and the two
  `procgenDocs/generated` rows (the reference had not been regenerated yet; fixed at `ac890d5`). At the last code head `ac890d5` (run **38091454167**): **19,465 passed / 1 failed** —
  `rosterCategories` alone (the bank's re-quote). The report commit after it is docs-only (no Vitest run).

## Roster, records

- Roster 266 → **267** (`l12keyline-134-round`). Re-pinned by name: tapeEnvelope, observationTolerance (count +
  swapped), dialogueAutoAdvance (rows + unparted).
- `R8_ENEMY_BRIDGE.exposedAdded`: +1 row, appended (1268 ticks in L12 at ≥ 150 px from `puncher@416,256`, which
  stays behind the shut lock). Exposed 83 → 84, plus the mirror map. **K2PREP owns this scope; the row is append-only
  for the harvest's union.**
- Records: `seedling-bot-log.md` entry (with trap candidates) · `seedling-bot.md` paragraph · reference regenerated
  (the instruments index gains `plan-seedling-l12keyline-witness.mjs`).
- Shared tables (`OBSTACLE_STRATEGIES`, `DEADLINE_SITES`, `KNOWN_STRATEGY_VERBS`, `KILL_ARM_POLICY`,
  `FAMILY_RULES`): **untouched**.
- No new box-taking instrument.

## For the other arcs

- **JS arc:** no contract change. `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging`
  signatures are untouched, and there is no new staging/result field or obstacle kind. A walk-time sealed refusal may
  now resolve to the next frontier door. The worker sees this only as a different (solving) answer.
- **Hammer arc:** nothing handed over. `planSwordDash` costs ~200 s of the 219 s on step 134's long corridor (1069
  start ticks × 4 previews on the swim leg); this was measured, not changed.
- **WAND slice:** D2b item 1.

## What the brief got wrong (measured)

1. *"the equivalent [route round] for bosslock@112,192"*: steps 154/185 have nothing to do with that lock. It is the
   frontier's nearest name from (471,680). The goal's door is the stacked `bosslock@32,864` + `magicallock@32,864`,
   reached from the south through an 8 px cliff gap.
2. *"Is the solver's corridor planner missing it?"*: for 134/175 the corridor PLANNER was not missing it.
   `planWaypoints` plans Fire + Swim the moment the tree is hypothesised gone. The gap was the frontier's
   single-candidate selection.
3. The step-154 refusal "from (471.5,680.3)" was not a staging position. It came after the walk had already opened a
   chest, touched the shield lock and burned the tree.

## Residue (ranked)

1. 154/185: the 8 px lattice for the flood and the walks, the MagicalLock verb (WAND), then the south keylock.
2. 154/185's new text is classified `unclassified` (the strategy bound). A `FAMILY_RULES` row for *"applied N strategies
   for one goal"* would name it; not added (a generic family is a ruling).
3. `planSwordDash`'s cost on long corridors (~200 s on step 134), the hammer/dash owners'.

## Rows to BANK

- Route survey: 134, 175 → SOLVED 1269 t; 154, 185 text moved (above).
- Roster 267, index md5 `47ccedf81ef30697183519af4cbb6377`. tapeRunner 591 / `e28bc4c468d6d074793c7c37086b7843`.
- `rosterCategories` LIVE composite re-quote (+1 tape in its category).
- `R8_ENEMY_BRIDGE` exposed 84.
