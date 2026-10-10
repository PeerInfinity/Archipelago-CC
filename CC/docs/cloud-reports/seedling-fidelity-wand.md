# Seedling fidelity WAND: a wand shot opens a MagicalLock, and a WandLock was never its target

| | |
|---|---|
| Session | `seedling-fidelity-wand` (planner `seedling-fidelity-planning-5`, wave 11, model coverage) |
| Start SHA | `99cdf5ce23` (main after wave 10 `d978c76322` + the rules arc's F3; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-wandlock-wand-tw3tkd` |
| Commits | D1 `5d1e688` · D2 `049d53f` + door/census `b8b87fb` + constants row `a3b93ce` · D3 `b553bcb` · log + reference `ca6d054` · this report |
| Verdicts | **W0 PASS · D1 PASS (the brief's premise is overturned) · D2 PASS (switch `WAND_VERB` ships OFF; the flip is the user's) · D3 PASS (three game witnesses at 0 px; the L39 rows do not solve, by measurement)** |

**The one thing to know first.** In the game a wand shot **cannot open a `WandLock`**. `WandShot.checkEntity` acts on
an `Enemy` or a `MagicalLock` and nothing else, and `WandLock extends Lock` with only a different sprite. So the
table row `solid:wandlock → wand` named a verb that can never open that lock. I measured it on the game: the shot dies
on L39's plug, no flag is written, and the wall holds. The model agrees at 0 px. The real `wand` work is the
**MagicalLock** (its row said `kill`, which cannot open it either). That verb is now built and game-witnessed,
including one whole reach-exit solved through it. Survey steps 60/81/130 do not solve, and that is correct: L39's
plug is removed **at build** by L38's `buttonroom@32,48` writing `{39,8}`. The route never presses that button,
because the rules carry no event for it. That is a route/rules work order, not a wand one.

## W0 — bank at base (`99cdf5ce23`)

The base was measured in a detached worktree of `99cdf5ce23`. Its submodules and `node_modules` are symlinks to the
primary tree's, and it was served on its own port (9601).

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0, python 3.13.16 |
| identity block (base) | `SEEDLING_PORT=9601 bash scripts/procgen/identity-block.sh .` in the worktree | log md5 `8fa743a3fa1a2a076bb0e64f0b93dc2f`: maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. Generated set: environmental (a worktree has no venv) |
| six `--check`s (base) | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, all exit 0 |
| reference (base) | in the block | 4 DIFFER: environmental (the substrate submodules), as in every cloud session |
| tapeRunner (base) | `npx vitest run …/tapeRunner.test.js --reporter=json`, md5 over sorted `status\tfullName` | **589** pairs, `e6c073f99ac92cd28a56f4a95a17d325`, 0 non-pass |
| bounded vitest BEFORE (base) | the standing set + every test file that touches what I changed (see below) | **78 files, 2,900 tests, 2,900 pass**, md5 `f63b21669f3ffee28b73e4b33e473bcf` |
| surface / constants (base) | NOT run at base. My first `--check`s ran on the edited tree, and their reds were only my own rows (11 surface rows, 1 literal). So base is the committed tables: 234 surface rows (245 − my 11), 5,488 literals (5,489 − my 1) | — (my AFTERs below) |

The bounded set is the brief's standing list (`r8Acceptance`, the roster pins, `ropeSword`, `shoveWeighParity`,
`watchGenOverlay`, `watchOverlays`, `r5Shaft`, `fidelityArrival`/`Axe`/`KillLock`/`Ladder2`/`Crusher`, `ghostSword`,
`bobSoldier`, `solverReachPit`, `arrowTrap`, `oneSpelling`, `enemyDamage`, `dangerMap`, `contactFidelity`,
`decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations`,
`boxLock`, `lintGateLabels`, the surface and constants tests). It also includes every test file that `grep -a`
finds for `refineStrategy|frontierExecutor|OBSTACLE_STRATEGIES|STRATEGY_EXECUTORS|KNOWN_STRATEGY_VERBS|
magicalLocksOpened|wandShotHits|wandShots|earnedClears|clear-tag|wandlock|magicallock|WAND_|wandVerb|solverView|
execClearTag|magicalLock` (`.slow`/`.calib` excluded). tapeRunner is measured separately.

## D1 — what opens a WandLock, measured on the game (PASS; the premise is overturned)

**The source.** `Projectiles/WandShot.as` is a `Mobile` with speed 3 (`Player.wandSpeed`). It spawns 16 px out
(`sprWand.width`) along the facing, at `wandEnd`. Its life is `tilesMove 3 · 16 / 3 = 16` updates (48 px). Its solids
are `Mobile.solids` plus `"Enemy"`. It is culled 160 px outside the camera. `checkEntity(_e)`:

```
if (_e is Enemy)            (_e as Enemy).hit(force 3, Point(x,y), damage, "Wand");
else if (_e is MagicalLock) (_e as MagicalLock).hit(shotType);      // 0 wand, 1 fire wand
play("die"); Music.playSound("Wand Fizzle")
```

`MagicalLock.hit(t)` opens on `lockType <= t`: it calls `Game.setPersistence(tag, false)` on the hit tick and plays
`"destroy"` (7 frames at 15), whose wrap removes the lock. `WandLock` (`Puzzlements/WandLock.as`) is
`super(_x, _y, _t, _tag, sprWandLock)` on `Lock`: type `"Solid"` and the same `activationStep` (0.01 fade, the
occupancy-guarded `returnToNormal`). A shot reaching it takes the third arm and only dies. A `WandLock` opens the way
every `Lock` does:

- its `tSet` group: buttons, ropes, a pushed block on a button;
- `checkEnemies()` for `tSet == -1`;
- `Wand.removed()`'s `tset 0` activation ("Activate falling blocks");
- a tag cleared before the build (`Lock.check()`: `tag >= 0 && tSet < 0 && !checkPersistence(tag)` removes it).

L39's plug `wandlock@144,592 {tset -1, tag 8}` is that last case. `r5Totem.TOTEM_ENTRANCE` already carries it: L38's
`buttonroom@32,48 {tset 8, room 39, flip}` writes `{39,8} = false`.

**The instrument.** The new `probe-seedling-wand-mobiles.mjs` follows the darktrap probe's shape. It reads the game's
`WandShot` rows from `botMobiles()` and the boot level's `persistence_cleared` (its delta from the first sample). It
joins them with the model's `run.wandShotsLive` (a new read-only getter) and `run.earnedClears`. The comparison covers
shot presence, (x, y) and anim at every sampled tick, and the set of wand-subject flags (the room's MagicalLock and
WandLock tags, read off the built world). The player x/y calibrates the sample clock. Other flags print as INFO.

**The witness** `wand-l39-wandlock-shot` (p4f, headless, `SEEDLING_PORT=9600`). It uses survey step 60's staging with
the Wand granted: up 6 ticks, the Wand's slot at t8, one press at t12, then up from t60. Game and model agree:

- the shot spawns at (152,594), inside the plug's box;
- it plays "die" on its next update and is removed;
- `{39,8}` is never written, and the walk north stays at y 610.1;
- 0 px over 121 ticks, 16 shot samples.

I recorded it twice. A third, earlier run failed the sample-clock calibration with 120 samples (one sample missing).
That is a sampling hiccup, and the record step refuses on it by design.

**What this measures about the model's wand arm.** The model already carried the game's shot (`wandShot.js`,
`wandVerb.js`, R6): spawn, epsilon axis, life, the die clock, the MagicalLock arm. It matches the game on every
sample of all three witnesses. The one gap is under D2: the MagicalLock's flag.

## D2 — the `wand` verb, behind `WAND_VERB` (PASS; OFF by default)

The switch is `wandVerb.WAND_VERB`, OFF by default; `SEEDLING_WAND_VERB=1` or `withWandVerb(true, …)` turns it on.
With it OFF, every lookup answers what it did before this slice. The shared tables keep their words.

- **`refineStrategy`** (the selection path that already turns `hold` into `kill`/`weigh`/`pulse`/`skirt`):
  - a `solid:magicallock` or `solid:magicallockfire` selects `wand`;
  - a `wandlock` whose table row says `wand` continues as `hold`, so a `tSet -1` plug reaches the kill-lock arm and a
    grouped one reaches its presser.
- **`resolveWandStrategy`** checks the game's gate first: `lockType <= shotType`. A fire lock without the Fire Wand
  refuses by name. The Fire Wand's slot is `useItem` case 5, which `levelRun.weaponForPress` refuses, so it also
  refuses by name, with the case-5 press as the work order. No wand refuses by name too. It then picks a stance:
  - candidates are walkable tile centres on the lock's row or column, up to 4 tiles back;
  - a LEAN toward the lock sets `Player.direction` the only certain way (`sprites()` writes it from the velocity);
  - the shot is previewed from where the lean ends, with the model's own `stepWandShot` against the live solids;
  - the stance is the first candidate whose first blocker is the lock and that `stanceReaches`.
- **`execWand`**: settle, lean, check the facing and the preview again live, select the Wand's slot, press once, wait
  until `run.magicalLocksOpened` reaches the lock's `openTick`, then restore the slot. The wait is bounded by the
  derived window: fire tick + 1 + 16 + 15 + 4.
- **Registered only while on**, in `frontierExecutor` and in a new clear-tag lookup (`clearTagExecutor`, the frozen
  table plus `wand`). `bait` was never in the clear-tag path and is not added.
- **The model gap, under the switch:** `levelRun.earnedClears` now carries a MagicalLock's
  `Game.setPersistence(tag, false)` at the hit tick. The model opened the cell on the right tick and never wrote the
  flag. Every consumer of `earnedClears` (survey staging, clear-tag, the next arrival's build) saw a lock that had never
  been broken. A walk-only witness cannot see this; the probe's flag join did.
- `decisionTrace.KNOWN_STRATEGY_VERBS` gains `wand`. The imports go through `solverView.js`, the surface census's
  door.

**New `SolverRefusal` content:** no new `obstacle.kind`. Wand refusals carry `{kind: 'solid', tag, id}`, as `burn`'s do.
`surveyFamily` already classifies them as ITEM-GATE.

**Mutants** (predicted first, made by copy and restore, `cmp` clean after):

| # | mutant | predicted | measured (`fidelityWand.test.js`) |
|---|---|---|---|
| M1 | drop the `wandlock → hold` refinement | the step-81 row fails (its refusal names `'wand'`) | 1 red: exactly that row |
| M2 | drop the `earnedClears` fold | the L68 witness's flag join and the ON-fold row fail | 4 red: those two, plus the planner-reproduces row and the L68 solve row. The clear-tag goal waits on the flag, so it refuses: wider than predicted, same cause |
| M3 | lean map `up → 3, down → 1` | the L68 solve refuses (no clear line) | 2 red: the L68 solve and the planner-reproduces row |

## D3 — witnesses and the census (PASS)

**Game witnesses** (p4f, headless; all embedded in `fixtures/wand-witness/`; tapes authored by
`plan-seedling-wand-witness.mjs`, whose `--check` re-derives all three byte-equal; replayed by `fidelityWand.test.js`):

| witness | what | game = model |
|---|---|---|
| `wand-l39-wandlock-shot` | D1's negative (above) | 121 ticks, 16 shot samples, no flag |
| `wand-l68-magicallock` | survey step 147's staging (keys 0–4, the route's staged flags); the solver's own plan for two clear-tags: `keylock` opens `bosslock@16,32` (the two locks share a cell), then `wand` leans up, presses at t122, the shot spawns at (24,34) at t130, dies at t131 with `{68,1}` in the game's readout, the cell opens at t145, and 12 ticks of up walk to y 36.2 | 158 ticks, 16 shot samples, `{68,1}` the same tick |
| `wand-l34-barhouse-exit` | sweep-3 leg 354's arrival (L34 (32,128)) with the Wand: a whole reach-exit SOLVED (188 t). `magicallock@128,0` stands on the teleporter; wand pressed t163, hit t171, open t186, then into L12 | 187 samples, 16 shot samples, `{34,0}` the same tick, the transition |

INFO from the L68 witness, measured in passing (not this slice's verb): the bosslock's `{68,0}` is in the model's
`earnedClears` at observation 97 and in the game's `persistence_cleared` at 98. The keylock ledger (`keyOpens.t`) is
stamped one tick before the game shows the write. I handed this to the keylock owner and did not fix it here.

**The survey.** I ran the 27 steps whose level holds a wandlock or a MagicalLock locally, OFF and ON (the default
per-step timeout). OFF equals CI 38075646127 on every step that finished. Steps 43, 63, 154 and 185 (L12) TIMEOUT
locally both OFF and ON: a machine fact; CI solved 43 and refused the others.

| step | level | CI | OFF | ON |
|---|---|---|---|---|
| 60 | L39 | REFUSED `'wand' SELECTED but not registered` | = | REFUSED in `kill`: the plug is a kill-lock and its spinners stand behind it (*"the kill work order has no weapon"*) |
| 81 | L39 | REFUSED (same) | = | REFUSED in `kill` (same) |
| 130 | L39 | REFUSED (same) | = | REFUSED in `kill` (same) |
| 147 | L68 | REFUSED `magicallock` / `'kill' failed to apply` | = | `keylock` + `wand` APPLY (the lock opens); then REFUSED on `pickup:health`: the collect stance (8,8) lies past its own pickup (the steps 82/94/123 family) |
| 208 | L101 | REFUSED | = | REFUSED by name: fire lock, no Fire Wand (ITEM-GATE) |
| 213 | L101 | REFUSED `magicallockfire` no row | = | REFUSED by name: the Fire Wand is the unmodelled case-5 press (ITEM-GATE) |
| 82 | L40 | REFUSED (`pickup:totempart` frontier) | = | REFUSED: `hold` on `wandlock@448,432`; its stance is behind it (STANCE_REENTRY) |
| 61 | L40 | REFUSED (shove) | = | REFUSED, same verdict; only the frontier list reorders (the wandlock now sorts as actionable) |
| the other 19 | L12/L40/L41/L43/L101 | — | = | = (no SOLVED row moves; ticks identical) |

**The route's wandlocks** (15 on route levels; the brief said fourteen plus the plug):

- **L39 (5).** The plug `{tset -1, tag 8}` opens by L38's button write. Behind it is `rope@96,384` (with the plug
  staged cleared, OFF and ON both refuse *"Obstacle: solid:rope … No strategy row exists"*). Behind the rope are the
  shaft's `wandlock@144,64/48/32` (t3/4/5), held only by `PushableBlockFire`s that the fire attack moves onto their
  buttons (`r5Totem.TOTEM_SHAFT`), and `wandlock@48,160 {t1}`.
- **L40 (9)** and **L41 (1).** Button/rope groups (`r5Totem`). Under ON they reach `hold` and refuse at the stance
  (step 82), or never reach the frontier (L41's step 83 refuses on the crusher bait first).
- **None now solves.** None of them is a wand target.

**The sweep.** Sweep-3 (CI 38010249317, 841 legs) names a wand/wandlock in **0** legs' `failed` text and a MagicalLock
in **1**: leg 354 (L34, `in_L12_336_688`, no items). Under the switch it becomes *"needs the WAND"* (ITEM-GATE).
With the Wand the same arrival solves (the third witness).

### The CI dispatches the planner should run

The survey and sweep workflows take no env input, and `WAND_VERB` reads `process.env`, which the sweep's page worker
does not have. So both need a branch whose default is ON. That branch is my head plus this one line in
`frontend/modules/seedlingDemo/wandVerb.js`:

```diff
-export const WAND_VERB = { enabled: globalThis.process?.env?.SEEDLING_WAND_VERB === '1' };
+export const WAND_VERB = { enabled: globalThis.process?.env?.SEEDLING_WAND_VERB !== '0' };
```

…plus the two default-pin rows in `fidelityWand.test.js` (`ships OFF`, `ON registers … only while it is on`). Then:

- survey: `gh workflow run seedling-survey.yml -R PeerInfinity/Archipelago-CC --ref <flip-branch> -f route=full
  -f through=end -f only=60,61,81,82,130,147,208,213 -f base_run=38075646127`. Expected: the eight ON rows above;
  147's wand APPLY is the row to read.
- sweep: `gh workflow run seedling-divergence-sweep.yml -R PeerInfinity/Archipelago-CC --ref <flip-branch>
  -f producer=solver -f ids=354` (and the OFF control on `claude/seedling-wandlock-wand-tw3tkd`). Expected:
  leg 354 → "needs the WAND".

## Byte-inertia (the switch OFF)

| row | result |
|---|---|
| identity block AFTER (`b8b87fb`) | every row = base's (`diff`: only the generated-set row, environmental at base, `OK` at head); log md5 `0d927f7161962ca3aa2fba0f548d9a54` |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, exit 0 (= base) |
| tapeRunner | 589 pairs, `e6c073f9…` (= base) |
| bounded vitest AFTER (the tree of `ca6d054`) | **79 files, 2,910 tests, 2,910 pass**, md5 `b019cef3062278310adb525bc1dc2c1a`; without `fidelityWand` the 2,900 rows' md5 is `f63b21669f3ffee28b73e4b33e473bcf` = BEFORE's, exactly. An earlier AFTER, before `a3b93ce`, was red on two `seedlingConstantsCensus` rows (see Records) |
| survey, the 27 wand-level steps | OFF = CI on every finished step |

## Switch ON: everything measured, for the licence

| row | result |
|---|---|
| bounded set ON + tapeRunner (`SEEDLING_WAND_VERB=1`, 80 files, 3,499 tests) | red ONLY on `fidelityWand`'s two default-pin rows; tapeRunner 589 pairs `e6c073f9…` (= OFF) |
| identity block + six producer `--check`s ON (`SEEDLING_WAND_VERB=1 … identity-block.sh .`) | every row = OFF's; `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, exit 0; log md5 `cc4834a790ecf1b669bccd36f180266e`. The diff from OFF is the reference row only (7 vs 4 DIFFER): my uncommitted log entry's docs index at the time. Regenerated in `ca6d054`; `check-procgen-reference` now fails only on the environmental `registry.js` |
| survey movers ON | 60, 61, 81, 82, 130, 147, 208, 213 (refusal text only; no SOLVED row moves) |
| sweep movers ON (predicted) | leg 354 |
| committed tapes | none move (tapeRunner equal) |

## Records

| row | result |
|---|---|
| surface | `census-seedling-solver-surface --write`; 11 rows classified → **GREEN 245** |
| constants | the fold's tag sign test classified (exact key, anchor `Puzzlements/MagicalLock.as:setPersistence`) → **PASS 5,489**. ⚠ `--check` passed on my first row while `seedlingConstantsCensus.test.js` did not: a row appended after the profile block breaks the profile-rows pin, and an anchor must be a word, not a line range (fixed `a3b93ce`) |
| reference | regenerated (instruments 409, docs index); the 4 environmental modules restored, not committed; `check-procgen-docs` ALL CHECKS PASSED |
| `check-procgen-help --in-place` | both new scripts PASS (HELP ok, IMPORT ok); 25 FAIL pre-existing (import side effects), none mine |
| `boxLock` | `probe-seedling-wand-mobiles.mjs` in the guarded list; 26/26 |
| roster / tape index | unchanged: the witnesses are embedded fixtures, not roster tapes |
| bot doc / bot log | `seedling-bot.md` (the wand paragraph); `seedling-bot-log.md` WAND entry with trap candidates |
| CI (`JavaScript Unit Tests`) | `ca6d054`: run **38091205690 success**, vitest (unfiltered) **19,469/19,469**, slow battery 253/253 (`ci-vitest-summary.mjs ca6d054`). Earlier heads were superseded by later pushes. This report commit is docs-only (`CC/docs/cloud-reports/`) |
| cleanup | my AFTER identity run's generated-set row left untracked `scripts/procgen/.rl-*`/`.atlas-*` and `worlds/*_worldgen/`; removed, never committed. The base worktree was removed after its symlinks; its server was stopped by PID. The dev server on 9600 (PID 562) is left up |

## What the brief got wrong (measured)

1. *"What opens a WandLock (a `WandShot` hit?)"*: no. A `WandShot` cannot open a `WandLock`. `WandLock` is a `Lock`;
   the shot's acting arms are Enemy and MagicalLock only. Game witness `wand-l39-wandlock-shot`.
2. *"Fourteen `wandlock`s stand on the R1 route … control that can really fire"*: the control's premise (the opener is
   the WAND) is false. On route levels there are 15 wandlocks (L39 5, L40 9, L41 1), and none is a wand target.
3. *"The sweep counts 6 wand/wandlock legs"*: sweep-3's `failed` texts name a wand/wandlock in 0 legs. One leg (354)
   names a MagicalLock.
4. *"Survey 60/81/130 … the wand"*: their wall is the plug, removed at BUILD by L38's `buttonroom@32,48` (`{39,8}`).
   The survey's step 59 (L38) never presses it: its `earnedClears` are `{37,4} {38,5} {38,0} {38,3}`. The rules carry
   no event for it (`level_39__r2c11 → level_39__r0c9` is `True_`). Behind the plug come the rope and the shaft's
   three fire-block wandlocks.
5. `OBSTACLE_STRATEGIES['solid:magicallock'] = 'kill'` is also wrong: a `MagicalLock` has no `tSet` and no enemy check.

## Hand-overs and residue

- **Route / rules (planner, rules arc):** L39's plug is a cross-room build-time write. Either the route presses
  `buttonroom@32,48` on an L38 visit before L39 (step 59 does not), or the rules carry the `{39,8}` event so the
  survey stages it. Until then 60/81/130 refuse correctly.
- **A rope verb** (`solid:rope`, no row): L39's next wall once the plug is gone.
- **PUSHBLOCK:** L39's shaft (`TOTEM_SHAFT`: three `PushableBlockFire`s onto three buttons with the fire attack) and
  L40's `wandlock@448,432` (step 82's STANCE_REENTRY).
- **Collect / pickup-on-frontier** (steps 82, 94, 123 and now 147): a collect stance that lies past its own pickup.
  147 is that family once `keylock` and `wand` have opened the way.
- **Keylock ledger (L12KEYLINE / keylock owner):** `keyOpens.t` (and so `earnedClears`) is stamped one tick before the
  game's `persistence_cleared` shows a BossLock's write (L68 `{68,0}`: model 97, game 98).
- **The Fire Wand** (`useItem` case 5, `wanding` + `firing` on one press): L101's two fire locks (208, 213) wait on it.
- **Nothing for the hammer arc.** Nothing in the JS arc's files changed. The JS arc wires nothing new: no new staging
  or result field, no new obstacle kind. The browser solver reads the switch's code default, so a flip reaches it with
  no wiring.

## Rows to BANK

- `WAND_VERB` OFF; witnesses `wand-l39-wandlock-shot`, `wand-l68-magicallock`, `wand-l34-barhouse-exit` (embedded);
  `fidelityWand` 10 rows; instrument `probe-seedling-wand-mobiles.mjs`, author `plan-seedling-wand-witness.mjs`.
- Surface GREEN 245; constants PASS 5,489; tapeRunner 589 `e6c073f9`; `KNOWN_STRATEGY_VERBS` + `wand`.
- Licence question for the user: flip `WAND_VERB`. Measured movers: survey 60, 61, 81, 82, 130, 147, 208, 213
  (refusal text only), sweep leg 354 (predicted). No tape moves, no producer digest moves (identity block and six `--check`s ON = OFF). The
  bounded set ON is red only on the two default pins the flip re-pins.
