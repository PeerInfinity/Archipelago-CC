# seedling-fidelity-turretsuit — a Turret's body contact at its AS3 slot, and its "Suit" retaliation (wave 50)

⚖ GO: Robert 2026-11-17 (planning-21's session), *"Turret suit contact (Recommended)"*, plus the launch GO for this brief.
Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-21` |
| Base | `54ae1bf31c80c473fa2cfb79ade86eb34fd31fbb` (wave 49's head, on `fidelity-harvest/darksuit-w46-w48` `7bb7867cfa`; 140 keys, 126 ON, measured) |
| Harness branch | `claude/dark-suit-turret-contact-mab5v6` (local branch `seedling-fidelity-turretsuit`) |
| Commits | D2 `c612edc0` · D3 evidence `31794fc8` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves no route answer measured here; the 55-leg sweep is the planner's) |

**The one thing to know first:** ON is not suit-only. The key moves EVERY turret contact into the turret's own turn,
because that is where `Enemy.hitPlayer` runs. Without the suit nothing the turret reads changes, and a plain contact is
ON = OFF (rows). Two things do change without the suit: the order of two contacts on one tick (now the game's), and a
new refusal when a freeze starts later on the same tick (a pickup, a dialogue). So the flip sweep is the **55 no-suit
turret-room legs**. It is not the 0 suit legs.

## D1 — the AS3 order and the model's split

### `Turret.update` (`Enemies/Turret.as:45-79`)

| line | statement | reads what the suit's `Enemy.hit` writes? |
|---|---|---|
| **47** | `super.update()` → `Enemy.update` (below) | **the contact and the retaliation happen here** |
| 48-51 | `if (Game.freezeObjects \|\| destroy \|\| currentAnim == "die") return;` | **"die"**: a third hit's `startDeath` = `play("die")` (`:91-95`) returns here on the same tick |
| 52-55 | `player = nearestToEntity("Player")`, `d = FP.distance(x, y, player.x, player.y)` | the player's **position**. A knockback writes only the player's `v`, and the player moves in its own update, which comes last. So no same-tick read |
| 56-59 | the range/anim gate and the aim (`angle += …atan2(player.y - y, player.x - x)…`) | the position again (no) |
| 60-63 | `if (shootTimer > 0) shootTimer--;` | no (`shootTimer` is not written by a hit) |
| **64-68** | `else if (hitsTimer <= 0) { shootTimer = 40; play("startshot"); }` | **`hitsTimer`** (now 30) |
| 70-73 | out of range: `shootTimer = 40` | no |

`endAnim` (`:97-114`) runs from the graphic's update. `"startshot"`'s end spawns the spit. `play("die")` on the kill
tick replaces any shot in the barrel, and that graphic update then steps "die" instead.

### `Enemy.update` up to `hitPlayer()` (`Enemies/Enemy.as:62-118`)

- `:64-67`: the `onScreen()` return.
- `:68-91`: the terrain switch.
- `:106` `super.update()` (the `Mobile` move; a turret has `v` 0).
- `:107-111` `if (!destroy) { hitUpdate(); hitPlayer(); }`.
  - `hitUpdate` (`:223-245`) runs `hitsTimer` down BEFORE the contact.
  - `hitPlayer` (`:211-221`) is gated by `!destroy && currentAnim != "die" && hitsTimer <= 0`, then
    `p.hit(this, 3, new Point(x, y), damage)`.

### The writes, and the same-tick reads they meet

`Player.hit` (`Player.as:1374-1391`): inside its gate, `if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y),
darkSuitDamage 1, "Suit")` (`:1384-1387`). `Turret` has no `hit` override, so this is `Enemy.hit` (`:141-181`):

| write | same-tick reader in `Turret.update` | later readers |
|---|---|---|
| `hits += 1` | — | the next hit's `hits < hitsMax`; at 3, `startDeath` |
| **`hitsTimer = 30`** | **the fire gate `:64`** | its own `hitPlayer` gate (`:213`), so its contacts come 30 ticks apart; the next `hitUpdate` |
| `hitByDarkStuff = true` | — | `Enemy.hit`'s gate `(hitsTimer <= 0 \|\| hitByDarkStuff)`: a sword or arrow hit inside the 30 ticks is NOT refused by the i-frames |
| `startDeath` → `play("die")` (3rd hit) | **the "die" return `:48`**, and that tick's graphic step | the "die" end sets `destroy`, then the fade (`Mobile.as:60-72`) |
| `knockback(f, p)` | empty override (`:86-89`) | — |
| the player's knockback `v` | **nothing**: the aim reads `player.x/y` | the player's own move, last |

`stepTurret` (`turret.js:278`) reads only `t.hitsTimer`, `t.shootTimer`, `t.anim`, `t.angle` and the player's point. So
the coupling is exactly two reads: `hitsTimer` at the fire gate, and "die" at the return.

### The model's order (line numbers at this head)

Per tick (`levelRun.js`): `stepSpitsNow` (`:22217`), …, `stepStaticBodiesNow` (`:22495`: F4's rows, and the turret
branch's `hitUpdate`, die-anim step and fade), …, `stepIceTurretsNow` (`:22545`), **`stepShootersNow`** (`:22551`: per
turret, F4's row → `t.hitsTimer`, then `stepTurret`'s aim/fire and anim, the spawn `unshift`), then the frozen returns
(`runFrozenTick`, `:15970`), …, **`stepContactsNow`** (`:23661`: the static scan; the turret reaches it through the
`STATIC_SWORD_ARM` relabel, gated by F4's row).

- In the game, `hitPlayer` comes BEFORE the fire gate, inside the turret's own update.
- In the model, the contact is billed about 1100 lines BELOW the fire gate.
- So on the hit tick, the fire gate read `hitsTimer` 0, and a shot started that the game's timer forbids.
- On a kill tick, the anim step could release a spit that "die" replaces in the game.
- `STATIC_SWORD_DEATH`'s "die" staging (sword arm) is stepped from the NEXT tick, because the player updates last.
  Wave 46's suit kill (SandTrap) adds a step on the blow's tick, because the blow lands inside the body's own update.
  The turret's blow is likewise inside its own update.

### The reorder chosen (the hook shape)

- `stepShootersNow(onHitPlayer)`: when the caller passes a hook, it is called **at the top of each turret's turn**. That
  is after `stepStaticBodiesNow`'s `hitUpdate` (as `Enemy.update` orders it), and before the row read, the "die" branch
  and `stepTurret`. Absent, no statement runs.
- Only the main tick passes it, and only with the key and `STATIC_SWORD_ARM` ON. The inventory-hold frames and
  `stepShootersThroughFreeze` never pass it: a frozen frame has no contact.
- **The other static classes do not move.** The scan still bills DarkTrap, SandTrap and IceTrap at its own slot, in
  census order. Only the turret's bill moves earlier. Two consequences, both the game's order:
  - a turret contact now precedes another body's on the same tick (`Game.loadlevel` adds `turret` after `darktrap`
    and `sandtrap`, and `addUpdate` prepends);
  - several turrets go in the shooters' reverse placement order.
- **`spitForecastNow`** (`:8847`) is unchanged. It clones `t.hitsTimer` (which the live step copies from F4's row
  AFTER the hook) and `silenced` (the row's `dying`, which the hook can set). So a forecast built after a hit tick reads
  the post-hit state. A forecast takes no contact (its own law: a preview finds out whether a hit WOULD land), so it
  never re-gates a turret on a FUTURE previewed contact. See the hand-over to hammer.
- **STOP rule: not triggered.** The model holds every state the reorder needs: F4's row has `hits`, `hitsTimer`,
  `hitByDarkStuff`, `dying` and `dieAnim`, and the shooter state has `t.hitsTimer`. OFF is byte-identical (below).

## D2 — the key

`CONTACT_FIDELITY.turretSuitRetaliation` is **OFF**, appended LAST (141 keys, 126 ON). Its env is
`SEEDLING_TURRET_SUIT_RETALIATION=0|1`, entered in `SOLVER_ENV_NAMES` after `SEEDLING_TURRET_SNAP_PRICING` (sorted,
duplicate-free). Doc block (`contactFidelity.js`), in brief:

> fidelity TURRETSUIT D2 (wave 50) — A TURRET'S BODY CONTACT AT ITS AS3 SLOT, AND ITS "Suit" RETALIATION.
> `Turret.update` calls `super.update()` FIRST (`Enemies/Turret.as:47`) → … `hitUpdate()` and `hitPlayer()` …, and only
> THEN the "die" return (`:48-51`) and the fire gate `else if (hitsTimer <= 0)` (`:64`). … ON: `stepShootersNow` calls
> the caller's `onHitPlayer` at the top of each turret's turn …; `levelRun` bills the contact there with `retaliate`
> declared (`turretSuitHit` …), so the fire gate reads `hitsTimer` 30 and a dying turret returns. The static scan skips
> the turret …; a freeze that starts later in the same tick … is refused by name. Composes with
> `darkSuitStaticRetaliation`: ON here declares the Turret whatever that key says … OFF: byte-identical.

**The change** (`levelRun.js` only, plus the key):
- `turretHitPlayerNow(id)` is the hook. It runs the static scan's own gates at the slot:
  - the noDamage exit, and the ceremony exit (a ceremony tick never reaches the scan, and `Player.hit` is
    freeze-gated);
  - the census body's `contactRect` against `playerBoxAt(state)`;
  - `enemyHitPlayerFires` on F4's row (`hitsTimer`, `destroy`, `dying`) and `onScreenNow`.
  It then calls `applyPlayerHit({source: 'enemy', id, force contactForce, damage inst.row.damage, from (cx, cy),
  retaliate})`. The arguments are the scan's, plus `retaliate`.
- `turretSuitHit(id)` is `enemyHit(row, {d 1, f 1, t 'Suit'})` on F4's row.
  - A kill is staged as the sword arm stages a Turret's: `destroy` reset, no tag (`writesTag: false`), the kill-lock
    ledger refusal, `killedAt`, and the "die" anim.
  - It also takes the blow tick's graphic step, which `stepStaticBodiesNow` has already passed this tick.
  - Wave 46's `staticSuitHit` could not be reused: its `persistTag >= 0` refusal would refuse every turret kill, and
    editing that hashed statement would move the constants census.
- `turretContactInSlot(inst, id)` is the scan's skip: key ON, `STATIC_SWORD_ARM` ON, `as3 === 'Turret'`, and the
  turret is in `shooterStateFor(level)`.
- `turretSlotContact` records the tick a slot answered a contact. The scan clears it. `runFrozenTick` refuses by name
  if it is still set for this tick (see "freeze" below). OFF it is never written.
- `applyPlayerHit`, `playerHit`, `staticSuitRetaliation`, `staticSuitHit` and the scan's bill are **byte-identical to
  base**.

**The freeze refusal.** `Game.loadlevel` adds every pickup (`Game.as:2330-2351`) and NPC after `turret` (`:2295`), and
`addUpdate` prepends. So their updates run BEFORE the turret's, and `Pickup.pick_up` sets `Game.freezeObjects = true`
(`Pickups/Pickup.as:95`). On a pickup's first tick, then, the game's turret contact is refused by `Player.hit`. The model
detects pickups and dialogues after the shooters, so ON cannot know at the turret's slot that the tick will freeze. It
refuses by name instead of billing a contact the game refuses. OFF never meets this, because the scan is not reached on
that tick. No staging or route step reaches it (D3).

**How it composes with `darkSuitStaticRetaliation`.** This key alone makes the Turret honest: it is the reorder that
makes a declared retaliation exact. That key's Turret arm (the `undeclaredWhy`) is never reached ON, because the scan
skips the turret.

| `turretSuitRetaliation` | `darkSuitStaticRetaliation` | a turret contact under the suit |
|---|---|---|
| OFF | OFF | the plain `byEnemy` refusal (unchanged) |
| OFF | ON | the refusal with wave 46's D1 text (unchanged) |
| ON | OFF or ON | billed in the turret's turn, retaliation declared; the two ON rows are identical (pinned) |

**Key-order pins re-pinned (17 files):**
- the ten tails: `fidelityCeremony126`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress`,
  `L39Phantom`, `RockButton`, `RockFire`, `RockGone`;
- `fidelityCorridorBody`, `fidelityDarkSuitStatic`, `fidelityWallFlyerCorpse`, `fidelityL39Hit` and
  `fidelityDarkSuitBosses` (each list gains `'turretSuitRetaliation'`);
- `fidelityOwlSuit`'s `.at(-1)`, now a tail of `['turretSuitRetaliation']`, and its label;
- `contactFidelity.test.js`: the defaults row and the env-guard line.

`contactFidelityHook.test.js` gains one per-key row by itself.

### Rows (`fidelityTurretSuit.test.js`, fast tier, 9 rows)

Every row stages L29 as wave 46 did. The run boots at (128,168) above `turret@128,192` (entity point (136,200)) with a
`darksuit` grant, idles, then holds `down`. The room's other turrets fire throughout.

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| suit contact | throws at t14 with the `byEnemy` refusal; with `darkSuitStaticRetaliation` ON it carries the D1 text | billed t14: `{hits 1, shake 5, knockback dy < 0}`, `retaliation {as3 Turret, landed, hits 1, hitsTimer 30, hitByDarkStuff true}`; the turret's own touches inside the 30 ticks are `enemy hitsTimer` suppressions |
| ON with both keys | — | identical to ON alone |
| **the fire tick** (idle 41: the contact lands at t55, the tick its `shootTimer` is 0) | no suit: the t55 contact also starts the shot → `turret@128,192#2` spawns at **t61** | suit: `hitsTimer = 30` closes `:64` on that tick → no t61 spawn; the shot starts when the timer runs out and spawns at **t91**. The other turret's spawns are unchanged |
| **the third Suit hit** (6 extra hearts, 110 t) | — | contacts t14/44/74 (the turret's own 30-tick gate spaces them); hits 1/2/3; the third `killed`. `staticBodyDeaths`: `killedAt 74, removedAt 103`, tag −1. After t74 the turret's contacts read `die anim` ×17 then `destroy` ×12. It never fires again |
| no suit (two stagings, 120 t) | ON = OFF, the whole result (hits, spawns, `contactsSuppressed`, deaths); no `retaliation` key | |
| `STATIC_SWORD_ARM` OFF | the scan refuses the turret as `"mover"` at t14 | ON = OFF (no hook passed) |

**Mutants** (copy + restore; `grep -c MUTANT` → 0 after each; `d2/`):
1. **The late hook**: the hook call moved below `stepTurret`. Predicted: only the fire-tick suit row red. Measured: **2
   red**, that row and the third-hit row. I got this one wrong.
   - The fire-tick row read `[61, turret@128,192#2]`: the shot started on the hit tick.
   - The third-hit row also went red: a late hook sits below the dying branch's `continue`. So a dying turret's touches
     are never asked, and its `die anim`/`destroy` suppressions vanish (`expected [] to deeply equal [die anim, …]`).
   - Both rows pin the slot, from two sides.
2. **No blow-tick graphic step** (`if (false && stepSpriteAnim(…))` in `turretSuitHit`). Predicted: only the third-hit
   row red, `removedAt` 103 → 104. Measured: **exactly that** (`- "removedAt": 103` / `+ "removedAt": 104`), 8 green.

⚠ **Not game-witnessed:** every ON row. The pieces are witnessed elsewhere: the Turret's sword death and fade (C1's
`c1-l62-turret`), the contact (wave 46), and the shot timing (`turret.js`'s transcription). But no recording has the
suit in a turret room.

## D3 — the ON measurement

### Byte-inertia (OFF)

- `git diff --name-only 54ae1bf3 HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty** (exit 1).
- `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` (`d3/acceptance-*.md5`):
  - base (a base worktree): `391322d681b7aa0229d94b3f6906d024`;
  - head OFF: `391322d681b7aa0229d94b3f6906d024`;
  - head ON: `391322d681b7aa0229d94b3f6906d024`;
  - head ON + `darkSuitStaticRetaliation` ON: `391322d681b7aa0229d94b3f6906d024`.
  All four equal the standing value.

### The census

The turret rooms (`d3/static-class-rooms.json`, wave 46's `census.mjs`, re-run):
- L29: `turret@80,176`, `@128,192`, `@112,240`;
- L59: `turret@152,64`;
- L62: `turret@232,248` + `darktrap@112,208`;
- L65: `turret@64,112` + `darktrap@144,144`.

| | method | count | ON answer |
|---|---|---|---|
| seed-1 legs | `seedling-divergence-legs.mjs --presets=seedling_playthrough` → 924 legs; `sphere.inventory` holds `"Dark Suit"` → 128 | **0** in (or targeting) a turret room | — |
| turret-room legs, any inventory | the same list, `level ∈ {29, 59, 62, 65}` | **55** (L29 7, L59 16, L62 25, L65 7; `d3/turret_room_legs.json`) | not replayed in node (the sweep below) |
| survey steps in a turret room | `survey-seedling-route.mjs --derive-only --through=end` (250 steps; the suit is collected at step 197) | **12**: 36, 119, 123, 125, 128, 141, 143, 153, 157, 178, 182, 208. Only **208** (L59) holds the suit | `--through=end --only=…` OFF and ON: the rows are **identical** apart from `ms`. 12/12 SOLVED, 0 hits on replay (`d3/survey-{off,on}.rows.json`) |

So no route step meets a turret contact, with or without the suit, and none meets the freeze refusal.

### ON movers

- **Default tier**: the whole bounded set (133 files) with `SEEDLING_TURRET_SUIT_RETALIATION=1`: **3937 passed, 2
  skipped, 1 failed** (`d3/vitest-on-movers.txt`).
  - The skips are the two env-guarded "ships OFF" rows (this file's, and `contactFidelity.test.js`'s defaults).
  - **The one mover:** `fidelityDarkSuitStatic.test.js:117`, *"Turret (L29 `turret@128,192`): refused ON as OFF, and
    ON the refusal names the D1 reason"*. That is by design: the row's premise is this key OFF, and ON the Turret is
    declared, so it bills. I left the row as wave 46 wrote it, so the mover shows. A flip must re-pin it (or scope it
    to `turretSuitRetaliation: false`).
  - Every other turret file is green ON: `turret`, `turretSolver`, `fidelityTurretCircle`, `fidelityTurretSnap`,
    `hammerTurretApproach`, `hammerKeylockTurret`, `dangerMap` and `levelRun*` (and the IceTurret files, which the
    key cannot reach).
- **Train/slow tier**:
  - `hammerWallFlyerDrillKill.train.test.js` is the one `.train.` file that names a turret room (survey step 35 crosses
    L22 → L29). With the key ON (`vitest.train.config.js`, 1 worker): **5/5 green** (`d3/train-wallflyerdrillkill-on.txt`).
  - The other twelve `.train.`/`.slow.` hits are `iceturret@472,400` (L40, an IceTurret) or `TURRET_APPROACH`
    switches. The hook exists only in `turret` rooms (`shooterStateFor`), and L40 has none, so they were not run.

### The named sweep (for the planner's flip question)

- Keys: the **55** turret-room legs in `d3/turret_room_legs.json` (ids 290-296, 478-493, 513-537, 568-574). None holds
  the suit.
- Shards = min(10, 55) = **10**, ×1 per arm, OFF and `SEEDLING_TURRET_SUIT_RETALIATION=1`.
- **Why not 0 legs:** ON moves no-suit turret contacts too. A no-suit leg can differ ON in two ways:
  - two contacts on one tick, which now follow the game's order;
  - a turret contact on a tick where a pickup or dialogue starts, which ON refuses by name.
- Expectation: no mover. The 12 survey steps are identical, and all are hitless.
- Measure for the flip test anyway. A leg that is hitless OFF cannot take a hit ON through this key: the bill's inputs
  do not change, only its slot. It can only refuse.

## Gates

- **Bounded vitest** (`--maxWorkers=3`).
  - The set:
    - `contactFidelity*`, `playerDamage*`, `levelRun*`, `fidelityDarkSuit*`, `fidelityOwlSuit*`, `oneSpelling`;
    - every test file `grep -a -l` finds for `Turret`/`turret`/`stepTurret`/`stepShootersNow`/`spitForecast`/
      `STATIC_SWORD`/`byEnemy`/`retaliate`/`hasDarkSuit`/`undeclaredWhy`/`turretSuitRetaliation`, plus the key-order
      pins;
    - `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`,
      `seedlingSolverSurface`.
    - 149 files, less 16 `.train.`/`.slow.` files (their tiers; see ON movers).
  - BEFORE (a base worktree): **132/132 files, 3930** green.
  - AFTER: **133/133, 3940** green (+9 new rows, +1 `contactFidelityHook` per-key row).
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped, 0 known-red. The tree was untouched during the run.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match.
- `census-seedling-constants.mjs --check`: PASS, with green drift of **7 new structural literals** (the new statements'
  `ticksCompleted + 1` and similar). Wave 46's addendum showed the census test's exact-green-set row goes red on
  those, so I ran `--write` (7136 rows), then `--check` → 0 drift. `seedlingConstantsCensus.test.js` is green in the
  set.
  - No hashed statement was edited. The scan's bill, `applyPlayerHit` and `staticSuitHit` are verbatim.
- `census-seedling-solver-surface.mjs`: line numbers only, `--write` (374 rows), then GREEN.
- `lintGateLabels` and `oneSpelling` are green in the set. No new import was added to `levelRun.js`
  (`withStaticSwordArm` is imported only by the test).
- **CI at `c612edc0`** (the D2 code, identical to the head's code): `JavaScript Unit Tests` push run 44197450239,
  **success**. The unfiltered suite is **28368/28368** (0 skipped, 0 failed), and the slow battery 437/437.
- **Owed** (I cannot dispatch; 403): `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref
  claude/dark-suit-turret-contact-mab5v6 -f train_only=true`. The one train file in a turret room is green ON locally,
  and OFF is byte-identical, so I expect it green.

## What the brief got wrong (measured)

1. **"A shot begun that tick would spawn where the game's 'die' replaces it."** A spit leaves the barrel 6 ticks after
   `startshot` starts, not on the hit tick.
   - On a non-lethal hit tick, the exposure is the shot STARTED against the pre-hit timer (row: spawn t61 vs t91).
   - On the kill tick, it is a spit already in the barrel whose `endAnim` falls on that tick (the model's anim step ran
     before the bill). On the ticks after it, the shooter step's existing `dying` branch already returns and resets
     the anim.
2. **"The call order is near ≈l.14563 / ≈l.23545."**
   - `:14563` (base) is the inventory-hold frame's `stepShootersNow()`, not the tick's.
   - The tick's call is `:22437` at base (`:22551` here). It sits above the frozen returns.
   - The scan is `:23545` at base (`:23661` here).
3. **"Coverage first … no route leg meets a turret contact under the suit."** True (0 suit legs, and survey 208 is
   hitless). But the key is not suit-only, because the honest slot is the slot for every turret contact. So the sweep
   has 55 legs, not 0, and the freeze-start tick is a new ON-only refusal.
4. **"Write F4's held row exactly as `Enemy.hit` does … as wave 46 staged SandTrap's."** The writes are the same. The
   staging is not: `STATIC_SWORD_DEATH.Turret` has `writesTag: false` and ends `destroy-fade`, and wave 46's
   `staticSuitHit` refuses any body without a persistence tag. So the turret has its own `turretSuitHit`, which keeps
   the sword arm's turret branch and adds the blow-tick graphic step. The mutant pins that step.
5. **"Prefer the hook shape … `onHitPlayer`."** I took it. It needed one thing the Owl's and Bob's did not: a refusal in
   `runFrozenTick`. The turret's slot is above the model's pickup, dialogue and arena detections, which in the game
   update BEFORE the turret.
6. **The key-order pins** were 17 files: the brief's 16 (wave 49's list, which already held `fidelityOwlSuit`'s own),
   counting `fidelityOwlSuit`'s `.at(-1)` and its label, plus `contactFidelity.test.js`'s two lines. `grep
   "'owlContactInStep']"` found all 15 list pins.

## Hand-overs

- **To the planner:**
  - the 10-shard sweep above (55 legs, no suit);
  - the `train_only` dispatch;
  - re-pinning `fidelityDarkSuitStatic.test.js:117` at any flip;
  - train 141's `SOLVER_ENV_NAMES` merge (my entry sits after `SEEDLING_TURRET_SNAP_PRICING`).
- **To hammer:**
  - **Turret forecasts take no contact.** `spitForecastNow` and anything that steps `turret.js`'s `stepTurret`
    (`solverBot.js` imports it) never re-gate a turret on a previewed contact. Under the suit, a forecast can show a
    shot the game suppresses. That is only on a tick where the preview is itself in contact, which the walk already
    prices as a hit. Named so it is not relied on as "the spit is coming".
  - **Under the suit, a held contact silences a turret and kills it on the third touch.** The contact re-arms `hitsTimer`
    on exactly the tick the gate would open (row: t14/44/74, no shot after t7). Each touch costs a player hit, so it is
    an encounter-policy option ("tank it with the suit"), not a free one.
  - `hitByDarkStuff` stays latched after a suit hit, so a sword or arrow hit on a turret inside its 30 i-frame ticks is
    NOT refused. `enemyHit` already transcribes that; it is new reach for the sword arm's turret branch.
- **To fidelity (later):** **the pickup tick freezes the turret before it updates.** `Pickup.update` → `pick_up` sets
  `Game.freezeObjects` (`Pickups/Pickup.as:95`), and a pickup updates before a turret. The model steps the shooters
  UNFROZEN on a pickup's first tick and then runs its dead frames frozen (`stepShootersThroughFreeze`). So on that tick
  the model aims, counts `shootTimer` down and may start a shot that the game does not. This is independent of this key
  and was not measured on a witness. ON, the contact half of it is refused by name (above).

## Residue

- Every ON row is model-derived, not game-witnessed.
- The 55 turret-room legs were not replayed in node: the leg runner is the browser sweep. The claim rests on the 12
  identical survey steps, plus the sweep owed above.
- The freeze refusal is unstaged: no staging or route step put a turret contact on a pickup or dialogue start tick.
- Evidence: `seedling-fidelity-turretsuit-evidence/`.
  - `tools/probe.mjs`: the L29 staging, OFF and ON, with hits, spawns, suppressions and deaths.
  - `d2/`: both mutants.
  - `d3/`: the four acceptance md5s; the room census; the leg census and keys; the survey (derive log, rows OFF/ON); the
    vitest before/after/ON counts; the train run; the producer line.
