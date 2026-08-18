# Procgen demonstrations — a catalogue

Every demonstrable feature of the two procgen lab pages, one entry each, with
the link that shows it, the CLI command that reproduces it in node, which
control to press, and what you are looking at.

⚖ It exists because the user asked for it on the 2026-08-17 generation review
(§4 item 6): *"interactive DEMONSTRATIONS of every demonstrable feature — URL +
how to run + what is happening"*.

## ⛔ THE CATALOGUE IS NOT IN THIS FILE ANY MORE

⚖ The user, 2026-08-18: *"change demos.md to an html file, so that it can
interact with the scripts directly, rather than having to be manually edited"*.
It is now ONE data module with TWO readers, and this page is a pointer at them:

| | |
|---|---|
| **the DATA** | [`frontend/modules/procgenDocs/demos.js`](../../../../frontend/modules/procgenDocs/demos.js) — a frozen array, one entry per demo. ⛔ **Edit the catalogue HERE and nowhere else.** |
| **the GLOSSARY** | Every entry carries a `terms:` line, and each term links to its definition on <https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html> — 140 of them, data in [`frontend/modules/procgenDocs/glossary.js`](../../../../frontend/modules/procgenDocs/glossary.js). ⛓ An entry names glossary SLUGS; the glossary page computes the back-links, so the two directions cannot drift. |
| **the PAGE** | `frontend/modules/procgenDocs/demos.html` — renders the module in a browser. Read it at <https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html>, or locally at `http://localhost:8000/frontend/modules/procgenDocs/demos.html`. |
| **the ROW** | [`scripts/procgen/check-procgen-demos.mjs`](../../../../scripts/procgen/check-procgen-demos.mjs) — IMPORTS the same module, loads every link the page shows and asserts every entry's own claim off the page's readout. |

Each entry carries a **claim** — `<path> <op> <value>` — asserted off the live
page, plus the **phase** to step to, the **fact lines** to tick and the
**overlay layer** to set, which the row PRESSES before it asserts. An entry
whose seed stops behaving the way its prose says goes RED rather than rotting
quietly. ⛔ **A catalogue entry without a claim is not an entry**, and the row
fails on one.

```bash
node scripts/procgen/check-procgen-demos.mjs                 # the whole catalogue
node scripts/procgen/check-procgen-demos.mjs --only=sword-gated
node scripts/procgen/check-procgen-demos.mjs --only=7        # by number, too
node scripts/procgen/check-procgen-demos.mjs --pages=https://peerinfinity.github.io/Archipelago-CC
```

⛓ Both link spellings — the local one and the deployed one — are COMPUTED from
the entry by `localHref()` / `pagesHref()` in the module, so the page's links
and the row's are the same strings by construction. Before this there was a
hand-kept `Live:` line per entry and a claim here whose whole job was to notice
when it drifted. `--pages=<base>` runs the catalogue against the deployed site;
⚠ Pages serves the tree as of the last push to `main`, so a demo whose page
changed locally but has not been pushed shows the older behaviour there
(`.github/workflows/deploy-gh-pages.yml` publishes `frontend/` AS the site
root, which is why `/frontend/modules/…` here is `/Archipelago-CC/modules/…`
there).

## How to add an entry

Append an object to `DEMOS` in `demos.js`, in the shape the file's header
documents: a stable `id` slug (the page's anchor and the row's `--only=` key),
`n`, `title`, `page`, `url`, `cli`, the optional `phase`/`facts`/`layer`, the
`claim`, the three prose blocks, and `terms: []`. Nothing else needs editing —
not this file, not the page, not the row.

⛔ **NEVER HAND-SPELL A URL.** Every one in the catalogue came out of the page's
own writer; a hand-typed one that the writer would spell differently is not a
fixed point, and the entry stops being a reproduction of the run it names. Run
the writer:

```bash
node --input-type=module -e "
import {writeGenerateParams} from './frontend/modules/seedlingDemo/watchGenerate.js';
import {seedlingSkeletonSpec} from './frontend/modules/seedlingDemo/procgenSeedling.js';
import {writeLabParams} from './frontend/modules/mazeRoom/mazeLab.js';
const B = (c = 0) => ({ obstacleTarget: c, triesPerStep: 8, saturationK: 3,
                        anchorTriesPerCandidate: 1 });
// SEEDLING — watch.html
console.log(writeGenerateParams('', { seed: 30, biome: 'post-sword', bounds: B(6),
  step: 6, require: ['hasSword'] }));
// MAZE — lab.html
console.log(writeLabParams('', { seed: 1, biome: 'maze-v1', width: 15, height: 15,
  bounds: B(2), budget: { maxExpansions: 20000 }, step: 2,
  skeleton: seedlingSkeletonSpec('rooms'), areas: { keys: 1 }, require: ['K0'] }));"
```

⚠ **THREE SHAPES THAT COST A RUN EACH TO FIND** (arc 3 kickoff §17.15):

1. **`require` IS A BARE ARRAY OF STRINGS**, not `{asked: [...]}`. The reports
   on `summary.require` and `__editorGenerate.require` carry `.asked`, so the
   natural guess is that the writer takes the same shape — it does not, and
   `formatRequireList` throws `(list ?? []).join is not a function` rather than
   refusing by name.
2. **`bounds` KEY NAMES ARE THE LONG ONES** — `obstacleTarget`, `triesPerStep`,
   `saturationK`, `anchorTriesPerCandidate` — not the URL's short spellings
   (`count`, `tries`, `k`, `anchortries`). `writeBounds` maps one to the other
   and a wrong key writes NOTHING rather than complaining.
3. **BOTH WRITERS ALREADY EMIT `run=1` when `step > 0`.** Appending `&run=1`
   yourself produces `run=1&run=1`, which the reader accepts and the catalogue
   would then carry as the declared string forever.

⛓ Then run the row bare (`--only=` narrows to one entry and is not a check of
the catalogue as a whole).
