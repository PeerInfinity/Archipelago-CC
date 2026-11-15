# Content sets S2: the maze's information tile (as built)

Branch `content-s2`, based on `origin/main` `e6f93cd3b9` (contains S1 `64ba3a1920`:
`git merge-base --is-ancestor 64ba3a1920 HEAD` → yes; it also carries region-map step 1, train 108). Design: the
step 3 design's §3 and its S2 row. Rulings implemented (⚖ the user, 2026-11-14): look-only things; one per maze region
when the theme offers any (a character may repeat); it stands on a floor cell and the player walks onto it to read it
and keeps walking; no line may claim something untrue; simple shapes; Q4 (existing worlds byte-equal); Q8 (text,
names and colours baked at generation; art by key at play). Plus a ruling made during the slice: **option A**, a
substrate's own text line (`resolveRole`'s `variant`), §2.

| Commit | Part |
|---|---|
| `3274723906` | 1. the maze's `character`, `object`, `info` roles; `presentedLook` on `resolveRole`; `resolveRole`'s `variant` |
| `188869fe6d` | 2. `mazeThings.js`: what a region holds, the free-cell rule, the core/serializer/deserializer wrappers, `things` declared, the round trip's re-seat |
| `80ea235a54` | 3. play: `mazeThingOverlay.js` beside `drawWorld`; read on arrival; `content:thingExamined`; fog; the sign key |
| `e8e7ce6cc0` | 4. the `meta` pack's looks, art and maze lines; `meta_trial` regenerated |
| `bfde343d42` | 5. the contact sheet |
| `241c6b6069` | 6. in-app row `maze-thing-shows-text` (fast) |
| `39da2e3c63` | 7. docs (`maze.md` § Things, `concepts.md`), generated docs, census 416 → 418 |
| `7da812c0f2` | R4's row's floor-cell read skips a thing's cell (defensive; not affected in `meta_trial`) |

Gitlinks moved: **0**. `frontend/modules/shared/` untouched. No file in the maze engine's closure (§7).

## 1. The payload as built (an example)

`meta_trial`'s `region_1_3` (a maze region), as committed: `things` is written last before the envelope's `fogEnabled`.

```json
"longestShortestPath": 1,
"things": [
  {
    "id": "thing_0",
    "x": 1,
    "y": 5,
    "kind": "character",
    "concept": "meta:character/narrator",
    "name": "Narrator",
    "color": "#7fa0c8",
    "symbol": "N",
    "description": "The voice that tells you where you are. It reads its lines from the world document.",
    "says": "The rules know this room as region_1_3.",
    "info": {
      "concept": "meta:info/checks",
      "name": "On checks",
      "body": "A check is a location that sends an item. Reading this is not a check: nothing is sent."
    }
  }
],
"fogEnabled": true
```

`region_2_3` holds the Narrator at (1,2) carrying *On rooms*. Declared in `TILE_GRID_SIDECAR_FIELDS.things` (optional;
items `{id, x, y, kind ∈ MAZE_THING_KINDS, concept, name, color?, symbol?, description?, says?, info?: {concept,
name, body}}`, `additionalProperties: false`). `check-sidecar-fields.mjs`: ALL PASS (2254 entries over 9 substrates,
0 issues).

## 2. The roles, and the text variant

| Role | Accepts | Needs | Written as |
|---|---|---|---|
| `gate` | presents `guardian`, `water` | `look` | (unchanged) |
| `item` | presents `sword`, `swim` | `look` | (unchanged) |
| `character` | kind `character` | `look`, text `says` | a thing of kind `character` |
| `object` | kind `object` | `look` | a thing of kind `object` |
| `info` | kind `info` | text `body` | the holder's `info`, or a thing of kind `info` (a sign) |

- `presentedLook` now asks the contract's `resolveRole` (no private filter). `contentRoles.js` imports
  `procgenCore/concepts.js` (in the closure), but `mazeContent.js` already imported `contentRoles.js` at base, and
  nothing new enters the closure (§7). R5's own filter in `mazeTileArt.js` is kept: that file must import nothing that
  imports the closure, and it is pinned so.
- **`resolveRole(…, {variant})`** — a contract extension, ruled by the user (option A) when I reported that S1's
  `meta` lines are untrue or odd in a maze (they bake `{roomName}`, a room's place name, and a maze region has no
  place: the Placeholder's "…was picked from a short list…" would be false). With a `variant` (the consumer's
  substrate id), each needed slot's key is first asked as `<key>/<variant>` (`textVariantKey`), then as `<key>`. The
  maze passes `variant: 'maze'`; the text adventure passes none, so its words and bytes do not move. ⚠ The ruling
  spelled the keys `<key>@maze`; a pack text key may not hold `@` (`contentPacks.KEY_PATTERN`), so the suffix is
  `/maze`.

## 3. What a region holds, and the cell rule

- **The hook.** `thingsRegionCore` wraps the entry's `generateRegionCore` (after `mazeContent`'s presentation pass):
  `regionThings(contentSet, region_id, rngState)` → one holder from `character` ∪ `object` (characters first, each
  latest pack first) by `hash32("<rng state>:<region id>:holder")`, one piece of information by `…:info`, the holder
  carrying it; information alone is a thing of kind `info`. The rng state is READ before the core runs; no draw.
  Recorded on the world with no position.
- **The cell.** `thingsSerializer` wraps the serializer: each position-less thing takes the free floor cell
  `hash32("<region id>:<concept key>") mod (free count)` over the free cells in row order (the region id is the
  extracted rules' `region_id`). *Free* = a floor cell that no `{x, y}` or `"x,y"` anywhere in the payload names
  (entrance, exits, items, obstacles, blocks, buttons, traps and their lanes, pulls, pulsers, hazard paths, mana and
  consumable tiles, anything a later field adds). A thing with a position keeps it while its cell is still free.
- **No free cell → no thing**, no refusal. **Regions that got none:** in the committed corpus only `meta_trial`'s stack
  offers a maze thing, and both its maze regions have free cells (`region_2_3`: 8 floor cells, 5 free; `region_1_3`:
  all floor). The design's measured "5 regions with no free cell" are all in worlds whose stack offers no thing, so no
  committed region was skipped.
- **The deserializer.** `thingsDeserializer` copies `things` back (the engine's copies named fields only).
- **The round trip.** `mazeRegionRoundTrip.save` now runs `reseatThings(restamp(edited, payload), regionId)`.

## 4. Play

- `mazeThingOverlay.drawMazeThings` is called by the panel right after `drawWorld` (`drawWorld`'s op logs are
  unchanged; pinned). Order of choice: the pack concept's `art` key (`mazeTileArt.thingArtKeys`, resolved at play by
  the same load as R5's concept art); else for unheld information the new key `maze:object/sign` (fallback: a board in
  the new `COLORS.sign` `#b89868`); else the baked colour and symbol (a square, ink-edged, with the symbol). Not drawn
  under the fog until its cell is seen, nor under the player; never on a Seedling-atlas world.
- **Reading.** When a move the panel executes (`_executeMoveAction`: keys and the queue) ends on a thing's cell, the
  panel shows its name and lines under the canvas (`.maze-room-thing`; `mazeThingLines`, the text adventure's order:
  description; `<name> says: …`; `<info name>: <body>`; else `You see <name>.`) and publishes
  `content:thingExamined` `{region, thing, kind, concept, info, originator: 'mazeRoom'}` (S1's shape; the publisher is
  registered in `mazeRoom/index.js`). Leaving the cell clears it; walking back reads it again. Nothing is checked or
  blocked. The autopather and the bots know nothing of things (a loops-visualizer walk that crosses the cell does not
  read it; only the panel's own executed moves do).

## 5. The words and the shapes (for the user's review)

| Key | What | Text / look |
|---|---|---|
| `meta:character/narrator/says/maze` | the Narrator's maze line (new) | The rules know this room as {regionId}. |
| `meta:character/placeholder/says/maze` | the Placeholder's maze line (new) | Sorry about the name. {regionId} is the id the generator gave this region; nobody wrote it for this room. |
| `meta:character/narrator` `look` | its baked look (new) | colour `#7fa0c8`, symbol `N` (drawn without art as a pale-blue square with N) |
| `meta:character/placeholder` `look` | its baked look (new) | colour `#c4c9d2`, symbol `P` (a paper square with P) |
| `meta:character/narrator` art | shape (new) | a pale-blue circle ringed in ink with a speech tail at its lower left, two ink lines of speech inside |
| `meta:character/placeholder` art | shape (new) | a paper circle ringed in ink with a cross through it (the "picture still to come" mark) |
| `maze:object/sign` art (in `meta`) | shape (new) | a paper board outlined in ink on an ink post, two ink lines of writing |
| `COLORS.sign` | the maze's own sign without art (new) | a tan `#b89868` board on a post, ink-edged |
| (built in, `mazeThingOverlay.js`) | reading format | `<name> says: <says>` · `<info name>: <body>` · `You see <name>.` (the text adventure's) |

Unchanged and reused in the maze: the Narrator's and Placeholder's descriptions, and the three info lines (*On
checks*, *On exits*, *On rooms*), each true of a maze region as written (a maze region is one region of the rules; its
exits lead to other regions; reading a thing sends nothing). All shapes follow R4's style: a 20×20 box, every stroke 2,
R4's palette (ink `#2e3440`, paper `#c4c9d2`).

`meta_trial` shows the Narrator in both maze regions (the hash's pick), carrying *On rooms* and *On checks*.

## 6. Contact sheet

`CC/docs/cloud-reports/content-sets-s2/contact-sheet.png` (from `contact-sheet.html` through
`render-contact-sheet.mjs`, a sibling of R5's). The real painter plus the overlay on `meta_trial`'s committed maze
rooms: the Narrator as committed, the Placeholder and a sign staged on the same room, each default (baked look / plain
sign) beside meta (art) and the recipe, with the panel's reading under each; both maze rooms whole, both ways. Status
line: `thing art: meta:character/narrator → meta:character/narrator; meta:character/placeholder →
meta:character/placeholder; sign: meta; failed sheets: 0`.

## 7. Byte equality and the closure

| Instrument | Result |
|---|---|
| every committed maze payload through the wrapped pair vs the engine's (a scratch probe) | 38 worlds, 1,188 maze regions: 1,186 identical, 0 different, 2 refused by the extractor (`atlas_gate_*`, as on main) |
| which committed worlds' stacks offer a maze thing (`resolveRole` over each world's effective stack) | `meta_trial` only (before part 4: info 3, character 0; after: both characters) |
| `make-seedling-spiral-room-preset.mjs --state=concept-trial --check` | OK |
| `… --state=meta-trial --check` | OK at the tip (after the regeneration) |
| `generate-topdown-preset.js` for `procgen_topdown` AP_10/11/12 (S1's recipes) | `cmp` equal, all three |
| `dump-maze-byteidentity.mjs`, base (`origin/main` exported) and tip | `MD5 ecb7add331624e6140ca6ff48da04b14` both |
| `mazeRoomRender.test.js` op-log hashes | unchanged (the suite passes untouched) |
| `meta_trial/AP_1` md5 | S1 `c5ad0d886f305b0bf3afd936cb2ff3fe` → `68a3ee9c28e6e456c0657e494eec52e9`: +38 lines, `things` on its two maze regions only; minus the maze things the document is the control's (pinned) |

`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`, at base `e6f93cd3b9` and at the tip:
**identical** (`diff` of the 42-line listings empty) —
`engineMd5 3e333bfa0a7692f8120aeaa9a1591119 (42 files, root frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)`.
No file of the slice's diff is in the listing. `mazeThings.test.js` pins that none of the slice's files is in it.

**design-6's answer** (my brief named `tile-primitives-design-5`, no longer reachable; `tile-primitives-design-6` is
its successor): *"SAME, on your listings. Base and tip are both 3e333bfa…1119 (42 files, root
certifyPlaythroughMaze.js), the 42-line diff is empty, and 3e333bfa is also main's current engineMd5 per js-19. None of
your listed files is in the closure … So no derived-table move and no calib are owed from the closure side."* It adds:
fire-breaks-rocks (train 109) moves the engine to `bec36987`; **if S2 lands after it, re-run
`--print-engine-closure` on the new main** and check again that no closure file is in the diff.

## 8. Tests

- **New:** `mazeRoom/mazeThings.test.js` (13: the declaration; nothing in the closure; what a region holds — none from
  the default pack, one holder carrying information, baked with the maze variant, unescaped, by hash; information alone
  a sign; the free-cell rule incl. a `"x,y"` lane; hash cell; a kept cell; a walled cell moves it; no free cell → none;
  core → serialize → deserialize → serialize with the rng undisturbed and the extractor's answer the same; no thing → no
  key; the registry's wrapped hooks; the round trip keeps things in place and key order);
  `mazeRoom/mazeThingOverlay.test.js` (9: `thingArtKeys` never takes a presenter; the load carries it and decodes the
  sign; baked look / sign fallback; art / sign-art; fog and player; `drawWorld`'s ops unchanged with things; reading
  order; `thingAt`).
- **Changed:** `procgenCore/contentRoles.test.js` (`variant`); `mazeContent.test.js` (a kind role has no
  `presents`); `mazeRoomLibrary.test.js` (the serializer and deserializer are wrapped); `sidecarFieldsRegistry.test.js`
  (`things` is declared by both substrates, each its own shape); `mazeTileArt.test.js` (empty load has `thingArt`);
  `mazeMetaArt.test.js` (the staged world also draws a sign through the overlay; every recipe one stroke width);
  `procgenPipeline/metaTrialWorld.test.js` (minus maze things; a new S2 pin: every maze region holds one theme holder
  with its baked look and maze lines, on a cell free in the control's payload); `textAdventureContent.test.js` (its
  fixture theme's info now stands as a maze sign; stripped as presentation); `procgenDocs/docLinks.test.js`,
  `docsRender.test.js` (census 418).
- **Bounded run** (ruling 52): `mazeRoom`, `procgenCore`, `contentPacks`, `artLibrary`, `textLibrary`,
  `packConcepts`, `metaTrialWorld`, `worldContent`, `procgenDocs`, `tests`, `textAdventureSubstrateWrapper`,
  `substrateRegistryPanel`, and every default-tier suite naming a wrapped hook, `mazeRoomLibrary` or a round trip
  (`git grep -al`, 94 files): **267 files, 7,505 tests, all passed**. Seven `*.slow.test.js` suites name a wrapped hook;
  they are CI's slow tier. Also `contentPicker`, `presetDefs`, `boxLock` (79 passed) and
  `test/test_register_preset_seed_field.py` (7 passed).
- `generate-procgen-reference.mjs --check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE;
  `check-procgen-docs.mjs`: ALL CHECKS PASSED. Census: 29 documents, **418 links** (313 doc, 22 external, 44 repo, 39
  same-doc).
- **In-app row** `maze-thing-shows-text` (category *Maze things*, batch `fast`; registered in `testDiscovery.js` and
  `init-bundled.js`). Its result is CI's (the TT dispatch), quoted in the REPORT BACK. R4/R5's
  `meta-trial-maze-tile-art` re-runs in the same dispatch (the key table grew from 14 to 15).

## 9. Box runs (local, at code tip `39da2e3c63`, dev server for this worktree on port 8141)

| Run | Result |
|---|---|
| `node scripts/procgen/check-meta-trial-play.mjs --host=http://localhost:8141` | ALL CHECKS PASSED |
| `node scripts/procgen/check-concept-trial-play.mjs --host=http://localhost:8141` | ALL CHECKS PASSED |
| `npm test -- --port=8141 --wait-for-box=1800 --mode=test-spoilers --game=meta_trial --seed=1` (the one authorised spoiler run) | `test_spoiler_full_run` PASSED; the page loaded `./presets/meta_trial/AP_1/AP_1_rules.json` |

**Consumer sweep** (everything naming `meta_trial`): `metaTrialWorld.test.js` (updated), `contentPicker.test.js`
(pick → committed preset: passes), `presetDefs.test.js`, `boxLock.test.js`, `mazeConceptArt.test.js`,
`mazeMetaArt.test.js` (updated), the in-app rows `meta-trial-plays` (text adventure only), `meta-trial-maze-tile-art`
(the floor cell it reads now skips a thing's cell), `tasw-thing-examine-in-play`, the new row, both play gates, the
R4/R5 contact-sheet pages (they draw through the engine's deserializer: no things, unchanged),
`preset_files.json`/`preserved-dev-presets.txt`/`register-preset.py` (row unchanged).

CI's runs at the final tip (push `unittests`, `JavaScript Unit Tests`, the train tier, the TT dispatch with the row on
both boots, headroom, the CI-GATE lines) are quoted in the REPORT BACK, not in a further commit.

## 10. What the code overturned or added

1. **The text variant** (§2): S1's `meta` lines could not be reused in a maze as written. Ruled option A; the key
   suffix is `/maze`, not `@maze` (the key pattern).
2. **The hook is the core, not the placers.** The design says the placer hook records what a region holds and asks
   to wrap `placeFromItems` and `placeFromRules`. Measured: neither placer is handed the region id (`placeFromItems`
   gets `{items_to_place, obstacles_to_place, arrival_inventory, rng, params}`, `placeFromRules` `{exit_rules,
   location_rules, item_placements, rng, params}`); `generateRegionCore` gets `region_id`, `rng` and `params`, and is
   called once before each placer on both build paths. So `thingsRegionCore` wraps the core; the placers are as at
   base. Same rule (one pick by hash, no draw), the text adventure's own place for it (`roomThings` is in its core).
3. **The round trip did not delete things.** The design (and the brief) said `mazeRegionRoundTrip.js` must use the
   wrapped pair or a re-derive would delete a region's things. Measured: its `restamp` already carries back every key
   of the document's payload the re-serialization does not emit, `things` included. What it lacked was a re-seat for
   an edit that covers a thing's cell: `save` now calls `reseatThings`. Its `open` keeps the engine's pair (the lab
   shows no things, as designed).
4. **Text is not HTML-escaped in the maze** (the text adventure's baked text is): the maze shows text with
   `textContent`.
5. **The event's payload** has `originator: 'mazeRoom'`, and only the panel's executed moves read a thing (keys and the
   queue); a loops-visualizer walk does not.
6. **A thing record carries `id`** (`thing_0`), which the design's §3.3 shape omits, so the event is S1's shape.
7. R4's `mazeMetaArt.test.js` holds every recipe to one stroke width; my first recipes used width 1 for the writing
   lines and were refused by it. All are 2 now.

## Next slice

After S2 lands: the REPLAN with the user (the ladder's end; S3 is parked).
