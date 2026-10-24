# D1 — the census of preview call sites (PDS, at the merged tree `e09a90077a`)

Produced by `scripts/census.mjs` (beside this file): a `@babel/parser` walk of each file that lists every call of
`previewWalk`, every `run.previewStepper()`, and every call of a variable bound to a preview stepper (scope-aware: a
`step` bound in one function is not another function's `step`), with the enclosing function chain and whether a
`try` whose handler names `PhysicsV2Error` encloses the call. Its raw output is `raw.tsv`. Every row below was then read
by hand, with the call graph (callers named), not guessed from the names. Line numbers are at `e09a90077a`.

## What throws, and when (the premise of the reachability column)

- `levelRun.previewStepper()`'s step throws `deathRefusal` (a `PhysicsV2Error`) on any `step` result that carries a
  `death` (a drown in water/lava, or a lethal pit). It has no world to reboot into (`levelRun.js:19791-19806`).
- **`previewWalk` already ends a walk at a death that starts INSIDE it** (`lethalFloorOf`, `solverBot.js:5763-5788`):
  a drown latched by the walk is `truncated.kind: 'drowned'`, and a fall whose tile `fallDestination` refuses is
  `'lethal-pit'`. Both are asked after every step of the transit, the stall and the tail. So **`previewWalk` throws
  only when the live run's drown was ALREADY latched when the preview started** (`drowningAtStart`: "left to the run").
  The run then dies whatever is held.
  - ⇒ The throw is a property of the **decision tick**, not of the candidate: at such a tick **every** `previewWalk` from
    `run.state` throws, and **the first one asked is the one that throws**.
  - ⇒ A `previewWalk` site behind another preview of the same state at the same tick (for example the ladder's rungs,
    which run only after `probeCorridor` returned a hit) cannot be where the throw lands. The table calls this
    "shadowed".
  - This is how SFF2's two sites threw: `deriveStrike`'s `walkTo` and `deriveRefuge` were each the first preview at a
    latched tick (seed 30: `execKillByPress` → `moveNow` → `noStrikeMove` → `refuge` → `deriveRefuge`).
- **A raw `previewStepper` loop has no `lethalFloorOf`.** It throws on ANY previewed death, at any tick: a pit at the
  end of a fall, or a drown at the end of its run-up. This is A2's case (`stepToward`).
- The floor (`STRIKE_ETA_FLOOR`) gates none of these sites. Only `deriveStrike`'s bounded pass previews more cells ON.
  So every site is **reachable OFF and ON alike**. The floor changes which walks happen, and so which ticks a site is
  asked at.

## The table

Kinds:
- **guarded**: a catch (or a `previewOrDeath` wrap) already handles the death;
- **candidate**: a search over options, where a death should skip the option → **D2 fixes it**;
- **executor**: the gate of the walk the run is about to take, where the death is the live run's → left bare (the
  brief's ⛔);
- **handover**: outside this slice's files.

### `solverBot.js` — `previewWalk`

| line | function (caller) | kind | reach | D2 |
|---|---|---|---|---|
| 6513, 6514 | `planSwordDash › previewFor`: the undashed base and every dash schedule (`walkTo`'s dash, `corridorDashRescue`) | candidate | first preview when `walkTo` plans a dash on a fresh tick | wrap: the base reads as a STALL refusal, and a schedule as a `stalled` row |
| 10491, 10492 | `deriveRefuge` candidate loop (← `refuge` ← `noStrikeMove`, the press kill's executor) | candidate | **measured (SFF2)**: seed 30 ON | wrap: the candidate is skipped |
| 11062 | `deriveStrike › walkTo` | guarded (SFF2's D1) | — | — |
| 19502 | `baitForecastOf` | guarded (`PhysicsV2Error` / `BotDriverV2Error` → no forecast) | — | — |
| 20070 | `deriveKillByChaser › scoreAll` | guarded (same) | — | — |
| 20298 | `deriveGuardApproach` | guarded (same) | — | — |
| 22309 | `solveSegmentUnder › probeCorridor`: the corridor `walkTo` is about to walk, and each rung's re-probe | **executor** | the first preview of most ticks | **left bare**: at a latched tick the walk it gates dies for real. Swallowed, it would read as a clean corridor (`probeSamples([])` is `null`) |
| 22373 | `corridorDashRescue`: the whole-chain certification | candidate | shadowed (after `probeCorridor`) | wrap (drop-in: `arrived` is false) |
| 22752 | the DODGE rung's stall search | candidate | shadowed | wrap (drop-in: truncated → `continue`) |
| 22805 | the WHIRLPOOL arm's one stall | candidate | shadowed | wrap (drop-in: truncated → `bad`) |
| 22862 | `axeStall`'s base walk (the doorstep) | candidate | shadowed | wrap + a death arm: it indexes `base.samples` |
| 22877 | `axeStall › certified` | candidate | shadowed | wrap (drop-in) |
| 22916 | `axeStall`'s rest screen | candidate | shadowed | wrap (drop-in: an empty screen is `false`, and `certified` decides) |
| 22985 | AXETIMING's `timingBase` | candidate | shadowed | wrap + a death arm (it reads `samples`) |
| 23091 | `axeTimingCrossing › certified` | candidate | shadowed | wrap (drop-in: too short → `null`) |
| 23119 | `axeTimingCrossing`'s rest screen | candidate | shadowed | wrap (drop-in) |
| 23185 | the AXE arm's DETOUR `certify` | candidate | shadowed | wrap (drop-in: `truncated` is returned, and DETOUR rejects any non-crossed truncation, `:20662`) |
| 23320 | `phaseStall`'s base walk | candidate | shadowed | wrap + a death arm |
| 23346 | `phaseStall › certified` | candidate | shadowed | wrap (drop-in) |
| 23372 | `phaseStall`'s rest screen | candidate | shadowed | wrap (drop-in) |
| 23417 | the PHASE arm's DETOUR `certify` | candidate | shadowed | wrap (drop-in) |
| 24433 | the DETOUR rung's `certify` | candidate | shadowed | wrap (drop-in) |
| 24620 | AXE_PRICED_CROSSING's base walk | candidate | shadowed | wrap + a death arm (`inReach(base.samples[door])`) |
| 24631, 24654 | its members | candidate | shadowed | wrap (drop-in: `completed` is false) |
| 24638 | its rest screen | candidate | shadowed | wrap (drop-in) |
| 24689 | a member's prefix, driven on a fork | candidate | shadowed (a member that died is never `done`, so never tried) | wrap (drop-in) |
| 25665 | `stepOffIfLatched`'s step-off candidates | candidate | first preview of its tick (← the latched-door arm) | wrap + a death arm: `probeSamples([])` would read as clean |
| 25874 | `returnOntoDoor` | candidate (`null` hands the walk back to `walkTo`) | after `stepOffIfLatched` drove the run: a fresh tick | wrap (drop-in: not `'crossed'` → `null`) |

### `solverBot.js` — raw `previewStepper` (no `lethalFloorOf`: any death throws)

| line | function (caller) | kind | reach | D2 |
|---|---|---|---|---|
| 1262 → 1249 | `searchEncounterStrike` → `forecastEncounterPlan`: the boss fight's strike plans (← the encounter executor `:1403`) | candidate | any boss tick whose plan walks onto lethal floor | wrap the stepper (`previewOrDeath`). A plan whose step dies is touched at that tick |
| 1290 → 1249 | `searchEncounterReposition` | candidate | same | same: a key set that dies is safe only until then |
| 1894 | `previewLean`: the burn and wand stance leans (← `burnStance` `:2004`, the wand lock `:2252`, rope fire `:18132`) | candidate | a lean onto lethal floor | wrap: a lean that dies is `null` (a miss, as its docblock reads) |
| 4870 | `stepOffMinimalFor › tryDir` | guarded | — | — |
| 5441 (5822, 5948, 6034) | `previewWalk` itself: the throw's origin | — | — | ⛔ not edited (the brief's STOP line) |
| 6902 | `enclosedPitCornerKeys` | guarded | — | — |
| 9383 → 9451 | `planPacedWait › tick`: the paced-wait search (← `pacedWaitFor` `:9354`) | candidate | a pacing over lethal floor | wrap: a pacing that dies is rejected with its tick |
| 11403, 11430, 11481, 11638, 11660 | `trainIsSafeHere`, `trainLineBlockedHere`, `stepToward`, `landsClearOfHammers`, `landsClearInFlight` | guarded (A2's `previewOrDeath`) | — | — |
| 11766 → 11791 | `previewPressApproach` (the HAMMER-PHASE rung) | guarded by construction | the stepped key set is the one `landsClearOfHammers(view, k)` already stepped from that state through `previewOrDeath` and found not dead (a step is a pure function). Its `!ahead → true` arm is unreachable here: the loop returns `'unknown'` first when `rows[o + 1]` is missing | — |
| 12476, 12723, 13201 | `pressEscapeOnce`, `deriveApproach`, `deriveFight` (and `spaceTimeReach`'s `step`) | guarded (`previewOrDeath`). The raw stepper is handed only to `previewViewAt`, whose readers wrap it | — | — |
| 18021 | `previewFaceTap` (← `ropeSpearStance` `:18169`, `:18196`; the rope executor's check `:18409`, which REFUSES on `null`) | candidate | a tap onto lethal floor | wrap: a tap that dies is `null`, as its docblock already says for lethal floor |
| 18925 → 18951 | `searchDrillTimedPass › stepSafe` | guarded | — | — |

### Other modules (outside this slice's files)

| site | kind | note |
|---|---|---|
| `arrivalSolid.js:105` `modelStuck` | guarded (a catch-all `break`) | — |
| `crusherBait.js:730` `alignmentCandidates` | candidate, **unguarded** | handover: a candidate prefix that dies throws out of `execBait` |
| `lightsVerb.js:327` → `:168` (`env.step`, the sortie portfolio) | candidate, **unguarded** | handover |
| `spaceTimeReach.js` | takes its `step` from the caller | every caller hands it `previewOrDeath`'s step (`:12536`, `:12813`, `:13387`) |
| `solveProgress.js` | does not preview | — |

## Counts

- `raw.tsv` holds **85** rows across the six files: every `previewWalk` call, every `previewStepper()` and every call of
  a bound stepper, wrapped ones included.
- **solverBot.js `previewWalk` sites: 31 calls** (the `previewWalk` rows of `raw.tsv`).
  - 4 are guarded;
  - 1 is an executor gate, left bare (`probeCorridor`);
  - **26 are candidate sites**. D2 fixes them all, and 5 of them also get a death arm, ahead of reading `samples` or of
    `probeSamples`;
  - 2 of the 26 are measured or first-preview reachable: `deriveRefuge` (measured) and `stepOffIfLatched`.
    `planSwordDash`'s base and `returnOntoDoor` can also open a fresh tick. The rest are shadowed.
- **solverBot.js raw-stepper sites: 5 candidate searches unguarded** (`searchEncounterStrike`,
  `searchEncounterReposition`, `previewLean`, `planPacedWait`, `previewFaceTap`) → D2. Every other site is guarded.
- **Out of files: 2 unguarded candidate searches** (`crusherBait.alignmentCandidates`, `lightsVerb`'s sortie step)
  → hand-over.
