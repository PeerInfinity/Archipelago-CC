# Seedling fidelity L25APITEM (wave 37d) — a playthrough AP chest is the `apitem` the delivery ships

Session `seedling-fidelity-l25apitem`, planner `seedling-fidelity-planning-18`.

- **Start SHA:** `ac62c3d17e` (= main, train 43-r2; 113 ON of 125).
- **Harness branch:** `claude/seedling-fidelity-wave-37d-pn92l9` (local `seedling-fidelity-l25apitem`).
- **Head:** the commit carrying this report. Code commits: `6c0bc5de` (D1), `986b75a1` (records: boxLock taker + reference),
  `1cae213f` (two W37b key-order pins admit the new key).
- **New key** (END of the defaults, **OFF**, byte-identical): `apChestItem` → **113 ON of 126**. Env `SEEDLING_AP_CHEST_ITEM=0|1`,
  with its `SOLVER_ENV_NAMES` line (`solverEnvChannel.js` exists at this base).

| D | verdict |
|---|---|
| W0 | the refusal reproduced (step **34** at this base); the gap is the survey's ROOM, not the model's rule |
| D1 | **PASS** — key OFF, game witness 0 px (delivered + vanilla control), node rows 10/10, mutant reds 2 as predicted |
| D2 | **MEASURED** — step 34 **SOLVED 108 t, 0 hits**; survey 204/32 → **206/30**; bounded set ON: 4 env-stamp reds only |
| D3 | **STOP** — not text-only (a pinned committed fixture + the rules export carry the text) |

**The one thing to know first:** the model already took an `apitem` exactly (F2: `world.apItems`, `apItemTakenOnTick`, the
solver's `apitem` verb), and the page's solver already sees the delivered rooms. Only the route survey stood in the UNREWRITTEN
map, where the chest is a `Chest` Solid. So D1 is a room change in the survey, and no model or solver code reads the key.
That is also why sweep and probe A/Bs on this key are null by construction (§ 5).

## W0 — reproduction and the reading

Command: `SEEDLING_PORT=9777 node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=34 --out=…`.
At this base the ids shifted: 35 is an L22 step, and **L25 visit 1 is step 34** (boot `staged:r8-solve-11` at L25 (128,32);
goals `collect-placement(Level 025 - Chest) then reach-exit(teleporter@144,32 → L22)`). Refusal:
`chest (96,96) stance: STANCE_REENTRY — the walk to chest@96,96's chest stance (104,114) is itself blocked by chest@96,96 at
tick 0, …` (headline: *"the `chest` stance of chest@96,96 is behind chest@96,96 itself, on both lattices"*).

**The game, as built:**
- **Where the substitution is decided.** `flashPanel/seedlingRandomizerWiring.js:958-984`: `vanillaRecordSet(embed, mapDoc)` →
  `buildPlacementTable({ledger: R7_GOAL_LEDGER, …})` → `rewriteRecordSet(vanilla, table)`. `apPlacementRewriter.rewriteRecordSet`
  (`:496-501`) replaces each rewritable row's entity with `{type: 'apitem', x: old.x, y: old.y, attrs: {tag, look}}`. Only the
  `encounter` and `boss` rows are not rewritten. **Which chests:** all 16 ledger rows `chest@L{11,12,15,17,25,36,38,40,46,48,63,71,80,86,90,98}`
  (`r7Acceptance.js:1389-1396`), each with a vanilla `@tag` (L25: tag 0).
- **`APItem` vs `Chest`.** `Pickups/APItem.as:114-115`: `super(_x + Tile.w/2, _y + Tile.h/2, graphic, null, false)` and
  `setHitbox(8, 8, 4, 4)`. It is a Mobile with no `type` (in no solids list), and `attract = false`. Its box is (x+4..x+12, y+4..y+12),
  so (100..108)² for L25. `Pickup.update` takes it on `collide("Player", x, y)` from any side (`Pickup.as:78-83`; `special` is never set, so
  `removeSelf()`). `APItem.removed()` → `Game.setPersistence(tag, false)` (`:127-133`). **No `checkBySeal`.** `Chest.as:27-30`:
  `type = "Solid"`, a 16×16 box at the cell, opened only on `collideLine("Player", …, y - originY + height + 1, …)`
  (`:63`), the line one px under its body, and removed by `checkBySeal` once all seals are held (`:47-57`).
- **What the model does today.** In the delivered rooms (the page, `jsRuntimeCore`), `levelWorld.js:4886-4895` lists an apitem
  (`world.apItems`, the class row's box `:1167-1172`). `solverBot.resolvePlacement` resolves `collect-placement` as strategy
  `apitem` (`:8711-8726`), and `apItemTakenOnTick` (`:8750`) is the contact rule, pinned to the page tick for tick (`fidelityF2.test.js`).
  The route survey instead builds its model from `patchedMapDocument(seedling-map.json)` (`survey-seedling-route.mjs:265-268`),
  where the chest is `world.chests` → the vanilla `chest` verb (Solid, bottom-line stance).

**Census (survey at this base, OFF; all chest rows):**
- Planned with the bottom-line rule and SOLVED: steps 11, 15, 25, 47, 58, 72, 74, 87.
- REFUSED by it: 18 (L36), **34 (L25)**, 45 (L12).
- L40's chest (in steps 66/94) is refused upstream of the chest itself.
- 175 (L71) refuses on its exit kill.
- With all 16 seals staged, 197 (L63), 204 (L80) and 213 (L98) are met by `Chest.checkBySeal` at boot (0/5 ticks), a removal
  the delivered game does not have.
- Sweep legs: the 36 chest legs (`location:Level 0xx - Chest`, keys in `evidence/chest-leg-keys.txt`, derived at this base)
  are page legs. The page solver sees the apitem already, so the game takes it on overlap from whatever side the walk arrives.
  That is why rules-4 saw them `done`.

## D1 — `apChestItem` (OFF, byte-identical): **PASS**

**Change.**
- `apChestDelivery.js` (new): `deliveredChestDocument(mapDoc)` replaces each ledger chest with the rewriter's own element
  (`apitem`, same cell, vanilla tag, `look: 'chest'`). A chest with no `@tag` throws by name rather than allocating one.
- `survey-seedling-route.mjs`: `MODEL_ATLAS` is that document when the key is ON. It feeds the three `levelSourceFromAtlas` sites
  (solve, `worldOf`, the tentacle-mouth build). The route derivation (edges, goals, `levelsByNo`) still reads `atlas`; the apitem
  stands at the chest's (x, y), so the goal's cell is the same.
- `contactFidelity.js`: the key at the END. Nothing else reads the key. Per `grep -a apChestItem`: `contactFidelity`, `solverEnvChannel`,
  the survey, the new module, the probe, and the tests.
- A non-AP chest is untouched: a generated set's door/loot chest, a vanilla-room tape, the vanilla survey arm.
- The solver needs no change: with the apitem in the room, `collect-placement` resolves `apitem` ("any side it can reach; no
  bottom-line stance").

**Game witness FIRST** (`probe-seedling-l25-apitem.mjs --record`, p4g `seedling_bot_ap_p4g`, headless logic-only, port 9777,
box lock). The delivered set is the REAL pipeline (`fidelityL25ApItem.l25Sets`: `buildPlacementTable` over the playthrough's
seed-1 placement → `rewriteRecordSet`, `seedling-ap-record-01b432a9`). The tape is the survey's own step-34 ON solve
(`fixtures/l25apitem-witness/step34-on.tape.json`). Oracle: `fixtures/l25apitem-witness/oracle.json`.

| arm | game | model |
|---|---|---|
| DELIVERED, whole tape | 109 obs, `{25,0}` cleared, 0 hits, ends L22 (24,136) | **0 px / 109 rows** |
| TAKE, 49 ticks, `hold` | `{25,0}` **cleared** | takenAt **48** |
| BEFORE, 48 ticks, `hold` | **not** cleared | — |
| VANILLA (control), whole tape on `seedling-vanilla-record-5aeefc3c` | Chest stays Solid, `{25,0}` set, ends (23.2,136) | **0 px / 109 rows** (first divergence from the delivered stream: t45, x 113.37 vs 114.05, the Solid's face) |

The take happens at (109.38, 99.07): **above** the chest's bottom edge (y 112) and **right** of its centre. The walk comes in from
the north-east and never stands under the chest, which is the non-bottom side the brief asked for.
**Vanilla-stance control:** with the key ON, `r8-solve-11`'s committed tape still opens `chest@32,48` from its bottom line, and its
chest opens are identical in both arms (row in `fidelityL25ApItem.test.js`).

**Rows** `fidelityL25ApItem.test.js` (10/10):
- the key ships OFF;
- the room: exactly 16 chests replaced, everything else by reference;
- the room equals the real rewrite (type, cell, tag);
- the oracle identity;
- the take on the game's tick, inside the cell, not the bottom line;
- the whole stream 0 px;
- the vanilla control;
- the solver at the survey's call shape: delivered = `apitem`/`walk`/48, 108 ticks; vanilla still throws `STANCE_REENTRY`;
- the key is not read by the model.

**Mutant** (predicted first, copy + restore, md5 restored `88acad5e`): `deliveredChestDocument` writes `type: 'chest'` →
predicted: the "replaces exactly" row and the "delivered room SOLVES" row red, and the game/oracle rows stay green (they use the real
rewriter). **Measured: exactly those 2 red, 8 green.**

## D2 — key ON

**Step 34 (L25): REFUSED → SOLVED 108 t, 0 hits, 0 re-plans, 2 decisions, taken at 48.**

**Local survey, both arms in full** (`--through=end --route=full`, 236 rows each; per-row file
`evidence/survey-off-vs-on.jsonl`). OFF = **204 SOLVED / 32 REFUSED** (= the brief's base). ON = **206 / 30**.

| step | L | OFF | ON | reading |
|---|---|---|---|---|
| 11 | 11 | SOLVED 97 | SOLVED 34 | the chest taken from the walk's side |
| 15 | 86 | 101 | 39 | " |
| **18** | 36 | **REFUSED** (*"chest (64,48) stance: the re-planned corridor failed too"*) | **SOLVED 149, 0 h** | the bottom stance was unreachable |
| 25 | 17 | 131 | 63 | |
| **34** | 25 | **REFUSED** STANCE_REENTRY | **SOLVED 108, 0 h** | the slice's row |
| **45** | 12 | **REFUSED** (re-planned corridor failed) | **SOLVED 3104, 0 h** | long but hitless |
| 47 | 38 | 371 | 310 | |
| 58 | 15 | 326 | 322 | |
| 64, 92, 133, 146 | 38 | 480 / 359 ×3 | 389 / 265 ×3 | a later L38 visit crosses the chest's cell (no longer Solid) |
| 72 | 46 | 1352 | 837 | |
| 74 | 48 | 681 | 354 | |
| 87 | 90 | 137 | 67 | |
| 66, 94 | 40 | REFUSED: death at t780 pressing `spinner@880,848` from the chest stance | REFUSED: *"burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bobsoldier@880,832"* | obstacle moved (the apitem's approach goes past the tree) |
| 175 | 71 | REFUSED at `reach-exit … chaser kill (lavarunner@64,224)` | REFUSED at `apitem (160,256) contact -> … the same lavarunner` | the same pinned chaser, now met on the chest's approach |
| 197 | 63 | SOLVED **0** | SOLVED **464**, 0 h (earned `{63,1}`) | OFF: all 16 seals staged → `Chest.checkBySeal` deleted it at boot. The apitem does not vanish: **ON is the game** |
| 204 | 80 | SOLVED **5** | SOLVED **523**, 0 h | same |
| **213** | 98 | SOLVED 724 | **REFUSED**: *"reach-exit (112,112)->L99 -> kill -> chaser kill (jellyfish@56,48) … PINNED on the solid between them"* | same cause as 197/204: OFF never walked to the chest. ON walks there and then refuses the exit kill. A new, truthful refusal (residue) |

All other 214 rows are identical in verdict, ticks, hits and refusal text.

**Bounded vitest (143 files: the brief's list, ∪ every `grep -a` hit for `apitem|apItems|chestProbeLineEnd|chestBodyPlacementProbe|
chestSealRemoval|pickupUnderfoot|survey-seedling-route|SOLVER_ENV_NAMES|CONTACT_FIDELITY_KEYS|apChestDelivery`, + `dashShape`,
`dashOnlyWindow`, `jsRuntimeSolverShouldStop`, `fidelityF2`, `fidelityL1516`, `fidelityChestSeal`, `apPlacementRewriter`,
`seedlingSetPatches`, `levelRunDigestRead`, `solverEnvChannel`):**
- **OFF:** 141/143 at `986b75a1`. Both reds were MINE: `fidelityCeremony126` "last in the defaults" and `fidelityFrozenPress`
  "followed only by wave-37b keys" (key-order pins). Fixed in `1cae213f`; 22/22.
- **ON** (`SEEDLING_AP_CHEST_ITEM=1`): 139/143. Reds: `contactFidelity` "the shipped defaults: all three ON"; `dashOnlyWindow` ×2
  and `dashShape` ×1 "the default adds no field"; `procgenRequirementsStrategy` "REFUSED at the gate…" (received
  `contactFidelity: {…}` for `null`). All are **env-vs-default artifacts**: an off-default key stamps the whole switch set into the
  request. Each passes solo OFF, and a real default flip re-pins the defaults row and stamps nothing. CEREMONY126 recorded the same class.
- Slow `fidelityL32ArenaPrefix` 5/5; train `fidelityL40Bk2` 1/1. `jsRuntimeSolverShouldStop` / `dashOnlyWindow` / `dashShape` green OFF.
  L4's 84/85 margin is untouched (no model path changed).
- **Hammer pins:** none moved (`runChest` / `CHEST_LEG_DELTA` untouched; `hammerChestIncidental` is not in the grep closure
  because nothing it stages reads the key).

**Gates at the head (OFF):**
- **Identity block** (`evidence/identity.txt`):
  - maze `57e07d21`, acceptance batch **`abb206c88de25e7ba1874510d493ce85`** (= main), c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, …
  - generated set OK.
  - The six producer `--check`s: battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`,
    campaign `be9c19c8`. All exit 0, equal to the values CEREMONY126 published (no main-side value was available to compare).
- **Docs and censuses:**
  - `generate-procgen-reference --check`: ALL 7 + 5 MATCH (regenerated for the probe and the docs).
  - `check-procgen-help`: ALL PASS (525). `check-procgen-docs`: ALL CHECKS PASSED.
  - Censuses: solver-surface GREEN (371 rows) and constants PASS (7067), no `--write` needed.
- **Closure, sets and tapes:**
  - `seedlingDerivedRuleTable.js --print-engine-closure` (43 files) ∩ diff = **∅**.
  - `boxLock.test.js` 26/26: the probe was added to the guarded takers.
  - No committed tape and no producer digest moves, ON or OFF. The tape roster is unchanged: the witness tape lives in
    `fixtures/l25apitem-witness/`, not `fixtures/tapes/`.
- `ci-producer-checks.mjs --jobs=3` at `1cae213f` (`evidence/producers.txt`): **97 run, every producer exit 0, 1 skipped**
  (`plan-seedling-r7-ends-meet`, a browser arm CI runs). The one "red" is the battery's `TREE-MOVED` sentinel. Every path it lists
  is this report's own docs/evidence edits, written while the battery ran; no producer wrote to the tree.
- **Push CI** `JavaScript Unit Tests` at `1cae213f` (run 42288329514): **25760 passed / 0 failed**, slow battery 415/415
  (`ci-vitest-summary.mjs`). The train tier does not run on a slice push; `fidelityL40Bk2.train` was run locally (above).

**Byte-inertia, argued and measured:** OFF, the survey's `MODEL_ATLAS === atlas`, and no other code path reads the key. The OFF survey
equals the base's 204/32 row for row.

## D3 — `FLAG_ACTIONS.shieldlock` / `shieldlocknorm` wording: **STOP** (not text-only)

**The game:**
- `ShieldLock.as:32-33`: `collide("Player", x - 1, y)`, the player touching the lock's WEST face, with `Player.hasShield`
  (`shieldType 0` = `shieldlocknorm`, `Game.as:2362`) or `Player.hasDarkShield` (`shieldType 1` = `shieldlock`, `:2363`).
- It freezes the player (`receiveInput = false`, `directionFace = 0`) and runs the Lock's activation to `turnOff()`, which writes
  the flag (`:43-50`).
- The rows today say *"opened by its activation group (turnOff…)"*, `item: null`.

**Why it stops:**
- `FLAG_ACTIONS[cls].action` is not a label. It is emitted by `fidelityArrival.arrivalEdgeTable` into the committed
  `fixtures/arrival-solid-edges.json` (lines 270, 1055), which `fidelityArrival.test.js:140` pins equal (`EDGES.edges`).
- Through `seedlingObstacleEvents` (`action: {verb, item}`), the text is also in the RULES export:
  `frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json` and `worlds/seedling_playthrough/Locations.py:100`
  (*"L71 flag 2: shieldlock@288,256 cleared"*).
- So a text edit moves a committed fixture and needs a rules regeneration, which is not licensed here. The `item` field
  (`null` → `hasShield` / `hasDarkShield`) is the rules arc's input and is behaviour outright.

**Hand-over (rules arc + fidelity), proposed rows:**
- `shieldlocknorm`: action *"opened by a Shield touch on its west face (then its activation runs to turnOff)"*, item `hasShield`,
  cite `Puzzlements/ShieldLock.as:32-33 update(): collide("Player", x - 1, y) && Player.hasShield (shieldType 0) → activate; Lock.as turnOff()`.
- `shieldlock`: the same with `hasDarkShield` / `shieldType 1`.
- Then regenerate `arrival-solid-edges.json` (census) and the playthrough rules, in one licensed slice.

## 4. Boundaries, JS arc, hammer

- **JS arc:** no contract change, and nothing to wire. The page already delivers apitems. `jsRuntime*`, the solver worker,
  `solveSegment` and `createRunForStaging` are untouched. Two arc-neutral additions: an env name (`SEEDLING_AP_CHEST_ITEM`) in
  `SOLVER_ENV_NAMES`, and a key in `CONTACT_FIDELITY` (both lists append-only). No `producer:walker` row can move: `drive` is untouched.
- **Hammer:** nothing handed over. `runChest`, `CHEST_LEG_DELTA`, the chooser, the escapes, `planWaypoints` and `stateDigest` are
  untouched. No new per-visit run map, so no `DIGEST_EXEMPT` row is owed.
- **CEREMONYEXACT:** no `pickupUnderfoot` hunk. Not touched: AS3, wasm, gitlinks, rules, the `FROZEN_TICK_PRESS` throws,
  `REFUSAL_BY_NAME`, the vanilla `Chest` rule.

## 5. CI dispatches for the planner (branch `claude/seedling-fidelity-wave-37d-pn92l9`)

1. **Survey A/B** — `seedling-survey.yml`, `through=end`, `route=full`, OFF arm vs ON arm with env `SEEDLING_AP_CHEST_ITEM=1`
   (or `only=11,15,18,25,34,45,47,58,64,66,72,74,87,92,94,133,146,175,197,204,213` for the movers).
   Expect ON 206/30 with the table above.
2. **Full sweep ×2 per arm** — `seedling-divergence-sweep.yml`, `contact_fidelity` = `evidence/contact-fidelity-OFF-arm.txt` (the
   113 default-ON keys, built fresh from this base's defaults, md5 `aa1718ee`) vs `evidence/contact-fidelity-ON-arm.txt` (113 +
   `apChestItem`, md5 `bb0e2f04`).
   - ⚠ **Expected null by construction:** the page plays the delivered rooms and nothing on the page reads the key.
   - A keyed run on the 36 chest legs (`keys=` the contents of `evidence/chest-leg-keys.txt`, `capture_requests`) is the cheap confirmation.
3. **Probes** — `seedling-probe.yml battery=standard` at the branch, both arms. Expected null for the same reason. Also run
   `probe-seedling-l25-apitem.mjs` (new, headless logic-only) if the battery takes a named probe.

## 6. What the brief got wrong (measured)

- *"route-survey step 35 (L25)"*: at `ac62c3d17e` it is **step 34** (35 is L22).
- *"The model / solver `chest` verb applies the vanilla rule … the model takes an AP chest"*: the model and the solver ALREADY take an
  apitem exactly (F2). The gap is the survey's ROOM (an unrewritten map), so the fix is a room, not a rule, and no model/solver code
  changes. A sweep/probe A/B on the key is null by construction.
- *"the AP chest … taken from the main area"*: confirmed, and more. With the rule fixed, steps 18 and 45 solve too. Three late steps
  (197, 204, 213) were "solved" OFF only by the vanilla seal removal (`Chest.checkBySeal`), which an `APItem` does not have.
- D3 *"text/labels only"*: it is not (§ D3).

## 7. Residue

- **Step 213 (L98):** the L99 exit's `jellyfish@56,48` chaser kill refuses (*"PINNED on the solid between them"*) once the chest is
  really taken. Same class as step 175's `lavarunner`.
- **Steps 66/94 (L40):** the chest approach meets `bobsoldier@880,832` past `burnabletree@872,784` ("combat ladder EXHAUSTED").
- **The survey's pickups, keys, totem parts and seed** are still staged vanilla. The delivery makes them apitems too: no ceremony,
  no attract, no `special`. This is a tick-count difference, not a refusal, and it is out of this slice's scope. A follow-up could
  stage the whole delivered set (`rewriteRecordSet`) in the survey behind the same or a sibling key.

## 8. Rows to BANK

- L25's chest on p4g (delivered) is taken at tick 48 of the survey's ON tape, from the north-east, 0 px. Fixture:
  `fixtures/l25apitem-witness/oracle.json`.
- A 0-tick chest row in the survey means the seal removal, not a take.
- The survey's model rooms ≠ the page's: the page sees the delivered rooms.
- Acceptance md5 `abb206c88de25e7ba1874510d493ce85` at the head.
