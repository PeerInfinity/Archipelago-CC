# Seedling fidelity PUSHBLOCK — wave 11 (model coverage)

Session `seedling-fidelity-pushblock` (planner `seedling-fidelity-planning-5`).

| | |
|---|---|
| start SHA | `99cdf5ce23` (main after wave 10 `d978c76322` + the rules arc's F3) |
| head | see the last commit on the branch (this report is committed last) |
| harness branch | `claude/seedling-pushblock-spear-j5tn1h` |
| commits | `94ce2be` D1 · `b838ce0` D2 · `8874aaa` D3 · `30b973c` records · this report |

**The one thing to know first: a SWORD slash does not move a `PushableBlockSpear`.** The model said it did, and so
did R4's notes. Game-measured. Only a spear thrust (or a ghost-sword slash) moves the block. The new verb therefore
selects the spear for each thrust.

**Verdicts:** D1 PASS · D2 PASS · D3 PASS. Survey: 146 and 148 REFUSED → SOLVED. 137, 145, 180 and 149 move off
"No strategy row" onto other regions' walls, or onto a sealed room (149).

---

## W0 — bank at base (`99cdf5ce23`, pristine worktree `Archipelago-CC-wt-w0-pushblock`, port 9590)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9590 bash scripts/procgen/identity-block.sh .` | log md5 `a5ba09732b07e6f4593a9a8663ad9a98`; maze `246dfbce…`, acceptance `76602ae8…`, pairs c3 `4937da80…` c6 `430573e9…` c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2 `006b0639…` s5 `7d4cb820…` s9 `49e23d85…`, pre-sword `e28c1e5d…`, post-sword `fb1a59e5…` |
| six `--check`s | in the block | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, campaign `b064c264` — all exit 0 |
| generated set | `check-seedling-generated-set.mjs`, re-run alone with the primary's venv (the worktree has none) | `OK` |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | the four `--check`s, at base in the worktree | **GREEN 234** · **PASS 5,488** · **PASS 528** · **PASS 138** (both) |
| roster | `fixtures/tapes/index.json` | **266** |
| bounded vitest BEFORE | 53 files (below) | **53 files / 2,623 tests, all green**, md5 `f775f853cb9f9ec9cf50080e21a66087`; tapeRunner **589** rows, `73d9d6457056ce0d2ff757edb4d0892a` (`status\tfullName`, sorted, `\n`-joined) |

The 53 files are the brief's standing set: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`,
`dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`,
`r5Shaft`, `fidelityArrival`, `fidelityAxe`, `fidelityKillLock`, `fidelityLadder2`, `fidelityCrusher`, `ghostSword`,
`bobSoldier`, `solverReachPit`, `arrowTrap`, `oneSpelling`, `enemyDamage`, `dangerMap`, `contactFidelity`,
`decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations`,
`boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`. Added to it: `tapeRunner`,
`botDriverV2`, `checkProcgenHelp` and `procgenHelpBaseline` (two new scripts). Also every `rg -a` hit for
`deriveBlockRoute|resolveShoveStrategy|OBSTACLE_STRATEGIES|execRoute|describeRoute|hitPushable|pushableblockspear|PushableBlockSpear|auditPress|PRESS_ARM_POLICY|STRATEGY_EXECUTORS|shoveRefusalDetail|seedling-solver-surface|solverView`
in `*.test.js`: `blockRoute`, `breakVerb`, `breakableRocks`, `fidelityBurn`, `fidelityFrontier3`, `fidelityL14`,
`fidelityProximity`, `fidelityWatcher`, `levelRun`, `levelWorld`, `presses`, `procgenWeigh`, `pushables`,
`solverBot`, `docLinks`, `docsRender`. AFTER adds `spearPush` (new).

---

## D1 — measure (PASS), and the model finding it produced

### The five survey steps, room by room

`recon-seedling-pushes.mjs --level=67,63,65 --grid` (R4's oracle-pinned multi-push search, spear rules) gives the
push structure per room. The solver then re-derives it (D2):

| step | room, boot → goal | what must move | survey after |
|---|---|---|---|
| 137 | L67 (208,112) → Boss Key 4 (48,64), then L59 | `pushableblockspear@144,112` (9,7): **one thrust W from (184,120), two cells east across the pit (10,7)**. The block sinks into (8,7). The two-thrust N,N alternative (from directly south) costs more orders. R4's own leg. | REFUSED: reaches the block, then `arrowtrap@48,48`'s armed lane at the key (not this slice) |
| 145 | L63 (16,96) → `teleporter@128,304` (L65) | `pushableblockspear@112,96` (7,6): **one thrust E from (104,104)** sinks it into (8,6). R4's own leg (stance (100,100)). | REFUSED: the walk to the stance enters the DarkTrap light arm, which refuses (stance settled 1 px off the pole's core) |
| 146 | L65 (128,16) → `teleporter@184,64` (L68) | `pushableblockspear@176,128` (11,8): **W → (10,8) from (200,136); N → (10,7) from (168,168), two cells below across the pit (10,9); W → (9,7) from (200,120), sinks.** R4's three pushes. The third rect also reaches `lightpole@176,120`, as R4's did. | **SOLVED 541 t** |
| 148 | L65 (185,80) → `teleporter@128,0` (L63) | the same block: **one thrust E → (12,8) from (168,136)**. The frontier named `opentree`; with the row, the block sorts first (actionable before walls). | **SOLVED 233 t** |
| 149 | L63 (128,288) → `teleporter@0,96` (L61) | **nothing can.** From that boot the target stays sealed in every reachable block state (recon: "NO BREACH from this entry"; the only legal push is W, which opens nothing). | REFUSED (VERB-APPLY): the resolver finds no route — correct |
| 180 | L63 (16,96) → Chest (232,98), then L61 | the same E thrust as 145 | REFUSED: the same light-arm refusal as 145 |

### The existing `shove` executor does NOT cover a spear block

`resolveShoveStrategy` returned `null` for every non-walk family, and `runShove` is a LEAN: it holds a key into the
block's ±1 px probe. A `PushableBlockSpear` runs `PushableBlockFire.input()`, which reads only its own target, and
only `hit()` writes that. A lean moves nothing. The model's press arm (`levelRun.applyThrust` →
`hitPushable(block, direction)`) did model the slide, and R4's committed spear legs pin it on the game. So the work
is a new MOVE inside the same verb.

### ⛔ The finding: a sword slash does not push a spear block (game-measured)

The brief and `pushables.js` (R4 §8.10) said *"a SWORD slash pushes a spear block too"*. That was read off
`genericHit`'s branch ORDER, and the order is right: the Spear arm is tested before the Fire arm, and it returns
before `moveTypes`. But the arm's vector is not the facing:

```as3
// Player.as:1123
(e as PushableBlockSpear).hit(new Point(int(spearDirection % 2 == 0) * (spearDirection - 1),
                                        int(spearDirection % 2 == 1) * (2 - spearDirection)), t, true);
// Player.as:812-822 — set spearing: spearDirection = -1 FIRST, then = direction only on a thrust that starts
// Player.as:919-922 — slash(): spearDirection = direction ONLY if hasGhostSword
```

During a plain sword slash `spearDirection` is -1. In AS3 `-1 % 2` is -1, so `p` is (0, 0), and the relative arm sets
`tile` to the block's OWN centre: the hit lands and the block stays. Every R4 recording pressed with the SPEAR
(`probe-seedling-l65.mjs`: `equips: [{t: 0, slot: 1}]`), so the sword half had never been witnessed.

**New instrument `probe-seedling-pushblock-weapon.mjs`** (box-locked; game + model, `--model-only`). It runs R4's L65
probe stance: walk W into the block's face, one press facing W, walk W again.

| arm | game Δx | model Δx (before) | model Δx (after) |
|---|---|---|---|
| sword | **0.00** (stop 194.05 → 194.05) | 15.95 ⛔ | **0.00** (after-x Δ 0.000 px) |
| spear | 15.95 (194.05 → 178.10) | 15.95 | 15.95 (0.000 px) |

**The change (D1, `94ce2be`).** `pushables.spearDirectionFor(weapon, direction)` returns the facing for `spear` and
`ghostsword`, and -1 for `sword`. `hitPushableByWeapon` gives the p = (0, 0) arm for -1. `levelRun`'s
PushableBlockSpear arm calls it with the thrust's weapon. Behind **`PUSH_SPEAR_DIRECTION` (ON)**;
`SEEDLING_PUSH_SPEAR_DIRECTION=0` restores the old reading. (A ghost swing is refused on this arm anyway:
`GHOST_PRESS_ARMS.PushableBlockSpear` is `refused`.)

**Byte-inertia of the switch.** All **266** committed tapes give byte-identical model observation streams with it
ON and OFF (`runTape` over the atlas, md5 per tape, 266 same / 0 moved / 0 errored). The producer `--check` digests
are in the AFTER identity block below.

**Witness.** `pushblock-l65-sword-press` (81 obs) was recorded on p4f; the model reproduces it exactly. The solver
witness `pushblock-l65-reach-l68` pins it a second way (M1, below).

---

## D2 — the strategy (PASS)

**`'solid:pushableblockspear': 'shove'`** was added beside the two pushable rows, with no reorder and no reword.
The resolver and the move:

- **`resolveSpearPushStrategy`.** The spear is required: `hasSpear` and a spear slot. Without it the resolution is
  `held: false` and the executor refuses BY NAME ("the run holds NO SPEAR … ⇒ the Spear is the work order"), not
  "No strategy row exists". It runs `deriveBlockRoute` with the `clear-path` goal and guard (i)'s hypothesis set,
  exactly as `deriveShove` does.
- **`deriveBlockRoute`'s `pressMoves`**, selected when the ROUTED block is a `PushableBlockSpear`, so a walk block's
  records cannot reach it. Each move is one thrust, one tile. The destination is checked by the same instruments as
  a lean (off-map, `blockSinksOn`, `blockBlockedAt`). The stance is from `spearPressStance`:
  - one or two cells behind the block on its axis. `Player.spear()` has no distance or line gate, and the 32x5 rect
    reaches two tiles across pits;
  - the rect must cover the block from every point within ±3 px of the aim;
  - the rect may reach no other non-inert responder (`auditPress` against the route state's own block positions);
  - a `LightPole` is admitted in a second pass, with off-centre aims of ±4 px. L65's pole stands in the block's own
    rows between it and every east stance, and R4's committed thrust swept it too. The stray is recorded on the step
    (`alsoReaches`).

  The player stays at the stance (`verifyRoute` and the search's state transition both say so). Cost, flood
  filtering, lazy verification and bounds are the search's own.
- **`execSpearPress`** (in `execRoute`'s `press` branch):
  1. settle the walk's coast;
  2. `ctx.equip` the spear's slot if another is up;
  3. one tick of the facing key;
  4. wait out a freeze;
  5. re-check the facing and the rect at the LIVE position;
  6. press `primary` once;
  7. wait until the block is settled on `to` (or removed, for a sink), bounded at 56 ticks: 32 glide + 11 fade +
     slack;
  8. select the old slot again.

  Every miss is a `SolverRefusal` naming the check.
- The trace's rejected rows name the lean and the sword and spell the route (`describeRoute`'s `thrust` row).

**Measured.** From a staged L65 (128,16) with the spear, the search alone re-derives R4's three pushes. It crosses to
L68 in 541 t with 0 hits (`spearPush.test.js`). From (185,80) it is one thrust E, 233 t. L63's thrust is E → (8,6)
with `destroys`. For step 137 the search picks the one-order W sink over N,N (orders before destroys: the search's
existing law, and R4's choice).

**What the JS arc must wire.** No contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration` and
`createRunForStaging` are untouched), and there is no new `SolverRefusal.obstacle.kind`. Two things are new in a
solve's output:
- a `shove` record may now be `{verb: 'press', weapon: 'spear', slot, restoredSlot, pressTick, …}`;
- a solve's `equips` now carries the spear selection and its restore, as `burn`'s already does. The wasm walk tape
  must replay `equips`, which it already does for `burn`.

---

## D3 — witnesses + census (PASS)

### Game witnesses (p4f, headless, port 9580; model = game exactly)

`plan-seedling-pushblock-witness.mjs [--check]` authors them (the survey's staging, written out).
`check-seedling-bot-differential --record --only=…` recorded them ("ALL CHECKS PASSED (recording mode)"), and the
check mode passes ("live game matches the committed oracle stream", exit 0):

| tape | what | obs | game vs model |
|---|---|---|---|
| `pushblock-l65-reach-l68` | step 146's room: W, N across the pit, W into the pit (the block sinks), walk onto `teleporter@184,64` | 348 | exact, 1 transition, hits 0 |
| `pushblock-l65-reach-l63` | step 148: one thrust E, the walk up the west column to `teleporter@128,0` | 229 | exact, 1 transition, hits 0 |
| `pushblock-l65-sword-press` | D1's control (authored): a sword slash leaves the block | 81 | exact |

**What a witness covers.** The observation stream is the player. The block's glide is witnessed through the walk
that crosses the cells it vacates: the N thrust's stance (168,168) is reached through (10,8), which the W thrust
emptied, and both crossings run through the sink cell's corridor. A glide timed wrong by a tick would stall the walk
against a Solid that the game has already moved.

**⛔ Why the solver witnesses do not boot exactly as the survey does: the DarkTrap LIGHT arm is game-refuted in
L65.** The first recording used the survey's own staging and its own solve:
- **Step 146's walk** (boot (128,16)) lights `lightpole@…` to kill `darktrap@144,144` at t48–51. The game does NOT
  kill it: *"darktrap@144,144 (65:1) still SET — the model removed a body the game did not"*. The player takes 2
  hits (dy 1.88 at t54), plus 200 ticks of unmodelled freeze and a `receiveInput` false window.
- **Step 148's walk** matched the game through its push (t32–72, the glide included). It left the game at **t137
  (dx -1.88)**, three ticks after its own light-arm thrust at t134. There the game DID write the tag.

Both tapes and their game recordings are in `seedling-fidelity-pushblock-evidence/`:
`lightarm-refuted-l65-step146.{tape,game}.json` and `-step148`. **This is handed over to the light arm's owner**
(STATICLADDER D2's `execLightArm` / `deriveLightPole`); it is not this slice's region. The committed witnesses
stage `darktrap@144,144` cleared (`{level: 65, tag: 1}`). Step 146's witness boots in the block's own pocket at
(192,128), R4's first stance. From the L63 arrival with the trap cleared, the walk meets `bob@208,80`, and the
`bait` stance walk stalls against Body Wall (400 ticks, 396 grazes): BULB/encounters' region.

### Mutants (predicted first; copy + restore in the scratch worktree at the slice head)

| mutant | predicted | measured |
|---|---|---|
| M1 `spearDirectionFor` returns the facing for a sword (the old reading) | `pushables` 2 red (the spearDirection row, the sword row); tapeRunner `pushblock-l65-sword-press` red | ✔ those 3 **plus `pushblock-l65-reach-l68`** (4 red). The solver's own walk swings the sword (dash presses between thrusts) with the block in the rect. D1 is load-bearing for the solver's walks, not only for a deliberate slash. My prediction missed it |
| M2 `SPEAR_PUSH_TOLERATED` emptied | spearPush's three-thrust row red (no stance for the W sink); the rest green | ✔ 1 red / 5 green |
| M3 the executor skips selecting the spear (the sword presses) | spearPush's three L65 solve rows red; the L63 row green (it refuses before the push) | ✔ 3 red / 3 green |
| M4 stances only one cell behind (no reach 2) | the three-thrust row red (the N thrust across the pit has no stance); step 148's single thrust green | ✔ 1 red / 5 green |

### The survey rows this moves (before = CI run 38075646127; after = local at the slice head)

`survey-seedling-route.mjs --through=end --route=full --only=<25 steps>`: every step in L59–L68 plus every step
whose refusal names a pushable.

| step | level | before (CI) | after (local) |
|---|---|---|---|
| **146** | L65 | REFUSED VERB-MISSING (`solid:rock`; block on the frontier) | **SOLVED 541 t** (3 thrusts; its walk includes the refuted light-arm leg, see D3) |
| **148** | L65 | REFUSED VERB-MISSING (`pixelmask:opentree`) | **SOLVED 233 t** (1 thrust; the same caveat) |
| 137 | L67 | REFUSED VERB-MISSING | REFUSED LADDER: the push resolves; the boss key's tile is in `arrowtrap@48,48`'s armed lane |
| 145 | L63 | REFUSED VERB-MISSING | REFUSED unclassified: the DarkTrap light arm's stance settled 1 px off (`lightpole@64,88`) |
| 180 | L63 | REFUSED VERB-MISSING | REFUSED unclassified: the same as 145 |
| 149 | L63 | REFUSED VERB-MISSING | REFUSED VERB-APPLY: the room is sealed from that boot (recon). The brief's "a strategy should solve it" does not hold |
| 61, 82, 113, 147, 150, 181 | L40/L62/L68/L61 | REFUSED | REFUSED, the same family |
| 110, 112, 115, 116, 118, 136, 138, 142, 144, 152, 177, 179, 183 | L59/L61/L62 | SOLVED | SOLVED, **the same ticks** (150, 284, 290, 303, 150, 143, 131, 150, 296, 150, 150, 296, 150) |

**Dispatches for the planner to confirm** (on this branch):

```
gh workflow run seedling-survey.yml --ref claude/seedling-pushblock-spear-j5tn1h \
  -f through=end -f route=full -f only=137,145,146,148,149,180 -f base_run=38075646127
gh workflow run seedling-divergence-sweep.yml --ref claude/seedling-pushblock-spear-j5tn1h \
  -f producer=solver -f mode=inv -f ids=503,507,511,515,523,526,529,531,533,534,538,539,543,544,548,549,553,554,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,583,584,585,586,587,588,590,591,592
```

(Leg ids are at this head's leg derivation, `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`,
841 legs. Their keys are stable across SHAs and are in the sweep's own plan.)

### The sweep's legs

- **No sweep leg needs a push.** The 50 legs that touch L63/L65/L67 are walks within one region. Sweep-3 (solver CI
  38010249317, run at `e8112a3072`) has 35 done and 15 failed. **All 15 failures are DarkTrap/turret
  danger-ladder refusals**; none names a block.
- **The pushable legs the brief names (L4, L16) are walk-family blocks.** `shove`'s lean path is unchanged
  (`shoveWeighParity`, `blockRoute` and `procgenWeigh` are green AFTER).
- **This slice can move a sweep leg in one way:** a walk whose sword swing reaches a spear block. The old model
  pushed the block and the game does not (M1). Such a leg moves TOWARD the game.

**Local sweep (solver producer, inv mode, p4f, port 9580, one page per leg)** over the 7 legs that walk a block's
room (`probe-seedling-divergence-sweep.mjs --legs=<7> --mode=inv --producer=solver --page-legs=1`):

| leg | room | sweep-3 | now |
|---|---|---|---|
| 591 | L67 → L59 | done, 0 divs | done, 0 divs |
| 560, 561 | L63 → L61 | done, 0 divs | done, 0 divs |
| 562 | L63 → L62 | done, 0 divs | done, 0 divs |
| 563 | L63 → L62 | failed (DarkTrap ladder) | failed, the same refusal |
| 587 | L65 → L63 | done, 0 divs | done, 0 divs |
| 588 | L65 → L68 | done, 0 divs | done, 0 divs |

No leg moves.

---

## AFTER

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9580 bash scripts/procgen/identity-block.sh .` at `30b973c` | log md5 `d2de6929ccf24c4633f3b87b2cb0604b`. Every value equals W0 (maze, acceptance, pairs c3/c6/c4, ENEMY, guard, AREA, killgate s2/s5/s9, pre/post-sword) |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, all exit 0: **= W0** |
| generated set | in the block | `OK` |
| reference | in the block | 2 DIFFER: the docs index's word counts, which counted this report while it was untracked. Regenerated with the report: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH` |
| surface / constants / entities / profile | the four `--check`s | **GREEN 236** (+2 doors, classified) · **PASS 5,492** (`--write`; +4) · PASS 528 · PASS 138 (both) |
| roster | `generate-tape-index.mjs --check` | **269** (`OK`) |
| bounded vitest AFTER | the 53 + `spearPush` at `30b973c` | **54 files / 2,643 tests, all green**, md5 `89aa36488e6d9aaa0ae8bd97598e6541`; tapeRunner **595** rows (+6: two rows per witness), `8bc3b58496b5ff0701ade2a4b2ab096d` |
| plan `--check` | `plan-seedling-pushblock-witness.mjs --check` | all checks green (the three tapes byte-identical) |
| differential | `check-seedling-bot-differential --only=<the three>` | ALL CHECKS PASSED, exit 0 |
| CI `JavaScript Unit Tests` | `ci-vitest-summary.mjs 30b973c` (run 38086066976) | 19,479 tests: 19,477 passed, **2 failed**. (1) `procgenDocs/generated.test` — the docs index, off by one word (a doc cell I edited after regenerating); regenerated in the report's commit. (2) `rosterCategories.test:175` "the LIVE row …" 206 ≠ 209 — the composite roster row in standing-values, which only `standing-values --write` (the planner's) moves. This is residue by rule, as in BURN and BOBSOLDIER2: **a row to BANK**. The slow battery printed no summary (the tool says "step cancelled?"; not investigated) |
| not run | | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used. No rebase, no force-push |

---

## Deltas

- `OBSTACLE_STRATEGIES` +1 row (`solid:pushableblockspear`).
- `solverView` +2 doors (`auditPress`, `PRESS_ARM_POLICY`); the surface is classified.
- `entityBlocks`: `pushesSettled.solverReads` += `solverBot` (its doc table too).
- `R8_ENEMY_BRIDGE.exposedAdded` +2 (`pushblock-l65-reach-l63` [63, 65], `pushblock-l65-reach-l68` [65]; 83 → 85).
  The synthetic bridged set gains L65.
- Roster 266 → 269.
- Pins: `tapeEnvelope` 269; `observationTolerance` 269 + swapped 269; `dialogueAutoAdvance` 269 / 268.
- New instruments: `probe-seedling-pushblock-weapon.mjs` (box-locked), `plan-seedling-pushblock-witness.mjs`.
- New tests: `spearPush.test.js` (6); `pushables.test.js` +5.

## What the brief got wrong (measured)

1. **"A SWORD slash pushes a spear block too"** (`pushables.js`, R4 §8.10, the brief). The game does not move the
   block on a sword slash: `spearDirection` is -1 (D1).
2. **"→ `shove` if the executor fits"**: it does not. The existing executor is a lean, and a spear block ignores
   leans. The verb fits; the move is new (`press`).
3. **Step 149 is not a push room.** From its boot (128,288) the L61 door is sealed in every block state.
4. **Step 148 is the same room's push**, as the brief suspected. The frontier named the pixel-mask tree only because
   the block had no row; with the row, the block sorts first and one thrust E solves it.
5. **"Confirm against the game where the model has not been witnessed: L65's three, L63's one, L67's one"**: R4's
   tapes had already witnessed every spear push (all with the spear). What had never been witnessed was the sword.

## Residue / hand-overs

- **DarkTrap light arm (STATICLADDER's region)** — refuted on the game in L65 (two tapes plus recordings in the
  evidence directory). It also refuses in L63 (steps 145/180: the stance settles at (37.08,92.86), not (36,92), and
  the rect misses the pole's core). **It is now the wall in front of 145, 146, 148 and 180.** The survey's SOLVED
  146/148 are model solves whose light leg the game refutes.
- **Arrow trap at the L67 boss key (step 137)**: `arrowtrap@48,48` is ARMED in the survey's state, and the key's
  tile is in its lane. R4's walk collected it (no trap then). The ladder's region.
- **`bob@208,80` bait stalls in L65** when the DarkTrap is cleared (the stance walk grazes Body Wall for 400 ticks):
  BULB/encounters.
- **Survey family:** 145/180 classify as "unclassified" (a light-arm stance refusal). A `surveyFamily.FAMILY_RULES`
  row for the light arm is the light arm's owner's to add.
- **Not modelled, named:** the spear's three hit tests (`SPEAR_HIT_TICKS_UNMODELLED`). A pushable refuses while
  `v.length > 0`, so it is inert for this verb.
- The executor selects the old slot after every thrust and re-selects the spear for the next one (two equips per
  thrust). That is correct; keeping the spear up between consecutive thrusts would cost fewer ticks.

## Byte-inertia

- D1's switch: 266/266 committed model streams identical ON vs OFF.
- No committed tape and no producer `--check` digest moves (AFTER identity block).
- D2 adds a row that only the three spear-block rooms can select. No committed tape enters a spear-block room with
  the solver, and the solved survey steps in L59–L68 keep their exact ticks.

## Rows to BANK

- the three witness tapes and their game recordings;
- the composite roster row (`rosterCategories`): mechanic 206 → 209;
- `PUSH_SPEAR_DIRECTION` ON;
- `R8_ENEMY_BRIDGE` 85;
- roster 269;
- the AFTER identity values below;
- tapeRunner rows (AFTER).
