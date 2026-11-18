# seedling-hammer-l98-l99-line-stance — L98/L99: LINE_STANCE without the hits, and the 228 death

## 1. SHAs

| | |
|---|---|
| Start (base) | main `c82f413c87` (TRAIN 112) |
| Branch | `seedling-hammer-l98-l99-line-stance` |
| Code commit | `54143665` (the two switches) |
| Rows commit | `5e59d972` (tests, fixtures, solver-surface census) |
| Evidence commit | `7a26320e` |
| Head | this report's commit (the branch tip) |

Planner follow-ups: none arrived. I followed the brief as written.

## 2. The answer first

**Two new switches, both OFF:** `KILLLOCK_STANDOUT_GUARD` (`SEEDLING_KILLLOCK_STANDOUT_GUARD=1`) and
`DRIVE_DEATH_REFUSED` (`SEEDLING_DRIVE_DEATH_REFUSED=1`). `KILLLOCK_LINE_STANCE` stays OFF by default.

With `KILLLOCK_LINE_STANCE=1` plus both new switches, **both steps solve with 0 hits**:

| step | result | game (p4g) |
|---|---|---|
| 227 | 576 t | 0 hits, 0 px parting |
| 228 | 477 t | 0 hits, 0 px parting |

On the whole `--through=end` survey this arm adds no hit-taking step. It has the same 5 pre-existing hits as OFF, at
steps 24, 202 and 220. So a LINE_STANCE re-flip, together with `KILLLOCK_STANDOUT_GUARD`, would be shippable on this
evidence. That flip is the planner's decision.

**The one thing to know first: the 227 hits are not LINE_STANCE walking through the axe.**
- The line kill ends with the player at (159.1, 71.4), inside `spinningaxe@128,64`'s sweep.
- `execKillByChaser` then **stands** there with no keys: first the corpse fade, then the lock fade.
- Nothing probes that stand-out, and nothing bills what it meets.
- The axe hits land during the stand-out (t358, t381), after the attempt was judged on its kill alone.
- This is a solver gap, not a model miss. The game takes the same two hits on the same ticks, so there is nothing to
  hand to fidelity.

**228's refusal is a death, and the camera band refusal comes 12 ticks after it.**
- The exit walk's ladder picks DODGE: a 1-tick stall for `lavachain@80,64`, with `igneous@10,5` marked partial.
- With fidelity's `partialDodgeReprobe` OFF, the rest of that corridor is walked unprobed.
- The walk takes the chain at t394, t414 and t484. The t484 hit kills.
- The drive walks on from the respawn. At t496 the kept reboot band refuses an on-screen question.

## 3. The reproduction (measured at the base)

- **Acceptance md5** at `c82f413c87`: `391322d681b7aa0229d94b3f6906d024`, which is the expected value.
- **Survey runs:** `--through=end --only=227,228`. Their outputs are in `evidence/repro/only-227-228-*.txt`.

| arm | step 227 | step 228 |
|---|---|---|
| default (LINE OFF) | SOLVED 520 t, 0 h | REFUSED: `lavarunner@176,64` on screen at t496, inside the shake band |
| `SEEDLING_KILLLOCK_LINE_STANCE=1` | SOLVED 483 t, **2 h** | SOLVED 477 t, 0 h |
| `SEEDLING_UNBILLED_DAMAGE_GATE=1` + LINE | REFUSED "UNBILLED DAMAGE … 2 hit(s) … spinningaxe" | SOLVED 477 t |

I traced both steps with uncommitted `console.error` probes in `levelRun` (the `playerHits` push and the band throw)
and in `solverBot` (the line turn and rewind turn verdicts, and the walk's probe and climb). All probes were reverted
before the md5 and before every commit.

**227, LINE ON:**
- At t232 every jellyfish is PINNED from where the player stands, so the line stances run first.
- `jellyfish@56,48` at line stance (184,72) kills. Both jellyfish are dead by t334, with the player at (159.10, 71.45).
- Both hits come from `execKillByChaser`'s post-kill stand loops:
  - t358 from the corpse-fade stand, `solverBot.js` `run.advance(NO)`;
  - t381 from the lock-fade stand.
  - `spinningaxe@128,64` is the source of both.
- OFF's rewound stances (168,56) and (168,88) end the kills at (167.1, 87.4), and that stand-out is clean.

**228, LINE OFF:**
- The death row is `{t:484, source:'lavachain', id:'lavachain@80,64', hits:3}`, preceded by hits at t394 and t414.
- Stack: `walkExit → walkTo → walkToUnder → botDriverV2.drive → advance`.
- The walk's own probe at t238 met `hazard:lavachain@80,64`. The ladder returned DODGE (stall 1 tick, partial
  `igneous@10,5`), and with `partialDodgeReprobe` OFF the remainder was walked unprobed.
- With `SEEDLING_PARTIAL_DODGE_REPROBE=1`, 228 OFF refuses honestly: "the combat ladder is EXHAUSTED … lavachain@80,64".

## 4. Design + change; OFF identity

**`KILLLOCK_STANDOUT_GUARD`: the last kill's stand-out is part of the attempt** (worker thread, `solverBot.js`).
- It runs only inside the arm's REWOUND turns, `killLockChaserRewindTurn` and `killLockLineStanceTurn`: one call
  after each `killLockChaserAttempt` that kills.
- When the kill leaves no live counted body (dying corpses excepted), the guard drives the stand-out on a replay,
  `ctx.rewind.replay(perTick.length)`; the live run is untouched.
- The replay holds no keys until the lock leaves the world or `killLockStandOutBound` runs out. That bound is both
  corpse-fade stands plus the lock's fade, the longest stand-out `execKillByChaser` can drive.
- A hit or a death on the replay throws a `SolverRefusal` naming the source, tick and position. The turn's own catch
  then rewinds and tries the next stance.
- New code: the `KILLLOCK_STANDOUT_GUARD` switch, `withKillLockStandOutGuard`, the instrument
  `KILLLOCK_STANDOUT_GUARD_COUNTS`, `killLockStandOutBound` and `killLockStandOutRefusal`.

**`DRIVE_DEATH_REFUSED`: a death on the segment's own drive refuses on its tick** (worker thread).
- One call in `solveSegment`'s `viewOf` advance, the single path every executor's live tick goes through. Forks and
  replays are not views, so they are not affected.
- When a `playerDeaths` row lands, `refuseDriveDeath` throws a `SolverRefusal` with `obstacle: {kind:'death', id}`,
  naming the killing source and the last 3 hits.
- A rewinding caller tries its next candidate; any other caller's refusal becomes the segment's.
- New code: the switch, `withDriveDeathRefused`, the instrument `DRIVE_DEATH_REFUSED_COUNTS`, and `refuseDriveDeath`.

Both names are in `SOLVER_ENV_NAMES`, which is sorted; `solverEnvChannel.test.js` is green. Neither switch is read on
the page's main thread. No level, coordinate or Seedling constant appears in the logic. No fidelity file is edited.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives
`391322d681b7aa0229d94b3f6906d024` both at the base and at `54143665`.

## 5. Rows, census of the surface, bounded vitest

New `hammerL98L99.test.js`:
- the switches ship OFF;
- `SEEDLING_*=1` reads;
- the channel carries both names;
- the wrappers restore.

New `hammerL98L99.train.test.js` (train tier): survey steps 227 and 228 from the survey's own 0-tick boot views
(`fixtures/hammer-l98-l99/`), on the survey's model rooms. Every plan's hits are read off a replay on a fresh run.
- **227, OFF:** 520 t, 0 h. The control: the same perTick with both new switches ON, and the guard is asked and finds
  the stand-out clear.
- **227, LINE:** 483 t, hits `spinningaxe@128,64@t358`, `@t381`.
- **227, LINE + guard:** 576 t, 0 h. The refused row's reason starts `spinningaxe@128,64 hits the player at run t358`.
- **228, OFF:** the band refusal at t496. With `DRIVE_DEATH_REFUSED` it becomes the death refusal at t484, with
  `obstacle {kind:'death', id:'lavachain@80,64'}`.
- **228, LINE:** 477 t, 0 h. The control: the same perTick with both new switches ON.

The train file has no row in `scripts/test/train-shard-costs.json`. It runs on the lightest shard, with the job's
warning. It took 38 s locally under load.

| run (bounded by path) | files | tests |
|---|---|---|
| `npx vitest run` hammerL98L99, hammerNewLocks, hammerL53Killlock, jsRuntimeSolverRockLockMapper | 4 | 43 passed |
| `--config vitest.train.config.js` hammerL98L99.train, hammerNewLocks.train, hammerL53Killlock.train | 3 | 8 passed |
| `npx vitest run` solverEnvChannel | 1 | 11 passed |

Regenerated:
- `census-seedling-solver-surface --write`, then `--check` is GREEN (375 rows; only site counts moved).
- `generate-procgen-reference` and `generate-docs-index` changed nothing.
- No docs edit, so no procgenDocs pins are owed.

The suite number is CI's at the pushed SHA (ruling 52). I did not dispatch a train-tier run. The packet owes one at
this tip: `-f train_only=true`.

## 6. Game witness (p4g)

- Tool: `evidence/tools/witness-l98-l99.mjs`. It solves in node, folds the plan with `buildStagedTape`, replays the
  model on both the survey's rooms and the delivered set, then plays the tape on `seedling_bot_ap_p4g`.
- The game run was headless logic-only, on the delivered set (`l25Sets`), on a dev server I started and then killed by
  PID.
- Log: `evidence/witness-game.log`. Tapes: `evidence/witness/`.

| arm | ticks | sampled | model hits (survey / delivered) | game hits | parting |
|---|---|---|---|---|---|
| 227 OFF | 520 | 517 | none / none | none | none |
| 227 LINE | 483 | 483 | axe t358, t381 / same | **358, 381** (483 is the crossing's `hits` reset) | none |
| **227 LINE + STANDOUT** | 576 | 571 | none / none | **none** → L99 | none |
| 228 LINE | 477 | 468 | none / none | none → L100 | none |
| 228 LINE + both | 477 | 474 | none / none | none → L100 | none |

The game confirms the 227 axe hits. The model does contain the axe's contact, so this is not a hand-over.

## 7. Census

**Full route survey `--through=end`, four arms at head** (`evidence/survey/`, `compare.txt`, `*.json.gz`):

| arm | solved | hits in solved rows |
|---|---|---|
| off | 223/250 | 5 (steps 24, 202, 220) |
| LINE | 224/250 | 7 (+227) |
| **LINE + STANDOUT + DEATH** | **224/250** | **5 (24, 202, 220)** |
| STANDOUT + DEATH | 223/250 | 5 |

Every mover, by step and goal:

**Step 78, L53 → L54 teleporter:** LINE only; 655 t becomes 627 t, both hitless. The new switches do not touch it.

**Steps 189 and 217, L71, the lavarunner kill-lock:** LINE only; both stay refused, and the refusal lists 5 waited-on
bodies instead of 1. The new switches do not touch them.

**Step 227, L98, Chest then stairs:** LINE gives 483 t / 2 h; LINE + guards gives 576 t / 0 h.

**Step 228, L99 stairs:** LINE solves it (477 t). DEATH alone turns the band refusal into "DIED t484 lavachain@80,64".

**Step 167, L43, the Wand:** DEATH; still refused. The old wording was "re-planned corridor failed too"; it now reads
"DIED t237 (bosstotem@152,168)". `AWAKE_BOSS_FIRST` already owns this room.

**Step 192, L75 → L71:** DEATH; still refused. The old wording was "danger map forbids … lavachain@96,32"; it now reads
"DIED t193 (lava@112,112; after spinningaxe@80,144 at t160)". This is the same unprobed-partial family as 228.

**No solved step changes, and no hitless step gains a hit, under either new switch.** Step 160 (L69, the Lights death
edge) is unchanged in every arm.

**Seed-1 divergence legs, by KEY:**
- Tool: `evidence/tools/census-killlock-legs.py` over `seedling-divergence-legs.mjs --out` (923 legs). Output:
  `evidence/census/census-killlock-legs.txt`.
- `KILLLOCK_STANDOUT_GUARD` can only move legs where the kill-lock chaser arm runs. Those are the legs in the 9
  levels with a `tset == -1` lock or rocklock: **65 of 923 legs**. The census file lists every key.

| level | lock | legs |
|---|---|---|
| L5 | `lock@48,112` | 5 |
| L18 | `lock@144,112` | 3 |
| L26 | `rocklock@112,208` | 7 |
| L53 | `lock@144,208` | 8 |
| L60 | `lock@128,80` | 3 |
| L71 | `lock@112,192` | 29 |
| L78 | `lock@32,32` | 2 |
| L98 | `lock@112,112` | 6 |
| L99 | `lock@80,96` | 2 |

- It moves a leg only when the arm's last kill leaves the player where the stand-out takes a hit. That makes the leg
  refuse or re-pick, and never hit-taking.
- I did not measure the guard ON on the NEW-LOCKS captured leg requests (223, 286, 289, 910, 911). Their pins ran
  with the guard at its default, OFF.
- `DRIVE_DEATH_REFUSED` can move any leg whose live drive dies. Such a leg was never hitless, so the move is from
  "solved with a death" or "refused by another name" to "refused naming the death".
- I ran no page sweep. A divergence-sweep dispatch with both switches is the planner's.

## 8. What the brief got wrong (measured)

- "LINE_STANCE ON walks through the axe": **no.** The line attempt's walk and dwell are hitless. The hits come in the
  post-kill stand-out that `execKillByChaser` drives after the turn returns.
- "A CANDIDATE PLAN DIES at ≈t484": mostly right, but it is not a candidate the solver chose among. It is the single
  exit walk (`walkExit`), after the ladder's DODGE rung returned a partial stall and the rest of the corridor was walked
  unprobed (fidelity's `partialDodgeReprobe` OFF).
- "Measure whether 228 then SOLVES hitless with LINE_STANCE OFF": it does not. With LINE OFF, 228 refuses honestly
  under `DRIVE_DEATH_REFUSED` or under `partialDodgeReprobe`. It solves (477 t, 0 h) only with LINE ON. That was
  already true at the base, so 228's ON row needed no fix.

## 9. Residue / hand-overs

- **Fidelity (hand-over, rows):** `CONTACT_FIDELITY.partialDodgeReprobe` (OFF) is the root of 228 OFF's death.
  - 228 OFF with it ON refuses "combat ladder EXHAUSTED … `lavachain@80,64`" instead of dying.
  - Survey step 192 (L75) dies the same way under `DRIVE_DEATH_REFUSED`: `lava@112,112` after `spinningaxe@80,144`.
  - Its flip is fidelity's decision.
- **Fidelity (noted only):** the shake-band refusal's wording, which they are already rewording. Not touched here.
- **Planner:**
  1. a LINE_STANCE re-flip together with `KILLLOCK_STANDOUT_GUARD`;
  2. whether to flip `DRIVE_DEATH_REFUSED` (it only rewords refusals on the route);
  3. a page divergence-sweep dispatch;
  4. a train-tier dispatch at this tip;
  5. a shard-cost row for `hammerL98L99.train.test.js`.
- **Merge:** the `solverBot.js` hunks are local (new functions after `killLockLineStanceTurn` and after
  `unbilledDamageOf`, two call lines in the turns, two lines in `viewOf`), plus two names in `solverEnvChannel.js`.
- **Not run, per the rules:** unfiltered vitest, `pytest`, `standing-values --write`, any whole-game walk.
