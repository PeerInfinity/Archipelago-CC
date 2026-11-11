# Seedling fidelity ROCKFIRE — a Fire press that reaches a breakable rock breaks it as a swing would (`fireRockArm`, OFF)

Planner `seedling-fidelity-planning-19`, wave 39. ⚖ The user (2026-11-10): *"Bob + BreakableRock now (Recommended)"*.

| | |
|---|---|
| start SHA | `c670857f64` (the frozen wave-38 joint flip, `fidelity-flip/wave38`; 130 keys, 119 default-ON) |
| head | see the last commit on the branch (this report is committed last) |
| harness branch | `claude/seedling-fidelity-wave-39-eksvyt` |
| evidence | `CC/docs/cloud-reports/seedling-fidelity-rockfire-evidence/` |

## Verdicts

| D | verdict | one line |
|---|---|---|
| W0 | **DONE** | The throw is real and unconditional: any Fire press whose flame reaches a rock throws. The AS3 says more than the brief: Fire breaks an ordinary rock WITHOUT the Ghost Sword |
| D0 | **PASS** | Game witness (p4g, headless, before the model change; 0 px after D1): the game agrees with the AS3 on every staging. No STOP |
| D1 | **PASS** | `fireRockArm` (OFF, last key, `SEEDLING_FIRE_ROCK_ARM`): `applyFire`'s rock arm calls the sword arm's own body, hoisted unchanged. OFF keeps the throw; identity block equals the published values |
| D2 | **MEASURED, flip-ready with 1 re-pin** | ON: the bounded set reds only the defaults pin. Survey over the 33 rock-room steps byte-identical. No committed tape and no solver arm presses Fire at a rock |

**The one thing to know first:** a Fire press breaks an ordinary rock (rockType 0) with or without the Ghost Sword.
`hit(hasGhostSword ? 1 : 0)` tests `rockType <= _t`, and `0 <= 0` holds. Only the two ghost rocks in the game (L3,
L101) need the Ghost Sword. So Fire is a second rock-breaker the game offers a run that holds no Sword. The model now
steps it (key ON); neither the solver's `break` verb nor the rules offer it yet (see "Handed on").

## W0 — the trace (no code)

**The claim, verified line by line** (`vendor/seedling/src`, pinned `ccdf189776`):

- `Player.fire()` (`Player.as:1014-1037`): on `sprFire` frames 3..6, for `i` in 0..10,
  `FP.world.collideRectInto(hitables[i], x - sprFire.originX, y - sprFire.originY, sprFire.width, sprFire.height, vc)`
  into ONE vector `vc` declared outside the loop and never cleared, then for each `e` in `vc` the radius cut
  (`FP.distanceRects(…, e.y - originY, …) > sprFire.width / 2` → skip; the player's `originY` stands in for the
  target's) and `genericHit(e, "Fire", fireForce, fireDamage)`.
- `hitables` (`Player.as:99`): `["Enemy", "Grass", "Tree", "Rock", "Rope", "ShieldBoss", "Solid", "LightPole",
  "LavaBall", "LavaBoss", "Watcher"]`.
- `BreakableRock`'s ctor (`Puzzlements/BreakableRock.as:41`): `type = "Solid"; //Was "Rock"; If it's buggy, that might
  be why`. A rock is therefore collected on pass `i = 6` and, because `vc` keeps it, dispatched on passes 6..10:
  **five `genericHit`s a hit tick**. The model's `FIRE_HITABLE_TYPE_BY_ARM.BreakableRock` said `'Rock'`
  (`hitables[3]`, eight dispatches). Nothing counted them, so nothing showed.
- `genericHit` (`Player.as:1073-1092`): `if (Game.freezeObjects) return;` … `else if (e is BreakableRock)
  (e as BreakableRock).hit(hasGhostSword ? 1 : 0);`. `t`, `f` and `d` are not read on this arm.
- `BreakableRock.hit(_t)` (`:57-67`): `if (rockType <= _t) { if (currentAnim != "break") Music.playSound("Rock", 1);
  (graphic as Spritemap).play("break"); }`. `play` early-returns for the animation already playing, so dispatches
  2..5 of the tick, and every later hit tick, change nothing. **`hit(0)` on a rockType-0 rock breaks it**; `hit(0)` on
  a ghost rock (rockType 1) does nothing at all (no sound, no state).
- `BreakableRock.endAnim` (`:69-73`), the "break" animation's callback: `Game.setPersistence(tag, false);
  FP.world.remove(this);`. `check()` (`:48-55`) builds the room without a rock whose `tag >= 0` flag is cleared.

**The throw, reproduced at the base** with the smallest staging (`fidelityRockFire.rockFireTape`: the L40 pocket boot,
entity (200,136), `noDamage`, Fire equipped at t0, hold `left` onto `breakablerock@176,128`, `primary` on input 10; 40
ticks): the run throws at the first hit tick,

> levelRun: \`FIRE_ARM_POLICY\` calls BreakableRock modelled and this dispatch has no arm for it. A policy and an
> executor that disagree is the two-consumers failure, so this throws rather than silently skipping.

The same from L101 against `breakablerockghost@224,96`, with and without the Ghost Sword.

**Census.** Twelve shipped levels hold a BreakableRock (the atlas, `buildLevelWorld`):

| level | rocks (type, tag) |
|---|---|
| L0 | `@192,32` (0, 3) · `@288,176` (0, 1) · `@80,112` (0, 4) |
| L3 | `@96,112` (0, 0) · **`breakablerockghost@0,64` (1, 1)** |
| L15 | `@96,80` (0, 2) · `@96,16` (0, 3) |
| L16 | `@112,80` (0, 5) · `@96,80` (0, 4) · `@96,64` (0, 3) · `@304,64` (0, 6) |
| L30 | `@48,224` (0, 1) |
| L40 | `@160,144` (0, 23) · `@176,128` (0, 22) · `@176,144` (0, 24) |
| L41 | `@224,64` (0, 1) · `@224,80` (0, 2) |
| L53 | `@112,128` (0, 0) · `@128,160` (0, 1) |
| L73 | `@64,48` (0, 0) |
| L92 | `@176,48` (0, −1) · `@256,112` (0, −1) |
| L100 | `@128,144` (0, 0) |
| L101 | **`breakablerockghost@224,96` (1, 2)** |

**Does anything shipped do it today?** No, and the throw is why it could not hide:

- Committed tapes: the whole roster (293 tapes) replayed with the key ON: 22 tapes fire a Fire press, **none** reaches
  a BreakableRock, none errors (`evidence/roster-on.txt`).
- Solver: all four Fire stance planners audit the flame through `presses.auditFire` and refuse a stance that reaches
  anything but their own target (`fireReachFrom`'s `others` for the burn, `resolveFireMoveStrategy`'s `strays`, the
  corpse push's `reached.length !== 1`, `ropeFireReach`'s `others`). A rock is a `modelled` (non-inert) responder, so
  it is always a stray. The `break` verb (`resolveBreakStrategy`) refuses unless the primary is the Sword or the
  Ghost Sword.
- Survey / sweep: no step or leg can, for the same reason (measured below for the survey).

## D0 — the game witness (before any model change)

`scripts/procgen/probe-seedling-rock-fire.mjs [--record] [--on=fireRockArm] [--only=] [--dump=a-b]` (box-lock roster
row in `boxLock.test.js`; fold `fidelityRockFire.js`), a fresh p4g page per tape (`seedling_bot_ap_p4g`, headless
logic-only, port 9782).

**How the rock is observed.** `botMobiles` walks `Mobile`; a BreakableRock is a plain `Entity`, so the game exposes no
rock row and no animation frame. The rock is read through its two consequences, every tick: its **solid** (each tape
holds the player against the rock, so `x` moves on the observation the cell opens) and its **persistence write**
(`botStatus.persistence_cleared`, which holds a flag from the tick `endAnim` writes it). The break animation's frames
themselves are not observable on this build.

Recorded with the model unchanged (five stagings; `fixtures/rockfire-witness/`), `primary` on input 10:

| witness | rock (type) | weapon, Ghost Sword | the game: flag written (obs) | cell opens (obs) | the AS3 reading |
|---|---|---|---|---|---|
| `rockfire-l40-fire` | `breakablerock@176,128` (0) | Fire, no | **22** ({40,22} and {40,24}) | **23** | breaks ✔ |
| `rockfire-l40-fire-ghost` | the same (0) | Fire, yes | 22 | 23 | breaks ✔ |
| `rockfire-l40-sword` (control) | the same (0) | Sword, no | 19 | 20 | breaks ✔ |
| `rockfire-l101-ghostrock-fire` | `breakablerockghost@224,96` (1) | Fire, no | never (40 ticks) | never | nothing ✔ |
| `rockfire-l101-ghostrock-fire-ghost` | the same (1) | Fire, yes | 22 ({101,2}) | 23 | breaks ✔ |

The game agrees with the AS3 on every row, so no STOP. Two things the table adds: the flame reaches `@176,144` as
well from that stance (both flags land on one tick), and a Fire-broken rock opens **three ticks later** than a
sword-broken one (the flame's first hit tick is press + 4; a swing's first test is press + 1).

A sixth witness was added after D1, `rockfire-l40-fire-twice` (a second press on input 30, standing in the opened
cell, the rect over the two GONE rocks' cells): the game does nothing to the gone rocks and breaks the third,
`@160,144` ({40,23} on obs 42).

**Not witnessed:** the freeze (`genericHit` returns under `Game.freezeObjects`): it needs a Fire hit tick inside a
pickup ceremony beside a rock, and no cheap staging has one. And the dispatch COUNT (five, not eight): `hit` is
idempotent, so the game cannot tell them apart; the count rests on the ctor's `type = "Solid"` alone.

## D1 — `fireRockArm` (OFF, byte-identical)

- `contactFidelity.js`: the key, LAST in `CONTACT_FIDELITY_DEFAULTS` (131 keys), its doc block, the two env lines;
  `solverEnvChannel.js`: `SEEDLING_FIRE_ROCK_ARM` in `SOLVER_ENV_NAMES`; `contactFidelity.test.js`: the defaults pin
  gains `fireRockArm: false`.
- `levelRun.js`: the sword arm's BreakableRock body (R5 slice 5, in `applyThrust`) is **hoisted unchanged** into
  `hitBreakableRock(id, pressTick, what = 'press')`, comments included, returning the ledger row it used to push
  (`pullRope`'s shape). The sword arm is now one call to it; its error text is byte-identical (`what` defaults to
  `press`). `applyFire` gains the arm, before the fallthrough throw: `r.as3 === 'BreakableRock' &&
  CONTACT_FIDELITY.fireRockArm` → under a ceremony a no-op row (*"the freeze"*), else
  `{...hitBreakableRock(id, pressTick, 'fire press'), dispatches: r.dispatches}`. So the rock type test
  (`rockBreaksUnder`), `hitRock`'s idempotence, `goneAt`, the flag ledger (`rockFlags`, the out-of-band writer for a
  `tag = -1` rock) and `rockGoneFencepost` are the sword's, not a copy. Same tick order as the sword arm
  (`ticksCompleted`: `fire()` runs where `slash()` does in `Player.update`).
- `presses.fireRespondersIn`: with the key ON a BreakableRock row's type is `'Solid'` (five dispatches).
  `FIRE_HITABLE_TYPE_BY_ARM.BreakableRock` is left at `'Rock'` for the OFF arm, with a note.
- No new per-visit run map (the arm writes `rockStates`, already in `stateDigestParts`' `visit`, and `rockFlags`). No
  new run getter. No new `SolverRefusal.obstacle.kind`, no staging/result field.

**Rows** (`fidelityRockFire.test.js`, 20, default tier, ~2 s; predicted before the arm was written, from the AS3 and
the game's write tick): OFF — every Fire tape throws the text above; the Sword control is the game at 0 px in both
arms. ON — all six witnesses at 0 px on every sampled tick (the player; the rock flags); the first hit tick is 14,
`goneAt` 21; five hit ticks (14..18) of five dispatches, the first breaking, the next four *"already breaking"*; the
ghost rock without the Ghost Sword is five *"rockType 1 > 0"* rows and nothing broken; the second press breaks
`@160,144` at 34 → 41; a room built without its rocks (the three flags cleared at the boot) has no rock row and no
throw in either arm. All predictions held.

**Mutants** (copy of `levelRun.js` / `presses.js` + restore, `cmp` clean after):

| mutant | predicted red | measured red |
|---|---|---|
| m1 the rock breaks whatever the inventory (`rockBreaksUnder` → `true`) | the ghost-rock-without-Ghost-Sword rows | exactly those two (its 0 px row, its ledger row) |
| m2 the census type left at "Rock" (the key's override dropped) | the dispatch-count row | that row **and** the ghost-rock ledger row (it pins `dispatches: 5` too: my prediction named one) |
| m3 the arm ungated (`&& CONTACT_FIDELITY.fireRockArm` dropped) | the OFF throw rows | exactly those five |
| m4 the hit a tick late (`hitRock(…, ticksCompleted + 1)`) | every breaking 0 px row, the Sword control with them | those nine (one model: the sword's rows red with the fire's) |

## D2 — the key ON, measured

**Is there a solver arm that chooses this press now?** No. See W0: every Fire stance planner refuses a stance whose
flame reaches a rock, at plan time and in both arms, and `break` takes the Sword. What changes with the key ON is
execution only: a Fire press that reaches a rock breaks it (or, for a ghost rock without the Ghost Sword, does
nothing) where OFF threw. No row below turned a hitless leg into a hit-taking one, and no row moved at all.

**The bounded set** (142 fast files = FIRESPINNER's 111 + every `grep -a` hit for `FIRE_ARM_POLICY`, `applyFire`,
`fireRespondersIn`, `auditFire`, `BreakableRock`, `breakableRocks`, `rockGoneFencepost`, `hitRock`, `rocksBroken`,
`fireSpinnerArm`; list in `evidence/vitest-bounded-files.txt`):

| arm | result |
|---|---|
| OFF (D1 head) | 140/142 files, 4611/4618; the two red files were bookkeeping of mine, fixed and re-run green (below); CI's whole suite is green at the pushed head |
| ON (`SEEDLING_FIRE_ROCK_ARM=1`) | **141/142, 4616 passed, 1 red, 1 skipped** (the skip is my own key-OFF row, `skipIf` the env) |

The one ON red, a flip re-pin: `contactFidelity.test.js` › *the shipped defaults: all three ON* (`fireRockArm` false →
true). Every committed GAME-WITNESS test in the set is green in both arms.

The first OFF run's two red files were mine and are fixed at the head: `lintGateLabels` (my test name carried a typed
count) and `seedlingConstantsCensus` (the hoist moved two reviewed rows, `rock.persistTag ?? -1` and the `tag < 0`
test, from `applyThrust` to `hitBreakableRock`; re-pointed in `seedling-constants-fields.csv`, classes unchanged).

The slow/train files of the set (`fidelityL32ArenaPrefix.slow`, `fidelityL40Bk2.train`, `hammerGhostKillRung.train`,
`hammerSpinnerPress.train`, `hammerL53Killlock.train`), run serially: **OFF** train 4/4 files (12 tests) + slow 1/1 (5); **ON** the same, all green
(`evidence/vitest-{train,slow}-{off,on}.txt`).

**Survey (local, route=full, through=end), the 33 rock-room steps** (1, 3, 12, 14, 16, 20, 23, 24, 26, 30, 38, 40, 55,
58, 61, 66, 67, 78, 82, 86, 96, 97, 98, 100, 137, 150, 161, 200, 217, 218, 224, 229, 232): **byte-identical ON vs
OFF** (every row field but the wall time): 28 SOLVED / 5 REFUSED in both. The five refusals (66, 96 L40 ladder-routed
collects; 78 L53 chaser kill; 224, 229 L101 magical lock) are unchanged and none names a rock. The other steps cannot
move: with no BreakableRock in the room the census has no rock row, and the key reads nothing else. Files:
`evidence/survey-{off,on}.txt`, `survey-rock-rooms-{off,on}.json`.

**Survey/sweep rows this moves: none measured.**

## The dispatches for the planner (I cannot dispatch)

Branch `claude/seedling-fidelity-wave-39-eksvyt` at the head.

1. **Survey A/B** — `seedling-survey.yml`, `through=end`, `route=full`, on (A) this branch as is (OFF) and (B) the
   same with `fireRockArm: true` as the default (the workflow has no switch input: a one-line scratch flip). Expect
   identical rows; the rock-room steps are the 33 above.
2. **Sweep ×2 per arm** — `seedling-divergence-sweep.yml`, `shards=10`, `mode=inv`, `producer=solver`, `keys=` the
   174 rock-room legs derived at this base (`evidence/keys-rock-rooms.txt`, md5 `93c7ade5…`: L0 45, L3 10, L15 4,
   L16 18, L30 26, L40 48, L41 2, L53 8, L73 2, L92 2, L100 2, L101 7; `seedling-divergence-legs.mjs
   --presets=seedling_playthrough --blocks`, 933 legs), and `contact_fidelity=` (A)
   `evidence/contact-fidelity-off.txt` (the base's 119 default-ON keys, built fresh from this head's
   `CONTACT_FIDELITY_DEFAULTS`, md5 `38d53eef…`) and (B) `evidence/contact-fidelity-on.txt` (the same + `fireRockArm`,
   md5 `b4cf760e…`). Each arm twice; a mover counts only if both repeats agree.
3. **Probes** — `seedling-probe.yml`, `battery=standard`, on the branch (OFF), and once more with the scratch flip.

## Handed on

- **JS arc:** nothing to wire. The press ledger's Fire→rock row (`{as3: 'BreakableRock', id, broke, goneAt, why,
  dispatches}`) is new and appears only with the key ON. No `run.*` field renamed or reshaped;
  `solveSegment`/`twoPassSolve`/`createRunForStaging` untouched. JS pins that move: none.
- **Hammer arc:** nothing edited in its region; no hammer pin moves (the three hammer train files in the set: see the
  heavy row above).
- **Rules (rules-2) and the planner — a finding, not a change:** the game lets a run with Fire and NO Sword break any
  rockType-0 rock. Today the solver's `break` verb refuses unless the primary is the Sword or the Ghost Sword, and
  the rock rules quoted in my brief (L15 `Or(Sword, Ghost Spear, Swim)`, L16 *weapon*) do not name Fire. I did not read the
  rules beyond that. Under ⚖ "everything in the game", a Fire `break`
  arm (stance: a cell whose flame reaches the rock and nothing else; the clock: press + 4, `goneAt` + 7) and the
  matching rule alternative are a follow-up slice. With `fireRockArm` ON the model can already execute it.

## Deltas, byte-inertia, records

- **Identity block at the head, key OFF** (`evidence/identity-head-off.txt`): every row equals the published main values —
  maze `57e07d21`, acceptance **`abb206c88de25e7ba1874510d493ce85`**, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`,
  ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels
  `e28c1e5d`/`fb1a59e5`, generated set OK; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` ·
  `be9c19c8`, all exit 0. ⚠ The BEFORE is by quotation (FIRESPINNER's block at `2d1283375e`, plus the first three rows
  measured here at `c670857f64` before any model edit: equal); a full base run was not spent.
- Reference regenerated (the new probe: 539 instruments; the docs index after the log entry): `--check` ALL 7
  GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH. Solver surface `--write`/`--check`: 371 rows, GREEN (line moves
  only). Constants census: 7088 literals, `--check` PASS.
- `check-procgen-help.mjs --doors=all`: ALL PASS, 539 instruments.
- Records: `seedling-bot.md` paragraph; `seedling-bot-log.md` entry; box-lock roster row.
- No tape added to `fixtures/tapes/` (the witnesses live in `fixtures/rockfire-witness/`), so the roster pins
  (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`) and `r8Acceptance` are
  untouched; all are in the bounded set and green.
- Newest-key pins extended to admit `fireRockArm` (found by grepping the previous last key, `fireSpinnerArm`):
  `fidelityFrozenPress`, `fidelityL39Phantom`, `fidelityDrillWater`, `fidelityCeremony126`, `fidelityRockGone`,
  `fidelityFireSpinner` (its *"last in the defaults"* became *"followed only by wave 39's key"*). ⚠ Sibling BOBIFRAME
  will add its own key; whichever lands second re-admits the other in these same six rows.
- CI: `JavaScript Unit Tests` at `488fc063` (the records commit; the report-only head follows it): run `42934130003`
  **success**, suite 26432 passed / 0 failed, slow battery 431 / 0. The train tier does not run on a slice push; the
  five heavy files above are the local bounded run of it.

## What the brief got wrong (measured)

- *"a Fire press may BREAK a rock when the Ghost Sword is held, and do nothing (or something else) when it is not"*:
  the Ghost Sword decides only the two GHOST rocks. An ordinary rock breaks under Fire either way (`0 <= 0`), on the
  AS3 and on the game.
- *"how many dispatches a hit tick makes for a Solid"*: five, as the brief implied, but the model's own table had a
  rock as `"Rock"` (eight). Corrected under the key.
- *"recording the rock's state each tick through its break/fade"*: the build exposes no rock row or animation frame
  (`botMobiles` is `Mobile`-only). The witness records the rock's solid and its flag write each tick instead.
- *"OFF keeps today's throw exactly"*: kept. Unlike FIRESPINNER there is no silent half: a rock does not move, so the
  census placement is the body, and no live join was needed for the arm to be right.

## Residue

- **The census still lists a GONE rock** (broken this visit). The game's `collideRectInto` cannot return a removed
  entity; the model's Fire and sword arms both make an *"already breaking"* no-op row for one (the effect is right, the
  row's wording is not), and the solver's Fire stance audits still refuse a stance beside a gone rock's cell. Shared
  with the sword arm, so not changed here.
- **The sword's rock arm has no freeze gate** (`genericHit` returns under `Game.freezeObjects` for every arm). The
  fire arm has it, transcribed and not witnessed. Not touched: it is the sword arm's.
- The freeze and the dispatch count are not game-witnessed (D0).
- A Fire `break` arm and its rule (Handed on).

## Rows to BANK

- `fidelityRockFire.test.js` (20 rows, default tier, ~2 s).
- `fixtures/rockfire-witness/` — six p4g recordings: `rockfire-l40-fire`, `-fire-ghost`, `-sword`, `-fire-twice`,
  `rockfire-l101-ghostrock-fire`, `-fire-ghost`.
- Timing fact: a Fire press's first hit tick is press + 4 (a swing's first test is press + 1); a rock's flag is written
  on observation `goneAt + 1` and its cell opens on `goneAt + 2`, for either weapon.
- Trap candidate: a policy table that says `modelled` is a claim about an executor arm; `FIRE_ARM_POLICY` had two such
  rows with no arm (Spinner, BreakableRock). A guard that walks `FIRE_ARM_POLICY`'s `modelled` rows and asks `applyFire`
  for each would have found both.
