# Mystery Substrate

The mystery substrate (`frontend/modules/mysteryArchipelago/mysterySubstrateLibrary.js`, id `mystery`) makes one case of the mystery clue game a procgen region: the office. The game is the git submodule `frontend/modules/mystery-clue-game/`, framed as a page by the Mystery Game panel.

This page covers what is built: the registry entry and its build-time half. The runtime half (the panel following the player's region, the lock, the Playback Bot, loop mode) is not built yet, and the last section lists it.

## One case is one region

- Each question of the case is a location of the region.
- Each paper of the case is an item of the world. A paper may be placed anywhere in the world, and a question's check may hold anything.
- The access rules are the case's own: which papers a question needs. The substrate authors no rule.

The case is content, so the substrate generates nothing. It is given a region that already is the case and answers with the region's payload.

## How a world gets a mystery region: top-down

The top-down driver realises the regions of a source world and keeps their rules ([architecture](./architecture.md)). For a mystery region the source is a generated, filled world of the case: its locations carry their items. The committed preset `frontend/presets/mystery_custom_house_fire/` is one. Top-down keeps placements; it does not make them, so the case's bare export (no placements) is not a usable source.

Three calls from the library set a run up:

| Call | What it does |
|---|---|
| `mysteryConfigFromSource(rules, player)` | Reads the case document off the source: its `world[player].slot_data.mystery` block. |
| `entry.applyPipelineConfig({caseDoc, lock})` | Installs the case and the lock for the run. `applyPipelineConfig({})` clears them. |
| `mysteryRegionsOfSource(rules, player)` | The driver's `substrateByRegion` entries: each source region whose location names are exactly the case's. |

The driver then hands `generateZoneForSpecs` the region's locations by their source names. The entry refuses, by name (`MYSTERY_SUBSTRATE_REFUSALS`):

| Reason | When |
|---|---|
| `mystery-no-case-installed` | A region was given to the substrate and no case document is installed. |
| `mystery-case-document-malformed` | The installed document lacks a story, a location map or an item map, or two locations name one question. |
| `mystery-lock-unknown` | The lock is not one of the three below. |
| `mystery-location-is-not-a-question-of-the-case` | The region holds a location the case does not name, so a maze room cannot be given to this substrate. |
| `mystery-question-of-the-case-has-no-location` | The region lacks one of the case's questions. |
| `mystery-payload-malformed` | At load: a sidecar payload with no story or no maps. That region is skipped. |

A source may hold other regions beside the case. Each keeps the substrate the caller gives it, and the exits between them are kept.

## The payload

`MYSTERY_SIDECAR_FIELDS` declares it. Besides the engine's `exits`:

| Field | Meaning |
|---|---|
| `story`, `version`, `case` | The case, its version and its directory for the page's `?case=`. |
| `goal`, `answers` | As the case's export has them, when it has them. |
| `ap_locations` | Question id → location name. The host turns a solved question into a check through it. |
| `papers` | Item name → paper id. An item of the world that is not a key here is not a paper of this case. |
| `lock` | What is locked while the player is not in the region. |

The installed config is also recorded in `procgen_metadata[player].substrate_configs.mystery`.

## The lock

`lock` is the world's rule, not a client setting. It says what is locked while the player is not in the case's region:

| Value | Locked away from the region |
|---|---|
| `actions` (default) | Every player action: linking, trust, and with them answering. Everything can be read anywhere. |
| `new-reading` | The actions, and reading that is new. What was already read stays readable. |
| `everything` | The whole game: it is shown only in the region. |

The logic is the same under all three: the questions are the region's checks either way. The value is written and declared today; nothing enforces it yet.

## Not built yet

- The panel and the bridge still read the slot's `slot_data.mystery`, not the region's payload, and do not follow the player's region. The module is off by default.
- The lock is not enforced, and the page has no read-only mode.
- No Playback Bot controller and no loop-mode support.
- The shuffled spiral and sphere growth cannot place a case: the entry declares no zone table, and top-down does not install a substrate's config by itself, so the caller makes the three calls above.
- No committed preset holds a mystery region.
