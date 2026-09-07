# Menu Panel Module

**Module ID:** `menuPanel` · **Panel:** `menuPanel` (title "Menu", default layout, beside Loops)

**Purpose:** the **start region's substrate**. Every `rules.json` declares a start
region — `start_regions[<player>].default`, called `Menu` in all 212 committed
presets — with exits and no locations. This panel is what "plays" it: one button
per exit, a Restart that works outside loop mode, and the **skip the menu**
setting.

- User guide: _not yet written_ — see [TODO](../user/modules/TODO.md)
- Arc plan: `NewDocs/plans/menu-panel-plan.md` (gitignored, on disk); tracked
  record in `CC/docs/plans/fable-to-opus-handoff-2026-07.md` §5p.

## Why it exists

Before it, nothing owned that region.

- On a **plain** world the only ways out were the Region Graph's navigation
  clicks and the Exits panel's exit click (`exits` publishes `user:exitClicked`,
  and the `regions` module turns that into a `user:regionMove`). Neither is a
  start screen, and neither is reachable as "restart from the beginning".
- On a **procgen** world `procgenPlayer` synthesizes the `start → first real
  region` hop at load, so the region is never seen at all.
- The only restart affordance was the Loops panel's **Hard Reset**, which is a
  loop-mode control (and until M1 did not clear the path at all — it called
  `trimPath(1)`, passing the number 1 where a region NAME goes).

## Key files

| File | What it is |
|------|-----------|
| `menuPanelEngine.js` | the **whole derivation**, pure — `describeMenu`, `exitsOf`, `firstExitOf`, `restartTargetOf`, `procgenOwnsStartHop`, and the module's exported constants |
| `index.js` | the wiring — registrations, the load handshake, the skip hop, `takeExit`, `restart` |
| `menuPanelUI.js` | the panel; DOM only |
| `menuPanel.css` | the panel's styles |

## ⛔ Nothing here knows the name "Menu"

The panel's whole state machine is `gameState.isStartRegion(currentRegion)`
(`describeMenu`'s `atStartRegion`). A world may call its start region anything,
and `start_regions` is read through
[`procgenCore/rulesGraph.startRegionsOf`](../developer/procgen/architecture.md) —
the one reader for both committed shapes.

## What it shows, and where each field comes from

Everything is derived from the loaded document (⚖ user ruling 2026-09-06:
*"anything game-specific that the menu displays would need to be sourced from
the rules.json file"*). The document arrives on
`stateManager:rawJsonDataLoaded` as `rawJsonData`.

| Shown | Source |
|-------|--------|
| game name | `game_name` |
| seed | `seed_name` |
| start region(s) | `startRegionsOf(doc, playerId).default` |
| one button per exit | `regions[<player>][<current start region>].exits[]` — label is the exit's `name` (falling back to the destination), target is `connected_region`; an exit with no `connected_region` is dropped |
| current position | `gameState.getCurrentRegion()` |
| instructions | one line, no links — the help module does not exist yet (⚖ Q4) |
| Skip the menu | `moduleSettings.menuPanel.skipMenu` |

**alttp's three start options ARE three exits.** `Menu` there carries
`Links House S&Q`, `Sanctuary S&Q` and `Old Man S&Q`, so "one button per exit"
is also the multi-start UI, with no special case.

Away from a start region the panel shows no exit buttons — only the position,
the declared start, and Restart.

## An exit press is a real move

```js
dispatcher.publish('user:regionMove', {
  sourceRegion, targetRegion, exitName, source: 'menuPanel-exit',
}, { initialTarget: 'bottom' });
```

Same shape as `procgenPlayer`'s hop. `menuPanel-*` is a **planning source**
(`loops/loopModeExemptions.js`): pressing an exit is *authoring* the path, like a
region-graph click. Without that classification the M3b strict gate would swallow
the press whenever loop mode is on, and the loop-mode path-append retirement
would drop the entry — so the queue would have nothing to run.

## Skip the menu — one setting, two publishers

`moduleSettings.menuPanel.skipMenu`, declared in this module's settings schema
with **default `true`** (the schema is the default source: `settingsManager
.getSetting` consults it before any call-site fallback). The checkbox in the
panel writes through `settingsManager.updateSetting`.

At load — when **both** `stateManager:rawJsonDataLoaded` and
`stateManager:rulesLoaded` have arrived, so the decision does not depend on which
order they come in:

| skip | world | what happens |
|------|-------|--------------|
| ON | procgen (a warehoused start) | `procgenPlayer` publishes its `procgenPlayer-start` hop; this panel stands down |
| ON | everything else | this panel publishes the start region's FIRST exit as `menuPanel-start` |
| OFF | either | nobody hops; the panel publishes `ui:activatePanel` for itself |

⛔ **Exactly one publisher fires per load**, and the hand-off is not a guess about
the document. This module asks `procgenPlayer.getResolvedStartRegion()`, which is
non-null exactly when procgenPlayer *will* publish — so a procgen-shaped document
whose start does not resolve leaves the hop here, which is correct: otherwise a
skip-ON load would sit at the menu with nobody to move it.

`procgenPlayer` reads the same setting through this module's
`isSkipMenuEnabled()` public function, synchronously, inside its rules-loaded
handler. With `menuPanel` absent from the module set the answer is the schema
default, i.e. procgenPlayer's pre-M1 unconditional hop.

`menuPanel` sits immediately **after** `procgenPlayer` in `modules.json`'s
`loadPriority`, so for any event both subscribe to, procgenPlayer's handler runs
first (the eventBus delivers in subscription order, and modules subscribe in
initialize order).

⚠ Merging the two publishers into one is a named follow-up, not this slice: every
procgen in-app row assumes the auto-hop.

## Restart

**Outside loop mode** — the app's only such affordance:

1. `gameState.clearPath()`;
2. a teleport with the **loops reset's own shape** —
   `user:regionMove {fromReset: true, updatePath: false, source: 'menuPanel-restart'}` —
   to `procgenPlayer.getResolvedStartRegion()` when there is one, else
   `gameState.startRegions[0]`.

Substrate panels bail out of their mana deduction on `fromReset`, and
`procgenPlayer` reloads the substrate's payload, so the panel matches the
position. Mana, XP and discovery are deliberately **untouched** — this restarts
the run, not the save (the Loops panel's Hard Reset is what clears those).

**In loop mode** it delegates to `loopState.restartFromStart({ autoStart: false })`
— the same primitive the Loops panel's own Restart button calls, landing paused
because a menu is not a "go" affordance. Nothing is duplicated here, and the path
in loop mode stays the loops module's business.

A Restart does **not** re-fire the skip hop: the hop is a *load* event, and
leaving the player at the start region with the exits showing is the point (⚖ the
user: *"the way the player resets to the first region when not in loop mode is to
activate the menu panel and press the button to restart from the first region"*).

## Registrations

The three a panel module needs, plus two more this one needs:

| Where | What |
|-------|------|
| `frontend/module-configs/modules.json` | `moduleDefinitions.menuPanel` + `loadPriority` (after `procgenPlayer`) |
| `frontend/layout-configs/layout_presets.json` | the `default` preset, beside `loopsPanel` |
| `frontend/app/core/moduleMetadata.js` | the mobile/fallback `{title, icon, name, column}` |
| `frontend/init-bundled.js` | the bundled-mode import + map entry |
| `register()` | `registerDispatcherSender('user:regionMove', 'bottom', 'first')` and `registerEventBusPublisher('ui:activatePanel')` — the eventBus **drops** a publish from an unregistered publisher (a warn, no delivery), so the skip-OFF self-activation needs both |

The panel class follows the GoldenLayout factory contract: constructor
`(container, componentState, componentType)`, `getRootElement()`, and **no
self-append** (the factory appends it).

## Tests

| Where | What |
|-------|------|
| `menuPanelEngine.test.js` | the derivation, on `alttp` and `adventure` read off disk plus edge documents |
| `index.test.js` | the load handshake in either order, the one-publisher hand-off, skip OFF, the exit press, Restart in both modes |
| `procgenPlayer/index.test.js` | the other publisher's side of the setting |
| `loops/loopModeExemptions.test.js` | `menuPanel-*` classified as authoring |
| `tests/testCases/loopsPanelTests.js` | `loops-real-actions-processed` drives Restart → exit press (in loop mode) → queue → processed; `loops-mana-consumption` drives the Start/Pause labels and asserts mana moves |
