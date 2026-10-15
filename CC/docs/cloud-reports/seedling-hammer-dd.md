# Seedling hammer-phase DD — a press kill whose target died on the walk (DWELL-DONE)

| | |
|---|---|
| Slice | `seedling-hammer-dd` (Opus, cloud), planner `seedling-hammer-phase-planning` |
| ⚖ | the user, 2026-10-14: *"DWELL-DONE + strike census"* — this is DWELL-DONE, one switch, OFF; the flip is the user's |
| Start | `c137aef8a9` (`origin/main`, the RE harvest: `REFUGE_ETA_CUT` is in `pressKillCost.js`) |
| Branch | `claude/seedling-hammer-dd-x5tft8` (the harness's designated branch; the brief's local name was `seedling-hammer-dd`) |
| Head | the commit carrying this report. D1 code: `492069d`, `3a24fbd` (the ledger fold), `0ee62ac` (the ledger-index window). D2 + D3 evidence and records: `20c97ff` |
| Verdicts | **W0 PASS · D1 PASS** (the switch is OFF; 7 gate rows; 6 mutants, each red; the game agrees at the last frame of every tick) **· D2 PASS, STOP at the movers**: nothing moves at the defaults or under the lapse, and the only movers are the two repro cases, re-recorded nowhere **· D3 PASS** |

**The one thing to know first.** CW's repro 2 is **not** a separate chaser arm. CW's 414 throw is
`… -> kill (bob@736,800) by press: the dwell's condition … ALREADY TRUE`. That is the kill rung's own chaser arm
inside `solveSegmentUnder`, the seam DD edits. The kill-lock's chaser loop (`execKillByChaser`, fidelity's) already
skips such a body (`killedOnApproach`). So the DD guard is the shape fidelity asked about, as it stands: with the switch
ON, CW's override no longer throws and refuses by name at the chest's guard. No edit to fidelity's code is needed.

---

## W0 — the base, and the reproduction (PASS)

### The banks at `c137aef8a9`

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine); `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9584 bash scripts/procgen/identity-block.sh .` (venv) | non-`#` md5 **`77080c2e`** (= RE's): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH (`evidence/w0/identity-w0.txt`) |
| six `--check`s | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| tapeRunner pairs | `status\tfullName` sorted, from the bounded run's JSON | **611**, `75a3c41f0c91f6e71953e82d8259dc60` |
| surface / constants / entities / profile | each `--check` | GREEN **291** · PASS **5,851** · PASS **558** · PASS **138** (`evidence/w0/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 34 files: every non-slow test file naming `runDwell`, `execKillByPress`, `KILL_ARM_POLICY` or `GHOST_KILL_RUNG`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*`, `tapeRunner` (`evidence/w0/vitest-files.txt`; `hammerEscapeGenerated.slow` left to the slow tier) | **1546 / 1546** |

### Repro 1, word for word (fidelity CEREMONYSHOVE's D3 STOP)

`SEEDLING_CEREMONY_SHOVE` is **not on main**: `claude/seedling-ceremony-shove-mtarz5` (`7f808c6`) is not an ancestor
of the base. Repro 1 therefore ran on a **scratch merge** of that branch onto the base. Code merged cleanly; four
doc/generated files conflicted, and their side was taken (scratch only).
`SEEDLING_STRIKE_IFRAME_LAPSE=1 SEEDLING_CEREMONY_SHOVE=1`, `view-solve` of `step-50-boot.json`, goals
`collect:64,64;exit:224,160`:

- **Refusal:** *"solverBot(c1) reach-exit (224,160)->L32 -> keylock stance (bosslock@224,208) -> kill
  (bobsoldier@48,80) by press: the dwell's condition (bobsoldier@48,80 has left the world — … the stance (72,88) …)
  is ALREADY TRUE before a tick is spent, so waiting for it proves nothing."* It is raised at **t192**, player at
  (72.65, 88.43); msg md5 `e74d9427`.
- **The walk** to the stance begins at **t168** (the press ledger's view; the hook below).
- **The removal** (`evidence/repro/repro1-dd0.json`, `TIMELINE` / `PRESSES`):
  - hits 0 → 1 at t63 and 1 → 2 at t111, both from earlier walks;
  - the **killing strike**: a sword press **pressed t169, fired t170**, direction 3, `killed: true` (hits 3), one of
    the stance walk's own armed presses;
  - the body leaves `strikeBodies` (dying) at **t171** and the run's `chasers` at **t182**.

### The same shape at the defaults (found here, used as the committed gate)

A grid of boots on step 50's own staging (`evidence/grid/`, `tools/grid.mjs`), goals collect + exit, lapse OFF, found
two boots where the shape occurs **with no fidelity switch**:

| boot | OFF | ON |
|---|---|---|
| (32,112) | REFUSED **t174** on `kill (bobsoldier@48,80) by press`, already true (msg `a5bc4ff3`); the walk began t135, the killing press t169/t170, direction 0 | SOLVED **381**, keys `6e7f3095`, 0 hits |
| (96,176) | REFUSED **t165**, the same (msg `8c8334cf`) | SOLVED **375**, keys `62b33074`, 0 hits |

No combination of the kill arm's neighbouring switches (`KILL_STANCE_AS_FORECAST`, `SWORD_GATE_TIMED`,
`KILL_STANCE_TARGET_RESCAN`, `KEYLOCK_WAIT_PRICED`, the lapse) reproduces it at step 50's own boot (176,48)
(`evidence/grid/combos.txt`, 32 rows, 0 gone-at-dwell).

### The census: press-kill dwells that start with the target gone

There is a read-only hook at the seam (`press-arm-dwell-start`: target, gone, the press-ledger kill) and in
`runDwell`'s already-true branch, scratch only (`evidence/scratch-diffs/census-hooks.diff`). Each workload ran
**once, with the switch ON**. That run's path is the OFF path up to the first gone-at-dwell start, so a workload
with 0 such starts is OFF's census and also proves ON == OFF for it.

| workload | arm dwells | **gone at start** |
|---|---|---|
| the identity block's solver producers (r8-battery, d2-chain, l18, tail, r9-l3, r9-campaign) + ENEMY census | 2: ENEMY census `lavarunner@64,64` (t26); `r9-solve-12` `puncher@416,256` (t1658) | **0** |
| L18 sweep (`sweep-seedling-l18-residues --json`, 45 residues) | 0 | **0** |
| C2's L18 ghost staging (`ghost-sweep.mjs`, 45) | 0 | **0** |
| `r9-campaign --check` (in the block) | 1 (the `r9-solve-12` row above) | **0** |
| the L40 table (G1's `d1-leg.mjs`, legs 376–415 × sword/ghost, the page's delivered set from `probe-seedling-divergence-sweep --mode=inv --ids=400 --dump`) | 4 (legs 378/381, `puncher@816,128`, t133) | **0** |
| survey step 50, staging (176,48): defaults / lapse ON | 1 (t145, alive) / 0 | **0** |

**0 at the defaults, as the brief expected.** The only gone-at-dwell starts this slice found are the two repros, plus
the two synthetic boots above.

## D1 — the switch, OFF (PASS)

**`solverBot.PRESS_KILL_DONE_ON_WALK`**, OFF:
- opt-in: `SEEDLING_PRESS_KILL_DONE_ON_WALK=1`, or `withPressKillDoneOnWalk(enabled, fn)` (`withSwitch`'s shape,
  restores on a throw);
- `PRESS_KILL_DONE_ON_WALK_DEFAULT = false`;
- a pure helper, `killedOnWalk(run, id, from)`.

**The anchor**, for the union at the second harvest: function `solveSegmentUnder`, the kill rung's chaser arm, between
the stance walk (`what` `${what} -> kill (${hunted.id}) stance`) and the `runDwell` whose `what` is
`` `${what} -> kill (${hunted.id}) by press` ``. DD's hunk is exactly:
- `walkFrom` (the press ledger's length, read only ON) before the walk;
- the `walkKill` test and its early `records.push … return { escalations }` after it.

Nothing else in `solveSegmentUnder` moved. LAPSECOST (`claude/seedling-lapse-cost-xtr3hu`, `fb737bf`) is **not on
main**; its NARROW rung sits between KILL and DETOUR, after this arm's `return`.

**ON:** the arm skips the dwell only when **both** of these hold at the dwell's start:
- the target has left `strikeBodies`;
- the press ledger holds a press whose hit on the target says `killed: true`, among the rows **appended since the
  walk began** (the ledger's index) and **pressed on the run's level**.

The record is `{goal, strategy: 'kill', arm: 'chaser', target, stance, clears, kind: 'dwell', ticks: 0, bound, why,
killedOnWalk: {pressedAt, firedAt, weapon, direction}}`. The ladder reads it like any finished dwell: it returns
`{ escalations }` and AVOID is re-asked. Any other "already true" falls through to `runDwell` and stays its refusal;
`runDwell` is untouched.

**Why the window is an index, measured.** The first cut used a tick window (`fired > walk-start tick`). The L40
census then showed the hazard: on legs 378/381 an arm whose walk began at t0 saw a `killed` ghost-sword press on
`puncher@816,128` fired at **t104**, yet that body was **still in `strikeBodies` at t133**. Whatever the mechanism, a
tick window held a kill that was not this body's death on this walk. The ledger index cannot hold one. The level
match covers a body id repeated on another level.

`solverView.js` was **not** touched. The door re-exports *simulation* symbols into the solver family. This switch is
the solver's own, so it lives in `solverBot.js` beside the kill arm's other switches (`KILL_STANCE_AS_FORECAST`,
`KEYLOCK_WAIT_PRICED`). `pressKillCost.js` was not touched either.

**The surface census caught one thing:** `run.presses` is folded behind `run.ledger('presses')` for a family file
(RED fold at `492069d`, fixed in `3a24fbd`). The rows are the same, and so is the solve.

### Gate — `hammerPressKillDoneOnWalk.test.js` (7 rows; each solve row has an explicit 120 s timeout)

1. ships OFF (`enabled` and `_DEFAULT` false);
2. `withPressKillDoneOnWalk` restores, on a throw too;
3. `killedOnWalk` reads only the walk's rows:
   - the ledger index, not a tick (a later-tick kill appended before the walk → `null`);
   - the run's level (the same id on another level → `null`);
   - `killed`, not `landed` (a landed non-kill before or after the kill is not it);
4. **OFF at (32,112):** refuses at **t174**, `-> kill (bobsoldier@48,80) by press … ALREADY TRUE`, 0 hits (the BEFORE);
5. **ON at (32,112):** past the dwell:
   - SOLVED, 381 t, on L32, 0 hits;
   - the record is `{arm: 'chaser', kind: 'dwell', ticks: 0}` with `killedOnWalk = {pressedAt 169, firedAt 170, weapon
     'sword', direction 0}`;
   - the staged tape equals the committed witness;
6. **ON at step 50's own staging (176,48), the body alive at the stance:** the dwell runs (`kind: 'dwell'`, `ticks > 0`,
   no `killedOnWalk`), and the solve equals OFF byte for byte (460 t);
7. **the game witness** (below): the game's level, player, player hits and BobSoldier rows `[x, y, hits]` at the last
   frame of every sampled tick equal the model's replay; the game ends `{tick 381, level 32, hits 0}`.

**Mutants** (copy → edit → gate → restore, md5 checked; `evidence/mutants/*.diff`, `*.txt`):

| mutant | red row |
|---|---|
| M1 skip when the target is still alive (`killedOnWalk ?? {forced}`) | 6 (the alive staging), in ~180 s |
| M2 never skip (`walkKill = null`) | 5 |
| M3 skip on "gone" without the ledger | 5 |
| M4 `landed` for `killed` | 3 |
| M5 a tick window (`fired > from`) | 3 |
| M6 any level | 3 |

⚠ M1 at first **hung**. The arm returns to the ladder without spending a tick, re-enters itself, and loops; a
synchronous loop is one no vitest timeout can interrupt. The solve helper (`walkKillSolve`) therefore passes a
`shouldStop` that stops after **16** entries of the `kill-chaser` site. Measured: these solves enter it **once**
(`tools/sites.mjs`), so the cap cannot touch a real solve. M1 now goes red in ~3 minutes instead of hanging.

### Game-witnessed (wasm p4f, headless logic-only)

**Witness `hammer-dd-l30-walkkill`** (`fixtures/hammer-dd-walkkill-witness/`, not the roster;
`scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs`: author, `--check` (5 PASS), `--samples`):
- the plan: step 50's staging booted at (32,112), the ON plan, 381 t;
- the game run: `probe-seedling-chaser-mobiles.mjs --class=BobSoldier --file=<tape> --player-hits --frames=<file>`,
  compacted to `<NAME>.game.json` (377 samples);
- **the game equals the model at the last frame of every tick: 377 compared, 0 differ.** The BobSoldier takes hits at
  t49 / t138 / t171 in both; 0 player hits; the game finishes at **t381 on L32** (`evidence/witness/dd-cmp.txt`).

**Repro 1's ON plan** (step 50 under the lapse and the shove, 395 t; `evidence/witness/step50-shove-on.tape.json`),
replayed on the game against the **scratch merge's** model: **388 ticks compared, 0 differ**; the game finishes at
**t395 on L32, 0 hits** (`evidence/witness/step50-cmp.txt`, frames `step50-shove-on.frames.json.gz`). This one is
evidence only: its model needs `ceremonyShove`, which is not on main.

⚠ **A pickup ceremony's frozen frames share one tick number.** `probe-seedling-chaser-mobiles.mjs` keeps the **first**
frame per tick. At the Torchpickup the game shows **5 frames carrying t135**: the first 2 still hold t134's player
(71.570, 65.507), and the last 3 hold the model's t135 (71.570, 66.120). So the probe prints FAIL (*"shifts that
fit every player x: []"*, a BobSoldier |Δ| 0.648 at t135, or at t168 on repro 1 just after the ceremony's release).
That FAIL is a sampling artifact, not a parting: every other sample, and the last frame of t135, are the model's to
the bit. The probe's new `--frames=<file>` writes every polled frame so a witness can read the last one.

## D2 — ON, measured (PASS; STOP at the movers, nothing re-recorded)

Switch ON (`SEEDLING_PRESS_KILL_DONE_ON_WALK=1`), on the census worktree (base + DD's code + the read-only hooks; its
`killedOnWalk` was the tick-window cut, but it never decided anywhere: 0 gone-at-dwell starts):

| row | W0 (OFF) | DD ON | DD ON + lapse ON (`SEEDLING_STRIKE_IFRAME_LAPSE=1`) |
|---|---|---|---|
| identity block, every value row | `77080c2e` | **= W0** (`evidence/d2/identity-on.txt`) | ENEMY `afdc6d1a` → `36b59445`; r9-campaign `712f0ead` → `dce96321` (exit 1); the rest = W0 |
| …the same two rows, lapse ON and **DD OFF** | | | ENEMY `36b59445`, campaign `dce96321`: **identical**, so these are the lapse's movers, not DD's |
| `r9-campaign --check` | `712f0ead`, `r9-solve-16` 688 t | **`712f0ead`**, also at the final head `0ee62ac` (`evidence/d3/campaign-on-final.txt`): `r9-solve-16` L16 → L18 688 t, 0 hits, tape + trace byte-identical | `r9-solve-16` 655 t (the lapse's) |
| ENEMY census | `afdc6d1a` | = | the lapse's `36b59445` |
| L18 sweep (45) | RE `864ab175` | **`864ab175`** | `864ab175` |
| C2's L18 ghost staging (45) | RE `1ca7eed5` | **`1ca7eed5`** | `1ca7eed5` |
| L40 table, 80 runs | (0 gone-at-dwell ⇒ = OFF) | 58 solved · 18 refused · 4 threw; the rows BW banked are equal: 378 `c5ff5e3c`, 381 `c1be8451`, 384 859 t `1d700d96`, 396 494 t `8bc59cfa`, 400 270 t `3adc7396` (`evidence/l40/on-table.json`) | not run (see the residue) |
| survey step 50, its own staging | 460 t `1e6a1eaf` | **460 t `1e6a1eaf`** | 413 t `09fe6280` = DD OFF |
| bounded vitest set | 1546 / 1546 | the D3 AFTER run below (the switch's own rows run ON inside `with…`) | — |

The reference row reads "4 DIFFER" on the census worktree (registry / capabilities / two markdown regions). That
worktree's submodules are symlinks; the committed head reads ALL MATCH. It is not DD's.

**The movers.** There are exactly two, and they are the cases DD exists for:
1. **step 50 under lapse + shove** (scratch merge): REFUSED t192 (msg `e74d9427`) → **SOLVED 395**, keys `87ef16f8`,
   0 hits, `killedOnWalk {169, 170, sword, 3}`. Re-run at the final code: the same.
2. **CW's 414 page leg under its scratch chooser** (`CW_JOINT=1`, CW's `d1-scratch-chooser.diff`): THREW t1469 → **REFUSED
   t1469** on `bobsoldier@880,832` (keys `f1acdb64`, msg `932b8418`, 0 hits); `killedOnWalk {1431, 1432, ghostsword, 3}`.

Neither is a committed row. **Nothing is re-recorded.**

**Divergence-sweep keys for the planner.** With the switch OFF (the default) no page leg can move: the page has no
`process.env`, and nothing wires the switch to a URL parameter. If the user flips it, the legs where an arm dwell
can start gone are the L40 chest-side legs under a joint chooser (not on main). On today's main the L40 census found
**0**. Worth one confirmation run after a flip:
`seedling-divergence-sweep.yml` with `mode=inv`, `producer=solver`, `shards=1`, `ids=376-415` (or empty for the full
sweep), compared with the latest baseline by key.

### The shape for fidelity (CW's 414, D1.3)

**Yes, and it needs no mirror.** CW's throw is in the same seam: `solveSegmentUnder`'s chaser arm, `what` `apitem
(880,816) contact -> kill (bob@736,800) by press`.
- **The walk:** to `bob@736,800`'s stance, begun **t1379**.
- **The kill:** a **ghost-sword** press pressed t1431, fired t1432, direction 3, `killed: true`.
- **The dwell:** starts at **t1469** with the body gone (`evidence/cw/cen-414-dd*.jsonl`).

With DD ON the run continues past it: the ladder re-plans from t1469 and refuses by name at the chest's guard,
**`bobsoldier@880,832`** (*"the combat ladder is EXHAUSTED … chaser:bobsoldier@880,832 (the sword …)"*). That is
the same (c) every other CW leg ends on, with 0 hits. `execKillByChaser` (the kill-lock's loop) already does the
same with `killedOnApproach`. The scratch evidence is `evidence/cw/final-p414-ghost-dd{0,1}.json` on the final code
(the DD diff is `evidence/scratch-diffs/dd-final-vs-base.diff` with CW's own chooser diff). **No code of
fidelity's was edited.**

## D3 — records (PASS)

- `seedling-bot-log.md`: `### Seedling hammer-phase DD — a press kill whose target died on the walk`.
- `seedling-bot.md`: the as-built paragraph after G1's kill-rung paragraph.
- surface `--write` (counts only; no new symbol to classify) → **GREEN 291**. Constants: no new literal in the
  census's scope (`--check` PASS **5,851**, so `--profile-rows` / `--write` were not needed). Entities 558, profile
  138, roster **277** (unchanged: the witness is not a roster tape).
- reference: `generate-procgen-reference.mjs`, then `--check` → **ALL 7 + 5 MATCH** (instruments: the new plan script,
  and its two citations; docs index word counts). `scripts/quicklaunch/generate-docs-index.mjs`: current (173 docs).
- `check-procgen-help.mjs`: both of this slice's scripts PASS (help and import). The run lists 26 FAILs, all other
  files' import/help side effects (e.g. a probe that dials port 8000). They are not this slice's and were not
  measured at the base. The gated `checkProcgenHelp.test.js` passes.
- **bounded vitest AFTER**: 44 files (the W0 set + `hammerPressKillDoneOnWalk` + `boxLock`, `seedlingConstantsCensus`,
  `procgenDocs/{generated,docLinks,docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`,
  `checkProcgenHelp`):
  - **1824 / 1827**, with 3 reds, all stale docs: the docs were edited mid-run, before the reference was
    regenerated;
  - after regenerating, those files re-run **150 / 150** (`evidence/d3/vitest-after*.txt`);
  - tapeRunner **611 `75a3c41f`** (= W0).

## Deltas (base → head)

- **Code:**
  - `solverBot.js`: `PRESS_KILL_DONE_ON_WALK`, `PRESS_KILL_DONE_ON_WALK_DEFAULT`, `withPressKillDoneOnWalk`,
    `killedOnWalk`, and the seam's hunk;
  - `probe-seedling-chaser-mobiles.mjs`: `--frames`.
- **New:**
  - `hammerPressKillDoneOnWalk.test.js` (7 rows);
  - `scripts/procgen/plan-seedling-hammer-dd-walkkill.mjs`;
  - `fixtures/hammer-dd-walkkill-witness/hammer-dd-l30-walkkill.{tape,game}.json`.
- **Generated:** `seedling-solver-surface.json` (counts), `instruments.js`, `docsIndex.js`, `architecture.md`,
  `README.md`.
- **Docs:** `seedling-bot.md`, `seedling-bot-log.md`.
- **Unchanged:**
  - `runDwell` / `botDriverV2.js`, `solverView.js`, `pressKillCost.js`;
  - every fidelity-owned function, `deriveStrike` / `minTicksBetween` (SC's);
  - no AS3, wasm, gitlink or rules edit;
  - no committed tape or producer output moved.

## What the brief got wrong (measured)

1. **"The CHASER arm (`runDwell` after the walk to `bob@736,800`'s stance) … is FIDELITY's … do not edit it."** CW's
   dwell is the kill rung's arm in `solveSegmentUnder`: the same `-> kill (<id>) by press` `what`, and the same
   `runDwell` under the `⛔ runDwell, NOT runHold` comment. It is not `deriveKillByChaser` / `execKillByChaser`. So
   the two repros are one seam, and DD's guard already covers CW's case.
2. **"`execKillByPress` reaches `runDwell`"** (CEREMONYSHOVE's words, carried into the brief). Step 50's refusal comes
   from the same inline chaser arm, not from `execKillByPress` (the Spinner press loop), which does not dwell on
   `strikeBodies`.
3. **"wired through `solverView.js`."** The door carries simulation symbols into the solver family; a solver switch
   defined in `solverBot.js` has no reason to pass through it, and the surface contract would call an unused door
   export RED. The switch lives beside the arm's other switches.
4. **"(the tick the walk removed it, and by which strike)."** The record carries the killing press's press and fire
   ticks. The removal from `strikeBodies` is the next tick (t171 in repro 1) and is not in the record. A tick window
   for "this walk" is also unsound (the L40 measurement above): the window is the ledger index.
5. **"Expect 0 at the defaults."** That holds for every workload named. The shape is still reachable at the defaults:
   step 50's staging booted at (32,112) or (96,176). That is what made a committed gate possible without the shove.

## The residue

- **The L40 table under the lapse with DD** was not run (80 runs, ~1.5 h). DD's census there at the defaults is 0, and
  CW measured the lapse changing no L40 answer, but under lapse + DD this is inferred, not measured.
- **The 4 puncher rows** (legs 378/381, a `killed` press on `puncher@816,128` at t104 with the body alive at t133) were
  not traced to their cause: a respawn, or a run whose press ledger carries an earlier timeline. DD no longer depends
  on it (index window), but `levelRun`'s `killed` flag versus `strikeBodies` membership on that body may deserve
  fidelity's look.
- **The stale-docs reds** in the AFTER run are self-inflicted (the docs were edited mid-run) and were cleared by
  regeneration; there is no CI number yet.
- **CI from the cloud is 403.** For the planner, on ref `claude/seedling-hammer-dd-x5tft8`:
  - the vitest suite number: `node scripts/procgen/ci-vitest-summary.mjs <head> --wait` (⚖ 52);
  - `seedling-survey.yml`, defaults (`through=end`, `route=full`), unmodified: expect the latest base survey row for
    row (the switch is OFF);
  - optional, before a flip: `seedling-survey.yml` with the switch ON. The workflow has no input for it, so this needs
    a one-line scratch commit setting `enabled: true`. Expect no mover at the defaults; step 50 is 460 t;
  - optional, after a flip: `seedling-divergence-sweep.yml`, `mode=inv`, `producer=solver`, `shards=1`, `ids=376-415`.
- **The worktrees** (`wt-cs`, `wt-dd`, `wt-census`, `wt-cw`) live in the scratchpad and hold nothing tracked.
EOF
echo ok