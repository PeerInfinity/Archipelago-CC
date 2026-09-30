# Behaviour parameters P2 — the vocabulary declared (cloud report)

Session `behaviour-parameters-p2`, Opus build slice, cloud fan-out worker, 2026-09-30.
Plan `behaviour-parameters-plan.md` §2, §3 P2, §6 (⚖ the user, GO 2026-09-30).

## Where it ran

| | |
|---|---|
| Branch (designated by the harness) | `claude/behaviour-parameters-p2-rhf4us` |
| Started from | `3844942c0c` — the harness branch's own start, **one commit behind** `origin/main` (`c0b2c8a8…`). I skipped the brief's `checkout -B … origin/main` step and found it at D5 when `git diff --stat origin/main` listed `seedlingDemo/watchLifetime.test.js`. Fixed with a merge (`3b0c181`), not a rewrite. `c0b2c8a` adds 28 lines to one seedlingDemo test and nothing else. Its test passes on the merged tree (25/25). |
| Commits | D1 `5b1ecc8` · D2 `fea387e` · D3 `4c0d04e` · D4 `d0ee55e` · D5 docs `99d63a7` · merge `3b0c181` · this report (the head) |
| Scope held | `git diff --stat origin/main` touches nothing under `seedlingDemo/` or `scripts/procgen/`, no submodule, no registry entry, no realisation data module, no preset, and not `substrate-registry.md`. It lists only: `procgenCore/` (5 modules + `behaviourBlocks.js` + 3 test files + the new `templateContract.test.js`), `mazeRoom/mazeLabView.js` (a D1 reader), `concepts.md`, and generated output (`procgenDocs/generated/{refusals,urlGrammar,docsIndex}.js`, the procgen `README.md` word count). |

## W0: byte inertia, BEFORE vs AFTER

BEFORE was measured at `3844942` (see above; the one missing commit is a seedlingDemo test file, so nothing measured below can see it). AFTER was measured at the merged head `3b0c181`.

| Gate | BEFORE | AFTER |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` (219 files) | `335a3aba7094b1b3be349e565eebff98` | `335a3aba7094b1b3be349e565eebff98` |
| `generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | same line (after regenerating in D1 and D5) |
| `generate-docs-index.mjs --check` | `OK: … is current (154 docs, 8 sections, 11 categories).` | same line |
| bounded vitest, W0's 12 paths | 26 files / 1001 tests, green | 27 files / 1108 tests, green: +69 in the new `templateContract.test.js`, `concepts.test.js` 68→100, `concepts.table.test.js` 24→30, every other file's count unchanged |
| `behaviourBlocks.test.js` (new) | — | 1 file / 14 tests, green |
| regression set: the 14 other test files that exercise `templateContract` / refusal sentences (`seedlingDemo/procgen{PostSword,SeedlingPrecheck,Palette,SeedlingSites,SeedlingDoorCut,SeedlingAreas,SeedlingSkeleton}`, `watchGenerate`, `mazeRoom/procgen{MazeElements,MazePrecheck,Maze,MazeAreas}`, `mazeLab`, `procgenCore/bindingContract`) | 14 / 823 | 14 / 824. The +1 is `bindingContract`'s *"reaches for no BINDING"* scan picking up the new shipping module `behaviourBlocks.js`, and that row passes. |
| `check-sidecar-fields.mjs` | `ALL PASS — 1422 entries over 8 substrates · 0 issue(s), 2 warning(s), 16 not-checked notice(s)` (measured on a scratch worktree at `c0b2c8a`) | the same line. The whole output is identical apart from timings. |

**The rebuild line.** Every entry in `SHIPPED_PRESETS` compiled headless the way `presetDefs.generate.slow.test.js` compiles it (`buildRunFromState` → `runPresetHeadless`, served region libraries and the Adventure top-down source resolved from disk), then md5 of `JSON.stringify(rulesJson)`. The two runner presets were included. The BEFORE run was repeated and was deterministic. **All 25 lines are identical AFTER D1, D3, D4 and at the head.**

```
bd54d851831e42e2f92c32729fda6273  shipped:maze-sphere-demo
b9f271b9826c578505bdbf5fe7bdee3a  shipped:text-adventure-sphere-demo
c104b83ee4b91c8f955da5fc54f61ded  shipped:maze-ta-sphere-mix
c30191ad058b2a988bdfefcac915124d  shipped:concept-trial-demo
8f0d706481c05bc87207d1b704cdc6eb  shipped:maze-bounce-sphere-mix
3d08cf28dfb9459355a2fe960ce73d39  shipped:maze-hazards-loop-demo
d512b160bb206c9f01183c12e358de0f  shipped:bounce-sphere-demo
b4826258435d0e3fa7e9078d1baa2fae  shipped:runner-sphere-demo
14eb8a98513b3b8e9ee6b15763d81d0b  shipped:runner-placement-demo
69241d44d67bbf7b039b447933276b38  shipped:seedling-sphere-room-demo
941f0bbb0a70018ee11626556b395f83  shipped:seedling-generated-leaf-demo
cc413d1b121f50dd6859e92828e39847  shipped:seedling-generated-host-demo
d399449170b14f49bf379756fa7a930f  shipped:seedling-generated-swim-demo
47afb058f7a69605db742d6650a0865a  shipped:seedling-atlas-host-demo
89e931a12b0b03629a08e5495aebefc4  shipped:seedling-atlas-location-demo
413528f6c89887989f3f74be4a8cf792  shipped:jta-zone-demo
3ef30678a4a161b84a391741112e26d1  shipped:content-spiral-mix
38228f17199a890709ccac8efcb64458  shipped:omsi-loop-demo
de7a20eb18525fc16732f6253a367c3a  shipped:library-spiral-demo
e9aede07ef8100e70c20b9788cd4b11f  shipped:runner-library-spiral-demo
fd91d5e8a09acab9c6dc49618f28044e  shipped:seedling-spiral-room-demo
a6c4a9f40abf2f973c295543a910d1f6  shipped:seedling-generated-room-demo
69dd8e421639fe4dab0d9077f9c9cb1d  shipped:grid-growth-demo
df8f160c4c6c5367674bed7f9050722d  shipped:topdown-maze-ta-demo
a409e6794e7499889fdc4db3e171e2ab  shipped:topdown-zones-demo
```

The instrument was a scratch script (it is not committed). Its method: import `REGISTRY_LIBRARIES`, then for each `SHIPPED_PRESETS` entry, `resolveLibrarySelection` against a disk `fetch`, `buildRunFromState(state, ctx)`, `runPresetHeadless`, and md5 the JSON.

## D1 — three domain forms, one validator (`5b1ecc8`): PASS

**What landed.** In `templateContract.js`, a parameter declares exactly one of `domain: [...]`, `range: {min, max, step?}` or `open: 'string' | {id}`.

- `assertParamSchema` accepts all three forms. It refuses, by name: no form, two forms, an empty list, `min ≥ max`, a non-finite bound, a step ≤ 0, a step that does not divide `max − min` (with an epsilon, so `0..1 step 0.1` passes and expands to clean decimals), a bad `open`, and a `default` outside its domain.
- New exports: `domainKind`, `enumerableValues` (a list returns **its own array**; a stepped range returns a frozen, cached expansion; the other forms return `null`), `valueInDomain`, `describeDomain` (a list is spelled exactly `[a, b]`, so no pre-P2 refusal sentence moved) and `assertDrawable`.
- `defineTemplate` asks `assertDrawable` of every parameter at definition time. `instantiate` draws `rng.pick(enumerableValues(p))`. The override check, the subset check and `enumerateValues` go through `valueInDomain` / `enumerableValues`.

### D1 reader table

| Reader | Line(s) at origin/main | What it does now |
|---|---|---|
| `templateContract.js` | 128, 132–135, 214–222, 279, 316–319, 335, 364 | form check (`assertDomainForm`); `valueInDomain` / `describeDomain` in every refusal; frozen copy per form; draw over `enumerableValues`; `enumerateValues` refuses a non-enumerable parameter by name |
| `elementSpec.js` | 550, 572, 579, 585, 589, 862, 868 | load-time `assertDrawable` on every head parameter (drawn and the binding's own `binds`: the codec types strings against the values); `valueInDomain` / `enumerableValues` / `describeDomain` |
| `elements.js` (`defineElement`) | 879 | `assertDrawable` right after `assertParamSchema`, so the refusal names the ELEMENT (the existing comment's reason) |
| `areaSpec.js` | 153, 184, 270 | load-time `assertDrawable` on `AREA_PARAM_SCHEMA`; `valueInDomain` / `enumerableValues` / `describeDomain` |
| `skeletonKinds.js` | 409, 412, 553, 557 | load-time `assertDrawable` per kind; the same three helpers |
| `urlParams.js` | 1094, 1099, 1209, 1213 | template params (drawable by `defineTemplate`): `enumerableValues` / `valueInDomain` / `describeDomain`. The generated `refusals.js` meaning text moved from `domain […]` to `domain …` (regenerated) |
| `concepts.js` | 235 | `valueInDomain`. `assertConcept` asks `assertDrawable` of `params`, because `instancesOf` enumerates them (`traits` may be any form) |
| `mazeRoom/mazeLabView.js` | 1002, 1005, 1512, 1531 | `enumerableValues(p)` (for a list, the same array) |
| ⛔ `seedlingDemo/watchViewer.js` | 5500, 5527, 5556, 6011, 6034, 6103, **6119, 6167, 6183** (the brief listed six of these nine) | **not edited** (U1's file). Its inputs are palette catalogue rows, `skeletonCatalogue` rows, `AREA_PARAM_SCHEMA` and `elementSpec.paramSchemaFor`, and each of those now refuses `open` or unstepped at load. **But a STEPPED range is drawable and would reach it with no `domain` array.** So I did not stop at "never meets a non-list". A tripwire in `templateContract.test.js` pins every shipped drawn schema (6 palettes, all element heads, all skeleton kinds, the area spec, concept params: 45 subjects) to be a LIST, and its failure message names these line numbers. |
| ⛔ `scripts/procgen/reference/catalogue.mjs` | 16 | **not edited** (§0 forbids `scripts/procgen/`; see *what the brief got wrong*). Covered by the same tripwire. |
| ⛔ `scripts/procgen/check-procgen-lab-hosting.mjs` | 215 | the same |
| ⛔ `scripts/procgen/check-seedling-editor-generate.mjs` | 1757 | the same |

### D1 mutants (predicted first; the source mutants were copied and restored, leaving a clean tree)

| # | Mutant | Predicted | Measured |
|---|---|---|---|
| a | scratch template `len: range {2..6}`, no step | `defineTemplate` refuses: `template "scratch" parameter "len" declares the range 2..6 (unstepped)` | as predicted (test row) |
| a′ | **source**: the maze palette's `wall-segment.len` edited to `range {1..3}` | the module refuses to load, naming `wall-segment` and `len` | `TemplateContractError: … template "wall-segment" parameter "len" declares the range 1..3 (unstepped), and a parameter the generator DRAWS must be a LIST or a STEPPED RANGE …` |
| b | `range {2..6 step 1.5}` | refused: `step 1.5, which does not divide it` | as predicted |
| c | `default 2.5` on `{2..6 step 1}` | refused: `defaults to 2.5, which is not in its own domain the range 2..6 step 1` | as predicted |
| d | `{2..6 step 1}` vs the list `[2..6]`, 6 seeds, counting rng | enumerates exactly `[2,3,4,5,6]`; one `pick` each; the same value; the stream afterwards identical | as predicted |
| d′ | **source**: `wall-segment.len` edited to `range {1..3, step 1}`, then the maze palette's own tests and the tripwire run | `procgenMaze` / `procgenMazePrecheck` stay green (the draw is byte-identical); only the tripwire fails, naming `palette maze-v1 template wall-segment` | 114 passed / 1 failed, and the one failure was exactly that tripwire row |

## D2 — the registries and the starter set (`fea387e`): PASS

`behaviourBlocks.js` provides:

- `createRegistry(name, {check?})`, giving `{name, declare, has, get, ids}`;
- four registries: `BLOCKS` (34 ids), `WEAPON_CATEGORIES` (12), `DEFENCE_RESPONSES` (11) and `TILE_TRIGGERS` (4). Those counts belong to this report, not to the docs;
- `BLOCK_FAMILIES` (closed; a comment says it is structural, like `CONCEPT_KINDS`);
- `REGISTRIES` by name, and `fieldValueRefusal(p, v)` (the value's form, plus registry membership for an `open: {id}` field);
- `assertVocabulary()`, run at load: every `open: {id}` names a registry here and defaults to an id that registry declares.

The only finite `domain` lists in the whole starter set are `aim`, `axis`, `lit` and `scope` (a test pins that list). Nothing in it uses `slow|medium|fast`.

- **Tests** (`behaviourBlocks.test.js`, 14 rows): a duplicate id, a missing or empty `why`, a non-string or empty id, and an unknown family are each refused by name. Fields in all three forms validate on real blocks. `fieldValueRefusal` is checked against the form and against the registry. The nameless / browser-safe source test in `concepts.test.js` now also reads `behaviourBlocks.js`.
- **Mutant.** The starter `hp.health` field was edited to drop its `why`. Predicted: the module refuses to load, naming `block "hp"` and `parameter "health"`. Measured: `BehaviourVocabularyError: behaviourBlocks: templateContract: block "hp" parameter "health" carries no \`why\`…`. The file was restored and the tree was clean.

## D3 — the concept fields (`4c0d04e`): PASS

`traits`, `weaponCategories` (item only), `defence` (enemy/hazard/obstacle) and `triggers` (obstacle/hazard) are checked in `assertConcept`. The "category produced by some item concept" cross-reference is checked in `assertConceptTable`. A realisation's `blocks` is checked in `assertRealisation`.

A `{trait}` must name a declared trait of a compatible form:

- it must be the same form as the field;
- a range trait must lie inside the field's range;
- a stepped field needs an enumerable trait whose every value the field admits;
- an open trait needs the same open spec.

`blocksImplementedBy(entry, concepts)` was added. No statement was added to `CAPABILITY_STATEMENTS`; the existing P6-only pin still holds. `concepts.test.js` gained 18 concept refusal rows and 9 `blocks` refusal rows, all against a TEST DOUBLE.

| # | Mutant | Predicted | Measured |
|---|---|---|---|
| e | `guardian.defence = {fire: 'damage'}`: a test row, and in D4 a **source** mutant on the real table | reds naming `guardian`, `fire`, *"no item concept produces it"* | `ConceptContractError: concepts: concept "guardian"'s defence names the category "fire", and no item concept produces it — …` (the module refused to load; restored) |
| f | double `blocks: {chase: {speed: {trait: 'nope'}}}` | refused, naming the trait | `… block "chase" field "speed" reads the trait "nope", which the concept does not declare — it declares [toughness, speed]` |
| g | double `blocks: {chase: {range: 'fast'}}` | refused, naming the field and its form | `… block "chase" field "range" was given "fast", which is not in its domain — the field is range (the range 0..20 (unstepped))` |

## D4 — the table (`d0ee55e`): PASS, with one declaration not made (water)

- `sword.weaponCategories = ['sword']`.
- `guardian.defence = {sword: 'damage'}`, the string form, which is the response's default `factor: 1`.
- `guardian.traits`: `toughness` is `range {1..5}`, default 1 (one hit, the trial world's gate). `speed` is `range {0..1}`, default 0 (a fraction of the substrate's player speed; 0 is the gate guardian). Each has a `why`.
- No new concept. A test pins that exactly these three P2 fields exist in the table.
- **`water.triggers`: not declared, because it does not fit honestly.** Water is crossed with *swim*, which is an ability and not a weapon category. `itemCategory`'s `category` is open over `weaponCategories`, so declaring `swim` a weapon would be a lie told to make the schema fit. `level`, `counter` and `channel` do not describe water either. A test pins that `WEAPON_CATEGORIES` has no `swim`.
- `mazeConcepts.js` and the text adventure's realisations implement no block: `blocksImplementedBy` returns `[]` for both (pinned), and both still pass `assertRealisations`.
- Byte inertia: the preset md5 line is identical, all 25 rebuild lines are identical, `check-sidecar-fields` gives the same output as `origin/main`, and the `conceptTrialWorld` pin passes (8/8, the same count).

## D5 — records (`99d63a7` + this report): PASS

`concepts.md` has a new section, **§ Behaviour**. It covers the three forms (a table), the one draw law, the four registries with "declared where introduced, checked by cross-reference", the concept fields with one example each, and a realisation's `blocks` with `blocksImplementedBy`. It has no counts.

Gates after the docs edit:

| Gate | Result |
|---|---|
| `generate-procgen-reference.mjs` | the README word count and `procgenDocs/generated/docsIndex.js` moved |
| `generate-docs-index.mjs` | the quick-launch index was already current, so no diff |
| `npx vitest run frontend/modules/procgenDocs` | 8 files / 487 tests, green |
| `node scripts/procgen/check-procgen-docs.mjs` | `ALL CHECKS PASSED` (exit 0; no box-lock holder in the sandbox) |
| `substrate-registry.md` | **untouched** (absent from `git diff --stat origin/main`) |

## The exported API, as P1 and P3 will call it

```js
// procgenCore/templateContract.js
domainKind(p)                  // 'list' | 'range' | 'open'
enumerableValues(p)            // p.domain itself | stepped range expanded (frozen) | null
valueInDomain(p, v)            // boolean (open: typeof v === 'string'; registry membership is NOT checked here)
describeDomain(p)              // '[2, 3]' | 'the range 0..1 (unstepped)' | 'the range 2..6 step 1' | 'any string (open)'
assertDrawable(p, owner)       // throws TemplateContractError unless list or stepped range
assertParamSchema(params, owner) // accepts all three forms; returns the Set of keys

// procgenCore/behaviourBlocks.js
createRegistry(name, { check })            // → { name, declare(id, {why, ...}), has(id), get(id), ids() }
BLOCKS, WEAPON_CATEGORIES, DEFENCE_RESPONSES, TILE_TRIGGERS, REGISTRIES, BLOCK_FAMILIES
fieldValueRefusal(p, v)                    // null | 'is not in its domain' | 'is not an id the "<reg>" registry declares'
BLOCKS.declare('orbit', { family: 'movement', why: '<one sentence citing the source class>',
    fields: [
        { key: 'radius', range: { min: 1, max: 6 }, default: 2, why: 'tiles from its anchor' },
        { key: 'dir', domain: ['cw', 'ccw'], default: 'cw', why: 'a genuine finite choice' },
        { key: 'onHit', open: { id: 'weaponCategories' }, default: 'sword', why: '…' },
    ] });

// procgenCore/concepts.js — a concept's behaviour
guardian: { kind: 'enemy', /* … */
    defence: { sword: 'damage', fire: { response: 'breakIfLevel', level: 2 } },  // each category produced by some item
    traits: [{ key: 'speed', range: { min: 0, max: 1 }, default: 0, why: '…' }] },
sword: { kind: 'item', /* … */ weaponCategories: ['sword'] },
door: { kind: 'obstacle', /* … */ triggers: [{ kind: 'itemCategory', category: 'fire' }] },

// a realisation's blocks (substrate half)
guardian: { tier: 'mechanic', placements: { /* … */ },
    blocks: { chase: { speed: { trait: 'speed' }, range: 6 }, contact: { damage: 1 } } },

normaliseDefence('damage')                  // { response: 'damage', params: {} }
blocksImplementedBy(entryOrRealisations, CONCEPTS)
// → [{ concept: 'guardian', block: 'chase', family: 'movement' },
//    { concept: 'guardian', block: 'contact', family: 'attack' }]
```

## Could `relations.weakness` be derived from `defence`? Measured, not done

The derivation: for each defended category whose response is not `ignore` or `knockOnly`, take the item concepts whose `weaponCategories` include it. On the shipped table it **equals** `guardian.relations.weakness` (`['sword']`), and a test pins that. Guardian is the only concept that declares both, so this is one agreement, not a proof. Two things are open before it could replace `weakness`:

- whether `breakIfLevel`, `stun` and `freeze` count as "beaten by";
- that `weakness` is read by selection logic, while `defence` today is read by nothing except the checker.

## What the brief got wrong (measured)

1. **`bounce` is a registered substrate id.** The live ids are `bounce flash flash_seedling flash_seedling_gen jta maze omsi runner text_adventure`. A starter block named `bounce` would fail the nameless source test the brief also requires. I declared it as **`rebound`** (same meaning, cited to `Flyer.as`) and did not loosen the test. If the name `bounce` matters, the choice is between exempting it narrowly in the nameless test and keeping `rebound`. That is the user's call.
2. **§0 and §3 D1 conflict on `scripts/procgen/`.** §0 says to touch nothing under `scripts/procgen/` except the two generators' output; D1 lists `reference/catalogue.mjs` and two `check-*.mjs` scripts as readers to change. I followed §0 (the ⛔ rule) and covered those readers with the list tripwire (above), naming each one.
3. **"`watchViewer` never meets a non-list because `defineTemplate` refuses unless drawable" is only half true.** A stepped range IS drawable. That is why a tripwire is needed rather than the proof alone. The brief also listed six `watchViewer` line numbers; there are nine (6119, 6167 and 6183 were missing).
4. **"13 parameters declared today."** Measured: **29 distinct declarations**, every one a list. By source: palette templates 10, element-spec heads 11 (including the binding's `binds`), skeleton kinds 3 (`chambers`, `prune`, `minRoom`), the area spec 4 (`partition`, `graphify ∈ [0, 0.2, 0.5, 1]`, `shortcut`, `goalShortcut`), concept `colour` 1.
5. **`frontend/modules/shared/rng.js` has no `pick`.** The draw API the contract spends is `procgenCore/procgenRng.js`'s `ProcgenRng.pick`, which needs an injected `source`. The counting rng in the tests wraps it, with `shared/rng.js` as the source.
6. **`templateContract.test.js` did not exist**, so I created it. `elementSpec` has no test file of its own either; the W0 filter `procgenCore/elementSpec` matches nothing by itself.
7. **Citations.** Ten starter ids have no Seedling class that a grep of the Seedling source could tie to them. Their `why` says so (*"no Seedling class measured for it here (its source is the plan's Appendix B, which this clone does not carry)"*): `reflect`, `heal`, `split`, `phaseGated`, `seek`, `lineOfSight`, `persistence`, `onHit`, `allEnemiesDead`, `facingAway`. `explosion`'s own hit string was also not measured. My first guesses (`Squishle` splits, `ShieldBoss` reflects, `LavaBoss` heals) were checked against the source, found false, and removed before committing. ⚠ D2's commit message says "seven ids"; the true number is ten, plus `explosion`.
8. **The harness branch started at `3844942`, not `c0b2c8a`.** It is merged now (see the top).

## Residue

- **A stepped range's expansion has no cap.** Validation is arithmetic, but `enumerableValues` on `{0..1e9 step 1}` would allocate a billion values. No such declaration exists; a cap would be a new law, so I did not invent one.
- **`templateContract` cannot check registry membership** for `open: {id}` (it imports nothing). The check happens in `behaviourBlocks.fieldValueRefusal`, which `concepts.js` uses. An `open: {id}` naming a registry `REGISTRIES` does not hold passes `fieldValueRefusal`'s membership step, but `assertVocabulary` refuses it for every starter schema.
- **Only `defence` has the "produced by an item" cross-reference.** A tile trigger's `itemCategory.category` must be a declared category, but need not be produced by any item in the table. That is not asked for, and I did not add it.
- **The `matrix` block's single field (`responses`, open over `defenceResponses`) is the fallback response.** The per-category map lives on the concept's `defence`. That split is my reading of the plan, not the plan's text.
- **The trait→field compatibility rules** (same form; a range inside the field's range; a stepped field needs an enumerable trait) are my design inside the brief's *"a range trait onto a range field, an open onto an open"*.
- **No browser run.** `mazeLabView.js` changed only by `p.domain` → `enumerableValues(p)` (the same array for a list). It was checked with `node --check` and by the tests that import its siblings, not by the in-app runner. No `npm test`, no `pytest`, no unfiltered vitest (⚖ 52). The suite number comes from CI at the pushed SHA.
