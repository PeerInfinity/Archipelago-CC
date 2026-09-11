# APWorld Editor Module

**Module ID:** `apworldEditor` · **Panel:** `apworldEditorPanel`

**Purpose:** the **hub** over a `rules.json` document. It edits regions, exits,
locations, access rules and items directly; it displays *every* top-level key the
document carries; and it is the door to every other editor that owns part of that
document.

- User guide: _not yet written_ — see [TODO](../user/modules/TODO.md)
- Arc plan: `NewDocs/plans/apworld-editor-hub-plan.md` (gitignored, on disk);
  tracked record in `CC/docs/plans/fable-to-opus-handoff-2026-07.md` §5n.

## Key files

| File | What it is |
|------|-----------|
| `apworldEditorUI.js` | the panel — chrome, tabs, and every handler |
| `rulesDocOps.js` | the document's **atomic ops**, pure and copy-on-write |
| `rulesEditAdapter.js` | those ops as an [`editCore`](./editorCore.md) adapter — `{name, apply, equal}` |
| `rulesUtils.js` | `validateRules`, `cloneFullRulesDoc`, the three rename cascades |
| `ruleTreeEditor.js` | the access-rule tree widget |
| `documentKeys.js` | the top-level **key registry**, derived from `rules.schema.json` |
| `documentLinks.js` | the **Links** tab's rows |
| `sidecarIssues.js` | (V0) the **sidecar validity report** — `sidecarIssues(doc, slot)`, the fourth validator: one pure function the validation bar, the per-region block and `check-sidecar-fields.mjs` all read |
| `sidecarForm.js` | (D1) the sidecar block's **fields view** model — `sidecarFormModel(entry, {rulesSchema})`: the rows (the entry subschema's fields, then the substrate's declaration), the control each type draws, and `withSidecarField`, the whole entry one control's change writes |
| `regionRoundTrip.js` | the per-region **Edit ▸** door — resolves the substrate's declarations, runs the baseline, folds a save into ONE op; (S0) `sidecarEntryFacts`, what a region's sidecar block says about its entry; and (S2) `deriveRegionRules`, the derivation half alone — a payload's own rules, named by the document |
| `regionLayout.js` | (M2) the map moves' layout — `slotLayout` (a slot's cells on a `Grid` sized by `mapBoundsFor`), `layoutChange` (the engine's placement, and every exit whose side-law verdict the move changed), `rewriteExitFlags` (a payload's `exits` in its substrate's own serialized form); the ops and their refusal sentences are `rulesDocOps.js`'s `move-region` / `swap-regions` |
| `regionRederive.js` | (S2) **Re-derive rules ▸** — `rederiveRegionRules({base, ops, doc}, slot, region)`: the pre-edit payload recovered from the session's record, and the ONE op that moves only the rules it produced |
| `../procgenCore/compositeMapRenderer.js` | the **Map** tab's painter — shared with the procgen pipeline panel, substrate-neutral |
| `../procgenPipeline/compositeMapDocument.js` | `reconstructResultFromSidecars` — `preset_sidecars` → a `Grid`; (M2) `mapBoundsFor`, the grid's size in cells, shared with the map moves |
| `rawView.js` | the **Raw JSON** tab's text and its parse (the size limit was RETIRED by measurement — H2b) |
| `downloadJson.js` | the download exit — the file name and the bytes |

## The document is a session, and the only way in is an op

`rulesDoc` is a **getter** over `session.record()` with no setter: an assignment
throws. Every mutation goes through `_applyOp`, which stamps the selected player
slot and hands the op to the `editCore` session, so the panel has undo (⌘/Ctrl+Z,
refused inside a text field) and a delete cascade is ONE group and therefore ONE
undo.

Three intake paths open a **new** session rather than recording an op, because
each installs a document that arrived from outside and no edit list can express
that: `stateManager:rawJsonDataLoaded`, the focus-safe `apworldEditor:loadRules`
hand-off, and the Reload button. **Undo does not cross a session boundary.**
`Clear`, by contrast, *is* an op — it is a function of the document being edited,
so it is undoable.

`Apply` publishes `files:jsonLoaded` with a full-document clone and **does not**
reset the session, so an undo after an Apply still works. It republishes the
**origin's** source name — see *The exits*.

## Tabs

| Tab | What it edits |
|-----|---------------|
| **Regions** | regions, exits, locations, access rules — and, under each region that has a `preset_sidecars` entry, its **sidecar block** (S0): the substrate, the entry's facts, its fields as a form (D1: read off the substrate's declaration; each change is one `set-region-sidecar`) above its JSON (editable since S1: **Save JSON** writes the entry as one `set-region-sidecar`), the two doors **Edit ▸** (the region's own room) and **Regenerate in the pipeline ▸**, and (S2) **Re-derive rules ▸** (the region's rules from its payload, after a raw save) — see *`preset_sidecars`, per region* below |
| **Items** | items, classifications, pool counts, starting counts, the slot's `item_groups` registry (I1) and its `progression_mapping` entries (I2) — see below |
| **Placements** (W3) | `canonical_placements` — which item this world places at which location; the world generator's `--canonical-seed` input, see below |
| **Meta** | the fields in `rulesDocOps.META_FIELDS`, plus the start region and the victory condition |
| **Map** | the composite grid, for documents whose sidecars carry grid cells; a click selects a region and draws its sidecar block under the map, a second click on it opens its room (M1); **Move / swap ▸** on that block moves the region to an empty cell or swaps it with another (M2) — see below |
| **Sidecars** (S1) | the five keys that travel BESIDE a world rather than inside its regions, and (S0) `preset_sidecars` as an expandable per-region list for the selected slot — see below |
| **Document** | **every** top-level key — see below |
| **Links** | every other editor that owns part of a `rules.json` |
| **Raw JSON** | the whole document in a CodeMirror 6 editor — see *The exits* below |

## The player selector

A `rules.json` is keyed by **player slot** at fifteen of its thirty-two
top-level keys (`patternProperties: {"^[0-9]+$"}`, re-derived from the schema),
and 15 committed presets carry four players. The toolbar's
selector is what every tab reads and what every op is stamped with. Its default
is derived, in this order (`documentKeys.defaultPlayerOf`):

1. the document's own top-level **`playerId`** — the only key that says which slot
   the document is *about*; it is a **string**, and it appears only in
   player-specific exports (`*_P<n>_rules.json`);
2. the first key of `player_names`;
3. the first slot the document actually carries.

⚠ A `playerId` naming a slot the document does not hold is ignored — otherwise
every tab would draw an empty world with nothing saying why.

⛔ Nothing about the selector is gated on `preset_sidecars`: that block is `{}` in
158 of the 192 presets carrying it, and every populated one keys under slot `"1"`
— the four-player multiworld documents included.

## The Document tab is DERIVED from the schema

`documentKeys.buildDocumentKeys(schema)` iterates
[`frontend/schema/rules.schema.json`](../../../frontend/schema/README.md)'s
`properties` and nothing else. Each entry carries the key, a label, the schema's
own `description` (which names the key's **producer**), its type, whether it is
per-player (read off `patternProperties: {"^[0-9]+$"}`, never listed), whether it
is required, which tab already owns it, and an `editor` slot.

⛔ **There is no second hand-maintained key list.** `documentKeys.test.js` asserts
the registry's key set and the schema's are EQUAL in both directions: a schema key
missing from the registry is a key the tab would not draw, and a registry key
absent from the schema is a row about a key nothing produces.

A key the document carries that the schema does **not** declare gets a raw-JSON
row, marked. The schema's top level is strict (`additionalProperties: false`), so
no committed preset can carry one — but a user-loaded file can carry anything, and
an "every element" tab must not silently drop what is visibly in the file.

Keys another tab already edits show a **pointer** to that tab — it is the place
that knows the shape, and a region map is not a JSON blob to its own editor. ⛓⛓
**W0 — and then the row draws its JSON block anyway**, the same affordance every
other row gets. Until W0 the pointer was the whole row: the branch drew it and
returned, so `world`'s other fields and `game_info`'s extras (the Meta tab draws
exactly one field of each) were reachable only through the whole-document Raw
JSON editor. ⚖ *every key gets a home tab, and the Document tab is the
everything-fallback* (user, 2026-09-08) — applied to all tab-owned keys
uniformly rather than to a hand list of "the partially covered ones", which
would be a second table that agrees with the tabs until a tab stops drawing a
field. The textarea is built **on expand**, so an owned row costs nothing until
somebody opens it.

Everything on the tab is editable, and the whole edit vocabulary is one op:

```js
{ op: 'set-key', key, value, scope: 'document' | 'player', player }
```

⛔ The **scope is recorded, never inferred from `player`**: every op in this module
carries `player` and the panel stamps it on all of them, so "a player is named ⇒
nest under the slot" would put document-level keys under a slot the moment this
tab grew its selector. `value === undefined` deletes the key.

Before a `set-key` reaches the session the panel applies it to a **preview**
document (`applyRulesDocOp` is pure), validates the preview with
`rulesJsonSchemaErrors`, and **differences** the errors against the ones the
document already had. So an edit is refused by name for what *it* breaks, and
never for somebody else's pre-existing violation.

### The validation bar (R1: memoised)

The bar above the tab body is `validateRules(record, slot)` — the semantic pass
(broken references and the like), distinct from the schema veto above. It is
drawn by `_renderChrome`, which runs on **every** render, and every `_selectTab`
renders; until R1 the whole pass ran each time.

`_validationIssues()` memoises it on **the record's object identity plus the
slot** — exactly the key `_mapCache` uses. `editCore` hands out a NEW record
object whenever the document moves (`apply` assigns `res.record`, `undo`
re-folds) and the SAME one when an op changed nothing, so object identity is
precisely *"could the answer have changed"* and there is nothing to remember to
bump. ⛔ **Not the op count**: `session.ops().length` reads `1` both after an op
and after `undo` + a different op, so the second document would be shown the
first's issues — measured on `procgen_maze`, where the two states read 1 issue
and 0 issues at the same count of 1. ⛔ `validateRules` itself is untouched: this
changes WHEN it runs, never what it reports.

Measured on stardew (209 regions, 1,073 items): `_renderChrome` **2.2–4.0 ms →
0.3–0.7 ms**. See the correction under the Map tab for why that is milliseconds
and not the seconds a tab switch costs.

### The sidecar validity report (V0) — the bar's fourth validator

⚖ user, 2026-09-10: *"If the user changes a substrate, or makes some other
breaking change, then it's their responsibility to find a way to make the data
valid again before they save the JSON data. If we don't already have a way to
report what data is invalid, then I want to add one."* — and at the replan: the
raw save keeps ACCEPTING a changed `substrate`, and this report names the
mismatch.

Three validators existed and none looked inside `preset_sidecars`:
`validateRules` (the bar), `_schemaErrorsAddedBy` (the save veto — the payload is
opaque to the schema) and `canonicalPlacementIssues` (P1). So after a raw save
that changed `substrate`, or dropped a field the substrate needs, the document
passed the schema, the bar read *No issues*, and the failure surfaced at PLAY.
The fourth is **`sidecarIssues(doc, slot)`** (`sidecarIssues.js`), in P1's shape:
one pure function, three readers — **the bar** (its issues join `validateRules`'
list, counted and listed like the others, each row naming its region, and a
press on the row lands on that region), **the per-region block** (see *Sidecars,
per region* below) and **`scripts/procgen/check-sidecar-fields.mjs`** (its second
layer). None of them spells a check of its own.

Each issue is `{severity, region, field?, kind, message}`; `kind` is one of
`SIDECAR_ISSUE_KINDS`, and `SIDECAR_ISSUE_SEVERITY` / `SIDECAR_ISSUE_LAYER` say
how bad and which layer. Severity is `validateRules`' own definition: an
**error** is a dangling reference or a value the reader is declared not to
accept; a **warning** is suspicious-but-maybe-intentional state. Two layers:

| layer | the kinds | what it asks |
|---|---|---|
| **shape** — D0's declaration (`sidecarFieldsOf`, `sidecarPayloadErrors`) | `NOT_AN_ENTRY` · `NOT_PLAYABLE` · `BAD_DECLARATION` · `NO_DECLARATION` · `MISSING_REQUIRED` · `UNDECLARED_FIELD` · `INVALID_VALUE` · `SUBSTRATE_MISMATCH` | the `substrate` is registered and has `deserializeWorld`; every payload key is declared, every `required` one present, every value inside its descriptor. ⚠ `required` means *every producer of this substrate writes it* — not *a reader needs it* — so a missing one is a WARNING and its sentence says exactly that. **The mismatch:** when the payload fits ANOTHER declaring substrate strictly better than its own (`sidecarFit` — the Jaccard index of the payload's substrate-owned keys and a declaration's, the envelope left out on both sides because the engine writes it under every substrate; ties broken by the fewest fields the shape check names), the block says *"this payload has the keys of `Y`, not `X`"* and folds the per-field sentences into that one |
| **document** — the rest of the document | `DESERIALIZE_THROWS` · `NO_REGION` · `EXIT_UNKNOWN` · `EXIT_NOT_CARRIED` · `EXITS_UNCHECKED` · `LOCATION_UNKNOWN` · `LOCATION_NOT_CARRIED` · `LOCATIONS_UNCHECKED` · `GRID_CELL_DUPLICATE` · `GRID_CELL_OUTSIDE` · `REF_UNRESOLVED` | the payload deserializes through the entry's own `deserializeWorld`; every non-null `exits[].exitName` names an exit of the region (the prefixed `<region>__<exit>` spelling read through, `apExitNameCandidates`); `grid_cell` is unique in the slot and inside `procgen_metadata.grid_dims`; a field whose descriptor `references` a sibling resolves to one (jta's dataset ref). And, **DECLARED per substrate** on its registry entry (`apLocationNamesOf`, `apExitNamesOf` — see *substrate-registry.md*), the payload's AP location names and its complete exit list against the region's, both ways: a name the payload carries that the document lacks is an ERROR; a document endpoint the payload does not carry is a WARNING (a producer may drop one by name — the maze atlas projection's `exit_tile_collision`, which is in the committed corpus). A substrate that declares no carrier, or a payload whose reader finds none, is ONE warning per substrate per slot saying it was NOT CHECKED (`UNCHECKED_SIDECAR_KINDS`) — never a silent pass |

⛔ **Errors block nothing.** The raw save is not vetoed by any of this — the
reader owns the repair — and the schema veto is exactly as strict as it was.
⛔ **The Edit ▸ baseline is not run here** (`inspectRegionRoom` is ~90 ms a
region, async): the block already shows the door's own verdict for that.

**The memo.** The bar's list is memoised on the record's identity plus the slot
(R1's key), and the report has its OWN cache on the same key
(`_sidecarIssueCache`) because the block reads it without going through the bar —
two readers of one function, not a reader and a copy. ⛔ Never cleared on apply:
an Undo re-folds the record without passing through `_applyOp` (trap 1311).
Inside the function each ENTRY's issues are memoised on the entry object (with
its region object, name, slot and registry entry as the rest of the key): the
record is copy-on-write, so an op re-asks only the entries it touched. Measured
on `procgen_topdown/AP_8` (235 entries, the V0 record): `_renderChrome` after one
`set-region-sidecar` **3.3–6.5 ms** (before V0: 0.3–0.5 ms); a report on fresh
objects — the load's first render, and after the three rename ops, which
deep-clone the document — **42–64 ms**.

### The `editor` slot (H5)

`documentKeys.DOCUMENT_KEY_EDITORS` is a
`key → {label, returns, focusHubOnSave, note, open}` table naming, for each
top-level key that has a dedicated editor, how to open it. A filled row makes the Document row draw an **Open** button beside the raw
JSON — beside, not instead of: the block is still data, and the block editor is
still the way to fix a value the dedicated editor cannot express.

| key | editor | `returns` | `focusHubOnSave` | panel |
|---|---|---|---|---|
| `region_atlas` | the region marking tool | `op` | **`false`** (R1) | `regionMarkingTool` |
| `procgen_metadata` | the procgen pipeline | `document` | — | `procgenPipelinePanel` |
| `loop_costs` | the loops cost debugger | `op` | **`true`** | `loopsCostDebuggerPanel` |
| `sphere_log` | the spoiler checklist | `none` | — | `spoilerChecklistPanel` |
| `preset_sidecars` | a switch to the **Sidecars** tab, where the key is LISTED per region (D1, the replan's ruling 6; it is also DRAWN under each region on the Regions tab) | `none` | — | (no panel) |
| `helpers` (W0) | the helpers panel, as a **viewer** | `none` | — | `helpersPanel` |
| `dungeons` (W0) | the dungeons panel, as a **viewer** | `none` | — | `dungeonsPanel` |

⛓ **`focusHubOnSave` is declared by every `returns: 'op'` door and by no other**
— a door whose save cannot come back here has nothing to focus, and the `—` rows
above carry no field at all. A `documentKeys.test.js` row selects its population
by the `returns === 'op'` LAW rather than by the flag, so a door that DROPS the
declaration reds instead of filtering itself out of its own guard — and (S0) a
second row holds the other direction: no door whose `returns` is not `op`
carries the field. R1 had declared `preset_sidecars` `op` + `focusHubOnSave:
false`, *"false because unreachable"* — its `open` never touches `onSave`. S0
made the door `none`, which retires that paragraph for the very reason it gave.

The last two are ⚖ *"we could link to the existing dungeons and helpers panels
as viewers"* (user, 2026-09-08), on the same ruling that leaves both keys
**editable through raw JSON for now**: they read APPLIED state (the world the app
has loaded, not the working copy — press Apply first), nothing comes back, and
the row's own JSON block is how the key is changed. Both modules are enabled in
the default `modules.json`, so unlike `region_atlas` these doors are live in the
default mode — but the row still asks the component registry rather than
assuming it, which is what `panelId` is for.

Every schema key **without** a row here has no dedicated editor, and the registry
says so by *not having a row*, never by dropping the key from the tab: every
schema key still gets a Document row and a JSON block editor. ⛔ The population
is not a number written down here — it is
`buildDocumentKeys(schema).filter((e) => !e.editor)`, and W0 grew the table by
two.

**`open` does not return an op**, and H1's contract said it would. It cannot:
every editor here is a panel a person works in for a while, so a save comes back
through `onSave(op)` — the room-editor contract's shape, one level up. What the
Document row prints instead is **`returns`**, because *"if I save over there,
does it come back here as an undoable step?"* is the question a reader has:

- **`op`** — `onSave` fires with ONE op, applied through the panel's own
  `_acceptEditorOp` (schema veto, slot stamp, undo step); one Undo folds the
  whole sub-edit away. ⛔ **L4 measured that the veto was not on this path at
  all** — it lived in `_applySetKey`, which is the RAW JSON block editor's
  method, so an op arriving from a linked editor reached `applyRulesDocOp`,
  which reads no schema, untouched. `region_atlas`'s Save had been bypassing it
  since H5. `_acceptEditorOp` runs the same check the block editor runs now, and
  RETURNS `{accepted, applied, errors, description}` so the editor can print
  what happened instead of guessing from the hub's log.
  ⛓⛓ **R-a — and it refuses an op made for a document the hub no longer holds.**
  The hub stamps a monotonic `_documentToken` at `_openSession`, its ONE session
  boundary; `_openDocumentKeyEditor` reads it once and binds it into the `onSave`
  closure it hands the door. A door never sees the token, so no door can forget
  it — which is how both `op` doors gained the guard without being changed. The
  check is FAIL-CLOSED: a caller that omits the token hands `undefined`, which
  cannot equal a token `_openSession` has made. Hand a document to the cost
  debugger, load a different preset in the hub, press Send, and the answer is
  `{accepted: false}` carrying *"this plan was made for a document the editor has
  since replaced — load it again and Send again."*
  ⛓⛓ **S1 — and an ACCEPTED op brings the hub to the front and shows the row it
  wrote** (⚖ user, 2026-09-08: *"this automatically activated the APWorld Editor
  panel and scrolled to the relevant section, with a message that the data was
  successfully loaded"*). `_acceptEditorOp` publishes `ui:activatePanel` for its
  OWN panel (`APWORLD_EDITOR_PANEL_ID`, declared once in `index.js` and used by
  the registration, `moduleInfo.componentType` and this publish alike), selects
  the key's **home tab** — `ownedByTab ?? 'document'`, so `loop_costs` and
  `region_atlas` land on **Sidecars** and a key no tab owns lands on the
  everything-fallback — scrolls `[data-doc-key="<key>"]` into view and prints the
  success sentence BESIDE that row as well as in the chrome. ⛔ **A REFUSED op
  steals no focus** — every refusal returns through `_acceptEditorOp`'s own
  `refuse()` before the focus is reached, so the two outcomes never look alike
  on screen.
  ⛓⛓ **R1 — and whether it fires is the DOOR's declaration** (⚖ user,
  2026-09-09; S1 §8.6 (2) named the gap). The seam stays generic — one place
  every `op` door's save comes through — but S1 shipped the raise
  UNCONDITIONAL, which is a claim about every editor at once: `loop_costs`'
  Send ENDS the visit to the debugger, while the region marking tool is a
  workspace whose Save is a checkpoint, so raising the hub there takes the
  person's screen mid-task. `focusHubOnSave` (above) gates the
  raise / tab-select / scroll and is read FAIL-CLOSED — a door that omits it
  does not bounce. It does **not** gate the sentence: the beside-the-row
  message is recorded either way, so an unfocused save has its answer waiting
  where the key lives.
- **`document`** — that editor's exit is a NEW document (the arc's rule that
  generation is not an edit); nothing comes back here.
- **`none`** — that editor only READS the block. A `none` door does exactly ONE
  visible thing, and the viewer-door row in `documentKeys.test.js` holds it: it
  raises the panel its `panelId` names, or — declaring `panelId: null`, which
  only `preset_sidecars` does — it switches the hub's own tab (`goToTab`).

No door imports its panel at module load. `documentKeys.js` is loaded by node
rows and by both tabs, so every door defers its module with a dynamic `import()`
— the `bounceDemoLibrary` precedent — and a test row asserts the file's static
imports are exactly `['./rulesDocOps.js']`.

#### `region_atlas` — the block is a REFERENCE, not an atlas

Measured over the corpus: all three carriers (`seedling_atlas`,
`seedling_atlas_maze`, `seedling_playthrough`) hold exactly
`{atlas_id, game, map_document}`, and **nothing in the tree resolves an
`atlas_id` back to the file that holds it**. So the door cannot open the marking
tool on *this document's* atlas; it opens the tool on the atlas the tool holds,
and a Save writes the document's reference to whatever was saved, through the
compiler's own `regionAtlasCompiler.regionAtlasReference` — the same three
fields `compileRegionAtlas` writes, hoisted so the two spellings cannot drift.

#### `procgen_metadata` — the pipeline says what it can do

`procgenPipeline:loadRules {jsonData, source, player}` is a **second channel**
beside `stateManager:rawJsonDataLoaded` on purpose: that one means *"the app has
loaded this document"* (applied state), this one means *"here is a document
nobody has applied"*. Adoption therefore turns the pipeline's *"Use
currently-loaded rules.json"* checkbox **off**, so the next app-wide load cannot
silently replace the handed-over document.

The panel then prints one of three answers, each derived rather than typed:

- **append a sphere** — `procgenPipelineEngine.sphereRebuildRefusal` returns
  null, so `importSphereEnvelope` would reconstruct an append-ready envelope;
- **top-down from this** — it would not, but the document names regions for the
  slot, which is all `layoutTopDown` reads. The engine's refusal is **quoted**,
  not summarised: "zone world" is one of four reasons and the other three are
  not it;
- **nothing** — no regions for the slot, so neither driver has an input.

`sphereRebuildRefusal` shares its strings with `rebuildEnvelopeFromRulesJson`'s
throws (`SPHERE_REBUILD_REFUSALS`), so what the panel shows is the engine's own
sentence. An *unregistered* substrate returns `getAdapter`'s message verbatim
rather than being translated into "zone substrate": those are different problems.

⛓ **PRESET SIDECARS M1 — which slot, and what top-down costs.** Both of the
pipeline's routes build **one** slot, `HANDOFF_REALISED_SLOT` (`'1'`, exported
from `procgenPipelineUI.js`): top-down passes no slot to `layoutTopDown` and
`buildTopDownEnvelope` reads slot 1's starting items and item defs, and the
sphere import reaches `rebuildEnvelopeFromRulesJson` with none. So the answer
always describes THAT slot. The hand-off's `player` (the slot the hub had
selected) is now passed through `_adoptHandoffRules`, and when it is a different
slot the answer **names it first**, with its own region count, before saying
what the routes would build. With no slot carried, or the built slot, the
sentence is H5's. The top-down answer also names its **cost**
(`HANDOFF_TOPDOWN_COST`): `layoutTopDown` never reads a sidecar, so the payloads
handed over are regenerated. The sphere answer is unchanged. On the four-player
fixture, handed off from slot 3 (measured live, `drive-m1.mjs`):

| | the pipeline's answer |
|---|---|
| before M1 | *Adopted hand-off (the APWorld editor): TOP-DOWN FROM THIS (4 source regions). It cannot be appended to — rebuildEnvelopeFromRulesJson: not a sphere-growth rules.json* |
| M1 | *Adopted hand-off (the APWorld editor), sent from player 3 (6 source regions) — but both of this panel's routes build player slot 1 only, so this is about player 1: TOP-DOWN FROM THIS (4 source regions), which REGENERATES every sidecar payload from the regions block (new room geometry) — the payloads handed over are not kept. It cannot be appended to — rebuildEnvelopeFromRulesJson: not a sphere-growth rules.json* |

`procgen_topdown/AP_1` (sphere-appendable, slot 1) prints the same sentence as
before. Making the routes build the carried slot would be a pipeline feature,
not a fix to this sentence, so the sentence says which slot gets built instead.
The block's **Regenerate in the pipeline ▸** note says the same two things
(slot 1 only, payloads regenerated on the top-down route). `procgenPipelineUI.test.js`
holds the note to the pipeline's constants, because `documentKeys.js` imports no
panel.

#### `loop_costs` — a real working-copy intake

Plan §4 priced this link as its named fallback, *"Apply, then open"*, because the
cost debugger reads applied state. The measurement overturned it: `CostPlanner`
takes its state manager as a **constructor argument** and touches it through two
methods (`getStaticData()`, `getLatestStateSnapshot()`), so a rules.json can wear
that face. `loopsCostDebugger/documentStateManager.js` builds one by running the
same code the worker runs — `StateManager.loadFromJSON` + `getStaticGameData` —
on the main thread, from a dynamic import. Measured: 4.4 ms
(`procgen_maze/AP_1`), 21.3 ms (`jta_substrate_test`), 305.7 ms
(`stardew_valley`, the corpus's heaviest), plus a one-time ~117 ms import.

A working copy is planned against **its own** embedded `sphere_log` or not at
all: the app's log describes whatever world is applied, and borrowing it would
manufacture the debugger's existing *"ALL n sphere-log locations are not in this
player's world"* condition instead of reporting it. Its status line carries
`[working copy · <door> — n regions, m locations]`, and a **Use applied state**
button is the named way back.

**`returns` is `op` as of L4** (⚖ user, 2026-09-06: *"the debugger's plan comes
back as ONE op"*). `CostPlanner.getCostData()` is already exactly this block's
shape — the BLOCK, write-by-class applied, byte-identical to the one the procgen
pipeline embeds (`scripts/procgen/check-loop-costs-one-model.mjs`) — so the whole
write-back is a single `set-key loop_costs`, undoable here in one step. The door
passes `onSave` through the hand-off payload rather than holding it: the gesture
that fires it (the debugger's **Send costs to APWorld Editor**) happens long after
`open()` returned. The panel drops it the moment the working copy goes away.

⛓⛓ **S1 — the button says where the costs GO, and the app then goes there.** It
read *"Send costs to the document"* until S1; ⚖ (user, 2026-09-08) *"Maybe it
would be clearer if the button said 'Send costs to APWorld Editor', and this
automatically activated the APWorld Editor panel and scrolled to the relevant
section, with a message that the data was successfully loaded."* The label is the
debugger's only change — the raise, the tab selection, the scroll and the
beside-the-row message are the HUB's, in `_acceptEditorOp`, and therefore belong
to every `op` door rather than to this one. Measured end to end on
`jta_schedule_test` (which carries `loop_costs` and its own embedded
`sphere_log`): press the door from the Sidecars tab, Load, Plan All, Send — the
APWorld editor is the active panel, the Sidecars tab is selected, the
`loop_costs` row is in the viewport carrying the message, the op list grew by ONE
`set-key loop_costs`, and one Undo takes the block back out.

A block written into a document carries `generatedFrom: "the APWorld editor"` —
the hand-off's own source label, not the `"loopsCostDebugger"` the planner stamps
for the store and not a file path this unsaved document does not have.

⚠ **The Document row states the switch, and it is not a cost fact:** a
`loop_costs` block's PRESENCE is what enables loop mode for a world.
`loops/index.js handleRulesLoaded` auto-enables when `costDataManager.isLoaded()`
— `this.costData !== null` — with a symmetric auto-exit when a freshly loaded
preset carries none. So sending costs to a document that had no block turns loop
mode ON for it, and all twelve committed carriers already boot in loop mode from
an EMPTY block.

⛓⛓ **R-a — and the switch is an ACTION now, not only a sentence** (⚖ user,
2026-09-06; L4 named it as the smallest next thing this door could gain). The
`loop_costs` row carries one button: **Enable loop mode** on a document with no
block, **Disable loop mode** on one that has it. Both are a single
`set-key loop_costs` through `_applySetKey` — so both get the schema veto, the
status line and the undo step every other Document-tab edit gets. Enabling writes
the four keys the schema requires and nothing hand-typed (`regions: {}`,
`locations: {}`, and `DEFAULT_REGION_COST` / `DEFAULT_LOCATION_COST` from
`shared/procgen/loopCostDefaults.js`); disabling passes `undefined` as the value,
which `opSetKey` routes to `setPath`'s delete arm and describes as
*"loop_costs deleted"*. ⛔ **Undo tells "no key at all" and "an empty block"
apart**, because it re-folds over a shorter op list rather than reversing a
gesture. ⚠ The Apply consequence is in the button's TITLE, not in a gate:
applying a document that has just gained a block turns loop mode on for the world
at runtime, and that is the ruled semantics.

⛓ **THE `loop_costs` SCHEMA WAS TYPE-ONLY UNTIL R-a, AND IS NOW AS TIGHT AS THE
CORPUS ALLOWS.** Measured at L4 over the real schema and the real documents, the
veto refused a location cost that was not a number, a region entry that was not
an object, a string `moveCost` and a non-object block — and ACCEPTED every
semantic error the write-by-class rule is about. R-a took four of those
(⚖ user, 2026-09-06): the block now `required`s the four keys every block on
disk carries (`regions`, `locations`, `defaultRegionCost`, `defaultLocationCost`
— NOT `version`/`generatedAt`/`defaultRegionXpEffect`, which the twelve tracked
blocks do not carry), declares an `enum` on `xpEffect` and
`defaultRegionXpEffect` pinned to `VALID_REGION_XP_EFFECTS` by a vitest row, and
is `additionalProperties: false` at the root and on a region entry. So
`xpEffect: "banana"`, a misspelt root key, a stray key on an entry, and `{}` are
all refused by path now.

⛔ **What the schema still cannot say, and deliberately does not:** `moveCost`
and `timeDrainPerSecond` stay declared SIBLINGS on a region entry. A coarse entry
carries the first, a summary entry the second, and a summary entry whose input
block states a `moveCost` explicitly carries BOTH — "exactly one" is
write-by-class's rule, not a shape. Nor can a schema see that a NATIVE region has
an entry it should not. The standing proof that the block is RIGHT is still
`check-loop-costs-one-model.mjs` and `loopCostGenerator.test.js`; the schema's
job is to refuse a block that is not one.

## The Sidecars tab (S1)

⚖ *"a 'Sidecars' tab, for the data that's specifically in the sidecars. Currently
that means the loop cost data and the procgen data"* (user, 2026-09-08), and then
*"Let's put region_atlas, flash_panel, and provenance in the sidecars tab for
now."* It sits between **Map** and **Document**: its five keys are all about the
world the procgen side produced — the same subject as Map — and the Document tab
is the everything-fallback, so it reads last of the per-subject tabs.

**The membership is a table with a NAMED AUTHORITY**
(`documentKeys.KEYS_OWNED_BY_TAB.sidecars`), not a derivation, because nothing in
`rules.schema.json` says "this key is a sidecar". The two halves have two
different authorities:

| key | authority |
|---|---|
| `procgen_metadata` | the worldgen round trip: `world_generator/generator.py` writes `_worldgen_procgen_metadata.json`, `exporter/games/base/handler.py`'s `_inject_worldgen_procgen_metadata` merges it back |
| `loop_costs` | the same round trip, through `_worldgen_loop_costs.json` / `_inject_worldgen_loop_costs` |
| `region_atlas` | ⚖ user, 2026-09-08 — **"for now"**; it is the atlas compiler's output, not worldgen's |
| `flash_panel` | ⚖ user, 2026-09-08 — for now |
| `provenance` | ⚖ user, 2026-09-08 — for now |

⛔ **The first half is CHECKED against that authority**, in `documentKeys.test.js`:
the row reads the three `_inject_worldgen_*` methods out of `handler.py`, derives
the top-level keys they merge into, and asserts each one is either owned by this
tab or is `preset_sidecars`. A fourth sidecar added to the Python round trip reds
that row until this tab hosts it. The ⚖ half has no derivation — a ruling is the
authority — so it is written down as a row that names the date.

**`preset_sidecars` is not one of the five ROWS.** It is a per-REGION key, so it
is drawn per region — S0's expandable list for the selected slot, above the rows
(see *`preset_sidecars`, per region*, next). Its collapsed line is the per-slot
summary it always was — region counts derived per slot rather than summed,
because every populated `preset_sidecars` in the corpus keys under slot `"1"`
except the four-player fixture's. The old **Go to Regions** button is gone: it
pointed at a tab that, until S0, drew none of this key's data.

**One renderer, two hosts.** Every row on this tab is built by the same
`_renderDocumentRow` the Document tab uses: the door button, the `returns` line
and its note, the per-region loop-cost table, W0's JSON block. The tab FILTERS the
registry rows (`documentKeyRows`, in the schema's own order) — it does not build a
second row, because two renderers for one key are two vocabularies for one
document.

⛓ **R1 — and the renderer knows WHICH host is drawing it.** ⚖ user, 2026-09-09:
*"The sidecar entries in the sidecars tab have the 'Go to Sidecars' button. Is
there a simple way to fix that?"* `_renderDocumentRow(row, hostTab)` takes the
drawing tab's id and skips the *"Edited in the … tab"* pointer when it names that
same tab, so these five rows carry no pointer here and the Document tab's rows for
the same five are unmoved. The two ids are `SIDECARS_TAB_ID` / `DOCUMENT_TAB_ID`
in `documentKeys.js` — the Sidecars one is the very key `KEYS_OWNED_BY_TAB` files
its list under, so the host id and the ownership table cannot drift apart. ⛔ The
host is a PARAMETER rather than `this.activeTab`: a row renderer that read the
panel's mode would make its content depend on something no caller declared. An
unnamed host (the default) draws every pointer — the pre-R1 behaviour, on the
footing that a redundant pointer is a smaller defect than a key whose home tab a
reader cannot find.

**Which doors are the working copy, and which are not.** Three of the five carry a
door and all three open on the WORKING COPY — `loop_costs` (the loops cost
debugger, `returns: op`), `region_atlas` (the region marking tool, `returns: op`,
disabled in the default mode) and `procgen_metadata` (the procgen pipeline,
`returns: document` — its exit is a NEW document, so nothing comes back).
`flash_panel` and `provenance` have no dedicated editor at all: the JSON block on
the row is how they are changed. The tab's intro line says which is which, derived
from the rows rather than typed. ⚠ The APPLIED-state doors (`sphere_log`,
`helpers`, `dungeons`) are on the **Document** tab, not here.

Making a key a Sidecars key also changes its **Document** row: it now shows the
*"Edited in the Sidecars tab"* pointer and its JSON block (W0's rule — the pointer
AND the block). The **Links** tab is derived from `DOCUMENT_KEY_EDITORS` and is
unaffected; measured before/after on `jta_schedule_test`, its 13 rows are the same
13 rows.

### `preset_sidecars`, per region (S0)

⚖ user, 2026-09-09: *"the preset_sidecars entry of the sidecars panel has a button
to Go to Regions, but the preset_sidecars isn't in the Regions tab … We should at
least have a way to view or edit the raw json."* ⚖ 2026-09-10, Q2 A: *"one
renderer, two hosts … but I want the region list in the sidecars tab to be
expandable, and collapsed by default."*

**One function draws a region's entry** — `_makeRegionSidecarBlock(player,
region, {hostTab})` — and three tabs call it (the Map since M1):

| host | where |
|---|---|
| **Regions** | under each region's header, for every region that HAS an entry. A classic AP region draws nothing (H4b's *"absent is an answer"*). |
| **Sidecars** | the `preset_sidecars` list: **collapsed by default**; expanded, one row per entry of the SELECTED slot, in the document's order — the region's name, the same block, and **Go to region**, which selects the Regions tab and that region and scrolls its header into view (`selectRegion`, the same focus helper the Map tab's Go to region and the bounce editor's reverse link use). |
| **Map** | (M1) under the canvas, for the map's SELECTED region only (`hostTab: 'map'`): its name, **Go to region** (the same `selectRegion`), (M2) **Move / swap ▸**, which arms the map for a move or a swap, and the same block. A second click on the selected cell presses this block's Edit ▸ — see *The Map tab* below. |

What the block draws, all of it read off the ENTRY (`sidecarEntryFacts`, in
`regionRoundTrip.js`) and none of it off a table keyed by substrate name:

- a **badge** — `entry.substrate`, what the play-time host loads the room with.
  ⛔ Never `render_hint`: on every committed entry that carries one it equals the
  substrate, and the Seedling entries carry none, so the badge follows the field
  the player actually reads;
- the **facts** — the grid cell, the render hint *only when it differs* from the
  substrate, the biome (`name`, else `id`), and the payload's top-level keys with
  its pretty UTF-8 size at the widget's indent (`JSON_BLOCK_INDENT`);
- the two roads (plan §9.2: an edit that REWRITES IN PLACE is the hub's, one that
  REGENERATES is the pipeline's) — **Edit ▸**, H4b's door, built by the same
  `_makeRoomEditorButton` (it moved from the header INTO the block, so it is
  still drawn once per region), and **Regenerate in the pipeline ▸**, which is
  the `procgen_metadata` door's own `open` pressed through the one opener, with
  the cost in its title: the pipeline builds player slot 1 only (M1) and
  regenerates the payloads on its top-down route
  (`DOCUMENT_KEY_EDITORS.procgen_metadata.regionDoor`);
- (S2) **Re-derive rules ▸**, beside Edit ▸ — the region's access rules
  re-derived from its payload after a raw save; enabled only where the substrate
  declares a round trip. See *Re-derive rules ▸ (S2)* below;
- **▸ Show fields & JSON** — the WHOLE entry, through `_makeJsonBlock`, the
  widget the Document rows use, with (D1) the entry's **fields view** drawn
  above the textarea — see *The fields view (D1)* below. Both are built on
  expand (W0's rule) and read from the document at every render, so after an op
  the open block shows the entry the document holds now. Since S1 the JSON is
  editable, with **Save JSON** — see below;
- (V0) **the entry's issues**, under the facts — one sentence each from
  `sidecarIssues` (see *The sidecar validity report* above), coloured by
  severity, and NOTHING when the entry is clean. On the Sidecars list, each
  region's row also shows a count badge beside its name when it has any.

The disclosures are per session: which blocks' JSON is open (keyed by host, slot
and region, so each host's is its own) and whether the list is expanded both
survive a re-render and are dropped when a new document opens.

#### Saving an entry (S1)

⚖ user, 2026-09-10, Q1 C: *a raw save writes the entry alone; re-deriving rules
from a payload is a separate button* (S2 built it — *Re-derive rules ▸* below).
Q3 A: *the block edits the whole entry.*

The block's **Save JSON** parses the textarea (unparseable text is refused by
name and never becomes an op) and records **one** op:

```js
{ op: 'set-region-sidecar', player, region, entry }
```

**What it writes:** `preset_sidecars[player][region] = entry` — the whole entry
(`substrate`, `render_hint`, `grid_cell`, `biome`, `grow_telemetry`,
`playable_payload`), in the same position among the slot's entries. A field
the typed entry leaves out is gone afterwards: it is a replace, not a merge.

**What it does NOT write:** the region's access rules, its locations and their
names, anything in `regions`, another slot's sidecars — and nothing inside the
payload that the substrate DERIVES from the rest (a maze's
`longestShortestPath`, baked location names). The op's description says so every
time: *"region X: sidecar entry replaced (N payload keys) — access rules,
location names and derived payload fields NOT re-derived"* (the clause is
`rulesDocOps.SIDECAR_NOT_REDERIVED`). It is printed in the status line and under
the block that was saved.

**What refuses it**, in this order:

1. **the op itself** (`rulesDocOps.js`), asked of a preview first: no region
   name; no entry for that region in this slot; an entry that is not an object;
   a missing or non-string `substrate`; a `playable_payload` that is present and
   not an object. ⛔ The payload's *inside* is never read — it is opaque to the
   schema and belongs to the substrate, and a breaking edit is the reader's to
   repair (⚖ round two, Q2). Reporting what no longer fits is the validity
   report's job (V0, below);
2. **the schema veto** — the same function the Document tab's whole-key Save runs
   (`_rawSaveRefusal`: `_schemaErrorsAddedBy`, then P1's placement check), so a
   `grid_cell` without `gy` or a `biome` that is not an object is refused by
   path, and only for what this save ADDS. On `procgen_topdown/AP_8`, the largest
   document (934,463 compact bytes), the veto costs about 31 ms per save (the S1
   record has the measurement).

⛓ **What no longer fits is REPORTED, never refused** (V0). The validity report is
not a third gate: a save whose entry it finds wrong still lands, the block lists
the sentences, and the save's answer gains a trailing count — *"… NOT
re-derived — 2 sidecar issues, see the block"*. A changed `substrate` is accepted
the same way (⚖ the replan), and the block's `SUBSTRATE_MISMATCH` sentence names
the substrate whose keys the payload actually has.

⛔ **It replaces an entry; it never creates one.** A region with no sidecar entry
has no room, and this op keeps it roomless — refused by name with the slot's
entries listed. Whether a CREATE op is wanted at all is an open ⚖ (preset-sidecars
plan §12).

**Every host saves, through one function.** The block is editable because its
HOST passes `onSave` — Regions, the Sidecars list and (M1) the Map all do (⚖ Q2 A:
one renderer), and all three land in `_saveRegionSidecar`, so they record the
same op for the same edit. A host that passes nothing gets the widget's read-only
default (no Save), so a future host cannot make the entry writable by accident.

**Edit ▸ afterwards.** The region's Edit ▸ verdict is re-asked: a remembered
refusal counts only for the document it was asked about (see *Edit ▸* below),
and the save made a new one. Pressed after a raw edit, the door runs its baseline
on the NEW payload — and if the substrate's round trip no longer reproduces it
byte for byte, the door is refused with the baseline sentence (*"opening and
saving … UNCHANGED would already rewrite its sidecar payload …"*). That is the
honest outcome: the room editor would otherwise rewrite the region behind you.
⚠ It is not true of every hand edit: most single-tile flips of the four-player
fixture's maze rooms still round-trip, and on those the door opens on the edited
room (the per-room counts, and the probe that produced them, are in the S1
record, preset-sidecars plan §12). ⛓ **To bring the rules into line with a raw
edit, press Re-derive rules ▸** (S2, below) — and after it the payload is the
serializer's own form, so the door's baseline passes again.

⛔ **What drawing them costs is badges, not JSON.** Measured live on the two
largest sidecar slots (the numbers are in the S0 record, preset-sidecars plan
§11): the Regions tab of `procgen_topdown/AP_8` draws a block for every entry and
not one sidecar textarea, and the Sidecars list of `seedling_playthrough/AP_1`
expands into one row per entry without building a single JSON block.

#### The fields view (D1)

⚖ user, 2026-09-10, Q3: the block edits the whole entry, and *"I also want to
check if it would make sense for the substrates to have a way to declare what the
valid options are for that substrate, and have the editor load that as the set of
options to choose from."* D0 made that declaration (`sidecarFields` on the
registry entry, read through `sidecarFieldsOf` — see
[`substrate-registry.md`](../developer/procgen/substrate-registry.md)); the block
now reads it.

Opening a block (**▸ Show fields & JSON** — one disclosure: a second toggle per
block measured +2.3 ms over `procgen_topdown/AP_8`'s 235 blocks, and the
collapsed block must cost what S0 measured) draws, above the JSON, one row per
field, in two lists — every row from `sidecarForm.sidecarFormModel`, none from a
table here:

| list | where the rows come from |
|---|---|
| **the entry** | the schema's entry subschema (`rules.schema.json`, reached through `preset_sidecars`' own `$ref`), every property but `playable_payload`, in the schema's order; its `required` array marks the required ones. **`substrate`'s** vocabulary is the REGISTRY's: every registered id whose entry declares `deserializeWorld`, sorted — what the play-time host can load a room with. |
| **the payload** | the substrate's merged declaration (`sidecarFieldsOf(registry.get(entry.substrate))` — its own fields and the engine's envelope), in the merge's order. ⛔ Never the payload's keys: a declared field the entry lacks is still a row, drawn absent (`—`); a key the declaration does not name is the validity report's `UNDECLARED_FIELD`, not a row. A substrate that declares nothing (or is not registered here, or declares badly) gets one sentence saying so, and its payload is in the JSON. |

Each row: the name (titled with the description), a **required** mark, a
**derived** badge whose title is the descriptor's description — which, for a
derived field, names its WRITER (D0 refuses a declaration that does not) — and
the control its TYPE picks:

| type | control |
|---|---|
| `boolean` | checkbox (an absent one is indeterminate; pressing it creates the field as `true`) |
| `string` / `number` / `integer` with an `enum` | a select over the enum (an absent field's first option says so; a value outside the enum is shown as the selected, disabled first option) |
| `string` | text input |
| `number` / `integer` | number input — text that is not a number is refused by name and never becomes an op; an integer field given `1.5` is written and REPORTED (V0), not refused |
| `object` / `array` | a read-only summary — `{n keys}` / `[n items]` — *"edit in JSON below"*; no nested form |
| `null`, or a value whose JSON type is not the declared one | the value, read-only (*"not a boolean; fix it in the JSON below"*) |

**A derived field's control is DISABLED** — greyed, with its writer in the
title. A person changing it here would be changing a value the substrate
computes. **The JSON below stays fully editable**: the ⚖ lets the reader edit
anything there, and the line above the form says so — the form is the safe path,
the JSON the escape hatch.

**Every change is ONE op.** A control's change builds the WHOLE entry with that
one value replaced (`withSidecarField` over a copy of the entry the document holds
AT THE MOMENT of the change — never a copy captured when the form was drawn) and
goes through the host's save: the same `_saveRegionSidecar` Save JSON reaches, so
the same op preview, the same schema veto, ONE `set-region-sidecar`, one undo, and
the same answer under the block (the op's sentence, plus V0's count when the entry
now has issues). ⛔ No debounce: two changes are two ops. A change equal to the
stored value records nothing — the session's own equality answers *"No change"*.

**The `substrate` picker** changes the entry's `substrate` and nothing else —
the payload is not touched, and the raw save accepts it (⚖ the replan). Its title
says so: *"changes the label only — regenerate in the pipeline to rebuild the
payload"* (`sidecarForm.SUBSTRATE_PICKER_CLAUSE`), beside the block's
**Regenerate in the pipeline ▸**. The block's issue list then carries V0's
`SUBSTRATE_MISMATCH` sentence naming the substrate whose keys the payload
actually has; one Undo takes both away.

**What a raw save re-derives, by name.** Under the JSON, while the block is open,
one sentence names THIS entry's derived fields — the declaration's `derived: true`
descriptors the entry carries (`rederivesNothingSentence`), e.g. on a maze room
*"A raw save re-derives nothing: `exits`, `obstacleLib`, `itemLib`,
`longestShortestPath` stay as written — each is computed by the writer its greyed
row names."* Where the declaration marks none, or there is no declaration, the
sentence says that instead. The op's own description keeps S1's generic clause
(`SIDECAR_NOT_REDERIVED`). ⚠ Only TOP-LEVEL fields can be named: a field derived
INSIDE an authored one (the maze's `items[].locationName`) is described in that
field's description, not declared as its own descriptor.

#### Re-derive rules ▸ (S2)

⚖ user, 2026-09-10, Q1 C: a raw save writes the entry alone, and a SEPARATE
button re-derives — *"but we can disable the buttons for substrates where that
feature is currently unavailable."*

**What it re-derives.** The region's **access rules**, from the payload the
document holds NOW, through the substrate's declared round trip — the derivation
half of Edit ▸'s machinery (`regionRoundTrip.deriveRegionRules`: open the payload,
save it unedited, map the compiled endpoints onto the document's names). It is
recorded as ONE `replace-region-sidecar` (the op Edit ▸'s save records), so one
Undo takes it away and leaves the raw edit standing.

**Which rules move — the pre-edit baseline, recovered from the RECORD.** Edit ▸
moves a rule only where the round trip of the payload REPRODUCES the document's
rule; that is how it proves it authored the rule. After a raw save the payload is
already the edited one, so the same check against it would freeze exactly the
rules the button exists to move. So the baseline is the payload **before the raw
edit**, recovered from this session's record (`regionRederive.priorRegionState`):
the base document the session was opened on (kept by the panel as
`_sessionBase`), folded forward op by op (`editCore.foldEdits` — the fold undo
is), up to the most recent op that MOVED this region's payload. ⛓ "Moved" is read
off the states, not off an op name: the block's Save JSON (`set-region-sidecar`)
and the Document tab's whole-slot save (`set-key`) are both raw edits, and a
re-derive that writes the payload back byte for byte moved nothing. Per endpoint,
by the document's own name:

| the rule the document holds | what happens |
|---|---|
| the CURRENT payload already derives it (`sameRule`) | **agrees** — left exactly as written (never re-spelled: a Python-exported `HasAll` stays `HasAll`) |
| the PRE-EDIT payload derived it | **moves** to what the current payload derives — the room wrote it, so the room's new answer replaces it |
| neither | **frozen**, left as it is, NAMED and COUNTED in the answer — a gate the grid composed (`procgen_maze/AP_2`'s `region_3_3` → `region_2_3` is `And(Has key_red, Has key_green)` and derives as `True_`), a rule written by hand after the raw edit, or one outside `sameRule`'s comparable fragment |

**The payload it writes** is the serializer's form of the current one. Where that
differs from what was saved, the answer says so, naming the top-level fields the
serializer rewrote and the size before and after at the block's indent — on a maze
room a wall that cuts an exit off rewrites `longestShortestPath`. Otherwise the
answer says the payload was kept byte for byte. After a re-derive the payload is
therefore the serializer's own form and every movable rule is the room's, so
**Edit ▸'s baseline passes again** and the door opens.

**With no pre-edit payload in the record** — the document arrived already
hand-edited, or the raw edit was undone — nothing can be proven the room's, so
**nothing moves**: the op carries the payload in its serializer's form and every
rule as written, and the answer says there was no earlier payload and points at
Edit ▸ (open the room there and save: that door re-derives from what you do in
the room). The same happens if the session's history does not end at the document
in hand, or the pre-edit payload cannot be derived; the answer names which.

**Refused by name, nothing recorded:** a payload that now has an exit or location
the document does not name (a filled document needs an AP id and a pool entry for
it — the Regions tab's job), and one that LOST one the document names (the op's
own totality refusal, asked of a preview so it is printed, not alerted). A press
whose answer arrives after the document changed is discarded, and says so.

**Enabled exactly where the substrate declares a `regionRoundTrip` with
`open`/`save`** (`regionRoundTripOf` — the registry lookup Edit ▸ already makes;
no world is deserialized per render). Elsewhere it is **disabled** and its title
is that lookup's own sentence: a `refused` declaration's words (Seedling), or
*"the X substrate declares no `regionRoundTrip` …"* (jta, omsi, runner,
text_adventure today). ⛔ It needs no room editor — only the round trip. The work
(two round trips, ~90 ms a maze region) runs on the PRESS; the answer is printed
under the block and in the status line, and the re-render re-asks the issue list
and the Edit ▸ verdict.

## The Items tab's Groups section (I1)

⚖ *"I'll want to add proper editors for item_groups and progression_mapping, so
that we can support these features in procgen worlds, even though no procgen
worlds currently use them. These belong in the Items tab."* and, on deleting a
group an item still carries, *"Let's go with refuse."* (user, 2026-09-09).

### The law: the registry is a NAME LIST, and membership lives on the items

`item_groups[player]` is a **list of group names**. Which items are in a group is
the `groups` field on each item — and that is not a convention, it is what the
engine reads: `shared/snapshotInterface.js:631-661` takes the array branch when
the slot's value is an array and counts `HasGroup` / `group_count` /
`group_check` by walking each item's own `groups`. (The other branch,
`{group: [items]}`, is the object form; no committed document uses it.)

**The two are not derivable from each other, and this editor does not reconcile
them.** Measured over the 212 committed documents (all 224 slots hold an array):

| | slots |
|---|---|
| registry **equals** the union of the items' groups | 69 |
| items carry a name the registry **lacks** | 155 (`Event` in 154 of them) |
| registry lists a name **no item** carries | 0 |

So an *unlisted* group — on the items, absent from the registry — is the common
divergence and it is **shown**, greyed, with the one gesture that fits: *Add to
registry*. A registry entry with no members is legal too (it is what **+ Add
group** produces on the way to populating it), and the section says `0 items`
rather than tidying it away.

⚠ Nothing in this tree reads the registry's **contents** today.
`world_generator/extractors.py:397` extracts it into `WorldData.item_groups` and
no template consumes it — the generated world's `item_name_groups` is built from
the items' own `groups` — and the engine reads the slot's value only to pick the
array branch. The registry is the world's declared vocabulary, which is exactly
what an editor is for.

### The three ops

| op | what it does |
|---|---|
| `add-item-group {player, name}` | appends a name; refuses an empty one and a duplicate; **creates the block** when the document has none. It is also the *Add to registry* gesture for an unlisted group |
| `rename-item-group {player, name, newName}` | renames the registry entry **in place** AND every item's membership — **one op**, so one undo puts both back |
| `delete-item-group {player, name}` | **refused by name while any item still carries the group**, listing the carriers |

The delete refusal is the ⚖ ruling. There is deliberately **no
`deleteItemOps`-shaped cascade builder** beside it: a group is a classification a
person put on items on purpose, and stripping it from a hundred of them because a
registry row was deleted is not a gesture anyone asked for. The refusal lists the
carriers (bounded by `REFUSAL_NAME_LIMIT` — `sc2` slot 1 holds 1,741 items under
an 889-name registry) so the next click is obvious.

`itemsCarryingGroup(doc, name, player)` is the **one predicate**: the op's
refusal, the section's per-name count and the disabled button's `title` all read
it, so a name the section says nothing carries is exactly a name the op will
delete. (P1's shape for `canonicalPlacementIssues`, one key over.)

⚠ **Deleting a registry entry does not ask about rule trees.** Measured over the
corpus: 32 slots carry `HasGroup` / `group_count` / `group_check` nodes (566 nodes
in all) naming 81 distinct groups, and 3 of those references already name a group
that is in neither the registry nor on any item — a dangling group reference is a
state the committed corpus is already in. The ⚖ ruling is about the **items**;
whether the refusal should also read the rules is an open question.

### The section, and the per-item picker

The tab opens with the registry: one row per name, the derived count of items
carrying it, an inline rename that commits on `change` (the Meta tab's rule — one
rename, one op, one undo; Enter blurs into the same commit), and a delete button
**disabled with the reason in its `title`** while items carry the group. The
button is a courtesy — the guard is the op's refusal, which holds for a caller
that never drew a button (the Document tab's whole-block `set-key` is one, and it
stays: W0's pointer-AND-block rule).

The per-item **Groups** cell was a comma-separated text input until I1, in which a
typo silently created an unlisted group. It is now the item's groups as **chips**
(each removable, an unlisted one marked in the unlisted colour) plus a picker over
the registry names the item does not yet carry. Every gesture is still ONE
`set-item-field groups`.

**The picker fills on open, and that is measured on both builds.** The corpus's
worst case is `sc2` slot 1 — 1,741 items under an 889-name registry — driven on
the same page with `fill()` called at construction and then reverted:

| `sc2` slot 1 | eager | lazy (shipped) |
|---|---|---|
| option elements on the tab | **1,540,414** | **1,741** |
| Items-tab paint | **16,688 ms** | **1,948 ms** |
| opening one picker | — (already built) | **7 ms**, 877 options |

8.6× on the paint, 885× on the elements. ⛑ The element count is **not** the naive
`1,741 × (889 + 1) = 1,549,490`: a picker offers only the names its own item does
not already carry, so the eager total is `Σᵢ (1 + |registry \ groupsᵢ|)`, which
reproduces 1,540,414 exactly (and 3,498 on alttp). Quoting the product instead of
the measurement is trap 1300, from W3's Placements select.

### The Document row

`item_groups` is now `KEYS_OWNED_BY_TAB.items`, so its Document row shows the
*"Edited in the Items tab"* pointer **and** its JSON block — W0's rule, and the
same second-vocabulary situation the Meta scalars and `canonical_placements` are
in. The whole-block `set-key` is still the everything-fallback.

## The Items tab's Progression section (I2)

⚖ The same ruling as the Groups section above — *"proper editors for
`item_groups` and `progression_mapping` … These belong in the Items tab."*
(user, 2026-09-09).

### The law: two kinds, two readers, and the key is NOT generally virtual

`progression_mapping[p]` is `name → mapping`. There are two kinds in the
committed corpus and **they are consumed by two different parts of the app**:

| kind | shape | who reads it |
|---|---|---|
| **progressive** | `{base_item, items: [{name, level, provides?}]}` | the rule engine — `shared/gameLogic/generic/genericLogic.js`, `has` and `count` |
| **additive** | `{type: 'additive', base_item, items: {itemName: value}}` | the inventory — `stateManager/core/inventoryManager.js` |

**The additive kind's key is a virtual counter.** `_addItemToInventory` skips a
direct add of the key, and when any component item is added it accumulates
`mapping.items[component] * count` into `inventory[key]`. The Messenger's
`Shards` is the corpus's one entry and is not an item of the slot.

**The progressive kind's key is a real item the player receives.**
`_addItemToInventory` deliberately does *not* skip it. `genericLogic.has(x)`
finds `x` among some entry's `items[].name`, takes that member's `level`, sums
`inventory[k]` over **every** entry `k` whose `base_item` equals this one's, and
answers `total >= level`.

⇒ **"the key is a virtual name that must not collide with a real item" is
backwards.** Measured over the 212 committed documents: **135 of the 137**
entries have a key that *is* an item of the same slot, by design. A refusal on
that collision would refuse 98.5 % of the corpus.

**`base_item` is a POOL LABEL, not an item reference.** `genericLogic` only ever
compares one entry's `base_item` with another's. Measured: it equals the entry's
own key in **127** of 137 and is a KEY OF THE SAME SLOT'S MAPPING in all
**137**, while it names an item in only 135. The ten that differ are ALTTP's
`Progressive Bow (Alt)` → `Progressive Bow`, which is what the field is for: two
receivable items pooling into one level count. So the section's base picker
offers **the slot's mapping names**, and a `base_item` that names no mapping is
drawn amber rather than silently re-pointed.

**A member name need not be an item either.** 12 members over SMZ3's four
entries name resolved forms the slot's `items` does not hold — `has` resolves
them *through* the mapping, so they are names rules ask for rather than items
anyone receives.

**`provides` is a third, schema-declared member field** (`rules.schema.json`,
`$defs.progressiveItemLevel`) carried by 13 members, all SMZ3's. Nothing in the
frontend reads it today. The section draws it read-only and the op carries it
through, because an editor that writes the whole entry is exactly the thing that
can drop a field it does not know about.

### The op

`set-progression-mapping {player, name, mapping}` — **one op per entry, carrying
the whole entry**; an absent `mapping` deletes it. The card is the unit of undo:
a level typed, a member added or removed, the order changed, the kind switched
and the base retargeted are each one op, and one Undo puts the whole card back.

Its validation is in two halves with two different laws, because they have two
different populations:

- **The SHAPE is refused outright, by kind** — a `base_item` string, a non-empty
  container, `{name, level}` members with integer levels ≥ 1 and no duplicate
  name, integer additive values, and no `type` other than `'additive'` (the
  literal the inventory branches on). **0** committed entries fail any of these.
- **A NAME the slot cannot resolve is DIFFERENCED** — the op previews itself,
  asks `progressionMappingIssues` about both documents and refuses only what the
  write would ADD. An absolute refusal would make SMZ3's four entries the four
  nobody can edit, *including to take the stale member out* — the "silently
  dropped" outcome one key over (W3, P1).

**A delete is not validated**, for `set-canonical-placement`'s reason plus one of
its own: removing the head of a pool (ALTTP's `Progressive Bow`, which
`Progressive Bow (Alt)` names as its base) dangles a *different* entry's base, so
a differenced refusal would make exactly the entries that pool the ones nobody
can remove.

The shared predicate `progressionMappingIssues(doc, player)` reports two reasons
— `unknown item` and `base item is not a mapping in this slot` — and the op's
refusal, the section's marks and the in-app rows all read it, so a row the
section marks stale is exactly a name the op will not add.

**Control over the corpus:** 212 documents, 137 entries, each written back
through the op unchanged — 0 refused, 0 bytes moved, 12 issues reported (all
SMZ3's `unknown item`), 0 `base item is not a mapping in this slot`.

### The section

One card per mapping, drawn in the document's own key order: the name, a **kind**
select, a **base** picker over the slot's mapping names, a delete; then one row
per member — an item picker, the stale mark when there is one, a `level` (or an
additive `value`) box committing on `change`, the read-only `provides` note, ↑/↓
for the progressive kind, and a remove. An "add mapping" row takes a name and a
kind; an "add member" picker sits at the foot of each card.

**Reordering swaps array positions and leaves each level with its own number.**
The runtime resolves a member by name and reads that member's own `level`, so
the array's order is presentation — renumbering on a move would silently change
what the rules resolve.

**A kind switch converts and says what it cannot carry.** An additive member is
`name: number` and holds nothing else, so a progressive → additive switch that
would drop `provides` asks first rather than losing it.

The item pickers fill on `focus`/`mousedown` — I1's measurement one key over —
and omit names the entry already holds. That omission is a **courtesy**; the op
is the guard (trap 1305: a disabled control and the op's refusal are two guards
reading one predicate, and a row that drives only the control is green with the
guard deleted).

Measured through the product's own controls:

| document | what the section draws |
|---|---|
| `alttp` | 5 cards, `Progressive Bow (Alt)` pooling into `Progressive Bow`; one level edit = 1 op and one Undo restores the whole entry; a member picker 1 option closed → 160 open (163 items − 4 held + placeholder); Items-tab paint 212 ms |
| `messenger` | 1 card, kind `additive`, six `value` inputs (1/10/50/100/300/500); a value edit keeps `type: 'additive'` |
| `smz3` | 5 cards, 12 members marked `unknown item`, all 13 `provides` shown; removing one stale row takes the section's issue count 12 → 11 and Undo restores it |
| `procgen_maze/AP_1` | 0 cards and the empty hint; adding through the box + button creates the slot's first mapping in either kind |
| `multiworld` (4 slots) | slot 1 → 0 mappings, slot 2 → 5, slot 3 → 0, through the real toolbar selector |

### The Document row

`progression_mapping` is now `KEYS_OWNED_BY_TAB.items`, so its Document row shows
the *"Edited in the Items tab"* pointer **and** its JSON block — W0's rule. The
whole-block `set-key` is still the everything-fallback and is **not** vetoed
against the progression predicate: like the Raw JSON tab (P1's open question 1),
that is the deliberate everything-fallback, and the same reading covers both.

## The Placements tab (W3)

⚖ *"Yes, I want to add a canonical placements tool."* and *"Yes, canonical
placements should have their own tab."* (user, 2026-09-08).

It sits **between Items and Meta**: a canonical placement is a `location → item`
pair, so its left half is the Regions tab's vocabulary and its right half is the
Items tab's — it reads immediately after the two tabs whose words it joins, and
before Meta, which is about the *document* rather than about the world.

**What the key is, and who reads it.** `canonical_placements[player]` is a flat
`location name → item name` map. Unlike every other per-world key on the Document
tab it is an **INPUT, not a readout**: `world_generator/extractors.py` reads it as
the placement source under `--canonical-seed`, so what you set here is what the
next `Generate.py` places. The exporter writes it (`exporter.py`) and the procgen
pipeline's compile writes it
(`procgenPipeline/procgenPipelineEngine.js`) — but nothing before W3 could edit
one entry of it.

⛔ **`is_canonical` is a different key.** That is the exporter's *stamp* saying a
document came out of a canonical run; it is a boolean the Document tab already
draws, it stays unowned, and this tab does not touch it.

**The op — the second vocabulary on this key.**

```js
{ op: 'set-canonical-placement', player, location, item }
```

An absent or empty `item` **deletes** the entry (`''` is what the blank
"(unplaced)" option carries, exactly as in `set-start-region`). The op refuses,
**by name**, a `location` the slot's regions do not hold and an `item` the slot's
`items` do not hold — the schema cannot, because the slot is
`additionalProperties: true` and `{"Nowhere": "Nothing"}` validates against it.
The listing in a refusal is bounded by `REFUSAL_NAME_LIMIT`: one slot in the
corpus holds 1,194 locations and 1,208 items, so an unbounded one would be a
hundred-kilobyte alert.

⛓⛓ **P1 — WHICH refusal fires is one shared predicate, and four things read
it.** `canonicalPlacementIssues(doc, player)` in `rulesDocOps.js` returns
`[{location, item, reason}]` over a slot, with the three reasons named as data
(`PLACEMENT_ISSUE_REASONS`: `unknown location`, `non-string value`,
`unknown item`). The op selects its sentence off it, the tab marks its rows off
it, the Document tab's whole-block veto differences it, and
`scripts/procgen/check-canonical-placements.mjs` runs it over every preset. So
an entry the tab calls stale *is* an entry the op refuses to write — by
construction rather than by four functions agreeing.

⚠ The predicate asks about the LOCATION before the value's type, which is not
the order the refusals originally ran in. An entry whose location the slot no
longer holds has to reach the tab's orphan block whatever its value is, and that
block is the only list that can offer it a delete.

⛔ **A DELETE is not validated, and that is the point.** A hand-edited file can
carry a placement naming a location or an item the document no longer holds. The
tab **shows** those rather than dropping them, and the only gesture it can offer
for one is removal — so refusing the delete because the name is unknown would
leave the one entry a person needs to remove as the one entry they cannot. The
refusals guard what is *written*, never what is removed. Deleting an entry that is
not there returns the document unchanged (the session reports a no-op) rather than
writing an empty block into a document that never carried the key.

⛓⛓ **This is the SECOND vocabulary on `canonical_placements`, deliberately.** The
Document tab's `set-key` still writes the whole block and its row still draws it —
W0's rule, the pointer *and* the block — and the Document row now says *"Edited in
the Placements tab"*. It is the same situation the six `META_FIELDS` scalars are
in (W0's ⚖ OPEN 1): two ops on one path, both schema-vetoed, both one undo.

**What the tab draws.** Every location the slot holds gets a row — placed or not —
grouped by region, in **document order** (region insertion order, then each
region's own `locations` array; never sorted, because that order is the one the
generator wrote the world in). The rows come from `rulesDocOps.locationsOfPlayer`,
**the same function the op refuses against**, so the tab can never offer a row
whose every edit would be refused. A filter box matches location, item and region
names, and the summary line — also the tab's chrome line — is derived:
*"N of M locations placed"*, plus a count of any stale entries.

⛓ **P1 — a stale entry is DEDUCTED from the numerator.** W3 counted an entry
naming a missing item as placed, on the grounds that the file says it is placed.
It is not: `--canonical-seed` cannot place an item the world does not hold, so
the numerator was promising a placement no generation can make. The stale
entries are still named on the same line — the count says how many, the
numerator no longer includes them. Each marked row prints the validator's own
reason, so a reader sees the same words `check-canonical-placements.mjs` prints
for that entry.

⛓⛓ **The option list is built on FIRST OPEN, and that is a measurement.**
`dark_souls_3` slot 1 holds 1,194 locations and 1,208 items and `depgraph` holds
712 and 1,356. Both builds were **measured on that page**, not reasoned about:

| `dark_souls_3` slot 1 | eager (`fill()` at construction) | lazy (shipped) |
|---|---|---|
| option elements on the tab | **1,443,546** | **1,194** |
| tab paint | **13,983 ms** | **178 ms** |
| filter keystroke | **516 ms** | **8 ms** |
| opening one select | — (already built) | **8 ms**, 1,209 options |

So a closed select carries only the blank option and, if placed, its current
value, and fills itself on `focus`/`mousedown`, which is what opening it *is*.
It is uniformly lazy with no size threshold, so the path the small presets in the
in-app roster exercise is the path the big worlds take.

⛔ **No schema preview here**, unlike `_applySetKey`. The slot is
`additionalProperties: true`, so the schema accepts every string the select can
produce and a preview would be a veto that can never fire. The guard is the op's
own refusal.

### The whole-block veto (P1)

⚖ *"We can go ahead and implement placement validation if it's easy."* (user,
2026-09-09) — closing W3's ⚖ OPEN 1.

Because the schema accepts anything on this slot, the Document tab's **Save
JSON** used to write a placement the per-entry op refuses: one tab's guard was
reachable around. `_placementIssuesAddedBy` closes it with the schema veto's own
shape — the op is applied to a *preview*, the preview's placement issues are
computed, and they are **differenced against the ones the document already had**.
What is left is refused by name:

> Refused: `canonical_placements` — 1 placement this edit would ADD that the
> world cannot place: Nowhere → Freeincarnate — unknown location

⛔ **Differenced, because a hand-edited file arrives with stale entries and the
block editor is how a person fixes one.** A veto that refused any save still
leaving an issue behind would make the one document that needs editing the one
document that cannot be edited — the same law the op's unvalidated delete
follows. Measured through the tab's own Save JSON button on
`procgen_topdown/AP_1`: adding `Nowhere` is refused naming `Nowhere` with no op
recorded and the block unchanged; an unknown item at a real location is refused
naming both; a save that **removes** a pre-existing stale entry is accepted as
one op; and so is a save that leaves one in place.

The veto runs at both seams that accept a `set-key` — `_applySetKey` and
`_acceptEditorOp` — so a door wired past the opener is not the way around it.
Today no door writes this key, so the population it actually refuses is the
block editor; the placement is where L4 found the *schema* veto missing for the
opposite reason.

### The corpus gate (P1)

`scripts/procgen/check-canonical-placements.mjs` runs the same predicate over
every `_rules.json` under `frontend/presets/<preset>/AP_<seed>/`, one slot at a
time. Pure node — no dev server, no browser — one line per finding, a computed
headline, exit 1 on any finding. It joins CI's headless gate set by NAME
(`gateRoster`: a `check-*.mjs` in that directory is a gate).

⚠ **The corpus is clean today and the gate is still worth having.** Nothing
outside the hub validated a placement: a preset carrying a stale entry passes
`test_schema_validation.py`, and — measured on a hand-staled copy in a
scratchpad — `python -m world_generator … --canonical-seed 1` *accepts* it and
copies it verbatim into the generated world's `canonical_placements` ClassVar.
The failure lands at seed generation, in `_place_original_items`, where
`multiworld.get_location(name, player)` is `regions.location_cache[player][name]`
and `create_item(name)` is `item_table[name]` — two raw dict lookups, i.e. a
`KeyError` a long way from the byte that caused it. And the tree can now *create*
the condition: place an item on this tab, then delete its location on the
Regions tab.

⛔ **A tab-local edit does not publish `ui:activatePanel`.** `_focusAcceptedOp` is
for **doors** — an editor elsewhere handing an op back — and raising the panel a
person is already typing in would be a readout about nothing.

**Measured on `procgen_topdown/AP_1`** (25 locations in 9 region groups, 25
placements, 14 items), before → after:

| | before | after |
|---|---|---|
| tabs | Regions, Items, Meta, Map, Sidecars, Document, Links, Raw JSON | + **Placements**, between Items and Meta |
| Document rows | 32 | 32 |
| …with a home-tab pointer | 19 | **20** |
| `canonical_placements` pointer | none | *"Edited in the Placements tab"* |
| `canonical_placements` JSON block | yes | yes — unmoved (W0's rule) |
| Links rows | 13 | 13 |
| Sidecars rows | 5 | 5 |

## The Map tab

⚖ *"One specific thing that I want to factor out of the procgen pipeline panels
is the code to graphically display all of the regions as an interconnected map.
I want that to be accessible directly from a tab in the APWorld editor."*

The tab rebuilds a `Grid` from the **working copy's** `preset_sidecars` —
`reconstructResultFromSidecars(record, {playerId})`, the same pure function the
pipeline panel uses for a loaded preset — and hands it to
`drawCompositeMap(canvas, grid, regionSize, {selection})`. The renderer names no
substrate: each one declares its own painter in the registry's `compositeMap`
slot ([substrate registry](../developer/procgen/substrate-registry.md) §
*Composite map*), and a substrate that declares none gets a generic box
**labelled with its id**.

**A world has a map when its sidecars carry a `grid_cell`**, by ⚖ (*"show the
composite grid only for presets that have grid data"*). That is a claim about the
LAYOUT and names no substrate: a slot whose sidecars carry no cell has nothing to
lay out, so the tab prints *"No map for this world (no grid data in the
sidecars)"* and the reason — and draws **nothing else**. There is deliberately no
region-graph fallback here: the graph is its own panel.

⛔ **M0 (2026-09-10) REVERSED the narrower reading of that ⚖.** Until then the
cell's SIZE also had to come out of the document — `reconstructResultFromSidecars`
took it from `playable_payload.width`/`height` in TILES and returned null when
that max stayed 0, before placing a region — so a bounce / runner / jta slot with
a `grid_cell` on every region drew nothing. The user met it as *"when I load the
Bounce demo preset in the procgen pipeline panel, then generate it, then click
Load into Frontend, its map doesn't display in the Map tab"*. The renderer was
never the limit (see the generic box above); what was missing was a cell size for
a document that carries none. It now has a precedence, and the reconstruction
returns which step fired as `regionSizeSource`:

| step | `regionSizeSource` | where the size comes from |
|---|---|---|
| 1 | `payload` | the max tile geometry over the slot's payloads — the rule that was already there, unchanged where it fires |
| 2 | `declared` | a `compositeMap.cellSize` on the registry entry of a substrate placed in the slot. **No substrate declares one**: nothing measured needs a size other than the default, and a declaration nobody needs is a hand list of substrate names wearing a registry hat |
| 3 | `default` | `DEFAULT_REGION_SIZE` — exported from `procgenPipelineEngine.js`, which held the only `{width: 8, height: 6}` literal (`rebuildEnvelopeFromRulesJson`) and now reads the same export |

MEASURED over the 42 populated slots of the committed corpus, one call per slot:
**26 grid / 16 null → 38 grid / 4 null**. Twelve slots turned; every slot that
drew before draws the same grid, the same cell and the same `regionsBuilt`. The
four that stay null are exactly the four whose sidecars carry no `grid_cell` on
any entry — `jta_substrate_test`, `seedling_atlas`, `seedling_atlas_maze`,
`seedling_playthrough`. M0 left `procgen_metadata.grid_dims` unread, because 25
of the 42 slots carry it and **0** exceed the `grid_cell` extents, so no
committed document could tell the two rules apart. ⛓ **M2 made it consulted.** A
map MOVE can empty the last row or column, which makes the extents smaller than
the size the generator recorded. So the grid's size in cells is now
`mapBoundsFor(doc, entries)`: the larger, per axis, of the extents and
`grid_dims`. The reconstruction returns which one decided as `boundsSource`, and
a move's bounds refusal reads the same function (see *Moving and swapping
regions* below). Re-measured at M2 over the same 42 slots: **38 grid / 4 null,
0 sized by `grid_dims`, every grid and every cell unmoved.**

The stats line beside the map says which rule sized the cell, off
`regionSizeSource` rather than a second derivation (`data-cell-source` on
`.apworld-map-slot` carries the same value for a row to read): *"cell 8×6 tiles"*
for a grown world, *"cell 8×6 (the engine's default — this world stores no tile
geometry)"* for a zone one. ⛔ A line that called the fallback a tile count would
be claiming geometry the document does not have.

The same function paints the **pipeline panel's** loaded-preset view and its
`_adoptHandoffRules` hand-off, so the hub's `procgen_metadata` door now lands on a
painted map for the same twelve slots instead of an empty canvas.

**Two clicks, the pipeline's `edit` mode's shape** (PRESET SIDECARS M1). The
click→cell mapping is the renderer's exported geometry (`canvasPointOf` /
`cellAtPoint`), the same functions the pipeline's hit-tester calls, so a click and
a pixel cannot disagree about where a cell is.

- **A click on a cell that is not the selection SELECTS it and stays on the Map**
  (`_selectOnMap`). The map outlines the cell, and **under the canvas** the region's
  sidecar block is drawn: the same `_makeRegionSidecarBlock`, as its third host,
  with **Go to region** (`selectRegion`, which switches to the Regions tab and
  marks the same region's block, `[data-region-name][data-selected]`). It goes
  under the canvas, not beside it, because on `procgen_topdown/AP_8` the canvas
  (7,084 × 6,440 px) is scaled to the tab's whole width (699 of 715 px, measured
  live). A second selection swaps the block. Until M1 this click called
  `selectRegion` directly and left the Map for the Regions tab. ⚖ The planner
  ruled that it stays, because the map moves of M2/M3 need a click that does
  not leave the tab.
- **A click on the selected cell presses that block's Edit ▸** (`_pressMapEdit`).
  The block's button decides whether the room opens; nothing re-computes that. A
  disabled button (no room editor, no round trip, or a refusal remembered for
  this record) opens nothing, and *"Edit refused: <its own title>"* is printed
  beside the block and in the status line. An enabled button runs the button's
  own handler (`_handleEditRoom`, which now answers `{opened}` / `{refused}`),
  and a refusal met on the press is printed beside the block too. The room is
  H4b's door, parked on `roomEditorSession` as from any other host.
- **A click on an empty cell, or off the grid, does nothing**: the selection and
  its block are kept, as the handler has always done.
- **A player-slot pick drops the selection.** The selection is a region NAME,
  and slots share names: the four-player fixture's slot 1 and slot 3 both have
  a `region_1_0` (a maze room and a bounce room). Measured on the M1 drive before
  the fix, a selection kept across the pick made the FIRST click on slot 3's
  `region_1_0` count as the second, and it opened slot 3's room. A door that
  names its own slot (the reverse link) switches the slot and then selects, so
  it is unaffected.

The intro line above the map says what both clicks do, and (M2) what
**Move / swap ▸** does. In-app rows:
`apworld-map-click-selects-the-region` (amended at M1: the click stays on the
Map, draws the block and opens nothing; its Regions-tab claims are reached
through Go to region), `apworld-map-selection-draws-the-regions-block`,
`apworld-map-second-click-opens-the-selected-regions-room`,
`apworld-map-first-click-opens-nothing` (including the slot pick and a refused
region), and `apworld-map-handoff-names-the-slot-and-the-cost`.

### Moving and swapping regions (M2)

⚖ user, 2026-09-10: *"Yes, I choose option A"*. The map moves are NATIVE hub
ops, not a hand-off to the pipeline. ⚖ Q3 C: *"a move may turn a link into a
teleporter, and the op names each one."*

**The gesture.** The selected region's block on the Map carries
**Move / swap ▸** (beside Go to region). Pressing it ARMS the map: the status line
says *"Click an empty cell to move R there, or a region to swap with it; Esc
cancels."*, the canvas's `data-move-armed` names the region, and the cursor is
a crosshair. The next click on the canvas resolves the move:

| the click lands on | what happens |
|---|---|
| an empty cell | ONE `move-region {region, to: {gx, gy}}` |
| another region | ONE `swap-regions {a, b}` |
| the armed region's own cell, or off the grid | nothing is recorded; *"Move cancelled: …"* |

The op is asked of a preview first, so a refusal is printed beside the block in
the op's own words and never reaches the session's alert. The map repaints from
the record, and the selection follows the region to its new cell (the selection
is its name). The pipeline's radio modes are not copied: the block is the hub's
control surface.

**The armed state is dropped** at every boundary a region name does not survive
(trap 1320: slots share names). A **slot pick** and a **tab switch** each drop it
and say so on the status line, and **Esc** drops it (*"Move cancelled (Esc)."*).
A **new document**, and any other op or undo, are covered by keying the armed
state on the record (trap 1311). Each boundary has one guard, so each one's
mutant can red a row. Arming focuses the panel's root, because the render
destroys the pressed button and Esc would otherwise reach `<body>` (measured on
the M2 drive).

**What a move writes, and what it never touches.** A region's LINKS are logical:
`regions[p][r].exits[].connected_region`, and inside the payload each exit's
`targetRegion` / `targetExitId`. A move changes none of them. It writes:

- `preset_sidecars[p][r].grid_cell` of every region that changed cell;
- `playable_payload.exits` of every payload with an exit whose link stopped (or
  started) being adjacent on its side, forward and back exits alike. The list is
  written in the substrate's OWN serialized form (deserialize → set the flags →
  `serializeWorld` → `.exits`), never a hand-built record.

Nothing else is written. ⛔ `regions[p]` is byte-equal after every move and every
swap, and a row walks every move and every swap of two fixture slots, checking
the deep diff.

**The teleporter rule is the engine's side law**, `linkIsAdjacentOnSide(grid,
cell, side, targetCell)`, exported from `procgenPipelineEngine.js` as its ONE
spelling (`relayoutSphereGrid` uses it too). It says an exit is a teleporter
unless its target sits in the neighbouring cell ON ITS SIDE. It reproduces every
stored flag in the committed corpus but two: `omsi_region_split_test`'s
hand-authored diagonal links (stored `false`). A flag is written only when the
move changes the law's verdict for that exit, so a flag the law would dispute
stays as the document holds it until one of its regions moves.

The description names the move and every link whose kind it changed, paired
into links by their reciprocal exits: *"Moved region_1_1 (1,1) → (0,0); 1 link
became a teleporter: region_1_1 north ↔ region_1_0 south"*, *"… no link became a
teleporter"* (`NO_LINK_BECAME_TELEPORTER`), and *"… 1 teleporter became a plain
link again: …"* when a move brings a link's ends back together.

⛔ **Why the engine's relayout does not write it** (measured at M2 over the 38
committed slots with `grid_cell`s). `relayoutSphereGrid` is what the pipeline's
own Move Region runs. On a LOADED document it writes nothing to a payload exit:
`stitchGrid` walks `exits_placed` / `extracted_rules`, which a document does not
carry. Given those fields, a NO-OP relayout re-targets **520 maze exits on 154
regions**, because `Grid.teleporters` is keyed `cell:side` and holds one target
per side, while 118 regions (the `procgen_topdown` worlds) carry two or more
same-side teleporters. It also never updates a back-exit. So the hub runs the
engine's `moveSphereRegion` / `swapSphereRegions` for the PLACEMENT only (on a
grid of name-only stubs) and applies the side law per exit.

**Bounds.** A target outside the map is refused: *"(gx,gy) is outside player p's
map, which is W×H cells … ⛔ A move never grows the map."* The map's size is
`mapBoundsFor`, the Map's own rule (above). With a `grid_dims`, a move that
empties the last row or column keeps the map's size, and the move back is
accepted. Without one, the map SHRINKS to its new extents; the description says
so (*"… the map shrinks to 3×1 (it was 3×2 — its size is the extent of the
`grid_cell`s)"*, `MAP_SIZE_IS_THE_EXTENT`), and Undo is the way back. Measured: no
committed slot without `grid_dims` can shrink under a single move, because each
one is too full (3 regions in 2×2, 5 or 6 in 3×2, 4 in 2×2). Slots are
independent grids, so a cell another slot's region holds is not occupied here.

**Refused by name** (`rulesDocOps.js`): no region name; no sidecar entry; no
usable `grid_cell`; two regions sharing one cell; a malformed `to`; a `to`
outside the map; an OCCUPIED `to` (*"… a move needs an EMPTY cell. To exchange
the two, swap them (swap-regions)."*); a payload whose substrate cannot
re-serialize the exits the move flips. A move to the region's own cell, or a swap
with itself, is a no-op the session drops, never a refusal.

**The corpus control** (`regionLayout.test.js`) runs the write-back with NO flags
over every placed committed entry, and it must move 0 bytes of `exits`: the
round trip is byte-stable for every substrate. The one entry with no `exits` key
(`jta_mixed_test`'s `JtaZone1`) keeps having none (`NO_EXITS_KEY_KEPT_ABSENT`),
because the pass-through serializers would add `exits: []`. A WHOLE-payload
re-serialize would move bytes on every maze and text-adventure region (their
`locationName`s come from `extracted_rules`), which is why only `exits` is
written.

In-app rows: `apworld-map-move-to-an-empty-cell-records-one-op`,
`apworld-map-move-onto-a-region-swaps-the-two`,
`apworld-map-an-armed-move-drops-at-every-boundary` and
`apworld-map-a-separating-move-names-the-teleporter` (the connection pairs,
counted off the reconstruction, are the same before and after).

**"Open region graph" is ONE-WAY**, by ⚖: *"We could add a button to open the
region graph, but I don't want a button in the region graph leading back to the
APWorld editor."* The button raises `regionGraphPanel` through the same
`DOCUMENT_LINKS` row the Links tab uses, and **nothing was added under
`regionGraph/`**.

The rebuilt grid is memoised on the record's object identity plus the selected
slot, because `_render` runs on every tab switch and a whole deserialize pass per
render would sit beside the `validateRules` pass that runs there too.

⛔ **R1 CORRECTION: that pass is milliseconds, not seconds.** This sentence used
to say `validateRules` *"already costs 4.6 s on the corpus's largest document"*.
Re-measured on `?game=stardew_valley&seed=1` (209 regions, 1,073 items, scratch
Playwright, the app let settle first): **2.6–4.6 ms**. The seconds belong to the
**Regions tab's own renderer** — `_selectTab('regions')` is 5.4–8.0 s there,
against 0.36–0.40 s for Items — and attributing them to the validate pass is
what put a perf item on the wrong file.

A region rebuilt from sidecars is placed **with its top-level `exits`** — the
field the renderer's connection pass and its exit-selection highlight read, and
the one `procgenPipelineEngine`'s own placements have always set. H3 found it
missing and left it (the slice had to stay byte-inert); **H4a added the one line**
(`exits: world.exits` in `compositeMapDocument.js`). Measured on `procgen_maze`
seed 1 through a recording 2d context: 0 → 2 connection lines, 203 → 211 draw
ops. It moves the **pipeline panel's** loaded-preset view too, which is the same
function's other reader — `scripts/procgen/shot-loaded-composite-map.mjs` writes
a PNG of exactly that view, which is how the before/after pair was taken.

### The three ways there is no map

The tab names WHICH one, because "no map" and "no grid data" are different claims
and only the second tells you whether another document would work
(`panel._noMapReason()`). They are the three ways
`reconstructResultFromSidecars` returns null, in the order it decides them:

| what the document has | the sentence |
|---|---|
| no `preset_sidecars` at all | *this document carries no `preset_sidecars`* |
| sidecars, none for the selected slot | *player slot N carries no sidecars* |
| sidecars, no `grid_cell` on any | *no grid data in the sidecars* |
| sidecars with cells, no registered substrate that can rebuild one | *no registered substrate here can rebuild a region from its payload* |

⚠ **There was a fourth, and M0 retired it.** It read *"N regions carry a grid
cell, but `bounce` stores no tile-grid geometry in the payload"*, and it was the
honest sentence for the sizing rule described above: a zone slot carried a
`grid_cell` on every region and still could not be drawn. That case now draws, so
a reason for it would be a reason for something that does not happen. H4a is worth
keeping in view here — until the four-player fixture landed, every no-map document
in the corpus carried no `grid_cell`, so ONE sentence covered the corpus by
accident, and the fixture is what made the second cause visible at all.

### The four-player fixture

`frontend/presets/multiworld/AP_05594871498841892311/` (seed 4) is the only
committed document whose `preset_sidecars` carry more than one slot, and the
whole per-player half of this panel is tested against it. Slots 1–2 are
`Procgen Maze WorldGen` (3 grown regions each), slots 3–4 `Bounce Demo WorldGen`
(5 zone regions each) — so the selector, the Map tab and the Document tab's
per-player slice each have a document that can tell *"read the selected slot"*
from *"read the first one"*. Before it, 158 of the 192 committed carriers held
`{}` and every populated one keyed under slot `"1"`.

⚠ **Every one of the four slots carries a `grid_cell` on every region**, and the
H4a-era note that said otherwise of slots 3–4 was wrong when it was written: what
those slots lack is a tile-grid PAYLOAD, a different field. Since M0 all four
slots DRAW — 1–2 sized from their own payloads, 3–4 at the engine's default — so
the fixture now discriminates the two SIZING rules on one document, which is what
`apworld-map-follows-the-selected-player-slot` walks and what
`apworld-map-draws-a-zone-world` drives on slot 3. The remaining "no map" answer
is driven on `jta_substrate_test` (16 entries, 0 `grid_cell`).

## Edit ▸ — a region's room, in its own editor

A region with a `preset_sidecars` entry has a **room**, and the substrate that
owns it usually has an editor for it. The `Edit ▸` on the region's sidecar block
— under its header on the Regions tab, and on its row of the Sidecars tab's list
(S0 moved it out of the header, so it is still one button per region) — opens that
editor on the hub's **working copy** (⚖ *"Let's implement working copy for now"*)
and its save comes back as **ONE** `replace-region-sidecar` op — so a whole
sub-edit made in the maze lab or the bounce editor is one entry in this panel's
edit list and one Undo (⚖ idea 3, *"one undo stack"*).

**Two declarations, no substrate names.** `regionRoundTrip.js` resolves
`roomEditor` (which editor) and `regionRoundTrip` (what it wants handed in, and
how to read its save) off the [substrate
registry](../developer/procgen/substrate-registry.md) § *Editing*. A substrate
that grows a room editor gets an `Edit ▸` here by declaring two fields, and
nothing under `apworldEditor/` learns its name — the `compositeMap` precedent
and the same ⚖.

**Three answers, and "absent" is one of them.**

| the region | the button |
|---|---|
| no `preset_sidecars` entry | **no block and no button** — a classic AP region has no room, and a disabled control would imply it might have one |
| a substrate with no `roomEditor` (jta, omsi, runner, text_adventure) | **disabled**, titled *"No region editor for X yet"* |
| a substrate that declares `regionRoundTrip: {refused}` (Seedling) | **disabled**, titled with the substrate's own sentence — its payload is an atlas reference, not a room record |
| a region whose payload does not round-trip | **enabled until pressed**, then disabled with the reason (see below) — for as long as the document is the one it was asked about: the verdict is remembered against the RECORD, so any applied op, an Undo or a new document re-asks it (S1; until S1 it was cleared only by an applied op, and an Undo left a refusal standing on a restored payload) |
| anything else | **enabled** |

### The baseline, and why the door is ever refused

Before the room is handed over, the round trip is run on the **unedited**
payload. What that answers is not cosmetic:

1. **Would an unedited open-and-save move a byte?** If it would, this door would
   rewrite the region behind you, and it is disabled by name. The maze lab's
   document is a *region library* — interchangeable content whose capture path
   deliberately strips the exit stitching and the baked AP location names — so
   the write-back **re-stamps** that identity from the document; where it cannot
   (a payload written by a different producer, one carrying fields the
   serializer does not emit), the region is refused rather than silently
   rewritten.
2. **Which access rules can this door prove it authored?** Only those the
   baseline REPRODUCES. A rule the grid composed, or one the Python round trip
   renormalized beyond the `True_ / Has / And / HasAll` fragment
   `extractItemRequirementFromRule` can compare, is **frozen**: an edit moves
   the payload and leaves that rule exactly as it is, and the status line says
   how many.

⛓ **After a RAW save, the door is unchanged — and the rules can still follow the
payload.** Check 1 above refuses a raw edit the serializer does not reproduce, and
it is not relaxed for that case. **Re-derive rules ▸** (S2, *`preset_sidecars`,
per region* above) is the road there: it takes the baseline from the payload
BEFORE the raw edit (recovered from the session's record), moves only the rules
that payload produced, and writes the payload in the serializer's form — after
which this door's baseline passes again.

Measured over the committed corpus at `fb45ad85ff` (M1: `inspectRegionRoom` per
sidecar entry of every tracked `_rules.json`, the libraries imported for
registration): **1,036 of 1,046** maze-payload sidecar regions and **25 of 25**
bounce regions are editable, and every one of the rest gets a named reason. All
ten maze refusals are `seedling_atlas_maze`'s atlas-derived rooms, and they fail
check 1: an unchanged save would already rewrite their payloads. Every region of
the other substrates (jta, text_adventure, omsi, runner, flash_seedling) is
refused before the press, by the registry. The *"394 of 1,046 … 15 of 25"* this
paragraph used to quote is from before H4b/H6b, when `procgen_topdown`'s
source-named locations were the biggest refusal class.

### What the op may and may not move

`replace-region-sidecar` writes the payload and the **access rules only**. Exit
targets, location names, AP ids and item placements are the **fill's**, and the
op's rules map must be TOTAL in both directions:

- a location or exit the edited room **lost** is REFUSED by name, and the
  sentence says what the fill placed there — dropping it would delete somebody's
  item placement inside an op whose description says *"room replaced"*;
- a location or exit the edited room **added** is REFUSED too: a new AP location
  in a filled document needs an id and a pool entry, which is `add-location`,
  not a geometry editor.

### Where the open room lives

The room session is **parked** on the panel (`roomEditorSession`), not torn down
on a re-render — the opposite of the raw view's rule, and for the opposite
reason: the raw editor lives inside this panel's DOM and `_render` must unmount
it, while a room lives in *another* panel and must survive every render here. It
is closed in exactly two places: when a second room is opened, and on
`onPanelDestroy`.

## The Links tab

Rows come from three places, and only one of them is a hand-written list:

- **substrate rows**, derived from the substrate registry's own `roomEditor`
  declarations (see [`regionEditors`](../developer/procgen/architecture.md));
- **block-editor rows**, derived from `DOCUMENT_KEY_EDITORS` (H5) — so the
  Links row and the Document row carry the **same label** and resolve the
  **same `open`**, rather than being two lists that agree until somebody adds a
  door to one of them. A test row asserts the two sets equal in both directions;
- the **document-level table** — the two raw JSON editors and the region graph
  — written once, because those have no top-level key of their own to hang off.

Rows open their editor **empty** when the document has no data for it; the tab
draws even with no document loaded at all. Rows whose editor reads **applied**
state (both raw editors, and the spoiler checklist behind `sphere_log`) say so,
because they will not see the working copy until you press Apply.

⚖ The region graph link is **one-way** by user ruling: this tab opens the graph,
and the graph has no button back here. Do not "fix" that asymmetry.

### …and the links pointing the OTHER way (H4c)

Six controls carry the label **"Open in APWorld Editor"**, and the spelling is
deliberately identical everywhere — it is the reader's only clue that these are
one door pressed from six places. Two of them said *"Edit in APWorld Editor"*
until H4c.

| where | what it does | how |
|---|---|---|
| Presets, the opened-preset screen | raises this panel, which already holds the document the preset load published | `ui:activatePanel` only |
| the procgen pipeline (`procgenPipelineUI`) | hands over the world it just generated | `apworldEditor:loadRules` + `ui:activatePanel` |
| the region marking tool | compiles the atlas and hands over the rules.json | `apworldEditor:loadRules` + `ui:activatePanel` |
| the maze lab (`mazeRoom/lab.html`), SET / WORLD arm | hands over the document its own REPORT compiled | `procgenLab:openInApworldEditor` → forwarded by `procgenLabPanel` |
| the Seedling watch page (`seedlingDemo/watch.html`), SET arm | the same, over the same seam | as above |
| the bounce region editor | names the region it is editing; carries **no** document | `apworldEditor:selectRegion` + `ui:activatePanel` |

The two lab pages are **standalone documents** as well as hosted frames, so their
button is **hidden** — not disabled — when the page has no host: there is no app
on the other side to open, and the transport is not even fetched
([the maze page](../developer/procgen/maze.md) § *Hosted in the frontend*). The
button's DISABLED half is the shared set editor's existing rule: the same three
conditions that refuse `Download rules.json` refuse the hand-off, because a graph
that does not close has no compiled document to hand anybody.

`apworldEditor:selectRegion` carries `{region, player?}`. `player` is optional and
`null` means *"whichever slot the hub is showing"* — the bounce editor is opened
on ONE region and does not carry the slot it came from. A named slot the document
holds switches the selector first and then selects; one it does not hold is named
in the status line and the hub stays where it was; a region no slot holds is said
so rather than silently switching to a tab with nothing highlighted.

Both channels are **stashed at module level** when the panel has never been
mounted, and drained on mount — the panel's subscription lives on the panel, and
a door pressed before anybody opened the hub would otherwise publish into nothing.

## The exits

⚖ *"The save destination is the rules.json data."* There is no disk writer in the
frontend, so a preset cannot be written back; the three exits are what the hub
offers instead. All three read the **working copy**, never applied state.

### Open in APWorld Editor (from the Presets panel)

The opened-preset screen (`presets/presetUI.js` `loadPreset`) and the
manually-loaded-file screen both carry an **Open in APWorld Editor** button,
rendered from one descriptor (`presetUI.APWORLD_EDITOR_BUTTON`).

⛔ It publishes `ui:activatePanel`, **not** `apworldEditor:loadRules`. A preset
load already published `files:jsonLoaded` app-wide and the hub already opened a
session on the state manager's re-emit; handing the document over the focus-safe
channel would open a *second* session boundary and discard pending edits. The
focus-safe channel is for loads that must not go global — the pipeline's and the
marking tool's.

### Download

`downloadJson.js` writes `JSON.stringify(record, null, 2)` — which **192 of the
205** committed presets already are, to within 4 bytes. ⛔ Not `canonicalJson`:
key order is *content* for this document (the session's `equal` is
`deepEqualKeyOrder`), so a sorting writer would hand you a file whose bytes
differ from the record you were looking at.

⚠ The other **13** presets are written *compact*, so their download is up to
**1.75×** the file on disk (`procgen_topdown/AP_8`: 1,799,872 B → 3,146,656 B).
That is deliberate — the majority formatting is what a reader expects and no
loader cares — but it is why every size below is in **pretty** bytes.

The file name is `<Game>_AP_<seed>_rules.json`, each half dropped when the
document does not carry it. The brief asked for `<seed_name or game_name>`; over
the 205 committed presets `seed_name` alone yields **24** distinct names and is
the **empty string** in 29 of them, so both identifiers are used.

⚠ There are **19** hand-rolled `Blob` + `URL.createObjectURL` download sites under
`frontend/modules/` (18 outside the submodules) and no shared helper.
Consolidating them is a cleanup-backlog item, not this module's job.

### Apply — "load it into the app as if it were a preset"

⛓⛓ **Apply republishes the session's ORIGIN source name.** The document's
provenance is recorded at the session boundary (`origin` on the base tag) and
`_handleApply` publishes it; `apworldEditorApply` survives only as the fallback
for a document with no origin (a pipeline or marking-tool hand-off, built in
memory).

Why it matters: `files:jsonLoaded.sourceName` becomes
`stateManagerProxy.currentRulesSource` and reaches `sphereState` as
`stateManager:rulesLoaded.source`, which parses it as a preset path to find
`<seed>_sphere_log.jsonl` — and, failing that, recognises exactly four in-memory
sources by name. `apworldEditorApply` is not one of them, so Apply used to reset
the sphere state and load nothing:

- **173** of the 205 committed presets keep their sphere log as a **sibling file**
  and carry no embedded one;
- **26** carry an embedded `sphere_log` and no file — and lost it too, because the
  embedded fallback is gated on that same four-name list;
- 6 have neither.

⛔ Because the published source name is now indistinguishable from an incoming
preset load, the panel tells its **own echo** apart by object identity
(`_appliedDocs`), not by name. Getting that wrong discards the edits Apply just
published.

⚠ `rules:loaded` is **not** published and must not be: it has no subscriber
anywhere in `frontend/` — only a publisher registration in `presets/index.js`.

### The Raw JSON tab — CodeMirror 6, and no size limit

The tab mounts a **CodeMirror 6** view over `JSON.stringify(record, null, 2)` —
the same editor the `editorCodeMirror6` panel is, built from the same extension
list (`editorCodeMirror6/jsonEditorExtensions.js`: line numbers, fold gutter,
JSON grammar, `oneDark`, wrapping). ⛔ There is deliberately **no second list**:
two raw-JSON editors that each build their own drift on the first theme change
and nothing reds, because each half stays internally consistent.

**Save JSON** (or **Ctrl/Cmd+Enter** inside the editor) parses the text and
records **one** `replace-document` op, so a single undo folds the whole text edit
away — and, as with `set-key`, the schema gets a veto first (a preview, validated
whole, differenced against the errors the document already had). It is a control
rather than a keystroke handler because reading the text costs a full-document
string and parsing it a full `JSON.parse`, which per key is the wrong cost and
would refuse every intermediate state a person types through.

⛔ The op carries the **parsed** document, never the text: an edit list whose
payload is a recipe that can fail to re-parse is not a record.

⛔ It is called **Save**, not Apply: the toolbar's Apply means *load this document
into the app*. Save writes the record; Apply publishes it.

#### The limit is RETIRED, and that is a measurement too

H2 shipped `RAW_VIEW_LIMIT_BYTES = 2,000,000` here, with a refusal screen and a
"Show it anyway" escape, because the tab was a `<textarea>` and a textarea over
the corpus maximum took **12,942 ms to open and 1,251 ms per keystroke**. H2b
changed the widget and re-ran the same instrument with a new arm:

```
node scripts/procgen/measure-apworld-raw-view.mjs --all --samples=5 --json=<path>
```

`--all` opens the raw tab over **every committed preset**, because retiring a
limit is a claim about 205 documents and cannot be interpolated from three
(2026-09-05, 8 cpus, load 2.02 → 3.53):

```
opened 205/205; 0 did NOT mount an editable editor
time-to-interactive:  min 13.9 ms · median 30.8 ms · p90 99.5 ms · MAX 262.9 ms
over the textarea's 1,504 ms (H2's limit point): 0    over 500 ms: 0
```

⇒ no size in this corpus the view cannot open, so the constant, the refusal
screen, the escape hatch and `rawViewVerdict`'s `overLimit` are **gone**. The
verdict is now the size, said out loud.

⚠⚠ **The raw tab's cost is NOT ordered by document size.** The ten slowest to
open are led by three `depgraph` presets at **1,198,656 B** (262.9 / 259.9 /
179.2 ms) — *under* H2's limit, so never suspect — with the 3,146,656 B corpus
maximum only **third** at 211.9 ms. H2's median/p90/max-by-size method would have
reported the worst case as 211.9 ms and been wrong by 51 ms and by four
documents. That is what `--all` is for.

The synthetic sweep runs to **16 MB**, 5× past the corpus, over the same shipped
extension list — because "no document is too big" is only defensible if somebody
looked above the corpus:

| pretty bytes | open | keystroke |
|---|---|---|
| 500,000 | 41.1 ms | 67.5 ms |
| 1,000,000 | 32.3 ms | 14.4 ms |
| 2,000,000 (H2's limit) | 38.6 ms | 17.8 ms |
| 4,000,000 | 53.1 ms | 12.1 ms |
| 8,000,000 | 89.4 ms | 10.5 ms |
| 16,000,000 | 179.2 ms | 16.9 ms |

16 MB opens faster than the textarea opened 500 KB.

#### Undo, and the cost of the import

**Ctrl/Cmd+Z inside the editor is the editor's**; outside it, it is the session's
(B-c's rule). The panel's key handler refuses the binding inside
`input, select, textarea` and inside anything `isContentEditable` — that last
clause is what carries a CodeMirror view, and H2b is the first time a
`contenteditable` widget has ever been under it. CM6's own history handles the
undo, through the shared list's keymap.

The import is free in both modes, measured:

* **bundled** — `frontend/dist/bundle.js` went 4,372,452 → **4,372,093 B**
  (−359): `init-bundled.js` already imports `editorCodeMirror6/index.js`
  statically, so the 837 KB CM6 library was always an input;
* **unbundled** — the ordered `.js` request list of a cold load differs by
  exactly **one** file (`jsonEditorExtensions.js`, 3,755 B).
  `codemirror6-bundle.js` was already fetched at the same position (347 → 346),
  because `editorCodeMirror6` is `enabled: true` in `module-configs/modules.json`
  and imports the barrel statically.

## Events

| Direction | Event | Notes |
|-----------|-------|-------|
| subscribes | `stateManager:rawJsonDataLoaded` | opens a session; its own Apply echo is ignored **by object identity** (`_appliedDocs`) — the source name is no longer a marker |
| subscribes | `apworldEditor:loadRules` | the focus-safe hand-off — the pipeline, the marking tool, and (H4c, via `procgenLabPanel`) both lab pages. `{jsonData, source?}`; `source` NAMES the door and the session's base tag says `hand-off · <door>`, while `origin` stays `null` because an in-memory compile has no preset path whose sphere log belongs to it |
| subscribes | `apworldEditor:selectRegion` | H4c — `{region, player?}` from the bounce region editor; answered with `selectRegion(name, from)`, which says so when this document does not hold that region |
| publishes | `files:jsonLoaded` | Apply — a full-document clone, under the **origin's** `sourceName` (`apworldEditorApply` only when there is no origin) |
| publishes | `ui:activatePanel` | the Links tab's rows, the Document tab's block-editor doors, and the Map tab's one-way *Open region graph*. ⛔ H5 found this was **never registered** in the module's `register()`, and `eventBus.publish` refuses an unregistered publisher — warns and returns — so H1's Links tab Open and H3's *Open region graph* had been silently doing nothing since they shipped. A test row now scans the panel's own `publish('…')` sites against `register()`. ⛓ S1 — the hub also raises **itself** with this event now (the accepted-op focus), so the component type is one constant, `APWORLD_EDITOR_PANEL_ID`, shared by the registration, `moduleInfo.componentType` and that publish |
| publishes | `procgenPipeline:loadRules` | H5 — the `procgen_metadata` door; `{jsonData, source, player}` |
| publishes | `loopsCostDebugger:loadRules` | H5 — the `loop_costs` door; same payload plus L4's `onSave` |

## Tests

| Suite | Where |
|-------|-------|
| `rulesDocOps.test.js`, `rulesEditAdapter.test.js`, `rulesUtils.test.js`, `documentKeys.test.js`, `documentLinks.test.js`, `hubExits.test.js`, `regionRoundTrip.test.js`, `regionRederive.test.js`, `regionLayout.test.js` (M2: every move and swap of two fixture slots, the refusals, the corpus control, the side law's census), `reverseLinks.test.js`, `sidecarIssues.test.js`, `sidecarForm.test.js` | vitest, `frontend/modules/apworldEditor/` |
| `check-sidecar-fields.mjs` (+ `checkSidecarFields.test.js`) | `scripts/procgen/` — the corpus gate: every committed entry against its declaration, and (V0) `sidecarIssues` per slot as its second layer |
| `../procgenCore/compositeMapRenderer.test.js` | vitest — the Map tab's renderer, driven by a TOY substrate |
| `../procgenPipeline/compositeMapDocument.test.js` | vitest — `preset_sidecars` → `Grid`, including the player slot; (M2) `mapBoundsFor` |
| `../procgenPipeline/procgenPipelineUI.test.js` | vitest — (H5) the hand-off answer's three outcomes; (M1) the carried slot named when it is not the built one, the top-down cost clause, the sphere answer unchanged, and the block's Regenerate note held to `HANDOFF_REALISED_SLOT` |
| `presetUI.test.js` | vitest — the "Open in APWorld Editor" descriptor |
| `measure-apworld-raw-view.mjs` | `scripts/procgen/` — the browser measurement; `--all` opens the raw tab over every committed preset, which is what RETIRED `RAW_VIEW_LIMIT_BYTES` |
| `apworldEditorTests.js` | the in-app runner, category `apworldEditor`, enabled in `playwright_tests_config-substrates.json` (`npm test -- --mode=test-substrates --batch=fast`) |
| `check-procgen-lab-hosting.mjs` claim 12 | `scripts/procgen/` — the reverse link end to end, from a button inside an iframe to a session in this panel |
