# Content sets S1: the text adventure's things, the `info` role, `{item}` at generation, exits by place (as built)

Branch `content-s1`, based on `origin/main` `44beef6a1d` (contains R5 `1a7ea6e3d1`:
`git merge-base --is-ancestor 1a7ea6e3d1 HEAD` → yes). Design: the step 3 design's §2.2–2.7 and its S1 row. S3
(`rooms` + `links`) is parked by the user and is not built: no `rooms` or `links` key is written anywhere.

| Commit | Part |
|---|---|
| `920a0e3419` | 1. contract: `resolveRole`; a presenter never fills a kind role; the text adventure's two consumers on it |
| `e5ef790ff8` | 2. `{item}` in a gate's words filled at generation; the `meta` Gate lines say `{item}` (first pin: `meta_trial` bytes identical) |
| `263ae7c3dd` | 3. things: roles, `roomThings`, the payload field, `roomExtrasOf`, the bridge (examine → `content:thingExamined`), exits by place |
| `ff7f575b61` | 4. gitlink bump: `frontend/modules/textAdventureEngine` → `30578bf` (an item's `kind` as a CSS class) |
| `56c87f0ab9` | 5. the `meta` pack's Narrator, Placeholder and three pieces of information; `meta_trial` regenerated |
| `70ab8aa738` | 6. in-app rows `tasw-thing-examine-in-play`, `tasw-exit-label-by-place`; `meta-trial-plays` updated |
| `a5d8cafe5b` | 7. docs (`text-adventure.md`, `concepts.md`), generated docs, link census 415 → 416 |
| `a6e7a98ccc` | fix: restore two bridge functions part 3 had deleted (§11.8, found by the play gates) |
| `d57d950804` | fix: no rebuild on `initialState`'s room table; the label row waits for its own world (§11.9, found by the TT) |

Gitlinks moved: **1** (the engine submodule). `frontend/modules/shared/` untouched. No file in the maze engine's closure.

## 1. The contract (`procgenCore/contentRoles.js`)

- **`resolveRole(entryOrRoles, roleId, contentSet, {presents?})`**, the one shared resolver: the role's candidates
  in a content set, latest pack first (`contentSet.ids` order; within one pack, the library's declaration order),
  each `{key, concept, text}` with every text slot the role needs resolved through the set's text library. A
  candidate whose key does not resolve is left out (falls through). `presents` narrows to one mechanic. `roleRefusal`
  stays a pure question about one concept (the chart's `rolesFilledBy` asks it with no text library).
- **A concept that `presents` a mechanic never fills a kind role**: `roleRefusal` refuses it for an `accepts.kinds`
  role, right after the kind check. C1's one-presenter-per-mechanic-per-pack rule is kept unchanged.
- Consumers moved: `presentedProse` is `resolveRole(...)[0].text`; `roomPlace` uses `resolveRole` and lost R1's two
  private filters (default pack; presenters). The default packs hold no place, so DATA says what the first filter
  said, and the contract says the second. `presentedLook` (maze) is S2's, as designed.
- ⚠ `contentRoles.js` imports `procgenCore/concepts.js` (in the maze engine closure). Nothing new is imported INTO
  the closure, and no closure file changed (§7).

## 2. `{item}` at generation

`placeTextAdventureRules`, for a selected gate: `gateItemText(chosen)` = the realisation's `needs`, each
`itemIdOfNeed(need, CONCEPTS)`, joined with " and "; filled into the gate's two templates with the text library's
`fillTemplate`, HTML-escaped; `{destinationRegion}` is left for play. A gate whose needs name no item leaves `{item}`
as written. The `meta` Gate's two lines say `{item}` instead of the literal.

**First pin, measured after part 2 alone:** `make-seedling-spiral-room-preset.mjs --state=meta-trial --check` → OK;
md5 `05b0fcbbc34bccd0c5d0fccdf685ebc7`, unchanged. `metaTrialWorld.test.js` now asserts that the pack's lines carry
`{item}` and that the baked lines are those lines with `{item}` = `gateItemText(guardian's realisation)`.

## 3. Things (the payload shape as built)

Roles the text adventure now declares (`textAdventureConceptRealisations.js`):

| Role | Accepts | Needs | Written as |
|---|---|---|---|
| `gate` | presents `guardian`, `water` | text `blocked`, `passedWith` | exit `inaccessibleMessage`, `moveMessage` |
| `item` | presents `sword`, `swim` | text `checkMessage` | location `checkMessage` |
| `place` | kind `place` | — | `prose.name`, `prose.description` |
| `character` | kind `character` | text `says` | a thing of kind `character` |
| `object` | kind `object` | — | a thing of kind `object` |
| `info` | kind `info` | text `body` | the holder's `info`, or a thing of kind `info` with no holder |

**Generation** — `roomThings(contentSet, region_id, rng, {roomName})`, called by `generateTextAdventureRoom` after
`roomPlace`: one holder from `character` ∪ `object` (characters first) by `hash32("<rng state>:<region_id>:holder")`,
one piece of information from `info` by `…:info`; no draw. With both, the holder carries it. `says`/`body` baked with
`{regionId}` and `{roomName}` (the place's name, else the region id) filled, escaped; other placeholders kept.

The payload, as committed in `meta_trial`'s START `region_2_2` (the only text-adventure room):

```json
"things": [
  {
    "id": "thing_0",
    "kind": "character",
    "concept": "meta:character/placeholder",
    "name": "Placeholder",
    "description": "It stands in a spot the theme set aside for a character.",
    "says": "Sorry about the name. The Generated Room was picked from a short list, not written for this room.",
    "info": {
      "concept": "meta:info/exits",
      "name": "On exits",
      "body": "An exit with a rule opens when its rule passes. The rule is fixed when the world is generated."
    }
  }
]
```

- Declared in `TEXT_ADVENTURE_SIDECAR_FIELDS.things` (items `{id, kind ∈ THING_KINDS, concept, name, description?,
  says?, info?: {concept, name, body}}`, `additionalProperties: false`); `check-sidecar-fields.mjs`: ALL PASS (2254
  entries over 9 substrates, 0 issues).
- Serialized only when non-empty; deserialized onto the world; the round trip carries it (`save` re-serializes the
  deserialized room; pinned: serialize → deserialize → serialize is equal).
- **`roomExtrasOf(sidecars)`** → `{<region>: {name?, description?, things?}}` for each text-adventure room that has
  any; `index.js` computes it on `stateManager:rawJsonDataLoaded` and sends it as `roomExtras` in `initialState`.

**Play** (`bridge.js`, `templating.js`):

- A thing is an engine item `thing:<id>` with its `kind` (drawn as `tae-item-kind-<kind>` by the engine), no rule,
  never collected, discovered when its room is entered.
- Examine: the lines of `thingLines(thing)` — `description`; `<name> says: <says>`; `<info name>: <body>`; a thing
  that says nothing reads `You see <name>.` — then `client.publishEventBus('content:thingExamined', {region, thing,
  kind, concept, info, originator})`. No `user:locationCheck`.
- Exit labels: `exitLabel(name, placeNameOf(target))`; `{destinationRegion}` in move and blocked lines =
  `placeNameOf(target)`; the place comes from the loaded payload, else the host's table, else the region id.

## 4. The engine submodule

`frontend/modules/textAdventureEngine` commit **`30578bfd955d688cff970e71893f21de465f3c04`** ("engine: an item's
optional `kind` is drawn as a CSS class"): `_renderItem` adds `tae-item-kind-<kind>` for a `kind` matching
`^[a-z][a-z0-9-]*$`; `engine.css` styles an accessible kinded item apart; README documents the field. Pushed to the
engine repo's `main` (`8b1f251..30578bf`). Ancestry, after `git fetch`: `git merge-base --is-ancestor 30578bf
origin/main` → **yes**. Committed with the outer repo's identity (PeerInfinity). Gitlink bumped in `ff7f575b61`.

## 5. The words (for the user's review)

Every new line a player can read, and the two rewritten ones:

| Key | Field | Text |
|---|---|---|
| `meta:character/narrator` | name | Narrator |
| | description | The voice that tells you where you are. It reads its lines from the world document. |
| | says | This is {roomName}. The rules know it as {regionId}. |
| `meta:character/placeholder` | name | Placeholder |
| | description | It stands in a spot the theme set aside for a character. |
| | says | Sorry about the name. {roomName} was picked from a short list, not written for this room. |
| `meta:info/checks` | name / body | On checks — A check is a location that sends an item. Reading this is not a check: nothing is sent. |
| `meta:info/exits` | name / body | On exits — An exit with a rule opens when its rule passes. The rule is fixed when the world is generated. |
| `meta:info/rooms` | name / body | On rooms — Each room here is one region of the world's rules. An exit takes you to another region. |
| `meta:concept/guardian/blocked` (rewritten) | Gate, shut | The Gate stays shut. Its rule is one item, {item}, and you do not have it. Come back with it and the way to {destinationRegion} opens. |
| `meta:concept/guardian/passedWith` (rewritten) | Gate, passed | The Gate checks for {item} and finds it. That is its whole rule, so it opens. The way to {destinationRegion} is clear. |
| (built in, `templating.js`) | examine format | `<name> says: <says>` · `<info name>: <body>` · `You see <name>.` (a thing with no text) |

`{item}` (gate) and `{roomName}`/`{regionId}` are filled at generation; `{destinationRegion}` at play (now the target's
place name when it has one). `meta_trial` shows the Placeholder with *On exits* (the hash's pick for its one room).

Why each is true of every world the pack can be used in: a `meta` world always names its rooms from the pack's places
(so "picked from a short list" holds); the text is baked into the document (the Narrator "reads its lines from the
world document"); a thing is never a check; AP rules are fixed at generation; a text-adventure room is one region, and
every exit leads to another region (S3, which would put several rooms in one region, is parked). ⚠ The Gate's
pack `description` ("…opens for whoever holds Progressive Sword…") still names the item literally: a concept
description is not a template. The text adventure does not show it; the maze's Gate shows only name/look.

## 6. The five worlds (md5 before → after; fresh build / rebuild)

| World | md5 at base | md5 at tip | Instrument |
|---|---|---|---|
| `concept_trial/AP_1` | `df3f6d6173eceb936fc5acae562e3fde` | same | producer `--state=concept-trial --check` OK; `conceptRebuild.test.js` (T0b D3 rebuild + append) passes |
| `meta_trial/AP_1` | `05b0fcbbc34bccd0c5d0fccdf685ebc7` | `c5ad0d886f305b0bf3afd936cb2ff3fe` | after part 2 alone: identical (`--check` OK); after part 5's regeneration: +15 lines (`things` on `region_2_2`), nothing else; `--check` OK at the tip |
| `procgen_topdown/AP_10` | `d7b60766a61116832a0ba9e6ead1d862` | same | `generate-topdown-preset.js --source-rules adventure/AP_14089154938208861744 --seed 10 --substrate-mix maze=1,text_adventure=1` → `cmp` equal |
| `procgen_topdown/AP_11` | `aed918fd26c1a38df2e1758f1f22a084` | same | same, `AP_01043188731678011336`, `--seed 11` → equal |
| `procgen_topdown/AP_12` | `16d426cca8f8ab462eb03079b82747a0` | same | same, `AP_84719271504320872445`, `--seed 12` → equal |

`metaTrialWorld.test.js`: the document minus text-adventure `prose` **and `things`** and the record is the control's
string for string; every text-adventure room holds exactly one thing, a theme non-presenter carrying a theme `info`,
its words the pack's with the generation placeholders filled; the control's rooms hold none.

**Consumer sweep** (everything that names `meta_trial`): `metaTrialWorld.test.js` (updated), `contentPicker.test.js`
(pick → the committed preset byte for byte: passes), `mazeConceptArt.test.js`, `mazeMetaArt.test.js` (maze regions,
unchanged), `presetDefs.test.js`, `boxLock.test.js`, the in-app rows `meta-trial-plays` (updated) and
`meta-trial-maze-tile-art` (maze only), the new `tasw-thing-examine-in-play`, `check-meta-trial-play.mjs` (runs
`concept-trial-play`'s instrument on this preset), the R4/R5 contact-sheet pages (maze rooms only),
`preset_files.json`/`preserved-dev-presets.txt`/`register-preset.py` (row unchanged).

## 7. The maze engine closure

`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`, at base `44beef6a1d` and at the tip:
**identical** (`diff` empty) — `engineMd5 3e333bfa0a7692f8120aeaa9a1591119 (42 files, root
frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)`. No file of the slice's diff is in the listing.

## 8. `{seed}` — measured, and dropped

The region's `params` reach `generateRegionCore` from `assembleRegionParams`: each active entry's
`buildRegionParams({params, mode})` hook, `concepts`, and the content keys. The text adventure declares no
`buildRegionParams`, so the world seed does not reach the room today. It COULD, with no generator file: a
`buildRegionParams` hook on the text adventure's own entry returning `{seed: params.seed}`. That would add a key to
every text-adventure world's `regionParams` and move the exact-shape `regionParams` pins (`presetRun.test.js`,
`regionGenerationFlow.test.js`). **Not done, and `{seed}` is not offered**, for a reason of content rather than of
code: the only seed the seam holds is the PROCGEN seed (`params.seed`; 8 for `meta_trial`), not the seed id the player
sees for the document (`AP_1`). A line "this world came from seed 8" next to a preset called `AP_1` reads as untrue,
which the standing ruling forbids. If the user wants the Narrator to name a seed, the ruling needed is which seed.

## 9. Tests

- New/changed vitest: `procgenCore/contentRoles.test.js` (the presenter rule; `resolveRole`: resolved slots, latest
  first, fall-through, `presents`, refusals); `textAdventureSubstrateWrapper/textAdventureContent.test.js`
  (`gateItemText`; the fixture theme's gate `{item}` baked, `{destinationRegion}` kept, `&` not escaped in authored
  markup; `roomThings`: none from the default pack with no read/draw, the holder carries the info, baked placeholders
  escaped, every holder reachable, info alone, the core writes it and the payload round-trips; `roomExtrasOf`);
  `templating.test.js` (`exitLabel`, `thingLines`); `procgenPipeline/metaTrialWorld.test.js`;
  `procgenDocs/docLinks.test.js`, `docsRender.test.js` (census 416: `same-doc` 38 → 39).
- **Bounded run** (ruling 52): `npx vitest run` over `frontend/modules/textAdventureSubstrateWrapper`,
  `procgenCore/{contentRoles,substrateCapabilities,concepts.table,sidecarFields}.test.js`,
  `procgenPipeline/{conceptSeam,conceptTrialWorld,metaTrialWorld,conceptRebuild,worldContent,presetRun,contentPicker,presetDefs,procgenPipelineUI,contentPreloadSetup}.test.js`,
  `apworldEditor/{regionGenerationFlow,regionJobContent}.test.js`, `frontend/modules/{procgenDocs,contentPacks,packConcepts,textLibrary,tests,mazeRoom}`,
  `scripts/procgen/lintGateLabels.test.js` — **133 files, 3614 tests, all passed**. (Every caller of the placer:
  `git grep -al placeTextAdventureRules` → `conceptSeam` + five wrapper suites, all in the set.) One earlier,
  wider run had `mazeRoom/tileSpike/sphereOrderLevels.test.js` time out under load; it passes alone (35/35), and no
  file it imports is in the diff.
- `generate-procgen-reference.mjs`: 0 findings; `check-procgen-docs.mjs`: ALL CHECKS PASSED.
- In-app rows (`textAdventureSubstrateWrapper`, batch `fast`, enrolled in `playwright_tests_config-substrates.json`):
  **`tasw-thing-examine-in-play`** (meta_trial: the START's thing listed; examined twice → its lines shown, a
  `content:thingExamined` naming region/thing/concept/info each time; no location checked over 2 s; still listed) and
  **`tasw-exit-label-by-place`** (AP_11 in memory: the START `Overworld`'s gated exit to `BlackCastle`, found from
  the document; the target given a place, the START a blocked line with `{destinationRegion}`; the label and the
  line name the place; the target never entered). `meta-trial-plays`: the Gate's expected lines take `{item}`; the
  START lists its thing with its kind's class. The rows' results are CI's (TT dispatch), quoted in the REPORT BACK.

## 10. Box runs (local, at code tip `d57d950804`)

Each took the box lock (`--wait-for-box=3600`, queued behind another worktree's batch), against a dev server for
this worktree on port 8132:

| Run | Result |
|---|---|
| `node scripts/procgen/check-concept-trial-play.mjs --host=http://localhost:8132` | ALL CHECKS PASSED (28 PASS) |
| `node scripts/procgen/check-meta-trial-play.mjs --host=http://localhost:8132` | ALL CHECKS PASSED (28 PASS) |
| `npm test -- --port=8132 --mode=test-spoilers --game=meta_trial --seed=1` (the one authorised spoiler run) | `test_spoiler_full_run` PASSED; the page loaded `./presets/meta_trial/AP_1/AP_1_rules.json` (`source: urlOverride`), not the default preset |

The same three passed at `a6e7a98ccc` too. The first pass, at `a5d8cafe5b`, failed both play gates (4 checks each) on
the defect of §11.8; the spoiler run passed there too. CI's runs at the final tip (push `unittests`, `JavaScript Unit Tests`, the train tier, the TT dispatch with
the rows on both boots and the CI-GATE lines) are quoted in the REPORT BACK, not in a further commit.

## 11. What the code overturned or added

1. **No host relay for `content:thingExamined`** (design §4: "`index.js` … relay"). The bridge publishes it with
   `client.publishEventBus`, and the iframe adapter registers the iframe as the event's publisher on the host bus
   itself (as JtA's bridge relies on). `index.js` only computes and sends the extras table.
2. **The engine makes an item's state slots in `loadWorld` only**, so things are laid on the world when it is
   BUILT, from the host's table (not from a later `textAdventure:loadRegion`, which now refreshes titles and exit
   labels only); a table that arrives after a build with different things rebuilds the world.
3. **`roomPlace` ordering**: through `resolveRole`, candidates are latest pack first; R1 hashed over the library
   order. Same for a one-pack stack (every committed world: no byte moved); a stack with places in two packs would
   pick differently from R1's rule.
4. **`{seed}` dropped for a content reason, not a code one** (§8).
5. Thing engine-item ids carry the prefix `thing:`, so a thing can never be taken for an AP location name.
6. The event's payload is `{region, thing, kind, concept, info, originator}` (no `room`: S3 is parked).
7. New built-in lines (the examine format, `You see <name>.`) live in `templating.js`, beside the other play-time
   fallbacks.
8. **Defect my own gates found.** Part 3's second edit of `bridge.js` replaced a text range that also held
   `applyOwnPlaceToWorld` and `proseDocFor`; `rebuildWorld` then threw a ReferenceError and the wrapper rendered no
   world. The bounded vitest could not see it (nothing imports the bridge in node). The first local run of
   `check-concept-trial-play` / `check-meta-trial-play` at `a5d8cafe5b` failed on it ("timeout waiting for: the
   wrapper renders region_2_2's exit"); fixed in `a6e7a98ccc`, and a scan of every bare call in `bridge.js`,
   `index.js` and the rows' file for an undeclared name found no other.
9. **Defect the TT found** (dispatch 43648555489 at `3c045b64c8`: every job green but `fast` unbundled, where
   `tasw-exit-label-by-place` FAILED — "it read —", no exit link; the bundled boot PASSED it). My part 3 bridge
   rebuilt the world when `initialState`'s thing table changed. Coming from `meta_trial` (which has things) to AP_11,
   that rebuild read the PREVIOUS document's staticData (log: "rebuildWorld: staticData arrived but has no
   regions"), and while it was in flight the new document's `rulesLoaded` rebuild was skipped (`rebuildInFlight`) —
   the hazard the comment in `applyInitialState` already names. `initialState` lands before `rulesLoaded`, so that
   rebuild lays the things on the new world; the trigger is removed (`d57d950804`). The row also now waits up to
   15 s for THIS document's exit link before reading its label.

## Next slice

S2 — the maze's information tile (design §3, §4 S2), based on this branch once it lands: `mazeThings.js` /
`mazeThingOverlay.js` outside the closure, `presentedLook` on `resolveRole`, the `meta` characters' looks and shape
art, `meta_trial`'s two maze regions gain a thing.
