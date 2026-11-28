# Seedling hammer-phase: PKSW-HITS (the unpriced hits after the L40 spinner press kill)

Slice `seedling-hammer-pksw-hits` (Opus, cloud). Planner: `seedling-hammer-phase-planning-15`. ⚖ Approved by the user on
2026-11-25 (*"Both slices"*; this is the first of the two, the downstream hits). No planner follow-up arrived during the
slice, so none was followed. Evidence: [`seedling-hammer-pksw-hits-evidence/`](seedling-hammer-pksw-hits-evidence/).

## 1. Commits

- **Start:** `2b24a77e3f` (`origin/hammer-flip-bos-gsw-pm`, the brief's base). The flip had **not** landed on main when
  the slice started or ended (`origin/main` = `75ac248ea6`, and `2b24a77e3f` is not its ancestor), so the flip branch
  is the base.
- **Branch:** `claude/seedling-pksw-hits-pricing-ou3ha9`.
- **Commits:**
  - `50b8ea0b`: step 1, the measurement (evidence only, no code);
  - `bd92cbb5`: step 2, the two switches, both OFF;
  - `f456d06c`: step 3, the rows;
  - `a3c5a3ac`: steps 4–5, the survey, the census and the game witness;
  - the report commit (this file) is the head.

## 2. The answer first

- **The one thing to know first:** the two hits are **two different solver misses**, and neither belongs to the verb
  the brief named.
  - The bomb hit is not `BOMB_PHASE_WAIT`'s. It lands two ticks **before** that arm starts, inside a **second press kill**
    (`spinner@192,160`). That kill's tick loop stands on a refuge that nothing prices against the lobber.
  - The chaser hit is not caused by a `HAMMER_FIGHT`-gated read of the walk. It comes from the **walk's own dash
    certificate**: under a `stand` tail it is planned without the swing's line of sight, so it certifies a swing that
    the run's swing cannot land.
- **Two switches, both OFF** (behaviour switches, worker thread, generic: no level, coordinate or entity id):
  - **`PRESS_KILL_REFUGE_BOMBS`** (`SEEDLING_PRESS_KILL_REFUGE_BOMBS=1`, `withPressKillRefugeBombs`).
    - `deriveRefuge` asks the lobber's forecast (`refugeBlast`) on its own.
    - That question is the refuge half of `PRESS_KILL_BOMBS`, which has been OFF since PKB-OFF. The strike's stand half
      stays with `PRESS_KILL_BOMBS` alone.
  - **`DASH_STAND_SIGHT`** (`SEEDLING_DASH_STAND_SIGHT=1`, `withDashStandSight`).
    - `walkTo`'s stand-tailed, window-by-window `planSwordDash` is certified inside the dash certificate's
      line-of-sight depth.
    - `spinnerDashWhole` has always been certified that way under `DASH_CERT_SIGHT` (ON).
- **Results:**

| request | PKSW alone | PKSW + both switches |
|---|---|---|
| **survey step 149** | SOLVED 2149 t, **1 h** (`chaser:bob@288,80` t1930) | **SOLVED 2128 t, 0 h** (game: 2128/2128, **0 hits**) |
| **A1 32:10** | solved 797 t, **1 h** (`bomb:…#9` t1690) | **solved 651 t, 0 h** |
| P1 32:10 | 722 t, 0 h | 722 t, 0 h (identical) |
| P1 32:10, seam −20 (main OFF ships **2 h**) | 618 t, 2 h | **793 t, 0 h** (switches alone, PKSW OFF: refuses; no hit is shipped) |
| P1 32:10, seam +7 (main OFF ships 1 h) | 738 t, 1 h | 719 t, **1 h** (not fixed: §9 item 1) |

- **Survey `--through=end`, per step, in four variants** (OFF; switches; PKSW; PKSW + switches):
  - only **step 149** moves;
  - the two switches alone are identical to OFF on all 250 steps;
  - **no step gains a hit**: 5 hits in total at OFF, 5 with the switches, 6 with PKSW, **5** with PKSW + switches.
- **OFF identity:** acceptance md5 is `391322d681b7aa0229d94b3f6906d024`:
  - at the base;
  - at the head OFF;
  - at the head with both switches ON;
  - at the head with both switches ON + PKSW.
- **Recommendation:**
  - `DASH_STAND_SIGHT` is a cheap flip: in this slice's measurements it moves only step 149, and that move is to hitless.
  - `PRESS_KILL_REFUGE_BOMBS` costs one census capture. Leg 371's hitless solve turns into a refusal on STEP149's
    cause 2, the latched presser hold. That hold is the sibling slice's work, so flip this switch with that slice, not
    before it (§7).

## 3. The reproduction (measured)

**Inputs.** Re-measure-8's captured requests (`7174bc96b9`, the `A1` / `P1` `stop-requests.jsonl.gz`), solved in node as
the worker does, plus survey step 149. The tools are in `evidence/tools/`:
- `probe1.mjs` prints the plan's tick-by-tick positions, which row owns each hit, and the press kill's per-tick
  branch;
- `trace-hooks.mjs` is a measurement-only in-memory loader patch (it edits no repo file).

**Ledger convention.** A hit's `t` is `ticksCompleted + 1`. A1's `t1690` hit lands on key index **1688**. The bomb arm's
`tick: 1690` is `perTick.length` at its own start, which is the key index **1690**.

### 3a. A1 32:10: `bomb:bombpusher@112,128#9` (`measure/a1-32-10-pksw-hit-owner.txt`)

The rows of the dashless pass (the full pass has the same kills):

| row tick | verb |
|---|---|
| 1449 | hold |
| 1534 | **kill `spinner@192,128`** (PKSW's redo, wait 0, ends at 1663) |
| **1663** | **kill `spinner@192,160`**, climb 2 |
| 1690 | walk |

- The hit is key 1688, inside the second kill. The full pass's `BOMB_PHASE_WAIT` arm starts at 1690, after the hit.
  The dashless pass's rows have no bomb arm at all, and both passes bill the same hit (`modelHits` 1).
- **The branch** (`KT` rows):
  - the second kill presses at 1676 and its landing kills the body (hits 3/3, i-frame 30);
  - while the dead body fades, the loop derives a **refuge every tick**: from 1682, the player's own cell (264,200),
    eta 0;
  - the player stands still from 1680 to 1688.
- **The forecast saw it** (`measure/a1-32-10-bomb9-forecast.txt`): the lobber's forecast names `#9`'s blast on that cell
  at (259,199) from key 1676 (s13) down to 1688 (s1).
  - Nothing asked: `deriveRefuge` asks the forecast only under `PRESS_KILL_BOMBS`, OFF since PKB-OFF.
  - With the refuge's question asked, the request solves 651 t, 0 h; 144 refuges were asked and 122 refused.
- **The same family at OFF.** P1 32:10 at seam −20 (`#7` t1598, `#8` t1644) and at +7 (`#8` t1644) are owned by the
  **first** press kill (`spinner@192,128`, row 1534). Seam −20's hits are refuge stands; with the question asked they
  are gone.
  - **Seam +7 is a strike stand, not a refuge.** The player stands at (231.9,167.6) through a strike's dwell
    (1631–1638), then presses at 1640.
  - The blast lands at (218,168), r 15, and one tick of walking at 1641 does not leave it
    (`measure/p1-seam7-bomb8-forecast.txt`).
  - The question that would refuse it is `PRESS_KILL_BOMBS`'s other half (`strikeStandBlast`). With the full
    `PRESS_KILL_BOMBS` on, seam +7 solves 779 t, 0 h.
- **Not the full `PRESS_KILL_BOMBS`:** with it ON, A1 32:10 + PKSW takes another route and **refuses** later
  (`bomb:…#17`, ladder exhausted), and PKSW is never reached. Its refuge half alone solves A1 hitless.
- **A gate I tried and dropped:** "no strike derived on a body already at `hitsMax`" changed nothing measured (seam +7:
  719 t, the same hit), so it is not in the change.
- **Class: (a) solver miss.** The model forecasts the blast exactly, and the solver does not ask.

### 3b. Survey step 149: `chaser:bob@288,80` (`measure/s149-*.txt`)

- **The row that owns the hit:** at t1883, a 5-waypoint walk to the Totem's stance (232,136) → (232,88) → (104,88) →
  (104,136) → (72,136).
  - Its sword-dash plan is 172 t against 302 undashed, with windows at offsets 0/20/40/…
  - Its dash presses at 1885, 1897, 1903, … and 1923. The hit is at 1930.
- **The walk forced undashed at 1883** (prototype, in memory): SOLVED 2191 t, **0 h**. So the dash plan carries the hit.
- **The certified preview against the run** (`s149-walk1883-preview-unsighted-vs-run.txt`):
  - the **player** matches tick for tick;
  - **bob** matches through t1899;
  - at t1900 the preview's bob takes a knockback (+3.8 px) from the 1897 swing, while the run's bob takes it at t1901;
  - one tick apart, the 1923 swing lands on the preview's bob (knocking it to (241,113)) and misses the run's;
  - the run is hit at t1930.
- **The same preview asked with the swing's line of sight** (`dashCertSightDepth`, as `DASH_CERT_SIGHT` asks it) **matches
  the run tick for tick**, bob included (`…-sighted-vs-run.txt`). `probeSamples` on it names **`bob@288,80` at t1930**.
- **Which ask certified the dash:**
  - the corridor has a `stand` tail (the collect approach), and `DASH_STAND_WHOLE` is OFF;
  - so `walkTo` asks plain `planSwordDash(… certify: probeSamples)`, not `spinnerDashWhole`. `spinnerDashWhole` was not
    called at t1883 (instrumented: 0 asks);
  - only `spinnerDashWhole` runs inside `DASH_CERT_SIGHT`'s depth, so the stand path's previews ask no line.
- **Class: (a) solver miss.** The model's own sighted preview agrees with the run, so this is not a fidelity gap. The
  certificate simply asked a different question than the drive.
- **Why `HAMMER_FIGHT=1` gave 0 h:**
  - It is not a walk read. The fight search changes the **second kill** (`spinner@192,144`): it ends at 1731 instead of
    1706.
  - Every later walk starts about 50 ticks later. The walk out (now t1936, 174 t dashed) meets bob at another phase.
  - The certificate is the same unsighted one.
- `DASH_STAND_WHOLE=1` (existing, OFF) also gives 2128 t, 0 h. It is the wider change (it re-plans the chain press-blind
  and certifies it whole), so the slice ships the narrower `DASH_STAND_SIGHT`.

## 4. Design + change; OFF identity

- **`PRESS_KILL_REFUGE_BOMBS`** (`solverBot.js`, next to `PRESS_KILL_START_WAIT`): the switch, `_DEFAULT`, its own
  `_COUNTS {asked, refused}`, `withPressKillRefugeBombs`, and `refugeAsksBombs(run) = (PRESS_KILL_BOMBS ||
  PRESS_KILL_REFUGE_BOMBS) && bombsInPlay(run)`.
  - **Readers:** `deriveRefuge`'s `bombs` (one line, plus the count line), and the kill's "nowhere to be" refusal
    sentence, which names the bomb question when it was asked.
  - A refuge the forecast blasts is not a candidate. Every refuge refused ⇒ the kill's own `HAMMER_SAFETY` refusal: a
    refusal, never a hit.
  - The strike's stand question is untouched.
- **`DASH_STAND_SIGHT`** (`solverBot.js`, next to `DASH_CERT_SIGHT`): the switch, `_DEFAULT`, `counts {asks}`,
  `withDashStandSight`, and `standDashSighted(stand, fn)`.
  - ON with a tail, the wrapper enters `dashCertSightDepth` around `fn` and leaves it in a `finally`.
  - **One call site:** `walkTo`'s window-by-window `planSwordDash`.
  - A corridor with no tail, and every preview outside the dash certificate, read exactly as OFF.
- **`solverEnvChannel.js`:** both `SEEDLING_*` names, sorted.
- **Thread:** both decisions run on the solve **worker** thread. No main-thread mapper reads them.
- **Hunks:** local. Two new blocks, one new helper each, one call site each, and two one-line reads. Nothing was
  reformatted or renamed.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives
  `391322d681b7aa0229d94b3f6906d024` in every case (`measure/acceptance-md5.txt`):
  - base `2b24a77e3f`;
  - head OFF;
  - head with both switches ON;
  - head with both switches ON + `PRESS_KILL_START_WAIT=1`.
- **Regenerations, with no change:**
  - `census-seedling-solver-surface --write`, then `--check` **GREEN** (375 rows);
  - `generate-procgen-reference`;
  - `generate-docs-index`.
  - No doc under `docs/json/developer/procgen/` changed, so no procgenDocs pins were owed.

## 5. Rows + bounded vitest runs

| file | tier | rows | asserts |
|---|---|---|---|
| `pkswHits.test.js` | fast | 8 | both switches: default OFF, the env table, the `with*` restore on a throw. **Behaviour:** on BW's leg-381 witness at t1150, with `PRESS_KILL_BOMBS` OFF and this switch ON, `deriveRefuge` moves off OFF's (232,200) to exactly BW's refuge, counted on this switch's instrument (BW's stays 0), and `deriveStrike` keeps OFF's cell. **Source:** `refugeAsksBombs` has three uses, `deriveStrike`'s stand question is untouched; `standDashSighted` has one call site (the stand-tailed `planSwordDash`), the depth in/out under `try/finally`; no single-game literal in either switch's code |
| `hammerPkswHits.train.test.js` + `hammerPkswHitsRows.js` | **train** (four whole-request solves) | 4 | the request is STEP149's committed fixture (`fixtures/press-kill-start-wait/P1-32-10.request.json`) with the arrival clock set. A1 and P1 32:10 differ in `staging.seam.time` alone (measured: one field), so **no new fixture**. **A1 (79143):** PKSW alone ships `t1690 bomb:…#9`; PKSW + the refuge question solves with `hits = []`, 0 deaths, end L40, every ok pass `modelHits` 0/0. **P1 −20 (82062):** the refuge question alone refuses; with PKSW too it solves with 0 hits and 0 deaths |

- `scripts/test/train-shard-costs.json` has the new train file's local cost (176 s, run under a concurrent request
  matrix).
- **Bounded runs:**
  - `npx vitest run` over `pkswHits.test.js`, `solverEnvChannel.test.js`, `pressKillStartWait.test.js`,
    `hammerPressBombs.test.js`, `scripts/procgen/seedlingSolverSurface.test.js` and `scripts/test/trainShardPlan.test.js`:
    6 files, **90/90**.
  - The train file under `vitest.train.config.js`: **4/4**.
- **Not run:** no unfiltered vitest, no pytest.
- **⚖ Owed:** a **dispatched train-tier run at this tip** (`train_only`). The slice touches solverBot's hammer and dash
  certificate, and this session has no `gh` dispatch, so the planner owes it.

## 6. Game witness (p4g, fresh page)

- **How it ran** (`tools/tapewitness.mjs`): the play half of L40-SPINNER-WALLS's `legwitness.mjs`, unchanged in what it
  drives.
  - It plays the survey's own staged walk view for step 149 on `seedling_bot_ap_p4g`, headless logic-only, on a fresh
    page with the delivered AP set, under the box lock.
  - `serve-nocache.py` was started on 8000 for it (none was running) and stopped by PID afterwards.
- **Results** (`game/`):

| plan | model | game |
|---|---|---|
| **PKSW + both switches** (2128 t) | 0 hits | **finished 2128 / 2128, hits 0**, end L40 (71.9,144.6) |
| control, PKSW alone (2149 t) | 1 hit, t1930 `bob@288,80` | finished 2149 / 2149, **hits 1** (first seen in the t1939 sample; samples are 10 ticks apart) |

- **Not played on the game:** A1 32:10's plan, for the reason STEP149 §6 gives. It sits 1449 ticks into a whole-game
  walk's held room, and the brief excludes a whole-game walk.

## 7. Census: which seed-1 divergence-sweep legs (by key) the change can move

- **The reach of `PRESS_KILL_REFUGE_BOMBS`:**
  - a press kill's refuge (`deriveRefuge`'s only caller) in a room that steps a lobber or holds a bomb
    (`bombsInPlay`);
  - **of the 915 seed-1 legs** (`seedling-divergence-legs.mjs --presets=seedling_playthrough`), only **L40** holds a
    `bombpusher` (`census/lobber-levels.txt`);
  - so at most **L40's 50 legs** (`census/l40-legs-seed1.txt`), and of those only the ones that press-kill a spinner.
- **The reach of `DASH_STAND_SIGHT`:**
  - any stand-tailed dash walk in which a planned swing meets a chaser across a line that the masks block;
  - not countable without a sweep;
  - measured: reached on 5 of the 17 fixtures (1–3 asks each), moved **none** of them; in the survey it moved step 149
    only.
- **Measured in node, 4 variants** (OFF / switches / PKSW / PKSW + switches) over every committed L40 page-request
  fixture: STEP149's 17 (`census/l40-fixtures-*.jsonl`). **14 are identical**, and three move, **all by
  `PRESS_KILL_REFUGE_BOMBS`** (split by switch):

| fixture | KEY | OFF | switches |
|---|---|---|---|
| leg 376 (seam 5271) | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | 1614 t, **1 h** (`t1248 bomb:…#9`) | **1599 t, 0 h** |
| leg 377 | `level_40__r0c53 <- in_L42_240_336 -> location:L40 flag 1: wandlock@176,80 cleared` | 1482 t, 0 h | 1438 t, 0 h |
| leg 371 | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | 1805 t, 0 h | **refused**: *"apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) … inside bombpusher@112,128's 256 px reach … MOVING_WAIT, 256 tried"* |

- **Legs 371 and 376 are the same KEY captured at two clocks.** With the switch, one capture loses its shipped hit and
  the other is routed onto STEP149's cause 2 (the latched presser hold inside the lobber's reach, the sibling
  latched-hold slice). So the switch's cost is that wall, not a new defect.
- PKSW reached none of the 17, as STEP149 found.
- **The bomb-phase family:** `BOMB_PHASE_WAIT` is not the owner of either hit (§8), so its reach is not this change's.

## 8. What the brief got wrong (measured)

- **"`bomb:…#9` at t1690, during `BOMB_PHASE_WAIT`'s kept 1-tick arrival still wait … the arm's own `harmed()` check
  passed, so its ledger read and the hit disagree on the tick."**
  - The two `1690`s are two conventions. The ledger's `t` is `ticksCompleted + 1`, which here is key index **1688**.
    The arm's `tick` is `perTick.length`, which is index **1690**.
  - The hit is two ticks **before** the arm's first tick, inside the second press kill's refuge stand. `harmed()` is
    right: it counts from `hits0`, which already holds the hit.
  - The dashless pass's rows never ask the arm, and it bills the same hit.
  - The hit position is (264.1,199.7). (267.8,199.7) is where the knockback had put the player by the arm's t0.
- **"a later fight-gated read changes the walk after the kill"** (`HAMMER_FIGHT=1` → 0 h). `HAMMER_FIGHT` changes the
  **second kill's** length (1706 → 1731), and that phase shift is what moves the walk. The walk's dash certificate is
  unsighted in both cases. There is no fight-gated walk read to bisect.
- **"The same family ships at main OFF … (seam −20, seam +7, leg 376)"** is half right.
  - Seam −20 and leg 376 are refuge stands; this switch removes their hits (seam −20: 2 h → refusal OFF-PKSW, 0 h with
    PKSW; leg 376: 1 h → 0 h).
  - **Seam +7 is a strike's dwell**, `PRESS_KILL_BOMBS`' other half, and stays 1 h (§9 item 1).
- **"Goal: PKSW + your switch solves step 149 hitless"** needed two switches, not one: the two hits have two causes.
  With only the refuge switch, step 149 is unchanged (2149 t, 1 h).

## 9. Residue / hand-overs

1. **The strike-stand bomb (P1 32:10 seam +7, `#8` t1644; solver, class (a)).**
   - It is `PRESS_KILL_BOMBS`' strike half (`strikeStandBlast` in `deriveStrike`). Full `PRESS_KILL_BOMBS` solves it
     779 t, 0 h, but on A1 + PKSW the full switch refuses later, and PKB-OFF measured its page cost on leg 371.
   - A strike-half-only switch, measured the same way as here, is the next candidate.
   - Rows: seam 82089 is the witness (this fixture at P1 + 7); A1 is the control.
2. **Leg 371 under `PRESS_KILL_REFUGE_BOMBS`.** It refuses on the latched presser hold (STEP149's cause 2).
   - This is the sibling **latched-hold slice's** wall. Measure its fix with this switch ON; leg 371 is a ready
     witness.
   - Until then, `PRESS_KILL_REFUGE_BOMBS` trades leg 376's hit for leg 371's refusal (the same KEY, two clocks).
3. **The other unsighted dash certificates.** `DASH_STAND_SIGHT` covers the stand path only.
   - `walkTo` also asks plain `planSwordDash` with no tail where `wholeAsk` is false (a `narrow` corridor, or
     `dashSpinnerForecast` OFF), and `corridorDashRescue` asks it too.
   - Those previews also ask no line. None was measured to ship a hit here.
4. **The train-tier dispatch at this tip** (§5) is owed by the planner.
5. **The page witness of A1 32:10** (the whole-game walk's entry 32) is owed by the next whole-game re-measure, run with
   `SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1`.
