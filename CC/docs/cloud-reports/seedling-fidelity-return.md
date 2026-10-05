# Seedling fidelity RETURN: L15 → L14 on the way back — a lock rebuilt closed, a button sealed behind it

**Slice:** `seedling-fidelity-return`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`, wave 4).

⚖ **The standard** (the user, 2026-10-03): *"… the solver to be able to handle either state … and to have a way to know
which state it's in. I don't want it to have to clear the save, and I don't want it to have to exit and reenter the room
in order to solve it."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave3` @ **`b116c69fe57f5ad807e710f5231a208002932407`**, as briefed |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | **`claude/seedling-fidelity-return-l15-l14-3rcmml`** (the harness pins it; `seedling-fidelity-return` was never created). Nothing was pushed to `main` |
| Commits | D1 `c96dc77` · D2 **`f1aac13`** · D3 `ce271c4` · records `c03fd2e` · this report |
| Dev servers | `serve-nocache.py 9280` (this tree), `9290` (the pristine BEFORE worktree `Archipelago-CC-wt-ret-base` @ `b116c69`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (as a true-name decline + the Conch witness; see "what the brief got wrong") · D3 PASS** |

## The one thing to know first

**With the Sword alone, `level_15 -> level_14` from the L16 return arrival does not exist in the game.** It is not a
model gap or a missing solver rung. The game rebuilds `lock@128,48` CLOSED on re-entry whatever its tag: it is tSet 0,
and `Lock.check()` only removes a `tSet < 0` lock. The arrival column (x 144..159) is shut by that lock to the west and
by Water to the south, and the button and the block that open the lock both lie past it. So the solver's `cannot` was
right; only its NAME was wrong. The refusal now says **SEALED BEHIND ITS OWN LOCK** and carries an optional `sealed`
field. **With the Conch the same arrival solves (222 t), and the game reproduces that plan** (`return-l15-conch`).
**L16 from L18 is the same shape** (D3), so the live walk's return leg will meet it again if it ever comes back that way.

**For the JS arc:** the live walk's L16 → L15 → L14 return needs the Conch, or another goal order. That is a routing
decision for the walk; the solver cannot make this crossing with the Sword.

## W0 (at `b116c69`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9290 bash scripts/procgen/identity-block.sh .` in a **pristine worktree** at `b116c69` (`scripts/dev/new-worktree.sh --with-wasm ret-base b116c69`; the submodules were finished by hand, see the note), venv active, its own server | exit 0, log md5 **`aa46950b5958b32136111155250dd253`**: the banked value |
| six `--check`s | the block's producer loop | `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, **all exit 0** |
| reference | the block's last row | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner | inside the bounded vitest; sorted `fullName\tstatus\n` | **477/477**, md5 **`5bdf547cd654e69b2cf239e1549ef0f5`** (= CANCROSS's banked value) |
| surface / constants / entities / profile | the four `--check`s, in the worktree | **GREEN 195** (json `9a7cdc1e…`) · **PASS 4,966** · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **210** (`c96bcc4c…`) |
| bounded vitest BEFORE | 26 files: `procgenNestedOpeners`, `procgenSeedlingElementsCertify`, `fidelityF6`, `fidelityF7`, `fidelityL14`, `solverBot`, `solverBotLethalPit`, `blockRoute`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeRunner`, `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `rosterCategories`, `tapeIndexManifest` | **1,322 tests: 1,320 green, 2 red, both pre-existing**: `rosterCategories:175` (*"expected 149 to be 150"*, the bank row) and `r8Acceptance` *"re-derives the exposed set"* (*"Undeclared and exposed: cancross-l16-sword-none"*) |
| the brief's reproduction | `can-cross-seedling.mjs --level=15 --exit=14 --from=16 --inventory=sword [--persistence=15:0,15:2,15:3]` | **`cannot`** in both arms, *"no REACHABLE stance inside button@112,32 … NO block in this room can reach it …"*, 4 consults, 18–22 ms |

⚠ **The worktree needed two hand steps.** `new-worktree.sh` first refused (`extensions.worktreeConfig` was off). I
enabled it locally, as the script says. On the second run every submodule clone from the local mirrors failed with
*"transport 'file' not allowed"*. I finished them with `git -c protocol.file.allow=always submodule update --init`,
`reset --hard` on three non-seedling submodules whose index was left empty, `npm ci`, the hook, and step 6 by hand.
`Launcher.py --update_settings` exited 1, and `update_host_settings.py full-spoilers` wrote `host.yaml`. The block
then ran clean.

## D1 — the game's state on the L16 → L15 return (PASS, game-witnessed)

**Read first (the AS3):**
- `Lock.check()` (`Puzzlements/Lock.as:39-46`): `if (tag >= 0 && tSet < 0 && !Game.checkPersistence(tag)) FP.world.remove(this)`. `lock@128,48` is **tSet 0**, so a cleared `{15,0}` does nothing at build. The constructor sets `type = "Solid"`: the lock is closed.
- `Lock.turnOff()` (`:90-98`) is what wrote `{15,0}` on the forward trip: the lock faded fully open while the block held the button. `returnToNormal()` writes it back only from inside the room, so leaving with the lock open leaves the tag cleared. **The clear records "it was open when the player left", not "it is open".**
- `PushableBlock` (`:23-33`) reads no persistence, so the block is rebuilt at (64,64). `Button.update()` (`:27-40`) publishes `activate = false` on group 0 every tick while nothing collides.
- The model already agrees: `levelWorld.clearedAwayByTag` maps `lock` to `lock-despawn` and requires `tSetOf < 0`.

**The room** (`Dungeon2_2`, 11×9; `w` = Water, `d`/`s` = floor tiles, `S` = Stone):

```
row1  S w w w S s s s S d S     stairsdown@144,16 at col 9
row2  S w w w S s s d S d S     button@112,32 = col 7 · arrival (144,32) = col 9
row3  S s s s S S s s d d S     lock@128,48 = col 8
row4  S s s s s s s S w w S     pushableblock@64,64 = col 4 · stairsup@32,64 (→ L14) = col 2
row5  S s s s S s s w w w S     breakablerock@96,80 = col 6 (tag 2)
row6  S w w w w w w w d d S     chest@144,96 = col 9
row7  S w w w w s s s d d S
```

From the arrival, the column at x 144..159 (rows 1–3) leaves only by `stairsdown@144,16` (back to L16), by the lock at
col 8, or into the water at row 4. `Player.as:1456`: water without `canSwim` drowns, and the drown puts the player back.

**The game tapes** (authored by `scripts/procgen/plan-seedling-return-l15.mjs` from F6's frozen chain-end base
`fixtures/witness-bases/r9-solve-32.f6.json`, which carries exactly `{15,0}` `{15,2}` `{15,3}` and Sword + Shield, no
Conch; recorded with `SEEDLING_PORT=9280 check-seedling-bot-differential --record --only=<tape>`, headless p4f):

| tape | walk | game | model |
|---|---|---|---|
| `return-l15-reentry` | boots L15 at (144,32) with the clears; down 12 t, left 48 t into the lock | 61 obs, 0 transitions, `hits` 0; ends (146.52, 58.94) | *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*, ALL CHECKS PASSED |
| `return-l15-reentry-unclear` | the same WITHOUT the three L15 clears | the **same stream**: the expectation file is **md5-identical** (`db4c5aea…`) | reproduces, ALL CHECKS PASSED |
| `return-l15-walkin` | boots L16 at (32,64), steps onto `stairsup@16,64`, then down and left into the lock | 61 obs, 1 transition (L16 → L15 on **t7**); min x in L15 146.05 | reproduces, ALL CHECKS PASSED |

⇒ **The lock is CLOSED on the return in both states, and the model builds it so.** This is not F6/F7's family (a model
build gap). In the brief's terms it is the SOLVER branch, but no solver rung can redeem it either (D2).

⚠ **Measured first and not committed:** the first cut of the re-entry tape also walked down into the water. The game
drowned the player back to the arrival (drown timer 6, ≈5 contact ticks), and the model reproduced the whole stream,
the respawn included. The harness then failed the run, correctly: a drowning tape must be declared in
`r5Swim.DROWN_EXPECTED`. The water arm is already the game's own witness in `r5-swim-drown`, so the leg was cut rather
than the declaration widened. The logs are in the scratchpad.

## D2 — the fix: a true name, and the Conch witness (PASS)

**What the solver did.** `deriveHoldStance` found the one stance cell inside `button@112,32` unreachable. It then
raised the prerequisites and refused:

> … `lock@128,48` — its group t=0 publishes only while a Solid sits on button@112,32, and **NO block in this room can
> reach it** …

Guard (iii) asks that question through `deriveWeigh` **from the walker's position**. The forward trip is a block that
DID reach that button: the forward crossing `level_15 -> level_16` still solves by shove and weigh. So the refusal reads
as a false fact about the room.

**The change** (`solverBot.js`, `f1aac13`; region: the stance/press/button rungs):
- **`sealedBehindWall(run, presser, candidates, exempt, walls)`**, asked only on `deriveHoldStance`'s throw path. For
  each guard-(iii) wall, it discharges that one wall the way `stanceReaches` discharges a hypothesis: the activator is
  opened in the bag, and its `proximity-hazard` volume is exempted. It then asks `corridorPlans` for each stance
  candidate, in the caller's own order. The first that plans names the seal.
- **`sealedRefusalClause`** appends: *"⛔ SEALED BEHIND ITS OWN LOCK: with lock@128,48 discharged a corridor from
  (152,40) reaches the stance (120,40); with it shut none does. So button@112,32 lies on the far side of the very lock it
  opens (group t=0) …"*. The existing message is unchanged up to the appended clause, so every substring pin still
  matches.
- **An OPTIONAL instance field on the thrown `SolverRefusal`: `sealed = {wall, presser, ownOpener, group, from,
  stance}`.** It is set after construction, so the constructor's field list (ROBUST's region) is untouched. It is
  absent unless a seal is found. `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`: no
  signature or contract moved.
- **Cost:** zero on any solve. The probe runs only when the derivation is already throwing (walls × candidates
  `planWaypoints` calls; 18–34 ms for the whole L15 call).

**Either state** (`can-cross-seedling.mjs --level=15 --exit=14 --from=16 --inventory=sword [--persistence=15:0,15:2,15:3]`):

| state | before | after |
|---|---|---|
| with the forward clears | `cannot` · *"no REACHABLE stance … NO block in this room can reach it"* | `cannot` · the same, **+ SEALED BEHIND ITS OWN LOCK**, `sealed.wall = lock@128,48` |
| without them | the same | the same as with them |
| Sword + Conch, with the clears | `can` 222 t `f6a42f0549` | unchanged (`can` 222 t) |

**The game witness of the solving arm.** `canCross … --inventory=sword,conch --persistence=15:0,15:2,15:3
--name=return-l15-conch --witness=…` writes `return-l15-conch` (v8, 222 t). The record run: *"THE MODEL REPRODUCES THE
RECORDING IT JUST MADE — 223 observations, 1 transition(s)"*, game `hits` 0, ALL CHECKS PASSED. A unit row pins
canCross's witness byte for byte against the committed tape.

**`fidelityReturn.test.js`** (14 rows):
- D1: the base carries the clears and no Conch; the model's build in both states; the game's two streams are one; the walk-in's t7 arrival.
- D2: the refusal (message and `sealed`) in both states; the Conch solves through `solveSegment`; canCross `cannot` × 2 and `can` with the byte-identical witness; the game's Conch recording; the forward control `level_15 -> level_16` still `can`.
- D3: three survey re-entries, and the L16-from-L18 seal.

**Mutants** (each predicted first; made by copy, run, copied back; `solverBot.js` restored md5-identical `6a91ffb6…`):

| mutant | predicted | measured |
|---|---|---|
| **m1** `sealedBehindWall` returns `null` at once | the two seal rows and the canCross row: 3 red | **3 / 10 red**, exactly those |
| **m2** `ownOpener` inverted (`!==`) | the same 3 (the clause says "A WALL", `ownOpener: false`) | **3 / 10 red**, exactly those |

## D3 — the census of re-entered rooms (PASS, model only)

From the route survey's order (`survey-seedling-route.mjs --derive-only`, 21 steps), plus the live walk's return leg
(L17 → L16 → L15 → L14 → L13 → L0). The forward clears come from `capture-main` read 17 and the chain-end base:

| room | re-entered by | clears carried | lock / presser in the room | re-entry build |
|---|---|---|---|---|
| L0 | survey step 14 | `{0,1}` | none | no activator ✔ |
| L2 | survey step 13 | `{2,0}` (moonrockpile, F6) | none | no activator ✔ |
| L3 | survey step 12 | `{3,0}` | none | no activator ✔ |
| L13, L14 | the live return | none | none | ✔ |
| **L15** | the live return, from L16 | `{15,0}` `{15,2}` `{15,3}` | `lock@128,48` t0/tag 0 ← `button@112,32` | lock **BUILT closed**: sealed from the L16 arrival (this slice) |
| **L16** | the live return, from L18 (if the walk ever returns that way) | `{16,7}` (+ the rope's `{16,0}`, F7) | `lock@320,112` t1/tag 7 ← `button@272,48` | lock **BUILT closed**: the arrival pocket (cols 21–23) leaves only through it. `canCross --level=16 --exit=15\|17 --from=18 --persistence=16:0,16:3,16:4,16:6,16:7` is `cannot` with or without the Shield, and the refusal now names the seal on `lock@320,112` (unit row) |

**Atlas-wide (context, not measured per door):** 20 lock-family entities have tSet ≥ 0 and a tag, so the game rebuilds
them closed. 7 are opened by a **ButtonRoom** (L20, L40), whose own cleared tag re-presses it at build (F6's latch), so
those come back open. The other **13 are opened by a plain Button** and come back closed on every return: L15, L16,
L28 (`grasslock@176,208`), L39 (four wandlocks), L40 (four), L41, L71, L82. A return arrival on the far side of any of
those is this slice's shape.

## The JS arc's pins that move at my head

**None.** No JS-arc file was edited. `jsRuntimeDeclarations` is green before and after, and no JS-arc test or committed
artifact pins the refusal text (`rg -a "no REACHABLE stance inside"` finds only substring matchers in the procgen
tests, and the bot log). What they gain:
- **`SolverRefusal.sealed`** (optional): `{wall, presser, ownOpener, group, from, stance}` on a stance refusal whose
  presser lies behind a guard-(iii) wall. `ownOpener: true` means nothing on the walker's side can ever open it. A
  walk can read it to choose another goal order or ask for an item, instead of retrying.
- The live L16 → L15 → L14 leg is `cannot` with the Sword; with the Conch it is 222 t, game-certified.

## Deltas

| row | W0 (`b116c69`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b…`, byte-identical** (`diff` empty; AFTER run on this tree at `c03fd2e`, `SEEDLING_PORT=9280`) | **none** |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none: no committed walk or certification reaches a stance refusal's throw path |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; `check-procgen-help --only=plan-seedling-return-l15.mjs` ALL PASS | instruments → **345** (+ the planner); the docs index (the log entry) |
| tapeRunner | 477, `5bdf547c…` | **485**, `96387808cae061c5f483874d68c4f84c`; the 477 old `(name, status)` pairs are **identical** (`diff` adds 8 lines only) | +8: the four `return-l15-*` tapes, each a differential row and a stepping row, all passed |
| roster | 210 (`c96bcc4c…`) | **214** (`991c631c…`) | `return-l15-reentry`, `return-l15-reentry-unclear`, `return-l15-walkin`, `return-l15-conch` |
| solver surface | GREEN 195 (`9a7cdc1e…`) | **GREEN 195** (`147f5973…`) after `--write` → `--check` | site counts only, no new row: `run:liveGeometryOpts` 6→7, `run:state` 307→310, `run:world` 191→192, `state:x` 135→136, `state:y` 142→143 |
| constants | PASS 4,966 | **PASS 4,966**; `--write` is a no-op | none (the new code adds no classified literal) |
| entities / profile | 518 / 138 | **518 / 138** | none |
| bounded vitest | 26 files / 1,322: 1,320 green, 2 pre-existing red | **27 files / 1,348: 1,346 green, the same 2 red** | + `fidelityReturn` (14). `rosterCategories:175` moves 149-vs-150 → **149-vs-154** (+4 tapes; the bank row). `r8Acceptance`'s row is unchanged (`cancross-l16-sword-none` only) |
| `boxLock`, `lintGateLabels`, `jsRuntimeDeclarations` | green | **green** | no new box-taking instrument: the planner plays nothing (model only), and recording used the existing `check-seedling-bot-differential` |

**Pins** (unions, added by name, not rewritten):
- `tapeEnvelope`, `observationTolerance` (incl. `swapped`): 210 → 214.
- `dialogueAutoAdvance`: 210 → 214, inert 209 → 213.
- `R8_ENEMY_BRIDGE.exposedAdded` gets `return-l15-walkin` (L16, 7 bobs) and `return-l15-conch` (L14, 6 bobs). Its test mirrors follow: the declared list, the measured list (exposed 48 → 50), and the right-name-wrong-rooms fixture.

**Files:**
- new: `fidelityReturn.test.js`, `plan-seedling-return-l15.mjs`, four tapes and their four expectations;
- changed: `solverBot.js` (+76 lines: the throw path, `sealedBehindWall`, `sealedRefusalClause`), `index.json`, the three roster pins, `r8Acceptance.js` and its test, the surface json, the bot log, and the regenerated reference (`README.md`, `architecture.md`, `docsIndex.js`, `instruments.js`).

## What the brief got wrong (measured)

1. **"if it is closed, it is a SOLVER gap (the button must be pressed from the L16 side: a stance across the lock, or
   the pushable block onto the button)".** It is closed, but neither option exists. The button and the block both lie
   past the lock, and Water closes the rest without the Conch. In the game the crossing does not exist with the Sword.
   The fix is a true name, not a solve.
2. **"`level_15 -> level_14` solves from the return arrival in the game's own state, with a game witness".** In the
   game's own state (Sword, no Conch) it cannot. The game witness is of the lock holding the player (D1, both states).
   The solving witness is the Conch arm (`return-l15-conch`).
3. **"In the game a cleared lock tag may build the lock OPEN/absent on re-entry".** Only for `tSet < 0` locks. A tSet ≥ 0
   lock's cleared tag means "it was open when the player left". 13 such locks in the atlas are opened by a plain button.
4. **"`persistence_cleared` carrying `{15,0}` … once the run has passed L15".** True, and the clears change nothing:
   the cleared and uncleared game streams are md5-identical.
5. **The census "from the route survey's order"**: the survey's 21 steps never re-enter L15 or L16. Its only re-entries
   (L0, L2, L3) hold no lock. The re-entries that matter come from the JS arc's live walk, which goes past the survey's
   order (L16 → L17 and back).

## Residue

| # | item | owner |
|---|---|---|
| 1 | **The live walk's return leg needs the Conch** (or another goal order). L15 from L16 and L16 from L18 are sealed with the Sword; `SolverRefusal.sealed` names it | JS arc / rules arc |
| 2 | **canCross does not surface `sealed` as a field.** It is in `why` (prose). Adding it to `classifyError`'s `cause` touches ROBUST's region (the `SolverRefusal` bound fields), so it is left for whichever lands later | ROBUST / next slice |
| 3 | **Guard (iii)'s wall text still says "NO block in this room can reach it".** It is pinned by two procgen tests (`procgenNestedOpeners:348`, `procgenSeedlingElementsCertify:236`). The seal clause now qualifies it, but the words are unchanged | fidelity (solver) |
| 4 | **The 13 plain-button tSet ≥ 0 locks are not measured per arrival door.** Only L15 and L16 are on the route | fidelity |
| 5 | **`r8Acceptance`'s exposure row is red at the base**: `cancross-l16-sword-none` is undeclared in `R8_ENEMY_BRIDGE.exposedAdded` (CANCROSS's tape, L16 bobs). It is unchanged by this slice; my two exposed tapes are declared | coordinator / CANCROSS follow-up |
| 6 | **`rosterCategories:175`** (the composite standing row): base 149 vs 150, head 149 vs 154 (+4 RETURN tapes). It needs `standing-values --write` | coordinator (bank) |
| 7 | The four new tapes owe the full tier a CI drive | CI |

## Byte-inertia

- **No committed tape, expectation or declaration moved.** Added only: four tapes, their four expectations, and the regenerated `index.json` (+4 rows).
- **No solve moved**: the new code runs only where `deriveHoldStance` already throws. The six `--check`s and the identity log are byte-identical, and tapeRunner's 477 old pairs are identical.
- **Not touched:** `campaign-frontier.json`; the AS3, the wasm and every gitlink; the rules; the JS arc's files (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s prefix admission); the other wave-4 regions (`planSwordDash`/`previewFor`/`evaluateAt`, the Watcher, the `SolverRefusal` constructor and its bound fields, the DETOUR failure row, the swim-corridor choice); `seedlingCanCross.js` (used as a caller only).
- **No signature or contract moved** for `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`. The one new field is the optional `SolverRefusal.sealed` (an instance property).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was copy → edit → run → copy back, md5-checked (`6a91ffb6…`).
- **Box:** the five recordings ran with the box free, before the BEFORE identity block started. The BEFORE block (worktree, 9290) and the AFTER block (this tree, 9280) ran one after the other, with no other box work alongside. The BEFORE bounded vitest ran in the worktree while the BEFORE block was on its node-only rows.
- **Tree dirt:** none in this tree after the AFTER block (`git status` showed only this report). The worktree `Archipelago-CC-wt-ret-base` is scratch, and nothing of it was staged. `git config extensions.worktreeConfig true` was set in this clone's local config (not pushed).
- **Scratch** (`/tmp/claude-0/ret/`, not committed): both identity logs, the vitest JSONs, the tapeRunner pair lists, the room and census scripts, the recording logs (including the drowning first cut), and `capture-main.json` read from `fidelity-scratch/planning-2-evidence`.

## Rows to BANK

- **Identity:** log **`aa46950b5958b32136111155250dd253`** (BEFORE = AFTER, `diff` empty). Six `--check`s **`405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`**, all exit 0, unmoved.
- **tapeRunner 485/485**: all pairs `96387808cae061c5f483874d68c4f84c`; the 477 old ones `5bdf547cd654e69b2cf239e1549ef0f5`. **Roster 214** (`index.json` `991c631c5cec2c2ef86c952f84ab147a`).
- **New fixtures (md5):**
  - `return-l15-reentry` tape `a692bff95b9b0069fcf4c776fc9ec5e3`, expectation `db4c5aea2fefe9b2e13427c81bf95fad`
  - `return-l15-reentry-unclear` tape `30abd3944ac5cb440123a9ffa8c2dc16`, expectation **`db4c5aea2fefe9b2e13427c81bf95fad`** (= the cleared arm's)
  - `return-l15-walkin` tape `214615fa567caf4309a8a66d2d712769`, expectation `52b2c490b5e9d991bd6c162451e5e1bc`
  - `return-l15-conch` tape `59cc9eb15a8a0db671686889f0b2a273`, expectation `582fa330aeac3511a35b10476b9b9acd`
- **Surface** GREEN 195 (`147f5973ee2bc4b933d40e946c10dcd2`) · **constants** PASS 4,966 · **profile** 138 · **entities** 518 · **instruments** 345.
- **`solverBot.js`** at the head: `6a91ffb6dfed23051a0cbd3f828e8e16` (base `55ba7151…`).
- **`rosterCategories:175`** (the composite standing row): base 149 vs 150, head **149 vs 154** (+4 RETURN tapes on top of the pre-existing drift). Re-seal with `standing-values --write` when banking.
- **`r8Acceptance`**: `cancross-l16-sword-none` is undeclared in `R8_ENEMY_BRIDGE.exposedAdded` at the base and at the head (residue 5).
- **For the JS arc:** D2 = **`f1aac13`** (`SolverRefusal.sealed`, optional).
