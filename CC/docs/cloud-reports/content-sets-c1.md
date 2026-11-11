# Content sets C1: content packs learn the `concepts` and `text` layers (as built)

Branch `content-c1`, based on `origin/main` `5a811f8e2a`. There are three commits, one per part:

| Commit | Part |
|---|---|
| `84353882ec` | `contentPacks`: the two layers and the `content` stack table |
| `7ad0aecd82` | `packConcepts`: the `concepts` layer reader |
| `b931a55b70` | `textLibrary`: the `text` layer reader |

There is no consumer. This slice changes no substrate, no pipeline code and no existing pack, and adds no pack to
`frontend/packs/`. The one change in `frontend/packs/` is an empty `content` table in `packs.json`, plus a sentence
about it in that file's `_comment`.

## 1. `contentPacks`

- `KNOWN_LAYERS` = `art`, `sfx`, `music`, `concepts`, `text`.
- `STACK_KINDS` = `graphics`, `sfx`, `music`, `content`.
- `parseRegistry` also returns `contentStacks`. The table may be absent or empty (both give `{}`). It validates
  like the other tables: `content stack "<name>" is not a non-empty list` and
  `content stack "<name>" names "<id>", which packs.json does not list`.
- The README now has a table of each layer and its reader, and a table of each stack kind and its
  `parseRegistry` field.
- Test changes:
  - The existing `KNOWN_LAYERS` row now checks `arrayContaining`, not an exact list.
  - The refusal row "a layer nobody reads yet" used `concepts` as its unknown name. `concepts` is known now, so
    the row uses `rules` instead.

## 2. `frontend/modules/packConcepts/packConcepts.js`

Exported surface:

- `PACK_CONCEPT_KINDS`: frozen `['character', 'place', 'object', 'info']`. This module owns the list.
- `PACK_CONCEPT_FIELDS`: frozen `['kind', 'name', 'description', 'look', 'art', 'text', 'presents']`.
- `parseConceptsManifest(json, packId)`: validates the manifest and returns it.
- `createPackConcepts(stack)` returns:
  - `has(key)`;
  - `get(key)`: the frozen `{ key, pack, ...entry }` with `look` and `text` frozen too, or null;
  - `ofKind(kind)`;
  - `presenting(mechanicId)`;
  - `keys()`.

Behaviour:

- A later pack wins per key, through `mergeKeyed`. An override replaces the whole entry: fields are not merged.
- `keys()` and `ofKind()` follow `Map` insertion order. That is stack order, then declaration order; an overridden
  key keeps the position where it first appeared.
- `presenting(id)` is computed over the **winning** entries and returns the one from the pack that is latest in the
  stack. So an override that drops `presents` stops that key presenting.
- `presents` is opaque, and there is no `procgenCore` import.

Refusals (each is a `ContentPackError` that names the pack, the concept key and the field):

- an unknown `schema_version`;
- an unknown field on the manifest (allowed: `schema_version`, `concepts`, `_comment`), on an entry, or in `look`;
- an un-namespaced concept key;
- an entry that is not an object;
- a `kind` that is unknown or missing;
- a missing or empty `name`;
- an empty `description`;
- a `look` that is not an object, a colour that is not `#rrggbb`, or a symbol that is missing or empty;
- an `art` value, or a `text` slot's value, that is not a namespaced key; a `text` that is not an object;
- an empty `presents`;
- **(added, see §6)** two winning entries of one pack that present the same mechanic id;
- `ofKind` of an unknown kind.

## 3. `frontend/modules/textLibrary/textLibrary.js`

Exported surface:

- `parseTextManifest(json, packId)`.
- `fillTemplate(template, vars)`.
- `createTextLibrary(stack)` returns:
  - `has(key)`;
  - `string(key)`: the string, or null (a list key also answers null);
  - `list(key)`: a frozen copy of the list, or null;
  - `fill`: the same function as `fillTemplate`;
  - `keys()`: strings first, then lists;
  - `packOf(key)`: **(added)** the pack the winning value came from.

Refusals (each names the pack, the key and the field):

- an unknown `schema_version`;
- an unknown manifest field (allowed: `schema_version`, `strings`, `lists`, `_comment`);
- a table that is not an object;
- an un-namespaced key in either table;
- a `strings` value that is not a string;
- a `lists` value that is not a non-empty array of strings;
- a key that is in `strings` and in `lists`, in one pack or across the stack. The message names both packs.

## 4. Tests

The tests are `frontend/modules/contentPacks/contentPacks.test.js`, `frontend/modules/packConcepts/packConcepts.test.js`
and `frontend/modules/textLibrary/textLibrary.test.js`. Each covers what the brief asked for:

- the brief's manifests, verbatim, read through `loadPackStack` with an in-memory `readJson`;
- a two-pack stack in which the later pack overrides one key and presents the same mechanic id. The reversed
  stack is checked too;
- every refusal;
- the committed packs, all of `packs.json`'s list, still loading whole, with each reader accepting the stack;
- `packs.json` still parsing.

No count of packs, layers or keys is hard-coded: expectations derive from the manifests and the registry.

Bounded local run: `npx vitest run` over the three test paths, `frontend/modules/artLibrary`,
`frontend/modules/sfxLibrary`, `frontend/modules/musicLibrary` and `scripts/procgen/seedlingSource.test.js`.
All 7 files passed, 146 tests. No browser run was needed.

**CI suite row at the code tip `b931a55b70`** (quoted from `ci-vitest-summary.mjs`, ruling 52): `suite: vitest (unfiltered)  1190/26472   (26472 passed | 0 skipped | 0 failed)`; slow battery 34/431 passed. Full output in §7.

## 5. `fill` against the text adventure's templating

`fill` matches `processMessageTemplate` (`textAdventureSubstrateWrapper/templating.js`) in two ways:

- A placeholder whose value is `undefined` or `null` is left as written.
- A non-string template gives `''`.

A test pins the plain cases equal to `processMessageTemplate`.

**It differs in three ways, on purpose, and the tests pin each one:**

1. It does not HTML-escape. The library is DOM-free, so escaping is the renderer's job.
2. It has no `wasUnchecked` highlight.
3. It substitutes in one pass with `/\{([^{}]+)\}/`, reading only the own properties of `vars`.
   `processMessageTemplate` uses split/join per variable, so a value containing `{other}` gets filled again by a
   later variable.

A consumer that moves the text adventure onto this library (R1) keeps the escape and the highlight in its own
wrapper.

## 6. What the code changed in the brief

Nothing in the brief was overturned. There are two additions and one stricter reading:

- **The brief did not settle what happens when one pack presents the same mechanic id from two keys.**
  `presenting` cannot answer "the last pack's entry" when that pack has two such entries. This slice refuses it by
  name. A consumer that wants several presenters per mechanic would need a different query.
- **`look` requires both `color` and `symbol` when it is present.** The plan describes a look as "colour + symbol".
  If a colour-only look should be allowed, C2 can relax this.
- **Text keys are always namespaced.** C0's shape allowed a concept's `text` slot to hold "a text key or literal".
  The brief (and this build) allows only namespaced keys, so inline prose must go through the text library.
- `textLibrary.packOf` was added to mirror `artLibrary.packOf`.

## 7. CI

`node scripts/procgen/ci-vitest-summary.mjs b931a55b70`:

```
CI vitest @ b931a55b7 — run 42891970992 success (2026-11-10T20:06:36Z)
  job "JavaScript Unit Tests (Vitest shard 1/3)"  completed success  397/9183
  job "JavaScript Unit Tests (Vitest shard 2/3)"  completed success  397/9138
  job "JavaScript Unit Tests (Vitest shard 3/3)"  completed success  396/8151
  job "JavaScript Unit Tests (slow Vitest)"  completed success  34/431
  suite: vitest (unfiltered)  1190/26472   (26472 passed | 0 skipped | 0 failed)
  slow battery                34/431   (431 passed | 0 failed)
```

## Next slice

C2, the roles contract in `procgenCore`. It imports `PACK_CONCEPT_KINDS` from
`frontend/modules/packConcepts/packConcepts.js`, and it owns the check of `presents` against the concept table.
