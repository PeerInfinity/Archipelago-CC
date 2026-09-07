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
| `regionRoundTrip.js` | the per-region **Edit ▸** door — resolves the substrate's declarations, runs the baseline, folds a save into ONE op |
| `../procgenCore/compositeMapRenderer.js` | the **Map** tab's painter — shared with the procgen pipeline panel, substrate-neutral |
| `../procgenPipeline/compositeMapDocument.js` | `reconstructResultFromSidecars` — `preset_sidecars` → a `Grid` |
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
| **Regions** | regions, exits, locations, access rules — and **Edit ▸**, the door into a region's own room |
| **Items** | items, classifications, pool counts, starting counts |
| **Meta** | the fields in `rulesDocOps.META_FIELDS`, plus the start region and the victory condition |
| **Map** | the composite grid, for documents whose sidecars carry grid cells — see below |
| **Document** | **every** top-level key — see below |
| **Links** | every other editor that owns part of a `rules.json` |
| **Raw JSON** | the whole document in a CodeMirror 6 editor — see *The exits* below |

## The player selector

A `rules.json` is keyed by **player slot** at eighteen of its thirty-four
top-level keys, and 15 committed presets carry four players. The toolbar's
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

Keys another tab already edits show a pointer to that tab instead of a second
editor. Everything else is editable, and the whole edit vocabulary is one op:

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

### The `editor` slot (H5)

`documentKeys.DOCUMENT_KEY_EDITORS` is a `key → {label, returns, note, open}`
table naming, for the five top-level keys that have a dedicated editor, how to
open it. A filled row makes the Document row draw an **Open** button beside the
raw JSON — beside, not instead of: the block is still data, and the block editor
is still the way to fix a value the dedicated editor cannot express.

| key | editor | `returns` |
|---|---|---|
| `region_atlas` | the region marking tool | `op` |
| `procgen_metadata` | the procgen pipeline | `document` |
| `loop_costs` | the loops cost debugger | `op` |
| `sphere_log` | the spoiler checklist | `none` |
| `preset_sidecars` | the Regions tab's per-region **Edit ▸** | `op` |

The other twenty-nine schema keys have **no dedicated editor**, and the registry
says so by *not having a row*, never by dropping the key from the tab: every
schema key still gets a Document row and a JSON block editor.

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
- **`document`** — that editor's exit is a NEW document (the arc's rule that
  generation is not an edit); nothing comes back here.
- **`none`** — that editor only READS the block.

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
that fires it (the debugger's **Send costs to the document**) happens long after
`open()` returned. The panel drops it the moment the working copy goes away.

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

**Only grown worlds have a map**, by ⚖ (*"show the composite grid only for
presets that have grid data"*). A `grid_cell` per region is written by the maze /
top-down / spiral pipelines; Seedling, JtA and zone-only worlds write sidecars
without one, so the tab prints *"No map for this world (no grid data in the
sidecars)"* and the reason — and draws **nothing else**. There is deliberately no
region-graph fallback here: the graph is its own panel.

**Clicking a cell selects that region in the Regions tab** (`panel.selectRegion(name)`,
the panel's one selection entry point). The click→cell mapping is the renderer's
exported geometry (`canvasPointOf` / `cellAtPoint`), the same functions the
pipeline's hit-tester calls, so a click and a pixel cannot disagree about where a
cell is. The map outlines the selected cell and the Regions tab marks the same
region's block (`[data-region-name][data-selected]`).

**"Open region graph" is ONE-WAY**, by ⚖: *"We could add a button to open the
region graph, but I don't want a button in the region graph leading back to the
APWorld editor."* The button raises `regionGraphPanel` through the same
`DOCUMENT_LINKS` row the Links tab uses, and **nothing was added under
`regionGraph/`**.

The rebuilt grid is memoised on the record's object identity plus the selected
slot, because `_render` runs on every tab switch and a whole deserialize pass per
render would sit beside the `validateRules` pass that already costs 4.6 s on the
corpus's largest document.

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
(`panel._noMapReason()`):

| what the document has | the sentence |
|---|---|
| no `preset_sidecars` at all | *this document carries no `preset_sidecars`* |
| sidecars, none for the selected slot | *player slot N carries no sidecars* |
| sidecars, no `grid_cell` on any | *no grid data in the sidecars* — Seedling, JtA |
| `grid_cell` on every region, no tile-grid payload | *N regions carry a grid cell, but `bounce` stores no tile-grid geometry in the payload* |

⚠ The last row is a **zone** substrate, and it looked like the third one until
H4a: every no-map document in the corpus carried no `grid_cell`, so one sentence
covered the corpus by accident. A bounce level's geometry is
`params.bounceLevel.size` **in pixels**; the composite view sizes its cells from
`playable_payload.width`/`height` **in tiles**, which bounce has none of. It is
the ⚖-ruled "no map for this world" answer for zone worlds (plan §7 ⚖ 3),
reached for a reason the panel can now state.

### The four-player fixture

`frontend/presets/multiworld/AP_05594871498841892311/` (seed 4) is the only
committed document whose `preset_sidecars` carry more than one slot, and the
whole per-player half of this panel is tested against it. Slots 1–2 are
`Procgen Maze WorldGen` (3 grown regions each), slots 3–4 `Bounce Demo WorldGen`
(5 zone regions each) — so the selector, the Map tab and the Document tab's
per-player slice each have a document that can tell *"read the selected slot"*
from *"read the first one"*. Before it, 158 of the 192 committed carriers held
`{}` and every populated one keyed under slot `"1"`.

## Edit ▸ — a region's room, in its own editor

A region with a `preset_sidecars` entry has a **room**, and the substrate that
owns it usually has an editor for it. The Regions header's `Edit ▸` opens that
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
| no `preset_sidecars` entry | **no button** — a classic AP region has no room, and a disabled control would imply it might have one |
| a substrate with no `roomEditor` (jta, omsi, runner, text_adventure) | **disabled**, titled *"No region editor for X yet"* |
| a substrate that declares `regionRoundTrip: {refused}` (Seedling) | **disabled**, titled with the substrate's own sentence — its payload is an atlas reference, not a room record |
| a region whose payload does not round-trip | **enabled until pressed**, then disabled with the reason (see below) |
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

Measured over the committed corpus: **394 of 1,046** maze-payload sidecar
regions and **15 of 25** bounce regions are editable, and every one of the rest
gets a named reason. `procgen_topdown`'s maze regions are the biggest refusal
class — their locations are named by the source game (`global_name`), which the
payload does not carry.

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
| publishes | `ui:activatePanel` | the Links tab's rows, the Document tab's block-editor doors, and the Map tab's one-way *Open region graph*. ⛔ H5 found this was **never registered** in the module's `register()`, and `eventBus.publish` refuses an unregistered publisher — warns and returns — so H1's Links tab Open and H3's *Open region graph* had been silently doing nothing since they shipped. A test row now scans the panel's own `publish('…')` sites against `register()` |
| publishes | `procgenPipeline:loadRules` | H5 — the `procgen_metadata` door; `{jsonData, source, player}` |
| publishes | `loopsCostDebugger:loadRules` | H5 — the `loop_costs` door; same payload plus L4's `onSave` |

## Tests

| Suite | Where |
|-------|-------|
| `rulesDocOps.test.js`, `rulesEditAdapter.test.js`, `rulesUtils.test.js`, `documentKeys.test.js`, `documentLinks.test.js`, `hubExits.test.js`, `regionRoundTrip.test.js`, `reverseLinks.test.js` | vitest, `frontend/modules/apworldEditor/` |
| `../procgenCore/compositeMapRenderer.test.js` | vitest — the Map tab's renderer, driven by a TOY substrate |
| `../procgenPipeline/compositeMapDocument.test.js` | vitest — `preset_sidecars` → `Grid`, including the player slot |
| `presetUI.test.js` | vitest — the "Open in APWorld Editor" descriptor |
| `measure-apworld-raw-view.mjs` | `scripts/procgen/` — the browser measurement; `--all` opens the raw tab over every committed preset, which is what RETIRED `RAW_VIEW_LIMIT_BYTES` |
| `apworldEditorTests.js` | the in-app runner, category `apworldEditor`, enabled in `playwright_tests_config-substrates.json` (`npm test -- --mode=test-substrates --batch=fast`) |
| `check-procgen-lab-hosting.mjs` claim 12 | `scripts/procgen/` — the reverse link end to end, from a button inside an iframe to a session in this panel |
