# Seedling swim R4: the gameplay RNG · the Owl outside its split · the shake stream · L40's IceTurret · the preview's i-frame · pulled bodies

**Slice:** `seedling-swim-r4`, an Opus build slice run in the cloud for the swim arc (plan §18.26). ⚖ The user ruled R4 on 2026-10-02: *"Small items, then R4"*. On the shake band the ruling was *"Investigate. We might want to change the screen shake to use the cosmetic RNG instead of the main RNG."* I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `solveSegment`'s prefix admission, the solver worker), any AS3, the wasm or a gitlink.

| | |
|---|---|
| Started from | `origin/main` @ `d37d664` (S1 included: `levelRun.addEquips`, the census END-STATE row, the `identity-block.sh` fixes) |
| Head | this report's commit, on top of `27b10f7` |
| Harness branch | `claude/seedling-swim-r4-rng-1nvmhn` (the harness pins it, not `seedling-swim-r4`) |
| Commits | D0 `5a94d47` (census data) · D1 `24ab0a9` · D2 `8486528` · D3 `40250f7` · D6 `27b10f7` (records) · this report |
| Dev server | `scripts/serve-nocache.py 8980` (`SEEDLING_PORT=8980`, build `seedling_bot_ap_p4e`, headless logic-only) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every row reproduced at `d37d664`: the identity block, the six `--check`s, the reference, tapeRunner 447/447, and 24 files / 1,504 vitest tests. |
| D0 | **MEASURED (design note below)** | 28 of 195 tapes shake. Under the split, 24 of those 28 spend no gameplay draw after the first shake except the jiggle's own two. The cosmetic-RNG proposal is byte-inert for all 25 unsplit shakers. It re-records the 2 Owl tapes and removes no refusal. |
| D1 | **STOP on the split; PASS on one guard** | The build census matches the game on 112/112 levels. Unsplit, the Owl schedule plus the 675-draw build offset is exact through tick 15. The first indexed sound pick (the sword) makes the game one draw ahead on tick 16, so the split stays a premise and its stated reason is corrected. Separately, the stream had been silently one draw short after a walk-in from L113. It is now refused by name. |
| D2 | **PASS, witness first** | IceTurret's flip is `"Enemy"` → `"Solid"`, and both types are on every bridged chaser's `solids`, so the refusal leaves and the chaser reads the stepped turret's box. The witness `r4-iceturret-bobs` passes 151/151 on the game, and the bob body probe agrees on 1,632 comparisons (worst 5.6e-17). The mutant reds the 3 predicted rows. The box choice itself is unwitnessed (disclosed). |
| D3 | **PASS** | A preview started inside an i-frame now carries both the facing and the recovery. The row (preview against the drive, 30 ticks) is equal. Two mutants each red that row as predicted. The six `--check`s are identical. c3 and c6 move, each by one generated pair (explained below). |
| D4 | **STOP** | One atlas room holds pulls: L12, with 14 pulls, 0 pushables, 0 spinners, 0 solids under a pull, and one Enemy that U12 found sealed off. |
| D5 | **STOP** | The rebound is the solver's step-out wall, not a campaign step. All six `--check`s are green without it. |
| D6 | **PASS** | tapeRunner 449/449: the old 447 are identical, plus the witness's 2. Identity: two explained movers (c3, c6), all else identical. Surface GREEN 191, constants PASS 4,931, profile 138, entities 518. Bounded vitest AFTER: 25 files / 1,514 green. |

**The one thing to know first.** D3 is not inert on the procgen side. The brief predicted that no committed solve previews during an i-frame, and that holds for committed tapes: the six `--check`s are identical. A generated post-sword certification does preview there, though (`empty post-sword seed=7`, L900, two hits). Its solve is 9 ticks shorter now (195 → 186), because the solver finally prices the steering the drive gets back after the window. So c3 and c6, two identity rows, move by that one pair. The new value is the drive's own behaviour, not a regression. Still, it is a standing-value move for the coordinator to bank: c3 `348c1e9c` → `fce3ad42` and c6 `e3f101be` → `8e59dec8`.

## W0 (at `d37d664`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=8980 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Log md5 `8cdbed1e…` |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js` | **447/447** |
| surface / constants / profile / entities | the four `--check`s | GREEN 191 / PASS 4,926 / 138 keys (both tiers) / 518 number leaves |
| tape index / roster pins | `fixtures/tapes`; the four suites | 195 tapes; `dialogueAutoAdvance` 195 (inert 194), `tapeEnvelope` 195, `observationTolerance` 195 ×2; R8 exposed 40 |
| bounded vitest BEFORE | rng, finalBossRng, finalBossFight, r6Acceptance, spinner, levelRun, tapeRunner, chasers, iceTurret, pull, watchManual, solverBot, dialogueAutoAdvance, tapeEnvelope, observationTolerance, r8Acceptance, tapeIndexManifest, entityRecords, the surface/constants/entity/profile witness tests, lintGateLabels, seedlingAtlasDoorCensus | **24 files / 1,504**, exit 0 |

## D0: the shake stream, measured (`5a94d47`, `seedling-swim-r4-shake-census.json`)

**The draw.** `Game.view()` runs `if (shake > 0) { FP.camera.x += shake * Math.random() - shake / 2; FP.camera.y += …; shake = max(shake - 1, 0) }` (`Game.as:1984-1988`). That is two `Math.random()` per `view()` with `shake > 0`, on the GAMEPLAY LFSR, after the clamp and before the round.

**The census.** A model scan of the 195 committed tapes found 28 with `run.shake > 0` on some `view()`. I re-ran each on the game twice:

- with a declared seed (its own, else 987286273) under `split: true` and `split: false`;
- to its end, and to the tick before its first shake.

The value read is the LFSR distance from the seed to the latched `rng.gameplay`. Under `split: true` the stream holds `Math.random` only, so it IS the gameplay stream.

| tapes | gameplay draws after the first shake, other than the jiggle's 2 per `view()` |
|---|---|
| 24 of 28 (every r1/r2/r3/r5/r8/r9/u7/u9/u10/u11 shaker, `r6-shield-control`, `r6-totem-control`, `r6-contact-pair-standing`, `u15-turret-spit`) | **0** |
| `r6-contact-pair-heart`, `r6-contact-pair-live` | 12 each (both die and respawn; not attributed further) |
| `r6-owl-control`, `r6-owl-kill` | **907**, **888**: the Owl's own rolls, which the model reads |
| `r6-totem-kill` | −2. The model's jiggle-tick count is one tick high there (the totem death's frozen render frames), so the jiggle's count is an upper bound in that tape |

3 of the 28 declare the split: `r6-owl-control`, `r6-owl-kill` and `u15-turret-spit`. Unsplit, the stream after the first shake also carries cosmetic draws: 1–5 a tape for most, and 78 / 363–703 / 484–485 where a world is rebuilt or the totem fight runs. Those values move under any shake change, but nothing modelled reads them.

What else reads the gameplay stream, from the AS3 (`Math.random` sites):

- at a build: `Enemy`'s `coins` field initializer (with a second `coins` declared by `Spinner` and `WallFlyer`), `Orb.randVal`, and `Tile.addGrass` (12 blades × 2);
- per event: `Enemy.dropCoins`'s `astart` on a death, `Chest`'s coin spray and seal index, `SealPiece`, `Game.as:749`'s seal index, and `TentacleBeast`'s spawns;
- in L112: `FinalBoss`'s rolls and `RockFall`'s scale.

On the committed roster only the Owl and the contact pair's respawn rebuild fire after a shake.

### The design note: shake on the cosmetic RNG

**The AS3 diff** (two lines, `Game.as:1986-1987`):

```
-     FP.camera.x += shake * Math.random() - shake / 2;
-     FP.camera.y += shake * Math.random() - shake / 2;
+     FP.camera.x += shake * Rng.cos() - shake / 2;
+     FP.camera.y += shake * Rng.cos() - shake / 2;
```

**What it does.** `Rng.cos()` IS `Math.random()` while `Rng.split` is false (`Rng.as`, the `!split` arm first, "the byte-inertness of every committed fixture"). So:

- **The 25 unsplit shakers are byte-identical.** Re-record set: 0.
- **Under the split the jiggle leaves the gameplay stream.** The draws it would move are the ones after the first shake:
  - **Re-record set: `r6-owl-control` and `r6-owl-kill`.** These are the 907 and 888 Owl rolls from t72, which move every later rock and grenade and with them the player's stream. The two Owl oracle fixtures (`owl-rng-oracle.json`, `owl-prefix-oracle.json`) are game-measured draw counts under the split with rocks landing, so they need re-measuring too.
  - **`u15-turret-spit`** spends 0 gameplay draws after its shake, so its player stream should hold. Its cosmetic stream gains 10 draws, which moves its latched `rng.cosmetic` and any later indexed sound pick. Expectations carry only the player stream, so this is a verify-on-rebuild item, not a predicted re-record.

**The model simplification.** `OWL_DRAW_SITES` loses `jiggleX`/`jiggleY`. `owlTickSites(phase, shaking)` loses its second argument, and `owlJiggleNow` and the "+2 on ANY frame with `shake > 0`" row disappear. The Owl schedule stops depending on the shake bookkeeping, which itself rides the camera band. That is the rock-landing → shake → +2-per-frame feedback loop §16.8 named.

**What it does not do.**

- It **removes no refusal.** The shake band stays a band: the jiggle's VALUES come from a stream the model does not index either way. `shakeAcrossLoad`'s uncertain arm stays. The Owl's split premise stays (D1): without the split, `Rng.cos()` is still `Math.random()`.
- It **does nothing for the 25 unsplit shakers.** Their jiggle stays on the gameplay stream. That is harmless today: 24 of them spend no other gameplay draw after the first shake, and the model reads that stream nowhere outside L112.

**The risk.**

1. It is an AS3 edit plus a wasm rebuild of `seedling_bot_ap_p4e`, plus the wasm gitlink bump (ASK FIRST) and its pins re-record.
2. Under the split the cosmetic stream is a declared seam channel (v8 `rng.cosmetic`), so a split chain that crosses a shake moves its successor's declared cosmetic state.
3. Routing it through FlashPunk's own LCG (`FP.random`) instead would take it off the gameplay stream for every tape. But it would move the `fp.seed` latch and the `FP.choose` consumers of all 28 shakers, a much larger blast radius.

**Verdict.** The change is cheap and safe (inert unsplit), but it buys little now. It re-records 2 Owl tapes plus 2 oracle fixtures and deletes one schedule term. Pair it with the deferred dead-frame lockstep rebuild rather than spending a rebuild on it alone. ⚖ The decision is the user's.

## D1: `Enemy` ctor draws, and the Owl outside its split (`24ab0a9`, `seedling-swim-r4-build-census.json`)

### The build census (measured on the game, every level with an arrival)

Each level was booted at its first arrival with `tick_count: 0`, `noDamage`, and a declared seed. The LFSR distance to the latch is the build's draw count.

| quantity | AS3 prediction | game |
|---|---|---|
| gameplay (`split: true`) | `Enemy`'s `coins` (+1 for `Spinner`/`WallFlyer`) + 1 per `Orb` + 24 per in-bounds grass tile (`.oel` `<tiles>` column 1 or 10) | **112/112 levels equal**. 72 levels draw at least one; max L12 = 3,145 (1 puncher + 131 grass tiles) |
| cosmetic share (`split: false` − `split: true`) | 3 per in-bounds `Tile` + 1 per grass blade | equal on 79 levels; the other 33 carry a few more cosmetic ctor draws (L12 +11, the late dungeons +60 to +180), not attributed |

- L112 costs **2** gameplay draws (`finalboss` `coins`, `orb` `randVal`, which is `OWL_LEVEL_BUILD_DRAWS`) and **677** unsplit (225 tiles × 3 + 2).
- L113 costs **1** and L111 **3** (their orbs).
- Two predictor bugs the game caught on the first pass:
  - the atlas tile list merges the `.oel`'s cliffside layer;
  - tiles outside the level bounds are skipped by `loadlevel`.
- The gameplay counts were exact once I read the `.oel` itself.

### Can the model carry the stream without the split? Measured, tick by tick

I re-declared `r6-owl-control` `split: false` and truncated it on the game at n ticks. The model's Owl schedule was fed the same seed advanced by the 675 tile draws (so the tiles come first, then the 2 ctor draws):

| n | 1 | 3 | 4 | 8 | 14 | 15 | **16** | 30 | 71 | 100 | 150 | 300 | 500 | 727 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| game | 677 | 677 | 678 | 682 | 688 | 689 | **691** | 692 | 749 | 823 | 917 | 1289 | 1526 | 2015 |
| model + 675 | 677 | 677 | 678 | 682 | 688 | 689 | **690** | 691 | 748 | 822 | 914 | 1287 | 1526 | 2014 |

- **Through tick 15 they agree to the draw.** Tile-first is confirmed, and the walk phase's one roll per tick is exact.
- **Tick 16 is the sword press held at index 15.** `Player.slashing`'s setter calls `Music.playSound("Sword")`, an INDEXED pick (`intInd == -1`), which is `Rng.cos()` and therefore `Math.random()` unsplit. The latch's `Music.currentSet` flips "Text" → "Sword" on that tick. The press held at index 2 picked nothing: the intro freeze ate it, and `currentSet` stays "Text" through tick 8.
- **After the pick the two fights part.** Every later roll is one position off, and the residual goes +1, +3, +2, 0, +1: non-monotone, so these are different fights.

**Verdict: the split is the only SOUND way at this rung (STOP).** The build is fully attributable both ways, so it is not the obstacle. Without the split, the per-tick stream needs every INDEXED pick the room can reach:

- in L112: the sword (slash and dash), `Player.hit`'s "Hurt", and a grenade's "Explosion";
- with the kit: "Stab", "Fire", "Wand Fire/Fizzle" and the water sounds.

Each pick is one draw, or a rejection loop while the pick repeats `Music`'s last (set, index), which is a page-history pair ("Text", 0 at this boot). A missed site does not throw: it shifts every later rock. The refusal stays by name.

**Its stated reason was wrong, and is corrected.** It said `Music.playSound("Rock", 0)` picks a variant on every rock landing. An explicit index takes `playSound`'s else arm (`Music.as:734-735`) and draws nothing. The message now names the measured sites. Its first clause (`needs \`rng: { split: true }\``), which `watchManual.test.js` and the JS arc's `jsRuntimeAtlas.test.js` match, is byte-identical. `finalBossRng.test.js`'s row pinned the old cite `Music.as:673` and is re-aimed at the new words (R3's lesson, applied late: I grepped for the clause, not the cite).

### The guard (the one model change)

`owlStreamFor` charged only L112's own build, which is the stream only when L112 is built first after `botStart`'s reseed. **Measured:** R2's D4 drive (L113's south door into L112), with `rng: {seed: 1, split: true}`, had the game at **3** draws after the entry (L113's orb, then L112's two), while the base model's Owl stream read **2**. That is one behind from the first draw, silently. The stream now opens only in the boot room, on its first build (`worldEntries === 0`), and otherwise refuses by name.

- **Row** (`r4Swim.test.js`): the split drive refuses on t123 in L112 with the new words. The unsplit drive still refuses with the premise's old words first (R2's D4 witness is untouched).
- **Mutant** (predicted first: that row alone reds, the run reaching t165): the guard disabled, one build. **Measured exactly that**: *"expected 165 to be 123"*, 24/25 green. Restored md5-identical (`595984f9…`).
- **Parity:** tapeRunner 447/447 on the D1-only tree. The Owl tapes keep 1356 and 1327 (boot room, first build).
- R2's `foldRoundTrip` witness rides the PREMISE refusal, which D1 keeps, so it needed no re-aim.

## D2: L40's IceTurret at boot (`8486528`)

**The refusal, as read.** `assertChaserSolidsBound` refused any room holding a bridged chaser and an `IceTurret`, because its runtime `type` is rewritten (`IceTurret.as:94`, `else if (!collide("Player", x, y)) type = "Solid"` in the corpse arm). The question it asked was "does this body BLOCK a chaser?"

**The AS3.** Alive, the turret is `"Enemy"`, a 32×32 box, and its `input()` snaps y by 8 px the first time it runs on screen. As a corpse it is 16×16 (`death()` re-arms it rather than destroying it), `"Enemy"` while the player overlaps and `"Solid"` after, and it slides when bumped by Fire or Pulse. A chaser's `solids` is `Mobile`'s base list (with `"Solid"`) plus `Bob.as:39`'s `"Enemy"`; the puncher's adds `"Player"` too. **Both sides of the flip block every bridged chaser**, so the TYPE has one answer. What the census could not carry was the BOX.

**The step.**

- `assertChaserSolidsBound` derives, per room, whether every bridged tag's `solids` carries both types (`flipBlind`). If so, the turret leaves the refusal. `FinalBoss` and `BossTotem` stay in it, because their bodies move.
- `chaserStaticEnemyBoxesNow` is one helper, used by both `stepChasersNow` and `chaserForecastNow`. It reads the census for the static bodies, and the STEPPED turret's `iceTurretRect` for the turret (alive and snapped, or a corpse; removed blocks nothing).
- A corpse sliding into a live chaser (its `solids` gain `"Enemy"`, `IceTurret.as:148`) is refused by name.

**The witness** (`plan-seedling-r4.mjs`, with `--check`; recorded with the step in the working tree, R2's disclosed protocol, and judged by the game):

| `r4-iceturret-bobs`: L40, boot (400,448) ⇒ (408,456), damage on, 150 ticks still | model | game |
|---|---|---|
| the run | ran all 150 ticks (the base refused at boot by the type-rewrite name) | 151/151 observations; no hit, no freeze |
| `bob@352,448`, `bob@352,416` | chase, fall into pits on t53 and t67 | body probe (`--class=Bob`): **1,632 comparisons, worst \|Δ\| 5.6e-17**; each bob exists exactly while the model's does |
| `iceturret@472,400` | volleys on t4, 49, 94 and 139; the blasts break on walls | the player is never frozen |

- **Mutant (a)** (predicted first: 3 red, the witness's two tapeRunner rows and `r4Swim`'s L40 row, by the old refusal at boot): `flipBlind` forced false. **Measured exactly that**, 450/453. Restored md5-identical (`d12688b1…`).
- **Mutant (b)** (predicted first: all green): the census box instead of the stepped one. **Measured 453/453 green.** ⚠ **The box choice is unwitnessed.** `wandlock@448,432` seals the turret's corridor from the bob room. It opens only through R5's button chain, whose committed tapes are `noDamage` (no chaser is stepped). No reachable bob meets the turret's box today.

## D3: `previewStepper`'s facing and recovery in an i-frame (`40250f7`)

**The defect, measured** on `u11-facing-knockback`'s staging after 21 ticks (`hits 1, hitsTimer 18, directionFace 3`, the knockback carrying the player north). I previewed 30 ticks of `up` and compared them with the drive:

- the preview faced **1** where the drive faced **3** on all 18 i-frame ticks;
- it **never steered again** after the window: it stayed at y 55.761 while the drive walked north from tick 19.

The brief named the facing. The frozen steering gate (`steerBlocked` from the snapshot) is the second half.

**The step.** When the preview starts inside an i-frame (`hitsTimer > 0 || directionFace >= 0`), the damage state rides the preview's own states on a **Symbol** key (`PREVIEW_DAMAGE`). Spreads copy it, and `JSON.stringify` and every memo keyed on it do not see it. Each preview tick passes `steerBlocked: !canSteer(d)` and `directionFace: d.directionFace`, then runs `stepPlayerDamage(d)` and hands the facing back on the recovery tick, as the drive's player slot does. A caller's hand-built state falls back to the snapshot, which is the old reading. Outside an i-frame the closure is 12c's, field for field (a row asserts that no Symbol key appears).

- **Row:** preview against drive, 30 ticks, equal in x, y and direction (3 through the window, 1 after it, walking north).
- **Mutant (a)** (predicted first: that row reds on direction): `directionFace: -1` restored. **Measured: 1 red, direction 1 against 3.**
- **Mutant (b)** (predicted first: that row reds on y from tick 19): the gate frozen at the snapshot. **Measured: 1 red, y 55.761 against 54.961…**
- Both restored md5-identical (`733f1409…`).
- **Parity:** the six `--check`s are identical (the committed solves never preview inside an i-frame), and tapeRunner and solverBot are green.
- **c3/c6 move** (one generated pair each). See the byte-inertia block.

## D4: pulled bodies — STOP

An atlas census (`createPulls` over every level, the model's world for the solid test):

| room | pulls | pushables | spinners | solids under a pull (`pullModelled`) | Enemies |
|---|---|---|---|---|---|
| L12 (`OverWorld/region1.oel`) | 14, in x[560,608) y[640,736) | 0 | 0 | 0 | `puncher@416,256` (about 410 px from the field; U12 found it sealed off) |

L12 is the only room with a pull, so no reachable room holds a pull plus a body. The two refusals stay by name. The generator places no pull.

## D5: the post-landing rebound — STOP

U6's residue names the rebound as *"the step-out wall that remains"*. It shows up as the sweep's 2 *"no step out"* cells, the hammer-safety vehicle (7,2) and the ⚖ 47 (128,112) boot: survey rows, not campaign steps. All six producer `--check`s (the battery, the d2 chain, L18, the tail, L3 and the campaign) are green at W0 and at head without it. Pricing it means a landing-conditioned forecast in the solver's strike planning (`solverBot.js`), so it is solver work and was not attempted.

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 191 | **GREEN 191** | `--write` records `runObject` 188 → 189 properties (method 16 → 17). That is **S1's** `levelRun.addEquips` (`c66a10e`), which S1 did not `--write`. R4 adds no run member (189 = 189 at `d37d664`, measured with `runObjectMembers`) |
| constants | PASS 4,926 | **PASS 4,931** | the chaser speed literal retargeted to `chaserStaticEnemyBoxesNow` (its two per-site rows retired); the preview's i-frame test classified (the `hitsTimer > 0` timer gate, the `directionFace >= 0` sentinel); `--profile-rows` → `--write` → `--check` |
| profile | 138 | **138**, both tiers `--check` PASS | no new key, so no witness tier is owed |
| entities | 518 | **518** | no new record or leaf |
| tape index / tapeRunner | 195 / 447 | **196 / 449** | `r4-iceturret-bobs` |
| roster pins | 195 (inert 194), 195, 195 ×2; R8 exposed 40 | **196 (inert 195), 196, 196 ×2; R8 41** | moved by name: `dialogueAutoAdvance`, `tapeEnvelope`, `observationTolerance` (`names`, `swapped`); `r8Acceptance` declares `r4-iceturret-bobs` in L40, and L40 joins the synthetic bridged set (the mirror rule; the first AFTER run caught it) |
| `seedlingAtlasDoorCensus`, `lint-gate-labels` | green | **green**, unedited | |
| reference | ALL MATCH | **ALL 7 + 5 MATCH**; instruments 315; `check-procgen-docs` ALL CHECKS PASSED | |
| `check-procgen-help` | not measured at base | 25 FAILED | `plan-seedling-r4.mjs` is IMPORT SIDE EFFECT, the same shape as `plan-seedling-r2-singles.mjs` and its sibling planners |
| bounded vitest AFTER | 24 / 1,504 | **25 files / 1,514 green**, exit 0 (the first AFTER run read 1 red, fixed in `27b10f7`) | the W0 set plus `r4Swim` |

## What the brief got wrong (measured)

1. **"1 of those 28 [shaking tapes] declares `rng.split`"** (R2's figure, quoted). Measured at this roster: **3** (`r6-owl-control`, `r6-owl-kill`, `u15-turret-spit`). The 28 is a different 28 too: R2 counted tapes that CAN shake (rock-fall rows included), and I counted tapes whose run DOES shake.
2. **The Owl refusal's premise** (*"`Music.as:673`'s sound-index pick draws … once per ROCK LANDING"*, in the module and in the refusal). `RockFall` plays `"Rock"` at index 0, which draws nothing. The unsplit stream's extra draws are the build's `Tile` ctors (675 in L112) and the INDEXED picks (the sword first, on tick 16).
3. **"D1: can the model carry the gameplay stream for ANY level?"** The build half can: 112/112 levels are predictable from the `.oel`. The per-tick half cannot be carried soundly without the split. And even WITH the split, the model was not carrying it soundly for a run that walks into L112: that was a silent one-draw error, now a refusal.
4. **"D3: no committed solve previews during an i-frame."** True of the committed tapes (the six `--check`s are identical). False of the procgen certification: `empty post-sword seed=7` previews in two i-frames, and c3/c6 move by its 9-tick-shorter solve.
5. **"D2: IceTurret type rewrite"** as the obstacle. Both types block every bridged chaser, so the TYPE had one answer. The census could not answer the BOX (snapped on screen, shrunk as a corpse).
6. **"Search the atlas for pull + body rooms" (D4).** There is one pull room, and it holds no pullable body a player can bring to a pull.
7. **My own predictions:** all five mutants landed as predicted. One miss: the first AFTER vitest run reddened `r8Acceptance`'s "ROOMS move" row, because I had declared the tape without adding L40 to the synthetic bridged set.

## Residue

- **⚖ The shake → cosmetic-RNG change** is the user's to make (D0's note): AS3 plus wasm plus the gitlink (ASK FIRST), re-recording `r6-owl-control`, `r6-owl-kill` and the two Owl oracles.
- **The Owl without the split** stays refused. A model of it needs `Music`'s no-repeat state (a seam-declarable page quantity) and every indexed site the room reaches.
- **An Owl stream for a run that walks in.** Refused now. Modelling it would charge the boot room's build (the census formula is exact) and every gameplay draw of the walk: the jiggle while shaking (including the fade's dead frames), `dropCoins`, chests, and so on.
- **The IceTurret box choice** is unwitnessed until a damage-on tape opens `wandlock@448,432`. A corpse sliding into a chaser stays refused.
- **The cosmetic share of 33 levels' builds** (L12 +11, L52 +160, …) is not attributed (other `Rng.cos()` ctor sites). Nothing reads it today.
- **`crossSwapStatics.js:473`** cites `Music.as:673-676` for `playSound`'s loop, a stale line number (now `:726-733`). It is not this slice's file, so I left it.
- **The standing values for c3/c6** need re-banking at the merge (`standing-values --write` was not run).
- **The witness's CI rate** is unmeasured (one recording).
- **Scratch instruments** (session scratchpad, not committed): `shakescan.mjs`, `shakegame.mjs` (D0), `buildcensus.mjs`, `buildpredict.mjs`, `owltrunc.mjs`, `owlmodel.mjs`, `owlev.mjs`, `walkin.mjs`/`walkinmodel.mjs`, `d1guard.mjs` (D1), `l40.mjs`, `l40b.mjs`, `l40map.mjs` (D2), `d3probe.mjs` (D3), `d4.mjs` (D4), `members.mjs` (the surface attribution), and every log.

## Byte-inertia

| Artifact | W0 (`d37d664`) | head |
|---|---|---|
| maze / acceptance / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `b11d9564` `a20bcbe8` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d` `c4841acb` · OK | **identical** |
| **c3** | `348c1e9c` | **`fce3ad42`** (D3). One row: `empty post-sword seed=7` (L900, two hits, the certification previews inside both i-frames), first solve 195 → 186 ticks; same level, kept pair and final tick 642. Attribution: D1+D2 alone reproduce `348c1e9c` (worktree at `8486528`); D3 gives `fce3ad42` |
| **c6** | `e3f101be` | **`8e59dec8`** (D3). The same pair: `empty post-sword seed=7`, first solve 195 → 186 ticks; same level, kept pair and final tick 373. D1+D2 alone reproduce `e3f101be`; D3 gives `8e59dec8` |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, exit 0 | **identical**, exit 0 |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** |
| identity log md5 | `8cdbed1e…` | `25bb24ae…` (the c3 and c6 lines only; `diff` shows nothing else) |
| tapeRunner | 447 | **449**: the 447 identical, plus the witness's 2 |
| `fixtures/**` | — | new: `r4-iceturret-bobs` (tape and expectation) and `tapes/index.json`; `campaign-frontier.json` untouched |

Untouched or not run: AS3, wasm, gitlinks, any committed tape or expectation, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, the unfiltered vitest. The JS arc's files (`jsRuntime*.js` and its tests, `flashPanel/*`, `solveSegment`, the solver worker) are untouched too.
