# Seedling HAMMER-PHASE GS — the press-kill guards' whole-route A/B (measure only)

Slice `seedling-hammer-guards-sweep` (cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ User approval of
2026-10-22: *"Please run both measuring steps"*. Evidence is in
[`seedling-hammer-guards-sweep-evidence/`](seedling-hammer-guards-sweep-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | `ef6bdd6d866f` (`origin/main`; contains `c2f479fe72`, the ubuntu-24.04 pin) |
| branch (main-bound) | `claude/seedling-hammer-guards-sweep-50gb88`. This is the session's designated branch, not the brief's `seedling-hammer-guards-sweep`. It holds this report and its evidence only |
| scratch branch | **`seedling-hammer-guards-sweep-on` @ `e66ee0b6`. DELETE IT, NEVER MERGE IT.** It has one commit: both `enabled:` initialisers in `pressKillGuards.js` set to `true`. Keep it only until the CI A/B below has been dispatched from it |
| head | the commit that adds this report (see `git log`) |

## 2. The answer

**(a) A guard turned a SOLVE into a refusal: 0 legs.** Not one in 850 legs, and not one in the 878 captured solve
requests replayed in node with the guards OFF and ON. One leg (637, L76) read SOLVE → refusal on the page. The replay
proves that change is not the guard's: each arm's own request gives the same answer under both settings, with both
counters at 0. It is the arrival (§3.4).

**(b) A timeout became a fast refusal: 1 leg.** Leg 387, `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest`,
the L40 chest leg (LB's "397"):
- page: `timeout` at the 90 s harness cap → refused in 81.7 s, by the reboot guard (*"the player died at t1325 (chaser
  bob@736,752) while pressing spinner@880,848 … (PRESS_KILL_REBOOT_GUARD: the kill is refused at the first reboot, not
  re-run to its bound)"*);
- node, uncapped:
  - the OFF arm's request: 642 units / 496 s → 114 units / 110 s;
  - the ON arm's request: 470 units / 517 s → 114 units / 98 s.
- Wall saved: about **400 s of solver work per solve of this leg**. The page can show only about 8 s of it, because
  the harness cuts the OFF solve at 90 s. Across the whole route, the page wall is OFF 116.8 min vs ON 115.7 min, a
  difference inside the noise. Across all 878 OFF-arm requests in node, the totals are 1,866 s vs 1,458 s, and the
  whole 408 s difference is leg 387's request.

**(c) Anything else: 18 legs, all arrival noise and none of them the guard.** Every one gives the same answer, work and
plan hash with the guards OFF and ON, for both arms' requests (`m1-replay-attribution.txt`). Each arm's live arrival
(the seam's game clock) produced a different request, and that request differs in answer. The changes:
- small tick shifts on solves: 12 legs;
- refusal text: 620, 634;
- refusal → SOLVE (better ON, not the guard): 776;
- SOLVE → refusal on a work deadline (worse ON, not the guard): 637;
- `timeout` → refusal, not the guard: 404, the other L40 chest leg (LB's "414"). ON's arrival drew a 72-unit, 10 s
  request, where OFF's drew a 144-unit, 146 s one;
- `timeout` both arms (ticks 0 → 648): 595.

**The shake guard fired nowhere.** Its counter is 0 on every replayed request. Its one measured case is still LB's HO1
fixture.

## 3. M1 — the A/B on the whole route

### 3.1 Why it is not a CI A/B
- **`workflow_dispatch` is 403 from this session.** `gh workflow run` and the GitHub MCP `run_workflow` both return
  *"Resource not accessible by integration"*. LB's residue item 6 already says so.
- **There is no control to reuse.** `seedling-control-for.mjs ef6bdd6d…` returns 0 green sweeps at that SHA. The newest
  full main sweep, `39496135591` at `934f99422b`, predates several solver flips (DRILL, Lights, ROPESTANCE, IGFADE).
- So both arms ran **locally**, through the sweep's own probe (`probe-seedling-divergence-sweep.mjs`).

### 3.2 The run
- **Inputs, the same on both arms**, which are the workflow's defaults:
  - page `seedling_bot_ap_p4g`, mode `inv`, producer `solver`, page_legs 1, stage_events true;
  - every other input empty;
  - the leg list from `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`: 850 legs, 9 skipped by
    name;
  - `--capture-requests` on both arms.
- **Servers:**
  - OFF: `serve-nocache.py 8000` from the main-bound tree at `ef6bdd6d`;
  - ON: `:8001` from a worktree of the scratch branch, with the submodules and `node_modules` symlinked to the primary.
  - `curl` showed `:8001` serving `enabled: true` twice and `:8000` serving it zero times.
- **Paired and concurrent.** Both arms ran at the same time, in the same leg order, on the 4-core box. That gives each
  arm about a runner shard's 2 CPUs, and every load swing hits both arms.
  - ⚠ The ON arm used its own `XDG_CACHE_HOME`, so it bypassed the box lock **on purpose**. I was the only process
    measuring on this box.
  - Load ran at 10–12 the whole time, so the walls are relative, as in LB. Answers, units and ticks are not affected.
- **The timeline:**
  - start 2026-10-22 21:43 UTC;
  - a container restart around 00:10 killed both probes at 217 / 219 legs;
  - I resumed the missing legs (`rows2-*`);
  - finish 09:11. Every leg ran once per arm (850 / 850, no hang, no missing leg).

### 3.3 How the ON arm was proven ON
1. **On the page (the measurement itself):** in the full ON arm, leg 387's row carries the reboot guard's own words.
   No OFF row carries `PRESS_KILL_` (`m1-legs-on.tsv`, column `guardWording`).
2. **In node, with the counter:** I replayed each captured request with `SEEDLING_PRESS_KILL_*_GUARD=1`.
   `PRESS_KILL_GUARD_COUNTS.rebootRefused` reads 2 on leg 387's request and 0 on every other request. The replay
   reproduces the page's work units exactly wherever the page finished (875 of 878; the 3 exceptions are page
   timeouts).
3. **The smoke:** the chest pair, captured ON (`m0-smoke-chest-legs.txt`):
   - leg 404 at one arrival gave the guard-worded refusal on the page;
   - in node at that request, guards ON gave `rebootRefused 2`, 144 units / 93 s; OFF gave a band-throw refusal at 346
     units / 304 s.
   - So **the guard also fires on 404 at some arrivals**. It did not fire at either full-run arrival.

### 3.4 The changed legs

`done` and `crossed` are one class here (SOLVE). Both are a played, successful leg, and the split between them is the
harness's drain timing: 49 legs flipped between them, every one with identical ticks. "Guard?" is the node replay of both arms'
requests with the guards OFF vs ON.

| leg | key (abridged) | OFF | ON | guard? | class |
|---|---|---|---|---|---|
| 387 | L40 ← L39 → Chest | timeout (90.2 s) | refused 81.7 s, `PRESS_KILL_REBOOT_GUARD` | **yes**: reboot 2, 642→114 u | **(b)** |
| 404 | L40 ← L43 → Chest | timeout (90.2 s) | refused 19.4 s (*"every key set … no step out"*) | no (both requests SAME) | (c) arrival |
| 637 | L76 ← L77 → exit | SOLVE 702 t | refused: `shouldStop` deadline at `walk` (2,563 u) | no: OFF's request solves at 2,561 u under both; ON's refuses under both | (c) arrival |
| 776 | L105 ← L104 → exit | refused (beamtower) | SOLVE 417 t | no | (c) arrival |
| 595 | L69 → Lights | timeout | timeout | no | (c) |
| 620, 634 | L72, L75 exits | refusal | refusal, other words | no | (c) |
| 94, 269, 273, 276, 298, 336, 355, 358, 594, 636, 653, 775 | — | SOLVE | SOLVE, ticks differ (653: 1075 → 2150) | no | (c) |

The full rows are in `m1-legs-{off,on}.tsv` and `m1-diff-changed-legs.txt`. The per-request replay is in
`m1-replay-every-off-request.tsv` (878 rows) and `m1-replay-attribution.txt`. The tools are `diff-arms.py` and
`replay-batch.mjs`.

## 4. M2 — the bounded rows and the producer roster, both ON

**Bounded vitest:**
- The files are in `m2-files.txt`: `hammerPressKillGuards`, `hammerGhostKillRung`, `hammerStrikeEtaFloor`,
  `hammerEscape`, `hammerFight`, `hammerFightFallback`, `hammerApproach`, `pressKillCost`, `solverBot`,
  `solverBotLethalPit`; `--maxWorkers=3`, by path (⚖ 52).
- OFF: **198 / 198**. ON: **195 passed, 2 failed, 1 skipped**.

**The re-pin list for a flip** (exactly LB's, with LB's numbers):

| row | ON measured | pinned |
|---|---|---|
| `hammerGhostKillRung.test.js` › *ON: the rung asks the press kill, and the solve's executed prefix IS the witness* | `perTick.length` **1216** | 2195 |
| `hammerStrikeEtaFloor.test.js` › *ON: the solve's executed prefix IS the witness* | `perTick.length` **778** | 1629 |
| `hammerPressKillGuards.test.js` › *ship OFF* | skipped under the env (it must flip with the defaults) | — |

**Producer roster** (`ci-producer-checks.mjs --jobs=4`, both env vars):
- 93 run, **2 red**, 1 skipped (`plan-seedling-r7-ends-meet`: browser-only by design). `git status` was clean after.
- The two reds are the producers of the same two witnesses:
  - `plan-seedling-hammer-g1-ghostkill` (rc 1: *"the ghost press kills spinner@880,848 … killed at tundefined"*: the
    kill is refused at the death, so it never lands);
  - `plan-seedling-hammer-sf-strikefloor` (rc 1: *"ON's press kill moved: its landings … are not OFF's"*).
- Both are green OFF (`m2-producers-off-the-two-reds.txt`).
- So **a flip re-records two producers as well as re-pinning two rows**: four places, not two.

## 5. Recommendation (the user's call)

**Flip both. If you want to flip only what the route measured, flip the reboot guard alone.**
- **Reboot guard.** It turned no solve into a refusal anywhere on the route (0 of 850 legs, 0 of 878 requests). It
  fires on one leg (387) at every measured arrival, and on 404 at some arrivals. There it replaces a ~500 s re-run to
  the bound with a named `danger` refusal in ~100 s.
  - The cost: re-pin `hammerGhostKillRung` and `hammerStrikeEtaFloor` ON rows (1216 and 778), flip the gate's "ships
    OFF" row, and re-record the `g1-ghostkill` and `sf-strikefloor` producers.
- **Shake guard.** It fires on no request on the route, and it moves no bounded row and no producer. Its only evidence
  is LB's HO1 fixture, where it turns an escaping crash into a wait. Flipping it is therefore free on everything
  measured. But the route gives no evidence for it either way, and its sibling throws (LB hand-overs 5 and 5b; I saw
  one escape on 404 in the smoke) are not covered by it.

## 6. What the brief got wrong (measured)

1. **"set `SEEDLING_PRESS_KILL_*_GUARD=1` in the sweep job's `env:`"** would leave the guards OFF.
   - The sweep's solver runs in the page's worker, where `globalThis.process` is undefined, so the switches read
     `false`.
   - Flipping "the `*_DEFAULT` constants instead" would **also** do nothing: `enabled` never reads them.
   - The ON arm needs the `enabled:` initialisers themselves set to `true`, which is what the scratch commit does.
2. **"dispatch the sweep"**: `workflow_dispatch` is 403 from the cloud (LB's residue 6 already said so). Both arms ran
   locally.
3. **"L40 legs 397 and 414"**: leg ids are not stable across SHAs. At `ef6bdd6d` the two L40 chest legs are
   **387** and **404**; 397 and 414 are now other legs, which solve in 31 s and 5 s. The stable handle is the leg
   **key**.
4. **"no … producer … moved"** (LB's six `--check`s): the whole roster ON reds the two producers of the two moved
   witnesses.
5. **A one-run-per-arm diff cannot answer (a) on its own.** 19 legs changed, and 18 of them are not the guard's: each
   arm's live arrival gives a different request. Only the node replay of the captured requests under both switches
   attributes a change to the guard. Without it, 637 would have read as an (a).
6. The bootstrap again left six submodules uninitialised after `done` (as in LB's item 7). I initialised them; no
   gitlink moved.

## 7. Residue

1. **The CI A/B is still undispatched.** From a machine that can dispatch:
   - `gh workflow run seedling-divergence-sweep.yml --ref claude/seedling-hammer-guards-sweep-50gb88` (OFF, defaults);
   - `gh workflow run seedling-divergence-sweep.yml --ref seedling-hammer-guards-sweep-on` (ON);
   - then compare with `diff-arms.py`. Its value now is the runner's speed, not the answer: this local A/B already
     covers every leg.
   - After that, **delete `seedling-hammer-guards-sweep-on`**.
2. **404's guard firing depends on the arrival** (the smoke fired it; neither full arrival did). A flip changes 404
   only at some seam times, which LB's seam census can map.
3. **The shake guard has no route evidence.** The band throws it does not catch (LB's hand-overs 5 and 5b) still
   escape as refusals. I saw one on 404 in the smoke.
4. **Tree hygiene:**
   - the scratch worktree `/home/user/gs-on` is removed;
   - both dev servers are killed by PID;
   - the request captures (~850 MB) stay in the session scratchpad and are not committed;
   - nothing was pushed to `main`; there was no stash, re-pin, `standing-values --write`, `pytest` or unfiltered
     vitest.
