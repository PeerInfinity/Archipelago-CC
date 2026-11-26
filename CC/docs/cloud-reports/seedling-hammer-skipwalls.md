# Seedling hammer-phase — SKIPWALLS (re-measure-7's walls past entry 29: triage, fix one)

Slice `seedling-hammer-skipwalls` (Opus, cloud). Planner: `seedling-hammer-phase-planning-14`. ⚖ Approved by the user on
2026-11-24 (*"Skip-probe walls"*). No planner follow-up arrived during the slice, so none was followed.

## 1. Commits

- **Start:** `a5f7c6caf4563d8b0c65776f03ada03e2343c04a` (`origin/main`, TRAIN 207). Main did not move during the slice
  (re-fetched before this report), so no merge was needed.
- **Branch:** `claude/seedling-hammer-skipwalls-t0b6u3`.
- **Commits:**
  - `6f6ec1f7` the switch, its rows and the captured-request fixture;
  - `d775ef46` the evidence (`seedling-hammer-skipwalls-evidence/`);
  - the report commit (this file) is the head.

## 2. The answer first

- **Switch:** `solverBot.BRIDGE_OPEN_STRAY` (`SEEDLING_BRIDGE_OPEN_STRAY=1`, `withBridgeOpenStray`). It ships **OFF**.
  The decision is on the solve **worker** thread, inside the frontier loop (`resolveBridgeStrategy`), so the env
  channel carries it. No main-thread mapper reads it.
- **The one thing to know first:** wall C (L61's spear bridge, survey step 155) was never a stance or geometry problem.
  L61's bridge is two tiles long, (10,13) and (11,13). The run opens the near tile first. After that, every stance for
  the far tile has a spear rect that also touches the **already open** near tile, and the stance audit counted that
  tile as a stray press responder. A Spear hit on an open bridge is a no-op in the game and in the model
  (`bridges.bridgeHit`: the timer goes negative and the tile stays walkable). ON, the audit waives a stray bridge tile
  that `openBridges` already holds. A closed stray still refuses.
- **Results with the switch ON:**
  - **Captured page request P1 33:5:** OFF refuses (`74d893565dd6`, work 224, as the page did). ON it **solves**
    (`7ca39971ac20`): 365 ticks, model hits 0, deaths 0. The keys replayed on a fresh run cross into L63 at t365 with
    no hit and no death.
  - **Survey `--through=end`, 250 steps:** only step 155 moves, REFUSED → **SOLVED** (317 ticks, replay 0 hits,
    0 deaths, end L63). The other 249 steps are identical in every field. **No step gains a hit.** The totals go from
    224/26 to 225/25.
  - **p4g game witness (fresh page):** the crafted L61 crossing leg goes from `failed` (the wall, word for word) to
    `done`. It takes 365 ticks (verbs `bridge`, `dodge`, `walk`), room hits max 0 over 529 samples, no divergence, and
    0 recoveries. The game ends at L63 (24,216), which equals the model's end.
- **The other two walls** are not class (a) fixes of this size:
  - **A (L40 → L42)** is a knock-on of the skip, not a wall. Entry 29 was skipped, so `bosslock@480,352`
    (L40 tag 8) was never opened. With tag 8 staged, the same captured request solves hitless (1563 ticks).
  - **B (L40 Totem Part 64,144)** is a real refusal, and not a budget one. At 4× the budget it still refuses within
    budget. Handed over (§9).
- **OFF identity:** acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base, at the head with the switch OFF,
  and at the head with it ON.

## 3. The reproduction (measured)

**Inputs.** The captured requests come from re-measure-7's `P1.stop-requests.jsonl.gz`
(`origin/claude/whole-game-wasm-remeasure-yl4bw0` @7ce198106c). They were solved in node the way the worker does
(`replay-seedling-solve-request.mjs`, plus `tools/solvecap.mjs` for the full message), under the capture's own env
`SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1`. All three reproduce the page's answer hash exactly
(`repro/replay-*.txt`).

| wall | request | page answer | node at base | rung by rung | class | fix cost |
|---|---|---|---|---|---|---|
| **A** L40 → L42 (`wasm-exit-40`, reach-exit (848,0)) | P1 30:1 (2560) | `d7737fa76889` | same; dashless refuses at 1145 work, full pass cut at `walk` (1416) | strategy loop: `brave(iceturret@472,400)`, `weigh(wandlock@448,432)`, `weigh(wandlock@800,400)`, `hold(button@816,400)`, then *"the corridor still does not plan"*. At **10240**: the same refusal at **4111** work (the full pass finishes and refuses), so **not a budget wall**. The staging's L40 persistence lacks **tag 8** (`bosslock@480,352`); with `40:8` staged, the request **solves**: 1563 ticks, model hits 0, work 1764 (`repro/A-30-1-staged-L40-tag8.txt`) | **(d)**, a probe artefact: the skip of entry 29 left the lock shut | none needed for the walk (entry 29 now solves with `KEYLOCK_TURRET_ARRIVAL`); see §9 |
| **B** L40 Totem Part 64,144 (`wasm-location-40`, collect (64,144)) | P1 32:12 (2560) | `599d2ef41b84` | same; dashless refuses at 836, full pass cut at `crusher-fork` (1725) | `apitem (64,144) contact -> hold`: the hold stands still up to 131 ticks at (167.9,135.2), inside `bombpusher@112,128`'s 256 px reach (a blast at (168,134), 44 ticks in). The group is LATCHED, so `MOVING_WAIT` tries 256 pacings: left/right and up/down end a cycle off the stance (e.g. (170.98,135.25)); down/up meets `spinner@192,128` at paced tick 33. At **10240**: it refuses at **3142** with the same rung (`08e6c53f1e55`). With `PRESS_KILL_HOLD`, `BOMB_PHASE_WAIT`, and with those plus `PRESS_KILL_BOMBS`, `BOMB_BLAST_BODY` and `HOLD_WAIT_PRICED`, all at 10240: **unchanged** (`599d2ef41b84` / `08e6c53f1e55`) | **(a), probable but unproven**: a latched hold need not stand on the stance | medium-high (§9) |
| **C** L61 → L63 (`wasm-exit-61`, reach-exit (224,208)) | P1 33:5 (640) | `74d893565dd6` | same; work 224 (dashless 29, full 195) | `resolveBridgeStrategy` for bridge (11,13): (168,216)E, (152,216)E and (200,216)W each *"also reaches tile:Bridge@168,216"*; (216,216)W has no corridor; N and S are not floor or off the level. `openBridges` = `['10,13']` at that point: the "stray" is the tile this solve opened earlier in the same visit | **(a)**: a hitless line exists, and one filter misses it | **tiny**: one filter, one predicate |

The planner's pending flips do not move any of the three. With `KEYLOCK_TURRET_ARRIVAL=1` and
`STRIKE_PREVIEW_LEAN=1` added, all three answers are byte-identical (`repro/*-msgflip-*.txt`).

**Why C first.** C is the only class (a) wall whose hitless line I could exhibit before writing a fix. Its cause sits in
one audit line, the game and the model both state that the stray hit is harmless, and the fix touches no model file. B
may be class (a) too, but finding its line means redesigning a rung (§9). A does not need a fix.

## 4. Design and change; OFF identity

- **Design:** `resolveBridgeStrategy`'s stray filter gains one more `.filter` behind the switch:
  `!(BRIDGE_OPEN_STRAY.enabled && bridgeStrayAlreadyOpen(run, obstacle, at, r))`.
  - `bridgeStrayAlreadyOpen` is true only for an `as3: 'Tile'` responder whose bridge id `${tx},${ty}` is in the
    run's `openBridges`. ON, it records `{bridge, stance, open}` in `BRIDGE_OPEN_STRAY_COUNTS.waived`, an instrument
    that nothing which decides reads.
  - It is generic. There is no level, coordinate or Seedling constant in it.
  - A closed stray bridge, a pushable or any other responder still refuses, as before.
  - The executor (`execBridge` → `runSpear`) already tolerates the extra hit. `levelRun`'s press records the first
    press of a bridge only, as the game's `genericHit` decrements without a guard (`bridges.js:128-135`).
- **Change** (`solverBot.js`): one new block (the switch object, its default, `withBridgeOpenStray`, the counts and
  their reset, and the predicate) placed above `resolveBridgeStrategy`, plus the one call site. `solverEnvChannel.js`
  gains `SEEDLING_BRIDGE_OPEN_STRAY` (sorted). The regenerated `seedling-solver-surface.json` records +1 `entities`
  site (`openBridges`). The surface `--check` is GREEN, and the procgen reference and docs index regenerate with no
  change.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - base `a5f7c6ca`: `391322d681b7aa0229d94b3f6906d024`;
  - head with the switch OFF: `391322d681b7aa0229d94b3f6906d024`;
  - head with `SEEDLING_BRIDGE_OPEN_STRAY=1`: `391322d681b7aa0229d94b3f6906d024`.

## 5. Rows and bounded vitest runs

`hammerBridgeOpenStray.test.js` (fast tier, 4 rows, ~1 s), with `hammerBridgeOpenStrayRows.js` and the fixture
`fixtures/bridge-open-stray/P1-33-5.request.json` (16 KB). The fixture is the page worker's request with its source cut
to the L61/L63 records; the rest is the committed atlas. It reproduces both page hashes.

| row | asserts |
|---|---|
| switch | OFF by default; the env channel lists the name; the wrapper toggles and restores |
| source | exactly one `&& bridgeStrayAlreadyOpen(` call; the guarded filter sits on the audit's `.illegal` chain inside `resolveBridgeStrategy` |
| predicate | an open tile is waived and counted; a closed tile, a pushable, a tile with no id, and a run with no `openBridges` are not |
| witness (P1 33:5, under GSW + PM) | OFF: answer `74d893565dd6`, the verbatim bridge refusal, nothing waived. ON: solved; on a fresh run (its equips re-made) `hits = []`, `deaths = 0`, crossed to 63; every ok pass `modelHits` 0/0; waived only `bridge@11,13 / 10,13` |

- **Mutation:** inverting the predicate's open check turns the predicate row and the witness row red (2 of 4). I then
  restored the file.
- **Bounded runs:**
  - `npx vitest run hammerBridgeOpenStray.test.js solverEnvChannel.test.js`: 2 files, 15/15.
  - Then with `fidelityRulesref.test.js`, `contactFidelity.test.js` (every non-train test that names the bridge verb)
    and `scripts/procgen/seedlingSolverSurface.test.js`: 5 files, **124/124**.
  - No unfiltered vitest, no pytest. No doc under `docs/json/developer/procgen/` changed, so no link-census pins were
    owed.

## 6. Page play / game witness

`probe-seedling-divergence-sweep --page=seedling_bot_ap_p4g --mode=inv --page-legs=1 --leg-budget-ms=480000
--capture-requests`, with fresh pages and `serve-nocache.py` on :8000 (started and stopped by this session). The run was
OFF, then ON with `--solver-env=SEEDLING_BRIDGE_OPEN_STRAY=1`. Each page logged
`SOLVER_ENV: … SEEDLING_BRIDGE_OPEN_STRAY=1`.

The legs file `sweep/legs-l61.jsonl` holds the 16 L61 legs of the seed-1 list and one **measurement-only crafted
leg**, id 9497: leg 497's arrival (`in_L60_160_80`, (16,160)) with leg 512's goal and sphere (7.5, which holds the
Spear). This is the whole-game walk's own crossing. The list has no leg for it, because the route's region graph splits
L61 at the bridge.

| leg (key) | OFF | ON |
|---|---|---|
| `level_61__r0c7 <- in_L60_160_80 ~> level_61__r13c12 -> exit:out_teleporter_224_208` (crafted) | `failed`: *"the solver declined … bridge bridge@11,13 in level 61 — … (168,216) facing E's rect also reaches tile:Bridge@168,216; …"* | **`done`**: 365 ticks (full pass; dashless 418), verbs `bridge`/`dodge`/`walk`, room hits max **0** (529 samples), no divergence, 0 recoveries, end **L63 (24,216) = expected** |
| the 16 L61 legs (497–512) | all `done`, room hits max 0 | all `done`, room hits max 0, the same plans (ok/ticks per request) and no divergence |

The crafted leg's page request solves to the **same keys** as the whole-game capture (`7ca39971ac20`): the two
arrivals are identical. Rows: `sweep/{off,on}-rows.jsonl` (with `granted` and `tapes` dropped).

## 7. Census: which seed-1 divergence-sweep legs the change can move

- **Reach.** The waiver acts only when the bridge verb resolves in a level where one spear rect reaches **two** bridge
  tiles, with one of them already open. I built every atlas level's world (`census/bridge-tiles.txt`):
  - only **L61** has such a pair, (10,13)-(11,13);
  - L63 (2,9), L66 (7,9) and L93 (7,13) each have one bridge tile, so nothing in them can change.
- **The L61 sweep legs** (16, ids 497–512 at this base):
  - `level_61__r0c7 <- in_L60_160_80 / in_L62_48_304 / in_L63_0_96 -> exit:out_teleporter_0_160 / 112_0 / 224_96`;
  - `level_61__r0c10 <- in_L62_96_304 / in_L63_0_48 -> exit:out_teleporter_160_0 / 224_48`, and
    `-> location:L63 flag 1: lightpole@64,88 cleared`;
  - `level_61__r13c12 <- in_L63_0_208 -> exit:out_teleporter_224_208`.
- **Measured.** Each of those legs' captured page requests (20) was solved in node OFF and ON
  (`census/l61-legs-node-on-off.jsonl`): **all 20 are byte-identical, with 0 waived**. The p4g sweep agrees: no leg's
  outcome moved (§6).
- **Why none moves.** No committed leg walks across the bridge. The r0c7 legs leave west, north or east-high, and the
  r13c12 leg starts east of it.
- **So no seed-1 sweep leg in the committed list moves.** The change moves the whole-game walk's crossing (entry 33's
  L61 leg, P1 33:5) and survey step 155. A sweep leg would move only if it crossed L61 west → east with the Spear.

## 8. What the brief got wrong (measured)

- **A is not a corridor or budget wall.** At 10240 work it refuses at 4111, inside budget. Its staging lacks L40 tag 8
  because entry 29 (the boss-lock crossing) was skipped. With that one flag, the same request solves hitless. Survey
  step 136 (SOLVED) boots at (928,96), north of the lock. It is a different arrival, not a disagreement.
  Re-measure-7's "possibly a probe artefact" is right.
- **B and survey step 149 are not the same refusal.** The page's request dies on the bomb-hold rung (`bombpusher@112,128`,
  MOVING_WAIT). Survey step 149 dies on `kill (spinner@192,128) by press` (the derived press lands on the 13 px hammer
  line), the L40 spinner wall named in the puncher-ladder report. They share a goal, not a rung. `PRESS_KILL_HOLD` ON
  (KILL880's note) does not change the page request: the hash is identical.
- **C's "no floor cell one or two tiles behind it … is reachable" reads as a stance problem.** It is not: three
  stances were floor and touched the target. All three were dropped for touching the open half of the same bridge.

## 9. Residue / hand-overs

- **A (L40 → L42 after a skip): no change proposed for the walk.**
  - Once entry 29 solves (`KEYLOCK_TURRET_ARRIVAL`, being flipped), the walk opens tag 8 before entry 30.
  - If a later probe skips 29 again, the residue is the strategy loop's cap. It applied four strategies (brave, two
    weighs, a hold), and the shut `bosslock@480,352` is not among them.
  - My reading, not measured: the keylock would be a fifth strategy, or the frontier never names the lock on this
    corridor.
  - The repro is the fixture-less `tools/solvecap.mjs … 30 1` (refuses) vs `--addflag=40:8` (solves 1563 ticks).
- **B (L40 Totem Part 64,144 from the south, flags 7 and 8 set): a solver hand-over, probably class (a), cost
  medium-high.**
  - The numbers: the hold stands still for up to 131 ticks at (167.9,135.2). The first blast lands at 44 ticks
    (57 under the bigger budget's path). `MOVING_WAIT` rejects all 256 pacings:
    - lateral and vertical pacings end a cycle 2.7–3.65 px off the stance (the closure is bit-for-bit);
    - down/up meets `spinner@192,128` at tick 33;
    - right/left (in the 10240 path) meets the bomb at tick 58.
  - The change I would make (switch-guarded, generic): for a **LATCHED** hold, do not keep the player on the stance.
    Once the latch has fired, the group stays open, so the wait can be spent outside every lobber's reach. That means
    a walk out of the 256 px disc and back, priced like any walk, before the hold's `until` resolves.
  - A cheaper but weaker alternative: accept a pacing cycle that ends at rest anywhere inside the presser's rect,
    instead of bit-for-bit on the stance. That needs the downstream plan to start from the cycle's real end.
  - Rows: P1 32:12 (captured, `599d2ef41b84`) as the witness; survey step 149 as a control (a different rung, which
    must not move).
  - This is not fidelity's: the model's blast and spinner both fire where it says they do. The rung is the solver's.
- **The p4g witness covers a crafted leg, not the whole-game walk** (none was asked for). The next re-measure with
  `SEEDLING_BRIDGE_OPEN_STRAY=1` should pass entry 33's L61 leg, as long as entries 29–32 reach it.
- **Not done: the dispatched train-tier run.** The new rows are fast-tier (no `*.train.test.js`), and the change does
  not touch solverBot's hammer, fidelity, a generator or `tileStep`. The CI default tier at this branch's push is the
  suite number.
