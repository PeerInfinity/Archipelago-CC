# Seedling Flash (Ruffle) save: "Use the save" (default off) and "Clear the Flash save"

Slice `ruffle-save-toggle-clear`. Launched and reviewed by `seedling-js-planning-21` (js-21). It follows train 168
(`js-save-toggle-clear`, `CC/docs/seedling-js-save-toggle-clear.md`), which did the same for the JS runtime's save.

## Summary for Robert

- **The checkbox: "Use the save", for the Flash runtime.** The Flash (Ruffle) game's own save, `…/shrumsave`, is now
  behind a checkbox, **off by default**. Off: the game starts with no save, and nothing it saves is seen by a later
  load. A save stored before is **set aside, not deleted**, and comes back when you turn it on. On: the game reads
  and writes its save exactly as before. The checkbox is in the Flash panel's **Settings** section, shown when the
  Flash runtime is selected on Seedling. A change takes effect at the game's next load (the panel log says so).
- **It is its own setting**, `flashPanel.seedlingRuffleSave`, not the JS one (`flashPanel.seedlingJsSave`). The two
  saves differ: the JS save is one per room; the Flash save is one per site and SWF, shared by every room and seed.
  They also act at different moments (the JS switch acts at once; the Flash one at the game's next boot).
- **The button: "Clear the Flash save".** It sits under the checkbox and removes this page's `…/shrumsave` key and
  the save set aside for it, nothing else. It works on or off, and the panel log says what it removed. A game running
  when you press it keeps its progress until it is loaded again, and nothing it saves after the press is kept.
- **The tutorials press it first** on the Flash runtime. The tutorials that start the game (the three Seedling ones
  and the three procgen ones that start Seedling) run whatever runtime you have set, so their shared "clear the save"
  step now presses whichever button is shown. On wasm, nothing is shown and nothing is pressed.
- **How it works (Ruffle cannot turn its saving off):** right before the game is embedded, the panel moves the stored
  save to a side key, so the game finds none. Anything the game saves while the switch is off is thrown away at the
  next load, before the game can read it. Measured with the real Ruffle 0.7.1 in a browser (below).
- Native Flash Player (Clean Flash) keeps its own save files; the switch cannot reach those, and the panel log says so.

## The measurements (step 1)

Ruffle as the page uses it: `@ruffle-rs/ruffle@0.7.1` from unpkg (`flashPanel/ruffleCdn.js`, `RUFFLE_VERSION`),
loaded as a polyfill into the host page (`ensureRuffleLoaded`) and turned on by the panel's `<object>` embed
(`_embedSwf`). There is no Ruffle config object of the panel's own.

The panel's SWF (`seedling_injected.swf`) is not committed, and the original `598977_Seedling.swf` (and the AP build
`Seedling_ap.swf`) stall headless in the Newgrounds preloader. So I built a **probe SWF** with the Flex SDK (929
bytes) that does what `Main.begin` does: `SharedObject.getLocal("shrumsave")` in its first frame, reports what it saw
through ExternalInterface, adds 1 and `flush()`es. It also has `bump()` (change without flush) and `bumpFlush()`.
Headless Chromium (Playwright 1.63.0) with the npm package `@ruffle-rs/ruffle@0.7.1`. The page replaced
`window.localStorage` with a logging proxy to see every access. Times are ms from page start.

```
[91,"load-call"] [1142,"localStorage-getter"] [1690,"loaded"]
[1692,"get","localhost/swf/probe.swf/shrumsave"]   [1695,"SWF-read",null]
[1700,"set","localhost/swf/probe.swf/shrumsave","AL8AAAAeVENTTwAE…"]   [1701,"SWF-wrote",1]
bump() → 101 (no flush) … reload → [783,"SWF-read",101]       ← unflushed data was written at unload
bump() → 202, element.remove() → two "set" calls inside the removal (synchronous: read back in the same task)
```

- **Which storage:** the host page's `localStorage`. Ruffle reads the `window.localStorage` **getter once**, while it
  builds the player (≈1 s in, before the SWF is fetched), and then works on that object with **indexed access**
  (the wasm-bindgen glue in `core.ruffle.*.js`: `_[key]`, `e[key] = v`, `delete e[key]`). `Storage.prototype.getItem`
  is never called, so a `getItem` patch could not hide a key.
- **Which key:** `<hostname>/<SWF URL path without its leading "/">/shrumsave`. The port is not in it (`localhost`
  while the page was on :8191), and neither is the query (`probe.swf?save=off` gave the same key). For the panel:
  `localhost/frontend/modules/flashPanel/swf/seedling_injected.swf/shrumsave`.
- **When it reads:** at the SWF's `getLocal`, i.e. its first frame, after the player is built and the SWF fetched.
- **When it writes:** at once on `flush()`; and, flushed or not, when the player is removed from the page (inside the
  removal, synchronously) and when the page unloads.
- **Can the host act first?** Yes. The panel builds the player itself (`_embedSwf`), so anything the host does
  synchronously before that call happens before the SWF can read. The old player is removed earlier, in
  `_teardownForReinit` (`swfContainer.innerHTML = ''`), and its write lands inside that removal.
- **Ruffle config:** no option turns SharedObject persistence off (the 0.7.1 bundle has no storage or SharedObject
  setting; `localStorage` appears in `ruffle.js` only for its own save manager UI).

### The mechanism, and why

Of the three candidates in the brief:

1. **A Ruffle config that disables persistence:** there is none in 0.7.1.
2. **A storage shim on the Ruffle side:** Ruffle takes `window.localStorage` itself, once, at player build. A shim
   would mean replacing `window.localStorage` for the whole app across an async window of about a second, and
   proxying indexed access. That is not clean.
3. **Moving the stored value aside before the player starts:** clean, and chosen. It touches one key and its own side
   key, and needs no hook into Ruffle.

The detail that makes (3) safe is that **the side key, not page memory, carries the state.** Ruffle writes at unload,
possibly after any handler of ours, so "put the save back when the page closes" would not hold. Instead:

- **Off, at boot** (`prepareRuffleSave`, called right before `_embedSwf`, after the last await): if no aside key
  exists, the stored save (or `null`) goes to `seedlingRuffleSaveAside_<key>` as `{"saved": …}`, and the save key is
  removed. If an aside key exists, whatever is under the save key was written by an off run, and it is removed. The
  game boots with no save either way.
- **On, at boot:** if an aside key exists, its save goes back under the save key byte for byte (or the key is removed
  when it held none), and the aside key is removed. With no aside key the host reads only that aside key and touches
  nothing: today's behaviour.
- **When the panel removes the player** (`_teardownForReinit`, after `innerHTML = ''`) and on `pagehide`: an off
  run's save is removed at once. This is a courtesy; the next boot is the guarantee.
- If the aside write fails (storage full), the save is **not** removed. That run sees the stored save, the panel log
  says so, and the Storage panel's quota notice is raised (`reportStorageWriteFailure`).

A crash, a killed tab or an unload in any order loses nothing: the next boot reads the same two keys and acts the
same way.

**Runtime toggling:** a change takes effect at the game's next load (a re-init or a page reload). The panel logs
`"Use the save" is now on: it takes effect at the game's next load (this run keeps the save off)`. I did not make it
act at once: that would need a reboot of a running game, which is outside this licence.

## What changed

| File | Change |
|---|---|
| `frontend/modules/flashPanel/seedlingRuffleSave.js` | New. The setting (`RUFFLE_SAVE_SETTING_PROP` `seedlingRuffleSave`, `RUFFLE_SAVE_SETTING_KEY`, `RUFFLE_SAVE_DEFAULT = false`, `ruffleSaveSchemaProps()`); `ruffleSaveKey` (the measured key shape); `ruffleSaveAsideKey`; `prepareRuffleSave`, `endRuffleSaveRun`, `clearRuffleSave`. The header holds the measurements. |
| `frontend/modules/flashPanel/flashPanelUI.js` | A `SETTINGS_CONTROLS` row `{ prop: 'seedlingRuffleSave', label: 'Use the save', when: 'flashSelected' }`, the scope `flashSelected` (the Flash runtime running Seedling, or selected on Seedling or before any game resolves), and the "Clear the Flash save" row (`.flash-panel-ruffle-save-clear`, `data-applies`; 168's row shape). `_initializeFlash` reads the setting before `ensureRuffleLoaded` and calls `_prepareRuffleSave` right before `_embedSwf`. `_teardownForReinit` calls `_endRuffleSaveRun` after the embed is removed. Adds `_ruffleSaveKeyNow` (Seedling only: `shrumsave` is Seedling's), `_onRuffleSaveSettingChanged`, `clearRuffleSave()` (`data-ruffle-save-clear`, `data-ruffle-save-cleared-at`), and the root's `data-ruffle-save` (`on|off:<action>`). |
| `frontend/modules/flashPanel/index.js` | Spreads `ruffleSaveSchemaProps()` into the schema; declares the `seedlingRuffleSaveAside_` prefix to the Storage panel (user kind). The `/shrumsave$` declaration was already there. |
| `frontend/modules/flashPanel/seedlingRuffleSaveToggle.test.js` | New: 15 rows, mutants m1–m9 (below). |
| `frontend/modules/storagePanel/storageCensus.test.js` | The census gains an aside key. The Storage panel's `ownerOf` takes the longest prefix before a pattern, so that key belongs to the aside declaration even though it also ends in `/shrumsave`. |
| `frontend/modules/tutorials/content/steps/procgen.js` | New `clearSeedlingSaves(id)`: 168's two-step group, whose press step also presses **Clear the Flash save** when it is shown (optional). `startSeedlingGame` uses it. `clearSeedlingJsSave` is unchanged for the two JS feature checks. Step ids are unchanged. |
| `docs/json/user/tutorials/{seedling-bot,seedling-multiworld,procgen-seedling,procgen-mixed-world,procgen-loop-mode-everything}.md` | Regenerated (`generate-tutorial-docs.mjs`; `--check`: 24 current). |
| `docs/json/developer/procgen/flash.md` | New subsection *The Flash (Ruffle) save: use it or not, and clear it*. |
| `docs/json/user/modules/flashPanel.md` | The Flash **Use the save** bullet. |
| `frontend/modules/procgenDocs/generated/docsIndex.js`, `docs/json/developer/procgen/README.md` | Regenerated (`generate-procgen-reference.mjs`). |

## The proofs

### OFF / ON with the real Ruffle 0.7.1 (browser)

The probe SWF above, on a page that imports the slice's own `seedlingRuffleSave.js` and calls `prepareRuffleSave`
before it builds the player. The page is the same context throughout, so the storage persists. Each line is one page
load: `prep` is the host's action, `seen` is what the SWF's `getLocal` found, and `wrote` is what it flushed.

```
1 ON   prep=untouched          seen=null  wrote=1   stored=…BAEA                     (no save yet: today)
2 ON   prep=untouched          seen=1     wrote=2   stored=…BAIA                     (today: the save is read)
3 OFF  prep=set-aside          seen=null  wrote=1   aside={"saved":"…BAIA"}          (the save is hidden, set aside)
       bump() → 101, no flush, reload → Ruffle writes 101 at unload
4 OFF  prep=discarded-off-run  seen=null  wrote=1                                    (the unload write is never seen)
       bumpFlush() → 1001 (an OFF run's flushed save)
5 ON   prep=restored           seen=2     wrote=3   aside=gone                       (byte for byte: "…BAIA" came back)
       Clear (live) → {"removed":true,"live":true}; bumpFlush() → 1003 (the running game writes again)
6 ON   prep=restored-none      seen=null  wrote=1                                    (after Clear: no save)
7 OFF  prep=set-aside          seen=null  wrote=1;  bumpFlush() → 1001
8 ON   prep=restored           seen=1     wrote=2                                    (run 6's save is back, run 7's is not)
```

ON is today's behaviour: in lines 1 and 2 the host reads only the aside key (absent) and touches nothing.

### vitest (`flashPanel/seedlingRuffleSaveToggle.test.js`, 15 rows)

Ruffle is modelled as measured: it reads at boot (after the host's prepare), writes at `flush()`, and writes again
at removal and at unload.

- *the setting: a boolean, default OFF, in the panel's schema and its Settings section* (plus the aside prefix declared).
- *the key is Ruffle's, as measured* (hostname without port, path, name; the query is not in it).
- *OFF: the game boots with no save; the stored save is set aside untouched*.
- *OFF: what an OFF run saved is never seen by a later boot, whatever order the unload writes come in*. This covers a
  flush, the removal write, the panel's courtesy, and an unload write that lands after every host handler. Then ON
  brings back the save from before the switch.
- *ON after OFF: the save set aside comes back byte for byte, and the aside key goes* (and OFF with none, then ON:
  still none).
- *ON: today's behaviour — the host reads only the aside key, never touches the save key*. The storage call list is
  exactly `[['get', aside]]`, and the map is unchanged.
- *a save that cannot be set aside is never removed (this run sees it, and the log says so)*.
- Clear: *removes exactly this page's key and its aside key; every other key survives*. The store holds another SWF's
  `/shrumsave` and its aside key, a `seedlingJsSave_` key and an unrelated key; only `remove(key)` and
  `remove(aside)` are called. The rows *with the save set aside*, *during a run* (on and off: the game's later write is
  thrown away at the next boot) and *with no Flash game configured* (no storage touched) also pass.
- The panel (a bare panel, the prototype's own methods): *only Seedling's save* (a Robot Wants Kitty config touches no
  storage); *OFF sets the save aside before the embed, the teardown throws the OFF run's save away; Clear marks the live
  run* (`data-ruffle-save`, `data-ruffle-save-clear`, the `pagehide` listener); *a change of the switch during a run
  says it acts at the next load*; *the panel reads the setting with its default OFF*.

### Mutants (each run; each red by name; the file restored in a `finally` after each)

| Mutant | Red row(s) |
|---|---|
| m1 `RUFFLE_SAVE_DEFAULT = true` | the setting…; the panel reads the setting with its default OFF |
| m1b the schema `default: true` | the setting… |
| m2 `prepareRuffleSave` ignores `on` (never sets aside) | OFF: the game boots with no save…; OFF: what an OFF run saved…; ON after OFF…; a save that cannot be set aside…; the panel: OFF sets the save aside… |
| m3 OFF with an aside key keeps the save key | OFF: what an OFF run saved…; Clear during a run… |
| m4 ON ignores the aside key | ON after OFF…; OFF: what an OFF run saved…; Clear during a run…; the panel: OFF sets the save aside… |
| m5 ON touches the save key with no aside key | ON: today's behaviour…; Clear with the save set aside…; Clear during a run… |
| m6 Clear removes every `/shrumsave` key | Clear removes exactly this page's key… |
| m7 a live Clear does not set the marker | Clear during a run…; the panel: OFF sets the save aside… |
| m8 a failed aside write still removes the save | a save that cannot be set aside is never removed… |
| m9 the panel prepares for a non-Seedling game | the panel: only Seedling's save… |

The run after the mutants was green (15/15).

## Tutorials

Measured with `grep -a -l` under `frontend/modules/tutorials/content/`. **No tutorial file names Ruffle or sets the
Flash runtime** (`-i ruffle`: no file). Only two files set a runtime, `checks/seedlingSlowSolve.js` and
`checks/seedlingSolveProgress.js`, and both set `js`. The tutorials that start the game run whatever runtime the person
has set (`moduleSettings.flashPanel.runtime`, enum `auto | flash | wasm | js`), so they run Ruffle when the person has
chosen `flash`.

| Tutorial / check | Changed? | How |
|---|---|---|
| `seedling-bot`, `seedling-multiworld`, `seedling-whole-game` (`seedling/seedling.js`) | yes | `startSeedlingGame` → `clearSeedlingSaves`; the press step also presses **Clear the Flash save** when it is shown |
| `procgen-seedling`, `procgen-mixed-world`, `procgen-loop-mode-everything` (`procgen/*.js`) | yes | the same, through `startSeedlingGame` |
| `seedling-solve-progress-line`, `seedling-dash-window` (the two JS feature checks) | skipped | they set the JS runtime themselves, so Ruffle never runs; they keep `clearSeedlingJsSave(…, {required: true})` |
| every other tutorial | skipped | none starts the Seedling game |

The press step's text now names both buttons. Its `done` is: neither button is shown (wasm), or a clear happened since
the step began (`data-js-save-cleared-at` or `data-ruffle-save-cleared-at`). Settings is opened only when either
button is in it (`:has(js, ruffle)`).

⚠ **Not rewound** (as for the JS save): the step runs after the world loads. If the person has Flash selected with
the save ON and the panel already open, the game may have read the save before the press. The press then clears the
store and discards what that game saves later, but the game in front of the person keeps its progress. With the
default (off), the game never sees a stored save, so this cannot happen.

## In-app rows that rely on a Ruffle save: none

Searched `frontend/modules/tests/testCases/` (`grep -a`) for `shrumsave`, `ruffleSave`, `SharedObject` and the Flash
runtime rows. The only Flash-runtime row is `seedling-flash-runtime-loop-bot-block-names-its-stop`
(`seedlingJsRuntimeTests.js`). By its own description *"the SWF is not committed, so no game boots"*, so it cannot rely
on a save. The only `/shrumsave` key in a test is `storagePanelTests.js`'s scratch key `__storagePanelTest__/shrumsave`
(a Storage panel row; it is not a save and is not touched by the switch). So no row needs to set the switch ON. What
that row now does in addition: the panel's boot writes an aside marker `{saved:null}` for the panel's key and logs one
`[flash save] the save is off…` line. That key is declared, so the Storage panel's Unknown section stays empty.

## Gates

- Worktree `/home/robert/CC/Archipelago-CC-wt-ruffle-save-toggle-clear` (`new-worktree.sh ruffle-save-toggle-clear
  --with-wasm`), branch `ruffle-save-toggle-clear`. Base: `git merge-base HEAD origin/main` =
  `03872f77c017f9d89703200d9305ba7142f88864`. At packet time `git merge origin/main` said "Already up to date", so the
  gate SHA is the tip.
- Bounded vitest (⚖ 52): every test that imports a touched file, plus the Storage-panel census/pins/model tests,
  `settingsManager.test.js`, `moduleImportOrder.test.js`, `procgenCore/bindingContract.test.js`, the tutorial tests
  and every test that reads the procgen/user docs: **86 files, 2012 tests, all passed**. One listed file was not run,
  `seedlingDemo/jsRuntimeSolverCalibration.slow.test.js`: it is a slow-tier file (the default config excludes it), and
  it matched on a docs path, not an import. CI's slow battery runs it.
- `generate-tutorial-docs.mjs --check`: OK, 24 current. `generate-procgen-reference.mjs` was run.
- `batch-seedling-acceptance.mjs | md5sum` = `391322d681b7aa0229d94b3f6906d024` (unchanged). Engine closure
  (`seedlingDerivedRuleTable.js --print-engine-closure`, 43 files) ∩ diff = ∅. 0 gitlinks; no wasm binary, no
  `vendor/seedling`, no SWF, no preset.
- CI at the tip `273aa818f5` (every run below has headSha `273aa818f5`):
  - **JSUT** push run **44666168736**: success. Suite (`ci-vitest-summary.mjs`): vitest (unfiltered) **29140 passed**,
    0 skipped, 0 failed, in 1378 files; slow battery 438 passed. Against the base's run 44653652961 at `03872f77c0`
    (29125 tests, 1377 files): **+F = 0, +T = 15**, +1 file (`seedlingRuffleSaveToggle.test.js`).
  - **unittests** push run **44666168657**: success.
  - **TT** dispatch (`test-templates.yml`, all jobs) **44666167496**: success. ALTTP spoiler & regression passed, and so
    did every on-push substrate batch:
    - fast: 122/122, HEADROOM OK 305.3 s of 600 s (51%)
    - fast (bundled boot): 122/122, 308.9 s (51%)
    - seedling-js: 37/37, 211.5 s (35%)
    - **seedling-wasm: 12/12, 160.6 s (27%)**. It holds the one Flash/Ruffle row,
      `seedling-flash-runtime-loop-bot-block-names-its-stop`, PASSED 1.9 s.
    - seedling-js-solver 12/12 (31%), playback-bot 15/15 (16%), apworld 142/142 (35%)
  - **tutorials-seedling** (`test-substrates-manual.yml`) **44666170561**: success, 4/4, 303.8 s (51%):
    `tutorial-walk-seedling-recompile`, `tutorial-walk-seedling-bot` (its `start-game-clear-save` step ran),
    `tutorial-walk-seedling-multiworld`, `tutorial-walk-seedling-bot-js`.
  - **feature-checks** (`test-substrates-manual.yml`) **44666173595**: success, 10/10, 66.0 s (11%), including
    `feature-check-seedling-solve-progress-line` and `feature-check-seedling-dash-window` (unchanged JS clear).
  - ⚠ The panel's `[flash save] …` log line is not printed to the CI console, so the Flash row's boot line is not
    quoted here. The row passed, and the Storage panel rows passed in `fast`.

## Residue

- **Not rewound** (above): a game that already read the save keeps it until its next load.
- **The switch acts at the next load, not at once.** Making it act at once would need a reboot of a running game.
- **Two tabs at once:** one tab with the save ON and one OFF, on the same site, share the two keys. The OFF tab sets
  the save aside, and the ON tab's next boot brings it back. Nothing is lost, but each tab's boot decides what the
  other sees next.
- **Native Flash Player** keeps its own `.sol` files, which the switch and the button do not reach; the panel log says
  so when one plays the game.
- **The census's old example key** `localhost/frontend/modules/flashPanel/seedling.swf/shrumsave` is not the panel's
  real key (that is `…/swf/seedling_injected.swf/shrumsave`). It still matches the declaration, so I left it.
- **The proof is a probe SWF, not Seedling itself.** The panel's SWF is not committed, and the original stalls headless
  in its Newgrounds preloader. The probe does what `Main.begin` does with the same SharedObject name, and the mechanism
  depends only on the key and the moment of the read, not on the game's data.
