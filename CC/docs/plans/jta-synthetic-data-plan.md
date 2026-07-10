# JtA Synthetic Game Data — Phase 5 Plan

**Date:** 2026-07-10 ·
**Status: RULED 2026-07-10 — all seven §7 questions answered same day
(rulings recorded inline in §7); ready for 5a. Q2's feasibility check is
DONE: no `const enum` in the fork (and `isolatedModules: true` forbids them
project-wide), compiled enums are mutable runtime objects — the count
rewrite works as designed.**
Child plan of `jta-zone-randomization-plan.md` (its Phase 5, "the destination").
Sibling precedent: `jta-balance-pass-plan.md` (Phase 3). Phases 0–4 of the
parent are DONE; this plan builds on their machinery (Pass-B balance walk,
`jtaBalance` worker, `jta-stats` harness, `jta-parity` harness) and does not
re-open their rulings.

Deliverables of this document, mapped to sections:

1. **The versioned dataset schema** — §2.
2. **The fork data boundary (`loadGameData`)** — §3.
3. **The pipeline split (Pass A structure vs Pass B balance)** — §4.
4. **The vanilla-dataset parity verification story** (`CC/scripts/jta-parity/`) — §5.

---

## 0. Requirements (user rulings, 2026-07-10)

1. **Topology v1 = linear.** All zones completed in order, like vanilla.
   Branching paths and designing data to fit the procgen grid layout come
   LATER. (Consequence: v1 rides the existing fixed-ordered-zones substrate
   path — `synthesizeZonePayload`/`extractZoneRules` under the spiral driver.
   `generateZoneForSpecs`/sphere-growth is the post-v1 topology story, per
   parent plan §1b.)
2. **Task skeleton v1 = keep vanilla's balance.** The invariant to TRACK:
   the player gets enough stat-level-earning opportunities for what later
   zones demand (§4.1 constraint C4, §4.2 what-else-balances).
3. **Effect systems v1 = as close to vanilla as possible.** A generalized
   effect vocabulary is still wanted — code refers to items/artifacts by
   WHAT THEY DO, not vanilla names — but magnitudes stay vanilla-like (§2.3).
4. **Purpose (drives design, don't lose):** synthetic data exists so procgen
   can generate games whose parts FIT each other — theme plus implied
   narrative, eventually actual narrative content. Names/theming are not
   cosmetic afterthoughts; **the schema carries theme hooks** (§2.5).
5. **ALL data synthetic:** tasks and their stats, task NAMES, player-stat
   (skill) NAMES and COUNT, zone COUNT, item NAMES. Eventually entirely new
   item types. As much as possible SERIALIZABLE — the versioned dataset
   schema is the spine of the whole deliverable.
6. **Generation eventually lives IN the procgen pipeline**, likely split
   across steps — structure early, balance post-fill — mirroring Pass A /
   Pass B (§4). Cost balancing already exists (Phase 3 Pass B); the open
   investigation is what ELSE needs generating + balancing: skill-XP economy,
   effect magnitudes, energy economy, zone/task type structure
   (Travel/Mandatory/Boss/unlocker patterns) (§4.2).
7. **Known blocker:** the fork has NO data-injection hook (the old stack's
   `jta:replaceGameData` drove the retired jta-remote copy only). Synthetic
   data needs a new fork hook — that hook is §3.

Standing rulings inherited from the parent plan and NOT re-opened: all tasks
= AP locations / all perks = AP items; grants AP-authoritative; Pass B
post-fill rebalance is the authoritative balancing point; `resetsPerStep = 5`;
coverage is the hard verification gate with the `[0.4×, 3×]` pacing advisory;
own-world perks re-grant on task re-completion, foreign perks re-grant after
prestige.

---

## 1. Verified ground facts (explored 2026-07-10)

Line references: submodule paths are TypeScript sources under
`frontend/modules/journey-to-ascension/` (committed `build/*.js` mirrors them).

### 1a. The fork's static-data surface — what a dataset must replace

- **Skills** (`skills.ts`): `enum SkillType` with `Count = 12` (10 active +
  2 dead `REMOVED` slots); `SKILLS` = the active list;
  `SKILL_DEFINITIONS[12]` **positionally index-aligned to the enum**
  (`{type, name, icon, xp_needed_mult}`), consumed as
  `SKILL_DEFINITIONS[skill.type]` throughout rendering.
- **Tasks/zones** (`zones.ts`): `TaskDefinition` fields = `id, name, type
  (Normal/Travel/Mandatory/Prestige/Boss), cost_multiplier, skills[]
  (numeric SkillType), xp_mult, item, use_item (ItemType), perk (PerkType),
  prestige_layer, max_reps, hidden_by_default, unlocks_task, zone_id, free
  (fork-added)`. `ZONES` = 30 `Zone {name, tasks[]}`; task ids hand-assigned
  and sparse. **Zone count is already data-driven** (`ZONES.length`
  everywhere, no constant).
- **Perks** (`perks.ts`): `PerkType` 47 entries incl. one `DELETED` slot;
  `PERKS[]` positional; `PerkDefinition = {enum, name, icon,
  get_custom_tooltip, skill_modifiers}`.
- **Items** (`items.ts`): `ItemType` ~46 entries; `ITEMS[]` positional;
  `ItemDefinition = {enum, name, name_plural, icon, skill_modifiers,
  on_consume(amount), tooltip/effect-text lambdas}`. Derived groups
  `ARTIFACTS` (4 queued-effect items) and `NOTE_ITEMS` (5, for Compulsive
  Notetaking). **Two latent enum typos** — `Cactus` carries
  `enum: ItemType.BanditWeapons` and `Glasses` carries
  `enum: ItemType.RitualSymbol` (`items.ts:223-229, 402-408`); positional
  indexing hides it. Any exporter must derive `enum` from position, and the
  loader must assert position ≡ enum.
- **Prestige** (`prestige_upgrades.ts`): `PrestigeLayer` (4 + Count),
  `PRESTIGE_UNLOCKABLES[16]`, `PRESTIGE_REPEATABLES[12]`, all
  enum-positional, plus effect constants.
- **Derived at module load** (`zones.ts:482-518`): `zone_id` stamping,
  `TASK_LOOKUP` (id → def; holds REFERENCES, so field mutation stays
  coherent), `PERKS_BY_ZONE`/`ITEMS_BY_ZONE` (copied VALUES, need rebuild —
  `rebuildZoneDerivedMaps()` exists and is the Phase-1 rebuild hook).
- **The effect vocabulary today is split in two layers:**
  1. *Data-driven, generic:* flat per-skill speed multipliers via
     `SkillModifierList.applyEffect()` (`modifiers.ts:98-102`) on both perks
     and items; plus per-item `on_consume` lambdas (code, not data).
  2. *Hardcoded on enum identity:* ~40 sites in `simulation.ts`/`rendering.ts`
     branch on exact enum members. Perks: Amulet (gates automation, 6+ sites),
     EnergeticMemory, EnergySpell (+50 max energy in `tryAddPerk`,
     `simulation.ts:1960`), Minor/MajorTimeCompression, Writing,
     UnderstandingTheReset (item keep), HighAltitudeClimbing, SupplyLines,
     Attunement, Awakening/DefiedTheGods/Ascended (spark), and more. Items:
     the 4 `ARTIFACTS` queue mechanics, auto-use special cases. Skills:
     Ascension (half starting level), Travel (+GodlyTravel prestige mult),
     `calcAttunementSkills()` = [Magic, Study] (+conditionals),
     `getPowerSkills()` = [Combat, Fortitude], `getSpiteTheGodsSkills()` =
     [Ascension, Charisma].
- **Two absolute couplings** (the most brittle):
  `unlockTask(17,28,88,158,209)` hardcoded in the SeeBeyondTheVeil prestige
  unlock (`simulation.ts:3283-3288` — the ONLY hardcoded task-id list in the
  engine), and the divine-spark scaling origin `15 - 1` (zone 14,
  `simulation.ts:2979`, mirrored in `prestige_upgrades.ts:267-270`). The cost
  backbone `pow(2.2 | 4, task.zone_id)` (`calcTaskCost`, `simulation.ts:305`)
  and per-zone energy drain are zone-ordinal-driven but not zone-COUNT-coupled.
- **Save-format coupling** (`simulation.ts:3478-3586`): the task numeric `id`
  is THE save-load-bearing identifier — `saveGame` serializes each live task
  to its id; `parseSave` revives via `TASK_LOOKUP.get(id)`, and an unknown id
  revives to `undefined` → crash (that is exactly why synthetic/artifact task
  ids are filtered at save). `PerkType`/`ItemType`/`SkillType` numeric values
  and zone indices are stored throughout. **No version-gated save migration
  exists**; `SAVE_VERSION` only drives the changelog popup.
- **Boot order**: import-time table construction → `zones.ts` derived maps →
  `window.*` hook registration + singletons → `GAMESTATE.start()` (load or
  `initialize()`; `initializeSkills()` MUST precede `resetTasks()`).
  `initializeHeadless()` (`game.ts:101-105`) builds state without the tick
  loop or DOM.
- **Existing hooks and their limits**: `applyTaskPatches` is field-level only
  (`cost_multiplier, xp_mult, max_reps, hidden_by_default, unlocks_task,
  perk, item`; `simulation.ts:4592-4644`) — cannot add/remove tasks or zones,
  cannot touch `name/type/skills/zone_id/use_item/prestige_layer/free`,
  cannot touch the skills/perks/items tables. `injectSyntheticTask` adds
  one runtime task (ids ≥ 10000, not persisted, skipped by metrics/bridge).
  **There is no serializer for the content tables anywhere — this feature
  introduces the first one.**

### 1b. Transport and application seams — already sufficient

- **Sidecar transport has NO size limit.** `preset_sidecars` payloads are
  plain JSON pass-throughs at every hop: pipeline `playable_payload` spread
  (`procgenPipelineEngine.js:2533`) → `_worldgen_sidecars.json`
  (`world_generator/generator.py:265-283`) → exporter
  `_inject_worldgen_sidecars` (`exporter/games/base/handler.py:2060-2091`) →
  rules.json → procgenPlayer warehouse → `jta:loadRegion` `payload.world` →
  bridge. A several-hundred-KB dataset rides through un-truncated; the
  constraints are practical (rules.json bloat, per-region duplication), not
  enforced. **The blocker is runtime-side (no fork hook), not transport.**
- **Bridge seam**: `_handleLoadRegion` (`bridge.js:383-480`) receives
  `payload.world` and already applies `world.task_patches` via
  `_applyTaskPatches()` (`bridge.js:701-713`) on every region load. A
  `world.jta_dataset`/`world.jta_dataset_ref` field lands at the same seam.
- **Pass-B worker** (`frontend/modules/jtaBalance/`): loads the fork build in
  a module worker via the shared `headlessGameEnv.js` loader (same loader as
  the Node harness — one copy of the load-bearing import order), solves at
  `stateManager:rulesLoaded`, caches patches in localStorage by seed, merges
  them into each region's `task_patches` in the warehouse. Its economy math
  is the live fork build; identity constants come from the `zoneTaskData.js`
  snapshot.
- **Stats harness** (`CC/scripts/jta-stats/driver.mjs`): env-agnostic; builds
  its metric universe from `zones.ZONES.slice(0, zoneLimit)`
  (`driver.mjs:320-336`). Wholesale ZONES replacement without a fork hook
  would desync the universe from the engine's internal maps — with the §3
  hook, a `dataset` option is a small, localized addition (the `apRuntime`
  precedent).
- **`zoneTaskData.js`** is a regenerated identity snapshot (names/types/
  perk/item/maxReps/hidden/unlocks — costs deliberately omitted) because the
  DOM-coupled fork build can't be imported by the headless-safe pipeline
  library. For synthetic worlds the dataset itself replaces this role (§4.1).

### 1c. The parity harness — what exists to build the proof on

`CC/scripts/jta-parity/` currently proves **two builds, one config, one
dataset**: fork-at-defaults ≡ upstream fork point, via (a) sim lockstep —
both engines in one process, exact `===` per field of an explicit
gameplay-observable projection after EVERY tick across 4 scenarios / 36,629
ticks, static-data value-compare, anti-vacuity floors (`minTicks`/
`minResets`), and a `--selftest-perturb` comparator canary; (b) fresh-load UI
parity — DOM structural diff (raw/clean/residual) + masked exact pixel diff
with a measured noise floor and reproduce-on-retake discipline. The
comparison contract (`project()` at `run-parity.mjs:228-303`,
`compareStaticData` at `:388-453`) is dataset-agnostic. §5 re-aims it at
**two datasets, one build**.

---

## 2. Deliverable 1 — the versioned dataset schema

The schema is the arc's spine: a single self-contained JSON document that
carries EVERYTHING the engine currently compiles in as content. One file =
one game's worth of data. Everything the pipeline generates, the fork loads,
the balancer patches, and the harnesses verify speaks this format.

### 2.1 Envelope and versioning

```jsonc
{
  "schema_version": 1,              // integer; bump on breaking shape change
  "dataset_id": "vanilla-fork-1.6.2",  // unique, stable; stamped into saves (§3.4)
  "provenance": {                   // who made it and from what
    "generator": "export-vanilla-dataset | procgen-pipeline",
    "fork_save_version": "Fork 1.6.2",   // engine the data was authored against
    "seed": null,                   // pipeline seed for synthetic datasets
    "params_hash": null
  },
  "theme": { ... },                 // §2.5
  "skills": [ ... ],                // §2.2
  "zones": [ ... ],                 // §2.2
  "perks": [ ... ],                 // §2.3
  "items": [ ... ],                 // §2.3
  "prestige": { ... },              // §2.4
  "roles": { ... },                 // §2.4
  "economy": { ... }                // §2.4
}
```

- A JSON Schema validator file lands beside the repo's existing
  `frontend/schema/rules.schema.json` (e.g. `jta-dataset.schema.json`) so
  generator output, hand edits, and the fork loader all validate against the
  same document.
- `schema_version` is checked by every consumer (`loadGameData`, the
  pipeline step, the balancer, the harness option) — reject with a clear
  error on mismatch, no silent best-effort.
- `dataset_id` is the save-compatibility key (§3.4): numeric ids/indices are
  save-load-bearing (§1a), so a save is only meaningful under the dataset
  that produced it.

### 2.2 Skills, zones, tasks

```jsonc
"skills": [
  { "index": 0, "name": "Charisma", "icon": "🗣️", "xp_needed_mult": 1.0,
    "theme": { "flavor": "..." } }
  // COUNT IS FREE — the loader rebuilds SkillType/SKILLS/SKILL_DEFINITIONS.
  // No REMOVED placeholders in the schema; the exporter compacts vanilla's
  // dead slots out and records the compaction map in provenance (§5.1).
],
"zones": [
  { "name": "The Village",
    "theme": { "flavor": "...", "arc_beat": "..." },
    "tasks": [
      { "id": 10, "name": "Find Food", "type": "Normal",
        "skills": [3],                 // indices into skills[]
        "cost_multiplier": 1.0,        // PROVISIONAL in Pass-A output (§4)
        "xp_mult": 1.0, "max_reps": 5,
        "hidden_by_default": false, "unlocks_task": -1,
        "perk": null,                  // index into perks[] or null
        "item": 0, "use_item": null,   // indices into items[] or null
        "prestige_layer": null,
        "theme": { "flavor": "..." } }
    ] }
]
```

Design points:

- **Task ids are dataset-scoped and explicit** (not positional): they are the
  save-reviver key, the `applyTaskPatches`/balancer key, the `ap_locations`
  key, and the automation-priority key. The generator assigns them; the
  schema requires uniqueness. Synthetic ids stay below 10000 (the
  synthetic-injection convention reserves ≥ 10000).
- **`zone_id` is NOT in the schema** — it is derived (stamped by the loader
  from array position, exactly as `zones.ts` does today). Same for the
  enum-vs-position invariant everywhere: **array position is identity**;
  the exporter derives, the loader asserts.
- **"None" is `null`,** not the engine's `Count` sentinel — sentinel values
  are an engine encoding detail the loader owns (§3.2), and vanilla's
  `Count = 47/46/12` must not leak into a format whose whole point is that
  counts are free.
- `type` uses the string names (`Normal/Travel/Mandatory/Prestige/Boss`) —
  `TaskType` is a fixed engine vocabulary, not content.

### 2.3 Perks and items — the effect vocabulary

Per ruling 3, v1 magnitudes and mechanics stay vanilla-like, but the schema
names effects by WHAT THEY DO. Two effect classes, mirroring the engine's
real split (§1a):

```jsonc
"perks": [
  { "index": 0, "name": "Reading", "icon": "📖",
    "tooltip": "...",
    "effects": [ { "kind": "skill_speed", "skill": 1, "mult": 1.5 } ],
    "behavior": null,
    "theme": { "flavor": "..." } },
  { "index": 12, "name": "Ancient Compass", "icon": "🧭",
    "effects": [],
    "behavior": "automation_unlock",   // occupies the Amulet engine slot
    "theme": { ... } }
],
"items": [
  { "index": 0, "name": "Trail Ration", "name_plural": "Trail Rations",
    "icon": "🍞",
    "effects": [ { "kind": "skill_speed", "skill": 2, "mult": 1.25 },
                 { "kind": "energy_on_consume", "amount": 10 } ],
    "behavior": null, "theme": { ... } }
]
```

- **`effects[]` is the declarative layer** — things the engine already reads
  from data or near-data: `skill_speed` (the `SkillModifierList` mechanism,
  fully data-driven today) and `energy_on_consume` (vanilla's Food lambda,
  trivially data-fiable). The vocabulary starts with exactly what v1 needs
  and grows per-behavior over time.
- **`behavior` is the hardcoded-slot layer**: a stable key naming an engine
  behavior that is still compiled against a specific enum member
  (`automation_unlock` = Amulet, `starting_energy_flat` = EnergySpell,
  `starting_energy_growth` = EnergeticMemory, `time_compression_minor/major`,
  `keep_items_on_reset` = UnderstandingTheReset, `artifact_haste` /
  `artifact_lightning` / `artifact_ring` / `artifact_dreamcatcher` (the four
  ARTIFACTS queue mechanics), `spark_awakening` / `spark_defiance` /
  `spark_ascended`, etc. — the full key table is enumerated during 5a from
  the §1a coupling list). **v1 mechanism: fixed behavior slots** — an entry
  declaring a behavior is REQUIRED to sit at that behavior's vanilla enum
  index; the schema validator enforces it, the loader asserts it. Entries
  with `behavior: null` may occupy any other index; unused behavior slots are
  filled by the loader with inert placeholders (the engine already tolerates
  dead slots — `REMOVED`/`DELETED` are precedents). Rationale in §3.3;
  alternatives in §7 Q1.
- **The migration path is per-behavior, not big-bang**: each time a hardcoded
  branch is rewritten to read an `effects[]` entry (e.g. `tryAddPerk`'s
  EnergySpell `+50` becomes a generic `starting_energy_flat` effect read),
  that key moves from the `behavior` column to the `effects` vocabulary and
  its slot constraint dissolves. The schema shape does not change — only the
  validator's slot-constraint table shrinks. This is how "eventually entirely
  new item types" is reached without ever needing a flag-day engine refactor.

### 2.4 Prestige, roles, economy

```jsonc
"prestige": {
  // v1: vanilla-verbatim tables (layers, unlockables, repeatables), carried
  // so a vanilla-equivalence dataset is COMPLETE and synthetic datasets can
  // later vary them. Positional; behavior-slot rules as in §2.3.
  "layers": [ ... ], "unlockables": [ ... ], "repeatables": [ ... ],
  "spark_zone_origin": 14,        // replaces the hardcoded `15 - 1` (§3.3)
  "sbtv_unlock_task_ids": []      // replaces unlockTask(17,28,88,158,209);
                                  // empty for v1 synthetic datasets — the
                                  // generator simply creates no unlocker-less
                                  // tasks (parent plan's SBtV exclusion
                                  // becomes vacuous by construction)
},
"roles": {
  // The five skill-identity couplings (§1a), made data-driven with
  // vanilla defaults. Indices into skills[].
  "ascension_skill": 11,          // half starting level + spite pairing
  "travel_skill": 7,              // GodlyTravel prestige mult target
  "attunement_skills": [8, 1],    // + conditional extensions stay keyed to
  "power_skills": [2, 9],         //   their behavior slots
  "spite_skills": [11, 0]
},
"economy": {
  // The global balance backbone, carried explicitly instead of compiled:
  "base_task_cost": 10,
  "zone_cost_exponent": 2.2, "boss_cost_exponent": 4,
  "xp_base": 8, "xp_zone_mult": 1.25, "level_curve": 1.02
  // v1 datasets carry vanilla values verbatim (ruling 2/3); they exist in
  // the schema so Pass B gains levers later without a schema bump.
}
```

### 2.5 Theme hooks (ruling 4)

Theme is first-class, not decoration. Every named entity (dataset, zone,
task, skill, perk, item) carries an optional `theme` object; v1 defines a
minimal shape and reserves room:

```jsonc
"theme": {
  "title": "The Long Road North",       // dataset-level
  "setting": "...", "tone": ["melancholy", "hopeful"],
  "namebanks": { ... }                   // generator input, kept for
                                         // provenance/regeneration
}
// per-entity: { "flavor": "one-line narrative hook",
//               "arc_beat": "setup|rising|climax|denouement" (zones) }
```

The generation contract (§4.1) is that names are DRAWN from the theme, so a
zone's tasks, its perks, and its items read as belonging together — the
"parts FIT each other" purpose. v1 populates `title/setting/flavor` from
namebank-driven generation; actual narrative content (quest text, connected
story beats) extends `theme` in a later schema version without touching the
mechanical fields.

---

## 3. Deliverable 2 — the fork data boundary: `loadGameData`

One new fork hook, the Tier-2 successor the parent plan deferred
(`replaceZones` in parent Q2 — superseded by this design; Tier-1
`applyTaskPatches` is unchanged and layers on top).

### 3.1 Contract

```ts
window.loadGameData(dataset: JtaDataset): { ok: boolean, errors?: string[] }
```

- Validates `schema_version` + structural invariants (unique task ids,
  behavior-slot placement, index ranges) — hard-fails with errors, applies
  nothing on any failure (atomic: validate fully, then swap).
- Rebuilds, in order: skill tables (`SKILLS`, `SKILL_DEFINITIONS`, the
  runtime `SkillType` object incl. `Count`), perk tables (`PERKS`,
  `PerkType` incl. `Count` — the grant-suppression sentinel the wrapper
  knows as `JTA_PERK_COUNT` becomes dataset-dependent, see §4.1), item
  tables (+ `ARTIFACTS`/`NOTE_ITEMS` derived from behavior keys), prestige
  tables, role sets, economy constants, then `ZONES` → `zone_id` stamping →
  `TASK_LOOKUP` → `rebuildZoneDerivedMaps()`.
- Ends by **re-initializing the game against the dataset-keyed save slot**
  (§3.4): load if a matching save exists, else fresh `initialize()`. A
  dataset swap mid-game is a reset by definition — live `Task` objects,
  `GAMESTATE.skills`, perks, items all reference the old tables.
- Idempotent per `dataset_id`: calling again with the already-loaded dataset
  is a no-op (the bridge calls it defensively on every region load).
- **Dormant when never called** — standalone play must remain byte-identical
  (§5 proves this at the same bar as the existing mods: the parity harness's
  "hooks are no-ops unless registered" discipline).

### 3.2 Timing and consumers

Module-load table construction has already run before any caller exists
(§1a boot order), so `loadGameData` always REPLACES — it never races
construction. Per consumer:

- **Headless (worker/harness/parity):** `loadJtaEnv()` → `loadGameData(ds)`
  → `initializeHeadless()`. Clean — nothing has read the tables yet.
- **Managed iframe:** the game boots and `GAMESTATE.start()` runs before the
  bridge's first `loadRegion` arrives. The bridge therefore calls
  `loadGameData` from `_handleLoadRegion` when `payload.world` carries a
  dataset and its `dataset_id` differs from the loaded one — the hook's
  ending re-init (against the dataset-keyed slot) makes the pre-dataset boot
  state irrelevant. This sits immediately BEFORE the existing
  `_applyTaskPatches()` call (`bridge.js:436`), so Pass-B cost patches and
  grant-suppression patches apply to the dataset's tasks, unchanged.
- **Standalone browser play of a synthetic dataset** (nice-to-have, not v1):
  a `?dataset=<url>` boot param — deferred, noted in §7.

### 3.3 The decoupling fork changes (small, enumerable)

`loadGameData` alone is not enough — the §1a hardcoded couplings must become
data-driven exactly where counts/identity are allowed to vary. The v1 list,
each a small targeted change with vanilla behavior as the default when no
dataset is loaded:

| Site | Today | Change |
|---|---|---|
| `unlockTask(17,28,88,158,209)` (`simulation.ts:3283-3288`) | hardcoded id list | read `prestige.sbtv_unlock_task_ids` |
| spark origin `15 - 1` (`simulation.ts:2979` + tooltip) | hardcoded | read `prestige.spark_zone_origin` |
| `initializeSkills` Ascension half-level; Travel prestige mult; attunement/power/spite skill sets (5 sites) | hardcoded `SkillType.X` | read `roles.*` |
| `calcTaskCost` exponents / `xp` bases / level curve | compiled constants | read `economy.*` |
| skill/perk/item **counts** (`SkillType.Count` etc.) | enum literals (runtime property reads — TS non-const enums) | loader rewrites the runtime enum objects so `Count` tracks the dataset; **verify at implementation that no enum is `const enum`** (a const enum would inline literals and force a different mechanism) |
| item `on_consume` lambdas | per-item code | `energy_on_consume` effect for Food-alikes; behavior-slot items keep their compiled lambdas |
| item/perk `.enum` fields | 2 latent typos | loader sets `.enum` from position (fixes both) |

Everything else — the ~40 behavior branches — is deliberately NOT touched in
v1: the **fixed behavior slots** rule (§2.3) keeps every compiled
`hasPerk(PerkType.Amulet)`-style branch correct because the dataset entry
carrying that behavior sits at that index with its own name/icon/theme. This
is what makes v1's fork surface small enough to parity-gate confidently.
The alternative (rewriting all branches through a behavior-key indirection
now) is bigger, riskier, and buys nothing v1 needs — it is the incremental
migration path instead (§2.3), one behavior at a time, each step
parity-gated.

### 3.4 Save compatibility

Numeric ids and indices are save-load-bearing (§1a), so:

- `getSaveLocation()` gains a dataset dimension:
  `incrementalGameSave_substrate__<dataset_id>` when a dataset is loaded
  (vanilla managed play keeps `incrementalGameSave_substrate`; standalone
  untouched). This also resolves the parent plan's open question 3 (shared
  save × randomized seeds) for synthetic worlds: **different dataset =
  different save**, so carried skills can never deflate a new synthetic
  world's pacing. Worlds sharing one dataset still share a save (v1-
  acceptable; per-seed keying remains a separate knob).
- The save blob records `dataset_id` + `schema_version`; `loadGame` refuses
  a blob whose stamp mismatches the loaded dataset (fresh init instead) —
  belt-and-braces against key collisions and hand-copied saves.
- No save MIGRATION machinery in v1 (none exists today either); a dataset
  edit that changes ids orphans its saves by design — acceptable for
  generated content, revisit if hand-authored datasets become a workflow.

### 3.5 SAVE_VERSION / release discipline

The hook + decoupling changes are additive and dormant (standalone
byte-identical, proven by §5). Per the Fork 1.6.2 precedent, `SAVE_VERSION`
reconciliation = changelog entry; no save-format bump is needed because the
vanilla path's blob is unchanged. Ship as **Fork 1.7** with the parity
results attached.

---

## 4. Deliverable 3 — the pipeline split: Pass A structure, Pass B balance

Mirrors the parent's §2b two-pass flow exactly; the split line is the same
one the user drew — **structure early, balance post-fill**.

### 4.1 Pass A — dataset synthesis (procgen pipeline, structure only)

A new pipeline step, `jta dataset synthesis`, running before/with zone
arrangement (deterministic per (seed, params); in the stepped pipeline it is
an EDITABLE step whose artifact is the dataset JSON itself — the schema is
what makes that possible).

What it generates (linear topology, ruling 1):

1. **Skills**: count + names + roles, drawn from theme namebanks; skill-
   introduction cadence shaped by the Phase-0 structural profile
   (`results/vanilla-profile.json`: tasks/zone, type mix, skills-per-task,
   introduction cadence, perk/item spacing).
2. **Zone skeleton**: zone count + names + arc beats; tasks per zone with a
   vanilla-profile-shaped type mix — every zone gets its Travel exit task
   (linear: one, to the next zone), Mandatory/Boss placement per profile,
   `unlocks_task` chains generated ONLY with in-game unlockers (no
   SBtV-gated tasks — the parent's exclusion list becomes empty by
   construction).
3. **Perk/item roster**: behavior-slot entries first (automation unlock
   early — vanilla's Amulet gates automation, so a synthetic dataset that
   wants automation at all MUST place that slot's perk reachably early;
   profile gives the vanilla position), then free `skill_speed`/
   `energy_on_consume` entries; names/icons/flavor from theme.
4. **Provisional costs**: vanilla-like `cost_multiplier`/`xp_mult` defaults.
   NOT authoritative — Pass B owns them (unchanged parent ruling 9).

Hard generation constraints (checked by a validator at generation time, not
discovered at play time):

- **C1**: every costed task has ≥ 1 skill — `estimateResetsToComplete`
  returns 0 for skill-less tasks (balance-pass plan §1.1), so the balancer
  cannot pace them. Skill-less tasks are only legal as `free` or Travel-type
  per vanilla precedent.
- **C2**: behavior-slot placement rules (§2.3) — validator-enforced.
- **C3**: unique ids; `unlocks_task` targets exist; perk/item indices in
  range; every zone reachable (linear: has a Travel task).
- **C4 (ruling 2, the tracked invariant)**: for every zone Z and skill s
  demanded by Z's tasks, cumulative XP-earning opportunity in zones < Z
  (tasks training s, weighted by max_reps × xp_mult × zone XP scaling)
  clears a profile-derived floor. This is the STATIC feasibility half of
  "enough stat-level-earning opportunities for what later zones demand"; the
  emergent half is Pass B / verification (§4.2, §6 5f). Emitted as a report,
  asserted by the validator.

How the dataset reaches AP and the app:

- `extractZoneRules`/`synthesizeZonePayload` read the dataset instead of the
  `zoneTaskData.js` snapshot when a dataset is active (the snapshot remains
  the vanilla-data path); `zoneCount` comes from the dataset (retiring the
  hand-synced `zoneCount: 30`); grant-suppression `task_patches` use the
  DATASET's perk sentinel (dataset perk count), not the vanilla
  `JTA_PERK_COUNT = 47`. Locations/items/access rules/Victory emit exactly
  as v1 does today.
- **Carriage: single-carrier + refs (recommended).** The dataset is one
  world-level document; duplicating it per region multiplies rules.json by
  zone count for nothing. The first jta region's `playable_payload` carries
  `jta_dataset` (full document); every jta region carries
  `jta_dataset_ref: {dataset_id, schema_version}`. The bridge resolves the
  ref against its cache (regions load in arbitrary order, but
  procgenPlayer's warehouse holds all payloads at rules load, so the host
  side can hand the bridge the full dataset with any region — implementation
  detail at the existing `payload.world` seam). Round-trip transport is
  already proven size-unbounded (§1b); the roundtrip verifier gains dataset
  assertions (§6 5d).

### 4.2 Pass B — balance (in-app, post-fill, authoritative)

The Phase-3 machinery extends rather than changes — this is the payoff of
the parent's Q1 ruling (the engine is the simulator): the balance walk plays
the REAL fork against whatever tables are loaded, so synthetic data needs no
new solver.

- `jtaBalance` worker: receives the dataset (structured-clone) with the
  solve request; calls `loadGameData(dataset)` after `loadJtaEnv()`, before
  the walk. Cache key gains `dataset_id` (localStorage, alongside seed).
  Identity constants (`perkItemNames`, perk sentinel) come from the dataset
  when present, from `zoneTaskData.js` otherwise.
- The walk itself (sphere-log order, first-touch costing, estimator
  inversion, `setCostedTaskIds` confinement, normal ticking) is unchanged.
  `estimateResetsToComplete` is fork code reading live state + task defs —
  it models the synthetic dataset for free.

**The open investigation (ruling 6): what ELSE needs balancing.** Staged as
measurements first, levers only when a measurement says so:

| Economy | v1 stance | Lever if needed | Signal that it's needed |
|---|---|---|---|
| Task cost | Pass B solves `cost_multiplier` (exists) | — | — |
| Skill-XP economy | C4 static floor at generation + vanilla-like `xp_mult` | Pass B co-solves `xp_mult` per task (the walk already replays; add xp to the inversion) | walk stalls where estimator inversion runs out of `cost_multiplier` range — i.e. no cost makes the task land in-band because the skill can't be trained |
| Energy economy | vanilla `economy.*` constants; starting-energy behaviors at vanilla magnitudes | scale `economy` fields or behavior magnitudes at generation | Pass B convergence report: systematic saturation (every task at min cost) or starvation (max cost) per zone band |
| Effect magnitudes | vanilla-like (ruling 3) | generator-side magnitude ranges per effect kind | Phase-4-style emergent sweep drifting out of the pacing band while coverage holds |
| Type structure (Travel/Mandatory/Boss/unlockers) | profile-shaped at generation (Pass A) | generation params | structural — never a Pass-B concern |

The Pass-B convergence report (stalls/saturated counters, already emitted)
is the instrument: run it over a batch of generated datasets × seeds and let
the failure MODES name the next lever, instead of building levers
speculatively.

---

## 5. Deliverable 4 — vanilla-dataset parity verification

The load-bearing claim before anything synthetic ships: **the fork with the
vanilla dataset loaded through `loadGameData` is indistinguishable from the
fork with its built-in data.** If that holds, every future difference in a
synthetic world is attributable to the DATA, never to the loader. Secondary
claim, same harness: with no dataset loaded, the fork remains ≡ its own
pre-change behavior (the hook is inert).

### 5.1 The vanilla dataset fixture

New exporter `export-vanilla-dataset.mjs` (extends the
`generate-zone-task-data.mjs` pattern: loads the committed build via the
shared headless env) dumps the FULL schema document — the repo's first
content-table serializer (§1a). Specifics:

- Derives `enum` fields from position (neutralizing the two items.ts typos —
  the exported dataset is CORRECT where the source is wrong; the loader's
  position≡enum assert makes the fixture and the tables agree).
- Dead slots (`REMOVED`×2, `DELETED`) — **RESOLVED at 5a implementation:
  explicit `{placeholder: true}` entries**, so array position == engine enum
  value everywhere and the loader needs no re-expansion map. (The compaction
  alternative was dropped as pure extra machinery.)
- Emits `dataset_id: "vanilla-fork-<version>"`; regenerated whenever the
  fork's data changes (same regeneration discipline as `zoneTaskData.js`).

### 5.2 Three verification layers on `CC/scripts/jta-parity/`

The harness today compares two BUILDS under one dataset; this adds a mode
comparing two DATASETS under one build — the same engines-in-lockstep
machinery with the fork build loaded twice (`loadEngine` already supports
two build dirs in one process; here both point at the fork, and one side
gets `loadGameData(vanillaDataset)` before init).

1. **Static-data compare** (cheapest, catches most): `compareStaticData`
   (`run-parity.mjs:388-453`) already proves task/zone/skill/prestige
   definitions value-identical — run it native-vs-dataset. Extended to also
   sweep `PERKS`/`ITEMS` tables and the rebuilt enum objects. This is the
   fast guard that belongs in the substrate test scripts as a headless
   assertion, not just in parity runs.
2. **Sim lockstep, `--dataset` mode**: all four scenarios (idle / scripted /
   automation / forced-prestige — 36,629 ticks at current budgets), exact
   `===` per projected field per tick, native engine vs dataset engine.
   Everything transfers: the projection is dataset-agnostic, per-scenario
   child processes, anti-vacuity floors, and the `--selftest-perturb` canary
   (which must also fire in dataset mode — perturb the dataset engine and
   demand detection, guarding against a vacuous pass where the dataset
   silently failed to load and both sides ran native data).
3. **Fresh-load UI parity**: `run-ui-parity.mjs` mode serving the fork twice,
   one side booting with the vanilla dataset (needs the deferred
   `?dataset=` boot param or a harness-injected boot script — whichever is
   cheaper; this layer is the LOWEST priority of the three since layers 1+2
   already pin names/icons/tooltips via table compare, and rendering reads
   tables live). Expected result: zero DOM diff, zero exclusions.

**The transitivity chain**, stated in the report: existing harness proves
fork(defaults) ≡ upstream fork point; the new mode proves
fork(defaults)+vanillaDataset ≡ fork(defaults); composition:
**fork+vanillaDataset ≡ the upstream game.** Each new fork version re-runs
both halves (the harness already re-extracts the committed HEAD per run).

### 5.3 Byte-identity guards outside jta-parity

- **jta-stats**: `driver.mjs` gains a `dataset` option (the `apRuntime`
  precedent: absent ⇒ byte-identical). A vanilla-dataset run must reproduce
  the committed baseline numbers byte-for-byte — this exercises the
  loader under the FULL automation/mods surface that parity's
  defaults-only scenarios deliberately exclude, closing that coverage gap.
- **In-app**: one substrate test loading a dataset-carrying preset (5d) and
  asserting play + location checks + perk grants behave as the existing
  `jta_locations_test` flow does — the bridge-seam integration proof, since
  neither parity layer exercises `bridge.js`.
- **No-dataset inertness**: the existing standalone-baseline byte-identity
  check (used for every fork change this arc) gates the fork changes
  themselves.

---

## 6. Phasing (each separately land-able, committed as completed)

- **5a — Schema + vanilla exporter + validator — DONE 2026-07-10.**
  Shipped: `frontend/schema/jta-dataset.schema.json` (Draft-7, well-formed,
  fixture validates via python jsonschema);
  `frontend/modules/jtaSubstrateWrapper/datasetBehaviors.js` (the behavior-key
  table — 17 perk + 4 item + 16 prestige-unlock + 12 repeatable slots, every
  key verified at its engine site; Perky/Deenergized have definition+display
  sites but no found application site — keyed by documented intent);
  `datasetValidator.js` (authoritative structural checks + CLI, proven
  non-vacuous by 5 perturbation tests incl. wrong-slot, silent slot takeover,
  C1, dangling unlocks_task); `export-vanilla-dataset.mjs` (deterministic —
  byte-identical regeneration verified; hard-fails on hand-table drift vs the
  build and on unclassified `on_consume`); fixture
  `datasets/vanilla.json` (`vanilla-fork-1.6.2`: 10 skills, 30 zones, 269
  tasks, 46 perks, 46 items, 164 KB, 0 warnings).
  Empirical rule adjustments recorded: `xp_mult >= 0` (vanilla has three
  deliberate zero-XP tasks: Apotheosize, Defy the Gods, Prepare Final
  Ritual); C1 and Travel-per-zone hold on vanilla unmodified.
  §7 Q3 sub-decision RESOLVED: **explicit placeholders** (dead slots are
  `{placeholder: true}` entries; array position == engine enum value
  everywhere; the §5.1 compaction alternative is dropped). No fork changes;
  no runtime behavior anywhere changes.
- **5b — Fork: `loadGameData` + decoupling changes** (§3.3 table), dataset
  save keying, dormant-by-default. Gated by the standalone byte-identity
  baseline. Ship as Fork 1.7 (changelog per SAVE_VERSION discipline).
- **5c — Parity: dataset mode.** §5.2 layers 1+2 (+ canary), §5.3 jta-stats
  `dataset` option + baseline byte-identity run. **Gate: no 5d work starts
  until 5c passes** — the loader must be proven before data varies.
- **5d — Pass A: pipeline dataset synthesis.** Generation step (linear,
  profile-shaped, theme namebanks v0), constraints C1–C4 validator, sidecar
  carriage (single-carrier + refs), `extractZoneRules`-from-dataset,
  bridge dataset application, roundtrip-verifier dataset assertions, in-app
  dataset preset + substrate test.
- **5e — Pass B extension.** Worker dataset load + cache keying; solve a
  generated world end-to-end; the §4.2 measurement pass over a dataset×seed
  batch; add levers only as the failure modes demand.
- **5f — Emergent verification** (Phase-4 replay at Phase-5 scope):
  `sweep-ap-seeds`-style runs over N generated datasets × seeds; hard gate =
  full location coverage every run; advisory band = the settled `[0.4×, 3×]`
  per-seed mean gap; plus the C4 invariant checked EMERGENTLY (skill levels
  actually reached vs zone demands). UI-parity layer 3 is RULED IN (§7 Q6) —
  build it in 5c with the other parity layers unless it proves not worth the
  effort in practice.

Post-v1 (recorded, not planned here): per-behavior effects migration
(§2.3), branching topology / grid-fit via `generateZoneForSpecs`
(sphere-growth), narrative content in `theme`, prestige-table variation,
standalone `?dataset=` play.

---

## 7. Rulings (all received 2026-07-10, same day as the proposal)

1. **Behavior slots vs immediate indirection — RULED: start with slots.**
   User follow-up: "would it make sense to migrate to indirection later?" —
   Answer recorded: the migration target is the declarative `effects[]`
   vocabulary (§2.3), not a permanent indirection layer. Sequence per
   behavior: slot now → rewrite that one branch to read data → the slot
   constraint dissolves for that key. A wholesale behavior-key indirection
   layer as an intermediate stage would be double work; a per-behavior
   indirection shim is only worth building if a concrete need for
   count-freedom-with-behaviors arrives before the effects migration reaches
   that behavior. So: indirection may appear transiently per behavior, but
   declarative effects are the endpoint.
2. **Runtime enum rewrite feasibility — VERIFIED 2026-07-10 (implementer
   check, not a ruling):** zero `const enum` in the fork's TS sources, and
   its tsconfig sets `isolatedModules: true`, which forbids const enums
   project-wide (so this cannot silently regress). Compiled `build/*.js`
   confirms standard mutable runtime enum objects. Count rewrite is
   feasible for ALL tables. 5b implementation note: audit for module-level
   constants computed FROM `*.Count` at import time (e.g. table sizes) —
   property reads track the mutation, import-time captures do not; the
   loader must rebuild any it finds.
3. **Dead-slot handling — RULED: no user preference; implementer's call.**
   Decided at 5a: explicit placeholders (see §5.1 and Phase 5a notes).
4. **Dataset carriage — RULED: single-carrier + refs.**
5. **Theme v1 depth — RULED: namebank-driven `title/setting/flavor` only;**
   other ideas (arc beats etc.) may be tried later.
6. **UI-parity layer 3 — RULED: run it** (it looks reasonably cheap);
   drop only if implementation reveals it is not worth the effort.
7. **Code homes — RULED as recommended:** dataset generator outer repo
   (pipeline-side, next to the wrapper library); `loadGameData` +
   decoupling changes in the submodule; schema/validator outer repo with
   the vanilla fixture regenerated from the fork build.

## 8. Traceability

| User input (2026-07-10) | Where it landed |
|---|---|
| Topology v1 linear | §0.1, §4.1 (spiral path, Travel-exit-per-zone) |
| Task skeleton = vanilla balance; track stat-opportunity invariant | §4.1 C4 (static), §4.2 xp row + §6 5f (emergent) |
| Effects v1 vanilla-like + generalized vocabulary | §2.3 (effects[] + behavior slots + migration path) |
| Theme/narrative purpose; schema carries theme hooks | §2.5, §4.1 |
| ALL data synthetic incl. skill count, zone count, names | §2.2, §3.3 (count decoupling), §7 Q2 |
| Serializable versioned schema as spine | §2 |
| Generation in pipeline, split structure/balance | §4 |
| No data-injection hook (blocker) | §3 |
| What else needs balancing (open investigation) | §4.2 table |
