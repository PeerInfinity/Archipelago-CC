# Seedling HAMMER-PHASE — slice DA: every per-visit map is in the digest's `visit` part, or exempt with a reason

Slice `seedling-hammer-digest-audit` (Opus, cloud). The planner is `seedling-hammer-phase-planning-2`. ⚖ The user
approved the slice on 2026-10-21 ("launch that slice").

**Verdict: one map IN, 30 EXEMPT, a guard row that reds a new one by name.**
- **IN: `lightsFights`.** By code, the escape reads it through `previewStepper` / `spinnerForecastWithPress` →
  `liveSolidOpts` → `lightTotemsNow`: the L69 totem's solid, with `lightsBossFight` ON only.
- **The false equal was real at base:** a pair that differs only in that map moved the escape's run surface in
  **123 of 125** samples, while the digest did not move.
- **It was latent:** no committed workload calls the escape in L69. The two ON lights solves make 0 escape lookups.
- **XC verify mode:** **43,698 hits verified, 0 mismatches**, both before and after the edit.

## 1. SHAs

| | |
|---|---|
| Start SHA | **`bf259ff199`** (`origin/main` at the fetch) |
| Head | the commit carrying this report. Before it: D2 `c444f35c48`, D1 evidence `c12b460d`, D3 records `bb3ebae0`, merge of main `2600a606` → `ed1e35ef`, the guard's count comment `ee4f3fca5f` |
| Branch | `claude/seedling-digest-visit-audit-0ys76v` (the harness's name; the brief said `seedling-hammer-digest-audit`). Nothing went to `main` |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-digest-audit-evidence/` (`w0/`, `d1/`, `verify/`, `d2/`, `d3/`, `tools/`) |

## 2. W0 — the inventory

**The method.** I re-ran fidelity DIGEST's two AST tools at `bf259ff199` (`tools/escape-reach.mjs`,
`tools/closure-census.mjs`). I added a third, `tools/member-reach.mjs`, the census plus `--members-of`: for each
binding, it lists the run members whose call graph (by name) reaches one of the binding's readers.

- **The escape's run members did not change:** `ticksCompleted state level world previewStepper
  spinnerForecastWithPress gameTimeAt progress`, plus `stateDigest` (XC's own key read). `escape-reach` follows 61
  solverBot / spaceTimeReach / solveProgress / ghostSpinnerPress / playerPhysicsV2 / hazards / pressKillCost
  functions (`d1/escape-reach.txt`).
- **The closure those eight reach reads 75 bindings** (74 with the shadow filter; DIGEST counted 74 / 73). Every
  binding is digested or one of DIGEST's named exclusions, except **`lightsFights`** (`w0/census-*.txt`).

**The universe the guard holds** (the same shapes the guard reads from the source):
- every `const …States = new Map()`;
- every `const …ByLevel = new Map(…)`;
- every `const …Windows = []`;
- everything `freshVisitState` resets.

That is **55 names**: 24 digested at base, **1 IN**, **30 EXEMPT** (`w0/inventory.md`; the raw rows with writers are
`w0/inventory.tsv` and `w0/member-reach-all.json`):

| map | line | digest part at base | escape members reaching a reader | other members reaching a reader | writers (outside construction) | DA |
|---|---|---|---|---|---|---|
| `clearedByLevel` | 954 | persist | previewStepper progress spinnerForecastWithPress state world | addTimedClears advance apReportSlotHeld armedArrowTraps armedPulsers arrowCoverAt … | applyClearNow applyEarnedClears | digested |
| `despawnedByLevel` | 1171 | persist | previewStepper progress spinnerForecastWithPress state world | advance armedArrowTraps armedPulsers arrowCoverAt arrowForecast bobBoss … | applyTimedDespawns fireStaticRemovals | digested |
| `activatorStates` | 1388 | visit | previewStepper spinnerForecastWithPress | advance armedArrowTraps … | applyEarnedClears dropWorldIfBuiltStale activatorStateFor freshActivatorState | digested |
| `bridgeStates` | 1430 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale bridgeStateFor freshVisitState | digested |
| `pushableStates` | 1431 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale pushableStateFor freshVisitState | digested |
| `rockStates` | 1442 | visit | previewStepper spinnerForecastWithPress | advance brokenRocks … | rockStateFor | digested |
| `burnStates` | 1454 | visit | previewStepper spinnerForecastWithPress | advance burnedTrees … | burnStateFor | digested |
| `ropeStates` | 1482 | visit | previewStepper spinnerForecastWithPress | advance … | ropeStateFor | digested |
| `fallRockStates` | 1592 | visit | previewStepper spinnerForecastWithPress | advance … | fallRockStateFor | digested |
| `moonrockStates` | 1776 | visit | previewStepper spinnerForecastWithPress | advance … | moonrockStateFor freshVisitState | digested |
| `crusherStates` | 1810 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale crusherStateFor freshVisitState | digested |
| `bossStates` | 1869 | visit | previewStepper spinnerForecastWithPress | advance bosses bossesWoken … | dropWorldIfBuiltStale bossStateFor freshVisitState | digested |
| `shieldBossStates` | 1924 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale shieldBossStateFor freshVisitState | digested |
| `finalDoorStates` | 2177 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale finalDoorStateFor freshVisitState | digested |
| `turretStates` | 2247 | visit | previewStepper spinnerForecastWithPress | advance … | dropWorldIfBuiltStale turretStateFor freshVisitState | digested |
| `beamTowerStates` | 2386 | visit | previewStepper spinnerForecastWithPress | advance … | beamTowerStateFor freshVisitState | digested |
| `magicalLockStates` | 2426 | visit | previewStepper spinnerForecastWithPress | advance … | magicalLockStateFor | digested |
| `wandWindows` | 2472 | visit | progress spinnerForecastWithPress | advance slashInfo spinnerFightForecast | run.advance | digested |
| `chestStates` | 3655 | visit | previewStepper spinnerForecastWithPress | advance … | chestStateFor freshVisitState | digested |
| `pulserStates` | 3679 | visit | previewStepper spinnerForecastWithPress | advance … | pulserStateFor freshVisitState | digested |
| `spinnerStates` | 3764 | visit | spinnerForecastWithPress | advance chaserForecast entities spinnerBodies spinnerDeaths spinnerFightForecast … | dropWorldIfBuiltStale spinnerStateFor freshVisitState | digested |
| `grantsByLevel` | 5051 | player | progress | advance unfiredGrantLevels | applyGrantsFor | digested |
| `fireWindows` | 5472 | visit | progress spinnerForecastWithPress | advance slashInfo spinnerFightForecast | run.advance | digested |
| `pullsByLevel` | 8867 | visit | previewStepper | advance entities pulls | pullsFor | digested |
| **`lightsFights`** | 15582 | — | **previewStepper spinnerForecastWithPress** | advance arrowCoverAt arrowForecast bobBossForecast chaserForecast collideLineSolid … | freshVisitState lightsFightFor | **IN** |
| `tileWritesByLevel` | 1231 | — | — | advance tileWrites | freshVisitState renderIgneousNow stepBulbGraphicNow | EXEMPT |
| `igneousStates` | 1248 | — | — | advance entities igneousTiles | freshVisitState renderIgneousNow | EXEMPT |
| `finalBossStates` | 1970 | — | — | advance finalBosses owlPods shakeWritersHere | dropWorldIfBuiltStale owlStateFor freshVisitState | EXEMPT |
| `podStates` | 1982 | — | — | advance finalBosses owlPods shakeWritersHere | dropWorldIfBuiltStale owlStateFor freshVisitState | EXEMPT |
| `placedGrenadeStates` | 2132 | — | — | advance grenadeForecast placedGrenades | dropWorldIfBuiltStale freshVisitState stepPlacedGrenadesNow | EXEMPT |
| `lavaChainStates` | 2139 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepLavaChainsNow | EXEMPT |
| `spinningAxeStates` | 2146 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepSpinningAxesNow | EXEMPT |
| `owlRocks` · `owlGrenades` · `owlPendingRocks` · `owlPendingGrenades` (`let`) | 2148–2151 | — | — | advance | dropWorldIfBuiltStale freshVisitState stepOwlNow | EXEMPT |
| `watcherStates` | 2205 | — | — | advance watchers | dropWorldIfBuiltStale watcherStateFor freshVisitState | EXEMPT |
| `blastStates` | 2294 | — | — | advance blastsInFlight | blastsFor enterWorld stepBlastsNow | EXEMPT |
| `shooterStates` | 2338 | — | — | advance entities shooters spitForecast | shooterStateFor freshVisitState | EXEMPT |
| `spitStates` | 2351 | — | — | advance entities shooters spitForecast | spitsFor freshVisitState enterWorld stepSpitsNow | EXEMPT |
| `bombPusherStates` | 2361 | — | — | advance bombPushers chaserForecast entities spitForecast | bombPusherStateFor freshVisitState | EXEMPT |
| `bombStates` | 2374 | — | — | advance bombs chaserForecast entities spitForecast | bombsFor freshVisitState enterWorld stepBombsNow | EXEMPT |
| `wandShotStates` | 2458 | — | — | advance wandShotsLive | wandShotsFor enterWorld stepWandShotsNow | EXEMPT |
| `bossShotStates` | 3015 | — | — | advance bossShots | bossShotsFor stepBossShotsNow | EXEMPT |
| `arrowTrapStates` | 3702 | — | — | advance armedArrowTraps arrowForecast entities | arrowTrapStateFor | EXEMPT |
| `sealPiece` (`let`) | 3744 | — | — | advance sealPiece | freshVisitState stepChestsNow stepSealPieceNow | EXEMPT |
| `wallFlyerStates` | 3788 | — | — | advance corridorBodyForecast wallFlyers | dropWorldIfBuiltStale wallFlyerStateFor freshVisitState | EXEMPT |
| `drillStates` | 3820 | — | — | advance corridorBodyForecast drills | dropWorldIfBuiltStale drillStateFor freshVisitState | EXEMPT |
| `staticBodyStates` | 4021 | — | — | advance entities spitForecast staticBodies | dropWorldIfBuiltStale staticBodyStateFor freshVisitState | EXEMPT |
| `darkTrapStates` | 4072 | — | — | advance darkTraps entities | dropWorldIfBuiltStale darkTrapStateFor freshVisitState | EXEMPT |
| `chaserStates` | 4111 | — | — | advance chaserForecast chasers entities strikeBodies | dropWorldIfBuiltStale chaserStateFor freshVisitState | EXEMPT |
| `poleStates` | 4497 | — | — | advance darkTraps entities | poleStateFor freshVisitState | EXEMPT |
| `talkerStates` | 14514 | — | — | advance entities talkCircles | dropWorldIfBuiltStale freshVisitState talkerStateFor | EXEMPT |
| `lightsExits` | 15584 | — | — | advance | freshVisitState stepLightsNow | EXEMPT |
| `lightsSpearRepeats` | 15593 | — | — | advance | freshVisitState lightsSpearRepeatsNow lightsSlashNow | EXEMPT |

The `…Flags` maps (`bossFlags`, `poleFlags`, `pickupFlags` and others) are save-side mirrors, not per-visit state:
`freshVisitState` does not reset them. They are outside the guard's shapes. The census reads none of them in the
escape's reach (`w0/census-noshadow.txt`, `-` rows).

## 3. D1 — the audit, per map

### The rule, by code

- **IN** when one of the escape's eight members reaches a reader of the map. The only one is `lightsFights`:
  `previewStepper` → `stepOptsFor` → `liveSolidOpts`, which carries `lightTotems: lightTotemsNow()` while ON. That
  is `new Map([[fight.id, {gone: fight.totemGone}]])`, from `lightsFights.get(level)`. `levelWorld`'s solid lookup
  opens a `lightTotemId` solid when `gone` is true (`levelWorld.js:4509-4511`).
  `spinnerForecastWithPress` reaches the same reader through `spinnerCtx` → `liveSolidOpts`.
- **EXEMPT (`UNREAD`)** for the other 30: the members whose reach holds a reader are `advance`, `entities` and the
  other forecasts or getters (`chaserForecast`, `spitForecast`, `grenadeForecast`, `corridorBodyForecast`,
  `arrowForecast`, …). **None of the eight is among them.** Each `DIGEST_EXEMPT` row names those members.
  - `tileWritesByLevel` and `lightsExits` also reach the escape as the `world` that `visitWorld` writes (`place`;
    a `withTileWrites` world hashes as its base plus its own tiles).
  - A turned igneous tile does the same.
- **No map needed `DERIVED` or `LAZY`.** Nothing in the escape's reach builds an exempt map lazily, and
  `lightTotemsNow` does a `get`, never a build.

The brief's wider reach list (forks via `forkRun` / `replayOntoFork`, `previewWalk`, `probeSamples`, the danger
forecasts) is not called from `strikeEscape` / `pressEscape`: `escape-reach` lists 61 functions and none of these.
The census's known limits are DIGEST's: calls are followed by name, and writes through aliases are missed. Readers
are what the digest needs, and readers are not affected by those limits.

### The measured pairs

**The tool.** `tools/audit-hook.py` gives a SCRATCH copy of `levelRun.js` (a detached worktree at `bf259ff199`) a
member `__eval(src)` that runs inside the closure. `tools/audit-pairs.mjs` walks a workload. At each sampled tick, for
each map, it:
1. perturbs the current level's entry in place: every finite number +1, every boolean flipped, 3 levels deep;
2. probes `stateDigest({parts: true})` and the escape's run surface;
3. undoes the perturbation.

**The surface** is DIGEST's surface probe, extended:
- every SPACE_TIME key set previewed 8 ticks deep, from `run.state` **and** from four synthetic states beside every
  special solid (the escape's `state` is its argument, not `run.state`);
- `spinnerForecastWithPress` from three press ticks;
- `gameTimeAt`;
- the weapon;
- the world's text.

The pair is the run before the perturbation and during it: one tick, one body, one world, one clock, and only that
map differs. **The undo was exact in every sample** (the digest equals the base again).

**Two artifacts, measured and removed:**
1. **The first run said `lavaChainStates` moved the surface (16 of 22).** Each chain entry carries `h`, the world's
   own hazard row, so the perturbation edited the world in place. The digest's world memo deliberately cannot see
   that (DIGEST's `world (in place; memo)` row). The tool now skips every object the world holds. With that fix:
   0 of 22.
2. **`blastStates` moved `visit` in 2 of 7 samples** (`r5-l40-part5` and its control, t1650). On the tick a volley
   spawns, a turret's `t.spawned` (in `turretStates`, digested) holds the same blast objects
   (`blastsFor(level).unshift(...t.spawned)`). That is aliasing toward a digested map: the digest SEES the blast, so
   there is no false equal.

**Results** (`d1/pairs/*.json`). The targeted workloads:
- `r9-solve-18`, `axe-l48-reach-l49`, `r3-collect-darksuit`, `ladder2-l104-beam`, all OFF;
- `igneous-l76-k4-stand` and `igneous-l76-leg649`, with `igneousLava` ON;
- `lights-stand` and `lights-solve-sword`, with `lightsBossFight` ON.

Plus every committed tape (280) OFF, every 25 ticks: 7,310 samples, 0 stops.

| map | targeted: perturbed / surface moved | all 280 tapes OFF: perturbed / surface moved | digest parts moved (base) |
|---|---|---|---|
| **`lightsFights`** (IN) | 125 / **123** | 0 / 0 (OFF: always empty) | **— (the false equal)** |
| `spinnerStates` (control, digested) | 253 / 16 | 7,310 / 1,113 | visit, every time |
| `watcherStates` | 125 / **0** | 1,586 / **0** | — |
| `talkerStates` | 0 / 0 | 1,433 / **0** | — |
| `chaserStates` | 26 / **0** | 799 / **0** | — |
| `arrowTrapStates` | — | 462 / **0** | — |
| `bombPusherStates` | — | 455 / **0** | — |
| `shooterStates` | — | 453 / **0** | — |
| `poleStates` | — | 369 / **0** | — |
| `placedGrenadeStates` | — | 321 / **0** | — |
| `darkTrapStates` | — | 258 / **0** | — |
| `staticBodyStates` | — | 212 / **0** | — |
| `spinningAxeStates` | 24 / **0** | 91 / **0** | — |
| `bombStates` | — | 75 / **0** | — |
| `finalBossStates`, `podStates` | — | 63 / **0** each | — |
| `wallFlyerStates` | — | 40 / **0** | — |
| `igneousStates` | 31 / **0** | — | — |
| `lavaChainStates` | 31 / **0** | — | — |
| `spitStates` | — | 25 / **0** | — |
| `wandShotStates` | — | 13 / **0** | — |
| `blastStates` | — | 7 / **0** | visit 2 (aliasing, above) |
| `bossShotStates` | — | 2 / **0** | — |

**Not measured by a pair; exempt by code only:**
- never present at a sampled tick: `drillStates`, `tileWritesByLevel`, `lightsExits`;
- not level-keyed maps, so the tool skips them: the four `owl*` lists, `sealPiece`, `lightsSpearRepeats`.

**`lightsFights`, read plainly.** Under ON, at L69, flipping the fight's fields (`totemGone` among them) changes the
previews from beside the totem. The digest at base does not see it. After D2, the guard row and the differs row
(below) pin that the map is digested. The tool cannot run the after-edit pair: its scratch tree is the base.

## 4. Verify mode, before and after

`tools/verify-batch.sh` runs each workload with `SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1` and the count hook
(XC flip-prep's `xc-count-hook.mjs`, one JSON line per process). The workloads:
- the nine `plan-seedling-hammer-*.mjs --check`;
- `solve-seedling-r9-campaign.mjs --check`;
- the L18 sweep (`sweep-seedling-l18-residues.mjs`, the `sweep` row of `check-seedling-rewind-exactness.mjs --rows`);
- the two ON lights solves (`tools/lights-solve.mjs`, fidelityLights.slow's solves).

It ran in a scratch worktree at `bf259ff199` (BEFORE) and in the tree at `c444f35c48` (AFTER).

| workload | rc | lookups | verified | **mismatches** before / after |
|---|---|---|---|---|
| `plan-seedling-hammer-a-escape` | 0 / 0 | 3,240 | 2,160 | **0 / 0** |
| `plan-seedling-hammer-b1-approach` | 0 / 0 | 2,481 | 1,654 | **0 / 0** |
| `plan-seedling-hammer-b2-fight` | 0 / 0 | 1,545 | 1,030 | **0 / 0** |
| `bw-bombstand`, `c2-ghost`, `d-ghostwall`, `dd-walkkill`, `g1-ghostkill`, `sf-strikefloor` | 0 / 0 | 0 | 0 | 0 / 0 (no adopted run: these call the escape outside `twoPassSolve`) |
| `r9-campaign` | 0 / 0 | 1,626 | 1,084 | **0 / 0** |
| L18 sweep (floor OFF) | 0 / 0 | 56,655 | 37,770 | **0 / 0** |
| lights solves, ON (sword 559 t, spear 361 t, both `tapeEqual: true`) | 0 / 0 | 0 | 0 | 0 / 0 |
| **total** | | **65,547** | **43,698** | **0 / 0** |

- Every count is identical before and after, and `notStoredMoved` is 0 everywhere.
- Every producer's stdout is byte-identical.
- The L18 sweep's norm-md5 is **`de6f6e4e`** both times, which is OFF's value since DIGEST (`verify/l18-norm-md5.txt`).
- The edit cannot move an OFF workload, because `lightsFights` is empty OFF. This table is the measurement that it
  did not.

## 5. D2 — the edit and the guard

**`levelRun.js`** (`c444f35c48`, a 15-line diff):
- `lightsFights` is added to `visit: part({…})`;
- the docblock above `stateDigestParts` gains the DA paragraph: the census count at `bf259ff199`, the one new binding,
  and where the exemptions live;
- `visit`'s own comment names `lightsFights` and `DIGEST_EXEMPT`.

No behaviour change. Nothing else in the file moved.

**`levelRunStateDigest.test.js`** (8 → 11 rows):
- **`DIGEST_EXEMPT`** (exported, 30 rows). Each reason opens `UNREAD: | DERIVED: | LAZY:` and names its fact. The
  table lives **in the test file**, for three reasons:
  - the brief bounds `levelRun.js` to the part lists and their docblocks;
  - a new export there would move the solver-surface and constants censuses for a list only this guard reads;
  - the reasons sit next to the row that checks them.
- **`digestCoverage(src, exempt)`** reads `levelRun.js`'s TEXT. It finds the 55 per-visit names (§2's shapes) and
  every name in each `x: part({…})` of `stateDigestParts`, and returns:
  - `unclassified`;
  - `bothDigestedAndExempt`;
  - `staleExempt`;
  - `badReason`.
- **Row 1, the guard.** Every list is empty. The reader also sees what it should (`spinnerStates` and `lightsFights`
  → `visit`, `clearedByLevel` → `persist`, `clock` → `clock`, `owlRocks` / `sealPiece` / `wandWindows` /
  `grantsByLevel` in the universe).
- **Row 2, the guard's mutants, in-test, on the source text.** Each of these reds the row by name:
  - a new `const fooStates = new Map()` → `['fooStates']`;
  - a new `barFight = null;` in `freshVisitState` → `['barFight']`;
  - `spinnerStates` exempt as well → `bothDigestedAndExempt ['spinnerStates']`;
  - `chaserStates`' row dropped → `['chaserStates']`;
  - a row for a missing name → `staleExempt`;
  - an untyped reason → `badReason`.
- **Row 3, the differs row (the igneous row's shape).** Two runs of `lights-stand` under ON at tick 0, one of them asked
  `entities('lightsFight')`, which lazily builds the fight:
  - the same level (69), state, world and clock;
  - before the ask the digests are equal;
  - after it the parts differ in **`['visit']` alone**, and the unbuilt run's digest is still the base.

**The mutants on `levelRun.js` itself** (applied, run, restored byte-for-byte; `d2/`):

| mutant | red rows | what they say |
|---|---|---|
| `lightsFights` dropped from `visit` | 3 of 11 | guard `unclassified ['lightsFights']`; mutant row `['fooStates','lightsFights']`; differs row `moved = []` |
| `const fooStates = new Map();` declared after `lightsFights` | 2 of 11 | guard `unclassified ['fooStates']`; mutant row `['barFight','fooStates']` |

## 6. D3 — records, gates, CI

- `seedling-bot-log.md`: `### Seedling hammer-phase DA — the digest's visit audit` (with a trap candidate).
- `generate-procgen-reference.mjs`, then `--check`: **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH** (at
  `bb3ebae0` and again at the merge). `generate-docs-index.mjs`: no change.
- **Bounded vitest** (`d3/vitest-bounded.txt`), at `c444f35c48`. The files: `levelRunStateDigest`,
  `escapeCrossPassCache`, `fidelityApFlip`, `solveProgress`, `solveProgressHeartbeat`, `solveProgressTap`,
  `fidelityIgneous`, `fidelityLights`, and `seedlingCanCross` (the one test that reads `levelRun.js`'s path).
  - **9 files, 193 / 193.**
  - At the merge `ed1e35ef`: `levelRunStateDigest` 11 / 11, and `seedlingCanCross` + `jsRuntimeLightsWiring` +
    `escapeCrossPassCache` 42 / 42.
- `census-seedling-solver-surface --check`: **GREEN 335**. `census-seedling-constants --check`: **PASS** (6,528
  literals, 0 new / 0 vanished, 112 moved lines: green drift). Both at `c444f35c48` and at the merge.
- **JSUT.**
  - The push run at `c444f35c48`, run **39634880299**: shards 7,477 + 7,388 + 6,775 → **suite: vitest (unfiltered)
    21,640 passed, 0 skipped, 0 failed**; **slow battery 261 / 261**. The run's overall state then read `cancelled`,
    superseded by the next push after its four vitest jobs had completed `success`.
  - **The run at the last code head `ee4f3fca5f` (the merge + the test comment), run 39637563469:** shards
    7,539 + 7,336 + 6,775 → **suite: vitest (unfiltered) 21,650 passed, 0 skipped, 0 failed**; **slow battery
    261 / 261**. The +10 rows are main's own (`jsRuntimeLightsWiring`, the merge).

## 7. What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-digest-visit-audit-0ys76v`.
2. **"`igneousStates` — a map the escape reads."** By code it is not. Its readers are `renderIgneousNow` (`advance`)
   and `igneousTilesNow` (`entities('igneousTiles')`).
   - A turned tile reaches the escape only through the written `world`, which is digested.
   - Measured: 31 perturbations, 0 surface moves.
   - Fidelity's `dfaa06e240` (IN) is a harmless superset: an extra key component only costs misses, and the map is
     empty OFF. It is **not on main** at my close (main is `2600a606`), so at this head the guard holds it as
     `UNREAD`.
3. **"The `lights*` maps: on a fidelity branch."** They are on `main` (LIGHTS `8b13200c`), and so is the false equal.
   No fidelity branch I could fetch (`fid9-on/lights`; `fidelity-harvest/lights` is on main) adds any lights map to
   `visit`.
4. **`lavaBossFights` / `lavaArenaRocks`.** Neither is in any branch I fetched (`fidelity-fix/*`, `fid9-on/lights`)
   nor on main, so I could not audit them. See residue 3.
5. **The 21 maps.** Re-derived: **22** `…States` maps sit outside every part at `bf259ff199`. That is the brief's 21
   plus `igneousStates`, which the brief counted separately. The full per-visit universe outside the digest is 31:
   those 22, plus `lightsFights`, `lightsExits`, `lightsSpearRepeats`, `tileWritesByLevel`, the four `owl*` lists and
   `sealPiece`.
6. **The reach list** (forks, `previewWalk`, `probeSamples`, the danger forecasts). None of these is called from the
   hammer escape (`d1/escape-reach.txt`). `liveSolidOpts` and the spinner forecast are, through `previewStepper` /
   `spinnerForecastWithPress`.

## 8. Residue and hand-overs

1. **CI at the head.** This report commit is docs and evidence only, so the last code head is `ee4f3fca5f`: green
   (§6, run 39637563469). The planner can read the report head the same way
   (`node scripts/procgen/ci-vitest-summary.mjs <sha> --wait`). No solver code moved, so no divergence sweep is
   owed.
2. **For whoever lands fidelity's `dfaa06e240` (`fidelity-fix/igneous-digest`):** delete `igneousStates`' row from
   `DIGEST_EXEMPT` in the same merge. The guard reds a map that is both digested and exempt, by design. That edit is
   the "choose" (planning-2 relays this).
3. **For fidelity's lava and lights work (planning-2 relays this):** `lavaBossFights`, `lavaArenaRocks` and any further
   `lights*` map arrive on fidelity branches. If one is declared `const …States = new Map()`, `…ByLevel`,
   `…Windows`, or is reset by `freshVisitState`, the guard reds it by name until it is added to a part or given a
   `DIGEST_EXEMPT` row with its fact. Re-run `tools/member-reach.mjs <levelRun.js> --members-of=<name>`: if the
   members include any of the escape's eight, it is IN.
   - ⚠ A per-visit map with another name that `freshVisitState` does not reset is outside the guard's shapes. The
     census is the complete check; the guard is the cheap one.
4. **Latent, not live.** No committed workload calls the hammer escape in L69 under ON. If one ever does, the cache now
   misses where it used to be able to answer wrongly.
5. **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No AS3, wasm, gitlink or
   rules edit. No `git stash`, nothing to `main`, no force-push. `solverBot.js`, `botDriverV1/V2.js`,
   `contactFidelity.js`, `tapeRunner.js` and `flashPanel/*` were read only. No tape, fixture or pin changed.
6. **Tree hygiene.** The scratch worktrees (`wt-base`, `wt-audit`, the latter carrying the `__eval` hook) live under
   the scratchpad and are removed by name at the end. The raw verify stdout (~1 MB) is not committed;
   `tools/verify-batch.sh` reproduces it.
