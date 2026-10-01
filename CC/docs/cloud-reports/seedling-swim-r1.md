# Seedling swim R1: the dark stuff — the dark suit's retaliation, the dark shield's kill, the spinner's latch, the BobBoss's dark hit

**Slice:** `seedling-swim-r1`, an Opus build slice run in the cloud for the swim arc (plan §18.13+, ⚖ user 2026-10-01: *"U13 ∥ R1 now"*). Two siblings ran in parallel: U13 (the campaign chain) and `archipelago-cc-5d`'s J2 (the JS runtime). Neither one's region was edited.

| | |
|---|---|
| Started from | `origin/main` @ `6ebd3442dc` (one commit past the brief's `3534c806ed`: a `standing-values.json` bank chore that no producer reads) |
| Head | this report's commit, on top of `c9d88ec` |
| Harness branch | `claude/dark-suit-shield-kill-xoiewt` (the harness pins it, not `seedling-swim-r1`) |
| Commits | D1 `c1404a3` · D2 `629fc45` · D3 `6f4a9d9` · D4 `bb7dfad` (records), `e49d87e` (fast-tier profile witness), `c9d88ec` (full tier) · this report |
| Dev server | `scripts/serve-nocache.py 8920` (`SEEDLING_PORT=8920`, build `seedling_bot_ap_p4e`); a second on 8921 served the pristine worktree |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `6ebd344` in a pristine worktree. Bounded vitest: 13 files / 784 tests. |
| D1 | **PASS, witness first** | `Player.hit(e, …)` retaliates `e.hit(1, playerPoint, 1, "Suit")` into a chaser's contact and a punch. The game holds the bob's second contact to t50 (its own i-frame), not t44; the model reproduces 76/76 observations and the bob probe agrees 76/76. Mutant: 1 red at t44. At the head, 10 of the 12 census levels run their 1,000 ticks (6 of 12 refused on the suit at the base). |
| D2 | **PASS, witness first** | `startDeath("Shield")` / `("Suit")` go through one kill staging that the arrow and press kills now share. The suit kills a bob on t87 and the dark shield kills one on t476 (L22). The probes agree on every sample, removal tick included. Mutant: both kill tapes red by name. A suit kill through a PUNCH stays refused (measured in the AS3). |
| D3 | **PASS (spinner and BobBoss), witness first** | `hitSpinner` and `bobBossHit` carry the latch. The dark shield hits a spinner and a press lands through the i-frame (probe 122/122). The suit retaliates into a spinner's hammer (probe 442/442). The dark shield on form 2 adds a sword and re-seeds (the blade then hits the player on t635/t667; 704/704 observations). Mutants: the spinner latch reds only in the probe (stream-invisible), and the boss arm reds at t635. |
| D4 | **PASS** | Log section, bot page, reference ALL 7 + 5 MATCH, surface GREEN 189, constants PASS 4,660, profile 138 keys (both tiers written), entities 461, bounded vitest 23 files / 1,107 tests. |

**The one thing to know first.** The dark suit is now modelled wherever the hit comes from a transcribed `Enemy.hit`: chasers, punches and spinners. It is still refused by name, naming the source, for a static census body (L36's `sandtrap`), the BobBoss, the ShieldBoss, the Owl and the totem's body. The chaser contact moved: it now runs between the move and the chase, the game's order. This was byte-identical for every committed tape (tapeRunner 405/405, identity block and six `--check`s unmoved), because until the suit nothing in a contact wrote the body.

## W0: the banked rows (at `6ebd344`, a pristine detached worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=8921 bash scripts/procgen/identity-block.sh .` | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…`. **All equal the brief's bank.** |
| generated set | the same, re-run with `SEEDLING_PYTHON=<primary>/.venv/bin/python` | **OK**. ⚠ In a worktree the script's first run reads *"install … requirements-headless"*: a worktree has no `.venv`. |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, all exit 0 (= the bank) |
| reference `--check` | the block's last row | *"4 differ"* in the symlinked worktree (U10's artifact); main's own tree reads ALL MATCH |
| solver surface / constants / tape index | `census-seedling-solver-surface --check` / `census-seedling-constants --check` / `index.json` | GREEN 189 / PASS 4,654 literals / 168 tapes |
| roster pins | the four suites | `dialogueAutoAdvance` 168 (inert 167), `tapeEnvelope` 168, `observationTolerance` 168 ×2; R8 `exposed` 30 |
| profile / entities | `witness-seedling-profile --check` / `witness-seedling-entities --check` | 136 keys (both tiers) / 461 leaves |
| bounded vitest | the brief's 12 paths | **13 files / 784 tests**, exit 0. Every path matched; `spinner` matches two files (`spinner`, `spinnerClockPairing`) |

⚠ The identity block was first started on the main tree. I stopped it after three rows, once my D1 edits had begun there, and re-ran it whole in the worktree. Those three rows are not quoted.

## D1: the dark suit's retaliation (`c1404a3`)

### The order, as read

1. An enemy updates before the player. `Enemy.update` is `super.update()` (the move), then `if (!destroy) { hitUpdate(); hitPlayer(); }`, then the subclass block (`Bob.update`'s chase, `Puncher.update`'s chase and attack decision).
2. `hitPlayer` → `Player.hit(this, 3, Point(x, y), damage)`. Inside `hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects`, and above `hits += d`: `if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y), darkSuitDamage 1, "Suit")`.
3. `Enemy.hit(1, playerPoint, 1, "Suit")`: the body's own gate (`hitsTimer <= 0 || hitByDarkStuff`, the freeze, `canHit`), `hits += 1`, `hitsTimer = 30`, `hitByDarkStuff = true`, then `startDeath("Suit")` at `hitsMax`, else `knockback(1, playerPoint)`. A puncher's `knockback` is empty.
4. Then the player's own `hits += d`, i-frame and knockback.
5. Then the subclass chase reads the body's `v`, including the suit's shove (`pushed = v.length > moveSpeed`).

**Who passes `e`.**

| passes `this` (retaliated) | passes `null` (never retaliated) |
|---|---|
| `Enemy.hitPlayer` (every body contact), `Puncher.attackPlayer`, `Spinner`'s hammer, `BobSoldier`'s blades (the BobBoss), `ShieldBoss`'s swing, `Tentacle` | `Arrow`, `Pulser`, `Crusher`, `IceTurretBlast`, `BossTotemShot`, `Explosion`, `RockFall`, `Grenade`, `BossTotem.hitPlayers` (the laser), `LavaBall`, `TurretSpit`, `LavaChain`, `SpinningAxe`, `BeamTower`, `Flyer`'s drop, `Pod` |

**Per class.** The suit's `"Suit"` hit is U11's per-family table with force 1 and damage 1. A bob is shoved by 1; a puncher takes damage with no shove (an empty `knockback`); a spinner is shoved by 1 (D3). For the BobBoss, `BobBoss.hit` would add a sword on form 2; it stays refused under the suit.

### The model step

- `playerDamage.playerHit`: the refusal becomes a contract. A source declares the AS3 call's `e` (`byEnemy`), and the result says whether a retaliation is owed (`retaliates`). An undeclared source under the suit still throws by name. `applyPlayerHit` makes the retaliation through the caller's `retaliate`, so the funnel owns no enemy.
- Every `applyPlayerHit` site declares: `retaliate: null` at the nine `hit(null, …)` sites; a transcribed `Enemy.hit` for the chaser contact and the punch (D1) and for the spinner's contact and hammer (D3). The static census body, the BobBoss, the ShieldBoss, the Owl's body and the totem's body stay undeclared, and so refused under the suit.
- `chasers.chaserStep` takes a `hitPlayer` hook at `Enemy.update`'s place. `levelRun`'s chaser contact moved into it (`chaserContactNow`), so the chase reads the suit's shove and a killed body skips the chase.
- One helper for both dark arms (`darkHitChaser`): the shield's `{d: 0.5, f: 5, t: "Shield"}` and the suit's `{1, 1, "Suit"}`.
- Profile keys `darkSuitForce` 1 and `darkSuitDamage` 1 (`Player.as:255-256`).

### The witness: `r1-dark-suit-bob` (`plan-seedling-r1-dark-suit.mjs`, with `--check`)

L4 (64,32), U9's boot three tiles north of `bob@64,64`; the dark suit alone through the seam; `noDamage` false; `down` ×20, then still to t75. The tape was emitted while the model refused, at t20 as predicted, then recorded headless on the game, then the step written.

| | predicted (AS3 reading; the suitless model for "before") | game | model after D1 |
|---|---|---|---|
| first contact | t20: bob `hits` 1, i-frame 30, shove 1, latch; the player's hit | t20: player y 62.05 → 60.40 (knocked north) | t20, retaliation `{hits 1, hitsTimer 30, shoved}` |
| second contact | t50 (the bob's i-frame), not t44 (the player's, the suitless model's) | **none at t44; t50** (y 55.761 → 53.013) | t50, retaliation `hits` 2 |
| the bob (probe) | — | `hit_by_dark_stuff` true from t20, `hits` 1 → 2 at t50 | **76/76 body comparisons agree** (x, y, v, `hits`, `hits_timer`; worst 1.1e-16) |
| stream | — | 76 observations | **reproduces all 76** |

The bob's v at t20 matches the game to the bit, so the shove lands BEFORE the chase. The other order would have re-normalised it.

- **Mutant** (predicted first: 1 red at t44): `retaliation` never made, one build, copied and restored md5-identical (`484f0126…`). **Measured: 1 red / 395, `r1-dark-suit-bob` at t44**, *"expected (x=72, y=55.761…), got (x=72, y=53.012…)"*.
- **Parity:** tapeRunner **395/395** at D1. A counting instrument (copy and restore) replayed all 169 tapes: **the dark suit is held at a player hit in one tape only, the witness** (2 calls, 2 retaliations). Six committed tapes carry the suit (`r2-walk-6-darksuit`, `r2-walk-full`, `r3-collect-darksuit`, `r3-walk-6-darksuit`, `r3-walk-full`, `l71-shieldlock-open`), and all six are `noDamage`. Every non-`noDamage` tape declares `hasDarkSuit: false`.

### The 12-level re-run (`probe-seedling-r1-suit-census.mjs`, output in `seedling-swim-r1-suit-census.json`)

J0(a)'s census file is not in the repo, so the probe re-derives its shape:

- the arrival is the first teleporter or stair naming the level;
- the full kit is LESS the ghost sword, whose press refuses at R5 and ended all 12 levels at the first press when I first included it;
- 600 idle ticks, then 400 seeded random-key ticks;
- a pit or drown death reboots at the arrival.

| level (arrival) | base `6ebd344` | head | what refuses at the head |
|---|---|---|---|
| L6 (5: teleporter) | ran 1,000 | ran 1,000 | — |
| L8 (7: stairs) | ran 1,000 | ran 1,000 | — |
| L14 (13: stairs) | **refused t106, the suit** | ran 1,000 (1 retaliation) | — |
| L16 (15: stairs) | **refused t128, the suit** | ran 1,000 (7 retaliations) | — |
| L17 (16: stairs) | **refused t133, the suit** | **refused t145** (1 retaliation first) | *"whether bob bob@192,80 is on screen at tick 144 depends on where inside `Game.shake`'s jiggle the camera landed"*: the player hit's shake makes the next on-screen gate indeterminate (`camera.js`, the shake band) |
| L18 (16: stairs) | **refused t96, the suit (the spinner)** | ran 1,000 (1 retaliation, into a spinner: D3) | — |
| L25 (22: teleporter) | **refused t506, the suit** | ran 1,000 (1 retaliation) | — |
| L26 (25: teleporter) | ran 1,000 | ran 1,000 | — |
| L36 (12: teleporter) | **refused t733, the suit** | **refused t733** | *"the `enemy` hit (sandtrap@80,80) … `hasDarkSuit` retaliates INTO the attacker … this source has not declared"*: a static census body's `Enemy.hit` is not transcribed |
| L91, L93, L98 | ran 1,000 | ran 1,000 | — |

**6 of 12 refused on the suit at the base, and 2 at the head.** The next blockers are named and not chased: the shake band (L17) and the static-body retaliation (L36). The other six levels took no contact with this kit and these keys, so this run is not J0(a)'s ticks; J0(a)'s list is an upper bound and so is this.

## D2: the kill arm (`629fc45`)

**One staging, `stageChaserKill(c, by, cause, extra)`**:

- `play("die")` (`createDieAnim`), with the wind-up cleared (`play("die")` replaces it);
- the `chaserKills` row `{t, level, id, by, …extra, hits}`;
- `assertChaserRemovalIsDeclared`.

The arrow kill (`extra: {arrow}`) and the press kill (`{weapon}`) now call it, with byte-identical rows. The live shield bump (`by: 'shield'`, its `shieldBumps` row gains `killed: true`) and the suit's retaliation (`by: 'suit'`) call it too. `dieEffects("Shield"/"Suit")` adds nothing; only "Sword"/"Spear" and "Wand" spawn effects. The chaser forecast prices a dark-shield preview kill with the press's preview shape (`dyingAt = tickOffset + 1`: the bump runs inside `step`, before its offset advances; a press of the same game tick is applied after).

**A suit kill through a punch is refused by name (an AS3 finding).** `Puncher.endAnim`'s attack arm is `attackPlayer(); setSprite("stand")`. The retaliation's `startDeath` plays "die", and the next statement replaces it with "stand-*". The body then sits at `hits >= hitsMax` with no die anim: never destroyed, still chasing, still in contact (its gates read "die", not `hits`).

### The witnesses

| tape | predicted (the model up to its refusal, which named the kill tick) | game | model after D2 |
|---|---|---|---|
| `r1-dark-suit-kill`: L4 (64,32), the suit, `hits_max` 4, `down` ×135 | contacts t20 / t50 / **t87** (bob `hits` 1 / 2 / 3); the third kills; removal 36 ticks later (t123); the player 3 of 4 | no transition; contacts t20, t50; the bob plays "die" from t87, `endAnim` clears it ~25 ticks later | stream reproduces; **bob probe 122/122**, existence included (removed on t123 in both; worst 1.4e-14); `chaserKills` `[{t 87, by 'suit', hits 3}]` |
| `r1-dark-shield-kill`: L22 (64,144), shield + dark shield, `down` ×520 | dark hits t120 / 191 / 260 / 332 / 404 (0.5 each), the sixth (**t476**) kills; removed t512; the player never hit | as predicted ("die" from t476) | stream reproduces; **bob probe 511/511** (removed on t512 in both; worst 2.8e-14); `chaserKills` `[{t 476, by 'shield', hits 3}]` |

**The first suit-kill shape was re-authored, measured.** It used `r1-dark-suit-bob`'s keys (still from t21) to t170. The game's third contact (t122) threw the player north into L4's `stairsdown` at (64,16), and the swap to L5 came on t125. The kill's death staging then happened in a world the stream had left. With `down` held, the player stays in the room. From t52 the player is pinned against the south wall, so the stream cannot see t87, and the body probe is the kill's observable.

**L4 cannot host a shield kill.** U11's bob falls into L4's pit after one hit and plain shoves (t16, t23–30). A scan over L22's bob found stances with a ~70-tick bump cycle and no player hits.

- **Mutant** (predicted first: both kill tapes red at their kill ticks, every arrow/press kill green): both dark kill arms throw, one build, restored md5-identical (`2f3b124f…`). **Measured: the two kill tapes red (4 rows: 2 per tape), both by the mutant's name; 395 green.**
- **Parity:** tapeRunner **399/399**. The arrow and press kills' rows are byte-identical through the helper (every committed kill tape green).

## D3: the spinner's latch and the BobBoss's dark hit (`6f4a9d9`)

### The spinner

- `hitSpinner` carries the latch: the gate is `hitsTimer <= 0 || hitByDarkStuff`, set by a damaging "Shield"/"Suit" hit and reassigned by every damaging hit. The field is written only once true, so every older spinner state keeps its exact shape.
- The live shield bump's dark arm hits a spinner (`darkHitSpinner`). A spinner kill is accounted as a press kill is (`assertSpinnerKillIsAccounted`, a `spinnerKills` row with `weapon: 'shield'|'suit'`).
- The spinner's contact and its hammer both pass `this`, so the suit retaliates into it.
- The spinner forecast takes no player and so no bump (unchanged; residue).

| tape | predicted | game (spinner probe, `--class=Spinner`, new) | model |
|---|---|---|---|
| `r1-dark-shield-spinner`: L18 (48,80), shield + dark shield + sword, `down` ×60, a press at held index 4 | dark hit t4 (0.5, i-frame 30, shove 5, latched); the press lands through the i-frame (1.5) | t4 `hits` 0.5/30 latched; t6 **1.5/30, latch cleared** | **122/122** (2 spinners × 61; worst 2.8e-14); 61 observations reproduce |
| `r1-dark-suit-spinner`: L18 (16,112), `r8-hammer-arm`'s boot and clock, the suit, `right` ×220 | the hammer hits the player on t180, retaliated (spinner `hits` 1/30, latched) | t180 `hits` 1/30, latched | **442/442** (worst 0); 221 observations reproduce |

`spinnerBodies` carries no velocity, and I did not widen a surface member for a probe. For a spinner the probe compares position, `hits` and `hits_timer`; equal positions to the bit on every tick pin the velocity.

**These keys were chosen with the arm in the working tree.** For the three D3 witnesses I explored stances on the uncommitted arm. Each tape was recorded on the game before the arm was committed, and the game judged; the arm was not tuned to a recording. D1's and D2's tapes were authored while the model still refused.

- **Mutant** (predicted first: tapeRunner all green, because the arm is stream-invisible; the planner's latch check FAILS; the game rows replayed offline disagree from t6): the latch dropped, restored md5-identical (`2960f971…`). **Measured: tapeRunner 403/403; the planner FAILs `["5:m0.5","6:m0.5","7:m0.5"]`; offline 67/122, first *"t 6: game … 1.5/30 model … 0.5/28"*; `r1-dark-suit-spinner` 442/442 (unaffected).**

### The BobBoss

- `bobBossHit` carries the latch (`hitsTimer <= 0 || hitByDarkStuff`). Form 2's `swords++` and re-seed keep their own gate, `hitsTimer <= 0 && bossType == 2 && !freeze`, so a latched hit adds no sword. **The re-seed is arithmetic** (`3π/2 + 2π·i/swords`), not an RNG draw.
- `bobBossShieldBump` has the dark arm: `BobBoss.hit(5, p, 0.5, "Shield")` when `hitsTimer <= 0`, which means `super.hit(0, null, …)`: damage, the i-frame, the latch, no shove. Inside the i-frame it is the plain shove.
- One function for the live bump and the executor's forecast: `bobBossForecast().shieldBump` now passes `dark`.
- The suit into the BobBoss stays refused (undeclared).

**U5's shape with the dark shield granted is vacuous.** Its walk bumps the boss twice (t378–379), both inside form 1's i-frame, so the dark arm never fires and the run is identical. The witness takes U5's boot, seam (+`hasDarkShield`) and keys through form 2's dialogue (held index 612), then `up` ×60 into form 2 and `down` ×30.

| `r1-dark-shield-bobboss` | predicted | game | model |
|---|---|---|---|
| dark hits on form 2 | t633 (0.5, swords 2 → 3, re-seeded), t665 (1, swords 4) | — | `shield-hit` rows t633/t665 |
| the re-seeded blade | hits the player on t635 and t667 (2 of 3) | `hits` 2 at the end, 2 landed | **reproduces all 704 observations** (the hits at t635/t667 are in the stream) |

- **Mutant** (predicted first: 1 red at t635): the dark arm off (the plain shove), restored md5-identical (`552b27c2…`). **Measured: 1 red / 405, `r1-dark-shield-bobboss` at t635**, *"expected y=97.05, got y=94.55"*. `swim-u5-bobboss-encounter` stays green.
- **Parity:** tapeRunner **405/405**.

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 189 | **GREEN 189** | none: no new run member. The retaliation rides `playerHits` rows (`retaliation`, only when present) and `shieldBumps` (`killed`), so no ledger kind (the fold's title pins the count) |
| constants census | PASS 4,654 | **PASS 4,660** | D1 +3 (the two profile values; one structural `+ 1` in the new error text) with 6 targets retargeted to moved hashes; D2 +1 (the helper merges two `ticksCompleted + 1`, plus the forecast's `+ 1` and the punch refusal's); D3 +2, with U11's BobBoss gate row retargeted to `bobBossShieldBump` |
| profile | 136 keys, `cf76477e…` | **138 keys, `d06ae110…`** | `darkSuitForce` 1 (physics/magnitude), `darkSuitDamage` 1 (rule/magnitude), both anchored to `Player.as` (anchored 70 → 72). Pins moved in `seedlingProfile.test`, `profileBoot.test`, `seedlingProfileLoader.test` (count, md5, anchored, defaulted 135/136 → 137/138: one title moved, *"… 1 set, 137 defaulted"*) |
| profile witnesses | 136 / 136 keys | **138 / 138 keys**, `--check` PASS | fast tier: 120 tapes (113 →), 844 s. Full tier: 174 tapes (166 →), 3,747 s at `--jobs=2`. `darkSuitForce` **moves** (+10% moves `r1-dark-suit-bob` and `r1-dark-suit-kill`; +1 ULP moves nothing); `darkSuitDamage` and `darkShieldDamage` stay **corpus-blind** (at +10% the kills still land on the same contact / the same sixth bump). One older verdict moved, by a corpus gain: `velocityEpsilon` (friction's dead zone) was corpus-blind over 166 tapes and now **moves** at +10% only, only on `r1-dark-shield-bobboss`. No older tape moved under any key. Why that tape sees it (plausibly: the unshoved form 2's small velocities near the dead zone) is not probed |
| entities | 461 | **461** | no new leaf (`CHASERS` untouched) |
| tape index / tapeRunner | 168 / 393 | **174 / 405** | the six witnesses, 2 rows each |
| roster pins | 168 (inert 167), 168, 168 ×2; R8 `exposed` 30 | **174 (inert 173), 174, 174 ×2; R8 `exposed` 33** | `exposedAdded` + the test's three name lists: `r1-dark-suit-bob`, `r1-dark-suit-kill` (L4), `r1-dark-shield-kill` (L22, which joins the synthetic bridged set). `R8_D2_SHIELD.pressExposure.reachingAdded` gains `r1-dark-shield-spinner` (no kill) |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** at `bb7dfad` | instruments 303 → 305 (the planner, the census probe); the docs index follows the doc edits; `check-procgen-docs` ALL CHECKS PASSED |
| `check-procgen-help` | 15 FAILED | 16 FAILED | `plan-seedling-r1-dark-suit.mjs`: IMPORT SIDE EFFECT, the same shape as its seven sibling planners (`plan-seedling-u7…u12`), all in the base's 15 |

## What the brief got wrong (measured)

1. **"`hitByDarkStuff` … retires that enemy's i-frames permanently"** (the refusal text, and `combat.js`'s header, which I did not edit: it is outside the licence). Every damaging hit reassigns the latch (`hitByDarkStuff = (t == "Shield" || t == "Suit")`). The game reads it false after a sword hit, at t20 in U11's tape and at t6 in `r1-dark-shield-spinner`.
2. **"Use U11's L4 bob shape" for the shield KILL.** L4's bob falls into the pit long before a sixth bump. The kill needs six hits 30+ ticks apart (L22, 476 ticks).
3. **"Witness: U5's `swim-u5-bobboss-encounter` shape with `hasDarkShield` granted."** Vacuous: U5's two bumps are inside form 1's i-frame, and the dark arm never fires.
4. **"If the boss's form-2 spin re-seed is an RNG draw … STOP."** It is arithmetic: `swordSpinBegin[i] = 3π/2 + 2π/swords·i`.
5. **"A latch for `bobBossHit`" as the whole BobBoss arm.** Form 2's `swords++` has its own gate (`hitsTimer <= 0`), which the latch does not open: a latched hit damages the boss and adds no sword.
6. **"An enemy KILLED by the retaliation … is D2's `startDeath` arm."** True for a contact. For a PUNCH it is a different thing in the game: `endAnim` overwrites the "die" anim and the body never dies. Refused by name.
7. **The census list as a target list.** With a full kit that includes the ghost sword, all 12 levels refuse at the first press (R5's ghost-sword refusal), before any contact. Without it, only 6 of 12 reach the suit with this probe's keys. J0(a)'s ticks are not reproducible without its file.
8. **The bank SHA.** `origin/main` had moved one commit past `3534c806ed` (a `standing-values.json` bank chore). I started from `6ebd344`; every banked row reproduced there.
9. **The generated-set row in a worktree** needs `SEEDLING_PYTHON` (the primary's venv) as well as `SEEDLING_PORT`.

## Residue

- **The suit, still refused by name** (the source is named in the throw): a static census body (`enemy`: L36's `sandtrap`), the BobBoss (form 2's `swords++` would fire inside `BobSoldier`'s own blade loop, which the model collects before applying), the ShieldBoss's stab, the Owl's body, the totem's body, and a suit kill through a punch.
- **L17's next blocker** is the camera-shake on-screen band that a player hit opens beside a bob. It is not the suit's.
- **The forecasts.**
  - The chaser forecast models no player contact, so a previewed contact under the suit carries no retaliation (and no i-frame on the body). This was pre-existing for contacts, which the planner avoids.
  - The dark-shield preview kill (`dyingAt = tickOffset + 1`) is reasoned, not witnessed by a preview/drive equality.
  - The spinner forecast takes no player, so it has no bump at all (pre-existing).
- **Spinner order.** `stepSpinnerContactsNow` bills every spinner's contact after all spinners have stepped. That equals the game for one spinner; for two whose contacts and moves interleave, it is the pre-existing approximation, and a suit retaliation now writes into it.
- **The latch's own field** is not projected into `run.chasers` or `run.spinnerBodies` (U11's residue). The probes compared the game's `hit_by_dark_stuff` by hand.
- **`combat.js`'s header** claims the latch is permanent (item 1). This needs a one-line correction, outside this licence.
- **The witnesses' CI rate** is unmeasured (one recording each).
- **`standing-values.json`** was not rewritten, per the rules.
- **Scratch instruments** (session scratchpad, not committed):
  - `explore.mjs`, `explore2.mjs`, `scan.mjs` (the 169-tape suit scan), `census12.mjs` (the base run);
  - `spscan.mjs` (the L18 dark-touch scan), `spx.mjs`, `boss.mjs`, `boss2.mjs`, `offline.mjs` (the probe-row replay for the spinner mutant);
  - the patch scripts.
  - The two larger probe outputs (`r1-dark-shield-kill`, `r1-dark-suit-spinner`, 413/330 KB) are not committed; the three smaller ones are (`seedling-swim-r1-mobiles-*.json`).

## Byte-inertia

| Artifact | W0 (`6ebd344`, pristine worktree) | head (`6f4a9d9`, pristine worktree) |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 | `63d34807` `fb207b8e` `bfbdfb38` | **identical** |
| level pre/post s1 | `e28c1e5d` / `c4841acb` | **identical** |
| generated set | OK (with the venv) | **OK** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 46990775`, exit 0 | **identical**, exit 0 (the campaign row `46990775` = the bank; U13's move is not on this branch) |
| reference `--check` | 4 differ (worktree artifact) | 8 differ at `6f4a9d9` (D4's regeneration came after); **ALL 7 + 5 MATCH** at `bb7dfad` on the main tree |
| tapeRunner | 393 rows (168 tapes) | **405** (+12: the six witnesses) |
| bounded vitest | 13 files / 784 | **23 files / 1,107**, exit 0: the brief's 12 paths plus `seedlingProfile`, `profileBoot`, `seedlingProfileLoader`, `dialogueAutoAdvance`, `tapeEnvelope`, `observationTolerance`, `r8Acceptance`, `solverEncounter`, `solverSpinnerKill`, `r5Chain` |
| `fixtures/**` | — | **the six witnesses only** (tape + expectation each) and `tapes/index.json`; `campaign-frontier.json` untouched |

No identity row moved, so no mover needs explaining: the contact's reorder is byte-identical wherever no contact writes the body, and no generated room carries the dark stuff.

None of the following was touched or run: AS3, wasm, gitlinks, any committed tape or expectation other than the six new witnesses, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, unfiltered vitest. U13's and J2's regions (`campaignChain.js`, the campaign scripts, `playthroughWalk.js`, `botDriverV2.drive`, `planTilePath`) were not edited.
