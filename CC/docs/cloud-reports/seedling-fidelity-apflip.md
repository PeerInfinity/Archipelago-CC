# Seedling fidelity APFLIP — `apReportBosses` ON for the R7 merge, the R4 witnesses on p4g, the L32 rock move measured

**Verdict: W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS · D5 PASS · D6 PASS (the flip, licensed; every mover re-pinned
by name).**

| | |
|---|---|
| Session | `seedling-fidelity-apflip` (planner `seedling-fidelity-planning-9`, wasm rebuild R2) |
| Start SHA | **`a4b64aef9a`** (`fidelity-flip/apbosses`: js-7's R7 integration branch with APBOSSES merged in) |
| Harness branch | **`claude/seedling-apreportbosses-flip-7yhtuw`**; nothing went to `main` |
| Submodules at the base | wasm `frontend/modules/flashPanel/wasm` = **`9968c7d`** (`p4g-rebuild`), `vendor/seedling` = **`ccdf189776`** (neither moved) |
| Commits | W0 `ef29627a` · D1 `2efb36bc` · D2 `488b466a` · D4 `7ad26e63` · D5 `005a488b` · D3 `ecb192bc` · D6 `af8ca729` + `13ab694d` · records + this report (the head) |
| Game | `seedling_bot_ap_p4g`, headless logic-only, `serve-nocache.py 9698` (PID 575, stopped by PID at the end), under the box lock |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-apflip-evidence/` (`w0/`, `after-off/`, `on1/` (ON before the re-pins), `on2/` (the head), `d1/`, `d3/`, `survey/`, `mutants/`, `tools/`) |

## The one thing to know first

**With the flip, nothing on the committed roster leaves L32 by the pit unless it already held Fire.** The R4 game
grants nothing at the Fire's collect, and the host grant (APBOSSES H1) is not built. So every no-Fire L32 tape now ends
in the arena. That covers `swim-u5-bobboss-encounter`, `r9-solve-32` (the campaign's last segment), `enc-l32-fallen-door`
and `enc-l32-live-arrival`. Survey step 51 is REFUSED by name. The live page's mapped L32 goal (`wasmArrival
.arrivalSolverGoal`, JS arc) still asks for the pit, and it is refused by name too (`precondition`).

The moved arena rock (D1) is the user's way out without Fire. It is measured on the game and the model already reads
it, but it reaches no route until the rules arc adds its row.

## W0 — the base (PASS)

`tools/battery.sh` (APBOSSES', re-pointed at p4g); the producer glob is `tools/check-glob.sh`, run in a pristine
detached worktree of the base.

| row | W0 |
|---|---|
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, Node v22.22.0; wasm `9968c7d…`, vendor `ccdf189776…` checked |
| censuses | surface GREEN **320** · constants **6,079** PASS · entities **566** · profile **138** · roster **282** |
| tapeRunner pairs | **621 `fceca579b35f6daf2f15c90c0c70ba0e`**, 0 non-pass (= APBOSSES' W0: p4g moves no committed model pair) |
| bounded vitest BEFORE | **103 files / 2,930 green** (`w0/vitest-files-w0.txt`: the brief's set + APBOSSES' + the boss-fight files) |
| identity block | md5 **`738b7ab5921f1df5df66a0277c81df5d`** (= APBOSSES' base, row for row); six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| producer glob (`plan-seedling-*.mjs --check`, **91**) | 85 exit 0. Red: `r5-conch`, `r5-feather`, `r6-shieldboss` (known red on main, a hammer slice owns them). `pushblock-witness` (DRIFT on `pushblock-l65-sword-press`) and `r7-attribution` ("value-change set DRIFTED — got ,") are both red at the base itself. `r7-ends-meet` red only from lock and port contention (exit 0 alone on :9698) |
| reference | 4 generated regions differ at the base (environmental: the substrate submodules are not checked out) |

## D1 — the L32 rock move, MEASURED (PASS; inputs for the rules arc, no patch row)

**The entity:** level **32**, class **`fallrocklarge`** (AS3 `FallRockLarge`), current **x 64, y 128**, **tag 1**
(`tset 0, bossrock 1, thirdboss 1`).

**The geometry.** `FallRockLarge.update` (`:71-80` @ccdf189776) arms on `p.y < fallTo - sprRock.height/2 - 8` = y < 120,
**y only**. The landed box is `setHitbox(32, 32, 16, 16)` around `(_x + 16, _y + 16)`, which is `[x, x+32) × [y, y+32)`.
The stairs (`stairsdown@72,136`, a 16×16 Teleporter) are `[72,88) × [136,152)`, and the room is 160×160. The player's box
is 4×5. The rock must clear the stairs, so `x ≥ 88` or `x + 32 ≤ 72`. **The smallest move is 24 px, to x 88 (or x 40).**

The landed boxes:
- x 88: **[88,120) × [128,160)**;
- x 40: [40,72) × [128,160);
- x 96: [96,128) × [128,160), exactly on `tree@96,128`. This one is 16-aligned, so the planner's tile flood sees the
  whole column 4–5 gap open.

The L30 arrival (80,128) lies outside each of them, and the rock lands while the player is above y 120.

**Is x an OEL attribute?** No. `x`/`y` are the entity's own placement, not `attrs`, so `set-attrs` cannot move it. The
rules arc needs a `move` op; ROCKMOVE's scratch spelling is in `seedling-fidelity-rockmove-evidence/scratch-setpatches.diff`.

**The game witness** (`tools/witness.mjs`, spec `d1/specs/l32-rock-walkout.json`). The tape is
`swim-u5-bobboss-encounter`'s inputs to t840 with its equip dropped, then `down` to t980. Each arm is a scratch delivered
set (`vanillaRecordSet` plus a `move`), loaded with `botLoadLevels` in my tree only:

| arm | game | model ON |
|---|---|---|
| vanilla (64,128) | stuck at y 125 over the rock; cleared {32,1}{32,3}{32,4} | same, final (80, 125) |
| **move 88,128** | stream identical to vanilla's through **t877** (the arm frame t8, the fight, the kill, the Fire collect); **L32 → L30 by the stairs at t886**, WITHOUT Fire; same clears | identical (t886, final (232, 205) in L30) |
| move 96,128 | the same | identical |
| move 40,128 | the same | identical |

So, against the brief's four claims (`d1/analyze.txt`):
- (a) the trigger tick equals vanilla's, t8;
- (b) the fight and the spawns are identical, the whole stream through t877;
- (c) after the kill, WITHOUT Fire, the player walks L32 → L30 by the stairs;
- (d) the landed box is as above.

**The model's rock was a CONSTANT.** `bobBossFight.bobBossRockRect()` returned `ROCK.sealsRect` (64,128) whatever the
set said. OFF, every moved arm stays stuck at y 125 in the model while the game walks out (`d1/model-off-on.txt`).
Under the switch, `levelRun.bobArenaRockRect()` takes the `thirdboss` rock's `world.fallRocks` row instead. It adds no
run state (the digest is untouched) and leaves the arm y alone (the move is sideways). Witness names:
`d1/witness/l32-rock-walkout-{vanilla,move-88-128,move-96-128,move-40-128}.json`.

**To rules-2:** `fallrocklarge`, L32, (64,128), tag 1 → **(88,128)**, landed **[88,120)×[128,160)** (or (96,128),
[96,128)×[128,160), tile-aligned). Witnesses as named. The pit still needs Fire; the host grants it later.

## D2 — the Totem gate (PASS)

`ccdf189776` is one commit past `0eda15f785` and touches `Enemies/BossTotem.as` only (+5 −1): `:291` adds
`&& Player.hasAllTotemParts()`.
- `stepBossTotem` takes `allTotemParts`. Undefined is the pre-R4 edge, so OFF is byte-identical.
- `levelRun` passes `totemGateNow()`, which reads `hasAllTotemParts()` live, at both call sites.
- Under the switch, the live stepper also takes the activation edge for a SLEEPING boss. It does so when
  `classCount(Wand) <= 0`, read off the world: a room whose Wand is gone, because `{43,0}` is cleared or an `apitem`
  stands in its place. It never takes the edge inside a ceremony, which is named as unmodelled. Before this, the model
  woke the totem only inside the Wand's own rock drop, so a Wand-less room never fought.

Measured (`fidelityApFlip.test.js`):
- ON, `{43,0}` cleared + 5 parts: the boss wakes at tick 1.
- ON, 0 or 4 parts: no fight and no rocks (they drop only on `Wand.removed`).
- ON, Wand present: asleep.
- OFF: never wakes.

**Re-cited at ccdf189776:**
- `BOSS_TOTEM.src`: every line from the activation block down moved +4 (activate `:291-297`, ramp `:298-317`, …).
- `apReportBosses.js`: header note, and the Totem row's writer is now `:482`.
- **The brief's "FallRockLarge 67→68" is not so:** `FallRockLarge.as` is 153 lines at both `0eda15f785` and
  `ccdf189776`, and `git diff 0eda15f785 ccdf189776` names BossTotem alone.

## D3 — the game witnesses on p4g (PASS)

Thirteen tapes were recorded with `check-seedling-bot-differential.mjs --record --only=…` (`d3/record.log`):
**ALL CHECKS PASSED, every readout row, and "THE MODEL REPRODUCES THE RECORDING IT JUST MADE" on each, 0 px.** The `apb-*`
tapes are authored by `plan-seedling-encounters.mjs`, solved by `solveSegment` under ON, apart from the two named below.
The game's own `persistence_cleared` was dumped for six of them (`d3/witness/*.json`, `tools/d3-readouts.sh`).

| tape | what the game shows |
|---|---|
| `apb-l32-fresh-fire-held` | Q2: fought with Fire held (arm, 7 landings); {32,1}{32,3}{32,4}{32,0}; the burn, the pit to L30 at t976; no {31,29} |
| `apb-l32-fresh-no-fire` | both reports {32,3}{32,4}, **`hasFire` stays false**, no {31,29}; ends in the arena 30 ticks after the ceremony (869 t) |
| `apb-l32-killed-drop-held` | {32,1}{32,3} staged: the fallen rock's first frame adds the FIRE, no boss; collect → {32,4}; no item |
| `apb-l32-both-reported` | {32,0}{32,1}{32,3}{32,4} + Fire: nothing spawns, `already`, the pit to L30 (replaces `enc-l32-fire-return`, retired) |
| `apb-l12-witch-slot-held` | the talk, the sword at the feet, its ceremony; **{12,1} cleared, `hasDarkSword` false, no {11,29}**; out by the L95 door |
| `apb-l12-witch-server-sword` | `textExtra1` spoken (583 t) AND the sword still added and collected; {12,1} cleared |
| `apb-l12-witch-reported` | {12,1} staged; `slot-held`'s inputs REPLAYED (the solver would answer `already`): the talk opens and closes, nothing added. Its walk then stays in L12 (no ceremony, so the inputs land elsewhere); game = model |
| `apb-l43-totem-no-parts` | {43,0} staged, no parts: **no fight, no rock** (cleared: {43,0} alone; no {43,1..3}, no {43,5}); L43 → L40 by the stairs at t218. ⚠ AUTHORED keys (right, then down the neck), not solved: the solver's walk from this boot throws by name (a sword press reaching `watcher@200,280`), a walker gap the witness does not need |
| `swim-u5-bobboss-encounter` (mover) | no producer: cut at t840 (`tools/truncate-u5.mjs`; every input before it unchanged), its equip dropped, 30 idle ticks; 871 obs |
| `r9-solve-32` (mover) | the campaign's L32 window ends in the room (below): 839 t, 840 obs |
| `enc-l32-fallen-door` (mover) | the room goal: 838 t + 30 idle; {32,3}{32,4}, no Fire |
| `enc-l32-live-arrival` (mover) | the page's plan to the collect (832 t; it was 1,049 to the pit, with the equip at t833) + 30 idle |
| `enc-l12-witch` | re-recorded: its stream is byte-identical on p4g; its producer check now reads the {12,1} report, not `hasDarkSword` |

## D4 — H2, the four boss rooms rebuilt after their kill (PASS)

`levelWorld.AP_BOSS_PERSISTENCE_RESPONSE`, read through `persistenceResponseOf(type)` only under the switch. It feeds
`clearedAwayByTag`, the build loop and the clearable census. The rows, from the AS3 @ccdf189776:

| class | response | AS3 |
|---|---|---|
| `finalboss` | `despawn` | `FinalBoss.as:68-74` `check()` → `FP.world.remove(this)` |
| `bosstotem` | `despawn` | `BossTotem.as:462-468` `check()` → `doActions = false; remove` |
| `tentaclebeast` | `built-dead` | `TentacleBeast.as:52-60`: dead, still the `pixelmask` Solid. ⚠ its mouth `Teleporter` (`:211-214`) is NOT built |
| `lightbosscontroller` | `end-state` | `LightBossController.as:48-63`: no text, totem or fliers; `endState()`. ⚠ its exit `Teleporter` (`:102-107`) is NOT built (L69 is never entered by the rules) |

The totem's kill ({43,5}, `:482`) is banked into `pendingEarnedClears` under the switch, so a same-run re-entry builds
it despawned. Rows (`fidelityApFlip.test.js`):
- OFF: each of the four slots throws, as APBOSSES measured.
- ON: the Owl and the Totem are gone; the Beast's and the Lights' geometry is equal to the live room's (the beast body
  is still a wall).
- The banking row.

**What the brief got wrong here:** *"nothing spawned: LightBossController.as"*. With its slot cleared, `check()` runs
`endState()`, which ADDS the exit Teleporter and writes the slot. It spawns none of the fight, but it does add a door.

## D5 — the JS capability (PASS; js-owned file, carried for js-7's review)

- `seedlingRandomizerEligibility.jsRuntimeCapabilities()` returns `[apitem, bossreport]` while
  `CONTACT_FIDELITY.apReportBosses` is on, and `[apitem]` otherwise. It is read on every call.
- **`BOSS_REPORT_CAPABILITY` already existed here**, beside `AP_ITEM_CAPABILITY` and in `WASM_BUILD_CAPABILITIES`. It
  was not needed from the rules arc's branch.
- Readers switched:
  - `checkCapability`'s JS-transport arm;
  - `seedlingRandomizerWiring.js:927` (`tagCapable`), the real caller. `flashPanelUI.js` only names the constant in a
    comment.
- **`JS_RUNTIME_CAPABILITIES` is KEPT.** `seedlingDemo/jsRuntimeCore.js:151` re-exports it, and `jsRuntimeCore.test.js:139`
  pins it by identity.
- Rows: the name, OFF, ON, and a toggle (both ways).

## D6 — the flip (PASS)

`apReportBosses: true` in `contactFidelity.js` and its defaults pin, with the docblock naming what the switch now covers.

**Measured ON before any re-pin (`on1/`):**
- identity: only `solve-seedling-r9-campaign` moves (exit 1, the burn);
- tapeRunner: **621 `c486d269…` 10 non-pass**, which is APBOSSES' banked ON value exactly, so D1/D2/D4 add no tape mover;
- bounded: **23 red in 7 files**, which is APBOSSES' 24 in 8 less the `contactFidelity` pin.

**Every mover, re-pinned by name:**

| file / artifact | rows | how |
|---|---|---|
| `fidelityEncounters.test.js` | 8 | the vanilla-AS3 describes NAME their arm (`vanillaArm()`: OFF per describe) |
| `fidelityEncounters2.test.js` | 4 | the same (they read the p4f `pickup-removal-witness.json`) |
| `solverEncounter.test.js` | 3 | the same |
| `fidelityApBosses.test.js` | 4 | the default pin → ON; its three OFF rows wrapped OFF |
| `dialogueAutoAdvance.test.js` | 2 | the roster 282 → 289 (it still parts on `r8-solve-10` alone) |
| `observationTolerance.test.js` | 1 (+1) | 282 → 289 recordings; 289 swapped (measured) |
| `seedlingEncounterBinding.test.js` (flashPanel) | 1 | `4 · PERSISTENCE`: the staging and the fallen rock as before; the solve is now REFUSED by name at the burn (`precondition`) |
| `contactFidelity.test.js` | 1 | the defaults pin |
| `tapeEnvelope.test.js` | 1 | 282 → 289 |
| `r8Acceptance.js` + `.test.js` | 2 | exposure 90 → 91, measured from the recordings. Out: `enc-l32-fallen-door`, `enc-l32-live-arrival`, `r9-solve-32`, `swim-u5-bobboss-encounter` (they end in L32 now) and `enc-l32-fire-return` (retired). In: the six `apb-*` that enter L12/L30/L40 (predicted before the guard ran) |
| `addEquips.test.js` | 1 | `r9-solve-32` lost its t840 equip → `apb-l32-fresh-fire-held` declares it |
| `playthroughAcceptance.test.js` | 1 | the campaign's tail arrives in L32, not L30 |
| the identity bank (`r9-campaign`) | — | `solve-seedling-r9-campaign.mjs`: an encounter whose drop IS the Fire has `then: null` under the switch. `r9-solve-32` is re-emitted (only that segment; no earlier latch moved), `endsAt` 10,839 → 10,622, `campaignChain`'s `why` updated, the generated `campaign-chain` region regenerated |
| `plan-seedling-encounters.mjs` | — | the L32 room goal + 30 idle ticks; `enc-l32-fire-return` → `apb-l32-both-reported`; the eight `apb-*` blocks |

**At the head (`on2/`):**

| row | W0 | ON (the head) |
|---|---|---|
| identity block | `738b7ab5…` | **`825b05a3f7c861a06b081518d9218ef0`**: only `solve-seedling-r9-campaign --check` moves, `3d41b9fb` → **`0dd65640…` exit 0** |
| tapeRunner pairs | 621 `fceca579` | **635 `e164838673a48b38ce187093c363edb2`, 0 non-pass** |
| bounded vitest | 103 / 2,930 | **129 files / 3,829 green** (`on2/vitest-files-on2.txt`) |
| censuses | 320 / 6,079 / 566 / 138 / 282 | GREEN 320 / 6,079 PASS (`--write`: rows moved by line, 0 new) / 566 / 138 / **289** |
| producer glob (91) | 85 + `r7-ends-meet` (port) | **86 exit 0**, the same five red as the base (the three known, `pushblock-witness`, `r7-attribution`). Stdout moves at exit 0: `plan-seedling-encounters` (its new tapes) and `plan-seedling-r2-route` (its clear census reads **83 offered / 54 refused, was 81 / 58**: D4's four rows). `l40button-witness` differs only by the worktree path |
| reference | 4 environmental | the same 4 (`campaign-chain` regenerated) |

The OFF arm before the flip (`after-off/`, at the D1–D5 code): identity `738b7ab5` (equal), pairs 621 `fceca579`,
bounded 113 / 3,306 green.

**The survey, locally, OFF vs ON** (`survey/`; the 20 steps APBOSSES chose, by (level, goal, boot)):
- **Step 51** (L32 encounter → Fire, then the pit): SOLVED 1056 t → **REFUSED, `precondition`** (*"…the Fire pickup
  grants nothing … this run holds none."*). As the brief requires: the host grant is not built.
- The other 19 steps are identical: 28 39 (L19), 30 32 43 57 74 80 115 130 144 165 175 (L12), 49 (L31), 94 (L57),
  113 (L43), 161 182 (L82) and 208 (L112).
- **No route step changes because the stairs are open:** the rock move is not in the survey's map until the rules
  arc's row lands, and step 51's goal is the pit.

## The survey/sweep rows this moves, and the CI dispatches (I get 403 on `workflow_dispatch`)

1. **`seedling-survey.yml`** on this branch: `through=end`, `route=full` (all steps). Expected against run 39153361080:
   step 51 SOLVED → REFUSED `precondition`, and nothing else moves.
2. **`seedling-divergence-sweep.yml`** on this branch, `page=seedling_bot_ap_p4g`, as an A/B with no code edit:
   - A: `contact_fidelity=` unset (the defaults, now ON).
   - B: the same list minus `apReportBosses`.
   - Keys (by KEY, not by id) from baseline 39153416627:
     - `location:Level 012 - Witch` (ids 109 119 129 139 149 159 169 there);
     - `level_32 <- in_L30_224_160 -> exit:out_pit_14_5` / `_15_5` (349 350);
     - `location:Level 032 - Bob Boss` (351);
     - `level_32 <- in_L30_224_160 -> exit:out_stairsdown_72_136` (348);
     - the L43 legs `level_43 …` (419–444).
   - Expected: on p4g, A agrees with the game where B diverges on the Witch and the Fire-held L32 legs, and the no-Fire
     pit legs refuse by name in A.
   - ⚠ A row is one sample. Replay any flip with `replay-seedling-solve-request.mjs --seam-time-sweep`.
3. **`seedling-probe.yml`**, `probes=probe-seedling-l37-fallrock.mjs`, once the rules arc carries the L32 `move` row
   (a delivered-set regression check).
4. **`seedling-full-tier.yml`** on this branch: `tier=mechanic` (or `full`), `page=seedling_bot_ap_p4g`. Then, box-side,
   `record-standing-value.mjs --category=mechanic --quote=<v> …` (I may not run `standing-values --write`).
   **This is the one CI red at the flip** (below). `scripts/procgen/standing-values.json`'s `roster: --tier=full` row
   pins `mechanic` at **222** tapes (`4870/0/0`, measured at `edbbae54`), and the disk now holds **229** (+8 `apb-*`,
   −1 `enc-l32-fire-return`). `rosterCategories.test.js` › *"the LIVE row carries one part per derived category"* reds
   until the row is re-measured on the new roster.
5. CI vitest at the head: `node scripts/procgen/ci-vitest-summary.mjs <head>`.
   - At D5 `005a488b` (run 39345245834): green.
   - At D6 `af8ca729` (run 39349001526): **21,366 / 21,367**, slow 254 / 254. The 1 red is that standing row (item 4).
   - The head's run is quoted in the final chat message.

## The JS arc's pins that move, and what it must wire

- **`wasmArrival.arrivalSolverGoal`** maps an L32 location to `encounter … then: 'reach-pit'`. Under ON with no Fire, that
  is refused by name at the burn, so the live page's L32 location solves stop there (`seedlingEncounterBinding`'s
  `4 · PERSISTENCE`, re-pinned to the refusal). Until H1, either end it in the room (`then: null`, as the campaign and
  `enc-l32-*` now do), or wire the host grant.
- `jsRuntimeCapabilities()` (D5) replaces `JS_RUNTIME_CAPABILITIES` at the two readers. The constant stays for
  `jsRuntimeCore`'s re-export.
- `enc-l32-live-arrival` is no longer "the page's shipped 1,049-tick plan": it is that plan to the collect (832 t).
- Nothing new in `solveSegment`'s contract. No new `SolverRefusal` kind; the refusal is the existing `precondition`
  sentence.

## Handed to the hammer arc

Nothing. No edit touches its region. The digest is unchanged: `bobArenaRockRect` reads the world, not new run state.
The totem's banked clear rides `pendingEarnedClears`, which is already digested in `persist`.

## What the brief got wrong (measured)

- *"AS3 line citations moved at ccdf189 (… FallRockLarge 67→68)"*: FallRockLarge is 153 lines at both SHAs, and only
  BossTotem changed (486→490 is not the count either: 726 → 730).
- *"LightBossController.as: nothing spawned"*: `endState()` adds the exit Teleporter (D4).
- *"Find `BOSS_REPORT_CAPABILITY` on the rules arc's host branch or define it"*: it is already in this file.
- *"switch every reader (~:278, and flashPanelUI's caller)"*: flashPanelUI has no reader (a comment). The second reader
  is `seedlingRandomizerWiring.js:927`.
- *"Bank them by name: r5-conch, r5-feather, r6-shieldboss"*: two more producers are red at the base itself:
  `pushblock-witness` and `r7-attribution`.
- *"`enc-l32-fire-return` → replaced by `apb-l32-both-reported`"*: done. Retiring it also needed its `r8Acceptance`
  exposure row, the `dialogueAutoAdvance`/`tapeEnvelope`/`observationTolerance` counts, and the tape index.
  `dead-frame-observations.json` (a historical p4f census, not a roster pin) still names it.
- *"the model ON reproduces each at 0 px"* holds. But `apb-l43-totem-no-parts` could not be SOLVED: the solver's walk
  throws by name in L43 from (144,240). It is an authored walk.

## Residue

- **CI's one red:** the `roster: --tier=full` standing row's `mechanic` part (222 → 229 tapes) needs the planner's
  full-tier dispatch and `record-standing-value.mjs` (above). It is a measured value I may not write.
- H1 (the host grant mid-visit) is still the one thing that stops a no-Fire run leaving L32 by the pit.
- The Tentacled Beast's mouth Teleporter and the Lights' exit Teleporter are not built on a cleared slot (D4, named).
- The totem's activation edge inside a ceremony is unmodelled (it stays asleep; named in the code).
- The solver's walker in L43 from (144,240): a sword press reaching `watcher@200,280` throws (a plain `Error`).
- `fixtures/dead-frame-observations.json` keeps the retired tape's historical row.

## Byte-inertia

- The OFF arm of D1–D5 is byte-identical (`after-off/`).
- No AS3, wasm or gitlink edit. No `SEEDLING_SET_PATCHES` row; the rock moves lived in scratch sets.
- No rules, world or host file touched.
- No `pytest`, no unfiltered vitest, no `standing-values --write`.
- `solve-seedling-r9-campaign` was not run in write mode: a temporary copy wrote `r9-solve-32` and its trace only, then
  was deleted, and the real `--check` is exit 0.
- The pristine worktree `/home/user/apflip-base` is removed at the end.

## Rows to BANK (the head, ON)

| row | value |
|---|---|
| identity block | `825b05a3f7c861a06b081518d9218ef0` (r9-campaign `0dd656407ab78c3a46815716c38fee71` exit 0; all else = `738b7ab5`'s rows) |
| tapeRunner pairs | 635 `e164838673a48b38ce187093c363edb2`, 0 non-pass |
| roster / exposure | 289 / 91 |
| bounded vitest | 129 files / 3,829 green |
| producer glob | 91: 86 exit 0; red `r5-conch`, `r5-feather`, `r6-shieldboss`, `pushblock-witness`, `r7-attribution` (all red at the base) |
| survey (20 local steps) | step 51 SOLVED 1056 → REFUSED `precondition`; 19 identical |
| campaign | `endsAt` 10,622 (was 10,839), `r9-solve-32` 839 t, ends in L32 |
| D1 for rules-2 | `fallrocklarge` L32 (64,128) tag 1 → (88,128), box [88,120)×[128,160) (alt. (96,128)); witness `d1/witness/l32-rock-walkout-move-88-128.json` |
