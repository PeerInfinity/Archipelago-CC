# packStructure: what exists, the numbers and the bindings

The readers for three content-pack layers (⛓ content packs PL-1; the shared task shape Z.1–Z.4, ⚖ the user
2026-11-15). All three carry LOGIC, so the words setting never reads them (`procgenPipeline/worldContent.js`
`CONTENT_LAYERS` is `concepts` and `text`).

- `packStructure.js`: the `structure` layer. Entries of kind `task`, `stat`, `resource`, `boon`, `place` and (content
  sets PASS-1) `terrain` — a maze tile kind's declared `pass`, one of `TERRAIN_PASSES`, and (PASS-2) with `pass:
  "needs"` its `needs`, a mechanic concept id, and (PASS-3) with `pass: "one-way"` its `dirs`, and (GEN-1) an optional
  `generate: true` that lets the generator place the kind (`terrainGenerates`); read by `terrainOf` — keyed
  `<pack>:<kind>/<slug>` (the namespace is the pack's id), holding ids and links only. `createStructure(stack)`
  adds the packs together and resolves every id an entry names. `assertPresentsStructure(packConcepts, structure)`
  checks that every namespaced `presents` in the words names a real entry.
- `packNumbers.js`: the `numbers` layer, one set per game (`sets.<substrate id>`, its `exists` the pack it
  prices), values keyed by structure id and value path. Under ruling Z7 a set holds DEFAULTS. `createNumbers(stack)`
  merges a stack (a later pack wins per value path). `numbersSelectionRefusal(pack, {substrateIds, exists})` refuses,
  by name, a pack with no set for the world's substrate over the world's `exists`.
- `packBindings.js`: the `bindings` layer. Per game, per structure id of the pack's own structure, an object only that
  game reads. `createBindings(stack)`, `assertBindingsBind(bindings, structure)`.

Every malformed manifest throws a `ContentPackError` naming the pack, the key and the field. Pure and DOM-free: each
reader takes a LOADED stack (`contentPacks.loadPackStack`). Tests read the fixture packs in `fixtures/packs/`.

Detail: `docs/json/developer/procgen/concepts.md` § What exists, the numbers and the bindings.
