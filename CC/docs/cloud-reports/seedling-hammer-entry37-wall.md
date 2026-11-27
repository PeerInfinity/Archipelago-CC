# Seedling hammer-phase ENTRY-37 WALL — `AXE_TIMING_SWORD_SWAP`

Session `seedling-hammer-entry37-wall` (Opus, cloud), planner `seedling-hammer-phase-planning-17`.
⚖ Approved by the user on 2026-11-26 (*"Entry-37 wall (Recommended), L40 Chest spinner corner (Recommended), L39 18:11
arrival hit, Step-189 lavarunner"*). The new switch is OFF. Landing it needs the user's own SHA-bound OK.

## 1. Start SHA, head, branch

| | |
|---|---|
| base (start) | `48824c3310442d26097108134d4c05e2a4363eaa`, fidelity's W68 tip (`claude/wandshot-enemy-bodies-vuzsvv`): the linear stack W62 → W63 → W65 → W66 → W67 → W68, all keys OFF, none landed. It does NOT carry the hammer LHM flip or the six switches. |
| last code head | `607c1d715e89931059ff7018d6ca3a0f91adf059` |
| head | this report's commit (the last) |
| branch | `claude/seedling-hammer-entry37-wall-74hlcs` |
| commits | `1bc3fb19` (a) the switch · `b26165e4` (b) + the rows · `607c1d71` census regeneration · this report |

Every measurement below ran with **both wand keys ON** (`SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1`).

## 2. The answer first

- **Switch: `AXE_TIMING_SWORD_SWAP`** (`SEEDLING_AXE_TIMING_SWORD_SWAP=1`, OFF by default; `withAxeTimingSwordSwap`). It
  runs in the solve WORKER thread (solverBot, inside `solveSegment`). No main-thread mapper reads it.
- **37:8 solves, hitless, inside its own budget.** OFF it refuses `8c781b9832a7`. ON it returns a plan,
  `6fc9184e21ed`: 617 ticks, **0 hits / 0 deaths** on a fresh replay of its keys and equips. The solve costs 2309 of
  the 2560 work units (dashless pass 2049, full pass 260), leaving 251 spare. All five captures of 37:8 behave the same
  way (re-measure-11 S1, L1 and P1; re-measure-10 S1 and P1).
- **The game agrees.** On a fresh p4g page (headless logic-only), the plan's staged tape plays all 618 rows identical
  to the model (`firstDiff -1`). The game ends on L65 at (136,24) with `hits 0` and `finished true`.
- **The one thing to know first: the wall was never the budget.** Measured with no budget at all, 37:8 still refuses.
  The AXETIMING dash-chain rung — the only rung that can cross this blade — is gated on the sword being in `primary`.
  The run holds the sword but has the **wand** selected, so the rung refused with *"the `primary` slot fires `wand`"*.
  The switch lets that rung select the held sword for the crossing only, then select the wand again.
- **(b): no code change.** `previewWandShot` is Enemy-blind, but it is only the wand VERB's MagicalLock stance
  preview, and L65 has no MagicalLock. `execWand` already refuses a blocked shot by name (§4b).
- **The next stop past L65 is someone else's:** the L65 → L68 leg solves but takes **1 model hit**
  (`chaser:bob@208,80`, t1282, in both passes). It is the same with the switch OFF, since L65 has no axe. Hand-over in
  §9.

## 3. The reproduction (measured, before any change)

Request S1 37:8 is "Level 068 - Health", exit `(128,304)` L63 → L65. It is the 2560-unit held retry after 37:7, the
640-unit attempt. The player arrives at (24,104) holding sword, wand, spear and fire, with slots `[0,1,3,2]` and
`primary 3` = **wand**.

The blocker is `spinningaxe@128,80`: hub (136,88), rate 5 (5° per update), a 32 px blade. The walk reaches its doorstep
at (105.7,104.3) at t239, already inside the blade's reach.

**L63's geometry.** The way south from the doorstep runs through tiles (7..9, 7), 24–40 px south of the hub, so it is
swept by the blade. The direct line south is blocked by `grenade@128,128` (a forbidden volume). The planner's corridor
therefore rounds it via (9,8) → (9,6) → (10..12,6), the corner where `jellyfish@160,64` lives. Avoid separates the
doorstep tile (6,6) from the exit tile (8,19) under the forbidden volumes.

| solve (both wand keys ON, base) | dashless pass | full pass | answer |
|---|---|---|---|
| 37:7, budget 640 | refusal, 643 units, cut at `axe-dodge` (budget) | 1 unit, `walk` (budget) | `2e192645c34b` |
| **37:8, budget 2560** | refusal, 2049 units: stalls (1247 previews, none clean); bent corridors (28 of 60 previews, 500 of 500 legs); AXETIMING *"this pass may not dash"* | refusal, **514 units, cut at `axe-dodge` (budget)** | `8c781b9832a7` |
| 37:8, budget 10240 | the same, 2049 | refusal, 2076 units, **not cut**: AXETIMING *"the `primary` slot fires `wand`, and the crossing is a sword dash chain"* | `0a2f7de10780` |
| 37:8, no budget | the same | the same | `0a2f7de10780` |

**Verdict:** exhaustion is not a budget limit. At any budget the stall search finds nothing (1247 previews; the
corridor turns more than a revolution against the blade while in reach). Before the swap is ever reached, the full
pass's own stall search and bent-corridor search spend 1,754 units (measured with a counting `shouldStop`:
`axe-dodge` 1247 asks, `detour` 519).

**Is the blade passable hitless in the game?** Yes, with the sword's dash chain (`DASH_CHAIN_PATTERN` [0,2,8,14] every
20 t):
- At stall 0 and chain phase 16, the crossing (t239..t351) is certified clean by the probe and driven hitless on a fork.
- The game itself plays that crossing hitless (§6).

## 4. Design + change; OFF identity

### (a) `AXE_TIMING_SWORD_SWAP` (solverBot.js; new functions plus one call site in the AXE arm)

- `axeTimingSwordSlot(run)` (pure): returns the index, in the run's own `inventorySlots`, of the sword (or the ghost
  sword, item 4). It returns null when the sword is already selected, not held, or its slot has not arrived yet.
- In `axeTimingCrossing`, when the switch is ON and the sword is held but not selected:
  - the rung forks the segment (`fork()`) and selects the sword's slot on the fork;
  - it then runs its whole unchanged search there: the same stalls, chain phases, bounds and probe certificate.
- **Landing gate** (MEASURED necessity): the first certified candidate, stall 0 / phase 16, lands at (169.9,104.2).
  There the next walk's own gate refuses it, on `jellyfish@160,64` at d 5.3. So each candidate is now:
  - driven on a fresh fork exactly as the live drive will drive it (sword in, the samples, the prior slot back);
  - admitted only if that fork takes **no hit** and its landing passes `dangerNow` (timed as the walk's gate is).
- **Walked-on landing:** if the landing fails, the SAME candidate is walked on along the same corridor. It stops only at
  a probe danger and lands at the first later tick whose gate is clean. Here that is t358, at (182.3,104.2). No new
  corridor is planned.
- **Drive:** the live drive calls `equip(sword)` before the crossing's first tick, so the tape carries the selection
  (`plan.equipsAt`: `[239, 0]`). It calls `equip(prior)` after the last tick (`[358, 3]`). The existing `playerHits`
  check after the drive is unchanged: a hit still refuses by name.
- **Order:** when a swap applies, the AXE arm asks the rung FIRST (`swapFirst`). Without that, the full pass reaches the
  swap only at unit ~1806, which never fits after the dashless pass's 2049. With it, the full pass costs **260**.
- **Fallbacks:** no certificate gives the old "fires `wand`" text plus the fork's count. No sword slot, no fork, or a
  refused equip means the rung is not asked. A solve never becomes a refusal: the old order runs after a failed swap.
- **Instrument:** `AXE_TIMING_SWORD_SWAP_COUNTS`, `{asked, certified, refused, landings}` (the last 64 rows). Nothing
  reads it.
- `SOLVER_ENV_NAMES` gains `SEEDLING_AXE_TIMING_SWORD_SWAP` (sorted, unique).
- No level id, coordinate or Seedling constant appears in the logic.
- ⚖ No-hit logic: only plans whose fork drive takes 0 hits are admitted.

**OFF identity:** acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`) is
**`391322d681b7aa0229d94b3f6906d024`** at the base, at `1bc3fb19` and at `b26165e4`, the same at all three.

### (b) `previewWandShot` — measured; the solver already refuses by name; no behaviour change

- `previewWandShot` (now `export`ed, read-only, for the row) asks `collidesSolid` only. Its two callers are the wand
  verb's MagicalLock stance search and `execWand`.
- **L65 has no MagicalLock**, so on the entry-37 route the preview is never asked there.
- On L65's pair with both wand keys ON (W68's `turret-l65` staging: facing E from (41.7,120)):
  - the preview flies to `tile:Body Wall` (spawn (57,120));
  - the run's own shot stops on `turret@64,112` (`wandShotHits[0]`, hits 0.5, hitsTimer 30).
- So the blindness is real. But `execWand` does not trust the preview: it waits for the run's `magicalLocksOpened`,
  and on a miss it refuses *"… it is not open by t… — the shot(s) since stopped on [wandShotHits]"*. A blocked shot is
  never a silent pass.
- **Census:** the MagicalLock rooms are L12, L34, L43, L68 and L101. The only one holding a wave-67/68 body is
  **L101** (`darktrap@160,80`). Its two locks are FIRE locks, refused by `resolveWandStrategy` before any preview (the
  Fire Wand's case 5).
- L68's lock, the entry-37 goal, is opened in the chained solve below by the wand verb, hitless.
- A preview that sees Enemy bodies would need levelRun's `wandShotBlockerAt`, which is not on the run's API. That is
  fidelity's to expose if it is ever needed.

## 5. Rows + bounded vitest runs

| file | tier | rows | result |
|---|---|---|---|
| `frontend/modules/seedlingDemo/hammerEntry37Wall.test.js` | default | 8: switch default/env/table/restore; `axeTimingSwordSlot` (37:8's slots, arrival order, null cases, ghost sword); (b) L65 preview vs run; (b) MagicalLock census | 8/8 pass |
| `frontend/modules/seedlingDemo/hammerEntry37Wall.train.test.js` | train (65.5 s; row in `scripts/test/train-shard-costs.json`) | 2: S1 37:8 from re-measure-10's committed evidence: OFF `8c781b9832a7`; ON `6fc9184e21ed`, 617 t, 0 hits, ≤ 2560, sword in / wand back, landings `['jellyfish@160,64', null]` | 2/2 pass |

Bounded local runs (no unfiltered vitest):
- `hammerEntry37Wall.test.js` + `solverEnvChannel.test.js` + `seedlingSolverSurface.test.js` +
  `seedlingDivergenceSolverEnv.test.js` + `trainShardPlan.test.js`: all green (62 + 21 tests).
- The train file: `npm run test:unit:train`-style config, path-bounded: 2/2.

Regenerated:
- `census-seedling-solver-surface --write`: the swap's progress reads; `--check` GREEN, 374 rows.
- `generate-procgen-reference` and `generate-docs-index`: unchanged, `--check` green.
- No doc under `docs/json/developer/procgen/` was edited.

CI (quoted, ⚖ 52):
- At `b26165e4`, run 45931370404: suite 30489 / 30492. The 3 reds are all `seedlingSolverSurface.test.js`, the census
  that `607c1d71` regenerates (green locally there).
- `607c1d71` changed only that JSON, so the path filter ran no JS suite. **No CI suite number exists at the code
  head.**
- The train-tier dispatch (`unittests_frontend.yml -f train_only=true`) was **refused to this session** (403,
  "Resource not accessible by integration"). The planner owes the packet that run at the tip.

## 6. Game witness (p4g, fresh page)

Scratch probe (measurement only, not committed): solve S1 37:8 ON, fold `plan.solution` and `tapeEquips(equipsAt)` into
the request's staged tape (`buildStagedTape`), replay it on the model (`runTape`, `scratchPersistence`), and play it on
a fresh `seedling_bot_ap_p4g` page under the box lock.

⚠ **A tape cannot declare the session's slot order.** `inventory_slots` is a staging field only, so a fresh page builds
the slots in fresh order: `[0,1,2,3]` against the session's `[0,1,3,2]`. Every slot index (`seam.primary`,
`seam.secondary`, each equip) was therefore translated to the same item's fresh index. Untranslated, even an OFF plan
(37:4) diverges at t75. Translated, 37:4's folded tape equals its plan at every row.

| | rows | levels | first differing row (x, y, level) | end | game `hits` |
|---|---|---|---|---|---|
| model (folded tape) | 618 | 63 → 65 at t617 | — (equals `plan.expected` at every row) | L65 (136,24) | model 0 |
| **game (p4g)** | 618 | [63, 65] | **none** | L65 (136,24), `finished true`, error "" | **0** (`hits_timer 0`) |

**How far the plan gets past L65.** Chained solves on the same run (each leg's prefix is the earlier legs' keys and
equips; both wand keys ON; the request's budgets):

| leg | from | answer | ticks | work | hits |
|---|---|---|---|---|---|
| 37:8 L63 → L65 `(128,304)` | L63 (24,104) t0 | SOLVED | 617 | 2309 | 0 |
| L65 → L68 `(184,64)` | L65 (136,24) t617 | SOLVED (dashless 697 t, full 695 t; hit-avoid 2 tries, cut by the window) | 695 | 288 | **1** — `chaser:bob@208,80` at t1282 |
| L68 Health `(16,16)` | L68 (24,72) t1312 | SOLVED (verbs keylock, walk, wand) | 184 | 199 | 0 |

## 7. Census

**Which seed-1 divergence-sweep legs the change can move, and why.** The swap runs only inside the AXE arm, which is
entered only on a spinning-axe danger. It also needs all of:
- a pass that may dash (the full pass);
- a sword or ghost sword in `inventorySlots` with another weapon selected;
- a fork.

So only legs in the nine axe rooms (L48, L54, L61, L63, L71, L75, L98, L101, L103) can move: **100 of 915 legs**. They
can move only when they arrive with a non-sword weapon selected. A fresh sweep page arrives with the sword selected,
which is why the measured sweep below does not move. The full key list is in the appendix.

**Measured, switch OFF vs ON, both wand keys ON:**

| measurement | scope | result |
|---|---|---|
| Captured-request replays (node, each request's own budget) | 154 requests: re-measure-11 S1/L1/P1, re-measure-10 S1/P1a/P1b (legs 18, 32, 33, 37, 38, 39) | **144 identical**. 5× 37:8: refusal `8c781b9832a7` → plan `6fc9184e21ed` (0 hits). 5× 37:6 (L61, same answer `198ee08212fc`, 0 hits): work 1584 → 1724 (+140, the swap asked and declined). The only hit plan in either arm is S1 18:11 `719a637caca4` (1 hit), the same OFF and ON. |
| Live wasm sweep, `--mode=inv --page=seedling_bot_ap_p4g`, `--keys=` | every L63 / L65 leg: 36 | **0 of 36 differ** (end, room hits, last plan). 0 room hits in every leg, both arms. 9 `failed` and 2 `timeout` in both arms, pre-existing (e.g. 540's ButtonRoom hold). |
| Route survey `--through=end --route=full --only=` | the 25 steps whose room holds an axe (53, 74, 79, 104, 121, 122, 126, 155, 156, 180, 181, 189, 190, 192, 193, 201, 210, 211, 217, 219, 227, 230, 232, 236, 241) | **25 of 25 identical**: verdict, ticks, hits and refusal text. 17 SOLVED, all 0 hits; 8 REFUSED with the same text. The other 225 steps are in rooms with no axe, where the switch is never asked. |

**Verdict: flip-ready by these numbers.**
- It solves the entry-37 wall hitless, inside the request's own 2560 budget (251 spare), and the game witnesses the plan
  row for row.
- It moves nothing else measured: no step and no leg gains a hit or changes its answer.
- Cost: +140 units on one known L61 request where the swap is asked and declines. On 37:8 the full pass drops from
  2076+ (exhausted) to 260.
- 37:7 (the 640 attempt) still refuses on the budget, as before. The held 2560 retry is what solves.

**LHM / SIX overlap (for the planner's re-merge).**
- LHM (`LATCHED_HOLD_MOVE`) and the six switches (PKSW, PKRB, DSS, OAC, HSB, RSB) live on `hammer-harvest-f1-refusal`,
  not on this base.
- On re-measure-11's 37:8 none of the five measured there fires (`asked 0` / `tried 0`, per its counts).
- This change touches only `axeTimingCrossing`, its call order in the AXE arm, and the crossing's drive. A re-merge
  conflict, if any, would be textual. The planner should re-run the train row on the merged stack.
- ⚠ W70 heads-up (`wandPressHeldBySlash`): the swap selects the wand again right after a sword dash chain (t358). If
  the walk then presses the wand inside the last swing, W70 would make that press fire nothing. On 37:8 the next wand
  press is not until the L68 lock.

## 8. What the brief got wrong (measured)

- *"the full pass is cut by the axe-dodge budget at work 514"* is true at 2560, but **the budget is not the wall**. With
  no budget the full pass refuses anyway (2076 units, not cut). The cause is the AXETIMING rung's
  sword-in-`primary` gate, and the run has the wand selected.
- *"(b) a shot the solver plans as clear stops in the run at L65"*: the solver plans no wand-verb shot at L65, because
  there is no MagicalLock there. The Enemy-blind preview is real, but it is not on this route. The run's own shots at
  L65 are modelled by W67/W68. And `execWand` already refuses a blocked shot by name.
- *"Reproduce 37:8 … the answer"*: at the base with both keys ON it is `8c781b9832a7`, as stated. With no budget it is
  `0a2f7de10780`, the same ladder with the AXETIMING "fires `wand`" clause instead of the deadline.

## 9. Residue / hand-overs

1. **L65 → L68 takes a model hit** (the walk's next wall once entry 37 passes): `chaser:bob@208,80` at t1282 in both
   passes; `HIT_AVOID_PASS` tried twice and was cut by the window. Under ⚖ no-hit logic that plan must not ship. It is
   unchanged by this switch (L65 has no axe). Owner: the hammer planner (a new slice), witness = the chain in §6.
2. **The train-tier dispatch at the tip** (403 here): `unittests_frontend.yml -f train_only=true` at `607c1d71` or this
   report's head.
3. **The CI suite at the code head**: no push run, because of the path filter. A dispatch with `train=true` gives both.
4. **A fresh-page witness needs the slot translation** (§6). `buildStagedTape` drops `inventory_slots`, and a tape has
   no field for it. Every fresh-page witness of a captured request from a session whose slots arrived out of order
   will diverge unless it translates. Owner: whoever owns the witness probes. No tooling edited here.
5. `previewWandShot`'s Enemy-blindness (§4b) has no route instance today (L101's fire locks are refused earlier). If a
   future room pairs a plain MagicalLock with a W67/W68 body, the fix is a levelRun blocker query exposed to the solver
   (fidelity's model).

## Appendix — the 100 seed-1 sweep legs the switch can reach (axe rooms), by KEY

| room | key |
|---|---|
| L48 | `level_48__r7c0 <- in_L53_208_64 -> exit:out_teleporter_0_112` |
| L48 | `level_48__r18c7 <- in_L47_216_112 -> exit:out_teleporter_112_304` |
| L54 | `level_54__r1c8 <- in_L53_144_240 -> exit:out_teleporter_144_0` |
| L54 | `level_54__r27c8 <- in_L52_112_0 -> exit:out_teleporter_128_464` |
| L61 | `level_61__r0c7 <- in_L60_160_80 -> exit:out_teleporter_0_160` |
| L61 | `level_61__r0c7 <- in_L60_160_80 -> exit:out_teleporter_112_0` |
| L61 | `level_61__r0c7 <- in_L60_160_80 -> exit:out_teleporter_224_96` |
| L61 | `level_61__r0c7 <- in_L62_48_304 -> exit:out_teleporter_0_160` |
| L61 | `level_61__r0c7 <- in_L62_48_304 -> exit:out_teleporter_112_0` |
| L61 | `level_61__r0c7 <- in_L62_48_304 -> exit:out_teleporter_224_96` |
| L61 | `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_0_160` |
| L61 | `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_112_0` |
| L61 | `level_61__r0c7 <- in_L63_0_96 -> exit:out_teleporter_224_96` |
| L61 | `level_61__r0c10 <- in_L62_96_304 -> exit:out_teleporter_160_0` |
| L61 | `level_61__r0c10 <- in_L62_96_304 -> exit:out_teleporter_224_48` |
| L61 | `level_61__r0c10 <- in_L62_96_304 -> location:L63 flag 1: lightpole@64,88 cleared` |
| L61 | `level_61__r0c10 <- in_L63_0_48 -> exit:out_teleporter_160_0` |
| L61 | `level_61__r0c10 <- in_L63_0_48 -> exit:out_teleporter_224_48` |
| L61 | `level_61__r0c10 <- in_L63_0_48 -> location:L63 flag 1: lightpole@64,88 cleared` |
| L61 | `level_61__r13c12 <- in_L63_0_208 -> exit:out_teleporter_224_208` |
| L63 | `level_63__r0c1 <- in_L61_224_96 -> exit:out_teleporter_0_48` |
| L63 | `level_63__r0c1 <- in_L61_224_96 -> exit:out_teleporter_0_96` |
| L63 | `level_63__r0c1 <- in_L61_224_96 -> exit:out_teleporter_16_0` |
| L63 | `level_63__r0c1 <- in_L61_224_96 -> exit:out_teleporter_64_0` |
| L63 | `level_63__r0c1 <- in_L61_224_96 -> location:L62 flag 0: lightpole@120,200 cleared` |
| L63 | `level_63__r0c1 <- in_L61_224_48 -> exit:out_teleporter_0_48` |
| L63 | `level_63__r0c1 <- in_L61_224_48 -> exit:out_teleporter_0_96` |
| L63 | `level_63__r0c1 <- in_L61_224_48 -> exit:out_teleporter_16_0` |
| L63 | `level_63__r0c1 <- in_L61_224_48 -> exit:out_teleporter_64_0` |
| L63 | `level_63__r0c1 <- in_L61_224_48 -> location:L62 flag 0: lightpole@120,200 cleared` |
| L63 | `level_63__r0c1 <- in_L62_192_304 -> exit:out_teleporter_0_48` |
| L63 | `level_63__r0c1 <- in_L62_192_304 -> exit:out_teleporter_0_96` |
| L63 | `level_63__r0c1 <- in_L62_192_304 -> exit:out_teleporter_16_0` |
| L63 | `level_63__r0c1 <- in_L62_192_304 -> exit:out_teleporter_64_0` |
| L63 | `level_63__r0c1 <- in_L62_192_304 -> location:L62 flag 0: lightpole@120,200 cleared` |
| L63 | `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_48` |
| L63 | `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_0_96` |
| L63 | `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_16_0` |
| L63 | `level_63__r0c1 <- in_L62_240_304 -> exit:out_teleporter_64_0` |
| L63 | `level_63__r0c1 <- in_L62_240_304 -> location:L62 flag 0: lightpole@120,200 cleared` |
| L63 | `level_63__r6c9 <- in_L65_128_0 -> exit:out_teleporter_128_304` |
| L63 | `level_63__r6c9 <- in_L65_128_0 -> location:L63 flag 7: lightpole@112,272 cleared` |
| L63 | `level_63__r10c2 <- in_L61_224_208 -> exit:out_teleporter_0_208` |
| L63 | `level_63__r10c2 <- in_L61_224_208 -> exit:out_teleporter_32_304` |
| L63 | `level_63__r10c2 <- in_L61_224_208 -> location:L63 flag 6: lightpole@48,272 cleared` |
| L63 | `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_0_208` |
| L63 | `level_63__r10c2 <- in_L65_32_0 -> exit:out_teleporter_32_304` |
| L63 | `level_63__r10c2 <- in_L65_32_0 -> location:L63 flag 6: lightpole@48,272 cleared` |
| L71 | `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_96_0` |
| L71 | `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_224_304` |
| L71 | `level_71__r0c6 <- in_L72_0_256 -> exit:out_teleporter_304_96` |
| L71 | `level_71__r0c6 <- in_L72_0_256 -> location:Level 071 - Chest` |
| L71 | `level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared` |
| L71 | `level_71__r0c6 <- in_L75_64_224 -> exit:out_teleporter_96_0` |
| L71 | `level_71__r0c6 <- in_L75_64_224 -> exit:out_teleporter_224_304` |
| L71 | `level_71__r0c6 <- in_L75_64_224 -> exit:out_teleporter_304_96` |
| L71 | `level_71__r0c6 <- in_L75_64_224 -> location:Level 071 - Chest` |
| L71 | `level_71__r0c6 <- in_L75_64_224 -> location:L71 flag 2: shieldlock@288,256 cleared` |
| L71 | `level_71__r0c6 <- in_L76_0_80 -> exit:out_teleporter_96_0` |
| L71 | `level_71__r0c6 <- in_L76_0_80 -> exit:out_teleporter_224_304` |
| L71 | `level_71__r0c6 <- in_L76_0_80 -> exit:out_teleporter_304_96` |
| L71 | `level_71__r0c6 <- in_L76_0_80 -> location:Level 071 - Chest` |
| L71 | `level_71__r0c6 <- in_L76_0_80 -> location:L71 flag 2: shieldlock@288,256 cleared` |
| L71 | `level_71__r0c6 <- in_L80_32_0 -> exit:out_teleporter_96_0` |
| L71 | `level_71__r0c6 <- in_L80_32_0 -> exit:out_teleporter_224_304` |
| L71 | `level_71__r0c6 <- in_L80_32_0 -> exit:out_teleporter_304_96` |
| L71 | `level_71__r0c6 <- in_L80_32_0 -> location:Level 071 - Chest` |
| L71 | `level_71__r0c6 <- in_L80_32_0 -> location:L71 flag 2: shieldlock@288,256 cleared` |
| L71 | `level_71__r13c7 <- in_L85_80_0 -> exit:out_teleporter_16_304` |
| L75 | `level_75__r0c4 <- in_L74_16_144 -> exit:out_teleporter_64_0` |
| L75 | `level_75__r13c3 <- in_L71_96_0 -> exit:out_teleporter_64_224` |
| L98 | `level_98 <- in_L93_112_80 -> exit:out_stairsup_112_112` |
| L98 | `level_98 <- in_L93_112_80 -> exit:out_teleporter_112_192` |
| L98 | `level_98 <- in_L93_112_80 -> location:Level 098 - Chest` |
| L98 | `level_98 <- in_L99_112_112 -> exit:out_stairsup_112_112` |
| L98 | `level_98 <- in_L99_112_112 -> exit:out_teleporter_112_192` |
| L98 | `level_98 <- in_L99_112_112 -> location:Level 098 - Chest` |
| L101 | `level_101__r4c2 <- in_L100_288_96 -> exit:out_stairsup_48_96` |
| L101 | `level_101__r4c2 <- in_L100_288_96 -> location:L101 flag 0: lightpole@144,64 cleared` |
| L101 | `level_101__r4c2 <- in_L102_64_96 -> exit:out_stairsup_48_96` |
| L101 | `level_101__r4c2 <- in_L102_64_96 -> location:L101 flag 0: lightpole@144,64 cleared` |
| L101 | `level_101__r4c9 <- in_L102_160_96 -> exit:out_stairsup_144_96` |
| L103 | `level_103 <- in_L102_0_96 -> exit:out_teleporter_0_64` |
| L103 | `level_103 <- in_L102_0_96 -> exit:out_teleporter_304_144` |
| L103 | `level_103 <- in_L104_144_128 -> exit:out_teleporter_0_64` |
| L103 | `level_103 <- in_L104_144_128 -> exit:out_teleporter_304_144` |
| L48 | `level_48__r2c10 <- in_L47_216_112 ~> level_48__r18c7 -> exit:out_pit_2_2` |
| L48 | `level_48__r2c10 <- in_L47_216_112 ~> level_48__r18c7 -> location:L48 flag 1: bosslock@48,144 cleared` |
| L48 | `level_48__r11c9 <- in_L47_216_112 ~> level_48__r18c7 ~> level_48__r2c10 -> location:Level 048 - Chest` |
| L63 | `level_63__r5c14 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest` |
| L71 | `level_71__r14c12 <- in_L72_0_256 ~> level_71__r0c6 -> exit:out_pit_10_17` |
| L71 | `level_71__r14c12 <- in_L75_64_224 ~> level_71__r0c6 -> exit:out_pit_10_17` |
| L71 | `level_71__r14c12 <- in_L76_0_80 ~> level_71__r0c6 -> exit:out_pit_10_17` |
| L71 | `level_71__r14c12 <- in_L80_32_0 ~> level_71__r0c6 -> exit:out_pit_10_17` |
| L71 | `level_71__r16c19 <- in_L72_0_256 ~> level_71__r0c6 -> exit:out_teleporter_304_256` |
| L71 | `level_71__r16c19 <- in_L75_64_224 ~> level_71__r0c6 -> exit:out_teleporter_304_256` |
| L71 | `level_71__r16c19 <- in_L76_0_80 ~> level_71__r0c6 -> exit:out_teleporter_304_256` |
| L71 | `level_71__r16c19 <- in_L80_32_0 ~> level_71__r0c6 -> exit:out_teleporter_304_256` |
| L101 | `level_101__r0c6 <- in_L100_288_96 ~> level_101__r4c2 -> exit:out_teleporter_104_24` |
| L101 | `level_101__r0c6 <- in_L102_64_96 ~> level_101__r4c2 -> exit:out_teleporter_104_24` |
