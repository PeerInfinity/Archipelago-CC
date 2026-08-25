# Procedural Generation

Developer documentation for the procedural-generation ("procgen") system: the pipeline that generates multi-region game worlds in the browser, the substrates that provide per-region playable content, and the runtime that plays the result.

⛔⛔ **THE INDEX BELOW IS GENERATED** — one row per `.md` in this directory, with the document's own H1 and its own first paragraph, written by `scripts/procgen/generate-procgen-reference.mjs` and gated by `--check` (regenerate = no diff). ⛔ If an entry reads thin, the fix is a better opening paragraph in the document it describes, not a better sentence here.

<!-- GENERATED:procgen-docs-index BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**17 documents · 4 pages · 203,970 words.**

Order: `README_ORDER` in `scripts/procgen/reference/docsIndex.mjs` — today's reading order, declared. A file in the directory that is not in that list is a HARD ERROR, so a new document cannot arrive unindexed.

Descriptions: the document's OWN first paragraph, collapsed onto one line; past 400 characters it is cut to its first sentence. ⛔ Never a hand-written summary — if an entry reads thin, the fix is a better opening paragraph in the document.

| Document | Description | Words |
|---|---|---|
| [Procedural Generation Architecture](./architecture.md) | This is the orientation document for the procedural-generation ("procgen") system: the pipeline, the four layout drivers, **level generation's two passes** (elements and the certified area graph, then the site-typed keep-or-revert loop), the substrates, what a world compiles to, and how it is played back. Read this first; the rest of this section goes deeper on individual pieces. | 7973 |
| [Substrate Registry Reference](./substrate-registry.md) | `frontend/modules/shared/procgen/substrateRegistry.js` is the dispatch hub between the pipeline, the runtime player and the substrates: each registers an **entry**, and consumers look entries up by `id` instead of importing substrate modules. This is the reference for that entry contract — field by field, a capability matrix GENERATED from the eight entries, and a checklist for adding one. | 4171 |
| [Procgen demonstrations — a catalogue](./demos.md) | Every demonstrable feature of the two procgen lab pages, one entry each, with the link that shows it, the CLI command that reproduces it in node, which control to press, and what you are looking at. | 859 |
| [Procgen Gotchas and Disambiguations](./gotchas.md) | Short entries for the things most likely to mislead someone orienting in the procgen code. Each is a present-state fact with file pointers, not a bug report. | 5394 |
| [Bounce Substrate](./bounce.md) | Bounce ("Bounce Demo", substrate id `bounce`) is a Doodle-Jump-style vertical platformer substrate in `frontend/modules/bounceDemo/`. | 2365 |
| [Runner Substrate](./runner.md) | Runner ("Runner Demo", substrate id `runner`) is an auto-runner platformer substrate in `frontend/modules/runnerDemo/`. | 4318 |
| [Playback and Debugging Tools](./playback-and-debugging.md) | The procgen stack ships a family of tools for *watching a world play itself*: a playback bot that walks recorded playthroughs, a substrate-neutral controller contract with iframe proxies, shared timing/UI primitives, a forward simulator that generates sphere logs, and per-substrate visualizers. | 937 |
| [Loop Recording and Block Modes](./loop-recording.md) | How loop mode captures what a player does in a region and plays it back: the per-block **mode system** (Manual / Record / Playback / Bot), the per-block **Instant** toggle, the **saved-recording store**, the **capture contract** that decides whether the loops module or the substrate owns recording, the **queue annotations** describing what a recorded visit cost, and the **loop-mode interaction … | 7866 |
| [Maze Substrate](./maze.md) | The maze substrate (`frontend/modules/mazeRoom/`, substrate id `maze`) renders regions as grid-of-tiles maze rooms: the player walks tile by tile, picks up items by stepping onto location tiles, and leaves through exit tiles on the perimeter. | 9046 |
| [Sphere-Driven Growth](./sphere-growth.md) | Sphere growth is the primary procgen driver: instead of growing a world and then discovering its progression structure, it **plans the progression first** — which items belong to which sphere — and then grows a world guaranteed to realise that plan. The plan doubles as a verification oracle, so every generated world ships with a proof that its progression matches the intent. | 1456 |
| [Paths and Obstacles](./paths-and-obstacles.md) | Paths-and-obstacles is the intermediate representation procgen uses for access rules. | 914 |
| [The Stepped Pipeline](./stepped-pipeline.md) | Sphere growth, top-down, and shuffled-spiral can run as monolithic calls or as a sequence of discrete, inspectable, editable steps. | 1523 |
| [Text Adventure Substrate](./text-adventure.md) | The text-adventure substrate (id `text_adventure`) renders a procgen region as prose: a textual description with compass-labelled clickable exits and clickable locations. Under the hood it is a *tile-grid world wearing a text skin* — its build-time hooks reuse the shared tile-grid adapter primitives verbatim, so its sidecar shape is identical to the maze's; only the panel differs. | 687 |
| [The Seedling Real-Game Bot, and the tracked record of the procgen arcs on `watch.html`](./seedling-bot.md) | How we drive the **real recompiled Seedling** with a scripted input tape and check a JavaScript model of its physics against what the game actually did — movement, collision, room transitions and A\* pathing. This file is also the tracked record of the procgen arcs built on `watch.html`, § *The procgen ELEMENTS design* being the current one. | 143449 |
| [Flash Substrate](./flash.md) | The flash substrate (`frontend/modules/flashSubstrate/`, id `flash`) hosts recompiled Flash games — SWF → C → WASM via SWFRecomp-CC — in a same-origin iframe as procgen regions. The module ships a placeholder game page, so it is testable independently of any real recompiled game; its real significance is as the **shared iframe-substrate machinery** other substrates build on. | 981 |
| [JtA Substrate](./jta.md) | The JtA substrate (`frontend/modules/jtaSubstrateWrapper/`, id `jta`) hosts the Journey to Ascension fork — an incremental/idle game in the `frontend/modules/journey-to-ascension/` submodule — in a same-origin iframe as a loop-mode substrate. It is the **reference zone-based substrate** (one AP region = one JtA zone, instantiated by ordinal), with host-side shared-mana brokering. | 4814 |
| [Omsi Substrate (Idle Loops)](./omsi.md) | The omsi substrate (`frontend/modules/omsiSubstrateWrapper/`, id `omsi`) hosts the **`PeerInfinity/omsi-loops` fork of dmchurch's Idle Loops** — included as the `frontend/modules/omsi-loops/` git submodule, pinned at `2bda39b` — in a same-origin iframe as a loop-mode substrate. | 7217 |

**The four pages.** These are not `.md` files: they render in a browser, and only `frontend/` is published to Pages.

| Page | What it renders |
|---|---|
| [Procgen demonstrations — a catalogue](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html) | procgenDocs/demos.html — **THE PROCGEN DEMO CATALOGUE, RENDERED.** One entry per demonstrable feature of the two procgen lab pages, each with the link that shows it (here AND on the deployed site), the CLI command that reproduces it in node, which control to press, and what you are looking at. |
| [Procgen documents — the tracked records, rendered](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/docs.html) | procgenDocs/docs.html — **THE PROCGEN NARRATIVE DOCUMENTS, ON PAGES.** One viewer for the seventeen tracked `.md` files under `docs/json/developer/procgen/` plus the README that indexes them: GitHub's heading anchors, a nav in README's declared reading order, a table of contents off the render, and every relative li… |
| [Procgen glossary — the vocabulary, defined](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html) | procgenDocs/glossary.html — **THE PROCGEN GLOSSARY, RENDERED.** One entry per term the procgen docs and the two lab pages use as vocabulary: a plain-language sentence first, then the concrete rule and where it lives. |
| [Procgen reference — the six generated tables](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html) | procgenDocs/reference.html — **THE PROCGEN REFERENCE, GENERATED FROM THE CODE.** Six tables nobody should ever author by hand, because the code already knows the answer: the URL parameter grammar of the two lab pages, the generation catalogue, the refusal vocabulary, the substrate-registry capability matrix, the ins… |

<!-- GENERATED:procgen-docs-index END -->

## Related documentation

- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference for running the pipelines outside the browser
- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Developer documentation index](../README.md)
