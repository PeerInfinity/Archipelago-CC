# Mystery Substrate

The mystery substrate (`frontend/modules/mysteryArchipelago/mysterySubstrateLibrary.js`, id `mystery`) makes one case of the mystery clue game a procgen region: the office. The game is the git submodule `frontend/modules/mystery-clue-game/`, framed as a page by the Mystery Game panel.

This page covers what is built: the registry entry, its build-time half, the bridge and panel reading a case from its region, the Playback Bot's controller, loop mode, and one committed test world. The last section lists what is not built.

## One case is one region

- Each question of the case is a location of the region.
- Each paper of the case is an item of the world. A paper may be placed anywhere in the world, and a question's check may hold anything.
- The access rules are the case's own: which papers a question needs. The substrate authors no rule.

The case is content, so the substrate generates nothing. It is given a region that already is the case and answers with the region's payload.

## Two ways a world gets a mystery region

Top-down realises a source world that already holds the case, with its papers wherever that world's fill put them (below). The shuffled spiral places the office whole, as one self-contained content cell (*The office placed whole*, further down). Sphere growth cannot place a case yet.

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

Under `actions` and `new-reading` the page itself holds the player's actions and new reading back; the host only tells it. The page does this from the game repository's commit `35bb7fe` on (the submodule's pin): away from the office it takes no move, sends no solved question and says so in a line above the page (`body.ap-locked`, `#ap-lock`). Under `new-reading` it shuts every paper not yet begun, since the page keeps no record of when a paper came. The game's own check is `scripts/bridge-lock-check.mjs` in that repository, against its stand-in host. In this app the row `mystery-real-page-lock` reads the real page's mark on the street world: locked in the street, not in the office, locked again after leaving.

## With no server

A mystery world loaded as a preset plays with no Archipelago server. The host answers offline as it does connected (`connected: false`, `game: "offline:<seed>:<player>"`), a solved question is a check in the app's own state, and the item on its location is granted locally. The page starts on a state whose `game` begins `offline:` (from the game repository's commit `7d34080`, the submodule's pin) and keeps a save of its own for it. The feature check `mystery-local-play` (Tutorial panel; walk row `feature-check-mystery-local-play`) loads the committed mystery world, opens Mystery Game and asks the page for its careful reader (`mystery:autoSolve`), which plays the whole case.

## The Playback Bot

⚖ Robert, 2026-11-27: the bot drives the page. The entry's `getPlaybackController` returns the controller `mysteryPlaybackController.js` makes (installed by the module's `index.js`; null headless).

- **A question.** `walkTo({kind: 'location', name})` asks the page for its careful reader on that one question: `mystery:autoSolve {story, question, instant?}`. The page reads, links and answers on its own timeline and sends the solved question as it always does, and the bridge turns that into the check the bot waits for. The page's word comes back as `mystery:autoSolveStatus {story, question, state}` (`running`, `done`, `waiting`, `failed`, `stopped`).
- **The pace.** The Playback Bot calls the controller's optional `setInstant(on)` before each `walkTo` (`playbackBotUI.js`). Instant asks for the question in one burst (`instant: true`); Play leaves the pace to the page. The bot's clock commands (`play`, `step`, `instant`) say nothing of the pace here.
- **The page must be open.** A walk opens the Mystery Game panel when the page has not asked for a state, as Quick Launch would, and waits for it.
- **`inOffice` while it drives.** While a request is open the controller's `walking()` names the region, and the bridge sends `inOffice: true` (`livePlay.botRegion`), so a lock or loop mode's park rule does not stop the reader the bot asked for.
- **One request at a time.** The page sends a solved question before it says `done`, so the bot names its next target while the last request is closing. That target waits its turn and is asked at `done`.
- **Never a silent wait.** A walk the page cannot do ends as `playback:walkFailed` with a named reason (`MYSTERY_WALK_FAILURES`): no page, no answer (asked twice), the page's `failed` or `stopped`, or a `waiting` that lasts `waitingMs`. A target it cannot take at all is refused in `lastRefusal` (`MYSTERY_WALK_REFUSALS`).
- **An exit.** `walkTo({kind: 'exit', name})` publishes `user:regionMove` through the host; the page knows nothing of the world around the case.
- **A loops Bot block** calls `perform`, which always asks for one burst.

## Loop mode

The entry is a coarse substrate, like the text adventure: `loopSupport` offers `regionMove` and `locationCheck` as queue actions, each priced by `loop_costs` and run by the generic executor, with Manual, Record, Playback and Instant. `record` and `playback` arm the strict action gate, so a question is answered by hand only while the queue is parked on the office. A Bot block hands each move and check to the controller's `perform` (`executeVia: 'solver'`), which asks the page for the question in one burst. The mystery page has no time rules of its own.

## The test world

`frontend/presets/mystery_street_test/` is the long case's office beside one maze region, "The street", which holds one of the case's papers. `scripts/test/generate-mystery-street-test-preset.mjs` writes it from the committed mystery world, and `generate-mystery-street-test-preset.test.js` holds the committed file equal to what the generator writes. The in-app row `mystery-region-office-and-street` plays it with a stand-in page. `mystery-playback-bot-plays-the-case` has the Playback Bot play it to the end, and `mystery-playback-bot-loop-mode` does the same in loop mode (the row adds `manaEnabled` and the `loop_costs` block a loop-mode build would write).

## The office placed whole: the shuffled spiral

⚖ Robert, 2026-11-27: the papers stay inside the office. The entry is a spiral content source with one zone, the installed case (`zoneCount`, `extractZoneRules` → `mysteryZoneRules`).

- **What is installed.** `mysteryPlacedConfigFromSource(rulesJson)` reads `{caseDoc, caseWorld}` off a FILLED source world (the committed `mystery_custom_house_fire` preset is one). `caseWorld` is each question's location with the source's own access rule and the item the source's fill put on it, and the class of each item. A bare export, with nothing placed, gives none. `applyPipelineConfig` checks it against the case document (`mystery-case-world-malformed`), and it is recorded in `substrate_configs` like the rest.
- **The region.** Every question keeps its rule and its item, so the case's papers stand on its own questions in an order its rules allow. Nothing outside the office matters to the case, and the case gates nothing outside.
- **The world's items.** The office can hold as many dealt items as it has spare questions, the ones that give its filler (`spiralItemCapacity`). They take those questions in the case's order. More than that is refused (`mystery-more-items-than-spare-questions`).
- **The goal.** Dealt to the office, the world's `Victory` stands where the case's own goal stood. When the engine places the goal elsewhere, the case's own becomes its filler.
- **Starting papers.** The papers a case starts with (the source's `starting_items`) are not items of a spiral world: the spiral has no starting-item channel. No rule names one, and the page holds them itself, so the case plays the same.
- **With nothing installed** the entry reads as having no zone (`zoneCount` 0), no item and no goal, so a quota that names it is refused.

`mysterySubstrateLibrary.test.js` builds a spiral world of three maze rooms and the office and holds its sphere log to every location; the in-app row `mystery-spiral-office-played` builds the same world in the page and has the Playback Bot play it to the end.

## Not built yet

- **Sphere growth** cannot place a case. The office's own chain of papers (a question opens on a paper another question gives) adds spheres the sphere plan did not schedule, and the plan is sphere growth's oracle. It needs the planner's support first, as `itemIntroduction` has for one key. `goalCapability.test.js` lists the entry among the sphere gaps, marked as not built and not as a ruling.
- **Papers out in a spiral or sphere world** (in other regions' locations) are not built: the pipeline's deal does not know which papers a question needs.
- The Procgen Pipeline panel has no control for choosing a case; a caller installs the config (`growthParams.substrateConfig.mystery`, which the stepped spiral's first step applies).
- Top-down does not install a substrate's config by itself, and the Procgen Pipeline panel cannot assign a region to this substrate from a source's case, so a caller makes the three calls above (the generator script does).
