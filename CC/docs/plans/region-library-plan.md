# Region library: zone-concept cleanup + pre-built region reuse from JSON

**Date:** 2026-07-13 · **Status: IMPLEMENTED — ALL of F1–F5 DONE + gated 2026-07-13
(Opus, on `main`, NOT pushed).** Cleanup C1–C3 + features F1, F2, F3 (loader core
+ panel UI), F4, and F5 (capture UI) are DONE and gated; the §5.3
world_generator/Generate.py end-to-end passes 13/13 and the browser panel is
proven by `verify-region-library-ui.mjs` (20/20: F3 selection byte-identity
through the panel + hybrid-persistence reload + F5 capture→validate→
re-instantiate). **Remaining: F6 (sphere-growth reuse / exit relabel, stretch) —
the only deferred item.** Per-phase commit log in §7. Shape confirmed with the
user (rulings in §0b). This is the dedicated session the handoff parking-lot item
5 called for ("reevaluate the whole zone concept"), extended with the feature
that motivates the cleanup: a user-selectable library of pre-built regions
loadable from JSON.

## 0. Why this exists

### 0a. The zone-concept audit (this session's findings)

"Zone" in the codebase conflates two orthogonal things:

1. **An interface** — "this substrate has no tile-procedural hooks
   (`generateRegionCore`/`placeFromRules`/`extractPathsAndObstacles`); give it
   fictional geometry." The engine synthesizes `exit_<side>` exits at
   perimeter midpoints of a nominal size and the substrate contributes
   locations/exit-rules/payload (`assembleZoneRegion`,
   `procgenPipelineEngine.js:2487`).
2. **A content model** — a finite, ordered, pre-existing content list:
   `zoneCount`, quota capped at it, Nth region of a substrate = zone N in
   spiral order, each zone used at most once (`realiseSpiralRegions`
   zoneCounter, `procgenPipelineEngine.js:3123-3151`).

Only **jta** actually matches "pre-built reusable content" (payload-by-
reference `{jtaZone: N}` into one stateful game build/dataset). **Bounce and
runner** use the zone *interface* for content they *generate* (lazy zone
table or `generateZoneForSpecs`), payload-by-value, self-contained.

What is already substrate-agnostic (NOT what distinguishes zones):

- **Exit reconnection**: every region emits `targetRegion: null` resolved by
  `stitchGrid`; `wallOffUnusedExits` closes surplus.
- **Location replacement**: the procedural branch overrides geometry-derived
  location ids/rules with the caller's spec
  (`generateRegionProcedural`, `procgenPipelineEngine.js:2695-2712`); zone
  substrates map internal content to arbitrary namespaced AP ids.
- The unified `generateRegion(spec)` contract (Phase 2a,
  `procgenPipelineEngine.js:2558`) was explicitly written to dissolve the
  procedural/zone dichotomy — but the spiral driver still bypasses it.

The two **irreducible** differences a reuse design must handle:

1. **Access-rule realisation.** Procedural substrates make geometry match the
   rule (`placeFromRules`). Fixed content can't regenerate, so it must either
   annotate rules purely logically (jta — logic looser than physics,
   deliberate), carry bridge-evaluated `logic_gate` locks (bounce/runner
   non-geometry terms), or negotiate capability
   (`canHostExitGates`/`exitGateVeto`/`gateHostingHint`).
2. **Exit-geometry decoupling.** Zone exits are fictional or a re-keyable
   side→portal map (`moveSphereExitSide` is a relabel, geometry untouched,
   `procgenPipelineEngine.js:4284`; throws without
   `playable_payload.params.sidePortals`). A maze exit is a real hole in a
   real wall — retargeting is free; *moving/adding* means editing tiles.

Obsolete-leaning / legacy findings:

- `synthesizeZonePayload` — jta is the only user; `extractZoneRules`'
  `payload` field supersedes it (they compose at
  `procgenPipelineEngine.js:2533`).
- Ordered-index-as-difficulty (Nth region = zone N) encodes jta vanilla's
  exponential zone backbone; raw-value economy mode already removed
  position-as-difficulty for datasets. Still load-bearing for jta today
  (perk-count rules key on `zoneIdx`; one stateful game).
- `extractZoneRules` (index-driven, substrate decides) vs
  `generateZoneForSpecs` (spec-driven, engine decides) are two contracts for
  one idea; jta has only the former (so cannot sphere-grow), bounce has both.
- `zoneCount` really means "content pool size"; consumers are quota
  validation (`procgenPipelineEngine.js:3046-3061`) and the counter.

**Reframing adopted by this plan:** a zone-based substrate is a **content
source** — something that supplies region descriptors, either generated on
demand (procedural, `generateZoneForSpecs`) or drawn from a pool
(jta zones, and now: library entries). The library feature is the second
pool-backed content source, and the first that is *data, not code*.

### 0b. User rulings (2026-07-13, this session)

1. **Storage: BOTH.** A served, indexed directory of committed library files
   (the `preset_files.json` pattern) **and** ad-hoc user file-load
   (picker/drag-drop, persisted in localStorage).
2. **Authoring: BOTH, with tooling.** Capture-from-pipeline ("save region to
   library") **and** hand-authoring support via a validator/authoring helper
   in v1.
3. **One plan, cleanup first.** The library lands on the unified contract;
   cleanup phases precede feature phases in this doc.
4. **v1 substrates: maze + bounce.** Exercises both exit-flexibility cases
   (tile geometry with side-fixed exits; sidePortals relabeling). jta is
   excluded *by nature* — its zones are indices into one stateful game, not
   portable content.

## 1. Ground facts (verified this session; cites are current HEAD)

- **Zone build path (spiral):** `realiseSpiralRegions`
  (`procgenPipelineEngine.js:3100-3195`) → `synthesizeZoneRegion` (`:2468`) →
  adapter `extractZoneRules(zoneIdx, {region_id, exitSides, regionSize})` +
  `synthesizeZonePayload(zoneIdx)` → `assembleZoneRegion` (`:2487`): synthetic
  `exit_<side>` at `perimeterMidpoint` (`:2434`), always-open unless the
  substrate supplied `exitPaths`/`exitRules`; locations pass through with
  `paths` defaulting to open. Quota validation `:3038-3062` (zoneCount cap).
- **Zone build path (sphere/top-down):** `generateRegionZoneGen` (`:2739`)
  consumes specs (side + requirement), calls
  `generateZoneForSpecs[Gen]`, keys exits by SPEC `exit_id`, stamps
  `playable_payload.entrance`. `buildSphereZoneRegion` (`:3946`) feeds it.
- **Procedural build path:** `generateRegionProcedural` (`:2604`):
  `generateRegionCore` → `placeFromRules` (retry-then-grow so locations are
  never dropped) → `extractPathsAndObstacles` → spec-id/rule override.
- **Serialized-region re-import already exists:**
  `rebuildEnvelopeFromRulesJson` (`:3600`) rebuilds live regions from
  `preset_sidecars` via `adapter.deserializeWorld` +
  `extractPathsAndObstacles` — *procedural substrates only*; zone substrates
  throw ("no path extractor", `:3640-3645`). Consequence for the library
  format: **tile entries can store payload only and re-derive rules; bounce
  entries must carry their emitted rules/paths/obstacle_defs.**
- **Sidecar round-trip:** `buildPresetSidecars` (`:5043`) re-attaches
  `region.exits`/`region.entrance` then `adapter.serializeWorld`; the jta
  entry's `deserializeWorld` converts exits array ↔ Map. Sidecar filename
  convention `${region_id}.json`.
- **② content step is the residency seam for data documents:**
  `SPIRAL_STEPS = ['arrange','content','regions','compile']`
  (`spiralSteps.js:56`); a world "has content" only when
  `adapter.emitsSpiralContent` AND `substrateConfig[id].datasetDoc` is
  present (`:60-67`); the comment at `:66-67` already says "generalise the
  field if a second content kind appears" — **the library is that second
  kind**. `onContentEdit` restamps hand edits (content-hash → new id) and
  clears downstream (`:221-246`).
- **Identity/validator precedent:** `datasetValidator.js`
  (`validateJtaDataset`, `stampDatasetIdentity`) — content-hash ids; an
  edited document must never keep its id (poisons caches/save slots).
- **Index-file precedent:** `frontend/presets/preset_files.json` consumed by
  `presetUI.js` et al.
- **Byte-identity gates exist and must stay green:**
  `scripts/procgen/dump-spiral-byteidentity.mjs` (dataset-less spiral worlds
  byte-identical), plus the stepped-pipeline dataset gates
  (stepped-pipeline.md §JtA dataset residency).
- **Exit relabel for sidePortals substrates:** `moveSphereExitSide` /
  `swapSphereExitSides` (`procgenPipelineEngine.js:4284,4306`).
- Substrate unit tests only run in the **test-substrates** config (memory:
  `reference_substrate_test_mode`) — new tests must be registered there.
- New frontend modules must be added to `__BUNDLED_MODULES__` in
  `init-bundled.js` (memory: bundled-mode registration).
- Pipeline panel auto-saves everything — any new control must call
  `_saveToLocalStorage()` (memory: procgen panel autosave).

## 2. Design

### 2a. Library document format (multi-file)

One JSON file = one **region library**:

```json
{
  "schema_version": 1,
  "library_id": "<stamped content hash>",
  "name": "My Maze Pack",
  "description": "optional",
  "entries": [
    {
      "entry_id": "mz_cross_01",
      "name": "Crossroads",
      "substrate": "maze",
      "region_size": { "width": 15, "height": 15 },
      "exit_sides": ["N", "E", "S", "W"],
      "payload": { /* adapter.serializeWorld output (sidecar form) */ },
      "carried_rules": null,
      "location_slots": 4
    },
    {
      "entry_id": "bn_gate_01",
      "substrate": "bounce",
      "exit_sides": ["E", "W"],
      "payload": { /* bounce level + params.sidePortals */ },
      "carried_rules": { /* extracted exits/locations/paths + obstacle_defs */ },
      "location_slots": 2
    }
  ]
}
```

- **Identity:** `library_id` is a stamped content hash (datasetValidator
  pattern — new module `regionLibraryValidator.js`, shared by the loader, the
  capture path, and a CLI restamp/validate script). `entry_id` is unique
  within the file, author-chosen (stable across restamps so selections and
  provenance survive edits).
- **Two capture contracts, per §1:** procedural entries store `payload` only
  (`carried_rules: null`) — instantiation re-derives via `deserializeWorld` +
  `extractPathsAndObstacles`, so rules can never go stale against the
  geometry. Zone-substrate entries (bounce) store `payload` +
  `carried_rules` verbatim (their geometry cannot be re-derived).
- **Capability metadata** (`exit_sides`, `location_slots`) is *denormalized
  for selection UI/placement fit* but **revalidated on load** against the
  payload (fail loudly on mismatch — hand edits must not lie to the picker).
- Multiple files load side by side; entries are addressed
  `(library_id, entry_id)`.

### 2b. Adapter hooks (new, optional; implement for maze + bounce)

- `captureLibraryEntry(region) → entry` — serialize a live region descriptor
  into the entry shape above (strip instance identity: `region_id`, exit
  targets, placed items; keep geometry/level, sidePortals, and for bounce the
  emitted rules with location ids reduced to slot-local names).
- `instantiateLibraryEntry(entry, ctx) → { zoneRules, zonePayload }` — the
  content-source instantiation: `ctx = { region_id, exitSides, regionSize,
  rng? }`. Returns exactly what `assembleZoneRegion` consumes (locations with
  slot-namespaced ids, per-side exit paths/rules, payload, obstacle_defs).
  Maze: deserialize + re-extract, then re-stamp ids. Bounce: rehydrate
  carried rules, re-key `sidePortals` to the requested sides (relabel — the
  `moveSphereExitSide` logic factored to a pure helper).

### 2c. The library as a content source in the engine

After cleanup C2/C3 (below), the spiral driver consumes content sources
through one seam. Loaded libraries register a **dynamic content source**
(id `library:<library_id>`, label from the file) whose pool is the file's
entries. It appears in the pipeline panel's quota UI alongside substrates.

- **Placement fit (v1):** an entry can fill a slot iff the slot's required
  `exitSides` ⊆ the entry's `exit_sides` (surplus sides are walled off by the
  existing `wallOffUnusedExits`). Selection strategy: prefer unused entries,
  repeat when the pool is exhausted (**repetition allowed** — entries are a
  palette, not consumables; the once-each rule was jta legacy. Location ids
  are already namespaced by `region_id`, so repetition is safe). If no entry
  fits a slot's sides, fail loudly with the slot/sides in the message.
- **Rendering:** the entry's `substrate` field routes runtime identity —
  the instantiated region carries the *original substrate's*
  `panelComponentType`/`loadRegionEvent`/`iframeId` (a library maze region IS
  a maze region at runtime; nothing new to render).
- **Rules/items (v1, spiral):** exits always-open (spiral convention); the
  scenario pool places items on the entry's location slots via the engine
  spec, exactly like zone locations today. Requirement-targeted reuse
  (sphere) is F5, deferred-able.
- **rng:** instantiation may draw rng only for entry *selection* (documented,
  single draw per library slot after the plan shuffle) — never inside an
  entry. Keeps ③ deterministic and dataset-less worlds byte-identical
  (libraries absent ⇒ zero new draws).

### 2d. Loading + selection surfaces

- **Served libraries:** `frontend/region-libraries/` +
  `region_library_files.json` index (name, file, entry count, substrates).
  Loader fetches the index, panel shows checkboxes; selection + loaded
  ad-hoc files persist via the panel's `_saveToLocalStorage()`.
- **Ad-hoc load:** file picker/drag-drop onto the same panel section;
  validated + restamp-checked on load; stored in localStorage with the
  selection.
- **Residency in the stepped pipeline:** selected library documents ride
  `substrateConfig` into ① and land on the envelope at ② as content
  (generalizing the `datasetDoc`-only field — see C3). Hand-editing a
  library document in ② restamps `library_id` and clears downstream, same
  contract as the jta dataset.

## 3. Cleanup phases (first — the feature lands on these)

Every phase ends with the byte-identity gate green
(`dump-spiral-byteidentity.mjs`) and its own commit.

- **C1 — absorb `synthesizeZonePayload`.** Move jta's `{jtaZone: zoneIdx}`
  into its `extractZoneRules` payload; delete the hook from
  `synthesizeZoneRegion`, the registry docs
  (`substrate-registry.md`), and the jta entry. Gate: jta preset sidecars
  byte-identical; jta roundtrip gates stay green.
- **C2 — spiral zone path onto the unified seam.** `realiseSpiralRegions`
  builds a per-slot spec and calls one content-source seam instead of the
  `typeof adapter.zoneCount === 'number'` branch pair (`:3142-3173`).
  Constraint: procedural slots must draw rng in the exact monolithic order;
  zone slots draw none. This is a refactor, not a behavior change — gates:
  byte-identity, stepped-spiral dataset gates, jta locations roundtrip.
- **C3 — content-source contract + ② content generalization.** Name the
  contract (registry group "content sources": pool size, `instantiate`,
  ordering semantics) wrapping today's `zoneCount`/`extractZoneRules`;
  generalize `substrateConfig[id].datasetDoc` / `worldHasContentSubstrate`
  (`spiralSteps.js:60-83`) so a second content kind (the library) can ride ②
  — per the existing code comment anticipating exactly this. Update
  `docs/json/developer/procgen/substrate-registry.md` + `stepped-pipeline.md`
  + `architecture.md` with the reframing (and record the §0a audit verdicts:
  what was obsolete, what remains jta-specific).
- **C-out-of-scope:** unifying `extractZoneRules` with
  `generateZoneForSpecs` into one spec-driven contract, and jta-on-sphere.
  Documented as the eventual direction in C3's doc updates; not attempted
  here.

## 4. Feature phases

- **F1 — schema + validator + identity.**
  `frontend/schema/region-library.schema.json`; `regionLibraryValidator.js`
  (validate, stamp/restamp, capability-vs-payload revalidation); CLI
  `scripts/procgen/region-library-validate.mjs` (the hand-authoring helper —
  ruling 2). Unit tests (registered in the test-substrates config).
- **F2 — capture hooks.** `captureLibraryEntry` / `instantiateLibraryEntry`
  for maze + bounce (§2b), with a pure-function roundtrip test per substrate:
  generate → capture → instantiate in a fresh context → compare geometry +
  re-derived/carried rules (independent stratum: for maze, compare
  *re-extracted* rules, not the captured ones — the verifier must not share
  the capture's assumptions).
- **F3 — loader + selection UI.** Served index + fetch; ad-hoc file load;
  panel section with per-library checkboxes + entry summaries; persistence
  via `_saveToLocalStorage()`; dynamic content-source registration
  (`library:<id>`); quota UI integration. Bundled-mode registration if any
  new module file is added.
- **F4 — spiral placement integration.** Fit-based entry selection (§2c),
  repetition policy, loud no-fit failure; library documents riding
  ①-install/②-content/③-instantiate (C3 seam); `onContentEdit`
  restamp-and-clear for hand-edited library docs.
- **F5 — capture UI.** "Save region to library ▸" on the pipeline panel
  region view (and the bounce region editor): appends to a localStorage
  "working library", with export/download of the JSON file (which can then be
  committed to `frontend/region-libraries/` and indexed).
- **F6 — sphere-growth reuse.** Requirement-targeted placement of library
  entries. **F6a DONE** (bounce, overlay gates) — see §7 + `region-library-f6-plan.md`
  §3b for the rulings. F6b (capability negotiation / physical enforcement),
  F6c (maze + exit-carve) and F6d (capture/UI parity) remain deferred; nothing in
  F1–F5 depends on any of them.

## 5. Gates / acceptance

1. `dump-spiral-byteidentity.mjs` green after every phase (library absent ⇒
   byte-identical worlds).
2. Per-substrate capture→instantiate roundtrip unit tests (F2), in the
   test-substrates config.
3. End-to-end: a committed demo library + preset whose spiral world mixes
   `library:*` slots with a procedural substrate; world_generator +
   Generate.py roundtrip on it (the `verify-jta-locations-roundtrip.mjs`
   pattern); an in-app solve test (test-spoilers) proving the reused regions
   are playable and their relocated locations check.
4. Validator CLI rejects: stale `library_id` after edit, capability metadata
   contradicting payload, unknown substrate, duplicate `entry_id`.
5. Existing stepped-spiral dataset gates stay green throughout (the ②
   generalization must not disturb jta dataset residency).

## 6. Open questions (decide at implementation, none block the start)

1. **Exit-carve op for tile substrates** — when no entry fits a slot's
   sides, v1 fails loudly; a "carve exit on side S + re-extract" op would
   lift the constraint. Deferred; revisit with F6.
2. **Selection strategy knobs** — per-library quota vs one pooled quota;
   deterministic entry order vs rng pick. v1: pooled per-library quota,
   prefer-unused-then-repeat, single rng draw per slot.
3. **Authored default items/rules on entries** — should an entry be able to
   ship suggested locations items/rules (a "scenario"), or stay pure
   geometry? v1: pure geometry + slots; engine owns items/rules.
4. **Runner entries** — same zone-substrate contract as bounce; add after
   the bounce path proves out (its `sidePortals` equivalent needs checking).
5. **Where captured location slots come from for maze** — all reachable
   placed locations at capture time vs a capacity number + fresh placement at
   instantiate. v1 leans fresh placement (slots = capacity), since
   `placeFromRules` on a deserialized world is exactly the existing
   re-import path; verify `placeFromRules` behaves on a deserialized world
   early in F2 — if it doesn't, fall back to captured slot positions.
   **RESOLVED (F2): captured slot positions.** `placeFromRules` DOES work on a
   deserialized world (verified), but the plan's rng-free-instantiate constraint
   (§2c "never inside an entry") forbids fresh rng placement — so v1 reuses the
   captured slot positions deterministically. It's not the open-q's fallback for
   the reason the open-q anticipated (a failure); it's the primary choice the
   rng discipline dictates.

## 7. Implementation status + per-phase commit log (2026-07-13, Opus)

On `main`, NOT pushed. Every phase kept `dump-spiral-byteidentity.mjs` at 5/5
(library-absent worlds byte-identical) and its own gates green.

- **C1** `ab9de8a4a` — absorb `synthesizeZonePayload` into jta `extractZoneRules`
  (jtaZone first payload key; hook deleted from engine + jta entry +
  substrate-registry.md). Byte-identical.
- **C2** `f7c0679aa` — route the spiral zone path through one
  `resolveSpiralContentSource` seam (id→source; renamed zoneCounter→ordinalCounter).
  Pure refactor.
- **C3** `a9bb806d4` — name the content-source contract + generalize ② content
  (`spiralContentConfigKey`, default `datasetDoc`; `contentDocId` reads
  dataset_id/library_id). Docs: substrate-registry.md ("content sources" section
  + the zone audit verdicts + out-of-scope), stepped-pipeline.md, architecture.md.
- **F1** `91fe37e15` — schema (`region-library.schema.json`) + `regionLibraryValidator.js`
  (content-hash identity, per-substrate capture contract, capability-check seam) +
  CLI `region-library-validate.mjs`. 12 unit tests.
- **F2** `a71f5bd83` — `captureLibraryEntry`/`instantiateLibraryEntry`/`validateLibraryEntry`
  for maze (`mazeLibraryEntry.js`, re-derived rules) + bounce (`bounceLibraryEntry.js`,
  carried rules, assembleZoneRegion re-assembly — now exported). 7 roundtrip tests
  (maze uses an independent re-extract stratum). **Finding:** the ⊆ fit rule means
  NO geometry relabel (moveSphereExitSide) is needed in v1 (deferred to F6).
- **F4** `d1cb6b6d4` — `library:<id>` as a spiral content source
  (`buildLibraryContentSource`: config-carried `libraryDoc`, fit + prefer-least-used
  + repetition + loud no-fit; arrange-time validation; stepped ② residency via
  `LIBRARY_CONTENT_ADAPTER`; onContentEdit restamp). 7 spiral-library tests.
- **§5.3 e2e** `f5768f336` — committed `frontend/region-libraries/demo-maze-pack.json`
  + index; `verify-region-library-roundtrip.mjs` (13/13: world_generator +
  Generate.py, relocated locations reachable/checked, winnable). **Fillability
  fix:** the engine stamps `LIBRARY_SLOT_FILLER_ITEM` on un-itemed slots
  (classified 'filler' by compileRegionGraph) so the pool balances 1:1 with
  locations — a maze region is 1 item/location; an un-itemed slot was unfillable.
- **F3 (core)** `0da14c365` — `regionLibraryLoader.js` (fetch/parse/validate
  served + ad-hoc; `buildLibrarySpiralConfig`; `isLoadedLibrarySource`). 7 tests.
- **F3 (panel)** `58a9c1c5f` — `_renderRegionLibrariesSubsection` (served
  checkboxes + per-library count + ad-hoc file loader), hybrid-persistence glue
  (`_serializedLibraries`/`_setPersistedLibraries`/`_resolveRegionLibraries` with
  the `_pendingLibraryRefs` async window), `_buildSpiralEnvelope` merges
  `buildLibrarySpiralConfig`. Gated by `verify-region-library-ui.mjs` Phases A+B.
- **F5** `c68fbbe68` — "Capture to library" area + sphere-③ Save button →
  `_captureRegionToLibrary` (adapter `captureLibraryEntry`, revalidated) → session
  working library → Download (content-hash-stamped, committable) + Clear. Verifier
  Phase C: Save → Download → validate + re-instantiate.

### F1–F5 ALL DONE (hybrid ruling); only F6 deferred

**Design question RESOLVED (user, 2026-07-13): HYBRID.** Served packs persist as
`{ source:'served', file, library_id, count }` references (re-fetched on load,
drift-detected via the stored `library_id`); ad-hoc / ②-edited libraries persist
inline as `{ source:'adhoc', doc, count }`. Rationale: keeps the everyday
"tick a committed pack" bundle tiny and lets packs stay living, while ad-hoc and
edited docs stay self-contained.

**Built + tested** (`4bdec077b`, all headless):
- `regionLibraryLoader.serializeLibrarySelection` / `resolveLibrarySelection`
  (async re-fetch; drift = warning + use current file; missing = error + drop),
  `buildLibrarySpiralConfig`, `isLoadedLibrarySource` (the substrate-filter
  guard so `library:<id>` quotas survive).
- `presetDefs.capturePresetState`/`applyPresetState` carry `libraries` (omitted
  when empty; passed through UNFILTERED — `library:*` ids have no registry entry,
  so `hasSubstrate` must not touch them). Note the earlier "panel carries no
  substrateConfig" gap is now moot: libraries ride the panel bundle as the
  `libraries` selection, and the panel assembles `substrateConfig` at generate
  time via `resolveLibrarySelection` → `buildLibrarySpiralConfig`.

**Panel DOM — DONE** (`58a9c1c5f`): the "Region libraries" section fetches the
served index (`loadServedIndex`), renders per-library checkboxes (name + entry
count + substrates) with a per-library region-count input + an ad-hoc file loader
(`parseRegionLibrary`, restamp-on-load); every control calls
`_saveToLocalStorage()`. At generate time `_buildSpiralEnvelope` calls
`buildLibrarySpiralConfig(this.regionLibraries, { substrateQuotas, substrateConfig })`
and merges into `growthParams` (libraries are held RESOLVED on the panel, so it's
synchronous — the async `resolveLibrarySelection` runs once, at load/preset-apply).
The generated world is byte-identical to the headless equivalent (verifier
Phase A). Note: because libraries live in their own `this.regionLibraries` list
(never in `substrateQuotas`), no `isLoadedLibrarySource` display-filter guard was
needed in the panel — the guard remains available for any future path that mixes
library ids into a substrate dict.

**F5 capture UI — DONE** (`c68fbbe68`): a "Capture to library" area lists the last
generation's regions with a per-region "Save to library ▸" (same button on the
sphere ③ edit rows) → `_captureRegionToLibrary` (`adapter.captureLibraryEntry`,
revalidated) → session working library (own localStorage key) → Download
(content-hash-stamped, committable to `frontend/region-libraries/` + re-indexed)
+ Clear.

**Gate — `scripts/procgen/verify-region-library-ui.mjs`** (verify-spiral-steps-ui
mould, dev server :8000, 20/20): Phase A drives the checkbox/count controls,
Generates, and asserts the downloaded rules.json === the headless
`buildLibrarySpiralConfig` + arrange + compile (byte-identity THROUGH the panel);
Phase B reloads and proves the served reference re-resolves + Generates the same
world; Phase C Saves a region, Downloads the working library, and asserts it
validates AND the entry re-instantiates into a self-contained maze region.

**F6a DONE** (2026-07-13, Opus, on `main`, not pushed) — see the F6a commit log
below. **F6b/F6c/F6d remain deferred** (capability negotiation, maze + exit-carve,
capture/UI parity); nothing in F1–F5 depends on them. The design brief +
resolved rulings are **`CC/docs/plans/region-library-f6-plan.md`** (§3b RULINGS) —
read that first for an F6b+ session.

### F6a — sphere-growth reuse (bounce, overlay gates), 2026-07-13

Rulings (all recommended; brief §3b): **bounce-first · overlay-only · keep loud
no-fit · rng-free**. Q5/Q6 defaults kept (pure geometry; re-derive at placement).

- **Bounce hook `instantiateLibraryEntryForSpecs`** (`bounceLibraryEntry.js`) —
  relabels the captured `sidePortals` + portal `direction` onto the node's
  SPECIFIC sides (entrance + child sides) by index, reassigns the node's items
  onto the captured pickup slots (engine filler on the surplus), returns
  GEOMETRY-only zoneRules. Registered on the bounce adapter.
- **Engine `buildSphereLibrarySource` / `buildSphereLibraryRegion`** — rng-free
  prefer-least-used fit-select (enough portals + slots, else loud no-fit); the
  gate rides as an access_rule **OVERLAY** (`sphereGateRule`) on each child exit +
  the entrance back portal (logic-looser-than-physics — the captured level is
  reused as pure geometry); `assembleZoneRegion` tail; `backExitSide`/`fallBehavior`
  parity. Dispatch branch in `realiseOneSphereNode` draws **zero rng** (no per-node
  seed); `resolveSphereLibrarySources` builds sources once from
  `growthParams.substrateConfig[id].libraryDoc`. Capability guards: `canHost`
  returns true for a library host (overlay hosts any gate); the upfront quota
  validation (both `growSpheresGen` + the batched driver) skips `library:<id>`.
- **Gates:** `dump-sphere-byteidentity` byte-identical with no library selected
  (library-absent worlds take no new code path — proven); `dump-spiral-byteidentity`
  5/5; `verify-region-library-roundtrip` 13/13; `verify-region-library-ui` 20/20.
- **New winnability e2e (independent stratum):**
  `scripts/procgen/verify-region-library-sphere-roundtrip.mjs` (16/16) — grows a
  bounce sphere world mixing the committed `demo-bounce-pack.json` with generated
  bounce regions → `world_generator` → `Generate.py`; AP's OWN fill places the
  goal + the sphere log references every relocated library location (winnable),
  which does NOT share the JS placement's assumptions. Pack generator
  `scripts/procgen/make-demo-bounce-pack.mjs` (committed, deterministic).
- **Unit suite:** `sphereLibrary.slow.test.js` (9 tests — placement + gate
  overlay + portal relabel + rng-free determinism + byte-inert at quota 0 + loud
  no-fit + missing-doc).
