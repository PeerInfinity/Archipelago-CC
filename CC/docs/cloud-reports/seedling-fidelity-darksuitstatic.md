# seedling-fidelity-darksuitstatic — the dark suit's retaliation into a static body (wave 46)

⚖ GO: Robert 2026-11-16 (planning-21's session), *"Darktrap Dark Suit (Recommended)"*, plus the launch GO for this
brief. Scope: ONE new `contactFidelity` key, default OFF; a census of the static-contact classes; their retaliation
declared from the AS3. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-21` |
| Base | `d24a057d99c3a6b1c3fea819ec15d3dcadca9a9a` (= origin/main; 135 `contactFidelity` keys, 125 ON — measured) |
| Harness branch | `claude/dark-suit-static-retaliation-klnh49` (the brief's `seedling-fidelity-darksuitstatic` name was not used: the harness pushes to its own branch) |
| Commits | D1+D2 `e025aa79` · D2 call-site fix + surface `b66a897a` · docs `31a9b3ed` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves nothing measured) |

**The one thing to know first:** with the key ON, L63's `darktrap@128,272` contact bills (1 hit, knockback, no-op
retaliation row). But leg 906 never reaches that contact at this base: hammer met it only with `WALK_START_SNAP`, which
was reverted. ON alone, the leg refuses at the same solver wall as OFF. No seed-1 leg or survey step moved.

## D1 — the census

### Classes that reach the static scan's `applyPlayerHit`

The roster is `combat.contactPricing(tag).kind === 'static'` (speed 0, `aggro.kind === 'static'`, not a boss), plus the
classes `STATIC_SWORD_ARM` relabels (`STATIC_SWORD_DEATH`: `SandTrap`, `Turret`; the switch ships ON). Measured over
`ENEMY_CLASSES`: `icetrap`, `sandtrap`, `darktrap` are `static`; `turret` is `mover` and is relabelled. Nothing else is.
The rooms (atlas census, `tools/census.mjs`): sandtrap L6/L8/L16/L36, icetrap L45/L46/L53/L54, darktrap
L62/L63/L65/L101, turret L29/L59/L62/L65.

The call is `Enemy.hitPlayer` → `p.hit(this, 3, new Point(x, y), damage)` (`Enemies/Enemy.as:211-221`), so the body
is `e`. `Player.hit` retaliates inside its own gate: `if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y),
darkSuitDamage 1, "Suit")` (`Player.as:1384-1387`; the two fields are `Player.as:255-256`).

| class | `hit(f, p, d, t)` chain | what a `"Suit"` hit does | bucket |
|---|---|---|---|
| `DarkTrap` | `DarkTrap.hit` overrides with an EMPTY body (`Enemies/DarkTrap.as:56-59`) | nothing | **no-op** |
| `IceTrap` | no override → `Enemy.hit` (`Enemy.as:141-181`); the ctor sets `canHit = false` (`Enemies/IceTrap.as:32`), and `canHit` is in the gate at `Enemy.as:147` | nothing (the gate never opens; `maxForce` is −1) | **no-op** |
| `SandTrap` | no override → `Enemy.hit`; `knockback` is EMPTY (`SandTrap.as:77-80`); `startDeath` is `play("die"); dieEffects(t)` (`:88-92`) | `hits += 1`, `hitsTimer = 30`, `hitByDarkStuff = true` (`t == "Suit"`, `Enemy.as:156`); at `hitsMax` 3, "die". `dieEffects("Suit")` hits the switch's `default:` (no spawn). The 30-tick timer also gates its own `hitPlayer` (`hitsTimer <= 0`) | **held state** (F4's `staticBodyStates` row, the sword arm's death staging) |
| `Turret` (relabelled) | no `hit` override → `Enemy.hit`; empty `knockback` (`Turret.as:86-89`); `startDeath` plays "die" (`:91-94`) | the same writes as a SandTrap's. But `Turret.update` runs `super.update()` (→ `hitPlayer` → the retaliation) and THEN its fire gate `else if (hitsTimer <= 0)` and the "die" return (`Turret.as:45-79`). The model steps that half in `stepShootersNow`, ABOVE `stepContactsNow`. So on the hit tick, the model's fire gate would already have read the pre-hit timer, and a shot begun that tick would spawn where the game's "die" replaces it | **not held as the AS3 orders it** (a state machine split across two model slots) |

`t == "Suit"`-specific branches: only `Enemy.hit`'s `hitByDarkStuff = (t == "Shield" || t == "Suit")` latch. None of
the four classes overrides on `t`.

### The other `applyPlayerHit` call sites with `e` and no `retaliate`

There are 36 call sites at base (the funnel definition is the 37th match). Those whose AS3 passes `e` and that leave
`retaliate` undefined, so they still refuse under the suit:

| line (base) | source | |
|---|---|---|
| 10770 | `shieldBossStab` | ShieldBoss stab |
| 11167 | `owlBody` | FinalBoss body |
| 12364 | `enemy` | **this slice** (the static scan) |
| 16738 | `bobBoss` | Bob Boss |
| 23168 | `bossBody` | BossTotem body |

This is a coverage list, not a fix list. They are boss arms and outside this scope.

STOP rule: not triggered. Two classes are no-ops and one fits the held state.

## D2 — the key

`CONTACT_FIDELITY.darkSuitStaticRetaliation` is **OFF** and appended LAST at this base, after `corridorForecastMemo`.
The env is `SEEDLING_DARK_SUIT_STATIC_RETALIATION=0|1`, entered in `SOLVER_ENV_NAMES` (sorted and duplicate-free,
measured). Doc block (`contactFidelity.js`):

> fidelity DARKSUITSTATIC D2 (wave 46) — THE DARK SUIT RETALIATES INTO A STATIC BODY. `Player.hit` calls
> `if (e && hasDarkSuit) e.hit(darkSuitForce 1, new Point(x, y), darkSuitDamage 1, "Suit")` inside its own gate
> (`Player.as:1384-1387`), and `Enemy.hitPlayer` passes the body as `e` … `DarkTrap.hit` is EMPTY … `IceTrap` sets
> `canHit = false` … no effect; `SandTrap` takes `Enemy.hit` … on F4's damage row … `Turret` is NOT declared … ON: the
> scan passes the declared `retaliate`, and the row lands in `playerHits[].retaliation`. OFF: byte-identical.

**The change** (`levelRun.js`, `stepContactsNow` and two new functions under it):
- `staticSuitRetaliation(inst, id)`, reached only with the key ON:
  - `DarkTrap` and `IceTrap` get a declared no-op row `{id, as3, landed: false, effect: 'none', why: <AS3 cite>}`.
  - `SandTrap` gets `staticSuitHit(id)`: `enemyHit` on `staticBodyStateFor(level)`'s row with `d 1, f 1, t 'Suit'`,
    which writes hits, i-frames and the latch exactly as `Enemy.hit` does.
  - A SandTrap kill is staged as the static sword arm stages it: `destroy` reset (`startDeath` is `play("die")`), the
    out-of-band tag refusal, the kill-lock ledger refusal, `killedAt`, the "die" anim. It then takes **one graphic
    step on the blow's tick**. The blow lands inside the trap's own `update()`, and `World.update` runs
    `e.update()` then `e._graphic.update()` (`net/flashpunk/World.as`). The sword's blow lands in the Player's
    update, which is last, so its first step is the next tick. Result: removal 18 ticks after the blow, not 19.
  - `Turret` returns `undeclaredWhy`. Its contact stays ABSENT, so `playerHit` still refuses it by name. The scan's own
    call site catches that refusal and rethrows it with the D1 reason appended.
- `applyPlayerHit` is **byte-identical to base**. A first cut added an `undeclaredWhy` parameter to it, which moved
  the constants census's `applyPlayerHit` row hash (RED: retire and classify). I moved the reason to the call site
  (`b66a897a`), and the census is PASS with no edit.
- OFF: `suit` is `null`. The scan calls `applyPlayerHit` with the same arguments as before, with no `retaliate` key.

**Pins re-pinned** (grep for `'corridorForecastMemo']` plus the `.at(-1)` pin): the ten key-order tails
(`fidelityCeremony126`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress`, `L39Phantom`,
`RockButton`, `RockFire`, `RockGone`); `fidelityCorridorBody`'s last-key row, now a tail of
`['darkSuitStaticRetaliation']`; and `contactFidelity.test.js` (the defaults row, plus the env-guard line). No other file
lists keys (no count pins).

### Rows (`fidelityDarkSuitStatic.test.js`, fast tier, 8 rows)

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| L63 `darktrap@128,272` (boot (128,248), `down`) | throws: *"the `enemy` hit (darktrap@128,272) at tick 14 in level 63 — playerHit: `hasDarkSuit` retaliates INTO the attacker …"* | `playerHits`: t14, hits 1/3, shake 5, knockback (0,−3) y-landed, `retaliation {as3 DarkTrap, landed false, effect none, why DarkTrap.as:56-59}` |
| same, no suit | rows equal ON/OFF; no `retaliation` key | |
| L45 `icetrap@64,64` | refused | no-op row (`canHit = false`) |
| L8 `sandtrap@96,80` | refused | t14 `{landed, hits 1, hitsTimer 30, hitByDarkStuff true}` |
| L8, 3 extra hearts, 100 t | — | contacts t14/44/74 (the trap's own 30-tick gate spaces them); third kills; `staticBodyDeaths`: `killedAt 74, removedAt 92`, tag 0 `earned` |
| L29 `turret@128,192` | refused, no D1 text | refused, and the message names the D1 reason |

**Mutant** (prediction first): drop the same-tick "die" step (`if (false && stepSpriteAnim(...))`). I predicted that
only the kill row would go red, with `removedAt` 92 → 93. Measured: exactly that row went red (`- "removedAt": 92` /
`+ "removedAt": 93`), and 7 of 8 stayed green. Restored from a copy, and `grep "if (false"` gives 0.

⚠ **Not game-witnessed:** the SandTrap kill's removal tick (92), and the same-tick graphic step behind it. They are
derived from `World.update`'s loop and from the sword arm's witnessed staging (C1 D1: blow 66 → anim end 85). No suit
kill of a sandtrap exists in any seed-1 leg or survey step (D3), so this is a model-completeness row, not a route row.

## D3 — the ON measurement

### Byte-inertia (OFF)

- `git diff --name-only d24a057d99 HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty**.
- `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - base `391322d681b7aa0229d94b3f6906d024`;
  - head OFF `391322d681b7aa0229d94b3f6906d024` (re-run at `b66a897a`, the final code);
  - head ON `391322d681b7aa0229d94b3f6906d024`.
  All equal the standing value (`d3/acceptance-*.md5`).

### Census: who holds the suit beside a declared class

**Method.**
- Legs: `seedling-divergence-legs.mjs --presets=seedling_playthrough` at base gives 923 legs, and I kept those whose
  `sphere.inventory` holds `"Dark Suit"`.
- Survey: `survey-seedling-route.mjs --derive-only --through=end` gives 250 steps. The suit is collected at step 197
  (L79), items are monotone, so I kept every later step.
- Both are crossed with the rooms above.

| | count | which |
|---|---|---|
| legs holding the suit (all rooms) | 127 | |
| … in a declared-class room | **8** | 906 (L63 Chest, sphere 12.2); 744, 745, 746, 747 (12.2), 748 (13.6), 919, 920 (14.3), all L101 |
| … in a turret-only room | 0 | |
| survey steps after the suit, in such a room | **5** | 208 (L59, turret only), 211 (L63 Chest), 230, 236, 241 (L101) |

No sandtrap or icetrap room is visited with the suit, so only the darktrap no-op row can fire on the route.

**Survey, OFF vs ON** (`--through=end --only=208,211,230,236,241`, `d3/survey-{off,on}.rows.json`): the rows are
**identical** apart from `ms`. 208 SOLVED 150 t, 211 SOLVED 464 t, 230 SOLVED 287 t, all with 0 hits on replay;
236 and 241 REFUSED (ITEM-GATE, `magicallockfire`, the wand). Step 211 boots at L63@16,96 and never meets the trap.

**L63's leg 906 in node, ON** (`tools/leg906.mjs`, hammer's `census-leg.mjs` adapted):
- **What is missing.** The page's sweep dump and its captured request are not in hammer's evidence. The records are
  therefore the atlas's own (`seedling-divergence-bare`'s fallback). The chest goal is built from its record
  (`chest@224,80`, tag 5), and the items and slots come from hammer's sphere row.
- **Unstaged:** OFF and ON both refuse identically: `chest (224,80) stance -> light (lightpole@112,272) stance ->
  chest stance: STANCE_REENTRY … blocked by chest@224,80 at tick 98`.
- **With the row's granted world flags staged** (`--row`, incl. `L63:1`): OFF and ON both refuse identically: *"the
  route entered a proximity-hazard — chest at (224,80) … at (231.45,99.85)"*.
- **What's next for it.** No plan with hits and no hitless plan. Its wall is a solver wall that comes BEFORE the
  darktrap, and the key does not move it.
  - Hammer's page row refused at the walk's start tile (a falling player, SMALL-WALLS §3.2). The darktrap contact
    appeared only behind the reverted `WALK_START_SNAP`.
  - With the key ON, that contact now bills (the L63 row above) instead of refusing. So if hammer re-lands a start
    snap, the light-arm walk gets past the darktrap at the price of one hit, with no refusal.
  - Whether a hitless line exists is SMALL-WALLS §8's answer: spear-left needs y < 286.5, and contact begins at
    y ≈ 290.1. With `L63:7` staged, the base solver plans 362 t with 0 hits.

**ON movers.**
- Default tier, the whole bounded set (65 files) with `SEEDLING_DARK_SUIT_STATIC_RETALIATION=1`: 2100 passed, 2
  skipped. The 2 skips are this file's "ships OFF" row and `contactFidelity.test.js`'s defaults row, both env-guarded.
  **0 movers.**
- Train tier: no train file touches L63 or L101. The two that touch a declared-class room are icetrap rooms,
  `hammerL53Killlock.train.test.js` (L54) and `hammerNewLocks.train.test.js` (L53). Each was run alone with the key ON
  (`vitest.train.config.js`, 1 worker): 2/2 and 1/1 green. **0 movers.** Neither room is visited with the suit.

**The named sweep (for the planner's flip question).**
- Keys: the 8 above, i.e. 744, 745, 746, 747, 748, 906, 919, 920 (`d3/suit_static_legs.json` has the full keys).
- Shards = min(10, 8) = **8**, ×1 per arm, OFF and `SEEDLING_DARK_SUIT_STATIC_RETALIATION=1`.
- Expectation from the above: no mover. L101's darktrap sits in its lightpole room, and the survey's L101 rows are
  identical. Leg 906 stops before the trap.

## Gates

- **Bounded vitest**, before (base worktree) and after:
  - The set (`--maxWorkers=3`): `contactFidelity*`, `playerDamage*`, `levelRun*` (incl. `levelRunDigestRead` and
    `levelRunStateDigest`), `combat*`, `fidelityDarkTrap*`, `fidelityStatic*`, `spinner*`, the 11 key-order pin files,
    `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, the new test, and every file
    `grep -a -l` finds for `byEnemy` / `retaliate` / `hasDarkSuit` / `darkSuitStaticRetaliation`. That is 66 files,
    less `seedlingGenTerrains.slow` (slow tier).
  - BEFORE: **64/64 files, 2093 tests** green. AFTER: **65/65, 2102** green. ON: 65/65 (above).
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped, 0 known-red.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all match, after the
  regeneration that `seedling-bot.md`'s new paragraph needed (README word count, `docsIndex.js`).
- `census-seedling-solver-surface.mjs`: `--write`, line numbers only (375 rows), then `--check` GREEN.
  `census-seedling-constants.mjs --check`: PASS.
- **CI** at `31a9b3ed` (code-identical to the head): see the addendum line at the end. I cannot dispatch the train
  tier (403). **Owed:** `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref
  claude/dark-suit-static-retaliation-klnh49 -f train_only=true`.

## What the brief got wrong (measured)

1. **The census is four classes, not three.** IceTrap, SandTrap and DarkTrap are `static`, and `Turret` reaches the
   same `applyPlayerHit` through the `STATIC_SWORD_ARM` relabel (ON by default). Turret is the one class that stays
   undeclared.
2. **"The model's single damage site … ≈l.11931"** is right. But the 36 sites include five with `e` and no
   `retaliate`, not just the static scan: four are boss arms (`shieldBossStab`, `owlBody`, `bobBoss`, `bossBody`).
3. **Leg 906 does not meet the darktrap at this base.** Hammer met it only with the reverted `WALK_START_SNAP`. ON
   alone, the leg's answer does not move.
4. **The key-order pins are 12 files, not "nine more than named".** They are the ten tails, `fidelityCorridorBody`'s
   `.at(-1)` and `contactFidelity.test.js`. `fidelityDrillWater`'s list was already among them. No count pin exists.
5. **"Write it into that state exactly as the AS3 does"** needed one extra step that is not a state write: the "die"
   anim's graphic step on the blow's tick (`World.update`'s order). The sword arm's staging, copied verbatim, would be
   one tick late. The mutant pins this.

## Hand-overs

- **To hammer (L63, leg 906):**
  - The darktrap wall behind a start snap is now a billed hit with the key ON, instead of a refusal.
  - Leg 906's real walls are solver walls: the light-arm stance whose corridor crosses its own trap, and the walk that
    slides into the pit (SMALL-WALLS §9). In this node staging they appear as `STANCE_REENTRY` on the chest stance, or
    as a proximity-hazard entry on the chest. Neither is fidelity's to fix.
- **To fidelity (later):**
  - `Turret` under the suit needs `stepShootersNow`'s fire gate re-read after the contact scan on the hit tick (or the
    scan moved into the turret's slot). Its bucket-3 refusal names this.
  - The four boss arms that pass `e` without `retaliate` are the remaining dark-suit refusals.
- **To the planner:** the sweep above, and the `train_only` dispatch.

## Residue

- The SandTrap suit kill (removal t92) is not game-witnessed (see D2). No route leg reaches it.
- `staticBodyStateFor` is built on a room's first SandTrap suit contact, as it is for an arrow or a sword press. From
  then on, `inventoryHoldCensus`'s `staticBodies` row (`'refuse'` while any body is not removed) refuses an inventory
  hold in that room. This is the arrow/sword arms' existing behaviour, now reachable by a third writer. No route visit
  has the suit in a sandtrap room.
- Leg 906 was solved without the page's delivered set (no dump in the evidence). The exact page request was not
  replayed.
- Evidence: `seedling-fidelity-darksuitstatic-evidence/` holds `tools/` (`stage.mjs`, `census.mjs`, `leg906.mjs`) and
  `d3/` (leg 906 OFF/ON in both stagings, the 8 legs, the survey rows OFF/ON, the three acceptance md5s).

## CI addendum

`JavaScript Unit Tests` push run 43962972746 at `31a9b3ed`: **failure, 1 of 28,182** (shards 1, 2 and slow green;
shard 3 red: `scripts/procgen/seedlingConstantsCensus.test.js` › *(b) PREDICTED GREEN: a new literal inside a cosmetic
table*). **It was mine.** My new `levelRun.js` code adds 5 structural literals (`ticksCompleted + 1` ×3,
`persistTag >= 0`, `killedAt = ticksCompleted + 1`) that the committed census did not hold. `--check` passes green
drift, so I missed it; the mutant row pins the exact green set, so it went red. Fix: `census-seedling-constants.mjs
--write` (7119 → 7124 literals, structural only; `seedling-constants.md`'s region). The test is now green locally
(24/24), `--check` PASS, and the reference `--check` matches. **Owed:** this branch's push run at the new head (read
with `ci-vitest-summary.mjs <head>`), and the `train_only` dispatch named above. In Gates, read "constants census
`--check` PASS" as *PASS after the `--write`*.


**Final CI** (`JavaScript Unit Tests` push run 43967789328 at `bf573841`): **success**. The unfiltered suite is 28182/28182 passed, the slow battery 437/437. Still owed: the `train_only` dispatch.
