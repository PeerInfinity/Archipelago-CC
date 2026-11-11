# Seedling fidelity FIRESPINNER — a Fire press that reaches a spinner knocks it back (`fireSpinnerArm`, OFF)

Planner `seedling-fidelity-planning-19`, wave 38. ⚖ The user (2026-11-09): *"L39 + Fire arm now (Recommended)"*.

| | |
|---|---|
| start SHA | `2d1283375e` (= main 2d1283375e; 127 keys, 116 default-ON) |
| head | see the last commit on the branch (this report is committed last) |
| harness branch | `claude/seedling-fidelity-wave-38-99f855` |
| evidence | `CC/docs/cloud-reports/seedling-fidelity-firespinner-evidence/` |

## Verdicts

| D | verdict | one line |
|---|---|---|
| W0 | **DONE** | The throw is real, and it is the smaller half: the Fire census tests a spinner's `.oel` PLACEMENT, so a flame on the vacated cell throws and a flame on the BODY silently does nothing |
| D0 | **PASS** | Game witness (p4g, headless, 0 px after D1): knockback, `hits` 0, `hits_timer` 0 on every tick; the placement-only press moves nothing. `hitSpinner`'s Fire branch agrees with the game |
| D1 | **PASS** | `fireSpinnerArm` (OFF, last key, `SEEDLING_FIRE_SPINNER_ARM`): a live-body join in the Fire census + the dispatch arm. OFF byte-identical (identity block, bounded set 111/111). Three other slices' newest-key pins re-admitted (CI found them) |
| D2 | **MEASURED, flip-ready with 2 re-pins** | ON: 3 COMMITTED L39 tapes change in the model, and on the game ON is right (OFF leaves the game at t19 on all three). Bounded set ON: 2 reds (the defaults pin; `r8Acceptance`'s shadow press-exposure). Spinner-room survey steps byte-identical. No solver arm plans a Fire press at a spinner |

**The one thing to know first:** the OFF model has been wrong about the spinners in `r5-press-delay`, `r5-press-glide`
and `r5-press-repeat` since R5. Those tapes' expectations hold the player only, so it never showed. ON reproduces the
game's spinners and fire blocks at 0 px on all three.

## W0 — the trace (no code)

**The claim, verified, with a correction.** `FIRE_ARM_POLICY.Spinner` (`presses.js`) is `modelled`; `levelRun.applyFire`'s
loop over `audit.modelled` has arms for `PushableBlockFire`, `IceTurret`, `BurnableTree` and `RopeStart` only, and its
fallthrough throws. But `fireRespondersIn` builds its targets from `world.pressResponders` with the census rect, and
for a Spinner the census rect is the 7x7 box at the `.oel` cell. The sword census has a live join (`pressRespondersIn`'s
`spinners`); the fire census had none (it has `pushables` and, under `fireLiveTurretReach`, `turrets`). A spinner is a
billiard that leaves its cell on the visit's first tick. So, OFF:

| staging (`r5-shaft` cut, `fidelityFireSpinner.fireSpinnerTape`) | what the flame reaches | the model OFF | the game |
|---|---|---|---|
| press t590, end 680 (`firespinner-l39-knock`) | `spinner@224,112`'s BODY on hit ticks t594–t596 (its cell (232,120) is not in reach) | nothing: hits `[]` on all five hit ticks, no throw | knocks it back |
| press t690, end 720 (`firespinner-l39-phantom`) | the spinner's CELL (232,120); the body is at (155,164), ~80 px off | **throws** at the first hit tick: *"levelRun: `FIRE_ARM_POLICY` calls Spinner modelled and this dispatch has no arm for it. A policy and an executor that disagree is the two-consumers failure, so this throws rather than silently skipping."* | nothing |

The throw is therefore a phantom (the cell, not the body), which is the shape hammer's L39 (B) candidate met.

**The AS3** (`vendor/seedling/src`):
- `Player.fire()` (`Player.as:1014-1044`): on `sprFire` frames 3..6, for `i` in 0..10, `collideRectInto(hitables[i], …, vc)`
  into ONE vector that is never cleared, then the radius cut `FP.distanceRects(…) > sprFire.width / 2` (with the
  player's `originY` substituted for the target's) and `genericHit(e, "Fire", fireForce 0.325, fireDamage 0)`. A Spinner
  is `type = "Enemy"` = `hitables[0]`, so it is dispatched **11 times a hit tick** (`FIRE_DISPATCHES_BY_TYPE.Enemy`).
- `genericHit` (`:1065-1077`): `if (Game.freezeObjects) return;` → `e is Enemy` → `(e as Enemy).hit(f, new Point(x, y), d, t)`
  (the IceTurret bump is the class's one special case).
- `Enemy.hit` (`Enemies/Enemy.as:141-181`): `(hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit` →
  `onlyHitBy == ""` → `hitByFire || t != "Fire"` is FALSE → `knockback(f, p)` only: no `hits +=`, no `hitsTimer =`.
- `Enemy.knockback` (`:247-255`): `a = atan2(y - p.y, x - p.x); v += f (cos a, sin a)` unless `destroy`. A knockback does
  not move the body, so the 11 dispatches add the same impulse 11 times.
- `Spinner.as` overrides none of it (`maxForce` -1, `onlyHitBy` "", `hitByFire` false).

**Every Fire source that reaches a spinner:** only `Player.fire()`. `"Fire"` is dispatched nowhere else (`grep -a -rn
'"Fire"' vendor/seedling/src`): `WandShot` hits with `"Wand"` even from the fire wand (`WandShot.as:116`); a fire block
collides with a spinner (`SPINNER_WEDGE`, already modelled) but does not hit it; `BurnableTree`/`Grass`/`IceTurret`/
`PushableBlockFire` are receivers. `FIRE_ARM_POLICY`'s other rows dispatch through their own arms; ⚠ `BreakableRock` is
`modelled` in `FIRE_ARM_POLICY` and `applyFire` has no arm for it either (see residue).

**Which rooms:** spinners exist in L18, L39, L40 and L92 only (the atlas). In any other room `spinnerFireBodiesNow()` is
`null` and the census has no Spinner row, so the key cannot act there.

## D0 — the game witness (before any model change)

`scripts/procgen/probe-seedling-fire-spinner.mjs [--record] [--on=fireSpinnerArm] [--press= --end= --name=] [--tape=<committed>]`
(box-lock roster row in `boxLock.test.js`; fold `fidelityFireSpinner.js`): a fresh p4g page (`seedling_bot_ap_p4g`,
headless logic-only, port 9780), every poll `botStatus` + `botMobiles` (every Spinner's `x, y, vx, vy, hits,
hits_timer`; every `PushableBlockFire`).

Recorded first with the model unchanged: the knock staging (680 sampled ticks). The game, `spinner@224,112`:

| tick | v (game) | hits / hits_timer |
|---|---|---|
| t594 | (−0.707, −0.707) — its billiard | 0 / 0 |
| t595 | (2.390, 1.079) — knocked | 0 / 0 |
| t596 | (5.177, 2.897) — knocked | 0 / 0 |
| t597 | (8.035, −0.953) — knocked, `vy` reflected off a wall | 0 / 0 |
| t598 | (7.787, −0.924) — friction only (out of the flame) | 0 / 0 |

`hits` and `hits_timer` are 0 on every spinner on every sampled tick. The model OFF parted from the game at t596 (84
bad ticks). This agrees with `hitSpinner`'s Fire branch, so no STOP. **Not witnessed:** the i-frame gate (`hitsTimer > 0`
→ no fire knockback) and the freeze (`genericHit` returns under `Game.freezeObjects`): both need a sword hit or a pickup
ceremony beside a spinner, and no cheap L39 staging has either. Both are `hitSpinner`'s shared gates, which other
sources already exercise.

## D1 — `fireSpinnerArm` (OFF, byte-identical)

- `contactFidelity.js`: the key, LAST in `CONTACT_FIDELITY_DEFAULTS` (128 keys), its doc block, the two env lines;
  `solverEnvChannel.js`: `SEEDLING_FIRE_SPINNER_ARM` in `SOLVER_ENV_NAMES`; `contactFidelity.test.js`: the defaults pin
  gains `fireSpinnerArm: false`.
- `presses.fireRespondersIn` / `auditFire`: an optional `spinners` map (`id → {rect, x, y, removed}`), read only with the
  key ON: a Spinner row is tested at its live body (origin from the entity position), a removed one drops out, its type
  is "Enemy" (11 dispatches). With the key OFF, or no map, the row is exactly the census row as before.
- `levelRun.applyFire`: passes `spinnerFireBodiesNow()` with the key ON (`null` OFF), and an arm before the fallthrough
  throw, `r.as3 === 'Spinner' && CONTACT_FIDELITY.fireSpinnerArm`: `hitSpinner(…, {force: FIRE_FORCE, from: player,
  damage: FIRE_DAMAGE, t: 'Fire', frozen: ceremony !== null})` once per dispatch; the press ledger row is `{as3:
  'Spinner', id, knocked, dispatches, why}`. Same tick order as the sword's Spinner arm (`applyThrust`, the line above).
- No new per-visit run map: the arm writes `spinnerStates`, already in `stateDigestParts`' `visit`. No new run getter.

**Rows** (`fidelityFireSpinner.test.js`, 13; predicted before the arm was written): OFF — the phantom press throws the
text above; the knock press reaches nothing and the model leaves the game at t596. ON — both stagings at 0 px on every
sampled tick (player, spinners with hits and hitsTimer, fire blocks); the knock press is three knocked hit ticks of 11
dispatches, then two empty ones; no damage on either side; the phantom press reaches nothing. Plus the D2 roster rows.

**Mutants** (copy of `levelRun.js` + restore, `cmp` clean after):

| mutant | predicted red | measured red |
|---|---|---|
| m1 the knockback from the mirror point (direction reversed) | the ON knock 0 px row | that row **and** the ledger row (the reversed body leaves the flame on a different tick: my prediction missed it) |
| m2 `t: 'Sword', damage: 1` instead of Fire | the ON knock 0 px row + the no-damage row | those **and** the ledger row (same reason) |
| m3 the arm ungated (`&& CONTACT_FIDELITY.fireSpinnerArm` dropped) | the OFF throw row | exactly that row |

## D2 — the key ON, measured

**Is there a solver arm that chooses this press now?** No new one. The fire-stance planner's stray check
(`solverBot.js` ≈9397: `auditFire(run.world, stance, {pushables, turrets})`, no `spinners`) still tests the placement,
so a stance whose flame reaches a spinner's CELL is refused as before (*"the flame … also reaches spinner@… — a press has
no aim"*), at plan time and in both arms. What changes is EXECUTION: a planned Fire press whose flame meets a live body
now knocks it, as the game does, instead of nothing; and a press on a cell no longer throws. A knocked spinner is
the player's hazard only through its hammer, which `noDamage` tapes cannot price; no row below turned a hitless leg
into a hit-taking one.

**The committed roster, ON vs OFF** (every tape in `fixtures/tapes/` that presses in a spinner room, R8_D2_SHIELD's list
of ten): seven are byte-identical; three change, all L39 block-glide tapes:

| tape | ON Fire→spinner dispatches | the game (p4g, as itself, `--tape=`) | OFF |
|---|---|---|---|
| `r5-press-delay` | t10→17 `spinner@224,112` | **ON 0 px**, 530 ticks (spinners, blocks) | leaves the game at **t19** (511 bad) |
| `r5-press-glide` | t10→17 `@224,112`; t108→112–114 `@112,88` | **ON 0 px**, 410 ticks | t19 (391 bad) |
| `r5-press-repeat` | t10→17 `@224,112`; t108, t192, t276, t318 → `@112,88` (10 knocked hit ticks) | **ON 0 px**, 404 ticks | t19 (385 bad) |

The fire blocks agree in both arms (the wedge is unchanged), and the player path is identical, which is why every tape
pair stays green. Recordings: `fixtures/firespinner-witness/firespinner-r5-press-*.json`.

**The bounded set** (111 fast files = the brief's list + every `grep -a` hit for `FIRE_ARM_POLICY`, `hitSpinner`,
`spinnerBodies`, `fireRespondersIn`, `auditFire`, `applyFire`, + the surface/constants/env tests; list in the evidence):

| arm | result |
|---|---|
| OFF (head) | **111/111 files, 2921/2921** |
| ON (`SEEDLING_FIRE_SPINNER_ARM=1`) | **109/111, 2 reds** |

The two ON reds, both flip re-pins:
1. `contactFidelity.test.js` › *the shipped defaults: all three ON*: `fireSpinnerArm` false → true (the defaults pin).
2. `r8Acceptance.test.js` › *R8_D2_SHIELD — ⛔ the two exposed tapes are DERIVED by driving the roster*: *"`r5-press-repeat`
   KILLS a spinner, and the declaration says the roster kills none."* `spinnerLandingsFor` asks, for EVERY press, whether
   a sword hit would land on a body in the press rect; ON, the bodies are where the game's knockback really put them,
   so the shadow count over `r5-press-repeat` now reaches a third landing on one body. It is a hypothetical about the
   R8 sword arm's exposure, not a model-vs-game divergence; the flip owes `R8_D2_SHIELD.pressExposure` a re-measure
   with the knock (a row in `reachingAdded`, or the prediction re-stated), and `r5-press-glide`'s row should be read in
   the same pass.

The slow/train files in the set (`fidelityL32ArenaPrefix.slow`, `fidelityL40Bk2.train`, `hammerGhostKillRung.train`,
`hammerSpinnerPress.train`), run bounded locally: **OFF** train 3/3 files (10 tests) + slow 1/1 (5); **ON** the same, all green.

**Survey (local, route=full, through=end), the 11 spinner-room steps** (27 L18; 65/95/136/149 L39; 66/96/98/137/150 L40;
86 L92): **byte-identical ON vs OFF** (every row field but the wall time). OFF/ON: 27 SOLVED 467 t; 65 SOLVED 3496 t;
66 REFUSED (ladder-routed collect, unchanged); 86 SOLVED 395 t; 95 SOLVED 3376 t; 96 REFUSED (unchanged); 98 SOLVED 70 t;
136 SOLVED 3376 t; 137 SOLVED 172 t; 149 SOLVED 3253 t; 150 SOLVED 172 t. The other steps cannot move (no spinner in the
room). Files: `survey-{off,on}.txt`, `survey-spinner-rooms-{off,on}.json`.

**Survey/sweep rows this moves: none measured.** "No movers" was the expected answer and is what the survey says; the
sweep and the probe battery need CI (below).

## The dispatches for the planner (I cannot dispatch)

Branch `claude/seedling-fidelity-wave-38-99f855` at the head.

1. **Survey A/B** — `seedling-survey.yml`, `through=end`, `route=full`, on (A) this branch as is (OFF = the base
   defaults) and (B) the same with `fireSpinnerArm: true` as the default (the workflow has no switch input: a one-line
   scratch flip). Expect identical rows; the spinner-room steps are 27, 65, 66, 86, 95, 96, 98, 136, 137, 149, 150.
2. **Sweep ×2 per arm** — `seedling-divergence-sweep.yml`, `shards=10`, `mode=inv`, `producer=solver`,
   `keys=` the 55 spinner-room legs derived at this base (`evidence/keys-spinner-rooms.txt`: L40 48, L39 3, L18 2,
   L92 2; `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`), and
   `contact_fidelity=` (A) `evidence/contact-fidelity-off.txt` (the base's 116 default-ON keys, built fresh from
   `2d1283375e`'s `CONTACT_FIDELITY_DEFAULTS`, md5 `0269ed0d…`) and (B) `evidence/contact-fidelity-on.txt` (the same +
   `fireSpinnerArm`, md5 `be6efed4…`). Run each arm twice; a mover counts only if both repeats agree.
3. **Probes** — `seedling-probe.yml`, `battery=standard`, on the branch (OFF), and once more with the scratch flip.

## The JS arc / hammer arc

- **JS arc:** nothing to wire. No new staging/result field, no new `SolverRefusal.obstacle.kind`; the press ledger's
  Spinner row (`{as3, id, knocked, dispatches, why}`) is new and appears only with the key ON. No `run.*` field renamed or
  reshaped. `solveSegment`/`twoPassSolve`/`createRunForStaging` untouched. JS pins that move: none at OFF.
- **Hammer arc:** nothing edited in its region. Hand-over: L39 (B)'s throw (WALLS-CENSUS-2 §4, *"the full pass throws"*)
  is the phantom placement; with the key ON the press reaches only live bodies, so (B)'s candidate should be re-measured
  under `fireSpinnerArm`. `hammerSpinnerPress.train` / `hammerGhostKillRung.train` / `fidelityL40Bk2.train` ON: green (10/10). No hammer pin moves.

## Deltas, byte-inertia, records

- **Identity block at the head, key OFF** (`identity-head-off.txt`): every row equals the published main values — maze
  `57e07d21`, acceptance **`abb206c88de25e7ba1874510d493ce85`**, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY
  `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`,
  generated set OK; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0.
- Reference regenerated (the new probe: 532 instruments; then its `--tape` flag): `--check` ALL 7 MODULES AND 5 REGIONS
  MATCH. Solver surface `--write`/`--check`: 371 rows, line moves only. Constants census: 7078 literals, 3 new structural
  rows (the arm's loop, `spinnerFireBodiesNow`), `--check` PASS.
- Records: `seedling-bot.md` paragraph; `seedling-bot-log.md` entry; box-lock roster row.
- CI. At `24b72c7b` and `6baa91d2` the push run was red on rows that are mine, each found by CI and not by my bounded
  set: (1) three slices' newest-key pins (`fidelityFrozenPress`, `fidelityCeremony126`, `fidelityRockGone` — each pins
  which keys may FOLLOW its own) — fixed in `6baa91d2` to admit `fireSpinnerArm`; (2) `procgenDocs/docsRender` +
  `generated` (the docs index counts headings, so the log entry staled it) — fixed by regenerating after the last docs
  edit. ⚠ My bounded set missed both families: the newest-key pins are not found by grepping the functions I touched,
  only by grepping for the previous LAST key (`rockGoneFencepost`). The final head's run is quoted in the chat summary.
- `check-procgen-help.mjs --doors=all`: ALL PASS, 532 instruments (the new probe answers `--help` with no side effect).

## What the brief got wrong (measured)

- *"a Fire press that reaches a spinner throws"*: only when the flame reaches the spinner's `.oel` CELL. A flame on the
  BODY does nothing at all (no throw, no knockback). The throw is a phantom; the silent miss is the larger error.
- *"no shipped leg is known to hit it"*: true of the throw, but three committed tapes (`r5-press-delay/-glide/-repeat`)
  have Fire presses that reach a live spinner body, and the OFF model has been off the game's spinners from t19 in all
  three, hidden because their expectations record the player only.
- *"D1: OFF keeps today's throw exactly … rows … the throw at OFF"*: kept, and a fix limited to a dispatch arm would
  not have been enough: without the live join the arm would knock the spinner on the phantom press and never on the
  real one.

## Residue

- `FIRE_ARM_POLICY.BreakableRock` is `modelled` and `applyFire` has no BreakableRock arm either (the same fallthrough
  throw); `genericHit` calls `(e as BreakableRock).hit(hasGhostSword ? 1 : 0)` for every `t`. Not a spinner; not touched.
- The i-frame and freeze gates for a Fire knockback are not game-witnessed (D0).
- The solver's fire-stance stray check still prices spinner PLACEMENTS (in both arms). Making it read live bodies is a
  planner change for a later slice, not part of this arm.

## Rows to BANK

- `fidelityFireSpinner.test.js` (13 rows, default tier, ~2 s).
- `fixtures/firespinner-witness/` — five p4g recordings: `firespinner-l39-knock`, `firespinner-l39-phantom`,
  `firespinner-r5-press-{delay,glide,repeat}`.
- Trap candidate: a committed tape whose expectations are the player only certifies nothing about the bodies it moves.
