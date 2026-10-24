# Concept library T2 — the text adventure realises three concepts as prose (cloud report)

**Worker:** `concept-library-t2` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/concept-library-t2-prose-sbmfud`. The brief's local name `concept-library-t2` was not used; the harness only pushes its own branch.
**Started from:** `53b2e2e00a` (origin/main at launch, T0 merged).
**Code head:** `c73283c`, a merge of origin/main `84421b2` (engine prep B1) into this branch. This report is the commit after it.
**T1 has NOT merged** (checked at `84421b2`). Until it does, nothing in the pipeline passes `params.concepts` to `placeFromRules`, so no generated world gets prose yet.

| D | Commit | Verdict |
|---|---|---|
| D1 the `prose` field | `d7fa4e3` | PASS |
| D2 the resolution order | `e760c11` | PASS |
| D3 the realisations | `9628ddb` | PASS (mutant (b) cannot red the preset md5 row; see below) |
| D4 the in-app row | `eb73cc6` | PASS |
| D5 records | `e0e5c0f`, then the merge `c73283c` | PASS |

## W0 — BEFORE / AFTER

| Gate | BEFORE (`53b2e2e00a`) | AFTER (`c73283c`) |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `58820064449a5afa2441d34466fcb20a  -` | `58820064449a5afa2441d34466fcb20a  -` (identical) |
| `node scripts/procgen/check-sidecar-fields.mjs` | `ALL PASS — 1419 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` | the same line |
| `node scripts/procgen/generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | the same line |
| bounded vitest (`textAdventureSubstrateWrapper procgenCore/concepts procgenPipeline/conceptSelection procgenDocs`) | `Test Files 20 passed (20)` / `Tests 718 passed (718)` | `20 passed (20)` / `730 passed (730)`: +11 from T2, +1 from main's B1 |
| the same list + `quickLaunch` | — | `27 passed (27)` / `843 passed (843)` |
| `node scripts/procgen/check-procgen-docs.mjs` | — | `ALL CHECKS PASSED`, exit 0 |

**Byte inertia holds.** No committed preset was written. Every text-adventure payload built with no concept offered keeps exactly its three keys (asserted in `textAdventureRoom.test.js`).

## D1 — the `prose` field (`textAdventureRoom.js`)

**What landed:**
- `TEXT_ADVENTURE_SIDECAR_FIELDS.prose`: optional, `type: 'object'`. Its schema is `{enterMessage?, exits: {<exit_id>: {moveMessage?, inaccessibleMessage?}}, locations: {<AP name>: {checkMessage?, alreadyCheckedMessage?, inaccessibleMessage?}}}`. Each message is a non-empty string, and `additionalProperties: false` at every level, so a message kind the per-game file does not have is refused.
- `PROSE_KEYS` is exported (the message kinds per record type).
- `serializeTextAdventureRoom` writes `prose` only when at least one message is non-empty.
  - Locations are re-keyed from the room's location **id** to the AP **name** the serializer bakes for them. That is the key the file and the bridge use.
  - Exits stay keyed by `exit_id`.
- `deserializeTextAdventureRoom` puts a `structuredClone` of `prose` on the world.
- `textAdventureRoomRefusal` is untouched.

**Rows:**
- no prose, or only empty prose ⇒ no key;
- exits keyed by `exit_id` and locations by AP name, holding the declaration, a byte-identical round trip, and a clone;
- the declaration refuses a foreign kind, an empty message, and an unknown top-level key.

**Gate:** `check-sidecar-fields` gives ALL PASS for 1419 entries over 8 substrates, the same count as W0. The regenerated reference moved one cell: the text adventure's `sidecarFields` changed from a list of 4 names to "5 keys".

## D2 — the resolution order (`templating.js`, `bridge.js`)

**The choice: one composer, not a new first argument.** `composeProse(customData, regionName, prose, exitNameOf)` lays one region's payload `prose` over the per-game file, one message at a time. The six `custom*Message` helpers and their 25 rows are unchanged; the bridge passes them the composed document instead of the file. This is the smaller change: one new function, and one argument changed at each of the six call sites.

**Resolution:** payload prose, then the per-game file, then `null` (the bridge's generic line). The fall-through is per message, so an exit can override `inaccessibleMessage` and still take `moveMessage` from the file.

**The bridge:**
- `captureRegionProse` runs on `textAdventure:loadRegion`. It keeps the region's prose and an `exit_id → exitName` map taken from `world.exits`.
- All six message sites call `proseDocFor(room)`.
- An `initialState` with `procgenMode: false` clears the cache.

**Rows (`templating.test.js`)**, each for an exit's `inaccessibleMessage` and a location's `checkMessage`:
- payload prose wins;
- a message the payload does not say falls through to the file;
- with neither, the result is `null`;
- plus exit re-keying and `enterMessage`, with neither input mutated.

**Mutant (a):** file laid over payload (`{...rec, ...out[key]}`).
- Predicted: 2 red (the "payload wins" row and the re-keying row).
- **Measured: 3 red.** The fall-through row also carries a payload `moveMessage` that the file overrides, and I missed that.
- Restored, and the tree was clean.

## The path a payload takes to the bridge (measured)

1. `rules.json` `preset_sidecars[slot][region].playable_payload`.
2. `procgenPlayer/procgenPlayerEngine.js` `buildWarehouse` → `deserializeOrRefuse(adapter, payload)` → the entry's `deserializeWorld` (`deserializeTextAdventureRoom`) → `warehouse.regions.set(regionId, {world, loadRegionEvent})`.
3. `procgenPlayer/index.js` `publishLoadRegion` → `eventBus.publish('textAdventure:loadRegion', {region_id, world, arrivedFrom})`.
4. The iframe relay → `bridge.js` `client.subscribeEventBus('textAdventure:loadRegion', …)`. This handler already reads `world.exits` as a Map for the compass sides.

So the bridge sees the **deserialized world**, never the payload. That is why D1's deserializer has to carry `prose`, as it already carries `manaEnabled`.

## D3 — the realisations

**The realisations** are in `textAdventureConceptRealisations.js` (data). The entry sets `conceptRealisations: TEXT_ADVENTURE_CONCEPT_REALISATIONS`.

| Concept | Tier | What it carries |
|---|---|---|
| `sword` | `mechanic` | `prose.checkMessage` (a location's prose) |
| `swim` | `mechanic` | `prose.checkMessage` |
| `guardian` | `mechanic` | `placements.gate`: `{effect: 'requires', needs: ['sword'], mechanic: {prose: {blocked, passedWith}}}` |
| `water` | `mechanic` | `placements.gate`: the same shape, needing `swim` |

- Every message is 2–3 sentences in the second person and names its concept. `passedWith` names the weakness (the sword) or the crossing (swimming).
- The gate messages use `{destinationRegion}`.
- The entry's test runs `assertRealisations(entry, CONCEPTS)` and pins `conceptsRealisedBy`.

**`placeTextAdventureRules`:**
- For each exit rule that is not `True_`, it calls `selectRealisation(rule, {id, conceptRealisations}, {concepts: CONCEPTS, offered: input.params?.concepts ?? [], rng: input.rng})`.
  - On a candidate: `prose.exits[exit_id] = {inaccessibleMessage: blocked, moveMessage: passedWith}`.
  - On `null`: nothing.
- A location holding an offered item concept gets that item's `checkMessage`.
- The rule is recorded exactly as before.
- This entry has at most one candidate per rule (sword and swim are distinct needs), so it never draws.

**Rows:**
- a guardian-gated exit carries both messages, a water-gated exit carries its own, and a plain-rule exit carries none;
- the payload minus `prose` is byte-identical to the build with no concepts;
- absent or empty `offered` ⇒ no `prose` key;
- a partial offer is honoured.

**Registry row:** one row, `conceptRealisations`, in `substrate-registry.md` § *Build-time — procedural substrates*. T1 adds the identical row, and the coordinator keeps one. After regenerating: `84 fields over 15 groups … 0 FINDING(S)`, matching T0 D5's table.

**Mutant (b):** `offered` ignored (`Object.keys(CONCEPTS)`).
- Predicted: 2 unit rows red, and the corpus unmoved.
- **Measured: 2 red.** The in-memory rebuild of AP_11 (`topDownFromRulesJson`, its own recorded call) stayed **4/4 text-adventure payloads byte-identical to the committed ones** under the mutant.
- ⇒ The brief's predicted red on the preset md5 row **cannot fire** (see *What the brief got wrong*, item 1).
- Restored, and the tree was clean.

## D4 — the in-app row (`tasw-concept-prose-in-play`)

**The fixture:** `procgen_topdown/AP_11`, loaded as `tasw-gate-holds-in-play` loads it and **changed in memory only**:
- The first `Has`-gated exit of the first text-adventure room behind an open exit is `Overworld/YellowCastlePort → YellowCastle`, originally `Has(Yellow Key)`. The document re-gates it on `Has(Progressive Sword)`.
- `Progressive Sword` joins the item table.
- The room's payload is rewritten **through the entry's own hooks**: `deserializeWorld` → `placeFromRules` with `params.concepts: ['guardian','sword']` → `extractPathsAndObstacles` → `serializeWorld`.

I used neither of the brief's two options (built through the engine, or a hand-built two-region rules.json). The pipeline route needs T1's seam, and adapting a committed fixture reuses the proven load/identity/click scaffolding.

**It asserts:**
- **Without the sword:** the exit is `tae-link-inaccessible`; the engine displayed the guardian's `blocked` prose (templated with `YellowCastle`) and not the generic line; and a click leaves the player in the room for 2000 ms.
- **With the sword:** the exit opens, a click moves the player to `YellowCastle`, and the `passedWith` prose was displayed.
- The sword is removed in a `finally`.

**Pass line:** `npm test -- --port=8720 --mode=test-substrates --batch=fast --test=tasw-concept-prose-in-play` → `[PROGRESS 1/1] tasw-concept-prose-in-play PASSED 3.0s` · `totals: 1 run · 1 passed · 0 failed`. It passed again on the merged head.

All 17 conditions were read back from the results JSON; none is vacuous.

**Mutant:** `proseDocFor` returns the file only.
- Predicted: FAIL on the blocked prose.
- Measured: `FAILED 7.9s`, `STUCK` on "the engine displayed the guardian's blocked prose" (+ "…and not the generic line", + the `passedWith` condition).
- Restored.

**Neighbours still pass:** `tasw-gate-holds-in-play` PASSED 11.2s, and `tasw-compass-grid-renders-procgen-sides` PASSED 0.9s. The row is in `playwright_tests_config-substrates.json` beside its sibling.

## D5 — records

- **`text-adventure.md`:** `prose` in the payload list (and why the deserializer carries it); a new § *Prose and its resolution order*; a new § *Concept realisations*; the entry paragraph; the in-app test list.
- **`concepts.md`:** one § *The text adventure* paragraph.
- **Regenerated:** the procgen README index and `docsIndex.js`. The Quick Launch index regenerates to main's bytes (153 docs).
- **Link census:** T2 alone went 312 → 316 (`doc` 239 → 242, `same-doc` 15 → 16). Merged with B1's 312 → 313, the sum is **317, `doc` 243, `same-doc` 16**. Both pin comments carry the arithmetic.

## What T0's API was short of (worked around locally; no edit to T0's modules)

1. **`selectRealisation` wants an entry, but the hook lives in a module the entry imports.** `textAdventureRoom.js` cannot import `textAdventureSubstrateWrapperLibrary.js`: that would be circular, and it pulls in `index.js`. I pass a minimal view, `{id, conceptRealisations}`, built from the same data module the entry declares. A `selectRealisation(rule, realisations, …)` overload would remove the view.
2. **There is no reverse of `itemIdOfNeed`** ("which item concept is this placed AP item?"). I wrote `realisedItemConcept` locally: it matches `CONCEPTS[cid].item.id` for an item concept that is offered and realised.
3. **`rng.choice` vs `pick`** (T0's own warning) was not hit here, since there are at most 1 candidate. A future text-adventure realisation that shares a need (e.g. two sword-gated concepts) would draw on `input.rng`. Nobody has checked that `input.rng` carries `choice`.

## What the brief got wrong (measured)

1. **Mutant (b) cannot red the preset md5 row.**
   - **0 of the 15** committed text-adventure payloads name `Progressive Sword` or `Progressive Swim` (a sweep over every `preset_sidecars`).
   - The committed text-adventure worlds (AP_10–12, `jta_mixed_test`) are Adventure-derived, and they gate on Adventure's own item (`Sword`, id 7), not on the concept's `Progressive Sword`. So even with `offered` ignored, no committed text-adventure gate selects.
   - Besides, nothing regenerates the committed files during a gate run.
   - The unit rows are the ones that red. **Consequence for the trial:** no existing text-adventure preset will show concept prose, even after T1 lands, unless it is rebuilt from a source whose rules use the concept items.
2. **"`{destinationRegion}` where the file's own prose does":** the per-game file uses it **0** times. I used it anyway, because the bridge passes it for both exit messages.
3. **`prose.locations: {<name>: …}`:** a freshly built room has no AP name until `serializeWorld` bakes one, so the room keys by location id and the serializer re-keys. The brief's shape is the payload's shape; the world's differs.
4. **Mutant (a) "⇒ the first row reds":** 3 rows red (see D2).
5. **The bootstrap does not check out `frontend/modules/textAdventureEngine`.** Its default is `shared` only, and the in-app row needs the engine. I initialised it read-only from `/root/CC/mirrors/archipelago-textadventure-engine.git`. This changes `.git/config` only; no edit was made under the path.

## Residue

**For T2b (the per-game file into the sidecars), still needed:**
- **The non-procgen Adventure preset (`?mode=textadventure`) has no `preset_sidecars`,** so the `prose` field has nowhere to live for it. This is the open decision the brief named. Either that preset gains sidecars, or the file stays for standalone play.
- **The file's `settings` and `items` sections, and `regions[*].description`, have no home in `prose`.** The schema refuses them; `description` is not read by the templating either.
- **The file keys exits by AP name; `prose` keys them by `exit_id`.** A migration must map each name to its region's `exit_id`. Every committed room has `exitName === exit_id`, but the migration should not assume it.
- **The fetch and its 404 per game stay** until then.

**Other residue:**
- **Generation paths:** `placeFromItems` (the spiral / grid-growth placer) writes no item prose; only `placeFromRules` does. Separately, `rebuildEnvelopeFromRulesJson` re-runs `placeFromRules` from the document. Unless the world's `concepts` are persisted somewhere the rebuild reads, a rebuilt text-adventure payload loses its `prose` (T1's seam decides this; flag it there).
- **Round trip:** `regionRoundTrip.save` now carries `prose` through (deserialize → serialize), but no row pins it.
- **Bridge cache staleness:** `_regionProse` is replaced on each `loadRegion` and cleared on a standalone load. A procgen → procgen reload with a shared region name keeps the old prose until that region's `loadRegion` fires again. This is the same staleness `_exitSideOverrides` already has.
- **Merge collisions:** merging with T1 will collide on the `substrate-registry.md` row (keep one) and on the link-census pins (sum them). T1's maze paragraph in `concepts.md` sits beside mine, before § *What the chart reads*.
- **Rules followed:** no edit under a submodule, to T0's modules, the pipeline engine, `presetRun.js`, `substrateCapabilities.js`, `package.json` or any committed preset. No pytest, no unfiltered vitest, no `git stash`.
