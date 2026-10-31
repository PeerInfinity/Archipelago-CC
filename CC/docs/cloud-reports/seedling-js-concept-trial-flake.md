# Cloud report: `seedling-js-concept-trial-flake`

The concept trial's Phase A flake, found and fixed.

- **Branch:** `claude/concept-trial-phase-a-flake-yfarje`. The harness pinned this branch, so it replaces
  `seedling-js-concept-trial-flake`.
- **Base:** origin/main `a7d40b84`.
- **Environment:** a cloud container with 4 cores, `session_bootstrap.sh --all` READY, and
  `scripts/serve-nocache.py 8000`.

## Verdict

**(a) A transient accessible render. It is a real UI window, not a settled defect.**

The wrapper builds its world from static data. The static data can reach the iframe before the state snapshot
does. The engine seeds every exit as `accessible: true` (`engine.js` `loadWorld`), and the bridge then skipped the
evaluation:

- `bridge.js` `evaluateAccessibilityForRoom` returned early when `client.getStateSnapshot()` was null.

So the guarded exit painted `tae-link-accessible`, and was clickable, until the snapshot landed. It then flipped to
inaccessible. It never settled wrong.

**Fixed in the app.** Unknown accessibility is now shut. A deterministic browser pin and a unit pin both fail on the
old code.

## 1. Repro rate (at origin/main, before the fix)

| What | Load | N | Result |
|---|---|---|---|
| The gate, `check-concept-trial-play.mjs`, serial | solo | 30 | **0/30** failed |
| The gate, serial | 2 × `node -e 'for(;;){Math.sqrt(Math.random())}'` stress loops | 30 | **0/30** failed |
| The per-frame instrument (below) | solo | 30 | the exit was **accessible at some frame in 1/30** boots |
| The per-frame instrument | the same 2 stress loops | 30 | **2/30** (5 boots did not render inside the probe's 6 s window under load) |

The gate itself did not reproduce here. Its boot `waitFor` polls with `page.evaluate`, and the window is 10–50 ms,
so a poll rarely lands inside it. The instrument sees every frame, so it caught the window every time it opened.
The CI rate of ~3.4% (5 of ~145) is consistent with a poll landing in a window of this size on a loaded shard.

## 2. Classification: the per-frame trace

The instrument is a throwaway Playwright script (not committed). An init script in the text-adventure iframe:

- records the guarded exit's class on every `requestAnimationFrame` and every DOM mutation;
- records every inbound `postMessage` (type and event name, plus the snapshot's inventory).

Times are ms since `goto`.

```
solo, run 1 of 30:
  4589  STATIC_DATA_RESPONSE
  4593  STATIC_DATA_RESPONSE
  4609  cls tae-link-accessible        <- world built from static data; no snapshot yet
  4619  STATE_SNAPSHOT inv {"Progressive Sword":0,...}
  4621  cls tae-link-inaccessible      <- evaluated against the snapshot
under load, run 2:
  5817  STATIC_DATA_RESPONSE
  5843  cls tae-link-accessible
  5857  STATE_SNAPSHOT inv {"Progressive Sword":0,...}
  5858  cls tae-link-inaccessible
under load, run 8:
  5852  STATIC_DATA_RESPONSE
  5868  cls tae-link-accessible        <- 49 ms open, holding no sword
  5917  STATE_SNAPSHOT inv {"Progressive Sword":0,...}
  5919  cls tae-link-inaccessible
```

The boots that passed had the snapshot first. For example, `STATE_SNAPSHOT` came at 4436, and the first render at
4472 was already `tae-link-inaccessible`.

**Why the order varies.**

- **Static data:** the iframe asks with `REQUEST_STATIC_DATA`, and `ensureStaticData` re-asks every 100 ms. The
  answer is one postMessage round trip.
- **The snapshot:** `iframeAdapterCore.handleRequestStateSnapshot` answers only after
  `stateManagerProxy.pingWorker(...)`, which is a round trip to the worker. Under load that is the slower of the two.

**The code that sets the class:**

- `frontend/modules/textAdventureEngine/engine.js`:
  - `loadWorld` seeds `{accessible: true}` for every exit and item.
  - `_renderExit` pushes `tae-link-accessible` or `tae-link-inaccessible`.
  - This file is in a submodule and is not touched.
- `frontend/modules/textAdventureSubstrateWrapper/bridge.js`:
  - `rebuildWorld` calls `engine.loadWorld(w)`, then `applyRegionChange`, then `evaluateAccessibilityForRoom`.
  - Before the fix, `evaluateAccessibilityForRoom` returned early when it had no snapshot or no static data.
  - `applySnapshot`, on `stateManager:snapshotUpdated`, re-evaluates. This is the flip seen at +2 ms in the trace.

**It is a real window, not only a check race.** A click on an accessible exit makes the engine emit `command:move`.
The bridge then shows the exit's PASSED-WITH prose ("You draw your sword and the guardian lunges…") and dispatches
`user:regionMove`, all with no sword held.

## 3. Onset

**No code onset found. The rate is too low to bisect.**

- None of these paths changed on main between 10-28 00:00 and 10-29 11:00 PDT (the first failure was 10-29 17:46Z,
  which is 10:46 PDT):
  - `textAdventureSubstrateWrapper/`
  - `iframeAdapter/`
  - `stateManager/`
  - `procgenPlayer/`
  - `shared/`
  - `textAdventureEngine/`
  - `presets/concept_trial/`
  - `check-concept-trial-play.mjs`
  - `seedlingRoomPlay.js`
  - `ci-arm-costs.json`

  I checked with `git log` after `git fetch --shallow-since=2026-10-27`; the clone is shallow.
- The bridge's skip-when-no-snapshot code is older than this window. The earliest commit visible here touching
  `bridge.js` is the shallow root at 10-25.
- The suspect commit `2e277c1b` ("client: scout every location on connect") runs only on a server `Connected`. The
  gate never connects to a server, so it is not on this path.
- So the race was latent. The onset at 10-29 is most likely a change in timing (runner load, or what runs beside it
  in the `seedling-editor-world +14` shard), not a code change.
- Bisecting is not practical here. The gate reproduced 0/60 locally. Separating a ~3% rate at one commit from 0% at
  another would take on the order of 100 runs per commit, and the instrument shows the same window at any commit
  where the bridge is unchanged.

## 4. The fix

**`frontend/modules/textAdventureSubstrateWrapper/roomAccessibility.js` (new)** is the pure evaluation, moved out of
the bridge.

- With no snapshot, no static data, or a snapshot context that throws, every exit and location of the room is
  reported **inaccessible** (`known: false`). The old code left the engine's accessible default in place.
- A rule that *throws* still defaults to accessible, as the bridge always did. That is a different question from
  "no state yet", and changing it is out of this slice's scope.

**`frontend/modules/textAdventureSubstrateWrapper/bridge.js`:**

- `evaluateAccessibilityForRoom` now goes through `roomAccessibility` and always pushes a value, inaccessible when
  the state is unknown.
- `rebuildWorld`: when there is no current region yet, it now evaluates the start room that `loadWorld` just showed.
  Before, that room kept the engine's accessible defaults.
- `applySnapshot` evaluates `lastSeenRegion ?? world.startRoomId`. Before, it skipped when no region had been seen.
- The header's "Accessibility → deferred (everything accessible by default)" line is updated.

The fix needed no change to the shared rule engine, the state-manager core, the engine submodule or the adapter
client.

**The gate, `scripts/procgen/check-concept-trial-play.mjs`:** Phase A is unchanged and not weakened. It gains a new
**Phase A0, the late snapshot**:

- A second page whose text-adventure iframe holds every snapshot-bearing message (`STATE_SNAPSHOT`, and the
  `stateManager:snapshotUpdated` and `rulesLoaded` event-bus messages) for 1500 ms.
- The world is therefore always built from static data alone.
- Three checks:
  1. The exit renders before any snapshot, and the hold is installed.
  2. The exit **and** its location render `tae-link-inaccessible`.
  3. After release, with no sword held, the exit stays inaccessible.

⚠ **How the hold is installed.** It is spliced into the iframe's HTML through `page.route`, not `addInitScript`.

- The first version used `addInitScript`. Under load it did not reach the iframe's document on 8 of 10 consecutive
  runs: the probe read `held: 0`, and the location had been evaluated against a real snapshot. That would make the
  pin pass or fail by chance.
- The check now also asserts `installed: true`, so a hold that did not install fails loudly.

**Docs:**

- `docs/json/developer/procgen/concepts.md` gains an "Unknown accessibility is shut" bullet.
- The generated reference was regenerated, because the docs index counts moved.
- `generate-procgen-reference.mjs --check` reports **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**.

## 5. The pins and their mutants

| Pin | Fixed code | Mutant | Result on the mutant |
|---|---|---|---|
| Gate Phase A0 (browser, ordering forced) | 10/10 PASS under load, `installed:true, held:1` | `bridge.js` restored from origin/main | **3/3 FAIL**: `{"exit":"…tae-link-accessible","loc":"…tae-link-accessible","installed":true,"released":false,"held":1}` |
| `roomAccessibility.test.js` (6 rows, unit) | 6/6 pass | `known: false` branch returns `all(true)` (the old default) | **3/6 fail**: the three "no state yet" rows |

## 6. Re-measured rate (after the fix, same N, same load)

| What | Load | N | Result |
|---|---|---|---|
| The per-frame instrument | 2 stress loops | 30 | **0/30** boots showed an accessible frame (24 rendered inaccessible first; 6 did not render inside the 6 s window) |
| The gate (with A0) | 2 stress loops | 30 | **0/30** failed (30/30 ALL CHECKS PASSED; Phase A0 reported `installed:true` in all 30) |

Bounded checks run on this branch:

- `npx vitest run frontend/modules/textAdventureSubstrateWrapper/`: 11 files, 153 passed.
- `scripts/procgen/lintGateLabels.test.js`: 14 passed.
- `scripts/procgen/procgenHelpBaseline.test.js` and `scripts/procgen/boxLock.test.js`: 32 passed.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED.
- `check-procgen-help.mjs`: ALL PASS (513 instruments).
- `generate-procgen-reference.mjs --check`: ALL MATCH.
- No unfiltered vitest was run (ruling 52). The suite number comes from CI at the pushed SHA.

## STOPPED / left for the coordinator

- **No submodule edits.** The engine's `loadWorld` default of `accessible: true` stays as it is. The wrapper now
  overrides it before any paint (all synchronously, in the same task), so no submodule change or gitlink bump is
  needed.
- **Not changed:** a rule that *throws* during evaluation still renders accessible (`roomAccessibility`'s
  `evalRule`). That is the bridge's long-standing policy. Flipping it is a separate design question.
- **Measurement hygiene:**
  - My `generate-procgen-reference`/`check-procgen-docs` runs held the box lock while the first after-fix gate loop
    ran, so that loop's rc=1 rows were lock refusals. That loop was discarded and re-run clean; the table above is
    the clean run.
  - A `git stash` round trip (to compare the reference check) briefly reverted the tree during the discarded loop.
    It did not overlap the clean one.
