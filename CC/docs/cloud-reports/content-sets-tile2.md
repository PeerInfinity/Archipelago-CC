# Content sets TILE-2: a pack declares a tile kind's base (placement STOPPED at the measurement)

Branch `content-tile2`, based on `origin/main` `d3f74f4978`. The user asked for this on 2026-11-17 ("Pack-declared
tile kinds"), following TILE-1's line: *"I don't want adding a new custom tile type in the library to require
updating the default graphics."*

**Outcome:** parts 1 (the declaration) and 2 (the lookup) are built and pinned. Part 3's measurement found that **no
existing world field can carry a pack-declared tile kind without a generator change or a new field**, so, as the brief
says, the slice STOPS there. Part 4's proof is therefore done at the level of the lookup and the chain, over a
test-only fixture pack. No painter places a pack kind. The placement options are in § 3, for the planner to take to
Robert.

## Commits

| # | SHA | What |
|---|---|---|
| 1/3 | `231c990fa9` | The declaration: `packConcepts.PACK_TILE_BASES` and the optional field `base`, refused by name outside the set |
| 2/3 | `61598b94fa` | The lookup: `mazeTileArt.mazeTileKind`, `tileKindKeys`, `tileKinds` on the play-time load; the pin `mazeTileKind.test.js` |
| 3/3 | `4dc78a032e` | Docs: `maze.md`, `packConcepts/README.md`, `packs/README.md`, the regenerated docsIndex |
| — | this commit | This report |

## 1. The declaration and its refusals

A concept row in a pack's `concepts` layer may carry `base` next to its `art` key:

```jsonc
"lamps:object/lantern": { "kind": "object", "name": "A Lantern", "art": "lamps:tile/lantern", "base": "marker" }
```

- **The set is closed:** `PACK_TILE_BASES` = `floor`, `wall`, `marker`, `character` (TILE-1's `MAZE_TILE_BASES`).
- **Who owns the names.** `packConcepts` owns the list, the same way it owns `PACK_CONCEPT_KINDS`. That avoids an import
  cycle, because `mazeTileArt` already imports `packConcepts`. `MAZE_TILE_BASES` keeps one draw per name, and
  `mazeTileArt.js` refuses **at import** if its keys differ from `PACK_TILE_BASES`, with a message that names both
  lists. So the two cannot drift apart.
- **Refusal at load, by name:**
  `pack concepts: pack "bad" concepts manifest: concept "bad:character/x": base "lamp" is not one of floor, wall, marker, character`.
  The pin checks `"lamp"`, `"Marker"`, `""`, `3` and `null`.
- **Optional:** a row with no `base` parses. The field is valid with or without `art`, and on any concept kind.
- **Provenance per entry:** it applies as it does to any concept row. A base-declaring row resolves to its own `src`,
  or else to the layer's default, through the loader's own check (`provenanceCounts`). An unlisted `src` is refused at
  load: `content pack "lamps" layer "concepts" provenance key "lamps:object/lantern": src "nobody" is not a listed source (hand)`.

## 2. The lookup

`mazeTileArt.mazeTileKind(kind, { packConcepts, tileKinds })` → `{ artKey, base }` (frozen). This is what
`drawMazeTile` takes beside the kind.

| kind | answer |
|---|---|
| a `MAZE_ART_KEYS` row | the row's `key` and `base`, exactly as the chain resolves it today. A pack cannot re-declare a row: concept keys are namespaced (`ns:path`) and row names are not |
| a pack concept key | its `art` and `base`, each `null` when absent. Read from `packConcepts` (the world's stack, `createPackConcepts`), the same reader that `thingArtKeys` and `conceptArtKeys` read, or from `tileKinds` |
| anything else | `{ artKey: null, base: null }`: the chain draws the placeholder and never throws |

- `tileKindKeys(packConcepts)` → `{ conceptKey: { artKey, base, pack } }` for every row that declares a base.
- `loadMazeTileArt` (when it reads the concepts layer, i.e. `contentRoles` given) returns `tileKinds` and puts it on
  `tileArt`. It also decodes the declared kinds' art sheets, so a placement slice only needs to call
  `drawMazeTile(…, mazeTileKind(kind, { tileKinds: tileArt.tileKinds }))`. `tileArtRefusal` refuses a malformed
  `tileKinds` by name.
- **No committed pack declares a base**, so every committed load has `tileKinds` = `{}`, decodes the same sheets, and
  builds `tileArt` exactly when it did before (§ 5, measured).

**The pin** (`mazeTileKind.test.js` § 1): every row's answer equals its row, with no stack, with a stack and with
declared kinds. `drawMazeTile` also records the same draw-op log with the lookup's answer as without it, for every row,
with and without an own draw, under three art variants: none, a stub with every key, and the committed `meta` theme
loaded from disk. A mutation (a row answering another key and base) reds the pin.

## 3. Placement: MEASURED, and the slice stopped

Where could a world carry a new tile kind?

| Candidate | Can it carry a pack kind with no generator change? | Why |
|---|---|---|
| The grid (`tiles`) | **No** | Its vocabulary is closed to floor and wall (`TILE_GRID_SIDECAR_FIELDS.tiles` schema enum; `gridTiles.js`). `gridTiles.js` and `mazeRoomEngine.js` are **in the engine closure**, and a tile value there is logic: passability |
| Entity fields (`obstacles`, `items`, `blocks`, `buttons`, `traps`, `pulls`, `pulsers`, `manaTiles`, `consumableTiles`, `hazards`) | **No** | Each record is a mechanic: a gate, an AP location, a pushable, a timer, a refill. A decorative kind placed in one would gain that field's logic. `consumableTiles` carries `{substrate, type, count}`, not a kind |
| `things` | **No** | (a) It is explicitly not a tile. Its schema says *"NOT an AP check and not a tile"*, and `mazeThings.js` cites the user's 2026-11-14 ruling. (b) The generator picks a holder only from concepts that have a `look` (`MAZE_CONTENT_ROLES.object.needs.look`), and `regionThings` bakes `look.color`, so a thing always has its own draw and the chain's base step could never be reached. A look-less kind is never placed. (c) It is one per region, look-only, and read on walk-on |
| A new field | Yes, but it is a new world field plus a generator (or editor) writer | § 3.1 |

### 3.1 The placement options for Robert

**A. A new optional field, e.g. `tileKinds: [{x, y, kind}]` (kind = the pack concept key).** This follows the `things`
pattern, so it stays outside the engine closure. It touches:
- a serializer wrapper beside `thingsSerializer` (placement by hash over `freeFloorCells`, no RNG draw);
- a `TILE_GRID_SIDECAR_FIELDS` row (its schema);
- the deserializer copy;
- the round trip's re-seat (`mazeRegionRoundTrip`);
- a sibling overlay to `drawWorld` (the `mazeThingOverlay` pattern, so the one-region op log stays unchanged when the
  field is absent);
- the composite cell.

`occupiedCells` already keeps `things` off any `{x, y}` the payload names. A world without the field stays byte-equal.
**Design questions it raises:**
- Which concepts qualify: any row with a `base`, or a new maze role (`tile`) with its own `accepts`?
- How many per region?
- ⚠ **Base vs passability.** Today a base is drawing only. A pack kind with base `wall`, placed on a floor cell, would
  draw as a wall and still be walkable, which is a lie the player would see. Either restrict placement to `floor`,
  `marker` and `character` bases, or make passability a separate, explicit decision. That decision would be logic, and
  then the field is no longer outside the closure's concerns.

**B. The editor only.** The maze editor (`mazeEditTools`) writes the same new field by hand, and the generator never
does. It needs the same field, schema, deserializer and painters as A, but no generation rule. It is the smallest
step that lets a person see a pack kind in a real world.

**C. Re-rule `things`.** Let a thing whose concept declares a `base` and has no `look` be chosen and drawn through the
chain (art → base → placeholder). It touches `MAZE_CONTENT_ROLES.object.needs` (eligibility: a generator change),
`regionThings` (tolerate no look), the thing schema (`color` is already optional), and `mazeThingOverlay`
(route through `drawMazeTile`). ⛔ It contradicts the 2026-11-14 ruling that a thing is not a tile, so only Robert
can choose it.

My recommendation is **B, then A**: one new optional field, written first by the editor (no generation rule to
design), then by a generator rule once Robert has ruled on which concepts qualify, how many per region, and the
base-vs-passability point.

## 4. The proof (at the level the stop allows)

`mazeTileKind.test.js` (11 tests) uses a **test-only, in-memory fixture pack** `tile2-fixture`. It is not on disk, not
in `packs.json`, and no preset carries it. The pack declares `tile2-fixture:object/lantern` (art
`tile2-fixture:tile/lantern`, which no theme carries; base `marker`) and the same kind with no base.
- With its base, it draws exactly `paintMazeTileBase(marker)` under every art variant (none, every-key stub, the `meta`
  theme). No warning, no throw.
- Each base of the closed set draws its own base draw.
- The same kind with no base, and an unknown kind, draw exactly the placeholder under every variant, each logged once.
  No throw.
- With art for its key, it draws the art (step 1).
- Through `loadMazeTileArt` with a fixture art layer: `tileKinds` is carried, the lantern's sheet (and only it) is
  decoded, and the loaded `tileArt` draws the art.

**Not done, because placement stopped:** "draws as the marker base in both views". No view places the kind, so there
is nothing to draw in a world, and **no screenshots**. TILE-1's
`content-sets-tile1/chain-bases-and-placeholder-tip.png` already shows the base and placeholder draws themselves.
**The default `maze` pack and every theme pack are unchanged:** `git diff d3f74f4978 -- frontend/packs` touches
`README.md` only.

## 5. The closure and byte-equality

| Instrument | Result |
|---|---|
| `seedlingDerivedRuleTable.js --print-engine-closure`, base and tip | **identical** (`diff` empty): `engineMd5 bec369878feb67081187edca62baa951 (42 files)`. No file of the diff is in it |
| **Op-log probe** (TILE-1's method). In this tree, once at the tip and once with `origin/main`'s `mazeTileArt.js` and `packConcepts.js` put back: every maze region of every committed `*_rules.json`, `drawWorld` + `drawMazeThings`, plain and fog views, under three art variants. The `meta` variant loads through `loadMazeTileArt` with `contentRoles`, so the new `tileKinds` path runs | 38 documents, 1,188 regions, 4,202,392 ops on both sides. Hashes base = tip: none `19da21cdc69a99073a0466d70d23fafc`, `meta` `b6657758ddf059f8293cdc453a5d01d3`, every-key `28f607c3716c47fc0356a1e90cadfd30` |
| `mazeRoomRender.test.js` op-log hash pins and the TILE-1 art tests | pass (in the bounded run) |
| `make-seedling-spiral-room-preset.mjs --state=concept-trial --check` / `--state=meta-trial --check` | both OK: a fresh build matches the committed preset |
| `action-nodes-compile.mjs --check` | OK, byte-identical |
| No preset, pack data or generator in the diff | `git diff --stat d3f74f4978 -- frontend/presets` is empty. The packs change is `README.md` only. The one generation-time module touched is `packConcepts.js`, and its new check accepts every committed manifest unchanged, since none carries `base` |
| `ci-producer-checks.mjs` | runs in CI's JSUT at the pushed SHA (quoted in the report back) |

## 6. Gates (local, at the code tip `4dc78a032e`)

- **Bounded vitest:** `contentPacks`, `packConcepts`, `mazeRoom` (all of it, including `mazeTileFallback`,
  `mazeTileArt`, `mazeTileKind` and the art siblings), `procgenCore`, `procgenDocs` and `packStructure`: **187 files,
  5,238 tests, all passed** (before the docs commit). After the docs commit: `procgenDocs`, `packConcepts` and
  `mazeTileKind`, 10 files, 547 tests, all passed.
- `generate-procgen-reference.mjs --check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE (after
  `--write` regenerated `docsIndex.js` and the README's word count for the `maze.md` edit).
- `check-procgen-docs.mjs`: ALL CHECKS PASSED (it runs its own server; the box was free).
- CI at the final tip: quoted in the report back to the planner.

## 7. Test paths

- `frontend/modules/packConcepts/packConcepts.test.js`. New: the base refusals; each base parses with or without `art`;
  a row with no base parses; `PACK_TILE_BASES` is the closed set; per-entry provenance on a base-declaring row (own
  `src`, default, and an unlisted `src` refused). The narrator fixture gains `base`, so the "every accepted field is
  exercised" row still holds.
- `frontend/modules/mazeRoom/mazeTileKind.test.js` (new): §§ 2 and 4 above.
- `frontend/modules/mazeRoom/mazeTileArt.test.js`: the empty-stack load result gains `tileKinds: {}`.

## 8. What the code overturned

1. **Placement needs a new field (or a generator change).** The brief allowed for this and asked for a stop. The
   measurement adds one point the brief did not have: `things` is excluded by a standing user ruling (*a thing is not
   a tile*), not only by mechanics. Its generator also requires a `look`, so the chain's base step would never be
   reached for a thing.
2. **Where the base names live.** The brief says `base` "must be one of TILE-1's closed `MAZE_TILE_BASES`". The parser
   cannot import that table without a cycle (`mazeTileArt` → `packConcepts`). So the names moved to
   `packConcepts.PACK_TILE_BASES` (the parser owns them, as it owns the kinds), and `MAZE_TILE_BASES` refuses at import
   to differ. The set is still TILE-1's, and still one list.
3. **A new design point for placement: base vs passability.** A base is drawing only. A `wall`-based kind on a walkable
   cell would draw a lie, so whoever places kinds must rule on it (§ 3.1).
