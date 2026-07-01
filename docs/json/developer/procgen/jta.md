# JtA Substrate

The JtA substrate (`frontend/modules/jtaSubstrateWrapper/`, id `jta`) hosts the Journey to Ascension fork — an incremental/idle game, included as the `frontend/modules/journey-to-ascension/` git submodule — in a same-origin iframe as a loop-mode substrate.

## Zone-based mapping

JtA is the reference **zone-based** substrate: one AP region = one JtA zone. Instead of procedural build-time hooks, its registry entry exposes `zoneCount: 16` and `synthesizeZonePayload(zoneIdx) → { jtaZone: zoneIdx }`; layout drivers that arrange ordered zones (the shuffled-spiral driver) allocate at most `zoneCount` regions to it and merge the payload fragment with the layout's own fields. The zone count is owned by the JtA build (`iframe_games/journey-to-ascension/build/zones.js`) and kept in sync by hand — drift is caught by a runtime warning on `loadZone`, which refuses a bad index.

`jta:loadRegion` tells the panel which zone to render; the player works the zone's tasks, and the substrate dispatches region transitions on Travel-task completion or exit-choice tasks. The entry's `deserializeWorld` converts the sidecar's exits array into the `Map` keyed by exit name that procgenPlayer's region-transition lookup requires (and `serializeWorld` converts back for sidecar emission).

## Host-side mana brokering

The host module is the broker between the game and loop mode: it pushes initial mana-pool / reset-count state to the in-iframe bridge on `iframe:appReady`, and handles `jta:bridgeDeductMana` events by deducting from gameState's shared mana pool — triggering a loop reset when the pool reaches zero. The game spends from the same budget every other substrate does.

## Capabilities

v1 scope is deliberately minimal: no AP location checks inside regions (`supportedFeatures: ['region_topology_from_source']`), no playback controller (the bot no-ops on JtA regions), and loop support of queueable `regionMove` plus manual play, without custom queues. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Gotchas](./gotchas.md)
