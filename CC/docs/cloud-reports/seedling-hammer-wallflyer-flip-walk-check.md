# Cloud report: `seedling-hammer-wallflyer-flip-walk-check`

**The whole-game Seedling walk at the `WALLFLYER_KILL_ARM` flip tip: the walk check of the flip. MEASUREMENT ONLY.**

Planner: `seedling-hammer-phase-planning-9`. Ruling: the user, 2026-11-15, *"Measure the flip first (Recommended)"*. I changed
no solver code. The commits are the re-applied measurement-only instrument, four measurement-only extensions of it (§3),
the run extracts (`seedling-hammer-wallflyer-flip-walk-check-evidence/`) and this report. None of them is for landing.

## 1. SHAs

| | |
|---|---|
| base (the flip tip) | `aaeb4147497d41d1e9328d69c54ad50a4ce6c49f`, branch `hammer-flip-wallflyer-kill` = main `b89f081829` + "hammer: flip WALLFLYER_KILL_ARM ON" |
| instrument | re-measure-3's `e8bcc583`, cherry-picked clean onto the base → `c3d44c9e` (4 files, +124/−5). The brief's `f232811c` is not in this clone; per -3, `e8bcc583` is its clean cherry-pick |
| instrument extensions (measurement only) | `6e50fbd0` (`TEST_MEASURE_SOLVER_ENV` → `?seedlingSolverEnv=`, for the `=0` control), `69afdedf` (`[MEASURE hit]`), `6b80969d` (`[MEASURE status]`, `[MEASURE flyers]`), `070c7eb6` (`TEST_MEASURE_NO_WORK_LIMIT`), `6eee95b0` (the census of other classes) |
| evidence | `0f7f65cc` |
| wasm `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6`, the same pin as -3. `session_bootstrap.sh --all` printed READY, "seedling wasm builds: OK (4 dirs)", tree clean |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| branches pushed | `seedling-hammer-wallflyer-flip-walk-check` (the brief's name) and `claude/wallflyer-flip-walk-check-vs4uwy` (the harness-pinned name), with the same commits |

## 2. The answer first

| arm | L22→L29 (entry 10) at the flip | how | new first wall | checked / 48 | time (`bot-plays`) |
|---|---|---|---|---|---|
| **A**, wasm seed 1 | **FAILS: the solver throws.** It is not a refusal (2 of 2) | 640 units ran out; the held 2560 retry ends in `Cannot read properties of null (reading 'ledger')`. No body killed, no hit (no tick played) | **entry 10, L22→L29**, the same as -3, now as a TypeError | **9** (as -3) | 610.0 s / 641.8 s |
| **B**, JS seed 1 | **FAILS (⚖ no-hit): it passes, but takes 2 hits** | the first solve refuses ("EXHAUSTED … `enemy:wallflyer@64,80` … static"), and the walker's 90 ticks take **2 hits** (game `hits` 0→1→2, `deaths=0`). Then the retry plays a 367 t "bait, kill, walk" plan into L29 with no more hits | entry 20, L40 "Level 040 - Totem Part 160,640": ladder EXHAUSTED on `chaser:bobsoldier@880,832` + JS walk stall | **19** (was 9) | 1250.6 s |
| **A′**, wasm seed 2 `AP_01043188731678011336` | **PASSES hitless** (3 of 3) | 640 ran out; the 2560 retry plays **207 t "kill,walk"** (full pass). It kills **the Bob**, not a wallflyer: all four wallflyers live through it. 0 hits | entry 14, `level_28__r1c18 -> level_30__r2c10`: "no REACHABLE stance inside button@112,240" (re-measure-2's seed-2 wall) | **13** (was 9) | 1144.4 s |

**The one thing to know first:** on wasm seed 1 the flipped arm can't finish inside the page's work budget. When the budget
trips mid-arm, `bodyFamilyKillOnLadder` dereferences a null fork (`solverBot.js:25049` → `playWallFlyerKill`'s `f.ledger`,
`solverBot.js:24915`). With the panel's "no work limit" ticked, the same arm on the same page plays the model's own
**539 t, 0 hits** solve: it kills `wallflyer@48,112` and `wallflyer@64,80`, enters L29, and the walk goes on to
**≥ 20/48** (cut at 1800 s, still walking). So the flip is right in the game. What fails is its cost, and its missing
null-fork guard turns that cost into a crash. The flip does not pass this walk check as it stands.

## 3. Method and knobs

Re-measure-3's method, unchanged where nothing is said: the row `tutorial-walk-seedling-whole-game` (batch
`tutorials-seedling-whole-game`, WebGPU), `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game`, one run at
a time under the box lock, a fresh page per run, dev server `scripts/serve-nocache.py 8000`, shipped solver defaults
(`SOLVER_BUDGET_WORK = 640`, held retry 2560). Every row reads `PASSED` against its ratchet. **PASSED is not victory.**

| knob | value | runs |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` | `10800000` | all |
| `TEST_TIMEOUT` | `11000000` | all |
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` (A1, B1, A′1, Actl: the full walk, as -3); `600000` B2, `720000` A2/A′3, `800000` A′2/A′ctl, `1800000` A-nolimit (extra runs, cut so they end cheaply; A2 and A′ctl stopped on their own first) | |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` | all |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B1, B2 |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′1–3, A′ctl |
| `TEST_MEASURE_SOLVER_ENV` (new) | `SEEDLING_WALLFLYER_KILL_ARM=0` → `?seedlingSolverEnv=…`, which the page's solve worker installs as `process.env` (`solverEnvChannel.js`). Without it the browser worker has no `process`, so the flip's `!== '0'` reads ON | Actl, A′ctl |
| `TEST_MEASURE_NO_WORK_LIMIT` (new) | `1` → `?measureNoWorkLimit=1` → a session override of the Flash panel's own `seedlingSolverNoWorkLimit` (status reads "budget no work limit"; the 300 s backstop stays on) | A-nolimit |

**Deviations from -3, and why:**
- **The instrument gained four measurement-only extensions.** The brief asks for "player hits/deaths in the game ledger"
  and "which bodies the arm killed", and -3's sampler reads neither. So `[MEASURE hit]` polls the game's own `botStatus()`
  every 100 ms (`hits` = damage taken, `hits_timer` = i-frames, `level`; `deaths` on JS only, since wasm reports none). It
  logs on any change, so a hit shows as `hits` rising with `hits_timer` ≈ 17–19. `[MEASURE flyers]` lists wasm
  `botMobiles()` WallFlyers in L22/L29 (and, from A′3, a count of every other class). `[MEASURE status]` gives plan lengths.
  The `=0` control needed a URL channel. The no-work-limit knob is an extra diagnostic (§5). All of it reads the game or the
  page. None of it changes what the bot does.
- A1, B1 and A′1 (the brief's three full walks) ran before some of those extensions existed. So B's hits come from B2,
  and A′'s kills from A′2/A′3: same tree, same seed, re-run.
- B1's tree moved under it (I committed `6e50fbd0` mid-run; that change is inert without its env var). A′ runs carry 1
  frozen change, the seed-2 `preset_files.json` entry, as in -3.
- Seed 2 was generated twice (`Generate.py … --seed 2`, giving `AP_01043188731678011336` each time). I reverted it after
  each use (`git checkout -- frontend/presets/preset_files.json`, the dir and `output/…zip` removed); `git status` is clean.

Order of runs: A1, B1, A′1, B2, Actl, A-nolimit, A′2, A′ctl, A′3, A2. No OOM: the wasm heap was a flat 656 MB in every
run. On wasm the game's `hits` never left 0 in any run, over the whole walk (A-nolimit's 20 checks included).

## 4. Per-arm results vs re-measure-3

| arm | -3 entries passed | now | -3 first wall | now first wall | -3 checked | now checked |
|---|---|---|---|---|---|---|
| A wasm s1 | 9 | **9** (A1, A2) | entry 10 L22→L29: "the combat ladder is EXHAUSTED … `chaser:wallflyer@48,112` … ran out of 640, then 2560 work units" | **entry 10 L22→L29: `the solver declined level_22__r0c6 -> level_29__r2c2 in level 22 (refusal): Cannot read properties of null (reading 'ledger')`** | 9/48 (636.5 s) | **9/48** (610.0 s; A2 641.8 s) |
| B JS s1 | 9 | **19**, but **entry 10 took 2 hits** | entry 10 L22→L29: ladder EXHAUSTED on `wallflyer@128,80` + JS walk stall at (61.82,132.32) | entry 20 "Level 040 - Totem Part 160,640" (below) | 9/48 (453.1 s) | **19/48** (1250.6 s) |
| A′ wasm s2 | 9 | **13** (hitless) | entry 10 L22→L29: ladder EXHAUSTED on `wallflyer@144,112` | entry 14 `level_28__r1c18 -> level_30__r2c10` (below) | 9/48 (616.7 s) | **13/48** (1144.4 s) |

Timelines (entry first seen @ s / region changes):
- A1 `1@15s/r2 3@150s/r12 4@180s/r19 5@225s/r22 6@315s/r34 8@390s/r39 9@405s/r41 10@615s/r54`.
- B1 `… 9@270s/r43 10@405s/r54 11@420s/r55 12@450s/r60 14@495s/r62 15@630s/r72 16@690s/r75 17@765s/r91 18@780s/r96 19@975s/r105 20@1200s/r105`.
- A′1 `… 9@600s/r49 10@675s/r55 11@705s/r59 12@825s/r69 13@930s/r80 14@960s/r84`.

**A (A1; A2 is the same text, verbatim):**
```
[MEASURE end] seedling-whole-game t=619s step=bot-plays checked=17 botQueue=48 botCursor=9 botChecked=9 botRegion="level_22__r0c6" lastRegionEvent="level_22__r0c6" regionChanges=54 wasmPushes=38 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_22__r0c6: the bot cannot walk to exit \"level_22__r0c6 -> level_29__r2c2\" — the wasm playback failed: the solver declined level_22__r0c6 -> level_29__r2c2 in level 22 (refusal): Cannot read properties of null (reading 'ledger')"
[wasm playback] level_22__r0c6 -> level_29__r2c2: the solver ran out of 640 work units in level 22 — asking again with 2560, the room held (retry 1)
```
**B (B1), the new first wall:**
```
[MEASURE end] seedling-whole-game t=1258s step=bot-plays checked=33 botQueue=48 botCursor=19 botChecked=19 botRegion="level_40__r26c13" … transport=js … status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Totem Part 160,640\" — the JS runtime's walk failed: not reached within 1800 ticks — stalled at (888.139151388432, 826.228256860506); the solver declined: solverBot(js-runtime-L40-location) apitem (160,640) contact: the combat ladder is EXHAUSTED. The corridor passes through danger at (888.1,837.0) — chaser:bobsoldier@880,832 (the sword: `swordHitting`'s `collideLine(\"Player\", …)` from 8 to 16 px off the body crosses this box THIS tick (no enemy i-frame and no `destroy` gate refuses it)) — and every rung of ⚖ §11.8a's order refused: — [the same solverBot text again]; walking instead (after 3 retries)"
```
**B's L22→L29 crossing (B2, the hit witness; B1's solver lines are the same):**
```
[js runtime] the solver declined — solverBot(js-runtime-L22-exit) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at (81.0,96.7) — enemy:wallflyer@64,80 (a static "Enemy" body at its placement (this room is stepped, so this class is unbridged and does not move), priced "stepped" by `contactPricing`) — and every rung of ⚖ §11.8a's order refused:; walking instead
[MEASURE hit] t=394.4s level=22 hits=1 hits_timer=18 deaths=0 x=60.45521914993609 y=130.82268373037147 …
[MEASURE hit] t=395.5s level=22 hits=2 hits_timer=17 deaths=0 x=86.93254591428975 y=115.04636642251975 …
[js runtime] solved reach-exit in level 22: 367 tick(s), verbs bait, kill, walk (replay 10 ms over 90 tick(s), solve 590 ms, worker; pass dashless, full stopped at its deadline (sword-dash))
[MEASURE hit] t=409.8s level=29 hits=0 hits_timer=0 deaths=0 x=24 y=232 …
```
The two hits land while the simple walker plays its 90 ticks ("walking instead"). The game doesn't name the body that hit.
The player between the hits, (61.82,132.32), is exactly -3's B stall point, so -3's JS walker most likely took the same hit.
The JS runtime also took 2 hits earlier in L22, on the L22→L25 leg (t=375.7 s and 376.5 s, under the same "walking instead"
fallback after `… -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 … CORRIDOR_LADDER_NEST 2`).
That leg isn't entry 10, but it is the same room. B2's only hits are these 4, all in L22.

**A′ (A′1), the new first wall:**
```
[MEASURE end] seedling-whole-game t=1155s step=bot-plays checked=17 botQueue=48 botCursor=13 botChecked=13 botRegion="level_28__r1c18" … transport=wasm wasmMemMB=656 … status="error: level_28__r1c18: the bot cannot walk to exit \"level_28__r1c18 -> level_30__r2c10\" — the wasm playback failed: the solver declined level_28__r1c18 -> level_30__r2c10 in level 28 (refusal): solverBot: no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296). A hold that cannot be stood on is not a strategy for this obstacle. ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time: grasslock@176,208 — its group t=0 publishes only while a Solid sits on button@112,240, and NO block in this room can reach it — so the only order that could open it is a `hold` the walker shuts again by leaving. ⚖ Guard (iii): a hypothesis nothing can redeem DURABLY is a wall, not an optimistic gap."
```
This is re-measure-2's seed-2 first wall, word for word (then 13/48 too). The flip gives seed 2 back exactly what train 105
took.

**A′'s L22→L29 crossing (A′3; A′2 gives the same plan and the same flyer readout):**
```
[MEASURE status] t=648.5s level=22 "… level_22__r0c6 -> level_29__r2c2 … — solving again, the room held… (budget 2560 work units, retry 1)"
[MEASURE status] t=655.6s level=22 "… level_22__r0c6 -> level_29__r2c2 … — playing 207 ticks (kill,walk; full pass)"
[MEASURE flyers] t=663.4s level=22 count=4 (153,120) (55,120) (137,88) (71,88) others: Bob=0,PushableBlock=1
[MEASURE flyers] t=666.9s level=29 count=0  others: APItem=1,Turret=3
```
The Bob (`Bob=1` at room entry, in the control's census) is the body killed. All four wallflyers live. `hits` stays 0 into L29.

## 5. Controls and the diagnosis

**Controls (`SEEDLING_WALLFLYER_KILL_ARM=0`, the pre-flip arm, at this same base):**

| control | stop | text vs -3 |
|---|---|---|
| Actl, wasm seed 1 (full walk) | 9/48, entry 10, L22→L29, `bot-plays` 607.6 s | **byte-identical** to -3's A: "…EXHAUSTED. The corridor passes through danger at (109.8,119.1) — chaser:wallflyer@48,112 (… body at (103.0,120.0), forecast along the walk)) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 22" |
| A′ctl, wasm seed 2 (stopped on its own at 668 s) | 9/48, entry 10, L22→L29 | **byte-identical** to -3's A′: "…danger at (116.5,111.2) — chaser:wallflyer@144,112 (… body at (121.0,120.0), forecast along the walk)) — … ran out of 640, then 2560 work units on its held retry on exit in level 22" |

So the base between -3 (`c82f413c87`) and here moved nothing on this exit. The flip alone moves both A (to a TypeError)
and A′ (to a pass). No control was run for B: B passes entry 10 at the flip, and -3 is B's pre-flip record.

**A: why the arm falls short on the page (diagnosis, no code).**
1. The model's step-35 solve is unbudgeted. The kill arm's evidence (`seedling-hammer-wallflyer-drill-kill-evidence/repro/survey-35-84-arms-on.jsonl`)
   reads `"verdict":"SOLVED","ticks":539,…"hits":0,…"ms":17465`.
2. The page solves under the deterministic work budget (640, then a held retry at 2560), and installs the deadline with
   `fineCheckpoints`. The fork the arm asks for is `replayOntoFork(forkRun(), …, { stop: () => fineDeadlineReached('crusher-fork') })`
   (`solverBot.js:28590-28592`). That replay asks `stop` every `WALK_CHECK_TICKS` (32) advances, so each fork spends work
   units, and it returns **`null`** once the deadline has tripped (`replayOntoFork`, "@returns {?object} the fork, or `null`
   when `stop` tripped").
3. `bodyFamilyKillOnLadder` takes `const f = fork();` (`solverBot.js:25049`) and hands `f` to `playWallFlyerKill`, whose
   first line is `f.ledger('playerHits')` (`solverBot.js:24915`). Most other fork callers in the file guard this, e.g.
   `const f = fineDeadlineReached('crusher-fork') ? null : ctx.fork(); if (f === null) …` (`solverBot.js:1230-1231`,
   12782, 12990, 13086, 13350, 13454; `orbit-fork` at 26452), or `if (!f) break;` / `if (f === null) …` right after
   the call (21559, 21688, 21865, 21890, 23211, 25408, 32403, 32639). Two more take the fork unguarded (25253, 29776).
   I didn't measure whether they are reachable under a page deadline.
4. The arm needs up to `BODY_FAMILY_KILL.maxForks` = 8 forks, each a full segment replay plus a walk of up to 300 ticks.
   It reaches the 2560-unit deadline mid-arm (A1 and A2: 640 ran out, then ~10 s into the retry the TypeError). The
   TypeError escapes the climb and becomes the rendered "(refusal)". So it replaces both the named ladder text and the
   "ran out of … work units" ending that -3 and the control show.
5. **With no work limit the same arm on the same page solves it** (A-nolimit): "solving… (budget no work limit)" for 20 s,
   then `playing 539 ticks (bait,kill,walk; full pass)`, the model's own length. The game readout shows
   `(55,120 destroy)` at 670.4 s, i.e. wallflyer@48,112 killed; `(71,88 destroy)` at 676.5 s, wallflyer@64,80 killed;
   L29 at 682.4 s with `hits=0`. The other two wallflyers (@128,80 at (137,88) and @144,112 at (153,120)) stand and never
   touch the player. That walk then went on to 20 checked and entry 21 by the 1800 s cut, with `hits=0` the whole way.

The arm's plan is real and hitless in the game. On the page it is too expensive for 2560 units, and the missing null-fork
guard turns "out of budget" into a crash. A guard alone would give back -3's honest budget refusal, not a pass: the solve
needs more than 2560 units, or a cheaper arm. (Report only; nothing changed.)

**B: why the JS crossing takes hits (observation; mechanism not measured).** JS's first L22→L29 solve names a
*different* source from wasm: `enemy:wallflyer@64,80`, "a static "Enemy" body at its placement (this room is stepped, so
this class is unbridged and does not move)", from `dangerMap.staticEnemyDanger`. That branch is taken when
`isBridgedChaser('wallflyer')` is false in that run. The wallflyer arm targets only a source for which
`liveWallFlyer(run, id)` holds. If the JS run has no live body for that id, the arm has no target, the ladder is EXHAUSTED,
and the bot falls back to the simple walker, which takes the hits. I did not verify the arm's verdict in that solve: the
rendered refusal ends at "refused:", as -3 noted. The retry, from the walked-to position, finds a 367 t plan.

**A′: why it passes.** The 207 t plan is the *full* pass's (-3 and the control refuse in the *dashless* pass), and it kills
the Bob, not a wallflyer. So the wallflyer arm killed nothing on seed 2, yet the flip still decides the outcome (the
control at this base refuses). The likeliest reading is that the arm ends the dashless climb at a different point (its
refusal, or a different work spend). That leaves the full pass a budget in which its Bob-kill plan is found. I did not
measure this.

## 6. What the brief got wrong

- **"The flip solves survey step 35 in the model: 539 t, 0 hits" does not carry to the walk.** The model survey has no
  work budget (17.5 s per solve). At the page's budget, on wasm seed 1, the arm does not finish and the solver throws. The
  539 t solve does appear on the page, but only with "no work limit".
- **Instrument `f232811c`** is not reachable in this clone. Re-measure-3's own cherry-pick `e8bcc583` (the same diff, per -3)
  was used.
- **"Hits/deaths in the game ledger"**: re-measure-3's instrument has no hit readout. Reporting them took a
  measurement-only extension (§3), which the brief's "no code change except the instrument cherry-pick" did not allow for.
  The `=0` control also needed a URL channel: the browser's solve worker has no `process.env`.
- **The residue "third flyer @128,80, forks all hit on walk (crosses its lane)"** is not what the walk shows. In the
  page's 539 t solve @128,80 never touches the player. On seed 2 the crossing kills no wallflyer at all. On JS the named
  source is @64,80 (static), not @128,80.
- **"Push your report to that branch name"** conflicts with the harness's pinned branch
  (`claude/wallflyer-flip-walk-check-vs4uwy`), so I pushed the same commits to both.

## 7. Residue

- **The flip is not ready to ask for as-is.** Seed 1 wasm crashes at entry 10, and JS takes 2 hits on the same crossing. A
  SHA-bound flip ask would need, at least: the null-fork guard in `bodyFamilyKillOnLadder` (the pattern of
  `solverBot.js:1230`), and a cost answer for step 35 at the page budget (a cheaper arm, or a budget that fits the solve).
  After that, this walk check must be re-run, and B's hits re-read with the hit witness.
- **What sits behind entry 10 when it does pass** (A-nolimit, a diagnostic and not the shipped budget): 20 checked by
  1800 s, still walking, entry 21. B1 (JS, shipped budget) shows the next walls: L40 Totem Part 160,640
  (`bobsoldier@880,832`). Earlier in B1, entry 19 "Level 040 - Chest" was checked. Re-measure-2's L40 BK2 budget wall was
  not hit on JS this time. That is one run, behind a crossing that took hits.
- The JS runtime prices wallflyer@64,80 as a static, unbridged enemy in L22. Whether that is a JS-only bridging verdict
  (`chaserRoomVerdict(level).stepped` with `isBridgedChaser('wallflyer')` false) is unmeasured, and it is worth a look.
- The JS bot's "walking instead" fallback takes real hits in L22 on two legs (4 hits in all, 0 deaths). The no-hit rule
  makes any fallback walk through a priced danger a FAIL.
- Leftovers: the dev server I started on port 8000 was stopped by literal PID. Seed 2's preset was reverted and removed,
  and the tree is clean.
