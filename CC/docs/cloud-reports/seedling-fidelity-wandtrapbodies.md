# Seedling fidelity WANDTRAPBODIES (wave 67) — `wandShotTrapBodies`

Session `seedling-fidelity-wandtrapbodies` (planner `seedling-fidelity-planning-25`, wave 67). ⚖ GO: Robert, 2026-11-26
(*"Draft W67 brief (Recommended)"*), and the launch GO.

| | |
|---|---|
| start (base) | `6a8ceed9f4162704f9004ef07ebe68993034b20a` — wave 66's final tip (`claude/seedling-wave-66-deadframes-3j11d7`) |
| head | see the last commit on the branch (this report is the last commit; the last CODE head is named under *Gates*) |
| harness branch | `claude/wandshot-trap-bodies-fidelity-k6ytz5` (local `seedling-fidelity-wandtrapbodies`) |
| verdict | **PASS** — one key, default OFF, byte-identical OFF; every witness the game at 0 px ON; the entry-37 refusal is gone ON |

## The one thing to know first

ON, the captured entry-37 request (S1/P1 37:8, 2560) **no longer stops on the WandShot staging refusal**. It now stops on a
**solver** refusal on the same exit: *"the combat ladder is EXHAUSTED. The corridor passes through danger at (120.2,108.4) —
hazard:spinningaxe@128,80 …"* (`8c781b9832a7`, the full pass cut by the `axe-dodge` budget). That is the hammer's
(hand-over below). The two past-37 requests (38:6, 39:1) are unchanged by the key.

## Counts at the head

| | base (W66) | head |
|---|---|---|
| `CONTACT_FIDELITY` keys | 155 | **156** |
| ON by default | 126 | **126** |
| last key | `enemyPressesFallRockButton` | **`wandShotTrapBodies`** (OFF) |
| `SOLVER_ENV_NAMES` | 252 | **253** (`SEEDLING_WAND_SHOT_TRAP_BODIES`, sorted, unique) |

## D1 — the census, the witnesses, the map

### The census (every level of the extract)

Every `pressEnemies` body a WandShot could meet that is outside `boxed` (totems, ice turrets, spinners) and is not a bridged
chaser (`isBridgedChaser`, the bodies `wandShotChaserBodies` — ON — already places):

| class | bodies | levels | this key |
|---|---|---|---|
| **DarkTrap** | 7 | L62, L63 ×4, L65, L101 | **covered** |
| **Grenade** (placed) | 4 | L59, L63, L75, L78 | **covered** |
| Drill | 4 | L28 ×2, L88, L91 | residue (refused) |
| IceTrap | 5 | L45, L46 ×2, L53, L54 | residue |
| LavaTrap | 9 | L77, L78 ×3, L80 ×2, L108 ×3 | residue |
| SandTrap | 13 | L6 ×4, L8 ×2, L16 ×2, L36 ×5 | residue |
| Turret | 6 | L29 ×3, L59, L62, L65 | residue |
| WallFlyer | 7 | L22 ×4, L25 ×2, L27 | residue |

So with the key ON a shot may fire in **L63, L75 and L101** (their only unplaced bodies are trap bodies); L59, L62 and L65 still
refuse on their Turret, L78 on its LavaTraps (the row pins L59's *"cannot place: turret@152,64"*). No darktrap stands within a
grenade's blast light (20 px), and none within 48 px of an unmodelled torch/orb (STATICLADDER's guard; nearest 56.6 px, L62).

### The game (AS3, read)

- `WandShot.as:69` `solids.push("Enemy")`; `update`: `moveX(v.x)` then `moveY(v.y)`, one pixel at a time
  (`Mobile.moveX/moveY` → `collideTypes(solids, …)` per step); a blocker → `checkEntity`: an `Enemy` gets
  `hit(3, p, damage, "Wand")`, a `MagicalLock` `hit(shotType)`, then `play("die")` either way. **`WandShot` adds no `Light`**,
  so it cannot start a darktrap's death (no new death to step).
- `DarkTrap extends SandTrap`: `setHitbox(16,16,8,8)` at `(_x+8, _y+8)` (`SandTrap.as:35`); `hit` EMPTY (`DarkTrap.as:56-58`);
  dies on a non-player, non-dark `Light` within `radiusMin` — `deathCounter` 30, `"die1"`, `endAnim` → `FP.world.remove`
  (deferred to the frame's end). It never writes `collidable`.
- `Grenade`: `setHitbox(6,6,3,3)`, `type = "Enemy"`, `hit` EMPTY (`Grenade.as:70-71`); built 48 px above `endY`, dormant until
  the player is within 32 of `(x, endY)`. Its ctor does not set `collidable`: the **`Entity` default is `true`**
  (`Entity.as:22`). Every falling update writes `collidable = false` (`:109`), every resting one `true` (`:78`).
- FlashPunk: `Entity.collide`/`collideTypes` skip a target with `collidable == false` (`Entity.as:162`); types are tried in the
  solids list's order, so `"Solid"` wins over `"Enemy"` on the same step. The shot is run-time added, and `World.addUpdate`
  prepends, so it updates **before** every `.oel` body: it reads the trap and the grenade as the previous tick left them, and on
  a body's removal tick it still meets it.

### The witnesses (p4g, the delivered vanilla set `seedling-vanilla-record-23510f80`, a fresh page per shape)

`scripts/procgen/probe-seedling-wandtrapbodies.mjs`, recorded to `frontend/modules/seedlingDemo/fixtures/wandtrapbodies-witness/`
(14 files). Each compares, at every sampled tick of the boot level, the player (0 px; the sample clock fits shift `[0]` only),
every WandShot (count, x/y, anim), every DarkTrap (presence, `"die1"`) and every Grenade (presence, x/y, anim) against the model
with the key ON. **All 14 PASS; the model ON is the game at every sampled tick.** OFF, every one is refused at the press with
the shipped text.

| witness | shape | the game |
|---|---|---|
| (a) `a-live` | L63 (32,112) facing E at `darktrap@64,96`, its pole dark | the shot stops at **(63, 112) on tick 17**; the trap lives on |
| (b) `b-counter` | `{63,1}` cleared: `lightpole@64,88` lit, the trap counting down | stops at (63, 112) on **17** (counter 13) |
| (b) `b-die1` | arriving in `"die1"` | stops on **47**, the trap's anim `"die1"` |
| (b) `b-removal-edge` | arriving on the removal tick | stops on **73** (the shot updates first) |
| (b) `b-removed` | one tick later | the trap is gone at 74; the shot flies on and dies on the wall at **(79, 112), tick 80** |
| (c) `c-dormant` | L75 (56,128) facing E at the DORMANT `grenade@72,168` (box at (80,128), never armed) | stops at **(76, 128) on 16** — collidable from its ctor |
| (d) `d-fall` | L63 (114.7,136) facing E, `grenade@128,128` armed at once; the shot crosses its box while it FALLS (tick 30) | **flies through**, dies on the wall at (159, 136) |
| (d) `d-bounce` | crossing on its bounce (tick 71, still a falling update) | **through**, (159, 136) |
| (d) `d-rest` | crossing while it rests | stops at **(132, 136) on 99** |
| (d) `d-explode` | during `"explode"` | stops on **139** |
| (d) `d-hit` | during `"hit"` (after the blast; the player at 21.3 px, outside its 20) | stops on **159** |
| (d) `d-removal-edge` | on its removal tick | stops on **163** |
| (d) `d-removed` | one tick later | gone at 164; **through**, (159, 136) on 173 |
| (e) `e-route` | the shot the captured 37:8 search fires (below): from the request's boot (16,96), the player at (24,104), facing E | stops on `darktrap@64,96` at **(63, 104) on 20** |

Hits: 0 in every witness but `c-dormant` (1, a lavarunner in L75 — the model takes it at the same point).

**(e), measured.** Instrumenting a scratch copy of `levelRun` (restored, `cmp`-checked) and replaying S1 37:8 ON: the search
presses the wand **23 times in L63**; one shot (from (24,104) facing E, twice) meets `darktrap@64,96` at (63,104); the others die
on walls (`tile:Body Wall`, `tile:Bridge`) and on `pushableblockspear@112,96`. None meets the grenade. The solve still ends in the
axe refusal, so there is no end-to-end plan to witness; `e-route` is that shot.

### The map — every place a shot reads bodies

| site | what it reads OFF | ON |
|---|---|---|
| `levelRun.assertWandShotSolidsBound` (at the wand press) | `boxed` = totems, ice turrets, spinners; + the stepped bridged chasers (`wandShotChaserBodies`) | + `wandTrapBodyIdsFor(level)`: every darktrap (with `darkTrapLight`) and every placed grenade, none under `noclip`/`noDamage` |
| `levelRun.wandShotBlockerAt` (1) | `collidesSolid` — tiles, Solid entities, unwoken totems, turret corpses, magical locks | unchanged |
| `levelRun.wandShotBlockerAt` (2) the Enemy arm | woken totems, spinners, chasers | `wandTrapBodyAt(box)` first: a darktrap's `rect` until `removed`; a grenade's 6 x 6 at its live point unless `removed` or `collidable === false`. A box that ALSO overlaps a totem/spinner/chaser refuses by name (the type-list order is not held) |
| `levelRun.applyWandShotToBoss` | any non-totem Enemy → refuses *"not a BossTotem"* | a darktrap/grenade: `landed: false`, `spentWithoutDamage: true`, `trapBody`, no state change |
| `levelRun.stepPlacedGrenadesNow` | — | passes `onCollidable` to `stepPlacedGrenade`, which writes `g.collidable` (true resting, false falling) |
| `solverBot.previewWandShot` (hammer's) | `run.world.collidesSolid` only — **no Enemy body at all**, by design (*"a body the preview missed is a refusal there"*) | unchanged (not this slice) |
| `inventoryHoldCensus` `wandShots` | a live shot refuses a hold | unchanged |

## D2 — the key

`wandShotTrapBodies` (default OFF), last in `CONTACT_FIDELITY_DEFAULTS`, its doc block in `contactFidelity.js` (the witnesses
and the cites above), its env lines (`SEEDLING_WAND_SHOT_TRAP_BODIES=0|1`) and its `SOLVER_ENV_NAMES` entry.

- `placedGrenade.stepPlacedGrenade` takes an optional `onCollidable` callback, called at `Grenade.as:78`'s and `:109`'s lines. No
  caller passes it OFF (the state objects OFF are unchanged).
- Gates: `noclip || noDamage` → no ids, no box, the room refuses (the chasers' gate; under `noDamage` the jellyfish refuse
  too); `darkTrapLight` OFF → the darktraps stay refused; a darktrap within 20 px of a grenade (its blast `Light`) → refused by
  name; a shot in flight before the grenades are built → refused by name.

### Rows

`fidelityWandTrapBodies.test.js` (fast, 47 rows): the key (OFF, last, env); the witness set (recorded on p4g, the probe's tape
today); per witness ON = the game, OFF = the shipped refusal; the measured numbers (a)–(e); the census pin (the covered classes
and the six residue classes, by level) and the L63-fires / L59-turret-refuses pair; the three gates; S1 37:7 ON (the 640 cut,
unchanged `2e192645c34b`); the composition row (four witnesses with the base's last seven OFF keys ON beside the key).
`fidelityWandTrapBodies.slow.test.js`: every committed tape ON vs OFF (alone, and beside the last seven); S1 37:8 OFF
(`9c5ba5c37277`, the shipped text) vs ON (`8c781b9832a7`, the axe refusal) — a ~50 s solve, so it is in the slow tier.

Key-order pins: 29 rows across 29 files took the new key at the end of their `slice(indexOf(…) + 1)` / `slice(-N)` lists (the
two `slice(-N)` rows went to N+1), plus `contactFidelity.test.js`'s full-defaults object and `fidelityDeadFrame.test.js`'s
*"appended last"* row.

### Mutants (predicted, broken in a copy, restored with `cmp`)

| mutant | predicted | shown |
|---|---|---|
| a falling grenade has a box (`collidable` ignored) | `d-fall`, `d-bounce` stop on the grenade | exactly `d-fall` and `d-bounce` fail |
| a darktrap keeps its box after removal | `b-removed` stops at 74 | exactly `b-removed` fails |
| a grenade keeps its box after removal | `d-removed` stops at 164 | exactly `d-removed` fails |
| no empty hit (a trap hit goes to the totem dispatch) | every stopping witness refuses *"not a BossTotem"* | `a-live`, `b-counter`, `b-die1`, `b-removal-edge`, `c-dormant`, `d-explode`, `d-hit`, … fail |

## The captured requests, OFF vs ON (replayed at the head; the base reproduces OFF)

| request | budget | OFF (= base) | ON |
|---|---|---|---|
| S1 37:8 | 2560 | refusal `9c5ba5c37277`, work 2062 — the WandShot text | refusal **`8c781b9832a7`**, work 2563: dashless refused (2049); full cut by the **`axe-dodge`** budget (514). *"combat ladder is EXHAUSTED … hazard:spinningaxe@128,80 (… update 262 … rate 5, 230°)"*; rungs: **avoid** *"no walkable tile path in level 63 from tile (6,6) to (8,19) … different connected components"*, **dodge** *"no stall of one revolution or less … clears the corridor (1247 previews)"*, bent-through *"28 candidate corridors previewed"* … |
| P1 37:8 | 2560 | `9c5ba5c37277` | `8c781b9832a7` (identical to S1) |
| S1 37:7 / P1 37:7 | 640 | deadline cut `2e192645c34b` | **`2e192645c34b`** — unchanged (the cut is before any press) |
| P1 38:6 "Level 071 - Chest" | 2560 | `e410e113fd01` — *"apitem (160,256) contact -> kill: the count is still waiting on [lavarunner@64,224] … KILLLOCK_CHASER_REWIND"* | **`e410e113fd01`**, identical |
| P1 39:1 (L71→L75 exit) | 2560 | `6bd9d381b7df` — *"reach-exit (96,0)->L75 -> kill: the count is still waiting on [lavarunner@64,224] …"* | **`6bd9d381b7df`**, identical |

The requests replay at this base without a missing field (no staged-shot fallback was needed); the base's OFF answers equal
re-measure-10's.

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only 6a8ceed9f4 HEAD | grep -aE 'fixtures/|golden|tapes/'` lists only the 14 ADDED
  witness files (`fixtures/wandtrapbodies-witness/*.json`); with `--diff-filter=MD` it is **empty** — no existing fixture,
  golden or tape changed.
- **Acceptance batch** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): base **`391322d681b7aa0229d94b3f6906d024`**,
  head OFF **`391322d6…`**, head ON **`391322d6…`** — no seed or field moved.
- **Every committed tape, OFF vs ON:** 322 tapes, **0 movers** alone; **0 movers** with the last seven OFF keys ON beside it. (No
  committed tape fires a wand in a darktrap or grenade room — OFF every such press throws.)
- **The hit gate:** no tape moves, so none goes hitless → hit. The witnesses' only hit is L75's lavarunner (OFF the press is
  refused). No route through L63 solves ON at the captured request, so there is no L63 route that could stand in a blast; the
  `d-*` witnesses stand 21.3 px from it, outside the 20 px disc, and take nothing.
- **ON movers** (key ON by env over every test naming `WandShot`, `wand`, `darkTrap`, `placedGrenade`, `grenade` or `pressEnemies`):
  **140 fast files** (4965 rows): 2 red ON, **neither a model mover**.
  - `frontend/modules/seedlingDemo/contactFidelity.test.js` › *"the shipped defaults: all three ON"* — **OFF-contract**: the row pins
    the LIVE process's `CONTACT_FIDELITY` to the shipped defaults, so any key set by env reds it (its `skipIf` list names
    only some envs). Green OFF.
  - `scripts/procgen/boxLock.test.js` › *"takes conditionally exactly where a headless arm would have been queued"* — **not this
    slice's model**: the new probe takes the box inside `main()` and had to be declared in the import-door list. Red OFF as
    well; **fixed** (`dc69918c`), green.
  - The slow files that name them, one at a time, ON: `deriveLevelWorldLogic.latchSandwich.slow` (3/3), `deriveLevelWorldLogic.slow`
    (2/2), `strategySwitchEscape.slow` (2/2), `fidelityWandTrapBodies.slow` (3/3) — all green.
  - The `.train.` files: none names a shot, a darktrap, a grenade or `pressEnemies`; ten name `wandlock` (L40's, a `Lock`) only.
    They were **not run** (their rooms hold no trap body, so the key's code is unreachable there); the planner's dispatched
    `train_only` run at the head is the measurement.
- **The named sweep** (the keyed ON-arm, shards = min(10, legs)): the survey legs whose route fires a wand in **L63, L75 or
  L101** (the rooms ON can now fire in; L59/L62/L65/L78 still refuse on residue). The survey cache is not in this container, so
  the legs cannot be counted here; the planner's sweep should filter on those three levels (L63: re-measure-10's entry 37,
  `level_63__r6c9`; survey step 183 waits behind it on the same goal).

## Gates

Last CODE head: **`dc69918c51af6b28908ddf22a9a593cf9421db72`** (it touches `scripts/procgen/`, a filtered path).

| gate | base `6a8ceed9f4` | head |
|---|---|---|
| bounded vitest (`--maxWorkers=3`): `contactFidelity*`, `levelRun*`, `levelWorld*`, `wand*`, `fidelityWand*`, `fidelityL12Doors*`, `fidelityLadder2*`, `enemyDamage*`, `oneSpelling`, every file naming `assertWandShotSolidsBound` / `wandShotBlockerAt` / `darkTrapStateFor` / `placedGrenadeStates` / the key, every key-order pin file, `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface` (no `placedGrenade*`, `darkTrap*` or `fidelityStaticLadder*` test file exists) | 53 files, 1448 passed, 1 skipped | **54 files, 1497 passed** (the first head run had 2 red — the DEADFRAME appended-last pin and a census row read mid-`--write`; both fixed / green on re-run) |
| `boxLock.test.js` | — | 26/26 (after the fix) |
| `fidelityWandTrapBodies.slow.test.js` | — | 3/3 |
| `ci-producer-checks.mjs --jobs=3` | — | 99 run, 0 red, 1 skipped, 0 known-red |
| `check-procgen-docs.mjs` | — | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | match | red on the new probe (instruments) → regenerated → **ALL 7 MODULES AND 5 REGIONS MATCH** |
| `census-seedling-constants.mjs --check` (after `--write`; `--profile-rows` rewrote its csv byte-identically) | — | PASS (0 new, 0 moved) |
| `census-seedling-solver-surface.mjs --check` (after `--write`: line moves only) | — | GREEN, 374 rows |
| `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` | — | all six green |
| CI `JavaScript Unit Tests` at `dc69918c` | — | CI_PLACEHOLDER |

⛔ No unfiltered vitest, no `pytest`, no `standing-values --write`. **For the planner:** dispatch
`unittests_frontend.yml -f train_only=true` at the head (this session cannot dispatch).

## What the brief got wrong (measured)

- *"The captured requests were made on the hammer flip base, which your base doesn't hold"* — they **replay at this base**,
  OFF to re-measure-10's exact answers (37:8 `9c5ba5c37277`, 37:7 `2e192645c34b`, 38:6 `e410e113fd01`, 39:1 `6bd9d381b7df`),
  with no env; no staged-L63 fallback was needed.
- *"(c) a shot at a grenade not yet triggered"* in L63 cannot be staged: L63's dormant grenade box (136, 88) lies inside
  `spinningaxe@128,80`'s Solid (and L63's tile (8,7)/(8,9) are pits), so no shot reaches it. (c) is measured on **L75**'s dormant
  grenade instead (open air at (80, 128)).
- The `placedGrenadeStates` map in the brief's model notes has no `collidable` field: the window had to be carried (the
  `onCollidable` hook), not derived — a grenade bounces (L63's lands on 31, rises to 114.5 by 52 and lands again on 74), and
  every bounce update is non-collidable.
- *"`wandShotBlockerAt` … (2) the Enemy arm covers woken totems, spinners and chasers"* — true; and the solver's own preview
  (`solverBot.previewWandShot`) reads NO Enemy body, by design. Not changed (the hammer's).
- The 37:8 replay costs ~50 s per arm, so its OFF/ON row is in the slow tier, not the fast one; 37:7 (4 s) stays fast.

## Hand-overs

- **Hammer (`seedling-hammer-phase-planning-16`)**: with the key ON, entry 37's exit `level_63__r6c9 -> level_65__r0c8` stops
  on the solver's combat ladder at `spinningaxe@128,80` — **avoid** finds the boot tile (6,6) and the exit (8,19) in different
  components with the danger forbidden, **dodge** finds no stall of one revolution that clears the blade (1247 previews), and
  the full pass is cut by the `axe-dodge` budget at work 514 (`8c781b9832a7`, S1 and P1 37:8). That is a solver choice
  (ladder/budget), not a model gap. The rows: `fidelityWandTrapBodies.slow.test.js` *"OFF refuses … ON gets past it"*.
- **Next waves (past 37, unchanged by this key):** 38 "Level 071 - Chest" and 39 (L71→L75) both stop on *"the count is still
  waiting on [lavarunner@64,224] and no stance kills one of them in 1 attempt(s) … KILLLOCK_CHASER_REWIND"* (`e410e113fd01`,
  `6bd9d381b7df`).

## Residue (still refused, by name)

Drill (L28, L88, L91), IceTrap (L45, L46, L53, L54), LavaTrap (L77, L78, L80, L108), SandTrap (L6, L8, L16, L36), Turret (L29,
L59, L62, L65), WallFlyer (L22, L25, L27). A shot box overlapping a trap body AND a totem/spinner/chaser on the same step
refuses (the type-list order is not held). The solver's wand preview stays Enemy-blind (hammer's).

## Evidence in the branch

- re-measure-10's report, the stop-request files (`S1.stop-requests-32-33-37`, `P1.stop-requests-33-37`, `-38-39-47`), its
  `replay/S1-37-8-{ST,NR,DEF}.txt`, `P1-37-8-ST.txt`, `replays.sh`, `replay-counts.mjs` (first commit, the row set);
- the probe and its 14 recordings; the fast and slow rows.
