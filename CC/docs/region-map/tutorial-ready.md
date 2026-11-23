# Region map tutorial: `tracker-region-map` is READY

Branch `region-map-tutorial-ready`, cut at `d297a042e1` (`git merge-base HEAD origin/main` at launch:
`d297a042e1f905e9b8d52292e1fe6ebf5fb9b981`). The gated code tip is **`a2b0986919`**. Before the packet, origin/main was still
`d297a042e1`, an ancestor of the tip, so there was nothing to merge. This report is a docs-only commit after the code tip.

## The ruling

- **2026-11-23T03:59:34.663Z, session 84c8ab35 (archipelago-cc-23): "Mark READY".** The user answered this question, asked after
  they saw the art-ends before/after shots: *"Lines now end at the door tile (Seedling: all 160 line ends), or at the level
  art's edge (A Link to the Past: all 502). Remaining nits: at the phone's Fit-all zoom one arrowhead (L16→L17) is longer than
  its line, and the fixed 8 px arrowheads and rings look small when zoomed far in. Mark 'Tracking: the Region Map' READY?"*
- ⚖ 2026-10-10: only the user marks a tutorial READY.
- js-22 review (GO WITH 2 EDITS, 2026-11-23): name every pin that moves; walk on both boots, `tutorials-tracker` in CI, ×8.

## What changed (no step or wording change)

1. `tutorials/content/tracker/regionMap.js`: `status: 'ready'`, `firstFailingStep` removed,
   `doc: 'docs/json/user/tutorials/tracker-region-map.md'`, and the header comment.
2. `generate-tutorial-docs.mjs --write`: the new guide `docs/json/user/tutorials/tracker-region-map.md`. In
   `docs/json/user/modules/tutorials.md`, the entry moves from *In progress* to *Tracking a game*, with its guide link.
3. `docs/json/user/modules/regionMap.md`: the Tutorial line now links the guide instead of saying "It is still in progress."
4. `quickLaunch/generated/docsIndex.js`: regenerated, **201 → 202 docs** (its `--check` drifted after step 2).
5. `playwright_tests_config-substrates.json`: the `_comment` on the walk row says READY. The row itself is unchanged.

**Pins moved:** the generated tutorials index (`tutorials.md`), the Quick Launch docs index (201 → 202), and the new guide,
which the doc pin in `tutorials.test.js` now compares. No doc-link census number moved: `docLinks.test` and `docsRender.test`
are green unchanged. No other count of ready or in-progress tutorials exists to move.

## What the READY walk asserts

`tutorialWalk.js` `ratchetVerdict` for `status: 'ready'`: the walk must end `complete`. Every panel step is performed and its
`done` holds; any failure is `ready, but it fails at step N`. This is the same end the in-progress record `firstFailingStep:
null` already required, so the row's bar did not drop. What is new is that a regression now reads as a broken READY tutorial.
Every run below reported **`ready: every step works`**.

## Proof (all at `a2b0986919`)

| What | Result |
|---|---|
| Bounded vitest (tutorials/, procgenDocs/, quickLaunch/, docsBase, ciDocsOnly) | 14 files / 567 tests and 10 / 172, green |
| `generate-tutorial-docs.mjs --check` / `generate-docs-index.mjs --check` | OK (25 docs) / OK (202 docs) |
| Local walk, unbundled ×2 (port 8143) | PASSED 47.2 s, 48.9 s |
| Local walk, `--bundled` | PASSED 55.0 s (`flavour: bundled`) |
| JSUT run 45234614643 | success; 1424 / 29946, 0 failed. Base `d297a042e1` (run 45110129406): 1424 / 29946, so **+F 0, +T 0** |
| unittests run 45234614460 | success |
| TT (test-templates) dispatch run 45234708521 | success |
| `tutorials-tracker` run 45234614006 | 9/9 passed; region-map 16.5 s; **HEADROOM OK 62.4 s of 600.0 s (10%)** |
| Repeat run 45234619999 (`repeat=8`) | **Rate: 8/8 passed** |
| Closure (`--print-engine-closure`) | 42 files, engineMd5 `74ae60f575531492ed9eaec1839e1fe3`. Closure ∩ diff = ∅, so the md5 is the same at base and tip. No `train_only` is owed |
| Gitlinks in the diff | 0 |

## Noted, not changed

- The user's two remaining nits stand as known: at the phone's Fit-all zoom, the L16→L17 arrowhead is longer than its line;
  the fixed 8 px heads and rings look small when zoomed far in.
- No typos found in the tutorial text.
