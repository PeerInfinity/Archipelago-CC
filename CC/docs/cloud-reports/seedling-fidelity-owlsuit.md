# seedling-fidelity-owlsuit — the Owl's body contact at its AS3 slot, and his "Suit" retaliation (wave 49)

⚖ GO: Robert 2026-11-17 (planning-21's session), *"Owl suit contact (Recommended)"*, plus the launch GO for this brief.
Scope: ONE new `contactFidelity` key, default OFF. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-21` |
| Base | `7bb7867cfa85e448cf9f706437b2336dec3301e4` (= `origin/fidelity-harvest/darksuit-w46-w48` tip, measured; 139 keys, 126 ON, last four `wallFlyerCorpseGone` ON, `darkSuitStaticRetaliation`, `pulserForecastPulse`, `darkSuitBossRetaliation` OFF) |
| Harness branch | `claude/owl-suit-contact-dark-retaliation-t10k18` (local branch `seedling-fidelity-owlsuit`, pushed there) |
| Commits | D2 `13cfd89b` · evidence `cbe3f60e` · D2 fix `a1af1dd3` (the one-spelling law, see Gates) · this report (the head) |
| Verdict | **PASS** (CI green at `a1af1dd3` after one red push of mine, fixed; key OFF; OFF byte-identical; ON moves no route answer measured here; the 4-leg sweep is the planner's) |

**The one thing to know first:** the late bill was wrong in more than the suit case. ON also moves **no-suit**
contacts, and I staged one: on the tick the Owl snaps into a pod, the AS3 tests the contact against his **pre-snap**
point, so a lethal contact OFF bills at t425 lands at **t426** ON. So a flip is not "suit-only". It changes the timing
of any contact on a snap tick, a lava-hit tick, or a rock-spawn tick (that last one OFF refuses).

## D1 — the AS3 order

### `FinalBoss.update` (`Enemies/FinalBoss.as:85-190`)

| line | statement | reads what a contact writes? |
|---|---|---|
| 87-108 | `if (!started)` intro: `Game.freezeObjects = true` every frame until `Input.released(keys[6])` | — (the freeze gates `Player.hit`, `Player.as:1382`) |
| **110** | `super.update()` → `Enemy.update` (below) | **the contact happens here** |
| 111-114 | `if (Game.freezeObjects \|\| destroy) return;` | — |
| 116-124 | lava: `if (tile.t == 17 && !hitThisSequence) { maxForce = -1; hit(6, …, 1, "Lava"); maxForce = 2; …; return; }` | the Owl's `hitsTimer` (via `Enemy.hit`'s gate), `hits`; `v` (its knockback adds to the suit's) |
| 126-129 | `if (v.length > 4) v.normalize(4);` | **the Owl's `v`** |
| 131 | `canHit = rockfallTime < 0;` | — (but a suit hit at :110 reads LAST tick's `canHit`) |
| 132-147 | barrage: `RockFall(p.x + p.v.x * -15 + rnd, p.y + p.v.y * -15 + rnd)` | **the PLAYER's `v`** (`:144`) |
| 148-154 | `rockfallTime == 0`: pod reopens, `cpod++` | — |
| 155-182 | walk: `else if (v.length <= moveSpeed)` → grenade roll, `v = to` (assignment), pod snap `x = pod.x; y = pod.y + 1` | **the Owl's `v`** (the split); the snap **moves the point** a later contact tests |

### `Enemy.update` up to `hitPlayer()` (`Enemies/Enemy.as:62-118`)

`activeOffScreen` is true, and the terrain switch is inert for him (`dieInWater`/`dieInLava`/`canFallInPit` are false,
`FinalBoss.as:57-60`). So: `super.update()` → `Mobile.mobileUpdate` (`friction`, `moveX(v.x)`, `moveY(v.y)`, all inside
`!Game.freezeObjects`), then `if (!destroy) { hitUpdate(); hitPlayer(); }` (`:106-111`). `hitPlayer` (not overridden,
`:211-221`): `if (!destroy && currentAnim != "die" && hitsTimer <= 0) { p = collide("Player", x, y); if (p)
p.hit(this, 3, new Point(x, y), damage); }`.

### The writes, and the reads they meet in the same tick

- **`Player.hit`** (`Player.as:1374-1391`): its gate is `hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects`;
  then `if (e && hasDarkSuit) e.hit(1, new Point(x, y), 1, "Suit")` (`:1384-1387`), then `hits`, `hitsTimer`, shake,
  and `knockback(3, p)` → **the player's `v`**. The player's position does not move until the player's own update,
  which comes after the Owl's.
- **The suit's `e.hit`** → `Enemy.hit` (`Enemy.as:141-181`; `FinalBoss` has no override):
  - The clamp: `maxForce` is -1 at first and 2 after the first lava hit, so force 1 either way.
  - The gate `(hitsTimer <= 0 || hitByDarkStuff) && !freezeObjects && canHit`. `hitByDarkStuff` is never true for him:
    the only damage arm that writes it is the lava hit, which writes it false. `hitPlayer` already required
    `hitsTimer <= 0`. `canHit` is LAST tick's (`:131` runs after `super.update()`), so a suit hit during a barrage does
    nothing.
  - **`onlyHitBy = "Lava"` stops the damage arm** (`:149`). `t = "Suit"` falls to `else if (justKnock)
    knockback(f, p)` (`:176-178`): `v += (cos a, sin a)`, `a = atan2(y - p.y, x - p.x)` (`:247-255`). So no hits, no
    i-frame and no latch; `darkSuitDamage` is unread.

So four couplings, not two:

1. Under the suit: the Owl's `v` → the cap and the walk/coast split (this tick's phase and its draws).
2. The player's knockback `p.v` → the barrage aim on a rock-spawn tick. That is what the old refusal guarded, and its
   text is right; see "What the brief got wrong".
3. The Owl's `hitsTimer`/`destroy` → a lava hit on the same tick. The AS3 tests the contact BEFORE the lava hit sets
   `hitsTimer = 30` (or `destroy`); the late bill saw the timer set and skipped a contact the game lands.
4. The Owl's point → the pod snap. The AS3 tests the pre-snap point; the late bill tested the post-snap one.

### The split (`finalBossFight.js` `stepFinalBoss`)

`super.update()` is the block under `// ── super.update()` (`finalBossFight.js:497-515` at base): friction, the two
moves, then `hitsTimer -= 1` inside `if (!b.destroy)`. `hitPlayer` falls immediately after that decrement, inside the
same arm, before the `worldFrozen || destroy` return. I took wave 48's Bob shape: an optional hook, `ctx.onHitPlayer`,
called there behind the AS3's own gate (`b.anim !== 'die' && b.hitsTimer <= 0`, with `frozen: worldFrozen` passed for
`Player.hit`'s freeze test). Absent, no statement runs, so OFF is byte-identical. STOP rule: not triggered. The model
holds every state the hook needs (`b.vx/vy`, `b.canHit`, `b.maxForce`, the player's `state`).

## D2 — the key

`CONTACT_FIDELITY.owlContactInStep` is **OFF**, appended LAST (140 keys, 126 ON). Its env is
`SEEDLING_OWL_CONTACT_IN_STEP=0|1`, entered in `SOLVER_ENV_NAMES` after `SEEDLING_ORBIT_FREE_AIM` (sorted,
duplicate-free). Doc block (`contactFidelity.js`), in brief:

> fidelity OWLSUIT D2 (wave 49) — THE OWL'S BODY CONTACT AT ITS AS3 SLOT, AND HIS "Suit" RETALIATION. … The model billed
> `owlBody` AFTER `stepFinalBoss`'s arms, so four reads were wrong: (1) under the suit … `knockback(1, p)` into `v` …;
> (2) the player's knockback `p.v`, which the barrage aim reads …; (3) the Owl's `hitsTimer`/`destroy`, which a lava
> hit on the same tick sets …; (4) his point, which the pod snap moves. ON: `stepFinalBoss` calls the caller's
> `onHitPlayer` at that slot; `levelRun` bills there with `retaliate` declared …, the barrage aim reads the player
> LIVE, and the rock-spawn refusal is retired. … Composes with `darkSuitBossRetaliation` … OFF: byte-identical.

**The change.**
- `finalBossFight.js` `stepFinalBoss`: one statement, the hook call at the slot above.
- `levelRun.js`:
  - `owlSuitRetaliation(b, p)` (module level) is `finalBossHit(b, {force: DARK_SUIT_FORCE, from p, type 'Suit'})`, the
    existing transcription of `Enemy.hit` + `knockback` for the Owl (clamp, gate, `justKnock`). It returns the row
    `{id, as3 'FinalBoss', landed, damaged, force, why, vx, vy}`, where `v` is read AFTER the shove (what the
    cap and the split then read).
  - `stepOwlNow`: ON, `owlHitPlayer` makes the box test against the step's current (post-move, pre-snap) point and
    calls `applyPlayerHit({source 'owlBody', …, retaliate})`. `damage` is left to `applyPlayerHit`'s default 1, which
    is `Enemy.damage`'s default (`FinalBoss` never assigns it); that keeps a numeric literal out of a new statement.
    The noclip/noDamage/freeze exits come first; the intro's freeze now gates too, as `Player.hit`'s gate does.
  - `player` is a live getter view ON (the aim reads `state` after the knockback) and the old snapshot literal OFF.
  - The old bill below the step sits in `else if (…)`, verbatim, so OFF runs it unchanged with its rock-spawn
    refusal and wave 48's D1 try/catch. ON, that branch is `if (pendingDeath) return`, at the same place.
- `applyPlayerHit`, `playerHit` and the hashed `owlBody` statement are **byte-identical to base**.

**How it composes with `darkSuitBossRetaliation`.**

| `owlContactInStep` | `darkSuitBossRetaliation` | the suit contact |
|---|---|---|
| OFF | OFF | the plain `byEnemy` refusal (unchanged) |
| OFF | ON | the refusal with wave 48's D1 text (unchanged; row 2) |
| ON | OFF or ON | billed in-step, retaliation declared; the two ON rows are identical (row 4) |

**Key-order pins re-pinned (15 files + 1).** The ten tails (`fidelityCeremony126`, `DrillWater`, `Fencepost`,
`FireBreak`, `FireSpinner`, `FrozenPress`, `L39Phantom`, `RockButton`, `RockFire`, `RockGone`), `fidelityCorridorBody`,
`fidelityDarkSuitStatic`, `fidelityWallFlyerCorpse`, `fidelityL39Hit` (its tail now `['darkSuitBossRetaliation',
'owlContactInStep']`), and `fidelityDarkSuitBosses`'s `.at(-1)` (now a tail of `['owlContactInStep']`). Plus
`contactFidelity.test.js` (the defaults row and its env-guard line). `contactFidelityHook.test.js` gains one row by
itself.

### Rows (`fidelityOwlSuit.test.js`, fast tier, 7 rows)

Every row stages committed `r6-owl-kill` (L112 `finalboss@64,96`) with `stagingFromTape` + `createRunForStaging`.

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| suit contact (`darksuit` grant, the tape's keys) | throws at tick 27 with the `byEnemy` refusal; with `darkSuitBossRetaliation` ON it carries the D1 text | billed t27, `{landed, damaged false, force 1}`. The Owl's `v` = 0.75·(unit toward pod 0, from t25's walk) + (cos a, sin a), checked against a hand computation to 1e-12: `(1.3974, −1.0285)`, \|v\| 1.735 > `moveSpeed`. Tick 26's phase is **`coast`** (was `walk`), and it books no grenade draw |
| ON with both keys | — | identical to ON alone |
| same inputs, no suit (presses stripped from t10) | ON = OFF, whole result; t27 bills; no `retaliation` key; t26 `walk` | |
| **no suit, pod snap** (tape keys to t190, `down` ×31) | `owlBody` lethal at **t425** (the post-snap box at (48,129)) | lethal at **t426**: the snap tick (t424) tests the pre-snap point. Every Owl tick before t424 is equal |
| **no suit, rock-spawn tick** (tape keys to t30, `up+right` ×26) | throws: *"touched the player at tick 58 on a tick that also SPAWNED a rock"* | t58 is `barrageSpawn` and bills (t59 row, kb dx −2.93). `rock2@58`'s x (151) lies in the aim window of the knocked-back `p.v.x` and not in the pre-hit one (disjoint ±20 windows) |

**The no-suit search** (`tools/search.mjs`, `d3/d3-search-nosuit-*.txt`):
- Tape to t10, presses stripped, then 8 directions × `from` ≤ 280 × durations: **0** ON≠OFF in 3680 + 6560 runs,
  although 3493 had a contact. An ordinary contact is order-free.
- The tape's own keys (sword shoves kept) to `from` ≤ 800, then a hold: **5** ON≠OFF in 5120. Four are the rock-spawn
  refusal and one is the pod snap; both are rows.
- **No lava-tick contact was found** (coupling 3). The search reaches lava only through the tape's own shoves, and a
  shoved Owl leaves the player behind at up to 4 px/t. It is transcribed by the same slot, and no row pins it.

**Mutants** (copy + restore; `grep -c MUTANT` → 0 after each):
1. **The late hook**: the hook call moved to after the phase arms. Predicted: suit-ON, snap and rock rows red, 4
   green. Measured: **exactly those 3 red**, 4 green (`d2/mutant-late-hook.txt`). The suit row read vx 1.5742 vs
   1.3974, because the walk arm overwrote `v` first; the rock row put the rock at x 107 (the pre-hit window).
2. **The snapshot player**: ON, but `player` is the snapshot literal. Predicted: only the rock row red. Measured:
   exactly that, *"expected 107 to be greater than or equal to 122"* (`d2/mutant-snapshot-player.txt`).

⚠ **Not game-witnessed:** every ON row. The pieces are witnessed elsewhere (`finalBossHit`'s `justKnock` arm is the
R6 sword-shove transcription; the contact is wave 48's), but no recording has the suit, a snap-tick contact or a
rock-tick contact in the Owl's room.

## D3 — the ON measurement

### Byte-inertia (OFF)

- `git diff --name-only 7bb7867c HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty** (exit 1).
- `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` (`d3/acceptance-*.md5`):
  - base (a base worktree): `391322d681b7aa0229d94b3f6906d024`;
  - head OFF: `391322d681b7aa0229d94b3f6906d024`;
  - head ON: `391322d681b7aa0229d94b3f6906d024`;
  - head ON + `darkSuitBossRetaliation` ON: `391322d681b7aa0229d94b3f6906d024`.
  All four equal the standing value.

### The L112 legs and step

- **Survey step 246**, `--through=end --only=246`, OFF and ON: the rows are **identical** (`d3/survey-{off,on}.rows.json`).
  It is REFUSED with ENCOUNTER-GATE: `rocklock@112,16` has no strategy row, and the route meets it before any Owl
  contact.
- **Legs 786–789**: **not replayed in node.** The only leg runner is the live-wasm sweep
  (`probe-seedling-divergence-sweep.mjs`, the JS arc's producer, a browser run), and the legs have no slot rows for a
  node replay (wave 48 hit the same wall). What I can say:
  - Wave 48's D1.3 census found these four as the only L112 legs, and all four hold the suit. So no L112 leg runs
    without the suit; that matters because ON moves no-suit contacts too.
  - Leg 788's goal is the Owl location, and survey 246 says the route refuses at the rocklock first.
  - The answer is the planner's sweep.

### ON movers

- **Default tier**: the bounded set plus every default-tier file naming the Owl (`r6-owl`, `finalboss@`, `owlBody`,
  `stepFinalBoss`, `seedlingOwl`: +4 files, `director`, `fidelityApFlip`, `fidelityFrontier3`, `seedlingScriptOpeners`,
  and others already in the set), 82 files, with `SEEDLING_OWL_CONTACT_IN_STEP=1`: **2672 passed, 2 skipped, 1 failed**
  (`d3/vitest-on-movers.txt`).
  - The skips are the two env-guarded "ships OFF" rows (this file's, and `contactFidelity.test.js`'s defaults).
  - **The one mover:** `fidelityDarkSuitBosses.test.js:171`, *"Owl body: refused ON as OFF, and ON the refusal names
    the D1 reason"*. That is by design: the row's premise is this key OFF, and ON the Owl is declared, so it bills.
    I left that row as wave 48 wrote it, so the mover shows; a flip must re-pin it (or scope it to `owlContactInStep:
    false`).
  - Every other Owl file is green ON: `finalBossFight`, `seedlingOwlIntro`, `finalBossRng`, `levelRun`, the skins and
    cue files, and `fidelityApFlip`/`Frontier3`. Their tapes take no contact on an order-sensitive tick.
- **Train tier**: **no** `.train.` file names L112. `grep 112` finds four (`hammerBombPhase`, `hammerClearTagChain`,
  `hammerOppDashDefers`, `hammerWallFlyerDrillKill`), and each hit is a coordinate or a tick count, not the level. So
  none was run.

### The named sweep (for the planner's flip question)

- Keys: legs **786, 787, 788, 789** (`d3/suit_boss_legs.json`, copied from wave 48).
- Shards = min(10, 4) = **4**, ×1 per arm, OFF and `--contact-fidelity` / `SEEDLING_OWL_CONTACT_IN_STEP=1`.
- Expectation: no mover. Survey 246 refuses before any contact, and the legs' goals meet the same gate. Measure for
  the flip test anyway: ON can turn a hitless leg into a hit-taking one only through a snap-tick or rock-tick contact,
  or a suit coast that changes the draw stream (and with it every later rock and grenade).

## Gates

- **Bounded vitest** (`--maxWorkers=3`).
  - The set: `contactFidelity*`, `playerDamage*`, `levelRun*`, `finalBossFight*`, `seedlingOwlIntro*`,
    `fidelityDarkSuit*`; every file `grep -a -l` finds for `owlBody`/`FinalBoss`/`finalboss`/`stepFinalBoss`/`byEnemy`/
    `retaliate`/`hasDarkSuit`/`owlContactInStep`/`'darkSuitBossRetaliation'` (the key-order pins); and `r8Acceptance`,
    `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`,
    `seedlingSolverSurface`. Less one slow-tier file (`seedlingGenTerrains.slow`).
  - BEFORE (a base worktree): **77/77 files, 2518** green.
  - AFTER: **78/78, 2526** green (+7 new rows, +1 `contactFidelityHook` per-key row). At the final code, with
    `oneSpelling.test.js` added to the set: **79/79, 2537** green. ON: above.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped, 0 known-red (tree untouched during the run).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match.
- `census-seedling-constants.mjs --check` went RED on **one** new rule literal: the `0` in the hook's `b.hitsTimer <=
  0` (`finalBossFight.js|stepFinalBoss|h65aca565|0|0`). It is `Enemy.hitPlayer`'s gate, and the existing reviewed
  target classes it `rule` ("hitsTimer / rockfallTime phase tests"). I ran `--write` (7129 rows, +1), then `--check`
  PASS. No hashed statement was edited (the `owlBody` call, the old gate `if`, and the step's ctx statement either
  stayed verbatim or hold no literal). `census-seedling-solver-surface.mjs`: line numbers only, `--write` (374 rows),
  then GREEN.
- **CI, first push RED, and mine.** The `JavaScript Unit Tests` push run 44169633721 at `13cfd89b`: shard 1/3 failed
  two rows of `scripts/procgen/oneSpelling.test.js` (28356 passed, 2 failed; slow battery 437/437). Importing
  `pointLength` into `levelRun.js` put the file in the one-spelling law's reach, and the law then named its two
  pre-existing `Math.hypot` sites (`:4578`, `:11987`). The same file is green at base. My bounded set had not included
  it; a `grep` for the key's terms does not find a law keyed on imports. Fix `a1af1dd3`: no import, and the row drops
  its `speed` field. Then: `oneSpelling` 11/11, the set 79/79, both censuses green, acceptance OFF and ON still
  `391322d6…`.
- **CI at the fixed code:** `JavaScript Unit Tests` push run 44174288620 at `a1af1dd3` (code-identical to the head; the head adds only
  this report): **success**. The unfiltered suite is **28358/28358** (0 skipped, 0 failed), and the slow battery 437/437.
- **Owed** (I cannot dispatch; 403): `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref
  claude/owl-suit-contact-dark-retaliation-t10k18 -f train_only=true`. No train file names L112, so I expect it green.

## What the brief got wrong (measured)

1. **"Note the bug in that refusal text: it reasons about the PLAYER's knockback (`p.v`), not the Owl's `v`."** The
   text is right. The barrage aim reads the player's `p.v` (`FinalBoss.as:144`), and without the suit a contact does
   not touch the Owl's `v` at all. The Owl-`v` coupling is a second coupling, and it exists only under the suit (wave
   48's refusal text names it). Both are measured: rock row and suit row. ON retires the rock refusal (the order is
   exact, and mutant 2 shows the aim reads the new `p.v`). OFF keeps it verbatim.
2. **"Without the suit, the contact's player knockback lands before the phase arms"** is half the no-suit story. The
   late bill also tested the wrong POINT (the post-snap one) and the wrong `hitsTimer`/`destroy` (post-lava). The snap
   coupling moves a measured value: a death tick, t425 → t426.
3. **"A no-suit contact row … if any exists"**: one exists, but not where an ordinary contact lands. 3493 ordinary
   contacts are identical ON/OFF; the movers are the pod snap and the rock-spawn tick only.
4. **The key-order pins** were 15 files plus `fidelityDarkSuitBosses`'s new `.at(-1)`, plus `contactFidelity.test.js`
   (16 edited), as the brief expected. The env-guard line in `contactFidelity.test.js` also needed the new name.
5. **The intro freeze**: the old bill never gated on the intro's `Game.freezeObjects`; only a ceremony counted. ON gates
   it, as `Player.hit` does. No staging reaches it (the player is frozen at the door while the Owl stands still).

## Hand-overs

- **To the planner:**
  - the 4-shard sweep above;
  - the `train_only` dispatch;
  - re-pinning `fidelityDarkSuitBosses.test.js:171` at any flip;
  - train 141's `SOLVER_ENV_NAMES` merge (my entry sits after `SEEDLING_ORBIT_FREE_AIM`).
- **To hammer:**
  - **The Owl's forecasts.** Anything that steps `stepFinalBoss` without `onHitPlayer` (a forecast, a preview) keeps
    the late order. With the key ON, such a forecast can disagree with `advance` on a snap tick or a rock-spawn tick,
    and under the suit on every contact tick (walk → coast changes the draws). I found no Owl forecast on the solver
    surface, and there is no Owl executor. Named so it is not built late-ordered.
  - **Under the suit a contact shoves the Owl** (+1 px/t, away from the player), and it can turn a walk tick into a
    coast. That can delay a pod arrival and the barrage, which an encounter policy would need to know.
- **To fidelity (later):** the lava-tick contact (coupling 3) is transcribed by the slot, but nothing pins it. A
  staging would need the player in contact while the Owl is shoved onto lava.

## Residue

- Every ON row is model-derived, not game-witnessed.
- Legs 786–789 were not replayed in node (no slot rows, and the runner is the browser sweep). The claim rests on survey
  246, plus the sweep owed above.
- The `darksuit` grant silences the tape's presses (wave 48's caveat); the no-suit stagings strip presses from t10 so
  the intro's t2 release survives.
- Evidence: `seedling-fidelity-owlsuit-evidence/`.
  - `tools/`: `stage.mjs`, `cmp.mjs`, `search.mjs`, `probe.mjs`.
  - `d2/`: both mutants.
  - `d3/`: the four acceptance md5s, survey 246 OFF/ON, the two searches, the ON movers, the leg keys.
