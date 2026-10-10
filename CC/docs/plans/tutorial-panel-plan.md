# Tutorial Panel — plan

**Date:** 2026-10-10 · **Status:** PLANNED (no code yet)

## The opportunity

A panel that lists tutorials. Once one is chosen it shows the current step's
instructions, ◀ / ▶ to move between steps, and the option to **perform** a step
(or the whole tutorial) automatically. The user's constraint: **no duplicated
content.** The data should be shared with the places that already describe the
app, not copied from them.

## What exists (investigated 2026-10-10)

| Source | Shape | Usable as tutorial data? |
|---|---|---|
| In-app tests (`frontend/modules/tests/testCases/*.js`) | One imperative `testFunction` per `registerTest`; actions, polls and assertions mixed together; by discipline they assert on STATE, not DOM (`tests/README.md` §2) | **No.** There are no steps to pull out. They can *consume* tutorials instead (below). |
| Procgen demos (`frontend/modules/procgenDocs/demos.js`) | A frozen data module with two readers (`demos.html` and `scripts/procgen/check-procgen-demos.mjs`); fields `howToRun`, `whatIsHappening`, `control`, `press`, `keys`, `claim` | **The pattern to copy.** But each entry is one step on a standalone lab page, not the main app. Reused by reference in slice 2. |
| `docs/json/user/guided-tour.md` | Three "stops" of numbered steps in the main app (Maze Room, Playback Bot, Region Graph, Procgen Pipeline …) | **Already a tutorial, written as prose that nothing checks.** It becomes the first tutorial. |
| `metaGame` module | Event orchestration (`user:*` dispatcher hooks, progress bars) | Possibly useful later for detecting what the user did; not the engine. |

## The decision: tutorials are the source, everything else reads them

```
frontend/modules/tutorials/content/*.js   ← the only copy
   ├─ tutorialPanel      renders it: list → step text, ◀ ▶, Do it, Play
   ├─ in-app test row(s) per tutorial: perform every step, assert every done()
   └─ docs/json/user/guided-tour.md   GENERATED from it (⚖ user, 2026-10-10)
```

## User rulings (2026-10-10)

1. **guided-tour.md is GENERATED from the tutorial data.** It still has to read
   well on GitHub.
2. **Automation: both** a per-step "Do it" and a "play the whole tutorial" mode.
   Plus a setting to **auto-advance** (when a step's `done()` turns true, from
   the user's own action or from `perform`), and a setting for the **delay
   between auto-advanced steps**.
3. **First slice** = the panel, the data shape, the guided tour moved in as the
   first tutorial, and its test row. Demo-backed tutorials are slice 2.
4. **Highlighting** the control to press: wanted, but **deferred** until the
   features above are in.
5. **Idea, not committed:** animate a cursor moving to the UI element before
   clicking it. See *Cursor animation* below; it rides with highlighting.

## Data shape (draft)

```js
export const TUTORIAL = Object.freeze({
  id: 'guided-tour',
  title: 'Guided Tour',
  intro: '…',                       // markdown-lite string (procgenDocs/markdownLite.js)
  sections: [                       // = the .md's "## Stop N" headings
    { title: 'Watch a world play itself', steps: [
      { id: 'open-maze-room',
        text: 'Find the **Maze Room** tab and click it.',
        panel: 'mazeRoomPanel',      // "Do it" / Play activates it (ui:activatePanel)
        actions: [ { activate: 'mazeRoomPanel' } ],   // declarative, see below
        done: (ctx) => ctx.isPanelActive('mazeRoomPanel'),
      },
      …
    ] },
  ],
  outro: '…',                       // "Where to go next"
});
```

- **Prose is strings, never HTML.** Rendered through `procgenDocs/markdownLite.js`
  in the panel, and written out unchanged into the `.md`.
- **⚠ `perform` should be DECLARATIVE where it can be:** `actions: [{activate},
  {click: selector}, {key}, {setField}]`, with `run: async (ctx) => …` as an
  escape hatch. This is decided now, not when highlighting arrives, because the
  cursor and highlight features need a *target* to point at, and a free-form
  function has none. Retrofitting every step later is the expensive path.
- **`ctx`, not imports:** the content module must import cleanly in **node**
  (the `.md` generator imports it), so steps reach the app only through the `ctx`
  the panel/test passes in (`eventBus`, `stateManager`, `isPanelActive`,
  `waitFor`). They never `import` browser modules at top level.

## Generating the .md

Follow the existing generated-file pattern (`scripts/quicklaunch/generate-docs-index.mjs`
→ `quickLaunch/generated/docsIndex.js`, pinned by `generated.test.js`):
`scripts/tutorials/generate-tutorial-docs.mjs` writes `guided-tour.md` with a
"GENERATED — edit `frontend/modules/tutorials/content/guidedTour.js`" comment, and a
vitest pin regenerates it and diffs, so a hand edit to the `.md` fails that test.

⚠ The tour's Stop 1 begins "open this link" (`?game=procgen_maze&seed=1`, a page
load). In the panel that step has to load the preset through the presets/rules
API instead of reloading the page. The `.md` keeps the link. So a step may need
a doc-only phrasing and an in-app phrasing; the shape allows an optional
`docText` that overrides `text` for the `.md`. Keep that the exception.

## Panel and settings

- Module `frontend/modules/tutorials/` (`moduleInfo.column: 1`), componentType
  `tutorialPanel`.
- Views: tutorial list → step view (section / step k of n, text, ◀ ▶,
  **Do it**, **▶ Play** / ⏸, a done ✓ indicator).
- Settings schema (`registerSettingsSchema`, as quickLaunch does):
  `autoAdvance` (bool), `autoAdvanceDelayMs` (number). Persist the last
  tutorial id and step index per mode, declared in `moduleInfo.storage`.
- Play = for each remaining step: perform → wait for `done()` → wait the delay →
  advance. Pause stops after the current step.

## Layout

The default preset's left column (`frontend/layout-configs/layout_presets.json`
→ `default`) is ONE stack, width 20. Change it to a `column` of two stacks, with
the existing stack on top and a new stack holding `tutorialPanel` below, so a
tutorial stays visible beside the other left-column panels.
To check while building it:
`mobileLayoutManager.js` reads panel order from this preset and must handle
the nested column; and confirm that no saved layout hides the new stack from
returning users.

## Testing

- One in-app test per tutorial (a `Tutorials` category, in the regression
  roster or the `fast` batch). It starts from a set state (⚖ in-app tests SET
  their own state), runs each step's `actions`/`run` through the same executor
  the panel uses, and asserts each `done()` with `reportCondition` per step. A
  renamed tab or button turns that step's row red.
- Unit (vitest): the data shape validator, the markdown generator pin, and the
  executor with a fake `ctx`.

## Slices

- [ ] **T1** — module + panel (list, step view, ◀ ▶, Do it, Play, the two
  settings) · data shape + validator · `guidedTour.js` (content moved from the
  `.md`) · `.md` generator + pin · in-app test row · layout split.
- [ ] **T2** — demo-backed tutorials: a step may name `demo: '<demos.js id>'`
  and open its `localHref`/`pagesHref` (iframe panel or a new tab) using the
  catalogue's own text, never copying it.
- [ ] **T3** — highlighting: outline the `click`/`activate` target of the step
  (needs DOM selectors in content; the T1 test row already asserts they resolve).
- [ ] **T4 (optional)** — cursor animation, below.

## Cursor animation — feasibility

Practical, and much cheaper once T3 exists, because both need the same thing:
the step's target element. Sketch: a fixed-position overlay cursor element;
for a `click` action, activate the target's panel, `scrollIntoView`, read
`getBoundingClientRect()`, move the cursor there with a CSS transition
(~400 ms), pulse, then `element.click()`. The cases that need thought:

- **A target in a hidden Golden Layout tab:** activate first, wait a frame,
  then measure. The cursor can visibly go to the tab header first, which is
  itself instructive.
- **Iframes** (iframePanel, flash/wasm substrates): same-origin, so add the
  iframe's own rect to the inner element's rect.
- **Canvas targets / key presses** (Maze Room arrow keys): there is no element to
  point at. Show a key-cap toast instead of a cursor.
- **Play mode / tests:** the animation must be skippable (a setting, off in
  tests) so the test row doesn't spend its budget animating.

It is optional because nothing else depends on it; it is not impractical.
