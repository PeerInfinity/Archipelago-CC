# Content sets C2: a substrate declares what content it can accept (as built)

Branch `content-c2`, based on `origin/content-c1` (`a4f0b35847`). C1 was not on `origin/main` when this slice began.
There are two code commits, one per part, and this report:

| Commit | Part |
|---|---|
| `806eb6b9bb` | `procgenCore/contentRoles.js` and its tests |
| `fc1f4918d2` | docs: `concepts.md` § Content roles, the registry's `contentRoles` paragraph, the regenerated index, and the link census pins |

There is no consumer. No registered substrate declares a role, no pipeline code changes, and there is no chart
statement.

## 1. `frontend/modules/procgenCore/contentRoles.js`

The module is browser-safe and names no registered substrate. It imports only `PACK_CONCEPT_KINDS`
(`packConcepts/packConcepts.js`) and `ConceptContractError` and `realisationsOf` (`concepts.js`). A test reads its
source to hold this, as `concepts.test.js` does for `concepts.js`.

Exported surface:

- `ROLE_FIELDS` = `accepts`, `needs`, `why`.
- `ACCEPTS_FORMS` = `kinds`, `presents`.
- `NEED_FIELDS` = `look`, `art`, `text`.
- `assertContentRoles(entry, concepts)`: if `contentRoles` is `undefined` or `null`, it returns (rule 4). Otherwise
  it throws a `ConceptContractError` naming the entry, the role and the fault.
- `contentRolesOf(entryOrRoles)`. An object with its own `contentRoles` gives that field, or `{}` when the field is
  not an object. A non-empty object whose every value has an object `accepts` gives itself. Anything else gives `{}`.
  A `conceptRealisations` object also gives `{}`.
- `roleRefusal(role, packConcept)`: `null`, or the first missing thing as a sentence.
- `candidatesForRole(entryOrRoles, roleId, packConcepts)`: keys in `packConcepts.keys()` order. An undeclared role
  throws, naming the declared roles, or saying that the entry declares none.
- `assertPresents(packConcepts, concepts)`: reads the WINNING entries only. An override that drops `presents` is not
  checked for the entry it replaced.
- `rolesFilledBy(entryOrRoles, packConcepts)` gives `[{role, concepts}]` in declared order. An entry with no roles
  gives `[]`.

### Every refusal of `assertContentRoles`

Each message begins `content roles: entry "<id>"'s role "<role>"`. The first two below are the exceptions: they name
only the entry.

- `contentRoles` is not an object (an array included);
- a role with an empty id;
- the role is not an object;
- an unknown role field (allowed: `accepts`, `needs`, `why`);
- no `why`, or an empty `why`;
- `accepts` is missing or not an object;
- `accepts` has an unknown field;
- `accepts` declares neither form, or both (the message says which);
- `kinds` or `presents` is not a non-empty list, holds a non-string or empty string, or lists an id twice;
- a kind that is not in `PACK_CONCEPT_KINDS` (a mechanic kind such as `enemy` is refused too);
- a `presents` id that the concept table does not hold;
- a `presents` id that the entry's `conceptRealisations` does not realise;
- `needs` is not an object;
- `needs.name` (refused with the reason: every pack concept has a name);
- an unknown need;
- `needs.look` or `needs.art` is not a boolean;
- `needs.text` is not a non-empty list of distinct non-empty strings.

`needs` itself is optional.

### Every refusal of `roleRefusal`

They are checked in this order, and the first one found is returned:

- `there is no such pack concept` (null concept);
- `"<key>" is a <kind>; the role accepts <kinds>`;
- `"<key>" does not present [any of] "<id>", …` (also when it presents nothing);
- `"<key>" has no \`look\``;
- `"<key>" has no \`art\``;
- `"<key>" has no text slot "<slot>"`, for each slot in the role's order.

A `false` need asks for nothing.

## 2. Docs

- `docs/json/developer/procgen/concepts.md` has a new § **Content roles** before § Behaviour. It covers the
  shape (the brief's three roles), the rules for `accepts`, `needs` and `why`, and the six readers.
- `docs/json/developer/procgen/substrate-registry.md` has a `contentRoles` **paragraph** under the build-time
  table, linking to concepts.md § Content roles. It is not a table row: see §4.
- Regenerated with `node scripts/procgen/generate-procgen-reference.mjs`. Only the README index and `docsIndex.js`
  changed (word counts). The generator reports 0 findings.
- The link census in `docLinks.test.js` and `docsRender.test.js` moves from 396 to 397 (`doc` 296 → 297), and
  each file has a history line for the change.

## 3. Tests

The new file is `frontend/modules/procgenCore/contentRoles.test.js` (48 tests). It covers:

- each `assertContentRoles` refusal (25 rows) and each `roleRefusal` refusal;
- the order in which `roleRefusal` checks;
- a two-pack stack in memory, read through `loadPackStack`:
  - the later pack's `theme:character/the-gate` presents `guardian` and is the one gate candidate;
  - the earlier pack's `base:character/half-gate` presents `guardian` but lacks a slot, and is refused with
    `has no text slot "passedWith"`;
  - the earlier pack alone fills no gate;
- `candidatesForRole` order, for the character role and the info role;
- `rolesFilledBy`;
- an undeclared role;
- `assertPresents` on an unknown id (`dragon`, named with its pack and key), and on an override that drops it;
- every registered entry, imported through `procgenCore/substrateLibraries.js`. Each one passes `assertRealisations`
  and `assertContentRoles`.

Expected values come from the data (the roles, the stack, `keys()`, `ofKind()`). No test label carries a count, and
`lint-gate-labels.mjs` reports nothing in the files this slice touched.

Bounded local run (ruling 52): `npx vitest run` over these paths:

- `frontend/modules/procgenCore/contentRoles.test.js`
- `frontend/modules/procgenCore/concepts.test.js`
- `frontend/modules/procgenDocs`
- `frontend/modules/packConcepts`
- `frontend/modules/textLibrary`
- `frontend/modules/contentPacks`

All 13 files passed, 721 tests. `scripts/procgen/lintGateLabels.test.js` passed separately (14 tests). No browser run
was needed. `check-procgen-docs.mjs`, the browser render of the docs, was not run.

**CI suite row at the code tip `fc1f4918d2`** (quoted from `ci-vitest-summary.mjs`, ruling 52): `suite: vitest (unfiltered)  1191/26521   (26521 passed | 0 skipped | 0 failed)`; slow battery 34/431 passed. Full output in §5.

## 4. What the code overturned in the brief

- **A `contentRoles` row in § Entry contract would turn the docs gate red.** `generate-procgen-reference.mjs`
  reports a field that a TABLE row documents and no entry carries (`documented as a field, carried by no entry`).
  `procgenDocs/generated.test.js` pins `REGISTRY.findings` to `[]`. This was measured: the first regeneration with
  the row printed `1 FINDING(S)`. Because no entry declares roles in this slice, the field is documented in prose
  under the build-time table instead. Prose counts as documented and raises no finding, so the generator reports 0.
  The paragraph says that the first entry to declare roles (R1 or R2) moves it into a table row. This matches plan
  §4: "the first entry to gain a new registry field reds `generated.test.js` until the doc row exists".
- **`roleRefusal` checks that a text slot is present, not that it resolves.** It takes no text library. The pack
  layer already requires each slot to be a namespaced key, and resolving it against the stack is the consumer's job.
- C1's `look` rule (both `color` and `symbol`) is unchanged. A role's `needs.look` relies on it.
- `needs` is optional, and so are `look` and `art` inside it. A `false` need is allowed and asks for nothing.

## 5. CI

`node scripts/procgen/ci-vitest-summary.mjs fc1f4918d2 --wait` (the `unittests` workflow at that SHA: success):

```
CI vitest @ fc1f4918d — run 42902102664 (2026-11-10T21:08:32Z)
  job "JavaScript Unit Tests (Vitest shard 1/3)"  completed success  397/9183
  job "JavaScript Unit Tests (Vitest shard 2/3)"  completed success  397/9139
  job "JavaScript Unit Tests (Vitest shard 3/3)"  completed success  397/8199
  job "JavaScript Unit Tests (slow Vitest)"  completed success  34/431
  suite: vitest (unfiltered)  1191/26521   (26521 passed | 0 skipped | 0 failed)
  slow battery                34/431   (431 passed | 0 failed)
```

## Next slice

C3, the world's `content` stack: the param, the record in `procgen_metadata[p]` only when it is not the default, the
rebuild reading it back, and a picker fed from `packs.json`. A consumer that resolves roles against a world's stack
calls `assertPresents` once on the loaded stack, then `candidatesForRole`. The first substrate to declare
`contentRoles` (R1 or R2) moves the registry paragraph into a build-time table row, regenerates, and adds the docs
census line that move needs.
