# Seedling fidelity F6: re-entering a room in the game's own saved state (I01 · I02 · I03)

**Slice:** `seedling-fidelity-f6`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning`). It works I1's first three rows.

⚖ **The standard** (the user, 2026-10-03): *"… the solver to be able to handle either state … and to have a way to know which state it's in. I don't want it to have to clear the save, and I don't want it to have to exit and reenter the room in order to solve it."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/f1-joint` @ **`696ca02b6c`** (F1 + F1b + F1c on main `aa85b29a8d`, plus the F1 joint re-aim). The harness's branch was at `79fa3f1`, an ancestor of that tip, and was reset onto it |
| Head | see the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-f6-cmi2k1` (the harness pins it; `seedling-fidelity-f6` was never pushed) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** |

## The one thing to know first

**53 of 53 committed persistence slots now build, and the chain-end staging boots in L2, L13, L16, L17 and L20.** Each of the three fixes is witnessed on the game, with a control arm that shows what the clear changes. The solver plans from the chain-end state in all three rooms:
- **L17**: the Seal chest solves.
- **L20**: the solver crosses the latched lock to L19.
- **L2**: L2→L3 solves. L2→L0 declines by a new, true name, because the MoonrockPile sits over L2's stairs back to L0. The set moonrock already covers L0's stairs to L2, so once the rock falls those two rooms no longer connect by stairs. That is the game's state, not a model gap.

The one surprise: **state that is live from the build runs one update ahead of the model.** The game's first update of a new world happens in the frame that records the arrival. The model's first activator step for that world comes one tick later. The game measured this (t108 vs t109), and the model now credits the step for a latched group. A latched **pulser** or **arrow trap** carries the same one-tick offset, unwitnessed (residue 2).

## W0 (at `696ca02`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9190 bash scripts/procgen/identity-block.sh .` in a **pristine detached worktree** at `696ca02` (venv active, its own dev server) | log md5 **`10b9365dd3ceee81999bd215a28389d1`**, which **equals F1c's published AFTER** |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 48d52d83 6cd35fe1 9168796b`, **all exit 0**, all equal to F1c's AFTER |
| reference | `generate-procgen-reference.mjs --check` | ALL 7 + 5 MATCH |
| tapeRunner | inside the bounded vitest | **457/457** |
| surface / constants / profile | `census-seedling-solver-surface --check`, `census-seedling-constants --check`, `witness-seedling-profile --check` | **GREEN 192** · **PASS 4,947** · **PASS 138 keys** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **200** tapes |
| I1's M2 / M3 re-run | scratch (`/tmp/…/f6/scratch/f6-scratch-m23.mjs`): every committed tape's `persistence` rebuilt one clear at a time; the chain-end staging (`r9-solve-32`) booted per room through `createRunForStaging` | **M2: 53 slots, 50 boot**. The refusals are `{17,29}` (17 tapes), `{2,0}` (9) and `{20,4}` (13), with I1's three refusal texts. **M3: L2, L17, L20 refuse; L13, L16 boot.** I1 reproduced exactly |
| bounded vitest BEFORE | 31 files: `levelWorld`, `activators`, `levelRun`, `tapeRunner`, every `PERSISTENCE_RESPONSE`/`REFUSED_CLEAR_RESPONSES`/`checkPersistence` reader (15 files), `director`, `solverBot`, the 7 `jsRuntime*` (read-only), `boxLock`, `lintGateLabels`, the surface and constants tests | **31 files / 1,618 tests, all green.** `jsRuntimeDeclarations:152`, which F1c banked as red, is green at this base |

⚠ **A W0 mistake, caught and redone.** I first started the identity block on *this* tree, and then edited `levelWorld.js` while it was running, so its later rows would have measured a moving tree. I killed it by its listed PIDs and re-ran the whole BEFORE in a pristine worktree (`scripts/dev/new-worktree.sh f6-base 696ca02`). That needed `git config extensions.worktreeConfig true`, and the two `file://` submodule clones needed `-c protocol.file.allow=always`. The BEFORE values above are the worktree's.

## D1 — I01: a game-written out-of-band clear is INERT at build (PASS)

**The game.** L18's two spinners carry `tag="-1"`. `Spinner.removed()` writes `Game.setPersistence(-1, false)`, and `Main.levelPersistenceSet` indexes `18*30 − 1` with no bounds check, which is `{17,29}`. Nothing in L17 reads slot 29, so the game builds L17 unchanged. The witness control below measured that directly.

**The model, before.** The run already treats the write as a ledger entry, never a permission (`levelRun.js:~14945`, read-only here). But a successor tape's `persistence` is read out of the game's latch, and `buildLevelWorld` refused `{17,29}` as *"a clear … which no entity in this level reads"*.

**The transcription** (`b0ab42c`):
- **Provenance is checked, and the check is not loosened.** An orphan clear is accepted only when a map-placed writer in the **next** level lands on exactly that slot: `outOfBandWritersOnto(level, nextLevelRecord)`.
- A writer qualifies when all of these hold:
  - its type is in `OUT_OF_BAND_WRITER_CLASSES`, which maps entity type to registry member (spinner, the two breakable rocks, burnabletree, rope, and lock/wandlock/grasslock/shieldlock/shieldlocknorm, all `Lock`, by inheritance with the AS3 cited);
  - its `tag` attribute is **explicit** and negative;
  - `outOfBandFlagForWriter` puts its write on that slot.
- **Why the tag must be explicit:** `Game.as:2333`'s `o.@tag` on a missing attribute is `int("")` = 0, an in-band write, while `tagOf` defaults to −1.
- The accepted slot is reported in `world.outOfBandClears` (`[{tag, writers}]`), so a caller can say which state it built.
- `levelRun.worldFor` passes `levelSource(n + 1)` only when slot 29 is cleared.
- In the vanilla extract the explicit −1 writers are L18's two spinners (`{17,29}`) and L92's spinner and two rocks (`{91,29}`).
- **Still refused, with unchanged text:** `{71,29}` (no writer in L72), `{17,28}` (the wrong slot), and any clear built without a neighbour. `levelWorld.test.js:326`'s pin still reads the old refusal.
- **Not covered:** the runtime spawns `Fire` (BobBoss in L32, landing on `{31,29}`) and `DarkSword` (the Witch in L12, landing on `{11,29}`). Neither has a map-placed writer, so they stay refused (residue 1).

**The witness.** `f6-l17-reentry` boots L17 at the L16 arrival in the chain-end state and walks right, up and left among the room's three bobs (60 t). It was recorded on the headless game, and the model reproduces all **61** observations. Re-played against the committed oracle, the live game matches.

**CONTROL-L17** (`probe-seedling-f6-reentry.mjs`) runs the same tape with `{17,29}` removed. **The game's stream is identical to the witness** (worst 0 px over 61 rows) and to the model's. The slot is inert on the game.

**Mutant m1** (`writers = []`): predicted the old refusal on the D1 rows. Measured **4/23 red**, every one *"the tape clears tag(s) 29, which no entity in this level reads"*. Restored md5-identical.

## D2 — I02: the MoonrockPile APPEARS when `{2,0}` is set (PASS)

**What writes `{2,0}`** (I1's undecided item 3, now measured):
- It is **L0's set moonrock**. `Moonrock.update`'s set arm finds the stairs under the rock, replaces them with a teleporter to `moonrock_target` (L2, 48,32), and calls `Game.setPersistence(0, false, 2)` (`Moonrock.as:131-136`).
- In window 23 (`r9-solve-0-v3`) the model's `moonrock.events` show: beam on t0, frozen on t1, `stairs-replaced` with `{2,0}` on **t2**, after the beam's and the fall's **451 dead frames**.
- **The game agrees** (`MOONROCK-BEFORE`/`-TAKE`, hold tapes cut from the window): `{2,0}` is **absent after 1 tick and present after 2**.

**The model, before.** `REFUSED_CLEAR_RESPONSES.appear` refused the clear at build.

**The transcription** (`e0dd845`):
- `appear` is no longer refused. A cleared tag falls through to the ordinary build, which is the class row's **32×16 Solid at (40,16)** (`ENTITY_CLASSES.moonrockpile`, sprite-sized).
- `persistenceClearsFor` neither offers nor refuses the slot, because the clear removes nothing.

**What it means for the route.** The pile **covers `stairsup@48,16`, L2's only stairs to L0**. The set rock already covers L0's stairs to L2 (the stairs it replaces sit under its Solid). So after window 23, L0↔L2 by those stairs is **closed in both directions in the game itself**.

**The witness.** `f6-l2-reentry` boots L3 under `teleporter@64,0`, holds `up`, enters L2 on t20 at (48,80), and stops against the pile's bottom face (the model's y 34.5 from t70). The model reproduces all **121** observations, and the live game matches the oracle.

**CONTROL-L2** runs the same keys without `{2,0}`. **The game leaves L2 for L0** by the stairs the pile covers, ending in L0 at (264, 191.1), and the model's control stream equals the game's at 0 px.

**The solver's L2 arrivals from the chain-end staging:**
- **L2→L3 solves** (4 t).
- **L2→L0 declines by a new, true name:** *"no corridor … Obstacle: solid:moonrockpile (moonrockpile@40,16) … A\* goal tile (3,1) … is not walkable: solid moonrockpile at (40,16)"*.

**Mutant m2** (re-add `appear`): predicted the old refusal on the D2 rows. Measured **4/23 red**, every one *"response "appear", and it exists ONLY while its flag is false"*. Restored md5-identical.

## D3 — I03: a pressed ButtonRoom boots its group FADING (PASS)

**The game, read first.**
- `ButtonRoom.check()` is `_active = !Game.checkPersistence(tag); activate = _active;` (`Puzzlements/ButtonRoom.as:40-50`). `Game.update`'s first frame runs `check()` on every entity before any `update()`.
- So a cleared tag runs the press setter at build:
  - `room == -1`, `flip = 0`: every `Activators` sharing `t` gets `activate = true`. That is a latch, since the setter's body is `if (a)`.
  - `room >= 0`: re-writes `{room, t}`.
  - Either way, it re-writes its own tag.
- `Lock.check()` does not remove a `tSet >= 0` lock, so L20's `lock@32,80` (`tset 0`, `tag 1`) is built **Solid and latched**, and fades from its first update.

**Measured on the game.** `f6-l20-reentry` boots L13 under `stairsdown@96,32`, enters L20 on **t7** at (32,48), and holds `down` into the pocket closed by `lock@32,80`:
- The player stands against the lock and **first moves through it on t108**, which is the arrival t7 + `opensOnTick(0.01)` = 101.
- It then goes right along row 6 and up into the room (row 7 is water, and the Conch is not held at chain-end). 241 t.
- **CONTROL-L20** (the same keys without `{20,4}`): **the lock never opens.** The walk ends shut in the pocket at (46.0, 50.7), and the model's control equals the game's at 0 px.

**What the brief asked: "is it only a fade?"** For L20, yes. Group 0's only responder is `lock@32,80`, and its first update is in the arrival frame. The `check()` writes are re-writes of `{20,4}` and `{20,1}`, which are already cleared. The latch for the whole run, the re-latch at build, and the absence of any new flag are all consistent with the game's latch: the differential's persistence rows pass.

**The transcription** (`1df6722`):
- `levelWorld`: `press` is no longer refused, and the presser row carries `bootPressed`.
- `activators.createActivatorState` → `bootPress`:
  - it latches a `room = -1` local publish;
  - it marks the presser written, so the run's first press this visit emits no second `roomwrite` (every write `check()` makes is a re-write);
  - it **refuses by name** a cross-room `flip = 0` button that boots pressed, because that would write TRUE over another level's slot, which this model does not carry. **None exists in the extract:** all four cross-room ButtonRooms (L38→39, L38→37, L61→63, L63→62) are `flip = 1`.
  - ⚠ **It credits the latched fade rows ONE update.** The first recording was *"THE RECORDING IS VALID AND THE MODEL IS REFUTED"*: the game moved on t108 and the model on t109. The game's first update of a new world is in the frame that records the arrival. The model's first `stepActivators` for that world is one tick later, because on a transition tick `levelRun` still steps the level being left, and a boot has no movement tick 0. With the credit, the model reproduces all 241 observations.
- `solverBot`:
  - From the L13 arrival, `hold`'s walk to `buttonroom@192,16` needed a corridor through the very lock it was meant to open. That re-raised `hold` four times with no tick spent, ending in *"applied 4 strategies … not making progress"*.
  - Now a fade responder whose group the live run reports **latched** resolves to a wait where the player stands (`latchedFadeWait`, bound `opensOnTick + HOLD_SLACK`, stopping when the responder is open; `execHold`'s latched arm).
  - From the chain-end L20 arrival the solver now **crosses to L19 in 289 t with 0 hits**. Its trace row names the rejected option, `presser`.
  - No signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved.

**Responder kinds in the 11 tagged ButtonRooms, and what the L20 witness covers:**

| kind | rooms | covered by `f6-l20-reentry`? |
|---|---|---|
| `lock` (Lock fade 0.01) | L20 | **yes**, witnessed |
| `wandlock` (Lock subclass, same `activationStep`) | L40 {1,7,12} | by class (same fade), not driven |
| `cover` (fade 0.1) | L38 {0} | the credit is applied; **unwitnessed** |
| `pulser` | L38 {3}, L107 {1} | latched; **the one-update credit is NOT applied** (residue 2); **unwitnessed** |
| cross-room re-write, `flip = 1` (wandlock L39, fallrock L37, lightpole L63/L62) | L38 {4,5}, L61 {1}, L63 {0} | the room itself is unchanged; the re-write is idempotent; **unwitnessed** |
| cross-room `flip = 0` | none | refused by name |

**Mutant m3** (re-add `press`): predicted the old refusal on the D3 rows. Measured **4/23 red**, every one *"response "press", and a cleared tag boots it ALREADY PRESSED"*. Restored md5-identical.

**Non-vacuity mutants:**

| mutant | predicted | measured |
|---|---|---|
| m4: no one-step credit | the replay runs one tick late | **2/23 red**: the replay differs (t108 vs t109) and the alpha row |
| m5: `latchedFadeWait` off | the solver row goes red | **1/23 red**: *"applied 4 strategies"* |
| m6: no `bootPress` at all | the model desyncs from the game silently | **4/23 red**: replay, solver, latch row, flip-0 row |

All restored md5-identical.

## D4 — the either-state proof (PASS)

**I1's M2/M3, re-run at the head:**

| | before (`696ca02`) | after |
|---|---|---|
| M2: committed persistence slots that build | 50 / 53 | **53 / 53** |
| M3: chain-end staging boots L2 | refuses (`appear`) | **boots** |
| … L13 | boots | boots |
| … L16 | boots | boots |
| … L17 | refuses (orphan 29) | **boots** (`outOfBandClears` names L18's two spinners) |
| … L20 | refuses (`press`) | **boots** (group 0 latched, the lock one step in) |

**Solver rows from the chain-end staging** (`r9-solve-32`'s declarations at the room's natural arrival):

| room | arrival → goal | result |
|---|---|---|
| L17 | L16 arrival (48,48) → the Seal chest (`location` tag 0) | **solves**, 117 t, 0 hits |
| L2 | L3 arrival (48,80) → L3 | **solves**, 4 t |
| L2 | L3 arrival → L0 (`stairsup@48,16`) | **declines, new and true:** `solid:moonrockpile` covers the goal tile. The game's stairs are under the pile |
| L20 | L13 arrival (32,48) → L19 (`stairsdown@192,48`) | **solves**, 289 t, 0 hits, through the latched wait |

The M2/M3 and solver rows ran in scratch. The L2, L20 and boot rows are pinned in `fidelityF6.test.js`.

**Refusal words grepped** (`rg -a`) across the test tree, scripts and fixtures:
- *"which no entity in this level reads"*: still emitted; pinned at `levelWorld.test.js:326`, which stays green.
- The `appear` and `press` texts are pinned by no test. They survive only in `fixtures/r2-route.json`'s historical `persistence_refused` list (L20 {4}, L61 {1}). That fixture is already stale (it says `darktrap` has no response) and `r2Walk.test.js` checks only that the list is non-empty. Left as is; see residue 4.

## The JS arc's pins at my head

**None move.** All 7 `jsRuntime*` test files (`ArrivalOnDoor`, `Atlas`, `Core`, `Declarations`, `SolveService`, `Solver`, `Verbs`, `Walker`) are green before and after. No JS-arc file was edited. `wasmArrival.arrivalSolverGoal` was imported, not changed.

## Deltas

| Row | W0 (`696ca02`) | head | movers |
|---|---|---|---|
| identity log | `10b9365d…` | **`10b9365dd3ceee81999bd215a28389d1`, byte-identical** | **none**: `diff` of the two logs is empty |
| six `--check`s | `410f27c0 7cba9530 cef8048e 48d52d83 6cd35fe1 9168796b`, all exit 0 | **identical**, all exit 0 | none: no committed walk or generated certification reads a slot-29 orphan, a cleared MoonrockPile, a booted-pressed ButtonRoom or a latched-group frontier lock |
| tapeRunner | 457 | **463**; the 457 old (name, status) pairs are identical | +6: the three witnesses' differential and stepping rows |
| roster | 200 | **203** | `f6-l17-reentry`, `f6-l2-reentry`, `f6-l20-reentry` |
| solver surface | GREEN 192 | **GREEN 192** (`--write` → `--check`) | site counts only (the latched wait); no new member |
| constants | PASS 4,947 | **PASS 4,959** (`--profile-rows` → `--write` → `--check`) | +3 `rule,sentinel` (`outOfBandWritersOnto`) and +9 structural. The ButtonRoom `room` default row is RETIRED at `h727f4e4a` and re-anchored at `h227be15a`, same class, because the presser statement gained `bootPressed` |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED | instruments 327 → **329** (the planner and the probe); the docs index (the log entry) |
| bounded vitest | 31 files / 1,618, all green | **67 files / 3,175: 3,174 green, 1 red** | the 1 red is `rosterCategories:175`, the composite bank row. **It is red at base too** (`expected 136 to be 140`, measured in the worktree) and reads 143 at head (+3 `mechanic` tapes) |
| `lintGateLabels`, `boxLock` | green | **green** | the probe joins `boxLock.test`'s `guarded` list (static `playwright` import, take behind `isEntryPoint`) |

**Pins** (unions, added, not rewritten):
- `R8_ENEMY_BRIDGE.exposedAdded` + `f6-l17-reentry` (L17's three bobs wake; no hit, no kill). Its two test mirrors (the measured list, exposed 43 → 44) and the synthetic bridged-level set (+L17) were updated with it.
- `tapeEnvelope`, `observationTolerance` (including `swapped`) and `dialogueAutoAdvance` go 200 → 203, with the three names in the comments (`dialogueAutoAdvance`: 202 inert).

## What the brief got wrong (measured)

1. **"A GAME re-entry tape into L2 from L0 with `{2,0}` set."** Not possible in the game's own state. The set moonrock covers L0's stairs to L2, and the pile covers L2's stairs to L0. The witness enters L2 from L3, the only other door. The from-L0 arrival exists only with the rock *unset* and `{2,0}` set, which the game never produces.
2. **"Is it only a fade?"** It is a fade, but **it starts one update before the model's first activator step**, because the arrival frame runs the new world's first update. Read as "a fade from frame one" in the model's tick numbering, the brief's spelling gives t109; the game is t108.
3. **"The solver must then plan L20 from the pressed state."** The model fix alone did not reach that. The solver's `hold` walked to the presser through the lock it was meant to open. A small `solverBot` arm (the latched wait) was needed. It sits inside the shared file and changes no listed signature or contract.
4. **"`levelWorld.js:~3144-3150` … `~4282-4286`."** At this base the table is at `:3144` and the throw at `:4282`, as I1 said. `REFUSED_CLEAR_RESPONSES` now holds only `arm`.
5. **"`jsRuntime*` red rows"** (implicit in F1c's bank): `jsRuntimeDeclarations:152` is **green** at `696ca02`. The F1 joint re-aim fixed it.
6. **The "M2" first-tape names.** I1 named windows (`r9-solve-19`, `-0-v3`, `-12`). Sorted by name, `{17,29}`'s first holder is `r8-d2-19`. That is the same set of tapes (17), named another way.

## Residue

1. **The runtime-spawned out-of-band writers.** `Fire` (BobBoss, L32 → `{31,29}`) and `DarkSword` (the Witch, L12 → `{11,29}`) have no map-placed provenance, so their landing still refuses at build. `{31,29}` will be in the latch the moment the chain's next window follows the Fire.
2. **A latched `Pulser` or `ArrowTrap` starts one update late** in the model, the same arrival-frame offset the lock credit fixes. L38 {3} and L107 {1} are pulser rooms, and neither is witnessed. The general fix is to step the NEW level's activators on the transition tick in `levelRun`. That moves every arrival and was not licensed.
3. **Covers, wandlocks and the four cross-room re-writes are unwitnessed** (the D3 table). L38 and L40 are the next frontier; a re-entry witness there would close them.
4. `fixtures/r2-route.json` carries the old `press` refusal text (L20 {4}, L61 {1}) and an older stale row (`darktrap`). It is historical and unpinned, so it was not regenerated.
5. The probe's controls are `vsModel`, `last` and `vsWitness` readings, committed as `fixtures/f6-reentry-oracle.json`. A `vsWitness` of `Infinity` (a level mismatch) serialises as `null`. The test reads `last.level` for that arm instead.

## Byte-inertia

- No committed tape, expectation or declaration moved. Only the three witnesses, their expectations and the oracle were added, plus `fixtures/witness-bases/r9-solve-32.f6.json`, byte-identical to `r9-solve-32` (md5 `366c284e…`).
- Not touched: `campaign-frontier.json`, AS3, wasm, gitlinks, biome defaults, F5's regions (`assertSpinnerRemovalIsDeclared`, `execKillByPress`, the SandTrap death, the chain/r8/d2 tapes), the JS arc's files, and `levelRun.js:~14945`. The only `levelRun` edit is `worldFor`'s neighbour and the `TAGS_PER_LEVEL` import.
- Not run: `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was copy → edit → run → copy back, md5-checked.
- Box: every game run (the differential `--record`, its re-play, the probe) ran with the box free. The BEFORE identity block ran in the worktree with no browser work alongside, and so did the AFTER here. `check-procgen-docs` took the lock for a few seconds while the BEFORE block was on its `c6` row, which takes no lock.
- Scratch (`/tmp/claude-0/f6/`, not committed): the M2/M3, room, solve, comparison and debug scripts; both identity logs; the vitest JSONs; the mutant runner and its outputs; the recording logs.

## The identity rows the coordinator must BANK

Unchanged from W0 and from F1c's AFTER. Bank as they stand:
- identity log md5 **`10b9365dd3ceee81999bd215a28389d1`** (the BEFORE in a pristine `696ca02` worktree and the AFTER at the head are byte-identical);
- the six `--check`s **`410f27c077b1ee854a14c24b73dc6335` `7cba9530f8faa10ebd13d3d396a11267` `cef8048e2f45e31160cb01457b014b6b` `48d52d8354c413d788932c8e86caac60` `6cd35fe1414af6bf5beb7605f235cb8e` `9168796be43f3288cf4b7bfa7ba87aec`**, all exit 0;
- reference ALL 7 + 5 MATCH;
- the movers to bank are counts, not digests: tapeRunner **463**, roster **203**, surface **GREEN 192**, constants **PASS 4,959**, instruments **329**, the M2 census **53/53**;
- `rosterCategories:175` stays the known bank row, now `136 vs 143`.
