# SEEDLING HAMMER-PHASE — slice SPINNER880 (L40 spinner@880,848 + unmetered wall time)

Session `seedling-hammer-spinner880` (Opus, cloud). Planner: `seedling-hammer-phase-planning-14`. Evidence:
`CC/docs/cloud-reports/seedling-hammer-spinner880-evidence/`.

## 1. SHAs

- Start: `origin/main` @ `5aaad790ebfd25a207c253afb7f72f2ecfe34386` (train 202). `origin/main` had not moved when this
  report was written, so no re-merge was needed (fidelity W56 had not landed).
- Branch: `claude/seedling-spinner880-l40-hi8yqf`. Head: this report's commit. The code commits are `a0f4b80c` (the instrument), `212449f4` (the
  switch) and `010b3de3` (the regenerated docs).

## 2. The answer first

- **The switch:** `PREVIEW_METER` (`SEEDLING_PREVIEW_METER=1`, OFF; `withPreviewMeter(enabled, fn)`). It runs in the
  **solve worker** (and in node). No main-thread mapper reads it.
- **The one thing to know first:** both defects have the same cause. The press kill re-derives its strike on **every
  driven tick** (`execKillByPressOnce` → `nextNow` → `deriveStrike` → per-cell `previewWalk`). The work clock only ticks
  at the `walk` site, once every 32 driven ticks. On L40 one work unit stood for **10–23 s** of node wall time.
  - 19:1: 98 % of 182 s sat in 16 such gaps.
  - 26:11: 97 % of 904 s sat in 48 such gaps.
  - In both, 93 % of the kill's CPU samples are `deriveStrike` → `previewWalk`, over 917 k and 9.95 M previewed states.
- **ON results** (node, 4-core cloud box, contended):

  | request | OFF | ON |
  |---|---|---|
  | 26:11 | 640 cut, **904–1013 s** | the same 640 cut (same answer `432ec5f5b196`), **38–43 s** |
  | 26:11 at the held 2560 retry | (not reached on the page: the 300 s backstop kills it first) | a 2560 cut, 209 s |
  | 19:1 | HARD "no step out", work 112, 207–210 s | a SOFT 640 cut, 69–78 s |
  | 19:1 at the 2560 retry | — | the same HARD corner text, work 1902, 169 s |

  So under ON the page reaches its held retry instead of the backstop. That is a named failure in place of the wall
  clock's.
- **Solved / hitless:** ON solves nothing new. The whole-game P1 census (147 captured requests) gives the same answer
  on 146 of 147: every plan is digest-identical, with more work counted. The only mover is 19:1, HARD → soft. No plan
  gains a hit.
- **The 880 corner:** I made no fix, because the class is not established as (a); see §3.2. It is phase-bound: across
  one hammer period of arrival clocks, **3 of 45** refuse HARD (−2, 0, +1), 1 solves (+5), and 41 are soft 640 cuts.

## 3. The reproduction (measured)

### 3.1 The wall-time profile (step 1)

The instrument is `scripts/procgen/profile-seedling-solve-wall.mjs`. It is a CLI and runs nothing on import. It replays
one captured request under two observers on the same monotonic clock:
- the solver's progress hook, with every deadline-site point stamped;
- V8's sampling profiler, with each sample attributed to the gap between two deadline-site asks it fell in.

`--focus=<fn>` prints the call tree under one function.

**P1 19:1** (budget 640), `prof-19-1.txt` and `prof-19-1b.txt`:
- Refusal at work 112 (56 + 56), wall 182 s: dashless 90.7 s, full 91.3 s. 147 k samples at 1 ms.
- Deadline-site points: 114, all at `walk`. Count points: 10,484 previews and 3,594 heartbeats.
- Per pass: 654 ticks, 5,242 previews, 916,848 previewed states, 0 search states.
- Gaps: 16 over 1 s, together 178.1 s = **97.8 %** of the wall. Every one is `walk -> walk`, and each is 10–21 s.
- The tree under `execKillByPressOnce` (121.7 k samples):

  | share | function |
  |---|---|
  | 93.0 % | `nextNow` → `deriveStrike` |
  | 81.1 % | → `measuredPair` → `walkTo` → `previewWalk` (inside it: `levelRun.step` 47.6 %, `spinRow` 14.8 %) |
  | 11.3 % | `deriveStrike`'s own `walkTo` |
  | 4.5 % | `deriveRefuge` |

  Self time: GC 17 %, then `solidCandidates`, `collidesSolid`, `liveRectOf`, `levelRun.step` and
  `nearestTileScanIndexed`, all inside the preview.

**P1 26:11** (budget 640), `prof-26-11.txt`:
- A budget cut at work 642, wall 904 s. The dashless pass took 904 s and was cut at `crusher-fork`; the full pass got
  1 unit and was cut at `walk`.
- Asks: block-route 279, crusher-fork 187, walk 178. Per pass: 4,256 ticks, 46,216 previews, 9,953,576 previewed states.
- Gaps: 48 over 1 s, together 880 s = **97.3 %**. Again all `walk -> walk`, up to 23 s each.
- The work units came mostly from block-route and crusher-fork. The wall, though, is the press kill under
  `approachKillForCorpse` → `execKillByPress` → `deriveStrike` → `previewWalk`, the same loop as 19:1.

The planner's FYI (FACE1, §9) describes this goal's cut as "shove stance (pushableblockfire@576,576) -> weigh: deadline
at the crusher-fork site". My profile matches on where the deadline tripped (`crusher-fork`). It does not match on where
the time goes: in this request, 26:11 as P1 captured it, 79 % of the samples are the press kill's per-tick strike
derivation.

**L43 flag12 5227:** I did not profile it OFF (≈ 10 min a run). Its ON row is in §5.

### 3.2 The 880 corner (step 2)

The full refusal (`full19.txt`):
- *"apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) —
  lands the player box on a body's 7x7 rect or on the 13 px hammer line … at (741.44,685.29) … There is no step out. the
  HAMMER-PHASE rung first saw this corner at t652, and from t654 NO PHASE admits a step: no hold of 1..44 tick(s) at any
  walk-offset -1..0 (0 tried) …"*
- *"The plain fallback (`OPP_PRESS_FALLBACK`) rewound to the kill's first tick (t0) and redid the kill with
  `OPPORTUNISTIC_STRIKE` off; it did not kill (HAMMER_SAFETY: … every key set … lands the player …)."*

What this says:
- At t654 the rung's preview corners at offset 0, the very next tick. There is no walk-offset before the corner to stall
  at, so the stall search tries nothing (0 tried). The step-out search proves that **no single key set** leaves the
  corner from that state.
- The rewind-and-redo without OPP corners too.
- The refusal is HARD because no deadline tripped, so the page's held retry never runs.

**The phase sweep** (`sweep19.jsonl`): `replay-seedling-solve-request.mjs --seam-time-sweep=-22..22`, one hammer period
(45) of arrival clocks around the captured 33487.

| arrival offset | verdict | work | node wall |
|---|---|---|---|
| −2, 0, +1 (3) | HARD "no step out" on `spinner@880,848` (`8ef0debe2bb9` ×2, `9d91691740df`) | 112 | 268–298 s |
| +5 (1) | **solves**: dashless, 1284 t | 641 | 16 s |
| the other 41 | soft 640 cut "before apitem (880,816) contact's corridor", mostly tripped at `kill-chaser` | 642–644 | 15–44 s |

So the HARD refusal rate over one period is **3/45**. When the corner fires, the solve is also the slow one: 112 work
units in about 5 minutes.

**Existing OFF switches** (`switches19.txt`), each ON alone on 19:1:
- **No change:** `HAMMER_BODY_GATE`, `CHASER_SPINNER_WALLS`, `SPINNER_POINT_EXACT`, `PRESS_ESCAPE_EXACT` and
  `STRIKE_IFRAME_LAPSE` keep the same HARD refusal, `8ef0debe2bb9`.
- **Soft 640 cuts instead, no solve:**
  - `HAMMER_APPROACH`: 14 s; the dashless pass refuses the same corner at another spot, (747.89,724.77).
  - `HAMMER_FIGHT`: 23 s, cut at `hammer-fight`.
  - `SHOVED_BODY_LOOKAHEAD`: 72 s, cut at `kill-chaser`.
  - `HAMMER_FIGHT_FALLBACK`: 74 s.

**Class:** I could not establish it in this slice.
- In the model, the corner at t654 is real: the step-out search covers every key set.
- One arrival four ticks later (+5) solves, so the model admits a hitless kill near this one. That points at the
  approach the solver chose (an (a)-shaped question: an earlier, different approach).
- But no measurement here shows a hitless line from **this** arrival. No variant I ran (the switches above, the no-OPP
  fallback) found one.

Per the boundaries, I made no corner change. The next step would be a space-time search for a hitless kill from the
t0 state of 19:1.

## 4. Design and change; OFF identity

**`PREVIEW_METER`** (`solverBot.js`, beside `WALK_CHECK_TICKS`). New functions plus one call site, no reformatting:
- `meterPreviewStates(n)`: one line at `previewWalk`'s return. Under the active deadline, and only if it opted into fine
  checkpoints, it adds the samples to `deadline.previewStates`.
- `previewUnitDue()`: one call site in `solveSegment`'s drive, beside the existing `walk` ask. It asks `walk` once more
  for every `statesPerUnit` (1024) uncharged states. A trip refuses through `refuseWalkDeadline`, by name, with the
  clause *"on the previewed states the drive spent (PREVIEW_METER: one ask per 1024)"*. That makes it a budget cut, so
  the page's held retry machinery sees it.
- With no deadline, or one without fine checkpoints, nothing is counted and nothing is asked.
- Generic: no level, coordinate or Seedling constant. 1024 is a work-clock rate: a previewed state costs about 0.07–0.12 ms
  here and a walk unit is 32 driven ticks of ~2–3 ms, so 1024 states cost about one walk unit.
- Instrument: `PREVIEW_METER_COUNTS` (states, asked, tripped).

Other edits:
- `solverEnvChannel.SOLVER_ENV_NAMES` gains `SEEDLING_PREVIEW_METER`.
- Page timers and the backstop are untouched: no `flashPanel/*`, no `seedlingWasmPlayback.js`.

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| run | md5 |
|---|---|
| base | `391322d681b7aa0229d94b3f6906d024` |
| branch, OFF | `391322d681b7aa0229d94b3f6906d024` |
| branch, ON | `391322d681b7aa0229d94b3f6906d024` |

ON matches too: acceptance solves without a budget, so the meter is inert there by construction.

## 5. Rows and bounded vitest

New file `frontend/modules/seedlingDemo/previewMeter.test.js`, **4/4 passed** (54 s), on the L18 press kill
`r9-solve-18`:
1. Ships OFF.
2. OFF counts nothing. ON with ∞ states per unit is OFF byte for byte, with the same `shouldStop` calls. ON with the
   default gives the same answer and exactly `asked` more calls.
3. With OFF's own total as the budget, ON trips where OFF did not.
4. With no deadline, or one without fine checkpoints: nothing counted, OFF's answer.

Other bounded runs:
- `solverEnvChannel.test.js`: 11/11.
- `frontend/modules/procgenDocs/`: 8 files, 497/497.

Regenerated, with `--check` green:
- `census-seedling-solver-surface.mjs` (374 rows, unchanged);
- `generate-procgen-reference.mjs` (the instrument's row);
- `generate-docs-index.mjs`.

**Captured requests, ON vs OFF** (node; `census.jsonl`, `census-compare.txt`, `tools/census.mjs`): every P1 request, 147
of them across 26 legs. OFF reproduces the page's own answer on 146/146 (26:11's page answer is the backstop's
"cancelled", so it has no answer to compare). ON vs OFF:
- **146/147 identical answers.** Plans are digest-identical. Work goes up where previews were heavy, for example 9:8 817
  → 965 and 26:9 2099 → 2233; none crosses a budget that turns a plan into a cut.
- **Mover:** 19:1, HARD refusal (work 112) → soft 640 cut (work 642).
- Total node wall: **1,507 s OFF → 330 s ON**. Leg 26 (Boss Key 2): 1,095 s → 108 s. Leg 19: 211 s → 79 s.

**L43 flag12 5227 at 2560** (`on-l43-5227-2560.txt`; fixture `hammer-cleartag-chain/leg872-l43-l40-request.json.gz`
re-stamped):
- ON **still solves, hitless in the model** (0 hits, 0 deaths), but with the **dashless** plan (2160 t, work 1303). The
  full pass is now cut at 2560 (`kill-chaser`). OFF's plan per L40-PAIR is the full pass's 2068 t `5615506525c2`.
- That is a **plan change** (92 ticks longer, still hitless), not a loss.
- Wall: 801 s on this contended box, against L40-PAIR's 614–637 s OFF. I did not run an OFF control on this box, so I
  draw no conclusion about the wall.

**Survey `--through=end`:** not run. The survey solves without a budget or deadline (`survey-seedling-route.mjs` reads
no `budgetWork`/`withSolveDeadline`). So the meter cannot reach a survey step, which is the same reason acceptance ON is
byte-identical. No survey step can gain a hit from this switch.

## 6. Page play / game witness

None. ON solves no request that OFF does not (§5), so there is no newly solved plan to witness.

## 7. Census: which seed-1 sweep legs can move, by KEY

The switch acts only on a solve that runs under a fine deadline (the page path, the divergence sweep's legs, captured
requests), and only after at least 1024 previewed states. Measured on the whole-game P1 legs:
- **Moves (verdict):** `Level 040 - Chest` (19:1, and the 880 arrivals of the same goal generally). HARD → soft, so the
  page runs its held 2560 retry, which returns the same HARD corner.
- **Moves (wall only, same answer):** `Level 040 - Boss Key 2` (26:x, collect bosskey@656,528): 26:11 drops from 904–1013 s
  to 38–43 s, under the page's 300 s backstop. Also `Level 025 - Chest`, `Level 029 - Boss Key 1` and
  `Level 030 - Torchpickup`, each faster by 2–3×.
- **Can move plans:** a solve whose full pass ends within 1024 × (its preview units) of its budget. Measured once:
  `level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` at clock
  5227 / 2560 now keeps the dashless plan, 2160 t instead of 2068, still hitless.

I did not re-run the divergence sweep's other L40 legs by key (`flag12-L39`, `chest-L39`). Their seam rows are the
L40-PAIR evidence's.

## 8. What the brief got wrong (measured)

- *"work 112 but ~150 s wall clock"* is right in kind. Here it is 182–210 s node, and 268–298 s under 3 parallel jobs.
- The brief framed the 880 refusal as the walk's stop in 2 of 5 runs. Over one period of arrival clocks it is **3/45**.
  Most arrivals are soft cuts, and one solves.
- "Unmetered wall time" is not a fork-replay, ladder-rung or key-set enumeration cost. In both requests it is the press
  kill's **per-tick** `deriveStrike` previews: 93 % of the kill's samples.
- 26:11's work units come from block-route and crusher-fork, but its wall is the same press-kill loop.

## 9. Residue and hand-overs

- **The 880 corner:** class not established (§3.2). The next step is a hitless-kill search from 19:1's t0 state, or an
  approach choice that avoids the corner at the arrival phases −2/0/+1. No fidelity hand-over: nothing shows the model
  is wrong.
- **Cheaper, not just metered:** the per-tick `deriveStrike` re-previews each cell from scratch every tick. A cache
  carried across ticks (F1c's `clearAhead` pattern) would cut the wall itself. That is not byte-inert, so it is a
  separate slice.
- **Before any flip:**
  - the divergence-sweep legs by key, ON vs OFF;
  - an OFF control for L43 5227 on one box;
  - the page path: the meter's soft cut puts 19:1 on the 2560 retry, so on the page that leg now spends ~3 minutes of
    retry before it stops (measured in node: 169 s).
- The planner's FYI (FACE1 §9): I followed it as information only. My 26:11 is P1's capture, not FACE1's
  `next-bk2-*` repro, and I did not run theirs.
- Scratch tools (`tools/`) are the evidence's own: the census driver, the full-message replay and the comparison.
