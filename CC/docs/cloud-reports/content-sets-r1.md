# Content sets R1: the text adventure loads its content from its default pack (as built)

Branch `content-r1`, based on `origin/content-c4` (`3b56693da3`). `origin/main` did not contain `3b56693da3` when this
slice began. Three code commits, then this report:

| Commit | Part |
|---|---|
| `5a18d3916d` | 1. the default pack `frontend/packs/text-adventure/`, registered in `packs.json` |
| `7867ac092e` | 2–5. the declaration, the consumer, room places, the bridge, the first declarer's pins, the tests, the in-app row |
| `1778cd770f` | 5. docs: the two registry paragraphs become table rows; `text-adventure.md` § Content roles; regenerated; link census |

No gitlink moved. No submodule was edited (`frontend/modules/shared/` and `frontend/modules/textAdventureEngine/` are
untouched). No second pack was added under `frontend/packs/`.

## 1. The pack

`frontend/packs/text-adventure/` (id `text-adventure`, which `PACK_ID_PATTERN` allows; the key namespace is the same
string). Hand-made, MIT, credited to this repository's authors (`pack.json`). Layers: `concepts`, `text`. No art.

**Text layer** (`text/manifest.json`, `strings` only), the six strings the generation wrote from
`textAdventureConceptRealisations.js` until this slice, moved byte for byte (the file was written by a script that
imported the old module and copied each value):

| Key | Was |
|---|---|
| `text-adventure:concept/sword/checkMessage` | `sword.prose.checkMessage` |
| `text-adventure:concept/swim/checkMessage` | `swim.prose.checkMessage` |
| `text-adventure:concept/guardian/blocked`, `…/passedWith` | `guardian.placements.gate.mechanic.prose.*` |
| `text-adventure:concept/water/blocked`, `…/passedWith` | `water.placements.gate.mechanic.prose.*` |

No other generated line exists: measured over the room module, the room core writes ids only (`exit`, `exit_<i>`), and
location names come from `makeLocationName` (an AP name, so logic). Every other string of the text adventure is
written at PLAY (§6).

**Concepts layer** (`concepts/manifest.json`), one per mechanic concept the entry realises, each with a `name`, a
one-line `description`, `presents` and its text slots:

| Key | Kind | Presents | Text slots |
|---|---|---|---|
| `text-adventure:object/sword` | object | `sword` | `checkMessage` |
| `text-adventure:object/swim` | object | `swim` | `checkMessage` |
| `text-adventure:character/guardian` | character | `guardian` | `blocked`, `passedWith` |
| `text-adventure:object/water` | object | `water` | `blocked`, `passedWith` |

`packs.json` lists it; its `content` table stays empty (a default pack is in a world's stack without being named
there; the `_comment` says so). `frontend/packs/README.md` describes it and narrows "both packs are GENERATED" to the
two generated ones. The three extractor `--check`s (art, sfx, music) still pass.

## 2. The declaration

`textAdventureSubstrateWrapperLibrary.js` declares `defaultContentPack: 'text-adventure'` and `contentRoles`, both
defined beside the realisations in `textAdventureConceptRealisations.js` (node-importable data):

| Role | `accepts` | `needs` | `why` |
|---|---|---|---|
| `gate` | `presents: [guardian, water]` | `text: [blocked, passedWith]` | A gated exit the rule selected a concept for says why it is shut and how it was passed. |
| `item` | `presents: [sword, swim]` | `text: [checkMessage]` | The location that holds an offered item concept says what the player found. |
| `place` | `kinds: [place]` | — | A room takes a place's name and description in place of its region id. |

- **Two presented-mechanic roles, not one** (a delta from the brief's single "presented-mechanic role"): a gate and a
  found item need different slots, and a role has one `needs.text`.
- Each `needs.text` is `Object.keys` of a slot table (`GATE_PROSE_SLOTS = {blocked: 'inaccessibleMessage', passedWith:
  'moveMessage'}`, `ITEM_PROSE_SLOTS = {checkMessage: 'checkMessage'}`). The tables are what a slot MEANS, so they are
  code (Q6), and a role cannot ask for a slot the placer does not write.
- `character` and `info` are not declared (nothing shows them in this slice).
- The realisations keep the logic half only: `sword`/`swim` are `{tier: 'mechanic'}`; `guardian`/`water` keep
  `placements.gate = {effect: 'requires', needs: [...]}` with no `mechanic` object.

## 3. The consumer

`textAdventureRoom.js`:

- **`presentedProse(contentSet, roleId, conceptId)`** (exported): the keys `candidatesForRole` gives for the role
  (`roleRefusal` filters kind/`presents`/slot presence), narrowed to those presenting `conceptId`, sorted by their
  pack's position in `contentSet.ids`, latest first; the first whose every slot resolves through
  `text.string(key)` wins. So a later pack wins, a pack concept that lacks a slot is not a candidate, and one that
  names a key the stack does not hold falls through too; the default pack is the last resort. Returns `null` if no
  pack presents the concept.
- `placeTextAdventureRules` calls it for a selected gate (`gate`) and an offered item concept's location (`item`) and
  writes the messages in the slot table's order, which is the order the old code wrote (so the JSON key order, and
  the bytes, are unchanged).
- Refusals by name (`TEXT_ADVENTURE_ROOM_REFUSALS.noContentSet`, `.noPresenter`): a selected concept with no
  `params.contentSet`, or with no pack presenting it. A room with no offered concept needs no set, so every direct
  caller that offers nothing is unaffected. The region seam always hands the set (C4), so no pipeline caller can hit
  `noContentSet`.
- **`text.fill` is not called.** The templates' placeholders (`{destinationRegion}`, `{item}`) are PLAY-time values;
  generation has nothing to fill, so the template is written verbatim, and the wrapper (`templating.js`) fills,
  escapes and highlights at play, as before. This is a delta from the brief's chain (`… → text.fill`).

## 4. Room places and descriptions

**Generation.** `generateTextAdventureRoom` calls **`roomPlace(params.contentSet, region_id, rng)`** (exported):

- candidates = `candidatesForRole(roles, 'place', concepts)`, less any concept from the DEFAULT pack, less any that
  `presents` a mechanic (that concept is the mechanic's look, not a room);
- none ⇒ `null`: nothing is read (not even the rng's state) and no key is written;
- otherwise the pick is **`hash32("<rng.getState()>:<region_id>") mod <candidate count>`** (FNV-1a over the string).
  The rng's state is READ, never advanced, so the pick is fixed by the seed and the world's draws are the control's,
  draw for draw. An rng with no `getState` reads as 0. Two rooms may get the same place;
- the place's `name` and (when present) `description` become payload `prose.name` / `prose.description`.

The payload declaration (`TEXT_ADVENTURE_SIDECAR_FIELDS.prose`) and `PROSE_KEYS.region` gain `name` and
`description`; with the default pack alone no room gets either, so no new key appears in any committed world.

**Play.** `bridge.js`: a room's title is its payload `prose.name` when present (applied on `textAdventure:loadRegion`
and when the world is rebuilt), else the region id as before. The arrival line is `arrivalLine(proseDoc, region,
place)` (new, in `templating.js`, node-testable): the enter message (payload → per-game file), else the payload
`description` (`{regionName}`-templated; like every message, the template is authored markup and only values are
escaped), else `You are in <name or region>.` The bridge reads the description off the payload only, never the
per-game file's `regions.<name>.description` (that file is not a world document; that key stays unread).

## 5. What the first declarer owed (C4's list), done

| Pin | Change |
|---|---|
| `presetRun.test.js` | 2 exact-shape `regionParams` asserts (top-down, grid growth: their mixes hold `text_adventure`) now expect `{contentSet: defaultContentSetOf(worldContentStackOf(bundle))}`. ⚠ C4 counted 4: the other 2 are maze-only bundles, so they turn when the MAZE declares (R2). |
| `regionGenerationFlow.test.js` | the expected `assembleRegionParams` gets `contentSet: DEFER_CONTENT_SET` |
| `worldContent.test.js` | "no registered entry declares a default pack yet" → a fixture registry with no declarer, plus a real-registry pin: every declared default is a committed pack and a world's default stack is its mix's declared defaults. The zero-read preload case takes a fixture registry. `memIo` serves a REGISTERED default pack from disk (counted apart, in `defaultRead`); the C4 "declaring entries" block declares the fixture pack only on entries that have none; expectations derive from `effectiveContentStack`. |
| `regionJobContent.test.js` | the preload reads a fixture registry of the one declaring target |
| `substrate-registry.md` | the `contentRoles` and `defaultContentPack` paragraphs are build-time table rows; generator re-run (0 findings, `--check` passes) |

Also turned: `contentPacks.test.js` hard-coded `packs === ['seedling', 'archipelago']`; it now compares against the
directories that hold a `pack.json`. The link census moved 399 → 402 (`docLinks.test.js`, `docsRender.test.js`).

## 6. Census: what stays built in

Every user-visible text-adventure string this slice did NOT move. None is written at generation.

| Where | String(s) | Why it stays |
|---|---|---|
| `bridge.js` | `You are in <region>.` (arrival fallback; now names the place when the payload has one) | play-time generic line, the fallback of a role |
| `bridge.js` | room `description: You are in <region>.` in `buildWorldFromStaticData` | the engine's own copy; managed mode never shows it |
| `bridge.js` | exit label `<exit> (to <region>)` | play-time; names the target by REGION ID even when that room has a place (the bridge learns a room's place only when its payload loads) — a gap for R3/step 3 |
| `bridge.js` | location label = the AP location name; `<loc> — checking sends '<item>'.` | AP names are logic; the sentence is a play-time line |
| `bridge.js` | `You search <loc> and find <item>.` (generic check) | play-time fallback |
| `bridge.js` | `<item>: already examined.`, `You can't interact with that: <item>.`, `You can't go that way: <exit>.` | play-time fallbacks of per-game/payload messages |
| `bridge.js` | status `Connecting to host…`, `Failed to connect to host`, `Connected — waiting for rules`, `No staticData received`, `Connected`, `Error: …` | UI status, not content |
| `playbackBridge.js` | `You explore <label>.` | play-time bot line |
| `mana.js` | `mana: <cur> / <max>` | a behaviour readout |
| `textAdventureSubstrateWrapperPanel.js` | `Text Adventure Substrate` (panel and iframe title) | UI chrome |
| `textAdventureCompositeMap.js` | heading/summary/`+N more` lines of the editor's map | editor UI |
| engine (`textAdventureEngine/engine.js`, SUBMODULE) | about a dozen lines: `No exit …`, `You can't …`, `No room …`, `Nothing left to discover here.`, `You discover a passage: …`, `You discover: …`, `Your inventory is empty.`, `> <command>`, `Cannot move to unknown room …` | play-time lines inside the engine submodule (not edited, per the brief) |
| `shared/customData/adventure_textadventure.json` (SUBMODULE) | the Adventure game's per-game prose (regions, locations, exits; 85 string lines) | a third-party game's own per-game file, loaded at play by game name |

## 7. Byte-equality evidence

**The surface, measured**: every committed `rules.json` with a `"substrate": "text_adventure"` sidecar — five files.
`jta_mixed_test/AP_1` is written by hand by `scripts/test/generate-jta-mixed-test-preset.py` (no `procgen_metadata`;
not compiled by procgen), so the procgen surface is **four**, matching the plan:

| World | Instrument | Result |
|---|---|---|
| `concept_trial/AP_1` (the one with prose) | `conceptTrialWorld.test.js` T4 D2 ("byte for byte a fresh build", the producer's `--check` in the suite) | equal |
| `concept_trial/AP_1` | new: every prose string the committed world carries is a verbatim string of the pack's text layer, read from disk | 0 strays |
| `concept_trial/AP_1` | `worldContent.test.js` (control through `prepareRunFromState`) and `textAdventureContent.test.js` (control over the default pack from disk) | byte-equal to the committed file |
| `procgen_topdown/AP_10` | `node scripts/utils/generate-topdown-preset.js --source-rules frontend/presets/adventure/AP_14089154938208861744/… --seed 10 --substrate-mix maze=1,text_adventure=1`, then `cmp` | equal |
| `procgen_topdown/AP_11` | same, source `adventure/AP_01043188731678011336`, `--seed 11` | equal |
| `procgen_topdown/AP_12` | same, source `adventure/AP_84719271504320872445`, `--seed 12` | equal |

- **The rebuild comparison** (`conceptRebuild.test.js` T0b D3, rebuild + append of a text-adventure concept world)
  passes, reading the gate prose from the pack.
- ⚠ `check-procgen-presets.mjs` is a BROWSER instrument (the pipeline panel's preset drop-down); it was not run
  locally (no browser batch locally). CI's headless procgen gates run on the push.

## 8. Tests

- New: `frontend/modules/textAdventureSubstrateWrapper/textAdventureContent.test.js`, a FIXTURE second pack `theme`
  in memory (the default pack from disk): the declaration holds the contract and every realised concept resolves
  whole from the default pack; precedence (a later full presenter wins; a presenter lacking a slot, or naming a key
  the stack lacks, falls through; the stack order decides, not key order); both refusals; `roomPlace` (no place ⇒ no
  read and no draw; the default pack's and mechanic presenters excluded; a function of state and region id; the core
  writes it, nothing without it); `arrivalLine`; and **the whole concept trial world with `content: ['theme']`**: the
  control is byte for byte the committed preset; the world minus text-adventure `prose` and the record is
  string-equal to the control's; the guardian's words are the fixture's; every text-adventure room carries the
  fixture's place (the control's none); the sword's check message is the default pack's, unchanged.
- Updated: `textAdventureRoom.test.js`, `textAdventureSubstrateWrapperLibrary.test.js`, `conceptTrialWorld.test.js`,
  `conceptRebuild.test.js` (they read the words from the pack), and §5's pins.
- In-app: `tasw-concept-prose-in-play` reads the pack and hands `placeFromRules` the boot-preloaded set; new row
  **`tasw-room-place-in-play`** (category `textAdventureSubstrateWrapper` → batch **`fast`**): AP_11 with one room's
  payload given a place in memory; entering it shows the description and the title. ⚠ Both rows are **unrun on this
  branch** (CI's on-push batches run on main).
- Bounded local run (ruling 52): `npx vitest run` over `frontend/modules/textAdventureSubstrateWrapper`,
  `procgenPipeline/{worldContent,conceptTrialWorld,conceptRebuild,presetRun,procgenPipelineUI,contentPreloadSetup}.test.js`,
  `apworldEditor/{regionGenerationFlow,regionJobContent}.test.js`, `frontend/modules/procgenDocs`,
  `procgenCore/{contentRoles,concepts.table,substrateCapabilities}.test.js`, `frontend/modules/{contentPacks,packConcepts,textLibrary}`,
  `scripts/procgen/extract-seedling-art-packs.test.js`, `flashPanel/seedlingGraphicsSettings.test.js`,
  `scripts/test/testWebgpu.test.js`, `tests/testBatches.test.js`, `tutorials/tutorials.test.js`,
  `scripts/procgen/lintGateLabels.test.js`: all passed. `lint-gate-labels.mjs` reports nothing in the touched files.

## 9. What the code overturned or added

1. **Two mechanic roles** (`gate`, `item`), not one: their slots differ (§2).
2. **`text.fill` is not part of the generation chain**: the placeholders are play-time (§3).
3. **C1's one-presenter-per-pack rule bites a theme**: a pack cannot present a mechanic from two concepts. My first
   fixture had a `place` presenting `water` beside an `object` presenting it, and the pack layer refused it. A theme
   that wants "water as a room" and "water as a gate" must pick one concept.
4. **`roleRefusal` does not resolve keys** (C2's choice), so the consumer's resolution is a second filter: a
   presenter whose key does not resolve falls through rather than writing `null`.
5. **The `place` role excludes the default pack by rule, not by data**: the brief says a place is written "only when a
   pack other than the default supplies" one, so a future default pack with places would still not name rooms.
6. **C4's "4 presetRun asserts" are 2 for the text adventure, 2 for the maze**; R2 owns the other two.
7. **Templates are authored markup**: a pack description's HTML is not escaped (as with the per-game file); only its
   values are. A theme author can therefore inject markup, as the per-game file author always could.
8. The exit labels still name regions by id (§6): naming them needs every room's place before its payload loads.
9. **Defect my bounded run missed, CI found** (JSUT 42943133715 at `e54d17f7ab`, default-tier shard 3/3):
   `procgenPipeline/conceptSeam.test.js` calls `placeTextAdventureRules` with `params.concepts` and no `contentSet`,
   so the placer refused it (`noContentSet`, the intended behaviour). The fix hands both legs the default content
   set, so the test still pins only that `params.concepts` changes nothing. Lesson for R2: grep every caller of the
   placer (`git grep -al placeTextAdventureRules`) into the bounded run, not only the files the slice touched.

## 10. CI

CI is quoted at the final tip (the `conceptSeam` fix, §9.9, which also carries this record). Run ids at the
final tip are in the REPORT BACK message (not in a further commit).

## Next slice

R2 (maze), based on this branch. When the maze declares its default pack it turns `presetRun.test.js`'s two maze-only
exact-shape asserts, and ⚠ `worldContent.test.js`'s C4 block ("declaring entries" declares the fixture pack only on
entries that have none) will then declare it on NO entry, so its `toContain(PACK)` and byte-equality cases need the
fixture to OVERRIDE one entry's default instead.
