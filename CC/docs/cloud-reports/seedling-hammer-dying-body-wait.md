# Seedling hammer-phase DYING-BODY-WAIT — a wait for a dying body, and why leg 871's gap is not one

Slice `seedling-hammer-dying-body-wait` (Opus, cloud). Planner `seedling-hammer-phase-planning-6`. ⚖ Approved by the user
2026-11-12 ("Leg 871 dying-body wait"). Landing needs the user's SHA-bound OK through the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `fe98f37f2207594e648cefb90f007a16e453c0eb` (origin/main) |
| Code commit | `69e19d15` (switch, both sites, rows, fixture, producers, doc paragraph) |
| Head | the report commit on top of `69e19d15` (this file, evidence) |
| Branch | `claude/seedling-dying-body-wait-416vuh` |

No planner follow-up arrived while I worked, so I followed the brief alone.

## 2. The answer first

**The brief's premise is wrong. Leg 871's lost solve is not a dying body.** At the shipped wall, under the train row's
set, the first branch's spinner press refuses `HAMMER_SAFETY` at t724 ("no step out"). `OPP_PRESS_FALLBACK` then
rewinds to t0 and redoes the spinner kill with OPP off. In that redo `bob@736,752` is never hit. The ladder that ends
EXHAUSTED runs at clock **826**, and it names `bob@736,752` **alive**: 0 hits, not dying, 37.6 px from the player. The
"dying at t700, gone at t735" body belongs to the branch the fallback threw away. The fidelity report's harness read
that discarded run, so it saw the dying body. **No dying-body wait can move this leg**, at either site, and I measured
that (§ 3, § 5).

What I built anyway, OFF: **`DYING_BODY_WAIT`** (`SEEDLING_DYING_BODY_WAIT=1`, `withDyingBodyWait`; in
`SOLVER_ENV_NAMES`). It applies only where **every** danger source is a chaser the live run has `dying` and not yet
`destroy`ed. It reads the "die"'s end from the run's own `chaserForecast()`, stands that many ticks on the live run
(rewinding on a hit), and asks again. It is asked at two sites: the walk's start gate (`refuseDanger`) and an arm of the
ladder's TIME rung. OFF is byte-identical: acceptance md5 `391322d681b7aa0229d94b3f6906d024` = base, and the same ON.
**No leg solves with it ON, so nothing went hitless.** On 871 OFF = ON (work 885), and the 30 captured page requests
show 0 asks. It has one real witness, from the discarded branch's t724 state: it waits the forecast's 1 tick, the body is
gone, and the gate then names `spinner@880,848`'s live body. That is a second proof that the spinner, not the bob, stops
that state.

**The one thing to know first:** the next lever for 871 is the **spinner press's corner at t719–t724**
(`HAMMER_PHASE_RUNG`: "a landing's knockback is player-coupled"). Also, the fallback's redo **bills 2 contact hits**
(`bob@736,752` at t666 and t737). Both are hammer hand-overs (§ 9). I recommend **not landing** the switch for 871's
sake. Whether to land it as a generic instrument (OFF, with no measured mover) is the planner's call.

## 3. The reproduction (measured)

The leg by key, at the base. The sweep list's id 871 is now **878** (`seedling-divergence-legs.mjs`):
`level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`. The captured
request (`fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz`, from `97739720dd`) carries the pre-R-A5 key
`… ~> level_40__r23c29 -> …`: same region, arrival and goal, but a different link room.

| Measurement | Value | Evidence |
|---|---|---|
| The train row's solve at the shipped wall (dashless, uncapped, `withL40Flip(false)` + the census set) | **refused, work 885**. Same text as the train pin: `-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … danger at (743.9,790.5) — chaser:bob@736,752 (inside leash 80 (d=7.1) …)` | `evidence/leg871-repro-off.txt` |
| Where the search gives up | segment clock **826** (the error's `perTick` = 826 keys, prefix 0). The hit is forecast tick 906 (80 ahead), on the corridor south | in-solver read (temporary print, removed); replay below |
| State at 826 (replaying the refusal's own 826 keys, no equips; matches the in-solver read to the bit) | player (743.9, 697.6); `bob@736,752` at (744.2, 735.2), **hits 0, not dying**, d 37.6; `bob@736,800` hits 0; `bobsoldier@880,832` hits 0 | `evidence/leg871-repro-off.txt` |
| What came before 826 | the segment's `rewinds`: `{t: 0, refused: "HAMMER_SAFETY", refusedAt: 724, bodies: ["spinner@880,848"], verdict: "solved", ticks: 826, how: "opp-plain"}` | in-solver read |
| The t724 refusal (the one the fallback caught) | `-> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line … at (743.94,799.05) … There is no step out. The corner formed 5 tick(s) after the press on spinner@880,848 LANDED at t719 …` | in-solver read (temporary print, removed) |
| The dying body, in the discarded branch (observed-run harness, the run the solver left at t724) | `bob@736,752` hits at t631/t661/**t700** (3rd → `dying`). At t724: (747.6, 805.3), d 7.2, `hitsTimer` 6, `destroy` false. **`destroy` at t725**, alpha falls 1 → 0 over t725–t735, roster drops it at **t736** | `evidence/leg871-branch724-body.txt` |
| The model's own forecast of that end | `run.chaserForecast()` stepped with the player still drops `bob@736,752` at **forecast tick 1** (= clock 725), the tick live `destroy` sets. Not a constant | same file; pinned in `hammerDyingBodyWait.test.js` |
| A still wait from t724 | hit at **t728** by `spinner-hammer` `spinner@880,848` | same file |

The brief's "removed at t735" is the end of the fade. The danger map stops pricing a body at `destroy` (t725), so the
wait that matters there is 1 tick, not 11.

## 4. Design and change; OFF identity

`solverBot.js` only (plus one name in `solverEnvChannel.js`). All new functions, two call sites, nothing renamed or
reformatted.

- **Module level (new):** `DYING_BODY_WAIT {enabled, maxTicks: 60}` (a search bound, not a game constant),
  `DYING_BODY_WAIT_COUNTS`, `withDyingBodyWait`, and `dyingBodyLeavesAt(run, ids, bound)`. The last steps
  `run.chaserForecast()` with the player held still on `previewOrDeath(run.previewStepper())` and returns the first
  forecast tick at which none of `ids` is projected. The forecast drops a body when its cloned "die" anim ends
  (`forecastCorpseFade`), so the end comes from the run, with no class table.
- **`solveSegmentUnder` closures (new):**
  - `dyingSourceIds(sources)`: the ids, when every source is a chaser the live run has `dying && !destroy`.
  - `waitOutDying(ids)`: the forecast end, then that many still ticks on the live run. It rewinds (`rewind.to(t0)`) on a
    hit, death, crossing or deadline, and also when the run still holds a named body undestroyed afterwards.
  - `dyingBodyWait(hit, corridor, …)`: the ladder's wrapper, which re-probes the same corridor afterwards.
- **Call site 1, the gate:** `refuseDanger`, only at the player's own position and with the rewind present. On a kept
  wait it asks the gate again. If that is clean, the walk goes on (a `time` row, `arm: 'dying-body'`, `site: 'gate'`).
  Otherwise it refuses naming what is left. A refused wait appends ` The dying-body wait (DYING_BODY_WAIT): …` to the
  refusal.
- **Call site 2, the ladder:** a TIME arm after the bomb arm. A kept wait with a clean re-probe walks the corridor
  (`{wps}`). A kept wait that is not clean re-plans (`{escalations}`: ticks were spent and the body is gone). A refused
  wait carries its why into TIME's.
- **Thread:** both sites run inside `solveSegment`, i.e. in the page's **solve worker**. No main-thread mapper reads the
  switch, so `pageSolverEnvSwitchOn` is not needed. `?seedlingSolverEnv=SEEDLING_DYING_BODY_WAIT=1` reaches it.

| OFF identity | Value |
|---|---|
| Acceptance md5 at the base `fe98f37f22` | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `69e19d15`, switch OFF | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `69e19d15`, `SEEDLING_DYING_BODY_WAIT=1` | `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest runs

| File (tier) | Rows | Result |
|---|---|---|
| `hammerDyingBodyWait.test.js` (default) | the switch (OFF, env name, channel name, wrapper); `dyingBodyLeavesAt` on the t724 branch state: `{k: 1}` for the dying bob, `k: null` for the live `bob@736,800`, and live `destroy` one tick later | **2 / 2**, 3.6 s |
| `hammerDyingBodyWait.slow.test.js` (slow) | from the t724 branch tape (`fixtures/hammer-dying-body-wait/leg871-branch724-keys.json.gz`, 724 keys, recorded by `evidence/tools/witness724.mjs`). **OFF:** work 193, gate refuses naming `chaser:bob@736,752 (… d=6.8)`, arm 0. **ON:** work 194, one kept wait `{site: gate, ids: [bob@736,752], ticks: 1, from: 724, clean: false}`, gate refuses naming `spinner:spinner@880,848 (a live Spinner BODY at (743.3,806.2) …)` | **1 / 1**, 24.6 s |
| `hammerDyingBodyWait.train.test.js` (train) | **a live (not dying) blocker is unchanged:** the leg's own solve OFF = ON (refused, work 885, same message, arm asked 0) | **1 / 1**, 70 s |
| `solverEnvChannel.test.js` | the name table equals the names read | **11 / 11** |
| `hammerClearTagChain.train.test.js` (fidelity's pin, untouched) | 871's three blocks, 872 | **2 / 2**, 168 s (`evidence/vitest-hammerClearTagChain-train.txt`) |
| `frontend/modules/procgenDocs/` (the doc paragraph) | link census, generated | **493 / 493** (8 files) |

Producers: `census-seedling-solver-surface.mjs --write` (372 rows; `seedling-solver-surface.json` site counts +1) then
`--check` GREEN. `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were regenerated after the doc edit,
then `--check` OK.

**Re-pin of fidelity's row: none.** Its third block (refusal at default, work 885) stays green with the switch OFF, and
ON it does not change either (the train row above). There is nothing for fidelity to sign.

Not run, per the rules: unfiltered local vitest, `pytest`, `standing-values --write`. The suite number is CI's at the
pushed SHA. The new train file has no row in `scripts/test/train-shard-costs.json`. It runs regardless (lightest shard,
with a warning). Its local cost is about 70 s, for whoever owns that table.

## 6. Page play / game witness

None. No plan was solved, so there is nothing for p4g to play. The wallsflip report's game witness of the pre-wall
1122-t plan (0 hits, 0 px) still stands. That plan does not come from this switch.

## 7. Census

**Seed-1 sweep legs the change can move: none measured.** The arm is asked only where every danger source is a chaser
that is dying and not yet destroyed, at a walk's start gate or in a climb.

- **The 30 captured page requests** under `fixtures/` (`evidence/census-fixtures-cap2560.tsv`, keys in
  `evidence/census-fixture-keys.tsv`), each request's dashless pass at the shipped defaults, OFF then ON, capped at 2560
  work: **0 asks, 0 verdicts moved** across all 30. That covers L12, L18, L26, L40 (15 L40 requests: 356, 367, 371, 376,
  377, 387, 388, 398, 403, 853, 860, 871–874), L53, L76 and L105. Side finding: at the shipped defaults 871's request
  **solves** dashless (work 973, 1437 t). The lost solve exists only under the train row's set with
  `withL40Flip(false)`.
- **871 / 872 under the train row's set:** 871 OFF = ON, refused at work 885, 0 asks. 872 OFF = ON, solved hitless,
  work 3823, 2385 t, sha `0c51cdb94854`, 0 asks (`evidence/leg872-trainset-off-on.txt`).
- **Why it is rare:** a body is `dying` only while its "die" animation plays after its last hit (here 25 ticks,
  t700 → t725). The ladder and the gate are almost always asked about a body's *future* positions, which the forecast
  already drops once it is destroyed. Only a walk that starts within a few px of a body during its "die" is refused by
  it. 871's discarded branch is the one such state I found, and a spinner stood behind it.

## 8. What the brief got wrong (measured)

1. **"The search fails where a body is DYING: `bob@736,752` dying at t700, removed at t735."** The search fails at clock
   826, against `bob@736,752` **alive** (0 hits). It gets there through an `OPP_PRESS_FALLBACK` rewind to t0 after the
   first branch's spinner press refused `HAMMER_SAFETY` at t724 (§ 3). The dying body is real but belongs to the
   discarded branch. The source of the error is the wallsflip report's harness (`leg871c.mjs`): it reads the observed
   run, and the solver abandons that run at a rewind. So "refuses at t724", "the danger the ladder names is that dying
   body" and "nothing waits the dozen ticks" describe that run, not the refusal. The refusal's text happens to name the
   same body with the same `d=7.1`, which hid the mix-up. The fidelity train row's header repeats it (*"the search
   REFUSES at t724 … two ticks after its second bob takes hit 2"*): its numbers (work 885, the strings) are right, but
   the tick and the cause are not.
2. **"Removed at t735."** That is the end of the corpse fade. The danger map stops pricing the body at `destroy`, at
   **t725**: the model's forecast says 1 tick from t724, not 11.
3. **"A rung that simply WAITS until the removal tick and then walks" would solve it.** From the dying state, a 1-tick
   wait clears the bob and the gate then names `spinner@880,848`'s body. A still wait from t724 is hit at t728 by the
   spinner's hammer. The dying body was never the only thing in the way.
4. **"fidelity's row … reds when this is fixed."** It does not red, because nothing is fixed. No re-pin.

The smallest correct change would be no solver change at all. I had built the switch before the premise fell (§ 3's
first in-solver read). It is OFF, byte-identical, its hunks are local, and it has a real mechanical witness, so I kept it
for the planner to land or drop.

## 9. Residue and hand-overs

**To the hammer arc (planner `seedling-hammer-phase-planning-6`):**

1. **871's actual lever is the spinner press at t719–t724.** `kill (spinner@880,848) by press` lands at t719, and 5
   ticks later the corner leaves no step out (`HAMMER_PHASE_RUNG`: the landing's knockback is player-coupled, and no
   forecast before it carries the rebound). That is BOBIFRAME's hand-over 2 class ("no step out" at seams 5225 / 5241).
   Replay: `evidence/tools/leg871-dying.mjs` (the branch) and `witness724.mjs` (a solve from it).
2. **The fallback's redo bills 2 contact hits.** Replaying the refusal's own 826 keys bills `bob@736,752` at **t666**
   and **t737** (`evidence/leg871-repro-off.txt`). So the `OPP_PRESS_FALLBACK` redo (`verdict: solved`, 826 ticks) is
   adopted with hits on it. The segment refuses later anyway, but a fallback that keeps a hit-bearing redo deserves a
   look.
3. **Decide whether `DYING_BODY_WAIT` lands** (OFF, no measured mover) or is dropped. Dropping it means reverting
   `69e19d15`, which is self-contained.

**To fidelity (sign / correct, their file):** `hammerClearTagChain.train.test.js`'s header and the wallsflip report's
§ D1 put 871's refusal "at t724 … the dying body". The refusal is at clock 826 against a live bob (§ 8.1). The row's
assertions are correct; only its prose is wrong.

**Residue:** the train-shard cost row for the new train file (§ 5). Evidence tools write nothing tracked.
