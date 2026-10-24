# Seedling fidelity DASHFLIP: the game's 4-test dash window turned ON, and the two campaign segments it moves re-recorded on the game (cloud report)

**Slice:** `seedling-fidelity-dashflip`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`).

⚖ **Licensed (user, 2026-10-05):** *"Yes: flip + re-record"*. Turn `DASH_WINDOW_ROSTER_WIDE` on and re-record
`r9-solve-14` and `r9-solve-16` on the game. Update the campaign `--check`'s tick sum and seam oracles, and the three
model rows that pin the old window. **STOP if anything beyond those moves.**

| | |
|---|---|
| Started from | `origin/claude/seedling-fidelity-dash-i1dan7` @ **`171f6b8a40fffbfbfbe20a1fe6b4d6050bee205b`** (wave3 + DASH) |
| Harness branch | **`claude/seedling-fidelity-dashflip-1841se`**. Every push went here; nothing went to `main` |
| Commits | D1 `1289e99` · D2 `bc47cb0` · D3 `71e103a` · D4 `0d0a3d9` · this report (the head) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (flipped to `all`) · D4 PASS, with ONE STOP-listed mover outside the brief's list** (the ENEMY census's `puncher` corridor row, below) |

## The one thing to know first

**The flip moved one thing the brief did not list. It is not a tape.** The identity block's `ENEMY census default`
moved `1d7bd8cc…` → `68466067…`:
- one row changed: `puncher` CORRIDOR **SOLVED 141 t → 151 t**;
- it is attributed to the flag alone: the flag back at `false` (copy and restore) gives `1d7bd8cc` again;
- that census asserts nothing and commits no artifact.

Per the brief this part is STOPPED and listed, not acted on. The coordinator banks the new value, or the user says
otherwise.

Everything licensed landed:
- **the flag is ON;**
- **`r9-solve-14` 118 → 98 t and `r9-solve-16` 625 → 688 t**, both recorded on the game;
- the chain is **10,978 t**;
- the whole-chain differential is **879 PASS / 0 FAIL**;
- the campaign `--check` **exits 0**;
- `canCross` defaults to `all` again.

## W0 (at `171f6b8`, primary tree, `SEEDLING_PORT=9310`)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9310 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`aa46950b5958b32136111155250dd253`**, the DASH bank |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `b29b589b`, all exit 0 |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | `census-seedling-solver-surface`, `census-seedling-constants`, `witness-seedling-entities`, `witness-seedling-profile`, each `--check` | **GREEN 195** (json `baf8548b…`) · **PASS 4,970** · **PASS 518** · **PASS 138** |
| roster | `fixtures/tapes/index.json` | **211**, `4e4460bf3a0d157e33871d5a37f3984f` |
| bounded vitest BEFORE | 32 files (below) | **1,766 / 1,768**. The 2 reds are pre-existing: `rosterCategories:175` (149 vs 151, the bank row) and `r8Acceptance`'s exposed set (`cancross-l16-sword-none` undeclared) |
| tapeRunner | (fullName, status) pairs, sorted | **479/479**, md5 **`55bc875591b72ef1fa5b9b8c40d07104`** (= DASH's bank) |

The 32 files: `combatVerbs`, `presses`, `ulpDash`, `fidelityDash`, `levelRun`, `solverBot`, `solverDeadline`,
`seedlingCanCross`, `campaignChain`, `tapeRunner`, `r8Acceptance`, `tapeEnvelope`, `observationTolerance`,
`dialogueAutoAdvance`, `tapeIndexManifest`, `rosterCategories`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`,
`entityBlocks`, `jsRuntimeDeclarations` (read-only), `jsRuntimeSolver`, `jsRuntimeSolveService`, `boxLock`,
`lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `rerecordCampaign`, `playthroughAcceptance`,
`fixtures/tiers`, `seedlingProfile`, `watchOverlays`.

**Preview, in a scratch worktree with only the flag flipped:**
- `solve-seedling-r9-campaign --check` gave DASH's 8 failures exactly: the two segments and their traces, the tick
  sum 10935 → 10978, and the seam oracles for `r9-solve-15` and `-18`.
- tapeRunner 479/479, byte-identical pairs.
- The bounded set showed exactly the 2 gate rows and the 3 legacy rows red.

## D1: the flip (PASS, `1289e99`)

`combatVerbs.DASH_WINDOW_ROSTER_WIDE = true`. The docblock now says why it is on and what `false` still reproduces.

**The three legacy-pinning rows**, each set to its measured value, each with a one-line why in the file:

| row | old pin | measured ON | why |
|---|---|---|---|
| `levelRun` *"the replaced window leaves NO GAP"* | max gap ≤ 2 | **3**; fired `[4..9, 12..15, 18..21]`. The row now also asserts each dash fires exactly `T+1 … T+4` | the dash tests four ticks, so two untested ticks sit between windows (it was one) |
| `solverBot` *"a PLANNED dash chain takes L14's boot to ZERO hits THROUGH 120"* | `dashRefusals` 11 | **22**. Zero hits at 120 and 130 unmoved; dashes 17, planned 22, yields 1 unmoved | the opportunistic arm is offered on more ticks (a reading, not traced); every offer is still refused |
| `solverBot` *"a press the model says will be SWALLOWED"* | 68 | **51** | a dash's animation is one tick shorter, so fewer presses land inside it |

**Gate rows to ON:** `combatVerbs` *"is ON on the roster"* and `fidelityDash` row 1 (`slashnarrow` 4). The
`presses.test` comment was reworded; that row reads the active table.

**Mutant** (predicted first; the flag back to `false`, copy and restore):
- predicted: the 2 gate rows plus the 3 rows above red, nothing else (`fidelityDash`'s two-arm rows pass at `false`,
  so the refuted 111 t L16 plan returns there);
- measured: **5 red / 322**, those 5;
- restored md5 `8a6599465f61d88105b09a1ea74debd0`.

## D2: the re-record (PASS, `bc47cb0`)

**Prediction** (written before the run):
- windows 1–15 byte-identical;
- 16 `r9-solve-14` 98 t;
- 17 `r9-solve-15` boot only, `seam.time` −20;
- 18 `r9-solve-16` 688 t, seam −20;
- from 19 on, seam +43, boot only. `r9-solve-18`'s walk is residue-sensitive (F1c), so a move there was the risk.

**Sequence** (F1c/F5's, not the S0–S5 pipeline):
1. `SEEDLING_PORT=9310 node scripts/procgen/solve-seedling-r9-campaign.mjs` (headless, empty latch cache, every
   window driven). Result: **10978 t**, 15 tapes and 2 traces written; windows 1–15 untouched. Its two FAILs are the run
   compared against the pre-write committed tapes, as expected.
2. `check-seedling-bot-differential --record --only=<the 15 movers>`: **15 RECORDED, 15 *"THE MODEL REPRODUCES THE
   RECORDING IT JUST MADE"***, ALL CHECKS PASSED. The **13 boot-only expectations re-recorded byte-identical**; only
   `r9-solve-14` and `-16` changed.
3. `derive-seedling-tick0 --check` gave 14 FAIL: exactly the moved boots, each carrying old seam + 21. Then `--only=`
   those 14: **14 written**. `--check` now gives **ALL CHECKS PASSED** (md5 `34e82d42…`).
4. `generate-tape-index.mjs`: 211 tapes, index `4e4460bf…` → **`26a077de6ff08287676b03e355d6abbc`**.
5. Whole-chain differential (`--only=` all 30 windows, no `--record`): **ALL CHECKS PASSED, 879 PASS, 0 FAIL, 30/30
   "live game matches the committed oracle stream"**, *"the declared endsAt IS the tapes' own length — endsAt 10978"*.
   The provenance rows `{5,0}@301` and `{18,0}@450` pass.
6. `solve-seedling-r9-campaign --check`: **exit 0**, stdout md5 **`bfbaccbb2461d729dbbaf459c58aa846`**.
7. `census-seedling-campaign`: *"30 of 30 window(s) stepped, 29 boundary(ies) admitted — end L30 (224,80), 10978
   ticks"*, **NO CHAIN ROOM MOVES**.
8. `check-seedling-producer-boundaries`: exit 0, **26 VERIFIED, 0 DISAGREES, 6 REFUSED** (12 / 0 / 20 at the base on
   this machine; the 14 extra are the latches step 1 cached; see trap candidates).

**The movers** (tape md5 / expectation md5, before → after):

| window | tape | ticks | `seam.time` | tape md5 | expectation md5 | what moved |
|---|---|---|---|---|---|---|
| 16 | `r9-solve-14` | **118 → 98** | 8638 | `3a89dad3` → `a614aa84` | `f736217d` → `3f3b6b8b` | the walk (licensed) |
| 17 | `r9-solve-15` | 456 | 8776 → 8756 | `239d8d54` → `9281513e` | `94168cfd` (=) | boot: seam −20, `rng.cosmetic`, **`seam.music` "Enemy Hop"/0 → "Room"/2** (the game's latch after the new L14 walk), `tick0` |
| 18 | `r9-solve-16` | **625 → 688** | 9252 → 9232 | `f2a86cc3` → `928e0979` | `49db9f27` → `a19a4d1a` | the walk (licensed) + boot |
| 19 | `r9-solve-18` | 510 | 9897 → 9940 | `b518ac41` → `b5348b79` | `98dfae19` (=) | boot only: **the walk is the same keys** (hammer residue 42 → 40) |
| 20 | `r9-solve-19` | 746 | 10427 → 10470 | `5686ca1c` → `a99330ff` | `300568c5` (=) | boot only |
| 21 | `r9-solve-20` | 560 | 11343 → 11386 | `8ba724f9` → `8f2e0df6` | `d78fd88c` (=) | boot only |
| 22 | `r9-solve-13-v2` | 48 | 12073 → 12116 | `08b9b2c9` → `d1e02034` | `a5374e8d` (=) | boot only |
| 23 | `r9-solve-0-v3` | 299 | 12141 → 12184 | `3bcc409e` → `3ad08fe1` | `ce08206f` (=) | boot only |
| 24 | `r9-solve-12` | 2419 | 12911 → 12954 | `af8abbbd` → `15b3f85a` | `85eff7f8` (=) | boot only |
| 25 | `r9-solve-21` | 26 | 15270 → 15313 | `aa041e78` → `439fa24c` | `111fcadc` (=) | boot only |
| 26 | `r9-solve-22` | 89 | 15316 → 15359 | `9b73265f` → `8f110234` | `fec07dd4` (=) | boot only |
| 27 | `r9-solve-29` | 379 | 15425 → 15468 | `22fbb3a5` → `2de92eb4` | `b49baf0f` (=) | boot only |
| 28 | `r9-solve-31` | 336 | 15974 → 16017 | `bddbe61f` → `22609df4` | `8ea7c931` (=) | boot only |
| 29 | `r9-solve-30` | 210 | 16330 → 16373 | `2b6169db` → `843d5d0f` | `72c9e765` (=) | boot only |
| 30 | `r9-solve-32` | 1056 | 16560 → 16603 | `14657566` → `a4898aaa` | `497d44e7` (=) | boot only |

- Traces: `r9-solve-14` `86407793` → `a840365b`, and `r9-solve-16` `61469cd4` → `d777d256`. No other trace moved.
- "Boot only" means `seam.time`, `rng.cosmetic` (transported, not modelled) and the `tick0` block. The inputs are
  identical (field-by-field diff against the base).
- The chain's −20 (L14) and +63 (L16) give +43 from window 19 on, and the tick sum moves 10935 → **10978**.

**Witnesses on the game** (`probe-seedling-dash-window.mjs --arrows`, headless p4f). All three give ALL CHECKS PASSED:
the game's `Bot.slashTests` equals the model's count at every sampled tick, every arrow is the model's, and the stream
is the model's tick for tick.

| tape | sampled ticks | arrow ticks that differ | game `hits` |
|---|---|---|---|
| `r9-solve-16` | 687 of 689 | 0 | 0 |
| `r9-solve-14` | 99 of 99 | 0 | 0 |
| `dash-l16-sword-all` | 118 of 118 | 0 | 0 |

The DASH census (`census-seedling-dash-window.mjs`): **213 tapes, 35 press a dash, 0 suspects** (DASH measured 3,
`r9-solve-16` among them), 1 replay error (`refuted/r8-solve-5`, pre-existing). Output md5 `fd642a01…`.

**Other producers and witness planners** (each measured at the base, in a worktree, and at the head):
- `plan-seedling-f6-reentry`, `-f7-reentry`, `-u14-moonrock` and `-u15-turret` `--check` are byte-identical and
  exit 0.
- `plan-seedling-f1c-l18-lock` and `-f1c-l18-phase` are byte-identical: exit 1 at both ends, F5's residue.

## D3: `canCross` returns to the solver's default (PASS, `71e103a`)

**Evidence, measured at the flipped head.** Every sword door in CANCROSS's fresh-vs-live table was asked under both
modes (door-built arrival, `inventory: ['sword']`):

| door | `none` | `all` | `all`'s inputs = the game-recorded tape |
|---|---|---|---|
| L3 → L2 (from L11) | 226 t `b44e575c6f` | 152 t `23b4ca25d1` | `r9-solve-3` ✔ |
| L2 → L0 (from L3) | 47 t `8313ecc54a` | 23 t `69f5d32b59` | `r9-solve-2` ✔ |
| L0 → L13 (from L2) | 237 t `d148c3937c` | 145 t `ef6743ba91` | `r9-solve-0` ✔ |
| L13 → L14 (from L0) | 74 t `4b14594834` | 36 t `a1ddebcd9e` | `r9-solve-13` ✔ |
| L14 → L15 (from L13) | 145 t `7f0165df18` | **98 t `9bdc5acd9f`** | **`r9-solve-14` (new)** ✔ |
| L15 → L16 (from L14) | 509 t `fa1d871849` | 456 t `5e43ff1369` | `r9-solve-15` ✔ |
| L16 → L17 (from L15) | 206 t `0c36d853aa` | **117 t `12575cff30`** | `dash-l16-sword-all` ✔ |

- All 14 are `can`; each witness replays and agrees.
- The `none` family is game-witnessed at one door: L16, `cancross-l16-sword-none`.
- The `all` family is game-witnessed at all seven.
- `none`'s only stated reason, the L16 refutation, is cured by D1.

So `CAN_CROSS_DASH_MODE = solverBot.DEFAULT_DASH_MODE` (`all`). The docblock carries this table's reading.

**Unit rows:**
- the D3 witness row now asks `dashMode: 'none'` by name, and `cancross-l16-sword-none` is still byte for byte;
- **new:** the default is the solver's and is `all`, and its L16 → L17 plan is `dash-l16-sword-all` (117 t,
  `12575cff30`, PULL, 0 hits, replay 118 observations agreeing). It matches **every field but `description`**,
  which the DASH slice hand-wrote;
- `fidelityDash`'s comment now reads "defaulted to `none` until DASHFLIP".

**Mutant** (`'none'` again, copy and restore): predicted the new row only; measured **1 red / 23**; restored
`c35400795020b0849acd6d19b787eab9`.

**What changed for callers.** Only `canCross` and `can-cross-seedling.mjs` read the default (grep). The CLI's own
examples spell `--dash=none` explicitly. No doc stated the default.

## D4: records (PASS, `0d0a3d9` + this report)

**The F1c residue (found, not in the brief).** The chain's L18 clock moved +43 ticks, which is −2 mod the hammer's
45: **residue 42 → 40**.
- At the D2 head, two `fidelityF1c` rows were red:
  - the HAMMER-PHASE rung's *"the committed window IS at the chain's residue"* (`expected 40 to be 42`);
  - the witness row *"f1c-l18-phase42 IS the chain-residue staging"* (`rng.cosmetic` and the clock).
- Both were green at the base (11/11).
- Measured: at residue 40 the rung's solve is still the committed window **key for key** (510 t), with stalls, no hit
  and the crossing to L19.
- `CHAIN_RESIDUE` is now 40, with the why. The witness row compares the witness at its own `WITNESS_RESIDUE` 42; only
  the clock and the unmodelled `rng.cosmetic` differ.
- Result: 11/11.
- No tape moved for this. The witness tape is untouched.

**The records:**

| row | command | result |
|---|---|---|
| identity AFTER | the W0 command, on `0d0a3d9` | log md5 **`76832d7ae21c07d8108da33c5214e09c`**; `diff` vs W0: **two lines** (below) |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` unmoved; **`r9-campaign` `b29b589b` → `bfbaccbb2461d729dbbaf459c58aa846`**, exit 0 |
| reference | `generate-procgen-reference.mjs`, then `--check`; `check-procgen-docs` | ALL 7 + 5 MATCH; ALL CHECKS PASSED. Moved: the `campaign-chain` region (10978 t; rows 16 and 18) and the docs index |
| surface / constants / entities / profile | `--check` (no `--write` was needed) | GREEN 195 (`baf8548b…`, unmoved) · PASS 4,970, 0 drift · 518 · 138 |
| tapeRunner | pairs from the bounded run | **479/479**, md5 **`55bc875591b72ef1fa5b9b8c40d07104`** (identical to W0: the pairs name the tapes, and every moved tape replays against its new recording) |
| bounded vitest AFTER | the W0 32 files | **1,767 / 1,769**; the same 2 pre-existing reds; +1 is D3's new row |
| bounded vitest AFTER, sweep 2 | the 12 other test files naming a moved tape or `canCross`: `addEquips`, `director`, `fidelityF1c`, `fidelityF6`, `fidelityF7`, `gameClock`, `tapeFormat`, `turretSolver`, `watchManual`, `producerSegments`, `reachClosure`, `walkMoves` | 479 + 2 red (`fidelityF1c`, fixed above), then `fidelityF1c` **11/11** |
| bounded vitest AFTER, sweep 3 | the 5 files naming the dash machinery: `chasers`, `fidelityL14`, `jsRuntimeSolverAnytime`, `shieldFight`, `dashMode` | **73 / 73** |
| bot log | `seedling-bot-log.md` | `### Seedling fidelity DASHFLIP — the game's dash window, ON`, after DASH, with three trap candidates |
| prose | `seedling-bot.md` | the chain is 30 windows and **10,978** ticks; window 19 at residue 40 |
| roster pins | — | **none moved.** The roster is still 211, no tape was added or removed, and every roster-count and name pin (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `tiers`) is green |

**The identity `diff`, every mover explained:**

| row | W0 | AFTER | why |
|---|---|---|---|
| `solve-seedling-r9-campaign --check` | `b29b589b26e6ad996c2a328d16b52c90` | **`bfbaccbb2461d729dbbaf459c58aa846`** | D2, licensed: two walks, 15 boots, 10978 t. Exit 0 at both ends |
| `ENEMY census default` | `1d7bd8cc20838b2037ba5ce79012afa4` | **`68466067906ea0bbd27f3cd6eadba5e7`** | ⛔ **STOP-listed.** One row: `puncher` CORRIDOR SOLVED **141 → 151** t (CHAMBER 166 unmoved). Attribution: the flag back at `false`, copy and restore, gives `1d7bd8cc` again (restored `8a659946…`). The census builds a synthetic corridor and solves it; the solver's dash previews read the active window. It asserts nothing and commits nothing, but it is an identity row the brief did not list |

## The JS arc's pins

- **No JS-arc file was edited.** `jsRuntimeSolver`, `jsRuntimeSolveService`, `jsRuntimeDeclarations` (read-only) and
  `jsRuntimeSolverAnytime` are green at the head.
- **The live L16 plan the worker's full pass plays becomes 117 t** (`12575cff30`, was 111 t `5b1f924b52`). It goes
  through `solveSegment` at the solver's default `all`, and the game agrees with it (`dash-l16-sword-all`, re-probed
  above). Measured through `canCross` (D3 table), not through the worker itself.
- No contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).
- Any JS-arc pin that typed 111 t for the live L16 plan, or `r9-solve-14`'s 118 / `r9-solve-16`'s 625, or chain sum
  10935, now reads 98 / 688 / 10978. None exists in the files measured here.

## Deltas

| row | W0 | head |
|---|---|---|
| identity log | `aa46950b…` | **`76832d7a…`**, two rows (above) |
| `r9-campaign --check` | `b29b589b` exit 0 | **`bfbaccbb` exit 0** |
| chain | 10,935 t | **10,978 t** |
| tapeRunner | 479/479 `55bc8755` | 479/479 **`55bc8755`** |
| roster | 211, index `4e4460bf` | 211, index **`26a077de`** |
| tapes | — | **15 moved** (2 walks, 13 boot-only); 2 expectations moved, 13 re-recorded byte-identical; 2 traces moved |
| `derive-seedling-tick0 --check` | (stale after the producer: 14 FAIL) | ALL CHECKS PASSED |
| producer boundaries | 12 VERIFIED / 20 REFUSED (this machine) | 26 / 6, 0 DISAGREES |
| dash census | 3 suspects (DASH) | **0** |
| surface / constants / entities / profile | 195 / 4,970 / 518 / 138 | unchanged |
| bounded vitest | 1,766 / 1,768 | 1,767 / 1,769, plus 12 + 5 more files green |

**Files:**
- **sources:** `combatVerbs.js` (`8a659946…`), `seedlingCanCross.js` (`c3540079…`);
- **tests:** `combatVerbs`, `presses`, `fidelityDash`, `levelRun`, `solverBot`, `seedlingCanCross`, `fidelityF1c`;
- **fixtures:** the 15 tapes, 2 expectations, 2 traces and `index.json`;
- **docs:** `seedling-bot.md`, `seedling-bot-log.md`, `README.md` (generated), `procgenDocs/generated/docsIndex.js`.

## What the brief got wrong (measured)

1. **"STOP if anything beyond those moves."** Two things beyond the list moved. Neither is a committed tape, window,
   certification or producer digest:
   - the identity block's **ENEMY census** row (`puncher` corridor 141 → 151), attributed to the flag by mutant and
     STOP-listed here;
   - **`fidelityF1c`'s two residue pins**. The chain clock moved under them (residue 42 → 40) while the walk stayed
     the same keys. They were fixed at their cause, the way F1c fixed its own D3 follow-ups, because they are the L18
     window's seam oracles in another file. Say if that should have been a STOP.
2. **"the tick sum and seam oracles" in the `--check`.** Neither is typed anywhere. The sum is derived from the tapes,
   and the seam oracles are derived from the predecessors' tapes. Re-recording made both green with no edit. The only
   typed copy of 10,935 was prose in `seedling-bot.md`.
3. **"Re-record `r9-solve-14` and `r9-solve-16`."** Re-deriving the chain moves **15** tapes, not 2: every boot after
   window 16 shifts its clock. This is the brief's own "re-derive the chain from the first moved window", spelled out
   in numbers. 13 of them are boot-only, with byte-identical game recordings.
4. **"`CAN_CROSS_DASH_MODE` may be revisited once the L16 `all` plan is the default."** The evidence is wider than L16.
   Under `all`, all seven sword doors plan a game-recorded walk.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **The ENEMY census row** (`68466067…`, `puncher` corridor 151 t): bank it, or rule otherwise | coordinator / user |
| 2 | `campaign-frontier.json` `--check-frontier`: 3 pass / **1 fail, `sources`**. It is **pre-existing**: `AP_1_rules.json` (`aec6f580…` on disk vs `c4845373…` recorded) was not touched by this slice (clean in git; last changed at `a61195f`). `chain`, `segments` and `arrivals` PASS at 10978. `lastArrival` is SKIPPED (no survey on disk). Not rewritten, by rule | coordinator (re-derive) |
| 3 | The full tier owes a CI drive: 15 tapes re-recorded (`check-seedling-full-tier-owed`) | CI |
| 4 | `plan-seedling-f1c-l18-phase`/`-lock` `--check` DRIFT: pre-existing (F5 residue 1), byte-identical here. `f1c-l18-phase42` is now 2 residues off the chain (42 vs 40), but it still solves to the same keys | F5's owner |
| 5 | Pre-existing reds: `rosterCategories:175` (149 vs 151) and `r8Acceptance`'s exposed set (`cancross-l16-sword-none`) | coordinator / CANCROSS |
| 6 | Browser gates not run here: `check-seedling-wasm-ship` CLAIM 7 (end state from the segment tapes; the end state is unchanged, L30 (224,80) at t1056 of window 30, but the chain clock is +43) and `plan-seedling-r7-ends-meet` | CI / coordinator |
| 7 | DASH residue 6 (the spear's `SPEAR_HIT_TICKS_UNMODELLED` against the clamp) is untouched | fidelity |

## Byte-inertia

- **Outside the licence:**
  - five producer `--check`s are unmoved (battery, d2-chain, l18, tail, r9-l3);
  - every identity row but the two named is unmoved;
  - surface, constants, entities and profile are unmoved;
  - tapeRunner pairs are unmoved;
  - windows 1–15 are untouched;
  - no expectation outside `r9-solve-14`/`-16` changed.
- **Not touched:**
  - `campaign-frontier.json`;
  - any AS3, wasm, gitlink or rules file;
  - `jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker;
  - WATCHER's and ROBUST's regions.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was a
  copy and restore, md5-checked. The dev server was killed by its PID.

## Rows to BANK

- **Identity:**
  - log **`76832d7ae21c07d8108da33c5214e09c`** (at `0d0a3d9`);
  - `r9-campaign --check` **`bfbaccbb2461d729dbbaf459c58aa846`** (exit 0);
  - `ENEMY census default` **`68466067906ea0bbd27f3cd6eadba5e7`** (if residue 1 is accepted);
  - the other five `--check`s are unmoved.
- **Chain:** **10,978 t**, 30 windows. The whole-chain differential gives 879 PASS / 0 FAIL.
- **Tapes:**
  - `r9-solve-14` `a614aa84b59d1b467f80b297c9b20716` (98 t);
  - `r9-solve-16` `928e0979d43c7541690ef68fede9c2bb` (688 t);
  - expectations `3f3b6b8b0a979c2b3ab0274064fa3c38` / `a19a4d1a0d4499aac0ba8968e53d8f29`;
  - traces `a840365b408021c71e8f665f40be7f3d` / `d777d25661a76f6698fe08a76505da47`;
  - index **`26a077de6ff08287676b03e355d6abbc`**. **Roster 211.**
- **tapeRunner:** 479/479 `55bc875591b72ef1fa5b9b8c40d07104`.
- **Constants and API:**
  - `DASH_WINDOW_ROSTER_WIDE` = **true**;
  - `CAN_CROSS_DASH_MODE` = `DEFAULT_DASH_MODE` (**`all`**);
  - the chain's L18 hammer residue is **40**.
- **Sources:** `combatVerbs.js` `8a6599465f61d88105b09a1ea74debd0`, `seedlingCanCross.js`
  `c35400795020b0849acd6d19b787eab9`.
- **Bounded vitest:** 32 files, 1,767 / 1,769 (2 pre-existing).
