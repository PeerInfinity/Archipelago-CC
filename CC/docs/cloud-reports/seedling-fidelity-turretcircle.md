# Seedling fidelity TURRETCIRCLE — L40's ice turret killed with the plain Sword, hitless, by circling it (`turretCircleKill`); a blast stops on the shield (`iceBlastShield`); a death stops the shot (`iceTurretDeathAnim`) — all OFF

| | |
|---|---|
| Session | `seedling-fidelity-turretcircle` (planner `seedling-fidelity-planning-12`, wave 29) |
| Start SHA | `0ca12e4ab5` (`fidelity-harvest/w29b` = main `d4fc50f5b8` + FIREMOVE + CORPSEBUMP, their keys OFF) |
| Code head | `3ba23b54` (D1–D3 `d599b78b`, the `entityBlocks` pin `3ba23b54`); docs, evidence and this report are the commits after it |
| Harness branch | `claude/seedling-turretcircle-kill-2duxge` (nothing pushed elsewhere) |
| Port | 9732 (main tree: witnesses, sweeps); 9733 (a worktree of the base, then of the head: identity); 8000 (that worktree with the keys flipped: probes) |
| Verdicts | **W0 PASS · D1 PASS (p4g, 0 px; a model gap fixed behind `iceBlastShield`) · D2 PASS behind `turretCircleKill` · D3 PASS (p4g, 0 px over 518 ticks; a second model gap fixed behind `iceTurretDeathAnim`) · Movers: STOP for a licence (0 verdict movers measured)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-turretcircle-evidence/` |

## The one thing to know first

**Your ruling holds on the game, and the shield is not needed for it.** Circling `iceturret@472,400` on the 8 px lanes
beside its 32x32 body, swinging on the move (the press tick holds the movement keys too), kills it with the plain Sword
and **no shield**, never hit: the game's turret is dead on t79 and the model agrees on all 140 ticks
(`turretcircle-l40-sword-circle`). The model could always step this; the solver never tried it, because
`killIceTurretInPlace` STANDS to strike. With `turretCircleKill` ON, CORPSEBUMP's Sword-only refusal becomes a plan, and
the solver's own Sword-only t2 holder plays on the game at 0 px (518 ticks, never hit, the corpse on t2 from t289, L43).

Two model gaps came out of the witnesses, each behind its own key:
- an ice-turret blast never stopped on the player's shield (`iceBlastShield`);
- a turret killed mid-`startshot` still fired its volley from the corpse (`iceTurretDeathAnim`).

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-turretcircle-kill-2duxge 0ca12e4ab5`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `identity-block.sh .` in a worktree of the base (`scripts/dev/new-worktree.sh`, wasm and submodules by hand), venv active, server on 9733 (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `481b7a1c`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` (= CORPSEBUMP's) |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference / generated set | in the block | 4 DIFFER (the known box artifact: no `bulletml-dodge`); generated set not run: the venv's Playwright 1.56 vs the 1.63 pin (environmental) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **352** · PASS **6,914** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` (`evidence/tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 130 files (`evidence/vitest-files.txt` less my new test: CORPSEBUMP's 125, the brief's list, and every test naming `stepIceTurretBlast`, `stepIceTurret`, `interceptIceTurretDeath`, `killIceTurret*`, `killForCorpse`, `blastsInFlight`, `playerShieldRect`, `CONTACT_FIDELITY_KEYS`, `iceturret@472,400`, `turretDamage`, `volleys`, `blastFreezes`), in the base worktree (`evidence/rows-before.txt`) | **4,382 / 4,383**; the one red is the environmental `seedlingAtlasArm` |
| `fidelityL32ArenaPrefix.slow` | `vitest -c vitest.slow.config.js` | 5 / 5 |
| the gap | `fidelityCorpseBump.test.js -t "Sword alone"` | reproduced: *"no start delay 0 … 100 kills iceturret@472,400 from the up side … without a hit"* |

**The game, read (W0).**
- `IceTurret.update` turns the barrel by `angle_difference / 10` per tick, only in range (128) and while neither shot
  animation plays (`IceTurret.as:63-81`). `startshot` freezes the aim; its wrap, **3 ticks later**, fires three blasts 12 px
  apart along it at 6 px a tick (`:153-161`). The shot waits for `shootTimer` (25, counted only between shots) and for the
  turret's 30-tick i-frame to run out.
- The player's box is **4x5** (`playerBoxAt`). A blast hits on the first tick the boxes overlap.
- So a standing Sword kill always meets a volley: the three landings span 62 ticks, a shot cycle is ~45, and every shot
  that starts aims at a player who is standing at the stance. A player circling the body is where the aim was 3–6 ticks ago.
- `Player.slash` swings in the facing the press tick STARTED with, over a rect within reach of the body (`Player.as:892-951`):
  a tangential swing on the move still lands on a 32x32 body.
- **`Shield.as`'s *"It protects you when moving"* is flavour text.** `Player.addShield` adds a `"Shield"` entity whose box
  `render` places by the facing every frame, standing or moving (`Player.as:1139-1256`). `IceTurretBlast.hitables` is
  `["Player", "Tree", "Solid", "Shield"]` (`:17`), and a blast that lists `Player` among its hits still hits.
- **The staging CORPSEBUMP refused holds no shield** (`prox-l40-turret-volley`: `hasShield: false`). The AP route's
  player enters L40 holding `Progressive Shield`.
- Only two rooms in the game hold an ice turret: `Dungeon4/2.oel` (L40) and `Dungeon8/Entrance.oel` (L98).

## D1 — the model check (PASS; p4g headless, 0 px)

`probe-seedling-turret-circle.mjs` (box-lock roster row in `boxLock.test.js`) plays each witness of
`fidelityTurretCircle.TURRETCIRCLE_WITNESSES` on a fresh p4g page and compares, every tick, the player, its hits and freeze
timer, the turret (position, dead), and every blast within 96 px of the turret (the model prunes a blast that can reach
nothing; the game flies it on). `evidence/probe-record.txt` is the final re-check at head.

| witness (pocket boot = `prox-l40-turret-volley`'s header) | the game | the model ON | OFF |
|---|---|---|---|
| `turretcircle-l40-sword-circle` — no shield; clockwise round (468\|508) x (401\|446), swings on the move | dead t79, **never hit** | 0 px, 140 ticks | 0 px (no key needed) |
| `turretcircle-l40-shield-stand` — shield; up 12 (y 447.6), stand 160 facing the turret | **never hit** | 0 px, 172 ticks | parts t52 (a blast the game's shield took) |
| `turretcircle-l40-shield-near` — shield; up 14 (y 443.5), stand 160 | **hit once, t97**: shield and player on one tick | 0 px, 174 ticks | parts t51 |

**The gap and the fix — `iceBlastShield` (OFF; `SEEDLING_ICE_BLAST_SHIELD=0|1`).** `levelRun.stepBlastsNow` never passed a
shield box, while `stepSpitsNow` and `stepLavaBallsNow` did. ON: `stepIceTurretBlast` takes an optional `shieldBox`
(`playerShieldRect(shieldRenderState ?? state, slashState.slashing)`, the same transcription as the spit's), and a blast
that meets it is removed with `hitTypes: ['Shield']`; one that meets the player too still hits.

## D2 — the solver (PASS, behind `turretCircleKill`, OFF; `SEEDLING_TURRET_CIRCLE_KILL=0|1`)

- **`solverBot.circleKillIceTurret`** (exported; reached through `killIceTurretInPlace`'s new `circle: {cw, start}` option,
  an early branch — K4's function is extended, not reshaped):
  - the ring is the rectangle `CIRCLE_LANE_X` (4 px) / `CIRCLE_LANE_Y` (6.5 px) outside the live 32x32 box;
  - every corner and nine points per edge must be plannable floor, or it refuses by name: *"no circling loop around … on
    its clockwise ring is not plannable floor"* (L98: its turret sits against walls);
  - the follower holds the axis keys toward the next corner (1.5 px arrival);
  - a swing (`primary`) rides those keys when the i-frame is out (`run.entities('turretDamage')`), `CIRCLE_SWING_GAP` (7)
    ticks after the last, within `CIRCLE_SWING_REACH` (30 px) of the entity point, and not on a frozen tick
    (`run.progress('frozenTimer')`);
  - it goes on after the death until `CORPSE_POST_KILL_STAND` ticks and no blast in flight (`run.blastsInFlight`); a hit, a
    door or `CIRCLE_TICK_BOUND` (400) refuses by name.
- **`circleKillForCorpse`**: `killForCorpse`'s rung when the blade is the plain Sword and the key is ON (the Ghost Sword
  keeps CORPSEBUMP's standing kill — its plan is unchanged, pinned). Each start delay 0 … `CIRCLE_KILL_DELAY_MAX` (12) × both
  directions × the four first corners (nearest first) is tried on a fork; the first hitless try is replayed on the live run
  and verified (dead, no hit, no blast). None ⇒ *"no circling kill of … with the Sword … is hitless — <first three whys>"*.
- **Measured:** CORPSEBUMP's Sword-only pocket goal goes REFUSED → **SOLVED** (518 t, 1.3 s): cw from corner 3, delay 0,
  three swings, **one fork**.
- Record: `corpse.kill` gains `circle: {cw, start}`, `killTick`, `forks` (NEW optional fields).

## D3 — the solver's own Sword-only t2 holder on L40 (PASS; p4g headless, 0 px)

`turretcircle-l40-t2-holder-sword`: CORPSEBUMP's D3 goal (`reach-pit` (24,27), behind `wandlock@448,432` {t 2}) from the
pocket boot **without** its declared Ghost Sword, under `TURRETCIRCLE_D3_SWITCHES` (CORPSEBUMP's D2 set + `turretCircleKill`
+ `iceTurretDeathAnim`).

| check | result |
|---|---|
| the model replays the tape to its end | PASS |
| the game reproduces the model at 0 px — player, hits, freeze, turret, blasts — **every tick** | **PASS, all 518** |
| the game's player is never hit | PASS |
| the game's corpse rests on `button@480,384` {t 2} and stays while L40 lasts | PASS (from **t289**) |
| the game's player leaves L40 by the pit west of the t2 lock | PASS (L43 at (232, 326.1)) |

**The second gap — `iceTurretDeathAnim` (OFF; `SEEDLING_ICE_TURRET_DEATH_ANIM=0|1`).** The first recording (the plan made
without this key) parted at **t70**: the killing landing came two ticks into a `startshot`, and the model's corpse fired the
volley on the tick it died; the game's did not. `IceTurret.death()` does `play("dead")` (rate 0, clock reset), and
`death()` runs inside `e.update()` before that tick's `graphic.update()`, so the shot never wraps.
`iceTurret.interceptIceTurretDeath` set `dead` and left the shot's clock running. ON: the corpse's anim becomes `'dead'`
(index and timer reset). With the key OFF, the recorded plan meets a phantom volley at t77 (a hit in the model).
⚠ CORPSEBUMP's *"the volley a startshot began before the death still spawns: measured, 5 ticks after"* was a model reading;
on the game a death stops the shot.

## Tests (`fidelityTurretCircle.test.js`, 18 rows)

The three keys ship OFF; each D1 tape is the module's; the game's end states; ON 0 px for every witness; OFF the circle
is 0 px and both shield stands part on their first volley; D2 OFF refuses as CORPSEBUMP left it; D2 ON solves (cw 3, delay
0, three swings, L43); the Ghost Sword plan is unchanged with the key ON; L98's ring refuses by name; D3's tape is the
solver's plan input for input; D3 ON 0 px; D3's game end state; `iceTurretDeathAnim` OFF parts at t77.

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | the blast's `'Shield'` arm removed | shield-stand + shield-near ON 0 px | exactly those 2 |
| m2 | the corpse's `anim = 'dead'` removed | D2 ON plan, D3 recorded plan, D3 ON 0 px | exactly those 3 |
| m3 | no swing on the move | D2 ON plan, D3 recorded plan | exactly those 2 |
| m4 | the circling rung for any blade | the Ghost Sword row | exactly that |
| m5 | the ring floor check off | the L98 refusal | exactly that |
| m6 | no wait for the blasts after the death | 0 red (none in flight 12 ticks after the measured death) | 0 red — the wait is unexercised by a witness (residue) |

## The movers: before → after, and the dispatches to confirm

Arm A = the 65 defaults + FIREMOVE's `fireBlockRoute` + CORPSEBUMP's `blockSweepBodies,corpseBumpWeigh` (68 keys,
`evidence/arm-A.txt`); arm B = A + `iceBlastShield,turretCircleKill,iceTurretDeathAnim` (71, `evidence/arm-B.txt`).

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`; `evidence/survey-full-{A,B}.rows.txt`,
the per-step lines with the ms stripped): 239 rows each, SOLVED 186 / REFUSED 52 / TIMEOUT 1. **A = B on every row, byte
for byte.** L40's steps keep their texts: 67 (*"no REACHABLE stance inside button@816,400"*) and 93 (Totem Part 64,144, no
corridor) refuse before any corpse weigh is raised, and 95/134/154 solve as before. So no survey step reaches the new rung.

**Keyed sweep ×2** (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, served
from the head on 9732): 66 legs re-derived at my base (`seedling-divergence-legs.mjs --presets=seedling_playthrough
--blocks`, 928 legs), every leg in or into L40 and L98 (`evidence/turretcircle-leg-keys.txt`; rows `sweep-{A1,A2,B1,B2}.jsonl`).

| run | done | failed | timeout |
|---|---|---|---|
| A1 | 53 | 12 | 1 |
| A2 | 53 | 10 | 3 |
| B1 | 53 | 10 | 3 |
| B2 | 53 | 11 | 2 |

Two legs differ, and both differ **within arm A** too: **368** `level_40__r0c53 <- in_L41_0_160 -> … Totem Part 64,144`
(failed / timeout / timeout / timeout) and **404** `level_40__r23c29 <- in_L43_176_464 -> … Chest` (failed / timeout /
timeout / failed) — FIREPUSH's, FIREMOVE's and CORPSEBUMP's same noise legs. B1's captured requests replayed in node under
each arm (`replay-seedling-solve-request.mjs --id=…`, `evidence/replay-368-404.txt`) answer **A = B byte-identically**:
368 `27a3bbdc0cfb` (SOLVED 1,558 t in node), 404 `8a464707f067` (refused). **0 key-driven verdict movers.**

**Probes standard, all 71 keys ON** (the six wave-29 literals flipped in the worktree, served on 8000, restored after;
`evidence/probe-battery-standard-on.txt`): **11/11 ALL CHECKS PASSED**, `arrival-composites` included.

**Bounded vitest, ON** (the same flip; 131 files; `evidence/rows-on.txt`): 4,388 / 4,404. The reds:
1. `seedlingAtlasArm`: environmental, as at W0.
2. The "ships OFF" rows (mine ×3, CORPSEBUMP's ×2) and `contactFidelity`'s defaults table: a flip re-pins them.
3. `botDriverV2.test.js`'s five L4 shove rows: CORPSEBUMP's known `blockSweepBodies` mover.
4. **`fidelityCorpseBump.test.js > … with the Sword alone (no Ghost Sword) the kill is never hitless`** — **this slice's
   mover**: ON it solves. A flip of `turretCircleKill` owes it a re-pin to the solve (the D2 ON row is that pin).
5. `entityBlocks` ×2 and my D2 OFF row — **not movers**: the first was red at the defaults too (my new `turretDamage`
   reader; fixed in `3ba23b54`), the second inherited the default (it now names `turretCircleKill: false`).

**Please run, on `claude/seedling-turretcircle-kill-2duxge`** (head after this report):
1. **Survey full:** `seedling-survey.yml` with `through=end route=full`; arm A `contact_fidelity=` the 68 keys of
   `evidence/arm-A.txt`, arm B the 71 of `evidence/arm-B.txt`. Compare against 39496129402 by (level, goal, boot).
   Expected: A = B, every row.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with `keys=` the 66 keys of `evidence/turretcircle-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, arms A/B as above. Expected: 0 verdicts move by key (368/404 are noise).
3. **Probes:** `seedling-probe.yml battery=standard` with arm B's keys ON; then a `seedling-probe.yml` run of
   `probe-seedling-turret-circle.mjs` (all four witnesses at 0 px expected).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched; no new
  `SolverRefusal.obstacle.kind`.
- **New optional record fields:** `corpse.kill.circle: {cw, start}`, `killTick`, `forks` (a weigh record's kill).
- **New exports:** `solverBot.circleKillIceTurret`; `stepIceTurretBlast`'s optional `shieldBox` context field.
- **Run state:** no `run.*` field added, renamed or reshaped; no per-visit map (no `DIGEST_EXEMPT` row owed). With
  `iceTurretDeathAnim` ON a dead turret's internal `anim` reads `'dead'` (`run.entities('turretDamage')[i].anim`), as the
  game's `currentAnim` does; the skin renderer reads no turret anim. New solver reads: `run.entities('turretDamage')`,
  `run.progress('frozenTimer')`, `run.blastsInFlight` (surface census 353 GREEN, `blastsInFlight` classified;
  `entityBlocks.FAMILY_BLOCKS.turretDamage.solverReads += solverBot`, and the surface doc's table).
- **The walker:** `botDriverV2.drive`/`chooseHeld`/`hasArrived`/`driveStepHeld` untouched — no `producer:walker` row can move.

## Hand-overs

- **Hammer arc: none.** None of its functions were edited. `killIceTurretInPlace` is KILLLOCK K4's: it gained the `circle`
  option (an early branch). No escape-read state was added.
- **Escape / digest:** none — no state the escape reads.
- **To the user:** a flip licence for the three keys, with the one bounded-vitest mover above (CORPSEBUMP's Sword-alone row
  re-pinned to the solve) and the "ships OFF" rows.

## Deltas

- `contactFidelity.js` (+test): `iceBlastShield`, `turretCircleKill`, `iceTurretDeathAnim` and their env lines.
- `iceTurretBlast.js`: `stepIceTurretBlast`'s `shieldBox`. `levelRun.js`: `stepBlastsNow` passes it (key ON).
- `iceTurret.js`: `interceptIceTurretDeath`'s `play("dead")` (key ON); imports `CONTACT_FIDELITY`.
- `solverBot.js`: `circleKillIceTurret`, `circleKillForCorpse`, the `CIRCLE_*` bounds, `killIceTurretInPlace`'s `circle`
  branch, `killForCorpse`'s Sword gate.
- `entityBlocks.js` + `seedling-solver-surface.md`: `turretDamage`'s solver reader.
- New: `fidelityTurretCircle.js` (+ test), `probe-seedling-turret-circle.mjs`, `fixtures/turretcircle-witness/` (4).
- Censuses: surface **353 GREEN** (was 352), constants **6,916** PASS (+2 `interceptIceTurretDeath` literals, classified
  structural), entities 566, profile 138, roster 289.
- Docs: `seedling-bot.md` paragraph, the bot-log entry, the instruments + docs index (the four box-artifact regions left as
  committed).

## What the brief got wrong (measured)

- **"the game's shield protects only while the player is MOVING":** the shield entity exists and blocks whenever the
  shield is held, standing or moving; the pickup's text is flavour. And the refused staging held **no shield** at all, so
  the shield was never what refused it. What protects a moving player is the aim's lag and the 3-tick `startshot` freeze.
- **"D1: does the model block a blast with the shield while the player moves exactly as the game does?"** The model never
  blocked an ice-turret blast with the shield, moving or not: `stepBlastsNow` had no shield arm (`iceBlastShield`).
- **"KILLLOCK K4's docblock ('a faced shield stops the volleys') is wrong for a standing kill":** with the shield, a faced
  standing player IS protected by the game (`shield-stand`, never hit), except when a blast meets the shield and the player
  on one tick (`shield-near`, t97). The docblock was wrong about the MODEL, which did not transcribe the shield.
- **CORPSEBUMP's "the volley a startshot began before the death still spawns":** not on the game when the death lands
  before the wrap (`iceTurretDeathAnim`).

## Residue

- The circling rung serves `killForCorpse` only; `killIceTurretInPlace`'s kill-lock (drown) path still stands to strike.
- The ring needs all four sides walkable; a turret against a wall (L98) refuses by name rather than weaving a partial arc.
- The follower is a fixed ring, not a path search; the `CIRCLE_*` values are measured in one room (L40).
- The post-death blast wait (m6) is unexercised by any witness.
- The route survey never reaches the corpse weigh on L40 with the route's items (step 67 refuses upstream at the t5
  stance), so the new rung is measured on the pocket staging only.

## Byte-inertia (OFF)

- **Identity at head equals W0** on every md5 row and all six producer `--check`s (`evidence/identity-after.txt`, measured
  at `9ff9092d` = the code of `d599b78b`; a row diff: IDENTICAL; the same 4 box-artifact DIFFERs).
- **Bounded vitest AFTER** (defaults, 131 files at `32341641` ⊇ the code head; `evidence/rows-after.txt`): **4,403 /
  4,404**, the one red the environmental `seedlingAtlasArm`. `fidelityL32ArenaPrefix.slow` 5/5 at W0.
- tapeRunner pairs 635, `88fc7df4…` (= W0). Roster 289.
- No committed tape, producer `--check`, or identity row moves, ON or OFF.
- **CI `JavaScript Unit Tests`:** read at the last pushed head in the final message.

## Rows to BANK

- **W0:** the aim's lag and the 3-tick freeze; the 4x5 box; the shield entity is facing-placed and always present; the
  refused staging has no shield; only L40 and L98 hold an ice turret.
- **D1:** the circling kill at 0 px (no shield, never hit, dead t79); the two shield stands at 0 px (`iceBlastShield`).
- **D2:** the Sword-only pocket goal SOLVED by the circling rung; L98's ring refusal; the Ghost Sword plan unchanged.
- **D3:** the Sword-only t2 holder at 0 px over 518 ticks (corpse on t2 from t289, L43, never hit); `iceTurretDeathAnim`.
- **Mutants** m1–m6, every prediction met.
- **Movers:** survey A = B (239 rows); sweep ×2 0 by key; probes standard 11/11 ON; one bounded-vitest mover (CORPSEBUMP's
  Sword-alone row).
- **Trap candidates** (in the bot-log entry): a pickup's flavour text is not a mechanism; a state flag is not the animation
  (`dead` without `play("dead")`); a swing can ride the movement keys.
- **Commits:**

  | commit | content |
  |---|---|
  | `d599b78b` | D1–D3 code, witnesses, test, probe, pins (the three keys' hunks interleave in `contactFidelity.js` and the module) |
  | `9ff9092d` | `seedling-bot.md`, docs index |
  | `3ba23b54` | `entityBlocks`' `turretDamage` reader; the D2 OFF row names its key |
  | `32341641`, `c073d156`, `30cb7cf7`, `0837dc3c` | evidence, the bot-log entry, the sweep rows |
  | this report | last |
