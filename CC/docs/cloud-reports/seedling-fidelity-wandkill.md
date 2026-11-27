# Seedling fidelity WANDKILL (wave 71) — `wandShotKill`

Session `seedling-fidelity-wandkill` (planner `seedling-fidelity-planning-26`, wave 71). ⚖ GO: Robert, 2026-11-27
(*"All of these in parallel, if possible."* — option "Draft W71: the wand kill"), and the launch GO.

| | |
|---|---|
| start (base) | `48824c3310442d26097108134d4c05e2a4363eaa` — wave 68's final tip (`W68 wandShotEnemyBodies: the report (PASS)`) |
| head | this report's commit (the last); the last CODE head is `@@CODEHEAD@@` |
| harness branch | `claude/wand-shot-kill-model-jn9a5p` (local `seedling-fidelity-wandkill`) |
| verdict | **@@VERDICT@@** — one key, default OFF, byte-identical OFF; all five killable classes covered (Turret, SandTrap, LavaTrap, WallFlyer, Drill), the IceTrap confirmed unkillable; nine game witnesses match at every sampled tick ON |

## The one thing to know first

**The kill and its Explosion are the game's in all nine witnesses, but the Explosion's PLAYER half is derived, not
witnessed.** In every stance that still lands six shots, the player is outside the blast's prefilter square: a closer
stance takes the body's contact and is knocked back. So the `Player.hit(null, 4, p, 1)` arm is modelled from the bomb's
and totem's `Explosion.added()` player arm (which IS witnessed). Mutant M1 (drop the player half) turns no row red.
Treat it as residue until a stance with the player in the disc is found. The second-body half (`Enemy.hit(4, p, 1)` on a
neighbour) is **refused by name**: it is unwitnessed, and no census pair is inside a disc (the nearest is 16 px).

## Counts at the head

| | base (W68) | head |
|---|---|---|
| `CONTACT_FIDELITY` keys | 157 | **158** |
| ON by default | 126 | **126** |
| last key | `wandShotEnemyBodies` | **`wandShotKill`** (OFF) |
| `SOLVER_ENV_NAMES` | 254 | **255** (`SEEDLING_WAND_SHOT_KILL`, sorted, unique) |

## D1 — the census, the witnesses, the map

### The game (AS3, read)

- `Enemy.hit` (`Enemy.as:141-181`): the sixth landed plain-wand hit (`damage` 0.5, `hitsMax` 3, each behind the last
  one's 30 i-frames) reaches `hits >= hitsMax` → `startDeath(t)` with `t = "Wand"`.
- `dieEffects("Wand")` (`:204-205`): `new Explosion(x, y, ["Player","Enemy"], max(width, height), 1)`.
- `Explosion.as`: the ctor takes **int** x, y, r; `radius *= 0.65` lands in an int → **10** (Turret, SandTrap: 16),
  **9** (WallFlyer: 14), **6** (Drill: 10). `sprExplosion.angle = Rng.cos()*360` is read only by the render: under split
  it draws the cosmetic stream, unsplit it is `Math.random`, which only the Owl's draw stream counts. **Cosmetic — NOT
  modelled** (⛔ the standing rule).
- `Explosion.added()` runs in end-of-tick `updateLists`: the prefilter square (`collideRectInto`), then the
  origin-to-origin disc `FP.distance <= radius`; `Player.hit(null, 4, p, 1)` and `Enemy.hit(4, p, 1)` with `t = ""`.
  A body the blast kills runs `dieEffects("")`, which adds nothing: **no chain blast, by source**.
- Per class: **Turret** `play("die")` + dieEffects; `endAnim` sets `destroy`; `Mobile.death` fades and removes it.
  **SandTrap** `play("die")` + dieEffects; `endAnim` removes; `removed()` writes `setPersistence(tag, false)`.
  **LavaTrap** `play("die")` only (6 frames at `chompAnimSpeed` 10); its `update` returns before the tongue; `endAnim`
  removes; no tag; `hitPlayer` empty. **WallFlyer / Drill** `play("die")` + dieEffects (W6's and drillLive's deaths).
  **IceTrap** `canHit = false`: nothing a hit can change.

### The witnesses (the game, p4g; `scripts/procgen/probe-seedling-wandkill.mjs`, recorded in `fixtures/wandkill-witness/`)

Six presses at ticks 4, 36, 68, 100, 132, 164; 230 ticks (icetrap-six: 200).

| witness | level, stance | kill | "die" to | `destroy` | gone | blast r | player hit | verdict |
|---|---|---|---|---|---|---|---|---|
| (a) turret-kill | L59 (120,64) → right | t175 | 192 | 193 | by 204 | 10 | 0 | GAP → closed |
| (a) turret-kill-l65 | L65 (32,112) → right | t175 | 192 | 193 | by 204 | 10 | 0 | GAP → closed |
| (a) sandtrap-kill | L16 (80,32) ← left | t174 | 191 | — | 192 | 10 | 0 | GAP → closed; clears {16,2} |
| (a) sandtrap-kill-l36 | L36 (64,112) ↑ up | t174 | 191 | — | 192 | 10 | 0 | GAP → closed; clears {36,5} |
| (a) lavatrap-kill | L108 (128,216) ↑ up | t178 | 195 | none | 196 | none | 0 | GAP → closed; no tag, no Explosion |
| (a) wallflyer-kill | L27 (192,16) ↓ down | t175 | 186 | 187 | 198 | 9 | 0 | GAP → closed |
| (a) wallflyer-kill-l22 | L22 (128,40) ↓ down | t178 | 189 | 190 | 201 | 9 | 0 | GAP → closed |
| (a) drill-kill | L88 (68,160) → right | t185 | 202 | 203 | by 214 | 6 | 0 | GAP → closed |
| (f) icetrap-six | L46 (208,328) ← left | never | — | — | — | — | 0 | **NO GAP**: hits 0 throughout (`canHit = false`) |

- The turrets' shots stop at 15/47/79/111/143/175, and no spit follows the kill.
- The sandtraps' tags are read only by the SandTrap itself (`SandTrap.check()` on re-entry). The probe checks that the
  persistence the game cleared equals the model's static-death writes.
- (b) **the player inside the radius — unwitnessed.** In L59 the player can't move past x 128.8; the stance searches
  near the bodies found no case with the player in the square (contact knocks the player back). Modelled by derivation
  from the bomb/totem `Explosion.added()` player arm. Pinned only as "inSquare false, hitPlayer false" in every witness.
- (c) **a second body in the disc — unwitnessed, refused by name.** Census: no census body is inside a killable
  body's disc; the nearest origins are 16 px off (L16, L25, L36, L53). L36's three neighbours reach the prefilter square
  of sandtrap@64,80's blast, and the disc rejects all three (a row pins that).
- (d) **the chain — impossible by source** (`dieEffects("")`).
- (e) **the LavaTrap's tongue — not stepped in the run.** The run has no tongue to end. `levelWorld.avoidVolumesAt`'s
  static chomp disc is a PLANNER avoid-volume read by `botDriverV2.js` (solver side) — hand-over (below).

### The map (the six classes' levels)

L6, L8, L16, L22, L25, L27, L28, L29, L36, L45, L46, L53, L54, L59, L62, L65, L77, L78, L80, L88, L91, L108.

## D2 — the key

`wandShotKill: false`, the LAST key of `CONTACT_FIDELITY_DEFAULTS` (`contactFidelity.js:2701`, doc block from
`:2665`); env `SEEDLING_WAND_SHOT_KILL=0|1` (`:3171-3172`); `SOLVER_ENV_NAMES` entry between
`SEEDLING_WAND_SHOT_ENEMY_BODIES` and `SEEDLING_WAND_SHOT_TRAP_BODIES`.

**The doc block** cites the game (above), names the nine witnesses and their numbers, states ON, lists the refusals, and
says: **REQUIRES `wandShotEnemyBodies`** (alone it reaches nothing; a row pins that the press is refused with the
shipped text, "cannot place: turret@152,64."), and ⛔ OFF by default.

**ON** (`levelRun.js`, all of it unreachable OFF):
- `applyWandShotToEnemyBody`: a killing hit goes to `stageWandKill` instead of wave 68's refusal (OFF: the refusal,
  unchanged).
- `stageWandKill` stages the class's own death at `t = ticksCompleted + 1`: Turret and SandTrap on F4's static row (the
  arrow/sword death's `dieAnim` spec; `stepStaticBodiesNow`, `pendingStaticRemovals` and the tag write do the rest);
  LavaTrap on the wand row (`WAND_KILL_LAVATRAP_DIE` {6 frames, rate 10}, stepped by `stepWandKillLavaTrapsNow`, removed
  with no tag write); WallFlyer through `stageWallFlyerKill(…, 'wand', …)`; Drill through `stageDrillKill(…, 'wand')`.
  Each kill passes `assertWandKillLedger` (the sword arm's kill-lock ledger, mirrored).
- The Explosion (`WAND_KILL_BLAST` {force 4, damage 1, coeff 0.65}) is queued and drained in the `updateLists` block,
  before the bomb blasts (`drainWandKillBlastsNow`): the prefilter square, then the disc; the player half via
  `applyPlayerHit({ source: 'wandKillBlast', force: 4, damage: 1 })`; a second body that reaches the disc **throws by
  name** (WANDKILL); a spent body and the IceTrap are skipped. No cosmetic RNG is drawn.
- New run getters: `wandKills`, `wandKillBlasts`, `wandKillLavaTraps` (no solver reads them: the surface census rows are
  unchanged, only counts and lines moved).

**The rows.** `fidelityWandKill.test.js` (fast tier, 37 rows): the key (OFF, last, env sorted); REQUIRES; the
recordings match the probe; per witness ON = the game + the persistence, OFF = wave 68's refusal (IceTrap: no error,
hits 0); the measured numbers per class; the radii 10/10/9/6; the census pin (nearest 16 px); L36's neighbours in the
square, out of the disc; the second-body refusal (a staged neighbour 8 px west of L16's sandtrap@48,32); the player
beside a body (4 stances that kill, all `inSquare` false); five composition rows (both wand keys + the last OFF keys).
`fidelityWandKill.slow.test.js`: every committed tape, three arms (alone; both wand keys; both + the last OFF keys) —
3/3, n > 300, **0 movers**.

**Key-order pins**: 31 files `'wandShotEnemyBodies']` → `'wandShotEnemyBodies', 'wandShotKill']`; NestedRockCeremony
`slice(-10)` → `-11`, FreezeSpanUpdates `slice(-11)` → `-12`; `contactFidelity.test.js`'s defaults object; wave 68's
"last key" row → `slice(indexOf(KEY)+1) == ['wandShotKill']`. 34 files, 696 rows green.

### Mutants (predicted, broken on a copy, restored — `cmp` verified)

| mutant | predicted | red |
|---|---|---|
| M1 no player half | 0 (unwitnessed) | **0** — the residue named above |
| M2 `dying = false` after the kill | the static kills | 6: turret ×2, sandtrap ×2 ON + 2 composition rows |
| M3 no Enemy half | the second-body row | the second-body row only |
| M4 the lava "die" not stepped | lavatrap-kill | lavatrap-kill ON + its composition row |
| M5 `radiusCoeff` 0.7 | the radius row | the radius row + the second-body row |

## D3 — measurements

- **Byte-inertia**: `git diff --diff-filter=MD 48824c33..` over fixtures/tapes/rules/AS3/wasm/gitlinks — **EMPTY**.
  Added: the nine `wandkill-witness` fixtures.
- **Acceptance md5** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): base, head OFF, KILL=1, KILL+ENEMY,
  KILL+ENEMY+TRAP — all **`391322d681b7aa0229d94b3f6906d024`** (the standing value).
- **Every committed tape OFF vs ON**: 0 movers in all three arms (the slow file).
- **The fast ON sweep** (KILL + ENEMY + TRAP = 1; 473 fast subject files; 12195 tests: 12187 passed, 7 failed, 1
  pending). The movers:

  | file:row | class |
  |---|---|
  | `contactFidelity.test.js` "the shipped defaults: all three ON" | OFF-contract |
  | `fidelityWandEnemyBodies.test.js` "ON: a hit that KILLS refuses by name" | OFF-contract (game-witnessed by turret-kill) |
  | `fidelityWandTrapBodies.test.js` "…a residue class still refuses by name (L59: turret)" | OFF-contract (wave 68's mover, again) |
  | `boxLock.test.js` (the import-door list) | not this key — the new probe; fixed (`713b0478`) |
  | `procgenDocs/generated.test.js` ×2 | not this key — the reference regeneration; fixed (`713b0478`, `085aba4e`) |
  | `standingValues.test.js` "a gate that sleeps past the deadline is KILLED" | not this slice — red at the base in this container |

- **The slow/train ON sweep** (the 47 subject `.slow.`/`.train.` files, one at a time, same three keys ON):
  **47/47 files green, 227 rows** (33 `.train.`, 14 `.slow.`; the hammer train pins, `fidelityWandEnemyBodies` /
  `fidelityWandTrapBodies` / `fidelityWandKill` slow, the strategySwitch slow rows,
  `derive-seedling-wallflyer-nohit.train`). **0 movers.**
- **The hit gate (hitless → hit)**: no committed tape moves in any arm, and no witness takes a player hit. **Nothing
  turns a hitless leg into a hit-taking one.**
- **The named keyed ON-arm sweep**: the levels are listed in the map above. The legs can't be counted in this
  container: the survey cache it needs is not here. ⛳ For the planner: run it over those 22 levels with shards = min(10,
  legs).

### Gates

| gate | result |
|---|---|
| bounded vitest BEFORE (base, `--maxWorkers=3`, the 51 battery files that exist there) | 51 files, 1435 passed, 1 skipped |
| bounded vitest AFTER (head, 52 files: `contactFidelity*`, `levelRun*`, `levelWorld*`, `oneSpelling`, `fidelityWand*`, the 31 key-order pin files, `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface`, `boxLock`) | **52 files, 1474 passed** = the base + 37 new rows + 1 (the AS3-anchor row of `seedlingConstantsCensus`, skipped by name at the base because its worktree has no `vendor/seedling`) |
| `ci-producer-checks.mjs --jobs=3` | 99 run, **0 red**, 1 skipped, 0 known-red |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | ALL 7 MODULES AND 5 REGIONS MATCH |
| `census-seedling-constants.mjs` `--write` → `--profile-rows` (138 rows) → `--write` → `--check` | PASS, 0 new, 0 moved (`75671603`) |
| `census-seedling-solver-surface.mjs --write` / `--check` | GREEN, 374 rows (no new row: the three new getters have no solver reader; counts and lines moved) |
| `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` | all six rc 0 |
| CI at the last code head `75671603` (`ci-vitest-summary.mjs`) | @@CI@@ |
| train tier | **not dispatched** (this session can't): ⛳ planner, `unittests_frontend.yml -f train_only=true` at `75671603` |

## What the brief got wrong

- The LavaTrap's "per-visit chomp disc in levelWorld" is a planner avoid-volume (solver side); the run never steps the
  tongue, so there is nothing in the model for the kill to end.
- L78's and L80's lavatrap stances are crossed by lavarunners; the witness is L108.
- L53's icetrap stance is lethal (jellyfish kill the player at ~t104); the witness is L46.
- A stance with the player in the blast radius is infeasible in every stance searched.
- The chain blast can't happen: by source, the blast's own kill runs `dieEffects("")`.

## Hand-overs

- **Hammer / solver**: `botDriverV2.js` still avoids a dead LavaTrap's static chomp disc (`levelWorld.avoidVolumesAt`) —
  over-avoidance once `wandShotKill` is ON. `previewWandShot` is still Enemy-blind (W68's hand-over, unchanged).
- **W69 / dead frames**: at L53 the game swallows a press after the player's death and restart (the model's shot at
  t108 is not the game's) — the dead-frame press, not this key.
- **Planner**: dispatch `unittests_frontend.yml -f train_only=true` at the code head (this session can't dispatch), and
  the named sweep above.

## Residue

- The Explosion's player half (M1 uncaught) and the second-body half (refused) are both unwitnessed.
- `LAST_SIX` in `fidelityWandKill.test.js` names seven keys (a misnamed constant; the rows' labels carry no count).
- No default changes; the flip is the planner's call.
