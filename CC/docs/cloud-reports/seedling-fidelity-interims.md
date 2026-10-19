# seedling-fidelity-interims — the producer INTERIM pins, retired by game-checked re-records

Planner `seedling-fidelity-planning-9`, wave 19. **No model, solver, walker or `CONTACT_FIDELITY` change.**
⚖ Licence: the user (2026-10-18) chose "INTERIMS retire": game-checked re-records of these producers' own tapes.

| | |
|---|---|
| Start SHA | `4667f7e353` (= main: DIGEST) |
| Head | the commit carrying this report (code head `7b95f29481`) |
| Harness branch | `claude/seedling-fidelity-interims-brvjto` (the brief's `seedling-fidelity-interims` is the harness's branch here) |
| Box | 4 cores, Node 22.22.0, `SEEDLING_PORT=9695` (+ a temporary :8000 for `r7-ends-meet`) |

**Outcome.**
- D1 PASS.
- D2: **6 of 9 producers retired (5 whole, u10 for its admitted arm), 10 tapes moved, every one recorded on the game.**
  3 STOP: bobsoldier2, f1-l5-open-lock, l40button-witness.
- D3 PASS.
- Final gate: **62/62 `plan-seedling-*.mjs --check` GREEN**.

**The one thing to know first:** every ON plan I recorded reproduces on the game, including the plans of the three
STOPPED producers. Those three stopped for other reasons: a control's meaning changes, another instrument's game fixture
reads the old tape, or the defaults refuse (l40button). Game fidelity was not the reason.

## W0

- `git status` clean at `4667f7e353`; `session_bootstrap.sh --seedling` → `READY`.
- Census at the base: all nine pinned producers `--check` GREEN (`evidence/logs/*.pin.log`).
- **Bounded vitest:** 74 files (the brief's list, plus `fidelityStance`, `fidelityL30KeyLock`, `hammerDashShape`,
  `spearPush`, `tapeRunner`, `reachClosure`, `fidelityEncounters2`, `fidelityWaypointSlide`, `seedlingConstantsCensus`,
  `seedlingSolverSurface`).
  - BEFORE (a base worktree): 2522 + 2 skipped. Four files first failed for want of the `shared` submodule in the
    worktree; with it symlinked they pass 57/57. The 2 skips are wasm-gated rows (the worktree has no wasm).
  - AFTER (head): **2524/2524**.
  - Summaries: `evidence/vitest-{before,after}.summary.txt`.
- `check-procgen-reference`: `registry.js DIFFERS` at the base and at the head. This is the box effect the producers
  report named; I committed no `registry.js`.
- Identity block, the surface and the constants are not touched: the diff has no module or solver change.
  tapeRunner's **617 pairs pass** at the head; the pairs are what the moved expectations feed.

## D1 — the census (PASS)

Each producer was copied to a scratch file with its pin set to `{}` and its writes sent to the scratchpad, then planned
at the defaults and diffed against the base. Every number matches the producers report's STOP table to the tick.
Evidence: `evidence/census-d1.tsv` and the `evidence/logs/*.unpin.log` files.

| producer | tape | ticks base → defaults | own `--check` rows at the defaults |
|---|---|---|---|
| stance-witness | stance-l46-chest | 1044 → 868 | green |
| stance-witness | stance-l48-chest | 540 → 449 | green |
| stance-witness | stance-l48-keylock-open | 454 → 231 | green |
| stance-witness | stance-l48-keylock-south | 369 → 322 | green |
| stance-witness | stance-l48-keylock-north | does not move | green |
| axe-witness | axe-l48-reach-l49 | 368 → 330 | green; the other 3 tapes do not move |
| l30keylock | l30keylock-pit224 | 347 → 320 | green |
| l30keylock | l30keylock-pit240 | 360 → 341 | green; `-before` does not move |
| pushblock-witness | pushblock-l65-reach-l68 | 347 → 345 | green; the other 2 do not move |
| ladder2-witness | ladder2-l104-beam | 278 → 261 | green; `l59-grenade` does not move |
| u10-puncher-dwell | u10-puncher-dwell | 200 → 200 (the keys move) | the dwell's rows are green |
| u10-puncher-dwell | u10-puncher-dwell-refused | 34 → 50 | **2 FAIL**: the positive control is admitted, not punched |
| bobsoldier2 | bobsoldier2-l30-dash-stance | 145 → 168 | **2 FAIL**: the OFF arm refuses later (reach-exit) |
| bobsoldier2 | bobsoldier2-l30-torch | 460 → 395 | the kill is on the walk from (72,88), not a dwell at (88,56) |
| f1-l5-open-lock | f1-l5-open-lock-bait | 437 → 90 | **2 FAIL**: the arrival detours where it declined |
| l40button-witness | — | THROWS | `lobberHoldRefusal` (bombpusher@112,128, 131-tick hold at (279,216)) |

## D2 — the game check, per producer

**Method.**
1. Copy the defaults' tape into the tree.
2. Run `SEEDLING_PORT=9695 node scripts/procgen/check-seedling-bot-differential.mjs --record --only=<names>`. It uses a
   FRESH page per tape and runs on p4f, headless.
3. Every tape got the instrument's own row: "⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE"
   (`evidence/logs/rec1.log`, `rec2.log`).
4. tapeRunner's pairs then replay each recording at 0 px (617/617 pass).

### Licence rows (one per moved tape)

The md5s are first-8 of the tape and its expectation, base → head.

| tape | ticks | tape md5 | expectation md5 | game-checked |
|---|---|---|---|---|
| stance-l46-chest | 1044 → 868 | a529dd86 → 89b0746d | 6f2aa7e2 → f690144b | **yes** (869 obs) |
| stance-l48-chest | 540 → 449 | 43957a97 → 2bd9bd45 | 79f760c5 → 508a7578 | **yes** (450) |
| stance-l48-keylock-open | 454 → 231 | e7b3c216 → 1665e25a | 9a21d586 → 158a2803 | **yes** (232) |
| stance-l48-keylock-south | 369 → 322 | 088c2fc1 → e6f165ed | e367dee0 → 9d8972dc | **yes** (323) |
| axe-l48-reach-l49 | 368 → 330 | 1c16f5a5 → 8e513ead | e89dbed4 → 0f66be25 | **yes** (331) |
| l30keylock-pit224 | 347 → 320 | d607a3e3 → d5db7a52 | 8855fe16 → feb35a9a | **yes** (321) |
| l30keylock-pit240 | 360 → 341 | 66a96bcf → 52757e26 | e1cf6a2e → b8fb4538 | **yes** (342) |
| pushblock-l65-reach-l68 | 347 → 345 | f108f9db → 1d83a5b0 | 9cfe664b → fdd9793a | **yes** (346) |
| ladder2-l104-beam | 278 → 261 | 9b8fd795 → 727d0c7a | 2fe0f4a1 → d469c2c4 | **yes** (262) |
| u10-puncher-dwell | 200 → 200 | 1458edf0 → a7717921 | c3dd45de unchanged | **yes** (201; byte-identical stream) |

### Commits

| commit | producer | change |
|---|---|---|
| `942ac95d` | stance-witness | pin retired; fidelityStance's chest and keylock-open rows drop their `waypointSlide: false` |
| `fb0f30f2` | axe-witness | pin retired |
| `a3afd9e0` | l30keylock | pin retired; fidelityL30KeyLock: D1 landmarks re-pinned and the both-ON rows run the defaults (see below) |
| `3c33e4c4` | pushblock-witness | pin retired |
| `ab62e4ef` | ladder2-witness | KILLLOCK pin retired |
| `8dc55add` | u10-puncher-dwell | admitted arm at the defaults; the control's lapse-OFF pin is scoped and named (below) |

In each producer, the INTERIM docblock is replaced by a `⚖ RETIRED 2026-10-19` line that names the switch and the
old → new tick counts.

**fidelityL30KeyLock re-pins:**
- D1 landmarks: pit224 `{touch 252, open 331, bodyGone 191}` → `{225, 304, 184}`.
- D1 landmarks: pit240 `{265, 344, 207}` → `{246, 325, 197}`.
- The both-ON kill: stance (88,120) → (88,88). Ticks/bound 26/57 → 25/56 (224) and 31/62 → 23/54 (240).

### u10: a partial retirement

**What retired.** The admitted arm, `u10-puncher-dwell`, is planned at the defaults and was recorded on the game.

**What I kept, and why.** The positive control, `u10-puncher-dwell-refused`, keeps `strikeIframeLapse` OFF. The pin
is scoped to that arm and named as the control's own setting, not as an interim.
- At the defaults the lapse lets the presses kill the puncher before its wind-up ends.
- So the forecast admits (400,248). It also refuses **none of 56 stances** by the punch: an 8 px grid round the body,
  x 384–448, y 232–280 (`evidence/u10-control-search.{sh,txt}`).
- The punch pricing that the control proves does not read the lapse.

The ON control tape (50 t, no punch) also reproduces on the game. It is in `evidence/stopped-on-recordings/` and is not
committed. ⚖ **The user decides at the harvest** whether this scoped pin is acceptable, or whether the control should
be re-thought: for example a stance without the strike policy.

### STOPPED

**bobsoldier2 (STOP; pin kept).** At the defaults:
- `bobsoldier2-l30-torch` 460 → 395: the body is killed ON THE WALK from (72,88) (`killedOnWalk`, dwell 0/10). The
  producer's row asserts a dwell kill from (88,56).
- The BEFORE arm (`-dash-stance`, the old switches OFF) no longer refuses on the dwell. It refuses at the reach-exit
  instead ("the danger map forbids (72.65,66.46) — chaser:bobsoldier@48,80"), after 168 t.
- `pickup-removal-witness.json` (encounters2 D3, `probe-seedling-encounter-ticks`) holds the GAME's `hasTorch` tick for
  the OLD torch tape (gameObs 226). That is another instrument's game fixture, so per the brief it is a STOP.
- `fidelityBobSoldier2`'s D2b rows probe the old dwell's stance.
- Both ON tapes reproduce on the game (169 and 396 obs): `evidence/stopped-on-recordings/`.
- **To retire:** re-probe the pickup tick on the new torch tape; decide what the BEFORE witness means once the lapse is
  ON (or scope its pin as a control, like u10); restate the dwell rows.

**f1-l5-open-lock (STOP; pin kept).** The producer IS the `baitForecast: false` control's witness (the arrival
DECLINES).
- ON, the arrival detours: 437 → 90 t, zero hits.
- `fidelityF1` already carries the detour as its ON row.
- `f1-bodies-oracle.json` holds the game's Bob readouts along the 437-t tape.
- The 90-t detour reproduces on the game (91 obs, in the evidence).
- **Proposal:** relabel the pin from INTERIM to the control's permanent setting (no tape moves). Or add a second,
  ON tape for the detour, with its own oracle probe. The user decides.

**l40button-witness (STOP; pin kept; a model gap for the planner).**
- At the defaults, `l40button-l41-part0`'s solve THROWS `lobberHoldRefusal`: the hold stands still up to 131 t at
  (279.4,215.6), inside bombpusher@112,128's 256 px reach. A Bomb's Explosion lands at (284,217) 56 t in. ("A hold
  cannot move, and no verb waits while moving".)
- Measured with `SEEDLING_MOVING_WAIT=1` (node only, not shipped):
  - `l41-part0` solves: 1543 → 1601 t.
  - `l42-part0` THROWS in `levelRun`: "the Explosion of bombpusher@112,128#11 at (250,160) on tick 1339 in level 40
    reaches the spinner spinner@192,160 — `Enemy.hit(4, …, 1)` is not staged on a bomb's blast".
  - That is **BOMBBLAST's** region (the Explosion's `"Enemy"` arm). This producer retires after BOMBBLAST plus a
    `movingWait` decision.

## D3 — the knock-on (PASS)

- Roster pins (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`) and `r8Acceptance`:
  green with no re-pin. None of them pins these tapes' tick counts in an assertion.
- `r8Acceptance.js`: the exposure rows' descriptive `ticks` were updated in place. Same rows, values only:
  - stance-l48-keylock-south 369 → 322
  - ladder2-l104-beam 279 → 262
  - l30keylock-pit224 347 → 320
  - l30keylock-pit240 360 → 341
  - pushblock-l65-reach-l68 348 → 346
- `generate-tape-index.mjs`: `tapes/index.json` regenerated (9 rows). `--check` is green.
- Every vitest that reads a moved tape (`grep -a` by name) is in the bounded set and green:
  fidelityStance, fidelityAxe, hammerDashShape, fidelityL30KeyLock, fidelityLadder2, r8Acceptance, the roster pins,
  tapeRunner, reachClosure.
- `seedling-bot.md` names the L30 re-record and u10's scoped control.
- The docs index was regenerated for that doc's word count. CI shard 2/3 at `7aef99fcd` failed
  `procgenDocs/generated.test.js` on it; fixed in `7b95f29481`.
- **Pins moved (all of them):**
  - fidelityStance: 2 rows lost `waypointSlide: false`.
  - fidelityL30KeyLock: D1 landmarks ×2, and the both-ON rows ×2 (pin dropped, stance and ticks).
  - r8Acceptance: the 5 `ticks` values above.
  - `tapes/index.json`.
- Not moved, and stale as measurements only (they list names; no test reads these tapes' bytes):
  `seedling-entity-witnesses.json`, `seedling-profile-witnesses*.json`, `dead-frame-observations.json`
  (u10's loads/dead are unchanged).

## Final gate

`plan-seedling-*.mjs --check`, all 62, 3 at a time, at `7aef99fc` (the producers are unchanged after it): **62/62
GREEN**, zero FAIL rows (`evidence/check-head-7aef99fc.tsv`). The hammer arc's earlier reds (`r9-l0-sword-dash`,
`r9-l6-sword-dash-hit`) are green at this base. `r7-ends-meet` is green with the temporary :8000 server.

## Survey / sweep rows this moves

**None.** No model, solver, walker or switch default changed. The survey and the sweep derive their legs from the
presets and never read these tapes. No survey or sweep A/B is owed.

## Dispatches for the planner

The JS arc agreed these; I cannot dispatch.
- `seedling-probe.yml`, `battery=standard`, ref `claude/seedling-fidelity-interims-brvjto` (head). No battery entry
  names a moved tape (`grep -a` on `seedling-probe-batteries.json`), so I expect no movement.
- `seedling-full-tier.yml`, ref the same: the differential's full tier replays every tape against its expectation. It
  is the CI confirmation of the 9 re-recorded expectations and the u10 tape.
- `test-templates`: not owed. No in-app row or substrates config names a moved tape.

## JS arc / hammer arc

- **JS arc:** none of its pins moves. Nothing to wire. No new staging/result field and no new obstacle kind.
- **Hammer arc:** nothing handed over. The l40button finding goes to **BOMBBLAST** (the Explosion → Enemy arm),
  not hammer.

## What the brief got wrong (measured)

- "Each producer, one commit, retire": three of the nine cannot be plain re-records. Two are tied to controls or to
  other instruments' game fixtures; one refuses at the defaults. The producers report had already said bobsoldier2,
  u10, f1 and l40button "change meaning".
- l40button's retirement does not wait only on `movingWait`. With it ON, the next tape throws on BOMBBLAST's arm.

## Residue

- The three STOPs above, and u10's scoped control pin: the user decides each at the harvest.
- `registry.js` regenerates differently on this box (as at the base).

## Byte-inertia

`git diff 4667f7e353..HEAD --stat` touches:
- 6 producers;
- 10 tapes and 9 expectations;
- `tapes/index.json`;
- `r8Acceptance.js` (data values);
- 2 test files;
- `seedling-bot.md` and `seedling-bot-log.md`;
- the procgen README and `docsIndex.js` (generated);
- this report and its evidence.

No module logic, workflow, gitlink, wasm or rules file changed.

## Rows to BANK

- The licence table above: 10 rows, all game-checked yes.
- Final gate: 62/62 `--check` green at `7aef99fc`.
- Bounded vitest AFTER: 74 files, 2524/2524.
- CI `JavaScript Unit Tests` at the code head `7b95f29481` (run 39183811356): **20992/20992**, slow battery 254/254. The
  earlier head `7aef99fcd` was 1 red (the docs index word count), fixed by `7b95f29481`.
