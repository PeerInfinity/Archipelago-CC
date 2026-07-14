# Region library F6 — sphere-growth reuse (requirement-targeted placement)

**Date:** 2026-07-13 · **Status: F6a + F6d SHIPPED + PUSHED; F6c REFRAMED +
RULINGS SETTLED (implementation NOT started); F6b deferred.** Rulings resolved in
§3b; F6a shape + gates in main plan `region-library-plan.md` §7; F6d commit
`20e185682`. **F6c was reframed 2026-07-13 (user): configurable maze connection
settings + fix the runner library gap — the executable design is in §4 F6c; a
fresh session should START THERE.** This doc's §1–§2 (why sphere is harder, engine
seams) + §3b stay reference.
This is the last phase of the region-library arc (main plan
`CC/docs/plans/region-library-plan.md`; memory `project_region_library`). F1–F5
are DONE + gated (on `main`, not pushed): the library is a spiral **content
source** — pre-built maze/bounce regions placed by the shuffled-spiral driver,
selected/loaded/captured through the pipeline panel. F6 extends reuse to the
**sphere-growth** driver, where regions carry *access requirements*, not just
exit sides. It is a genuine design phase (the §0a "irreducible differences"), so
this doc frames the problems + open questions rather than prescribing code.

Nothing in F1–F5 depends on F6; it is an additive capability.

## 1. Why sphere is harder than spiral (what F4 already solved)

The spiral content source (`buildLibraryContentSource`,
`procgenPipelineEngine.js:3202`) is the easy case:

- A spiral slot is **sides-only**: `instantiate({ region_id, regionSize, exitSides })`.
- Fit = requested `exitSides` ⊆ entry `exit_sides` (surplus walled off by
  `wallOffUnusedExits`); prefer-least-used-then-declaration-order; repetition
  allowed; **no rng**; **exits always-open** (spiral convention). Engine owns
  items (stamps `LIBRARY_SLOT_FILLER_ITEM` on un-itemed slots).

Sphere growth is different in two ways the audit (main plan §0a) called
irreducible:

1. **Access-rule realisation.** A sphere slot's exits carry **gates** —
   per-child `{ side, gate: [items], gateCounts }` requirement arrays, plus an
   entrance gate and item-placement requirements (see `buildNodeRealiserSpecs`,
   `:4157`, and `buildSphereZoneRegion`, `:4103`). A *generated* zone
   (`generateZoneForSpecs`) builds geometry that physically enforces each gate.
   A *fixed* library entry cannot regenerate, so each gate must either be
   physically hostable by the entry (capability negotiation) or ride as a
   **`logic_gate` overlay** — a rule annotated onto the exit/location without
   physical enforcement (logic looser than physics, the jta-style contract;
   `logic_gates` counting at `:1260`).
2. **Exit-geometry decoupling.** A sphere slot needs *specific* sides
   (`entranceSide` mirrored from the parent's placed exit + child sides). A
   bounce entry's `sidePortals` are **re-keyable** (relabel via
   `moveSphereExitSide`/`swapSphereExitSides` — geometry untouched). A maze
   entry's sides are **real holes in real walls**: the ⊆ fit rule works, but a
   slot whose required side the entry lacks needs either rejection (loud
   no-fit, F4's policy) or an **exit-carve + re-extract** op (main plan §6
   open-q 1, deferred here on purpose).

## 2. Engine seams F6 touches (current HEAD line refs)

- **`buildSphereZoneRegion`** (`:4103`) — today routes a node's exitPlans +
  entrance + locations into `generateRegionGen` → `generateRegionZoneGen`
  (`:2744`) → `adapter.generateZoneForSpecs`. F6 adds a THIRD realiser branch:
  place a pre-built library entry against the same specs (a
  `instantiateLibraryEntryForSpecs` contract, requirement-aware, vs F4's
  sides-only `instantiateLibraryEntry`).
- **`buildNodeRealiserSpecs`** (`:4157`) — the pure per-node spec builder
  (sides, gates, entrance, item locations). F6's placement consumes this; it is
  already rng-free.
- **The sphere realise loop** (`growSpheresGen`, `:4775`) — where node
  substrate dispatches to procedural (`generateRegionCore`) vs zone
  (`generateZoneForSpecs`). A library node needs a dispatch entry here + in the
  capability guards at `:4817`/`:5019` (which currently reject substrates with
  neither hook).
- **Capability negotiation** — `exitGateVeto` / `canHostExitGates` (`:3620`,
  `:4019`) and `gateHostingHint` (`:3680`): how the tree builder decides which
  region can host an exit gate. A library entry's hostable-gate capacity must
  feed this so the planner doesn't assign a gate the entry can't carry.
- **Exit relabel** — `moveSphereExitSide` (`:4441`) / `swapSphereExitSides` (`:4463`):
  the bounce sidePortals relabel F6 reuses to fit an entry's portals to the
  slot's required sides.
- **F4 contrast** — `buildLibraryContentSource` (`:3202`) is the shape to mirror
  but requirement-aware.

## 3. Open design questions — RULINGS NEEDED (the point of the next session)

1. **Substrate scope for F6 v1.** bounce-only first (its sidePortals relabel
   makes side-fitting free, so only the gate problem remains), then maze? Or
   both together? *(Recommendation: bounce-first — it isolates the access-rule
   problem from the exit-geometry problem.)*
2. **Gate realisation strategy.** For a gate the entry can't physically enforce:
   (a) always ride as a `logic_gate` overlay (logic-looser-than-physics, jta
   contract — simplest, but the region is "walkable past" a gate it logically
   respects); (b) capability-negotiate — only place an entry on a slot whose
   gates it CAN host, else fall back to a generated zone; (c) hybrid: physical
   where hostable, overlay otherwise. *(This is the core ruling.)*
3. **Exit-carve op (main plan §6 open-q 1).** For maze entries: build it in F6
   (carve a new exit on the needed side + re-extract), or keep F4's loud
   no-fit + require the library to contain an entry with the sides? *(Carve is
   the bigger lift; may itself defer.)*
4. **RNG discipline.** Spiral instantiate is rng-free by contract (byte-identity
   for dataset-less worlds). Does requirement-targeted sphere selection draw rng
   (entry pick among fitters), and if so where in the stream so determinism
   goldens stay stable? *(Likely: a single documented draw per slot, mirroring
   F4's prefer-least-used but rng-tie-broken — needs a stated position.)*
5. **Item/location requirements.** Sphere locations can carry placement
   requirements; a captured entry's slots are pure geometry (F5). Does F6 let an
   entry advertise *suggested* location rules (a "scenario"), or stay pure
   geometry with the engine owning all rules (main plan §6 open-q 3, v1 = pure)?
6. **Capture parity.** F5 capture stores sphere-agnostic entries. Does F6 need a
   richer capture (e.g. carry hostable-gate metadata), or does re-derivation at
   placement suffice?

## 3b. RULINGS (user, 2026-07-13) — §3 resolved; F6a refined below

All four priority questions landed on the recommended option:

1. **Scope → bounce-first.** F6a places only **bounce** library entries into
   sphere worlds. Bounce's `sidePortals` are re-keyable (side-fitting is a
   relabel, geometry untouched — `moveSphereExitSide`), so the exit-geometry
   problem is free and only the access-rule problem remains. Maze (real holes +
   physical gates) is F6c.
2. **Gate strategy → overlay-only for F6a.** Each exit/entrance gate rides as an
   annotated `access_rule` (`sphereGateRule`) on the exit — logic-looser-than-
   physics, the blessed jta contract. The captured bounce level is reused as pure
   playable geometry; the AP LOGIC (rules.json) enforces the gate, not the
   level's physics (the region is "walkable past" the gate at runtime). This is
   sound under the AP-logic doctrine (winnability = bot/witness solve on LOGIC).
   Capability negotiation (physical enforcement where the entry can host) is F6b;
   the hybrid destination is deferred, not abandoned.
3. **Exit-carve → keep loud no-fit; defer.** Moot for bounce (relabel fits any
   side). Revisit in F6c.
4. **RNG → rng-free, mirror F4.** Entry selection is prefer-least-used-then-
   declaration-order among fitting entries; a library node draws **zero** rng —
   NOT even the per-node seed a generated zone node draws. Determinism goldens
   with no library selected are byte-identical by construction (no library nodes
   ⇒ no new branches taken); library-present worlds are trivially reproducible.
5. **Item/location rules → pure geometry (default kept).** The engine owns items
   (node.items map onto the entry's captured pickup slots; surplus slots get
   `LIBRARY_SLOT_FILLER_ITEM`, mirroring spiral). Entries advertise no scenario
   rules in v1.
6. **Capture parity → no richer capture (default kept).** F5 entries suffice;
   hostable-gate capacity is not needed under overlay-only (overlay hosts any
   gate). Re-derivation happens at placement.

### F6a implementation shape (as built)

- **Bounce adapter hook `instantiateLibraryEntryForSpecs(entry, ctx, deps)`**
  (in `bounceLibraryEntry.js`) — the requirement-aware sphere analogue of the
  spiral `instantiateLibraryEntry`. Owns the substrate-internal relabel: re-key
  `sidePortals` + set each portal's `direction` to the target side (the
  `moveSphereExitSide` relabel done at build time), rename the captured level's
  pickups to the node's location ids + items, stamp filler on surplus pickups,
  and return GEOMETRY-ONLY `zoneRules` (`{ locations, payload, obstacleDefs:{} }`,
  no exit rules). Keeps the engine substrate-agnostic — the gate overlay is the
  driver's, composed engine-side.
- **Engine `buildSphereLibrarySource(id, doc)` + `buildSphereLibraryRegion`** —
  a stateful sphere content source (usage counter persists across nodes for
  prefer-least-used, like `buildLibraryContentSource`). `buildSphereLibraryRegion`
  fit-selects a bounce entry (enough portals for child sides ∪ entrance side;
  enough location slots), calls the hook, then OVERLAYS `exitRules[side] =
  sphereGateRule(childGate)` for each child exit and `exitRules[entranceSide] =
  sphereGateRule(entryGate)` for the back portal, and assembles via
  `assembleZoneRegion`. Sets `playable_payload.params.backExitSide` +
  `fallBehavior` (parity with `generateRegionZoneGen`). Loud no-fit.
- **Dispatch** in `realiseOneSphereNode`: `isLibrarySourceId(node.substrate)` →
  `buildSphereLibraryRegion` (no rng draw). Library sources built once in
  `growSpheresGen` and threaded through `realiseSphereNodes`.
- **Capability guards:** `canHost` returns true for a library-substrate host
  (overlay hosts any gate; still bounded by usedSides < 4); the upfront quota
  validation in `growSpheresGen` + the batched driver accept `library:<id>` ids
  (validated against `growthParams.substrateConfig[id].libraryDoc`) instead of
  throwing "not registered / no realiser hook".

## 4. Phase breakdown (F6a DONE; F6b/c/d refined with F6a's learnings)

- **F6a — bounce sphere placement (overlay gates). ✅ DONE (`c7cdd687c`).**
  Built as `buildSphereLibrarySource`/`buildSphereLibraryRegion` (engine) + the
  bounce adapter hook `instantiateLibraryEntryForSpecs` (relabel + item map) +
  the dispatch branch in `realiseOneSphereNode` (zero rng) + capability guards
  (`canHost` → true for a library host; quota validation skips `library:<id>`).
  Gates all green; independent stratum = `verify-region-library-sphere-roundtrip.mjs`
  (Generate.py fill). Full facts in main plan §7 + memory.

- **F6b — capability negotiation (physical enforcement). NEXT, needs rulings.**
  Today F6a's `canHost` returns TRUE for any library host and every gate rides as
  an overlay — logically correct, but the runtime level is "walkable past" the
  gate. F6b upgrades a gate to PHYSICAL where the entry can host it, overlay
  otherwise (the hybrid Q2 destination). **The hard part** (already scoped in §1):
  the tree builder assigns a node's gates at TREE-BUILD time, BEFORE the entry is
  fit-selected at realise time — so the planner can't know the eventual entry's
  hostable-gate capacity. Ruling candidates: (a) a per-library **capability
  profile** (the pool advertises a common hostable-gate envelope; `canHost`
  consults it instead of blanket-true) — simplest, but conservative; (b) **defer
  entry selection into tree-build** (select the entry when the node is gated, so
  its real capacity feeds `exitGateVeto`) — most faithful, biggest refactor;
  (c) keep overlay as the floor and only physically enforce gates the entry
  already carries verbatim (`assembleBounceRegionFromLevel` is the tool — it
  re-derives + verifies a level against specs and THROWS on mismatch, which is
  exactly the "can this entry host this gate?" test). Whichever: byte-inert at
  defaults still holds, and the winnability stratum stays Generate.py fill.

- **F6c — REFRAMED 2026-07-13 (user): configurable maze connection + fix the
  runner library gap. RULINGS SETTLED; implementation NOT started.** The original
  ⊆-fit-vs-exit-carve framing was based on an INCOMPLETE analysis — see the
  enabling finding below. Do **runner first, then maze** (user sequencing ruling).

  **KEY ENABLING FINDING (procgenPipelineEngine.js `stitchGrid` @ :491):** region
  links are resolved BY SIDE — `exit.target_region = grid.neighborCell(cell, side)`.
  Tile position is used only to look up the side (`exits_placed`) + for rendering;
  it does NOT gate the logical connection. So a maze region whose opening is on the
  correct SIDE but the "wrong" tile still connects correctly in AP logic. That means
  **"no tile alignment" is winnability-sound under the overlay doctrine** (the F6a
  logic-looser-than-physics contract): the connection holds logically; only the
  physical opening may not line up (like F6a's "walkable past the gate"). This
  dissolves the need for exit-carve.

  **The two irreducible maze requirements become CONFIGURABLE (user ruling):**
  - `mazeRequireSameWall` — ON: a maze exit only serves the side its hole is on
    (⊆-fit-by-side). OFF: **relabel** the exit's LOGICAL side onto any needed side
    (the maze analogue of bounce's `moveSphereExitSide`); the physical hole stays
    put (logic-looser-than-physics).
  - `mazeRequireTileAlign` — ON: the opening must sit at the grid-mirror tile
    (`mirrorTileAcrossSide`, :1070/:1548 — what generated maze does today; a captured
    maze would need exit-carve to satisfy it). OFF: use the captured opening's tile;
    the connection stays side-based logic.
  - **Both default ON** (user ruling) → current maze output byte-identical (byte-inert
    gate holds trivially; strict positional connection preserved for real playable
    maze worlds). **Both OFF** → maze exits behave exactly like bounce portals (any
    opening → any needed side, no tile constraint) → F6c reuses the F6a abstract
    machinery: overlay gates, self-contained region, winnable on logic.
  - Settings live on maze `regionParams` (like bounce's `bounceMode`); surface in
    the panel later (mirror the bounce mode controls). `applySphereBackExit` (:4374)
    uses `specs.entranceTile` — with tile-align OFF it must use the captured opening's
    tile on the (relabeled) entrance side instead.

  **RUNNER GAP (user: "should already work like bounce; if not, we made a mistake").
  CONFIRMED — runner has ZERO library hooks.** Runner IS a zone/portal substrate
  (`generateZoneForSpecs`, `sidePortals`, `backPortalGated`, `buildZonePayload` in
  `runnerDemo/zoneRules.js` — signature identical to bounce's), but F1–F6a only wired
  bounce, so `runnerDemoLibrary.js`'s `createRunnerSubstrateEntry` registers NONE of
  `captureLibraryEntry` / `instantiateLibraryEntry` / `instantiateLibraryEntryForSpecs`
  / `validateLibraryEntry`. **Runner-first deliverable = add those four hooks.**
  `bounceLibraryEntry.js` is the template and is cleanly parameterizable (the
  substrate-specific bits are: the payload level key — bounce `bounceLevel` vs runner
  `runnerLevel`; the `buildZonePayload` dep; the portal-direction relabel — bounce
  sets `portal.direction` from `SIDE_DIRECTIONS`, check whether runner portals carry a
  direction; the substrate id). RECOMMENDED: extract a shared
  `shared/procgen/zoneLibraryEntry.js` both bounce and runner consume (bounce +
  runner share the zone model), OR mirror-and-adapt into `runnerLibraryEntry.js` if
  extraction risks the SHIPPED+gated bounce code. Runner then rides sphere library
  placement through the SAME engine path F6a/F6d built (no engine changes needed —
  `buildSphereLibraryRegion` already calls `adapter.instantiateLibraryEntryForSpecs`
  and overlays gates; `resolveSphereLibrarySources` must relax its "bounce entries"
  check to accept runner too — it currently throws on a non-bounce library).

  **Gates (both sub-phases):** byte-inert at defaults (`dump-sphere-byteidentity`
  diff-clean, `dump-spiral-byteidentity` 5/5, maze settings ON = no change);
  independent winnability stratum = Generate.py fill — add runner-sphere +
  maze-sphere (both settings OFF) roundtrips mirroring
  `verify-region-library-sphere-roundtrip.mjs`; keep `verify-region-library-ui`
  36/36 + the three roundtrips + `sphereLibrary.slow` green. Committed demo packs:
  add a runner pack + a maze-for-sphere pack (make-demo-*-pack.mjs generators).

  **Maze hook shape (F6c-maze):** the maze sphere hook must return a full tile
  region descriptor (NOT bounce zoneRules), so `buildSphereLibraryRegion` (:4215)
  needs a branch by region shape (bounce/runner return zoneRules → `assembleZoneRegion`;
  maze returns a ready descriptor → overlay gate access_rules onto its
  `extracted_rules.exits`/entrance directly). Item map + filler as F6a. Under both
  settings OFF, relabel captured exits' sides onto the needed sides (by index, like
  bounce) and skip the tile-align back-exit retarget.

- **F6d — capture/UI parity. ✅ DONE (`20e185682`).** Wired the `library:<id>`
  sphere quota into the panel's sphere-growth config so a user can tick a bounce
  pack and grow a sphere world with it (F6a was engine-only). Sequencing ruling
  (user): F6d before F6b/F6c — F6a already yields winnable overlay worlds, so
  reachability beats fidelity. UX ruling (user): show ALL served libraries in
  sphere mode but DISABLE non-bounce packs (bounce-only, F6a), with a note.
  - Panel (`procgenPipelineUI.js`): render the Region-libraries subsection in
    sphere mode; `_buildSphereConfig` merges the bounce-carrying subset of
    `this.regionLibraries` (via `buildLibrarySpiralConfig`) into the sphere
    `substrateQuotas`/`substrateConfig` — ONLY when a bounce library is selected,
    so library-less worlds keep the exact prior config (byte-inert);
    `_configFromCfgPrep` threads `substrateConfig`. Served rows disable + annotate
    non-bounce packs; a selected non-bounce pack shows "not used (bounce-only)".
  - **The missing wire (the real F6d work):** F6a only fed `librarySources`
    through the direct `growSpheres`/`growSpheresBatchedGen` path. The PANEL drives
    the STEPPED runner (`sphereSteps.js`), which called `realiseSphereBatchGen`
    WITHOUT library sources → "library node has no resolved content source". Fix:
    `growConfigFrom` carries `substrateConfig` into `growthParams`; `stepRegions`
    resolves `library:<id>` quotas (via the now-exported
    `resolveSphereLibrarySources`) and threads them into `realiseSphereBatchGen`
    (which already accepted `librarySources`). Built once per grow, stashed on
    `env` so the prefer-least-used counter survives sphere-major batches; rebuilt
    on a batch-0 restart.
  - Gate: `verify-region-library-ui.mjs` Phase D (new; 20/20 → **36/36**) — a
    fresh sphere-mode context proves the subsection renders, bounce enabled /
    maze disabled, ticking grows a compiled sphere-growth world (self-contained
    playable regions; library id only as `procgen_metadata.sphere_tree`
    provenance), and unticking regenerates a materially different world.
  - No richer capture needed (overlay-only) — Q6 default held. The committed
    `demo-bounce-pack.json` + index entry were already present.
  - KNOWN LIMITATION (out of scope, note for F6b/rebuild): the sphere_tree
    records a library node's source substrate as `library:<id>`, so
    `rebuildEnvelopeFromRulesJson` on a compiled library sphere world would need
    the libraryDoc (absent from the world) — rebuild/resume of library worlds is a
    separate capability, not claimed by F6a/F6d.

## 5. Gates & conventions (unchanged from the arc)

- **Byte-inert at defaults:** `dump-spiral-byteidentity.mjs` 5/5 and the sphere
  determinism goldens must pass with no library selected (library absent ⇒ zero
  new rng draws, byte-identical worlds).
- **Independent stratum:** the winnability gate is a witness replay / bot
  completion, NOT a verifier that shares the placement's assumptions
  (`feedback_verifier_shared_assumption`). A sphere-mode analogue of
  `verify-region-library-roundtrip.mjs` (world_generator + Generate.py +
  in-app solve) is the e2e.
- **Keep green throughout:** `verify-region-library-roundtrip.mjs` (13/13),
  `verify-region-library-ui.mjs` (20/20), the region-library unit suite, and the
  sphere-growth suites.
- **Git:** commit directly to `main`, one commit per sub-phase, explicit staging
  only (a concurrent Omsi session writes `CC/scripts/omsi-stats/*`,
  `frontend/modules/omsi-loops`, and the handoff doc — do not touch/commit
  those). Don't push unless asked.

## 6. Start-of-session checklist

1. Read this doc + main plan `region-library-plan.md` §0a (audit), §2b/§2c
   (adapter hooks + content-source contract), §4 F6, §6 open-qs.
2. Read the F4 spiral source `buildLibraryContentSource`
   (`procgenPipelineEngine.js:3202`) and the sphere zone realiser
   `buildSphereZoneRegion` (`:4103`) + `buildNodeRealiserSpecs` (`:4157`).
3. Get the §3 rulings from the user BEFORE writing code (esp. Q1 scope, Q2 gate
   strategy, Q3 exit-carve).
4. Then implement the ruled F6a phase behind the byte-inert-at-defaults gate.
