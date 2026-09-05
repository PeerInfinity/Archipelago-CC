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
| **Regions** | regions, exits, locations, access rules |
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

### The `editor` slot

`documentKeys.DOCUMENT_KEY_EDITORS` is a `key → {open}` table that later rungs
fill — `region_atlas` → the marking tool, `procgen_metadata` → the pipeline,
`loop_costs` → the cost debugger. It is **empty** today, and a test row asserts so,
so the day it is filled is visible rather than buried in a diff.

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

⚠ A region rebuilt from sidecars carries no top-level `exits` (the field the
pipeline's own placements set), so a **loaded** document's map draws the cells and
their exit squares but no inter-region connection lines. That is pre-existing —
the pipeline panel's loaded-preset view has always looked that way — and H3 left
it alone rather than changing a view it was asked to keep byte-inert.

## The Links tab

Substrate rows are **derived** from the substrate registry's own `roomEditor`
declarations (see [`regionEditors`](../developer/procgen/architecture.md)); the
document-level rows — the region marking tool, the procgen pipeline, the loops
cost debugger, the two raw JSON editors and the region graph — are a table
written once, because a panel declares nothing about which key it edits.

Rows open their editor **empty** when the document has no data for it; the tab
draws even with no document loaded at all. Rows whose editor reads **applied**
state (the cost debugger, both raw editors) say so, because they will not see the
working copy until you press Apply.

⚖ The region graph link is **one-way** by user ruling: this tab opens the graph,
and the graph has no button back here. Do not "fix" that asymmetry.

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
| subscribes | `apworldEditor:loadRules` | the focus-safe hand-off the pipeline and the marking tool use |
| publishes | `files:jsonLoaded` | Apply — a full-document clone, under the **origin's** `sourceName` (`apworldEditorApply` only when there is no origin) |
| publishes | `ui:activatePanel` | the Links tab's rows, and the Map tab's one-way *Open region graph* |

## Tests

| Suite | Where |
|-------|-------|
| `rulesDocOps.test.js`, `rulesEditAdapter.test.js`, `rulesUtils.test.js`, `documentKeys.test.js`, `documentLinks.test.js`, `hubExits.test.js` | vitest, `frontend/modules/apworldEditor/` |
| `../procgenCore/compositeMapRenderer.test.js` | vitest — the Map tab's renderer, driven by a TOY substrate |
| `../procgenPipeline/compositeMapDocument.test.js` | vitest — `preset_sidecars` → `Grid`, including the player slot |
| `presetUI.test.js` | vitest — the "Open in APWorld Editor" descriptor |
| `measure-apworld-raw-view.mjs` | `scripts/procgen/` — the browser measurement; `--all` opens the raw tab over every committed preset, which is what RETIRED `RAW_VIEW_LIMIT_BYTES` |
| `apworldEditorTests.js` | the in-app runner, category `apworldEditor`, enabled in `playwright_tests_config-substrates.json` (`npm test -- --mode=test-substrates --batch=fast`) |
