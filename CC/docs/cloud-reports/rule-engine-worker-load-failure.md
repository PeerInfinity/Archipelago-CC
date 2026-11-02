# rule-engine-worker-load-failure: a named load failure when the worker's loadRules throws (option A)

⚖ **Robert, 2026-11-01**: "A: named failure (Recommended)". Asked in `user-decisions-liaison`; js-15 verified it in
that session's transcript. The spec is `rule-engine-catch-and-report.md` § *WORKER ERROR INVESTIGATION*, §4 A.
Options B and C, and C1 (`modeDataLoader`'s silent fallback), are out of scope and untouched.

- Branch `rule-engine-worker-load-failure`, base `efbeb33501` (origin/main at the handshake).
- Code tip `08d55af49f`.
- 160000 rows: **0**. Everything is in the outer repo.

## What changed

**Worker** (`stateManagerWorker.js`, new `core/rulesLoadFailure.js`)
- The `loadRules` case runs `loadRulesOrReport(sm, rulesData, playerId, loadSeq, post)`. It wraps `loadFromJSON`
  and then `getSnapshot` / `getStaticGameData`.
- On a throw it posts `rulesLoadFailed {loadSeq, game, player, phase, where, message, stack}`, then **rethrows**. The
  existing catch therefore still posts the same `workerError`.
- `game` uses the same precedence as `initializeGameLogic`: `world[p].game`, then `game_name`.

**Initialization** (`core/initialization.js`)
- `loadFromJSON` keeps a marker `{phase, where}` on `sm._rulesLoadProgress`. The phase is set before each step:
  - `validateJSONData`;
  - `loadPlayerData`, refined to `loadPlayerData/loadLocations` and `loadPlayerData/loadExits`;
  - `initializeGameLogic`, `inventory`, `loadShops`, `processStartingItems`, `initializeVirtualItems`;
  - `buildIndirectConnections`, `computeReachableRegions`.
- `where` is the region name, set only in the per-region loops of `loadLocations` and `loadExits` (no allocation).
  **Nothing is added to the BFS.** So for C5 and C9, which throw inside the BFS, the phase is `processStartingItems`
  (the first reachability pass) and `where` is null.
- The marker is set to `null` when the load completes, and the worker's catch clears it too. Nothing serialises the
  instance wholesale (a grep for `...this`, `Object.keys(this)` and the like found 0 hits).

**Proxy** (`stateManagerProxy.js`)
- A new `rulesLoadFailed` case:
  - drops an overtaken failure (an older `loadSeq`), the same way it drops an overtaken confirmation;
  - records `lastLoadFailure`;
  - **resolves `initialLoadPromise` with `false`** (the choice accepted at the handshake). It does not reject,
    because `loadRules` is fire-and-forget: a rejection nobody awaits would be an `unhandledrejection`, and
    `ensureReady()` already means "not ready" when it returns false;
  - sets `isPotentialStaleSnapshot = true` (the half-loaded worker publishes no snapshot);
  - publishes `stateManager:loadFailed`.
- **Reload re-arm.** `loadRules` used to re-arm the promise only when `staticDataIsSet`. A failed first load never
  sets that, so a good load after it found the promise already settled to false. It now also re-arms when
  `lastLoadFailure` is set, and then clears `lastLoadFailure`.
- `ensureReady` returns false at once when the promise settled false and a failure is recorded.
- `stateManager/index.js` registers the `stateManager:loadFailed` publisher. Without that, the bus drops the publish.

**Page** (new `app/initialization/rulesLoadFailedNotice.js`, installed in `app/initialization/index.js`)
- A fixed `role="alert"` banner, `#rules-load-failed-banner`, that names the game, player, phase (with the region),
  message and rules source. It also hides the loading screen.
- A second failure replaces the banner rather than stacking another one. A later `stateManager:rulesLoaded` removes it.

## ensureReady callers (js-15 condition 1)

| Caller | What it does after `ensureReady` | On a failed load |
|---|---|---|
| `client/ui/consoleUI.js` 175 / 214 / 241 / 269 / 587 | typed console commands; read `getStaticData()` / `getSnapshot()`, each null-guarded with a printed message | harmless: they print from the proxy caches (null on a first load; the previous game's static data on a reload) |
| `client/ui/mainContentUI.js` 795 / 812 / 848 / 959 / 1028 / 1102 | typed console commands; read the caches, null-guarded | harmless (read-only) |
| `client/ui/mainContentUI.js` 871 | toggles debug mode | harmless (a flag) |
| `timer/timerLogic.js:403` | `_getSnapshotInterface`; returns null when the snapshot or static data is missing | harmless: the snapshot is null after a failure (uiCache is nulled on a reload and never set on a first load) |
| `tests/testController.js:378` | then fetches and loads rules | harmless: that is the re-arm path |
| `client/index.js:465` | **reads** the value; auto-connects only when true | already correct |

⚠ **The key fact.** Every one of these calls uses the default **15 s timeout**, and `ensureReady` answered `false`
on timeout before this slice. So the callers already proceeded on the same half-loaded worker; they just did it
15 s later. The fix changes *when* they proceed, not *what* they find. No guard was added.

The browser row asserts **0 uncaught errors and 0 bus handler errors** in a 750 ms window after the banner. It
allows none. The page summary for the row reads "3 console error(s) … 0 uncaught exception(s)". The three are the
worker's `Error processing command`, the proxy's `Rules load FAILED`, and the proxy's `General worker error`.

## Pins and mutants

Pins (all green at the tip):

- `core/rulesLoadFailure.test.js` (9 tests), on the real StateManager with concept_trial AP_1:
  - C5 and C9 post one `rulesLoadFailed` with game `Procgen Maze`, player `1`, phase `processStartingItems`,
    `where` null, and `message`/`stack` equal to the thrown error's; the original error is rethrown;
  - `locations = [null]` gives `loadPlayerData/loadLocations` with where `region_2_2`;
  - a `getSnapshot` throw gives phase `getSnapshot`;
  - a good load posts nothing and leaves `_rulesLoadProgress === null`, and neither the snapshot nor the static
    data JSON (Maps included) contains the marker's key or its phase names (js-15 condition 2);
  - fail, then a good load, on **one** instance.
- `stateManagerWorker.loadRulesMessages.test.js` (3 tests), the real worker module in node with a stubbed `self`
  (js-15 condition 3):
  - a good load posts exactly `[workerInitializedConfirmation, rulesLoadedConfirmation]`;
  - C5 and C9 post `[…, rulesLoadFailed, workerError]`, and `workerError.errorMessage` equals the failure's message.
- **Identity, measured once against the base.** The same harness drove the base worker (`efbeb33501`) and this one.
  Good loads of concept_trial AP_1 **and ALTTP seed 1** (~0.9 MB of messages) were **deep-equal** with timestamps
  stripped. On C5, the base posts `[init, workerError]`. This tree adds `rulesLoadFailed`, and its `workerError`
  differs from the base's only in `errorStack`, by one extra frame through `loadRulesOrReport`.
- `stateManagerProxy.loadFailed.test.js` (6 tests):
  - `ensureReady` settles false in under 200 ms, whether it was awaited before or after the failure;
  - `stateManager:loadFailed` carries the fields plus `source`;
  - fail then good boots (and waits for the good confirmation rather than returning the settled false);
  - good, then a failed reload, then a good reload boots;
  - an overtaken failure is dropped;
  - a good load publishes exactly `[stateManager:rulesLoaded, stateManager:ready]`. That list was verified against
    the base proxy, where it passes.
- `rulesLoadFailedNotice.test.js` (4 tests): the exact formatter lines, missing fields named as missing, and the
  banner shown, replaced (not stacked), cleared by `rulesLoaded`, and unsubscribed on uninstall.
- In-app row `test_core_rules_load_failed_named`:
  - It follows the page's own load path (`loadRules` + `rawJsonDataLoaded`) with concept_trial AP_1 mutated to C5 in
    memory. The served file is fetched, then mutated, so the worker sees exactly what a broken served file would give it.
  - It asserts: the event fields, the banner text, `ensureReady` false in under 2 s, no uncaught or handler errors,
    and that the restoring ALTTP load boots and removes the banner.
  - Local results: PASSED 1.0 s unbundled, PASSED 1.1 s `--bundled`.

Mutants (each restored afterwards; the red counts are measured):

| Mutant | Red |
|---|---|
| M1 the base worker (the old catch: only `workerError`) | worker-messages test **2/3** (C5, C9); the in-app row **FAILED**: `Timeout waiting for event stateManager:loadFailed` (8.0 s) |
| M2 the helper never posts | **8/12** across rulesLoadFailure + worker-messages |
| M3 the phase markers inert (`enter` a no-op) | **4/12** |
| M4 the marker not cleared on success | **2/9** (rulesLoadFailure) |
| M5 the base proxy | **5/6** (the success-sequence pin stays green: no new event on success) |

## Enrolment

The row is in `playwright_tests_config-regression.json` (category `Core`, order 59, the last row).
- No batch lists `Core`, so the default batch **`fast`** claims it. `npm test -- --test=…` printed
  `→ batch fast`.
- TT runs the regression mode both unbundled and `--bundled` (*Test ALTTP Spoiler & Frontend Regression*).
- Local full regression at the tip: **60/60**, 0 uncaught.

## Gates

- Bounded vitest: `npx vitest run frontend/modules/stateManager frontend/app/initialization frontend/modules/tests`
  → 25 files, **214/214**. The slow tier over `frontend/modules/stateManager` → 1/1. (⚖ 52: no unfiltered local run.)
- CI at `08d55af49f`: see § CI.

## CI

All at headSha `08d55af49f1679c4539cbf13b2913249ecff25aa`, verified per run with `gh run view --json headSha`:

- **Fresh TT** (`workflow_dispatch`) `41352330548`: **success**, first attempt.
  - Jobs: Test ALTTP Spoiler & Frontend Regression (`124985034840`); the substrate batches fast, fast-bundled,
    playback-bot, seedling-js, seedling-wasm and apworld.
  - The regression job's log shows `test_core_rules_load_failed_named PASSED 1.2s` and `totals: 60 run · 60 passed`
    on **both** legs (unbundled, then `--bundled`).
- JSUT (push) `41352326727`: **success**.
- unittests (push) `41352326702`: **success**.

Main moved to `166a15274d` (so-12, maze files only, disjoint) during the slice. The branch keeps its base
`efbeb33501`, so it is **not** a fast-forward of main; js-15's train merges it.

## Landing

(Pending: it rides a js-15 train.)
