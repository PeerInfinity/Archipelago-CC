# Concept library T0 — the contract and the selection step (cloud report)

**Worker:** `concept-library-t0` (Opus build slice, cloud fan-out, 2026-09-30).
**Branch (harness-designated):** `claude/concept-library-t0-prsp7n`. The brief's local name `concept-library-t0` was not used; the harness only pushes its own branch.
**Started from:** `ec5b4314ef` (origin/main at launch; the designated branch was at `996080b006` and was fast-forwarded).
**Code head:** `26838fbbd8`, a merge of origin/main `4a52d4edc3` (seedling-engine-prep A1) into this branch. This report is the commit after it.

| D | Commit | Verdict |
|---|---|---|
| D1 the contract | `2f738abf3e` | PASS |
| D2 the table | `cc0ff58d63` | PASS |
| D3 the selection | `312c5ac16f` | PASS |
| D4 the chart's input | `52cd101da8` | PASS |
| D5 what a new field owes | measured only, no commit | PASS (table below) |
| D6 records | `3cdfe185df`, then the merge `26838fbbd8` | PASS |

## W0 — BEFORE / AFTER

| Gate | BEFORE (`ec5b4314ef`) | AFTER (`26838fbbd8`) |
|---|---|---|
| `md5sum frontend/presets/*/*/*_rules.json \| md5sum` | `58820064449a5afa2441d34466fcb20a  -` | `58820064449a5afa2441d34466fcb20a  -` (identical) |
| `node scripts/procgen/generate-procgen-reference.mjs --check` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | same line |
| bounded vitest, W0 list (`substrateCapabilities differentialGrade templateContract ruleRequirements library`) | `Test Files 4 passed (4)` / `Tests 80 passed (80)` | `4 passed (4)` / `80 passed (80)` |
| bounded vitest, W0 list + `procgenCore/concepts` + `procgenPipeline/conceptSelection` + `procgenDocs` | — | `Test Files 15 passed (15)` / `Tests 678 passed (678)` |
| `node scripts/procgen/check-procgen-docs.mjs` | — | `ALL CHECKS PASSED`, exit 0 (no lock holder in the sandbox) |

⚠ The W0 filter `templateContract` matches no test file, because `procgenCore/templateContract.test.js` does not exist. So the W0 run covers 4 files, not 5.

**Byte inertia.** `git diff --stat origin/main` shows 11 files, +1366/−11:

- **New:** `concepts.js`, `concepts.test.js`, `concepts.table.test.js`, `conceptSelection.js`, `conceptSelection.test.js`, `docs/.../concepts.md`, and this report.
- **Generated:** `README.md` (index region), `generated/docsIndex.js`.
- **Three hand edits outside "new + generated":**
  - `scripts/procgen/reference/docsIndex.mjs`: one line, `'concepts.md'` in `README_ORDER`. The generator refuses a document that is not listed, so this is where "its row in the procgen README" has to go.
  - `procgenDocs/docLinks.test.js` and `docsRender.test.js`: the link-census pins, which a new document must move.

## D1 — the contract (`procgenCore/concepts.js`, `concepts.test.js`)

**What landed:**

- **Vocabulary:** `CONCEPT_KINDS`, `EFFECTS` / `EFFECT_WORDS`, `TIERS`, and `RELATIONS` (`weakness`, `crossedWith`, `openedBy` — closed, so a typo throws).
- **The two effect tables:**
  - `EFFECT_LAW`: `requires → LAW_CUT`, `helps → LAW_SHORTCUT`, `none → null`.
  - `EFFECT_GRADES`: `requires → REQUIRING_GRADES` (the same frozen object), `helps → [SHORTENS]`, `none → [INERT]`.
  - Every value is imported and none is spelled in this file.
- **Grade check:** `gradeCertifies(effect, grade)`.
- **Errors:** `ConceptContractError`.
- **Instances:** `instancesOf(concept)` goes through `enumerateValues`.
- **`assertConcept`:** `params` go through `assertParamSchema`. A parameterised concept needs `idFor` and a `presentation` row for each instance id, no more and no fewer.
- **`assertConceptTable`:** every relation resolves. A parameterised relation target must have an instance for every source instance. Item ids and item names must each be unique across the table.
- **`assertRealisation` / `assertRealisations(entry, concepts)`:**
  - An absent `conceptRealisations` is not an error.
  - A `rule` field is refused.
  - `none` must have no needs; `requires` and `helps` must have at least one.
  - A need must be an unparameterised item concept with a positive integer count, named once.
  - An item realisation must not carry `placements`.
- **Also exported:** `normaliseNeed` and `itemIdOfNeed`.

**Nameless source check:** it reads the source and refuses a `node:` import, a registry / generated-registry import, a `seedlingDemo` import, or any id from `substrateRegistry.getAll()`. It covers `concepts.js` and `conceptSelection.js`.
- Self-mutant: appending `// the maze gate` made it red with `+ "maze"`, and it went green again after the restore.

**Gate:** `concepts.test.js` 59 tests pass.

## D2 — the table (`CONCEPTS`, `concepts.table.test.js`)

**What landed:** `sword`, `swim`, `guardian`, `water`, `key` and `door` (`key` and `door` are parameterised by `colour`, 6 values in the shared order). Every concept is frozen, and `assertConceptTable(CONCEPTS)` runs at module load.
- `itemRowsOf` and `obstacleRowsOf` render instances in the shared library's row shape and key order.
- `door`'s `clear_set` comes from `openedBy: ['key']`, taking the key instance with the door's own colour.

**Pins** (read from `library.js` and `itemLabels.js`, never from this module's own output):
- Each of the 6 doors deep-equals `DEFAULT_OBSTACLES`, key order included.
- Each of the 6 keys deep-equals `DEFAULT_ITEMS`.
- `itemLabelOf('hasSword'/'canSwim'/'hasFeather')` gives `{sword.id,1}`, `{swim.id,1}` and `{swim.id,2}`.

**Mutant (a):** `door_blue`'s hex changed from `#404080` to `#404081`.
- Predicted: 2 red (the `door_blue` pin and the whole-lists row).
- Measured: 2 red, `door_blue` named. Restored, tree clean.

**Gate:** 19 tests pass. `library.js` was not touched.

## D3 — the selection (`procgenPipeline/conceptSelection.js` + test)

**What landed:**
- `needsAsItems`.
- `ruleFor`: `Has` (with `count` only when it is above 1, the spelling the committed presets use), `And` in declared order, and `True_` when there are no needs.
- `candidatesFor`, `selectRealisation`, `decorationsFor`.

**Round-trip rows:** each of these goes through `extractItemRequirementFromRule` and comes back `exact: true` with the right names and counts:
- guardian.gate, water.gate, water.shortcut
- the feather (swim ×2)
- sword AND swim ×2

**Candidate rows:**
- `Has(Sword)` → guardian.gate.
- `Has(Swim)` → water.gate, never the shortcut.
- `HasAll([Sword])` → guardian.gate.
- These give nothing: `Has(Swim,2)`, `And(Sword,Swim)`, `Or`, many-item `HasAny`, `Or(Sword, Sword+Swim)`, `True_`, and a foreign item.
- Only concepts in `offered` are considered; an empty or absent `offered` gives nothing.

**Draw budget,** checked against a counting wrap of the shared `createRng`:

| Situation | Draws | Result |
|---|---|---|
| 0 candidates | 0 | null |
| empty or absent `offered` | 0 | null |
| 1 candidate | 0 | that candidate |
| 2 candidates | exactly 1 | same seed → same pick; 8 seeds reach both |
| 2 candidates and no rng | — | throws, naming the problem |

**Mutant (b):** the count comparison dropped from `sameRequirement`.
- Predicted: 2 red (the `Has(Swim, 2)` candidates row, and the 0-candidates draw row, which uses the same rule).
- Measured: 2 red, both named. Restored, tree clean.

**Gate:** 29 tests pass.

## D4 — the chart's input

**What landed:**
- `conceptsRealisedBy(entry, concepts)` returns `[{concept, kind, tier, placements:[{key, effect}]}]` in declared order. An item's `placements` is empty.
- `itemTagsImpliedBy(entry, concepts)` returns the `feature` of every item concept the entry realises or needs, in first-seen order.
  - A test checks it against `substrateCapabilities.itemTagFeatures` asked about an entry whose `libraryItems` are those concepts' rows.
- A test asserts that no `CAPABILITY_STATEMENTS` field starts with `conceptRealisations`.

**Gate:** 5 new tests in `concepts.table.test.js` (24 in that file now).

## D5 — what a new registry field owes (measured once, then restored)

**The drive:** I added `conceptRealisations: {key, door}` to the maze entry (`mazeRoomLibrary.js`) and ran `node scripts/procgen/generate-procgen-reference.mjs`. Then I added one docs row and ran it again. Finally I restored everything with `git checkout`; afterwards `git status` was clean and `--check` matched.

| Question | Field alone | Field + one row in `substrate-registry.md` § *Entry contract* |
|---|---|---|
| Generator console | `registry: … 84 fields over 16 groups … 1 FINDING(S)` — `FINDING [registry] conceptRealisations — documented NOWHERE in the procgen docs` | `84 fields over 15 groups … 0 FINDING(S)` |
| Generated files that move | `substrate-registry.md` (matrix region: 83→84 fields, a new "Not documented in the registry reference" group, the finding row); `docs/json/features/procgen-substrates.md` (chart footer: 83→84, 44→45 "not yet read", `conceptRealisations` listed); `generated/capabilities.js` (`fields` 83→84, `fieldsUnread` 44→45); `generated/registry.js` (+92) | the same four, plus `procgen/README.md` and `generated/docsIndex.js` (word counts) |
| Tests that go red | `procgenDocs/generated.test.js` › *the P3b registry findings, pinned — ALL EIGHT FIXED by P5* (it pins findings to `[]`) | none: `procgenDocs` + `substrateCapabilities` + `substrateRegistryPanel` = 10 files / 554 tests green |
| Field-count pins | none. The 83/84 counts live only in generated output, and `--check` wants it regenerated | — |
| What description it owes, and where | a table row in `substrate-registry.md` § *Entry contract*, under the section that documents it. A row under *Build-time — procedural substrates* is enough, and it also groups the field there. The generator scans the heading to pick the group | — |
| `register()` | accepted the unknown field without complaint | — |
| The user chart | lists the field under "not yet read". That is a printed finding, not a failure | — |

⇒ **What T1/T2/T3 owe on the first entry that gains the field:**
- one row in `substrate-registry.md` § *Entry contract*;
- `node scripts/procgen/generate-procgen-reference.mjs`, with the four or six regenerated files committed.

Only the first of those workers pays this; later ones only regenerate.

## The exported API as T1/T2/T3 will call it

```js
import {
    CONCEPTS, EFFECTS, EFFECT_LAW, EFFECT_GRADES, gradeCertifies,
    assertRealisations, conceptsRealisedBy, itemTagsImpliedBy, itemRowsOf, obstacleRowsOf, instancesOf,
} from '../procgenCore/concepts.js';
import { ruleFor, candidatesFor, selectRealisation, decorationsFor } from '../procgenPipeline/conceptSelection.js';
```

| Call | Example |
|---|---|
| `assertRealisations(entry, CONCEPTS)` → `undefined` or throws `ConceptContractError` | `assertRealisations(substrateRegistryEntry, CONCEPTS)` in the entry's own test |
| `ruleFor(placement, CONCEPTS)` → Rule Builder JSON | `ruleFor({needs:[{concept:'swim',count:2}]}, CONCEPTS)` → `{rule:'Has', args:{item_name:'Progressive Swim', count:2}}` |
| `candidatesFor(rule, entry, {concepts, offered})` → `[{concept, placement, effect, needs, tier, art, mechanic}]` | `candidatesFor({rule:'Has',args:{item_name:'Progressive Sword'}}, entry, {concepts:CONCEPTS, offered:['guardian','sword']})` → `[{concept:'guardian', placement:'gate', …}]` |
| `selectRealisation(rule, entry, {concepts, offered, rng})` → candidate or `null` | `selectRealisation(gate.clear_rule, entry, {concepts:CONCEPTS, offered:world.concepts, rng})`; on `null`, keep today's `logic_gate` |
| `decorationsFor(entry, {offered})` → `helps`/`none` placements | `decorationsFor(entry, {offered:['water']})` → `[{concept:'water', placement:'shortcut', effect:'helps', …}]` |
| `gradeCertifies(effect, grade)` → boolean | `gradeCertifies('helps', gradeDifferential({required:false, withCost:40, withoutCost:55}))` → `true` |
| `EFFECT_LAW[effect]` | `EFFECT_LAW.requires === LAW_CUT`, the element law to declare for the gate element |
| `conceptsRealisedBy(entry, CONCEPTS)`, `itemTagsImpliedBy(entry, CONCEPTS)` | the input for a proposed chart row |
| `itemRowsOf(CONCEPTS.key)`, `obstacleRowsOf(CONCEPTS.door, CONCEPTS)` | the rows `DEFAULT_ITEMS` / `DEFAULT_OBSTACLES` hold today, for a later migration |

⚠ **`concepts` is always passed explicitly** (there is no default table argument). That keeps D1's functions testable against fixtures, and it means `selectRealisation` never silently reads a table the caller did not choose.

⚠ **`rng` must have `choice(arr)`.** That is the shared `rng.js` API, and it spends one `next()`. The procgen streams that expose `pick` (as `templateContract` uses) need `{choice: rng.pick.bind(rng)}` or an adapter. I did not pick one for them.

## What the brief got wrong (measured)

1. **`templateContract.test.js` does not exist**, so W0's bounded run is 4 files / 80 tests, not 5 files.
2. **`extractItemRequirementFromRule` is at `ruleRequirements.js:113`** (right), and the doc says `extractRuleRequirement` (the brief flagged this). **`concepts.md` uses the real name. `paths-and-obstacles.md` still says `extractRuleRequirement`.** I left that alone because it is not T0's doc; it is a one-word fix for whoever next edits it.
3. **"An inexact rule (`Or`, `HasAny`) has no candidates":** true for `Or` and for a many-item `HasAny`. A **one-item `HasAny` is exact** in the extractor (`HasAny([x]) ≡ Has(x)`), so it *does* select. This is by design, and no test row pins it.
4. **"Every item concept has a unique AP name":** the name a rule's `Has` carries is the item's **`id`**, not its `name`. Across the committed presets, `item_name: "key_red"` appears 28× and `"Red Key"` 6× (I did not trace which path writes the name). For sword and swim, `id === name`. The table check asserts both `id` and `name` are unique.
5. **`rng.js`'s draw API is `choice`, not `pick`** (see above).
6. **The doc's "row in the procgen README" is generated.** It comes from `README_ORDER` in `scripts/procgen/reference/docsIndex.mjs`, so the script needed its one-line edit. Adding a doc also moves the two link-census pins in `procgenDocs`.
7. **`main` moved during the slice** (A1 added `seedling-constants.md`). Merging it conflicted only on the generated index and the census pins. I resolved it by regenerating and summing both deltas: links 304 → 305 → 312, `doc` 232 → 233 → 239, `same-doc` 14 → 15.
   - The D6 commit message says "six sibling links"; it is five in `concepts.md` plus its README index row. The pin comments are correct.
   - **Every sibling that adds a procgen doc will collide on the same three places.**

## Residue / open questions for the coordinator

- **`skin` tier semantics are unconstrained.** A `skin` realisation may declare a `requires` placement; the contract only checks that the tier is a known word. If "skin" is meant to be presentation-only, add a rule later; I did not invent one.
- **A need must be an UNPARAMETERISED item.** So "needs the red key" cannot be said as a need, only through a door's `openedBy` relation. That is enough for the trial; revisit if a substrate wants a coloured-key gate as a placement.
- **No `ELEMENT_LAWS` dependence beyond `LAW_CUT` / `LAW_SHORTCUT`,** so a third law from F1 does not break this file. `EFFECT_LAW` needs a new row only if a fourth effect is ever added.
- **Merging this branch and F1's** will collide on the procgen README index and the `procgenDocs` link pins if F1 adds a doc: regenerate, then sum the deltas.
- No registry entry, `library.js`, `substrateCapabilities.js`, preset, `package.json` or submodule was edited. No pytest, no unfiltered vitest, no `git stash`.
