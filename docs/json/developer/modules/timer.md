### Module: `Timer`

-   **ID:** `timer`
-   **Purpose:** The location-check timer: on a (random, configurable) delay it checks the locations that are reachable now, until nothing new is. It is **headless** — it has no UI of its own. The [Playback Bot](../../user/modules/playbackBot.md)'s **Check next: Any reachable location (timer)** mode is its UI: the bot's ▶ / ⏭ call `begin()`, ⏯ calls `determineAndDispatchQuickCheck()`, ⏹ / ↺ call `stop()`.

---

#### Key Files

-   `frontend/modules/timer/index.js`: The module's entry point: registration, the settings schema, and the `TimerLogic` instance.
-   `frontend/modules/timer/timerLogic.js`: The `TimerLogic` class: the timer loop, the delays, and picking the next location to check.

The "Checked: …, Reachable: …" counter that used to sit beside the timer's buttons is `frontend/modules/commonUI/checksLine.js`, a widget the Console mounts.

#### Responsibilities

-   **Timer loop:** `begin()` starts it; each tick waits a random delay in `[minCheckDelay, maxCheckDelay]` seconds (0 by default: as fast as it can), then checks. It stops by itself once every manually-checkable location is checked, or when nothing is reachable (after a short grace period in zero-delay mode, so a just-received item can land).
-   **Location checking:** With the **Batch location checks** setting on (the default) a tick checks every accessible, unchecked location at once (`stateManager.batchCheckLocations`, and `client.sendBatchLocationChecks` when online). With it off, a tick dispatches one `user:locationCheck`, so loop mode's Loops panel can steer it.
-   **Quick check:** `determineAndDispatchQuickCheck()` dispatches one `user:locationCheck` for the first accessible, unchecked location, and returns whether it found one.
-   Every `user:locationCheck` it dispatches carries `fromBot: true`, so the Playback Bot's **Route clicks to bot** intercept passes it through.

#### Events Published

-   **`eventBus`**:
    -   `timer:started`: When a countdown to the next check begins (the bot reads it as "running").
    -   `timer:stopped`: When the timer is stopped or finishes.
    -   `timer:progressUpdate`: Periodically while running (nothing draws it at present).
    -   `ui:notification`: Quick-check and delay messages.
-   **`eventDispatcher`**:
    -   `user:locationCheck`: Each check it makes (unbatched ticks and quick checks).

#### Events Subscribed To

-   **`eventBus`**: `settings:changed` — keeps `batchChecks` live.

#### Public Functions (`centralRegistry`)

-   **`getTimerLogic()`:** The `TimerLogic` instance (the Playback Bot panel drives it through this; the timer tests too).
-   **`setCheckDelay(min, max)`:** For the Console's `/set_delay` command.

#### Dependencies & Interactions

-   **StateManager**: Reads the snapshot and static data to find which locations are accessible and unchecked.
-   **EventDispatcher**: Initiates `user:locationCheck`, the core action for checking a location.
-   **Playback Bot**: Its panel builds the bot's `timer` dependency from `getTimerLogic()` and `timer:started` / `timer:stopped`.
