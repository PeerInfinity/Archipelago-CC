# Seedling swim U7: the puncher, stepped — chase, punch and death at game parity; step 24 moves to a new wall

**Slice:** `seedling-swim-u7`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15.7, ⚖ Q34). Siblings U5, U6 and U8 ran in parallel. None of their regions were edited: no `solverBot.js`, no `bobBoss.js`, no `dangerMap.spinnerDanger`, no generator defaults or presets.

| | |
|---|---|
| Started from | `origin/main` @ `f4a4a28` (two bank commits past the brief's `4081ecc742`, which is its ancestor) |
| Harness branch | `claude/puncher-enemy-class-17yqu9` |
| Commits | D1 `3823e53` · D2 `f61ccf8` · D3 `213a14c` · D4 `e9a307f` (survey JSON) · D5 `abae662` · this report |
| Dev server | `scripts/serve-nocache.py 8880`, `SEEDLING_PORT=8880`, build `seedling_bot_ap_p4e` (the default) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced. The 14 differential rows: 14/14 PASS. |
| D1 | **PASS**, with the parity gate shown **vacuous** | `CHASERS.puncher` is bridged and steps where Bob steps. All 14 puncher-room tapes are `noDamage`, under which the run steps no chaser, so they cannot see the chase: tapeRunner 365/365 by gate, and both mutants left all 365 rows identical. The real chase parity comes from the D2/D3 witnesses. |
| D2 | **PASS** | The punch. `u7-puncher-punch` was recorded on the game and the model reproduces all 121 observations. The probe compares the puncher itself: 121 ticks, positions bit-exact. |
| D3 | **PASS** | The death. `KILL_ARM_POLICY.Puncher` → `modelled`. `u7-puncher-kill` matches all 129 observations; 120 puncher comparisons (position, velocity, `hits`, `hits_timer`, presence) agree. |
| D4 | **NEW REFUSAL** (not the predicted SOLVED) | Step 24 is REFUSED by a new name in 139 s: the chaser KILL arm's stance scan is centred on the player, 470 px from the puncher. The next two walls were measured on a scratch tree and not shipped. Steps 22, 23 and 25–29 are byte-identical to U4. |
| D5 | **PASS** | Log section, bot page, census label, reference and docs index, surface GREEN 185, constants PASS, bounded vitest green. |

**The one thing to know first.** The puncher is now a modelled class: the game confirms its chase, punch and death to the bit on two driven tapes. Step 24 still refuses, but no longer because of the simulation. Three solver walls stand behind each other: the kill arm's stance scan centre, the static punch pad at the dwell, and the decision gate's pad on live bodies. The first two have a measured, inert-on-the-six-checks patch in § D4; the third is in the goal loop (U5's region).

## W0: the banked rows (clean tree `f4a4a28`)

| Row | Result |
|---|---|
| identity block | maze `246dfbce…`, acceptance `d02ed4c0…`, c3 `d43a8c97…`, c6 `62b5475f…`, c4 `556eb1ee…`, ENEMY `fdff69ee…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`999e1900…`, level pre/post s1 `e28c1e5d…`/`0076f26f…`, generated set OK, reference ALL 7 + 5 MATCH |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0 |
| campaign census | exit 0, `NO CHAIN ROOM MOVES` (md5 `379a4806…` on the scratch worktree, `88fa2333…` on the main tree; the output embeds the tree path, and both normalise to `62a54108…`) |
| surface / constants | GREEN 185 / PASS (4,399 literals) |
| profile / entities md5 | `be8b983b…` / `b378bf42…` |
| bounded vitest (the brief's nine paths) | **11 files / 730**, tapeRunner **365/365** |
| the 14 differential rows (`--only=` the 14 names) | **14/14 "live game matches the committed oracle stream"**, 306 PASS / 0 FAIL lines, `ALL CHECKS PASSED` |

⚠ I began editing before the identity block's last producer (`r9-campaign --check`) had finished. Its digest matched the bank, but its exit-code run may have imported early D1 edits. Every row after that (campaign census, surface, constants, md5s) was measured on a scratch worktree at `f4a4a28`.

The 14 tapes: L12's seven `r2-walk-4-spear`, `r2-walk-5-darkshield`, `r3-walk-3-torch`, `r3-walk-4-spear`, `r3-walk-5-darkshield`, `r4-walk-3-torch`, `r4-walk-4-approach` (1,354–3,707 ticks), and L40's seven `r5-l40-*` (493–1,978 ticks). They were run by name, not by tier.

## D1: the chase (`3823e53`)

### The transcription

| field | `Puncher.as` | value | where it lives |
|---|---|---|---|
| leash `runRange` | `:22` | 80 | `PROFILE.puncherRunRange` → `combat.PUNCHER_RUN_RANGE` → `ENEMY_CLASSES.puncher.aggro.range` (anchored) |
| chase block | `:62-73` | Bob's eleven lines, no target offset | `chaseImpulse`, reused; `targetOffset {0,0}` |
| freeze gate | `:56` (`destroy` / "die" only) | none | `freezesOnGameFreeze: false` |
| solids | `:48` `push("Enemy", "Player")` | base + Enemy + Player | `SOLIDS_BY_MOVER.puncher`. The run's sweep stops against the player's box (live and forecast). |
| die animation | `:44` `add("die", [30..39], 10)` | 10 frames, rate 10 → 31 updates | `PROFILE.puncherDieAnimFrames` / `puncherDieAnimRate` (anchored `after:39], `) → `chasers.PUNCHER_DIE_ANIM` |
| speed, hitbox, damage | `:18`, `:46`, `:50` | 1, 12×12 origin (6,4), 1 | `ENEMY_CLASSES.puncher` (already there) |
| bridged | — | `[bob, puncher]` | `spinner.MODELLED_ENEMY_CLASSES.Puncher.module = 'chasers.js'` |
| contact pricing | — | `stepped`, billed by `stepChasersNow` | `combat.CONTACT_STEPPED_FAMILIES/PRICED_BY/WHY` |

`assertChaserSolidsBound` now asks per bridged tag rather than of the first one found. The R8 bridge's declared scope is `[bob, puncher]`.

### The parity gate, and why it is vacuous

- **Predicted:** tapeRunner 365/365 unchanged.
- **Measured:** 365/365.
- **Why it cannot be otherwise:** every one of the 14 tapes declares `noDamage: true`. `stepChasersNow` opens with `if (noclip || noDamage) return;`, so the model never steps the puncher in them. The R8 exposure guard (`assertBridgeExposureIsMeasured`) re-derives from disk which tapes retire `noDamage` and enter a bridged room. Over the widened bridge it found **zero** new ones.
- The differential rows replay the **game** against committed expectations, so a model edit cannot move them. They are a staleness gate, not a parity gate.

| mutant | predicted | measured |
|---|---|---|
| (a) `runRange` halved (`PUNCHER_RUN_RANGE / 2` in the census row) | 365/365 identical, non-discriminating | **365/365** |
| (b) speed doubled (`speed: 2`) | 365/365 identical: no tape is exposed, so none can move first | **365/365** |

Both copies were restored md5-identical (`c48fabcd…`). Neither mutant moves a row: **the 14 tapes do not exercise the chase.** So, per the brief, synthetic witnesses carry the parity (D2, D3). Rather than a chase-only tape, the punch witness's own pre-punch window is the chase witness: its puncher readout is compared per tick.

## D2: the punch (`f61ccf8`)

`Puncher.update`'s tail and `endAnim`'s attack arm:

1. Within `attackRange` 10, measured from the position this tick's move left, the body plays "attack-*": four frames at rate 12, so an 11-update wind-up.
2. During the wind-up the chase does not run (`getSprite() != "attack"`); friction still slides the body.
3. The wind-up's callback runs `attackPlayer`:
   - it returns if the puncher's own `hitsTimer > 0`;
   - otherwise it re-aims at the player (`|dx| > |dy|` → east/west, else south/north);
   - the punch box is `r = 8` deep off that edge of the body;
   - a hit is `p.hit(this, punchForce 5, Point(x, y), damage 1)` through `applyPlayerHit`, source `punch`.
4. `play("die")` replaces a wind-up.
5. The chaser forecast carries the same wind-up, so its chase gate agrees; it throws no punch.

New profile keys: `puncherAttackRange` 10 (`combat.js`), `puncherAttackAnimFrames` 4, `puncherAttackAnimRate` 12, `puncherPunchForce` 5, `puncherPunchReach` 8. All but the frame count are anchored to `Puncher.as`. The facing codes have a reviewed structural target.

### The witness `u7-puncher-punch`

L12, boot (384,256): two tiles west of `puncher@416,256`, d = 32. No item, `noDamage` false, standing still for 120 ticks. Authored by `plan-seedling-u7-puncher.mjs`, which has a `--check`.

| | model (predicted before recording) | game |
|---|---|---|
| attack decided | t34 (x 401.32, d ≤ 10) | anim `attack-side` from the t34 sample |
| punch 1 | lands t43, the player moves first at t44 (−4.75 px), knockback dx −4.99991 (the body sits at y 264.048) | identical |
| punch 2 | t108, against the corridor's west wall (`hits` 2) | identical |
| terminal | `hits` 2, `hits_timer` 7, alive | 2 / 7 |
| `--record` | — | **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 121 observations"** |

**The puncher itself** (`probe-seedling-u7-puncher-mobiles.mjs --tape=u7-puncher-punch`): 121 sampled ticks, one per tick. The clock is calibrated on the player's x, and exactly one shift fits: [0]. Position, velocity, `hits` and `hits_timer` match the model at every tick. Positions are **bit-exact**; velocity is within 2.2e-16. The game's anim reads `walk-side` while closing, `attack-side` t34–43, `stand-side` at t44, and `attack-up` (a third wind-up) at t120. Committed: `CC/docs/cloud-reports/seedling-swim-u7-mobiles-punch.json`.

### Priced volume at L12's lock stances (centre y 258, the brief's U4 table)

| | volume | under `bosslock@416,240` (x 417–429) | under `bosslock@432,240` (x 433–445) |
|---|---|---|---|
| before (W0 tree) | (e) the bare body (418,260)–(430,272) | DANGER everywhere | clear everywhere |
| after, horizon 0 | (c) at the live position + `threatPad` 8: (410,252)–(438,280) | DANGER | DANGER for x ≤ 439, **clear for x ≥ 440** |
| after, horizon 80 (the key wait) | grown 1 px/tick: (330,172)–(518,360) | DANGER | **DANGER everywhere** |

The pad is the punch box (8 deep). There is no separate punch-box term.

## D3: the death (`213a14c`)

- `KILL_ARM_POLICY.Puncher` → `modelled`. The reason is rewritten: the Bob cost is paid, and the position and threat it lacked are D1 and D2.
- `CORPSE_COUNTING.Puncher` is anim+fade: 31 + 11 = **42 ticks** from the blow to the removal.
- `KILL_SIDE_WRITES.Puncher` writes `none`: no `removed()` anywhere in its chain.
- `Puncher.knockback` is an **empty override** (`:167-170`). `CHASERS[*].knocksBack` (bob/jellyfish true, puncher false) gates the press, arrow and forecast knockback sites, and the forecast's removal reads the class's corpse row instead of Bob's.

### The witness `u7-puncher-kill`

The punch witness's boot, plus a sword. One tick of `right` to face east, then a press whenever the body is in `slash()`'s reach and the 31-tick cadence allows.

| | model (predicted before recording) | game |
|---|---|---|
| landed hits | t15, t46, t77 (`hits` 1→2→3), knockback null on all three | the probe reads `hits` 1/2/3 from the t16/t47/t78 samples, `hits_timer` 30 → 0 in between |
| kill | billed t78, by press | — |
| removal | 42 ticks later; the body is absent from the last 9 samples | absent from the same samples |
| punches on the player | **0**: every wind-up ends inside the puncher's own i-frame | player `hits` 0 |
| `--record` | — | **all 129 observations reproduced** |
| probe | — | 129 sampled ticks, shift [0], **120 puncher comparisons agree**; positions bit-exact, velocity within 3.3e-16 |

L12 holds no `tset -1` lock, and the kill-lock scan computes that nil rather than assuming it.

## D4: step 24 (`e9a307f`, `CC/docs/cloud-reports/seedling-swim-u7-survey.json`, md5 `495809e4…`)

**Predicted:** SOLVED via the KILL rung (three hits), ~2,100–2,400 ticks. **Measured: REFUSED in 139.0 s** (U4: 310.6 s), by a new name:

> `reach-pit (36,43)->L21 -> keylock stance (bosslock@432,240): the combat ladder is EXHAUSTED. The corridor passes through danger at (404.6,263.8) — chaser:puncher@416,256 (inside leash 80 (d=15.9), box grown 1 px/tick x 0 + pad 8)` …
> - **avoid:** no walkable path (17,44)→(27,16) with the volume forbidden. The live padded body plugs the row-16 corridor and covers the goal tile.
> - **time:** the aim is 473 px away.
> - **bait:** 0 cells in leash.
> - **kill (press):** no presser in L12.
> - **kill, chaser arm:** `no stance derives for puncher@416,256 on level 12: 0 cell(s) inside its 80 px leash, 0 of those reachable …`

What changed from U4: the stance is now the **second** lock's, `bosslock@432,240`, and the body is a live chaser rather than a static one. No strategy was chosen; every rung refused. The chaser arm's "0 cells" is not geometry: its scan is a `STANCE_SCAN_CELLS` (8) box around the **player's** node (`deriveKillByChaser`), and the ladder is asked from 470 px away.

### Measured on a scratch tree, NOT shipped

The patch is the kill rung and the solver's danger; the third wall is in U5's goal loop.

| # | change (scratch worktree at `213a14c`) | step 24 then reads |
|---|---|---|
| 1 | `deriveKillByChaser`: when the player's scan box holds no leash cell, scan a box around the **target** instead | 274.8 s: `76 cell(s) inside its 80 px leash, 17 of those reachable and with a corridor onward, and 17 of THOSE refused by the forecast [(360,280): the WAIT is dangerous at tick 954 — chaser:puncher@416,256; …]`. The **static pad** prices the punch at every dwell tick. |
| 2 | + the chaser forecast reports each tick's punch (its box, whether the puncher's own `hitsTimer` lets it throw, whether it meets the previewed player), and `chaserDanger` (transit, forecast bodies) prices that punch exactly instead of the pad | 459.7 s: the ladder passes, then `keylock stance (bosslock@432,240): the danger map forbids (377.34,251.98) — chaser:puncher@416,256 (inside leash 80 (d=7.9), box grown 1 px/tick x 0 + pad 8). Slice 2 has NO DODGE POLICY`. This is the **decision-point gate** (`refuseDanger` → `dangerNow`) reading the **live** bodies, still with the pad. |

With both changes, the six `--check`s are on their banked digests (`410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0). The ENEMY census chamber row for the puncher goes REFUSED → **SOLVED 166**. No game witness has checked that walk, which is why change 2 was not shipped (a relaxation of pricing needs one). The patch is committed for reference only, never applied: `CC/docs/cloud-reports/seedling-swim-u7-d4-scratch.diff` (134 lines, against `213a14c`).

Steps 22, 23 and 25–29: SOLVED 48 / 229 / 26 / 89 / 383 / 336 / 210. Every row is **byte-identical to U4's JSON** (all fields but `ms`), and the route and generator blocks are identical. Steps 28/29 are U5's/U6's to move; nothing here moved them.

## Surface / profile / constants deltas

- **Profile:** 127 → 135 keys (`puncherRunRange`, `puncherAttackRange`, `puncherDieAnimFrames`, `puncherDieAnimRate`, `puncherAttackAnimFrames`, `puncherAttackAnimRate`, `puncherPunchForce`, `puncherPunchReach`); anchored 63 → 69. `profileMd5` `be8b983b…` → **`f32d4d47bad3d72516f656d785623241`**, with the pins in `seedlingProfile.test.js`, `profileBoot.test.js` and `seedlingProfileLoader.test.js` moved. No committed tape carries the md5.
- **Entities:** `entitiesMd5` `b378bf42…` → **`e338c30f15387d6178191db9ef37acd1`** (the `CHASERS.puncher` row, `knocksBack` on all three rows, the `attack` record).
- **Constants census:** 4,399 → 4,415 literals, `--check` PASS, **0 unclassified**. Two reviewed targets were retired (the census row's old `range: 80` and `reach.px: 10` literals, now profile reads). One structural target was added (`puncherPunchRect`'s facing codes). Note: `--check` after `--write` is green by construction, so a new literal can only be caught as `unclassified` in the CSV; I counted those explicitly.
- **Solver surface:** 185 → 185 rows (line numbers only), `--check` GREEN. No new facade export, no new run member.

## What the brief got wrong (measured)

1. **"Fourteen committed tapes replay … TICK-EXACTLY with the puncher static … the parity gate".** Every one of them is `noDamage`, and the run steps no chaser under that flag. Their agreement says nothing about the puncher, in either direction. The differential rows replay the game alone, so no model edit can move them.
2. **`MODELLED_ENEMY_CLASSES` is in `spinner.js`**, not `combat.js`.
3. **The die animation is ten frames at rate 10 (31 updates), and `Puncher.knockback` is an empty override.** Neither is Bob's. A struck puncher is not shoved, and the kill witness's body stays at the player's side throughout.
4. **The puncher's `solids` carries `"Player"`.** It stops against the player and never walks into them, so its contact damage needs the player to walk into it. In the punch witness every hit on the player is a punch.
5. **"the danger map's (c) pricing then carries `threatPad` 8 + the punch box"**: the pad IS the punch box; there is one term.
6. **`seedling-bot.md` has no "§ the chaser model" and no § 11.4.** The puncher sentence lives in the solver paragraph (line 355), and that is what was rewritten. § 11.4 is the R8 kickoff's.
7. **Step 24's predicted SOLVED.** It moved to a new wall (D4).
8. **The bank's pre-sword s1** in `standing-values.json` reads `45edd259…`. This tree measures `e28c1e5d…` at W0 and AFTER (U4's value). The bank row looks stale; I did not touch `standing-values`.
9. **The campaign census md5 is path-dependent.** It embeds the tree path, so `88fa2333…` is a main-tree reading, not an identity.

## Residue

- **Step 24's next three walls**, in order: the kill arm's stance scan centre (`deriveKillByChaser`); the static pad at the dwell (change 2 is measured, needs a game witness); and the decision gate's pad on live bodies (`refuseDanger`, U5's goal loop). The scratch patch for the first two is `seedling-swim-u7-d4-scratch.diff`, measured inert on the six `--check`s.
- **ENEMY census, puncher row** (moved, explained): the chamber arm went SOLVED 155 → REFUSED, *"the combat ladder is EXHAUSTED"* at `danger puncher@64,64` (the live body now walks onto the chamber route). The corridor arm went REFUSED → SOLVED 141, certified (Bob's own number). With change 2 the chamber arm solves in 166.
- **The other puncher rooms are bridged but unwitnessed:** L40 (`Dungeon4/2.oel`, two punchers), `Dungeon3/5.oel` (two), `Dungeon5/8.oel` (one). L40 also holds an IceTurret, so any `noDamage`-false tape there refuses by name in `assertChaserSolidsBound` (true before this slice, because of its twelve bobs). L40 parity "on two punchers" therefore cannot be driven until that refusal is lifted.
- **Velocity readout:** the game's `vx`/`vy` differ from the model's by ≤ 3.3e-16 (1–2 ulp at |v| ≈ 1) while positions are bit-exact over 129 ticks. I did not measure whether this comes from arithmetic order or the readout; the probe's tolerance is 1e-9.
- **`census-seedling-enemies.DANGER_BY_CLASS`** is a typed table (it now names the puncher as a chaser). It still names the unbridged jellyfish as a chaser, which predates this slice and was left alone.
- **Scratch instruments** (session scratchpad): `explore.mjs` (a tape traced through the model, with ledgers), `danger12.mjs` (the stance table), `d3.py` / `d4.py` (the patches), `six.sh`, the `exp` worktree.

## Byte-inertia

| Artifact | W0 (`f4a4a28`) | AFTER (`abae662`) |
|---|---|---|
| identity block (13 md5 rows + generated set) | as above | **identical except ENEMY census** `fdff69ee…` → `f8f24b07…` (the puncher row: "stepper yes", chaser-priced, chamber REFUSED, corridor SOLVED 141; explained above) |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | **identical**, exit 0 |
| campaign census | exit 0, NO CHAIN ROOM MOVES, normalised `62a54108…` | **identical** (normalised `62a54108…`; main tree `88fa2333…`) |
| tapeRunner | 365/365 | 369/369 (+2 rows per witness) |
| the 14 differential rows | 14/14 PASS | **14/14 PASS**, and both witnesses replay against their oracle recordings (16 tapes, 348 PASS / 0 FAIL, `ALL CHECKS PASSED`) |
| reference `--check` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH after D5's regeneration |
| solver surface / constants | GREEN 185 / PASS | GREEN 185 / PASS |
| bounded vitest (the brief's nine paths) | 11 / 730 | 11 / 741 (+ 12 files / 620 touched beside them) |
| `fixtures/**` | — | **the two witnesses only**: `tapes/u7-puncher-punch.json` `d49c1136…`, `tapes/u7-puncher-kill.json` `f25d956a…`, `expectations/u7-puncher-punch.json` `ae7e93e3…`, `expectations/u7-puncher-kill.json` `618cc801…`. `campaign-frontier.json` is untouched. |

No AS3, wasm, gitlink, committed-tape, biome default, `standing-values --write`, `pytest` or unfiltered vitest was touched or run. `spinnerDanger` was not edited, and neither was any U5/U6/U8 region (`solverBot.js` was changed only on the scratch worktree).
