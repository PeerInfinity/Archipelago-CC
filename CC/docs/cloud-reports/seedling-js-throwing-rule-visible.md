# Cloud report: `seedling-js-throwing-rule-visible`

A text-adventure exit or location whose access rule THROWS stays passable (no softlock), but is now visible: a
`console.error` once per evaluation pass, and a marker on the rendered link (⚖ user, 2026-10-30).

- **Branch:** `claude/seedling-js-throwing-rule-visible-s66bxk`. The harness pinned this branch, so it replaces
  `seedling-js-throwing-rule-visible`.
- **Base:** origin/main `65c9ea55`. It contains `roomAccessibility.js`, from concept-trial-flake.
- **Environment:** a cloud container with 4 cores, `session_bootstrap.sh --all` READY, and
  `scripts/serve-nocache.py 8000`.
- **Commits:**
  - `7828cc17`: the code and the pins.
  - `8feda741`: the docs and the regenerated reference.
  - This report is the last commit.

## Files and why

| File | Change |
|---|---|
| `textAdventureSubstrateWrapper/roomAccessibility.js` | `evalRule` still returns `true` on a throw. It now also records the message in the result's new **`ruleErrors: {exits: {id: msg}, items: {id: msg}}`** (the third state). It logs `log('error', 'access rule threw in room "<room>", exit\|location "<id>" — left passable: <msg>', rule)` once per throwing rule per call. Before, it logged at `debug`. Unknown state (no snapshot, no static data, or a context that throws) is unchanged: `known: false`, all shut, and `ruleErrors` empty. |
| `textAdventureSubstrateWrapper/ruleErrorMarker.js` (new) | `markRuleErrors(root, errorsByRoom)` adds or removes the class and the `title` on every `[data-room-id][data-exit-id]` and `[data-room-id][data-item-id]` link. It changes only the DOM and never logs. |
| `textAdventureSubstrateWrapper/bridge.js` | `evaluateAccessibilityForRoom` stores `acc.ruleErrors` in a module-level `ruleErrorsByRoom` map and marks the links at once. The engine re-renders the room as `innerHTML` on every state change, which drops the marker. So a `MutationObserver` on `#app` (`childList` + `subtree`) re-applies it after every render. It runs at the microtask checkpoint, before paint. It changes only attributes, so it never triggers itself. The header comment is updated. |
| `textAdventureSubstrateWrapper/index-iframe.html` | The marker's CSS, inline. `engine.css` is in the submodule. |
| `roomAccessibility.test.js`, `ruleErrorMarker.test.js` (new) | The pins (below). |
| `docs/json/developer/procgen/concepts.md` | A new bullet, *"A rule that throws is passable, and marked"*, after *"Unknown accessibility is shut"*. |
| `docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js` | Regenerated, because the word counts moved. `generate-procgen-reference.mjs --check` reports **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE**. `check-procgen-docs.mjs` reports ALL CHECKS PASSED. |

**No submodule change and no gitlink.** The bridge-override route was enough. There is no change to Seedling,
jsRuntime, the solver, the shared rule engine or the state-manager core.

## The marker

- **Class:** `tae-link-rule-error`, added beside the link's own `tae-link-accessible`. The link keeps its green colour
  and stays clickable.
- **Style:** `text-decoration: underline wavy #d4a017` (amber) with a 3 px underline offset. The cursor is unchanged.
- **Tooltip:** `title="Access rule error (left passable): <message>"`.
- **Measured on the real bridge** (probe below): the guarded exit read
  `tae-link tae-link-exit tae-link-accessible tae-link-rule-error`, with the title
  `Access rule error (left passable): listValue.map is not a function`. A click on it moved the player into
  `region_2_3`, with the PASSED-WITH prose. On the same page without the throwing rule, the exit is inaccessible and
  the guardian blocks the move.

## Pins and their mutants

| Pin | Fixed code | Mutant | Result on the mutant |
|---|---|---|---|
| `roomAccessibility.test.js` › a throwing rule: accessible, and `ruleErrors` carries the message (exit; and a location under `items`) | pass | **M1:** the old `evalRule` (no `ruleErrors` entry, logged at `debug`) | **3/10 fail**: both "carries the message" rows and the log row |
| › a merely FALSE rule: shut, with no ruleError | pass | (guards against marking `false` as an error) | — |
| › unknown state with a rule that would throw: still `known: false`, shut, and `ruleErrors` empty | pass | (the earlier concept-trial-flake pins still cover the `all(true)` mutant) | — |
| › logs at `error` exactly **once per pass**, naming the room, the exit and the message (counts 1, then 2 after a second call) | pass | M1 | fails (0 error lines) |
| `ruleErrorMarker.test.js` › 60 renders: the marker is re-applied each time and **0** `console.error` | pass | **M2:** `markRuleErrors` calls `console.error` when it marks (a log per render or frame) | **1/4 fail** |
| › marks only the throwing link and keeps `tae-link-accessible`; marks a location; clears a stale marker | pass | — | — |

`npx vitest run frontend/modules/textAdventureSubstrateWrapper/`: **12 files, 161 passed**. No unfiltered vitest was
run (ruling 52); the suite number comes from CI at the pushed SHA.

**Browser count: once per pass, not per frame.** This was a throwaway Playwright probe, not committed. It splices a
script into the iframe's HTML, as Phase A0 does. The script rewrites the guarded exit's `access_rule` in the iframe's
`STATIC_DATA_RESPONSE` only, to `{rule: 'List', args: {value: 5}}`. The real evaluator throws on that rule
(`listValue.map is not a function`) on its uncaught Rule Builder path. Over the 3 s after the marker appeared, the
probe counted:

| Code | `access rule threw` lines | `gameState:regionChanged` events (each one is one pass) | `#app` renders | frames | marker |
|---|---|---|---|---|---|
| this branch | **17–18** | 18 | 36–37 | 174–195 | present |
| the mutant (origin/main's `bridge.js` and `roomAccessibility.js`) | **0** | 18 | 35 | 1538 | absent (passable, silent) |

So the line count tracks passes, not renders or frames. ⚠ The boot delivers ~18 `gameState:regionChanged` events in
its first seconds. The same count arrives with no throwing rule (a baseline run), so it is the host's behaviour and not
this change. A throwing rule therefore logs ~18 lines at boot, one per pass. That is per the brief. If it is too noisy,
a follow-up could log only when a pass's message for a link differs from the previous pass's.

## Concept-trial rate

`check-concept-trial-play.mjs`, serial, solo: **16/16 PASSED** (ALL CHECKS PASSED, 28 checks each, Phase A0's 3 checks
passing in every run).

- The first loop gave 4/4 PASS.
- Its runs 5–12 were **box-lock refusals, not results**. My own `check-procgen-docs.mjs` run held the lock (the same
  hygiene problem the concept-trial-flake slice hit). Those runs were discarded.
- A clean 12-run loop, with nothing else running, then gave **12/12 PASS**.

## STOPPED / for the coordinator

- **Nothing STOPPED.** No submodule edit and no design question reached the core.
- ⚠ **A finding outside this slice's scope (state-manager core, not touched):** a rule the evaluator throws on also
  kills the state-manager worker's `loadRules`. With the same `List` rule placed in the served `AP_1_rules.json`, the
  console showed `[stateManagerWorker onmessage] Error processing command: loadRules TypeError: listValue.map is not
  a function`, and the page did not boot the text adventure. So in the real app today, a throwing rule fails earlier,
  in the worker, before the wrapper ever sees it. The wrapper's marker covers a rule the iframe's context throws on
  but the worker's does not. Making the worker tolerate a throwing rule is a state-manager-core design question for
  the coordinator.
- The evaluator's Rule Builder path (`ruleEngine/core.js`, `rule.rule && !rule.type`) is not inside the `try` that
  the AST path has. That is why `List` throws. It is shared rule-engine code, so it is noted and not changed.
