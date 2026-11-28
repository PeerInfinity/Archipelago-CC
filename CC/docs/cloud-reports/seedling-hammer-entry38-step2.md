# Cloud report: `seedling-hammer-entry38-step2` (L63 → L61 spear route, step 2)

Planner: `seedling-hammer-phase-planning-18`. ⚖ Approved by the user on 2026-11-27: *"Measure-first slice (Recommended)"*. Measure first,
switch-guarded OFF. **Not for landing without the user's own SHA-bound OK.** No planner follow-up arrived during the session.

## 1. Start, head, branch
- **Start:** `f67cb64987` = `hammer-probe-rm12-wba` (the stack + fidelity W62–W68 + AXE + WBA + SPGW).
- **Branch:** `claude/seedling-hammer-entry38-step2-cqmyzi` (the harness pinned it).
- **Commits:**
  - `95e2d2ff` the reproduction and the (a)/(c) measurements (evidence);
  - `6b4f79e4` the (b) measurement (evidence);
  - `9733672f` the switch;
  - `ba3643e0` the rows and the census regen;
  - `e43bb0bb` the settle test takes the caller's reads, so the family file reads no run getter (`entityBlocks.test.js`'s pin, §5);
  - `340570ae`, `5b99012e` and `0720f154`, the step-5 evidence (census and game witness, survey, sweep);
  - this report (the head).
- Re-measure-12's captures (`claude/whole-game-remeasure-12-vi66rx` @ee11cbe55e, `A1.requests-19-24-37-38` and `P1.requests-38-39`) were read into the
  scratchpad and **not committed**.
- Evidence: `CC/docs/cloud-reports/seedling-hammer-entry38-step2-evidence/`.

## 2. The answer first
- **Switch: `PRESS_GLIDE_FOLLOW`** (`SEEDLING_PRESS_GLIDE_FOLLOW=1`, OFF). It is candidate **(a)**, built in its only safe form: **the glide wait leans, and a fork admits the lean.**
  It lives in the family file `pressGlideFollow.js`. solverBot.js has one import, the hook handed to the press step in `execRoute` (guarded), and the glide wait asking it.
- **Entry 38 solves hitless at the page's own budget.**
  - Under ALL+WBA + the switch, A1 38:2, P1 38:2 and P1 39:0 go from refusal `ced4eb40568d` to **SOLVED `3aaff030ee8b`: 694 t, 0 model hits** (work 581 of 640).
  - **p4g fresh-page game witness: 0 game hits**, finished at L61 (216,104), and the player equals the model on all 694 ticks.
- **The one thing to know first: the walk planner cannot be asked mid-glide, and an unguarded lean kills the player.** Two cheaper forms of (a) were built and measured first:
  - *Walk to the next stance during the glide* refuses `STANCE_REENTRY`: the gliding block still covers the stance's tile until it settles.
  - *Hold the push key during the glide* walks step 1's lean into `spinningaxe@128,80`'s sweep. The player dies (t332), the room resets and the route refuses.
  - The fork makes it safe. Step 1's lean is refused (*"the lean dies on the fork"*), and steps 2 and 3 lean 17 ticks each. The lean that matters is step 2's: it leaves the trailing jellyfish behind.
- **Numbers.**
  - Captured requests: **3 of 38 move**, all refusal → hitless solve; 35 are identical. No hit is added anywhere.
  - Survey `--through=end` (ALL+WBA ±switch): **0 movers in 250 steps**. 229 solved in both arms, with the same three hit steps (24, 202, 220).
  - Sweep: **45/45 L63/L61 legs identical by key**. 30 done and 15 failed in both arms; 0 room hits.
  - OFF identity: acceptance md5 `391322d681b7aa0229d94b3f6906d024` at base and head.

## 3. The reproduction (measured, at the base)
Node replays of the captures (`tools/planhits2.mjs`: solve, then replay the plan fresh), under ALL+WBA (`repro-off.txt`):

| request | budget 640 (the page's) | budget 2000 |
|---|---|---|
| A1 38:2 `wasm-exit-63` | **`ced4eb40568d`** (642): dashless refusal (204), full refusal (438, `deadline: sword-dash`, `limit: budget`) | `e80ac309abe1`: **651 t, 1 hit**, `chaser:jellyfish@192,56` at **t459**; hit-avoid cut by its window (1 try) |
| P1 38:2 | the same | the same |
| P1 39:0 | the same | the same |

The refusal text is the dashless pass's: *"… shove (route step 2/4: press): the walk settled at (113.03…,140.38…) and the spear's 32x5 rect facing W from there misses
pushableblockspear@112,96 at (96,96) — a stance finding, not a block one."*

**Where the work goes.** A temporary site-ask hook (since removed) counted the full pass alone at budget 2000:
- 304 asks up to route step 1 (axe-dodge 152, sword-dash 125).
- **226 for step 2's stance walk** (sword-dash 217).
- 32 for steps 3–4, and about 40 to the exit after the route.
- The page's 640 leaves the full pass 436 after the dashless pass's 204. It needs 601.

**Step 2's stance walk** (the trace row at t333):
- Path (152,136) → (120,136) → (120,104): the south detour.
- Dashed: 90 t against an undashed baseline of 118; 216 previews scanned.

## 4. Design and change; OFF identity

### Step 2: the three candidates, measured (`candidates.txt`)
Each was probed on A1 38:2's full-pass plan (budget 2000) with `tools/probe.mjs`, which replays T plan keys and then a scripted tail.

- **(c) A cheaper step-2 stance walk: there is none.**
  - The direct walk west along the stance row, from t333 at stalls 0–80 (more than one axe period), is hit by `spinningaxe@128,80` every time.
  - The stance (152,104) is itself in the sweep at t350.
  - Detours south to rows 116–136: only rows 130–136 are clean, arriving at t423–432. The plan's own arrival is t423.
  - So the 90-tick detour is the hitless shape and already about minimal in ticks. What makes it expensive is the dash scan (217 asks), not the path.
- **(b) Kill `jellyfish@192,56` before the route: possible, but not the cheapest.**
  - Scripted chase-and-swing variants from the step-1 approach (plan ticks 282, 298 and 333; 60 variants each) kill it hitless in as little as 8 ticks (40–57 of 60 hitless).
  - But no verb does that. It would need a new pre-route kill verb and its search, on a request already 165 units over budget.
- **(a) The glide wait follows the block: hitless.**
  - From step 2's thrust (t429), holding the push key toward the next stance instead of idling takes **0 hits** through the sink. The jellyfish stalls at x≈118 on its own.
  - It is also 11 ticks shorter. The idle control takes the t459 hit.
  - Unguarded at step 1, the same lean dies in the axe's sweep.

### What was built: `PRESS_GLIDE_FOLLOW` (`frontend/modules/seedlingDemo/pressGlideFollow.js`)
- **Eligible:** route step `i` is a `press` that does not sink, and step `i+1` is a `press` in the **same direction** from a stance (a push chain: the block glides away from the side of the next stance).
- **When:** in `execSpearPress`'s glide wait, on the first tick at which the thrust has landed (the block has left its rect, or is gone) and the press gates (`spearPressGates`) are down.
- **What:** the lean is played on a **fork** of the run (`ctx.fork()`, `LATCHED_HOLD_MOVE`'s pattern).
  - Each tick holds the push key while the player is short of the next stance on the push axis, else nothing, until the block settles or the bound runs out.
  - The fork admits the lean only when it takes **no death, no hit**, crosses no door, and the block still **settles on `to`**.
  - Admitted, the lean ticks are handed out live, one per glide-wait tick, and then the wait idles as before. Refused, the wait idles as before.
  - The settle check, the bound, `execRoute`'s post-condition and step `i+1`'s own stance walk are all unchanged.
- **Counter:** `{asked, eligible, followed[], declined[]}`.
- **Constants:** none single-game. It reads the route's steps, the block's live rect, the run's gates and the fork's ledgers. The tile size comes from the caller.
- **Thread:** the solve **worker** and node (`execRoute`/`execSpearPress`). No main-thread mapper reads it, so the env channel is the whole page wiring.
- **Env table:** the name is added to `SOLVER_ENV_NAMES`.
- **solverBot.js:** +11/−2 (one import, the guarded hook in the press step, the glide wait's ask). No reformatting and no renames.

**Two rejected forms** (both measured on A1 38:2, then rewritten before commit):
1. **Walk with `walkTo` during the glide:** `STANCE_REENTRY`. The stance walk is *"itself blocked by pushableblockspear@112,96 at tick 304"*. A solve (budget 2000) would have turned into a refusal.
2. **An unguarded lean:**
   - The full pass alone refuses at step 1 (*"56 ticks after the thrust (tick 298) … at (112,96), not settled on (6,6)"*): the player died at t332 in the axe's sweep, and the room reset.
   - At the page's budget, the dashless pass ships 767 t with 2 hits.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` = **`391322d681b7aa0229d94b3f6906d024`** at the base (`f67cb64987`) and at the head.

## 5. Rows and bounded vitest runs
**`pressGlideFollow.test.js`** (default tier, 15 rows, ~4 s):
- the switch: OFF, its env name, the with-wrapper;
- `glideFollowNext`: a same-direction chain only. A sink, the last step, a turn, a next step without a stance, and another verb are refused;
- `glideFollowReady`: the thrust has landed and no gate is up;
- `shortOfStance`: the push axis only;
- `blockSettledOn`: the verb's settle test;
- `leanOnFork`: the lean's keys, and each refusal by name (no fork, a door, a death, a hit, no settle, already level);
- the hook: asked once, then the keys handed out tick by tick, and no second fork after a refusal;
- the two guarded readers, and no single-game constant in the family file;
- **a committed-fixture witness.** `r8-solve-11`'s staging is booted at L63 (144,104) with the Spear and Wand held and the **sword** selected, with WBA and SPGW on, solving the reach-exit (0,96). This is the same four-thrust W chain at `pushableblockspear@112,96`.
  - **OFF** solves, and its replay takes `chaser:jellyfish@160,64` in an idle glide wait (409 t).
  - **ON** solves **hitless and shorter** (394 t). Step 1's lean is refused with *"the lean dies on the fork"*, and steps 2 and 3 lean.

It is cheap, so no train-tier row. A row on 38:2 itself would need re-measure-12's capture, which stays off-tree.

**Bounded runs:** `npx vitest run` over `pressGlideFollow.test.js`, `spearPressGateWait.test.js`, `solverEnvChannel.test.js`, `spearPush.test.js` and `walkBladeArm.test.js`: **52 / 52 passed** (5 files).
No other test reads `execSpearPress`'s or `execRoute`'s source (`rg -a` over `*.test.*`).

The census's readers are `seedlingSolverSurface.test.js`, `frontend/modules/procgenDocs/` and `entityBlocks.test.js`.
- The first run was **1 red of 563**. `entityBlocks.test.js`'s FAMILY_BLOCKS pin found `entities('pushables')` read in `pressGlideFollow.js`, which is not in the registry.
- I did not widen the registry. The settle test now takes the caller's two reads, and solverBot.js does the reading (`e43bb0bb`).
- Re-run, the three census readers plus this file: **81 / 81**.
- Re-measured after that change, all as before: OFF md5, census `--check`, A1 38:2 ON (`3aaff030ee8b`), and the fixture witness.

**Census and docs:**
- `census-seedling-solver-surface.mjs --write`: +1 family file, solverBot sites 222 → 223. `--check` is GREEN (375 rows).
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs` were re-run with no diff.
- No docs under `docs/json/developer/procgen/` were edited.

## 6. Page play / game witness
**p4g fresh-page witness** (`seedling_bot_ap_p4g`, headless logic-only channel) of A1 38:2's ON plan at the page's budget, using `tools/p4g-block.mjs` (`p4g-38-2-on-plan.txt`):
- **The game finishes at L61 (216,104) with 0 hits**, on tick 694.
- **The player matches the model on all 694 of 694 compared ticks.**
- The block track matches on every tick but one, t581, on the sink's last frame: the game has already dropped the block from `botMobiles`, and the model's `removed` lands the next tick (`pushables.js`: *"`removed` lands the NEXT tick"*).
  - That is a read-phase difference of the observer, not a plan-path difference: the player is the same before and after it.
- **How far it gets:** the whole leg, L63's (0,96) exit into L61.
- **Does the walk then reach L71? Not measured.** That needs the whole-game walk, which this brief excludes.
  - Entry 38 is no longer the wall at this request.
  - The captures hold no request past P1 39:0, which is this same request asked again.

## 7. Census: what the change can move

| measurement | scope | result |
|---|---|---|
| Captured requests (node, each request's own budget, ALL+WBA ±switch; plans replayed fresh; `census-38-requests.txt`) | all **38** in A1 (19, 24, 37, 38) and P1 (38, 39) | **3 move**: A1 38:2, P1 38:2 and P1 39:0, from refusal `ced4eb40568d` to **SOLVED `3aaff030ee8b`, 694 t, 0 hits**. **35 are identical** (the same answer sha, work, ticks and hits). The hook is asked in 8 ON solves and eligible only in those three. Elsewhere `asked` counts press steps with no same-direction next stance. No hit is added anywhere; the only hit plan, 24:3's `tentacle#41`, is in both arms |
| Route survey `--through=end` | 250 steps, ALL+WBA ±switch | **0 movers**. Every row is identical but `ms`. 229 SOLVED; the same three with replay hits, 24 (L16 1h), 202 (L82 2h) and 220 (L82 2h) |
| Live p4g divergence sweep (`--mode=inv --page-legs=1`, wand keys as `--contact-fidelity`, `--solver-env` = ALL+WBA minus the wand keys, ±switch) | the shove slice's **45** L63/L61 legs, by KEY | **45/45 identical** in end, failure, room hits (less the wall-clock `samples` count) and last plan (ticks, end, verbs, passes less `ms`). 30 done and 15 failed in both arms. 0 room hits |

**Why so little moves:**
- The rule needs a spear push chain: two `press` route steps in the same direction.
- On the seed-1 roster, only L63's `pushableblockspear@112,96` route makes one, and only when the arrival leaves that route the open path.
- On fresh sweep pages the `level_63__r0c1 … -> exit:out_teleporter_0_96` legs reach the exit another way:
  - 3 done (84, 5 and 89 t);
  - `<- in_L62_240_304` fails by the combat ladder in both arms.
- Only the whole-game walk's carried state (entry 38, re-measure-12's captures) asks that route.

**The sweep legs measured, by KEY:** the same 45 as the shove slice:
- `level_61__r0c7`:
  - `<- in_L60_160_80`, `<- in_L62_48_304` and `<- in_L63_0_96`, each `-> exit:out_teleporter_0_160`, `_112_0` and `_224_96`.
- `level_61__r0c10`:
  - `<- in_L62_96_304` and `<- in_L63_0_48`, each `-> exit:out_teleporter_160_0`, `_224_48`, and `-> location:L63 flag 1: lightpole@64,88 cleared`.
- `level_61__r13c12 <- in_L63_0_208 -> exit:out_teleporter_224_208`.
- `level_63__r0c1`, from each of `in_L61_224_96`, `in_L61_224_48`, `in_L62_192_304` and `in_L62_240_304`:
  - `-> exit:out_teleporter_0_48`, `_0_96`, `_16_0`, `_64_0`;
  - `-> location:L62 flag 0: lightpole@120,200 cleared`.
- `level_63__r6c9 <- in_L65_128_0`, `-> exit:out_teleporter_128_304` and `-> location:L63 flag 7: lightpole@112,272 cleared`.
- `level_63__r10c2`, from each of `in_L61_224_208` and `in_L65_32_0`:
  - `-> exit:out_teleporter_0_208`, `_32_304`;
  - `-> location:L63 flag 6: lightpole@48,272 cleared`.
- `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest`.

The full rows are in `sweep-l63-l61-off-vs-on.txt`.

## 8. What the brief got wrong (measured)
- **"(c) a cheaper step-2 stance walk":** there is none in ticks.
  - The direct row is hit by the axe at every stall over a period.
  - The south detour is the hitless shape, and the plan's 90 t is about the clean minimum (arrival t423–432 on rows 130–136).
  - The 90-tick walk is expensive in *work* (the dash scan, 217 asks), not in ticks. But the budget wall did not need (c) at all: see the next point.
- **The budget wall was not a separate wall.** At 640, the base's full pass is budget-cut because the dashless pass has refused and the full pass is the only search.
  - With the switch, the dashless pass completes (767 t, 2 model hits: `jellyfish@160,64` at t269 before the route, and the axe at t349).
  - The full pass then runs with a plan in hand, under the upgrade window. It keeps its partial dash schedules (`DASH_KEEP_PARTIAL`), and its hitless 694-tick plan replaces the dashless one (`betterAnswer`).
  - So the shipped plan is hitless. **The dashless pass's 2-hit plan never ships**, but it is now a plan in hand where it was a refusal. Here it only moves the full pass onto its window.
- **"(a) follows the gliding block":** right in effect, but not as a walk. The planner cannot be asked mid-glide (§2), and an unguarded follow is lethal at step 1. The fork is what makes (a) a rule rather than a gamble.
- **"Does the jellyfish get left behind?"** Yes. It stalls at x≈118 in both arms (game-witnessed: the player track matches the game on every tick, and the game takes 0 hits).

## 9. Residue / hand-overs
1. **The dashless pass's 2-hit plan at 38:2** (`chaser:jellyfish@160,64` t269 before the route; `spinningaxe@128,80` t349 at step 1's stance).
   - It does not ship here: the full pass's hitless plan wins.
   - But a request whose full pass cannot finish would now meet a hit plan in hand rather than a refusal. The no-hit ladder (hit-avoid, stand-bombs, HIT_PLAN_RETRY) is what stands between that and shipping.
   - None of the 38 captured requests does this. Worth a row in a future slice if one appears.
2. **Fidelity:** no hand-over.
   - The one block-track difference is the sink's last frame (t581). The game drops the block from `botMobiles` a tick before the model's `removed` lands, which is the model's documented one-tick lag.
   - The player track is identical on all 694 ticks.
3. **Entry 38 → L71: not measured.** That needs the whole-game walk, which this brief excludes. Entry 38's (0,96) exit now solves hitless at the page's budget.
4. **Moved tree:** `e43bb0bb` (a behaviour-equivalent refactor) landed while the survey was at about step 170.
   - The re-measures in §5 show the same answers.
   - The sweep ran wholly at `340570ae`.
5. **Not done:** no whole-game walk, no full sweep, no `standing-values --write`, no pytest, no unfiltered vitest. No planner follow-up arrived.
6. **Box state:**
   - I started a dev server on port 8000 and killed it by PID at the end.
   - The sweep and the witness took and released the box lock.
   - Scratch captures and tools stay in the scratchpad.
