# Seedling hammer-phase L65→L68 HIT — `WALK_BLADE_ARM`

Session `seedling-hammer-l65-l68-hit` (Opus, cloud), planner `seedling-hammer-phase-planning-17`.
⚖ Approved by the user on 2026-11-27 (*"L65→L68 hit slice (Recommended)"*). The new switch is OFF. Landing it needs the
user's own SHA-bound OK. No follow-up from the planner reached this session, so the scope is the brief's.

## 1. Start SHA, head, branch

| | |
|---|---|
| base (start) | `15b1c45c6af7f3ecc0d09ca1b67c4d4e3bef29b5`, `hammer-harvest-entry37-axe`: fidelity's W68 tip `48824c3310` (W62 → W68, all keys OFF) plus `AXE_TIMING_SWORD_SWAP` (OFF). Not landed. It does NOT carry the hammer LHM flip |
| code head | `cae2889d` (rows); the switch is `d2284533` |
| head | this report's commit (the last) |
| branch | `claude/seedling-hammer-l65-l68-tl4uk1` |
| commits | `d2284533` the switch + census · `cae2889d` the rows · `e770edfa` the evidence · this report |

Every measurement ran with `SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1`.
"ON" adds `SEEDLING_WALK_BLADE_ARM=1`.

## 2. The answer first

- **Switch: `WALK_BLADE_ARM`** (`SEEDLING_WALK_BLADE_ARM=1`, OFF by default; `withWalkBladeArm`; family file
  `walkBladeArm.js`). It runs in the solve WORKER thread (solverBot's `walkTo`, inside `solveSegment`). No main-thread
  mapper reads it.
- **The L65 → L68 `(184,64)` leg goes hitless.** OFF: 695 t with **1 hit** (`chaser:bob@208,80`, t1282) in both
  passes. ON: **593 t, 0 hits** (dashless 667 t / 0 h, full 593 t / 0 h, work 200 of 640). The whole chain 37:8 → L65
  → L68 → Health drops from 1496 t with 1 hit to **1253 t, 0 hits, 0 deaths** on a fresh replay.
- **The game agrees.** A fresh p4g page plays the ON chain's tape identical to the model at every row through
  **1244 of 1253**, across L63, all of L65 and L68 up to the Health pickup. The game's `hits` is **0**
  (`hits_timer 0`) at t1085, just before the L65 exit. OFF, the game takes the hit (`hits 1, hits_timer 10` at t1290).
  The last 9 ticks of both arms differ the same way (the Health pickup, §6), so that tail was there before this change.
- **The one thing to know first: the hit was not the chase. It was a probe-versus-drive split caused by the selected
  item.** The run holds the sword but has the **wand** selected. `strikePolicyFor` builds the walk's strike policy from
  the inventory, so the last corridor presses `primary` at the bob. The corridor probe priced each press as a sword
  strike that knocks the bob back. The drive's press is a WandShot, which does not. From t1238 the forecast and the run
  part, and the live bob ends up beside the exit. ON, the walk selects the held blade, so each press is the swing the
  probe priced.
- **⚠ Not flip-ready on its own.** One survey step gains a hit: **step 149** (L40 Totem Part (64,144)). OFF it refuses;
  ON it solves in 2043 t but takes a `bomb:bombpusher@112,128#7` hit at t1576 while the player stands still (§7).
  Together with fidelity's `UNBILLED_DAMAGE_GATE`, step 149 refuses by name, and no step and no captured request
  gains a hit.
- **Why the hit shipped:** no gate refuses a SOLVED plan that takes a hit. `UNBILLED_DAMAGE_GATE` (fidelity's) is OFF.
  This leg's answer is **not budget-cut**, so `HIT_PLAN_RETRY`'s held retry would not apply either, and it would ship
  the hit today. In the survey today, **3 steps ship a hit** (24, 202, 220). If a hit plan never shipped, those
  **3 would refuse** (§3.4).
- Bonus, measured: with the arm ON, 37:8 solves hitless in **497 t even with `AXE_TIMING_SWORD_SWAP` OFF** (OFF + OFF
  refuses, `8c781b9832a7`).

## 3. The reproduction (measured, before any change)

### 3.1 The chained leg

The chain is built as entry-37 §6 built it. The 37:8 request (re-measure-11 S1, and identically re-measure-10's
committed S1) is solved first. Its keys and equips become the next request's prefix, the live digest is re-taken, and
the goal is `reach-exit (184,64)` with the request's 640 / 85 budgets. The player arrives at L65 (136,24) at t617
holding the sword, wand, spear and fire, with slots `[0,1,3,2]` and **the wand selected** (the swap reselects it after
the L63 crossing).

| pass | verdict | ticks | work | cut | model hits |
|---|---|---|---|---|---|
| dashless | SOLVED | 697 | 58 | — | 1 (`bob@208,80` t1284) |
| full | SOLVED | 695 | 144 | `sword-dash` at the **window** (85) | 1 (`bob@208,80` t1282) |
| hit-avoid | none | — | 86 | **window** (85), after 2 tries | — |
| **answer** | SOLVED, `b66bb6016c58` | 695 | 288 | `budgetCut` = **false** | **1**, knockback (−2.2, +2.0) |

After that, L68 Health solves in 184 t with 0 hits (`a43e32edf06d`). Every number in entry-37 §6 reproduces exactly.

No capture of a fresh arrival at L65 exists: the walk stopped at 37:8. A synthetic fresh boot at L65 (136,24) snaps
to (144,32) and refuses on `pushableblockspear@176,128` before any walk, so it is not a comparable witness.

### 3.2 The bob's chase, and where the hit lands

The solver trace has five rows: kill `darktrap@144,144` (light arm, stance (132,132)), then four walks. The last
walk starts at t1151 from (198.0,120.3) with the path (200,136) → (168,136) → (168,104) → (184,104) → (184,88) →
(192,72). Its row's `saw.danger` is empty.

`bob@208,80` is a chaser (8×8 body, leash 80, speed 0.5; contact is its whole threat). It wakes as the player comes
up the east side and drifts toward the player. Meanwhile, the walk presses `primary` every ~9 ticks (t1238, 1247,
1256, 1265, 1274, 1283) with the **wand** selected (`equipsAt` …`[1100,2],[1151,3]`).

The corridor probe (`previewWalk` with `strikePolicyFor`) matches the drive's player tick for tick (one-tick sample
offset) until the first press lands:
- **probe** at t1240: the bob is at (195.19,89.23), knocked back by a sword strike;
- **drive** at t1239: the bob is at (191.91,91.94), unmoved, because the press fired a WandShot.

From there the live bob closes to (191.1,81.9) beside the exit. The player stalls at (184.3,~88) under the ledge
(t1270–t1281), the walk's `right+up` at t1281 overlaps the body, and the hit lands at t1282: player (183.9,88.4),
bob (191.06,81.86). The probe's bob never got there, so the corridor was certified clean. Data:
`…-evidence/trace-off-l65.txt`, probe `tools/prev.mjs`.

### 3.3 Why hit-avoid's window cuts it, and why no window would help

- `HIT_AVOID_PASS` re-runs the **first pass's** search (dashless) from 1…16 idle ticks later. It is bound to
  `upgradeWindowWork` = **85** units from its own start.
- One dashless try costs **58** units here. So try 1 (delay 1) completes and hits, and try 2 (delay 2) is cut at
  unit 86: `cut: 'window'`, `tries: 2`.
- Measured with no window at all (`tools/delays.mjs`): **every delay from 1 to 16 still takes the hit** (698–713 t,
  1 hit each, 58 units each). The hit is structural, not a phase problem, so a wider window or a longer wait finds
  nothing.
- A stance change is not the issue either: the probe certifies a corridor that the drive does not walk.

### 3.4 Step 2: the gate that lets a SOLVED plan with `modelHits` 1 out

1. **`solveSegment` returns success when it reaches its goals, whatever the drive took.** The only check is fidelity's
   `UNBILLED_DAMAGE_GATE` (`CONTACT_FIDELITY.unbilledDamageGate`), which is OFF. `WALK_DEATH_REFUSED` and
   `DRIVE_DEATH_REFUSED` are about deaths only.
2. **`solveAnytime` ships the best `ok` answer.** `HIT_AWARE_ANSWER` only ranks a hitless plan over a hit one, and
   `HIT_AVOID_PASS` only adds candidates. Neither refuses.
3. **`HIT_PLAN_RETRY`** (`hammer-harvest-l39-hpr` @8e51c378e0) retries only a budget-cut answer whose plan bills a
   hit. This answer has `budgetCut` = **false**: no pass hit the 640 budget; the full pass stopped at the **window**,
   and the window is not a budget cut. So HPR does not apply, and **the leg ships the hit today**, on that base too.

Route survey `--through=end` (250 steps, the base env):

| arm | SOLVED | SOLVED with a replay hit or death |
|---|---|---|
| base (OFF) | 224 | **3**: step 24 (L16, 1 hit `chaser:bob@96,3…`, run t273 in L17), 202 (L82, 2 hits, `lavaExplosion`), 220 (L82, 2 hits, the same) |
| `UNBILLED_DAMAGE_GATE=1` ("a hit plan never ships") | 221 | 0. The **3** refuse by name (`UNBILLED DAMAGE — … took N hit(s) no plan billed [t… source]`); no other step moves |

### 3.5 What STRIKE_SLOT (an existing OFF switch) does here

`STRIKE_SLOT=1` gates the strike policy on the selected slot and builds no policy for a wand. Measured on the same
leg: SOLVED **hitless, but 1148 t** (verbs `bait, kill, walk`, work 166). The walk goes strike-free and baits the bob
around instead. 37:8's answer also moves (`db90f1f89448`, 617 t, 0 hits).

STRIKE_SLOT's own report says *"the policy's strike half never fired on a non-blade slot"*. **This leg is a
counterexample**: a BODY strike (the bob is the target) pressed with the wand selected, in the dashless pass (§8).

## 4. Design + change; OFF identity

**`WALK_BLADE_ARM`** (a family file `walkBladeArm.js`; one import, one closure and one call site in solverBot's
`walkTo`, next to `spearArmEquip`).

- `walkBladeArmSlot(inventory, inventorySlots, primaryWeapon)` (pure) returns the blade's index in the run's own slot
  array, or −1. A blade must be held (the Ghost Sword when held, since it replaces the sword; otherwise the sword), the
  selected weapon must not already be a blade press (`strikeSlot.pressIsBlade`), and the blade must be slotted.
- `walkBladeArmEquip()` runs at each `walkTo` when the switch is ON and the room has strike bodies (the policy's own
  fast path). If a slot is returned and it is not the current `primary`, it calls the segment's `equip(slot)`. That is
  a `Main.primary` write at the reached tick: no tick is spent, and the tape carries it in `equipsAt`. A later verb
  that needs another slot selects it itself (here: the kill verb's spear thrust and the L68 wand verb both reselect
  the prior slot, now the sword).
- It composes with `STRIKE_SLOT`: with the blade selected, that gate passes and the walk keeps its strikes.
- **Instrument:** `WALK_BLADE_ARM_COUNTS {equips, rows[≤64]: {t, level, from, slot}}`. Nothing reads it.
- `SOLVER_ENV_NAMES` gains `SEEDLING_WALK_BLADE_ARM` (sorted, unique).
- No level id, coordinate or Seedling constant appears in the logic. Item ids come from `INVENTORY_ITEM_IDS`.
- ⚖ No-hit logic: the arm never refuses and never admits a hit. It changes which item a press uses. A solve is never
  turned into a refusal by it (§7: 0 SOLVED → REFUSED anywhere measured).

Why not the alternatives: a hit-avoid window that fits this chase finds nothing (§3.3). STRIKE_SLOT costs +555 t (§3.5).
A refusal is not the only honest answer, because a hitless plan exists.

**OFF identity:** acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`) is
**`391322d681b7aa0229d94b3f6906d024`** at the base `15b1c45c` (a scratch worktree) and at `d2284533`, the same at
both. Census: `census-seedling-solver-surface --write` → `--check` GREEN, 374 rows (`walkBladeArm.js` joins the family
files; solverBot's `strikeBodies` reads go from 256 to 257). `generate-procgen-reference` and `generate-docs-index`:
no change.

## 5. Rows + bounded vitest runs

| file | tier | rows | result |
|---|---|---|---|
| `frontend/modules/seedlingDemo/walkBladeArm.test.js` | default | 7: the switch's default, env name, restore on a throw, instrument reset; `walkBladeArmSlot` on 37:8's slots (wand / fire / spear / none selected → 0), the run's own order, the −1 cases, the Ghost Sword | 7/7 |
| `frontend/modules/seedlingDemo/walkBladeArm.train.test.js` | train (32 s local; row in `scripts/test/train-shard-costs.json`) | 2: S1 37:8 (re-measure-10 committed evidence) chained to L65 → L68. OFF: `b66bb6016c58`, 695 t, passes 697/1 h, 695/1 h, hit-avoid cut by `window`, `budgetCut` false, replay `chaser:bob@208,80@t1282`. ON: `00ff039aabc7`, 593 t, 667/0 h, 593/0 h, ≤ 640, arm rows `{t617, L65, from wand, slot 0}` ×2, replay hitless | 2/2 |

Bounded local runs (no unfiltered vitest):
- `walkBladeArm.test.js`, `solverEnvChannel.test.js`, `scripts/procgen/seedlingSolverSurface.test.js`,
  `entityBlocks.test.js`, `scripts/procgen/seedlingDivergenceSolverEnv.test.js`: 80/80 green.
- `frontend/modules/procgenDocs/` plus `hammerFewerHits.test.js`: green in the same 12-file run (576 tests).
- `hammerEntry37Wall.test.js`: 8/8. `trainShardPlan.test.js`: 21/21. The train file (`-c vitest.train.config.js`):
  2/2.
- `entityBlocks`' family grep caught a docblock mention of `entities('strikeBodies')` in the family file. It was
  reworded; the code there reads no family.

CI (quoted, ⚖ 52): at `cae2889d`, run 46031707601: **suite 30499 / 30499 passed**, slow battery 469 / 469.

The train-tier dispatch (`unittests_frontend.yml -f train_only=true`) was **refused to this session** (403,
*"Resource not accessible by integration"*, as for entry-37). The planner owes that run at the tip.

## 6. Game witness (p4g, fresh page)

Scratch probe `tools/witness.mjs` (measurement only):
- It folds the chain's keys and equips into a staged tape (`buildStagedTape`, the staging's own `equips`) with the
  **slot translation**. A tape cannot declare `inventory_slots`, so the session's `[0,1,3,2]` becomes the fresh page's
  `[0,1,2,3]`: `seam.primary`, `seam.secondary` and every equip are mapped to the same item's fresh index.
- The translated model equals the session model at every row (first diff −1).
- It plays the tape on a fresh `seedling_bot_ap_p4g` page (headless, under the box lock) and diffs the drain against
  the model row by row (`tools/wcmp.mjs`).

| tape | rows | levels | first differing row | game status at the end |
|---|---|---|---|---|
| ON, whole chain (1253 t) | 1254 | 63 → 65 → 68 | **1245** (L68, after the Health pickup: the game holds y 26.95, the model walks on) | L68 (24,26.95), `finished`, error "" |
| OFF, whole chain (1496 t) | 1497 | 63 → 65 → 68 | **1490**, the same Health-pickup tail | L68 (24,27.25) |
| ON, cut at t1085 (just before the L65 exit) | 1086 | 63 → 65 | **none** | `hits 0`, `hits_timer 0` |
| OFF, cut at t1290 (after the bob) | 1291 | 63 → 65 | **none** (the knockback too) | **`hits 1`, `hits_timer 10`** |
| ON / OFF, cut at the L68 arrival | 1091 / 1313 | 63 → 65 → 68 | none | `hits 0` in both (the game's counter does not survive the room change, so this row is not hit evidence) |

The ON chain is game-witnessed hitless through L65 and row-identical through 1244. The 9-tick tail at the Health
pickup is in the L68 leg's last ticks, in both arms (§9).

## 7. Census

**Where the arm can act.** Only in `walkTo` (every walk, rung and executor walk), and only when all of these hold:
- the room has strike bodies;
- a blade is held and slotted;
- a non-blade item is selected.

On a fresh sweep page in inventory mode the sword is the first item granted, so the arrival has `primary 0` = the
sword. Every one of the 10 legs below arrives that way, which is why the sweep does not move. A leg can move only when
it arrives with another item selected (a session-carried selection, as in whole-game entry 37), or when a verb leaves a
non-blade selected before a later walk.

| measurement | scope | result |
|---|---|---|
| Captured-request replays (node, each request's own budget, every plan replayed fresh) | **154** requests: re-measure-11 S1, L1, P1 and re-measure-10 S1, P1a, P1b (legs 18, 32, 33, 37, 38, 39) | **132 identical** (answer and work). **22 move, all hitless in both arms**, all on entry 37 plus 38:1: 37:0 459 → 428 t; 37:3 **refusal `8f63b305b6aa` → plan 222 t, 0 h** (all 5 captures); 37:4 254 → 222 t; 37:8 617 → 497 t; 38:1 1830 → 1825 t. The only hit plan in either arm is S1 18:11 (1 hit), the same both ways |
| Live wasm sweep `--mode=inv --page=seedling_bot_ap_p4g --page-legs=1`, `--keys=`, both wand keys as `--contact-fidelity`, `--solver-env` stamped (ON rows carry `…;SEEDLING_WALK_BLADE_ARM=1`) | the 10 L65 / L68 legs (keys below) | **10 of 10 identical** (end, failure, room hits, last plan's ticks). 0 room hits in every leg, both arms. 1 `failed` in both: 573, *"the solver has no goal for L65 flag 0"* |
| Route survey `--through=end`, 250 steps | every step | **1 mover: step 149** (L40, clear-tag `wandlock@208,128` then Totem Part (64,144)). OFF: REFUSED (a spinner-press landing). ON: SOLVED 2043 t with **1 hit**, `bomb:bombpusher@112,128#7` at t1576 while the player stands at (232.3,167.7), sword selected. `BOMB_PHASE_WAIT=1` gives the same (2043 t, 1 hit). The other 249 steps are identical |
| Survey, `UNBILLED_DAMAGE_GATE=1` OFF vs ON | every step | **1 mover: step 149** stays REFUSED, now by name: *"UNBILLED DAMAGE … 1 hit(s) no plan billed [t1575 (run t1576, L40) bomb:bombpus…"*. 221 SOLVED in both, 0 hit plans in both |

The sweep legs measured, by KEY:
- `level_65__r0c2 <- in_L63_32_304 -> exit:out_teleporter_0_128`
- `level_65__r0c2 <- in_L63_32_304 -> exit:out_teleporter_32_0`
- `level_65__r0c2 <- in_L66_144_144 -> exit:out_teleporter_0_128`
- `level_65__r0c2 <- in_L66_144_144 -> exit:out_teleporter_32_0`
- `level_65__r0c8 <- in_L63_128_304 -> exit:out_teleporter_128_0`
- `level_65__r0c8 <- in_L63_128_304 -> location:L65 flag 0: lightpole@128,168 cleared`
- `level_65__r4c11 <- in_L68_16_80 -> exit:out_teleporter_184_64`
- `level_68__r3c1 <- in_L65_184_64 -> exit:out_teleporter_16_80`
- `level_68__r3c1 <- in_L65_184_64 -> location:L68 flag 0: bosslock@16,32 cleared`
- `level_68__r1c1 <- in_L65_184_64 ~> level_68__r3c1 -> location:Level 068 - Health`

**Verdict:** the arm solves the named leg hitless, game-witnessed, and shortens every entry-37 request it touches,
with no hit anywhere in the captured requests. **On its own it is not flip-ready**: survey step 149 turns a refusal
into a 1-hit plan. **Paired with `UNBILLED_DAMAGE_GATE` (fidelity's switch, a user licence of its own) nothing gains a
hit**: 149 refuses by name, and 24, 202 and 220 refuse as they would under the gate alone. A flip could instead wait
for the step-149 bomb hand-over (§9).

**LHM / SIX / HPR overlap (for the planner's re-merge).** The hunks are an import, one closure and one call line in
`walkTo` next to `spearArmEquip`, plus a family file. A conflict with LHM (`hammer-harvest-f1-refusal`) or HPR
(`hammer-harvest-l39-hpr`) would be textual. The train row should be re-run on the merged stack.

## 8. What the brief got wrong (measured)

- *"the bob's chase … why hit-avoid's window cuts it"*: the window does cut it (58-unit tries against 85), but **no
  window or wait is hitless** (delays 1–16, uncut, all 1 hit). The cause is not the chase's phase. It is
  probe-versus-drive divergence: the probe prices a `primary` press as a sword strike while the wand is selected
  (⚖ 30(c) broken by the selection).
- *"a stance, a wait"*: neither is needed. The plan already in hand is hitless once the press is the one the probe
  priced.
- STRIKE_SLOT's report (an earlier slice), *"No row is a body strike … the policy's strike half never fired on a
  non-blade slot"*: this leg is a body strike on the bob with the wand selected, in the dashless pass. The claim held
  for that slice's workloads, not for whole-game sessions that carry a non-blade selection.
- *"also from a fresh arrival at L65 (136,24) if a request exists"*: none exists. The walk stopped at 37:8, and a
  synthetic boot is not comparable (§3.1).

## 9. Residue / hand-overs

1. **Survey step 149 (L40) bomb on a stand**: `bomb:bombpusher@112,128#7` at t1576, the player standing at
   (232.3,167.7) for 12+ ticks with no keys. It is reached only once the arm lets the solve past its old refusal.
   `BOMB_PHASE_WAIT` does not change it. Owner: the hammer planner (a bomb-stand slice), or fidelity's
   `UNBILLED_DAMAGE_GATE` flip. Witness: `survey-seedling-route.mjs --through=end --only=149` with this arm ON (the
   walk tape is in `.cache/seedling-survey/through-end/views/step-149-walk.json` after a run; probe `tools/s149.mjs`).
2. **The Health pickup's last ticks (L68, the Health leg)**: the game holds the player (y 26.95 / 27.25) for the final
   ~7–9 ticks while the model walks on. This is pre-existing (OFF row 1490, ON row 1245), hitless both ways, and in a
   leg this slice did not touch. Owner: fidelity (a pickup freeze).
3. **The train-tier dispatch at the tip** (403 here): `unittests_frontend.yml -f train_only=true` at `cae2889d` or
   this report's head.
4. **STRIKE_SLOT's census claim** should be amended by its owner: a body strike on a non-blade selection exists (§3.5).
   The two switches compose (§4).
5. Fresh-page witnesses still need the slot translation (entry-37 §9.4); `tools/witness.mjs` does it. No tooling was
   edited.
