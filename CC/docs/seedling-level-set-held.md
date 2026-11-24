# S3 — seedling-level-set-held: the app keeps the level set it is handed

Session `seedling-level-set-held` (Opus), 2026-11-20. Launcher, reviewer and landing-queue owner: `seedling-js-planning-21`
(js-21). Producer (lab) half reviewed by `seedling-lab-planning-7` (lab-7). Licence: Robert, 2026-11-20 ("Make lab sets
playable": S3 then S4; this slice is S3 only).

## Summary for Robert

- **What changed.** When you load a bundle (`.zip`) made in the watch-page set editor, the app now **keeps the level set**
  that came in it (a new host cache, `procgenCore/levelSetCache.js`, beside the atlas cache). The rules say which set
  their rooms came from, in a new optional field `region_atlas["<p>"].level_set = {set_id, content_hash}`. The lab now
  writes that field at every door.
- **Saves are kept apart.** The Flash panel's mount key (and therefore the JS save key) already reads `region_atlas[p]`
  whole, so two sets that differ in a single tile now key apart and save apart. Every committed Seedling preset (8 of
  them) keys **byte-identically** to before, which is pinned.
- **Nothing plays yet.** No room delivery changed. Slice G's refusal of a custom set still stands, with the same message.
  S4 is the slice that makes the player deliver the held rooms.
- **Only the bundle carries a set.** A plain `rules.json`, the APWorld-editor hand-over and a fetched preset carry the
  reference at most, never the body. S2 (the atlas over the lab's hand-over door) was not licensed, so the hand-over
  door is not extended here.
- No wasm rebuild, no `vendor/seedling`, no preset, no gitlink change.

## The field (agreed with lab-7, amended by lab-7)

`region_atlas["<p>"].level_set = {set_id, content_hash}`: optional and closed (`additionalProperties: false`).

- `set_id` is the level-set document's own stamped `set_id`, the id of the bundle's `level-set` member
  (`stampedSetOf(record).set_id`, the same value `downloadSet` writes).
- `content_hash` is `computeContentHash(set, {idKey: 'set_id'})`: the WHOLE document minus `set_id` and `provenance`
  (rooms, start, menu/named rooms), 8 hex. It equals a stamped set's `provenance.content_hash`, the same pair the
  existing `levelSetSaveStamp` uses.
  - This is NOT S1's `level-set-rooms-<fnv>` map_source. That one hashes parsed levels, which needs the game's OEL parser.
    The host recomputes this hash game-neutrally.
  - lab-7's amendment 2 asked for the whole document rather than `rooms` only, because links, start and so on decide
    what a player is delivered.
- One spelling: `procgenCore/levelSetReference.js` (`levelSetContentHash`, `levelSetReferenceOf`, `levelSetRefOf`,
  `putLevelSets`). The lab and the host both import it.

lab-7's OK (quoted): *"LAB OK on the lab hunks at 8e080f3639 … Both amendments satisfied (whole-doc content_hash; 4
cases → 4 ids/4 hashes; stale-handover row PASS)."*

### Amendment 1: the id moves with the content (measured, the page's own `reportOf` + lab compile)

| case | `set_id` | `content_hash` | atlas id (S1) |
|---|---|---|---|
| vanilla 116 | `seedling-vanilla-record-1040ace1` | `1040ace1` | S1's vanilla lab id |
| one tile flipped (room 10) | `seedling-vanilla-record-861ff579` | `861ff579` | `seedling-lab-db93eb8b` |
| one tree (room 10) | `seedling-vanilla-record-baf03f0b` | `baf03f0b` | `seedling-lab-5b2b3fd2` |
| one link (room 10 stairs 11→12) | `seedling-vanilla-record-f0444d74` | `f0444d74` | `seedling-lab-059431d7` |

Four sets give four ids and four hashes, pinned in `watchSetIdentity.test.js`.

## What was built

1. **Schema**: `frontend/schema/rules.schema.json`, `region_atlas[p].level_set` (optional, closed, `content_hash`
   `^[0-9a-f]{8}$`).
2. **`procgenCore/levelSetCache.js`** (new): pure and imports nothing.
   - Bounded at 4, FIFO by last put; a re-put moves the id to the newest end, and `get` does not reorder.
   - `put` overwrites and requires the set's own `set_id` as the key, with a `contentHash`.
   - `get(setId, contentHash)` answers `held`, `absent` or `mismatch`. A mismatch is reported with both hashes and the
     set is never served.
   - Grep pin: no game names.
3. **The host writer**: `presetUI.loadDocumentFile` puts each `level-set` member into the cache **before** the rules
   publish (beside the atlas cache). The notification now lists it under `CACHED —` instead of `NOT loaded —`.
   - Other entry paths: plain `.json`, `.json.gz`, `.archipelago`, a fetched preset and the APWorld-editor hand-over
     carry no set body.
   - The study's answer is "bundle only" for S3. A `labProtocol` set field would be S2-shaped work, which is not
     licensed.
4. **The mount key**: `flashPanel/seedlingMountKey.js` already serialises `region_atlas[p]` whole, so `level_set` is keyed
   with no code change (the header now says so).
   - With the field ABSENT, all 8 committed presets that have `flash_seedling` rooms key byte-identically to the base
     (sha256 prefix and `jsSaveKey`).
   - Those digests were measured over a pristine `git archive` of base `15bc7c65ee` and over the tip: 8/8 equal.
   - The roster is derived from the tree (`seedlingMountKeyLevelSet.test.js`).
5. **Lab sending half** (lab-7 reviewed):
   - `seedlingSetAdapter.rulesJsonOf` hands `levelSet: stampedSetOf(record)` to the compile.
   - `watchSetIdentity`'s compile strips that option before the real compile and writes `level_set` beside the stamp.
   - Every door (rules.json, APWorld Editor, bundle) therefore carries the same field. The arm's "bundle rules member
     === `#editDownloadRules` bytes" pin still holds.
   - The bundle already carried the `level-set` member, so it needed no change.
   - The maze lab is untouched.
6. **Nothing plays yet**: no delivery change, and G's refusal is unchanged.

## Gates

- **New vitest** (all green):
  - `levelSetCache.test.js` 9
  - `levelSetReference.test.js` 12 (includes the writer through the real `PresetUI.prototype.loadDocumentFile`, and the
    schema closed-shape rows)
  - `seedlingMountKeyLevelSet.test.js` 12
  - `watchSetIdentity.test.js` 21 (6 new S3 rows, and S1's exact `region_atlas[1]` `toEqual` re-recorded for the added
    field)
- **Mutants**, each driven by hand and each red:

  | mutant | result |
  |---|---|
  | put keeps the first body (no overwrite) | 2/9 red |
  | bound loop removed | 2/9 red |
  | `get` serves on mismatch | 2/9 red |
  | hash over `rooms` only | 3/12 red |
  | writer's `putLevelSets` removed | 1/12 red |
  | put after display | 1/12 red |
  | schema `additionalProperties: false` dropped | 1/12 red |
  | key strips `level_set` | 2/12 red |
  | key always writes `level_set: null` | 8/12 red |
  | adapter stops handing `levelSet` | 4/21 red |
  | wrapper stops writing the field | 4/21 red |

- **Bounded vitest (⚖ 52)**: every test file importing a touched file, plus `documentBundle`, `bindingContract`,
  `refusalCensus`, `storageCensus`, `storageDeclarationPins`, `moduleImportOrder`, `bundledTestCases` and
  `reachClosure`. Result: **59 files, 1967 tests, all passed**.
- **check-seedling-editor-arm** (local, at the tip): ALL CHECKS PASSED, 232 PASS / 0 FAIL. Base 230 (lab-7's CI record, not
  re-run here at base); the +2 are the new S3 claims:
  - the bundle rules' `level_set` names the `level-set` member, by id and by its node-recomputed hash;
  - REPORT → edit → door: `level_set` moved `00e5a16e` → `965fd1cd`, equal to a fresh REPORT's.
- **Unchanged outputs**:
  - acceptance md5 `391322d681b7aa0229d94b3f6906d024`;
  - `generate-maze-level --seed=1` `f3fa9f63c5b1cd593da4c198da7f40db` and `--seed=7` `f1250ed8c21b3d76d5dff2ef8d3068fd`;
  - derived-rule table untouched, `engineMd5` `bec369878feb67081187edca62baa951` base = tip;
  - engine closure 42 files, ∩ touched = ∅;
  - 0 presets and 0 gitlinks moved.
- **Preset schema**: `python -m pytest test/general/test_schema_validation.py`: 5 passed, 466 subtests (every committed
  preset still validates against the amended schema).
- **Bundle weight**: `init-bundled.js` closure +2 files, +9,062 B source (`levelSetCache.js` 5,689 and
  `levelSetReference.js` 3,373). `contentIdentity.js` was already in the closure. None of
  `seedlingLevelSetDelivery.js`'s heavy level-set modules is added.
- **CI at the code tip `8e080f3639`** (all `success`, headSha 8e080f3639):
  - **JSUT** run 44826811136: suite `vitest (unfiltered)` 1387 files / 29262 tests, 0 failed; base `15bc7c65ee` (run
    44812119325) was 1384 / 29221. That is **+3 files, +41 tests**:
    - +39 from the touched test files (`levelSetCache` 9, `levelSetReference` 12, `seedlingMountKeyLevelSet` 12,
      `watchSetIdentity` +6);
    - +2 from `bindingContract.test.js` (132→134, one row per new procgenCore module; found by diffing the shard-2 job
      logs).

    Slow battery 36/438. Headless gate shards 0–1, Producer `--checks` and the 41 browser arms all pass.
  - **unittests** run 44826811069: success.
  - **Lab CI-GATE rows**, base → tip: `seedling-editor-arm` 230 → **232/0**. Unchanged: `maze-lab` 326/0,
    `maze-world-map` 51/0, `seedling-editor-e1` 69/0, `seedling-editor-e3` 61/0, `seedling-editor-export` 29/0,
    `seedling-lab-art` 189/0, `seedling-lab-load-in-js` 60/0. Also `preset-bundle-load` 10/0 (its notification text
    changed, and its claims still hold).
  - **TT** (test-templates, dispatched) run 44827049312: every job succeeded.

    | batch | rows | headroom at tip | at base |
    |---|---|---|---|
    | fast | 126/126 | 295.2 s / 600 s (49%) | 294.6 s |
    | fast-bundled | 126/126 | 298.7 s (50%) | 320.1 s |
    | seedling-js | 39/39 | 216.2 s (36%) | |
    | seedling-wasm | 12/12 | 228.5 s (38%) | |
    | playback-bot | 16/16 | 101.6 s (17%) | |
    | seedling-js-solver | 12/12 | 195.5 s (33%) | |
    | apworld | 142/142 | 186.0 s (31%) | |

    Base is TT run 44823893399. Every batch is under the 70% STOP line, and neither fast nor fast-bundled moved more
    than +20 s.

    Region Map rows named, all PASSED:
    - playback-bot: `region-map-seedling-paints`, `-follow-player`, `-discovery`, `-clicks-seedling`,
      `-clicks-loop-mode`, `-custom-set-atlas`, `-watch-set-bundle`;
    - fast: `region-map-classic-world`, `-clicks-generated`, `-click-default`, `-click-master-off`,
      `-click-location-check`, `-click-settings-independent`.

## Files

- New:
  - `frontend/modules/procgenCore/levelSetCache.js` (+test)
  - `frontend/modules/procgenCore/levelSetReference.js` (+test)
  - `frontend/modules/flashPanel/seedlingMountKeyLevelSet.test.js`
- Changed:
  - `frontend/schema/rules.schema.json`
  - `frontend/modules/presets/presetUI.js`
  - `frontend/modules/flashPanel/seedlingMountKey.js` (comment only)
  - `frontend/modules/seedlingDemo/seedlingSetAdapter.js` (lab)
  - `frontend/modules/seedlingDemo/watchSetIdentity.js` (+test) (lab)
  - `scripts/procgen/check-seedling-editor-arm.mjs` (lab)

## For S4

A reader asks `levelSetCache.get(ref.set_id, ref.content_hash)` with `ref = levelSetRefOf(rules, player)`. `status ===
'held'` is the set to deliver; `mismatch` and `absent` are refusals, and each carries its own sentence (`why`).
