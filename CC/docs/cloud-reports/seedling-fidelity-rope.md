# Seedling fidelity ROPE — a `rope` verb that cuts a rope to clear its flag

| | |
|---|---|
| Session | `seedling-fidelity-rope` (planner `seedling-fidelity-planning-9`, wave 22) |
| Start SHA | `85a5c1a25d` (= main at the brief) |
| Harness branch | `claude/seedling-rope-verb-855tom` (the brief's `seedling-fidelity-rope` is this branch; nothing pushed elsewhere) |
| Port | 9709 (the pristine base worktree's own server: 9710) |
| Verdicts | **W0 PASS · D1 PASS (cited + re-run, nothing re-recorded) · D2 PASS behind a switch, OFF — STOP for the flip licence (movers named) · D3 PASS** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-rope-evidence/` |

## The one thing to know first

**The verb exists and solves both rope goals, but it ships behind a new switch, `CONTACT_FIDELITY.ropeCutVerb`, which is
OFF.** The brief allowed an unconditional row only if it moved nothing on main. It does move something. A rope is
`type = "Rope"`, which is in the player's solids, so the frontier names a rope's span `solid:rope`. Four main survey steps
(L39 `rope@96,384`) refuse today with "No strategy row exists". With the row they move. They still refuse, but later in
the room: past the cut, at `cover@112,144` on the way to `wandlock@144,64`.

With the switch ON, the JS arc's mapping needs no edit:
- `clearTagVerbOf('solid:rope')` answers `{verb: 'rope', registered: true}`.
- `flag:L16:0` and `flag:L28:0` map to `{kind: 'clear-tag', tag: {level, tag}, at: {x, y}, obstacle: 'rope@x,y'}`.
- On `rules-rope-events` + this branch, survey step 24 goes from REFUSED `no-verb` to SOLVED (273 t).

## W0 — the base (PASS)

Measured in a pristine detached worktree of `85a5c1a25d`.

| row | result |
|---|---|
| identity block (`identity-block.sh`, venv active) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, **r9-campaign `0dd65640` exit 0** (green at this base); reference: 4 regions DIFFER (environmental: registry, capabilities, the two capability charts) |
| surface / constants / entities / profile / roster | GREEN 338 · PASS 6,847 · PASS 566 · PASS 138 (both) · 289 (`index.json` `b945a1a9`) |
| tapeRunner pairs | 635 `e164838673a48b38ce187093c363edb2`, 0 non-pass |
| bounded vitest BEFORE | 95 files (`w0/vitest-files.txt`; the brief's list plus every test that greps `STRATEGY_EXECUTORS`, `OBSTACLE_STRATEGIES`, `'clear-tag'`, `execPull`, `deriveSwingStance`, `ropePulls`, `CONTACT_FIDELITY_KEYS`, `pullRope`, `rope@32,16`, `rope@160,64`): **2,529 / 2,529** |

The brief's `apReportBosses` test file does not exist. Its readers are `solverEncounter.test.js` and
`fidelityEncounters2.test.js`, which are in the set.

## W0 (b) — the stop, reproduced on `rules-rope-events` (`52bccca51b`, a throwaway worktree)

`runtimeEventsOf(AP_1_rules)` yields two rope events:
- `flag:L16:0`, side `level_16__r1c1`; its action silences arrow traps 96/112/128,32.
- `flag:L28:0`, side `level_28__r0c6`; its action holds `fallrock@112,240`.

`atlasEventGoal` → `solverGoalFor` refuses both with *"… the solver's clear-tag refuses it — no-verb: no strategy row
exists for solid:rope …"*. That is the walker string `wasmArrival` wraps as "the solver has no goal for …". The survey
there asks the L16 goal at step 24 (`clear-tag(L16 flag 0: rope@32,16 cleared) then reach-pit(pit@192,48 → L17)`) and
refuses it the same way (`d3/merged-survey-24-26-off.tsv`).

## D1 — the cuts on the game (PASS; cited, re-run, nothing re-recorded)

- **rules-2's `probe-seedling-rope-events.mjs`**, run from the throwaway worktree against this session's 9709 (p4g,
  headless logic-only): **7 / 7 PASS** (`d1/probe-rope-events-9709.log`).
  - L16 cut from the L15 side. This is `r9-solve-16`, which the PULL rung already plans: the stance is west of the rope,
    the cut writes {16,0}, the three lanes are crossed with 0 hits, and the run exits to L18.
  - L28 cut by the Sword, and by Fire alone. Each writes {28,0} and {28,1} on the same frame.
  - The no-item control cuts nothing.
  - A later visit with the rock down crosses the lock. The control (lock stands) does not, and {28,1} alone builds the
    rock fallen.
- **Fidelity F7's `probe-seedling-f7-reentry.mjs`** (the persistence a revisit reads): with {16,0} the game's stream is
  the model's at 0 px in both arms. Without it the traps fire (`d1/probe-f7-reentry-9709.log`).
- The verb's own plans on the game are in D2.

## D2 — the verb (PASS behind `ropeCutVerb`, OFF)

**Change** (`solverBot.js`, my functions plus added rows only; nothing reordered):
- `OBSTACLE_STRATEGIES['solid:rope'] = 'rope'` and `STRATEGY_EXECUTORS.rope = execRope`. Both are `switchGatedRow` rows,
  as Lights' and the bosses' are: non-enumerable, and absent while the switch is OFF.
- `resolveRopeStrategy`:
  - the stance is the PULL rung's `deriveSwingStance` with its danger-free admission, hoisted unchanged as
    `pullStanceAdmit` (the rung now calls the named function);
  - `held: false` by name for: a rope already pulled (this visit or `bootPulled`), a primary that is not the sword, or a
    rope with no group.
- `execRope` is `execPull` (aim, press, group latched), then the run's `ropePulls` row asserted. There is no second cut.
- `execClearTag` gains two gated arms:
  - `ropeWritten()`: the rope's clear-tag finishes on its `ropePulls` row (see below);
  - a rope booted pulled is `already-clear`.
- `resolveObstacleStrategy` dispatches `rope`.
- `contactFidelity.js`: `ropeCutVerb: false`, plus `SEEDLING_ROPE_CUT_VERB=0|1`.

**Measured, and the brief was wrong here:** "it finishes when the rope's flag is in `earnedClears`" cannot hold.
`levelRun.earnedClearsNow` has no rope arm. `pullRope` banks the flag for the next build (`pendingEarnedClears`) and
writes `ropePulls`, so after L16's and L28's cuts `earnedClears` holds no {16,0} or {28,0}. This is pinned in
`fidelityRope.test.js`. The finish reads `ropePulls` for the flag, past its tick (`clearTagLanded`'s generic arm). The
game holds the flag from pull + 1, which the witnesses confirm.

**Goal shape accepted (for the JS arc):** `{kind: 'clear-tag', tag: {level, tag}, at: {x, y}, obstacle: 'rope@x,y'}`.
This is `eventSolverGoal`'s output unchanged. `at` is the rope's OEL `x,y`, the solid's `x,y`.

Refusals are `obstacle.kind 'clear-tag'`:
- `no-verb` while the switch is OFF;
- `cannot-act` (no sword, or the Spear alone);
- `unresolved` (no reachable stance);
- `already-clear` (booted pulled).

**Witnesses** (p4g, headless, 9709): `probe-seedling-rope-verb.mjs --record` → `fixtures/rope-witness/`. Each is the
solver's `twoPassSolve` plan with the switch ON, plus a 4-tick idle tail, played on a fresh page and compared per tick.

| witness | plan | on the game |
|---|---|---|
| `rope-l16-cut-cross` | `r9-solve-16`'s staging, clear-tag {16,0} then `stairsup@352,80`: 655 t (the stance walk's strike cuts it at t90) | 659 ticks at 0 px, {16,0} at t91, **0 hits across the lanes**, L18 |
| `rope-l16-verb` | boot (72,40): `execPull`'s own aim and press t26, pull t27 | 32 ticks at 0 px, {16,0} at t28 |
| `rope-l28-cut` | L25 arrival (96,16), the Sword alone: 52 t (cut t44) | 56 ticks at 0 px, {28,0} **and {28,1}** at t45 |

**Test:** `fidelityRope.test.js` has 14 rows: the switch, OFF no row / no-verb, ON L16 / L28 / verb arm / already-clear /
no sword / spear, and the three witnesses replayed at 0 px plus re-planned byte-for-byte.

Mutants (predicted in the file header, copy + restore):

| mutant | predicted | measured |
|---|---|---|
| m1 `ropePulls` assertion inverted | the verb row reds | **red as predicted**, plus `rope-l16-verb`'s witness row (its plan refuses) |
| m2 `ropeWritten` dropped | every ON SOLVES row reds `not-written` | 6 red, as predicted |
| m3 the `bootPulled` arm removed | `already-clear` reds | red, as predicted |
| m4 the weapon gate removed | the no-sword and Spear rows red | red, as predicted |

**Pins my change moved (in-slice):**
- `contactFidelity.test` defaults (+`ropeCutVerb: false`);
- `entityBlocks.js` `pulledRopes.solverReads` (+`solverBot`), and its row in `seedling-solver-surface.md`;
- `boxLock.test` enrolment of the new probe;
- surface census `--write` (338 rows, GREEN; reads moved in `run:entities/ledger/level/progress/state/world`,
  `world:arrowTraps/solids`, `state:x/y`, `CONTACT_FIDELITY`, `SLASH_REACH`);
- reference regenerated (instruments 452, the docs word count).

`contactFidelityHook.test` derives a settings row for the new switch automatically (+1 row, green).
`KNOWN_STRATEGY_VERBS`, the R8 derivation rows and the catalogue's pending list are untouched: the row is
non-enumerable, as for Lights and the bosses. These are owed at a flip.

## The survey / sweep rows this moves (before → after)

**Route survey** (local, `survey-seedling-route.mjs --through=end --route=full --only=…`, this base's step ids; compare by
(level, goal, boot)). OFF is identical to the base on all seven rope-level steps:

| step | level · goal | OFF (= main) | ON |
|---|---|---|---|
| 20 | L16 → `stairsdown@112,64` (L17) | SOLVED 124 t | SOLVED 124 t |
| 22 | L16 → `stairsup@352,80` (L18) | REFUSED (the armed lane at (120,56)) | same |
| 33 | L16 → `stairsup@352,80` | SOLVED 655 t | SOLVED 655 t |
| 73 | L39 totem + exit | REFUSED "solid:rope … No strategy row exists" | REFUSED: the cut is made; the walk then stalls on `cover@112,144` toward `wandlock@144,64`'s hold stance |
| 103 / 144 / 164 | L39 → `teleporter@144,0` | REFUSED "solid:rope … No strategy row" | REFUSED as 73 (wandlock hold stance) |

On `rules-rope-events` + this branch (D3): step **24** goes from REFUSED `no-verb` to **SOLVED 273 t**. Step 26 is SOLVED
516 t in both arms.

**Divergence sweep:** not run here (no dispatch). OFF is byte-inert by construction: the gated rows read `undefined`,
`ropeWritten` returns null, and `pullStanceAdmit` is the same expression. This is backed by identity OFF = W0,
tapeRunner pairs = W0, and the survey OFF = base. ON can move the L39 legs (the frontier rope) and any L16 leg whose
corridor meets the rope's span. There are 28 rope-level legs (`d2/sweep-rope-level-keys.txt`):
- L16: 200–218;
- L28: 304–309;
- L39: 376–378.

## CI dispatches for the planner

1. **Route survey full on this branch (OFF, = main):** `seedling-survey.yml`, branch `claude/seedling-rope-verb-855tom`,
   `through=end`, `route=full`. Expect = run 39496129402 modulo the rules moves since (L39's four steps keep "No
   strategy row exists").
2. **Route survey ON:** the same with the switch ON (the survey workflow's contact-fidelity input if it has one;
   otherwise `only=73,103,144,164,20,22,33` with `shards` ≤ 7 and `SEEDLING_ROPE_CUT_VERB=1`). Expect: only the four L39
   rows' refusal text moves.
3. **Keyed sweep, ×2 each arm**, `seedling-divergence-sweep.yml` on this branch, `keys=` the contents of
   `d2/sweep-rope-level-keys.txt`:
   - OFF: `contact_fidelity` = the default ON set (it must list every default-ON key; an unlisted key is OFF).
     Expect = main.
   - ON: the default ON set + `ropeCutVerb`.
   - Add `capture_requests` for any L39 / L16 leg that moves.
4. **After harvest, on a branch carrying `rules-rope-events` + this one:** the survey full in both arms, and the
   whole-game Playback Bot walk (`test-substrates-manual.yml -f batch=tutorials-seedling-whole-game`) with the page's
   contact fidelity including `ropeCutVerb`. I could not run the WebGPU walk here.

## The JS arc

- **Pins that move at a flip:** `jsRuntimeSolverEventGoal.test.js` stays green ON on the merged tree. Its census skips
  refused rows and the two rope events simply map. Its no-verb expectations do not name the ropes.
- **What it must wire:** nothing in `solverGoalFor`. With the switch ON the page and the worker read the solver's
  tables. The page's switch set must include `ropeCutVerb` (the contact-fidelity hook already derives the setting
  `flashPanel.seedlingContactRopeCutVerb`).
- **No new `SolverRefusal.obstacle.kind`.** No staging or result field.

## What `rules-rope-events` must change

Nothing is required. Two notes:
- The rules allow the cut by **Sword | Spear | Fire** (⚖ user 2026-10-21). This verb drives the **sword** only: a bag
  holding just the Spear or just Fire is refused `cannot-act` by name. A logic route that reaches L16 or L28 with Fire
  or the Spear and no sword would refuse there. The Spear/Fire arms are the next work order, here or the rules' to
  narrow.
- L28's rope event is on no survey route at either head, so only the direct solve (D3) exercises it.

## D3 — against `rules-rope-events` (PASS)

Local merge in the throwaway worktree. One generated conflict (`instruments.js`) was taken as-is. Nothing was pushed.

| check | OFF | ON |
|---|---|---|
| the two events through `atlasEventGoal` → `solverGoalFor` | `no-verb` (the stop) | `{kind:'clear-tag', tag:{16,0}, at:{32,16}, obstacle:'rope@32,16'}` / `{28,0}` `rope@160,64` |
| survey step 24 (clear-tag L16 rope then reach-pit → L17) | REFUSED no-verb | **SOLVED 273 t** |
| survey step 26 | SOLVED 516 t | SOLVED 516 t |
| the mapped goals solved from the L15 / L25 arrivals | no-verb | SOLVED 112 t / 52 t |
| merged tree: `jsRuntimeSolverEventGoal`, `seedlingObstacleEvents`, `fidelityClearTag`, `fidelityRope` | 115 / 115 | 112 / 115 (fidelityRope's three OFF-pinning rows) |

**What still stops:** nothing for the rope goals once the switch is ON. The browser walk itself was not run (see
dispatch 4).

## Byte-inertia (OFF)

- Identity block at the head = W0 on every row. Both `generated set` rows are OK; the base's first run lost the box to
  the concurrent head run and was re-run alone.
- The reference: the same 4 environmental DIFFERs as the base, after the regeneration.
- tapeRunner pairs 635 `e1648386` at both.
- Producers `--check` all exit 0, r9-campaign included. No committed tape and no producer digest moved.
- Bounded AFTER: 96 files, **2,544 / 2,544**. That is BEFORE plus the 14 `fidelityRope` rows plus 1 derived
  `contactFidelityHook` row. Sorted `status\tfile > name`: md5 `292414411161a4c7eca72589db4c88c4` (BEFORE `17dad0bd`).
- Slow `fidelityL32ArenaPrefix` + `fidelityLights`: 7 / 7.

## Licence ask (the flip)

The movers if `ropeCutVerb` flips ON:
- **Survey:** steps 73/103/144/164 (L39) change refusal text, REFUSED → REFUSED. On `rules-rope-events`, step 24 goes
  REFUSED → SOLVED.
- **Bounded vitest with the switch ON:** 4 reds, all default pins (`contactFidelity` "the shipped defaults" and
  `fidelityRope`'s three OFF rows). No behavioural red (`vitest-bounded-ON-reds.txt`). The slow suites stay 7 / 7.
- **Owed at the flip:** `KNOWN_STRATEGY_VERBS` + `'rope'`, the R8 derivation row, the catalogue's pending list, and
  `entityBlocks`' `pulledRopes.strategies` (`['rope']` once the row is enumerable).
- **The sweep A/B** (dispatch 3) is the missing measurement before a flip.

## Hand-overs

- **Hammer arc: none.** I added no run state and no per-visit map (no `levelRun.js` change), so no digest question.
- **Possible levelRun follow-up (fidelity's own, licence):** should a rope cut appear in `earnedClears`? It is the
  ledger "what the next arrival reads" is named after, and other writers (BreakableRock, BossTotem) are in it. Adding a
  rope arm would move ledger-reading pins and maybe tapes, so it needs its own switch and measurement.

## Deltas and residue

- The L39 frontier cut is ON-only. Its next question is `cover@112,144` / `wandlock@144,64`. The rope's group there is
  a Pulser that the cut arms; rules-2 refused minting L39's event for that reason.
- A Spear or Fire cut is not driven (above).
- `check-procgen-help.mjs` (full) timed out at 300 s here. The probe's `--help` and its import door were checked by hand
  (nothing runs on import).

## What the brief got wrong (measured)

1. "It finishes when the rope's flag is in `earnedClears`": a rope's cut never reaches `earnedClears`; it is carried by
   `ropePulls`.
2. "On today's main no goal asks for a rope flag … an unconditional row should move nothing": goals are not the only
   reader. The frontier names `solid:rope` on L39, so the row moves four survey steps. Hence the switch.
3. The brief's `apReportBosses` test file does not exist (its readers are named above).

## Rows to BANK

- identity OFF = W0 (this base); tapeRunner pairs 635 `e164838673a48b38ce187093c363edb2`.
- surface GREEN 338 (re-written) · constants PASS 6,847 · entities 566 · profile 138 · roster 289. No tape added; the
  witnesses are fixtures.
- witnesses `rope-l16-cut-cross` 659 t, `rope-l16-verb` 32 t, `rope-l28-cut` 56 t, all 0 px on p4g.
- bounded AFTER 2,544 / 2,544 (`29241441`); ON 2,540 / 2,544 (4 default pins).
- CI (`JavaScript Unit Tests`) at `fe31cb81`, run 39675811531: **21,809 / 21,809**, slow 261 / 261. The later commits
  are docs and evidence only; the final head's run is quoted in the session's last message.

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push.
