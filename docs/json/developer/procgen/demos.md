# Procgen demonstrations — a catalogue

A catalogue of every demonstrable feature of the two procgen lab pages: the link that shows it, the command that reproduces it in node, which control to press, and what you are looking at. The catalogue itself is data in `demos.js`; this page says where it lives and how to add to it.

## Where the catalogue lives

| What | Where |
|---|---|
| Data (edit here only) | [`frontend/modules/procgenDocs/demos.js`](../../../../frontend/modules/procgenDocs/demos.js), the `DEMOS` array |
| Rendered page | [demos.html on Pages](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html), or `http://localhost:8000/frontend/modules/procgenDocs/demos.html` |
| Glossary | Each entry's `terms` link into [glossary.html](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html) (data: [`glossary.js`](../../../../frontend/modules/procgenDocs/glossary.js)) |
| Check | [`scripts/procgen/check-procgen-demos.mjs`](../../../../scripts/procgen/check-procgen-demos.mjs) |

Every entry carries a **claim** (`<path> <op> <value>`). The check script imports `demos.js`, loads each entry's link, applies its optional `phase`, `facts`, `layer`, `press` and `keys`, and asserts the claim against the page's readout. It also runs each entry's `cli` command and checks its exit code. An entry without a claim fails, unless it is a `prose` entry that has no link of its own and points at a doc instead.

```bash
node scripts/procgen/check-procgen-demos.mjs                  # whole catalogue
node scripts/procgen/check-procgen-demos.mjs --only=sword-gated   # one entry, by id or number
node scripts/procgen/check-procgen-demos.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
```

`--pages=` runs the catalogue against the deployed site, which only reflects what has been pushed to `main`. `localHref()` and `pagesHref()` in `demos.js` compute both link spellings, so the page and the check always use the same URLs.

## How to add an entry

Append an object to `DEMOS` in `demos.js`, using the field list in the file's header comment. Nothing else needs editing.

Generate the `url` with the page's own writer instead of typing it: `writeGenerateParams` in `frontend/modules/seedlingDemo/watchGenerate.js` for `watch.html`, `writeLabParams` in `frontend/modules/mazeRoom/mazeLab.js` for `lab.html`. A hand-typed URL that the writer would spell differently does not reproduce the run it names.

The writers refuse three common mistakes by name:

- `require` must be a bare array of strings, not the reports' `{asked: [...]}` shape (`formatRequireList`).
- `bounds` takes the long keys (`obstacleTarget`, `triesPerStep`, `saturationK`, `anchorTriesPerCandidate`), not the URL's short ones (`writeBounds`).
- The writers already add `run=1` when `step > 0`; adding it again makes a duplicate parameter (`refuseDuplicateParams`).

After adding an entry, run the check without `--only=` to cover the whole catalogue.
