# Seedling watch.html — GROUP B: the renderer, the overlays, and manual-mode text

You are an Opus session for USER-DIRECTED changes to the Seedling procgen lab
page, `frontend/modules/seedlingDemo/watch.html` + `watchViewer.js`. Repo:
`/home/robert/CC/Archipelago-CC` (main checkout; commit direct to `main`; push
when gates are green).

The user handed a batch of eleven changes to a previous session. That session
split them: **Group A** (arm-mount / panel work) is **DONE and pushed** through
`ddc521e8e`. **Group B is yours** — the renderer, the overlay roster and engine
semantics. The split was made because these need `watchOverlays.js`,
`playerPhysicsV2` and the tile vocabulary loaded properly, and two of them need
diagnosis before they can even be sized.

⚠ **THE WORK ORDERS COME FROM THE USER, NOT FROM THIS FILE.** This is a
briefing so their first message lands on a ready session. Greet them with a
short paragraph (what you inherited, what Group B is) and wait.

---

## Read first

1. `docs/json/developer/procgen/seedling-bot.md` — §"The editor arc",
   §"The procgen PoC arc", and §"The switch arc" (the newest; its "Group A"
   subsection is what just shipped).
2. `frontend/modules/seedlingDemo/watchViewer.js`'s own docblock — **THE PAGE'S
   THREE LAWS**, binding on every edit:
   - **TOOLING ONLY** — the page makes no claims; nothing that makes a claim
     may depend on it.
   - **RAW TRUTH** — no interpolation or smoothing; refusals surfaced verbatim;
     unplaceable data REPORTED, never dropped or invented.
   - **NO PRIVATE TICK LOOP** — one loop (`createTapeStepper`), one fold
     (`buildStagedTape`), one run construction, one renderer.
3. `watchOverlays.js` — the layer roster (`OVERLAY_LAYERS`), the per-tick
   sampling, `MARKER_GLYPHS`, and the derivations each layer draws from.

## The five items

**1. The sword is never visible.** ⛓ ALREADY DIAGNOSED, do not re-derive: the
`attacks` layer EXISTS and is ON by default (`OVERLAY_LAYERS`, kind `shape`),
but `attackRectsAt(presses, cursor, level)` filters `p.fired === cursor`, so
the rect is drawn for **exactly one tick** and you blink and miss it. The user
wants the sword's hitbox displayed. The open question is what the engine models
about swing DURATION — find where `presses` rows are recorded (`run.presses`),
what fields they carry (`t`, `fired`, `weapon`, `direction`, `rect`, `hits`),
and whether a swing's active window is derivable rather than assumed. ⚠ If it
is not derivable, say so and offer a bounded display choice (e.g. hold the rect
for N ticks) **labelled as a display choice**, not as the game's timing.

**2. Which box is the player's real hitbox?** ⛓ ANSWERED — relay this, don't
re-derive: `watchViewer.js` draws BOTH, one line apart. The **white filled box
is the real collision hitbox** (`playerBoxAt(x,y)` — the engine's own `HITBOX`
origin/width/height, and the rect `dangerAt` is queried with). The **yellow
outline is `terrainProbeRect(x,y)`** — the same box shifted DOWN by
`checkOffsetY = 1`, the rect `Player.getState()` compares the nearest tile
against to decide the terrain type (`Player.as:660`). It is a diagnostic of
terrain probing, not a collision volume. The user found the overlap confusing;
the honest fixes are a legend entry naming both, or making the probe rect its
own toggleable layer instead of always-on.

**3. A pushed block is still drawn at its starting position.** NOT diagnosed —
this is a real defect and unsized. The `pushables` layer is ON by default and
draws "pushable positions" from the per-tick samples; find whether the sample
is taken before the push resolves, whether the drawn rect comes from the sample
or from the world build (which is per LEVEL and memoised — see `makeWorldFor`),
and fix at the source. ⚠ A world memoised per level will not notice an entity
that moved.

**4. Distinguish pushable blocks from breakable rocks visually.** Renderer /
tile-and-entity vocabulary. `TILE_COLOURS` is by tile TYPE; object solids are
drawn one flat colour (`#55506a`). Whatever you choose must be in the LEGEND —
the page's rule is that a colour nobody can identify is impossible.

**5. Manual mode has no way to display or advance text.** The biggest unknown
in the batch. The user's own suggestion: advance all text automatically in
manual mode. Find what the engine models about dialogue/text state before
proposing anything.

## What Group A just changed (so you are not surprised)

- **The SOURCE selector no longer reloads.** Arms mount and retire in place via
  `watchLifetime` (one lifetime per arm mount: `on` / `guard` / `report` /
  `onRetire`). ⛔ **Every `addEventListener` in `watchViewer.js` must go through
  `lifetime.on`** — `watchLifetime.test.js` asserts the absence STRUCTURALLY
  over the source, and it will fail your commit if you add a bare one. Every
  self-scheduling loop must be `lifetime.guard`ed, and any timer you create
  must be cleared on retire.
- **SOLVE and MANUAL share ONE boot panel.** ⚠ The old element ids are GONE:
  `solveBoot`/`manualBoot` → `#bootBox`, `solveForm`/`manualForm` →
  `#bootForm`, `solveNote`/`manualNote` → `#bootNote`, plus `#bootLevel`,
  `#bootPreset`, `#bootPrev`, `#bootNext`. Arm-specific actions are
  `#solveActions` / `#manualActions` / `#solveGoalLine`.
- **Both arms draw the level on mount** (`previewLevel`) — a single still frame
  with EMPTY sample/marker/press channels, no loop. If you add a layer, decide
  what it draws in that frame; "nothing, because there is no run yet" is a fine
  answer and is what the existing layers do.
- **A level stepper** (`◀ ▶`) walks the atlas's own level list, and the boot
  position is committed / page-chosen / stale-and-declared.
- **`?side=` is a picker** (REPLAY only); leaving the wasm arm blanks its
  iframe.
- `window.__editorLifetime` (a GETTER) reports the live arm, the retired ones,
  the loops each stopped and the listeners each dropped.

## Standing gates — scale to the change, never waive

- `node scripts/procgen/solve-seedling-r8-battery.mjs --check` — the whole
  output must hash to **`1fedb0ab35b7cd74accecf0345bdc893`** (28 PASS, exit 1;
  the two `r8-solve-4` drift rows are STANDING and expected). Run it if
  anything outside pure page files moves. `node … --check 2>&1 | md5sum`.
- **The browser rows.** `check-seedling-editor-{boot,solve,manual,overlays,
  refusal,shapes,world,lanes,export}.mjs` need a dev server on `:8000` (check
  `ss -ltn | grep :8000` first — the user usually keeps one up).
  `check-seedling-editor-{generate,switch}.mjs` bring their own server and
  CANNOT skip. ⛔ The overlay items will touch `overlays`, `shapes` and
  `lanes` directly — those are your acceptance, and a new layer owes new
  claims there.
- `npx vitest run frontend/modules/seedlingDemo/` — **3656 tests** at handoff.
  Run from the REPO ROOT (a `cd` into the module dir makes vitest match
  nothing), on a quiet machine (`cat /proc/loadavg`, load5 < 6): all-timeouts
  red is a machine claim, not a code claim.
- ⛔ `fixtures/` is NEVER written by the page or by tooling.
- `grep -a` for emoji-bearing frontend sources. Never `pgrep`/`pkill` a bare
  pattern (it matches this very shell — bracket it, or use launch-captured
  PIDs). Concurrent sessions share one git index: stage and commit atomically.

## Traps this page keeps teaching (all measured, all recent)

- **A measurement that cannot come out any other way is not a measurement.** A
  row asserting the canvas was drawn compared pixels against the background
  `#101014` — but an untouched canvas is transparent BLACK, differing in all
  three channels, so it scored 102400/102400 and passed on exactly the failure
  it was written to catch.
- **A convenience can quietly overrule a refusal.** The goal pre-fill's first
  cut picked "the first usable option", which killed the page's deliberate
  refusal to choose between two live exits. Ask the function that already
  knows.
- **A settle condition the previous state already satisfies is not a wait.**
- **A structural check that cannot fail against the code it was written for is
  a check of nothing** (a regex whose lookbehind excluded every call site).
- **A claim that flips on the machine is not a claim** — the wasm artifact is
  gitignored and machine-local; this box HAS it, CI does not.
- **A leak witness that is a SNAPSHOT cannot see the leak** — teardown evidence
  lands one tick after the event; use a getter.

## Reporting back

When Group B is done (or when the user stops you), leave the record where the
next session will find it: the tracked section in
`docs/json/developer/procgen/seedling-bot.md`, and a memory file under
`~/.claude/projects/-home-robert-CC-Archipelago-CC/memory/` with a one-line
pointer added to `MEMORY.md`.
