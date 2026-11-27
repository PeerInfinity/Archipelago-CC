# Seedling fidelity WANDENEMYBODIES (wave 68) — `wandShotEnemyBodies`

Session `seedling-fidelity-wandenemybodies` (planner `seedling-fidelity-planning-26`, wave 68). ⚖ GO: Robert, 2026-11-26
(*"All of these in parallel, if possible."* — the six-body wave), and the launch GO.

| | |
|---|---|
| start (base) | `e29efdf8daffcec2bb7b50c7e79ba560e637526a` — wave 67's final tip (`claude/wandshot-trap-bodies-fidelity-k6ytz5`) |
| head | this report's commit (the last); the last CODE head is `ed2cad93e2e66462f3aa008879d4f7c575845b96` |
| harness branch | `claude/wandshot-enemy-bodies-vuzsvv` (local `seedling-fidelity-wandenemybodies`) |
| verdict | **PASS** — one key, default OFF, byte-identical OFF; all six classes covered, 16 witnesses the game at every sampled tick ON; L59/L62/L65/L78 no longer refuse with both wand keys ON |

## The one thing to know first

**All six classes are covered, but a room on the walk needs BOTH wand keys.** L59, L62, L65 and L78 each also hold a
wave-67 trap body (a grenade or a darktrap), so with `wandShotEnemyBodies` ON alone they still refuse — now naming only
that trap body; with `wandShotTrapBodies` ON beside it the press goes through and the shot is the game's. Entry 37's exit
is L63 → **L65**, so L65 (`turret@64,112` + `darktrap@144,144`) is the room the walk reaches once the hammer clears the
axe — and with both keys ON it fires. The entry-37 request itself (S1 37:8) is unchanged by this key: `8c781b9832a7`,
the axe-dodge refusal in L63 (no class of the six is in L63).

## Counts at the head

| | base (W67) | head |
|---|---|---|
| `CONTACT_FIDELITY` keys | 156 | **157** |
| ON by default | 126 | **126** |
| last key | `wandShotTrapBodies` | **`wandShotEnemyBodies`** (OFF) |
| `SOLVER_ENV_NAMES` | 253 | **254** (`SEEDLING_WAND_SHOT_ENEMY_BODIES`, sorted, unique) |

## D1 — the census, the witnesses, the map

### The census (every level of the extract; re-measured at the base = wave 67's table)

| class | bodies | levels | the model's state before this slice | ON |
|---|---|---|---|---|
| Turret | 6 | L29 ×3, L59, L62, L65 | **stepped**: `shooterStateFor` (aim, `shootTimer`, spits) + F4's static damage row (`staticBodyStateFor`, with `STATIC_SWORD_ARM` ON — the default) | covered (needs `STATIC_SWORD_ARM`) |
| LavaTrap | 9 | L77, L78 ×3, L80 ×2, L108 ×3 | **static, derivable** (never moves: empty `knockback`); the tongue is a static chomp disc in `levelWorld`, not stepped; no damage row | covered (a new wand damage row) |
| WallFlyer | 7 | L22 ×4, L25 ×2, L27 | **stepped**: `wallFlyerStateFor` / `stepWallFlyersNow` (R2-swim; W6's kill) | covered |
| IceTrap | 5 | L45, L46 ×2, L53, L54 | **static, derivable**; `canHit = false` — nothing a hit can change | covered |
| SandTrap | 13 | L6 ×4, L8 ×2, L16 ×2, L36 ×5 | **static** + F4's static damage row (the arrow and the sword already hit it) | covered |
| Drill | 4 | L28 ×2, L88, L91 | **stepped**: `drillStateFor` / `stepDrillsNow` (`drillLive`; L28/L91 with `drillMixedRooms`) | covered (needs `drillLive`) |

No class is the "no model position" boundary: four are stepped, two are static and derived from the level.

### The game (AS3, read)

- `WandShot.as:69` `solids.push("Enemy")`; `update`: `moveX` then `moveY`, one pixel at a time; a blocker → `checkEntity`:
  an `Enemy` gets `hit(3, new Point(x, y), damage, "Wand")` with `damage` 0.5 (the plain wand, `:29`), then `play("die")`.
- `Enemy.hit` (`Enemy.as:141-181`): behind `(hitsTimer <= 0 || hitByDarkStuff) && !freezeObjects && canHit`: `hits +=
  0.5`, `hitsTimer = 30`; at `hits >= hitsMax` (3) `startDeath(t)`, else `knockback(f, p)`. `hitUpdate` runs in
  `Enemy.update` behind `onScreen()` and `!destroy`; `hitPlayer` is gated on `hitsTimer <= 0`.
- Per class: **Turret** — `knockback` empty; the fire gate `else if (hitsTimer <= 0)` (`Turret.as:64`): a hit holds its
  next shot; `startDeath` = `play("die")` + `dieEffects`. **LavaTrap** — `knockback`, `hitPlayer` empty; the tongue
  reads neither field; `startDeath` = `play("die")` (no `dieEffects`), `endAnim` removes. **WallFlyer** — `knockback` is
  `v = -v`; `startDeath` = `play("die")` + `dieEffects`. **IceTrap** — `canHit = false` (`IceTrap.as:32`): `Enemy.hit`
  does nothing. **SandTrap** — `knockback` empty; `startDeath` = `play("die")` + `dieEffects`; `removed()` writes its
  tag. **Drill** — `knockback` empty; while `hitsTimer > 0` it plays "hit" and does not hop (`Drill.as:61-63`).
- **None of the six writes `collidable`**: each is a body from its ctor until the world removes it (a Turret through its
  "die" anim and `Mobile.death`'s fade; a SandTrap through "die"). The shot is run-time added and updates first.
- `dieEffects("Wand")` (`Enemy.as:204-205`) adds an `Explosion(x, y, ["Player","Enemy"], max(width, height), 1)` —
  radius ×0.65, a `Rng.cos()` draw for its angle, and it `hit`s the player and every Enemy inside it.

### The witnesses (p4g, the delivered vanilla set `seedling-vanilla-record-23510f80`, a fresh page per shape)

`scripts/procgen/probe-seedling-wandenemybodies.mjs`, recorded to `frontend/modules/seedlingDemo/fixtures/wandenemybodies-witness/`
(16 files). Each compares, at every sampled tick of the boot level, the player (0 px; the sample clock fits shift `[0]`
only), every WandShot (count, x/y, anim), every body of the six classes (presence, entity point, `hits`, `hitsTimer`; a
flyer's `v`; a drill's and a turret's anim) and every TurretSpit (count, x/y) against the model with the key ON (and
`wandShotTrapBodies` beside it in the four rooms that hold a trap body). **All 16 PASS.** OFF, every one is refused at the
press with the shipped text.

| witness | class / shape | the game |
|---|---|---|
| `turret-live` | (a) L59, 32 px W of `turret@152,64`, facing E (in its range: it aims and spits) | stops at **(151, 72) on tick 15**; the turret `hits 0.5`, `hitsTimer 29` (30, then its own update); its spits and anim match the model through the i-frames |
| `turret-iframes` | (a) three presses 20 and 30 apart | 2nd stops on **35** with `hitsTimer 9`: no damage (hits 0.5); 3rd on **65**: hits 1 |
| `turret-l65` | (d) L65 (the walk's next room), facing E at `turret@64,112` | stops at **(63, 120) on 15**, hits 0.5 |
| `turret-die` | (b) C1's L62 sword kill (`c1-l62-turret`), the wand pressed at 90 | stops at (236, 255) on **99**, the turret in **"die"** (hits 3 ≥ hitsMax: no damage) |
| `turret-fade` | (b) the same, pressed at 100 | stops on **109**, the turret `destroy`ed in the fade (anim "", hits 3) |
| `turret-removed` | (b) the same, pressed at 112 | the turret is gone; the shot flies on to **(188, 255), tick 136** |
| `lavatrap-live` | (a)/(d) L78, 40 px W of `lavatrap@96,80` (outside the tongue's 32) | stops at **(98, 88) on 18**, hits 0.5 / 29 |
| `lavatrap-iframes` | three presses | 2nd on **38**, `hitsTimer 9`, no damage; the 3rd (after the player was moved) flies past on another row — the model agrees |
| `icetrap-live` | (a) L53, facing W at `icetrap@160,192` | stops at **(178, 200) on 14**; hits 0 / 0 throughout (`canHit = false`) |
| `sandtrap-live` | (a) L16, facing W at `sandtrap@48,32` | stops at **(66, 40) on 14**, hits 0.5 / 29 |
| `sandtrap-l36` | (a) L36, facing N at `sandtrap@64,80` | stops at **(72, 98) on 14**, hits 0.5 |
| `sandtrap-die` | (b) C1's L36 sword kill, the wand pressed at 90 | stops at (56, 87) on **99** on `sandtrap@48,80` in **"die"** (hits 3) |
| `sandtrap-removed` | (b) the same, pressed at 112 | both killed traps gone; the shot flies on to (56, 39), tick 136 |
| `wallflyer-flight` | (c) L27, on `wallflyer@192,48`'s trigger ray: it launches at the player | met **in flight** at **(177, 56) on 16** (its box as the previous tick left it, `v` -4); the hit reverses `v` (it moves **+4** that tick, to x 189) and its own tail re-aims it at the player; hits 0.5 / 29 |
| `drill-sit` | (a) L88, 59 px W of the SITTING (invisible) `drill@128,160` (outside its 48 px run range) | stops at **(130, 168) on 25**; the drill plays **"hit"** for its i-frames, hits 0.5 |
| `drill-hop` | (c) L88, below it: the drill hops at the player on tick 1 (to (136, 184)) | met at its hopped cell, **(136, 190) on 13**; "hit", no hop through its i-frames, then "undrill" → "sit" and a hop again |

Hits on the player: 0 in every witness but `lavatrap-live`, `wallflyer-flight` and `drill-hop` (1 each — the trap's
tongue, the flyer's contact, the drill's contact; the model takes each at the same point: the player matches at 0 px).

### The map — every place a shot reads bodies, and every reader of the state a hit changes

| site | OFF | ON |
|---|---|---|
| `levelRun.assertWandShotSolidsBound` (the press) | `boxed` + chasers (`wandShotChaserBodies`) + trap bodies (`wandShotTrapBodies`) | + `wandEnemyBodyIdsFor(level)`: the six classes' ids whose state the run holds (Turret only with `STATIC_SWORD_ARM`; Drill only if `drillStateFor` steps it); none under `noclip`/`noDamage` |
| `levelRun.wandShotBlockerAt` (1) `collidesSolid` | tiles, Solid entities, unwoken totems, ice-turret corpses, magical locks | unchanged (none of the six is Solid) |
| `wandShotBlockerAt` (2) the Enemy arm | woken totems, spinners, chasers, trap bodies | **first** `wandEnemyBodiesAt(box)`: static rows' census box until `removed`; a flyer's / drill's live box until `removed`. Two or more "Enemy" bodies under one box (any arm) → refused by name |
| `levelRun.applyWandShotToBoss` | a non-totem Enemy refuses *"not a BossTotem"* | → `applyWandShotToEnemyBody`: `enemyHit` on F4's row (Turret, SandTrap) or the LavaTrap wand row; IceTrap: `canHit` false; `hitWallFlyer` / `hitDrill`; a KILL refuses by name |
| `stepStaticBodiesNow` | steps F4's rows (arrow / sword) | the same rows — a wand hit's `hitsTimer` runs down there |
| `stepShootersNow` (the turret's fire gate) | reads the row's `hitsTimer` | the same: a wand hit holds the next shot (`turret-live`, `-iframes`: spits match) |
| the static contact scan / `turretHitPlayerNow` | read the row's `hitsTimer`, `dying`, `destroy` | the same: a hit body's `hitPlayer` is suppressed for its i-frames |
| `stepWallFlyersNow`, `stepDrillsNow`, `corridorBodyForecastNow` | read `wallFlyerStateFor` / `drillStateFor` | the same maps, now with the hit written (`v`, `hits`, `hitsTimer`) |
| `stepWandLavaTrapsNow` (new, in the static slot) | — (never built) | the LavaTrap rows' `hitUpdate` (on-screen gated) |
| `solverBot.previewWandShot` (hammer's) | `collidesSolid` only — Enemy-blind by design | unchanged (not this slice) |

## D2 — the key

`wandShotEnemyBodies` (default OFF), last in `CONTACT_FIDELITY_DEFAULTS`, its doc block in `contactFidelity.js` (the
witnesses and cites above), its env lines (`SEEDLING_WAND_SHOT_ENEMY_BODIES=0|1`) and its `SOLVER_ENV_NAMES` entry.
New in `levelRun.js` (all unreachable OFF): `wandEnemyBodyIdsFor`, `wandEnemyBodiesAt`, `wandLavaTrapStateFor` +
`stepWandLavaTrapsNow` (reset per visit beside F4's rows), `applyWandShotToEnemyBody`, the `wandEnemyBodyHits` and
`wandLavaTraps` getters. `levelRunStateDigest.test.js`'s `DIGEST_EXEMPT` takes `wandLavaTrapStates` (UNREAD: read via
advance, wandLavaTraps — `wandShotStates`' reach), appended last.

**Covered: all six classes. Still refused, by name:** under `noclip || noDamage` (no body stepped — the chasers' gate);
a Turret with `STATIC_SWORD_ARM` OFF (no damage row); a Drill the run does not step (`drillLive` OFF); **a KILL** (the
sixth landed plain-wand hit — 30 i-frames apart: `dieEffects("Wand")`'s Explosion for
Turret/SandTrap/WallFlyer/Drill, the tongue's end for a LavaTrap); a shot box over two or more "Enemy" bodies on one step;
a WallFlyer met before its `check()`.

### Rows

`fidelityWandEnemyBodies.test.js` (fast, 65 rows): the key (OFF, last, env); the 16 recordings (p4g, the probe's tape
today, all six classes seen); per witness ON = the game, OFF = the shipped refusal; the measured numbers per class; the
four walk rooms (OFF refuses; the key alone refuses on the trap body only; both keys get past it); the census pin (the
six classes by level; only DarkTrap/Grenade outside them); every census room fires ON from a stance that reaches the
press; the gates (`noDamage`, `STATIC_SWORD_ARM` OFF, `drillLive` OFF); the kill refusal (L59, six presses: hits
0.5 → 2.5, the sixth refused); the two-body refusal (a second icetrap staged 8 px above L53's); composition — six
witnesses with the base's last eight OFF keys ON, four with `wandShotTrapBodies` ON beside the key.
`fidelityWandEnemyBodies.slow.test.js`: every committed tape ON vs OFF in three arms; S1 37:8 with both keys ON.

Key-order pins: 31 test files took the new key at the end of their lists (the two `slice(-N)` rows went to N+1), plus
`contactFidelity.test.js`'s full-defaults object, `fidelityDeadFrame.test.js`'s appended-last row and
`fidelityWandTrapBodies.test.js`'s "last key" row (now "followed only by `wandShotEnemyBodies`").

### Mutants (predicted, broken in a copy of `levelRun.js`, restored with `cmp`)

| mutant | predicted | shown (the failing rows) |
|---|---|---|
| M1 a dying/fading turret or sandtrap is not a body | `turret-die`, `turret-fade`, `sandtrap-die` | exactly those three witnesses, the L62 walk-room row and `turret-die`'s composition row |
| M2 a Turret/SandTrap hit does not land (no `enemyHit`) | the five live turret/sandtrap witnesses, the kill row | `turret-live`, `-iframes`, `-l65`, `sandtrap-live`, `-l36`, the kill row, two composition rows |
| M3 the flyer's knockback dropped | `wallflyer-flight` | exactly it and its two composition rows |
| M4 the LavaTrap i-frames do not run down | both lavatrap witnesses | exactly those and one composition row |
| M5 the drill's hit dropped | both drill witnesses | exactly those and their two composition rows |

## L59 / L62 / L65 / L78, OFF vs ON

| room | OFF (shipped) | key alone | both wand keys ON |
|---|---|---|---|
| L59 | *"… 2 … cannot place: grenade@112,112, turret@152,64."* | *"… 1 … grenade@112,112."* | fires; `turret-live`: stops on the turret at (151, 72), t15 — the game |
| L62 | *"… 2 … turret@232,248, darktrap@112,208."* | *"… 1 … darktrap@112,208."* | fires; `turret-die`/`-fade`/`-removed` — the game. (The turret stands on a pit island: every cardinal stance within wand range is a pit — the boot falls and restarts on tick 20; the walk's shot there is the C1 sword stance's.) |
| L65 | *"… 2 … darktrap@144,144, turret@64,112."* | *"… 1 … darktrap@144,144."* | fires; `turret-l65`: (63, 120), t15 — the game |
| L78 | *"… 4 … lavatrap@96,80, lavatrap@144,48, lavatrap@144,96, grenade@232,72."* | *"… 1 … grenade@232,72."* | fires; `lavatrap-live`: (98, 88), t18 — the game |

No captured request for these rooms is in the container (re-measure-10 stops before them), so there is no end-to-end
route shot to replay; each row is the room's staged shot. Whether the walk *solves* them is the solver's (hammer's).

## D3 — the ON measurement

- **Byte-inertia OFF.** `git diff --name-only e29efdf8 HEAD | grep -aE 'fixtures/|golden|tapes/'` lists only the 16 ADDED
  witness files (`fixtures/wandenemybodies-witness/*.json`); with `--diff-filter=MD` it is **empty** — no existing fixture,
  golden or tape changed.
- **Acceptance batch** (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`): base **`391322d681b7aa0229d94b3f6906d024`**
  (measured in a worktree at `e29efdf8`), head OFF **`391322d6…`**, head ON **`391322d6…`**, head ON with
  `wandShotTrapBodies` ON beside it **`391322d6…`** — no seed or field moved.
- **Every committed tape, OFF vs ON** (`fidelityWandEnemyBodies.slow.test.js`): 322 tapes, **0 movers** alone, **0** beside
  `wandShotTrapBodies` alone, **0** beside the base's last eight OFF keys. No committed tape fires a wand in a room of the six
  classes (OFF every such press throws).
- **The hit gate:** no tape moves, so none goes hitless → hit. No wand kill is modelled (refused), so no turret is "killed
  late" and no flyer is knocked out of the model's sight: a reversed flyer is stepped from its reversed `v` (`wallflyer-flight`
  — its contact on the player is the game's, at the same tick). The three witnesses that take a hit (`lavatrap-live`,
  `wallflyer-flight`, `drill-hop`, 1 each) take it identically in the model, and OFF their press is refused.
- **ON movers** (`SEEDLING_WAND_SHOT_ENEMY_BODIES=1` over every test file naming `WandShot`, `wand`, `turret`, `lavaTrap`,
  `wallFlyer`, `iceTrap`, `sandTrap`, `drill` or `pressEnemies`, case-insensitive): **294 fast files** (8361 rows): 3 red ON,
  **none a model mover**:
  - `frontend/modules/seedlingDemo/contactFidelity.test.js` › *"the shipped defaults: all three ON"* — **OFF-contract**: it pins
    the LIVE process's `CONTACT_FIDELITY` to the shipped defaults, so any key set by env reds it. Green OFF.
  - `frontend/modules/seedlingDemo/fidelityWandTrapBodies.test.js` › *"… a residue class still refuses by name (L59: turret)"* —
    **OFF-contract / game-witnessed**: wave 67's row pins L59's turret as residue; ON this key places it, and `turret-live` is
    the game witness for exactly that shot. Green OFF.
  - `scripts/procgen/boxLock.test.js` › *"takes conditionally exactly where a headless arm would have been queued"* — **not this
    slice's model**: the new probe takes the box inside `main()` and had to be declared in the import-door list. Red OFF as
    well; **fixed** (`ed2cad93`), green.
  - The **28 slow/train files** that name them, one at a time, ON (`vitest.slow.config.js` / `vitest.train.config.js`): all
    green — `actionNodesTownScale.slow` 11, `braidRegime2.slow` 47, `deriveLevelWorldLogic.latchSandwich.slow` 3,
    `deriveLevelWorldLogic.slow` 2, `fidelityCorpseBump2.train` 3, `fidelityL40Latch.train` 5, `fidelityWandTrapBodies.slow` 3,
    `hammerApproachOrder` 7, `hammerBk2Combat` 4, `hammerBodyGate` 4, `hammerEscapeExact` 2, `hammerIceTurretStatic` 2,
    `hammerKeylockTurret` 1, `hammerKeylockTurretArrival` 3, `hammerLatchWeigh` 2, `hammerOppDashDefers` 2,
    `hammerOppFallbackHits` 3, `hammerOppPressFallback` 4, `hammerPocketBurn` 4, `hammerSouthDoor` 4, `hammerSpinnerPress` 2,
    `hammerStagedHuntScanMemo` 1, `hammerTurretApproach` 3, `hammerWallFlyerDrillKill` 5, `hammerWallFlyerGaps` 1 (all
    `.train`), `strategySwitchApproach.slow` 1, `strategySwitchEscape.slow` 2, `derive-seedling-wallflyer-nohit.train` 1.
- **The named sweep** (the keyed ON-arm, shards = min(10, legs)): the survey legs whose route fires a wand in a room of the six
  classes — **L6, L8, L16, L22, L25, L27, L28, L29, L36, L45, L46, L53, L54, L59, L62, L65, L77, L78, L80, L88, L91, L108**
  (with `wandShotTrapBodies` ON beside it for L59/L62/L65/L78). **Not countable here**: the survey cache is not in the
  container, and no committed evidence (every plain file and all 322 `.gz` files under `CC/docs`) holds a leg refused on the
  WandShot text for any of the six — today every such press refuses, so the legs that would fire are exactly the ones whose
  plans the solver never built. The planner's sweep should filter on those levels; on the late walk the first is **L65**
  (entry 37's exit).

## What the brief got wrong (measured)

- *"Today L59, L62 and L65 refuse on their Turret, and L78 on its LavaTraps"* — they also refuse on wave 67's trap
  bodies unless `wandShotTrapBodies` is ON: this key alone leaves each refusing on exactly one trap body. The walk needs
  both keys.
- *"A Turret, WallFlyer or Drill may take damage, die, get knocked back or turn into a corpse"* — one wand hit cannot
  kill anything: `damage` 0.5 against `hitsMax` 3 is six landed hits, each after the last one's 30 i-frames. What a single
  hit changes is `hits`/`hitsTimer` (all but the IceTrap), the turret's next shot, the drill's hop and the flyer's `v`;
  the kill is refused by name.
- *"a turret killed by the wand must stop firing in the player's danger view"* — no wand kill is modelled (refused); a
  sword-killed turret already stops (C1), and its dying/fading body is a wand body (`turret-die`, `-fade`).
- The Turret's corpse in `collidesSolid` (*"TURRET CORPSES"*) is the IceTurret's; a `Turret` never goes Solid — it is an
  "Enemy" body until `Mobile.death`'s fade removes it.
- Wave 67's report says a box over a trap body AND a totem/spinner refuses; in `wandShotBlockerAt` the first totem and
  spinner loops (unchanged from before wave 67) return before its guard, so only the chaser arm refuses — the totem and
  spinner arms of that guard are unreachable. No room holds a darktrap or grenade beside a totem or spinner, so it is
  not observable on the extract; this key's own guard (all arms, when one of the six is under the box) refuses.

## Findings outside this key (hand-overs, not fixed)

- **The wand verb: a lone wand press during a sword swing.** `set wanding` is gated on `!slashing` (`Player.as:834`).
  The model admits a lone press unconditionally (`levelRun` `pressCalls`: `pressCalls.length === 0 || …`). MEASURED on
  p4g (`c1-l62-turret` cut at 86, the Wand selected at 86): the sword press at 84 → a wand press at **88 or 89 fires
  nothing in the game**; the model opens a window and fires a shot (it stops at (236, 255) on 97). A press at 90 fires in
  both. Owner: whoever owns the press verbs (`levelRun`'s useItem dispatch) — it needs its own key.
- **The drill's sight line on L88.** `stepDrill`'s `collideLine("Solid", …)` reads `tile:Cliff` (160..176, 160..176) as
  blocking from `drill@128,160` (136,168) to the player at (176,168); the GAME's drill hops at the player on tick 1 (to x
  152) and the model's never does (measured: the first `drill-sit` stance). The wand shot crosses that tile in both. Owner:
  the drill rows (`fidelityDrill*`).
- **Hammer (`seedling-hammer-phase-planning-16`)**: unchanged from wave 67 — entry 37 stops on the axe-dodge ladder in
  L63 (`8c781b9832a7`, both wand keys ON). Past it the exit leads to **L65**, which now fires with both keys ON; the
  solver's own `previewWandShot` is still Enemy-blind there (a turret and a darktrap the preview does not see: a planned
  shot it thinks is clear stops in the run, which the run reports).

## Residue (still refused, by name)

- **The kill**, for all six classes. Sizing: Turret/SandTrap/WallFlyer/Drill need `dieEffects("Wand")`'s Explosion staged
  (the totem's `pendingBlasts` drain is the shape — `applyExplosion` tests only the player, so its Enemy half and the
  `Rng.cos()` draw would be new, plus each class's existing death staging: F4's row, `stageWallFlyerKill`,
  `stageDrillKill`), and a game witness of six spaced shots per class. A LavaTrap's death needs its chomp disc made
  per-visit in `levelWorld` (the tongue is not stepped at all).
- Two or more "Enemy" bodies under one shot box on one step (the type-list order is not held).
- `noclip`/`noDamage`; a Turret with `STATIC_SWORD_ARM` OFF; a Drill `drillStateFor` does not step.
- The solver's wand preview stays Enemy-blind (hammer's).

## Gates

Last CODE head: **`ed2cad93`** (it touches `frontend/modules/seedlingDemo/` and `scripts/procgen/`, filtered paths).

| gate | base `e29efdf8` | head |
|---|---|---|
| bounded vitest (`--maxWorkers=3`): `contactFidelity*`, `levelRun*`, `levelWorld*`, `wand*`, `fidelityWand*`, `fidelityL12Doors*`, `fidelityLadder2*`, `fidelityStaticLadder*`, `fidelityTurret*`, `fidelityWallFlyer*`, `turret*`, `wallFlyer*`, `enemyDamage*`, `oneSpelling`, every file naming `assertWandShotSolidsBound` / `wandShotBlockerAt` / `wandTrapBodyIdsFor` / either wand-body key (the key-order pins), `r8Acceptance`, `tapeEnvelope`, `solverDeadline`, `decisionTrace`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface` (+ `levelRunStateDigest`, `boxLock` at the head) | 60 files, 1556 passed, 1 skipped | **62 files, 1649 passed** (the first head run had 3 red — the constants census before its `--write`, and the state-digest guard twice on the new `wandLavaTrapStates` map; both fixed, green) |
| `fidelityWandEnemyBodies.slow.test.js` | — | 4/4 |
| `ci-producer-checks.mjs --jobs=3` | — | 99 run, 0 red, 1 skipped, 0 known-red |
| `check-procgen-docs.mjs` | — | ALL CHECKS PASSED |
| `generate-procgen-reference.mjs --check` | — | red on the new probe (instruments) → regenerated → **ALL 7 MODULES AND 5 REGIONS MATCH** |
| `census-seedling-constants.mjs --check` (after `--write`; `--profile-rows` rewrote its csv byte-identically) | 7 new + 1107 moved | PASS (0 new, 0 moved) |
| `census-seedling-solver-surface.mjs --check` (after `--write`: line moves only) | — | GREEN, 374 rows |
| `solve-seedling-{r8-battery,r8-d2-chain,r8-l18,r8-tail,r9-l3,r9-campaign}.mjs --check` | — | all six green |
| CI `JavaScript Unit Tests` at `ed2cad93` (run 45904095495) | — | **success**: suite `vitest (unfiltered)` 1448 files / **30484 passed, 0 skipped, 0 failed**; slow battery 42 files / **469 passed, 0 failed** |

⛔ No unfiltered vitest, no `pytest`, no `standing-values --write`. **For the planner:** dispatch
`unittests_frontend.yml -f train_only=true` at the head (this session cannot dispatch) — the 21 train files that name the
classes ran green here ON one at a time, not as CI shards.

## Evidence in the branch

- the probe and its 16 recordings; the fast and slow rows; the D1 measurements above (the press-swallow boundary and the
  drill sight line are from this session's probe runs, recorded here).
