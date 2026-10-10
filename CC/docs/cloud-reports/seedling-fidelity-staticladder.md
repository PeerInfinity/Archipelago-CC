# Seedling fidelity STATICLADDER: a darktrap dies to a lit pole, the combat ladder can light one, and K2 has its witness

| | |
|---|---|
| Session | `seedling-fidelity-staticladder` (planner `seedling-fidelity-planning-5`, wave 10, model coverage) |
| Start SHA | `3e0ff8b80f` (main after the hammer arc's B2; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-static-ladder-nzx9wp` |
| Commits | D1 `2d2d25c` · D2 `ab11cd3` + records `a98be5b` · D3 `cd1d82c` · index + witness door `79165b2` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (switch `darkTrapLight` ships OFF; the flip is the user's) · D3 PASS (K2's game witness; ranked residue)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-staticladder-evidence/` |

**The one thing to know first.** The biggest "static enemy" family is the **DarkTrap** (3 survey steps + 15 sweep
legs), and its wall is not missing physics but a missing *death*: `DarkTrap.hit()` is empty, and the body dies when a
lit `LightPole`'s light comes within 28 px. Every failing darktrap sits on a one-tile ghost bridge with a pole beside
it. The model now has that death (game-exact at 0 px on two witnesses, one of them timed by the pole's render bob),
and the ladder has a LIGHT arm: **survey step 115 goes REFUSED → SOLVED (290 t)**. But **14 of the 18 rows hold
neither the Spear nor the ghost sword** — the route reaches L62/L63 before the Ghost Spear — so for them the honest
answer is now a refusal that names the Spear as a sub-order the route owes. That is a route question for the planner,
not a model gap.

## W0 — bank at base (`3e0ff8b80f`)

My start SHA is B2's harvest + its roster commit, so B2's AFTER values are my BEFORE by quotation (⚖ 32 A); the
identity block was also measured here.

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0, python 3.13.16 |
| identity block | `SEEDLING_PORT=9530 bash scripts/procgen/identity-block.sh .` | log md5 `8b6d3065c1a012fb368cc31f58719855` (`w0-identity.log`); maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set `OK` — every row = B2's |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 (= B2's) |
| reference | in the block | 4 DIFFER — environmental (registry, capabilities, substrate-registry, procgen-substrates: the substrate submodules), as B2 saw |
| surface / constants / entities / profile | quoted from B2 (B2's AFTER) | GREEN 227 · PASS 5,443 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | **259** |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json`, md5 over sorted `status\tfullName` | **575** pairs, `8635ad896d8032a29e22ad409ebd1838` (= B2's) |
| bounded vitest BEFORE | quoted from B2 (73 files, 3,171 tests, 3,170 pass, the one red `boxLock`'s load race) | — |

⚠ The identity block's producer rows ran while my first edits were landing (switch OFF); every row equals B2's, so they
double as an early inertia check. The AFTER block below is the clean one.

## D1 — sub-classify (PASS)

Sources: survey CI **38010117701** (13 EXHAUSTED steps: the brief's 8 + the 5 spinner/axe/beam it set aside) and sweep-3
CI **38010249317** (`gh run download`, the merged `rows.jsonl`'s `failed` text): **43** legs (the brief said 42). The
classifier (`evidence/d1.mjs`) reads the blocking body from each refusal, its census row, `isBridgedChaser`,
`contactPricing`, the run's items, and for a darktrap the nearest pole's light distance. Full table:
`evidence/d1-families.md`; per row: `evidence/d1-classes.json`.

| # | family | survey | sweep | what the game does | the rung that should answer |
|---|---|---|---|---|---|
| F1 | **DarkTrap** — weapon-immune static, light death unmodelled | 113, 115, 208 | 537 542 547 555 556 558 559 563 567 571 572 573 574 578 579 (15) | dies when a lit non-player `Light` is within `radiusMin` (a `LightPole`, lit by a `"Spear"` hit); harmless from that tick | KILL: a LIGHT arm (built, D2) |
| F2 | **unbridged mover / shooter at its placement** — Bulb, LavaRunner (Bob subclasses), Drill, Turret | 160, 190 | 626 627 (bulb), 617 622 (lavarunner), 712 713 (drill), 539 544 549 550 551 552 553 (turret) (13) | Bulb/LavaRunner chase; Turret is `speed 0`, sword-killable, priced "mover" only because its aggro is `static-shooter` | bridge then bait/kill; Turret: a static sword arm |
| F3 | **SandTrap without a static sword arm** | 31 | 76 (L6), 85 (L8, a refused room: the ceiling's presser has no reachable stance) (2) | `Enemy.hit` (hitsMax 3) | a static SWORD arm |
| F4 | bridged chaser, not static | 63 (puncher) | 201–205, 207, 208 (L16 bob) (7) | — | not this region |
| F5 | other arcs | 150 159 181 202 204 (axe/beam), 210 (crusher) | 752; 395 412 (L40 spinner); 333 339 (L30 BobSoldier); 779 (crusher) | — | hammer arc / BOBSOLDIER2 / CRUSHER_BAIT |

**Step 210 / leg 779 (L107):** `crusher@32,0 (trigger lane S, clear sight line, LIVE centre 48,16)` on the hold-stance
walk to `buttonroom@288,176`. The crusher is a live stepped hazard and no static row is involved: a **bait/timing gap
(CRUSHER_BAIT's)**, not a ladder static-body gap.

## D2 — the DarkTrap's light death, and the LIGHT arm (PASS; switch OFF)

**Measured on the AS3 (`DarkTrap.as:27-54`, `SandTrap.as:82-86`, `Scenery/LightPole.as:41,59-67,77-115`, `Light.as`,
`Player.as:1103-1108`):**
- `DarkTrap.update`: for each `Light` not a `PlayerLight`, `FP.distance(x, y, light.x, light.y) <= light.radiusMin &&
  !light.darkLight && !startDying` → `startDying`. Then `if (startDying) { deathCounter-- … else play("die1") } else
  super.update()`. So from that tick `Enemy.update` (and `hitPlayer`) never runs: the body is **harmless**. 30 ticks,
  then "die1" (14 frames, rate 10), `endAnim` removes it, `SandTrap.removed()` writes the tag. `hit()` is empty.
- The pole's light: `new Light(x, y, 100, 1.5, c, true, 28, 32, 0.5)` (`radiusMin` 28), lit while `activate` XOR
  `invert`. `LightPole.render` sets `y = startY - originY + 2·sin(2π·(Game.time % 45)/45)` and `myLight.y = y`: the light
  rides at (`.oel` x + 8, `.oel` y + bob). `LightPole.hit()` toggles, and `Player.genericHit` calls it only under
  `t == "Spear"` (the Spear's thrust; the ghost sword's swing also passes `"Spear"`).
- Every failing darktrap is 14–24 px from its pole's light, except L101's (27.2–30.5 px: in range only while the bob is low).
  No torch/orb light is within 48 px of any of them.

**The change (`contactFidelity.darkTrapLight`, OFF = byte-identical):**
- `enemyDamage.DARKTRAP_LIGHT_DEATH` (the row above, with sources).
- `levelRun`: `darkTrapStates` (per visit) and `stepDarkTrapsNow` in the static-body slot (above the player, so it reads
  the pole the previous tick left, as the game's update order does); the light's y from `clock.now()` (the render runs
  after `Game.update`'s clock tick); a band that straddles 28 px with no clock is **refused by name**; the contact
  gate (`contactsSuppressed`, why `startDying skips super.update()`); the removal through F4's pending-removal path
  (despawn, the tag's declared/scratch/earned write); a kill-lock ledger guard; `run.darkTraps` (each body with its
  poles' lit state and distance band; `null` while OFF).
- `dangerMap`: a dying or removed darktrap is not priced (both static sites).
- `solverBot`: the kill rung's no-target branch asks a **LIGHT arm** (`deriveLightPole` + an executor in
  `climbLadder`): a lit pole → wait for the bob; unlit → a Spear stance (tile centres and the 8 px lattice's nodes)
  whose `spearRect` meets the pole's bob-invariant core and nothing else, the player box clear of the body and of any
  solid, reached by `stanceReaches` or the `FINE_LATTICE` plan; walk, settle, a one-tick face tap, equip the Spear,
  one `primary` tick, wait (bound 50) for `startDying`, restore the slot, return `{escalations}` (re-plan). A re-entry
  is refused (`LIGHT_REENTRY`). No sword/Spear → the refusal names the sub-order; ghost sword only → named, not
  authored (GHOSTMOTION's region).
- The door (`solverView`): `spearRect`, `DARKTRAP_LIGHT_DEATH`; the surface rows classified.

**Game witnesses (p4f, headless logic-only, `SEEDLING_PORT=9530`), new instrument `probe-seedling-darktrap-mobiles.mjs`:**

| witness | what | game | model | comparisons |
|---|---|---|---|---|
| `staticladder-l62-step115-light` | survey step 115's solved walk: stance (124,172) below the planttorch, a Spear thrust S at `lightpole@120,200`, the corridor through `darktrap@112,208` | "die1" t169, removed by t211, 0 hits, player exact 290 t | `startDying` t139, "die1" t169, removed t211 | 211 body rows, 0 disagreements |
| `staticladder-l101-light-bob` | L101, Spear no ghost sword, a thrust N at `lightpole@144,64` from (152,88): the light reaches `darktrap@160,80` only at `Game.time % 45 == 4` | "die1" t68, removed by t110, 0 hits | `startDying` t38, "die1" t68, removed t110 | 110 body rows, 0 disagreements |

`fixtures/darktrap-witness/*.json` holds each tape (embedded — the roster replays under the default model, where the
switch is OFF and the L62 walk is a hit) and the game's rows; `fidelityDarkTrap.test.js` (10 rows) replays them and
pins the timelines, the OFF non-reproduction, the boot-lit death (dying t1, "die1" t31, removed t73 with its tag), the
danger map's exclusion and the clock-less refusal.

**Mutants** (predicted, then made by copy + restore of `levelRun.js`/`enemyDamage.js`):

| mutant | predicted | measured |
|---|---|---|
| M1 the light's clock one tick early (`now − 1`) | L101 red; L62 green (in range at every phase) | ✔ L101 witness + timelines red, L62 green |
| M2 a dying darktrap still bills contact | L62 red (the walk crosses it); L101 green; OFF row green | ✔ exactly |
| M3 `deathCounter` 29 | both witnesses red | ✔ both + the timelines + the boot-lit row |
| M4 the light's x without the +8 | L101 red (never in range); L62 green | ✔ L101 + timelines + the clock-less band row (its band moves) |

**Movers with the switch ON** (all measured here):

| what | OFF | ON |
|---|---|---|
| tapeRunner (575 pairs) | `8635ad89…` | `8635ad89…` — **no committed tape replay moves** |
| six producer `--check`s | B2's six | the same six digests, exit 0 (`evidence/producers-on.txt`) |
| 73 planner `--check`s | `evidence/planners-off.txt` | **identical, row for row** (66 exit 0; 6 exit 1 are pre-existing — the same at base in a `3e0ff8b80f` worktree; `r7-ends-meet` skipped, its browser leg hardcodes :8000, as B2 did) |
| survey steps in darktrap levels (L62/63/65/101: 113 115 145 146 148 149 180 202 208 213) | `evidence/survey-darktrap-levels-off.json` | 113, 115, 208 move; the other 7 byte-identical |

## D3 — K2's lavarunner game witness (PASS) and the ranked residue

The brief: *"K2 is OFF until a LAVARUNNER GAME WITNESS exists … if step 190's lavarunner is measured on the game, record
that witness."* With `SEEDLING_KILLLOCK_BODIES=all` (the defaults + K2) **step 190 SOLVES (666 t)**, and its walk —
L80's chest past `lavarunner@0,96`, then on into L71, killing three lavarunners — is **game-exact**: new class-parametric
instrument `probe-seedling-chaser-mobiles.mjs --class=LavaRunner`, 667 sampled ticks, **1,050 body comparisons
(position, velocity, `hits`, `hits_timer`, presence), worst |Δ| 0**, the player exact.
`fixtures/chaser-witness/staticladder-k2-step190-lavarunner.json` + `fidelityLavaRunner.test.js` (K2 ON reproduces, K2
OFF does not; mutant `walk: 1.5 → 1.4` red as predicted). K2 still ships OFF.

K2-ON movers (measured): survey 158 (L71: the kill arm now reaches the lavarunner and stalls: *"lavarunner@64,224 is
still in the world after …"*), 160 (L74: still the bulb, the text moves), 189 (L71, as 158), **190 REFUSED → SOLVED 666
t**, 200 (L99: *"the count is still waiting on [3 lavarunners]"*); 162, 170, 191 identical (`evidence/survey-k2-levels-*.json`).
tapeRunner 575 / `8635ad89` unchanged.

**Ranked residue (what is left of the 13 + 43, with the evidence):**
1. **The Spear sub-order — 14 darktrap rows** (113; legs 537 542 547 555 556 558 559 563 567 571 572 573 574): the run
   holds neither the Spear nor the ghost sword. The route/AP order, not the model.
2. **Turret's static sword arm — 7 L62 legs** (539 544 549 550 551 552 553): `turret@232,248` stands on the one-tile
   bridge to L62's bottom-right exit; `speed 0`, `KILL_ARM_POLICY.Turret` refused, spit stepped. Needs a sword press on
   a static census body plus the spit timing on the approach. (`contactPricing` calls it "mover" because its aggro is
   `static-shooter`; the price is still its placement, so relabelling alone moves nothing.)
3. **Step 208 (L101) — the ghost sword's swing on the pole**: the Ghost Sword fusion consumed the Spear slot, so the
   pole needs the ghost-sword swing (`t == "Spear"`), whose rect/motion is GHOSTMOTION's; whether a stance east of the
   darktrap reaches the pole was NOT measured (the arm refuses on the weapon first). Hand-over below.
4. **Bulb's bridge — 160, 626, 627 (L74, the Darkshield chain)**: a Bob subclass (0.65, hitsMax 1) whose death turns its
   tile to lava for the visit; needs a CHASERS row, the lava write and a witness.
5. **SandTrap's static sword arm — 31, 76** (and 85, whose room's ceiling stance is unreachable): F4's static damage state
   exists; the sword press on it is refused (`KILL_ARM_POLICY.SandTrap`), a shared row.
6. **The drill in a mixed room — 712, 713 (L91)**: `drillLive` steps a drill only when it is the room's sole enemy; L91
   has three bobs too.
7. **K2's own residue** (with K2 ON): L71's lavarunner kill stalls (158, 189), L99's count (200).

## The survey / sweep rows this moves (before → after)

| row | before (base) | after, switch OFF (shipped) | after, `darkTrapLight` ON | after, K2 ON |
|---|---|---|---|---|
| survey **115** (L62 → L61) | REFUSED (ladder) | identical | **SOLVED 290 t**, 0 hits; game-exact | — |
| survey 113 (L62 → L64) | REFUSED (ladder) | identical | REFUSED, + *"light arm: … this run holds NO Spear ⇒ the Spear is a SUB-ORDER the route owes"* | — |
| survey 208 (L101 → L102) | REFUSED (ladder) | identical | REFUSED, + the ghost-sword line | — |
| survey **190** (L80 chest) | REFUSED (ladder, lavarunner) | identical | identical | **SOLVED 666 t**, game-exact |
| survey 158, 160, 189, 200 | REFUSED | identical | identical | REFUSED, new reasons (above) |
| sweep legs 578, 579 (L63 darktrap@32,272, Spear held) | failed (ladder) | identical | predicted solvable by the light arm (not measured: the sweep runs the PAGE, which has no switch hook) | — |
| the other 13 darktrap legs | failed (ladder) | identical | predicted: refusal naming the Spear | — |
| sweep legs 617, 622 (lavarunner) | failed (ladder) | identical | — | predicted to move (the K2 bridge); not measured (page) |

**CI dispatches for the planner** (I cannot dispatch: 403):
1. `seedling-survey.yml` on `claude/seedling-static-ladder-nzx9wp`, inputs `through=end`, `route=full`,
   `only=113,115,145,146,148,149,180,190,202,208,213`, `base_run=38010117701` — confirms the shipped default (OFF) is
   identical to the base on CI (expected: every row identical).
2. After a licensed flip of `darkTrapLight` (and/or K2) on a branch: the same dispatch — expected 115 SOLVED (and 190
   SOLVED with K2), the rows above.
3. `seedling-probe.yml` on the branch, `probes=probe-seedling-darktrap-mobiles.mjs`,
   `args=--witness=staticladder-l62-step115-light` (then `--witness=staticladder-l101-light-bob`), and
   `probes=probe-seedling-chaser-mobiles.mjs`, `args=--class=LavaRunner --witness=staticladder-k2-step190-lavarunner`
   (⚠ the chaser probe's model side needs `SEEDLING_KILLLOCK_BODIES=all` in the job's env; without it it runs K2 OFF
   and reports the divergence) — re-witnesses on the CI runner.
4. `seedling-divergence-sweep.yml` only after the flip (the page and its worker run the defaults by design).

## What the JS arc must wire / its pins

Nothing moves for the JS arc while the switches are OFF (byte-identical, the page runs defaults). After a flip:
- the solve worker needs no new field: the light arm uses existing verbs (`walk`, an `equip`, one `primary` tick, idle
  ticks) and the existing `equips` channel; the trace gains `strategy: 'kill', arm: 'light'` rows and the records a
  `{arm: 'light', target, pole, stance, pressTick, dyingAt, restoredSlot}` row;
- **a pole press writes a persistence flag** (`{62,0}` on step 115: `LightPole.set activate`), banked by the run's
  ledger as `by: 'lightpole'` — an earned clear the segment's declarations must carry like any other game-written
  clear; and the darktrap's own removal writes its tag (`staticBodyDeaths`, `write: 'earned'` in a survey run);
- no `SolverRefusal.obstacle.kind` is new (the arm refuses with `kind: 'danger'`).

## Hand-over to the hammer arc / other regions

- Hammer arc: nothing.
- GHOSTMOTION: step 208's pole needs a ghost-sword SWING aimed at `lightpole@144,64` (the Spear slot is consumed by
  the fusion). `deriveLightPole` names it; the arm could take a ghost-sword stance once the swing's rect and motion are
  modelled there.

## Deltas (shared tables, rows ADDED only)

`CONTACT_FIDELITY.darkTrapLight` (new key, OFF); `enemyDamage.DARKTRAP_LIGHT_DEATH` (new export); `ENTITY_FAMILY_NAMES`
+ `darkTraps` and its `FAMILY_BLOCKS` row; `solverView` + `spearRect`, `DARKTRAP_LIGHT_DEATH`. Not touched:
`OBSTACLE_STRATEGIES`, `DEADLINE_SITES`, `KNOWN_STRATEGY_VERBS`, `KILL_ARM_POLICY`, `surveyFamily.FAMILY_RULES`, the
signatures of `solveSegment`/`twoPassSolve`/`PendingDeclaration`/`createRunForStaging`.

## What the brief got wrong (measured)

- **"8 survey steps refuse … static Enemy"**: the static-enemy rows are 6 (31, 113, 115, 160, 190, 208) plus 63 (a
  bridged puncher) and 210 (a live crusher): neither is static. **13** survey steps are EXHAUSTED in all.
- **"42 legs"**: 43 (`rows.jsonl`); and the family spans more levels than listed (L6, L8, L16, L30, L40, L62, L63, L72,
  L74, L91, **L101**, L107).
- **"bulb/lavarunner (static body, priced mover)"**: neither is static in the game — both are `Bob` subclasses that
  chase; the model prices them at their placement because nothing bridges them (K2 now has a witness for the
  lavarunner).
- **"likely: bridge the unbridged static classes so the danger map sees their real hit volumes and timing"**: for the
  biggest family the volume was already exact; the missing mechanism was the body's DEATH (a light), and the wall
  behind it for 14 of 18 rows is an ITEM the route lacks.

## Byte-inertia (switch OFF, the shipped default)

| row | value |
|---|---|
| identity block AFTER (the D3 tree `cd1d82c`, plus the probe-only `--witness` edits) | log md5 **`8b6d3065c1a012fb368cc31f58719855` = W0's**, every row identical (`diff` empty) |
| tapeRunner | 575 pairs, `8635ad896d8032a29e22ad409ebd1838` (= base) |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, exit 0 (= base) |
| survey steps in the darktrap and K2 levels, OFF (18 steps) | every verdict, tick count and refusal = CI 38010117701's (the step label aside) |

## Records

| row | result |
|---|---|
| surface | `census-seedling-solver-surface --write`; 4 rows classified (`world:pressResponders`, `world:walkableTiles`, `import:DARKTRAP_LIGHT_DEATH`, `import:spearRect`) → **GREEN 231** |
| constants / entities / profile | 8 literals classified → **PASS 5,478** · PASS 528 · PASS 138 |
| entity blocks | `darkTraps` row; the doc section in `seedling-solver-surface.md` |
| reference | regenerated (two new instruments, the docs index); `--check` = the base's 4 environmental DIFFERs; `check-procgen-docs` ALL CHECKS PASSED |
| `check-procgen-help` | 25 FAIL, none mine (pre-existing import-side-effect rows); the new probes pass |
| bot log / bot doc | `seedling-bot-log.md` STATICLADDER entry (D1–D3, trap candidates); `seedling-bot.md` (the light death, the arm, the witnesses) |
| roster / tape index | unchanged (259): the witnesses are embedded fixtures, not roster tapes |
| `boxLock` | both new instruments in the guarded list; 26/26 |
| bounded vitest AFTER (switch OFF) | **62 files, 2,143 tests, 2,143 pass**, md5 `92beec6163792174b3144d3cf9c9ebf3` (the brief's standing set + every `rg -a` hit for what I touched — `CONTACT_FIDELITY`, `staticEnemyDanger`, `ENTITY_FAMILY_NAMES`, `darkTraps`, `spearRect`, `solverView`, the refusal text, `contactsSuppressed`, `pressResponders`, `LightPole`/`darktrap` … — + `fidelityDarkTrap`, `fidelityLavaRunner`); tapeRunner separately: 575, `8635ad89` |
| CI (`JavaScript Unit Tests`) | `cd1d82c`: 3 red (`procgenDocs/generated.test.js`: the instruments index regenerated before the chaser probe was tracked) → fixed in `79165b2`: run **38067223344 success**, vitest (unfiltered) **19,342/19,342**, slow battery 252/252. This report commit is docs-only (`CC/docs/cloud-reports/`). |

**Trap candidates** (in the bot log): a light placed by `render()` and read by an `update()` a frame later; a census rect
that is a union over a bob; an 8 px lattice that lets a stance through a solid.

## Rows to BANK

- `darkTrapLight` OFF; witnesses `staticladder-l62-step115-light`, `staticladder-l101-light-bob`,
  `staticladder-k2-step190-lavarunner` (embedded); `fidelityDarkTrap` 10 rows, `fidelityLavaRunner` 3 rows.
- Surface GREEN 231; constants PASS 5,478; ENTITY_FAMILY_NAMES 28.
- Licence questions for the user: flip `darkTrapLight` (movers: survey 113/115/208 only; no tape/producer/planner moves)
  and K2 `lavaRunnerLive` (movers: survey 158/160/189/190/200; no tape moves).
