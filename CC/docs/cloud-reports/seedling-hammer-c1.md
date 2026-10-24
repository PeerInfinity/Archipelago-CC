# Seedling HAMMER-PHASE — slice C1: the removal chooser reads the probe's hit, and a static body dies to a sword press

Slice `seedling-hammer-c1` (Opus build slice, cloud), planner `seedling-hammer-phase-planning`. Two switches, **both
OFF**, and OFF is byte-identical: `solverBot.CHOOSER_HIT_SOURCES` and `enemyDamage.STATIC_SWORD_ARM`.

| | |
|---|---|
| Start SHA | `20b2644232` (= `origin/main` at the fetch; ≥ the brief's floor) |
| Head | the commit carrying this report (D1 `ac4de34`, D2+D3 `45e870d`, censuses `a0b5c9d`, the D4 fix `deba3ac`, D5 last) |
| Branch | `claude/seedling-hammer-c1-xioh90` (the harness names it; the brief's `seedling-hammer-c1`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9570` (`SEEDLING_PORT=9570`), PID 626, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (a model divergence found and fixed behind the switch) · D2 PASS · D3 PASS · D4 PASS, STOP at the movers (§D4.4) · D5 PASS** |

## The one thing to know first

**With both switches OFF a sword press on a `SandTrap` or `Turret` is a silent no-op in the model, and the game kills
the body.** The differential cannot see it, because the player's stream is the expectation and nothing the player sees
changes until a contact or a spit does. With `STATIC_SWORD_ARM` ON the model reproduces the game at 0 px on five
witnesses. The two switches only act **together** in a stepped room: the chooser is what hands a static body to the
kill rung there, and the static arm is what kills it. Together they solve sweep legs 544, 550, 551 and 553 (L62's
turret) with no hit. Their movers wait for the user's licence (§D4.4).

## W0 — the base, and both defects reproduced (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-c1-xioh90 origin/main` | `20b2644`; `merge-base --is-ancestor 20b2644232 origin/main` yes |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. `bulletml-dodge` was left `-` again; `git submodule update --init frontend/modules/bulletml-dodge` → `7423ee86` |
| identity block | `SEEDLING_PORT=9570 bash scripts/procgen/identity-block.sh .` | non-`#` lines md5 **`4647e1e050a9e76273ddc937ca301360`** = B3c's, row for row (maze `246dfbce` … r9-campaign `b064c264`, reference ALL 7 + 5 MATCH). ⚠ The run overlapped my first (flag-gated) edits from its ENEMY row on; every row equals B3c's published base anyway, which is the BEFORE quoted (⚖ ruling 32 A) |
| tapeRunner pairs | at a pristine worktree of `20b2644`: `npx vitest run …/tapeRunner.test.js --reporter=json`; `status\tfullName` sorted | **589**, `e6c073f99ac92cd28a56f4a95a17d325` |
| surface / constants / entities / profile | each `--check` at that worktree | GREEN **234** · PASS **5,488** · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | **266** |
| bounded vitest BEFORE | the hammer set + `solverBot`, `solverSpinnerKill`, `combatVerbs` + every non-slow `rg -a` hit for `chooseBodyToRemove\|KILL_ARM_POLICY\|stepped === false\|SandTrap\|sandtrap\|Turret\b` (49 files) | **2510/2510** |

**A, reproduced.** Staging: survey step 61's own view (`survey-seedling-route.mjs --through=end --only=61` writes
`views/step-61-boot.json`: `r8-solve-11`'s block re-pointed at L40 (480,896)), goal `collect:880,816`
(`view-solve.mjs`, the evidence folder). REFUSED in 4.2 s at t0:

> chest (880,816) stance: the combat ladder is EXHAUSTED. The corridor passes through danger at (744.3,723.2) —
> spinner:spinner@880,848 … avoid: … A* goal tile (55,52) … is not walkable: danger:bobsoldier@880,832 … bait: NO LIVE
> BODY's removal admits a corridor … kill: the danger on this corridor is not a body this run can watch die …

**B, reproduced.** Survey step 31 (`--through=end --only=31`): REFUSED LADDER at (63.2,96.8) on `sandtrap@48,80` +
`@64,80`; the avoid line names `sandtrap@64,64` (the brief's text). The sweep legs: the live sweep runs the worker in
the page, so the switches (node env) cannot reach it. `inv-leg.mjs` (evidence) is `seedling-divergence-bare.mjs`'s
`oneLeg` with the sweep row's own `items` queued as item flags before the boot. It is the engine's request path
(`arrivalSolverGoal` → `arrivalSolveRequest` → the in-place produce service) over sweep-3's own delivered set (CI run
`38010249317`, `divergence-merged`). **All nine legs (76, 85, 539, 544, 549–553) reproduce sweep-3's `failed` text
byte for byte** (only the solver's name differs). Legs 76 and 85 hold **no sword** (`items: []`).

## D1 — the game first (PASS; `ac4de34`)

Three hand-built v8 tapes (`r8`'s envelope, `seam.items`, p4f, headless), sampled every tick through `botMobiles()`
(`probe-seedling-static-sword-mobiles.mjs`):

| tape | what the game did |
|---|---|
| L36 boot (48,96) → player (56,104), `up` [0,1), presses [2,3) [33,34) [64,65) | ONE swing reaches **both** `sandtrap@48,80` and `@64,80` (the player 6.3 / 10.3 px off their boxes). Landings at obs **4 / 35 / 66** (a press at tape index p lands at p+2), `hitsTimer` 30 run down by the body's own update, **no knockback**. The 20 px chomp is visual: 0 player hits. "die" (6 frames @ 10) from obs 66, **first update on 67** (the Player updates last), removed at **85**, tags L36 4 and 5 written |
| L62 boot (218,248) → (226,256), `right` [0,1), the same presses; shield and no shield | `turret@232,248` (box [232,248)×[248,264), 4.3 px away): landings 4/35/66; its first shot (seeded `shootTimer` 0) went out at t3 still un-aimed (angle −18°), away from the player. While `hitsTimer` runs **it starts no shot**; at 65 the lapse started one, and the kill at 66 **swallowed it** (`play("die")`). "die" 66 → `destroy` **85** → `Mobile.death`'s fade (α 0.9 at 86) → **removed 96**; no tag. 0 hits in both |

**The model's existing rule vs the game.** The hit test is the sword's own (`slashRect`, `distanceRectPoint ≤ 16`,
`collideLine("Solid")` to the entity point), with `Enemy.hit`'s gates and both classes' empty `knockback`. But **a
static census body was no press responder at all** (`presses.pressRespondersIn` synthesizes Enemy responders only from
the chaser roster), so the model **silently** left every body unhurt. OFF control:
- 106 / 57 / 118 sampled disagreements;
- the no-shield tape OFF takes a **spit hit** the game does not take (OFF the turret is never held off by an i-frame).

**The fix, in the static damage state's region, behind `STATIC_SWORD_ARM`** (`enemyDamage`, `presses`, `levelRun`):
- the two classes are press responders (`statics`);
- the hit lands on F4's `staticBodyStates` row (reach, line, `enemyHit`, and a kill whose removal would open a kill lock is refused by name);
- the turret's death is die → `destroy` → fade (`stepStaticBodiesNow`);
- its fire gate reads the row's `hitsTimer`, live and in `spitForecastNow`; "die" silences it; its contact is the static scan's (`speed 0`; `contactPricing` "mover" is its aggro); its removal writes no tag.

`killArmModelled` reads `modelled` for the two classes through the switch; **`KILL_ARM_POLICY`'s rows are not
edited** (`Bulb`'s row, BULB's, untouched). **ON: 0 disagreements on every sampled tick of all three, 0 hits.** The
game's samples are committed (`fixtures/static-sword-witness/c1-d1-*.json`). BULB's `vetoBody` in `strikePolicy` is
untouched: the static press does not go through the strike policy.

## D2 — the chooser (`CHOOSER_HIT_SOURCES`, OFF) (PASS; `45e870d` + `deba3ac`)

Where `chooseBodyToRemove`'s list is **EMPTY**, the climb admits the probe's own `hit.sources` that an arm can watch
die **and the chooser could not speak for**, in the hit's order (`hitSourceBodies`):
- a live spinner — it has no danger volume, so "its removal admits a corridor" is vacuous;
- with `STATIC_SWORD_ARM`, a `SandTrap`/`Turret` still in the census of a **stepped** room — the chooser never hypothesises a static body there.

⛔ **Never a chaser.** The first cut admitted chasers too. On `r9-solve-16` (L16, solved OFF by DETOUR) it handed
`bob@208,32` to BAIT, the bait dwell was hit, and the producer threw (D4.4). A chaser is in the chooser's hypothesis
set and has a volume, so an empty list already answered for it (`deba3ac`). The trace's ladder rows and the EXHAUSTED
refusal carry the whole `sources` array (`obstacle.sources`, `kind:id`) **only with the switch ON**.

**Empty-list only, or re-order too?** Both are implemented (`mode: 'empty'`, the default, and `'order'`, which puts
the admitted sources first always), and both were measured:

| set | OFF | `empty` | `order` |
|---|---|---|---|
| the generated spinner records (`check-seedling-hammer-monotonicity`, final code): c3 100/102, c6 160/170, c4 116/138, acceptance 19/23, killgate s2/s5/s9 9/9/9, ENEMY 2/2 — **462 records, 424 solved OFF** | as listed | **= OFF in verdict and ticks, every record** (and `c1` = both switches: the same) | **= OFF, every record** |
| L39/L92 legs 371, 372, 373, 368, 714, 715, 716 | solved 5/75/4/5/5/4/11 t | identical | identical |

The two modes do not differ on anything measured, so the smaller one ships as the default: it touches only the climbs
the chooser could not answer. On L39 the ON climbs name the same bodies as OFF (A's "no wrong kill" stands).

## D3 — the static sword arm (`STATIC_SWORD_ARM`, OFF) (PASS)

`killStaticBySword`, asked by the kill rung's `stepped === false` branch **before the ceiling**. The order is the sword
where it reaches, else today's arms: the press needs only a stance and three cadences, the ceiling a presser whose lane
covers the body. The ceiling's refusal then carries the sword arm's why.

**What it reuses and what it bypasses.** It is KILLLOCK K4's in-place shape (`killIceTurretInPlace`), not the spinner
press arm's. A static body is the spinner kill with no hammer and no motion, so the strike schedule's (cell, tick)
search collapses to a stance per side.
- **Bypassed:** `execKillByPress`, `deriveStrike`, `pressEscape`, the approach and the fight (all built on `spinnerForecast`).
- **Reused:** `slashRect`, `SLASH_REACH`, the Solid line (`run.collideLineSolid`), `walkTo` (whose corridor probe prices the approach), `KILL_PRESS_CADENCE` (31: past the 30-tick i-frame), and the end observed on the run (the row dying, then the census no longer holding the body).

**The stance's hazards, priced.**
- **The body's own contact:** the box keeps 8–3 px off it (widest first; L62's turret sits on a one-tile path).
- **The settle** (measured):
  - the arrival coasts (leg 544 coasted into the turret at 3 px);
  - **a press while the sword's `slashTimer` runs is a DASH**: on survey 31 the walk's own strike-policy presses left it running, and the arm's first press dashed the player 2.55 px/tick into `sandtrap@48,80`;
  - so the player stands until still, steps back if within 3 px, and waits the window out.
- **Every other danger at the stance** (`dangerAt`) refuses it.
- **A turret's spit:** `turret.js`'s own `stepTurret`, run on a copy of the live turret with the planned landings writing its `hitsTimer`, finds the fewest waits ≤ 60 with no spit spawned before the kill.
  - From an in-range arrival there is none in the measured cases. A shot held at `shootTimer` 0 fires on the first i-frame lapse, and a non-killing landing does not cancel it.
  - So a carried shield **faced** at the turret (the press faces it; `TurretSpit` dies on `"Shield"`) is the fallback, else a refusal by name.
- **The stance walk keeps the body in its danger:** a `dangerExcept` for it let leg 549's corridor pass through the turret.
- **An untagged sandtrap is not planned:** its death would write out of band, which the model refuses by name (the ENEMY census's corridor room, D4.4).

The executor is guarded tick by tick: a hit or a crossing refuses by name.

## D4 — measured

### 1. The target legs (final code; `inv-leg.mjs` for the sweep legs, `view-solve.mjs` for the stagings)

| leg / staging | OFF | `CHOOSER` alone | `STATIC` alone | both |
|---|---|---|---|---|
| sweep 76 (L6, `sandtrap@160,16`) | REFUSED (bait re-entry; no sword) | = | = | = (the chooser's list holds `bob@112,48`) |
| sweep 85 (L8, `sandtrap@96,128`) | REFUSED (no presser stance) | = | REFUSED + *"the run's `primary` slot holds NOTHING"* | same |
| sweep 539 (L62) | REFUSED t0 | = | = | REFUSED mid-walk: the stance walk's re-plan on L62's pit maze (coarse lattice) |
| sweep 544 | REFUSED t0 | = | = | **SOLVED 233 t, 0 hits** (killed 165, removed 195) |
| sweep 549 | REFUSED t0 | = | = | REFUSED mid-walk (as 539) |
| sweep 550 | REFUSED t0 | = | = | **SOLVED 209 t, 0 hits** |
| sweep 551 | REFUSED t0 | = | = | **SOLVED 220 t, 0 hits** |
| sweep 552 | REFUSED t0 | = | = | the turret killed; REFUSED on `darktrap@112,208` (F1's light arm, another wall) |
| sweep 553 | REFUSED t0 | = | = | **SOLVED 252 t, 0 hits** |
| survey 31 (L36) | REFUSED t0 | = | = | 4 sandtraps killed (48,80 + 64,80 from one stance; 80,80; 64,64), then REFUSED t235 on the chest's own stance walk (it overshoots into the chest's volume: STANCE's family) |
| L62 staging (survey 113's block at leg 551's arrival) | REFUSED t0 | = | = | **SOLVED 220 t**, 0 hits (`c1-l62-turret`) |
| A (L40 → chest) | REFUSED t0 (4.2 s) | past t0 into the spinner press kill; at **t800 after 1,230 s** a 20-min budget cuts it (`l40-A-chooser-on-sites.txt`); no verdict inside 30 min | = OFF | — (no static body) |
| L39/L92 legs | solved | identical | — | — |

### 2. No regressions

- **Monotonicity** (`check-seedling-hammer-monotonicity.mjs`, modes `chooser`, `chooserorder`, `c1` = both added;
  final code): every row's capture reproduces its identity md5, **0 solved→refused, 0 replay mismatches**, and all
  462 records' verdict AND ticks equal OFF in all three modes (§D2; `monotonicity-final.txt`). Generated rooms hold no sandtrap or turret
  (`procgenPalette`'s `sandtrap-room` is retired), so there only the chooser can act.
- **L18 sweep** with both ON: **45/45**, the lengths line md5 `1c019765ddfd7f8d950c7f2a3a61b5f3` (= A4), the row
  lines identical to OFF.
- **The six `--check`s** (identity block, §D4.4).

### 3. L40 cost (measure only; the box carried 2–4 other jobs, load 2.5–4.5 on 4 cores)

Legs through the node arrival path, no budget, a 15-minute cap each:

| leg | OFF | `CHOOSER` ON |
|---|---|---|
| 376 | > 900 s (sweep-3: `failed`) | > 900 s |
| 379 | > 900 s (sweep-3: `timeout`) | > 900 s |
| 382 | 761 s, SOLVED 859 t | 732 s, SOLVED 859 t |
| 394 | 195 s, SOLVED 494 t | 201 s, SOLVED 494 t |
| 398 | 61 s, SOLVED 270 t | 60 s, SOLVED 270 t |

The chooser changes no verdict or length on these, and no wall time beyond the box's noise.

**Where the time goes** (A's staging, chooser ON, `node --cpu-prof`, 424 s; `l40-A-chooser-on-profile.txt`):
- 95.7 % inside `execKillByPress`;
- 78.9 % in `deriveStrike` (re-derived per tick by `nextNow`);
- 68.9 % in `spinnerForecast` → `stepSpinners` → `reflectAxis` → `collides`;
- self time: `levelWorld.liveRectOf` 37.8 %, `collidesSolid` 37.4 %, `plannerBlockerAt` 7.4 %;
- `walkableCells` 17.4 % and `deriveRefuge` 11.4 % inclusive.

That is B2's shape (53 of 71 s in `deriveStrike → spinnerForecast`), now with the forecast's wall collisions
dominating. No perf change was made in this slice.

### 4. ⛔ The movers with each switch ON — STOP here for the licence

| switch | identity rows / producers | unit pins | committed tapes |
|---|---|---|---|
| `STATIC_SWORD_ARM` alone | none: ENEMY `30bcc49c` and r9-campaign `b064c264` equal the base; generated rows hold no static body | only this slice's own "ships OFF" rows | **none**: every roster tape's pair passes (tapeRunner inside the bounded set, 2522/2524) |
| `CHOOSER_HIT_SOURCES` alone | `solve-seedling-r9-campaign --check` exit 1: **six committed TRACES** drift (`r8-solve-6`, `r8-solve-8`, `r9-solve-12`, `-14`, `-16`, `-29`), all by the new `obstacle.sources` field. All 155 other checks pass (every tape). With the field suppressed (a probe, copy + restore) the producer equals the base `b064c264`. ENEMY unmoved | `ropeSword.test.js` (*"climbs AVOID → PULL …"* pins the obstacle `{kind, id}` exactly) | none |
| both | ENEMY census → **`ad84493c`** (the census's turret corridor REFUSED → SOLVED 221 t, kill + collect; nothing else moves); r9-campaign as above | the two above | none |

Measured with the full identity block both ON before the D4 fix (every row but ENEMY and r9-campaign equal; ENEMY
`49302694` and r9's L16 throw were this slice's own defects, fixed in `deba3ac`), then on the final code: ENEMY and
r9-campaign per switch, and the five other producers' `--check`s with both ON — `405d9c4b b76f6483 465a8b46 35456fbc
6cd35fe1`, all exit 0, the base's (`producers-both-final.txt`). The generated rows are the monotonicity census's
captures (§D4.2): equal.

### 5. Game witnesses (PASS)

`fixtures/static-sword-witness/` (`probe-seedling-static-sword-mobiles.mjs --record`, p4f headless): every tick
sampled, **0 disagreements** (player x/y exactly, hits, i-frames, "die", `destroy`, presence, every spit), **0 player
hits on both sides**.

| witness | ticks | what |
|---|---|---|
| `c1-d1-l36-sandtraps-press` | 110 | D1: one stance kills two |
| `c1-d1-l62-turret-shield` / `-noshield` | 110 / 110 | D1 |
| `c1-l62-turret` | 220 | **planned ON** (`plan-seedling-c1-static-sword.mjs`): sweep leg 551's room; the game crosses to L61 |
| `c1-l36-sandtraps` | 218 | **planned ON**: survey 31, four sandtraps; one swing at t13 reached three. Cut 2 ticks after the census removal of the third target (the chest walk after it is residue) |

They are NOT roster tapes: a roster tape replays under the shipped switches, and OFF the turret walk is a refused
contact. They therefore sit beside their samples (K2's and STATICLADDER's shape), and `fidelityStaticSword.test.js`
replays them ON (0 disagreements) and OFF (the control: disagrees, or refuses the contact by name).
`plan-seedling-c1-static-sword.mjs --check` re-derives both planned tapes byte for byte and asserts OFF still refuses
with the survey's / sweep's words. A's L40 leg does not solve inside the measured bound, so it has no witness.

### 6. Mutants (predicted first; copy + restore; no diff after)

| mutant | predicted | measured |
|---|---|---|
| M1 — the admission removed (`admitted = []`), both ON | A refuses again; the turret staging refuses with OFF's words | A: **byte-identical to OFF's refusal** (8.2 s); `c1-l62-turret`: REFUSED, matches the OFF pattern |
| M2 — the turret spit pricing dropped (`wait 0`, no shield requirement) | equivalent on the shielded witness (it already pressed at wait 0 behind a faced shield); on a no-shield staging the dwell takes a spit | shielded witness: SOLVED 220 t, **0 hits** (equivalent). No-shield staging (the witness minus `hasShield`): priced → **REFUSED by name, 0 hits** (*"a spit spawns 40 tick(s) after the stance at wait 0"*); unpriced → **HIT by `spit turret@232,248#2` at run tick 64** |

## D5 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase C1 — the chooser reads the hit; the static sword arm*.
- `seedling-bot.md`: a paragraph after F4's.
- Surface `--write` then `--check`: GREEN 237, the three new imports classified, two unused imports and an unused re-export dropped.
- Constants `--write` then `--check`: PASS 5,506, three literals classified.
- Entities 528 / profile 138 PASS.
- The reference regenerated: ALL 7 + 5 MATCH.
- Bounded vitest AFTER (flags OFF): **2524/2524** (BEFORE's 2510 + the 14 new rows).
- `lint-gate-labels`: 78 findings at head (none in this slice's files); its gate test passes.
- Identity block AFTER (flags OFF, at `deba3ac` + the docs): **every row = the base**, producers included (`identity-after-off.txt`). The reference row read DIFFER only until the docs were regenerated; it is ALL 7 + 5 MATCH.

## Deltas (the base → head, switches OFF)

None in any identity row, tape, producer or pin (§D5). New: `fixtures/static-sword-witness/` (5 samples + 2 tapes),
`fidelityStaticSword.test.js` (14 rows), `plan-seedling-c1-static-sword.mjs`, `probe-seedling-static-sword-mobiles.mjs`,
and the monotonicity checker's four modes.

## What the brief got wrong (measured)

- *"The static kill arm … is the ceiling's ARROWS"* holds, but the larger fact is that **the model has no sword
  damage for a static body at all**: a press on one is a silent no-op, not a refusal.
- *"Sweep legs 76 … 85"*: neither run holds a sword (`items: []`), so no sword arm can move them. They now name the
  sword as the owed sub-order.
- *"The chooser … a source that is a killable body is admitted"*: admitting chasers breaks `r9-solve-16`. Only the
  bodies the chooser's question cannot reach may be admitted.
- *"Relabelling its pricing alone moves nothing"*: right, and with the damage state held the relabel is needed. The
  turret's contact is static only once its i-frames and death are modelled.

## Residue

- 539/549: the static arm's stance walk re-plans from a sub-tile position in L62's pit maze on the coarse lattice. 552: the next wall is F1's darktrap.
- Survey 31: the chest's own stance walk overshoots into the chest's proximity volume (STANCE's family).
- A (L40) solves past t0 but not inside 20 minutes: the spinner press kill's cost (§D4.3).
- With the switch OFF the press divergence stands (fidelity's to flip).
- Not modelled under the switch:
  - an arrow on a turret (unchanged: it stops and takes nothing);
  - a spit already in flight at the stance's arrival (the executor's guard refuses);
  - a press reaching a static class other than SandTrap/Turret (unchanged).
- `check-procgen-help.mjs` lists 25 pre-existing scripts whose `main()` runs on import (none touched by this slice). The base could not be re-run here: the throwaway tree's submodule clone is refused (`transport 'file' not allowed`).

## Rows to BANK

- The two switches' movers (§D4.4), for the user's licence: the six r9 traces + the ropeSword pin (chooser); ENEMY `ad84493c` (both).
- `fixtures/static-sword-witness/` and `fidelityStaticSword.test.js`; `plan-seedling-c1-static-sword.mjs --check`.
- The monotonicity checker's `chooser` / `chooserorder` / `static` / `c1` modes.
