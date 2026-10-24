# Seedling HAMMER-PHASE — slice B3c: B3b rebased onto wave 10, and ONE replay (`replayOntoFork`) for the fork and the rewind

Slice `seedling-hammer-b3c` (Opus merge slice, cloud), planner `seedling-hammer-phase-planning`. Merge-shaped: with the
flag OFF nothing moved. B3's and B3b's reports (`seedling-hammer-b3.md`, `-b3b.md`, both rebased here) stand for
everything not re-measured below.

| | |
|---|---|
| Start SHA | `99cdf5ce23` (main; contains wave 10 `d978c76322` — `git merge-base --is-ancestor` yes; one commit past it, `99cdf5c` *rules F3*, outside the solver) |
| Head | the commit carrying this report (W0 `6c8e65e`…`a142804` + `2eee5a6`; D1 `46353f1`; D3 `660196e`) |
| Harness branch | `claude/seedling-hammer-b3c-replay-kxkifx` (the brief's `seedling-hammer-b3c`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9560` (`SEEDLING_PORT=9560`); a scratch worktree `/home/user/wt-b3c` on 9561 (D1 before it was committed: the exactness gate, the mutant, the ON rows) |
| Verdicts | **W0 PASS · D1 PASS (one replay; byte-inert OFF) · D2 PASS (all five) · D3 PASS** |

## The one thing to know first

**`replayToTick` is gone. Wave 10's `replayOntoFork` is the one replay, and the rewind is that replay stopped
early.** The rewind's equips are now applied on the RUN clock, as the fork's are, and the rewind's cut (`cutBackTo`)
uses the same clock. B3b's `e.t − offset` (the tape index) is gone, along with `offset`. Nothing moved with the flag OFF:

- the identity block = the base, row for row (log md5 `4647e1e0`, the same at base, W0 and D1);
- the six `--check`s, the crusher witness `--check`, the L18 sweep (45/45), the censuses, tapeRunner (589 pairs);
- the exactness gate: 2,440 + 31 probes (B3b's exact counts), 0 mismatches, every producer's stdout unchanged.

ON, B3's four movers are unchanged and monotonicity is c4 116 → 131 and acceptance 19 → 21. A new unit row covers
the case B3b got wrong: a rewind across a 174-frame dead span. Its mutant (the equips back on the tape index) reds
that row and wave 10's two fork-hygiene (b) rows.

## W0 — the rebase (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-b3c-replay-kxkifx origin/main` | `99cdf5ce23`, contains `d978c76322` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. ⚠ It left `bulletml-dodge` **uninitialised** (`git submodule status` `-7423ee86`); `git submodule update --init frontend/modules/bulletml-dodge` checked it out at its pin `7423ee86` |
| base identity block | `SEEDLING_PORT=9560 bash scripts/procgen/identity-block.sh .` at `99cdf5c` (the clean tree) | non-`#` lines md5 **`4647e1e050a9e76273ddc937ca301360`**. maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; producers `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1` **`b064c264`**, all exit 0; reference ALL 7 + 5 MATCH. **= B3b's rows except r9-campaign `13b8d51f → b064c264`**, wave 10's licensed mover (`bf4763a`), as the brief expected |
| cherry-pick | `git cherry-pick de0d78314e..c4aa5062a8` (8 commits) | **8 land** (`6c8e65e 79b94b8 893a3ef d9a97b8 0a5dc5b d5c430c b4a571f a142804`) |
| conflict 1 | `893a3ef` (B3's records): `seedling-bot-log.md` | both sides appended a section, so both kept: main's ENCOUNTERS entry first, then B3's |
| conflict 2 | `893a3ef`, `d9a97b8`, `b4a571f`: `seedling-bot.md` (one long paragraph) | main's paragraph, with B3/B3b's own sentence edits re-applied to it (each commit's minimal changed span, located by its context; one occurrence each) |
| conflict 3 | `README.md`, `architecture.md`, `generated/docsIndex.js`, `generated/instruments.js`, `generated/urlGrammar.js` (all inside GENERATED regions) | main's side, then regenerated once at the rebased head (`2eee5a6`): `--check` ALL 7 + 5 MATCH, `check-procgen-docs` ALL CHECKS PASSED |
| conflict 4 | `d5c430c` (B3b's D1): `solverBot.js`'s `fork` closure (main: `replayOntoFork(forkRun(), perTick, solverEquips, {stop: crusher-fork})`; B3b: `replayTo(perTick.length)`) | **main's closure and comment kept**, as the brief allowed (the smallest buildable state). B3b's `replayTo` / `replayToTick` remained the rewind's only. So at W0 the fork does not share the rewind's helper. The commit message says this (amended before it was pushed) |
| identity block at W0 | the same command at `2eee5a6` | **= base, row for row** (`diff` empty; md5 `4647e1e0`) |
| tapeRunner pairs | `npx vitest run …/tapeRunner.test.js --reporter=json`; `status\tfullName`, sorted, newline-terminated | **589**, md5 `e6c073f99ac92cd28a56f4a95a17d325` (575 → 589: wave 10's roster 259 → 266) |
| surface / constants / entities / profile | each `--check` | GREEN **234** · PASS **5,488** · PASS 528 · PASS 138 (wave 10's numbers) |
| roster | `fixtures/tapes/index.json` | **266** |
| crusher witness | `plan-seedling-crusher-witness.mjs --check` | exit 0, "all checks green", stdout md5 `4093709f5cb61c729913b4d157635a5f` (B3b's `fa10cbc1` was pre-wave-10; this is the W0 reference) |
| L18 sweep | `sweep-seedling-l18-residues.mjs` | 45/45; the lengths line md5 `1c019765ddfd7f8d950c7f2a3a61b5f3` (= A4 = B3b); the row lines with wall time stripped md5 `509ed669` |

## D1 — one replay (PASS; `46353f1`)

**The helper.** `replayOntoFork` keeps its name, its export, its JSDoc (a)/(b) and its by-name failure. It gains four
options, and with none of them it replays exactly as wave 10's does:

| option | what | fork passes | rewind passes |
|---|---|---|---|
| `to` | replay `perTick[0 … to)` only (the state at tape tick `to`, before its advance) | — (`perTick.length`) | `t` |
| `trailing` | apply the equips made at the clock the replay ends on (the final `applyDue`); `false` only checks them (a clock it jumped past still fails by name) | — (`true`, wave 10's "an equip after the last driven tick is applied after the replay") | `false` |
| `takes` | the apitem takes `{at, level, id, tag}`, applied after the advance at their `at` | `replayTakes()` | `replayTakes()` |
| `handover` | `{at, ticks}`: at tape tick `at` the replay's clock must be `ticks`, else the by-name refusal (B3b's check, its words kept) | `{at: prefix.length, ticks: ticked}` | the same |
| `stop` | asked as wave 10 asks it | `() => fineDeadlineReached('crusher-fork')` (unchanged) | none (a rewind's replay is not optional work) |

**The take's clock, established.** `apItemsTaken`'s `tick` is the view's `tapeTick`, the tape index of the advance
that took it, prefix included (`solveSegment`'s view: `apItemsTaken.set(…, { tick: tapeTick, … })`, and the comment
*"the tick is the TAPE index of the advance that took it"*). The replay's loop index is that clock, so a take is applied
after advance `i === at`. Two by-name failures, like the equips' failure:
- a take whose `at` lies outside `[0, perTick.length)`;
- a take whose `level` is not the level the fork stood on just before that advance. The live view records
  `pre.level`, the level before the advance.

**Why `trailing: false` for the rewind.** The rewind's state is where the refused kill began. An equip made at that
clock may be the kill's own, so it is not replayed, and `cutBackTo` cuts it. This is B3's choice: B3's `replayToTick`
excluded the equips at index `to` and cut `e.t − offset >= t`, carried onto the run clock. Without dead frames the two
rules coincide, and the exactness gate's unchanged 0 confirms they agree on every measured row.

**`cutBackTo(t, clock)`** cuts the equips at `e.t >= clock`, where `clock` is the rewound run's `ticksCompleted` at
`t`. That is the same clock the replay applied them on, so what it keeps is exactly what the replay applied. `undo()`
re-cuts at the same `clock`. Keys, dash ticks and takes are still cut on the tape index (they are recorded on it).

**One replay loop.** `grep -an "\.advance(" solverBot.js` between the helper and the end of `solveSegment`'s
closures finds two lines:
- `15005: r.advance(perTick[i]);` — `replayOntoFork`, the only replay;
- `15331: const out = inner.advance(held);` — the segment's live view, which is not a replay.

`replayOntoFork(` is called at 15511 (the `fork`) and 15557 (`rewind.replay`). `replayToTick` has no definition and no
reader. The tests and the two instruments' header comments now name `replayOntoFork`.

**Untouched:** `forkRunFor` / `jsRuntime*.js`, `bait` / `execBait`, `CRUSHER_BAIT`, `DEADLINE_SITES` (no row added,
none reordered), `twoPassSolve.js` and `watchSolve.solveForPage` (B3b's `forkRun`-only lines stand as rebased),
`flashPanel/*`, the worker, AS3, wasm, gitlinks, rules.

### ⛓ The fork-closure and `replayOntoFork` diff list (for fidelity-planning-5)

`git diff 2eee5a6 46353f1 -- frontend/modules/seedlingDemo/solverBot.js`, every hunk touching the fork or the helper:

1. **`replayOntoFork` signature:** `(r, perTick, equips, { stop = null } = {})` →
   `(r, perTick, equips, { stop = null, to = perTick.length, trailing = true, takes = [], handover = null } = {})`.
2. **New guards at entry:** `fail('replayOntoFork: the run factory built no run')` when `r` is not a run, and
   `… is outside the replayable span` when `to` is not an integer in `[0, perTick.length]` or `handover.at > to`.
   Neither can fire on the fork, which always passes `forkRun()` and the default `to`.
3. **The takes table:** `takesAt` is built from `takes`, and a take off the drive fails by name.
4. **`checkHandover`:** B3b's clock check, its words kept and now prefixed `replayOntoFork:`. It is asked at
   `i === handover.at` before that tick's `applyDue`, and once after the loop if `to === handover.at`.
5. **`applyDue(apply = true)`:** with `apply` false it returns at the first equip due exactly on the clock, without
   applying it. The by-name check for a clock it never landed on still runs. Wave 10's body is otherwise unchanged.
6. **The loop:** `for (i < perTick.length)` → `for (i < to)`. The `stop` ask is unchanged, in the same place and on the
   same condition. Before each advance the handover check runs, then `applyDue()`, then the level is noted if a take
   is due. After the advance the takes are applied with the level check.
7. **After the loop:** `applyDue()` → `applyDue(trailing)`. The fork's `trailing` is `true`, so this is wave 10's call.
8. **JSDoc:** wave 10's text is kept verbatim. A `⛓⛓ SEEDLING HAMMER-PHASE B3c — ONE REPLAY` block is appended before
   `@returns`, naming each option and who passes it.
9. **The fork closure** (`solveSegmentUnder`):
   - The options object `{ stop: () => fineDeadlineReached('crusher-fork') }` →
     `{ stop: () => fineDeadlineReached('crusher-fork'), takes: replayTakes(), handover }`.
   - Two consts are added above it: `replayTakes` (`apItemsTaken` → `{at: tick, level, id, tag}`, B3b's mapping) and
     `handover = {at: prefix.length, ticks: ticked}`.
   - Its 3-line comment is reworded: equips on the run clock, takes, one replay.
   - **Net behaviour change to the fork**, both inert on every measured row (below):
     (i) it replays this segment's apitem takes (B3b's intended change, which B3b's W0 lost at the conflict);
     (ii) it checks the clock at the end of the prefix.
10. **Removed from `solveSegmentUnder`:** `offset`, `replayTo`. `cutBackTo(t)` → `cutBackTo(t, clock)`, with the
    equips cut at `e.t >= clock`. `rewind.replay(t)` → `replayOntoFork(forkRun(), perTick, solverEquips, {to: t,
    trailing: false, takes: replayTakes(), handover})`. `rewind.to` captures `clock = fresh.ticksCompleted`, and
    `undo` re-cuts at it.
11. **Removed export:** `replayToTick`, which had no reader outside `solverBot.js` but the test file. The `forkRun`
    option's JSDoc and the rewind's comment now name `replayOntoFork`.

## D2 — measured (flag OFF unless named)

### 1. Unit rows — PASS

| file | result |
|---|---|
| `fidelityForkHygiene` | **6/6** (its dead-frame stub; `crusher-fork` 95 fine asks, 0 coarse: unchanged) |
| `solverDeadline` | **16/16** (coarse sequences unchanged) |
| `jsRuntimeSolverForkRun` | **5/5**; `.slow` (`vitest.slow.config.js`) **1/1** |
| `hammerFightFallback` | **11/11**: B3b's 10, two of them moved onto `replayOntoFork` (the bare replay row and the b3b prefix row; b3b-m2 is now "the replay starts at `prefix.length` on a boot factory", refused by the same clock check), plus **one new row** |

**The new row** (`⛓⛓ b3c — a rewind across a DEAD-FRAME span lands on the straight run`) reuses the hygiene test's
stub: 174 dead frames at advance 3, and equips at advances 2, 6 and 8, i.e. clocks 2, 180, 182. It rewinds to tape
tick 8 with `trailing: false`, then checks three things:
- the clock is 182;
- the equip log equals the live run's before advance 8 (fire, sword);
- the equips the cut rule keeps (`e.t < clock`) are exactly the ones the replay applied.

**Mutant b3c-m1** was predicted first, then run as copy + restore in the worktree (`solverBot.js` md5 `83be9d13` at
both ends). It puts the equips back on the tape index: B3b's `e.t − offset` (`offset = handover.ticks − handover.at`),
applied before advance `i`, with no trailing apply.
- **Predicted:** the b3c row reds (the sword at clock 180 is never applied), and so do wave 10's two (b) rows (the same
  stub). The stop row stays green.
- **Measured: exactly those three red, the stop row green.**

### 2. Exactness gate — PASS

`SEEDLING_PORT=9561 node scripts/procgen/check-seedling-rewind-exactness.mjs --row=<r> --json=…` at the D1 code:

| row | stdout md5 (= producer) | probes | kill starts | max tick | mismatches | rewind median / max |
|---|---|---|---|---|---|---|
| battery | `405d9c4b` | 0 | — | — | — | re-solves nothing (exit 1 on 0 probes, as B3/B3b) |
| d2-chain | `b76f6483` | 48 | 3 | 1,650 | **0** | 15.2 / 52 ms |
| l18 | `465a8b46` | 22 | 3 | 350 | **0** | 5.1 / 18 ms |
| tail | `35456fbc` | 18 | 0 | 400 | **0** | 14.2 / 24 ms |
| r9-l3 | `6cd35fe1` | 3 | 0 | 150 | **0** | 6.1 / 8 ms |
| campaign | **`b064c264`** (wave 10's) | 49 | 3 | 500 | **0** | 10.1 / 33 ms |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | 80 / 88 / 142 | 9 each | 350 / 350 / 650 | **0** | ≤ 4.2 / 25 ms |
| enemy | `30bcc49c` | 92 | 2 | 350 | **0** | 2.9 / 9 ms |
| acceptance | `76602ae8` | 714 | 19 | 700 | **0** | 1.6 / 19 ms |
| sweep (45 solves) | (prints wall times) | 1,184 | 135 | 500 | **0** | 4.2 / 15 ms |
| **B3's 11 rows** | | **2,440** (= B3 = B3b) | **192** | | **0** | |
| `fork-prefix` | `6de19ab0` (= B3b's) | **31** | 0 | 1,550 | **0** | 44.5 / 96 ms |

`fork-prefix` drives the solve's `bait` forks through the one replay with a 12-tick prefix and a PLAY equip. It plans
L42 identically.

### 3. Byte-identity OFF — PASS

| row | W0 (`2eee5a6`) | D1 (`46353f1`) |
|---|---|---|
| identity block (main tree) | md5 `4647e1e0` | **identical** (`diff` empty; reference ALL 7 + 5 MATCH) |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, exit 0 | **identical** |
| `plan-seedling-crusher-witness --check` | `4093709f`, exit 0 | **`4093709f`**, exit 0 |
| L18 sweep | 45/45, lengths `1c019765`, rows `509ed669` | **45/45, `1c019765`, `509ed669`** (= A4's lengths) |
| tapeRunner pairs | 589 `e6c073f9` | **589 `e6c073f9`** |
| surface / constants / entities / profile | GREEN 234 · 5,488 · 528 · 138 | **identical** (no `--write` needed) |

### 4. Fallback ON — cheap rows — PASS

| row | B3 / B3b | B3c (D1 code) |
|---|---|---|
| monotonicity `--row=c4 --modes=off,fallback` | 116 → 131 | **116 → 131**, refused→solved 15, replay mismatches 0, **solved→refused 0** (98.5 s / 128.5 s) |
| monotonicity `--row=acceptance --modes=off,fallback` | 19 → 21 | **19 → 21**, refused→solved 2, solved→refused 0 |
| ON movers (`SEEDLING_HAMMER_FIGHT_FALLBACK=1`, the block's own commands) | acceptance `0094257a`, c3 `6873ee49`, c6 `15dbcf3f`, c4 `bc35ee7e` | **`0094257a2f5d474abd3049d21d2d9c72`, `6873ee49b9b7fa84ea6c3f328d34b51b`, `15dbcf3fe4010a097984f227f714e61e`, `bc35ee7e11dc9f01831feebce87ef53c`**: identical. Wave 10 moved none of B3's four |

The capacity rows were not run, as the brief said.

### 5. The JS arc's live rows — PASS

`measure-seedling-l18-live-gap.mjs` OFF and ON: **518 / 500 / 503 t (full)**, work 59 / 57 / 57. The two logs are
identical (`diff` empty), and the r40–r42 lines md5 is `bcca0be7` (= B3b). `jsRuntimeSolverCalibration.slow` is
**5/5 OFF, 5/5 ON**.

## D3 — records (PASS; `660196e` + this report)

| row | result |
|---|---|
| `seedling-bot.md` | the press-kill paragraph: `replayOntoFork` stopped at `t`, the fork's one replay, equips on the run's own clock as wave 10 built it |
| `seedling-bot-log.md` | B3's D0 entry, in place. One sentence: B3c made the one replay `replayOntoFork`, with equips on the run clock and never at a tape index. Plus the two clauses that named `replayToTick` and "before their tick" |
| surface / constants | `--check` GREEN 234 / PASS 5,488 at D1, so no `--write` was needed |
| reference | regenerated (`docsIndex`, README): `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| bounded vitest AFTER (flag OFF, main tree at `660196e`) | B3b's 84-file set + `fidelityForkHygiene` = **85 files, 3,125 tests, 3,125 pass, 0 fail, 0 skipped**. tapeRunner **589** `e6c073f9` = W0; `lintGateLabels` 14/14; `hammerFightFallback` 11/11; `fidelityForkHygiene` 6/6; `solverDeadline` 16/16; `jsRuntimeSolverForkRun` 5/5. `seedlingGenCapacity` not in the set |

## Deltas

| row | B3b (pre-wave-10) | head |
|---|---|---|
| the replay | `replayToTick({makeRun, from, to, handover, equips:{at}, takes})` + wave 10's `replayOntoFork` (two loops) | `replayOntoFork` only (one loop) |
| rewind equips | tape index `e.t − offset`, cut at `e.t − offset >= t` | run clock, cut at `e.t >= clock` |
| the fork | `replayToTick` at B3b; wave 10's `replayOntoFork` at W0 | `replayOntoFork` + takes + handover check |
| `hammerFightFallback` | 10 rows | 11 |
| r9-campaign | `13b8d51f` | `b064c264` (wave 10, not this slice) |
| roster / tapeRunner / surface / constants | 259 / 575 / 227 / 5,443 | 266 / 589 / 234 / 5,488 (wave 10, not this slice) |
| crusher witness `--check` stdout | `fa10cbc1` | `4093709f` (wave 10; W0 = D1) |

## What the brief got wrong (measured)

1. **"Base … must contain `d978c76322`"**: main had moved one commit further, to `99cdf5c` (*rules F3*, outside the
   solver). The base identity block was measured there and equals the brief's expectations, so wave 10's rows hold.
2. **"`hammerFightFallback` 10/10"**: it is **11/11** after D1, because the brief's own "add ONE unit row" landed in
   this file. Its 10 old rows pass.
3. **"`seedling-bot.md` / the log's B3 entry … one sentence"**: the log entry needed one sentence plus two clause
   edits. It named `replayToTick` twice and described the equips as applied "before their tick", which is the tape-index
   wording this slice retires.
4. **The bootstrap and `bulletml-dodge`**: `session_bootstrap.sh --seedling` reported READY with the submodule
   uninitialised. It was initialised at its pin by hand.
5. **The fork's W0 state**: B3b's rebase note and the brief both describe the fork as sharing `replayToTick`. Keeping
   main's closure at the W0 conflict (the brief's own option) meant that **at W0 the fork lost B3b's take replay and
   handover check**. D1 restores both on the one helper. The cherry-picked B3b commit message was amended (before any
   push) to say so.

## Residue

| # | item | owner |
|---|---|---|
| 0 | Removed by name only what I created: the worktree `/home/user/wt-b3c` (and its temp branch `b3c-wip`), the two servers by PID (676 on 9560, 4399 on 9561). Scratch files are in the session scratchpad | — |
| 1 | No production row has a dead-frame span inside a segment that the rewind or the fork crosses: B3b's `e.t − offset` was wrong only in principle on every measured row (the gate's 0 is the same before and after). The new unit row is the only witness. A real dead-frame rewind row would be the next exactness row | fidelity / hammer arcs |
| 2 | `cutBackTo`'s run-clock cut has no unit row of its own (it is inside the closure). The b3c row checks the shared rule, `e.t < clock` = applied, on the stub, and no measured solve adopts a rewind across dead frames | hammer arc |
| 3 | B3b's residues stand: the worker's recording Proxy and `out.liveRun` (JS arc), no measured fork past an apitem take (crusher), and B3's capacity re-roll cost (planner) | as B3b |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, `jsRuntime*.js` (`forkRunFor`), `flashPanel/*`, the worker, `bait`,
  `CRUSHER_BAIT`, `DEADLINE_SITES`, `chooseBodyToRemove`, the ghost-sword press, `twoPassSolve.js` and
  `watchSolve.js` beyond B3/B3b's rebased lines.
- **No committed tape moved; no producer digest moved** (OFF; ON, the four movers are B3's own).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52), the capacity rows. `git stash`
  was not used. Kills were by PID only.

## Rows to BANK

- **OFF, at `99cdf5c` = W0 = head:** identity block md5 `4647e1e050a9e76273ddc937ca301360` (acceptance `76602ae8`,
  c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels
  `e28c1e5d`/`fb1a59e5`, AREA `02b22525`, guard `a6d18d49`, maze `246dfbce`); producers `405d9c4b b76f6483 465a8b46
  35456fbc 6cd35fe1 b064c264`; crusher witness `4093709f`; L18 sweep 45/45 `1c019765`; roster 266; tapeRunner 589
  `e6c073f9`; surface GREEN 234; constants 5,488; entities 528; profile 138.
- **New:** one replay (`replayOntoFork`, the run clock, used by both readers). The exactness gate gives 2,471 probes on
  12 rows with 0 mismatches. `hammerFightFallback` 11/11 includes the dead-frame rewind row (mutant b3c-m1 reds it).
- **For a licence (ON, not banked):** B3's four movers `0094257a 6873ee49 15dbcf3f bc35ee7e`; monotonicity c4
  116 → 131, acceptance 19 → 21, 0 solved→refused.
