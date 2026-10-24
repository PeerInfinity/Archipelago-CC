# Seedling swim U9: `Player.shieldBump` for every stepped enemy — one transcription, three game witnesses, two errors they found

**Slice:** `seedling-swim-u9`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15.11, ⚖ Q37). Siblings U6b (the press-arm rebase, the L18 re-record) and U10 (step 24's solver walls) ran in parallel. None of their regions were edited: no press arm, no `spinnerDanger`, no `deriveKillByChaser`, no `refuseDanger`, no goal loop. `solverBot.js` changed by one argument at two `chasers.step` call sites inside `previewWalk`.

| | |
|---|---|
| Started from | `origin/main` @ `0a8771a` (the brief's floor) |
| Harness branch | `claude/shield-bump-stepped-enemies-rnnkej` |
| Commits | D1 `f520ddf` · D2 `0e5bbe2` · D3 `a2d7c50` · D4 `d3eeb64` · this report (last) |
| Dev server | `scripts/serve-nocache.py 8900`, `SEEDLING_PORT=8900`, build `seedling_bot_ap_p4e` (the default) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at pristine `0a8771a`. The committed roster cannot see the bump: 13 tapes ever hold the shield, and none of them is in a room with a stepped body while it does. |
| D1 | **PASS**, gate **vacuous** + one explained mover | The bump is one transcription in `bobBossFight.js`, called for the boss, every stepped chaser and every spinner. tapeRunner 371/371 identical. The six `--check`s are identical. One identity row moved, `carved pairs c4`: four pairs moved, every one a shield-holding biome. |
| D2 | **PASS** (after two fixes the witnesses forced) | All three witnesses: the model reproduced every observation on the first recording (61 / 61 / 101). The body readout found two transcription errors (the box/gate split, the pit-fall order). After both fixes, every sampled body tick agrees (worst 8.9e-16). Both mutants red by name. |
| D3 | **PASS** | Steps 22, 23 and 25–30 are byte-identical to U5's rows. Step 30 stays SOLVED 1,056. |
| D4 | **PASS** (`d3eeb64`) | Log section, bot-page paragraph, reference (ALL 7 + 5 MATCH), surface GREEN 187, constants PASS (0 unclassified), roster pins, tape index, bounded vitest. |

**The one thing to know first.** The game's `shieldBump` reads two different players in one line. The `v.length > 0` gate reads the LIVE velocity. An enemy that touched the player earlier in the same frame has already written its knockback there, so **the contact tick is a bumping tick, even for a player who was standing**. The box is where the previous frame's `render` left it, and it faces the game's `direction`, which a hit pins to the parked `directionFace` for the whole i-frame. The model's `stepV2` derives `direction` from velocity. The shield box now reads the parked facing. Other readers of `state.direction` during i-frames have not been audited (§ Residue).

## W0: the banked rows (pristine worktree at `0a8771a`)

My first identity run was contaminated: I began D1 edits while it ran in the main tree, so I killed it and re-ran every W0 row in a pristine worktree.

| Row | Result |
|---|---|
| identity block | maze `246dfbce…`, acceptance `6bbc0273…`, c3 `659d2437…`, c6 `6abcc3d6…`, c4 `fcc6d836…`, ENEMY `f8f24b07…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `997ab4a8…`/`4614c86c…`/`dc17ad46…`, level pre/post s1 `e28c1e5d…`/`c4841acb…`. All equal the brief's bank. |
| generated set | OK (main tree, `SEEDLING_PORT=8900`, venv active; a worktree has no venv) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0 |
| reference `--check` | ALL 7 + 5 MATCH in the main tree. A worktree without the omsi/JtA submodules reads "4 differ" (omsi loop-mode tables), an artefact. |
| `profileMd5` / `entitiesMd5` | `f32d4d47…` (bank) / **`55743877…`** (the brief's `e338c30f…` is stale; pristine reads `55743877…` too) |
| tapeRunner | **371/371** (the brief said 365+) |
| bounded vitest (the brief's twelve paths) | **13 files / 751 tests, 744 pass, 7 red.** The seven reds are pre-existing: the profile and entity witness records lack rows for U7's eight `puncher*` profile keys and nine `chasers.puncher.*` leaves. |

### The shield-holding tapes (W0 probe: every fixture replayed through the model, per tick)

| Tape | `noDamage` | shielded ticks | stepped bodies in a shielded room | moving-shield touches |
|---|---|---|---|---|
| `r2-walk-1-sword-shield` … `r2-walk-6-darksuit`, `r2-walk-full` (7) | true | 92 … 9,300 (dark shield in 5, 6, full) | none | 0 |
| `r3-collect-shield` | true | 9 | none | 0 |
| `r8-d2`, `r8-d2-20` | false | 400 | none | 0 |
| `r8-solve-20` | false | 97 | none | 0 |
| `r9-solve-20` | false | 1 (the pickup) | none | 0 |
| `swim-u5-bobboss-encounter` | false | 1,057 | the boss only (U5's own bump) | — |

There is no committed `r9-solve-21`. `r9-solve-19` never holds the shield. The parity gate is therefore **vacuous**, as U7's was: the witnesses carry the parity.

## D1: the transcription (`f520ddf`)

**The tick order, as read.** `Player.update` (`Player.as:476+`) runs `getState(); addShield(); shieldBump(); checkDrowning(); freezeStep();` and only later `super.update()` (the move). Every enemy is earlier in the update list than the player. So the bodies have already taken this tick's step when the shove lands, and their next step spends it (friction, then the move). There is no freeze gate. `levelRun` calls `shieldBumpNow` at U5's two sites, the live tick and the frozen tick, just above `slashTimerTick`.

**The shared transcription** (`bobBossFight.js`):
- `shieldBumpTouches(p, slashing, bodyBox, rendered)`: the `v.length > 0` gate and `Entity.collide`'s strict test against `playerShieldRect`.
- `enemyKnockbackV(body, v, f, p)`: `Enemy.knockback`, `atan2(y - p.y, x - p.x)`, both components added whole. **There is no ±0.5 gate here; that gate is `Player.knockback`'s.**
- `bobBossShieldBump` calls both. Its arithmetic is unchanged: U5's tape replays identically.

**Per class:**

| class | in the game | in the model |
|---|---|---|
| bob | `Enemy.knockback`, inherited; gated `!destroy` and not "die" | shoved; the chase's `pushed` test keeps the shove from being re-normalised |
| puncher | `knockback` is an EMPTY override (`Puncher.as:167-170`) | touched, ledger row `shoved: false, why: 'empty knockback override'` |
| spinner | no override, so it is shoved; `Spinner.friction` floors at `moveSpeed`, so the shove decays back to speed 1 on the new heading | shoved (`sp.byId` entry's `vx/vy`) |
| BobBoss | no override (U5) | U5's path, now through the shared functions |
| BossTotem / ShieldBoss | not stepped by any chaser/spinner family here (`enemies = ["Enemy","ShieldBoss"]`) | not reached; no shielded tape enters their rooms |
| **dark shield** | `o.hit(5, p, 0.5, "Shield")` when `o.hitsTimer <= 0`, with the `hitByDarkStuff` latch | **refused by name at the touch** (a body inside its own i-frame takes the plain knockback, which is modelled) |

- **The forecast.** `chaserForecastNow().step(playerPos, {slashing})` applies the same shove after the bodies step, for a previewed player carrying `vx/vy/direction`. `previewWalk` passes its slash state. A position-only `playerPos` bumps nothing. The spinner forecast takes no player, so it carries no bump (§ Residue).
- **New ledger kind** `shieldBumps` (getter + `run.ledger`, 31 kinds), witnessed by an L4 staging in `levelRun.test.js`'s C4 roster.

### D1's parity gate

Predicted: tapeRunner identical; every identity row identical except possibly `acceptance batch` (its post-shield arm boots the shield); the six `--check`s identical.

| Row | Measured at `f520ddf` |
|---|---|
| tapeRunner | **371/371** identical |
| identity block | identical **except `carved pairs c4`** `fcc6d836…` → `04d2c468…` (not predicted: I named acceptance, which did not move) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0 |
| constants census | PASS, 4,624 literals, 0 unclassified. `bobBossShieldBump`'s gate row is retargeted to `shieldBumpTouches`, and the dark-shield gates are classified `rule/bound`. |
| solver surface | GREEN 187 (the ledger fold) |

**The c4 mover, explained.** Diffing the two dumps (`--kinds=winding,rooms,branchy,bushy,loopy,open --seeds=1-12 --count=4`, pristine against the head) shows four moved lines out of the dump's ~290:
- `bushy post-shield s2`: same level, ticks `304->304` → `345->278`;
- `loopy post-shield s6`: SATURATED 38 attempts → TARGET_REACHED 4 attempts;
- `loopy post-swim s6`: the same as `loopy post-shield s6`;
- `winding post-swim s6`: 29 → 48 attempts, ticks `491->499` → `491->641`.

**Every mover boots the shield.** No pre-sword or post-sword line moved. These are certify walks in which the bump now moves a body. The head (with D2's fixes) reproduces D1's `04d2c468…` exactly.

## D2: the witnesses, on the game (`0e5bbe2`)

Authored by `plan-seedling-u9-shield-bump.mjs` (with `--check`). The shield is granted through the seam (`seam.items.hasShield`), `noDamage` is false, and the tapes are recorded headless (`check-seedling-bot-differential.mjs --record --only=<name>`, `SEEDLING_PORT=8900`).

| tape | stance | model, predicted before recording | game |
|---|---|---|---|
| `u9-shield-bob-shove` | L4 spawn (72,40), `down` ×40 then still ×20 | shoves from t16 (Δv ≈ (−0.15, +4.56)); contact t26 | **THE MODEL REPRODUCES THE RECORDING: 61 observations**; `hits` 1 / `hits_timer` 0 agree |
| `u9-shield-puncher` | L12 spawn (392,264), `right` ×40 then still ×20 | touches at t13–14, never moved; contact t15, punch t35 | **61 reproduced**; `hits` 2 / 0 agree |
| `u9-shield-bob-standing` | L4 spawn (56,56), no keys ×100 | the bob sits on the down box for many ticks, never shoved; contact t58 | **101 reproduced**; `hits` 1 / 0 agree |

**The body readout disagreed.** `probe-seedling-u9-shield-mobiles.mjs` is U7's probe with `--class=Bob|Puncher`; it calibrates the clock shift on the player's x (exactly [0]). It found two transcription errors:

1. **The standing tape, t 58: the game shoved and the model did not** (game v (3.18, 3.18), model (−0.354, −0.354); Δ = 5·(cos 45°, sin 45°)). The bob's `hitPlayer` runs before `Player.update` and writes the knockback into `v`, so the gate holds on the contact tick. But the box was still the previous render's **down** box. The model built the box from the post-hit velocity, which flipped it to the west side box. **Fix:** `advance` snapshots the rendered player as its first statement (`shieldRenderState`). The box reads that snapshot; the gate and the shove's point read the live player. U5's boss path reads it too.
2. **The shove tape, t 27: one extra game shove** (Δv ≈ (1.23, 4.85), |Δv| = 5.0). `Player.hit` arms `hitsTimer` BEFORE calling `knockback`, so `knockback`'s `if (hitsTimer > 0) directionFace = direction` always parks the facing, and `sprites()` pins `direction` to it for the i-frame. The game's box stayed **down** while the model's player, knocked north, read `direction` 1. **Fix:** the snapshot's `direction` is `damage.directionFace` while it is parked, else `state.direction`.
3. **The shove tape, t 50: a non-shield error the shove exposed.** The shove carried the bob into L4's pit tile, and t 50 is the tick its fade ends. The game's `v` was t 49's; the model's had moved by one chase step (0.5 per axis). `Bob.update` runs `super.update()` (here the descent, which REPLACES `Mobile`'s update in `Enemy.update`) and then returns on `destroy` before its chase block. The model's pit branch ran the chase above the lerp, from the pre-lerp position, and on the destroy tick. **Fix:** lerp and fade first, then the chase (and the puncher's attack decision) from the lerped position, skipped once `destroy` is set. A falling body's `v` moves nothing, so this was invisible to every stream.

**After the fixes** (the game rows the probe saved, replayed offline against the model, and in the committed `seedling-swim-u9-mobiles-*.json`):

| tape | sampled ticks | body comparisons (x, y, vx, vy, hits, hits_timer) | worst \|Δ\| |
|---|---|---|---|
| `u9-shield-bob-shove` | 61 | **51/51 agree** (the bob is gone from t 51 in both) | 8.9e-16 |
| `u9-shield-puncher` | 61 | **61/61** | 2.2e-16 |
| `u9-shield-bob-standing` | 101 | **101/101** | 4.4e-16 |

The game's own readouts: the bob in the shove tape is thrown south from t 16 and piles `v.y` up to 21.4 against the south wall (`Mobile.moveY` stops the sweep and keeps `v`). The shove carries it into the pit at (88,72), where it falls by t 50. The puncher's own velocity takes no shove at any touch tick: it agrees with the model, which shoves nothing. The standing bob closes on the box from t 36 and is shoved only on t 58.

**Mutants** (each predicted first, one build, copied and restored md5-identical):

| mutant | predicted | measured |
|---|---|---|
| (a) chaser bump off (`if (false)`) | `u9-shield-bob-shove` red; `u9-shield-bob-standing` "likely" red; puncher green | **1 red / 376 green**: `u9-shield-bob-shove`, *"tick 20 differs: expected (72, 62.9), got (72, 60.40)"*. The unshoved bob reaches the player at t 20 instead of t 26. The standing tape stayed green: the missing t 58 shove does not reach the player's stream inside 100 ticks. Restored `0b301458…`. |
| (b) the `v.length > 0` gate dropped | `u9-shield-bob-standing` red; the others green | **2 red / 375**: `u9-shield-bob-standing` at t 58, *"expected (54.06, 54.06), got (56, 56)"*: the bob shoved off the box never lands the contact. And **`swim-u5-bobboss-encounter` at t 397** (dy +2.74): U5's tape witnesses the gate too, which I had not predicted. Restored `53032062…`. |

The dark-shield arm of (b) is not expressible: the model refuses it by name at the touch.

## D3: the survey (`a2d7c50`, `CC/docs/cloud-reports/seedling-swim-u9-survey.json`)

`--through=2.2 --only=22,23,25,26,27,28,29,30 --timeout=600`, measured at D1 (`f520ddf`) and again at the D2 head (`0e5bbe2`).

Predicted: all eight rows byte-identical to U5's. Of these rooms only L22 (step 26) holds a stepped body, `bob@96,144`. Step 30's boss bump is the same arithmetic.

| step | room | measured (both heads) |
|---|---|---|
| 22 · 23 · 25 · 26 · 27 · 28 · 29 | L13 · L0 · L21 · L22 · L29 · L31 · L30 | SOLVED 48 · 229 · 26 · 89 · 383 · 336 · 210, **byte-identical to U5's rows** (`ms`/`views` stripped) |
| 30 | L32 | **SOLVED 1,056**, 15 decisions, 0 re-plans, 0 hits, **byte-identical** |

The route and generator blocks are identical. **HEADLINE (through-2.2, this subset): 8/8.** Step 24 is U10's and was not run.

## The profile / entity / surface deltas

- **Profile:** no new key. `SHIELD_FORCE` stays `bobBossFight.js`'s anchored literal (now exported). `profileMd5` `f32d4d47…` is unchanged, so no profile witness `--write` is owed by this slice.
- **Entities:** no new record leaf (`CHASERS` is untouched). `entitiesMd5` `55743877…` is unchanged from W0.
- **Constants census:** 4,624 → 4,625 literals, PASS, 0 unclassified.
  - `bobBossShieldBump`'s gate row is retargeted to `shieldBumpTouches`.
  - Classified: the forecast's and `shieldBumpNow`'s dark-shield gates (`rule/bound`, `Player.as:shieldBump`), and the snapshot's `directionFace >= 0` (`rule/sentinel`, `Player.as:directionFace`).
- **Solver surface:** 187 rows, GREEN. The ledger fold gains `shieldBumps`; there is no new member or import row.
- **Reference:** regenerated, ALL 7 + 5 MATCH. Instruments 296 → 298 (the planner and the probe); the docs index follows the doc edits.
- **Roster:** 157 → 160 (`tapeEnvelope`, `observationTolerance` ×2, `dialogueAutoAdvance` 160/159); the tape index is 160. The R8 exposure roster goes 19 → 22: the three witnesses are declared in `exposedAdded` and in the test's three lists.

## Byte-inertia

| Artifact | W0 (`0a8771a`) | D1 (`f520ddf`) | head (`0e5bbe2`+) |
|---|---|---|---|
| identity block | as above | identical except c4 `04d2c468…` | **= D1's**, every md5 row (measured at `0e5bbe2`); generated set OK and reference ALL 7 + 5 MATCH at `d3eeb64` (main tree) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical | identical, exit 0 |
| tapeRunner | 371/371 | 371/371 | 377/377 (+2 rows per witness) |
| survey through-2.2, the eight rows | U5's | identical | identical |
| reference `--check` | ALL 7 + 5 MATCH | — | ALL 7 + 5 MATCH (regenerated) |
| surface / constants | GREEN 187 / PASS | GREEN 187 / PASS | GREEN 187 / PASS |
| bounded vitest (the brief's twelve paths) | 13 / 751 (744 pass, 7 pre-existing red) | — | **13 / 758 (751 pass, the same 7 red)** |
| `fixtures/**` | — | — | the three witnesses (tape + expectation each) and `tapes/index.json` only; `campaign-frontier.json` is untouched |

Not touched or run: no AS3, wasm or gitlink; no committed tape moved; no biome default; no `standing-values --write`; no `pytest`; no unfiltered vitest. The profile and entity witness `--write` (fast tier) was not owed; the full tier is U6b's or the coordinator's.

## What the brief got wrong (measured)

1. **"`Enemy.knockback(5, playerPoint)` with the ±0.5 component gate."** `Enemy.knockback` (`Enemy.as:247-255`) adds both components whole. The ±0.5 gate is `Player.knockback`'s.
2. **"(c) a STANDING shielded player touched by a chaser (no bump)."** The game DOES bump on the contact tick: the contact's knockback is in `v` before `shieldBump` runs. The witness asserts "no row before the contact, exactly one on it".
3. **"the shield box from `playerShieldRect` by the player's `direction`."** The box reads the PREVIOUS render's player, and its `direction` is the hit-parked `directionFace` while the i-frame runs, not `stepV2`'s velocity-derived one. The gate reads a different player (the live one).
4. **"Mutant (a): … reds by name at the first shove tick."** The player's stream cannot see a shove until the body reaches the player. It reds at t 20 (the early contact), not at t 16.
5. **"`r9-solve-19..21` hold it" / "the campaign's segments 21+ hold it."** No committed `r9-solve-21` exists. `r9-solve-19` never holds the shield, and `r9-solve-20` holds it for one tick (the pickup).
6. **"the post-shield census rows MAY move."** No census moved (ENEMY and AREA are identical). The mover is `carved pairs c4`, whose dump draws the shield-holding biomes.
7. **Bank:** `tapeRunner` is 371 at the floor, not 365. `entitiesMd5` is `55743877…`, not `e338c30f…`. The 7 profile/entity witness-record reds are pre-existing.
8. **"`flash.md` if the shield is described."** `flash.md` names the shield only as an AP item, so it was not edited.

## Residue

- **The dark shield** is refused by name at the touch, for chasers, spinners and (U5's) the boss. Modelling it needs `Enemy.hit(5, p, 0.5, "Shield")` and the `hitByDarkStuff` latch, which lets the next hit through a live i-frame. Five committed `r2-walk-*` tapes hold it, all `noDamage`, in rooms with no stepped body.
- **The first update of a new `Player`.** `addShield` creates `shieldObj` and `FP.world.add`s it, and the add is deferred, so the game bumps nothing on a room's first player update. The model does not gate this. No witness touches a body on a room's first tick.
- **`state.direction` during i-frames.** The model derives it from `v`; the game pins it to `directionFace`. Only the shield box now reads the game's value. Other readers (a slash rect pressed during i-frames, and anything else that reads `state.direction`) were not audited.
- **The spinner forecast** (`run.spinnerForecast`) is player-free, so it carries no bump; `dangerMap.spinnerDanger` is U6b's. **The BobBoss executor's forecast** (`fc.shieldBump`) passes no rendered player. A preview takes no hit, so the two players coincide there.
- **A death's reboot** in the BobBoss fight is still refused (U5).
- **The pre-existing witness-record reds:** U7's eight `puncher*` profile keys and nine `chasers.puncher.*` leaves have no rows in `seedling-profile-witnesses{,-full}.json` / `seedling-entity-witnesses.json`. Both tiers' `--write` are owed (the coordinator's or U6b's).
- **`seedling-bot.md`** still carries U4's sentence *"The puncher is not in that set: it has no `chasers.js` row …"*, which U7 made false. It was left for the paragraph's owner.
- **The bank's c4 row** moves to `04d2c468…`, and the standing value needs re-sealing by whoever banks (no `standing-values --write` here).
- **The witnesses' descriptions** were re-emitted after the recordings, when the fixes changed the predicted shove ticks. The inputs did not change, and the expectations hold only `ticks`/`transitions`. The planner's `--check` is green.
