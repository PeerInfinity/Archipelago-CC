# topdown-locked-items — locked items through the top-down procgen compile (MEASURE + DESIGN)

- **Slice:** `topdown-locked-items` (Opus planning slice, cloud worker), launched 2026-10-01 by the local planner
  `solver-derived-logic-planning`. Follow-up 5 of the top-down source-fidelity family.
- **Base:** `origin/main` @ `3ab7a713fb8e14bbabd66e92f1dbd25c5f62d5e9`.
- **Branch pushed:** `claude/topdown-locked-items-5alp75` (the harness's designated branch; the brief's
  `topdown-locked-items` name was not used, as the brief allows).
- **Scope:** READ-ONLY on product code. Every round trip below ran in scratch (`worlds/zz_locktest_worldgen`,
  `frontend/presets/zz_locktest_worldgen`, both removed after each run; `preset_files.json` restored from a byte copy;
  `git status --short` empty after each run).
- **`topdown-apcalc-fill`:** NOT landed on `origin/main` at the time of writing (`git ls-tree origin/main
  CC/docs/cloud-reports/` has no `topdown-apcalc-fill.md`). Any build from this proposal waits for it.

## §1 Measurements

### 1.1 What `locked` means at each layer

| Layer | What `locked: true` means | Where |
|---|---|---|
| AP core | `location.locked` is set by `place_locked_item`, **and** by `fill_restrictive(..., lock=True)` — "nothing later may move this item", not "this is always here" | `Fill.py:37,47,620` |
| ALTTP (the clearest source) | Dungeon items (small/big keys, maps, compasses) are **pre-filled at random within their own dungeon, per seed**, via `fill_restrictive(..., lock=True, name="LttP Dungeon Items")`; prizes the same way | `worlds/alttp/Dungeons.py:268`, `worlds/alttp/__init__.py:536` |
| Exporter | Writes `locked` as an **observation**: `getattr(location, 'locked', False)` — "was locked at generation time", whatever the reason | `exporter/exporter.py:2048` |
| Schema | Two meanings in one field: "placed via place_locked_item at generation time", and, in a slot with a `procgen_metadata` entry, "authored intent" | `frontend/schema/rules.schema.json:806-808` |
| world_generator, **non-procgen** source | Only an **event** item/location's lock goes into `LOCKED_PLACEMENTS`; a non-event `locked` placement stays in the pool and is randomised per seed (it is only a canonical placement) | `world_generator/_template_init.py:506-518`, mirrored in the pool subtraction `:907-919` |
| world_generator, **procgen** slot | `honor_locked_placements = bool(procgen_metadata[slot])` → **every** locked placement goes into `LOCKED_PLACEMENTS` → `place_locked_item` on **every seed** | `world_generator/extractors.py:1358`, `_template_init.py:515`, `_place_locked_items` `:1258-1270` |
| Procgen producers of authored locks | `lockedCanonicalItems` → `compileRegionGraph`'s `lockedItems` → `locked: true` (the sphere-growth bounce start-stack arrow; the jta round trip's Victory pin) | `procgenPipelineEngine.js:2636-2639,2784-2785,7031-7067`; `sphereConfigHooks.js:56-79` |
| Top-down compile today | A source **event** location keeps its `locked`/`event` verbatim (`c7453f85d7`). A source **non-event** location: `sourceLoc` is not consulted, `locked` is **dropped**, and the location gets a fresh id plus a canonical placement | `procgenPipelineEngine.js:2735-2788` (`compileLocation`), `:2805-2840` (`compileEventLocation`) |
| Frontend runtime | Reads no location `locked` (the `locked: true` at `regionGraph/graphDataManager.js:1258` is a cytoscape node flag; `tileMapAnalyzer/rulesExporter.js:270` and `apcalcGenerator` only *write* it, on events) | `rg -an` over `frontend/modules` |
| Spoiler test | Replays the embedded sphere log of the compiled world; it never reads `locked` | — |

So **one field carries two meanings**. In an ordinary AP export, `locked` is an observation that says *that* a placement
was locked, not *why*. It can mean "fixed by an option" (doom `… - Exit` = `… - Complete`, celeste64 checkpoints,
sm64ex cannons) or "pre-filled at random within a restricted set" (ALTTP/tww/ladx/smz3 dungeon items). In a procgen slot
it means "authored: always here". world_generator already reads it two ways, keyed on `procgen_metadata`.

### 1.2 ALTTP's source locks vary per seed (measured over the 3 committed ALTTP seeds)

`python3` over `frontend/presets/alttp/AP_{14089154938208861744,01043188731678011336,84719271504320872445}`:
- 96 locked non-event locations in each seed (73 keys, 12 maps, 11 compasses), and all 96 sit in a region with a
  `dungeon` field.
- The **set** of locked locations differs across the three seeds, and 75 of seed 1's 96 hold a different item in at
  least one other seed.
- The source's `canonical_placements` is empty (size 0).

Freezing them would therefore be **unfaithful**: the source re-randomises them every seed, within the dungeon.

### 1.3 Which committed presets carry locked non-event locations

Scan over every `frontend/presets/**/*_rules.json` (script kept in scratch; summary):
- **No slot with a `procgen_metadata` entry has a single locked non-event location.** (34 files carry
  `procgen_metadata`: procgen_topdown ×12, procgen_maze ×3, seedling_* ×9, jta_* ×5, multiworld ×3, concept_trial,
  runner_sphere_worldgen.) So `honor_locked_placements` currently freezes **only events** in every committed preset.
- Ordinary sources that DO carry them include: alttp 96, alttp_vanilla 216, ladx 100, kh1 113, kh2 58, smz3 75, sm64ex 39,
  doom_ii 30, tww 29, doom_1993/heretic 27, pokemon_rb 18, codingadventure_vanilla 61, depgraph_vanilla/metamath_vanilla
  (= their node count), plus about 40 other sources with 1–15 each.
- Only **ALTTP** says *why* (a `dungeon` field on 73 regions plus a top-level `dungeons` block). tww, ladx, smz3, kh1,
  kh2, doom, celeste64, sm64ex, pokemon_rb, aquaria, tloz and lufia2ac have **0** regions with a `dungeon` field.

**The top-down sources in use carry none.** `scripts/utils/generated_commands.sh:531-554` records AP_1–3/10–12 from
`adventure` and AP_4–6 from `apcalc`, and neither source has a locked non-event location. Only AP_7–9 (from `alttp`,
DROPPED by the user) do:

| procgen_topdown | source | locs | `locked` key present | locked non-event | what happened to the source's locked non-events |
|---|---|---|---|---|---|
| AP_1–3, 10–12 | adventure | 25 | 1 (Victory event) | 0 | — (none in source) |
| AP_4 / 5 / 6 | apcalc | 161 / 147 / 155 | 81 / 74 / 78 (events) | 0 | — (none in source) |
| AP_7 / 8 / 9 | alttp | 268 | 19 (events) | 0 | **all 96 present, same item, `locked` DROPPED, and all 96 written to `canonical_placements`** |

### 1.4 What a seed of the top-down world does under each option (Generate.py round trips, scratch)

**ALTTP (AP_7) cannot be measured end to end.** `world_generator` builds it, but `Generate.py --seed 1` and `--seed 2`
both die in `Rules.py` with `AttributeError: 'Region' object has no attribute 'dungeon'` (a `Ganons Tower Torch Rooms`
boss rule). That failure has nothing to do with `locked`, and it matches the user's "we won't be able to get AP 7-9
fully working anyway".

**Measurement vehicle:** AP_1 (adventure s1, in use). Three of its non-event placements stand in for source locks:
`Catacombs=Sword`, `Dungeon Vault=White Key`, `Black Castle Gate=Black Key`. Recipe: `world_generator <rules> -o
worlds/zz_locktest_worldgen --game-name …` → `generate_yaml_templates(<scratch>)` → `Generate.py --multi 1 --seed N <
/dev/null` → read the exported `_rules.json` → clean up.

| Variant | Input | `LOCKED_PLACEMENTS` | seed 1 | seed 2 | seed 3 | Fill |
|---|---|---|---|---|---|---|
| **A0 = drop (today)** | AP_1 as is | Victory only | Sword@Red Maze Vault Entrance, White Key@White Castle Gate, Black Key@Yellow Castle Gate | Sword@Yellow Castle Gate, WK@Black Castle Gate, BK@Red Maze Vault | Sword@Dungeon0, WK@Slay Rhindle, BK@Yellow Castle Gate | exit 0 ×3 |
| **A1 = preserve verbatim** | + `locked: true` on the 3 | the 3 + Victory | Sword@Catacombs, WK@Dungeon Vault, BK@Black Castle Gate | **identical** | **identical** | exit 0 ×3 |
| **A2 = marker honoured per seed** (scratch prototype: the 3 leave `LOCKED_PLACEMENTS`; `pre_fill` runs `fill_restrictive(lock=True)` over a per-seed shuffle of the 3 marked locations, as ALTTP does per dungeon) | A1's rules + a patched `__init__.py` | Victory only | Sword@Catacombs, WK@Dungeon Vault, BK@Black Castle Gate | Sword@Black Castle Gate, WK@Dungeon Vault, BK@Catacombs | Sword@Dungeon Vault, WK@Black Castle Gate, BK@Catacombs | exit 0 ×3 |
| **A3 = re-derive A2's export** | A2's seed-3 exported `_rules.json` (it carries `procgen_metadata['1']` and `locked: true` on the 3) | **the 3 (seed 3's arrangement) + Victory** | BK@Catacombs, Sword@Dungeon Vault, WK@Black Castle Gate | **identical** | — | exit 0 ×2 |
| **A4 = marker as a plain extra field** | AP_1 + `source_locked: true`, `prefill_group: "castles"` on the 3 (no `locked`) | Victory only | (randomised, as A0) | — | — | exit 0 |

Seeds map to ids as `1 → AP_14089154938208861744`, `2 → AP_01043188731678011336`, `3 → AP_84719271504320872445`.

Findings:
1. **Verbatim (A1) freezes the item on every seed**, as the brief suspected. Fill still succeeds because the frozen
   arrangement is the compiled world's own canonical one, which is beatable by construction.
2. **Drop (A0)** randomises the items freely across the whole world. They lose the source's constraint (a dungeon
   item stays in its dungeon), and the *information* that they were locked is gone. That is what the user's standing
   rule objects to.
3. **A per-seed honoured marker (A2)** behaves like the source: items move between seeds, but only inside their group,
   and Fill succeeds.
4. **A3 is a latent round-trip trap.** Any procgen world that pre-fills with `lock=True` exports `locked: true`. Its
   export also carries `procgen_metadata` (re-injected by `handler.py:2101-2120`), so re-deriving the export freezes
   that seed's random arrangement for good. Whatever honours a marker per seed must therefore not rely on the bare
   `locked` bit.
5. **A4: an extra location field round-trips for free.** `extract_locations` puts unknown keys in `extra_attributes`
   (`extractors.py:422-440`), Locations.py sets them on the Location, and the exporter's attribute auto-discovery
   writes them back. The exported `Catacombs` reads `{…, "locked": false, "prefill_group": "castles",
   "source_locked": true}`, so a marker needs **no exporter or world_generator change** to survive
   world_generator → Generate.py → export. The schema already allows it (`location.additionalProperties: true`,
   `rules.schema.json:812`).

## §2 Options

| | What the compile writes | Placement on seed N of the top-down world | Fill | Spoiler test | Faithful to the source? | Byte effect on presets in use |
|---|---|---|---|---|---|---|
| **A. Preserve verbatim** | `locked: true` | **frozen** on every seed (`honor_locked_placements`) | OK (fewer free items) | unaffected (sphere log of the compiled world) | **No** for ALTTP-style pre-fills (75/96 vary per seed in the source). Yes only for option-fixed locks (doom exits). The source's observation becomes authored intent | none (no in-use source has any); AP_7–9 +96 `locked` each |
| **B. Drop (today)** | nothing | free, anywhere | OK | unaffected | **No**: the information is lost, which is exactly the step the standing rule says to fix | none |
| **C. Distinct marker** | `source_locked: true` (+ `prefill_group` when the source states one), never `locked` | *as world_generator decides for the marker* (§4 Q2/Q3). Default: unchanged from B, so free | OK (A0/A4); with group pre-fill OK (A2) | unaffected | **Yes**: the information is kept, and its meaning ("the source observed this locked") is not upgraded to "authored always-lock" | none; AP_7–9 +96 markers each |
| C′. Marker + group pre-fill now | as C, plus world_generator emits a `pre_fill` per `prefill_group` | moves per seed within the group (A2) | OK (A2) | unaffected | Yes, for sources that say *why* (only ALTTP today) | none in use; machinery with **no in-use consumer** (AP_7–9 do not generate at all, §1.4) |

What decides the authored-vs-observed split: the compile knows whether the **source slot** has a `procgen_metadata`
entry. If it does (a top-down over a procgen world), the source's `locked` is authored intent, and carrying it verbatim
is faithful. If it does not (an ordinary AP export), `locked` is only an observation, and it becomes the marker.

## §3 Recommendation: Option C, with the group consumer deferred

**Rule:** in a top-down compile, a source **non-event** location with `locked: true`
- from a source slot **with** a `procgen_metadata` entry → `locked: true` verbatim (authored; today's honour path);
- from a source slot **without** one → `source_locked: true`, plus `prefill_group: <the source region's dungeon>` when
  that region has a `dungeon` field. `locked` is NOT written, and the canonical placement stays, so seed 1 still
  reproduces the source.

world_generator needs **no change**. The marker rides through as an extra attribute (A4), and the locations stay
ordinary pool placements, exactly as world_generator already treats a non-procgen source's non-event locks
(`_template_init.py:506-518`). The information is preserved at the step that lost it, and nothing is frozen that the
source would randomise.

**The slice it implies** (after `topdown-apcalc-fill` lands):
- **Files:**
  - `frontend/modules/procgenPipeline/procgenPipelineEngine.js` `compileLocation` (consult `sourceLoc` for non-events,
    as `compileEventLocation` does).
  - A new `sourceLocked` / `sourceProcgen` input, or a reader of the source slot's `procgen_metadata` and region
    `dungeon` beside `sourceLocationsOf` (`:2849`), threaded through `buildRulesJson` (`:6970`) by both callers:
    `topDownSteps.js:137` and `scripts/utils/generate-topdown-preset.js:320`.
  - The mirrors: `apworldEditor/exitSides.test.js:111`, and textAdventureRoom's top-down mirror.
  - `frontend/schema/rules.schema.json`: document `source_locked` / `prefill_group` on `location`, and tighten the
    `locked` description to the two-meaning rule.
  - A unit test in `procgenPipelineEngine.test.js`.
- **Presets re-recorded:** procgen_topdown AP_1–12 by the recorded commands (`generated_commands.sh:531-554`).
  **Byte-neutrality gate:** AP_1–6 and AP_10–12 are `cmp`-identical, and `preset_files.json` is byte-identical. AP_7–9:
  the diff is ONLY `+source_locked`/`+prefill_group` on the 96 named locations each (checked by script), unless the user
  rules otherwise on AP_7–9 (Q4).
- **Gates:**
  - Bounded vitest on the touched test files only (⚖ ruling 52), then the CI suite number at the pushed SHA via
    `ci-vitest-summary.mjs`.
  - `npm test -- --mode=test-spoilers --game=procgen_topdown` for each re-recorded seed.
  - A Generate.py round trip of AP_1 at seeds 1 and 2 (exit 0, marker absent as expected).
  - A synthetic round trip of AP_1 with a marked location (the A4 recipe), showing the marker survives to the export.
  - AP_7–9 get no round trip (they fail on `Region.dungeon` before any of this; §1.4).

## §4 ⚖ Questions for the user

1. **Which option?** A (verbatim, freezes on every seed), B (drop, today), or C (a distinct marker)?
   **Recommend C.** It keeps the information, as the standing rule asks, without turning the source's "was locked this
   seed" into "always locked".
2. **What should a seed of the top-down world do with an ungrouped `source_locked` placement?** Treat it as an ordinary
   pool placement (free), or hold it (frozen, i.e. A's behaviour under another name)?
   **Recommend free.** It matches how world_generator already regenerates the very same flag from a non-procgen source.
   ALTTP-style locks genuinely vary per seed (§1.2), and holding would freeze them. The cost: an option-fixed lock (doom
   exits) also becomes free, but no in-use top-down source has one.
3. **Build the per-seed group pre-fill (C′, the A2 prototype) now, or only carry `prefill_group` now?**
   **Recommend: carry it now, build the consumer later.** Only ALTTP states a group, and AP_7–9 do not generate at all,
   so a consumer would have no in-use world to run in. When it is built, it must key on the marker, not on `locked`, so
   the A3 re-derive trap does not appear.
4. **AP_7–9 in the re-record:** re-record them with the markers (they are still committed and recorded), or leave them
   untouched or retire them?
   **Recommend re-record by the recorded commands.** That keeps "the commands reproduce the presets" true. Retiring
   them is a separate call.
5. **The A3 trap** (a procgen world's own `lock=True` pre-fill freezes on re-derive) has no committed instance today.
   Note it only, or open a follow-up?
   **Recommend note only.** Fold it into the C′ slice if Q3 is ever built.

## §5 ⚖ User rulings (verbatim)

**R1 (2026-10-01, this chat), answering §4 Q1 by reframing it:**
> If procgen is using "locked" to mean something different from what Archipelago uses it for, then I want to change procgen to use a different name for what it does.

So `locked` keeps Archipelago's meaning everywhere, and procgen's "always here" moves to a new field. That replaces §3's
`source_locked` marker. The revised design is in §6. §4 Q2–Q5 are superseded or restated in §6.4.

## §6 Revised design under R1

### 6.1 Does procgen's meaning differ? Yes, measured, and only for non-event locations

- **Events:** procgen writes `locked: true` + `event: true` (`apcalcGeneratorEngine.js:952,964`,
  `tileMapAnalyzer/rulesExporter.js:270`, `compileEventLocation` `procgenPipelineEngine.js:2836`), and world_generator
  pins every event lock regardless (`_template_init.py:513-515`). That is Archipelago's meaning too, because an event is
  always `place_locked_item`'d. **No rename is needed there.**
- **Non-events:** these are where procgen means "always here, every seed". Sole producer: `compileRegionGraph`'s
  `lockedItems` (`procgenPipelineEngine.js:2639,2784-2785`), fed by `buildRulesJson`'s `lockedCanonicalItems`
  (`:7036,7067`). It is threaded through `sphereConfigHooks.js:56-79`, `sphereSteps.js:481`, `presetRun.js:417` and
  `procgenPipelineUI.js:4580`. The users: the sphere-growth bounce start arrow (`sphereGrowth.slow.test.js:602`,
  `braidSphereBot.slow.test.js:63`, `dump-sphere-byteidentity.mjs:64`) and the jta round trip's Victory pin
  (`check-jta-locations-roundtrip.mjs:225-231`). Consumer: world_generator's `honor_locked_placements`, keyed on the
  slot's `procgen_metadata` (`extractors.py:1358`, `_template_init.py:515,918`). That key is documented in
  `generator.py:290`, `handler.py:2113` and `rules.schema.json:319,808`.
- **Committed presets carrying a procgen-meaning non-event `locked`: 0** (the §1.3 scan: no slot with
  `procgen_metadata` has a locked non-event). So the rename moves **no committed preset bytes** on its own.
- **A side effect the rename removes:** `make-seedling-playthrough-rules.mjs:28-32` deliberately emits NO
  `procgen_metadata` *because* its presence turns every lock into an always-lock. After the rename, `procgen_metadata`
  no longer changes placement semantics.

### 6.2 The design

1. **A new location field for procgen's intent:** `pinned: true` (name to be confirmed, Q-A). It means "place this item
   here on every seed (`place_locked_item`)". The compile option renames with it: `lockedCanonicalItems` →
   `pinnedCanonicalItems`, and `lockedItems` → `pinnedItems`.
2. **`locked` = Archipelago's meaning, everywhere.** The top-down compile carries a source location's `locked`
   **verbatim** for non-events too, as it already does for events. That fixes the step that lost the information
   (`compileLocation`), and §3's `source_locked` marker is no longer needed.
3. **world_generator:**
   - `LOCKED_PLACEMENTS` = event locks + `pinned` placements.
   - A non-event `locked` is a canonical placement only, randomised per seed, in a procgen slot exactly as in any other
     slot.
   - `honor_locked_placements` and its `procgen_metadata` keying are deleted.
   - `pinned` must reach the generated Location as an attribute, so the exporter's auto-discovery writes it back and a
     re-derived world keeps the pin. A4 (§1.4) showed an extra location field already round-trips; the pin needs it to
     be set on the Location as well as read into `LOCKED_PLACEMENTS`.
4. **The A3 trap disappears.** A procgen world's own `lock=True` pre-fill exports as `locked: true`, which no longer
   pins on re-derive.
5. **Measured behaviour:**
   - A top-down world whose source has observed non-event locks behaves as A0 (§1.4): randomised per seed, Fill OK,
     with the `locked` information intact.
   - An authored pin behaves as A1: frozen, Fill OK. The marker moves from `locked` to `pinned`.

### 6.3 The slice it implies (after `topdown-apcalc-fill` lands)

- **JS:**
  - `procgenPipelineEngine.js`: `compileLocation` carries the source's `locked`, and the pin writes `pinned`; rename the
    `lockedItems` and `lockedCanonicalItems` options.
  - The four threading sites in §6.1, and `scripts/procgen/{sphere-step.js,dump-sphere-growth.js,
    dump-sphere-byteidentity.mjs,check-region-step-editing.mjs,check-jta-locations-roundtrip.mjs}`.
  - The tests naming the option (`sphereGrowth.slow`, `braidSphereBot.slow`, `presetRun`, `sphereSteps`).
- **Python:**
  - `world_generator/extractors.py`: read `pinned` into `pinned_placements`, and drop `honor_locked_placements`.
  - `world_generator/_template_init.py`: the `LOCKED_PLACEMENTS` filter and its pool-subtraction mirror.
  - Stale comments in `world_generator/generator.py:290` and `exporter/games/base/handler.py:2113`.
- **Schema:** add `pinned` to `rules.schema.json`; strip the procgen caveat from `locked` (`:808`) and from the
  `procgen_metadata` consumer list (`:319`).
- **Docs:**
  - The `make-seedling-playthrough-rules.mjs` header (the ⛔ reason is gone; whether to emit `procgen_metadata` there
    becomes a separate decision, not part of this slice).
  - `CC/adding-game-support.md` and `CC/debugging-worldgen-failures.md` if they describe the procgen keying.
- **Presets:**
  - procgen_topdown AP_1–12 are re-recorded by `generated_commands.sh:531-554`.
  - Expected: AP_1–6 and AP_10–12 `cmp`-identical; AP_7–9 differ only by `locked: true` on the 96 source-locked
    locations each.
  - No other committed preset moves (0 pinned non-events today).
- **Gates:**
  - Bounded vitest on the touched tests.
  - The CI suite number at the pushed SHA.
  - `check-jta-locations-roundtrip.mjs`: Victory is still pinned, now via `pinned`.
  - The sphere-growth bounce-arrow test.
  - procgen_topdown spoiler tests.
  - An AP_1 Generate.py round trip at seeds 1 and 2.
  - The A1 recipe with `pinned` in place of `locked`: frozen across seeds.
  - The A3 recipe: re-derive no longer freezes.

### 6.4 ⚖ Remaining questions (each with a recommendation)

- **Q-A, the name.** Choose between `pinned`, `fixed_placement` and `always_locked`.
  **Recommend `pinned`.** It is short, and it collides with no Archipelago Location attribute or rules.json field
  (`rg -a` finds no `pinned` in the schema or exporter).
- **Q-B, compatibility.** Should world_generator still read a non-event `locked` in a `procgen_metadata` slot as a pin
  when a rules.json has no `pinned` anywhere (old procgen downloads outside the repo)?
  **Recommend no shim.** No committed file needs it, and a shim keeps the double meaning alive.
- **Q-C (was Q3), ALTTP's dungeon grouping.** Should a per-seed "reshuffle within a group" ever be honoured?
  **Recommend: not now.** Under R1 nothing is lost: `locked` is carried, and the source's region `dungeon` field
  already sits on the source. Only AP_7–9 would use it, and they do not generate.
- **Q-D (was Q4), AP_7–9.** **Recommend re-record with the recorded commands** (they gain the carried `locked`).
- Q2 and Q5 are settled by R1: an observed `locked` randomises like any canonical placement, and the A3 trap is gone.
