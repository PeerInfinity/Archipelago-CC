# seedling-fidelity-darksuitbosses — the dark suit's retaliation into a boss (wave 48)

⚖ GO: Robert 2026-11-16 (planning-21's session), *"Dark Suit boss arms (Recommended)"*, plus the launch GO for this
brief. Scope: ONE new `contactFidelity` key, default OFF, declaring the `"Suit"` retaliation of the four boss arms from
the AS3. No flip, no default change.

| | |
|---|---|
| Planner | `seedling-fidelity-planning-21` |
| Base | `56dd7a38728cca016d93d42cea626e8ce93dbf15` (= `origin/fidelity-harvest/l39hit-w47` tip, measured; 138 `contactFidelity` keys, 125 ON, last two `darkSuitStaticRetaliation`, `pulserForecastPulse`) |
| Harness branch | `claude/dark-suit-boss-retaliation-7xawe8` (local branch `seedling-fidelity-darksuitbosses`, pushed there) |
| Commits | D2 `ee1d4115` · log/docs/evidence `d98f0fb8` · this report (the head) |
| Verdict | **PASS** (key OFF; OFF byte-identical; ON moves nothing measured) |

**The one thing to know first:** three of the four arms are declared ON (ShieldBoss stab, BobBoss, BossTotem body), and
the Owl's body stays refused. But **no seed-1 leg or survey step meets ShieldBoss, BobBoss or the BossTotem with the
suit.** The only boss room the route visits under the suit is L112, the Owl's, so ON moves nothing on the route. It
is coverage first. Off the route, ON shows that **the suit alone kills all three Bob forms**: each contact lands
`Enemy.hit(…, "Suit")`, and the third form's death writes `{32,3}`.

## D1 — the census

### The call sites (re-measured)

`levelRun.js` at base holds 35 `applyPlayerHit` call sites, plus the funnel's own definition. Every site whose AS3
passes `e` declares a `retaliate`, except these four: spinner ×2, enemy (wave 46), wallflyer, drill, sword, punch,
chaser, iceturret, lightboss and tentacle all declare one. The other sites pass `null`.

| line (base → head) | source | AS3 class |
|---|---|---|
| 10852 → 10853 | `shieldBossStab` | `Enemies/ShieldBoss.as` |
| 11249 → 11274 | `owlBody` | `Enemies/FinalBoss.as` |
| 16919 → 16935 | `bobBoss` | `Enemies/BobBoss.as` (+ `BobSoldier.as`) |
| 23371 → 23431 | `bossBody` | `Enemies/BossTotem.as` |

Turret stays out (wave 46's bucket 3), as the brief says.

### The four arms

`Player.hit` (`Player.as:1374-1395`): `if (Bot.noDamage) return; if (hitsTimer <= 0 && hits < hitsMax &&
!Game.freezeObjects) { if (e && hasDarkSuit) e.hit(darkSuitForce, new Point(x, y), darkSuitDamage, "Suit"); … }`. The
fields are `darkSuitForce = 1` and `darkSuitDamage = 1` (`:255-256`). `Enemy.hit` is at `Enemies/Enemy.as:141-181`:
`maxForce` clamp; gate `(hitsTimer <= 0 || hitByDarkStuff) && !freezeObjects && canHit`; `onlyHitBy == "" || onlyHitBy
== t`; then the damage arm (`hits += d`, `hitsTimer`, `hitByDarkStuff = (t == "Shield" || t == "Suit")`, `startDeath` or
`knockback`), else `justKnock` → `knockback(f, p)`.

| arm | `e` (who calls `p.hit`) | `hit(f, p, d, "Suit")` chain | what it does | bucket |
|---|---|---|---|---|
| ShieldBoss stab | the boss: `ShieldBoss.hitPlayer` → `p.hit(this, swingForce, …)` on frames 5–8 (`ShieldBoss.as:105-114`) | `ShieldBoss.hit` overrides (`:130-151`): `if (!activated) { activated = true; return; }`; then `movedShield` → `super.hit` + `sit()`, else `playedSound` + `startStab(true)`. Frames 5–8 belong only to "stab" (`:37`), so the `movedShield` arm is unreachable; `startStab` needs `hitsTimer <= 0 && currentAnim == "sit"` (`:172`) and refuses | **arms** an unarmed boss (the swallowed first hit), else writes only `playedSound` (a sound latch) | **held state** (`shieldBossTakesHit` already transcribes all of it; `activated`/`playedSound` are on the model's row) |
| BobBoss body + swords | the boss: body `Enemy.hitPlayer` → `p.hit(this, 3, …)` (`Enemy.as:211-221`); swords `BobSoldier.swordHitting` → `hitPlayer.hit(this, 3 * damage, …)` (`BobSoldier.as:160-172`) | `BobBoss.hit` (`BobBoss.as:163-175`): form 2's own-gate blade re-seed (`hitsTimer <= 0 && bossType == 2`), then `super.hit(0, null, d, t)` → `Enemy.hit` (no override in `BobSoldier`) | hits, `hitsTimer`, the `hitByDarkStuff` latch, a kill's `destroy`; `knockback(0, null)` is nothing | **held state** (`bobBossHit`, which the sword arm already uses, latch included). ⚠ The write lands MID-update: the body hit is `Enemy.update`'s tail, before `BobSoldier.update`'s `playerActions`/`swordSpinningStep`/`swordHitting` (`BobSoldier.as:72-84`) |
| BossTotem body | the totem: `BossTotem.update` → `super.update()` (`BossTotem.as:301`) → `Enemy.hitPlayer` (not overridden; the laser's `hitPlayers` passes `null`, `:486-490`) | `BossTotem.hit` (`:719-725`) → `Enemy.hit` once fully activated; `onlyHitBy = "Wand"` (`:262`), `justKnock` false (`Enemy.as:42`); `knockback` is empty (`:727`) | nothing, in every state | **no-op** |
| Owl body | the Owl: `FinalBoss.update` → `super.update()` (`FinalBoss.as:110`) → `Enemy.hitPlayer` (not overridden) | no override → `Enemy.hit`; `onlyHitBy = "Lava"`, `justKnock = true` (`:61-62`) | `knockback(1, p)`: `v += (cos a, sin a)`. It lands inside `super.update()`, and the phase arms after it read `v.length` (the `> 4` cap and the walk/coast split `v.length <= moveSpeed`, `:126-155`) | **not held as the AS3 orders it**: the model bills `owlBody` AFTER `stepFinalBoss`'s arms (its own "one statement late" note at the call site) |

`t == "Suit"` / `hitByDarkStuff` readers beyond `Enemy.hit`: none in the four classes. The latch itself is read by
`Enemy.hit`'s gate, and the model's `bobBossHit` carries it.

No arm hits through a CHILD object. Each `e` is the boss entity.

STOP rule: not triggered. One arm is a no-op and two fit the held state.

### Reach (D1.3)

**Method.**
- Rooms: the atlas census (`tools/census.mjs`) gives `shieldboss` L19, `bosstotem` L43 and `finalboss` L112. BobBoss is
  spawned by L32's `fallrocklarge` (`bossrock 1, thirdboss 1`); L82's rock has `thirdboss 0`.
- Legs: `seedling-divergence-legs.mjs --presets=seedling_playthrough` gives 923 legs (910 run, 13 skipped by name), and
  I kept those whose `sphere.inventory` holds `"Dark Suit"` (127).
- Survey: `survey-seedling-route.mjs --derive-only --through=end` gives 250 steps. The suit is collected at step 197
  (L79); items are monotone, so every later step holds it.

| room / arm | legs in the room (any inventory) | … holding the suit | survey steps after 197 in the room |
|---|---|---|---|
| L19 ShieldBoss | spheres 1.3, 2.3 | **0** | 0 (step 28 is pre-suit) |
| L32 BobBoss | 3.8, 4.8 | **0** | 0 (step 39) |
| L43 BossTotem | 5.3, 9.4, 10.1 | **0** | 0 (steps 167, 174) |
| L112 Owl | 13.6 | **4**: 786, 787, 788, 789 (`d3/suit_boss_legs.json`) | **1**: 246 (its Owl goal is a `skip`: no solver executor fights `finalboss@64,96`) |

So the three declared arms are reached by no route visit under the suit: coverage only. The one arm the route meets
under the suit is the undeclared Owl.

## D2 — the key

`CONTACT_FIDELITY.darkSuitBossRetaliation` is **OFF**, appended LAST at this base, after `pulserForecastPulse` (139 keys).
The env is `SEEDLING_DARK_SUIT_BOSS_RETALIATION=0|1`, entered in `SOLVER_ENV_NAMES` before
`SEEDLING_DARK_SUIT_STATIC_RETALIATION` (sorted, duplicate-free). Doc block (`contactFidelity.js`), in brief:

> fidelity DARKSUITBOSSES D2 (wave 48) — THE DARK SUIT RETALIATES INTO A BOSS … · `shieldBossStab`: … `ShieldBoss.hit`
> arms first …; armed, the anim is "stab", so … `startStab` needs "sit" (`:172`): a no-op. ON: `shieldBossTakesHit(…, t
> 'Suit')` on the model's row … · `bobBoss`: … `BobBoss.hit` re-seeds form 2's blades, then `Enemy.hit(0, null, d,
> "Suit")` … ON (with the suit): the bill lands INSIDE `stepBobBossBody` (its `onPlayerHit`) … · `bossBody`: … A no-op
> row. · `owlBody` is NOT declared … The model bills the contact AFTER `stepFinalBoss`'s arms, so it stays refused, and
> the refusal now says why. The row lands in `playerHits[].retaliation`. OFF: byte-identical.

**The change.**
- `levelRun.js`:
  - `stepShieldBossesNow`: ON, the stab passes `retaliate: () => shieldBossSuitRetaliation(b)`. That calls
    `shieldBossTakesHit(b, {d 1, f 1, t 'Suit', frozen})` between `stepShieldBoss` and `advanceShieldBossGraphic`, where
    `hitPlayer` is in the game. It refuses by name if the hit ever lands, kills, aborts or starts a stab (D1 says it
    cannot). Row: `{id, as3, landed: false, swallowed, activated, why}`.
  - The BobBoss arena: the bill is one `billBob(h)` closure. ON and holding the suit, it is passed to `stepBobBossBody`
    as `onPlayerHit` and runs at each `Player.hit` in the game's order, with `retaliate: () =>
    bobBossSuitRetaliation(b)` (`bobBossHit(b, {d 1, t 'Suit', frozen})`, plus a `boss-hit` ledger row with `by:
    'suit'`). Otherwise the post-step loop bills as before.
  - The BossTotem body: ON, a no-op row `{id, as3, landed: false, effect: 'none', why: <AS3 cite>}`.
  - `owlBody`: the unchanged `applyPlayerHit` statement sits in a `try`. ON, a `byEnemy` refusal is rethrown with the D1
    reason appended; OFF, every error rethrows as is.
- `bobBossFight.js` `stepBobBossBody`: a new optional `onPlayerHit`. It is called right after each `playerHits.push`
  (high-water mark, no new literals). Absent, nothing changes.
- `applyPlayerHit` and `playerHit` are **byte-identical to base**. The three statements the constants census keys by hash
  (the two Bob pushes and the owl call) are kept verbatim. A first cut rewrote them and went RED (retire/classify), so I
  restored them.

**Pins re-pinned** (grep `'pulserForecastPulse']` and the `.at(-1)` pins; 15 files): the ten key-order tails
(`fidelityCeremony126`, `DrillWater`, `Fencepost`, `FireBreak`, `FireSpinner`, `FrozenPress`, `L39Phantom`,
`RockButton`, `RockFire`, `RockGone`); `fidelityCorridorBody`, `fidelityDarkSuitStatic` and `fidelityWallFlyerCorpse`
(each a tail list); `fidelityL39Hit`'s `.at(-1)` last-key row, now a tail of `['darkSuitBossRetaliation']`; and
`contactFidelity.test.js` (the defaults row, plus the env-guard line). `contactFidelityHook.test.js` gains one row by
itself (it iterates the keys). No count pins exist.

### Rows (`fidelityDarkSuitBosses.test.js`, fast tier, 11 rows)

Each row stages a committed boss tape with a `darksuit` grant: the runner's own `stagingFromTape` +
`createRunForStaging`, and the tape's keys.

| row | OFF | ON |
|---|---|---|
| the key | ships OFF, last; env name in `SOLVER_ENV_NAMES` | — |
| ShieldBoss, `r6-shield-control` stance, presses stripped | throws at tick 159: *"the `shieldBossStab` hit (shieldboss@80,32) at tick 159 in level 19 — playerHit: `hasDarkSuit` retaliates INTO the attacker …"* | t159 `{swallowed: true, activated: true, why 'activated — the swallowed first hit'}`; t343 `{swallowed: false, why 'anim "stab" != "sit"'}` |
| same, no suit | ON rows = OFF rows; no `retaliation` key | |
| BobBoss, `r5-bobboss-fire` with damage on, +6 hearts | throws at tick 231 (`bobboss#0:sword0`) | seven contacts, all `landed`, latched: form 0 t231/t286 (kill), form 1 t886/t935/t965 (kill), form 2 t1426 (re-seed, swords 2→3) and t1446 (kill; through a live i-frame via the latch, no re-seed); `boss-hit` rows `by: 'suit'`; `earnedClears` `{32,1}` then `{32,3}` by `bobboss#2` |
| BobBoss form-2 BODY contact (`up` from t1400) | — | t1413 `bobboss#2:body`, swords 3, and blade 0 = 3π/2 − π/20 (re-seed, then one form-2 spin) |
| same staging, no suit | ON ledgers = OFF ledgers | |
| BossTotem, `r6-totem-kill` then `up` from t150 | throws at tick 170 (`bossBody`) | t170/194/220 bill exactly as without the suit (knockback, death), plus the no-op row |
| Owl, `r6-owl-kill` | throws at tick 27, no D1 text | throws at tick 27, and the message names the D1 reason |

**Mutant.**
- **First prediction, refuted.** I made Bob bill after the step even with the suit (`false && suitInStep`, `if (true)`
  post-loop). I predicted the form-2 kill row would go red. Measured: **all 10 green**, and the full Bob ledgers had
  equal md5s. Why: that staging's form-2 contacts are SWORD hits. A sword hit lands after `spin` in both orders, and
  the re-seed overwrites every blade absolutely, so the end state is the same.
- **The order shows only on a form-2 BODY contact.** I searched 20 holds after the t1330 dialogue
  (`tools/bob-form2-holds.mjs`); `up` from t1400 gives `body` at t1413. On that staging the blade angle differs:
  in-step 4.5553 (3π/2 − π/20), mutant 4.7124 (`d3/bob-spin-*.txt`). Nothing else differs at hit granularity.
- **Second prediction.** Only the new form-2 body row goes red, with blade 0 at 3π/2 instead of 3π/2 − π/20.
  Measured: exactly that row went red, 10/11 green. Restored from a copy, and `grep "false && suitInStep\|if (true)
  for"` gives 0. Re-run at the final code (after the census-driven rewrite of the hook): the same, *"expected
  4.71238898038469 to be close to 4.5553093477052"*, 1 failed and 10 passed.

⚠ **Not game-witnessed:** every ON row. The arms reuse transcriptions the game witnessed for other hit types
(`shieldBossTakesHit`: the R6 shield windows; `bobBossHit`: R5 and the shield-bump witness), but no recording has the
suit in a boss fight. Staging caveat: with a `darksuit` grant the tapes' `primary` presses register nothing (the
`presses` ledger is empty), so the stagings use movement and dialogue only. I did not chase why. It does not touch this
key.

## D3 — the ON measurement

### Byte-inertia (OFF)

- `git diff --name-only 56dd7a38 HEAD | grep -aE 'fixtures/|golden|tapes/'` → **empty** (exit 1, at `d98f0fb8`).
- `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - base `391322d681b7aa0229d94b3f6906d024` (a base worktree);
  - head OFF `391322d681b7aa0229d94b3f6906d024`;
  - head ON `391322d681b7aa0229d94b3f6906d024`.
  All equal the standing value. Head OFF/ON were re-run at the committed code (`d3/acceptance-*.md5`).

### The legs and steps from D1.3, ON

- **Survey step 246** (L112), `--through=end --only=246`, OFF and ON: the rows are **identical** (`ms` stripped;
  `d3/survey-{off,on}.rows.json`). REFUSED, ENCOUNTER-GATE: `rocklock@112,16` has no strategy row, and the route meets
  that wall before any Owl contact.
- **Legs 786–789** (L112): unchanged **by construction**. The Owl stays undeclared, ON and OFF refuse at the same
  contact (ON appends text to the same message), and no declared arm lives in L112. I did not replay them in node:
  wave 46's `leg906.mjs` needs hammer's per-sphere slot rows, which these legs do not have. The named sweep below
  measures them.
- No leg or step reaches L19, L32 or L43 with the suit, so the declared arms have no route answer to move.

### ON movers

- **Default tier, the whole bounded set** (114 files) with `SEEDLING_DARK_SUIT_BOSS_RETALIATION=1`: 3637 passed, 2
  skipped. The skips are this file's "ships OFF" row and `contactFidelity.test.js`'s defaults row, both env-guarded.
  **0 movers.**
- **Train tier:** no train file names L19, L32 or L112. Six name L43 (`hammerApproachOrder`, `hammerBodyGate`,
  `hammerChooserPair`, `hammerClearTagChain`, `hammerOppDashDefers`, `hammerPitWest`). I ran each alone with the key ON
  (`vitest.train.config.js`, 1 worker): 7/7, 3/3, 6/6, 2/2, 2/2 and 8/8 green. **0 movers.** None of them holds the suit
  at L43 (the route's L43 visits are steps 167/174, before the suit).

### The named sweep (for the planner's flip question)

- Keys: legs **786, 787, 788, 789** (`d3/suit_boss_legs.json` has the full keys).
- Shards = min(10, 4) = **4**, ×1 per arm, OFF and `SEEDLING_DARK_SUIT_BOSS_RETALIATION=1`.
- Expectation: no mover. The Owl is undeclared, so ON can only lengthen a refusal message.
- A flip turns no hitless leg into a hit-taking one, by this measurement: nothing on the route moves.

## Gates

- **Bounded vitest** (`--maxWorkers=3`).
  - The set: `contactFidelity*`, `playerDamage*`, `levelRun*` (incl. `levelRunDigestRead`, `levelRunStateDigest`),
    `fidelityDarkSuit*`, every file `grep -a -l` finds for `shieldBoss`/`ShieldBoss`/`owlBody`/`bobBoss`/`BobBoss`/
    `bossBody`/`BossTotem`/`FinalBoss`/`byEnemy`/`retaliate`/`hasDarkSuit`/the key-order tails/the key name, and
    `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`. Less one slow-tier file
    (`seedlingGenTerrains.slow`).
  - BEFORE (a base worktree): **113/113 files, 3627 tests** green.
  - AFTER: **114/114, 3639** green (+11 new rows, +1 `contactFidelityHook` per-key row). ON: above.
- `ci-producer-checks.mjs --jobs=3`: **99 run, 0 red**, 1 skipped (`plan-seedling-r7-ends-meet`, a browser row), 0
  known-red. A first run reported `TREE-MOVED` ("a --check wrote to the tree", nothing named). It was mine: I wrote this
  report's draft during that run. The re-run, with the tree untouched, is the result above.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions
  match, after the regeneration the two doc edits needed (README word count, `docsIndex.js`).
- `census-seedling-constants.mjs`: `--check` PASS with green drift (1 new structural, 631 moved). I then ran `--write`
  (7128 rows), because `seedlingConstantsCensus.test.js` pins the exact green set (wave 46's CI addendum), and
  `--check` PASS again. `census-seedling-solver-surface.mjs`: `--write`, line numbers only (375 rows), then GREEN.
- **CI:** `JavaScript Unit Tests` push run 44019842725 at `d98f0fb8` (code-identical to the head; the head adds only this
  report): **success**. The unfiltered suite is **28216/28216** passed (0 skipped, 0 failed), and the slow battery 437/437.
- **Owed** (I cannot dispatch; 403): `gh workflow run unittests_frontend.yml -R PeerInfinity/Archipelago-CC --ref
  claude/dark-suit-boss-retaliation-7xawe8 -f train_only=true`.

## What the brief got wrong (measured)

1. **"The planner expects 138"**: right (138 keys, 125 ON at base). The new key makes 139.
2. **The key-order pins are 15 files, not 12.** Waves 46/47 added `fidelityDarkSuitStatic`'s and
   `fidelityWallFlyerCorpse`'s tail lists and `fidelityL39Hit`'s `.at(-1)` row. `contactFidelityHook` moves by itself.
3. **The line numbers are close**: 10852 / 11249 / 16919 / 23371 at base, against the brief's ≈10853 / 11250 / 16919 /
   23372.
4. **"A held-state arm writes … in the game's update order"** needed a structural change for Bob only: the bill moves
   into `stepBobBossBody`. The ShieldBoss's slot was already the game's, between the entity step and its graphic.
5. **The reach is thinner than the brief implies.** Only the undeclared Owl is met under the suit. All three declared
   arms are coverage only.
6. **ShieldBoss is "held state", but in practice an arming switch.** Its only effective write is `activated`. That
   matters: with the suit, a stab arms the boss, so the player's first sword hit is no longer swallowed.

## Hand-overs

- **To hammer:**
  - **Bob's forecast.** `bobBossForecast`'s `step` (`levelRun.js`, the solver surface) calls `stepBobBossBody` with no
    retaliation. Under the suit with the key ON, a forecast would therefore diverge from `advance` after a contact. Today
    no route leg fights Bob with the suit.
  - **Bob's landing count.** `solverBot`'s `bobLandings` counts `boss-hit` rows with `landed`, so suit landings count
    there. I believe that is right (they are landings), but the encounter policy should know a contact can now kill.
  - **The ShieldBoss stab arms the boss.** With the suit, the schedule's swallowed first hit can be spent by the stab
    instead of a press.
- **To fidelity (later):** the Owl. Declaring it needs the contact hoisted to its AS3 slot, i.e. `stepFinalBoss` split
  at `super.update()`'s `hitPlayer` (above the lava test and the phase arms). The model's own owl comment already names
  that split (the rock-spawn refusal). Its refusal names the reason.
- **To the planner:** the 4-leg sweep above, and the `train_only` dispatch.

## Residue

- Every ON row is model-derived, not game-witnessed (D2). The suit-kills-Bob result is the largest such claim.
- The `darksuit` grant silences the stagings' `primary` presses. I did not investigate it; the stagings work without
  presses.
- Legs 786–789 were not replayed in node (no slot rows); the claim is by construction plus survey 246.
- Evidence: `seedling-fidelity-darksuitbosses-evidence/`.
  - `tools/`: `census.mjs`, `stage.mjs`, `bob-form2-holds.mjs`, `bob-spin-mutant.mjs`.
  - `d3/`: the suit legs, survey 246 OFF/ON rows, the three acceptance md5s, and the blade angles in-step vs mutant.
