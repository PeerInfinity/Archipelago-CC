# Seedling HAMMER-PHASE — slice G1: the kill rung's ghost-sword gate

Slice `seedling-hammer-g1` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-12), on D's
finding: *"Small slice, new switch"*. One gate, behind one new switch, **OFF**, and OFF is byte-inert:
`ghostSpinnerPress.GHOST_KILL_RUNG` (`SEEDLING_GHOST_KILL_RUNG=1`, `withGhostKillRung(enabled, fn)`).

| | |
|---|---|
| Start SHA | **`11e113e2fe`** (= `origin/main` at the fetch = D's harvest; `hammerGhostWall.test.js` present) |
| Head | the commit carrying this report. D1 `1152b34`, D2 `d8c95f0`, D4 `eaa556a`, then this report |
| Branch | `claude/ghost-sword-kill-gate-gxyluh` (the harness names it; the brief's `seedling-hammer-g1`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9578` (`SEEDLING_PORT=9578`), PID 909, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS** (the game plays the ghost kill tick for tick; the only parting is the known removal fencepost) **· D3 PASS, STOP at the movers** (two ghost legs move; nothing committed) **· D4 PASS** |

## The one thing to know first

**With the switch ON the kill rung reaches the ghost's press kill, and the game agrees. But on today's main no L40
leg turns into a solve.**
- **The gate opens.** ON, staging A's ghost kills `spinner@880,848` at t2114 and `spinner@816,848` at t2182. Every
  press is the ghost's. The game plays that walk with the player stream exact (2196/2196) and every Spinner row equal
  (worst |Δ| 0).
- **What moves.** Only legs 397 and 414 with the ghost. They now get past the gate, kill the spinner (t1292 / t1366 on
  the page's staging), and refuse later on the chasers. They stay REFUSED.
- **Why 378 / 381 do not move.** Wave 13's bomb lobber now refuses both legs at `buttonroom`'s hold, with either
  weapon. The ghost no longer reaches the rung there, so D's "378 SOLVED 1641 t" is not reproducible today.
- **A page leg is not a tape witness.** The divergence legs stage the AP-delivered levels: `apitem` where the atlas
  has a `chest` or `totempart`, and a spinner bounces off the chest. A tape boots the atlas. So leg 397's clean kill
  (t1292, no hit) becomes t2323 with three hits on the atlas. The witness is therefore staging A, P1's committed boot
  view.

## W0 — the base, and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/ghost-sword-kill-gate-gxyluh origin/main` | `11e113e2fe` (≥ D's merge); `frontend/modules/seedlingDemo/hammerGhostWall.test.js` present |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| where | a detached worktree of the base in the scratchpad (submodules and `node_modules` symlinked), so the long base runs did not see this slice's edits | — |
| identity block | `SEEDLING_PORT=9578 bash scripts/procgen/identity-block.sh <base worktree>` (venv) | every row = D's AFTER (`identity-after-off.txt`) **but `acceptance batch` `76602ae8` → `933c14f7`** (it moved on main between D's base `5b92583a` and this one; HEAD reads the same). The reference row read `4 … DIFFER` in the worktree: an artefact of the symlinked submodules (registry / capabilities / the two substrate regions); the main tree at the same code reads ALL 7 + 5 MATCH. Non-`#` md5 `a1565a68` with that row (`evidence/identity-w0.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0 (= D) |
| ENEMY census | the block | `afdc6d1a` (= D) |
| tapeRunner pairs | `vitest --reporter=json` over `tapeRunner.test.js`; `status\tfullName`, sorted, `\n`-joined | **611**, `75a3c41f0c91f6e71953e82d8259dc60` (= D) |
| surface / constants / entities / profile | each `--check` | GREEN **278** · PASS **5,808** · PASS **558** · PASS **138** (`evidence/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 29 files: every test naming `derivePressKill`, `KILL_ARM_POLICY`, `ghostSpinnerPress`, `GHOST_SPINNER_PRESS`, `deriveStrike` or `execKillByPress` (`rg -a`), plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*` and `tapeRunner` (the slow tier's `hammerEscapeGenerated.slow` excluded) | **1498 / 1498** |

### The gate's refusal, reproduced by name

`seedling-divergence-legs.mjs` lists 843 legs and the ids are D's. The page's delivered set came from
`probe-seedling-divergence-sweep.mjs --host=http://localhost:9578 --mode=inv --ids=400 --dump=…`.

On 397, 414 and staging A with the ghost, the kill line reads, word for word: *"kill: spinner@880,848 is a live
Spinner whose removal the run OBSERVES (…), but the run's `primary` slot fires `ghostsword` — the kill this rung
derives is a SWORD press (`KILL_ARM_POLICY.Spinner`). The sword is a SUB-ORDER the macro layer owes."*

Wave 13 adds a `forced-hit:` rung line after it (*"no forced hit is proven from (488.0,904.0) …"*). Staging A's ghost
refusal message md5 `5d852d21` equals D's.

### D1's L40 table today (`d1-leg.mjs`, cap 15 min, 3 at a time; `evidence/w0-table.md`, `w0-legs.jsonl`)

What wave 13 moved since D's table:

| leg | D (at `5b92583a`) | today, sword | today, ghost |
|---|---|---|---|
| 378 | sword SOLVED 1540 · ghost REFUSED at the gate | **REFUSED (danger: `bombpusher@112,128`)** | **REFUSED (danger: `bombpusher@112,128`)**, before the rung |
| 381 | sword SOLVED 1592 · ghost REFUSED at the gate | **REFUSED (`bombpusher@112,128`)** | **REFUSED (`bombpusher@112,128`)** |
| 397 | sword REFUSED (`bob@736,752`) · ghost at the gate | the same (892 s; D 762 s) | the same: the gate, 11 s |
| 414 | sword REFUSED (`bob@736,752`) · ghost at the gate | the same | the same: the gate, 15 s |
| staging A (`view-solve.mjs`) | sword REFUSED 3113, keys `af47d35d` · ghost at the gate t0 | REFUSED 3113, keys `af47d35d`. Message md5 `b02571c9` → `6c8a19c6` (the refusal text gained wave 13's rung lines; the walk is the same) | REFUSED t0 at the gate, msg `5d852d21` (= D) |

Every other L40 leg keeps D's verdict and ticks: the 376–415 rows not named above, and 398 / 415 throwing on the
event-flag goal as before. 378 / 381 now refuse **by name at the bomb** with either weapon, as the brief said they
would.

## D1 — the switch (PASS; `1152b34`)

- `ghostSpinnerPress.js` gains:
  - `GHOST_KILL_RUNG` (OFF; `SEEDLING_GHOST_KILL_RUNG=1` opts a process in), `GHOST_KILL_RUNG_DEFAULT = false`;
  - `withGhostKillRung(enabled, fn)`, in the shape of `withGhostSpinnerPress`;
  - `killRungPresses(weapon)` = `weapon === 'sword' || (GHOST_KILL_RUNG.enabled && spinnerStrikePress(weapon) !==
    SWORD_SPINNER_PRESS)`.
- `solverBot.js`: the lock-less spinner arm computes `rungPresses = killRungPresses(weapon)` once. It asks
  `derivePressKill` when `rungPresses` is true, and keeps the rung's refusal sentence when it is false. Two sites, one
  import.
- `solverView.js`: one door line.
- **OFF is byte-inert by construction.** `killRungPresses` is then `weapon === 'sword'`, the expression it replaces.
- **ON:**
  - it admits exactly what `derivePressKill` admits, so a ghost primary needs `GHOST_SPINNER_PRESS` ON (its default)
    as well;
  - a ghost sword without the sword is refused inside `derivePressKill` by `ghostSwingRefusal`'s words;
  - every other primary (null, fire, spear, …) keeps the rung's named refusal, unchanged.
- **Not touched** (other gates, all outside this region): the same `weapon !== 'sword'` shape in the rock-break rung
  (`solverBot.js` ~6881), `killStaticBySword` (~12577) and the rope-silencer rung (~18809).

## D2 — the game witness (PASS; `d8c95f0`)

**Choosing the staging** (ON, `solveSegment`, `dashMode: 'all'`; `evidence/g1-solve.mjs`, the `cand-*.json` rows):

| candidate | level source | the ghost press kill | hits | ends |
|---|---|---|---|---|
| leg 397's page staging | the AP-delivered set | **t1292** (`spinner@880,848`; landings t512 / t1292, 21.2 / 19.9 px) | 0 | REFUSED 1305, `bob@736,752` |
| leg 414's page staging | the delivered set | t1366 | 0 | REFUSED 1379, `bob@736,800` |
| **staging A** (P1's boot view) | **the atlas** | **t2114**, and `spinner@816,848` at t2182 | 3 (a death at t1216) | REFUSED 2195, `bob@736,752` |
| C1's `crusherStaging` at (40,480,896) | the atlas | t2114 (= staging A, keys `b762a2e6`) | 3 | REFUSED 2195 |
| 397's staging, mapped to the tape schema | the atlas | t2323 | 3 | REFUSED 2336, `bob@736,800` |
| 414's staging, mapped | the atlas | t5659 | 14 | REFUSED 5672 |

- **The page legs are not tape witnesses.** Replaying 397's own keys on the atlas parts at t603: the player takes a
  `spinner@816,848` hammer hit that the solve never took. On the delivered set the same replay is exact.
- **The cause is the levels, not the model.** L40's delivered record differs from the atlas only in its four item
  entities (`apitem` for `chest@880,816`, two `totempart`s and a `bosskey`; `evidence/l40diff.mjs`). A spinner reflects
  off the chest.
- **Two smaller differences.** The page's staging also carries `rng.seed 0` / `fp 987286273` against the r8-solve-11
  base's `418414780` / `1763053598`, and a seam the tape schema refuses (`items.hitsMax`; `evidence/rt.mjs` maps it).
- **The choice.** The shortest game-replayable ghost kill is staging A's: P1's committed fixture, a room the bomb
  (`bombpusher@112,128`) does not reach.

**`hammer-g1-l40-ghostkill`** (`scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs`, author + `--check`; tape and
samples in `fixtures/hammer-g1-ghostkill-witness/`, not the roster). The staging is P1's boot view with
`seam.items.hasGhostSword` and `hasSword`. The walk is `solveSegment`'s executed prefix with the switch ON: 2195 keys,
and the tape's `tick_count` adds `buildStagedTape`'s one trailing empty tick.

The script asserts:
- OFF refuses at t0 with the gate's words;
- ON gets past the gate;
- every press and landing is the ghost's;
- both bodies are killed and leave `spinnerBodies`.

The model's account:

| t | event |
|---|---|
| 501 | ghost landing on `spinner@880,848`, hits 2, from 19.54 px |
| 972 / 1184 / 1216 | `bob@736,752` hits the player; the third kills, and the player respawns at (488,904) |
| 2078 | ghost landing, hits 2, 20.40 px (the i-frame had healed the body) |
| **2114** | **ghost landing, hits 4, 23.79 px: the kill**; body removed at 2127 |
| 2149 / **2182** | `spinner@816,848`: hits 2 (20.38 px), then **4 (11.58 px), the kill**; removed at 2195 |

**The game** (p4f, headless logic-only):

| question | the game | |
|---|---|---|
| player stream (`probe-seedling-dash-window.mjs --tape-file`) | **= the model's, 2196 / 2196 observations**, the death and respawn included; transitions none | ✓ |
| `Bot.slashTests` | = the model's cumulative count at **2186 / 2186** sampled ticks | ✓ |
| Spinner rows (`probe-seedling-u9-shield-mobiles.mjs --tape-file --class=Spinner`; all five L40 bodies) | position, velocity, `hits`, `hits_timer` = the model's at **10,836 comparisons, worst \|Δ\| 0**; the clock fits at shift [0] | ✓ |
| the kills | each target reaches `hits` 4 at the model's tick | ✓ |
| removal | the game drops `spinner@880,848` at sample t2126 (model t2127) and `spinner@816,848` at t2194 (model t2195) | ⚠ the known fencepost (game 11 samples, model 12; C2's residue 1). Fidelity's; noted, not fixed |

Nothing parts that is not the press, so there is no hand-over: the chaser's hits, the death and the respawn are all
the model's.

**The gate is `hammerGhostKillRung.test.js`** (6 rows):
1. the switch and its wrapper;
2. the `killRungPresses` table, with `GHOST_SPINNER_PRESS` ON and OFF;
3. the walk's landings, kills and hits;
4. the game's rows of the two killed bodies (4,293, compacted), each equal to the model at its observation;
5. OFF: staging A refuses at t0 by name (1 s, 120 s timeout);
6. ON: the solve's executed prefix equals the tape, key for key (2–5 min, 900 s timeout).

| mutant (worktree; the file restored by md5 `eb4d8aec`) | predicted | measured |
|---|---|---|
| M1: `killRungPresses` ignores the switch (sword only) | the table row and the ON row red | **2 red** (those) |
| M2: OFF admits the ghost (`GHOST_KILL_RUNG.enabled` dropped) | the table row and the OFF row red | **2 red** (those) |

## D3 — measured ON, STOP at the movers

Command: every row with `SEEDLING_GHOST_KILL_RUNG=1` exported to the process (and so to the identity block's
children). OFF is W0's measurement at the base. OFF at the head equals the base by construction; the identity block
AFTER below confirms it.

| row | OFF | ON | moves? |
|---|---|---|---|
| L40 table, 40 legs × 2 (`d1-leg.mjs`; `evidence/on-table.md`) | W0 | **two rows move**: 397-ghost and 414-ghost (below). The 78 others are byte-equal (keys md5 for a solve, message md5 for a refusal) | **yes: 397-ghost, 414-ghost** |
| staging A, sword | REFUSED 3113, keys `af47d35d`, msg `6c8a19c6` | the same | no |
| staging A, ghost | REFUSED t0 at the gate, msg `5d852d21` | REFUSED 2195 on `bob@736,752`, keys `b762a2e6` (= D's mutant); kills at t2114 / t2182 | **yes** (the witness's workload) |
| identity block | W0 (`evidence/identity-w0.txt`) | every row = W0; the reference row MATCH (ALL 7 + 5); non-`#` md5 `77080c2e` (`identity-on.txt`) | no |
| r9-campaign `--check` | `712f0ead` exit 0 | `712f0ead` exit 0 | no |
| **`r9-solve-16`** (inside the campaign check) | PASS: 0 hits, 0 deaths, ends at the L18 arrival `["688:L18"]`, calm (v 0,0) | **the same three PASS lines** | **no** |
| ENEMY census | `afdc6d1a` | `afdc6d1a` | no |
| L18 sweep (`sweep-seedling-l18-residues.mjs`, 45 residues, the sword) | 45/45, lengths line `1c019765` | every row equal (timing stripped) | no |
| C2's L18 ghost staging (C2's `ghost-sweep.mjs`, 45 residues) | 45/45 (336 t ×43, 390, 340) | **byte-identical** (timing stripped): L18's ghost kill is the kill-lock order's, which C2 already opened | no |
| bounded vitest (W0's 29 + `hammerGhostKillRung`) | 1498 / 1498 (29 files) | **1504 / 1504** (30 files), tapeRunner 611 `75a3c41f` | no |

**The two movers** (the page's own staging, `d1-leg.mjs`: the anytime passes):

| leg | key | OFF (ghost) | ON (ghost) | what the ON solve does (`g1-solve.mjs`, `dashMode: 'all'`) |
|---|---|---|---|---|
| 397 | `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest` | REFUSED at the gate, 11 s, msg `9debad90` | REFUSED (danger: `bob@736,752`), 154 s, msg `de067efc` | ghost landings t512 / **t1292 (kill)**, removed t1305, no hit; then the chaser |
| 414 | `level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest` | REFUSED at the gate, 15 s, msg `9989c459` | REFUSED (danger: `bob@736,800`), 153 s, msg `585ba9b3` | ghost landings t512 / **t1366 (kill)**, removed t1379, no hit; then the chaser |

**Neither is a committed artifact. Nothing was re-recorded. The flip is the user's call.**

**Divergence-sweep keys for the planner** (`seedling-divergence-sweep.yml`, `-f mode=inv -f producer=solver
-f shards=1`):

`-f keys="level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest"`

⚠ The page cannot see the switch. It is env-only (`globalThis.process?.env`), so the page worker runs OFF. On this
branch the sweep should therefore reproduce today's verdicts; it shows the movers only after a flip to a default-ON.
No route leg holds the ghost sword in L40 either (D's D1), so a page row moves only with the ghost granted.

## D4 — records (PASS; `eaa556a`)

- **Logs:**
  - `seedling-bot-log.md` § *Seedling hammer-phase G1 — the kill rung's ghost-sword gate*;
  - `seedling-bot.md`: a paragraph after D's. D's sentence "that gate is the next slice's" now points to it.
- **Surface:** `--write`, then `killRungPresses` classified (`seedling`, `function`). `--check` **GREEN 279** (was
  278).
- **Constants:** `--check` **PASS 5,808**. No numeric literal landed, so no `--profile-rows` and no `--write`.
  Entities 558 and profile 138 PASS.
- **Reference:** regenerated after the docs (the new `plan-` instrument: 428 → 429; the docs index). `--check` ALL 7 +
  5 MATCH. `generate-docs-index.mjs`: current (164 docs).
- **Roster:** no roster tape (the witness sits beside its samples). Roster **277**; no roster-count pin and no
  `rosterCategories` row moves.
- **Bounded vitest AFTER** (switch OFF): **39 files, 1778 / 1778**: the 30 above plus `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface` and `checkProcgenHelp` (the file list: `evidence/vitest-files.txt`). The two rows that run a solve carry explicit timeouts (120 s, 900 s). The witness script's `--check`: all green, the tape byte-identical.
- **Identity block AFTER** (OFF, at `eaa556a`): **byte-identical to ON**, every row, the six producers and the reference (ALL 7 + 5 MATCH) included: non-`#` md5 `77080c2ed34820619273d5d9d6fcdaa9` (`evidence/identity-after-off.txt`).

## Deltas (base → head)

- **New:**
  - `scripts/procgen/plan-seedling-hammer-g1-ghostkill.mjs`;
  - `fixtures/hammer-g1-ghostkill-witness/`: the tape and the game's compacted rows of the two killed bodies;
  - `hammerGhostKillRung.test.js` (6 rows);
  - `CC/docs/cloud-reports/seedling-hammer-g1-evidence/`.
- **Changed:**
  - `ghostSpinnerPress.js`: the switch, its wrapper and `killRungPresses`;
  - `solverBot.js`: the rung's two sites and one import;
  - `solverView.js`: one door line;
  - the surface table, the bot log, `seedling-bot.md`, the generated reference.
- **Untouched:**
  - `strikePolicy.js`, `runLatchedWait` / `runHold`, `createRunForStaging`, `levelWorld.js`, `levelRun.js`,
    `ghostSword.js`;
  - the chaser arm, BAIT, `planSwordDash`, `previewWalk`, `deriveRefuge`, `pressKillCost.js`;
  - `jsRuntime*`, the worker, `flashPanel/*`;
  - no AS3, wasm, gitlink or rules edit;
  - every identity row, producer and committed tape.

| | before | after |
|---|---|---|
| identity block | W0 (`a1565a68` with the worktree's reference row; every other row) | ON `77080c2e` = AFTER-OFF, row for row (reference MATCH) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 | identical, exit 0 (ON and OFF) |
| tapeRunner pairs | 611, `75a3c41f` | 611, `75a3c41f` |
| bounded vitest | 29 files, 1498 / 1498 | 30 files ON 1504 / 1504; 39 files AFTER 1778 / 1778 |
| surface | GREEN 278 | **GREEN 279** |
| constants / entities / profile | 5,808 / 558 / 138 | the same |
| roster | 277 | 277 |

## What the brief got wrong (measured)

1. **"legs 378/381 now refuse BY NAME at `buttonroom@272,208`'s hold, inside the bomb's reach"**: true. The
   consequence is wider than the brief says: the ghost no longer reaches the kill rung there, so 378 / 381 cannot
   measure this gate at all, and D's "378 SOLVED 1641 t (ghost, mutant)" is not reproducible today. Both weapons
   refuse on `bombpusher@112,128`.
2. **"Legs 397 / 414 … Measure which one reaches a ghost press kill … and pick the shortest"**: 397's page staging
   kills soonest (t1292, no hit), but a page leg cannot be the game witness. The legs stage the AP-delivered levels
   and a tape boots the atlas (a chest is Solid to a spinner; an `apitem` is not). On the atlas the same staging
   kills at t2323. The shortest replayable witness is staging A (t2114).
3. **"C1's staging A … the ghost's kill lands before the chaser wall; witness the KILL, not the leg"**: it lands
   before the final chaser wall, but not before the chaser. `bob@736,752` hits three times and kills the player at
   t1216, and the ghost's kill comes after the respawn. The witness plays the death too, and the game agrees.
4. **"D's scratch mutant (3 lines) … at D's base it was inert for the sword"**: still inert, and by construction:
   every sword row of the 40-leg table, staging A's sword, the L18 sweep and the identity block are byte-equal ON.
5. **"`r9-solve-16`"** is not a separate producer. It is a segment of `r9-campaign --check`, which prints three PASS
   lines for it (stated above).

## Residue

1. **⛔ For fidelity: the spinner removal fencepost**, seen again on two ghost kills (game t2126 / t2194, model
   t2127 / t2195). It is C2's residue 1; nothing new. `hammerGhostKillRung.test.js` does not pin it, so a fidelity fix
   will not red it.
2. **For the hammer arc: the chaser is the next wall on every ghost-kill workload in L40.** 397 / 414 / staging A all
   refuse on `bob@736,752` / `bob@736,800` after the kill (the chaser arm is outside this region). Staging A's ghost
   also dies once on the way.
3. **For the planner / JS arc: the page never sees `GHOST_KILL_RUNG`** (env-only, like `GHOST_SEARCH_BUCKETS`). A flip
   to default-ON (`!== '0'`, as `GHOST_SPINNER_PRESS` was flipped) reaches the page worker. A page setting would be
   the JS arc's.
4. **Other `weapon !== 'sword'` gates** in `solverBot.js` (the rock-break rung, `killStaticBySword`, the rope silencer)
   are untouched. None of them is a spinner press, and each is a separate question.
5. **The divergence-leg driver keeps 1,200 chars of a refusal** (D's `d1-leg.mjs`). The gate's sentence sits past
   that cut on these legs, so the table marks it by the obstacle (`spinner@880,848`). The words were read with
   `--full` on 397 / 414 (W0 above).
6. **CI for the planner** (dispatch returns 403 from the cloud):
   - `JavaScript Unit Tests` on `claude/ghost-sword-kill-gate-gxyluh` at the head
     (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`). The new ON row runs a full solve (2–5 min, 900 s
     timeout).
   - Optional: `seedling-divergence-sweep.yml` with the two keys above (no change expected while the switch is OFF).
7. **Standing rows for fidelity to bank: none.** No roster tape, so `rosterCategories` does not move.
8. **Tree hygiene.** The two scratch worktrees (base, mutant) were removed by name. The identity block left no
   tracked dirt (`git status` clean but for this slice's paths).

## Rows to BANK

- `GHOST_KILL_RUNG` OFF; surface **279**; constants **5,808**; entities 558; profile 138; roster **277**; tapeRunner
  pairs **611** `75a3c41f`; identity block = W0 row for row (`acceptance batch 933c14f7` is main's, not this slice's).
- If the user flips `GHOST_KILL_RUNG`: nothing committed moves (D3). Re-pin `hammerGhostKillRung.test.js`'s default
  row only, and expect 397 / 414 with the ghost (page staging) to refuse on the chasers instead of at the gate.
