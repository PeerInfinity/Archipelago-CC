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
| `rawView.js` | the **Raw JSON** tab's text, its parse, and the **measured** size limit |
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
| **Document** | **every** top-level key — see below |
| **Links** | every other editor that owns part of a `rules.json` |
| **Raw JSON** | the whole document as text — see *The exits* below |

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

### The Raw JSON tab, and its MEASURED limit

The tab shows `JSON.stringify(record, null, 2)` in a text area. Saving parses the
text and records **one** `replace-document` op, so a single undo folds the whole
text edit away — and, as with `set-key`, the schema gets a veto first (a preview,
validated whole, differenced against the errors the document already had).

⛔ The op carries the **parsed** document, never the text: an edit list whose
payload is a recipe that can fail to re-parse is not a record.

`rawView.RAW_VIEW_LIMIT_BYTES` is **2,000,000 bytes of pretty-printed JSON**, and
it is a *measurement* — `node scripts/procgen/measure-apworld-raw-view.mjs` drives
the real panel over the median, p90 and true-max committed documents plus a
synthetic size sweep, reporting the panel's own re-render cost, the raw tab's
time-to-interactive and keystroke latency. The full table is in that constant's
comment. The short version:

| pretty bytes | textarea open | textarea keystroke | CM6 open | CM6 keystroke |
|---|---|---|---|---|
| 203,178 (median preset) | 403 ms | 235 ms | 133 ms | 141 ms |
| 766,891 (p90 preset) | 2,050 ms | 192 ms | 105 ms | 37 ms |
| **2,000,000 (the limit)** | **1,504 ms** | **279 ms** | 43 ms | 14 ms |
| 2,620,225 (`stardew_valley`) | ~7,185 ms | 468–809 ms | 100 ms | 58 ms |
| 3,146,656 (`procgen_topdown/AP_8`, the max) | 12,942 ms | 1,251 ms | 88 ms | 123 ms |

2,000,000 is the largest size **measured usable**, not a round number between two
points. The guard refuses **4 of the 205** presets. Above it the tab says the
size, names the limit, offers the download — and offers **Show it anyway**,
because a limit that cannot be overridden is a document its owner cannot look at.

⚠ **The measurement also says the textarea is the wrong widget.** CodeMirror 6 is
viewport-virtualised and flat (30–133 ms to open, 11–240 ms per keystroke, from
200 KB to 8 MB) and would retire this constant. Mounting it is six lines from
`editorCodeMirror6/codemirror6Imports.js`; integrating it into the hub is not (a
second read-the-text path, undo interplay, theming, the bundled import graph).
It is a **costed follow-up**, with its numbers, not part of this rung.

## Events

| Direction | Event | Notes |
|-----------|-------|-------|
| subscribes | `stateManager:rawJsonDataLoaded` | opens a session; its own Apply echo is ignored **by object identity** (`_appliedDocs`) — the source name is no longer a marker |
| subscribes | `apworldEditor:loadRules` | the focus-safe hand-off the pipeline and the marking tool use |
| publishes | `files:jsonLoaded` | Apply — a full-document clone, under the **origin's** `sourceName` (`apworldEditorApply` only when there is no origin) |
| publishes | `ui:activatePanel` | the Links tab's rows |

## Tests

| Suite | Where |
|-------|-------|
| `rulesDocOps.test.js`, `rulesEditAdapter.test.js`, `rulesUtils.test.js`, `documentKeys.test.js`, `documentLinks.test.js`, `hubExits.test.js` | vitest, `frontend/modules/apworldEditor/` |
| `presetUI.test.js` | vitest — the "Open in APWorld Editor" descriptor |
| `measure-apworld-raw-view.mjs` | `scripts/procgen/` — the browser measurement `RAW_VIEW_LIMIT_BYTES` is set from |
| `apworldEditorTests.js` | the in-app runner, category `apworldEditor`, enabled in `playwright_tests_config-substrates.json` (`npm test -- --mode=test-substrates --batch=fast`) |
