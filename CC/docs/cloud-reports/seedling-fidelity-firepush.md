# Seedling fidelity FIREPUSH — L40's fire block is moved by the room's pulser (`fireBlockPulseShove`), and two model fixes the game witness found (`fireLiveTurretReach`, `pulserPublishLag`) — all OFF

| | |
|---|---|
| Session | `seedling-fidelity-firepush` (planner `seedling-fidelity-planning-11`, wave 28) |
| Start SHA | `d3346cf784` (main) |
| Code head | `f624d79d` (CI green); this report and its evidence are the commits after it |
| Harness branch | `claude/firepush-pushable-block-fire-kqi11q` (nothing pushed elsewhere) |
| Port | 9726 (and 8000 for the probe battery, whose probes ignore `SEEDLING_PORT`) |
| Verdicts | **W0 PASS · D2 PASS behind `fireBlockPulseShove` (OFF) · D1 PASS (p4g, 0 px) with two model keys (OFF) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-firepush-evidence/` |

## The one thing to know first

**Fire cannot move this block, and the slice's real gap is the chain behind it.** `pushableblockfire@576,576` sits at (36,36)
under the walk block `pushableblock@576,560` (36,35) in a one-tile corridor. The only Fire stance is south of it, and Fire's
push is AWAY from the player, so the press drives it north into the walk block, which is a Solid to it, and nothing moves. Its
mover is `pulser@592,576` (37,36), due east of its centre, which pushes it west into the pocket (35,36). The pulser's publisher
is the MOMENTARY `button@816,400` {t 4}, enclosed behind `wandlock@800,400` {t 5}. That lock's only opener is the momentary
`button@768,400`, which needs a holder: R7 slice 3's route (`r5Totem.L40_ARRIVAL_BREAK.supersededBy`) puts the ice turret's
corpse on t2, then `pushableblockfire@480,480` onto t5 by Fire. With D2 ON the solver plays the pulser link, and the
witness shows the game agrees. **From the arrival, legs 869/870 still refuse: one link earlier in the chain, at
`button@816,400`.** The solver has no Fire move in its block-route search and no corpse-bump routing, so it cannot build
the holders.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch at `d3346cf784`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9726 bash scripts/procgen/identity-block.sh .` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK (= DRILLKILL's values) |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER: the known box artifact (no `bulletml-dodge` checkout) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **345** · PASS **6,908** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` (`evidence/tape-runner-pairs.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 122 files (`evidence/vitest-files.txt`: TIMEDPASS's 96 + every test naming `pushableblockfire`, `pulser`, `hazardDanger`, `CONTACT_FIDELITY_KEYS`, `deriveBlockRoute`, `armedPulsers`, `pulserHits`, `ENTITY_FAMILY_NAMES`, `r5-l40`, `L40_`) + `fidelityL32ArenaPrefix.slow` | **4,237 / 4,238**, the one red environmental (`seedlingAtlasArm`, no `bulletml-dodge`) (`evidence/rows-before.txt`) |
| the gap, reproduced | leg 869's captured request (`replay-seedling-solve-request.mjs`) | the sweep's refusal verbatim: *"Obstacle: solid:pushableblockfire (pushableblockfire@576,576) … Strategy 'shove' failed to apply"* |

**The game, read (W0).** `PushableBlockFire.moveTypes = ["Fire", "Pulse"]`. `Player.genericHit`'s Fire arm (`Player.as:1125`)
and `Pulser.hit` (`Pulser.as:96`) both call `hit(new Point(x, y), t)`, the absolute arm: the block's target moves one tile
away from the source on each axis whose `atan2` band admits it. There is no lean (`input()` reads only `tile`). The model
already had all of this (`pushables.hitPushableFromPoint`, `pulser.pulsePushes`, `levelRun.applyFire`/`stepPulsersNow`).
The solver did not: `resolveShoveStrategy` returns `null` for the fire family, so the frontier refused. **The AP rules**
(`level_40__r23c29 -> level_40__r32c36`: `Fire AND (Ghost Spear | Sword)`) agree with the chain: Fire burns the tree in
front of the t3 latch and pushes the holder block, and the Sword kills the turret whose corpse is the t2 holder. Measured,
not asked.

## D2 — the strategy (PASS, behind `fireBlockPulseShove`, OFF)

`contactFidelity.js`: `fireBlockPulseShove` (OFF; `SEEDLING_FIRE_BLOCK_PULSE_SHOVE=0|1`).

- **`solverBot.resolveFireBlockShove`**, reached from `resolveShoveStrategy` for a `PushableBlockFire` with the key ON.
  It works pulser by pulser (id order) over those whose 22 px reach holds the block (`Pulser.as:90-93`):
  - The pulser's push (`pulsePushes` from its entity centre). A diagonal-band push is refused, as are a destination that
    is Solid to the block (the glide stops dead) and one with no corridor to the aim with the block there (guard (i)'s
    `discharged` hypothesis, `deriveShove`'s own question).
  - It refuses when another live fire block is in the same reach: the pulse has no aim, so that would be an unplanned
    second push.
  - A publisher of the pulser's group is held as an ordinary `hold` (`resolveHoldStrategy`'s stance, exemption and
    prerequisite). The hold's stop is the block AT REST on the destination, so the next plan sees the corridor and not a
    block mid-glide. Its bound is two pulser cycles + the 32-tick glide + `HOLD_SLACK`.
  - It refuses a stance inside the ring's Player arm. A latched group needs only the wait.
  - The Fire press is CONSIDERED for each axis stance and named in `rejected` (L40: S is *"(36,35) is Solid to the
    block"*). It is never executed: a fire-press shove that would plan is refused by name (residue).
- **`execShove` → `execFirePulseShove`**: the publisher's `execHold`. The record is `{verb: 'shove', via: 'pulse', target,
  pulser, to, dir, hold}`.
- **`dangerMap.pulserQuiet`** (the same key): the census disc priced the pulser's ring unconditionally, and that walled the
  only corridor to the key. Measured: with D2's push done, the walk to the walk block's stance refused *"hazard:pulser@592,576
  (avoid (exact) — disc: radiusHit)"*. ON, the ring is LOUD at a sample iff any of these holds; otherwise it is skipped:
  - the sample presses its own group;
  - something other than the player's current press arms it (a latch, a Solid on the button);
  - it is armed by the player now, or `hit()` ran on the latest tick (`pulserHits`), and the sample is within one pulse
    (`pulserCycle().pulseTicks`).

  Named bounds: a Solid pushed onto its button during the walk is not foreseen, and a ring a walk leaves running is
  covered for one pulse from now (exact where the button is more than a pulse's walk from the ring; L40: 14 tiles).
- `entityBlocks.FAMILY_BLOCKS`: `armedPulsers` and `latchedGroups` solverReads += `dangerMap` (and the surface doc's table).

**The ON plan** (from the witness's prefix end; `fidelityFirePush.test.js`): `shove` via pulse (hold `button@816,400`, 24
ticks, *"pushableblockfire@576,576 is at rest on (35,36)"*), then `shove pushableblock@576,560` N to (36,32), then `collect
bosskey@656,528`. **OFF**, the same state refuses exactly as legs 869/870 do.

## D1 — the game witness (PASS; p4g headless, logic-only, 0 px)

`scripts/procgen/probe-seedling-fire-push.mjs [--record]` writes `fixtures/firepush-witness/firepush-l40-bosskey2.json`
(rows packed `[t, level, x, y, blocks, corpse]`). `fidelityFirePush.firePushTape` builds the tape:
1. `r5-l40-part5`'s targets: the t3 latch, the turret kill, two `fire.bumps`, the t2 wait. The second bump is from **(488,424)**,
   one tile nearer than `r5-l40-part5`'s; see the first model fix.
2. **35 scripted Fire presses** (`FIREPUSH_ROUTE`: E4 through the open t2 lock, N6, E11, W1 (the only way to stand north of
   it), S5, E4, N4) parking `pushableblockfire@480,480` on the t5 button. These go through `synthesizeLegs`' `fire.moves`
   with an `enemyRoom` declaration answered by the recording. Then the t5 wait.
3. 500 idle ticks (a spinner window: `spinner@880,848` roams the return corridor and the tape has no `Game.time`, so its
   hammer is priced as the 45-phase union; at idle 0…300 the ladder refuses, measured).
4. **The solver's tail with all three keys ON** (`solveSegment` with the prefix).

The tape is `noDamage`, the relax of `r5-l40-part5`, kept for the prefix it shares.

| check (`evidence/probe-record.txt`) | result |
|---|---|
| the model (keys ON) replays the tape to its end | PASS |
| the game reproduces the model at 0 px: the player and every pushable block, **every tick** | **PASS, all 6,000 sampled ticks** |
| the game ends with the fire block in the pocket (560,576), the other on t5 (768,400), the walk block at (576,512) | PASS |
| the game's turret corpse rests on `button@480,384` {t 2} from the second bump on | PASS (t1838 on) |
| the game's player ends on Boss Key 2's cell (41,33) | PASS (661.43, 534.98) |

**The two model gaps the witness found**, each fixed behind its own key (OFF, byte-identical OFF):

1. **`fireLiveTurretReach`.** `presses.fireRespondersIn` tested an `IceTurret` against its CENSUS rect, the live body's
   32x32 at its `.oel` cell. A corpse bumped out of the flame therefore stayed "reached". The first witness run parted at
   t2097: the game's block stopped at x 496 against the shut t2 lock. Dumping the corpse showed why. On the game,
   `r5-l40-part5`'s second bump from (488,440) moves nothing: the corpse at (488,407.5) has a box [399.5,415.5) above the
   flame's [423.3,455.3). So the corpse rests one tile short and **the t2 group never opens on the game**, while the model
   pushed it onto the button. ON, the live rect and origin are used (`run.entities('turrets')`, passed by
   `levelRun.applyFire`, `fireReachFrom` and `ropeFireReach`).
2. **`pulserPublishLag`.** `Game.loadlevel` adds `button` (`:2341`) and `buttonroom` (`:2342`) before `pulser` (`:2357`), and
   `World.addUpdate` prepends, so a Pulser updates BEFORE its publisher and reads the flag the Button wrote LAST tick (from
   the player box two ticks back). The model's momentary arm read the box one tick back. The second witness run had
   everything at 0 px except the pulse-pushed glide: t5099 in the model, t5100 on the game. ON, the momentary arm is
   lagged one tick and carried on the pulser's own state (`pressedLast`, digested through `pulserStates` in
   `stateDigestParts`' `visit`; no new per-visit map). A latched group is read as before: L38's latch path is unchanged
   by design and was not re-witnessed here.

**Test** `fidelityFirePush.test.js` (10 rows):
- the switches ship OFF;
- the route's chain;
- OFF's refusal (legs 869/870's);
- ON's plan;
- the quiet-ring gate (OFF prices the corridor cell beside the pulser, ON does not);
- the recording's end state and the corpse on t2;
- the recording replayed at 0 px with all three ON;
- `pulserPublishLag` OFF parting at t5099;
- `fireLiveTurretReach` OFF reaching the corpse at (488,407.5) from (488,440), ON not;
- the solver still making the recorded plan (tape inputs equal).

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `resolveFireBlockShove` returns null | ON plan + recorded plan red | red, exactly those |
| m2 | `pulserQuiet` always loud | ON plan, quiet-ring row, recorded plan red | red, exactly those |
| m3 | the hold stops on the block's FIRST move (not at rest) | recorded plan (+ ON plan's `stoppedOn`) red | red, exactly those |
| m4 | `fireRespondersIn` ignores the live turret | the live-reach row only | red, that row only |
| m5 | `pulserPublishLag` read as false | 0 px replay, the lag-OFF row, recorded plan red | 0 px replay + recorded plan red; **the lag-OFF row stayed green**, and my prediction was wrong: that row runs with the key OFF, so a mutant that disables the lag cannot move it |

## The movers (ON): before → after, and the dispatches to confirm

**Route survey, full (local, `survey-seedling-route.mjs --through=end --route=full`, OFF vs the three env switches =1;
`evidence/survey-full-{off,on}.txt`):** 239 rows. OFF: SOLVED 185 / REFUSED 53 / TIMEOUT 1. ON: SOLVED 186 / REFUSED 53.
**2 rows differ:**
- **step 67 (L40, Boss Key 2)**: REFUSED → REFUSED, one link deeper. Before: *"Obstacle: solid:pushableblockfire … 'shove'
  failed to apply"*. After: *"no REACHABLE stance inside button@816,400 … (prerequisites wandlock@800,400: … NO block in
  this room can reach it …)"*. That clause is the weigh's: `deriveWeigh` skips the fire family, and R7 slice 3 measured that
  a fire block CAN reach t5.
- **step 148 (L69)**: TIMEOUT → SOLVED 826 t. L69 holds no pulser, turret or fire block, so none of the keys can act
  there. Read it as the OFF arm's clock under load (the survey and the sweep shared the box); **CI decides**.

**Keyed sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver`, `--contact-fidelity` arm A = the
54 defaults, arm B = the 54 + the three; ×2; 62 legs derived at the base, the L38/L40/L41/L98/L107 regions, every room with
a pulser, an ice turret or a fire block; `evidence/firepush-leg-keys.txt`, `sweep-{A1,A2,B1,B2}.jsonl`, `sweep-summary.txt`):**

| leg (key) | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| 869 `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` | failed (`shove` failed to apply) | same | **failed, one link deeper** (`button@816,400` stance) | same as B1 |
| 870 (the same from `in_L43_176_464`) | failed (same) | same | **failed, deeper** | same as B1 |
| 785 `level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48` | failed (work budget) | failed | done | failed |
| 404 `level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest` | timeout | timeout | timeout | failed (a hammer-arc refusal: `PRESS_KILL_REBOOT_GUARD` at `spinner@880,848`) |
| the other 58 | equal in all four arms | | | |

785 and 404 are noise, decided on captured requests replayed in node. 785's A1 request answers OFF = ON (budget-out at the
`phase-dodge` site). 404's A1 and B2 requests (seam 5311 and 5319) each answer OFF = ON byte-identically (answers
`f6624d7d9348`, `39014e6cb037`). **0 key-driven verdict movers; 869/870 refuse one link deeper.** B2 was cut by a container
restart after 2 legs and re-run for the other 60 (`sweep-B2b.log` is not kept; its rows are in `sweep-B2.jsonl`).

**Probes standard, ON (local, the three literals flipped in a scratch edit, restored):** **11/11 ALL CHECKS PASSED**
(`evidence/probe-battery-standard-on.txt`), `arrival-composites` included. My first attempt passed `SEEDLING_PORT=9726`,
which these probes ignore (they go to 8000): every row was a connection refusal and measured nothing. I re-ran against a
server on 8000.

**Bounded vitest, ON (the same flip; 123 files; `evidence/rows-on.txt`):** 4,251 tests, 4 red:
1. `seedlingAtlasArm`: environmental (as W0).
2. `contactFidelity.test.js > the shipped defaults`: the defaults table (a flip re-pins it).
3. `fidelityFirePush.test.js > all three ship OFF`: likewise.
4. **`iceTurret.test.js > … and the corpse HOLDS button@480,384, which opens the t2 group`**: a CONTROL on the old,
   game-refuted model. It replays `r5-l40-part5`, whose second bump the game does not land (above). A flip owes this row
   re-pinned to the game's answer, and `r5-l40-part5`'s own claim ("the t2 group opens") restated as model-only. The tape's
   player positions are unaffected.

No committed tape, producer `--check`, or identity row moves, ON or OFF.

**Please run, on this branch:**
1. **Survey full**: `seedling-survey.yml` with `through=end route=full`, arm A `contact_fidelity=` the 54 defaults
   (`evidence/sweep-arm-A.txt`) and arm B the 54 + `fireBlockPulseShove,fireLiveTurretReach,pulserPublishLag`
   (`evidence/sweep-arm-B.txt`). Compare against 39496129402 by (level, goal, boot). Expected: L40 step 67 refuses at
   `button@816,400`, and L69 step 148 matches between arms (if it differs, it is a timeout).
2. **Keyed sweep ×2**: `seedling-divergence-sweep.yml` with `keys=` the 62 keys of `evidence/firepush-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, arms A/B as above. Expected: 869/870's refusal text moves, and 0 verdicts
   move by key.
3. **Probes**: `seedling-probe.yml battery=standard` with the keys ON, and a `seedling-probe.yml` run of
   `probe-seedling-fire-push.mjs` (the witness, 0 px expected).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched. There
  is no new `SolverRefusal.obstacle.kind`. **New optional record fields** on a `shove` record: `via: 'pulse'`, `pulser`,
  `hold`.
- **Run state:** with `pulserPublishLag` ON, a pulser state carries `pressedLast` (inside `pulserStates`, already digested).
  No `run.*` field is renamed or reshaped, and no new entity family exists. `auditFire`/`fireRespondersIn` take an
  optional `turrets` map.
- The walker (`botDriverV2.drive`/`chooseHeld`/`hasArrived`/`driveStepHeld`) is untouched, so no `producer:walker` row can
  move. `runHold` is used as it is.

## Hand-overs

- **Nothing to the hammer arc.** None of its functions were edited, and `planWaypoints`, the escape, `stateDigest*` and the
  fork are untouched. Leg 404's B2 refusal is its press-kill reboot guard, which is noise here and not a mover.
- **To the planner (the chain's remaining links, which the leg needs):**
  1. a **Fire move in `deriveBlockRoute`** (the spear's `pressMoves` shape: one tile per press, the stance on the far side,
     an audit that the flame reaches nothing else). It needs a separate order bound: the t5 route is 35 orders against
     `MAX_ROUTE_ORDERS` 8. It also needs `deriveWeigh`'s fire-family skip lifted, including the parked arm, so a fire block
     already on a button dwells.
  2. **corpse-bump routing** for the t2 holder (`IceTurret.bump`'s two-cycle, `L40_CORPSE`).
  3. `runFire`'s `moves` arm refuses any room holding a Bob (`enemiesUnseenByBlockSweep`): the block's glide does not see a
     Bob's body. The witness declared `enemyRoom`; a solver plan cannot. **Bob in the block sweep** is a model row.

## Deltas

- `contactFidelity.js`: the three keys (OFF) and their env lines.
- `solverBot.js`:
  - `resolveFireBlockShove`, `execFirePulseShove` and the `execShove` hook;
  - `fireReachFrom`/`ropeFireReach` pass `turrets`.
- `dangerMap.js`: `pulserQuiet`.
- `presses.js`: `fireRespondersIn`/`auditFire` take `turrets`.
- `levelRun.js`: `applyFire` passes `turrets`; `stepPulsersNow`'s lag.
- `entityBlocks.js` and the surface doc table.
- New files:
  - `fidelityFirePush.js` (+ test);
  - `probe-seedling-fire-push.mjs` (box-lock roster row);
  - the fixture.
- Censuses: surface 345 GREEN, constants 6,906 PASS.
- Generated: the instruments and docs index (the four environmental regions left as at W0).
- Docs: `seedling-bot.md` paragraph, the bot-log entry.

## What the brief got wrong (measured)

- **"the `shove` strategy for a `pushableblockfire` … (a stance? a lane? the fire variant unmodelled?)"**: the strategy is
  not a shove by Fire. Fire's only stance pushes the block into the walk block. The block's mover is the pulser, and the
  pulser's button is three holders deep.
- **"D1 — the block moved as the game allows and the key reached"**: reachable on the game only through the whole chain. The
  witness's holders are scripted, because the solver cannot yet route them (hand-overs 1-3).
- **`r5-l40-part5` is not what its description says on p4g**: its second `fire.bumps` press lands on nothing, and the t2
  group does not open on the game. Its player track is unaffected, so the tape's own checks stayed green.
- The probe battery does not read `SEEDLING_PORT` (it needs a server on 8000).

## Residue

- The Fire-press shove is considered and named, not executed.
- The diagonal-band pulse push is refused.
- Leg 785 (L107, pulser + fire block, latching publisher) still runs out of work budget on its first request in both arms;
  its room is the D2 shape with a latched group, so the latched-wait arm is unexercised.
- `pulserPublishLag` was witnessed on a momentary publisher only.

## Byte-inertia (OFF)

- **Identity at head equals W0 on every md5 row and all six producer `--check`s** (`evidence/identity-after.txt`, a row
  diff: IDENTICAL).
- tapeRunner pairs 635, `88fc7df4…` (= W0). Roster 289.
- **Bounded vitest AFTER (defaults, 123 files): 4,249 / 4,251.** The reds were the environmental one, and `lintGateLabels`
  on my own route row (it typed the press count); fixed at `8487b514`.
- **CI `JavaScript Unit Tests` at `f624d79d` (run 40066288489): success, 22,437 passed, 0 failed; slow battery 267
  passed.** At `8487b514` CI was red on four doc-derived gates (`docsRender`'s heading counts, `generated`, the
  `procgen-reference` gate shard, the identity shard's reference row). My bot-log entry came after the reference
  regeneration; `f624d79d` regenerates it.

## Rows to BANK

- **W0**:
  - a `PushableBlockFire` moves only by Fire or Pulse (the absolute arm);
  - L40's block is the pulser's;
  - the AP rule `Fire ∧ (Sword | Ghost Spear)` matches the chain.
- **D1**:
  - the p4g witness at 0 px over 6,000 ticks;
  - the corpse-reach and pulser-lag findings, each with its OFF control row;
  - mutants m1-m5.
- **Trap candidates** (in the bot-log entry):
  - a census rect is spawn geometry: ask any responder that moves where it is now;
  - a reader that updates before its PUBLISHER reads the publish a tick late;
  - a committed tape byte-exact on the player can be wrong on a body nobody compared.
- **Commits:**

  | commit | content |
  |---|---|
  | D2 `546aea95` | the pulser shove |
  | D1b `42f8b6cc` | the two model keys |
  | D1 `8e088c1e` | the witness |
  | `03603257`, `67c7d22a` | censuses, roster |
  | `6ba7a034`, `f624d79d` | docs |
  | evidence commits | identity, survey, sweep, probes |
