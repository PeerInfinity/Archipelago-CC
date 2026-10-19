# Seedling fidelity WATCHERTALK — the Watcher's `{114,0}`, earned by talking

Slice `seedling-fidelity-watchertalk`, wave 19 (model coverage), planner `seedling-fidelity-planning-9`.

| | |
|---|---|
| Start SHA | `4667f7e353` (= main: DIGEST on main), as briefed |
| Harness branch | `claude/seedling-watcher-talk-gjzf04` (the brief's local name was not used; only the harness branch is pushed) |
| Commits | D2 `f7e26c05` · D3 `5af3cb14` · bot-log `1f296e24` · reference `aad7138c` · this report (the head) |
| Dev server | `serve-nocache.py 9691` (PID 548) over the checkout; a dev worktree `/home/user/wt-dev` (never pushed, submodules symlinked) on 9692 for the recordings |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (switch built, OFF; STOP for the flip) · D3 PASS (game-witnessed, 0 px)** |

## The one thing to know first

**The survey's L114 step never talked to the Watcher. It "solved" by a false `already-clear`.**

The Watcher is typed "Watcher" (`NPCs/Watcher.as:48`), which is in no solids list, so `world.solids` never holds it.
The solver's clear-tag looks for a SOLID at (72,72), finds none, and takes its `already-clear` arm: "the build left it
out, which is the game's own `check()` for a flag the boot's persistence holds cleared". Survey step 210 (CI 39153361080)
is SOLVED in 4 ticks with `earnedClears: []` and an empty `watcherTalks`; the flag was never written. Step 211 opens
the FinalDoor only because the survey's grants stage `{114,0}`.

The sweep's two legs fail one layer earlier: the JS runtime's pre-check (`clearTagVerbOf`) refuses `no-verb` on
`solid:watcher` before the solver is asked. Opened with no verb, the solver "solves" them in **0 ticks**, the same lie.

`watcherTalkVerb` gives the clear-tag the `talk` verb that WATCHER D2 built for the frontier. ON, both legs and step 210
talk, page 20 pages to `doneTalking()`, and write `{114,0}`. The game agrees at 0 px from both arrivals.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-watcher-talk-gjzf04 4667f7e353` | bootstrap `READY`, node v22.22.0 |
| identity block (venv on) | `SEEDLING_PORT=9691 bash scripts/procgen/identity-block.sh .` | log md5 **`738b7ab5921f1df5df66a0277c81df5d`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `3d41b9fb`, all exit 0 |
| reference | in the block | "4 GENERATED MODULE(S)/REGION(S) DIFFER": `registry.js`, `capabilities.js` and two substrate regions. A box artifact (no `frontend/modules/bulletml-dodge` checkout), as SEALDOOR measured; the same at head |
| surface / constants / entities / profile | each `--check` | GREEN **312** · PASS **6,028** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **280** tapes |
| tapeRunner pairs | sorted `status\tfullName` from the BEFORE json | **617**, md5 **`85051859d2feb021925d961e2125458c`** |
| bounded vitest BEFORE | 103 files (below) | **3,492 passed, 0 red** |
| CI baselines | `survey-seedling-shards.mjs --fetch=39153361080`; `gh run download 39153416627 -n divergence-merged` | both fetched. The two L114 legs reproduce in the node bare pass at this base: `no-solver-goal`, `no-verb … solid:watcher` |

The bounded set is the brief's standing list plus every non-slow test naming `refineStrategy`, `clear-tag`,
`CONTACT_FIDELITY_KEYS`, `watcherTalks`, `clearTagVerbOf`, `already-clear`, `watcher@72,72`, the tape index or
`fixtures/tapes` (`rg -al`), plus `watcherL114`, `placedTalk`, `rosterCategories` and `tapeRunner`. AFTER adds
`fidelityWatcherTalk` (104 files).

## D1 — the diagnosis (PASS)

**The two legs** (by KEY; ids 843 / 846 at both the baseline derivation and today's
`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`):

| key | arrival | where it refuses (baseline sweep 39153416627, reproduced in node) |
|---|---|---|
| `level_114 <- in_L113_16_0 -> location:L114 flag 0: watcher@72,72 cleared` | (64,128) | `jsRuntimeSolver.eventSolverGoal` → `clearTagVerbOf('solid:watcher')` → `{verb: null, registered: false}` → "no-verb: no strategy row exists for solid:watcher". `no-solver-goal`; the solver is never asked |
| `level_114 <- in_L113_32_0 -> location:L114 flag 0: watcher@72,72 cleared` | (80,128) | the same |

These were measured with the node bare pass (`seedling-divergence-bare.mjs --dump=<the baseline's delivered-set.json>`).
That is the worker's request path for each leg, staged from the delivered set, with no budget. It needs no captured
request, so no CI dispatch was needed for D1.

**What the survey step does differently.** Step 210 (L114, boot (64,128)) hands the solver the clear-tag directly; it
skips the JS pre-check. The solver's `execClearTag` looks up `world.solids` at (72,72), finds nothing (the Watcher is
`collider: 'none'`, `levelWorld.ENTITY_CLASSES.watcher`), and records `{arm: 'already-clear'}`. A scratch probe of
step 210's boot view (`views/step-210-boot.json`, `twoPassSolve`) shows:
- records: `[{arm: 'already-clear', obstacle: 'watcher@72,72', ledgerAt: null}, {goal: 'reach-exit', to: 113}]`;
- `earnedClears []`, `watcherTalks []`.

**Control (the pre-check opened, no verb).** I applied the `clearTagVerbOf` line to a scratch copy with the switch
guard removed and ran the bare pass with the switch OFF. Both legs come back `solved` with **0 ticks, verbs []**: the
solver's `already-clear` lie, one layer down. The file was restored (md5 `ee2bb9b7…` before and after).

**What the game needs** (`NPCs/Watcher.as`, `NPCs/NPC.as`; WATCHER D1's reading, re-checked):
- **Range:** `FP.distance(x, y, p.x, p.y) <= talkRange` (24, `NPC.as:27`), measured from the NPC's centre (the ctor's
  half-tile, (80,80)). It is a disc and includes its rim.
- **Key press:** none to open. `keyNeeded = !Game.checkPersistence(tag)` (`Watcher.as:46`) is false while the tag is
  set, so `startTalking()` runs on proximity alone. No facing test exists in `NPC.talk()`.
- **The dialogue:** 912 characters, 20 pages. Each page is advanced by a release of X (`keys[6]`), and
  `Game.freezeObjects` is raised from the frame after the start. Pages 9..19 hold out a live `Seed`, and collecting it
  is a soft-lock.
- **The write:** `doneTalking()` → `Game.setPersistence(tag, false)` = `{114,0}`. Walking out of range also ends the
  dialogue through the setter, and also writes.
- `statueTalkRange`'s talk rule is the same `NPC.talk()`, with the Statue's 32 px and a key press. The Watcher keeps
  24 px and needs no key while its tag is set.

The model already steps all of this (`levelRun.stepWatchersNow`, R6 6d; `watcherTalks` built at `levelRun.js:13992`).
The frontier's `talk` verb (WATCHER D2) drives it, and it is game-witnessed (`watcher-l114-talk`, `r6-watcher-talk`).
**The gap is in the solver only: the clear-tag had no way to name the Watcher.**

## D2 — the TALK verb on the clear-tag (PASS; switch OFF, STOP for the flip)

**Change** (`f7e26c05`):
- `CONTACT_FIDELITY.watcherTalkVerb`, default `false`; `SEEDLING_WATCHER_TALK_VERB=0|1`.
- `solverBot.refineStrategy`: `solid:watcher` → `talk` while ON. The shared `OBSTACLE_STRATEGIES` table is untouched,
  so OFF answers "no row", byte for byte.
- `execClearTag`: while ON, where no solid stands and the goal's class is `watcher`, the run's own watcher roster
  (`run.watchers`) binds it. The generic clear-tag path then runs:
  - `resolveTalkStrategy`: a stance 28..48 px from the centre, or the current point if it is already in that band;
  - the walk to the stance;
  - `execTalk`: approach until the dialogue opens, page on the ceremony cadence, settle;
  - `waitForWrite` on the `earnedClears` row;
  - a certification that `run.watcherTalks` holds `doneTalking()` of this id writing this flag.
- A SILENT watcher (`world.silentHazards`) answers by its census reason:
  - its tag cleared at boot → `already-clear`, since the game wrote it already;
  - an empty `text` → `cannot-act`, since the watcher never runs `doneTalking()`, the only writer of its tag.
- No new run state, run field, staging field or `SolverRefusal.obstacle.kind`. The refusals are the clear-tag's
  existing reasons, plus `execTalk`'s existing `proximity-hazard` refusals.
- The surface census `--write` moved site counts only: `run:watchers`, `run:watcherTalks`, `run:world`,
  `world:silentHazards`, `import:CONTACT_FIDELITY`. Still 312 rows. Constants: 6,028, unchanged.

**Measurement (node).**

| case | OFF | ON |
|---|---|---|
| leg `… in_L113_16_0 -> location:L114 flag 0 …` (bare pass, the JS line applied in a scratch copy) | `no-solver-goal`, `no-verb` (= base) | **solved, 398 t, verbs [talk]**, ends in L114 |
| leg `… in_L113_32_0 -> location:L114 flag 0 …` | `no-solver-goal`, `no-verb` | **solved, 398 t, verbs [talk]** |
| the four L114 exit legs (841/842/844/845) | solved 6/32/32/6 | unchanged |
| `fidelityWatcherTalk` from (64,128) / (80,128), `arrivalStaging` | `already-clear`, 0 t, no write | `talk`, paged to DONE (20/20), `{114,0}` in `watcherTalks` and `earnedClears`, at rest |
| `{114,0}` cleared at boot | `already-clear` | `already-clear` ("is cleared"), 0 t |
| L37's textless `watcher@104,264` as a goal | `already-clear` (a false solve) | refused `cannot-act` |

**Mutants** (predicted first; made by copy and restore; `solverBot.js` md5 `bff75fc3…` before and after):

| mutant | predicted | measured |
|---|---|---|
| M1: drop the `refineStrategy` clause | 5 red (the 2 ON talk rows, the talk-then-exit row, the 2 witnesses' key-for-key rows) | **5 red** |
| M2: no watcher binding (`watcher = false && …`) | 7 red (M1's five, plus the boot-cleared row whose `why` must say "is cleared", plus the `cannot-act` row) | **7 red** |
| M3: drop the `watcherTalks` certification | survives: the ledger's `waitForWrite` catches the same failure | **0 red (survived, as predicted)**. It is kept as the brief's named certification; it is a second reading of the same write |

### The movers ON (the licence's list)

| surface | OFF | ON |
|---|---|---|
| route survey, local, all 212 steps (`--through=end --route=full`) | = CI 39153361080 on every step (by step id and by (level, goals, boot)): 165 solved | **one mover: step 210 (L114, boot (64,128)): SOLVED 4 t, earnedClears [] → SOLVED 406 t, earnedClears [`{114,0}`]**. L113 steps 209 (87 t) and 211 (166 t, `{113,0}`) unchanged. Headline unchanged (165/212) |
| sweep legs (node bare pass; ON needs the JS line) | 2 × `no-solver-goal` | **2 × solved by `talk`** (398 t). No other leg can move: only the `flag:L114:0` goal names a watcher. No `producer:walker` row moves (the walker is untouched) |
| committed tapes / tapeRunner | 617 pairs `85051859…` | the 617 unchanged, + 4 new rows (2 witnesses × {differential, stepping face}), all pass: 621 `60ebf92f…`, identical ON |
| six producer `--check`s | = W0 | **= W0 ON** (all six md5-identical, exit 0) |
| identity block | AFTER (OFF) log md5 `738b7ab5…` = W0, byte-identical | not re-run in full ON; no generated or identity room holds a watcher clear-tag, and the six producers are identical ON |

**Bounded vitest AFTER** (104 files):
- **OFF: 3,512 passed, 1 red.** The red is `rosterCategories` "the LIVE row carries one part per derived category"
  (expected 220, got 222). The standing-values roster row's `mechanic` part needs `standing-values --write`, which the
  brief forbids. **Owed by the planner**, as SEALDOOR's was.
- **ON: 3,511 passed, 2 red:** `rosterCategories` (as OFF) and `contactFidelity` "the shipped defaults" (the defaults
  pin, read under the env override). That pin is the flip's to move.
- Nothing else goes red ON: `fidelityWatcher`, `watcherL114`, `placedTalk`, `fidelityClearTag`,
  `jsRuntimeSolverEventGoal`, `solveProgress`, `levelRunStateDigest` and `seedlingSkinRenderer` are all green.

### STOP — the flip

The flip is the user's. It owes:
- the defaults pins: `contactFidelity.test.js` and `fidelityWatcherTalk`'s "ships OFF";
- `clearTagVerbOf` wired by the JS arc **with** the flip (below). Without it, the two sweep legs stay `no-verb` even ON;
  only the survey's step 210 moves.

The flip moves no committed tape, producer or identity row. It moves one survey step (210: a false solve becomes a
true one) and two sweep legs.

## D3 — the game witness (PASS)

`plan-seedling-watchertalk-witness.mjs` (`--check` byte-identical) authors the solver's ON plan for the clear-tag from
each sweep arrival. The staging is `watcher-l114-talk`'s (`r8-solve-11`'s block re-pointed at the arrival). Both were
recorded with `SEEDLING_PORT=9692 check-seedling-bot-differential --record
--only=watchertalk-l114-clear-16,watchertalk-l114-clear-32` (p4f, headless): **ALL CHECKS PASSED**.

| tape | arrival | plan | game |
|---|---|---|---|
| `watchertalk-l114-clear-16` | (64,128) | stance (72,120), dialogue opened t27, closed t380, 20 pages, 384 t | "every Watcher the run talked out wrote its persistence flag — watcher@72,72 -> 114:0 off at tick 380 (cause done, page 20 of 20)"; 385 observations; 20 dead = 20 load residue; the edges dispatched were all seen (primary ×42) |
| `watchertalk-l114-clear-32` | (80,128) | stance (88,120), the same timings | the same line; 385 observations |

**THE MODEL REPRODUCES THE RECORDING IT JUST MADE** on both: 0 px, and the 4 new tapeRunner pairs pass.
`fidelityWatcherTalk.test.js` pins the boot at the leg's arrival, the replay's one DONE talk and its write, and the
plan equal to the solver's ON answer key for key.

## The CI dispatches the planner should run

1. **Sweep A/B** (`seedling-divergence-sweep.yml`). Run it on the FLIP branch, because the legs need the JS line:
   - A: default inputs;
   - B: `contact_fidelity=` today's ON set plus `watcherTalkVerb`.
   - Optionally, `capture_requests` on the two keys above, plus `seam_census=-3..3` on them. The talk has no moving
     body in L114, so I expect no seam sensitivity, but that is not measured.
   - Expected: the two `location:L114 flag 0` legs `failed` (no-verb) → done, with `eventFlag.set` true. Nothing else
     should move beyond run noise.
   - Without the JS line on the branch, B equals A.
2. **Survey ON** (`seedling-survey.yml`, which has no `contact_fidelity` input). Use a flip branch with the default
   `true`, `through=end route=full`, or `-f only=210`. Expected: = 39153361080 on every step except 210 (SOLVED 4 →
   SOLVED 406, `earnedClears ['{114,0}']`).
3. **The witnesses on CI**: the differential's full tier picks up `watchertalk-l114-clear-16/-32`. Expected PASS.

## The JS arc: what it must wire, and the pins

**`jsRuntimeSolver.clearTagVerbOf`, the one line for the FLIP branch** (measured in a scratch copy, then restored):

```diff
@@ -537,6 +537,9 @@ export function clearTagVerbOf(key) {
     // ⛓ fidelity SEALDOOR (`CONTACT_FIDELITY.sealDoorApproach`): the FinalDoor's verb is `approach`, the same answer as
     // `solverBot.refineStrategy` and its `clearTagExecutor`; OFF the table's (none). Carried in fidelity's flip (js-7 OK).
     if (CONTACT_FIDELITY.sealDoorApproach && key === 'solid:finaldoor') verb = 'approach';
+    // ⛓ fidelity WATCHERTALK (`CONTACT_FIDELITY.watcherTalkVerb`): the Watcher's verb is `talk`, the same answer as
+    // `solverBot.refineStrategy` and its clear-tag arm; OFF the table's (none). `talk` is a `STRATEGY_EXECUTORS` row.
+    if (CONTACT_FIDELITY.watcherTalkVerb && key === 'solid:watcher') verb = 'talk';
     const registered = verb !== null && (Object.prototype.hasOwnProperty.call(STRATEGY_EXECUTORS, verb)
         || (verb === 'wand' && WAND_VERB.enabled) || (verb === 'approach' && CONTACT_FIDELITY.sealDoorApproach));
     return { verb, registered };
```

- **`registered` needs no widening.** `talk` is already a `STRATEGY_EXECUTORS` row, and `verb` becomes `talk` only
  under the switch, so OFF it is `{null, false}` byte for byte.
- **Pins:** with the line applied, `jsRuntimeSolverEventGoal.test.js` is 58/58 green, ON and OFF. No pin names
  `solid:watcher`. The "every same-room event maps exactly" row then maps `flag:L114:0` instead of skipping it, and
  passes.
- `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`: no signature or contract change. No
  new staging field, result field or obstacle kind.

## Handed to the hammer arc (solve-progress)

My row adds no new refusal reason: `cannot-act` → `precondition`, `not-written` → `diverged`, `unresolved` →
`exhausted` (existing `CLEAR_TAG_KINDS`). `execTalk`'s existing refusals become reachable through the clear-tag ON.
Measured through `progressKind`:
- all of them classify, except one: **"the dialogue opened with the box at (x,y) on the live Seed the watcher holds out
  on pages 9..19 — collecting it is a soft-lock." → `other`**;
- suggested mapping: `danger` (it is a soft-lock; this is not a `solveProgress.js` edit of mine);
- it is not reached by any measured leg or step (no stance in L114 overlaps the Seed box).

## What the brief got wrong (measured)

1. *"The route survey's L114 watcher-talk step SOLVES through a different path."* It solves through **no** path: the
   clear-tag's `already-clear` arm, 4 ticks, no talk, no write (`watcherTalks []`, `earnedClears []`). The verdict is
   a false positive, not a working alternative route.
2. *"Two L114 legs … refuse with a no-verb clear tag on `solid:watcher`"*: true, but the refusal is the **JS
   pre-check's** (`no-solver-goal`); the solver was never asked. Opened, the solver lied too (0 ticks). Two layers
   needed fixing, not one.
3. *"Write the talk verb … a strategy row + executor"*: the executor and resolver already existed (WATCHER D2,
   game-witnessed on the frontier). What was missing was the clear-tag's BINDING: the Watcher is no solid.
4. D1's *"replay both captured requests"*: no captured request was needed. The node bare pass over the baseline's own
   `delivered-set.json` reproduces both legs exactly.

## Residue

- The cross-room chain is unchanged: talk in L114, then the FinalDoor in L113 (SEALDOOR's residue). The talk now
  writes `{114,0}` on the run; carrying it into the L113 leg is the route/harness's job.
- The bare pass and the witnesses stage the sweep's arrival POINT, not its full AP inventory. The room reads none of
  it (no enemies; the talk needs no item).
- A `seam_census` on the two legs is not measured (it needs a dispatch).
- `rosterCategories` stays red until the standing roster row is re-recorded (planner).
- The reference's substrate regions read "differ" on this box (no `bulletml-dodge`); CI has the submodule.

## Byte-inertia

OFF is byte-identical to the base:
- the identity block log md5 `738b7ab5…` (AFTER = W0), including the six `--check`s;
- tapeRunner's 617 base pairs;
- the survey's 212 steps (= CI);
- the bare pass's six L114 legs;
- censuses: surface site counts only, constants / entities / profile unchanged;
- bounded vitest: the only red is `rosterCategories`, from adding 2 tapes (standing value owed), not from a moved
  behaviour.

## Records

- Bot log: "Seedling fidelity WATCHERTALK", with one trap candidate: *a clear-tag that finds no body is not proof the
  flag is clear* (an NPC has no collider).
- Tape index: 282 tapes. New: `watchertalk-l114-clear-16`, `watchertalk-l114-clear-32`, both with oracle expectations.
  Roster pins re-pinned by name: `tapeEnvelope` 282, `observationTolerance` 282 (and `swapped` 282, measured),
  `dialogueAutoAdvance` 282/281.
- Reference: regenerated at `aad7138c` (instruments + docs index). The 4 "differ" rows are the box's, as at W0, and
  were left as committed.
- No new box-taking instrument (the producer is node-only; recording used the existing differential).

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs aad7138c` (run 39186594664; the report commit adds only this file):
**21,012 passed, 1 failed; slow battery 254/254.** The red is `scripts/procgen/rosterCategories.test.js` "the LIVE row
carries one part per derived category" (expected 220 to be 222): the standing-values `mechanic` part, owed to the
planner (`standing-values --write` is outside this brief).

At `1f296e24` (run 39185628344) CI had 5 reds. Four were mine: `generated.test.js` ×2 (the instruments index had no row
for the new producer; my local reference `--check` ran before the file was tracked) and `docsRender.test.js` ×2 (the
bot-log entry's heading count). `aad7138c` regenerated the instruments index and docs index only, leaving the four
substrate rows this box cannot build. `5af3cb14`'s run was cancelled by the next push, which carries the same code.

## Rows to BANK

- `watcherTalkVerb`: OFF. ON movers = survey step 210 (4 t, no write → 406 t, `{114,0}`), and the two
  `location:L114 flag 0` sweep legs once `clearTagVerbOf` carries the line.
- Witness tapes: `watchertalk-l114-clear-16`, `-32` (oracle, p4f, 0 px).
- tapeRunner pairs: 621 rows, md5 `60ebf92fbb5fe23d05067a83a38887b4` (617 base + 4).
- Roster: 282 tapes; the standing `mechanic` part is owed (222).
- Identity block: `738b7ab5921f1df5df66a0277c81df5d` (unchanged).
