# Cloud report: `seedling-hammer-wallflyer-flip-walk-check-2`

**The whole-game Seedling walk at the flip tip, re-run (kill arm ON) with the corpse arm: MEASUREMENT ONLY.**

Planner: `seedling-hammer-phase-planning-9`. Ruling: the user, 2026-11-16, *"Launch: kill arm + corpse ON arm
(Recommended)"*. I changed no solver code. The commits are the first walk check's measurement-only instrument
(cherry-picked), two more measurement-only extensions (§3), the run extracts and this report. None of them is for landing.

## 1. SHAs

| | |
|---|---|
| base | `71d6e319cf`, branch `hammer-flip-wallflyer-kill` (the flip + the hammer wallflyer-gaps slice + fidelity W45 + main `c1927ba307`) |
| instrument | the first walk check's six commits, cherry-picked clean: `c3d44c9e 6e50fbd0 69afdedf 6b80969d 070c7eb6 6eee95b0` → `7ceb4f1d 99ba3667 c3108d9f 8c431276 d2c2fa71 b283b490`. That is re-measure-3's `e8bcc583` (the brief's `f232811c` is still not in the clone) plus its extensions: env channel, hit witness, status, flyers, no-work-limit, census |
| instrument extensions (this slice, measurement only) | `26d6035e` (`[MEASURE worker]`/`[MEASURE worker env]`, the env witness), `ed534e2c` (`TEST_MEASURE_CONTACT_CORPSE_GONE` → the panel's contact switch, plus `[MEASURE jsframe]`) |
| evidence | `787163e5` (partial: A, B, Bc, Bc2, Ac), then the commit before this report (Ap1, Ap2, README) |
| wasm `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6` (the pin). `session_bootstrap.sh --all` printed READY, tree clean |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| branches pushed | `seedling-hammer-wallflyer-flip-walk-check-2` (the brief's name) and `claude/wallflyer-flip-walk-check-8rdnxg` (the harness-pinned name), with the same commits |

## 2. The answer first

**Defaults vs B-corpse on L22→L29: neither run reaches it.** JS seed 1 now stops one leg earlier, at entry 9's L22→L25
exit. Under js R1 that leg *fails by name*; in the first walk check it walked and took 2 hits. The refusal names a **live**,
forecast `chaser:wallflyer@64,80` (`CORRIDOR_LADDER_NEST 2`), not the static ghost. So the corpse key, which only stops
pricing a *removed* wallflyer, changes nothing there: B and B-corpse give the same text, 8/48, 0 hits, `deaths=0`.

**The corpse key's effect shows on wasm instead (the A-corpse control).** At the defaults, wasm seed 1 stops at L22→L29 on
the ghost's exact text (`enemy:wallflyer@64,80` static, at (81.0,96.7)), out of 640 and then 2560 units. With
`wallFlyerCorpseGone` ON, the **first** solve (640 units) plays **609 t "bait,detour,kill", 0 hits**. It kills the Bob,
wallflyer@48,112 and wallflyer@64,80, and enters L29. The walk then reaches **24/48** (was 9).

| arm | entry 10 L22→L29 | new first wall | checked/48 | `bot-plays` | hits anywhere |
|---|---|---|---|---|---|
| **A**, wasm s1, defaults | **FAIL (refusal, no hit)**: ghost text + "ran out of 640, then 2560 work units". No TypeError now | entry 10 L22→L29 | **9** | 683.7 s | 0 |
| **B**, JS s1, defaults | **not reached** | **entry 9, L22→L25**: R1 named refusal (CORRIDOR, live wallflyer@64,80) | **8** | 370.2 s | 0 (`deaths=0`) |
| **B-corpse**, JS s1, key ON (Bc2) | **not reached** | = B, byte-identical refusal | **8** | 366.2 s | 0 (`deaths=0`) |
| **A-corpse** (control), wasm s1, key ON | **PASS, hitless**: 609 t bait,detour,kill; 2 wallflyers + Bob killed; `hits=0` into L29 | entry 24, "L58 flag 1: yeti@56,56 cleared": no goal (`no strategy row exists for solid:yeti`) | **24** | 2307.1 s | **1 hit, entry 18** (L39, inside a solved 2864 t plan) → a no-hit FAIL there |
| **A′**, wasm s2, defaults | **not reached** | **entry 5, `level_12__r0c37 -> level_21`**: a solved 858 t walk frozen at tick 1/858 until the 300 s bot stall (2 of 2, identical) | **4** | 644.0 / 644.3 s | 0 |

**The one thing to know first:** the corpse key is what clears L22→L29 on wasm. At the defaults the kill arm's dashless
solve is refused on the ghost and runs out of budget. With `wallFlyerCorpseGone` ON it solves inside the first 640 units,
hitless, and the walk goes from 9 to 24. On JS the question can't be asked yet: R1 now stops JS at the L22→L25 leg on a
*live* wallflyer, which the corpse key doesn't touch. And seed 2 is a different game from the first walk check's
(§5, A′): its stall is new and not about wallflyers.

## 3. Method and knobs

The first walk check's method (= re-measure-3's): the row `tutorial-walk-seedling-whole-game` (batch
`tutorials-seedling-whole-game`, WebGPU), one run at a time under the box lock, a fresh page per run, dev server
`scripts/serve-nocache.py 8000`, shipped budgets (640, held retry 2560). Knobs in every run:
`TEST_AUTO_START_TIMEOUT_MS=10800000 TEST_TIMEOUT=11000000 TEST_MEASURE_STEP_TIMEOUT_MS=10800000
TEST_MEASURE_BOT_STALL_MS=300000`. Every run stopped on its own (no step cut). The row reads PASSED against its ratchet in
every run but A′. **PASSED is not victory.** Order: A, B, Bc, Ac, Bc2, A′ (a failed load), Ap1, Ap2.

**How the env reached the page (and where it didn't):**
- **There is no automatic path from the `npm test` process env to the page.** A `SEEDLING_*` variable set on the command
  line never reaches the browser. The only channel is the page URL's `?seedlingSolverEnv=`, which the instrument's
  `TEST_MEASURE_SOLVER_ENV` sets. `solveWorkerUrl` copies it onto the solve worker's URL, and `solverEnvShim.js` installs it
  as the worker's `process.env`.
- **Witness (wasm):** `[MEASURE worker env]` reads `process.env` *inside* the worker with Playwright's `worker.evaluate`.
  A, B and Ap: `{"KILL_ARM":null,"CORPSE_GONE":null}` (the defaults: kill arm ON by `!== '0'`, corpse key OFF). Ac:
  `{"KILL_ARM":null,"CORPSE_GONE":"1"}` on `jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_WALLFLYER_CORPSE_GONE%3D1`.
  `contactFidelity.js:2468` reads that at module load. The outer page's own contact set is the default, so
  `contactFidelityStamp()` is null and no request carries a contact set to override the worker's ON.
- **The JS runtime does NOT get it.** The JS page is a frame, `jsRuntime.html?…`, built by `flashPanelUI.js:2212-2221`
  from the panel's own settings. It does not carry the outer `?seedlingSolverEnv=`, and `jsRuntimePage.js:267` builds its
  worker from **its own** `win.location.search`. So **Bc** (env arm) is inert: its 30 solve workers all have a bare URL and
  read `CORPSE_GONE: null`. Its result equals B's, and it is **not** the B-corpse answer.
- **B-corpse proper (Bc2)** uses the product's own channel. `TEST_MEASURE_CONTACT_CORPSE_GONE=1` →
  `?measureContactCorpseGone=1` → a session override (not persisted) of the panel setting
  `moduleSettings.flashPanel.seedlingContactWallFlyerCorpseGone`. The panel then mounts the JS page with
  `?contactFidelity=…,wallFlyerCorpseGone,…` (witness: `[MEASURE jsframe]`, the only frame of the run, loaded after
  `[MEASURE] contact wallFlyerCorpseGone: ON`). `jsRuntimePage.js:285-286` applies it, and every solve request is stamped
  with it (`jsRuntimeSolveService.js:81`), so the worker solves under it. That is the same key, `wallFlyerCorpseGone`,
  through the panel switch instead of the env name.

**Deviations from the first walk check:**
- Two more measurement-only instrument commits (above). Neither changes what the bot does.
- I ran the A-corpse control (brief step 3). A's stop is the ghost's text word for word. The census shows all four
  wallflyers still alive *in the game* at that point (`[MEASURE flyers]` never changes after room entry), so "removed"
  here means removed inside the solver's own run (the kill arm's fork). Only the control could settle that, so I ran it.
- A′ ran twice (the second time as a repeat check of an unexpected stop). A first attempt failed at load because I had
  generated seed 2 from the wrong template (§7).
- Tree moves (all recorded `treeMoved` by the box lock): Ac moved 26d6035e → ed534e2c (I committed the contact knob
  mid-run; its modules had loaded and its knob was unset, so it was inert). Ap1 moved ed534e2c → 787163e5 (an evidence
  commit). Ap1 and Ap2 carry 1 frozen change, the seed-2 `preset_files.json` entry.

## 4. Per-arm results vs the first walk check (at `aaeb414749`)

| arm | first check: entries passed / first wall / checked | now: entries passed / first wall / checked |
|---|---|---|
| A wasm s1 | 9 / entry 10 L22→L29 **TypeError** `Cannot read properties of null (reading 'ledger')` / 9 (610.0 s) | 9 / entry 10 L22→L29 **budget refusal on the ghost** (below) / **9** (683.7 s) |
| B JS s1 | 19, but entry 10 took 2 hits (and L22→L25 took 2 more) / entry 20 L40 Totem Part 160,640 / 19 (1250.6 s) | **8** / **entry 9 L22→L25 named refusal (R1)** / **8** (370.2 s), 0 hits |
| B-corpse JS s1 | — | **8** / = B / **8** (366.2 s), 0 hits |
| A-corpse wasm s1 (control) | — (closest: A-nolimit, defaults with no work limit: 539 t, ≥ 20 by its 1800 s cut, 0 hits) | **24** / entry 24 L58 yeti flag (no goal) / **24** (2307.1 s), **1 hit at entry 18** |
| A′ wasm s2 | 13, hitless / entry 14 L28→L30 button@112,240 / 13 (1144.4 s) | **4** / **entry 5 L12→L21 playback stall** / **4** (644 s, 2 of 2): **a different game**, §5 |

**A (verbatim):**
```
[wasm playback] level_22__r0c6 -> level_29__r2c2: the solver ran out of 640 work units in level 22 — asking again with 2560, the room held (retry 1)
[wasm playback] the solver declined level_22__r0c6 -> level_29__r2c2 in level 22 (pass dashless): solverBot(wasm-exit-22) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at (81.0,96.7) — enemy:wallflyer@64,80 (a static "Enemy" body at its placement (this room is stepped, so this class is unbridged and does not move), priced "stepped" by `contactPricing`) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 22
[MEASURE flyers] t=657.4s level=22 count=4 (152,120) (56,120) (136,88) (72,88) others: Bob=1,PushableBlock=1   ← unchanged to the stop
```
The gaps slice's null-fork guard works: the TypeError is gone, and the budget ending is back. The named source moved, though.
Re-measure-3 and the first check's control named `chaser:wallflyer@48,112` (forecast). Now wasm names the static
`enemy:wallflyer@64,80`, which is what the first check saw on JS only. My reading is that the gaps slice's `wallFlyerBodies`
switch-over put wasm on the same pricing path as JS. I did not trace that.

**B and B-corpse (identical, verbatim from B):**
```
[js runtime] the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging
[MEASURE end] … botChecked=8 botRegion="level_22__r8c0" … transport=js … status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — [the same text] — solving… (budget 640 work units)"
```
The first check's B2 took 2 hits on this same leg (t=375.7 s and 376.5 s) under "walking instead", after the same CORRIDOR
text. R1 turns that hit-taking pass into a named stop: honest, and 11 entries shorter. On wasm the same exit plays
**113 t (walk; full pass)** in A and Ac, so this wall is JS-only.

**A-corpse, the L22→L29 crossing (verbatim):**
```
[MEASURE status] t=648.8s level=22 "… level_22__r0c6 -> level_29__r2c2 … — solving… (budget 640 work units)"
[MEASURE status] t=651.8s level=22 "… — playing 609 ticks (bait,detour,kill; dashless pass; full stopped at its deadline (sword-dash))"
[MEASURE flyers] t=667.1s level=22 count=4 (153,120) (55,120 destroy) (137,88) (71,88) others: PushableBlock=1
[MEASURE flyers] t=673.1s level=22 count=3 (153,120) (137,88) (71,88 destroy) others: PushableBlock=1
[MEASURE hit] t=682.4s level=29 hits=0 hits_timer=0 deaths=? x=24 y=232 …
```
Bodies killed: the Bob (`Bob=1` → `0` at 658.9 s), wallflyer@48,112 (body (55,120)), wallflyer@64,80 (body (71,88)).
@128,80 and @144,112 stand and never touch the player. 609 t is fidelity's own JS-page figure for the key ON. No retry was
needed.

**A-corpse, the hit (entry 18):**
```
[MEASURE status] t=1444.9s level=39 "Sphere 6.7 → walking to \"Level 039 - Totem Part 72,40\" (18/48) — playing 2864 ticks (kill,l39shaft,rope,walk; dashless pass, the later pass ran out of budget; full stopped at its deadline (block-route))"
[MEASURE hit] t=1521.4s level=39 hits=1 hits_timer=18 … x=116.39 y=242.56 … playing tick 1521/2864
```
This is a hit inside a *solved* plan (a model/game divergence), not a fallback walk. Wasm reports no deaths, and the walk
went on.

**A-corpse, the stop (verbatim):**
```
status="error: level_58__r3c3: the bot cannot walk to location \"L58 flag 1: yeti@56,56 cleared\" — the wasm playback failed: the solver has no goal for L58 flag 1: yeti@56,56 cleared: \"L58 flag 1: yeti@56,56 cleared\" is a saved-obstacle EVENT (clear-tag {58,1} yeti@56,56): the solver's clear-tag refuses it — no-verb: no strategy row exists for solid:yeti — the catalogue names no verb that clears it. Its check stays the game's persistence flag {58,1} turning set, which nothing but the game writes"
```

**A′ (Ap1 and Ap2 identical):**
```
[MEASURE status] t=352.7s level=12 "Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing 858 ticks (walk; full pass; full stopped at its deadline (sword-dash))"
[MEASURE tick] … t=360s … status="… — playing tick 1/858"   ← every 15 s sample to the end
[MEASURE end] seedling-whole-game t=653s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 botRegion="level_12__r0c37" … transport=wasm … status="… — playing tick 1/858"
```
No refusal and no page error (the run's one console error is a 404 at boot). The walk's own stop is the 300 s
bot-stall knob.

## 5. Controls, and the diagnosis where an arm fell short

- **A-corpse is the control, and it is decisive for wasm.** At the defaults the kill arm's dashless climb meets the
  ghost, a wallflyer priced static at its placement after the arm's fork removed it. The climb then spends the 640 and
  2560 budgets and refuses. With `wallFlyerCorpseGone` ON, the same entry solves in the first budget, hitless. The node
  survey's claim ("ghost bites the page's dashless pass, not the node plan") holds on the page.
- **B / B-corpse fall short one leg earlier, for a reason the corpse key can't reach.** The L22→L25 stance walk to kill
  the Bob meets the *live*, forecast wallflyer@64,80 inside a climb 2 deep. The CORRIDOR_LADDER_NEST cap refuses it. That
  is JS-only: wasm plays the same exit as a 113 t walk. Before R1 the JS bot walked it and took 2 hits, so the JS number
  before R1 (19) was never a clean one.
- **A′ falls short because seed 2 is a different game.** `worlds/seedling_playthrough` was regenerated between the two
  bases (the tile-fire-breaks-rocks regenerations, e.g. `18810a0b`, `f6ea7267`; `_worldgen_sidecars.json` ±532 lines). So
  `AP_01043188731678011336` now places items differently. The two walks agree through 3/48, then diverge (first check:
  "Sphere 1.4 → … level_36 (4/48)"; now: "Sphere 1.7 → … level_12__r42c28 (4/48)"). Its stop, a solved 858 t L12→L21 walk
  that never advances past tick 1, is new. It is deterministic (2 of 2) and has nothing to do with wallflyers (L22 is
  never reached). I did not diagnose it: it could be a playback hand-off stall after the "an item arrived … held room"
  re-solve. A′ is therefore not comparable with the first check's 13/48, and I made no A′-corpse run (the brief asked for
  none, and L22 is never reached).

## 6. What the brief got wrong

- **"Both env names are in `SOLVER_ENV_NAMES`, so an env set for the walk reaches the page's solver."** That holds only
  for the outer page's worker, and only through `?seedlingSolverEnv=`. The JS runtime's frame doesn't forward it, so an
  env-set `SEEDLING_WALLFLYER_CORPSE_GONE=1` never reaches the JS solver (Bc: 30 workers, all `null`). B-corpse needed the
  panel's contact switch.
- **"B-corpse … on L22→L29."** At this base JS never reaches L22→L29. R1 stops it at L22→L25.
- **A′ "re-run" assumes the same seed-2 game.** The world was regenerated, so seed 2 is a different placement.
- **Instrument `f232811c`** is still not in the clone. The first check's cherry-picks of `e8bcc583` (and extensions)
  stand in for it.
- **"Push your report to that branch name"** conflicts with the harness-pinned branch, so I pushed both with the same
  commits.

## 7. Residue

- **For the packet:** on wasm seed 1, flipping `wallFlyerCorpseGone` with the kill arm takes L22→L29 from a refusal to a
  609 t hitless pass, and the walk from 9 to 24. A SHA-bound ask should still re-read the **L39 hit** (entry 18,
  "Level 039 - Totem Part 72,40", inside a 2864 t dashless plan whose later pass ran out of budget). One run, so it is
  unknown whether the key causes it: the first check's A-nolimit, defaults with no work limit, passed entry 18 hitless.
- **JS:** the L22→L25 Bob-kill stance walk's CORRIDOR_LADDER_NEST refusal against live wallflyer@64,80 is the JS walk's
  first wall now (JS-only; wasm walks it).
- **Seed 2:** the L12→L21 tick-1 playback stall on the regenerated seed 2 is new and undiagnosed.
- **The page's env channel** doesn't reach the JS runtime frame. A row that means to measure a `SEEDLING_*` switch on
  JS must forward `?seedlingSolverEnv=` into the frame (a product change), or use a panel setting where one exists.
- **The wasm source shift** (`chaser:wallflyer@48,112` forecast → `enemy:wallflyer@64,80` static) between the first check
  and this base is untraced.
- **Leftovers:** a 7 s A′ attempt failed at load (`no preset for game=seedling_playthrough seed=2`). I had generated
  seed 2 from `Seedling.yaml`, then reverted it (`preset_files.json`, the `seedling/AP_01043188731678011336` dir, the output
  zip) and regenerated from `Seedling Playthrough.yaml`. After A′ I reverted `preset_files.json` and removed
  `seedling_playthrough/AP_01043188731678011336` and `output/AP_01043188731678011336.zip`. The tree is clean. The dev
  server I started on port 8000 (PID 1094) was stopped by literal PID.
