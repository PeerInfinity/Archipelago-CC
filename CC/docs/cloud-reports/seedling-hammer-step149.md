# Seedling hammer-phase — STEP149 (L40 Totem Part 64,144: the spinner press kill and the bombpusher hold)

Slice `seedling-hammer-step149` (Opus, cloud). Planner: `seedling-hammer-phase-planning-15`. ⚖ Approved by the user on
2026-11-25 (*"Step 149 slice (Recommended)"*). No planner follow-up arrived during the slice, so none was followed.
Evidence: [`seedling-hammer-step149-evidence/`](seedling-hammer-step149-evidence/).

## 1. Commits

- **Start:** `8bee4f279a` (`origin/main`, TRAIN 214). Main had not moved when this report was written.
- **Branch:** `claude/seedling-hammer-step149-3px5k3`.
- **Commits:**
  - `eebf5395` the switch `PRESS_KILL_START_WAIT` (OFF);
  - `e0cfa1d6` its rows and the P1 32:10 fixture;
  - `20b82899` the cost bound (`maxPeriods`), measured on survey step 96;
  - the report commit (this file plus the evidence) is the head.

## 2. The answer first

- **The one thing to know first:** step 149 and A1 32:10 fail at the same place, the **spinner press kill**
  (`kill (spinner@192,128) by press`). The bombpusher hold refusal (32:12) is a second, separate wall. The page only
  reaches 32:12 after 32:10 has refused and it re-solves the location from the room's boot.
  - The kill is a phase-unlucky start: three billiard spinners share a 16×48 px shaft.
  - The fight search (`HAMMER_FIGHT`) finds a hitless kill. It finds it from the kill's first tick (P1/A1 32:10), or
    after a 2-tick idle there (step 149).
- **Switch:** `solverBot.PRESS_KILL_START_WAIT` (`SEEDLING_PRESS_KILL_START_WAIT=1`, `withPressKillStartWait`). It ships
  **OFF**.
  - When it acts: a press kill refuses `HAMMER_SAFETY` / `STRIKE_BOUND_EXHAUSTED`, after every fallback already inside
    it, and the refusal comes within 4 hammer periods of the kill's first tick.
  - What it does: the segment is rewound to the kill's first tick. The player idles 0, 1, 2, 3, 4, 6, 8, 12, 16, 24 or
    32 ticks there, and the kill is redone as one fight search.
  - The first redo with **no player hit since the rewind** is kept.
  - The decision runs on the solve **worker** thread. No main-thread mapper reads it.
- **Results with the switch ON:**
  - **P1 32:10** goes from refusal to **solved**, 722 ticks, 0 hits, 0 deaths on a fresh replay. The numbers are the
    same with main's defaults and with the flip env.
  - **A1 32:10** goes from refusal to solved in 797 ticks, but with **1 model hit**. The hit is a bomb at t1690, 27
    ticks after the kill ended, during a later rung (§9).
  - **Survey step 149** goes from REFUSED to **SOLVED in 2149 ticks, with 1 hit**. The hit is the chaser
    `bob@288,80` at t1930, about 300 ticks after the kill, on the walk out after the hold (§9).
    - **This misses the brief's bar** ("step 149 should SOLVE 0 h; no step may gain a hit").
    - With `HAMMER_FIGHT=1` added, step 149 **SOLVES in 2116 ticks with 0 hits and 0 deaths**.
  - **Survey `--through=end`, per step:** only **step 149** moves, with main's defaults and with the flip env alike.
    The other 249 steps are identical in every field.
  - **A1 32:12** (the bombpusher hold) is unchanged. The switch is never reached there.
- **Recommendation:**
  - **Do not flip the switch alone.** Step 149 would gain a hit.
  - Either fix the downstream rung first (§9, hand-over 2), or measure `PRESS_KILL_START_WAIT` together with a
    `HAMMER_FIGHT` flip (0 hits on step 149). That second option is the planner's call: `HAMMER_FIGHT` ON is a wide
    change of its own.
- **OFF identity:** acceptance md5 is `391322d681b7aa0229d94b3f6906d024`:
  - at the base `8bee4f27`;
  - at the head, OFF;
  - at the head with `SEEDLING_PRESS_KILL_START_WAIT=1`;
  - and also at each intermediate commit, OFF and ON.

## 3. The reproduction (measured)

**Inputs.**
- Re-measure-8's captured requests (`origin/claude/whole-game-wasm-remeasure-8-89f0jy` @7174bc96b9, the `A1` / `P1`
  `stop-requests.jsonl.gz`).
- They were solved in node the way the worker does (`evidence/tools/full.mjs`, `replay-counts.mjs`). The survey ran as
  `survey-seedling-route.mjs --through=end`.

**The two refusals and their rungs** (main defaults; the flip env gives the same numbers, `replay/captured-requests-on-off.txt`):

| request | at main | rung (read rung by rung) |
|---|---|---|
| **survey step 149** | REFUSED (80 s) | collect (64,144) stance → hold stance `wandlock@176,80` → break stance `breakablerock@176,128` → **kill `spinner@192,128` by press**: the derived PRESS tick would land on the hammer line; the corner formed 42 ticks after a press landed (t1569); `OPP_PRESS_FALLBACK` rewound to t1503 and did not kill |
| **A1 32:10** (640, `wasm-continue-location-40`) | refusal, work 220, `5b043103efee` | hold stance `wandlock@176,208` → break `breakablerock@176,128` → **kill `spinner@192,128` by press**: *"every key set … lands … at (227.63,151.84) … There is no step out"*; HAMMER-PHASE rung 0 tried; `OPP_PRESS_FALLBACK` did not kill |
| **P1 32:10** (`dc09599d8d62` on the page) | refusal, work 208, main's answer `3b4bc4163c9b` (same work; the wording moved since the capture) | the same rung, at (222.03,135.45) |
| **A1 32:12** (2560, `wasm-location-40`) | refusal, work 2561, `599d2ef41b84` (= the page's) | **apitem contact → hold** on the presser at (167.9,135.2): `bombpusher@112,128`'s blast at 44 ticks; LATCHED, `MOVING_WAIT` 256 pacings all rejected. The full pass is cut at `crusher-fork` (budget) |

**The geometry** (`tools/map.mjs`):
- `spinner@192,128/144/160` are three billiard bodies, each with a 13 px hammer line, in the shaft x 192–207,
  y 128–175.
- The player enters from the east through the cleared `wandlock@208,128` cell.
- West of the shaft is `breakablerock@176,128`, then the presser pocket `stand-on@160,128` (16×16), which holds
  `wandlock@176,80`.
- `bombpusher@112,128` (256 px reach) covers all of it.

**(b) One cause or two? Two.**
- **Cause 1, the spinner press kill**, is shared by survey step 149, A1 32:10 and P1 32:10.
- **Cause 2, the latched presser hold inside the lobber's reach**, is A1 32:12's.
- In A1's walk, 32:12 is only asked *because* 32:10 refused. 32:11 and 32:12 re-solve the location from the room's
  boot, and that path reaches the pocket hold.
- Survey step 149 never reaches cause 2's refusal. With the kill fixed, its hold paces cleanly: the rock is broken, so
  the pocket is open to the east (`replay/step149-on-walk-hit.txt`, t1760–1880).

**Cause 1 is phase luck, measured.**
- P1 32:10 was re-solved at 45 arrival clocks, seam −22…+22 (`replay/seam-sweep-P1-32-10-main-off.tsv`):
  - **38 refuse** on the spinner kill;
  - **4 solve hitless** (−5, −3, +4, +8);
  - **3 solve with 1–2 bomb hits** (−20…−18: 2 hits; +7: 1 hit).
- A1 and P1 differ only in `seam.time` (79143 vs 82082), and they give different refusals.
- **So the A1/P1 vs A2/A3 split needs no capture effect:** the arrival clock alone moves this answer. A2 and A3 were
  not captured, so I cannot show their clocks.

**(a) Does a hitless line exist that the solver misses? For cause 1, yes. These are the existing switches I tried:**

| tried (P1 32:10 unless said) | result |
|---|---|
| `HAMMER_FIGHT=1` (the fight as one search, from the kill's first tick) | **solved, 722 t, 0 hits** (both passes `modelHits` 0) |
| `HAMMER_FIGHT=1`, A1 32:10 | dashless cut at `crusher-fork` (budget) at 640 and at 2560: it gets past the kill into the bomb rungs |
| `HAMMER_FIGHT=1`, survey step 149 | **REFUSED**, the same kill rung at (214.24,140.50) |
| `HAMMER_APPROACH=1` | the kill is bypassed, and the request now refuses on **cause 2's** bomb hold (the 32:12 message) |
| `HAMMER_BODY_GATE`, `KILL_HIT_BODY`, `CLEARTAG_STAND` | unchanged |
| `PRESS_KILL_HOLD=1` (A1 32:10) | asked, refused: *"the idle is hit at its tick 40"* |
| a start idle with the **plain** kill (this slice's first cut, no fight) | P1: waits 1–15 refused, 20 is hit in the idle (250 s); step 149: REFUSED after **1067 s** |
| the start idle **with the fight** (the switch as shipped) | P1 / A1: wait 0 kills hitless; step 149: wait 0 and 1 refuse, **wait 2 kills hitless** |

**(c) Classification and cost:**
- **Cause 1: (a) solver miss.** A hitless kill exists, and the fight search finds it. The fix is small: one wrapper and
  one call site, built from existing machinery.
- **Cause 2: (a), probable but not exhibited.**
  - It is not budget: SKIPWALLS measured 4× budget.
  - It is not fidelity: the blast and the spinner fire where the model says.
  - The fix is medium-high (§9).
- **The hits the fix exposes downstream:** class not decided here (§9).

## 4. Design and change; OFF identity

- **Where it sits:** `execKillByPress` gains one guarded call at its top:
  `if (PRESS_KILL_START_WAIT.enabled && ctx.rewind && pressKillStartWaitDepth === 0) return execKillByPressStartWait(…)`.
- **The wrapper** (`execKillByPressStartWait`, a new function):
  - It runs the kill exactly as OFF does. This is the inner call, at depth 1.
  - It catches only a `SolverBotError` whose code is in `FIGHT_FALLBACK_CODES`, and only with no deadline tripped.
  - It then works through `waits` in order:
    - rewind to the kill's first tick (`ctx.rewind.to`);
    - idle `wait` ticks. An idle tick that is hit, dies or crosses a door ends the search;
    - re-admit the kill (`derivePressKill` from the admission's own inputs);
    - redo it under `withHammerFight(true, …)`;
    - **undo** the redo if `playerHitsSince(rewound, clock0)` is non-empty, or if it refuses.
  - All waits refused: the original refusal is re-thrown, plus one sentence.
  - The structure is `PRESS_KILL_HOLD`'s (its rewind, its undo, its `PendingDeclaration` hand-through).
- **The cost bound** (`maxPeriods: 4`, read as `maxPeriods × HAMMER_PHASE_RUNG.horizon` = 180 ticks):
  - It is not asked when the refused kill ran longer than the bound from its first tick. That row reads
    `verdict: 'not-asked'`.
  - Measured on the first ON survey: step 96's L40 kill (BK2, `spinner@816,848`) refuses **1336** ticks in. Asked,
    its fight redo killed hitless, but the step still refused later (the iceturret approach).
  - That took **257 s against OFF's 56 s**, so the survey's 120 s step timeout turned it into **TIMEOUT**.
  - The kills this slice is about are inside the bound: 149 at 108 ticks, P1 at 17, A1 at 120.
- **How it differs from `HAMMER_FIGHT_FALLBACK`** (never ON): that retry keeps *any* kill. This one keeps only a redo
  with no player hit, and adds the start idle. It is still bounded by the kill's own window, so a hit after the kill
  ends is not seen (§9).
- **Generic:** no level, coordinate, entity id or Seedling literal. The period is read from `HAMMER_PHASE_RUNG`.
- **Files:**
  - `solverBot.js`: +132 lines, one new block plus the one call site.
  - `solverEnvChannel.js`: `SEEDLING_PRESS_KILL_START_WAIT`, sorted.
  - The surface census `--write` / `--check` is **GREEN** with 374 rows and no row change.
  - The procgen reference and the docs index regenerate with no change.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - base `8bee4f27`: `391322d681b7aa0229d94b3f6906d024`;
  - head, OFF: `391322d681b7aa0229d94b3f6906d024`;
  - head, `SEEDLING_PRESS_KILL_START_WAIT=1`: `391322d681b7aa0229d94b3f6906d024`.

## 5. Rows and bounded vitest runs

| file | tier | rows | asserts |
|---|---|---|---|
| `pressKillStartWait.test.js` | fast | 6 | default OFF and the env table; the waits (0 first, strictly increasing); the bound (whole periods, read at the refusal, re-thrown before any rewind); the wrapper restores the switch on a throw; the counts reset; **source:** exactly one `return execKillByPressStartWait(…)`, guarded at the top of `execKillByPress`, with the redo under `withHammerFight(true, …)`, the `playerHitsSince` audit and `undo()` on a hit, and no level, coordinate or entity id in the wrapper |
| `hammerPressKillStartWait.train.test.js` + `hammerPressKillStartWaitRows.js` + `fixtures/press-kill-start-wait/P1-32-10.request.json` (82 KB: the page request with its source cut to the L40 record) | **train** (two whole-request solves, about 20 s) | 2 | **OFF:** refusal, work 208, `3b4bc4163c9b`, the spinner rung, no row; **ON:** solved, on a fresh replay after the 1449-tick prefix `hits = []`, `deaths = 0`, end L40, every ok pass `modelHits` 0/0, the row `['0:solved']` |

- **Mutation:** dropping the fight from the redo (`withHammerFight(true, () => inner(fresh, again))` →
  `inner(fresh, again)`) turns the ON witness red (it refuses after 199 s), and the source row red too. I then restored
  the file.
- **Bounded runs:**
  - `npx vitest run` over `pressKillStartWait.test.js`, `solverEnvChannel.test.js`, `pressKillHold.test.js`,
    `hammerOppPressFallback.test.js`, `goalStartWait.test.js` and `scripts/procgen/seedlingSolverSurface.test.js`:
    6 files, **66/66**.
  - The train file, under `vitest.train.config.js`: **2/2**.
- **Not run:** no unfiltered vitest, no pytest. No doc under `docs/json/developer/procgen/` changed, so no link-census
  pins were owed.
- **⚖ Owed:** a **dispatched train-tier run at this tip** (`train_only`). The slice touches solverBot's hammer kill, and
  this session has no `gh` dispatch, so the planner owes it.

## 6. Page play / game witness

**Not done. The blocker was measured.**
- The only newly hitless plan is P1 32:10's: 722 ticks after a 1449-tick prefix, from the whole-game walk's held room.
- **A fresh page cannot reach that state** without walking the game to entry 32, and the brief excludes a whole-game
  walk.
- **The tape-on-the-game route is blocked too.** I built a staged tape from the request (prefix + plan,
  `tools/mktape.mjs`). The model refuses it: *"level 40: the tape clears tag(s) 14, 25, which no entity in this level
  reads"*.
  - The page request's persistence is the p4g AP world's.
  - The committed atlas (the differential's model side) does not read those tags.
  - So `check-seedling-bot-differential --record` has nothing to compare against.
- The survey's ON plan for step 149 has a model hit, so it would not be a 0-hit witness either.
- The node fresh replays (§5, `replay/`) are the evidence.

## 7. Census: which seed-1 divergence-sweep legs (by key) the change can move

- **Reach.** The switch acts only where all of these hold:
  - a press kill **refuses** `HAMMER_SAFETY` / `STRIKE_BOUND_EXHAUSTED` after all its inner fallbacks;
  - within 180 ticks of its first tick;
  - on a segment with a rewind (`forkRun`);
  - with no deadline tripped.
- **The survey** (250 steps, both env sets, `survey/pksw-rows-*.jsonl`): a row on **step 149** (solved at wait 2) and
  **step 96** (`not-asked`, 1336 ticks). Every other step never reached the code.
- **The seed-1 leg list** (`seedling-divergence-legs.mjs --presets=seedling_playthrough`, 915 legs at this base) has
  two Totem 64,144 legs:
  - `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`;
  - `level_40__r4c4 <- in_L42_240_336 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144`.
- **Measured in node, OFF vs ON** (`census/*.jsonl`). This covers every committed L40 page-request fixture: the two
  legs above (the puncher-ladder fixtures, legs 855 and 857 at their base), the older-list Totem legs 371 and 376, and
  13 other L39/L40 fixtures (BK2, flags 8 and 12, the pit-west and cpair legs, L39 → L40, L42 → L40, the L39 chest).
  - **All 17 are byte-identical, with 0 rows.**
  - The L41 leg still refuses at main (EXHAUSTED on `puncher@816,128`; `KILL_HIT_BODY` is OFF).
  - Leg 376 already ships a 1-hit plan at main, identical ON (t1248, `bombpusher@112,128#9`).
- **So no committed seed-1 sweep leg moves.**
  - The legs arrive from the north (L41/L42) and never fight `spinner@192,128` from the shaft's east door.
  - What moves is the **south arrival with flags 7 and 8 set**: survey step 149 and the whole-game walk's entry 32
    (32:10).
  - A sweep leg would move only if its press kill refused within 4 periods of its start.

## 8. What the brief got wrong (measured)

- **"the 32:12 hold first (it's the survey step)"**: the survey step is **not** the hold.
  - Step 149 refuses on the **spinner press kill**, the same rung as 32:10, with main's defaults and with the flip env.
  - SKIPWALLS §8 said the same.
  - The hold (32:12) is only reached in A1's walk after 32:10 has refused.
  - So the right order was 32:10/149 first. The hold became a hand-over.
- **"2+2 samples can't say whether the capture moved the arrival"**: the request's answer moves with the arrival clock
  alone.
  - Over 45 seam offsets: 38 refusals, 4 hitless solves, 3 solves with bomb hits.
  - A1 and P1 differ only in `seam.time`.
  - Nothing is needed from the capture to explain the split.
- **"Switch-independent in replay" (32:12)** is right. The flip env and this switch both leave it byte-identical.
- **A1 32:10's live hash `a8a824ee2146` does not reproduce at main.** Main answers `5b043103efee` (work 220) with no
  env, and work 222 under the capture's env. Main has moved since the capture. The rung is the same.
- **"step 149 should SOLVE 0 h"** is not reachable by a kill-level fix alone:
  - the kill is hitless;
  - the leg then takes an unpriced chaser hit about 300 ticks later (§9).
  - With `HAMMER_FIGHT=1` as well, it is 0 h.

## 9. Residue / hand-overs

1. **Cause 2: the latched presser hold inside the lobber's reach** (A1 32:12, `599d2ef41b84`, unchanged). This is a
   solver hand-over, probably class (a), cost medium-high.
   - **The geometry makes pacing fail.** The stance is a 16×16 pocket: wall to the west and north, the rock east, the
     rock or spinner shaft south.
   - Every lateral or vertical pacing bumps a wall and ends off the stance. `down/up` meets `spinner@192,128`. A blast
     disc of 15 px covers the whole pocket, so no in-pocket pacing can be clean.
   - **SKIPWALLS' main proposal** is still the one I would build:
     - once the latch has fired, treat the rest of the hold as a **latched wait**;
     - that is, `runLatchedWait` / `fadeMoveTry` with the hold's own `until`, walking out of the 256 px disc and back.
   - **`FADE_MOVE`'s refuge rings will not be enough.** They reach at most 64 px round the mouth, and `wandlock@176,80`'s
     mouth is about 85 px from the lobber. The move would need a refuge outside the reach, or a moving wait.
   - Rows: A1 32:12 is the witness; survey step 149 (ON) is the control.
2. **The downstream unpriced hits that the kill fix exposes.** Neither is a proven forced hit (`FORCED_HIT_TRACE` empty).
   Both are hits the solver did not price:
   - **A1 32:10 ON:**
     - `bomb:bombpusher@112,128#9` at **t1690**, at (267.8,199.7);
     - during `BOMB_PHASE_WAIT`'s kept **1-tick arrival still wait** on the walk to the break stance for
       `breakablerock@176,128` (`BOMB_PHASE_WAIT_COUNTS.kept`: `{arrival: true, tick: 1690, kind: 'still', ticks: 1}`);
     - the arm's own `harmed()` check passed, so its ledger read and the hit disagree on the tick;
     - the same family ships at **main OFF**: P1 32:10 at seam −20 (t1598 and t1644, `#7`/`#8`), seam +7 (t1644, `#8`),
       and leg 376 (t1248, `#9`) (`replay/a1-32-10-on-hit-and-off-seam-hits.txt`).
   - **Survey step 149 ON:**
     - `chaser:bob@288,80` at **t1930**, at (229.4,124.4);
     - the hold paced cleanly (t1760–1880), and the walk then left east through the doorway, swung at t1923 and was hit
       at t1930 (`replay/step149-on-walk-hit.txt`);
     - with `HAMMER_FIGHT=1` added, the same leg solves in 2116 ticks with **0 hits** (`replay/step149-with-hammer-fight.txt`);
     - the kill there is the same (wait 2), so a later fight-gated read changes the walk after the kill. I did not
       isolate which one.
   - **Class:** (a) or (c), not decided. The next slice should read the walk's chaser and bomb pricing on these two
     ticks.
   - **Until one of these is fixed**, flipping `PRESS_KILL_START_WAIT` alone turns step 149 from REFUSED into a 1-hit
     SOLVED, and lets the page ship 1-hit plans for A1-like arrivals.
3. **`HAMMER_FIGHT` + `PRESS_KILL_START_WAIT` together** solve step 149 hitless. This is the planner's candidate if a
   `HAMMER_FIGHT` flip is in view. Its own flip table (WC's 22 rows ON) is a separate measurement.
4. **The page witness** (§6) is owed by the next whole-game re-measure, run with `SEEDLING_PRESS_KILL_START_WAIT=1`.
   Entry 32's 32:10 should solve. Whether the page then ships a hit depends on the arrival clock (item 2).
5. **The dispatched train-tier run at this tip** (§5) is owed by the planner.
