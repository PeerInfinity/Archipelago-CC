# Seedling fidelity CANCROSS: the solver as an oracle for derived item requirements (cloud report)

**Slice:** `seedling-fidelity-cancross`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`).

⚖ **The user** (2026-10-04, on L14): *"… we shouldn't hardcode it. We should derive the requirements from what the
solver can do."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave2` @ **`47fb574643066ea32cc6d4f92cd8abc2b48dfe06`** (local branch `seedling-fidelity-cancross`) |
| Harness branch | **`claude/seedling-fidelity-cancross-vnqz1j`**. Every push went here; nothing was pushed to `main` |
| Commits | D1 `fca20c1` · D2 `84ce995` · D3 `2e17f3b` · D4 `784abdc` (log + reference) · this report (the head) |
| Evidence | the scratch branch `fidelity-scratch/planning-2-evidence`. Both captures were read from a scratch copy; nothing of it was committed |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (with a refutation found on the way) · D4 PASS** |

## The one thing to know first

**`canCross` defaults to `dashMode: 'none'`, because the game refuted a dash `can`.** On L16 → L17 with the Sword:
- The solver's default `all` plan is 111 t (PULL + one dash window; hash `5b1f924b52`, the SF report's live L16 plan).
  It certifies 0 hits in the model.
- **On the game the player is hit, and the stream parts at tick 104.** This happens from the door-built arrival AND
  from the captured live arrival, alike.
- The `none` plan (206 t) is reproduced by the game and is now the committed witness.

A `can` is a claim about the game, so the oracle asks the plan family the game agreed with. A rules-arc caller that
wants `all` must certify the witness.

**Second:** the solver's verdict is **not monotone in the inventory**. L16 → L18 is `can` with the Sword and `cannot`
with the Sword and the Conch: swimming widens the corridor onto a sandtrap, and the ladder exhausts. A minimal-set
derivation must report both claims, not infer one from the other.

## The API (D1)

`frontend/modules/seedlingDemo/seedlingCanCross.js`, node-only (it hashes sources and reads the atlas, like
`levelSource.js`).

```js
canCross({ level, exit | goal, inventory, arrival?, budget?, dashMode? })
  → { verdict, ms, why, cause, witness?, solver, arrival, budget, plan?, request }
```

- **`exit`** is a destination level (`15`) or a door `{x, y}` in `level`. It is mapped through
  `wasmArrival.arrivalSolverGoal`, the worker's own mapping. **`goal`** passes a solver goal directly, with an
  optional `to`.
- **`arrival`** takes one of three forms:
  - `{from}`: the link in level `from` whose `to` is this level, at its own `(playerx, playery)`. That is where
    `Teleporter.check` puts the game's player.
  - `{x, y}`: a stated spawn.
  - `{staging}`: a captured arrival. A stated `inventory` replaces its items.
- **A built arrival** takes every field the model reads as an explicit input: `persistence`, `save`, `rng`, `beam`,
  `rockSet`, `hitsMax`, `time`, `primary`, `cutscene`. Every field left at its default is listed in
  `arrival.assumed`.
  - `time` left undeclared is **omitted**. `parseTape` refuses `0`, and an omitted clock makes a spinner's hammer
    refuse by name, so nothing is billed at a guessed phase.
- **`budget`**: the default is `{consults: 5000}`, a deterministic counter of SF's `shouldStop` consults across every
  `DEADLINE_SITES` site.
  - `{ms}` is a wall clock, and the result marks it `deterministic: false`.
  - `null` passes no hook at all, so the solve is byte-identical to the committed one (unit row).
- **`witness`** (on `can`) is `{tape, replayed}`. `tape` is `buildStagedTape`'s body plus a `description` of the
  request. `replayed` is the model's `runTape` of it: observations, landing level, and agreement.
- **`solver`** is `{id, files, roots}`: an md5 over (path, md5) of the static and literal-dynamic import closure of
  `solverBot.js`, `tapeRunner.js` and `seedlingCanCross.js`, plus the atlas. That is 91 files.

**The verdict classes and how each is read:**

| verdict | from | basis |
|---|---|---|
| `can` | `solveSegment` returned, `run.transitions` ends on `to`, no death | field |
| `cannot` | a `SolverRefusal` with none of the arms below | field (class) |
| `undecided` · budget | `e.deadline` (SF2's wrapper) | **field** |
| `undecided` · pending | `PendingDeclaration` (`e.pending`) | field |
| `undecided` · bound | `SolverBotError` with `code === STRIKE_BOUND_EXHAUSTED` | field |
| `undecided` · bound | the block-route search: *"… hit \`MAX_ROUTE_EXPANSIONS\` / \`MAX_ROUTE_ORDERS\`"* | ⚠ **prose** |
| `undecided` · bound | the DETOUR rung: *"… N candidate(s) left unasked"* (the loop ended on `maxPreviews`/`maxPlanned`, not on an empty open set) | ⚠ **prose** |
| `undecided` · solver-error | any other `SolverBotError` | field |
| `undecided` · goal-not-observed | solved, but a death or the wrong landing level | field |
| `undecided` · unsupported | the arrival stands latched on the exit (a step-off composite) | field |
| `model-refused` | any other throw (the model's own error classes, plain `Error`s) | field (class) |
| *(rethrown)* | `TypeError`/`ReferenceError`/`RangeError`/`SyntaxError`/…, `CanCrossError` | a defect or a bad request, never a verdict |

**The two prose gaps, named:**
- `deriveBlockRoute`'s bound reaches the caller only inside a `SolverRefusal` message. The refused object's `bound`
  field does not survive the throw at `solverBot.js:2345` / `:4964`.
- `deriveChaserDetour`'s failure row is written with `rowFor('detour', killRefused)`, so its `previews`/`planned`
  never reach the refusal. Only the `why` sentence does.

Both are matched on the solver's own fixed words. Each has a mutant row: break the matcher, and only that row reds.
A field on each would close the gap. That is a solver edit, so it is not this slice's.

⚠ The refusal's `considered` list pairs each rung with the reason of the rung **below** it (the escalation shape).
The DETOUR rung's own words are therefore the LAST `detour` row. The classifier reads every `detour` row instead of
trusting the label.

**The CLI** is `scripts/procgen/can-cross-seedling.mjs`. It takes:
- `--level --exit --from|--spawn --inventory --primary --time --persistence --dash`;
- `--budget|--budget-ms|--no-budget`;
- `--json --witness=<path> --name=<tape> --derive=a,b,c`.

It exits 0 on any verdict and 2 on a bad request. `check-procgen-help --only=can-cross-seedling.mjs`: **PASS** (HELP
64 ms · IMPORT 52 ms). Every flag is derived by the instruments index. **No box lock**: it plays nothing and drives
no browser, so it does not join `boxLock.test`'s list.

**Unit rows** (`seedlingCanCross.test.js`, 14 rows, all green). Each verdict has one real case:
- **`can`**: swordless L14 from the captured arrival. 173 t by DETOUR, and the witness's per-tick keys are the
  committed `l14-swordless-detour`'s.
- **`cannot`**: L22 from L25 toward L29, bare. The ladder is EXHAUSTED on the static `wallflyer@128,80`. The danger
  is not chaser-only, so there is no DETOUR.
- **`undecided`**, two cases:
  - budget 0 → `deadline.first === 'detour'`, 1 consult;
  - the DETOUR rung's real bound words, from `deriveChaserDetour` with `maxPreviews: 5`.
- **`model-refused`**: the Ghost Sword on L14.

Further rows cover the builder's door and `assumed` list, fresh = captured on L14, determinism (twice, and with no
hook), the wall-clock flag, the stamp, D2's L16 derivation, and D3's witness byte for byte.

**Mutants** (each predicted, made by copy + restore, restored md5-identical):

| mutant | predicted | measured |
|---|---|---|
| `e.deadline` arm off | the budget row → `cannot`, 1 red | **1 red / 12** (restored `75912a88…`) |
| DETOUR matcher broken (`left UNASKED`) | the prose-bound row only | **1 red / 12** |
| `CAN_CROSS_DASH_MODE = 'all'` | the D3 witness row only (111 t ≠ the committed 206 t) | **1 red / 14** (restored `276feda2…`) |

## W0 (at `47fb574`, primary tree, `SEEDLING_PORT=9260`, the new files moved aside)

| row | command | result |
|---|---|---|
| identity block | `bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`aa46950b5958b32136111155250dd253`**, which is the banked value |
| six `--check`s | the block's producer loop | `405d9c4bb37a0ab00fb0ef9a99194783` · `8e7a43be0509882d753f54155ef284c2` · `33d20889ebd8c72452ce7262bce9505b` · `35456fbc07e7151ddbc4c2a1fd00c789` · `6cd35fe1414af6bf5beb7605f235cb8e` · `b29b589b26e6ad996c2a328d16b52c90`, **all exit 0** |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / profile / entities | `--check` each | **GREEN 195** · **PASS 4,966** · **PASS 138** (both JSONs) · **PASS 518**; surface json md5 `9fed4227…` |
| roster | `fixtures/tapes/index.json` | **209** |
| bounded vitest BEFORE | `solverBot`, `solverBotLethalPit`, `solverDeadline`, `fidelityL14`, `tapeRunner`, `decisionTrace`, `jsRuntimeDeclarations` (read-only), `lintGateLabels`, `boxLock`, `seedlingSolverSurface`, `seedlingConstantsCensus` | **11 files / 726 tests, all green** |
| tapeRunner | (fullName, status) pairs, sorted, `name\tstatus\n` | **475/475**, md5 `0b1de9a83c17b9d5dd43e36e3fc02658` |

## D2: the L14 table, fresh vs live, and a derivation (PASS)

**The L14 table through `canCross`.** "Fresh" is the door from L13 (built, nothing captured). "Captured" is
`capture-vm-old` read 4. Every row is identical between the two:

| inventory | `none` | `all` | L14 report (D3) |
|---|---|---|---|
| ∅ | can 173 t `9c766683ef` DETOUR (492 consults) | same | SOLVES 173 t ✔ |
| Sword | can 145 t `7f0165df18` AVOID (0) | can 118 t `36cd4f6200` (93) | 145 / 118 ✔ (same hashes) |
| Spear / Wand / Dark Sword | can 173 t `9c766683ef` DETOUR | same | SOLVES 173 t ✔ |
| **Fire Wand** | **can 173 t `9c766683ef` DETOUR** | same | ⛔ *model refusal*: **moved** (below) |
| Ghost Sword | **model-refused**: *"a ghostsword press routes the slash rect through `genericHit`'s Spear arm …"* | same | model refusal ✔ |

**The Fire Wand moved.** At the L14 report's head it threw reading `primaryWeapon` (the FIREWAND press arm). At this
base (`fidelity-harvest/wave2`, SF merged) the swordless run never presses X:
- SF3(b) reads the no-sword gate before `deriveKillByChaser`'s stance scan, and that scan is where the press was read.
- DETOUR then walks.

This mechanism is reasoned from SF3(b), not bisected. The Ghost Sword (slot 0 = item 4 under `set slashing`) is the
remaining model refusal, and it is the unit row.

**Fresh vs live, every captured arrival** (both captures, 23 reads, both dash modes). "Fresh" is `{from: <the previous
read's level>}` (the boot spawn for read 0), the captured items and `primary`/`hitsMax`, and nothing else: no
persistence, no time, rng seed 0.

| read | goal | kit | fresh arrival | `none`: captured = fresh | `all`: captured = fresh |
|---|---|---|---|---|---|
| main 0: L0 (16,128) | `level_0__r8c0 -> level_13` | [] | boot spawn | can 119t 26c8fe62f0 ✔ | can 119t 26c8fe62f0 ✔ |
| main 1: L2 (48,32) | `level_2 -> level_3__r0c4` | [] | door from L0 | can 47t a3d960f7e7 ✔ | can 47t a3d960f7e7 ✔ |
| main 2: L3 (64,16) | `level_3__r0c4 -> level_4` | [] | door from L2 | can 245t f4619e98d4 ✔ | can 245t f4619e98d4 ✔ |
| main 3: L4 (16,16) | `level_4 -> level_5__r1c5` | [] | door from L3 | can 255t 61dd959f0f ✔ | can 255t 61dd959f0f ✔ |
| main 4: L5 (80,32) | `level_5__r1c5 -> level_6` | [] | door from L4 | can 403t 56b79cb759 ✔ | can 403t 56b79cb759 ✔ |
| main 5: L6 (32,16) | `level_6 -> level_7` | [] | door from L5 | can 294t 76d8fc4df4 [bait,avoid] ✔ | same ✔ |
| main 6: L7 (32,32) | `level_7 -> level_8` | [] | door from L6 | can 146t b07e547cf5 ✔ | same ✔ |
| main 7: L8 (144,48) | `level_8 -> level_9` | [] | door from L7 | can 827t f6f0eb2b4d [kill] ✔ | same ✔ |
| main 8: L9 (144,16) | `level_9 -> level_10` | [] | door from L8 | can 122t 9b6a1b8b03 ✔ | same ✔ |
| main 9 / 10: L10, L11 | Sword / Chest | | | skip (location goals → the walker) | |
| main 11: L3 (96,128) | `level_3__r0c4 -> level_2` | [sword] | door from L11 | can 226t b44e575c6f ✔ | can 152t 23b4ca25d1 ✔ |
| main 12: L2 (48,80) | `level_2 -> level_0__r8c0` | [sword] | door from L3 | can 47t 8313ecc54a ✔ | can 23t 69f5d32b59 ✔ |
| main 13: L0 (256,256) | `level_0__r8c0 -> level_13` | [sword] | door from L2 | can 237t d148c3937c ✔ | can 145t ef6743ba91 ✔ |
| main 14: L13 (64,128) | `level_13 -> level_14` | [sword] | door from L0 | can 74t 4b14594834 ✔ | can 36t a1ddebcd9e ✔ |
| main 15: L14 (160,64) | `level_14 -> level_15__r1c5` | [sword] | door from L13 | can 145t 7f0165df18 ✔ | can 118t 36cd4f6200 ✔ |
| main 16: L15 (48,64) | `level_15__r1c5 -> level_16` | [sword] | door from L14 | can 509t fa1d871849 ✔ | can 456t 5e43ff1369 ✔ |
| main 17: L16 (32,64) | `level_16 -> level_17` | [sword] | door from L15 | can 206t 0c36d853aa [pull] ✔ | can 111t 5b1f924b52 [pull] ✔ |
| vm-old 0: L0 (16,128) | `level_0__r8c0 -> level_86` | [] | boot spawn | can 314t db21299996 ✔ | same ✔ |
| vm-old 1: L86 | Chest | | | skip (location goal) | |
| vm-old 2: L0 (160,288) | `level_0__r8c0 -> level_13` | [] | door from L86 | can 305t 9cc39be278 ✔ | same ✔ |
| vm-old 3: L13 (64,128) | `level_13 -> level_14` | [] | door from L0 | can 74t 4b14594834 ✔ | same ✔ |
| vm-old 4: L14 (160,64) | `level_14 -> level_15__r1c5` | [] | door from L13 | can 173t 9c766683ef [detour] ✔ | same ✔ |

**40 / 40 comparable rows give the same verdict and the same plan hash.** Every door-built spawn equals the captured
spawn. Every captured hash also equals the SF report's table.
- The persistence each capture carried is for OTHER levels. A world is built per level, so no row's own level held a
  clear.
- `time` matters only to a spinner, and none of these rooms held one.
- `rng` matters only to the Owl.

**Where fresh and live DID differ: the JS boot, by one tick.** The l16-budget report found that a fresh JS boot
(`new Game(16,32,64)` + Sword) refuses L16 while the live arrival solves, and blamed rng, seam and persistence. Measured
here with its own `leg.mjs`, at this base:
- The JS boot still refuses: EXHAUSTED, `bob@48,96`, ~13.9 s.
- **Its staging handed to `canCross` solves**: 206 t `0c36d853aa`, the live plan.
- The difference is the **prefix**. `leg.mjs` solves after `rt.tick()`, one idle tick.
- The builder's own staging with a one-tick empty prefix **refuses** exactly like the JS boot.
- What changes on that tick: every bob's velocity goes from 0 to ±0.354 (they wake), and `state.terrain` goes from 0 to
  5. No box position moves.
- `time` (4800 / 4801 / 4830 / 8811 / undeclared) changes nothing.

⇒ `canCross` answers for the **arrival tick**, which is what the live worker does (`arrivalSolveRequest`: `perTick:
[]`, "the arrival IS the boot"). The builder needs no extra field for this. The caveat is in "For the rules arc".

**Derivation demo** (D2's ask; the questions, not rules). `deriveMinimalSets` and `--derive=` ask every subset:

| crossing | pool | result |
|---|---|---|
| L14 → L15 (door from L13), `none` and `all` | sword, spear, wand | all 8 subsets `can` → **minimal {∅}** ✔ (expected "none") |
| L16 → L17 (door from L15), `none` | sword, spear, wand | {sword}… `can` 206 t. ∅/{spear}/{wand}/{spear,wand} are **`undecided`**: DETOUR bound, 300 previews / **500 of 500 legs**, 850 unasked, ~10 s, 411 consults. ⇒ {sword} is minimal but **unproved** |
| L16 → L18 `stairsup@352,80` (door from L15), `none` | sword, conch | ∅/{conch} `undecided` (real `MAX_ROUTE_ORDERS`); {sword} `can` 878 t; **{sword, conch} `cannot`**: EXHAUSTED at `sandtrap@48,32` ⇒ **NON-MONOTONE** (unit row) |

The conch was bisected over sword + each of the eight other items. **Only the Conch flips it.** With the Shield it is
still `can` (891 t, a different plan).

**Default budget calibration.** Over 116 calls (every captured arrival × both modes, plus every door of L15/L16/L71
from every neighbour with nine items × both modes):
- the largest count is **1,807 consults**: L71 from L75 toward `teleporter@16,304`, nine items, `all`, a `cannot`
  after 16 s;
- swordless L14's DETOUR solve is 492.

The default of 5,000 is ~2.8× the largest.

## D3: a game witness of a `can` witness tape (PASS)

**The committed witness is `cancross-l16-sword-none`:**

```
node scripts/procgen/can-cross-seedling.mjs --level=16 --exit=17 --from=15 --inventory=sword \
  --name=cancross-l16-sword-none --witness=frontend/modules/seedlingDemo/fixtures/tapes/cancross-l16-sword-none.json
```

- **The arrival** is built from the atlas door. No capture is read; persistence, time, rng and the rest are assumed and
  listed. It is solved by PULL in 206 t, `0c36d853aa`, 0 hits. The tape is v8 (`buildStagedTape`).
- **The record run:** `SEEDLING_PORT=9260 check-seedling-bot-differential --record --only=cancross-l16-sword-none` on
  headless p4f gave **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 207 observations, 1 transition(s)"**. Also:
  game `hits` 0 = the model's, inventory slots `[0]`, `Main.primary` 0, every key edge seen, 40 fade frames.
- **A second, non-record replay:** **"live game matches the committed oracle stream"**, ALL CHECKS PASSED, exit 0.
- **Byte identity:** the unit row asserts that the committed tape IS `canCross`'s witness, byte for byte. The CLI at
  the default dash mode writes a `cmp`-identical file.

**Measured first and NOT committed: the solver's default `all` is refuted on the game.** Each tape below was recorded,
then removed with its expectation. Copies are in the scratchpad.

| tape | arrival | plan | game |
|---|---|---|---|
| `cancross-l16-sword` | door-built | `all`, 111 t, PULL + 1 dash, `5b1f924b52` | ⛔ `hits` 1 (model 0), `hits_timer` 12; **tick 104 differs**: expected (95.47, 47.07), got (98.57, 50.34); 0 transitions. *"THE RECORDING IS VALID AND THE MODEL IS REFUTED"* |
| `cancross-l16-sword-live` | captured, `capture-main` read 17 (rng 1778609821, time 8811, nine clears) | the same 111 t plan | ⛔ **the same tick-104 divergence, to the digit**. Plus two clock rows (game `save.time` 8943 vs model 8963, Δ −20 over 40 counted dead frames) |
| `cancross-l16-sword-none` | door-built | `none`, 206 t | ✔ reproduced (above) |

- The two `all` arrivals give the same game trajectory despite different rng, time and persistence. That is a
  game-level fresh = live check on this room.
- The refutation is the plan's, not the builder's: the `none` plan from the same arrival passes. The streams part at
  about (95, 47) / (98, 50), below the arrow-trap row (`arrowtrap@96/112/128,32`). The SF report puts the plan's one
  dash window on the final walk row. ⚠ What hit the player was not diagnosed.
- **⇒ `CAN_CROSS_DASH_MODE = 'none'`**, with this measurement in its docblock.

**Roster: 209 → 210, by name.** The three pins are `tapeEnvelope.test.js:74`, `observationTolerance.test.js:103/147`
and `dialogueAutoAdvance.test.js:153/154` (the new tape is inert: rows − parted 208 → 209). Each carries a
`⛓ fidelity CANCROSS: 210 — \`cancross-l16-sword-none\`` line.

## D4: records (PASS)

| row | command | result |
|---|---|---|
| identity block AFTER | the same command on the committed tree (`784abdc`) | log md5 **`aa46950b5958b32136111155250dd253`**, and `diff` against W0 is **empty**: every row, the six `--check`s and the reference row are byte-identical |
| tapeRunner | bounded vitest AFTER, the same pair digest | **477/477**. The 475 old pairs are **byte-identical** (`0b1de9a8…`), plus `fixture differential cancross-l16-sword-none` and `the incremental stepping face … cancross-l16-sword-none`, both passed. All 477: `5bdf547cd654e69b2cf239e1549ef0f5` |
| surface / constants | `--check`, then `--write`, then `--check` | **GREEN 195 / PASS 4,966**. Both `--write`s are no-ops (no file changed; the surface json is still `9fed4227…`). Profile 138, entities 518 |
| reference | `generate-procgen-reference.mjs`, then `--check` | the new CLI and module enter the instruments/docs index (343 files). **ALL 7 + 5 MATCH**. `check-procgen-docs` **ALL CHECKS PASSED** |
| bot log | `seedling-bot-log.md` | `### Seedling fidelity CANCROSS — the solver as an oracle`, after L14, with three trap candidates |
| bounded vitest AFTER | the W0 set + `seedlingCanCross`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `rosterCategories`, `fixtures/tiers`, `argvHelp`, and the first 20 `procgenDocs/*.test.js` | **26 files / 1,428 tests, 1,427 green**. The one red is `rosterCategories.test.js:175` (*"expected 146 to be 150"*), and it is **pre-existing**: identical with the base `index.json` restored (copy + restore), so my tape does not move it. It is the composite bank row (`standing-values --write`, forbidden here) |
| six `--check`s | in the identity block | identical to W0, all exit 0 |

## For the rules arc

```js
import { canCross, deriveMinimalSets } from 'frontend/modules/seedlingDemo/seedlingCanCross.js';
const r = canCross({ level: 14, exit: 15,            // or exit: {x, y} a door; or goal + to
    arrival: { from: 13 },                           // or {x, y}, or {staging} (a captured arrival)
    inventory: ['spear'],                            // tapeFormat.ITEM_PROPERTIES names
    budget: { consults: 5000 } });                   // default; {ms} = wall clock (non-deterministic); null = no hook
r.verdict;   // 'can' | 'cannot' | 'undecided' | 'model-refused'
r.cause;     // {kind, basis: 'field'|'prose', …}: WHY that class
r.witness;   // on 'can': {tape (committed format), replayed: {observations, landed, agrees}}
r.solver.id; // record it with the rule; a different id later = a STALE derivation
r.arrival.assumed; // the fields the built arrival defaulted. Record them with the rule
```

- **Verdicts.**
  - Only `cannot` says no.
  - `undecided` is never a no: a budget, a bound, a pending declaration, or a solver error.
  - `model-refused` means the model does not cover the state. Today that is the Ghost Sword's press.
- **The stamp** is an md5 over 91 files: the solve's import closure, `seedlingCanCross.js` and the atlas. Any edit to
  them moves it. That is deliberate: classification lives in `seedlingCanCross.js` too.
- **Fresh vs live caveats:**
  1. A built arrival answers for the **arrival tick** (the worker's convention). One idle tick wakes a room's bobs and
     can flip a verdict (L16 + Sword: `can` at tick 0, EXHAUSTED at tick 1).
  2. `persistence` defaults to "nothing cleared". A **revisit** must pass its clears.
  3. `time` defaults to undeclared. In a **spinner room**, pass it, or the model refuses by name.
  4. `rng` matters only at L112.
  5. Over the 40 captured rows, the default build agreed with the live arrival every time.
- **Derivation caveats:**
  - The solver is **not monotone**: the Conch on L16 → L18. Treat "can with S" as "can with every superset" only as a
    claim about the GAME, and say so.
  - A minimal set with an `undecided` subset below it is **unproved** (`unprovedBelow`).
  - A `can` from a dash plan can be refuted. The default is `none`. Certify witnesses (`--witness` →
    `check-seedling-bot-differential --record --only=…`) before a rule leans on an `all` plan.
- **Cost.** A failing chaser-only climb pays the DETOUR rung: ~10 s on L16 and 411 consults. Its verdict is
  `undecided` (bound), not `cannot`.

## Deltas

| row | W0 | head |
|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`**, byte-identical (empty `diff`) |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, exit 0 | identical, all exit 0 |
| tapeRunner | 475/475 `0b1de9a8…` | **477/477** (475 identical + 2 new) `5bdf547c…` |
| roster | 209 | **210** (`cancross-l16-sword-none`) |
| surface / constants / profile / entities | GREEN 195 / PASS 4,966 / 138 / 518 | unchanged |
| bounded vitest | 11 files / 726 green | 26 files / 1,428, 1 pre-existing red (`rosterCategories:175`) |
| instruments index | 342 | 343 (`can-cross-seedling.mjs`) |

**Files:**
- new: `seedlingCanCross.js`, `seedlingCanCross.test.js`, `can-cross-seedling.mjs`, the tape and its expectation;
- changed: `index.json`, three roster pins, the bot log, the regenerated reference (`README.md`, `architecture.md`,
  `docsIndex.js`, `instruments.js`).

**No solver, model, JS-arc, AS3, wasm, gitlink or rules file changed.**

## What the brief got wrong (measured)

1. **"A `model-refused` via the Fire Wand on L14."** At this base the Fire Wand **solves** L14: DETOUR, 173 t, fresh
   and captured, both modes. The L14 report's refusal was from before SF3(b). The real `model-refused` on L14 is the
   **Ghost Sword**.
2. **"A fresh JS boot is not always the live arrival … the difference was the rng/seam and persistence carried by the
   live run."** The difference is **one idle tick**. The JS boot's own staging solves L16 from tick 0, and the
   builder's staging refuses after one empty tick. rng, seam, persistence and time changed nothing on any of the 40
   rows.
3. **"`witness` is the plan as a committed-format tape body, so a certifier can replay it on the game."** True, and
   the first certification refuted the solver's default: the `all` plan on L16 is hit on the game. The witness format
   round-trips (`none`, PASS). A `can` built from a dash plan is a model claim.
4. **"Classify by the error's own fields where they exist."** For two of the brief's three named bounds, no field
   reaches the caller: `MAX_ROUTE_*` and the DETOUR bounds. Only `e.deadline` and `STRIKE_BOUND_EXHAUSTED` are fields.
   This is named above, with mutant rows on both prose arms.
5. **The L14 report's census said "25 reads".** The two captures hold **23** (18 + 5). Three are location goals the
   bot plans with the walker, so 20 reads × 2 modes = 40 rows.
6. **"Default budget = consults of `shouldStop`"** is deterministic, but it is not a full work measure. Rungs without
   a site (AVOID, TIME, BAIT, the walk drives) are bounded only by their own limits. The DETOUR failure on L16 spends
   411 consults and ~10 s, and no measured call exceeded 1,807.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **L16 → L17's `all` plan (`5b1f924b52`, 111 t) is refuted by the game.** The player is hit and the streams part at t104, below the arrow-trap row, from the door-built and the live arrival alike. This is the SF report's live L16 plan, so the JS worker's full pass would play it. The tapes and logs are in the scratchpad (`d3ev/`). Undiagnosed: the dash window's preview vs the game's arrow timing | fidelity / JS arc |
| 2 | **One idle tick flips L16** (`can` at tick 0 → EXHAUSTED at tick 1, the bobs waking). The solver's verdict is fragile at the arrival, and the JS fresh boot's `rt.tick()` pays it | fidelity (solver) |
| 3 | **Non-monotone in the inventory**: the Conch on L16 → L18 | fidelity (solver) |
| 4 | **Two prose-only bounds**: carry `bound` on the block-route `SolverRefusal`, and `previews/planned/bound` on the failed `detour` row. Then `canCross` reads fields only | fidelity (solver) |
| 5 | `PendingDeclaration` is classified `undecided`. `canCross` does not run `twoPassSolve` for a model-sourced declaration. No measured crossing hit it | rules arc / next slice |
| 6 | The step-off composite (an arrival latched on its exit) is `undecided · unsupported` | next slice |
| 7 | `rosterCategories:175` bank row (*"expected 146 to be 150"*), pre-existing, needs `standing-values --write` | coordinator |
| 8 | The new tape owes the full tier a CI drive (`check-seedling-full-tier-owed`) | CI |

## Byte-inertia

- No solver, model or JS-arc file changed, so no solve can move.
- tapeRunner's 475 old pairs are byte-identical.
- The surface and constants `--write`s are no-ops.
- The identity log is byte-identical before and after (`aa46950b…`, empty `diff`), including all six `--check` digests.
- No committed tape moved. `campaign-frontier.json` is untouched.
- No AS3, wasm, gitlink or rules edit. No `standing-values --write`, no `pytest`, no unfiltered vitest.

## Rows to BANK

- **Identity:** log **`aa46950b5958b32136111155250dd253`** (unmoved). Six `--check`s **`405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`**, all exit 0, unmoved.
- **tapeRunner 477/477**: all pairs `5bdf547cd654e69b2cf239e1549ef0f5`; the 475 old ones `0b1de9a83c17b9d5dd43e36e3fc02658`.
  **Roster 210.**
- **New fixtures:**
  - `cancross-l16-sword-none` tape `56302465dbb1890df19bd2fccd25193c`
  - its expectation `1bb3ab9718cdd001a3beb6d8e260b47b`
  - `fixtures/tapes/index.json` `c96bcc4c1ac040fa41d4bd1d0afafacc`
- **Surface** GREEN 195 (`9fed422742c8c739464091cb6b20e665`, unchanged) · **constants** PASS 4,966 · **profile** 138 ·
  **entities** 518.
- **New API:**
  - `canCross`, `deriveMinimalSets`, `buildArrivalStaging`, `doorArrival`, `classifyError`, `solverStamp`;
  - `CAN_CROSS_DASH_MODE = 'none'`, `DEFAULT_CONSULT_BUDGET = 5000`;
  - 14 unit rows.
- **The composite roster row** (`rosterCategories:175`) is owed one tape (210), on top of its pre-existing drift.
