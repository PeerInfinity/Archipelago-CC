# Cloud report: `seedling-hammer-entry38-shove` (L63 → L61 spear-block push)

Planner: `seedling-hammer-phase-planning-17`. ⚖ Approved by the user on 2026-11-27: *"Entry-38 shove slice (Recommended)"*. Measure first,
switch-guarded OFF. **Not for landing without the user's own SHA-bound OK.** No planner follow-up arrived during the session.

## 1. Start, head, branch
- **Start:** `48fb4afab1` = `hammer-probe-rm12-wba` (`hammer-probe-rm12-all` @d1725843a2 + `hammer-harvest-l65-wba`).
- **Branch:** `claude/seedling-entry38-shove-qrlxqv`. The harness pinned this branch; the brief's `seedling-hammer-entry38-shove` was not used.
- **Commits:**
  - `dec9d6b6` the switch;
  - `2c1062a4` the rows and the census regen;
  - an evidence commit;
  - this report (the head).
- Evidence came from re-measure-12's ref `claude/whole-game-remeasure-12-vi66rx` @ee11cbe55e. It was read into the scratchpad and **not committed**.

## 2. The answer first
- **Switch: `SPEAR_PRESS_GATE_WAIT`** (`SEEDLING_SPEAR_PRESS_GATE_WAIT=1`, OFF). It lives in the family file `spearPressGateWait.js`, with one import and one call site in `execSpearPress`.
- **Entry 38 is still not solved, under any arm.** The switch fixes the defect the refusal names. What stands behind it is a different wall.
- **The one thing to know first: under the stack the user folded (ALL+WBA), the brief's refusal is not the answer, and this switch does nothing there.**
  - With WBA, the walk holds the sword, so the thrust is never swallowed and route step 1 lands.
  - 38:2 then refuses as **`ced4eb40568d`**, at **route step 2/4**:
    - The full pass is **budget-cut** (work 438 of the 640 left after dashless).
    - The dashless pass's step-2 stance (120,104) takes a `spinningaxe@128,80` hit at t548.
  - Given budget (2000+), the full pass **solves in 651 t with 1 hit**: `chaser:jellyfish@192,56` at t459, during route step 2's idle glide wait.
  - The existing hit-avoid pass finds no hitless delay in 15 tries (window 6000).
- **Numbers.**
  - Solved: 0 of 3 entry-38/39 exit requests, in every arm.
  - Hitless plans gained: 0. Hits gained: 0 anywhere.
  - Survey: 0 movers in 250 steps. Sweep: 45/45 L63/L61 legs identical.
  - Captured requests: 3 of 38 move (refusal → refusal), all under ALL.

## 3. The reproduction (measured, at the base)
Node replays of re-measure-12's captures (`tools/rep1.mjs`, `tools/planhits.mjs`):

| request | ALL | ALL+WBA | base (no env) |
|---|---|---|---|
| A1 38:2 `wasm-exit-63` | `b111a61f68bb` (518): *"… shove (route step 1/4: press): 56 ticks after the thrust (tick 301) pushableblockspear@112,96 is at (112,96), not settled on (6,6)."* | **`ced4eb40568d`** (642): *"… shove (route step 2/4: press): the walk settled at (113.03…,140.38…) and the spear's 32x5 rect facing W from there misses pushableblockspear@112,96 at (96,96) — a stance finding, not a block one."* | `33d1bad340b8` (WandShot vs `grenade@128,128`) |
| P1 38:2 | `b111a61f68bb` | `ced4eb40568d` | — |
| P1 39:0 | `b111a61f68bb` | `ced4eb40568d` | — |

**Ladder passes:**
- ALL: dashless refusal (188), then full refusal (330).
- ALL+WBA: dashless refusal (204), then full refusal (438, `deadline: sword-dash`, `limit: budget`).

### The route (both arms)
It is four W thrusts at `pushableblockspear@112,96`: tile 7→6→5→4→3. The last one sinks the block (`destroys`). The stances are
(152,104), (120,104), (104,104) and (88,104).

### Under ALL: the thrust is swallowed (temporary debug, since removed)
- **The dashless pass lands step 1.** Its thrust at t297 hits and moves the block.
- **The full pass's thrust is swallowed.**
  - The walk to the stance runs with the **wand selected**. Its strike policy presses `primary` at **t294**, a WandShot whose window `_wanding` is up through **t301**.
  - `execSpearPress` waits out the walk's coast, the face tap and a freeze, then presses on **t301**: the window's own end tick.
  - `set spearing`'s gate swallows the press: `Player.as:815`, `if (hasSpear && !wanding && !firing && !deathRaying && !slashing)`, transcribed by fidelity DARKTRAP2 D2 as `CONTACT_FIDELITY.spearingWindow`, ON.
  - No thrust is recorded. The glide wait idles 56 ticks, and the block never moves.

### Is the push a model gap? No. The game swallows it too.
I played the full pass's own keys (t0–t357, equip at t301) on a **fresh p4g page**, logic-only channel (`tools/p4g-block.mjs`), and read
`botStatus` and `botMobiles` every tick:
- The game's `PushableBlockSpear` is at **(112,96) on every polled tick through t357**, the same as the model.
- The player is at **0 px on 342 of the 343 compared ticks**, and both sides take the same `spinningaxe@128,80` hit at **t350** (idle at the stance).
- The one difference is the tape's final row, t358: game x 181.68 vs model 179.85.
  - That row is read after `finished`. It is not investigated and not on any plan path.

**Verdict:** the solver's thrust misses on **timing**. It is not facing, reach or the push model. No fidelity hand-over for this half.

### Is this shove a survey step? No
- `survey-seedling-route.mjs --through=end` never takes L63's (0,96) exit.
- It reaches L71 by L68 → L0 → L12 → L83 → L84 → L85 → L71 (steps 183–188), then 189.
- Its L63 steps are 122, 156, 181 (→L65) and 211 (Level 063 – Chest).

## 4. Design and change; OFF identity
**`SPEAR_PRESS_GATE_WAIT`** (`frontend/modules/seedlingDemo/spearPressGateWait.js`):
- **Where:** after the freeze wait and before the reach re-ask, `execSpearPress` calls `waitSpearPressGate`.
- **What it reads:** the run's own `slashInfo` progress field, via `spearPressGates`. That gives `gate.wanding`, `gate.firing`, `gate.spearing` and `state.slashing`, which are exactly the terms of `set spearing`'s gate.
- **What it does:** while any gate is up, it steps one idle tick, bounded by `SPEAR_PRESS_GATE_BOUND` = 60, and then refuses by name.
- **What it records:** a counter, `{asked, waited[], refused}`.
- **What it does not do:** idle ticks are ordinary run ticks, billed like the glide wait's. Nothing certifies a tick hitless.
- **Constants:** none single-game. It reads the run's gate only.
- **Thread:** the solve **worker** and node. No main-thread mapper reads it, so the env channel is the whole page wiring.
- **Env table:** the name is added to `SOLVER_ENV_NAMES`.
- **solverBot.js:** +8 lines (one import, one guarded call). No reformatting and no renames.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives the same value at the base worktree (`48fb4afab1`)
and at the head: **`391322d681b7aa0229d94b3f6906d024`**, both.

## 5. Rows and bounded vitest runs
**`spearPressGateWait.test.js`** (default tier, 12 rows, 1.4 s):
- the switch: OFF, its env name, the with-wrapper;
- the pure gate rule: four gates, a fixed order, a missing field reads as down;
- the wait: 0 ticks when the gate is down; exactly k ticks for a k-tick gate; refuses at the bound;
- the one guarded call site, placed between the freeze wait and the reach check;
- no single-game constant and no run getter in the family file;
- **a committed-fixture witness.** `r8-solve-11`'s staging is booted at L63 (144,104) with the Spear and Wand held, and the wand is pressed in a one-tick prefix.
  - The solve then goes through `solveFromTape` (the page's tape path).
  - **OFF** reproduces entry 38's refusal verbatim (`route step 1/4: press: 56 ticks after the thrust (tick 6) … not settled on (6,6).`).
  - **ON** waits 2 ticks on `wanding`, and route step 1 lands. It then stops at the next wall: a walk-fired WandShot at `jellyfish@160,64`.

It is cheap, so no train-tier row. A row on 38:2 itself would need re-measure-12's capture, which stays off-tree.

**Bounded runs:**
- `npx vitest run` over `spearPressGateWait.test.js`, `solverEnvChannel.test.js`, `spearPush.test.js`, `walkBladeArm.test.js` and `scripts/procgen/`: **2210 / 2211 passed** (151 files).
- The 1 red is `standingValues.test.js` › *"a gate that sleeps past the deadline is KILLED"*. It **fails the same way at the base worktree**: an environment process-group kill, not this change.

**Census and docs:**
- `census-seedling-solver-surface.mjs --write`: +1 family file, solverBot sites 221 → 222. `--check` is GREEN.
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were re-run with no diff.
- No docs under `docs/json/developer/procgen/` were edited.

## 6. Page play / game witness
- **No plan solves, so there is no solved plan to witness.**
- The game witness of the failing path is in §3: `p4g-38-2-full-pass-block-track.txt`. The game agrees with the model; the block does not move.
- Under the switch, ALL's 38:2 refuses later (`e3c7bae55ba0`): *"levelRun: a wand shot (wand@63#421) reached the enemy "jellyfish@192,56" at tick 431 …"*.
  The walk to route step 2 fires the still-selected wand at the trailing jellyfish.
- **So the walk would not reach L71 under either arm.**

## 7. Census: what the change can move

| measurement | scope | result |
|---|---|---|
| Captured requests (node, each request's own budget; ON arms solved, plans replayed fresh) | all **38** in A1 (19, 24, 37, 38) and P1 (38, 39), under ALL±switch and ALL+WBA±switch | The gate is asked in 16 ON solves. It **waits in only 3**: A1 38:2, P1 38:2 and P1 39:0 under ALL (1 wait each, 1 tick, `wanding`), moving `b111a61f68bb` → `e3c7bae55ba0`, refusal → refusal. Every other request reads the gate down, so it is identical by construction (the only effect is inside the wait). No hit added anywhere; the only hit plans (24:3 tentacle, ALL's 37:9 bob) are unchanged |
| Route survey `--through=end` | 250 steps, base env OFF vs switch ON | **0 movers.** Every row is identical except `ms`: 226 SOLVED, 3 with hits (24, 202, 220), the same in both arms |
| Live p4g divergence sweep (`--mode=inv --page-legs=1`, wand keys as `--contact-fidelity`, `--solver-env` = ALL−wand keys + WBA, ±switch) | all **45** L63/L61 legs (keys below) | **45/45 identical** (end, failure, room hits, last plan). 30 done and 15 failed in both arms. 0 room hits |

**Why so little moves:**
- A press is swallowed only when a wand, fire or spear window, or a swing, is still up on the thrust tick.
- On a fresh sweep page the sword is selected, so the walks swing rather than wand.
- Only the session-carried wand selection (whole-game entry 37's AXE swap leaves the wand selected) opens the window.

On fresh sweep pages **three of the four** `level_63__r0c1 … -> exit:out_teleporter_0_96` legs are done, with 0 hits. The fourth (`<- in_L62_240_304`)
fails by the combat ladder in both arms.

**The sweep legs measured, by KEY:**
- `level_61__r0c7`:
  - `<- in_L60_160_80 -> exit:out_teleporter_0_160`, `… -> exit:out_teleporter_112_0`, `… -> exit:out_teleporter_224_96`;
  - `<- in_L62_48_304 -> exit:out_teleporter_0_160`, `… _112_0`, `… _224_96`;
  - `<- in_L63_0_96 -> exit:out_teleporter_0_160`, `… _112_0`, `… _224_96`.
- `level_61__r0c10`:
  - `<- in_L62_96_304 -> exit:out_teleporter_160_0`, `… _224_48`, `… -> location:L63 flag 1: lightpole@64,88 cleared`;
  - `<- in_L63_0_48 -> exit:out_teleporter_160_0`, `… _224_48`, `… -> location:L63 flag 1: lightpole@64,88 cleared`.
- `level_61__r13c12 <- in_L63_0_208 -> exit:out_teleporter_224_208`.
- `level_63__r0c1`, from each of `in_L61_224_96`, `in_L61_224_48`, `in_L62_192_304` and `in_L62_240_304`:
  - `-> exit:out_teleporter_0_48`, `_0_96`, `_16_0`, `_64_0`;
  - `-> location:L62 flag 0: lightpole@120,200 cleared`.
- `level_63__r6c9 <- in_L65_128_0 -> exit:out_teleporter_128_304`, and `… -> location:L63 flag 7: lightpole@112,272 cleared`.
- `level_63__r10c2`, from each of `in_L61_224_208` and `in_L65_32_0`:
  - `-> exit:out_teleporter_0_208`, `_32_304`;
  - `-> location:L63 flag 6: lightpole@48,272 cleared`.
- `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest`.

The full rows are in `sweep-l63-l61-off-vs-on.txt`.

## 8. What the brief got wrong (measured)
- **"No switch rescues it" holds; "the shove does not settle" does not describe the stack.**
  - It is true under ALL, where the defect is the swallowed thrust, now fixed by the switch.
  - Under ALL+WBA, the folded stack, step 1 already lands. The refusal there is `ced4eb40568d` at route step 2, not `b111a61f68bb`.
- **"A re-aimed or repeated thrust, or a stand that lands the push":** the thrust needs none of these. It needs **timing**, a 1–2 tick wait for the wand window.
  - What blocks the leg is not the push at all. It is the trailing jellyfish and the step-2 stance walk's cost.
- **"Is this shove also a survey step?":** no (§3).

## 9. Residue / hand-overs
1. **The next wall: route step 2, all measured under ALL+WBA.**
   - The step-2 stance walk from (151.6,104.9) to (120,104) detours south around `spinningaxe@128,80` (t333 → t423, 90 ticks). It is costly enough that the full pass budget-cuts at the page's 640.
   - `jellyfish@192,56` (2 hits taken) trails the player west at about 0.5 px/tick. It reaches the player at **t459**, during step 2's idle glide wait at (118.7,103.9).
   - The jellyfish stalls at x≈118.2 from t480, so the later stances (104 and 88) are clear of it.
   - The trace is in `trace-allwba-b2000-jellyfish.txt`.
   - **Candidates (not built; each needs its own approval):**
     - (a) the press verb's glide wait follows the gliding block toward the next stance instead of idling;
     - (b) kill the jellyfish before the route;
     - (c) a cheaper step-2 stance walk.
   - Whatever the fix, the plan must stay hitless, and the dashless pass's step-2 stance takes the axe at t548.
2. **Under ALL without WBA:** after this switch, the walk fires the still-selected **wand** at that same jellyfish, and levelRun refuses an unmodelled wand–enemy hit.
   - WBA avoids that by selecting the blade. That is one more reason the two belong together.
3. **Fidelity:** no hand-over. The model's block track and gate match the game (§3). The final-row diff at t358 was noted but not investigated.
4. **Not done:** no whole-game walk (as the brief asks), no `standing-values --write`, no pytest, no unfiltered vitest.
5. **Box state:** I started a dev server on port 8000, killed by PID at the end. The scratch base worktree was removed.
