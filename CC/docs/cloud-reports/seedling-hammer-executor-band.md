# Seedling HAMMER-PHASE BX — the shake band at the executor's own checks, and the refusal that says the band hid the refuges

Slice `seedling-hammer-executor-band` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User, 2026-10-25:
*"Yes, I approve fast forwarding main, and all of the tasks that belong to this session."* It closes PKB's residue 1
(the band throws that still escape at the executor's own reads) and LB's hand-over 5b, second half (an all-banded
refuge search says the band hid it). The evidence is in
[`seedling-hammer-executor-band-evidence/`](seedling-hammer-executor-band-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`cfc681a566`** (`origin/main` at the fetch: PKB's merge). `PRESS_KILL_BOMBS_DEFAULT = true` (`pressKillCost.js`) and PKB's refuge band catch (`deriveRefuge`, `solverBot.js:11419`) are in it |
| branch | `claude/seedling-executor-shake-band-tnp9ij`, the session's designated branch (not the brief's `seedling-hammer-executor-band`). Nothing went to `main` |
| commits | W0 `17b2a2e9` · M `14f26761` · I1 `9a7bd7c4` · I2 `847b4ec8` · D `b9e40efe` · this report (the head) |
| box | 4 cores, node v22.22.0, dev server `serve-nocache.py 9587` (killed by PID at the end) |

## 2. The answer

**Per site, the treatment chosen: the walk WAITS THE BAND OUT** (treatment C, a third treatment; behind
`EXECUTOR_SHAKE_BAND`, **OFF**). On the band throw at either site the walk stands one tick with no keys and re-asks its
attempt from the top. It does so only if the untimed gate clears the standing box (no forecast, so no band), with the live
run the oracle of any hit or crossing, and for at most `EXECUTOR_BAND_WAIT` = 45 ticks per walk; each of those ends
refuses the walk by name. The same treatment at both sites, because 371's solves need both: at 5252 the walk waits 13
times at the gate and 5 at the probe.

| site | treatment | 371, defaults (phases solving of 45) | 371, `PRESS_KILL_BOMBS=0` | L40 radius (47 page requests) |
|---|---|---|---|---|
| 1. the walk's gate (`walkToUnder` → `refuseDanger` → `dangerNow` → `swordTickAt` → the forecast) | **C, wait** | 30 → **30**; its one band phase (5243) → the hold's own named refusal | (its gate waits are part of the probe row's solves) | — |
| 2. the corridor probe (`walkToUnder` → `probeCorridor` → `previewWalk`) | **C, wait** | no band phase at the defaults | 22 → **24**: 5252 and 5253 SOLVE (1,935 t on the dashless pass); 5254 throws again from a third site | 1 mover: leg 368's dashless pass (band → the hold's refusal), the answer (the full pass's plan) unchanged |

- **No solve is lost** at either arm, and nothing but the band phases moves (census, seam for seam).
- **Is the flip ready to recommend? Yes, as a small, safe flip with a small payoff.** At the shipped defaults it turns
  the one escaped throw on 371 (5243) into a named refusal and moves one pass on L40 (no answer). Its solves show only with
  the bombs OFF. The A/B should expect what § 8 says.
- **The refusal text (I2, default):** *"… and no strike on spinner@192,128 is derivable. The room has nowhere to be.
  (PRESS_KILL_SHAKE_GUARD: 12 refuge candidate(s) whose preview the camera-shake band hid are not counted.)"* — 371 at
  5266 with the bombs OFF, where all 12 previewed refuges are banded. It is absent when the tick's refuge search refused
  none for the band, so the text is otherwise byte-identical.

## 3. W0 — the baselines at `cfc681a566`

| check | result |
|---|---|
| identity block (`w0/identity-dflt.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `7e1497c4`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`, generated set OK; producers `405d9c4b a591fa9d 6460d60d 35456fbc 6cd35fe1 27478177`, all exit 0; reference ALL MATCH. **Row for row PKB's P2 block** |
| `ci-producer-checks --jobs=4` | 93 run, 0 red, 1 skipped |
| bounded vitest (149 files, `w0/bounded-files.txt`) | 4,678 / 4,679. The one red is `scripts/procgen/boxLock.test.js` › *"lets exactly ONE of eight simultaneous takers hold the box"*, run at load ~14; alone it is 26 / 26. A load race in the box lock's own test, not the solver |

- **The bounded set** is PKB's 148 files plus every non-slow test that `rg -a` finds naming `refuseDanger`,
  `probeCorridor` or `walkToUnder` (5 files; 4 were already in PKB's list, so one is new: `fidelitySpinningAxe.test.js`).
  The new gate makes 150 at D.
- The venv's Playwright read 1.56.0 against the pin 1.63.0, so I installed `requirements-headless.txt` before the first
  identity run (as PKB did). The bootstrap again left six submodules uninitialised; I initialised them, and no gitlink
  moved.

**The 371 capture.** `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g
--page-legs=1 --ids=371 --capture-requests=…`. The key is still id 371. On the page at this base it arrived at seam
**5242** and **solved** (1,888 t, dashless; `w0/page-row-371.jsonl`). Node replays it identically (1,888 t).

**The census** (5226–5280: one period plus a 10-seam overlap; `w0/census-*.txt`):

| arm | phases solving of 45 | overlap | classes over the period | band phases |
|---|---|---|---|---|
| defaults (bombs ON) | **30** | 10 / 10 | 30 SOLVE · 5 hold refusal (the lobber's reach) · 5 EXHAUSTED · 2 HAMMER_SAFETY (no step out) · 2 HAMMER_SAFETY (nowhere to be) · **1 band throw** | **5243**: `onScreenAt ← chaserForecast.step ← swordTickAt ← dangerNow ← refuseDanger ← walkToUnder ← walkTo ← walkToUnder ← walkTo ← solveSegmentUnder` (site 1, the walk to the hold stance `verb:hold/walk`) |
| `PRESS_KILL_BOMBS=0` | **22** | 10 / 10 | 22 SOLVE · 9 nowhere to be · 5 hold refusal · 3 band throws · 2 no step out · 2 EXHAUSTED · 1 deadline · 1 reboot | **5252, 5253, 5254**: `onScreenAt ← previewWalk ← probeCorridor ← walkToUnder ← walkTo ← walkToUnder …` (site 2, the walk to the break stance `verb:hold/walk/verb:break/walk`) |

- **Class for class PKB's P2 census on all 55 seams, at both arms.** The work units and answer hashes differ, because
  the request was captured at a different page arrival (5242, against PKB's 5257).
- The census is fresh-process (PKB's `l371-solve.mjs`) for 53 + 20 seams. The rest come from a one-process variant
  (`tools/l371-multi.mjs`), which I checked against fresh processes on 6 + 20 seams: all identical. Two parallel `>>`
  writers had torn two long JSON lines (§ 9), so those seams were re-run.

**The escaped throw's fate.** `settleSolve` turns the plain `Error` into the pass's answer: `kind: 'refusal'`, code
`null`, progress kind `other`, outcome `threw`, `lastWhy.kind: 'error'` at `segment/goal#0/walk/verb:hold/walk`. Its
message is the forecast's own words: *"chaserForecast: whether bob bob@288,80 is on screen depends on where inside
`Game.shake`'s jiggle the camera landed, and the two draws that decide it are not indexable (camera.js, "THE SHAKE, AND
WHY IT IS A BAND") … Wait the shake out before previewing this corridor."*.
- At 5243 the full pass then refuses at its deadline, and the answer kept is the dashless pass's band text.
- At 5252–5254 both passes throw it.
- On the page, the leg ends `failed`, *"the solver declined Level 040 - Totem Part 64,144 in level 40 (refusal):
  chaserForecast: whether bob bob@288,80 is on screen …"* (PKB's W0 page row at 5257 is that row). It is a declined leg,
  not a crash and not a halted bot.

## 4. M — the design check

A scratch patch (`m/scratch-treatments.diff`, env-selected, never committed) catches the band (`isShakeBandThrow`) at
the walk's gate and at both of `walkToUnder`'s corridor probes. Treatments:
- **A, danger:** the gate refuses as danger (`refuseDanger`'s own refusal); the probe returns a hit, so the ladder
  climbs;
- **B, named refusal:** `HAMMER_SAFETY`, *"the camera-shake band hid the gate's / corridor probe's read …"*;
- **C, wait:** stand one tick (gated, bounded, the live run the oracle), then `continue attempts`.

**371's census** (`m/census-*.txt`, transitions from W0) and **the L40 radius** (`radius/radius-cmp.txt`). For the
radius I captured every L40 leg on the page at this base: 42 legs, **47 requests** (29 done, 11 failed, 2 timeout on the
page), PKB's count. Each request was replayed at its own seam.

| treatment | 371 defaults | 371 bombs OFF | L40 radius (47) | verdict |
|---|---|---|---|---|
| A — danger | 30 → 30; 5243 → a danger refusal | 22 → 22; **5252–5254 still throw the band, at the same units**: the ladder's rungs preview the same forecast and throw it again | 0 movers, not even a pass: 368's dashless band (a probe band) still throws | ✗ at the probe: the band escapes from the next reader |
| B — named refusal | 30 → 30; 5243 → the named refusal, same units | 22 → 22; 5252–5254 → the named refusal, same units | answers 47 / 47 identical; one pass's text moves (368 dashless) | ✓ safe, and it solves nothing |
| **C — wait** | 30 → **30**; 5243 waits 11 ticks (8 gate, 3 probe) → the hold's own refusal (*"the hold stands still for up to 131 tick(s) … inside bombpusher@112,128's 256 px reach"*), +16 units | 22 → **24**: **5252 and 5253 SOLVE** (36 waits each, across both passes); 5254 waits 38, then throws from a **third site** | 1 mover: (368, i0), seam 5204, `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144`: the dashless pass's probe band → the hold's refusal; the answer (the full pass's plan, 1,584 t, the same hash) unchanged, 592 → 616 units | ✓ **recommended, both sites** |

- No treatment loses a solve, and no seam moves except a band phase (C and B: only the band phases; A: only 5243).
- **The third site** (`m/stack-5254-pkb0-under-C.txt`): `onScreenAt ← chaserForecast.step ← tick ← hold ← planPacedWait ←
  pacedHoldPlan ← execHold ← walkToUnder`. The hold's paced-wait search, after the walk has waited. It is not one of the
  brief's two sites, and is a hand-over (§ 10).
- **Why C over B:** B is the minimal, honest answer, but it converts a throw into a refusal and nothing else. C converts
  two of four band phases into solves and the rest into the executor's own refusals, at a cost the live run polices. A
  fails outright at the probe: the band is a camera question, not a danger, and the rungs that price danger ask the same
  camera.
- No site needed `levelRun.js`, `dangerMap.js`, `botDriverV*.js` or `flashPanel/*`. No STOP.

## 5. I1 — `EXECUTOR_SHAKE_BAND` (OFF)

**The code** (`solverBot.js`, all inside the brief's scope):
- the switch, after `swordTickAt`:
  - `EXECUTOR_SHAKE_BAND` (`SEEDLING_EXECUTOR_SHAKE_BAND === '1'`) and `EXECUTOR_SHAKE_BAND_DEFAULT = false`;
  - `withExecutorShakeBand(enabled, fn)`;
  - `EXECUTOR_SHAKE_BAND_COUNTS {gate, probe, waited, refused}`, the counter beside `shakeRefused`. It lives in
    `solverBot.js`, beside the switch, so **`pressKillGuards.js` is untouched**;
  - `EXECUTOR_BAND_WAIT = SPINNER.hammerPeriod` (45);
  - the docblock carries ⛓ PKB residue 1 and LB hand-over 5;
- `walkToUnder`: `waitShakeBand(e, site, except)` rethrows unless the switch is ON and the throw is the forecast's band.
  Otherwise it counts, records `{tick, what, site, ticks}` once per walk (`executorBandWaits`, an optional result field
  present only when a walk waited), and then:
  - refuses by name if the walk has already stood `EXECUTOR_BAND_WAIT` ticks;
  - asks the untimed gate (`dangerNow` without the timed blade, recorded as a `gate` danger query) and refuses by name
    on danger;
  - pushes and advances one empty-key tick;
  - refuses by name on a crossing or a new hit.

  The three call sites (the gate, the probe, the climb's re-probe) then `continue attempts`. The refusal reads
  *"<what>: EXECUTOR_SHAKE_BAND — the camera-shake band hides whether bob@288,80 is on screen at the walk's gate (t45),
  and the walk has already stood 45 tick(s) for it (EXECUTOR_BAND_WAIT 45)."*.

**The rows** (`hammerExecutorShakeBand.test.js`, 13; 11 at I1):
- **Staged, per site:** LB's boot-414 (`fixtures/hammer-lb-hx/`). Its first walk reads the forecast first at the gate,
  then at the probe, both at t0 (measured). A chosen forecast's step throws the forecast's own words. OFF, the band
  escapes before a tick; ON, one empty tick, the counts, and the walk walks on to the cap.
- **ships OFF** (skipped under any env value), and the wrapper.
- **With no band, ON = OFF key for key.**
- **Never-settling band:** 45 empty ticks, then the named refusal.
- **ON, a non-band error still throws:** the live run's `levelRun:` words, and a defect.
- **The page's own request:** 371, cut to level 40, `fixtures/hammer-bx-371/leg371-l40-request.json.gz`, 10 KB. Its
  answers at 5243, 5252 and 5266 are byte-identical to the full 530 KB capture's (measured).
  - 5243 at the defaults: OFF the band, 101 units; ON the hold's named refusal, 117 units, `{gate 8, probe 3, waited
    11}`.
  - 5252 with the bombs OFF: OFF the band, 92 units; ON **SOLVED**, 1,935 t, 153 units, `{gate 13, probe 5, waited
    18}`.
- **Mutants** (`d/mutants.txt`; the file was restored byte for byte):
  - m1, the catch removed: the 5 ON rows red;
  - m2, the I2 suffix dropped: the 5266 row red;
  - m3, any error caught: the "not the band" row red.

**The ON radius by mover class** (the switch ON against the defaults):

| instrument | movers |
|---|---|
| 371 census, defaults | 1: 5243, band → the hold's refusal (w: a throw that becomes a named refusal) |
| 371 census, bombs OFF | 3 band phases: 2 → SOLVE, 1 → a band from the third site; the 9 *"nowhere to be"* move by I2's text alone. Same as the scratch C, unit for unit |
| L40 radius (47) | 1 pass: (368, i0)'s dashless pass; no answer |
| bounded vitest (150) | 0: 4,691 + the "ships OFF" row skipped under the env (D defaults 4,692 / 4,692) |
| producers | 0 red of 93 (1 skipped), the same verdict per producer as the defaults |
| identity block | 0: = W0, row for row |

**OFF is byte-identical:** 371's census at both arms (55 + 55 seams, I2's text aside, § 6), the L40 radius 47 / 47 (pass
for pass), the identity block, the roster, and the bounded set (§ 7).

**Ready to flip?** **Yes, on measurement:** no solve lost anywhere measured; the one thing it can do that a refusal
cannot is spend live ticks standing, and the oracle and the bound police that. The A/B should expect § 8.

## 6. I2 — the refusal names the band

- **The suffix:** `refugeNow` records `shakeRefused`'s delta over its one `deriveRefuge` call per tick (`refugeBanded`).
  The *"nowhere to be"* `fail` appends *" (PRESS_KILL_SHAKE_GUARD: N refuge candidate(s) whose preview the camera-shake
  band hid are not counted.)"* when N > 0, after BW's bombs suffix. No switch.
- **The rows:**
  - 371 at 5266 with the bombs OFF (a real all-banded refuge, all 12 candidates) ends in exactly that text with N = 12;
  - 371 at 5265 at the defaults (no candidate banded) ends in BW's suffix and nothing else.
  - The brief's *"PKB's G1 shape"* cannot reach `execKillByPressOnce`: `deriveRefuge` is called directly there.
    Staging A's own kill asks no refuge before its first death (measured to t778), and a blanket band poison is caught
    first by the kill's `stepToward` and `strikeEscape`. So the row is the page's own all-banded state, not a staged one.
- **Who reads the text** (`rg -a "nowhere to be"` outside the reports):
  - no code parses it. Readers classify by the code (`HAMMER_SAFETY`, `FIGHT_FALLBACK_CODES`, `budgetKindFor`);
  - `procgenOracle.test.js` builds its own `SolverBotError('nowhere to be')`;
  - `solverSpinnerKill` / `procgenCountableClock` quote it only in comments;
  - committed trace sidecars and producers: none carries it (the roster is unmoved, § 7).
- **What it moves:**
  - 371 at the defaults: nothing (its two *"nowhere to be"* phases band no refuge);
  - bombs OFF: all 9 *"nowhere to be"* phases of the period (5226, 5249, 5257, 5258, 5266–5270; and 5271 in the
    overlap), each at the same units;
  - L40 radius: 0 of 47.

## 7. D — the gates

| gate | result |
|---|---|
| bounded vitest (⚖ 52, by path, 150 files: W0's 149 + the new gate) | W0 4,678 / 4,679 (the box-lock race, 26 / 26 solo) · **D defaults 4,692 / 4,692** · **D with `EXECUTOR_SHAKE_BAND=1` 4,691 + 1 skipped** (the "ships OFF" row skips under any env value) |
| both `.slow` files, locally at D (`vitest.slow.config.js`) | **3 / 3**: pre-sword in 28 s, post-sword 1–60 in 627 s, seed 30 certified in 54 s |
| `ci-producer-checks --jobs=4` | **0 red** at the defaults and with the switch ON (93 run, 1 skipped each) |
| identity block | **D defaults = D ON = W0**, row for row, reference ALL MATCH (`d/identity-*.txt`) |
| `census-seedling-solver-surface --check` | RED at I2 on 8 site-count drifts (the wait's `run.state`, `run.ledger('playerHits')`, `run.advance`, `run.ticksCompleted` and `SPINNER` reads), then `--write` → **GREEN, 352 rows** |
| `census-seedling-constants --check` | PASS (0 new, 0 vanished; 10 moved, line shifts) |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED (the bot docs' word counts regenerated) |
| `generate-docs-index --check` | OK (191 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `check-seedling-wasm-ship` (headless, the 9587 server) | **ALL PASS, 415** (0 FAIL) |
| `seedling-bot.md` | two paragraphs after *"The press kill's two guards"*: the switch (OFF) and the refusal suffix |
| `seedling-bot-log.md` | `### Seedling hammer-phase BX — the shake band at the executor's checks` |
| **JSUT** at I2 `847b4ec8`, run **40219013174** | suite 22,834 passed / **2 failed** / 0 skipped; **slow battery 268 / 268**. The 2 reds are `seedlingSolverSurface.test.js` (i) and (vii), reading the surface table I had not yet rewritten (reproduced locally: 2 red at that blob, 66 / 66 with the `--write`). The D commit carries the table |
| **JSUT** at D `b9e40efe`, run **40225364377** | **suite 22,836 passed / 0 failed / 0 skipped; slow battery 268 / 268** (`d/jsut-40225364377.txt`) |

## 8. What the planner's harvest A/B should expect

**With the switch OFF (as shipped): no mover but text.**
- I2's suffix appears only on a press kill's *"nowhere to be"* whose last refuge search refused a candidate for the
  band. At the defaults that is none of 371's phases and none of L40's 47 page requests. With
  `PRESS_KILL_BOMBS=0` it is 371's 9 *"nowhere to be"* phases.
- A route sweep at the defaults should be byte-identical except where such a refusal is the answer.

**With the switch ON (the flip's A/B):**
- Only rooms where the chaser forecast meets a shake band can move. A band comes from a death's `rebootShake`, a
  player hit (`+5`) or a landing RockFall, while a forecast body is near the screen edge. On the route this is L40.
- Expect L40 only, and there:
  - `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` (371): about 30 of 45 phases solve,
    unchanged. The one band phase becomes the hold's named refusal; its answer depends on `seam.time mod 45`, so ×5
    samples give a rate.
  - `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` (368): at its captured seam a solve that
    stays a solve, the same plan. Only the dashless pass's refusal and the units (+24) move.
  - Every other L40 key: identical at its captured seam (46 of 47).
- **Gains** show only where a band phase is the answer. On the route that is 371's few phases (one in 45 at the
  defaults), so expect a refusal-text mover, not a new solve. The two solves measured need `PRESS_KILL_BOMBS=0`.
- **Should not move:** anything OFF (but I2's text); any room without a band; the 93 roster producers; the identity
  block; both slow capacity rows.
- **`standing-values`:** nothing new, no `--write`.

## 9. What the brief got wrong (measured)

1. **Line numbers:** `deriveRefuge`'s catch is at `solverBot.js:11419` (not ~10719), `refuseDanger` at 22790 (~19719),
   `probeCorridor` at 23313 (~20183), `execKillByPressOnce`'s refusal at 16606 (~15257). Same code, the file has grown.
2. **"371 … at census seam 5243":** still 5243, and the page's own seam at this base is 5242 (where it solves).
3. **"`probeCorridor` … seen on 371 at 3 phases with bombs OFF"** — yes, 5252–5254. But under the wait, 5254's band
   moves to a **third** site, the hold's paced-wait search (`planPacedWait`), which is not the executor's gate. Two named
   sites do not cover the band either.
4. **"(A) danger: … the executor's existing alternatives run: wait, retreat, re-plan":** at the gate there is no
   alternative. `refuseDanger`'s danger refusal ends the walk, so A is B with another name. At the probe the
   alternatives (the ladder's rungs) preview the same forecast and throw the band again.
5. **"(B) … a named `HAMMER_SAFETY` refusal":** the two sites are `walkTo`'s, used by every walk, not the press kill's.
   A `HAMMER_SAFETY` code there would also make any walk eligible for `HAMMER_FIGHT_FALLBACK` (its trigger code), in
   rooms with no hammer. B was measured with that code, but the shipped treatment is C, whose refusals are plain
   `SolverRefusal`s.
6. **"I2 row: the staged all-banded refuge (PKB's G1 shape)":** G1's shape calls `deriveRefuge` directly and never
   reaches `execKillByPressOnce`'s text. Staging A's kill asks no refuge before its first death, and a blanket band
   poison is caught first by the kill's `stepToward` and `strikeEscape`. The row uses the page's own all-banded state
   (371 at 5266, bombs OFF), cut to a 10 KB fixture.
7. **"a counter beside `shakeRefused` … in `pressKillGuards.js` if needed":** not needed. It lives beside the switch in
   `solverBot.js`, and `pressKillGuards.js` is untouched.
8. **Branch:** the designated branch is `claude/seedling-executor-shake-band-tnp9ij`.
9. **My own process, for the record:**
   - two parallel `>>` writers tore two long JSON lines in W0's fresh census. They were found by parse and re-run, and
     the census is one writer per file since;
   - the I2 push went out before the surface table's `--write`, which reds JSUT at `847b4ec8` (§ 7);
   - I committed W0's evidence under my own capture's box lock (`BOX_LOCK_COMMIT_ANYWAY=1`). That commit held docs
     only; the page loads none of them.

## 10. Residue and hand-overs

1. **The flip is the user's.** § 5 says it is ready; § 8 is the A/B's expectation. The planner runs the CI probes, TT and
   the route sweep / survey A/B (`workflow_dispatch` is 403 from here).
2. **A third band site:** `execHold → pacedHoldPlan → planPacedWait`'s forecast. It was seen on 371 at 5254 with the bombs
   OFF and the switch ON, after the walk's waits. PDS wrapped `planPacedWait` for deaths, not the band. A candidate
   (pacing) refusal is the natural shape there, and it is a hammer / fidelity call. The walk row's own `saw()`
   (`dangerNow` → `swordTickAt`, the same timed read as the gate) is a fourth reader of the same band, never seen to
   throw: the gate reads first, at the same tick and position.
3. **`HAMMER_FIGHT_FALLBACK`'s shadow divergence at 5230** (L371 residue 3) was not touched.
4. **The 371 request (530 KB) is not committed.** The 10 KB L40 cut is (`fixtures/hammer-bx-371/`), with its
   byte-identity measured at 5243, 5252 and 5266. The full capture and the 47 L40 requests stayed in the scratchpad.
5. **Hygiene:**
   - no stash, no force-push, nothing pushed to `main`;
   - no `pytest`, no unfiltered local vitest, no `standing-values --write`;
   - no AS3, wasm, gitlink, rules, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js` or
     `flashPanel/*` edit; no other switch flipped;
   - the venv got `requirements-headless.txt` (untracked);
   - the scratch worktrees (`m`, `i1`) are removed by name, and the dev server is killed by PID.
