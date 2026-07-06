# JtA Substrate

The JtA substrate (`frontend/modules/jtaSubstrateWrapper/`, id `jta`) hosts the Journey to Ascension fork — an incremental/idle game, included as the `frontend/modules/journey-to-ascension/` git submodule — in a same-origin iframe as a loop-mode substrate.

## Zone-based mapping

JtA is the reference **zone-based** substrate: one AP region = one JtA zone. Instead of procedural build-time hooks, its registry entry exposes `zoneCount: 30` and `synthesizeZonePayload(zoneIdx) → { jtaZone: zoneIdx }`; layout drivers that arrange ordered zones (the shuffled-spiral driver) allocate at most `zoneCount` regions to it and merge the payload fragment with the layout's own fields. The zone count is owned by the JtA build in the `frontend/modules/journey-to-ascension/` submodule (`build/zones.js` — the copy the panel loads) and kept in sync by hand — drift is caught by a runtime warning on `loadZone`, which refuses a bad index. The entry also declares `iframeId: 'jtaSubstrateWrapper'` (so procgenPlayer re-delivers the active region's `jta:loadRegion` after an iframe/page reload) and `victoryItem: 'Victory'`.

`jta:loadRegion` tells the panel which zone to render; the player works the zone's tasks, and the substrate dispatches region transitions on Travel-task completion or exit-choice tasks. The entry's `deserializeWorld` converts the sidecar's exits array into the `Map` keyed by exit name that procgenPlayer's region-transition lookup requires (and `serializeWorld` converts back for sidecar emission).

## Host-side mana brokering

The host module is the broker between the game and loop mode: it pushes initial mana-pool / reset-count state to the in-iframe bridge on `iframe:appReady` and mirrors JtA's energy into gameState's shared mana pool **in both directions** — drains via `jta:bridgeDeductMana` (triggering a loop reset when the pool reaches zero), gains (energy items) via `jta:bridgeGainMana`, and external pool changes pushed back into JtA's energy (the bridge separates its own mirrored deltas from external changes by predicting the echoed pool value). The game spends from the same budget every other substrate does.

Resets propagate both ways too: a game-initiated run end (energy-reset overlay, `auto_continue_energy_reset`, threshold End Run, prestige/Auto-Prestige — the fork fires its energy-reset callback on `doEnergyReset` *and* `doPrestige`) publishes `jta:bridgeEnergyReset`, which the host answers with a loop reset unless one already fired for the same depletion; a host loop reset applies `doEnergyReset` in the game immediately while a jta region is active, or on the next `jta:loadRegion` otherwise.

## Clock and persistence

The host owns the tick clock: the game loop is paused from boot, resumed when the player enters a jta region, and paused again on leaving — no unmirrored background play. Managed sessions persist like standalone play but under their own localStorage slot (`incrementalGameSave_substrate`, see the fork's `getSaveLocation()`): progression *and* automation/mod settings survive reloads, one shared slot across presets, and standalone saves on the same origin are never touched. Host-injected exit tasks are excluded from saves and re-injected on region entry.

## Playback / bot execution

The registry entry exposes a PlaybackController as a host-side proxy (the shared `PlaybackProxy`, on the `jta:playbackControl` channel) that the in-iframe bridge executes: `play`/`stop` map to the game clock, `step`/`instant` to the fork's `stepTick`/`setInstantMode`, `reset` to `doEnergyReset` (which cascades to a loop reset like any game-initiated reset), and `walkTo({kind:'exit', name})` drives the current zone — performing the Travel task when it's enabled, otherwise the next enabled Mandatory task, on the game's own clock — and takes the requested exit on Travel completion (on a completed region it takes the exit directly). `loopSupport.executeVia: 'playbackBot'` makes loops queue `regionMove` actions execute through this path, parking until the resulting `user:regionMove` arrives.

## Capabilities

No AP location checks inside regions yet (`supportedFeatures: ['region_topology_from_source']`); loop support is queueable `regionMove` (bot-executed, see above) plus manual play, without custom queues. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Gotchas](./gotchas.md)
