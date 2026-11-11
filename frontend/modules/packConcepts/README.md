# packConcepts

**The characters, places, objects and information a content set offers.** It reads the `concepts` layer of a
content-pack stack (`../contentPacks/`), merged so that a later pack wins per key.

- `createPackConcepts(stack)` answers five questions:
  - `has(key)`: does any pack in the stack carry this concept?
  - `get(key)`: the winning entry, frozen, as `{ key, pack, kind, name, … }`; `pack` is the pack it came from.
    It returns null for a key no pack carries.
  - `ofKind(kind)`: the keys of one kind, in `keys()` order. An unknown kind is refused.
  - `presenting(mechanicId)`: the entry of the **last** pack in the stack that re-presents that mechanic concept, or
    null.
  - `keys()`: every key, in stack order and then declaration order. An overridden key keeps the position where it
    first appeared.
- `PACK_CONCEPT_KINDS` is `character`, `place`, `object` and `info` (a piece of information, such as a clue). This
  module owns the list; the roles contract imports it.
- ⛔ **A pack concept never affects reachability.** Mechanic concepts (`sword`, `guardian`, …) live in
  `procgenCore/concepts.js` and carry logic (`docs/json/developer/procgen/concepts.md`). A pack concept carries
  presentation only. `presents` names a mechanic concept that the entry re-presents. Here it is an opaque id: this
  module does not import `procgenCore`, and the check against the concept table belongs to the roles contract.
- **An override replaces the whole entry.** Fields are not merged: a later pack that overrides a key without
  `presents` stops that key presenting anything.
- DOM-free: it takes a loaded stack (`loadPackStack`'s result), as `createArtLibrary` does.

## Concepts manifest

The manifest is `concepts/manifest.json` inside a pack:

```jsonc
{ "schema_version": 1,
  "concepts": {
    "meta:character/narrator": {
      "kind": "character",                                 // one of PACK_CONCEPT_KINDS
      "name": "The Narrator",
      "description": "…",                                   // optional
      "look": { "color": "#c0a040", "symbol": "N" },        // optional
      "art": "meta:character/narrator",                    // optional; an art-library key
      "text": { "greeting": "meta:narrator/greeting" },    // optional; slot → a text-library key
      "presents": "guardian"                               // optional; a mechanic concept id
    } } }
```

- `look` is a colour and a symbol. With it, a theme is complete with no image, and every substrate can show the
  concept.
- `art` names a key in the art library (`../artLibrary/`). `text` maps a slot name to a key in the text library
  (`../textLibrary/`). Neither key is resolved here.

## ⛔ Refusal by name

Each of these throws a `ContentPackError` that names the pack, the concept key and the field:

- an unknown `schema_version`;
- an unknown field on the manifest, on an entry or in `look`;
- a key that is not namespaced (`<namespace>:<path>`);
- an entry that is not an object;
- a `kind` that is not in `PACK_CONCEPT_KINDS`;
- a missing or empty `name`, or an empty `description`;
- a malformed `look`: the colour must be `#rrggbb`, and the symbol a non-empty string;
- an `art` value, or a `text` slot's value, that is not a namespaced key;
- an empty `presents`;
- two entries of one pack that present the same mechanic id (that pack's answer would be ambiguous).
