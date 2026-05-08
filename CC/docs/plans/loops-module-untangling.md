# Loops Module — Untangling Plan

## Status (as of 2026-05-08)

| Item | Status | Commit |
|---|---|---|
| #5 Phase A — settingsManager persistence | **DONE** | `19a8e762c` |
| #5 Phase B — drop loops localStorage workaround | **DONE** | `8cb20b25c` |
| #5 Phase C — DisplaySettingsBase | **DONE** | `f4fdeb27b` |
| #5 Phase D — optionsPanel verification | **DONE** | (no code change; verified manually 2026-05-08) |
| #3 — Split `_processFrame` | **TODO** | — |
| #6 — Collapse loopState↔gameState shim | **TODO** | — |

Bonus work that landed alongside Phase A-C:
- **Permissive `updateSetting`** (auto-create + warn instead of refuse): `8cb20b25c`
- **`resetToDefaults` uses disk defaults** (lazy `_ensureDefaultsLoaded`): `8cb20b25c`
- **Two-layer settings** (persisted base + session overrides via `{persist: false}`): `f4fdeb27b`
- **Loops/regions persistence fallout fixes** (8 missing `setSetting` calls in regions, `instantMode`/`autoRemoveCompleted`/`autoResumeOnNewAction`/`keepFocused` wired through, Show Undiscovered persistence + initial visibility): `8cb20b25c`, `f4fdeb27b`
- **Loops discovery override migrated to session-only** (no longer leaks to localStorage): `f4fdeb27b`

## Background

The loops module (`frontend/modules/loops/`) accumulated several
"surface area" problems while shipping Phases 1–8 of the loop-mode
substrate integration. After landing the Step button bug fix
(2026-05-07) and adding test coverage that surfaced a related path-
removal bug, three deeper smells stand out as worth a coordinated
refactor.

This plan covers items **#3, #5, and #6** from the post-test-sweep
audit. Items #1 (Step bug fix), #2 (`_beginProcessing` helper), and
#4 (`subscribeIfActive` wrapper) were small enough to land directly
without planning. Item #17 (`removePathEntry` to fix bulk-removal)
also landed already.

The shared theme: **the loops module took on responsibilities that
should live elsewhere or be sharper-edged.** The three items below
are independent enough to land separately, but they reinforce each
other — splitting `_processFrame` (#3) is easier once `loopState` no
longer also owns mana ownership delegation (#6), and clarifying the
persistence story (#5) makes the boundary between `loopState` and
its dependencies less ambiguous.

---

## Item #3 — Split `_processFrame`

### Problem

`loopState._processFrame` (~180 lines, `loopState.js:941-1122`) does
seven things in one method:

1. Bail out if not processing/paused
2. Substrate delegation parking (Phase 6)
3. First-frame `_lastFrameTime` priming + RAF re-schedule
4. Action progress tick (with instant-mode shortcut)
5. Mana deduction
6. XP gain
7. Completion check → `_completeCurrentAction`
8. OOM check → `_resetLoop` (with autoRestart vs. step-mode branching)
9. Progress event publish + RAF re-schedule

The ordering of #7 and #8 was the source of the OOM-after-completion
quirk that surfaced during step-button testing
(`manaReset.test.js:OOM — instantMode + completion + OOM in one frame`).
The early-return at line 1068 (`if (!this.isProcessing) return;`)
silently skips OOM when `_completeCurrentAction` stops processing —
which only happens in step mode or queue completion. In every other
case OOM still fires after completion. This is correct but subtle,
and the next person reading the file will spend 30 minutes
reverse-engineering the ordering.

### Goals

- Make the per-frame contract explicit: each frame either advances
  one in-progress action OR completes one OR triggers one reset.
- Make the OOM-vs-completion ordering self-documenting (named
  helpers instead of a long sequential body).
- Preserve current behavior except where divergence is intentional
  and noted.

### Proposed shape

Split into three private methods called in sequence by `_processFrame`:

```js
_processFrame(timestamp) {
  if (!this.isProcessing || this.isPaused) {
    this._animationFrameId = null;
    return;
  }
  if (this._tickSubstrateDelegation()) return;     // parking branch
  if (!this._primeFrameClock(timestamp)) return;   // first-frame skip

  const deltaTime = (timestamp - this._lastFrameTime) * this.gameSpeed;
  this._lastFrameTime = timestamp;

  try {
    if (!this._tickCurrentAction(deltaTime)) return;  // completed → may stop
    if (!this._tickManaCheck()) return;               // OOM reset → may stop
    this._publishProgressUpdate();
  } catch (error) {
    log('error', 'Error in _processFrame:', error);
    this.stopProcessing();
    return;
  }

  this._animationFrameId = requestAnimationFrame(this._processFrame.bind(this));
}
```

Each helper:

- `_tickSubstrateDelegation()` — returns `true` if we parked this
  frame waiting for substrate completion (caller should bail).
- `_primeFrameClock(timestamp)` — returns `true` if the clock was
  already primed (frame should proceed); `false` if we just primed
  (re-schedules + bails).
- `_tickCurrentAction(deltaTime)` — applies progress, deducts mana,
  awards XP, calls `_completeCurrentAction` if progress hit 100.
  Returns `false` if processing should stop (completion-stops-queue
  or step-mode landing).
- `_tickManaCheck()` — runs `_resetLoop` if OOM. Returns `false` if
  the reset stopped processing (autoRestart=false or step-mode).

### Open question

Should the OOM check still run when `_completeCurrentAction` stops
processing? The current behavior says no — that's the early-return
quirk. There may be a real bug hiding here: if a step-mode action
finishes by hitting OOM exactly on its last frame, the user sees
"queue paused" but mana is at 0, so the next Step click goes nowhere
useful. Worth a separate test to characterize before we decide.

### Risks

- `_processFrame` is called via RAF every frame. Method dispatch
  overhead is negligible but the refactor changes call shape — make
  sure no callers reach into the method's internals (they shouldn't,
  it's named with a leading underscore, but worth checking).
- Behavior change must be **none** except where explicitly
  documented. The OOM-quirk question above is the only place where
  intentional change might be on the table.

### Estimated effort

~2 hours. The helper extractions are mechanical; the coverage we
have (especially `manaReset.test.js`, `stepButton.test.js`) gives a
solid safety net.

---

## Item #5 — Standardize the settings story (settingsManager + per-module DisplaySettings)

### Problem (now confirmed by investigation)

The dual-persistence in `loops/displaySettingsManager` is a
workaround for a missing capability one layer down:
**`settingsManager.saveSettings()` is a stub** (`settingsManager.js:111-129`).
It logs and returns; the TODO comment reads "Implement actual
saving mechanism (e.g., POST to backend)." Every `updateSetting`
call mutates in-memory state and fires `settings:changed` events,
but nothing is written to durable storage.

That single gap creates a cascade of inconsistency:

1. **`loops/displaySettingsManager`** added a side-channel
   localStorage cache (`archipelago_loop_settings` key, written
   directly from the manager) so loop settings actually survive a
   reload. Read path prefers localStorage; write path hits both.
   The inline comment names the workaround:
   > Override with localStorage values (since settingsManager doesn't actually persist)

2. **`regions/displaySettingsManager`** has the *exact same shape*
   minus the localStorage workaround — so region settings reset
   to defaults on every page load. The user may not notice because
   the defaults are reasonable, but per-user customizations don't
   stick.

3. **`optionsPanel/optionsPanelUI`** also reads/writes via
   settingsManager — it has a "JSON editor" view that calls
   `updateSettings()` (bulk replace), a "reset to defaults" button
   that calls `resetToDefaults()`, and ~17 individual
   `getSetting`/`updateSetting` pairs spanning multiple modules
   (colorblind toggles for regions/locations/exits/dungeons/loops,
   inventory display flags, layout mode, etc.). All of these silently
   don't persist. Users editing options through this panel see
   their settings revert on reload.

4. **The two `displaySettingsManager` files duplicate the rest of
   the pattern**: settings cache, prefix-based load via
   `loadPersistedSettings`, `setSetting(key, value, persist)` with
   rollback-on-error, `getSettingsKey` mapping with the same
   `colorblindMode` special case, `handleSettingsChanged` doing
   prefix-match routing. They diverge only in (a) the localStorage
   side channel and (b) syncFromUI/syncToUI bindings to
   module-specific DOM IDs.

### Decision (per user, 2026-05-07)

- **Fix `settingsManager` to actually persist**, via localStorage
  at the settingsManager layer (single namespace, single key shape).
- **Drop the localStorage workaround** from
  `loops/displaySettingsManager` and any equivalent that exists
  elsewhere.
- **Extract a `DisplaySettingsBase` shared by both
  `loops/displaySettingsManager` and `regions/displaySettingsManager`**
  to remove the duplicated cache+load+set+changed-routing code.
  Subclasses keep only the syncFromUI/syncToUI bindings and the
  defaults list.
- **Possible scope extension**: tie `optionsPanel` into the same
  base class so the "JSON editor" and individual setting toggles
  share the persistence path. *Decision below.*

### Background: how settings storage works today

Persistence already exists at the **mode** layer. The app is
mode-keyed: localStorage holds one blob per mode under
`archipelagoToolSuite_modeData_<modeName>`. Each blob contains
`userSettings` (= the same shape as `settings.json`) plus other
mode-scoped data (rules, layoutConfig, dataSources, etc.). The
`lastActiveMode` key records which mode loaded last.

**Load path** (works today): `modeDataLoader` reads
`localStorage[archipelagoToolSuite_modeData_<currentActiveMode>]`,
then `settingsManager.setInitialSettings(combinedData.userSettings)`
seeds the in-memory cache.

**Save path** (broken today): `settingsManager.saveSettings()` is a
stub. The only way settings reach localStorage is through the JSON
panel's "Save to LocalStorage" button (`json/jsonUI.js:900`), which
gathers selected data (`_gatherSelectedData`) and writes the full
mode blob with a fresh `savedTimestamp`. Per-setting toggles in any
panel — including the loops panel's per-setting workaround — never
flow back to the mode blob.

### Phase A — Real persistence in `settingsManager`, keyed by current mode

Implement `saveSettings()` as a **mode-aware** localStorage write:

1. Read the current mode name (sourced from `app:activeModeDetermined`
   event payload at init; stash it on settingsManager as
   `this._currentMode`).
2. Read the existing mode blob from
   `localStorage[archipelagoToolSuite_modeData_<currentMode>]` (it
   may not exist yet — that's fine).
3. Replace the blob's `userSettings` field with the current
   `this.settings`; preserve everything else (rules, layoutConfig,
   dataSources, etc.) untouched.
4. Update `savedTimestamp` and `modeName`.
5. `localStorage.setItem(...)` the merged blob.
6. Update `lastActiveMode` to the current mode (matches what the
   JSON panel does on save).

This keeps the mode-keyed storage shape that the load path and the
JSON panel already use — no new key namespace, no migration. Same
mode contains the same settings on the next reload; switching modes
(via `?mode=…` URL param or page reload) continues to load the
right slot.

The load side stays as-is: `modeDataLoader` already feeds
`userSettings` into `setInitialSettings`. We just need to make the
save side actually save.

**Debouncing**: per-setting toggles can flurry (e.g., user
dragging a slider, or a bulk JSON apply firing many
`updateSetting` calls). Wrap the localStorage write in a small
debounce (~100ms trailing) so a burst becomes one write. The
in-memory cache and `settings:changed` events stay synchronous.

**Auto-save gate**: settings persistence is **always on**
(decided 2026-05-07). Rationale: a setting toggle that doesn't
survive reload is indistinguishable from a bug. If the user wants
experimental sessions that don't pollute their saved mode, the
existing `?mode=reset` URL flow already covers that. A future
toggle for runtime opt-out is possible but not in scope.

**Interaction with the JSON panel**: after this lands, the JSON
panel's "Save to LocalStorage" button is redundant for the
`userSettings` portion of what it gathers — that's now auto-saved.
The button still serves a purpose for the *other* fields it
gathers (rules, layoutConfig, etc.) and for explicit "snapshot
this mode now" intent. No change needed to the button itself; just
note in its label/tooltip that settings already auto-save.

**Risks**:
- Quota: full mode blob can be larger than just settings (rules
  payload included). Still well under localStorage's ~5 MB limit
  in practice, but worth measuring on a large preset (e.g., ALTTP).
- Multi-tab races: writes from one tab don't notify another. Same
  constraint as today; not made worse. Out of scope.
- Serialization: settings round-trip through JSON cleanly — same
  constraint as today's `getSettings()` / `setInitialSettings()`.
- **Mode switching mid-session**: today this requires a page
  reload (URL param), so flushing on switch isn't currently a
  concern. If a runtime mode-switch flow ever appears, that path
  would need to (a) `await saveSettings()` to flush the outgoing
  mode, then (b) re-load `userSettings` from the incoming mode's
  blob. Worth a comment in the code; not a blocker.

### Phase B — Drop the localStorage workaround in `loops/displaySettingsManager`

Once Phase A lands and is verified (load a setting, reload the
page, confirm value persists):

1. Delete `_loadFromLocalStorage` / `_saveToLocalStorage` and the
   `LOOP_SETTINGS_STORAGE_KEY` constant.
2. Remove the `_loadFromLocalStorage()` call from
   `loadPersistedSettings`.
3. Remove the `_saveToLocalStorage()` call from `setSetting`.
4. Update `displaySettingsManager.test.js`: tests that asserted on
   `localStorage.getItem(LOOP_SETTINGS_STORAGE_KEY)` should now
   assert that `settingsManager.updateSetting` was called.

The wildcard handler (`handleSettingsChanged({ key: '*' })`) still
fires correctly because settingsManager publishes
`settings:changed` for every update.

### Phase C — Extract `DisplaySettingsBase`

Two of the three subclasses are loops/regions; optionsPanel may
join in Phase D. Base class shape:

```js
// frontend/modules/commonUI/displaySettingsBase.js
export class DisplaySettingsBase {
  constructor({ moduleId, settingsManager, defaults, rootElement }) {
    this.moduleId = moduleId;
    this.settingsManager = settingsManager;
    this.rootElement = rootElement;
    this.settings = { ...defaults };
  }

  async initialize() {
    await this.loadPersistedSettings();
    this.syncToUI();
  }

  async loadPersistedSettings() {
    for (const key of Object.keys(this.settings)) {
      const settingsKey = this.getSettingsKey(key);
      this.settings[key] = await this.settingsManager.getSetting(
        settingsKey, this.settings[key]);
    }
  }

  getSettingsKey(key) {
    if (key === 'colorblindMode') return `colorblindMode.${this.moduleId}`;
    return `moduleSettings.${this.moduleId}.${key}`;
  }

  getSetting(key) { return this.settings[key]; }

  async setSetting(key, value, persist = true) {
    const oldValue = this.settings[key];
    this.settings[key] = value;
    if (persist) {
      try {
        await this.settingsManager.updateSetting(this.getSettingsKey(key), value);
      } catch (e) {
        this.settings[key] = oldValue;  // rollback
      }
    }
  }

  handleSettingsChanged({ key, value }) {
    if (key === '*') {
      this.loadPersistedSettings().then(() => this.syncToUI());
      return true;
    }
    const myPrefix = `moduleSettings.${this.moduleId}.`;
    const myColorblindKey = `colorblindMode.${this.moduleId}`;
    if (key.startsWith(myPrefix)) {
      const localKey = key.slice(myPrefix.length);
      if (localKey in this.settings) {
        this.settings[localKey] = value;
        this.syncToUI();
        return true;
      }
    }
    if (key === myColorblindKey) {
      this.settings.colorblindMode = value;
      this.syncToUI();
      return true;
    }
    return false;
  }

  // Subclasses MUST implement.
  syncFromUI() { throw new Error('subclass must implement syncFromUI'); }
  syncToUI() { throw new Error('subclass must implement syncToUI'); }
}
```

Each subclass becomes ~30-50 lines of UI binding plus the defaults
object. The shared test fixture from
`loops/displaySettingsManager.test.js` becomes a base test of
`DisplaySettingsBase`; module-specific tests cover only the
syncFromUI/syncToUI behavior.

### Phase D — Optional: integrate `optionsPanel`

OptionsPanel is **not** a per-module display settings store — it's
a cross-module hub that edits settings spanning many modules. It
doesn't fit `DisplaySettingsBase`'s "this module's settings"
contract.

But it **does** suffer the same persistence-stub problem and does
have a similar "load via getSetting → cache → write via
updateSetting" flow. After Phase A, OptionsPanel's edits will start
persisting automatically — no code changes needed for the basic
case. The "JSON editor" view (full-document edit) and "reset to
defaults" already use `updateSettings()` / `resetToDefaults()`,
both of which now actually persist.

**What's not in scope**: collapsing optionsPanel's local
`this.settings` cache or its `getSettingPath(key)` mapper into a
shared structure. That's a real refactor with little payoff —
optionsPanel's settings span many modules with irregular shapes
(`generalSettings.layoutMode` vs `colorblindMode.regions` vs
`moduleSettings.commonUI.showLocationItems`), so a generic mapper
ends up almost as large as the explicit list.

**What might be worth doing**: after Phase A, verify each of
optionsPanel's ~17 settings actually persists by toggling each in
the UI, reloading, and confirming the value sticks. If any silently
don't (e.g., a path that doesn't exist in settings.json so
`updateSetting` returns false at line 189), file as a follow-up.

**Recommendation**: do Phases A + B + C in this work. Defer Phase D
to follow-up unless an obvious quick win surfaces during Phase A
verification.

### Recommended order

1. Phase A (settingsManager persistence) — biggest unlock; verify
   in browser before proceeding
2. Phase B (drop loops localStorage) — small, safe, catches
   regressions Phase A might cause
3. Phase C (DisplaySettingsBase) — pure refactor, has test coverage
4. Phase D (optionsPanel verification only) — quick smoke test, file
   anything that doesn't persist

### Out of scope: `autoSaveMode` / `autoLoadMode`

Considered and rejected (2026-05-07). `autoLoadMode` defaults to
`true` in the shipped `settings.json`, so mode data (including
soon-to-be-saved `userSettings`) does load from localStorage on
startup — Phase A works without touching either flag. `autoSaveMode`
only gates writing `lastActiveMode` and is independent of settings
persistence. Both stay as-is unless they cause a specific problem.

### Risks

- **Cross-module event broadcast**: many modules subscribe to
  `settings:changed`. Phase A doesn't change the event contract,
  but Phase B removes the local localStorage write — verify no
  module reads `archipelago_loop_settings` directly (grep:
  `grep -rn "archipelago_loop_settings" frontend/`).
- **Schema validation**: settings.json defines the structure;
  `updateSetting` refuses to create new paths
  (`settingsManager.js:184`). Phase A inherits this. If we later
  add settings keys that don't exist in settings.json, they'll
  silently fail to save. Worth noting; not a blocker.
- **No migration**: per user instruction (2026-05-07), no
  migration of the legacy `archipelago_loop_settings` key. After
  Phase B lands, that key becomes orphaned in any user's
  localStorage but is harmless. Optionally clean it up in Phase B
  with a one-line `localStorage.removeItem(...)` on first load.

### Estimated effort

Investigation: 1 hour. Fix (depending on option): 1–4 hours.

---

## Item #6 — Collapse `loopState ↔ gameState` accessor shim

### Problem

`loopState.js:124-180` defines ~10 getter/setter accessors that
forward to `gameState`:

| `loopState` property | Forwards to (gameState) |
|---|---|
| `currentMana` | `getCurrentMana` / `currentMana =` |
| `maxMana` | `getMaxMana` / `maxMana =` |
| `manaPerItem` | `manaPerItem` |
| `regionXP` | `regionXP` |
| `manaDebt` | `manaDebt` |
| `noManaDepletionReset` | `noManaDepletionReset` |

These are transitional shims from when mana/XP ownership migrated
out of `loopState` into `gameState` (per memory:
`architecture_loop_mode_substrate.md`, "mana/XP live in gameState
not loopState"). The migration was completed for the storage layer
but not for the call sites — every reader of mana/XP still goes
through `loopState`.

The shim pays a small runtime cost (extra function call per access)
and a large cognitive cost: **"where does this live?"** is now
ambiguous. Tests have to stub both objects. Refactoring either side
risks breaking the other.

### Goals

- Remove ambiguity: `gameState` owns mana/XP storage, callers read
  it directly from `gameState`.
- Eliminate the shim methods; reduce `loopState` surface area.
- Don't break any current behavior.

### Approach

Three phases (each independently shippable):

**Phase A — Audit call sites.**

```bash
grep -rn "loopState\.currentMana\|loopState\.maxMana\|loopState\.regionXP\|loopState\.manaDebt\|loopState\.noManaDepletionReset\|loopState\.manaPerItem" frontend/ --include="*.js"
```

Categorize each into:
1. Internal to `loopState` (rewrite to use `this._gs()` directly)
2. Other modules within the loops package (rewrite to read via
   `gameStateAPI.getCurrentMana()` etc.)
3. Tests (rewrite to read `gs.getCurrentMana()` instead of
   `loopState.currentMana`)
4. UI rendering code (probably reads via `loopState`; rewrite to
   consume `gameState:manaChanged` events directly or read via
   gameState API)

**Phase B — Migrate readers, keep writers temporarily.**

For each call site, change reads to go through `gameState` (or its
public-function API). This is mechanical but touches many files —
expect 50-100 small edits.

**Phase C — Remove the accessors.**

Once no readers remain, delete the getter/setter blocks from
`loopState.js`. Run the test suite. Anything still using the shims
will fail loudly at this point.

### Migration strategy for tests

The test harness in `loopState.test.js` and the new test files
(`stepButton.test.js`, `queueRemoval.test.js`, `manaReset.test.js`)
all use `loopState.currentMana = ...` to set up scenarios. Convert
to `gs.deductMana(...)` / `gs.refillMana()` / direct `gs.currentMana`
assignment. The wired harness already exposes both `loopState` and
`gs` in destructured returns.

### Risks

- Big diff. ~50-100 call sites across `loopUI.js`,
  `loopRenderer.js`, `loopBlockBuilder.js`, the test files.
- Easy to miss a writer that quietly relies on the setter side
  effect. Since the setters in the shim are silent (no event firing
  — see comment at `loopState.js:108`), this is unlikely to cause
  bugs *visible to the user*, but may cause stale UI state if
  someone writes `loopState.currentMana = X` expecting it to fire
  `gameState:manaChanged`.
- This is a refactor with no functional change to the user. If
  schedule pressure exists, this is the lowest-priority of the
  three items.

### Estimated effort

Phase A: 30 minutes. Phase B: 2-4 hours (mechanical). Phase C: 30
minutes + 1 hour test/UI verification. Total: ~5 hours.

---

## Recommended Order

1. **#5 first** (investigation phase): the answers inform whether
   #6's gameState API surface should grow (e.g., a new persistence
   method).
2. **#3 second**: independent of the others, gives us cleaner
   internals to point to during #6's call-site migration.
3. **#6 last**: the largest surface area; benefits from #3's
   internal cleanup and #5's clearer persistence story.

If we're picking only one to land before more bug-finding work,
**#3** has the highest value — it's where the most subtle
behaviors live and where future bug investigations will spend the
most time.

---

## Out of Scope

- **DOM-touching files** (`loopUI.js`, `loopBlockBuilder.js`,
  `loopRenderer.js`) are not addressed here. They're untested and
  large but their issues are different in shape (DOM rendering,
  template construction). A separate plan should cover whether to
  add jsdom for unit testing or rely on Playwright via the Tests
  module.
- **`costGenerator.generate()` end-to-end testability**. The
  pure-helper parts have unit tests; the orchestrator depends on
  ~7 services and is better served by integration tests (Playwright
  driving the real cost-generation UI).
- **Substrate-handoff complexity** (`_handleSubstrateActionCompleted`,
  the `_delegatedAction` dance, the `_completedViaDelegation` flag).
  These have working coverage and a documented design in the
  Phase 6 plan; not currently a pain point.
