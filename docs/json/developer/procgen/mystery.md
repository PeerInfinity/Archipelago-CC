# Mystery Substrate

The mystery substrate (`frontend/modules/mysteryArchipelago/mysterySubstrateLibrary.js`, id `mystery`) makes one case of the mystery clue game a procgen region: the office. The game is the git submodule `frontend/modules/mystery-clue-game/`, framed as a page by the Mystery Game panel.

This page covers what is built: the registry entry, its build-time half, the bridge and panel reading a case from its region, the Playback Bot's controller, loop mode, and one committed test world. The last section lists what is not built.

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

The entry declares `ownContentOnly`, so no driver or editor offers it as a target for a planned region: only a caller that names the case's region reaches it.

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

The logic is the same under all three: the questions are the region's checks either way.

## At play

The module `mysteryArchipelago` is on by default, so the entry and the bridge are there at boot. Its panel (Mystery Game) is not in the layout; Quick Launch opens it.

- **Which case.** `currentMysteryBlock` (`mysteryArchipelagoLogic.js`) answers the page about a `mystery` region of the loaded world when there is one, read off the runtime player's warehouse. A world with no such region falls back to its slot's `slot_data.mystery` (the committed non-generated world). Among several cases it takes the story the page asked for, else the region the player is in, else the first.
- **The state.** For a region's case `mystery:state` carries two more fields: `lock`, and `inOffice` (whether the player is in the case's region and may play it by hand). A new state goes out when the player moves (`procgen:activeSubstrateChanged`). A slot's case carries neither.
- **In loop mode** `inOffice` is true only while the Loops queue is parked for live play on the office (`inOfficeNow`, from the loops public functions `isLoopModeActive` and `livePlayRegion`). At any other time the strict action gate would refuse the check, so the page is told not to offer it. The events in `LIVE_PLAY_EVENTS` re-send the state.
- **Answering.** A `mystery:questionSolved` that arrives while `inOffice` is false is not turned into a check, under every lock. The page sends a solved question again while the state lacks it, so it is checked once the player is back.
- **The panel** frames the region's case and follows the player. Under `everything` it frames the case only in its region and says where the office is otherwise.

Under `actions` and `new-reading` the page itself holds the player's actions and new reading back; the host only tells it. The page does this from the game repository's commit `35bb7fe` on (the submodule's pin): away from the office it takes no move, sends no solved question and says so in a line above the page (`body.ap-locked`, `#ap-lock`). Under `new-reading` it shuts every paper not yet begun, since the page keeps no record of when a paper came. The game's own check is `scripts/bridge-lock-check.mjs` in that repository, against its stand-in host. No in-app row reads the real page's lock: the page waits for a connected state before it starts, and the in-app rows run with no server.

## The Playback Bot

The entry's `getPlaybackController` returns the controller `mysteryPlaybackController.js` makes (installed by the module's `index.js`; null headless). It answers through the host and does not work the page: `walkTo({kind: 'location', name})` publishes `user:locationCheck` for a question's location, and `walkTo({kind: 'exit', name})` publishes `user:regionMove` to the exit's target. The check is not marked `reportedByGame`, so the client's logic gate applies: a question whose papers are not held is not checked. Each target lands in one step. What it cannot take it refuses by name in `lastRefusal` (`MYSTERY_WALK_REFUSALS`). The page learns a question is solved from the next `mystery:state`.

## Loop mode

The entry is a coarse substrate, like the text adventure: `loopSupport` offers `regionMove` and `locationCheck` as queue actions, each priced by `loop_costs` and run by the generic executor, with Manual, Record, Playback and Instant. `record` and `playback` arm the strict action gate, so a question is answered by hand only while the queue is parked on the office. A Bot block hands each move and check to the controller (`executeVia: 'solver'`; `botActsAtOnce`). The mystery page has no time rules of its own.

## The test world

`frontend/presets/mystery_street_test/` is the long case's office beside one maze region, "The street", which holds one of the case's papers. `scripts/test/generate-mystery-street-test-preset.mjs` writes it from the committed mystery world, and `generate-mystery-street-test-preset.test.js` holds the committed file equal to what the generator writes. The in-app row `mystery-region-office-and-street` plays it with a stand-in page. `mystery-playback-bot-plays-the-case` has the Playback Bot play it to the end, and `mystery-playback-bot-loop-mode` does the same in loop mode (the row adds `manaEnabled` and the `loop_costs` block a loop-mode build would write).

## Not built yet

- The shuffled spiral and sphere growth cannot place a case: the entry declares no zone table.
- Top-down does not install a substrate's config by itself, and the Procgen Pipeline panel cannot assign a region to this substrate from a source's case, so a caller makes the three calls above (the generator script does).
